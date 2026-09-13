import { describe, expect, it } from 'vitest';
import { todaySubtitle } from '../todaySummary';
import { MINUTE } from '@/lib/utils';

describe('todaySubtitle', () => {
  it('invites a first session on a day with nothing in it', () => {
    expect(todaySubtitle(0, 0)).toBe('Nothing logged yet today. One session is enough to start.');
  });

  it('counts focus from sessions ended early instead of claiming nothing was logged', () => {
    const line = todaySubtitle(0, 12 * MINUTE);
    expect(line).not.toContain('Nothing logged');
    expect(line).toContain('12m');
  });

  it('reports finished sessions and the focus behind them', () => {
    expect(todaySubtitle(2, 50 * MINUTE)).toBe('2 sessions done today — 50m of focus.');
  });
});
