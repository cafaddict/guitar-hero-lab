/** S pause / resume / restart (D-085): a pause is a stop, the interrupted bar is replayed, R starts over. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { songResultSchema } from '../../domain/exerciseResults';
import type { TimingSlot } from '../../dsp/timing';
import { DETECTOR_VERSION } from '../../dsp/version';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { songPlugin } from './plugin';
import { type BackingRenderer, type SongParamsInput, SongRunner, songStops } from './runner';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** s01 = D D A A ×4 (16 bars) at 60 BPM: one bar = 4 s. */
const BAR_S = 4;
const BARS = 16;

const params = (over: Partial<SongParamsInput> = {}): SongParamsInput => ({
  songId: 's01',
  mode: 'perform',
  bpm: 60,
  chartHidden: false,
  loopSection: null,
  ...over,
});

/** One event per beat of every bar (intro included), fast: no audio. */
const fakeBacking: BackingRenderer = (chords, _pattern, bpm) => ({
  signal: new Float32Array(48000),
  events: Array.from({ length: chords.length * 4 }, (_, k) => ({
    time: (k * 60) / bpm,
    kind: 'strum' as const,
  })),
});

/**
 * A take driven by the fake clock: strums are judged 0.45 s after they are played (with the job the runner
 * set), and the runner ticks every 25 ms.
 */
function take(options: { mic?: boolean; over?: Partial<SongParamsInput>; backing?: BackingRenderer } = {}) {
  const t = testContext({ mic: options.mic ?? true });
  const runner = new SongRunner(
    t.ctx,
    params(options.over),
    () => new Float32Array(1),
    options.backing ?? null,
  );
  const slots: (readonly TimingSlot[])[] = [];
  const analyze = t.mic.analyzeTiming.bind(t.mic);
  t.mic.analyzeTiming = (request) => {
    slots.push(request.slots);
    return analyze(request);
  };
  const pending: number[] = [];
  const strum = (...times: number[]) => {
    pending.push(...times);
    pending.sort((a, b) => a - b);
  };
  const runTo = (time: number) =>
    t.output.run(t.clock, time - t.clock.t, () => {
      while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
        t.mic.judged.emit({
          time: pending.shift()!,
          result: null,
          jobKind: t.mic.job?.kind ?? 'onsets',
          detectorVersion: DETECTOR_VERSION,
          processingMs: 1,
        });
      }
      runner.tick();
    });
  const grid = () => t.output.metronome.gridStartTime()!;
  return { t, runner, slots, strum, runTo, grid };
}

/** Beat-1 strums of bars `from…to−1` on a grid that starts with bar `first`. */
const beats = (grid: number, first: number, from: number, to: number, skip: readonly number[] = []) =>
  Array.from({ length: to - from }, (_, i) => from + i)
    .filter((b) => !skip.includes(b))
    .map((b) => grid + (b - first) * BAR_S);

describe('songStops (D-085)', () => {
  it('a pause is a stop unless the silent bars just before it already made one', () => {
    const all = (n: number) => Array.from({ length: n }, () => true);
    expect(songStops(all(8), [])).toBe(0);
    expect(songStops(all(8), [3])).toBe(1);
    expect(songStops(all(8), [3, 3])).toBe(2);
    // Two silent bars, then P: one stop.
    expect(songStops([true, false, false, true, true], [3])).toBe(1);
    // One silent bar, then P: the pause is the stop; silent bars after it start a new count.
    expect(songStops([true, false, true, false, false], [2])).toBe(2);
    expect(songStops([true, false, false, true], [2])).toBe(1);
  });
});

describe('S pause and resume (D-085)', () => {
  it('perform: a pause mid-bar replays that bar after a one-bar count-in; every bar is analysed once', async () => {
    const { t, runner, slots, strum, runTo, grid } = take();
    runner.start();
    runner.command('toggle');
    await flush();
    const g1 = grid();
    strum(...beats(g1, 0, 0, 6));
    runTo(g1 + 5 * BAR_S + 2);
    runner.command('pause');
    expect(runner.snapshot()).toMatchObject({ phase: 'paused', view: { bar: 5, report: { stops: 1 } } });
    runTo(t.clock.t + 3);
    runner.command('pause');
    expect(runner.snapshot().phase).toBe('countIn');
    await flush();
    expect(t.output.lastConfig).toMatchObject({ countInBars: 1, stopAfterBars: BARS - 5 });
    const g2 = grid();
    expect(g2).toBeCloseTo(t.clock.t + 0.1 + BAR_S, 9);
    // The resume count-in neither jumps to running nor loses the bar to replay.
    runTo(g2 - 1);
    expect(runner.snapshot()).toMatchObject({ phase: 'countIn', view: { bar: 5 } });
    runTo(g2 + 0.5);
    expect(runner.snapshot()).toMatchObject({ phase: 'running', view: { bar: 5 } });
    strum(...beats(g2, 5, 5, BARS));
    runTo(g2 + 11 * BAR_S + 2);
    await flush();
    expect(runner.snapshot().phase).toBe('review');
    expect(slots).toHaveLength(1);
    expect(slots[0]!.map((s) => s.time)).toEqual([...beats(g1, 0, 0, 5), ...beats(g2, 5, 5, BARS)]);
    expect(runner.snapshot().view).toMatchObject({ report: { completed: true, stops: 1 }, analyzing: false });
    runner.command('next');
    const result = songResultSchema.parse(runner.finish());
    expect(result).toMatchObject({ completed: true, stops: 1, pauses: 1, beat1HitRate: 1 });
  });

  it('two silent bars, then P: one stop, not two', async () => {
    const { t, runner, strum, runTo, grid } = take();
    runner.start();
    runner.command('toggle');
    await flush();
    const g1 = grid();
    strum(...beats(g1, 0, 0, 5, [3, 4]));
    runTo(g1 + 5 * BAR_S + 2);
    runner.command('pause');
    runTo(t.clock.t + 1);
    runner.command('toggle'); // Space resumes too
    await flush();
    const g2 = grid();
    strum(...beats(g2, 5, 5, BARS));
    runTo(g2 + 11 * BAR_S + 2);
    await flush();
    expect(runner.snapshot().view.report).toMatchObject({ completed: true, stops: 1 });
    runner.command('next');
    expect(runner.finish().beat1HitRate).toBeCloseTo(14 / 16, 9);
  });

  it('without a microphone and in learn mode a pause counts a stop', async () => {
    for (const over of [{}, { mode: 'learn' as const }]) {
      const { t, runner, runTo, grid } = take({ mic: false, over });
      runner.start();
      runner.command('toggle');
      await flush();
      runTo(grid() + 2 * BAR_S + 2);
      runner.command('pause');
      expect(runner.snapshot().view.report.stops).toBe(1);
      runner.command('pause');
      await flush();
      runTo(t.clock.t + 4 + 14 * BAR_S + 1);
      expect(runner.snapshot().phase).toBe('review');
      runner.command('next');
      expect(runner.finish()).toMatchObject({ completed: true, stops: 1, pauses: 1 });
    }
  });

  it('a pause in the count-in is not counted', async () => {
    const { t, runner, runTo, grid } = take({ mic: false });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() - 2);
    runner.command('pause');
    expect(runner.snapshot()).toMatchObject({ phase: 'paused', view: { bar: null, report: { stops: 0 } } });
    runner.command('pause');
    await flush();
    expect(t.output.lastConfig?.stopAfterBars).toBe(BARS);
    runTo(t.clock.t + 4 + BARS * BAR_S + 1);
    runner.command('next');
    const result = runner.finish();
    expect(result).toMatchObject({ completed: true, stops: 0 });
    expect(result.pauses).toBeUndefined();
  });

  it('6/8: the pause grace is one song beat, not one metronome eighth', async () => {
    // s08 at 50 BPM: a bar is 2.4 s, a song beat 1.2 s, the metronome counts 0.4 s eighths.
    const { runner, runTo, grid } = take({ mic: false, over: { songId: 's08', bpm: 50 } });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + 2 * 2.4 + 0.6);
    runner.command('pause');
    expect(runner.snapshot().view.bar).toBe(1);
  });

  it('H while paused shows the chart: the take is no longer hidden', async () => {
    const { runner, runTo, grid } = take({ mic: false, over: { chartHidden: true } });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + 2 * BAR_S + 2);
    runner.command('pause');
    runner.command('hide');
    runner.command('hide');
    runner.command('abort');
    expect(runner.finish()).toMatchObject({ chartHidden: false, stage: 'perform' });
  });
});

describe('S play-along across a pause (D-085)', () => {
  it('the backing stops, its mask is cut, and the resume renders it from the replayed bar reusing the gain', async () => {
    const rendered: string[][] = [];
    const backing: BackingRenderer = (chords, pattern, bpm) => {
      rendered.push([...chords]);
      return fakeBacking(chords, pattern, bpm);
    };
    const { t, runner, runTo, grid } = take({ over: { backingOn: true, earphones: false }, backing });
    runner.start();
    runner.command('toggle');
    await flush();
    const g1 = grid();
    expect(t.mic.bleedRequests).toHaveLength(1);
    runTo(g1 + 3 * BAR_S + 2);
    const masked = () => (t.mic.job?.kind === 'songStrum' ? t.mic.job.backing : undefined);
    expect(masked()?.arrivals.length).toBe(17 * 4);
    runner.command('pause');
    const pausedAt = t.clock.t;
    expect(t.output.backings[0]!.stopped).toBe(true);
    expect(masked()?.arrivals.every((s) => s <= t.mic.captureSampleOf(pausedAt))).toBe(true);
    // Mode C's backing reference stops where the buffer stopped playing (D-109).
    expect(masked()?.samples).toBe(t.output.backings[0]!.samples);
    expect(masked()?.played).toBe(Math.round((pausedAt - t.output.backings[0]!.at) * 48000));
    runTo(pausedAt + 2);
    runner.command('pause');
    // Rendered before the count-in is scheduled: the intro is bar 3's chord, then bars 3….
    const chart = Array.from({ length: BARS }, (_, b) => ['D', 'D', 'A', 'A'][b % 4]!);
    expect(rendered[0]).toEqual([chart[0], ...chart]);
    expect(rendered[1]).toEqual([chart[3], ...chart.slice(3)]);
    await flush();
    const g2 = grid();
    expect(t.output.backings).toHaveLength(2);
    expect(t.output.backings[1]!.at).toBeCloseTo(g2 - BAR_S, 9);
    expect(t.mic.bleedRequests).toHaveLength(1);
    expect(masked()).toMatchObject({ gain: t.mic.bleedGain });
    expect(masked()?.arrivals[0]).toBe(t.mic.captureSampleOf(g2 - BAR_S));
    expect(masked()?.arrivals).toHaveLength((1 + BARS - 3) * 4);
    expect(masked()?.samples).toBe(t.output.backings[1]!.samples);
    expect(masked()?.start).toBe(t.mic.captureSampleOf(g2 - BAR_S));
    expect(masked()?.played).toBeUndefined();
  });

  it('a bleed answer arriving after the pause is ignored; the resumed backing measures again', async () => {
    const { t, runner, runTo, grid } = take({
      over: { backingOn: true, earphones: false },
      backing: fakeBacking,
    });
    let answer: (gain: number) => void = () => {};
    t.mic.measureBleedGain = (request) => {
      t.mic.bleedRequests.push(request);
      return new Promise((resolve) => (answer = resolve));
    };
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + BAR_S + 2);
    runner.command('pause');
    answer(0.5);
    await flush();
    expect(t.mic.jobs.some((j) => j?.kind === 'songStrum' && j.backing !== undefined)).toBe(false);
    runner.command('pause');
    await flush();
    expect(t.mic.bleedRequests).toHaveLength(2);
    answer(0.25);
    await flush();
    expect(t.mic.job?.kind === 'songStrum' && t.mic.job.backing?.gain).toBe(0.25);
  });
});

describe('S restart (D-085)', () => {
  it('perform: R from running forgets the take so far and plays from bar 0', async () => {
    const { t, runner, runTo, grid } = take({ mic: false });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + BAR_S + 2);
    runner.command('pause');
    runner.command('pause');
    await flush();
    runTo(grid() + 2);
    expect(runner.snapshot().view.report.stops).toBe(1);
    runner.command('restart');
    expect(runner.snapshot()).toMatchObject({ phase: 'countIn', view: { bar: null, report: { stops: 0 } } });
    await flush();
    expect(t.output.lastConfig).toMatchObject({ stopAfterBars: BARS });
    runTo(grid() + BARS * BAR_S + 1);
    runner.command('next');
    const result = runner.finish();
    expect(result).toMatchObject({ completed: true, stops: 0 });
    expect(result.pauses).toBeUndefined();
  });

  it('perform: R while a resume is starting cancels that resume', async () => {
    const { t, runner, runTo, grid } = take({ mic: false });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + BAR_S + 2);
    runner.command('pause');
    t.output.holdStarts();
    runner.command('pause');
    runner.command('restart');
    t.output.releaseStarts();
    await flush();
    expect(t.output.metronomeRunning).toBe(true);
    expect(t.output.lastConfig).toMatchObject({ stopAfterBars: BARS });
    runTo(grid() + BARS * BAR_S + 1);
    expect(runner.snapshot().phase).toBe('review');
    expect(runner.finish()).toMatchObject({ completed: true, stops: 0 });
  });

  it('perform: R from paused starts over', async () => {
    const { runner, runTo, grid } = take({ mic: false });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + BAR_S + 2);
    runner.command('pause');
    runner.command('restart');
    expect(runner.snapshot()).toMatchObject({ phase: 'countIn', view: { report: { stops: 0 } } });
  });

  it('learn: R counts a stop only while the song was playing', async () => {
    const { runner, runTo, grid } = take({ mic: false, over: { mode: 'learn' } });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + BAR_S + 2);
    runner.command('restart');
    expect(runner.snapshot().view.report.stops).toBe(1);
    await flush();
    runner.command('restart'); // in the count-in
    expect(runner.snapshot().view.report.stops).toBe(1);
    await flush();
    runTo(grid() + BAR_S + 2);
    runner.command('pause');
    expect(runner.snapshot().view.report.stops).toBe(2);
    runner.command('restart'); // from paused: the pause was the stop
    expect(runner.snapshot().view.report.stops).toBe(2);
  });
});

describe('S view while paused (D-085)', () => {
  const render = (runner: SongRunner, p: SongParamsInput) => {
    const t = testContext();
    return renderToStaticMarkup(
      <songPlugin.View runner={runner} params={songPlugin.paramsSchema.parse(p)} ctx={t.ctx} />,
    );
  };

  it('says where it stopped, keeps a hidden chart covered, offers the restart', async () => {
    const p = params({ chartHidden: true });
    const { runner, runTo, grid } = take({ mic: false, over: p });
    runner.start();
    runner.command('toggle');
    await flush();
    expect(render(runner, p)).toContain('data-testid="song-restart"');
    runTo(grid() + 2 * BAR_S + 2);
    runner.command('pause');
    const html = render(runner, p);
    expect(html).toContain(ko.exercises.song.pausedAt(3, BARS));
    expect(html).toContain(ko.exercises.song.hidden);
    expect(html).not.toContain('<ol');
    expect(html).toContain('data-testid="song-restart"');
  });

  it('S is pausable; the key hint names P only for pausable runs', () => {
    expect(songPlugin.pausable).toBe(true);
    expect(ko.keys.hint(true)).toContain('P 일시정지');
    expect(ko.keys.hint(false)).not.toContain('P ');
    expect(songPlugin.howTo(songPlugin.paramsSchema.parse(params())).steps).toContain(
      ko.exercises.guide.S.pause,
    );
  });
});
