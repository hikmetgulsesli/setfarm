/**
 * Step Guardrails
 *
 * Extracted from step-ops.ts — server-side checks that run independently of agents.
 * Prevents broken code from advancing through the pipeline.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getDb } from "../db.js";
import { logger } from "../lib/logger.js";
import { isFrontendChange } from "../lib/frontend-detect.js";
import { runQualityChecks, formatQualityReport } from "./quality-gates.js";
import { buildDesignContracts, generateUIContract, enrichStoriesWithDesignContract, validateDesignCompliance, generateLayoutSkeletons } from "./design-contract.js";
import { provisionDatabase, resolveDbType } from "./db-provision.js";
import { runBrowserDomCheck } from "./browser-tools.js";
import { TEST_FAIL_PATTERNS, GIT_DIFF_TIMEOUT } from "./constants.js";

// ── Test Failure Detection ──────────────────────────────────────────

/**
 * Check if agent output contains test failure patterns despite STATUS: done.
 * Returns failure message or null if clean.
 */
export function checkTestFailures(output: string): string | null {
  for (const pat of TEST_FAIL_PATTERNS) {
    const m = output.match(pat);
    if (m && parseInt(m[1], 10) > 0) {
      const failCount = parseInt(m[1], 10);
      return `GUARDRAIL: ${failCount} test failure(s) detected in output. Agent reported STATUS: done but tests are failing. Fix all tests before completing.`;
    }
  }
  return null;
}

// ── Quality Gate ────────────────────────────────────────────────────

/**
 * Run quality gate checks for implement/verify/final-test steps.
 * Returns failure message or null if clean.
 */
export function checkQualityGate(stepId: string, repoPath: string): string | null {
  if (stepId === "implement" || stepId === "verify" || stepId === "final-test") {
    if (repoPath) {
      const qualityIssues = runQualityChecks(repoPath);
      const errors = qualityIssues.filter(i => i.severity === "error");
      if (errors.length > 0) {
        const report = formatQualityReport(qualityIssues);
        return `GUARDRAIL: Quality gate failed — ${errors.length} error(s) detected.\n${report}\nFix these issues and retry.`;
      }
    }
  }
  return null;
}

// ── MISSING_INPUT_GUARD ─────────────────────────────────────────────

/**
 * Check for unresolved template variables in resolved input.
 * Returns list of missing variable names, or empty array if all resolved.
 */
export function checkMissingInputs(resolvedInput: string): string[] {
  return [...resolvedInput.matchAll(/\[missing:\s*(\w+)\]/gi)].map(m => m[1].toLowerCase());
}

// ── Design Contract Processing ──────────────────────────────────────

/**
 * Process design step completion: extract UI contracts, validate compliance.
 * Returns failure message if stitch/ has no HTML files, or null if OK.
 */
export function processDesignCompletion(
  runId: string,
  context: Record<string, string>,
  db: ReturnType<typeof getDb>
): string | null {
  const repoPath = context["repo"] || context["REPO"] || "";
  if (!repoPath) return null;

  // GUARDRAIL: Require at least 1 HTML file in stitch/ unless SCREENS_GENERATED: 0 (backend-only)
  const screensGenerated = parseInt(context["screens_generated"] || "-1", 10);
  if (screensGenerated !== 0) {
    const stitchDir = path.join(repoPath, "stitch");
    let htmlCount = 0;
    try {
      if (fs.existsSync(stitchDir)) {
        htmlCount = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html")).length;
      }
    } catch (e) {
      logger.warn(`[design-guardrail] Could not read stitch/ dir: ${String(e)}`, { runId });
    }
    if (htmlCount === 0) {
      const msg = `GUARDRAIL: Design step completed but stitch/ has 0 HTML files. Agent must generate and download at least 1 screen HTML before completing. Retry with Stitch generate-screen + download.`;
      logger.warn(`[design-guardrail] ${msg}`, { runId });
      return msg;
    }
    logger.info(`[design-guardrail] stitch/ has ${htmlCount} HTML file(s) — OK`, { runId });
  }

  try {
    const contracts = buildDesignContracts(repoPath);
    if (contracts.length > 0) {
      context["ui_contract"] = generateUIContract(contracts);
      context["layout_skeleton"] = generateLayoutSkeletons(repoPath, contracts);
      const contractPath = path.join(repoPath, "stitch", "UI_CONTRACT.json");
      fs.writeFileSync(contractPath, JSON.stringify(contracts, null, 2));
      enrichStoriesWithDesignContract(db, runId, contracts);
      logger.info(`[design-contract] UI contract: ${contracts.reduce((s: number, c: any) => s + c.totalInteractive, 0)} elements`, { runId });
    }
  } catch (e) {
    logger.warn(`[design-contract] Failed: ${String(e)}`, { runId });
  }

  // Design rules validation (advisory only — Stitch output cannot be controlled)
  try {
    const designIssues = validateDesignCompliance(repoPath);
    if (designIssues.length > 0) {
      const report = designIssues.map((i: string) => `  - ${i}`).join("\n");
      context["design_feedback"] = `DESIGN RULES NOTES:\n${report}\nAddress these during implementation if possible.`;
      logger.warn(`[design-rules] ${designIssues.length} violation(s) (advisory):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[design-rules] Validation failed: ${String(e)}`, { runId });
  }

  return null;
}

// ── DB Auto-Provisioning ────────────────────────────────────────────

/**
 * Process setup step completion: provision database if DB_REQUIRED is set.
 * Returns error message or null if successful.
 */
export function processSetupCompletion(
  context: Record<string, string>,
  runId: string
): string | null {
  const dbRequired = (context["db_required"] || "").toLowerCase();
  if (!dbRequired || dbRequired === "false" || dbRequired === "no" || dbRequired === "none") {
    return null;
  }
  try {
    const projectName = path.basename(context["repo"] || "project");
    const dbType = resolveDbType(dbRequired);
    const creds = provisionDatabase(projectName, dbType);
    context["database_url"] = creds.connectionString;
    context["db_type"] = creds.type;
    context["db_host"] = creds.host;
    context["db_port"] = String(creds.port);
    context["db_name"] = creds.database;
    context["db_user"] = creds.username;
    context["db_password"] = creds.password;
    logger.info(`[db-provision] Created ${creds.type} DB: ${creds.database} @ ${creds.host}:${creds.port}`, { runId });
    return null;
  } catch (e) {
    logger.error(`[db-provision] Failed: ${String(e)}`, { runId });
    return `DB provisioning failed: ${String(e)}. Check DB server connectivity and credentials.`;
  }
}

// ── Browser DOM Check ───────────────────────────────────────────────

/**
 * Process implement step completion: run browser DOM check if frontend changes detected.
 */
export function processBrowserCheck(
  context: Record<string, string>,
  runId: string,
  stepId: string
): void {
  const browserRepoPath = context["repo"] || context["REPO"] || "";
  if (!browserRepoPath || context["has_frontend_changes"] !== "true") return;
  try {
    const sessionName = `gate-${runId.slice(0, 8)}-${stepId}`;
    const browserResult = runBrowserDomCheck(browserRepoPath, sessionName);
    if (browserResult.domSnapshot) {
      context["browser_dom_snapshot"] = JSON.stringify(browserResult.domSnapshot);
    }
    if (browserResult.warnings.length > 0) {
      context["browser_check_result"] = "skipped: " + browserResult.warnings.join("; ");
    } else {
      context["browser_check_result"] = browserResult.passed ? "passed" : "issues_found";
    }
    const browserErrors = browserResult.issues.filter(i => i.severity === "error");
    if (browserErrors.length > 0) {
      const report = browserErrors.map(i => `  [${i.severity}] ${i.rule}: ${i.detail}`).join("\n");
      logger.warn(`[browser-dom-gate] ${browserErrors.length} error(s):\n${report}`, { runId });
    }
    const browserWarnings = browserResult.issues.filter(i => i.severity === "warning");
    if (browserWarnings.length > 0) {
      logger.info(`[browser-dom-gate] ${browserWarnings.length} warning(s)`, { runId });
    }
  } catch (e) {
    logger.warn(`[browser-dom-gate] Skipped: ${String(e)}`, { runId });
  }
}

// ── Frontend Change Detection ───────────────────────────────────────

/**
 * Compute whether a branch has frontend changes relative to main.
 * Returns 'true' or 'false' as a string for template context.
 */
export function computeHasFrontendChanges(repo: string, branch: string): string {
  try {
    const output = execFileSync("git", ["diff", "--name-only", `main..${branch}`], {
      cwd: repo,
      encoding: "utf-8",
      timeout: GIT_DIFF_TIMEOUT,
    });
    const files = output.trim().split("\n").filter(f => f.length > 0);
    return isFrontendChange(files) ? "true" : "false";
  } catch {
    return "false";
  }
}
