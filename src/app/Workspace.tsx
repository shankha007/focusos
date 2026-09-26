import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { Presence } from '@/components/Presence';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from './AppShell';
import { DeepFocusMode } from '@/features/focus/DeepFocusMode';
import { SessionReviewDialog } from '@/features/focus/SessionReviewDialog';
import { ParkedThoughtsDialog } from '@/features/focus/ParkedThoughtsDialog';
import { ResetConfirmDialog } from '@/features/focus/ResetConfirmDialog';
import { RouteAnnouncer } from './RouteAnnouncer';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useStatsStore } from '@/store/useStatsStore';
import { useTimerStore } from '@/store/useTimerStore';
import { adoptHandoffSession } from '@/store/adoptHandoffSession';
import { usePresetStore } from '@/store/usePresetStore';
import { useTimerTick } from '@/hooks/useTimerTick';
import { useAchievementWatcher } from '@/hooks/useAchievementWatcher';
import { useAppUpdate } from '@/hooks/useAppUpdate';

/**
 * Everything behind the marketing page: the database, every store, the timer
 * clocks, the app chrome and the dialogs that can appear over any page.
 *
 * It lives in its own module so that none of it — Dexie, the audio engine,
 * drag-and-drop, the stores — is part of the bundle a visitor downloads to read
 * the landing page. `App` mounts it as a lazy layout route, so the first time
 * anything is fetched is the moment someone actually enters the app.
 */

/** Holds a loading screen until the database is open and every store is populated. Rendering the app against empty stores would flash zeroed stats and, worse, let the timer persist a blank state over a session still in progress. */
function Boot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await useSettingsStore.getState().load();
      // Before the stats are read, so a session finished on the landing page is
      // already in the database when the dashboard counts today.
      await adoptHandoffSession();
      await Promise.all([
        useTaskStore.getState().load(),
        useStatsStore.getState().refresh(),
        usePresetStore.getState().load(),
      ]);
      // Hydrate last so it can read the loaded settings for durations.
      useTimerStore.getState().hydrate();
      if (!cancelled) setReady(true);
    };

    // Opening IndexedDB is not guaranteed: private browsing, a full disk, or a
    // database a previous version left in a state Dexie won't migrate all
    // reject here. The rejection used to go nowhere, which left the app on its
    // loading spinner for good — a blank wall with no way forward and nothing
    // in the console for the user to report.
    boot().catch((error: unknown) => {
      console.error('FocusOS could not open your workspace', error);
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <div className="grid h-full place-items-center bg-bg px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-[15px] font-semibold text-fg">Your workspace didn&rsquo;t open</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            FocusOS stores everything in this browser&rsquo;s database, and it could not be reached.
            Private browsing and a full disk are the usual causes. Reloading often works; if it does
            not, try this site in a normal window.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl border border-border bg-elevated px-3 py-1.5 text-[13px] font-medium text-fg transition-colors hover:border-accent/40"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="grid h-full place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle/25 border-t-accent" />
          <p className="text-[13px] text-subtle">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** The chrome around every app page: the clocks that drive the timer, the shell, and the overlays. */
function Chrome() {
  useTimerTick();
  useAchievementWatcher();
  useAppUpdate();
  const deepFocus = useTimerStore((s) => s.timer.status === 'running' || s.timer.status === 'paused');
  const sessionType = useTimerStore((s) => s.timer.type);
  const [showDeepFocus, setShowDeepFocus] = useState(false);

  // Deep Focus opens automatically when a focus session starts, but the user
  // can close it and keep working — so track it separately from timer status.
  // Breaks never force it open: they auto-start by default, and a full-screen
  // takeover would land on whatever page the user was reading. If they were
  // already in Deep Focus it simply stays open across the transition.
  useEffect(() => {
    if (deepFocus && sessionType === 'focus') setShowDeepFocus(true);
  }, [deepFocus, sessionType]);

  // Reduced motion needs no wiring here: the settings store paints
  // data-motion="reduced" on the document for the in-app switch and the OS
  // preference alike, and index.css applies it to every animation at once.
  return (
    <>
      {/* The landing page used to share this tree, so the overlay and both
          prompts had to check the route before rendering. They are only
          reachable from inside the app now, and the checks are gone with it. */}
      <AppShell onOpenFocus={() => setShowDeepFocus(true)} />

      <Presence show={showDeepFocus} enter="fade-in" exit="fade-out">
        <DeepFocusMode onClose={() => setShowDeepFocus(false)} />
      </Presence>

      <SessionReviewDialog />
      <ParkedThoughtsDialog />
      <ResetConfirmDialog />
      <RouteAnnouncer />

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'rounded-xl border border-border bg-surface text-fg shadow-lift text-[13px]',
        }}
      />
    </>
  );
}

/**
 * Layout route for every page inside the app. Boots the data layer, then renders the chrome around an `Outlet`.
 *
 * The tooltip provider lives here rather than at the root: only app screens
 * show tooltips, and mounting it above the marketing routes put Radix on the
 * landing page's critical path.
 */
export default function Workspace() {
  return (
    <TooltipProvider delayDuration={400}>
      <Boot>
        <Chrome />
      </Boot>
    </TooltipProvider>
  );
}
