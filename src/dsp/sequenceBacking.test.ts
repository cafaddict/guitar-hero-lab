import { describe, expect, it } from 'vitest';
import { patternById } from '../content/patterns';
import { voicingById } from '../content/voicings';
import { STANDARD_TUNING } from '../domain/theory';
import {
  type BackingSchedule,
  backingTemplateRises,
  bleedGain,
  DEFAULT_BACKING_MASK_PARAMS,
  lowBand,
} from './backingMask';
import { type SequenceSlot, verifySequence } from './sequence';
import { renderBacking } from './synth/backing';
import { type NoteSpec, randomTimbre } from './synth/note';
import { renderSequence, type SequenceNote } from './synth/sequence';

const FS = 48000;
const BPM = 80;
const BEAT = 60 / BPM;
const LEAD_S = 0.5;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Em pentatonic, one note per beat (E10 step 1's opening), over the Em backing of "반주와 함께" (P0). */
const SHAPE = [
  { string: 6, fret: 0 },
  { string: 6, fret: 3 },
  { string: 5, fret: 0 },
  { string: 5, fret: 2 },
  { string: 4, fret: 0 },
  { string: 4, fret: 2 },
  { string: 3, fret: 0 },
  { string: 3, fret: 2 },
];
const midiOf = (p: { string: number; fret: number }) => STANDARD_TUNING.openMidi[6 - p.string]! + p.fret;
/** Slots left unplayed: 5:2 = B2 and 4:2 = E3, both tones of the backing's Em chord. */
const SKIPPED = [3, 5];

function note(midi: number, seed: number): NoteSpec {
  return {
    model: 'karplus-strong',
    f0: hz(midi),
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
  };
}

function rms(x: ArrayLike<number>, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / (to - from));
}

/**
 * One intro bar of backing alone, then the user plays SHAPE on the beats of the next two bars (every slot sits on
 * a backing strum), the backing leaking in `relDb` below the user's first note (§14.8 scale: first 500 ms RMS).
 */
function scene(relDb: number, skipped: readonly number[]) {
  const backing = renderBacking({
    chords: [voicingById('Em')],
    pattern: patternById('P0'),
    bpm: BPM,
    bars: 3,
    sampleRate: FS,
    model: 'karplus-strong',
    seed: 11,
  });
  const lead = Math.round(LEAD_S * FS);
  const length = lead + backing.signal.length;
  const times = SHAPE.map((_, k) => LEAD_S + (4 + k) * BEAT);
  const notes: SequenceNote[] = SHAPE.map((p, k) => ({
    time: times[k]!,
    string: p.string,
    note: note(midiOf(p), 20 + k),
    gainDb: 0,
  }));
  const user = renderSequence(
    notes.filter((_, k) => !skipped.includes(k)),
    FS,
    length,
  ).signal;
  const reference = renderSequence([notes[0]!], FS, length).signal;
  const first = Math.round(times[0]! * FS);
  const g = (rms(reference, first, first + FS / 2) * 10 ** (relDb / 20)) / rms(backing.signal, 0, FS / 2);
  const signal = new Float32Array(length);
  for (let i = 0; i < length; i++) signal[i] = user[i]!;
  for (let i = 0; i < backing.signal.length; i++)
    signal[lead + i] = signal[lead + i]! + backing.signal[i]! * g;
  let seed = 5;
  for (let i = 0; i < signal.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    signal[i] = signal[i]! + ((seed / 2 ** 32) * 2 - 1) * 1e-4;
  }
  const eventSamples = backing.events.map((e) => Math.round(e.time * FS));
  const schedule: BackingSchedule = {
    arrivals: eventSamples.map((s) => lead + s),
    templateRises: backingTemplateRises(backing.signal, eventSamples, FS),
    introCount: backing.events.filter((e) => e.time < 4 * BEAT - 1e-6).length,
  };
  const slots: SequenceSlot[] = SHAPE.map((p, k) => ({
    time: times[k]!,
    midi: midiOf(p),
    stringIdx: 6 - p.string,
    cycle: 0,
  }));
  return { signal, schedule, slots };
}

function statuses(relDb: number, skipped: readonly number[], masked: boolean) {
  const { signal, schedule, slots } = scene(relDb, skipped);
  return verifySequence({
    samples: signal,
    sampleRate: FS,
    slots,
    bpm: BPM,
    ...(masked ? { backing: schedule } : {}),
  }).notes.map((n) => n.status);
}

describe('D-102 sequence verification under a speaker backing (E10 "반주와 함께")', () => {
  it('test_verifySequence_unmaskedBleedOverSkippedChordTones_neverMissed (why the mask is needed)', () => {
    // The leaked Em strum fills the unplayed slots: UNCLEAR (an "uncertain" cycle that keeps the streak) or OK.
    const result = statuses(-12, SKIPPED, false);
    for (const k of SKIPPED) expect(result[k], `slot ${k}`).not.toBe('MISSED');
  });

  it.each([-10, -12, -18])('test_verifySequence_maskedBleedAt%ddB_skippedNotesAreMissedNotOk', (relDb) => {
    const result = statuses(relDb, SKIPPED, true);
    for (const k of SKIPPED) expect(result[k], `slot ${k}`).toBe('MISSED');
  });

  it('test_verifySequence_maskedSkippedNotes_cycleIsAMistakeNotUncertain', () => {
    const { signal, schedule, slots } = scene(-12, SKIPPED);
    const res = verifySequence({ samples: signal, sampleRate: FS, slots, bpm: BPM, backing: schedule });
    expect(res.cycles[0]).toMatchObject({ flawless: false, uncertain: false });
  });

  it.each([-10, -12, -18])(
    'test_verifySequence_maskedBleedAt%ddB_notesPlayedOnTheBackingStrumsStayOk',
    (relDb) => {
      const result = statuses(relDb, SKIPPED, true);
      SHAPE.forEach((_, k) => {
        if (!SKIPPED.includes(k)) expect(result[k], `slot ${k}`).toBe('OK');
      });
    },
  );

  it('test_verifySequence_maskedFullyPlayedCycle_isFlawless', () => {
    const { signal, schedule, slots } = scene(-12, []);
    const res = verifySequence({ samples: signal, sampleRate: FS, slots, bpm: BPM, backing: schedule });
    expect(res.cycles[0]).toMatchObject({ flawless: true, extras: 0 });
  });

  /** The first two slots alone, as a chunk of the tracker: nothing in it is the backing playing alone. */
  function firstTwoSlots(gain?: number) {
    const { signal, schedule, slots } = scene(-12, []);
    const from = Math.round((slots[0]!.time - 0.45) * FS);
    const to = Math.round((slots[1]!.time + 0.4) * FS);
    const inside = schedule.arrivals.flatMap((a, i) =>
      a >= from - 0.1 * FS && a <= to + 0.1 * FS ? [i] : [],
    );
    return verifySequence({
      samples: signal.subarray(from, to),
      sampleRate: FS,
      slots: slots.slice(0, 2).map((s) => ({ ...s, time: s.time - from / FS })),
      bpm: BPM,
      backing: {
        arrivals: inside.map((i) => schedule.arrivals[i]! - from),
        templateRises: inside.map((i) => schedule.templateRises[i]!),
        introCount: 0,
        ...(gain === undefined ? {} : { gain }),
      },
    }).notes.map((n) => n.status);
  }

  it('test_verifySequence_shortChunkWithIntroGain_playedNotesAreOk', () => {
    const { signal, schedule } = scene(-12, []);
    const count = schedule.introCount;
    const gain = bleedGain(
      lowBand(signal, FS, DEFAULT_BACKING_MASK_PARAMS),
      FS,
      {
        ...schedule,
        arrivals: schedule.arrivals.slice(0, count),
        templateRises: schedule.templateRises.slice(0, count),
      },
      DEFAULT_BACKING_MASK_PARAMS,
    );
    expect(firstTwoSlots(gain)).toEqual(['OK', 'OK']);
  });

  it('test_verifySequence_shortChunkWithoutGain_theUsersOwnNotesBecomeTheLeakEstimate (why the app never asks for it)', () => {
    expect(firstTwoSlots()).toEqual(['MISSED', 'MISSED']);
  });

  it('test_verifySequence_backingWithoutEvents_masksNothing', () => {
    const { signal, slots } = scene(-12, []);
    const empty: BackingSchedule = { arrivals: [], templateRises: [], introCount: 0 };
    const plain = verifySequence({ samples: signal, sampleRate: FS, slots, bpm: BPM });
    const masked = verifySequence({ samples: signal, sampleRate: FS, slots, bpm: BPM, backing: empty });
    expect(masked.notes.map((n) => n.status)).toEqual(plain.notes.map((n) => n.status));
  });
});
