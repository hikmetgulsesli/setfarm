import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  ProductDeliverySelectionV2Schema,
  hashProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "./product-delivery-profile-catalog-v2.js";
import {
  PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
  getProductEvidenceCapabilityPolicyV2,
  productEvidenceCapabilityPolicyHashV2,
} from "./product-evidence-capability-policy-v2.js";
import { getStackTopologyCatalogContract } from "./stack-topology-catalog.js";
import { BuildCapabilityV1Schema } from "./schemas/build-topology-v1.js";
import {
  ActionIdSchema,
  EvidenceIdSchema,
  PersistenceIdSchema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "./schemas/common-v1.js";
import {
  EvidencePredicateV2Schema,
  ProductSpecV2Schema,
  type EvidencePredicateV2,
  type ProductActionV2,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import { PersistencePolicyV1Schema } from "./schemas/product-spec-v1.js";

export const PRODUCT_EVIDENCE_CAPABILITY_BINDING_SET_V2_VERSION = "2.0.0";

const BINDING_INPUT_MAX_BYTES = 4 * 1024 * 1024;
const BINDING_OUTPUT_MAX_BYTES = 4 * 1024 * 1024;
const BINDING_VERIFICATION_INPUT_MAX_BYTES = 12 * 1024 * 1024;
const MAX_DIAGNOSTICS = 200;
export const PRODUCT_EVIDENCE_CAPABILITY_V2_MAX_REASON_EDGES = 100_000;

const CapabilityKindV2Schema = BuildCapabilityV1Schema.shape.kind;
const CapabilityIdV2Schema = BuildCapabilityV1Schema.shape.id;
const InvocationKindV2Schema = z.enum([
  "rendered_control",
  "cli_command",
  "http_request",
  "route_entry",
]);

const CapabilityReasonV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("evidence_rule"),
    ruleRef: StableReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("action_invocation"),
    ruleRef: StableReferenceSchema,
    actionRef: ActionIdSchema,
    invocationKind: InvocationKindV2Schema,
  }).strict(),
  z.object({
    kind: z.literal("persistence"),
    ruleRef: StableReferenceSchema,
    persistenceRef: PersistenceIdSchema,
    persistenceKind: PersistencePolicyV1Schema.shape.kind,
  }).strict(),
]);

const SubjectActionBindingV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }).strict(),
  z.object({
    kind: z.literal("action"),
    actionRef: ActionIdSchema,
    invocationKind: InvocationKindV2Schema,
  }).strict(),
]);

const EvidenceCapabilityResolutionV2Schema = z.object({
  capabilityRef: CapabilityIdV2Schema,
  capabilityKind: CapabilityKindV2Schema,
  reasons: z.array(CapabilityReasonV2Schema).min(1).max(2_000),
}).strict().superRefine((value, context) => {
  const canonicalReasons = [...value.reasons].sort((left, right) => compareUtf16(
    canonicalJsonStringify(left),
    canonicalJsonStringify(right),
  ));
  const identities = value.reasons.map((reason) => canonicalJsonStringify(reason));
  if (!hasUniqueStrings(identities)) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Capability reasons must be unique" });
  }
  if (canonicalJsonStringify(canonicalReasons) !== canonicalJsonStringify(value.reasons)) {
    context.addIssue({ code: "custom", path: ["reasons"], message: "Capability reasons must be canonically ordered" });
  }
});

const ProductEvidenceCapabilityBindingV2WithoutHashSchema = z.object({
  schema: z.literal("setfarm.product-evidence-capability-binding.v2"),
  evidenceRef: EvidenceIdSchema,
  evidenceKind: EvidencePredicateV2Schema.shape.kind,
  subjectRef: EvidencePredicateV2Schema.shape.subjectRef,
  required: z.boolean(),
  subjectAction: SubjectActionBindingV2Schema,
  capabilities: z.array(EvidenceCapabilityResolutionV2Schema).max(20),
}).strict().superRefine((value, context) => {
  const identities = value.capabilities.map((capability) =>
    `${capability.capabilityKind}\0${capability.capabilityRef}`);
  if (!hasUniqueStrings(identities)) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Capability bindings must be unique" });
  }
  const canonical = [...value.capabilities].sort((left, right) => compareUtf16(
    `${left.capabilityKind}\0${left.capabilityRef}`,
    `${right.capabilityKind}\0${right.capabilityRef}`,
  ));
  if (canonicalJsonStringify(canonical) !== canonicalJsonStringify(value.capabilities)) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Capability bindings must be canonically ordered" });
  }
});

export type ProductEvidenceCapabilityBindingV2WithoutHash = z.infer<
  typeof ProductEvidenceCapabilityBindingV2WithoutHashSchema
>;

export function hashProductEvidenceCapabilityBindingV2(
  input: ProductEvidenceCapabilityBindingV2WithoutHash,
): string {
  const parsed = ProductEvidenceCapabilityBindingV2WithoutHashSchema.parse(input);
  return hashCanonicalJson({
    domain: "setfarm.product-evidence-capability-binding.v2",
    binding: parsed,
  });
}

export const ProductEvidenceCapabilityBindingV2Schema = z.object({
  ...ProductEvidenceCapabilityBindingV2WithoutHashSchema.shape,
  bindingHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { bindingHash, ...withoutHash } = value;
  if (!ProductEvidenceCapabilityBindingV2WithoutHashSchema.safeParse(withoutHash).success) {
    context.addIssue({ code: "custom", path: [], message: "Evidence capability binding payload is not canonical" });
    return;
  }
  if (bindingHash !== hashProductEvidenceCapabilityBindingV2(withoutHash)) {
    context.addIssue({ code: "custom", path: ["bindingHash"], message: "Evidence capability binding hash mismatch" });
  }
});

export type ProductEvidenceCapabilityBindingV2 = z.infer<
  typeof ProductEvidenceCapabilityBindingV2Schema
>;

const ProductEvidenceCapabilityBindingSetV2WithoutHashSchema = z.object({
  schema: z.literal("setfarm.product-evidence-capability-bindings.v2"),
  version: z.literal(PRODUCT_EVIDENCE_CAPABILITY_BINDING_SET_V2_VERSION),
  productSpec: z.object({
    schema: z.literal("setfarm.product-spec.v2"),
    payloadHash: Sha256Schema,
  }).strict(),
  policy: z.object({
    schema: z.literal("setfarm.product-evidence-capability-policy.v2"),
    version: z.literal(PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION),
    policyHash: Sha256Schema,
  }).strict(),
  deliverySelection: z.object({
    schema: z.literal("setfarm.product-delivery-selection.v2"),
    selectionHash: Sha256Schema,
    catalogVersion: ProductDeliverySelectionV2Schema.shape.catalogVersion,
    catalogHash: Sha256Schema,
    profileId: ProductDeliverySelectionV2Schema.shape.profileId,
    profileHash: Sha256Schema,
  }).strict(),
  stackPackBinding: z.object({
    stackPackId: ProductDeliverySelectionV2Schema.shape.stackPackBinding.shape.stackPackId,
    stackPackVersion: z.string().min(1).max(160),
    stackPackContentHash: Sha256Schema,
  }).strict(),
  bindings: z.array(ProductEvidenceCapabilityBindingV2Schema).min(1).max(4_000),
  readiness: ProductDeliverySelectionV2Schema.shape.readiness,
}).strict().superRefine((value, context) => {
  const evidenceRefs = value.bindings.map((binding) => binding.evidenceRef);
  if (!hasUniqueStrings(evidenceRefs)) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "Evidence bindings must be unique by evidence ref" });
  }
  const canonical = [...value.bindings].sort((left, right) => compareUtf16(
    left.evidenceRef,
    right.evidenceRef,
  ));
  if (canonicalJsonStringify(canonical) !== canonicalJsonStringify(value.bindings)) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "Evidence bindings must be canonically ordered" });
  }
});

export type ProductEvidenceCapabilityBindingSetV2WithoutHash = z.infer<
  typeof ProductEvidenceCapabilityBindingSetV2WithoutHashSchema
>;

export function hashProductEvidenceCapabilityBindingSetV2(
  input: ProductEvidenceCapabilityBindingSetV2WithoutHash,
): string {
  const parsed = ProductEvidenceCapabilityBindingSetV2WithoutHashSchema.parse(input);
  return hashCanonicalJson({
    domain: "setfarm.product-evidence-capability-binding-set.v2",
    bindingSet: parsed,
  });
}

export const ProductEvidenceCapabilityBindingSetV2Schema = z.object({
  ...ProductEvidenceCapabilityBindingSetV2WithoutHashSchema.shape,
  bindingSetHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { bindingSetHash, ...withoutHash } = value;
  if (!ProductEvidenceCapabilityBindingSetV2WithoutHashSchema.safeParse(withoutHash).success) {
    context.addIssue({ code: "custom", path: [], message: "Evidence capability binding-set payload is not canonical" });
    return;
  }
  if (bindingSetHash !== hashProductEvidenceCapabilityBindingSetV2(withoutHash)) {
    context.addIssue({ code: "custom", path: ["bindingSetHash"], message: "Evidence capability binding-set hash mismatch" });
  }
});

export type ProductEvidenceCapabilityBindingSetV2 = z.infer<
  typeof ProductEvidenceCapabilityBindingSetV2Schema
>;

const ProductEvidenceCapabilityBindingCompilerInputV2Schema = z.object({
  productSpec: ProductSpecV2Schema,
  deliverySelection: ProductDeliverySelectionV2Schema,
}).strict();

const ProductEvidenceCapabilityBindingVerificationInputV2Schema = z.object({
  productSpec: ProductSpecV2Schema,
  deliverySelection: ProductDeliverySelectionV2Schema,
  candidateBindingSet: ProductEvidenceCapabilityBindingSetV2Schema,
}).strict();

export type ProductEvidenceCapabilityDiagnosticV2 = Readonly<{
  code: string;
  path: string;
  message: string;
  reference?: string;
}>;

export type ProductEvidenceCapabilityBindingCompilationResultV2 =
  | Readonly<{
      status: "compiled";
      diagnostics: readonly ProductEvidenceCapabilityDiagnosticV2[];
      bindingSet: ProductEvidenceCapabilityBindingSetV2;
      bindingSetHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductEvidenceCapabilityDiagnosticV2[];
    }>;

export type ProductEvidenceCapabilityBindingVerificationResultV2 =
  | Readonly<{
      status: "verified";
      diagnostics: readonly ProductEvidenceCapabilityDiagnosticV2[];
      bindingSet: ProductEvidenceCapabilityBindingSetV2;
      bindingSetHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductEvidenceCapabilityDiagnosticV2[];
    }>;

type CapabilityReasonV2 = z.infer<typeof CapabilityReasonV2Schema>;

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly ProductEvidenceCapabilityDiagnosticV2[];

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnostic(
  code: string,
  path: string,
  message: string,
  reference?: string,
): ProductEvidenceCapabilityDiagnosticV2 {
  return Object.freeze({
    code: code.slice(0, 200),
    path: path.slice(0, 1_000),
    message: message.slice(0, 1_500),
    ...(reference === undefined ? {} : { reference: reference.slice(0, 500) }),
  });
}

function compareDiagnostics(
  left: ProductEvidenceCapabilityDiagnosticV2,
  right: ProductEvidenceCapabilityDiagnosticV2,
): number {
  return compareUtf16(
    `${left.path}\0${left.code}\0${left.reference ?? ""}\0${left.message}`,
    `${right.path}\0${right.code}\0${right.reference ?? ""}\0${right.message}`,
  );
}

function boundedDiagnostics(
  diagnostics: readonly ProductEvidenceCapabilityDiagnosticV2[],
): readonly ProductEvidenceCapabilityDiagnosticV2[] {
  const sorted = [...diagnostics].sort(compareDiagnostics);
  if (sorted.length <= MAX_DIAGNOSTICS) return Object.freeze(sorted);
  const retained = sorted.slice(0, MAX_DIAGNOSTICS - 1);
  retained.push(diagnostic(
    "PRODUCT_EVIDENCE_CAPABILITY_V2_DIAGNOSTICS_TRUNCATED",
    "/diagnostics",
    `Capability compilation produced ${sorted.length} diagnostics; retained the canonical first ${MAX_DIAGNOSTICS - 1}`,
  ));
  return Object.freeze(retained.sort(compareDiagnostics));
}

function zodPath(path: PropertyKey[]): string {
  if (path.length === 0) return "/";
  return `/${path.map((entry) => String(entry).replaceAll("~", "~0").replaceAll("/", "~1")).join("/")}`;
}

function diagnosticsFromZod(code: string, error: z.ZodError): readonly ProductEvidenceCapabilityDiagnosticV2[] {
  return boundedDiagnostics(error.issues.map((issue) => diagnostic(
    code,
    zodPath(issue.path),
    issue.message,
  )));
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unknown product evidence capability authority failure";
}

function boundedJsonSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const stack: object[] = [value as object];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        stack.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

function addCapabilityReason(
  reasonsByCapabilityKind: Map<string, Map<string, CapabilityReasonV2>>,
  capabilityKind: string,
  reason: CapabilityReasonV2,
): void {
  const reasons = reasonsByCapabilityKind.get(capabilityKind) ?? new Map<string, CapabilityReasonV2>();
  const identity = canonicalJsonStringify(reason);
  if (!reasons.has(identity)) reasons.set(identity, reason);
  reasonsByCapabilityKind.set(capabilityKind, reasons);
}

type CapabilityBindingIndexesV2 = Readonly<{
  actionById: ReadonlyMap<string, ProductActionV2>;
  actionByObservableId: ReadonlyMap<string, ProductActionV2>;
  actionOwnersByEvidenceId: ReadonlyMap<string, readonly ProductActionV2[]>;
  persistencePolicyRefsByActionId: ReadonlyMap<string, ReadonlySet<string>>;
}>;

function buildCapabilityBindingIndexesV2(productSpec: ProductSpecV2): CapabilityBindingIndexesV2 {
  const actionById = new Map<string, ProductActionV2>();
  const actionByObservableId = new Map<string, ProductActionV2>();
  const actionOwnersByEvidenceId = new Map<string, ProductActionV2[]>();
  const persistencePolicyRefsByActionId = new Map<string, Set<string>>();
  const persistenceRoundTripEvidenceIds = new Set(productSpec.evidencePredicates
    .filter((predicate) => predicate.kind === "persistence_round_trip")
    .map((predicate) => predicate.id));
  for (const action of productSpec.actions) {
    actionById.set(action.id, action);
    for (const observable of action.observableEffects) {
      actionByObservableId.set(observable.id, action);
    }
    for (const evidenceRef of action.evidenceRefs) {
      if (!persistenceRoundTripEvidenceIds.has(evidenceRef)) continue;
      const owners = actionOwnersByEvidenceId.get(evidenceRef) ?? [];
      owners.push(action);
      actionOwnersByEvidenceId.set(evidenceRef, owners);
    }
    persistencePolicyRefsByActionId.set(
      action.id,
      new Set(action.persistenceEffects.map((effect) => effect.policyRef)),
    );
  }
  return {
    actionById,
    actionByObservableId,
    actionOwnersByEvidenceId,
    persistencePolicyRefsByActionId,
  };
}

function actionForSubjectV2(
  indexes: CapabilityBindingIndexesV2,
  subjectRef: string,
): ProductActionV2 | undefined {
  return indexes.actionById.get(subjectRef) ?? indexes.actionByObservableId.get(subjectRef);
}

function exactPersistenceOwnerV2(
  indexes: CapabilityBindingIndexesV2,
  predicate: EvidencePredicateV2,
): ProductActionV2 | undefined {
  const owners = indexes.actionOwnersByEvidenceId.get(predicate.id) ?? [];
  if (owners.length !== 1) return undefined;
  const owner = owners[0]!;
  return indexes.persistencePolicyRefsByActionId.get(owner.id)?.has(predicate.subjectRef)
    ? owner
    : undefined;
}

function verifiedSelection(
  productSpec: ProductSpecV2,
  candidate: ProductDeliverySelectionV2,
): ProductDeliverySelectionV2 {
  return verifyProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId: candidate.requestedStackPackId,
    candidate,
  });
}

function compileBindings(
  productSpec: ProductSpecV2,
  selection: ProductDeliverySelectionV2,
): ProductEvidenceCapabilityBindingCompilationResultV2 {
  const diagnostics: ProductEvidenceCapabilityDiagnosticV2[] = [];
  if (![
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ].includes(selection.profileId)) {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_PROFILE_UNSUPPORTED",
      "/deliverySelection/profileId",
      "Capability Binding V2 accepts only the exact no-design Node CLI/API shadow profiles",
      selection.profileId,
    ));
  }
  if (selection.readiness.status !== "shadow" || selection.readiness.productionSelection !== "forbidden") {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_PROFILE_NOT_SHADOW",
      "/deliverySelection/readiness",
      "Capability Binding V2 is shadow-only and cannot accept an active profile",
    ));
  }

  const productSpecHash = hashCanonicalJson(productSpec);
  if (selection.productSpecHash !== productSpecHash) {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_PRODUCT_HASH_MISMATCH",
      "/deliverySelection/productSpecHash",
      "Delivery selection does not bind the exact ProductSpec V2 payload",
    ));
  }
  if (
    selection.productClass !== productSpec.product.class
    || selection.delivery.platform !== productSpec.delivery.platform
    || selection.delivery.techStack !== productSpec.delivery.techStack
    || selection.delivery.designRequired !== productSpec.delivery.designRequired
    || !(selection.delivery.allowedDatabases as readonly string[]).includes(productSpec.delivery.database)
  ) {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_DELIVERY_MISMATCH",
      "/deliverySelection/delivery",
      "Delivery selection and ProductSpec V2 delivery semantics must match exactly",
    ));
  }
  const persistenceKinds = new Set<string>(selection.delivery.allowedPersistenceKinds);
  productSpec.persistencePolicies.forEach((policy, index) => {
    if (persistenceKinds.has(policy.kind)) return;
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_PERSISTENCE_UNSUPPORTED",
      `/productSpec/persistencePolicies/${index}/kind`,
      "Selected no-design delivery profile does not authorize this persistence kind",
      policy.kind,
    ));
  });
  productSpec.evidencePredicates.forEach((predicate, index) => {
    if (predicate.capabilityRefs.length === 0) return;
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_CALLER_REF_FORBIDDEN",
      `/productSpec/evidencePredicates/${index}/capabilityRefs`,
      "ProductSpec V2 capability refs must be empty; physical capability ownership belongs to this compiler",
      predicate.id,
    ));
  });

  const policy = getProductEvidenceCapabilityPolicyV2();
  const policyHash = productEvidenceCapabilityPolicyHashV2();
  if (
    selection.evidenceCapabilities.policySchema !== policy.schema
    || selection.evidenceCapabilities.policyVersion !== policy.version
    || selection.evidenceCapabilities.policyHash !== policyHash
  ) {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_POLICY_MISMATCH",
      "/deliverySelection/evidenceCapabilities",
      "Delivery selection does not bind the current code-owned capability policy",
    ));
  }

  const topology = getStackTopologyCatalogContract(selection.stackPackBinding.stackPackId);
  if (!topology) {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_TOPOLOGY_UNAVAILABLE",
      "/deliverySelection/stackPackBinding/stackPackId",
      "No code-owned topology catalog contract exists for the selected stack pack",
      selection.stackPackBinding.stackPackId,
    ));
  } else if (
    topology.identity.id !== selection.stackPackBinding.stackPackId
    || topology.identity.version !== selection.stackPackBinding.stackPackVersion
    || topology.identity.contentHash !== selection.stackPackBinding.stackPackContentHash
  ) {
    diagnostics.push(diagnostic(
      "PRODUCT_EVIDENCE_CAPABILITY_V2_TOPOLOGY_MISMATCH",
      "/deliverySelection/stackPackBinding",
      "Delivery selection does not bind the current code-owned topology descriptor",
    ));
  }

  if (diagnostics.length > 0 || !topology) {
    return { status: "rejected", diagnostics: boundedDiagnostics(diagnostics) };
  }

  const evidenceRules = new Map(policy.evidenceRules.map((rule) => [rule.evidenceKind, rule]));
  const invocationRules = new Map(policy.invocationRules.map((rule) => [rule.invocationKind, rule]));
  const persistenceRules = new Map(policy.persistenceRules.map((rule) => [rule.persistenceKind, rule]));
  const persistenceById = new Map(productSpec.persistencePolicies.map((item) => [item.id, item]));
  const indexes = buildCapabilityBindingIndexesV2(productSpec);
  const enabledCapabilitiesByKind = new Map<string, Array<{ id: string }>>();
  topology.descriptor.capabilities.filter((capability) => capability.enabled).forEach((capability) => {
    const values = enabledCapabilitiesByKind.get(capability.kind) ?? [];
    values.push({ id: capability.id });
    enabledCapabilitiesByKind.set(capability.kind, values);
  });

  const subjectActionByEvidenceId = new Map<string, ProductActionV2>();
  const exactPersistenceByEvidenceId = new Map<
    string,
    ProductSpecV2["persistencePolicies"][number]
  >();
  let predictedReasonEdges = 0;
  for (let predicateIndex = 0; predicateIndex < productSpec.evidencePredicates.length; predicateIndex += 1) {
    const predicate = productSpec.evidencePredicates[predicateIndex]!;
    const rule = evidenceRules.get(predicate.kind)!;
    predictedReasonEdges += rule.capabilityKinds.length;

    let subjectAction = actionForSubjectV2(indexes, predicate.subjectRef);
    if (rule.persistenceResolution === "exact_subject_policy") {
      const persistence = persistenceById.get(predicate.subjectRef);
      const owners = indexes.actionOwnersByEvidenceId.get(predicate.id) ?? [];
      if (!persistence) {
        diagnostics.push(diagnostic(
          "PRODUCT_EVIDENCE_CAPABILITY_V2_PERSISTENCE_SUBJECT_UNRESOLVED",
          `/productSpec/evidencePredicates/${predicateIndex}/subjectRef`,
          "Exact persistence capability resolution requires one ProductSpec persistence policy subject",
          predicate.subjectRef,
        ));
      }
      if (owners.length !== 1) {
        diagnostics.push(diagnostic(
          "PRODUCT_EVIDENCE_CAPABILITY_V2_PERSISTENCE_OWNER_CARDINALITY",
          `/productSpec/evidencePredicates/${predicateIndex}/id`,
          "Exact persistence capability resolution requires one action owner through evidenceRefs",
          String(owners.length),
        ));
      }
      subjectAction = exactPersistenceOwnerV2(indexes, predicate);
      if (owners.length === 1 && !subjectAction) {
        diagnostics.push(diagnostic(
          "PRODUCT_EVIDENCE_CAPABILITY_V2_PERSISTENCE_EFFECT_MISSING",
          `/productSpec/evidencePredicates/${predicateIndex}/subjectRef`,
          "The exact persistence evidence owner has no effect for the subject policy",
          predicate.subjectRef,
        ));
      }
      if (persistence) {
        exactPersistenceByEvidenceId.set(predicate.id, persistence);
        predictedReasonEdges += persistenceRules.get(persistence.kind)!.capabilityKinds.length;
      }
    }

    if (rule.subjectActionInvocation === "required" && !subjectAction) {
      diagnostics.push(diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_ACTION_UNRESOLVED",
        `/productSpec/evidencePredicates/${predicateIndex}/subjectRef`,
        "Evidence policy requires an exact owning action for typed invocation capability resolution",
        predicate.subjectRef,
      ));
    }
    if (subjectAction && rule.subjectActionInvocation !== "none") {
      subjectActionByEvidenceId.set(predicate.id, subjectAction);
      predictedReasonEdges += invocationRules.get(
        subjectAction.invocationInterface.kind,
      )!.capabilityKinds.length;
    }
    if (predictedReasonEdges > PRODUCT_EVIDENCE_CAPABILITY_V2_MAX_REASON_EDGES) {
      diagnostics.push(diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_REASON_WORK_BUDGET_EXCEEDED",
        "/productSpec/evidencePredicates",
        `Capability policy expansion exceeds ${PRODUCT_EVIDENCE_CAPABILITY_V2_MAX_REASON_EDGES} reason edges before output allocation`,
        String(predictedReasonEdges),
      ));
      break;
    }
  }
  if (diagnostics.length > 0) {
    return { status: "rejected", diagnostics: boundedDiagnostics(diagnostics) };
  }

  const bindings: ProductEvidenceCapabilityBindingV2[] = [];
  productSpec.evidencePredicates.forEach((predicate, predicateIndex) => {
    const rule = evidenceRules.get(predicate.kind)!;
    const reasonsByCapabilityKind = new Map<string, Map<string, CapabilityReasonV2>>();
    rule.capabilityKinds.forEach((capabilityKind) => addCapabilityReason(
      reasonsByCapabilityKind,
      capabilityKind,
      { kind: "evidence_rule", ruleRef: rule.ruleRef },
    ));

    const subjectAction = subjectActionByEvidenceId.get(predicate.id);
    if (subjectAction && rule.subjectActionInvocation !== "none") {
      const invocationRule = invocationRules.get(subjectAction.invocationInterface.kind)!;
      invocationRule.capabilityKinds.forEach((capabilityKind) => addCapabilityReason(
        reasonsByCapabilityKind,
        capabilityKind,
        {
          kind: "action_invocation",
          ruleRef: invocationRule.ruleRef,
          actionRef: subjectAction.id,
          invocationKind: subjectAction.invocationInterface.kind,
        },
      ));
    }

    if (rule.persistenceResolution === "exact_subject_policy") {
      const persistence = exactPersistenceByEvidenceId.get(predicate.id)!;
      const persistenceRule = persistenceRules.get(persistence.kind)!;
      persistenceRule.capabilityKinds.forEach((capabilityKind) => addCapabilityReason(
        reasonsByCapabilityKind,
        capabilityKind,
        {
          kind: "persistence",
          ruleRef: persistenceRule.ruleRef,
          persistenceRef: persistence.id,
          persistenceKind: persistence.kind,
        },
      ));
    }

    const capabilities: z.infer<typeof EvidenceCapabilityResolutionV2Schema>[] = [];
    [...reasonsByCapabilityKind.entries()].sort(([left], [right]) => compareUtf16(left, right))
      .forEach(([capabilityKind, reasonsByIdentity]) => {
        const candidates = enabledCapabilitiesByKind.get(capabilityKind) ?? [];
        if (candidates.length === 0) {
          diagnostics.push(diagnostic(
            "PRODUCT_EVIDENCE_CAPABILITY_V2_CAPABILITY_UNAVAILABLE",
            `/productSpec/evidencePredicates/${predicateIndex}/capabilityRefs`,
            "Evidence semantics require a capability kind that the selected topology does not activate",
            capabilityKind,
          ));
          return;
        }
        if (candidates.length > 1) {
          diagnostics.push(diagnostic(
            "PRODUCT_EVIDENCE_CAPABILITY_V2_CAPABILITY_AMBIGUOUS",
            `/productSpec/evidencePredicates/${predicateIndex}/capabilityRefs`,
            "Evidence capability kind resolves to multiple enabled topology capabilities",
            capabilityKind,
          ));
          return;
        }
        capabilities.push({
          capabilityRef: candidates[0]!.id,
          capabilityKind: CapabilityKindV2Schema.parse(capabilityKind),
          reasons: [...reasonsByIdentity.values()].sort((left, right) => compareUtf16(
            canonicalJsonStringify(left),
            canonicalJsonStringify(right),
          )),
        });
      });

    const withoutHash = ProductEvidenceCapabilityBindingV2WithoutHashSchema.parse({
      schema: "setfarm.product-evidence-capability-binding.v2",
      evidenceRef: predicate.id,
      evidenceKind: predicate.kind,
      subjectRef: predicate.subjectRef,
      required: predicate.required,
      subjectAction: subjectAction
        ? {
            kind: "action",
            actionRef: subjectAction.id,
            invocationKind: subjectAction.invocationInterface.kind,
          }
        : { kind: "none" },
      capabilities,
    });
    bindings.push(ProductEvidenceCapabilityBindingV2Schema.parse({
      ...withoutHash,
      bindingHash: hashProductEvidenceCapabilityBindingV2(withoutHash),
    }));
  });

  if (diagnostics.length > 0) {
    return { status: "rejected", diagnostics: boundedDiagnostics(diagnostics) };
  }

  bindings.sort((left, right) => compareUtf16(left.evidenceRef, right.evidenceRef));
  const withoutHash = ProductEvidenceCapabilityBindingSetV2WithoutHashSchema.parse({
    schema: "setfarm.product-evidence-capability-bindings.v2",
    version: PRODUCT_EVIDENCE_CAPABILITY_BINDING_SET_V2_VERSION,
    productSpec: {
      schema: productSpec.schema,
      payloadHash: productSpecHash,
    },
    policy: {
      schema: policy.schema,
      version: policy.version,
      policyHash,
    },
    deliverySelection: {
      schema: selection.schema,
      selectionHash: hashProductDeliverySelectionV2(selection),
      catalogVersion: selection.catalogVersion,
      catalogHash: selection.catalogHash,
      profileId: selection.profileId,
      profileHash: selection.profileHash,
    },
    stackPackBinding: selection.stackPackBinding,
    bindings,
    readiness: selection.readiness,
  });
  const parsedBindingSet = ProductEvidenceCapabilityBindingSetV2Schema.parse({
    ...withoutHash,
    bindingSetHash: hashProductEvidenceCapabilityBindingSetV2(withoutHash),
  });
  let canonicalBytes: string;
  try {
    canonicalBytes = canonicalJsonBytesBounded(parsedBindingSet, {
      maxBytes: BINDING_OUTPUT_MAX_BYTES,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    }).toString("utf8");
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_OUTPUT_LIMIT_EXCEEDED",
        "/bindingSet",
        errorMessage(error),
      )],
    };
  }
  const bindingSet = deepFreezeJson(parsedBindingSet);
  return Object.freeze({
    status: "compiled",
    diagnostics: EMPTY_DIAGNOSTICS,
    bindingSet,
    bindingSetHash: bindingSet.bindingSetHash,
    canonicalBytes,
  });
}

/**
 * Compiles every ProductSpecV2 evidence predicate into a separate, exact
 * code-owned topology capability binding. Product semantics are never mutated.
 */
export function compileProductEvidenceCapabilityBindingsV2(
  input: unknown,
): ProductEvidenceCapabilityBindingCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, BINDING_INPUT_MAX_BYTES);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_INPUT_INVALID",
        "/",
        errorMessage(error),
      )],
    };
  }
  const parsed = ProductEvidenceCapabilityBindingCompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod("PRODUCT_EVIDENCE_CAPABILITY_V2_INPUT_INVALID", parsed.error),
    };
  }

  let selection: ProductDeliverySelectionV2;
  try {
    selection = verifiedSelection(parsed.data.productSpec, parsed.data.deliverySelection);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_SELECTION_INVALID",
        "/deliverySelection",
        errorMessage(error),
      )],
    };
  }
  try {
    return compileBindings(parsed.data.productSpec, selection);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_CONTRACT_INVALID",
        "/bindingSet",
        errorMessage(error),
      )],
    };
  }
}

/** Fresh verification never trusts candidate hashes or candidate closure. */
export function verifyProductEvidenceCapabilityBindingsV2(
  input: unknown,
): ProductEvidenceCapabilityBindingVerificationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, BINDING_VERIFICATION_INPUT_MAX_BYTES);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_VERIFICATION_INPUT_INVALID",
        "/",
        errorMessage(error),
      )],
    };
  }
  const parsed = ProductEvidenceCapabilityBindingVerificationInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_VERIFICATION_INPUT_INVALID",
        parsed.error,
      ),
    };
  }
  const compiled = compileProductEvidenceCapabilityBindingsV2({
    productSpec: parsed.data.productSpec,
    deliverySelection: parsed.data.deliverySelection,
  });
  if (compiled.status !== "compiled") {
    return { status: "rejected", diagnostics: compiled.diagnostics };
  }
  if (compiled.canonicalBytes !== canonicalJsonStringify(parsed.data.candidateBindingSet)) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "PRODUCT_EVIDENCE_CAPABILITY_V2_CANDIDATE_MISMATCH",
        "/candidateBindingSet",
        "Candidate binding set does not equal fresh code-owned compilation",
      )],
    };
  }
  return Object.freeze({
    status: "verified",
    diagnostics: EMPTY_DIAGNOSTICS,
    bindingSet: compiled.bindingSet,
    bindingSetHash: compiled.bindingSetHash,
    canonicalBytes: compiled.canonicalBytes,
  });
}
