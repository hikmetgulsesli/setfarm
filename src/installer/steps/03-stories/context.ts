import path from "node:path";
import fs from "node:fs";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: STORIES_JSON array zorunlu. Her story: id, title, description, " +
  "acceptanceCriteria, depends_on, screens, scope_files (NO overlapping files), " +
  "shared_files, scope_description. Hayali screen yolu (src/pages/*.tsx) YASAK — " +
  "PREDICTED_SCREEN_FILES context'ten kullan. Missing = instant REJECT.";

export function extractExplicitMaxStories(text: string): number | null {
  const patterns = [
    /\ben\s+(?:fazla|çok)\s+(\d+)\s+(?:adet\s+)?(?:k[iı]sa\s+)?(?:user\s+)?stor(?:y|ies)\b/i,
    /\b(?:maksimum|maks|azami)\s+(\d+)\s+(?:adet\s+)?(?:k[iı]sa\s+)?(?:user\s+)?stor(?:y|ies)\b/i,
    /\bmax(?:imum)?\s+(\d+)\s+(?:user\s+)?stor(?:y|ies)\b/i,
    /\b(\d+)\s+(?:adet\s+)?(?:user\s+)?stor(?:y|ies)\s+(?:max|maximum|maksimum|maks|azami)\b/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const n = m ? Number(m[1]) : 0;
    if (Number.isInteger(n) && n > 0 && n < 50) return n;
  }
  return null;
}

// Mirror of scripts/stitch-to-jsx.mjs toComponentName. Used to predict the
// final screen file paths (src/screens/<TurkishName>.tsx) before stitch-to-jsx
// runs in setup-build, so the stories planner uses correct paths in scope_files.
function toComponentNameForStitch(title: string): string {
  return title
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/).filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function isPrdPseudoScreen(screen: any): boolean {
  const title = String(screen?.title || screen?.name || "").trim().toLowerCase();
  const htmlFile = String(screen?.htmlFile || "").trim().toLowerCase();
  return /\bprd\b/.test(title) || /\bprd\b/.test(htmlFile);
}

export function computePredictedScreenFiles(repoPath: string): Array<{ screenId: string; title: string; filePath: string }> {
  if (!repoPath) return [];
  const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    if (!Array.isArray(manifest)) return [];
    return manifest
      .filter((s: any) => !isPrdPseudoScreen(s))
      .filter((s: any) => s?.title && s?.screenId)
      .map((s: any) => {
        const name = toComponentNameForStitch(String(s.title));
        return { screenId: String(s.screenId), title: String(s.title), filePath: name ? `src/screens/${name}.tsx` : "" };
      })
      .filter(s => s.filePath !== "");
  } catch (e) {
    logger.warn(`[module:stories] DESIGN_MANIFEST parse failed: ${String(e).slice(0, 120)}`);
    return [];
  }
}

export interface UiBehaviorRequirement {
  screenId: string;
  screenTitle: string;
  kind: "button" | "link" | "input";
  label: string;
  icon?: string;
  action?: string;
  route?: string;
  expectedBehavior: string;
}

export function normalizeUiBehaviorText(text: string): string {
  return String(text || "")
    .replace(/[İ]/g, "I").replace(/[ı]/g, "i")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o")
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function controlLabel(item: any): string {
  const raw = String(item?.label || item?.text || item?.placeholder || item?.name || item?.icon || item?.href || "").trim();
  const icon = String(item?.icon || "").trim();
  if (!raw) return icon;
  if (!icon) return raw.replace(/\s+/g, " ").trim();
  return raw
    .split(/\s+/)
    .filter((part) => normalizeUiBehaviorText(part) !== normalizeUiBehaviorText(icon))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || icon;
}

function inferExpectedBehavior(item: any, kind: UiBehaviorRequirement["kind"]): string {
  if (kind === "link") return `navigate:${item?.href || item?.route || "target page"}`;
  if (kind === "input") return "controlled value with onChange; validate when submitted";
  if (item?.expectedBehavior) return String(item.expectedBehavior);
  if (item?.expectedRoute || item?.route) return `navigate:${item.expectedRoute || item.route}`;
  switch (String(item?.action || "")) {
    case "increment": return "increase visible value/state";
    case "decrement": return "decrease visible value/state";
    case "reset": return "reset visible value/state";
    case "form-submit": return "validate inputs and submit/apply changes";
    case "create": return "open create flow or add item/state";
    case "edit": return "open edit/update flow";
    case "search": return "filter/search visible results";
    case "destructive": return "perform action with confirmation or visible feedback";
    default: return "produce visible DOM/state/URL feedback; never empty onClick";
  }
}

export function collectUiBehaviorRequirements(repoPath: string): UiBehaviorRequirement[] {
  if (!repoPath) return [];
  const domPath = path.join(repoPath, "stitch", "DESIGN_DOM.json");
  if (!fs.existsSync(domPath)) return [];
  try {
    const dom = JSON.parse(fs.readFileSync(domPath, "utf-8"));
    const screens = dom?.screens || dom;
    if (!screens || typeof screens !== "object") return [];

    const reqs: UiBehaviorRequirement[] = [];
    const seen = new Set<string>();
    for (const [screenId, sd] of Object.entries(screens as Record<string, any>)) {
      const screenTitle = String(sd?.title || screenId);
      const add = (kind: UiBehaviorRequirement["kind"], item: any) => {
        const label = controlLabel(item);
        const icon = item?.icon ? String(item.icon) : undefined;
        const route = item?.route || item?.href || item?.expectedRoute;
        if (!label && !icon && !route) return;
        const req: UiBehaviorRequirement = {
          screenId,
          screenTitle,
          kind,
          label: label || icon || route,
          icon,
          action: item?.action ? String(item.action) : undefined,
          route: route ? String(route) : undefined,
          expectedBehavior: inferExpectedBehavior(item, kind),
        };
        const key = [
          req.screenId, req.kind, normalizeUiBehaviorText(req.label),
          normalizeUiBehaviorText(req.icon || ""), normalizeUiBehaviorText(req.route || ""),
        ].join("|");
        if (seen.has(key)) return;
        seen.add(key);
        reqs.push(req);
      };

      if (Array.isArray(sd?.behaviorContract)) {
        for (const item of sd.behaviorContract) {
          if (item?.kind === "link") add("link", item);
          else if (item?.kind === "input") add("input", item);
          else add("button", item);
        }
      } else {
        for (const item of Array.isArray(sd?.navLinks) ? sd.navLinks : []) add("link", item);
        for (const item of Array.isArray(sd?.buttons) ? sd.buttons : []) add("button", item);
        for (const item of Array.isArray(sd?.inputs) ? sd.inputs : []) add("input", item);
      }
    }
    return reqs;
  } catch (e) {
    logger.warn(`[module:stories] UI behavior contract parse failed: ${String(e).slice(0, 120)}`);
    return [];
  }
}

export function computeUiBehaviorContract(repoPath: string): string {
  const reqs = collectUiBehaviorRequirements(repoPath);
  if (reqs.length === 0) return "";
  const lines = [
    "Every control below MUST be owned by a story acceptance criterion before coding starts.",
    "Each criterion must state the exact trigger label/icon and the visible behavior.",
  ];
  let currentScreen = "";
  let totalBytes = lines.join("\n").length;
  const BUDGET = 6000;
  for (const req of reqs) {
    const screenLine = `- ${req.screenId} (${req.screenTitle})`;
    if (currentScreen !== req.screenId) {
      if (totalBytes + screenLine.length > BUDGET) break;
      lines.push(screenLine);
      totalBytes += screenLine.length + 1;
      currentScreen = req.screenId;
    }
    const bits = [
      `${req.kind} "${req.label}"`,
      req.icon ? `icon=${req.icon}` : "",
      req.action ? `action=${req.action}` : "",
      req.route ? `route=${req.route}` : "",
      `expects=${req.expectedBehavior}`,
    ].filter(Boolean);
    const line = `  - ${bits.join("; ")}`;
    if (totalBytes + line.length > BUDGET) {
      lines.push("  - ...(truncated; read stitch/DESIGN_DOM.json for full behavior contract)");
      break;
    }
    lines.push(line);
    totalBytes += line.length + 1;
  }
  return lines.join("\n");
}

// Compact DESIGN_DOM summary for the stories planner. Full DOM is too big
// (~50-200KB) — planner needs element counts + behavior labels to decide
// scope_files accurately. Cap at ~4KB total.
export function computeDesignDomPreview(repoPath: string): string {
  if (!repoPath) return "";
  const domPath = path.join(repoPath, "stitch", "DESIGN_DOM.json");
  if (!fs.existsSync(domPath)) return "";
  try {
    const raw = fs.readFileSync(domPath, "utf-8");
    const dom = JSON.parse(raw);
    const screens = dom?.screens || dom;
    if (!screens || typeof screens !== "object") return "";

    const entries: string[] = [];
    let totalBytes = 0;
    const BUDGET = 4000;

    for (const [screenId, sd] of Object.entries(screens as Record<string, any>)) {
      if (totalBytes >= BUDGET) break;
      const buttons: string[] = Array.isArray(sd?.buttons) ? sd.buttons.map((b: any) => typeof b === "string" ? b : controlLabel(b)).filter(Boolean).slice(0, 8) : [];
      const inputs: string[] = Array.isArray(sd?.inputs) ? sd.inputs.map((i: any) => typeof i === "string" ? i : controlLabel(i)).filter(Boolean).slice(0, 6) : [];
      const behavior: string[] = Array.isArray(sd?.behaviorContract)
        ? sd.behaviorContract.map((b: any) => `${b.kind || "button"}:${controlLabel(b)}->${b.expectedBehavior || b.action || b.route || ""}`).filter(Boolean).slice(0, 6)
        : [];
      const elementCount = (sd?.elements?.length) || (buttons.length + inputs.length) || 0;
      const title = sd?.title || screenId;
      const line = `- ${screenId} (${title}): ${elementCount} elements, buttons=[${buttons.join(", ")}], inputs=[${inputs.join(", ")}], behavior=[${behavior.join(" | ")}]`;
      if (totalBytes + line.length > BUDGET) break;
      entries.push(line);
      totalBytes += line.length + 1;
    }
    return entries.join("\n");
  } catch (e) {
    logger.warn(`[module:stories] DESIGN_DOM preview parse failed: ${String(e).slice(0, 120)}`);
    return "";
  }
}

export async function injectContext(ctx: ClaimContext): Promise<void> {
  const maxStories = extractExplicitMaxStories(`${ctx.task || ""}\n${ctx.context["task"] || ""}\n${ctx.context["prd"] || ""}`);
  if (maxStories) {
    ctx.context["story_count_hint"] = `MAX_STORIES=${maxStories} (explicit user cap; includes setup and integration)`;
    logger.info(`[module:stories] Injected explicit story cap: ${maxStories}`, { runId: ctx.runId });
  } else {
    ctx.context["story_count_hint"] = "NO_EXPLICIT_LIMIT";
  }

  const repo = ctx.context["repo"] || "";
  const predictedScreens = computePredictedScreenFiles(repo);
  if (predictedScreens.length > 0) {
    ctx.context["predicted_screen_files"] = JSON.stringify(predictedScreens, null, 2);
    logger.info(`[module:stories] Injected ${predictedScreens.length} predicted screen path(s)`, { runId: ctx.runId });
  }
  const domPreview = computeDesignDomPreview(repo);
  if (domPreview) {
    ctx.context["design_dom_preview"] = domPreview;
    logger.info(`[module:stories] Injected DESIGN_DOM preview (${domPreview.length} bytes)`, { runId: ctx.runId });
  }
  const behaviorContract = computeUiBehaviorContract(repo);
  if (behaviorContract) {
    ctx.context["ui_behavior_contract"] = behaviorContract;
    logger.info(`[module:stories] Injected UI behavior contract (${behaviorContract.length} bytes)`, { runId: ctx.runId });
  }
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
