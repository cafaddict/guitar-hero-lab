/**
 * Binds the exercise contract (ExerciseMic / ExerciseOutput) to the real AudioEngine and MetronomeRuntime.
 */
import type { AudioEngine } from '../audio/engine';
import type { MetronomeRuntime } from '../audio/metronomeRuntime';
import type { PluckFallbackResult } from '../audio/worker/protocol';
import type { SequenceResult } from '../dsp/sequence';
import type { ExerciseMic, ExerciseOutput, JudgedEvent } from './types';

/** Seconds of audio the capture ring keeps (the fallback window must fit in it). */
const RING_S = 3.9;

export function createExerciseMic(engine: AudioEngine): ExerciseMic {
  return {
    setJob: (job) => engine.setJob(job),
    onJudged: (listener) =>
      engine.onset.on((o) =>
        listener({
          time: o.time,
          result: o.result,
          jobKind: o.jobKind,
          detectorVersion: o.detectorVersion,
          processingMs: o.processingMs,
        }),
      ),
    onCoarseOnset: (listener) => engine.coarseOnset.on((o) => listener(o.time)),
    setTuner: (enabled, expectedF0) => engine.setTuner(enabled, expectedF0),
    onTuner: (listener) =>
      engine.tuner.on((u) => listener({ f0: u.reading?.f0 ?? null, stableF0: u.stableF0 })),
    async pluckFallback(request): Promise<JudgedEvent | null> {
      const from = Math.max(request.from, request.to - RING_S);
      const outcome = await engine.analyzeRange(from, request.to, {
        kind: 'pluck',
        expectedF0: request.expectedF0,
        ...(request.templateDecayRatio === undefined
          ? {}
          : { templateDecayRatio: request.templateDecayRatio }),
        strictness: request.strictness,
        sensitivity: request.sensitivity ?? 'normal',
        ringing: (request.ringing ?? []).map((r) => ({ f0: r.f0, sample: engine.timeToSample(r.time) })),
        silent: request.silent ?? false,
      });
      const result = outcome.result as PluckFallbackResult | null;
      if (!result) return null;
      return {
        time: from + result.onsetOffset / engine.sampleRate,
        result: result.pluck,
        jobKind: 'pluck',
        detectorVersion: outcome.detectorVersion,
        processingMs: outcome.processingMs,
      };
    },
    analyzeTiming: (request) => engine.analyzeTiming(request),
    captureSampleOf: (time) => engine.timeToSample(time),
    async measureBleedGain(request) {
      const from = Math.max(request.from, request.to - RING_S);
      // An event before the captured range would read as "no rise" (gain 0): it is left out instead.
      const inside = request.arrivals.flatMap((t, i) => (t - 0.1 >= from ? [i] : []));
      const outcome = await engine.analyzeRange(from, request.to, {
        kind: 'bleedGain',
        arrivals: inside.map((i) => engine.timeToSample(request.arrivals[i]!)),
        templateRises: inside.map((i) => request.templateRises[i]!),
      });
      return (outcome.result as { gain: number }).gain;
    },
    async analyzeSequence(request) {
      const from = Math.max(request.from, request.to - RING_S);
      const rel = (t: number) => t - from;
      const outcome = await engine.analyzeRange(from, request.to, {
        kind: 'sequence',
        bpm: request.bpm,
        slots: request.slots.map((s) => ({ ...s, time: rel(s.time) })),
        ...(request.deltaCents ? { deltaCents: [...request.deltaCents] } : {}),
        priorNotes: request.priorNotes.map((n) => ({
          f0: n.f0,
          ...(n.stringIdx === undefined ? {} : { stringIdx: n.stringIdx }),
          time: rel(n.time),
        })),
        extraSpanS: [rel(request.extraSpan[0]), rel(request.extraSpan[1])],
        ...(request.backing
          ? {
              backing: {
                arrivalsS: request.backing.arrivals.map(rel),
                templateRises: [...request.backing.templateRises],
                gain: request.backing.gain,
              },
            }
          : {}),
      });
      const result = outcome.result as SequenceResult;
      const fs = engine.sampleRate;
      return {
        notes: result.notes.map(({ onsetSample, ...n }) =>
          onsetSample === undefined ? n : { ...n, onsetTime: from + onsetSample / fs },
        ),
        extras: result.extras.map((e) => from + e / fs),
        detectorVersion: outcome.detectorVersion,
        processingMs: outcome.processingMs,
      };
    },
  };
}

export function createExerciseOutput(engine: AudioEngine, metronome: MetronomeRuntime): ExerciseOutput {
  return {
    now: () => engine.context?.currentTime ?? 0,
    metronome: {
      start: (config, options) => metronome.start(config, options),
      stop: () => metronome.stop(),
      setBpm: (bpm) => metronome.setBpm(bpm),
      onClick: (listener) => metronome.click.on(listener),
      onEnd: (listener) => metronome.end.on(listener),
      gridStartTime: () => metronome.gridStartTime,
    },
    playSamples: (samples) => {
      const node = engine.playSynth(samples);
      return () => {
        try {
          node.stop();
        } catch {
          // Already ended.
        }
      };
    },
    cue: () => {
      const now = engine.context?.currentTime ?? 0;
      engine.scheduleClick(now + 0.05, 'accent');
      engine.scheduleClick(now + 0.2, 'accent');
    },
    sampleRate: () => engine.sampleRate,
    playBacking: (samples, at) => {
      const node = engine.scheduleBacking(samples, at);
      return () => {
        try {
          node.stop();
        } catch {
          // Already stopped or never started.
        }
      };
    },
  };
}
