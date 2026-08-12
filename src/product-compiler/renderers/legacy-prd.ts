import { canonicalJsonStringify } from "../canonical-json.js";
import {
  ProductSpecV1EnglishWriteSchema,
  type ProductDeliveryV1,
  type ProductActionV1,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";

export type LegacyPrdRenderOptions = Readonly<{
  platform?: ProductDeliveryV1["platform"];
  techStack?: ProductDeliveryV1["techStack"];
  uiLanguage?: string;
}>;

function canonicalUiLanguage(override: string | undefined): "English" {
  if (override !== undefined && override !== "English") {
    throw new Error("LEGACY_PRD_UI_LANGUAGE_MUST_BE_ENGLISH");
  }
  return "English";
}

function productSlug(productId: string): string {
  return productId
    .replace(/^PROD_/, "")
    .toLowerCase()
    .replace(/_/g, "-");
}

function renderAction(action: ProductActionV1): string {
  const primarySurface = action.surfaceRefs[0]!;
  const input = action.input.fields.length > 0
    ? canonicalJsonStringify(action.input.fields)
    : "[]";
  const persistence = action.persistenceEffects.length > 0
    ? canonicalJsonStringify(action.persistenceEffects)
    : "[]";
  return [
    `### ACTION: ${action.id}`,
    `- Name: ${action.name}`,
    `- Surface Bound: ${primarySurface}`,
    `- Surface Refs: ${action.surfaceRefs.join(", ")}`,
    `- Trigger: ${canonicalJsonStringify(action.trigger)}`,
    `- Input Contract: ${input}`,
    `- Preconditions: ${canonicalJsonStringify(action.preconditions)}`,
    `- State Changes: ${canonicalJsonStringify(action.stateDeltas)}`,
    `- Persistence Effects: ${persistence}`,
    `- Navigation After Success: ${canonicalJsonStringify(action.navigation)}`,
    `- Success Effect: state=${action.success.stateRefs.join(",") || "none"}; persistence=${action.success.persistenceRefs?.join(",") || "none"}.`,
    `- Failure Effect: preserve state refs ${action.failure.stateRefs.join(",") || "none"}; user-visible=${String(action.failure.userVisible ?? false)}.`,
    `- Acceptance Evidence: ${action.evidenceRefs.join(", ")}`,
    `- Observable Effects: ${canonicalJsonStringify(action.observableEffects ?? [])}`,
  ].join("\n");
}

function renderSurface(
  surface: ProductSpecV1["surfaces"][number],
  productSpec: ProductSpecV1,
): string {
  const route = productSpec.routes.find((candidate) => candidate.id === surface.routeRef)!;
  const actions = productSpec.actions
    .filter((action) => action.surfaceRefs.includes(surface.id))
    .map((action) => action.id);
  const entityRefs = [...new Set(productSpec.actions
    .filter((action) => action.surfaceRefs.includes(surface.id))
    .flatMap((action) => action.persistenceEffects.flatMap((effect) => effect.entityRef ? [effect.entityRef] : [])))];
  const entities = entityRefs
    .map((ref) => productSpec.entities.find((entity) => entity.id === ref))
    .filter((entity): entity is ProductSpecV1["entities"][number] => Boolean(entity));
  const displayFields = entities.flatMap((entity) =>
    entity.fields.map((field) => `${entity.name}.${field.name}`));
  const domainHint = surface.id.replace(/^SURF_/, "").toLowerCase().replace(/_/g, "-");
  return [
    `### SURFACE: ${surface.id}`,
    `- Name: ${surface.name}`,
    `- Kind: ${surface.kind}`,
    `- Route: ${route.path} (${route.id})`,
    `- Required: ${String(surface.required)}`,
    `- Domain Hint: ${domainHint}`,
    "- Representation: standalone",
    "- Host Surface ID: none",
    `- Data Entities Bound: ${entityRefs.join(", ") || "none"}`,
    `- Display Fields: ${displayFields.join(", ") || "typed state only"}`,
    `- Core Content: ${surface.name} renders only its declared typed state and action outcomes.`,
    `- Permitted Actions: ${actions.join(", ") || "none"}`,
    `- Control Hint: ${actions.map((action) => `${action} (control_hint: typed_control)`).join(", ") || "none"}`,
  ].join("\n");
}

function renderEntity(entity: ProductSpecV1["entities"][number]): string {
  return [
    `### ENTITY: ${entity.id}`,
    `- Name: ${entity.name}`,
    `- Fields: ${canonicalJsonStringify(entity.fields)}`,
  ].join("\n");
}

function renderState(state: ProductSpecV1["states"][number]): string {
  return [
    `### STATE: ${state.id}`,
    `- Name: ${state.name}`,
    `- Kind: ${state.kind}`,
    `- Initial Value: ${canonicalJsonStringify(state.initialValue)}`,
    `- Invariants: ${canonicalJsonStringify(state.invariants)}`,
  ].join("\n");
}

function renderPersistence(policy: ProductSpecV1["persistencePolicies"][number]): string {
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
 * Renders the compatibility PLAN/PRD view from an already validated typed
 * ProductSpec. The fenced projection is the same value, not a parse-back source
 * for the producer.
 */
export function renderLegacyPrd(
  productSpec: unknown,
  options: LegacyPrdRenderOptions = {},
): string {
  const spec = ProductSpecV1EnglishWriteSchema.parse(productSpec);
  const platform = options.platform ?? spec.delivery?.platform ?? (spec.product.class === "game" ? "game" : "web");
  const techStack = options.techStack ?? spec.delivery?.techStack ?? (spec.product.class === "game" ? "browser-game" : "vite-react");
  const dbRequired = spec.delivery?.database ?? (spec.persistencePolicies.some((policy) => policy.kind === "database")
    ? "postgres"
    : "none");
  const uiLanguage = canonicalUiLanguage(options.uiLanguage);
  const canonicalProjection = canonicalJsonStringify(spec);
  const uiVisionSummary = spec.delivery?.uiVisionSummary ?? [
    `${spec.product.name} is a focused ${spec.product.class} product, not a marketing or placeholder surface.`,
    `Its ${spec.surfaces.length} declared surface(s) expose exactly ${spec.actions.length} typed action(s) with visible state, persistence, success, and recovery feedback.`,
    "The visual implementation must preserve the declared routes, controls, evidence identities, and explicit non-goals without adding unrelated modules.",
  ].join(" ");
  const persistenceKinds = [...new Set(spec.persistencePolicies.map((policy) => policy.kind))];
  const requiredInputs = spec.actions.flatMap((action) => action.input.fields)
    .filter((field) => field.required)
    .map((field) => field.name);

  return [
    "CONTRACT_SCHEMA_VERSION: setfarm.plan.v2.2",
    "STATUS: done",
    `PROJECT_NAME: ${spec.product.name}`,
    `PROJECT_SLUG: ${productSlug(spec.product.id)}`,
    `PLATFORM: ${platform}`,
    `TECH_STACK: ${techStack}`,
    `UI_LANGUAGE: ${uiLanguage}`,
    `DB_REQUIRED: ${dbRequired}`,
    `DESIGN_REQUIRED: ${String(spec.delivery?.designRequired ?? true)}`,
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
    ...(spec.requirements
      ? [
          "### Source Requirement Ledger",
          // Source-owned clause text remains byte-exact inside the typed
          // ProductSpec evidence block and never enters compiler-owned prose.
          ...spec.requirements.map((requirement) =>
            `- ${requirement.id}: clause_hash=${requirement.clauseHash}; classification=${requirement.classification}; semantic_kinds=${requirement.expectedSemanticKinds.join(",")}; source_refs=${requirement.sources.map((source) => source.sourceRef).join(",")}`),
        ]
      : []),
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
    `- Required Inputs: ${[...new Set(requiredInputs)].join(", ") || "none; controls still validate their typed trigger state"}.`,
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
    `- Routes: ${spec.routes.map((route) => `${route.id}=${route.path}`).join(", ")}.`,
    "- route_guard_policy: no authentication guard is declared; every ProductSpec route is reachable exactly through its typed navigation actions.",
    "- Runtime Contract: the first rendered state is a required Product Surface, never a landing page, setup tutorial, or placeholder shell.",
    "- Accessibility Contract: every user action has a named interactive control and observable success/failure feedback.",
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
    "This compatibility view is rendered from the typed artifact below. Downstream v3 consumers use the typed artifact directly.",
    "```product-spec-v1",
    canonicalProjection,
    "```",
  ].join("\n");
}

export const renderLegacyPrdFromProductSpec = renderLegacyPrd;
