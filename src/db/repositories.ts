import { db } from './schema';
import type {
  Achievement,
  Category,
  Distraction,
  DistractionCategory,
  Priority,
  Session,
  Settings,
  Task,
  TimerPreset,
} from '@/types';
import { startOfDay, uid } from '@/lib/utils';

/* ── Tasks ─────────────────────────────────────────────────── */

export const tasksRepo = {
  async all(): Promise<Task[]> {
    const rows = await db.tasks.toArray();
    return rows.sort((a, b) => a.order - b.order);
  },

  async active(): Promise<Task[]> {
    const rows = await db.tasks.where('status').anyOf('todo', 'active').toArray();
    return rows.sort((a, b) => a.order - b.order);
  },

  async create(input: {
    title: string;
    notes?: string;
    priority?: Priority;
    categoryId?: string;
    estimatedSessions?: number;
    tags?: string[];
    dueDate?: number;
  }): Promise<Task> {
    const now = Date.now();
    const lowest = await db.tasks.orderBy('order').first();
    const task: Task = {
      id: `task_${uid()}`,
      title: input.title.trim(),
      notes: input.notes,
      status: 'todo',
      priority: input.priority ?? 'medium',
      categoryId: input.categoryId,
      estimatedSessions: input.estimatedSessions ?? 1,
      completedSessions: 0,
      order: (lowest?.order ?? 0) - 1,
      createdAt: now,
      updatedAt: now,
      dueDate: input.dueDate,
      tags: input.tags ?? [],
    };
    await db.tasks.put(task);
    return task;
  },

  async update(id: string, patch: Partial<Task>): Promise<void> {
    await db.tasks.update(id, { ...patch, updatedAt: Date.now() });
  },

  async toggleDone(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) return;
    const done = task.status === 'done';
    await db.tasks.update(id, {
      status: done ? 'todo' : 'done',
      completedAt: done ? undefined : Date.now(),
      updatedAt: Date.now(),
    });
  },

  async remove(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  /** Persists a full reorder in one transaction so the list can't tear. */
  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction('rw', db.tasks, async () => {
      await Promise.all(
        orderedIds.map((id, index) => db.tasks.update(id, { order: index, updatedAt: Date.now() })),
      );
    });
  },

  async incrementSessions(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) return;
    await db.tasks.update(id, {
      completedSessions: task.completedSessions + 1,
      status: task.status === 'todo' ? 'active' : task.status,
      updatedAt: Date.now(),
    });
  },
};

/* ── Sessions ──────────────────────────────────────────────── */

export const sessionsRepo = {
  async add(session: Session): Promise<void> {
    await db.sessions.put(session);
  },

  async all(): Promise<Session[]> {
    return db.sessions.orderBy('startedAt').toArray();
  },

  async since(ts: number): Promise<Session[]> {
    return db.sessions.where('startedAt').aboveOrEqual(ts).toArray();
  },

  async between(from: number, to: number): Promise<Session[]> {
    return db.sessions.where('startedAt').between(from, to, true, true).toArray();
  },

  async today(): Promise<Session[]> {
    return this.since(startOfDay());
  },

  async recent(limit = 10): Promise<Session[]> {
    const rows = await db.sessions.orderBy('startedAt').reverse().limit(limit).toArray();
    return rows;
  },

  async update(id: string, patch: Partial<Session>): Promise<void> {
    await db.sessions.update(id, patch);
  },
};

/* ── Distractions ──────────────────────────────────────────── */

export const distractionsRepo = {
  async add(input: Omit<Distraction, 'id'>): Promise<Distraction> {
    const row: Distraction = { ...input, id: `dst_${uid()}` };
    await db.distractions.put(row);
    return row;
  },

  async since(ts: number): Promise<Distraction[]> {
    return db.distractions.where('at').aboveOrEqual(ts).toArray();
  },

  async all(): Promise<Distraction[]> {
    return db.distractions.orderBy('at').toArray();
  },

  /**
   * Parked notes from one session that haven't been reviewed yet. Dexie can't
   * index `undefined`, so the pending filter is applied in memory.
   */
  async pendingParked(sessionId: string): Promise<Distraction[]> {
    const rows = await db.distractions.where('sessionId').equals(sessionId).toArray();
    return rows
      .filter((d) => d.parked && d.parkResolvedAt === undefined)
      .sort((a, b) => a.at - b.at);
  },

  /** Answers the park prompt. `taskId` is set only when the note was kept. */
  async resolveParked(ids: string[], taskIdById: Record<string, string> = {}): Promise<void> {
    if (ids.length === 0) return;
    const at = Date.now();
    await db.transaction('rw', db.distractions, async () => {
      await Promise.all(
        ids.map((id) =>
          db.distractions.update(id, { parkResolvedAt: at, parkedTaskId: taskIdById[id] }),
        ),
      );
    });
  },

  async categories(): Promise<DistractionCategory[]> {
    return db.distractionCategories.toArray();
  },

  async addCategory(label: string, color: string, icon = 'Circle'): Promise<DistractionCategory> {
    const row: DistractionCategory = {
      id: `dc_${uid()}`,
      label: label.trim(),
      color,
      icon,
      builtIn: false,
    };
    await db.distractionCategories.put(row);
    return row;
  },

  async removeCategory(id: string): Promise<void> {
    await db.distractionCategories.delete(id);
  },
};

/* ── Achievements ──────────────────────────────────────────── */

/**
 * Unlock state is derived from session history, so this table exists purely to
 * pin down *when* each badge first cleared — the one fact the history can't
 * reconstruct. Without it the JSON backup always shipped an empty list.
 */
export const achievementsRepo = {
  async all(): Promise<Achievement[]> {
    return db.achievements.toArray();
  },

  /** Records first-unlock times. Existing rows are never overwritten. */
  async markUnlocked(ids: string[], at: number = Date.now()): Promise<void> {
    if (ids.length === 0) return;
    await db.transaction('rw', db.achievements, async () => {
      const stored = await db.achievements.bulkGet(ids);
      const known = new Set(stored.filter(Boolean).map((a) => a!.id));
      const rows = ids
        .filter((id) => !known.has(id))
        .map((id) => ({ id, unlockedAt: at, progress: 1 }));
      if (rows.length > 0) await db.achievements.bulkPut(rows);
    });
  },
};

/* ── Categories ────────────────────────────────────────────── */

export const categoriesRepo = {
  async all(): Promise<Category[]> {
    return db.categories.toArray();
  },

  async create(name: string, color: string): Promise<Category> {
    const row: Category = { id: `cat_${uid()}`, name: name.trim(), color, createdAt: Date.now() };
    await db.categories.put(row);
    return row;
  },

  async update(id: string, patch: Partial<Category>): Promise<void> {
    await db.categories.update(id, patch);
  },

  async remove(id: string): Promise<void> {
    await db.categories.delete(id);
  },
};

/* ── Timer presets ─────────────────────────────────────────── */

export const presetsRepo = {
  async all(): Promise<TimerPreset[]> {
    const rows = await db.timerPresets.toArray();
    // Built-ins first, then newest custom presets — the order the list reads in.
    return rows.sort((a, b) => Number(b.builtIn) - Number(a.builtIn) || b.createdAt - a.createdAt);
  },

  async get(id: string): Promise<TimerPreset | undefined> {
    return db.timerPresets.get(id);
  },

  async create(input: Omit<TimerPreset, 'id' | 'builtIn' | 'createdAt'>): Promise<TimerPreset> {
    const row: TimerPreset = {
      ...input,
      name: input.name.trim(),
      id: `preset_${uid()}`,
      builtIn: false,
      createdAt: Date.now(),
    };
    await db.timerPresets.put(row);
    return row;
  },

  async update(id: string, patch: Partial<TimerPreset>): Promise<void> {
    await db.timerPresets.update(id, patch);
  },

  /** Also detaches the preset from any category pointing at it. */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.timerPresets, db.categories], async () => {
      await db.timerPresets.delete(id);
      // `presetId` isn't indexed — there are only a handful of categories, so a
      // scan is cheaper than carrying an index for this one cleanup.
      const attached = (await db.categories.toArray()).filter((c) => c.presetId === id);
      await Promise.all(
        attached.map((c) => db.categories.update(c.id, { presetId: undefined })),
      );
    });
  },
};

/* ── Settings ──────────────────────────────────────────────── */

export const settingsRepo = {
  async get(): Promise<Settings | undefined> {
    return db.settings.get('settings');
  },

  async patch(patch: Partial<Settings>): Promise<void> {
    await db.settings.update('settings', patch);
  },
};

/* ── Bulk data (export / import / reset) ───────────────────── */

/**
 * Bumped whenever a table is added to the backup. Readers accept anything at
 * or below this — older files simply carry fewer collections.
 */
export const BACKUP_VERSION = 2;

export async function exportAll() {
  const [
    tasks,
    sessions,
    distractions,
    categories,
    distractionCategories,
    achievements,
    timerPresets,
    settings,
  ] = await Promise.all([
    db.tasks.toArray(),
    db.sessions.toArray(),
    db.distractions.toArray(),
    db.categories.toArray(),
    db.distractionCategories.toArray(),
    db.achievements.toArray(),
    db.timerPresets.toArray(),
    db.settings.toArray(),
  ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    sessions,
    distractions,
    categories,
    distractionCategories,
    achievements,
    timerPresets,
    settings,
  };
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.tasks, db.sessions, db.distractions, db.achievements],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.sessions.clear(),
        db.distractions.clear(),
        db.achievements.clear(),
      ]);
    },
  );
}
