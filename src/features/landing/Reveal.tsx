import { useEffect, useRef, type HTMLAttributes } from 'react';

/**
 * Fades and rises its content in the first time it scrolls into view.
 *
 * This used to be Framer Motion's `whileInView`, which put 36 KB of gzipped
 * animation runtime on the landing page for one effect. The effect itself is a
 * CSS animation (see `[data-reveal]` in index.css); all this does is flip the
 * attribute when the element arrives. An animation rather than a transition, so
 * it cannot collide with a card's own hover transition.
 *
 * The attribute is set on the DOM node rather than through React state, so
 * revealing a section never re-renders it — and the pre-rendered markup and the
 * first client render stay identical for hydration.
 */
export function Reveal({
  delay = 0,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  /** Seconds to wait after the element is in view, for staggering a row of cards. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => {
      el.dataset.reveal = 'shown';
    };
    if (typeof IntersectionObserver === 'undefined') return reveal();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        reveal();
        observer.disconnect();
      },
      // Held back until it is properly on screen, not the moment its edge appears.
      { rootMargin: '-80px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      style={delay ? { animationDelay: `${delay}s`, ...style } : style}
      {...props}
    />
  );
}
