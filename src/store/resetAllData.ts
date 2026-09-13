import { clearAllData } from '@/db/repositories';
import { useHydrationStore } from './useHydrationStore';
import { useSettingsStore } from './useSettingsStore';
import { useStatsStore } from './useStatsStore';
import { useTaskStore } from './useTaskStore';
import { clearPersistedTimer, useTimerStore } from './useTimerStore';

/**
 * Erases the user's history: every task, session, distraction, badge and water
 * log, and the XP earned from them. Settings, categories and presets stay.
 *
 * This used to clear only the saved copy of the running timer. The timer itself
 * kept going in memory — the next pause wrote it straight back, and a session
 * left to finish would have been recorded into the history just wiped, crediting
 * a task that no longer existed. A replace-restore already stopped the clock
 * first; this now does the same, before anything is deleted.
 */
export async function resetAllData(): Promise<void> {
  useTimerStore.getState().reset();
  // A review or parked-thought prompt still waiting belongs to a session that is
  // about to be deleted. Answering it would write into a row that is gone.
  useTimerStore.setState({ pendingReview: null, pendingParked: [] });
  clearPersistedTimer();

  await clearAllData();
  await Promise.all([
    useTaskStore.getState().load(),
    useStatsStore.getState().refresh(),
    // The table is emptied above, but the store kept today's count on screen.
    useHydrationStore.getState().load(),
  ]);
  await useSettingsStore.getState().update({ xp: 0 });
}
