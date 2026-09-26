import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import { monotonePath, niceTicks, placeLabels, roundedTopBar, textSize } from './chartMath';

/**
 * The bar and area charts on the Analytics page, drawn as plain SVG.
 *
 * These were Recharts, which is 106 KB gzipped — the single largest thing in
 * the app — for one area chart and three bar charts. This reproduces what those
 * four charts actually showed, measured against Recharts' own defaults rather
 * than approximated: the same five "nice" Y ticks, the same X-label thinning,
 * the same monotone curve, 80%-wide bars with 3px rounded tops, the grey hover
 * band, the tooltip 10px off the pointer, and the same entrance timings (bars
 * grow over 0.4s, the area sweeps in over 1.5s).
 */

/** Recharts' default margins, and the height of its X axis. */
const MARGIN = { top: 4, right: 4 };
const X_AXIS_HEIGHT = 30;
/** Tick labels sit this far outside the plot: Recharts' tickSize (6) + tickMargin (2). */
const TICK_OFFSET = 8;
/** Recharts' default minTickGap, which the Y axis never overrode. */
const Y_MIN_GAP = 5;
const TOOLTIP_OFFSET = 10;
/** Recharts' default hover band and cursor line colour. */
const DEFAULT_CURSOR = '#ccc';

export interface ChartProps<T> {
  data: T[];
  kind: 'area' | 'bar';
  height: number;
  /** What a screen reader announces for the whole chart. */
  ariaLabel: string;
  value: (row: T) => number;
  label: (row: T) => string;
  /** Any CSS colour, e.g. 'rgb(var(--accent))'. */
  color: string;
  /** Per-bar opacity, for bars shaded by intensity. */
  barOpacity?: (row: T) => number;
  /** The hover card for one row. */
  tooltip: (row: T) => ReactNode;
  /** Explicit Y ticks; the last one is the top of the scale. Otherwise five nice ticks are chosen. */
  yTicks?: number[];
  yFormat?: (value: number) => string;
  allowDecimals?: boolean;
  yWidth?: number;
  /** Show every (n+1)th X label, as Recharts' numeric `interval`. Otherwise labels thin out to fit. */
  xInterval?: number;
  /** Space kept between X labels when they thin out to fit (Recharts' minTickGap). */
  xMinGap?: number;
  xFontSize?: number;
  /** Fill of the hover band behind a bar. */
  cursorFill?: string;
  className?: string;
}

export function Chart<T>({
  data,
  kind,
  height,
  ariaLabel,
  value,
  label,
  color,
  barOpacity,
  tooltip,
  yTicks,
  yFormat = String,
  allowDecimals = true,
  yWidth = 38,
  xInterval,
  xMinGap = 5,
  xFontSize = 11,
  cursorFill = DEFAULT_CURSOR,
  className,
}: ChartProps<T>) {
  // useId's colons are legal in an id but not safe inside url(#...).
  const gradientId = `chart-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [wrapper, width] = useWidth<HTMLDivElement>();
  const tipRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<{ index: number; x: number; y: number } | null>(null);

  const values = data.map(value);
  const labels = data.map(label);
  const ticks = yTicks ?? niceTicks(Math.max(0, ...values), allowDecimals);
  const top = ticks[ticks.length - 1] || 1;

  const left = yWidth;
  const right = width - MARGIN.right;
  const plotTop = MARGIN.top;
  const bottom = height - X_AXIS_HEIGHT;
  const plotWidth = Math.max(0, right - left);
  const n = data.length;

  const band = n > 0 ? plotWidth / n : 0;
  const xAt = (i: number) =>
    kind === 'bar'
      ? left + band * (i + 0.5)
      : n > 1
        ? left + (plotWidth * i) / (n - 1)
        : left + plotWidth / 2;
  const yAt = (v: number) => bottom - (v / top) * (bottom - plotTop);

  // Where each label is drawn, or null when it is left out. A fixed interval
  // places every (n+1)th label where it stands; otherwise they thin to fit.
  const xLabelAt =
    xInterval !== undefined
      ? labels.map((_, i) => (i % (xInterval + 1) === 0 ? xAt(i) : null))
      : placeLabels(
          labels.map((_, i) => xAt(i)),
          labels.map((text) => textSize(text, xFontSize).width),
          0,
          width,
          xMinGap,
        );
  const yLabels = ticks.map(yFormat);
  const yLabelAt = placeLabels(
    ticks.map(yAt),
    yLabels.map((text) => textSize(text, 11).height),
    0,
    height,
    Y_MIN_GAP,
  );

  /** Changes whenever the data does, so the entrance plays again for a new period — as Recharts animated. */
  const dataKey = `${labels.join('|')}:${values.join('|')}`;

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    if (n === 0 || px < left || px > right || py < plotTop || py > bottom) {
      if (event.pointerType !== 'touch') setActive(null);
      return;
    }
    const raw = kind === 'bar' ? Math.floor((px - left) / band) : n > 1 ? Math.round(((px - left) / plotWidth) * (n - 1)) : 0;
    const index = Math.min(n - 1, Math.max(0, raw));

    // Beside the pointer, flipping to the other side when it would leave the chart.
    const tipWidth = tipRef.current?.offsetWidth ?? 0;
    const tipHeight = tipRef.current?.offsetHeight ?? 0;
    const x = px + TOOLTIP_OFFSET + tipWidth > width ? Math.max(px - TOOLTIP_OFFSET - tipWidth, 0) : px + TOOLTIP_OFFSET;
    const y = py + TOOLTIP_OFFSET + tipHeight > height ? Math.max(py - TOOLTIP_OFFSET - tipHeight, 0) : py + TOOLTIP_OFFSET;
    setActive({ index, x, y });
  };

  const points = values.map((v, i) => [xAt(i), yAt(v)] as const);
  const line = monotonePath(points);

  return (
    <div ref={wrapper} className={className} style={{ position: 'relative', height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={(event) => {
            // A tap on a phone ends with the finger lifting, which is not a
            // request to hide what it just asked to see.
            if (event.pointerType !== 'touch') setActive(null);
          }}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {ticks.map((t) => (
            <line
              key={`grid-${t}`}
              x1={left}
              x2={right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="rgb(var(--border))"
              strokeDasharray="3 3"
            />
          ))}

          {ticks.map((t, i) => {
            const at = yLabelAt[i];
            return at === null ? null : (
              <text
                key={`y-${t}`}
                x={left - TICK_OFFSET}
                y={at}
                dy="0.355em"
                textAnchor="end"
                fontSize={11}
                fill="rgb(var(--subtle))"
              >
                {yLabels[i]}
              </text>
            );
          })}

          {labels.map((text, i) => {
            const at = xLabelAt[i];
            return at === null ? null : (
              <text
                key={`x-${i}`}
                x={at}
                y={bottom + TICK_OFFSET}
                dy="0.71em"
                textAnchor="middle"
                fontSize={xFontSize}
                fill="rgb(var(--subtle))"
              >
                {text}
              </text>
            );
          })}

          {/* Behind the bars, as Recharts drew it. */}
          {active && kind === 'bar' && (
            <rect
              x={left + band * active.index}
              y={plotTop}
              width={band}
              height={bottom - plotTop}
              fill={cursorFill}
              stroke={cursorFill}
              pointerEvents="none"
            />
          )}
          {active && kind === 'area' && (
            <line
              x1={xAt(active.index)}
              x2={xAt(active.index)}
              y1={plotTop}
              y2={bottom}
              stroke={DEFAULT_CURSOR}
              pointerEvents="none"
            />
          )}

          {kind === 'bar' ? (
            <g key={dataKey}>
              {values.map((v, i) => {
                const barHeight = bottom - yAt(v);
                if (barHeight <= 0) return null;
                // Recharts' layout exactly: a 10% gap either side of the bar,
                // the width then cut to a whole pixel, and the bar kept against
                // the left gap rather than re-centred.
                const raw = band * 0.8;
                const barWidth = raw > 1 ? Math.floor(raw) : raw;
                return (
                  <path
                    key={i}
                    className="chart-bar"
                    d={roundedTopBar(left + band * i + band * 0.1, yAt(v), barWidth, barHeight, 3)}
                    fill={color}
                    fillOpacity={barOpacity ? barOpacity(data[i]) : undefined}
                  />
                );
              })}
            </g>
          ) : (
            <g key={dataKey} className="chart-area">
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {n > 1 ? (
                <>
                  <path
                    d={`${line}L${points[n - 1][0]},${bottom}L${points[0][0]},${bottom}Z`}
                    fill={`url(#${gradientId})`}
                  />
                  <path d={line} fill="none" stroke={color} strokeWidth={2} />
                </>
              ) : (
                // One day has no line to draw. Recharts showed the point as a
                // small ring once its entrance had finished.
                n === 1 && (
                  <circle
                    className="chart-dot-late"
                    cx={points[0][0]}
                    cy={points[0][1]}
                    r={3}
                    fill={`url(#${gradientId})`}
                    stroke={color}
                    strokeWidth={2}
                  />
                )
              )}
            </g>
          )}

          {active && kind === 'area' && (
            <circle
              cx={xAt(active.index)}
              cy={yAt(values[active.index])}
              r={4}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </svg>
      )}

      {active && (
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 z-10 whitespace-nowrap"
          style={{ transform: `translate(${active.x}px, ${active.y}px)`, transition: 'transform 400ms ease' }}
        >
          {tooltip(data[active.index])}
        </div>
      )}
    </div>
  );
}

/**
 * The width of an element, kept current as it resizes — what Recharts'
 * ResponsiveContainer did, including measuring once the moment the element
 * mounts rather than waiting for the observer's first report, which only
 * arrives with the next rendered frame.
 */
function useWidth<E extends HTMLElement>(): [React.RefCallback<E>, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  // Stable, so React calls it once with the element and once with null.
  const ref = useCallback((el: E | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.current.observe(el);
  }, []);

  return [ref, width];
}
