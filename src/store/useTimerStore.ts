import { create } from 'zustand';
import type { Distraction, Rating, Session, SessionType } from '@/types';
import {
  createTimerState,
  durationForType,
  elapsedMs,
  nextSessionType,
  pause as pauseState,
  progress as progressOf,
  remainingMs,
  reset as resetState,
  resetLosesWork,
  resume as resumeState,
  start as startState,
  type TimerState,
} from '@/engine/timerEngine';
import { distractionsRepo, sessionsRepo, tasksRepo } from '@/db/repositories';
import { useSettingsStore } from './useSettingsStore';
import { useTaskStore } from './useTaskStore';
import { useStatsStore } from './useStatsStore';
import { applyPresetForCategory } from './usePresetStore';
import { xpForSession } from '@/engine/achievements';
import { ambient } from '@/lib/audio';
import { MINUTE, uid } from '@/lib/utils';
import { notify } from '@/lib/notifications';
import { toast } from 'sonner';
import { useHydrationStore } from './useHydrationStore';

const PERSIST_KEY = 'focusos:timer';

/**
 * How far past its scheduled end a rehydrated session may be and still count as
 * finished. Wide enough for the ordinary cases — a refresh, a laptop lid closed
 * on the last minute, a tab reopened straight away — and narrow enough that a
 * session found hours later is not credited to someone who had walked off.
 */
const ABANDON_GRACE_MS = 2 * MINUTE;

/**
 * Sessions currently being finalised, keyed by their start timestamp. Guards
 * against `complete()` running twice for the same session — see the note in
 * `complete` for how that happens.
 */
const completing = new Set<number>();

/** Drops a session's distractions, but only while no session owns them. */
async function discardOrphanDistractions(sessionId: string): Promise<void> {
  if (await sessionsRepo.get(sessionId)) return;
  await distractionsRepo.removeForSession(sessionId);
  // This used to be picked up by a full history reload whenever the timer went
  // idle. That reload is gone, so the in-memory copy is updated here directly.
  useStatsStore.getState().removeDistractionsForSession(sessionId);
}

/**
 * Trailing sentence for the break notification, saying how far off today's
 * water goal the user is. Empty once the goal is met — a met goal is not worth
 * a second line of notification text. Refreshing the store here also means the
 * break card opens with an up-to-date count.
 */
async function hydrationNudge(goal: number): Promise<string> {
  await useHydrationStore.getState().load();
  const { glasses } = useHydrationStore.getState();
  if (glasses >= goal) return '';
  return ` Grab a glass of water too — ${glasses} of ${goal} today.`;
}

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
  /**
   * Notes parked during the session that just ended, awaiting a keep-or-drop
   * decision. Shown after the review dialog, never at the same time.
   */
  pendingParked: Distraction[];
  /**
   * True while the user is being asked whether to discard a session that has
   * real work in it. Held here rather than in a screen because reset is
   * reachable from Deep Focus and from the command palette, and only one of
   * them used to ask.
   */
  pendingReset: boolean;
  /** Bumped on every rAF tick so subscribed components re-render. */
  tick: number;
  /** False until `hydrate` has read localStorage. Nothing may persist before then. */
  hydrated: boolean;

  hydrate: () => void;
  setTask: (taskId: string | null, title: string | null) => void;
  setMood: (mood: Rating | null, energy: Rating | null) => void;
  startSession: (type?: SessionType) => Promise<void>;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  reset: () => void;
  /** Asks to reset, raising a confirmation first when that would discard real work. */
  requestReset: () => void;
  /** Goes through with a reset the user was asked about. */
  confirmReset: () => void;
  /** Backs out of one. */
  cancelReset: () => void;
  skip: () => Promise<void>;
  complete: (opts?: { early?: boolean }) => Promise<void>;
  logDistraction: (categoryId: string, note?: string, park?: boolean) => Promise<void>;
  submitReview: (productivity: Rating, accomplishment: string) => Promise<void>;
  dismissReview: () => void;
  clearParked: () => void;
  resumeAfterPrompts: () => void;
  doTick: () => void;
  remaining: () => number;
  progress: () => number;
}

/** Set once the browser has refused to store the session, so the warning is shown once rather than on every tick. */
let storageWarned = false;

/**
 * Mirrors the running session into localStorage, so closing the tab mid-session
 * doesn't lose it.
 *
 * Storage is not guaranteed to accept the write: Safari's private browsing and a
 * full quota both throw. This runs from `start`, `pause`, `resume`, `reset`,
 * `complete`, `setTask`, `setMood` and `logDistraction`, so an unhandled throw
 * did not merely skip the save — it propagated out of the action and the timer
 * stopped working at all. Losing the save is a real cost but a survivable one;
 * losing the timer is not.
 */
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

  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
  } catch (error) {
    // Silence would be worse than the failure: the user is relying on a
    // promise the app can no longer keep, and would only find out by losing a
    // session to a refresh. Say it once, when it first happens.
    if (!storageWarned) {
      storageWarned = true;
      console.warn('FocusOS could not save the running session', error);
      toast.warning('This session cannot be saved', {
        description:
          "Your browser is blocking storage, so a refresh will lose the running timer. Private browsing is the usual cause — the session itself keeps running.",
        duration: 8000,
      });
    }
  }
}

/** Reads the persisted session, or null when there is none — or when the browser will not hand it over. */
function readPersisted(): PersistedTimer | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? (JSON.parse(raw) as PersistedTimer) : null;
  } catch {
    // Unreadable or unparseable is the same answer: there is no session to restore.
    return null;
  }
}

/**
 * Forgets any persisted session. Used by the two paths that wipe state out from
 * under the timer — a restore and a full reset — where a leftover record would
 * rehydrate a session whose history no longer exists.
 */
export function clearPersistedTimer(): void {
  try {
    localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Nothing was stored if storage is unavailable, so there is nothing to clear.
  }
}

/** The running timer and everything attached to the session in flight: the task, the pre-session mood, distractions logged so far, and the prompts queued for when it ends. */
export const useTimerStore = create<TimerStoreState>((set, get) => ({
  timer: createTimerState('focus', 25 * 60_000),
  taskId: null,
  taskTitle: null,
  sessionId: null,
  moodBefore: null,
  energyBefore: null,
  distractionCount: 0,
  pendingReview: null,
  pendingParked: [],
  pendingReset: false,
  tick: 0,
  hydrated: false,

  /**
   * Restores a session that was running when the tab closed. Because elapsed
   * time is derived from `startedAt`, a session survives a refresh with its
   * real remaining time intact rather than resetting to full.
   */
  hydrate: () => {
    const settings = useSettingsStore.getState().settings;
    const saved = readPersisted();

    if (!saved?.timer) {
      set({ timer: createTimerState('focus', settings.focusMs), hydrated: true });
      return;
    }

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

    // If it ran to completion while the tab was closed, close it out now —
    // but only claim the user finished it if we can plausibly say they were
    // there. Nothing is recorded between the tab closing and this running, so
    // past the grace window the honest reading is that the session was left,
    // not seen through. Crediting it regardless made walking away the cheapest
    // way to earn XP, a task's session count and a streak day.
    if (saved.timer.status === 'running' && remainingMs(saved.timer) <= 0) {
      const overrun = elapsedMs(saved.timer) - saved.timer.durationMs;
      void get().complete({ early: overrun > ABANDON_GRACE_MS });
    }
  },

  /** Points the timer at a task. The title is stored alongside the id so history survives the task being deleted. */
  setTask: (taskId, title) => {
    set({ taskId, taskTitle: title });
    persist(get());
  },

  /** Records how the user felt going in, asked before a focus session starts. Null clears the check-in, which is what a skipped prompt reports — the session then carries no mood rather than an invented one. */
  setMood: (mood, energy) => {
    set({ moodBefore: mood, energyBefore: energy });
    persist(get());
  },

  /** Starts a session, defaulting to whichever type is queued up. Applies the task category's preset first, then begins the countdown and any ambience. */
  startSession: async (type) => {
    const current = get().timer;
    const nextType = type ?? current.type;

    // A task whose category carries a preset switches the cadence before the
    // duration is read, so "focus on this" and "use this rhythm" are one action.
    if (nextType === 'focus' && get().taskId) {
      const task = useTaskStore.getState().tasks.find((t) => t.id === get().taskId);
      await applyPresetForCategory(task?.categoryId, useTaskStore.getState().categories);
    }

    // Read after the preset lands — it may have just changed these.
    const settings = useSettingsStore.getState().settings;
    const duration = durationForType(nextType, settings);

    const timer = startState({ ...current, type: nextType, durationMs: duration });
    set({ timer, sessionId: `ses_${uid()}`, distractionCount: 0 });
    persist(get());

    if (settings.soundEnabled && settings.activeSound && nextType === 'focus') {
      void ambient.play(settings.activeSound, settings.soundVolume);
    }
  },

  /** Pauses the countdown. Paused time is excluded from the session's recorded focus. */
  pause: () => {
    set({ timer: pauseState(get().timer) });
    persist(get());
  },

  /** Un-pauses the countdown. */
  resume: () => {
    set({ timer: resumeState(get().timer) });
    persist(get());
  },

  /** What the primary button and the spacebar do: start, pause, or resume depending on where the timer is. */
  toggle: () => {
    const { timer, startSession, pause, resume } = get();
    if (timer.status === 'idle' || timer.status === 'completed') void startSession();
    else if (timer.status === 'running') pause();
    else resume();
  },

  /** Abandons the current interval without logging it, returning the clock to a full session. */
  reset: () => {
    const settings = useSettingsStore.getState().settings;
    const { timer, sessionId } = get();
    set({
      timer: resetState(timer, durationForType(timer.type, settings)),
      sessionId: null,
      distractionCount: 0,
      // The check-in belonged to the session being thrown away. Left in place it
      // would be attached to whatever starts next — including a start that never
      // asked, which is how a mood the user reported an hour ago ends up
      // recorded against a session they said nothing about.
      moodBefore: null,
      energyBefore: null,
      pendingReset: false,
    });
    // The session is never written, so anything logged against it would be
    // stranded — counted in the day's totals with no session to explain it.
    // Unless history already holds it: a restore clears the running timer this
    // way, and by then the backup may have supplied both the session and the
    // distractions that belong to it.
    if (sessionId) void discardOrphanDistractions(sessionId);
    ambient.stop();
    persist(get());
  },

  /**
   * The reset every screen should call. Resetting throws the interval away
   * without writing it to history, so past a minute of real work it asks first.
   *
   * Deep Focus used to own this guard privately, which left the command
   * palette's "Reset timer" discarding forty minutes of focus on a single
   * keystroke — the same action, guarded on one screen and not the other.
   */
  requestReset: () => {
    if (resetLosesWork(get().timer, MINUTE)) set({ pendingReset: true });
    else get().reset();
  },

  /** Goes through with a reset the user was asked about. */
  confirmReset: () => {
    set({ pendingReset: false });
    get().reset();
  },

  /** Backs out of one. */
  cancelReset: () => {
    set({ pendingReset: false });
  },

  /** Ends the current interval without recording it as completed. */
  skip: async () => {
    await get().complete({ early: true });
  },

  /**
   * Ends the current interval and writes it to history. Awards XP, credits the task, queues the review and parked-thought prompts, and lines up the next session — auto-starting it when nothing needs the user's attention first.
   *
   * `early` marks the session as abandoned rather than finished; anything under a minute is treated as a false start and not logged at all.
   */
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

    // A session cannot end after its own clock ran out. Normally `now` is within
    // a tick of that, but a session closed out on rehydration is finalised
    // whenever the tab reopened — which is how a 25-minute session logged an end
    // time three days after it started, visible in every CSV export.
    const overrun = Math.max(0, actual - timer.durationMs);

    // Categories drive per-category reporting and the historical half of
    // `estimateTaskSessions`, which matches sessions on this field. It has to be
    // stamped here, at the one moment the task is known: history is immutable
    // afterwards, so a session written without it can never be attributed.
    const categoryId = isFocus && state.taskId
      ? useTaskStore.getState().tasks.find((t) => t.id === state.taskId)?.categoryId
      : undefined;

    const session: Session = {
      id: state.sessionId ?? `ses_${uid()}`,
      taskId: isFocus ? (state.taskId ?? undefined) : undefined,
      taskTitle: isFocus ? (state.taskTitle ?? undefined) : undefined,
      categoryId,
      type: timer.type,
      plannedMs: timer.durationMs,
      actualMs: Math.min(actual, timer.durationMs),
      startedAt: timer.startedAt,
      endedAt: now - overrun,
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
    } else if (state.sessionId) {
      // A false start is not written to history, so anything logged against it
      // has nothing left to point at. Drop it rather than let it skew the day.
      await distractionsRepo.removeForSession(state.sessionId);
    }

    // Only a session that actually ran to the end banks a cycle slot. The
    // upcoming break is read from the count *after* that, so skipping a focus
    // session cannot buy the long break the cycle hasn't earned yet.
    const cycleCount = timer.type === 'focus' && completed ? timer.cycleCount + 1 : timer.cycleCount;
    const upcoming = nextSessionType(timer.type, cycleCount, settings.sessionsUntilLongBreak);
    const upcomingDuration = durationForType(upcoming, settings);

    if (timer.type === 'focus') ambient.stop();
    if (settings.chimeEnabled && completed) void ambient.chime('complete', settings.soundVolume);

    if (completed && settings.notificationsEnabled) {
      // The break notification is the one moment the user is guaranteed to be
      // looking away from the work, so the water nudge rides along with it
      // rather than firing as a second alert.
      const water =
        timer.type === 'focus' && settings.hydrationEnabled
          ? await hydrationNudge(settings.dailyGlassGoal)
          : '';
      notify(
        timer.type === 'focus' ? 'Focus session complete' : 'Break over',
        timer.type === 'focus'
          ? `Nice work${state.taskTitle ? ` on ${state.taskTitle}` : ''}. Time for a ${upcoming === 'long-break' ? 'long' : 'short'} break.${water}`
          : 'Ready to get back into it?',
      );
    }

    const needsReview =
      timer.type === 'focus' && completed && settings.askProductivityAfter && meaningful;

    // Notes the user set aside mid-session. Collected here rather than in the
    // review dialog so they surface even when the review is turned off — the
    // whole point of parking is that the thought comes back.
    const parked =
      timer.type === 'focus' && state.sessionId
        ? await distractionsRepo.pendingParked(state.sessionId)
        : [];

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
      pendingParked: parked,
    });
    persist(get());
    // Apply the one change this made to the in-memory history, rather than
    // re-reading every session and distraction ever logged to find it.
    if (meaningful || completed) useStatsStore.getState().upsertSession(session);
    else if (state.sessionId) useStatsStore.getState().removeDistractionsForSession(state.sessionId);
    completing.delete(timer.startedAt);

    const shouldAutoStart =
      (upcoming !== 'focus' && settings.autoStartBreaks) ||
      (upcoming === 'focus' && settings.autoStartFocus);

    if (shouldAutoStart && !needsReview && parked.length === 0) {
      void get().startSession(upcoming);
    }
  },

  /**
   * Records an interruption against the running session, along with how far
   * into it the user was. `park` sets the note aside to be revisited when the
   * session ends.
   *
   * A distraction only means anything relative to the session it interrupted:
   * an unattached one still counts toward the day's totals and the
   * "distractions per session" rate, but can never be explained by a session.
   * With no session in flight there is nothing to interrupt, so refuse.
   */
  logDistraction: async (categoryId, note, park = false) => {
    const state = get();
    if (!state.sessionId) return;
    const row = await distractionsRepo.add({
      sessionId: state.sessionId,
      categoryId,
      note,
      at: Date.now(),
      sessionProgress: progressOf(state.timer),
      // Parking is only meaningful with a note — there is nothing to keep
      // otherwise, and an empty task would just be noise at session end.
      parked: park && Boolean(note) ? true : undefined,
    });
    useStatsStore.getState().addDistraction(row);
    set({ distractionCount: state.distractionCount + 1 });
    persist(get());
  },

  /** Saves the post-session rating and note, then lets any deferred auto-start proceed. */
  submitReview: async (productivity, accomplishment) => {
    const review = get().pendingReview;
    if (!review) return;
    const patch = {
      productivityAfter: productivity,
      accomplishment: accomplishment.trim() || undefined,
    };
    await sessionsRepo.update(review.id, patch);
    useStatsStore.getState().upsertSession({ ...review, ...patch });
    set({ pendingReview: null });
    get().resumeAfterPrompts();
  },

  /** Closes the review without rating the session. */
  dismissReview: () => {
    set({ pendingReview: null });
    get().resumeAfterPrompts();
  },

  /** Closes the parked-thoughts prompt once every note has been kept or dropped. */
  clearParked: () => {
    set({ pendingParked: [] });
    get().resumeAfterPrompts();
  },

  /**
   * Auto-start is deferred while the review or park prompt is up, so a break
   * doesn't tick away underneath a dialog. Once both are cleared, roll on.
   */
  resumeAfterPrompts: () => {
    const state = get();
    if (state.pendingReview || state.pendingParked.length > 0) return;
    if (state.timer.status !== 'idle') return;

    const settings = useSettingsStore.getState().settings;
    const upcoming = state.timer.type;
    const shouldAutoStart =
      (upcoming !== 'focus' && settings.autoStartBreaks) ||
      (upcoming === 'focus' && settings.autoStartFocus);

    if (shouldAutoStart) void state.startSession(upcoming);
  },

  /** Called on each animation frame: repaints the readout, or finishes the session if the clock has run out. */
  doTick: () => {
    const state = get();
    if (state.timer.status !== 'running') return;
    if (remainingMs(state.timer) <= 0) {
      void state.complete();
      return;
    }
    set({ tick: state.tick + 1 });
  },

  /** Milliseconds left in the current session. */
  remaining: () => remainingMs(get().timer),
  /** How far through the session we are, 0 to 1. */
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
