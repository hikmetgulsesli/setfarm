import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";
import { processSetupCompletion, processSetupDesignContracts } from "../../step-guardrails.js";

// Heavy work before the agent:
// 1. Run setup-repo.sh (git init + branch + scaffold)
// 2. Ensure plan's BRANCH exists
// 3. DB provision (processSetupCompletion)
// 4. Design contracts from stitch HTML (processSetupDesignContracts)
// Agent then only confirms + emits EXISTING_CODE.
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  // Tek run-branch mimarisi (2026-04-21): her run tek branch (runId), her story bu branch uzerine commit
  const planBranch = ctx.context["branch"] || ctx.context["BRANCH"] || "";
  const branch = ctx.runId;
  ctx.context["branch"] = branch;
  ctx.context["BRANCH"] = branch;
  if (planBranch && planBranch !== branch && planBranch !== "main") {
    logger.info(`[module:setup-repo preclaim] plan branch ${planBranch} ignored, using run-branch ${branch}`, { runId: ctx.runId });
  }
  const techStack = ctx.context["tech_stack"] || ctx.context["TECH_STACK"] || "vite-react";
  if (!repo) {
    logger.warn(`[module:setup-repo preclaim] skipped — no repo in context`, { runId: ctx.runId });
    return;
  }

  // 1. Run setup-repo.sh — idempotent (script creates .git, baseline scaffold,
  // remote, run branch, references, and Stitch assets).
  // Script signature: setup-repo.sh <REPO> <BRANCH> <STITCH_PROJECT_ID> <SCREEN_MAP> <TECH_STACK>
  const script = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/setup-repo.sh");
  const stitchProjectId = ctx.context["stitch_project_id"] || ctx.context["STITCH_PROJECT_ID"] || "";
  const screenMap = ctx.context["screen_map"] || ctx.context["SCREEN_MAP"] || "";
  if (fs.existsSync(script)) {
    try {
      execFileSync("bash", [script, repo, branch, String(stitchProjectId), String(screenMap), String(techStack)], { encoding: "utf-8", timeout: 180000 });
      logger.info(`[module:setup-repo preclaim] setup-repo.sh ran (stack=${techStack}, branch=${branch})`, { runId: ctx.runId });
    } catch (e) {
      logger.warn(`[module:setup-repo preclaim] setup-repo.sh failed: ${String(e).slice(0, 300)}`, { runId: ctx.runId });
    }
  }

  // 2. Ensure plan's BRANCH exists (created from main if missing)
  if (branch !== "main" && branch !== "master" && fs.existsSync(path.join(repo, ".git"))) {
    try {
      const branchList = execFileSync("git", ["branch", "--list", branch], { cwd: repo, encoding: "utf-8", timeout: 5000 }).trim();
      if (!branchList) {
        execFileSync("git", ["checkout", "-b", branch], { cwd: repo, timeout: 5000 });
        execFileSync("git", ["checkout", "main"], { cwd: repo, timeout: 5000 });
        logger.info(`[module:setup-repo preclaim] branch "${branch}" created from main`, { runId: ctx.runId });
      }
    } catch (e) {
      logger.warn(`[module:setup-repo preclaim] branch ensure failed — fallback to main: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
      ctx.context["branch"] = "main";
      ctx.context["BRANCH"] = "main";
    }
  }

  // 3. DB provision (no-op if DB_REQUIRED=none)
  try {
    const dbErr = processSetupCompletion(ctx.context, ctx.runId);
    if (dbErr) {
      logger.warn(`[module:setup-repo preclaim] DB provision warning: ${dbErr.slice(0, 200)}`, { runId: ctx.runId });
    }
  } catch (e) {
    logger.warn(`[module:setup-repo preclaim] processSetupCompletion error: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }

  // 4. Design contracts (best-effort — no-op if no design manifest)
  try {
    const contractErr = await processSetupDesignContracts(ctx.runId, ctx.context);
    if (contractErr) {
      logger.warn(`[module:setup-repo preclaim] design contracts warning: ${contractErr.slice(0, 200)}`, { runId: ctx.runId });
    }
  } catch (e) {
    logger.warn(`[module:setup-repo preclaim] processSetupDesignContracts error: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }

  // 5. Auto-derive EXISTING_CODE so the agent has a sensible default
  try {
    if (fs.existsSync(repo) && fs.existsSync(path.join(repo, ".git"))) {
      let commitCount = 0;
      try {
        commitCount = parseInt(execFileSync("git", ["rev-list", "--count", "HEAD"],
          { cwd: repo, encoding: "utf-8", timeout: 5000 }).trim(), 10) || 0;
      } catch { /* ignore */ }
      const hasPkg = fs.existsSync(path.join(repo, "package.json"));
      ctx.context["existing_code_hint"] = (hasPkg && commitCount > 5) ? "true" : "false";
    }
  } catch (e) {
    logger.debug(`[module:setup-repo preclaim] existing_code hint: ${String(e).slice(0, 80)}`);
  }
}
