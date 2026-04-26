import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { validateOutput, onComplete } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const c = ctx.context;
  const resolved = promptTemplate
    .replace(/\{\{REPO\}\}/g, c["repo"] || c["REPO"] || "")
    .replace(/\{\{PRD\}\}/g, c["prd"] || c["PRD"] || "")
    .replace(/\{\{SCREEN_MAP\}\}/g, c["screen_map"] || c["SCREEN_MAP"] || "[]")
    .replace(/\{\{DESIGN_SYSTEM\}\}/g, c["design_system"] || c["DESIGN_SYSTEM"] || "{}")
    .replace(/\{\{STORY_COUNT_HINT\}\}/g, c["story_count_hint"] || "NO_EXPLICIT_LIMIT")
    .replace(/\{\{PREDICTED_SCREEN_FILES\}\}/g, c["predicted_screen_files"] || "[]")
    .replace(/\{\{UI_BEHAVIOR_CONTRACT\}\}/g, c["ui_behavior_contract"] || "(none)")
    .replace(/\{\{DESIGN_DOM_PREVIEW\}\}/g, c["design_dom_preview"] || "(none)");
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const storiesModule: StepModule = {
  id: "stories",
  type: "single",
  agentRole: "planner",
  injectContext,
  buildPrompt,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS"],
  // Includes resolved PRD (~3-5KB) + SCREEN_MAP (~2KB) + rules (~3KB)
  maxPromptSize: 32768,
};
