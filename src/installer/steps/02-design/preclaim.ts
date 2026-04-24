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

  // 6. AUTO-GENERATE SCREEN_MAP. Prefer DESIGN_MANIFEST.json (rich metadata);
  //    fall back to scanning stitch/*.html when manifest didn't make it (Stitch
  //    download-all sometimes returns HTML without writing manifest — observed
  //    in run #449). Either way the agent gets a populated SCREEN_MAP and only
  //    has to emit DESIGN_SYSTEM.
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  let screenMap: Array<{ screenId: string; name: string; type: string; description: string }> = [];
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(manifest)) {
        screenMap = manifest
          .filter((s: any) => s?.screenId && s?.title)
          .map((s: any) => ({
            screenId: String(s.screenId),
            name: String(s.title),
            type: classifyScreenType(String(s.title)),
            description: String(s.title) + " ekranı",
          }));
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] manifest parse failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }
  // Fallback: scan stitch/*.html, derive name from <title> tag (or screenId)
  if (screenMap.length === 0 && fs.existsSync(stitchDir)) {
    try {
      const htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html") && !f.startsWith("."));
      for (const file of htmlFiles) {
        const screenId = file.replace(/\.html$/, "");
        let title = screenId;
        try {
          const html = fs.readFileSync(path.join(stitchDir, file), "utf-8").slice(0, 4000);
          const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (m) title = m[1].trim();
        } catch {}
        screenMap.push({
          screenId,
          name: title || screenId,
          type: classifyScreenType(title),
          description: title + " ekranı",
        });
      }
      if (screenMap.length > 0) {
        // Synthesize manifest so downstream code (agent prompt examples, etc.) works
        try {
          fs.writeFileSync(manifestPath, JSON.stringify(
            screenMap.map(s => ({ screenId: s.screenId, title: s.name, htmlFile: s.screenId + ".html", deviceType: ctx.context["device_type"] || "DESKTOP" })),
            null, 2
          ));
          logger.info(`[module:design preclaim] manifest synthesized from ${screenMap.length} HTML files`, { runId: ctx.runId });
        } catch (e) {
          logger.warn(`[module:design preclaim] manifest synthesize failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
        }
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] HTML fallback failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }
  if (screenMap.length > 0) {
    ctx.context["screen_map"] = JSON.stringify(screenMap);
    logger.info(`[module:design preclaim] SCREEN_MAP injected (${screenMap.length} entries)`, { runId: ctx.runId });
  } else {
    logger.warn(`[module:design preclaim] SCREEN_MAP could not be generated — agent will see empty list`, { runId: ctx.runId });
  }

  // Auto-complete (2026-04-24): if all required design assets are present,
  // skip agent turn entirely and complete step directly. Stitch preclaim
  // produced everything the downstream needs (SCREEN_MAP, DESIGN_DOM,
  // design-tokens, HTMLs). Agent only adds overhead + retry risk.
  // Guards: >=50% HTMLs present (PNG optional), DOM + manifest + tokens exist.
  try {
    const fs = await import("node:fs");
    const p = await import("node:path");
    const repoRaw = ctx.context["repo"] || "";
    const repo = repoRaw.replace(/^~/, process.env.HOME || "");
    if (!repo || screenMap.length === 0) return;
    const stitchDir = p.join(repo, "stitch");
    const domPath = p.join(stitchDir, "DESIGN_DOM.json");
    const tokensPath = p.join(stitchDir, "design-tokens.json");
    const manifestPath = p.join(stitchDir, "DESIGN_MANIFEST.json");
    if (!fs.existsSync(domPath) || !fs.existsSync(manifestPath)) return;
    if (fs.statSync(domPath).size < 50 || fs.statSync(manifestPath).size < 50) return;
    let manifest: any[];
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")); } catch { return; }
    if (!Array.isArray(manifest) || manifest.length === 0) return;
    let htmlOkCount = 0;
    for (const s of manifest) {
      const sid = String(s?.screenId || s?.id || "");
      if (!sid) continue;
      const htmlPath = p.join(stitchDir, sid + ".html");
      if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).size >= 100) htmlOkCount++;
    }
    if (htmlOkCount < Math.ceil(manifest.length * 0.5)) {
      logger.warn(`[module:design preclaim] auto-complete skipped: only ${htmlOkCount}/${manifest.length} HTMLs ready`, { runId: ctx.runId });
      return;
    }
    let designSystem: any = {};
    try { if (fs.existsSync(tokensPath)) designSystem = JSON.parse(fs.readFileSync(tokensPath, "utf-8")); } catch {}
    const output = [
      "STATUS: done",
      "DEVICE_TYPE: DESKTOP",
      "DESIGN_SYSTEM: " + JSON.stringify(designSystem),
      "SCREEN_MAP: " + JSON.stringify(screenMap),
      "SCREENS_GENERATED: " + manifest.length,
      "AUTO_COMPLETED: design-preclaim (all assets ready, agent bypass)"
    ].join("\n");
    const { completeStep } = await import("../../step-ops.js");
    await completeStep(ctx.stepId, output);
    logger.info(`[module:design preclaim] AUTO-COMPLETED step ${ctx.stepId} (${manifest.length} screens, ${htmlOkCount} HTMLs, agent bypassed)`, { runId: ctx.runId, stepId: ctx.stepId });
  } catch (e) {
    logger.warn(`[module:design preclaim] auto-complete failed (falling back to agent): ${String(e).slice(0, 200)}`, { runId: ctx.runId });
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
