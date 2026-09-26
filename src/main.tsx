import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { registerPwa } from "./lib/pwa";
import { preloadAllMarketingPages, preloadMarketingPage } from "./features/landing/pages";
import "./index.css";

/**
 * The app used to run on HashRouter, so links, bookmarks and already-installed
 * PWAs still point at `/#/dashboard`. Rewrite those to a real path before React
 * mounts — the router never sees the fragment, and the visitor never sees a
 * flash of the wrong route.
 *
 * Runs before `createRoot` deliberately: doing it inside a component would mean
 * rendering the landing page first and then replacing it.
 */
function migrateHashRoute() {
  const { hash, pathname, search } = window.location;
  if (!hash.startsWith("#/")) return;

  // Only rewrite when the hash is carrying the whole route, i.e. we are sitting
  // at the root. A real path plus a fragment is a legitimate in-page anchor.
  if (pathname !== "/") return;

  const target = hash.slice(1); // "#/dashboard" -> "/dashboard"
  window.history.replaceState(null, "", target + search);
}

migrateHashRoute();
registerPwa();

const container = document.getElementById("root")!;

const tree = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * The marketing routes are pre-rendered at build time (scripts/prerender.mjs),
 * so their markup is already in the document and React has to adopt it rather
 * than throw it away and paint the same thing again. Everything else — every
 * app route — arrives as an empty container and mounts normally.
 */
if (container.firstElementChild) {
  // A secondary marketing page lives in its own chunk, and hydrating before it
  // arrives would discard the markup. Hydrate once it is here — for "/" and
  // every app route this resolves immediately.
  void preloadMarketingPage(window.location.pathname).then(() => {
    ReactDOM.hydrateRoot(container, tree);
  });
} else {
  ReactDOM.createRoot(container).render(tree);
}

/**
 * The rest of the marketing pages, fetched once the browser is idle, so a
 * footer link between them never waits on the network. Off the critical path,
 * which is the whole point of splitting them out; the service worker caches the
 * chunks after that.
 */
const preloadRest = () => void preloadAllMarketingPages();
// Safari has no requestIdleCallback.
if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preloadRest);
else window.setTimeout(preloadRest, 1500);
