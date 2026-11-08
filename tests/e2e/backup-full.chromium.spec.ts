import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { readZip } from '../../src/data/zip';
import { putRows, readStore } from './support/idb';

/**
 * Full backup (D-103): JSON tables + the recording kit's OPFS audio in one zip. Chromium only
 * (playwright.config.ts CHROMIUM_ONLY): Playwright's WebKit rejects `navigator.storage.getDirectory()`, so the
 * audio round trip needs Chromium; the no-OPFS path runs everywhere in backup-no-opfs.spec.ts.
 */

const TABLES = [
  'voicings',
  'routines',
  'sessions',
  'attempts',
  'metrics',
  'skills',
  'progression',
  'reviews',
  'calibrations',
  'recordings',
  'meta',
];

async function counts(page: Page): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = (await readStore<unknown>(page, t)).length;
  return out;
}

const WAV = Array.from({ length: 4096 }, (_, i) => (i * 31 + 7) % 256);

function recording(id: string, label: string, fileName: string, createdAt: number) {
  return {
    id,
    createdAt,
    label,
    kind: 'strum-grid',
    voicingId: null,
    expected: { bpm: 60 },
    sampleRate: 48_000,
    durationMs: 2000,
    device: 'e2e mic',
    calibrationId: null,
    fileName,
  };
}

function writeOpfs(page: Page, name: string, bytes: number[]): Promise<void> {
  return page.evaluate(
    async ({ name, bytes }) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('recordings', { create: true });
      const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await writable.write(new Uint8Array(bytes));
      await writable.close();
    },
    { name, bytes },
  );
}

function readOpfs(page: Page, name: string): Promise<number[] | null> {
  return page.evaluate(async (name) => {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('recordings');
      const file = await (await dir.getFileHandle(name)).getFile();
      return [...new Uint8Array(await file.arrayBuffer())];
    } catch {
      return null;
    }
  }, name);
}

test('full backup: export zip → reset → import restores tables and recording audio for the kit zip', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const now = Date.now();
  // One recording with audio, one row without (as after a JSON import): the zip carries the audio it can read.
  await putRows(page, 'recordings', [
    recording('rec-1', 'strum-grid', 'strum-grid-1.wav', now - 2000),
    recording('rec-2', 'C-strum', 'C-strum-2.wav', now - 1000),
  ]);
  await writeOpfs(page, 'strum-grid-1.wav', WAV);

  // Export the full backup.
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-full').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^guitar-hero-full-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.getByTestId('backup-message')).toContainText('녹음 1개는 오디오를 읽지 못해');
  const zip = readFileSync(await download.path());
  expect(readZip(zip).map((e) => e.name)).toEqual(['backup.json', 'recordings/strum-grid-1.wav']);
  const before = await counts(page);
  expect(before.recordings).toBe(2);

  // Reset removes the rows and the OPFS audio.
  await page.getByTestId('reset-start').click();
  await page.getByTestId('reset-confirm-1').click();
  await page.getByTestId('reset-confirm-2').click();
  await expect(page.getByText('모든 데이터를 지웠어요.')).toBeVisible();
  expect((await counts(page)).recordings).toBe(0);
  expect(await readOpfs(page, 'strum-grid-1.wav')).toBeNull();

  // Import: preview, then replace (two-step), as with a JSON file.
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByTestId('import-preview')).toContainText('recordings 2');
  await expect(page.getByTestId('import-preview')).toContainText('녹음 오디오 1개');
  await page.getByRole('button', { name: '바꾸기(지금 데이터를 지우고 가져오기)' }).click();
  await page.getByTestId('import-replace-confirm').click();
  await expect(page.getByTestId('backup-message')).toHaveText('가져왔어요.');

  expect(await counts(page)).toEqual(before);
  expect(await readOpfs(page, 'strum-grid-1.wav')).toEqual(WAV);

  // The restored audio goes into the recording kit zip again; the row without audio stays out.
  await page.goto('/#/settings/recording');
  const kitPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '모두 내보내기(zip)' }).click();
  const kit = readZip(readFileSync(await (await kitPromise).path()));
  expect(kit.map((e) => e.name)).toEqual(['strum-grid-1.wav', 'labels.json']);
  expect([...kit[0]!.data]).toEqual(WAV);
});

test('full backup merge keeps this device’s audio and adds the missing files', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const now = Date.now();
  await putRows(page, 'recordings', [recording('rec-1', 'strum-grid', 'strum-grid-1.wav', now)]);
  await writeOpfs(page, 'strum-grid-1.wav', WAV);
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-full').click();
  const zip = readFileSync(await (await downloadPromise).path());

  // Same key with different audio on this device: merge skips it. A missing file is written.
  const local = WAV.map((b) => 255 - b);
  await writeOpfs(page, 'strum-grid-1.wav', local);
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: zip });
  await page.getByRole('button', { name: '합치기(같은 기록은 건너뜀)' }).click();
  await expect(page.getByTestId('backup-message')).toHaveText('가져왔어요.');
  expect(await readOpfs(page, 'strum-grid-1.wav')).toEqual(local);

  await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('recordings');
    await dir.removeEntry('strum-grid-1.wav');
  });
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: zip });
  await page.getByRole('button', { name: '합치기(같은 기록은 건너뜀)' }).click();
  await expect(page.getByTestId('backup-message')).toHaveText('가져왔어요.');
  expect(await readOpfs(page, 'strum-grid-1.wav')).toEqual(WAV);
});
