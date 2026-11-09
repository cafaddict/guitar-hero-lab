import { describe, expect, it } from 'vitest';
import type { RoutineItem } from '../../content/schemas';
import { PRACTICE_SONGS } from '../../content/songs';
import { EMPTY_HISTORY } from '../../domain/history';
import type { Attempt } from '../../domain/records';
import { registerAllExercises } from '../../exercises/catalog';
import { exerciseDefinition } from '../../exercises/registry';
import { TEST_CONTENT } from '../../exercises/testing/fakes';
import { repeatSuggestion, sameRunParams, withSongsPlayed } from './repeat';
import { pluginParamsFor } from './routineParams';
import {
  acknowledgeBreak,
  atSplitPoint,
  breakDue,
  canSplit,
  completeItem,
  holdClock,
  isFinished,
  itemRemainingSec,
  markRecorded,
  opensNewBlock,
  opensNewChordIntro,
  pause,
  practiceMs,
  previousItem,
  REPEATABLE_TYPES,
  releaseClock,
  restartItemClock,
  resume,
  resumeSplit,
  type SessionState,
  sessionKeyCommand,
  skipItem,
  splitHere,
  startSession,
} from './sessionModel';

registerAllExercises();

const item = (
  id: string,
  exerciseType: string,
  params: Record<string, unknown>,
  durationSec = 60,
): RoutineItem => ({ id, exerciseType, params, durationSec, block: 'chord' });

describe('pluginParamsFor', () => {
  it('maps routine vocabulary onto plugin params', () => {
    const e2 = pluginParamsFor(
      item('a', 'E2', { direction: 'A>D', pair: 'A|D', durationSec: 60 }),
      exerciseDefinition('E2')!,
      TEST_CONTENT,
    );
    expect(e2).toEqual({ from: 'A', to: 'D', durationMs: 60_000, countMode: 'auto' });
    const e4 = pluginParamsFor(item('b', 'E4', { pair: 'C|G' }, 90), exerciseDefinition('E4')!, TEST_CONTENT);
    expect(e4).toEqual({ from: 'C', to: 'G', durationMs: 90_000 });
    const e1 = pluginParamsFor(
      item('c', 'E1', { voicingId: 'G-3f', mode: 'pluck' }, 90),
      exerciseDefinition('E1')!,
      TEST_CONTENT,
    );
    expect(e1).toMatchObject({ voicingId: 'G-3f', mode: 'pluck', blockMs: 90_000 });
    const q1 = pluginParamsFor(item('d', 'Q1', { questions: 10 }), exerciseDefinition('Q1')!, TEST_CONTENT);
    expect(q1).toEqual({ seed: 0 });
    const s = pluginParamsFor(
      item('e', 'S', { songId: 's03', mode: 'perform', chartHidden: true }),
      exerciseDefinition('S')!,
      TEST_CONTENT,
    );
    expect(s).toMatchObject({ songId: 's03', mode: 'perform', chartHidden: true, bpm: 65 });
  });

  it('accepts every item the routine generator can produce for stages 0–7', async () => {
    const { generateRoutine } = await import('../../domain/routine');
    const { CURRICULUM } = await import('../../content/curriculum');
    const { PRACTICE_SONGS } = await import('../../content/songs');
    const { contentContextFor } = await import('../../exercises/contentContext');
    for (let stage = 0; stage <= 7; stage++) {
      const plan = generateRoutine({
        stage,
        curriculum: CURRICULUM,
        songs: PRACTICE_SONGS,
        gVoicing: 'G-2f',
        skills: new Map(),
        now: Date.UTC(2026, 9, 8),
        lastPracticeAt: null,
        firstPracticeAt: null,
        lastSelfReport: null,
        sessionMinutes: 20,
        confirmedOverCap: false,
        dueReviews: [],
        changesDoneToday: 0,
        prescriptions: [],
        history: EMPTY_HISTORY,
        sessionsInStage: 0,
        stretchStartFret: 5,
        userTemplate: null,
        seed: stage,
      });
      const content = contentContextFor({ stage, gVoicing: 'G-2f' });
      for (const it of plan.items) {
        if (it.exerciseType === 'REST') continue;
        const definition = exerciseDefinition(it.exerciseType);
        expect(definition, it.exerciseType).toBeDefined();
        expect(
          () => pluginParamsFor(it, definition!, content),
          `${stage}:${it.exerciseType} ${JSON.stringify(it.params)}`,
        ).not.toThrow();
      }
    }
  });

  it('pain ≥ 5 halves the E1/E2 runs themselves, not only the planned time (§7.3-7)', async () => {
    const { generateRoutine } = await import('../../domain/routine');
    const { CURRICULUM } = await import('../../content/curriculum');
    const { PRACTICE_SONGS } = await import('../../content/songs');
    const { contentContextFor } = await import('../../exercises/contentContext');
    const input = {
      stage: 3,
      curriculum: CURRICULUM,
      songs: PRACTICE_SONGS,
      gVoicing: 'G-2f' as const,
      skills: new Map(),
      now: Date.UTC(2026, 9, 8),
      lastPracticeAt: Date.UTC(2026, 9, 7),
      firstPracticeAt: Date.UTC(2026, 8, 1),
      sessionMinutes: 20,
      confirmedOverCap: false,
      dueReviews: [],
      changesDoneToday: 0,
      prescriptions: [],
      history: EMPTY_HISTORY,
      sessionsInStage: 4,
      stretchStartFret: 5,
      userTemplate: null,
      seed: 3,
    };
    const content = contentContextFor({ stage: 3, gVoicing: 'G-2f' });
    const runMs = (
      lastSelfReport: { pain: number; dangerFlags: []; difficulty: number; note: string } | null,
    ) =>
      generateRoutine({ ...input, lastSelfReport })
        .items.filter((i) => i.exerciseType === 'E1' || i.exerciseType === 'E2')
        .map((i) => {
          const params = pluginParamsFor(i, exerciseDefinition(i.exerciseType)!, content) as {
            blockMs?: number;
            durationMs?: number;
          };
          return { planned: i.durationSec * 1000, run: params.blockMs ?? params.durationMs };
        });
    const normal = runMs(null);
    const reduced = runMs({ pain: 6, dangerFlags: [], difficulty: 3, note: '' });
    expect(normal.length).toBeGreaterThanOrEqual(3);
    expect(reduced.map((r) => r.planned)).toEqual(
      normal.map((r) => Math.max(30_000, Math.round(r.planned / 30_000) * 15_000)),
    );
    for (const r of [...normal, ...reduced]) expect(r.run).toBe(r.planned);
  });
});

describe('session model', () => {
  const items = [item('1', 'E0', {}, 120), item('2', 'REST', {}, 30), item('3', 'Q1', {}, 300)];

  it('walks items, records which produced attempts, supports skip and previous', () => {
    let s = startSession(0);
    s = markRecorded(s, '1');
    s = completeItem(s, items, 100_000);
    expect(s.index).toBe(1);
    s = previousItem(s, 101_000);
    expect(s.index).toBe(0);
    s = markRecorded(s, '1');
    s = completeItem(s, items, 102_000);
    s = completeItem(s, items, 132_000);
    s = skipItem(s, items, 140_000);
    expect(isFinished(s, items)).toBe(true);
    expect(s).toMatchObject({ done: ['1', '2'], recorded: ['1'], skipped: ['3'] });
  });

  it('previous from the self report (all items done) is the last item again, with its block time (D-096)', () => {
    let s = startSession(0);
    s = completeItem(s, items, 100_000);
    s = completeItem(s, items, 130_000);
    s = completeItem(s, items, 430_000);
    expect(isFinished(s, items)).toBe(true);
    s = previousItem(s, 431_000);
    expect(s.index).toBe(items.length - 1);
    expect(isFinished(s, items)).toBe(false);
    expect(itemRemainingSec(s, items, 431_000)).toBe(300);
  });

  it('a stored attempt counts even when the item is left by skip or by ending the session', () => {
    let s = startSession(0);
    s = markRecorded(s, '1');
    s = skipItem(s, items, 10_000);
    s = completeItem(s, items, 40_000);
    s = markRecorded(s, '3');
    expect(s.recorded).toEqual(['1', '3']);
    expect(s.index).toBe(2);
  });

  it('keys between runs: after a run Space retries and next advances; rest skips; prev goes back; toggle resumes', () => {
    const view = { paused: false, isRest: false, runEnded: false, first: false };
    expect(sessionKeyCommand('next', view)).toBeNull(); // not started: the exercise host starts it
    expect(sessionKeyCommand('toggle', view)).toBeNull();
    expect(sessionKeyCommand('toggle', { ...view, runEnded: true })).toBe('retry');
    expect(sessionKeyCommand('next', { ...view, runEnded: true })).toBe('advance');
    expect(sessionKeyCommand('next', { ...view, isRest: true })).toBe('advance');
    expect(sessionKeyCommand('toggle', { ...view, isRest: true })).toBe('advance');
    expect(sessionKeyCommand('prev', view)).toBe('previous');
    expect(sessionKeyCommand('prev', { ...view, first: true })).toBeNull();
    expect(sessionKeyCommand('toggle', { ...view, paused: true })).toBe('resume');
    expect(sessionKeyCommand('prev', { ...view, paused: true })).toBeNull();
    expect(sessionKeyCommand('manual1', { ...view, runEnded: true })).toBeNull();
    expect(sessionKeyCommand(null, view)).toBeNull();
  });

  it('practice time excludes pauses; the item budget counts down by clock difference', () => {
    let s = startSession(1000);
    expect(itemRemainingSec(s, items, 61_000)).toBe(60);
    s = pause(s, 61_000);
    expect(practiceMs(s, 500_000)).toBe(60_000);
    s = resume(s, 500_000);
    expect(itemRemainingSec(s, items, 530_000)).toBe(30);
  });

  it('a paused run holds the practice clock without the paused screen (D-085)', () => {
    let s = startSession(0);
    s = holdClock(s, 10_000);
    expect(s.paused).toBe(false);
    expect(practiceMs(s, 70_000)).toBe(10_000);
    expect(holdClock(s, 80_000)).toBe(s);
    s = releaseClock(s, 70_000);
    expect(practiceMs(s, 75_000)).toBe(15_000);
    expect(releaseClock(s, 80_000)).toBe(s);
    // Held and session-paused together: the clock runs only once both are let go.
    s = holdClock(s, 80_000);
    s = pause(s, 90_000);
    s = resume(s, 100_000);
    expect(practiceMs(s, 120_000)).toBe(20_000);
    s = pause(s, 120_000);
    s = releaseClock(s, 130_000);
    expect(practiceMs(s, 140_000)).toBe(20_000);
    s = resume(s, 150_000);
    expect(practiceMs(s, 160_000)).toBe(30_000);
    expect(breakDue(holdClock(s, 160_000), 160_000 + 40 * 60_000)).toBe(false);
  });

  it('break reminder after every 30 minutes of practice', () => {
    let s = startSession(0);
    expect(breakDue(s, 29 * 60_000)).toBe(false);
    expect(breakDue(s, 30 * 60_000)).toBe(true);
    s = acknowledgeBreak(s, 31 * 60_000);
    expect(breakDue(s, 45 * 60_000)).toBe(false);
    expect(breakDue(s, 60 * 60_000)).toBe(true);
  });
});

describe('SPEC v1.1 §7.3-12·13 block time in the session runner', () => {
  it('a transition screen opens only when the next item starts another block (not around rests)', () => {
    const at = (block: RoutineItem['block'], exerciseType = 'E1') => ({ block, exerciseType });
    expect(opensNewBlock(at('tuning', 'E0'), at('chord'))).toBe(true);
    expect(opensNewBlock(at('chord'), at('chord'))).toBe(false);
    expect(opensNewBlock(at('changes', 'E2'), at('rest', 'REST'))).toBe(false);
    expect(opensNewBlock(at('rest', 'REST'), at('changes', 'E2'))).toBe(false);
    expect(opensNewBlock(at('chord'), undefined)).toBe(false);
  });

  it('D-099: the new-chord intro opens when its block starts, not between its chords', () => {
    expect(opensNewChordIntro({ block: 'tuning' }, { block: 'newChord' })).toBe(true);
    expect(opensNewChordIntro(undefined, { block: 'newChord' })).toBe(true);
    expect(opensNewChordIntro({ block: 'newChord' }, { block: 'newChord' })).toBe(false);
    expect(opensNewChordIntro({ block: 'tuning' }, { block: 'chord' })).toBe(false);
  });

  it('the block time starts after the transition screen', () => {
    const items = [item('1', 'E0', {}, 60), item('2', 'E1', {}, 60)];
    let s = startSession(0);
    s = completeItem(s, items, 60_000);
    // 5 s on the transition screen do not count: the clock restarts when the block begins.
    s = restartItemClock(s, 65_000);
    expect(itemRemainingSec(s, items, 65_000)).toBe(60);
    expect(itemRemainingSec(s, items, 125_000)).toBe(0);
    expect(REPEATABLE_TYPES.has('E5') && REPEATABLE_TYPES.has('S') && !REPEATABLE_TYPES.has('E1')).toBe(true);
  });
});

describe('SPEC v1.1 §7.3-11 split sessions', () => {
  it('the split point is the first item after the first half; the half is kept paused and resumes with its records', () => {
    const items = Array.from({ length: 4 }, (_, k) => ({ id: `i${k}` }) as RoutineItem);
    let state = startSession(0);
    expect(atSplitPoint(state, 1)).toBe(false);
    state = completeItem(markRecorded(state, 'i0'), items, 60_000);
    state = completeItem(markRecorded(state, 'i1'), items, 120_000);
    expect(atSplitPoint(state, 1)).toBe(true);
    expect(atSplitPoint(state, null)).toBe(false);
    const saved = splitHere('session-1', '2026-10-09', 9, items, state, 130_000);
    expect(saved).toMatchObject({ sessionId: 'session-1', day: '2026-10-09', stage: 9 });
    expect(saved.state).toMatchObject({
      paused: true,
      practiceMs: 130_000,
      index: 2,
      recorded: ['i0', 'i1'],
    });
    // Later (a new page clock): the same records, practice time kept, the clock running again.
    const resumed = resumeSplit(saved.state, 5_000);
    expect(resumed).toMatchObject({ paused: false, runningSince: 5_000, index: 2, recorded: ['i0', 'i1'] });
    expect(practiceMs(resumed, 65_000)).toBe(190_000);
  });
});

describe('D-104 split between blocks only, more than once', () => {
  // Blocks as a Stage 8 routine lays them out: tuning | newChord ×2 | changes, rest, changes | rhythm | song.
  const layout: readonly [RoutineItem['block'], string][] = [
    ['tuning', 'E0'],
    ['newChord', 'E1'],
    ['newChord', 'E1'],
    ['changes', 'E2'],
    ['rest', 'REST'],
    ['changes', 'E3'],
    ['rhythm', 'E5'],
    ['song', 'S'],
  ];
  const items = layout.map(
    ([block, exerciseType], k) => ({ id: `i${k}`, block, exerciseType }) as RoutineItem,
  );
  const at = (index: number): SessionState => ({ ...startSession(0), index });

  it('test_canSplit_splittableSessionAtEachBlockStart_offered', () => {
    for (const index of [1, 3, 6, 7]) expect(canSplit(at(index), items, true), `index ${index}`).toBe(true);
  });

  it('test_canSplit_insideABlockOrAroundItsRests_notOffered', () => {
    // 0: nothing behind; 2: between two new chords; 4, 5: the rest inside the changes block.
    for (const index of [0, 2, 4, 5]) expect(canSplit(at(index), items, true), `index ${index}`).toBe(false);
  });

  it('test_canSplit_sessionFinished_notOffered', () => {
    expect(canSplit(at(items.length), items, true)).toBe(false);
  });

  it('test_canSplit_resultShowingOnABlocksLastItem_offered', () => {
    // i2 is the last new chord; its result is showing, so the kept part would start at the changes block.
    expect(canSplit(at(2), items, true, true)).toBe(true);
  });

  it('test_canSplit_resultShowingInsideABlock_notOffered', () => {
    // i1 opens the newChord block, but with its result showing the split would fall between i1 and i2.
    expect(canSplit(at(1), items, true, true)).toBe(false);
  });

  it('test_canSplit_resultShowingOnTheLastItem_notOffered', () => {
    expect(canSplit(at(items.length - 1), items, true, true)).toBe(false);
  });

  it('test_canSplit_notSplittableSession_neverOffered', () => {
    for (let index = 0; index <= items.length; index++) expect(canSplit(at(index), items, false)).toBe(false);
  });

  it('test_splitHere_currentRunEnded_keptPartStartsAtTheNextItem', () => {
    const state = markRecorded(at(2), 'i2');
    const saved = splitHere('s', '2026-11-08', 9, items, state, 5000, true);
    expect(saved.state).toMatchObject({ index: 3, done: ['i2'], recorded: ['i2'], paused: true });
  });

  it('test_splitHere_threePartsAtBlockBoundaries_sameRecordsAndPracticeTimeCarryThrough', () => {
    // Part 1: tuning and both new chords, split before the changes block.
    let state = completeItem(markRecorded(startSession(0), 'i0'), items, 60_000);
    state = completeItem(state, items, 80_000);
    state = completeItem(state, items, 100_000);
    expect(canSplit(state, items, true)).toBe(true);
    const first = splitHere('s', '2026-11-08', 9, items, state, 100_000);
    // Part 2: resumed, the changes block (with its rest) done, split again before rhythm.
    state = resumeSplit(first.state, 1_000_000);
    state = completeItem(markRecorded(state, 'i3'), items, 1_010_000);
    expect(canSplit(state, items, true)).toBe(false);
    state = completeItem(state, items, 1_020_000);
    state = completeItem(state, items, 1_030_000);
    expect(canSplit(state, items, true)).toBe(true);
    const second = splitHere(first.sessionId, '2026-11-08', 9, first.items, state, 1_030_000);
    expect(second.state).toMatchObject({ index: 6, recorded: ['i0', 'i3'], practiceMs: 130_000 });
    // Part 3: resumed to the end.
    state = resumeSplit(second.state, 2_000_000);
    for (let k = 6; k < items.length; k++) state = completeItem(state, items, 2_000_000 + (k - 5) * 10_000);
    expect(isFinished(state, items)).toBe(true);
    expect(practiceMs(state, 2_020_000)).toBe(150_000);
    expect(second.sessionId).toBe('s');
  });
});

describe('SPEC v1.1 §11.10 repertoire repeat (M15 review)', () => {
  registerAllExercises();
  const metric = (best: number) => ({
    count: 1,
    last: best,
    best,
    lastAt: 0,
    firstAt: 0,
    recent: [best],
    dayBest: {},
  });
  const skills = new Map(
    ['s01', 's03'].map((id) => [
      `song:${id}`,
      { subjectKey: `song:${id}`, lastPracticedAt: 0, metrics: { repertoire: metric(1) } },
    ]),
  );
  const repertoire = { songs: PRACTICE_SONGS, stage: 8, skills, history: EMPTY_HISTORY };
  const attempt = (params: Record<string, unknown>) =>
    ({ params, result: {}, exerciseType: 'S' }) as unknown as Attempt;

  it('the next song is stored as that song (its own routine key, no review), not as the item it replaced', () => {
    const item = {
      id: 'r',
      exerciseType: 'S',
      block: 'repertoire',
      key: 'S|song:s01',
      reviewOf: 'song:s01',
    } as RoutineItem;
    const s = repeatSuggestion(item, attempt({ songId: 's01', mode: 'perform', bpm: 70 }), repertoire);
    expect(s?.params).toMatchObject({ songId: 's03', mode: 'perform' });
    expect(s?.identity).toEqual({ routineKey: 'S|song:s03', reviewOf: null });
  });

  it('test_withSongsPlayed_songPlayedThisSession_nextSongMovesOnToAnUnplayedOne (D-105)', () => {
    const three = new Map([...skills, ['song:s05', { ...skills.get('song:s01')!, subjectKey: 'song:s05' }]]);
    const item = { id: 'r', exerciseType: 'S', block: 'repertoire', key: 'S|song:s03' } as RoutineItem;
    const history = withSongsPlayed(EMPTY_HISTORY, ['s01', 's03']);

    const s = repeatSuggestion(item, attempt({ songId: 's03', mode: 'perform', bpm: 70 }), {
      ...repertoire,
      skills: three,
      history,
    });

    // s01 was played earlier today, s05 not at all → s05 (without the session's songs it would be s01 again).
    expect(s?.params).toMatchObject({ songId: 's05' });
  });

  it('outside the repertoire block the suggestion keeps the item (tempo only)', () => {
    const item = { id: 'e', exerciseType: 'E5', block: 'rhythm', key: 'E5|strum:P3' } as RoutineItem;
    const s = repeatSuggestion(
      item,
      {
        params: {
          patternId: 'P3',
          bpm: 80,
          bars: 8,
          mode: 'single',
          chords: ['C'],
          cuesHidden: false,
          previousLow: false,
        },
        result: {
          patternId: 'P3',
          bpm: 80,
          bars: 8,
          mode: 'single',
          hits: 32,
          misses: 0,
          extras: 0,
          meanOffsetMs: 0,
          sdOffsetMs: 5,
          hitRate: 1,
          hitRateCorrected: 1,
          cuesHidden: false,
          ladder: 'up',
          passed: true,
          source: 'mic',
        },
      } as unknown as Attempt,
      repertoire,
    );
    expect(s?.identity).toBeUndefined();
  });

  it('a tempo picked before the start carries over (D-098): "+5" after a pass, the same tempo after a stay', () => {
    const item = { id: 'e', exerciseType: 'E5', block: 'rhythm', key: 'E5|strum:P3' } as RoutineItem;
    // The routine said 80; the learner picked 70 on the start screen (the attempt records the run's params).
    const picked = (ladder: 'up' | 'stay') =>
      ({
        exerciseType: 'E5',
        params: {
          patternId: 'P3',
          bpm: 70,
          bars: 8,
          mode: 'single',
          chords: ['C'],
          cuesHidden: false,
          previousLow: false,
        },
        result: {
          patternId: 'P3',
          bpm: 70,
          bars: 8,
          mode: 'single',
          hits: 32,
          misses: 0,
          extras: 0,
          meanOffsetMs: 0,
          sdOffsetMs: 5,
          hitRate: ladder === 'up' ? 1 : 0.5,
          hitRateCorrected: ladder === 'up' ? 1 : 0.5,
          cuesHidden: false,
          ladder,
          passed: ladder === 'up',
          source: 'mic',
        },
      }) as unknown as Attempt;
    expect(repeatSuggestion(item, picked('up'), repertoire)?.params).toMatchObject({ bpm: 75 });
    // A stay has no suggestion: "same again" replays the run's own params, at the picked tempo.
    expect(repeatSuggestion(item, picked('stay'), repertoire)).toBeNull();
    expect(sameRunParams(picked('stay'))).toMatchObject({ patternId: 'P3', bpm: 70 });
    // Other exercises (a song's recorded chart and loop would change its stage) replay the item's params.
    expect(sameRunParams(attempt({ songId: 's01', mode: 'perform', bpm: 70 }))).toBeUndefined();
    expect(sameRunParams(null)).toBeUndefined();
  });
});
