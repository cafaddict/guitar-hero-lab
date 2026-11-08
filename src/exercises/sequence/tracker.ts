/**
 * Microphone side of the single-note sequence exercises (E9, E10, E11, E17 — SPEC v1.1 §10.10). The runner
 * plans slots on the metronome grid (grid + RTT + personal lead) as the run goes; the tracker sends them to the
 * DSP worker in chunks that fit the capture ring (≤ maxChunkS of audio), each chunk with the notes judged just
 * before it (they may still ring) and the span in which it owns EXTRA onsets, so a long cycle is judged exactly
 * like one long recording. A cycle is complete once all of its slots and its EXTRA span are judged.
 *
 * A pause cuts the plan (cutAt, D-085): the cycles it interrupted never complete, and the slots planned after the
 * resume start a new stretch that is judged like the start of a take (nothing reaches back across the gap).
 *
 * A speaker backing (E10 "반주와 함께", D-102) goes with every chunk: the backing events inside its audio, so the
 * worker drops the onsets that are backing bleed. Without a bleed gain no chunk is sent: the slots wait for one
 * as long as the capture ring can still give their audio back, then count as unclear (not as mistakes).
 */
import {
  countStops,
  cycleVerdict,
  DEFAULT_SEQUENCE_PARAMS,
  matchingWindowS,
  type NoteStatus,
  type SequenceSlot,
} from '../../dsp/sequence';
import type { ExerciseMic, SequenceBacking, SequenceOutcome } from '../types';

export interface PlannedSlot extends SequenceSlot {
  /** Audio-clock seconds the note is expected at (grid + RTT + personal lead). */
  time: number;
  cycle: number;
}

export interface JudgedNote {
  status: NoteStatus;
  cents?: number;
  semitones?: number;
  onsetTime?: number;
}

export interface CycleOutcome {
  cycle: number;
  flawless: boolean;
  uncertain: boolean;
  stops: number;
  /** Share of OK notes among the cycle's (non-legato) slots. */
  okRatio: number;
  /** Share of slots with a matched onset (hit_rate). */
  hitRate: number;
  extras: number;
  notes: JudgedNote[];
  /** Onset times of the matched notes (for ioi_cv). */
  onsetTimes: number[];
}

export interface TrackerOptions {
  bpm: number;
  deltaCents?: readonly number[];
  /** Longest audio chunk per request (the capture ring keeps ~3.9 s). */
  maxChunkS?: number;
  /** Audio before the first slot of a chunk (onset detector warm-up). */
  leadS?: number;
  /** Audio after a slot before it can be judged (pitch window + onset refinement). */
  tailS?: number;
  /** The oldest waiting slot is sent after this long even when the chunk could take more. */
  batchS?: number;
  /** How long a slot waits for the backing's bleed gain; its chunk must still fit in the ring afterwards. */
  maxBackingWaitS?: number;
}

const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class SequenceTracker {
  private readonly slots: PlannedSlot[] = [];
  private readonly judged: (JudgedNote | null)[] = [];
  private readonly extras: number[] = [];
  /** First slot not yet requested, and the end of the EXTRA span already covered. */
  private next = 0;
  private coveredTo: number | null = null;
  private inFlight = false;
  private readonly done = new Set<number>();
  /** Slots planned per cycle (a cycle cut short by stop() never completes). */
  private readonly cycleSizes = new Map<number, number>();
  /** Cycles a pause interrupted: they never complete (their content is played again under a new id). */
  private readonly cancelled = new Set<number>();
  /** Slot indices where a stretch after a pause starts (ascending); chunks never span one. */
  private readonly barriers: number[] = [];
  private readonly completed: CycleOutcome[] = [];
  private readonly listeners = new Set<(c: CycleOutcome) => void>();
  private processingTotal = 0;
  private requests = 0;
  private version: string | null = null;
  private readonly maxChunkS: number;
  private readonly leadS: number;
  private readonly tailS: number;
  private readonly batchS: number;
  private readonly maxBackingWaitS: number;
  private ended = false;
  private backing: SequenceBacking | null = null;
  private backingPending = false;

  constructor(
    private readonly mic: ExerciseMic,
    private readonly options: TrackerOptions,
  ) {
    this.maxChunkS = options.maxChunkS ?? 3.2;
    this.leadS = options.leadS ?? 0.6;
    this.tailS = options.tailS ?? 0.35;
    this.batchS = options.batchS ?? 1;
    this.maxBackingWaitS = options.maxBackingWaitS ?? 2.5;
  }

  /**
   * The speaker backing whose events the chunks from now on mask (null = none). `pending`: its bleed gain is
   * not known — chunks wait for the next call, and slots that cannot wait any longer turn unclear.
   */
  setBacking(backing: SequenceBacking | null, pending = false): void {
    this.backing = backing;
    this.backingPending = pending;
  }

  /** Appends planned slots (time order). */
  addSlots(slots: readonly PlannedSlot[]): void {
    for (const s of slots) {
      this.slots.push(s);
      this.judged.push(null);
      this.cycleSizes.set(s.cycle, (this.cycleSizes.get(s.cycle) ?? 0) + 1);
    }
  }

  get plannedCount(): number {
    return this.slots.length;
  }

  onCycle(listener: (c: CycleOutcome) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  cycles(): readonly CycleOutcome[] {
    return this.completed;
  }

  /** True while a chunk is being judged (the runner waits before finishing). */
  get busy(): boolean {
    return this.inFlight;
  }

  /** Drops the slots not yet requested (the run ended); their cycles never complete. */
  stop(): void {
    this.stopAt(Number.NEGATIVE_INFINITY);
  }

  /**
   * The run ended at audio time `at`: slots due by then are still judged (call pump() until idle), later ones
   * are dropped — a cycle cut short never completes.
   */
  stopAt(at: number): void {
    this.ended = true;
    let keep = this.slots.length;
    while (keep > this.next && this.slots[keep - 1]!.time > at) keep--;
    this.slots.length = keep;
    this.judged.length = keep;
  }

  /**
   * A pause (D-085): every cycle with a slot at or after audio time `at` is cancelled, and the slots from `at`
   * on that were not requested yet are dropped. Returns the slot count kept (≥ the slots already requested):
   * slots added from now on start a new stretch there. The slots before the cut are judged without waiting
   * for more (the capture ring must still hold them).
   */
  cutAt(at: number): number {
    for (const s of this.slots) if (s.time >= at) this.cancelled.add(s.cycle);
    let keep = this.slots.length;
    while (keep > this.next && this.slots[keep - 1]!.time >= at) keep--;
    this.slots.length = keep;
    this.judged.length = keep;
    if (this.barriers.at(-1) !== keep) this.barriers.push(keep);
    return keep;
  }

  /** First slot of the stretch slot `i` belongs to. */
  private stretchStart(i: number): number {
    let start = 0;
    for (const b of this.barriers) if (b <= i) start = b;
    return start;
  }

  /** Nothing left to request or wait for. */
  get idle(): boolean {
    return !this.inFlight && this.next >= this.slots.length;
  }

  stats(): { detectorVersion: string | null; meanProcessingMs: number; events: number } {
    return {
      detectorVersion: this.version,
      meanProcessingMs: this.requests ? this.processingTotal / this.requests : 0,
      events: this.requests,
    };
  }

  private window(i: number): number {
    return matchingWindowS(this.slots, i, this.options.bpm, DEFAULT_SEQUENCE_PARAMS);
  }

  /** Requests the next chunk when its slots are far enough in the past; call on every tick. */
  pump(now: number): void {
    if (this.inFlight || this.next >= this.slots.length) return;
    if (this.backingPending) {
      this.giveUpOldSlots(now);
      return;
    }
    const first = this.next;
    const head = this.slots[first]!.time;
    // After a pause the stretch starts over like a take: no EXTRA span, earlier notes or chunk across the gap.
    const stretch = this.stretchStart(first);
    const barrier = this.barriers.find((b) => b > first) ?? Number.POSITIVE_INFINITY;
    const fresh = first === stretch;
    // The chunk reaches back far enough to own the EXTRA onsets since the previous chunk, but always leaves
    // room for its first slot (after a long gap the oldest stretch is given up rather than overflowing the ring).
    let extraFrom = (fresh ? null : this.coveredTo) ?? head - this.window(first);
    const from = Math.max(Math.min(head - this.leadS, extraFrom - 0.3), head + this.tailS - this.maxChunkS);
    extraFrom = Math.max(extraFrom, from + 0.3);
    // A second detection of the previous chunk's last note is a duplicate there, not an EXTRA here (§10.10:
    // unmatched onsets within duplicateMs of a matched one are ignored, as in a whole-take verification).
    const previousOnset = first > stretch ? this.judged[first - 1]?.onsetTime : undefined;
    if (previousOnset !== undefined)
      extraFrom = Math.max(extraFrom, previousOnset + DEFAULT_SEQUENCE_PARAMS.duplicateMs / 1000);
    let last = -1;
    let full = false;
    for (let i = first; i < Math.min(this.slots.length, barrier); i++) {
      const end = this.slots[i]!.time + this.tailS;
      if (end - from > this.maxChunkS) {
        full = true;
        break;
      }
      if (end > now) break;
      last = i;
    }
    if (last < 0) return;
    // Batch slots so each chunk sees its neighbours (matching windows, pitch windows), unless the chunk is
    // full, the oldest slot has waited batchS, or the run has ended or paused (nothing more will come).
    const flushing = (this.ended && last === this.slots.length - 1) || last === barrier - 1;
    if (!full && !flushing && now - (head + this.tailS) < this.batchS) return;
    const extraTo = this.slots[last]!.time + this.window(last);
    const group = this.slots.slice(first, last + 1);
    const ringingS = DEFAULT_SEQUENCE_PARAMS.ringingMs / 1000;
    const priorNotes = this.slots.slice(stretch, first).flatMap((s, k) => {
      const j = this.judged[stretch + k];
      const at = j?.onsetTime ?? s.time;
      if (!j || j.status === 'MISSED' || this.slots[first]!.time - at > ringingS) return [];
      return [{ f0: midiHz(s.midi + (j.semitones ?? 0)), stringIdx: s.stringIdx, time: at }];
    });
    this.inFlight = true;
    this.next = last + 1;
    const to = this.slots[last]!.time + this.tailS;
    const backing = this.backingIn(from, to);
    void this.mic
      .analyzeSequence({
        from,
        to,
        bpm: this.options.bpm,
        slots: group,
        ...(this.options.deltaCents ? { deltaCents: this.options.deltaCents } : {}),
        priorNotes,
        extraSpan: [extraFrom, extraTo],
        ...(backing ? { backing } : {}),
      })
      .then((outcome) => this.accept(first, outcome, extraTo))
      .catch(() => {
        // The capture ring may have moved on (a stalled tab): those slots count as unclear, not as mistakes.
        for (let i = first; i <= last; i++) this.judged[i] = { status: 'UNCLEAR' };
        this.coveredTo = extraTo;
        this.inFlight = false;
        this.settleCycles();
      });
  }

  /** Without a bleed gain, slots whose audio is about to leave the ring: nothing can judge them any more. */
  private giveUpOldSlots(now: number): void {
    const first = this.next;
    while (this.next < this.slots.length && now - this.slots[this.next]!.time > this.maxBackingWaitS) {
      this.judged[this.next] = { status: 'UNCLEAR' };
      this.coveredTo = this.slots[this.next]!.time + this.window(this.next);
      this.next++;
    }
    if (this.next > first) this.settleCycles();
  }

  /** The backing events whose mask windows reach into [from, to] (a little margin for the re-refinement). */
  private backingIn(from: number, to: number): SequenceBacking | null {
    const b = this.backing;
    if (!b) return null;
    const margin = 0.1;
    const inside = b.arrivals.flatMap((t, i) => (t >= from - margin && t <= to + margin ? [i] : []));
    return {
      arrivals: inside.map((i) => b.arrivals[i]!),
      templateRises: inside.map((i) => b.templateRises[i]!),
      gain: b.gain,
    };
  }

  private accept(first: number, outcome: SequenceOutcome, extraTo: number): void {
    this.version = outcome.detectorVersion;
    this.processingTotal += outcome.processingMs;
    this.requests++;
    outcome.notes.forEach((n, k) => {
      this.judged[first + k] = {
        status: n.status,
        ...(n.cents === undefined ? {} : { cents: n.cents }),
        ...(n.semitones === undefined ? {} : { semitones: n.semitones }),
        ...(n.onsetTime === undefined ? {} : { onsetTime: n.onsetTime }),
      };
    });
    this.extras.push(...outcome.extras);
    this.coveredTo = extraTo;
    this.inFlight = false;
    this.settleCycles();
  }

  /** Emits every cycle whose slots are all judged and whose EXTRA span is covered. */
  private settleCycles(): void {
    const byCycle = new Map<number, number[]>();
    for (const [i, s] of this.slots.entries()) {
      const indices = byCycle.get(s.cycle);
      if (indices) indices.push(i);
      else byCycle.set(s.cycle, [i]);
    }
    let previousEnd = Number.NEGATIVE_INFINITY;
    for (const [cycle, indices] of [...byCycle.entries()].sort((a, b) => a[0] - b[0])) {
      const lastIdx = indices.at(-1)!;
      const end = this.slots[lastIdx]!.time + this.window(lastIdx);
      const ready =
        indices.length === this.cycleSizes.get(cycle) &&
        indices.every((i) => this.judged[i] !== null) &&
        (this.coveredTo ?? Number.NEGATIVE_INFINITY) >= end;
      if (ready && !this.done.has(cycle) && !this.cancelled.has(cycle)) {
        this.done.add(cycle);
        const notes = indices.map((i) => this.judged[i]!);
        const nonLegato = indices.filter((i) => !this.slots[i]!.legatoAllowed);
        const extraCount = this.extras.filter((e) => e > previousEnd && e <= end).length;
        const verdict = cycleVerdict(
          indices.map((i) => ({
            status: this.judged[i]!.status,
            legato: this.slots[i]!.legatoAllowed === true,
          })),
          extraCount,
        );
        const outcome: CycleOutcome = {
          cycle,
          ...verdict,
          stops: countStops(notes.map((n) => n.status)),
          okRatio: nonLegato.length
            ? nonLegato.filter((i) => this.judged[i]!.status === 'OK').length / nonLegato.length
            : 1,
          hitRate: notes.filter((n) => n.onsetTime !== undefined).length / notes.length,
          extras: extraCount,
          notes,
          onsetTimes: notes.flatMap((n) => (n.onsetTime === undefined ? [] : [n.onsetTime])),
        };
        this.completed.push(outcome);
        for (const l of this.listeners) l(outcome);
      }
      previousEnd = end;
    }
  }
}
