/**
 * Whether this bundle is the browser extension rather than the website.
 *
 * Set by `vite.extension.config.ts` building in the `extension` mode. Vite
 * replaces `import.meta.env.MODE` with a literal, so every branch on this is
 * resolved at build time and the website build carries none of the extension
 * code — and the other way round.
 */
export const IS_EXTENSION = import.meta.env.MODE === 'extension';

/**
 * An absolute in-app path as a URL the current build can navigate to.
 *
 * The website serves every route from the server, so `/settings` is a real
 * address. Extension pages are files: there is nothing at
 * `chrome-extension://<id>/settings`, so the extension routes through the
 * fragment of its one app document instead.
 */
export function appHref(path: string): string {
  return IS_EXTENSION ? `app.html#${path}` : path;
}
