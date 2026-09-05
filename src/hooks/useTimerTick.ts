import { useEffect } from 'react';
import { useTimerStore } from '@/store/useTimerStore';
import { useStatsStore } from '@/store/useStatsStore';
import { formatClock } from '@/lib/utils';
import { remainingMs } from '@/engine/timerEngine';

/**
 * The visual tick only needs to outpace the ring's 0.4s transition for motion
 * to look continuous — framer-motion interpolates between targets. Ticking on
 * every frame instead pushed a store update 60 times a second, re-rendering
 * every timer subscriber for sub-pixel movement nobody can see.
 */
const VISUAL_TICK_MS = 100;

/**
 * The title the document was served with. Captured at module load — before
 * anything here has written to it — so the countdown can be peeled back off
 * without flattening the marketing title in index.html, which is what the
 * landing page is indexed and shared under.
 */
const BASE_TITLE = typeof document === 'undefined' ? 'FocusOS' : document.title;

/**
 * Drives repaints while a session runs. Two independent clocks on purpose:
 * requestAnimationFrame for smooth visuals (paused by the browser when hidden),
 * and a 1s interval as a safety net that keeps firing — throttled but alive —
 * so a session that ends in a background tab still gets closed out.
 */
export function useTimerTick(): void {
  const status = useTimerStore((s) => s.timer.status);

  useEffect(() => {
    if (status !== 'running') return;

    let frame = 0;
    let last = 0;
    /** Animation-frame loop, throttled to the visual tick rate. */
    const loop = (now: number) => {
      if (now - last >= VISUAL_TICK_MS) {
        last = now;
        useTimerStore.getState().doTick();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const interval = window.setInterval(() => useTimerStore.getState().doTick(), 1000);

    // Coming back to the tab, reconcile immediately rather than waiting a frame.
    /** Catches the timer up the moment the tab is looked at again. */
    const onVisible = () => {
      if (document.visibilityState === 'visible') useTimerStore.getState().doTick();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [status]);

  // Mirror the countdown into the tab title so it's readable from another tab.
  useEffect(() => {
    /** Writes the current countdown into the tab title, or restores the title the page was served with when nothing is running. */
    const update = () => {
      const { timer } = useTimerStore.getState();
      if (timer.status === 'running' || timer.status === 'paused') {
        const label = timer.type === 'focus' ? 'Focus' : 'Break';
        const paused = timer.status === 'paused' ? ' (paused)' : '';
        document.title = `${formatClock(remainingMs(timer))} · ${label}${paused} — FocusOS`;
      } else {
        document.title = BASE_TITLE;
      }
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Session history feeds every stat in the app; reload it when one ends.
  useEffect(() => {
    if (status === 'idle') void useStatsStore.getState().refresh();
  }, [status]);
}
