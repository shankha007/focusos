import { describe, expect, it } from 'vitest';
import type { Session, Task } from '@/types';
import {
  buildDailyPlan,
  estimateTaskSessions,
  findPeakWindows,
  recommendSessionLength,
} from '../adaptive';
import { levelForXp, xpForLevel, xpForSession } from '../achievements';
import { MINUTE, startOfDay } from '@/lib/utils';

let counter = 0;
function session(overrides: Partial<Session> = {}): Session {
  const startedAt = overrides.startedAt ?? startOfDay() + 10 * 3_600_000;
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

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: `t${counter++}`,
    title: 'Task',
    status: 'todo',
    priority: 'medium',
    estimatedSessions: 2,
    completedSessions: 0,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    ...overrides,
  };
}

describe('recommendSessionLength', () => {
  it('keeps the current length when history is thin', () => {
    const rec = recommendSessionLength([session(), session()], 25 * MINUTE);
    expect(rec.value).toBe(25 * MINUTE);
    expect(rec.confidence).toBe('low');
  });

  it('prefers the length the user actually finishes', () => {
    const sessions = [
      // 50-minute sessions mostly abandoned.
      ...Array.from({ length: 6 }, (_, i) =>
        session({ plannedMs: 50 * MINUTE, completed: i < 2, productivityAfter: 4 }),
      ),
      // 25-minute sessions reliably completed.
      ...Array.from({ length: 6 }, () =>
        session({ plannedMs: 25 * MINUTE, completed: true, productivityAfter: 4 }),
      ),
    ];
    const rec = recommendSessionLength(sessions, 50 * MINUTE);
    expect(rec.value).toBe(25 * MINUTE);
    expect(rec.reason).toContain('25');
  });

  it('gains confidence with more history', () => {
    const many = Array.from({ length: 45 }, () => session({ productivityAfter: 4 }));
    expect(recommendSessionLength(many, 25 * MINUTE).confidence).toBe('high');
  });
});

describe('findPeakWindows', () => {
  it('stays quiet without enough data', () => {
    expect(findPeakWindows([session()]).value).toEqual([]);
  });

  it('identifies the hours with the most productive focus', () => {
    const morning = startOfDay() + 9 * 3_600_000;
    const sessions = Array.from({ length: 15 }, () =>
      session({ startedAt: morning, productivityAfter: 5 }),
    );
    const rec = findPeakWindows(sessions);
    expect(rec.value.length).toBeGreaterThan(0);
    expect(rec.value[0].startHour).toBeLessThanOrEqual(9);
    expect(rec.value[0].endHour).toBeGreaterThanOrEqual(9);
  });
});

describe('estimateTaskSessions', () => {
  it('falls back to the user estimate without category history', () => {
    const t = task({ estimatedSessions: 3, completedSessions: 1 });
    expect(estimateTaskSessions(t, []).value).toBe(2);
  });
});

describe('buildDailyPlan', () => {
  it('returns nothing actionable with no open tasks', () => {
    expect(buildDailyPlan([], [], 8).value).toEqual([]);
  });

  it('orders urgent work first', () => {
    const plan = buildDailyPlan(
      [
        task({ title: 'Low', priority: 'low', order: 0 }),
        task({ title: 'Urgent', priority: 'urgent', order: 1 }),
      ],
      [],
      8,
    );
    expect(plan.value[0].title).toBe('Urgent');
  });

  it('never plans more sessions than the daily goal', () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      task({ title: `T${i}`, estimatedSessions: 4, order: i }),
    );
    const plan = buildDailyPlan(tasks, [], 5);
    const total = plan.value.reduce((a, b) => a + b.sessions, 0);
    expect(total).toBeLessThanOrEqual(5);
  });

  it('skips completed tasks', () => {
    const plan = buildDailyPlan([task({ title: 'Done', status: 'done' })], [], 8);
    expect(plan.value).toEqual([]);
  });
});

describe('xp and levels', () => {
  it('awards nothing for breaks or abandoned sessions', () => {
    expect(xpForSession(session({ type: 'short-break' }))).toBe(0);
    expect(xpForSession(session({ completed: false }))).toBe(0);
  });

  it('rewards longer and cleaner sessions more', () => {
    const short = xpForSession(session({ actualMs: 25 * MINUTE, distractionCount: 2 }));
    const long = xpForSession(session({ actualMs: 50 * MINUTE, distractionCount: 2 }));
    const clean = xpForSession(session({ actualMs: 25 * MINUTE, distractionCount: 0 }));
    expect(long).toBeGreaterThan(short);
    expect(clean).toBeGreaterThan(short);
  });

  it('starts at level 1 and increases monotonically', () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(xpForLevel(5)).level).toBe(5);
    expect(levelForXp(xpForLevel(5) - 1).level).toBe(4);
  });

  it('reports progress within the current level', () => {
    const mid = Math.round((xpForLevel(3) + xpForLevel(4)) / 2);
    const l = levelForXp(mid);
    expect(l.level).toBe(3);
    expect(l.pct).toBeGreaterThan(0);
    expect(l.pct).toBeLessThan(1);
  });
});
