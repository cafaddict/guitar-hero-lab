import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { chordCheckResultSchema } from '../../domain/exerciseResults';
import { STANDARD_TUNING } from '../../domain/theory';
import type { PluckResult } from '../../dsp/modeA';
import { type StrumResult, verifyStrum } from '../../dsp/modeB';
import { renderKnock } from '../../dsp/synth/knock';
import type { Sensitivity } from '../../dsp/types';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { ChordCheckRunner, type E1Params } from './runner';

const C = voicingById('C'); // x32010: idx 0 (6th string) muted

function pluck(partial: Partial<PluckResult>): PluckResult {
  return {
    detectorVersion: DETECTOR_VERSION,
    confidence: 0.95,
    reasons: [],
    processingMs: 2,
    status: 'OK',
    verdict: 'PASS',
    f0: 130,
    cents: 1,
    semitones: 0,
    clarity: 0.95,
    decayRatio: 0.5,
    levelDb: 30,
    ...partial,
  };
}

function setup(
  params: Partial<E1Params> = {},
  options: { mic?: boolean; xStringCheck?: boolean; sensitivity?: Sensitivity } = {},
) {
  const t = testContext({ mic: options.mic ?? true });
  if (options.xStringCheck) t.ctx.settings = { ...t.ctx.settings, xStringCheck: true };
  if (options.sensitivity) t.ctx.settings = { ...t.ctx.settings, sensitivity: options.sensitivity };
  const runner = new ChordCheckRunner(
    t.ctx,
    { voicingId: 'C', blockMs: 120_000, mode: 'pluck', earFirst: false, ...params },
    C,
  );
  runner.start();
  /** Plucks the active string: coarse + judged onset now, judgement arrives 0.5 s later. */
  const strike = (result: unknown) => {
    const at = t.clock.t + 0.2;
    t.clock.advance(0.7);
    t.mic.strike(at, result);
  };
  return { ...t, runner, strike, view: () => runner.snapshot().view };
}

/** Mode B's own verdict on a body knock in a quiet take, on the voicing these tests practise. */
function strumOfKnock(): StrumResult {
  const fs = 48000;
  const onsetSample = Math.round(0.7 * fs);
  const samples = new Float32Array(onsetSample + fs);
  samples.set(renderKnock({ sampleRate: fs, durationS: 0.9, seed: 7 }), onsetSample);
  return verifyStrum({ samples, sampleRate: fs, onsetSample, voicing: C, tuning: STANDARD_TUNING });
}

describe('E1 chord check — string by string (Mode A)', () => {
  it('judges played strings low → high, skips the x string, records a clean attempt', () => {
    const { runner, mic, strike, view } = setup();
    expect(view().step).toBe('place');
    runner.command('next');
    expect(view().step).toBe('strings');
    expect(view().activeIdx).toBe(1); // 5th string; 6th (x) skipped
    expect(mic.job).toMatchObject({ kind: 'pluck', silent: false });
    expect((mic.job as { expectedF0: number }).expectedF0).toBeCloseTo(130.81, 1); // C3 on the 5th string
    for (const idx of [1, 2, 3, 4, 5]) {
      expect(view().activeIdx).toBe(idx);
      strike(pluck({}));
    }
    expect(view().step).toBe('release');
    expect(view().lastClean).toBe(true);
    expect(mic.job).toBeNull();
    const result = runner.finish();
    expect(chordCheckResultSchema.parse(result)).toEqual(result);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]!.perString.map((s) => s.status)).toEqual([
      'NOT_PLAYED',
      'OK',
      'OK',
      'OK',
      'OK',
      'OK',
    ]);
    expect(result.cleanRatio).toBe(1);
    expect(runner.dspStats()).toMatchObject({ detectorVersion: DETECTOR_VERSION, events: 5 });
    expect(runner.dspStats().meanProcessingMs).toBeGreaterThan(0);
  });

  it('a muted 2nd string fails the attempt with a coaching hint; the next attempt starts fresh', () => {
    const { runner, strike, view } = setup();
    runner.command('next');
    for (let k = 0; k < 3; k++) strike(pluck({}));
    expect(view().activeIdx).toBe(4);
    strike(pluck({ status: 'MUTED', verdict: 'FAIL', semitones: null }));
    strike(pluck({}));
    expect(view().lastClean).toBe(false);
    expect(view().strings[4]!.status).toBe('MUTED');
    expect(view().hints).toContainEqual({ code: 'mutedFretted', stringNo: 2, finger: 1 });
    runner.command('next');
    expect(view().step).toBe('place');
    expect(view().strings.every((s) => s.status === null)).toBe(true);
    expect(runner.finish().cleanRatio).toBe(0);
  });

  it('RETRY verdicts and multiple onsets keep the same string armed', () => {
    const { runner, mic, strike, view, clock } = setup();
    runner.command('next');
    strike(pluck({ status: 'WEAK', verdict: 'RETRY', reasons: ['LOW_LEVEL'] }));
    expect(view().activeIdx).toBe(1);
    expect(view().retry).toBe('LOW_LEVEL');
    // Two plucks 200 ms apart → ambiguous take.
    const at = clock.t + 0.1;
    mic.coarse.emit(at + 0.04);
    mic.coarse.emit(at + 0.25);
    clock.advance(0.8);
    mic.judged.emit({
      time: at,
      result: pluck({}),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 2,
    });
    expect(view().retry).toBe('MULTIPLE_ONSETS');
    expect(view().activeIdx).toBe(1);
    strike(pluck({}));
    expect(view().activeIdx).toBe(2);
    expect(view().retry).toBeNull();
  });

  it('ignores onsets from before the string was armed', () => {
    const { runner, mic, view, clock } = setup();
    runner.command('next');
    mic.judged.emit({
      time: clock.t - 1,
      result: pluck({}),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 2,
    });
    expect(view().activeIdx).toBe(1);
    expect(view().strings[1]!.status).toBeNull();
  });

  it('falls back to the energy onset after 4 s of silence, then asks again when nothing was found', async () => {
    const { runner, mic, view, clock } = setup();
    runner.command('next');
    const armedAt = clock.t;
    clock.advance(4.1);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(mic.fallbackRequests).toHaveLength(1);
    expect(mic.fallbackRequests[0]!.from).toBeCloseTo(armedAt - 0.15, 9);
    expect(view().retry).toBe('NO_ONSET');
    mic.fallbackResult = {
      time: clock.t + 1,
      result: pluck({}),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 3,
    };
    clock.advance(4.1);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(view().strings[1]!.status).toBe('OK');
    expect(view().activeIdx).toBe(2);
  });

  it('x-string check: the muted string is plucked and must stay silent', () => {
    const { runner, mic, strike, view } = setup({}, { xStringCheck: true });
    runner.command('next');
    expect(view().activeIdx).toBe(0);
    expect(mic.job).toMatchObject({ kind: 'pluck', silent: true });
    strike(pluck({ status: 'UNEXPECTED', verdict: 'FAIL' }));
    expect(view().strings[0]!.status).toBe('UNEXPECTED');
    for (const _ of [1, 2, 3, 4, 5]) strike(pluck({}));
    expect(view().lastClean).toBe(false);
    expect(view().hints).toContainEqual({ code: 'unexpectedXString', stringNo: 6, lowestStringNo: 5 });
  });
});

describe('E1 — ear first, manual, strum beta, timer', () => {
  it('ear first: the verdict is revealed only after the self judgement; agreement is recorded', () => {
    const { runner, strike, view } = setup({ earFirst: true });
    runner.command('next');
    strike(pluck({}));
    expect(view().strings[1]!.revealed).toBe(false);
    expect(view().awaitingSelf).toBe(true);
    runner.command('manual1');
    expect(view().strings[1]!.revealed).toBe(true);
    expect(view().activeIdx).toBe(2);
    // Self first, verdict later.
    runner.command('manual2');
    expect(view().activeIdx).toBe(2);
    strike(pluck({}));
    expect(view().activeIdx).toBe(3);
    for (const _ of [3, 4, 5]) {
      strike(pluck({}));
      runner.command('manual1');
    }
    const attempt = runner.finish().attempts[0]!;
    expect(attempt.selfAgreement).toBeCloseTo(4 / 5, 9);
    expect(attempt.perString[2]!.selfStatus).toBe('muted');
  });

  it('no microphone → manual mode with keys 1/2/3', () => {
    const { runner, view } = setup({ mode: 'pluck' }, { mic: false });
    expect(view().mode).toBe('manual');
    runner.command('next');
    for (const cmd of ['manual1', 'manual1', 'manual3', 'manual1', 'manual1'] as const) runner.command(cmd);
    expect(view().lastClean).toBe(false);
    const result = runner.finish();
    expect(result.mode).toBe('manual');
    expect(result.attempts[0]!.perString.map((s) => s.selfStatus)).toEqual([
      null,
      'clean',
      'clean',
      'buzz',
      'clean',
      'clean',
    ]);
    expect(runner.dspStats()).toEqual({ detectorVersion: null, meanProcessingMs: 0, events: 0 });
  });

  it('strum beta: one strum judged by Mode B, UNEXPECTED 6th string fails', () => {
    const { runner, mic, strike, view } = setup({ mode: 'strum' });
    runner.command('next');
    expect(view().step).toBe('strum');
    expect(mic.job).toMatchObject({ kind: 'strum' });
    const result: StrumResult = {
      detectorVersion: DETECTOR_VERSION,
      confidence: 0.8,
      reasons: [],
      processingMs: 9,
      verdict: 'FAIL',
      // Mode B lists the played strings only; the ringing x string comes back as an unexpected note.
      strings: [1, 2, 3, 4, 5].map((idx) => ({
        idx,
        status: idx >= 4 ? 'UNVERIFIABLE' : 'OK',
        salienceDb: 20,
        decayDb: 0,
        relLateDb: 0,
        verifiable: idx < 4,
      })),
      unexpected: [{ idx: 0, midi: 40, salienceDb: 20, lateDb: 10 }],
      blamed: [0],
      referenceDb: 50,
    };
    strike(result);
    expect(view().step).toBe('release');
    expect(view().strumVerdict).toBe('FAIL');
    expect(view().strings[0]!.status).toBe('UNEXPECTED');
    expect(view().hints).toContainEqual({ code: 'unexpectedXString', stringNo: 6, lowestStringNo: 5 });
    const r = runner.finish();
    expect(r.attempts[0]!.strumVerdict).toBe('FAIL');
    expect(r.attempts[0]!.clean).toBe(false);
  });

  it('the block timer ends the exercise; abort ends it early', () => {
    const { runner, clock, view } = setup({ blockMs: 60_000 });
    runner.command('next');
    clock.advance(59);
    runner.tick();
    expect(runner.snapshot().phase).toBe('running');
    clock.advance(1.5);
    runner.tick();
    expect(runner.snapshot().phase).toBe('done');
    expect(view().activeIdx).toBeNull();
    const other = setup();
    other.runner.command('abort');
    expect(other.runner.snapshot().phase).toBe('done');
  });

  it('Next skips a string that cannot be judged (marked unverified)', () => {
    const { runner, strike, view } = setup();
    runner.command('next');
    runner.command('next'); // skip the 5th string
    expect(view().strings[1]!.status).toBe('UNVERIFIABLE');
    expect(view().activeIdx).toBe(2);
    for (let k = 0; k < 4; k++) strike(pluck({}));
    expect(view().step).toBe('release');
    expect(runner.finish().attempts[0]!.perString[1]!.status).toBe('UNVERIFIABLE');
  });

  it('prev takes the latest skip back (D-096): that string is judged again, later verdicts stay', () => {
    const { runner, mic, strike, view } = setup();
    runner.command('next');
    expect(runner.canStepBack()).toBe(false);
    runner.command('next'); // skip the 5th string
    strike(pluck({})); // 4th string OK
    expect(view().activeIdx).toBe(3);
    expect(runner.canStepBack()).toBe(true);
    runner.command('prev');
    expect(view().activeIdx).toBe(1);
    expect(view().strings[1]).toMatchObject({ status: null, revealed: false });
    expect(view().strings[2]!.status).toBe('OK');
    expect((mic.job as { expectedF0: number }).expectedF0).toBeCloseTo(130.81, 1);
    expect(runner.canStepBack()).toBe(false);
    strike(pluck({})); // 5th string judged now; the 4th is not asked again
    expect(view().activeIdx).toBe(3);
    for (let k = 0; k < 3; k++) strike(pluck({}));
    expect(view().step).toBe('release');
    expect(runner.finish().attempts[0]!.perString.map((s) => s.status)).toEqual([
      'NOT_PLAYED',
      'OK',
      'OK',
      'OK',
      'OK',
      'OK',
    ]);
  });

  it('an attempt completed by a skip is final: prev is impossible after it', () => {
    const { runner, strike, view } = setup();
    runner.command('next');
    for (let k = 0; k < 4; k++) strike(pluck({}));
    runner.command('next'); // skip the 1st string: the attempt completes
    expect(view().step).toBe('release');
    expect(runner.canStepBack()).toBe(false);
    runner.command('prev');
    expect(view().step).toBe('release');
    expect(runner.finish().attempts).toHaveLength(1);
  });

  it('x-string check: total silence (no onset at all) is the expected result', async () => {
    const { runner, mic, view, clock } = setup({}, { xStringCheck: true });
    runner.command('next');
    expect(view().activeIdx).toBe(0);
    clock.advance(3.6);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(mic.fallbackRequests).toHaveLength(1);
    expect(view().strings[0]!.status).toBe('OK');
    expect(view().activeIdx).toBe(1);
  });

  it('strum beta: the same RETRY twice in a row suggests checking string by string', () => {
    const { runner, strike, view } = setup({ mode: 'strum' });
    runner.command('next');
    const retry = {
      detectorVersion: DETECTOR_VERSION,
      confidence: 0,
      reasons: ['AMBIGUOUS'],
      processingMs: 5,
      verdict: 'RETRY',
      strings: [],
      unexpected: [],
      blamed: [],
      referenceDb: 0,
    };
    strike(retry);
    expect(view().suggestPluck).toBe(false);
    strike(retry);
    expect(view().suggestPluck).toBe(true);
    expect(view().retry).toBe('AMBIGUOUS');
  });

  it('strum beta: a real body knock is a retry of the strum, records no verdict and stays armed (D-106)', () => {
    const { runner, mic, strike, view } = setup({ mode: 'strum' });
    runner.command('next');
    const knock = strumOfKnock();
    expect(knock.verdict).toBe('RETRY');
    expect(knock.reasons).toEqual(['NOT_STRING']);
    strike(knock);
    expect(view().step).toBe('strum');
    expect(view().retry).toBe('NOT_STRING');
    expect(view().strumVerdict).toBeNull();
    expect(view().strings.every((s) => s.status === null)).toBe(true);
    expect(mic.job).toMatchObject({ kind: 'strum' });
    expect(runner.hasResult()).toBe(false);
    strike(knock);
    expect(view().suggestPluck).toBe(true);
    expect(view().step).toBe('strum');
    expect(runner.hasResult()).toBe(false);
  });

  it('nothing is recorded when no attempt was completed', () => {
    const { runner } = setup();
    runner.command('next');
    runner.command('abort');
    expect(runner.hasResult()).toBe(false);
  });
});

describe('E1 string by string: knocks, ringing strings and quick plucks (D-073, D-074, D-076)', () => {
  const knock = (fastDecay = true) =>
    pluck({ status: 'WEAK', verdict: 'RETRY', reasons: ['NOT_STRING'], ...(fastDecay ? { fastDecay } : {}) });

  it('a non-string sound keeps the string armed; heard again on the same string it counts as MUTED', () => {
    const { runner, strike, view } = setup();
    runner.command('next');
    strike(knock());
    expect(view().activeIdx).toBe(1);
    expect(view().retry).toBe('NOT_STRING');
    expect(view().strings[1]!.status).toBeNull();
    strike(knock());
    expect(view().strings[1]!.status).toBe('MUTED');
    expect(view().activeIdx).toBe(2);
  });

  it('"둔감" tolerates two non-string sounds before MUTED; a loud non-string retry never becomes MUTED', () => {
    const low = setup({}, { sensitivity: 'low' });
    low.runner.command('next');
    low.strike(knock());
    low.strike(knock());
    expect(low.view().strings[1]!.status).toBeNull();
    low.strike(knock());
    expect(low.view().strings[1]!.status).toBe('MUTED');
    const normal = setup();
    normal.runner.command('next');
    for (let k = 0; k < 4; k++) normal.strike(knock(false));
    expect(normal.view().strings[1]!.status).toBeNull();
    expect(normal.view().retry).toBe('NOT_STRING');
  });

  it('"둔감": a quiet sound keeps listening without a message', () => {
    const { runner, strike, view } = setup({}, { sensitivity: 'low' });
    runner.command('next');
    strike(pluck({ status: 'WEAK', verdict: 'RETRY', reasons: ['LOW_LEVEL'] }));
    expect(view().activeIdx).toBe(1);
    expect(view().retry).toBeNull();
  });

  it('the job carries the sensitivity and the strings still ringing (not muted ones, not the active one)', () => {
    const { runner, mic, strike, clock } = setup({}, { sensitivity: 'high' });
    runner.command('next');
    expect(mic.job).toMatchObject({ kind: 'pluck', sensitivity: 'high', ringing: [] });
    const first = clock.t + 0.2;
    strike(pluck({ f0: 131 }));
    expect(mic.job).toMatchObject({ ringing: [{ f0: 131, sample: Math.round(first * 48000) }] });
    strike(pluck({ status: 'MUTED', verdict: 'FAIL', f0: 164 }));
    expect((mic.job as { ringing: { f0: number }[] }).ringing.map((r) => r.f0)).toEqual([131]);
    strike(pluck({ f0: 196 }));
    strike(pluck({ f0: 262 }));
    expect((mic.job as { ringing: { f0: number }[] }).ringing.map((r) => r.f0)).toEqual([131, 196, 262]);
  });

  it('a pluck right after the previous verdict window is taken for the next string', () => {
    const { runner, mic, view, clock } = setup();
    runner.command('next');
    const judged = (time: number, result: PluckResult) =>
      mic.judged.emit({ time, result, jobKind: 'pluck', detectorVersion: DETECTOR_VERSION, processingMs: 2 });
    clock.advance(1);
    const first = clock.t;
    clock.advance(0.55); // the verdict arrives ~0.5 s after the pluck
    judged(first, pluck({ f0: 131 }));
    expect(view().activeIdx).toBe(2);
    // The next string was plucked 0.42 s after the first, before its own job was even set.
    clock.advance(0.5);
    judged(first + 0.42, pluck({ f0: 165, expectedF0: (mic.job as { expectedF0: number }).expectedF0 }));
    expect(view().strings[2]!.status).toBe('OK');
    expect(view().activeIdx).toBe(3);
  });

  it('a take judged against the previous string is judged again for this one', () => {
    const { runner, mic, view, clock } = setup();
    runner.command('next');
    const fifth = (mic.job as { expectedF0: number }).expectedF0;
    clock.advance(1);
    const first = clock.t;
    clock.advance(0.55);
    mic.judged.emit({
      time: first,
      result: pluck({ f0: 131 }),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 2,
    });
    clock.advance(0.5);
    mic.judged.emit({
      time: first + 0.42,
      result: pluck({ status: 'WRONG_NOTE', verdict: 'FAIL', expectedF0: fifth }),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 2,
    });
    expect(view().strings[2]!.status).toBeNull();
    expect(mic.fallbackRequests).toHaveLength(1);
    expect(mic.fallbackRequests[0]!.from).toBeCloseTo(first + 0.42 - 0.15, 9);
    expect(mic.fallbackRequests[0]!.expectedF0).not.toBeCloseTo(fifth, 3);
  });

  it('the x-string fallback is judged as an x string (silent check)', async () => {
    const { runner, mic, clock } = setup({}, { xStringCheck: true });
    runner.command('next');
    clock.advance(3.6);
    runner.tick();
    await Promise.resolve();
    expect(mic.fallbackRequests[0]).toMatchObject({ silent: true, sensitivity: 'normal' });
  });
});
