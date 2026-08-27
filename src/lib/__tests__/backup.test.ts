import { describe, expect, it } from 'vitest';
import { BackupError, parseBackup } from '../backup';
import { MINUTE } from '../utils';

/**
 * `parseBackup` is the gate in front of the only operation that can destroy a
 * user's history, and its input is an arbitrary file off disk. These cover the
 * shapes that gate actually has to survive.
 */

function file(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ version: 2, exportedAt: '2026-08-01T10:00:00.000Z', ...overrides });
}

const validTask = {
  id: 'task_1',
  title: 'Draft the intro',
  status: 'todo',
  priority: 'high',
  estimatedSessions: 3,
  completedSessions: 1,
  order: 0,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  tags: ['writing'],
};

const validSession = {
  id: 'ses_1',
  type: 'focus',
  plannedMs: 25 * MINUTE,
  actualMs: 24 * MINUTE,
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_001_500_000,
  completed: true,
  distractionCount: 0,
  pausedMs: 0,
};

describe('parseBackup — rejecting what it should', () => {
  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json at all')).toThrow(BackupError);
  });

  it('rejects JSON that is not an object', () => {
    expect(() => parseBackup('[1, 2, 3]')).toThrow(BackupError);
    expect(() => parseBackup('"hello"')).toThrow(BackupError);
  });

  it('rejects an object with no version field', () => {
    expect(() => parseBackup(JSON.stringify({ tasks: [validTask] }))).toThrow(BackupError);
  });

  it('rejects a backup written by a newer format than this build reads', () => {
    expect(() => parseBackup(file({ version: 99, tasks: [validTask] }))).toThrow(
      /newer version/i,
    );
  });

  it('rejects a file with nothing restorable in it', () => {
    expect(() => parseBackup(file({ tasks: [], sessions: [] }))).toThrow(/empty/i);
  });
});

describe('parseBackup — accepting what it should', () => {
  it('reads a well-formed backup', () => {
    const parsed = parseBackup(file({ tasks: [validTask], sessions: [validSession] }));
    expect(parsed.rows.tasks).toHaveLength(1);
    expect(parsed.rows.sessions).toHaveLength(1);
    expect(parsed.rows.tasks[0].title).toBe('Draft the intro');
    expect(parsed.exportedAt).toBe('2026-08-01T10:00:00.000Z');
    expect(parsed.skipped).toEqual({});
  });

  it('accepts an older format version, leaving newer tables empty', () => {
    const parsed = parseBackup(file({ version: 1, tasks: [validTask] }));
    expect(parsed.rows.tasks).toHaveLength(1);
    expect(parsed.rows.timerPresets).toEqual([]);
  });

  it('reads settings from the one-row table the export writes', () => {
    const parsed = parseBackup(
      file({ tasks: [validTask], settings: [{ id: 'settings', focusMs: 50 * MINUTE }] }),
    );
    expect(parsed.settings?.focusMs).toBe(50 * MINUTE);
    // Keys the old file never had come back as defaults, not undefined.
    expect(parsed.settings?.sessionsUntilLongBreak).toBe(4);
  });

  it('treats a bare settings object the same as a one-row table', () => {
    const parsed = parseBackup(
      file({ tasks: [validTask], settings: { id: 'settings', xp: 120 } }),
    );
    expect(parsed.settings?.xp).toBe(120);
  });
});

describe('parseBackup — dropping bad rows without failing the file', () => {
  it('skips rows missing the fields nothing can be reconstructed without', () => {
    const parsed = parseBackup(
      file({
        tasks: [validTask, { id: 'task_2' }, { title: 'no id' }, null, 'nonsense'],
        // A session with no start can't be placed on any chart.
        sessions: [validSession, { id: 'ses_2', type: 'focus' }],
      }),
    );
    expect(parsed.rows.tasks).toHaveLength(1);
    expect(parsed.skipped.tasks).toBe(4);
    expect(parsed.rows.sessions).toHaveLength(1);
    expect(parsed.skipped.sessions).toBe(1);
  });

  it('keeps the first of any duplicated id and counts the rest as skipped', () => {
    const parsed = parseBackup(
      file({ tasks: [validTask, { ...validTask, title: 'Shadow copy' }] }),
    );
    expect(parsed.rows.tasks).toHaveLength(1);
    expect(parsed.rows.tasks[0].title).toBe('Draft the intro');
    expect(parsed.skipped.tasks).toBe(1);
  });

  it('substitutes defaults for malformed non-essential fields', () => {
    const parsed = parseBackup(
      file({
        tasks: [{ ...validTask, status: 'bogus', priority: 42, tags: ['ok', 7, null] }],
        sessions: [{ ...validSession, type: 'nap', moodBefore: 9, actualMs: -500 }],
      }),
    );
    const task = parsed.rows.tasks[0];
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.tags).toEqual(['ok']);

    const session = parsed.rows.sessions[0];
    expect(session.type).toBe('focus');
    // Out-of-range ratings are dropped rather than clamped into a made-up value.
    expect(session.moodBefore).toBeUndefined();
    expect(session.actualMs).toBe(0);
  });

  it('ignores a collection that is not an array', () => {
    const parsed = parseBackup(file({ tasks: [validTask], distractions: 'oops' }));
    expect(parsed.rows.distractions).toEqual([]);
  });

  it('carries parked-note fields through', () => {
    const parsed = parseBackup(
      file({
        distractions: [
          {
            id: 'dst_1',
            categoryId: 'd-thoughts',
            at: 1_700_000_000_000,
            note: 'Check the invoice',
            parked: true,
            parkedTaskId: 'task_9',
            parkResolvedAt: 1_700_000_100_000,
          },
        ],
      }),
    );
    const row = parsed.rows.distractions[0];
    expect(row.parked).toBe(true);
    expect(row.parkedTaskId).toBe('task_9');
    expect(row.parkResolvedAt).toBe(1_700_000_100_000);
  });

  it('drops a preset with no usable focus length', () => {
    const parsed = parseBackup(
      file({
        tasks: [validTask],
        timerPresets: [
          { id: 'p1', name: 'Good', focusMs: 50 * MINUTE },
          { id: 'p2', name: 'Zero', focusMs: 0 },
          { id: 'p3', focusMs: 50 * MINUTE },
        ],
      }),
    );
    expect(parsed.rows.timerPresets).toHaveLength(1);
    expect(parsed.rows.timerPresets[0].name).toBe('Good');
    expect(parsed.skipped.timerPresets).toBe(2);
  });

  it('replaces settings values that would break the timer', () => {
    const parsed = parseBackup(
      file({
        tasks: [validTask],
        settings: [{ id: 'settings', focusMs: -1, soundVolume: 4, xp: -10 }],
      }),
    );
    expect(parsed.settings?.focusMs).toBe(25 * MINUTE);
    expect(parsed.settings?.soundVolume).toBe(1);
    expect(parsed.settings?.xp).toBe(0);
  });
});
