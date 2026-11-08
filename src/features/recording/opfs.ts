/** Recording audio lives in the Origin Private File System (SPEC §13.4); metadata stays in IndexedDB. */
const DIR = 'recordings';

/** OPFS with writable file handles (`createWritable` arrived in WebKit later than `getDirectory`). */
export function opfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    typeof FileSystemFileHandle !== 'undefined' &&
    typeof FileSystemFileHandle.prototype.createWritable === 'function'
  );
}

async function directory(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create: true });
}

export async function saveFile(name: string, bytes: Uint8Array): Promise<void> {
  const handle = await (await directory()).getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(bytes as Uint8Array<ArrayBuffer>);
  await writable.close();
}

export async function readFile(name: string): Promise<Uint8Array> {
  const handle = await (await directory()).getFileHandle(name);
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

/** True when the recording's audio file is still there (backups and imports carry only the metadata). */
export async function fileExists(name: string): Promise<boolean> {
  try {
    await (await directory()).getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Data reset: removes every recording's audio along with the database rows. Best effort — the reset itself
 * must not fail when the file system is unavailable (e.g. `getDirectory` rejects in a private window).
 */
export async function removeAllFiles(): Promise<void> {
  if (!opfsSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(DIR, { recursive: true });
  } catch {
    // Nothing stored, or no file system access: nothing to remove.
  }
}

/**
 * Full backup export: reads the audio of each named file. Never throws — a file that is gone or a file system
 * that cannot be opened (no OPFS, or `getDirectory` rejecting as in Playwright WebKit) lands in `missing`.
 */
export async function readFiles(
  names: readonly string[],
): Promise<{ files: { name: string; data: Uint8Array }[]; missing: string[] }> {
  const files: { name: string; data: Uint8Array }[] = [];
  const missing: string[] = [];
  const supported = opfsSupported();
  for (const name of names) {
    if (!supported) {
      missing.push(name);
      continue;
    }
    try {
      files.push({ name, data: await readFile(name) });
    } catch {
      missing.push(name);
    }
  }
  return { files, missing };
}

/**
 * Full backup import: writes each file, skipping ones already there unless `overwrite`. Never throws; returns
 * how many could not be written (no OPFS, quota, a rejected `getDirectory`).
 */
export async function saveFiles(
  files: readonly { name: string; data: Uint8Array }[],
  overwrite: boolean,
): Promise<{ saved: number; failed: number }> {
  if (!opfsSupported()) return { saved: 0, failed: files.length };
  let saved = 0;
  let failed = 0;
  for (const file of files) {
    try {
      if (!overwrite && (await fileExists(file.name))) continue;
      await saveFile(file.name, file.data);
      saved++;
    } catch {
      failed++;
    }
  }
  return { saved, failed };
}
