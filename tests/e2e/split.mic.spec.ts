import { expect, type Page, test } from '@playwright/test';
import { installFakeMic } from './support/fakeMic';
import { putRows, readStore, type StoredAttempt } from './support/idb';
import { playItem, pressOn } from './support/session';

interface StoredSession {
  id: string;
  endedAt: number | null;
  completedItems: number;
  selfReport: { pain: number } | null;
}

const header = (page: Page) => page.getByTestId('session-header');

/** Skips items (keyboard: focus + Enter on "건너뛰기") until `until` is true. */
async function skipUntil(page: Page, until: () => Promise<boolean>): Promise<void> {
  for (let k = 0; k < 30 && !(await until()); k++) {
    const index = await header(page).getAttribute('data-index');
    await pressOn(page, 'skip-item');
    await expect(header(page)).not.toHaveAttribute('data-index', index!);
  }
  expect(await until()).toBe(true);
}

test('E2E-18: a Stage 8 30-minute routine with the keyboard — repertoire first, split twice between blocks, "이어서 하기", one session', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  // Without a microphone every item runs in its manual mode.
  await page.goto('/');
  await pressOn(page, 'onboarding-step', 'Tab');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);
  const now = Date.now();
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 8,
      stageEnteredAt: now - 2 * 86_400_000,
      sessionsInStage: 1,
      gVoicing: 'G-4f',
      history: [],
      exam: { '1': now, '2': now, '3': now, '4': now, '5': now },
      completedBeginner1: true,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);

  await page.goto('/#/session?timeScale=0.25');
  await expect(header(page)).toBeVisible();
  const total = Number(await header(page).getAttribute('data-count'));
  // Nothing is behind the first item yet: no split there.
  await expect(page.getByTestId('split-session')).toHaveCount(0);
  // Tuning, the stage's five never-played chords (D-099), then the repertoire block (Stage 7+ warm-up, §7.3-2).
  await expect(header(page)).toHaveAttribute('data-item-type', 'E0');
  expect(await playItem(page)).toBe('E0');
  await expect(header(page)).toHaveAttribute('data-block', 'newChord');
  await expect(header(page)).toHaveAttribute('data-index', '1');
  // Tuning is behind and the newChord block starts: a place between blocks (D-104).
  await expect(page.getByTestId('split-session')).toBeVisible();
  // Inside the newChord block (between two new chords) there is no split.
  await pressOn(page, 'skip-item');
  await expect(header(page)).toHaveAttribute('data-index', '2');
  await expect(header(page)).toHaveAttribute('data-block', 'newChord');
  await expect(page.getByTestId('split-session')).toHaveCount(0);
  await skipUntil(page, async () => (await header(page).getAttribute('data-block')) === 'repertoire');
  await expect(header(page)).toHaveAttribute('data-index', '6');

  // Part 1 ends between blocks the user picks (D-104): before the repertoire block, not the template's point.
  await expect(page.getByTestId('split-point')).toHaveCount(0);
  await pressOn(page, 'split-session');
  await expect(page).toHaveURL(/#\/$/);
  let sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.endedAt).toBeNull();

  // Same day: home offers the rest; it continues at the picked boundary.
  await pressOn(page, 'resume-session');
  await expect(header(page)).toHaveAttribute('data-index', '6');
  // Leaving in the middle of a resumed part keeps its progress: "이어서 하기" comes back where it was left.
  await pressOn(page, 'skip-item');
  await expect(header(page)).toHaveAttribute('data-index', '7');
  await page.goto('/#/');
  await pressOn(page, 'resume-session');
  await expect(header(page)).toHaveAttribute('data-index', '7');

  // The changes block's 30-second rest is inside the block: no split there.
  await skipUntil(page, async () => (await header(page).getAttribute('data-block')) === 'rest');
  await expect(page.getByTestId('split-session')).toHaveCount(0);
  // Part 2 is split again between the changes and rhythm blocks: a third part (D-104).
  await skipUntil(page, async () => (await header(page).getAttribute('data-block')) === 'rhythm');
  const secondSplit = Number(await header(page).getAttribute('data-index'));
  expect(secondSplit).toBeLessThan(total - 1);
  await expect(page.getByTestId('split-point')).toHaveCount(0);
  await pressOn(page, 'split-session');
  await expect(page).toHaveURL(/#\/$/);
  sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.endedAt).toBeNull();
  await expect(page.getByTestId('split-resume')).toBeVisible();
  await pressOn(page, 'resume-session');
  await expect(header(page)).toHaveAttribute('data-index', String(secondSplit));
  await skipUntil(page, async () => Number(await header(page).getAttribute('data-index')) === total - 1);
  // The last item is the song block: play it (learn stage, no microphone).
  await expect(header(page)).toHaveAttribute('data-item-type', 'S');
  await expect(page.getByTestId('exercise-start')).toBeFocused();
  await page.keyboard.press('Enter');
  const song = page.getByTestId('song-view');
  await expect(song).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', /countIn|running/);
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', 'review');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('next-item')).toBeFocused({ timeout: 10_000 });
  await page.keyboard.press('Enter');

  await pressOn(page, 'report-save');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByTestId('split-resume')).toHaveCount(0);
  // All three parts are one session record, closed once by the self report (§7.3-11, D-104).
  sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.endedAt).not.toBeNull();
  expect(sessions[0]!.selfReport).toMatchObject({ pain: 0 });
  const attempts = await readStore<StoredAttempt & { sessionId: string }>(page, 'attempts');
  expect(attempts.map((a) => a.exerciseType).sort()).toEqual(['E0', 'S']);
  expect(attempts.every((a) => a.sessionId === sessions[0]!.id)).toBe(true);
  expect(sessions[0]!.completedItems).toBe(2);
});

test('E2E-18b: "시작" instead of "이어서 하기" ends the kept first half (it counts) and starts a new session', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const now = Date.now();
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 9,
      stageEnteredAt: now - 2 * 86_400_000,
      sessionsInStage: 1,
      gVoicing: 'G-4f',
      history: [],
      exam: { '1': now, '2': now, '3': now, '4': now, '5': now },
      completedBeginner1: true,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);
  await page.goto('/#/session?timeScale=0.25');
  expect(await playItem(page)).toBe('E0');
  await skipUntil(page, () => page.getByTestId('split-point').isVisible());
  await pressOn(page, 'split-session');
  await expect(page.getByTestId('resume-session')).toBeVisible();
  await page.getByTestId('start-session').click();
  await expect(header(page)).toHaveAttribute('data-index', '0');
  const sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(2);
  const first = sessions.find((s) => s.completedItems === 1)!;
  expect(first.endedAt).not.toBeNull();
  expect(first.selfReport).toBeNull();
  const progression = await readStore<{ sessionsInStage: number }>(page, 'progression');
  expect(progression[0]!.sessionsInStage).toBe(2);
  await page.goto('/#/');
  await expect(page.getByTestId('split-resume')).toHaveCount(0);
});
