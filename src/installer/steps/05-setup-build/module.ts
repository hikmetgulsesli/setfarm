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
  const c = ctx.context;
  const resolved = promptTemplate
    .replace(/\{\{REPO\}\}/g, c["repo"] || "")
    .replace(/\{\{TECH_STACK\}\}/g, c["tech_stack"] || "vite-react")
    .replace(/\{\{BUILD_CMD_HINT\}\}/g, c["build_cmd_hint"] || "npm run build");
  return `${resolved}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const setupBuildModule: StepModule = {
  id: "setup-build",
  type: "single",
  agentRole: "setup-build",
  preClaim,
  injectContext,
  buildPrompt,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 6144,
};
