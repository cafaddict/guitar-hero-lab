/**
 * Beta benchmark (SPEC v1.1 §10.11, §14.8): buzz, strum direction, legato (hammer-on), palm mute, bar
 * dynamics and Mode C under backing bleed. Report only — these values never decide the exit code
 * (thresholds.beta.reportOnly, integrity 10). Cases reuse the common matrix dimensions and the
 * `matrix.betaConditions` ranges; each detector gets ≥ minimumTestSizes.betaPerDetector samples.
 */
import { patternById, patternSlotTimes } from '../../src/content/patterns';
import { voicingById } from '../../src/content/voicings';
import { deriveSeed, gaussian, mulberry32, pick, uniform } from '../../src/domain/prng';
import { STANDARD_TUNING } from '../../src/domain/theory';
import type { ChordVoicing } from '../../src/domain/voicing';
import {
  type BackingSchedule,
  backingTemplateRises,
  bleedGain,
  DEFAULT_BACKING_MASK_PARAMS,
  lowBand,
} from '../../src/dsp/backingMask';
import { buzzResidual, buzzScore } from '../../src/dsp/beta/buzz';
import { strumDirection } from '../../src/dsp/beta/direction';
import { barDynamics, eventLevelsDb } from '../../src/dsp/beta/dynamics';
import { palmMuteFeatures, palmMuteProbability } from '../../src/dsp/beta/palmMute';
import { type BackingReference, ChangeCounter, classifyPair } from '../../src/dsp/modeC';
import { DEFAULT_ONSET_PARAMS, detectStrums } from '../../src/dsp/onset';
import { detectSequenceOnsets, type SequenceSlot, verifySequence } from '../../src/dsp/sequence';
import { rms } from '../../src/dsp/spectrum';
import { renderBacking } from '../../src/dsp/synth/backing';
import { applyBuzz, applyPalmMute } from '../../src/dsp/synth/effects';
import { renderNote } from '../../src/dsp/synth/note';
import { renderSequence, type SequenceNote } from '../../src/dsp/synth/sequence';
import { normalizeNote, renderStrum } from '../../src/dsp/synth/strum';
import {
  assignDims,
  type CommonParams,
  commonParams,
  dimsAt,
  type ModeCCase,
  playedF0,
  type Split,
} from './cases';
import type { Dims } from './evaluate';
import { matchPairs } from './evaluateV11';
import { f1, type MetricFn } from './metricsV11';
import { channel, dampAfter, mixStrumAt, noteSpec, renderModeC, strumStrings } from './render';
import { channelOver } from './renderV11';
import { balanced, stratified } from './sampling';
import type { Thresholds } from './thresholds';

export type BetaKind = 'buzz' | 'direction' | 'legato' | 'palmMute' | 'dynamics' | 'modeCBleed';

interface BetaBase extends CommonParams {
  mode: 'beta';
  kind: BetaKind;
}

export interface BuzzCase extends BetaBase {
  kind: 'buzz';
  voicingId: string;
  stringIdx: number;
  /** 0 = clean. */
  buzz: number;
}

export interface DirectionCase extends BetaBase {
  kind: 'direction';
  voicingId: string;
  direction: 'down' | 'up';
  spreadMs: number;
}

export interface LegatoCase extends BetaBase {
  kind: 'legato';
  /** Fretted string (6 … 1) and the finger pair's two frets. */
  string: number;
  frets: [number, number];
  bpm: number;
  /** false = control: the second note of each pair is not played at all. */
  hammer: boolean;
  rttMs: number;
}

export interface PalmMuteCase extends BetaBase {
  kind: 'palmMute';
  voicingId: string;
  /** null = open strum. */
  decayS: number | null;
  spreadMs: number;
}

export interface DynamicsCase extends BetaBase {
  kind: 'dynamics';
  voicingId: string;
  bpm: number;
  /** Per-bar gain (dB): 0, +Δ or −Δ. */
  barGainDb: number[];
}

export interface ModeCBleedCase extends BetaBase {
  kind: 'modeCBleed';
  sequence: ModeCCase;
  relDb: number;
  rttMs: number;
}

export type BetaCase = BuzzCase | DirectionCase | LegatoCase | PalmMuteCase | DynamicsCase | ModeCBleedCase;

const LEGATO_PAIRS = 4;
/** Bar gain signs (× Δ dB): alternating, paired and all-even runs. */
const DYNAMICS_SHAPES: readonly number[][] = [
  [1, -1, 1, -1],
  [-1, 1, -1, 1],
  [1, 1, -1, -1],
  [0, 0, 0, 0],
];
const DYNAMICS_BARS = 4;
const FINGER_PAIRS: [number, number][] = [
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
  [3, 4],
];

function playedIdx(v: ChordVoicing): number[] {
  return v.frets.flatMap((f, i) => (f === 'x' ? [] : [i]));
}

export function buildBeta(t: Thresholds, split: Split, modeC: readonly ModeCCase[]): BetaCase[] {
  const range = t.splitSeeds[split];
  const per = t.minimumTestSizes.betaPerDetector;
  const bc = t.matrix.betaConditions;
  const out: BetaCase[] = [];
  const common = (label: string, n: number, snrs: readonly number[] = t.matrix.snrDb) => {
    const rng = mulberry32(deriveSeed(range[0], `beta:${label}`));
    const dims = assignDims(t, n, rng, snrs);
    return { rng, at: (i: number) => commonParams(t, range, `beta-${label}`, i, dimsAt(dims, i)) };
  };
  // Buzz: `per` buzzing plucks (strength stratified over betaConditions.buzzStrength) + `per` clean plucks.
  {
    const n = 2 * per;
    const { rng, at } = common('buzz', n);
    const strengths = stratified(bc.buzzStrength, per, rng);
    const voicings = balanced(t.matrix.voicings, n, rng);
    for (let i = 0; i < n; i++) {
      const c = at(i);
      const v = voicingById(voicings[i]!);
      out.push({
        ...c,
        mode: 'beta',
        kind: 'buzz',
        voicingId: v.id,
        stringIdx: pick(mulberry32(c.seed), playedIdx(v)),
        buzz: i < per ? strengths[i]! : 0,
      });
    }
  }
  // Direction: balanced down/up, spread stratified over the strum-spread range.
  {
    const { rng, at } = common('direction', per);
    const dirs = balanced(bc.directions, per, rng);
    const spreads = stratified(t.matrix.strumSpreadMs, per, rng);
    const voicings = balanced(t.matrix.voicings, per, rng);
    for (let i = 0; i < per; i++)
      out.push({
        ...at(i),
        mode: 'beta',
        kind: 'direction',
        voicingId: voicings[i]!,
        direction: dirs[i]!,
        spreadMs: spreads[i]!,
      });
  }
  // Legato (E11 Finger Gym shape): picked note + hammer-on, LEGATO_PAIRS per case; controls drop the hammer.
  {
    const n = 2 * Math.ceil(per / LEGATO_PAIRS);
    const { rng, at } = common('legato', n);
    const strings = balanced([6, 5, 4, 3, 2, 1], n, rng);
    const pairs = balanced(FINGER_PAIRS, n, rng);
    const bpms = stratified([60, 80], n, rng);
    const rtts = stratified(t.matrix.sequence.rttMs, n, rng);
    for (let i = 0; i < n; i++) {
      const [a, b] = pairs[i]!;
      out.push({
        ...at(i),
        mode: 'beta',
        kind: 'legato',
        string: strings[i]!,
        frets: [4 + a, 4 + b],
        bpm: bpms[i]!,
        hammer: i % 2 === 0,
        rttMs: rtts[i]!,
      });
    }
  }
  // Palm mute: `per` muted (decay stratified over palmMuteDecayS) + `per` open strums.
  {
    const n = 2 * per;
    const { rng, at } = common('palmMute', n);
    const decays = stratified(bc.palmMuteDecayS, per, rng);
    const voicings = balanced(t.matrix.voicings, n, rng);
    const spreads = stratified(t.matrix.strumSpreadMs, n, rng);
    for (let i = 0; i < n; i++)
      out.push({
        ...at(i),
        mode: 'beta',
        kind: 'palmMute',
        voicingId: voicings[i]!,
        decayS: i < per ? decays[i]! : null,
        spreadMs: spreads[i]!,
      });
  }
  // Dynamics: 4 bars of P0, each bar 0 / +Δ / −Δ dB (Δ stratified over dynamicsDeltaDb).
  {
    const n = Math.ceil(per / DYNAMICS_BARS);
    const { rng, at } = common('dynamics', n);
    const deltas = stratified(bc.dynamicsDeltaDb, n, rng);
    const bpms = stratified(t.matrix.modeD.bpm, n, rng);
    const voicings = balanced(t.matrix.voicings, n, rng);
    // The E5 dynamics mode alternates instructed loud/soft bars; an all-even run is the control.
    const shapes = balanced(DYNAMICS_SHAPES, n, rng);
    for (let i = 0; i < n; i++)
      out.push({
        ...at(i),
        mode: 'beta',
        kind: 'dynamics',
        voicingId: voicings[i]!,
        bpm: bpms[i]!,
        barGainDb: shapes[i]!.map((sign) => sign * deltas[i]!),
      });
  }
  // Mode C under speaker bleed: the v1 Mode C sequences with the backing (current chord) leaking in.
  {
    const { rng } = common('modeCBleed', modeC.length);
    const rel = stratified(t.matrix.backingBleed.relDb, modeC.length, rng);
    const rtts = stratified(t.matrix.modeD.rttMs, modeC.length, rng);
    modeC.forEach((sequence, i) => {
      out.push({
        ...sequence,
        id: `beta-modeCBleed-${i}`,
        mode: 'beta',
        kind: 'modeCBleed',
        sequence,
        relDb: rel[i]!,
        rttMs: rtts[i]!,
      });
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- evaluate

export interface OutcomeBeta {
  mode: 'beta';
  kind: BetaKind;
  id: string;
  dims: Dims;
  /** Ground truth label and the detector's answer (per item; dynamics and legato have several items). */
  items: { truth: string; predicted: string }[];
  /** Mode C under bleed: counted vs. true changes. */
  counted?: number;
  truth?: number;
}

function dimsOf(c: CommonParams, voicing: string, condition: string): Dims {
  return {
    sampleRate: c.sampleRate,
    model: c.model,
    snrDb: c.snrDb,
    micHighpassHz: c.micHighpassHz,
    reverb: c.reverb,
    voicing,
    condition,
  };
}

function pluck(c: BuzzCase, t: Thresholds, seedLabel: string, buzz: number) {
  const v = voicingById(c.voicingId);
  const f0 = playedF0(c, c.stringIdx, v.frets[c.stringIdx] as number);
  const onset = Math.round(c.sampleRate);
  const note = renderNote(noteSpec(c, t, f0, 0.9, deriveSeed(c.seed, seedLabel), false));
  normalizeNote(note, c.sampleRate);
  applyBuzz(note, c.sampleRate, buzz, deriveSeed(c.seed, `${seedLabel}:buzz`));
  const dry = new Float32Array(onset + note.length + Math.round(0.2 * c.sampleRate));
  dry.set(note, onset);
  return { signal: channel(c, t, dry, onset).signal, onset };
}

function evaluateBuzz(c: BuzzCase, t: Thresholds): OutcomeBeta {
  const v = voicingById(c.voicingId);
  const fret = v.frets[c.stringIdx] as number;
  const f0 =
    440 *
    2 ** ((STANDARD_TUNING.openMidi[c.stringIdx]! + fret - 69) / 12) *
    2 ** (c.deltaGivenCents[c.stringIdx]! / 1200);
  // Calibration template: the player's clean pluck of the same note (another take).
  const cal = pluck(c, t, 'calibration', 0);
  const template = buzzResidual({
    samples: cal.signal,
    sampleRate: c.sampleRate,
    onsetSample: cal.onset,
    f0,
  });
  const r = pluck(c, t, 'note', c.buzz);
  const res = buzzScore({ samples: r.signal, sampleRate: c.sampleRate, onsetSample: r.onset, f0, template });
  return {
    mode: 'beta',
    kind: 'buzz',
    id: c.id,
    dims: dimsOf(c, c.voicingId, c.buzz > 0 ? 'buzz' : 'clean'),
    items: [{ truth: c.buzz > 0 ? 'buzz' : 'clean', predicted: res.suspected ? 'buzz' : 'clean' }],
  };
}

function strumOnce(
  c: CommonParams,
  t: Thresholds,
  v: ChordVoicing,
  direction: 'down' | 'up',
  spreadMs: number,
  label: string,
  decayS: number | null,
) {
  const fs = c.sampleRate;
  const strings = strumStrings(c, t, v, 1.0, label, {});
  const strum = renderStrum({ strings, direction, spreadMs, sampleRate: fs });
  const signal = decayS === null ? strum.signal : applyPalmMute(strum.signal, fs, decayS);
  const onset = Math.round(fs);
  const dry = new Float32Array(onset + signal.length + Math.round(0.1 * fs));
  dry.set(signal, onset);
  return { signal: channel(c, t, dry, onset).signal, onset };
}

function evaluateDirection(c: DirectionCase, t: Thresholds): OutcomeBeta {
  const r = strumOnce(c, t, voicingById(c.voicingId), c.direction, c.spreadMs, 'dir', null);
  const ev = detectStrums(r.signal, c.sampleRate)[0];
  const res = strumDirection({
    samples: r.signal,
    sampleRate: c.sampleRate,
    onsetSample: ev?.sample ?? r.onset,
    voicing: voicingById(c.voicingId),
    tuning: STANDARD_TUNING,
    deltaCents: c.deltaGivenCents,
  });
  return {
    mode: 'beta',
    kind: 'direction',
    id: c.id,
    dims: dimsOf(c, c.voicingId, `${c.direction}:${Math.round(c.spreadMs / 10) * 10}ms`),
    items: [{ truth: c.direction, predicted: res.value }],
  };
}

function evaluatePalmMute(c: PalmMuteCase, t: Thresholds): OutcomeBeta {
  const v = voicingById(c.voicingId);
  const fs = c.sampleRate;
  // Reference: the player's open strum of the same chord (another take).
  const ref = strumOnce(c, t, v, 'down', c.spreadMs, 'ref', null);
  const reference = palmMuteFeatures({ samples: ref.signal, sampleRate: fs, onsetSample: ref.onset });
  const r = strumOnce(c, t, v, 'down', c.spreadMs, 'pm', c.decayS);
  const ev = detectStrums(r.signal, fs)[0];
  const res = palmMuteProbability({
    samples: r.signal,
    sampleRate: fs,
    onsetSample: ev?.sample ?? r.onset,
    reference,
  });
  return {
    mode: 'beta',
    kind: 'palmMute',
    id: c.id,
    dims: dimsOf(c, c.voicingId, c.decayS === null ? 'open' : 'muted'),
    items: [{ truth: c.decayS === null ? 'open' : 'muted', predicted: res.muted ? 'muted' : 'open' }],
  };
}

function evaluateDynamics(c: DynamicsCase, t: Thresholds): OutcomeBeta {
  const fs = c.sampleRate;
  const v = voicingById(c.voicingId);
  const p0 = patternById('P0');
  const gridStart = 1.0;
  const slots = patternSlotTimes(p0, gridStart, c.bpm, DYNAMICS_BARS).filter((s) => s.expected);
  const rng = mulberry32(deriveSeed(c.seed, 'human'));
  const perBar = slots.length / DYNAMICS_BARS;
  const dry = new Float32Array(Math.round((slots.at(-1)!.time + 2) * fs));
  const truthSamples: number[] = [];
  slots.forEach((s, k) => {
    const strum = renderStrum({
      strings: strumStrings(c, t, v, 1.5, `dyn${k}`, {}),
      direction: 'down',
      spreadMs: uniform(rng, 5, 25),
      sampleRate: fs,
    });
    const g = 10 ** (c.barGainDb[Math.floor(k / perBar)]! / 20);
    for (let i = 0; i < strum.signal.length; i++) strum.signal[i] = strum.signal[i]! * g;
    const at = Math.round((s.time + (gaussian(rng) * 12) / 1000) * fs);
    if (k > 0) dampAfter(dry, Math.max(0, at - Math.round(0.01 * fs)), Math.round(0.01 * fs));
    mixStrumAt(dry, strum.signal, at);
    truthSamples.push(at);
  });
  const signal = channel(c, t, dry, truthSamples[0]!).signal;
  // The exercise knows its slots: each expected strum is measured at the detected onset nearest to it
  // (±60 ms), or at the slot itself when a soft strum slipped under the onset detector.
  const detected = detectStrums(signal, fs).map((e) => e.sample);
  const events = slots.map((slot) => {
    const at = Math.round(slot.time * fs);
    const near = detected
      .filter((d) => Math.abs(d - at) <= 0.06 * fs)
      .sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
    return near[0] ?? at;
  });
  const barOf = events.map((_, k) => Math.floor(k / perBar));
  const labels = barDynamics(eventLevelsDb(signal, fs, events), barOf, DYNAMICS_BARS);
  return {
    mode: 'beta',
    kind: 'dynamics',
    id: c.id,
    dims: dimsOf(c, c.voicingId, 'bars'),
    items: c.barGainDb.map((g, b) => ({
      truth: g > 0 ? 'loud' : g < 0 ? 'soft' : 'even',
      predicted: labels[b]!.value,
    })),
  };
}

function evaluateLegato(c: LegatoCase, t: Thresholds): OutcomeBeta {
  const fs = c.sampleRate;
  const idx = 6 - c.string;
  const ioi = 30 / c.bpm; // two eighths per beat: picked, then hammer
  const gridStart = 1.0;
  const rng = mulberry32(deriveSeed(c.seed, 'human'));
  const slots: SequenceSlot[] = [];
  const notes: SequenceNote[] = [];
  for (let k = 0; k < LEGATO_PAIRS; k++) {
    for (const [j, fret] of c.frets.entries()) {
      const grid = gridStart + (2 * k + j) * ioi;
      const midi = STANDARD_TUNING.openMidi[idx]! + fret;
      slots.push({ time: grid + c.rttMs / 1000, midi, stringIdx: idx, legatoAllowed: j === 1, cycle: k });
      if (j === 1 && !c.hammer) continue;
      notes.push({
        time: grid + c.rttMs / 1000 + (gaussian(rng) * 12) / 1000,
        string: c.string,
        note: noteSpec(c, t, playedF0(c, idx, fret), 2.0, deriveSeed(c.seed, `leg${k}:${j}`), false),
        gainDb: c.stringGainDb[idx]!,
        legato: j === 1,
      });
    }
  }
  const total = Math.round((gridStart + 2 * LEGATO_PAIRS * ioi + c.rttMs / 1000 + 1.5) * fs);
  const { signal: dry, onsets } = renderSequence(notes, fs, total);
  const signal = channelOver(
    c,
    t,
    dry,
    onsets.map((s) => ({ start: s, end: s + Math.round(Math.min(0.5, ioi) * fs) })),
  ).signal;
  const res = verifySequence({
    samples: signal,
    sampleRate: fs,
    slots,
    bpm: c.bpm,
    onsets: detectSequenceOnsets(signal, fs),
    deltaCents: c.deltaGivenCents,
  });
  const items = res.notes
    .filter((n) => slots[n.slot]!.legatoAllowed)
    .map((n) => ({
      truth: c.hammer ? 'hammer' : 'none',
      predicted: n.status === 'HAMMER_OK' || n.status === 'OK' ? 'hammer' : 'none',
    }));
  return {
    mode: 'beta',
    kind: 'legato',
    id: c.id,
    dims: dimsOf(c, `string${c.string}`, c.hammer ? 'hammer' : 'control'),
    items,
  };
}

/**
 * What the app knows about the leaked backing: the buffer it rendered, where it arrives (RTT) and the bleed
 * gain the backing mask measures from the recording (√ of its low-band power gain; no intro here, so the
 * median over all events, as in detectStrums).
 */
export function backingReference(
  signal: Float32Array,
  sampleRate: number,
  backing: Float32Array,
  offset: number,
  schedule: BackingSchedule,
): BackingReference {
  const p = DEFAULT_BACKING_MASK_PARAMS;
  const power = bleedGain(lowBand(signal, sampleRate, p), sampleRate, schedule, p);
  return { samples: backing, offset, gain: Math.sqrt(power) };
}

function evaluateModeCBleed(c: ModeCBleedCase, t: Thresholds): OutcomeBeta {
  const s = c.sequence;
  const fs = s.sampleRate;
  const base = renderModeC(s, t);
  // Backing: P3 at 80 BPM with the chord the player currently holds, leaking in at relDb, RTT-delayed.
  const bpm = 80;
  const barS = (4 * 60) / bpm;
  const bars = Math.ceil(s.durationS / barS);
  const chordAt = (time: number) => {
    let chord: 0 | 1 = 0;
    for (const e of s.events) if (e.time <= time && e.chord !== 'open') chord = e.chord;
    return voicingById(s.pair[chord]);
  };
  // The backing follows the chart the player follows: every backing event uses the chord held at that moment.
  const backing = renderBacking({
    chords: [voicingById(s.pair[0])],
    chordAt: (time) => chordAt(time),
    pattern: patternById('P3'),
    bpm,
    bars,
    sampleRate: fs,
    model: s.model,
    seed: deriveSeed(s.seed, 'backing'),
  });
  const userRms = rms(base.signal, base.onsetSample, base.onsetSample + Math.round(0.5 * fs));
  const backingRms = rms(backing.signal, 0, Math.round(0.5 * fs));
  const gain = (userRms * 10 ** (c.relDb / 20)) / (backingRms + 1e-12);
  const offset = Math.round((c.rttMs / 1000) * fs);
  const signal = base.signal.slice();
  for (let i = 0; i < backing.signal.length && offset + i < signal.length; i++)
    signal[offset + i] = signal[offset + i]! + backing.signal[i]! * gain;
  const eventSamples = backing.events.map((e) => Math.round(e.time * fs));
  const schedule: BackingSchedule = {
    arrivals: eventSamples.map((e) => offset + e),
    templateRises: backingTemplateRises(backing.signal, eventSamples, fs),
    introCount: 0,
  };
  const events = detectStrums(signal, fs, DEFAULT_ONSET_PARAMS, { backing: schedule });
  const reference = backingReference(signal, fs, backing.signal, offset, schedule);
  const counter = new ChangeCounter();
  const pair = [voicingById(s.pair[0]), voicingById(s.pair[1])] as const;
  for (const e of events) {
    const cls = classifyPair(
      {
        samples: signal,
        sampleRate: fs,
        onsetSample: e.sample,
        tuning: STANDARD_TUNING,
        deltaCents: s.deltaGivenCents,
        backing: reference,
      },
      pair,
    );
    counter.push(cls, (e.sample / fs) * 1000);
  }
  return {
    mode: 'beta',
    kind: 'modeCBleed',
    id: c.id,
    dims: dimsOf(s, s.pair.join('|'), `rel${Math.round(c.relDb / 5) * 5}`),
    items: [],
    counted: counter.count,
    truth: s.truthChanges,
  };
}

export function evaluateBeta(c: BetaCase, t: Thresholds): OutcomeBeta {
  switch (c.kind) {
    case 'buzz':
      return evaluateBuzz(c, t);
    case 'direction':
      return evaluateDirection(c, t);
    case 'legato':
      return evaluateLegato(c, t);
    case 'palmMute':
      return evaluatePalmMute(c, t);
    case 'dynamics':
      return evaluateDynamics(c, t);
    case 'modeCBleed':
      return evaluateModeCBleed(c, t);
  }
}

// ---------------------------------------------------------------------------------------------- metrics

const ratio = (num: number, den: number) => (den > 0 ? num / den : Number.NaN);

function items(xs: OutcomeBeta[], kind: BetaKind) {
  return xs.filter((o) => o.kind === kind).flatMap((o) => o.items);
}

/** Report-only metrics, keyed like thresholds.beta.targets. */
export const BETA_METRICS: Record<string, MetricFn<OutcomeBeta>> = {
  buzzDetectRateMin: (xs) => {
    const s = items(xs, 'buzz').filter((i) => i.truth === 'buzz');
    return { value: ratio(s.filter((i) => i.predicted === 'buzz').length, s.length), n: s.length };
  },
  buzzFalseAlarmRateMax: (xs) => {
    const s = items(xs, 'buzz').filter((i) => i.truth === 'clean');
    return { value: ratio(s.filter((i) => i.predicted === 'buzz').length, s.length), n: s.length };
  },
  directionAccuracyMin: (xs) => {
    const s = items(xs, 'direction');
    return { value: ratio(s.filter((i) => i.predicted === i.truth).length, s.length), n: s.length };
  },
  legatoOnsetRecallMin: (xs) => {
    const s = items(xs, 'legato').filter((i) => i.truth === 'hammer');
    return { value: ratio(s.filter((i) => i.predicted === 'hammer').length, s.length), n: s.length };
  },
  legatoFalseOnsetRateMax: (xs) => {
    const s = items(xs, 'legato').filter((i) => i.truth === 'none');
    return { value: ratio(s.filter((i) => i.predicted === 'hammer').length, s.length), n: s.length };
  },
  palmMuteAccuracyMin: (xs) => {
    const s = items(xs, 'palmMute');
    return { value: ratio(s.filter((i) => i.predicted === i.truth).length, s.length), n: s.length };
  },
  dynamicsAccuracyMin: (xs) => {
    const s = items(xs, 'dynamics');
    return { value: ratio(s.filter((i) => i.predicted === i.truth).length, s.length), n: s.length };
  },
  modeCUnderBleedAbsErrLe1RateMin: (xs) => {
    const s = xs.filter((o) => o.kind === 'modeCBleed');
    return {
      value: ratio(s.filter((o) => Math.abs((o.counted ?? 0) - (o.truth ?? 0)) <= 1).length, s.length),
      n: s.length,
    };
  },
};

export { f1, matchPairs };
