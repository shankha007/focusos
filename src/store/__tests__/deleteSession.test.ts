import { beforeEach, describe, expect, it } from 'vitest';
import { deleteSession } from '../sessionHistory';
import { useTimerStore } from '../useTimerStore';
import { useSettingsStore } from '../useSettingsStore';
import { useStatsStore } from '../useStatsStore';
import { useTaskStore } from '../useTaskStore';
import { distractionsRepo, sessionsRepo } from '@/db/repositories';
import { db } from '@/db/schema';
import { MINUTE } from '@/lib/utils';
import { bootStores, resetApp } from '@/test/helpers';

/** Runs a focus session on a task, with a distraction, that has been going `minutes`, and ends it. */
async function runSession(opts: { minutes: number; early?: boolean; taskId?: string }) {
  if (opts.taskId) {
    const task = useTaskStore.getState().tasks.find((t) => t.id === opts.taskId)!;
    useTimerStore.getState().setTask(task.id, task.title);
  }
  await useTimerStore.getState().startSession('focus');
  const id = useTimerStore.getState().sessionId!;
  await useTimerStore.getState().logDistraction('d-phone', 'Texted back');
  useTimerStore.setState((s) => ({ timer: { ...s.timer, startedAt: Date.now() - opts.minutes * MINUTE } }));
  await useTimerStore.getState().complete({ early: opts.early });
  useTimerStore.setState({ pendingReview: null, pendingParked: [] });
  return id;
}

describe('deleteSession', () => {
  beforeEach(async () => {
    await resetApp();
    await bootStores();
    await useSettingsStore.getState().update({ autoStartBreaks: false });
  });

  it('removes the session and its distractions, from disk and from memory', async () => {
    const id = await runSession({ minutes: 26 });
    expect(await sessionsRepo.get(id)).toBeDefined();

    await deleteSession(id);

    expect(await sessionsRepo.get(id)).toBeUndefined();
    expect(await distractionsRepo.all()).toHaveLength(0);
    expect(useStatsStore.getState().sessions.some((s) => s.id === id)).toBe(false);
    expect(useStatsStore.getState().distractions).toHaveLength(0);
  });

  it('takes back the XP and task credit a finished session earned', async () => {
    const task = await useTaskStore.getState().create({ title: 'Write the report' });
    const xpBefore = useSettingsStore.getState().settings.xp;

    const id = await runSession({ minutes: 26, taskId: task.id });
    expect(useSettingsStore.getState().settings.xp).toBeGreaterThan(xpBefore);
    expect((await db.tasks.get(task.id))?.completedSessions).toBe(1);

    await deleteSession(id);

    // Otherwise the level and the task's progress keep counting a session that
    // no longer exists.
    expect(useSettingsStore.getState().settings.xp).toBe(xpBefore);
    const after = await db.tasks.get(task.id);
    expect(after?.completedSessions).toBe(0);
    expect(after?.status).toBe('todo');
    expect(useTaskStore.getState().tasks.find((t) => t.id === task.id)?.completedSessions).toBe(0);
  });

  it('leaves XP alone for an abandoned session, which never earned any', async () => {
    const id = await runSession({ minutes: 10, early: true });
    const session = await sessionsRepo.get(id);
    expect(session?.completed).toBe(false);
    const xpBefore = useSettingsStore.getState().settings.xp;

    await deleteSession(id);

    expect(useSettingsStore.getState().settings.xp).toBe(xpBefore);
  });

  it('drops a review still waiting on the deleted session', async () => {
    const id = await runSession({ minutes: 26 });
    const session = (await sessionsRepo.get(id))!;
    useTimerStore.setState({ pendingReview: session });

    await deleteSession(id);

    expect(useTimerStore.getState().pendingReview).toBeNull();
  });

  it('does nothing for a session that is not there', async () => {
    await expect(deleteSession('ses_never_existed')).resolves.toBeUndefined();
  });
});
