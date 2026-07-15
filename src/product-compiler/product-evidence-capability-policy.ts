import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { getStackTopologyCatalogContract } from "./stack-topology-catalog.js";
import {
  EvidencePredicateV1Schema,
  PersistencePolicyV1Schema,
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "./schemas/product-spec-v1.js";
import { BuildCapabilityV1Schema } from "./schemas/build-topology-v1.js";
import { hasUniqueStrings } from "./schemas/common-v1.js";

export const PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION = "1.0.0";

const EvidenceKindSchema = EvidencePredicateV1Schema.shape.kind;
const CapabilityKindSchema = BuildCapabilityV1Schema.shape.kind;
const TriggerKindSchema = z.enum(["user", "system", "timer", "route"]);
const PersistenceKindSchema = PersistencePolicyV1Schema.shape.kind;

const EvidenceCapabilityRuleV1Schema = z.object({
  evidenceKind: EvidenceKindSchema,
  capabilityKinds: z.array(CapabilityKindSchema).max(20).refine(hasUniqueStrings, {
    message: "Evidence capability kinds must be unique",
  }),
  includeSubjectActionTrigger: z.boolean(),
  includeSubjectActionPersistence: z.boolean(),
}).strict();

const TriggerCapabilityRuleV1Schema = z.object({
  triggerKind: TriggerKindSchema,
  capabilityKinds: z.array(CapabilityKindSchema).max(20).refine(hasUniqueStrings, {
    message: "Trigger capability kinds must be unique",
  }),
}).strict();

const PersistenceCapabilityRuleV1Schema = z.object({
  persistenceKind: PersistenceKindSchema,
  capabilityKinds: z.array(CapabilityKindSchema).max(20).refine(hasUniqueStrings, {
    message: "Persistence capability kinds must be unique",
  }),
}).strict();

export const ProductEvidenceCapabilityPolicyV1Schema = z.object({
  schema: z.literal("setfarm.product-evidence-capability-policy.v1"),
  version: z.literal(PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION),
  owner: z.literal("product_compiler"),
  plannerCapabilityRefsDisposition: z.literal("ignored"),
  evidenceRules: z.array(EvidenceCapabilityRuleV1Schema).length(EvidenceKindSchema.options.length),
  triggerRules: z.array(TriggerCapabilityRuleV1Schema).length(TriggerKindSchema.options.length),
  persistenceRules: z.array(PersistenceCapabilityRuleV1Schema).length(PersistenceKindSchema.options.length),
}).strict().superRefine((value, context) => {
  for (const [path, values, label] of [
    ["evidenceRules", value.evidenceRules.map((rule) => rule.evidenceKind), "evidence kinds"],
    ["triggerRules", value.triggerRules.map((rule) => rule.triggerKind), "trigger kinds"],
    ["persistenceRules", value.persistenceRules.map((rule) => rule.persistenceKind), "persistence kinds"],
  ] as const) {
    if (!hasUniqueStrings(values)) {
      context.addIssue({ code: "custom", path: [path], message: `Policy ${label} must be unique` });
    }
  }
});

export type ProductEvidenceCapabilityPolicyV1 = z.infer<typeof ProductEvidenceCapabilityPolicyV1Schema>;

export type ProductEvidenceCapabilityDiagnosticV1 = Readonly<{
  code: string;
  path: string;
  message: string;
  reference?: string;
}>;

export type ProductEvidenceCapabilityResultV1 =
  | Readonly<{
      status: "compiled";
      productSpec: ProductSpecV1;
      policyHash: string;
      policyVersion: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ProductEvidenceCapabilityDiagnosticV1[];
      policyHash: string;
      policyVersion: string;
    }>;

const PRODUCT_EVIDENCE_CAPABILITY_POLICY = ProductEvidenceCapabilityPolicyV1Schema.parse({
  schema: "setfarm.product-evidence-capability-policy.v1",
  version: PRODUCT_EVIDENCE_CAPABILITY_POLICY_VERSION,
  owner: "product_compiler",
  plannerCapabilityRefsDisposition: "ignored",
  evidenceRules: [
    { evidenceKind: "control_visible", capabilityKinds: ["browser_interaction"], includeSubjectActionTrigger: false, includeSubjectActionPersistence: false },
    { evidenceKind: "control_action", capabilityKinds: [], includeSubjectActionTrigger: true, includeSubjectActionPersistence: false },
    { evidenceKind: "state_transition", capabilityKinds: ["runtime_state"], includeSubjectActionTrigger: false, includeSubjectActionPersistence: false },
    { evidenceKind: "persistence_round_trip", capabilityKinds: [], includeSubjectActionTrigger: true, includeSubjectActionPersistence: true },
    { evidenceKind: "navigation", capabilityKinds: ["browser_interaction"], includeSubjectActionTrigger: true, includeSubjectActionPersistence: false },
    { evidenceKind: "download", capabilityKinds: ["browser_interaction", "download"], includeSubjectActionTrigger: true, includeSubjectActionPersistence: false },
    { evidenceKind: "runtime", capabilityKinds: ["runtime_state"], includeSubjectActionTrigger: true, includeSubjectActionPersistence: false },
    { evidenceKind: "build", capabilityKinds: [], includeSubjectActionTrigger: false, includeSubjectActionPersistence: false },
    { evidenceKind: "test", capabilityKinds: ["test_runner"], includeSubjectActionTrigger: false, includeSubjectActionPersistence: false },
    { evidenceKind: "visual", capabilityKinds: ["visual_capture"], includeSubjectActionTrigger: false, includeSubjectActionPersistence: false },
    { evidenceKind: "observable_outcome", capabilityKinds: ["browser_interaction"], includeSubjectActionTrigger: true, includeSubjectActionPersistence: true },
  ],
  triggerRules: [
    { triggerKind: "user", capabilityKinds: ["browser_interaction"] },
    { triggerKind: "system", capabilityKinds: ["runtime_state"] },
    { triggerKind: "timer", capabilityKinds: ["game_timing"] },
    { triggerKind: "route", capabilityKinds: ["browser_interaction"] },
  ],
  persistenceRules: [
    { persistenceKind: "none", capabilityKinds: [] },
    { persistenceKind: "memory", capabilityKinds: ["runtime_state"] },
    { persistenceKind: "local_storage", capabilityKinds: ["local_persistence"] },
    { persistenceKind: "database", capabilityKinds: ["database"] },
    { persistenceKind: "file", capabilityKinds: ["filesystem"] },
    { persistenceKind: "remote_api", capabilityKinds: ["network"] },
  ],
});

export function getProductEvidenceCapabilityPolicyV1(): ProductEvidenceCapabilityPolicyV1 {
  return structuredClone(PRODUCT_EVIDENCE_CAPABILITY_POLICY);
}

export function productEvidenceCapabilityPolicyHashV1(): string {
  return hashCanonicalJson(PRODUCT_EVIDENCE_CAPABILITY_POLICY);
}

export function canonicalProductEvidenceCapabilityPolicyV1(): string {
  return canonicalJsonStringify(PRODUCT_EVIDENCE_CAPABILITY_POLICY);
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function actionForSubject(
  productSpec: ProductSpecV1,
  subjectRef: string,
): ProductActionV1 | undefined {
  const exactAction = productSpec.actions.find((action) => action.id === subjectRef);
  if (exactAction) return exactAction;
  return productSpec.actions.find((action) =>
    (action.observableEffects ?? []).some((effect) => effect.id === subjectRef));
}

/**
 * Compiles semantic evidence requirements into exact enabled topology
 * capabilities. Physical capability IDs are platform output, never planner
 * input; any capabilityRefs proposed by the model have already been discarded.
 */
export function compileProductEvidenceCapabilitiesV1(input: Readonly<{
  productSpec: ProductSpecV1;
  stackPackId: string;
}>): ProductEvidenceCapabilityResultV1 {
  const policy = getProductEvidenceCapabilityPolicyV1();
  const policyHash = productEvidenceCapabilityPolicyHashV1();
  const topology = getStackTopologyCatalogContract(input.stackPackId);
  if (!topology) {
    return {
      status: "rejected",
      diagnostics: [{
        code: "PRODUCT_SPEC_EVIDENCE_TOPOLOGY_UNAVAILABLE",
        path: "/delivery/techStack",
        message: `No topology catalog contract exists for ${input.stackPackId}`,
        reference: input.stackPackId,
      }],
      policyHash,
      policyVersion: policy.version,
    };
  }

  const evidenceRules = new Map(policy.evidenceRules.map((rule) => [rule.evidenceKind, rule]));
  const triggerRules = new Map(policy.triggerRules.map((rule) => [rule.triggerKind, rule]));
  const persistenceRules = new Map(policy.persistenceRules.map((rule) => [rule.persistenceKind, rule]));
  const persistenceById = new Map(input.productSpec.persistencePolicies.map((item) => [item.id, item]));
  const enabledCapabilitiesByKind = new Map<string, Array<{ id: string }>>();
  topology.descriptor.capabilities.filter((capability) => capability.enabled).forEach((capability) => {
    const values = enabledCapabilitiesByKind.get(capability.kind) ?? [];
    values.push({ id: capability.id });
    enabledCapabilitiesByKind.set(capability.kind, values);
  });

  const diagnostics: ProductEvidenceCapabilityDiagnosticV1[] = [];
  const evidencePredicates = input.productSpec.evidencePredicates.map((predicate, index) => {
    const rule = evidenceRules.get(predicate.kind)!;
    const requiredKinds = new Set(rule.capabilityKinds);
    const subjectAction = actionForSubject(input.productSpec, predicate.subjectRef);
    if (rule.includeSubjectActionTrigger && subjectAction) {
      triggerRules.get(subjectAction.trigger.kind)!.capabilityKinds.forEach((kind) => requiredKinds.add(kind));
    }
    if (rule.includeSubjectActionPersistence) {
      const policies = subjectAction
        ? subjectAction.persistenceEffects.map((effect) => persistenceById.get(effect.policyRef)).filter(Boolean)
        : [persistenceById.get(predicate.subjectRef)].filter(Boolean);
      policies.forEach((persistence) => {
        persistenceRules.get(persistence!.kind)!.capabilityKinds.forEach((kind) => requiredKinds.add(kind));
      });
    }

    const capabilityRefs: string[] = [];
    [...requiredKinds].sort(compareUtf16).forEach((kind) => {
      const capabilities = enabledCapabilitiesByKind.get(kind) ?? [];
      if (capabilities.length === 0) {
        diagnostics.push({
          code: "PRODUCT_SPEC_EVIDENCE_CAPABILITY_UNAVAILABLE",
          path: `/evidencePredicates/${index}/capabilityRefs`,
          message: `Evidence ${predicate.id} requires topology capability kind ${kind}, but ${input.stackPackId} activates none`,
          reference: kind,
        });
      } else if (capabilities.length > 1) {
        diagnostics.push({
          code: "PRODUCT_SPEC_EVIDENCE_CAPABILITY_AMBIGUOUS",
          path: `/evidencePredicates/${index}/capabilityRefs`,
          message: `Evidence ${predicate.id} capability kind ${kind} resolves to multiple enabled topology capabilities`,
          reference: kind,
        });
      } else {
        capabilityRefs.push(capabilities[0]!.id);
      }
    });
    return { ...predicate, capabilityRefs: capabilityRefs.sort(compareUtf16) };
  });

  if (diagnostics.length > 0) {
    return {
      status: "rejected",
      diagnostics: diagnostics.sort((left, right) => compareUtf16(
        `${left.path}\0${left.code}\0${left.reference ?? ""}`,
        `${right.path}\0${right.code}\0${right.reference ?? ""}`,
      )),
      policyHash,
      policyVersion: policy.version,
    };
  }
  return {
    status: "compiled",
    productSpec: ProductSpecV1Schema.parse({ ...input.productSpec, evidencePredicates }),
    policyHash,
    policyVersion: policy.version,
  };
}
