/** SPEC v1.1 §8.6 play-along: backing schedule, earphone policy, speaker masking and the chord check. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import { DEFAULT_SETTINGS, rememberEarphones } from '../../data/settings';
import { extractMetrics, songResultSchema } from '../../domain/exerciseResults';
import type { Calibration } from '../../domain/records';
import type { SetClassification } from '../../dsp/modeC';
import { DETECTOR_VERSION } from '../../dsp/version';
import { GridRecorder } from '../gridRecorder';
import { definePlugin } from '../registry';
import { TEST_SETTINGS, testContext } from '../testing/fakes';
import { songPlugin } from './plugin';
import { type BackingRenderer, BLEED_WINDOW_S, isBluetoothLabel, SongRunner } from './runner';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** One event per beat of every bar (intro included), fast: no audio. */
const fakeBacking: BackingRenderer = (chords, _pattern, bpm) => ({
  signal: new Float32Array(48000),
  events: Array.from({ length: chords.length * 4 }, (_, k) => ({
    time: (k * 60) / bpm,
    kind: 'strum' as const,
  })),
});

/** s01 = D D A A ×4 at 60 BPM: a strum on every beat 1, scored as the bar's chord (set over [D, A]). */
async function playS01(options: { earphones: boolean; bleedOnBeat3?: boolean; label?: string }) {
  const t = testContext();
  if (options.label) t.ctx.calibration = { outputDeviceLabel: options.label, rttMs: 0 } as never;
  const runner = new SongRunner(
    t.ctx,
    {
      songId: 's01',
      mode: 'perform',
      bpm: 60,
      chartHidden: false,
      loopSection: null,
      backingOn: true,
      earphones: options.earphones,
    },
    () => new Float32Array(1),
    fakeBacking,
  );
  runner.start();
  runner.command('toggle');
  await flush();
  const grid = t.output.metronome.gridStartTime()!;
  const chart = ['D', 'D', 'A', 'A'];
  const events: { time: number; keep: boolean; chord: string }[] = [];
  for (let b = 0; b < 16; b++) {
    events.push({ time: grid + b * 4, keep: true, chord: chart[b % 4]! });
    // Backing bleed on beat 3 of every bar: the worker says "not the user" (§10.12).
    if (options.bleedOnBeat3) events.push({ time: grid + b * 4 + 2, keep: false, chord: chart[b % 4]! });
  }
  events.sort((a, b) => a.time - b.time);
  t.output.run(t.clock, 4 + 16 * 4 + 2, () => {
    while (events.length > 0 && events[0]!.time <= t.clock.t - 0.45) {
      const e = events.shift()!;
      const set: Partial<SetClassification> = { scores: e.chord === 'D' ? [5, 1] : [1, 5] };
      t.mic.judged.emit({
        time: e.time,
        result: { keep: e.keep, set },
        jobKind: t.mic.job?.kind ?? 'onsets',
        detectorVersion: DETECTOR_VERSION,
        processingMs: 1,
      });
    }
    runner.tick();
  });
  await flush();
  return { t, runner, grid };
}

describe('S play-along (SPEC v1.1 §8.6)', () => {
  it('earphones: the backing starts with the count-in bar; chords are judged and recorded', async () => {
    const { t, runner, grid } = await playS01({ earphones: true });
    expect(t.output.backings).toHaveLength(1);
    expect(t.output.backings[0]!.at).toBeCloseTo(grid - 4, 9);
    expect(t.mic.bleedRequests).toHaveLength(0);
    expect(runner.snapshot().view).toMatchObject({ backingAudible: false, chordCorrectRatio: 1 });
    runner.command('next');
    const result = songResultSchema.parse(runner.finish());
    expect(result).toMatchObject({
      backingOn: true,
      backingAudible: false,
      chordCorrectRatio: 1,
      beat1HitRate: 1,
    });
    expect(t.output.backings[0]!.stopped).toBe(true);
    expect(extractMetrics('S', result)).toContainEqual({
      subjectKey: 'song:s01:chord',
      metric: 'chordCorrect',
      value: 1,
    });
  });

  it('speakers: the bleed gain is learned from the intro, backing hits are dropped, the chord check is reference only', async () => {
    const { t, runner } = await playS01({ earphones: false, bleedOnBeat3: true });
    expect(t.mic.bleedRequests).toHaveLength(1);
    // The intro bar's events inside the capture ring (at 60 BPM the 4 s intro loses its first beat).
    expect(t.mic.bleedRequests[0]!.arrivals).toHaveLength(3);
    const masked = t.mic.jobs.find((j) => j?.kind === 'songStrum' && j.backing !== undefined);
    expect(masked && masked.kind === 'songStrum' && masked.backing?.gain).toBe(t.mic.bleedGain);
    expect(runner.snapshot().view).toMatchObject({ backingAudible: true });
    runner.command('next');
    const result = songResultSchema.parse(runner.finish());
    // Beat-1 timing is still measured (the bleed on beat 3 never counts as a strum).
    expect(result).toMatchObject({ backingOn: true, backingAudible: true, beat1HitRate: 1, stops: 0 });
    expect(extractMetrics('S', result).some((m) => m.subjectKey === 'song:s01:chord')).toBe(false);
  });

  it('B switches the backing and E the earphone confirmation before the start; the choice is remembered per output', () => {
    const t = testContext({ mic: false });
    const runner = new SongRunner(
      t.ctx,
      { songId: 's01', mode: 'perform', bpm: 60, chartHidden: false, loopSection: null },
      () => new Float32Array(1),
      fakeBacking,
    );
    runner.start();
    runner.command('backing');
    runner.command('ear');
    expect(runner.snapshot().view).toMatchObject({ backingOn: true, earphones: true });
    expect(runner.effectiveParams()).toMatchObject({ backingOn: true, earphones: true });
    const remembered = songPlugin.withHistory!(
      songPlugin.paramsSchema.parse({
        songId: 's01',
        mode: 'perform',
        bpm: 60,
        chartHidden: false,
        loopSection: null,
      }),
      [
        songResultSchema.parse({
          songId: 's01',
          mode: 'perform',
          chartHidden: false,
          bpm: 60,
          completed: true,
          stops: 0,
          memorized: false,
          beat1HitRate: null,
          backingOn: true,
          backingAudible: false,
          outputLabel: 'USB 헤드폰',
        }),
        songResultSchema.parse({
          songId: 's01',
          mode: 'perform',
          chartHidden: false,
          bpm: 60,
          completed: true,
          stops: 0,
          memorized: false,
          beat1HitRate: null,
          backingOn: true,
          backingAudible: true,
          outputLabel: 'MacBook 스피커',
        }),
      ],
    );
    expect(remembered.earphonesByOutput).toEqual({ 'USB 헤드폰': true, 'MacBook 스피커': false });
    expect(isBluetoothLabel('AirPods Pro')).toBe(true);
    expect(isBluetoothLabel('MacBook Pro Speakers')).toBe(false);
  });

  it('the backing is rendered before the count-in is scheduled, so it cannot start late (review M12)', async () => {
    const t = testContext();
    let metronomeAtRender: unknown = 'not rendered';
    const runner = new SongRunner(
      t.ctx,
      {
        songId: 's01',
        mode: 'perform',
        bpm: 60,
        chartHidden: false,
        loopSection: null,
        backingOn: true,
        earphones: true,
      },
      () => new Float32Array(1),
      (chords, pattern, bpm) => {
        metronomeAtRender = t.output.lastConfig;
        return fakeBacking(chords, pattern, bpm);
      },
    );
    runner.start();
    runner.command('toggle');
    await flush();
    expect(metronomeAtRender).toBeNull();
    expect(t.output.lastConfig).not.toBeNull();
  });

  it('the bleed gain is measured inside the capture ring even when the intro bar is longer (60 BPM = 4 s)', async () => {
    const { t, grid } = await playS01({ earphones: false });
    const [request] = t.mic.bleedRequests;
    expect(request).toBeDefined();
    expect(request!.to - request!.from).toBeLessThanOrEqual(BLEED_WINDOW_S + 1e-9);
    expect(request!.to).toBeCloseTo(grid, 9);
    // Intro beats at −4, −3, −2, −1 s: the first is outside the window and left out (not read as "no rise").
    expect(request!.arrivals.map((a) => a - grid)).toEqual([-3, -2, -1]);
    for (const a of request!.arrivals) expect(a).toBeGreaterThanOrEqual(request!.from + 0.1);
  });

  it('a late job update after the take was left does not re-arm the worker job (review M12)', async () => {
    const t = testContext();
    const recorder = new GridRecorder(t.ctx, DEFAULT_METRONOME_CONFIG, () => {}, undefined, {
      kind: 'onsets',
    });
    recorder.start(() => {});
    await flush();
    expect(t.mic.job).toEqual({ kind: 'onsets' });
    recorder.dispose();
    expect(t.mic.job).toBeNull();
    recorder.updateJob({ kind: 'onsets', beta: { direction: true, palmMute: false, level: false } });
    expect(t.mic.job).toBeNull();
  });

  it('learn runs in between do not erase the earphone choice of an output (review M12)', () => {
    const run = (over: Record<string, unknown>) =>
      songResultSchema.parse({
        songId: 's01',
        mode: 'learn',
        chartHidden: false,
        bpm: 60,
        completed: true,
        stops: 0,
        memorized: false,
        beat1HitRate: null,
        chordCorrectRatio: null,
        backingOn: false,
        backingAudible: false,
        ...over,
      });
    const backingRun = run({
      mode: 'perform',
      backingOn: true,
      backingAudible: false,
      outputLabel: 'USB DAC',
    });
    const recent = [...Array.from({ length: 12 }, () => run({})), backingRun];
    expect(songPlugin.historyDepth).toBeGreaterThanOrEqual(recent.length);
    const params = songPlugin.withHistory!(
      songPlugin.paramsSchema.parse({
        songId: 's01',
        mode: 'perform',
        bpm: 60,
        chartHidden: false,
        loopSection: null,
      }),
      recent,
    );
    expect(params.earphonesByOutput).toEqual({ 'USB DAC': true });
  });

  const calibrationOn = (outputDeviceLabel: string): Calibration => ({
    id: 'cal',
    createdAt: 0,
    inputDeviceLabel: 'mic',
    outputDeviceLabel,
    sampleRate: 48000,
    trackSettings: { echoCancellation: false },
    noiseFloorDbfs: -60,
    tuningCents: [0, 0, 0, 0, 0, 0],
    stringTemplates: Array.from({ length: 6 }, () => ({ harmonics: [1, 0.5], decayRatio: 0.6 })),
    rttMs: 120,
    rttMethod: 'loopback',
    rttMadMs: 0.5,
    warnings: [],
  });

  const backingResult = (over: Record<string, unknown>) =>
    songResultSchema.parse({
      songId: 's01',
      mode: 'perform',
      chartHidden: false,
      bpm: 60,
      completed: true,
      stops: 0,
      memorized: false,
      beat1HitRate: null,
      backingOn: true,
      backingAudible: false,
      outputLabel: 'USB DAC',
      ...over,
    });

  it('test_earphoneChoice_backingRunOnEarphones_isKeyedByTheRunsOutputLabel (D-101)', () => {
    const settings = { ...DEFAULT_SETTINGS, earphonesByOutput: { 'MacBook 스피커': false } };

    const choice = songPlugin.earphoneChoice!(
      backingResult({ backingAudible: false, outputLabel: 'USB DAC' }),
    );

    expect(choice).toEqual({ outputLabel: 'USB DAC', earphones: true });
    expect(rememberEarphones(settings, choice!)).toEqual({
      earphonesByOutput: { 'MacBook 스피커': false, 'USB DAC': true },
    });
  });

  it('test_earphoneChoice_backingRunOnSpeakers_storesSpeakers (D-101)', () => {
    const choice = songPlugin.earphoneChoice!(
      backingResult({ backingAudible: true, outputLabel: 'MacBook 스피커' }),
    );

    expect(choice).toEqual({ outputLabel: 'MacBook 스피커', earphones: false });
  });

  it('test_earphoneChoice_learnRunOrNoOutputLabel_storesNothing (D-101)', () => {
    expect(songPlugin.earphoneChoice!(backingResult({ mode: 'learn', backingOn: false }))).toBeNull();
    expect(songPlugin.earphoneChoice!(backingResult({ outputLabel: undefined }))).toBeNull();
  });

  it('test_earphoneChoice_throughTheRegistry_parsesAStoredResult (D-101)', () => {
    const definition = definePlugin(songPlugin);
    const stored = JSON.parse(JSON.stringify(backingResult({ backingAudible: false })));

    expect(definition.earphoneChoice(stored)).toEqual({ outputLabel: 'USB DAC', earphones: true });
  });

  it('test_songRunner_settingsChoiceForOutputNotInHistory_isTheDefault (D-101)', () => {
    const t = testContext();
    const ctx = {
      ...t.ctx,
      calibration: calibrationOn('USB DAC'),
      settings: { ...TEST_SETTINGS, earphonesByOutput: { 'USB DAC': true } },
    };
    // 50 recent learn runs: none of them is a backing run on 'USB DAC'.
    const recent = Array.from({ length: 50 }, () => backingResult({ mode: 'learn', backingOn: false }));
    const params = songPlugin.withHistory!(
      songPlugin.paramsSchema.parse({
        songId: 's01',
        mode: 'perform',
        bpm: 60,
        chartHidden: false,
        loopSection: null,
      }),
      recent,
    );

    const runner = songPlugin.createRunner(ctx, params);

    expect(params.earphonesByOutput).toEqual({});
    expect(runner.snapshot().view).toMatchObject({ outputLabel: 'USB DAC', earphones: true });
  });

  it('test_songRunner_settingsAndHistoryDisagree_settingsChoiceWins (D-101)', () => {
    const t = testContext();
    const ctx = {
      ...t.ctx,
      calibration: calibrationOn('USB DAC'),
      settings: { ...TEST_SETTINGS, earphonesByOutput: { 'USB DAC': false } },
    };
    const params = songPlugin.paramsSchema.parse({
      songId: 's01',
      mode: 'perform',
      bpm: 60,
      chartHidden: false,
      loopSection: null,
      earphonesByOutput: { 'USB DAC': true },
    });

    const runner = songPlugin.createRunner(ctx, params);

    expect(runner.snapshot().view).toMatchObject({ earphones: false });
  });

  it('test_songRunner_outputUnknownToSettings_fallsBackToHistoryChoice (D-101)', () => {
    const t = testContext();
    const ctx = { ...t.ctx, calibration: calibrationOn('USB DAC') };
    const params = songPlugin.paramsSchema.parse({
      songId: 's01',
      mode: 'perform',
      bpm: 60,
      chartHidden: false,
      loopSection: null,
      earphonesByOutput: { 'USB DAC': true },
    });

    const runner = songPlugin.createRunner(ctx, params);

    expect(runner.snapshot().view).toMatchObject({ earphones: true });
  });
});
