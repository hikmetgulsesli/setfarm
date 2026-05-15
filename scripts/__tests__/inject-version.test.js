import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const htmlPath = join(root, "landing", "index.html");
const backupPath = htmlPath + ".bak";
const readmePath = join(root, "README.md");
const readmeBackupPath = readmePath + ".bak";
const installPath = join(root, "scripts", "install.sh");
const installBackupPath = installPath + ".bak";
const scriptPath = join(root, "scripts", "inject-version.js");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const releaseVersion = pkg.version;

describe("inject-version", () => {
  beforeEach(() => {
    copyFileSync(htmlPath, backupPath);
    copyFileSync(readmePath, readmeBackupPath);
    copyFileSync(installPath, installBackupPath);
  });

  afterEach(() => {
    copyFileSync(backupPath, htmlPath);
    copyFileSync(readmeBackupPath, readmePath);
    copyFileSync(installBackupPath, installPath);
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

    execFileSync("node", [scriptPath], { cwd: root });

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
    execFileSync("node", [scriptPath], { cwd: root });
    const first = readFileSync(htmlPath, "utf8");

    execFileSync("node", [scriptPath], { cwd: root });
    const second = readFileSync(htmlPath, "utf8");

    assert.equal(first, second, "Output should be identical after two runs");
  });

  it("injects the package release semver into the visible badge", () => {
    execFileSync("node", [scriptPath], { cwd: root });
    const html = readFileSync(htmlPath, "utf8");
    const match = html.match(/class="version-badge">v([^<]+)</);
    assert.ok(match, "Version badge should exist in HTML");
    assert.equal(match[1], releaseVersion, "Version badge should match package.json");
  });

  it("keeps install URLs on the package release semver tag", () => {
    execFileSync("node", [scriptPath], { cwd: root });
    const html = readFileSync(htmlPath, "utf8");
    const readme = readFileSync(readmePath, "utf8");
    const install = readFileSync(installPath, "utf8");

    for (const source of [html, readme, install]) {
      assert.ok(source.includes(`/setfarm/v${releaseVersion}/`), "release URL should use package semver");
    }
  });
});
