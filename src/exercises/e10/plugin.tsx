import { patternById } from '../../content/patterns';
import { voicingById, voicingForClass } from '../../content/voicings';
import {
  extractMetrics,
  ladderNextBpm,
  SCALE_GRADUATION_BPM,
  SCALE_START_BPM,
  type ScaleResult,
  SEQUENCE_STREAK,
  scaleResultSchema,
} from '../../domain/exerciseResults';
import { renderBacking } from '../../dsp/synth/backing';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { LADDER_STEP_BPM, tempoRetry } from '../e5/runner';
import { SequenceStage } from '../sequence/SequenceStage';
import { type ExercisePlugin, type ExerciseRunner, SEQUENCE_HISTORY_DEPTH } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import { type E10Params, type E10View, e10ParamsSchema, ScaleRunner } from './runner';

function E10ViewComponent({ runner }: { runner: ExerciseRunner<ScaleResult, E10View>; params: E10Params }) {
  const { view, phase } = useRunnerSnapshot(runner);
  const t = ko.exercises.e10;
  return (
    <SequenceStage
      runner={runner}
      title={t.title(view.scale.name, view.step)}
      tabLabel={t.tabLabel(view.scale.name, view.step)}
      testId="e10-view"
      secondary={
        view.withBacking &&
        view.source === 'mic' &&
        phase === 'ready' && (
          <Button
            variant="secondary"
            aria-pressed={view.earphones}
            onClick={() => runner.command('ear')}
            data-testid="e10-earphones"
            data-earphones={view.earphones}
          >
            {view.earphones ? ko.exercises.song.earphones : ko.exercises.song.speakers}
          </Button>
        )
      }
      status={
        view.backingAudible && (
          <>
            <p className="text-muted" data-testid="e10-speaker-note">
              {t.speakerNote}
            </p>
            {view.gainLost && (
              <p aria-live="polite" data-testid="e10-gain-lost">
                {t.gainLost}
              </p>
            )}
          </>
        )
      }
    >
      <p className="text-lg">{t.steps[view.step]}</p>
      {view.withBacking && <p className="text-muted">{t.backingNote}</p>}
    </SequenceStage>
  );
}

function E10Summary({ result }: { result: ScaleResult; params: E10Params }) {
  const t = ko.exercises.sequence;
  const flawless = result.cycles.filter((c) => c.flawless).length;
  return (
    <div data-testid="e10-summary" data-graduated={result.graduated} data-memorized={result.memorized}>
      <p className={RESULT_HEADLINE}>{t.summary(result.cycles.length, flawless)}</p>
      {result.backingAudible && <p className="text-muted">{ko.exercises.e10.speakerReference}</p>}
      {result.graduated && <p className="text-ok">{ko.exercises.e10.graduated(result.step)}</p>}
      {result.memorized && <p className="text-ok">{ko.exercises.e10.memorized}</p>}
      {!result.graduated && <p>{t.ladder[result.ladder](ladderNextBpm(result.bpm, result.ladder))}</p>}
      {(result.pauses ?? 0) > 0 && <p className="text-muted">{ko.exercises.common.pausedRun}</p>}
    </div>
  );
}

/** The step and tempo to practise next from this scale's latest runs (newest first). */
export function nextScaleRun(params: E10Params, recent: readonly ScaleResult[]): E10Params {
  // Reference runs (unmasked speaker backing, stored before D-102) and reviews of a graduated step (§7.5) do not
  // move the step or the ladder.
  const mine = recent.filter((r) => r.scaleId === params.scaleId && r.backingAudible !== true && !r.review);
  // A review plays the step under review (the routine names it) at the graduation tempo (§7.5).
  if (params.review) return { ...params, bpm: SCALE_GRADUATION_BPM };
  // A memorization run (the routine hides the TAB on step 1, §7.3-10) stays on step 1 at step 1's ladder.
  const memorizing = params.tabHidden && params.step === 1;
  const last = memorizing ? mine.find((r) => r.step === 1) : mine[0];
  if (!last) return { ...params, step: 1, bpm: params.bpm ?? SCALE_START_BPM };
  if (!memorizing && last.graduated && last.step < 5)
    return { ...params, step: last.step + 1, bpm: SCALE_START_BPM };
  const bpm = ladderNextBpm(last.bpm, last.ladder);
  return { ...params, step: last.step, bpm: params.ladderBase !== undefined ? params.bpm : bpm };
}

export const e10Plugin: ExercisePlugin<E10Params, ScaleResult, E10View> = {
  type: 'E10',
  version: 1,
  titleKey: 'E10',
  paramsSchema: e10ParamsSchema,
  resultSchema: scaleResultSchema,
  defaultParams: () => e10ParamsSchema.parse({ scaleId: 'em-pent-open' }),
  createRunner: (ctx, params) =>
    new ScaleRunner(ctx, params, (chords, patternId, bpm) =>
      renderBacking({
        chords: chords.map((c) => voicingById(voicingForClass(c, ctx.content.gVoicing))),
        pattern: patternById(patternId),
        bpm,
        bars: chords.length,
        sampleRate: ctx.output.sampleRate(),
        model: 'karplus-strong',
        seed: 11,
      }),
    ),
  View: E10ViewComponent,
  Summary: E10Summary,
  howTo: (params) => {
    const g = ko.exercises.guide;
    const step = ko.exercises.e10.steps[params.step];
    return {
      steps: [
        ...(step ? [step] : []),
        g.E10.fingers,
        g.perClick(1),
        g.E10.ladder(SEQUENCE_STREAK, SCALE_GRADUATION_BPM, LADDER_STEP_BPM),
        // A review runs at the graduation tempo (§7.5); other runs pick theirs (D-098).
        ...(params.review ? [] : [g.tempoPick]),
      ],
      terms: ['tab', 'fingerNumbers', 'stringNumbers'],
    };
  },
  toMetrics: (result) => extractMetrics('E10', result),
  // Several subjects (scales/steps, finger pairs, start frets) share the history: look far enough back.
  historyDepth: SEQUENCE_HISTORY_DEPTH,
  withHistory: (params, recent) => nextScaleRun(params, recent),
  suggestedTempoRetry: (params, result) =>
    result.graduated && result.step < 5 ? null : tempoRetry(params, ladderNextBpm(result.bpm, result.ladder)),
  usesMicrophone: true,
  // P pauses; a paused run keeps the ladder where it is (D-085).
  pausable: true,
};
