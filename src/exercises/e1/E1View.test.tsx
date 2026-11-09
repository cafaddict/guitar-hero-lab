/** E1 retry wording (D-106): the NOT_STRING line names what was being played, a chord strum or one string. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { DETECTOR_VERSION } from '../../dsp/version';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { makeE1View } from './E1View';
import { ChordCheckRunner, type E1Params } from './runner';

const C = voicingById('C');
const View = makeE1View(voicingById);

function viewAfterNotString(mode: E1Params['mode']): string {
  const t = testContext();
  const params: E1Params = { voicingId: 'C', blockMs: 120_000, mode, earFirst: false };
  const runner = new ChordCheckRunner(t.ctx, params, C);
  runner.start();
  runner.command('next');
  const base = {
    detectorVersion: DETECTOR_VERSION,
    confidence: 0,
    reasons: ['NOT_STRING'],
    processingMs: 2,
    verdict: 'RETRY',
  };
  const result =
    mode === 'strum'
      ? { ...base, strings: [], unexpected: [], blamed: [], referenceDb: 0 }
      : {
          ...base,
          status: 'WEAK',
          f0: null,
          cents: null,
          semitones: null,
          clarity: 0,
          decayRatio: null,
          levelDb: 30,
        };
  const at = t.clock.t + 0.2;
  t.clock.advance(0.7);
  t.mic.strike(at, result);
  return renderToStaticMarkup(<View runner={runner} ctx={t.ctx} params={params} />);
}

describe('E1 view: NOT_STRING wording', () => {
  it('a strum asks for the chord strum again, not for one string', () => {
    const html = viewAfterNotString('strum');
    expect(html).toContain(ko.verdict.retry('NOT_STRING', 'strum'));
    expect(html).not.toContain(ko.verdict.retry('NOT_STRING', 'pluck'));
  });

  it('string by string keeps the Mode A line', () => {
    const html = viewAfterNotString('pluck');
    expect(html).toContain(ko.verdict.retry('NOT_STRING', 'pluck'));
    expect(html).not.toContain(ko.verdict.retry('NOT_STRING', 'strum'));
  });
});
