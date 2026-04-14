import path from "node:path";
import fs from "node:fs";
import type { ClaimContext } from "../types.js";
import { logger } from "../../../lib/logger.js";

const FIRST_ATTEMPT_REMINDER =
  "REMINDER: STORIES_JSON array zorunlu. Her story: id, title, description, " +
  "acceptanceCriteria, depends_on, screens, scope_files (NO overlapping files), " +
  "shared_files, scope_description. Hayali screen yolu (src/pages/*.tsx) YASAK — " +
  "PREDICTED_SCREEN_FILES context'ten kullan. Missing = instant REJECT.";

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

export function computePredictedScreenFiles(repoPath: string): Array<{ screenId: string; title: string; filePath: string }> {
  if (!repoPath) return [];
  const manifestPath = path.join(repoPath, "stitch", "DESIGN_MANIFEST.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    if (!Array.isArray(manifest)) return [];
    return manifest
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

export async function injectContext(ctx: ClaimContext): Promise<void> {
  const repo = ctx.context["repo"] || "";
  const predictedScreens = computePredictedScreenFiles(repo);
  if (predictedScreens.length > 0) {
    ctx.context["predicted_screen_files"] = JSON.stringify(predictedScreens, null, 2);
    logger.info(`[module:stories] Injected ${predictedScreens.length} predicted screen path(s)`, { runId: ctx.runId });
  }
  if (ctx.retryCount === 0 && !ctx.context["previous_failure"]) {
    ctx.context["previous_failure"] = FIRST_ATTEMPT_REMINDER;
  }
}
