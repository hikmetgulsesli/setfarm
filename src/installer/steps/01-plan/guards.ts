import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ParsedOutput, ValidationResult, CompleteContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

const VALID_TECH_STACKS = new Set([
  "vite-react",
  "nextjs",
  "vanilla-ts",
  "node-express",
  "react-native",
]);

const VALID_DB_REQUIRED = new Set(["none", "postgres", "sqlite"]);

const MIN_PRD_LENGTH = 500;
const MIN_SCREEN_COUNT = 3;

// Normalize REPO path: (1) ensure $HOME/projects/ prefix, (2) if path collides
// with an existing repo from a prior run, hard-reset to clean slate INCLUDING
// stitch/. Keeping old stitch from a previous task is the bug behind run #445
// — design preClaim sees existing HTML and skips, agent validates stale screens.
export function normalize(parsed: ParsedOutput): void {
  let repo = (parsed.repo || "").trim();
  if (!repo) return;
  const projectsDir = path.join(os.homedir(), "projects");

  // (1) Path normalization
  if (!repo.startsWith(projectsDir) && !/^[/$~]/.test(repo)) {
    const slug = repo.split("/").filter(Boolean).pop() || "project";
    repo = path.join(projectsDir, slug);
    parsed.repo = repo;
    logger.warn(`[module:plan] REPO normalized: ${parsed.repo}`);
  }

  // (2) Collision reset — if a previous run left this dir with >2 commits, wipe it
  if (!fs.existsSync(repo) || !fs.existsSync(path.join(repo, ".git"))) return;
  let commitCount = 0;
  try {
    commitCount = parseInt(execFileSync("git", ["rev-list", "--count", "HEAD"],
      { cwd: repo, encoding: "utf-8", timeout: 5000 }).trim(), 10) || 0;
  } catch { return; }
  if (commitCount <= 2) return;

  try {
    execFileSync("git", ["checkout", "--orphan", "__fresh__"], { cwd: repo, timeout: 5000 });
    execFileSync("git", ["rm", "-rf", "."], { cwd: repo, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
    execFileSync("git", ["clean", "-fdx"], { cwd: repo, timeout: 5000 });
    // -fdx removes stitch/ AND .stitch dotfile too — fresh design generation
    fs.writeFileSync(path.join(repo, "README.md"), "# Project\n");
    execFileSync("git", ["add", "."], { cwd: repo, timeout: 5000 });
    execFileSync("git", ["commit", "-m", "initial"], { cwd: repo, timeout: 5000 });
    try { execFileSync("git", ["branch", "-D", "main"], { cwd: repo, timeout: 5000 }); } catch { /* main may not exist */ }
    execFileSync("git", ["branch", "-m", "main"], { cwd: repo, timeout: 5000 });
    logger.warn(`[module:plan] hard-reset existing repo (${commitCount} commits) — stitch will regenerate`);
  } catch (e) {
    logger.warn(`[module:plan] repo reset failed: ${String(e).slice(0, 200)}`);
  }
}

export function validateOutput(parsed: ParsedOutput): ValidationResult {
  const errors: string[] = [];

  if ((parsed.status || "").toLowerCase() !== "done") {
    errors.push(`STATUS must be 'done' (got: '${parsed.status || ""}')`);
  }

  const repo = parsed.repo || "";
  if (!repo || !/^[/$~]/.test(repo)) {
    errors.push(`REPO must be an absolute path (got: '${repo}')`);
  }

  const branch = parsed.branch || "";
  if (!branch || branch.length > 80 || /\s/.test(branch)) {
    errors.push(`BRANCH must be non-empty, <=80 chars, no spaces (got: '${branch}')`);
  }

  const techStack = (parsed.tech_stack || "").toLowerCase();
  if (!VALID_TECH_STACKS.has(techStack)) {
    errors.push(`TECH_STACK must be one of ${[...VALID_TECH_STACKS].join(", ")} (got: '${techStack}')`);
  }

  const prd = parsed.prd || "";
  if (prd.length < MIN_PRD_LENGTH) {
    errors.push(`PRD must be >=${MIN_PRD_LENGTH} chars (got: ${prd.length})`);
  }

  const screenCountStr = parsed.prd_screen_count || "";
  const screenCount = parseInt(screenCountStr, 10);
  if (!Number.isFinite(screenCount) || screenCount < MIN_SCREEN_COUNT) {
    errors.push(`PRD_SCREEN_COUNT must be integer >=${MIN_SCREEN_COUNT} (got: '${screenCountStr}')`);
  }

  const dbRequired = (parsed.db_required || "").toLowerCase();
  if (!VALID_DB_REQUIRED.has(dbRequired)) {
    errors.push(`DB_REQUIRED must be one of ${[...VALID_DB_REQUIRED].join(", ")} (got: '${dbRequired}')`);
  }

  return { ok: errors.length === 0, errors };
}

// Side effect: stamp parsed values into the shared run context so downstream
// steps (design, stories, setup) read them from context["repo"] etc.
export async function onComplete(ctx: CompleteContext): Promise<void> {
  const { parsed, context } = ctx;
  context["repo"] = parsed.repo || "";
  context["branch"] = parsed.branch || "";
  context["tech_stack"] = (parsed.tech_stack || "").toLowerCase();
  context["prd"] = parsed.prd || "";
  context["prd_screen_count"] = parsed.prd_screen_count || "";
  context["db_required"] = (parsed.db_required || "").toLowerCase();
}
