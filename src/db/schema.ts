import Dexie, { type Table } from 'dexie';
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
import { MINUTE, uid } from '@/lib/utils';

export class FocusDB extends Dexie {
  tasks!: Table<Task, string>;
  sessions!: Table<Session, string>;
  distractions!: Table<Distraction, string>;
  categories!: Table<Category, string>;
  distractionCategories!: Table<DistractionCategory, string>;
  achievements!: Table<Achievement, string>;
  timerPresets!: Table<TimerPreset, string>;
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
    // Dexie merges each version's stores into the previous schema, so only the
    // new table needs declaring here.
    this.version(2).stores({
      timerPresets: 'id, name, createdAt',
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
  activePresetId: 'preset-classic',
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

/**
 * The three cadences most people actually alternate between. Seeded rather
 * than hard-coded so they can be renamed or retuned like any other preset.
 */
const BUILT_IN_PRESETS: Omit<TimerPreset, 'createdAt'>[] = [
  {
    id: 'preset-classic',
    name: 'Classic',
    focusMs: 25 * MINUTE,
    shortBreakMs: 5 * MINUTE,
    longBreakMs: 15 * MINUTE,
    sessionsUntilLongBreak: 4,
    builtIn: true,
  },
  {
    id: 'preset-writing',
    name: 'Writing',
    focusMs: 50 * MINUTE,
    shortBreakMs: 10 * MINUTE,
    longBreakMs: 20 * MINUTE,
    sessionsUntilLongBreak: 3,
    builtIn: true,
  },
  {
    id: 'preset-deep',
    name: 'Deep work',
    focusMs: 90 * MINUTE,
    shortBreakMs: 20 * MINUTE,
    longBreakMs: 30 * MINUTE,
    sessionsUntilLongBreak: 2,
    builtIn: true,
  },
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
  } else {
    // A row written by an older build is missing any key added since. Backfill
    // from the defaults so no setting ever reads back as undefined.
    const missing = Object.entries(DEFAULT_SETTINGS).filter(
      ([key]) => !(key in existing),
    );
    if (missing.length > 0) {
      await db.settings.update('settings', Object.fromEntries(missing));
    }
  }

  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkPut(
      BUILT_IN_CATEGORIES.map((c) => ({ ...c, createdAt: Date.now() })),
    );
  }

  const presetCount = await db.timerPresets.count();
  if (presetCount === 0) {
    await db.timerPresets.bulkPut(BUILT_IN_PRESETS.map((p) => ({ ...p, createdAt: Date.now() })));
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
