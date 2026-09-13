import { beforeEach, describe, expect, it } from 'vitest';
import { resetAllData } from '../resetAllData';
import { useHydrationStore } from '../useHydrationStore';
import { useSettingsStore } from '../useSettingsStore';
import { useStatsStore } from '../useStatsStore';
import { useTimerStore } from '../useTimerStore';
import { db } from '@/db/schema';
import { createTimerState, start } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';
import { bootStores, makeSession, resetApp } from '@/test/helpers';

describe('resetAllData', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('stops the session on the clock, not just its saved copy', async () => {
    const timer = start(createTimerState('focus', 25 * MINUTE), Date.now() - 10 * MINUTE);
    useTimerStore.setState({ timer, sessionId: 'ses_running' });
    // setTask persists, which is how a real running session lands in storage.
    useTimerStore.getState().setTask('task_soon_gone', 'Soon gone');
    expect(localStorage.getItem('focusos:timer')).not.toBeNull();

    await resetAllData();

    const state = useTimerStore.getState();
    expect(state.timer.status).toBe('idle');
    expect(state.sessionId).toBeNull();
    expect(localStorage.getItem('focusos:timer')).toBeNull();

    // The bug: the clock kept running in memory, so the next action saved the
    // "erased" session straight back into storage.
    useTimerStore.getState().pause();
    const saved = localStorage.getItem('focusos:timer');
    expect(saved === null || JSON.parse(saved).timer.status !== 'running').toBe(true);
  });

  it('drops prompts that point at sessions it is deleting', async () => {
    useTimerStore.setState({
      pendingReview: makeSession({ id: 'ses_reviewed' }),
      pendingParked: [{ id: 'dis_parked', categoryId: 'd-phone', at: Date.now(), note: 'call back', parked: true }],
    });

    await resetAllData();

    expect(useTimerStore.getState().pendingReview).toBeNull();
    expect(useTimerStore.getState().pendingParked).toEqual([]);
  });

  it("empties history, XP and today's water count", async () => {
    await db.sessions.put(makeSession({ id: 'ses_history' }));
    await useStatsStore.getState().refresh();
    await useSettingsStore.getState().update({ xp: 500 });
    await useHydrationStore.getState().logGlass();
    expect(useHydrationStore.getState().glasses).toBe(1);

    await resetAllData();

    expect(await db.sessions.count()).toBe(0);
    expect(useStatsStore.getState().sessions).toEqual([]);
    expect(useSettingsStore.getState().settings.xp).toBe(0);
    expect(useHydrationStore.getState().glasses).toBe(0);
  });
});
