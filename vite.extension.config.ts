import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Build config for the browser extension (Chrome, Edge, Brave, Opera, Firefox).
 *
 * The extension carries the whole app, built from the same source as the
 * website, and adds a toolbar popup and a background worker around it. Kept
 * apart from vite.config.ts because almost everything there shapes a website:
 * the service worker, the marketing page, the pre-renderer's second document.
 * None of that applies to files the browser installs from disk.
 *
 * `npm run build:extension` drives this, then scripts/package-extension.mjs
 * zips the result for the stores.
 */

const root = import.meta.dirname;
const outDir = path.resolve(root, "dist-extension");
const staticDir = path.resolve(root, "extension");

/**
 * Adapts app.html, written for the website, to an extension page.
 *
 * Manifest V3 forbids inline script on extension pages outright — there is no
 * hash or nonce to allow it by, as the website's CSP does. Left inline, the
 * theme would silently not be applied before first paint; moved into a file it
 * runs at the same point in the head, still before anything is drawn.
 *
 * The apple-touch-icon link goes too: it names a file this build does not
 * ship, for a home screen an extension is never added to.
 */
function adaptAppHtml(): Plugin {
  return {
    name: "focusos-extension-html",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".html")) continue;
        let index = 0;
        file.source = String(file.source)
          .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, "")
          .replace(/<script>([\s\S]*?)<\/script>/g, (_match, body: string) => {
            const fileName = `assets/inline-${index++}.js`;
            this.emitFile({ type: "asset", fileName, source: body.trim() + "\n" });
            return `<script src="./${fileName}"></script>`;
          });
      }
    },
  };
}

/**
 * Copies the extension's own files next to the app: the manifest, the popup and
 * the background worker, and the icons. The manifest's version is taken from
 * package.json so the two cannot drift.
 */
function copyExtensionFiles(): Plugin {
  return {
    name: "focusos-extension-files",
    apply: "build",
    closeBundle() {
      const pkg = JSON.parse(readFileSync(path.resolve(root, "package.json"), "utf8")) as {
        version: string;
      };

      const copyDir = (from: string, to: string) => {
        mkdirSync(to, { recursive: true });
        for (const entry of readdirSync(from, { withFileTypes: true })) {
          const source = path.join(from, entry.name);
          const target = path.join(to, entry.name);
          if (entry.isDirectory()) copyDir(source, target);
          else if (entry.name !== "manifest.json") copyFileSync(source, target);
        }
      };
      copyDir(staticDir, outDir);

      const manifest = JSON.parse(readFileSync(path.join(staticDir, "manifest.json"), "utf8"));
      manifest.version = pkg.version;
      writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

      // The app links these by absolute path (the favicon, the notification
      // icon). On an extension page "/" is the extension's root, so they only
      // need to be there.
      for (const file of ["favicon.svg", "icon-192.png"]) {
        copyFileSync(path.resolve(root, "public", file), path.join(outDir, file));
      }
    },
  };
}

export default defineConfig({
  // Relative, so every asset resolves under chrome-extension://<id>/ (or
  // moz-extension://) without knowing the id.
  base: "./",
  // public/ is the website's: robots.txt, the share card, security.txt, the
  // 404 page. The two files the app needs from it are copied above.
  publicDir: false,
  plugins: [react(), adaptAppHtml(), copyExtensionFiles()],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      // No service worker of the website's in the extension: main.tsx skips
      // registration, and this stands in for the module vite-plugin-pwa would
      // otherwise generate, which lib/pwa.ts still imports.
      "virtual:pwa-register": path.resolve(root, "./src/extension/pwaRegisterStub.ts"),
      // Same jsPDF optional dependencies as the website build leaves out.
      canvg: path.resolve(root, "./src/lib/pdfOptionalDependency.ts"),
      dompurify: path.resolve(root, "./src/lib/pdfOptionalDependency.ts"),
      html2canvas: path.resolve(root, "./src/lib/pdfOptionalDependency.ts"),
    },
  },
  build: {
    outDir,
    emptyOutDir: true,
    rolldownOptions: {
      input: { app: path.resolve(root, "app.html") },
    },
  },
});
