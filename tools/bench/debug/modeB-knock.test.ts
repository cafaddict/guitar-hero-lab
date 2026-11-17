import { describe, expect, it } from 'vitest';
import { parseN } from './modeB-knock';

describe('parseN', () => {
  it('returns 600 when --n is absent', () => {
    expect(parseN(['/usr/bin/node', 'modeB-knock.ts'])).toBe(600);
  });

  it('returns 600 when the value after --n is not a number', () => {
    expect(parseN(['node', 'modeB-knock.ts', '--n', 'abc'])).toBe(600);
  });

  it('returns 600 when --n is the last argument', () => {
    expect(parseN(['node', 'modeB-knock.ts', '--n'])).toBe(600);
  });

  it('returns the given count for --n 50', () => {
    expect(parseN(['node', 'modeB-knock.ts', '--n', '50'])).toBe(50);
  });
});
