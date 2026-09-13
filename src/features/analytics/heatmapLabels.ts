import type { heatmapData } from '@/engine/analytics';
import { formatDuration, pluralize } from '@/lib/utils';

/** One day in the heatmap. */
export type HeatmapCell = ReturnType<typeof heatmapData>[number];

/**
 * What a screen reader says for a day.
 *
 * Every cell used to be a bare, unfocusable square whose only description lived
 * in a hover tooltip, so a year of history reached nobody who does not use a
 * mouse. The label carries the weekday as well as the date because the grid's
 * row labels are visual only.
 *
 * Focus time and finished sessions are reported separately. A day can hold real
 * focus with nothing finished — twenty minutes on a session that was skipped —
 * and "20m across 0 sessions" reads like an error rather than a fact.
 */
export function heatmapCellLabel(cell: HeatmapCell): string {
  const day = new Date(cell.ts).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  if (cell.focusMs === 0) return `${day}: no focus`;
  const finished =
    cell.sessions === 0
      ? 'no sessions finished'
      : `${cell.sessions} ${pluralize(cell.sessions, 'session')} finished`;
  return `${day}: ${formatDuration(cell.focusMs)} of focus, ${finished}`;
}

/** The short text shown in the floating tooltip, for sighted mouse and keyboard users alike. */
export function heatmapTooltipText(cell: HeatmapCell): string {
  return cell.focusMs > 0
    ? `${formatDuration(cell.focusMs)} · ${cell.sessions} ${pluralize(cell.sessions, 'session')} on ${cell.date}`
    : `No focus on ${cell.date}`;
}

/** A one-line summary of the whole grid, read before anyone starts moving through it. */
export function heatmapSummary(cells: HeatmapCell[]): string {
  const active = cells.filter((cell) => cell.focusMs > 0).length;
  return `Focus on ${active} of the last ${cells.length} days. Use the arrow keys to move between days.`;
}
