import { db } from './schema';
import type {
  Category,
  Distraction,
  DistractionCategory,
  Priority,
  Session,
  Settings,
  Task,
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

  async remove(id: string): Promise<void> {
    await db.categories.delete(id);
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

/* ── Bulk data (export / reset) ────────────────────────────── */

export async function exportAll() {
  const [tasks, sessions, distractions, categories, distractionCategories, achievements, settings] =
    await Promise.all([
      db.tasks.toArray(),
      db.sessions.toArray(),
      db.distractions.toArray(),
      db.categories.toArray(),
      db.distractionCategories.toArray(),
      db.achievements.toArray(),
      db.settings.toArray(),
    ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    sessions,
    distractions,
    categories,
    distractionCategories,
    achievements,
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
