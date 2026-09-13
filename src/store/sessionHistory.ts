import { sessionsRepo, tasksRepo } from '@/db/repositories';
import { xpForSession } from '@/engine/achievements';
import { useSettingsStore } from './useSettingsStore';
import { useStatsStore } from './useStatsStore';
import { useTaskStore } from './useTaskStore';
import { useTimerStore } from './useTimerStore';

/**
 * Deletes a logged session as though it had never been recorded.
 *
 * There used to be no way to correct history at all. One accidental skip, or a
 * session left running over lunch, permanently skewed the streak, the focus
 * score and the suggested session length, and the only remedy on offer was
 * wiping everything.
 *
 * Removing the row is not enough on its own. Finishing a focus session also
 * credited its task and awarded XP, both stored separately from the session, so
 * deleting it takes those back too — otherwise the task's progress and the
 * level would keep counting a session that no longer exists. Streaks, the focus
 * score and achievements are derived from the sessions themselves, so they
 * follow automatically.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const session = await sessionsRepo.get(sessionId);
  if (!session) return;

  await sessionsRepo.remove(sessionId);
  useStatsStore.getState().removeSession(sessionId);

  // A review still waiting on this session would otherwise save onto nothing.
  if (useTimerStore.getState().pendingReview?.id === sessionId) {
    useTimerStore.setState({ pendingReview: null });
  }

  if (session.type !== 'focus' || !session.completed) return;

  if (session.taskId) {
    await tasksRepo.decrementSessions(session.taskId);
    await useTaskStore.getState().load();
  }

  const { settings, update } = useSettingsStore.getState();
  await update({ xp: Math.max(0, settings.xp - xpForSession(session)) });
}
