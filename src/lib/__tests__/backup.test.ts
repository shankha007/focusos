import { describe, expect, it } from 'vitest';
import { BackupError, parseBackup } from '../backup';
import { MINUTE } from '../utils';

/**
 * `parseBackup` is the gate in front of the only operation that can destroy a
 * user's history, and its input is an arbitrary file off disk. These cover the
 * shapes that gate actually has to survive.
 */

/** Serialises a backup file with a valid header, so each test only has to state the part it is actually exercising. */
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

  it('keys hydration rows by date, dropping ones without a usable day', () => {
    const parsed = parseBackup(
      file({
        hydration: [
          { date: '2026-08-01', glasses: 6, lastAt: 1_700_000_000_000 },
          { date: '2026-08-01', glasses: 99, lastAt: 1_700_000_000_000 },
          { date: 'yesterday', glasses: 3 },
          { glasses: 3 },
        ],
      }),
    );
    expect(parsed.rows.hydration).toEqual([
      { date: '2026-08-01', glasses: 6, lastAt: 1_700_000_000_000 },
    ]);
    expect(parsed.skipped.hydration).toBe(3);
  });

  it('rounds a nonsense glass count back into whole glasses', () => {
    const parsed = parseBackup(
      file({ hydration: [{ date: '2026-08-01', glasses: -4.6 }] }),
    );
    expect(parsed.rows.hydration[0]).toEqual({ date: '2026-08-01', glasses: 0, lastAt: 0 });
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

  it('drops settings keys this build does not know', () => {
    // Written as raw JSON: in an object literal `__proto__` sets the prototype
    // rather than a key, but JSON.parse makes it an ordinary own property.
    const parsed = parseBackup(
      '{"version":2,"settings":[{"id":"settings","injected":"<script>","__proto__":{"polluted":true}}]}',
    );
    expect(parsed.settings).not.toHaveProperty('injected');
    expect(Object.keys(parsed.settings ?? {}).sort()).toEqual(
      Object.keys(parseBackup(file({ settings: [{}] })).settings ?? {}).sort(),
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('replaces settings values outside their allowed set', () => {
    const parsed = parseBackup(
      file({
        settings: [
          { theme: 'x" onload="alert(1)', activeSound: '../evil', soundEnabled: 'yes', highContrast: 1 },
        ],
      }),
    );
    expect(parsed.settings?.theme).toBe('system');
    expect(parsed.settings?.activeSound).toBeNull();
    expect(parsed.settings?.soundEnabled).toBe(false);
    expect(parsed.settings?.highContrast).toBe(false);
  });

  it('keeps valid settings values, including a deliberate null', () => {
    const parsed = parseBackup(
      file({
        settings: [{ theme: 'forest', activeSound: 'rain', activePresetId: null, onboarded: true }],
      }),
    );
    expect(parsed.settings?.theme).toBe('forest');
    expect(parsed.settings?.activeSound).toBe('rain');
    expect(parsed.settings?.activePresetId).toBeNull();
    expect(parsed.settings?.onboarded).toBe(true);
  });

  it('refuses oversized text instead of storing it', () => {
    const huge = 'a'.repeat(20_001);
    const parsed = parseBackup(
      file({ tasks: [validTask, { ...validTask, id: 'task_2', title: huge }, { ...validTask, id: 'task_3', notes: huge, tags: [huge, 'ok'] }] }),
    );
    expect(parsed.rows.tasks.map((t) => t.id)).toEqual(['task_1', 'task_3']);
    expect(parsed.skipped.tasks).toBe(1);
    expect(parsed.rows.tasks[1].notes).toBeUndefined();
    expect(parsed.rows.tasks[1].tags).toEqual(['ok']);
  });
});

describe('parseBackup — holding numbers to what the app can render', () => {
  it('replaces settings outside the ranges the Settings page offers', () => {
    // 2^32 glasses made the water card throw "Invalid array length" and blank
    // the app at every break; 1e308 minutes turned the clock into exponents.
    const parsed = parseBackup(
      file({
        settings: [
          {
            dailyGlassGoal: 4_294_967_296,
            dailyGoalSessions: 1e308,
            focusMs: 1e308,
            shortBreakMs: 10,
            longBreakMs: 600 * MINUTE,
            sessionsUntilLongBreak: 0.5,
          },
        ],
      }),
    );
    expect(parsed.settings).toMatchObject({
      dailyGlassGoal: 8,
      dailyGoalSessions: 8,
      focusMs: 25 * MINUTE,
      shortBreakMs: 5 * MINUTE,
      longBreakMs: 15 * MINUTE,
      sessionsUntilLongBreak: 4,
    });
  });

  it('keeps settings at the edges of their ranges', () => {
    const parsed = parseBackup(
      file({ settings: [{ focusMs: 120 * MINUTE, dailyGlassGoal: 16, sessionsUntilLongBreak: 2 }] }),
    );
    expect(parsed.settings).toMatchObject({
      focusMs: 120 * MINUTE,
      dailyGlassGoal: 16,
      sessionsUntilLongBreak: 2,
    });
  });

  it('holds presets to the same limits, since applying one copies them onto settings', () => {
    const parsed = parseBackup(
      file({
        timerPresets: [
          { id: 'p1', name: 'Huge', focusMs: 1e308 },
          { id: 'p2', name: 'Odd cadence', focusMs: 50 * MINUTE, sessionsUntilLongBreak: 1e9, shortBreakMs: -1 },
        ],
      }),
    );
    expect(parsed.rows.timerPresets.map((p) => p.id)).toEqual(['p2']);
    expect(parsed.skipped.timerPresets).toBe(1);
    expect(parsed.rows.timerPresets[0]).toMatchObject({ sessionsUntilLongBreak: 4, shortBreakMs: 5 * MINUTE });
  });
});
