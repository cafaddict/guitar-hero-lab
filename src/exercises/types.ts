/**
 * Exercise plugin contract (SPEC §11.1). The core (session runner, records, charts, routine) never knows
 * exercise types: a plugin bundles params/result schemas, a pure runner, its views and metric extraction.
 * Runners work without a microphone (manual mode) and are unit-tested with a fake clock and scripted events.
 */

import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { MetronomeConfig, ScheduledClick } from '../audio/metronome';
import type { Job } from '../audio/worker/protocol';
import type { GVoicing } from '../content/voicings';
import type { EarphoneChoice } from '../data/settings';
import type { Calibration, MetricSampleInput } from '../domain/records';
import type { ChordVoicing } from '../domain/voicing';
import type { SequenceNoteResult, SequenceSlot } from '../dsp/sequence';
import type { TimingAnalysis, TimingSlot } from '../dsp/timing';
import type { Sensitivity, Strictness } from '../dsp/types';
import type { ko } from '../i18n/ko';

export type RunnerCommand =
  | 'toggle'
  | 'next'
  | 'prev'
  | 'inc'
  | 'dec'
  | 'abort'
  | 'mark'
  | 'manual1'
  | 'manual2'
  | 'manual3'
  | 'ear'
  | 'cues'
  | 'loop'
  | 'hide'
  | 'backing'
  // Pause/resume and the song's start-over (D-085).
  | 'pause'
  | 'restart';

/**
 * ready: waiting for the user · armed: waiting for the first strum (auto start) · countIn · running ·
 * paused · review: timed part over, user confirms/corrects · done: result can be taken.
 */
export type RunnerPhase = 'ready' | 'armed' | 'countIn' | 'running' | 'paused' | 'review' | 'done';

export interface RunnerSnapshot<V> {
  phase: RunnerPhase;
  /** Remaining simulated ms of the timed part (null = untimed). */
  remainingMs: number | null;
  view: V;
}

export interface DspStats {
  detectorVersion: string | null;
  /** Mean processing time per judged event (0 when no DSP ran). */
  meanProcessingMs: number;
  events: number;
}

export interface ExerciseRunner<R, V> {
  start(): void;
  command(cmd: RunnerCommand): void;
  subscribe(listener: (snapshot: RunnerSnapshot<V>) => void): () => void;
  snapshot(): RunnerSnapshot<V>;
  /** Advances clock-driven state (timers); the UI calls it from requestAnimationFrame. */
  tick(): void;
  finish(): R;
  /**
   * False when nothing worth recording happened (stopped before starting, nothing answered, scoring never ran):
   * the host then stores no Attempt, so aborted runs never become metric samples.
   */
  hasResult(): boolean;
  dspStats(): DspStats;
  /**
   * Params as they are now, after option keys changed them during the run (SPEC v1.1 §12.3: options are
   * recorded in the Attempt params). Runners without options leave it out and the start params are stored.
   */
  effectiveParams?(): unknown;
  /**
   * True while 'prev' undoes this run's last step (D-096). Absent = never: in a session ← then means the
   * previous item.
   */
  canStepBack?(): boolean;
  dispose(): void;
}

/** A judged onset as runners see it (audio-clock seconds). */
export interface JudgedEvent {
  time: number;
  result: unknown;
  jobKind: Job['kind'] | null;
  detectorVersion: string;
  processingMs: number;
}

export interface TimingRequest {
  slots: readonly TimingSlot[];
  strumTimes: readonly number[];
  rttS: number;
  bpm: number;
  personalOffsetMs: number | null;
}

/** Microphone side of the audio engine. `null` in the context = "no microphone" mode. */
export interface ExerciseMic {
  setJob(job: Job | null): void;
  onJudged(listener: (event: JudgedEvent) => void): () => void;
  /** Low-latency coarse onsets (first-strum auto start, multiple-onset detection). */
  onCoarseOnset(listener: (time: number) => void): () => void;
  setTuner(enabled: boolean, expectedF0: number | null): void;
  onTuner(listener: (reading: { f0: number | null; stableF0: number | null }) => void): () => void;
  /** Mode A fallback over [from, to] (audio s) when the onset detector found nothing. */
  pluckFallback(request: PluckFallbackRequest): Promise<JudgedEvent | null>;
  analyzeTiming(
    request: TimingRequest,
  ): Promise<{ result: TimingAnalysis; detectorVersion: string; processingMs: number }>;
  /** Single-note sequence verification (SPEC v1.1 §10.10) over [from, to] (audio s, ≤ ~3.9 s back). */
  analyzeSequence(request: SequenceRequest): Promise<SequenceOutcome>;
  /** Capture sample index of an audio-clock time (jobs that name moments of the recording). */
  captureSampleOf(time: number): number;
  /** Backing bleed gain over [from, to] where the backing played alone (SPEC v1.1 §10.12). */
  measureBleedGain(request: {
    from: number;
    to: number;
    arrivals: readonly number[];
    templateRises: readonly number[];
  }): Promise<number>;
}

/** A chunk of a sequence take: slots, earlier notes and the EXTRA span in audio-clock seconds. */
export interface SequenceRequest {
  from: number;
  to: number;
  bpm: number;
  slots: readonly SequenceSlot[];
  deltaCents?: readonly number[];
  priorNotes: readonly { f0: number; stringIdx?: number | undefined; time: number }[];
  extraSpan: readonly [number, number];
  /** Speaker backing events to mask (D-102): arrivals in audio s; without a gain the worker estimates one. */
  backing?: SequenceBacking;
}

/** Backing events heard through the microphone (scheduled time + RTT) and the bleed gain (§10.12, D-102). */
export interface SequenceBacking {
  arrivals: readonly number[];
  templateRises: readonly number[];
  /** Measured on the backing alone: an estimate from a chunk would take the user's notes for the leak. */
  gain: number;
}

export interface SequenceOutcome {
  /** One per requested slot (onset times in audio s). */
  notes: (Omit<SequenceNoteResult, 'onsetSample'> & { onsetTime?: number })[];
  /** EXTRA onsets inside the span (audio s). */
  extras: number[];
  detectorVersion: string;
  processingMs: number;
}

/** Output side (always available, also without a microphone). */
export interface ExerciseOutput {
  /** Audio-clock seconds. */
  now(): number;
  metronome: {
    start(config: MetronomeConfig, options?: { rttMs?: number }): Promise<void>;
    stop(): void;
    setBpm(bpm: number): void;
    onClick(listener: (click: ScheduledClick) => void): () => void;
    onEnd(listener: (time: number) => void): () => void;
    gridStartTime(): number | null;
  };
  /** Synth playback ("들어 보기", ear training). Throws while the microphone is judging; returns a stop function. */
  playSamples(samples: Float32Array): () => void;
  /** Short audible cue that is never blocked (e.g. the end of a timed run: two accent clicks). */
  cue(kind: 'end'): void;
  /**
   * Play-along backing at an audio-clock time (SPEC v1.1 §8.6): allowed while the microphone judges (the
   * metronome's exception); returns a stop function.
   */
  playBacking(samples: Float32Array, at: number): () => void;
  sampleRate(): number;
}

export interface ContentContext {
  voicings: readonly ChordVoicing[];
  /** Chord classes unlocked so far (stage progression; both G voicings are class 'G'). */
  unlockedChordClasses: readonly string[];
  /** The user's current G voicing (SPEC §6.5). */
  gVoicing: GVoicing;
  stage: number;
}

export interface PluckFallbackRequest {
  from: number;
  to: number;
  expectedF0: number;
  templateDecayRatio?: number | undefined;
  strictness: Strictness;
  sensitivity?: Sensitivity;
  /** x-string check: silence (or a dead thud) is the expected result. */
  silent?: boolean;
  /** Strings plucked just before that may still ring (audio-clock onset times, D-074). */
  ringing?: readonly { f0: number; time: number }[];
}

export interface ExerciseSettings {
  strictness: Strictness;
  /** Pluck judgement sensitivity (settings "판정 감도", D-075). */
  sensitivity: Sensitivity;
  xStringCheck: boolean;
  leftHanded: boolean;
  visualOnlyMetronome: boolean;
  /** Song play-along earphone choice per output device label, from the device settings (D-101). */
  earphonesByOutput: Readonly<Record<string, boolean>>;
}

export interface ExerciseContext {
  audio: ExerciseMic | null;
  output: ExerciseOutput;
  /** Simulated milliseconds (performance.now() × test rate; rate = 1 in production). */
  clock: { now(): number };
  content: ContentContext;
  calibration?: Calibration | undefined;
  settings: ExerciseSettings;
  /** Personal timing lead/lag (mean of recent runs, ≥ 3) for Mode D correction; null if unknown. */
  personalOffsetMs?: number | null;
}

/** A shared glossary entry a "하는 법" panel can attach (defined once in `ko.exercises.guide.terms`). */
export type HowToTerm = keyof (typeof ko)['exercises']['guide']['terms'];

/** What a first-timer needs before a run (D-079): the steps (hands, clicks, judging, tempo) and the terms used. */
export interface HowTo {
  steps: readonly string[];
  terms: readonly HowToTerm[];
}

export interface ExercisePlugin<P, R, V> {
  type: string;
  version: number;
  titleKey: ExerciseTitleKey;
  paramsSchema: z.ZodType<P>;
  resultSchema: z.ZodType<R>;
  defaultParams(ctx: ContentContext): P;
  createRunner(ctx: ExerciseContext, params: P): ExerciseRunner<R, V>;
  View: ComponentType<{ runner: ExerciseRunner<R, V>; params: P; ctx: ExerciseContext }>;
  Summary: ComponentType<{ result: R; params: P }>;
  /** "하는 법" for these params, shown before the run starts (required: every exercise explains itself). */
  howTo(params: P): HowTo;
  toMetrics(result: R, params: P): MetricSampleInput[];
  /** Optional: adjusts params from this exercise's most recent results (newest first), e.g. ladder history. */
  withHistory?(params: P, recent: readonly R[]): P;
  /** How many recent results withHistory sees (default 5). */
  historyDepth?: number;
  /**
   * Optional: the earphone choice a finished run made for its output device, or null (no choice). The host
   * stores it in the device settings (`earphonesByOutput`, D-101).
   */
  earphoneChoice?(result: R): EarphoneChoice | null;
  /** Optional: the run again at the tempo its summary suggests (ladder up/down, passed → +5), or null. */
  suggestedTempoRetry?(params: P, result: R): { bpm: number; params: P } | null;
  usesMicrophone: boolean;
  /** The run can be paused and resumed (P, D-085): metronome exercises only. Default false. */
  pausable?: boolean;
  migrateResult?(raw: unknown, fromVersion: number): R;
}

/** History depth of the ladder exercises whose subjects rotate (E9 start frets, E10 scales and steps, E11 pairs). */
export const SEQUENCE_HISTORY_DEPTH = 30;

export type ExerciseTitleKey =
  | 'E0'
  | 'E1'
  | 'E2'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'E7'
  | 'E8'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'Q5'
  | 'S'
  | 'E3'
  | 'E9'
  | 'E10'
  | 'E11'
  | 'E12'
  | 'E16'
  | 'E17'
  | 'K1';
