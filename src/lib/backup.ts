import { db, DEFAULT_SETTINGS } from '@/db/schema';
import { BACKUP_VERSION } from '@/db/repositories';
import type {
  Achievement,
  Category,
  Distraction,
  DistractionCategory,
  Session,
  Settings,
  Task,
  TimerPreset,
} from '@/types';

/**
 * Restoring is the one operation that can destroy a user's entire history, and
 * the input is a file they picked off disk — possibly hand-edited, possibly
 * from a much older build, possibly not ours at all. So nothing here trusts the
 * shape: every row is validated field by field, anything unusable is dropped
 * and counted, and the write only happens once the whole file has parsed.
 */

export type RestoreMode = 'merge' | 'replace';

/**
 * Collections carried in a backup, listed the way a user reads them — the
 * preview renders in this order. Writes go out in one transaction, so nothing
 * here depends on the ordering.
 */
export const BACKUP_TABLES = [
  'tasks',
  'sessions',
  'distractions',
  'categories',
  'distractionCategories',
  'timerPresets',
  'achievements',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface ParsedBackup {
  exportedAt: string | null;
  version: number;
  /** Valid rows, per table. */
  rows: {
    tasks: Task[];
    sessions: Session[];
    distractions: Distraction[];
    categories: Category[];
    distractionCategories: DistractionCategory[];
    achievements: Achievement[];
    timerPresets: TimerPreset[];
  };
  settings: Settings | null;
  /** Rows dropped because they failed validation, per table. */
  skipped: Record<string, number>;
}

/** A backup file that can't be used, carrying a message written for the user rather than for a log. */
export class BackupError extends Error {}

/* ── Field validators ──────────────────────────────────────── */

/** Narrows to a plain object — arrays and null are rejected. */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The value if it is a string, else undefined. */
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** The value if it is a finite number — NaN and Infinity are rejected. */
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** The value if it is a boolean, else undefined. */
function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/** The value if it is one of `allowed`, else undefined — used for union-typed fields. */
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

/** Ratings are 1–5; anything else is dropped rather than clamped into a lie. */
function rating(v: unknown): 1 | 2 | 3 | 4 | 5 | undefined {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? v : undefined;
}

/** The string members of an array, dropping anything else; [] for a non-array. */
function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/* ── Row validators ────────────────────────────────────────── */

const STATUSES = ['todo', 'active', 'done', 'archived'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const SESSION_TYPES = ['focus', 'short-break', 'long-break'] as const;

/** Validates one row into a Task, or null if it has no id or title. Every other field falls back to the default a freshly created task would have. */
function toTask(raw: unknown): Task | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || title === undefined) return null;
  const createdAt = num(raw.createdAt) ?? Date.now();
  return {
    id,
    title,
    notes: str(raw.notes),
    status: oneOf(raw.status, STATUSES) ?? 'todo',
    priority: oneOf(raw.priority, PRIORITIES) ?? 'medium',
    categoryId: str(raw.categoryId),
    estimatedSessions: num(raw.estimatedSessions) ?? 1,
    completedSessions: num(raw.completedSessions) ?? 0,
    order: num(raw.order) ?? 0,
    createdAt,
    updatedAt: num(raw.updatedAt) ?? createdAt,
    completedAt: num(raw.completedAt),
    dueDate: num(raw.dueDate),
    tags: strings(raw.tags),
  };
}

/** Validates one row into a Session, or null without an id and start time. */
function toSession(raw: unknown): Session | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const startedAt = num(raw.startedAt);
  // A session with no start has no place on any chart or in any day bucket.
  if (!id || startedAt === undefined) return null;
  return {
    id,
    taskId: str(raw.taskId),
    taskTitle: str(raw.taskTitle),
    type: oneOf(raw.type, SESSION_TYPES) ?? 'focus',
    plannedMs: Math.max(0, num(raw.plannedMs) ?? 0),
    actualMs: Math.max(0, num(raw.actualMs) ?? 0),
    startedAt,
    endedAt: num(raw.endedAt) ?? startedAt,
    completed: bool(raw.completed) ?? false,
    moodBefore: rating(raw.moodBefore),
    energyBefore: rating(raw.energyBefore),
    productivityAfter: rating(raw.productivityAfter),
    accomplishment: str(raw.accomplishment),
    distractionCount: Math.max(0, num(raw.distractionCount) ?? 0),
    pausedMs: Math.max(0, num(raw.pausedMs) ?? 0),
    categoryId: str(raw.categoryId),
  };
}

/** Validates one row into a Distraction, or null without an id, category and timestamp. */
function toDistraction(raw: unknown): Distraction | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const categoryId = str(raw.categoryId);
  const at = num(raw.at);
  if (!id || !categoryId || at === undefined) return null;
  return {
    id,
    sessionId: str(raw.sessionId),
    categoryId,
    note: str(raw.note),
    at,
    sessionProgress: num(raw.sessionProgress),
    parked: bool(raw.parked),
    parkResolvedAt: num(raw.parkResolvedAt),
    parkedTaskId: str(raw.parkedTaskId),
  };
}

/** Validates one row into a task Category, or null without an id and name. */
function toCategory(raw: unknown): Category | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    color: str(raw.color) ?? '#7886ff',
    icon: str(raw.icon),
    presetId: str(raw.presetId),
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
}

/** Validates one row into a DistractionCategory, or null without an id and label. */
function toDistractionCategory(raw: unknown): DistractionCategory | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const label = str(raw.label);
  if (!id || !label) return null;
  return {
    id,
    label,
    icon: str(raw.icon) ?? 'Circle',
    color: str(raw.color) ?? '#9aa0b4',
    builtIn: bool(raw.builtIn) ?? false,
  };
}

/** Validates one row into an Achievement, or null without an id. */
function toAchievement(raw: unknown): Achievement | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return { id, unlockedAt: num(raw.unlockedAt), progress: num(raw.progress) ?? 0 };
}

/** Validates one row into a TimerPreset, or null without an id, name and positive focus length. */
function toPreset(raw: unknown): TimerPreset | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name);
  const focusMs = num(raw.focusMs);
  if (!id || !name || focusMs === undefined || focusMs <= 0) return null;
  return {
    id,
    name,
    focusMs,
    shortBreakMs: num(raw.shortBreakMs) ?? DEFAULT_SETTINGS.shortBreakMs,
    longBreakMs: num(raw.longBreakMs) ?? DEFAULT_SETTINGS.longBreakMs,
    sessionsUntilLongBreak: num(raw.sessionsUntilLongBreak) ?? 4,
    builtIn: bool(raw.builtIn) ?? false,
    createdAt: num(raw.createdAt) ?? Date.now(),
  };
}

/**
 * Settings are merged over the current defaults rather than validated field by
 * field: an unknown key is harmless, and a missing one has a sane default. Only
 * the values that could break the app if malformed are checked.
 */
function toSettings(raw: unknown): Settings | null {
  if (!isObject(raw)) return null;
  const merged = { ...DEFAULT_SETTINGS, ...raw, id: 'settings' as const };
  /** Keeps a duration only if it is a positive number, else the shipped default. */
  const positive = (v: unknown, fallback: number) => {
    const n = num(v);
    return n !== undefined && n > 0 ? n : fallback;
  };
  return {
    ...merged,
    focusMs: positive(merged.focusMs, DEFAULT_SETTINGS.focusMs),
    shortBreakMs: positive(merged.shortBreakMs, DEFAULT_SETTINGS.shortBreakMs),
    longBreakMs: positive(merged.longBreakMs, DEFAULT_SETTINGS.longBreakMs),
    sessionsUntilLongBreak: positive(
      merged.sessionsUntilLongBreak,
      DEFAULT_SETTINGS.sessionsUntilLongBreak,
    ),
    dailyGoalSessions: positive(merged.dailyGoalSessions, DEFAULT_SETTINGS.dailyGoalSessions),
    soundVolume: Math.min(1, Math.max(0, num(merged.soundVolume) ?? DEFAULT_SETTINGS.soundVolume)),
    xp: Math.max(0, num(merged.xp) ?? 0),
    createdAt: num(merged.createdAt) ?? Date.now(),
  };
}

/* ── Parsing ───────────────────────────────────────────────── */

/** Runs `validate` over a raw table, returning the rows that survived and a count of those dropped. Duplicate ids keep the first occurrence. */
function collect<T extends { id: string }>(
  raw: unknown,
  validate: (row: unknown) => T | null,
): { rows: T[]; skipped: number } {
  if (raw === undefined || raw === null) return { rows: [], skipped: 0 };
  if (!Array.isArray(raw)) return { rows: [], skipped: 0 };

  const rows: T[] = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const item of raw) {
    const parsed = validate(item);
    if (!parsed) {
      skipped++;
      continue;
    }
    // A file with duplicate ids would otherwise silently lose rows in bulkPut;
    // keep the first and count the rest as skipped so the number adds up.
    if (seen.has(parsed.id)) {
      skipped++;
      continue;
    }
    seen.add(parsed.id);
    rows.push(parsed);
  }

  return { rows, skipped };
}

/**
 * Reads a backup file into validated rows. Throws `BackupError` with a message
 * meant for the user when the file isn't a FocusOS backup at all.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't valid JSON.");
  }

  if (!isObject(raw)) {
    throw new BackupError('That file does not look like a FocusOS backup.');
  }

  const version = num(raw.version);
  if (version === undefined) {
    throw new BackupError('That file does not look like a FocusOS backup — no version field.');
  }
  if (version > BACKUP_VERSION) {
    throw new BackupError(
      `That backup was written by a newer version of FocusOS (format ${version}, this build reads up to ${BACKUP_VERSION}). Update first, then restore.`,
    );
  }

  const parsed = {
    tasks: collect(raw.tasks, toTask),
    sessions: collect(raw.sessions, toSession),
    distractions: collect(raw.distractions, toDistraction),
    categories: collect(raw.categories, toCategory),
    distractionCategories: collect(raw.distractionCategories, toDistractionCategory),
    achievements: collect(raw.achievements, toAchievement),
    timerPresets: collect(raw.timerPresets, toPreset),
  };

  // `settings` ships as a one-row table, matching the Dexie layout.
  const settingsRow = Array.isArray(raw.settings) ? raw.settings[0] : raw.settings;
  const settings = toSettings(settingsRow);

  const total = Object.values(parsed).reduce((n, t) => n + t.rows.length, 0);
  if (total === 0 && !settings) {
    throw new BackupError('That backup is empty — there is nothing to restore.');
  }

  return {
    exportedAt: str(raw.exportedAt) ?? null,
    version,
    rows: {
      tasks: parsed.tasks.rows,
      sessions: parsed.sessions.rows,
      distractions: parsed.distractions.rows,
      categories: parsed.categories.rows,
      distractionCategories: parsed.distractionCategories.rows,
      achievements: parsed.achievements.rows,
      timerPresets: parsed.timerPresets.rows,
    },
    settings,
    skipped: Object.fromEntries(
      Object.entries(parsed)
        .filter(([, t]) => t.skipped > 0)
        .map(([key, t]) => [key, t.skipped]),
    ),
  };
}

/* ── Writing ───────────────────────────────────────────────── */

export interface RestoreResult {
  mode: RestoreMode;
  /** Rows written, per table. */
  written: Record<BackupTable, number>;
  total: number;
  settingsRestored: boolean;
}

/**
 * Writes a parsed backup into Dexie inside a single transaction, so a failure
 * part-way through leaves the existing data untouched rather than half-replaced.
 *
 * - `merge` keeps everything already here; rows sharing an id are overwritten by
 *   the backup's copy, and the device's own settings are left alone.
 * - `replace` empties every table first, settings included.
 */
export async function restoreBackup(
  backup: ParsedBackup,
  mode: RestoreMode,
): Promise<RestoreResult> {
  const tables = [
    db.tasks,
    db.sessions,
    db.distractions,
    db.categories,
    db.distractionCategories,
    db.achievements,
    db.timerPresets,
    db.settings,
  ];

  const settingsRestored = mode === 'replace' && backup.settings !== null;

  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.tasks.clear(),
        db.sessions.clear(),
        db.distractions.clear(),
        db.categories.clear(),
        db.distractionCategories.clear(),
        db.achievements.clear(),
        db.timerPresets.clear(),
      ]);
    }

    await Promise.all([
      db.categories.bulkPut(backup.rows.categories),
      db.timerPresets.bulkPut(backup.rows.timerPresets),
      db.distractionCategories.bulkPut(backup.rows.distractionCategories),
      db.tasks.bulkPut(backup.rows.tasks),
      db.sessions.bulkPut(backup.rows.sessions),
      db.distractions.bulkPut(backup.rows.distractions),
      db.achievements.bulkPut(backup.rows.achievements),
    ]);

    if (settingsRestored) {
      await db.settings.put(backup.settings!);
    }
  });

  const written = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, backup.rows[table].length]),
  ) as Record<BackupTable, number>;

  return {
    mode,
    written,
    total: Object.values(written).reduce((a, b) => a + b, 0),
    settingsRestored,
  };
}

/** Human label for a table key, used in the preview and the result toast. */
export function tableLabel(table: string, count: number): string {
  const labels: Record<string, [string, string]> = {
    tasks: ['task', 'tasks'],
    sessions: ['session', 'sessions'],
    distractions: ['distraction', 'distractions'],
    categories: ['category', 'categories'],
    distractionCategories: ['distraction type', 'distraction types'],
    achievements: ['badge', 'badges'],
    timerPresets: ['preset', 'presets'],
  };
  const [one, many] = labels[table] ?? [table, table];
  return count === 1 ? one : many;
}
