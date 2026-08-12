import { z } from "zod";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import {
  CanonicalJsonError,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1,
  PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1,
  PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1,
  PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
  PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1,
  ProductRuntimeBehaviorContractV1Schema,
  ProductRuntimeBehaviorProposalV1Schema,
  deriveProductRuntimeAssertionRefV1,
  deriveProductRuntimeEntityFieldOccurrenceRefV1,
  deriveProductRuntimeInvariantRefV1,
  hashProductRuntimeAssertionPayloadV1,
  hashProductRuntimeBehaviorContractV1,
  hashProductRuntimeBehaviorProposalV1,
  hashProductRuntimeEntitySnapshotBindingV1,
  recursivelyFreezeProductRuntimeBehaviorV1,
  type ProductRuntimeBehaviorAssertionProposalV1,
  type ProductRuntimeBehaviorAssertionV1,
  type ProductRuntimeBehaviorContractHashPayloadV1,
  type ProductRuntimeBehaviorContractV1,
  type ProductRuntimeBehaviorPredicateV1,
  type ProductRuntimeBehaviorProposalV1,
  type ProductRuntimeBehaviorSemanticCoverageRefV1,
  type ProductRuntimeBehaviorSubjectV1,
  type ProductRuntimeEntityFieldBindingV1,
  type ProductRuntimeInvariantBindingV1,
} from "./schemas/product-runtime-behavior-contract-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import { invocationValueMatchesTypeV1 } from "./schemas/action-invocation-interface-intent-v1.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V1 = 12 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V1 = 16 * 1024 * 1024;
const EVALUATOR_INPUT_MAX_CANONICAL_BYTES_V1 = 16 * 1024 * 1024;
const CONTRACT_OUTPUT_MAX_CANONICAL_BYTES_V1 = 4 * 1024 * 1024;
const MAX_DIAGNOSTICS_V1 = 100;
const MAX_ASSERTION_VISITS_V1 = 100_000;
const MAX_COLLECTION_ITEMS_PER_ASSERTION_V1 = 10_000;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV1Schema = z.object({
  productSpec: z.unknown(),
  proposal: z.unknown(),
}).strict();

const VerifierInputV1Schema = z.object({
  productSpec: z.unknown(),
  proposal: z.unknown(),
  candidate: z.unknown(),
}).strict();

const EvaluationInputV1Schema = z.object({
  productSpec: z.unknown(),
  proposal: z.unknown(),
  candidate: z.unknown(),
  checkpoint: z.enum(["initial", "after_action", "after_rehydration"]),
  actionRef: z.string().min(1).max(160).optional(),
  stateSnapshot: z.record(z.string().min(1).max(160), z.json()),
}).strict();

const EntityResolutionInputV1Schema = z.object({
  productSpec: z.unknown(),
  proposal: z.unknown(),
  candidate: z.unknown(),
  actionRef: z.string().min(1).max(160),
  deltaOrdinal: z.number().int().nonnegative().max(499),
  actionInput: z.record(z.string().min(1).max(160), z.json()),
  stateSnapshot: z.record(z.string().min(1).max(160), z.json()),
}).strict();

export type ProductRuntimeBehaviorDiagnosticCodeV1 =
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_ASSERTION_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_FIELD_COVERAGE_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_INVARIANT_COVERAGE_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_NON_RUNTIME_DISPOSITION_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_OUTPUT_LIMIT_EXCEEDED"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_PRODUCT_SPEC_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_PROPOSAL_AUTHORITY_MISMATCH"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_PROPOSAL_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_REQUIREMENT_TRACEABILITY_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_SEMANTIC_COVERAGE_INVALID";

export type ProductRuntimeBehaviorDiagnosticV1 = Readonly<{
  code: ProductRuntimeBehaviorDiagnosticCodeV1;
  path: string;
  message: string;
  reference?: string;
}>;

export type ProductRuntimeBehaviorCompilationResultV1 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      contract: Readonly<ProductRuntimeBehaviorContractV1>;
      contractHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductRuntimeBehaviorDiagnosticV1[];
    }>;

type JsonResolution = Readonly<
  | { exists: true; value: unknown }
  | { exists: false }
>;

type AssertionEvaluation = Readonly<{
  passed: boolean;
  observedHash: string;
  reason: string;
  visits: number;
}>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function boundedSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function errorMessage(error: unknown): string {
  if (error instanceof CanonicalJsonLimitError || error instanceof CanonicalJsonError) {
    return `${error.code}:${error.path}`;
  }
  return error instanceof Error ? error.message : "Invalid canonical JSON input";
}

function diagnostic(
  code: ProductRuntimeBehaviorDiagnosticCodeV1,
  path: string,
  message: string,
  reference?: string,
): ProductRuntimeBehaviorDiagnosticV1 {
  return Object.freeze({
    code,
    path: path.slice(0, 1_000),
    message: message.slice(0, 1_500),
    ...(reference ? { reference: reference.slice(0, 500) } : {}),
  });
}

function rejected(
  diagnostics: readonly ProductRuntimeBehaviorDiagnosticV1[],
): ProductRuntimeBehaviorCompilationResultV1 {
  const retained = diagnostics.slice(0, MAX_DIAGNOSTICS_V1 - 1);
  if (diagnostics.length >= MAX_DIAGNOSTICS_V1) {
    retained.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
      "/",
      `Diagnostics exceeded ${MAX_DIAGNOSTICS_V1 - 1}; remaining issues were omitted`,
    ));
  }
  return recursivelyFreezeProductRuntimeBehaviorV1({
    status: "rejected" as const,
    diagnostics: retained,
  });
}

function zodDiagnostics(
  code: ProductRuntimeBehaviorDiagnosticCodeV1,
  error: z.ZodError,
  prefix = "",
): readonly ProductRuntimeBehaviorDiagnosticV1[] {
  return error.issues.map((issue) => diagnostic(
    code,
    `${prefix}/${issue.path.join("/")}`.replace(/\/$/u, "") || "/",
    issue.message,
  ));
}

function pointerSegments(pointer: string): readonly string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

function resolvePointer(root: unknown, pointer: string): JsonResolution {
  let current = root;
  for (const segment of pointerSegments(pointer)) {
    if (current === null || typeof current !== "object") return { exists: false };
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return { exists: false };
    current = (current as Record<string, unknown>)[segment];
  }
  return { exists: true, value: current };
}

function jsonType(value: unknown): "array" | "boolean" | "null" | "number" | "object" | "string" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "object";
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function jsonTruthy(value: unknown): boolean {
  return !(
    value === null
    || value === false
    || value === 0
    || value === ""
  );
}

function predicatePasses(
  resolution: JsonResolution,
  predicate: ProductRuntimeBehaviorPredicateV1,
): boolean {
  if (predicate.operator === "exists") return resolution.exists;
  if (predicate.operator === "not_exists") return !resolution.exists;
  if (!resolution.exists) return false;
  const value = resolution.value;
  switch (predicate.operator) {
    case "equals":
      return canonicalEqual(value, predicate.expected);
    case "not_equals":
      return !canonicalEqual(value, predicate.expected);
    case "truthy":
      return jsonTruthy(value);
    case "falsy":
      return !jsonTruthy(value);
    case "type_is":
      return jsonType(value) === predicate.expected;
    case "one_of":
      return predicate.expected.some((expected) => canonicalEqual(value, expected));
    case "min_length":
      return typeof value === "string" && value.length >= predicate.expected;
    case "max_length":
      return typeof value === "string" && value.length <= predicate.expected;
    case "minimum":
      return typeof value === "number" && value >= predicate.expected;
    case "maximum":
      return typeof value === "number" && value <= predicate.expected;
    case "min_items":
      return Array.isArray(value) && value.length >= predicate.expected;
    case "max_items":
      return Array.isArray(value) && value.length <= predicate.expected;
  }
}

function observedResolutionHash(resolutions: readonly JsonResolution[]): string {
  return hashCanonicalJson({
    schema: "setfarm.product-runtime-behavior-observation.v1",
    observations: resolutions.map((resolution) => resolution.exists
      ? { exists: true as const, valueHash: hashCanonicalJson(resolution.value) }
      : { exists: false as const }),
  });
}

function evaluateAssertion(
  assertion: Readonly<{
    subject: ProductRuntimeBehaviorSubjectV1;
    predicate: ProductRuntimeBehaviorPredicateV1;
  }>,
  stateSnapshot: Readonly<Record<string, unknown>>,
): AssertionEvaluation {
  const state = Object.prototype.hasOwnProperty.call(
    stateSnapshot,
    assertion.subject.stateRef,
  )
    ? { exists: true as const, value: stateSnapshot[assertion.subject.stateRef] }
    : { exists: false as const };
  if (assertion.subject.kind === "state_path") {
    const resolution = state.exists
      ? resolvePointer(state.value, assertion.subject.path)
      : state;
    return {
      passed: predicatePasses(resolution, assertion.predicate),
      observedHash: observedResolutionHash([resolution]),
      reason: resolution.exists ? "predicate_evaluated" : "state_or_path_missing",
      visits: 1,
    };
  }
  const collection = state.exists
    ? resolvePointer(state.value, assertion.subject.collectionPath)
    : state;
  if (!collection.exists || !Array.isArray(collection.value)) {
    return {
      passed: false,
      observedHash: observedResolutionHash([collection]),
      reason: collection.exists ? "collection_not_array" : "collection_missing",
      visits: 1,
    };
  }
  if (collection.value.length > MAX_COLLECTION_ITEMS_PER_ASSERTION_V1) {
    return {
      passed: false,
      observedHash: hashCanonicalJson({
        schema: "setfarm.product-runtime-behavior-observation-limit.v1",
        itemCount: collection.value.length,
      }),
      reason: "collection_item_budget_exceeded",
      visits: MAX_COLLECTION_ITEMS_PER_ASSERTION_V1 + 1,
    };
  }
  const itemPath = assertion.subject.itemPath;
  const resolutions = collection.value.map((item) =>
    resolvePointer(item, itemPath));
  return {
    passed: resolutions.every((resolution) =>
      predicatePasses(resolution, assertion.predicate)),
    observedHash: observedResolutionHash(resolutions),
    reason: resolutions.length === 0
      ? "empty_collection_vacuously_satisfied"
      : "every_item_evaluated",
    visits: Math.max(1, resolutions.length),
  };
}

function productInitialState(productSpec: ProductSpecV2): Readonly<Record<string, unknown>> {
  return Object.fromEntries(productSpec.states.map((state) => [
    state.id,
    structuredClone(state.initialValue),
  ]));
}

function traceabilityRequirements(
  productSpec: ProductSpecV2,
  semanticKind: string,
  semanticRef: string,
): readonly string[] {
  return productSpec.traceability.bindings.find((binding) =>
    binding.semanticKind === semanticKind && binding.semanticRef === semanticRef)
    ?.requirementRefs ?? [];
}

function canonicalProposal(
  proposal: ProductRuntimeBehaviorProposalV1,
): ProductRuntimeBehaviorProposalV1 {
  const invariantBindings = proposal.invariantBindings.map((binding) => {
    const disposition = binding.disposition.kind === "runtime_assertions"
      ? {
          ...binding.disposition,
          assertions: [...binding.disposition.assertions].sort((left, right) =>
            compareUtf16(canonicalJsonStringify(left), canonicalJsonStringify(right))),
        }
      : binding.disposition.kind === "structured_semantic_coverage"
        ? {
            ...binding.disposition,
            coverageRefs: [...binding.disposition.coverageRefs].sort((left, right) =>
              compareUtf16(canonicalJsonStringify(left), canonicalJsonStringify(right))),
          }
        : {
            ...binding.disposition,
            evidenceRefs: [...binding.disposition.evidenceRefs].sort(compareUtf16),
          };
    return {
      ...binding,
      requirementRefs: [...binding.requirementRefs].sort(compareUtf16),
      disposition,
    };
  }).sort((left, right) =>
    compareUtf16(left.stateRef, right.stateRef)
    || left.invariantOrdinal - right.invariantOrdinal);
  const entityFieldBindings = [...proposal.entityFieldBindings].sort((left, right) =>
    compareUtf16(left.actionRef, right.actionRef)
    || left.deltaOrdinal - right.deltaOrdinal);
  return ProductRuntimeBehaviorProposalV1Schema.parse({
    ...proposal,
    invariantBindings,
    entityFieldBindings,
  });
}

function uniqueCanonicalValues(values: readonly unknown[]): boolean {
  const identities = values.map((value) => canonicalJsonStringify(value));
  return new Set(identities).size === identities.length;
}

function compileRuntimeAssertions(
  productSpec: ProductSpecV2,
  stateRef: string,
  invariantRef: string,
  assertions: readonly ProductRuntimeBehaviorAssertionProposalV1[],
  path: string,
  diagnostics: ProductRuntimeBehaviorDiagnosticV1[],
): readonly ProductRuntimeBehaviorAssertionV1[] {
  if (!uniqueCanonicalValues(assertions)) {
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_ASSERTION_INVALID",
      path,
      "Runtime assertions for one invariant must be canonically unique",
      invariantRef,
    ));
  }
  const initialState = productInitialState(productSpec);
  const compiled = assertions.map((assertion, assertionIndex) => {
    if (assertion.subject.stateRef !== stateRef) {
      diagnostics.push(diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_ASSERTION_INVALID",
        `${path}/${assertionIndex}/subject/stateRef`,
        "A state invariant assertion may inspect only its exact owning state",
        assertion.subject.stateRef,
      ));
    }
    const evaluation = evaluateAssertion(assertion, initialState);
    if (!evaluation.passed) {
      diagnostics.push(diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_ASSERTION_INVALID",
        `${path}/${assertionIndex}`,
        `Initial ProductSpec state violates the proposed invariant assertion: ${evaluation.reason}`,
        invariantRef,
      ));
    }
    const hashInput = {
      invariantRef,
      subject: assertion.subject,
      predicate: assertion.predicate,
    };
    return {
      assertionRef: deriveProductRuntimeAssertionRefV1(hashInput),
      assertionHash: hashProductRuntimeAssertionPayloadV1(hashInput),
      subject: assertion.subject,
      predicate: assertion.predicate,
    };
  }).sort((left, right) => compareUtf16(left.assertionRef, right.assertionRef));
  return compiled;
}

function semanticCoverageRequirements(
  productSpec: ProductSpecV2,
  stateRef: string,
  reference: ProductRuntimeBehaviorSemanticCoverageRefV1,
  path: string,
  diagnostics: ProductRuntimeBehaviorDiagnosticV1[],
): readonly string[] {
  const action = productSpec.actions.find((candidate) => candidate.id === reference.actionRef);
  if (!action) {
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_SEMANTIC_COVERAGE_INVALID",
      path,
      `Structured coverage references absent action ${reference.actionRef}`,
      reference.actionRef,
    ));
    return [];
  }
  let touchesState = false;
  let semanticKind = "action";
  let semanticRef = action.id;
  if (reference.kind === "action_delta") {
    touchesState = action.stateDeltas[reference.deltaOrdinal]?.stateRef === stateRef;
  } else if (reference.kind === "action_precondition") {
    touchesState = action.preconditions[reference.preconditionOrdinal]?.stateRef === stateRef;
  } else if (reference.kind === "action_observable") {
    const observable = action.observableEffects.find((candidate) =>
      candidate.id === reference.observableRef);
    touchesState = Boolean(observable) && (
      action.success.stateRefs.includes(stateRef)
      || action.failure.stateRefs.includes(stateRef)
    );
    semanticKind = "observable";
    semanticRef = reference.observableRef;
  } else {
    touchesState = Boolean(action.persistenceEffects[reference.effectOrdinal]?.statePaths.some(
      (statePath) => statePath.stateRef === stateRef,
    ));
  }
  if (!touchesState) {
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_SEMANTIC_COVERAGE_INVALID",
      path,
      `Structured semantic coverage does not touch owning state ${stateRef}`,
      canonicalJsonStringify(reference),
    ));
  }
  return traceabilityRequirements(productSpec, semanticKind, semanticRef);
}

function compileInvariantBindings(
  productSpec: ProductSpecV2,
  proposal: ProductRuntimeBehaviorProposalV1,
  diagnostics: ProductRuntimeBehaviorDiagnosticV1[],
): readonly ProductRuntimeInvariantBindingV1[] {
  const inventory = productSpec.states.flatMap((state) =>
    state.invariants.map((text, invariantOrdinal) => ({ state, text, invariantOrdinal })));
  const expectedKeys = new Set(inventory.map((item) =>
    `${item.state.id}\0${item.invariantOrdinal}`));
  const observedKeys = proposal.invariantBindings.map((binding) =>
    `${binding.stateRef}\0${binding.invariantOrdinal}`);
  if (new Set(observedKeys).size !== observedKeys.length) {
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INVARIANT_COVERAGE_INVALID",
      "/proposal/invariantBindings",
      "Invariant proposal keys must be unique",
    ));
  }
  for (const key of expectedKeys) {
    if (observedKeys.includes(key)) continue;
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INVARIANT_COVERAGE_INVALID",
      "/proposal/invariantBindings",
      `Missing exact ProductSpec invariant binding ${key.replace("\0", ":")}`,
      key.replace("\0", ":"),
    ));
  }
  observedKeys.forEach((key, index) => {
    if (expectedKeys.has(key)) return;
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INVARIANT_COVERAGE_INVALID",
      `/proposal/invariantBindings/${index}`,
      `Invariant proposal references no exact ProductSpec occurrence ${key.replace("\0", ":")}`,
      key.replace("\0", ":"),
    ));
  });

  return inventory.flatMap((item) => {
    const proposalBinding = proposal.invariantBindings.find((binding) =>
      binding.stateRef === item.state.id
      && binding.invariantOrdinal === item.invariantOrdinal);
    if (!proposalBinding) return [];
    const stateRequirementRefs = traceabilityRequirements(
      productSpec,
      "state",
      item.state.id,
    ).slice().sort(compareUtf16);
    const proposedRequirementRefs = [...proposalBinding.requirementRefs].sort(compareUtf16);
    if (
      canonicalJsonStringify(stateRequirementRefs)
        !== canonicalJsonStringify(proposedRequirementRefs)
    ) {
      diagnostics.push(diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_REQUIREMENT_TRACEABILITY_INVALID",
        `/proposal/invariantBindings/${item.invariantOrdinal}/requirementRefs`,
        `Invariant binding must carry the exact requirement set of state ${item.state.id}`,
        item.state.id,
      ));
    }
    const invariantTextHash = hashCanonicalJson({
      schema: "setfarm.product-runtime-invariant-text.v1",
      text: item.text,
    });
    const invariantRef = deriveProductRuntimeInvariantRefV1({
      stateRef: item.state.id,
      invariantOrdinal: item.invariantOrdinal,
      invariantTextHash,
    });
    let disposition: ProductRuntimeInvariantBindingV1["disposition"];
    if (proposalBinding.disposition.kind === "runtime_assertions") {
      disposition = {
        kind: "runtime_assertions",
        assertions: [...compileRuntimeAssertions(
          productSpec,
          item.state.id,
          invariantRef,
          proposalBinding.disposition.assertions,
          `/proposal/invariantBindings/${item.invariantOrdinal}/disposition/assertions`,
          diagnostics,
        )],
      };
    } else if (proposalBinding.disposition.kind === "structured_semantic_coverage") {
      if (!uniqueCanonicalValues(proposalBinding.disposition.coverageRefs)) {
        diagnostics.push(diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_SEMANTIC_COVERAGE_INVALID",
          `/proposal/invariantBindings/${item.invariantOrdinal}/disposition/coverageRefs`,
          "Structured semantic coverage refs must be unique",
          invariantRef,
        ));
      }
      const coverageRefs = [...proposalBinding.disposition.coverageRefs].sort((left, right) =>
        compareUtf16(canonicalJsonStringify(left), canonicalJsonStringify(right)));
      coverageRefs.forEach((reference, referenceIndex) => {
        const semanticRequirements = semanticCoverageRequirements(
          productSpec,
          item.state.id,
          reference,
          `/proposal/invariantBindings/${item.invariantOrdinal}/disposition/coverageRefs/${referenceIndex}`,
          diagnostics,
        );
        proposalBinding.requirementRefs.forEach((requirementRef) => {
          if (semanticRequirements.includes(requirementRef)) return;
          diagnostics.push(diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_REQUIREMENT_TRACEABILITY_INVALID",
            `/proposal/invariantBindings/${item.invariantOrdinal}/disposition/coverageRefs/${referenceIndex}`,
            `Structured semantic ref does not carry invariant requirement ${requirementRef}`,
            requirementRef,
          ));
        });
      });
      disposition = { kind: "structured_semantic_coverage", coverageRefs };
    } else {
      const requirementById = new Map(productSpec.requirements.map((requirement) =>
        [requirement.id, requirement] as const));
      proposalBinding.requirementRefs.forEach((requirementRef, requirementIndex) => {
        const requirement = requirementById.get(requirementRef);
        if (!requirement || requirement.classification === "functional") {
          diagnostics.push(diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_NON_RUNTIME_DISPOSITION_INVALID",
            `/proposal/invariantBindings/${item.invariantOrdinal}/requirementRefs/${requirementIndex}`,
            "Functional or absent requirements cannot use non-runtime disposition",
            requirementRef,
          ));
        }
      });
      const evidenceById = new Map(productSpec.evidencePredicates.map((evidence) =>
        [evidence.id, evidence] as const));
      proposalBinding.disposition.evidenceRefs.forEach((evidenceRef, evidenceIndex) => {
        const evidence = evidenceById.get(evidenceRef);
        if (!evidence?.required) {
          diagnostics.push(diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_NON_RUNTIME_DISPOSITION_INVALID",
            `/proposal/invariantBindings/${item.invariantOrdinal}/disposition/evidenceRefs/${evidenceIndex}`,
            "Non-runtime disposition requires an exact required evidence predicate",
            evidenceRef,
          ));
          return;
        }
        const evidenceRequirements = traceabilityRequirements(
          productSpec,
          "evidence",
          evidenceRef,
        );
        proposalBinding.requirementRefs.forEach((requirementRef) => {
          if (evidenceRequirements.includes(requirementRef)) return;
          diagnostics.push(diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_REQUIREMENT_TRACEABILITY_INVALID",
            `/proposal/invariantBindings/${item.invariantOrdinal}/disposition/evidenceRefs/${evidenceIndex}`,
            `Evidence ${evidenceRef} does not carry invariant requirement ${requirementRef}`,
            requirementRef,
          ));
        });
      });
      disposition = {
        kind: "non_runtime_requirement",
        evidenceRefs: [...proposalBinding.disposition.evidenceRefs].sort(compareUtf16),
      };
    }
    return [{
      invariantRef,
      stateRef: item.state.id,
      invariantOrdinal: item.invariantOrdinal,
      invariantTextHash,
      requirementRefs: [...proposalBinding.requirementRefs].sort(compareUtf16),
      disposition,
    }];
  }).sort((left, right) => compareUtf16(left.invariantRef, right.invariantRef));
}

function compatibleValueTypes(
  inputType: string,
  entityFieldType: string,
): boolean {
  return inputType === entityFieldType;
}

function valueMatchesEntityField(
  field: ProductSpecV2["entities"][number]["fields"][number],
  value: unknown,
): boolean {
  if (!invocationValueMatchesTypeV1(field.valueType, value)) return false;
  return field.valueType !== "enum"
    || Boolean(
      field.enumValues
      && typeof value === "string"
      && field.enumValues.includes(value),
    );
}

function valueMatchesActionInputField(
  productSpec: ProductSpecV2,
  field: ProductSpecV2["actions"][number]["input"]["fields"][number],
  value: unknown,
): boolean {
  if (!invocationValueMatchesTypeV1(field.valueType, value)) return false;
  if (field.valueType !== "enum") return true;
  const entityField = productSpec.entities.flatMap((entity) => entity.fields)
    .find((candidate) => candidate.id === field.entityFieldRef);
  return Boolean(
    entityField
    && valueMatchesEntityField(entityField, value),
  );
}

function compileEntityFieldBindings(
  productSpec: ProductSpecV2,
  proposal: ProductRuntimeBehaviorProposalV1,
  diagnostics: ProductRuntimeBehaviorDiagnosticV1[],
): readonly ProductRuntimeEntityFieldBindingV1[] {
  const inventory = productSpec.actions.flatMap((action) =>
    action.stateDeltas.flatMap((delta, deltaOrdinal) =>
      delta.valueFrom.kind === "entity_field"
        ? [{ action, delta, deltaOrdinal }]
        : []));
  const expectedKeys = new Set(inventory.map((item) =>
    `${item.action.id}\0${item.deltaOrdinal}`));
  const observedKeys = proposal.entityFieldBindings.map((binding) =>
    `${binding.actionRef}\0${binding.deltaOrdinal}`);
  if (new Set(observedKeys).size !== observedKeys.length) {
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_FIELD_COVERAGE_INVALID",
      "/proposal/entityFieldBindings",
      "Entity-field proposal keys must be unique",
    ));
  }
  for (const key of expectedKeys) {
    if (observedKeys.includes(key)) continue;
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_FIELD_COVERAGE_INVALID",
      "/proposal/entityFieldBindings",
      `Missing exact entity-field occurrence ${key.replace("\0", ":")}`,
      key.replace("\0", ":"),
    ));
  }
  observedKeys.forEach((key, index) => {
    if (expectedKeys.has(key)) return;
    diagnostics.push(diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_FIELD_COVERAGE_INVALID",
      `/proposal/entityFieldBindings/${index}`,
      `Entity-field proposal references no exact occurrence ${key.replace("\0", ":")}`,
      key.replace("\0", ":"),
    ));
  });

  const stateById = new Map(productSpec.states.map((state) => [state.id, state] as const));
  const entityById = new Map(productSpec.entities.map((entity) => [entity.id, entity] as const));
  return inventory.flatMap((item) => {
    const proposalBinding = proposal.entityFieldBindings.find((binding) =>
      binding.actionRef === item.action.id
      && binding.deltaOrdinal === item.deltaOrdinal);
    if (!proposalBinding || item.delta.valueFrom.kind !== "entity_field") return [];
    const valueSource = item.delta.valueFrom;
    const entity = entityById.get(valueSource.entityRef);
    const field = entity?.fields.find((candidate) =>
      candidate.id === valueSource.fieldRef);
    const snapshotState = stateById.get(proposalBinding.snapshot.stateRef);
    const collection = snapshotState
      ? resolvePointer(snapshotState.initialValue, proposalBinding.snapshot.collectionPath)
      : { exists: false as const };
    const basePath = `/proposal/entityFieldBindings/${proposal.entityFieldBindings.indexOf(proposalBinding)}/snapshot`;
    if (!snapshotState) {
      diagnostics.push(diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
        `${basePath}/stateRef`,
        `Entity snapshot references absent state ${proposalBinding.snapshot.stateRef}`,
        proposalBinding.snapshot.stateRef,
      ));
    }
    if (proposalBinding.snapshot.selection.kind === "singleton") {
      if (
        !collection.exists
        || collection.value === null
        || typeof collection.value !== "object"
        || Array.isArray(collection.value)
      ) {
        diagnostics.push(diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
          `${basePath}/collectionPath`,
          "Singleton entity snapshot must resolve to one exact initial plain object",
          item.action.id,
        ));
      } else if (entity && field) {
        const record = collection.value as Record<string, unknown>;
        if (
          !Object.prototype.hasOwnProperty.call(record, field.name)
          || !valueMatchesEntityField(field, record[field.name])
        ) {
          diagnostics.push(diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
            `${basePath}/collectionPath`,
            `Initial singleton snapshot must contain typed field ${field.name}`,
            field.id,
          ));
        }
      }
    } else {
      const selection = proposalBinding.snapshot.selection;
      if (!collection.exists || !Array.isArray(collection.value)) {
        diagnostics.push(diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
          `${basePath}/collectionPath`,
          "match_input entity snapshot must resolve to an initial array",
          item.action.id,
        ));
      } else if (collection.value.length > MAX_COLLECTION_ITEMS_PER_ASSERTION_V1) {
        diagnostics.push(diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
          `${basePath}/collectionPath`,
          `Initial entity snapshot exceeds ${MAX_COLLECTION_ITEMS_PER_ASSERTION_V1} items`,
          item.action.id,
        ));
      }
      const matchField = entity?.fields.find((candidate) =>
        candidate.id === selection.matchFieldRef);
      if (!matchField) {
        diagnostics.push(diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
          `${basePath}/selection/matchFieldRef`,
          "Snapshot match field must belong to the entity value-source owner",
          selection.matchFieldRef,
        ));
      }
      const inputField = item.action.input.fields.find((candidate) =>
        candidate.name === selection.inputField);
      if (
        !inputField
        || !inputField.required
        || !matchField
        || !compatibleValueTypes(inputField.valueType, matchField.valueType)
      ) {
        diagnostics.push(diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
          `${basePath}/selection/inputField`,
          "Snapshot selector requires one required action input with the match-field type",
          selection.inputField,
        ));
      }
      if (collection.exists && Array.isArray(collection.value) && entity && field && matchField) {
        const matchValueHashes: string[] = [];
        collection.value.forEach((candidate, candidateIndex) => {
          if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
            diagnostics.push(diagnostic(
              "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
              `${basePath}/collectionPath/${candidateIndex}`,
              "Initial entity snapshot members must be plain objects",
              item.action.id,
            ));
            return;
          }
          const record = candidate as Record<string, unknown>;
          if (
            !Object.prototype.hasOwnProperty.call(record, matchField.name)
            || !valueMatchesEntityField(matchField, record[matchField.name])
          ) {
            diagnostics.push(diagnostic(
              "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
              `${basePath}/collectionPath/${candidateIndex}`,
              `Initial entity snapshot member lacks typed match field ${matchField.name}`,
              matchField.id,
            ));
          } else {
            matchValueHashes.push(hashCanonicalJson(record[matchField.name]));
          }
          if (
            !Object.prototype.hasOwnProperty.call(record, field.name)
            || !valueMatchesEntityField(field, record[field.name])
          ) {
            diagnostics.push(diagnostic(
              "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
              `${basePath}/collectionPath/${candidateIndex}`,
              `Initial entity snapshot member lacks typed projected field ${field.name}`,
              field.id,
            ));
          }
        });
        if (new Set(matchValueHashes).size !== matchValueHashes.length) {
          diagnostics.push(diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
            `${basePath}/collectionPath`,
            "Initial entity snapshot match-field values must be canonically unique",
            matchField.id,
          ));
        }
      }
    }
    if (!entity || !field) {
      diagnostics.push(diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID",
        basePath,
        "Entity-field source no longer resolves to one exact entity field",
        item.action.id,
      ));
    }
    const valueSourceHash = hashCanonicalJson({
      schema: "setfarm.product-runtime-entity-value-source.v1",
      valueSource: item.delta.valueFrom,
    });
    const occurrenceRef = deriveProductRuntimeEntityFieldOccurrenceRefV1({
      actionRef: item.action.id,
      deltaOrdinal: item.deltaOrdinal,
      valueSourceHash,
    });
    return [{
      occurrenceRef,
      actionRef: item.action.id,
      deltaOrdinal: item.deltaOrdinal,
      entityRef: item.delta.valueFrom.entityRef,
      fieldRef: item.delta.valueFrom.fieldRef,
      valueSourceHash,
      snapshot: proposalBinding.snapshot,
      snapshotBindingHash: hashProductRuntimeEntitySnapshotBindingV1({
        occurrenceRef,
        snapshot: proposalBinding.snapshot,
      }),
    }];
  }).sort((left, right) => compareUtf16(left.occurrenceRef, right.occurrenceRef));
}

function compileInternal(
  input: unknown,
  maxBytes: number,
): ProductRuntimeBehaviorCompilationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, maxBytes);
  } catch (error) {
    return rejected([diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
      "/",
      `Behavior compiler input failed bounded canonical preflight: ${errorMessage(error)}`,
    )]);
  }
  const outer = CompilerInputV1Schema.safeParse(snapshot);
  if (!outer.success) {
    return rejected(zodDiagnostics(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
      outer.error,
    ));
  }
  const productSpecResult = ProductSpecV2Schema.safeParse(outer.data.productSpec);
  if (!productSpecResult.success) {
    return rejected(zodDiagnostics(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_PRODUCT_SPEC_INVALID",
      productSpecResult.error,
      "/productSpec",
    ));
  }
  const proposalResult = ProductRuntimeBehaviorProposalV1Schema.safeParse(
    outer.data.proposal,
  );
  if (!proposalResult.success) {
    return rejected(zodDiagnostics(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_PROPOSAL_INVALID",
      proposalResult.error,
      "/proposal",
    ));
  }
  const productSpec = productSpecResult.data;
  const proposal = canonicalProposal(proposalResult.data);
  const productSpecHash = hashCanonicalJson(productSpec);
  if (proposal.productSpecHash !== productSpecHash) {
    return rejected([diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_PROPOSAL_AUTHORITY_MISMATCH",
      "/proposal/productSpecHash",
      "Behavior proposal does not bind the exact ProductSpecV2 payload",
      proposal.productSpecHash,
    )]);
  }
  const diagnostics: ProductRuntimeBehaviorDiagnosticV1[] = [];
  const invariantBindings = compileInvariantBindings(
    productSpec,
    proposal,
    diagnostics,
  );
  const entityFieldBindings = compileEntityFieldBindings(
    productSpec,
    proposal,
    diagnostics,
  );
  if (diagnostics.length > 0) return rejected(diagnostics);

  const runtimeAssertionCount = invariantBindings.reduce(
    (total, binding) => total + (
      binding.disposition.kind === "runtime_assertions"
        ? binding.disposition.assertions.length
        : 0
    ),
    0,
  );
  const structuredSemanticCoverageCount = invariantBindings.reduce(
    (total, binding) => total + (
      binding.disposition.kind === "structured_semantic_coverage"
        ? binding.disposition.coverageRefs.length
        : 0
    ),
    0,
  );
  const nonRuntimeRequirementCount = invariantBindings.filter((binding) =>
    binding.disposition.kind === "non_runtime_requirement").length;
  const withoutHash = {
    schema: PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_SCHEMA_V1,
    contractVersion: PRODUCT_RUNTIME_BEHAVIOR_CONTRACT_VERSION_V1,
    readiness: {
      status: "shadow" as const,
      productionConsumption: "forbidden" as const,
      blockerCodes: [...PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1] as [
        typeof PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[0],
        typeof PRODUCT_RUNTIME_BEHAVIOR_BLOCKER_CODES_V1[1],
      ],
    },
    authority: {
      productSpecSchema: "setfarm.product-spec.v2" as const,
      productSpecHash,
      sourceTaskHash: productSpec.traceability.sourceTaskHash,
      proposalSchema: PRODUCT_RUNTIME_BEHAVIOR_PROPOSAL_SCHEMA_V1,
      proposalHash: hashProductRuntimeBehaviorProposalV1(proposal),
      evaluatorContractHash: PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
    },
    invariantBindings,
    entityFieldBindings,
    coverage: {
      proseInvariantCount: productSpec.states.reduce(
        (total, state) => total + state.invariants.length,
        0,
      ),
      invariantBindingCount: invariantBindings.length,
      runtimeAssertionCount,
      structuredSemanticCoverageCount,
      nonRuntimeRequirementCount,
      entityFieldOccurrenceCount: productSpec.actions.reduce(
        (total, action) => total + action.stateDeltas.filter((delta) =>
          delta.valueFrom.kind === "entity_field").length,
        0,
      ),
      entityFieldBindingCount: entityFieldBindings.length,
      disposition:
        "every_opaque_product_behavior_has_one_typed_execution_or_evidence_disposition" as const,
    },
  };
  let contract: ProductRuntimeBehaviorContractV1;
  try {
    contract = ProductRuntimeBehaviorContractV1Schema.parse({
      ...withoutHash,
      contractHash: hashProductRuntimeBehaviorContractV1(
        withoutHash as ProductRuntimeBehaviorContractHashPayloadV1,
      ),
    });
  } catch (error) {
    return rejected([diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_OUTPUT_LIMIT_EXCEEDED",
      "/",
      `Compiled behavior contract failed closure: ${errorMessage(error)}`,
    )]);
  }
  let bytes: Buffer;
  try {
    bytes = canonicalJsonBytesBounded(contract, {
      maxBytes: CONTRACT_OUTPUT_MAX_CANONICAL_BYTES_V1,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    return rejected([diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_OUTPUT_LIMIT_EXCEEDED",
      "/",
      `Compiled behavior contract exceeds publication bounds: ${errorMessage(error)}`,
    )]);
  }
  const frozen = recursivelyFreezeProductRuntimeBehaviorV1(contract);
  return recursivelyFreezeProductRuntimeBehaviorV1({
    status: "shadow_compiled" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    contract: frozen,
    contractHash: frozen.contractHash,
    canonicalBytes: bytes.toString("utf8"),
  });
}

export function compileProductRuntimeBehaviorContractV1(
  input: unknown,
): ProductRuntimeBehaviorCompilationResultV1 {
  return compileInternal(input, COMPILER_INPUT_MAX_CANONICAL_BYTES_V1);
}

export type ProductRuntimeBehaviorVerificationErrorCodeV1 =
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_AUTHORITY_MISMATCH"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_CANDIDATE_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_INPUT_INVALID"
  | "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_REPRODUCTION_REJECTED";

export class ProductRuntimeBehaviorVerificationErrorV1 extends Error {
  readonly code: ProductRuntimeBehaviorVerificationErrorCodeV1;

  constructor(
    code: ProductRuntimeBehaviorVerificationErrorCodeV1,
    message: string,
  ) {
    super(message.slice(0, 1_500));
    this.name = "ProductRuntimeBehaviorVerificationErrorV1";
    this.code = code;
  }
}

function verifySnapshot(
  input: unknown,
): Readonly<{
  productSpec: unknown;
  proposal: unknown;
  candidate: unknown;
}> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, VERIFIER_INPUT_MAX_CANONICAL_BYTES_V1);
  } catch (error) {
    throw new ProductRuntimeBehaviorVerificationErrorV1(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const parsed = VerifierInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    throw new ProductRuntimeBehaviorVerificationErrorV1(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_INPUT_INVALID",
      parsed.error.issues[0]?.message ?? "Behavior verifier input is invalid",
    );
  }
  return parsed.data;
}

export function verifyProductRuntimeBehaviorContractV1(
  input: unknown,
): Readonly<ProductRuntimeBehaviorContractV1> {
  const parsed = verifySnapshot(input);
  const candidate = ProductRuntimeBehaviorContractV1Schema.safeParse(parsed.candidate);
  if (!candidate.success) {
    throw new ProductRuntimeBehaviorVerificationErrorV1(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Behavior candidate is invalid",
    );
  }
  const reproduced = compileInternal({
    productSpec: parsed.productSpec,
    proposal: parsed.proposal,
  }, COMPILER_INPUT_MAX_CANONICAL_BYTES_V1);
  if (reproduced.status !== "shadow_compiled") {
    throw new ProductRuntimeBehaviorVerificationErrorV1(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Behavior authority reproduction failed",
    );
  }
  if (canonicalJsonStringify(candidate.data) !== reproduced.canonicalBytes) {
    throw new ProductRuntimeBehaviorVerificationErrorV1(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_AUTHORITY_MISMATCH",
      "Behavior candidate differs from fresh ProductSpec and proposal authority",
    );
  }
  return reproduced.contract;
}

export type ProductRuntimeBehaviorEvaluationResultV1 = Readonly<
  | {
      status: "passed" | "failed";
      contractHash: string;
      checkpoint: "initial" | "after_action" | "after_rehydration";
      actionRef: string | null;
      assertionCount: number;
      failedAssertionCount: number;
      results: readonly Readonly<{
        invariantRef: string;
        assertionRef: string;
        stateRef: string;
        verdict: "pass" | "fail";
        observedHash: string;
        reason: string;
      }>[];
    }
  | {
      status: "rejected";
      diagnostics: readonly ProductRuntimeBehaviorDiagnosticV1[];
    }
>;

export function evaluateProductRuntimeBehaviorContractV1(
  input: unknown,
): ProductRuntimeBehaviorEvaluationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, EVALUATOR_INPUT_MAX_CANONICAL_BYTES_V1);
  } catch (error) {
    return rejected([diagnostic(
      "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
      "/",
      `Behavior evaluator input failed bounded preflight: ${errorMessage(error)}`,
    )]) as ProductRuntimeBehaviorEvaluationResultV1;
  }
  const parsed = EvaluationInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      diagnostics: zodDiagnostics(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
        parsed.error,
      ),
    });
  }
  let contract: Readonly<ProductRuntimeBehaviorContractV1>;
  try {
    contract = verifyProductRuntimeBehaviorContractV1({
      productSpec: parsed.data.productSpec,
      proposal: parsed.data.proposal,
      candidate: parsed.data.candidate,
    });
  } catch (error) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      diagnostics: [diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_PROPOSAL_AUTHORITY_MISMATCH",
        "/candidate",
        error instanceof Error ? error.message : "Behavior authority verification failed",
      )],
    });
  }
  const productSpec = ProductSpecV2Schema.parse(parsed.data.productSpec);
  if (parsed.data.checkpoint === "after_action") {
    if (
      !parsed.data.actionRef
      || !productSpec.actions.some((action) => action.id === parsed.data.actionRef)
    ) {
      return recursivelyFreezeProductRuntimeBehaviorV1({
        status: "rejected" as const,
        diagnostics: [diagnostic(
          "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
          "/actionRef",
          "after_action evaluation requires one exact ProductSpec action ref",
        )],
      });
    }
  } else if (parsed.data.actionRef !== undefined) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      diagnostics: [diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
        "/actionRef",
        `${parsed.data.checkpoint} evaluation cannot carry an action ref`,
      )],
    });
  }
  const expectedStateRefs = productSpec.states.map((state) => state.id).sort(compareUtf16);
  const observedStateRefs = Object.keys(parsed.data.stateSnapshot).sort(compareUtf16);
  if (canonicalJsonStringify(expectedStateRefs) !== canonicalJsonStringify(observedStateRefs)) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      diagnostics: [diagnostic(
        "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
        "/stateSnapshot",
        "Evaluator state snapshot must contain every-and-only ProductSpec state ref",
      )],
    });
  }
  const results: Array<{
    invariantRef: string;
    assertionRef: string;
    stateRef: string;
    verdict: "pass" | "fail";
    observedHash: string;
    reason: string;
  }> = [];
  let visits = 0;
  for (const binding of contract.invariantBindings) {
    if (binding.disposition.kind !== "runtime_assertions") continue;
    for (const assertion of binding.disposition.assertions) {
      const evaluated = evaluateAssertion(assertion, parsed.data.stateSnapshot);
      if (evaluated.reason === "collection_item_budget_exceeded") {
        return recursivelyFreezeProductRuntimeBehaviorV1({
          status: "rejected" as const,
          diagnostics: [diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
            "/stateSnapshot",
            `Behavior assertion collection exceeded ${MAX_COLLECTION_ITEMS_PER_ASSERTION_V1} items`,
            assertion.assertionRef,
          )],
        });
      }
      visits += evaluated.visits;
      if (visits > MAX_ASSERTION_VISITS_V1) {
        return recursivelyFreezeProductRuntimeBehaviorV1({
          status: "rejected" as const,
          diagnostics: [diagnostic(
            "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID",
            "/stateSnapshot",
            `Behavior evaluation exceeded ${MAX_ASSERTION_VISITS_V1} subject visits`,
          )],
        });
      }
      results.push({
        invariantRef: binding.invariantRef,
        assertionRef: assertion.assertionRef,
        stateRef: binding.stateRef,
        verdict: evaluated.passed ? "pass" : "fail",
        observedHash: evaluated.observedHash,
        reason: evaluated.reason,
      });
    }
  }
  const failedAssertionCount = results.filter((result) => result.verdict === "fail").length;
  return recursivelyFreezeProductRuntimeBehaviorV1({
    status: failedAssertionCount === 0 ? "passed" as const : "failed" as const,
    contractHash: contract.contractHash,
    checkpoint: parsed.data.checkpoint,
    actionRef: parsed.data.actionRef ?? null,
    assertionCount: results.length,
    failedAssertionCount,
    results,
  });
}

export type ProductRuntimeEntityFieldResolutionResultV1 = Readonly<
  | {
      status: "resolved";
      occurrenceRef: string;
      snapshotBindingHash: string;
      value: unknown;
      valueHash: string;
    }
  | {
      status: "action_failure" | "rejected";
      code: string;
      message: string;
    }
>;

export function resolveProductRuntimeEntityFieldValueV1(
  input: unknown,
): ProductRuntimeEntityFieldResolutionResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, EVALUATOR_INPUT_MAX_CANONICAL_BYTES_V1);
  } catch (error) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_INPUT_INVALID",
      message: errorMessage(error),
    });
  }
  const parsed = EntityResolutionInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_INPUT_INVALID",
      message: parsed.error.issues[0]?.message ?? "Entity snapshot input is invalid",
    });
  }
  let contract: Readonly<ProductRuntimeBehaviorContractV1>;
  try {
    contract = verifyProductRuntimeBehaviorContractV1({
      productSpec: parsed.data.productSpec,
      proposal: parsed.data.proposal,
      candidate: parsed.data.candidate,
    });
  } catch (error) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_AUTHORITY_INVALID",
      message: error instanceof Error ? error.message : "Entity snapshot authority failed",
    });
  }
  const productSpec = ProductSpecV2Schema.parse(parsed.data.productSpec);
  const action = productSpec.actions.find((candidate) =>
    candidate.id === parsed.data.actionRef);
  const delta = action?.stateDeltas[parsed.data.deltaOrdinal];
  if (!action || !delta || delta.valueFrom.kind !== "entity_field") {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_OCCURRENCE_INVALID",
      message: "Requested action/delta is not one exact entity-field occurrence",
    });
  }
  const expectedInputFields = action.input.fields.map((field) => field.name).sort(compareUtf16);
  const observedInputFields = Object.keys(parsed.data.actionInput).sort(compareUtf16);
  if (canonicalJsonStringify(expectedInputFields) !== canonicalJsonStringify(observedInputFields)) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_ACTION_INPUT_INVALID",
      message: "Entity snapshot action input must contain every-and-only declared field",
    });
  }
  for (const inputField of action.input.fields) {
    if (valueMatchesActionInputField(
      productSpec,
      inputField,
      parsed.data.actionInput[inputField.name],
    )) continue;
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_ACTION_INPUT_INVALID",
      message: `Entity snapshot action input ${inputField.name} violates ${inputField.valueType}`,
    });
  }
  const expectedStateRefs = productSpec.states.map((state) => state.id).sort(compareUtf16);
  const observedStateRefs = Object.keys(parsed.data.stateSnapshot).sort(compareUtf16);
  if (canonicalJsonStringify(expectedStateRefs) !== canonicalJsonStringify(observedStateRefs)) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_STATE_INPUT_INVALID",
      message: "Entity snapshot must contain every-and-only ProductSpec state ref",
    });
  }
  const valueSourceHash = hashCanonicalJson({
    schema: "setfarm.product-runtime-entity-value-source.v1",
    valueSource: delta.valueFrom,
  });
  const occurrenceRef = deriveProductRuntimeEntityFieldOccurrenceRefV1({
    actionRef: action.id,
    deltaOrdinal: parsed.data.deltaOrdinal,
    valueSourceHash,
  });
  const binding = contract.entityFieldBindings.find((candidate) =>
    candidate.occurrenceRef === occurrenceRef);
  if (!binding) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "rejected" as const,
      code: "ENTITY_SNAPSHOT_BINDING_MISSING",
      message: "Verified contract contains no exact entity-field binding",
    });
  }
  const stateValue = parsed.data.stateSnapshot[binding.snapshot.stateRef];
  const collection = resolvePointer(stateValue, binding.snapshot.collectionPath);
  let entityValue: unknown;
  if (binding.snapshot.selection.kind === "singleton") {
    if (
      !collection.exists
      || collection.value === null
      || typeof collection.value !== "object"
      || Array.isArray(collection.value)
    ) {
      return recursivelyFreezeProductRuntimeBehaviorV1({
        status: "action_failure" as const,
        code: "ENTITY_SNAPSHOT_SINGLETON_MISSING",
        message: "Entity singleton snapshot did not resolve to one object",
      });
    }
    entityValue = collection.value;
  } else {
    const selection = binding.snapshot.selection;
    if (!collection.exists || !Array.isArray(collection.value)) {
      return recursivelyFreezeProductRuntimeBehaviorV1({
        status: "action_failure" as const,
        code: "ENTITY_SNAPSHOT_COLLECTION_MISSING",
        message: "Entity match snapshot did not resolve to an array",
      });
    }
    if (collection.value.length > MAX_COLLECTION_ITEMS_PER_ASSERTION_V1) {
      return recursivelyFreezeProductRuntimeBehaviorV1({
        status: "action_failure" as const,
        code: "ENTITY_SNAPSHOT_COLLECTION_LIMIT_EXCEEDED",
        message: "Entity match snapshot exceeded the bounded item count",
      });
    }
    const entity = productSpec.entities.find((candidate) => candidate.id === binding.entityRef)!;
    const matchField = entity.fields.find((candidate) =>
      candidate.id === selection.matchFieldRef)!;
    const selectorValue = parsed.data.actionInput[selection.inputField];
    const matches: Record<string, unknown>[] = [];
    for (const [candidateIndex, candidate] of collection.value.entries()) {
      if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
        return recursivelyFreezeProductRuntimeBehaviorV1({
          status: "action_failure" as const,
          code: "ENTITY_SNAPSHOT_MEMBER_INVALID",
          message: `Entity snapshot member ${candidateIndex} is not one exact object`,
        });
      }
      const record = candidate as Record<string, unknown>;
      if (
        !Object.prototype.hasOwnProperty.call(record, matchField.name)
        || !valueMatchesEntityField(matchField, record[matchField.name])
      ) {
        return recursivelyFreezeProductRuntimeBehaviorV1({
          status: "action_failure" as const,
          code: "ENTITY_SNAPSHOT_MATCH_FIELD_INVALID",
          message: `Entity snapshot member ${candidateIndex} violates match field ${matchField.name}`,
        });
      }
      const projectedField = entity.fields.find((candidateField) =>
        candidateField.id === binding.fieldRef)!;
      if (
        !Object.prototype.hasOwnProperty.call(record, projectedField.name)
        || !valueMatchesEntityField(projectedField, record[projectedField.name])
      ) {
        return recursivelyFreezeProductRuntimeBehaviorV1({
          status: "action_failure" as const,
          code: "ENTITY_SNAPSHOT_FIELD_TYPE_INVALID",
          message: `Entity snapshot member ${candidateIndex} violates projected field ${projectedField.name}`,
        });
      }
      if (canonicalEqual(record[matchField.name], selectorValue)) matches.push(record);
    }
    if (matches.length !== 1) {
      return recursivelyFreezeProductRuntimeBehaviorV1({
        status: "action_failure" as const,
        code: matches.length === 0
          ? "ENTITY_SNAPSHOT_MATCH_MISSING"
          : "ENTITY_SNAPSHOT_MATCH_AMBIGUOUS",
        message: `Entity snapshot requires exactly one match; observed ${matches.length}`,
      });
    }
    entityValue = matches[0];
  }
  const entity = productSpec.entities.find((candidate) => candidate.id === binding.entityRef)!;
  const field = entity.fields.find((candidate) => candidate.id === binding.fieldRef)!;
  if (
    entityValue === null
    || typeof entityValue !== "object"
    || Array.isArray(entityValue)
    || !Object.prototype.hasOwnProperty.call(entityValue, field.name)
  ) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "action_failure" as const,
      code: "ENTITY_SNAPSHOT_FIELD_MISSING",
      message: `Selected entity has no exact field ${field.name}`,
    });
  }
  const selectedValue = (entityValue as Record<string, unknown>)[field.name];
  if (!valueMatchesEntityField(field, selectedValue)) {
    return recursivelyFreezeProductRuntimeBehaviorV1({
      status: "action_failure" as const,
      code: "ENTITY_SNAPSHOT_FIELD_TYPE_INVALID",
      message: `Selected entity field ${field.name} violates its exact value contract`,
    });
  }
  const value = structuredClone(selectedValue);
  return recursivelyFreezeProductRuntimeBehaviorV1({
    status: "resolved" as const,
    occurrenceRef,
    snapshotBindingHash: binding.snapshotBindingHash,
    value,
    valueHash: hashCanonicalJson(value),
  });
}
