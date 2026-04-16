import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, ClaimContext, PromptContext } from "../types.js";
import { normalize, validateOutput } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(_ctx: PromptContext): string {
  // Implement is a loop step — the real prompt comes from AGENTS.md via
  // workflow.yml input_template, enriched by injectStoryContext in the
  // loop claim path. Returning empty string preserves the 869-line
  // AGENTS.md template instead of replacing it with a thin skeleton.
  // The rules.md scope enforcement is injected via context["scope_reminder"]
  // by injectStoryContext, so it still reaches the agent.
  return "";
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
