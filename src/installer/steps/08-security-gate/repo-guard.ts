import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import type { ClaimContext, CompleteContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

function repoPathFrom(context: Record<string, string>): string {
  return (context["repo"] || context["REPO"] || "").replace(/^~/, os.homedir());
}

function gitOutput(repo: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repo,
    timeout: 10_000,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = repoPathFrom(ctx.context);
  if (!repo || !fs.existsSync(repo)) return;
  try {
    ctx.context["security_gate_repo_head"] = gitOutput(repo, ["rev-parse", "HEAD"]);
    ctx.context["security_gate_repo_status"] = gitOutput(repo, ["status", "--porcelain=v1"]);
  } catch (e) {
    logger.warn(`[security-gate] repo snapshot skipped: ${String(e).slice(0, 160)}`, { runId: ctx.runId });
  }
}

export async function onComplete(ctx: CompleteContext): Promise<void> {
  const repo = repoPathFrom(ctx.context);
  const expectedHead = ctx.context["security_gate_repo_head"] || "";
  const expectedStatus = ctx.context["security_gate_repo_status"] || "";
  if (!repo || !fs.existsSync(repo) || !expectedHead) return;

  let actualHead = "";
  let actualStatus = "";
  try {
    actualHead = gitOutput(repo, ["rev-parse", "HEAD"]);
    actualStatus = gitOutput(repo, ["status", "--porcelain=v1"]);
  } catch (e) {
    logger.warn(`[security-gate] repo guard skipped: ${String(e).slice(0, 160)}`, { runId: ctx.runId });
    return;
  }

  if (actualHead !== expectedHead || actualStatus !== expectedStatus) {
    const statusChanged = actualStatus !== expectedStatus;
    throw new Error(
      [
        "ROLE_VIOLATION: security-gate is read-only but modified the project repository.",
        `HEAD ${expectedHead.slice(0, 8)} -> ${actualHead.slice(0, 8)}`,
        statusChanged ? "Worktree status changed." : "",
        "Report STATUS: retry for implement instead of editing, committing, or pushing from security-gate.",
      ].filter(Boolean).join(" "),
    );
  }
}
