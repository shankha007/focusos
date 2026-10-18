/**
 * Stands in for `virtual:pwa-register` in the extension build.
 *
 * The browser installs and updates an extension's files itself, so there is no
 * service worker of the website's to register, and `main.tsx` never calls this.
 * `lib/pwa.ts` still imports it, and `useAppUpdate` still asks whether an update
 * is waiting — it never is.
 */
export function registerSW(): () => Promise<void> {
  return () => Promise.resolve();
}
