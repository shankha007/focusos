import { remainingMs, type TimerState } from '@/engine/timerEngine';
import type { SessionType } from '@/types';

/**
 * Key the app tab writes its timer under in `chrome.storage.local`.
 *
 * The popup and the background worker cannot see the store, so the app
 * publishes this small summary of it for them. The extension's own scripts read
 * the same key — keep `extension/background.js` and `extension/popup.js` in
 * step if it changes.
 */
export const SUMMARY_KEY = 'focusos:timerSummary';

/** Key the popup leaves a command under when no app tab is open to receive it. */
export const PENDING_COMMAND_KEY = 'focusos:pendingCommand';

/** What the popup and background worker are told about the running timer. */
export interface TimerSummary {
  status: TimerState['status'];
  type: SessionType;
  durationMs: number;
  /** Wall-clock end of a running session. Null unless running. */
  endsAt: number | null;
  /** Time left, frozen at the moment of writing. Read `endsAt` instead while running. */
  remainingMs: number;
  taskTitle: string | null;
}

/** The commands the popup and the keyboard shortcut can send to the app. */
export type ExtensionCommand = 'start' | 'toggle' | 'skip';

/**
 * Reduces the store's timer to what the extension's own scripts need.
 *
 * `endsAt` rather than a remaining count while running: the background worker
 * schedules its alarm from it, and the popup counts down to it without hearing
 * from the app again. A paused or idle timer has no end, only time left.
 */
export function summarize(
  timer: TimerState,
  taskTitle: string | null,
  now = Date.now(),
): TimerSummary {
  const left = remainingMs(timer, now);
  return {
    status: timer.status,
    type: timer.type,
    durationMs: timer.durationMs,
    endsAt: timer.status === 'running' ? now + left : null,
    remainingMs: left,
    taskTitle,
  };
}

/**
 * Whether two summaries describe the same timer.
 *
 * The store changes every second while a session runs (the repaint tick), and
 * each recomputed `endsAt` drifts by a millisecond or two. Writing on every one
 * of those would wake the background worker once a second for nothing, so
 * anything within a second of the last written end counts as unchanged.
 */
export function sameSummary(a: TimerSummary | null, b: TimerSummary): boolean {
  if (!a) return false;
  if (
    a.status !== b.status ||
    a.type !== b.type ||
    a.durationMs !== b.durationMs ||
    a.taskTitle !== b.taskTitle
  ) {
    return false;
  }
  if (a.endsAt !== null && b.endsAt !== null) return Math.abs(a.endsAt - b.endsAt) < 1000;
  if (a.endsAt !== b.endsAt) return false;
  return Math.abs(a.remainingMs - b.remainingMs) < 1000;
}

/** Narrows an untyped message to one of ours. Anything else on the runtime is ignored. */
export function readCommand(message: unknown): ExtensionCommand | null {
  if (typeof message !== 'object' || message === null) return null;
  const { type, command } = message as { type?: unknown; command?: unknown };
  if (type !== 'focusos:command') return null;
  return command === 'start' || command === 'toggle' || command === 'skip' ? command : null;
}

/** Whether a message asks the app tab to bring itself to the front. */
export function isFocusRequest(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'focusos:focus'
  );
}
