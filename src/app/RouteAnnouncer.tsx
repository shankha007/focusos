import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** How long to wait for a page to render its heading before giving up on moving focus to it. */
const HEADING_WAIT_MS = 3000;

/** How often to look for it in the meantime. */
const HEADING_POLL_MS = 50;

/** What each page is called, as the navigation names it. */
const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks': 'Tasks',
  '/analytics': 'Analytics',
  '/achievements': 'Progress',
  '/settings': 'Settings',
};

/**
 * Tells assistive technology that the page changed.
 *
 * A single-page app swaps content without a document load, so following a nav
 * link used to be silent: focus stayed on the link that had just been pressed
 * and the new page arrived with no announcement at all. This does what a page
 * load would have done — once the new page has rendered its heading, focus
 * moves to it, and the page's name is announced.
 *
 * Mounted beside the app's dialogs rather than inside the shell, on purpose.
 * Deep Focus marks everything behind it inert except elements holding a live
 * region, which is how it spares the toast host. A live region inside the shell
 * would quietly stop the shell being made inert behind the overlay.
 *
 * It waits with a timer, not animation frames: pages load lazily so the heading
 * may take a moment, and animation frames stop entirely while a page is hidden.
 */
export function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  // Compared with the previous path rather than tracked as "first render":
  // StrictMode runs effects twice on mount in development, which would defeat a
  // first-render flag and move focus on an ordinary page load.
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    let cancelled = false;
    let timer = 0;
    const startedAt = Date.now();

    const settle = () => {
      if (cancelled) return;
      const heading = document.querySelector<HTMLElement>('#main h1');
      if (heading) {
        // A heading is not focusable by default. Made focusable from code, so
        // this works for any page without every page having to remember to.
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
        setMessage(PAGE_NAMES[pathname] ?? heading.textContent?.trim() ?? '');
        return;
      }
      if (Date.now() - startedAt < HEADING_WAIT_MS) {
        timer = window.setTimeout(settle, HEADING_POLL_MS);
      } else {
        // No heading turned up; at least say where the user is.
        setMessage(PAGE_NAMES[pathname] ?? '');
      }
    };

    timer = window.setTimeout(settle, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
