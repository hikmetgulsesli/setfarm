import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureSmokeBuildFresh } from "../src/installer/smoke-gate.js";

function tmpRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-smoke-gate-"));
}

test("ensureSmokeBuildFresh skips repos without package build scripts", () => {
  const repo = tmpRepo();
  try {
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ scripts: { test: "node --version" } }));
    const result = ensureSmokeBuildFresh(repo);
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("ensureSmokeBuildFresh runs package build before smoke", () => {
  const repo = tmpRepo();
  try {
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "node -e \"require('fs').writeFileSync('dist-fresh.txt','ok')\"" } }));
    const result = ensureSmokeBuildFresh(repo);
    assert.equal(result.ok, true);
    assert.equal(result.skipped, false);
    assert.equal(fs.readFileSync(path.join(repo, "dist-fresh.txt"), "utf-8"), "ok");
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test("ensureSmokeBuildFresh blocks smoke when build fails", () => {
  const repo = tmpRepo();
  try {
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ scripts: { build: "node -e \"process.exit(7)\"" } }));
    const result = ensureSmokeBuildFresh(repo);
    assert.equal(result.ok, false);
    assert.match(result.failure, /SMOKE_PREBUILD_FAILED/);
    assert.match(result.failure, /npm run build/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
