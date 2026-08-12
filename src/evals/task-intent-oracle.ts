import { createHash } from "node:crypto";

import { z } from "zod";

import { AcceptedCandidateV1Schema } from "../evidence/accepted-candidate-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { ProductSpecRejectionV1Schema } from "../product-compiler/producers/plan-product-spec-proposal.js";
import { extractTaskRequirementLedgerV1 } from "../product-compiler/requirements/task-requirements-v1.js";
import { DesignInteractionGraphV1Schema } from "../product-compiler/schemas/design-interaction-graph-v1.js";
import {
  ProductSpecV3ProposalSchema,
  RequirementSemanticKindV1Schema,
  type ProductActionV1,
  type ProductSpecV3Proposal,
} from "../product-compiler/schemas/product-spec-v1.js";
import { Sha256Schema, hasUniqueStrings } from "../product-compiler/schemas/common-v1.js";

const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ReasonCodeSchema = z.string().min(3).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);
const ProductClassSchema = z.enum(["utility", "operations", "game"]);
const StackPackSchema = z.enum(["vite-react-web-app", "browser-game-canvas"]);
export const RejectionCodeSchema = z.enum([
  "PRODUCT_SPEC_TASK_AMBIGUOUS",
  "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED",
  "PRODUCT_SPEC_REQUIREMENT_CONFLICT",
  "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
]);

/**
 * Eval-owned intent authority. Oracle bytes are reviewed and versioned with the
 * suite; production planners/producers are never allowed to generate them.
 * Exact task spans bind expectations to source without sharing producer IDs.
 */

export const OracleClauseV1Schema = z.object({
  clauseId: SlugSchema,
  source: z.object({
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().positive(),
    normalizedClause: z.string().min(1).max(20_000),
  }).strict(),
  requiredSemanticKinds: z.array(RequirementSemanticKindV1Schema).max(10).refine(hasUniqueStrings, {
    message: "Oracle required semantic kinds must be unique",
  }),
}).strict().superRefine((value, context) => {
  if (value.source.endOffset <= value.source.startOffset) {
    context.addIssue({ code: "custom", path: ["source", "endOffset"], message: "Oracle source span must be forward-only" });
  }
});

const OracleExpectationBase = {
  intentId: SlugSchema,
  clauseRefs: z.array(SlugSchema).min(1).max(100).refine(hasUniqueStrings, {
    message: "Oracle expectation clause refs must be unique",
  }),
} as const;

const OracleObservableAssertionV1Schema = z.object({
  phase: z.enum(["before", "after", "reload"]),
  property: z.enum(["visible_text", "value", "visibility", "enabled", "route"]),
  operator: z.enum(["equals", "contains", "matches", "changed"]),
  expected: z.json().optional(),
}).strict().superRefine((value, context) => {
  if (value.operator === "changed" && value.expected !== undefined) {
    context.addIssue({ code: "custom", path: ["expected"], message: "Changed oracle assertions cannot carry expected" });
  }
  if (value.operator !== "changed" && value.expected === undefined) {
    context.addIssue({ code: "custom", path: ["expected"], message: "Non-changed oracle assertions require expected" });
  }
  if (["visibility", "enabled"].includes(value.property)
    && value.operator === "equals" && typeof value.expected !== "boolean") {
    context.addIssue({ code: "custom", path: ["expected"], message: `${value.property} equality requires boolean expected` });
  }
  if (value.property === "route" && value.operator === "equals"
    && (typeof value.expected !== "string" || !value.expected.startsWith("/"))) {
    context.addIssue({ code: "custom", path: ["expected"], message: "Route equality requires an absolute product route" });
  }
});

const EntityExpectationV1Schema = z.object({
  ...OracleExpectationBase,
  kind: z.literal("entity"),
  minimumFields: z.number().int().positive().max(500),
}).strict();

const StateExpectationV1Schema = z.object({
  ...OracleExpectationBase,
  kind: z.literal("state"),
  stateKind: z.enum(["application", "domain", "ui", "session"]),
}).strict();

const PersistenceExpectationV1Schema = z.object({
  ...OracleExpectationBase,
  kind: z.literal("persistence"),
  policyKind: z.enum(["none", "memory", "local_storage", "database", "file", "remote_api"]),
  durability: z.enum(["none", "session", "reload", "restart", "durable"]),
}).strict();

const RouteExpectationV1Schema = z.object({
  ...OracleExpectationBase,
  kind: z.literal("route"),
  path: z.string().min(1).max(500).refine((value) => value.startsWith("/"), "Oracle route must be absolute"),
}).strict();

const SurfaceExpectationV1Schema = z.object({
  ...OracleExpectationBase,
  kind: z.literal("surface"),
  surfaceKind: z.enum(["page", "panel", "dialog", "overlay", "canvas", "terminal", "api"]),
  routePath: z.string().min(1).max(500).refine((value) => value.startsWith("/"), "Oracle route must be absolute"),
}).strict();

const ActionExpectationV1Schema = z.object({
  ...OracleExpectationBase,
  kind: z.literal("action"),
  triggerKind: z.enum(["user", "system", "timer", "route"]),
  surfaceKinds: z.array(z.enum(["page", "panel", "dialog", "overlay", "canvas", "terminal", "api"]))
    .min(1).max(20).refine(hasUniqueStrings, { message: "Oracle action surface kinds must be unique" }),
  stateEffects: z.array(z.object({
    operation: z.enum(["set", "merge", "append", "remove", "clear", "upsert"]),
    stateKind: z.enum(["application", "domain", "ui", "session"]),
  }).strict()).max(100),
  persistenceEffects: z.array(z.object({
    operation: z.enum(["read", "write", "update", "delete", "clear"]),
    policyKind: z.enum(["none", "memory", "local_storage", "database", "file", "remote_api"]),
    durability: z.enum(["none", "session", "reload", "restart", "durable"]),
  }).strict()).max(100),
  navigation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("stay") }).strict(),
    z.object({
      kind: z.literal("route"),
      path: z.string().min(1).max(500).refine((value) => value.startsWith("/"), "Oracle route must be absolute"),
    }).strict(),
    z.object({ kind: z.literal("back") }).strict(),
    z.object({ kind: z.literal("external") }).strict(),
  ]),
  control: z.object({
    kinds: z.array(z.enum([
      "button", "link", "input", "textarea", "select", "checkbox", "radio", "menu_item", "tab",
      "drag_target", "canvas_region", "other",
    ])).min(1).max(20).refine(hasUniqueStrings, { message: "Oracle control kinds must be unique" }),
    label: z.object({
      operator: z.enum(["equals", "contains"]),
      expected: z.string().min(1).max(500),
    }).strict().optional(),
  }).strict(),
  observableAssertions: z.array(OracleObservableAssertionV1Schema).min(1).max(100),
}).strict().superRefine((value, context) => {
  const keys = value.observableAssertions.map((assertion) => `${assertion.phase}\0${assertion.property}`);
  if (!hasUniqueStrings(keys)) {
    context.addIssue({ code: "custom", path: ["observableAssertions"], message: "Oracle observable phase/property pairs must be unique" });
  }
});

export const TaskIntentExpectationV1Schema = z.discriminatedUnion("kind", [
  EntityExpectationV1Schema,
  StateExpectationV1Schema,
  PersistenceExpectationV1Schema,
  RouteExpectationV1Schema,
  SurfaceExpectationV1Schema,
  ActionExpectationV1Schema,
]);

export const AcceptedDecisionV1Schema = z.object({
  kind: z.literal("accepted_candidate"),
  productClass: ProductClassSchema,
  delivery: z.object({
    platform: z.enum(["web", "game"]),
    techStack: z.enum(["vite-react", "browser-game"]),
  }).strict(),
  stackPackId: StackPackSchema,
  runtimeAdapter: z.literal("browser"),
}).strict();

const RejectionDecisionV1Schema = z.object({
  kind: z.literal("typed_rejection"),
  reasonCodes: z.array(RejectionCodeSchema).min(1).max(4).refine(hasUniqueStrings, {
    message: "Oracle rejection reason codes must be unique",
  }),
}).strict();

export const TaskIntentOracleV1Schema = z.object({
  schema: z.literal("setfarm.task-intent-oracle.v1"),
  oracleId: SlugSchema,
  oracleVersion: z.literal(1),
  locale: z.literal("en"),
  cohort: z.enum(["baseline", "holdout", "negative"]),
  variant: z.enum(["direct", "paraphrase", "compositional", "ambiguous", "unsupported"]),
  expectedDecision: z.discriminatedUnion("kind", [AcceptedDecisionV1Schema, RejectionDecisionV1Schema]),
  clauses: z.array(OracleClauseV1Schema).min(1).max(1_000),
  expectations: z.array(TaskIntentExpectationV1Schema).max(2_000),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.clauses.map((clause) => clause.clauseId))) {
    context.addIssue({ code: "custom", path: ["clauses"], message: "Oracle clause IDs must be unique" });
  }
  if (!hasUniqueStrings(value.expectations.map((expectation) => expectation.intentId))) {
    context.addIssue({ code: "custom", path: ["expectations"], message: "Oracle intent IDs must be unique" });
  }
  const clauses = new Set(value.clauses.map((clause) => clause.clauseId));
  value.expectations.forEach((expectation, expectationIndex) => {
    expectation.clauseRefs.forEach((reference, referenceIndex) => {
      if (!clauses.has(reference)) {
        context.addIssue({
          code: "custom",
          path: ["expectations", expectationIndex, "clauseRefs", referenceIndex],
          message: `Oracle expectation references absent clause ${reference}`,
        });
      }
    });
  });
  const negative = value.expectedDecision.kind === "typed_rejection";
  if (negative !== (value.cohort === "negative")) {
    context.addIssue({ code: "custom", path: ["cohort"], message: "Negative cohort and typed rejection decision must agree" });
  }
  if (negative && value.expectations.length !== 0) {
    context.addIssue({ code: "custom", path: ["expectations"], message: "Typed rejection oracle cannot invent product semantics" });
  }
  value.clauses.forEach((clause, clauseIndex) => {
    if (negative && clause.requiredSemanticKinds.length !== 0) {
      context.addIssue({
        code: "custom",
        path: ["clauses", clauseIndex, "requiredSemanticKinds"],
        message: "Typed rejection clauses cannot pre-accept product semantics",
      });
    }
    if (!negative && clause.requiredSemanticKinds.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["clauses", clauseIndex, "requiredSemanticKinds"],
        message: "Accepted oracle clauses require an independent semantic obligation",
      });
    }
  });
  if (!negative && value.expectations.length === 0) {
    context.addIssue({ code: "custom", path: ["expectations"], message: "Accepted oracle requires independent semantic expectations" });
  }
});

export type TaskIntentOracleV1 = z.infer<typeof TaskIntentOracleV1Schema>;
export type TaskIntentExpectationV1 = z.infer<typeof TaskIntentExpectationV1Schema>;

const OracleEvaluationPayloadV1Schema = z.object({
  schema: z.literal("setfarm.task-intent-oracle-evaluation.v1"),
  oracleHash: Sha256Schema,
  expectedDecision: z.enum(["accepted_candidate", "typed_rejection"]),
  actualDecision: z.enum(["accepted_candidate", "typed_rejection", "unavailable"]),
  contractComplete: z.boolean(),
  decisionEvidenceVerified: z.boolean(),
  matchedIntentIds: z.array(SlugSchema).max(2_000).refine(hasUniqueStrings),
  requiredEvidenceRefs: z.array(z.string().regex(/^EVID_[A-Z0-9]+(?:_[A-Z0-9]+)*$/)).max(10_000).refine(hasUniqueStrings),
  mismatchCodes: z.array(ReasonCodeSchema).max(10_000).refine(hasUniqueStrings),
}).strict();

export const TaskIntentOracleEvaluationV1Schema = OracleEvaluationPayloadV1Schema.extend({
  evaluationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { evaluationHash, ...payload } = value;
  if (evaluationHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["evaluationHash"], message: "Oracle evaluation hash mismatch" });
  }
  const passed = value.mismatchCodes.length === 0 && value.contractComplete && value.decisionEvidenceVerified;
  if (!passed && value.mismatchCodes.length === 0) {
    context.addIssue({ code: "custom", path: ["mismatchCodes"], message: "Non-passing oracle evaluation requires a reason" });
  }
});

export type TaskIntentOracleEvaluationV1 = z.infer<typeof TaskIntentOracleEvaluationV1Schema>;

export type TaskIntentOracleActualV1 =
  | Readonly<{
      kind: "accepted_candidate";
      productSpec: unknown;
      designGraph: unknown;
      sealedStackPackId: string | null;
      acceptedCandidate: unknown;
      passingPredicateRefs: readonly string[];
    }>
  | Readonly<{
      kind: "typed_rejection";
      rejection: unknown;
      owner: string;
      modelRedispatchBudget: number;
    }>
  | Readonly<{ kind: "unavailable" }>;

function sha256(value: string): string {
  return createHash("sha256").update(Buffer.from(value, "utf8")).digest("hex");
}

function canonicalStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

export function taskIntentOracleHashV1(task: string, rawOracle: unknown): string {
  const oracle = TaskIntentOracleV1Schema.parse(rawOracle);
  return hashCanonicalJson({
    schema: "setfarm.task-intent-oracle-identity.v1",
    taskSourceHash: sha256(task),
    oracle,
  });
}

type TaskBinding = Readonly<{
  mismatchCodes: string[];
  requirementIdsByClause: ReadonlyMap<string, string>;
}>;

export function evaluateTaskIntentOracleTaskBindingV1(
  task: string,
  rawOracle: unknown,
): TaskBinding {
  const oracle = TaskIntentOracleV1Schema.parse(rawOracle);
  const mismatchCodes = new Set<string>();
  const requirementIdsByClause = new Map<string, string>();
  let ledger;
  try {
    ledger = extractTaskRequirementLedgerV1(task);
  } catch {
    return { mismatchCodes: ["ORACLE_TASK_LEDGER_INVALID"], requirementIdsByClause };
  }
  for (const clause of oracle.clauses) {
    const { startOffset, endOffset, normalizedClause } = clause.source;
    const sliced = task.slice(startOffset, endOffset).normalize("NFKC").replace(/\s+/gu, " ").trim();
    if (sliced !== normalizedClause) mismatchCodes.add("ORACLE_TASK_SPAN_MISMATCH");
    const matches = ledger.requirements.filter((requirement) =>
      requirement.normalizedClause === normalizedClause
      && requirement.sources.some((source) =>
        source.span.startOffset === startOffset && source.span.endOffset === endOffset));
    if (matches.length !== 1) {
      mismatchCodes.add("ORACLE_TASK_CLAUSE_MISMATCH");
    } else {
      requirementIdsByClause.set(clause.clauseId, matches[0]!.id);
    }
  }
  if (new Set(requirementIdsByClause.values()).size !== ledger.requirements.length
    || ledger.requirements.some((requirement) =>
      ![...requirementIdsByClause.values()].includes(requirement.id))) {
    mismatchCodes.add("ORACLE_TASK_COVERAGE_INCOMPLETE");
  }
  return { mismatchCodes: canonicalStrings([...mismatchCodes]), requirementIdsByClause };
}

function exactJson(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function boundSemanticRefs(
  spec: ProductSpecV3Proposal,
  kind: z.infer<typeof RequirementSemanticKindV1Schema>,
  requirementIds: readonly string[],
): string[] {
  return canonicalStrings((spec.traceability?.bindings ?? [])
    .filter((binding) => binding.semanticKind === kind
      && requirementIds.every((requirementId) => binding.requirementRefs.includes(requirementId)))
    .map((binding) => binding.semanticRef));
}

function observableMismatchCode(property: string): string {
  const suffix = property === "visible_text" ? "TEXT" : property.toUpperCase();
  return `ORACLE_OBSERVABLE_${suffix}_MISMATCH`;
}

function actionMismatches(
  action: ProductActionV1,
  expectation: Extract<TaskIntentExpectationV1, { kind: "action" }>,
  spec: ProductSpecV3Proposal,
  graph: z.infer<typeof DesignInteractionGraphV1Schema>,
): string[] {
  const mismatches = new Set<string>();
  if (action.trigger.kind !== expectation.triggerKind) mismatches.add("ORACLE_ACTION_TRIGGER_MISMATCH");
  const actionSurfaces = action.surfaceRefs
    .map((reference) => spec.surfaces.find((surface) => surface.id === reference))
    .filter((surface): surface is NonNullable<typeof surface> => Boolean(surface));
  expectation.surfaceKinds.forEach((kind) => {
    if (!actionSurfaces.some((surface) => surface.kind === kind)) mismatches.add("ORACLE_ACTION_SURFACE_MISMATCH");
  });
  expectation.stateEffects.forEach((expected) => {
    const matched = action.stateDeltas.some((delta) => {
      const state = spec.states.find((candidate) => candidate.id === delta.stateRef);
      return delta.operation === expected.operation && state?.kind === expected.stateKind;
    });
    if (!matched) mismatches.add("ORACLE_STATE_EFFECT_MISMATCH");
  });
  expectation.persistenceEffects.forEach((expected) => {
    const matched = action.persistenceEffects.some((effect) => {
      const policy = spec.persistencePolicies.find((candidate) => candidate.id === effect.policyRef);
      return effect.operation === expected.operation
        && policy?.kind === expected.policyKind
        && policy.durability === expected.durability;
    });
    if (!matched) mismatches.add("ORACLE_PERSISTENCE_EFFECT_MISMATCH");
  });
  if (expectation.navigation.kind !== action.navigation.kind) {
    mismatches.add("ORACLE_ROUTE_OUTCOME_MISMATCH");
  } else if (expectation.navigation.kind === "route" && action.navigation.kind === "route") {
    const routeRef = action.navigation.routeRef;
    const route = spec.routes.find((candidate) => candidate.id === routeRef);
    if (route?.path !== expectation.navigation.path) mismatches.add("ORACLE_ROUTE_OUTCOME_MISMATCH");
  }

  const controls = graph.bindings
    .filter((binding) => binding.disposition === "action" && binding.actionRef === action.id)
    .map((binding) => graph.controls.find((control) => control.id === binding.controlRef))
    .filter((control): control is NonNullable<typeof control> => Boolean(control && control.interactive));
  if (controls.length === 0) {
    mismatches.add("ORACLE_CONTROL_MISSING");
  } else {
    if (!controls.some((control) => expectation.control.kinds.includes(control.kind))) {
      mismatches.add("ORACLE_CONTROL_KIND_MISMATCH");
    }
    if (expectation.control.label && !controls.some((control) => {
      const label = control.label ?? control.accessibility.name ?? "";
      return expectation.control.label!.operator === "equals"
        ? label === expectation.control.label!.expected
        : label.includes(expectation.control.label!.expected);
    })) mismatches.add("ORACLE_CONTROL_LABEL_MISMATCH");
  }

  const observableEffects = action.observableEffects ?? [];
  if (observableEffects.length === 0) mismatches.add("ORACLE_OBSERVABLE_MISSING");
  expectation.observableAssertions.forEach((expected) => {
    const matched = observableEffects.some((effect) => effect.assertions.some((assertion) =>
      assertion.phase === expected.phase
      && assertion.property === expected.property
      && assertion.operator === expected.operator
      && exactJson(assertion.expected, expected.expected)));
    if (!matched) mismatches.add(observableMismatchCode(expected.property));
  });
  return canonicalStrings([...mismatches]);
}

type ContractEvaluation = Readonly<{
  mismatches: string[];
  matchedIntentIds: string[];
  requiredEvidenceRefs: string[];
}>;

function evaluateAcceptedContract(
  task: string,
  oracle: TaskIntentOracleV1,
  actual: Extract<TaskIntentOracleActualV1, { kind: "accepted_candidate" }>,
  binding: TaskBinding,
): ContractEvaluation {
  const mismatches = new Set<string>(binding.mismatchCodes);
  const matchedIntentIds = new Set<string>();
  const requiredEvidenceRefs = new Set<string>();
  const parsedSpec = ProductSpecV3ProposalSchema.safeParse(actual.productSpec);
  if (!parsedSpec.success) {
    mismatches.add("ORACLE_PRODUCT_SPEC_INVALID");
    return { mismatches: canonicalStrings([...mismatches]), matchedIntentIds: [], requiredEvidenceRefs: [] };
  }
  const parsedGraph = DesignInteractionGraphV1Schema.safeParse(actual.designGraph);
  if (!parsedGraph.success) {
    mismatches.add("ORACLE_DESIGN_GRAPH_INVALID");
    return { mismatches: canonicalStrings([...mismatches]), matchedIntentIds: [], requiredEvidenceRefs: [] };
  }
  const spec = parsedSpec.data;
  const graph = parsedGraph.data;
  const decision = oracle.expectedDecision;
  if (decision.kind !== "accepted_candidate") {
    mismatches.add("ORACLE_EXPECTED_DECISION_MISMATCH");
    return { mismatches: canonicalStrings([...mismatches]), matchedIntentIds: [], requiredEvidenceRefs: [] };
  }
  if (spec.traceability?.sourceTaskHash !== sha256(task)) mismatches.add("ORACLE_TASK_HASH_MISMATCH");
  if (spec.product.class !== decision.productClass) mismatches.add("ORACLE_PRODUCT_CLASS_MISMATCH");
  if (spec.delivery?.platform !== decision.delivery.platform
    || spec.delivery.techStack !== decision.delivery.techStack) mismatches.add("ORACLE_DELIVERY_MISMATCH");
  if (actual.sealedStackPackId !== decision.stackPackId) mismatches.add("ORACLE_STACK_PACK_MISMATCH");

  for (const clause of oracle.clauses) {
    const requirementId = binding.requirementIdsByClause.get(clause.clauseId);
    const requirement = spec.requirements?.find((candidate) => candidate.id === requirementId);
    if (!requirement || requirement.normalizedClause !== clause.source.normalizedClause) {
      mismatches.add("ORACLE_PRODUCT_REQUIREMENT_MISSING");
      continue;
    }
    clause.requiredSemanticKinds.forEach((kind) => {
      if (!boundSemanticRefs(spec, kind, [requirement.id]).length) {
        mismatches.add("ORACLE_REQUIREMENT_SEMANTIC_KIND_MISSING");
      }
    });
  }

  for (const expectation of oracle.expectations) {
    const requirementIds = expectation.clauseRefs
      .map((reference) => binding.requirementIdsByClause.get(reference))
      .filter((value): value is string => Boolean(value));
    if (requirementIds.length !== expectation.clauseRefs.length) {
      mismatches.add("ORACLE_EXPECTATION_CLAUSE_UNRESOLVED");
      continue;
    }
    const refs = boundSemanticRefs(spec, expectation.kind, requirementIds);
    if (expectation.kind === "entity") {
      const matched = refs.some((reference) => {
        const entity = spec.entities.find((candidate) => candidate.id === reference);
        return Boolean(entity && entity.fields.length >= expectation.minimumFields);
      });
      if (matched) matchedIntentIds.add(expectation.intentId);
      else mismatches.add("ORACLE_ENTITY_MISSING");
    } else if (expectation.kind === "state") {
      const matched = refs.some((reference) =>
        spec.states.some((state) => state.id === reference && state.kind === expectation.stateKind));
      if (matched) matchedIntentIds.add(expectation.intentId);
      else mismatches.add("ORACLE_STATE_MISSING");
    } else if (expectation.kind === "persistence") {
      const matched = refs.some((reference) => spec.persistencePolicies.some((policy) =>
        policy.id === reference && policy.kind === expectation.policyKind
        && policy.durability === expectation.durability));
      if (matched) matchedIntentIds.add(expectation.intentId);
      else mismatches.add("ORACLE_PERSISTENCE_MISSING");
    } else if (expectation.kind === "route") {
      const matched = refs.some((reference) =>
        spec.routes.some((route) => route.id === reference && route.path === expectation.path));
      if (matched) matchedIntentIds.add(expectation.intentId);
      else mismatches.add("ORACLE_ROUTE_MISSING");
    } else if (expectation.kind === "surface") {
      const matched = refs.some((reference) => {
        const surface = spec.surfaces.find((candidate) => candidate.id === reference);
        const route = surface ? spec.routes.find((candidate) => candidate.id === surface.routeRef) : undefined;
        return surface?.kind === expectation.surfaceKind && route?.path === expectation.routePath;
      });
      if (matched) matchedIntentIds.add(expectation.intentId);
      else mismatches.add("ORACLE_SURFACE_MISSING");
    } else {
      const candidates = refs
        .map((reference) => spec.actions.find((action) => action.id === reference))
        .filter((action): action is ProductActionV1 => Boolean(action));
      if (candidates.length === 0) {
        mismatches.add("ORACLE_ACTION_MISSING");
        continue;
      }
      const evaluated = candidates.map((action) => ({
        action,
        mismatches: actionMismatches(action, expectation, spec, graph),
      })).sort((left, right) => left.mismatches.length - right.mismatches.length);
      const best = evaluated[0]!;
      if (best.mismatches.length > 0) best.mismatches.forEach((code) => mismatches.add(code));
      else {
        matchedIntentIds.add(expectation.intentId);
        best.action.evidenceRefs.forEach((reference) => requiredEvidenceRefs.add(reference));
        (best.action.observableEffects ?? []).forEach((effect) => requiredEvidenceRefs.add(effect.evidenceRef));
      }
    }
  }
  return {
    mismatches: canonicalStrings([...mismatches]),
    matchedIntentIds: canonicalStrings([...matchedIntentIds]),
    requiredEvidenceRefs: canonicalStrings([...requiredEvidenceRefs]),
  };
}

function createEvaluation(payload: z.input<typeof OracleEvaluationPayloadV1Schema>): TaskIntentOracleEvaluationV1 {
  const parsed = OracleEvaluationPayloadV1Schema.parse({
    ...payload,
    matchedIntentIds: canonicalStrings(payload.matchedIntentIds),
    requiredEvidenceRefs: canonicalStrings(payload.requiredEvidenceRefs),
    mismatchCodes: canonicalStrings(payload.mismatchCodes),
  });
  return TaskIntentOracleEvaluationV1Schema.parse({
    ...parsed,
    evaluationHash: hashCanonicalJson(parsed),
  });
}

export function evaluateTaskIntentOracleV1(input: Readonly<{
  task: string;
  oracle: unknown;
  actual: TaskIntentOracleActualV1;
}>): TaskIntentOracleEvaluationV1 {
  const oracle = TaskIntentOracleV1Schema.parse(input.oracle);
  const oracleHash = taskIntentOracleHashV1(input.task, oracle);
  const binding = evaluateTaskIntentOracleTaskBindingV1(input.task, oracle);
  const expectedDecision = oracle.expectedDecision.kind;
  const actualDecision = input.actual.kind;

  if (input.actual.kind === "typed_rejection") {
    const mismatches = new Set<string>(binding.mismatchCodes);
    if (expectedDecision !== "typed_rejection") mismatches.add("ORACLE_DECISION_MISMATCH");
    const rejection = ProductSpecRejectionV1Schema.safeParse(input.actual.rejection);
    if (!rejection.success) {
      mismatches.add("ORACLE_TYPED_REJECTION_INVALID");
    } else {
      if (rejection.data.sourceTaskHash !== sha256(input.task)) mismatches.add("ORACLE_TASK_HASH_MISMATCH");
      const expectedCodes = expectedDecision === "typed_rejection"
        ? canonicalStrings(oracle.expectedDecision.reasonCodes)
        : [];
      const actualCodes = canonicalStrings(rejection.data.reasons.map((reason) => reason.code));
      if (!exactJson(expectedCodes, actualCodes)) mismatches.add("ORACLE_REJECTION_CODE_MISMATCH");
      const cited = new Set(rejection.data.reasons.flatMap((reason) => reason.requirementRefs));
      if ([...binding.requirementIdsByClause.values()].some((requirementId) => !cited.has(requirementId))) {
        mismatches.add("ORACLE_REJECTION_CLAUSE_COVERAGE_INCOMPLETE");
      }
    }
    if (input.actual.owner !== "compiler") mismatches.add("ORACLE_REJECTION_OWNER_INVALID");
    if (input.actual.modelRedispatchBudget !== 0) mismatches.add("ORACLE_REJECTION_REDISPATCH_NOT_ZERO");
    const mismatchCodes = canonicalStrings([...mismatches]);
    return createEvaluation({
      schema: "setfarm.task-intent-oracle-evaluation.v1",
      oracleHash,
      expectedDecision,
      actualDecision,
      contractComplete: mismatchCodes.length === 0,
      decisionEvidenceVerified: mismatchCodes.length === 0,
      matchedIntentIds: [],
      requiredEvidenceRefs: [],
      mismatchCodes,
    });
  }

  if (input.actual.kind !== "accepted_candidate") {
    return createEvaluation({
      schema: "setfarm.task-intent-oracle-evaluation.v1",
      oracleHash,
      expectedDecision,
      actualDecision,
      contractComplete: false,
      decisionEvidenceVerified: false,
      matchedIntentIds: [],
      requiredEvidenceRefs: [],
      mismatchCodes: ["ORACLE_DECISION_EVIDENCE_UNAVAILABLE"],
    });
  }

  const contract = evaluateAcceptedContract(input.task, oracle, input.actual, binding);
  const mismatches = new Set(contract.mismatches);
  if (expectedDecision !== "accepted_candidate") mismatches.add("ORACLE_DECISION_MISMATCH");
  let decisionEvidenceVerified = false;
  // Do not let AcceptedCandidate self-certify an incomplete packet contract.
  if (mismatches.size === 0) {
    const candidate = AcceptedCandidateV1Schema.safeParse(input.actual.acceptedCandidate);
    if (!candidate.success) {
      mismatches.add("ORACLE_ACCEPTED_CANDIDATE_INVALID");
    } else {
      const acceptedRefs = new Set(candidate.data.storyEvidence.flatMap((story) => story.predicateRefs));
      const passingRefs = new Set(input.actual.passingPredicateRefs);
      if (contract.requiredEvidenceRefs.some((reference) => !acceptedRefs.has(reference))) {
        mismatches.add("ORACLE_ACCEPTED_EVIDENCE_REF_MISSING");
      }
      if (contract.requiredEvidenceRefs.some((reference) => !passingRefs.has(reference))) {
        mismatches.add("ORACLE_ACCEPTED_EVIDENCE_NOT_PASSING");
      }
      decisionEvidenceVerified = mismatches.size === 0;
    }
  }
  const mismatchCodes = canonicalStrings([...mismatches]);
  return createEvaluation({
    schema: "setfarm.task-intent-oracle-evaluation.v1",
    oracleHash,
    expectedDecision,
    actualDecision,
    contractComplete: contract.mismatches.length === 0,
    decisionEvidenceVerified,
    matchedIntentIds: contract.matchedIntentIds,
    requiredEvidenceRefs: contract.requiredEvidenceRefs,
    mismatchCodes,
  });
}
