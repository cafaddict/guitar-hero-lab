/**
 * Dev-only (D-106): Mode B on sounds the strum benchmark has no case for, through the benchmark channel with
 * voicings and seeds fixed by the dev cases. Prints PASS / FAIL / RETRY by reason per group, so that a commit can
 * be compared with another one. Usage: tsx tools/bench/debug/modeB-knock.ts [--n 600]
 *   knock                 body knock alone in a quiet take
 *   all-muted             every string of the chord muted
 *   restrum 0 / -6 dB     the same chord strummed again 0.5 s after a strum, at the same level / 6 dB softer
 *   knock over strum      a knock 0.5 s after a strum of the same chord, the chord still ringing
 */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { verifyStrum } from '../../../src/dsp/modeB';
import { detectStrums } from '../../../src/dsp/onset';
import { renderKnock } from '../../../src/dsp/synth/knock';
import { renderStrum } from '../../../src/dsp/synth/strum';
import { selectTakeEvent } from '../../../src/dsp/take';
import { buildCases, type ModeBCase } from '../cases';
import { channel, strumStrings } from '../render';
import { loadThresholds } from '../thresholds';

const n = Number(process.argv[process.argv.indexOf('--n') + 1] || 600);
const t = loadThresholds();
const all = buildCases(t, 'dev').modeB;
const cases = all.filter((_, i) => i % Math.max(1, Math.floor(all.length / n)) === 0).slice(0, n);

const PRE_S = 0.7;
const GAP_S = 0.5;

function strum(c: ModeBCase, label: string, muted = false): Float32Array {
  const strings = strumStrings(c, t, voicingById(c.voicingId), 1, label, {}).map((s) => ({
    ...s,
    note: { ...s.note, muted },
  }));
  return renderStrum({
    strings,
    direction: c.direction,
    spreadMs: c.spreadMs,
    sampleRate: c.sampleRate,
  }).signal;
}

function mix(length: number, parts: readonly { x: Float32Array; at: number; gain?: number }[]): Float32Array {
  const dry = new Float32Array(length);
  for (const { x, at, gain = 1 } of parts)
    for (let i = 0; i < x.length && at + i < length; i++) dry[at + i] = dry[at + i]! + gain * x[i]!;
  return dry;
}

interface Scene {
  dry: Float32Array;
  onset: number;
}

const scenes: Record<string, (c: ModeBCase) => Scene> = {
  knock: (c) => {
    const onset = Math.round(PRE_S * c.sampleRate);
    const x = renderKnock({ sampleRate: c.sampleRate, durationS: 1, seed: c.seed });
    return { dry: mix(onset + 2 * c.sampleRate, [{ x, at: onset }]), onset };
  },
  'all-muted': (c) => {
    const onset = Math.round(PRE_S * c.sampleRate);
    return { dry: mix(onset + 2 * c.sampleRate, [{ x: strum(c, 'B', true), at: onset }]), onset };
  },
  'restrum 0 dB': (c) => restrum(c, 1),
  'restrum -6 dB': (c) => restrum(c, 0.5),
  'knock over strum': (c) => {
    const first = Math.round(PRE_S * c.sampleRate);
    const onset = first + Math.round(GAP_S * c.sampleRate);
    const x = renderKnock({ sampleRate: c.sampleRate, durationS: 1, seed: c.seed });
    const dry = mix(onset + 2 * c.sampleRate, [
      { x: strum(c, 'B'), at: first },
      { x, at: onset },
    ]);
    return { dry, onset };
  },
};

function restrum(c: ModeBCase, gain: number): Scene {
  const first = Math.round(PRE_S * c.sampleRate);
  const onset = first + Math.round(GAP_S * c.sampleRate);
  const dry = mix(onset + 2 * c.sampleRate, [
    { x: strum(c, 'B'), at: first },
    { x: strum(c, 'B2'), at: onset, gain },
  ]);
  return { dry, onset };
}

for (const [name, scene] of Object.entries(scenes)) {
  const tally = new Map<string, number>();
  let noOnset = 0;
  for (const c of cases) {
    const { dry, onset } = scene(c);
    const signal = channel(c, t, dry, onset).signal;
    const fs = c.sampleRate;
    // The event nearest the scene's onset (a first strum may also be detected); the true onset when none is near.
    const events = detectStrums(signal, fs).filter((e) => e.sample >= onset - 0.03 * fs);
    const take = selectTakeEvent(events, fs);
    if (!take.ok) noOnset++;
    const at = take.ok ? take.event.sample : onset;
    const start = Math.max(0, at - Math.round(0.5 * fs));
    const samples = signal.slice(start, Math.min(signal.length, at + Math.round(0.4 * fs)));
    const res = verifyStrum({
      samples,
      sampleRate: fs,
      onsetSample: at - start,
      voicing: voicingById(c.voicingId),
      tuning: STANDARD_TUNING,
      deltaCents: c.deltaGivenCents,
    });
    const key = res.verdict === 'RETRY' ? `RETRY:${res.reasons[0]}` : res.verdict;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  const cells = [...tally].sort((a, b) => a[0].localeCompare(b[0])).map(([k, x]) => `${k} ${x}`);
  console.log(`${name.padEnd(18)} n=${cases.length} no-onset=${noOnset} · ${cells.join(' · ')}`);
}
