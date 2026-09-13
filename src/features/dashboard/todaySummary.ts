import { formatDuration, pluralize } from '@/lib/utils';

/**
 * The line under the dashboard greeting.
 *
 * It used to count only finished sessions, so a day of sessions ended early
 * read "Nothing logged yet today" directly above a card showing the focus time
 * those same sessions logged. Focus time counts every minute, finished or not,
 * and this line now agrees with it.
 */
export function todaySubtitle(completed: number, focusMs: number): string {
  if (completed > 0) {
    return `${completed} ${pluralize(completed, 'session')} done today — ${formatDuration(focusMs)} of focus.`;
  }
  if (focusMs > 0) {
    return `No session finished yet today — ${formatDuration(focusMs)} of focus so far.`;
  }
  return 'Nothing logged yet today. One session is enough to start.';
}
