import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // src/lib/pwa.ts imports the virtual module and registers the worker
      // itself. The script this plugin would otherwise inject is a bare
      // `navigator.serviceWorker.register` with no update handling, and having
      // both would register twice.
      injectRegister: null,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "FocusOS — Deep Work Companion",
        short_name: "FocusOS",
        description:
          "A premium, offline-first Pomodoro workspace with adaptive sessions, analytics, and ambient focus.",
        theme_color: "#0b0b0f",
        background_color: "#0b0b0f",
        display: "standalone",
        orientation: "portrait-primary",
        // "/" is the marketing page. Someone who has installed the app has
        // already been sold on it, so the installed entry point skips straight
        // to the workspace.
        start_url: "/dashboard",
        scope: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: [
          // The share-card image is only ever fetched by crawlers and
          // link-preview bots, never by the running app — precaching it would
          // spend 147 KB of every visitor's offline storage on something they
          // never see.
          "**/og-image.png",
          // jsPDF and its autoTable plugin are ~410 KB behind one button on one
          // screen. Every other chunk here is something the app will render for
          // a user who simply opens it; these two are not, and precaching them
          // charges every visitor for a report most will never export. They are
          // runtime-cached below instead, so the first export downloads them and
          // every export after that — online or off — is served from the cache.
          "**/assets/jspdf*.js",
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              /^\/assets\/jspdf.*\.js$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "focusos-pdf",
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
              // The dev preview answers asset requests with `Vary: Origin`, and
              // a stored entry carrying that header will not match a later
              // request whose Origin is computed differently — the cache fills
              // up and is then never read, which is the worst of both. These
              // filenames are content-hashed, so the URL alone identifies the
              // bytes and varying on anything else is meaningless.
              matchOptions: { ignoreVary: true },
            },
          },
        ],
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // jsPDF's optional dependencies, which only its `doc.html()` and SVG
      // paths use. The report is built from autoTable alone, so these were
      // ~370 KB of build output that no visitor could ever execute — and the
      // service worker precached all of it. See the stub for the details.
      canvg: path.resolve(__dirname, "./src/lib/pdfOptionalDependency.ts"),
      dompurify: path.resolve(__dirname, "./src/lib/pdfOptionalDependency.ts"),
      html2canvas: path.resolve(__dirname, "./src/lib/pdfOptionalDependency.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Only libraries that are genuinely on the first-paint path belong
        // here. Naming a package as a manual chunk makes it a static import of
        // the entry, which Vite then emits a <link rel="modulepreload"> for —
        // so listing "recharts" here quietly undid the lazy import of the
        // analytics page and downloaded 103 KB of charting on the landing
        // page. Left alone, Rollup puts it in the async chunk that actually
        // uses it.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
