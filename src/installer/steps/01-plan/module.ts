import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput, onComplete } from "./guards.js";
import { preClaim } from "./preclaim.js";
import { PlanSemanticProposalV1Schema } from "../../../product-compiler/schemas/plan-semantic-proposal-v1.js";
import { PlanProductBuildProposalV1Schema } from "../../../product-compiler/schemas/plan-product-build-proposal-v1.js";
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
const productBuildProposalV1JsonSchema = JSON.stringify(z.toJSONSchema(
  PlanProductBuildProposalV1Schema,
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
  const atomicBuildProposal = productSemanticsVersion === "v2";
  const proposalFence = atomicBuildProposal
    ? "plan-product-build-proposal-v1"
    : "plan-semantic-proposal-v1";
  const proposalSchema = productSemanticsVersion === "v2"
    ? productBuildProposalV1JsonSchema
    : semanticProposalJsonSchema;
  const task = ctx.context["task"] || ctx.task || "";
  const requirementLedger = ctx.context["v3_requirement_ledger"] || "";
  const requestedStackPackId = ctx.context["v3_requested_stack_pack_id"] || "";
  return [
    atomicBuildProposal
      ? "PLAN v3 - atomic product build proposal"
      : "PLAN v3 - primary semantic proposal",
    "",
    atomicBuildProposal
      ? "You propose primary product semantics and runtime behavior together in one envelope. Setfarm compiles all global IDs, requirement/evidence joins, delivery profiles, source bytes, persistence runtime ownership/durability/payloads, canonical runtime assertions, traceability, canonical JSON, runtime identity, and verdicts; it never invents a missing product ABI or joins behavior from later prose."
      : "You propose primary product semantics, exact requirement references, and each action's typed invocation interface. Setfarm compiles all global IDs, delivery profiles, source bytes, persistence runtime ownership/durability/payloads, evidence identities/capabilities, traceability, canonical JSON, runtime identity, and verdicts; it never invents a missing product ABI.",
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
    "Set product.uiLanguage to exactly English. A source task may use or request another language, but every planner-owned product name, semantic statement, visible label, message, and UI copy must be expressed in English.",
    requestedStackPackId
      ? `The compiler will validate the explicit requested stack pack ${requestedStackPackId}; do not repeat or reinterpret it.`
      : "No explicit stack prefix was requested; the compiler selects delivery from product.class.",
    "",
    "## Proposal rules",
    `- Emit exactly one ${proposalFence} JSON fence. Pretty or unsorted JSON is allowed.`,
    ...(atomicBuildProposal
      ? [
          "- The envelope schema is setfarm.plan-product-build-proposal.v1. Put the complete PlanSemanticProposalV2 under semantics and the complete setfarm.plan-runtime-behavior-proposal.v1 under runtimeBehavior; never emit either half as a separate fence.",
          "- Bind every semantics.states[].invariants occurrence exactly once by stateKey plus zero-based invariantOrdinal. Use runtime_assertions for executable state predicates, structured_semantic_coverage only when an exact declared delta/precondition/observable/persistence intent already enforces it, and non_runtime_requirement only for constraint/non-goal requirements with exact local evidence refs.",
          "- Runtime assertion subjects are relative to their owning state; do not repeat a state key inside the subject. Use only the code-owned predicate operators and checkpoints admitted by the schema.",
          "- Bind every entity_field state-delta occurrence exactly once by actionKey plus stateDeltaKey to one declared state snapshot and singleton or match_input selection. A schema field without an exact runtime instance selection is incomplete.",
          "- runtimeBehavior.entityFieldBindings contains every-and-only state delta occurrences whose valueFrom.kind is entity_field. Literal and input state deltas do not appear in entityFieldBindings.",
          "- Each entityFieldBindings snapshot contains exactly stateKey, collectionPath, and selection. Never emit valueField or any other snapshot key.",
          "- Singleton selection uses exactly { kind: \"singleton\" }. Its collectionPath must resolve in the declared state's initialValue to one plain object containing the typed projected entity field; use an empty collectionPath when the whole initialValue is that object.",
          "- match_input selection uses exactly kind, matchFieldKey, and inputField. Its collectionPath must resolve in initialValue to an array of plain objects; every member contains the typed projected field and typed match field, match values are unique, matchFieldKey belongs to the value-source entity, and inputField names a required compatible action input.",
          "- Runtime behavior references only semantic local keys and exact zero-based ordinals. Do not emit requirementRefs, evidence IDs, ProductSpec IDs, hashes, filenames, selectors, or implementation choices in runtimeBehavior; Setfarm derives them.",
          "- Prose invariants remain provenance, not executable instructions. The structured runtimeBehavior disposition is the primary implementation and test authority for each occurrence.",
        ]
      : []),
    "- Use lowercase local keys only. Do not emit PROD_/STATE_/ACT_/EVID_/SURF_ or any other global ID.",
    "- Every goal, non-goal, entity, state, persistence policy, route, surface, action, observable, and assumption cites exact requirementRefs.",
    "- enumValues is valid only when valueType is exactly enum. Every non-enum entity field, including a string field, omits enumValues.",
    ...(productSemanticsVersion === "v2"
      ? [
          "- Every route has exactly one route_root surface. Other same-route surfaces use composition.kind=contained and an exact hostSurfaceKey; contained surfaces are not separate screens.",
          "- Every action declares exactly one invocationInterface. rendered_control requires a user trigger with no trigger.sourceRef, one or more exact controlPlacements, and evidenceScenario.controlPlacementKey. CLI/HTTP actions likewise require a user trigger with no trigger.sourceRef, no physical controls, and every-and-only input fieldBindings. route_entry must exactly match route trigger kind and sourceRef. Timer/system invocation is unsupported until a versioned event-source contract exists.",
          "- controlPlacements are physical rendered controls. affectedSurfaceKeys are behavior/effect scope and never imply a rendered control; every non-rendered action still names at least one exact semantic interface surface.",
          "- Every V1 CLI/HTTP input is required=true and its binding uses optionalPresence=not_applicable; optional defaults, omission, and null behavior are unsupported until a versioned absence/evidence contract exists. Enum inputs bind an exact enum entity field with unique enumValues. Evidence values must inhabit that domain and real Gregorian date/datetime values.",
          "- Active rendered_control inputs are also required=true; rendered date/datetime inputs are unsupported until a release-owned DOM codec exists. Do not defer either incompatibility to Stitch or implementation.",
          "- CLI tokens use canonical lowercase ASCII and every product's subcommand token sequences are prefix-free, including the empty root command. V1 input channels are only argv position/flag/stdin JSON for CLI and path/query/JSON body for HTTP; environment variables and HTTP headers are unsupported until typed credential/sensitivity authority exists. argv_position values are distinct and contiguous from zero.",
          "- JSON stdin/body bindings use containerPolicy=object_intermediates. An empty pointer makes the field value the whole document; otherwise the root and every intermediate pointer container are objects. JSON pointers may not duplicate or overlap.",
          "- Each HTTP path :parameter has exactly one same-name path_parameter binding and every path_parameter names a placeholder. GET has no JSON body. Under one method, endpoint templates may not overlap through static/parameter segments; different methods may share a path. Route-language proof is fail-closed at a product-wide 100000 pair-comparison budget, so reduce/split the API or emit typed rejection before exceeding it.",
          "- CLI/HTTP result contracts declare success codes and exact JSON result valuePointer. failureCases contain every-and-only input_validation when inputs exist, precondition when preconditions exist, and action_failure. Success/failure codes are unique and disjoint; each failure has a distinct stable errorCode and disjoint codePointer/messagePointer. JSON responses cannot use 204/205.",
          "- fieldBindings, numeric code arrays, and failureCases may arrive in any order; Setfarm canonicalizes their non-semantic ordering before ProductSpec publication.",
          "- Every CLI/HTTP observable uses selector.kind=invocation_output, coordinate=result_value, a pointer relative to result.valuePointer, and valueContract.expectedFrom. V1 assertions are typed value/equals/expected claims matching only a declared input or literal source; state/entity output sources are unsupported until a separate typed value-source authority exists.",
        ]
      : ["- Routes do not repeat surface refs; surfaces name their routeKey and Setfarm closes the route graph."]),
    "- Persistence intents name stateDeltaKeys, never state-path copies or payloadFields. Setfarm derives both.",
    "- Declare an input only when a state valueFrom or a CLI/HTTP fieldBinding consumes it. Fixed outcomes use literal deltas and no synthetic input.",
    "- Every declared state must have an action precondition, delta, or value-source owner. An all-CLI/HTTP product may be stateless; do not invent fake state, busy/loading state, or UI state unless exact behavior owns it.",
    "- Every action needs at least one observable. Every individual observable needs an after assertion. Durable writes additionally need a reload assertion.",
    "- Rendered observables bind the owning control or an exact action surface/accessibility role and name. CLI/HTTP observables use only typed invocation_output selectors. Setfarm generates observable and evidence identities.",
    "- Use an empty or RFC 6901 path beginning with '/'; escape '~' as '~0' and '/' within a token as '~1'.",
    "- If primary semantics are ambiguous, contradictory, missing, or outside activated product classes, emit the typed rejection instead of guessing.",
    "",
    atomicBuildProposal
      ? "## PlanProductBuildProposal JSON Schema"
      : "## PlanSemanticProposal JSON Schema",
    "```json",
    proposalSchema,
    "```",
    "",
    "## Success output",
    "```text",
    "STATUS: done",
    "PRD:",
    `\`\`\`${proposalFence}`,
    atomicBuildProposal
      ? "{ ...one complete atomic semantic and runtime-behavior proposal... }"
      : "{ ...one primary semantic proposal... }",
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
