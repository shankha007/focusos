import { create } from 'zustand';
import type { Category, DistractionCategory, Priority, Task } from '@/types';
import { categoriesRepo, distractionsRepo, tasksRepo } from '@/db/repositories';

interface TaskStoreState {
  tasks: Task[];
  categories: Category[];
  distractionCategories: DistractionCategory[];
  loaded: boolean;

  load: () => Promise<void>;
  create: (input: {
    title: string;
    notes?: string;
    priority?: Priority;
    categoryId?: string;
    estimatedSessions?: number;
    tags?: string[];
    dueDate?: number;
  }) => Promise<Task>;
  update: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  /** Credits (+1) or takes back (-1) one finished focus session on a task. */
  adjustSessions: (id: string, delta: 1 | -1) => Promise<void>;
  /** Archives every finished task, reloading once rather than once per task. */
  archiveAllDone: () => Promise<void>;
  addCategory: (name: string, color: string) => Promise<void>;
  setCategoryPreset: (id: string, presetId: string | undefined) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addDistractionCategory: (label: string, color: string) => Promise<void>;
  removeDistractionCategory: (id: string) => Promise<void>;
}

/** Tasks and the two kinds of category, mirrored from IndexedDB. Every mutation writes through to the database and then re-reads, so the store and the disk can't disagree. */
export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  categories: [],
  distractionCategories: [],
  loaded: false,

  /** Fills the store from the database. Run once at startup. */
  load: async () => {
    const [tasks, categories, distractionCategories] = await Promise.all([
      tasksRepo.all(),
      categoriesRepo.all(),
      distractionsRepo.categories(),
    ]);
    set({ tasks, categories, distractionCategories, loaded: true });
  },

  /** Adds a task and returns it, so the caller can immediately select or open it. */
  create: async (input) => {
    const task = await tasksRepo.create(input);
    set({ tasks: await tasksRepo.all() });
    return task;
  },

  /** Applies a partial edit to one task. */
  update: async (id, patch) => {
    await tasksRepo.update(id, patch);
    set({ tasks: await tasksRepo.all() });
  },

  /** Ticks a task off, or un-ticks it. */
  toggleDone: async (id) => {
    await tasksRepo.toggleDone(id);
    set({ tasks: await tasksRepo.all() });
  },

  /** Deletes a task. */
  remove: async (id) => {
    await tasksRepo.remove(id);
    set({ tasks: await tasksRepo.all() });
  },

  archiveAllDone: async () => {
    await tasksRepo.archiveDone();
    set({ tasks: await tasksRepo.all() });
  },

  /** Commits a drag-and-drop reorder. `orderedIds` lists the moved tasks in their new order; anything not mentioned keeps its place. */
  reorder: async (orderedIds) => {
    // Reorder optimistically — waiting on IndexedDB makes dragging feel laggy.
    const byId = new Map(get().tasks.map((t) => [t.id, t]));
    const reordered = orderedIds
      .map((id, index) => {
        const task = byId.get(id);
        return task ? { ...task, order: index } : null;
      })
      .filter((t): t is Task => t !== null);
    // Anything the caller left out keeps the order it already had, so it has to
    // be merged back by that number rather than pushed to the end.
    const moved = new Set(orderedIds);
    const untouched = get().tasks.filter((t) => !moved.has(t.id));
    set({ tasks: [...reordered, ...untouched].sort((a, b) => a.order - b.order) });
    await tasksRepo.reorder(orderedIds);
  },

  /**
   * Swaps in the one task the repository just wrote, rather than re-reading
   * every task and both category tables — this runs at the end of every focus
   * session, and only one row has changed.
   */
  adjustSessions: async (id, delta) => {
    const task =
      delta > 0 ? await tasksRepo.incrementSessions(id) : await tasksRepo.decrementSessions(id);
    if (!task) return;
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  /** Creates a task category. */
  addCategory: async (name, color) => {
    await categoriesRepo.create(name, color);
    set({ categories: await categoriesRepo.all() });
  },

  /** Attaches a timer preset to a category, so starting work in it switches cadence. Pass undefined to detach. */
  setCategoryPreset: async (id, presetId) => {
    await categoriesRepo.update(id, { presetId });
    set({ categories: await categoriesRepo.all() });
  },

  /** Deletes a task category. */
  removeCategory: async (id) => {
    await categoriesRepo.remove(id);
    set({ categories: await categoriesRepo.all() });
  },

  /** Adds a custom distraction type to the logger. */
  addDistractionCategory: async (label, color) => {
    await distractionsRepo.addCategory(label, color);
    set({ distractionCategories: await distractionsRepo.categories() });
  },

  /** Removes a distraction type from the logger. */
  removeDistractionCategory: async (id) => {
    await distractionsRepo.removeCategory(id);
    set({ distractionCategories: await distractionsRepo.categories() });
  },
}));
