import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" leaves the new worker waiting instead of calling skipWaiting
      // the moment it installs. That is what makes it possible to finish a
      // focus session on the build you started it on: src/lib/pwa.ts reports
      // the waiting update and useAppUpdate decides when to take it.
      registerType: "prompt",
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
        // Pinned to what browsers have been deriving it from. With no `id`, an
        // installed app is identified by its start_url; declaring anything else
        // here would make every existing install look like a different app.
        id: "/dashboard",
        scope: "/",
        categories: ["productivity", "utilities"],
        // Long-press / right-click menu on the installed icon. Both land on
        // routes the app already handles — /tasks?new=1 opens the new-task dialog.
        shortcuts: [
          { name: "New task", short_name: "New task", url: "/tasks?new=1" },
          { name: "Analytics", short_name: "Analytics", url: "/analytics" },
        ],
        icons: [
          // The same artwork serves both purposes, and that is measured rather
          // than assumed. A maskable icon is cropped to whatever shape the
          // platform uses, so its foreground must stay inside a centred circle
          // of radius 40%; this ring reaches 31.6%, and the gradient runs
          // full-bleed to every corner. A padded copy was tried and was worse —
          // a smaller ring behind a visible seam where the padding met the
          // gradient. Declared as separate entries so that swapping in artwork
          // that does not fit the safe zone means changing one line, not
          // untangling a combined "any maskable".
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
          // Install-time artwork for iOS. The OS reads it once when the app is
          // added to a home screen; the running app never draws it, so it has
          // no business in every visitor's offline storage.
          "**/apple-touch-icon.png",
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
            // The marketing pages, kept for offline once they have been seen.
            //
            // They are written by scripts/prerender.mjs after this manifest is
            // generated, so they cannot be precached — which left an app whose
            // headline claim is "works offline" answering its own footer links
            // with a browser error page. Network first, so a visitor online
            // always gets the current page and never a stale one; the copy is
            // only read when the network is not there.
            //
            // "/" is absent on purpose: index.html is precached, and Workbox
            // already resolves "/" to it.
            urlPattern: ({ request, url }: { request: Request; url: URL }) =>
              request.mode === "navigate" &&
              /^\/(25-minute-timer|study-timer|pomodoro-technique|privacy)\/?$/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "focusos-pages",
              expiration: { maxEntries: 10 },
              cacheableResponse: { statuses: [0, 200] },
              // Seconds, not minutes: this only decides how long to wait before
              // showing a cached page on a connection that is technically up
              // and practically not.
              networkTimeoutSeconds: 4,
            },
          },
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
        // app.html, not index.html: index.html is the pre-rendered landing
        // page now, and falling back to it would paint the marketing page for
        // a moment on every offline app navigation.
        navigateFallback: "app.html",
        // Only the routes the router actually serves. The fallback used to
        // answer *every* navigation, so once the worker was installed a
        // mistyped URL got the app shell and the router's catch-all quietly
        // redirected to /dashboard — the 404 page shipped in this build was
        // unreachable for anyone who had opened the app before. The network
        // returns a real 404 for those paths, and now the worker lets them
        // through to find out.
        navigateFallbackAllowlist: [
          /^\/dashboard\/?$/,
          /^\/tasks\/?$/,
          /^\/analytics\/?$/,
          /^\/achievements\/?$/,
          /^\/settings\/?$/,
        ],
        // Files meant to be opened directly. Redundant against the allowlist
        // above, and kept because it is the rule that states the intent: a
        // security researcher looking for security.txt must not find a
        // Pomodoro timer.
        navigateFallbackDenylist: [/^\/\.well-known\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // jsPDF's optional dependencies, which only its `doc.html()` and SVG
      // paths use. The report is built from autoTable alone, so these were
      // ~370 KB of build output that no visitor could ever execute — and the
      // service worker precached all of it. See the stub for the details.
      canvg: path.resolve(import.meta.dirname, "./src/lib/pdfOptionalDependency.ts"),
      dompurify: path.resolve(import.meta.dirname, "./src/lib/pdfOptionalDependency.ts"),
      html2canvas: path.resolve(import.meta.dirname, "./src/lib/pdfOptionalDependency.ts"),
    },
  },
  build: {
    rolldownOptions: {
      // Two documents: the pre-rendered marketing page and the app's own shell.
      // Both load the same entry module; they differ in what is in the body
      // when it arrives.
      input: {
        index: path.resolve(import.meta.dirname, "index.html"),
        app: path.resolve(import.meta.dirname, "app.html"),
      },
      output: {
        // Only libraries that are genuinely on the first-paint path belong
        // here. Naming a package as a chunk group makes it a static import of
        // the entry, which Vite then emits a <link rel="modulepreload"> for —
        // so listing "recharts" here quietly undid the lazy import of the
        // analytics page and downloaded 103 KB of charting on the landing
        // page. Left alone, Rolldown puts it in the async chunk that actually
        // uses it.
        //
        // Rolldown dropped Rollup's object form of `manualChunks`; these
        // groups are its equivalent. The `[\\/]` separators keep the patterns
        // matching on Windows checkouts as well as the Linux build.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
            { name: "motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
          ],
        },
      },
    },
  },
});
