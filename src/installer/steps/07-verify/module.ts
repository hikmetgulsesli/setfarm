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
    CURRENT_STORY_ID: c["current_story_id"] || "",
    PR_URL: c["pr_url"] || c["final_pr"] || "",
    BUILD_CMD: c["build_cmd"] || "npm run build",
    TEST_CMD: c["test_cmd"] || "true",
    LINT_CMD: c["lint_cmd"] || "true",
    PREFLIGHT_ANALYSIS: c["preflight_analysis"] || "(no pre-flight run)",
    STORIES_JSON: c["stories_json"] || "[]",
    PROGRESS: c["progress"] || "",
    PR_COMMENTS: c["pr_comments"] || "",
    PR_CHECK_STATE: c["pr_check_state"] || "",
    PR_MERGEABLE: c["pr_mergeable"] || "",
    PR_MERGE_STATE_STATUS: c["pr_merge_state_status"] || "",
    PLAYWRIGHT_REPORT: c["playwright_report"] || "",
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
