/**
 * Result schemas and pure metric extraction for every v1 exercise type (SPEC §11.2).
 * Plugins (features/exercises) reuse these so that rebuildDerived() can recompute metrics from attempts
 * without loading any UI code.
 */
import { z } from 'zod';
import { pairDirKey, pairKey, parseDirected } from './pairs';
import type { MetricSampleInput } from './records';

export const stringStatusSchema = z.enum([
  'OK',
  'MUTED',
  'WRONG_NOTE',
  'UNEXPECTED',
  'WEAK',
  'UNVERIFIABLE',
  'NOT_PLAYED',
]);
export type StringStatusValue = z.infer<typeof stringStatusSchema>;
export const selfStringStatusSchema = z.enum(['clean', 'muted', 'buzz']);

export const tuningResultSchema = z.object({
  strings: z.array(z.object({ idx: z.number().int(), cents: z.number().nullable(), inTune: z.boolean() })),
  complete: z.boolean(),
  durationMs: z.number(),
});

export const chordCheckAttemptSchema = z.object({
  perString: z.array(
    z.object({
      idx: z.number().int(),
      status: stringStatusSchema.nullable(),
      selfStatus: selfStringStatusSchema.nullable(),
      cents: z.number().nullable(),
      confidence: z.number(),
      semitones: z.number().nullable(),
    }),
  ),
  clean: z.boolean(),
  strumVerdict: z.enum(['PASS', 'FAIL', 'RETRY']).nullable(),
  /** Ear-first: share of strings where self-judgement matched the app (null when not in ear-first mode). */
  selfAgreement: z.number().nullable(),
  /** Mode of this attempt when the mode was changed during the run (SPEC v1.1 §11.3); absent = the run's mode. */
  mode: z.enum(['pluck', 'strum', 'manual']).optional(),
});
export const chordCheckResultSchema = z.object({
  voicingId: z.string(),
  mode: z.enum(['pluck', 'strum', 'manual']),
  earFirst: z.boolean(),
  attempts: z.array(chordCheckAttemptSchema),
  cleanRatio: z.number(),
});

export const oneMinuteResultSchema = z.object({
  pair: z.string(),
  direction: z.string(),
  durationMs: z.number().positive(),
  countMode: z.enum(['auto', 'tap', 'manual']),
  detectedChanges: z.number().int().min(0),
  correctedChanges: z.number().int().min(0).nullable(),
  tapChanges: z.number().int().min(0).nullable(),
  lowConfidenceEvents: z.number().int().min(0),
  changeTimestampsMs: z.array(z.number()),
});

export const anchorDrillResultSchema = z.object({
  pair: z.string(),
  kind: z.enum(['anchor', 'air']),
  durationMs: z.number(),
  selfReportSuccess: z.number().int().min(0).max(10).nullable(),
});

export const strumResultSchema = z.object({
  patternId: z.string(),
  bpm: z.number(),
  bars: z.number().int(),
  mode: z.enum(['mute', 'single', 'progression']),
  hits: z.number().int(),
  misses: z.number().int(),
  extras: z.number().int(),
  meanOffsetMs: z.number().nullable(),
  sdOffsetMs: z.number().nullable(),
  hitRate: z.number(),
  hitRateCorrected: z.number(),
  cuesHidden: z.boolean(),
  /** Ladder decision taken from this run. */
  ladder: z.enum(['up', 'down', 'stay']),
  passed: z.boolean(),
  source: z.enum(['mic', 'self']),
  /** Dynamics mode (SPEC v1.1 §11.6): the user's own rating 1 clear / 2 a little / 3 not heard (null = skipped). */
  dynamics: z
    .object({ selfRating: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable() })
    .optional(),
  /** Palm-mute run (Stage 10). */
  palmMute: z.boolean().optional(),
  /** Beta detector readings (SPEC v1.1 §10.11) — reported, never turned into metrics. */
  beta: z.record(z.string(), z.unknown()).optional(),
  /** Ladder tempo kept during a −10 BPM prescription (SPEC v1.1 §7.4). */
  ladderBase: z.number().optional(),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

export const oneBeatResultSchema = z.object({
  progression: z.array(z.string()),
  patternId: z.string(),
  bpm: z.number(),
  bars: z.number().int(),
  barsInWindow: z.number().int(),
  stops: z.number().int(),
  beat1DelayMsMean: z.number().nullable(),
  missingBarRatio: z.number(),
  passed: z.boolean(),
  source: z.enum(['mic', 'self']),
  /** Mode C two-way check per chord-changing bar (SPEC v1.1 §11.7; null = not measured). */
  chordCorrectRatio: z.number().nullable().optional(),
  /** Ladder tempo kept during a −10 BPM prescription (SPEC v1.1 §7.4). */
  ladderBase: z.number().optional(),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

export const stretchResultSchema = z.object({
  startFret: z.number().int(),
  durationMs: z.number(),
  pain: z.number().int().min(0).max(10).nullable(),
});

export const altPickResultSchema = z.object({
  stringIdx: z.number().int(),
  bpm: z.number(),
  bars: z.number().int(),
  hitRate: z.number(),
  ioiCv: z.number().nullable(),
  passed: z.boolean(),
  source: z.enum(['mic', 'self']),
  /** Ladder tempo kept during a −10 BPM prescription (SPEC v1.1 §7.4). */
  ladderBase: z.number().optional(),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

export const quizResultSchema = z.object({
  questions: z.number().int().min(1),
  correct: z.number().int().min(0),
  meanReactionMs: z.number().nullable(),
  /** Per-question knowledge-card answers (SPEC v1.1 §7.5: Q3 note cards, Q4 question-type cards). */
  items: z
    .array(z.object({ card: z.string(), correct: z.boolean(), reactionMs: z.number().nullable() }))
    .optional(),
  /** Q3 range / Q4 kind (SPEC v1.1 §11.15, §11.21); absent on v1 results = open strings / major-minor. */
  scope: z.enum(['open', 'openPosition', 'strings65']).optional(),
  kind: z.enum(['majmin', 'interval', 'progression']).optional(),
});

export const recallResultSchema = z.object({
  items: z.array(
    z.object({
      chordClass: z.string(),
      voicingId: z.string(),
      correct: z.boolean(),
      reactionMs: z.number().nullable(),
      method: z.enum(['mic', 'self']),
    }),
  ),
});

export const songResultSchema = z.object({
  songId: z.string(),
  mode: z.enum(['learn', 'perform']),
  chartHidden: z.boolean(),
  bpm: z.number(),
  completed: z.boolean(),
  stops: z.number().int().min(0),
  memorized: z.boolean(),
  beat1HitRate: z.number().nullable(),
  /** v1.1 (§11.10): learn / perform / hidden (absent on v1 results: derived from mode and chartHidden). */
  stage: z.enum(['learn', 'perform', 'hidden']).optional(),
  /** Mode C two-way chord check per bar (perform/hidden with a microphone; null when not measured). */
  chordCorrectRatio: z.number().nullable().optional(),
  /** Play-along on; on speakers (not earphones) the chord check is "참고" only (§8.6). */
  backingOn: z.boolean().optional(),
  backingAudible: z.boolean().optional(),
  /** Without a microphone the hidden-chart completion is self-reported (§7.6-5). */
  memorizedSelfReport: z.boolean().optional(),
  /** Output device of the run (the earphone choice is remembered per device, §8.6-1). */
  outputLabel: z.string().optional(),
  /** Pauses of the run (D-085): each one is a stop (already in `stops`), so the run still counts. */
  pauses: z.number().int().min(0).optional(),
});

export const examResultSchema = z.object({
  item: z.enum(['1', '2', '3', '4', '5']),
  passed: z.boolean(),
  detail: z.record(z.string(), z.unknown()),
});

/** K1 self-check cards (SPEC v1.1 §11.12): "됐어요 / 아직" per item, no score. */
export const selfCheckResultSchema = z.object({
  items: z.array(z.object({ id: z.string(), status: z.enum(['done', 'notYet']) })).min(1),
});

/** E16 fret-position comparison (SPEC v1.1 §11.18): the same note plucked at three positions, no pass/fail. */
export const fretPositionResultSchema = z.object({
  positions: z.array(
    z.object({
      pos: z.enum(['behind', 'middle', 'onFret']),
      statuses: z.array(z.enum(['OK', 'WEAK', 'MUTED', 'WRONG_NOTE', 'clean', 'muted', 'buzz'])),
      clarity: z.number().nullable(),
      decayRatio: z.number().nullable(),
      /** Plucks the beta buzz detector suspected ("참고(베타)", microphone runs). */
      buzzSuspect: z.number().int().min(0).optional(),
    }),
  ),
  source: z.enum(['mic', 'self']),
});

/** One cycle of a single-note sequence exercise (SPEC v1.1 §10.10): flawless, uncertain, or with mistakes. */
export const sequenceCycleSchema = z.object({
  flawless: z.boolean(),
  uncertain: z.boolean(),
  stops: z.number().int().min(0),
  /** Share of OK notes (null when self-reported). */
  okRatio: z.number().nullable(),
  /** Microphone runs: share of slots with a matched onset, EXTRA onsets, and every note that was not OK. */
  hitRate: z.number().optional(),
  extras: z.number().int().min(0).optional(),
  faults: z
    .array(
      z.object({
        index: z.number().int().min(0),
        status: z.enum(['WRONG_NOTE', 'UNCLEAR', 'MISSED']),
        semitones: z.number().int().optional(),
      }),
    )
    .optional(),
  /** First cycle played after a pause (D-085): a flawless streak starts over here. */
  resumed: z.boolean().optional(),
});

/** E10 scale ladder (SPEC v1.1 §11.13). */
export const scaleResultSchema = z.object({
  scaleId: z.string(),
  step: z.number().int().min(1).max(5),
  bpm: z.number(),
  tabHidden: z.boolean(),
  /** TAB hidden for the whole run (memorization, §11.13). */
  hiddenThroughout: z.boolean(),
  /** "반주와 함께 1단계" option (§11.13 step 6). */
  withBacking: z.boolean(),
  /**
   * Stored by runs before D-102 only: true = the backing played on speakers without masking — a reference run that
   * records nothing. Runs since then mask the bleed (D-102), count like any other and leave this out.
   */
  backingAudible: z.boolean().optional(),
  /** A review run of a graduated step (§7.5): it does not move the scale's step or ladder. */
  review: z.boolean().optional(),
  cycles: z.array(sequenceCycleSchema),
  ladder: z.enum(['up', 'down', 'stay']),
  /** 4 flawless cycles in a row at ≥ SCALE_GRADUATION_BPM: the step is graduated. */
  graduated: z.boolean(),
  /** Step 1 with the TAB hidden throughout, 4 flawless cycles in a row at ≥ 60 BPM. */
  memorized: z.boolean(),
  source: z.enum(['mic', 'self']),
  ladderBase: z.number().optional(),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

/** E9 chromatic 1-2-3-4 (SPEC v1.1 §11.14): one cycle = one four-note group. */
export const chromaticResultSchema = z.object({
  startFret: z.number().int().min(1).max(12),
  bpm: z.number(),
  cycles: z.array(sequenceCycleSchema),
  ladder: z.enum(['up', 'down', 'stay']),
  source: z.enum(['mic', 'self']),
  hitRate: z.number().nullable(),
  okRatio: z.number().nullable(),
  ioiCv: z.number().nullable(),
  ladderBase: z.number().optional(),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

export const HAMMER_PAIRS = ['1-2', '1-3', '1-4', '2-3', '2-4', '3-4'] as const;

/** E11 hammer-on finger gym (SPEC v1.1 §11.16): picked notes judged, hammer-ons as legato beta. */
export const hammerResultSchema = z.object({
  pair: z.enum(HAMMER_PAIRS),
  bpm: z.number(),
  cycles: z.array(sequenceCycleSchema),
  source: z.enum(['mic', 'self']),
  /** Picked notes with a matched onset (null without a microphone). */
  pickedHitRate: z.number().nullable(),
  /** Legato beta: hammer-ons heard (HAMMER_OK or OK) of all hammer slots — "참고(베타)", never a score. */
  legatoBeta: z.object({ heard: z.number().int().min(0), total: z.number().int().min(0) }).nullable(),
  /** "간격이 고르게 들렸나요" 1–3 (null when skipped). */
  evenRating: z.number().int().min(1).max(3).nullable(),
  ladder: z.enum(['up', 'stay']),
  durationMs: z.number().min(0),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

/** E12 pinky exercise (SPEC v1.1 §11.17): completion and clarity self-report, no speed score. */
export const pinkyResultSchema = z.object({
  completed: z.boolean(),
  clarity: z.number().int().min(1).max(3).nullable(),
  pain: z.number().min(0).max(10).nullable(),
  durationMs: z.number().min(0),
});

/** E3 precise fast change (SPEC v1.1 §11.11). */
export const pfcResultSchema = z.object({
  pair: z.string(),
  direction: z.string(),
  durationMs: z.number().min(0),
  arrivals: z.number().int().min(0),
  cleanArrivals: z.number().int().min(0),
  source: z.enum(['mic', 'self']),
  /** Mode B per arrival, "참고(베타)" only. */
  strumBeta: z.array(z.enum(['PASS', 'FAIL', 'RETRY'])).optional(),
});

/** E17 single-note riff (SPEC v1.1 §11.19): ladder over flawless cycles. */
export const riffResultSchema = z.object({
  riffId: z.string(),
  bpm: z.number(),
  tabHidden: z.boolean(),
  cycles: z.array(sequenceCycleSchema),
  ladder: z.enum(['up', 'down', 'stay']),
  source: z.enum(['mic', 'self']),
  /** Ladder tempo kept during a −10 BPM prescription (SPEC v1.1 §7.4). */
  ladderBase: z.number().optional(),
  /** Counted pauses (D-085; written only when > 0): see countsForCriteria. */
  pauses: z.number().int().min(0).optional(),
});

export type TuningResult = z.infer<typeof tuningResultSchema>;
export type ChordCheckResult = z.infer<typeof chordCheckResultSchema>;
export type ChordCheckAttempt = z.infer<typeof chordCheckAttemptSchema>;
export type OneMinuteResult = z.infer<typeof oneMinuteResultSchema>;
export type AnchorDrillResult = z.infer<typeof anchorDrillResultSchema>;
export type StrumResult = z.infer<typeof strumResultSchema>;
export type OneBeatResult = z.infer<typeof oneBeatResultSchema>;
export type StretchResult = z.infer<typeof stretchResultSchema>;
export type AltPickResult = z.infer<typeof altPickResultSchema>;
export type QuizResult = z.infer<typeof quizResultSchema>;
export type RecallResult = z.infer<typeof recallResultSchema>;
export type SongResult = z.infer<typeof songResultSchema>;
export type ExamResult = z.infer<typeof examResultSchema>;
export type SelfCheckResult = z.infer<typeof selfCheckResultSchema>;
export type FretPositionResult = z.infer<typeof fretPositionResultSchema>;
export type SequenceCycle = z.infer<typeof sequenceCycleSchema>;
export type RiffResult = z.infer<typeof riffResultSchema>;
export type ScaleResult = z.infer<typeof scaleResultSchema>;
export type ChromaticResult = z.infer<typeof chromaticResultSchema>;
export type HammerResult = z.infer<typeof hammerResultSchema>;
export type PinkyResult = z.infer<typeof pinkyResultSchema>;
export type PfcResult = z.infer<typeof pfcResultSchema>;

/** E10 step graduation tempo and ladder edges (SPEC v1.1 §11.13, design values). */
export const SCALE_GRADUATION_BPM = 80;
export const SCALE_START_BPM = 60;
export const SCALE_MEMORIZE_MIN_BPM = 60;
/** Flawless cycles in a row that move a sequence ladder up (E10, E17) and graduate/memorize (E10). */
export const SEQUENCE_STREAK = 4;
/** E9 (§11.14): 10 flawless groups in a row → +5; goal 100 BPM; default start fret 5. */
export const CHROMATIC_STREAK = 10;
export const CHROMATIC_GOAL_BPM = 100;
export const CHROMATIC_START_FRET = 5;
/** E11 (§11.16): start 60, cap 80; picked hit_rate ≥ 0.9 and an even rating of 3 → +5. */
export const HAMMER_MAX_BPM = 80;
export const HAMMER_PICKED_HIT_RATE = 0.9;
/** E3 pass (§11.11, 01:296): clean_rate ≥ 0.8 and ≥ 20 clean changes per minute; graduation = 2 days. */
export const PFC_CLEAN_RATE = 0.8;
export const PFC_CLEAN_PER_MIN = 20;
export const PFC_GRADUATION_DAYS = 2;

export function pfcScores(r: Pick<PfcResult, 'arrivals' | 'cleanArrivals' | 'durationMs'>) {
  const minutes = r.durationMs / 60_000;
  const cleanPerMin = minutes > 0 ? r.cleanArrivals / minutes : 0;
  const cleanRate = r.arrivals > 0 ? r.cleanArrivals / r.arrivals : 0;
  return { cleanPerMin, cleanRate, passed: cleanRate >= PFC_CLEAN_RATE && cleanPerMin >= PFC_CLEAN_PER_MIN };
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Mean OK ratio and hit rate over judged (microphone) cycles. */
export function sequenceRates(cycles: readonly SequenceCycle[]): {
  okRatio: number | null;
  hitRate: number | null;
} {
  return {
    okRatio: mean(cycles.flatMap((c) => (c.okRatio === null ? [] : [c.okRatio]))),
    hitRate: mean(cycles.flatMap((c) => (c.hitRate === undefined ? [] : [c.hitRate]))),
  };
}

/**
 * A run with a pause is recorded and analysed but does not count for criteria (D-085, after SPEC v1.1 §7.1 E2
 * "중간 중단 실행은 기록하되 기준에 쓰지 않는다"): no ladder step, pass, graduation, memorization or streak tempo.
 * Songs are exempt (a pause there is a stop).
 */
export function countsForCriteria(r: { pauses?: number | undefined }): boolean {
  return (r.pauses ?? 0) === 0;
}

/**
 * Longest run of flawless cycles (uncertain cycles neither extend nor break it; a cycle after a pause starts a
 * new run, D-085).
 */
export function longestFlawlessRun(
  cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain' | 'resumed'>[],
): number {
  let best = 0;
  let n = 0;
  for (const c of cycles) {
    if (c.resumed) n = 0;
    if (c.flawless) best = Math.max(best, ++n);
    else if (!c.uncertain) n = 0;
  }
  return best;
}

/** Song stage thresholds (SPEC v1.1 §11.10). */
export const SONG_COMPLETE_MAX_STOPS = 2;
export const SONG_MEMORIZED_MAX_STOPS = 1;

/** A Q3 range graduation run (SPEC v1.1 §11.15): 20 questions, median answer under 3 s. */
export const QUIZ_RUN_QUESTIONS = 20;
export const QUIZ_RUN_MEDIAN_MS = 3000;

/** Recall must be answered within this time to count as a pass (SPEC §7.1, §7.6-2). */
export const RECALL_LIMIT_MS = 3000;

/**
 * Only runs of at least 55 s count toward per-minute criteria (SPEC v1.1 §7.1 "쌍 ≥30", §11.4): pain-reduced
 * 30 s runs and runs stopped early are stored but never scaled up into a pass.
 */
export const QUALIFIED_RUN_MS = 55_000;
export const LADDER_STEP = 5;
const BPM_MIN = 30;
const BPM_MAX = 240;

/** Tempo the ladder starts from next time after a run (SPEC v1.1 §7.4 "사다리 현재 BPM"). */
export function ladderNextBpm(bpm: number, ladder: 'up' | 'down' | 'stay'): number {
  const next = ladder === 'up' ? bpm + LADDER_STEP : ladder === 'down' ? bpm - LADDER_STEP : bpm;
  return Math.min(BPM_MAX, Math.max(BPM_MIN, next));
}

/** The ladder after a run; a run slowed by a −10 BPM prescription keeps at least the ladder it started from. */
function storedLadder(bpm: number, ladder: 'up' | 'down' | 'stay', base: number | undefined): number {
  const next = ladderNextBpm(bpm, ladder);
  return base === undefined ? next : Math.max(base, next);
}

/** Changes per minute from a one-minute-change result: corrected ?? tap/detected, scaled to 60 s. */
export function changesPerMinute(r: OneMinuteResult): number {
  const raw = r.correctedChanges ?? (r.countMode === 'tap' ? (r.tapChanges ?? 0) : r.detectedChanges);
  return (raw * 60_000) / r.durationMs;
}

const m = (subjectKey: string, metric: string, value: number): MetricSampleInput => ({
  subjectKey,
  metric,
  value,
});

type Extractor = (result: unknown) => MetricSampleInput[];

/** Pure metric extractors per exercise type (SPEC §11.2 "핵심 지표(subjectKey)"). */
export const METRIC_EXTRACTORS: Readonly<Record<string, Extractor>> = {
  E0: (raw) => {
    const r = tuningResultSchema.parse(raw);
    return [m('tuning:session', 'complete', r.complete ? 1 : 0)];
  },
  E1: (raw) => {
    const r = chordCheckResultSchema.parse(raw);
    const key = `chord:${r.voicingId}`;
    const out: MetricSampleInput[] = [];
    for (const attempt of r.attempts) {
      const mode = attempt.mode ?? r.mode;
      if (mode === 'strum') {
        if (attempt.strumVerdict) out.push(m(key, 'strumPass', attempt.strumVerdict === 'PASS' ? 1 : 0));
        continue;
      }
      out.push(m(key, 'clean', attempt.clean ? 1 : 0));
      for (const s of attempt.perString) {
        const judged = mode === 'manual' ? s.selfStatus : s.status;
        if (judged === null || judged === 'WEAK' || judged === 'NOT_PLAYED' || judged === 'UNVERIFIABLE')
          continue;
        const ok = judged === 'OK' || judged === 'clean';
        out.push(m(`chordstring:${r.voicingId}:${s.idx}`, 'clean', ok ? 1 : 0));
      }
      if (attempt.selfAgreement !== null) out.push(m(key, 'selfAgreement', attempt.selfAgreement));
    }
    return out;
  },
  E2: (raw) => {
    const r = oneMinuteResultSchema.parse(raw);
    const cpm = changesPerMinute(r);
    const [from, to] = parseDirected(r.direction);
    const out = [m(pairDirKey(from, to), 'cpm', cpm), m(pairKey(from, to), 'cpm', cpm)];
    if (r.durationMs >= QUALIFIED_RUN_MS)
      out.push(m(pairDirKey(from, to), 'cpmQualified', cpm), m(pairKey(from, to), 'cpmQualified', cpm));
    return out;
  },
  E4: (raw) => {
    const r = anchorDrillResultSchema.parse(raw);
    const out = [m(`pair:${r.pair}`, 'drill', 1)];
    if (r.selfReportSuccess !== null) out.push(m(`pair:${r.pair}`, 'airSuccess', r.selfReportSuccess / 10));
    return out;
  },
  E5: (raw) => {
    const r = strumResultSchema.parse(raw);
    const base = `strum:${r.patternId}`;
    const out = [m(base, 'hitRate', r.hitRate), m(`${base}:${r.mode}`, 'hitRate', r.hitRate)];
    if (r.sdOffsetMs !== null) out.push(m(base, 'sdOffsetMs', r.sdOffsetMs));
    if (r.meanOffsetMs !== null) out.push(m(base, 'meanOffsetMs', r.meanOffsetMs));
    if (r.passed) {
      out.push(m(base, 'passBpm', r.bpm), m(`${base}:${r.mode}`, 'passBpm', r.bpm));
      if (r.cuesHidden) out.push(m(`${base}:hidden`, 'passBpm', r.bpm));
    }
    if (r.dynamics?.selfRating) out.push(m('strum:dynamics', 'selfRating', r.dynamics.selfRating));
    out.push(m(`${base}:${r.mode}`, 'ladderBpm', storedLadder(r.bpm, r.ladder, r.ladderBase)));
    return out;
  },
  E6: (raw) => {
    const r = oneBeatResultSchema.parse(raw);
    const key = `onebeat:${r.progression.join('-')}`;
    const out = [m(key, 'barSuccess', r.bars > 0 ? r.barsInWindow / r.bars : 0)];
    if (r.passed) out.push(m(key, 'passBpm', r.bpm));
    out.push(m(key, 'ladderBpm', storedLadder(r.bpm, r.passed ? 'up' : 'stay', r.ladderBase)));
    if (typeof r.chordCorrectRatio === 'number') out.push(m(key, 'chordCorrect', r.chordCorrectRatio));
    return out;
  },
  E7: (raw) => {
    const r = stretchResultSchema.parse(raw);
    const out = [m('stretch', 'startFret', r.startFret)];
    if (r.pain !== null) out.push(m('stretch', 'pain', r.pain));
    return out;
  },
  E8: (raw) => {
    const r = altPickResultSchema.parse(raw);
    const key = `altpick:${r.stringIdx}`;
    const out = [m(key, 'hitRate', r.hitRate)];
    if (r.ioiCv !== null) out.push(m(key, 'ioiCv', r.ioiCv));
    if (r.passed) out.push(m(key, 'passBpm', r.bpm), m('altpick:any', 'passBpm', r.bpm));
    out.push(m(key, 'ladderBpm', storedLadder(r.bpm, r.passed ? 'up' : 'stay', r.ladderBase)));
    return out;
  },
  Q1: (raw) => {
    const r = quizResultSchema.parse(raw);
    return [m('quiz:diagram', 'accuracy', r.correct / r.questions)];
  },
  Q2: (raw) => {
    const r = recallResultSchema.parse(raw);
    return r.items.flatMap((item) => {
      const pass = item.correct && item.reactionMs !== null && item.reactionMs <= RECALL_LIMIT_MS;
      const out = [m(`recall:${item.chordClass}`, 'pass', pass ? 1 : 0)];
      if (item.reactionMs !== null) out.push(m(`recall:${item.chordClass}`, 'reactionMs', item.reactionMs));
      return out;
    });
  },
  Q3: (raw) => {
    const r = quizResultSchema.parse(raw);
    const scope = r.scope ?? 'open';
    const accuracy = r.correct / r.questions;
    const out = [m(`quiz:notes:${scope}`, 'accuracy', accuracy)];
    if (scope === 'open') out.push(m('quiz:opennotes', 'accuracy', accuracy));
    // A "range graduation" run (SPEC v1.1 §11.15): ≥ 20 questions, median answer under 3 s.
    const times = (r.items ?? []).map((i) => i.reactionMs).filter((t): t is number => t !== null);
    const medianMs = times.length ? [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]! : null;
    if (r.questions >= QUIZ_RUN_QUESTIONS && medianMs !== null && medianMs < QUIZ_RUN_MEDIAN_MS)
      out.push(m(`quiz:notes:${scope}`, 'qualifiedAccuracy', accuracy));
    return out;
  },
  Q4: (raw) => {
    const r = quizResultSchema.parse(raw);
    const key = `ear:${r.kind ?? 'majmin'}`;
    const out = [m(key, 'accuracy', r.correct / r.questions)];
    if (r.meanReactionMs !== null) out.push(m(key, 'reactionMs', r.meanReactionMs));
    return out;
  },
  S: (raw) => {
    const r = songResultSchema.parse(raw);
    const key = `song:${r.songId}`;
    const out = [
      m(key, 'completed', r.completed ? 1 : 0),
      m(key, 'stops', r.stops),
      m(key, 'memorized', r.memorized ? 1 : 0),
    ];
    if (r.chartHidden) out.push(m(key, 'hiddenCompleted', r.completed ? 1 : 0));
    if (r.beat1HitRate !== null) out.push(m(key, 'beat1HitRate', r.beat1HitRate));
    // The chord check counts only when no backing leaked into the microphone (§8.6-3b, §11.10).
    if (typeof r.chordCorrectRatio === 'number' && r.backingAudible !== true)
      out.push(m(`${key}:chord`, 'chordCorrect', r.chordCorrectRatio));
    // Song stages (SPEC v1.1 §11.10): a full learn run opens perform after two; "완주" = perform (or hidden)
    // to the end with ≤ 2 stops; memorized = hidden with ≤ 1 stop; repertoire = perform/hidden with no stop.
    if (r.mode === 'learn' && r.completed) out.push(m(key, 'learnFull', 1));
    if (r.mode === 'perform') {
      out.push(m(key, 'performCompleted', r.completed && r.stops <= SONG_COMPLETE_MAX_STOPS ? 1 : 0));
      if (r.completed && r.stops === 0) out.push(m(key, 'repertoire', 1));
      if (r.chartHidden)
        out.push(m(key, 'hiddenMemorized', r.completed && r.stops <= SONG_MEMORIZED_MAX_STOPS ? 1 : 0));
    }
    return out;
  },
  K1: (raw) => {
    const r = selfCheckResultSchema.parse(raw);
    return r.items.map((item) => m(`check:${item.id}`, 'done', item.status === 'done' ? 1 : 0));
  },
  E16: (raw) => {
    fretPositionResultSchema.parse(raw);
    return [m('fretpos', 'done', 1)];
  },
  E17: (raw) => {
    const r = riffResultSchema.parse(raw);
    const key = `riff:${r.riffId}`;
    const out = [
      m(key, 'flawlessCycles', r.cycles.filter((c) => c.flawless).length),
      m(key, 'ladderBpm', storedLadder(r.bpm, r.ladder, r.ladderBase)),
    ];
    if (r.ladder === 'up') out.push(m(key, 'passBpm', r.bpm));
    return out;
  },
  Q5: (raw) => {
    const r = quizResultSchema.parse(raw);
    return [m('quiz:tab', 'accuracy', r.correct / r.questions)];
  },
  E10: (raw) => {
    const r = scaleResultSchema.parse(raw);
    // An unmasked speaker backing run from before D-102: reference only (§8.6-3).
    if (r.backingAudible === true) return [];
    const key = `scale:${r.scaleId}:s${r.step}`;
    const out = [
      m(key, 'flawlessCycles', r.cycles.filter((c) => c.flawless).length),
      m(key, 'ladderBpm', storedLadder(r.bpm, r.ladder, r.ladderBase)),
    ];
    // The tempo at which this step ran four flawless cycles in a row (graduation at ≥ 80, §11.13); a paused run
    // does not count (D-085).
    const counts = countsForCriteria(r);
    if (counts && longestFlawlessRun(r.cycles) >= SEQUENCE_STREAK) out.push(m(key, 'streakBpm', r.bpm));
    const rates = sequenceRates(r.cycles);
    if (rates.okRatio !== null) out.push(m(key, 'pitchOk', rates.okRatio));
    if (rates.hitRate !== null) out.push(m(key, 'hitRate', rates.hitRate));
    out.push(
      m(
        key,
        'stops',
        r.cycles.reduce((a, c) => a + c.stops, 0),
      ),
    );
    if (r.memorized && counts) out.push(m(`scale:${r.scaleId}:memorized`, 'memorized', 1));
    return out;
  },
  E9: (raw) => {
    const r = chromaticResultSchema.parse(raw);
    const key = `chromatic:${r.startFret}`;
    const out = [
      m(key, 'flawlessCycles', r.cycles.filter((c) => c.flawless).length),
      m(key, 'ladderBpm', storedLadder(r.bpm, r.ladder, r.ladderBase)),
    ];
    if (r.ladder === 'up') out.push(m(key, 'passBpm', r.bpm));
    if (r.okRatio !== null) out.push(m(key, 'pitchOk', r.okRatio));
    if (r.hitRate !== null) out.push(m(key, 'hitRate', r.hitRate));
    if (r.ioiCv !== null) out.push(m(key, 'ioiCv', r.ioiCv));
    return out;
  },
  E11: (raw) => {
    const r = hammerResultSchema.parse(raw);
    const key = `hammer:${r.pair}`;
    const out = [
      m(
        key,
        'ladderBpm',
        ladderNextBpm(r.bpm, r.ladder) > HAMMER_MAX_BPM ? HAMMER_MAX_BPM : ladderNextBpm(r.bpm, r.ladder),
      ),
      m('hammer', 'minutes', r.durationMs / 60_000),
    ];
    if (r.evenRating !== null) out.push(m(key, 'selfRating', r.evenRating));
    if (r.pickedHitRate !== null) out.push(m(key, 'hitRate', r.pickedHitRate));
    return out;
  },
  E12: (raw) => {
    const r = pinkyResultSchema.parse(raw);
    const out = [m('pinky', 'done', r.completed ? 1 : 0)];
    if (r.clarity !== null) out.push(m('pinky', 'clarity', r.clarity));
    if (r.pain !== null) out.push(m('pinky', 'pain', r.pain));
    return out;
  },
  E3: (raw) => {
    const r = pfcResultSchema.parse(raw);
    const { cleanPerMin, cleanRate, passed } = pfcScores(r);
    return [
      m(`pfc:${r.direction}`, 'cleanCpm', cleanPerMin),
      m(`pfc:${r.direction}`, 'cleanRate', cleanRate),
      m(`pfc:${r.pair}`, 'cleanCpm', cleanPerMin),
      m(`pfc:${r.pair}`, 'cleanRate', cleanRate),
      m(`pfc:${r.pair}`, 'pass', passed ? 1 : 0),
    ];
  },
  EXAM: (raw) => {
    const r = examResultSchema.parse(raw);
    return [m(`exam:${r.item}`, 'pass', r.passed ? 1 : 0)];
  },
};

export function extractMetrics(exerciseType: string, result: unknown): MetricSampleInput[] {
  const extractor = METRIC_EXTRACTORS[exerciseType];
  if (!extractor) throw new Error(`no metric extractor for exercise type ${exerciseType}`);
  return extractor(result);
}
