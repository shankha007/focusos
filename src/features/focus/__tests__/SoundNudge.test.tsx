import { act, render, screen, waitFor } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundNudge } from '../SoundNudge';
import {
  NUDGE_DELAY_MS,
  NUDGE_RETIRE_AFTER,
  NUDGE_VISIBLE_MS,
  nudgeAllowed,
  readNudge,
} from '../nudgeRules';
import { ambient } from '@/lib/audio';
import { useSettingsStore } from '@/store/useSettingsStore';
import { dateKey } from '@/lib/utils';

const suggestion = () => screen.queryByRole('button', { name: /focus with/i });

function setSound(soundEnabled: boolean, activeSound: 'rain' | 'forest' | null = null) {
  const state = useSettingsStore.getState();
  useSettingsStore.setState({ settings: { ...state.settings, soundEnabled, activeSound } });
}

describe('nudgeAllowed', () => {
  it('allows one showing a day', () => {
    const today = new Date(2026, 8, 17, 10);
    expect(nudgeAllowed({ dismissals: 0 }, today.getTime())).toBe(true);
    expect(nudgeAllowed({ dismissals: 0, lastShown: dateKey(today) }, today.getTime())).toBe(false);
    const tomorrow = new Date(2026, 8, 18, 9);
    expect(nudgeAllowed({ dismissals: 0, lastShown: dateKey(today) }, tomorrow.getTime())).toBe(true);
  });

  it('retires for good once waved away enough times', () => {
    expect(nudgeAllowed({ dismissals: NUDGE_RETIRE_AFTER - 1 })).toBe(true);
    expect(nudgeAllowed({ dismissals: NUDGE_RETIRE_AFTER })).toBe(false);
  });

  it('treats an unreadable record as a fresh start', () => {
    localStorage.setItem('focusos:sound-nudge', '{not json');
    expect(readNudge()).toEqual({ dismissals: 0 });
  });
});

describe('SoundNudge', () => {
  beforeEach(() => {
    // The exit fade runs on animation frames, which fake timers do not drive.
    MotionGlobalConfig.skipAnimations = true;
    localStorage.clear();
    vi.useFakeTimers();
    setSound(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    MotionGlobalConfig.skipAnimations = false;
  });

  /** Lets the exit finish on real time, then checks the suggestion has gone. */
  const expectGone = async () => {
    vi.useRealTimers();
    await waitFor(() => expect(suggestion()).toBeNull());
  };

  const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it('waits until the session is under way, then fades out on its own', async () => {
    render(<SoundNudge active />);
    expect(suggestion()).toBeNull();

    wait(NUDGE_DELAY_MS);
    expect(suggestion()).toHaveTextContent('Focus with rain?');

    wait(NUDGE_VISIBLE_MS);
    await expectGone();
    // Fading on its own is not a refusal.
    expect(readNudge().dismissals).toBe(0);
  });

  it('never appears when sound is already on, or outside a running focus session', () => {
    setSound(true, 'rain');
    const { rerender } = render(<SoundNudge active />);
    wait(NUDGE_DELAY_MS * 2);
    expect(suggestion()).toBeNull();

    setSound(false);
    rerender(<SoundNudge active={false} />);
    wait(NUDGE_DELAY_MS * 2);
    expect(suggestion()).toBeNull();
  });

  it('shows at most once a day', () => {
    const { unmount } = render(<SoundNudge active />);
    wait(NUDGE_DELAY_MS);
    expect(suggestion()).not.toBeNull();
    unmount();

    render(<SoundNudge active />);
    wait(NUDGE_DELAY_MS * 2);
    expect(suggestion()).toBeNull();
  });

  it('suggests the sound last chosen, and plays it in one click', async () => {
    setSound(false, 'forest');
    const play = vi.spyOn(ambient, 'play').mockResolvedValue();
    render(<SoundNudge active />);
    wait(NUDGE_DELAY_MS);

    act(() => suggestion()!.click());
    // Settings write to the database before the sound starts.
    await act(() => vi.runAllTimersAsync());

    expect(play).toHaveBeenCalledWith('forest', expect.any(Number));
    expect(useSettingsStore.getState().settings.soundEnabled).toBe(true);
  });

  it('counts the close button as a dismissal', async () => {
    render(<SoundNudge active />);
    wait(NUDGE_DELAY_MS);

    act(() => screen.getByRole('button', { name: /dismiss sound suggestion/i }).click());

    await expectGone();
    expect(readNudge().dismissals).toBe(1);
  });
});
