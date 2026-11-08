/** The hint of a lost bleed gain on the E10 screen (D-102): a failed run says why its cycles are uncertain. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { e10Plugin } from './plugin';
import { type E10Params, e10ParamsSchema, ScaleRunner } from './runner';

const params = (over: Partial<E10Params> = {}): E10Params =>
  e10ParamsSchema.parse({ scaleId: 'em-pent-open', bpm: 80, withBacking: true, ...over });

const backing = () => ({
  signal: new Float32Array(16),
  events: Array.from({ length: 33 * 4 }, (_, k) => ({ time: k * 0.75, kind: 'strum' as const })),
});

function take(over: Partial<E10Params> = {}) {
  const t = testContext();
  const runner = new ScaleRunner(t.ctx, params(over), backing);
  const shown = () =>
    renderToStaticMarkup(<e10Plugin.View runner={runner} params={params(over)} ctx={t.ctx} />).includes(
      ko.exercises.e10.gainLost,
    );
  const play = async (seconds: number) => {
    for (let s = 0; s < seconds; s += 0.025) {
      t.output.run(t.clock, 0.025);
      runner.tick();
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  return { t, runner, shown, play };
}

describe('E10 speaker backing: the lost-gain hint (D-102)', () => {
  it('test_e10View_everyMeasurementFails_hintAppearsOnlyAfterTheLastAttempt', async () => {
    const { t, runner, shown, play } = take();
    let attempts = 0;
    t.mic.measureBleedGain = () => {
      attempts++;
      return Promise.reject(new Error('range capture timed out'));
    };
    runner.start();
    runner.command('toggle');
    while (attempts < 3) {
      expect(shown()).toBe(false);
      await play(0.025);
    }
    await play(0.1);
    expect(attempts).toBe(3);
    expect(shown()).toBe(true);
    runner.command('abort');
  });

  it('test_e10View_measurementFailsOnceThenSucceeds_hintNeverAppears', async () => {
    const { t, runner, shown, play } = take();
    let attempts = 0;
    t.mic.measureBleedGain = () => {
      attempts++;
      return attempts === 1 ? Promise.reject(new Error('range capture timed out')) : Promise.resolve(0.02);
    };
    runner.start();
    runner.command('toggle');
    for (let i = 0; i < 24; i++) {
      await play(0.25);
      expect(shown()).toBe(false);
    }
    expect(attempts).toBe(2);
    runner.command('abort');
  });

  it('test_e10View_gainLostThenResumedAndMeasured_hintLeaves', async () => {
    const { t, runner, shown, play } = take();
    let failing = true;
    t.mic.measureBleedGain = () =>
      failing ? Promise.reject(new Error('range capture timed out')) : Promise.resolve(0.02);
    runner.start();
    runner.command('toggle');
    await play(8);
    expect(shown()).toBe(true);
    runner.command('pause');
    await play(1);
    expect(shown()).toBe(true);
    failing = false;
    runner.command('toggle');
    await play(1);
    expect(shown()).toBe(false);
    runner.command('abort');
  });

  it('test_e10View_earphones_hintNeverAppears', async () => {
    const { runner, shown, play } = take({ earphones: true });
    runner.start();
    runner.command('toggle');
    await play(6);
    expect(shown()).toBe(false);
    runner.command('abort');
  });
});
