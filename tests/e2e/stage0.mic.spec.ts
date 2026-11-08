import { expect, type Page, test } from '@playwright/test';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { readStore, type StoredAttempt } from './support/idb';
import { playItem, pressOn } from './support/session';

interface K1Result {
  items: { id: string; status: string }[];
}
interface E16Result {
  positions: { pos: string; statuses: string[] }[];
  source: string;
}

test('E2E-15: a Stage 0 session with the keyboard only — self-check cards and fret positions are stored', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/');
  await pressOn(page, 'onboarding-step', 'Tab');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/session?timeScale=0.25');
  await expect(page.getByTestId('session-header')).toBeVisible();
  const played: string[] = [];
  while (await page.getByTestId('session-header').isVisible()) {
    // A 20-minute Stage 0 session is never split (D-104).
    await expect(page.getByTestId('split-session')).toHaveCount(0);
    played.push(await playItem(page));
  }
  expect(played).toContain('K1');
  expect(played).toContain('E16');
  await pressOn(page, 'report-save');
  await expect(page).toHaveURL(/#\/$/);

  const attempts = await readStore<StoredAttempt>(page, 'attempts');
  const k1 = attempts.find((a) => a.exerciseType === 'K1')!;
  expect((k1.result as unknown as K1Result).items).toEqual([
    { id: 'posture', status: 'done' },
    { id: 'pick', status: 'done' },
    { id: 'countAloud', status: 'done' },
  ]);
  const e16 = attempts.find((a) => a.exerciseType === 'E16')!;
  const positions = (e16.result as unknown as E16Result).positions;
  expect(positions.map((p) => p.pos)).toEqual(['behind', 'middle', 'onFret']);
  expect((e16.result as unknown as E16Result).source).toBe('self');
  const sessions = await readStore<{ completedItems: number; endedAt: number | null }>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.completedItems).toBe(played.filter((t) => t !== 'REST').length);
});

/** Plays a pluck fixture until the runner moved on (a RETRY take is played again). */
async function pluck(page: Page, fixture: string, before: string): Promise<void> {
  const view = page.getByTestId('e16-view');
  for (let attempt = 0; attempt < 3; attempt++) {
    await playFixture(page, fixture);
    try {
      await expect(view.or(page.getByTestId('exercise-summary'))).not.toHaveAttribute('data-step', before, {
        timeout: 4_000,
      });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

test('E2E-15: E16 with the microphone — behind the fret OK, on the fret wire MUTED, side by side', async ({
  page,
}) => {
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/#/practice/E16');
  await page.getByTestId('exercise-start').click();
  const view = page.getByTestId('e16-view');
  await expect(view).toHaveAttribute('data-position', 'behind');
  // ① right behind the fret: the clean C4; ② middle: clean; ③ on the fret wire: the muted take.
  const takes = [
    'c-pluck-2.wav',
    'c-pluck-2.wav',
    'c-pluck-2.wav',
    'c-pluck-2.wav',
    'c-pluck-2-muted.wav',
    'c-pluck-2-muted.wav',
  ];
  for (const [k, fixture] of takes.entries()) await pluck(page, fixture, `${k}`);
  await expect(page.getByTestId('exercise-summary')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('e16-table')).toContainText('깨끗');
  await expect(page.getByTestId('e16-table')).toContainText('막힘');
  const attempts = await readStore<StoredAttempt>(page, 'attempts');
  expect(attempts).toHaveLength(1);
  const result = attempts[0]!.result as unknown as E16Result;
  expect(result.source).toBe('mic');
  expect(result.positions.find((p) => p.pos === 'behind')!.statuses).toEqual(['OK', 'OK']);
  expect(result.positions.find((p) => p.pos === 'onFret')!.statuses).toEqual(['MUTED', 'MUTED']);
  expect(attempts[0]!.detectorVersion).toBe(DETECTOR_VERSION);
  expect(attempts[0]!.processingMs).toBeGreaterThan(0);
});
