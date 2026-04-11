/**
 * Runtime integrity guard (cuddly-sleeping-quail plan).
 *
 * Root cause of Wave 10-14 fix regression: setfarm-repo working tree drifted
 * to a stale story worktree branch, dist/ was rebuilt from that branch, and
 * every `node dist/cli/cli.js` invocation ran pre-Wave-10 code — agents
 * self-corrupting the repo while the platform was blind to its own staleness.
 *
 * This module runs as the very first action of every CLI invocation. It
 * refuses to start unless:
 *   1. The setfarm-repo HEAD is on `main`
 *   2. The working tree is clean (no uncommitted local changes)
 *   3. dist/BUILD_INFO.json exists and its sha matches HEAD
 *
 * Commands that are expected to run outside the invariant (`update`,
 * `--skip-runtime-guard`) can bypass this with an explicit flag.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface BuildInfo {
  sha: string;
  branch: string;
  dirty: boolean;
  builtAt: string;
}

export interface RuntimeGuardResult {
  ok: boolean;
  reason?: string;
  buildInfo?: BuildInfo;
  headSha?: string;
  branch?: string;
}

const SETFARM_REPO_DIR =
  process.env.SETFARM_REPO_DIR ||
  path.join(os.homedir(), ".openclaw", "setfarm-repo");

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: SETFARM_REPO_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
    timeout: 5000,
  }).trim();
}

export function verifyRuntimeIntegrity(options?: { allowDirty?: boolean }): RuntimeGuardResult {
  if (!existsSync(SETFARM_REPO_DIR) || !existsSync(path.join(SETFARM_REPO_DIR, ".git"))) {
    return { ok: true, reason: "setfarm-repo not found — assumed packaged install" };
  }

  let branch: string;
  try { branch = git(["branch", "--show-current"]); }
  catch (e) { return { ok: false, reason: "git branch failed: " + String(e).slice(0, 160) }; }

  if (branch !== "main") {
    return { ok: false, reason: "setfarm-repo is on branch '" + branch + "' (expected 'main'). Runtime refuses to start from a non-main checkout. Run: cd ~/.openclaw/setfarm-repo && git checkout main && npm run build", branch };
  }

  let headSha: string;
  try { headSha = git(["rev-parse", "HEAD"]); }
  catch (e) { return { ok: false, reason: "git rev-parse failed: " + String(e).slice(0, 160) }; }

  if (!options?.allowDirty) {
    let porcelain: string;
    try { porcelain = git(["status", "--porcelain"]); }
    catch (e) { return { ok: false, reason: "git status failed: " + String(e).slice(0, 160) }; }
    if (porcelain.length > 0) {
      return { ok: false, reason: "setfarm-repo has uncommitted local changes — platform source tree must be clean. Run: cd ~/.openclaw/setfarm-repo && git status", branch, headSha };
    }
  }

  const buildInfoPath = path.join(SETFARM_REPO_DIR, "dist", "BUILD_INFO.json");
  if (!existsSync(buildInfoPath)) {
    return { ok: false, reason: "dist/BUILD_INFO.json missing — dist was built without the prebuild stamp. Run: cd ~/.openclaw/setfarm-repo && npm run build", branch, headSha };
  }

  let buildInfo: BuildInfo;
  try { buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8")); }
  catch (e) { return { ok: false, reason: "dist/BUILD_INFO.json parse failed: " + String(e).slice(0, 160), branch, headSha }; }

  if (buildInfo.sha !== headSha) {
    return { ok: false, reason: "dist/BUILD_INFO.json sha (" + buildInfo.sha.slice(0, 8) + ") does not match HEAD (" + headSha.slice(0, 8) + "). dist/ is stale. Run: cd ~/.openclaw/setfarm-repo && npm run build", branch, headSha, buildInfo };
  }

  if (buildInfo.branch !== "main") {
    return { ok: false, reason: "dist/BUILD_INFO.json was built from branch '" + buildInfo.branch + "' (not main). Runtime refuses to trust a non-main build.", branch, headSha, buildInfo };
  }

  return { ok: true, branch, headSha, buildInfo };
}

export function assertRuntimeIntegrityOrExit(): void {
  if (process.env.SETFARM_SKIP_RUNTIME_GUARD === "1") return;
  if (process.argv.includes("--skip-runtime-guard")) return;
  const result = verifyRuntimeIntegrity();
  if (!result.ok) {
    process.stderr.write("\n[setfarm] RUNTIME_GUARD_FAIL: " + result.reason + "\n\n");
    process.stderr.write("[setfarm] This is a safety gate — it prevents stale code from running production workflows.\n");
    process.stderr.write("[setfarm] Override with: SETFARM_SKIP_RUNTIME_GUARD=1 node dist/cli/cli.js ...\n\n");
    process.exit(2);
  }
}
