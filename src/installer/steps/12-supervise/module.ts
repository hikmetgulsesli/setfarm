import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PromptContext, StepModule } from "../types.js";
import { resolveTemplate } from "../_shared/prompt-resolver.js";
import { injectContext } from "./context.js";
import { onComplete, validateOutput } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");

function buildPrompt(ctx: PromptContext): string {
  const c = ctx.context;
  const resolved = resolveTemplate(promptTemplate, {
    TASK: c["task"] || "",
    REPO: c["repo"] || "",
    BRANCH: c["branch"] || "main",
    BUILD_CMD: c["build_cmd"] || "npm run build",
    TEST_CMD: c["test_cmd"] || "true",
    LINT_CMD: c["lint_cmd"] || "true",
    PRD: c["prd"] || "",
    SCREEN_MAP: c["screen_map"] || "[]",
    STORIES_JSON: c["stories_json"] || "[]",
    DESIGN_MANIFEST: c["design_manifest"] || "",
    DESIGN_TOKENS: c["design_tokens"] || "",
    DESIGN_MD_EXCERPT: c["design_md_excerpt"] || "(no DESIGN.md)",
    UI_BEHAVIOR_CONTRACT: c["ui_behavior_contract"] || "",
    SUPERVISOR_MEMORY: c["supervisor_memory"] || "(no supervisor memory yet)",
    PROJECT_MEMORY: c["project_memory"] || "(no project memory yet)",
    PROGRESS: c["progress"] || "",
    SUPERVISOR_GIT_SUMMARY: c["supervisor_git_summary"] || "",
    PROJECT_TREE: c["project_tree"] || "",
    INSTALLED_PACKAGES: c["installed_packages"] || "",
    COMPONENT_REGISTRY: c["component_registry"] || "",
    API_ROUTES: c["api_routes"] || "",
    SHARED_CODE: c["shared_code"] || "",
    PACKAGE_JSON_EXCERPT: c["package_json_excerpt"] || "",
    PREVIOUS_FAILURE: c["previous_failure"] || "",
  });
  return `${resolved}\n\n---\n\n# Rules\n\n${rulesBody}`;
}

export const superviseModule: StepModule = {
  id: "supervise",
  type: "single",
  agentRole: "supervisor",
  injectContext,
  buildPrompt,
  validateOutput,
  onComplete,
  requiredOutputFields: ["STATUS", "SUPERVISOR_DECISION"],
  maxPromptSize: 32768,
};

