import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mounts its children with an entrance, and keeps them mounted for an exit
 * before removing them — what Framer Motion's AnimatePresence did here, for
 * the price of a class name.
 *
 * The children always arrive as props; `show` says whether they should be on
 * screen. While `show` is false and the exit is running, the last children are
 * still rendered, so an exit animates the thing that was there rather than
 * nothing.
 *
 * The animations themselves are CSS classes (`fade-in`, `slide-out-right`, …
 * in index.css) on a wrapper element this renders; `className` styles that
 * wrapper, so it can stand in for the element the animation used to sit on. It
 * carries `data-presence`, for code that needs to find the element that is
 * really on the page (see DeepFocusMode's inert handling).
 *
 * Removal waits for the exit's animations to finish, read from the element
 * itself. Where none are running — reduced motion, or a test environment with
 * no CSS — it happens in the next microtask, which fake timers do not hold up.
 */
export function Presence({
  show,
  enter,
  exit,
  className,
  style,
  children,
}: {
  show: boolean;
  /** Class that animates the entrance; omit to appear without one. */
  enter?: string;
  /** Class that animates the exit; it should hold its end state (fill: forwards). */
  exit?: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(show);
  // Mounting follows `show` straight away, in render, so there is no frame
  // with the children missing.
  if (show && !mounted) setMounted(true);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show || !mounted) return;
    let cancelled = false;
    const remove = () => {
      if (!cancelled) setMounted(false);
    };

    // With nothing running the exit is already over. A cancelled animation (the
    // element coming back mid-exit) rejects; either way the exit is done.
    const running = ref.current?.getAnimations?.() ?? [];
    void Promise.allSettled(running.map((animation) => animation.finished)).then(remove);
    return () => {
      cancelled = true;
    };
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div ref={ref} data-presence="" className={cn(show ? enter : exit, className)} style={style}>
      {children}
    </div>
  );
}
