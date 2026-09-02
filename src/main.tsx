import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { registerPwa } from "./lib/pwa";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
