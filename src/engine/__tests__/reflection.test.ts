import { describe, expect, it } from 'vitest';
import type { Distraction, DistractionCategory, Session } from '@/types';
import { generateReflection } from '../reflection';
import { MINUTE, startOfDay } from '@/lib/utils';

const CATEGORIES: DistractionCategory[] = [
  { id: 'd-phone', label: 'Phone', icon: 'Smartphone', color: '#f5a524', builtIn: true },
];

let counter = 0;
/** A completed focus session, with any field overridden. Ids are unique per call. */
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

describe('generateReflection', () => {
  it('stays encouraging when nothing has been logged', () => {
    const r = generateReflection([], [], CATEGORIES, [], 8);
    expect(r.tone).toBe('quiet');
    expect(r.accomplishments).toEqual([]);
    expect(r.recommendations.length).toBeGreaterThan(0);
  });

  it('reports an exceptional day when well past the goal', () => {
    const sessions = Array.from({ length: 10 }, () => session({ productivityAfter: 5 }));
    const r = generateReflection(sessions, [], CATEGORIES, [], 4);
    expect(r.tone).toBe('exceptional');
    expect(r.headline).toContain('10');
  });

  it('notes falling short of the goal', () => {
    const r = generateReflection([session()], [], CATEGORIES, [], 8);
    expect(r.summary).toContain('short of your daily goal');
  });

  it('surfaces the dominant distraction', () => {
    const distractions: Distraction[] = Array.from({ length: 4 }, (_, i) => ({
      id: `d${i}`,
      categoryId: 'd-phone',
      at: Date.now(),
      sessionProgress: 0.5,
    }));
    const r = generateReflection([session()], distractions, CATEGORIES, [], 8);
    expect(r.distractionNote).toContain('Phone');
    expect(r.recommendations.join(' ')).toContain('phone');
  });

  it('celebrates a distraction-free day', () => {
    const r = generateReflection([session()], [], CATEGORIES, [], 8);
    expect(r.distractionNote).toContain('no distractions');
  });

  it('recommends shorter sessions when most are abandoned', () => {
    const sessions = [
      session({ completed: true }),
      session({ completed: false }),
      session({ completed: false }),
      session({ completed: false }),
    ];
    const r = generateReflection(sessions, [], CATEGORIES, [], 4);
    expect(r.recommendations.join(' ')).toMatch(/shorter session|Try dropping/i);
  });

  it('uses what the user wrote as accomplishments', () => {
    const r = generateReflection(
      [session({ accomplishment: 'Finished the migration script' })],
      [],
      CATEGORIES,
      [],
      8,
    );
    expect(r.accomplishments).toContain('Finished the migration script');
  });
});
