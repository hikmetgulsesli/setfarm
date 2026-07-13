/**
 * Tests for the `setfarm ant` easter egg command.
 * Verifies CLI integration and output format.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CLI = path.resolve(import.meta.dirname, "..", "dist", "cli", "cli.js");
let PACKAGED_ROOT = "";

before(() => {
  PACKAGED_ROOT = mkdtempSync(path.join(tmpdir(), "setfarm-ant-packaged-"));
});

after(() => {
  if (PACKAGED_ROOT) rmSync(PACKAGED_ROOT, { recursive: true, force: true });
});

function runCli(command: string): string {
  return execFileSync("node", [CLI, command], {
    encoding: "utf-8",
    env: {
      ...process.env,
      SETFARM_REPO_DIR: PACKAGED_ROOT,
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
    let helpOutput: string;
    try {
      helpOutput = runCli("help");
    } catch (e: any) {
      helpOutput = e.stdout ?? "";
    }
    assert.ok(!helpOutput.includes("setfarm ant"), "ant should not appear in help");
  });
});
