import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput, onComplete } from "./guards.js";
import { preClaim } from "./preclaim.js";
import { PlanSemanticProposalV1Schema } from "../../../product-compiler/schemas/plan-semantic-proposal-v1.js";
import { PlanSemanticProposalV2Schema } from "../../../product-compiler/schemas/plan-semantic-proposal-v2.js";
import { TaskRequirementLedgerV1Schema } from "../../../product-compiler/requirements/task-requirements-v1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load prompt/rules at module init. Cached for the process lifetime —
// any edit to the markdown requires a process restart.
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");
const semanticProposalJsonSchema = JSON.stringify(z.toJSONSchema(
  PlanSemanticProposalV1Schema,
  { reused: "ref" },
), null, 2);
const semanticProposalV2JsonSchema = JSON.stringify(z.toJSONSchema(
  PlanSemanticProposalV2Schema,
  { reused: "ref" },
), null, 2);

function compactRequirementIndex(rawLedger: string): string {
  try {
    const ledger = TaskRequirementLedgerV1Schema.parse(JSON.parse(rawLedger));
    return JSON.stringify({
      schema: "setfarm.plan-requirement-index.v1",
      sourceTaskHash: ledger.sourceHash,
      requirements: ledger.requirements.map((requirement) => ({
        id: requirement.id,
        normalizedClause: requirement.normalizedClause,
      })),
    });
  } catch {
    return rawLedger;
  }
}

function buildV3Prompt(ctx: PromptContext): string {
  const productSemanticsVersion = ctx.context["product_semantics_version"] === "v2"
    ? "v2"
    : "v1";
  const proposalFence = `plan-semantic-proposal-${productSemanticsVersion}`;
  const proposalSchema = productSemanticsVersion === "v2"
    ? semanticProposalV2JsonSchema
    : semanticProposalJsonSchema;
  const task = ctx.context["task"] || ctx.task || "";
  const requirementLedger = ctx.context["v3_requirement_ledger"] || "";
  const requestedStackPackId = ctx.context["v3_requested_stack_pack_id"] || "";
  return [
    "PLAN v3 - primary semantic proposal",
    "",
    "You propose only primary product semantics and exact requirement references. Setfarm compiles all global IDs, delivery profiles, source bytes, persistence runtime ownership/durability/payloads, outcomes, evidence IDs/capabilities, traceability, canonical JSON, runtime identity, and verdicts.",
    "",
    "## Exact task",
    task,
    "",
    "## Setfarm-owned requirement index",
    "Classify every exact requirement ID once. Bind every semantic node to one or more IDs; never copy source spans, hashes, or clause bytes into the proposal.",
    "```plan-requirement-index-v1",
    compactRequirementIndex(requirementLedger),
    "```",
    "",
    "## Compiler-owned delivery",
    "Setfarm currently activates utility and operations on its exact web profile and game on its exact browser-game profile. Emit only product.class and database intent; do not emit platform, tech stack, stack pack, design policy, or capability IDs.",
    requestedStackPackId
      ? `The compiler will validate the explicit requested stack pack ${requestedStackPackId}; do not repeat or reinterpret it.`
      : "No explicit stack prefix was requested; the compiler selects delivery from product.class.",
    "",
    "## Proposal rules",
    `- Emit exactly one ${proposalFence} JSON fence. Pretty or unsorted JSON is allowed.`,
    "- Use lowercase local keys only. Do not emit PROD_/STATE_/ACT_/EVID_/SURF_ or any other global ID.",
    "- Every goal, non-goal, entity, state, persistence policy, route, surface, action, observable, and assumption cites exact requirementRefs.",
    ...(productSemanticsVersion === "v2"
      ? [
          "- Every route has exactly one route_root surface. Other same-route surfaces use composition.kind=contained and an exact hostSurfaceKey; contained surfaces are not separate screens.",
          "- Every user action declares exact controlPlacements. Each placement is one physical control on one surface; affectedSurfaceKeys are behavior/effect context and never imply a rendered control.",
          "- Every user action evidenceScenario selects one exact controlPlacementKey. Control observables also select an exact controlPlacementKey.",
        ]
      : ["- Routes do not repeat surface refs; surfaces name their routeKey and Setfarm closes the route graph."]),
    "- Persistence intents name stateDeltaKeys, never state-path copies or payloadFields. Setfarm derives both.",
    "- Declare an input only when an input or inputs valueFrom consumes it. Fixed outcomes use literal deltas and no synthetic input.",
    "- Every state must have an action precondition, delta, or value-source owner. Do not invent busy/loading/UI state unless behavior in the exact task owns it.",
    "- Every action needs at least one observable with an after assertion. Durable writes additionally need a reload assertion.",
    "- Observable selectors bind the owning control or an exact action surface/accessibility role and name. Setfarm generates observable and evidence identities.",
    "- Use an empty or RFC 6901 path beginning with '/'; escape '~' as '~0' and '/' within a token as '~1'.",
    "- If primary semantics are ambiguous, contradictory, missing, or outside activated product classes, emit the typed rejection instead of guessing.",
    "",
    "## PlanSemanticProposal JSON Schema",
    "```json",
    proposalSchema,
    "```",
    "",
    "## Success output",
    "```text",
    "STATUS: done",
    "PRD:",
    `\`\`\`${proposalFence}`,
    "{ ...one primary semantic proposal... }",
    "```",
    "```",
    "",
    "## Typed rejection output",
    "Use STATUS: done and exactly one product-spec-rejection-v1 fence with schema, exact sourceTaskHash, and one or more reasons. Allowed reason codes: PRODUCT_SPEC_TASK_AMBIGUOUS, PRODUCT_SPEC_SEMANTIC_UNSUPPORTED, PRODUCT_SPEC_REQUIREMENT_CONFLICT, PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING. Every reason cites exact requirementRefs and a concrete message.",
  ].join("\n");
}

export function buildPrompt(ctx: PromptContext): string {
  if (ctx.context["plan_protocol"] === "v3") return buildV3Prompt(ctx);
  const task = ctx.context["task"] || ctx.task || "";
  const resolved = promptTemplate.replace(/\{\{TASK\}\}/g, task);
  return `${resolved}\n\n---\n\n# Rules\n\n${rulesBody}`;
}

export const planModule: StepModule = {
  id: "plan",
  type: "single",
  agentRole: "planner",
  preClaim,
  injectContext,
  buildPrompt,
  normalize,
  validateOutput,
  onComplete,
  requiredOutputFields: ["CONTRACT_SCHEMA_VERSION", "STATUS", "PROJECT_NAME", "PROJECT_SLUG", "PLATFORM", "TECH_STACK", "UI_LANGUAGE", "DB_REQUIRED", "DESIGN_REQUIRED", "UI_VISION_SUMMARY", "PRD"],
  maxPromptSize: 192000,
};
