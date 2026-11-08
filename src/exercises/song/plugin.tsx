import { patternById } from '../../content/patterns';
import { PRACTICE_SONGS, songById } from '../../content/songs';
import { voicingById, voicingForClass } from '../../content/voicings';
import { extractMetrics, type SongResult, songResultSchema } from '../../domain/exerciseResults';
import { renderBacking } from '../../dsp/synth/backing';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { Phrases } from '../../ui/Phrases';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import { renderChordProgression } from './listen';
import {
  firstRunAtStage,
  isBluetoothLabel,
  type SongParams,
  SongRunner,
  type SongView,
  songParamsSchema,
  songStageOf,
} from './runner';

function SongViewComponent({
  runner,
}: {
  runner: ExerciseRunner<SongResult, SongView>;
  params: SongParams;
  ctx: ExerciseContext;
}) {
  const { view, phase } = useRunnerSnapshot(runner);
  const song = view.song;
  const playing = phase === 'running' || phase === 'countIn';
  const waiting = phase === 'ready' || phase === 'armed';
  // Hidden stage: the chart is covered only while playing — shown before the start to look over (D-082) and in
  // the review to check against (D-083). The record only looks at the playing time.
  const chartCovered = view.chartHidden && (playing || phase === 'paused');
  const toggleMark = (on: boolean) => (on ? <Icon name="check" /> : null);
  return (
    <PracticeStage
      data-testid="song-view"
      data-phase={phase}
      data-stage={view.stage}
      data-bpm={view.bpm}
      figure={
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-3xl font-bold">{song.title}</h2>
            <p className="whitespace-nowrap text-2xl tabular-nums">{view.bpm} BPM</p>
          </div>
          {chartCovered ? (
            <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-surface p-8 text-center">
              <p className="text-xl">{ko.exercises.song.hidden}</p>
              {view.bar !== null && (
                <p className="text-4xl font-bold tabular-nums">
                  {ko.exercises.song.bar(view.bar + 1, view.chart.length)}
                </p>
              )}
            </div>
          ) : (
            <ol className="grid w-full grid-cols-4 gap-2" aria-label={song.title}>
              {view.chart.map((b) => (
                <li
                  key={b.position}
                  className={`rounded-xl p-3 text-center text-3xl font-bold ${view.bar === b.position ? 'bg-accent text-accent-fg' : 'bg-surface'}`}
                  aria-current={view.bar === b.position ? 'step' : undefined}
                >
                  {b.chord}
                </li>
              ))}
            </ol>
          )}
        </div>
      }
      primary={
        waiting ? (
          <Button large onClick={() => runner.command('toggle')}>
            {ko.exercises.song.start}
          </Button>
        ) : playing ? (
          <Button large variant="secondary" onClick={() => runner.command('toggle')}>
            {ko.exercises.song.stop}
          </Button>
        ) : phase === 'review' ? (
          <Button large onClick={() => runner.command('next')}>
            {ko.exercises.song.confirm}
          </Button>
        ) : undefined
      }
      secondary={
        <>
          {waiting && (
            <Button large variant="secondary" onClick={() => runner.command('mark')}>
              {ko.exercises.song.listen}
            </Button>
          )}
          {(playing || phase === 'paused') && (
            <Button
              large
              variant="secondary"
              onClick={() => runner.command('restart')}
              data-testid="song-restart"
            >
              {ko.exercises.song.restart}
            </Button>
          )}
          {phase === 'review' && view.mode === 'learn' && (
            <Button large variant="secondary" onClick={() => runner.command('toggle')}>
              {ko.exercises.song.again}
            </Button>
          )}
        </>
      }
      notes={
        <>
          {view.backingAudible && <p className="text-muted">{ko.exercises.song.speakerNote}</p>}
          <p className="text-muted">
            <Phrases text={ko.exercises.song.optionKeys} />
          </p>
        </>
      }
    >
      <p className="text-lg text-muted">
        {ko.exercises.song.stages[view.stage]}
        {view.loopSection !== null &&
          ` · ${ko.exercises.song.loop(song.sections[view.loopSection]?.name ?? '')}`}
      </p>
      {waiting && view.firstAtStage && view.stage !== 'learn' && (
        <p className="text-lg font-bold" data-testid="song-stage-new">
          {ko.exercises.song.stageNew[view.stage]}
        </p>
      )}
      {waiting && view.chartHidden && (
        <p className="text-lg" data-testid="song-hidden-preview">
          {ko.exercises.song.hiddenPreview}
        </p>
      )}
      {view.mode === 'perform' && waiting && (
        <div className="flex flex-col gap-2" data-testid="song-backing">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              aria-pressed={view.backingOn}
              selected={view.backingOn ? 'accent' : null}
              onClick={() => runner.command('backing')}
              data-testid="song-backing-toggle"
            >
              {toggleMark(view.backingOn)}
              {view.backingOn ? ko.exercises.song.backingOn : ko.exercises.song.backingOff}
            </Button>
            {view.backingOn && (
              <Button
                variant="secondary"
                aria-pressed={view.earphones}
                selected={view.earphones ? 'accent' : null}
                onClick={() => runner.command('ear')}
                data-testid="song-earphones"
                data-earphones={view.earphones}
              >
                {toggleMark(view.earphones)}
                {view.earphones ? ko.exercises.song.earphones : ko.exercises.song.speakers}
              </Button>
            )}
          </div>
          {view.backingOn && isBluetoothLabel(view.outputLabel) && (
            <p className="text-retry">{ko.exercises.song.bluetooth}</p>
          )}
          {view.backingOn && <p className="text-muted">{ko.exercises.song.iosNote}</p>}
        </div>
      )}
      {phase === 'countIn' && <p className="text-xl font-semibold">{ko.exercises.e5.countIn}</p>}
      {waiting && (
        <p className="text-xl">{phase === 'armed' ? ko.exercises.e5.armed : ko.exercises.e5.ready}</p>
      )}
      {phase === 'paused' && view.bar !== null && (
        <p className="text-xl font-semibold" data-testid="song-paused">
          {ko.exercises.song.pausedAt(view.bar + 1, view.chart.length)}
        </p>
      )}
      {phase === 'review' && (
        <div aria-live="polite" className="flex flex-col gap-3">
          {view.chordCorrectRatio !== null && (
            <p className="text-lg" data-testid="song-chord" data-reference={view.backingAudible}>
              {view.backingAudible
                ? ko.exercises.song.chordCheckReference(view.chordCorrectRatio)
                : ko.exercises.song.chordCheck(view.chordCorrectRatio)}
            </p>
          )}
          <p className="text-xl">{ko.exercises.song.reviewPrompt}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              large
              variant="secondary"
              aria-pressed={view.report.completed}
              selected={view.report.completed ? 'accent' : null}
              onClick={() => runner.command('manual1')}
            >
              {toggleMark(view.report.completed)}
              {ko.exercises.song.completed}
            </Button>
            <Button
              large
              variant="secondary"
              aria-pressed={view.report.memorized}
              selected={view.report.memorized ? 'accent' : null}
              onClick={() => runner.command('manual2')}
            >
              {toggleMark(view.report.memorized)}
              {ko.exercises.song.memorized}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              className="min-w-12"
              onClick={() => runner.command('dec')}
              aria-label="−"
            >
              −
            </Button>
            <span className="text-xl tabular-nums">{ko.exercises.song.stops(view.report.stops)}</span>
            <Button
              variant="secondary"
              className="min-w-12"
              onClick={() => runner.command('inc')}
              aria-label="+"
            >
              +
            </Button>
          </div>
        </div>
      )}
    </PracticeStage>
  );
}

function SongSummary({ result }: { result: SongResult; params: SongParams }) {
  return (
    <div data-testid="song-summary">
      <p className={RESULT_HEADLINE}>
        {songById(result.songId).title} · {ko.exercises.song.summary(result.completed, result.stops)}
        {result.memorized && ` · ${ko.exercises.song.memorizedTag}`}
      </p>
      {result.beat1HitRate !== null && <p>{ko.exercises.song.beat1(result.beat1HitRate)}</p>}
      {typeof result.chordCorrectRatio === 'number' && (
        <p>
          {result.backingAudible
            ? ko.exercises.song.chordCheckReference(result.chordCorrectRatio)
            : ko.exercises.song.chordCheck(result.chordCorrectRatio)}
        </p>
      )}
    </div>
  );
}

export const songPlugin: ExercisePlugin<SongParams, SongResult, SongView> = {
  type: 'S',
  version: 1,
  titleKey: 'S',
  paramsSchema: songParamsSchema,
  resultSchema: songResultSchema,
  defaultParams: (content) => {
    const song =
      [...PRACTICE_SONGS].reverse().find((s) => s.stage <= Math.max(1, content.stage)) ?? PRACTICE_SONGS[0]!;
    return songParamsSchema.parse({
      songId: song.id,
      mode: 'learn',
      bpm: song.bpmDefault,
      chartHidden: false,
      loopSection: null,
    });
  },
  createRunner: (ctx, params) =>
    new SongRunner(
      ctx,
      params,
      (chords, bpm, beatsPerBar) =>
        renderChordProgression(chords, bpm, ctx.output.sampleRate(), ctx.content.gVoicing, beatsPerBar),
      (chords, patternId, bpm) =>
        renderBacking({
          chords: chords.map((c) => voicingById(voicingForClass(c, ctx.content.gVoicing))),
          pattern: patternById(patternId),
          bpm,
          bars: chords.length,
          sampleRate: ctx.output.sampleRate(),
          model: 'karplus-strong',
          seed: 7,
        }),
    ),
  // The earphone choice per output device is a device setting (D-101): each backing run writes it.
  earphoneChoice: (result) =>
    result.backingOn && result.outputLabel
      ? { outputLabel: result.outputLabel, earphones: result.backingAudible !== true }
      : null,
  // The history still fills devices the settings do not know yet (choices made before D-101); learn runs
  // carry no choice, so the window reaches far enough back for them not to erase it.
  historyDepth: 50,
  withHistory: (params, recent) => {
    const byOutput: Record<string, boolean> = { ...params.earphonesByOutput };
    for (const r of [...recent].reverse())
      if (r.backingOn && r.outputLabel) byOutput[r.outputLabel] = r.backingAudible !== true;
    const stage = songStageOf(params.mode, params.chartHidden);
    return {
      ...params,
      earphonesByOutput: byOutput,
      firstAtStage: firstRunAtStage(params.songId, stage, recent),
    };
  },
  View: SongViewComponent,
  Summary: SongSummary,
  howTo: (params) => {
    const g = ko.exercises.guide.S;
    const song = songById(params.songId);
    const pattern = patternById(song.patternId);
    return {
      steps: [
        g.grid(pattern.timeSignature === '6/8' ? 2 : 4),
        g.pattern(pattern.label),
        g.mode[songStageOf(params.mode, params.chartHidden)],
        g.listen,
        g.pause,
        g.goal,
      ],
      terms: ['strumLetters'],
    };
  },
  toMetrics: (result) => extractMetrics('S', result),
  usesMicrophone: true,
  // P pauses (a stop), R starts over (D-085).
  pausable: true,
};
