import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { getSql, pgGet } from "../../../db-pg.js";
import { logger } from "../../../lib/logger.js";
import { processSetupCompletion, processSetupDesignContracts } from "../../step-guardrails.js";
import { resolvePlatformScript } from "../../paths.js";
import { getStackPack } from "../../stack-contract/packs.js";
import type { StackPackId } from "../../stack-contract/types.js";
import {
  englishTextViolationMessageV1,
  inspectEnglishTextV1,
} from "../../../product-compiler/english-text-contract-v1.js";
import { loadCompilerEnglishAdmissionLedgerAuthorityV1 } from "../../../execution/compiler-english-admission-ledger-v1.js";
import { loadCompilerStoryEnglishAdmissionLedgerAuthorityV1 } from "../../../execution/compiler-story-english-admission-ledger-v1.js";

export class SetupRepoEnglishTextRequiredError extends Error {
  readonly code = "SETUP_REPO_ENGLISH_TEXT_REQUIRED";
  readonly field: string;

  constructor(field: string, detail: string) {
    super(`SETUP_REPO_ENGLISH_TEXT_REQUIRED: ${field}: ${detail}`);
    this.name = "SetupRepoEnglishTextRequiredError";
    this.field = field;
  }
}

function requireEnglishSetupText(value: string, field: string): void {
  if (/[\t\r\n]/.test(value)) {
    throw new SetupRepoEnglishTextRequiredError(
      field,
      "ENGLISH_TEXT_SINGLE_LINE_REQUIRED",
    );
  }
  const issue = inspectEnglishTextV1(value);
  if (issue) {
    throw new SetupRepoEnglishTextRequiredError(
      field,
      englishTextViolationMessageV1(issue),
    );
  }
}

function resolveSetupTechStack(context: Record<string, string>): string {
  const packId = context["stack_pack_id"] || context["detected_stack"] || "";
  if (packId) {
    try {
      const pack = getStackPack(packId as StackPackId);
      const alias = pack.techStackAliases?.[0];
      if (alias) return alias;
    } catch {
      // Fall back to the legacy context keys below.
    }
  }
  return context["tech_stack"] || context["TECH_STACK"] || "vite-react";
}

function repoHasRequiredBaseline(repo: string, context: Record<string, string>): boolean {
  const packId = context["stack_pack_id"] || context["detected_stack"] || "";
  if (packId === "static-html-site") return fs.existsSync(path.join(repo, "index.html"));
  return fs.existsSync(path.join(repo, "package.json"));
}

// Heavy work before the agent:
// 1. Run setup-repo.sh (git init + branch + scaffold)
// 2. Ensure plan's BRANCH exists
// 3. DB provision (processSetupCompletion)
// 4. Design contracts from stitch HTML (processSetupDesignContracts)
// Agent then only confirms + emits EXISTING_CODE.
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  const displayName = ctx.context["project_display_name"] || ctx.context["PROJECT_DISPLAY_NAME"] || ctx.context["project_name"] || "";
  const scaffoldTextInputs = [
    ["project_display_name", ctx.context["project_display_name"]],
    ["PROJECT_DISPLAY_NAME", ctx.context["PROJECT_DISPLAY_NAME"]],
    ["project_name", ctx.context["project_name"]],
    ["app_title", ctx.context["app_title"]],
  ] as const;
  for (const [field, value] of scaffoldTextInputs) {
    if (value !== undefined) requireEnglishSetupText(value, field);
  }
  requireEnglishSetupText(displayName, "displayName");

  const runProtocol = await pgGet<{ protocol: string }>(
    "SELECT protocol FROM runs WHERE id = $1",
    [ctx.runId],
  );
  if (runProtocol?.protocol === "v3") {
    await loadCompilerEnglishAdmissionLedgerAuthorityV1(getSql(), { runId: ctx.runId });
    await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(getSql(), { runId: ctx.runId });
  }
  if (process.env.SETFARM_DISABLE_AUTO_SETUP_REPO === "1") return;

  // Single run-branch architecture: every run owns one resolved runtime branch,
  // and each story commits onto that branch.
  const branch = ctx.context["branch"] || ctx.context["BRANCH"] || ctx.context["run_slug"] || ctx.runId;
  ctx.context["branch"] = branch;
  ctx.context["BRANCH"] = branch;
  const techStack = resolveSetupTechStack(ctx.context);
  if (!repo) {
    logger.warn(`[module:setup-repo preclaim] skipped — no repo in context`, { runId: ctx.runId });
    return;
  }
  let setupRepoFailed = false;

  // 1. Run setup-repo.sh — idempotent (script creates .git, baseline scaffold,
  // remote, run branch, references, and Stitch assets).
  // Script signature: setup-repo.sh <REPO> <BRANCH> <STITCH_PROJECT_ID> <SCREEN_MAP> <TECH_STACK> <PROJECT_DISPLAY_NAME> <UI_LANGUAGE>
  const script = resolvePlatformScript("setup-repo.sh");
  const stitchProjectId = ctx.context["stitch_project_id"] || ctx.context["STITCH_PROJECT_ID"] || "";
  const screenMap = ctx.context["screen_map"] || ctx.context["SCREEN_MAP"] || "";
  if (fs.existsSync(script)) {
    try {
      execFileSync("bash", [script, repo, branch, String(stitchProjectId), String(screenMap), String(techStack), String(displayName), "English"], {
        encoding: "utf-8",
        timeout: 180000,
        env: {
          ...process.env,
          SETFARM_RUN_SLUG: ctx.context["run_slug"] || "",
          SETFARM_GITHUB_REPO: ctx.context["github_repo"] || "",
          SETFARM_APP_TITLE: ctx.context["app_title"] || displayName,
          SETFARM_PACKAGE_NAME: ctx.context["package_name"] || "",
        },
      });
      logger.info(`[module:setup-repo preclaim] setup-repo.sh ran (stack=${techStack}, branch=${branch})`, { runId: ctx.runId });
    } catch (e) {
      if ((e as NodeJS.ErrnoException & { status?: number }).status === 64) {
        throw new SetupRepoEnglishTextRequiredError(
          "setup-repo.sh",
          "shell English admission failed before repository mutation",
        );
      }
      setupRepoFailed = true;
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
      const hasBaseline = repoHasRequiredBaseline(repo, ctx.context);
      ctx.context["existing_code_hint"] = (hasBaseline && commitCount > 5) ? "true" : "false";
    }
  } catch (e) {
    logger.debug(`[module:setup-repo preclaim] existing_code hint: ${String(e).slice(0, 80)}`);
  }

  const repoReady = fs.existsSync(repo)
    && fs.existsSync(path.join(repo, ".git"))
    && repoHasRequiredBaseline(repo, ctx.context);
  if (!setupRepoFailed && repoReady) {
    const step = await pgGet<{ id: string }>(
      "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
      [ctx.runId, ctx.stepId],
    );
    if (!step?.id) return;

    const output = [
      "STATUS: done",
      `EXISTING_CODE: ${ctx.context["existing_code_hint"] || "false"}`,
      "",
    ].join("\n");
    const { completeStep } = await import("../../step-ops.js");
    await completeStep(step.id, output, ctx.claimEnvelope);
    logger.info(`[module:setup-repo preclaim] AUTO-COMPLETED setup-repo without setup-repo agent`, {
      runId: ctx.runId,
      stepId: ctx.stepId,
    });
  }
}
