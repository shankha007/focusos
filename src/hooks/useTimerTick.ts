import { useEffect } from 'react';
import { useTimerStore } from '@/store/useTimerStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { ambient } from '@/lib/audio';
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
 * What the tab says when nothing is running.
 *
 * A constant, matching the <title> in app.html, rather than whatever
 * `document.title` happened to be when this module loaded. The app's chunk is
 * fetched on the first navigation into the workspace, which can be a click from
 * the landing page or from /privacy — so reading the document meant the app
 * adopted a marketing title and restored it after every session.
 */
const BASE_TITLE = 'FocusOS';

/**
 * Drives repaints while a session runs. Two independent clocks on purpose:
 * requestAnimationFrame for smooth visuals (paused by the browser when hidden),
 * and a 1s interval as a safety net that keeps firing — throttled but alive —
 * so a session that ends in a background tab still gets closed out.
 *
 * This used to reload the whole session history whenever the timer went idle,
 * too. `complete` already applies the one change it made to that history, so
 * the reload was a second full read of every session and distraction ever
 * logged, on every session end and every reset.
 */
export function useTimerTick(): void {
  const status = useTimerStore((s) => s.timer.status);
  const sessionType = useTimerStore((s) => s.timer.type);
  const ticking = useSettingsStore((s) => s.settings.tickingEnabled);
  const volume = useSettingsStore((s) => s.settings.soundVolume);

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
    const write = () => {
      const { timer } = useTimerStore.getState();
      if (timer.status === 'running' || timer.status === 'paused') {
        const label = timer.type === 'focus' ? 'Focus' : 'Break';
        const paused = timer.status === 'paused' ? ' (paused)' : '';
        document.title = `${formatClock(remainingMs(timer))} · ${label}${paused} — FocusOS`;
      } else {
        document.title = BASE_TITLE;
      }
    };
    write();

    // Only a running clock changes the title from one second to the next. A
    // paused one shows a fixed remaining time and an idle one the served title,
    // so writing once is all either needs. The interval used to run regardless,
    // waking every second for as long as the tab stayed open.
    if (status !== 'running') return;
    const id = window.setInterval(write, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // The optional ticking clock, during focus only. `tickingEnabled` was stored
  // from the start with nothing behind it. Kept apart from the tick loop above,
  // whose interval is the safety net that closes out a session in a background
  // tab and should not grow side effects.
  useEffect(() => {
    if (!ticking || status !== 'running' || sessionType !== 'focus') return;
    const id = window.setInterval(() => ambient.tick(volume), 1000);
    return () => window.clearInterval(id);
  }, [ticking, status, sessionType, volume]);
}
