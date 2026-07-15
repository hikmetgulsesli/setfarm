import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { StepModule, PromptContext } from "../types.js";
import { injectContext } from "./context.js";
import { normalize, validateOutput, onComplete } from "./guards.js";
import { preClaim } from "./preclaim.js";
import { ProductSpecV3ProposalSchema } from "../../../product-compiler/schemas/product-spec-v1.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load prompt/rules at module init. Cached for the process lifetime —
// any edit to the markdown requires a process restart.
const promptTemplate = fs.readFileSync(path.join(__dirname, "prompt.md"), "utf-8");
const rulesBody = fs.readFileSync(path.join(__dirname, "rules.md"), "utf-8");
const productSpecJsonSchema = JSON.stringify(z.toJSONSchema(ProductSpecV3ProposalSchema), null, 2);

function buildV3Prompt(ctx: PromptContext): string {
  const task = ctx.context["task"] || ctx.task || "";
  const requirementLedger = ctx.context["v3_requirement_ledger"] || "";
  const deliveryProfileCatalog = ctx.context["v3_delivery_profile_catalog"] || "";
  const deliveryProfileCatalogHash = ctx.context["v3_delivery_profile_catalog_hash"] || "";
  const requestedStackPackId = ctx.context["v3_requested_stack_pack_id"] || "";
  return [
    "PLAN v3 - typed ProductSpec proposal",
    "",
    "You are the semantic planner. Setfarm owns source clauses, delivery profiles, canonical JSON bytes, runtime identity, artifact publication, and all verdicts. Classify product semantics from the exact task; then bind delivery to the matching Setfarm-owned profile instead of choosing a stack yourself.",
    "",
    "## Exact task",
    task,
    "",
    "## Setfarm-owned requirement ledger",
    "Copy every requirement entry exactly. Add only classification and expectedSemanticKinds to each entry. Do not omit, rewrite, merge, split, or invent a requirement.",
    "```task-requirement-ledger-v1",
    requirementLedger,
    "```",
    "",
    "## Setfarm-owned Product Delivery Profile Catalog",
    `Catalog hash: ${deliveryProfileCatalogHash}`,
    "The proposed product.class selects exactly one activated profile. Copy that profile's delivery.platform, delivery.techStack, and delivery.designRequired exactly; delivery.database must be one of allowedDatabases. Do not infer or substitute another stack. If no profile owns the semantic class, emit a typed semantic-unsupported rejection.",
    requestedStackPackId
      ? `The user explicitly requested stack pack ${requestedStackPackId}. It must equal the selected profile's stackPackId; otherwise emit a typed semantic-unsupported rejection.`
      : "No explicit stack prefix was requested; selectionBasis is product_class.",
    "```product-delivery-profile-catalog-v1",
    deliveryProfileCatalog,
    "```",
    "",
    "## Proposal rules",
    "- Emit exactly one product-spec-v1 JSON fence. Pretty or unsorted JSON is allowed; Setfarm validates and canonicalizes it.",
    "- The proposal must include delivery, requirements, and traceability in addition to the ProductSpec v1 product/entities/states/persistencePolicies/routes/surfaces/actions/evidencePredicates/assumptions fields.",
    "- Every goal, non-goal, entity, state, persistence policy, route, surface, action, evidence predicate, and observable effect must have exactly one traceability binding to one or more exact REQ_* IDs.",
    "- Each requirement declares expectedSemanticKinds. Setfarm rejects a proposal when any declared kind lacks an exact bound semantic artifact.",
    "- Every action must declare at least one observableEffects entry. Its selector must bind the owning action control, one owning surface, or an exact accessibility role/name. Assertions use before/after/reload phases and visible_text/value/visibility/enabled/route properties.",
    "- Declare an action input only when that variable value feeds an exact stateDelta through valueFrom.kind=input or inputs. A fixed button outcome is a literal state delta with no synthetic action input or payload field.",
    "- Every state path is empty or an RFC 6901 JSON Pointer beginning with '/'; escape '~' as '~0' and '/' inside one token as '~1'.",
    "- Every observable effect owns an observable_outcome evidence predicate whose subjectRef is the exact OBS_* ID; that evidence ref must also appear on the action.",
    "- Durable writes require a reload observable assertion. State bridge evidence is supplemental and cannot replace a DOM/accessibility/route observable assertion.",
    "- Do not guess ambiguous actions, persistence ownership, routes, or outcomes. Emit the typed rejection below instead.",
    "- Product class is semantic input to the delivery catalog. Utility and operations use the catalog's exact Vite profile; game uses the catalog's exact browser-game profile. Static HTML and reference-only design stacks are not activated for Product Compiler v3 until an exact packet projection exists.",
    "",
    "## ProductSpec JSON Schema",
    "Refinements described above remain mandatory even when JSON Schema cannot express them.",
    "```json",
    productSpecJsonSchema,
    "```",
    "",
    "## Success output",
    "```text",
    "STATUS: done",
    "PRD:",
    "```product-spec-v1",
    "{ ...one ProductSpec proposal... }",
    "```",
    "```",
    "",
    "## Typed rejection output",
    "Use STATUS: done and exactly one product-spec-rejection-v1 fence with schema, exact sourceTaskHash, and one or more reasons. The Setfarm output guard will validate the typed rejection and stop PLAN without treating it as a successful ProductSpec. Allowed reason codes: PRODUCT_SPEC_TASK_AMBIGUOUS, PRODUCT_SPEC_SEMANTIC_UNSUPPORTED, PRODUCT_SPEC_REQUIREMENT_CONFLICT, PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING. Every reason must cite exact requirementRefs and a concrete message.",
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
