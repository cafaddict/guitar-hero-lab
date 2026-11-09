/**
 * "이어서 한 번 더" in the session runner (SPEC v1.1 §7.3-12): what the next run of the current item plays — the
 * ladder's next tempo, or in the repertoire block the next repertoire song (§11.10) filed under that song.
 */
import type { RoutineItem } from '../../content/schemas';
import { songById } from '../../content/songs';
import type { PracticeHistory } from '../../domain/history';
import type { Attempt } from '../../domain/records';
import { itemKey, nextRepertoireSong, type RoutineInput } from '../../domain/routine';
import { exerciseDefinition } from '../../exercises/registry';
import { ko } from '../../i18n/ko';

/** The routine identity a run is stored under (its appearance key and the review it serves). */
export interface RunIdentity {
  routineKey: string | null;
  reviewOf: string | null;
}

/** Ladder exercises whose tempo is picked before the start (D-098). */
const TEMPO_PICK_TYPES: ReadonlySet<string> = new Set(['E5', 'E9', 'E10', 'E17']);

/**
 * The params a "same again" run of a ladder exercise starts from: the run's own (its picked tempo, D-098).
 * Undefined elsewhere — the item's params, as before (a song's recorded params would change its stage).
 */
export function sameRunParams(attempt: Attempt | null | undefined): unknown {
  return attempt && TEMPO_PICK_TYPES.has(attempt.exerciseType) ? attempt.params : undefined;
}

/**
 * The history the session was planned from, with the songs played in this session counted as played now (0
 * sessions ago) — so "한 번 더" in the repertoire block moves on to songs not played yet today (D-105).
 */
export function withSongsPlayed(history: PracticeHistory, songIds: Iterable<string>): PracticeHistory {
  const appearances = new Map(history.appearances);
  const now = { session: history.sessionNumber, day: history.practiceDay };
  for (const id of songIds) appearances.set(itemKey('S', `song:${id}`), now);
  return { ...history, appearances };
}

/**
 * "이어서 한 번 더" (§7.3-12): the ladder's next tempo — or, in the repertoire block, the repertoire song played
 * longest ago (§11.10, D-105). Null = no suggestion (repeat at the same params).
 */
export function repeatSuggestion(
  item: RoutineItem,
  attempt: Attempt,
  repertoire: Pick<RoutineInput, 'songs' | 'stage' | 'skills' | 'history'>,
): { params: unknown; label: string; identity?: RunIdentity } | null {
  const definition = exerciseDefinition(item.exerciseType);
  if (!definition) return null;
  if (item.block === 'repertoire') {
    const current = (attempt.params as { songId?: string }).songId ?? '';
    const next = nextRepertoireSong(repertoire, current);
    if (next) {
      const params = definition.parseParams({ ...(attempt.params as object), ...next, loopSection: null });
      // The run is the next song's: it appears (and is reviewed) as that song, not the item's (§11.10).
      const identity = { routineKey: itemKey('S', `song:${next.songId}`), reviewOf: null };
      return { params, label: ko.session.nextRepertoireSong(songById(next.songId).title), identity };
    }
  }
  const tempo = definition.suggestedTempoRetry(attempt.params, attempt.result);
  return tempo ? { params: tempo.params, label: ko.session.repeatAtBpm(tempo.bpm) } : null;
}
