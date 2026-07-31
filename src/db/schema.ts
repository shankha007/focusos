import Dexie, { type Table } from 'dexie';
import type {
  Achievement,
  Category,
  Distraction,
  DistractionCategory,
  Session,
  Settings,
  Task,
} from '@/types';
import { MINUTE, uid } from '@/lib/utils';

export class FocusDB extends Dexie {
  tasks!: Table<Task, string>;
  sessions!: Table<Session, string>;
  distractions!: Table<Distraction, string>;
  categories!: Table<Category, string>;
  distractionCategories!: Table<DistractionCategory, string>;
  achievements!: Table<Achievement, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('focusos');
    this.version(1).stores({
      tasks: 'id, status, priority, categoryId, order, createdAt, completedAt',
      sessions: 'id, startedAt, taskId, type, completed, categoryId',
      distractions: 'id, at, sessionId, categoryId',
      categories: 'id, name, createdAt',
      distractionCategories: 'id, label',
      achievements: 'id, unlockedAt',
      settings: 'id',
    });
  }
}

export const db = new FocusDB();

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  focusMs: 25 * MINUTE,
  shortBreakMs: 5 * MINUTE,
  longBreakMs: 15 * MINUTE,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  dailyGoalSessions: 8,
  theme: 'system',
  reducedMotion: false,
  highContrast: false,
  notificationsEnabled: false,
  soundEnabled: false,
  activeSound: null,
  soundVolume: 0.4,
  tickingEnabled: false,
  chimeEnabled: true,
  askMoodBefore: true,
  askProductivityAfter: true,
  adaptiveEnabled: true,
  onboarded: false,
  xp: 0,
  createdAt: Date.now(),
};

const BUILT_IN_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  { id: 'cat-deep', name: 'Deep Work', color: '#7886ff' },
  { id: 'cat-writing', name: 'Writing', color: '#40ceb2' },
  { id: 'cat-learning', name: 'Learning', color: '#f5a524' },
  { id: 'cat-admin', name: 'Admin', color: '#9aa0b4' },
];

const BUILT_IN_DISTRACTIONS: DistractionCategory[] = [
  { id: 'd-phone', label: 'Phone', icon: 'Smartphone', color: '#f5a524', builtIn: true },
  { id: 'd-social', label: 'Social media', icon: 'AtSign', color: '#ff6b8a', builtIn: true },
  { id: 'd-people', label: 'Interrupted', icon: 'Users', color: '#7886ff', builtIn: true },
  { id: 'd-thoughts', label: 'Wandering mind', icon: 'CloudDrizzle', color: '#40ceb2', builtIn: true },
  { id: 'd-email', label: 'Email / chat', icon: 'Mail', color: '#c084fc', builtIn: true },
  { id: 'd-fatigue', label: 'Tired', icon: 'BatteryLow', color: '#94a3b8', builtIn: true },
];

/** Idempotent — safe to call on every boot. */
export async function initDb(): Promise<Settings> {
  const existing = await db.settings.get('settings');
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkPut(
      BUILT_IN_CATEGORIES.map((c) => ({ ...c, createdAt: Date.now() })),
    );
  }

  const dCount = await db.distractionCategories.count();
  if (dCount === 0) {
    await db.distractionCategories.bulkPut(BUILT_IN_DISTRACTIONS);
  }

  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export function makeTaskId() {
  return `task_${uid()}`;
}
