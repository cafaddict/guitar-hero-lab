/**
 * Session runner model (SPEC §12.1 "세션 러너", §7.3-8). Pure: walks the routine items in order, keeps the
 * practice time as clock differences (pauses excluded), raises the break reminder after every 30 continuous
 * minutes, and supports skip / previous / pause. The exercise runs themselves are hosted elsewhere.
 */
import type { RoutineItem } from '../../content/schemas';
import type { KeyAction } from '../../data/settings';
import { BREAK_AFTER_MS } from '../../domain/safety';

export interface SessionState {
  index: number;
  /** Item ids that ended (attempt stored, rest finished, or nothing to record). */
  done: string[];
  skipped: string[];
  /** Ids of items whose run produced a stored Attempt. */
  recorded: string[];
  paused: boolean;
  /**
   * The practice clock is held by a paused exercise run (D-085): stopped like a session pause, without the
   * paused screen (the run shows its own).
   */
  held?: boolean;
  /** Clock value (ms) when the current un-paused stretch started, or null while paused or held. */
  runningSince: number | null;
  /** Practice time accumulated before `runningSince`. */
  practiceMs: number;
  /** Practice time when the break reminder was last shown (multiples of 30 min). */
  breakShownAtMs: number;
  itemStartedAtMs: number;
}

export function startSession(now: number): SessionState {
  return {
    index: 0,
    done: [],
    skipped: [],
    recorded: [],
    paused: false,
    runningSince: now,
    practiceMs: 0,
    breakShownAtMs: 0,
    itemStartedAtMs: 0,
  };
}

export function practiceMs(state: SessionState, now: number): number {
  return state.practiceMs + (state.runningSince === null ? 0 : now - state.runningSince);
}

export function pause(state: SessionState, now: number): SessionState {
  if (state.paused) return state;
  return { ...state, paused: true, practiceMs: practiceMs(state, now), runningSince: null };
}

export function resume(state: SessionState, now: number): SessionState {
  if (!state.paused) return state;
  return { ...state, paused: false, runningSince: state.held ? null : now };
}

/** A run was paused (D-085): practice time stops until releaseClock. */
export function holdClock(state: SessionState, now: number): SessionState {
  if (state.held) return state;
  return { ...state, held: true, practiceMs: practiceMs(state, now), runningSince: null };
}

/** The paused run went on (or was left): practice time runs again unless the session itself is paused. */
export function releaseClock(state: SessionState, now: number): SessionState {
  if (!state.held) return state;
  return { ...state, held: false, runningSince: state.paused ? null : now };
}

function moveTo(state: SessionState, index: number, now: number): SessionState {
  return { ...state, index, itemStartedAtMs: practiceMs(state, now) };
}

/** An Attempt was stored for this item — counted as soon as it is saved, whichever way the user leaves it. */
export function markRecorded(state: SessionState, itemId: string): SessionState {
  return state.recorded.includes(itemId) ? state : { ...state, recorded: [...state.recorded, itemId] };
}

/** The current item ended (run finished, rest over): move to the next one. */
export function completeItem(state: SessionState, items: readonly RoutineItem[], now: number): SessionState {
  const item = items[state.index];
  if (!item) return state;
  const done = state.done.includes(item.id) ? state.done : [...state.done, item.id];
  return moveTo({ ...state, done }, state.index + 1, now);
}

export function skipItem(state: SessionState, items: readonly RoutineItem[], now: number): SessionState {
  const item = items[state.index];
  if (!item) return state;
  return moveTo({ ...state, skipped: [...state.skipped, item.id] }, state.index + 1, now);
}

/** The item's block time starts now (after the block transition screen, which is not block time, §7.3-13). */
export function restartItemClock(state: SessionState, now: number): SessionState {
  return { ...state, itemStartedAtMs: practiceMs(state, now) };
}

/**
 * Bar- and question-based items repeat while their block time lasts (SPEC v1.1 §7.3-12): after a run with block
 * time left, "이어서 한 번 더" (Space) is offered at the ladder's next tempo.
 */
export const REPEATABLE_TYPES: ReadonlySet<string> = new Set([
  'E5',
  'E6',
  'E8',
  'E9',
  'E10',
  'E11',
  'E17',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Q5',
  'S',
]);

/** A 5-second transition screen shows when the next item opens a different block (rests excluded, §7.3-13). */
export function opensNewBlock(
  previous: Pick<RoutineItem, 'block' | 'exerciseType'> | undefined,
  next: Pick<RoutineItem, 'block' | 'exerciseType'> | undefined,
): boolean {
  if (!next || next.exerciseType === 'REST' || previous?.exerciseType === 'REST') return false;
  return previous === undefined || previous.block !== next.block;
}

/**
 * The new-chord intro ("새 코드를 배워봅시다", D-099) opens whenever its block starts: after a skip too, and with the
 * block transition screens turned off (it comes once, when a stage brings chords never played).
 */
export function opensNewChordIntro(
  previous: Pick<RoutineItem, 'block'> | undefined,
  next: Pick<RoutineItem, 'block'> | undefined,
): boolean {
  return next?.block === 'newChord' && previous?.block !== 'newChord';
}

export const BLOCK_TRANSITION_MS = 5000;

export function previousItem(state: SessionState, now: number): SessionState {
  return state.index === 0 ? state : moveTo(state, state.index - 1, now);
}

export function isFinished(state: SessionState, items: readonly RoutineItem[]): boolean {
  return state.index >= items.length;
}

/** Remaining planned seconds of the current item (its soft budget; never forced). */
export function itemRemainingSec(state: SessionState, items: readonly RoutineItem[], now: number): number {
  const item = items[state.index];
  if (!item) return 0;
  return Math.max(0, item.durationSec - (practiceMs(state, now) - state.itemStartedAtMs) / 1000);
}

/** Break reminder due (SPEC §7.3-8): once per 30 minutes of continuous practice. */
export function breakDue(state: SessionState, now: number): boolean {
  return practiceMs(state, now) - state.breakShownAtMs >= BREAK_AFTER_MS;
}

export function acknowledgeBreak(state: SessionState, now: number): SessionState {
  const elapsed = practiceMs(state, now);
  return { ...state, breakShownAtMs: elapsed - (elapsed % BREAK_AFTER_MS) };
}

export type SessionKeyCommand = 'advance' | 'previous' | 'resume' | 'retry';

/**
 * Keyboard / pedal between runs (§12.3), so a routine can be walked without touching the screen. While a run is
 * in progress its own keys apply instead; starting an item is the exercise host's toggle/next. After a run,
 * toggle (Space) runs the item again and next (Enter, PageDown, →) moves on.
 */
export function sessionKeyCommand(
  action: KeyAction | null,
  view: { paused: boolean; isRest: boolean; runEnded: boolean; first: boolean },
): SessionKeyCommand | null {
  if (view.paused) return action === 'toggle' || action === 'next' ? 'resume' : null;
  if (action === 'prev') return view.first ? null : 'previous';
  if (action === 'toggle' && view.runEnded && !view.isRest) return 'retry';
  if (action === 'next' || action === 'toggle') return view.isRest || view.runEnded ? 'advance' : null;
  return null;
}

// --- split 30-minute sessions (SPEC v1.1 §7.3-11, D-104) ------------------------------------------------------

/**
 * The part of a split session done so far: what "이어서 하기" resumes on the same day (stored under `meta`). A
 * session can be split again while its later part runs, so the record always holds the whole session's items and
 * the runner state at the next item to do (records written before D-104 — one split, the first half — read the
 * same way).
 */
export interface SplitResume {
  sessionId: string;
  /** Local day of the last split (`dayKey`); the resume option disappears once the day changes. */
  day: string;
  stage: number;
  items: RoutineItem[];
  /** Runner state paused at the first item of the part still to do. */
  state: SessionState;
}

export const SPLIT_RESUME_KEY = 'splitResume';

/** The runner stands at the first item after the template's suggested split point (the rhythm block is done). */
export function atSplitPoint(state: SessionState, splitAfterIndex: number | null): boolean {
  return splitAfterIndex !== null && state.index === splitAfterIndex + 1;
}

/**
 * The item at `index` opens a block and a block ends right before it: a place between blocks (rests belong to
 * the block around them, as for the transition screen, §7.3-13).
 */
export function atBlockBoundary(items: readonly RoutineItem[], index: number): boolean {
  return index > 0 && index < items.length && opensNewBlock(items[index - 1], items[index]);
}

/**
 * "여기서 나눠 하기" is offered between blocks only (D-104): in a splittable session (Stage 8–11 30-minute
 * routine), when the last item of a block is behind and the next block remains — never inside a block.
 * `currentDone`: the current item's run has ended (its result is showing), so the split would come after it.
 */
export function canSplit(
  state: SessionState,
  items: readonly RoutineItem[],
  splittable: boolean,
  currentDone = false,
): boolean {
  if (!splittable || isFinished(state, items)) return false;
  return atBlockBoundary(items, currentDone ? state.index + 1 : state.index);
}

/**
 * Keeps the session for later today, paused at the next item to do. `currentDone`: the current item's run has
 * ended (its result is showing), so the kept part starts after it.
 */
export function splitHere(
  sessionId: string,
  day: string,
  stage: number,
  items: readonly RoutineItem[],
  state: SessionState,
  now: number,
  currentDone = false,
): SplitResume {
  const at = currentDone ? completeItem(state, items, now) : state;
  return { sessionId, day, stage, items: [...items], state: pause(at, now) };
}

/** Continues the kept part: same items and records, the practice time kept, a fresh clock. */
export function resumeSplit(saved: SessionState, now: number): SessionState {
  return { ...saved, paused: false, runningSince: now, itemStartedAtMs: saved.practiceMs };
}
