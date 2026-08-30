import type { Session, Task } from '@/types';
import { MINUTE, clamp, mean } from '@/lib/utils';
import { byHour, focusOnly } from './analytics';

/**
 * Every recommendation carries the reasoning that produced it. A number the
 * user can't interrogate is a number they won't trust — and with sparse history
 * these are genuinely rough, so the UI needs to be able to say how rough.
 */
export interface Recommendation<T> {
  value: T;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

const MIN_SESSIONS_FOR_SIGNAL = 10;

/** How much to trust a recommendation drawn from `n` sessions. */
function confidenceFor(n: number): Recommendation<unknown>['confidence'] {
  if (n >= 40) return 'high';
  if (n >= MIN_SESSIONS_FOR_SIGNAL) return 'medium';
  return 'low';
}

/** Candidate session lengths we're willing to recommend, in minutes. */
const LENGTH_BUCKETS = [15, 20, 25, 30, 40, 45, 50, 60];

/** Snaps an arbitrary session length to the nearest candidate bucket, so 24- and 26-minute sessions are counted as the same experiment. */
function bucketFor(ms: number): number {
  const mins = ms / MINUTE;
  return LENGTH_BUCKETS.reduce((best, b) =>
    Math.abs(b - mins) < Math.abs(best - mins) ? b : best,
  );
}

/**
 * Scores each duration the user has actually tried on completion rate and
 * self-reported productivity, then picks the best. Completion is weighted
 * higher: a 60-minute session that gets abandoned half the time is worse than a
 * 25-minute one that always lands, whatever it scores on productivity.
 */
export function recommendSessionLength(
  sessions: Session[],
  currentMs: number,
): Recommendation<number> {
  const focus = focusOnly(sessions);

  if (focus.length < MIN_SESSIONS_FOR_SIGNAL) {
    return {
      value: currentMs,
      reason: `Keeping your current ${Math.round(currentMs / MINUTE)}-minute sessions — needs ${MIN_SESSIONS_FOR_SIGNAL - focus.length} more sessions before there's a pattern to read.`,
      confidence: 'low',
    };
  }

  const buckets = new Map<number, { completed: number; total: number; prod: number[] }>();
  for (const s of focus) {
    const b = bucketFor(s.plannedMs);
    const row = buckets.get(b) ?? { completed: 0, total: 0, prod: [] };
    row.total += 1;
    if (s.completed) row.completed += 1;
    if (s.productivityAfter) row.prod.push(s.productivityAfter);
    buckets.set(b, row);
  }

  const scored = [...buckets.entries()]
    .filter(([, r]) => r.total >= 3)
    .map(([mins, r]) => {
      const completion = r.completed / r.total;
      const prod = mean(r.prod);
      const prodNorm = prod !== null ? (prod - 1) / 4 : 0.5;
      return { mins, score: completion * 0.6 + prodNorm * 0.4, completion, prod, n: r.total };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      value: currentMs,
      reason: 'Not enough repeats at any one length yet — try sticking with one duration for a few sessions.',
      confidence: 'low',
    };
  }

  const best = scored[0];
  const pct = Math.round(best.completion * 100);
  const prodText = best.prod !== null ? ` and rated ${best.prod.toFixed(1)}/5 for productivity` : '';

  return {
    value: best.mins * MINUTE,
    reason: `Your ${best.mins}-minute sessions finish ${pct}% of the time${prodText} across ${best.n} sessions — your strongest length so far.`,
    confidence: confidenceFor(focus.length),
  };
}

/**
 * Break length is inferred from what actually restores the user: productivity
 * of the session *following* each break, grouped by how long that break ran.
 */
export function recommendBreakLength(
  sessions: Session[],
  currentMs: number,
): Recommendation<number> {
  const ordered = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const pairs: { breakMins: number; nextProd: number }[] = [];

  for (let i = 0; i < ordered.length - 1; i++) {
    const cur = ordered[i];
    const next = ordered[i + 1];
    if (cur.type === 'focus' || next.type !== 'focus' || !next.productivityAfter) continue;
    pairs.push({
      breakMins: Math.round(cur.actualMs / MINUTE),
      nextProd: next.productivityAfter,
    });
  }

  if (pairs.length < 6) {
    return {
      value: currentMs,
      reason: `Sticking with ${Math.round(currentMs / MINUTE)}-minute breaks until there's more data on what actually recharges you.`,
      confidence: 'low',
    };
  }

  const groups = new Map<number, number[]>();
  for (const p of pairs) {
    const key = clamp(Math.round(p.breakMins / 5) * 5, 5, 30);
    const arr = groups.get(key) ?? [];
    arr.push(p.nextProd);
    groups.set(key, arr);
  }

  const best = [...groups.entries()]
    .filter(([, v]) => v.length >= 2)
    .map(([mins, v]) => ({ mins, prod: mean(v)!, n: v.length }))
    .sort((a, b) => b.prod - a.prod)[0];

  if (!best) {
    return { value: currentMs, reason: 'Break data is still too scattered to call.', confidence: 'low' };
  }

  return {
    value: best.mins * MINUTE,
    reason: `Sessions after a ${best.mins}-minute break average ${best.prod.toFixed(1)}/5 — your best recovery window.`,
    confidence: confidenceFor(pairs.length * 2),
  };
}

export interface PeakWindow {
  startHour: number;
  endHour: number;
  avgProductivity: number | null;
  sessions: number;
}

/**
 * Finds the contiguous 3-hour block with the strongest combined focus volume
 * and quality — the window worth defending for deep work.
 */
export function findPeakWindows(sessions: Session[]): Recommendation<PeakWindow[]> {
  const hours = byHour(sessions);
  const focus = focusOnly(sessions);

  if (focus.length < MIN_SESSIONS_FOR_SIGNAL) {
    return {
      value: [],
      reason: 'Your peak hours will show up here once you have around ten sessions logged.',
      confidence: 'low',
    };
  }

  const windows: (PeakWindow & { score: number })[] = [];
  for (let h = 0; h <= 21; h++) {
    const slice = hours.slice(h, h + 3);
    const total = slice.reduce((a, b) => a + b.sessions, 0);
    if (total === 0) continue;
    const prod = mean(
      slice.map((s) => s.avgProductivity).filter((v): v is number => typeof v === 'number'),
    );
    const completion = mean(slice.filter((s) => s.sessions > 0).map((s) => s.completionRate)) ?? 0;
    windows.push({
      startHour: h,
      endHour: h + 3,
      avgProductivity: prod,
      sessions: total,
      score: total * 0.5 + (prod ?? 3) * 2 + completion * 3,
    });
  }

  const top = windows.sort((a, b) => b.score - a.score).slice(0, 2).map(({ score: _score, ...w }) => w);

  if (top.length === 0) {
    return { value: [], reason: 'No clear peak window yet.', confidence: 'low' };
  }

  return {
    value: top,
    reason: `You log the most productive focus between ${fmtHour(top[0].startHour)} and ${fmtHour(top[0].endHour)} — protect that block.`,
    confidence: confidenceFor(focus.length),
  };
}

/** An hour of the day as "9am" / "3pm". Wraps, so hour 25 reads as 1am. */
export function fmtHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const suffix = hour < 12 ? 'am' : 'pm';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

/**
 * Estimates remaining sessions for a task using the user's own historical
 * throughput on similar tasks, falling back to their stated estimate.
 */
export function estimateTaskSessions(
  task: Task,
  sessions: Session[],
): Recommendation<number> {
  const remaining = Math.max(0, task.estimatedSessions - task.completedSessions);

  const sameCategory = focusOnly(sessions).filter(
    (s) => s.categoryId && s.categoryId === task.categoryId && s.completed,
  );

  if (sameCategory.length < 5) {
    return {
      value: remaining,
      reason: `Based on your estimate of ${task.estimatedSessions} ${task.estimatedSessions === 1 ? 'session' : 'sessions'}.`,
      confidence: 'low',
    };
  }

  // How much do tasks in this category historically overrun their estimate?
  const byTask = new Map<string, number>();
  for (const s of sameCategory) {
    if (!s.taskId) continue;
    byTask.set(s.taskId, (byTask.get(s.taskId) ?? 0) + 1);
  }
  const avgActual = mean([...byTask.values()]);

  if (avgActual === null || byTask.size < 2) {
    return { value: remaining, reason: `Based on your estimate.`, confidence: 'low' };
  }

  const adjusted = Math.max(remaining, Math.round(avgActual - task.completedSessions));

  return {
    value: Math.max(0, adjusted),
    reason:
      adjusted > remaining
        ? `Similar tasks took you about ${avgActual.toFixed(1)} sessions, a bit more than estimated.`
        : `In line with the ${avgActual.toFixed(1)} sessions similar tasks usually take.`,
    confidence: confidenceFor(sameCategory.length),
  };
}

export interface PlanBlock {
  taskId: string;
  title: string;
  startHour: number;
  sessions: number;
  rationale: string;
}

/**
 * Orders the day: highest-priority work is scheduled into the user's peak
 * window, lighter work into the shoulders. Deliberately conservative — it plans
 * the daily goal, not every open task, so the plan stays achievable.
 */
export function buildDailyPlan(
  tasks: Task[],
  sessions: Session[],
  dailyGoalSessions: number,
): Recommendation<PlanBlock[]> {
  const open = tasks
    // A task that has already met its estimate has nothing left to schedule,
    // even though it stays open until the user ticks it off.
    .filter((t) => t.status === 'todo' || t.status === 'active')
    .filter((t) => t.estimatedSessions - t.completedSessions > 0)
    .sort((a, b) => {
      const weight: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const p = weight[a.priority] - weight[b.priority];
      if (p !== 0) return p;
      return a.order - b.order;
    });

  if (open.length === 0) {
    return {
      value: [],
      reason: 'Add a task or two and a suggested running order will appear here.',
      confidence: 'low',
    };
  }

  const peak = findPeakWindows(sessions);
  const startHour = peak.value[0]?.startHour ?? Math.max(9, new Date().getHours());

  const blocks: PlanBlock[] = [];
  let hour = startHour;
  let budget = dailyGoalSessions;

  for (const task of open) {
    if (budget <= 0) break;
    const need = task.estimatedSessions - task.completedSessions;
    const alloc = Math.min(need, budget, 4);
    blocks.push({
      taskId: task.id,
      title: task.title,
      startHour: hour % 24,
      sessions: alloc,
      rationale:
        blocks.length === 0
          ? peak.value.length > 0
            ? 'Scheduled first — it lands in your most productive window.'
            : 'Starts the day — nothing open outranks it.'
          : task.priority === 'urgent' || task.priority === 'high'
            ? 'High priority, so it goes early while attention is fresh.'
            : 'Slotted after the heavier work.',
    });
    budget -= alloc;
    hour += Math.max(1, Math.round(alloc * 0.6));
  }

  return {
    value: blocks,
    reason:
      peak.value.length > 0
        ? `Built around your ${fmtHour(startHour)} peak, capped at your ${dailyGoalSessions}-session daily goal.`
        : `Ordered by priority, capped at your ${dailyGoalSessions}-session daily goal.`,
    confidence: peak.confidence,
  };
}

export interface AdaptiveInsights {
  sessionLength: Recommendation<number>;
  breakLength: Recommendation<number>;
  peakWindows: Recommendation<PeakWindow[]>;
  plan: Recommendation<PlanBlock[]>;
}

/** Runs every recommendation in one pass — what the settings and dashboard screens read. */
export function computeAdaptive(
  sessions: Session[],
  tasks: Task[],
  settings: { focusMs: number; shortBreakMs: number; dailyGoalSessions: number },
): AdaptiveInsights {
  return {
    sessionLength: recommendSessionLength(sessions, settings.focusMs),
    breakLength: recommendBreakLength(sessions, settings.shortBreakMs),
    peakWindows: findPeakWindows(sessions),
    plan: buildDailyPlan(tasks, sessions, settings.dailyGoalSessions),
  };
}
