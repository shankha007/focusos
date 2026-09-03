import { useMemo, useState, type CSSProperties } from 'react';
import type { SessionType } from '@/types';
import { isDarkTheme, useSettingsStore } from '@/store/useSettingsStore';

/**
 * One drifting light. Every value here is randomised once per mount, so no two
 * sessions look the same — the point of the field is that the screen never
 * settles into a pattern you can memorise.
 */
interface Orb {
  id: number;
  /** Horizontal position as a percentage of the viewport width. */
  x: number;
  size: number;
  /** How far it sways to each side of `x` while it climbs. */
  drift: number;
  riseSeconds: number;
  swaySeconds: number;
  /**
   * Negative, so the orb is already part-way up at mount. Without this the
   * screen opens empty and takes half a minute to populate.
   */
  delaySeconds: number;
  opacity: number;
  /** Where the gradient reaches full transparency — a tighter stop reads as a denser core. */
  falloff: number;
  /** Orbs on the session's secondary colour, which keeps the field from flattening into one hue. */
  secondary: boolean;
}

/**
 * Fewer lights on a phone: the screen is smaller, so the same count reads as
 * clutter, and the GPU budget is tighter.
 */
function orbCount(): number {
  if (typeof window === 'undefined') return 12;
  return window.innerWidth < 640 ? 6 : 12;
}

/** Random float in [min, max). */
function between(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Builds the field. Orbs are seeded one per evenly-spaced horizontal band with
 * jitter inside it, rather than at fully random x — pure randomness clumps, and
 * a clump of three lights in one corner looks like a bug rather than a mood.
 */
function makeOrbs(count: number): Orb[] {
  const band = 100 / count;
  return Array.from({ length: count }, (_, i) => {
    const size = between(130, 400);
    const riseSeconds = between(26, 52);
    return {
      id: i,
      x: band * i + between(0.15, 0.85) * band,
      size,
      drift: between(25, 100),
      riseSeconds,
      swaySeconds: between(9, 17),
      // Spread the starting points across the whole cycle so the field is
      // already in motion on the first frame.
      delaySeconds: -between(0, riseSeconds),
      // Bigger orbs sit further "back", so they read as fainter.
      opacity: between(0.12, 0.3) * (size > 280 ? 0.68 : 1),
      falloff: between(60, 78),
      secondary: Math.random() < 0.35,
    };
  });
}

/**
 * The drifting light field behind deep focus mode. Purely decorative, so it is
 * hidden from assistive tech and never intercepts a click.
 *
 * The caller is responsible for not rendering this when the user has asked for
 * reduced motion.
 */
export function AmbientOrbs({ type }: { type: SessionType }) {
  const isFocus = type === 'focus';
  const theme = useSettingsStore((s) => s.resolvedTheme);
  // The same tint at the same alpha is far louder over a light background than
  // over a dark one — at full strength the light themes look bruised rather
  // than lit. Applied at render rather than baked into the orb, so switching
  // theme mid-session re-tunes the field instead of rebuilding it.
  const intensity = isDarkTheme(theme) ? 1 : 0.4;
  // Seeded once per mount: re-rolling on every render would make the field
  // jump each time the timer ticks.
  const [count] = useState(orbCount);
  const orbs = useMemo(() => makeOrbs(count), [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {orbs.map((orb) => {
        const tint = orb.secondary
          ? isFocus
            ? 'var(--focus)'
            : 'var(--accent)'
          : isFocus
            ? 'var(--accent)'
            : 'var(--break)';

        return (
          <span
            key={orb.id}
            className="orb"
            style={
              {
                '--orb-x': `${orb.x}%`,
                '--orb-size': `${orb.size}px`,
                '--orb-drift': `${orb.drift}px`,
                '--orb-duration': `${orb.riseSeconds}s`,
                '--orb-sway-duration': `${orb.swaySeconds}s`,
                '--orb-delay': `${orb.delaySeconds}s`,
                '--orb-peak': orb.opacity * intensity,
                '--orb-alpha': 1,
                '--orb-falloff': `${orb.falloff}%`,
                '--orb-tint': tint,
              } as CSSProperties
            }
          >
            <span className="orb-body" />
          </span>
        );
      })}
    </div>
  );
}
