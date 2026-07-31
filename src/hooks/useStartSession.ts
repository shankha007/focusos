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

  const confirmMood = useCallback(
    (mood: Rating, energy: Rating) => {
      const store = useTimerStore.getState();
      store.setMood(mood, energy);
      void store.startSession('focus');
      onOpenFocus?.();
    },
    [onOpenFocus],
  );

  return { begin, moodOpen, setMoodOpen, confirmMood, pendingTaskTitle: pendingTask.title };
}
