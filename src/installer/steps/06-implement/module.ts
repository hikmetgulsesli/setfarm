import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, ClaimContext, PromptContext } from "../types.js";
import { normalize, validateOutput } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const story = ctx.context["current_story"] || "";
  const scope = ctx.context["story_scope_files"] || "";
  const scopeReminder = ctx.context["scope_reminder"] || "";
  const designRules = ctx.context["design_rules"] || "";
  const storyScreens = ctx.context["story_screens"] || "";

  let prompt = promptTemplate
    .replace(/\{\{TASK\}\}/g, ctx.task)
    .replace(/\{\{STORY\}\}/g, story)
    .replace(/\{\{SCOPE_FILES\}\}/g, scope)
    .replace(/\{\{SCOPE_REMINDER\}\}/g, scopeReminder)
    .replace(/\{\{DESIGN_RULES\}\}/g, designRules)
    .replace(/\{\{STORY_SCREENS\}\}/g, storyScreens);

  return `${prompt}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

async function injectContext(ctx: ClaimContext): Promise<void> {
  // Context injection for implement is handled by injectStoryContext()
  // which runs in the loop claim path (after story selection), not here.
  // This method is called before story selection, so it's a no-op.
  // The actual injection is in 06-implement/context.ts.
}

export const implementModule: StepModule = {
  id: "implement",
  type: "loop",
  agentRole: "developer",
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  // preClaim and onComplete are not used — implement's heavy logic runs
  // in the loop claim/completion paths of step-ops.ts which call exported
  // functions from context.ts and guards.ts directly.
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 32768,
};
