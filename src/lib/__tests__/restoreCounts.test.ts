import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { parseBackup, restoreBackup } from '../backup';
import { makeSession, makeTask, resetApp } from '@/test/helpers';

/**
 * A merge used to report every row in the file as restored, so merging a
 * backup of data already on the device announced "Restored 189 records" when
 * nothing had changed. `added` says what the restore actually brought in.
 */

const backupOf = (tasks: ReturnType<typeof makeTask>[], sessions: ReturnType<typeof makeSession>[]) =>
  parseBackup(JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), tasks, sessions }));

describe('restoreBackup — what it reports', () => {
  beforeEach(async () => {
    await resetApp();
    await db.tasks.bulkPut([makeTask({ id: 'task_a' }), makeTask({ id: 'task_b' })]);
    await db.sessions.bulkPut([makeSession({ id: 'ses_a' })]);
  });

  it('adds nothing when merging a backup of what is already here', async () => {
    const result = await restoreBackup(backupOf([makeTask({ id: 'task_a' }), makeTask({ id: 'task_b' })], [makeSession({ id: 'ses_a' })]), 'merge');
    expect(result.total).toBe(3);
    expect(result.added).toBe(0);
  });

  it('counts only the rows a merge brings in', async () => {
    const result = await restoreBackup(
      backupOf([makeTask({ id: 'task_a' }), makeTask({ id: 'task_new' })], [makeSession({ id: 'ses_a' }), makeSession({ id: 'ses_new' })]),
      'merge',
    );
    expect(result.total).toBe(4);
    expect(result.added).toBe(2);
    expect(await db.tasks.count()).toBe(3);
    expect(await db.sessions.count()).toBe(2);
  });

  it('counts everything as added on a replace', async () => {
    const result = await restoreBackup(backupOf([makeTask({ id: 'task_a' })], [makeSession({ id: 'ses_a' })]), 'replace');
    expect(result.added).toBe(result.total);
    expect(await db.tasks.count()).toBe(1);
  });
});
