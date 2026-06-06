import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { resolveTemplate } from "../_shared/prompt-resolver.js";
import { injectContext } from "./context.js";
import { normalize, onComplete, validateOutput } from "./guards.js";
import { preClaim } from "./preclaim.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const c = ctx.context;
  const resolved = resolveTemplate(promptTemplate, {
    REPO: c["repo"] || "",
    BRANCH: c["branch"] || "main",
    STORIES_JSON: c["stories_json"] || "[]",
    FINAL_PR: c["final_pr"] || c["pr_url"] || "",
    PROGRESS: c["progress"] || "",
  });
  return `${resolved}\n\n---\n\n# Stack Evidence Contract\n\n${c["stack_contract"] || ""}\n\n${c["stack_verification_contract"] || ""}\n\n# Runtime Contract\n\n${c["stack_runtime_contract"] || ""}\n\n# Tool Preflight Contract\n\n${c["stack_tool_preflight_contract"] || ""}\n\n---\n\n# Rules\n\n${rulesBody}`;
}

export const qaTestModule: StepModule = {
  id: "qa-test",
  type: "single",
  agentRole: "qa-tester",
  injectContext,
  buildPrompt,
  preClaim,
  normalize,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 12288,
};
