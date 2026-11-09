/**
 * Today's routine generator (SPEC v1.1 §7.3). Pure and deterministic: same input (incl. seed) → same output.
 *
 * The stage time template (domain/routineTemplates.ts) fixes the blocks and their seconds; this module fills
 * every slot: rotation lists (rule ①–④), one-minute-change slots (risk pairs within 7 practice days), reviews
 * inside blocks of the same kind, ladder tempos, the E7 start fret, self-check days, pain reduction, the
 * session-length adjustment and the user's saved template.
 */
import { STRUM_START_BPM, type StrumMode } from '../content/patterns';
import { riffById } from '../content/riffs';
import type {
  ExerciseRef,
  PracticeSong,
  RoutineBlock,
  RoutineItem,
  RoutineTemplate,
  StageDef,
} from '../content/schemas';
import { selfChecksOfStage } from '../content/selfChecks';
import { classOfVoicing, type GVoicing, voicingForClass } from '../content/voicings';
import { type PracticeHistory, practiceDaysSince, sessionsSince } from './history';
import { pairDirKey, pairId, pairKey, parsePairId } from './pairs';
import { deriveSeed, mulberry32, shuffled } from './prng';
import {
  evaluateRule,
  modeGraduated,
  openModes,
  PAIR_METRIC,
  pairPassed,
  pfcGraduated,
  recallPassed,
  SLOWER_TEMPO_BPM,
  songCompleted,
  stagePairUniverse,
  unlockedChordClasses,
} from './progression';
import { DAY_MS, type Prescription, type ReviewItem, type SelfReport, type SkillState } from './records';
import {
  rowSeconds,
  type StageTemplate,
  stageTemplate,
  type TemplateRow,
  type TemplateSlot,
} from './routineTemplates';
import {
  decideSessionLength,
  EARLY_CAP_MINUTES,
  earlyCapApplies,
  FINGERTIP_LOAD_TYPES,
  PAIN_REDUCTION_FACTOR,
  type PainAdvice,
  painAdvice,
  REMOVED_ON_PAIN_TYPES,
} from './safety';
import { cleanRatio, recentMedian } from './skills';

export interface RoutineInput {
  stage: number;
  curriculum: readonly StageDef[];
  songs: readonly PracticeSong[];
  gVoicing: GVoicing;
  skills: ReadonlyMap<string, SkillState>;
  now: number;
  lastPracticeAt: number | null;
  firstPracticeAt: number | null;
  lastSelfReport: SelfReport | null;
  /** Session length L in minutes; null = the stage template's length T (SPEC v1.1 §7.3-1). */
  sessionMinutes: number | null;
  confirmedOverCap: boolean;
  dueReviews: readonly ReviewItem[];
  /** One-minute-change / PFC runs already done today (daily cap 6, 3 after a pain report). */
  changesDoneToday: number;
  prescriptions: readonly Prescription[];
  history: PracticeHistory;
  /** Sessions completed since entering the stage (self-check cards: every session of the first three). */
  sessionsInStage: number;
  /** E7 start fret for today (nextStretchStartFret over the stretch records, §7.4). */
  stretchStartFret: number;
  /** The user's saved template for this stage (§7.3-9), or null for the default template. */
  userTemplate: RoutineTemplate | null;
  /** E11 minutes already played today (daily cap 10 min, SPEC v1.1 §11.16); absent = 0. */
  hammerMinutesToday?: number;
  seed: number;
}

export type RoutineNotice =
  | { code: 'restDay' }
  | { code: 'painReduced' }
  | { code: 'gapReview'; days: number }
  | { code: 'capApplied'; minutes: number }
  | { code: 'changesCapReached' }
  | { code: 'userTemplate' }
  /** The stage's never-played chords open the session after tuning; `extraSec` = how much longer the day is (D-099). */
  | { code: 'newChords'; voicingIds: string[]; extraSec: number };

export interface RoutinePlan {
  kind: 'practice' | 'rest';
  items: RoutineItem[];
  totalSec: number;
  sessionMinutes: number;
  /** The stage template's length T in seconds. */
  templateSec: number;
  needsCapConfirmation: boolean;
  painAdvice: PainAdvice;
  notices: RoutineNotice[];
  /** Self-check items due today (a "K1 day" when non-empty). */
  selfChecks: string[];
  /** Index of the last item of the first half when the session may be split (Stage 8–11), else null. */
  splitAfterIndex: number | null;
}

export const DAILY_CHANGE_RUN_CAP = 6;
export const PAIN_CHANGE_RUN_CAP = 3;
export const GAP_REVIEW_DAYS = 3;
/** Rotation rule ①: an entry is due again once this many sessions have passed since it last appeared. */
export const ROTATION_SESSIONS = 3;
/** Rule 3: a required, unpassed pair is "at risk" once this many practice days passed since it last appeared. */
export const RISK_PRACTICE_DAYS = 5;
export const SONG_BLOCK_MIN_SEC = 300;
export const SONG_REVIEW_SEC = 180;
export const SELF_CHECK_FIRST_SESSIONS = 3;
export const Q2_MAX_CANDIDATES = 9;
export const Q2_MIN_QUESTIONS = 3;

/** A scale the stage must memorize is assigned with the TAB hidden from this assignment on (rule 10; one a day). */
const MEMORIZE_HIDDEN_FROM_RUN = 3;

const ROTATION_REVIEW_KIND = {
  rhythm: 'pattern',
  scales: 'scale',
  technique: 'riff',
  knowledge: null,
} as const;

type Draft = Omit<RoutineItem, 'id'>;

/** Everything a slot builder reads, computed once per routine. */
interface Ctx {
  input: RoutineInput;
  def: StageDef;
  /** New chord classes (or the previous stage's after a > 3-day gap). */
  newClasses: string[];
  unlocked: string[];
  gap: boolean;
  /** Due reviews not yet assigned today, by kind, oldest due first. */
  due: Map<string, ReviewItem[]>;
  /** Chord classes already placed today (E1). */
  usedChords: Set<string>;
  selfChecks: string[];
}

const slotKey = (slot: TemplateSlot) => JSON.stringify(slot);
/** Appearance key of a routine item: exercise type + subject (history and same-subject rules). */
export const itemKey = (exerciseType: string, subject: string) => `${exerciseType}|${subject}`;

// --- small rules -----------------------------------------------------------------------------------------------

function activePrescriptions(input: RoutineInput, kind: Prescription['kind']): Prescription[] {
  return input.prescriptions.filter((p) => p.kind === kind);
}

/** Rule 10 tempo: the subject's ladder tempo (start tempo the first time), −10 under a slower-tempo prescription. */
export function ladderTempo(
  input: Pick<RoutineInput, 'skills' | 'prescriptions'>,
  subject: string,
  startBpm: number,
): number {
  return ladderStart(input, subject, startBpm).bpm;
}

/**
 * The tempo to start at and, under a −10 BPM prescription, the ladder tempo the slowed run must keep
 * (SPEC v1.1 §7.4 "1주 동안 시작 BPM을 현재 −10으로(사다리 상태는 보존)").
 */
export function ladderStart(
  input: Pick<RoutineInput, 'skills' | 'prescriptions'>,
  subject: string,
  startBpm: number,
): { bpm: number; ladderBase?: number } {
  const current = input.skills.get(subject)?.metrics.ladderBpm?.last ?? startBpm;
  const slower = input.prescriptions.some((p) => p.kind === 'slowerTempo' && p.subjectKey === subject);
  return slower ? { bpm: Math.max(30, current - SLOWER_TEMPO_BPM), ladderBase: current } : { bpm: current };
}

/** K1 (§11.12): every stage item in the first three sessions of the stage; afterwards "아직" items every 3rd session. */
export function selfChecksToday(
  stage: number,
  sessionsInStage: number,
  history: PracticeHistory,
  skills: ReadonlyMap<string, SkillState>,
): string[] {
  const items = selfChecksOfStage(stage);
  if (sessionsInStage < SELF_CHECK_FIRST_SESSIONS) return items;
  return items.filter(
    (id) =>
      skills.get(`check:${id}`)?.metrics.done?.last !== 1 &&
      sessionsSince(history, itemKey('K1', `check:${id}`)) >= ROTATION_SESSIONS,
  );
}

/** Takes the first due review of `kind` matching `accept`, marking it assigned. */
function takeDue(
  ctx: Ctx,
  kind: string,
  accept: (r: ReviewItem) => boolean = () => true,
): ReviewItem | undefined {
  const list = ctx.due.get(kind) ?? [];
  const index = list.findIndex(accept);
  if (index < 0) return undefined;
  const [review] = list.splice(index, 1);
  return review;
}

/**
 * Marks a due review served by an item with the same subject (rule 6 "같은 subjectKey면 복습으로 인정") — only the
 * head of its kind's queue, so reviews are still assigned in due order (FIFO, §14.9-4).
 */
function serveSameSubject(ctx: Ctx, draft: Draft): Draft {
  if (draft.reviewOf || !draft.subjectKey) return draft;
  for (const list of ctx.due.values()) {
    if (list[0]?.subjectKey === draft.subjectKey) {
      list.shift();
      return { ...draft, reviewOf: draft.subjectKey };
    }
  }
  return draft;
}

/** Sort comparator: the key that appeared longest ago (never first). */
const oldestFirst = (history: PracticeHistory, key: (x: string) => string) => (a: string, b: string) => {
  const sa = sessionsSince(history, key(a));
  const sb = sessionsSince(history, key(b));
  return sa === sb ? 0 : sb > sa ? 1 : -1;
};

// --- chords ----------------------------------------------------------------------------------------------------

function chordDraft(ctx: Ctx, cls: string, sec: number, block: RoutineBlock, slot: TemplateSlot): Draft {
  const voicingId = voicingForClass(cls, ctx.input.gVoicing);
  ctx.usedChords.add(cls);
  return {
    exerciseType: 'E1',
    params: { voicingId, mode: 'pluck' },
    durationSec: sec,
    block,
    subjectKey: `chord:${voicingId}`,
    key: itemKey('E1', `chord:${voicingId}`),
    slot: slotKey(slot),
  };
}

function newChordDraft(ctx: Ctx, sec: number, slot: TemplateSlot): Draft | null {
  const classes = ctx.newClasses.filter((c) => !ctx.usedChords.has(c));
  if (classes.length === 0) return weakChordDraft(ctx, sec, slot);
  const g = ctx.input.gVoicing;
  const pick = [...classes].sort(
    oldestFirst(ctx.input.history, (c) => itemKey('E1', `chord:${voicingForClass(c, g)}`)),
  )[0]!;
  return serveSameSubject(ctx, chordDraft(ctx, pick, sec, ctx.gap ? 'stageReview' : 'chord', slot));
}

function weakChordDraft(ctx: Ctx, sec: number, slot: TemplateSlot): Draft | null {
  const g = ctx.input.gVoicing;
  const candidates = ctx.unlocked.filter((c) => !ctx.usedChords.has(c));
  if (candidates.length === 0) return null;
  const subjectOf = (c: string) => `chord:${voicingForClass(c, g)}`;
  const review = takeDue(ctx, 'chord', (r) => candidates.some((c) => r.subjectKey === subjectOf(c)));
  if (review) {
    const cls = candidates.find((c) => review.subjectKey === subjectOf(c))!;
    return { ...chordDraft(ctx, cls, sec, 'chord', slot), reviewOf: review.subjectKey };
  }
  const prescribed = activePrescriptions(ctx.input, 'pluckMode')
    .map((p) => candidates.find((c) => p.subjectKey === subjectOf(c)))
    .find((c) => c !== undefined);
  if (prescribed) return { ...chordDraft(ctx, prescribed, sec, 'chord', slot), note: 'prescription' };
  const weakest = candidates
    .map((cls, order) => ({ cls, order, ratio: cleanRatio(ctx.input.skills.get(subjectOf(cls))) ?? -1 }))
    .sort((a, b) => a.ratio - b.ratio || a.order - b.order)[0]!.cls;
  return chordDraft(ctx, weakest, sec, 'chord', slot);
}

// --- new chords of the stage (D-099) ---------------------------------------------------------------------------

/** Seconds of a new-chord item the routine did not already hold. */
export const NEW_CHORD_INTRO_SEC = 60;

/**
 * The stage's new chords never played yet (no E1 record), in curriculum order and in the user's G voicing. They
 * open the session as a short blocked practice (SPEC v1.1 §7.3-4 "신규 코드의 첫 노출은 짧은 blocked 연습", D-099).
 */
export function newChordIntro(
  input: Pick<RoutineInput, 'skills' | 'gVoicing'>,
  def: Pick<StageDef, 'newChords'>,
): string[] {
  return [...new Set(def.newChords.map(classOfVoicing))]
    .map((cls) => voicingForClass(cls, input.gVoicing))
    .filter((id) => !input.skills.has(`chord:${id}`));
}

/**
 * One E1 per intro chord in the `newChord` block, right after tuning — after the stage review on a gap day, so
 * rule 5's review stays first. A chord the routine already practises today moves there with its time; any other
 * gets NEW_CHORD_INTRO_SEC, returned as `addedSec`.
 */
function introduceNewChords(
  ctx: Ctx,
  drafts: readonly Draft[],
  voicingIds: readonly string[],
): { drafts: Draft[]; addedSec: number } {
  const rest = [...drafts];
  let addedSec = 0;
  const intro = voicingIds.map((id): Draft => {
    const at = rest.findIndex((d) => d.exerciseType === 'E1' && d.subjectKey === `chord:${id}`);
    if (at >= 0) return { ...rest.splice(at, 1)[0]!, block: 'newChord' };
    addedSec += NEW_CHORD_INTRO_SEC;
    return chordDraft(ctx, classOfVoicing(id), NEW_CHORD_INTRO_SEC, 'newChord', { kind: 'chordNew' });
  });
  rest.splice(rest.findLastIndex((d) => d.block === 'tuning' || d.block === 'stageReview') + 1, 0, ...intro);
  return { drafts: rest, addedSec };
}

// --- one-minute changes (rule 3) -------------------------------------------------------------------------------

/** Pair ids the current stage's rules require and that are not passed yet. */
export function requiredUnpassedPairs(
  input: Pick<RoutineInput, 'stage' | 'curriculum' | 'songs' | 'skills' | 'sessionsInStage' | 'now'>,
  def: StageDef,
): string[] {
  const out: string[] = [];
  for (const rule of def.unlockRules) {
    if (rule.kind === 'pairsPassedAtLeast') {
      for (const id of rule.pairs) if (!pairPassed(input.skills, id) && !out.includes(id)) out.push(id);
    } else if (rule.kind === 'unlockedPairsAtLeast') {
      const evaluation = evaluateRule(rule, {
        stage: input.stage,
        curriculum: input.curriculum,
        songs: input.songs,
        skills: input.skills,
        sessionsInStage: input.sessionsInStage,
        stageEnteredAt: input.now,
        examPassed: false,
        now: input.now,
        recentSamples: [],
      });
      for (const id of evaluation.missing) if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

function pairMedian(input: RoutineInput, id: string): number {
  const [a, b] = parsePairId(id);
  return recentMedian(input.skills.get(pairKey(a, b)), PAIR_METRIC, 3) ?? -1;
}

/** The direction of a pair practised less lately (fewer runs, then the older one). */
function directionOf(input: RoutineInput, id: string, avoid?: string): string {
  const [a, b] = parsePairId(id);
  const dirs = [`${a}>${b}`, `${b}>${a}`].filter((d) => d !== avoid);
  const stat = (dir: string) => {
    const [from, to] = dir.split('>') as [string, string];
    const summary = input.skills.get(pairDirKey(from, to))?.metrics.cpm;
    return { count: summary?.count ?? 0, lastAt: summary?.lastAt ?? 0 };
  };
  return [...dirs].sort((x, y) => stat(x).count - stat(y).count || stat(x).lastAt - stat(y).lastAt)[0]!;
}

function changeDraft(exerciseType: 'E2' | 'E3', dir: string, slot: TemplateSlot): Draft {
  const [from, to] = dir.split('>') as [string, string];
  const id = pairId(from, to);
  return {
    exerciseType,
    params: { direction: dir, pair: id },
    durationSec: 60,
    block: 'changes',
    subjectKey: exerciseType === 'E2' ? pairDirKey(from, to) : `pfc:${dir}`,
    key: itemKey(exerciseType, `pair:${id}`),
    slot: slotKey(slot),
  };
}

interface ChangePlan {
  slot1: string | null;
  slot2: string | null;
  pfc: string | null;
  /** A due pair review served by slot 1 (its pair is due — same subject, §7.3-6). */
  slot1Review: string | null;
  /** A due pair review served by slot 2. */
  slot2Review: string | null;
}

function planChanges(ctx: Ctx): ChangePlan {
  const { input, def } = ctx;
  const universe = stagePairUniverse(input.curriculum, input.stage);
  const history = input.history;
  const lastKey = (id: string) => itemKey('E2', `pair:${id}`);
  const byOldest = (ids: readonly string[]) => [...ids].sort(oldestFirst(history, lastKey));
  const rotation = byOldest(universe);
  const taken = new Set<string>();
  const firstFree = (ids: readonly string[]) => ids.find((id) => !taken.has(id)) ?? null;

  // Slot 1: pairs with a new chord of the stage, the one assigned longest ago; empty → rotation.
  const withNew = universe.filter((id) => parsePairId(id).some((c) => ctx.newClasses.includes(c)));
  const slot1 = firstFree(byOldest(withNew)) ?? firstFree(rotation);
  if (slot1) taken.add(slot1);
  // Slot 1's pair being due counts as its review (same subject), so slot 2 moves on to the next due pair.
  const headPair = ctx.due.get('pair')?.[0];
  const slot1Review =
    slot1 && headPair?.subjectKey === `pair:${slot1}` ? takeDue(ctx, 'pair')!.subjectKey : null;

  // PFC → OMC prescriptions (§7.4): that pair goes back to one-minute changes (E2) and leaves the PFC slot.
  const backToOmc = activePrescriptions(input, 'pfcToOmc').map((p) => p.subjectKey.slice('pair:'.length));

  // PFC slot (Stage 8–11): an OMC → PFC prescription, else a stage pair not graduated in E3.
  let pfc: string | null = null;
  if (def.stagePairs.length > 0) {
    const prescribed = activePrescriptions(input, 'omcToPfc')
      .map((p) => p.subjectKey.slice('pair:'.length))
      .filter((id) => !taken.has(id));
    const graduated = (id: string) => pfcGraduated(input.skills, id);
    const passedHere = universe.filter((id) => pairPassed(input.skills, id));
    const pool =
      input.stage >= 10
        ? passedHere.length > 0
          ? passedHere
          : (input.curriculum.find((d) => d.stage === 8)?.stagePairs ?? [])
        : universe;
    pfc =
      prescribed[0] ??
      firstFree(
        pool
          .filter((id) => !graduated(id) && !backToOmc.includes(id))
          .sort(oldestFirst(history, (id) => itemKey('E3', `pair:${id}`))),
      );
    if (pfc) taken.add(pfc);
  }

  // Slot 2: at-risk required pairs → PFC → OMC pair → due pair reviews → weakest required pair → rotation → slot 1.
  const required = requiredUnpassedPairs(input, def);
  const neverAssigned = (id: string) => (history.appearances.has(lastKey(id)) ? 1 : 0);
  const atRisk = required
    .filter((id) => !taken.has(id) && practiceDaysSince(history, lastKey(id)) >= RISK_PRACTICE_DAYS)
    .sort((a, b) => neverAssigned(a) - neverAssigned(b) || pairMedian(input, a) - pairMedian(input, b));
  let slot2: string | null = atRisk[0] ?? firstFree(backToOmc);
  let slot2Review: string | null = null;
  if (!slot2) {
    const review = takeDue(ctx, 'pair', (r) => !taken.has(r.subjectKey.slice('pair:'.length)));
    if (review) {
      slot2 = review.subjectKey.slice('pair:'.length);
      slot2Review = review.subjectKey;
    }
  }
  slot2 ??=
    required.filter((id) => !taken.has(id)).sort((a, b) => pairMedian(input, a) - pairMedian(input, b))[0] ??
    null;
  slot2 ??= firstFree(rotation) ?? slot1;
  return { slot1, slot2, pfc, slot1Review, slot2Review };
}

// --- rotation lists (rule 2 ①–④) ---------------------------------------------------------------------------------

/** Appearance key of a rotation entry (its own identity, independent of what the run happens to record). */
export function entryKey(entry: ExerciseRef): string {
  const p = entry.params;
  switch (entry.type) {
    case 'E5': {
      let subject = `strum:${String(p.patternId)}`;
      if (typeof p.mode === 'string') subject += `:${p.mode}`;
      if (p.cuesHidden === true) subject += ':hidden';
      if (p.dynamics === true) subject += ':dynamics';
      if (p.palmMute === true) subject += ':palmMute';
      return itemKey('E5', subject);
    }
    case 'E6':
      return itemKey('E6', `onebeat:${(p.progression as string[]).join('-')}`);
    case 'E4':
      return itemKey('E4', `drill:${String(p.pair)}`);
    case 'E8':
      return itemKey('E8', `altpick:${String(p.stringIdx ?? 3)}`);
    case 'E17':
      return itemKey('E17', `riff:${String(p.riffId)}`);
    case 'E10':
      return itemKey('E10', p.review === true ? 'scale:review' : `scale:${String(p.scaleId)}`);
    case 'Q1':
      return itemKey('Q1', 'quiz:diagram');
    case 'Q3':
      return itemKey('Q3', `quiz:notes:${String(p.scope ?? 'open')}`);
    case 'Q4':
      return itemKey('Q4', `ear:${String(p.kind ?? 'majmin')}`);
    case 'Q5':
      return itemKey('Q5', 'quiz:tab');
    case 'E0':
      return itemKey('E0', 'tuning');
    case 'E16':
      return itemKey('E16', 'fretpos');
    case 'E9':
      return itemKey('E9', 'chromatic');
    case 'E11':
      return itemKey('E11', 'hammer');
    case 'E12':
      return itemKey('E12', 'pinky');
    default:
      return itemKey(entry.type, 'default');
  }
}

/** Rule 10 E5 mode: the listed mode if open (else the latest open one); unlisted → the first open, ungraduated mode. */
export function strumModeFor(
  skills: ReadonlyMap<string, SkillState>,
  patternId: string,
  listed?: string,
): StrumMode {
  const open = openModes(skills, patternId);
  if (listed) return (open as string[]).includes(listed) ? (listed as StrumMode) : open.at(-1)!;
  return open.find((mode) => !modeGraduated(skills, patternId, mode)) ?? open.at(-1)!;
}

/** Builds the routine item of an exercise reference (rotation entry, fixed slot or a user-added item). */
function entryDraft(
  ctx: Ctx,
  entry: ExerciseRef,
  sec: number,
  block: RoutineBlock,
  slot: TemplateSlot,
): Draft {
  const { input, def } = ctx;
  const p = entry.params;
  const key = entryKey(entry);
  const base = { durationSec: sec, block, key, slot: slotKey(slot) };
  switch (entry.type) {
    case 'E5': {
      const patternId = String(p.patternId);
      const mode = strumModeFor(input.skills, patternId, typeof p.mode === 'string' ? p.mode : undefined);
      const single = ctx.newClasses[0] ?? def.rhythmProgression[0] ?? ctx.unlocked.at(-1);
      const chords =
        mode === 'progression' ? [...def.rhythmProgression] : mode === 'single' && single ? [single] : [];
      return {
        ...base,
        exerciseType: 'E5',
        params: {
          patternId,
          mode,
          chords,
          ...ladderStart(input, `strum:${patternId}:${mode}`, STRUM_START_BPM),
          bars: 8,
          cuesHidden: p.cuesHidden === true,
          ...(p.dynamics === true ? { dynamics: true } : {}),
          ...(p.palmMute === true ? { palmMute: true } : {}),
        },
        subjectKey: `strum:${patternId}`,
      };
    }
    case 'E6': {
      const progression = (p.progression as unknown[]).map(String);
      const subject = `onebeat:${progression.join('-')}`;
      return {
        ...base,
        exerciseType: 'E6',
        params: { progression, patternId: 'P0', ...ladderStart(input, subject, STRUM_START_BPM) },
        subjectKey: subject,
      };
    }
    case 'E4':
      return {
        ...base,
        exerciseType: 'E4',
        params: { pair: String(p.pair), ...(p.air === true ? { air: true } : {}) },
        subjectKey: `drill:${String(p.pair)}`,
      };
    case 'E8': {
      const stringIdx = Number(p.stringIdx ?? 3);
      const subject = `altpick:${stringIdx}`;
      return {
        ...base,
        exerciseType: 'E8',
        params: { stringIdx, ...ladderStart(input, subject, STRUM_START_BPM) },
        subjectKey: subject,
      };
    }
    case 'E17': {
      const riff = riffById(String(p.riffId));
      const subject = `riff:${riff.id}`;
      return {
        ...base,
        exerciseType: 'E17',
        params: { riffId: riff.id, ...ladderStart(input, subject, riff.bpm), tabHidden: false },
        subjectKey: subject,
      };
    }
    case 'Q3':
    case 'Q4': {
      // Due knowledge cards of this quiz are asked first (SPEC v1.1 §7.5).
      const prefix = entry.type === 'Q3' ? 'card:note:' : `card:ear:${String(p.kind ?? 'majmin')}:`;
      const focus = takeDueCards(ctx, prefix);
      // A stage rule on a Q3 range sets the run's question count (rule 10: Stage 10 strings65 = 20 questions).
      const quizRule =
        entry.type === 'Q3'
          ? def.unlockRules.find((r) => r.kind === 'quizRunAtLeast' && r.scope === (p.scope ?? 'open'))
          : undefined;
      return {
        ...base,
        exerciseType: entry.type,
        params: {
          ...p,
          ...(quizRule?.kind === 'quizRunAtLeast' ? { questions: quizRule.questions } : {}),
          ...(focus.length > 0 ? { focus } : {}),
        },
        subjectKey: key.slice(key.indexOf('|') + 1),
      };
    }
    case 'E10': {
      // A scale the stage must memorize (rule 10): step 1 with the TAB hidden from its third assignment on,
      // until it is memorized. Step and tempo otherwise follow the scale's own ladder (the plugin's history).
      const scaleId = String(p.scaleId);
      const memorize = def.unlockRules.some((r) => r.kind === 'scaleMemorized' && r.scaleId === scaleId);
      // Assignments, not runs: repeats inside one session ("이어서 한 번 더") count once — distinct practice days.
      const runs = Object.keys(
        input.skills.get(`scale:${scaleId}:s1`)?.metrics.flawlessCycles?.dayBest ?? {},
      ).length;
      const memorized = (input.skills.get(`scale:${scaleId}:memorized`)?.metrics.memorized?.best ?? 0) >= 1;
      const hidden = memorize && !memorized && p.review !== true && runs >= MEMORIZE_HIDDEN_FROM_RUN - 1;
      return {
        ...base,
        exerciseType: 'E10',
        params: { ...p, ...(hidden ? { step: 1, tabHidden: true } : {}) },
        subjectKey: key.slice(key.indexOf('|') + 1),
      };
    }
    default:
      return {
        ...base,
        exerciseType: entry.type,
        params: { ...p },
        subjectKey: key.slice(key.indexOf('|') + 1),
      };
  }
}

/** Takes every due knowledge card whose key starts with `prefix` (they are asked inside one quiz run). */
function takeDueCards(ctx: Ctx, prefix: string): string[] {
  const cards = ctx.due.get('card') ?? [];
  const taken = cards.filter((r) => r.subjectKey.startsWith(prefix));
  ctx.due.set(
    'card',
    cards.filter((r) => !r.subjectKey.startsWith(prefix)),
  );
  return taken.map((r) => r.subjectKey);
}

/**
 * Rule 6 (knowledge cards): on a day without Q3/Q4 in the rotation, due note or ear cards share the Q2 block —
 * Q2 30 s + that quiz's due cards 30 s.
 */
function splitRecallForCards(ctx: Ctx, drafts: Draft[]): Draft[] {
  if (drafts.some((d) => d.exerciseType === 'Q3' || d.exerciseType === 'Q4')) return drafts;
  const index = drafts.findIndex((d) => d.exerciseType === 'Q2');
  if (index < 0) return drafts;
  const recall = drafts[index]!;
  const notes = takeDueCards(ctx, 'card:note:');
  const ear = notes.length === 0 ? takeDueCards(ctx, 'card:ear:') : [];
  if (notes.length === 0 && ear.length === 0) return drafts;
  const half = Math.round(recall.durationSec / 2);
  const quiz: Draft =
    notes.length > 0
      ? {
          exerciseType: 'Q3',
          params: { scope: 'open', focus: notes, questions: Math.max(3, notes.length) },
          durationSec: recall.durationSec - half,
          block: 'recall',
          subjectKey: 'quiz:notes:open',
          key: itemKey('Q3', 'quiz:notes:open'),
          ...(recall.slot ? { slot: recall.slot } : {}),
          note: 'cards',
        }
      : {
          exerciseType: 'Q4',
          params: { kind: 'majmin', focus: ear, questions: Math.max(3, ear.length) },
          durationSec: recall.durationSec - half,
          block: 'recall',
          subjectKey: 'ear:majmin',
          key: itemKey('Q4', 'ear:majmin'),
          ...(recall.slot ? { slot: recall.slot } : {}),
          note: 'cards',
        };
  const out = [...drafts];
  out.splice(index, 1, { ...recall, durationSec: half }, quiz);
  return out;
}

/** Technique slot ② (Stage 1–7): an OMC → PFC prescription becomes an anchor/air drill on that pair. */
function prescriptionDraft(ctx: Ctx, sec: number, slot: TemplateSlot): Draft | null {
  const prescription = activePrescriptions(ctx.input, 'omcToPfc')[0];
  if (!prescription) return null;
  const pair = prescription.subjectKey.slice('pair:'.length);
  return {
    ...entryDraft(ctx, { type: 'E4', params: { pair } }, sec, 'technique', slot),
    note: 'prescription',
  };
}

/** A due review played in a rotation block of its kind (③). */
function reviewDraft(
  ctx: Ctx,
  review: ReviewItem,
  sec: number,
  block: RoutineBlock,
  slot: TemplateSlot,
): Draft {
  const subject = review.subjectKey;
  const [, id, stepPart] = subject.split(':') as [string, string, string | undefined];
  const entry: ExerciseRef =
    review.kind === 'pattern'
      ? { type: 'E5', params: { patternId: id, mode: 'progression' } }
      : review.kind === 'riff'
        ? { type: 'E17', params: { riffId: id } }
        : { type: 'E10', params: { scaleId: id, step: Number(stepPart?.slice(1)), review: true } };
  // Pattern and riff reviews play at the ladder's current tempo (rule 10); a graduated riff's ladder is at or
  // above its goal tempo.
  return { ...entryDraft(ctx, entry, sec, block, slot), reviewOf: subject, note: 'review' };
}

function rotationDraft(
  ctx: Ctx,
  list: 'rhythm' | 'scales' | 'technique' | 'knowledge',
  sec: number,
  slot: TemplateSlot,
): Draft | null {
  const entries = ctx.def.rotation[list];
  const history = ctx.input.history;
  const block: RoutineBlock = list === 'scales' ? 'scale' : list;
  const ranked = entries
    .map((entry, order) => ({ entry, order, since: sessionsSince(history, entryKey(entry)) }))
    .sort((a, b) => (a.since === b.since ? a.order - b.order : b.since > a.since ? 1 : -1));
  // ① due by the 3-session rule: never-seen entries first, then the oldest.
  const due = ranked.find((e) => e.since >= ROTATION_SESSIONS);
  if (due) return serveSameSubject(ctx, entryDraft(ctx, due.entry, sec, block, slot));
  // ② (technique, Stage 1–7) an active prescription.
  if (list === 'technique' && ctx.input.stage <= 7) {
    const prescribed = prescriptionDraft(ctx, sec, slot);
    if (prescribed) return prescribed;
  }
  // ③ a due review of this block's kind.
  const kind = ROTATION_REVIEW_KIND[list];
  const review = kind ? takeDue(ctx, kind) : undefined;
  if (review) return reviewDraft(ctx, review, sec, block, slot);
  // ④ the entry that appeared longest ago.
  const oldest = ranked[0];
  return oldest ? serveSameSubject(ctx, entryDraft(ctx, oldest.entry, sec, block, slot)) : null;
}

// --- Q2 and songs ------------------------------------------------------------------------------------------------

/** §11.9 v1.1: new chords + due cards + not-yet-passed chords + random review chords, at most 9. */
export function recallCandidates(
  input: Pick<RoutineInput, 'dueReviews' | 'skills' | 'seed'>,
  def: StageDef,
  unlocked: readonly string[],
): string[] {
  const out: string[] = [];
  const push = (cls: string) => {
    if (out.length < Q2_MAX_CANDIDATES && !out.includes(cls) && unlocked.includes(cls)) out.push(cls);
  };
  for (const id of def.newChords) push(classOfVoicing(id));
  for (const review of input.dueReviews)
    if (review.kind === 'card' && review.subjectKey.startsWith('card:recall:'))
      push(review.subjectKey.slice('card:recall:'.length));
  for (const cls of unlocked) if (!recallPassed(input.skills, cls)) push(cls);
  for (const cls of shuffled(mulberry32(deriveSeed(input.seed, 'recall')), unlocked)) push(cls);
  return out;
}

export type SongStage = 'learn' | 'perform' | 'hidden';

/** Highest open song stage (§11.10): two full learn runs open perform; one perform completion opens hidden. */
export function songStage(skills: ReadonlyMap<string, SkillState>, songId: string): SongStage {
  if (songCompleted(skills, songId)) return 'hidden';
  return (skills.get(`song:${songId}`)?.metrics.learnFull?.count ?? 0) >= 2 ? 'perform' : 'learn';
}

function songDraft(
  ctx: Ctx,
  song: PracticeSong,
  sec: number,
  block: RoutineBlock,
  slot: TemplateSlot,
  stage?: SongStage,
): Draft {
  const s = stage ?? songStage(ctx.input.skills, song.id);
  return {
    exerciseType: 'S',
    params: {
      songId: song.id,
      mode: s === 'learn' ? 'learn' : 'perform',
      chartHidden: s === 'hidden',
      bpm: song.bpmDefault,
    },
    durationSec: sec,
    block,
    subjectKey: `song:${song.id}`,
    key: itemKey('S', `song:${song.id}`),
    slot: slotKey(slot),
  };
}

/** The stage's own song: one not completed yet first, then the one practised longest ago. */
function currentSong(ctx: Ctx, songs: readonly PracticeSong[]): PracticeSong | undefined {
  const { skills, history } = ctx.input;
  const since = (id: string) => sessionsSince(history, itemKey('S', `song:${id}`));
  return [...songs].sort(
    (a, b) =>
      Number(songCompleted(skills, a.id)) - Number(songCompleted(skills, b.id)) ||
      (since(a.id) === since(b.id) ? 0 : since(b.id) > since(a.id) ? 1 : -1) ||
      a.id.localeCompare(b.id),
  )[0];
}

function songBlock(ctx: Ctx, sec: number, slot: TemplateSlot): Draft[] {
  const available = ctx.input.songs.filter((s) => s.stage <= ctx.input.stage);
  if (available.length === 0) return [];
  const top = Math.max(...available.map((s) => s.stage));
  const song = currentSong(
    ctx,
    available.filter((s) => s.stage === top),
  )!;
  const out: Draft[] = [];
  // Stage 1–6: a due song review is played once (perform stage) before this stage's song (rule 6).
  if (ctx.input.stage <= 6) {
    const review = takeDue(ctx, 'song', (r) => r.subjectKey !== `song:${song.id}`);
    const reviewSong = review && ctx.input.songs.find((s) => `song:${s.id}` === review.subjectKey);
    if (review && reviewSong) {
      out.push({
        ...songDraft(ctx, reviewSong, SONG_REVIEW_SEC, 'song', slot, 'perform'),
        reviewOf: review.subjectKey,
      });
      sec -= SONG_REVIEW_SEC;
    }
  }
  out.push(serveSameSubject(ctx, songDraft(ctx, song, sec, 'song', slot)));
  return out;
}

/** Stage 7: practise playing from memory — a song whose hidden stage is open and not memorized yet. */
function memorizeBlock(ctx: Ctx, sec: number, slot: TemplateSlot): Draft[] {
  const skills = ctx.input.skills;
  const available = ctx.input.songs.filter((s) => s.stage <= ctx.input.stage);
  const memorized = (id: string) => (skills.get(`song:${id}`)?.metrics.hiddenMemorized?.best ?? 0) >= 1;
  const hiddenOpen = available.filter((s) => songStage(skills, s.id) === 'hidden' && !memorized(s.id));
  const pool = hiddenOpen.length > 0 ? hiddenOpen : available.filter((s) => s.stage === ctx.input.stage);
  const song = currentSong(ctx, pool.length > 0 ? pool : available);
  return song ? [serveSameSubject(ctx, songDraft(ctx, song, sec, 'song', slot))] : [];
}

/** Sessions since a song was last played — the one count the repertoire block and its "한 번 더" share (D-105). */
function songSessionsSince(history: PracticeHistory, songId: string): number {
  return sessionsSince(history, itemKey('S', `song:${songId}`));
}

/** Repertoire order (D-105): played longest ago first (never played before any), ties in id order. */
function longestAgoFirst<T extends { id: string }>(history: PracticeHistory, songs: readonly T[]): T[] {
  const since = (id: string) => songSessionsSince(history, id);
  return [...songs].sort(
    (a, b) =>
      (since(a.id) === since(b.id) ? 0 : since(b.id) > since(a.id) ? 1 : -1) || a.id.localeCompare(b.id),
  );
}

/**
 * The repertoire song to play after `currentSongId` (§11.10, D-105): of the other repertoire songs open at the
 * stage, the one played longest ago (never played first, ties in id order), in the hidden stage once memorized.
 * Null when there is no other repertoire song to move to.
 */
export function nextRepertoireSong(
  input: Pick<RoutineInput, 'songs' | 'stage' | 'skills' | 'history'>,
  currentSongId: string,
): { songId: string; mode: 'perform'; chartHidden: boolean; bpm: number } | null {
  const metric = (id: string, name: string) => input.skills.get(`song:${id}`)?.metrics[name]?.best ?? 0;
  const others = input.songs.filter(
    (s) => s.stage <= input.stage && metric(s.id, 'repertoire') >= 1 && s.id !== currentSongId,
  );
  const next = longestAgoFirst(input.history, others)[0];
  if (!next) return null;
  return {
    songId: next.id,
    mode: 'perform',
    chartHidden: metric(next.id, 'hiddenMemorized') >= 1,
    bpm: next.bpmDefault,
  };
}

/** Stage 7+ repertoire (§11.10): due song → oldest repertoire song → most recently practised song. */
function repertoireBlock(ctx: Ctx, sec: number, slot: TemplateSlot): Draft[] {
  const { input } = ctx;
  const available = input.songs.filter((s) => s.stage <= input.stage);
  const memorized = (id: string) => (input.skills.get(`song:${id}`)?.metrics.hiddenMemorized?.best ?? 0) >= 1;
  const stageOf = (id: string): SongStage => (memorized(id) ? 'hidden' : 'perform');
  const review = takeDue(ctx, 'song', (r) => available.some((s) => `song:${s.id}` === r.subjectKey));
  if (review) {
    const song = available.find((s) => `song:${s.id}` === review.subjectKey)!;
    return [
      { ...songDraft(ctx, song, sec, 'repertoire', slot, stageOf(song.id)), reviewOf: review.subjectKey },
    ];
  }
  const since = (id: string) => songSessionsSince(input.history, id);
  const repertoire = available.filter(
    (s) => (input.skills.get(`song:${s.id}`)?.metrics.repertoire?.best ?? 0) >= 1,
  );
  const practised = available.filter((s) => Number.isFinite(since(s.id)));
  const pick =
    longestAgoFirst(input.history, repertoire)[0] ??
    [...practised].sort((a, b) => since(a.id) - since(b.id) || a.id.localeCompare(b.id))[0] ??
    available[0];
  if (!pick) return [];
  const stage = repertoire.includes(pick) ? stageOf(pick.id) : songStage(input.skills, pick.id);
  return [songDraft(ctx, pick, sec, 'repertoire', slot, stage)];
}

// --- slot dispatch -------------------------------------------------------------------------------------------------

function buildSlot(ctx: Ctx, slot: TemplateSlot, sec: number, changes: ChangePlan): Draft[] {
  const { input } = ctx;
  const one = (draft: Draft | null) => (draft ? [draft] : []);
  switch (slot.kind) {
    case 'tuning':
      return [
        {
          exerciseType: 'E0',
          params: {},
          durationSec: sec,
          block: 'tuning',
          subjectKey: 'tuning:session',
          key: itemKey('E0', 'tuning'),
          slot: slotKey(slot),
        },
      ];
    case 'repertoire':
      return repertoireBlock(ctx, sec, slot);
    case 'strumFixed':
      return [
        entryDraft(
          ctx,
          { type: 'E5', params: { patternId: slot.patternId, mode: slot.mode } },
          sec,
          slot.block,
          slot,
        ),
      ];
    case 'stretch':
      return [
        {
          exerciseType: 'E7',
          params: { startFret: input.stretchStartFret },
          durationSec: sec,
          block: 'warmup',
          subjectKey: 'stretch',
          key: itemKey('E7', 'stretch'),
          slot: slotKey(slot),
        },
      ];
    case 'selfCheck':
      return ctx.selfChecks.length === 0
        ? []
        : [
            {
              exerciseType: 'K1',
              params: { items: [...ctx.selfChecks] },
              durationSec: sec,
              block: 'selfCheck',
              key: itemKey('K1', `check:${ctx.selfChecks.join('+')}`),
              slot: slotKey(slot),
            },
          ];
    case 'chordFixed':
      return [serveSameSubject(ctx, chordDraft(ctx, slot.chordClass, sec, 'chord', slot))];
    case 'chordNew':
      return one(newChordDraft(ctx, sec, slot));
    case 'chordWeak':
      return one(weakChordDraft(ctx, sec, slot));
    case 'change': {
      const id = slot.rule === 'slot1' ? changes.slot1 : slot.rule === 'slot2' ? changes.slot2 : changes.pfc;
      if (!id) return [];
      const type = slot.rule === 'pfc' ? 'E3' : 'E2';
      // The same pair in both slots (a one-pair stage) → the second run takes the other direction (rule 3).
      const avoid = slot.rule === 'slot2' && id === changes.slot1 ? directionOf(input, id) : undefined;
      const draft = changeDraft(type, directionOf(input, id, avoid), slot);
      const reviewOf =
        slot.rule === 'slot2' ? changes.slot2Review : slot.rule === 'slot1' ? changes.slot1Review : null;
      return [reviewOf ? { ...draft, reviewOf } : draft];
    }
    case 'rest':
      return [{ exerciseType: 'REST', params: {}, durationSec: sec, block: 'rest', slot: slotKey(slot) }];
    case 'drillFixed':
      return [entryDraft(ctx, { type: 'E4', params: { pair: slot.pair } }, sec, 'drill', slot)];
    case 'oneBeatFixed':
      return [
        entryDraft(ctx, { type: 'E6', params: { progression: [...slot.progression] } }, sec, 'rhythm', slot),
      ];
    case 'rotation':
      return one(rotationDraft(ctx, slot.list, sec, slot));
    case 'fixed':
      return [
        entryDraft(ctx, { type: slot.exerciseType, params: { ...slot.params } }, sec, slot.block, slot),
      ];
    case 'custom':
      return [
        entryDraft(ctx, { type: slot.exerciseType, params: { ...slot.params } }, sec, 'technique', slot),
      ];
    case 'recall':
      return [
        {
          exerciseType: 'Q2',
          params: (() => {
            const chordClasses = recallCandidates(input, ctx.def, ctx.unlocked);
            // Every candidate is asked at least once (§7.1 "Q2: X 3초 안 정답" needs each chord every run).
            return { chordClasses, count: Math.max(Q2_MIN_QUESTIONS, chordClasses.length) };
          })(),
          durationSec: sec,
          block: 'recall',
          subjectKey: 'recall',
          key: itemKey('Q2', 'recall'),
          slot: slotKey(slot),
        },
      ];
    case 'song':
      return songBlock(ctx, sec, slot);
    case 'songMemorize':
      return memorizeBlock(ctx, sec, slot);
  }
}

// --- whole-routine transforms -------------------------------------------------------------------------------------

/** Rule 4: never two consecutive items with the same exercise + subject. Swaps a later item in to fix collisions. */
export function interleave(items: RoutineItem[]): RoutineItem[] {
  const out = [...items];
  const same = (a: RoutineItem | undefined, b: RoutineItem | undefined) =>
    !!a && !!b && a.exerciseType === b.exerciseType && (a.subjectKey ?? '') === (b.subjectKey ?? '');
  const clashesAt = (list: RoutineItem[], k: number) =>
    same(list[k - 1], list[k]) || same(list[k], list[k + 1]);
  for (let i = 1; i < out.length; i++) {
    if (!same(out[i - 1], out[i])) continue;
    for (let j = i + 1; j < out.length; j++) {
      const trial = [...out];
      [trial[i], trial[j]] = [trial[j]!, trial[i]!];
      if (!clashesAt(trial, i) && !clashesAt(trial, j)) {
        out.splice(0, out.length, ...trial);
        break;
      }
    }
  }
  return out;
}

const isChangeRun = (d: Draft) => d.exerciseType === 'E2' || d.exerciseType === 'E3';

/** Rule 3 daily cap: keeps the first `allowed` change runs (E2/E3); a rest stays only between two kept runs. */
function applyChangeCap(drafts: Draft[], allowed: number): Draft[] {
  let kept = 0;
  const capped = drafts.filter((d) => {
    if (!isChangeRun(d)) return true;
    kept += 1;
    return kept <= allowed;
  });
  return capped.filter(
    (d, i) =>
      d.exerciseType !== 'REST' ||
      (isChangeRun(capped[i - 1] ?? d) && capped[i + 1] !== undefined && isChangeRun(capped[i + 1]!)),
  );
}

/** E11 hammer-on minutes per day (SPEC v1.1 §11.16, 01:343). */
export const HAMMER_DAILY_CAP_MIN = 10;

/** Rule 7: pain ≥ 5 → fingertip-load items at 50 % (15 s steps, ≥ 30 s), E11/E12 left out, nothing refilled. */
function applyPainReduction(drafts: Draft[]): Draft[] {
  return drafts
    .filter((d) => !REMOVED_ON_PAIN_TYPES.has(d.exerciseType))
    .map((d) =>
      FINGERTIP_LOAD_TYPES.has(d.exerciseType)
        ? { ...d, durationSec: Math.max(30, Math.round((d.durationSec * PAIN_REDUCTION_FACTOR) / 15) * 15) }
        : d,
    );
}

/**
 * Rule 1: a session length L ≠ T adds the difference to the song block (Stage 7+: repertoire; Stage 0, which has
 * no song: the rhythm block) or takes it from there down to 300 s, then leaves out the knowledge and technique
 * rotation blocks for the day (Stage 0: its technique items from the end).
 */
function applySessionLength(drafts: Draft[], stage: number, targetSec: number): Draft[] {
  const total = drafts.reduce((sum, d) => sum + d.durationSec, 0);
  let diff = targetSec - total;
  if (diff === 0) return drafts;
  const out = drafts.map((d) => ({ ...d }));
  if (diff > 0) {
    // Longer: Stage 7+ adds to the repertoire block, Stage 1–6 to the song, Stage 0 (no song) to the rhythm block.
    const grow = out.findLast((d) =>
      stage === 0 ? d.block === 'rhythm' : stage >= 7 ? d.block === 'repertoire' : d.block === 'song',
    );
    if (grow) grow.durationSec += diff;
    return out;
  }
  // Shorter: the song block gives time down to 300 s (Stage 0 has none) …
  const song = stage === 0 ? undefined : out.findLast((d) => d.block === 'song');
  if (song) {
    const take = Math.min(-diff, Math.max(0, song.durationSec - SONG_BLOCK_MIN_SEC));
    song.durationSec -= take;
    diff += take;
  }
  const droppable = (d: Draft) =>
    stage === 0
      ? d.block === 'technique'
      : d.block === 'knowledge' || (d.block === 'technique' && (d.slot?.includes('"rotation"') ?? false));
  for (let i = out.length - 1; i >= 0 && diff < 0; i--) {
    if (!droppable(out[i]!)) continue;
    diff += out[i]!.durationSec;
    out.splice(i, 1);
  }
  return out;
}

function rowsFor(input: RoutineInput, template: StageTemplate): TemplateRow[] {
  if (!input.userTemplate) return [...template.rows];
  return input.userTemplate.items.flatMap((item): TemplateRow[] => {
    if (item.slot) {
      try {
        return [{ slot: JSON.parse(item.slot) as TemplateSlot, sec: item.durationSec }];
      } catch {
        return [];
      }
    }
    return [
      {
        slot: { kind: 'custom', exerciseType: item.exerciseType, params: item.params },
        sec: item.durationSec,
      },
    ];
  });
}

export function generateRoutine(input: RoutineInput): RoutinePlan {
  const template = stageTemplate(input.stage);
  const advice = painAdvice(input.lastSelfReport);
  const requested = input.sessionMinutes ?? template.lengthSec / 60;
  // The 20-minute cap of the first four weeks applies to Stage 0–7 only (§7.3-1).
  const length =
    input.stage <= 7
      ? decideSessionLength(requested, input.firstPracticeAt, input.now, input.confirmedOverCap)
      : { minutes: requested, needsConfirmation: false, capped: false };
  const notices: RoutineNotice[] = [];
  if (length.capped) notices.push({ code: 'capApplied', minutes: length.minutes });
  if (advice === 'restDay') {
    return {
      kind: 'rest',
      items: [],
      totalSec: 0,
      sessionMinutes: length.minutes,
      templateSec: template.lengthSec,
      needsCapConfirmation: false,
      painAdvice: advice,
      notices: [{ code: 'restDay' }],
      selfChecks: [],
      splitAfterIndex: null,
    };
  }

  const def = input.curriculum.find((s) => s.stage === input.stage);
  if (!def) throw new Error(`no stage ${input.stage}`);
  const selfChecks = selfChecksToday(input.stage, input.sessionsInStage, input.history, input.skills);
  const gapDays = input.lastPracticeAt === null ? 0 : Math.floor((input.now - input.lastPracticeAt) / DAY_MS);
  const previous = input.curriculum.find((s) => s.stage === input.stage - 1);
  const gap = gapDays > GAP_REVIEW_DAYS && previous !== undefined && previous.newChords.length > 0;
  if (input.userTemplate) notices.push({ code: 'userTemplate' });

  const due = new Map<string, ReviewItem[]>();
  const byDue = [...input.dueReviews].sort(
    (a, b) => a.due - b.due || a.subjectKey.localeCompare(b.subjectKey),
  );
  for (const review of byDue) {
    const list = due.get(review.kind) ?? [];
    list.push(review);
    due.set(review.kind, list);
  }
  const classes = (ids: readonly string[]) => [...new Set(ids.map(classOfVoicing))];
  const ctx: Ctx = {
    input,
    def,
    newClasses: gap ? classes(previous!.newChords) : classes(def.newChords),
    unlocked: unlockedChordClasses(input.curriculum, input.stage),
    gap,
    due,
    usedChords: new Set(),
    selfChecks,
  };
  const changes = planChanges(ctx);
  const k1Day = selfChecks.length > 0;
  let drafts: Draft[] = [];
  for (const r of rowsFor(input, template)) {
    const sec = input.userTemplate ? r.sec : rowSeconds(r, k1Day);
    if (sec > 0) drafts.push(...buildSlot(ctx, r.slot, sec, changes));
  }

  // Rule 5 notice only when a previous-stage review item was actually placed.
  if (gap && drafts.some((d) => d.block === 'stageReview'))
    notices.unshift({ code: 'gapReview', days: gapDays });
  drafts = splitRecallForCards(ctx, drafts);
  const painDay = advice === 'reduceFingertipLoad';
  const allowed = Math.max(
    0,
    (painDay ? PAIN_CHANGE_RUN_CAP : DAILY_CHANGE_RUN_CAP) - input.changesDoneToday,
  );
  if (drafts.filter(isChangeRun).length > allowed) {
    drafts = applyChangeCap(drafts, allowed);
    if (allowed === 0) notices.push({ code: 'changesCapReached' });
  }
  let needsCapConfirmation = length.needsConfirmation;
  if (!input.userTemplate) {
    const introChords = newChordIntro(input, def);
    let introSec = 0;
    if (introChords.length > 0)
      ({ drafts, addedSec: introSec } = introduceNewChords(ctx, drafts, introChords));
    // New chords lengthen the day (D-099), but never past the first four weeks' 20 minutes (rule 1).
    const baseSec = length.minutes * 60;
    const early =
      input.stage <= 7 && earlyCapApplies(input.firstPracticeAt, input.now, input.confirmedOverCap);
    const extraSec = early ? Math.max(0, Math.min(introSec, EARLY_CAP_MINUTES * 60 - baseSec)) : introSec;
    drafts = applySessionLength(drafts, input.stage, baseSec + extraSec);
    // Right after a gap notice: the stage review comes first that day.
    if (introChords.length > 0)
      notices.splice(notices[0]?.code === 'gapReview' ? 1 : 0, 0, {
        code: 'newChords',
        voicingIds: introChords,
        extraSec,
      });
  } else {
    // An edited routine keeps its own block times, but the first-four-weeks cap still applies (§7.3-9).
    const cap = decideSessionLength(
      Math.ceil(drafts.reduce((sum, d) => sum + d.durationSec, 0) / 60),
      input.firstPracticeAt,
      input.now,
      input.confirmedOverCap,
    );
    if (input.stage <= 7 && cap.capped) {
      drafts = applySessionLength(drafts, input.stage, cap.minutes * 60);
      needsCapConfirmation = true;
    }
  }
  if (painDay) {
    notices.push({ code: 'painReduced' });
    drafts = applyPainReduction(drafts);
  }
  // E11 daily cap (§11.16): ten minutes a day at most — left out once reached, otherwise told what is left.
  const hammerToday = input.hammerMinutesToday ?? 0;
  drafts =
    hammerToday >= HAMMER_DAILY_CAP_MIN
      ? drafts.filter((d) => d.exerciseType !== 'E11')
      : drafts.map((d) =>
          d.exerciseType === 'E11' ? { ...d, params: { ...d.params, minutesToday: hammerToday } } : d,
        );

  // Songs stay last (rule 2); everything before them is interleaved (rule 4).
  const songStart = drafts.findIndex((d) => d.block === 'song');
  const head = songStart < 0 ? drafts : drafts.slice(0, songStart);
  const tail = songStart < 0 ? [] : drafts.slice(songStart);
  const numbered = (list: Draft[], offset: number): RoutineItem[] =>
    list.map((d, i) => ({ id: `r${String(offset + i + 1).padStart(2, '0')}`, ...d }));
  const items = [...interleave(numbered(head, 0)), ...numbered(tail, head.length)];
  const split =
    template.splitAfterRow !== null && !input.userTemplate
      ? items.findLastIndex((i) => i.block === 'rhythm')
      : -1;
  return {
    kind: 'practice',
    items,
    totalSec: items.reduce((sum, item) => sum + item.durationSec, 0),
    sessionMinutes: length.minutes,
    templateSec: template.lengthSec,
    needsCapConfirmation,
    painAdvice: advice,
    notices,
    selfChecks,
    splitAfterIndex: split >= 0 ? split : null,
  };
}
