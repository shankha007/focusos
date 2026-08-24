import { useId } from 'react';
import { cn } from '@/lib/utils';

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Adds a live sweep + glow — used while a session is running. */
  active?: boolean;
}

/**
 * FocusOS mark — a pomodoro ring on an accent tile: a 3/4 progress arc
 * (a session in flight), a break tick at the top, and a solid centre dot
 * for the single thing you're focused on. Colours come from the theme
 * tokens so the mark re-tints with every theme.
 */
export function LogoMark({ size = 36, className, active = false }: LogoMarkProps) {
  // useId() contains ':' — strip it so the SVG url(#…) references stay valid.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tile = `tile-${id}`;
  const arc = `arc-${id}`;
  const R = 13;
  const C = 2 * Math.PI * R;

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center transition-shadow duration-500',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-0 animate-breathe rounded-[28%] bg-accent/40 blur-md"
        />
      )}
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        role="img"
        aria-label="FocusOS"
        className="relative drop-shadow-[0_4px_12px_rgb(var(--accent)/0.35)]"
      >
        <defs>
          <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" />
            <stop offset="100%" stopColor="rgb(var(--break))" />
          </linearGradient>
          <linearGradient id={arc} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent-fg))" />
            <stop offset="100%" stopColor="rgb(var(--accent-fg))" stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* tile */}
        <rect width="48" height="48" rx="13.5" fill={`url(#${tile})`} />
        {/* top-light sheen so the tile reads as a physical surface */}
        <path
          d="M0 13.5A13.5 13.5 0 0 1 13.5 0h21A13.5 13.5 0 0 1 48 13.5V22C36 13 12 13 0 22Z"
          fill="rgb(var(--accent-fg))"
          opacity="0.12"
        />

        {/* ring track */}
        <circle cx="24" cy="24" r={R} fill="none" stroke="rgb(var(--accent-fg))" strokeOpacity="0.28" strokeWidth="4.5" />

        {/* progress arc — 72% of a session */}
        <g
          transform="rotate(-90 24 24)"
          style={active ? { animation: 'logo-sweep 5.5s linear infinite', transformOrigin: '24px 24px' } : undefined}
        >
          <circle
            cx="24"
            cy="24"
            r={R}
            fill="none"
            stroke={`url(#${arc})`}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={`${C * 0.72} ${C}`}
          />
        </g>

        {/* focus dot */}
        <circle cx="24" cy="24" r="4" fill="rgb(var(--accent-fg))" />
      </svg>
    </span>
  );
}

interface LogoProps {
  className?: string;
  size?: number;
  active?: boolean;
  /** Hides the tagline — used in the compact mobile bar. */
  compact?: boolean;
}

/** Mark + wordmark lockup. */
export function Logo({ className, size = 36, active = false, compact = false }: LogoProps) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} active={active} />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-[-0.02em] text-fg">
          Focus
          <span className="bg-gradient-to-r from-accent to-break bg-clip-text text-transparent">OS</span>
        </span>
        {!compact && (
          <span className="block text-[11px] tracking-tight text-subtle">Deep work companion</span>
        )}
      </span>
    </span>
  );
}
