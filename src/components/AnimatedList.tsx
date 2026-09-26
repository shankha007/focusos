import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A keyed list whose rows grow in, shrink out, and slide to new positions —
 * what Framer Motion's AnimatePresence plus `layout` did for the task list,
 * with the same timing (0.18s, ease-in-out) and the same rules:
 *
 * - Nothing animates on the first render; rows are simply there.
 * - A new row grows from zero height while fading in.
 * - A removed row stays where it was while it shrinks and fades, then goes.
 * - A row whose position changed slides from where it was. Under reduced
 *   motion that slide is skipped, as Framer skipped layout animation, while
 *   the fades and height changes still run, as they did.
 *
 * Positions are measured relative to the list itself and without transforms,
 * so a toolbar appearing above the list, or a row mid-slide, never reads as
 * movement.
 */
const DURATION_MS = 180;
const EASING = 'ease-in-out';

interface Entry<T> {
  key: string;
  item: T;
  leaving: boolean;
}

export function AnimatedList<T>({
  items,
  getKey,
  children,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  children: (item: T) => ReactNode;
  className?: string;
}) {
  const [entries, setEntries] = useState<Entry<T>[]>(() =>
    items.map((item) => ({ key: getKey(item), item, leaving: false })),
  );
  const [shown, setShown] = useState(items);
  // Rebuilt in render when the items change, so a removed row is never missing
  // for a frame before its exit starts.
  if (items !== shown) {
    setShown(items);
    setEntries(merge(entries, items, getKey));
  }

  const listRef = useRef<HTMLUListElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const exits = useRef(new Map<string, Animation>());
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // The list is positioned, so a row's offsetTop is measured from it.
    const topOf = (el: HTMLElement) => el.offsetTop;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    const timing = { duration: DURATION_MS, easing: EASING };
    const canAnimate = (el: HTMLElement) => typeof el.animate === 'function';

    for (const { key, leaving } of entries) {
      const el = nodes.current.get(key);
      if (!el) continue;

      if (leaving) {
        if (exits.current.has(key)) continue;
        if (!canAnimate(el)) {
          removeLeaving(key);
          continue;
        }
        // From wherever it is now — mid-entrance, that is part-grown — and
        // with anything still running on it stopped, so the exit is the only
        // animation left on the row.
        const height = el.offsetHeight;
        const opacity = getComputedStyle(el).opacity;
        el.getAnimations?.().forEach((running) => running.cancel());
        const exit = el.animate(
          [
            { height: `${height}px`, opacity },
            { height: '0px', opacity: 0 },
          ],
          { ...timing, fill: 'forwards' },
        );
        exits.current.set(key, exit);
        exit.finished.then(
          () => {
            exits.current.delete(key);
            removeLeaving(key);
          },
          // Cancelled because the row came back; it stays.
          () => exits.current.delete(key),
        );
        continue;
      }

      // Back before its exit finished: stop shrinking it.
      exits.current.get(key)?.cancel();

      if (!canAnimate(el)) continue;
      const before = tops.current.get(key);
      if (before === undefined) {
        if (!firstRender.current) {
          el.animate(
            [
              { height: '0px', opacity: 0 },
              { height: `${el.offsetHeight}px`, opacity: 1 },
            ],
            timing,
          );
        }
      } else if (!reduced && before !== topOf(el)) {
        el.animate([{ transform: `translateY(${before - topOf(el)}px)` }, { transform: 'none' }], timing);
      }
    }

    firstRender.current = false;
    tops.current = new Map(
      entries.flatMap(({ key, leaving }) => {
        const el = nodes.current.get(key);
        return el && !leaving ? [[key, topOf(el)] as const] : [];
      }),
    );

    function removeLeaving(key: string) {
      setEntries((current) => current.filter((entry) => !(entry.key === key && entry.leaving)));
    }
  }, [entries]);

  return (
    <ul ref={listRef} className={cn('relative', className)}>
      {entries.map(({ key, item }) => (
        <div
          key={key}
          ref={(el) => {
            if (el) nodes.current.set(key, el);
            else nodes.current.delete(key);
          }}
        >
          {children(item)}
        </div>
      ))}
    </ul>
  );
}

/**
 * The next list of rows: the new items in their order, with any row that has
 * just been removed kept in place — after the row it used to follow — until
 * its exit is done. A row that comes back stops leaving.
 */
function merge<T>(previous: Entry<T>[], items: T[], getKey: (item: T) => string): Entry<T>[] {
  const next: Entry<T>[] = items.map((item) => ({ key: getKey(item), item, leaving: false }));
  const present = new Set(next.map((entry) => entry.key));

  previous.forEach((entry, index) => {
    if (present.has(entry.key)) return;
    let at = 0;
    for (let j = index - 1; j >= 0; j--) {
      const found = next.findIndex((e) => e.key === previous[j].key);
      if (found !== -1) {
        at = found + 1;
        break;
      }
    }
    next.splice(at, 0, { ...entry, leaving: true });
  });
  return next;
}
