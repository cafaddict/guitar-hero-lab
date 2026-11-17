/**
 * Dev-only: Mode C under speaker bleed (beta) — per case counted vs. truth, and per detected event the
 * truth chord, the classifier's answer and margin. Usage: tsx tools/bench/debug/modeC-bleed.ts [ids|all] [--events]
 */
import { patternById } from '../../../src/content/patterns';
import { voicingById } from '../../../src/content/voicings';
import { deriveSeed } from '../../../src/domain/prng';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { backingTemplateRises } from '../../../src/dsp/backingMask';
import { ChangeCounter, classifyPair, DEFAULT_MODE_C_PARAMS } from '../../../src/dsp/modeC';
import { DEFAULT_ONSET_PARAMS, detectStrums } from '../../../src/dsp/onset';
import { rms } from '../../../src/dsp/spectrum';
import { renderBacking } from '../../../src/dsp/synth/backing';
import { backingReference, type ModeCBleedCase } from '../betaBench';
import { buildCases } from '../cases';
import { renderModeC } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const sel = process.argv[2] ?? 'all';
const showEvents = process.argv.includes('--events');
const noSub = process.argv.includes('--nosub');
const num = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : undefined;
};
const params = {
  ...DEFAULT_MODE_C_PARAMS,
  ...(num('over') === undefined ? {} : { backingOverSubtract: num('over')! }),
  ...(num('floor') === undefined ? {} : { backingFloor: num('floor')! }),
};
const shardArg = process.argv.indexOf('--shard');
const [shard, shards] = shardArg > 0 ? process.argv[shardArg + 1]!.split('/').map(Number) : [0, 1];
const cases = buildCases(t, 'dev')
  .beta.filter(
    (c): c is ModeCBleedCase => c.kind === 'modeCBleed' && (sel === 'all' || sel.split(',').includes(c.id)),
  )
  .filter((_c, i) => i % shards! === shard);
let ok = 0;
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
  const schedule = {
    arrivals: eventSamples.map((e) => offset + e),
    templateRises: backingTemplateRises(backing.signal, eventSamples, fs),
    introCount: 0,
  };
  const events = detectStrums(signal, fs, DEFAULT_ONSET_PARAMS, { backing: schedule });
  const ref = noSub ? undefined : backingReference(signal, fs, backing.signal, offset, schedule);
  const counter = new ChangeCounter();
  const pair = [voicingById(s.pair[0]), voicingById(s.pair[1])] as const;
  const lines: string[] = [];
  const info: {
    t: number;
    winner: 0 | 1 | null;
    margin: number;
    d: boolean;
    counted: boolean;
    lastB: number;
  }[] = [];
  for (const e of events) {
    const cls = classifyPair(
      {
        samples: signal,
        sampleRate: fs,
        onsetSample: e.sample,
        tuning: STANDARD_TUNING,
        deltaCents: s.deltaGivenCents,
        params,
        ...(ref ? { backing: ref } : {}),
      },
      pair,
    );
    const counted = counter.push(cls, (e.sample / fs) * 1000);
    const tt = e.sample / fs;
    const near = s.events.find((x) => Math.abs(x.time - tt) < 0.06);
    const lastB = backing.events.filter((b) => b.time + offset / fs <= tt + 0.015).at(-1);
    info.push({
      t: tt,
      winner: cls.winner,
      margin: cls.margin,
      d: cls.distractorWins,
      counted,
      lastB: lastB ? tt - lastB.time - offset / fs : Number.NaN,
    });
    lines.push(
      `  t=${tt.toFixed(2)} truth=${near ? near.chord : 'none'} held=${chordAt(tt + 0.07)} win=${cls.winner} m=${cls.margin.toFixed(1)} d=${cls.distractorWins ? 'D' : ''} ${counted ? 'COUNT' : ''} lastB=${lastB ? (tt - lastB.time - offset / fs).toFixed(2) : '-'}`,
    );
  }
  const err = counter.count - s.truthChanges;
  if (Math.abs(err) <= 1) ok++;
  const truthTimes = s.events.map((e) => e.time);
  const missed = truthTimes.filter((x) => !events.some((e) => Math.abs(e.sample / fs - x) < 0.06)).length;
  console.log(
    `${c.id} ${s.pair.join('|')} rel=${c.relDb.toFixed(1)} snr=${s.snrDb} ${s.model} hp=${s.micHighpassHz} cpm=${s.changesPerMin} counted=${counter.count} truth=${s.truthChanges} err=${err} det=${events.length}/${s.events.length} missed=${missed} gainEst=${ref ? ref.gain.toFixed(3) : '-'} gainTrue=${gain.toFixed(3)}`,
  );
  let prevChord: 0 | 1 = 0;
  for (const e of s.events) {
    if (e.chord === 'open') continue;
    if (e.chord !== prevChord) {
      const d = info.find((x) => Math.abs(x.t - e.time) < 0.06);
      if (!d) console.log(`  MISSCHG t=${e.time.toFixed(2)} undetected`);
      else if (!d.counted)
        console.log(
          `  MISSCHG t=${e.time.toFixed(2)} win=${d.winner} want=${e.chord} m=${d.margin.toFixed(1)} ${d.d ? 'distractor' : ''} lastB=${d.lastB.toFixed(2)}`,
        );
    }
    prevChord = e.chord;
  }
  if (showEvents) for (const l of lines) if (showEvents || !l.includes('truth=none')) console.log(l);
}
console.log(`absErr<=1: ${ok}/${cases.length} = ${(ok / cases.length).toFixed(4)}`);
