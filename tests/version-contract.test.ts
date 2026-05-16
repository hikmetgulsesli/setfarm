import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf-8")) as T;
}

function readText(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf-8");
}

describe("release version contract", () => {
  it("keeps package, lockfile, changelog, and install surfaces on the same semver", () => {
    const pkg = readJson<{ version: string }>("package.json");
    const lock = readJson<{ version?: string; packages?: Record<string, { version?: string }> }>("package-lock.json");
    const version = pkg.version;

    assert.match(version, /^\d+\.\d+\.\d+$/);
    const [major, minor] = version.split(".").map(Number);
    assert.ok(major > 2 || (major === 2 && minor >= 2), "release version must advance with supervisor architecture changes");
    assert.equal(lock.version, version);
    assert.equal(lock.packages?.[""]?.version, version);

    const expectedTagPath = `/setfarm/v${version}/`;
    assert.match(readText("CHANGELOG.md"), new RegExp(`## ${version.replace(/\./g, "\\.")}\\b`));
    assert.ok(readText("README.md").includes(expectedTagPath), "README install URL must use package semver");
    assert.ok(readText("scripts/install.sh").includes(expectedTagPath), "installer usage URL must use package semver");
    assert.ok(readText("landing/index.html").includes(expectedTagPath), "landing install URL must use package semver");
    assert.ok(readText("landing/index.html").includes(`class="version-badge">v${version}`), "landing badge must use package semver");
  });
});
