import { describe, expect, it } from 'vitest';
import { focusTimeMs, summarize, toDayStats } from '../analytics';
import { generateReflection } from '../reflection';
import { MINUTE, dateKey } from '@/lib/utils';
import type { Session } from '@/types';

const session = (over: Partial<Session> & { id: string }): Session => ({
  type: 'focus',
  plannedMs: 25 * MINUTE,
  actualMs: 25 * MINUTE,
  startedAt: Date.now() - 3 * 3_600_000,
  endedAt: Date.now() - 3 * 3_600_000 + 25 * MINUTE,
  completed: true,
  distractionCount: 0,
  pausedMs: 0,
  ...over,
});

/** A finished 25-minute session and one abandoned 20 minutes in, both today. */
const DAY_WITH_AN_ABANDONED_SESSION = [
  session({ id: 'finished' }),
  session({ id: 'abandoned', completed: false, actualMs: 20 * MINUTE }),
];

describe('focusTimeMs', () => {
  it('counts time from sessions that were abandoned', () => {
    // 20 minutes of focus is 20 minutes of focus. Skipping the session
    // afterwards does not unspend it — the session count is what records
    // whether it was seen through.
    expect(focusTimeMs(DAY_WITH_AN_ABANDONED_SESSION)).toBe(45 * MINUTE);
  });

  it('ignores breaks', () => {
    expect(
      focusTimeMs([
        session({ id: 'focus' }),
        session({ id: 'break', type: 'short-break' }),
        session({ id: 'long', type: 'long-break' }),
      ]),
    ).toBe(25 * MINUTE);
  });

  it('is zero for a day with nothing on it', () => {
    expect(focusTimeMs([])).toBe(0);
  });
});

describe('one definition of focus time', () => {
  it('agrees across the period summary, the daily rollup and the reflection', () => {
    const sessions = DAY_WITH_AN_ABANDONED_SESSION;
    const expected = 45 * MINUTE;

    // These three used to disagree: the dashboard summed completed sessions
    // only, analytics summed them all, and the reflection had its own reading.
    expect(focusTimeMs(sessions)).toBe(expected);
    expect(summarize(sessions, []).focusMs).toBe(expected);
    expect(toDayStats(sessions, []).get(dateKey(sessions[0].startedAt))?.focusMs).toBe(expected);

    const reflection = generateReflection(sessions, [], [], [], 8);
    // The reflection reports the same total, and says plainly what it counted.
    expect(reflection.summary).toContain('focused for 45m in total');
    expect(reflection.summary).toContain('completed 1 of 2 sessions');
  });

  it('still counts only finished sessions as sessions', () => {
    const summary = summarize(DAY_WITH_AN_ABANDONED_SESSION, []);
    expect(summary.sessions).toBe(1);
    expect(summary.completionRate).toBe(0.5);
  });
});
