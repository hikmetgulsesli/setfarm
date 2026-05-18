import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";
import { now, pgGet, pgRun } from "../../../db-pg.js";
import { emitEvent } from "../../events.js";
import { resolvePlatformScript } from "../../paths.js";

const MIN_STITCH_HTML_BYTES = 1000;
const PRECLAIM_CANCELLED = "DESIGN_PRECLAIM_CANCELLED";
const progressDedupe = new Map<string, { detail: string; emittedAt: number }>();

type ExecFileTextOptions = {
  cwd?: string;
  timeout?: number;
  env?: NodeJS.ProcessEnv;
  onProgress?: () => boolean | void | Promise<boolean | void>;
  progressIntervalMs?: number;
};

function isPreclaimCancelledError(error: unknown): boolean {
  return String((error as any)?.message || error).includes(PRECLAIM_CANCELLED);
}

function execFileText(command: string, args: string[], options: ExecFileTextOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { onProgress, progressIntervalMs = 30000, ...execOptions } = options;
    let child: ReturnType<typeof execFile> | null = null;
    let cancelled = false;
    let killTimer: NodeJS.Timeout | null = null;
    const cancelChild = () => {
      if (cancelled) return;
      cancelled = true;
      try { child?.kill("SIGTERM"); } catch {}
      killTimer = setTimeout(() => {
        try { child?.kill("SIGKILL"); } catch {}
      }, 5000);
    };
    const progressTimer = onProgress
      ? setInterval(() => {
          Promise.resolve(onProgress())
            .then((keepGoing) => { if (keepGoing === false) cancelChild(); })
            .catch(() => {});
        }, progressIntervalMs)
      : null;
    child = execFile(command, args, {
      encoding: "utf-8",
      maxBuffer: 20 * 1024 * 1024,
      ...execOptions,
    }, (err, stdout, stderr) => {
      if (progressTimer) clearInterval(progressTimer);
      if (killTimer) clearTimeout(killTimer);
      if (cancelled) {
        reject(new Error(`${PRECLAIM_CANCELLED}: step is no longer running; child process terminated.`));
        return;
      }
      if (err) {
        const detail = String(stderr || stdout || (err as any).message || err).replace(/\s+/g, " ").slice(0, 1000);
        reject(new Error(detail));
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

async function recordPreClaimProgress(ctx: ClaimContext, detail: string): Promise<boolean> {
  const safeDetail = detail.replace(/\s+/g, " ").slice(0, 500);
  const dedupeKey = `${ctx.runId}:${ctx.stepId}`;
  const last = progressDedupe.get(dedupeKey);
  const shouldEmit = !last || last.detail !== safeDetail || Date.now() - last.emittedAt >= 120000;
  try {
    const stepUpdate = await pgRun("UPDATE steps SET updated_at = $1 WHERE run_id = $2 AND step_id = $3 AND status = 'running'", [now(), ctx.runId, ctx.stepId]);
    if (stepUpdate.changes === 0) return false;
    await pgRun(
      "UPDATE claim_log SET diagnostic = $1 WHERE run_id = $2 AND step_id = $3 AND story_id IS NULL AND outcome IS NULL",
      [safeDetail, ctx.runId, ctx.stepId],
    );
  } catch (e) {
    logger.debug(`[module:design preclaim] progress heartbeat failed: ${String(e).slice(0, 120)}`);
    return true;
  }
  if (shouldEmit) {
    progressDedupe.set(dedupeKey, { detail: safeDetail, emittedAt: Date.now() });
    emitEvent({ ts: now(), event: "step.progress", runId: ctx.runId, stepId: ctx.stepId, detail: safeDetail });
  }
  return true;
}

async function failDesignPreclaim(ctx: ClaimContext, error: string): Promise<void> {
  const safeError = error.replace(/\s+/g, " ").slice(0, 1000);
  ctx.context["design_asset_error"] = safeError;
  ctx.context["screens_generated"] = "0";
  await recordPreClaimProgress(ctx, safeError);

  const step = await pgGet<{ id: string }>(
    "SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1",
    [ctx.runId, ctx.stepId],
  );
  if (!step?.id) {
    throw new Error(`design preclaim could not resolve step id for ${ctx.runId}/${ctx.stepId}`);
  }

  const { failStep } = await import("../../step-fail.js");
  await failStep(step.id, safeError);
}

function isValidStitchHtml(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    if (fs.statSync(filePath).size < MIN_STITCH_HTML_BYTES) return false;
    const head = fs.readFileSync(filePath, "utf-8").slice(0, 4000).toLowerCase();
    if (!head.includes("<html") && !head.includes("<!doctype")) return false;
    if (head.includes("empty html") || head.includes("design not generated")) return false;
    return true;
  } catch {
    return false;
  }
}

function countValidStitchHtml(stitchDir: string): number {
  if (!stitchDir || !fs.existsSync(stitchDir)) return 0;
  return fs.readdirSync(stitchDir)
    .filter(f => f.endsWith(".html"))
    .filter(f => isValidStitchHtml(path.join(stitchDir, f))).length;
}

function isPrdPseudoScreen(screen: any): boolean {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  return /\b(?:prd|requirements?)\b/.test(title) || /\b(?:prd|requirements?)\b/.test(htmlFile);
}

function manifestHtmlCounts(stitchDir: string): { total: number; valid: number } {
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return { total: 0, valid: countValidStitchHtml(stitchDir) };
  try {
    const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!Array.isArray(manifestRaw)) return { total: 0, valid: countValidStitchHtml(stitchDir) };
    const manifest = manifestRaw.filter(s => !isPrdPseudoScreen(s));
    let valid = 0;
    for (const s of manifest) {
      const sid = String(s?.screenId || s?.id || "");
      if (sid && isValidStitchHtml(path.join(stitchDir, sid + ".html"))) valid++;
    }
    return { total: manifest.length, valid };
  } catch {
    return { total: 0, valid: countValidStitchHtml(stitchDir) };
  }
}

export function manifestUsesLocalFallback(stitchDir: string): boolean {
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    if (!Array.isArray(manifest) || manifest.length === 0) return false;
    return manifest.every((entry) => String(entry?.source || "").toLowerCase() === "local-fallback");
  } catch {
    return false;
  }
}

export function stitchApiKeyAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.STITCH_API_KEY || "").trim()) return true;
  const candidates = [
    path.join(path.dirname(resolvePlatformScript("stitch-api.mjs")), ".env"),
    path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/.env"),
    path.resolve(process.cwd(), "scripts/.env"),
  ];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const match = raw.match(/^STITCH_API_KEY=(.+)$/m);
      if (match?.[1]?.trim()) return true;
    } catch {}
  }
  return false;
}

type ScreenMapEntry = { screenId: string; name: string; type: string; description: string };

function normalizeScreenName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0130]/g, "I")
    .replace(/[\u0131]/g, "i")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function screenNameMatches(expectedName: string, actualName: string): boolean {
  const expected = normalizeScreenName(expectedName);
  const actual = normalizeScreenName(actualName);
  if (!expected || !actual) return false;
  if (expected === actual) return true;
  if (actual.startsWith(`${expected} `)) return true;
  if (expected.startsWith(`${actual} `)) return true;

  const expectedTokens = expected.split(" ").filter(Boolean);
  const actualTokens = new Set(actual.split(" ").filter(Boolean));
  if (expectedTokens.length < 2) return false;
  return expectedTokens.every((token) => actualTokens.has(token));
}

function parsePrdScreenRows(prd: string): Array<{ name: string; type: string; description: string }> {
  const rows: Array<{ name: string; type: string; description: string }> = [];
  const lines = String(prd || "").split(/\r?\n/);
  let inScreens = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##+\s+Screens\b/i.test(trimmed)) {
      inScreens = true;
      continue;
    }
    if (inScreens && /^##+\s+/.test(trimmed)) break;
    if (!inScreens || !/^\s*\|/.test(line) || /^\s*\|\s*-+/.test(line)) continue;
    const cols = line.split("|").map((v) => v.trim()).filter(Boolean);
    if (cols.length < 4 || /^#$/i.test(cols[0]) || /screen name/i.test(cols[1])) continue;
    rows.push({ name: cols[1], type: cols[2], description: cols.slice(3).join(" ") });
  }
  return rows;
}

function reconcileScreenMapToPrd(
  screenMap: ScreenMapEntry[],
  prd: string,
): { screenMap: ScreenMapEntry[]; missing: string[]; dropped: string[]; duplicates: string[] } {
  const rows = parsePrdScreenRows(prd);
  if (rows.length === 0) return { screenMap, missing: [], dropped: [], duplicates: [] };

  const next: ScreenMapEntry[] = [];
  const missing: string[] = [];
  const usedIds = new Set<string>();
  const duplicates: string[] = [];
  for (const row of rows) {
    const matches = screenMap.filter((screen) => screenNameMatches(row.name, screen.name));
    const chosen = matches.find((screen) => !usedIds.has(screen.screenId)) || matches[0];
    if (!chosen) {
      missing.push(row.name);
      continue;
    }
    if (matches.length > 1) duplicates.push(row.name);
    usedIds.add(chosen.screenId);
    next.push({
      ...chosen,
      name: row.name,
      type: chosen.type || row.type || classifyScreenType(row.name),
      description: chosen.description || row.description || `${row.name} screen`,
    });
  }

  const dropped = screenMap
    .filter((screen) => !usedIds.has(screen.screenId) || !rows.some((row) => screenNameMatches(row.name, screen.name)))
    .map((screen) => screen.name)
    .filter(Boolean);

  return { screenMap: next, missing, dropped, duplicates };
}

function rewriteScreenArtifactsForScreenMap(stitchDir: string, screenMap: ScreenMapEntry[], deviceType: string): void {
  try {
    const allowedIds = new Set(screenMap.map((screen) => screen.screenId));
    const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
    let manifest: any[] = [];
    try {
      const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (Array.isArray(raw)) manifest = raw;
    } catch {}
    const byId = new Map(manifest.map((entry) => [String(entry?.screenId || entry?.id || ""), entry]));
    const nextManifest = screenMap.map((screen) => {
      const existing = byId.get(screen.screenId) || {};
      return {
        ...existing,
        screenId: screen.screenId,
        title: screen.name,
        htmlFile: `${screen.screenId}.html`,
        deviceType: existing.deviceType || existing.device_type || deviceType,
      };
    }).filter((entry) => allowedIds.has(String(entry.screenId)));
    fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
    fs.writeFileSync(path.join(stitchDir, "SCREEN_MAP.json"), JSON.stringify(screenMap, null, 2));
  } catch (e) {
    logger.warn(`[module:design preclaim] artifact reconciliation write failed: ${String(e).slice(0, 200)}`);
  }
}

function markdownCell(value: unknown): string {
  return String(value || "")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function writeDesignMarkdownBrief(stitchDir: string, screenMap: ScreenMapEntry[], prd: string, repo: string): void {
  try {
    if (!stitchDir || screenMap.length === 0) return;
    fs.mkdirSync(stitchDir, { recursive: true });
    const appName = inferAppName(prd, repo);
    const screenRows = screenMap
      .map((screen, index) => `| ${index + 1} | ${markdownCell(screen.screenId)} | ${markdownCell(screen.name)} | ${markdownCell(screen.type)} | ${markdownCell(screen.description)} |`)
      .join("\n");
    const content = [
      `# ${appName} Design`,
      "",
      "Generated by Setfarm design preclaim from Stitch artifacts.",
      "",
      "## Screens",
      "| # | Screen ID | Name | Type | Description |",
      "|---|-----------|------|------|-------------|",
      screenRows,
      "",
      "## Source Artifacts",
      "- `SCREEN_MAP.json`",
      "- `DESIGN_MANIFEST.json`",
      "- `DESIGN_DOM.json`",
      "- `UI_CONTRACT.json`",
      "- `design-tokens.json` or `design-tokens.css`",
      "",
      "Implementation must follow these artifacts before inventing new UI structure.",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(stitchDir, "DESIGN.md"), content);
  } catch (e) {
    logger.warn(`[module:design preclaim] DESIGN.md write failed: ${String(e).slice(0, 200)}`);
  }
}

function compactPrdForStitch(prd: string): string {
  const withoutScreenTable = String(prd || "")
    .replace(/\n## Screens[\s\S]*?(?=\n## |$)/, "\n")
    .replace(/\n## Project Structure[\s\S]*?(?=\n## |$)/, "\n")
    .replace(/\n## Window State[\s\S]*?(?=\n## |$)/, "\n")
    .replace(/\nPRD_SCREEN_COUNT:.*$/gm, "")
    .replace(/\nDB_REQUIRED:.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return withoutScreenTable.length > 4500 ? `${withoutScreenTable.slice(0, 4500)}\n...(truncated)` : withoutScreenTable;
}

function buildBatchStitchPrompt(repo: string, prd: string, deviceType: string, uiLanguage: string): string {
  const screens = inferFallbackScreens(prd);
  const appName = inferAppName(prd, repo);
  const screenList = screens
    .map((screen, index) => `${index + 1}. ${screen.name} (${screen.type || "screen"}) - ${screen.description || `${screen.name} screen`}`)
    .join("\n");

  return [
    `Generate exactly ${screens.length} separate ${deviceType} screens for "${appName}" in one Stitch batch call.`,
    "",
    "Screen titles must match exactly:",
    screenList,
    "",
    "Application summary:",
    compactPrdForStitch(prd),
    "",
    "Batch generation rules:",
    `- Generate exactly ${screens.length} screens. Do not generate more or fewer screens.`,
    "- Do not create a PRD, requirements document, sitemap, landing page, or generic dashboard screen unless it is explicitly listed above.",
    "- Do not combine multiple listed screens into one design.",
    "- Each listed screen must be complete, production-quality, and visually consistent with the others.",
    "- Use a polished modern interface with real layout density and visible controls.",
    `- All visible user-facing text must be in ${uiLanguage}.`,
    "- Keep screen metadata and technical identifiers in English.",
    "- Use a cohesive design system across all screens.",
  ].join("\n");
}

function buildPerScreenStitchPrompt(prd: string, screen: ScreenMapEntry, uiLanguage: string): string {
  return [
    `Create exactly one production-quality ${screen.type || "app"} screen for this product.`,
    `Screen name: ${screen.name}`,
    `Screen description: ${screen.description || `${screen.name} screen`}`,
    "",
    "Product requirements:",
    prd.slice(0, 12000),
    "",
    "Design requirements:",
    "- Generate only this screen, not a whole app flow.",
    "- Include all visible controls, navigation, empty/error states, and labels that this screen naturally needs.",
    "- Use a polished, modern visual design with real layout density, not a placeholder wireframe.",
    `- All visible user-facing text must be in ${uiLanguage}.`,
    "- Keep technical metadata in English.",
  ].join("\n");
}

function retitleTrackedStitchScreens(repo: string, projId: string, screenIds: string[], title: string): void {
  if (screenIds.length === 0) return;
  const trackingFile = path.join(repo, `.stitch-screens-${projId}.json`);
  try {
    const tracked = JSON.parse(fs.readFileSync(trackingFile, "utf-8"));
    if (!Array.isArray(tracked)) return;
    const ids = new Set(screenIds);
    let changed = false;
    for (const entry of tracked) {
      if (ids.has(String(entry?.screenId || entry?.id || ""))) {
        entry.title = title;
        entry.setfarmExpectedTitle = title;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(trackingFile, JSON.stringify(tracked, null, 2));
  } catch {}
}

async function generateStitchScreensIndividually(
  ctx: ClaimContext,
  stitchScript: string,
  repo: string,
  stitchDir: string,
  projId: string,
  prd: string,
  deviceType: string,
  uiLanguage: string,
): Promise<number> {
  const targets = inferFallbackScreens(prd);
  if (targets.length === 0) return 0;

  await recordPreClaimProgress(ctx, `Design preclaim: batch Stitch generation returned no HTML, generating ${targets.length} screens one by one`);
  let generated = 0;
  for (const screen of targets) {
    const promptPath = path.join(stitchDir, `.screen-prompt-${screen.screenId}.txt`);
    fs.writeFileSync(promptPath, buildPerScreenStitchPrompt(prd, screen, uiLanguage), "utf-8");
    try {
      await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch screen "${screen.name}"`);
      const out = await execFileText(
        "node",
        [stitchScript, "generate-screen-safe", projId, `@${promptPath}`, screen.name, deviceType, "GEMINI_3_1_PRO"],
        {
          timeout: 360000,
          cwd: repo,
          onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still generating Stitch screen "${screen.name}"`),
        },
      );
      let parsed: any = {};
      try { parsed = JSON.parse(out); } catch {}
      const generatedScreens = Array.isArray(parsed?.screens) ? parsed.screens : [];
      const count = generatedScreens.length;
      retitleTrackedStitchScreens(
        repo,
        projId,
        generatedScreens.map((item: any) => String(item?.screenId || item?.id || "")).filter(Boolean),
        screen.name,
      );
      if (count > 0 || parsed?.skipped) generated++;
    } catch (e) {
      if (isPreclaimCancelledError(e)) throw e;
      logger.warn(`[module:design preclaim] per-screen Stitch generation failed for ${screen.name}: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch screen generation failed for "${screen.name}"`);
    }
  }

  if (generated > 0) {
    try {
      await recordPreClaimProgress(ctx, "Design preclaim: downloading individually generated Stitch screens");
      await execFileText("node", [stitchScript, "download-all", projId, stitchDir], {
        timeout: 180000,
        cwd: repo,
        onProgress: () => recordPreClaimProgress(ctx, "Design preclaim: still downloading individually generated Stitch screens"),
      });
    } catch (e) {
      if (isPreclaimCancelledError(e)) throw e;
      logger.warn(`[module:design preclaim] per-screen Stitch download failed: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
    }
  }

  const htmlCount = countValidStitchHtml(stitchDir);
  await recordPreClaimProgress(ctx, `Design preclaim: per-screen Stitch generation produced ${htmlCount} valid HTML files`);
  return htmlCount;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toScreenId(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u011f/g, "g")
    .replace(/\u00fc/g, "u")
    .replace(/\u015f/g, "s")
    .replace(/\u00f6/g, "o")
    .replace(/\u00e7/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || fallback;
}

function addUniqueScreenName(names: string[], value: string): void {
  const clean = value
    .replace(/\*\*/g, "")
    .replace(/[`#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[0-9]+[.)]\s*/, "")
    .trim();
  if (!clean || clean.length < 3 || clean.length > 80) return;
  if (/^(screen|screens|name|title|description|type|page|view)$/i.test(clean)) return;
  if (!names.some(existing => existing.toLowerCase() === clean.toLowerCase())) names.push(clean);
}

function inferAppName(prd: string, repo: string): string {
  const projectMatch = prd.match(/Project:\s*([^\n.]+)/i);
  if (projectMatch?.[1]) {
    return projectMatch[1].replace(/\s+Build\b.*$/i, "").trim().slice(0, 80) || path.basename(repo);
  }
  const titleMatch = prd.match(/^#\s+(.+)$/m);
  return (titleMatch?.[1] || path.basename(repo) || "Application")
    .replace(/\s+PRD\b.*$/i, "")
    .trim()
    .slice(0, 80);
}

export function inferFallbackScreens(prd: string): ScreenMapEntry[] {
  const prdRows = parsePrdScreenRows(prd);
  const names: string[] = [];

  if (prdRows.length > 0) {
    for (const row of prdRows) addUniqueScreenName(names, row.name);
  } else {
    const lines = prd.split(/\r?\n/);
    let inScreens = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^#{1,4}\s+/.test(trimmed)) {
        inScreens = /\b(screen|screens|view|views|page|pages|modal|modals)\b/i.test(trimmed);
        continue;
      }
      if (!inScreens) continue;

      const bullet = trimmed.match(/^[-*]\s+(?:\*\*)?([^:|\-*]{3,80})(?:\*\*)?(?:\s*[:|-]|\s*$)/);
      if (bullet?.[1]) addUniqueScreenName(names, bullet[1]);

      const table = trimmed.match(/^\|\s*([^|]{3,80})\s*\|/);
      if (table?.[1] && !/^[-:\s]+$/.test(table[1])) addUniqueScreenName(names, table[1]);
    }

    const lower = prd.toLowerCase();
    if (names.length === 0 && /\b(game|arcade|puzzle|score|level|pause|restart)\b/.test(lower)) {
      names.push("Main Menu", "Game Board", "Pause Overlay", "Game Over");
    } else if (names.length === 0) {
      names.push("Dashboard", "Detail View", "Create Form");
    }

    if (/\b(settings|options|preferences)\b/i.test(prd)) addUniqueScreenName(names, "Settings");
    if (/\b(help|rules|how to)\b/i.test(prd)) addUniqueScreenName(names, "Help and Rules");
    if (/\b(profile|account|user)\b/i.test(prd)) addUniqueScreenName(names, "Profile");
    if (/\b(error|empty|loading|fallback)\b/i.test(prd)) addUniqueScreenName(names, "State Feedback");
  }

  const prdRowsByName = new Map(prdRows.map((row) => [normalizeScreenName(row.name), row]));
  const screenNames = prdRows.length > 0 ? names : names.slice(0, 7);
  const used = new Set<string>();
  return screenNames.map((name, index) => {
    const prdRow = prdRowsByName.get(normalizeScreenName(name));
    const base = "fallback-" + toScreenId(name, `screen-${index + 1}`);
    let screenId = base;
    let suffix = 2;
    while (used.has(screenId)) screenId = `${base}-${suffix++}`;
    used.add(screenId);
    return {
      screenId,
      name,
      type: prdRow?.type || classifyScreenType(name),
      description: prdRow?.description || `${name} screen generated by local fallback design assets`,
    };
  });
}

function fallbackSpecificContent(screen: ScreenMapEntry): string {
  const title = screen.name.toLowerCase();
  if (/(over|result|score|summary)/.test(title)) {
    return `
      <section class="result-panel">
        <p class="scoreline">Final score 24,800 with strong progress through the challenge.</p>
        <button type="button">Restart</button><button type="button">Main Menu</button>
      </section>`;
  }
  if (/(game|board|play)/.test(title)) {
    const cells = Array.from({ length: 96 }, (_, i) => `<div class="cell${i % 11 === 0 || i % 17 === 0 ? " active" : ""}" aria-hidden="true"></div>`).join("");
    return `
      <section class="game-layout" aria-label="Playable board reference">
        <div class="board" role="grid" aria-label="Playable game field">${cells}</div>
        <aside class="side-panel">
          <h2>Status</h2>
          <div class="mini-grid" aria-label="Gameplay status preview">${Array.from({ length: 16 }, (_, i) => `<span class="${i % 5 === 0 ? "active" : ""}"></span>`).join("")}</div>
          <dl><dt>Score</dt><dd>12,400</dd><dt>Level</dt><dd>6</dd><dt>Progress</dt><dd>48%</dd></dl>
          <button type="button">Pause</button><button type="button">Restart</button>
        </aside>
      </section>`;
  }
  if (/(setting|option|preference)/.test(title)) {
    return `
      <form class="settings-panel">
        <label>Start Level <select name="level"><option>Level 1</option><option>Level 5</option></select></label>
        <label>Assist Hints <select name="assist"><option>On</option><option>Off</option></select></label>
        <label>Controls <input name="controls" placeholder="Arrow keys, WASD, or touch" /></label>
        <button type="button">Save Settings</button><button type="button">Reset Defaults</button>
      </form>`;
  }
  return `
    <section class="command-panel">
      <p>Primary application state with clear actions, readable hierarchy, and responsive layout guidance for implementation.</p>
      <div class="action-row"><button type="button">Start Game</button><button type="button">Resume</button><button type="button">Open Settings</button></div>
      <div class="data-grid"><article><h2>Goal</h2><p>Build a working interactive experience, not a static mock.</p></article><article><h2>Controls</h2><p>Keyboard, pointer, restart, pause, and state feedback must be implemented.</p></article></div>
    </section>`;
}

function buildFallbackHtml(screen: ScreenMapEntry, screens: ScreenMapEntry[], appName: string, deviceType: string): string {
  const nav = screens.map(s => `<a href="#${escapeHtml(s.screenId)}">${escapeHtml(s.name)}</a>`).join("");
  const content = fallbackSpecificContent(screen);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(screen.name)}</title>
  <style>
    :root {
      --color-background: #0b1020;
      --color-surface: #151b2d;
      --color-panel: #20283f;
      --color-primary: #20e3b2;
      --color-accent: #ffb86b;
      --color-danger: #ff5c7a;
      --color-text: #eef4ff;
      --color-muted: #9ba8c7;
      --font-heading: "Hanken Grotesk", "Segoe UI", sans-serif;
      --font-body: "Hanken Grotesk", "Segoe UI", sans-serif;
      --radius-card: 8px;
      --spacing-unit: 8px;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: var(--color-background); color: var(--color-text); font-family: var(--font-body); }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: center; padding: 24px 32px; border-bottom: 1px solid rgba(255,255,255,.12); background: var(--color-surface); }
    main { padding: 32px; display: grid; gap: 24px; }
    h1, h2 { font-family: var(--font-heading); margin: 0; }
    p { color: var(--color-muted); line-height: 1.55; }
    nav { display: flex; flex-wrap: wrap; gap: 10px; }
    a, button { border-radius: 8px; font: inherit; }
    a { color: var(--color-primary); text-decoration: none; padding: 8px 10px; border: 1px solid rgba(32,227,178,.25); }
    button { border: 0; background: var(--color-primary); color: #04110d; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    button + button { background: var(--color-panel); color: var(--color-text); border: 1px solid rgba(255,255,255,.14); }
    .meta { color: var(--color-muted); font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    .game-layout { display: grid; grid-template-columns: minmax(260px, 420px) minmax(220px, 320px); gap: 24px; align-items: start; }
    .board { aspect-ratio: 10 / 20; display: grid; grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(20, 1fr); gap: 2px; padding: 10px; background: #050814; border: 1px solid rgba(255,255,255,.18); border-radius: var(--radius-card); }
    .cell, .mini-grid span { background: rgba(255,255,255,.08); border-radius: 2px; min-height: 8px; }
    .cell.active, .mini-grid .active { background: var(--color-accent); box-shadow: 0 0 18px rgba(255,184,107,.35); }
    .side-panel, .command-panel, .settings-panel, .result-panel { background: var(--color-surface); border: 1px solid rgba(255,255,255,.14); border-radius: var(--radius-card); padding: 20px; display: grid; gap: 16px; }
    .mini-grid { width: 96px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; }
    dl { display: grid; grid-template-columns: 1fr auto; gap: 8px 18px; margin: 0; }
    dt { color: var(--color-muted); } dd { margin: 0; font-weight: 800; }
    .settings-panel label { display: grid; gap: 6px; color: var(--color-muted); }
    input, select { background: #080d19; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; color: var(--color-text); padding: 10px; }
    .action-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .data-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    article { background: var(--color-panel); border-radius: var(--radius-card); padding: 16px; }
    @media (max-width: 720px) { header, main { padding: 18px; } .game-layout, .data-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body data-device="${escapeHtml(deviceType)}">
  <header>
    <div><div class="meta">${escapeHtml(appName)}</div><h1>${escapeHtml(screen.name)}</h1><p>${escapeHtml(screen.description)}</p></div>
    <nav aria-label="Fallback design navigation">${nav}</nav>
  </header>
  <main id="${escapeHtml(screen.screenId)}">${content}</main>
</body>
</html>`;
}

function createFallbackDesignAssets(repo: string, stitchDir: string, prd: string, deviceType: string): ScreenMapEntry[] {
  fs.mkdirSync(stitchDir, { recursive: true });
  const screens = inferFallbackScreens(prd);
  const appName = inferAppName(prd, repo);
  const manifest = screens.map(s => ({
    screenId: s.screenId,
    title: s.name,
    htmlFile: `${s.screenId}.html`,
    deviceType,
    source: "local-fallback",
  }));

  for (const screen of screens) {
    fs.writeFileSync(path.join(stitchDir, `${screen.screenId}.html`), buildFallbackHtml(screen, screens, appName, deviceType));
  }

  const tokenJson = {
    source: "local-fallback",
    colors: {
      background: "#0b1020",
      surface: "#151b2d",
      panel: "#20283f",
      primary: "#20e3b2",
      accent: "#ffb86b",
      danger: "#ff5c7a",
      text: "#eef4ff",
      muted: "#9ba8c7",
    },
    fonts: { heading: "Inter, system-ui, sans-serif", body: "Inter, system-ui, sans-serif" },
    radius: { card: "8px" },
    spacing: { unit: "8px" },
  };
  const tokenCss = `/* design-tokens.css -- generated by Setfarm local fallback */
:root {
  --color-background: ${tokenJson.colors.background};
  --color-surface: ${tokenJson.colors.surface};
  --color-panel: ${tokenJson.colors.panel};
  --color-primary: ${tokenJson.colors.primary};
  --color-accent: ${tokenJson.colors.accent};
  --color-danger: ${tokenJson.colors.danger};
  --color-text: ${tokenJson.colors.text};
  --color-muted: ${tokenJson.colors.muted};
  --font-heading: ${tokenJson.fonts.heading};
  --font-body: ${tokenJson.fonts.body};
  --radius-card: ${tokenJson.radius.card};
  --spacing-unit: ${tokenJson.spacing.unit};
}
`;

  const domScreens: Record<string, any> = {};
  const uiContracts = screens.map((screen, index) => {
    const buttons = [
      { type: "button", label: index === 0 ? "Start Game" : "Restart", line: 1 },
      { type: "button", label: "Open Settings", line: 1 },
    ];
    const navigation = screens.map((s, navIndex) => ({ type: "link", label: s.name, href: `#${s.screenId}`, line: navIndex + 1 }));
    domScreens[screen.screenId] = {
      screenId: screen.screenId,
      title: screen.name,
      materialSymbolsRequired: false,
      sections: [{ tag: "main", layout: "grid", classes: [], childCount: 3 }],
      buttons: buttons.map(b => ({ label: b.label, classes: [], icon: null, action: "click-action" })),
      inputs: /setting/i.test(screen.name) ? [{ type: "select", placeholder: "", name: "level", classes: [] }] : [],
      navLinks: navigation.map(n => ({ label: n.label, href: n.href, classes: [], icon: null })),
      cards: [],
      icons: [],
      images: [],
      cssVars: { "--color-background": tokenJson.colors.background, "--color-primary": tokenJson.colors.primary },
      colorPalette: tokenJson.colors,
      fonts: ["Inter"],
      layoutHints: { gridCols: /game|board/i.test(screen.name) ? 2 : 1 },
    };
    return {
      screenId: screen.screenId,
      screenTitle: screen.name,
      deviceType,
      elements: [...navigation, ...buttons],
      navigation,
      buttons,
      inputs: /setting/i.test(screen.name) ? [{ type: "input", label: "Start Level", inputType: "select", placeholder: "Level", line: 1 }] : [],
      hardcodedData: [],
      totalInteractive: navigation.length + buttons.length,
      requiresRouter: false,
      requiresDragDrop: false,
    };
  });

  fs.writeFileSync(path.join(stitchDir, "DESIGN_MANIFEST.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(stitchDir, "SCREEN_MAP.json"), JSON.stringify(screens, null, 2));
  fs.writeFileSync(path.join(stitchDir, "design-tokens.json"), JSON.stringify(tokenJson, null, 2));
  fs.writeFileSync(path.join(stitchDir, "design-tokens.css"), tokenCss);
  fs.writeFileSync(path.join(stitchDir, "DESIGN_DOM.json"), JSON.stringify({ generatedAt: now(), screenCount: screens.length, screens: domScreens }, null, 2));
  fs.writeFileSync(path.join(stitchDir, "UI_CONTRACT.json"), JSON.stringify(uiContracts, null, 2));
  writeDesignMarkdownBrief(stitchDir, screens, prd, repo);
  return screens;
}

// Heavy work BEFORE agent claims the design step:
// 1. ensure-project (Stitch project for this repo)
// 2. write PRD as Stitch prompt
// 3. generate-all-screens (one Stitch API call for entire screen set)
// 4. download-all (3 retries + tracking-file fallback)
// Agent then validates the result — never calls Stitch API itself.
//
// Idempotent: if stitch/ already has current non-fallback HTML files, skips.
// Local fallback assets are regenerated when a real Stitch key is available so
// retries do not silently keep stale placeholder designs.
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  const prd = ctx.context["prd"] || ctx.context["PRD"] || "";
  const stitchDir = repo ? path.join(repo, "stitch") : "";
  if (!repo || !prd || !stitchDir) return;
  const hasStitchKey = stitchApiKeyAvailable();
  const previousAssetError = String(ctx.context["design_asset_error"] || "");
  const resetFailedStitchProject = hasStitchKey && /DESIGN_STITCH|0\s+(?:valid\s+)?(?:HTML|Stitch screens)|download failed/i.test(previousAssetError);

  if (resetFailedStitchProject) {
    await recordPreClaimProgress(ctx, "Design preclaim: resetting empty Stitch project after previous generation failure");
    try {
      fs.rmSync(stitchDir, { recursive: true, force: true });
      fs.rmSync(path.join(repo, ".stitch"), { force: true });
      for (const file of fs.readdirSync(repo).filter((name) => /^\.stitch-screens-.*\.json$/.test(name))) {
        fs.rmSync(path.join(repo, file), { force: true });
      }
      ctx.context["design_asset_error"] = "";
      ctx.context["screens_generated"] = "0";
      fs.mkdirSync(stitchDir, { recursive: true });
    } catch (e) {
      logger.warn(`[module:design preclaim] failed Stitch project reset failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  const existingHtml = fs.existsSync(stitchDir)
    ? fs.readdirSync(stitchDir).filter(f => f.endsWith(".html")).length
    : 0;
  const existingCounts = manifestHtmlCounts(stitchDir);
  const staleFallbackDesign = existingHtml > 0 && manifestUsesLocalFallback(stitchDir) && hasStitchKey;
  if (staleFallbackDesign) {
    logger.warn(`[module:design preclaim] Existing local-fallback Stitch assets found while STITCH_API_KEY is available; regenerating real design assets`, { runId: ctx.runId });
    await recordPreClaimProgress(ctx, "Design preclaim: invalidating stale local fallback assets before real Stitch generation");
    try {
      fs.rmSync(stitchDir, { recursive: true, force: true });
      fs.mkdirSync(stitchDir, { recursive: true });
    } catch (e) {
      logger.warn(`[module:design preclaim] stale fallback cleanup failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  } else if (existingHtml > 0 && existingCounts.valid > 0 && (existingCounts.total === 0 || existingCounts.valid >= existingCounts.total)) {
    logger.info(`[module:design preclaim] Skip — ${existingCounts.valid}/${existingCounts.total || existingCounts.valid} valid HTML already in ${stitchDir}`, { runId: ctx.runId });
    return;
  } else if (existingHtml > 0) {
    logger.warn(`[module:design preclaim] Existing stitch HTML incomplete/invalid (${existingCounts.valid}/${existingCounts.total || existingHtml} valid), regenerating`, { runId: ctx.runId });
    try {
      for (const file of fs.readdirSync(stitchDir).filter(f => f.endsWith(".html"))) {
        const htmlPath = path.join(stitchDir, file);
        if (!isValidStitchHtml(htmlPath)) fs.rmSync(htmlPath, { force: true });
      }
    } catch {}
  }

  const stitchScript = resolvePlatformScript("stitch-api.mjs");
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
      await recordPreClaimProgress(ctx, "Design preclaim: ensuring Stitch project");
      const ensureEnv = resetFailedStitchProject
        ? { ...process.env, STITCH_FORCE_NEW_PROJECT: "1" }
        : process.env;
      const out = await execFileText("node", [stitchScript, "ensure-project", path.basename(repo), repo],
        { timeout: 30000, cwd: repo, env: ensureEnv, onProgress: () => recordPreClaimProgress(ctx, "Design preclaim: still ensuring Stitch project") });
      try { projId = JSON.parse(out).projectId || ""; } catch (e) { logger.debug(`[module:design preclaim] parse: ${String(e).slice(0, 80)}`); }
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      logger.warn(`[module:design preclaim] ensure-project failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  if (!projId) {
    if (hasStitchKey) {
      const error = "DESIGN_STITCH_PROJECT_UNAVAILABLE: STITCH_API_KEY is configured but Setfarm could not create or load a Stitch project. Stop at design instead of continuing with local fallback.";
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error);
      return;
    }
    try {
      await recordPreClaimProgress(ctx, "Design preclaim: Stitch project unavailable, generating local fallback design assets");
      const fallbackScreens = createFallbackDesignAssets(repo, stitchDir, prd, ctx.context["device_type"] || "DESKTOP");
      ctx.context["stitch_project_id"] = "local-fallback";
      ctx.context["screens_generated"] = String(fallbackScreens.length);
      ctx.context["screen_map"] = JSON.stringify(fallbackScreens);
      logger.warn(`[module:design preclaim] Stitch project unavailable; generated ${fallbackScreens.length} local fallback design assets`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: generated fallback design assets (${fallbackScreens.length} screens)`);
      return;
    } catch (e) {
      const error = `DESIGN_ASSET_GENERATION_FAILED: Stitch project could not be created and local fallback failed: ${String(e).slice(0, 240)}`;
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error);
    }
    return;
  }

  ctx.context["stitch_project_id"] = projId;

  // 2. Write compact, explicit multi-screen Stitch prompt. The batch API is
  // fastest and most reliable when it receives an exact screen count and names.
  const promptFile = path.join(stitchDir, ".generate-prompt.txt");
  const deviceType = ctx.context["device_type"] || "DESKTOP";
  const uiLanguage = ctx.context["ui_language"] || ctx.context["UI_LANGUAGE"] || "English";
  fs.writeFileSync(promptFile, buildBatchStitchPrompt(repo, prd, deviceType, uiLanguage));
  logger.info(`[module:design preclaim] Generating screens (project ${projId}, device ${deviceType})`, { runId: ctx.runId });
  await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch screens for ${deviceType}`);

  // 3. generate-all-screens (single batch call)
  let batchGenerationCompleted = false;
  try {
    const genOut = await execFileText("node", [stitchScript, "generate-all-screens", projId, promptFile, deviceType, "GEMINI_3_1_PRO"],
      {
        timeout: 660000,
        cwd: repo,
        onProgress: () => recordPreClaimProgress(ctx, "Design preclaim: still generating Stitch screens"),
      });
    batchGenerationCompleted = true;
    let genResult: any = {};
    try { genResult = JSON.parse(genOut); } catch (e) { logger.debug(`[module:design preclaim] gen parse: ${String(e).slice(0, 80)}`); }
    logger.info(`[module:design preclaim] Generated ${genResult.total || 0} screens in ${genResult.elapsedSeconds || "?"}s`, { runId: ctx.runId });
    const generatedTotal = Number(genResult.total || 0);
    if (generatedTotal === 0 && genResult.diagnostic) {
      const shape = JSON.stringify(genResult.diagnostic).slice(0, 260);
      await recordPreClaimProgress(ctx, `Design preclaim: generated 0 Stitch screens; response shape ${shape}`);
    } else {
      await recordPreClaimProgress(ctx, `Design preclaim: generated ${generatedTotal} Stitch screens`);
    }
  } catch (e) {
    if (isPreclaimCancelledError(e)) return;
    logger.warn(`[module:design preclaim] generate-all-screens failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    await recordPreClaimProgress(ctx, "Design preclaim: batch Stitch generation failed, checking whether Stitch produced downloadable screens");
  }

  // 4. download-all with retries only after a completed batch call. If the
  // batch call itself fails, do one bounded download/list recovery and then
  // stop at design when no real HTML exists.
  let htmlCount = 0;
  const downloadAttempts = batchGenerationCompleted ? 3 : 1;
  for (let attempt = 0; attempt < downloadAttempts; attempt++) {
    try {
      await recordPreClaimProgress(ctx, `Design preclaim: downloading Stitch HTML files (attempt ${attempt + 1}/${downloadAttempts})`);
      const dlOut = await execFileText("node", [stitchScript, "download-all", projId, stitchDir],
        { timeout: 180000, cwd: repo, onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still downloading Stitch HTML files (attempt ${attempt + 1}/${downloadAttempts})`) });
      let dlResult: any = {};
      try { dlResult = JSON.parse(dlOut); } catch (e) { logger.debug(`[module:design preclaim] dl parse: ${String(e).slice(0, 80)}`); }
      const manifestCounts = manifestHtmlCounts(stitchDir);
      const total = manifestCounts.total || Number(dlResult.total || 0);
      htmlCount = manifestCounts.total ? manifestCounts.valid : countValidStitchHtml(stitchDir);
      logger.info(`[module:design preclaim] Downloaded ${dlResult.downloaded || 0}/${total || 0} (${htmlCount} valid HTML, attempt ${attempt + 1}/3)`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: downloaded ${htmlCount}/${total || htmlCount || 0} valid Stitch HTML files`);
      ctx.context["screens_generated"] = String(htmlCount);
      if (htmlCount > 0 && (!total || htmlCount >= total)) break;
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      logger.warn(`[module:design preclaim] download-all failed (attempt ${attempt + 1}/3): ${String(e).slice(0, 200)}`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch download failed on attempt ${attempt + 1}/${downloadAttempts}`);
    }
    if (attempt < downloadAttempts - 1) {
      logger.info(`[module:design preclaim] HTML incomplete (${htmlCount} valid), waiting 30s before retry`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: waiting 30s before retry, ${htmlCount} valid HTML files so far`);
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
        await recordPreClaimProgress(ctx, `Design preclaim: using tracking-file fallback for ${tracked.length} Stitch screen entries`);
        for (const s of tracked) {
          if (!s.htmlUrl) continue;
          const dest = path.join(stitchDir, (s.screenId || "unknown") + ".html");
          if (fs.existsSync(dest) && isValidStitchHtml(dest)) continue;
          try {
            await execFileText("curl", ["-sL", "-o", dest, "--max-time", "30", s.htmlUrl], { timeout: 35000 });
            if (isValidStitchHtml(dest)) htmlCount++;
          } catch (e) { logger.debug(`[module:design preclaim] curl: ${String(e).slice(0, 80)}`); }
        }
        logger.info(`[module:design preclaim] Tracking fallback recovered ${htmlCount} HTML files`, { runId: ctx.runId });
        await recordPreClaimProgress(ctx, `Design preclaim: tracking fallback recovered ${htmlCount} HTML files`);
      } catch (e) {
        logger.warn(`[module:design preclaim] Tracking fallback failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
      }
    }
  }

  // 4c. Optional per-screen Stitch recovery. It is disabled by default because
  // Setfarm's primary path is one fast batch call for the whole screen set.
  if (htmlCount === 0 && hasStitchKey && process.env.SETFARM_STITCH_PER_SCREEN_RECOVERY === "1") {
    try {
      htmlCount = await generateStitchScreensIndividually(ctx, stitchScript, repo, stitchDir, projId, prd, deviceType, uiLanguage);
      ctx.context["screens_generated"] = String(htmlCount);
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      logger.warn(`[module:design preclaim] per-screen Stitch recovery failed: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
    }
  }

  if (htmlCount === 0 && hasStitchKey) {
    const error = "DESIGN_STITCH_HTML_UNAVAILABLE: STITCH_API_KEY is configured but Stitch produced 0 valid HTML screens after batch generation, download, and tracking-file recovery. Stop at design instead of continuing with local fallback.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    await failDesignPreclaim(ctx, error);
    return;
  }

  // 4d. Local fallback: keep offline or unconfigured environments usable. When
  // a Stitch key is configured, real Stitch failure is surfaced as a design
  // failure above instead of being masked by fallback assets.
  if (htmlCount === 0) {
    try {
      await recordPreClaimProgress(ctx, "Design preclaim: generating local fallback design assets");
      const fallbackScreens = createFallbackDesignAssets(repo, stitchDir, prd, deviceType);
      htmlCount = fallbackScreens.length;
      ctx.context["screens_generated"] = String(htmlCount);
      ctx.context["screen_map"] = JSON.stringify(fallbackScreens);
      logger.warn(`[module:design preclaim] Stitch produced 0 valid HTML screens; generated ${htmlCount} local fallback design assets`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: generated fallback design assets (${htmlCount} screens)`);
    } catch (e) {
      logger.warn(`[module:design preclaim] local fallback design generation failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  // 5. DESIGN_DOM.json extraction — element-level info for downstream context.
  //    Best-effort, non-blocking.
  try {
    const domScript = resolvePlatformScript("design-dom-extract.mjs");
    if (fs.existsSync(domScript)) {
      await recordPreClaimProgress(ctx, "Design preclaim: extracting DOM metadata from Stitch HTML");
      await execFileText("node", [domScript, stitchDir], { timeout: 30000 });
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
          .filter((s: any) => !isPrdPseudoScreen(s))
          .filter((s: any) => s?.screenId && s?.title)
          .map((s: any) => ({
            screenId: String(s.screenId),
            name: String(s.title),
            type: classifyScreenType(String(s.title)),
            description: String(s.title) + " screen",
          }));
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] manifest parse failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }
  // Fallback: scan stitch/*.html, derive name from <title> tag (or screenId)
  if (screenMap.length === 0 && fs.existsSync(stitchDir)) {
    try {
      const htmlFiles = fs.readdirSync(stitchDir).filter(f => f.endsWith(".html") && !f.startsWith(".") && isValidStitchHtml(path.join(stitchDir, f)));
      for (const file of htmlFiles) {
        const screenId = file.replace(/\.html$/, "");
        let title = screenId;
        try {
          const html = fs.readFileSync(path.join(stitchDir, file), "utf-8").slice(0, 4000);
          const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (m) title = m[1].trim();
        } catch {}
        if (/^prd(?:\b|[:\s-])/i.test(title)) continue;
        screenMap.push({
          screenId,
          name: title || screenId,
          type: classifyScreenType(title),
          description: title + " screen",
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
    const reconciliation = reconcileScreenMapToPrd(screenMap, prd);
    if (reconciliation.missing.length > 0) {
      const error = `DESIGN_SCREEN_MAP_PRD_MISMATCH: Stitch output is missing PRD screen(s): ${reconciliation.missing.join(", ")}. Design must cover the PRD Screens table before stories/implementation.`;
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error);
      return;
    }
    if (reconciliation.screenMap.length !== screenMap.length || reconciliation.dropped.length > 0 || reconciliation.duplicates.length > 0) {
      const detail = [
        reconciliation.dropped.length ? `dropped=${[...new Set(reconciliation.dropped)].slice(0, 8).join(",")}` : "",
        reconciliation.duplicates.length ? `duplicates=${[...new Set(reconciliation.duplicates)].slice(0, 8).join(",")}` : "",
        `final=${reconciliation.screenMap.length}`,
      ].filter(Boolean).join(" ");
      ctx.context["design_reconciliation"] = detail;
      await recordPreClaimProgress(ctx, `Design preclaim: reconciled SCREEN_MAP to PRD (${detail})`);
      logger.warn(`[module:design preclaim] Reconciled SCREEN_MAP to PRD: ${detail}`, { runId: ctx.runId });
    }
    screenMap = reconciliation.screenMap;
    rewriteScreenArtifactsForScreenMap(stitchDir, screenMap, deviceType);
    writeDesignMarkdownBrief(stitchDir, screenMap, prd, repo);
    ctx.context["screen_map"] = JSON.stringify(screenMap);
    logger.info(`[module:design preclaim] SCREEN_MAP injected (${screenMap.length} entries)`, { runId: ctx.runId });
    await recordPreClaimProgress(ctx, `Design preclaim: SCREEN_MAP ready with ${screenMap.length} entries`);
  } else {
    const error = "DESIGN_ASSET_GENERATION_FAILED: Stitch generation/download produced 0 valid HTML screens; SCREEN_MAP unavailable. Do not continue to implementation without design assets.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    await failDesignPreclaim(ctx, error);
    return;
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
    manifest = manifest.filter((s: any) => !isPrdPseudoScreen(s));
    const allowedScreenIds = new Set(screenMap.map(s => s.screenId));
    manifest = manifest.filter((s: any) => allowedScreenIds.has(String(s?.screenId || s?.id || "")));
    if (manifest.length !== screenMap.length) {
      manifest = screenMap.map(s => ({ screenId: s.screenId, title: s.name, htmlFile: s.screenId + ".html", deviceType }));
      try { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); } catch {}
    }
    if (manifest.length === 0) return;
    let htmlOkCount = 0;
    for (const s of screenMap) {
      const sid = String(s?.screenId || "");
      if (!sid) continue;
      const htmlPath = p.join(stitchDir, sid + ".html");
      if (isValidStitchHtml(htmlPath)) htmlOkCount++;
    }
    if (htmlOkCount < screenMap.length) {
      logger.warn(`[module:design preclaim] auto-complete skipped: only ${htmlOkCount}/${screenMap.length} valid HTMLs ready`, { runId: ctx.runId });
      return;
    }
    let designSystem: any = {};
    try { if (fs.existsSync(tokensPath)) designSystem = JSON.parse(fs.readFileSync(tokensPath, "utf-8")); } catch {}
    const deviceType = ctx.context["device_type"] || "DESKTOP";
    const output = [
      "STATUS: done",
      "DEVICE_TYPE: " + deviceType,
      "DESIGN_SYSTEM: " + JSON.stringify(designSystem),
      "SCREEN_MAP: " + JSON.stringify(screenMap),
      "SCREENS_GENERATED: " + screenMap.length,
      "AUTO_COMPLETED: design-preclaim (all assets ready, agent bypass)"
    ].join("\n");
    const { completeStep } = await import("../../step-ops.js");
    const stepRow = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
    const stepDbId = stepRow?.id || ctx.stepId;
    await recordPreClaimProgress(ctx, `Design preclaim: auto-completing design with ${screenMap.length} screens`);
    await completeStep(stepDbId, output);
    logger.info(`[module:design preclaim] AUTO-COMPLETED step ${ctx.stepId} (${screenMap.length} screens, ${htmlOkCount} HTMLs, agent bypassed)`, { runId: ctx.runId, stepId: stepDbId });
  } catch (e) {
    logger.warn(`[module:design preclaim] auto-complete failed (falling back to agent): ${String(e).slice(0, 200)}`, { runId: ctx.runId });
  }
}

// Lightweight screen-type heuristic from English title keywords.
// The agent can override in its output if a more specific type is needed,
// but defaults are good enough for stories step's screen→story binding.
function classifyScreenType(title: string): string {
  const t = title.toLowerCase();
  if (/(menu|home|landing)/.test(t)) return "menu";
  if (/(list|catalog)/.test(t)) return "list-view";
  if (/(detail)/.test(t)) return "detail";
  if (/(form|new|create|edit|add)/.test(t)) return "form";
  if (/(setting|option|preference|profile|account)/.test(t)) return "settings";
  if (/(result|score|summary)/.test(t)) return "result";
  if (/(game|play)/.test(t)) return "game";
  if (/(select|choice|level|difficulty)/.test(t)) return "selection";
  if (/(info|about|how)/.test(t)) return "info";
  if (/(empty|404|error|fallback)/.test(t)) return "error";
  if (/(upload)/.test(t)) return "form";
  return "app-screen";
}
