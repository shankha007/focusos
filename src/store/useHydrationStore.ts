import { create } from 'zustand';
import { hydrationRepo } from '@/db/repositories';
import { dateKey } from '@/lib/utils';

interface HydrationState {
  /** The date the counts below belong to, so a session left open overnight can notice the rollover. */
  date: string;
  glasses: number;
  lastAt: number | null;
  loaded: boolean;
  load: () => Promise<void>;
  logGlass: () => Promise<void>;
  undoGlass: () => Promise<void>;
}

/**
 * Today's water intake. Only ever holds the current day — history stays in
 * IndexedDB and is read straight from the repo when a chart needs it.
 */
export const useHydrationStore = create<HydrationState>((set, get) => ({
  date: dateKey(),
  glasses: 0,
  lastAt: null,
  loaded: false,

  /** Reads today's row. Safe to call repeatedly; the break card calls it whenever a break starts, which is also how a past-midnight rollover gets picked up. */
  load: async () => {
    const today = dateKey();
    const row = await hydrationRepo.today();
    set({
      date: today,
      glasses: row?.glasses ?? 0,
      lastAt: row?.lastAt ?? null,
      loaded: true,
    });
  },

  /** Records one glass. */
  logGlass: async () => {
    const row = await hydrationRepo.logGlass();
    set({ date: row.date, glasses: row.glasses, lastAt: row.lastAt, loaded: true });
  },

  /** Takes the last glass back off, for a mis-tap. */
  undoGlass: async () => {
    if (get().glasses === 0) return;
    const row = await hydrationRepo.undoGlass();
    if (row) set({ date: row.date, glasses: row.glasses, lastAt: row.lastAt });
  },
}));
