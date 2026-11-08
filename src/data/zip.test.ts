import { describe, expect, it } from 'vitest';
import { listZip, readEntry } from '../../tools/guitarset/unzip';
import { crc32, createZip, looksLikeZip, readZip, ZipError } from './zip';

describe('store-method zip writer', () => {
  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips through an independent reader (UTF-8 names, binary data)', () => {
    const wav = new Uint8Array(1000).map((_, i) => (i * 37) % 256);
    const labels = new TextEncoder().encode(JSON.stringify({ label: '깨끗한 스트럼' }));
    const zip = Buffer.from(
      createZip([
        { name: 'clip-1.wav', data: wav },
        { name: 'labels.json', data: labels },
      ]),
    );
    const entries = listZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['clip-1.wav', 'labels.json']);
    expect([...readEntry(zip, entries[0]!)]).toEqual([...wav]);
    expect(JSON.parse(readEntry(zip, entries[1]!).toString('utf8'))).toEqual({ label: '깨끗한 스트럼' });
  });
});

describe('store-method zip reader', () => {
  const wav = new Uint8Array(1000).map((_, i) => (i * 37) % 256);
  const sample = () =>
    createZip([
      { name: '녹음/clip-1.wav', data: wav },
      { name: 'empty.txt', data: new Uint8Array(0) },
    ]);

  it('test_readZip_ownWriterOutput_returnsNamesAndBytes', () => {
    const entries = readZip(sample());
    expect(entries.map((e) => e.name)).toEqual(['녹음/clip-1.wav', 'empty.txt']);
    expect([...entries[0]!.data]).toEqual([...wav]);
    expect(entries[1]!.data.length).toBe(0);
  });

  it('test_readZip_emptyArchive_returnsNoEntries', () => {
    expect(readZip(createZip([]))).toEqual([]);
  });

  it('test_readZip_viewWithOffset_readsTheView', () => {
    const zip = sample();
    const padded = new Uint8Array(zip.length + 7);
    padded.set(zip, 7);
    expect(readZip(padded.subarray(7)).map((e) => e.name)).toEqual(['녹음/clip-1.wav', 'empty.txt']);
  });

  it('test_readZip_flippedDataByte_rejectsCrcMismatch', () => {
    const zip = sample();
    zip[30 + new TextEncoder().encode('녹음/clip-1.wav').length + 10]! ^= 0xff;
    expect(() => readZip(zip)).toThrow(/CRC/);
  });

  it('test_readZip_truncatedFile_rejectsWithZipError', () => {
    const zip = sample();
    expect(() => readZip(zip.subarray(0, zip.length - 30))).toThrow(ZipError);
    expect(() => readZip(zip.subarray(0, 10))).toThrow(/end of central directory/);
  });

  it('test_readZip_notAZip_rejectsWithZipError', () => {
    expect(() => readZip(new TextEncoder().encode('{"app":"guitar-hero"}'))).toThrow(ZipError);
    expect(() => readZip(new Uint8Array(0))).toThrow(ZipError);
  });

  it('test_readZip_deflatedEntry_rejectsAsCompressed', () => {
    const zip = sample();
    // Method field of the first central directory entry (stored → deflate).
    const view = new DataView(zip.buffer);
    let central = -1;
    for (let i = 0; i < zip.length - 4; i++)
      if (view.getUint32(i, true) === 0x02014b50) {
        central = i;
        break;
      }
    view.setUint16(central + 10, 8, true);
    expect(() => readZip(zip)).toThrow(/compressed/);
  });

  describe('end record and central directory checks', () => {
    const pair = () =>
      createZip([
        { name: 'backup.json', data: new TextEncoder().encode('{}') },
        { name: 'recordings/a.wav', data: new Uint8Array([1, 2, 3]) },
      ]);
    /** Every zip here has no comment, so the end record is the last 22 bytes. */
    const endOf = (zip: Uint8Array) => zip.length - 22;
    const viewOf = (zip: Uint8Array) => new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    it('test_readZip_totalEntriesLowered_rejectsCountDisagreement', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 10, 1, true);
      expect(() => readZip(zip)).toThrow(/entry counts/);
    });

    it('test_readZip_diskEntriesLowered_rejectsCountDisagreement', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 8, 1, true);
      expect(() => readZip(zip)).toThrow(/entry counts/);
    });

    it('test_readZip_bothEntryCountsLowered_rejectsUnusedCentralBytes', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 8, 1, true);
      viewOf(zip).setUint16(endOf(zip) + 10, 1, true);
      expect(() => readZip(zip)).toThrow(/more bytes than its entry count/);
    });

    it('test_readZip_bothEntryCountsRaised_rejectsBadCentralEntry', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 8, 3, true);
      viewOf(zip).setUint16(endOf(zip) + 10, 3, true);
      expect(() => readZip(zip)).toThrow(/bad central directory entry/);
    });

    it('test_readZip_diskNumberNonZero_rejectsMultiDisk', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 4, 1, true);
      expect(() => readZip(zip)).toThrow(/multi-disk/);
    });

    it('test_readZip_centralDirectoryDiskNonZero_rejectsMultiDisk', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 6, 1, true);
      expect(() => readZip(zip)).toThrow(/multi-disk/);
    });

    it('test_readZip_commentLengthPastFileEnd_rejectsCommentMismatch', () => {
      const zip = pair();
      viewOf(zip).setUint16(endOf(zip) + 20, 5, true);
      expect(() => readZip(zip)).toThrow(/comment/);
    });

    it('test_readZip_bytesAfterEndRecord_rejectsCommentMismatch', () => {
      const zip = pair();
      const trailing = new Uint8Array(zip.length + 5);
      trailing.set(zip);
      expect(() => readZip(trailing)).toThrow(/comment/);
    });

    it('test_readZip_commentMatchingFileEnd_readsEntries', () => {
      const zip = pair();
      const commented = new Uint8Array(zip.length + 5);
      commented.set(zip);
      viewOf(commented).setUint16(endOf(zip) + 20, 5, true);
      expect(readZip(commented).map((e) => e.name)).toEqual(['backup.json', 'recordings/a.wav']);
    });

    it('test_readZip_centralSizeShort_rejectsOutOfRange', () => {
      const zip = pair();
      const view = viewOf(zip);
      view.setUint32(endOf(zip) + 12, view.getUint32(endOf(zip) + 12, true) - 1, true);
      expect(() => readZip(zip)).toThrow(/central directory out of range/);
    });

    it('test_readZip_bytesBetweenCentralAndEndRecord_rejectsOutOfRange', () => {
      const zip = pair();
      const gapped = new Uint8Array(zip.length + 4);
      gapped.set(zip.subarray(0, endOf(zip)));
      gapped.set(zip.subarray(endOf(zip)), endOf(zip) + 4);
      expect(() => readZip(gapped)).toThrow(/central directory out of range/);
    });

    it('test_readZip_lastEntryLengthPastCentralDirectory_rejectsBadEntry', () => {
      const zip = pair();
      const view = viewOf(zip);
      const lastEntry = endOf(zip) - (46 + 'recordings/a.wav'.length);
      view.setUint16(lastEntry + 32, 1, true); // entry comment length
      expect(() => readZip(zip)).toThrow(/bad central directory entry/);
    });
  });

  describe('local header against central directory', () => {
    const one = () => createZip([{ name: 'a', data: new Uint8Array([1]) }]);
    const viewOf = (zip: Uint8Array) => new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const MISMATCH = /local header does not match/;

    it('test_readZip_localMethodDiffers_rejects', () => {
      const zip = one();
      viewOf(zip).setUint16(8, 8, true);
      expect(() => readZip(zip)).toThrow(MISMATCH);
    });

    it('test_readZip_localFlagsDiffer_rejects', () => {
      const zip = one();
      viewOf(zip).setUint16(6, 0, true);
      expect(() => readZip(zip)).toThrow(MISMATCH);
    });

    it('test_readZip_localNameDiffers_rejects', () => {
      const zip = one();
      zip[30] = 'b'.charCodeAt(0);
      expect(() => readZip(zip)).toThrow(MISMATCH);
    });

    it('test_readZip_localCrcDiffers_rejects', () => {
      const zip = one();
      viewOf(zip).setUint32(14, viewOf(zip).getUint32(14, true) ^ 1, true);
      expect(() => readZip(zip)).toThrow(MISMATCH);
    });

    it('test_readZip_localCompressedSizeDiffers_rejects', () => {
      const zip = one();
      viewOf(zip).setUint32(18, 2, true);
      expect(() => readZip(zip)).toThrow(MISMATCH);
    });

    it('test_readZip_localUncompressedSizeDiffers_rejects', () => {
      const zip = one();
      viewOf(zip).setUint32(22, 2, true);
      expect(() => readZip(zip)).toThrow(MISMATCH);
    });

    it('test_readZip_localNameLengthPastLocalArea_rejectsTruncated', () => {
      const zip = one();
      viewOf(zip).setUint16(26, 0xffff, true);
      expect(() => readZip(zip)).toThrow(/truncated/);
    });
  });

  it('test_looksLikeZip_signatures_detectsZipOnly', () => {
    expect(looksLikeZip(sample())).toBe(true);
    expect(looksLikeZip(createZip([]))).toBe(true);
    expect(looksLikeZip(new TextEncoder().encode('{}'))).toBe(false);
    expect(looksLikeZip(new Uint8Array([0x50, 0x4b]))).toBe(false);
  });
});
