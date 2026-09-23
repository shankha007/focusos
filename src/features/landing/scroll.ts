/**
 * Scrolling for the marketing pages, which scroll inside their own container
 * rather than the window — #root is a fixed-height flex shell.
 *
 * Its own module so that `chrome.tsx` exports components and nothing else: a
 * file that mixes the two loses fast refresh for everything in it.
 */
/** The page's scroll container. Addressed by id so the scroll helpers below can
 *  stay plain functions rather than threading a ref through every section. */
export const SCROLLER_ID = 'landing-scroll';

/** Height of the sticky header, so a section does not land underneath it. */
export const HEADER_OFFSET = 72;

function getScroller(): HTMLElement | null {
  return document.getElementById(SCROLLER_ID);
}

/** Whether the visitor has asked for less movement, by OS setting or the app's
 *  own Accessibility toggle. */
function prefersNoMotion(): boolean {
  return (
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

let animation = 0;

/** Bumped by every scroll, so a scroll that has been superseded can tell. */
let sequence = 0;

/** Stops any tween in flight. Called on unmount so a scroll that was still
 *  running does not keep firing frames against a detached element. */
export function cancelScroll() {
  cancelAnimationFrame(animation);
  animation = 0;
}

/**
 * Scrolls the container with a hand-rolled tween.
 *
 * Native smooth scrolling is not dependable here: `scrollIntoView`,
 * `scrollTo({behavior:'smooth'})` and CSS `scroll-behavior` are all silently
 * ignored on this container by some engines, which turns every in-page nav
 * click into a dead button with nothing logged. Driving the position ourselves
 * always moves, and lets the app's own reduced-motion setting opt out — which
 * the CSS media query alone would not cover.
 */
function scrollTo(top: number) {
  const scroller = getScroller();
  if (!scroller) return;

  const target = Math.max(0, Math.min(top, scroller.scrollHeight - scroller.clientHeight));
  const start = scroller.scrollTop;
  const distance = target - start;

  cancelAnimationFrame(animation);
  if (prefersNoMotion() || Math.abs(distance) < 2) {
    scroller.scrollTop = target;
    return;
  }

  const duration = Math.min(700, 220 + Math.abs(distance) * 0.35);
  const startedAt = performance.now();
  let framed = false;

  const step = (now: number) => {
    framed = true;
    const t = Math.min(1, (now - startedAt) / duration);
    // easeOutCubic — quick departure, soft landing.
    scroller.scrollTop = start + distance * (1 - Math.pow(1 - t, 3));
    if (t < 1) animation = requestAnimationFrame(step);
  };
  animation = requestAnimationFrame(step);

  // requestAnimationFrame is not guaranteed to fire: a background tab, an
  // embedded webview or a hidden preview pane can withhold frames while the
  // document still reports itself visible. The tween would then never start and
  // the link would do nothing at all — which is exactly the dead-button
  // behaviour this tween exists to avoid. If no frame has arrived shortly, jump
  // there instead. `sequence` makes a newer scroll win, so a late fallback
  // cannot drag the page back to an abandoned target.
  const mine = ++sequence;
  setTimeout(() => {
    if (framed || sequence !== mine) return;
    cancelScroll();
    scroller.scrollTop = target;
  }, 250);
}

/**
 * Scrolls to a section by element id. The offset is measured against the scroll
 * container rather than handed to `scrollIntoView`, which is one of the APIs the
 * tween above avoids.
 *
 * This is what `SectionLink` calls instead of letting the browser jump to the
 * fragment. The links themselves are real anchors — a `<button>` is invisible to
 * a crawler, which then sees a page with no internal links at all.
 */
export function scrollToId(id: string) {
  const scroller = getScroller();
  const target = document.getElementById(id);
  if (!scroller || !target) return;

  scrollTo(
    target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      HEADER_OFFSET,
  );
}

export function scrollToTop() {
  scrollTo(0);
}

