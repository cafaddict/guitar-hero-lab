/**
 * Mode B on a body knock (D-106): a knock on the guitar body is not a strum, and real strums keep their verdicts.
 * Seeded synthetic takes; the rates are regression floors on these generators, not the §14 contract.
 */
import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { STANDARD_TUNING } from '../domain/theory';
import { expectedNotes } from '../domain/voicing';
import { DEFAULT_MODE_B_PARAMS, type StrumResult, verifyStrum } from './modeB';
import { renderKnock } from './synth/knock';
import { renderStrum } from './synth/strum';

const FS = 48000;
const ONSET = Math.round(0.7 * FS);
const VOICINGS = ['E', 'Em', 'Am', 'C', 'D', 'G-3f'];

/** A dry part placed at ONSET, peak 0.5, over a quiet deterministic noise floor. */
function recorded(parts: readonly { x: Float32Array; at: number }[], seed: number): Float32Array {
  const out = new Float32Array(ONSET + 2 * FS);
  for (const { x, at } of parts)
    for (let i = 0; i < x.length && at + i < out.length; i++) out[at + i] = out[at + i]! + x[i]!;
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  let s = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (out[i]! * 0.5) / peak + 3e-4 * ((s / 4294967296) * 2 - 1);
  }
  return out;
}

function knock(seed: number): Float32Array {
  return renderKnock({ sampleRate: FS, durationS: 1, seed });
}

function strum(voicingId: string, seed: number, muted = false): Float32Array {
  const strings = expectedNotes(voicingById(voicingId), STANDARD_TUNING, 0).map((n) => ({
    idx: n.idx,
    gainDb: 0,
    note: {
      model: 'karplus-strong' as const,
      f0: n.f0,
      sampleRate: FS,
      durationS: 1,
      inharmonicityB: 5e-5,
      muted,
      mutedDecayDb: -30,
      mutedDecayMs: 120,
      fundamentalDb: 0,
      brightness: 0.6,
      pickPosition: 0.15,
      t60S: 3,
      seed: seed + n.idx,
    },
  }));
  return renderStrum({ strings, direction: 'down', spreadMs: 30, sampleRate: FS }).signal;
}

function judge(samples: Float32Array, voicingId: string, onsetSample = ONSET): StrumResult {
  return verifyStrum({
    samples,
    sampleRate: FS,
    onsetSample,
    voicing: voicingById(voicingId),
    tuning: STANDARD_TUNING,
  });
}

const notString = (r: StrumResult) => r.verdict === 'RETRY' && r.reasons.includes('NOT_STRING');
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const everyVoicingAndSeed = <T>(f: (voicingId: string, seed: number) => T): T[] =>
  VOICINGS.flatMap((v) => seeds.map((s) => f(v, s)));

describe('verifyStrum: a body knock alone (D-106)', () => {
  it('returns RETRY with the reason NOT_STRING', () => {
    const result = judge(recorded([{ x: knock(11), at: ONSET }], 11), 'E');
    expect(result.verdict).toBe('RETRY');
    expect(result.reasons).toEqual(['NOT_STRING']);
    expect(result.blamed).toEqual([]);
  });

  it('is NOT_STRING at ≥ 95 % over voicings and seeds, never PASS or FAIL', () => {
    const results = everyVoicingAndSeed((v, s) => judge(recorded([{ x: knock(s), at: ONSET }], s), v));
    expect(results.filter(notString).length / results.length).toBeGreaterThanOrEqual(0.95);
    expect(results.filter((r) => r.verdict !== 'RETRY')).toEqual([]);
  });

  it('a clipped knock stays CLIPPING: the level check comes first', () => {
    const samples = recorded([{ x: knock(11), at: ONSET }], 11).map((v) => v * 4);
    expect(judge(samples, 'E').reasons).toEqual(['CLIPPING']);
  });

  it('a knock at the very start of the buffer (no pre-onset audio) still returns a RETRY', () => {
    const samples = recorded([{ x: knock(11), at: ONSET }], 11).slice(ONSET);
    expect(judge(samples, 'E', 0).verdict).toBe('RETRY');
  });
});

describe('verifyStrum: real strums are not knocks (D-106)', () => {
  it('a clean strum is never NOT_STRING', () => {
    const results = everyVoicingAndSeed((v, s) => judge(recorded([{ x: strum(v, s), at: ONSET }], s), v));
    expect(results.filter(notString)).toEqual([]);
  });

  it('a chord with every string muted is still judged as strings (almost never NOT_STRING)', () => {
    const results = everyVoicingAndSeed((v, s) =>
      judge(recorded([{ x: strum(v, s, true), at: ONSET }], s), v),
    );
    expect(results.filter(notString).length / results.length).toBeLessThanOrEqual(0.02);
  });

  it('sound that lasts is not a knock even when the peak check would say so (late-window gate)', () => {
    const result = verifyStrum({
      samples: recorded([{ x: strum('E', 3), at: ONSET }], 3),
      sampleRate: FS,
      onsetSample: ONSET,
      voicing: voicingById('E'),
      tuning: STANDARD_TUNING,
      params: { ...DEFAULT_MODE_B_PARAMS, notStringMaxPeakFraction: 1.01 },
    });
    expect(result.reasons).not.toContain('NOT_STRING');
  });

  it('a sound barely above what was already ringing is not NOT_STRING (rise gate)', () => {
    const samples = recorded(
      [
        { x: strum('E', 5), at: ONSET - Math.round(0.5 * FS) },
        { x: knock(5).map((v) => v * 0.05), at: ONSET },
      ],
      5,
    );
    expect(judge(samples, 'E').reasons).not.toContain('NOT_STRING');
  });
});
