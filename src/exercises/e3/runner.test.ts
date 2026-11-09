import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { extractMetrics, pfcResultSchema, pfcScores } from '../../domain/exerciseResults';
import { STANDARD_TUNING } from '../../domain/theory';
import { verifyStrum } from '../../dsp/modeB';
import { renderKnock } from '../../dsp/synth/knock';
import { testContext } from '../testing/fakes';
import { PfcRunner } from './runner';

const pairResult = (winner: 0 | 1 | null, verdict: 'PASS' | 'FAIL' = 'PASS') => ({
  pair: {
    winner,
    margin: winner === 0 ? 10 : -10,
    distractorWins: false,
    detectorVersion: 'x',
    processingMs: 1,
  },
  strum: winner === null ? null : { verdict },
});

describe('E3 precise fast change (SPEC v1.1 §11.11)', () => {
  it('with a microphone: arrivals from the change counter; Enter/↓ mark them; unmarked = not clean', () => {
    const t = testContext();
    const runner = new PfcRunner(t.ctx, { from: 'G-4f', to: 'Cadd9', durationMs: 60_000 }, voicingById);
    runner.start();
    expect(t.mic.job?.kind).toBe('pfc');
    expect(runner.snapshot().phase).toBe('armed');
    t.mic.strike(t.clock.t, pairResult(0)); // first strum: starts, stays at "from"
    t.clock.advance(0.1);
    // Arrivals: to(1) → mark clean, from(0) → mark not clean (↓), to(1) → left unmarked.
    for (const [k, w] of ([1, 0, 1] as const).entries()) {
      t.clock.advance(2);
      t.mic.strike(t.clock.t, pairResult(w, k === 1 ? 'FAIL' : 'PASS'));
      if (k === 0) runner.command('next');
      if (k === 1) runner.command('dec');
    }
    expect(runner.snapshot().view).toMatchObject({
      arrivals: 3,
      clean: 1,
      lastMark: null,
      lastStrumBeta: 'PASS',
    });
    t.output.run(t.clock, 60, () => runner.tick());
    expect(runner.snapshot().phase).toBe('review');
    runner.command('next');
    const result = pfcResultSchema.parse(runner.finish());
    expect(result).toMatchObject({
      pair: 'Cadd9|G-4f',
      direction: 'G-4f>Cadd9',
      arrivals: 3,
      cleanArrivals: 1,
    });
    expect(result.strumBeta).toEqual(['PASS', 'FAIL', 'PASS']);
    expect(runner.dspStats().events).toBe(4);
  });

  it('a body knock heard as an arrival records RETRY, not PASS or FAIL, in the strum beta (D-106)', () => {
    const fs = 48000;
    const onsetSample = Math.round(0.7 * fs);
    const samples = new Float32Array(onsetSample + fs);
    samples.set(renderKnock({ sampleRate: fs, durationS: 0.9, seed: 7 }), onsetSample);
    const strum = verifyStrum({
      samples,
      sampleRate: fs,
      onsetSample,
      voicing: voicingById('Cadd9'),
      tuning: STANDARD_TUNING,
    });
    expect(strum.reasons).toEqual(['NOT_STRING']);
    const t = testContext();
    const runner = new PfcRunner(t.ctx, { from: 'G-4f', to: 'Cadd9', durationMs: 60_000 }, voicingById);
    runner.start();
    t.mic.strike(t.clock.t, pairResult(0));
    t.clock.advance(2);
    t.mic.strike(t.clock.t, { pair: pairResult(1).pair, strum });
    expect(runner.snapshot().view).toMatchObject({ arrivals: 1, lastStrumBeta: 'RETRY' });
    runner.command('next');
    t.output.run(t.clock, 60, () => runner.tick());
    runner.command('next');
    expect(pfcResultSchema.parse(runner.finish()).strumBeta).toEqual(['RETRY']);
  });

  it('without a microphone each Enter or ↓ is an arrival; pass = clean rate ≥ 0.8 and ≥ 20/min', () => {
    const t = testContext({ mic: false });
    const runner = new PfcRunner(t.ctx, { from: 'A', to: 'D', durationMs: 60_000 }, voicingById);
    runner.start();
    runner.command('toggle');
    for (let i = 0; i < 24; i++) runner.command(i < 21 ? 'next' : 'dec');
    t.output.run(t.clock, 61, () => runner.tick());
    runner.command('next');
    const result = runner.finish();
    expect(result).toMatchObject({ source: 'self', arrivals: 24, cleanArrivals: 21, durationMs: 60_000 });
    expect(pfcScores(result)).toEqual({ cleanPerMin: 21, cleanRate: 21 / 24, passed: true });
    expect(extractMetrics('E3', result)).toEqual(
      expect.arrayContaining([
        { subjectKey: 'pfc:A>D', metric: 'cleanCpm', value: 21 },
        { subjectKey: 'pfc:A|D', metric: 'pass', value: 1 },
      ]),
    );
    expect(pfcScores({ arrivals: 30, cleanArrivals: 19, durationMs: 60_000 }).passed).toBe(false);
  });
});
