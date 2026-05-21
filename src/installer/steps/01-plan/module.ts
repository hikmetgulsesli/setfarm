import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput, onComplete } from "./guards.js";
import { preClaim } from "./preclaim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load prompt/rules at module init. Cached for the process lifetime —
// any edit to the markdown requires a process restart.
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const task = ctx.context["task"] || ctx.task || "";
  const resolved = promptTemplate.replace(/\{\{TASK\}\}/g, task);
  return `${resolved}\n\n---\n\n# Rules\n\n${rulesBody}`;
}

export const planModule: StepModule = {
  id: "plan",
  type: "single",
  agentRole: "planner",
  preClaim,
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  onComplete,
  requiredOutputFields: ["CONTRACT_SCHEMA_VERSION", "STATUS", "PROJECT_NAME", "PROJECT_SLUG", "PLATFORM", "TECH_STACK", "UI_LANGUAGE", "DB_REQUIRED", "DESIGN_REQUIRED", "UI_VISION_SUMMARY", "PRD"],
  maxPromptSize: 12000,
};
