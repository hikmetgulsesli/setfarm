import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import {
  CapabilityIdSchema,
  GitCodeShaSchema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  StableReferenceSchema,
  hasUniqueStrings,
} from "../../product-compiler/schemas/common-v1.js";
import { EvidencePredicateV1Schema } from "../../product-compiler/schemas/product-spec-v1.js";

export const EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1 =
  "setfarm.evidence-adapter-registry.v1" as const;
export const EVIDENCE_ADAPTER_SUPPORT_SIGNATURE_SCHEMA_V1 =
  "setfarm.evidence-adapter-support-signature.v1" as const;
export const EVIDENCE_ADAPTER_REGISTRY_ENTRY_SCHEMA_V1 =
  "setfarm.evidence-adapter-registry-entry.v1" as const;
export const EVIDENCE_RECEIPT_ARTIFACT_TYPE_V2 =
  "setfarm.evidence-receipt.v2" as const;

export const EvidenceAdapterInvocationKindV1Schema = z.enum([
  "command",
  "browser_dom",
  "cli_process",
  "http_service",
  "state_probe",
  "persistence_lifecycle",
  "visual",
  "download",
]);

export type EvidenceAdapterInvocationKindV1 = z.infer<
  typeof EvidenceAdapterInvocationKindV1Schema
>;

export const EvidenceAdapterLifecycleModeV1Schema = z.enum([
  "none",
  "reload",
  "process_restart",
  "durable_readback",
  "flow_isolation",
  "download_completion",
]);

export type EvidenceAdapterLifecycleModeV1 = z.infer<
  typeof EvidenceAdapterLifecycleModeV1Schema
>;

export const EvidenceCheckKindReferenceV1Schema = z.enum([
  "CHECK_BUILD_PASS",
  "CHECK_CONTROL_ACTION",
  "CHECK_CONTROL_VISIBLE",
  "CHECK_DOWNLOAD",
  "CHECK_NAVIGATION",
  "CHECK_OBSERVABLE_OUTCOME",
  "CHECK_PERSISTENCE_ROUND_TRIP",
  "CHECK_RUNTIME",
  "CHECK_STATE_TRANSITION",
  "CHECK_TEST_PASS",
  "CHECK_VISUAL",
]);

export type EvidenceCheckKindReferenceV1 = z.infer<
  typeof EvidenceCheckKindReferenceV1Schema
>;

export const EvidenceAdapterInputTransportSchemaRefV1Schema = z.enum([
  "setfarm.action-input-transport.v2",
]);

export type EvidenceAdapterInputTransportSchemaRefV1 = z.infer<
  typeof EvidenceAdapterInputTransportSchemaRefV1Schema
>;

export const EvidenceAdapterRuntimeDependencyRefV1Schema = z.enum([
  "RUNTIME_NODE_PROCESS",
  "RUNTIME_PLAYWRIGHT",
]);

export type EvidenceAdapterRuntimeDependencyRefV1 = z.infer<
  typeof EvidenceAdapterRuntimeDependencyRefV1Schema
>;

export const EvidenceAdapterRunnerEntrypointRefV1Schema = z.enum([
  "ENTRY_EVIDENCE_BROWSER_DOM_V2",
  "ENTRY_EVIDENCE_CLI_PROCESS_V2",
  "ENTRY_EVIDENCE_COMMAND_V2",
  "ENTRY_EVIDENCE_DOWNLOAD_V2",
  "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
  "ENTRY_EVIDENCE_PERSISTENCE_V2",
  "ENTRY_EVIDENCE_STATE_PROBE_V2",
  "ENTRY_EVIDENCE_VISUAL_V2",
]);

export type EvidenceAdapterRunnerEntrypointRefV1 = z.infer<
  typeof EvidenceAdapterRunnerEntrypointRefV1Schema
>;

export type EvidenceAdapterRunnerAbiV1 = Readonly<{
  invocationKind: EvidenceAdapterInvocationKindV1;
  runtimeDependencyProfiles: readonly (readonly EvidenceAdapterRuntimeDependencyRefV1[])[];
}>;

function frozenRunnerAbiV1(
  invocationKind: EvidenceAdapterInvocationKindV1,
  runtimeDependencyProfiles: readonly (readonly EvidenceAdapterRuntimeDependencyRefV1[])[],
): EvidenceAdapterRunnerAbiV1 {
  return Object.freeze({
    invocationKind,
    runtimeDependencyProfiles: Object.freeze(
      runtimeDependencyProfiles.map((profile) => Object.freeze([...profile])),
    ),
  });
}

export const EVIDENCE_ADAPTER_RUNNER_ABI_V1 = Object.freeze({
  ENTRY_EVIDENCE_BROWSER_DOM_V2: frozenRunnerAbiV1(
    "browser_dom",
    [["RUNTIME_PLAYWRIGHT"]],
  ),
  ENTRY_EVIDENCE_CLI_PROCESS_V2: frozenRunnerAbiV1(
    "cli_process",
    [["RUNTIME_NODE_PROCESS"]],
  ),
  ENTRY_EVIDENCE_COMMAND_V2: frozenRunnerAbiV1(
    "command",
    [["RUNTIME_NODE_PROCESS"]],
  ),
  ENTRY_EVIDENCE_DOWNLOAD_V2: frozenRunnerAbiV1(
    "download",
    [["RUNTIME_PLAYWRIGHT"]],
  ),
  ENTRY_EVIDENCE_HTTP_SERVICE_V2: frozenRunnerAbiV1(
    "http_service",
    [["RUNTIME_NODE_PROCESS"]],
  ),
  ENTRY_EVIDENCE_PERSISTENCE_V2: frozenRunnerAbiV1(
    "persistence_lifecycle",
    [["RUNTIME_NODE_PROCESS"], ["RUNTIME_PLAYWRIGHT"]],
  ),
  ENTRY_EVIDENCE_STATE_PROBE_V2: frozenRunnerAbiV1(
    "state_probe",
    [["RUNTIME_NODE_PROCESS"], ["RUNTIME_PLAYWRIGHT"]],
  ),
  ENTRY_EVIDENCE_VISUAL_V2: frozenRunnerAbiV1(
    "visual",
    [["RUNTIME_PLAYWRIGHT"]],
  ),
} satisfies Readonly<Record<
  EvidenceAdapterRunnerEntrypointRefV1,
  EvidenceAdapterRunnerAbiV1
>>);

const VersionIdentitySchema = z.string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/, "Expected a bounded version identity");

const StackPackIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a lowercase stack-pack ID");

const DeliveryProfileIdSchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Z0-9_]+$/, "Expected an uppercase delivery-profile ID");

export const EvidenceAdapterStackPackBindingV1Schema = z.object({
  stackPackId: StackPackIdSchema,
  stackPackVersion: VersionIdentitySchema,
  stackPackContentHash: Sha256Schema,
}).strict();

export type EvidenceAdapterStackPackBindingV1 = z.infer<
  typeof EvidenceAdapterStackPackBindingV1Schema
>;

export const EvidenceAdapterProfileBindingV1Schema = z.object({
  kind: z.literal("profile"),
  profileId: DeliveryProfileIdSchema,
  catalogVersion: VersionIdentitySchema,
  catalogHash: Sha256Schema,
}).strict();

export type EvidenceAdapterProfileBindingV1 = z.infer<
  typeof EvidenceAdapterProfileBindingV1Schema
>;

export const EvidenceAdapterDeliveryBindingV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unprofiled") }).strict(),
  EvidenceAdapterProfileBindingV1Schema,
]);

export type EvidenceAdapterDeliveryBindingV1 = z.infer<
  typeof EvidenceAdapterDeliveryBindingV1Schema
>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalStrings(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) => index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function requireCanonicalStrings(
  context: z.RefinementCtx,
  path: PropertyKey[],
  values: readonly string[],
  label: string,
): void {
  if (!canonicalStrings(values)) {
    context.addIssue({
      code: "custom",
      path,
      message: `${label} must be unique and canonically UTF-16 sorted`,
    });
  }
}

const EvidenceAdapterSupportSignatureCandidateV1Shape = {
  stackPackBinding: EvidenceAdapterStackPackBindingV1Schema,
  deliveryBinding: EvidenceAdapterDeliveryBindingV1Schema,
  invocationKind: EvidenceAdapterInvocationKindV1Schema,
  predicateKind: EvidencePredicateV1Schema.shape.kind,
  evidenceCapabilityRefs: z.array(CapabilityIdSchema).max(64),
  inputTransportSchemaRefs: z.array(EvidenceAdapterInputTransportSchemaRefV1Schema).max(8),
  checkKind: EvidenceCheckKindReferenceV1Schema,
  lifecycleMode: EvidenceAdapterLifecycleModeV1Schema,
};

export type EvidencePredicateKindV1 = z.infer<
  typeof EvidencePredicateV1Schema.shape.kind
>;

export const EVIDENCE_CHECK_KIND_BY_PREDICATE_KIND_V1 = Object.freeze({
  control_visible: "CHECK_CONTROL_VISIBLE",
  control_action: "CHECK_CONTROL_ACTION",
  state_transition: "CHECK_STATE_TRANSITION",
  persistence_round_trip: "CHECK_PERSISTENCE_ROUND_TRIP",
  navigation: "CHECK_NAVIGATION",
  download: "CHECK_DOWNLOAD",
  runtime: "CHECK_RUNTIME",
  build: "CHECK_BUILD_PASS",
  test: "CHECK_TEST_PASS",
  visual: "CHECK_VISUAL",
  observable_outcome: "CHECK_OBSERVABLE_OUTCOME",
} satisfies Readonly<Record<
  EvidencePredicateKindV1,
  z.infer<typeof EvidenceCheckKindReferenceV1Schema>
>>);

function requirePredicateCheckPair(
  context: z.RefinementCtx,
  value: Readonly<{
    predicateKind: z.infer<typeof EvidencePredicateV1Schema.shape.kind>;
    checkKind: z.infer<typeof EvidenceCheckKindReferenceV1Schema>;
  }>,
): void {
  if (value.checkKind !== EVIDENCE_CHECK_KIND_BY_PREDICATE_KIND_V1[value.predicateKind]) {
    context.addIssue({
      code: "custom",
      path: ["checkKind"],
      message: "Check kind must equal the canonical predicate-owned check",
    });
  }
}

export function evidenceCheckKindForPredicateV1(
  predicateKind: EvidencePredicateKindV1,
): EvidenceCheckKindReferenceV1 {
  return EVIDENCE_CHECK_KIND_BY_PREDICATE_KIND_V1[predicateKind];
}

export const EvidenceAdapterSupportSignatureCandidateV1Schema = z.object(
  EvidenceAdapterSupportSignatureCandidateV1Shape,
).strict().superRefine((value, context) => {
  requirePredicateCheckPair(context, value);
  if (!hasUniqueStrings(value.evidenceCapabilityRefs)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceCapabilityRefs"],
      message: "Evidence capability refs must be unique",
    });
  }
  if (!hasUniqueStrings(value.inputTransportSchemaRefs)) {
    context.addIssue({
      code: "custom",
      path: ["inputTransportSchemaRefs"],
      message: "Input transport schema refs must be unique",
    });
  }
});

export type EvidenceAdapterSupportSignatureCandidateV1 = z.infer<
  typeof EvidenceAdapterSupportSignatureCandidateV1Schema
>;

export function canonicalEvidenceAdapterSupportSignatureCandidateV1(
  value: EvidenceAdapterSupportSignatureCandidateV1,
): EvidenceAdapterSupportSignatureCandidateV1 {
  return {
    ...value,
    evidenceCapabilityRefs: [...value.evidenceCapabilityRefs].sort(compareUtf16),
    inputTransportSchemaRefs: [...value.inputTransportSchemaRefs].sort(compareUtf16),
  };
}

export function hashEvidenceAdapterSupportSignatureV1(
  value: EvidenceAdapterSupportSignatureCandidateV1,
): string {
  return hashCanonicalJson({
    schema: EVIDENCE_ADAPTER_SUPPORT_SIGNATURE_SCHEMA_V1,
    ...canonicalEvidenceAdapterSupportSignatureCandidateV1(value),
  });
}

export const EvidenceAdapterSupportSignatureV1Schema = z.object({
  schema: z.literal(EVIDENCE_ADAPTER_SUPPORT_SIGNATURE_SCHEMA_V1),
  ...EvidenceAdapterSupportSignatureCandidateV1Shape,
  supportSignatureHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  requirePredicateCheckPair(context, value);
  requireCanonicalStrings(
    context,
    ["evidenceCapabilityRefs"],
    value.evidenceCapabilityRefs,
    "Evidence capability refs",
  );
  requireCanonicalStrings(
    context,
    ["inputTransportSchemaRefs"],
    value.inputTransportSchemaRefs,
    "Input transport schema refs",
  );
  const { schema: _schema, supportSignatureHash: _hash, ...candidate } = value;
  if (value.supportSignatureHash !== hashEvidenceAdapterSupportSignatureV1(candidate)) {
    context.addIssue({
      code: "custom",
      path: ["supportSignatureHash"],
      message: "Support signature hash must bind the exact domain-separated signature",
    });
  }
});

export type EvidenceAdapterSupportSignatureV1 = z.infer<
  typeof EvidenceAdapterSupportSignatureV1Schema
>;

const EvidenceAdapterDescriptorCandidateV1Shape = {
  adapterRef: StableReferenceSchema,
  adapterVersion: VersionIdentitySchema,
  owner: z.literal("setfarm-orchestrator"),
  supportSignatures: z.array(EvidenceAdapterSupportSignatureCandidateV1Schema).min(1).max(256),
  receiptSchema: z.literal(EVIDENCE_RECEIPT_ARTIFACT_TYPE_V2),
  runtimeDependencyRefs: z.array(EvidenceAdapterRuntimeDependencyRefV1Schema).max(8),
  toolchainHash: Sha256Schema,
  runnerEntrypointRef: EvidenceAdapterRunnerEntrypointRefV1Schema,
};

function sameCanonicalStringSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const canonicalLeft = [...left].sort(compareUtf16);
  const canonicalRight = [...right].sort(compareUtf16);
  return canonicalLeft.length === canonicalRight.length
    && canonicalLeft.every((value, index) => value === canonicalRight[index]);
}

function requireRunnerAbi(
  context: z.RefinementCtx,
  value: Readonly<{
    runnerEntrypointRef: EvidenceAdapterRunnerEntrypointRefV1;
    runtimeDependencyRefs: readonly EvidenceAdapterRuntimeDependencyRefV1[];
    supportSignatures: readonly Readonly<{ invocationKind: EvidenceAdapterInvocationKindV1 }>[];
  }>,
): void {
  const abi = EVIDENCE_ADAPTER_RUNNER_ABI_V1[value.runnerEntrypointRef];
  if (value.supportSignatures.some((signature) => signature.invocationKind !== abi.invocationKind)) {
    context.addIssue({
      code: "custom",
      path: ["supportSignatures"],
      message: "Every support signature invocation must equal the runner ABI",
    });
  }
  if (!abi.runtimeDependencyProfiles.some((profile) =>
    sameCanonicalStringSet(profile, value.runtimeDependencyRefs))) {
    context.addIssue({
      code: "custom",
      path: ["runtimeDependencyRefs"],
      message: "Runtime dependency refs must equal one exact runner ABI profile",
    });
  }
}

function candidateSupportHashes(
  values: readonly EvidenceAdapterSupportSignatureCandidateV1[],
): string[] {
  return values.map(hashEvidenceAdapterSupportSignatureV1);
}

function addLogicalBindingConflictIssues(
  context: z.RefinementCtx,
  signatures: readonly EvidenceAdapterSupportSignatureCandidateV1[],
  path: PropertyKey[],
): void {
  const stackHashes = new Map<string, string>();
  const profileHashes = new Map<string, string>();
  signatures.forEach((signature, index) => {
    const stack = signature.stackPackBinding;
    const stackKey = `${stack.stackPackId}\0${stack.stackPackVersion}`;
    const priorStackHash = stackHashes.get(stackKey);
    if (priorStackHash !== undefined && priorStackHash !== stack.stackPackContentHash) {
      context.addIssue({
        code: "custom",
        path: [...path, index, "stackPackBinding", "stackPackContentHash"],
        message: "One logical stack-pack identity cannot carry conflicting content hashes",
      });
    }
    stackHashes.set(stackKey, stack.stackPackContentHash);

    if (signature.deliveryBinding.kind === "profile") {
      const profile = signature.deliveryBinding;
      const profileKey = `${profile.profileId}\0${profile.catalogVersion}`;
      const priorProfileHash = profileHashes.get(profileKey);
      if (priorProfileHash !== undefined && priorProfileHash !== profile.catalogHash) {
        context.addIssue({
          code: "custom",
          path: [...path, index, "deliveryBinding", "catalogHash"],
          message: "One logical delivery-profile identity cannot carry conflicting catalog hashes",
        });
      }
      profileHashes.set(profileKey, profile.catalogHash);
    }
  });
}

export const EvidenceAdapterDescriptorCandidateV1Schema = z.object(
  EvidenceAdapterDescriptorCandidateV1Shape,
).strict().superRefine((value, context) => {
  requireRunnerAbi(context, value);
  if (!hasUniqueStrings(candidateSupportHashes(value.supportSignatures))) {
    context.addIssue({
      code: "custom",
      path: ["supportSignatures"],
      message: "Adapter support signatures must be unique",
    });
  }
  if (!hasUniqueStrings(value.runtimeDependencyRefs)) {
    context.addIssue({
      code: "custom",
      path: ["runtimeDependencyRefs"],
      message: "Runtime dependency refs must be unique",
    });
  }
  addLogicalBindingConflictIssues(context, value.supportSignatures, ["supportSignatures"]);
});

export type EvidenceAdapterDescriptorCandidateV1 = z.infer<
  typeof EvidenceAdapterDescriptorCandidateV1Schema
>;

export const EvidenceAdapterDescriptorV1Schema = z.object({
  ...EvidenceAdapterDescriptorCandidateV1Shape,
  supportSignatures: z.array(EvidenceAdapterSupportSignatureV1Schema).min(1).max(256),
  adapterEntryHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  requireRunnerAbi(context, value);
  requireCanonicalStrings(
    context,
    ["supportSignatures"],
    value.supportSignatures.map((signature) => signature.supportSignatureHash),
    "Adapter support signatures",
  );
  requireCanonicalStrings(
    context,
    ["runtimeDependencyRefs"],
    value.runtimeDependencyRefs,
    "Runtime dependency refs",
  );
  addLogicalBindingConflictIssues(context, value.supportSignatures, ["supportSignatures"]);
  if (value.adapterEntryHash !== hashEvidenceAdapterEntryV1(value)) {
    context.addIssue({
      code: "custom",
      path: ["adapterEntryHash"],
      message: "Adapter entry hash must bind the exact domain-separated registry entry",
    });
  }
});

export type EvidenceAdapterDescriptorV1 = z.infer<
  typeof EvidenceAdapterDescriptorV1Schema
>;

export function hashEvidenceAdapterEntryV1(
  value: Omit<EvidenceAdapterDescriptorV1, "adapterEntryHash"> | EvidenceAdapterDescriptorV1,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.adapterEntryHash;
  return hashCanonicalJson({
    schema: EVIDENCE_ADAPTER_REGISTRY_ENTRY_SCHEMA_V1,
    entry,
  });
}

export const EvidenceAdapterRegistryReleaseAuthorityV1Schema = z.object({
  codeSha: GitCodeShaSchema,
  platformBundleHash: Sha256Schema,
  externalResolutionHash: Sha256Schema,
  environmentCapsuleHash: Sha256Schema,
}).strict();

export type EvidenceAdapterRegistryReleaseAuthorityV1 = z.infer<
  typeof EvidenceAdapterRegistryReleaseAuthorityV1Schema
>;

function allCandidateSignatures(
  adapters: readonly EvidenceAdapterDescriptorCandidateV1[],
): EvidenceAdapterSupportSignatureCandidateV1[] {
  return adapters.flatMap((adapter) => adapter.supportSignatures);
}

export const EvidenceAdapterRegistryCompilerInputV1Schema = z.object({
  producer: SemanticArtifactProducerV1Schema,
  releaseAuthority: EvidenceAdapterRegistryReleaseAuthorityV1Schema,
  adapters: z.array(EvidenceAdapterDescriptorCandidateV1Schema).min(1).max(128),
}).strict().superRefine((value, context) => {
  if (value.releaseAuthority.codeSha !== value.producer.codeSha) {
    context.addIssue({
      code: "custom",
      path: ["releaseAuthority", "codeSha"],
      message: "Registry release code SHA must equal the producer code SHA",
    });
  }
  if (!hasUniqueStrings(value.adapters.map((adapter) => adapter.adapterRef))) {
    context.addIssue({
      code: "custom",
      path: ["adapters"],
      message: "Registry adapter refs must be unique",
    });
  }
  const signatures = allCandidateSignatures(value.adapters);
  if (!hasUniqueStrings(candidateSupportHashes(signatures))) {
    context.addIssue({
      code: "custom",
      path: ["adapters"],
      message: "One exact support signature may have only one adapter owner",
    });
  }
  addLogicalBindingConflictIssues(context, signatures, ["adapters"]);
});

export type EvidenceAdapterRegistryCompilerInputV1 = z.input<
  typeof EvidenceAdapterRegistryCompilerInputV1Schema
>;

export const EvidenceAdapterRegistryV1Schema = z.object({
  schema: z.literal(EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1),
  registryVersion: z.literal(1),
  producer: SemanticArtifactProducerV1Schema,
  releaseAuthority: EvidenceAdapterRegistryReleaseAuthorityV1Schema,
  adapters: z.array(EvidenceAdapterDescriptorV1Schema).min(1).max(128),
  registryPayloadHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.releaseAuthority.codeSha !== value.producer.codeSha) {
    context.addIssue({
      code: "custom",
      path: ["releaseAuthority", "codeSha"],
      message: "Registry release code SHA must equal the producer code SHA",
    });
  }
  requireCanonicalStrings(
    context,
    ["adapters"],
    value.adapters.map((adapter) => adapter.adapterRef),
    "Registry adapter refs",
  );
  const signatures = value.adapters.flatMap((adapter) => adapter.supportSignatures);
  if (!hasUniqueStrings(signatures.map((signature) => signature.supportSignatureHash))) {
    context.addIssue({
      code: "custom",
      path: ["adapters"],
      message: "One exact support signature may have only one adapter owner",
    });
  }
  addLogicalBindingConflictIssues(context, signatures, ["adapters"]);
  if (value.registryPayloadHash !== hashEvidenceAdapterRegistryPayloadV1(value)) {
    context.addIssue({
      code: "custom",
      path: ["registryPayloadHash"],
      message: "Registry payload hash must bind the exact canonical registry payload",
    });
  }
});

export type EvidenceAdapterRegistryV1 = z.infer<
  typeof EvidenceAdapterRegistryV1Schema
>;

export function hashEvidenceAdapterRegistryPayloadV1(
  value: Omit<EvidenceAdapterRegistryV1, "registryPayloadHash"> | EvidenceAdapterRegistryV1,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.registryPayloadHash;
  return hashCanonicalJson(payload);
}
