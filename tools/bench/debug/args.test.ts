import { describe, expect, it } from 'vitest';
import { countArg } from './args';

describe('countArg', () => {
  it('returns the fallback when --n is absent (not the node path in argv[0])', () => {
    expect(countArg(['/usr/bin/node', 'modeA-takes.ts'], 120)).toBe(120);
  });

  it('returns the fallback when --n has no positive integer after it', () => {
    expect(countArg(['node', 'x.ts', '--n'], 120)).toBe(120);
    expect(countArg(['node', 'x.ts', '--n', 'abc'], 120)).toBe(120);
    expect(countArg(['node', 'x.ts', '--n', '0'], 120)).toBe(120);
    expect(countArg(['node', 'x.ts', '--n', '2.5'], 120)).toBe(120);
  });

  it('returns the given count', () => {
    expect(countArg(['node', 'x.ts', '--n', '30'], 120)).toBe(30);
  });
});
