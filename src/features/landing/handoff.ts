import type { Session } from '@/types';

/**
 * A session finished on the landing page, waiting for the app to adopt it.
 *
 * The landing page runs its timer on nothing but `timerEngine` and React state:
 * no Dexie, no stores, no settings. That is what keeps the marketing page — the
 * one page search engines rank — from downloading the whole application before
 * anyone has decided to use it. The cost is that a session finished there has
 * nowhere to live.
 *
 * So it is parked in localStorage, and the workspace picks it up the first time
 * it opens. Someone's first twenty-five minutes then counts toward their
 * history and their streak, instead of being a demo they have to repeat.
 */
const KEY = 'focusos:handoff-session';

export interface HandoffSession {
  startedAt: number;
  endedAt: number;
  plannedMs: number;
  /** Excludes paused stretches, so it matches what the app records. */
  actualMs: number;
}

/** Stores the finished session for the app to adopt. A second one replaces the first. */
export function parkSession(session: HandoffSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private windows and blocked site data both throw. The session is lost,
    // which is the same outcome as before this existed — never a broken page.
  }
}

/** Reads and validates a parked session. Anything malformed is treated as absent. */
export function readParkedSession(): HandoffSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<HandoffSession>;
    const { startedAt, endedAt, plannedMs, actualMs } = value;

    const numbers = [startedAt, endedAt, plannedMs, actualMs];
    if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n <= 0)) return null;
    // A record whose clock runs backwards would produce a session the analytics
    // cannot place on a day.
    if (endedAt! < startedAt!) return null;

    return {
      startedAt: startedAt!,
      endedAt: endedAt!,
      plannedMs: plannedMs!,
      actualMs: Math.min(actualMs!, plannedMs!),
    };
  } catch {
    return null;
  }
}

/** Forgets the parked session. Called once it has been written to history. */
export function clearParkedSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: a storage that cannot be written to cannot hold a
    // duplicate either.
  }
}

/**
 * The history record for a parked session.
 *
 * Marked `completed` because only a session that ran its full length is ever
 * parked — the landing page discards anything stopped early, exactly as the app
 * does for a false start. There is no task, mood or category: the landing page
 * never asks, and inventing them would put figures into someone's analytics
 * that they did not enter.
 */
export function sessionFromHandoff(parked: HandoffSession, id: string): Session {
  return {
    id,
    type: 'focus',
    plannedMs: parked.plannedMs,
    actualMs: parked.actualMs,
    startedAt: parked.startedAt,
    endedAt: parked.endedAt,
    completed: true,
    distractionCount: 0,
    pausedMs: Math.max(0, parked.endedAt - parked.startedAt - parked.actualMs),
  };
}
