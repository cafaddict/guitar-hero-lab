/** Command-line helpers shared by the dev-only debug scripts in this folder. */

/**
 * The count given as `--n <count>`; `fallback` when `--n` is absent or not followed by a positive integer.
 * (`argv[argv.indexOf('--n') + 1]` alone reads argv[0], the node path, when `--n` is absent.)
 */
export function countArg(argv: readonly string[], fallback: number): number {
  const i = argv.indexOf('--n');
  if (i < 0) return fallback;
  const v = Number(argv[i + 1]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}
