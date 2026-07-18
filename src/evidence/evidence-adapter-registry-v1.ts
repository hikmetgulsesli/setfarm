import { z } from "zod";

import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "../product-compiler/artifact-envelope.js";
import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
} from "../product-compiler/artifact-store-batch-plan.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../product-compiler/bounded-canonical-json.js";
import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import {
  getProductDeliveryProfileCatalogV1,
  productDeliveryProfileCatalogHashV1,
} from "../product-compiler/product-delivery-profile-catalog.js";
import type { SemanticArtifactProducerV1 } from "../product-compiler/schemas/common-v1.js";
import { getStackTopologyCatalogContract } from "../product-compiler/stack-topology-catalog.js";
import {
  EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1,
  EVIDENCE_ADAPTER_SUPPORT_SIGNATURE_SCHEMA_V1,
  EvidenceAdapterDescriptorV1Schema,
  EvidenceAdapterRegistryCompilerInputV1Schema,
  EvidenceAdapterRegistryV1Schema,
  EvidenceAdapterSupportSignatureCandidateV1Schema,
  EvidenceAdapterSupportSignatureV1Schema,
  canonicalEvidenceAdapterSupportSignatureCandidateV1,
  hashEvidenceAdapterEntryV1,
  hashEvidenceAdapterRegistryPayloadV1,
  hashEvidenceAdapterSupportSignatureV1,
  type EvidenceAdapterDescriptorCandidateV1,
  type EvidenceAdapterDescriptorV1,
  type EvidenceAdapterRegistryCompilerInputV1,
  type EvidenceAdapterRegistryV1,
  type EvidenceAdapterSupportSignatureCandidateV1,
  type EvidenceAdapterSupportSignatureV1,
} from "./schemas/evidence-adapter-registry-v1.js";

export type EvidenceAdapterRegistryDiagnosticV1 = Readonly<{
  code:
    | "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID"
    | "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH"
    | "EVIDENCE_ADAPTER_REGISTRY_V1_CONTRACT_INVALID"
    | "EVIDENCE_ADAPTER_REGISTRY_V1_PUBLICATION_INCOMPATIBLE"
    | "EVIDENCE_ADAPTER_REGISTRY_V1_VERIFICATION_INPUT_INVALID"
    | "EVIDENCE_ADAPTER_REGISTRY_V1_ENVELOPE_INVALID"
    | "EVIDENCE_ADAPTER_REGISTRY_V1_AUTHORITY_MISMATCH";
  message: string;
  reference: string;
}>;

export type EvidenceAdapterRegistryCompilationResultV1 =
  | Readonly<{
      status: "compiled";
      diagnostics: readonly [];
      registry: Readonly<EvidenceAdapterRegistryV1>;
      registryPayloadHash: string;
      registryArtifactHash: string;
      registryArtifactByteLength: number;
      envelope: Readonly<SemanticArtifactEnvelopeV1>;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly EvidenceAdapterRegistryDiagnosticV1[];
    }>;

export type EvidenceAdapterRegistryVerificationInputV1 = Readonly<{
  compilerInput: EvidenceAdapterRegistryCompilerInputV1;
  candidateEnvelope: unknown;
}>;

export type EvidenceAdapterRegistryVerificationResultV1 =
  | Readonly<{
      status: "verified";
      diagnostics: readonly [];
      registry: Readonly<EvidenceAdapterRegistryV1>;
      registryPayloadHash: string;
      registryArtifactHash: string;
      registryArtifactByteLength: number;
      envelope: Readonly<SemanticArtifactEnvelopeV1>;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly EvidenceAdapterRegistryDiagnosticV1[];
    }>;

export type EvidenceAdapterRegistryResolutionAuthorityV1 =
  | Extract<EvidenceAdapterRegistryCompilationResultV1, { status: "compiled" }>
  | Extract<EvidenceAdapterRegistryVerificationResultV1, { status: "verified" }>;

export type EvidenceAdapterResolutionResultV1 =
  | Readonly<{
      status: "resolved";
      adapterRef: string;
      adapterVersion: string;
      adapterEntryHash: string;
      supportSignatureHash: string;
    }>
  | Readonly<{
      status: "missing" | "ambiguous" | "invalid";
      code:
        | "EVIDENCE_ADAPTER_SUPPORT_MISSING"
        | "EVIDENCE_ADAPTER_SUPPORT_AMBIGUOUS"
        | "EVIDENCE_ADAPTER_SUPPORT_INPUT_INVALID";
      message: string;
    }>;

const MAX_DIAGNOSTICS = 100;
const REGISTRY_COMPILER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const REGISTRY_VERIFICATION_INPUT_MAX_BYTES = 16 * 1024 * 1024;

const RegistryVerificationOuterV1Schema = z.object({
  compilerInput: z.unknown(),
  candidateEnvelope: z.unknown(),
}).strict();
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const resolutionAuthorities = new WeakSet<object>();

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedDiagnostics(
  diagnostics: readonly EvidenceAdapterRegistryDiagnosticV1[],
): EvidenceAdapterRegistryDiagnosticV1[] {
  return [...diagnostics].sort(compareDiagnostics);
}

function compareDiagnostics(
  left: EvidenceAdapterRegistryDiagnosticV1,
  right: EvidenceAdapterRegistryDiagnosticV1,
): number {
  return compareUtf16(
    `${left.code}\0${left.reference}\0${left.message}`,
    `${right.code}\0${right.reference}\0${right.message}`,
  );
}

function diagnostic(
  code: EvidenceAdapterRegistryDiagnosticV1["code"],
  message: string,
  reference: string,
): EvidenceAdapterRegistryDiagnosticV1 {
  return {
    code,
    message: message.slice(0, 1_000),
    reference: reference.slice(0, 500),
  };
}

function diagnosticsFromZod(
  code: EvidenceAdapterRegistryDiagnosticV1["code"],
  error: z.ZodError,
): EvidenceAdapterRegistryDiagnosticV1[] {
  const retainedLimit = MAX_DIAGNOSTICS - 1;
  const issues = error.issues.slice(0, retainedLimit).map((issue) => diagnostic(
    code,
    issue.message,
    issue.path.length > 0 ? issue.path.join(".") : "registry",
  ));
  if (error.issues.length > retainedLimit) {
    issues.push(diagnostic(
      code,
      `Registry validation produced ${error.issues.length} diagnostics; retained the first ${retainedLimit}`,
      "registry",
    ));
  }
  return sortedDiagnostics(issues);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown registry authority failure";
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

function canonicalSupportSignature(
  value: EvidenceAdapterSupportSignatureCandidateV1,
): EvidenceAdapterSupportSignatureV1 {
  const candidate = canonicalEvidenceAdapterSupportSignatureCandidateV1(value);
  return EvidenceAdapterSupportSignatureV1Schema.parse({
    schema: EVIDENCE_ADAPTER_SUPPORT_SIGNATURE_SCHEMA_V1,
    ...candidate,
    supportSignatureHash: hashEvidenceAdapterSupportSignatureV1(candidate),
  });
}

function canonicalDescriptor(
  value: EvidenceAdapterDescriptorCandidateV1,
): EvidenceAdapterDescriptorV1 {
  const supportSignatures = value.supportSignatures
    .map(canonicalSupportSignature)
    .sort((left, right) => compareUtf16(
      left.supportSignatureHash,
      right.supportSignatureHash,
    ));
  const entryWithoutHash = {
    adapterRef: value.adapterRef,
    adapterVersion: value.adapterVersion,
    owner: value.owner,
    supportSignatures,
    receiptSchema: value.receiptSchema,
    runtimeDependencyRefs: [...value.runtimeDependencyRefs].sort(compareUtf16),
    toolchainHash: value.toolchainHash,
    runnerEntrypointRef: value.runnerEntrypointRef,
  };
  return EvidenceAdapterDescriptorV1Schema.parse({
    ...entryWithoutHash,
    adapterEntryHash: hashEvidenceAdapterEntryV1(entryWithoutHash),
  });
}

function registryEnvelope(
  producer: SemanticArtifactProducerV1,
  registry: EvidenceAdapterRegistryV1,
): SemanticArtifactEnvelopeV1 {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1,
    producer,
    payload: registry,
  });
}

type PublicationSnapshot = Readonly<{
  hash: string;
  byteLength: number;
  bytes: Buffer;
  envelope: SemanticArtifactEnvelopeV1;
  registry: EvidenceAdapterRegistryV1;
}>;

function publicationSnapshot(envelope: unknown): PublicationSnapshot {
  const prepared = prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [{ durabilityTier: 0, envelope }],
  });
  const canonicalItems = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
  const item = canonicalItems[0];
  if (!item || canonicalItems.length !== 1) {
    throw new Error("Registry publication preparation did not produce exactly one artifact");
  }
  const snapshot = JSON.parse(item.bytes.toString("utf8"));
  const parsedEnvelope = SemanticArtifactEnvelopeV1Schema.parse(snapshot);
  if (parsedEnvelope.artifactType !== EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1) {
    throw new Error("Registry envelope artifact type is not EvidenceAdapterRegistryV1");
  }
  const registry = EvidenceAdapterRegistryV1Schema.parse(parsedEnvelope.payload);
  if (
    canonicalJsonStringify(parsedEnvelope.producer)
      !== canonicalJsonStringify(registry.producer)
  ) {
    throw new Error("Registry envelope producer must equal the payload producer");
  }
  return {
    hash: item.identity.hash,
    byteLength: item.identity.byteLength,
    bytes: item.bytes,
    envelope: parsedEnvelope,
    registry,
  };
}

function catalogDiagnostics(
  input: z.infer<typeof EvidenceAdapterRegistryCompilerInputV1Schema>,
): EvidenceAdapterRegistryDiagnosticV1[] {
  const diagnostics: EvidenceAdapterRegistryDiagnosticV1[] = [];
  let observedDiagnostics = 0;
  const retainedLimit = MAX_DIAGNOSTICS - 1;
  const add = (value: EvidenceAdapterRegistryDiagnosticV1): void => {
    observedDiagnostics += 1;
    if (diagnostics.length < retainedLimit) {
      diagnostics.push(value);
      diagnostics.sort(compareDiagnostics);
      return;
    }
    if (retainedLimit === 0) return;
    const largest = diagnostics[diagnostics.length - 1]!;
    if (compareDiagnostics(value, largest) < 0) {
      diagnostics[diagnostics.length - 1] = value;
      diagnostics.sort(compareDiagnostics);
    }
  };
  const profileCatalog = getProductDeliveryProfileCatalogV1();
  const profileCatalogHash = productDeliveryProfileCatalogHashV1();
  const stackCatalog = new Map<string, ReturnType<typeof getStackTopologyCatalogContract>>();
  input.adapters.forEach((adapter, adapterIndex) => {
    adapter.supportSignatures.forEach((signature, signatureIndex) => {
      const reference = `adapters.${adapterIndex}.supportSignatures.${signatureIndex}`;
      const stackPackId = signature.stackPackBinding.stackPackId;
      if (!stackCatalog.has(stackPackId)) {
        stackCatalog.set(stackPackId, getStackTopologyCatalogContract(stackPackId));
      }
      const stack = stackCatalog.get(stackPackId) ?? null;
      if (
        !stack
        || stack.identity.version !== signature.stackPackBinding.stackPackVersion
        || stack.identity.contentHash !== signature.stackPackBinding.stackPackContentHash
      ) {
        add(diagnostic(
          "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH",
          "Support signature stack-pack binding does not equal the canonical topology catalog",
          `${reference}.stackPackBinding`,
        ));
        return;
      }
      const capabilities = new Map(
        stack.descriptor.capabilities.map((capability) => [capability.id, capability]),
      );
      for (const capabilityRef of signature.evidenceCapabilityRefs) {
        if (!capabilities.get(capabilityRef)?.enabled) {
          add(diagnostic(
            "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH",
            `Support signature capability is absent or disabled in its stack pack: ${capabilityRef}`,
            `${reference}.evidenceCapabilityRefs`,
          ));
        }
      }
      if (signature.deliveryBinding.kind === "profile") {
        const binding = signature.deliveryBinding;
        const profile = profileCatalog.profiles.find((candidate) =>
          candidate.id === binding.profileId);
        if (
          !profile
          || binding.catalogVersion !== profileCatalog.version
          || binding.catalogHash !== profileCatalogHash
          || profile.stackPackId !== stack.identity.id
        ) {
          add(diagnostic(
            "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH",
            "Support signature delivery binding does not equal the canonical profile catalog and stack owner",
            `${reference}.deliveryBinding`,
          ));
        }
      }
    });
  });
  if (observedDiagnostics > retainedLimit) {
    diagnostics.push(diagnostic(
      "EVIDENCE_ADAPTER_REGISTRY_V1_CATALOG_MISMATCH",
      `Catalog validation produced ${observedDiagnostics} diagnostics; retained the canonical first ${retainedLimit}`,
      "catalogDiagnostics",
    ));
  }
  return sortedDiagnostics(diagnostics);
}

export function compileEvidenceAdapterRegistryV1(
  input: unknown,
): EvidenceAdapterRegistryCompilationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, REGISTRY_COMPILER_INPUT_MAX_BYTES);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID",
        errorMessage(error),
        "registryCompilerInput",
      )],
    };
  }
  const parsed = EvidenceAdapterRegistryCompilerInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "EVIDENCE_ADAPTER_REGISTRY_V1_INPUT_INVALID",
        parsed.error,
      ),
    };
  }
  const catalog = catalogDiagnostics(parsed.data);
  if (catalog.length > 0) return { status: "rejected", diagnostics: catalog };

  const payloadWithoutHash = {
    schema: EVIDENCE_ADAPTER_REGISTRY_ARTIFACT_TYPE_V1,
    registryVersion: 1 as const,
    producer: parsed.data.producer,
    releaseAuthority: parsed.data.releaseAuthority,
    adapters: parsed.data.adapters
      .map(canonicalDescriptor)
      .sort((left, right) => compareUtf16(left.adapterRef, right.adapterRef)),
  };
  const candidate = {
    ...payloadWithoutHash,
    registryPayloadHash: hashEvidenceAdapterRegistryPayloadV1(payloadWithoutHash),
  };
  const registry = EvidenceAdapterRegistryV1Schema.safeParse(candidate);
  if (!registry.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "EVIDENCE_ADAPTER_REGISTRY_V1_CONTRACT_INVALID",
        registry.error,
      ),
    };
  }

  let publication: PublicationSnapshot;
  try {
    publication = publicationSnapshot(registryEnvelope(parsed.data.producer, registry.data));
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "EVIDENCE_ADAPTER_REGISTRY_V1_PUBLICATION_INCOMPATIBLE",
        errorMessage(error),
        "registryEnvelope",
      )],
    };
  }
  const immutableEnvelope = deepFreezeJson(publication.envelope);
  const immutableRegistry = immutableEnvelope.payload as EvidenceAdapterRegistryV1;
  const result: Extract<
    EvidenceAdapterRegistryCompilationResultV1,
    { status: "compiled" }
  > = Object.freeze({
    status: "compiled",
    diagnostics: EMPTY_DIAGNOSTICS,
    registry: immutableRegistry,
    registryPayloadHash: immutableRegistry.registryPayloadHash,
    registryArtifactHash: publication.hash,
    registryArtifactByteLength: publication.byteLength,
    envelope: immutableEnvelope,
  });
  resolutionAuthorities.add(result);
  return result;
}

export function verifyEvidenceAdapterRegistryV1(
  input: unknown,
): EvidenceAdapterRegistryVerificationResultV1 {
  let snapshot: unknown;
  try {
    snapshot = boundedJsonSnapshot(input, REGISTRY_VERIFICATION_INPUT_MAX_BYTES);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "EVIDENCE_ADAPTER_REGISTRY_V1_VERIFICATION_INPUT_INVALID",
        errorMessage(error),
        "registryVerificationInput",
      )],
    };
  }
  const outer = RegistryVerificationOuterV1Schema.safeParse(snapshot);
  if (!outer.success) {
    return {
      status: "rejected",
      diagnostics: diagnosticsFromZod(
        "EVIDENCE_ADAPTER_REGISTRY_V1_VERIFICATION_INPUT_INVALID",
        outer.error,
      ),
    };
  }
  const reproduced = compileEvidenceAdapterRegistryV1(outer.data.compilerInput);
  if (reproduced.status === "rejected") return reproduced;

  let candidate: PublicationSnapshot;
  try {
    candidate = publicationSnapshot(outer.data.candidateEnvelope);
  } catch (error) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "EVIDENCE_ADAPTER_REGISTRY_V1_ENVELOPE_INVALID",
        errorMessage(error),
        "candidateEnvelope",
      )],
    };
  }
  const reproducedPublication = publicationSnapshot(reproduced.envelope);
  if (!candidate.bytes.equals(reproducedPublication.bytes)) {
    return {
      status: "rejected",
      diagnostics: [diagnostic(
        "EVIDENCE_ADAPTER_REGISTRY_V1_AUTHORITY_MISMATCH",
        "Registry envelope does not equal a fresh reproduction from release authority",
        "candidateEnvelope",
      )],
    };
  }
  const result: Extract<
    EvidenceAdapterRegistryVerificationResultV1,
    { status: "verified" }
  > = Object.freeze({
    status: "verified",
    diagnostics: EMPTY_DIAGNOSTICS,
    registry: reproduced.registry,
    registryPayloadHash: reproduced.registryPayloadHash,
    registryArtifactHash: reproduced.registryArtifactHash,
    registryArtifactByteLength: reproduced.registryArtifactByteLength,
    envelope: reproduced.envelope,
  });
  resolutionAuthorities.add(result);
  return result;
}

export function resolveEvidenceAdapterSupportV1(
  authority: EvidenceAdapterRegistryResolutionAuthorityV1,
  requirementInput: unknown,
): EvidenceAdapterResolutionResultV1 {
  if (
    authority === null
    || typeof authority !== "object"
    || !resolutionAuthorities.has(authority)
  ) {
    return {
      status: "invalid",
      code: "EVIDENCE_ADAPTER_SUPPORT_INPUT_INVALID",
      message: "Adapter resolution requires an in-memory compiled or fresh-verified registry authority",
    };
  }
  let requirementSnapshot: unknown;
  try {
    requirementSnapshot = boundedJsonSnapshot(requirementInput, 128 * 1024);
  } catch (error) {
    return {
      status: "invalid",
      code: "EVIDENCE_ADAPTER_SUPPORT_INPUT_INVALID",
      message: errorMessage(error),
    };
  }
  const parsedRequirement = EvidenceAdapterSupportSignatureCandidateV1Schema.safeParse(
    requirementSnapshot,
  );
  if (!parsedRequirement.success) {
    return {
      status: "invalid",
      code: "EVIDENCE_ADAPTER_SUPPORT_INPUT_INVALID",
      message: parsedRequirement.error.issues[0]?.message ?? "Adapter resolution input is invalid",
    };
  }
  const requirement = canonicalEvidenceAdapterSupportSignatureCandidateV1(
    parsedRequirement.data,
  );
  const matches = authority.registry.adapters.flatMap((adapter) =>
    adapter.supportSignatures.flatMap((signature) => {
      const {
        schema: _schema,
        supportSignatureHash: _signatureHash,
        ...candidate
      } = signature;
      return canonicalJsonStringify(candidate) === canonicalJsonStringify(requirement)
        ? [{ adapter, signature }]
        : [];
    }));
  if (matches.length === 0) {
    return {
      status: "missing",
      code: "EVIDENCE_ADAPTER_SUPPORT_MISSING",
      message: "No registry adapter owns the exact support signature",
    };
  }
  if (matches.length !== 1) {
    return {
      status: "ambiguous",
      code: "EVIDENCE_ADAPTER_SUPPORT_AMBIGUOUS",
      message: "More than one registry adapter owns the exact support signature",
    };
  }
  const match = matches[0]!;
  return {
    status: "resolved",
    adapterRef: match.adapter.adapterRef,
    adapterVersion: match.adapter.adapterVersion,
    adapterEntryHash: match.adapter.adapterEntryHash,
    supportSignatureHash: match.signature.supportSignatureHash,
  };
}
