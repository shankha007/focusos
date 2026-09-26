import { lazy, type ComponentType } from 'react';

/**
 * The secondary marketing pages, each in a chunk of its own.
 *
 * They used to be eager imports, which put all four pages' copy into the script
 * every visitor to "/" downloads — about 12 KB gzipped of text for pages most of
 * them never open. They cannot be plain `React.lazy` either: they are
 * pre-rendered, and a lazy component always suspends on its first render, so
 * hydrating one would throw away the server markup it was meant to adopt.
 *
 * So each page can be loaded ahead of rendering. `preload` fetches the module;
 * once it has arrived the page renders synchronously, exactly as an eager import
 * would. The pre-renderer and `main.tsx` both preload the route being rendered
 * before handing it to React, so the server HTML and the first client render are
 * the same tree. Only a page that was never preloaded — reached by client-side
 * navigation before the idle preload in `main.tsx` finished — falls back to
 * `React.lazy` and the router's Suspense boundary.
 */
export interface MarketingPage {
  (): React.JSX.Element;
  preload: () => Promise<void>;
}

function marketingPage(load: () => Promise<ComponentType>): MarketingPage {
  let Loaded: ComponentType | null = null;
  let pending: Promise<void> | null = null;
  const preload = () =>
    (pending ??= load().then((component) => {
      Loaded = component;
    }));
  const Deferred = lazy(() => preload().then(() => ({ default: Loaded! })));

  return Object.assign(() => (Loaded ? <Loaded /> : <Deferred />), { preload });
}

export const PrivacyPage = marketingPage(() => import('./PrivacyPage').then((m) => m.PrivacyPage));
export const PomodoroTechniquePage = marketingPage(() =>
  import('./PomodoroTechniquePage').then((m) => m.PomodoroTechniquePage),
);
export const TwentyFiveMinuteTimerPage = marketingPage(() =>
  import('./TwentyFiveMinuteTimerPage').then((m) => m.TwentyFiveMinuteTimerPage),
);
export const StudyTimerPage = marketingPage(() => import('./StudyTimerPage').then((m) => m.StudyTimerPage));

const BY_PATH: Record<string, MarketingPage> = {
  '/privacy': PrivacyPage,
  '/pomodoro-technique': PomodoroTechniquePage,
  '/25-minute-timer': TwentyFiveMinuteTimerPage,
  '/study-timer': StudyTimerPage,
};

/** Loads the page `pathname` renders, if it is one of these; resolves at once for any other route. */
export function preloadMarketingPage(pathname: string): Promise<void> {
  const page = BY_PATH[pathname.replace(/\/+$/, '')];
  return page ? page.preload() : Promise.resolve();
}

/** Loads every page, so following a link between them never waits on the network. */
export function preloadAllMarketingPages(): Promise<void> {
  return Promise.all(Object.values(BY_PATH).map((page) => page.preload())).then(() => undefined);
}
