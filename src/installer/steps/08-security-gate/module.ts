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
    STORIES_JSON: c["stories_json"] || "[]",
    FINAL_PR: c["final_pr"] || c["pr_url"] || "",
    PROGRESS: c["progress"] || "",
  });
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const securityGateModule: StepModule = {
  id: "security-gate",
  type: "single",
  agentRole: "security-gate",
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 12288,
};
