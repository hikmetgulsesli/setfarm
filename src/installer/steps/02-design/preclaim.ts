import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

// Heavy work BEFORE agent claims the design step:
// 1. ensure-project (Stitch project for this repo)
// 2. write PRD as Stitch prompt
// 3. generate-all-screens (one Stitch API call for entire screen set)
// 4. download-all (3 retries + tracking-file fallback)
// Agent then validates the result — never calls Stitch API itself.
//
// Idempotent: if stitch/ already has HTML files, skips entirely.
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  const prd = ctx.context["prd"] || ctx.context["PRD"] || "";
  const stitchDir = repo ? path.join(repo, "stitch") : "";
  if (!repo || !prd || !stitchDir) return;

  const existingHtml = fs.existsSync(stitchDir)
    ? fs.readdirSync(stitchDir).filter(f => f.endsWith(".html")).length
    : 0;
  if (existingHtml > 0) {
    logger.info(`[module:design preclaim] Skip — ${existingHtml} HTML already in ${stitchDir}`, { runId: ctx.runId });
    return;
  }

  const stitchScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/stitch-api.mjs");
  fs.mkdirSync(stitchDir, { recursive: true });

  // 1. Ensure Stitch project (idempotent — reads .stitch if present)
  let projId = "";
  try {
    const dotStitch = path.join(repo, ".stitch");
    if (fs.existsSync(dotStitch)) {
      projId = JSON.parse(fs.readFileSync(dotStitch, "utf-8")).projectId || "";
    }
  } catch (e) { logger.debug(`[module:design preclaim] dotStitch read: ${String(e).slice(0, 80)}`); }

  if (!projId) {
    try {
      const out = execFileSync("node", [stitchScript, "ensure-project", path.basename(repo), repo],
        { encoding: "utf-8", timeout: 30000, cwd: repo });
      try { projId = JSON.parse(out).projectId || ""; } catch (e) { logger.debug(`[module:design preclaim] parse: ${String(e).slice(0, 80)}`); }
    } catch (e) { logger.warn(`[module:design preclaim] ensure-project failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId }); }
  }

  if (!projId) {
    logger.warn(`[module:design preclaim] no Stitch project — skipping generation, agent will see empty stitch/`, { runId: ctx.runId });
    return;
  }

  ctx.context["stitch_project_id"] = projId;

  // 2. Write PRD + mandatory-screens primer as Stitch prompt
  const promptFile = path.join(stitchDir, ".generate-prompt.txt");
  const deviceType = ctx.context["device_type"] || "DESKTOP";
  const screenPrimer = `

Generate a SEPARATE screen design for EVERY page, view, modal, dialog, tab panel, and settings screen described in this PRD. Do NOT skip ANY screen — even if it seems minor.

MANDATORY SCREENS:
- If the PRD mentions "settings" or "ayarlar" → generate a Settings screen
- If the PRD mentions tabs or bottom navigation → generate EACH tab view as a separate screen
- If the PRD mentions modals (statistics, help, share, confirmation) → generate each as a separate screen
- If the PRD mentions error states, empty states, loading states → generate those too
- Generate at least as many screens as there are distinct views/pages/modals in the PRD

All visible text must be in Turkish. Use a dark, modern theme.`;
  fs.writeFileSync(promptFile, prd + screenPrimer);
  logger.info(`[module:design preclaim] Generating screens (project ${projId}, device ${deviceType})`, { runId: ctx.runId });

  // 3. generate-all-screens (single batch call)
  try {
    const genOut = execFileSync("node", [stitchScript, "generate-all-screens", projId, promptFile, deviceType, "GEMINI_3_1_PRO"],
      { encoding: "utf-8", timeout: 600000, cwd: repo });
    let genResult: any = {};
    try { genResult = JSON.parse(genOut); } catch (e) { logger.debug(`[module:design preclaim] gen parse: ${String(e).slice(0, 80)}`); }
    logger.info(`[module:design preclaim] Generated ${genResult.total || 0} screens in ${genResult.elapsedSeconds || "?"}s`, { runId: ctx.runId });
  } catch (e) {
    logger.warn(`[module:design preclaim] generate-all-screens failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }

  // 4. download-all with 3 retries (Stitch API can lag after generation)
  let htmlCount = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const dlOut = execFileSync("node", [stitchScript, "download-all", projId, stitchDir],
        { encoding: "utf-8", timeout: 180000, cwd: repo });
      let dlResult: any = {};
      try { dlResult = JSON.parse(dlOut); } catch (e) { logger.debug(`[module:design preclaim] dl parse: ${String(e).slice(0, 80)}`); }
      htmlCount = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html")).length;
      logger.info(`[module:design preclaim] Downloaded ${dlResult.downloaded || 0}/${dlResult.total || 0} (${htmlCount} HTML, attempt ${attempt + 1}/3)`, { runId: ctx.runId });
      ctx.context["screens_generated"] = String(dlResult.downloaded || 0);
      if (htmlCount > 0) break;
    } catch (e) {
      logger.warn(`[module:design preclaim] download-all failed (attempt ${attempt + 1}/3): ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
    if (htmlCount === 0 && attempt < 2) {
      logger.info(`[module:design preclaim] 0 HTML, waiting 30s before retry`, { runId: ctx.runId });
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  // 4b. Tracking-file fallback: direct curl from cached URLs if download-all returned 0
  if (htmlCount === 0) {
    const trackFile = path.join(repo, ".stitch-screens-" + projId + ".json");
    if (fs.existsSync(trackFile)) {
      try {
        const tracked = JSON.parse(fs.readFileSync(trackFile, "utf-8"));
        logger.info(`[module:design preclaim] Tracking-file fallback: ${tracked.length} entries`, { runId: ctx.runId });
        for (const s of tracked) {
          if (!s.htmlUrl) continue;
          const dest = path.join(stitchDir, (s.screenId || "unknown") + ".html");
          if (fs.existsSync(dest)) continue;
          try {
            execFileSync("curl", ["-sL", "-o", dest, "--max-time", "30", s.htmlUrl], { timeout: 35000 });
            if (fs.existsSync(dest) && fs.statSync(dest).size > 100) htmlCount++;
          } catch (e) { logger.debug(`[module:design preclaim] curl: ${String(e).slice(0, 80)}`); }
        }
        logger.info(`[module:design preclaim] Tracking fallback recovered ${htmlCount} HTML files`, { runId: ctx.runId });
      } catch (e) {
        logger.warn(`[module:design preclaim] Tracking fallback failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
      }
    }
  }

  // 5. DESIGN_DOM.json extraction — element-level info for downstream context.
  //    Best-effort, non-blocking.
  try {
    const domScript = path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/design-dom-extract.mjs");
    if (fs.existsSync(domScript)) {
      execFileSync("node", [domScript, stitchDir], { encoding: "utf-8", timeout: 30000 });
    }
  } catch (e) { logger.debug(`[module:design preclaim] design-dom-extract: ${String(e).slice(0, 80)}`); }

  // 6. AUTO-GENERATE SCREEN_MAP from DESIGN_MANIFEST.json so the agent only
  //    has to confirm + emit DESIGN_SYSTEM. Without this the agent spends
  //    6-10min building SCREEN_MAP entry-by-entry — pure waste, manifest
  //    already has every field we need.
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(manifest)) {
        const screenMap = manifest
          .filter((s: any) => s?.screenId && s?.title)
          .map((s: any) => ({
            screenId: String(s.screenId),
            name: String(s.title),
            type: classifyScreenType(String(s.title)),
            description: String(s.title) + " ekranı",
          }));
        if (screenMap.length > 0) {
          ctx.context["screen_map"] = JSON.stringify(screenMap);
          logger.info(`[module:design preclaim] auto-generated SCREEN_MAP with ${screenMap.length} entries`, { runId: ctx.runId });
        }
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] SCREEN_MAP auto-generate failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }
}

// Lightweight screen-type heuristic from Turkish title keywords.
// The agent can override in its output if a more specific type is needed,
// but defaults are good enough for stories step's screen→story binding.
function classifyScreenType(title: string): string {
  const t = title.toLowerCase();
  if (/(menü|menu|ana sayfa|home|landing)/.test(t)) return "menu";
  if (/(liste|list|katalog)/.test(t)) return "list-view";
  if (/(detay|detail)/.test(t)) return "detail";
  if (/(form|yeni|ekle|düzenle|edit|add)/.test(t)) return "form";
  if (/(ayar|setting|profil|profile)/.test(t)) return "settings";
  if (/(sonuç|result|skor|score)/.test(t)) return "result";
  if (/(oyun|game|play)/.test(t)) return "game";
  if (/(seçim|select|seviye|level|zorluk)/.test(t)) return "selection";
  if (/(bilgi|info|hakkında|nasıl|how)/.test(t)) return "info";
  if (/(boş|empty|404|hata|error)/.test(t)) return "error";
  if (/(yükle|upload)/.test(t)) return "form";
  return "app-screen";
}
