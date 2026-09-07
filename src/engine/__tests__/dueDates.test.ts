import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../adaptive';
import { formatDueDate, DAY, startOfDay } from '@/lib/utils';
import type { Task } from '@/types';

const task = (over: Partial<Task> & { id: string }): Task => ({
  title: over.id,
  status: 'todo',
  priority: 'medium',
  estimatedSessions: 2,
  completedSessions: 0,
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  tags: [],
  ...over,
});

const inDays = (n: number) => startOfDay() + n * DAY + 12 * 3_600_000;

describe('formatDueDate', () => {
  it('reads relatively near the present and by date further out', () => {
    expect(formatDueDate(inDays(0))).toEqual({ label: 'Today', tone: 'today' });
    expect(formatDueDate(inDays(1))).toEqual({ label: 'Tomorrow', tone: 'soon' });
    expect(formatDueDate(inDays(3))).toEqual({ label: 'In 3 days', tone: 'soon' });
    expect(formatDueDate(inDays(-1))).toEqual({ label: 'Yesterday', tone: 'overdue' });
    expect(formatDueDate(inDays(-4))).toEqual({ label: '4d overdue', tone: 'overdue' });
    expect(formatDueDate(inDays(30)).tone).toBe('later');
  });
});

describe('buildDailyPlan — deadlines', () => {
  it('schedules work that is already due before work that merely matters', () => {
    const plan = buildDailyPlan(
      [
        task({ id: 'urgent-no-deadline', priority: 'urgent', order: 0 }),
        task({ id: 'low-overdue', priority: 'low', order: 1, dueDate: inDays(-2) }),
      ],
      [],
      8,
    );

    // A deadline that has arrived is a constraint; priority is a preference.
    expect(plan.value[0].taskId).toBe('low-overdue');
    expect(plan.value[0].rationale).toMatch(/overdue/i);
  });

  it('handles the oldest deadline first among work that is already due', () => {
    const plan = buildDailyPlan(
      [
        task({ id: 'urgent-today', priority: 'urgent', order: 0, dueDate: inDays(0) }),
        task({ id: 'low-overdue', priority: 'low', order: 1, dueDate: inDays(-2) }),
      ],
      [],
      8,
    );

    // Priority is the user saying what matters; a date already passed is the
    // world saying when it was needed. The one broken longest leads.
    expect(plan.value.map((b) => b.taskId)).toEqual(['low-overdue', 'urgent-today']);
  });

  it('still orders by priority among work that is equally due', () => {
    const plan = buildDailyPlan(
      [
        task({ id: 'medium-today', priority: 'medium', order: 0, dueDate: inDays(0) }),
        task({ id: 'urgent-today', priority: 'urgent', order: 1, dueDate: inDays(0) }),
      ],
      [],
      8,
    );

    expect(plan.value.map((b) => b.taskId)).toEqual(['urgent-today', 'medium-today']);
    expect(plan.value[0].rationale).toMatch(/due today/i);
  });

  it('leaves a future deadline to priority, and breaks ties by the nearer date', () => {
    const plan = buildDailyPlan(
      [
        task({ id: 'later', priority: 'medium', order: 0, dueDate: inDays(9) }),
        task({ id: 'sooner', priority: 'medium', order: 1, dueDate: inDays(2) }),
        task({ id: 'high-no-deadline', priority: 'high', order: 2 }),
      ],
      [],
      8,
    );

    // Nothing here is due yet, so priority leads; the nearer deadline decides
    // between the two that are otherwise equal.
    expect(plan.value.map((b) => b.taskId)).toEqual(['high-no-deadline', 'sooner', 'later']);
  });

  it('orders by priority alone when nothing carries a deadline', () => {
    const plan = buildDailyPlan(
      [
        task({ id: 'low', priority: 'low', order: 0 }),
        task({ id: 'urgent', priority: 'urgent', order: 1 }),
      ],
      [],
      8,
    );

    expect(plan.value.map((b) => b.taskId)).toEqual(['urgent', 'low']);
  });
});
