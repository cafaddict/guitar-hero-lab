/**
 * S practice song (SPEC v1.1 §11.10): chord chart in a bar grid with the current bar highlighted, count-in,
 * metronome, tempo (↑/↓), section loop (L), hidden chart (H), synth "listen" (M). Stages: learn (stop and retry;
 * a section can loop), perform (keep going) and hidden (perform with the chart covered from the count-in on; it
 * shows before the start to look over, D-082). In perform/hidden with
 * a microphone the beat-1 strums are timed and every run of two or more bars without one counts as a stop;
 * without a microphone the user reports the stops. Afterwards: played to the end, stops, played from memory.
 * P pauses (each pause is a stop; the interrupted bar is replayed after a one-bar count-in) and R starts the
 * song over (D-085).
 */
import { z } from 'zod';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import type { Job } from '../../audio/worker/protocol';
import type { PracticeSong } from '../../content/schemas';
import { songById } from '../../content/songs';
import { voicingById, voicingForClass } from '../../content/voicings';
import type { SongResult } from '../../domain/exerciseResults';
import { backingTemplateRises } from '../../dsp/backingMask';
import type { SetClassification } from '../../dsp/modeC';
import type { RenderedBacking } from '../../dsp/synth/backing';
import { timingWindowMs } from '../../dsp/timing';
import { BaseRunner } from '../baseRunner';
import { chordCorrectRatio } from '../e6/runner';
import { GridRecorder } from '../gridRecorder';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

/** Renders the play-along (one intro bar + the bars to play) at the device sample rate (§8.6). */
export type BackingRenderer = (chords: readonly string[], patternId: string, bpm: number) => RenderedBacking;

/** Audio kept before each intro event when the bleed gain is measured (pre-rise window + filter settling). */
export const BLEED_PRE_S = 0.1;
/** Longest span the bleed gain is measured over — inside the ~3.9 s capture ring (design value). */
export const BLEED_WINDOW_S = 3.5;

/** Output labels that are most likely Bluetooth (§8.6-1: "지연이 커요, 유선 이어폰 권장"). */
export function isBluetoothLabel(label: string): boolean {
  return /bluetooth|airpods|buds|\bbt\b/i.test(label);
}

export const songParamsSchema = z.object({
  songId: z.string().min(1),
  mode: z.enum(['learn', 'perform']),
  bpm: z.number().int().min(30).max(240),
  chartHidden: z.boolean(),
  /** Learn mode: loop this section index (null = whole song once). */
  loopSection: z.number().int().min(0).nullable(),
  /** Play-along backing (perform/hidden, SPEC v1.1 §8.6; B key). */
  backingOn: z.boolean().default(false),
  /** "이어폰(유선 권장)을 쓰고 있어요" — the backing cannot leak into the microphone. */
  earphones: z.boolean().default(false),
  /**
   * Last earphone choice per output device label from the song's recent history (§8.6-1). Only a fallback
   * now: the device settings' choice (`ctx.settings.earphonesByOutput`, D-101) comes first.
   */
  earphonesByOutput: z.record(z.string(), z.boolean()).default({}),
  /** No recent run of this song at this stage (D-082): the view says the stage went up. Set from history. */
  firstAtStage: z.boolean().default(false),
});
export type SongParams = z.infer<typeof songParamsSchema>;
/** Params as callers may give them (the v1.1 play-along fields have defaults). */
export type SongParamsInput = z.input<typeof songParamsSchema>;

export interface ChartBar {
  /** Position in the expanded chart (stable identity of a bar). */
  position: number;
  chord: string;
  section: number;
}

export type SongStageName = 'learn' | 'perform' | 'hidden';

/** Stage of a song run from its mode and chart setting (SPEC v1.1 §11.10). */
export function songStageOf(mode: SongParams['mode'], chartHidden: boolean): SongStageName {
  return mode === 'learn' ? 'learn' : chartHidden ? 'hidden' : 'perform';
}

/**
 * The routine raises a song's stage on its own (§11.10), so the first run at perform or hidden is announced
 * (D-082): true when none of the recent results is this song at this stage. v1 results carry no `stage`.
 */
export function firstRunAtStage(
  songId: string,
  stage: SongStageName,
  recent: readonly Pick<SongResult, 'songId' | 'mode' | 'chartHidden' | 'stage'>[],
): boolean {
  if (stage === 'learn') return false;
  return !recent.some(
    (r) => r.songId === songId && (r.stage ?? songStageOf(r.mode, r.chartHidden)) === stage,
  );
}

/** Stops (§11.10): every run of ≥ 2 consecutive bars whose beat-1 strum is missing. */
export function beat1Stops(beat1Hit: readonly boolean[]): number {
  return songStops(beat1Hit, []);
}

/**
 * Stops with pauses (D-085): `cutBars` are the bars a resume replayed from (one per counted pause). A pause is a
 * stop unless the silent bars just before it already made one; the count of silent bars starts over after it.
 */
export function songStops(beat1Hit: readonly boolean[], cutBars: readonly number[]): number {
  let stops = 0;
  let missing = 0;
  for (const [bar, hit] of beat1Hit.entries()) {
    for (const cut of cutBars) {
      if (cut !== bar) continue;
      if (missing < 2) stops += 1;
      missing = 0;
    }
    if (hit) {
      missing = 0;
      continue;
    }
    missing += 1;
    if (missing === 2) stops += 1;
  }
  return stops;
}

export const SONG_TEMPO_STEP = 5;

export interface SongView {
  song: PracticeSong;
  chart: ChartBar[];
  bpm: number;
  mode: SongParams['mode'];
  stage: SongStageName;
  chartHidden: boolean;
  loopSection: number | null;
  /** Index into `chart` (looping sections wrap). */
  bar: number | null;
  report: { completed: boolean; stops: number; memorized: boolean };
  analyzing: boolean;
  backingOn: boolean;
  earphones: boolean;
  /** Backing on speakers: the chord check is "참고" only (§8.6-3b). */
  backingAudible: boolean;
  outputLabel: string;
  chordCorrectRatio: number | null;
  /** First run of this song at the stage it was given (D-082); false once H switched the stage. */
  firstAtStage: boolean;
}

/** Bars with repeats expanded, in playing order. */
export function expandChart(song: PracticeSong): ChartBar[] {
  const bars = song.sections.flatMap((s, section) =>
    Array.from({ length: s.repeat }, () => s.bars.map((chord) => ({ chord, section }))).flat(),
  );
  return bars.map((bar, position) => ({ ...bar, position }));
}

export class SongRunner extends BaseRunner<SongResult, SongView> {
  private readonly song: PracticeSong;
  private readonly chart: ChartBar[];
  private playBars: ChartBar[];
  private barS: number;
  private bpm: number;
  private chartHidden: boolean;
  private loopSection: number | null;
  /** Stops counted from the beat-1 strums (perform/hidden with a microphone). */
  private autoStops: number | null = null;
  /** The chart was visible at some point while playing (the take then is not "hidden"). */
  private chartShownWhilePlaying = false;
  private recorder: GridRecorder | null = null;
  private bar: number | null = null;
  private readonly report = { completed: false, stops: 0, memorized: false };
  private beat1HitRate: number | null = null;
  private chordRatio: number | null = null;
  private analyzing = false;
  private scoreFailed = false;
  private backingOn: boolean;
  private earphones: boolean;
  private stopBacking: (() => void) | null = null;
  private songJob: Job | null = null;
  /** Bars a resume replayed from, one per counted pause (D-085). */
  private cuts: number[] = [];
  /** Bumped whenever the playing backing stops (pause, restart): a late bleed answer of it is ignored. */
  private backingEpoch = 0;
  /** Bleed gain measured from the first intro on speakers; a resumed backing reuses it (§10.12, D-085). */
  private bleedGain: number | null = null;
  /** Backing events in the worker's mask (audio-clock arrivals), to cut them at a pause. */
  private backingMask: { arrivals: number[]; templateRises: number[] } | null = null;
  /** Stops the "들어 보기" playback; null when none is playing. */
  private stopListen: (() => void) | null = null;
  /** Audio-clock time the listen playback (with its ring-out) ends. */
  private listenEndsAt = 0;

  private readonly params: SongParams;

  constructor(
    ctx: ExerciseContext,
    given: SongParamsInput,
    /** Synth renderer for "들어 보기" (chords, bpm, beats per bar) → samples; injected so tests stay fast. */
    private readonly renderListen: (
      chords: readonly string[],
      bpm: number,
      beatsPerBar: number,
    ) => Float32Array,
    private readonly renderBacking: BackingRenderer | null = null,
  ) {
    super(ctx);
    const params = songParamsSchema.parse(given);
    this.params = params;
    this.song = songById(params.songId);
    this.backingOn = params.mode === 'perform' && params.backingOn;
    this.earphones =
      ctx.settings.earphonesByOutput[this.outputLabel] ??
      params.earphonesByOutput[this.outputLabel] ??
      params.earphones;
    this.chart = expandChart(this.song);
    this.bpm = params.bpm;
    this.chartHidden = params.chartHidden;
    this.loopSection = params.mode === 'learn' ? params.loopSection : null;
    this.playBars = this.chart;
    this.barS = 0;
    this.layout();
  }

  private layout(): void {
    this.playBars =
      this.loopSection === null ? this.chart : this.chart.filter((b) => b.section === this.loopSection);
    const beats = this.song.timeSignature === '6/8' ? 2 : 4;
    this.barS = (beats * 60) / this.bpm;
  }

  /** The take counts as "hidden" (memorization, §7.6-5, §11.10) only if the chart stayed hidden while playing. */
  private get hiddenThroughout(): boolean {
    return this.chartHidden && !this.chartShownWhilePlaying;
  }

  private get outputLabel(): string {
    return this.ctx.calibration?.outputDeviceLabel ?? '';
  }

  /** The backing plays and can be heard by the microphone (speakers): chord accuracy is "참고" (§8.6-3). */
  private get backingAudible(): boolean {
    return this.backingOn && !this.earphones;
  }

  /** Tempo, chart, loop and backing as recorded for this run (option keys, SPEC v1.1 §12.3). */
  effectiveParams(): SongParams {
    return {
      ...this.params,
      bpm: this.bpm,
      chartHidden: this.hiddenThroughout,
      loopSection: this.loopSection,
      backingOn: this.backingOn,
      earphones: this.earphones,
    };
  }

  protected view(): SongView {
    const playIndex = this.bar === null ? null : this.bar % this.playBars.length;
    const chartIndex = playIndex === null ? null : this.chart.indexOf(this.playBars[playIndex]!);
    return {
      song: this.song,
      chart: this.chart,
      bpm: this.bpm,
      mode: this.params.mode,
      stage: songStageOf(this.params.mode, this.chartHidden),
      chartHidden: this.chartHidden,
      loopSection: this.loopSection,
      bar: chartIndex,
      report: { ...this.report },
      analyzing: this.analyzing,
      backingOn: this.backingOn,
      earphones: this.earphones,
      backingAudible: this.backingAudible,
      outputLabel: this.outputLabel,
      chordCorrectRatio: this.chordRatio,
      // About the stage the run was given: switching it with H drops the notice.
      firstAtStage: this.params.firstAtStage && this.chartHidden === this.params.chartHidden,
    };
  }

  /** Distinct chord classes of the bars to play (the chord check's candidates). */
  private chordClasses(): string[] {
    return [...new Set(this.playBars.map((b) => b.chord))];
  }

  /** With a microphone the song waits "armed": the first strum (or Space) starts the count-in (SPEC §12.3). */
  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(
        mic.onCoarseOnset((time) => {
          if (this.phase === 'armed' && !this.heardListen(time)) this.play();
        }),
      );
    }
    this.own(() => this.endListen());
    this.setPhase(mic ? 'armed' : 'ready');
  }

  /** "들어 보기" (key M): synthesized strums of the bars to play (first 8 bars at most). */
  private listen(): void {
    this.endListen();
    const beatsPerBar = this.song.timeSignature === '6/8' ? 2 : 4;
    const samples = this.renderListen(
      this.playBars.slice(0, 8).map((b) => b.chord),
      this.bpm,
      beatsPerBar,
    );
    try {
      this.stopListen = this.ctx.output.playSamples(samples);
    } catch {
      // Synth playback is refused while the microphone judges; there is nothing to stop then.
      return;
    }
    this.listenEndsAt = this.ctx.output.now() + samples.length / this.ctx.output.sampleRate();
  }

  /**
   * The listen synth leaks into the microphone on speakers: an onset that arrives while it plays (plus the
   * round trip) is the synth, not the user's first strum, and must not start the count-in off the beat.
   */
  private heardListen(onsetTime: number): boolean {
    if (!this.stopListen) return false;
    const rtt = (this.ctx.calibration?.rttMs ?? 0) / 1000;
    return onsetTime <= this.listenEndsAt + rtt;
  }

  private endListen(): void {
    this.stopListen?.();
    this.stopListen = null;
  }

  private play(): void {
    // The listen runs on its own start time, not the metronome grid: it must not play over the count-in.
    this.endListen();
    if (!this.chartHidden) this.chartShownWhilePlaying = true;
    this.recorder?.dispose();
    this.haltBacking();
    this.backingMask = null;
    this.cuts = [];
    this.scoreFailed = false;
    const looping = this.params.mode === 'learn' && this.loopSection !== null;
    const sixEight = this.song.timeSignature === '6/8';
    const perform = this.params.mode === 'perform';
    // The backing is rendered before the count-in is scheduled: rendering takes long enough (≈ 0.1–0.3 s) to
    // miss its start otherwise (§8.6). Its first bar is the intro under the count-in.
    const backing = this.renderBackingFrom(0);
    // Perform/hidden with a microphone: every strum also gets Mode C set scores for the chord check (§11.10).
    const voicings = this.chordClasses().map((c) =>
      voicingById(voicingForClass(c, this.ctx.content.gVoicing)),
    );
    this.songJob =
      perform && this.ctx.audio
        ? { kind: 'songStrum', voicings, deltaCents: this.ctx.calibration?.tuningCents }
        : null;
    this.recorder = new GridRecorder(
      perform ? this.ctx : { ...this.ctx, audio: null },
      {
        ...DEFAULT_METRONOME_CONFIG,
        bpm: sixEight ? this.bpm * 3 : this.bpm,
        meter: sixEight ? '6/8' : '4/4',
        countInBars: 1,
        stopAfterBars: looping ? null : this.playBars.length,
        visualOnly: this.ctx.settings.visualOnlyMetronome,
      },
      () => this.toReview(),
      (event) => this.recordDsp(event),
      this.songJob ?? { kind: 'onsets' },
      // The metronome counts eighths in 6/8: the window and the pause grace go by the song's own beat.
      { windowS: timingWindowMs(this.bpm) / 1000, graceS: 60 / this.bpm },
    );
    this.own(() => this.recorder?.dispose());
    this.own(() => this.stopBacking?.());
    this.setPhase('countIn');
    const epoch = this.backingEpoch;
    this.recorder.start(() => {
      if (backing) this.startBacking(backing, epoch);
      this.publish();
    });
  }

  /** The play-along for bars `from`… with an intro bar (bar `from`'s chord) under the count-in, or null. */
  private renderBackingFrom(from: number): RenderedBacking | null {
    if (this.params.mode !== 'perform' || !this.backingOn || !this.renderBacking) return null;
    const bars = this.playBars.slice(from);
    if (bars.length === 0) return null;
    return this.renderBacking([bars[0]!.chord, ...bars.map((b) => b.chord)], this.song.patternId, this.bpm);
  }

  private haltBacking(): void {
    this.stopBacking?.();
    this.stopBacking = null;
    this.backingEpoch++;
  }

  /**
   * Pause (D-085): the metronome and the backing stop, the backing events still to come leave the worker's mask
   * (the resumed grid is elsewhere), and the interrupted bar is the one to replay. Every counted pause is a stop.
   */
  protected override pauseTake(): { counted: boolean } | null {
    const recorder = this.recorder;
    if (!recorder) return null;
    const now = this.ctx.output.now();
    const outcome = recorder.pause(now);
    if (outcome.kind === 'ignored') return null;
    this.haltBacking();
    this.cutMask(now);
    if (outcome.counted) {
      this.cuts.push(outcome.resumeBar);
      this.report.stops++;
      this.bar = outcome.resumeBar;
    }
    return { counted: outcome.counted };
  }

  /** Resume: the backing from the replayed bar is rendered before the count-in is scheduled (§8.6). */
  protected override resumeTake(): void {
    const recorder = this.recorder;
    if (!recorder) return;
    const backing = this.renderBackingFrom(recorder.timeline.nextUnit);
    const epoch = this.backingEpoch;
    recorder.resume(() => {
      if (backing && epoch === this.backingEpoch) this.startBacking(backing, epoch);
      this.publish();
    });
  }

  private cutMask(now: number): void {
    const mask = this.backingMask;
    if (!mask || this.bleedGain === null) return;
    const until = now + (this.ctx.calibration?.rttMs ?? 0) / 1000;
    const kept = mask.arrivals.flatMap((t, i) => (t <= until ? [i] : []));
    this.applyMask(
      kept.map((i) => mask.arrivals[i]!),
      kept.map((i) => mask.templateRises[i]!),
      this.bleedGain,
    );
  }

  /** Points the worker's backing mask at these events (audio-clock arrivals). */
  private applyMask(arrivals: number[], templateRises: number[], gain: number): void {
    const mic = this.ctx.audio;
    const job = this.songJob;
    if (!mic || !this.recorder || !job || job.kind !== 'songStrum') return;
    this.backingMask = { arrivals, templateRises };
    this.recorder.updateJob({
      ...job,
      backing: { arrivals: arrivals.map((t) => mic.captureSampleOf(t)), templateRises, gain },
    });
  }

  /**
   * R (D-085): the take starts over from bar 0 (or the looped section's start). Perform/hidden forget the take
   * so far; learn keeps its stops and counts this one if the song was playing.
   */
  private restart(): void {
    if (this.params.mode === 'learn') {
      if (this.phase === 'running') this.report.stops++;
    } else {
      Object.assign(this.report, { completed: false, stops: 0, memorized: false });
      this.beat1HitRate = null;
      this.autoStops = null;
      this.chordRatio = null;
      this.analyzing = false;
      this.resetPauses();
      this.chartShownWhilePlaying = false;
    }
    this.bar = null;
    this.play();
  }

  /**
   * Schedules the backing so its intro bar is the count-in bar (§8.6). On speakers the bleed gain is learned
   * from that intro, then every strum is checked against the backing events (§10.12).
   */
  private startBacking(backing: RenderedBacking, epoch: number): void {
    const grid = this.recorder?.currentGrid ?? null;
    if (grid === null) return;
    const start = grid - this.barS;
    this.stopBacking = this.ctx.output.playBacking(backing.signal, start);
    const mic = this.ctx.audio;
    if (!mic || !this.backingAudible || !this.songJob || this.songJob.kind !== 'songStrum') return;
    const fs = this.ctx.output.sampleRate();
    const rtt = (this.ctx.calibration?.rttMs ?? 0) / 1000;
    const templateRises = backingTemplateRises(
      backing.signal,
      backing.events.map((e) => Math.round(e.time * fs)),
      fs,
    );
    const arrivals = backing.events.map((e) => start + e.time + rtt);
    // A resumed backing plays on the same output: the gain measured from the first intro still holds.
    if (this.bleedGain !== null) {
      this.applyMask(arrivals, templateRises, this.bleedGain);
      return;
    }
    // Intro events inside the capture ring: at slow tempos (≤ 61 BPM) the intro bar is longer than the ring.
    const from = Math.max(start + rtt - BLEED_PRE_S, grid + rtt - BLEED_WINDOW_S);
    const intro = backing.events.flatMap((e, i) =>
      e.time < this.barS - 1e-6 && arrivals[i]! >= from + BLEED_PRE_S ? [i] : [],
    );
    const recorder = this.recorder;
    if (!recorder) return;
    void mic
      .measureBleedGain({
        from,
        to: grid + rtt,
        arrivals: intro.map((i) => arrivals[i]!),
        templateRises: intro.map((i) => templateRises[i]!),
      })
      .then((gain) => {
        // Only the backing that asked (not a later take, not after a pause or leaving); the recorder ignores late
        // updates too.
        if (this.recorder !== recorder || epoch !== this.backingEpoch || this.phase === 'done') return;
        this.bleedGain = gain;
        this.applyMask(arrivals, templateRises, gain);
      })
      .catch(() => {
        // Without the gain the strums are judged unmasked; the chord check is "참고" anyway.
      });
  }

  private toReview(): void {
    this.bar = null;
    this.recorder?.stop();
    this.stopBacking?.();
    this.stopBacking = null;
    this.report.completed = this.recorder?.endTime !== null && this.loopSection === null;
    this.setPhase('review');
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.recorder?.stop();
      this.stopBacking?.();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.handlePause(cmd)) return;
    if (
      cmd === 'restart' &&
      (this.phase === 'countIn' || this.phase === 'running' || this.phase === 'paused')
    ) {
      this.restart();
      return;
    }
    const waiting = this.phase === 'ready' || this.phase === 'armed';
    // Play-along (perform/hidden only, §8.6): B switches the backing, E the earphone confirmation.
    if (waiting && this.params.mode === 'perform' && (cmd === 'backing' || cmd === 'ear')) {
      if (cmd === 'backing') this.backingOn = !this.backingOn;
      else this.earphones = !this.earphones;
      this.publish();
      return;
    }
    if (waiting && (cmd === 'toggle' || cmd === 'next')) {
      this.play();
      return;
    }
    if (cmd === 'hide' && this.phase !== 'review' && this.phase !== 'done') {
      this.chartHidden = !this.chartHidden;
      // Shown while paused counts as shown while playing (the take goes on afterwards, D-085).
      if (
        !this.chartHidden &&
        (this.phase === 'countIn' || this.phase === 'running' || this.phase === 'paused')
      )
        this.chartShownWhilePlaying = true;
      this.publish();
      return;
    }
    if ((waiting || (this.phase === 'review' && this.params.mode === 'learn')) && cmd === 'loop') {
      if (this.params.mode !== 'learn') return;
      const sections = this.song.sections.length;
      this.loopSection =
        this.loopSection === null ? 0 : this.loopSection + 1 < sections ? this.loopSection + 1 : null;
      this.layout();
      this.publish();
      return;
    }
    if (waiting && (cmd === 'inc' || cmd === 'dec')) {
      const step = cmd === 'inc' ? SONG_TEMPO_STEP : -SONG_TEMPO_STEP;
      this.bpm = Math.min(240, Math.max(this.song.bpmMin, this.bpm + step));
      this.layout();
      this.publish();
      return;
    }
    if (waiting && cmd === 'mark') {
      this.listen();
      return;
    }
    // Learn mode: "stop and try again" — Space in the review starts the song (or loop) over.
    if (this.phase === 'review' && this.params.mode === 'learn' && cmd === 'toggle') {
      this.play();
      return;
    }
    if ((this.phase === 'running' || this.phase === 'countIn') && cmd === 'toggle') {
      // Learn mode: stopping is fine (counted as a stop); perform mode ends the take.
      if (this.params.mode === 'learn') this.report.stops++;
      this.toReview();
      return;
    }
    if (this.phase !== 'review') return;
    if (cmd === 'manual1') this.report.completed = !this.report.completed;
    else if (cmd === 'manual2') this.report.memorized = !this.report.memorized;
    else if (cmd === 'inc') this.report.stops++;
    else if (cmd === 'dec') this.report.stops = Math.max(0, this.report.stops - 1);
    else if ((cmd === 'next' || (cmd === 'toggle' && this.params.mode === 'perform')) && !this.analyzing) {
      this.setPhase('done');
      return;
    }
    this.publish();
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    const rec = this.recorder;
    // The segment being played (D-085): after a pause its count-in comes first, on a new grid.
    const grid = rec?.currentGrid ?? null;
    if (rec && grid !== null && (this.phase === 'countIn' || this.phase === 'running')) {
      if (this.phase === 'countIn' && now >= grid) this.setPhase('running');
      // In a count-in the bar stays as it was: none at the start, the replayed one after a pause.
      const position = rec.timeline.position(now);
      const bar = position === null ? this.bar : Math.floor(position);
      if (bar !== this.bar) {
        this.bar = bar;
        this.publish();
      }
    }
    const mic = this.ctx.audio;
    if (
      mic &&
      rec &&
      rec.gridStart !== null &&
      this.params.mode === 'perform' &&
      this.phase === 'review' &&
      this.beat1HitRate === null &&
      !this.analyzing &&
      !this.scoreFailed &&
      rec.settled(now)
    ) {
      this.analyzing = true;
      // Each bar once, on the grid of the segment that played it (a replayed bar after a pause, D-085).
      const barStarts = rec.timeline.starts(this.playBars.length);
      // Strums judged as backing bleed are not the user's (§10.12); the rest also carry the chord scores.
      const strums = rec.events.filter((e) => this.isUserStrum(e));
      const cuts = [...this.cuts];
      void mic
        .analyzeTiming({
          slots: barStarts.map((time) => ({ time, expected: true })),
          strumTimes: strums.map((e) => e.time),
          rttS: rec.rttS,
          bpm: this.bpm,
          personalOffsetMs: this.ctx.personalOffsetMs ?? null,
        })
        .then((outcome) => {
          this.recordDsp(outcome);
          this.beat1HitRate = outcome.result.hitRate;
          // A bar is "played" when its beat-1 strum hit; pauses are stops too (merged, so a pause after two silent
          // bars is one stop). The user can still correct the count (↑/↓).
          this.autoStops = songStops(
            outcome.result.judgements.map((j) => j === 'hit'),
            cuts,
          );
          this.report.stops = this.autoStops;
          if (this.songJob)
            this.chordRatio = chordCorrectRatio(
              this.playBars.map((b) => b.chord),
              this.chordClasses(),
              strums.map((e) => ({
                ...e,
                result: (e.result as { set?: SetClassification } | null)?.set ?? null,
              })),
              barStarts,
              rec.rttS,
              timingWindowMs(this.bpm) / 1000,
              // The intro under a resume's count-in already plays the replayed bar's chord: no change to check.
              cuts,
            );
          this.analyzing = false;
          this.publish();
        })
        .catch(() => {
          // Without the beat-1 measurement the self-report is still recorded.
          this.analyzing = false;
          this.scoreFailed = true;
          this.publish();
        });
    }
  }

  private isUserStrum(event: JudgedEvent): boolean {
    if (event.jobKind !== 'songStrum') return true;
    return (event.result as { keep?: boolean } | null)?.keep !== false;
  }

  /** Recorded once the song was played (at least the count-in started). */
  hasResult(): boolean {
    return this.recorder !== null;
  }

  finish(): SongResult {
    return {
      songId: this.song.id,
      mode: this.params.mode,
      stage: songStageOf(this.params.mode, this.hiddenThroughout),
      chartHidden: this.hiddenThroughout,
      bpm: this.bpm,
      completed: this.report.completed,
      stops: this.report.stops,
      memorized: this.report.memorized,
      beat1HitRate: this.beat1HitRate,
      chordCorrectRatio: this.chordRatio,
      backingOn: this.backingOn,
      backingAudible: this.backingAudible,
      ...(this.outputLabel ? { outputLabel: this.outputLabel } : {}),
      ...(this.ctx.audio ? {} : { memorizedSelfReport: this.report.memorized }),
      ...(this.pauses > 0 ? { pauses: this.pauses } : {}),
    };
  }
}
