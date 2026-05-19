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

function redactDiagnosticText(text: unknown): string {
  return String(text || "")
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "AQ.[REDACTED]")
    .replace(/(api[_-]?key|token|authorization|bearer)\s*[:=]\s*["']?[^"'\s,}]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
}

function isStitchProviderUnavailable(text: unknown): boolean {
  const normalized = redactDiagnosticText(text).toLowerCase();
  return (
    /\bservice is currently unavailable\b/.test(normalized) ||
    /\bservice unavailable\b/.test(normalized) ||
    /\btemporarily unavailable\b/.test(normalized) ||
    /\bprovider unavailable\b/.test(normalized) ||
    /\bstitch provider unavailable\b/.test(normalized) ||
    /\bdeadline exceeded\b/.test(normalized) ||
    /\bresource exhausted\b/.test(normalized) ||
    /\brate limit(?:ed)?\b/.test(normalized) ||
    /\bquota\b/.test(normalized) ||
    /\b503\b/.test(normalized)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function boundedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] || fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
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

async function failDesignPreclaim(ctx: ClaimContext, error: string, options: { terminal?: boolean } = {}): Promise<void> {
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

  if (options.terminal) {
    await pgRun("UPDATE steps SET max_retries = retry_count WHERE id = $1", [step.id]);
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

function hasValidStitchDesignMarkdown(stitchDir: string): boolean {
  try {
    const designPath = path.join(stitchDir, "DESIGN.md");
    return fs.existsSync(designPath) && fs.statSync(designPath).size >= 500;
  } catch {
    return false;
  }
}

export function stitchApiKeyAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  if (String(env.STITCH_API_KEY || "").trim()) return true;
  if (String(env.STITCH_API_KEYS || "").trim()) return true;
  if (Object.keys(env).some((key) => /^STITCH_API_KEY_\d+$/.test(key) && String(env[key] || "").trim())) return true;
  const configuredEnvDir = String(env.SETFARM_ENV_DIR || "").trim();
  const candidates = [
    ...(configuredEnvDir
      ? [
          path.join(configuredEnvDir.replace(/^~(?=\/|$)/, os.homedir()), ".env.local"),
          path.join(configuredEnvDir.replace(/^~(?=\/|$)/, os.homedir()), ".env"),
        ]
      : []),
    path.join(path.dirname(resolvePlatformScript("stitch-api.mjs")), ".env"),
    path.join(path.dirname(resolvePlatformScript("stitch-api.mjs")), ".env.local"),
    path.join(os.homedir(), ".openclaw/setfarm/.env.local"),
    path.join(os.homedir(), ".openclaw/setfarm/.env"),
    path.join(os.homedir(), ".openclaw/.env.local"),
    path.join(os.homedir(), ".openclaw/.env"),
    path.join(os.homedir(), ".openclaw/setfarm-repo/scripts/.env"),
    path.resolve(process.cwd(), "scripts/.env"),
  ];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf-8");
      const match = raw.match(/^\s*(?:export\s+)?STITCH_API_KEY\s*=\s*(.+)$/m);
      if (match?.[1]?.trim()) return true;
      const multi = raw.match(/^\s*(?:export\s+)?STITCH_API_KEYS\s*=\s*(.+)$/m);
      if (multi?.[1]?.trim()) return true;
      if (/^\s*(?:export\s+)?STITCH_API_KEY_\d+\s*=\s*\S+/m.test(raw)) return true;
    } catch {}
  }
  return false;
}

type ScreenMapEntry = { screenId: string; name: string; type: string; description: string; surfaceIds?: string[] };
type ProductSurface = {
  surfaceId: string;
  name: string;
  purpose: string;
  dataEntitiesBound: string;
  coreContent: string;
  permittedActions: Array<{ actionId: string; controlHint: string }>;
  entryPoints: string;
  exitRules: string;
  authRequired: string;
  designGuidance: string;
};

function truncateForPrompt(value: string, max = 420): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function surfaceCaption(surface: ProductSurface): string {
  const content = surface.coreContent || surface.purpose || `${surface.name} workflow`;
  return truncateForPrompt(`${surface.name}: ${content}`, 180);
}

function surfaceActionsLine(surface: ProductSurface): string {
  return surface.permittedActions.map((action) => `${action.actionId} as ${action.controlHint}`).join(", ") || "No explicit actions";
}

function productDisplayName(prd: string): string {
  const text = String(prd || "");
  const candidates = [
    text.match(/(?:^|\n)\s*PROJECT_NAME\s*:?\s*["']?([^"'\n]+)["']?/i)?.[1],
    text.match(/(?:^|\n)\s*project_name\s*:?\s*["']?([^"'\n]+)["']?/i)?.[1],
    text.match(/(?:^|\n)#\s*PRD\s*:\s*(.+)$/i)?.[1],
    text.match(/(?:^|\n)([A-Z][^\n]{3,80})\s+Product Contract\b/)?.[1],
    text.match(/\bcalled\s+([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,5})\s+(?:that|which|to|for|,|\.)/i)?.[1],
    text.match(/(?:^|\n)\s*-?\s*Overview\s*:\s*([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,5})\s+(?:turns|is|helps|lets|provides|manages)\b/i)?.[1],
  ];
  for (const candidate of candidates) {
    const clean = String(candidate || "")
      .replace(/\s*Product Contract\s*$/i, "")
      .replace(/\s+for\s+.*$/i, "")
      .trim();
    const name = truncateForPrompt(clean, 80);
    if (name && !/^product$/i.test(name)) return name;
  }
  return "Product";
}

function surfaceScreenSpec(surface: ProductSurface, index: number, projectName: string): string {
  return [
    `SCREEN_SPEC_${index + 1}:`,
    `- exact_screen_title: ${surface.name} - ${projectName}`,
    `- surface_id: ${surface.surfaceId}`,
    `- unique_canvas_caption: ${surfaceCaption(surface)}`,
    `- purpose: ${truncateForPrompt(surface.purpose)}`,
    `- required_content: ${truncateForPrompt(surface.coreContent || "Use the Product Surface purpose as content.")}`,
    `- data_entities: ${truncateForPrompt(surface.dataEntitiesBound || "not specified", 220)}`,
    `- visible_actions: ${surfaceActionsLine(surface)}`,
    `- entry_exit_rules: ${truncateForPrompt(`${surface.entryPoints || "not specified"} -> ${surface.exitRules || "not specified"}`, 260)}`,
    `- design_guidance: ${truncateForPrompt(surface.designGuidance || "Follow the scoped product contract.", 320)}`,
  ].join("\n");
}

type SurfaceVerificationResult = {
  screenMap: ScreenMapEntry[];
  missing: string[];
  unexpected: string[];
  duplicates: string[];
  surfaces: ProductSurface[];
  missingSurfaces: ProductSurface[];
  inlineCovered: string[];
};

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

function surfaceNameMatches(expectedName: string, actualName: string): boolean {
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

function splitCsvish(value: string): string[] {
  return String(value || "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSurfaceId(value: string, fallback: string): string {
  const clean = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (clean.startsWith("SURF_") && clean.length > 5) return clean;
  const fallbackClean = String(fallback || "SURFACE").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `SURF_${fallbackClean || "SURFACE"}`;
}

function parsePermittedActions(value: string): Array<{ actionId: string; controlHint: string }> {
  const actions: Array<{ actionId: string; controlHint: string }> = [];
  const actionRe = /\b(ACT_[A-Z0-9_]+)\b(?:[^()\n]*\((?:control_hint|Control Hint)\s*:\s*([^)]+)\))?/g;
  let match: RegExpExecArray | null;
  while ((match = actionRe.exec(value))) {
    actions.push({ actionId: match[1], controlHint: (match[2] || "primary_button").trim() });
  }
  if (actions.length > 0) return actions;
  return splitCsvish(value).map((item) => {
    const id = item.match(/\b(ACT_[A-Z0-9_]+)\b/)?.[1] || "";
    const hint = item.match(/\b(?:control_hint|Control Hint)\s*:\s*([a-z_]+)/i)?.[1] || "primary_button";
    return id ? { actionId: id, controlHint: hint } : null;
  }).filter(Boolean) as Array<{ actionId: string; controlHint: string }>;
}

function assignSurfaceField(surface: ProductSurface, key: string, value: string): void {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalizedKey === "surface id" || normalizedKey === "surface") surface.surfaceId = normalizeSurfaceId(value, surface.name);
  else if (normalizedKey === "name") surface.name = value.trim() || surface.name;
  else if (normalizedKey === "purpose") surface.purpose = value.trim();
  else if (normalizedKey === "data entities bound" || normalizedKey === "data entities") surface.dataEntitiesBound = value.trim();
  else if (normalizedKey === "core content") surface.coreContent = value.trim();
  else if (normalizedKey === "permitted actions" || normalizedKey === "actions") surface.permittedActions = parsePermittedActions(value);
  else if (normalizedKey === "entry points") surface.entryPoints = value.trim();
  else if (normalizedKey === "exit guard rules" || normalizedKey === "exit rules" || normalizedKey === "exit points") surface.exitRules = value.trim();
  else if (normalizedKey === "auth required") surface.authRequired = value.trim();
  else if (normalizedKey === "design guidance") surface.designGuidance = value.trim();
}

export function parseProductSurfaces(prd: string): ProductSurface[] {
  const surfaces: ProductSurface[] = [];
  const lines = String(prd || "").split(/\r?\n/);
  let inSurfaces = false;
  let current: ProductSurface | null = null;
  const pushCurrent = () => {
    if (!current) return;
    current.surfaceId = normalizeSurfaceId(current.surfaceId, current.name);
    if (!current.name) current.name = current.surfaceId.replace(/^SURF_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
    if (!current.purpose) current.purpose = `${current.name} product surface`;
    surfaces.push(current);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##+\s+(?:\d+\.\s*)?Product Surfaces\b/i.test(trimmed)) {
      inSurfaces = true;
      continue;
    }
    if (inSurfaces && /^##\s+/.test(trimmed)) break;
    if (!inSurfaces) continue;

    const heading = trimmed.match(/^#{3,5}\s+SURFACE\s*:\s*([A-Z0-9_ -]+)(?:\s*[-:]\s*(.+))?$/i);
    const bulletId = trimmed.match(/^[-*]\s*(?:SURFACE_ID|Surface ID)\s*:\s*([A-Z0-9_ -]+)$/i);
    if (heading || bulletId) {
      pushCurrent();
      const idRaw = heading?.[1] || bulletId?.[1] || "";
      const nameRaw = heading?.[2] || idRaw;
      current = {
        surfaceId: normalizeSurfaceId(idRaw, nameRaw),
        name: nameRaw.replace(/^SURF[_ -]?/i, "").replace(/[_-]+/g, " ").trim(),
        purpose: "",
        dataEntitiesBound: "",
        coreContent: "",
        permittedActions: [],
        entryPoints: "",
        exitRules: "",
        authRequired: "",
        designGuidance: "",
      };
      continue;
    }

    if (!current) continue;
    const field = trimmed.match(/^[-*]\s*([^:]+):\s*(.+)$/);
    if (field) assignSurfaceField(current, field[1], field[2]);
  }
  pushCurrent();

  const seen = new Set<string>();
  return surfaces.filter((surface) => {
    if (seen.has(surface.surfaceId)) return false;
    seen.add(surface.surfaceId);
    return true;
  });
}

function surfaceSearchText(surface: ProductSurface): string {
  return [
    surface.surfaceId,
    surface.name,
    surface.purpose,
    surface.dataEntitiesBound,
    surface.coreContent,
    surface.entryPoints,
    surface.exitRules,
    surface.designGuidance,
    surface.permittedActions.map((action) => `${action.actionId} ${action.controlHint}`).join(" "),
  ].join(" ");
}

export function surfaceCoverageMode(surface: ProductSurface): "standalone_required" | "inline_allowed" {
  const text = normalizeScreenName(surfaceSearchText(surface));
  const inlineStateTerms = [
    "empty",
    "error",
    "loading",
    "retry",
    "recover",
    "recovery",
    "failed",
    "failure",
    "validation",
    "fallback",
    "offline",
    "corrupt",
    "unauthorized",
    "permission",
    "confirmation",
  ];
  return inlineStateTerms.some((term) => text.includes(term)) ? "inline_allowed" : "standalone_required";
}

function htmlTextForInlineCoverage(stitchDir: string, screenMap: ScreenMapEntry[]): string {
  const parts = screenMap.map((screen) => `${screen.name} ${screen.type} ${screen.description}`);
  if (!stitchDir || !fs.existsSync(stitchDir)) return normalizeScreenName(parts.join(" "));
  try {
    for (const file of fs.readdirSync(stitchDir).filter((name) => name.endsWith(".html") && !name.startsWith("."))) {
      const filePath = path.join(stitchDir, file);
      if (!isValidStitchHtml(filePath)) continue;
      const html = fs.readFileSync(filePath, "utf-8")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ");
      parts.push(html.slice(0, 200000));
    }
  } catch {}
  return normalizeScreenName(parts.join(" "));
}

function inlineCoverageEvidence(surface: ProductSurface, stitchDir: string, screenMap: ScreenMapEntry[]): string | null {
  if (surfaceCoverageMode(surface) !== "inline_allowed") return null;
  const designText = htmlTextForInlineCoverage(stitchDir, screenMap);
  if (!designText) return null;
  const surfaceText = normalizeScreenName(surfaceSearchText(surface));
  const evidenceTerms = [
    "empty",
    "error",
    "loading",
    "retry",
    "recover",
    "recovery",
    "failed",
    "failure",
    "validation",
    "fallback",
    "offline",
    "corrupt",
    "clear",
    "reset",
    "create",
  ].filter((term) => surfaceText.includes(term));
  const uniqueTerms = [...new Set(evidenceTerms)];
  if (uniqueTerms.length === 0) return null;
  const hits = uniqueTerms.filter((term) => designText.includes(term));
  const requiredHits = Math.min(2, uniqueTerms.length);
  return hits.length >= requiredHits ? `${surface.surfaceId} inline evidence: ${hits.slice(0, 5).join(",")}` : null;
}

function tokenSet(value: string): Set<string> {
  const ignored = new Set(["the", "and", "for", "with", "from", "this", "that", "screen", "surface", "page", "view", "state", "app", "product", "user", "users"]);
  return new Set(normalizeScreenName(value).split(" ").filter((token) => token.length > 2 && !ignored.has(token)));
}

function matchSurfacesForScreen(screen: ScreenMapEntry, surfaces: ProductSurface[]): ProductSurface[] {
  const screenText = `${screen.name} ${screen.type} ${screen.description}`;
  const screenTokens = tokenSet(screenText);
  const exactMatches: ProductSurface[] = [];
  for (const surface of surfaces) {
    if (surfaceNameMatches(surface.name, screen.name) || normalizeScreenName(screenText).includes(normalizeScreenName(surface.surfaceId.replace(/^SURF_/, "")))) {
      exactMatches.push(surface);
    }
  }
  if (exactMatches.length > 0) return exactMatches;

  const matches: ProductSurface[] = [];
  for (const surface of surfaces) {
    if (surfaceCoverageMode(surface) === "inline_allowed") {
      continue;
    }
    const surfaceTokens = tokenSet(surfaceSearchText(surface));
    let hits = 0;
    for (const token of surfaceTokens) if (screenTokens.has(token)) hits++;
    if (hits >= Math.min(2, Math.max(1, surfaceTokens.size))) matches.push(surface);
  }
  return matches;
}

function screenLooksOutOfScope(screen: ScreenMapEntry, prd: string): boolean {
  const text = normalizeScreenName(`${screen.name} ${screen.type} ${screen.description}`);
  const prdText = normalizeScreenName(prd);
  const forbidden = [
    "marketing landing",
    "pricing",
    "checkout",
    "shopping cart",
    "admin panel",
    "documentation",
    "requirements",
    "prd",
    "sitemap",
    "blog",
  ];
  return forbidden.some((term) => text.includes(term) && !prdText.includes(term));
}

export function verifyScreenMapToSurfaces(
  screenMap: ScreenMapEntry[],
  prd: string,
  options: { stitchDir?: string } = {},
): SurfaceVerificationResult {
  const surfaces = parseProductSurfaces(prd);
  if (surfaces.length === 0) return { screenMap, missing: [], unexpected: [], duplicates: [], surfaces, missingSurfaces: [], inlineCovered: [] };

  const next: ScreenMapEntry[] = [];
  const missingSurfaceIds = new Set(surfaces.map((surface) => surface.surfaceId));
  const unexpected: string[] = [];
  const usedIds = new Set<string>();
  const duplicates: string[] = [];

  for (const screen of screenMap) {
    const matches = matchSurfacesForScreen(screen, surfaces);
    if (matches.length === 0 || screenLooksOutOfScope(screen, prd)) {
      unexpected.push(screen.name || screen.screenId);
      continue;
    }
    if (usedIds.has(screen.screenId)) duplicates.push(screen.name || screen.screenId);
    usedIds.add(screen.screenId);
    for (const match of matches) missingSurfaceIds.delete(match.surfaceId);
    next.push({
      ...screen,
      type: screen.type || classifyScreenType(screen.name),
      description: screen.description || `${screen.name} screen`,
      surfaceIds: matches.map((surface) => surface.surfaceId),
    });
  }

  const missingSurfaces: ProductSurface[] = [];
  const inlineCovered: string[] = [];
  for (const surface of surfaces.filter((item) => missingSurfaceIds.has(item.surfaceId))) {
    const evidence = options.stitchDir ? inlineCoverageEvidence(surface, options.stitchDir, next) : null;
    if (evidence) {
      inlineCovered.push(evidence);
      continue;
    }
    missingSurfaces.push(surface);
  }

  const missing = missingSurfaces.map((surface) => `${surface.surfaceId} ${surface.name}`.trim());

  return { screenMap: next, missing, unexpected, duplicates, surfaces, missingSurfaces, inlineCovered };
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
        surfaceIds: screen.surfaceIds || existing.surfaceIds || [],
      };
    }).filter((entry) => allowedIds.has(String(entry.screenId)));
    fs.writeFileSync(manifestPath, JSON.stringify(nextManifest, null, 2));
    fs.writeFileSync(path.join(stitchDir, "SCREEN_MAP.json"), JSON.stringify(screenMap, null, 2));
  } catch (e) {
    logger.warn(`[module:design preclaim] artifact reconciliation write failed: ${String(e).slice(0, 200)}`);
  }
}

function buildSurfaceInventory(surfaces: ProductSurface[]): string {
  return surfaces.map((surface, index) => [
    `${index + 1}. ${surface.surfaceId} - ${surface.name}`,
    `   Purpose: ${surface.purpose}`,
    `   Data: ${surface.dataEntitiesBound || "not specified"}`,
    `   Core content: ${surface.coreContent || "not specified"}`,
    `   Actions: ${surface.permittedActions.map((action) => `${action.actionId} (${action.controlHint})`).join(", ") || "none"}`,
    `   Entry/exit: ${surface.entryPoints || "not specified"} -> ${surface.exitRules || "not specified"}`,
    `   Guidance: ${surface.designGuidance || "follow the product contract"}`,
  ].join("\n")).join("\n\n");
}

function productVisionSummary(prd: string): string {
  const text = String(prd || "");
  const pick = (label: string): string => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`(?:^|\\n)\\s*-?\\s*${escaped}\\s*:\\s*(.+)`, "i"));
    return truncateForPrompt(match?.[1] || "", 320);
  };
  const lines = [
    pick("Overview"),
    pick("Core Objectives") || pick("FR-001"),
    pick("Target Audience"),
  ].filter(Boolean);
  if (lines.length > 0) return lines.map((line) => `- ${line}`).join("\n");
  return `- ${truncateForPrompt(text.replace(/\s+/g, " ").trim(), 600) || "Use the declared Product Surfaces as the visual product source."}`;
}

function uiSafePrdContext(prd: string): string {
  const lines = String(prd || "").split(/\r?\n/);
  const keepSection = (line: string): boolean => {
    const normalized = normalizeScreenName(line);
    return (
      normalized.includes("context and goals") ||
      normalized.includes("behavioral and action contract") ||
      normalized.includes("validation and error strategy") ||
      normalized.includes("out of scope")
    );
  };
  const stopSection = (line: string): boolean => /^#{1,3}\s+/.test(line.trim()) || /^\s*\d+\.\s+/.test(line.trim());
  const kept: string[] = [];
  let active = false;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (keepSection(line)) {
      active = true;
      kept.push(line);
      continue;
    }
    if (active && stopSection(line) && !keepSection(line)) {
      active = false;
    }
    if (!active) continue;
    if (/\b(?:repo|branch|github|local directory|server directory|env|environment|testability|platform contract|state architecture|data flow|server state|db_required)\b/i.test(line)) {
      continue;
    }
    kept.push(line);
  }
  const text = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return truncateForPrompt(text, 9000) || "No extra UI-safe PRD context extracted.";
}

function buildDesignBrief(prd: string, deviceType: string, uiLanguage: string): string {
  const surfaces = parseProductSurfaces(prd);
  const surfaceInventory = buildSurfaceInventory(surfaces);

  return [
    "# DESIGN_BRIEF",
    "",
    "## STRICT_UI_SCOPE_CONTRACT",
    "- Design only UI that maps to one or more PRODUCT_SURFACES below.",
    "- Do not invent modules, workflows, dashboards, marketing pages, admin areas, ecommerce flows, docs, PRD pages, or settings outside the Product Surfaces.",
    "- Physical screen count, routing, tabs, modals, drawers, and component hierarchy are Stitch decisions, but every generated screen must be traceable to a SURF_* id.",
    "- Every permitted action must have a plausible visible control or platform-appropriate interaction.",
    "- Empty, loading, validation, and error states may be included only inside the declared Product Surfaces.",
    `- All visible user-facing text must be in ${uiLanguage}.`,
    "- Keep metadata, screen titles, and technical identifiers in English.",
    `- Target device type: ${deviceType}.`,
    "",
    "## PRODUCT_VISION_SUMMARY",
    productVisionSummary(prd),
    "",
    "## PRODUCT_SURFACES",
    surfaceInventory || "No Product Surfaces were declared.",
    "",
    "## UI_OUT_OF_SCOPE",
    "- No PRD/requirements/sitemap/documentation screens.",
    "- No generic admin, pricing, checkout, blog, onboarding, account, or profile areas unless declared as a Product Surface.",
    "- No local placeholder/wireframe design.",
    "",
    "## UI_SAFE_PRD_CONTEXT",
    "Use this only to understand product behavior and missing UI states. Do not render this text directly. SCREEN_SPECS remain the active screen source.",
    uiSafePrdContext(prd),
  ].join("\n");
}

function buildBatchStitchPrompt(repo: string, prd: string, deviceType: string, uiLanguage: string, stageSurfaces?: ProductSurface[], stageLabel = "all surfaces"): string {
  void repo;
  const allSurfaces = parseProductSurfaces(prd);
  const surfaces = stageSurfaces?.length ? stageSurfaces : allSurfaces;
  const projectName = productDisplayName(prd);
  const screenSpecs = surfaces.map((surface, index) => surfaceScreenSpec(surface, index, projectName)).join("\n\n");
  const expectedTitles = surfaces.map((surface) => `- ${surface.name} - ${projectName}`).join("\n");

  return [
    "# STITCH_BATCH_BRIEF",
    "",
    `Generate exactly ${surfaces.length} production-quality UI screens for the Product Surface targets below.`,
    `Batch stage: ${stageLabel}.`,
    "Generate every SCREEN_SPEC in this batch call. Do not generate screens outside this stage.",
    "If this Stitch project already has screens from an earlier stage, preserve the same visual system, navigation pattern, density, typography, spacing, and component language.",
    `Target device type: ${deviceType}.`,
    `All visible user-facing text must be in ${uiLanguage}.`,
    "",
    "## PRODUCT_VISION_SUMMARY",
    productVisionSummary(prd),
    "",
    "## REQUIRED_SCREEN_TITLES",
    expectedTitles || "No Product Surface targets were declared.",
    "",
    "## SCREEN_SPECS",
    screenSpecs || "No Product Surface targets were declared.",
    "",
    "## OUTPUT_RULES",
    "- Create one distinct canvas/frame per SCREEN_SPEC.",
    "- Do not create a design-system/style-guide canvas as an output screen. Apply the design system inside the product screens only.",
    "- Do not output palette, typography, component inventory, or moodboard screens.",
    "- Use exact_screen_title as the screen title/name. Do not rename screens to generic labels.",
    "- Use unique_canvas_caption for that screen only. Do not reuse one global caption across screens.",
    "- Do not place the whole chunk summary, PRD summary, Key Deliverables text, or any follow-up question as visible screen captions.",
    "- Do not write 'How would you like to proceed?', 'We could refine...', or similar assistant chat text in the design output.",
    "- Each screen must visibly emphasize its own required_content and visible_actions. Do not let all screens share the same layout content.",
    "",
    "## STRICT_UI_SCOPE_CONTRACT",
    "- Every generated screen must map to one or more SCREEN_SPECS above.",
    "- Do not invent modules, dashboards, marketing pages, admin areas, ecommerce flows, docs, account, or profile areas outside the Product Surfaces.",
    "- Every permitted action from the matching Product Surface should have a plausible visible control or platform-appropriate interaction.",
    "- Empty, loading, validation, and error states may be included only inside the declared Product Surfaces.",
    "",
    "## PRODUCT_SURFACES",
    buildSurfaceInventory(surfaces) || "No Product Surfaces were declared.",
    "",
    "## UI_SAFE_PRD_CONTEXT",
    "Use this only to understand product behavior and missing UI states. Do not render this text directly. SCREEN_SPECS remain the active screen source.",
    uiSafePrdContext(prd),
  ].join("\n");
}

function buildPerScreenStitchPrompt(prd: string, screen: ScreenMapEntry, uiLanguage: string): string {
  return [
    `Create exactly one production-quality UI screen for this Product Surface target.`,
    `Target name: ${screen.name}`,
    `Target description: ${screen.description || `${screen.name} surface`}`,
    `Surface IDs: ${(screen.surfaceIds || []).join(", ") || "unknown"}`,
    "",
    "Scoped design brief:",
    buildDesignBrief(prd, "DESKTOP", uiLanguage).slice(0, 16000),
    "",
    "Design requirements:",
    "- Generate only this scoped target, not a whole unrelated app flow.",
    "- Every visible control must map to an ACT_* action declared in the Product Surface when possible.",
    "- Use a polished, modern visual design with real layout density, not a placeholder wireframe.",
    `- All visible user-facing text must be in ${uiLanguage}.`,
    "- Keep technical metadata in English.",
  ].join("\n");
}

async function generateStitchScreensInSingleBatch(
  ctx: ClaimContext,
  stitchScript: string,
  repo: string,
  stitchDir: string,
  projId: string,
  prd: string,
  deviceType: string,
  uiLanguage: string,
): Promise<{ completed: boolean; providerUnavailable: boolean; diagnostic: string }> {
  const surfaces = parseProductSurfaces(prd);
  if (surfaces.length === 0) return { completed: false, providerUnavailable: false, diagnostic: "No Product Surfaces declared" };
  const retryAttempts = boundedIntEnv("SETFARM_STITCH_BATCH_RETRY_ATTEMPTS", 3, 1, 5);
  const retryBaseDelayMs = boundedIntEnv("SETFARM_STITCH_BATCH_RETRY_BASE_DELAY_MS", 45000, 5000, 180000);
  const stageSize = boundedIntEnv("SETFARM_STITCH_BATCH_STAGE_SIZE", 5, 1, 5);
  const stages: ProductSurface[][] = [];
  for (let index = 0; index < surfaces.length; index += stageSize) {
    stages.push(surfaces.slice(index, index + stageSize));
  }
  let providerUnavailable = false;
  let diagnostic = "";

  await recordPreClaimProgress(ctx, `Design preclaim: generating ${surfaces.length} Product Surfaces in ${stages.length} Stitch batch stage(s) of up to ${stageSize}`);
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stageSurfaces = stages[stageIndex];
    const stageLabel = `stage ${stageIndex + 1}/${stages.length} (${stageSurfaces.map((surface) => surface.surfaceId).join(", ")})`;
    const promptFile = path.join(stitchDir, ".generate-prompt.txt");
    fs.writeFileSync(promptFile, buildBatchStitchPrompt(repo, prd, deviceType, uiLanguage, stageSurfaces, stageLabel), "utf-8");
    await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch batch ${stageLabel}`);
    let stageCompleted = false;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const genOut = await execFileText("node", [stitchScript, "generate-all-screens", projId, promptFile, deviceType, "GEMINI_3_1_PRO"], {
          timeout: 660000,
          cwd: repo,
          onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still generating Stitch batch ${stageIndex + 1}/${stages.length} (attempt ${attempt}/${retryAttempts})`),
        });

        let genResult: any = {};
        try { genResult = JSON.parse(genOut); } catch {}
        const generatedTotal = Number(genResult.total || 0);
        logger.info(`[module:design preclaim] Generated ${generatedTotal} screen(s) in Stitch batch ${stageIndex + 1}/${stages.length} (attempt ${attempt}/${retryAttempts})`, { runId: ctx.runId });
        if (generatedTotal === 0 && genResult.diagnostic) {
          const shape = JSON.stringify(genResult.diagnostic).slice(0, 260);
          const textSample = redactDiagnosticText(genResult.diagnostic.textSample).slice(0, 500);
          diagnostic = textSample || shape || diagnostic;
          providerUnavailable = providerUnavailable || isStitchProviderUnavailable(textSample || shape);
          await recordPreClaimProgress(ctx, `Design preclaim: Stitch batch ${stageIndex + 1}/${stages.length} generated 0 screens on attempt ${attempt}/${retryAttempts}; response shape ${shape}`);
          if (providerUnavailable && attempt < retryAttempts) {
            const delayMs = retryBaseDelayMs * attempt;
            await recordPreClaimProgress(ctx, `Design preclaim: Stitch provider unavailable; retrying same batch stage in ${Math.round(delayMs / 1000)}s`);
            await sleep(delayMs);
            continue;
          }
          return { completed: false, providerUnavailable, diagnostic };
        }
        await recordPreClaimProgress(ctx, `Design preclaim: Stitch batch ${stageIndex + 1}/${stages.length} generated ${generatedTotal} screen(s)`);
        stageCompleted = true;
        break;
      } catch (e) {
        if (isPreclaimCancelledError(e)) throw e;
        const failureDetail = redactDiagnosticText(e).slice(0, 500);
        diagnostic = failureDetail || diagnostic;
        providerUnavailable = providerUnavailable || isStitchProviderUnavailable(failureDetail);
        logger.warn(`[module:design preclaim] Stitch batch ${stageIndex + 1}/${stages.length} failed on attempt ${attempt}/${retryAttempts}: ${failureDetail.slice(0, 200)}`, { runId: ctx.runId });
        await recordPreClaimProgress(ctx, `Design preclaim: Stitch batch ${stageIndex + 1}/${stages.length} failed on attempt ${attempt}/${retryAttempts}: ${failureDetail || "unknown error"}`);
        if (providerUnavailable && attempt < retryAttempts) {
          const delayMs = retryBaseDelayMs * attempt;
          await recordPreClaimProgress(ctx, `Design preclaim: Stitch provider unavailable; retrying same batch stage in ${Math.round(delayMs / 1000)}s`);
          await sleep(delayMs);
          continue;
        }
        return { completed: false, providerUnavailable, diagnostic };
      }
    }
    if (!stageCompleted) return { completed: false, providerUnavailable, diagnostic };
  }
  return { completed: true, providerUnavailable: false, diagnostic };
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

function stitchScreenRecoveryBatchSize(): number {
  const raw = Number(process.env.SETFARM_STITCH_SCREEN_BATCH_SIZE || 5);
  if (!Number.isFinite(raw) || raw < 1) return 5;
  return Math.max(1, Math.min(5, Math.floor(raw)));
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
  targetsOverride?: ScreenMapEntry[],
  reason = "batch Stitch generation returned no HTML",
): Promise<number> {
  const targets = targetsOverride?.length ? targetsOverride : inferPrdScreens(prd);
  if (targets.length === 0) return 0;

  const batchSize = stitchScreenRecoveryBatchSize();
  await recordPreClaimProgress(ctx, `Design preclaim: ${reason}, generating ${targets.length} Stitch screen(s) in chunks of ${batchSize}`);
  let generated = 0;

  const generateOne = async (screen: ScreenMapEntry): Promise<void> => {
    const promptPath = path.join(stitchDir, `.screen-prompt-${screen.screenId}.txt`);
    fs.writeFileSync(promptPath, buildPerScreenStitchPrompt(prd, screen, uiLanguage), "utf-8");
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
  };

  for (let index = 0; index < targets.length; index += batchSize) {
    const batch = targets.slice(index, index + batchSize);
    await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch recovery chunk ${Math.floor(index / batchSize) + 1}/${Math.ceil(targets.length / batchSize)}`);
    const results = await Promise.allSettled(batch.map((screen) => generateOne(screen)));
    for (let offset = 0; offset < results.length; offset++) {
      const result = results[offset];
      if (result.status !== "rejected") continue;
      const screen = batch[offset];
      if (isPreclaimCancelledError(result.reason)) throw result.reason;
      logger.warn(`[module:design preclaim] per-screen Stitch generation failed for ${screen.name}: ${String(result.reason).slice(0, 240)}`, { runId: ctx.runId });
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch screen generation failed for "${screen.name}"`);
    }
    if (index + batchSize < targets.length) await new Promise(r => setTimeout(r, 2000));
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

async function downloadStitchDesignMarkdown(
  ctx: ClaimContext,
  stitchScript: string,
  repo: string,
  stitchDir: string,
  projId: string,
): Promise<void> {
  if (!projId || projId === "local-fallback") return;
  await recordPreClaimProgress(ctx, "Design preclaim: downloading Stitch DESIGN.md");
  const out = await execFileText("node", [stitchScript, "get-design-md", projId, stitchDir], {
    timeout: 45000,
    cwd: repo,
    onProgress: () => recordPreClaimProgress(ctx, "Design preclaim: still downloading Stitch DESIGN.md"),
  });
  let designMd = "";
  try {
    const parsed = JSON.parse(out);
    designMd = String(parsed?.designMd || "").trim();
  } catch {
    designMd = "";
  }
  const designPath = path.join(stitchDir, "DESIGN.md");
  if (!designMd || !fs.existsSync(designPath) || fs.statSync(designPath).size < 500) {
    throw new Error("DESIGN_STITCH_DESIGN_MD_UNAVAILABLE: Stitch get-design-md did not produce stitch/DESIGN.md.");
  }
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

export function inferPrdScreens(prd: string): ScreenMapEntry[] {
  const surfaces = parseProductSurfaces(prd);
  const screenNames = surfaces.length > 0
    ? surfaces.map((surface) => surface.name)
    : ["Product Workspace"];
  const used = new Set<string>();
  return screenNames.map((name, index) => {
    const base = "prd-" + toScreenId(name, `screen-${index + 1}`);
    let screenId = base;
    let suffix = 2;
    while (used.has(screenId)) screenId = `${base}-${suffix++}`;
    used.add(screenId);
    return {
      screenId,
      name,
      type: classifyScreenType(name),
      description: surfaces[index]?.purpose || `${name} Product Surface from the PRD contract`,
      surfaceIds: surfaces[index] ? [surfaces[index].surfaceId] : [],
    };
  });
}

function screenTargetsForSurfaces(surfaces: ProductSurface[]): ScreenMapEntry[] {
  const used = new Set<string>();
  return surfaces.map((surface, index) => {
    const base = "prd-" + toScreenId(surface.name, `surface-${index + 1}`);
    let screenId = base;
    let suffix = 2;
    while (used.has(screenId)) screenId = `${base}-${suffix++}`;
    used.add(screenId);
    return {
      screenId,
      name: surface.name,
      type: classifyScreenType(surface.name),
      description: surface.purpose || `${surface.name} Product Surface from the PRD contract`,
      surfaceIds: [surface.surfaceId],
    };
  });
}

function readScreenMapFromStitchArtifacts(stitchDir: string, deviceType: string, runId?: string): ScreenMapEntry[] {
  const manifestPath = path.join(stitchDir, "DESIGN_MANIFEST.json");
  let screenMap: ScreenMapEntry[] = [];
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
      logger.warn(`[module:design preclaim] manifest parse failed: ${String(e).slice(0, 200)}`, { runId });
    }
  }

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
        try {
          fs.writeFileSync(manifestPath, JSON.stringify(
            screenMap.map(s => ({ screenId: s.screenId, title: s.name, htmlFile: s.screenId + ".html", deviceType })),
            null, 2
          ));
          logger.info(`[module:design preclaim] manifest synthesized from ${screenMap.length} HTML files`, { runId });
        } catch (e) {
          logger.warn(`[module:design preclaim] manifest synthesize failed: ${String(e).slice(0, 200)}`, { runId });
        }
      }
    } catch (e) {
      logger.warn(`[module:design preclaim] HTML fallback failed: ${String(e).slice(0, 200)}`, { runId });
    }
  }
  return screenMap;
}

// Heavy work BEFORE agent claims the design step:
// 1. ensure-project (Stitch project for this repo)
// 2. write PRD as Stitch prompt
// 3. generate-all-screens (one Stitch API call for entire screen set)
// 4. download-all (3 retries + tracking-file fallback)
// Agent then validates the result — never calls Stitch API itself.
//
// Idempotent: if stitch/ already has current non-fallback HTML files plus
// Stitch DESIGN.md, skips. If Stitch cannot produce the required assets, the
// design step fails instead of generating local placeholder design files.
export async function preClaim(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  const prd = ctx.context["prd"] || ctx.context["PRD"] || "";
  const stitchDir = repo ? path.join(repo, "stitch") : "";
  if (!repo || !prd || !stitchDir) return;
  const designRequired = String(ctx.context["design_required"] || ctx.context["DESIGN_REQUIRED"] || "true").toLowerCase() !== "false";
  if (!designRequired) {
    const stepRow = await pgGet<{ id: string }>("SELECT id FROM steps WHERE run_id = $1 AND step_id = $2 LIMIT 1", [ctx.runId, ctx.stepId]);
    if (!stepRow?.id) return;
    ctx.context["screen_map"] = "[]";
    ctx.context["screens_generated"] = "0";
    ctx.context["design_system"] = "{}";
    const { completeStep } = await import("../../step-ops.js");
    await completeStep(stepRow.id, [
      "STATUS: done",
      "DESIGN_REQUIRED: false",
      "DEVICE_TYPE: NONE",
      "DESIGN_SYSTEM: {}",
      "SCREEN_MAP: []",
      "SCREENS_GENERATED: 0",
      "AUTO_COMPLETED: design-bypass (DESIGN_REQUIRED=false)",
    ].join("\n"));
    logger.info("[module:design preclaim] AUTO-COMPLETED design bypass (DESIGN_REQUIRED=false)", { runId: ctx.runId });
    return;
  }
  const declaredSurfaces = parseProductSurfaces(prd);
  if (declaredSurfaces.length === 0) {
    await failDesignPreclaim(ctx, "DESIGN_SURFACE_MISMATCH: DESIGN_REQUIRED=true but PRD has no Product Surfaces to send to Stitch.", { terminal: true });
    return;
  }
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
  let recoverDesignMdOnly = false;
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
    const cachedScreenMap = readScreenMapFromStitchArtifacts(stitchDir, ctx.context["device_type"] || "DESKTOP", ctx.runId);
    const cachedReconciliation = verifyScreenMapToSurfaces(cachedScreenMap, prd, { stitchDir });
    if (hasValidStitchDesignMarkdown(stitchDir)) {
      if (cachedReconciliation.screenMap.length > 0 && cachedReconciliation.missing.length === 0) {
        rewriteScreenArtifactsForScreenMap(stitchDir, cachedReconciliation.screenMap, ctx.context["device_type"] || "DESKTOP");
        ctx.context["screen_map"] = JSON.stringify(cachedReconciliation.screenMap);
        logger.info(`[module:design preclaim] Skip — ${existingCounts.valid}/${existingCounts.total || existingCounts.valid} valid HTML and DESIGN.md already in ${stitchDir}`, { runId: ctx.runId });
        return;
      }
      await recordPreClaimProgress(ctx, `Design preclaim: cached Stitch assets missing Product Surface coverage (${cachedReconciliation.missing.slice(0, 5).join(", ")}), regenerating`);
      logger.warn(`[module:design preclaim] cached Stitch assets missing Product Surface coverage; regenerating`, { runId: ctx.runId });
    } else {
      recoverDesignMdOnly = cachedReconciliation.screenMap.length > 0 && cachedReconciliation.missing.length === 0;
      if (recoverDesignMdOnly) {
        logger.info(`[module:design preclaim] ${existingCounts.valid}/${existingCounts.total || existingCounts.valid} valid HTML already in ${stitchDir}; recovering Stitch DESIGN.md`, { runId: ctx.runId });
      } else {
        await recordPreClaimProgress(ctx, `Design preclaim: cached Stitch HTML missing Product Surface coverage (${cachedReconciliation.missing.slice(0, 5).join(", ")}), regenerating`);
        logger.warn(`[module:design preclaim] cached Stitch HTML missing Product Surface coverage; regenerating`, { runId: ctx.runId });
      }
    }
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
    const ensureAttempts = Math.max(1, Math.min(5, Number(process.env.SETFARM_STITCH_PROJECT_RETRY_ATTEMPTS || 3) || 3));
    let ensureDiagnostic = "";
    try {
      const ensureEnv = resetFailedStitchProject
        ? { ...process.env, STITCH_FORCE_NEW_PROJECT: "1" }
        : process.env;
      for (let attempt = 0; attempt < ensureAttempts && !projId; attempt++) {
        await recordPreClaimProgress(ctx, `Design preclaim: ensuring Stitch project (attempt ${attempt + 1}/${ensureAttempts})`);
        try {
          const out = await execFileText("node", [stitchScript, "ensure-project", path.basename(repo), repo],
            { timeout: 60000, cwd: repo, env: ensureEnv, onProgress: () => recordPreClaimProgress(ctx, `Design preclaim: still ensuring Stitch project (attempt ${attempt + 1}/${ensureAttempts})`) });
          try { projId = JSON.parse(out).projectId || ""; } catch (e) { logger.debug(`[module:design preclaim] parse: ${String(e).slice(0, 80)}`); }
          if (projId) break;
          ensureDiagnostic = "ensure-project returned no projectId";
        } catch (e) {
          if (isPreclaimCancelledError(e)) return;
          ensureDiagnostic = redactDiagnosticText(e).slice(0, 500) || "unknown ensure-project error";
          logger.warn(`[module:design preclaim] ensure-project failed (attempt ${attempt + 1}/${ensureAttempts}): ${ensureDiagnostic.slice(0, 200)}`, { runId: ctx.runId });
          await recordPreClaimProgress(ctx, `Design preclaim: Stitch project ensure failed on attempt ${attempt + 1}/${ensureAttempts}: ${ensureDiagnostic}`);
        }
        if (!projId && attempt < ensureAttempts - 1) {
          const delayMs = Math.min(30000, 10000 * (attempt + 1));
          await recordPreClaimProgress(ctx, `Design preclaim: waiting ${Math.round(delayMs / 1000)}s before retrying Stitch project ensure`);
          await sleep(delayMs);
        }
      }
      if (!projId && ensureDiagnostic) {
        ctx.context["stitch_project_diagnostic"] = ensureDiagnostic;
      }
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      logger.warn(`[module:design preclaim] ensure-project failed: ${String(e).slice(0, 200)}`, { runId: ctx.runId });
    }
  }

  if (!projId) {
    if (hasStitchKey) {
      const diagnostic = String(ctx.context["stitch_project_diagnostic"] || "").trim();
      const suffix = diagnostic ? ` Last Stitch diagnostic: ${diagnostic.slice(0, 650)}` : "";
      const error = `DESIGN_STITCH_PROJECT_UNAVAILABLE: STITCH_API_KEY is configured but Setfarm could not create or load a Stitch project after retries.${suffix}`;
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error, { terminal: true });
      return;
    }
    const error = "DESIGN_STITCH_API_KEY_REQUIRED: Stitch design generation requires STITCH_API_KEY; local fallback design generation is disabled.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    await failDesignPreclaim(ctx, error, { terminal: true });
    return;
  }

  ctx.context["stitch_project_id"] = projId;

  if (recoverDesignMdOnly) {
    try {
      await downloadStitchDesignMarkdown(ctx, stitchScript, repo, stitchDir, projId);
      return;
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      const error = redactDiagnosticText(e).slice(0, 500);
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error || "DESIGN_STITCH_DESIGN_MD_UNAVAILABLE", { terminal: true });
      return;
    }
  }

  // 2. Write one explicit batch prompt. The prompt lists every Product Surface
  // as a separate SCREEN_SPEC so Stitch generates the whole design set in one
  // call without falling back to per-screen generation.
  const promptFile = path.join(stitchDir, ".generate-prompt.txt");
  const designBriefPath = path.join(stitchDir, "DESIGN_BRIEF.md");
  const deviceType = ctx.context["device_type"] || "DESKTOP";
  const uiLanguage = ctx.context["ui_language"] || ctx.context["UI_LANGUAGE"] || "English";
  const designBrief = buildBatchStitchPrompt(repo, prd, deviceType, uiLanguage);
  fs.writeFileSync(designBriefPath, designBrief, "utf-8");
  fs.writeFileSync(promptFile, designBrief, "utf-8");
  logger.info(`[module:design preclaim] Generating screens (project ${projId}, device ${deviceType})`, { runId: ctx.runId });
  await recordPreClaimProgress(ctx, `Design preclaim: generating Stitch screens for ${deviceType}`);

  // 3. generate-all-screens (single Stitch batch call for every Product Surface).
  let batchGenerationCompleted = false;
  let lastStitchDiagnostic = "";
  let stitchProviderUnavailable = false;
  try {
    const batchResult = await generateStitchScreensInSingleBatch(ctx, stitchScript, repo, stitchDir, projId, prd, deviceType, uiLanguage);
    batchGenerationCompleted = batchResult.completed;
    stitchProviderUnavailable = batchResult.providerUnavailable;
    lastStitchDiagnostic = batchResult.diagnostic || lastStitchDiagnostic;
  } catch (e) {
    if (isPreclaimCancelledError(e)) return;
    const failureDetail = redactDiagnosticText(e).slice(0, 500);
    lastStitchDiagnostic = failureDetail;
    stitchProviderUnavailable = isStitchProviderUnavailable(failureDetail);
    logger.warn(`[module:design preclaim] generate-all-screens failed: ${failureDetail.slice(0, 200)}`, { runId: ctx.runId });
    if (stitchProviderUnavailable) {
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch provider unavailable during batch generation: ${failureDetail || "unknown error"}`);
    } else {
      await recordPreClaimProgress(ctx, `Design preclaim: batch Stitch generation failed: ${failureDetail || "unknown error"}; checking whether Stitch produced downloadable screens`);
    }
  }

  // 4. download-all with retries. When the batch call completed or returned an
  // ambiguous error, Stitch can still finish async work after a delay.
  let htmlCount = 0;
  const downloadAttempts = stitchProviderUnavailable ? 1 : (batchGenerationCompleted ? 3 : 1);
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
      const downloadDetail = redactDiagnosticText(e).slice(0, 300);
      logger.warn(`[module:design preclaim] download-all failed (attempt ${attempt + 1}/3): ${downloadDetail.slice(0, 200)}`, { runId: ctx.runId });
      lastStitchDiagnostic = downloadDetail || lastStitchDiagnostic;
      await recordPreClaimProgress(ctx, `Design preclaim: Stitch download failed on attempt ${attempt + 1}/${downloadAttempts}${downloadDetail ? `: ${downloadDetail}` : ""}`);
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

  // 4c. Optional manual recovery path. Disabled by default: Setfarm's normal
  // design mode must stay whole-batch Stitch generation, not per-screen calls.
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
    const suffix = lastStitchDiagnostic ? ` Last Stitch diagnostic: ${lastStitchDiagnostic.slice(0, 650)}` : "";
    const error = stitchProviderUnavailable
      ? `DESIGN_STITCH_SERVICE_UNAVAILABLE: STITCH_API_KEY is configured but the Stitch provider is temporarily unavailable.${suffix}`
      : `DESIGN_STITCH_HTML_UNAVAILABLE: STITCH_API_KEY is configured but Stitch produced 0 valid HTML screens after single batch generation, download, and tracking-file recovery.${suffix}`;
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    await failDesignPreclaim(ctx, error, { terminal: stitchProviderUnavailable });
    return;
  }

  if (htmlCount === 0) {
    const error = "DESIGN_STITCH_API_KEY_REQUIRED: Stitch design generation requires STITCH_API_KEY; local fallback design generation is disabled.";
    logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
    await failDesignPreclaim(ctx, error, { terminal: true });
    return;
  }

  if (htmlCount > 0 && hasStitchKey && projId && !manifestUsesLocalFallback(stitchDir)) {
    try {
      await downloadStitchDesignMarkdown(ctx, stitchScript, repo, stitchDir, projId);
    } catch (e) {
      if (isPreclaimCancelledError(e)) return;
      const error = redactDiagnosticText(e).slice(0, 500);
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error || "DESIGN_STITCH_DESIGN_MD_UNAVAILABLE", { terminal: true });
      return;
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
  let screenMap = readScreenMapFromStitchArtifacts(stitchDir, deviceType, ctx.runId);
  if (screenMap.length > 0) {
    let reconciliation = verifyScreenMapToSurfaces(screenMap, prd, { stitchDir });
    if (reconciliation.inlineCovered.length > 0) {
      await recordPreClaimProgress(ctx, `Design preclaim: inline-covered state surfaces (${reconciliation.inlineCovered.slice(0, 5).join("; ")})`);
    }
    if (reconciliation.missing.length > 0 && hasStitchKey && process.env.SETFARM_STITCH_TARGETED_SURFACE_RETRY === "1") {
      const retryTargets = screenTargetsForSurfaces(reconciliation.missingSurfaces);
      await recordPreClaimProgress(ctx, `Design preclaim: targeted retry for missing required Product Surfaces (${reconciliation.missing.slice(0, 5).join(", ")})`);
      try {
        await generateStitchScreensIndividually(
          ctx,
          stitchScript,
          repo,
          stitchDir,
          projId,
          prd,
          deviceType,
          uiLanguage,
          retryTargets,
          "Product Surface coverage mismatch",
        );
        screenMap = readScreenMapFromStitchArtifacts(stitchDir, deviceType, ctx.runId);
        reconciliation = verifyScreenMapToSurfaces(screenMap, prd, { stitchDir });
      } catch (e) {
        if (isPreclaimCancelledError(e)) return;
        logger.warn(`[module:design preclaim] targeted Product Surface retry failed: ${String(e).slice(0, 240)}`, { runId: ctx.runId });
      }
    }
    if (reconciliation.missing.length > 0 || reconciliation.screenMap.length === 0) {
      const detail = [
        reconciliation.missing.length ? `missing surfaces=${reconciliation.missing.slice(0, 8).join(", ")}` : "",
        reconciliation.unexpected.length ? `unexpected screens=${reconciliation.unexpected.slice(0, 8).join(", ")}` : "",
      ].filter(Boolean).join("; ");
      const error = `DESIGN_SURFACE_MISMATCH: Stitch output is missing required Product Surfaces after single batch generation. ${detail}. DESIGN must regenerate the whole scoped Stitch batch before stories/implementation.`;
      logger.warn(`[module:design preclaim] ${error}`, { runId: ctx.runId });
      await failDesignPreclaim(ctx, error);
      return;
    }
    if (reconciliation.screenMap.length !== screenMap.length || reconciliation.duplicates.length > 0 || reconciliation.unexpected.length > 0 || reconciliation.inlineCovered.length > 0) {
      const detail = [
        reconciliation.duplicates.length ? `duplicates=${[...new Set(reconciliation.duplicates)].slice(0, 8).join(",")}` : "",
        reconciliation.unexpected.length ? `dropped_unexpected=${[...new Set(reconciliation.unexpected)].slice(0, 8).join(",")}` : "",
        reconciliation.inlineCovered.length ? `inline_covered=${reconciliation.inlineCovered.length}` : "",
        `final=${reconciliation.screenMap.length}`,
      ].filter(Boolean).join(" ");
      ctx.context["design_reconciliation"] = detail;
      await recordPreClaimProgress(ctx, `Design preclaim: reconciled SCREEN_MAP to Product Surfaces (${detail})`);
      logger.warn(`[module:design preclaim] Reconciled SCREEN_MAP to Product Surfaces: ${detail}`, { runId: ctx.runId });
    }
    screenMap = reconciliation.screenMap;
    rewriteScreenArtifactsForScreenMap(stitchDir, screenMap, deviceType);
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
