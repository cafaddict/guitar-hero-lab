import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { OneMinuteResult } from '../domain/exerciseResults';
import { mulberry32, type Rng } from '../domain/prng';
import { type Attempt, DAY_MS } from '../domain/records';
import { GuitarDb, TABLE_NAMES } from './db';
import { applyImport, exportAll, exportFileName, parseImport } from './exportImport';
import { Repository } from './repo';
import { DEFAULT_SETTINGS } from './settings';

const T0 = new Date(2026, 8, 1, 18).getTime();
let dbCounter = 0;
function freshRepo(): Repository {
  dbCounter += 1;
  return new Repository(new GuitarDb(`test-db-${dbCounter}-${Date.now()}`));
}

function randomAttempt(rng: Rng, i: number, at: number): Attempt {
  const kind = Math.floor(rng() * 5);
  const base = {
    id: `att-${i}`,
    sessionId: `s-${Math.floor(i / 4)}`,
    exerciseVersion: 1,
    startedAt: at - 60_000,
    endedAt: at,
    params: {},
    detectorVersion: '1.0.0',
    processingMs: 3,
    reviewOf: null,
  };
  const pairs = [
    ['A', 'D'],
    ['D', 'A'],
    ['A', 'E'],
    ['C', 'G'],
  ] as const;
  switch (kind) {
    case 0: {
      const [from, to] = pairs[Math.floor(rng() * pairs.length)]!;
      const result: OneMinuteResult = {
        pair: from < to ? `${from}|${to}` : `${to}|${from}`,
        direction: `${from}>${to}`,
        durationMs: 60_000,
        countMode: 'auto',
        detectedChanges: 15 + Math.floor(rng() * 25),
        correctedChanges: rng() < 0.3 ? 30 : null,
        tapChanges: null,
        lowConfidenceEvents: 1,
        changeTimestampsMs: [1000, 3000],
      };
      return { ...base, exerciseType: 'E2', result };
    }
    case 1: {
      const voicingId = ['D', 'A', 'C'][Math.floor(rng() * 3)]!;
      const clean = rng() < 0.7;
      return {
        ...base,
        exerciseType: 'E1',
        result: {
          voicingId,
          mode: 'pluck',
          earFirst: false,
          cleanRatio: clean ? 1 : 0.8,
          attempts: [
            {
              perString: [
                { idx: 2, status: 'OK', selfStatus: null, cents: 1.5, confidence: 0.9, semitones: null },
                {
                  idx: 4,
                  status: clean ? 'OK' : 'MUTED',
                  selfStatus: null,
                  cents: null,
                  confidence: 0.8,
                  semitones: null,
                },
              ],
              clean,
              strumVerdict: null,
              selfAgreement: null,
            },
          ],
        },
      };
    }
    case 2:
      return {
        ...base,
        exerciseType: 'E5',
        result: {
          patternId: 'P3',
          bpm: 80,
          bars: 8,
          mode: 'single',
          hits: 40,
          misses: 0,
          extras: 0,
          meanOffsetMs: -12,
          sdOffsetMs: 14,
          hitRate: 0.95,
          hitRateCorrected: 0.97,
          cuesHidden: rng() < 0.5,
          ladder: 'up',
          passed: rng() < 0.6,
          source: 'mic',
        },
      };
    case 3:
      return {
        ...base,
        exerciseType: 'S',
        detectorVersion: null,
        processingMs: 0,
        result: {
          songId: 's01',
          mode: 'perform',
          chartHidden: rng() < 0.5,
          bpm: 60,
          completed: true,
          stops: 0,
          memorized: false,
          beat1HitRate: null,
        },
      };
    default:
      return {
        ...base,
        exerciseType: 'Q1',
        detectorVersion: null,
        processingMs: 0,
        result: { questions: 10, correct: 7 + Math.floor(rng() * 4), meanReactionMs: 2100 },
      };
  }
}

async function seed(repo: Repository, n: number, seedValue = 1): Promise<Attempt[]> {
  const rng = mulberry32(seedValue);
  const attempts: Attempt[] = [];
  for (let i = 0; i < n; i++) {
    const at = T0 + i * (DAY_MS / 3);
    const attempt = randomAttempt(rng, i, at);
    // Every 9th attempt reviews something already graduated.
    if (i % 9 === 8) {
      const reviews = await repo.reviews();
      const target = reviews.find((r) => r.subjectKey.startsWith('chord:'));
      if (target && attempt.exerciseType === 'E1') attempt.reviewOf = target.subjectKey;
    }
    attempts.push(attempt);
    await repo.recordAttempt(attempt);
  }
  return attempts;
}

async function snapshot(repo: Repository) {
  const db = repo.db;
  const metrics = (await db.metrics.toArray()).map(({ seq: _seq, ...rest }) => rest);
  metrics.sort(
    (a, b) =>
      a.at - b.at ||
      a.attemptId.localeCompare(b.attemptId) ||
      a.subjectKey.localeCompare(b.subjectKey) ||
      a.metric.localeCompare(b.metric),
  );
  const skills = (await db.skills.toArray()).sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
  const reviews = (await db.reviews.toArray()).sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
  return { metrics, skills, reviews };
}

describe('AC-T1 Dexie schema, append-only attempts, rebuildDerived', () => {
  it('declares the SPEC §13.2 tables', () => {
    const repo = freshRepo();
    expect(repo.db.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort());
    expect(repo.db.attempts.schema.indexes.map((i) => i.name).sort()).toEqual([
      '[exerciseType+startedAt]',
      'exerciseType',
      'sessionId',
      'startedAt',
    ]);
    expect(repo.db.metrics.schema.primKey.auto).toBe(true);
  });

  it('recentAttempts returns one exercise type, newest first', async () => {
    const repo = freshRepo();
    const all = await seed(repo, 40);
    const type = all[0]!.exerciseType;
    const expected = all
      .filter((a) => a.exerciseType === type)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, 3)
      .map((a) => a.id);
    expect((await repo.recentAttempts(type, 3)).map((a) => a.id)).toEqual(expected);
    expect(await repo.recentAttempts('nope', 3)).toEqual([]);
  });

  it('attempts are append-only: duplicates are rejected and no update/delete API exists', async () => {
    const repo = freshRepo();
    const [first] = await seed(repo, 1);
    await expect(repo.recordAttempt(first!)).rejects.toThrow(/append-only/);
    const methods = Object.getOwnPropertyNames(Repository.prototype);
    expect(methods.filter((m) => /attempt/i.test(m) && /(update|delete|remove|edit|put)/i.test(m))).toEqual(
      [],
    );
    expect(await repo.db.attempts.count()).toBe(1);
  });

  it('rebuildDerived() equals the incrementally maintained metrics, skills and reviews', async () => {
    const repo = freshRepo();
    await seed(repo, 120, 7);
    const incremental = await snapshot(repo);
    expect(incremental.metrics.length).toBeGreaterThan(100);
    expect(incremental.reviews.length).toBeGreaterThan(0);
    await repo.rebuildDerived();
    expect(await snapshot(repo)).toEqual(incremental);
  });

  it('review attempts move the review item forward or back', async () => {
    const repo = freshRepo();
    const clean = (i: number, at: number, ok: boolean, reviewOf: string | null = null): Attempt => ({
      id: `c${i}`,
      sessionId: null,
      exerciseType: 'E1',
      exerciseVersion: 1,
      startedAt: at - 1000,
      endedAt: at,
      params: {},
      detectorVersion: null,
      processingMs: 0,
      reviewOf,
      result: {
        voicingId: 'D',
        mode: 'manual',
        earFirst: false,
        cleanRatio: ok ? 1 : 0,
        attempts: [{ perString: [], clean: ok, strumVerdict: null, selfAgreement: null }],
      },
    });
    for (let i = 0; i < 5; i++) await repo.recordAttempt(clean(i, T0 + i * 1000, true));
    const [enqueued] = await repo.reviews();
    expect(enqueued).toMatchObject({ subjectKey: 'chord:D', step: 0 });
    await repo.recordAttempt(clean(10, T0 + 2 * DAY_MS, true, 'chord:D'));
    expect((await repo.reviews())[0]).toMatchObject({ step: 1, lapses: 0 });
    await repo.recordAttempt(clean(11, T0 + 6 * DAY_MS, false, 'chord:D'));
    expect((await repo.reviews())[0]).toMatchObject({ step: 0, lapses: 1 });
  });

  it('finishing a session stores the self report and counts toward the stage stay', async () => {
    const repo = freshRepo();
    await repo.startSession({
      id: 's1',
      startedAt: T0,
      endedAt: null,
      routineId: null,
      plannedItems: 5,
      completedItems: 0,
      selfReport: null,
      stage: 0,
    });
    await repo.finishSession(
      's1',
      T0 + 1_200_000,
      5,
      { pain: 3, dangerFlags: [], difficulty: 2, note: 'ok' },
      900_000,
    );
    await repo.finishSession('s1', T0 + 1_300_000, 5, null); // idempotent
    expect((await repo.sessions())[0]).toMatchObject({
      endedAt: T0 + 1_200_000,
      completedItems: 5,
      selfReport: { pain: 3 },
      practiceMs: 900_000,
    });
    expect((await repo.progression(T0)).sessionsInStage).toBe(1);
  });

  it('a session ended without practising anything does not count toward the stage stay', async () => {
    const repo = freshRepo();
    await repo.startSession({
      id: 's0',
      startedAt: T0,
      endedAt: null,
      routineId: null,
      plannedItems: 5,
      completedItems: 0,
      selfReport: null,
      stage: 0,
    });
    await repo.finishSession('s0', T0 + 60_000, 0, null, 60_000);
    expect((await repo.sessions())[0]).toMatchObject({ endedAt: T0 + 60_000, completedItems: 0 });
    expect((await repo.progression(T0)).sessionsInStage).toBe(0);
  });

  it('a curriculum session for another stage does not count toward the current stage stay (D-072)', async () => {
    const repo = freshRepo();
    for (const [id, stage] of [
      ['other', 2],
      ['current', 0],
    ] as const) {
      await repo.startSession({
        id,
        startedAt: T0,
        endedAt: null,
        routineId: 'custom',
        plannedItems: 2,
        completedItems: 0,
        selfReport: null,
        stage,
      });
      await repo.finishSession(id, T0 + 600_000, 2, null, 600_000);
    }
    // Stage 0 is current: only the stage-0 session counts.
    expect((await repo.progression(T0)).sessionsInStage).toBe(1);
  });

  it('settings default and persist', async () => {
    const repo = freshRepo();
    expect(await repo.settings()).toEqual(DEFAULT_SETTINGS);
    await repo.saveSettings({ ...DEFAULT_SETTINGS, theme: 'light', leftHanded: true });
    expect(await repo.settings()).toMatchObject({ theme: 'light', leftHanded: true });
  });

  it('settings stored before "판정 감도" existed read back with the default sensitivity (D-075)', async () => {
    const repo = freshRepo();
    const { sensitivity: _dropped, ...older } = DEFAULT_SETTINGS;
    await repo.setMeta('settings', { ...older, strictness: 'strict' });
    expect(await repo.settings()).toMatchObject({ strictness: 'strict', sensitivity: 'normal' });
  });

  it('settings stored before the song earphone choice existed read back with an empty choice map (D-101)', async () => {
    const repo = freshRepo();
    const { earphonesByOutput: _dropped, ...older } = DEFAULT_SETTINGS;
    await repo.setMeta('settings', { ...older, theme: 'light' });
    expect(await repo.settings()).toMatchObject({ theme: 'light', earphonesByOutput: {} });
  });
});

describe('AC-T2 export / import', () => {
  it('round-trips every table into an empty database (deep-equal)', async () => {
    const source = freshRepo();
    await seed(source, 60, 3);
    await source.startSession({
      id: 'sx',
      startedAt: T0,
      endedAt: null,
      routineId: null,
      plannedItems: 3,
      completedItems: 0,
      selfReport: null,
      stage: 1,
    });
    await source.saveSettings({ ...DEFAULT_SETTINGS, theme: 'contrast' });
    await source.saveCalibration({
      id: 'cal1',
      createdAt: T0,
      inputDeviceLabel: 'mic',
      outputDeviceLabel: 'spk',
      sampleRate: 48000,
      trackSettings: { echoCancellation: false },
      noiseFloorDbfs: -60,
      tuningCents: [0, 1, -1, 2, 0, 0],
      stringTemplates: Array.from({ length: 6 }, () => ({ harmonics: [1, 0.5], decayRatio: 0.6 })),
      rttMs: 120,
      rttMethod: 'loopback',
      rttMadMs: 0.5,
      warnings: [],
    });
    const exported = await exportAll(source.db, T0);
    const text = JSON.stringify(exported);

    const preview = parseImport(text);
    expect(preview.counts.attempts).toBe(60);
    expect(preview.counts.sessions).toBe(1);
    expect(preview.counts.metrics).toBe(exported.tables.metrics.length);

    const target = freshRepo();
    await applyImport(target, preview.envelope, 'replace');
    const again = await exportAll(target.db, T0);
    for (const name of TABLE_NAMES) expect(again.tables[name], name).toEqual(exported.tables[name]);
  });

  it('merge skips existing ids and rebuilds derived caches', async () => {
    const a = freshRepo();
    await seed(a, 30, 11);
    const envelope = parseImport(JSON.stringify(await exportAll(a.db, T0))).envelope;
    const b = freshRepo();
    await seed(b, 10, 11); // same ids att-0..att-9
    await applyImport(b, envelope, 'merge');
    expect(await b.db.attempts.count()).toBe(30);
    const merged = await snapshot(b);
    await b.rebuildDerived();
    expect(await snapshot(b)).toEqual(merged);
  });

  it('merge restores progression and meta rows the target lacks, and keeps the ones it has', async () => {
    const a = freshRepo();
    await seed(a, 5, 3);
    const progressed = { ...(await a.progression(T0)), stage: 4, sessionsInStage: 2, exam: { '1': T0 } };
    await a.saveProgression(progressed);
    await a.saveSettings({ ...DEFAULT_SETTINGS, theme: 'light' });
    await a.setMeta('lastBackupAt', T0);
    const envelope = parseImport(JSON.stringify(await exportAll(a.db, T0))).envelope;

    // A fresh device: nothing stored yet → stage, exam passes, settings and backup time come back.
    const fresh = freshRepo();
    await applyImport(fresh, envelope, 'merge');
    expect(await fresh.progression(T0)).toEqual(progressed);
    expect((await fresh.settings()).theme).toBe('light');
    expect(await fresh.getMeta('lastBackupAt')).toBe(T0);

    // Same keys already present → skipped like any existing id.
    const used = freshRepo();
    await used.saveSettings({ ...DEFAULT_SETTINGS, theme: 'contrast' });
    await used.saveProgression({ ...progressed, stage: 1 });
    await applyImport(used, envelope, 'merge');
    expect((await used.settings()).theme).toBe('contrast');
    expect((await used.progression(T0)).stage).toBe(1);
  });

  it('a backup made before the song earphone choice existed imports with an empty choice map (D-101)', async () => {
    const a = freshRepo();
    const { earphonesByOutput: _dropped, ...older } = DEFAULT_SETTINGS;
    await a.setMeta('settings', { ...older, theme: 'light' });
    const text = JSON.stringify(await exportAll(a.db, T0));
    expect(text).not.toContain('earphonesByOutput');

    const target = freshRepo();
    await applyImport(target, parseImport(text).envelope, 'replace');

    expect(await target.settings()).toMatchObject({ theme: 'light', earphonesByOutput: {} });
  });

  it('rejects invalid files and newer schema versions', () => {
    expect(() => parseImport('not json')).toThrow(/JSON/);
    expect(() =>
      parseImport(JSON.stringify({ app: 'other', schemaVersion: 1, exportedAt: 0, tables: {} })),
    ).toThrow();
    expect(() =>
      parseImport(JSON.stringify({ app: 'guitar-hero', schemaVersion: 99, exportedAt: 0, tables: {} })),
    ).toThrow(/newer/);
    expect(() =>
      parseImport(
        JSON.stringify({
          app: 'guitar-hero',
          schemaVersion: 1,
          exportedAt: 0,
          tables: { attempts: [{ nope: 1 }] },
        }),
      ),
    ).toThrow(/attempts\[0\]/);
    // Missing tables default to empty arrays (older exports stay importable).
    expect(
      parseImport(JSON.stringify({ app: 'guitar-hero', schemaVersion: 1, exportedAt: 0, tables: {} })).counts
        .attempts,
    ).toBe(0);
  });

  it('names export files with the date', () => {
    expect(exportFileName(new Date(2026, 9, 7, 12).getTime())).toBe('guitar-hero-backup-2026-10-07.json');
  });
});
