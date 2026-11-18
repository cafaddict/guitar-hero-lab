/**
 * Dev-only (D-109): Mode C under speaker bleed (beta) when the app's backing reference is off. Same cases and
 * mixing as tools/bench/debug/modeC-bleed.ts; for every arrival error (the app's RTT error moves the mask
 * arrivals and the reference together) it scores the cases without a reference and with the reference at
 * gain ×0.5, ×1, ×2 (the mask keeps its own gain). Prints counts "absErr ≤ 1" per condition.
 * Usage: tsx tools/bench/debug/modeC-refErr.ts [--shifts -30,-10,0,10,30] [--gains 0.5,1,2] [--shard i/n]
 */
import { patternById } from '../../../src/content/patterns';
import { voicingById } from '../../../src/content/voicings';
import { deriveSeed } from '../../../src/domain/prng';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { backingTemplateRises } from '../../../src/dsp/backingMask';
import { type BackingReference, ChangeCounter, classifyPair } from '../../../src/dsp/modeC';
import { DEFAULT_ONSET_PARAMS, detectStrums } from '../../../src/dsp/onset';
import { rms } from '../../../src/dsp/spectrum';
import { renderBacking } from '../../../src/dsp/synth/backing';
import { backingReference, type ModeCBleedCase } from '../betaBench';
import { buildCases } from '../cases';
import { renderModeC } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const list = (name: string, fallback: number[]) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1]!.split(',').map(Number) : fallback;
};
const shiftsMs = list('shifts', [-30, -10, 0, 10, 30]);
const gainsX = list('gains', [0.5, 1, 2]);
const shardArg = process.argv.indexOf('--shard');
const [shard, shards] = shardArg > 0 ? process.argv[shardArg + 1]!.split('/').map(Number) : [0, 1];
const cases = buildCases(t, 'dev')
  .beta.filter((c): c is ModeCBleedCase => c.kind === 'modeCBleed')
  .filter((_c, i) => i % shards! === shard);

/** ok[shift][condition] where condition is 'none' or `x${gain}`. */
const ok = new Map<number, Map<string, number>>();
const bump = (shift: number, cond: string) => {
  const row = ok.get(shift) ?? new Map<string, number>();
  row.set(cond, (row.get(cond) ?? 0) + 1);
  ok.set(shift, row);
};
for (const c of cases) {
  const s = c.sequence;
  const fs = s.sampleRate;
  const base = renderModeC(s, t);
  const bpm = 80;
  const bars = Math.ceil(s.durationS / ((4 * 60) / bpm));
  const chordAt = (time: number) => {
    let chord: 0 | 1 = 0;
    for (const e of s.events) if (e.time <= time && e.chord !== 'open') chord = e.chord;
    return chord;
  };
  const backing = renderBacking({
    chords: [voicingById(s.pair[0])],
    chordAt: (time) => voicingById(s.pair[chordAt(time)]),
    pattern: patternById('P3'),
    bpm,
    bars,
    sampleRate: fs,
    model: s.model,
    seed: deriveSeed(s.seed, 'backing'),
  });
  const userRms = rms(base.signal, base.onsetSample, base.onsetSample + Math.round(0.5 * fs));
  const backingRms = rms(backing.signal, 0, Math.round(0.5 * fs));
  const gain = (userRms * 10 ** (c.relDb / 20)) / (backingRms + 1e-12);
  const offset = Math.round((c.rttMs / 1000) * fs);
  const signal = base.signal.slice();
  for (let i = 0; i < backing.signal.length && offset + i < signal.length; i++)
    signal[offset + i] = signal[offset + i]! + backing.signal[i]! * gain;
  const eventSamples = backing.events.map((e) => Math.round(e.time * fs));
  const templateRises = backingTemplateRises(backing.signal, eventSamples, fs);
  const pair = [voicingById(s.pair[0]), voicingById(s.pair[1])] as const;
  const counted = (events: { sample: number }[], ref: BackingReference | undefined) => {
    const counter = new ChangeCounter();
    for (const e of events) {
      const cls = classifyPair(
        {
          samples: signal,
          sampleRate: fs,
          onsetSample: e.sample,
          tuning: STANDARD_TUNING,
          deltaCents: s.deltaGivenCents,
          ...(ref ? { backing: ref } : {}),
        },
        pair,
      );
      counter.push(cls, (e.sample / fs) * 1000);
    }
    return Math.abs(counter.count - s.truthChanges) <= 1;
  };
  for (const shiftMs of shiftsMs) {
    // The app's RTT error: the mask arrivals and the reference's arrival move together.
    const believed = offset + Math.round((shiftMs / 1000) * fs);
    const schedule = { arrivals: eventSamples.map((e) => believed + e), templateRises, introCount: 0 };
    const events = detectStrums(signal, fs, DEFAULT_ONSET_PARAMS, { backing: schedule });
    if (counted(events, undefined)) bump(shiftMs, 'none');
    const ref = backingReference(signal, fs, backing.signal, believed, schedule);
    for (const x of gainsX) if (counted(events, { ...ref, gain: ref.gain * x })) bump(shiftMs, `x${x}`);
  }
}
console.log(
  JSON.stringify({
    n: cases.length,
    ok: Object.fromEntries([...ok].map(([k, v]) => [k, Object.fromEntries(v)])),
  }),
);
