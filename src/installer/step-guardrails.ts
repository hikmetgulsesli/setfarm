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
 * Process design step completion: cloud-only validation.
 * v12.0: Design step runs in the cloud (no repo access). HTML download happens in setup step.
 * Contract building is deferred to processSetupDesignContracts().
 */
export function processDesignCompletion(
  runId: string,
  context: Record<string, string>,
  db: ReturnType<typeof getDb>
): string | null {
  // v12.0: Design step is cloud-only. Validate SCREENS_GENERATED and STITCH_PROJECT_ID.
  const screensGenerated = parseInt(context["screens_generated"] || "-1", 10);
  const stitchProjectId = context["stitch_project_id"] || "";
  if (screensGenerated !== 0 && !stitchProjectId) {
    const msg = `GUARDRAIL: Design step completed with SCREENS_GENERATED > 0 but no STITCH_PROJECT_ID. Agent must output STITCH_PROJECT_ID for setup step to download HTML files.`;
    logger.warn(`[design-guardrail] ${msg}`, { runId });
    return msg;
  }
  if (screensGenerated > 0) {
    logger.info(`[design-guardrail] ${screensGenerated} screen(s) generated in Stitch project ${stitchProjectId} — OK (HTML download deferred to setup)`, { runId });
  }

  // v12.0: Contract building, design rules validation, and story enrichment
  // are ALL deferred to setup step completion (processSetupDesignContracts).
  // This ensures stitch/ HTML files exist locally before parsing.
  logger.info(`[design-contract] Deferred to setup step (design-first pipeline)`, { runId });

  return null;
}

// ── Design Contract Building (setup step) ───────────────────────────

/**
 * Process setup step completion: build design contracts after HTML download.
 * v12.0: This runs AFTER setup step downloads Stitch HTML files into stitch/ dir.
 * Advisory-only — errors are logged but do not fail the step.
 */
export function processSetupDesignContracts(
  runId: string,
  context: Record<string, string>,
  db: ReturnType<typeof getDb>
): void {
  const repoPath = context["repo"] || context["REPO"] || "";
  if (!repoPath) {
    logger.info(`[setup-design-contracts] Skipped — no repo path`, { runId });
    return;
  }

  const stitchDir = path.join(repoPath, "stitch");
  if (!fs.existsSync(stitchDir)) {
    logger.info(`[setup-design-contracts] Skipped — no stitch/ directory (non-UI project or design step skipped)`, { runId });
    return;
  }

  const htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"));
  if (htmlFiles.length === 0) {
    logger.info(`[setup-design-contracts] Skipped — stitch/ has no HTML files`, { runId });
    return;
  }

  logger.info(`[setup-design-contracts] Building design contracts from ${htmlFiles.length} HTML file(s)`, { runId });

  // 1. Build design contracts from stitch/*.html
  try {
    const contracts = buildDesignContracts(repoPath);
    if (contracts.length > 0) {
      // 2. Generate UI contract
      context["ui_contract"] = generateUIContract(contracts);

      // 3. Generate layout skeletons
      context["layout_skeleton"] = generateLayoutSkeletons(repoPath, contracts);

      // 4. Write UI_CONTRACT.json
      const contractPath = path.join(stitchDir, "UI_CONTRACT.json");
      fs.writeFileSync(contractPath, JSON.stringify(contracts, null, 2));

      // 5. Enrich stories with design criteria
      enrichStoriesWithDesignContract(db, runId, contracts);

      logger.info(`[setup-design-contracts] UI contract: ${contracts.reduce((s: number, c: any) => s + c.totalInteractive, 0)} elements`, { runId });

      // 6. Precise story-screen mapping via SCREEN_MAP
      const screenMapRaw = context["screen_map"];
      if (screenMapRaw) {
        try {
          const screenMap = JSON.parse(screenMapRaw);
          for (const screen of screenMap) {
            if (!Array.isArray(screen.stories)) continue;
            for (const storyId of screen.stories) {
              const row = db.prepare(
                "SELECT id, acceptance_criteria FROM stories WHERE run_id = ? AND story_id = ?"
              ).get(runId, storyId) as any;
              if (!row) continue;
              const criterion = `Must implement screen ${screen.screenId} (${screen.name}) — read stitch/${screen.screenId}.html`;
              if (!row.acceptance_criteria.includes(screen.screenId)) {
                const updated = row.acceptance_criteria + `\n- [SCREEN] ${criterion}`;
                db.prepare("UPDATE stories SET acceptance_criteria = ?, updated_at = ? WHERE id = ?")
                  .run(updated, new Date().toISOString(), row.id);
              }
            }
          }
          logger.info(`[setup-design-contracts] Story-screen enrichment completed`, { runId });
        } catch (e) {
          logger.warn(`[setup-design-contracts] screen_map enrichment failed: ${String(e)}`, { runId });
        }
      }
    }
  } catch (e) {
    logger.warn(`[setup-design-contracts] Contract building failed (advisory): ${String(e)}`, { runId });
  }

  // 7. Design rules validation (advisory only)
  try {
    const designIssues = validateDesignCompliance(repoPath);
    if (designIssues.length > 0) {
      const report = designIssues.map((i: string) => `  - ${i}`).join("\n");
      context["design_feedback"] = `DESIGN RULES NOTES:\n${report}\nAddress these during implementation if possible.`;
      logger.warn(`[setup-design-contracts] ${designIssues.length} design rule violation(s) (advisory):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[setup-design-contracts] Design validation skipped: ${String(e)}`, { runId });
  }

  // 8. DESIGN_MANIFEST.json → SCREEN_MAP auto-generate fallback
  if (!context["screen_map"]) {
    try {
      const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        if (Array.isArray(manifest) && manifest.length > 0) {
          const autoScreenMap = manifest.map((entry: any) => ({
            screenId: entry.screenId || entry.htmlFile?.replace(".html", "") || "unknown",
            name: entry.title || "Untitled",
            stories: [], // no story binding — implement step will use fallback
          }));
          context["screen_map"] = JSON.stringify(autoScreenMap);
          logger.info(`[setup-design-contracts] Auto-generated SCREEN_MAP from DESIGN_MANIFEST.json (${autoScreenMap.length} screens)`, { runId });
        }
      }
    } catch (e) {
      logger.warn(`[setup-design-contracts] SCREEN_MAP auto-generate failed: ${String(e)}`, { runId });
    }
  }
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

// ── SCREEN_MAP Enforcement (plan step) ───────────────────────────────

/**
 * Verify that plan step output includes a valid SCREEN_MAP.
 * Returns failure message if missing/invalid, or null if OK.
 * Only enforced for UI projects (stories with UI-related keywords).
 */
export function checkScreenMapPresence(
  context: Record<string, string>,
  output: string
): string | null {
  const screenMapRaw = context["screen_map"];
  // v12.0: stories field is optional (design step doesn't have stories yet)
  if (screenMapRaw) {
    try {
      const screenMap = JSON.parse(screenMapRaw);
      if (!Array.isArray(screenMap) || screenMap.length === 0) {
        return "GUARDRAIL: SCREEN_MAP is empty array. Must identify unique screens. Retry with valid SCREEN_MAP.";
      }
      // Validate structure
      for (const screen of screenMap) {
        if (!screen.screenId || !screen.name) {
          return "GUARDRAIL: SCREEN_MAP entries must have screenId and name. Fix SCREEN_MAP format.";
        }
      }
      return null; // Valid SCREEN_MAP
    } catch (e) {
      return "GUARDRAIL: SCREEN_MAP is not valid JSON. Fix SCREEN_MAP format.";
    }
  }

  // Check if this is a UI project
  const hasUiKeywords = /(ui|page|screen|component|frontend|button|form|dashboard|layout|css|html|react|next|vue|angular|svelte)/i.test(output);

  if (hasUiKeywords) {
    return "GUARDRAIL: Step completed without SCREEN_MAP but project has UI elements. Must output SCREEN_MAP. Retry.";
  }

  // Backend-only project — SCREEN_MAP not required
  return null;
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
