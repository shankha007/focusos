import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // The engine is pure and would run fine under Node, but the stores, the
    // database layer and every component need a DOM. Splitting the suite in two
    // buys a little speed and costs a config nobody remembers to update, so
    // everything runs in jsdom.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
