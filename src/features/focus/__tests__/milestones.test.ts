import { describe, expect, it } from 'vitest';
import { countdownAnnouncement, milestoneReached } from '../milestones';
import { createTimerState, pause, start } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';

const T0 = 1_700_000_000_000;
const SECOND = 1000;

/** A running session of `durationMin` minutes with `remainingMs` left on the clock at T0. */
function withRemaining(type: 'focus' | 'short-break' | 'long-break', durationMin: number, remainingMs: number) {
  const durationMs = durationMin * MINUTE;
  return start(createTimerState(type, durationMs), T0 - (durationMs - remainingMs));
}

describe('countdownAnnouncement — a 25-minute focus session', () => {
  it('says only that it is in progress before the first milestone', () => {
    expect(countdownAnnouncement(withRemaining('focus', 25, 20 * MINUTE), T0)).toBe('Focus in progress');
  });

  it('speaks at halfway, five minutes and one minute', () => {
    expect(countdownAnnouncement(withRemaining('focus', 25, 12.5 * MINUTE), T0)).toBe(
      'Halfway through this focus session.',
    );
    expect(countdownAnnouncement(withRemaining('focus', 25, 5 * MINUTE), T0)).toBe(
      'Five minutes left in this focus session.',
    );
    expect(countdownAnnouncement(withRemaining('focus', 25, 59 * SECOND), T0)).toBe(
      'One minute left in this focus session.',
    );
  });

  it('holds each message until the next milestone, so it is announced once', () => {
    // A live region speaks when its text changes. Between milestones the text
    // must stay identical from tick to tick, or it would be read out constantly.
    const a = countdownAnnouncement(withRemaining('focus', 25, 12 * MINUTE), T0);
    const b = countdownAnnouncement(withRemaining('focus', 25, 6 * MINUTE), T0);
    expect(a).toBe(b);
  });
});

describe('countdownAnnouncement — shorter sessions', () => {
  it('does not open a five-minute break by saying five minutes are left', () => {
    expect(countdownAnnouncement(withRemaining('short-break', 5, 5 * MINUTE), T0)).toBe('Short break in progress');
    expect(countdownAnnouncement(withRemaining('short-break', 5, 59 * SECOND), T0)).toBe(
      'One minute left in this short break.',
    );
  });

  it('does not announce halfway and five minutes in the same breath', () => {
    // In a ten-minute session both would land on the same instant.
    expect(milestoneReached(5 * MINUTE, 10 * MINUTE)).toBe('five-minutes');
    expect(milestoneReached(5.5 * MINUTE, 10 * MINUTE)).toBeNull();
  });

  it('says nothing at all for a session too short to have milestones', () => {
    expect(milestoneReached(30 * SECOND, 2 * MINUTE)).toBeNull();
  });

  it('names long breaks as long breaks', () => {
    expect(countdownAnnouncement(withRemaining('long-break', 15, 4 * MINUTE), T0)).toBe(
      'Five minutes left in this long break.',
    );
  });
});

describe('countdownAnnouncement — when the clock is not running', () => {
  it('keeps the messages it always had', () => {
    const running = withRemaining('focus', 25, 20 * MINUTE);
    expect(countdownAnnouncement(pause(running, T0), T0)).toBe('Timer paused');
    expect(countdownAnnouncement(createTimerState('focus', 25 * MINUTE), T0)).toBe('Timer stopped');
  });
});
