import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker and reports when a new build is waiting.
 *
 * The worker used to be built with `registerType: 'autoUpdate'`, which installs
 * with skipWaiting and replaces the old one immediately; this module then
 * reloaded the page so the new chunks actually reached the DOM. It kept people
 * current, but it took the decision out of their hands: deploying while someone
 * was seventy minutes into a ninety-minute session tore down their ambient
 * audio and their floating timer with no warning.
 *
 * The worker now waits, and `useAppUpdate` decides when to let it through — at
 * once if nothing is running, and otherwise not until the session ends.
 *
 * Nothing here may import a store. This module is registered from `main.tsx`,
 * which is on the landing page's path, and a store import would pull Dexie and
 * the whole data layer back into the bundle that finding 12 took them out of.
 * Hence the plain subscription rather than reading the timer directly.
 */

type UpdateListener = () => void;

/** Reloads the page onto the waiting worker. Null until registration has run. */
let reloadOntoNewVersion: ((reloadPage?: boolean) => Promise<void>) | null = null;

let updateWaiting = false;
const listeners = new Set<UpdateListener>();

/** Registers the worker. Call once, as early as possible. */
export function registerPwa(): void {
  reloadOntoNewVersion = registerSW({
    onNeedRefresh() {
      updateWaiting = true;
      listeners.forEach((listener) => listener());
    },
  });
}

/** Whether a new build is installed and waiting to take over. */
export function isUpdateWaiting(): boolean {
  return updateWaiting;
}

/**
 * Subscribes to the moment a new build becomes available, returning the
 * unsubscribe. A listener added after the fact will not be called for an update
 * that has already arrived — check `isUpdateWaiting` for that.
 */
export function onUpdateWaiting(listener: UpdateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hands the page over to the waiting build. This reloads, so it is the last thing that happens. */
export async function applyUpdate(): Promise<void> {
  updateWaiting = false;
  await reloadOntoNewVersion?.(true);
}
