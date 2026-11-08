/**
 * DSP worker message protocol (SPEC §8.3): discriminated unions validated with zod on the worker side.
 * Every judgement carries detectorVersion and processingMs.
 */
import { z } from 'zod';
import { voicingSchema } from '../../content/schemas';
import type { ChordVoicing } from '../../domain/voicing';
import type { PluckResult } from '../../dsp/modeA';
import type { TimingAnalysis } from '../../dsp/timing';

const strictness = z.enum(['lenient', 'normal', 'strict']);
const sensitivity = z.enum(['low', 'normal', 'high']);
/** Strings plucked just before a Mode A take that may still ring (D-074): their f0 and onset capture sample. */
const ringing = z
  .array(z.object({ f0: z.number().positive(), sample: z.number() }))
  .max(6)
  .default([]);
/** zod emits `field?: T | undefined`; the domain type uses exact optional properties, so drop undefined keys. */
const workerVoicing = voicingSchema.transform(
  ({ nameKo, barres, ...rest }): ChordVoicing => ({
    ...rest,
    ...(nameKo !== undefined ? { nameKo } : {}),
    ...(barres !== undefined ? { barres } : {}),
  }),
);

export const jobSchema = z.discriminatedUnion('kind', [
  /**
   * Onset times (timing exercises), optionally with beta readings per strum (SPEC v1.1 §10.11): direction
   * (per-string order, with the voicing when known), palm-mute probability and the strum level (dynamics).
   */
  z.object({
    kind: z.literal('onsets'),
    beta: z
      .object({
        voicing: workerVoicing.optional(),
        direction: z.boolean().default(false),
        palmMute: z.boolean().default(false),
        level: z.boolean().default(false),
      })
      .optional(),
  }),
  /**
   * Mode A: one expected string. `silent` = x-string check; `buzz` adds the beta buzz score (§10.11);
   * `sensitivity` (D-075) and the still-ringing strings (D-074) default to the benchmark's plain judgement.
   */
  z.object({
    kind: z.literal('pluck'),
    expectedF0: z.number().positive(),
    templateDecayRatio: z.number().optional(),
    strictness: strictness.default('lenient'),
    sensitivity: sensitivity.default('normal'),
    ringing,
    silent: z.boolean().default(false),
    buzz: z.boolean().optional(),
  }),
  /** Calibration template: one open-string pluck → harmonic profile + decay ratio (SPEC §9.1-4). */
  z.object({ kind: z.literal('template'), expectedF0: z.number().positive() }),
  /** Mode B: strum verification (beta). */
  z.object({
    kind: z.literal('strum'),
    voicing: workerVoicing,
    deltaCents: z.array(z.number()).length(6).optional(),
    strictness: strictness.default('lenient'),
  }),
  /** Mode C: one-minute change pair. */
  z.object({
    kind: z.literal('pair'),
    voicings: z.tuple([workerVoicing, workerVoicing]),
    deltaCents: z.array(z.number()).length(6).optional(),
  }),
  /** E3 (SPEC v1.1 §11.11): Mode C pair classification plus Mode B on the winning chord ("참고(베타)"). */
  z.object({
    kind: z.literal('pfc'),
    voicings: z.tuple([workerVoicing, workerVoicing]),
    deltaCents: z.array(z.number()).length(6).optional(),
  }),
  /**
   * Song perform/hidden with a microphone (SPEC v1.1 §11.10, §8.6): Mode C set scores for the chord check and,
   * when the backing plays on speakers, whether the onset is the user's strum or backing bleed (§10.12) —
   * `arrivals` are capture samples of the backing events (scheduled time + RTT).
   */
  z.object({
    kind: z.literal('songStrum'),
    voicings: z.array(workerVoicing).min(1),
    deltaCents: z.array(z.number()).length(6).optional(),
    backing: z
      .object({
        arrivals: z.array(z.number()),
        templateRises: z.array(z.number()),
        gain: z.number().min(0),
      })
      .optional(),
  }),
  /** Mode C: recall quiz set. */
  z.object({
    kind: z.literal('set'),
    voicings: z.array(workerVoicing).min(2),
    deltaCents: z.array(z.number()).length(6).optional(),
  }),
]);
export type Job = z.infer<typeof jobSchema>;

export const rangeRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rtt'), scheduledSamples: z.array(z.number()) }),
  z.object({ kind: z.literal('noise') }),
  z.object({ kind: z.literal('raw') }),
  /**
   * Single-note sequence verification (SPEC v1.1 §10.10) over the range: times are seconds from the range
   * start; earlier notes (negative times allowed) may still ring; EXTRA onsets are counted in extraSpanS only.
   */
  z.object({
    kind: z.literal('sequence'),
    bpm: z.number().positive(),
    slots: z
      .array(
        z.object({
          time: z.number(),
          midi: z.number(),
          stringIdx: z.number().int().min(0).max(5).optional(),
          legatoAllowed: z.boolean().optional(),
          cycle: z.number().int().optional(),
        }),
      )
      .min(1),
    deltaCents: z.array(z.number()).length(6).optional(),
    priorNotes: z
      .array(
        z.object({ f0: z.number().positive(), stringIdx: z.number().int().optional(), time: z.number() }),
      )
      .default([]),
    extraSpanS: z.tuple([z.number(), z.number()]).optional(),
    /**
     * Speaker backing (E10 "반주와 함께", D-102): event arrivals (s from the range start), their template rises
     * and the bleed gain from the intro bar; onsets the mask calls bleed are not notes (§10.12).
     */
    backing: z
      .object({
        arrivalsS: z.array(z.number()),
        templateRises: z.array(z.number()),
        gain: z.number().min(0),
      })
      .optional(),
  }),
  /** Backing bleed gain from the intro bar (§10.12): arrivals in capture samples, templates of those events. */
  z.object({
    kind: z.literal('bleedGain'),
    arrivals: z.array(z.number()),
    templateRises: z.array(z.number()),
  }),
  /** Mode A fallback (src/dsp/take.ts energyOnset) when the flux detector found no pluck after arming. */
  z.object({
    kind: z.literal('pluck'),
    expectedF0: z.number().positive(),
    templateDecayRatio: z.number().optional(),
    strictness: strictness.default('lenient'),
    sensitivity: sensitivity.default('normal'),
    ringing,
    silent: z.boolean().default(false),
  }),
]);
export type RangeRequest = z.infer<typeof rangeRequestSchema>;

export const mainToWorkerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('config'), sampleRate: z.number().positive() }),
  z.object({ type: z.literal('job'), job: jobSchema.nullable() }),
  z.object({ type: z.literal('tuner'), enabled: z.boolean(), expectedF0: z.number().positive().nullable() }),
  z.object({ type: z.literal('analyzeRange'), id: z.number().int(), request: rangeRequestSchema }),
  /** Mode D: strums (context s) against the scheduled grid (SPEC §10.8). */
  z.object({
    type: z.literal('analyzeTiming'),
    id: z.number().int(),
    slots: z.array(z.object({ time: z.number(), expected: z.boolean() })),
    strumTimes: z.array(z.number()),
    rttS: z.number(),
    bpm: z.number().positive(),
    personalOffsetMs: z.number().nullable(),
  }),
]);
export type MainToWorker = z.infer<typeof mainToWorkerSchema>;

/** Result of a 'template' job: the Mode A measurement plus |H_h| / |H_1| for h = 1..8 over [+30, +130 ms]. */
/** Result of a 'pluck' range request: the fallback onset (offset in the range) and its Mode A judgement. */
export interface PluckFallbackResult {
  onsetOffset: number;
  pluck: PluckResult;
}

export interface TemplateResult {
  pluck: PluckResult;
  harmonics: number[];
}

export interface OnsetMessage {
  type: 'onset';
  /** Absolute capture sample of the refined (first-string) onset. */
  sample: number;
  strength: number;
  /** Job-specific judgement for this onset (null for 'onsets' jobs). */
  result: unknown;
  jobKind: Job['kind'] | null;
  detectorVersion: string;
  processingMs: number;
}

export interface TunerMessage {
  type: 'tuner';
  endSample: number;
  reading: { f0: number; midi: number; cents: number; clarity: number } | null;
  stableF0: number | null;
}

export interface RangeResultMessage {
  type: 'rangeResult';
  id: number;
  result: unknown;
  /** Raw samples, only for 'raw' requests (transferred). */
  samples?: Float32Array;
  detectorVersion: string;
  processingMs: number;
}

export interface TimingResultMessage {
  type: 'timingResult';
  id: number;
  result: TimingAnalysis;
  detectorVersion: string;
  processingMs: number;
}

export type WorkerToMain =
  | OnsetMessage
  | TunerMessage
  | RangeResultMessage
  | TimingResultMessage
  | { type: 'error'; message: string };
