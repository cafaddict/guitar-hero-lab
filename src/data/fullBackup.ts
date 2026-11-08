/**
 * Full backup (D-103): the JSON backup envelope plus the recording kit's WAV audio (OPFS) in one store-method
 * zip — `backup.json` (the same envelope as the JSON export) and `recordings/<fileName>` per recording row whose
 * audio could be read. Importing goes through the same parse → preview → merge/replace path as a JSON file.
 */
import { type ExportEnvelope, type ImportPreview, parseImport } from './exportImport';
import { createZip, looksLikeZip, readZip, ZipError, type ZipInput } from './zip';

export const BACKUP_ENTRY = 'backup.json';
export const AUDIO_PREFIX = 'recordings/';

export interface AudioFile {
  /** The recording row's `fileName` (an OPFS file name, no folders). */
  name: string;
  data: Uint8Array;
}

/** A parsed backup file of either kind; `audio` is empty for a JSON backup. */
export interface BackupPreview extends ImportPreview {
  audio: AudioFile[];
}

/** An OPFS file name we are willing to write: one path segment, no traversal. */
export function safeAudioName(name: string): boolean {
  return name.length > 0 && name.length <= 255 && name !== '.' && name !== '..' && !/[/\\\0]/.test(name);
}

export function createFullBackup(
  envelope: ExportEnvelope,
  audio: readonly AudioFile[],
  now = envelope.exportedAt,
): Uint8Array {
  const files: ZipInput[] = [
    { name: BACKUP_ENTRY, data: new TextEncoder().encode(JSON.stringify(envelope)) },
    ...audio.map((a) => {
      if (!safeAudioName(a.name)) throw new Error(`unsafe recording file name: ${a.name}`);
      return { name: `${AUDIO_PREFIX}${a.name}`, data: a.data };
    }),
  ];
  return createZip(files, now);
}

export function fullBackupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `guitar-hero-full-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`;
}

/**
 * Parses a full backup zip; throws with a readable message for a broken zip, a zip from another app (no
 * `backup.json`), an invalid envelope, or audio entries with unsafe names. Audio that no recording row names is
 * dropped (nothing would ever read it).
 */
export function parseFullBackup(bytes: Uint8Array): BackupPreview {
  let entries: ZipInput[];
  try {
    entries = readZip(bytes);
  } catch (error) {
    throw error instanceof ZipError ? new Error(`not a readable zip file (${error.message})`) : error;
  }
  const json = entries.find((e) => e.name === BACKUP_ENTRY);
  if (!json) throw new Error(`not a guitar-hero full backup: ${BACKUP_ENTRY} missing`);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(json.data);
  } catch {
    throw new Error(`${BACKUP_ENTRY} is not UTF-8 text`);
  }
  const preview = parseImport(text);
  const named = new Set(preview.envelope.tables.recordings.map((r) => r.fileName));
  const audio: AudioFile[] = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(AUDIO_PREFIX)) continue;
    const name = entry.name.slice(AUDIO_PREFIX.length);
    if (!safeAudioName(name)) throw new Error(`unsafe recording file name: ${entry.name}`);
    if (named.has(name)) audio.push({ name, data: entry.data });
  }
  return { ...preview, audio };
}

/** Either kind of backup file: a zip (by its signature) is a full backup, anything else is read as JSON. */
export function parseBackupFile(bytes: Uint8Array): BackupPreview {
  if (looksLikeZip(bytes)) return parseFullBackup(bytes);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('not a JSON file');
  }
  return { ...parseImport(text), audio: [] };
}
