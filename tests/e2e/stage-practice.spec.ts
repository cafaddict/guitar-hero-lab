import { expect, type Page, test } from '@playwright/test';
import { putRows, readStore, type StoredAttempt } from './support/idb';
import { playItem, pressOn } from './support/session';

interface StoredSession {
  stage: number;
  routineId: string | null;
  completedItems: number;
  endedAt: number | null;
}
interface StoredProgression {
  stage: number;
  sessionsInStage: number;
}

async function withoutMic(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

const row = (page: Page, label: string) => page.getByTestId('stage-practice-item').filter({ hasText: label });

test('E2E-23: a stage page exercise played right away is recorded like any run (D-072)', async ({ page }) => {
  await withoutMic(page);
  await page.goto('/#/curriculum/0');
  await expect(page.getByTestId('stage-practice')).toBeVisible();
  await row(page, '다이어그램 읽기 퀴즈').getByTestId('stage-practice-now').click();
  await expect(page).toHaveURL(/#\/curriculum\/0\/practice\/\d+$/);
  await page.getByTestId('exercise-start').click();
  for (let q = 0; q < 10; q++) {
    await expect(page.getByTestId('q1-view')).toBeVisible();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
  }
  await expect(page.getByText('기록했어요.')).toBeVisible();
  const attempts = await readStore<StoredAttempt & { sessionId: string | null }>(page, 'attempts');
  expect(attempts.map((a) => [a.exerciseType, a.sessionId])).toEqual([['Q1', null]]);
});

test('E2E-23: exercises picked on another stage run as one session filed under that stage (D-072)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await withoutMic(page);
  // The learner is at Stage 1 (entered today) and goes back to Stage 0's self-check cards and diagram quiz.
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 1,
      stageEnteredAt: Date.now(),
      sessionsInStage: 0,
      gVoicing: 'G-2f',
      history: [],
      exam: {},
      completedBeginner1: false,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);
  await page.goto('/#/curriculum/0');
  await row(page, '자가 체크').getByTestId('stage-practice-pick').check();
  await row(page, '다이어그램 읽기 퀴즈').getByTestId('stage-practice-pick').check();
  await expect(row(page, '다이어그램 읽기 퀴즈')).toContainText('2번째');
  await page.getByTestId('stage-practice-start').click();
  await expect(page.getByTestId('session-header')).toBeVisible();
  const played: string[] = [];
  while (await page.getByTestId('session-header').isVisible()) {
    // A curriculum session (routineId custom) is never split (D-104).
    await expect(page.getByTestId('split-session')).toHaveCount(0);
    played.push(await playItem(page));
  }
  expect(played).toEqual(['K1', 'Q1']);
  await pressOn(page, 'report-save');
  await expect(page).toHaveURL(/#\/$/);

  const sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ stage: 0, routineId: 'custom', completedItems: 2 });
  expect(sessions[0]!.endedAt).not.toBeNull();
  // Practising Stage 0 does not fill Stage 1's minimum stay.
  expect((await readStore<StoredProgression>(page, 'progression'))[0]).toMatchObject({
    stage: 1,
    sessionsInStage: 0,
  });
});
