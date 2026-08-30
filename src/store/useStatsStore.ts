import { create } from 'zustand';
import type { Distraction, Session } from '@/types';
import { distractionsRepo, sessionsRepo } from '@/db/repositories';

interface StatsState {
  sessions: Session[];
  distractions: Distraction[];
  loaded: boolean;
  refresh: () => Promise<void>;
}

/**
 * Holds the full history in memory. Even a heavy user generates only a few
 * thousand sessions a year, which is far cheaper to keep resident than to
 * re-query on every chart render.
 */
export const useStatsStore = create<StatsState>((set) => ({
  sessions: [],
  distractions: [],
  loaded: false,

  /** Re-reads every session and distraction from IndexedDB. Call after anything that writes history, so open charts pick the change up. */
  refresh: async () => {
    const [sessions, distractions] = await Promise.all([
      sessionsRepo.all(),
      distractionsRepo.all(),
    ]);
    set({ sessions, distractions, loaded: true });
  },
}));
