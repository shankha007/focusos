import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/primitives';
import { LandingPage } from '@/features/landing/LandingPage';
import { PrivacyPage } from '@/features/landing/PrivacyPage';
import { PomodoroTechniquePage } from '@/features/landing/PomodoroTechniquePage';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Only the marketing page is part of the initial bundle.
 *
 * `/` is the front door: it is what gets indexed, linked and shared, and its
 * visitor has not decided to use the app yet. Everything behind it — the shell,
 * the pages, Dexie, the stores, the audio engine, drag-and-drop — is fetched
 * when someone actually goes in. `Workspace` is the layout route they all sit
 * under, so one lazy boundary covers the whole application.
 */
const Workspace = lazy(() => import('./Workspace'));

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const TasksPage = lazy(() =>
  import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage })),
);
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const AchievementsPage = lazy(() =>
  import('@/features/achievements/AchievementsPage').then((m) => ({ default: m.AchievementsPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

/** Full-page spinner, shown only while the application chunk itself is on the way. */
function WorkspaceFallback() {
  return (
    <div className="grid h-full place-items-center bg-bg">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle/25 border-t-accent" />
    </div>
  );
}

/** Catches render errors anywhere under the router, and tries again on the next navigation. */
function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

/**
 * Everything below the router: providers, the error boundary, and the split
 * between the front door and the app.
 *
 * Separate from `App` because the pre-renderer mounts the same tree under a
 * StaticRouter to write the marketing pages as real HTML at build time. Two
 * copies of this tree would be two chances for the built page and the running
 * one to disagree.
 */
export function AppRoutes() {
  return (
    <TooltipProvider delayDuration={400}>
      <RoutedErrorBoundary>
        <Suspense fallback={<WorkspaceFallback />}>
          <Routes>
            {/* No sidebar, no timer chrome, and no database. The installed PWA
                starts at /dashboard instead (see start_url in vite.config.ts). */}
            <Route path="/" element={<LandingPage />} />
            {/* Marketing pages, pre-rendered at build time by
                scripts/prerender.mjs — they are eager imports because their
                markup ships in the HTML and a lazy chunk would have nothing to
                hydrate against. */}
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/pomodoro-technique" element={<PomodoroTechniquePage />} />

            <Route element={<Workspace />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* An unrecognised path belongs in the app, not back out on the
                  marketing page — someone reaching it already has a session. */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </RoutedErrorBoundary>
    </TooltipProvider>
  );
}

/** Application root in the browser. */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
