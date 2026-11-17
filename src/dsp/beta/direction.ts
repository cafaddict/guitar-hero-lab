/**
 * Strum direction (SPEC v1.1 §10.11, beta). Primary method: per-string onset order inside the first ~100 ms,
 * from a per-string transcription (D-107). Every frame's magnitude spectrum is explained as a non-negative
 * mix of one fixed harmonic template per sounding string (partials h·f0·√(1+B·h²), amplitude 1/h, Hann
 * main lobes), solved by NNLS. Shared partials (octaves, fifths) are split between the strings by the rest
 * of each template, so a string's activation does not follow a louder neighbour's leakage. A string's onset
 * is where its activation first crosses half of its rise; the slope of onset time against string index
 * (6th string = 0), weighted by each string's rise, is positive for a down strum (low strings first) and
 * negative for an up strum; a flat slope is unknown.
 * Fallback without a voicing: the frequency centroid of the new energy rises (down) or falls (up) (02:464).
 */
import type { Tuning } from '../../domain/theory';
import { type ChordVoicing, expectedNotes } from '../../domain/voicing';
import { nextPow2, realFft } from '../fft';
import { msToSamples } from '../spectrum';
import { hann } from '../window';
import { type BetaResult, beta } from './types';

export interface DirectionParams {
  frameMs: number;
  hopMs: number;
  fromMs: number;
  toMs: number;
  /** Template band (Hz). */
  minHz: number;
  maxHz: number;
  /** Template partial amplitude h^-alpha. */
  alpha: number;
  /** Inharmonicity assumed for the templates. */
  inharmonicityB: number;
  maxHarmonic: number;
  nnlsIterations: number;
  /** Onset = first crossing of base + riseFraction·(peak − base) of the string's activation. */
  riseFraction: number;
  /** |slope| (ms per string) below this → unknown. */
  minSlopeMs: number;
  /** Slope at which confidence reaches 1. */
  fullSlopeMs: number;
  /** Centroid fallback: |slope| (octaves per 10 ms) below this → unknown. */
  minCentroidSlope: number;
}

export const DEFAULT_DIRECTION_PARAMS: DirectionParams = {
  frameMs: 40,
  hopMs: 1,
  fromMs: -15,
  toMs: 100,
  minHz: 60,
  maxHz: 4000,
  alpha: 1,
  inharmonicityB: 5e-5,
  maxHarmonic: 60,
  nnlsIterations: 40,
  riseFraction: 0.5,
  minSlopeMs: 0.2,
  fullSlopeMs: 4,
  minCentroidSlope: 0.02,
};

export type StrumDirection = 'down' | 'up' | 'unknown';

export interface DirectionInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  voicing?: ChordVoicing;
  tuning?: Tuning;
  deltaCents?: readonly number[];
  params?: DirectionParams;
}

interface Frames {
  times: number[];
  mags: Float64Array[];
  binHz: number;
}

function stft(input: DirectionInput, p: DirectionParams): Frames {
  const fs = input.sampleRate;
  const n = msToSamples(p.frameMs, fs);
  const size = nextPow2(n * 2);
  const w = hann(n);
  const hop = Math.max(1, msToSamples(p.hopMs, fs));
  const buf = new Float64Array(size);
  const re = new Float64Array(size / 2 + 1);
  const im = new Float64Array(size / 2 + 1);
  const out: Frames = { times: [], mags: [], binHz: fs / size };
  const first = input.onsetSample + msToSamples(p.fromMs, fs);
  const last = input.onsetSample + msToSamples(p.toMs, fs);
  for (let s = first; s <= last; s += hop) {
    for (let i = 0; i < size; i++) {
      const idx = s - n + i; // the frame ends at s
      buf[i] = i < n && idx >= 0 && idx < input.samples.length ? input.samples[idx]! * w[i]! : 0;
    }
    realFft(buf, size, re, im);
    const mag = new Float64Array(re.length);
    for (let k = 0; k < re.length; k++) mag[k] = Math.hypot(re[k]!, im[k]!);
    out.times.push(((s - input.onsetSample) / fs) * 1000);
    out.mags.push(mag);
  }
  return out;
}

/** Hann window spectrum magnitude (main lobe only), x = frequency offset × frame length; 1 at x = 0. */
function hannLobe(x: number): number {
  const a = Math.abs(x);
  if (a >= 2) return 0;
  if (a < 1e-9) return 1;
  if (Math.abs(a - 1) < 1e-9) return 0.5;
  return Math.abs(Math.sin(Math.PI * a) / (Math.PI * a) / (1 - a * a));
}

/** Non-negative least squares by coordinate descent on the Gram matrix (K ≤ 6, so this is exact enough). */
function nnls(G: readonly Float64Array[], b: Float64Array, iterations: number): Float64Array {
  const K = b.length;
  const x = new Float64Array(K);
  for (let it = 0; it < iterations; it++)
    for (let i = 0; i < K; i++) {
      let g = 0;
      for (let j = 0; j < K; j++) g += G[i]![j]! * x[j]!;
      x[i] = Math.max(0, x[i]! + (b[i]! - g) / G[i]![i]!);
    }
  return x;
}

/**
 * Onset (ms, relative to the strum onset) of each sounding string from its NNLS activation, with its rise
 * (peak − base activation) as the weight. A string whose activation never rises is left out.
 */
export function stringOnsetsMs(input: DirectionInput): { idx: number; ms: number; rise: number }[] {
  const p = input.params ?? DEFAULT_DIRECTION_PARAMS;
  if (!input.voicing || !input.tuning) return [];
  const notes = expectedNotes(input.voicing, input.tuning, 0, input.deltaCents);
  if (notes.length === 0) return [];
  const frames = stft(input, p);
  const T = p.frameMs / 1000;
  const lo = Math.max(1, Math.floor(p.minHz / frames.binHz));
  const hi = Math.min(frames.mags[0]!.length - 1, Math.ceil(p.maxHz / frames.binHz));
  const nb = hi - lo + 1;
  const templates = notes.map((n) => {
    const w = new Float64Array(nb);
    for (let h = 1; h <= p.maxHarmonic; h++) {
      const f = h * n.f0 * Math.sqrt(1 + p.inharmonicityB * h * h);
      if (f > p.maxHz + 2 / T) break;
      const amp = h ** -p.alpha;
      const k0 = Math.max(lo, Math.floor((f - 2 / T) / frames.binHz));
      const k1 = Math.min(hi, Math.ceil((f + 2 / T) / frames.binHz));
      for (let k = k0; k <= k1; k++) w[k - lo] = w[k - lo]! + amp * hannLobe((k * frames.binHz - f) * T);
    }
    const norm = Math.hypot(...w) || 1;
    return w.map((v) => v / norm);
  });
  const dot = (a: Float64Array, b: ArrayLike<number>, offset: number) => {
    let s = 0;
    for (let k = 0; k < nb; k++) s += a[k]! * b[k + offset]!;
    return s;
  };
  const gram = templates.map((a) => Float64Array.from(templates, (b) => dot(a, b, 0)));
  const acts = frames.mags.map((m) =>
    nnls(
      gram,
      Float64Array.from(templates, (w) => dot(w, m, lo)),
      p.nnlsIterations,
    ),
  );
  const out: { idx: number; ms: number; rise: number }[] = [];
  notes.forEach((note, i) => {
    const a = acts.map((x) => x[i]!);
    const base = Math.min(...a.slice(0, 5));
    let peakFrame = 0;
    a.forEach((v, f) => {
      if (v > a[peakFrame]!) peakFrame = f;
    });
    const rise = a[peakFrame]! - base;
    if (!(rise > 0)) return;
    const th = base + p.riseFraction * rise;
    for (let f = 1; f <= peakFrame; f++)
      if (a[f]! >= th) {
        const r = (th - a[f - 1]!) / (a[f]! - a[f - 1]! || 1);
        const ms = frames.times[f - 1]! + r * (frames.times[f]! - frames.times[f - 1]!);
        out.push({ idx: note.idx, ms, rise });
        return;
      }
  });
  return out;
}

function centroidSlope(input: DirectionInput, p: DirectionParams): number {
  const frames = stft(input, { ...p, frameMs: 12, hopMs: 1.5, toMs: 75 });
  const lo = Math.max(1, Math.floor(70 / frames.binHz));
  const hi = Math.min(frames.mags[0]!.length - 1, Math.ceil(4000 / frames.binHz));
  const points: { t: number; c: number; w: number }[] = [];
  let prev: Float64Array | null = null;
  frames.mags.forEach((m, f) => {
    const log = m.map((v) => Math.log1p(100 * v));
    if (prev) {
      let sw = 0;
      let sc = 0;
      for (let k = lo; k <= hi; k++) {
        const d = log[k]! - prev[k]!;
        if (d > 0) {
          sw += d;
          sc += d * Math.log2(k * frames.binHz);
        }
      }
      if (sw > 0) points.push({ t: frames.times[f]!, c: sc / sw, w: sw });
    }
    prev = log;
  });
  return weightedSlope(points.map((q) => ({ x: q.t, y: q.c, w: q.w }))) * 10;
}

function weightedSlope(points: { x: number; y: number; w: number }[]): number {
  if (points.length < 2) return 0;
  const W = points.reduce((a, q) => a + q.w, 0);
  const mx = points.reduce((a, q) => a + q.w * q.x, 0) / W;
  const my = points.reduce((a, q) => a + q.w * q.y, 0) / W;
  const cov = points.reduce((a, q) => a + q.w * (q.x - mx) * (q.y - my), 0);
  const vx = points.reduce((a, q) => a + q.w * (q.x - mx) ** 2, 0);
  return vx > 0 ? cov / vx : 0;
}

export function strumDirection(input: DirectionInput): BetaResult<StrumDirection> & { slope: number } {
  const p = input.params ?? DEFAULT_DIRECTION_PARAMS;
  const onsets = stringOnsetsMs(input);
  if (onsets.length >= 2) {
    // ms per string step (6th string = idx 0): > 0 → low strings first → down. A string that barely rises
    // (quiet, or mostly explained by its neighbours) counts less.
    const maxRise = Math.max(...onsets.map((o) => o.rise));
    const slope = weightedSlope(onsets.map((o) => ({ x: o.idx, y: o.ms, w: o.rise / maxRise })));
    const value: StrumDirection = Math.abs(slope) < p.minSlopeMs ? 'unknown' : slope > 0 ? 'down' : 'up';
    return { ...beta(value, Math.min(1, Math.abs(slope) / p.fullSlopeMs)), slope };
  }
  const slope = centroidSlope(input, p);
  const value: StrumDirection = Math.abs(slope) < p.minCentroidSlope ? 'unknown' : slope > 0 ? 'down' : 'up';
  return { ...beta(value, Math.min(1, Math.abs(slope) / 0.3)), slope };
}
