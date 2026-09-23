import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Build config for the pre-renderer, kept apart from the app's own.
 *
 * The main config carries the PWA plugin, the code-splitting groups and the
 * manifest — all of which exist to shape what a browser downloads, and none of
 * which mean anything for a bundle that runs once in Node at build time. Worse,
 * letting vite-plugin-pwa run here would generate a second service worker over
 * the wrong output directory.
 *
 * `scripts/prerender.mjs` drives this; nothing else should need it.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // vite-plugin-pwa is not in this config, so the virtual module it creates
      // does not exist here. The app routes reach lib/pwa.ts through the module
      // graph even though no marketing page renders them, and an unresolved
      // import fails the build.
      "virtual:pwa-register": path.resolve(import.meta.dirname, "./src/lib/pwaRegisterSsrStub.ts"),
    },
  },
  build: {
    ssr: "src/entry-ssr.tsx",
    outDir: ".prerender",
    emptyOutDir: true,
    // The renderer runs once, on a machine that is already building; there is
    // nothing to gain by making its output smaller and something to lose when a
    // stack trace points at minified code.
    minify: false,
    rollupOptions: {
      output: { format: "es" },
    },
  },
  // CSS is collected by the client build and linked from index.html. The SSR
  // bundle only needs the markup, and Vite would otherwise emit a second,
  // unused stylesheet into .prerender.
  ssr: {
    noExternal: true,
  },
});
