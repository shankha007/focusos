import { describe, expect, it } from 'vitest';
import { allTags, filterTasks, type TaskFilters } from '../filterTasks';
import { makeTask } from '@/test/helpers';

const TASKS = [
  makeTask({ id: 'report', title: 'Write the quarterly report', tags: ['writing', 'q3'], categoryId: 'cat-writing' }),
  makeTask({ id: 'bank', title: 'Call the bank', notes: 'About the mortgage', tags: ['admin'], categoryId: 'cat-admin' }),
  makeTask({ id: 'spec', title: 'Read the new spec', tags: ['Learning'], status: 'active' }),
  makeTask({ id: 'deck', title: 'Finish the deck', tags: ['writing'], status: 'done' }),
  makeTask({ id: 'old', title: 'Old launch plan', tags: ['q3'], status: 'archived' }),
];

const base: TaskFilters = { status: 'all', categoryId: 'all', tag: 'all', query: '' };
const ids = (filters: Partial<TaskFilters>) => filterTasks(TASKS, { ...base, ...filters }).map((t) => t.id);

describe('filterTasks — tabs', () => {
  it('shows open work on Open, finished work on Done', () => {
    expect(ids({ status: 'open' })).toEqual(['report', 'bank', 'spec']);
    expect(ids({ status: 'done' })).toEqual(['deck']);
  });

  it('keeps archived tasks on their own tab, and out of All', () => {
    // The status was always filtered out, and nothing could ever set it.
    expect(ids({ status: 'archived' })).toEqual(['old']);
    expect(ids({ status: 'all' })).not.toContain('old');
  });
});

describe('filterTasks — search', () => {
  it('matches titles, ignoring case', () => {
    expect(ids({ query: 'REPORT' })).toEqual(['report']);
  });

  it('matches notes and tags, the other places a word might be remembered from', () => {
    expect(ids({ query: 'mortgage' })).toEqual(['bank']);
    expect(ids({ query: 'learning' })).toEqual(['spec']);
  });

  it('ignores surrounding whitespace, and treats a blank search as none', () => {
    expect(ids({ query: '  bank ' })).toEqual(['bank']);
    expect(ids({ query: '   ' })).toEqual(['report', 'bank', 'spec', 'deck']);
  });

  it('searches within the current tab', () => {
    expect(ids({ status: 'done', query: 'write' })).toEqual([]);
    expect(ids({ status: 'archived', query: 'launch' })).toEqual(['old']);
  });
});

describe('filterTasks — tags and categories', () => {
  it('filters by a tag, which could be entered but never used to filter', () => {
    expect(ids({ tag: 'writing' })).toEqual(['report', 'deck']);
  });

  it('combines every filter at once', () => {
    expect(ids({ status: 'open', tag: 'writing', categoryId: 'cat-writing', query: 'quarterly' })).toEqual(['report']);
  });
});

describe('allTags', () => {
  it('lists each tag once, alphabetically', () => {
    expect(allTags(TASKS)).toEqual(['admin', 'Learning', 'q3', 'writing']);
  });
});
