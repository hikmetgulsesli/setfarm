import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { resolveTemplate } from "../_shared/prompt-resolver.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput, onComplete } from "./guards.js";
import { preClaim } from "./preclaim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const c = ctx.context;
  const resolved = resolveTemplate(promptTemplate, {
    REPO: c["repo"] || "",
    BRANCH: c["branch"] || "main",
    FINAL_PR: c["final_pr"] || c["pr_url"] || "",
    STORIES_JSON: c["stories_json"] || "[]",
    PROGRESS: c["progress"] || "",
  });
  return `${resolved}\n\n---\n\n# Stack Evidence Contract\n\n${c["stack_contract"] || ""}\n\n${c["stack_verification_contract"] || ""}\n\n---\n\n# Rules\n\n${rulesBody}`;
}

export const finalTestModule: StepModule = {
  id: "final-test",
  type: "single",
  agentRole: "tester",
  preClaim,
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 12288,
};
