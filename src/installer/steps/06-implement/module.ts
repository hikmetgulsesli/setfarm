import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StepModule, ClaimContext, PromptContext } from "../types.js";
import { normalize, validateOutput } from "./guards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
function buildPrompt(ctx: PromptContext): string {
  if (
    ctx.context["implementation_context_protocol"] === "v3"
    || ctx.context["implementation_slice_ref"]
  ) {
    return [
      "# Product Compiler v3 Implementation Claim Locator",
      "",
      "This locator is transport metadata only. It is not a product/build contract and contains no retry instructions.",
      "The spawner-generated setfarm.implementation-context.v3 file is the sole canonical implementation authority.",
      "",
      `RUN_ID: ${ctx.context["RUN_ID"] || ctx.runId}`,
      `STORY_ID: ${ctx.context["STORY_ID"] || ""}`,
      `STORY_BRANCH: ${ctx.context["STORY_BRANCH"] || ""}`,
      `STORY_WORKDIR: ${ctx.context["STORY_WORKDIR"] || ""}`,
      `PACKET_HASH: ${ctx.context["product_build_packet_hash"] || ""}`,
      `SLICE_HASH: ${ctx.context["implementation_slice_hash"] || ""}`,
      `SLICE_REF: ${ctx.context["implementation_slice_ref"] || ""}`,
      `COMPILATION_REPORT_HASH: ${ctx.context["product_compilation_report_hash"] || ""}`,
      `EVIDENCE_PLAN_HASH: ${ctx.context["evidence_plan_hash"] || ""}`,
      `EVIDENCE_PLAN_ARTIFACT_HASH: ${ctx.context["evidence_plan_artifact_hash"] || ""}`,
      `EVIDENCE_PLAN_REF: ${ctx.context["evidence_plan_ref"] || ""}`,
      `FINDING_SET_HASH: ${ctx.context["finding_set_hash"] || ""}`,
      `RECOVERY_CASE_REVISION_ID: ${ctx.context["recovery_case_revision_id"] || ""}`,
      `RECOVERY_DISPATCH_ID: ${ctx.context["recovery_dispatch_id"] || ""}`,
      `RECOVERY_DISPATCH_CLASS: ${ctx.context["recovery_dispatch_class"] || ""}`,
    ].join("\n");
  }
  // Loop claims resolve this module prompt after injectStoryContext() fills
  // story-specific variables. Keep implement instructions in one source so
  // workflow.yml cannot drift into conflicting git/scope commands.
  return promptTemplate;
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
