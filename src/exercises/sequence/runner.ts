/**
 * Shared runner of the single-note sequence exercises (E9 chromatic, E10 scale ladder, E11 hammer-ons,
 * E17 riffs — SPEC v1.1 §10.10). The metronome clicks the beat; notes fall on the grid (one or two per click).
 * With a microphone the cycles are judged by the DSP worker through SequenceTracker; without one each cycle is
 * self-reported (1 = flawless, 2 = a mistake). H hides/shows the TAB (§12.3).
 *
 * P pauses (D-085): the metronome stops, the interrupted cycle is cut and, after a one-bar count-in on a new grid,
 * played again under a new cycle id (the first cycle after a pause is `resumed`: a flawless streak starts over).
 * Enter while paused ends the run like Space does while playing.
 *
 * Ladder exercises (E9, E10, E17) let ↑/↓ pick the tempo while the run waits to start (D-098).
 */
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import type { SequenceCycle } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import { Timeline } from '../timeline';
import type { DspStats, ExerciseContext, RunnerCommand, SequenceBacking } from '../types';
import { type CycleOutcome, type PlannedSlot, SequenceTracker } from './tracker';

export interface PlannedNote {
  /** Guitar string number 6 … 1. */
  string: number;
  fret: number;
  midi: number;
  /** Hammer-on slot (E11): judged by the legato beta only. */
  legato?: boolean;
  /** Fretting finger 1–4 (0 = open string), shown under the TAB (D-080). */
  finger?: number;
}

export interface SequenceView {
  bpm: number;
  tabHidden: boolean;
  source: 'mic' | 'self';
  /** Notes of the cycle being played and the index due now (null outside the grid). */
  cycleNotes: readonly PlannedNote[];
  noteIndex: number | null;
  /** Notes of the last recorded cycle (its faults index into them). */
  lastCycleNotes: readonly PlannedNote[] | null;
  cycleNumber: number;
  cycles: readonly SequenceCycle[];
  streak: number;
  countIn: boolean;
  analyzing: boolean;
  /** ↑/↓ and −5/+5 pick the tempo now (ready, in an exercise that allows it, D-098). */
  tempoPickable: boolean;
}

/** Seconds of notes planned ahead of the audio clock. */
const PLAN_AHEAD_S = 4;
/** Tempo picked before the start (D-098): steps and range, like the ladder's. */
const TEMPO_PICK_STEP_BPM = 5;
const TEMPO_PICK_MIN_BPM = 30;
const TEMPO_PICK_MAX_BPM = 240;

/**
 * Current run of flawless cycles (uncertain cycles neither extend nor break it; it starts at the first cycle
 * after a pause, D-085).
 */
export function flawlessStreak(
  cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain' | 'resumed'>[],
): number {
  let n = 0;
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i]!;
    if (c.flawless) n += 1;
    else if (!c.uncertain) break;
    if (c.resumed) break;
  }
  return n;
}

export abstract class SequenceRunner<R, V extends SequenceView> extends BaseRunner<R, V> {
  protected readonly cycleRecords: SequenceCycle[] = [];
  protected tabHidden: boolean;
  /** TAB stayed hidden while every cycle so far was played (memorization runs). */
  protected hiddenThroughout: boolean;
  protected readonly source: 'mic' | 'self';
  private tracker: SequenceTracker | null = null;
  /** Slots played so far, one segment per stretch between pauses (unit = one note slot, D-085). */
  private timeline: Timeline;
  /** Bumped when a pending metronome start must not open its segment any more (pause, end). */
  private startEpoch = 0;
  private starting = false;
  /** Cycle ids planned so far (a replayed cycle gets a new id). */
  private plannedCycles = 0;
  /** Note slots planned so far (= the tracker's slot count). */
  private plannedNotes = 0;
  /** Content index of each cycle id (planCycle's argument): a replay repeats the interrupted cycle's. */
  private readonly contentOf: number[] = [];
  private nextContent = 0;
  /** Cycles still to be played or judged, in order, with their first note slot. */
  private liveCycles: { id: number; start: number }[] = [];
  private readonly recordedIds = new Set<number>();
  /** Ids of the first cycles after a pause; `pendingResumed` marks the next one planned. */
  private readonly resumedIds = new Set<number>();
  private pendingResumed = false;
  /** Matched onsets per segment (keyed by its grid), for ioi_cv without the pause gaps. */
  private readonly onsetsBySegment = new Map<number, number[]>();
  private readonly segmentOf: number[] = [];
  private readonly cycleNotesByIndex: PlannedNote[][] = [];
  private noteIndex: number | null = null;
  private lastRecordedNotes: PlannedNote[] | null = null;
  private cycleNumber = 0;
  private waiting = false;
  /** Every matched onset time of the run (ioi_cv). */
  protected readonly onsetTimes: number[] = [];

  constructor(
    ctx: ExerciseContext,
    /** The run's tempo: the ladder's, or the one picked before the start (D-098). */
    protected bpm: number,
    tabHidden: boolean,
    /** Notes per metronome click (1 = quarters, 2 = eighths). */
    private readonly notesPerBeat: number,
  ) {
    super(ctx);
    this.tabHidden = tabHidden;
    this.hiddenThroughout = tabHidden;
    this.source = ctx.audio ? 'mic' : 'self';
    this.timeline = new Timeline(60 / bpm / notesPerBeat);
  }

  /** Notes of the k-th cycle's content (0-based; a cycle replayed after a pause repeats its k). */
  protected abstract planCycle(k: number): PlannedNote[];
  /** Called after each judged or self-reported cycle (ladder state, etc.). */
  protected onCycleRecorded(): void {}
  /** Called when a pause stops the take (e.g. E10 stops its backing). */
  protected onPauseTake(): void {}
  /** ↑/↓ pick the tempo before the start (ladder exercises, D-098); E11 keeps its own ladder tempo. */
  protected tempoPickable(): boolean {
    return false;
  }

  /** Matched onset times grouped by the stretch they were played in (sorted), for a pooled ioi_cv (D-085). */
  protected onsetGroups(): number[][] {
    return [...this.onsetsBySegment.values()].map((g) => [...g].sort((a, b) => a - b));
  }

  protected get slotS(): number {
    return 60 / this.bpm / this.notesPerBeat;
  }

  protected baseView(): SequenceView {
    return {
      bpm: this.bpm,
      tabHidden: this.tabHidden,
      source: this.source,
      cycleNotes: this.cycleNotesByIndex[this.cycleNumber] ?? this.planPreview(),
      noteIndex: this.noteIndex,
      lastCycleNotes: this.lastRecordedNotes,
      cycleNumber: this.cycleNumber,
      cycles: [...this.cycleRecords],
      streak: flawlessStreak(this.cycleRecords),
      countIn: this.phase === 'countIn',
      analyzing: this.waiting,
      tempoPickable: this.phase === 'ready' && this.tempoPickable(),
    };
  }

  private preview: PlannedNote[] | null = null;
  private planPreview(): PlannedNote[] {
    this.preview ??= this.planCycle(0);
    return this.preview;
  }

  start(): void {
    this.setPhase('ready');
  }

  command(cmd: RunnerCommand): void {
    if (this.phase === 'done') return;
    if (cmd === 'abort') {
      this.ctx.output.metronome.stop();
      this.tracker?.stop();
      this.setPhase('done');
      return;
    }
    if (this.handlePause(cmd)) return;
    if (cmd === 'hide' && this.phase !== 'review') {
      this.tabHidden = !this.tabHidden;
      // Shown while paused counts as shown while playing (the run goes on afterwards, D-085).
      if (
        !this.tabHidden &&
        (this.phase === 'running' || this.phase === 'countIn' || this.phase === 'paused')
      )
        this.hiddenThroughout = false;
      this.publish();
      return;
    }
    if (this.phase === 'ready' && (cmd === 'inc' || cmd === 'dec')) {
      if (this.tempoPickable()) this.pickTempo(cmd === 'inc' ? TEMPO_PICK_STEP_BPM : -TEMPO_PICK_STEP_BPM);
      return;
    }
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next')) {
      this.begin();
      return;
    }
    // Enter while paused ends the run, keeping the cycles so far (D-085).
    if (this.phase === 'paused' && cmd === 'next') {
      this.end();
      return;
    }
    if (this.phase !== 'running' && this.phase !== 'countIn') return;
    if (this.source === 'self' && (cmd === 'manual1' || cmd === 'manual2')) {
      this.lastRecordedNotes = this.cycleNotesByIndex[this.cycleNumber] ?? null;
      this.record(this.cycleNumber, {
        flawless: cmd === 'manual1',
        uncertain: false,
        stops: 0,
        okRatio: null,
      });
      return;
    }
    if (cmd === 'toggle' || (cmd === 'next' && this.cycleRecords.length > 0)) this.end();
  }

  /** Nothing is planned before the start: the empty timeline is simply rebuilt at the new tempo. */
  private pickTempo(delta: number): void {
    const bpm = Math.min(TEMPO_PICK_MAX_BPM, Math.max(TEMPO_PICK_MIN_BPM, this.bpm + delta));
    if ((bpm - this.bpm) * delta <= 0) return;
    this.bpm = bpm;
    this.timeline = new Timeline(60 / bpm / this.notesPerBeat);
    this.publish();
  }

  private begin(): void {
    const metronome = this.ctx.output.metronome;
    this.own(() => metronome.stop());
    if (this.ctx.audio) {
      // 'onsets' keeps the engine judging (synth playback is refused while the microphone listens, §8.6).
      this.ctx.audio.setJob({ kind: 'onsets' });
      this.own(() => this.ctx.audio?.setJob(null));
      this.tracker = new SequenceTracker(this.ctx.audio, {
        bpm: this.bpm,
        ...(this.ctx.calibration?.tuningCents ? { deltaCents: this.ctx.calibration.tuningCents } : {}),
      });
      this.own(this.tracker.onCycle((c) => this.onTracked(c)));
    }
    this.setPhase('countIn');
    this.launch();
  }

  /** Starts the metronome (one count-in bar); its grid opens a segment at the next note slot. */
  private launch(): void {
    const metronome = this.ctx.output.metronome;
    const epoch = ++this.startEpoch;
    this.starting = true;
    void metronome
      .start(
        { ...DEFAULT_METRONOME_CONFIG, bpm: this.bpm, visualOnly: this.ctx.settings.visualOnlyMetronome },
        { rttMs: this.ctx.calibration?.rttMs ?? 0 },
      )
      .then(() => {
        // The run may have ended (Space, abort), paused or been left while the audio context was starting.
        if (this.isDisposed || epoch !== this.startEpoch || this.phase !== 'countIn') return;
        this.starting = false;
        const grid = metronome.gridStartTime();
        if (grid === null) return;
        this.timeline.begin(grid, this.plannedNotes);
        this.planAhead(this.ctx.output.now());
        this.onGrid(grid);
        this.publish();
      })
      .catch(() => {
        // Without a metronome there is no grid to judge against: the run ends without cycles.
        if (!this.isDisposed && this.phase !== 'done') this.setPhase('done');
      });
  }

  /** Points the judging at a speaker backing's events (D-102); `pending` holds the judging until the gain is set. */
  protected maskBacking(backing: SequenceBacking | null, pending = false): void {
    this.tracker?.setBacking(backing, pending);
  }

  /** Called once a segment's grid origin (bar 1 after the count-in) is known: the start, and every resume. */
  protected onGrid(_gridStart: number): void {}

  /**
   * Pause (D-085): the metronome stops and the cycle being played is cut — or the one before it, when the pause
   * came within one beat of its start and it was not recorded yet — to be played again after the resume. In a
   * count-in nothing was played: that segment is dropped and the pause is not counted.
   */
  protected override pauseTake(): { counted: boolean } | null {
    const open = this.timeline.open;
    if (!open && !this.starting) return null;
    const now = this.ctx.output.now();
    this.startEpoch++;
    this.starting = false;
    this.ctx.output.metronome.stop();
    this.onPauseTake();
    this.noteIndex = null;
    if (!open) return { counted: false };
    if (now < open.grid) {
      const first = this.liveCycles.find((c) => c.start >= open.first);
      if (first) this.cutFrom(first.id, first.start);
      this.timeline.discardOpen();
      return { counted: false };
    }
    const cycleAt = (t: number) => {
      const position = this.timeline.position(t);
      return this.liveCycleAt(Math.floor(position ?? open.first));
    };
    let cut = cycleAt(now - 60 / this.bpm);
    if (!cut || this.recordedIds.has(cut.id) || cut.start < open.first) cut = cycleAt(now);
    if (!cut) {
      // Nothing planned in this segment yet: as if paused in its count-in.
      this.timeline.discardOpen();
      return { counted: false };
    }
    this.cutFrom(cut.id, cut.start);
    this.timeline.close(cut.start);
    this.pendingResumed = true;
    this.cycleNumber = cut.id;
    return { counted: true };
  }

  /** Drops cycle `id` and the ones planned after it; the next cycle planned plays its content again. */
  private cutFrom(id: number, start: number): void {
    const at = this.slotTime(start);
    this.plannedNotes = this.tracker ? this.tracker.cutAt(at) : start;
    this.liveCycles = this.liveCycles.filter((c) => c.id < id);
    this.nextContent = this.contentOf[id] ?? this.nextContent;
    if (this.resumedIds.has(id)) this.pendingResumed = true;
  }

  protected override resumeTake(): void {
    this.launch();
  }

  /** The live cycle note slot `n` belongs to (the last one starting at or before it). */
  private liveCycleAt(n: number): { id: number; start: number } | null {
    let found: { id: number; start: number } | null = null;
    for (const c of this.liveCycles) if (c.start <= n) found = c;
    return found;
  }

  /** Expected arrival of note n (grid + RTT + personal lead, §10.10 input). */
  private slotTime(n: number): number {
    const rtt = (this.ctx.calibration?.rttMs ?? 0) / 1000;
    const lead = (this.ctx.personalOffsetMs ?? 0) / 1000;
    return this.timeline.start(n)! + rtt + lead;
  }

  private planAhead(now: number): void {
    const open = this.timeline.open;
    if (!open) return;
    while (this.plannedNotes <= open.first || this.slotTime(this.plannedNotes) < now + PLAN_AHEAD_S) {
      const id = this.plannedCycles++;
      const content = this.nextContent++;
      const notes = this.planCycle(content);
      this.contentOf[id] = content;
      this.segmentOf[id] = open.grid;
      this.cycleNotesByIndex[id] = notes;
      this.liveCycles.push({ id, start: this.plannedNotes });
      if (this.pendingResumed) {
        this.resumedIds.add(id);
        this.pendingResumed = false;
      }
      const slots: PlannedSlot[] = notes.map((n, j) => ({
        time: this.slotTime(this.plannedNotes + j),
        midi: n.midi,
        stringIdx: 6 - n.string,
        cycle: id,
        ...(n.legato ? { legatoAllowed: true } : {}),
      }));
      this.plannedNotes += notes.length;
      this.tracker?.addSlots(slots);
    }
  }

  private onTracked(c: CycleOutcome): void {
    this.onsetTimes.push(...c.onsetTimes);
    const segment = this.segmentOf[c.cycle] ?? 0;
    const group = this.onsetsBySegment.get(segment) ?? [];
    group.push(...c.onsetTimes);
    this.onsetsBySegment.set(segment, group);
    this.lastRecordedNotes = this.cycleNotesByIndex[c.cycle] ?? null;
    const faults = c.notes.flatMap((n, index) =>
      n.status === 'OK' || n.status === 'HAMMER_OK'
        ? []
        : [{ index, status: n.status, ...(n.semitones === undefined ? {} : { semitones: n.semitones }) }],
    );
    this.record(c.cycle, {
      flawless: c.flawless,
      uncertain: c.uncertain,
      stops: c.stops,
      okRatio: c.okRatio,
      hitRate: c.hitRate,
      extras: c.extras,
      faults,
    });
  }

  private record(id: number, cycle: SequenceCycle): void {
    this.recordedIds.add(id);
    this.cycleRecords.push(this.resumedIds.has(id) ? { ...cycle, resumed: true } : cycle);
    this.onCycleRecorded();
    this.publish();
  }

  private end(): void {
    this.startEpoch++;
    this.ctx.output.metronome.stop();
    if (this.tracker) {
      // Notes already played are still judged; the planned ones after now are dropped.
      this.tracker.stopAt(this.ctx.output.now());
      this.waiting = true;
      this.setPhase('review');
      return;
    }
    this.setPhase('done');
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    // The segment being played (D-085): after a pause its count-in comes first, on a new grid.
    const open = this.timeline.open;
    if (open && (this.phase === 'countIn' || this.phase === 'running')) {
      if (this.phase === 'countIn' && now >= open.grid) this.setPhase('running');
      this.planAhead(now);
      const position = this.timeline.position(now);
      const n = position === null ? null : Math.floor(position);
      // In the count-in: the segment's first cycle, no note yet.
      const live = this.liveCycleAt(n ?? open.first);
      const cycle = live?.id ?? this.cycleNumber;
      const index = n === null || !live ? null : n - live.start;
      if (index !== this.noteIndex || cycle !== this.cycleNumber) {
        this.noteIndex = index;
        this.cycleNumber = cycle;
        this.publish();
      }
    }
    this.tracker?.pump(now);
    if (this.phase === 'review' && this.waiting && this.tracker?.idle) {
      this.waiting = false;
      this.setPhase('done');
    }
  }

  hasResult(): boolean {
    return this.cycleRecords.length > 0;
  }

  override dspStats(): DspStats {
    return this.tracker ? this.tracker.stats() : super.dspStats();
  }

  override dispose(): void {
    this.startEpoch++;
    this.ctx.output.metronome.stop();
    this.tracker?.stop();
    super.dispose();
  }
}
