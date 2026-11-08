import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createZip, readZip } from '../../src/data/zip';
import { putRows, readStore } from './support/idb';

/**
 * Full backup without a usable OPFS (D-103): `getDirectory` rejects as in Playwright WebKit or a private window.
 * Forced here on every engine so the behaviour is the same everywhere: export and import still work, and the
 * screen says the audio was left out.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (navigator.storage)
      navigator.storage.getDirectory = () => Promise.reject(new DOMException('blocked', 'SecurityError'));
  });
});

const row = {
  id: 'rec-1',
  createdAt: 1,
  label: 'strum-grid',
  kind: 'strum-grid',
  voicingId: null,
  expected: {},
  sampleRate: 48_000,
  durationMs: 2000,
  device: 'e2e mic',
  calibrationId: null,
  fileName: 'strum-grid-1.wav',
};

test('full backup export without OPFS keeps the rows and says the audio is missing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await putRows(page, 'recordings', [row]);
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-full').click();
  const zip = readZip(readFileSync(await (await downloadPromise).path()));
  await expect(page.getByTestId('backup-message')).toContainText('녹음 1개는 오디오를 읽지 못해');
  expect(zip.map((e) => e.name)).toEqual(['backup.json']);
  const envelope = JSON.parse(new TextDecoder().decode(zip[0]!.data));
  expect(envelope.tables.recordings).toHaveLength(1);
});

test('full backup import without OPFS restores the rows and says the audio was not saved', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const envelope = {
    app: 'guitar-hero',
    schemaVersion: 2,
    exportedAt: 1,
    tables: { recordings: [row] },
  };
  const zip = createZip([
    { name: 'backup.json', data: new TextEncoder().encode(JSON.stringify(envelope)) },
    { name: 'recordings/strum-grid-1.wav', data: new Uint8Array(256).fill(9) },
  ]);
  await page.goto('/#/settings');
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'backup.zip', mimeType: 'application/zip', buffer: Buffer.from(zip) });
  await expect(page.getByTestId('import-preview')).toContainText('녹음 오디오 1개');
  await page.getByRole('button', { name: '합치기(같은 기록은 건너뜀)' }).click();
  await expect(page.getByTestId('backup-message')).toContainText('녹음 오디오 1개는 저장하지 못했어요');
  expect(await readStore(page, 'recordings')).toHaveLength(1);
});

test('a zip from another app is refused with the import error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/settings');
  const other = createZip([{ name: 'labels.json', data: new TextEncoder().encode('{}') }]);
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'other.zip', mimeType: 'application/zip', buffer: Buffer.from(other) });
  await expect(page.getByTestId('backup-message')).toContainText('파일을 읽지 못했어요');
  await expect(page.getByTestId('import-preview')).toHaveCount(0);
});
