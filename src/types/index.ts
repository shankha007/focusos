export type SessionType = "focus" | "short-break" | "long-break";

export type Priority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "todo" | "active" | "done" | "archived";

/** 1 = worst, 5 = best. Used for mood, energy, and productivity alike. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  categoryId?: string;
  /** User's estimate, in pomodoros. */
  estimatedSessions: number;
  completedSessions: number;
  order: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  dueDate?: number;
  tags: string[];
}

export interface Category {
  id: string;
  name: string;
  /** Hex or rgb triple used for the dot / chart series. */
  color: string;
  icon?: string;
  /** Timer preset applied automatically when focusing on a task in this category. */
  presetId?: string;
  createdAt: number;
}

/**
 * A named bundle of the four cadence settings. Switching between "25/5 for
 * admin" and "90/20 for deep work" is a mode change, not a settings edit.
 */
export interface TimerPreset {
  id: string;
  name: string;
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  sessionsUntilLongBreak: number;
  /** Seeded presets can be edited but not deleted. */
  builtIn: boolean;
  createdAt: number;
}

export interface Session {
  id: string;
  taskId?: string;
  taskTitle?: string;
  type: SessionType;
  plannedMs: number;
  /** Time actually spent focusing, excluding paused stretches. */
  actualMs: number;
  startedAt: number;
  endedAt: number;
  completed: boolean;
  moodBefore?: Rating;
  energyBefore?: Rating;
  productivityAfter?: Rating;
  accomplishment?: string;
  distractionCount: number;
  pausedMs: number;
  categoryId?: string;
}

export interface Distraction {
  id: string;
  sessionId?: string;
  categoryId: string;
  note?: string;
  at: number;
  /** Where in the session it happened, 0–1. Reveals "I drift at the 20-min mark" patterns. */
  sessionProgress?: number;
  /** The note was set aside to become a task — reviewed when the session ends. */
  parked?: boolean;
  /** When the park prompt was answered. Unset means it is still pending. */
  parkResolvedAt?: number;
  /** Set when the parked note was kept and turned into this task. */
  parkedTaskId?: string;
}

export interface DistractionCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  builtIn: boolean;
}

export interface Achievement {
  id: string;
  unlockedAt?: number;
  progress: number;
}

export type ThemeName =
  | "light"
  | "dark"
  | "minimal"
  | "midnight"
  | "amoled"
  | "forest"
  | "ocean"
  | "sunset"
  | "lavender";

export type ThemePreference = ThemeName | "system";

export type SoundId =
  | "rain"
  | "forest"
  | "ocean"
  | "cafe"
  | "white"
  | "brown"
  | "fireplace"
  | "wind";

export interface Settings {
  id: "settings";
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  sessionsUntilLongBreak: number;
  /** Preset the four cadence fields above last came from, if any. */
  activePresetId: string | null;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  dailyGoalSessions: number;
  theme: ThemePreference;
  reducedMotion: boolean;
  highContrast: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  activeSound: SoundId | null;
  soundVolume: number;
  tickingEnabled: boolean;
  chimeEnabled: boolean;
  askMoodBefore: boolean;
  askProductivityAfter: boolean;
  adaptiveEnabled: boolean;
  /** Set once the user has seen the first-run tour. */
  onboarded: boolean;
  xp: number;
  createdAt: number;
}

export interface DayStat {
  /** ISO date, YYYY-MM-DD, in the user's local timezone. */
  date: string;
  focusMs: number;
  sessions: number;
  distractions: number;
  avgProductivity: number | null;
  avgMood: number | null;
}
