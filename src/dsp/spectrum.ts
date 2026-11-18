/**
 * Magnitude spectra and partial peak picking (SPEC §10.2). Pure.
 */
import { nextPow2, realFft } from './fft';
import { hann, windowSum } from './window';

export interface Spectrum {
  /** Linear amplitude per bin (a full-scale sinusoid of amplitude A peaks near A). */
  mag: Float64Array;
  fftSize: number;
  sampleRate: number;
  /** Hz per bin. */
  binHz: number;
}

/** Hann window sums per length (hann() itself is cached, so its sum never changes). */
const hannSums = new Map<number, number>();

function hannSum(length: number, w: Float64Array): number {
  let s = hannSums.get(length);
  if (s === undefined) {
    s = windowSum(w);
    hannSums.set(length, s);
  }
  return s;
}

const scratch = new Map<number, { buf: Float64Array; re: Float64Array; im: Float64Array }>();

function scratchFor(n: number) {
  let s = scratch.get(n);
  if (!s) {
    s = { buf: new Float64Array(n), re: new Float64Array(n / 2 + 1), im: new Float64Array(n / 2 + 1) };
    scratch.set(n, s);
  }
  return s;
}

/**
 * Hann-windowed magnitude spectrum of signal[start, start+length), zero-padded by `zeroPad`
 * (rounded up to a power of two). Out-of-range samples count as zero.
 */
export function magnitudeSpectrum(
  signal: ArrayLike<number>,
  start: number,
  length: number,
  sampleRate: number,
  zeroPad = 2,
  out?: Float64Array,
): Spectrum {
  const fftSize = nextPow2(Math.max(2, Math.round(length * zeroPad)));
  const w = hann(length);
  start = Math.round(start);
  const s = scratchFor(fftSize);
  const buf = s.buf;
  buf.fill(0);
  for (let i = 0; i < length; i++) {
    const idx = start + i;
    const x = idx >= 0 && idx < signal.length ? signal[idx]! : 0;
    buf[i] = x * w[i]!;
  }
  realFft(buf, fftSize, s.re, s.im);
  const bins = fftSize / 2 + 1;
  const mag = out && out.length >= bins ? out : new Float64Array(bins);
  const scale = 2 / hannSum(length, w);
  for (let k = 0; k < bins; k++) mag[k] = Math.hypot(s.re[k]!, s.im[k]!) * scale;
  return { mag, fftSize, sampleRate, binHz: sampleRate / fftSize };
}

export interface PartialPeak {
  /** Interpolated peak amplitude. */
  mag: number;
  /** Interpolated peak frequency (Hz). */
  hz: number;
  /** Integer bin of the maximum. */
  bin: number;
}

/**
 * Largest peak within ±tolCents of `hz`, refined by parabolic interpolation on log magnitude
 * (exact for a Gaussian-like Hann main lobe). Returns the bin at `hz` with its magnitude when the
 * search window is empty.
 */
export function partialPeak(spec: Spectrum, hz: number, tolCents: number): PartialPeak {
  const ratio = 2 ** (tolCents / 1200);
  const lo = Math.max(1, Math.floor(hz / ratio / spec.binHz));
  const hi = Math.min(spec.mag.length - 2, Math.ceil((hz * ratio) / spec.binHz));
  let best = Math.min(spec.mag.length - 2, Math.max(1, Math.round(hz / spec.binHz)));
  let bestMag = -1;
  for (let k = lo; k <= hi; k++) {
    const m = spec.mag[k]!;
    if (m > bestMag) {
      bestMag = m;
      best = k;
    }
  }
  if (bestMag < 0) return { mag: spec.mag[best] ?? 0, hz: best * spec.binHz, bin: best };
  const a = Math.log(spec.mag[best - 1]! + 1e-20);
  const b = Math.log(spec.mag[best]! + 1e-20);
  const c = Math.log(spec.mag[best + 1]! + 1e-20);
  const denom = a - 2 * b + c;
  const delta = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
  const peakLog = b - 0.25 * (a - c) * delta;
  return { mag: Math.exp(peakLog), hz: (best + delta) * spec.binHz, bin: best };
}

/** Ascending in-place sort for the few spectra of a median (cheaper than TypedArray#sort per bin). */
function insertionSort(a: Float64Array): void {
  for (let i = 1; i < a.length; i++) {
    const v = a[i]!;
    let j = i - 1;
    while (j >= 0 && a[j]! > v) {
      a[j + 1] = a[j]!;
      j--;
    }
    a[j + 1] = v;
  }
}

/** Median of each bin across several spectra (noise floor estimate). */
export function medianSpectrum(spectra: readonly Float64Array[]): Float64Array {
  const first = spectra[0];
  if (!first) return new Float64Array(0);
  const out = new Float64Array(first.length);
  const column = new Float64Array(spectra.length);
  for (let k = 0; k < first.length; k++) {
    for (let j = 0; j < spectra.length; j++) column[j] = spectra[j]![k]!;
    if (column.length <= 32) insertionSort(column);
    else column.sort();
    const mid = column.length >> 1;
    out[k] = column.length % 2 ? column[mid]! : 0.5 * (column[mid - 1]! + column[mid]!);
  }
  return out;
}

export function rms(signal: ArrayLike<number>, start: number, end: number): number {
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(signal.length, Math.floor(end));
  if (e <= s) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += signal[i]! * signal[i]!;
  return Math.sqrt(sum / (e - s));
}

export function peakAbs(signal: ArrayLike<number>, start: number, end: number): number {
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(signal.length, Math.floor(end));
  let m = 0;
  for (let i = s; i < e; i++) {
    const a = Math.abs(signal[i]!);
    if (a > m) m = a;
  }
  return m;
}

export const toDb = (x: number): number => 20 * Math.log10(Math.max(x, 1e-12));
export const fromDb = (db: number): number => 10 ** (db / 20);
export const msToSamples = (ms: number, sampleRate: number): number => Math.round((ms / 1000) * sampleRate);

/**
 * The local spectral maximum nearest to `hz` (within ±searchBins FFT bins), with log-parabolic interpolation.
 * Unlike partialPeak this never returns a point on another peak's skirt: callers check that the returned
 * frequency is close enough to `hz` to count as "the partial is here".
 */
export function nearestLocalPeak(spec: Spectrum, hz: number, searchBins = 3): PartialPeak {
  const center = Math.round(hz / spec.binHz);
  let best = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  for (
    let k = Math.max(1, center - searchBins);
    k <= Math.min(spec.mag.length - 2, center + searchBins);
    k++
  ) {
    const m = spec.mag[k]!;
    if (m >= spec.mag[k - 1]! && m >= spec.mag[k + 1]!) {
      const d = Math.abs(k - hz / spec.binHz);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
  }
  if (best < 0) {
    const k = Math.min(spec.mag.length - 2, Math.max(1, center));
    return { mag: spec.mag[k]!, hz: k * spec.binHz, bin: k };
  }
  const a = Math.log(spec.mag[best - 1]! + 1e-20);
  const b = Math.log(spec.mag[best]! + 1e-20);
  const c = Math.log(spec.mag[best + 1]! + 1e-20);
  const denom = a - 2 * b + c;
  const delta = denom < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
  return { mag: Math.exp(b - 0.25 * (a - c) * delta), hz: (best + delta) * spec.binHz, bin: best };
}
