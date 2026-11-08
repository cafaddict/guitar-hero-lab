/** D-101: a backing run's earphone choice is saved under its output device label when the run ends. */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GuitarDb } from '../../data/db';
import { Repository } from '../../data/repo';
import type { Settings } from '../../data/settings';
import { songResultSchema } from '../../domain/exerciseResults';
import { definePlugin } from '../registry';
import { songPlugin } from '../song/plugin';
import { type EarphoneSettingsStore, saveEarphoneChoice } from './earphoneSetting';

let dbCounter = 0;

/** Same semantics as useSettingsStore (cache, load from the repo, merge the patch, write through). */
function storeOn(repo: Repository): EarphoneSettingsStore {
  const store: EarphoneSettingsStore = {
    settings: null,
    async load() {
      store.settings = await repo.settings();
      return store.settings;
    },
    async update(patch) {
      const next: Settings = { ...(store.settings ?? (await repo.settings())), ...patch };
      store.settings = next;
      await repo.saveSettings(next);
      return next;
    },
  };
  return store;
}

async function freshRepo(earphonesByOutput: Record<string, boolean> = {}): Promise<Repository> {
  dbCounter += 1;
  const repo = new Repository(new GuitarDb(`earphone-setting-${dbCounter}-${Date.now()}`));
  await repo.saveSettings({ ...(await repo.settings()), earphonesByOutput });
  return repo;
}

/** A stored song result as the host gets it from runner.finish(). */
const songResult = (over: Record<string, unknown>) =>
  JSON.parse(
    JSON.stringify(
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
      }),
    ),
  );

const song = definePlugin(songPlugin);

describe('saveEarphoneChoice (D-101)', () => {
  it('test_saveEarphoneChoice_backingRunOnEarphones_savesTrueUnderTheRunsOutputLabel', async () => {
    const repo = await freshRepo();

    await saveEarphoneChoice(
      song,
      songResult({ backingAudible: false, outputLabel: 'USB DAC' }),
      storeOn(repo),
    );

    expect((await repo.settings()).earphonesByOutput).toEqual({ 'USB DAC': true });
  });

  it('test_saveEarphoneChoice_backingRunOnSpeakers_savesFalseUnderTheRunsOutputLabel', async () => {
    const repo = await freshRepo();

    await saveEarphoneChoice(
      song,
      songResult({ backingAudible: true, outputLabel: 'MacBook 스피커' }),
      storeOn(repo),
    );

    expect((await repo.settings()).earphonesByOutput).toEqual({ 'MacBook 스피커': false });
  });

  it('test_saveEarphoneChoice_otherDevicesAlreadyStored_keepsTheirChoices', async () => {
    const repo = await freshRepo({ 'MacBook 스피커': false, AirPods: true });

    await saveEarphoneChoice(
      song,
      songResult({ backingAudible: false, outputLabel: 'USB DAC' }),
      storeOn(repo),
    );

    expect((await repo.settings()).earphonesByOutput).toEqual({
      'MacBook 스피커': false,
      AirPods: true,
      'USB DAC': true,
    });
  });

  it('test_saveEarphoneChoice_sameDeviceChangedToSpeakers_overwritesOnlyThatDevice', async () => {
    const repo = await freshRepo({ 'USB DAC': true, AirPods: true });

    await saveEarphoneChoice(
      song,
      songResult({ backingAudible: true, outputLabel: 'USB DAC' }),
      storeOn(repo),
    );

    expect((await repo.settings()).earphonesByOutput).toEqual({ 'USB DAC': false, AirPods: true });
  });

  it('test_saveEarphoneChoice_storeAlreadyLoaded_keepsTheOtherSettingsAndCache', async () => {
    const repo = await freshRepo({ AirPods: true });
    const store = storeOn(repo);
    await store.load();
    await store.update({ micDisabled: true });

    await saveEarphoneChoice(song, songResult({ backingAudible: false, outputLabel: 'USB DAC' }), store);

    const saved = await repo.settings();
    expect(saved.micDisabled).toBe(true);
    expect(saved.earphonesByOutput).toEqual({ AirPods: true, 'USB DAC': true });
    expect(store.settings).toEqual(saved);
  });

  it('test_saveEarphoneChoice_backingOffOrNoOutputLabel_savesNothing', async () => {
    const repo = await freshRepo({ AirPods: true });
    const before = await repo.settings();

    await saveEarphoneChoice(song, songResult({ mode: 'learn', backingOn: false }), storeOn(repo));
    await saveEarphoneChoice(song, songResult({ outputLabel: undefined }), storeOn(repo));

    expect(await repo.settings()).toEqual(before);
  });

  it('test_saveEarphoneChoice_invalidResult_savesNothing', async () => {
    const repo = await freshRepo();

    await saveEarphoneChoice(song, { bogus: true }, storeOn(repo));

    expect((await repo.settings()).earphonesByOutput).toEqual({});
  });

  it('test_exerciseHost_runEnd_callsSaveEarphoneChoiceWithTheSettingsStore', () => {
    // ExerciseHost has no render test setup (only static markup); this guards the one-line call in onDone.
    const source = readFileSync(join(import.meta.dirname, 'ExerciseHost.tsx'), 'utf8');
    const onDone = source.slice(
      source.indexOf('const onDone = useCallback'),
      source.indexOf('const endThenBack'),
    );

    expect(onDone).toMatch(/saveEarphoneChoice\(definition, result, useSettingsStore\.getState\(\)\)/);
  });
});
