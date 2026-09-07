import { beforeEach, describe, expect, it } from 'vitest';
import { useTimerStore } from '../useTimerStore';
import { resetLosesWork } from '@/engine/timerEngine';
import { createTimerState, start } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';
import { bootStores, resetApp } from '@/test/helpers';

/** Puts a focus session on the clock that started `agoMs` ago. */
function runningFor(agoMs: number) {
  const timer = start(createTimerState('focus', 25 * MINUTE), Date.now() - agoMs);
  useTimerStore.setState({ timer, sessionId: 'ses_under_test' });
}

describe('resetLosesWork', () => {
  const idle = createTimerState('focus', 25 * MINUTE);

  it('is false for a timer that never started', () => {
    expect(resetLosesWork(idle, MINUTE)).toBe(false);
  });

  it('is false for a false start', () => {
    const timer = start(idle, Date.now() - 20_000);
    expect(resetLosesWork(timer, MINUTE)).toBe(false);
  });

  it('is true once there is real work in it', () => {
    const timer = start(idle, Date.now() - 40 * MINUTE);
    expect(resetLosesWork(timer, MINUTE)).toBe(true);
  });

  it('counts a paused session, which still holds the work done before the pause', () => {
    const timer = { ...start(idle, Date.now() - 40 * MINUTE), status: 'paused' as const, pausedAt: Date.now() };
    expect(resetLosesWork(timer, MINUTE)).toBe(true);
  });
});

describe('useTimerStore — the reset guard', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('clears a false start without asking', () => {
    runningFor(20_000);

    useTimerStore.getState().requestReset();

    expect(useTimerStore.getState().pendingReset).toBe(false);
    expect(useTimerStore.getState().timer.status).toBe('idle');
  });

  it('asks before discarding forty minutes of focus', () => {
    runningFor(40 * MINUTE);

    useTimerStore.getState().requestReset();

    // The bug this replaces: the command palette called reset() straight
    // through, so the same action was guarded in Deep Focus and nowhere else.
    expect(useTimerStore.getState().pendingReset).toBe(true);
    expect(useTimerStore.getState().timer.status).toBe('running');
  });

  it('leaves the session running when the user backs out', () => {
    runningFor(40 * MINUTE);
    useTimerStore.getState().requestReset();

    useTimerStore.getState().cancelReset();

    expect(useTimerStore.getState().pendingReset).toBe(false);
    expect(useTimerStore.getState().timer.status).toBe('running');
    expect(useTimerStore.getState().sessionId).toBe('ses_under_test');
  });

  it('discards it once the user confirms', () => {
    runningFor(40 * MINUTE);
    useTimerStore.getState().requestReset();

    useTimerStore.getState().confirmReset();

    expect(useTimerStore.getState().pendingReset).toBe(false);
    expect(useTimerStore.getState().timer.status).toBe('idle');
    expect(useTimerStore.getState().sessionId).toBeNull();
  });

  it('drops a pending question if the session is reset another way', () => {
    runningFor(40 * MINUTE);
    useTimerStore.getState().requestReset();

    // A restore, or the reset button in settings, goes straight to reset().
    useTimerStore.getState().reset();

    // The dialog must not be left over a timer that is already idle.
    expect(useTimerStore.getState().pendingReset).toBe(false);
  });
});
