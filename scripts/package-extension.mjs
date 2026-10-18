/**
 * Zips dist-extension/ into the files the extension stores take.
 *
 * Two packages, because the manifests cannot be shared. Chromium browsers run
 * the background script as a service worker; Firefox runs it as an event page
 * and does not support `service_worker`. A manifest declaring both loads fine
 * when installed by hand, but the Edge Add-ons validator rejects
 * `background.scripts` in Manifest V3 outright. So:
 *
 * - focusos-extension-<version>-chromium.zip: Chrome Web Store, Edge Add-ons,
 *   Opera. The manifest exactly as built.
 * - focusos-extension-<version>-firefox.zip: Firefox Add-ons (AMO). The same
 *   files, with extension/manifest.firefox.json laid over the manifest.
 *
 * Written against Node's own zlib rather than a zip library, since a store
 * upload needs nothing more than deflated entries and a central directory.
 *
 * Run by `npm run build:extension`, after the build.
 */
import { deflateRawSync, crc32 } from "node:zlib";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "dist-extension");
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

// Zip timestamps are MS-DOS local time. A fixed one keeps the archive
// identical between builds of the same source.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

/** Writes a zip of dist-extension/ to `target`, with `overrides` replacing the named files' contents. */
function pack(target, overrides) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const file of files(source).sort()) {
    const name = path.relative(source, file).split(path.sep).join("/");
    const entryName = Buffer.from(name);
    const data = overrides[name] ?? readFileSync(file);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(entryName.length, 26);
    locals.push(local, entryName, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(entryName.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, entryName);

    offset += local.length + entryName.length + packed.length;
  }

  const count = central.length / 2;
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  writeFileSync(target, Buffer.concat([...locals, directory, end]));
  console.log(`Packaged ${count} files into ${path.relative(root, target)}`);
}

const manifest = JSON.parse(readFileSync(path.join(source, "manifest.json"), "utf8"));
const firefox = JSON.parse(readFileSync(path.join(root, "extension", "manifest.firefox.json"), "utf8"));
const firefoxManifest = Buffer.from(JSON.stringify({ ...manifest, ...firefox }, null, 2) + "\n");

pack(path.join(root, `focusos-extension-${version}-chromium.zip`), {});
pack(path.join(root, `focusos-extension-${version}-firefox.zip`), { "manifest.json": firefoxManifest });
