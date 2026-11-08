import { describe, expect, it } from 'vitest';
import { extractMetrics, type ScaleResult, scaleResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { nextScaleRun } from './plugin';
import { type E10Params, e10ParamsSchema, ScaleRunner } from './runner';

const params = (over: Partial<E10Params> = {}): E10Params =>
  e10ParamsSchema.parse({ scaleId: 'em-pent-open', ...over });

/** Runs the fake clock in 25 ms steps, ticking the runner and letting the fake worker answer. */
async function play(t: ReturnType<typeof testContext>, runner: ScaleRunner, seconds: number) {
  for (let s = 0; s < seconds; s += 0.025) {
    t.output.run(t.clock, 0.025);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
  }
}

/** A backing with one event per beat (P0) for the intro bar and 32 bars at 80 BPM. */
const beatBacking = () => ({
  signal: new Float32Array(16),
  events: Array.from({ length: 33 * 4 }, (_, k) => ({ time: k * 0.75, kind: 'strum' as const })),
});

describe('E10 scale ladder (SPEC v1.1 §11.13)', () => {
  it('with a microphone: cycles are judged in chunks; 4 flawless at 80 BPM graduate the step', async () => {
    const t = testContext();
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80 }));
    runner.start();
    runner.command('toggle');
    // Step 1 of Em pentatonic = 23 notes; 4 cycles at 80 BPM ≈ 69 s (+ count-in).
    await play(t, runner, 75);
    runner.command('toggle');
    await play(t, runner, 2);
    expect(runner.snapshot().phase).toBe('done');
    const result = scaleResultSchema.parse(runner.finish());
    expect(result.cycles.length).toBeGreaterThanOrEqual(4);
    expect(result.cycles.every((c) => c.flawless && c.okRatio === 1)).toBe(true);
    expect(result).toMatchObject({ source: 'mic', graduated: true, ladder: 'up', memorized: false });
    for (const r of t.mic.sequenceRequests) expect(r.to - r.from).toBeLessThanOrEqual(3.2 + 1e-9);
    expect(runner.dspStats().detectorVersion).toBe(DETECTOR_VERSION);
    expect(extractMetrics('E10', result)).toEqual(
      expect.arrayContaining([
        { subjectKey: 'scale:em-pent-open:s1', metric: 'streakBpm', value: 80 },
        { subjectKey: 'scale:em-pent-open:s1', metric: 'ladderBpm', value: 85 },
      ]),
    );
  });

  it('a wrong note breaks the streak and is shown with its position and semitones', async () => {
    const t = testContext();
    let seen = 0;
    t.mic.sequenceResponder = (request) => ({
      notes: request.slots.map((s, i) =>
        ++seen === 5
          ? { slot: i, status: 'WRONG_NOTE', semitones: -1, cents: -100, onsetTime: s.time }
          : { slot: i, status: 'OK', cents: 0, onsetTime: s.time },
      ),
      extras: [],
    });
    const runner = new ScaleRunner(t.ctx, params({ scaleId: 'c-major-open', bpm: 60 }));
    runner.start();
    runner.command('toggle');
    await play(t, runner, 40);
    runner.command('toggle');
    await play(t, runner, 2);
    const result = runner.finish();
    const faulty = result.cycles.find((c) => !c.flawless)!;
    expect(faulty.faults).toEqual([{ index: 4, status: 'WRONG_NOTE', semitones: -1 }]);
    expect(t.mic.sequenceRequests.some((r) => r.slots.length > 1)).toBe(true);
    expect(result.graduated).toBe(false);
  });

  it('without a microphone: self-reported cycles; TAB hidden throughout + 4 flawless at step 1 = memorized', () => {
    const t = testContext({ mic: false });
    const runner = new ScaleRunner(t.ctx, params({ scaleId: 'c-major-open', tabHidden: true }));
    runner.start();
    runner.command('toggle');
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('next');
    const result = runner.finish();
    expect(result).toMatchObject({ source: 'self', memorized: true, hiddenThroughout: true, ladder: 'up' });
    expect(extractMetrics('E10', result)).toEqual(
      expect.arrayContaining([{ subjectKey: 'scale:c-major-open:memorized', metric: 'memorized', value: 1 }]),
    );
  });

  it('showing the TAB while playing (H) means not memorized', () => {
    const t = testContext({ mic: false });
    const runner = new ScaleRunner(t.ctx, params({ scaleId: 'c-major-open', tabHidden: true }));
    runner.start();
    runner.command('toggle');
    runner.command('hide');
    runner.command('hide');
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ memorized: false, hiddenThroughout: false });
  });

  it('backing on speakers (D-102): the bleed is masked and the run records — graduation, metrics, next run; E = earphones', async () => {
    const rttS = 0.05;
    const speakers = testContext();
    speakers.ctx.calibration = { rttMs: rttS * 1000 } as NonNullable<typeof speakers.ctx.calibration>;
    const runner = new ScaleRunner(speakers.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    expect(runner.snapshot().view).toMatchObject({ earphones: false, backingAudible: true });
    runner.command('toggle');
    await play(speakers, runner, 75);
    runner.command('toggle');
    await play(speakers, runner, 2);
    const result = scaleResultSchema.parse(runner.finish());
    expect(result.cycles.filter((c) => c.flawless).length).toBeGreaterThanOrEqual(4);
    expect(result.backingAudible).toBeUndefined();
    expect(result).toMatchObject({ graduated: true, ladder: 'up' });
    expect(extractMetrics('E10', result)).toEqual(
      expect.arrayContaining([{ subjectKey: 'scale:em-pent-open:s1', metric: 'streakBpm', value: 80 }]),
    );
    expect(nextScaleRun(params(), [result])).toMatchObject({ step: 2, bpm: 60 });
    // The gain is measured once, over the intro (count-in) bar; every chunk then carries the backing events in it.
    const grid = speakers.output.metronome.gridStartTime()!;
    const start = grid - (4 * 60) / 80;
    expect(speakers.mic.bleedRequests).toHaveLength(1);
    expect(speakers.mic.bleedRequests[0]!.arrivals).toEqual([0, 1, 2, 3].map((k) => start + k * 0.75 + rttS));
    expect(speakers.mic.sequenceRequests.length).toBeGreaterThan(0);
    for (const r of speakers.mic.sequenceRequests) {
      expect(r.backing?.gain).toBe(speakers.mic.bleedGain);
      expect(r.backing!.arrivals.length).toBeGreaterThan(0);
      for (const a of r.backing!.arrivals) {
        expect(a).toBeGreaterThanOrEqual(r.from - 0.1);
        expect(a).toBeLessThanOrEqual(r.to + 0.1);
        // Every arrival is a backing beat heard through the microphone: start + k beats + RTT.
        const beats = (a - start - rttS) / 0.75;
        expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6);
      }
    }

    const earphones = testContext();
    const confirmed = new ScaleRunner(earphones.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    confirmed.start();
    confirmed.command('ear');
    expect(confirmed.snapshot().view).toMatchObject({ earphones: true, backingAudible: false });
    expect(confirmed.effectiveParams().earphones).toBe(true);
    confirmed.command('toggle');
    await play(earphones, confirmed, 75);
    confirmed.command('toggle');
    await play(earphones, confirmed, 2);
    expect(confirmed.finish()).toMatchObject({ graduated: true });
    expect(earphones.mic.bleedRequests).toEqual([]);
    expect(earphones.mic.sequenceRequests.every((r) => r.backing === undefined)).toBe(true);
  });

  it('test_speakerBacking_beforeTheBleedGainIsKnown_noChunkIsJudged', async () => {
    const t = testContext();
    let answer: (gain: number) => void = () => {};
    t.mic.measureBleedGain = () => new Promise<number>((resolve) => (answer = resolve));
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 10);
    expect(t.mic.sequenceRequests).toEqual([]);
    answer(0.02);
    await play(t, runner, 5);
    expect(t.mic.sequenceRequests.length).toBeGreaterThan(0);
    expect(t.mic.sequenceRequests.every((r) => r.backing?.gain === 0.02)).toBe(true);
    runner.command('abort');
  });

  it('test_speakerBacking_gainMeasurementKeepsFailing_retriesStopAndNoChunkIsSent', async () => {
    const t = testContext();
    let attempts = 0;
    t.mic.measureBleedGain = () => {
      attempts++;
      return Promise.reject(new Error('microphone is not running'));
    };
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 10);
    expect(attempts).toBe(3);
    expect(t.mic.sequenceRequests).toEqual([]);
    runner.command('abort');
  });

  it('test_speakerBacking_gainFailsAfterTheIntroLeftTheRing_noRetry', async () => {
    const t = testContext();
    let attempts = 0;
    let fail: (error: Error) => void = () => {};
    t.mic.measureBleedGain = () => {
      attempts++;
      return new Promise<number>((_, reject) => (fail = reject));
    };
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    // The engine's timeout: 5 s after the intro's end, when the ring has moved on and the intro would read as silence.
    await play(t, runner, 8.1);
    fail(new Error('range capture timed out'));
    await play(t, runner, 3);
    expect(attempts).toBe(1);
    runner.command('abort');
  });

  it('test_speakerBacking_retryDueAfterTheIntroLeftTheRing_isNotSentAndCountsAsFailed', async () => {
    const t = testContext();
    let attempts = 0;
    let fail: (error: Error) => void = () => {};
    let introFrom = 0;
    t.mic.measureBleedGain = (request) => {
      attempts++;
      introFrom = request.from;
      return attempts === 1 ? new Promise<number>((_, reject) => (fail = reject)) : Promise.resolve(0); // What the worker answers for an intro no longer in the ring.
    };
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 0.1);
    await play(t, runner, introFrom + 3 - t.clock.audio());
    fail(new Error('microphone is not running'));
    await Promise.resolve();
    await Promise.resolve();
    expect(runner.snapshot().view.gainLost).toBe(false);
    // The retry is due in 0.5 s, but the tab stalls and the next tick comes 5 s later.
    t.output.run(t.clock, 5);
    runner.tick();
    await play(t, runner, 1);
    expect(attempts).toBe(1);
    expect(runner.snapshot().view.gainLost).toBe(true);
    expect(t.mic.sequenceRequests).toEqual([]);
    runner.command('abort');
  });

  it('test_speakerBacking_retryDueWhileTheIntroIsInTheRing_isSent', async () => {
    const t = testContext();
    let attempts = 0;
    t.mic.measureBleedGain = () => {
      attempts++;
      return attempts === 1 ? Promise.reject(new Error('microphone is not running')) : Promise.resolve(0.02);
    };
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 6);
    expect(attempts).toBe(2);
    expect(runner.snapshot().view.gainLost).toBe(false);
    expect(t.mic.sequenceRequests.every((r) => r.backing?.gain === 0.02)).toBe(true);
    runner.command('abort');
  });

  it('test_speakerBacking_gainLostThenResumed_hintLeavesWithTheNewIntroAndStaysOffOnceMeasured', async () => {
    const t = testContext();
    let failing = true;
    t.mic.measureBleedGain = () =>
      failing ? Promise.reject(new Error('range capture timed out')) : Promise.resolve(0.02);
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 8);
    expect(runner.snapshot().view.gainLost).toBe(true);
    runner.command('pause');
    await play(t, runner, 1);
    expect(runner.snapshot().view.gainLost).toBe(true);
    failing = false;
    runner.command('toggle');
    await play(t, runner, 6);
    expect(runner.snapshot().view.gainLost).toBe(false);
    expect(t.mic.sequenceRequests.length).toBeGreaterThan(0);
    runner.command('abort');
  });

  it('test_earphoneBacking_viewNeverShowsTheGainHint', async () => {
    const t = testContext();
    const runner = new ScaleRunner(
      t.ctx,
      params({ bpm: 80, withBacking: true, earphones: true }),
      beatBacking,
    );
    runner.start();
    runner.command('toggle');
    await play(t, runner, 6);
    expect(runner.snapshot().view.gainLost).toBe(false);
    runner.command('abort');
  });

  it('test_speakerBacking_gainNeverMeasured_cyclesAreUncertainNeverAMistakeOrFlawless', async () => {
    const t = testContext();
    t.mic.measureBleedGain = () => Promise.reject(new Error('range capture timed out'));
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    // Two 23-note cycles at 80 BPM (34.5 s) after the count-in, then the run ends and the last slots settle.
    await play(t, runner, 3 + 36);
    runner.command('toggle');
    await play(t, runner, 3);
    expect(runner.snapshot().phase).toBe('done');
    const result = scaleResultSchema.parse(runner.finish());
    expect(result.cycles.length).toBeGreaterThanOrEqual(2);
    for (const c of result.cycles) {
      expect(c).toMatchObject({ flawless: false, uncertain: true });
      expect(c.faults!.every((f) => f.status === 'UNCLEAR')).toBe(true);
    }
    expect(result).toMatchObject({ graduated: false, memorized: false, ladder: 'stay' });
    expect(t.mic.sequenceRequests).toEqual([]);
  });

  it('test_speakerBacking_gainFailedThenResumed_theNewIntroMeasuresItAndChunksAreJudged', async () => {
    const t = testContext();
    let failing = true;
    let attempts = 0;
    t.mic.measureBleedGain = () => {
      attempts++;
      return failing ? Promise.reject(new Error('range capture timed out')) : Promise.resolve(0.02);
    };
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 8);
    expect(attempts).toBe(3);
    runner.command('pause');
    await play(t, runner, 1);
    failing = false;
    runner.command('pause');
    await play(t, runner, 10);
    runner.command('abort');
    expect(attempts).toBe(4);
    expect(t.mic.sequenceRequests.length).toBeGreaterThan(0);
    for (const r of t.mic.sequenceRequests) expect(r.backing?.gain).toBe(0.02);
  });

  it('test_speakerBacking_pausedInTheCountInWithoutAGain_nothingIsSentUnmasked', async () => {
    const t = testContext();
    let answer: (gain: number) => void = () => {};
    t.mic.measureBleedGain = () => new Promise<number>((resolve) => (answer = resolve));
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 1);
    runner.command('pause');
    await play(t, runner, 1);
    answer(0.02); // Measured over an intro that was cut: ignored.
    runner.command('pause');
    await play(t, runner, 8);
    expect(t.mic.sequenceRequests).toEqual([]);
    answer(0.03);
    await play(t, runner, 4);
    runner.command('abort');
    expect(t.mic.sequenceRequests.length).toBeGreaterThan(0);
    for (const r of t.mic.sequenceRequests) expect(r.backing?.gain).toBe(0.03);
  });

  it('test_speakerBacking_pausedWhileTheGainIsOnItsWay_slotsBeforeThePauseAreNotJudgedUnmasked', async () => {
    const t = testContext();
    let answer: (gain: number) => void = () => {};
    t.mic.measureBleedGain = () => new Promise<number>((resolve) => (answer = resolve));
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 5); // Past the count-in, the first notes played.
    runner.command('pause');
    await play(t, runner, 2);
    expect(t.mic.sequenceRequests).toEqual([]);
    answer(0.02); // The intro was heard in full: the answer still holds.
    await play(t, runner, 1);
    runner.command('abort');
    for (const r of t.mic.sequenceRequests) expect(r.backing?.gain).toBe(0.02);
  });

  it('test_speakerBacking_pauseAndResume_maskHoldsOnlyTheBackingEventsActuallyPlayed', async () => {
    const t = testContext();
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80, withBacking: true }), beatBacking);
    runner.start();
    runner.command('toggle');
    await play(t, runner, 8);
    runner.command('pause');
    const pausedAt = t.clock.t;
    await play(t, runner, 3);
    runner.command('pause');
    await play(t, runner, 12);
    runner.command('abort');
    const resumedGrid = t.output.metronome.gridStartTime()!;
    // The first backing's events after the pause never played: no chunk masks them; the gain is not re-measured.
    for (const r of t.mic.sequenceRequests)
      for (const a of r.backing?.arrivals ?? [])
        expect(a <= pausedAt + 1e-9 || a >= resumedGrid - (4 * 60) / 80 - 1e-9).toBe(true);
    expect(t.mic.bleedRequests).toHaveLength(1);
    expect(t.mic.sequenceRequests.some((r) => r.slots[0]!.time > resumedGrid)).toBe(true);
  });

  it('next run: graduated → next step at 60; otherwise the ladder tempo; review plays the step under review at 80', () => {
    const base = (over: Partial<ScaleResult>): ScaleResult => ({
      scaleId: 'em-pent-open',
      step: 1,
      bpm: 70,
      tabHidden: false,
      hiddenThroughout: false,
      withBacking: false,
      cycles: [],
      ladder: 'stay',
      graduated: false,
      memorized: false,
      source: 'self',
      ...over,
    });
    expect(nextScaleRun(params(), [])).toMatchObject({ step: 1, bpm: 60 });
    expect(nextScaleRun(params(), [base({ bpm: 80, graduated: true, ladder: 'up' })])).toMatchObject({
      step: 2,
      bpm: 60,
    });
    expect(nextScaleRun(params(), [base({ bpm: 70, ladder: 'up' })])).toMatchObject({ step: 1, bpm: 75 });
    // A review of a graduated step does not restart the step being climbed (M13 simulation finding).
    expect(
      nextScaleRun(params(), [
        base({ step: 1, bpm: 80, graduated: true, ladder: 'up', review: true }),
        base({ step: 2, bpm: 60, ladder: 'up' }),
      ]),
    ).toMatchObject({ step: 2, bpm: 65 });
    expect(
      nextScaleRun(params({ review: true, step: 1 }), [
        base({ step: 2, graduated: true }),
        base({ step: 1, graduated: true }),
      ]),
    ).toMatchObject({ step: 1, bpm: 80 });
  });

  it('a low run keeps the step and the tempo: no step down (D-098)', () => {
    const run = (flawless: boolean[], pauses?: number): ScaleResult => ({
      scaleId: 'em-pent-open',
      step: 1,
      bpm: 70,
      tabHidden: false,
      hiddenThroughout: false,
      withBacking: false,
      cycles: flawless.map((f) => ({ flawless: f, uncertain: false, stops: 0, okRatio: null })),
      ladder: 'stay',
      graduated: false,
      memorized: false,
      source: 'self',
      ...(pauses === undefined ? {} : { pauses }),
    });
    const low = [false, false, true];
    const good = [true, true, true];
    expect(nextScaleRun(params(), [run(low), run(low)])).toMatchObject({ step: 1, bpm: 70 });
    expect(nextScaleRun(params(), [run(low, 1), run(good)])).toMatchObject({ step: 1, bpm: 70 });
    expect(nextScaleRun(params(), [run(good, 1), run(low)])).toMatchObject({ step: 1, bpm: 70 });
    expect(nextScaleRun(params(), [run(low, 1)])).toMatchObject({ step: 1, bpm: 70 });
  });

  it('↑/↓ in ready pick the tempo (D-098); the backing renders at it; a review keeps the graduation tempo', async () => {
    const rendered: number[] = [];
    const backing = (_chords: readonly string[], _pattern: string, bpm: number) => {
      rendered.push(bpm);
      return { signal: new Float32Array(16), events: [] };
    };
    const t = testContext();
    const runner = new ScaleRunner(t.ctx, params({ bpm: 70, withBacking: true }), backing);
    runner.start();
    expect(runner.snapshot().view.tempoPickable).toBe(true);
    runner.command('dec');
    runner.command('toggle');
    expect(rendered).toEqual([65]);
    await play(t, runner, 2);
    expect(t.output.lastConfig?.bpm).toBe(65);
    // The backing starts one bar (four beats at 65 BPM) before the grid.
    const grid = t.output.metronome.gridStartTime()!;
    expect(t.output.backings[0]!.at).toBeCloseTo(grid - (4 * 60) / 65, 9);
    expect(runner.effectiveParams().bpm).toBe(65);
    runner.command('abort');

    const review = testContext({ mic: false });
    const reviewRun = new ScaleRunner(review.ctx, params({ bpm: 80, review: true }));
    reviewRun.start();
    expect(reviewRun.snapshot().view.tempoPickable).toBe(false);
    reviewRun.command('dec');
    expect(reviewRun.snapshot().view.bpm).toBe(80);
  });

  it('a picked tempo counts for graduation as played (D-098): four flawless at 80 after picking up from 75', () => {
    const t = testContext({ mic: false });
    const runner = new ScaleRunner(t.ctx, params({ bpm: 75 }));
    runner.start();
    runner.command('inc');
    runner.command('toggle');
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ bpm: 80, graduated: true, ladder: 'up' });
  });
});
