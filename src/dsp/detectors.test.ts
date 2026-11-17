import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { midiToHz, STANDARD_TUNING } from '../domain/theory';
import { CaptureCore } from './capture';
import { hannKernel, leakageAt } from './leakage';
import { verifyPluck, verifySilentString } from './modeA';
import { verifyStrum } from './modeB';
import { ChangeCounter, classifyPair, classifySet } from './modeC';
import { DEFAULT_ONSET_PARAMS, detectStrums } from './onset';
import { estimateRtt, rttProbe, tapRtt, tapRttStats } from './rtt';
import { applyMuteEnvelope, type NoteSpec, renderNote } from './synth/note';
import { normalizeNote, renderStrum } from './synth/strum';
import { analyzeTiming, ioiCv, personalOffset, pooledIoiCv, timingWindowMs } from './timing';
import { analyzeTuning, TunerStability } from './tuner';
import { DETECTOR_VERSION } from './version';

const FS = 48000;

function note(f0: number, overrides: Partial<NoteSpec> = {}): NoteSpec {
  return {
    model: 'karplus-strong',
    f0,
    sampleRate: FS,
    durationS: 1,
    inharmonicityB: 5e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    brightness: 0.7,
    pickPosition: 0.15,
    t60S: 4,
    seed: 3,
    ...overrides,
  };
}

/** Deterministic low-level noise so detectors see a realistic floor. */
function withNoise(signal: Float32Array, level = 1e-4): Float32Array {
  let x = 12345;
  const out = signal.slice();
  for (let i = 0; i < out.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i] = out[i]! + level * ((x / 0x7fffffff) * 2 - 1);
  }
  return out;
}

function pluck(f0: number, muted = false): { samples: Float32Array; onset: number } {
  const n = renderNote(note(f0, { muted }));
  normalizeNote(n, FS);
  applyMuteEnvelope(n, note(f0, { muted }));
  const onset = Math.round(0.6 * FS);
  const samples = new Float32Array(onset + n.length);
  samples.set(n, onset);
  return { samples: withNoise(samples), onset };
}

function strum(
  voicingId: string,
  opts: { mutedIdx?: number; ringIdx?: number } = {},
): { samples: Float32Array; onset: number } {
  const v = voicingById(voicingId);
  const strings = v.frets.flatMap((f, idx) => {
    const fret = opts.ringIdx === idx ? 0 : f;
    if (fret === 'x') return [];
    return [
      {
        idx,
        note: note(midiToHz(STANDARD_TUNING.openMidi[idx]! + fret), {
          seed: 10 + idx,
          muted: opts.mutedIdx === idx,
        }),
        gainDb: 0,
      },
    ];
  });
  const s = renderStrum({ strings, direction: 'down', spreadMs: 15, sampleRate: FS });
  let peak = 0;
  for (const x of s.signal) peak = Math.max(peak, Math.abs(x));
  const onset = Math.round(0.6 * FS);
  const samples = new Float32Array(onset + s.signal.length);
  samples.set(
    s.signal.map((x) => (x * 0.5) / peak),
    onset,
  );
  return { samples: withNoise(samples), onset };
}

describe('Mode A verifyPluck', () => {
  const f0 = midiToHz(52); // 4th string, 2nd fret (E3)
  it('accepts the expected note and reports the detector version', () => {
    const { samples, onset } = pluck(f0);
    const r = verifyPluck({ samples, sampleRate: FS, onsetSample: onset, expectedF0: f0 });
    expect(r.status).toBe('OK');
    expect(r.verdict).toBe('PASS');
    expect(Math.abs(r.cents!)).toBeLessThan(5);
    expect(r.detectorVersion).toBe(DETECTOR_VERSION);
    expect(r.processingMs).toBeGreaterThan(0);
  });

  it('names a wrong fret with its semitone difference', () => {
    const { samples, onset } = pluck(f0 * 2 ** (1 / 12));
    const r = verifyPluck({ samples, sampleRate: FS, onsetSample: onset, expectedF0: f0 });
    expect(r.status).toBe('WRONG_NOTE');
    expect(r.semitones).toBe(1);
    expect(r.verdict).toBe('FAIL');
  });

  it('detects a muted string from its decay', () => {
    const { samples, onset } = pluck(f0, true);
    const r = verifyPluck({ samples, sampleRate: FS, onsetSample: onset, expectedF0: f0 });
    expect(r.status).toBe('MUTED');
  });

  it('asks to retry on silence and on clipping instead of failing', () => {
    const silent = withNoise(new Float32Array(FS * 2));
    expect(verifyPluck({ samples: silent, sampleRate: FS, onsetSample: FS, expectedF0: f0 }).verdict).toBe(
      'RETRY',
    );
    const { samples, onset } = pluck(f0);
    const loud = samples.map((x) => Math.max(-1, Math.min(1, x * 20)));
    const r = verifyPluck({ samples: loud, sampleRate: FS, onsetSample: onset, expectedF0: f0 });
    expect(r.verdict).toBe('RETRY');
    expect(r.reasons).toContain('CLIPPING');
  });

  it('x-string check passes silence and flags a ringing string', () => {
    const silent = withNoise(new Float32Array(FS * 2));
    expect(
      verifySilentString({ samples: silent, sampleRate: FS, onsetSample: FS, expectedF0: midiToHz(40) })
        .status,
    ).toBe('OK');
    const { samples, onset } = pluck(midiToHz(40));
    expect(
      verifySilentString({ samples, sampleRate: FS, onsetSample: onset, expectedF0: midiToHz(40) }).status,
    ).toBe('UNEXPECTED');
  });
});

describe('Mode B verifyStrum', () => {
  it('passes a clean C and marks dependent strings as unverifiable', () => {
    const { samples, onset } = strum('C');
    const r = verifyStrum({
      samples,
      sampleRate: FS,
      onsetSample: onset,
      voicing: voicingById('C'),
      tuning: STANDARD_TUNING,
    });
    expect(r.verdict).toBe('PASS');
    expect(r.strings.find((s) => s.idx === 4)?.status).toBe('UNVERIFIABLE');
  });

  it('names a muted verifiable string', () => {
    const { samples, onset } = strum('C', { mutedIdx: 1 });
    const r = verifyStrum({
      samples,
      sampleRate: FS,
      onsetSample: onset,
      voicing: voicingById('C'),
      tuning: STANDARD_TUNING,
    });
    expect(r.verdict).toBe('FAIL');
    expect(r.blamed).toEqual([1]);
  });

  it('flags the 6th string ringing in a C chord as UNEXPECTED', () => {
    const { samples, onset } = strum('C', { ringIdx: 0 });
    const r = verifyStrum({
      samples,
      sampleRate: FS,
      onsetSample: onset,
      voicing: voicingById('C'),
      tuning: STANDARD_TUNING,
    });
    expect(r.verdict).toBe('FAIL');
    expect(r.unexpected.map((u) => u.idx)).toContain(0);
  });
});

describe('Mode C', () => {
  it('classifies a pair and a closed set', () => {
    const { samples, onset } = strum('Am');
    const pair = classifyPair({ samples, sampleRate: FS, onsetSample: onset, tuning: STANDARD_TUNING }, [
      voicingById('C'),
      voicingById('Am'),
    ]);
    expect(pair.winner).toBe(1);
    const candidates = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G-2f', 'G-3f'].map(voicingById);
    const set = classifySet(
      { samples, sampleRate: FS, onsetSample: onset, tuning: STANDARD_TUNING },
      candidates,
      (v) => (v.id.startsWith('G-') ? 'G' : v.id),
    );
    expect(candidates[set.top]!.id).toBe('Am');
    expect(set.margin).toBeGreaterThan(0);
  });

  it('classifyPair_backingChordLeakingOverUserChord_subtractsBackingAndPicksUserChord', () => {
    // Arrange: the user strums Am; the speaker backing plays C 20 ms later, 14 dB louder (gain 5).
    const user = strum('Am');
    const backing = strum('C').samples.subarray(Math.round(0.6 * FS));
    const offset = user.onset + Math.round(0.02 * FS);
    const mixed = user.samples.slice();
    for (let i = 0; i < backing.length && offset + i < mixed.length; i++)
      mixed[offset + i] = mixed[offset + i]! + 5 * backing[i]!;
    const input = { samples: mixed, sampleRate: FS, onsetSample: user.onset, tuning: STANDARD_TUNING };
    const pair = [voicingById('C'), voicingById('Am')] as const;
    // Act
    const without = classifyPair(input, pair);
    const withRef = classifyPair({ ...input, backing: { samples: backing, offset, gain: 5 } }, pair);
    // Assert
    expect(without.winner).not.toBe(1);
    expect(withRef.winner).toBe(1);
  });

  it('classifyPair_backingGainZero_matchesNoBacking', () => {
    // Arrange
    const { samples, onset } = strum('Am');
    const input = { samples, sampleRate: FS, onsetSample: onset, tuning: STANDARD_TUNING };
    const pair = [voicingById('C'), voicingById('Am')] as const;
    // Act
    const plain = classifyPair(input, pair);
    const zero = classifyPair({ ...input, backing: { samples, offset: 0, gain: 0 } }, pair);
    // Assert
    expect(zero.winner).toBe(plain.winner);
    expect(zero.margin).toBe(plain.margin);
  });

  it('counter counts only confident changes ≥ 300 ms apart and ignores holds', () => {
    const counter = new ChangeCounter(300);
    expect(counter.push({ winner: 0 }, 0)).toBe(false); // starting chord
    expect(counter.push({ winner: 1 }, 1000)).toBe(true);
    expect(counter.push({ winner: 1 }, 1500)).toBe(false); // same chord again
    expect(counter.push({ winner: null }, 1800)).toBe(false); // hold
    expect(counter.push({ winner: 0 }, 2000)).toBe(true);
    expect(counter.push({ winner: 1 }, 2100)).toBe(false); // too soon
    expect(counter.count).toBe(2);
    expect(counter.held).toBe(1);
    expect(counter.changeTimesMs).toEqual([1000, 2000]);
  });
});

describe('onset detection and timing (Mode D)', () => {
  it('finds each strum once, close to the first string onset', () => {
    const fs = FS;
    const times = [0.5, 1.25, 1.75, 2.5];
    const total = new Float32Array(Math.round(3.5 * fs));
    for (const t of times) {
      const { samples, onset } = strum('G-3f');
      const at = Math.round(t * fs);
      for (let i = onset; i < samples.length && at + i - onset < total.length; i++)
        total[at + i - onset] = total[at + i - onset]! + samples[i]!;
    }
    const events = detectStrums(withNoise(total), fs, DEFAULT_ONSET_PARAMS);
    expect(events.length).toBe(times.length);
    for (const [k, e] of events.entries())
      expect(Math.abs(e.sample / fs - times[k]!) * 1000).toBeLessThan(10);
  });

  it('judges hits, misses and extras with BPM windows', () => {
    expect([timingWindowMs(70), timingWindowMs(90), timingWindowMs(120)]).toEqual([80, 50, 40]);
    const slots = [0, 0.5, 1, 1.5].map((time, i) => ({ time, expected: i !== 2 }));
    const rtt = 0.1;
    const res = analyzeTiming(slots, [0.11, 0.68, 1.1], rtt, 90);
    expect(res.judgements).toEqual(['hit', 'miss', 'extra', 'miss']);
    expect(res.offsetsMs[0]).toBeCloseTo(10, 6);
    expect(res.hitRate).toBeCloseTo(1 / 3, 6);
    const lead = analyzeTiming(slots, [0.045, 0.545, 1.545], rtt, 120, -55);
    expect(lead.hitRate).toBe(0);
    expect(lead.hitRateCorrected).toBe(1);
    expect(personalOffset([-50, -55])).toBeNull();
    expect(personalOffset([-50, -55, -60])).toBeCloseTo(-55, 6);
    expect(ioiCv([0, 0.25, 0.5, 0.75])).toBeCloseTo(0, 6);
  });

  it('pooledIoiCv: intervals inside each segment only (the pause gap is not one, D-085)', () => {
    const even = pooledIoiCv([
      [0, 0.25, 0.5],
      [9, 9.25, 9.5, 9.75],
    ]);
    expect(even).toBeCloseTo(0, 6);
    expect(ioiCv([0, 0.25, 0.5, 9, 9.25])).toBeGreaterThan(1);
    const uneven = [0, 0.25, 0.55, 0.75];
    expect(pooledIoiCv([uneven])).toBe(ioiCv(uneven));
    expect(pooledIoiCv([[0, 0.25], [5]])).toBeNull();
    expect(
      pooledIoiCv([
        [0, 0.25],
        [5, 5.25],
      ]),
    ).toBeCloseTo(0, 6);
    expect(ioiCv([0, 0.25])).toBeNull();
  });
});

describe('tuner', () => {
  it('reads a detuned note within a cent and becomes stable within 300 ms', () => {
    const f0 = midiToHz(45) * 2 ** (17 / 1200);
    const { samples, onset } = pluck(f0);
    const res = analyzeTuning(samples, FS, onset, { kind: 'chromatic' });
    expect(res.stableF0).not.toBeNull();
    expect(Math.abs(1200 * Math.log2(res.stableF0! / f0))).toBeLessThan(1);
    expect(res.timeToStableMs!).toBeLessThan(300);
  });

  it('stability needs 5 frames within ±3 cents', () => {
    const s = new TunerStability();
    const r = (f0: number) => ({ f0, midi: 45, cents: 0, clarity: 1 });
    for (let i = 0; i < 4; i++) expect(s.push(r(110))).toBeNull();
    expect(s.push(r(110.1))).toBeCloseTo(110, 0);
    expect(s.push(r(112))).toBeNull();
    expect(s.push(null)).toBeNull();
  });
});

describe('RTT', () => {
  it('measures loopback latency and reports failure without a signal', () => {
    const probe = rttProbe(FS);
    const scheduled = [0, 0.41, 0.73, 1.19, 1.47, 1.96, 2.27, 2.81].map((o) => 0.5 + o);
    const rec = new Float32Array(Math.round(4 * FS));
    for (const s of scheduled) {
      const at = Math.round((s + 0.137) * FS);
      rec.set(probe, at);
    }
    const ok = estimateRtt(withNoise(rec, 1e-3), FS, 0, scheduled);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.rttMs).toBeCloseTo(137, 0);
    const none = estimateRtt(withNoise(new Float32Array(rec.length), 1e-3), FS, 0, scheduled);
    expect(none.ok).toBe(false);
  });

  it('tap calibration takes the median offset', () => {
    expect(tapRtt([0, 1, 2, 3, 4], [0.1, 1.12, 2.09, 3.1, 4.11])).toBeCloseTo(100, 6);
    expect(tapRtt([0, 1], [0.1])).toBeNull();
    const stats = tapRttStats([0, 1, 2, 3, 4], [0.1, 1.12, 2.09, 3.1, 4.11]);
    expect(stats?.matched).toBe(5);
    expect(stats?.madMs).toBeCloseTo(10, 6);
  });
});

describe('leakage model and capture core', () => {
  it('Hann kernel: 1 at 0, null at 2 bins, −31.5 dB side-lobe', () => {
    expect(hannKernel(0)).toBe(1);
    expect(hannKernel(2)).toBeCloseTo(0, 6);
    expect(20 * Math.log10(hannKernel(2.4))).toBeCloseTo(-31.5, 0);
    expect(leakageAt(100, [{ hz: 100, mag: 1 }], 5)).toBe(0);
  });

  it('capture core reports levels at ~30 Hz and onsets, with a 4 s ring buffer', () => {
    const levels: number[] = [];
    const onsets: number[] = [];
    const core = new CaptureCore(FS, {
      onLevel: (l) => levels.push(l.rms),
      onOnset: (c) => onsets.push(c.sample),
    });
    const { samples } = strum('A');
    const block = new Float32Array(128);
    for (let i = 0; i + 128 <= samples.length; i += 128) {
      block.set(samples.subarray(i, i + 128));
      core.processBlock(block);
    }
    expect(levels.length).toBeGreaterThan(30);
    expect(onsets.length).toBe(1);
    expect(Math.abs(onsets[0]! - 0.6 * FS) / FS).toBeLessThan(0.05);
    const out = new Float32Array(1000);
    expect(core.copyRange(core.samplesProcessed - 1000, core.samplesProcessed, out)).toBe(1000);
    expect(out[999]).toBe(samples[Math.floor(samples.length / 128) * 128 - 1]);
    expect(core.ring.length).toBe(4 * FS);
  });
});
