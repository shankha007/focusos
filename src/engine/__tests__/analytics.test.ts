import { describe, expect, it } from 'vitest';
import type { Distraction, Session } from '@/types';
import {
  byHour,
  computeFocusScore,
  computeStreak,
  distractionPatterns,
  summarize,
  toDayStats,
} from '../analytics';
import { DAY, MINUTE, dateKey, startOfDay } from '@/lib/utils';

let counter = 0;
/** A completed focus session, with any field overridden. Ids are unique per call. */
function session(overrides: Partial<Session> = {}): Session {
  const startedAt = overrides.startedAt ?? Date.now();
  return {
    id: `s${counter++}`,
    type: 'focus',
    plannedMs: 25 * MINUTE,
    actualMs: 25 * MINUTE,
    startedAt,
    endedAt: startedAt + 25 * MINUTE,
    completed: true,
    distractionCount: 0,
    pausedMs: 0,
    ...overrides,
  };
}

/** A logged distraction, with any field overridden. */
function distraction(overrides: Partial<Distraction> = {}): Distraction {
  return {
    id: `d${counter++}`,
    categoryId: 'd-phone',
    at: Date.now(),
    ...overrides,
  };
}

describe('toDayStats', () => {
  it('groups focus time and sessions by local day', () => {
    const today = startOfDay() + 10 * 3_600_000;
    const stats = toDayStats(
      [session({ startedAt: today }), session({ startedAt: today + MINUTE })],
      [],
    );
    const row = stats.get(dateKey(today))!;
    expect(row.sessions).toBe(2);
    expect(row.focusMs).toBe(50 * MINUTE);
  });

  it('excludes breaks from focus totals', () => {
    const today = startOfDay() + 10 * 3_600_000;
    const stats = toDayStats(
      [session({ startedAt: today }), session({ startedAt: today, type: 'short-break' })],
      [],
    );
    expect(stats.get(dateKey(today))!.sessions).toBe(1);
  });

  it('averages ratings per day', () => {
    const today = startOfDay() + 10 * 3_600_000;
    const stats = toDayStats(
      [
        session({ startedAt: today, productivityAfter: 5, moodBefore: 4 }),
        session({ startedAt: today, productivityAfter: 3, moodBefore: 2 }),
      ],
      [],
    );
    const row = stats.get(dateKey(today))!;
    expect(row.avgProductivity).toBe(4);
    expect(row.avgMood).toBe(3);
  });
});

describe('computeStreak', () => {
  it('returns zero with no sessions', () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 });
  });

  it('counts consecutive days ending today', () => {
    const noon = startOfDay() + 12 * 3_600_000;
    const sessions = [0, 1, 2].map((d) => session({ startedAt: noon - d * DAY }));
    expect(computeStreak(sessions).current).toBe(3);
  });

  it('does not break the streak just because today has not started', () => {
    const noon = startOfDay() + 12 * 3_600_000;
    const sessions = [1, 2].map((d) => session({ startedAt: noon - d * DAY }));
    expect(computeStreak(sessions).current).toBe(2);
  });

  it('breaks the streak on a skipped day', () => {
    const noon = startOfDay() + 12 * 3_600_000;
    const sessions = [0, 1, 4, 5].map((d) => session({ startedAt: noon - d * DAY }));
    const { current, longest } = computeStreak(sessions);
    expect(current).toBe(2);
    expect(longest).toBe(2);
  });

  it('ignores incomplete sessions', () => {
    const noon = startOfDay() + 12 * 3_600_000;
    expect(computeStreak([session({ startedAt: noon, completed: false })]).current).toBe(0);
  });
});

describe('computeFocusScore', () => {
  it('is zero for an empty day', () => {
    expect(computeFocusScore([], [], 8).score).toBe(0);
  });

  it('rewards hitting the daily goal', () => {
    const four = Array.from({ length: 4 }, () => session());
    const eight = Array.from({ length: 8 }, () => session());
    expect(computeFocusScore(eight, [], 8).score).toBeGreaterThan(
      computeFocusScore(four, [], 8).score,
    );
  });

  it('penalises abandoned sessions', () => {
    const clean = [session(), session()];
    const messy = [session(), session({ completed: false })];
    expect(computeFocusScore(clean, [], 4).score).toBeGreaterThan(
      computeFocusScore(messy, [], 4).score,
    );
  });

  it('penalises distractions', () => {
    const sessions = [session(), session()];
    const many = Array.from({ length: 8 }, () => distraction());
    expect(computeFocusScore(sessions, [], 4).score).toBeGreaterThan(
      computeFocusScore(sessions, many, 4).score,
    );
  });

  it('never exceeds 100', () => {
    const lots = Array.from({ length: 30 }, () => session({ productivityAfter: 5 }));
    expect(computeFocusScore(lots, [], 4).score).toBeLessThanOrEqual(100);
  });
});

describe('byHour', () => {
  it('buckets sessions into the hour they started', () => {
    const nineAm = startOfDay() + 9 * 3_600_000;
    const rows = byHour([session({ startedAt: nineAm }), session({ startedAt: nineAm + MINUTE })]);
    expect(rows[9].sessions).toBe(2);
    expect(rows[10].sessions).toBe(0);
  });
});

describe('distractionPatterns', () => {
  const categories = [
    { id: 'd-phone', label: 'Phone', icon: 'Smartphone', color: '#f5a524', builtIn: true },
    { id: 'd-social', label: 'Social', icon: 'AtSign', color: '#ff6b8a', builtIn: true },
  ];

  it('ranks by frequency and computes share', () => {
    const rows = distractionPatterns(
      [
        distraction({ categoryId: 'd-phone' }),
        distraction({ categoryId: 'd-phone' }),
        distraction({ categoryId: 'd-social' }),
      ],
      categories,
    );
    expect(rows[0].categoryId).toBe('d-phone');
    expect(rows[0].count).toBe(2);
    expect(rows[0].share).toBeCloseTo(2 / 3);
  });

  it('averages where in a session the distraction hits', () => {
    const rows = distractionPatterns(
      [
        distraction({ sessionProgress: 0.4 }),
        distraction({ sessionProgress: 0.6 }),
      ],
      categories,
    );
    expect(rows[0].avgProgress).toBeCloseTo(0.5);
  });
});

describe('summarize', () => {
  it('reports completion rate over attempted sessions', () => {
    const result = summarize([session(), session({ completed: false })], []);
    expect(result.sessions).toBe(1);
    expect(result.completionRate).toBe(0.5);
  });

  it('handles an empty history without dividing by zero', () => {
    const result = summarize([], []);
    expect(result.focusMs).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.avgSessionMs).toBe(0);
    expect(result.bestDay).toBeNull();
  });
});
