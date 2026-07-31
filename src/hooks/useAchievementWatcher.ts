import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStatsStore } from '@/store/useStatsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { buildContext, evaluateAchievements } from '@/engine/achievements';

/**
 * Watches history for newly-cleared achievements and toasts them. Seeded on
 * first run so the user isn't buried in unlock notifications for things they
 * earned in past sessions.
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
      return;
    }

    const states = evaluateAchievements(ctx);
    for (const id of unlocked) {
      if (known.current.has(id)) continue;
      const def = states.find((a) => a.id === id);
      if (def) {
        toast.success(`Achievement unlocked — ${def.title}`, { description: def.description });
      }
    }
    known.current = unlocked;
  }, [sessions, dailyGoal]);
}
