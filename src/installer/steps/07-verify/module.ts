import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { resolveTemplate } from "../_shared/prompt-resolver.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const c = ctx.context;
  const resolved = resolveTemplate(promptTemplate, {
    REPO: c["repo"] || "",
    BRANCH: c["branch"] || "main",
    CURRENT_STORY: c["current_story"] || "",
    PR_URL: c["pr_url"] || c["final_pr"] || "",
    PREFLIGHT_ANALYSIS: c["preflight_analysis"] || "(no pre-flight run)",
    STORIES_JSON: c["stories_json"] || "[]",
    PROGRESS: c["progress"] || "",
  });
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const verifyModule: StepModule = {
  id: "verify",
  type: "single",
  agentRole: "reviewer",
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 16384,
};
