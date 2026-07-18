import { canonicalJsonStringify } from "../canonical-json.js";
import {
  ProductSpecV2Schema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";

export type ProductSpecV2CompatibilityRenderOptions = Readonly<{
  platform?: ProductSpecV2["delivery"]["platform"];
  techStack?: ProductSpecV2["delivery"]["techStack"];
  uiLanguage?: string;
}>;

function productSlug(productId: string): string {
  return productId
    .replace(/^PROD_/, "")
    .toLowerCase()
    .replace(/_/g, "-");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function renderAction(action: ProductActionV2): string {
  const controlSurfaceRefs = unique(
    action.controlPlacements.map((placement) => placement.surfaceRef),
  );
  const primaryControlSurface = controlSurfaceRefs[0] ?? "N/A";
  const input = action.input.fields.length > 0
    ? canonicalJsonStringify(action.input.fields)
    : "[]";
  const persistence = action.persistenceEffects.length > 0
    ? canonicalJsonStringify(action.persistenceEffects)
    : "[]";
  const controlSlots = action.controlPlacements.map((placement) =>
    `${placement.id} (surface=${placement.surfaceRef}; control_hint=${placement.controlHint})`);

  return [
    `### ACTION: ${action.id}`,
    `- Name: ${action.name}`,
    `- Surface Bound: ${primaryControlSurface}`,
    `- Surface Refs: ${controlSurfaceRefs.join(", ") || "none"}`,
    `- Control Slots: ${controlSlots.join(", ") || "none"}`,
    `- Affected Surface Refs: ${action.affectedSurfaceRefs.join(", ") || "none"}`,
    "- Placement/Effect Boundary: Control Slots are rendered controls; Affected Surface Refs are observable effect targets only.",
    `- Trigger: ${canonicalJsonStringify(action.trigger)}`,
    `- Invocation Interface: ${canonicalJsonStringify(action.invocationInterface)}`,
    `- Input Contract: ${input}`,
    `- Preconditions: ${canonicalJsonStringify(action.preconditions)}`,
    `- State Changes: ${canonicalJsonStringify(action.stateDeltas)}`,
    `- Persistence Effects: ${persistence}`,
    `- Navigation After Success: ${canonicalJsonStringify(action.navigation)}`,
    `- Success Effect: state=${action.success.stateRefs.join(",") || "none"}; persistence=${action.success.persistenceRefs?.join(",") || "none"}.`,
    `- Failure Effect: preserve state refs ${action.failure.stateRefs.join(",") || "none"}; user-visible=${String(action.failure.userVisible ?? false)}.`,
    `- Acceptance Evidence: ${action.evidenceRefs.join(", ")}`,
    `- Observable Effects: ${canonicalJsonStringify(action.observableEffects)}`,
  ].join("\n");
}

function actionsWithControlOnSurface(
  surfaceRef: string,
  productSpec: ProductSpecV2,
): Array<{ action: ProductActionV2; placements: ProductActionV2["controlPlacements"] }> {
  return productSpec.actions.flatMap((action) => {
    const placements = action.controlPlacements.filter((placement) =>
      placement.surfaceRef === surfaceRef);
    return placements.length > 0 ? [{ action, placements }] : [];
  });
}

function actionsAffectingSurface(
  surfaceRef: string,
  productSpec: ProductSpecV2,
): ProductActionV2[] {
  return productSpec.actions.filter((action) =>
    action.affectedSurfaceRefs.includes(surfaceRef));
}

function renderSurface(
  surface: ProductSpecV2["surfaces"][number],
  productSpec: ProductSpecV2,
): string {
  const route = productSpec.routes.find((candidate) => candidate.id === surface.routeRef)!;
  const controlActions = actionsWithControlOnSurface(surface.id, productSpec);
  const affectedActions = actionsAffectingSurface(surface.id, productSpec);
  const scopedActions = unique([
    ...controlActions.map(({ action }) => action.id),
    ...affectedActions.map((action) => action.id),
  ]).map((actionRef) => productSpec.actions.find((action) => action.id === actionRef)!);
  const entityRefs = unique(scopedActions.flatMap((action) =>
    action.persistenceEffects.flatMap((effect) => effect.entityRef ? [effect.entityRef] : [])));
  const entities = entityRefs
    .map((ref) => productSpec.entities.find((entity) => entity.id === ref))
    .filter((entity): entity is ProductSpecV2["entities"][number] => Boolean(entity));
  const displayFields = entities.flatMap((entity) =>
    entity.fields.map((field) => `${entity.name}.${field.name}`));
  const domainHint = surface.id.replace(/^SURF_/, "").toLowerCase().replace(/_/g, "-");
  const representation = surface.composition.kind === "route_root" ? "standalone" : "inline";
  const hostSurfaceId = surface.composition.kind === "contained"
    ? surface.composition.hostSurfaceRef
    : "none";
  const permittedActions = controlActions.map(({ action, placements }) => {
    const hints = unique(placements.map((placement) => placement.controlHint));
    return `${action.id} (control_hint: ${hints.join("+")})`;
  });
  const controlSlots = controlActions.flatMap(({ action, placements }) =>
    placements.map((placement) =>
      `${placement.id} (${action.id}; control_hint: ${placement.controlHint})`));
  const renderedDelivery = ["web", "mobile", "desktop", "game"].includes(
    productSpec.delivery.platform,
  );
  const invocationActions = affectedActions
    .filter((action) => action.invocationInterface.kind === "cli_command"
      || action.invocationInterface.kind === "http_request")
    .map((action) => `${action.id} (${action.invocationInterface.kind})`);

  return [
    `### SURFACE: ${surface.id}`,
    `- Name: ${surface.name}`,
    `- Kind: ${surface.kind}`,
    `- Route: ${route.path} (${route.id})`,
    `- Required: ${String(surface.required)}`,
    `- Domain Hint: ${domainHint}`,
    `- Representation: ${representation}`,
    `- Host Surface ID: ${hostSurfaceId}`,
    `- Data Entities Bound: ${entityRefs.join(", ") || "none"}`,
    `- Display Fields: ${displayFields.join(", ") || "typed state only"}`,
    `- Core Content: ${surface.name} renders only its declared typed state and action outcomes.`,
    ...(renderedDelivery
      ? [`- Permitted Actions: ${permittedActions.join(", ") || "none"}`]
      : [`- Permitted Invocation Actions: ${invocationActions.join(", ") || "none"}`]),
    `- Control Slots: ${controlSlots.join(", ") || "none"}`,
    `- Control Hint: ${permittedActions.join(", ") || "none"}`,
    `- Affected By Actions: ${affectedActions.map((action) => action.id).join(", ") || "none"}`,
  ].join("\n");
}

function renderEntity(entity: ProductSpecV2["entities"][number]): string {
  return [
    `### ENTITY: ${entity.id}`,
    `- Name: ${entity.name}`,
    `- Fields: ${canonicalJsonStringify(entity.fields)}`,
  ].join("\n");
}

function renderState(state: ProductSpecV2["states"][number]): string {
  return [
    `### STATE: ${state.id}`,
    `- Name: ${state.name}`,
    `- Kind: ${state.kind}`,
    `- Initial Value: ${canonicalJsonStringify(state.initialValue)}`,
    `- Invariants: ${canonicalJsonStringify(state.invariants)}`,
  ].join("\n");
}

function renderPersistence(policy: ProductSpecV2["persistencePolicies"][number]): string {
  return [
    `### PERSISTENCE: ${policy.id}`,
    `- Kind: ${policy.kind}`,
    `- Owner: ${policy.owner}`,
    `- Entity Refs: ${policy.entityRefs.join(", ") || "none"}`,
    `- Durability: ${policy.durability}`,
    `- Key: ${policy.key ?? "none"}`,
  ].join("\n");
}

/**
 * Renders a legacy-compatible PLAN/PRD view from strict ProductSpec v2
 * authority. Composition and control placement remain lossless in prose, and
 * the canonical v2 fence is the exact validated value.
 */
export function renderProductSpecV2Compatibility(
  productSpec: unknown,
  options: ProductSpecV2CompatibilityRenderOptions = {},
): string {
  const spec = ProductSpecV2Schema.parse(productSpec);
  const platform = options.platform ?? spec.delivery.platform;
  const techStack = options.techStack ?? spec.delivery.techStack;
  const dbRequired = spec.delivery.database;
  const canonicalProjection = canonicalJsonStringify(spec);
  const uiVisionSummary = spec.delivery.uiVisionSummary;
  const persistenceKinds = unique(spec.persistencePolicies.map((policy) => policy.kind));
  const requiredInputs = spec.actions.flatMap((action) => action.input.fields)
    .filter((field) => field.required)
    .map((field) => field.name);
  const renderedDelivery = ["web", "mobile", "desktop", "game"].includes(
    spec.delivery.platform,
  );
  const platformContractLines = renderedDelivery
    ? [
        `- Routes: ${spec.routes.map((route) => `${route.id}=${route.path}`).join(", ")}.`,
        "- route_guard_policy: no authentication guard is declared; every ProductSpec route is reachable exactly through its typed navigation actions.",
        "- Runtime Contract: the first rendered state is a required Product Surface, never a landing page, setup tutorial, or placeholder shell.",
        "- Accessibility Contract: every rendered user action has a named interactive control and observable success/failure feedback.",
      ]
    : [
        `- Route/Interface Scopes: ${spec.routes.map((route) => `${route.id}=${route.path}`).join(", ")}.`,
        "- Invocation Contract: public action execution follows each typed invocationInterface exactly; action names, route prose, and semantic surface names do not imply argv or HTTP ABI.",
        "- Evidence Contract: CLI/API actions use exact action_invocation plus invocation_output evidence; no browser control, rendered-state, or accessibility requirement may be inferred.",
      ];
  const requiredInputSummary = unique(requiredInputs).join(", ") || (renderedDelivery
    ? "none; rendered controls still validate their typed trigger state"
    : "none; zero-input invocations execute only their declared typed interface");

  return [
    "CONTRACT_SCHEMA_VERSION: setfarm.plan.v2.2",
    "STATUS: done",
    `PROJECT_NAME: ${spec.product.name}`,
    `PROJECT_SLUG: ${productSlug(spec.product.id)}`,
    `PLATFORM: ${platform}`,
    `TECH_STACK: ${techStack}`,
    `UI_LANGUAGE: ${options.uiLanguage ?? spec.delivery.uiLanguage}`,
    `DB_REQUIRED: ${dbRequired}`,
    `DESIGN_REQUIRED: ${String(spec.delivery.designRequired)}`,
    `UI_VISION_SUMMARY: ${uiVisionSummary}`,
    `PRODUCT_SPEC_SCHEMA: ${spec.schema}`,
    "PRD:",
    `# ${spec.product.name} Product Contract`,
    "",
    "## 1. Context And Goals",
    `- Product ID: ${spec.product.id}`,
    `- Product Class: ${spec.product.class}`,
    ...spec.product.goals.map((goal) => `- ${goal.id}: ${goal.statement}`),
    ...(spec.product.nonGoals.length > 0
      ? ["### Explicit Non-Goals", ...spec.product.nonGoals.map((item) => `- ${item.id}: ${item.statement}`)]
      : ["### Explicit Non-Goals", "- none"]),
    "### Source Requirement Ledger",
    ...spec.requirements.map((requirement) =>
      `- ${requirement.id}: ${requirement.normalizedClause} [${requirement.classification}; expects=${requirement.expectedSemanticKinds.join(",")}]`),
    "",
    "## 2. Data And State Contract",
    ...spec.entities.flatMap((entity) => [renderEntity(entity), ""]),
    ...spec.states.flatMap((state) => [renderState(state), ""]),
    ...spec.persistencePolicies.flatMap((policy) => [renderPersistence(policy), ""]),
    "## 3. Behavioral And Action Contract",
    ...spec.actions.flatMap((action) => [renderAction(action), ""]),
    "## 4. Product Surfaces",
    ...spec.surfaces.flatMap((surface) => [renderSurface(surface, spec), ""]),
    "## 5. Validation And Error Strategy",
    `- Required Inputs: ${requiredInputSummary}.`,
    "- Validation Rules: action input must satisfy the exact ProductSpec value type and required-field contract before any state or persistence effect runs.",
    "- Business Logic Errors: preserve the last valid state refs declared by the action failure outcome and expose user-visible feedback when required.",
    "- Persistence Errors: preserve the last good state, report the failed policy ref, and offer only a retry that repeats the same typed action identity.",
    "- Recovery Policy: no silent resets, placeholder success, or guessed fallback behavior is allowed.",
    "",
    "## 6. System Contracts",
    "### mock_data_contract",
    `- Required Entities: ${spec.entities.map((entity) => entity.id).join(", ") || "none"}.`,
    "- Strategy: deterministic fixtures must use the declared entity fields, state initial values, and action inputs; they may not invent product semantics.",
    "### data_access_contract",
    `- Persistence Policies: ${spec.persistencePolicies.map((policy) => `${policy.id}:${policy.kind}:${policy.durability}`).join(", ") || "none"}.`,
    `- Access Boundary: ${persistenceKinds.join(", ") || "memory"}; one declared write path per action and no hidden secondary source of truth.`,
    "### environment_contract",
    "- Required Keys: none; typed producer profiles reject external-provider semantics that would require undeclared credentials.",
    "- Secret Handling: runtime owns values; this ProductSpec and compatibility view contain no secret values.",
    "",
    "## 7. Platform Contract",
    `- Platform: ${platform}; stack: ${techStack}.`,
    ...platformContractLines,
    "",
    "## 8. Testability Contract",
    ...spec.evidencePredicates.map((predicate) =>
      `- ${predicate.id}: kind=${predicate.kind}; required=${String(predicate.required)}; subject=${predicate.subjectRef}; capabilities=${predicate.capabilityRefs.join(",") || "none"}; assertion=${canonicalJsonStringify(predicate.assertion)}`),
    "",
    "## 9. Out Of Scope",
    ...(spec.product.nonGoals.length > 0
      ? spec.product.nonGoals.map((item) => `- ${item.id}: ${item.statement}`)
      : ["- No functionality outside declared surfaces, actions, states, persistence policies, and evidence predicates."]),
    "- No agent-invented routes, controls, analytics, settings, profiles, billing, or administration modules.",
    "- No physical repo paths, branch identities, generated-project identifiers, or runtime credentials belong to this semantic contract.",
    "",
    "## 10. Typed ProductSpec Projection",
    "This compatibility view is rendered from the typed artifact below. Downstream v2 consumers use the typed artifact directly.",
    "```product-spec-v2",
    canonicalProjection,
    "```",
  ].join("\n");
}

export const renderLegacyPrdFromProductSpecV2 = renderProductSpecV2Compatibility;
