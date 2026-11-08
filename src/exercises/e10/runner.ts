/**
 * E10 scale ladder (SPEC v1.1 §11.13): one cycle of a step (§6.8) per pass, one note per click. Four flawless
 * cycles in a row → +5 BPM; four in a row at ≥ 80 BPM graduate the step (the next step opens at 60); otherwise
 * it stays — a failed run never lowers the tempo, the learner picks it (D-098). Memorization = step 1 with the
 * TAB hidden throughout, four flawless cycles in a row at ≥ 60 BPM.
 *
 * "반주와 함께 1단계" on speakers (D-102): the bleed gain is learned from the backing's intro (the count-in bar) and
 * every judged chunk masks the backing events (§10.12), so a leaked chord tone is not a note the user played and
 * the run counts like one on earphones.
 *
 * The gain can only come from the backing playing alone: while the chunks wait for it nothing is judged, and a
 * chunk's own events are no substitute (they hold the user's notes, which would then read as the leak). A failed
 * measurement is asked again while the capture ring still holds the intro; without a gain the slots turn UNCLEAR
 * (SequenceTracker) and the screen says so (`gainLost`) until the next intro, after a resume, measures it again.
 */
import { z } from 'zod';
import {
  positionMidi,
  type ScaleShape,
  type ScaleStep,
  scaleById,
  scaleStepSequence,
} from '../../content/scales';
import {
  countsForCriteria,
  longestFlawlessRun,
  SCALE_GRADUATION_BPM,
  SCALE_MEMORIZE_MIN_BPM,
  SCALE_START_BPM,
  type ScaleResult,
  SEQUENCE_STREAK,
} from '../../domain/exerciseResults';
import { backingTemplateRises } from '../../dsp/backingMask';
import type { RenderedBacking } from '../../dsp/synth/backing';
import { sequenceLadder } from '../e17/runner';
import { type PlannedNote, SequenceRunner, type SequenceView } from '../sequence/runner';
import { type BackingRenderer, BLEED_PRE_S, BLEED_WINDOW_S } from '../song/runner';
import type { ExerciseContext, ExerciseMic } from '../types';

export const e10ParamsSchema = z.object({
  scaleId: z.enum(['em-pent-open', 'c-major-open', 'am-pent-pos1']),
  step: z.number().int().min(1).max(5).default(1),
  bpm: z.number().int().min(30).max(240).default(SCALE_START_BPM),
  tabHidden: z.boolean().default(false),
  /** "반주와 함께 1단계" (§11.13 step 6): same scoring as step 1. */
  withBacking: z.boolean().default(false),
  /** Earphone confirmation of the backing run (§8.6-1); on speakers the backing's bleed is masked (D-102). */
  earphones: z.boolean().default(false),
  /** Unused since D-098 (runs never step down); kept so stored params still parse. */
  previousLow: z.boolean().default(false),
  ladderBase: z.number().int().optional(),
  /** Seed of the random steps (2 and 3); each cycle derives its own. */
  seed: z.number().int().default(0),
  /** A review run of a graduated step (§7.5). */
  review: z.boolean().optional(),
});
export type E10Params = z.infer<typeof e10ParamsSchema>;

/** Measurements of one intro in all (the first and its retries). */
const BLEED_ATTEMPTS = 3;
const BLEED_RETRY_DELAY_S = 0.5;
/** A retry reads the intro again only while it is surely in the ~3.9 s capture ring: older audio reads as silence. */
const BLEED_RING_S = 3.7;

interface BleedMeasurement {
  request: Parameters<ExerciseMic['measureBleedGain']>[0];
  attempts: number;
  /** When to ask again (null = not failed, or no retry left). The ring is checked again when the time comes. */
  retryAt: number | null;
}

export interface E10View extends SequenceView {
  scale: ScaleShape;
  step: number;
  withBacking: boolean;
  earphones: boolean;
  backingAudible: boolean;
  /** This intro's bleed gain is out of reach: the slots turn UNCLEAR until a resume's intro measures it. */
  gainLost: boolean;
}

/** Backing chord of "반주와 함께 1단계": the scale's tonic chord (§11.13 step 6). */
export const SCALE_BACKING_CHORD: Record<E10Params['scaleId'], string> = {
  'em-pent-open': 'Em',
  'c-major-open': 'C',
  'am-pent-pos1': 'Am',
};

export class ScaleRunner extends SequenceRunner<ScaleResult, E10View> {
  private readonly scale: ScaleShape;
  private stopBacking: (() => void) | null = null;
  private backing: RenderedBacking | null = null;
  private earphones: boolean;
  /** Template rise of each backing event (computed once per rendered backing). */
  private templateRises: number[] | null = null;
  /** Backing events heard so far and still to come (audio-clock arrivals, grid + RTT) and their templates. */
  private maskArrivals: number[] = [];
  private maskRises: number[] = [];
  /** Bleed gain from an intro (null = not known: the chunks wait, see the file comment). */
  private bleedGain: number | null = null;
  /** Bumped when a pending bleed-gain answer must be ignored (paused in the count-in, a new intro). */
  private gainEpoch = 0;
  private measurement: BleedMeasurement | null = null;
  private gainLost = false;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E10Params,
    /** The song play-along renderer (chords per bar, pattern, bpm), reused for step 6. */
    private readonly renderBacking: BackingRenderer | null = null,
  ) {
    super(ctx, params.bpm, params.tabHidden, 1);
    this.scale = scaleById(params.scaleId);
    this.earphones = params.earphones;
  }

  /** Backing on speakers while the microphone judges: its bleed is masked (§10.12, D-102). */
  private get backingAudible(): boolean {
    return this.params.withBacking && this.source === 'mic' && !this.earphones;
  }

  /**
   * Step 6: the backing starts with the count-in bar and loops the tonic chord for a long while; after a pause
   * it starts again with the resume's count-in (D-085).
   */
  protected override onGrid(gridStart: number): void {
    if (!this.backing) return;
    const barS = (4 * 60) / this.bpm;
    const start = gridStart - barS;
    this.stopBacking = this.ctx.output.playBacking(this.backing.signal, start);
    this.own(() => this.stopBacking?.());
    if (this.backingAudible && this.ctx.audio) this.maskFrom(this.backing, start, gridStart);
  }

  /** Adds this backing's events to the mask; the first intro also measures the bleed gain (as the song does). */
  private maskFrom(backing: RenderedBacking, start: number, grid: number): void {
    const mic = this.ctx.audio;
    if (!mic) return;
    const fs = this.ctx.output.sampleRate();
    const rtt = (this.ctx.calibration?.rttMs ?? 0) / 1000;
    this.templateRises ??= backingTemplateRises(
      backing.signal,
      backing.events.map((e) => Math.round(e.time * fs)),
      fs,
    );
    const arrivals = backing.events.map((e) => start + e.time + rtt);
    this.maskArrivals.push(...arrivals);
    this.maskRises.push(...this.templateRises);
    if (this.bleedGain !== null) {
      this.applyMask(this.bleedGain);
      return;
    }
    // Intro events inside the capture ring: at slow tempos (≤ 61 BPM) the intro bar is longer than the ring.
    const barS = (4 * 60) / this.bpm;
    const from = Math.max(start + rtt - BLEED_PRE_S, grid + rtt - BLEED_WINDOW_S);
    const intro = backing.events.flatMap((e, i) =>
      e.time < barS - 1e-6 && arrivals[i]! >= from + BLEED_PRE_S ? [i] : [],
    );
    this.gainEpoch++;
    this.gainLost = false;
    this.maskBacking(null, true);
    this.measurement = {
      request: {
        from,
        to: grid + rtt,
        arrivals: intro.map((i) => arrivals[i]!),
        templateRises: intro.map((i) => this.templateRises![i]!),
      },
      attempts: 0,
      retryAt: null,
    };
    this.measure(mic, this.measurement);
  }

  private measure(mic: ExerciseMic, measurement: BleedMeasurement): void {
    const epoch = this.gainEpoch;
    measurement.attempts++;
    void mic
      .measureBleedGain(measurement.request)
      .then((gain) => this.gainMeasured(epoch, gain))
      .catch(() => this.gainFailed(epoch, measurement));
  }

  private gainMeasured(epoch: number, gain: number): void {
    if (this.isDisposed || epoch !== this.gainEpoch) return;
    this.bleedGain = gain;
    this.measurement = null;
    this.applyMask(gain);
  }

  private gainFailed(epoch: number, measurement: BleedMeasurement): void {
    if (this.isDisposed || epoch !== this.gainEpoch) return;
    const retryAt = this.ctx.output.now() + BLEED_RETRY_DELAY_S;
    const inRing = retryAt <= measurement.request.from + BLEED_RING_S;
    measurement.retryAt = measurement.attempts < BLEED_ATTEMPTS && inRing ? retryAt : null;
    if (measurement.retryAt === null) {
      this.gainLost = true;
      this.publish();
    }
  }

  override tick(): void {
    const measurement = this.measurement;
    const mic = this.ctx.audio;
    const now = this.ctx.output.now();
    if (mic && measurement?.retryAt != null && now >= measurement.retryAt) {
      measurement.retryAt = null;
      if (now <= measurement.request.from + BLEED_RING_S) {
        this.measure(mic, measurement);
      } else {
        // A late tick: the intro has left the ring and would read as silence, which the worker answers as gain 0.
        measurement.attempts++;
        this.gainFailed(this.gainEpoch, measurement);
      }
    }
    super.tick();
  }

  private applyMask(gain: number): void {
    this.maskBacking({ arrivals: [...this.maskArrivals], templateRises: [...this.maskRises], gain });
  }

  /** The backing stopped at `now`: events it will not play leave the mask (a resume adds its own). */
  private cutMask(now: number): void {
    if (this.maskArrivals.length === 0) return;
    const until = now + (this.ctx.calibration?.rttMs ?? 0) / 1000;
    const kept = this.maskArrivals.flatMap((t, i) => (t <= until ? [i] : []));
    this.maskArrivals = kept.map((i) => this.maskArrivals[i]!);
    this.maskRises = kept.map((i) => this.maskRises[i]!);
    if (this.bleedGain === null) {
      // Paused before the intro was heard in full: the next intro measures the gain again. The chunks keep waiting
      // either way — a gain still on its way can only help, and they are never judged without one.
      if (this.measurement && now < this.measurement.request.to) {
        this.gainEpoch++;
        this.measurement = null;
      }
      return;
    }
    this.applyMask(this.bleedGain);
  }

  protected override onPauseTake(): void {
    this.stopBacking?.();
    this.stopBacking = null;
    this.cutMask(this.ctx.output.now());
  }

  override command(cmd: Parameters<SequenceRunner<ScaleResult, E10View>['command']>[0]): void {
    // E confirms earphones before the backing run starts (§8.6-1).
    if (cmd === 'ear' && this.phase === 'ready' && this.params.withBacking) {
      this.earphones = !this.earphones;
      this.publish();
      return;
    }
    // Rendered before the count-in is scheduled, so the backing cannot start late (≈ 0.3 s to render).
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next') && this.params.withBacking)
      this.backing ??=
        this.renderBacking?.(Array(1 + 32).fill(SCALE_BACKING_CHORD[this.params.scaleId]), 'P0', this.bpm) ??
        null;
    super.command(cmd);
    if ((this.phase === 'review' || this.phase === 'done') && this.stopBacking) {
      this.stopBacking();
      this.stopBacking = null;
      this.cutMask(this.ctx.output.now());
    }
  }

  protected planCycle(k: number): PlannedNote[] {
    const order = scaleStepSequence(this.scale, this.params.step as ScaleStep, this.params.seed * 1009 + k);
    return order.map((i) => {
      const n = this.scale.notes[i]!;
      return { string: n.string, fret: n.fret, finger: n.finger, midi: positionMidi(n) };
    });
  }

  /** A review runs at the graduation tempo by definition (§7.5); other runs pick theirs (D-098). */
  protected override tempoPickable(): boolean {
    return this.params.review !== true;
  }

  protected view(): E10View {
    return {
      ...this.baseView(),
      scale: this.scale,
      step: this.params.step,
      withBacking: this.params.withBacking,
      earphones: this.earphones,
      backingAudible: this.backingAudible,
      gainLost: this.gainLost,
    };
  }

  effectiveParams(): E10Params {
    return { ...this.params, bpm: this.bpm, tabHidden: this.tabHidden, earphones: this.earphones };
  }

  finish(): ScaleResult {
    // A paused run (D-085) neither graduates nor proves memorization. A speaker backing run counts like any
    // other (its bleed is masked, D-102); `backingAudible` stays on the stored reference runs from before that.
    const pauses = this.pauses > 0 ? { pauses: this.pauses } : {};
    const counts = countsForCriteria(pauses);
    const run = counts ? longestFlawlessRun(this.cycleRecords) : 0;
    return {
      scaleId: this.scale.id,
      step: this.params.step,
      bpm: this.bpm,
      tabHidden: this.tabHidden,
      hiddenThroughout: this.hiddenThroughout,
      withBacking: this.params.withBacking,
      ...(this.params.review ? { review: true } : {}),
      cycles: [...this.cycleRecords],
      ladder: counts ? sequenceLadder(this.cycleRecords) : 'stay',
      graduated: run >= SEQUENCE_STREAK && this.bpm >= SCALE_GRADUATION_BPM,
      memorized:
        this.params.step === 1 &&
        this.hiddenThroughout &&
        run >= SEQUENCE_STREAK &&
        this.bpm >= SCALE_MEMORIZE_MIN_BPM,
      source: this.source,
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
      ...pauses,
    };
  }
}
