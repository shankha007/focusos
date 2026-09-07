import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins class names and resolves conflicting Tailwind utilities so the last one wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generates a fresh unique id for a new row. */
export function uid(): string {
  return crypto.randomUUID();
}

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Local-timezone ISO date key (YYYY-MM-DD). Never use toISOString here — it shifts to UTC. */
export function dateKey(ts: number | Date = Date.now()): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Timestamp of midnight at the start of the day containing `ts`, in local time. */
export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Shifts a timestamp by `n` calendar days (negative goes backwards). */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Derived from the next day's start: a DST day is 23 or 25 hours, not 24. */
export function endOfDay(ts: number = Date.now()): number {
  return startOfDay(addDays(startOfDay(ts), 1)) - 1;
}

/** Week starts Monday. */
export function startOfWeek(ts: number = Date.now()): number {
  const d = new Date(startOfDay(ts));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** Timestamp of midnight on the 1st of the month containing `ts`. */
export function startOfMonth(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Timestamp of midnight on January 1st of the year containing `ts`. */
export function startOfYear(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "1:25:04" style clock for the timer readout. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`;
  return `${m}:${`${s}`.padStart(2, '0')}`;
}

/** "2h 15m" style duration for stats. */
export function formatDuration(ms: number, opts: { compact?: boolean } = {}): string {
  const mins = Math.round(ms / MINUTE);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (opts.compact) {
    // Round to tenths of an hour first, so 2h57m carries to "3h" rather than
    // rounding the minutes alone into a nonsensical "2.10h".
    const tenths = Math.round(mins / 6);
    return tenths % 10 === 0 ? `${tenths / 10}h` : `${Math.floor(tenths / 10)}.${tenths % 10}h`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Clock time only, e.g. "3:45 PM", in the reader's locale. */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Short calendar label for chart axes and lists, e.g. "Mar 4". */
export function formatDateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** How long ago `ts` was, in words — "just now", "20m ago", "yesterday", then a date. */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  const days = Math.floor(diff / DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDateLabel(ts);
}

/**
 * How a due date reads on a task row: "Overdue", "Today", "Tomorrow", then a
 * short date. Deliberately relative near the present, where the difference
 * between today and tomorrow is what the reader is actually deciding on.
 */
export function formatDueDate(ts: number): { label: string; tone: 'overdue' | 'today' | 'soon' | 'later' } {
  const days = Math.round((startOfDay(ts) - startOfDay()) / DAY);
  if (days < 0) return { label: days === -1 ? 'Yesterday' : `${Math.abs(days)}d overdue`, tone: 'overdue' };
  if (days === 0) return { label: 'Today', tone: 'today' };
  if (days === 1) return { label: 'Tomorrow', tone: 'soon' };
  if (days < 7) return { label: `In ${days} days`, tone: 'soon' };
  return { label: formatDateLabel(ts), tone: 'later' };
}

/** Pins `n` inside the inclusive range [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Average of `values`, or null for an empty list — never NaN. */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Total of `values`; 0 for an empty list. */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Pearson correlation. Returns null when there's not enough spread to be meaningful. */
export function correlation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n))!;
  const my = mean(ys.slice(0, n))!;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** Picks the singular or plural word to match `n`. */
export function pluralize(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}
