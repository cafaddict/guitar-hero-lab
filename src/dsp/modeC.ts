/**
 * Mode C — closed-set chord classification (SPEC §10.7) and the one-minute-change counter.
 *
 * Scores come from log-salience over expected partials. classifyPair compares the partials unique to each
 * candidate (shared partials cancel); an optional distractor (all open strings — players often strum open
 * strings mid-change) must also lose, otherwise the event is held. The counter only counts a confident
 * change of class and enforces a 300 ms minimum interval, biased toward under-counting.
 */
import type { Tuning } from '../domain/theory';
import { type ChordVoicing, expectedNotes } from '../domain/voicing';
import {
  magnitudeSpectrum,
  medianSpectrum,
  msToSamples,
  nearestLocalPeak,
  partialPeak,
  type Spectrum,
} from './spectrum';
import { DETECTOR_VERSION } from './version';

export interface ModeCParams {
  windowStartMs: number;
  windowMs: number;
  noiseSpanMs: number;
  maxPartial: number;
  maxHz: number;
  tolCents: number;
  inharmonicityB: number;
  /** SNR (dB) clipping range for each partial's evidence. */
  snrFloorDb: number;
  snrCeilDb: number;
  /** Partials closer than this (cents) are treated as shared between candidates. */
  sharedCents: number;
  /** Minimum |margin| (dB) to accept a pair decision. */
  pairMarginDb: number;
  /** Also floor evidence by the pre-onset spectrum (only meaningful for isolated strums). */
  useNoiseFloor: boolean;
  aggregate: 'mean' | 'weighted' | 'upperHalf';
  /** Evidence only from a true local peak within ±tolCents (not a neighbour's skirt). */
  strictPeak: boolean;
  /** Winner must beat the open-strings distractor by this margin (dB); a negative value holds only when the
   * open strings beat the winner by more than |margin| (voicings sharing most notes with the open strings,
   * e.g. G5, cannot beat them by a positive margin when their bass is weak — v1.1 D-066). */
  distractorMarginDb: number;
  minChangeIntervalMs: number;
  /** Backing subtraction: the template magnitude × gain × this factor is removed from each bin. */
  backingOverSubtract: number;
  /** Backing subtraction never leaves less than this fraction of a bin's magnitude. */
  backingFloor: number;
}

export const DEFAULT_MODE_C_PARAMS: ModeCParams = {
  windowStartMs: 40,
  windowMs: (8192 / 48000) * 1000,
  noiseSpanMs: 480,
  maxPartial: 8,
  maxHz: 5000,
  tolCents: 30,
  inharmonicityB: 5e-5,
  snrFloorDb: 0,
  snrCeilDb: 30,
  sharedCents: 35,
  pairMarginDb: 2,
  useNoiseFloor: false,
  aggregate: 'weighted',
  strictPeak: false,
  distractorMarginDb: -2,
  minChangeIntervalMs: 300,
  backingOverSubtract: 1,
  backingFloor: 0.05,
};

export const OPEN_STRINGS_VOICING: ChordVoicing = {
  id: '__open',
  symbol: 'open',
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [0, 0, 0, 0, 0, 0],
  baseFret: 1,
  stage: 0,
  tags: [],
};

interface Analysis {
  spec: Spectrum;
  noise: Float64Array;
  /** Analysis-bin width (Hz) of the unpadded window. */
  binHz: number;
  /** Cache of local envelope values per FFT bin (NaN = not computed). */
  envelope: Float64Array;
}

/**
 * Speaker backing the app synthesized and played (SPEC v1.1 §10.12): the buffer as rendered, where its first
 * sample arrives in `samples` (scheduled time + RTT), and the bleed amplitude gain (recording / buffer).
 */
export interface BackingReference {
  samples: ArrayLike<number>;
  /** Index in the analysed `samples` at which backing sample 0 arrives. */
  offset: number;
  /** Amplitude gain of the leaked backing (√ of the backing mask's power gain). */
  gain: number;
}

/**
 * Magnitude spectral subtraction of the leaked backing: the backing buffer is analysed over the same window
 * (shifted by its arrival offset) and gain × backingOverSubtract × its magnitude is removed per bin, keeping at
 * least backingFloor of the original. Partials of a backing chord the player is no longer holding then stop
 * counting as evidence for that chord.
 */
function subtractBacking(
  spec: Spectrum,
  backing: BackingReference,
  start: number,
  len: number,
  sampleRate: number,
  params: ModeCParams,
): void {
  if (!(backing.gain > 0)) return;
  const b = magnitudeSpectrum(backing.samples, start - backing.offset, len, sampleRate, 2);
  const k = backing.gain * params.backingOverSubtract;
  for (let i = 0; i < spec.mag.length; i++) {
    const m = spec.mag[i]!;
    spec.mag[i] = Math.max(params.backingFloor * m, m - k * b.mag[i]!);
  }
}

function analyze(
  samples: ArrayLike<number>,
  sampleRate: number,
  onsetSample: number,
  params: ModeCParams,
  backing?: BackingReference,
): Analysis {
  const len = msToSamples(params.windowMs, sampleRate);
  const start = onsetSample + msToSamples(params.windowStartMs, sampleRate);
  const spec = magnitudeSpectrum(samples, start, len, sampleRate, 2);
  if (backing) subtractBacking(spec, backing, start, len, sampleRate, params);
  const noiseEnd = onsetSample - msToSamples(20, sampleRate);
  const noiseStart = noiseEnd - msToSamples(params.noiseSpanMs, sampleRate);
  const spectra: Float64Array[] = [];
  const hop = Math.max(1, Math.round(len / 4));
  for (let s = noiseStart; s + len <= noiseEnd; s += hop)
    spectra.push(magnitudeSpectrum(samples, s, len, sampleRate, 2).mag.slice());
  if (spectra.length === 0)
    spectra.push(magnitudeSpectrum(samples, noiseStart, len, sampleRate, 2).mag.slice());
  const envelope = new Float64Array(spec.mag.length).fill(Number.NaN);
  return { spec, noise: medianSpectrum(spectra), binHz: sampleRate / len, envelope };
}

/**
 * Local spectral envelope at a bin: 30th-percentile magnitude within ±1/3 octave, excluding ±2 analysis bins
 * around the bin itself. Peaks stand out from it by their "peakiness"; in a continuous strum sequence this
 * replaces a pre-onset noise estimate (which would contain the previous chord).
 */
function localEnvelope(a: Analysis, bin: number): number {
  const cached = a.envelope[bin]!;
  if (!Number.isNaN(cached)) return cached;
  const third = 2 ** (1 / 3);
  const lo = Math.max(1, Math.floor(bin / third));
  const hi = Math.min(a.spec.mag.length - 1, Math.ceil(bin * third));
  const guard = Math.ceil((2 * a.binHz) / a.spec.binHz);
  const values: number[] = [];
  for (let k = lo; k <= hi; k++) if (Math.abs(k - bin) > guard) values.push(a.spec.mag[k]!);
  values.sort((x, y) => x - y);
  const v = values.length ? values[Math.floor(values.length * 0.3)]! : 0;
  a.envelope[bin] = v;
  return v;
}

interface Partial {
  f: number;
  h: number;
}

function partialFrequencies(
  voicing: ChordVoicing,
  tuning: Tuning,
  params: ModeCParams,
  deltaCents?: readonly number[],
): Partial[] {
  const out: Partial[] = [];
  for (const n of expectedNotes(voicing, tuning, 0, deltaCents)) {
    for (let h = 1; h <= params.maxPartial; h++) {
      const f = h * n.f0 * Math.sqrt(1 + params.inharmonicityB * h * h);
      if (f > params.maxHz) break;
      out.push({ f, h });
    }
  }
  return out;
}

/** Peakiness (dB) of a partial: its peak over max(local envelope, stationary noise), clipped. */
function evidence(a: Analysis, f: number, params: ModeCParams): number {
  const peak = params.strictPeak ? nearestLocalPeak(a.spec, f, 3) : partialPeak(a.spec, f, params.tolCents);
  if (params.strictPeak && Math.abs(1200 * Math.log2(peak.hz / f)) > params.tolCents)
    return params.snrFloorDb;
  const floor = Math.max(localEnvelope(a, peak.bin), params.useNoiseFloor ? (a.noise[peak.bin] ?? 0) : 0);
  const snr = 20 * Math.log10((peak.mag + 1e-12) / (floor + 1e-12));
  return Math.max(params.snrFloorDb, Math.min(params.snrCeilDb, snr));
}

function uniqueTo(own: readonly Partial[], other: readonly Partial[], cents: number): Partial[] {
  const ratio = 2 ** (cents / 1200);
  return own.filter((p) => !other.some((q) => p.f / q.f < ratio && q.f / p.f < ratio));
}

/** Aggregated evidence over partials: plain mean, h^-0.5-weighted mean, or mean of the upper half. */
function meanEvidence(a: Analysis, partials: readonly Partial[], params: ModeCParams): number | null {
  if (partials.length === 0) return null;
  const values = partials.map((p) => evidence(a, p.f, params));
  if (params.aggregate === 'upperHalf') {
    values.sort((x, y) => y - x);
    const k = Math.max(1, Math.ceil(values.length / 2));
    return values.slice(0, k).reduce((s, v) => s + v, 0) / k;
  }
  if (params.aggregate === 'weighted') {
    let s = 0;
    let w = 0;
    partials.forEach((p, i) => {
      const weight = p.h ** -0.5;
      s += weight * values[i]!;
      w += weight;
    });
    return s / w;
  }
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Margin (dB) of `x` over `y`: mean evidence on partials unique to x minus on partials unique to y. */
function pairMargin(a: Analysis, x: readonly Partial[], y: readonly Partial[], params: ModeCParams): number {
  const ux = uniqueTo(x, y, params.sharedCents);
  const uy = uniqueTo(y, x, params.sharedCents);
  const ex = meanEvidence(a, ux, params);
  const ey = meanEvidence(a, uy, params);
  if (ex === null || ey === null)
    return (meanEvidence(a, x, params) ?? 0) - (meanEvidence(a, y, params) ?? 0);
  return ex - ey;
}

export interface PairClassification {
  /** 0 or 1 = candidate index; null = hold (not counted). */
  winner: 0 | 1 | null;
  /** Normalized margin (dB), positive favours candidate 0. */
  margin: number;
  distractorWins: boolean;
  detectorVersion: string;
  processingMs: number;
}

export interface ClassifyInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  tuning: Tuning;
  deltaCents?: readonly number[] | undefined;
  params?: ModeCParams;
  /** Leaked speaker backing to subtract before scoring (omit = no backing, unchanged behaviour). */
  backing?: BackingReference | undefined;
}

export function classifyPair(
  input: ClassifyInput,
  candidates: readonly [ChordVoicing, ChordVoicing],
  useDistractor = true,
): PairClassification {
  const t0 = performance.now();
  const params = input.params ?? DEFAULT_MODE_C_PARAMS;
  const a = analyze(input.samples, input.sampleRate, input.onsetSample, params, input.backing);
  const pa = partialFrequencies(candidates[0], input.tuning, params, input.deltaCents);
  const pb = partialFrequencies(candidates[1], input.tuning, params, input.deltaCents);
  const margin = pairMargin(a, pa, pb, params);
  let winner: 0 | 1 | null = Math.abs(margin) >= params.pairMarginDb ? (margin > 0 ? 0 : 1) : null;
  let distractorWins = false;
  if (winner !== null && useDistractor) {
    const po = partialFrequencies(OPEN_STRINGS_VOICING, input.tuning, params, input.deltaCents);
    const chosen = winner === 0 ? pa : pb;
    if (pairMargin(a, chosen, po, params) < params.distractorMarginDb) {
      distractorWins = true;
      winner = null;
    }
  }
  return {
    winner,
    margin,
    distractorWins,
    detectorVersion: DETECTOR_VERSION,
    processingMs: Math.max(1e-3, performance.now() - t0),
  };
}

export interface SetClassification {
  /** Index of the top candidate. */
  top: number;
  /** Score difference (dB) between the top and the runner-up class. */
  margin: number;
  scores: number[];
  detectorVersion: string;
  processingMs: number;
}

/**
 * Closed-set classification (Q2 recall quiz). Each candidate is scored by pairwise unique-partial margins
 * against every other candidate (a round-robin); the candidate with the best worst-case margin wins.
 * `classOf` maps candidates to classes (e.g. both G voicings → 'G') so same-class pairs are skipped.
 */
export function classifySet(
  input: ClassifyInput,
  candidates: readonly ChordVoicing[],
  classOf: (v: ChordVoicing) => string = (v) => v.id,
): SetClassification {
  const t0 = performance.now();
  const params = input.params ?? DEFAULT_MODE_C_PARAMS;
  const a = analyze(input.samples, input.sampleRate, input.onsetSample, params, input.backing);
  const partials = candidates.map((c) => partialFrequencies(c, input.tuning, params, input.deltaCents));
  const scores = candidates.map((c, i) => {
    let worst = Number.POSITIVE_INFINITY;
    candidates.forEach((d, j) => {
      if (i === j || classOf(c) === classOf(d)) return;
      worst = Math.min(worst, pairMargin(a, partials[i]!, partials[j]!, params));
    });
    return Number.isFinite(worst) ? worst : 0;
  });
  let top = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[top]!) top = i;
  const topClass = classOf(candidates[top]!);
  let second = Number.NEGATIVE_INFINITY;
  scores.forEach((s, i) => {
    if (classOf(candidates[i]!) !== topClass) second = Math.max(second, s);
  });
  return {
    top,
    margin: scores[top]! - (Number.isFinite(second) ? second : 0),
    scores,
    detectorVersion: DETECTOR_VERSION,
    processingMs: Math.max(1e-3, performance.now() - t0),
  };
}

/**
 * One-minute-change counter (SPEC §10.7): starts in the first chord; +1 only when a confident
 * classification of the *other* chord arrives at least minChangeIntervalMs after the previous change.
 * Same-chord strums, holds and open-string strums are ignored.
 */
export class ChangeCounter {
  private state: 0 | 1 = 0;
  private lastChangeMs = Number.NEGATIVE_INFINITY;
  count = 0;
  held = 0;
  readonly changeTimesMs: number[] = [];

  constructor(private readonly minChangeIntervalMs = DEFAULT_MODE_C_PARAMS.minChangeIntervalMs) {}

  /** Feeds one classified strum event; returns true when it counted a change. */
  push(classification: Pick<PairClassification, 'winner'>, timeMs: number): boolean {
    if (classification.winner === null) {
      this.held++;
      return false;
    }
    if (classification.winner === this.state) return false;
    if (timeMs - this.lastChangeMs < this.minChangeIntervalMs) return false;
    this.state = classification.winner;
    this.lastChangeMs = timeMs;
    this.count++;
    this.changeTimesMs.push(timeMs);
    return true;
  }

  get currentChord(): 0 | 1 {
    return this.state;
  }
}
