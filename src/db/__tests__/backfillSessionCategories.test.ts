import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { backfillSessionCategories, db } from '../schema';
import { parseBackup, restoreBackup } from '@/lib/backup';
import { makeSession, makeTask, resetApp } from '@/test/helpers';

/**
 * The rows the migration has to tell apart. Only the first has an answer to
 * recover; every other case is one the migration must leave alone rather than
 * guess at.
 */
const TASKS = [makeTask({ id: 'task_a', categoryId: 'cat-deep' }), makeTask({ id: 'task_b' })];

const SESSIONS = [
  makeSession({ id: 's1_fillable', taskId: 'task_a' }),
  makeSession({ id: 's2_task_has_no_category', taskId: 'task_b' }),
  makeSession({ id: 's3_task_deleted', taskId: 'task_gone' }),
  makeSession({ id: 's4_no_task' }),
  makeSession({ id: 's5_break', taskId: 'task_a', type: 'short-break' }),
  makeSession({ id: 's6_already_set', taskId: 'task_a', categoryId: 'cat-writing' }),
];

/** The category each session ends up with, keyed by id, for one readable assertion. */
async function categoriesById(): Promise<Record<string, string | null>> {
  const rows = await db.sessions.toArray();
  return Object.fromEntries(
    rows.sort((a, b) => a.id.localeCompare(b.id)).map((s) => [s.id, s.categoryId ?? null]),
  );
}

/**
 * Builds a database at schema version 3 — the shape that predates `categoryId`
 * ever being written — and seeds it. Declaring the old versions by hand is the
 * only way to test the upgrade: pointing the current schema at the data would
 * skip the very migration under test.
 */
async function seedDatabaseAtVersion3(): Promise<void> {
  if (db.isOpen()) db.close();
  await Dexie.delete('focusos');

  const old = new Dexie('focusos');
  old.version(1).stores({
    tasks: 'id, status, priority, categoryId, order, createdAt, completedAt',
    sessions: 'id, startedAt, taskId, type, completed, categoryId',
    distractions: 'id, at, sessionId, categoryId',
    categories: 'id, name, createdAt',
    distractionCategories: 'id, label',
    achievements: 'id, unlockedAt',
    settings: 'id',
  });
  old.version(2).stores({ timerPresets: 'id, name, createdAt' });
  old.version(3).stores({ hydration: 'date' });

  await old.open();
  expect(old.verno).toBe(3);
  await old.table('tasks').bulkPut(TASKS);
  await old.table('sessions').bulkPut(SESSIONS);
  old.close();
}

describe('backfillSessionCategories — as a schema upgrade', () => {
  beforeEach(seedDatabaseAtVersion3);

  it('attributes what it can and guesses at nothing', async () => {
    await db.open();

    expect(db.verno).toBe(4);
    expect(await categoriesById()).toEqual({
      // The one recoverable case: the task is still here and has a category.
      s1_fillable: 'cat-deep',
      // No answer exists for these, and inventing one is the bug this fixes.
      s2_task_has_no_category: null,
      s3_task_deleted: null,
      s4_no_task: null,
      // Breaks are never work on a task, so they are never attributed to one.
      s5_break: null,
      // History records what was true when it was logged, even if the task has
      // been moved to another category since.
      s6_already_set: 'cat-writing',
    });
  });

  it('changes nothing on a second pass', async () => {
    await db.open();
    const afterUpgrade = await categoriesById();

    expect(await backfillSessionCategories(db.sessions, db.tasks)).toBe(0);
    expect(await categoriesById()).toEqual(afterUpgrade);
  });
});

describe('backfillSessionCategories — on restore', () => {
  beforeEach(resetApp);

  it('attributes sessions arriving from a backup written before the migration', async () => {
    const now = Date.now();
    const file = JSON.stringify({
      version: 3,
      exportedAt: new Date(now).toISOString(),
      tasks: [makeTask({ id: 'task_r', categoryId: 'cat-writing' })],
      // As they appear in an older export: no categoryId anywhere.
      sessions: [
        makeSession({ id: 'r1_fillable', taskId: 'task_r' }),
        makeSession({ id: 'r2_orphan', taskId: 'task_missing' }),
      ],
    });

    const parsed = parseBackup(file);
    expect(parsed.rows.sessions.every((s) => s.categoryId === undefined)).toBe(true);

    // The schema upgrade has already run for this database, so nothing else
    // would ever attribute these rows.
    await restoreBackup(parsed, 'replace');

    expect(await categoriesById()).toEqual({ r1_fillable: 'cat-writing', r2_orphan: null });
  });
});
