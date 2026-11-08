/**
 * Minimal ZIP writer, "store" method (no compression; WAV/JSON barely compress anyway). Dependency-free so
 * the recording kit can bundle its WAVs and labels.json into one download (SPEC §13.4).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipInput {
  name: string;
  data: Uint8Array;
}

/** DOS date/time fields for `ms` (local time), as stored in ZIP headers. */
function dosDateTime(ms: number): { time: number; date: number } {
  const d = new Date(ms);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function createZip(files: readonly ZipInput[], now = Date.now()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.data.length, true);
    lv.setUint32(22, file.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, file.data);
    centrals.push(central);
    offset += local.length + file.data.length;
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + end.length);
  let pos = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

/** Thrown for anything that is not a zip this app can read (the message is for logs; the UI shows its own). */
export class ZipError extends Error {
  override name = 'ZipError';
}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const END_SIG = 0x06054b50;

/** True when `bytes` start with a zip local file header ("PK\x03\x04") or an empty archive's end record. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const sig = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
  return sig === LOCAL_SIG || sig === END_SIG;
}

/**
 * Reads a "store" method zip (what `createZip` writes) through its central directory. A ZipError rejects:
 * - an end record on a second disk, with disagreeing entry counts, or whose comment does not end the file;
 * - a central directory that does not end exactly at the end record, or whose entries do not fill it exactly;
 * - a local header whose method, flags, name, CRC or sizes differ from its central directory entry;
 * - a CRC-32 mismatch, compressed entries, ZIP64, encryption and truncated files.
 * The returned entries are views into `bytes` (no copy).
 */
export function readZip(bytes: Uint8Array): ZipInput[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p: number) => view.getUint16(p, true);
  const u32 = (p: number) => view.getUint32(p, true);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (u32(i) === END_SIG) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError('zip: end of central directory not found');
  const disk = u16(end + 4);
  const centralDisk = u16(end + 6);
  const diskCount = u16(end + 8);
  const count = u16(end + 10);
  const centralSize = u32(end + 12);
  const centralOffset = u32(end + 16);
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff)
    throw new ZipError('zip: ZIP64 is not supported');
  if (disk !== 0 || centralDisk !== 0) throw new ZipError('zip: multi-disk archives are not supported');
  if (diskCount !== count) throw new ZipError('zip: entry counts in the end record disagree');
  if (end + 22 + u16(end + 20) !== bytes.length)
    throw new ZipError('zip: end record comment does not match the file length');
  if (centralOffset + centralSize !== end) throw new ZipError('zip: central directory out of range');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const entries: ZipInput[] = [];
  let p = centralOffset;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || u32(p) !== CENTRAL_SIG) throw new ZipError('zip: bad central directory entry');
    const flags = u16(p + 8);
    const method = u16(p + 10);
    const crc = u32(p + 16);
    const compressedSize = u32(p + 20);
    const size = u32(p + 24);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    const localOffset = u32(p + 42);
    const next = p + 46 + nameLen + extraLen + commentLen;
    if (next > end) throw new ZipError('zip: bad central directory entry');
    const rawName = bytes.subarray(p + 46, p + 46 + nameLen);
    let name: string;
    try {
      name = decoder.decode(rawName);
    } catch {
      throw new ZipError('zip: entry name is not UTF-8');
    }
    if (flags & 0x0001) throw new ZipError(`zip: ${name} is encrypted`);
    if (method !== 0 || compressedSize !== size)
      throw new ZipError(`zip: ${name} is compressed (method ${method}); only stored entries are read`);
    if (localOffset + 30 > centralOffset || u32(localOffset) !== LOCAL_SIG)
      throw new ZipError(`zip: ${name}: bad local header`);
    const localNameLen = u16(localOffset + 26);
    const start = localOffset + 30 + localNameLen + u16(localOffset + 28);
    if (start + size > centralOffset) throw new ZipError(`zip: ${name} is truncated`);
    const localName = bytes.subarray(localOffset + 30, localOffset + 30 + localNameLen);
    if (
      u16(localOffset + 6) !== flags ||
      u16(localOffset + 8) !== method ||
      u32(localOffset + 14) !== crc ||
      u32(localOffset + 18) !== compressedSize ||
      u32(localOffset + 22) !== size ||
      localNameLen !== nameLen ||
      localName.some((byte, k) => byte !== rawName[k])
    )
      throw new ZipError(`zip: ${name}: local header does not match the central directory`);
    const data = bytes.subarray(start, start + size);
    if (crc32(data) !== crc) throw new ZipError(`zip: ${name}: CRC mismatch`);
    entries.push({ name, data });
    p = next;
  }
  if (p !== end) throw new ZipError('zip: central directory has more bytes than its entry count');
  return entries;
}
