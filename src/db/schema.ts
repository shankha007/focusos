import Dexie, { type Table } from "dexie";
import type {
  Achievement,
  Category,
  Distraction,
  DistractionCategory,
  HydrationLog,
  Session,
  Settings,
  Task,
  TimerPreset,
} from "@/types";
import { MINUTE } from "@/lib/utils";

/** The IndexedDB database, declared through Dexie. Everything FocusOS stores lives here on the user's own device — nothing is sent anywhere. */
export class FocusDB extends Dexie {
  tasks!: Table<Task, string>;
  sessions!: Table<Session, string>;
  distractions!: Table<Distraction, string>;
  categories!: Table<Category, string>;
  distractionCategories!: Table<DistractionCategory, string>;
  achievements!: Table<Achievement, string>;
  timerPresets!: Table<TimerPreset, string>;
  hydration!: Table<HydrationLog, string>;
  settings!: Table<Settings, string>;

  /** Declares the table indexes for each schema version. Dexie replays these in order to migrate an existing database. */
  constructor() {
    super("focusos");
    this.version(1).stores({
      tasks: "id, status, priority, categoryId, order, createdAt, completedAt",
      sessions: "id, startedAt, taskId, type, completed, categoryId",
      distractions: "id, at, sessionId, categoryId",
      categories: "id, name, createdAt",
      distractionCategories: "id, label",
      achievements: "id, unlockedAt",
      settings: "id",
    });
    // Dexie merges each version's stores into the previous schema, so only the
    // new table needs declaring here.
    this.version(2).stores({
      timerPresets: "id, name, createdAt",
    });
    // Keyed by local date — one row per day, created lazily on the first glass.
    this.version(3).stores({
      hydration: "date",
    });
    // No schema change — a data migration. `categoryId` was declared on Session
    // and indexed from version 1 but never written, so every session logged
    // before that was fixed is unattributed. Dexie runs this once, on the way up
    // from an older version; a database created fresh at 4 has nothing to fill.
    this.version(4).upgrade((tx) =>
      backfillSessionCategories(
        tx.table<Session, string>("sessions"),
        tx.table<Task, string>("tasks"),
      ),
    );
  }
}

export const db = new FocusDB();

/**
 * Attributes historical focus sessions to a category, by looking up the task
 * each one was logged against.
 *
 * Sessions only started carrying `categoryId` once the timer store began
 * stamping it, which leaves every earlier session unattributed — enough to keep
 * per-category reporting empty and to hold `estimateTaskSessions` on the user's
 * own estimate, since it matches history on this field.
 *
 * Two kinds of session are deliberately left alone rather than guessed at: one
 * whose task has since been deleted, and one whose task never had a category.
 * Neither has an answer to recover, and inventing one is the mistake this whole
 * change exists to undo.
 *
 * A session that already carries a category is never rewritten. The task may
 * have been moved since, and history records what was true when it was logged.
 *
 * Idempotent, and safe to run against tables inside an open transaction —
 * which is how both callers use it. Returns the number of sessions filled in.
 */
export async function backfillSessionCategories(
  sessions: Table<Session, string>,
  tasks: Table<Task, string>,
): Promise<number> {
  const pending = (await sessions.toArray()).filter(
    (s): s is Session & { taskId: string } =>
      s.type === "focus" && Boolean(s.taskId) && s.categoryId === undefined,
  );
  if (pending.length === 0) return 0;

  const owners = await tasks.bulkGet([...new Set(pending.map((s) => s.taskId))]);
  const categoryOf = new Map(
    owners.filter((t): t is Task => Boolean(t?.categoryId)).map((t) => [t.id, t.categoryId!]),
  );

  const filled = pending.flatMap((session) => {
    const categoryId = categoryOf.get(session.taskId);
    return categoryId ? [{ ...session, categoryId }] : [];
  });
  if (filled.length === 0) return 0;

  await sessions.bulkPut(filled);
  return filled.length;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  focusMs: 25 * MINUTE,
  shortBreakMs: 5 * MINUTE,
  longBreakMs: 15 * MINUTE,
  sessionsUntilLongBreak: 4,
  activePresetId: "preset-classic",
  autoStartBreaks: true,
  autoStartFocus: false,
  dailyGoalSessions: 8,
  theme: "system",
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
  hydrationEnabled: true,
  dailyGlassGoal: 8,
  onboarded: false,
  xp: 0,
  createdAt: Date.now(),
};

/**
 * The range each numeric setting may hold — the same range its control on the
 * Settings page offers. Durations are in milliseconds, like the settings
 * themselves.
 *
 * Anything read from outside the app (a backup file, or a row a restore wrote
 * before these were enforced) is held to them. Past them the app does not
 * merely look odd: a glass goal of 2^32 makes the water card build an array
 * the engine refuses, and the page goes blank at every break.
 */
export const SETTING_LIMITS = {
  focusMs: { min: 5 * MINUTE, max: 120 * MINUTE },
  shortBreakMs: { min: 1 * MINUTE, max: 30 * MINUTE },
  longBreakMs: { min: 5 * MINUTE, max: 60 * MINUTE },
  sessionsUntilLongBreak: { min: 2, max: 8 },
  dailyGoalSessions: { min: 1, max: 20 },
  dailyGlassGoal: { min: 1, max: 16 },
} as const;

export type LimitedSetting = keyof typeof SETTING_LIMITS;

/**
 * Most glasses one day can hold. The tracker deliberately keeps counting past
 * the daily goal, so this is not the goal's ceiling (16) but a sanity bound
 * well above any real day. Logging stops here, and a backup row above it is
 * not a day anyone lived — so the app never writes a count a restore of its
 * own export would refuse.
 */
export const MAX_GLASSES_PER_DAY = 50;

/**
 * The value if it is a whole number inside the setting's range, else the
 * fallback. Out-of-range values are replaced rather than clamped: a goal of
 * 4 billion glasses says nothing true about what the user wanted.
 */
export function withinLimit(key: LimitedSetting, value: unknown, fallback: number): number {
  const { min, max } = SETTING_LIMITS[key];
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** Brings every limited setting back inside its range, defaulting any that are not. */
export function enforceSettingLimits(settings: Settings): Settings {
  const next = { ...settings };
  for (const key of Object.keys(SETTING_LIMITS) as LimitedSetting[]) {
    next[key] = withinLimit(key, settings[key], DEFAULT_SETTINGS[key]);
  }
  return next;
}

const BUILT_IN_CATEGORIES: Omit<Category, "createdAt">[] = [
  { id: "cat-deep", name: "Deep Work", color: "#7886ff" },
  { id: "cat-writing", name: "Writing", color: "#40ceb2" },
  { id: "cat-learning", name: "Learning", color: "#f5a524" },
  { id: "cat-admin", name: "Admin", color: "#9aa0b4" },
];

/**
 * The three cadences most people actually alternate between. Seeded rather
 * than hard-coded so they can be renamed or retuned like any other preset.
 */
const BUILT_IN_PRESETS: Omit<TimerPreset, "createdAt">[] = [
  {
    id: "preset-classic",
    name: "Classic",
    focusMs: 25 * MINUTE,
    shortBreakMs: 5 * MINUTE,
    longBreakMs: 15 * MINUTE,
    sessionsUntilLongBreak: 4,
    builtIn: true,
  },
  {
    id: "preset-writing",
    name: "Writing",
    focusMs: 50 * MINUTE,
    shortBreakMs: 10 * MINUTE,
    longBreakMs: 20 * MINUTE,
    sessionsUntilLongBreak: 3,
    builtIn: true,
  },
  {
    id: "preset-deep",
    name: "Deep work",
    focusMs: 90 * MINUTE,
    shortBreakMs: 20 * MINUTE,
    longBreakMs: 30 * MINUTE,
    sessionsUntilLongBreak: 2,
    builtIn: true,
  },
];

const BUILT_IN_DISTRACTIONS: DistractionCategory[] = [
  {
    id: "d-phone",
    label: "Phone",
    icon: "Smartphone",
    color: "#f5a524",
    builtIn: true,
  },
  {
    id: "d-social",
    label: "Social media",
    icon: "AtSign",
    color: "#ff6b8a",
    builtIn: true,
  },
  {
    id: "d-people",
    label: "Interrupted",
    icon: "Users",
    color: "#7886ff",
    builtIn: true,
  },
  {
    id: "d-thoughts",
    label: "Wandering mind",
    icon: "CloudDrizzle",
    color: "#40ceb2",
    builtIn: true,
  },
  {
    id: "d-email",
    label: "Email / chat",
    icon: "Mail",
    color: "#c084fc",
    builtIn: true,
  },
  {
    id: "d-fatigue",
    label: "Tired",
    icon: "BatteryLow",
    color: "#94a3b8",
    builtIn: true,
  },
];

/** Idempotent — safe to call on every boot. */
export async function initDb(): Promise<Settings> {
  const existing = await db.settings.get("settings");
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS);
  } else {
    // A row written by an older build is missing any key added since. Backfill
    // from the defaults so no setting ever reads back as undefined.
    const missing = Object.entries(DEFAULT_SETTINGS).filter(
      ([key]) => !(key in existing),
    );
    if (missing.length > 0) {
      await db.settings.update("settings", Object.fromEntries(missing));
    }

    // A restore from before SETTING_LIMITS existed could store values that
    // crash the app. Repair them here, so the fix reaches data already on disk.
    const bounded = enforceSettingLimits(existing);
    const repaired = (Object.keys(SETTING_LIMITS) as LimitedSetting[]).filter(
      (key) => bounded[key] !== existing[key],
    );
    if (repaired.length > 0) {
      await db.settings.update(
        "settings",
        Object.fromEntries(repaired.map((key) => [key, bounded[key]])),
      );
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
    await db.timerPresets.bulkPut(
      BUILT_IN_PRESETS.map((p) => ({ ...p, createdAt: Date.now() })),
    );
  }

  const dCount = await db.distractionCategories.count();
  if (dCount === 0) {
    await db.distractionCategories.bulkPut(BUILT_IN_DISTRACTIONS);
  }

  return (await db.settings.get("settings")) ?? DEFAULT_SETTINGS;
}
