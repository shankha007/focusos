import { create } from 'zustand';
import type { Rating, Session, SessionType } from '@/types';
import {
  createTimerState,
  durationForType,
  elapsedMs,
  nextSessionType,
  pause as pauseState,
  progress as progressOf,
  remainingMs,
  reset as resetState,
  resume as resumeState,
  start as startState,
  type TimerState,
} from '@/engine/timerEngine';
import { distractionsRepo, sessionsRepo, tasksRepo } from '@/db/repositories';
import { useSettingsStore } from './useSettingsStore';
import { useTaskStore } from './useTaskStore';
import { useStatsStore } from './useStatsStore';
import { xpForSession } from '@/engine/achievements';
import { ambient } from '@/lib/audio';
import { uid } from '@/lib/utils';
import { notify } from '@/lib/notifications';

const PERSIST_KEY = 'focusos:timer';

/**
 * Sessions currently being finalised, keyed by their start timestamp. Guards
 * against `complete()` running twice for the same session — see the note in
 * `complete` for how that happens.
 */
const completing = new Set<number>();

interface PersistedTimer {
  timer: TimerState;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  moodBefore: Rating | null;
  energyBefore: Rating | null;
  distractionCount: number;
}

interface TimerStoreState {
  timer: TimerState;
  taskId: string | null;
  taskTitle: string | null;
  /** Id assigned at start so distractions can be attached mid-session. */
  sessionId: string | null;
  moodBefore: Rating | null;
  energyBefore: Rating | null;
  distractionCount: number;
  /** Session awaiting a post-session rating, if any. */
  pendingReview: Session | null;
  /** Bumped on every rAF tick so subscribed components re-render. */
  tick: number;
  /** False until `hydrate` has read localStorage. Nothing may persist before then. */
  hydrated: boolean;

  hydrate: () => void;
  setTask: (taskId: string | null, title: string | null) => void;
  setMood: (mood: Rating, energy: Rating) => void;
  startSession: (type?: SessionType) => Promise<void>;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => Promise<void>;
  complete: (opts?: { early?: boolean }) => Promise<void>;
  logDistraction: (categoryId: string, note?: string) => Promise<void>;
  submitReview: (productivity: Rating, accomplishment: string) => Promise<void>;
  dismissReview: () => void;
  doTick: () => void;
  remaining: () => number;
  progress: () => number;
}

function persist(state: TimerStoreState) {
  const payload: PersistedTimer = {
    timer: state.timer,
    taskId: state.taskId,
    taskTitle: state.taskTitle,
    sessionId: state.sessionId,
    moodBefore: state.moodBefore,
    energyBefore: state.energyBefore,
    distractionCount: state.distractionCount,
  };
  localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
}

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  timer: createTimerState('focus', 25 * 60_000),
  taskId: null,
  taskTitle: null,
  sessionId: null,
  moodBefore: null,
  energyBefore: null,
  distractionCount: 0,
  pendingReview: null,
  tick: 0,
  hydrated: false,

  /**
   * Restores a session that was running when the tab closed. Because elapsed
   * time is derived from `startedAt`, a session survives a refresh with its
   * real remaining time intact rather than resetting to full.
   */
  hydrate: () => {
    const settings = useSettingsStore.getState().settings;
    const raw = localStorage.getItem(PERSIST_KEY);

    if (!raw) {
      set({ timer: createTimerState('focus', settings.focusMs), hydrated: true });
      return;
    }

    try {
      const saved = JSON.parse(raw) as PersistedTimer;
      set({
        timer: saved.timer,
        taskId: saved.taskId,
        taskTitle: saved.taskTitle,
        sessionId: saved.sessionId,
        moodBefore: saved.moodBefore,
        energyBefore: saved.energyBefore,
        distractionCount: saved.distractionCount ?? 0,
        hydrated: true,
      });
      // If it ran to completion while the tab was closed, close it out now.
      if (saved.timer.status === 'running' && remainingMs(saved.timer) <= 0) {
        void get().complete();
      }
    } catch {
      set({ timer: createTimerState('focus', settings.focusMs), hydrated: true });
    }
  },

  setTask: (taskId, title) => {
    set({ taskId, taskTitle: title });
    persist(get());
  },

  setMood: (mood, energy) => {
    set({ moodBefore: mood, energyBefore: energy });
    persist(get());
  },

  startSession: async (type) => {
    const settings = useSettingsStore.getState().settings;
    const current = get().timer;
    const nextType = type ?? current.type;
    const duration = durationForType(nextType, settings);

    const timer = startState({ ...current, type: nextType, durationMs: duration });
    set({ timer, sessionId: `ses_${uid()}`, distractionCount: 0 });
    persist(get());

    if (settings.soundEnabled && settings.activeSound && nextType === 'focus') {
      void ambient.play(settings.activeSound, settings.soundVolume);
    }
  },

  pause: () => {
    set({ timer: pauseState(get().timer) });
    persist(get());
  },

  resume: () => {
    set({ timer: resumeState(get().timer) });
    persist(get());
  },

  toggle: () => {
    const { timer, startSession, pause, resume } = get();
    if (timer.status === 'idle' || timer.status === 'completed') void startSession();
    else if (timer.status === 'running') pause();
    else resume();
  },

  reset: () => {
    const settings = useSettingsStore.getState().settings;
    const timer = get().timer;
    set({
      timer: resetState(timer, durationForType(timer.type, settings)),
      sessionId: null,
      distractionCount: 0,
    });
    ambient.stop();
    persist(get());
  },

  /** Ends the current interval without recording it as completed. */
  skip: async () => {
    await get().complete({ early: true });
  },

  complete: async ({ early = false } = {}) => {
    const state = get();
    const { timer } = state;
    if (timer.status === 'idle' || timer.startedAt === null) return;

    // Two callers can observe "time is up" before this finishes: the rAF tick
    // and the 1s interval. Everything below awaits, so without a synchronous
    // claim on the session both would run and the session would be counted
    // twice. Clearing sessionId here makes the second caller bail.
    if (completing.has(timer.startedAt)) return;
    completing.add(timer.startedAt);

    const settings = useSettingsStore.getState().settings;
    const now = Date.now();
    const actual = elapsedMs(timer, now);
    // Anything under a minute is a false start, not a session worth logging.
    const meaningful = actual > 60_000;
    const completed = !early;

    // The selected task is kept across a break so the next focus session can
    // resume it, but the break itself is not work on that task — recording it
    // as such double-counts the task's time in every report.
    const isFocus = timer.type === 'focus';

    const session: Session = {
      id: state.sessionId ?? `ses_${uid()}`,
      taskId: isFocus ? (state.taskId ?? undefined) : undefined,
      taskTitle: isFocus ? (state.taskTitle ?? undefined) : undefined,
      type: timer.type,
      plannedMs: timer.durationMs,
      actualMs: Math.min(actual, timer.durationMs),
      startedAt: timer.startedAt,
      endedAt: now,
      completed,
      moodBefore: state.moodBefore ?? undefined,
      energyBefore: state.energyBefore ?? undefined,
      distractionCount: state.distractionCount,
      pausedMs: timer.pausedAccumMs,
    };

    if (meaningful || completed) {
      await sessionsRepo.add(session);
      if (timer.type === 'focus' && completed) {
        if (state.taskId) {
          await tasksRepo.incrementSessions(state.taskId);
          // Session counts are shown all over the UI; reload so they aren't stale.
          await useTaskStore.getState().load();
        }
        await useSettingsStore
          .getState()
          .update({ xp: settings.xp + xpForSession(session) });
      }
    }

    const cycleCount = timer.type === 'focus' && completed ? timer.cycleCount + 1 : timer.cycleCount;
    const upcoming = nextSessionType(timer.type, timer.cycleCount, settings.sessionsUntilLongBreak);
    const upcomingDuration = durationForType(upcoming, settings);

    if (timer.type === 'focus') ambient.stop();
    if (settings.chimeEnabled && completed) void ambient.chime('complete');

    if (completed && settings.notificationsEnabled) {
      notify(
        timer.type === 'focus' ? 'Focus session complete' : 'Break over',
        timer.type === 'focus'
          ? `Nice work${state.taskTitle ? ` on ${state.taskTitle}` : ''}. Time for a ${upcoming === 'long-break' ? 'long' : 'short'} break.`
          : 'Ready to get back into it?',
      );
    }

    const needsReview =
      timer.type === 'focus' && completed && settings.askProductivityAfter && meaningful;

    set({
      timer: {
        ...createTimerState(upcoming, upcomingDuration),
        cycleCount,
      },
      sessionId: null,
      distractionCount: 0,
      moodBefore: null,
      energyBefore: null,
      pendingReview: needsReview ? session : null,
    });
    persist(get());
    await useStatsStore.getState().refresh();
    completing.delete(timer.startedAt);

    const shouldAutoStart =
      (upcoming !== 'focus' && settings.autoStartBreaks) ||
      (upcoming === 'focus' && settings.autoStartFocus);

    if (shouldAutoStart && !needsReview) {
      void get().startSession(upcoming);
    }
  },

  logDistraction: async (categoryId, note) => {
    const state = get();
    await distractionsRepo.add({
      sessionId: state.sessionId ?? undefined,
      categoryId,
      note,
      at: Date.now(),
      sessionProgress: progressOf(state.timer),
    });
    set({ distractionCount: state.distractionCount + 1 });
    persist(get());
  },

  submitReview: async (productivity, accomplishment) => {
    const review = get().pendingReview;
    if (!review) return;
    await sessionsRepo.update(review.id, {
      productivityAfter: productivity,
      accomplishment: accomplishment.trim() || undefined,
    });
    set({ pendingReview: null });

    const settings = useSettingsStore.getState().settings;
    if (settings.autoStartBreaks && get().timer.type !== 'focus') {
      void get().startSession();
    }
  },

  dismissReview: () => set({ pendingReview: null }),

  doTick: () => {
    const state = get();
    if (state.timer.status !== 'running') return;
    if (remainingMs(state.timer) <= 0) {
      void state.complete();
      return;
    }
    set({ tick: state.tick + 1 });
  },

  remaining: () => remainingMs(get().timer),
  progress: () => progressOf(get().timer),
}));

/**
 * Keeps an idle timer in step with the settings. Durations are otherwise only
 * read when a session starts or ends, so changing "Focus" from 25 to 5 minutes
 * left the dashboard advertising a 25-minute session it would never run.
 */
useSettingsStore.subscribe((state, prev) => {
  if (
    state.settings.focusMs === prev.settings.focusMs &&
    state.settings.shortBreakMs === prev.settings.shortBreakMs &&
    state.settings.longBreakMs === prev.settings.longBreakMs
  ) {
    return;
  }

  // Settings load before the timer hydrates. Writing here first would persist
  // the placeholder idle state over a session that was still running.
  const { timer, hydrated } = useTimerStore.getState();
  if (!hydrated) return;

  // Only an idle timer is safe to retune — a running one would jump.
  if (timer.status !== 'idle') return;

  const durationMs = durationForType(timer.type, state.settings);
  if (durationMs === timer.durationMs) return;

  useTimerStore.setState({ timer: { ...timer, durationMs } });
  persist(useTimerStore.getState());
});
