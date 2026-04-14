import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput, onComplete } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load prompt/rules at module init. Cached for the process lifetime —
// any edit to the markdown requires a process restart.
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const task = ctx.context["task"] || ctx.task || "";
  const resolved = promptTemplate.replace(/\{\{TASK\}\}/g, task);
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const planModule: StepModule = {
  id: "plan",
  type: "single",
  agentRole: "planner",
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS", "REPO", "BRANCH", "TECH_STACK", "PRD", "PRD_SCREEN_COUNT", "DB_REQUIRED"],
  maxPromptSize: 8192,
};
