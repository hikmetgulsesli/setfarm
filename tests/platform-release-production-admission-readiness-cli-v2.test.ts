import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  canonicalPlatformReleaseProductionAdmissionReadinessV2,
  type PlatformReleaseProductionAdmissionReadinessV2,
} from "../src/execution/schemas/platform-release-production-admission-readiness-v2.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const sourceCliPath = path.join(repositoryRoot, "src", "cli", "cli.ts");
const usageError = "PLATFORM_RELEASE_PREFLIGHT_USAGE_INVALID\n";

type CliResult = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string;
}>;

function git(checkout: string, args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: checkout,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createGuardCheckout(kind: "valid" | "invalid"): string {
  const checkout = mkdtempSync(path.join(tmpdir(), `setfarm-preflight-${kind}-`));
  git(checkout, ["init", "--initial-branch=main"]);
  git(checkout, ["config", "user.email", "setfarm-preflight-test@example.invalid"]);
  git(checkout, ["config", "user.name", "Setfarm Preflight Test"]);
  writeFileSync(path.join(checkout, ".gitignore"), "dist/\n", "utf8");
  writeFileSync(path.join(checkout, "fixture.txt"), "guard fixture\n", "utf8");
  git(checkout, ["add", ".gitignore", "fixture.txt"]);
  git(checkout, ["commit", "-m", "create guard fixture"]);

  const head = git(checkout, ["rev-parse", "HEAD"]);
  mkdirSync(path.join(checkout, "dist"));
  writeFileSync(
    path.join(checkout, "dist", "BUILD_INFO.json"),
    `${JSON.stringify({
      sha: head,
      branch: "main",
      dirty: false,
      builtAt: "2026-08-12T00:00:00.000Z",
    })}\n`,
    "utf8",
  );

  if (kind === "invalid") {
    git(checkout, ["switch", "-c", "test-invalid-runtime"]);
  }
  return checkout;
}

function invokeSourceCli(checkout: string, args: readonly string[]): CliResult {
  const env = { ...process.env, SETFARM_REPO_DIR: checkout };
  delete env.SETFARM_SKIP_RUNTIME_GUARD;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", sourceCliPath, ...args],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env,
      maxBuffer: 2 * 1024 * 1024,
      timeout: 120_000,
    },
  );
  assert.equal(result.signal, null, `CLI terminated by ${result.signal}`);
  assert.equal(result.error, undefined, result.error?.message);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function assertNoSensitiveStreamContent(result: CliResult): void {
  const combined = `${result.stdout}${result.stderr}`;
  const forbidden = [
    process.env.USER,
    process.env.LOGNAME,
    process.env.HOME,
    process.env.SHELL,
    "/Library/Keychains",
    "Developer ID Application:",
    "Developer ID Installer:",
    "System Integrity Protection status:",
    "assessments enabled",
    "ENOENT",
    "spawn ",
  ].filter((value): value is string => Boolean(value));
  for (const value of forbidden) {
    assert.equal(combined.includes(value), false, `CLI stream leaked forbidden content: ${value}`);
  }
}

let validCheckout = "";
let invalidCheckout = "";

before(() => {
  validCheckout = createGuardCheckout("valid");
  invalidCheckout = createGuardCheckout("invalid");
});

after(() => {
  if (validCheckout) rmSync(validCheckout, { recursive: true, force: true });
  if (invalidCheckout) rmSync(invalidCheckout, { recursive: true, force: true });
});

test("the exact preflight argv emits one canonical blocked receipt before the guard", () => {
  const exact = invokeSourceCli(invalidCheckout, [
    "platform-release",
    "preflight",
    "--json",
  ]);
  assert.notEqual(exact.status, 0, "diagnostic preflight must never report success");
  assert.equal(exact.status, 2);
  assert.equal(exact.stderr, "");
  assert.equal(exact.stdout.endsWith("\n"), true);
  assert.equal(exact.stdout.split("\n").length, 2, "stdout must contain exactly one JSON line");
  const receipt = JSON.parse(exact.stdout) as PlatformReleaseProductionAdmissionReadinessV2;
  assert.equal(receipt.authorityState, "diagnostic_observation_only");
  assert.equal(receipt.admissionScope, "production_host_readiness_observation");
  assert.equal(receipt.credentialUse, "none");
  assert.equal(receipt.mutationAuthority, false);
  assert.equal(receipt.productionAuthority, false);
  assert.equal(receipt.productionAdmission, "blocked");
  assert.equal(receipt.trustConclusion, "characterization_only");
  assert.equal(
    exact.stdout,
    `${canonicalPlatformReleaseProductionAdmissionReadinessV2(receipt)}\n`,
  );
  assertNoSensitiveStreamContent(exact);
});

const nearMisses = [
  ["platform-release", "preflight"],
  ["platform-release", "preflight", "--json", "--json"],
  ["platform-release", "preflight", "--json", "extra"],
  ["platform-release", "preflight", "--unknown"],
] as const;

test("preflight near misses reach stable usage handling after a valid guard", () => {
  for (const args of nearMisses) {
    const result = invokeSourceCli(validCheckout, args);
    assert.equal(result.status, 1, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.equal(result.stderr, usageError, args.join(" "));
    assertNoSensitiveStreamContent(result);
  }
});

test("preflight near misses and unrelated commands remain behind an invalid guard", () => {
  for (const args of nearMisses) {
    const result = invokeSourceCli(invalidCheckout, args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, /RUNTIME_GUARD_FAIL/u, args.join(" "));
  }

  const unrelated = invokeSourceCli(invalidCheckout, ["version"]);
  assert.equal(unrelated.status, 2);
  assert.equal(unrelated.stdout, "");
  assert.match(unrelated.stderr, /RUNTIME_GUARD_FAIL/u);
});

test("usage labels exact preflight as read-only and non-authoritative", () => {
  const usage = invokeSourceCli(validCheckout, []);
  assert.equal(usage.status, 1);
  assert.match(
    usage.stdout,
    /^setfarm platform-release preflight --json  Read-only production readiness diagnostics \(always non-authoritative\)$/mu,
  );
  assert.equal(usage.stderr, "");
  assertNoSensitiveStreamContent(usage);
});
