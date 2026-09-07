/**
 * Stands in for jsPDF's optional dependencies — canvg, dompurify and
 * html2canvas — at build time.
 *
 * Those three back `doc.html()` and SVG rendering. The focus report is built
 * entirely from `autoTable`, so none of that code path ever runs, but the
 * packages still came out of the build at roughly 370 KB and were precached by
 * the service worker on every visitor's first load — storage spent on a feature
 * the app does not have.
 *
 * jsPDF reaches for them through dynamic `import()`, so aliasing them here (see
 * `resolve.alias` in vite.config.ts) drops them from the build without touching
 * the export path that is actually used.
 *
 * Anything that does reach for them fails with an explanation rather than a
 * mystery, which is the part that matters if `doc.html()` is ever wanted.
 */
function unavailable(): never {
  throw new Error(
    "jsPDF's optional dependencies (canvg, dompurify, html2canvas) are deliberately excluded " +
      'from this build — the PDF report uses autoTable only. To use doc.html() or SVG ' +
      'rendering, remove the alias for them in vite.config.ts.',
  );
}

/** html2canvas and dompurify are both consumed as default exports. */
export default unavailable;

/** canvg is consumed as `const { Canvg } = await import('canvg')`. */
export const Canvg = { from: unavailable, fromString: unavailable };

/** dompurify's method form, for the same reason. */
export const sanitize = unavailable;
