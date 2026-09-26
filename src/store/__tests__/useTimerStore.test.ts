import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimerStore } from '../useTimerStore';
import { useSettingsStore } from '../useSettingsStore';
import { useTaskStore } from '../useTaskStore';
import { useStatsStore } from '../useStatsStore';
import { sessionsRepo } from '@/db/repositories';
import { db } from '@/db/schema';
import { MINUTE } from '@/lib/utils';
import { bootStores, makeTask, persistRunningSession, resetApp } from '@/test/helpers';

/**
 * Waits for a session finalised in the background to be fully written, then
 * returns it.
 *
 * The settle point is the session reaching the stats store, not the database.
 * `complete` writes the session row first and updates the stats store last, with the XP
 * award and the task credit in between — so waiting on the row alone returns
 * while those are still in flight, and the assertions read a half-finished
 * write.
 */
async function settledSession(id: string) {
  await vi.waitFor(() => {
    if (!useStatsStore.getState().sessions.some((s) => s.id === id)) {
      throw new Error(`session ${id} has not finished being written`);
    }
  });
  const session = await sessionsRepo.get(id);
  if (!session) throw new Error(`session ${id} missing from the database`);
  return session;
}

describe('useTimerStore — closing the tab mid-session', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('does not credit a session the user was not there to finish', async () => {
    const { startedAt, durationMs } = persistRunningSession({ ranOutMsAgo: 3 * 60 * MINUTE });

    useTimerStore.getState().hydrate();
    const session = await settledSession('ses_under_test');

    // The whole point: three hours of silence is not evidence of finishing.
    expect(session.completed).toBe(false);
    expect(session.startedAt).toBe(startedAt);
    expect(session.actualMs).toBe(durationMs);
  });

  it('still counts a session finalised inside the grace window', async () => {
    persistRunningSession({ ranOutMsAgo: MINUTE });

    useTimerStore.getState().hydrate();
    const session = await settledSession('ses_under_test');

    // A refresh, or a lid closed on the last minute, is an ordinary finish.
    expect(session.completed).toBe(true);
  });

  it('ends the session when its clock ran out, not when the tab reopened', async () => {
    const { startedAt, durationMs } = persistRunningSession({ ranOutMsAgo: 3 * 60 * MINUTE });

    useTimerStore.getState().hydrate();
    const session = await settledSession('ses_under_test');

    // Previously stamped at rehydration, which put the end hours — or days —
    // after the start, and exported that to CSV.
    expect(session.endedAt).toBe(startedAt + durationMs);
    expect(session.endedAt).toBeLessThan(Date.now());
  });

  it('awards no XP and no task credit for an abandoned session', async () => {
    await db.tasks.put(makeTask({ id: 'task_a', categoryId: 'cat-deep' }));
    await useTaskStore.getState().load();
    const xpBefore = useSettingsStore.getState().settings.xp;

    persistRunningSession({ ranOutMsAgo: 3 * 60 * MINUTE, taskId: 'task_a', taskTitle: 'A' });
    useTimerStore.getState().hydrate();
    await settledSession('ses_under_test');

    expect(useSettingsStore.getState().settings.xp).toBe(xpBefore);
    expect((await db.tasks.get('task_a'))?.completedSessions).toBe(0);
  });

  it('awards XP and task credit for one that finished inside the window', async () => {
    await db.tasks.put(makeTask({ id: 'task_a', categoryId: 'cat-deep' }));
    await useTaskStore.getState().load();
    const xpBefore = useSettingsStore.getState().settings.xp;

    persistRunningSession({ ranOutMsAgo: MINUTE, taskId: 'task_a', taskTitle: 'A' });
    useTimerStore.getState().hydrate();
    await settledSession('ses_under_test');

    expect(useSettingsStore.getState().settings.xp).toBeGreaterThan(xpBefore);
    expect((await db.tasks.get('task_a'))?.completedSessions).toBe(1);
    // The store is patched in place rather than reloaded, and has to agree.
    const inStore = useTaskStore.getState().tasks.find((t) => t.id === 'task_a');
    expect(inStore?.completedSessions).toBe(1);
    expect(inStore?.status).toBe('active');
  });
});

describe('useTimerStore — category attribution', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it("stamps the session with its task's category", async () => {
    await db.tasks.put(makeTask({ id: 'task_a', categoryId: 'cat-deep' }));
    await useTaskStore.getState().load();

    persistRunningSession({ ranOutMsAgo: MINUTE, taskId: 'task_a', taskTitle: 'A' });
    useTimerStore.getState().hydrate();

    expect((await settledSession('ses_under_test')).categoryId).toBe('cat-deep');
  });

  it('leaves it unset when the task has no category', async () => {
    await db.tasks.put(makeTask({ id: 'task_b' }));
    await useTaskStore.getState().load();

    persistRunningSession({ ranOutMsAgo: MINUTE, taskId: 'task_b', taskTitle: 'B' });
    useTimerStore.getState().hydrate();

    expect((await settledSession('ses_under_test')).categoryId).toBeUndefined();
  });

  it('leaves it unset for a session with no task at all', async () => {
    persistRunningSession({ ranOutMsAgo: MINUTE });
    useTimerStore.getState().hydrate();

    expect((await settledSession('ses_under_test')).categoryId).toBeUndefined();
  });
});

describe('useTimerStore — the pre-session check-in', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
  });

  it('records a skipped check-in as no answer rather than a middling one', () => {
    const store = useTimerStore.getState();
    store.setMood(4, 2);
    store.setMood(null, null);

    expect(useTimerStore.getState().moodBefore).toBeNull();
    expect(useTimerStore.getState().energyBefore).toBeNull();
  });

  it('writes a real check-in onto the session', async () => {
    const store = useTimerStore.getState();
    store.setMood(4, 2);
    await store.startSession('focus');
    const sessionId = useTimerStore.getState().sessionId!;

    await useTimerStore.getState().complete();
    const session = await settledSession(sessionId);

    expect(session.moodBefore).toBe(4);
    expect(session.energyBefore).toBe(2);
  });

  it('leaves the session unrated when the check-in was skipped', async () => {
    const store = useTimerStore.getState();
    // What the dialog now sends when the user picks "Skip". Recording 3/3 here
    // put invented answers into the mood/productivity correlation.
    store.setMood(null, null);
    await store.startSession('focus');
    const sessionId = useTimerStore.getState().sessionId!;

    await useTimerStore.getState().complete();
    const session = await settledSession(sessionId);

    expect(session.moodBefore).toBeUndefined();
    expect(session.energyBefore).toBeUndefined();
  });

  it('does not carry a discarded check-in over to the next session', async () => {
    await useTimerStore.getState().startSession('focus');
    useTimerStore.getState().setMood(5, 5);

    useTimerStore.getState().reset();

    // The mood belonged to the session that was thrown away. Left in place it
    // would attach to whatever starts next, including a start that never asked.
    expect(useTimerStore.getState().moodBefore).toBeNull();
    expect(useTimerStore.getState().energyBefore).toBeNull();
  });
});
