import { db } from "@/db/schema";
import type { Session, Task } from "@/types";
import { useHydrationStore } from "@/store/useHydrationStore";
import { usePresetStore } from "@/store/usePresetStore";
import { stopFollowingSystem, useSettingsStore } from "@/store/useSettingsStore";
import { useStatsStore } from "@/store/useStatsStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTimerStore } from "@/store/useTimerStore";
import { createTimerState } from "@/engine/timerEngine";
import { MINUTE } from "@/lib/utils";

/**
 * Yields long enough for any fire-and-forget store work to settle. A handful of
 * macrotask turns covers the longest chain in the app — finalising a session,
 * which writes the row, credits the task, reloads tasks, awards XP and then
 * refreshes stats.
 */
async function drainPendingWork(turns = 12): Promise<void> {
  for (let i = 0; i < turns; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Drops the database and returns every store to the state it holds on a cold
 * boot. Stores are module singletons, so without this a test inherits whatever
 * the last one left behind.
 */
export async function resetApp(): Promise<void> {
  // `complete` is started with `void` from the tick and from `hydrate`, so a
  // test can finish with writes still in flight. Closing the database out from
  // under them turns the next test's output into a wall of DatabaseClosedError
  // that has nothing to do with what it was checking. Let them drain first.
  await drainPendingWork();

  // Settings attach their OS listeners once per page. A test that re-mocks
  // matchMedia needs the next load to attach to its mock, not keep the last one.
  stopFollowingSystem();

  localStorage.clear();
  if (db.isOpen()) db.close();
  await db.delete();
  await db.open();

  useTimerStore.setState({
    timer: createTimerState("focus", 25 * MINUTE),
    taskId: null,
    taskTitle: null,
    sessionId: null,
    moodBefore: null,
    energyBefore: null,
    distractionCount: 0,
    pendingReview: null,
    pendingParked: [],
    tick: 0,
    hydrated: false,
  });
  useTaskStore.setState({ tasks: [], categories: [], distractionCategories: [], loaded: false });
  useStatsStore.setState({ sessions: [], distractions: [], loaded: false });
  usePresetStore.setState({ presets: [], loaded: false });
  useHydrationStore.setState({ date: "", glasses: 0, lastAt: null, loaded: false });
  useSettingsStore.setState({ loaded: false });
}

/** Boots the app's stores against the current database, the way `Boot` does. */
export async function bootStores(): Promise<void> {
  await useSettingsStore.getState().load();
  await Promise.all([
    useTaskStore.getState().load(),
    useStatsStore.getState().refresh(),
    usePresetStore.getState().load(),
  ]);
}

/** A task row with only the fields a test cares about spelled out. */
export function makeTask(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.id,
    status: "todo",
    priority: "medium",
    estimatedSessions: 1,
    completedSessions: 0,
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    tags: [],
    ...over,
  };
}

/** A completed 25-minute focus session, yesterday, with only the interesting fields given. */
export function makeSession(over: Partial<Session> & { id: string }): Session {
  const startedAt = over.startedAt ?? Date.now() - 86_400_000;
  return {
    type: "focus",
    plannedMs: 25 * MINUTE,
    actualMs: 25 * MINUTE,
    startedAt,
    endedAt: startedAt + 25 * MINUTE,
    completed: true,
    distractionCount: 0,
    pausedMs: 0,
    ...over,
  };
}

/**
 * Writes the localStorage record left behind by a tab that closed with a
 * session running — the input `hydrate` reads. `ranOutMsAgo` says how long ago
 * the clock hit zero, which is the whole question the abandon guard answers.
 */
export function persistRunningSession(opts: {
  ranOutMsAgo: number;
  durationMs?: number;
  sessionId?: string;
  taskId?: string | null;
  taskTitle?: string | null;
}): { startedAt: number; durationMs: number } {
  const durationMs = opts.durationMs ?? 25 * MINUTE;
  const startedAt = Date.now() - durationMs - opts.ranOutMsAgo;

  localStorage.setItem(
    "focusos:timer",
    JSON.stringify({
      timer: {
        status: "running",
        type: "focus",
        durationMs,
        startedAt,
        pausedAccumMs: 0,
        pausedAt: null,
        cycleCount: 0,
      },
      taskId: opts.taskId ?? null,
      taskTitle: opts.taskTitle ?? null,
      sessionId: opts.sessionId ?? "ses_under_test",
      moodBefore: null,
      energyBefore: null,
      distractionCount: 0,
    }),
  );

  return { startedAt, durationMs };
}
