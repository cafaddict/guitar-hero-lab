/** The song's earphone choice is a device setting per output (D-101), saved when a run ends. */
import { rememberEarphones, type Settings } from '../../data/settings';
import type { ExerciseDefinition } from '../registry';

/** The part of the settings store this needs (useSettingsStore's state has it). */
export interface EarphoneSettingsStore {
  settings: Settings | null;
  load(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<unknown>;
}

/**
 * Writes the run's earphone choice under its output device label, keeping the other devices' choices.
 * Does nothing when the result carries no choice (backing off, no output label, other exercises).
 */
export async function saveEarphoneChoice(
  definition: Pick<ExerciseDefinition, 'earphoneChoice'>,
  result: unknown,
  store: EarphoneSettingsStore,
): Promise<void> {
  const choice = definition.earphoneChoice(result);
  if (!choice) return;
  const current = store.settings ?? (await store.load());
  await store.update(rememberEarphones(current, choice));
}
