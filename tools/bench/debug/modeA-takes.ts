/**
 * Dev-only (D-073, D-074): E1 string-by-string takes through the benchmark channel (room, mic high-pass, noise
 * at the dev cases' SNR). Body knocks and earlier chord strings still ringing, judged plain and with the
 * ringing strings passed, per sensitivity. Usage: tsx tools/bench/debug/modeA-takes.ts [--n 120]
 */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { type PluckResult, verifyPluck } from '../../../src/dsp/modeA';
import { type ChordPluckTarget, renderChordPluck } from '../../../src/dsp/synth/chordPluck';
import type { Sensitivity } from '../../../src/dsp/types';
import { buildCases } from '../cases';
import { channel } from '../render';
import { loadThresholds } from '../thresholds';
import { countArg } from './args';

const n = countArg(process.argv, 120);
const t = loadThresholds();
const base = buildCases(t, 'dev').modeA.filter((c) => c.condition === 'ok');
const targets: ChordPluckTarget[] = ['clean', 'wrong-up', 'wrong-down', 'muted', 'replucked', 'knock'];
const label = (r: PluckResult) => (r.verdict === 'RETRY' ? `RETRY:${r.reasons[0]}` : r.status);

for (const ringingGainDb of [-6, 0, 6]) {
  for (const sensitivity of ['low', 'normal', 'high'] as Sensitivity[]) {
    const tally = new Map<string, Map<string, number>>();
    const bump = (key: string, value: string) => {
      const row = tally.get(key) ?? new Map<string, number>();
      row.set(value, (row.get(value) ?? 0) + 1);
      tally.set(key, row);
    };
    for (const [i, c] of base.slice(0, n).entries()) {
      const v = voicingById(c.voicingId);
      const midi = v.frets.map((f, idx) => (f === 'x' ? null : STANDARD_TUNING.openMidi[idx]! + f));
      const played = midi.flatMap((m, idx) => (m === null ? [] : [idx]));
      const targetIdx = played[1 + (i % Math.max(1, played.length - 1))] ?? played[played.length - 1]!;
      const target = targets[i % targets.length]!;
      const take = renderChordPluck({
        sampleRate: c.sampleRate,
        midi,
        targetIdx,
        target,
        intervalS: [0.5, 0.7, 1][i % 3]!,
        ringingGainDb,
        model: c.model,
        seed: c.seed,
        knockGainDb: [-6, 0, 6][i % 3]!,
      });
      const signal = channel(c, t, take.signal, take.targetOnset).signal;
      const input = {
        samples: signal,
        sampleRate: c.sampleRate,
        onsetSample: take.targetOnset,
        expectedF0: take.expectedF0,
        sensitivity,
      };
      const ringing = take.ringing.map((r) => ({
        f0: r.f0,
        ageS: (take.targetOnset - r.onset) / c.sampleRate,
      }));
      bump(`${target} plain`, label(verifyPluck(input)));
      bump(`${target} ringing`, label(verifyPluck({ ...input, ringing })));
    }
    console.log(`\n== ringing ${ringingGainDb} dB, sensitivity ${sensitivity}`);
    for (const [key, row] of [...tally].sort()) {
      const total = [...row.values()].reduce((a, b) => a + b, 0);
      const cells = [...row].sort((a, b) => b[1] - a[1]).map(([k, x]) => `${k} ${x}`);
      console.log(`  ${key.padEnd(20)} n=${String(total).padEnd(4)} ${cells.join(' · ')}`);
    }
  }
}
