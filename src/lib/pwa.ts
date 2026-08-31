import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker and reloads the page once a new build has taken
 * over.
 *
 * The worker is built with `registerType: 'autoUpdate'`, so it installs with
 * skipWaiting/clientsClaim and replaces the old one immediately. That swaps the
 * precache, but the page already on screen keeps running the chunks it was
 * handed at load time — so users stayed a full visit behind on every deploy.
 * Importing this virtual module is what adds the missing half: it listens for
 * `activated` and reloads, so the new build actually reaches the DOM.
 *
 * The reload is safe mid-session. `useTimerStore` mirrors the running session to
 * localStorage and derives remaining time from `startedAt`, and `App` re-enters
 * deep focus from the timer status, so the user lands back where they were with
 * the clock intact. Ambient audio and picture-in-picture do stop, which is the
 * accepted cost of not serving a stale app.
 */
export function registerPwa(): void {
  registerSW();
}
