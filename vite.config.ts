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
        // to the workspace. HashRouter means the route lives in the fragment.
        start_url: "/#/dashboard",
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
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
