import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '../../app/services';
import type { RoutineItem } from '../../content/schemas';
import { dayKey } from '../../domain/records';
import {
  completeItem,
  markRecorded,
  resumeSplit,
  SPLIT_RESUME_KEY,
  type SplitResume,
  startSession,
} from './sessionModel';
import { closeSplit, pendingSplit, saveSplitProgress } from './splitResume';

const T = new Date(2026, 10, 8, 19).getTime();
const DAY = 86_400_000;
const items = Array.from({ length: 5 }, (_, k) => ({ id: `r0${k + 1}` }) as RoutineItem);

async function openSession(id: string): Promise<void> {
  await repo.startSession({
    id,
    startedAt: T,
    endedAt: null,
    routineId: null,
    plannedItems: items.length,
    completedItems: 0,
    selfReport: null,
    stage: 9,
  });
}

/** A record as written before D-104: the first half after the rhythm block, nothing but these five fields. */
function legacyRecord(sessionId: string): SplitResume {
  let state = completeItem(markRecorded(startSession(T), 'r01'), items, T + 60_000);
  state = completeItem(state, items, T + 120_000);
  return {
    sessionId,
    day: dayKey(T),
    stage: 9,
    items,
    state: { ...state, paused: true, runningSince: null, practiceMs: 120_000 },
  };
}

beforeEach(async () => {
  await repo.setMeta(SPLIT_RESUME_KEY, null);
});

describe('split records kept under meta (D-104, §7.3-11)', () => {
  it('test_pendingSplit_legacyRecordSameDay_resumesAtItsSavedItem', async () => {
    await openSession('legacy-1');
    await repo.setMeta(SPLIT_RESUME_KEY, legacyRecord('legacy-1'));
    const saved = await pendingSplit(T + 3_600_000);
    expect(saved?.sessionId).toBe('legacy-1');
    const resumed = resumeSplit(saved!.state, 0);
    expect(resumed).toMatchObject({ index: 2, recorded: ['r01'], paused: false });
  });

  it('test_pendingSplit_legacyRecordNextDay_closesTheSessionWithoutSelfReport', async () => {
    await openSession('legacy-2');
    await repo.setMeta(SPLIT_RESUME_KEY, legacyRecord('legacy-2'));
    expect(await pendingSplit(T + DAY)).toBeNull();
    const session = (await repo.sessions()).find((s) => s.id === 'legacy-2')!;
    expect(session).toMatchObject({ endedAt: T + 120_000, completedItems: 1, selfReport: null });
    expect(await repo.getMeta(SPLIT_RESUME_KEY)).toBeNull();
  });

  it('test_closeSplit_secondSplitOfResumedPart_countsEveryPartsRecordsAndTime', async () => {
    await openSession('multi-1');
    // Part 2 resumed from the legacy first half, one more item recorded, then split again.
    const first = legacyRecord('multi-1');
    let state = resumeSplit(first.state, 0);
    state = completeItem(markRecorded(state, 'r03'), items, 30_000);
    await saveSplitProgress(first, state, 30_000);
    const kept = (await pendingSplit(T + 3_600_000))!;
    expect(kept.state).toMatchObject({ index: 3, recorded: ['r01', 'r03'], practiceMs: 150_000 });
    await closeSplit(kept);
    const session = (await repo.sessions()).find((s) => s.id === 'multi-1')!;
    expect(session).toMatchObject({ endedAt: T + 150_000, completedItems: 2, selfReport: null });
    expect(await pendingSplit(T + 3_600_000)).toBeNull();
  });
});
