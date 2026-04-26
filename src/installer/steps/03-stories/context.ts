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

// Compact DESIGN_DOM summary for the stories planner. Full DOM is too big
// (~50-200KB) — planner only needs element counts + button/input labels to
// decide scope_files accurately. Cap at ~4KB total.
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
      const buttons: string[] = Array.isArray(sd?.buttons) ? sd.buttons.map((b: any) => typeof b === "string" ? b : b?.label || b?.text || "").filter(Boolean).slice(0, 8) : [];
      const inputs: string[] = Array.isArray(sd?.inputs) ? sd.inputs.map((i: any) => typeof i === "string" ? i : i?.placeholder || i?.label || i?.name || "").filter(Boolean).slice(0, 6) : [];
      const elementCount = (sd?.elements?.length) || (buttons.length + inputs.length) || 0;
      const title = sd?.title || screenId;
      const line = `- ${screenId} (${title}): ${elementCount} elements, buttons=[${buttons.join(", ")}], inputs=[${inputs.join(", ")}]`;
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
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
