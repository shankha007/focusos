import { dateKey } from '@/lib/utils';

/**
 * When Deep Focus may suggest ambient sound.
 *
 * A suggestion inside the one screen built to be free of interruptions has to
 * earn its place, so it is rationed hard: once a day at most, and never again
 * once someone has waved it away a few times. Letting it fade on its own is not
 * a refusal — they may simply not have looked up — so only the close button
 * counts.
 */

const KEY = 'focusos:sound-nudge';

/** Dismissals after which the suggestion is retired for good. */
export const NUDGE_RETIRE_AFTER = 3;

/** How long into a running session before it appears — after the start, never at it. */
export const NUDGE_DELAY_MS = 4000;

/** How long it stays before fading out by itself. */
export const NUDGE_VISIBLE_MS = 10000;

export interface NudgeRecord {
  /** Local date (`dateKey`) it was last shown. */
  lastShown?: string;
  dismissals: number;
}

export function readNudge(): NudgeRecord {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NudgeRecord> | null;
    return {
      lastShown: typeof raw?.lastShown === 'string' ? raw.lastShown : undefined,
      dismissals: typeof raw?.dismissals === 'number' && raw.dismissals >= 0 ? raw.dismissals : 0,
    };
  } catch {
    return { dismissals: 0 };
  }
}

function writeNudge(record: NudgeRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable: the worst case is one extra suggestion a day.
  }
}

/** Whether the record allows a suggestion today. */
export function nudgeAllowed(record: NudgeRecord, now: number = Date.now()): boolean {
  return record.dismissals < NUDGE_RETIRE_AFTER && record.lastShown !== dateKey(now);
}

export function markNudgeShown(now: number = Date.now()): void {
  writeNudge({ ...readNudge(), lastShown: dateKey(now) });
}

export function markNudgeDismissed(): void {
  const record = readNudge();
  writeNudge({ ...record, dismissals: record.dismissals + 1 });
}
