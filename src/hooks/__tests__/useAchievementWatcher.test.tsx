import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { captureAchievementBaseline, useAchievementWatcher } from '../useAchievementWatcher';
import { useStatsStore } from '@/store/useStatsStore';
import { makeSession, resetApp } from '@/test/helpers';

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const firstSession = makeSession({ id: 'ses_first' });
const unlockToasts = () =>
  vi.mocked(toast.success).mock.calls.map(([title]) => String(title)).filter((t) => t.startsWith('Achievement unlocked'));

describe('useAchievementWatcher', () => {
  beforeEach(async () => {
    await resetApp();
    vi.mocked(toast.success).mockClear();
  });

  it('announces a badge earned while the app was opening — a session that ran out with the tab closed', () => {
    // Nothing earned yet when the app began to open…
    captureAchievementBaseline([], 8);
    // …and opening it completed the first session.
    useStatsStore.setState({ sessions: [firstSession] });

    renderHook(() => useAchievementWatcher());

    expect(unlockToasts()).toEqual(['Achievement unlocked — First Light']);
  });

  it('stays quiet about badges earned before the app opened', () => {
    captureAchievementBaseline([firstSession], 8);
    useStatsStore.setState({ sessions: [firstSession] });

    renderHook(() => useAchievementWatcher());

    expect(unlockToasts()).toEqual([]);
  });

  it('without a baseline, seeds silently as before — nobody is buried in old badges', () => {
    useStatsStore.setState({ sessions: [firstSession] });

    renderHook(() => useAchievementWatcher());

    expect(unlockToasts()).toEqual([]);
  });

  it('still announces a badge earned while the app is open', () => {
    captureAchievementBaseline([], 8);
    useStatsStore.setState({ sessions: [] });
    renderHook(() => useAchievementWatcher());
    expect(unlockToasts()).toEqual([]);

    act(() => useStatsStore.setState({ sessions: [firstSession] }));

    expect(unlockToasts()).toEqual(['Achievement unlocked — First Light']);
  });
});
