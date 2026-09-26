import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStatsStore } from '@/store/useStatsStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { achievementsRepo } from '@/db/repositories';
import { buildContext, evaluateAchievements } from '@/engine/achievements';
import type { Session } from '@/types';

/** The ids of every achievement `sessions` has earned. */
function unlockedIds(sessions: Session[], dailyGoal: number): Set<string> {
  return new Set(
    evaluateAchievements(buildContext(sessions, dailyGoal))
      .filter((a) => a.unlocked)
      .map((a) => a.id),
  );
}

/** What history had already earned when the app began opening — see below. */
let baseline: Set<string> | null = null;

/**
 * Records what history had already earned, before opening the app adds any
 * sessions of its own.
 *
 * Opening can add sessions: one that ran out while the tab was closed is
 * completed as the timer resumes, and one finished on the landing page is
 * adopted. The watcher seeds silently on its first run so nobody is buried in
 * notifications for badges earned long ago — but seeding after those were
 * added swallowed exactly the badges they had just earned, a first session's
 * included. Workspace calls this first, so they are announced like any other.
 */
export function captureAchievementBaseline(sessions: Session[], dailyGoal: number): void {
  baseline = unlockedIds(sessions, dailyGoal);
}

/**
 * Watches history for newly-cleared achievements and toasts them. Seeded on
 * first run — from the baseline captured as the app opened, when there is one —
 * so the user isn't buried in unlock notifications for things they earned in
 * past sessions.
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
    const states = evaluateAchievements(buildContext(sessions, dailyGoal));
    const unlocked = new Set(states.filter((a) => a.unlocked).map((a) => a.id));

    if (known.current === null) {
      const before = baseline ?? unlocked;
      baseline = null;
      known.current = before;
      // Backfill anything earned before this ran. `markUnlocked` leaves rows it
      // already has alone, so the recorded time only stands in for badges that
      // were never captured.
      void achievementsRepo.markUnlocked([...before]);
      // Anything opening the app earned is announced below, like a live unlock.
    }

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
