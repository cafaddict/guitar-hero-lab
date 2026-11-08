import { describe, expect, it } from 'vitest';
import { scaleById, scaleStepSequence } from '../../content/scales';
import { STANDARD_TUNING } from '../../domain/theory';
import { DEFAULT_SEQUENCE_PARAMS, type SequenceSlot, verifySequence } from '../../dsp/sequence';
import { type NoteSpec, randomTimbre } from '../../dsp/synth/note';
import { renderSequence } from '../../dsp/synth/sequence';
import { DETECTOR_VERSION } from '../../dsp/version';
import { FakeMic } from '../testing/fakes';
import type { SequenceOutcome, SequenceRequest } from '../types';
import { type PlannedSlot, SequenceTracker } from './tracker';

const FS = 48000;

/** Mirrors the DSP worker's 'sequence' range request on a prerecorded take (audio time 0 = sample 0). */
function workerLike(take: Float32Array) {
  return (request: SequenceRequest): Omit<SequenceOutcome, 'detectorVersion' | 'processingMs'> => {
    const start = Math.round(request.from * FS);
    const samples = take.subarray(start, Math.round(request.to * FS));
    const rel = (t: number) => t - request.from;
    const res = verifySequence({
      samples,
      sampleRate: FS,
      bpm: 90,
      slots: request.slots.map((s) => ({ ...s, time: rel(s.time) })),
      priorNotes: request.priorNotes.map((n) => ({
        f0: n.f0,
        stringIdx: n.stringIdx,
        startSample: Math.round(rel(n.time) * FS),
      })),
      extraSpanS: [rel(request.extraSpan[0]), rel(request.extraSpan[1])],
    });
    return {
      notes: res.notes.map(({ onsetSample, ...n }) =>
        onsetSample === undefined ? n : { ...n, onsetTime: request.from + onsetSample / FS },
      ),
      extras: res.extras.map((e) => request.from + e / FS),
    };
  };
}

function note(midi: number, seed: number): NoteSpec {
  return {
    model: 'karplus-strong',
    f0: 440 * 2 ** ((midi - 69) / 12),
    sampleRate: FS,
    durationS: 2,
    inharmonicityB: 5e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    seed,
  };
}

/** Two cycles of Em pentatonic step 1 (23 notes each) at 90 BPM eighths — ≈ 15 s, far longer than the ring. */
function scene(edit: (k: number) => 'play' | 'skip' | 'wrong' = () => 'play') {
  const em = scaleById('em-pent-open');
  const order = scaleStepSequence(em, 1);
  const ioi = 30 / 90;
  const slots: PlannedSlot[] = [];
  const notes = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const [k, idx] of order.entries()) {
      const n = em.notes[idx]!;
      const midi = STANDARD_TUNING.openMidi[6 - n.string]! + n.fret;
      const i = cycle * order.length + k;
      const time = 1 + i * ioi;
      slots.push({ time, midi, stringIdx: 6 - n.string, cycle });
      const act = edit(i);
      if (act === 'skip') continue;
      notes.push({ time, string: n.string, note: note(act === 'wrong' ? midi + 1 : midi, i), gainDb: 0 });
    }
  }
  const { signal } = renderSequence(notes, FS, Math.round((slots.at(-1)!.time + 2) * FS));
  return { signal, slots };
}

function drive(tracker: SequenceTracker, until: number) {
  return (async () => {
    for (let t = 0; t <= until; t += 0.05) {
      tracker.pump(t);
      await Promise.resolve();
      await Promise.resolve();
    }
  })();
}

const pumpTo = async (tracker: SequenceTracker, from: number, to: number) => {
  for (let t = from; t <= to + 1e-9; t += 0.05) {
    tracker.pump(t);
    await Promise.resolve();
    await Promise.resolve();
  }
};

describe('SequenceTracker (SPEC v1.1 §10.10 in chunks)', () => {
  it('judges a long take chunk by chunk exactly like one whole-take verification', async () => {
    const { signal, slots } = scene((i) => (i === 30 ? 'wrong' : i === 40 ? 'skip' : 'play'));
    const mic = new FakeMic();
    mic.sequenceResponder = workerLike(signal);
    const tracker = new SequenceTracker(mic, { bpm: 90 });
    tracker.addSlots(slots);
    await drive(tracker, slots.at(-1)!.time + 2);
    for (const r of mic.sequenceRequests) expect(r.to - r.from).toBeLessThanOrEqual(3.2 + 1e-9);
    expect(mic.sequenceRequests.length).toBeGreaterThan(4);
    const cycles = tracker.cycles();
    expect(cycles.map((c) => c.flawless)).toEqual([true, false]);
    const whole = verifySequence({
      samples: signal,
      sampleRate: FS,
      bpm: 90,
      slots: slots as SequenceSlot[],
    });
    const chunked = cycles.flatMap((c) => c.notes.map((n) => n.status));
    expect(chunked).toEqual(whole.notes.map((n) => n.status));
    const second = cycles[1]!;
    expect(second.notes[30 - 23]).toMatchObject({ status: 'WRONG_NOTE', semitones: 1 });
    expect(second.notes[40 - 23]!.status).toBe('MISSED');
    expect(second.okRatio).toBeCloseTo(21 / 23, 9);
    expect(tracker.stats()).toMatchObject({ detectorVersion: DETECTOR_VERSION });
  });

  it('an inserted note between chunks is an EXTRA of exactly one cycle', async () => {
    const { signal, slots } = scene();
    // Add an extra note on another string between slots 10 and 11 of the first cycle.
    const extra = renderSequence(
      [{ time: (slots[10]!.time + slots[11]!.time) / 2, string: 3, note: note(55, 99), gainDb: 0 }],
      FS,
      signal.length,
    ).signal;
    const take = signal.map((x, i) => x + extra[i]!);
    const mic = new FakeMic();
    mic.sequenceResponder = workerLike(take);
    const tracker = new SequenceTracker(mic, { bpm: 90 });
    tracker.addSlots(slots);
    await drive(tracker, slots.at(-1)!.time + 2);
    expect(tracker.cycles().map((c) => [c.flawless, c.extras])).toEqual([
      [false, 1],
      [true, 0],
    ]);
  });

  it('stop() drops unrequested slots: a cycle cut short never completes', async () => {
    const { signal, slots } = scene();
    const mic = new FakeMic();
    mic.sequenceResponder = workerLike(signal);
    const tracker = new SequenceTracker(mic, { bpm: 90 });
    tracker.addSlots(slots);
    await drive(tracker, slots[30]!.time + 0.4);
    tracker.stop();
    await drive(tracker, slots.at(-1)!.time + 2);
    expect(tracker.cycles().map((c) => c.cycle)).toEqual([0]);
    expect(tracker.busy).toBe(false);
  });

  it("a double detection of a chunk's last note just after the boundary is a duplicate, not an EXTRA (review M12)", async () => {
    // 2 cycles × 23 eighths at 90 BPM; every note is detected twice (+5 ms matched, +55 ms duplicate).
    const ioi = 30 / 90;
    const slots: PlannedSlot[] = Array.from({ length: 46 }, (_, i) => ({
      time: 1 + i * ioi,
      midi: 52,
      stringIdx: 1,
      cycle: Math.floor(i / 23),
    }));
    const dupS = DEFAULT_SEQUENCE_PARAMS.duplicateMs / 1000;
    const mic = new FakeMic();
    // Like the worker: a duplicate is dropped only next to an onset matched in the same request.
    mic.sequenceResponder = (request) => {
      const matched = request.slots.map((s) => s.time + 0.005);
      const extras = slots
        .map((s) => s.time + 0.055)
        .filter((d) => d > request.extraSpan[0] && d <= request.extraSpan[1])
        .filter((d) => !matched.some((m) => Math.abs(m - d) <= dupS));
      return {
        notes: request.slots.map((_, i) => ({ slot: i, status: 'OK', cents: 0, onsetTime: matched[i]! })),
        extras,
      };
    };
    const tracker = new SequenceTracker(mic, { bpm: 90 });
    tracker.addSlots(slots);
    await drive(tracker, slots.at(-1)!.time + 2);
    expect(mic.sequenceRequests.length).toBeGreaterThan(4);
    expect(tracker.cycles().map((c) => [c.flawless, c.extras])).toEqual([
      [true, 0],
      [true, 0],
    ]);
  });
});

describe('SequenceTracker waiting for the backing bleed gain (D-102)', () => {
  const slotsAt = (times: readonly number[], cycle: number): PlannedSlot[] =>
    times.map((time) => ({ time, midi: 40, stringIdx: 5, cycle }));
  const backing = { arrivals: [1, 2, 3, 4], templateRises: [1, 1, 1, 1], gain: 0.02 };

  it('test_tracker_gainPendingWithinTheWait_noChunkAndSlotsStayWaiting', async () => {
    const mic = new FakeMic();
    const tracker = new SequenceTracker(mic, { bpm: 60 });
    tracker.addSlots(slotsAt([1, 2], 0));
    tracker.setBacking(null, true);

    await pumpTo(tracker, 0, 3.4);

    expect(mic.sequenceRequests).toEqual([]);
    expect(tracker.cycles()).toEqual([]);
    expect(tracker.idle).toBe(false);
  });

  it('test_tracker_gainPendingPastTheWait_slotsTurnUnclearAndTheCycleIsUncertain', async () => {
    const mic = new FakeMic();
    const tracker = new SequenceTracker(mic, { bpm: 60 });
    tracker.addSlots(slotsAt([1, 2], 0));
    tracker.setBacking(null, true);

    await pumpTo(tracker, 0, 6);

    expect(mic.sequenceRequests).toEqual([]);
    expect(tracker.idle).toBe(true);
    expect(tracker.cycles()[0]).toMatchObject({ flawless: false, uncertain: true });
    expect(tracker.cycles()[0]!.notes.map((n) => n.status)).toEqual(['UNCLEAR', 'UNCLEAR']);
  });

  it('test_tracker_gainArrivesInTheWait_waitingSlotsGoOutWithTheGain', async () => {
    const mic = new FakeMic();
    const tracker = new SequenceTracker(mic, { bpm: 60 });
    tracker.addSlots(slotsAt([1, 2], 0));
    tracker.setBacking(null, true);
    await pumpTo(tracker, 0, 3);

    tracker.setBacking(backing);
    await pumpTo(tracker, 3, 5);

    expect(mic.sequenceRequests.flatMap((r) => r.slots.map((s) => s.time))).toEqual([1, 2]);
    expect(mic.sequenceRequests.every((r) => r.backing?.gain === 0.02)).toBe(true);
    expect(tracker.cycles()[0]).toMatchObject({ flawless: true });
  });

  it('test_tracker_gainArrivesAfterGivingUp_onlyTheNewerSlotsAreJudged', async () => {
    const mic = new FakeMic();
    const tracker = new SequenceTracker(mic, { bpm: 60 });
    tracker.addSlots(slotsAt([1], 0));
    tracker.addSlots(slotsAt([4], 1));
    tracker.setBacking(null, true);
    await pumpTo(tracker, 0, 4);

    tracker.setBacking(backing);
    await pumpTo(tracker, 4, 7);

    expect(mic.sequenceRequests.flatMap((r) => r.slots.map((s) => s.time))).toEqual([4]);
    expect(tracker.cycles().map((c) => [c.cycle, c.flawless, c.uncertain])).toEqual([
      [0, false, true],
      [1, true, false],
    ]);
  });
});

describe('SequenceTracker cut by a pause (D-085)', () => {
  /** Four-note cycles every 0.5 s from t = 1 (fake worker: every slot OK, played on time). */
  const cycleSlots = (cycle: number, from: number): PlannedSlot[] =>
    [0, 1, 2, 3].map((k) => ({ time: from + k * 0.5, midi: 52 + k, stringIdx: k % 6, cycle }));

  it('keeps the slots before the cut, judges them at once, and starts the next stretch like a new take', async () => {
    const mic = new FakeMic();
    const tracker = new SequenceTracker(mic, { bpm: 120 });
    tracker.addSlots([...cycleSlots(0, 1), ...cycleSlots(1, 3), ...cycleSlots(2, 5)]);
    await pumpTo(tracker, 0, 3.2);
    // Slots 1, 1.5, 2 went in one batch; 2.5 is still waiting for more.
    expect(mic.sequenceRequests.map((r) => r.slots.length)).toEqual([3]);
    // Paused in cycle 1: it and the cycle planned after it are cut; slot 2.5 stays.
    expect(tracker.cutAt(3)).toBe(4);
    expect(tracker.plannedCount).toBe(4);
    tracker.pump(3.2);
    await Promise.resolve();
    // The slot before the cut is sent at once (the ring must still hold it), alone.
    expect(mic.sequenceRequests.map((r) => r.slots.length)).toEqual([3, 1]);
    expect(tracker.cycles().map((c) => c.cycle)).toEqual([0]);
    // The replay (new id 3), placed close enough that the old notes would still "ring" across a plain chunk.
    tracker.addSlots(cycleSlots(3, 3.6));
    await pumpTo(tracker, 3.2, 8);
    const after = mic.sequenceRequests.slice(2);
    expect(after.length).toBeGreaterThan(0);
    for (const r of after) expect(r.slots.every((s) => s.time >= 3.6)).toBe(true);
    expect(after[0]!.priorNotes).toEqual([]);
    expect(after[0]!.extraSpan[0]).toBeGreaterThan(3.3);
    expect(tracker.cycles().map((c) => c.cycle)).toEqual([0, 3]);
  });

  it('a cycle already partly requested when cut never completes; the kept count covers its sent slots', async () => {
    const mic = new FakeMic();
    const tracker = new SequenceTracker(mic, { bpm: 120 });
    tracker.addSlots([...cycleSlots(0, 1), ...cycleSlots(1, 3)]);
    await pumpTo(tracker, 0, 4.9);
    const sent = mic.sequenceRequests.flatMap((r) => r.slots).length;
    expect(sent).toBeGreaterThan(4);
    // Cut at cycle 1's start: its slots already sent stay (kept ≥ sent), the rest are dropped.
    expect(tracker.cutAt(3)).toBe(sent);
    await pumpTo(tracker, 4.9, 8);
    expect(tracker.idle).toBe(true);
    expect(tracker.cycles().map((c) => c.cycle)).toEqual([0]);
  });
});
