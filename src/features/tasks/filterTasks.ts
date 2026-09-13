import type { Task } from '@/types';

/** Which tasks a tab shows. "All" means everything still in play — archived tasks are kept out of it. */
export type StatusFilter = 'open' | 'done' | 'archived' | 'all';

export interface TaskFilters {
  status: StatusFilter;
  /** A category id, or 'all'. */
  categoryId: string;
  /** A tag, or 'all'. */
  tag: string;
  /** Free text, matched against title, notes and tags. */
  query: string;
}

/**
 * The tasks a board with these filters should show, in their existing order.
 *
 * Tags could always be entered and were drawn on every row, but nothing could
 * filter by them, and there was no search: past a few dozen tasks the board was
 * only navigable by scrolling. Search matches the title, the notes and the tags,
 * ignoring case, since those are the three places a user might remember a word
 * from.
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  const query = filters.query.trim().toLowerCase();

  return tasks.filter((task) => {
    // Archived tasks appear on their own tab and nowhere else.
    if ((filters.status === 'archived') !== (task.status === 'archived')) return false;
    if (filters.status === 'open' && task.status === 'done') return false;
    if (filters.status === 'done' && task.status !== 'done') return false;
    if (filters.categoryId !== 'all' && task.categoryId !== filters.categoryId) return false;
    if (filters.tag !== 'all' && !task.tags.includes(filters.tag)) return false;
    if (query && ![task.title, task.notes ?? '', ...task.tags].some((text) => text.toLowerCase().includes(query))) {
      return false;
    }
    return true;
  });
}

/** Every tag in use, once each, alphabetically — the options for the tag filter. */
export function allTags(tasks: Task[]): string[] {
  return [...new Set(tasks.flatMap((task) => task.tags))].sort((a, b) => a.localeCompare(b));
}
