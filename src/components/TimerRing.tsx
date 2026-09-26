import { cn } from '@/lib/utils';

interface TimerRingProps {
  /** 0 → 1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Tailwind text-color class used for the arc, e.g. 'text-accent'. */
  colorClass?: string;
  className?: string;
  children?: React.ReactNode;
  /** Adds a soft outer glow — used in Deep Focus. */
  glow?: boolean;
}

/**
 * SVG progress ring. The arc is drawn with stroke-dashoffset rather than a
 * clip path so it stays crisp at any size and animates on the compositor.
 */
export function TimerRing({
  progress,
  size = 280,
  strokeWidth = 10,
  colorClass = 'text-accent',
  className,
  children,
  glow = false,
}: TimerRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // The stroke's outer edge sits exactly on the viewport edge, and an
        // <svg> clips to that edge by default — which sliced the glow into a
        // hard square outline around the ring. The halo is decorative, so let
        // it paint outside the box instead of shrinking the ring to fit it.
        className="-rotate-90 overflow-visible"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-current text-subtle/15"
        />
        {/* Pure CSS, so the landing page's timer needs no animation library:
            `ring-fill` sweeps in from an empty ring on mount, and the
            transition carries every later change of progress. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className={cn('timer-ring-arc stroke-current', colorClass)}
          style={
            {
              '--ring-empty': circumference,
              strokeDashoffset: offset,
              filter: glow ? 'drop-shadow(0 0 12px currentColor)' : undefined,
              opacity: glow ? 0.95 : 1,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
