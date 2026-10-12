import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(__dirname, "..", "..");
const inputLocators = ["landing/index.html", "README.md", "scripts/install.sh", "scripts/inject-version.js", "package.json"];
const pkg = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
const releaseVersion = pkg.version;
const sourceInputs = inputLocators.map(locator => join(sourceRoot, locator));
const sourcePins = () => sourceInputs.map(file => {
  const stat = lstatSync(file, { bigint: true });
  return { file, sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
    physical: Object.fromEntries(["dev", "ino", "uid", "gid", "mode", "nlink", "size", "mtimeNs", "ctimeNs"].map(key => [key, stat[key]])) };
});
let beforeSourcePins;
let root, htmlPath, readmePath, installPath, scriptPath;

const runInjection = () => execFileSync(process.execPath, [scriptPath], {
  cwd: root, env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, LANG: "C", LC_ALL: "C" },
});

describe("inject-version", () => {
  beforeEach(() => {
    beforeSourcePins = sourcePins();
    root = mkdtempSync(join(tmpdir(), "inject-version-test-"));
    for (const locator of inputLocators) {
      const target = join(root, locator);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(sourceRoot, locator), target);
    }
    htmlPath = join(root, "landing/index.html");
    readmePath = join(root, "README.md");
    installPath = join(root, "scripts/install.sh");
    scriptPath = join(root, "scripts/inject-version.js");
  });

  afterEach(() => {
    try { rmSync(root, { recursive: true, force: true }); }
    finally { assert.deepEqual(sourcePins(), beforeSourcePins, "standalone version tests must not rewrite source inputs"); }
  });

  it("replaces {{VERSION}} with the package release version", () => {
    // Ensure placeholder exists
    let html = readFileSync(htmlPath, "utf8");
    if (!html.includes("{{VERSION}}")) {
      html = html.replace(
        /(class="version-badge">v)[^<]*/,
        "$1{{VERSION}}"
      );
      writeFileSync(htmlPath, html, "utf8");
    }

    runInjection();

    const result = readFileSync(htmlPath, "utf8");
    assert.ok(
      result.includes(`v${releaseVersion}`),
      `Expected HTML to contain v${releaseVersion}`
    );
    assert.ok(
      !result.includes("{{VERSION}}"),
      "Placeholder should be replaced"
    );
  });

  it("is idempotent — running twice produces identical output", () => {
    runInjection();
    const first = readFileSync(htmlPath, "utf8");

    runInjection();
    const second = readFileSync(htmlPath, "utf8");

    assert.equal(first, second, "Output should be identical after two runs");
  });

  it("injects the package release semver into the visible badge", () => {
    runInjection();
    const html = readFileSync(htmlPath, "utf8");
    const match = html.match(/class="version-badge">v([^<]+)</);
    assert.ok(match, "Version badge should exist in HTML");
    assert.equal(match[1], releaseVersion, "Version badge should match package.json");
  });

  it("keeps install URLs on the package release semver tag", () => {
    runInjection();
    const html = readFileSync(htmlPath, "utf8");
    const readme = readFileSync(readmePath, "utf8");
    const install = readFileSync(installPath, "utf8");

    for (const source of [html, readme, install]) {
      assert.ok(source.includes(`/setfarm/v${releaseVersion}/`), "release URL should use package semver");
    }
  });
});
