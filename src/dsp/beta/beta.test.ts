import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { STANDARD_TUNING } from '../../domain/theory';
import { applyBuzz, applyPalmMute } from '../synth/effects';
import { type NoteSpec, randomTimbre, renderNote } from '../synth/note';
import { normalizeNote, renderStrum } from '../synth/strum';
import { buzzScore } from './buzz';
import { strumDirection } from './direction';
import { barDynamics, eventLevelsDb } from './dynamics';
import { palmMuteFeatures, palmMuteProbability } from './palmMute';

const FS = 48000;
const ONSET = FS / 2;

function note(f0: number, seed: number): NoteSpec {
  return {
    model: 'additive',
    f0,
    sampleRate: FS,
    durationS: 1,
    inharmonicityB: 5e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    seed,
  };
}

function placed(x: Float32Array): Float32Array {
  const out = new Float32Array(ONSET + x.length + FS / 4);
  out.set(x, ONSET);
  let seed = 9;
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out[i] = out[i]! + ((seed / 2 ** 32) * 2 - 1) * 1e-4;
  }
  return out;
}

function strum(id: string, direction: 'down' | 'up', spreadMs: number, decayS: number | null = null) {
  const v = voicingById(id);
  const s = renderStrum({
    strings: v.frets.flatMap((f, idx) =>
      f === 'x'
        ? []
        : [
            {
              idx,
              note: note(440 * 2 ** ((STANDARD_TUNING.openMidi[idx]! + f - 69) / 12), 3 + idx),
              gainDb: 0,
            },
          ],
    ),
    direction,
    spreadMs,
    sampleRate: FS,
  }).signal;
  return placed(decayS === null ? s : applyPalmMute(s, FS, decayS));
}

describe('SPEC v1.1 §10.11 beta detectors — results are beta, never verdicts', () => {
  it('buzz: a buzzing note scores above its clean template and is suspected', () => {
    const clean = renderNote(note(110, 1));
    normalizeNote(clean, FS);
    const buzzed = clean.slice();
    applyBuzz(buzzed, FS, 1, 5);
    const input = { sampleRate: FS, onsetSample: ONSET, f0: 110 };
    const template = buzzScore({ ...input, samples: placed(clean) }).residual;
    const res = buzzScore({ ...input, samples: placed(buzzed), template });
    expect(res.beta).toBe(true);
    expect(res.suspected).toBe(true);
    expect(buzzScore({ ...input, samples: placed(clean), template }).suspected).toBe(false);
    expect(Object.keys(res)).not.toContain('verdict');
  });

  it('direction: answers down/up/unknown as a beta result (its accuracy is reported, not asserted — BENCHMARK.md)', () => {
    const args = { sampleRate: FS, onsetSample: ONSET, voicing: voicingById('E'), tuning: STANDARD_TUNING };
    for (const dir of ['down', 'up'] as const) {
      const res = strumDirection({ ...args, samples: strum('E', dir, 40) });
      expect(res.beta).toBe(true);
      expect(['down', 'up', 'unknown']).toContain(res.value);
      expect(res.confidence).toBeGreaterThanOrEqual(0);
      expect(res.confidence).toBeLessThanOrEqual(1);
      expect(Object.keys(res)).not.toContain('verdict');
    }
    // Without a voicing the centroid fallback still answers.
    const fallback = strumDirection({ samples: strum('E', 'down', 40), sampleRate: FS, onsetSample: ONSET });
    expect(['down', 'up', 'unknown']).toContain(fallback.value);
  });

  it('direction: octave-heavy chords at a 30 ms spread are ordered by per-string activation (D-107)', () => {
    // E, Em and G-3f share many partials between strings (E2/E3/E4, G2/G3); unique-partial timing misread them.
    for (const id of ['E', 'Em', 'G-3f']) {
      const args = { sampleRate: FS, onsetSample: ONSET, voicing: voicingById(id), tuning: STANDARD_TUNING };
      for (const dir of ['down', 'up'] as const) {
        expect(strumDirection({ ...args, samples: strum(id, dir, 30) }).value).toBe(dir);
      }
    }
  });

  it('palm mute: a muted strum is likely muted against the open reference, the open one is not', () => {
    const reference = palmMuteFeatures({
      samples: strum('G-3f', 'down', 15),
      sampleRate: FS,
      onsetSample: ONSET,
    });
    const muted = palmMuteProbability({
      samples: strum('G-3f', 'down', 15, 0.2),
      sampleRate: FS,
      onsetSample: ONSET,
      reference,
    });
    const open = palmMuteProbability({
      samples: strum('G-3f', 'down', 20),
      sampleRate: FS,
      onsetSample: ONSET,
      reference,
    });
    expect(muted.muted).toBe(true);
    expect(open.muted).toBe(false);
    expect(muted.beta).toBe(true);
  });

  it('dynamics: bars are loud/soft/even relative to the run median (true median of an even count)', () => {
    const levels = [0, 0, 0, 0, 8, 8, 8, 8, -8, -8, -8, -8, 0, 0, 0, 0];
    const bars = levels.map((_, i) => Math.floor(i / 4));
    expect(barDynamics(levels, bars, 4).map((b) => b.value)).toEqual(['even', 'loud', 'soft', 'even']);
    const alternating = [9, 9, -9, -9].flatMap((l) => [l, l, l, l]);
    expect(barDynamics(alternating, bars, 4).map((b) => b.value)).toEqual(['loud', 'loud', 'soft', 'soft']);
    const x = placed(new Float32Array(FS).map((_, i) => Math.sin(i / 10) * (i < FS / 2 ? 0.1 : 0.4)));
    const [a, b] = eventLevelsDb(x, FS, [ONSET + 100, ONSET + FS / 2 + 100]);
    expect(b! - a!).toBeCloseTo(12, 0);
  });
});
