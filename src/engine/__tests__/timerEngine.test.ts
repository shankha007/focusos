import { describe, expect, it } from 'vitest';
import {
  createTimerState,
  elapsedMs,
  isComplete,
  nextSessionType,
  pause,
  progress,
  remainingMs,
  reset,
  resume,
  start,
} from '../timerEngine';
import { MINUTE } from '@/lib/utils';

const T0 = 1_700_000_000_000;
const FIVE = 5 * MINUTE;

describe('timerEngine', () => {
  it('reports the full duration while idle', () => {
    const s = createTimerState('focus', FIVE);
    expect(remainingMs(s, T0)).toBe(FIVE);
    expect(elapsedMs(s, T0)).toBe(0);
    expect(progress(s, T0)).toBe(0);
  });

  it('counts down from wall-clock time, not ticks', () => {
    const s = start(createTimerState('focus', FIVE), T0);
    expect(remainingMs(s, T0 + MINUTE)).toBe(4 * MINUTE);
    expect(progress(s, T0 + MINUTE)).toBeCloseTo(0.2);
  });

  it('excludes paused time from elapsed', () => {
    let s = start(createTimerState('focus', FIVE), T0);
    s = pause(s, T0 + MINUTE);
    // Two minutes pass while paused — none of it should count.
    s = resume(s, T0 + 3 * MINUTE);
    expect(elapsedMs(s, T0 + 3 * MINUTE)).toBe(MINUTE);
    expect(remainingMs(s, T0 + 4 * MINUTE)).toBe(3 * MINUTE);
  });

  it('keeps the clock frozen while still paused', () => {
    let s = start(createTimerState('focus', FIVE), T0);
    s = pause(s, T0 + MINUTE);
    expect(remainingMs(s, T0 + MINUTE)).toBe(4 * MINUTE);
    expect(remainingMs(s, T0 + 10 * MINUTE)).toBe(4 * MINUTE);
  });

  it('handles a long background gap without overshooting', () => {
    const s = start(createTimerState('focus', FIVE), T0);
    // Tab slept for an hour — the session is simply over, not negative.
    expect(remainingMs(s, T0 + 60 * MINUTE)).toBe(0);
    expect(progress(s, T0 + 60 * MINUTE)).toBe(1);
    expect(isComplete(s, T0 + 60 * MINUTE)).toBe(true);
  });

  it('is not complete before time runs out', () => {
    const s = start(createTimerState('focus', FIVE), T0);
    expect(isComplete(s, T0 + 4 * MINUTE)).toBe(false);
    expect(isComplete(s, T0 + FIVE)).toBe(true);
  });

  it('clears run state on reset', () => {
    let s = start(createTimerState('focus', FIVE), T0);
    s = pause(s, T0 + MINUTE);
    s = reset(s);
    expect(s.status).toBe('idle');
    expect(s.startedAt).toBeNull();
    expect(s.pausedAccumMs).toBe(0);
    expect(remainingMs(s, T0 + 99 * MINUTE)).toBe(FIVE);
  });

  it('ignores resume when not paused, and pause when not running', () => {
    const idle = createTimerState('focus', FIVE);
    expect(resume(idle, T0)).toEqual(idle);
    expect(pause(idle, T0)).toEqual(idle);
  });

  describe('cycle scheduling', () => {
    it('alternates focus and short breaks', () => {
      expect(nextSessionType('focus', 0, 4)).toBe('short-break');
      expect(nextSessionType('focus', 1, 4)).toBe('short-break');
      expect(nextSessionType('focus', 2, 4)).toBe('short-break');
    });

    it('inserts a long break every Nth focus session', () => {
      expect(nextSessionType('focus', 3, 4)).toBe('long-break');
      expect(nextSessionType('focus', 7, 4)).toBe('long-break');
    });

    it('always returns to focus after any break', () => {
      expect(nextSessionType('short-break', 2, 4)).toBe('focus');
      expect(nextSessionType('long-break', 3, 4)).toBe('focus');
    });
  });
});
