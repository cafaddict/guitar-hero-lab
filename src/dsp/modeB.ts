/**
 * Mode B — strum verification, beta (SPEC §10.6).
 *
 * Observation window: onset + 40 ms, ≈ 170.7 ms (8192 @ 48 kHz), Hann, zero-pad ×2. Noise = bin-wise median
 * of the 0.5 s before the onset. Evidence for a partial is its peak against noise + predicted Hann leakage
 * from the other expected partials (leakage.ts) — in a chord, side-lobes of strong neighbours sit far above
 * the stationary noise. Per verifiable string: Klapuri-style weighted harmonic evidence over its independent
 * partials (§6.3 map).
 *   OK      = evidence ≥ T_PRESENT in the main window and the string still sounds in the late window
 *   MUTED   = late-window evidence ≤ T_ABSENT while the strum itself is loud (a muted string has decayed
 *             −30 dB by 120 ms; a sounding one has not)
 *   else uncertain (RETRY)
 * x strings that would be verifiable if they rang are checked explicitly, and a residual search flags strong,
 * sustained, unexplained notes as UNEXPECTED. Verdict: all verifiable OK and nothing unexpected → PASS; a
 * confident MUTED or UNEXPECTED → FAIL naming the strings; otherwise RETRY.
 *
 * Not a strum (D-106): before any of that, a loud new sound with hardly any expected partial as a spectral peak
 * that is also gone by the late window is a body knock: RETRY `NOT_STRING`.
 */
import type { Tuning } from '../domain/theory';
import {
  type ChordVoicing,
  DEFAULT_COLLISION_PARAMS,
  expectedNotes,
  partialCollisionMap,
} from '../domain/voicing';
import { type KnownPartial, leakageAt } from './leakage';
import {
  magnitudeSpectrum,
  medianSpectrum,
  msToSamples,
  nearestLocalPeak,
  partialPeak,
  peakAbs,
  type Spectrum,
} from './spectrum';
import {
  CLIP_LEVEL,
  type DspResultBase,
  type RetryReason,
  type Strictness,
  type StringStatus,
  type Verdict,
} from './types';
import { DETECTOR_VERSION } from './version';

export interface ModeBParams {
  windowStartMs: number;
  windowMs: number;
  /** Equal-length early/late windows for the per-string decay feature. */
  earlyStartMs: number;
  lateStartMs: number;
  decayWindowMs: number;
  /** OK needs decay ≥ okMinDecayDb; MUTED needs (decay ≤ mutedDecayDb and late level ≤ mutedRelLateDb re. the
   * strum) or decay ≤ mutedStrongDecayDb. */
  okMinDecayDb: number;
  mutedDecayDb: number;
  mutedRelLateDb: number;
  mutedStrongDecayDb: number;
  noiseSpanMs: number;
  salienceMaxPartial: number;
  tolCents: number;
  inharmonicityB: number;
  tPresentDb: Record<Strictness, number>;
  tAbsentDb: Record<Strictness, number>;
  /** MUTED is only confident when the strum's reference evidence is this many dB above T_ABSENT. */
  absentReferenceMarginDb: number;
  /** Partials closer than this many analysis bins to another known partial are not used as evidence. */
  resolutionBins: number;
  /** Safety factor on the predicted side-lobe leakage from known partials. */
  leakageFactor: number;
  tUnexpectedDb: number;
  tUnexpectedLateDb: number;
  /** Leakage factor for the x-string / wrong-fret probes (unexpected notes). */
  unexpectedLeakageFactor: number;
  /** Highest partial used by the explicit x-string check. */
  unexpectedMaxPartial: number;
  residualSearch: boolean;
  tResidualDb: number;
  residualMinPartials: number;
  minLevelDb: number;
  /**
   * Not-a-strum check (D-106): NOT_STRING when the new energy rises ≥ notStringRiseDb, under
   * notStringMaxPeakFraction of the expected partials (h ≤ notStringMaxPartial) are spectral peaks and the new
   * energy has fallen ≤ notStringMaxLateDb by the late window.
   */
  notStringRiseDb: number;
  notStringMaxPeakFraction: number;
  notStringMaxLateDb: number;
  notStringMaxPartial: number;
  /** A partial's peak counts when it is this many times the median magnitude within ±notStringFloorHz. */
  notStringPeakProminence: number;
  notStringFloorHz: number;
}

/** Collision rule used by the strum verifier (SPEC §6.3 default; changing it must not lower coverage). */
export const MODE_B_COLLISION_PARAMS = DEFAULT_COLLISION_PARAMS;

export const DEFAULT_MODE_B_PARAMS: ModeBParams = {
  windowStartMs: 40,
  windowMs: (8192 / 48000) * 1000,
  earlyStartMs: 30,
  lateStartMs: 130,
  decayWindowMs: 100,
  okMinDecayDb: -5,
  mutedDecayDb: -6,
  mutedRelLateDb: -16,
  mutedStrongDecayDb: -10,
  noiseSpanMs: 480,
  salienceMaxPartial: 6,
  tolCents: 30,
  inharmonicityB: 5e-5,
  tPresentDb: { lenient: 12, normal: 13, strict: 14 },
  tAbsentDb: { lenient: 4, normal: 5, strict: 6 },
  absentReferenceMarginDb: 15,
  resolutionBins: 2,
  leakageFactor: 2,
  tUnexpectedDb: 14,
  tUnexpectedLateDb: 8,
  unexpectedLeakageFactor: 1.5,
  unexpectedMaxPartial: 8,
  residualSearch: true,
  tResidualDb: 28,
  residualMinPartials: 2,
  minLevelDb: 10,
  notStringRiseDb: 10,
  notStringMaxPeakFraction: 0.25,
  notStringMaxLateDb: -8,
  notStringMaxPartial: 8,
  notStringPeakProminence: 2.5,
  notStringFloorHz: 40,
};

export interface StrumInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  voicing: ChordVoicing;
  tuning: Tuning;
  deltaCents?: readonly number[] | undefined;
  strictness?: Strictness;
  params?: ModeBParams;
}

export interface StrumStringResult {
  idx: number;
  status: StringStatus;
  salienceDb: number | null;
  /** Late-minus-early magnitude change of the independent partials (dB). */
  decayDb: number | null;
  /** Late-window level relative to the strum's late reference (dB). */
  relLateDb: number | null;
  verifiable: boolean;
}

export interface UnexpectedNote {
  /** String index when attributable (x string, or the string whose expected note is nearest). */
  idx: number | null;
  midi: number;
  salienceDb: number;
  lateDb: number;
}

export interface StrumResult extends DspResultBase {
  verdict: Verdict;
  strings: StrumStringResult[];
  unexpected: UnexpectedNote[];
  /** Strings named in a FAIL (MUTED or UNEXPECTED). */
  blamed: number[];
  referenceDb: number;
}

interface Analysis {
  spec: Spectrum;
  noise: Float64Array;
  binHz: number;
  known: KnownPartial[];
  leakageFactor: number;
  tolCents: number;
  /** Bins within 2 analysis bins of a known partial (excluded from the local floor). */
  partialMask: Uint8Array;
}

const partialHz = (f0: number, h: number, b: number) => h * f0 * Math.sqrt(1 + b * h * h);

function allPartials(f0s: readonly number[], b: number, maxK = 16, maxHz = 6000): number[] {
  const out: number[] = [];
  for (const f0 of f0s) {
    for (let k = 1; k <= maxK; k++) {
      const f = partialHz(f0, k, b);
      if (f > maxHz) break;
      out.push(f);
    }
  }
  return out;
}

function analyze(
  input: StrumInput,
  params: ModeBParams,
  startMs: number,
  lengthMs: number,
  expectedPartials: readonly number[],
): Analysis {
  const fs = input.sampleRate;
  const len = msToSamples(lengthMs, fs);
  const spec = magnitudeSpectrum(input.samples, input.onsetSample + msToSamples(startMs, fs), len, fs, 2);
  const noiseEnd = input.onsetSample - msToSamples(20, fs);
  const noiseStart = noiseEnd - msToSamples(params.noiseSpanMs, fs);
  const hop = Math.max(1, Math.round(len / 2));
  const spectra: Float64Array[] = [];
  for (let s = noiseStart; s + len <= noiseEnd; s += hop)
    spectra.push(magnitudeSpectrum(input.samples, s, len, fs, 2).mag.slice());
  if (spectra.length === 0)
    spectra.push(magnitudeSpectrum(input.samples, noiseStart, len, fs, 2).mag.slice());
  const partialMask = new Uint8Array(spec.mag.length);
  const a: Analysis = {
    spec,
    noise: medianSpectrum(spectra),
    binHz: fs / len,
    known: [],
    leakageFactor: params.leakageFactor,
    tolCents: params.tolCents,
    partialMask,
  };
  a.known = expectedPartials.map((hz) => ({ hz, mag: partialPeak(spec, hz, params.tolCents).mag }));
  const halfWidth = Math.ceil((2 * a.binHz) / spec.binHz);
  for (const hz of expectedPartials) {
    const center = Math.round(hz / spec.binHz);
    for (
      let k = Math.max(0, center - halfWidth);
      k <= Math.min(partialMask.length - 1, center + halfWidth);
      k++
    )
      partialMask[k] = 1;
  }
  return a;
}

/**
 * Diffuse floor around `hz`: 30th-percentile magnitude of the window's own bins within ±1/3 octave that are
 * neither near a known partial nor near the probe itself (captures reverberated pick noise that the
 * pre-onset noise estimate cannot see).
 */
function localFloor(a: Analysis, hz: number): number {
  const lo = Math.max(1, Math.floor(hz / 2 ** (1 / 3) / a.spec.binHz));
  const hi = Math.min(a.spec.mag.length - 1, Math.ceil((hz * 2 ** (1 / 3)) / a.spec.binHz));
  const self = Math.round(hz / a.spec.binHz);
  const selfHalf = Math.ceil((2 * a.binHz) / a.spec.binHz);
  const values: number[] = [];
  for (let k = lo; k <= hi; k++)
    if (!a.partialMask[k] && Math.abs(k - self) > selfHalf) values.push(a.spec.mag[k]!);
  if (values.length < 5) return 0;
  values.sort((x, y) => x - y);
  return values[Math.floor(values.length * 0.3)]!;
}

/**
 * Evidence (dB) of a partial at `hz`: the nearest true spectral peak — which must sit within ±tol cents of
 * `hz`, otherwise the partial is absent (0 dB; a neighbour's skirt is not evidence) — against noise +
 * predicted leakage from the known partials + the local diffuse floor.
 */
function evidenceDb(a: Analysis, hz: number, leakageFactor = a.leakageFactor): number {
  const peak = nearestLocalPeak(a.spec, hz, 3);
  if (Math.abs(1200 * Math.log2(peak.hz / hz)) > a.tolCents) return 0;
  const noise = a.noise[peak.bin] ?? 0;
  const leak = leakageFactor * leakageAt(hz, a.known, a.binHz);
  return 20 * Math.log10((peak.mag + 1e-12) / (noise + leak + localFloor(a, hz) + 1e-12));
}

/** True when another known partial lies within [0.02, resolutionBins) analysis bins (unresolvable). */
function crowded(a: Analysis, hz: number, others: readonly number[], resolutionBins: number): boolean {
  return others.some((g) => {
    const d = Math.abs(g - hz) / a.binHz;
    return d >= 0.02 && d < resolutionBins;
  });
}

/** Weighted harmonic evidence over `partials` (h numbers) of a note; null when none is usable. */
function salience(
  a: Analysis,
  f0: number,
  partials: readonly number[],
  others: readonly number[],
  params: ModeBParams,
  maxPartial: number,
  leakageFactor = a.leakageFactor,
): number | null {
  let s = 0;
  let w = 0;
  for (const h of partials) {
    if (h > maxPartial) continue;
    const f = partialHz(f0, h, params.inharmonicityB);
    if (crowded(a, f, others, params.resolutionBins)) continue;
    const weight = h ** -0.5 * (h === 1 && f0 < 120 ? 0.5 : 1);
    s += weight * Math.max(0, evidenceDb(a, f, leakageFactor));
    w += weight;
  }
  return w > 0 ? s / w : null;
}

const magDb = (a: Analysis, hz: number) => 20 * Math.log10(partialPeak(a.spec, hz, a.tolCents).mag + 1e-12);

/** Mean log magnitude (dB) of the given partials of a note in an analysis window. */
function meanLevelDb(a: Analysis, f0: number, partials: readonly number[], b: number): number {
  return partials.reduce((sum, h) => sum + magDb(a, partialHz(f0, h, b)), 0) / partials.length;
}

/** Median log magnitude of the first four partials of all expected notes (the strum's level). */
function strumLevelDb(a: Analysis, f0s: readonly number[], b: number): number {
  const values = f0s
    .flatMap((f0) => [1, 2, 3, 4].map((h) => magDb(a, partialHz(f0, h, b))))
    .sort((x, y) => x - y);
  return values[values.length >> 1] ?? -240;
}

/** What the new energy after the onset looks like (D-106). */
export interface StrumEvidence {
  /** Share of the expected partials that are prominent spectral peaks carrying new energy. */
  peakFraction: number;
  /** Overall energy rise of the early window over the pre-onset window, 60–5000 Hz (dB). */
  riseDb: number;
  /** New energy of the late window relative to the early window (dB). */
  lateDb: number;
}

/**
 * New energy of the early and late windows against the same-length window ending 20 ms before the onset, so
 * strings that were already ringing do not count. A string has narrow peaks at its partials and lasts; a body
 * knock has a few resonances, which rarely fall on the chord's partials, and is gone in about 100 ms.
 */
function strumEvidence(
  input: StrumInput,
  params: ModeBParams,
  f0s: readonly number[],
  early: Spectrum,
  late: Spectrum,
): StrumEvidence {
  const fs = input.sampleRate;
  const len = msToSamples(params.decayWindowMs, fs);
  const before = magnitudeSpectrum(input.samples, input.onsetSample - msToSamples(20, fs) - len, len, fs, 2);
  const binHz = early.binHz;
  const newPower = (spec: Spectrum, k: number) =>
    Math.max(0, spec.mag[k]! * spec.mag[k]! - before.mag[k]! * before.mag[k]!);
  const lo = Math.ceil(60 / binHz);
  const hi = Math.min(early.mag.length - 2, Math.floor(5000 / binHz));
  let rise = 0;
  let base = 0;
  let earlyNew = 0;
  let lateNew = 0;
  for (let k = lo; k <= hi; k++) {
    rise += early.mag[k]! * early.mag[k]!;
    base += before.mag[k]! * before.mag[k]!;
    earlyNew += newPower(early, k);
    lateNew += newPower(late, k);
  }
  const bandRatio = 2 ** (25 / 1200) - 1;
  const floorBins = Math.round(params.notStringFloorHz / binHz);
  let partials = 0;
  let peaks = 0;
  for (const f0 of f0s) {
    for (let h = 1; h <= params.notStringMaxPartial; h++) {
      const centre = partialHz(f0, h, params.inharmonicityB);
      if (centre > 5000) break;
      partials++;
      const half = Math.max(8, centre * bandRatio);
      let bin = -1;
      for (
        let k = Math.max(lo, Math.ceil((centre - half) / binHz));
        k <= Math.floor((centre + half) / binHz);
        k++
      ) {
        if (k > hi) break;
        const m = early.mag[k]!;
        if (m >= early.mag[k - 1]! && m >= early.mag[k + 1]! && (bin < 0 || m > early.mag[bin]!)) bin = k;
      }
      if (bin < 0 || newPower(early, bin) <= 0) continue;
      const around = Array.from(early.mag.subarray(Math.max(1, bin - floorBins), bin + floorBins + 1)).sort(
        (x, y) => x - y,
      );
      if (early.mag[bin]! >= params.notStringPeakProminence * around[around.length >> 1]!) peaks++;
    }
  }
  return {
    peakFraction: partials > 0 ? peaks / partials : 0,
    riseDb: 10 * Math.log10((rise + 1e-20) / (base + 1e-20)),
    lateDb: 10 * Math.log10((lateNew + 1e-20) / (earlyNew + 1e-20)),
  };
}

export function verifyStrum(input: StrumInput): StrumResult {
  const t0 = performance.now();
  const params = input.params ?? DEFAULT_MODE_B_PARAMS;
  const strictness = input.strictness ?? 'lenient';
  const fs = input.sampleRate;
  const b = params.inharmonicityB;
  const notes = expectedNotes(input.voicing, input.tuning, 0, input.deltaCents);
  const map = partialCollisionMap(input.voicing, input.tuning, MODE_B_COLLISION_PARAMS, input.deltaCents);
  const result = (
    verdict: Verdict,
    reasons: RetryReason[],
    strings: StrumStringResult[],
    unexpected: UnexpectedNote[],
    blamed: number[],
    referenceDb: number,
    confidence: number,
  ): StrumResult => ({
    detectorVersion: DETECTOR_VERSION,
    confidence,
    reasons,
    processingMs: Math.max(1e-3, performance.now() - t0),
    verdict,
    strings,
    unexpected,
    blamed,
    referenceDb,
  });

  if (peakAbs(input.samples, input.onsetSample, input.onsetSample + msToSamples(300, fs)) > CLIP_LEVEL) {
    return result('RETRY', ['CLIPPING'], [], [], [], 0, 0);
  }
  const expectedF0s = notes.map((n) => n.f0);
  const expectedPartials = allPartials(expectedF0s, b);
  const main = analyze(input, params, params.windowStartMs, params.windowMs, expectedPartials);
  const early = analyze(input, params, params.earlyStartMs, params.decayWindowMs, expectedPartials);
  const late = analyze(input, params, params.lateStartMs, params.decayWindowMs, expectedPartials);

  // Reference loudness: median SNR (vs. noise only) over the first four partials of every expected note.
  const refValues: number[] = [];
  for (const n of notes) {
    for (let h = 1; h <= 4; h++) {
      const peak = partialPeak(main.spec, partialHz(n.f0, h, b), params.tolCents);
      refValues.push(20 * Math.log10((peak.mag + 1e-12) / ((main.noise[peak.bin] ?? 0) + 1e-12)));
    }
  }
  refValues.sort((x, y) => x - y);
  const referenceDb = refValues.length ? refValues[refValues.length >> 1]! : 0;
  const lateRefDb = strumLevelDb(late, expectedF0s, b);
  const weak = (): StrumStringResult[] =>
    notes.map((n) => ({
      idx: n.idx,
      status: 'WEAK',
      salienceDb: null,
      decayDb: null,
      relLateDb: null,
      verifiable: map.find((m) => m.idx === n.idx)?.verifiable ?? false,
    }));
  const evidence = strumEvidence(input, params, expectedF0s, early.spec, late.spec);
  if (
    evidence.riseDb >= params.notStringRiseDb &&
    evidence.peakFraction < params.notStringMaxPeakFraction &&
    evidence.lateDb <= params.notStringMaxLateDb
  )
    return result('RETRY', ['NOT_STRING'], weak(), [], [], referenceDb, 0);
  if (referenceDb < params.minLevelDb) return result('RETRY', ['LOW_LEVEL'], weak(), [], [], referenceDb, 0);

  const tPresent = params.tPresentDb[strictness];
  const tAbsent = params.tAbsentDb[strictness];
  const loud = referenceDb >= tAbsent + params.absentReferenceMarginDb;
  const strings: StrumStringResult[] = notes.map((n) => {
    const entry = map.find((m) => m.idx === n.idx);
    if (!entry?.verifiable)
      return {
        idx: n.idx,
        status: 'UNVERIFIABLE',
        salienceDb: null,
        decayDb: null,
        relLateDb: null,
        verifiable: false,
      };
    const others = allPartials(
      notes.filter((o) => o.idx !== n.idx).map((o) => o.f0),
      b,
    );
    const own = entry.independentPartials.filter((h) => h <= params.salienceMaxPartial);
    const sal = salience(main, n.f0, entry.independentPartials, others, params, params.salienceMaxPartial);
    if (own.length === 0 || sal === null)
      return {
        idx: n.idx,
        status: 'WEAK',
        salienceDb: sal,
        decayDb: null,
        relLateDb: null,
        verifiable: true,
      };
    const decayDb = meanLevelDb(late, n.f0, own, b) - meanLevelDb(early, n.f0, own, b);
    const relLateDb = meanLevelDb(late, n.f0, own, b) - lateRefDb;
    const row = { idx: n.idx, salienceDb: sal, decayDb, relLateDb, verifiable: true };
    if (sal >= tPresent && decayDb >= params.okMinDecayDb) return { ...row, status: 'OK' };
    const mutedShape =
      (decayDb <= params.mutedDecayDb && relLateDb <= params.mutedRelLateDb) ||
      decayDb <= params.mutedStrongDecayDb;
    if (mutedShape && loud) return { ...row, status: 'MUTED' };
    return { ...row, status: 'WEAK' };
  });

  const unexpected: UnexpectedNote[] = [];
  // Explicit x-string check: the open note of each muted string, using the augmented-voicing collision map.
  input.voicing.frets.forEach((fret, idx) => {
    if (fret !== 'x') return;
    const augmented: ChordVoicing = {
      ...input.voicing,
      frets: input.voicing.frets.map((f, i) => (i === idx ? 0 : f)),
    };
    const augMap = partialCollisionMap(augmented, input.tuning, MODE_B_COLLISION_PARAMS, input.deltaCents);
    const entry = augMap.find((m) => m.idx === idx);
    if (!entry?.verifiable) return;
    const f0 = expectedNotes(augmented, input.tuning, 0, input.deltaCents).find((n) => n.idx === idx)!.f0;
    const lf = params.unexpectedLeakageFactor;
    // Detection may also use the fundamental when nothing expected sits near it (the §6.3 map decides
    // only *whether* the x string is checkable; it excludes h = 1 below 120 Hz for mic roll-off).
    const fundamentalFree = !expectedPartials.some((g) => Math.abs(1200 * Math.log2(g / f0)) <= 35);
    const probe = [...new Set([...(fundamentalFree && f0 >= 70 ? [1] : []), ...entry.independentPartials])];
    const sal = salience(main, f0, probe, expectedPartials, params, params.unexpectedMaxPartial, lf);
    const lateSal = salience(late, f0, probe, expectedPartials, params, params.unexpectedMaxPartial, lf);
    if (
      sal !== null &&
      lateSal !== null &&
      sal >= params.tUnexpectedDb &&
      lateSal >= params.tUnexpectedLateDb
    ) {
      unexpected.push({ idx, midi: input.tuning.openMidi[idx]!, salienceDb: sal, lateDb: lateSal });
    }
  });

  if (params.residualSearch) {
    // Wrong-fret hypotheses: each played string one or two frets off (SPEC §10.6-4 "기대 밖 음").
    const tolRatio = 2 ** (35 / 1200);
    for (const n of notes) {
      for (const offset of [-2, -1, 1, 2]) {
        const midi = n.midi + offset;
        if (notes.some((o) => (o.midi - midi) % 12 === 0) || unexpected.some((u) => u.midi === midi))
          continue;
        const f0 = n.f0 * 2 ** (offset / 12);
        const usable: number[] = [];
        for (let h = 1; h <= 6; h++) {
          const f = partialHz(f0, h, b);
          if (f > 3000) break;
          if (h === 1 && f0 < 120) continue;
          const clash =
            expectedPartials.some((g) => f / g < tolRatio && g / f < tolRatio) ||
            crowded(main, f, expectedPartials, params.resolutionBins);
          if (!clash) usable.push(h);
        }
        if (usable.length < params.residualMinPartials) continue;
        const sal = salience(main, f0, usable, expectedPartials, params, 6, params.unexpectedLeakageFactor);
        const lateSal = salience(
          late,
          f0,
          usable,
          expectedPartials,
          params,
          6,
          params.unexpectedLeakageFactor,
        );
        if (
          sal === null ||
          lateSal === null ||
          sal < params.tResidualDb ||
          lateSal < params.tUnexpectedLateDb
        )
          continue;
        unexpected.push({ idx: n.idx, midi, salienceDb: sal, lateDb: lateSal });
      }
    }
  }

  const muted = strings.filter((s) => s.status === 'MUTED').map((s) => s.idx);
  const unexpectedIdx = unexpected.map((u) => u.idx).filter((i): i is number => i !== null);
  if (muted.length > 0 || unexpected.length > 0) {
    const blamed = [...new Set([...muted, ...unexpectedIdx])].sort((x, y) => x - y);
    return result('FAIL', [], strings, unexpected, blamed, referenceDb, 0.8);
  }
  const verifiable = strings.filter((s) => s.verifiable);
  if (verifiable.length > 0 && verifiable.every((s) => s.status === 'OK'))
    return result('PASS', [], strings, [], [], referenceDb, 0.8);
  return result('RETRY', ['AMBIGUOUS'], strings, [], [], referenceDb, verifiable.length === 0 ? 0 : 0.3);
}
