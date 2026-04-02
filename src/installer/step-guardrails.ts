/**
 * Step Guardrails
 *
 * Extracted from step-ops.ts — server-side checks that run independently of agents.
 * Prevents broken code from advancing through the pipeline.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pgGet, pgRun, pgQuery, now } from "../db-pg.js";
import { logger } from "../lib/logger.js";
import { isFrontendChange } from "../lib/frontend-detect.js";
import { runQualityChecks, formatQualityReport } from "./quality-gates.js";
import { buildDesignContracts, generateUIContract, enrichStoriesWithDesignContract, validateDesignCompliance, generateLayoutSkeletons, checkCrossScreenConsistency, checkDesignFidelity, detectUnusedModules, reconcileDesignWithStories, checkIntegrationWiring } from "./design-contract.js";
import { provisionDatabase, resolveDbType } from "./db-provision.js";
import { runBrowserDomCheck } from "./browser-tools.js";
import { TEST_FAIL_PATTERNS, GIT_DIFF_TIMEOUT } from "./constants.js";

// ── Test Failure Detection ──────────────────────────────────────────

/**
 * Check if agent output contains test failure patterns despite STATUS: done.
 * Returns failure message or null if clean.
 */
export function checkTestFailures(output: string): string | null {
  // Fix 4: Don't flag test failures if no test framework is installed
  // (agent may have tried to run tests but none existed — false positive)
  const noTestsPatterns = [
    /no tests? found/i,
    /no test suites? found/i,
    /command not found.*jest\b/i,
    /command not found.*vitest\b/i,
    /Cannot find module.*jest/i,
    /Cannot find module.*vitest/i,
    /ERR_MODULE_NOT_FOUND.*test/i,
  ];
  for (const noTestPat of noTestsPatterns) {
    if (noTestPat.test(output)) return null;
  }

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
  if (stepId === "implement" || stepId === "final-test") {
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
export async function processDesignCompletion(
  runId: string,
  context: Record<string, string>,
): Promise<string | null> {
  // v12.0: Design step is cloud-only. Validate SCREENS_GENERATED and STITCH_PROJECT_ID.
  const screensGenerated = parseInt(context["screens_generated"] || "-1", 10);
  const stitchProjectId = context["stitch_project_id"] || "";
  // STITCH_PROJECT_ID no longer required from agent — pipeline auto-creates
  if (!stitchProjectId) {
    logger.info(`[design-guardrail] No STITCH_PROJECT_ID — pipeline will auto-create`, { runId });
  }
  if (screensGenerated > 0) {
    logger.info(`[design-guardrail] ${screensGenerated} screen(s) generated in Stitch project ${stitchProjectId} — OK (HTML download deferred to setup)`, { runId });
  }

  // SCREEN_MAP enforcement: if missing, auto-recover from Stitch API (don't depend on agent)
  if (screensGenerated > 0) {
    let screenMapRaw = context["screen_map"];
    let needsRecovery = !screenMapRaw || screenMapRaw.trim() === "";
    if (!needsRecovery) {
      try {
        const sm = JSON.parse(screenMapRaw);
        if (!Array.isArray(sm) || sm.length === 0 || sm.some((s: any) => !s.screenId || !s.name)) {
          needsRecovery = true;
        }
      } catch {
        needsRecovery = true;
      }
    }
    if (needsRecovery && stitchProjectId) {
      logger.warn(`[design-guardrail] SCREEN_MAP missing or invalid. Auto-recovering from Stitch API (project ${stitchProjectId})...`, { runId });
      try {
        // P2-10: Use execFileSync instead of execSync to prevent shell injection
        const stitchScript = path.join(process.env.HOME || "", ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
        const raw = execFileSync("node", [stitchScript, "list-screens", stitchProjectId], { encoding: "utf8", timeout: 30000 });
        const screens = JSON.parse(raw);
        if (Array.isArray(screens) && screens.length > 0) {
          const screenMap = screens.map((s: any) => ({
            screenId: (s.name || "").replace(/^projects\/\d+\/screens\//, "") || s.id || s.screenId,
            name: s.title || s.displayName || "Untitled",
            type: (s.deviceType || "DESKTOP").toLowerCase(),
            description: s.title || s.displayName || "",
          }));
          context["screen_map"] = JSON.stringify(screenMap);
          logger.info(`[design-guardrail] SCREEN_MAP auto-recovered: ${screenMap.length} screen(s) from Stitch API`, { runId });
        } else {
          logger.warn(`[design-guardrail] Stitch API returned 0 screens for project ${stitchProjectId}`, { runId });
        }
      } catch (e: any) {
        logger.warn(`[design-guardrail] SCREEN_MAP auto-recovery failed: ${e.message}`, { runId });
      }
    } else if (!needsRecovery) {
      const sm = JSON.parse(context["screen_map"]);
      logger.info(`[design-guardrail] SCREEN_MAP valid: ${sm.length} screen(s)`, { runId });
    }
  }

  // v12.0: Contract building, design rules validation, and story enrichment
  // are ALL deferred to setup step completion (processSetupDesignContracts).
  // This ensures stitch/ HTML files exist locally before parsing.
  logger.info(`[design-contract] Deferred to setup step (design-first pipeline)`, { runId });

  // Persist stitch artifacts to MC stitch-cache for screenshot display
  // (worktree gets deleted after run completes, so cache survives)
  if (stitchProjectId && screensGenerated > 0) {
    try {
      const repoPath = context["repo"] || "";
      if (repoPath) {
        const stitchDir = path.join(repoPath, "stitch");
        const cacheDir = path.join(process.env.HOME || "/home/setrox", ".openclaw/setfarm/stitch-cache", stitchProjectId);
        if (fs.existsSync(stitchDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
          for (const f of fs.readdirSync(stitchDir)) {
            if (f.endsWith(".png") || f === "DESIGN_MANIFEST.json") {
              fs.copyFileSync(path.join(stitchDir, f), path.join(cacheDir, f));
            }
          }
          logger.info(`[design-guardrail] Persisted stitch artifacts to ${cacheDir}`, { runId });
        }
      }
    } catch (e: any) {
      logger.warn(`[design-guardrail] Failed to persist stitch artifacts: ${e.message}`, { runId });
    }
  }

  return null;
}

// ── Design Contract Building (setup step) ───────────────────────────

/**
 * Process setup step completion: build design contracts after HTML download.
 * v12.0: This runs AFTER setup step downloads Stitch HTML files into stitch/ dir.
 * Advisory-only — errors are logged but do not fail the step.
 */
export async function processSetupDesignContracts(
  runId: string,
  context: Record<string, string>,
): Promise<string | null> {
  const repoPath = context["repo"] || context["REPO"] || "";
  logger.info(`[setup-design-contracts] ENTERING guardrail: repo=${repoPath} stitch_project_id=${context["stitch_project_id"]} screens_generated=${context["screens_generated"]}`, { runId });
  if (!repoPath) {
    logger.info(`[setup-design-contracts] Skipped — no repo path`, { runId });
    return null;
  }

  const stitchDir = path.join(repoPath, "stitch");
  const stitchProjectId = context["stitch_project_id"] || "";
  const screensGenerated = parseInt(context["screens_generated"] || "0", 10);
  const designExpected = stitchProjectId && screensGenerated > 0;

  if (!fs.existsSync(stitchDir)) {
    if (designExpected) {
      const msg = `GUARDRAIL: Design step generated ${screensGenerated} screen(s) in Stitch project ${stitchProjectId} but stitch/ directory does not exist. Setup step failed to download design files.`;
      logger.error(`[setup-design-contracts] ${msg}`, { runId });
      return msg;
    }
    logger.info(`[setup-design-contracts] Skipped — no stitch/ directory (non-UI project or design step skipped)`, { runId });
    return null;
  }

  const htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"));
  if (htmlFiles.length === 0) {
    if (designExpected) {
      const msg = `GUARDRAIL: Design step generated ${screensGenerated} screen(s) but stitch/ has 0 HTML files. Download failed silently.`;
      logger.error(`[setup-design-contracts] ${msg}`, { runId });
      return msg;
    }
    logger.info(`[setup-design-contracts] Skipped — stitch/ has no HTML files`, { runId });
    return null;
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
      await enrichStoriesWithDesignContract(runId, contracts);

      logger.info(`[setup-design-contracts] UI contract: ${contracts.reduce((s: number, c: any) => s + c.totalInteractive, 0)} elements`, { runId });

      // 6. Precise story-screen mapping via SCREEN_MAP
      const screenMapRaw = context["screen_map"];
      if (screenMapRaw) {
        try {
          let screenMap = JSON.parse(screenMapRaw);

          // Format normalization: PRD Generator sends {"Screen Name": "screenId"}
          // Pipeline expects [{"screenId":"xxx", "name":"yyy", "stories":["US-xxx"]}]
          if (!Array.isArray(screenMap) && typeof screenMap === "object") {
            // Old format: convert to new format using DESIGN_MANIFEST.json
            const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
            let manifestScreens: any[] = [];
            try {
              const raw = fs.readFileSync(manifestPath, "utf-8");
              const parsed = JSON.parse(raw);
              manifestScreens = Array.isArray(parsed) ? parsed : (parsed.screens || []);
            } catch {}

            const allStories = await pgQuery<any>("SELECT story_id, title FROM stories WHERE run_id = $1", [runId]);
            const converted: any[] = [];

            for (const [screenName, screenId] of Object.entries(screenMap)) {
              // Find matching stories by keyword overlap between screen name and story title
              const nameWords = screenName.toLowerCase().split(/[\s\-]+/).filter((w: string) => w.length > 2);
              const matchedStories = allStories
                .filter((s: any) => {
                  const titleLower = s.title.toLowerCase();
                  return nameWords.some((w: string) => titleLower.includes(w));
                })
                .map((s: any) => s.story_id);

              // Find HTML file from manifest or guess by screenId
              let htmlFile = screenId + ".html";
              const manifestEntry = manifestScreens.find((m: any) => m.id === screenId || m.title === screenName);
              if (manifestEntry?.file) htmlFile = manifestEntry.file;

              converted.push({
                screenId: screenId as string,
                name: screenName,
                type: "page",
                htmlFile: "stitch/" + htmlFile,
                stories: matchedStories.length > 0 ? matchedStories : [],
              });
            }

            // If no story matches found, distribute screens across stories sequentially
            if (converted.every(s => s.stories.length === 0) && allStories.length > 0) {
              for (let i = 0; i < converted.length; i++) {
                const storyIdx = Math.min(i, allStories.length - 1);
                converted[i].stories = [allStories[storyIdx].story_id];
              }
            }

            screenMap = converted;
            context["screen_map"] = JSON.stringify(screenMap);
            await pgRun("UPDATE runs SET context = $1 WHERE id = $2", [JSON.stringify(context), runId]);
            logger.info("[setup-design-contracts] Converted old SCREEN_MAP format to array format: " + converted.length + " screens", { runId });
          }

          for (const screen of screenMap) {
            if (!Array.isArray(screen.stories)) continue;
            for (const storyId of screen.stories) {
              const row = await pgGet<any>("SELECT id, acceptance_criteria FROM stories WHERE run_id = $1 AND story_id = $2", [runId, storyId]);
              if (!row) continue;
              const criterion = `Must implement screen ${screen.screenId} (${screen.name}) — read stitch/${screen.screenId}.html`;
              if (!row.acceptance_criteria.includes(screen.screenId)) {
                // v1.5.53: Parse as JSON array before appending (was raw string concat → broke JSON)
                let acArr: string[] = [];
                try { acArr = JSON.parse(row.acceptance_criteria); } catch { acArr = [row.acceptance_criteria]; }
                acArr.push(criterion);
                const updated = JSON.stringify(acArr);
                await pgRun("UPDATE stories SET acceptance_criteria = $1, updated_at = $2 WHERE id = $3", [updated, now(), row.id]);
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

  // 7.5. Cross-screen design consistency check (advisory)
  try {
    const crossScreenIssues = checkCrossScreenConsistency(repoPath);
    if (crossScreenIssues.length > 0) {
      const report = crossScreenIssues.map((i: string) => `  - ${i}`).join("\n");
      const existing = context["design_feedback"] || "";
      context["design_feedback"] = existing + (existing ? "\n" : "") + `CROSS-SCREEN CONSISTENCY:\n${report}\nUse a SINGLE unified palette and font family.`;
      logger.warn(`[setup-design-contracts] ${crossScreenIssues.length} cross-screen inconsistency(ies):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[setup-design-contracts] Cross-screen check skipped: ${String(e)}`, { runId });
  }

  // 7.6. Design↔Stories reconciliation (advisory — log orphaned design elements)
  try {
    const stories = await pgQuery<{ storyId: string; title: string; description: string }>(
      "SELECT story_id as storyId, title, description FROM stories WHERE run_id = $1", [runId]
    );
    const prd = context["prd"] || "";
    const orphanedElements = reconcileDesignWithStories(repoPath, stories, prd);
    if (orphanedElements.length > 0) {
      const report = orphanedElements.map(e => `  - [${e.screen}] ${e.type}: "${e.label}"`).join("\n");
      const existing = context["design_feedback"] || "";
      context["design_feedback"] = existing + (existing ? "\n" : "") + `ORPHANED DESIGN ELEMENTS (in Stitch design but no matching story/PRD):\n${report}\nThese elements may need implementation or stories created.`;
      logger.warn(`[setup-design-contracts] ${orphanedElements.length} orphaned design element(s):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[setup-design-contracts] Design reconciliation skipped: ${String(e)}`, { runId });
  }

  // 7.7. Persist story_screens to DB for each story
  try {
    const screenMapRaw2 = context["screen_map"];
    if (screenMapRaw2) {
      const screenMap2 = JSON.parse(screenMapRaw2);
      if (Array.isArray(screenMap2)) {
        const allStories = await pgQuery<{ id: string; story_id: string }>(
          "SELECT id, story_id FROM stories WHERE run_id = $1", [runId]
        );
        for (const story of allStories) {
          const storyScreens = screenMap2
            .filter((s: any) => Array.isArray(s.stories) && s.stories.includes(story.story_id))
            .map((s: any) => ({ screenId: s.screenId, name: s.name, type: s.type }))
            .filter((s: any) => {
              // Fix: Validate screenId HTML file exists in stitch/ dir — skip phantom references from prior runs
              const htmlPath = path.join(stitchDir, `${s.screenId}.html`);
              if (!fs.existsSync(htmlPath)) {
                logger.warn(`[setup-design-contracts] Skipping phantom screenId "${s.screenId}" for story ${story.story_id} — ${htmlPath} not found`, { runId });
                return false;
              }
              return true;
            });
          if (storyScreens.length > 0) {
            await pgRun("UPDATE stories SET story_screens = $1, updated_at = $2 WHERE id = $3", [JSON.stringify(storyScreens), now(), story.id]);
          }
        }
        logger.info(`[setup-design-contracts] Persisted story_screens to DB for ${allStories.length} stories`, { runId });
      }
    }
  } catch (e) {
    logger.warn(`[setup-design-contracts] story_screens persist failed: ${String(e)}`, { runId });
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

  // 9. Last resort: generate SCREEN_MAP + DESIGN_MANIFEST.json from stitch/*.html files
  if (!context["screen_map"] && htmlFiles.length > 0) {
    try {
      const autoScreenMap = htmlFiles.map(f => ({
        screenId: f.replace(".html", ""),
        name: f.replace(".html", "").replace(/[-_]/g, " ") || "Screen",
        type: "page",
        stories: [],
      }));
      context["screen_map"] = JSON.stringify(autoScreenMap);

      // Also write DESIGN_MANIFEST.json so MC API can find it
      const manifest = htmlFiles.map(f => ({
        screenId: f.replace(".html", ""),
        title: f.replace(".html", ""),
        htmlFile: f,
        type: "page",
      }));
      const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
      // Only write manifest if PRD Generator hasnt already placed one
      let hasExisting = false;
      try { const em = JSON.parse(fs.readFileSync(manifestPath, "utf-8")); hasExisting = Array.isArray(em) ? em.length > 0 : (em.screens?.length > 0); } catch {}
      if (!hasExisting) { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); } else { logger.info("[setup-design-contracts] DESIGN_MANIFEST.json already has content — not overwriting", { runId }); }

      logger.info(`[setup-design-contracts] Auto-generated SCREEN_MAP + DESIGN_MANIFEST.json from ${htmlFiles.length} stitch HTML file(s)`, { runId });
    } catch (e) {
      logger.warn(`[setup-design-contracts] Stitch HTML fallback failed: ${String(e)}`, { runId });
    }
  }

  // BLOCKING GATE: Validate manifest + HTML when design was expected
  const screensGen = parseInt(context["screens_generated"] || "0", 10);
  if (screensGen > 0) {
    const mPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
    let manifestCount = 0;
    try {
      const mData = JSON.parse(fs.readFileSync(mPath, "utf-8"));
      manifestCount = Array.isArray(mData) ? mData.length : (mData.screens?.length || 0);
    } catch {}
    const htmlFiles2 = fs.readdirSync(path.join(repoPath, "stitch")).filter((f: string) => f.endsWith(".html"));
    if (manifestCount === 0 && htmlFiles2.length === 0) {
      return `GUARDRAIL FAIL: DESIGN_MANIFEST is empty and stitch/ has 0 HTML files. ${screensGen} screens were expected. Design download failed completely.`;
    }
    if (htmlFiles2.length < screensGen * 0.5) {
      return `GUARDRAIL FAIL: Expected ${screensGen} screen HTML files, found ${htmlFiles2.length} (${Math.round((1 - htmlFiles2.length / screensGen) * 100)}% missing). Design download incomplete.`;
    }
  }

  // Generate DESIGN_DOM.json for element-level fidelity
  try {
    const { generateDesignDOM } = await import("./design-contract.js");
    if (generateDesignDOM(repoPath)) {
      logger.info(`[setup-design-contracts] DESIGN_DOM.json generated`, { runId });
    }
  } catch (e) {
    logger.warn(`[setup-design-contracts] DESIGN_DOM generation skipped: ${String(e)}`, { runId });
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
  let dbRequired = (context["db_required"] || "").toLowerCase();

  // Only provision DB when explicitly requested by planner (DB_REQUIRED: postgres|sqlite)
  // No auto-detection from PRD text or package.json
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
  const hasUiKeywords = ((context["has_ui"] || "").toLowerCase() === "true" || ["ui", "fullstack"].includes((context["project_type"] || "").toLowerCase()));

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
// ── Design Fidelity Check (verify/final-test step) ──────────────────

/**
 * Run design fidelity + unused module + integration wiring checks.
 * Advisory only — populates context with feedback for agent.
 */
export async function processDesignFidelityCheck(
  context: Record<string, string>,
  runId: string
): Promise<string | null> {
  const repoPath = context["repo"] || context["REPO"] || "";
  if (!repoPath) return null;

  const stitchDir = path.join(repoPath, "stitch");
  if (!fs.existsSync(stitchDir)) return null;

  const feedbackParts: string[] = [];

  // 1. Design fidelity (Stitch HTML vs built code)
  try {
    const fidelityIssues = checkDesignFidelity(repoPath);
    const errors = fidelityIssues.filter(i => i.severity === "error");
    const warnings = fidelityIssues.filter(i => i.severity === "warning");
    if (errors.length > 0 || warnings.length > 0) {
      const report = fidelityIssues.map(i => `  [${i.severity}] ${i.screen}: ${i.message}`).join("\n");
      feedbackParts.push(`DESIGN FIDELITY (${errors.length} errors, ${warnings.length} warnings):\n${report}`);
      logger.warn(`[design-fidelity] ${fidelityIssues.length} issue(s):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[design-fidelity] Check skipped: ${String(e)}`, { runId });
  }

  // 2. Unused module detection
  try {
    const unusedModules = detectUnusedModules(repoPath);
    if (unusedModules.length > 0) {
      const report = unusedModules.map(m => `  - ${m}`).join("\n");
      feedbackParts.push(`UNUSED MODULES (created but never imported — possible dead code):\n${report}\nEither import these in the entry point or remove them.`);
      logger.warn(`[unused-modules] ${unusedModules.length} unused module(s):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[unused-modules] Check skipped: ${String(e)}`, { runId });
  }

  // 3. Integration wiring check
  try {
    const wiringIssues = checkIntegrationWiring(repoPath);
    if (wiringIssues.length > 0) {
      const report = wiringIssues.map(i => `  - ${i}`).join("\n");
      feedbackParts.push(`INTEGRATION WIRING (modules not connected to entry point):\n${report}\nThe integration story must import and use ALL component modules.`);
      logger.warn(`[integration-wiring] ${wiringIssues.length} issue(s):\n${report}`, { runId });
    }
  } catch (e) {
    logger.warn(`[integration-wiring] Check skipped: ${String(e)}`, { runId });
  }

  // DOM Compare: DESIGN_DOM.json vs actual browser DOM
  const designDomPath = path.join(repoPath, "stitch", "DESIGN_DOM.json");
  if (fs.existsSync(designDomPath) && context["browser_dom_snapshot"]) {
    try {
      const actualDom = JSON.parse(context["browser_dom_snapshot"]);
      const { compareDesignVsActual } = await import("./design-contract.js");
      const comparison = compareDesignVsActual(designDomPath, actualDom);
      if (comparison.score < 60) {
        const msg = `DESIGN FIDELITY SCORE: ${comparison.score}/100 (threshold: 60)\n${comparison.issues.join("\n")}`;
        feedbackParts.push(msg);
      } else if (comparison.issues.length > 0) {
        feedbackParts.push(`Design fidelity score: ${comparison.score}/100\n${comparison.issues.join("\n")}`);
      }
    } catch (e) {
      logger.warn(`[design-fidelity] DOM compare failed: ${String(e)}`, { runId });
    }
  }

  if (feedbackParts.length > 0) {
    context["design_fidelity_feedback"] = feedbackParts.join("\n\n");
  }

  // BLOCKING: structural gaps or integration wiring errors fail the step
  const structuralErrors = feedbackParts.filter(p => p.includes("Structural gap") || p.includes("INTEGRATION WIRING"));
  if (structuralErrors.length > 0) {
    return `GUARDRAIL FAIL: Design fidelity check found critical issues:\n${structuralErrors.join("\n")}\nFix structural gaps and integration wiring before advancing.`;
  }

  return null;
}

// ── Frontend Change Detection ───────────────────────────────────────

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

// ── Story-Level Design Compliance Check ─────────────────────────────

/**
 * Check if a completed story respects stitch design tokens.
 * Returns failure message if design-tokens.css exists but is not imported,
 * or if too many hardcoded hex colors are used. Null if OK or N/A.
 */
export function checkStoryDesignCompliance(
  context: Record<string, string>,
): string | null {
  const repo = context["repo"] || "";
  const workdir = context["story_workdir"] || repo;
  if (!workdir) return null;

  const stitchDir = path.join(repo, "stitch");
  if (!fs.existsSync(stitchDir)) return null;
  if (!fs.existsSync(path.join(stitchDir, "design-tokens.css"))) return null;

  // Only check if src/ directory exists in workdir
  const srcDir = path.join(workdir, "src");
  if (!fs.existsSync(srcDir)) return null;

  const issues: string[] = [];

  // 1. design-tokens.css imported/referenced?
  try {
    const result = execFileSync("grep", ["-rl", "design-tokens", srcDir, "--include=*.ts", "--include=*.tsx", "--include=*.jsx", "--include=*.js", "--include=*.css", "--include=*.scss"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!result) {
      issues.push("design-tokens.css hiçbir dosyada import/referans edilmemiş");
    }
  } catch (err: any) {
    // P2-04b: exit code 1 = no matches (genuine miss), code 2 = grep error
    if (err?.status === 2) {
      logger.warn('[design-compliance] grep error (not a match issue)', {});
    }
    // Check CSS entry files as fallback before reporting
    const cssEntries = ['index.css', 'main.css', 'App.css', 'global.css', 'globals.css'];
    const hasEntryImport = cssEntries.some((f: string) => {
      try { return fs.existsSync(path.join(srcDir, f)) && fs.readFileSync(path.join(srcDir, f), 'utf-8').includes('design-tokens'); }
      catch { return false; }
    });
    if (!hasEntryImport) {
      issues.push("design-tokens.css hiçbir dosyada import/referans edilmemiş");
    }
  }

  // 2. Too many hardcoded hex colors?
  try {
    const hexResult = execFileSync("grep", [
      "-roh", "#[0-9a-fA-F]\\{3,8\\}",
      srcDir,
      "--include=*.css", "--include=*.tsx", "--include=*.jsx",
      "--include=*.ts", "--include=*.js",
    ], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const uniqueColors = new Set(hexResult.split("\n").filter(Boolean));
    if (uniqueColors.size > 10) {
      issues.push(`${uniqueColors.size} farklı hardcoded hex renk — design-tokens kullan`);
    }
  } catch { /* no matches is fine */ }

  if (issues.length === 0) return null;

  return `DESIGN UYUMSUZLUK:\n${issues.map(i => "• " + i).join("\n")}\nDÜZELT: stitch/design-tokens.css'i import et, hardcoded renkleri var(--*) ile değiştir.`;
}


// ── Import Consistency & Duplicate Directory Guard ───────────────────

/**
 * Detect duplicate directories that differ only in plural form (e.g., context/ vs contexts/).
 * Also checks for import inconsistencies where the same logical module is imported
 * from different paths across files.
 */
export function checkImportConsistency(repoPath: string): string | null {
  const srcDir = path.join(repoPath, "src");
  if (!fs.existsSync(srcDir)) return null;

  const issues: string[] = [];

  // 1. Duplicate directory detection (singular vs plural, typos)
  function findDuplicateDirs(dir: string, depth: number): void {
    if (depth > 3) return;
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }
    
    const dirs = entries.filter(e => {
      try { return fs.statSync(path.join(dir, e)).isDirectory(); } catch { return false; }
    });

    // Check for similar directory names
    for (let i = 0; i < dirs.length; i++) {
      for (let j = i + 1; j < dirs.length; j++) {
        const a = dirs[i]!.toLowerCase();
        const b = dirs[j]!.toLowerCase();
        // Singular/plural match (context vs contexts, util vs utils, type vs types, etc.)
        if (a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a) {
          const relDir = path.relative(repoPath, dir);
          issues.push(`DUPLICATE DIRECTORY: ${relDir}/${dirs[i]} vs ${relDir}/${dirs[j]} — agents created both singular and plural variants. Consolidate into one.`);
        }
      }
    }

    for (const d of dirs) {
      if (d !== "node_modules" && !d.startsWith(".")) {
        findDuplicateDirs(path.join(dir, d), depth + 1);
      }
    }
  }

  findDuplicateDirs(srcDir, 0);

  // 2. Import path consistency — check that same-named exports come from same path
  const importMap = new Map<string, Set<string>>(); // exportName -> Set<importPaths>
  function scanImports(dir: string, depth: number): void {
    if (depth > 4) return;
    let entries: string[];
    try { entries = fs.readdirSync(dir); } catch { return; }
    
    for (const e of entries) {
      const full = path.join(dir, e);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      
      if (stat.isDirectory() && e !== "node_modules" && !e.startsWith(".")) {
        scanImports(full, depth + 1);
        continue;
      }
      
      if (!e.endsWith(".tsx") && !e.endsWith(".ts")) continue;
      if (e.endsWith(".test.tsx") || e.endsWith(".test.ts") || e.endsWith(".d.ts")) continue;
      
      let fileContent: string;
      try { fileContent = fs.readFileSync(full, "utf-8"); } catch { continue; }
      
      // Match: import { X } from './path' or import { X } from '../path'
      const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g;
      let m;
      while ((m = importRegex.exec(fileContent)) !== null) {
        const names = m[1]!.split(",").map(n => n.trim().split(/\s+as\s+/)[0]!.trim()).filter(Boolean);
        const importPath = m[2]!;
        for (const name of names) {
          if (!importMap.has(name)) importMap.set(name, new Set());
          // Normalize: resolve relative to file location
          const resolved = path.resolve(path.dirname(full), importPath);
          const relResolved = path.relative(repoPath, resolved);
          importMap.get(name)!.add(relResolved);
        }
      }
    }
  }

  scanImports(srcDir, 0);

  // Find exports imported from multiple different paths
  for (const [name, paths] of importMap) {
    if (paths.size > 1) {
      // Filter: only flag if paths look like they should be the same module (same filename)
      const basenames = [...paths].map(p => path.basename(p));
      const uniqueBasenames = new Set(basenames);
      if (uniqueBasenames.size === 1) {
        issues.push(`IMPORT INCONSISTENCY: "${name}" is imported from ${paths.size} different paths: ${[...paths].join(", ")} — all files should import from the same module.`);
      }
    }
  }

  if (issues.length === 0) return null;
  return "GUARDRAIL FAIL: Import consistency check found issues:\n" + issues.join("\n");
}
