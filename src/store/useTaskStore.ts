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
  }) => Promise<Task>;
  update: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reorder: (orderedIds: string[]) => Promise<void>;
  addCategory: (name: string, color: string) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  addDistractionCategory: (label: string, color: string) => Promise<void>;
  removeDistractionCategory: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  categories: [],
  distractionCategories: [],
  loaded: false,

  load: async () => {
    const [tasks, categories, distractionCategories] = await Promise.all([
      tasksRepo.all(),
      categoriesRepo.all(),
      distractionsRepo.categories(),
    ]);
    set({ tasks, categories, distractionCategories, loaded: true });
  },

  create: async (input) => {
    const task = await tasksRepo.create(input);
    set({ tasks: await tasksRepo.all() });
    return task;
  },

  update: async (id, patch) => {
    await tasksRepo.update(id, patch);
    set({ tasks: await tasksRepo.all() });
  },

  toggleDone: async (id) => {
    await tasksRepo.toggleDone(id);
    set({ tasks: await tasksRepo.all() });
  },

  remove: async (id) => {
    await tasksRepo.remove(id);
    set({ tasks: await tasksRepo.all() });
  },

  reorder: async (orderedIds) => {
    // Reorder optimistically — waiting on IndexedDB makes dragging feel laggy.
    const byId = new Map(get().tasks.map((t) => [t.id, t]));
    const reordered = orderedIds
      .map((id, index) => {
        const task = byId.get(id);
        return task ? { ...task, order: index } : null;
      })
      .filter((t): t is Task => t !== null);
    const untouched = get().tasks.filter((t) => !orderedIds.includes(t.id));
    set({ tasks: [...reordered, ...untouched] });
    await tasksRepo.reorder(orderedIds);
  },

  addCategory: async (name, color) => {
    await categoriesRepo.create(name, color);
    set({ categories: await categoriesRepo.all() });
  },

  removeCategory: async (id) => {
    await categoriesRepo.remove(id);
    set({ categories: await categoriesRepo.all() });
  },

  addDistractionCategory: async (label, color) => {
    await distractionsRepo.addCategory(label, color);
    set({ distractionCategories: await distractionsRepo.categories() });
  },

  removeDistractionCategory: async (id) => {
    await distractionsRepo.removeCategory(id);
    set({ distractionCategories: await distractionsRepo.categories() });
  },
}));
