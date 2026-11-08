import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { RecordingMeta } from '../domain/records';
import { GuitarDb, TABLE_NAMES } from './db';
import { applyImport, exportAll } from './exportImport';
import {
  AUDIO_PREFIX,
  BACKUP_ENTRY,
  createFullBackup,
  fullBackupFileName,
  parseBackupFile,
  parseFullBackup,
} from './fullBackup';
import { Repository } from './repo';
import { DEFAULT_SETTINGS } from './settings';
import { createZip, readZip } from './zip';

const T0 = new Date(2026, 10, 8, 18).getTime();
let dbCounter = 0;
function freshRepo(): Repository {
  dbCounter += 1;
  return new Repository(new GuitarDb(`full-backup-db-${dbCounter}-${Date.now()}`));
}

function recording(id: string, fileName: string): RecordingMeta {
  return {
    id,
    createdAt: T0,
    label: id,
    kind: 'chord-clean-strum',
    voicingId: 'C',
    expected: {},
    sampleRate: 48_000,
    durationMs: 2000,
    device: 'test mic',
    calibrationId: null,
    fileName,
  };
}

const wavA = new Uint8Array(512).map((_, i) => i % 251);
const wavB = new Uint8Array(64).fill(7);

async function sourceRepo(): Promise<Repository> {
  const repo = freshRepo();
  await repo.saveSettings({ ...DEFAULT_SETTINGS, theme: 'light' });
  await repo.db.recordings.bulkAdd([recording('r1', 'C-strum-1.wav'), recording('r2', 'C-pluck-2.wav')]);
  return repo;
}

const text = (s: string) => new TextEncoder().encode(s);

describe('full backup (JSON + recording audio in one zip)', () => {
  it('test_fullBackup_exportThenImportReplace_restoresTablesAndAudio', async () => {
    const source = await sourceRepo();
    const envelope = await exportAll(source.db, T0);
    const zip = createFullBackup(envelope, [
      { name: 'C-strum-1.wav', data: wavA },
      { name: 'C-pluck-2.wav', data: wavB },
    ]);

    const preview = parseBackupFile(zip);
    const target = freshRepo();
    await applyImport(target, preview.envelope, 'replace');

    const again = await exportAll(target.db, T0);
    for (const name of TABLE_NAMES) expect(again.tables[name], name).toEqual(envelope.tables[name]);
    expect(preview.counts.recordings).toBe(2);
    expect(preview.audio.map((a) => a.name)).toEqual(['C-strum-1.wav', 'C-pluck-2.wav']);
    expect([...preview.audio[0]!.data]).toEqual([...wavA]);
    expect([...preview.audio[1]!.data]).toEqual([...wavB]);
  });

  it('test_createFullBackup_layout_backupJsonFirstThenRecordingsFolder', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const entries = readZip(createFullBackup(envelope, [{ name: 'C-strum-1.wav', data: wavA }]));
    expect(entries.map((e) => e.name)).toEqual([BACKUP_ENTRY, `${AUDIO_PREFIX}C-strum-1.wav`]);
    expect(JSON.parse(new TextDecoder().decode(entries[0]!.data))).toEqual(envelope);
  });

  it('test_fullBackup_noAudio_importsRowsWithEmptyAudio', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const preview = parseFullBackup(createFullBackup(envelope, []));
    expect(preview.counts.recordings).toBe(2);
    expect(preview.audio).toEqual([]);
  });

  it('test_fullBackup_mergeIntoUsedDevice_skipsExistingKeys', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const preview = parseBackupFile(createFullBackup(envelope, [{ name: 'C-strum-1.wav', data: wavA }]));
    const used = freshRepo();
    await used.saveSettings({ ...DEFAULT_SETTINGS, theme: 'contrast' });
    await used.db.recordings.add({ ...recording('r1', 'C-strum-1.wav'), device: 'kept' });

    await applyImport(used, preview.envelope, 'merge');

    expect((await used.settings()).theme).toBe('contrast');
    expect((await used.db.recordings.get('r1'))?.device).toBe('kept');
    expect(await used.db.recordings.count()).toBe(2);
  });

  it('test_parseFullBackup_audioNoRowNames_isDropped', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const zip = createFullBackup(envelope, [
      { name: 'C-strum-1.wav', data: wavA },
      { name: 'stray.wav', data: wavB },
    ]);
    expect(parseFullBackup(zip).audio.map((a) => a.name)).toEqual(['C-strum-1.wav']);
  });

  it('test_parseBackupFile_jsonBytes_readsAsJsonBackupWithoutAudio', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const preview = parseBackupFile(text(JSON.stringify(envelope)));
    expect(preview.counts.recordings).toBe(2);
    expect(preview.audio).toEqual([]);
  });

  it('test_parseBackupFile_jsonWithBom_readsAsJson', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    expect(parseBackupFile(text(`﻿${JSON.stringify(envelope)}`)).counts.recordings).toBe(2);
  });

  it('test_parseBackupFile_garbage_rejectsAsNotJson', () => {
    expect(() => parseBackupFile(text('hello'))).toThrow(/JSON/);
    expect(() => parseBackupFile(new Uint8Array([0xff, 0xfe, 0x00, 0xd8]))).toThrow(/JSON/);
  });

  it('test_parseFullBackup_otherAppZip_rejectsMissingBackupJson', () => {
    const zip = createZip([
      { name: 'labels.json', data: text('{"clips":[]}') },
      { name: 'clip.wav', data: wavA },
    ]);
    expect(() => parseBackupFile(zip)).toThrow(/not a guitar-hero full backup/);
  });

  it('test_parseFullBackup_backupJsonFromOtherApp_rejectsEnvelope', () => {
    const zip = createZip([
      {
        name: BACKUP_ENTRY,
        data: text(JSON.stringify({ app: 'other', schemaVersion: 1, exportedAt: 0, tables: {} })),
      },
    ]);
    expect(() => parseBackupFile(zip)).toThrow();
  });

  it('test_parseFullBackup_backupJsonNotJson_rejectsAsNotJson', () => {
    const zip = createZip([{ name: BACKUP_ENTRY, data: text('{oops') }]);
    expect(() => parseBackupFile(zip)).toThrow(/JSON/);
  });

  it('test_parseFullBackup_brokenZip_rejectsAsUnreadableZip', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const zip = createFullBackup(envelope, [{ name: 'C-strum-1.wav', data: wavA }]);
    expect(() => parseBackupFile(zip.subarray(0, zip.length - 40))).toThrow(/not a readable zip file/);
    const flipped = zip.slice();
    flipped[30 + BACKUP_ENTRY.length + 5]! ^= 0xff; // inside backup.json's data
    expect(() => parseBackupFile(flipped)).toThrow(/CRC/);
  });

  it('test_parseFullBackup_endRecordEntryCountLowered_rejectsAsUnreadableZip', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const zip = createFullBackup(envelope, [{ name: 'C-strum-1.wav', data: wavA }]);
    new DataView(zip.buffer, zip.byteOffset, zip.byteLength).setUint16(zip.length - 22 + 10, 1, true);
    expect(() => parseFullBackup(zip)).toThrow(/not a readable zip file/);
  });

  it('test_parseFullBackup_localMethodChanged_rejectsAsUnreadableZip', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const zip = createFullBackup(envelope, [{ name: 'C-strum-1.wav', data: wavA }]);
    new DataView(zip.buffer, zip.byteOffset, zip.byteLength).setUint16(8, 8, true);
    expect(() => parseFullBackup(zip)).toThrow(/not a readable zip file/);
  });

  it('test_parseFullBackup_traversalName_rejectsUnsafeName', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    const zip = createZip([
      { name: BACKUP_ENTRY, data: text(JSON.stringify(envelope)) },
      { name: `${AUDIO_PREFIX}../evil.wav`, data: wavA },
    ]);
    expect(() => parseFullBackup(zip)).toThrow(/unsafe/);
  });

  it('test_createFullBackup_unsafeName_throws', async () => {
    const envelope = await exportAll((await sourceRepo()).db, T0);
    expect(() => createFullBackup(envelope, [{ name: 'a/b.wav', data: wavA }])).toThrow(/unsafe/);
  });

  it('test_fullBackupFileName_date_namesZipWithDate', () => {
    expect(fullBackupFileName(new Date(2026, 10, 8, 12).getTime())).toBe(
      'guitar-hero-full-backup-2026-11-08.zip',
    );
  });
});
