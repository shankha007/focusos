import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStatsStore } from '@/store/useStatsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { achievementsRepo } from '@/db/repositories';
import { buildContext, evaluateAchievements } from '@/engine/achievements';

/**
 * Watches history for newly-cleared achievements and toasts them. Seeded on
 * first run so the user isn't buried in unlock notifications for things they
 * earned in past sessions.
 *
 * Unlocks are also written to the database. Whether a badge is earned stays
 * derived from session history — only the timestamp is stored, because that is
 * the one thing the history cannot reconstruct.
 */
export function useAchievementWatcher(): void {
  const sessions = useStatsStore((s) => s.sessions);
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoalSessions);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    const ctx = buildContext(sessions, dailyGoal);
    const unlocked = new Set(
      evaluateAchievements(ctx)
        .filter((a) => a.unlocked)
        .map((a) => a.id),
    );

    if (known.current === null) {
      known.current = unlocked;
      // Backfill anything earned before this ran. `markUnlocked` leaves rows it
      // already has alone, so the recorded time only stands in for badges that
      // were never captured.
      void achievementsRepo.markUnlocked([...unlocked]);
      return;
    }

    const states = evaluateAchievements(ctx);
    const fresh: string[] = [];
    for (const id of unlocked) {
      if (known.current.has(id)) continue;
      fresh.push(id);
      const def = states.find((a) => a.id === id);
      if (def) {
        toast.success(`Achievement unlocked — ${def.title}`, { description: def.description });
      }
    }
    void achievementsRepo.markUnlocked(fresh);
    known.current = unlocked;
  }, [sessions, dailyGoal]);
}
