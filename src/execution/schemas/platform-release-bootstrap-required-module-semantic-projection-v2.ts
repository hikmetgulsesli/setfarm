import { createHash } from "node:crypto";
import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleasePortableLocatorV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  getPlatformReleaseRequiredModuleRequirementV2,
  PlatformReleaseRequiredModuleRequirementV2Schema,
  PlatformReleaseRequiredModuleRoleV2Schema,
  type PlatformReleaseRequiredModuleDefinitionV2,
  type PlatformReleaseRequiredModuleRequirementV2,
} from "./platform-release-required-module-closure-v2.js";
import {
  PlatformReleaseRequiredModuleClosureProbeV2Schema,
  type PlatformReleaseRequiredModuleClosureProbeV2,
} from "./platform-release-bootstrap-required-module-closure-probe-v2.js";
import {
  EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA,
  EvidenceAdapterDefinitionCatalogV2Schema,
  getEvidenceAdapterDefinitionCatalogV2,
} from "../../evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import {
  PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA,
  PlatformEvidenceDefinitionCatalogsV2Schema,
  getPlatformEvidenceDefinitionCatalogsV2,
} from "./platform-evidence-definition-catalogs-v2.js";
import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
  ProductDeliveryProfileCatalogV2Schema,
  getProductDeliveryProfileCatalogV2,
} from "../../product-compiler/product-delivery-profile-catalog-v2.js";
import {
  INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2,
  InvocationTransportCodecCatalogV2Schema,
  getInvocationTransportCodecCatalogV2,
} from "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  EVIDENCE_RECEIPT_ABI_POLICY_V2_SCHEMA,
  EvidenceReceiptAbiPolicyCandidateV2Schema,
  getEvidenceReceiptAbiPolicyV2,
} from "../../evidence/schemas/evidence-receipt-v2.js";
import {
  NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_CLI_BOOTSTRAP_SOURCE_V2,
} from "./node-cli-launcher-v2.js";
import {
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2,
} from "./node-express-api-launcher-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-semantic-projection.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-semantic-projection-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_ENTRY_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-semantic-projection-entry-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-semantic-projection-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_MAX_CANONICAL_BYTES_V2 =
  2 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_PAYLOAD_BINDING_V2 =
  "typescript_source_semantics_fixture_only_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_IMPLEMENTATION_SCOPE_V2 =
  "test_fixture_source_semantics_projection_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_OBSERVATION_OUTCOME_V2 =
  "all_required_source_semantics_projected" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_SOURCE_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-required-module-semantic-projection-source-observation-hash.v2" as const;

const ExportKindV2Schema = z.enum([
  "function",
  "string",
  "number",
  "boolean",
  "object",
  "undefined",
  "symbol",
  "bigint",
]);
const ExportV2Schema = z.object({
  name: z.string().min(1).max(160).regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u),
  kind: ExportKindV2Schema,
}).strict();
const ExportListV2Schema = z.array(ExportV2Schema).min(1).max(512)
  .superRefine((value, context) => {
    for (let index = 1; index < value.length; index += 1) {
      if (value[index - 1]!.name >= value[index]!.name) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: "Source exports must be strictly UTF-16 sorted",
        });
      }
    }
  });

const CatalogProjectionV2Schema = z.union([
  EvidenceAdapterDefinitionCatalogV2Schema,
  PlatformEvidenceDefinitionCatalogsV2Schema,
  ProductDeliveryProfileCatalogV2Schema,
  InvocationTransportCodecCatalogV2Schema,
  EvidenceReceiptAbiPolicyCandidateV2Schema,
]);

type CatalogProjectionV2 = z.infer<typeof CatalogProjectionV2Schema>;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const CanonicalModeV2Schema = z.string().regex(/^[0-7]{4}$/u);
const SourceStableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.literal("ordinary_file"),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();
const SourceMutableFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: CanonicalModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().positive().safe().max(8 * 1024 * 1024),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();
const SourceModuleObservationV2Schema = z.object({
  stableIdentity: SourceStableIdentityV2Schema,
  mutableFingerprint: SourceMutableFingerprintV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (value.observationHash !== hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_SOURCE_OBSERVATION_HASH_V2_SCHEMA,
    observation: identity,
  })) {
    context.addIssue({ code: "custom", path: ["observationHash"], message: "Source physical observation hash mismatch" });
  }
});

const SemanticEvidenceV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bootstrap_source_hash_pair_v2"),
    sourceHash: Sha256Schema,
    exportedSourceHash: Sha256Schema,
    sourceByteLength: z.number().int().positive().safe(),
    sourceHashMatches: z.literal(true),
  }).strict(),
  z.object({
    kind: z.literal("manifest_catalog_projection_v2"),
    catalogSchema: z.string().min(1).max(200),
    catalogHash: Sha256Schema,
    catalogProjection: CatalogProjectionV2Schema,
    readiness: z.enum(["shadow_blocked", "ready"]),
    productionUse: z.literal("forbidden"),
    blockerCodes: z.array(z.string().min(1).max(160)).max(64),
  }).strict(),
  z.object({
    kind: z.literal("function_export_presence_v2"),
    presentExports: z.array(ExportV2Schema).min(1).max(64),
  }).strict(),
  z.object({
    kind: z.literal("test_fixture_runtime_blocked_v2"),
    blocker: z.literal("test_fixture_runtime_blocked"),
  }).strict(),
]);

type SemanticEvidenceV2 = z.infer<typeof SemanticEvidenceV2Schema>;

function semanticEvidenceHashV2(value: SemanticEvidenceV2): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_V2_SCHEMA}.evidence.v2`,
    evidence: value,
  });
}

const EntryIdentityV2Schema = z.object({
  role: PlatformReleaseRequiredModuleRoleV2Schema,
  sourceModuleLocator: PlatformReleasePortableLocatorV2Schema.refine(
    (value) => value.startsWith("src/") && value.endsWith(".ts"),
    "Semantic projection source locator must be one TypeScript file below src",
  ),
  implementationUse: z.enum([
    "bootstrap_source",
    "code_owned_definition",
    "runtime",
    "test_fixture_runtime_blocked",
  ]),
  verificationPolicy: z.enum([
    "bootstrap_source_hash_pair_v2",
    "function_exports_present_v2",
    "manifest_adapter_definition_catalog_projection_v2",
    "manifest_evidence_definition_catalog_projection_v2",
    "manifest_profile_catalog_projection_v2",
    "manifest_receipt_abi_projection_v2",
    "manifest_transport_codec_catalog_projection_v2",
    "test_fixture_only_function_exports_present_v2",
  ]),
  moduleRefHash: Sha256Schema,
  sourceModuleHash: Sha256Schema,
  sourceModuleHashBefore: Sha256Schema,
  sourceModuleHashAfter: Sha256Schema,
  sourcePhysicalObservationBefore: SourceModuleObservationV2Schema,
  sourcePhysicalObservationAfter: SourceModuleObservationV2Schema,
  sourceExports: ExportListV2Schema,
  semanticEvidence: SemanticEvidenceV2Schema,
  semanticEvidenceHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const entry = { ...value } as Record<string, unknown>;
  delete entry.entryHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_ENTRY_HASH_V2_SCHEMA,
    entry,
  });
}

const EntryV2Schema = EntryIdentityV2Schema.extend({
  entryHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.semanticEvidenceHash !== semanticEvidenceHashV2(value.semanticEvidence)) {
    context.addIssue({ code: "custom", path: ["semanticEvidenceHash"], message: "Semantic evidence hash mismatch" });
  }
  if (value.sourceModuleHash !== value.sourceModuleHashBefore
      || value.sourceModuleHash !== value.sourceModuleHashAfter) {
    context.addIssue({ code: "custom", path: ["sourceModuleHash"], message: "Source module hash must equal the before and after source fence" });
  }
  if (value.sourceModuleHash !== value.sourcePhysicalObservationBefore.mutableFingerprint.contentHash
      || value.sourceModuleHash !== value.sourcePhysicalObservationAfter.mutableFingerprint.contentHash
      || canonicalJsonStringify(value.sourcePhysicalObservationBefore) !== canonicalJsonStringify(value.sourcePhysicalObservationAfter)) {
    context.addIssue({ code: "custom", path: ["sourcePhysicalObservationBefore"], message: "Source module hash must bind one unchanged descriptor-bounded physical observation" });
  }
  const { entryHash: _entryHash, ...identity } = value;
  if (value.entryHash !== hashPlatformReleaseRequiredModuleSemanticProjectionEntryV2(identity)) {
    context.addIssue({ code: "custom", path: ["entryHash"], message: "Semantic projection entry hash mismatch" });
  }
  if (value.semanticEvidence.kind === "function_export_presence_v2") {
    const actual = new Map(value.sourceExports.map((entry) => [entry.name, entry.kind]));
    for (const required of value.semanticEvidence.presentExports) {
      if (actual.get(required.name) !== required.kind) {
        context.addIssue({ code: "custom", path: ["semanticEvidence", "presentExports"], message: "Required function export is absent or has the wrong kind" });
      }
    }
  }
});

export type PlatformReleaseRequiredModuleSemanticProjectionEntryV2 = z.infer<typeof EntryV2Schema>;

const ProbeIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_test_fixture_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  implementationScope: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_IMPLEMENTATION_SCOPE_V2),
  payloadBinding: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_PAYLOAD_BINDING_V2),
  requiredModuleClosureProbe: PlatformReleaseRequiredModuleClosureProbeV2Schema,
  requiredModuleRequirement: PlatformReleaseRequiredModuleRequirementV2Schema,
  challengeHash: Sha256Schema,
  observationOutcome: z.literal(PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_OBSERVATION_OUTCOME_V2),
  semanticEntries: z.array(EntryV2Schema).length(17),
  semanticCatalogHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const requirement = getPlatformReleaseRequiredModuleRequirementV2();
  if (canonicalJsonStringify(value.requiredModuleRequirement) !== canonicalJsonStringify(requirement)) {
    context.addIssue({ code: "custom", path: ["requiredModuleRequirement"], message: "Semantic projection must bind the exact code-owned requirement" });
  }
  if (value.requiredModuleClosureProbe.requiredModuleClosure.requirementHash !== requirement.requirementHash) {
    context.addIssue({ code: "custom", path: ["requiredModuleClosureProbe"], message: "Physical closure probe requirement does not join the semantic requirement" });
  }
  if (value.challengeHash !== value.requiredModuleClosureProbe.challengeHash) {
    context.addIssue({ code: "custom", path: ["challengeHash"], message: "Semantic projection must join the physical probe challenge" });
  }
  const physicalKeys = new Set<string>();
  for (const entry of value.requiredModuleClosureProbe.entries) {
    for (const occurrence of entry.occurrences) {
      const stable = occurrence.moduleObservation.stableIdentity;
      physicalKeys.add(`${stable.hostIdentityHash}:${stable.objectKind}:${stable.device}:${stable.inode}`);
    }
  }
  const sourceKeys = new Set<string>();
  for (const [index, entry] of value.semanticEntries.entries()) {
    const stable = entry.sourcePhysicalObservationBefore.stableIdentity;
    const key = `${stable.hostIdentityHash}:${stable.objectKind}:${stable.device}:${stable.inode}`;
    if (stable.hostIdentityHash !== value.requiredModuleClosureProbe.hostIdentityHash) {
      context.addIssue({ code: "custom", path: ["semanticEntries", index, "sourcePhysicalObservationBefore", "stableIdentity", "hostIdentityHash"], message: "Source observation must join the physical probe host identity" });
    }
    if (sourceKeys.has(key) || physicalKeys.has(key)) {
      context.addIssue({ code: "custom", path: ["semanticEntries", index, "sourcePhysicalObservationBefore", "stableIdentity"], message: "Source and output observations must have globally unique physical identities" });
    }
    sourceKeys.add(key);
  }
  const definitionByRole = new Map(requirement.entries.map((definition) => [definition.role, definition]));
  const physicalByRole = new Map(value.requiredModuleClosureProbe.entries.map((entry) => [entry.role, entry]));
  for (const [index, entry] of value.semanticEntries.entries()) {
    const definition = requirement.entries[index] as PlatformReleaseRequiredModuleDefinitionV2 | undefined;
    const physical = physicalByRole.get(entry.role);
    if (definition === undefined || definition.role !== entry.role || definition.sourceModuleLocator !== entry.sourceModuleLocator || definition.implementationUse !== entry.implementationUse || definition.verificationPolicy !== entry.verificationPolicy || physical === undefined || physical.moduleRef.moduleRefHash !== entry.moduleRefHash) {
      context.addIssue({ code: "custom", path: ["semanticEntries", index], message: "Semantic projection entry does not join the canonical role, definition, and physical module ref" });
    }
    if (definitionByRole.get(entry.role) === undefined) {
      context.addIssue({ code: "custom", path: ["semanticEntries", index, "role"], message: "Unknown semantic projection role" });
    }
    const expectedKind = definition?.verificationPolicy === "bootstrap_source_hash_pair_v2"
      ? "bootstrap_source_hash_pair_v2"
      : definition?.verificationPolicy === "manifest_adapter_definition_catalog_projection_v2"
        || definition?.verificationPolicy === "manifest_evidence_definition_catalog_projection_v2"
        || definition?.verificationPolicy === "manifest_profile_catalog_projection_v2"
        || definition?.verificationPolicy === "manifest_receipt_abi_projection_v2"
        || definition?.verificationPolicy === "manifest_transport_codec_catalog_projection_v2"
        ? "manifest_catalog_projection_v2"
        : definition?.verificationPolicy === "test_fixture_only_function_exports_present_v2"
          ? "test_fixture_runtime_blocked_v2"
          : "function_export_presence_v2";
    if (entry.semanticEvidence.kind !== expectedKind) {
      context.addIssue({ code: "custom", path: ["semanticEntries", index, "semanticEvidence", "kind"], message: "Semantic evidence kind does not implement its code-owned verification policy" });
    }
    if (entry.semanticEvidence.kind === "bootstrap_source_hash_pair_v2" && definition !== undefined) {
      const source = definition.role === "bootstrap_cli"
        ? NODE_CLI_BOOTSTRAP_SOURCE_V2
        : NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2;
      const sourceHash = createHash("sha256").update(source, "utf8").digest("hex");
      const exportedHash = definition.role === "bootstrap_cli"
        ? NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2
        : NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2;
      if (entry.semanticEvidence.sourceHash !== sourceHash
          || entry.semanticEvidence.exportedSourceHash !== exportedHash
          || sourceHash !== exportedHash
          || entry.semanticEvidence.sourceByteLength !== Buffer.byteLength(source, "utf8")) {
        context.addIssue({ code: "custom", path: ["semanticEntries", index, "semanticEvidence"], message: "Bootstrap semantic evidence must equal the code-owned source/hash pair" });
      }
    }
    if (entry.semanticEvidence.kind === "manifest_catalog_projection_v2" && definition !== undefined) {
      const expectedCatalog: unknown = definition.verificationPolicy === "manifest_adapter_definition_catalog_projection_v2"
        ? getEvidenceAdapterDefinitionCatalogV2()
        : definition.verificationPolicy === "manifest_evidence_definition_catalog_projection_v2"
          ? getPlatformEvidenceDefinitionCatalogsV2()
          : definition.verificationPolicy === "manifest_profile_catalog_projection_v2"
            ? getProductDeliveryProfileCatalogV2()
            : definition.verificationPolicy === "manifest_transport_codec_catalog_projection_v2"
              ? getInvocationTransportCodecCatalogV2()
              : getEvidenceReceiptAbiPolicyV2();
      const projection = entry.semanticEvidence.catalogProjection as CatalogProjectionV2;
      const expectedHash = "policyHash" in projection ? projection.policyHash : projection.catalogHash;
      const expectedCatalogRecord = expectedCatalog as CatalogProjectionV2;
      const expectedCatalogHash = "policyHash" in expectedCatalogRecord
        ? expectedCatalogRecord.policyHash
        : expectedCatalogRecord.catalogHash;
      if (canonicalJsonStringify(projection) !== canonicalJsonStringify(expectedCatalog)
          || entry.semanticEvidence.catalogSchema !== expectedCatalogRecord.schema
          || entry.semanticEvidence.catalogHash !== expectedCatalogHash
          || expectedHash !== expectedCatalogHash) {
        context.addIssue({ code: "custom", path: ["semanticEntries", index, "semanticEvidence", "catalogProjection"], message: "Catalog semantic evidence must equal the exact code-owned catalog projection" });
      }
      const expectedReadiness = expectedCatalogRecord.schema === EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA
        || expectedCatalogRecord.schema === PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA
        ? expectedCatalogRecord.readiness
        : "shadow_blocked";
      const expectedBlockerCodes = expectedCatalogRecord.schema === EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA
        || expectedCatalogRecord.schema === PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA
        ? expectedCatalogRecord.blockerCodes
        : ["SEMANTIC_PROJECTION_TEST_FIXTURE_ONLY"];
      if (entry.semanticEvidence.readiness !== expectedReadiness
          || entry.semanticEvidence.productionUse !== "forbidden"
          || canonicalJsonStringify(entry.semanticEvidence.blockerCodes)
            !== canonicalJsonStringify(expectedBlockerCodes)) {
        context.addIssue({ code: "custom", path: ["semanticEntries", index, "semanticEvidence"], message: "Catalog semantic evidence readiness and blocker projection mismatch" });
      }
    }
  }
  const expectedCatalogHash = hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(value.semanticEntries);
  if (value.semanticCatalogHash !== expectedCatalogHash) {
    context.addIssue({ code: "custom", path: ["semanticCatalogHash"], message: "Semantic projection catalog hash mismatch" });
  }
});

export type PlatformReleaseRequiredModuleSemanticProjectionHashPayloadV2 = z.infer<typeof ProbeIdentityV2Schema>;

export function hashPlatformReleaseRequiredModuleSemanticProjectionEvidenceV2(value: SemanticEvidenceV2): string {
  return semanticEvidenceHashV2(value);
}

export function hashPlatformReleaseRequiredModuleSemanticProjectionCatalogV2(
  entries: readonly PlatformReleaseRequiredModuleSemanticProjectionEntryV2[],
): string {
  return hashCanonicalJson({
    schema: `${PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_V2_SCHEMA}.catalog.v2`,
    entries,
  });
}

export function hashPlatformReleaseRequiredModuleSemanticProjectionV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const projection = { ...value } as Record<string, unknown>;
  delete projection.probeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_HASH_V2_SCHEMA,
    projection,
  });
}

export function hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const observation = { ...value } as Record<string, unknown>;
  delete observation.observationHash;
  delete observation.probeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_OBSERVATION_HASH_V2_SCHEMA,
    observation,
  });
}

export const PlatformReleaseRequiredModuleSemanticProjectionV2Schema =
  ProbeIdentityV2Schema.extend({
    observationHash: Sha256Schema,
    probeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(value, PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_MAX_CANONICAL_BYTES_V2)) {
      context.addIssue({ code: "custom", message: "Semantic projection exceeds its canonical byte cap" });
    }
    const expectedObservationHash = hashPlatformReleaseRequiredModuleSemanticProjectionObservationV2(value);
    if (value.observationHash !== expectedObservationHash) {
      context.addIssue({ code: "custom", path: ["observationHash"], message: "Semantic projection observation hash mismatch" });
    }
    if (value.probeHash !== hashPlatformReleaseRequiredModuleSemanticProjectionV2(value)) {
      context.addIssue({ code: "custom", path: ["probeHash"], message: "Semantic projection probe hash mismatch" });
    }
  });

export type PlatformReleaseRequiredModuleSemanticProjectionV2 = z.infer<typeof PlatformReleaseRequiredModuleSemanticProjectionV2Schema>;

export function parsePlatformReleaseRequiredModuleSemanticProjectionCandidateV2(input: unknown): PlatformReleaseRequiredModuleSemanticProjectionV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(input, PLATFORM_RELEASE_BOOTSTRAP_REQUIRED_MODULE_SEMANTIC_PROJECTION_MAX_CANONICAL_BYTES_V2);
  return deepFreezePlatformReleaseJsonV2(PlatformReleaseRequiredModuleSemanticProjectionV2Schema.parse(snapshot));
}

export type PlatformReleaseRequiredModuleSemanticProjectionExportV2 = z.infer<typeof ExportV2Schema>;
export type PlatformReleaseRequiredModuleSemanticProjectionEvidenceV2 = SemanticEvidenceV2;
export type PlatformReleaseRequiredModuleSemanticProjectionPhysicalProbeV2 = PlatformReleaseRequiredModuleClosureProbeV2;
