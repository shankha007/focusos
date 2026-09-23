/**
 * Stands in for `virtual:pwa-register` while the pre-renderer builds.
 *
 * That module is created by vite-plugin-pwa, which the SSR config deliberately
 * leaves out — it exists to shape what a browser downloads, and running it here
 * would write a second service worker over the wrong directory. Without a stub
 * the SSR build fails to resolve the import, because the module graph reaches
 * `lib/pwa.ts` through the app routes even though no marketing page renders
 * them.
 *
 * Nothing calls this: registration happens in `main.tsx`, which the pre-renderer
 * never loads. It throws rather than no-oping so that a future caller finds out
 * at once instead of silently getting an app that never updates.
 */
export function registerSW(): () => Promise<void> {
  throw new Error(
    'registerSW was called during pre-rendering. Service worker registration belongs in the browser entry (src/main.tsx).',
  );
}
