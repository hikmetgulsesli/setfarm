import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const c = ctx.context;
  const projectName = (c["repo"] || "").split("/").pop() || "";
  const resolved = promptTemplate
    .replace(/\{\{REPO\}\}/g, c["repo"] || "")
    .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
    .replace(/\{\{BUILD_CMD\}\}/g, c["build_cmd"] || "npm run build")
    .replace(/\{\{TECH_STACK\}\}/g, c["tech_stack"] || "vite-react")
    .replace(/\{\{FINAL_PR\}\}/g, c["final_pr"] || c["pr_url"] || "")
    .replace(/\{\{PROGRESS\}\}/g, c["progress"] || "");
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const deployModule: StepModule = {
  id: "deploy",
  type: "single",
  agentRole: "deployer",
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 10240,
};
