import { db } from "./schema";
import type {
  Achievement,
  Category,
  Distraction,
  DistractionCategory,
  HydrationLog,
  Priority,
  Session,
  Settings,
  Task,
  TimerPreset,
} from "@/types";
import { dateKey, startOfDay, uid } from "@/lib/utils";

/* ── Tasks ─────────────────────────────────────────────────── */

/** Reads and writes for the task list. */
export const tasksRepo = {
  /** Every task, including finished and archived ones, in display order. */
  async all(): Promise<Task[]> {
    const rows = await db.tasks.toArray();
    return rows.sort((a, b) => a.order - b.order);
  },

  /** Only the tasks still worth showing on the board — todo and in progress. */
  async active(): Promise<Task[]> {
    const rows = await db.tasks
      .where("status")
      .anyOf("todo", "active")
      .toArray();
    return rows.sort((a, b) => a.order - b.order);
  },

  /** Creates a task and puts it at the top of the list. Only a title is required; everything else takes a sensible default. */
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
    const lowest = await db.tasks.orderBy("order").first();
    const task: Task = {
      id: `task_${uid()}`,
      title: input.title.trim(),
      notes: input.notes,
      status: "todo",
      priority: input.priority ?? "medium",
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

  /** Applies a partial edit and stamps `updatedAt`. */
  async update(id: string, patch: Partial<Task>): Promise<void> {
    await db.tasks.update(id, { ...patch, updatedAt: Date.now() });
  },

  /** Flips a task between done and todo, setting or clearing its completion time. */
  async toggleDone(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) return;
    const done = task.status === "done";
    await db.tasks.update(id, {
      status: done ? "todo" : "done",
      completedAt: done ? undefined : Date.now(),
      updatedAt: Date.now(),
    });
  },

  /** Deletes a task permanently. Sessions already logged against it keep their copy of the title. */
  async remove(id: string): Promise<void> {
    await db.tasks.delete(id);
  },

  /** Persists a full reorder in one transaction so the list can't tear. */
  async reorder(orderedIds: string[]): Promise<void> {
    await db.transaction("rw", db.tasks, async () => {
      await Promise.all(
        orderedIds.map((id, index) =>
          db.tasks.update(id, { order: index, updatedAt: Date.now() }),
        ),
      );
    });
  },

  /** Credits one finished focus session to the task, moving a fresh task into 'active' on its first. */
  async incrementSessions(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) return;
    await db.tasks.update(id, {
      completedSessions: task.completedSessions + 1,
      status: task.status === "todo" ? "active" : task.status,
      updatedAt: Date.now(),
    });
  },

  /**
   * Takes back one session's credit, for a session deleted from history — the
   * inverse of `incrementSessions`, down to moving a task with nothing left
   * credited back from 'active' to 'todo'.
   */
  async decrementSessions(id: string): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) return;
    const completedSessions = Math.max(0, task.completedSessions - 1);
    await db.tasks.update(id, {
      completedSessions,
      status: completedSessions === 0 && task.status === "active" ? "todo" : task.status,
      updatedAt: Date.now(),
    });
  },

  /** Archives every finished task at once, returning how many were archived. */
  async archiveDone(): Promise<number> {
    return db.tasks
      .where("status")
      .equals("done")
      .modify({ status: "archived", updatedAt: Date.now() });
  },
};

/* ── Sessions ──────────────────────────────────────────────── */

/** The append-mostly log of focus and break sessions that every statistic is derived from. */
export const sessionsRepo = {
  /** Records a finished session. */
  async add(session: Session): Promise<void> {
    await db.sessions.put(session);
  },

  /** One session by id, or undefined if it was never written. */
  async get(id: string): Promise<Session | undefined> {
    return db.sessions.get(id);
  },

  /** The complete history, oldest first. */
  async all(): Promise<Session[]> {
    return db.sessions.orderBy("startedAt").toArray();
  },

  /** Sessions started at or after `ts`. */
  async since(ts: number): Promise<Session[]> {
    return db.sessions.where("startedAt").aboveOrEqual(ts).toArray();
  },

  /** Sessions started within [from, to], both ends included. */
  async between(from: number, to: number): Promise<Session[]> {
    return db.sessions
      .where("startedAt")
      .between(from, to, true, true)
      .toArray();
  },

  /** Sessions started since local midnight. */
  async today(): Promise<Session[]> {
    return this.since(startOfDay());
  },

  /** The most recent sessions, newest first — what the activity feed shows. */
  async recent(limit = 10): Promise<Session[]> {
    const rows = await db.sessions
      .orderBy("startedAt")
      .reverse()
      .limit(limit)
      .toArray();
    return rows;
  },

  /** Applies a partial edit, used when a rating or note is added after the fact. */
  async update(id: string, patch: Partial<Session>): Promise<void> {
    await db.sessions.update(id, patch);
  },

  /**
   * Deletes a session and every distraction logged against it, in one
   * transaction — a distraction left behind would still count toward the day
   * while pointing at a session that no longer exists.
   */
  async remove(id: string): Promise<void> {
    await db.transaction("rw", db.sessions, db.distractions, async () => {
      await db.sessions.delete(id);
      await db.distractions.where("sessionId").equals(id).delete();
    });
  },
};

/* ── Distractions ──────────────────────────────────────────── */

/** Interruptions logged during focus, plus the customisable list of what counts as one. */
export const distractionsRepo = {
  /** Logs one interruption and returns the stored row, id included. */
  async add(input: Omit<Distraction, "id">): Promise<Distraction> {
    const row: Distraction = { ...input, id: `dst_${uid()}` };
    await db.distractions.put(row);
    return row;
  },

  /** Distractions logged at or after `ts`. */
  async since(ts: number): Promise<Distraction[]> {
    return db.distractions.where("at").aboveOrEqual(ts).toArray();
  },

  /** Every distraction ever logged, oldest first. */
  async all(): Promise<Distraction[]> {
    return db.distractions.orderBy("at").toArray();
  },

  /**
   * Drops every distraction attached to a session, for the case where the
   * session itself is never written — a reset, or a false start too short to
   * log. Left behind, those rows would still be counted in the day's totals and
   * the per-session distraction rate while pointing at a session that does not
   * exist.
   */
  async removeForSession(sessionId: string): Promise<void> {
    await db.distractions.where("sessionId").equals(sessionId).delete();
  },

  /**
   * Parked notes from one session that haven't been reviewed yet. Dexie can't
   * index `undefined`, so the pending filter is applied in memory.
   */
  async pendingParked(sessionId: string): Promise<Distraction[]> {
    const rows = await db.distractions
      .where("sessionId")
      .equals(sessionId)
      .toArray();
    return rows
      .filter((d) => d.parked && d.parkResolvedAt === undefined)
      .sort((a, b) => a.at - b.at);
  },

  /** Answers the park prompt. `taskId` is set only when the note was kept. */
  async resolveParked(
    ids: string[],
    taskIdById: Record<string, string> = {},
  ): Promise<void> {
    if (ids.length === 0) return;
    const at = Date.now();
    await db.transaction("rw", db.distractions, async () => {
      await Promise.all(
        ids.map((id) =>
          db.distractions.update(id, {
            parkResolvedAt: at,
            parkedTaskId: taskIdById[id],
          }),
        ),
      );
    });
  },

  /** The distraction types offered in the logger — built-ins plus anything the user added. */
  async categories(): Promise<DistractionCategory[]> {
    return db.distractionCategories.toArray();
  },

  /** Adds a custom distraction type. */
  async addCategory(
    label: string,
    color: string,
    icon = "Circle",
  ): Promise<DistractionCategory> {
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

  /** Deletes a distraction type. Distractions already filed under it keep the id. */
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
  /** Every badge with a recorded unlock time. */
  async all(): Promise<Achievement[]> {
    return db.achievements.toArray();
  },

  /** Records first-unlock times. Existing rows are never overwritten. */
  async markUnlocked(ids: string[], at: number = Date.now()): Promise<void> {
    if (ids.length === 0) return;
    await db.transaction("rw", db.achievements, async () => {
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

/** The colour-coded categories tasks and sessions are grouped by. */
export const categoriesRepo = {
  /** Every category, built-in and custom. */
  async all(): Promise<Category[]> {
    return db.categories.toArray();
  },

  /** Adds a category. */
  async create(name: string, color: string): Promise<Category> {
    const row: Category = {
      id: `cat_${uid()}`,
      name: name.trim(),
      color,
      createdAt: Date.now(),
    };
    await db.categories.put(row);
    return row;
  },

  /** Renames or recolours a category. */
  async update(id: string, patch: Partial<Category>): Promise<void> {
    await db.categories.update(id, patch);
  },

  /** Deletes a category. Tasks pointing at it keep the dangling id and render uncategorised. */
  async remove(id: string): Promise<void> {
    await db.categories.delete(id);
  },
};

/* ── Timer presets ─────────────────────────────────────────── */

/** Saved timer cadences the user can switch between. */
export const presetsRepo = {
  /** Every preset, ordered for the picker. */
  async all(): Promise<TimerPreset[]> {
    const rows = await db.timerPresets.toArray();
    // Built-ins first, then newest custom presets — the order the list reads in.
    return rows.sort(
      (a, b) =>
        Number(b.builtIn) - Number(a.builtIn) || b.createdAt - a.createdAt,
    );
  },

  /** One preset by id, or undefined if it has since been deleted. */
  async get(id: string): Promise<TimerPreset | undefined> {
    return db.timerPresets.get(id);
  },

  /** Saves a custom preset from the durations the user entered. */
  async create(
    input: Omit<TimerPreset, "id" | "builtIn" | "createdAt">,
  ): Promise<TimerPreset> {
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

  /** Retunes or renames a preset. */
  async update(id: string, patch: Partial<TimerPreset>): Promise<void> {
    await db.timerPresets.update(id, patch);
  },

  /** Also detaches the preset from any category pointing at it. */
  async remove(id: string): Promise<void> {
    await db.transaction("rw", [db.timerPresets, db.categories], async () => {
      await db.timerPresets.delete(id);
      // `presetId` isn't indexed — there are only a handful of categories, so a
      // scan is cheaper than carrying an index for this one cleanup.
      const attached = (await db.categories.toArray()).filter(
        (c) => c.presetId === id,
      );
      await Promise.all(
        attached.map((c) =>
          db.categories.update(c.id, { presetId: undefined }),
        ),
      );
    });
  },
};

/* ── Hydration ─────────────────────────────────────────────── */

/**
 * Water logged during breaks, one row per local date. Rows are created lazily,
 * so a day with no glasses simply has none — the count "resets" at midnight
 * because tomorrow reads a different key.
 */
export const hydrationRepo = {
  /** Today's row, or undefined before the first glass. */
  async today(): Promise<HydrationLog | undefined> {
    return db.hydration.get(dateKey());
  },

  /** Every day ever logged, oldest first. */
  async all(): Promise<HydrationLog[]> {
    const rows = await db.hydration.toArray();
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Adds one glass to today and returns the updated row. The read and the write
   * share a transaction because the button is easy to double-tap, and two
   * overlapping increments would otherwise both read the same count and land as
   * one.
   */
  async logGlass(): Promise<HydrationLog> {
    const date = dateKey();
    return db.transaction("rw", db.hydration, async () => {
      const current = await db.hydration.get(date);
      const row: HydrationLog = {
        date,
        glasses: (current?.glasses ?? 0) + 1,
        lastAt: Date.now(),
      };
      await db.hydration.put(row);
      return row;
    });
  },

  /** Takes one glass back off today — the undo for a mis-tap. */
  async undoGlass(): Promise<HydrationLog | undefined> {
    const date = dateKey();
    return db.transaction("rw", db.hydration, async () => {
      const current = await db.hydration.get(date);
      if (!current || current.glasses <= 0) return current;
      const row: HydrationLog = { ...current, glasses: current.glasses - 1 };
      await db.hydration.put(row);
      return row;
    });
  },
};

/* ── Settings ──────────────────────────────────────────────── */

/** The single settings row — every preference in the app lives on it. */
export const settingsRepo = {
  /** The stored settings, or undefined before `initDb` has seeded them. */
  async get(): Promise<Settings | undefined> {
    return db.settings.get("settings");
  },

  /** Writes just the changed preferences, leaving the rest of the row alone. */
  async patch(patch: Partial<Settings>): Promise<void> {
    await db.settings.update("settings", patch);
  },
};

/* ── Bulk data (export / import / reset) ───────────────────── */

/**
 * Bumped whenever a table is added to the backup. Readers accept anything at
 * or below this — older files simply carry fewer collections.
 */
export const BACKUP_VERSION = 3;

/** Snapshots every table into one plain object — the payload written to a JSON backup and read back by `parseBackup`. */
export async function exportAll() {
  const [
    tasks,
    sessions,
    distractions,
    categories,
    distractionCategories,
    achievements,
    timerPresets,
    hydration,
    settings,
  ] = await Promise.all([
    db.tasks.toArray(),
    db.sessions.toArray(),
    db.distractions.toArray(),
    db.categories.toArray(),
    db.distractionCategories.toArray(),
    db.achievements.toArray(),
    db.timerPresets.toArray(),
    db.hydration.toArray(),
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
    hydration,
    settings,
  };
}

/** Erases the user's history — tasks, sessions, distractions and badges — in one transaction. Settings, categories and presets are deliberately kept, so the app is empty rather than un-set-up. */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.tasks, db.sessions, db.distractions, db.achievements, db.hydration],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.sessions.clear(),
        db.distractions.clear(),
        db.achievements.clear(),
        db.hydration.clear(),
      ]);
    },
  );
}
