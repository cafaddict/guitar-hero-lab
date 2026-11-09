import type { CoachingHint } from '../../domain/coaching';
import type { ChordCheckResult } from '../../domain/exerciseResults';
import { stringNumber } from '../../domain/strings';
import type { ChordVoicing } from '../../domain/voicing';
import { ko } from '../../i18n/ko';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { ChordDiagram, type DiagramMark } from '../../ui/ChordDiagram';
import { Phrases } from '../../ui/Phrases';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { BigTimer } from '../ui/BigTimer';
import { useRunnerSnapshot } from '../ui/hooks';
import { PRACTICE_DIAGRAM, PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import type { E1Params, E1StringView, E1View as View } from './runner';
import { stringTendencies } from './tendency';

const FAILED = new Set(['MUTED', 'WRONG_NOTE', 'UNEXPECTED']);
const ICON: Record<string, string> = {
  OK: '✓',
  MUTED: '■',
  WRONG_NOTE: '≠',
  UNEXPECTED: '!',
  WEAK: '?',
  UNVERIFIABLE: '–',
  NOT_PLAYED: '×',
};

function markOf(s: E1StringView): DiagramMark {
  if (!s.revealed || s.status === null) return null;
  if (s.status === 'OK') return 'ok';
  if (FAILED.has(s.status)) return 'fail';
  return s.status === 'WEAK' ? 'retry' : null;
}

function statusText(s: E1StringView): { icon: string; label: string; tone: string } {
  if (s.skipped)
    return { icon: ICON.NOT_PLAYED!, label: ko.exercises.stringStatus.NOT_PLAYED, tone: 'text-muted' };
  if (s.status !== null && !s.revealed)
    return { icon: '…', label: ko.exercises.stringStatus.hidden, tone: 'text-info' };
  if (s.status !== null) {
    const tone = s.status === 'OK' ? 'text-ok' : FAILED.has(s.status) ? 'text-fail' : 'text-retry';
    return { icon: ICON[s.status] ?? '·', label: ko.exercises.stringStatus[s.status], tone };
  }
  if (s.selfStatus !== null)
    return { icon: '•', label: ko.exercises.selfStatus[s.selfStatus], tone: 'text-info' };
  return { icon: '·', label: ko.exercises.stringStatus.pending, tone: 'text-muted' };
}

/** FAIL wording = what + how (SPEC §12.4); other hints are rendered as they are. */
function hintLine(hint: CoachingHint, strings: readonly E1StringView[]): string {
  const how = ko.coaching.render(hint);
  if (!('stringNo' in hint)) return how;
  const s = strings.find((x) => stringNumber(x.idx) === hint.stringNo);
  switch (s?.status) {
    case 'MUTED':
      return ko.verdict.fail(ko.verdict.stringMuted(hint.stringNo), how);
    case 'WRONG_NOTE':
      return ko.verdict.fail(ko.verdict.stringWrong(hint.stringNo), how);
    case 'UNEXPECTED':
      return ko.verdict.fail(ko.verdict.stringUnexpected(hint.stringNo), how);
    default:
      return how;
  }
}

export function makeE1View(voicingOf: (id: string) => ChordVoicing) {
  return function E1ViewComponent({
    runner,
    ctx,
  }: {
    runner: ExerciseRunner<ChordCheckResult, View>;
    params: E1Params;
    ctx: ExerciseContext;
  }) {
    const { view, remainingMs, phase } = useRunnerSnapshot(runner);
    const voicing = voicingOf(view.voicingId);
    const active = view.activeIdx;
    let instruction = '';
    if (view.step === 'place') instruction = ko.exercises.e1.place;
    else if (view.step === 'strum') instruction = ko.exercises.e1.strum;
    else if (view.step === 'release') instruction = ko.exercises.e1.release;
    else if (active !== null) {
      const stringNo = stringNumber(active);
      if (view.mode === 'manual') instruction = ko.exercises.e1.manualPrompt(stringNo);
      else if (view.awaitingSelf)
        instruction = `${ko.exercises.e1.pluckString(stringNo)} — ${ko.exercises.e1.selfPrompt}`;
      else if (voicing.frets[active] === 'x') instruction = ko.exercises.e1.silentString(stringNo);
      else instruction = ko.exercises.e1.pluckString(stringNo);
    }
    const showSelfButtons =
      phase === 'running' && view.step === 'strings' && (view.mode === 'manual' || view.awaitingSelf);
    const running = phase === 'running';
    const showSkip = running && view.step === 'strings' && view.mode !== 'manual';
    // ← takes the latest skip of this attempt back (D-096).
    const showUnskip = runner.canStepBack?.() ?? false;
    return (
      <PracticeStage
        data-testid="e1-view"
        data-step={view.step}
        data-mode={view.mode}
        figure={
          <>
            <ChordDiagram
              voicing={voicing}
              leftHanded={ctx.settings.leftHanded}
              activeIdx={active}
              marks={view.strings.map(markOf)}
              className={PRACTICE_DIAGRAM}
            />
            <p className="flex items-center gap-2 text-muted">
              {ko.exercises.e1.modes[view.mode]}
              {view.mode === 'strum' && (
                <Badge tone="info" data-testid="beta-badge">
                  {ko.exercises.common.beta}
                </Badge>
              )}
            </p>
          </>
        }
        primary={
          running && view.step === 'place' ? (
            <Button large onClick={() => runner.command('next')}>
              {ko.exercises.e1.placeReady}
            </Button>
          ) : running && view.step === 'release' ? (
            <Button large onClick={() => runner.command('next')}>
              {ko.exercises.e1.nextAttempt}
            </Button>
          ) : showSelfButtons ? (
            (['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
              <Button key={cmd} large variant="secondary" onClick={() => runner.command(cmd)}>
                {k + 1} {ko.exercises.selfStatus[(['clean', 'muted', 'buzz'] as const)[k]!]}
              </Button>
            ))
          ) : undefined
        }
        primaryLabel={showSelfButtons ? instruction : undefined}
        secondary={
          (showSkip || showUnskip) && (
            <>
              {showSkip && (
                <Button variant="ghost" onClick={() => runner.command('next')}>
                  {ko.exercises.e1.skip}
                </Button>
              )}
              {showUnskip && (
                <Button variant="secondary" onClick={() => runner.command('prev')} data-testid="e1-unskip">
                  {ko.exercises.e1.unskip}
                </Button>
              )}
            </>
          )
        }
        notes={
          (view.step === 'place' || view.step === 'release') && (
            <p className="text-muted" data-testid="e1-option-keys">
              <Phrases text={ko.exercises.e1.optionKeys} />
            </p>
          )
        }
      >
        <BigTimer remainingMs={remainingMs} />
        <p
          className="text-2xl font-semibold"
          data-testid="e1-instruction"
          data-active-string={active === null ? '' : stringNumber(active)}
        >
          {instruction}
        </p>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label={ko.exercises.titles.E1}>
          {view.strings.map((s) => {
            const t = statusText(s);
            return (
              <li
                key={s.idx}
                data-testid={`e1-string-${stringNumber(s.idx)}`}
                data-status={s.revealed || s.skipped ? (s.skipped ? 'SKIPPED' : (s.status ?? '')) : ''}
                className={`rounded-xl border-2 bg-surface p-2 text-center ${active === s.idx ? 'border-accent' : 'border-transparent'}`}
              >
                <span className="block text-sm text-muted">{stringNumber(s.idx)}</span>
                <span className={`block text-2xl font-bold ${t.tone}`} aria-hidden="true">
                  {t.icon}
                </span>
                <span className={`block text-base ${t.tone}`}>{t.label}</span>
              </li>
            );
          })}
        </ul>
        <div aria-live="polite" className="min-h-6 text-lg">
          {view.retry && (
            <p className="text-retry">
              {ko.verdict.retry(view.retry, view.step === 'strum' ? 'strum' : 'pluck')}
            </p>
          )}
          {view.suggestPluck && (
            <p className="text-info" data-testid="e1-suggest-pluck">
              {ko.exercises.e1.suggestPluck}
            </p>
          )}
          {view.step === 'release' && view.lastClean !== null && (
            <div
              className={`flex items-center gap-2 text-xl font-bold ${view.lastClean ? 'text-ok' : 'text-fail'}`}
            >
              <span aria-hidden="true">{view.lastClean ? '✓' : '✗'}</span>
              <p data-testid="e1-attempt-verdict">
                {view.lastClean ? ko.exercises.e1.clean : ko.exercises.e1.notClean}
              </p>
            </div>
          )}
          {view.step === 'release' && view.hints.length > 0 && (
            <ul className="mt-1 space-y-1" data-testid="e1-hints">
              {view.hints.map((hint) => (
                <li key={`${hint.code}-${'stringNo' in hint ? hint.stringNo : ''}`}>
                  {hintLine(hint, view.strings)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-muted" data-testid="e1-stats">
          {ko.exercises.e1.stats(view.cleanAttempts, view.attempts)}
        </p>
      </PracticeStage>
    );
  };
}

export function makeE1Summary(voicingOf: (id: string) => ChordVoicing) {
  return function E1Summary({ result }: { result: ChordCheckResult; params: E1Params }) {
    const agreements = result.attempts.map((a) => a.selfAgreement).filter((x): x is number => x !== null);
    const tendencies = stringTendencies(result, voicingOf(result.voicingId));
    return (
      <div data-testid="e1-summary">
        <p className={RESULT_HEADLINE}>{ko.exercises.e1.cleanRatio(result.cleanRatio)}</p>
        <p>{ko.exercises.e1.stats(result.attempts.filter((a) => a.clean).length, result.attempts.length)}</p>
        {agreements.length > 0 && (
          <p>{ko.exercises.e1.selfAgreement(agreements.reduce((s, x) => s + x, 0) / agreements.length)}</p>
        )}
        {tendencies.length > 0 && (
          <ul className="mt-2 space-y-1" data-testid="e1-tendencies">
            {tendencies.map((t) => (
              <li key={`${t.stringNo}-${t.kind}`}>
                {ko.exercises.e1.tendency(t.stringNo, t.attempts, t.count, t.kind)}
                {t.hint && ` → ${ko.coaching.render(t.hint)}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
}
