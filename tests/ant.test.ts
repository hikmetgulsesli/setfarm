/**
 * Tests for the `setfarm ant` easter egg command.
 * Verifies CLI integration and output format.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Source discovery must not depend on an unrelated prebuilt distribution.
const CLI = path.resolve(import.meta.dirname, "..", "src", "cli", "cli.ts");
let PACKAGED_ROOT = "";

before(() => {
  PACKAGED_ROOT = mkdtempSync(path.join(tmpdir(), "setfarm-ant-packaged-"));
});

after(() => {
  if (PACKAGED_ROOT) rmSync(PACKAGED_ROOT, { recursive: true, force: true });
});

function runCli(command: string, repoRoot = PACKAGED_ROOT): string {
  return execFileSync(process.execPath, ["--import", "tsx", CLI, command], {
    encoding: "utf-8",
    cwd: path.resolve(import.meta.dirname, ".."),
    timeout: 10000,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      SETFARM_REPO_DIR: repoRoot,
      SETFARM_ENV_DIR: PACKAGED_ROOT,
    },
  });
}

describe("setfarm ant (CLI)", () => {
  it("prints ASCII art containing ant body characters", () => {
    const output = runCli("ant");
    assert.ok(output.includes("---"), "should have dashes for ant body");
    assert.ok(output.includes("\\"), "should have backslash characters");
    assert.ok(output.includes("(___A___)"), "should have ant feet");
  });

  it("prints a quote on the last line", () => {
    const output = runCli("ant");
    const lines = output.trim().split("\n");
    const lastLine = lines[lines.length - 1];
    assert.ok(lastLine.length > 10, `expected a quote, got: "${lastLine}"`);
  });

  it("ant command is hidden from help", () => {
    let helpOutput = "";
    assert.throws(() => runCli("help"), error => {
      assert.ok(error !== null && typeof error === "object");
      assert.equal(Reflect.get(error, "status"), 1, "help must reach the real CLI usage path");
      assert.equal(Reflect.get(error, "signal"), null);
      helpOutput = String(Reflect.get(error, "stdout"));
      return true;
    });
    assert.ok(helpOutput.includes("setfarm workflow"), "help must contain actual CLI usage");
    assert.ok(!helpOutput.includes("setfarm ant"), "ant should not appear in help");
  });

  it("source CLI still refuses a real non-main Git checkout before ant output", () => {
    const checkout = path.join(PACKAGED_ROOT, "checkout");
    mkdirSync(checkout);
    execFileSync("git", ["init", "--quiet", "--initial-branch=diagnostic-feature", checkout], {
      stdio: ["ignore", "pipe", "pipe"], timeout: 10000,
    });
    assert.throws(() => runCli("ant", checkout), error => {
      assert.ok(error !== null && typeof error === "object");
      assert.equal(Reflect.get(error, "status"), 2);
      assert.equal(Reflect.get(error, "signal"), null);
      assert.match(String(Reflect.get(error, "stderr")), /RUNTIME_GUARD_FAIL/);
      assert.match(String(Reflect.get(error, "stderr")), /expected 'main'/);
      assert.ok(!String(Reflect.get(error, "stdout")).includes("(___A___)"));
      return true;
    });
  });
});
