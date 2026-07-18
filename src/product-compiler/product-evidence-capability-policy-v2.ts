import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { BuildCapabilityV1Schema } from "./schemas/build-topology-v1.js";
import { StableReferenceSchema, hasUniqueStrings } from "./schemas/common-v1.js";
import {
  EvidencePredicateV2Schema,
} from "./schemas/product-spec-v2.js";
import { PersistencePolicyV1Schema } from "./schemas/product-spec-v1.js";
import {
  ProductActionInvocationInterfaceIntentV1Schema,
} from "./schemas/action-invocation-interface-intent-v1.js";

export const PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION = "2.0.0";

const EvidenceKindV2Schema = EvidencePredicateV2Schema.shape.kind;
const CapabilityKindV2Schema = BuildCapabilityV1Schema.shape.kind;
const PersistenceKindV2Schema = PersistencePolicyV1Schema.shape.kind;
const InvocationKindV2Schema = ProductActionInvocationInterfaceIntentV1Schema.options[0].shape.kind
  .or(ProductActionInvocationInterfaceIntentV1Schema.options[1].shape.kind)
  .or(ProductActionInvocationInterfaceIntentV1Schema.options[2].shape.kind)
  .or(ProductActionInvocationInterfaceIntentV1Schema.options[3].shape.kind);

const EvidenceCapabilityRuleV2Schema = z.object({
  ruleRef: StableReferenceSchema,
  evidenceKind: EvidenceKindV2Schema,
  capabilityKinds: z.array(CapabilityKindV2Schema).max(20).refine(hasUniqueStrings, {
    message: "Evidence capability kinds must be unique",
  }),
  subjectActionInvocation: z.enum(["none", "when_resolvable", "required"]),
  persistenceResolution: z.enum(["none", "exact_subject_policy"]),
}).strict();

const InvocationCapabilityRuleV2Schema = z.object({
  ruleRef: StableReferenceSchema,
  invocationKind: InvocationKindV2Schema,
  capabilityKinds: z.array(CapabilityKindV2Schema).min(1).max(20).refine(hasUniqueStrings, {
    message: "Invocation capability kinds must be unique",
  }),
}).strict();

const PersistenceCapabilityRuleV2Schema = z.object({
  ruleRef: StableReferenceSchema,
  persistenceKind: PersistenceKindV2Schema,
  capabilityKinds: z.array(CapabilityKindV2Schema).max(20).refine(hasUniqueStrings, {
    message: "Persistence capability kinds must be unique",
  }),
}).strict();

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addExactCoverageIssue(
  context: z.RefinementCtx,
  path: "evidenceRules" | "invocationRules" | "persistenceRules",
  actual: readonly string[],
  expected: readonly string[],
): void {
  const canonicalActual = [...actual].sort(compareUtf16);
  const canonicalExpected = [...expected].sort(compareUtf16);
  if (
    !hasUniqueStrings(actual)
    || canonicalJsonStringify(canonicalActual) !== canonicalJsonStringify(canonicalExpected)
  ) {
    context.addIssue({
      code: "custom",
      path: [path],
      message: `${path} must contain every and only its code-owned domain exactly once`,
    });
  }
  if (canonicalJsonStringify(actual) !== canonicalJsonStringify(canonicalActual)) {
    context.addIssue({
      code: "custom",
      path: [path],
      message: `${path} must be ordered canonically by its domain key`,
    });
  }
}

export const ProductEvidenceCapabilityPolicyV2Schema = z.object({
  schema: z.literal("setfarm.product-evidence-capability-policy.v2"),
  version: z.literal(PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION),
  owner: z.literal("product_compiler"),
  productSpecCapabilityRefsDisposition: z.literal("forbidden"),
  topologyCapabilityResolution: z.literal("exactly_one_enabled"),
  evidenceRules: z.array(EvidenceCapabilityRuleV2Schema)
    .length(EvidenceKindV2Schema.options.length),
  invocationRules: z.array(InvocationCapabilityRuleV2Schema)
    .length(ProductActionInvocationInterfaceIntentV1Schema.options.length),
  persistenceRules: z.array(PersistenceCapabilityRuleV2Schema)
    .length(PersistenceKindV2Schema.options.length),
}).strict().superRefine((value, context) => {
  addExactCoverageIssue(
    context,
    "evidenceRules",
    value.evidenceRules.map((rule) => rule.evidenceKind),
    EvidenceKindV2Schema.options,
  );
  addExactCoverageIssue(
    context,
    "invocationRules",
    value.invocationRules.map((rule) => rule.invocationKind),
    ProductActionInvocationInterfaceIntentV1Schema.options.map((option) => option.shape.kind.value),
  );
  addExactCoverageIssue(
    context,
    "persistenceRules",
    value.persistenceRules.map((rule) => rule.persistenceKind),
    PersistenceKindV2Schema.options,
  );
  const ruleRefs = [
    ...value.evidenceRules.map((rule) => rule.ruleRef),
    ...value.invocationRules.map((rule) => rule.ruleRef),
    ...value.persistenceRules.map((rule) => rule.ruleRef),
  ];
  if (!hasUniqueStrings(ruleRefs)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceRules"],
      message: "Policy rule refs must be globally unique",
    });
  }
});

export type ProductEvidenceCapabilityPolicyV2 = z.infer<
  typeof ProductEvidenceCapabilityPolicyV2Schema
>;

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

const PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2 = deepFreezeJson(
  ProductEvidenceCapabilityPolicyV2Schema.parse({
    schema: "setfarm.product-evidence-capability-policy.v2",
    version: PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
    owner: "product_compiler",
    productSpecCapabilityRefsDisposition: "forbidden",
    topologyCapabilityResolution: "exactly_one_enabled",
    evidenceRules: [
      { ruleRef: "EVIDENCE_ACTION_INVOCATION_V2", evidenceKind: "action_invocation", capabilityKinds: [], subjectActionInvocation: "required", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_BUILD_V2", evidenceKind: "build", capabilityKinds: [], subjectActionInvocation: "none", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_CONTROL_ACTION_V2", evidenceKind: "control_action", capabilityKinds: [], subjectActionInvocation: "required", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_CONTROL_VISIBLE_V2", evidenceKind: "control_visible", capabilityKinds: ["browser_interaction"], subjectActionInvocation: "none", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_DOWNLOAD_V2", evidenceKind: "download", capabilityKinds: ["browser_interaction", "download"], subjectActionInvocation: "when_resolvable", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_NAVIGATION_V2", evidenceKind: "navigation", capabilityKinds: ["browser_interaction"], subjectActionInvocation: "when_resolvable", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_OBSERVABLE_OUTCOME_V2", evidenceKind: "observable_outcome", capabilityKinds: [], subjectActionInvocation: "required", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_PERSISTENCE_ROUND_TRIP_V2", evidenceKind: "persistence_round_trip", capabilityKinds: [], subjectActionInvocation: "required", persistenceResolution: "exact_subject_policy" },
      { ruleRef: "EVIDENCE_RUNTIME_V2", evidenceKind: "runtime", capabilityKinds: ["runtime_state"], subjectActionInvocation: "when_resolvable", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_STATE_TRANSITION_V2", evidenceKind: "state_transition", capabilityKinds: ["runtime_state"], subjectActionInvocation: "none", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_TEST_V2", evidenceKind: "test", capabilityKinds: ["test_runner"], subjectActionInvocation: "none", persistenceResolution: "none" },
      { ruleRef: "EVIDENCE_VISUAL_V2", evidenceKind: "visual", capabilityKinds: ["visual_capture"], subjectActionInvocation: "none", persistenceResolution: "none" },
    ],
    invocationRules: [
      { ruleRef: "INVOCATION_CLI_COMMAND_V2", invocationKind: "cli_command", capabilityKinds: ["cli_interaction"] },
      { ruleRef: "INVOCATION_HTTP_REQUEST_V2", invocationKind: "http_request", capabilityKinds: ["network"] },
      { ruleRef: "INVOCATION_RENDERED_CONTROL_V2", invocationKind: "rendered_control", capabilityKinds: ["browser_interaction"] },
      { ruleRef: "INVOCATION_ROUTE_ENTRY_V2", invocationKind: "route_entry", capabilityKinds: ["browser_interaction"] },
    ],
    persistenceRules: [
      { ruleRef: "PERSISTENCE_DATABASE_V2", persistenceKind: "database", capabilityKinds: ["database"] },
      { ruleRef: "PERSISTENCE_FILE_V2", persistenceKind: "file", capabilityKinds: ["filesystem"] },
      { ruleRef: "PERSISTENCE_LOCAL_STORAGE_V2", persistenceKind: "local_storage", capabilityKinds: ["local_persistence"] },
      { ruleRef: "PERSISTENCE_MEMORY_V2", persistenceKind: "memory", capabilityKinds: ["runtime_state"] },
      { ruleRef: "PERSISTENCE_NONE_V2", persistenceKind: "none", capabilityKinds: [] },
      { ruleRef: "PERSISTENCE_REMOTE_API_V2", persistenceKind: "remote_api", capabilityKinds: ["network"] },
    ],
  }),
);

export function getProductEvidenceCapabilityPolicyV2(): ProductEvidenceCapabilityPolicyV2 {
  return deepFreezeJson(structuredClone(PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2));
}

export function productEvidenceCapabilityPolicyHashV2(): string {
  return hashCanonicalJson(PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2);
}

export function canonicalProductEvidenceCapabilityPolicyV2(): string {
  return canonicalJsonStringify(PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2);
}
