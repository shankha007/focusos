import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppRoutes } from './app/App';
import { preloadMarketingPage } from './features/landing/pages';

/**
 * Build-time entry point. Never shipped to a browser.
 *
 * `scripts/prerender.mjs` bundles this for Node, calls `render` once per
 * marketing route, and writes the markup into the built index.html. The result
 * is a page whose content is in the HTML a crawler downloads, rather than
 * something it has to execute React to see.
 *
 * It renders the same `AppRoutes` the browser mounts, under a StaticRouter
 * instead of a BrowserRouter — vite-react-ssg would have done this for us, but
 * it supports only react-router v6 and this app is on v7, whose maintainers
 * point v7 users at their own pre-rendering rather than that library.
 *
 * Nothing here may touch `window`, `document`, IndexedDB or the stores: Node
 * has none of them. Only the marketing routes are rendered, and they are
 * deliberately built from React state alone, so this stays true.
 */
export async function render(url: string): Promise<string> {
  // renderToString does not wait for anything: a page still loading would be
  // written out as an empty Suspense fallback.
  await preloadMarketingPage(url);
  return renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  );
}
