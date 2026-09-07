import { describe, expect, it } from 'vitest';
import { byCategory } from '../analytics';
import type { Category, Session } from '@/types';
import { MINUTE } from '@/lib/utils';

const CATEGORIES: Category[] = [
  { id: 'cat-deep', name: 'Deep Work', color: '#7886ff', createdAt: 1 },
  { id: 'cat-admin', name: 'Admin', color: '#9aa0b4', createdAt: 1 },
];

const session = (over: Partial<Session> & { id: string }): Session => ({
  type: 'focus',
  plannedMs: 25 * MINUTE,
  actualMs: 25 * MINUTE,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_000_000 + 25 * MINUTE,
  completed: true,
  distractionCount: 0,
  pausedMs: 0,
  ...over,
});

describe('byCategory', () => {
  it('splits focus time across categories, largest first', () => {
    const rows = byCategory(
      [
        session({ id: 'a', categoryId: 'cat-admin', actualMs: 10 * MINUTE }),
        session({ id: 'b', categoryId: 'cat-deep', actualMs: 20 * MINUTE }),
        session({ id: 'c', categoryId: 'cat-deep', actualMs: 10 * MINUTE }),
      ],
      CATEGORIES,
    );

    expect(rows.map((r) => r.name)).toEqual(['Deep Work', 'Admin']);
    expect(rows[0].focusMs).toBe(30 * MINUTE);
    expect(rows[0].share).toBeCloseTo(0.75);
    expect(rows[1].share).toBeCloseTo(0.25);
  });

  it('keeps uncategorised focus visible instead of dropping it', () => {
    const rows = byCategory(
      [
        session({ id: 'a', categoryId: 'cat-deep', actualMs: 10 * MINUTE }),
        session({ id: 'b', actualMs: 30 * MINUTE }),
      ],
      CATEGORIES,
    );

    // A breakdown that quietly omitted three quarters of the week would be
    // worse than one that admits the gap.
    const uncategorised = rows.find((r) => r.categoryId === undefined);
    expect(uncategorised?.name).toBe('Uncategorised');
    expect(uncategorised?.share).toBeCloseTo(0.75);
    expect(rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
  });

  it('says a category was deleted rather than calling the work uncategorised', () => {
    const rows = byCategory([session({ id: 'a', categoryId: 'cat-gone' })], CATEGORIES);

    // The work did have a category; only its name is lost.
    expect(rows[0].name).toBe('Deleted category');
    expect(rows[0].categoryId).toBe('cat-gone');
  });

  it('counts only completed sessions, but all the time actually focused', () => {
    const rows = byCategory(
      [
        session({ id: 'a', categoryId: 'cat-deep', completed: true, actualMs: 25 * MINUTE }),
        session({ id: 'b', categoryId: 'cat-deep', completed: false, actualMs: 5 * MINUTE }),
      ],
      CATEGORIES,
    );

    expect(rows[0].sessions).toBe(1);
    expect(rows[0].focusMs).toBe(30 * MINUTE);
  });

  it('ignores breaks', () => {
    const rows = byCategory(
      [
        session({ id: 'a', categoryId: 'cat-deep' }),
        session({ id: 'b', type: 'short-break', categoryId: 'cat-deep' }),
      ],
      CATEGORIES,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].focusMs).toBe(25 * MINUTE);
  });

  it('averages productivity only over sessions that were rated', () => {
    const rows = byCategory(
      [
        session({ id: 'a', categoryId: 'cat-deep', productivityAfter: 5 }),
        session({ id: 'b', categoryId: 'cat-deep', productivityAfter: 3 }),
        session({ id: 'c', categoryId: 'cat-deep' }),
        session({ id: 'd', categoryId: 'cat-admin' }),
      ],
      CATEGORIES,
    );

    expect(rows.find((r) => r.categoryId === 'cat-deep')?.avgProductivity).toBe(4);
    expect(rows.find((r) => r.categoryId === 'cat-admin')?.avgProductivity).toBeNull();
  });

  it('returns nothing for a period with no focus', () => {
    expect(byCategory([], CATEGORIES)).toEqual([]);
  });
});
