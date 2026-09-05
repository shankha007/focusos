import { describe, expect, it } from 'vitest';
import { applyToFullOrder, moveWithin } from '../TasksPage';

/** The order values `tasksRepo.reorder` would write for a list of ids. */
const orders = (ids: string[]) => Object.fromEntries(ids.map((id, i) => [id, i]));

describe('moveWithin', () => {
  it('drops the moved id where the target sits', () => {
    expect(moveWithin(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(moveWithin(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('gives up when either end is off screen', () => {
    expect(moveWithin(['a', 'b'], 'z', 'a')).toBeNull();
    expect(moveWithin(['a', 'b'], 'a', 'z')).toBeNull();
  });
});

describe('applyToFullOrder', () => {
  const FULL = ['a1', 'a2', 'b1', 'b2'];

  it('leaves filtered-out tasks exactly where they were', () => {
    // Only the two "b" tasks are on screen, and they get swapped.
    const next = applyToFullOrder(FULL, ['b2', 'b1']);
    expect(next).toEqual(['a1', 'a2', 'b2', 'b1']);
  });

  it('never hands two tasks the same order', () => {
    // The bug: reordering inside a category filter wrote b2#0 and a1#0,
    // b1#1 and a2#1 — two pairs sharing an order, with the whole category
    // jumping above the tasks the filter was hiding.
    const next = applyToFullOrder(FULL, ['b2', 'b1']);
    expect(new Set(Object.values(orders(next))).size).toBe(FULL.length);
    expect(next).toHaveLength(FULL.length);
    expect(new Set(next)).toEqual(new Set(FULL));
  });

  it('keeps a hidden task between two visible ones', () => {
    // "a2" is done and filtered out; dragging b1 above a1 must not move it.
    const next = applyToFullOrder(['a1', 'a2', 'b1'], ['b1', 'a1']);
    expect(next).toEqual(['b1', 'a2', 'a1']);
    expect(orders(next).a2).toBe(1);
  });

  it('is a plain reorder when nothing is filtered', () => {
    expect(applyToFullOrder(FULL, ['b2', 'a1', 'a2', 'b1'])).toEqual(['b2', 'a1', 'a2', 'b1']);
  });

  it('handles an empty selection', () => {
    expect(applyToFullOrder(FULL, [])).toEqual(FULL);
  });
});
