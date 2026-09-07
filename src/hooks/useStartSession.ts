import { useCallback, useState } from 'react';
import type { Rating } from '@/types';
import { useTimerStore } from '@/store/useTimerStore';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Single entry point for "start focusing on this task", so the mood check-in
 * happens consistently no matter which screen the session is launched from.
 */
export function useStartSession(onOpenFocus?: () => void) {
  const askMoodBefore = useSettingsStore((s) => s.settings.askMoodBefore);
  const [moodOpen, setMoodOpen] = useState(false);
  const [pendingTask, setPendingTask] = useState<{ id: string | null; title: string | null }>({
    id: null,
    title: null,
  });

  /** Starts focusing on a task, or opens the mood check-in first when that is switched on. */
  const begin = useCallback(
    (taskId: string | null, taskTitle: string | null) => {
      useTimerStore.getState().setTask(taskId, taskTitle);
      if (askMoodBefore) {
        setPendingTask({ id: taskId, title: taskTitle });
        setMoodOpen(true);
        return;
      }
      void useTimerStore.getState().startSession('focus');
      onOpenFocus?.();
    },
    [askMoodBefore, onOpenFocus],
  );

  /** Records the check-in answers and starts the session that was waiting on them. Nulls mean the prompt was skipped, and are stored as such. */
  const confirmMood = useCallback(
    (mood: Rating | null, energy: Rating | null) => {
      const store = useTimerStore.getState();
      store.setMood(mood, energy);
      void store.startSession('focus');
      onOpenFocus?.();
    },
    [onOpenFocus],
  );

  return { begin, moodOpen, setMoodOpen, confirmMood, pendingTaskTitle: pendingTask.title };
}
