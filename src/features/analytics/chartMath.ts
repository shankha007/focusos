/**
 * The geometry behind Chart.tsx, kept apart from the component: tick values,
 * label thinning, the bar shape and the curve. Each reproduces what Recharts
 * drew, which the component's own header describes.
 */

/**
 * Five evenly spaced ticks from zero on a step that reads roundly — Recharts'
 * getNiceTickValues for a [0, max] domain, which always yields exactly five.
 * A flat zero series gets 0–4, as Recharts gave it.
 */
export function niceTicks(max: number, allowDecimals: boolean, count = 5): number[] {
  const clean = (n: number) => Number(n.toFixed(10));
  if (!(max > 0)) return Array.from({ length: count }, (_, i) => i);

  const rough = max / (count - 1);
  const digits = Math.floor(Math.log10(rough)) + 1;
  const magnitude = 10 ** digits;
  const ratioStep = digits !== 1 ? 0.05 : 0.1;
  // Rounded before the ceiling: 0.25 / 0.05 is 5.000000000000001 in floating
  // point, which would otherwise step up to 0.3.
  let step = clean(Math.ceil(clean(rough / magnitude / ratioStep)) * ratioStep * magnitude);
  if (!allowDecimals) step = Math.ceil(step);
  return Array.from({ length: count }, (_, i) => clean(i * step));
}

/**
 * Where to draw each axis label, or null for one that is left out — Recharts'
 * default "preserveEnd", reproduced step for step.
 *
 * Labels are taken from the far end back. The last one always shows, nudged
 * inward if it would overhang; each earlier one shows only if it fits inside
 * [lo, hi] and clears the last one shown by `gap`. `sizes` are the labels'
 * extents along the axis (widths for X, heights for Y). Works in either
 * direction, as Recharts' does: Y coordinates fall as values rise.
 *
 * The bounds are the whole chart, not the plot. That is Recharts' behaviour,
 * and why a date can sit centred on the plot's left edge.
 */
export function placeLabels(
  coords: number[],
  sizes: number[],
  lo: number,
  hi: number,
  gap: number,
): (number | null)[] {
  const n = coords.length;
  const placed: (number | null)[] = coords.map(() => null);
  const sign = n >= 2 ? Math.sign(coords[1] - coords[0]) || 1 : 1;
  const start = sign === 1 ? lo : hi;
  let end = sign === 1 ? hi : lo;

  const fits = (at: number, size: number) =>
    sign * (at - (sign * size) / 2 - start) >= 0 && sign * (at + (sign * size) / 2 - end) <= 0;

  for (let i = n - 1; i >= 0; i--) {
    const size = sizes[i];
    let at = coords[i];
    if (i === n - 1) {
      const overhang = sign * (at + (sign * size) / 2 - end);
      if (overhang > 0) at -= overhang * sign;
    }
    if (sign * at < sign * start || sign * at > sign * end || !fits(at, size)) continue;
    placed[i] = at;
    end = at - sign * (size / 2 + gap);
  }
  return placed;
}

const sizes = new Map<string, { width: number; height: number }>();
let measurer: HTMLSpanElement | null = null;

/**
 * Rendered size of a label, measured once in an offscreen span appended to the
 * page — how Recharts sized its ticks, so the same page styles (the 1.5 line
 * height in particular) give the same answer.
 */
export function textSize(text: string, fontSize: number): { width: number; height: number } {
  const key = `${fontSize}|${text}`;
  const cached = sizes.get(key);
  if (cached) return cached;
  if (!measurer) {
    measurer = document.createElement('span');
    measurer.setAttribute('aria-hidden', 'true');
    measurer.style.cssText = 'position:absolute;top:-20000px;left:0;padding:0;margin:0;border:none;white-space:pre';
    document.body.appendChild(measurer);
  }
  measurer.style.fontSize = `${fontSize}px`;
  measurer.textContent = text;
  const { width, height } = measurer.getBoundingClientRect();
  const size = { width, height };
  sizes.set(key, size);
  return size;
}

/** A bar with its top two corners rounded — Recharts' `radius={[3, 3, 0, 0]}`, clamped for short or narrow bars. */
export function roundedTopBar(x: number, y: number, w: number, h: number, radius: number): string {
  const r = Math.min(radius, w / 2, h);
  return `M${x},${y + h}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h}Z`;
}

/**
 * A smooth line through the points that never overshoots them — the
 * Fritsch–Carlson monotone cubic that Recharts' `type="monotone"` draws (d3's
 * curveMonotoneX), so a day with no focus stays on the baseline instead of
 * dipping below it.
 */
export function monotonePath(points: readonly (readonly [number, number])[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  if (n === 2) return `M${points[0][0]},${points[0][1]}L${points[1][0]},${points[1][1]}`;

  const tangent = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const h0 = x1 - x0;
    const h1 = x2 - x1;
    const s0 = (y1 - y0) / h0;
    const s1 = (y2 - y1) / h1;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    tangent[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  // The end tangents follow from the one segment they sit on.
  const endTangent = (a: number, b: number, other: number) => {
    const h = points[b][0] - points[a][0];
    return h ? (3 * (points[b][1] - points[a][1])) / h / 2 - other / 2 : other;
  };
  tangent[0] = endTangent(0, 1, tangent[1]);
  tangent[n - 1] = endTangent(n - 2, n - 1, tangent[n - 2]);

  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = (x1 - x0) / 3;
    d += `C${x0 + dx},${y0 + dx * tangent[i]},${x1 - dx},${y1 - dx * tangent[i + 1]},${x1},${y1}`;
  }
  return d;
}
