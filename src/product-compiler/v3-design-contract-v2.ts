import { canonicalJsonStringify } from "./canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "./producers/design-targets-v2.js";
import type { DesignGenerationTargetsV2 } from "./schemas/design-generation-targets-v2.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";

export type V3DesignContractV2 = Readonly<{
  productSpec: ProductSpecV2;
  generationTargets: DesignGenerationTargetsV2;
}>;

export function extractCanonicalProductSpecV2FromPrd(prd: string): ProductSpecV2 {
  const blocks = [...String(prd || "").matchAll(/```product-spec-v2\s*\n([\s\S]*?)\n```/g)];
  const legacy = [...String(prd || "").matchAll(/```product-spec-v1\s*\n([\s\S]*?)\n```/g)];
  if (legacy.length > 0) {
    throw new Error("DESIGN_V2_LEGACY_PRODUCT_SPEC_FORBIDDEN");
  }
  if (blocks.length !== 1) {
    throw new Error(
      `DESIGN_V2_PRODUCT_SPEC_PROJECTION_INVALID: expected exactly one product-spec-v2 block, got ${blocks.length}`,
    );
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(blocks[0]![1]!);
  } catch {
    throw new Error("DESIGN_V2_PRODUCT_SPEC_PROJECTION_INVALID: product-spec-v2 block is not JSON");
  }
  const parsed = ProductSpecV2Schema.safeParse(decoded);
  if (!parsed.success) {
    throw new Error(
      `DESIGN_V2_PRODUCT_SPEC_PROJECTION_INVALID: ${parsed.error.issues[0]?.message || "schema mismatch"}`,
    );
  }
  if (canonicalJsonStringify(parsed.data) !== blocks[0]![1]!.trim()) {
    throw new Error(
      "DESIGN_V2_PRODUCT_SPEC_PROJECTION_INVALID: ProductSpec bytes are not Setfarm Canonical JSON v1",
    );
  }
  return parsed.data;
}

export function prepareV3DesignContractV2(prd: string): V3DesignContractV2 {
  const productSpec = extractCanonicalProductSpecV2FromPrd(prd);
  const produced = produceDesignGenerationTargetsV2(productSpec);
  if (produced.status !== "produced") {
    throw new Error(
      `DESIGN_V2_GENERATION_TARGETS_REJECTED: ${produced.rejectionCodes.join(",")}`,
    );
  }
  return { productSpec, generationTargets: produced.generationTargets };
}

function actionName(productSpec: ProductSpecV2, actionRef: string): string {
  const action = productSpec.actions.find((candidate) => candidate.id === actionRef);
  if (!action) throw new Error(`DESIGN_V2_TARGET_ACTION_UNRESOLVED: ${actionRef}`);
  return action.name;
}

/**
 * Produces the exact static-design request. Control slots own physical controls;
 * affected surfaces and affecting actions are context and cannot create DOM.
 */
export function buildV3BatchStitchPromptV2(input: Readonly<{
  contract: V3DesignContractV2;
  targetRefs: readonly string[];
  deviceType: string;
  uiLanguage: string;
  stageId: string;
}>): string {
  const { productSpec, generationTargets } = input.contract;
  const targetById = new Map(generationTargets.targets.map((target) => [target.targetId, target] as const));
  const targets = input.targetRefs.map((targetRef) => {
    const target = targetById.get(targetRef);
    if (!target) throw new Error(`DESIGN_V2_BATCH_TARGET_UNRESOLVED: ${targetRef}`);
    return target;
  });
  if (new Set(input.targetRefs).size !== input.targetRefs.length) {
    throw new Error("DESIGN_V2_BATCH_TARGET_DUPLICATE");
  }

  const targetSpecs = targets.map((target, index) => {
    const rootSurface = productSpec.surfaces.find((surface) => surface.id === target.surfaceRef);
    if (!rootSurface) throw new Error(`DESIGN_V2_TARGET_SURFACE_UNRESOLVED: ${target.surfaceRef}`);
    const surfaceLines = [target.surfaceRef, ...target.containedSurfaceRefs].map((surfaceRef) => {
      const surface = productSpec.surfaces.find((candidate) => candidate.id === surfaceRef);
      if (!surface) throw new Error(`DESIGN_V2_TARGET_SURFACE_UNRESOLVED: ${surfaceRef}`);
      return [
        `  - surface_ref: ${surface.id}`,
        `    surface_name: ${surface.name}`,
        `    composition: ${surface.composition.kind}`,
        ...(surface.composition.kind === "contained"
          ? [`    host_surface_ref: ${surface.composition.hostSurfaceRef}`]
          : []),
        `    exact_surface_attribute: data-surface-id="${surface.id}"`,
      ].join("\n");
    }).join("\n");
    const controls = target.requiredControlPlacements.map((placement) => {
      const inputAttributes = placement.inputFields.map((field) =>
        `data-action-input="${placement.actionRef}.${field}"`);
      return [
        `  - control_slot_ref: ${placement.controlSlotRef}`,
        `    action_ref: ${placement.actionRef}`,
        `    visible_intent: ${actionName(productSpec, placement.actionRef)}`,
        `    owning_surface_ref: ${placement.surfaceRef}`,
        `    control_hint: ${placement.controlHint}`,
        `    exact_same_element_attributes: data-action="${placement.actionRef}" data-control-slot="${placement.controlSlotRef}"`,
        `    exact_input_attributes: ${inputAttributes.length > 0 ? inputAttributes.join(", ") : "none"}`,
      ].join("\n");
    }).join("\n");
    return [
      `SCREEN_TARGET_${index + 1}:`,
      `- target_ref: ${target.targetId}`,
      `- route_ref: ${target.routeRef}`,
      `- exact_screen_title: ${target.expectedScreenTitle}`,
      `- root_surface_ref: ${target.surfaceRef}`,
      `- product_surfaces:`,
      surfaceLines,
      `- physical_control_slots:`,
      controls || "  - none",
      `- affecting_action_refs_context_only: ${target.affectingActionRefs.join(", ") || "none"}`,
      `- observable_contracts: ${canonicalJsonStringify(target.requiredObservableSelectors)}`,
      `- root_surface_kind: ${rootSurface.kind}`,
    ].join("\n");
  }).join("\n\n");

  return [
    "# SETFARM_STITCH_PRODUCT_SEMANTICS_V2_CONTRACT",
    "",
    `contract_schema: ${generationTargets.schema}`,
    `product_spec_hash: ${generationTargets.productSpecHash}`,
    `stage_id: ${input.stageId}`,
    `Generate exactly ${targets.length} screens and no others in this response.`,
    `Target device type: ${input.deviceType}.`,
    `All visible user-facing text must be in ${input.uiLanguage}.`,
    "",
    "## EXACT_SCREEN_TARGETS",
    targetSpecs,
    "",
    "## STATIC_DESIGN_AUTHORITY",
    "- Output static design HTML only. Do not implement application behavior, state transitions, persistence, localStorage, network requests, event handlers, timers, or executable application JavaScript.",
    "- Script source is forbidden except the compiler-approved https://cdn.tailwindcss.com runtime and an optional data-only tailwind.config assignment.",
    "- Do not emit onclick, onchange, oninput, onsubmit, or any other inline event-handler attribute.",
    "- Custom data attributes below are immutable source annotations; Setfarm adds behavior only after design acceptance.",
    "",
    "## EXACT_COMPLETENESS_RULES",
    "- Return exactly one screen for each SCREEN_TARGET. The returned title must equal exact_screen_title byte-for-byte.",
    "- Render exactly one wrapper for every product_surfaces entry and preserve its exact data-surface-id. Contained surfaces live inside their declared host in the same route-root screen; they are not separate screens.",
    "- Render exactly one physical actionable element per physical_control_slots entry. The actionable element itself must carry both exact data-action and exact data-control-slot attributes on the same element.",
    "- affected/affecting action context never authorizes a physical control. Never create a button, link, input, or other control from affecting_action_refs_context_only.",
    "- Never emit data-action without its declared data-control-slot, or data-control-slot without its declared data-action.",
    "- Each exact_input_attributes value belongs on the one value-providing element for that field; preserve its exact spelling and case.",
    "- Do not emit any undeclared button, link, input, textarea, select, checkbox, tab, menu item, overflow control, breadcrumb control, icon-only control, or other actionable element.",
    "- Preserve every observable_contract exactly. Browser-computed accessibility role and accessible name are authoritative; native named elements are valid and do not require redundant literal role attributes.",
    "- An observable with a before visibility=true assertion must be visible in the initial static render. An observable required only after/reload may be represented by a semantically present hidden placeholder; it must not be rejected merely for being initially hidden.",
    "- Do not create style-guide, assistant, summary, moodboard, documentation, PRD, marketing, admin, account, checkout, or extra product screens.",
    "",
    "## PRODUCT_SCOPE",
    `Product: ${productSpec.product.name}`,
    `Goals: ${productSpec.product.goals.map((goal) => goal.statement).join(" | ")}`,
    "Do not invent product behavior, controls, routes, or surfaces outside the typed targets above.",
  ].join("\n");
}
