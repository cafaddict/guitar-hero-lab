import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { actionForKey, isEditableTarget, isNativeActivation } from '../../app/keys';
import { audioEngine, metronome, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { loadStoredState } from '../../app/storedState';
import { simulatedRate } from '../../app/testRate';
import type { RoutineItem } from '../../content/schemas';
import { voicingById } from '../../content/voicings';
import { newId } from '../../domain/ids';
import { type Attempt, dayKey, type SelfReport } from '../../domain/records';
import { generateRoutine, type RoutineInput } from '../../domain/routine';
import { prepareSession } from '../../domain/sessionPrep';
import { createExerciseOutput } from '../../exercises/audioAdapter';
import { contentContextFor } from '../../exercises/contentContext';
import { exerciseDefinition } from '../../exercises/registry';
import type { ContentContext } from '../../exercises/types';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { ChordDiagram } from '../../ui/ChordDiagram';
import { Choice, Field, TextArea } from '../../ui/Field';
import { FocusScreen } from '../../ui/FocusScreen';
import { Icon } from '../../ui/icons';
import { Phrases } from '../../ui/Phrases';
import type { CustomSessionRequest } from '../curriculum/StagePractice';
import { practiceOptions, stageContent, stageItems } from '../curriculum/stagePracticeModel';
import { routineInputFrom } from '../home/homeModel';
import { subjectLabel } from '../home/subjectLabel';
import { itemTitle } from './itemTitle';
import { type RunIdentity, repeatSuggestion, sameRunParams } from './repeat';
import { pluginParamsFor } from './routineParams';
import {
  acknowledgeBreak,
  atSplitPoint,
  BLOCK_TRANSITION_MS,
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
  SPLIT_RESUME_KEY,
  type SplitResume,
  sessionKeyCommand,
  skipItem,
  splitHere,
  startSession,
} from './sessionModel';
import { clearSplit, closeSplit, pendingSplit, saveSplitProgress } from './splitResume';

/** Session.routineId of a curriculum session (exercises picked on a stage page, D-072). */
export const CUSTOM_ROUTINE_ID = 'custom';

interface Loaded {
  items: RoutineItem[];
  stage: number;
  content: ContentContext;
  rest: boolean;
  /** "여기서 나눠 하기" is offered between items (Stage 8–11 30-minute routine, §7.3-11, D-104). */
  splittable: boolean;
  /** The template's suggested split point (last item of the rhythm block), shown as a hint, else null. */
  splitAfterIndex: number | null;
  /** What the repertoire block cycles through (§11.10 "차례로 친다"). */
  repertoire: Pick<RoutineInput, 'songs' | 'stage' | 'skills'>;
}

/**
 * A focused button is clicked by the keyup of Space. When Space was used as a session command on keydown, that
 * keyup must not also click whatever button holds the focus.
 */
function swallowNextSpaceKeyup(): void {
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    window.removeEventListener('keyup', onKeyUp, true);
  };
  window.addEventListener('keyup', onKeyUp, true);
}

/** Simulated ms (E2E builds may compress time; production rate is 1). */
function useClock(): () => number {
  return useMemo(() => {
    const rate = simulatedRate();
    return () => performance.now() * rate;
  }, []);
}

function RestItem({ item, now, onDone }: { item: RoutineItem; now: () => number; onDone: () => void }) {
  const [endsAt] = useState(() => now() + item.durationSec * 1000);
  const [left, setLeft] = useState(item.durationSec);
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) onDone();
    }, 200);
    return () => clearInterval(id);
  }, [endsAt, now, onDone]);
  return (
    <Card as="section" className="flex flex-col items-center gap-4 py-10 text-center" data-testid="rest-item">
      <p className="text-2xl font-bold tabular-nums">{ko.session.rest(left)}</p>
      {/* The seconds left read from the stand like the block countdown (UI SPEC §5.1: same role, same size). */}
      <p className="font-bold tabular-nums leading-none" data-core-number aria-hidden="true">
        <span style={{ fontSize: 'clamp(3rem, 16vh, 13rem)' }}>{left}</span>
      </p>
      <div data-primary-action>
        <Button autoFocus onClick={onDone}>
          {ko.session.restSkip}
        </Button>
      </div>
    </Card>
  );
}

function SelfReportForm({ onSave, onBack }: { onSave: (report: SelfReport) => void; onBack: () => void }) {
  const [pain, setPain] = useState(0);
  const [difficulty, setDifficulty] = useState(3);
  const [flags, setFlags] = useState<SelfReport['dangerFlags'][number][]>([]);
  const [note, setNote] = useState('');
  const toggle = (flag: SelfReport['dangerFlags'][number]) =>
    setFlags((f) => (f.includes(flag) ? f.filter((x) => x !== flag) : [...f, flag]));
  return (
    <Card as="section" className="flex w-full max-w-2xl flex-col gap-5" data-testid="self-report">
      <h2 className="text-2xl font-bold">{ko.session.reportTitle}</h2>
      <label className="flex flex-col gap-1">
        <span className="text-lg font-semibold tabular-nums">{ko.session.pain(pain)}</span>
        <input
          type="range"
          min={0}
          max={10}
          value={pain}
          onChange={(e) => setPain(Number(e.target.value))}
          data-testid="report-pain"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-lg font-semibold tabular-nums">{ko.session.difficulty(difficulty)}</span>
        <input
          type="range"
          min={1}
          max={5}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
          data-testid="report-difficulty"
        />
      </label>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 text-lg font-semibold">{ko.session.dangerLegend}</legend>
        {(['sharp', 'numbness', 'joint'] as const).map((flag) => (
          <Choice
            key={flag}
            type="checkbox"
            label={ko.session.danger[flag]}
            className="pr-3"
            checked={flags.includes(flag)}
            onChange={() => toggle(flag)}
          />
        ))}
      </fieldset>
      <p className="text-sm text-muted">{ko.safety.notMedicalAdvice}</p>
      <Field label={ko.session.note}>
        <TextArea className="min-h-24" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-3">
        <div data-primary-action>
          <Button
            large
            onClick={() => onSave({ pain, difficulty, dangerFlags: flags, note })}
            data-testid="report-save"
          >
            {ko.session.save}
          </Button>
        </div>
        {/* Reached by mistake (one Enter too many, "세션 끝내기"): back to the practice, nothing is lost (D-096). */}
        <Button large variant="secondary" className="min-w-16" onClick={onBack} data-testid="report-back">
          <Icon name="back" />
          {ko.session.backToPractice}
        </Button>
      </div>
      <p className="text-sm text-muted">{ko.session.exitWithoutReport}</p>
    </Card>
  );
}

/** Session runner (SPEC §12.1): today's routine item by item, then the self report. */
export function SessionScreen() {
  const navigate = useNavigate();
  const now = useClock();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  /** "이어서 하기": the second half of a split session continues the same session (§7.3-11). */
  const resuming = useSearchParams()[0].get('resume') !== null;
  /** A curriculum session (exercises picked on a stage page, D-072) instead of today's routine. */
  const customState = (useLocation().state as { custom?: CustomSessionRequest } | null)?.custom;
  const customKey = customState ? JSON.stringify(customState) : null;
  const custom = useMemo(
    () => (customKey ? (JSON.parse(customKey) as CustomSessionRequest) : null),
    [customKey],
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** The kept first half this runner resumed (its record follows the second half's progress). */
  const [resumedSplit, setResumedSplit] = useState<SplitResume | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  /** Index of the item whose run has ended (its summary is showing). */
  const [endedIndex, setEndedIndex] = useState<number | null>(null);
  /** An exercise run is starting or in progress: navigation would throw it away, so it waits. */
  const [runActive, setRunActive] = useState(false);
  /** Reruns of the current item: each one is a fresh host; `params` overrides the routine's (suggested tempo). */
  /**
   * Reruns of the current item: each one is a fresh host. `params` overrides the routine's (suggested tempo, next
   * repertoire song); `identity` files the run under another subject when the song changed (§11.10).
   */
  const [rerun, setRerun] = useState<{ n: number; params: unknown; identity: RunIdentity | null }>({
    n: 0,
    params: null,
    identity: null,
  });
  const customKeys = useSettingsStore((s) => s.settings?.customKeys);
  const blockTransition = useSettingsStore((s) => s.settings?.blockTransition ?? true);
  const leftHanded = useSettingsStore((s) => s.settings?.leftHanded ?? false);
  /** The stored attempt of the current item's last run (its suggested tempo drives "이어서 한 번 더"). */
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  /** Each item's latest stored attempt: going back shows it again (D-096). */
  const [results, setResults] = useState<ReadonlyMap<string, Attempt>>(() => new Map());
  /** The host opens on the item's latest result: set by moving back, cleared by moving forward or a rerun. */
  const [restore, setRestore] = useState(false);
  /** Item id whose block time ran out (signal shown once). */
  const [blockEndedFor, setBlockEndedFor] = useState<string | null>(null);
  /** Transition screen before a new block (§7.3-13): ends at this simulated time. */
  const [transitionEndsAt, setTransitionEndsAt] = useState<number | null>(null);
  const [showBreak, setShowBreak] = useState(false);
  const [ending, setEnding] = useState(false);
  /** The running exercise's "이전 항목" (asks first once the run is under way, D-096); null while none is up. */
  const [previousRequest, setPreviousRequest] = useState<(() => void) | null>(null);
  // A function in state is stored through the updater form.
  const registerPrevious = useCallback(
    (request: (() => void) | null) => setPreviousRequest(() => request),
    [],
  );
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loadedAt = Date.now();
      const split = await pendingSplit(loadedAt);
      if (resuming && split) {
        const resumed = await loadStoredState(loadedAt);
        if (cancelled) return;
        setLoaded({
          items: split.items,
          stage: split.stage,
          content: contentContextFor(resumed.progression),
          rest: false,
          // A resumed part can be split again (D-104); the suggested point is behind it.
          splittable: true,
          splitAfterIndex: null,
          repertoire: { songs: resumed.songs, stage: split.stage, skills: resumed.skills },
        });
        setSessionId(split.sessionId);
        setResumedSplit(split);
        setState(resumeSplit(split.state, now()));
        return;
      }
      // "시작" while today's first half is kept: that half ends as it is (it counts) and a new session starts.
      if (split) await closeSplit(split);
      const stored = await loadStoredState(loadedAt);
      if (custom) {
        // Curriculum session (D-072): the picked exercises of that stage, in the picked order.
        const all = practiceOptions(custom.stage);
        const chosen = custom.options.flatMap((i) => (all[i] ? [all[i]] : []));
        const { items } = stageItems(stored, custom.stage, chosen, loadedAt);
        if (cancelled) return;
        setLoaded({
          items,
          stage: custom.stage,
          content: stageContent(stored, custom.stage),
          rest: false,
          splittable: false,
          splitAfterIndex: null,
          repertoire: { songs: stored.songs, stage: custom.stage, skills: stored.skills },
        });
        if (items.length === 0) return;
        const id = newId();
        setSessionId(id);
        await repo.startSession({
          id,
          startedAt: Date.now(),
          endedAt: null,
          routineId: CUSTOM_ROUTINE_ID,
          plannedItems: items.length,
          completedItems: 0,
          selfReport: null,
          stage: custom.stage,
        });
        if (!cancelled) setState(startSession(now()));
        return;
      }
      // Session start (SPEC v1.1 §7.4): expire prescriptions, detect stagnation, then plan the routine.
      const prep = prepareSession({
        progression: stored.progression,
        skills: stored.skills,
        recentSamples: stored.recentSamples,
        sessionNumber: stored.history.sessionNumber,
        now: loadedAt,
      });
      if (prep.added.length > 0 || prep.expired.length > 0) await repo.saveProgression(prep.progression);
      const plan = generateRoutine(routineInputFrom({ ...stored, progression: prep.progression }, loadedAt));
      if (cancelled) return;
      const items = plan.kind === 'rest' ? [] : plan.items;
      setLoaded({
        items,
        stage: stored.progression.stage,
        content: contentContextFor(stored.progression),
        rest: plan.kind === 'rest',
        splittable: plan.kind !== 'rest' && plan.splitAfterIndex !== null,
        splitAfterIndex: plan.kind === 'rest' ? null : plan.splitAfterIndex,
        repertoire: { songs: stored.songs, stage: stored.progression.stage, skills: stored.skills },
      });
      if (plan.kind === 'rest') return;
      const id = newId();
      setSessionId(id);
      await repo.startSession({
        id,
        startedAt: Date.now(),
        endedAt: null,
        routineId: null,
        plannedItems: items.filter((i) => i.exerciseType !== 'REST').length,
        completedItems: 0,
        selfReport: null,
        stage: stored.progression.stage,
      });
      if (!cancelled) setState(startSession(now()));
    })();
    return () => {
      cancelled = true;
    };
  }, [resuming, now, custom]);

  // Once per second: item budget display and the 30-minute break reminder (decided outside the state updater).
  const stateRef = useRef<SessionState | null>(null);
  stateRef.current = state;
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      const s = stateRef.current;
      if (s && !s.paused && breakDue(s, now())) {
        setShowBreak(true);
        setState(acknowledgeBreak(s, now()));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [now]);

  const items = loaded?.items ?? [];
  const go = useCallback((step: (s: SessionState) => SessionState) => {
    setRestore(false);
    setEndedIndex(null);
    setLastAttempt(null);
    setTransitionEndsAt(null);
    // Every move restarts the item's clock: a revisited item gets its block time and its end signal again.
    setBlockEndedFor(null);
    setRerun({ n: 0, params: null, identity: null });
    setState((s) => (s ? step(s) : s));
  }, []);
  /**
   * The host of the item at `index` opens on that item's latest result, if any (D-096). The after-run state is set
   * with the move itself, so Space / Enter act on the shown result from its first frame.
   */
  const showResultOf = useCallback(
    (index: number) => {
      const attempt = results.get(items[index]?.id ?? '') ?? null;
      setRestore(true);
      setEndedIndex(attempt ? index : null);
      setLastAttempt(attempt);
    },
    [results, items],
  );
  const toPrevious = useCallback(() => {
    const index = stateRef.current?.index ?? 0;
    if (index === 0) return;
    // After go's reset (same batch): moving back restores, moving forward starts fresh.
    go((s) => previousItem(s, now()));
    showResultOf(index - 1);
  }, [go, now, showResultOf]);
  const advance = useCallback(() => {
    go((s) => completeItem(s, items, now()));
    const index = state?.index ?? 0;
    const [from, to] = [items[index], items[index + 1]];
    if ((blockTransition && opensNewBlock(from, to)) || opensNewChordIntro(from, to))
      setTransitionEndsAt(now() + BLOCK_TRANSITION_MS);
  }, [go, items, now, state?.index, blockTransition]);
  const skip = useCallback(() => {
    go((s) => skipItem(s, items, now()));
    const index = state?.index ?? 0;
    if (opensNewChordIntro(items[index], items[index + 1])) setTransitionEndsAt(now() + BLOCK_TRANSITION_MS);
  }, [go, items, now, state?.index]);
  const endTransition = useCallback(() => {
    setTransitionEndsAt(null);
    // The block's own time starts after the transition screen (§7.3-13).
    setState((s) => (s ? restartItemClock(s, now()) : s));
  }, [now]);

  // Block end signal (§7.3-12): a short cue and a big "블록 끝" once the item's block time is used up.
  useEffect(() => {
    if (!state || state.paused || transitionEndsAt !== null) return;
    const item = items[state.index];
    if (!item || item.exerciseType === 'REST' || blockEndedFor === item.id) return;
    if (itemRemainingSec(state, items, now()) === 0) {
      setBlockEndedFor(item.id);
      createExerciseOutput(audioEngine, metronome).cue('end');
    }
  });
  useEffect(() => {
    if (transitionEndsAt === null) return;
    const id = setInterval(() => {
      if (now() >= transitionEndsAt) endTransition();
    }, 100);
    return () => clearInterval(id);
  }, [transitionEndsAt, endTransition, now]);
  /** The current item again: with the params it just ran with, or with `params` (e.g. a suggested tempo). */
  const retry = useCallback((params?: unknown, identity?: RunIdentity | null) => {
    setRestore(false);
    setEndedIndex(null);
    setRerun((r) => ({
      n: r.n + 1,
      params: params === undefined ? r.params : params,
      identity: identity === undefined ? r.identity : identity,
    }));
  }, []);

  // The resumed half's progress goes back into its kept record (reload / leave → resume there, §7.3-11).
  const progressKey = state ? `${state.index}:${state.recorded.length}` : '';
  useEffect(() => {
    if (!resumedSplit || !stateRef.current || !progressKey) return;
    void saveSplitProgress(resumedSplit, stateRef.current, now());
  }, [resumedSplit, progressKey, now]);

  /** "이어서 한 번 더" at the ladder's next tempo while block time remains (§7.3-12). */
  const repeat = (() => {
    const item = state ? items[state.index] : undefined;
    if (!item || !lastAttempt || !loaded || !REPEATABLE_TYPES.has(item.exerciseType)) return undefined;
    return repeatSuggestion(item, lastAttempt, loaded.repertoire) ?? undefined;
  })();

  // Keyboard / pedal between runs (§12.3); during a run the exercise's own keys apply.
  const between = state !== null && !runActive && !ending && !isFinished(state, items);
  useEffect(() => {
    if (!between || !state) return;
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (transitionEndsAt !== null) {
        // Transition screen: Enter / Space / → start the block now, ← goes back.
        const action = actionForKey(event, customKeys ?? {});
        if (action === 'next' || action === 'toggle') {
          if (isNativeActivation(event)) return;
          event.preventDefault();
          endTransition();
        } else if (action === 'prev') {
          event.preventDefault();
          toPrevious();
        }
        return;
      }
      const command = sessionKeyCommand(actionForKey(event, customKeys ?? {}), {
        paused: state.paused,
        isRest: items[state.index]?.exerciseType === 'REST',
        runEnded: endedIndex === state.index,
        first: state.index === 0,
      });
      if (!command) return;
      // After a run Space means "again" even with the focus on the next-item button; Enter on a focused button
      // keeps that button's own action.
      if (command !== 'retry' && isNativeActivation(event)) return;
      event.preventDefault();
      if (command === 'retry') {
        if (event.key === ' ') swallowNextSpaceKeyup();
        // The run's own params: a tempo picked before the start carries over (D-098).
        retry(repeat?.params ?? sameRunParams(lastAttempt), repeat?.identity);
      } else if (command === 'advance') advance();
      else if (command === 'previous') toPrevious();
      else setState(resume(state, now()));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    between,
    state,
    items,
    endedIndex,
    customKeys,
    advance,
    toPrevious,
    retry,
    now,
    transitionEndsAt,
    endTransition,
    repeat,
    lastAttempt,
  ]);

  // The self report reached by mistake goes back (D-096): after "세션 끝내기" to the item it was on, after the last
  // item to that item.
  const backToPractice = useCallback(() => {
    if (ending) {
      setEnding(false);
      if (stateRef.current) showResultOf(stateRef.current.index);
    } else toPrevious();
  }, [ending, toPrevious, showResultOf]);
  const reporting = state !== null && (ending || isFinished(state, items));
  useEffect(() => {
    if (!reporting) return;
    const onKey = (event: KeyboardEvent) => {
      // The pain and difficulty sliders move with ←.
      if (isEditableTarget(event.target) || actionForKey(event, customKeys ?? {}) !== 'prev') return;
      event.preventDefault();
      backToPractice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reporting, customKeys, backToPractice]);

  /** Ends the session; `null` = left with "나가기" without the self report (D-095: the practice still counts). */
  const finishSession = async (report: SelfReport | null) => {
    if (!state || !sessionId) return;
    await repo.finishSession(sessionId, Date.now(), state.recorded.length, report, practiceMs(state, now()));
    await clearSplit(sessionId);
    navigate('/');
  };

  /**
   * "여기서 나눠 하기" at the boundary the user picked: keep the rest for later today; the session stays open until
   * it ends (§7.3-11). A resumed part replaces its own record, so a session splits as often as wanted (D-104).
   */
  const splitSession = async () => {
    if (!state || !sessionId || !loaded) return;
    await repo.setMeta(
      SPLIT_RESUME_KEY,
      splitHere(
        sessionId,
        dayKey(Date.now()),
        loaded.stage,
        loaded.items,
        state,
        now(),
        endedIndex === state.index,
      ),
    );
    navigate('/');
  };

  const toHome = { to: '/' };
  if (!loaded) return <FocusScreen title={ko.session.title} exit={toHome} busy />;
  if (loaded.rest) {
    return (
      <FocusScreen title={ko.session.title} exit={toHome}>
        <p className="text-retry">{ko.safety.restDay}</p>
      </FocusScreen>
    );
  }
  if (custom && loaded.items.length === 0)
    return (
      <FocusScreen title={ko.session.title} exit={toHome}>
        <p data-testid="custom-session-empty">{ko.curriculum.practice.noneHint}</p>
      </FocusScreen>
    );
  if (!state || !sessionId) return <FocusScreen title={ko.session.title} exit={toHome} busy />;

  if (ending || isFinished(state, items)) {
    return (
      // "나가기" here ends the session without a report: leaving must not lose today's practice (D-095).
      <FocusScreen title={ko.session.title} exit={{ onExit: () => void finishSession(null) }}>
        <SelfReportForm onSave={(report) => void finishSession(report)} onBack={backToPractice} />
      </FocusScreen>
    );
  }

  const item = items[state.index]!;
  const next = items[state.index + 1];
  const budget = itemRemainingSec(state, items, now());
  const definition = item.exerciseType === 'REST' ? null : exerciseDefinition(item.exerciseType);
  // The new-chord intro names every chord of its block (D-099).
  const newChords =
    item.block === 'newChord'
      ? items
          .filter((i) => i.block === 'newChord' && typeof i.params.voicingId === 'string')
          .map((i) => subjectLabel(`chord:${String(i.params.voicingId)}`))
      : null;

  return (
    // "나가기" is the session's own end (self report), like "세션 끝내기"; locked while a run is active.
    <FocusScreen title={ko.session.title} exit={{ onExit: () => setEnding(true) }} exitDisabled={runActive}>
      <div
        className="mb-5"
        data-testid="session-header"
        data-index={state.index}
        data-item-type={item.exerciseType}
        data-block={item.block}
        data-count={items.length}
      >
        {/* Where the session is: done items filled, the current one filled and taller (a shape, not a tint). */}
        <div aria-hidden="true" className="mb-4 flex items-center gap-1">
          {items.map((it, i) => (
            <span
              key={it.id}
              className={`flex-1 rounded-full ${
                i < state.index
                  ? 'h-1.5 bg-accent'
                  : i === state.index
                    ? 'h-3 bg-accent'
                    : 'h-1.5 bg-surface-2'
              }`}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            {/* The block name, unless the item is named the same ("튜닝 · 튜닝"). */}
            {ko.home.blocks[item.block] !== itemTitle(item) && (
              <p className="text-sm font-semibold text-accent">{ko.home.blocks[item.block]}</p>
            )}
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="inline-block">
                <span className="tabular-nums text-muted">
                  {ko.session.itemOf(state.index + 1, items.length)}
                </span>{' '}
                ·
              </span>{' '}
              <Phrases text={itemTitle(item)} />
            </h2>
          </div>
          <p
            className={`inline-flex shrink-0 items-center gap-1.5 tabular-nums ${budget === 0 ? 'text-retry' : 'text-muted'}`}
          >
            <Icon name="clock" size={16} />
            {budget === 0 ? ko.session.budgetOver : ko.session.itemBudget(budget)}
          </p>
        </div>
      </div>
      {showBreak && (
        <Card role="alert" tone="retry" className="mb-4">
          <p>{ko.session.breakReminder}</p>
          <Button className="mt-3" variant="secondary" onClick={() => setShowBreak(false)}>
            {ko.session.breakOk}
          </Button>
        </Card>
      )}
      {blockEndedFor === item.id && transitionEndsAt === null && (
        <p
          role="status"
          className="mb-4 rounded-2xl bg-accent-soft p-5 text-center text-4xl font-black text-fg"
          data-testid="block-end"
        >
          {ko.session.blockEnd}
        </p>
      )}
      {transitionEndsAt !== null ? (
        <Card
          as="section"
          className="flex flex-col items-center gap-4 py-8 text-center lg:py-12"
          data-testid="block-transition"
        >
          <p className="text-lg font-semibold text-accent">
            {ko.session.transitionNext(ko.home.blocks[item.block])}
          </p>
          <p className="text-3xl font-bold sm:text-4xl">
            <Phrases text={newChords ? ko.session.newChordsIntro : itemTitle(item)} />
          </p>
          {newChords && (
            <p className="text-xl font-semibold" data-testid="new-chords">
              <Phrases text={newChords.join(' · ')} />
            </p>
          )}
          {item.exerciseType === 'E1' && typeof item.params.voicingId === 'string' && (
            // Smaller on a phone: the diagram, the countdown and "바로 시작" all fit the first screen (F-52); the
            // new-chord intro's extra line of names takes its height back from the diagram (iPad landscape).
            <div className={newChords ? 'w-28 sm:w-32' : 'w-28 sm:w-40'}>
              <ChordDiagram voicing={voicingById(item.params.voicingId)} leftHanded={leftHanded} />
            </div>
          )}
          {/* The countdown to the block is a count-in: a key number read from the music stand. */}
          <p className="font-bold tabular-nums leading-none" data-core-number aria-hidden="true">
            <span style={{ fontSize: 'clamp(3rem, 16vh, 13rem)' }}>
              {Math.max(0, Math.ceil((transitionEndsAt - now()) / 1000))}
            </span>
          </p>
          <p className="tabular-nums text-muted">
            {ko.session.transitionIn(Math.max(0, Math.ceil((transitionEndsAt - now()) / 1000)))}
          </p>
          <div data-primary-action>
            <Button large autoFocus onClick={endTransition} data-testid="transition-start">
              {ko.session.transitionStart}
            </Button>
          </div>
        </Card>
      ) : state.paused ? (
        <Card as="section" tone="retry" className="flex flex-col items-center gap-5 py-10 text-center">
          <p className="flex items-center gap-3 text-3xl font-bold text-retry">
            <Icon name="pause" size={28} />
            {ko.session.paused}
          </p>
          <div data-primary-action>
            <Button large autoFocus onClick={() => setState(resume(state, now()))}>
              <Icon name="play" />
              {ko.session.resume}
            </Button>
          </div>
        </Card>
      ) : item.exerciseType === 'REST' ? (
        <RestItem key={item.id} item={item} now={now} onDone={advance} />
      ) : definition ? (
        <ExerciseHost
          key={`${item.id}#${rerun.n}`}
          definition={definition}
          params={rerun.params ?? pluginParamsFor(item, definition, loaded.content)}
          content={loaded.content}
          sessionId={sessionId}
          reviewOf={rerun.identity ? rerun.identity.reviewOf : (item.reviewOf ?? null)}
          routineKey={rerun.identity ? rerun.identity.routineKey : (item.key ?? null)}
          autoFocusStart
          onActiveChange={setRunActive}
          onPrevious={state.index > 0 ? toPrevious : undefined}
          registerPrevious={registerPrevious}
          restoredAttempt={restore ? (results.get(item.id) ?? null) : null}
          onPausedChange={(paused) =>
            setState((s) => s && (paused ? holdClock(s, now()) : releaseClock(s, now())))
          }
          onFinished={(attempt) => {
            setEndedIndex(state.index);
            setLastAttempt(attempt);
            if (!attempt) return;
            setState((s) => (s ? markRecorded(s, item.id) : s));
            setResults((r) => (r.get(item.id) === attempt ? r : new Map(r).set(item.id, attempt)));
          }}
          renderAfter={(attempt) => {
            const tempo = attempt ? definition.suggestedTempoRetry(attempt.params, attempt.result) : null;
            const repeatable = REPEATABLE_TYPES.has(item.exerciseType) && budget > 0 && attempt !== null;
            const suggestion = attempt ? repeatSuggestion(item, attempt, loaded.repertoire) : null;
            return (
              <div className="mt-5 flex flex-wrap gap-3">
                <div data-primary-action>
                  <Button large autoFocus onClick={advance} data-testid="next-item">
                    {ko.session.nextItem}
                  </Button>
                </div>
                {repeatable && (
                  <Button
                    large
                    variant="secondary"
                    onClick={() => retry(suggestion?.params ?? sameRunParams(attempt), suggestion?.identity)}
                    data-testid="repeat-item"
                  >
                    {suggestion ? suggestion.label : ko.session.repeat}
                  </Button>
                )}
                <Button
                  large
                  variant="secondary"
                  onClick={() => retry(sameRunParams(attempt))}
                  data-testid="retry-item"
                >
                  {repeatable ? ko.session.sameTempo : tempo ? ko.session.retrySameTempo : ko.session.retry}
                </Button>
                {tempo && !repeatable && (
                  <Button
                    large
                    variant="secondary"
                    onClick={() => retry(tempo.params)}
                    data-testid="retry-tempo"
                  >
                    {ko.session.retryAtBpm(tempo.bpm)}
                  </Button>
                )}
              </div>
            );
          }}
        />
      ) : (
        <Button onClick={skip}>{ko.session.skip}</Button>
      )}
      <p className="mt-6 text-muted">
        <Phrases text={next ? ko.session.next(itemTitle(next)) : ko.session.lastItem} />
      </p>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-4">
        {/* During a run it ends the run first (asking once it is under way, D-096); skip and end still wait. */}
        <Button
          variant="secondary"
          disabled={state.index === 0 || (runActive && previousRequest === null)}
          onClick={() => (runActive ? previousRequest?.() : toPrevious())}
        >
          {ko.session.previous}
        </Button>
        <Button variant="secondary" disabled={runActive} onClick={skip} data-testid="skip-item">
          {ko.session.skip}
        </Button>
        {!state.paused && (
          <Button variant="secondary" disabled={runActive} onClick={() => setState(pause(state, now()))}>
            {ko.session.pause}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={runActive}
          onClick={() => setEnding(true)}
          data-testid="end-session"
        >
          {ko.session.end}
        </Button>
        {/* Any place between blocks can be the split point (D-104); the template's suggestion is a hint below. */}
        {canSplit(state, items, loaded.splittable, endedIndex === state.index) && (
          <Button
            variant="secondary"
            disabled={runActive}
            onClick={() => void splitSession()}
            data-testid="split-session"
          >
            {ko.session.splitHere}
          </Button>
        )}
      </div>
      {!runActive && loaded.splittable && atSplitPoint(state, loaded.splitAfterIndex) && (
        <Card tone="notice" className="mt-4" data-testid="split-point">
          <p>{ko.session.splitPoint}</p>
        </Card>
      )}
      {runActive && <p className="mt-2 text-muted">{ko.session.finishRunFirst}</p>}
    </FocusScreen>
  );
}
