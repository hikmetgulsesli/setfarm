#!/usr/bin/env node
/**
 * Reads the release version from package.json and updates release references
 * across landing/index.html, README.md, and scripts/install.sh. Runtime builds
 * carry commit-specific versions in dist/BUILD_INFO.json and `setfarm version`.
 * Idempotent — re-running produces identical output.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const releaseVersion = pkg.version;

// --- landing/index.html ---
const htmlPath = join(root, "landing", "index.html");
let html = readFileSync(htmlPath, "utf8");

// Version badge
html = html.replace(/v\{\{VERSION\}\}/g, `v${releaseVersion}`);
html = html.replace(
  /(class="version-badge">v)\d+\.\d+\.\d+[^<]*/g,
  `$1${releaseVersion}`
);

// Curl URLs: replace tagged version in raw.githubusercontent URLs
html = html.replace(
  /raw\.githubusercontent\.com\/hikmetgulsesli\/setfarm\/v[\d.]+\//g,
  `raw.githubusercontent.com/hikmetgulsesli/setfarm/v${releaseVersion}/`
);

writeFileSync(htmlPath, html, "utf8");
console.log(`Injected release version ${releaseVersion} into landing/index.html`);

// --- README.md ---
const readmePath = join(root, "README.md");
if (existsSync(readmePath)) {
  let readme = readFileSync(readmePath, "utf8");
  readme = readme.replace(
    /raw\.githubusercontent\.com\/hikmetgulsesli\/setfarm\/v[\d.]+\//g,
    `raw.githubusercontent.com/hikmetgulsesli/setfarm/v${releaseVersion}/`
  );
  writeFileSync(readmePath, readme, "utf8");
  console.log(`Injected release version ${releaseVersion} into README.md`);
}

// --- scripts/install.sh ---
const installPath = join(root, "scripts", "install.sh");
if (existsSync(installPath)) {
  let install = readFileSync(installPath, "utf8");
  install = install.replace(
    /raw\.githubusercontent\.com\/hikmetgulsesli\/setfarm\/v[\d.]+\//g,
    `raw.githubusercontent.com/hikmetgulsesli/setfarm/v${releaseVersion}/`
  );
  writeFileSync(installPath, install, "utf8");
  console.log(`Injected release version ${releaseVersion} into scripts/install.sh`);
}
