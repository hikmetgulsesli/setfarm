import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  canonicalPlatformReleaseProductionAdmissionReadinessV2,
  type PlatformReleaseProductionAdmissionReadinessV2,
} from "../execution/schemas/platform-release-production-admission-readiness-v2.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, "..", "..", "dist", "cli", "cli.js");

describe("platform release production admission readiness CLI", () => {
  it("emits one canonical non-authoritative receipt for the exact preflight argv", () => {
    const result = spawnSync(
      process.execPath,
      [cliPath, "platform-release", "preflight", "--json"],
      {
        cwd: join(__dirname, "..", ".."),
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        timeout: 120_000,
      },
    );

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.signal, null);
    assert.notEqual(result.status, 0, "diagnostic preflight must never report success");
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.endsWith("\n"), true);
    assert.equal(result.stdout.split("\n").length, 2, "stdout must contain exactly one JSON line");

    const receipt = JSON.parse(result.stdout) as PlatformReleaseProductionAdmissionReadinessV2;
    assert.equal(receipt.authorityState, "diagnostic_observation_only");
    assert.equal(receipt.admissionScope, "production_host_readiness_observation");
    assert.equal(receipt.credentialUse, "none");
    assert.equal(receipt.mutationAuthority, false);
    assert.equal(receipt.productionAuthority, false);
    assert.equal(receipt.productionAdmission, "blocked");
    assert.equal(receipt.trustConclusion, "characterization_only");
    assert.equal(
      result.stdout,
      `${canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt)}\n`,
    );
  });
});

describe("workflow stop CLI", () => {
  it("help text includes 'workflow stop' command", () => {
    // Running with no args prints usage to stdout and exits with code 1
    let output: string;
    try {
      output = execFileSync("node", [cliPath], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      // CLI exits with code 1 when no args — capture stdout from the error
      output = (err.stdout ?? "") + (err.stderr ?? "");
    }
    assert.ok(output.includes("workflow stop"), "Help text should include 'workflow stop'");
    assert.ok(output.includes("Stop/cancel a running workflow"), "Help text should include stop description");
  });

  it("'workflow stop' appears after 'workflow resume' in help text", () => {
    let output: string;
    try {
      output = execFileSync("node", [cliPath], { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    } catch (err: any) {
      output = (err.stdout ?? "") + (err.stderr ?? "");
    }
    const resumeIndex = output.indexOf("workflow resume");
    const stopIndex = output.indexOf("workflow stop");
    assert.ok(resumeIndex !== -1, "Help text should include 'workflow resume'");
    assert.ok(stopIndex !== -1, "Help text should include 'workflow stop'");
    assert.ok(stopIndex > resumeIndex, "'workflow stop' should appear after 'workflow resume'");
  });

  it("'workflow stop' with no run-id prints error and exits with code 1", () => {
    try {
      execFileSync("node", [cliPath, "workflow", "stop"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.fail("Should have exited with code 1");
    } catch (err: any) {
      assert.equal(err.status, 1, "Should exit with code 1");
      assert.ok(
        (err.stderr ?? "").includes("Missing run-id"),
        "Should print 'Missing run-id' to stderr",
      );
    }
  });

  it("'workflow stop' with nonexistent run-id prints error and exits with code 1", () => {
    try {
      execFileSync("node", [cliPath, "workflow", "stop", "nonexistent-run-id-000"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.fail("Should have exited with code 1");
    } catch (err: any) {
      assert.equal(err.status, 1, "Should exit with code 1");
      assert.ok(
        (err.stderr ?? "").length > 0,
        "Should print error to stderr",
      );
    }
  });
});
