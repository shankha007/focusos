import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/primitives';
import { AppShell } from './AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { DeepFocusMode } from '@/features/focus/DeepFocusMode';

// Charts and the achievement grid are heavy and not on the startup path.
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const AchievementsPage = lazy(() =>
  import('@/features/achievements/AchievementsPage').then((m) => ({ default: m.AchievementsPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
import { SessionReviewDialog } from '@/features/focus/SessionReviewDialog';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useStatsStore } from '@/store/useStatsStore';
import { useTimerStore } from '@/store/useTimerStore';
import { useTimerTick } from '@/hooks/useTimerTick';
import { useAchievementWatcher } from '@/hooks/useAchievementWatcher';

function Boot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await useSettingsStore.getState().load();
      await Promise.all([useTaskStore.getState().load(), useStatsStore.getState().refresh()]);
      // Hydrate last so it can read the loaded settings for durations.
      useTimerStore.getState().hydrate();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

function RouteFallback() {
  return (
    <div className="grid h-[60vh] place-items-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-subtle/25 border-t-accent" />
    </div>
  );
}

function Runtime() {
  useTimerTick();
  useAchievementWatcher();
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

  return (
    <>
      <Routes>
        <Route element={<AppShell onOpenFocus={() => setShowDeepFocus(true)} />}>
          <Route path="/" element={<DashboardPage onOpenFocus={() => setShowDeepFocus(true)} />} />
          <Route path="/tasks" element={<TasksPage onOpenFocus={() => setShowDeepFocus(true)} />} />
          <Route
            path="/analytics"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AnalyticsPage />
              </Suspense>
            }
          />
          <Route
            path="/achievements"
            element={
              <Suspense fallback={<RouteFallback />}>
                <AchievementsPage />
              </Suspense>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<RouteFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      <AnimatePresence>
        {showDeepFocus && <DeepFocusMode onClose={() => setShowDeepFocus(false)} />}
      </AnimatePresence>

      <SessionReviewDialog />
    </>
  );
}

export function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <Boot>
        <HashRouter>
          <Runtime />
        </HashRouter>
      </Boot>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            'rounded-xl border border-border bg-surface text-fg shadow-lift text-[13px]',
        }}
      />
    </TooltipProvider>
  );
}
