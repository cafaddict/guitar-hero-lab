/**
 * E10 "반주와 함께" on speakers when the bleed-gain measurement fails (D-102): the real adapter and the real DSP
 * judge a synthesized recording, so a recovery path is checked on what it does to the notes, not on its requests.
 */
import { describe, expect, it } from 'vitest';
import type { AudioEngine } from '../../audio/engine';
import type { RangeRequest } from '../../audio/worker/protocol';
import { patternById } from '../../content/patterns';
import { positionMidi, scaleById, scaleStepSequence } from '../../content/scales';
import { voicingById } from '../../content/voicings';
import { bleedGain, DEFAULT_BACKING_MASK_PARAMS, lowBand } from '../../dsp/backingMask';
import { type SequenceSlot, verifySequence } from '../../dsp/sequence';
import { renderBacking } from '../../dsp/synth/backing';
import { randomTimbre } from '../../dsp/synth/note';
import { renderSequence, type SequenceNote } from '../../dsp/synth/sequence';
import { createExerciseMic } from '../audioAdapter';
import { testContext } from '../testing/fakes';
import { e10ParamsSchema, ScaleRunner } from './runner';

const FS = 48000;
const BPM = 80;
const BEAT = 60 / BPM;
const RING_S = 3.9;
/** Leak level below the user's first note (§14.8 scale: first 500 ms RMS), as in E2E-16b. */
const BLEED_DB = -12;
/** Slots left unplayed: B2 and E3, tones of the backing's Em chord. */
const CHORD_TONES = [3, 5];

const PLAN = scaleStepSequence(scaleById('em-pent-open'), 1, 0).map(
  (i) => scaleById('em-pent-open').notes[i]!,
);

function rms(x: ArrayLike<number>, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / (to - from));
}

const BACKING = renderBacking({
  chords: [voicingById('Em')],
  pattern: patternById('P0'),
  bpm: BPM,
  bars: 5,
  sampleRate: FS,
  model: 'karplus-strong',
  seed: 11,
});

/** Audio-clock recording: the backing from one bar before the grid, the user's notes on the beats from the grid. */
function record(grid: number, seconds: number, skipped: readonly number[]): Float32Array {
  const length = Math.round((grid + seconds) * FS);
  const notes: SequenceNote[] = PLAN.flatMap((p, k) => {
    const time = grid + k * BEAT;
    if (time >= grid + seconds) return [];
    const seed = 20 + k;
    return [
      {
        time,
        string: p.string,
        gainDb: 0,
        note: {
          model: 'karplus-strong' as const,
          f0: 440 * 2 ** ((positionMidi(p) - 69) / 12),
          sampleRate: FS,
          durationS: 2,
          inharmonicityB: 5e-5,
          muted: false,
          mutedDecayDb: -30,
          mutedDecayMs: 120,
          fundamentalDb: 0,
          ...randomTimbre(seed),
          t60S: 4,
          seed,
        },
      },
    ];
  });
  const user = renderSequence(
    notes.filter((_, k) => !skipped.includes(k)),
    FS,
    length,
  ).signal;
  const reference = renderSequence([notes[0]!], FS, length).signal;
  const first = Math.round(grid * FS);
  const g = (rms(reference, first, first + FS / 2) * 10 ** (BLEED_DB / 20)) / rms(BACKING.signal, 0, FS / 2);
  const signal = Float32Array.from(user);
  const start = Math.round((grid - 4 * BEAT) * FS);
  for (let i = 0; i < BACKING.signal.length && start + i < length; i++)
    signal[start + i] = signal[start + i]! + BACKING.signal[i]! * g;
  let seed = 5;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    signal[i] = signal[i]! + ((seed / 2 ** 32) * 2 - 1) * 1e-4;
  }
  return signal;
}

/**
 * A run on speakers judged for real: measure-gain requests answer `measureFails` rejections first, then the
 * worker's own computation on the recording. Returns each slot's status by its position in the plan.
 */
async function run(options: {
  seconds: number;
  skipped: readonly number[];
  measureFails?: number;
  /** The gain's answer holds back until this long after the grid (a stalled worker). */
  answerAfterGridS?: number;
}) {
  const t = testContext();
  const runner = new ScaleRunner(
    t.ctx,
    e10ParamsSchema.parse({ scaleId: 'em-pent-open', bpm: BPM, withBacking: true }),
    () => BACKING,
  );
  const grid = () => t.output.metronome.gridStartTime()!;
  let recording: Float32Array | null = null;
  let measureFails = options.measureFails ?? 0;
  let measures = 0;
  let evicted = 0;
  const analyzeRange = async (from: number, to: number, request: RangeRequest) => {
    recording ??= record(grid(), options.seconds, options.skipped);
    if (t.clock.audio() - from > RING_S) evicted++;
    const samples = recording.subarray(Math.round(from * FS), Math.round(to * FS));
    if (request.kind === 'bleedGain') {
      measures++;
      if (measureFails-- > 0) throw new Error('range capture timed out');
      while (t.clock.audio() < grid() + (options.answerAfterGridS ?? Number.NEGATIVE_INFINITY))
        await new Promise((resolve) => setImmediate(resolve));
      const fromSample = Math.round(from * FS);
      const gain = bleedGain(
        lowBand(samples, FS, DEFAULT_BACKING_MASK_PARAMS),
        FS,
        {
          arrivals: request.arrivals.map((a) => a - fromSample),
          templateRises: request.templateRises,
          introCount: request.arrivals.length,
        },
        DEFAULT_BACKING_MASK_PARAMS,
      );
      return { result: { gain }, detectorVersion: 'test', processingMs: 1 };
    }
    if (request.kind !== 'sequence') throw new Error(`unexpected range: ${request.kind}`);
    const result = verifySequence({
      samples,
      sampleRate: FS,
      bpm: request.bpm,
      // zod's optional fields carry `| undefined`, as in the worker; these slots always have them or leave them out.
      slots: request.slots as SequenceSlot[],
      extraSpanS: request.extraSpanS!,
      priorNotes: request.priorNotes.map((n) => ({
        f0: n.f0,
        stringIdx: n.stringIdx,
        startSample: Math.round(n.time * FS),
      })),
      ...(request.backing
        ? {
            backing: {
              arrivals: request.backing.arrivalsS.map((a) => Math.round(a * FS)),
              templateRises: request.backing.templateRises,
              introCount: 0,
              gain: request.backing.gain,
            },
          }
        : {}),
    });
    return { result, detectorVersion: 'test', processingMs: 1 };
  };
  const real = createExerciseMic({
    sampleRate: FS,
    timeToSample: (s: number) => Math.round(s * FS),
    analyzeRange,
  } as unknown as AudioEngine);
  t.mic.measureBleedGain = real.measureBleedGain;
  const statuses = new Map<number, string>();
  t.mic.analyzeSequence = async (request) => {
    const outcome = await real.analyzeSequence(request);
    outcome.notes.forEach((n, i) => {
      statuses.set(Math.round((request.slots[i]!.time - grid()) / BEAT), n.status);
    });
    return outcome;
  };
  runner.start();
  runner.command('toggle');
  for (let s = 0; s < 4 * BEAT + options.seconds; s += 0.025) {
    t.output.run(t.clock, 0.025);
    runner.tick();
    await new Promise((resolve) => setImmediate(resolve));
  }
  runner.command('abort');
  return { statuses, measures, evicted };
}

describe('D-102 failed bleed-gain measurement, judged by the real DSP', () => {
  it('test_speakerBacking_measurementFailsOnce_playedNotesStayOk', async () => {
    const { statuses, measures, evicted } = await run({ seconds: 9, skipped: [], measureFails: 1 });
    expect(measures).toBe(2);
    expect(evicted).toBe(0);
    expect(statuses.size).toBeGreaterThan(5);
    for (const [k, status] of statuses) expect(status, `slot ${k}`).toBe('OK');
  });

  it('test_speakerBacking_measurementFailsOnce_leakOverSkippedNotesIsNotOk', async () => {
    const { statuses } = await run({ seconds: 9, skipped: CHORD_TONES, measureFails: 1 });
    expect(statuses.size).toBeGreaterThan(5);
    for (const [k, status] of statuses)
      expect(status, `slot ${k}`).toBe(CHORD_TONES.includes(k) ? 'MISSED' : 'OK');
  });

  it('test_speakerBacking_gainArrivesLateWithinTheWait_noSlotIsLostOrGivenUp', async () => {
    const { statuses, evicted } = await run({ seconds: 9, skipped: [], answerAfterGridS: 2 });
    expect(evicted).toBe(0);
    expect(statuses.size).toBeGreaterThan(5);
    expect([...statuses.keys()].slice(0, 3)).toEqual([0, 1, 2]);
    for (const [k, status] of statuses) expect(status, `slot ${k}`).toBe('OK');
  });

  it('test_speakerBacking_gainArrivesAfterTheWait_oldSlotsAreGivenUpNewOnesStayOkWithoutReadingEvictedAudio', async () => {
    const { statuses, evicted } = await run({ seconds: 11, skipped: [], answerAfterGridS: 6 });
    expect(evicted).toBe(0);
    // Slot 0 was given up at grid + 2.5 s, well before the answer: only the later ones reach the DSP.
    expect(statuses.has(0)).toBe(false);
    expect(statuses.size).toBeGreaterThan(3);
    for (const [k, status] of statuses) expect(status, `slot ${k}`).toBe('OK');
  });

  it.each([[[]], [CHORD_TONES]])(
    'test_speakerBacking_measurementNeverSucceeds_noNoteIsJudgedFromAGuess (skipped %j)',
    async (skipped) => {
      const { statuses, measures } = await run({ seconds: 6, skipped, measureFails: 100 });
      // Nothing can tell the leak from the user's note here: no chunk is judged, so neither OK nor MISSED appears.
      expect(statuses.size).toBe(0);
      expect(measures).toBe(3);
    },
  );
});
