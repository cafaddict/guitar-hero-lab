/**
 * Single-note sequence verification (SPEC v1.1 §10.10) — scales, chromatic groups, riffs, fretboard notes.
 *
 * 1. Onsets come from a sequence-tuned onset path (`SEQUENCE_ONSET_PARAMS`), kept separate from the strum
 *    path so the v1 strum metrics never move (§14.8 "v1 하드 게이트 보호").
 * 2. Matching: each slot takes the nearest onset inside min(§10.8 BPM window, 0.4 × neighbour gap), greedy
 *    by distance. Unmatched slots are MISSED; unmatched onsets are EXTRA unless within 60 ms of a matched
 *    onset (a double detection of the same note).
 * 3. Pitch: restricted MPM over [onset + 30 ms, onset + min(130 ms, next slot − 20 ms)], range f0/1.5..f0·1.5.
 *    Notes still ringing on other strings are removed first with comb filters tuned to their periods
 *    (de Cheveigné's harmonic cancellation): an LTI comb keeps the new note periodic, so MPM still sees it.
 *    When the expected note is a harmonic of a ringing note (octave, twelfth), a harmonic-pass comb keeps
 *    only the shared partials instead of cancelling them.
 * 4. |cents| ≤ 35 → OK, otherwise WRONG_NOTE (semitone difference), clarity < 0.85 → UNCLEAR.
 * 4a. Speaker backing (E10 "반주와 함께", D-102): with a backing schedule, onset candidates within a backing event's
 *    arrival ± maskWindowMs that the low-band test (backingMask.ts, §10.12) calls bleed are dropped before
 *    grouping, so a leaked chord tone can neither fill an unplayed slot nor count as EXTRA.
 * 5. Cycles: flawless when every slot is OK (legato slots may be HAMMER_OK or undetermined) and no EXTRA
 *    falls in the cycle; any UNCLEAR makes it uncertain (not flawless, does not break a streak); otherwise a
 *    mistake. Two or more consecutive MISSED slots count as one stop.
 */

import { type BackingSchedule, backingKeepFlags } from './backingMask';
import {
  computeFlux,
  DEFAULT_ONSET_PARAMS,
  groupStrums,
  type OnsetCandidate,
  type OnsetParams,
  pickOnsets,
  refineOnset,
} from './onset';
import { mpm } from './pitch';
import { timingWindowMs } from './timing';
import { DETECTOR_VERSION } from './version';

/** Onset path for single notes: no anticipation suppression (a soft note before a loud one is a note). */
export const SEQUENCE_ONSET_PARAMS: OnsetParams = {
  ...DEFAULT_ONSET_PARAMS,
  groupMs: 40,
  anticipationRatio: 0,
};

export interface SequenceParams {
  pitchStartMs: number;
  pitchEndMs: number;
  /** The pitch window ends this long before the next slot. */
  nextSlotGuardMs: number;
  pitchFrameMs: number;
  pitchHopMs: number;
  toleranceCents: number;
  clarityMin: number;
  /** Frame-clarity quantile taken as the note's clarity (attack frames are less periodic than the note). */
  clarityQuantile: number;
  /** Fraction of the neighbouring slot gap that bounds the matching window. */
  gapWindowFraction: number;
  /** An unmatched onset this close to a matched one is the same note detected twice. */
  duplicateMs: number;
  /** Notes started within this long before an onset are treated as still ringing. */
  ringingMs: number;
  /** At most this many ringing notes (most recent, one per string) are cancelled. */
  maxCancelled: number;
  /** A ringing note within this many cents of a harmonic (×1, ×2, …) of the expected note is not cancelled. */
  harmonicMatchCents: number;
}

export const DEFAULT_SEQUENCE_PARAMS: SequenceParams = {
  pitchStartMs: 30,
  pitchEndMs: 130,
  nextSlotGuardMs: 20,
  pitchFrameMs: (2048 / 48000) * 1000,
  pitchHopMs: (256 / 48000) * 1000,
  toleranceCents: 35,
  clarityMin: 0.8,
  clarityQuantile: 0.75,
  gapWindowFraction: 0.4,
  duplicateMs: 60,
  ringingMs: 1500,
  maxCancelled: 3,
  harmonicMatchCents: 50,
};

export interface SequenceSlot {
  /** Expected onset (s, recording timeline: grid + RTT + personal lead already applied). */
  time: number;
  midi: number;
  /** 0 = 6th string … 5 = 1st string, when the position is known. */
  stringIdx?: number;
  legatoAllowed?: boolean;
  /** Cycle index (scale cycle, riff pass, chromatic group). */
  cycle?: number;
}

export interface SequenceOnset {
  sample: number;
  strength: number;
  broadband: boolean;
}

export type NoteStatus = 'OK' | 'WRONG_NOTE' | 'UNCLEAR' | 'MISSED' | 'HAMMER_OK';

export interface SequenceNoteResult {
  slot: number;
  status: NoteStatus;
  cents?: number;
  semitones?: number;
  clarity?: number;
  f0?: number;
  /** Detected onset − expected time (ms). */
  onsetOffsetMs?: number;
  onsetSample?: number;
}

export interface SequenceCycleResult {
  cycle: number;
  flawless: boolean;
  uncertain: boolean;
  extras: number;
}

export interface SequenceResult {
  notes: SequenceNoteResult[];
  /** Onset samples matched to no slot (EXTRA). */
  extras: number[];
  cycles: SequenceCycleResult[];
  /** Whole take: flawless / uncertain by the same rule over all slots. */
  flawless: boolean;
  uncertain: boolean;
  stops: number;
  hitRate: number;
  ioiCv: number | null;
  detectorVersion: string;
  processingMs: number;
}

export interface SequenceInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  slots: readonly SequenceSlot[];
  bpm: number;
  /** Onsets from the sequence onset path; computed here when absent. */
  onsets?: readonly SequenceOnset[];
  /** Calibration offset per string (cents, index 0 = 6th string). */
  deltaCents?: readonly number[];
  params?: SequenceParams;
  onsetParams?: OnsetParams;
  /**
   * Notes judged before this stretch of audio (a long take is verified in chunks): they may still ring at the
   * first slots, so they join the cancellation. `startSample` is relative to `samples` (negative = earlier).
   */
  priorNotes?: readonly RingingNote[];
  /** Only onsets in [from, to] s may be EXTRA (a chunk owns the extras up to its last slot's window). */
  extraSpanS?: readonly [number, number];
  /** Speaker backing events (samples relative to `samples`) whose bleed onsets are masked (D-102). */
  backing?: BackingSchedule;
}

/**
 * Offline sequence onset path: flux → peaks → refinement → (backing mask) → grouping (no anticipation
 * suppression).
 */
export function detectSequenceOnsets(
  signal: ArrayLike<number>,
  sampleRate: number,
  params: OnsetParams = SEQUENCE_ONSET_PARAMS,
  backing?: BackingSchedule,
): SequenceOnset[] {
  const frames = computeFlux(signal, sampleRate, params);
  const frameLength = Math.round((params.frameMs / 1000) * sampleRate);
  let candidates: OnsetCandidate[] = pickOnsets(frames, sampleRate, frameLength, params);
  let refined = candidates.map((c) => refineOnset(signal, c.sample, frameLength, sampleRate, params));
  if (backing) {
    // Same mask as the strum path (detectStrums): a leaked backing strum is not a note the user played.
    const keep = backingKeepFlags(signal, sampleRate, refined, backing, (i, from) =>
      refineOnset(signal, candidates[i]!.sample, frameLength, sampleRate, params, from),
    );
    candidates = candidates.filter((_, i) => keep[i]);
    refined = refined.filter((_, i) => keep[i]);
  }
  const groups = groupStrums(candidates, refined, sampleRate, params.groupMs);
  // groupStrums keeps the first member's coarse sample: recover that member's broadband flag.
  return groups.map((g) => ({
    sample: g.sample,
    strength: g.strength,
    broadband: candidates.find((c) => c.sample === g.coarseSample)?.broadband ?? true,
  }));
}

const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** x[n − d] for fractional d with 4-point Lagrange interpolation (0 outside the signal). */
function delayed(x: ArrayLike<number>, n: number, d: number): number {
  const pos = n - d;
  const i = Math.floor(pos);
  const f = pos - i;
  const at = (k: number) => (k >= 0 && k < x.length ? x[k]! : 0);
  const xm1 = at(i - 1);
  const x0 = at(i);
  const x1 = at(i + 1);
  const x2 = at(i + 2);
  return (
    (-f * (f - 1) * (f - 2) * xm1) / 6 +
    ((f + 1) * (f - 1) * (f - 2) * x0) / 2 -
    ((f + 1) * f * (f - 2) * x1) / 2 +
    ((f + 1) * f * (f - 1) * x2) / 6
  );
}

export interface CombStage {
  /** Period (samples) of the ringing note. */
  period: number;
  /** 1 = cancel the note; m ≥ 2 = keep only its harmonics that are multiples of m. */
  keepMultiple: number;
}

/** Applies the comb cascade to x[start, end) (reading earlier samples as needed). */
export function combFiltered(x: ArrayLike<number>, start: number, end: number, stages: readonly CombStage[]) {
  const reach = Math.ceil(stages.reduce((s, c) => s + c.period, 0)) + 4;
  const from = Math.max(0, start - reach);
  let buf = new Float64Array(end - from);
  for (let n = from; n < end; n++) buf[n - from] = x[n] ?? 0;
  for (const stage of stages) {
    const next = new Float64Array(buf.length);
    for (let n = 0; n < buf.length; n++) {
      if (stage.keepMultiple <= 1) next[n] = buf[n]! - delayed(buf, n, stage.period);
      else {
        let sum = 0;
        for (let k = 0; k < stage.keepMultiple; k++)
          sum += k === 0 ? buf[n]! : delayed(buf, n, (k * stage.period) / stage.keepMultiple);
        next[n] = sum / stage.keepMultiple;
      }
    }
    buf = next;
  }
  return { samples: buf, offset: from };
}

export interface RingingNote {
  f0: number;
  stringIdx: number | undefined;
  startSample: number;
}

/** Comb stages for the notes still ringing when a note with `expectedF0` starts. */
export function cancellationStages(
  expectedF0: number,
  ringing: readonly Pick<RingingNote, 'f0'>[],
  sampleRate: number,
  params: Pick<SequenceParams, 'maxCancelled' | 'harmonicMatchCents'>,
): CombStage[] {
  const stages: CombStage[] = [];
  for (const r of params.maxCancelled > 0 ? ringing.slice(-params.maxCancelled) : []) {
    const ratio = expectedF0 / r.f0;
    const m = Math.round(ratio);
    const harmonic = m >= 1 && Math.abs(1200 * Math.log2(ratio / m)) <= params.harmonicMatchCents;
    if (harmonic && m === 1) continue; // unison: the ringing note is the expected pitch
    stages.push({ period: sampleRate / r.f0, keepMultiple: harmonic ? m : 1 });
  }
  return stages;
}

/** Restricted MPM median over the window of the comb-filtered signal. */
export function measureSequencePitch(
  samples: ArrayLike<number>,
  sampleRate: number,
  startSample: number,
  endSample: number,
  expectedF0: number,
  stages: readonly CombStage[],
  params: SequenceParams,
): { f0: number | null; clarity: number } {
  const frame = Math.round((params.pitchFrameMs / 1000) * sampleRate);
  const hop = Math.max(1, Math.round((params.pitchHopMs / 1000) * sampleRate));
  const end = Math.min(samples.length, endSample);
  if (end - startSample < frame) return { f0: null, clarity: 0 };
  const source = stages.length ? combFiltered(samples, startSample, end, stages) : { samples, offset: 0 };
  const estimates: { f0: number; clarity: number }[] = [];
  for (let s = startSample; s + frame <= end; s += hop) {
    const est = mpm(
      source.samples,
      s - source.offset,
      frame,
      sampleRate,
      expectedF0 / 1.5,
      expectedF0 * 1.5,
      {
        restricted: true,
      },
    );
    if (est) estimates.push(est);
  }
  if (estimates.length === 0) return { f0: null, clarity: 0 };
  const clarity = [...estimates.map((e) => e.clarity)].sort((a, b) => a - b)[
    Math.floor(params.clarityQuantile * (estimates.length - 1))
  ]!;
  const pool = estimates.filter((e) => e.clarity >= 0.5);
  const f0s = (pool.length ? pool : estimates).map((e) => e.f0).sort((a, b) => a - b);
  return { f0: f0s[f0s.length >> 1]!, clarity };
}

export interface NoteJudgement {
  status: 'OK' | 'WRONG_NOTE' | 'UNCLEAR';
  cents?: number;
  semitones?: number;
  f0?: number;
  clarity: number;
}

/**
 * One note's pitch verdict (§10.10-2): restricted MPM over [onset + 30 ms, onset + endMs] after cancelling the
 * still-ringing notes; shared by verifySequence and the GuitarSet solo benchmark.
 */
export function judgeSequenceNote(input: {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  /** Window end after the onset (ms): min(pitchEndMs, next slot − guard). */
  endMs: number;
  expectedF0: number;
  ringing: readonly RingingNote[];
  params?: SequenceParams;
}): NoteJudgement {
  const params = input.params ?? DEFAULT_SEQUENCE_PARAMS;
  const fs = input.sampleRate;
  const stages = cancellationStages(input.expectedF0, input.ringing, fs, params);
  const start = input.onsetSample + Math.round((params.pitchStartMs / 1000) * fs);
  const end = input.onsetSample + Math.round((input.endMs / 1000) * fs);
  // With nothing ringing the comb is skipped; otherwise the cancelled and the plain measurement compete on
  // clarity (a real string's stretched partials can leave comb residue that the plain signal does not have).
  const cancelled = measureSequencePitch(input.samples, fs, start, end, input.expectedF0, stages, params);
  const plain = stages.length
    ? measureSequencePitch(input.samples, fs, start, end, input.expectedF0, [], params)
    : cancelled;
  const pitch = plain.clarity > cancelled.clarity ? plain : cancelled;
  const cents = pitch.f0 === null ? null : 1200 * Math.log2(pitch.f0 / input.expectedF0);
  if (pitch.f0 === null || cents === null || pitch.clarity < params.clarityMin)
    return { status: 'UNCLEAR', clarity: pitch.clarity, ...(cents === null ? {} : { cents }) };
  if (Math.abs(cents) <= params.toleranceCents)
    return { status: 'OK', cents, f0: pitch.f0, clarity: pitch.clarity };
  const semitones = Math.round(cents / 100) || Math.sign(cents);
  return { status: 'WRONG_NOTE', cents, semitones, f0: pitch.f0, clarity: pitch.clarity };
}

/** Matching window of slot i (s): min(§10.8 BPM window, gapWindowFraction × the nearer neighbour gap). */
export function matchingWindowS(
  slots: readonly SequenceSlot[],
  i: number,
  bpm: number,
  params: SequenceParams = DEFAULT_SEQUENCE_PARAMS,
) {
  const gaps: number[] = [];
  if (i > 0) gaps.push(slots[i]!.time - slots[i - 1]!.time);
  if (i + 1 < slots.length) gaps.push(slots[i + 1]!.time - slots[i]!.time);
  const gap = gaps.length ? Math.min(...gaps) : Number.POSITIVE_INFINITY;
  return Math.min(timingWindowMs(bpm) / 1000, params.gapWindowFraction * gap);
}

function cvOf(times: readonly number[]): number | null {
  if (times.length < 3) return null;
  const iois = times.slice(1).map((t, i) => t - times[i]!);
  const mean = iois.reduce((s, x) => s + x, 0) / iois.length;
  const sd = Math.sqrt(iois.reduce((s, x) => s + (x - mean) ** 2, 0) / (iois.length - 1));
  return mean > 0 ? sd / mean : null;
}

/**
 * Cycle verdict (§10.10-4): flawless = every non-legato slot OK and no EXTRA; otherwise uncertain when a
 * non-legato slot is UNCLEAR; otherwise a mistake. Legato slots are beta-only and never decide.
 */
export function cycleVerdict(
  notes: readonly { status: NoteStatus; legato: boolean }[],
  extraCount: number,
): { flawless: boolean; uncertain: boolean } {
  const statuses = notes.filter((n) => !n.legato).map((n) => n.status);
  const flawless = statuses.every((st) => st === 'OK') && extraCount === 0;
  return { flawless, uncertain: !flawless && statuses.includes('UNCLEAR') };
}

/** Stops (§10.10-5): every run of ≥ 2 consecutive MISSED slots counts once. */
export function countStops(statuses: readonly NoteStatus[]): number {
  let stops = 0;
  let run = 0;
  for (const st of statuses) {
    run = st === 'MISSED' ? run + 1 : 0;
    if (run === 2) stops++;
  }
  return stops;
}

export function verifySequence(input: SequenceInput): SequenceResult {
  const t0 = performance.now();
  const params = input.params ?? DEFAULT_SEQUENCE_PARAMS;
  const fs = input.sampleRate;
  const slots = input.slots;
  const onsets =
    input.onsets ??
    detectSequenceOnsets(input.samples, fs, input.onsetParams ?? SEQUENCE_ONSET_PARAMS, input.backing);
  // 1. Matching (greedy by distance).
  const pairs: { slot: number; onset: number; dist: number }[] = [];
  slots.forEach((slot, i) => {
    const window = matchingWindowS(slots, i, input.bpm, params);
    onsets.forEach((o, j) => {
      const dist = Math.abs(o.sample / fs - slot.time);
      if (dist <= window) pairs.push({ slot: i, onset: j, dist });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);
  const slotOnset = new Array<number | null>(slots.length).fill(null);
  const usedOnset = new Set<number>();
  for (const p of pairs) {
    if (slotOnset[p.slot] !== null || usedOnset.has(p.onset)) continue;
    slotOnset[p.slot] = p.onset;
    usedOnset.add(p.onset);
  }
  const matchedSamples = slotOnset.flatMap((j) => (j === null ? [] : [onsets[j]!.sample]));
  const dup = (params.duplicateMs / 1000) * fs;
  const span = input.extraSpanS;
  const extras = onsets
    .filter((o, j) => !usedOnset.has(j) && !matchedSamples.some((m) => Math.abs(m - o.sample) <= dup))
    .map((o) => o.sample)
    .filter((e) => !span || (e / fs >= span[0] && e / fs <= span[1]));
  // 2–3. Pitch per slot, cancelling notes that still ring on other strings.
  const delta = (idx: number | undefined) => (idx === undefined ? 0 : (input.deltaCents?.[idx] ?? 0));
  const played: RingingNote[] = [...(input.priorNotes ?? [])];
  const notes: SequenceNoteResult[] = slots.map((slot, i) => {
    const expectedF0 = midiHz(slot.midi) * 2 ** (delta(slot.stringIdx) / 1200);
    const j = slotOnset[i] ?? null;
    const anchor = j === null ? Math.round(slot.time * fs) : onsets[j]!.sample;
    const nextSlotS = slots[i + 1]?.time;
    const endMs = Math.min(
      params.pitchEndMs,
      nextSlotS === undefined ? params.pitchEndMs : (nextSlotS - anchor / fs) * 1000 - params.nextSlotGuardMs,
    );
    if (j === null && !slot.legatoAllowed) return { slot: i, status: 'MISSED' };
    // Notes still sounding: the latest note on every other string within ringingMs.
    const latestByString = new Map<string, RingingNote>();
    for (const r of played) {
      if (anchor - r.startSample > (params.ringingMs / 1000) * fs || r.startSample >= anchor) continue;
      latestByString.set(r.stringIdx === undefined ? `f${r.f0.toFixed(1)}` : String(r.stringIdx), r);
    }
    const ringing = [...latestByString.values()]
      .filter((r) => slot.stringIdx === undefined || r.stringIdx !== slot.stringIdx)
      .sort((a, b) => a.startSample - b.startSample);
    const judged = judgeSequenceNote({
      samples: input.samples,
      sampleRate: fs,
      onsetSample: anchor,
      endMs,
      expectedF0,
      ringing,
      params,
    });
    const base = {
      slot: i,
      clarity: judged.clarity,
      ...(j === null ? {} : { onsetSample: anchor, onsetOffsetMs: (anchor / fs - slot.time) * 1000 }),
    };
    if (j === null) {
      // Legato slot without an onset (§10.10-3): the expected pitch present → HAMMER_OK (beta, never a failure).
      if (judged.status !== 'OK') return { slot: i, status: 'MISSED' };
      played.push({ f0: judged.f0!, stringIdx: slot.stringIdx, startSample: anchor });
      return { ...base, status: 'HAMMER_OK', cents: judged.cents!, f0: judged.f0! };
    }
    played.push({ f0: judged.f0 ?? expectedF0, stringIdx: slot.stringIdx, startSample: anchor });
    const { clarity: _clarity, ...rest } = judged;
    return { ...base, ...rest };
  });
  // 4. Cycles (extras belong to the cycle whose span — first slot − window … last slot + window — holds them).
  const cycleIds = [...new Set(slots.map((s) => s.cycle ?? 0))];
  const cycleOf = (s: SequenceSlot) => s.cycle ?? 0;
  const judgeCycle = (indices: number[], extraCount: number) =>
    cycleVerdict(
      indices.map((i) => ({ status: notes[i]!.status, legato: slots[i]!.legatoAllowed === true })),
      extraCount,
    );
  const extrasIn = (indices: number[]) => {
    const first = slots[indices[0]!]!;
    const last = slots[indices.at(-1)!]!;
    const lo = first.time - matchingWindowS(slots, indices[0]!, input.bpm, params);
    const hi = last.time + matchingWindowS(slots, indices.at(-1)!, input.bpm, params);
    return extras.filter((e) => e / fs >= lo && e / fs <= hi).length;
  };
  const cycles: SequenceCycleResult[] = cycleIds.map((cycle) => {
    const indices = slots.flatMap((s, i) => (cycleOf(s) === cycle ? [i] : []));
    const count = extrasIn(indices);
    return { cycle, ...judgeCycle(indices, count), extras: count };
  });
  // 5. Stops: runs of ≥ 2 consecutive MISSED slots.
  const stops = countStops(notes.map((n) => n.status));
  const whole = judgeCycle(
    slots.map((_, i) => i),
    extras.length,
  );
  return {
    notes,
    extras,
    cycles,
    flawless: whole.flawless,
    uncertain: whole.uncertain,
    stops,
    hitRate: slots.length ? slotOnset.filter((j) => j !== null).length / slots.length : 0,
    ioiCv: cvOf(matchedSamples.map((s) => s / fs).sort((a, b) => a - b)),
    detectorVersion: DETECTOR_VERSION,
    processingMs: Math.max(1e-3, performance.now() - t0),
  };
}
