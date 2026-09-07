import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { applyUpdate, isUpdateWaiting, onUpdateWaiting } from '@/lib/pwa';
import { useTimerStore } from '@/store/useTimerStore';

/**
 * Lets a new build take over without walking through a session.
 *
 * A deploy used to reload the page the moment the new worker activated. The
 * session itself survived — it is mirrored to localStorage and its remaining
 * time comes from `startedAt` — but the ambient soundscape and the
 * picture-in-picture timer did not, and neither did any warning.
 *
 * So: reload straight away when the clock is not running, since there is
 * nothing to interrupt and staying a version behind helps nobody. While a
 * session is in flight, say so and leave it to the user — and if they ignore
 * it, take the update the moment the session ends, which is the first point it
 * costs them nothing.
 */
export function useAppUpdate(): void {
  const sessionInFlight = useTimerStore(
    (s) => s.timer.status === 'running' || s.timer.status === 'paused',
  );
  const [waiting, setWaiting] = useState(isUpdateWaiting);

  useEffect(() => onUpdateWaiting(() => setWaiting(true)), []);

  useEffect(() => {
    if (!waiting) return;

    if (!sessionInFlight) {
      void applyUpdate();
      return;
    }

    const id = toast('A new version is ready', {
      description: 'It will load when this session ends, or you can take it now.',
      duration: Infinity,
      action: {
        label: 'Reload now',
        onClick: () => void applyUpdate(),
      },
    });

    // The session ending re-runs this effect, which clears the prompt on the
    // way to applying the update — so the toast never outlives the reason for it.
    return () => {
      toast.dismiss(id);
    };
  }, [waiting, sessionInFlight]);
}
