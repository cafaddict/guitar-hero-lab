import { expect, type Page, test } from '@playwright/test';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { E10_BACKING_FIXTURE, E10_FIXTURE, e10BleedLoopbackGain } from '../../tools/fixtures/generate';
import { calibrateThroughOnboarding } from './support/calibrate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { putRows, readStore, type StoredAttempt, seedCalibration } from './support/idb';

const SIMULATED_RTT_MS = 60;

async function gridStartOf(page: Page): Promise<number> {
  return expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { gridStartTime: number | null } }).__gh_test.gridStartTime,
      ),
    )
    .not.toBeNull()
    .then(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { gridStartTime: number } }).__gh_test.gridStartTime,
      ),
    );
}

test('E2E-16: E10 Em pentatonic step 1 at 80 BPM — 4 flawless cycles graduate, a +1 semitone note is shown by position', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/#/settings/diagnostics');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('진단');
  await putRows(page, 'calibrations', [seedCalibration(SIMULATED_RTT_MS)]);

  await page.goto(
    `/#/practice/E10?scaleId=${E10_FIXTURE.scaleId}&step=${E10_FIXTURE.step}&bpm=${E10_FIXTURE.bpm}`,
  );
  await page.getByTestId('exercise-start').click();
  const view = page.getByTestId('e10-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);

  const gridStart = await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { gridStartTime: number | null } }).__gh_test.gridStartTime,
      ),
    )
    .not.toBeNull()
    .then(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { gridStartTime: number } }).__gh_test.gridStartTime,
      ),
    );
  await playFixture(page, 'e10-em-pent-s1-80.wav', gridStart + SIMULATED_RTT_MS / 1000 - E10_FIXTURE.leadS);

  // Cycles 1–4 are flawless; the 5th has the 6th note one fret (a semitone) high.
  const cycles = page.getByTestId('seq-cycles');
  await expect(cycles).toHaveAttribute('data-streak', '4', { timeout: 110_000 });
  await expect(cycles).toHaveAttribute('data-count', String(E10_FIXTURE.cycles), { timeout: 40_000 });
  await expect(cycles).toHaveAttribute('data-streak', '0');
  const last = page.getByTestId('seq-last');
  await expect(last).toHaveAttribute('data-flawless', 'false');
  await expect(last).toHaveAttribute('data-fault-position', String(E10_FIXTURE.wrongIndex + 1));
  await expect(last).toHaveAttribute('data-fault-semitones', '1');
  await expect(page.getByTestId('seq-hint').first()).toContainText(
    `${E10_FIXTURE.wrongIndex + 1}번째 음이 반음 1개 높아요`,
  );

  await page.keyboard.press('Space');
  await expect(page.getByTestId('e10-summary')).toHaveAttribute('data-graduated', 'true', {
    timeout: 30_000,
  });

  const attempts = await readStore<
    StoredAttempt & { result: { cycles: { flawless: boolean }[]; graduated: boolean } }
  >(page, 'attempts');
  expect(attempts).toHaveLength(1);
  const attempt = attempts[0]!;
  expect(attempt.exerciseType).toBe('E10');
  expect(attempt.detectorVersion).toBe(DETECTOR_VERSION);
  expect(attempt.processingMs).toBeGreaterThan(0);
  expect(attempt.result.cycles.slice(0, 5).map((c) => c.flawless)).toEqual([true, true, true, true, false]);
  expect(attempt.result.graduated).toBe(true);
});

type ScaleAttempt = StoredAttempt & {
  params: { withBacking: boolean; earphones: boolean };
  result: {
    backingAudible?: boolean;
    graduated: boolean;
    cycles: { flawless: boolean; uncertain: boolean; faults?: { index: number; status: string }[] }[];
  };
};

test('E2E-16b (D-102): E10 "반주와 함께" on speakers — the backing bleed is masked, notes left out stay missed, the run records', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: SIMULATED_RTT_MS, deny: false });
  await serveFixtures(page);
  // The RTT is measured through the loopback like on a device; then the "speaker" plays at the bleed level.
  const rttMs = await calibrateThroughOnboarding(page);
  expect(rttMs).toBeGreaterThanOrEqual(SIMULATED_RTT_MS);
  const gain = e10BleedLoopbackGain();
  await page.evaluate(
    ([delayMs, level]) =>
      (window as unknown as { __fakeMic: { setLoopback(d: number, g: number): void } }).__fakeMic.setLoopback(
        delayMs,
        level,
      ),
    [SIMULATED_RTT_MS, gain] as const,
  );
  test.info().annotations.push({
    type: 'bleed',
    description: `RTT ${rttMs} ms, loopback gain ${gain.toFixed(4)} (${E10_BACKING_FIXTURE.bleedRelDb} dB)`,
  });

  await page.goto(
    `/#/practice/E10?scaleId=${E10_FIXTURE.scaleId}&step=${E10_FIXTURE.step}&bpm=${E10_FIXTURE.bpm}&withBacking=true`,
  );
  await page.getByTestId('exercise-start').click();
  const view = page.getByTestId('e10-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await expect(page.getByTestId('e10-earphones')).toHaveAttribute('data-earphones', 'false');
  await expect(page.getByTestId('e10-speaker-note')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);
  const gridStart = await gridStartOf(page);
  await playFixture(
    page,
    'e10-em-pent-s1-80-skips.wav',
    gridStart + SIMULATED_RTT_MS / 1000 - E10_FIXTURE.leadS,
  );

  const cycles = page.getByTestId('seq-cycles');
  await expect(cycles).toHaveAttribute('data-count', String(E10_BACKING_FIXTURE.cycles), {
    timeout: 130_000,
  });
  await page.keyboard.press('Space');
  await expect(page.getByTestId('e10-summary')).toBeVisible({ timeout: 30_000 });

  const attempts = await readStore<ScaleAttempt>(page, 'attempts');
  const e10 = attempts.filter((a) => a.exerciseType === 'E10');
  expect(e10).toHaveLength(1);
  const attempt = e10[0]!;
  expect(attempt.params).toMatchObject({ withBacking: true, earphones: false });
  // A recorded run, not a reference one (D-067's `backingAudible: true` is gone).
  expect(attempt.result.backingAudible).toBeUndefined();
  const [first, ...rest] = attempt.result.cycles.slice(0, E10_BACKING_FIXTURE.cycles);
  // The left-out chord tones are missed, not filled in by the leaked backing strums (OK) or blurred by them
  // (UNCLEAR → an "uncertain" cycle that would keep the streak). Fails with the mask off.
  expect(first).toMatchObject({ flawless: false, uncertain: false });
  expect(first!.faults).toEqual(
    E10_BACKING_FIXTURE.skippedIndices.map((index) => ({ index, status: 'MISSED' })),
  );
  // Every note played on top of the backing strums is judged as played: four flawless cycles graduate the step.
  expect(rest.map((c) => c.flawless)).toEqual([true, true, true, true]);
  expect(attempt.result.graduated).toBe(true);
  const metrics = await readStore<{ subjectKey: string; metric: string }>(page, 'metrics');
  expect(metrics.some((m) => m.subjectKey === 'scale:em-pent-open:s1' && m.metric === 'streakBpm')).toBe(
    true,
  );
});
