import type { SessionType } from '@/types';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

/**
 * The timer's entire state is derived from wall-clock timestamps rather than
 * accumulated ticks. Intervals drift, and browsers throttle or suspend them in
 * background tabs — a tick-counting timer silently loses minutes. Here, ticks
 * only drive repaints; the numbers always come from `Date.now()`.
 */
export interface TimerState {
  status: TimerStatus;
  type: SessionType;
  durationMs: number;
  /** When the current run began. Null while idle. */
  startedAt: number | null;
  /** Total time spent paused so far, excluded from elapsed. */
  pausedAccumMs: number;
  /** When the active pause began. Null unless paused. */
  pausedAt: number | null;
  /** Completed focus sessions in the current cycle, for long-break scheduling. */
  cycleCount: number;
}

/** A fresh, idle timer for the given session type and length. Nothing runs until `start` is called. */
export function createTimerState(type: SessionType, durationMs: number): TimerState {
  return {
    status: 'idle',
    type,
    durationMs,
    startedAt: null,
    pausedAccumMs: 0,
    pausedAt: null,
    cycleCount: 0,
  };
}

/** Begins the countdown from `now`, clearing any pause history from a previous run. */
export function start(state: TimerState, now = Date.now()): TimerState {
  return { ...state, status: 'running', startedAt: now, pausedAccumMs: 0, pausedAt: null };
}

/** Freezes a running timer. Time spent paused is later excluded from elapsed. No-op unless the timer is running. */
export function pause(state: TimerState, now = Date.now()): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', pausedAt: now };
}

/** Restarts a paused timer, banking the length of the pause so it doesn't count as focus. No-op unless the timer is paused. */
export function resume(state: TimerState, now = Date.now()): TimerState {
  if (state.status !== 'paused' || state.pausedAt === null) return state;
  return {
    ...state,
    status: 'running',
    pausedAccumMs: state.pausedAccumMs + (now - state.pausedAt),
    pausedAt: null,
  };
}

/** Returns the timer to idle, optionally with a new duration. Used when the user stops a session or switches session type. */
export function reset(state: TimerState, durationMs = state.durationMs): TimerState {
  return {
    ...state,
    status: 'idle',
    durationMs,
    startedAt: null,
    pausedAccumMs: 0,
    pausedAt: null,
  };
}

/** Milliseconds of genuine focus elapsed, excluding paused stretches. */
export function elapsedMs(state: TimerState, now = Date.now()): number {
  if (state.startedAt === null) return 0;
  const pausedNow = state.pausedAt !== null ? now - state.pausedAt : 0;
  const raw = now - state.startedAt - state.pausedAccumMs - pausedNow;
  return Math.max(0, raw);
}

/** Milliseconds left on the clock, floored at zero. An idle timer reports its full duration. */
export function remainingMs(state: TimerState, now = Date.now()): number {
  if (state.status === 'idle') return state.durationMs;
  return Math.max(0, state.durationMs - elapsedMs(state, now));
}

/** 0 → 1. Drives the ring; clamped so a long background gap can't overshoot. */
export function progress(state: TimerState, now = Date.now()): number {
  if (state.durationMs <= 0) return 0;
  return Math.min(1, elapsedMs(state, now) / state.durationMs);
}

/** Whether a started session has run out of time. */
export function isComplete(state: TimerState, now = Date.now()): boolean {
  return state.status !== 'idle' && remainingMs(state, now) <= 0;
}

/**
 * Wall-clock time the session will finish, so the UI can show "ends at 3:45pm"
 * and stay correct even if the tab sleeps.
 */
export function projectedEndAt(state: TimerState, now = Date.now()): number | null {
  if (state.startedAt === null) return null;
  return now + remainingMs(state, now);
}

/**
 * Standard Pomodoro cadence: long break after every N focus sessions.
 *
 * `completedFocusSessions` is the number banked in the current cycle *including*
 * the interval that just ended, so a skipped session — which banks nothing —
 * cannot earn a long break it did not work for.
 */
export function nextSessionType(
  justFinished: SessionType,
  completedFocusSessions: number,
  sessionsUntilLongBreak: number,
): SessionType {
  if (justFinished !== 'focus') return 'focus';
  // Nothing banked yet means the cycle hasn't started; 0 % N is 0, which would
  // otherwise read as "a full cycle done".
  if (completedFocusSessions === 0) return 'short-break';
  return completedFocusSessions % sessionsUntilLongBreak === 0 ? 'long-break' : 'short-break';
}

/** The configured length for a focus, short-break or long-break session. */
export function durationForType(
  type: SessionType,
  settings: { focusMs: number; shortBreakMs: number; longBreakMs: number },
): number {
  switch (type) {
    case 'focus':
      return settings.focusMs;
    case 'short-break':
      return settings.shortBreakMs;
    case 'long-break':
      return settings.longBreakMs;
  }
}

/** Human-readable name of a session type, for headings and notifications. */
export function labelForType(type: SessionType): string {
  switch (type) {
    case 'focus':
      return 'Focus';
    case 'short-break':
      return 'Short break';
    case 'long-break':
      return 'Long break';
  }
}
