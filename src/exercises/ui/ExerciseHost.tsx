/**
 * Hosts one exercise run: microphone start (inside the tap, iOS), context assembly, the requestAnimationFrame
 * tick, keyboard/pedal commands (Esc asks first), Wake Lock, and saving the Attempt when the runner is done.
 * Used standalone (/practice/:type) and by the session runner.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import {
  actionForKey,
  isEditableTarget,
  isMarkedNativeActivation,
  isNativeActivation,
  NATIVE_KEYS_ATTR,
} from '../../app/keys';
import { audioEngine, captureReady, metronome, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { simulatedRate } from '../../app/testRate';
import { wakeLock } from '../../audio/wakeLock';
import { newId } from '../../domain/ids';
import type { Attempt } from '../../domain/records';
import { personalOffset } from '../../dsp/timing';
import { MicStatusPanel } from '../../features/mic/MicStatusPanel';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { useExitGuard } from '../../ui/FocusScreen';
import { Icon } from '../../ui/icons';
import { Phrases } from '../../ui/Phrases';
import { createExerciseMic, createExerciseOutput } from '../audioAdapter';
import { contentContextFor } from '../contentContext';
import type { ExerciseDefinition } from '../registry';
import type { ContentContext, ExerciseContext, ExerciseRunner } from '../types';
import { saveEarphoneChoice } from './earphoneSetting';
import { HowToPanel } from './HowToPanel';
import { useRunnerSnapshot } from './hooks';
import { MicFeedback } from './MicFeedback';
import { PracticeStage, RunControlsContext } from './PracticeStage';
import { prevRoute } from './prevRoute';

export interface ExerciseHostProps {
  definition: ExerciseDefinition;
  params: unknown;
  sessionId?: string | null;
  reviewOf?: string | null;
  /** Routine item key stored on the attempt (last-appearance tracking, SPEC v1.1 §7.3). */
  routineKey?: string | null;
  /** Called when the run ended: the stored Attempt, or null when there was nothing to record. */
  onFinished?: (attempt: Attempt | null) => void;
  /** Extra actions under the summary (e.g. "again" / "home" in standalone mode). */
  renderAfter?: (attempt: Attempt | null) => React.ReactNode;
  /** Focus the start button (session runner: keyboard-only flow). */
  autoFocusStart?: boolean;
  /** True from the start tap until the run ended (the session runner locks its navigation meanwhile). */
  onActiveChange?: (active: boolean) => void;
  /** True while a pausable run is paused (D-085): the session runner holds its practice clock meanwhile. */
  onPausedChange?: (paused: boolean) => void;
  /** Content to run with (a curriculum stage other than the current one, D-072); default the current stage's. */
  content?: ContentContext;
  /**
   * Session only, absent at the first item: go to the previous item (D-096). During a run ← / "이전 항목" ends
   * the run first (as "중단" does) and calls this once what was played is stored.
   */
  onPrevious?: (() => void) | undefined;
  /** Receives the running exercise's "이전 항목" request (asks first once the run is under way), null when none. */
  registerPrevious?: ((request: (() => void) | null) => void) | undefined;
  /**
   * Opens on this stored result instead of the start screen (the session went back to an item already run,
   * D-096). It is shown, not reopened: a rerun is a new Attempt. `onFinished` is not called for it — the caller
   * already knows it.
   */
  restoredAttempt?: Attempt | null | undefined;
}

interface Running {
  runner: ExerciseRunner<unknown, unknown>;
  ctx: ExerciseContext;
  startedAt: number;
  /** Params of this run (after history adjustments) — stored in the Attempt. */
  params: unknown;
}

/**
 * Stable personal lead/lag from the latest timing runs of this exercise (≥ 3 runs, SPEC §10.8): the mean strum
 * offset (E5) or the beat-1 delay (E6).
 */
function personalOffsetFrom(recent: readonly Attempt[]): number | null {
  const offsets = recent
    .map((a) => {
      if (typeof a.result !== 'object' || a.result === null) return undefined;
      const r = a.result as { meanOffsetMs?: unknown; beat1DelayMsMean?: unknown };
      return r.meanOffsetMs ?? r.beat1DelayMsMean;
    })
    .filter((x): x is number => typeof x === 'number');
  return personalOffset(offsets);
}

function useAnimationTick(runner: ExerciseRunner<unknown, unknown> | null): void {
  useEffect(() => {
    if (!runner) return;
    let frame = 0;
    const loop = () => {
      runner.tick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [runner]);
}

/** Phases a pausable run shows its pause button in (D-085). */
const PAUSE_PHASES: ReadonlySet<string> = new Set(['countIn', 'running', 'paused']);

/** Phases before anything was played: going back to the previous item loses nothing, so it does not ask. */
const WAITING_PHASES: ReadonlySet<string> = new Set(['ready', 'armed']);

function RunningExercise({
  definition,
  params,
  running,
  onDone,
  onPausedChange,
  onPrevious,
  registerPrevious,
}: {
  definition: ExerciseDefinition;
  params: unknown;
  running: Running;
  onDone: () => void;
  onPausedChange: ((paused: boolean) => void) | undefined;
  onPrevious: (() => void) | undefined;
  registerPrevious: ((request: (() => void) | null) => void) | undefined;
}) {
  const { runner, ctx } = running;
  const snapshot = useRunnerSnapshot(runner);
  const settings = useSettingsStore((s) => s.settings);
  /** The open question: stop the run (Esc, "중단"), or end it and go to the previous item (D-096). */
  const [confirm, setConfirm] = useState<'abort' | 'previous' | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  useAnimationTick(runner);
  // "나가기" during a run asks the same question as Esc (D-094).
  useExitGuard(useCallback(() => setConfirm('abort'), []));
  // The question appears above the stage: bring it into view and give it the focus (the dialog itself, not its
  // "yes" button — Space would then click it, where the run's keys read Space as "keep going").
  useEffect(() => {
    if (!confirm) return;
    confirmRef.current?.scrollIntoView({ block: 'nearest' });
    confirmRef.current?.focus();
  }, [confirm]);

  const waiting = WAITING_PHASES.has(snapshot.phase);
  // Before anything was played the previous item is a plain move; afterwards going back ends the run, so it asks.
  const askPrevious = useCallback(() => {
    if (!onPrevious) return;
    if (waiting) onPrevious();
    else setConfirm('previous');
  }, [onPrevious, waiting]);
  useEffect(() => {
    if (!registerPrevious || !onPrevious) return;
    registerPrevious(askPrevious);
    return () => registerPrevious(null);
  }, [registerPrevious, onPrevious, askPrevious]);

  useEffect(() => {
    if (snapshot.phase === 'done') onDone();
  }, [snapshot.phase, onDone]);

  // Through a ref like onActiveChange: an inline callback would re-run the effect on every render.
  const paused = snapshot.phase === 'paused';
  const onPausedChangeRef = useRef(onPausedChange);
  onPausedChangeRef.current = onPausedChange;
  useEffect(() => {
    if (!paused) return;
    onPausedChangeRef.current?.(true);
    return () => onPausedChangeRef.current?.(false);
  }, [paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const action = actionForKey(event, settings?.customKeys ?? {});
      if (confirm === 'previous') {
        // A pedal has prev beside next: either one confirms. Anything else — Esc too — keeps the run.
        event.preventDefault();
        if (action === 'prev' || action === 'next') onPrevious?.();
        setConfirm(null);
        return;
      }
      if (confirm === 'abort') {
        event.preventDefault();
        if (action === 'abort' || action === 'next') runner.command('abort');
        setConfirm(null);
        return;
      }
      // Space/Enter on the focused pause button: its own click pauses or resumes, once (D-085).
      if (isMarkedNativeActivation(event)) return;
      // Only metronome exercises pause; elsewhere P does nothing.
      if (!action || (action === 'pause' && !definition.pausable)) return;
      event.preventDefault();
      if (action === 'abort') setConfirm('abort');
      else if (
        action === 'prev' &&
        prevRoute({
          canStepBack: runner.canStepBack?.() ?? false,
          inSession: onPrevious !== undefined,
          waiting,
        }) !== 'runner'
      )
        askPrevious();
      else runner.command(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runner, confirm, settings?.customKeys, definition.pausable, onPrevious, waiting, askPrevious]);

  const showPause = definition.pausable && PAUSE_PHASES.has(snapshot.phase);
  // Large (≥ 64 px, SPEC §12.3): it is tapped with a hand coming off the guitar mid-run. The view's stage places
  // it: the next step while paused, beside the view's own controls while running (D-090).
  const pauseButton = showPause ? (
    <Button
      large
      variant={paused ? 'primary' : 'secondary'}
      aria-pressed={paused}
      onClick={() => runner.command('pause')}
      data-testid="exercise-pause"
      {...{ [NATIVE_KEYS_ATTR]: '' }}
    >
      <Icon name={paused ? 'play' : 'pause'} />
      {paused ? ko.exercises.common.resume : ko.exercises.common.pause}
    </Button>
  ) : null;

  const howTo = definition.howTo(params);
  return (
    <RunControlsContext.Provider
      value={{
        pause: pauseButton,
        paused: showPause && paused,
        feedback: definition.usesMicrophone ? <MicFeedback ctx={ctx} /> : null,
      }}
    >
      {howTo && <HowToPanel howTo={howTo} open={false} className="mb-5" />}
      {confirm && (
        <div
          ref={confirmRef}
          role="alertdialog"
          aria-label={confirm === 'abort' ? ko.keys.confirmAbort : ko.keys.confirmPrevious}
          tabIndex={-1}
          className="mb-5"
        >
          <Card tone="retry">
            <p className="text-lg font-semibold">
              {confirm === 'abort' ? ko.keys.confirmAbort : ko.keys.confirmPrevious}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {confirm === 'abort' ? (
                <Button onClick={() => runner.command('abort')}>{ko.keys.abortYes}</Button>
              ) : (
                <Button onClick={() => onPrevious?.()}>{ko.keys.previousYes}</Button>
              )}
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                {ko.keys.abortNo}
              </Button>
            </div>
          </Card>
        </div>
      )}
      {definition.renderView({ runner, params, ctx })}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-4">
        <Button variant="secondary" onClick={() => runner.command('abort')} data-testid="exercise-finish">
          {ko.exercises.common.finish}
        </Button>
        {!ctx.audio && definition.usesMicrophone && <p className="text-muted">{ko.exercises.common.noMic}</p>}
        <p className="text-muted sm:ml-auto">
          <Phrases text={ko.keys.hint(definition.pausable)} />
        </p>
      </div>
    </RunControlsContext.Provider>
  );
}

type Outcome =
  | { kind: 'saved'; attempt: Attempt }
  | { kind: 'nothing' }
  | { kind: 'saveFailed'; attempt: Attempt };

export function ExerciseHost({
  definition,
  params,
  sessionId = null,
  reviewOf = null,
  routineKey = null,
  onFinished,
  renderAfter,
  autoFocusStart = false,
  onActiveChange,
  onPausedChange,
  content,
  onPrevious,
  registerPrevious,
  restoredAttempt,
}: ExerciseHostProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const status = useEngineStatus();
  const [running, setRunning] = useState<Running | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(
    restoredAttempt ? { kind: 'saved', attempt: restoredAttempt } : null,
  );
  const [micFailed, setMicFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  /** The run is ending to go to the previous item: that happens once what was played is stored (D-096). */
  const backAfterRef = useRef(false);
  useMicReleasedOnExit();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const active = starting || (running !== null && outcome === null);
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  useEffect(() => {
    onActiveChangeRef.current?.(active);
    return () => onActiveChangeRef.current?.(false);
  }, [active]);

  useEffect(
    () => () => {
      metronome.stop();
      void wakeLock().disable();
    },
    [],
  );

  useEffect(
    () => () => {
      running?.runner.dispose();
    },
    [running],
  );

  const wantsMic = definition.usesMicrophone && !(settings?.micDisabled ?? false);

  const begin = async (withMic: boolean) => {
    // One start per host: a double tap must not create two runners sharing the engine and metronome.
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    // The first audio call happens synchronously inside the tap (iOS gesture rule).
    let micOk = false;
    if (withMic) micOk = await audioEngine.startMic({ deviceId: settings?.preferredInputDeviceId ?? null });
    else await audioEngine.ensureContext();
    if (withMic && !micOk) {
      setMicFailed(true);
      startingRef.current = false;
      setStarting(false);
      return;
    }
    if (micOk) await captureReady();
    const labels = micOk ? await audioEngine.deviceLabels() : null;
    const calibration = await repo.latestCalibration(labels?.input, labels?.output);
    const progression = await repo.progression(Date.now());
    const recent = await repo.recentAttempts(definition.type, Math.max(5, definition.historyDepth));
    const rate = simulatedRate();
    const current = settings ?? (await repo.settings());
    const ctx: ExerciseContext = {
      audio: micOk ? createExerciseMic(audioEngine) : null,
      output: createExerciseOutput(audioEngine, metronome),
      clock: { now: () => performance.now() * rate },
      content: content ?? contentContextFor(progression),
      calibration,
      settings: {
        strictness: current.strictness,
        sensitivity: current.sensitivity,
        xStringCheck: current.xStringCheck,
        leftHanded: current.leftHanded,
        visualOnlyMetronome: current.visualOnlyMetronome,
        earphonesByOutput: current.earphonesByOutput,
      },
      personalOffsetMs: personalOffsetFrom(recent.slice(0, 5)),
    };
    const runParams = definition.withHistory(
      params,
      recent.map((a) => a.result),
    );
    // Left while the microphone was starting: no orphan runner (it would hold the engine and metronome).
    if (!mountedRef.current) return;
    const runner = definition.createRunner(ctx, runParams);
    void wakeLock().enable();
    setRunning({ runner, ctx, startedAt: Date.now(), params: runParams });
    setStarting(false);
    runner.start();
  };

  // Not started yet: Space or next (Enter on the page, PageDown, →, a learned pedal) starts the run (§12.3).
  const idle = running === null && outcome === null && !starting && !micFailed;
  useEffect(() => {
    if (!idle) return;
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isNativeActivation(event)) return;
      const action = actionForKey(event, settings?.customKeys ?? {});
      if (action !== 'toggle' && action !== 'next') return;
      event.preventDefault();
      void begin(wantsMic);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const withoutMic = async () => {
    await updateSettings({ micDisabled: true });
    setMicFailed(false);
    await begin(false);
  };

  const save = useCallback(
    (attempt: Attempt) => {
      repo
        .recordAttempt(attempt)
        .then(() => {
          setOutcome({ kind: 'saved', attempt });
          onFinished?.(attempt);
          if (backAfterRef.current) onPrevious?.();
        })
        .catch(() => {
          // The save's retry stays on screen: going back now would lose the run.
          backAfterRef.current = false;
          setOutcome({ kind: 'saveFailed', attempt });
        });
    },
    [onFinished, onPrevious],
  );

  const onDone = useCallback(() => {
    if (!running || finishedRef.current) return;
    finishedRef.current = true;
    const { runner, startedAt } = running;
    audioEngine.setJob(null);
    metronome.stop();
    void wakeLock().disable();
    // Aborted before anything happened, or never scored: no Attempt (nothing to turn into metrics).
    if (!runner.hasResult()) {
      setOutcome({ kind: 'nothing' });
      onFinished?.(null);
      if (backAfterRef.current) onPrevious?.();
      return;
    }
    const result = definition.resultSchema.parse(runner.finish());
    // The song's earphone choice is a device setting per output (D-101), kept apart from the run's record.
    saveEarphoneChoice(definition, result, useSettingsStore.getState()).catch(() => {});
    const stats = runner.dspStats();
    save({
      id: newId(),
      sessionId,
      exerciseType: definition.type,
      exerciseVersion: definition.version,
      startedAt,
      endedAt: Date.now(),
      params: runner.effectiveParams?.() ?? running.params,
      result,
      detectorVersion: stats.events > 0 ? stats.detectorVersion : null,
      processingMs: stats.meanProcessingMs,
      reviewOf,
      ...(routineKey ? { routineKey } : {}),
    });
  }, [running, definition, sessionId, reviewOf, routineKey, onFinished, onPrevious, save]);

  // "이전 항목" during a run: the run ends as "중단" ends it (what was played is kept), then the session goes back.
  const endThenBack = useCallback(() => {
    backAfterRef.current = true;
    running?.runner.command('abort');
  }, [running]);

  if (outcome?.kind === 'saved') {
    return (
      // One readable column on the header's left edge: the result, then what to do next (SPEC §4.2).
      <section aria-live="polite" className="w-full max-w-3xl" data-testid="exercise-summary">
        <Card>
          <p className="mb-4 flex items-center gap-2 font-semibold text-ok">
            <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-ok text-bg">
              <Icon name="check" size={16} />
            </span>
            {ko.exercises.common.saved}
          </p>
          {definition.renderSummary({ result: outcome.attempt.result, params: outcome.attempt.params })}
        </Card>
        {renderAfter?.(outcome.attempt)}
      </section>
    );
  }
  if (outcome?.kind === 'nothing') {
    return (
      <section aria-live="polite" className="w-full max-w-3xl" data-testid="exercise-nothing">
        <Card tone="notice">
          <p className="flex items-start gap-2">
            <Icon name="info" className="mt-0.5 shrink-0" />
            {ko.exercises.common.nothingToSave}
          </p>
        </Card>
        {renderAfter?.(null)}
      </section>
    );
  }
  if (outcome?.kind === 'saveFailed') {
    const attempt = outcome.attempt;
    return (
      <Card as="section" role="alert" tone="fail" className="w-full max-w-3xl">
        <p className="text-fail">{ko.exercises.common.saveFailed}</p>
        <div className="mt-3" data-primary-action>
          <Button onClick={() => save(attempt)}>{ko.common.retry}</Button>
        </div>
      </Card>
    );
  }
  if (running)
    return (
      <RunningExercise
        definition={definition}
        params={running.params}
        running={running}
        onDone={onDone}
        onPausedChange={onPausedChange}
        onPrevious={onPrevious ? endThenBack : undefined}
        registerPrevious={registerPrevious}
      />
    );
  const howTo = definition.howTo(params);
  const t = ko.exercises.common;
  // The start screen on the practice skeleton (D-090): the open "하는 법" is what the learner reads first, the
  // start choice is the next step.
  const start = wantsMic ? (
    <>
      <Button
        large
        disabled={starting}
        autoFocus={autoFocusStart}
        onClick={() => void begin(true)}
        data-testid="exercise-start"
      >
        {t.startWithMic}
      </Button>
      <Button large variant="secondary" disabled={starting} onClick={() => void begin(false)}>
        {ko.common.withoutMic}
      </Button>
    </>
  ) : (
    <Button
      large
      disabled={starting}
      autoFocus={autoFocusStart}
      onClick={() => void begin(false)}
      data-testid="exercise-start"
    >
      {t.start}
    </Button>
  );
  return (
    <PracticeStage
      data-testid="exercise-ready"
      figure={howTo ? <HowToPanel howTo={howTo} open className="w-full" /> : null}
      primary={micFailed ? undefined : start}
    >
      {micFailed ? (
        <MicStatusPanel
          status={status}
          onRetry={() => void begin(true)}
          onWithoutMic={() => void withoutMic()}
          marksNextStep
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold">{t.readyTitle}</p>
          <p className="text-muted">{wantsMic ? t.readyMic : t.readyKeys}</p>
        </div>
      )}
    </PracticeStage>
  );
}
