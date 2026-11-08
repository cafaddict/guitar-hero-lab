/**
 * User settings (stored in meta['settings']). Defaults follow SPEC (dark theme, lenient strictness, 20 min).
 */
import { z } from 'zod';

export const KEY_ACTIONS = [
  'toggle',
  'next',
  'prev',
  'inc',
  'dec',
  'abort',
  'mark',
  'manual1',
  'manual2',
  'manual3',
  // v1.1 practice options inside the session runner (SPEC v1.1 §12.3): ear-first, visual cues, loop, hide,
  // play-along backing.
  'ear',
  'cues',
  'loop',
  'hide',
  'backing',
  // Pause/resume of a metronome run and the song's start-over (D-085).
  'pause',
  'restart',
] as const;
export type KeyAction = (typeof KEY_ACTIONS)[number];

export const settingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'contrast']),
  leftHanded: z.boolean(),
  strictness: z.enum(['lenient', 'normal', 'strict']),
  /** Pluck judgement sensitivity (D-075): 'low' ignores quiet and non-string sounds more readily. */
  sensitivity: z.enum(['low', 'normal', 'high']),
  visualOnlyMetronome: z.boolean(),
  sessionMinutes: z.number().int().min(5).max(90),
  /** 'template' = the stage template's length (20 min, Stage 8+ 30 min); 'custom' = `sessionMinutes` (§7.3-1). */
  sessionLengthMode: z.enum(['template', 'custom']),
  confirmedOverCap: z.boolean(),
  preferredInputDeviceId: z.string().nullable(),
  preferredOutputLabel: z.string().nullable(),
  xStringCheck: z.boolean(),
  /** Extra key → action bindings learned with the pedal-learning mode (code → action). */
  customKeys: z.record(z.string(), z.enum(KEY_ACTIONS)),
  micOnboardingDone: z.boolean(),
  /** 5-second transition screen between blocks (SPEC v1.1 §7.3-13). */
  blockTransition: z.boolean(),
  /** Headstock shape for the tuning-peg direction picture (SPEC v1.1 §9.3). */
  headStyle: z.enum(['3+3', 'inline6']),
  micDisabled: z.boolean(),
  /**
   * Song play-along earphone choice per output device label (true = earphones, false = speakers, §8.6-1,
   * D-101). Written after every backing run, so it stays however long ago that device was last used.
   */
  earphonesByOutput: z.record(z.string(), z.boolean()),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  leftHanded: false,
  strictness: 'lenient',
  sensitivity: 'normal',
  visualOnlyMetronome: false,
  sessionMinutes: 20,
  sessionLengthMode: 'template',
  confirmedOverCap: false,
  preferredInputDeviceId: null,
  preferredOutputLabel: null,
  xStringCheck: false,
  customKeys: {},
  micOnboardingDone: false,
  blockTransition: true,
  headStyle: '3+3',
  micDisabled: false,
  earphonesByOutput: {},
};

/** The earphone choice of one backing run (output device label → earphones?). */
export interface EarphoneChoice {
  outputLabel: string;
  earphones: boolean;
}

/** The settings patch that remembers a run's earphone choice for its output device (D-101). */
export function rememberEarphones(
  settings: Pick<Settings, 'earphonesByOutput'>,
  choice: EarphoneChoice,
): Pick<Settings, 'earphonesByOutput'> {
  return { earphonesByOutput: { ...settings.earphonesByOutput, [choice.outputLabel]: choice.earphones } };
}

/** Fills missing keys from defaults (forward compatible with older exports). */
export function normalizeSettings(raw: unknown): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(typeof raw === 'object' && raw !== null ? raw : {}) };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
