import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToday } from '../useToday';

const midnight = (y: number, m: number, d: number) => new Date(y, m, d).getTime();

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 23, 59, 30));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves on to the new day when midnight passes with the page open', () => {
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe(midnight(2026, 8, 26));

    act(() => void vi.advanceTimersByTime(45_000));

    expect(result.current).toBe(midnight(2026, 8, 27));
  });

  it('catches up when the tab comes back after the machine slept through midnight', () => {
    const { result } = renderHook(() => useToday());
    // A sleeping machine runs no timers: the clock jumps, the timer has not fired.
    vi.setSystemTime(new Date(2026, 8, 27, 7, 0, 0));
    expect(result.current).toBe(midnight(2026, 8, 26));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(midnight(2026, 8, 27));
  });
});
