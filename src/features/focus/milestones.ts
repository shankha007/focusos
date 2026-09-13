import type { SessionType } from '@/types';
import { labelForType, remainingMs, type TimerState } from '@/engine/timerEngine';
import { MINUTE } from '@/lib/utils';

/** A point in a session worth announcing. */
export type Milestone = 'halfway' | 'five-minutes' | 'one-minute';

/**
 * The milestones a session of this length announces, and when.
 *
 * A threshold that would fire at, or very near, the start of a session is left
 * out — a five-minute break does not open by saying "five minutes left". And
 * halfway is only announced when it falls well clear of the five-minute mark,
 * so a ten-minute session does not announce two things in the same breath.
 */
function thresholdsFor(durationMs: number): { milestone: Milestone; remainingMs: number }[] {
  const thresholds: { milestone: Milestone; remainingMs: number }[] = [];
  if (durationMs >= 12 * MINUTE) thresholds.push({ milestone: 'halfway', remainingMs: durationMs / 2 });
  if (durationMs > 6 * MINUTE) thresholds.push({ milestone: 'five-minutes', remainingMs: 5 * MINUTE });
  if (durationMs > 2 * MINUTE) thresholds.push({ milestone: 'one-minute', remainingMs: MINUTE });
  return thresholds;
}

/** The latest milestone the session has passed, or null before the first. */
export function milestoneReached(remaining: number, durationMs: number): Milestone | null {
  let reached: Milestone | null = null;
  // Ordered from most time remaining to least, so the last match is the latest.
  for (const threshold of thresholdsFor(durationMs)) {
    if (remaining <= threshold.remainingMs) reached = threshold.milestone;
  }
  return reached;
}

/** What the session is called in a sentence. */
function sessionNoun(type: SessionType): string {
  return type === 'focus' ? 'focus session' : labelForType(type).toLowerCase();
}

/**
 * What the Deep Focus live region says right now.
 *
 * The countdown itself is deliberately silent — reading every second aloud
 * would make the screen unusable — but it used to be silent for the whole
 * session, so someone using a screen reader had no way to know how far along
 * they were. It now speaks at the milestones.
 *
 * This is a plain function of the timer, not state. A live region announces
 * when its text changes, and the text only changes when a milestone is crossed
 * or the timer pauses or stops. Opening Deep Focus part-way through a session
 * mounts the region with its current text, which is not announced, so it does
 * not recite milestones that are already behind.
 */
export function countdownAnnouncement(timer: TimerState, now = Date.now()): string {
  if (timer.status === 'paused') return 'Timer paused';
  if (timer.status !== 'running') return 'Timer stopped';

  const milestone = milestoneReached(remainingMs(timer, now), timer.durationMs);
  const noun = sessionNoun(timer.type);
  switch (milestone) {
    case 'halfway':
      return `Halfway through this ${noun}.`;
    case 'five-minutes':
      return `Five minutes left in this ${noun}.`;
    case 'one-minute':
      return `One minute left in this ${noun}.`;
    default:
      return `${labelForType(timer.type)} in progress`;
  }
}
