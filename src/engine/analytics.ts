import type {
  Category,
  DayStat,
  Distraction,
  DistractionCategory,
  Rating,
  Session,
} from '@/types';
import {
  DAY,
  MINUTE,
  addDays,
  clamp,
  correlation,
  dateKey,
  mean,
  startOfDay,
  sum,
} from '@/lib/utils';

/** Drops breaks — most stats are about focus time only. */
export const focusOnly = (sessions: Session[]) => sessions.filter((s) => s.type === 'focus');

/**
 * Total time actually spent focusing, across every focus session in `sessions`.
 *
 * The one definition of "focus time" in the app. There used to be two: the
 * dashboard summed only completed sessions while analytics summed them all, so
 * abandoning a twenty-minute session made the two screens disagree about the
 * same day — and the chart captioned "Completed focus per day" was plotting
 * both.
 *
 * Abandoned time counts. `actualMs` is already exclusive of paused stretches
 * and capped at the planned length, so it is time the user genuinely spent
 * focusing; that they went on to skip the session does not unspend it. Whether
 * they saw it through is what the separate session count is for.
 */
export function focusTimeMs(sessions: Session[]): number {
  return sum(focusOnly(sessions).map((s) => s.actualMs));
}

/* ── Daily rollups ─────────────────────────────────────────── */

/** Buckets sessions and distractions into one row per calendar day, keyed by local date. Only days with activity appear; use `dayRange` to fill the gaps. */
export function toDayStats(sessions: Session[], distractions: Distraction[]): Map<string, DayStat> {
  const map = new Map<string, DayStat>();

  /** The row for a date, created empty on first sight of that day. */
  const ensure = (key: string): DayStat => {
    let row = map.get(key);
    if (!row) {
      row = { date: key, focusMs: 0, sessions: 0, distractions: 0, avgProductivity: null, avgMood: null };
      map.set(key, row);
    }
    return row;
  };

  const prodBuckets = new Map<string, number[]>();
  const moodBuckets = new Map<string, number[]>();

  for (const s of focusOnly(sessions)) {
    const key = dateKey(s.startedAt);
    const row = ensure(key);
    row.focusMs += s.actualMs;
    if (s.completed) row.sessions += 1;
    if (s.productivityAfter) {
      const arr = prodBuckets.get(key) ?? [];
      arr.push(s.productivityAfter);
      prodBuckets.set(key, arr);
    }
    if (s.moodBefore) {
      const arr = moodBuckets.get(key) ?? [];
      arr.push(s.moodBefore);
      moodBuckets.set(key, arr);
    }
  }

  for (const d of distractions) {
    ensure(dateKey(d.at)).distractions += 1;
  }

  for (const [key, row] of map) {
    row.avgProductivity = mean(prodBuckets.get(key) ?? []);
    row.avgMood = mean(moodBuckets.get(key) ?? []);
  }

  return map;
}

/** Contiguous series including zero-days, so charts don't lie by omission. */
export function dayRange(from: number, to: number, stats: Map<string, DayStat>): DayStat[] {
  const out: DayStat[] = [];
  for (let t = startOfDay(from); t <= to; t = addDays(t, 1)) {
    const key = dateKey(t);
    out.push(
      stats.get(key) ?? {
        date: key,
        focusMs: 0,
        sessions: 0,
        distractions: 0,
        avgProductivity: null,
        avgMood: null,
      },
    );
  }
  return out;
}

/* ── Streaks ───────────────────────────────────────────────── */

/**
 * A day counts toward the streak once it has at least one completed focus
 * session. Today not yet being started doesn't break the streak — otherwise the
 * number would read zero every morning, which is demoralizing and wrong.
 */
export function computeStreak(sessions: Session[]): { current: number; longest: number } {
  const days = new Set(
    focusOnly(sessions)
      .filter((s) => s.completed)
      .map((s) => dateKey(s.startedAt)),
  );
  if (days.size === 0) return { current: 0, longest: 0 };

  let current = 0;
  const today = startOfDay();
  const startFrom = days.has(dateKey(today)) ? today : addDays(today, -1);
  for (let t = startFrom; ; t = addDays(t, -1)) {
    if (!days.has(dateKey(t))) break;
    current += 1;
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of sorted) {
    const ts = new Date(`${key}T00:00:00`).getTime();
    run = prev !== null && Math.round((ts - prev) / DAY) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = ts;
  }

  return { current, longest };
}

/* ── Focus score ───────────────────────────────────────────── */

export interface FocusScore {
  score: number;
  parts: { label: string; value: number; max: number }[];
}

/**
 * A single 0–100 read on the day, blending volume, follow-through, focus
 * quality, and how little the user got pulled away. Weighted so that finishing
 * what you start matters more than raw hours logged.
 */
export function computeFocusScore(
  todaySessions: Session[],
  todayDistractions: Distraction[],
  dailyGoalSessions: number,
): FocusScore {
  const focus = focusOnly(todaySessions);
  const completed = focus.filter((s) => s.completed);

  // A day with no attempts scores zero. Otherwise the quality and
  // "undistracted" components would award points for doing nothing at all.
  if (focus.length === 0) {
    return {
      score: 0,
      parts: [
        { label: 'Daily goal', value: 0, max: 40 },
        { label: 'Follow-through', value: 0, max: 25 },
        { label: 'Session quality', value: 0, max: 20 },
        { label: 'Undistracted', value: 0, max: 15 },
      ],
    };
  }

  const goalPart = clamp(completed.length / Math.max(1, dailyGoalSessions), 0, 1) * 40;

  const completionRate = focus.length > 0 ? completed.length / focus.length : 0;
  const consistencyPart = completionRate * 25;

  const prod = mean(focus.map((s) => s.productivityAfter).filter((v): v is Rating => !!v));
  const qualityPart = prod !== null ? ((prod - 1) / 4) * 20 : 12;

  const perSession = focus.length > 0 ? todayDistractions.length / focus.length : 0;
  const focusPart = clamp(1 - perSession / 4, 0, 1) * 15;

  const score = Math.round(goalPart + consistencyPart + qualityPart + focusPart);

  return {
    score: clamp(score, 0, 100),
    parts: [
      { label: 'Daily goal', value: Math.round(goalPart), max: 40 },
      { label: 'Follow-through', value: Math.round(consistencyPart), max: 25 },
      { label: 'Session quality', value: Math.round(qualityPart), max: 20 },
      { label: 'Undistracted', value: Math.round(focusPart), max: 15 },
    ],
  };
}

/* ── Hour-of-day productivity ──────────────────────────────── */

export interface HourStat {
  hour: number;
  focusMs: number;
  sessions: number;
  avgProductivity: number | null;
  completionRate: number;
}

/** Focus totals split across the 24 hours of the day, aggregated over every date in `sessions` — the basis for spotting peak hours. */
export function byHour(sessions: Session[]): HourStat[] {
  const buckets: { ms: number; total: number; completed: number; prod: number[] }[] = Array.from(
    { length: 24 },
    () => ({ ms: 0, total: 0, completed: 0, prod: [] }),
  );

  for (const s of focusOnly(sessions)) {
    const h = new Date(s.startedAt).getHours();
    buckets[h].ms += s.actualMs;
    buckets[h].total += 1;
    if (s.completed) buckets[h].completed += 1;
    if (s.productivityAfter) buckets[h].prod.push(s.productivityAfter);
  }

  return buckets.map((b, hour) => ({
    hour,
    focusMs: b.ms,
    sessions: b.total,
    avgProductivity: mean(b.prod),
    completionRate: b.total > 0 ? b.completed / b.total : 0,
  }));
}

/* ── Distraction patterns ──────────────────────────────────── */

export interface DistractionPattern {
  categoryId: string;
  label: string;
  color: string;
  count: number;
  share: number;
  /** Mean position within a session, 0–1. Reveals when in a session drift hits. */
  avgProgress: number | null;
  peakHour: number | null;
}

/** Groups distractions by what caused them, ranked most frequent first, with each one's share of the total, typical point in a session, and busiest hour. */
export function distractionPatterns(
  distractions: Distraction[],
  categories: DistractionCategory[],
): DistractionPattern[] {
  const byCat = new Map<string, Distraction[]>();
  for (const d of distractions) {
    const arr = byCat.get(d.categoryId) ?? [];
    arr.push(d);
    byCat.set(d.categoryId, arr);
  }

  const total = distractions.length;

  return [...byCat.entries()]
    .map(([categoryId, rows]) => {
      const cat = categories.find((c) => c.id === categoryId);
      const hours = new Map<number, number>();
      for (const r of rows) {
        const h = new Date(r.at).getHours();
        hours.set(h, (hours.get(h) ?? 0) + 1);
      }
      const peak = [...hours.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        categoryId,
        label: cat?.label ?? 'Other',
        color: cat?.color ?? '#94a3b8',
        count: rows.length,
        share: total > 0 ? rows.length / total : 0,
        avgProgress: mean(
          rows.map((r) => r.sessionProgress).filter((v): v is number => typeof v === 'number'),
        ),
        peakHour: peak ? peak[0] : null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

/* ── Category breakdown ────────────────────────────────────── */

export interface CategoryStat {
  /** Undefined for focus time that was never attached to a categorised task. */
  categoryId: string | undefined;
  name: string;
  color: string;
  focusMs: number;
  sessions: number;
  /** Share of the period's focus time, 0-1. */
  share: number;
  avgProductivity: number | null;
}

/** Colour for the bucket holding focus that belongs to no category. */
const UNCATEGORISED_COLOR = '#9aa0b4';

/**
 * Splits focus time across the categories it was logged against, largest first.
 *
 * Sessions only carry a category if one was stamped at completion, and history
 * from before that is filled in from the task where the task still exists. What
 * is left over is real focus time with nothing to attribute it to, so it gets
 * its own bucket rather than being dropped — a breakdown that silently omitted
 * a third of the week would be worse than one that admits the gap.
 */
export function byCategory(sessions: Session[], categories: Category[]): CategoryStat[] {
  const buckets = new Map<
    string | undefined,
    { focusMs: number; sessions: number; prod: number[] }
  >();

  for (const s of focusOnly(sessions)) {
    const row = buckets.get(s.categoryId) ?? { focusMs: 0, sessions: 0, prod: [] };
    row.focusMs += s.actualMs;
    if (s.completed) row.sessions += 1;
    if (s.productivityAfter) row.prod.push(s.productivityAfter);
    buckets.set(s.categoryId, row);
  }

  const total = sum([...buckets.values()].map((b) => b.focusMs));

  return [...buckets.entries()]
    .map(([categoryId, row]) => {
      const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
      return {
        categoryId,
        // A category deleted since the session was logged still has time against
        // it. Calling that "Uncategorised" would be wrong — the work did have a
        // category — so say what is actually known.
        name: category?.name ?? (categoryId ? 'Deleted category' : 'Uncategorised'),
        color: category?.color ?? UNCATEGORISED_COLOR,
        focusMs: row.focusMs,
        sessions: row.sessions,
        share: total > 0 ? row.focusMs / total : 0,
        avgProductivity: mean(row.prod),
      };
    })
    .sort((a, b) => b.focusMs - a.focusMs);
}

/* ── Mood ↔ productivity ───────────────────────────────────── */

export interface MoodCorrelation {
  moodToProductivity: number | null;
  energyToProductivity: number | null;
  points: { mood: number; energy: number; productivity: number; focusMs: number }[];
  byMood: { mood: number; avgProductivity: number; count: number }[];
}

/** Relates how the user felt going into a session to how productive they rated it afterwards. Only sessions with all three ratings are included. */
export function moodCorrelation(sessions: Session[]): MoodCorrelation {
  const points = focusOnly(sessions)
    .filter((s) => s.moodBefore && s.energyBefore && s.productivityAfter)
    .map((s) => ({
      mood: s.moodBefore!,
      energy: s.energyBefore!,
      productivity: s.productivityAfter!,
      focusMs: s.actualMs,
    }));

  const byMoodMap = new Map<number, number[]>();
  for (const p of points) {
    const arr = byMoodMap.get(p.mood) ?? [];
    arr.push(p.productivity);
    byMoodMap.set(p.mood, arr);
  }

  return {
    moodToProductivity: correlation(
      points.map((p) => p.mood),
      points.map((p) => p.productivity),
    ),
    energyToProductivity: correlation(
      points.map((p) => p.energy),
      points.map((p) => p.productivity),
    ),
    points,
    byMood: [...byMoodMap.entries()]
      .map(([mood, vals]) => ({ mood, avgProductivity: mean(vals)!, count: vals.length }))
      .sort((a, b) => a.mood - b.mood),
  };
}

/* ── Summary totals ────────────────────────────────────────── */

export interface PeriodSummary {
  focusMs: number;
  sessions: number;
  completionRate: number;
  distractions: number;
  avgSessionMs: number;
  avgProductivity: number | null;
  bestDay: DayStat | null;
  activeDays: number;
}

/** Headline totals for a period — the numbers shown on the analytics cards and at the top of the PDF report. */
export function summarize(sessions: Session[], distractions: Distraction[]): PeriodSummary {
  const focus = focusOnly(sessions);
  const completed = focus.filter((s) => s.completed);
  const stats = toDayStats(sessions, distractions);
  const days = [...stats.values()];

  return {
    focusMs: focusTimeMs(sessions),
    sessions: completed.length,
    completionRate: focus.length > 0 ? completed.length / focus.length : 0,
    distractions: distractions.length,
    avgSessionMs: completed.length > 0 ? sum(completed.map((s) => s.actualMs)) / completed.length : 0,
    avgProductivity: mean(
      focus.map((s) => s.productivityAfter).filter((v): v is Rating => typeof v === 'number'),
    ),
    bestDay: days.length > 0 ? days.reduce((a, b) => (b.focusMs > a.focusMs ? b : a)) : null,
    activeDays: days.filter((d) => d.focusMs > 0).length,
  };
}

/** Heatmap cells for the trailing year, GitHub-contribution style. */
export function heatmapData(stats: Map<string, DayStat>, weeks = 53) {
  const today = startOfDay();
  const end = today;
  // Back up to the Monday that starts the window.
  const start = addDays(end, -(weeks * 7 - 1));
  const days = dayRange(start, end, stats);
  const max = Math.max(...days.map((d) => d.focusMs), MINUTE);

  return days.map((d) => ({
    ...d,
    level: d.focusMs === 0 ? 0 : (Math.min(4, Math.ceil((d.focusMs / max) * 4)) as 0 | 1 | 2 | 3 | 4),
    ts: new Date(`${d.date}T00:00:00`).getTime(),
  }));
}
