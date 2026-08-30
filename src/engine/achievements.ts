import type { Session } from '@/types';
import { HOUR, MINUTE } from '@/lib/utils';
import { computeStreak, focusOnly } from './analytics';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  /** Returns progress 0–1 given the user's full history. */
  progress: (ctx: AchievementContext) => number;
  goalLabel: string;
}

export interface AchievementContext {
  sessions: Session[];
  totalFocusMs: number;
  completedSessions: number;
  currentStreak: number;
  longestStreak: number;
  earlyBirdSessions: number;
  nightOwlSessions: number;
  perfectDays: number;
  zeroDistractionSessions: number;
}

/** Rolls the entire session history into the counters every badge is scored against, so each definition stays a one-line comparison. */
export function buildContext(sessions: Session[], dailyGoal: number): AchievementContext {
  const focus = focusOnly(sessions);
  const completed = focus.filter((s) => s.completed);
  const { current, longest } = computeStreak(sessions);

  const byDay = new Map<string, number>();
  for (const s of completed) {
    const key = new Date(s.startedAt).toDateString();
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return {
    sessions,
    totalFocusMs: completed.reduce((a, s) => a + s.actualMs, 0),
    completedSessions: completed.length,
    currentStreak: current,
    longestStreak: longest,
    earlyBirdSessions: completed.filter((s) => new Date(s.startedAt).getHours() < 8).length,
    nightOwlSessions: completed.filter((s) => new Date(s.startedAt).getHours() >= 22).length,
    perfectDays: [...byDay.values()].filter((n) => n >= dailyGoal).length,
    zeroDistractionSessions: completed.filter((s) => s.distractionCount === 0).length,
  };
}

/** Progress toward a goal as 0–1, never overshooting past complete. */
const ratio = (value: number, goal: number) => Math.min(1, value / goal);

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-session',
    title: 'First Light',
    description: 'Complete your very first focus session.',
    icon: 'Sparkles',
    tier: 'bronze',
    goalLabel: '1 session',
    progress: (c) => ratio(c.completedSessions, 1),
  },
  {
    id: 'ten-sessions',
    title: 'Getting Traction',
    description: 'Complete 10 focus sessions.',
    icon: 'Rocket',
    tier: 'bronze',
    goalLabel: '10 sessions',
    progress: (c) => ratio(c.completedSessions, 10),
  },
  {
    id: 'fifty-sessions',
    title: 'Committed',
    description: 'Complete 50 focus sessions.',
    icon: 'Flame',
    tier: 'silver',
    goalLabel: '50 sessions',
    progress: (c) => ratio(c.completedSessions, 50),
  },
  {
    id: 'hundred-sessions',
    title: 'Centurion',
    description: 'Complete 100 focus sessions.',
    icon: 'Award',
    tier: 'gold',
    goalLabel: '100 sessions',
    progress: (c) => ratio(c.completedSessions, 100),
  },
  {
    id: 'ten-hours',
    title: 'Ten Hours Deep',
    description: 'Accumulate 10 hours of focused work.',
    icon: 'Hourglass',
    tier: 'silver',
    goalLabel: '10 hours',
    progress: (c) => ratio(c.totalFocusMs, 10 * HOUR),
  },
  {
    id: 'hundred-hours',
    title: 'Deep Work Master',
    description: 'Accumulate 100 hours of focused work.',
    icon: 'Crown',
    tier: 'platinum',
    goalLabel: '100 hours',
    progress: (c) => ratio(c.totalFocusMs, 100 * HOUR),
  },
  {
    id: 'streak-3',
    title: 'Three in a Row',
    description: 'Focus three days running.',
    icon: 'Zap',
    tier: 'bronze',
    goalLabel: '3-day streak',
    progress: (c) => ratio(c.longestStreak, 3),
  },
  {
    id: 'streak-7',
    title: 'Full Week',
    description: 'Keep a seven-day focus streak.',
    icon: 'CalendarCheck',
    tier: 'silver',
    goalLabel: '7-day streak',
    progress: (c) => ratio(c.longestStreak, 7),
  },
  {
    id: 'streak-30',
    title: 'Unbroken',
    description: 'Keep a thirty-day focus streak.',
    icon: 'Trophy',
    tier: 'platinum',
    goalLabel: '30-day streak',
    progress: (c) => ratio(c.longestStreak, 30),
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Complete 10 sessions before 8am.',
    icon: 'Sunrise',
    tier: 'silver',
    goalLabel: '10 early sessions',
    progress: (c) => ratio(c.earlyBirdSessions, 10),
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Complete 10 sessions after 10pm.',
    icon: 'Moon',
    tier: 'silver',
    goalLabel: '10 late sessions',
    progress: (c) => ratio(c.nightOwlSessions, 10),
  },
  {
    id: 'undistracted',
    title: 'Untouchable',
    description: 'Finish 25 sessions without logging a single distraction.',
    icon: 'ShieldCheck',
    tier: 'gold',
    goalLabel: '25 clean sessions',
    progress: (c) => ratio(c.zeroDistractionSessions, 25),
  },
  {
    id: 'perfect-days',
    title: 'Goal Crusher',
    description: 'Hit your daily session goal 10 times.',
    icon: 'Target',
    tier: 'gold',
    goalLabel: '10 perfect days',
    progress: (c) => ratio(c.perfectDays, 10),
  },
];

/* ── XP & levels ───────────────────────────────────────────── */

export const XP_PER_SESSION = 25;
export const XP_PER_FOCUS_MINUTE = 1;
export const XP_ACHIEVEMENT_BONUS = 100;

/** XP earned by one session: a flat award, a point per focused minute, and a bonus for finishing it undistracted. Unfinished sessions and breaks earn nothing. */
export function xpForSession(session: Session): number {
  if (session.type !== 'focus' || !session.completed) return 0;
  const minutes = Math.round(session.actualMs / MINUTE);
  const clean = session.distractionCount === 0 ? 15 : 0;
  return XP_PER_SESSION + minutes * XP_PER_FOCUS_MINUTE + clean;
}

/**
 * Levels grow quadratically so early progress feels quick and later levels
 * stay meaningful. Level n requires 100 * n^1.5 cumulative XP.
 */
export function levelForXp(xp: number): { level: number; into: number; needed: number; pct: number } {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = xp - base;
  const needed = next - base;
  return { level, into, needed, pct: needed > 0 ? into / needed : 0 };
}

/** Cumulative XP needed to reach `level`. Level 1 starts at zero. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 1.5));
}

export interface AchievementState extends AchievementDef {
  progressValue: number;
  unlocked: boolean;
}

/** Scores every badge against the current history, marking those at full progress as unlocked. */
export function evaluateAchievements(ctx: AchievementContext): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const p = def.progress(ctx);
    return { ...def, progressValue: p, unlocked: p >= 1 };
  });
}
