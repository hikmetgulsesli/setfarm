import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { validateOutput, onComplete } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(_ctx: PromptContext): string {
  // Stories prompt is static — context vars (PRD, screen_map, predicted_screen_files)
  // arrive via the resolved input_template, not via template substitution here.
  return `${promptTemplate}\n\n---\n\n# Kurallar\n\n${rulesBody}`;
}

export const storiesModule: StepModule = {
  id: "stories",
  type: "single",
  agentRole: "planner",
  injectContext,
  buildPrompt,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS"],
  maxPromptSize: 12288,
};
