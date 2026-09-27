import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = new URL("../../scripts/deployment-cutover.mjs", import.meta.url);
const source = fs.readFileSync(script, "utf8");

test("catalog host bootstrap has a distinct authenticated no-write verb and strict result gate", () => {
  assert.match(source, /"inspect-task6a-writer-catalog-host-v2"/);
  assert.match(source, /observeCodeOwnedTask6aWriterCatalogHostV2\(\)/);
  assert.match(source, /task6aWriterCatalogHostV2 = observed/);
  assert.match(source, /\.\.\.\(task6aWriterCatalogHostV2 \? \{ task6aWriterCatalogHostV2 \} : \{\}\)/);
  assert.match(source, /"direct-only-non-transitive"/);
  assert.match(source, /"coarse-selected-catalog-row-counts-not-permission-proof"/);
  assert.match(source, /"not-granted"/);
});

test("catalog verb refuses a noncanonical script copy before observing host", () => {
  const fixture = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-cutover-untrusted-"));
  try {
    const copy = path.join(fixture, "scripts", "deployment-cutover.mjs");
    fs.mkdirSync(path.dirname(copy));
    fs.copyFileSync(script, copy);
    const child = spawnSync(process.execPath, [copy, "inspect-task6a-writer-catalog-host-v2", "--json"],
      { encoding: "utf8", timeout: 15000, env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" } });
    assert.equal(child.status, 1);
    assert.equal(child.stdout, "");
    const lines = child.stderr.trimEnd().split("\n");
    assert.equal(lines[0], "DEPLOYMENT_CUTOVER_BOOTSTRAP_REFUSED");
    assert.equal(JSON.parse(lines[1]!).stage, "source-authentication");
    assert.equal(lines.length, 2);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
