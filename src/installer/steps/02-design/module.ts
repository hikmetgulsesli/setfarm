import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { preClaim } from "./preclaim.js";
import { injectContext } from "./context.js";
import { validateOutput, onComplete } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const repo = ctx.context["repo"] || ctx.context["REPO"] || "";
  const screenCount = ctx.context["prd_screen_count"] || ctx.context["PRD_SCREEN_COUNT"] || "?";
  const resolved = promptTemplate
    .replace(/\{\{REPO\}\}/g, repo)
    .replace(/\{\{PRD_SCREEN_COUNT\}\}/g, screenCount);
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const designModule: StepModule = {
  id: "design",
  type: "single",
  agentRole: "designer",
  preClaim,
  injectContext,
  buildPrompt,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 10240,
};
