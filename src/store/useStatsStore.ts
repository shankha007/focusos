import { create } from 'zustand';
import type { Distraction, Session } from '@/types';
import { distractionsRepo, sessionsRepo } from '@/db/repositories';

interface StatsState {
  sessions: Session[];
  distractions: Distraction[];
  loaded: boolean;
  /** Re-reads everything. For when history is replaced wholesale — boot, a restore, a reset. */
  refresh: () => Promise<void>;
  /** Adds a session, or replaces the one with the same id, keeping history in order. */
  upsertSession: (session: Session) => void;
  /** Adds a newly logged distraction, keeping history in order. */
  addDistraction: (distraction: Distraction) => void;
  /** Drops every distraction logged against a session that was never written. */
  removeDistractionsForSession: (sessionId: string) => void;
  /** Drops a deleted session, and the distractions that belonged to it. */
  removeSession: (sessionId: string) => void;
}

/** Orders like IndexedDB does: by the indexed field, then by primary key, compared by code unit. */
function byKeyThenId<T extends { id: string }>(key: (row: T) => number) {
  return (a: T, b: T) => key(a) - key(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Returns `rows` with `row` in place, replacing any row that shares its id.
 *
 * The result must be ordered exactly as a fresh read would be, or every chart
 * that assumes chronological order breaks subtly. A new row is almost always
 * the latest, so appending is correct and skips the sort; anything else — an
 * edit to an older session — falls through to one.
 */
function upsertInOrder<T extends { id: string }>(rows: T[], row: T, key: (row: T) => number): T[] {
  const compare = byKeyThenId(key);
  const others = rows.filter((existing) => existing.id !== row.id);
  const last = others[others.length - 1];
  if (!last || compare(last, row) < 0) return [...others, row];
  return [...others, row].sort(compare);
}

/**
 * Holds the full history in memory. Even a heavy user generates only a few
 * thousand sessions a year, which is far cheaper to keep resident than to
 * re-query on every chart render.
 *
 * It is kept current by applying each change as it happens rather than by
 * re-reading. Every session end and every logged distraction used to call
 * `refresh`, which read and deserialised the entire sessions and distractions
 * tables to change one row — and replaced both arrays, invalidating every
 * memoised chart and every per-row estimate on the task board. Cheap at two
 * hundred sessions; the app is meant to be used for years.
 */
export const useStatsStore = create<StatsState>((set) => ({
  sessions: [],
  distractions: [],
  loaded: false,

  refresh: async () => {
    const [sessions, distractions] = await Promise.all([
      sessionsRepo.all(),
      distractionsRepo.all(),
    ]);
    set({ sessions, distractions, loaded: true });
  },

  upsertSession: (session) => {
    set((state) => ({
      sessions: upsertInOrder(state.sessions, session, (s) => s.startedAt),
    }));
  },

  addDistraction: (distraction) => {
    set((state) => ({
      distractions: upsertInOrder(state.distractions, distraction, (d) => d.at),
    }));
  },

  removeDistractionsForSession: (sessionId) => {
    set((state) => {
      const kept = state.distractions.filter((d) => d.sessionId !== sessionId);
      // Leave the array untouched when nothing matched, so subscribers that
      // compare by identity do not re-render for a change that did not happen.
      return kept.length === state.distractions.length ? state : { distractions: kept };
    });
  },

  removeSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      distractions: state.distractions.filter((d) => d.sessionId !== sessionId),
    }));
  },
}));
