import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";

import {
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2,
} from
  "../execution/schemas/platform-release-bootstrap-operation-abis-v2.js";
import {
  deepFreezePlatformReleaseJsonV2,
} from "../execution/schemas/platform-release-common-v2.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "./canonical-json.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
  buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2,
  hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2,
  hashNodeToolchainProvisionerBootstrapRollbackBasenameBindingV2,
  type NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2,
} from
  "./node-toolchain-provisioner-bootstrap-lifecycle-semantic-snapshot-v2.js";
import {
  mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2,
  type PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2,
} from
  "./platform-release-bootstrap-darwin-aggregate-recursive-census-fixture-v2.js";
import {
  buildNodeLiveObservationAckFrameV2,
  buildNodeLiveObservationFrameV2,
  buildNodeLiveObservationSessionOpenFrameV2,
  type PlatformReleaseBootstrapNodeLiveObservationAckFrameV2,
  type PlatformReleaseBootstrapNodeLiveObservationFrameV2,
  type PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2,
} from
  "./platform-release-bootstrap-node-live-observation-session-contract-v2.js";
import {
  type NamespacePhysicalEntryCaptureV2,
} from "./platform-release-bootstrap-physical-census-v2.js";
import {
  type PlatformReleaseBootstrapNamespaceClassificationV2,
} from "./platform-release-bootstrap-registry-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA,
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA,
  NodeToolchainProvisionerBootstrapInstallationClaimV2Schema,
  NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackHistoryV2,
  type NodeToolchainProvisionerBootstrapInstallationClaimV2,
  type NodeToolchainProvisionerBootstrapInstallationReceiptV2,
} from
  "./schemas/node-toolchain-provisioner-bootstrap-installation-state-v2.js";
import {
  NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA,
  NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema,
  buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2,
  type NodeToolchainProvisionerBootstrapRollbackReceiptV2,
} from "./schemas/node-toolchain-provisioner-bootstrap-rollback-v2.js";

const PREPARATION_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-node-recursive-semantic-preparation-fixture.v2";
const PREPARATION_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-recursive-semantic-preparation-fixture-hash.v2";
const SESSION_OCCURRENCE_HASH_DOMAIN_V2 =
  "setfarm.platform-release-bootstrap-node-recursive-semantic-session-occurrence-hash.v2";
const AUTHORITY_PHASE_V2 = "pre_ack_preparation_only_v2";
const AUTHORITY_ASSERTION_V2 = "fixture_self_asserted_v2";
const AUTHORITY_COMPLETION_V2 =
  "requires_post_terminal_native_rejoin_v2";
const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 1024 * 1024;
const MAX_TOTAL_ARTIFACT_BYTES = 8 * 1024 * 1024;
const ENTRY_SCHEMA_V2 =
  "setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2";
const NODE_PACKAGE_REF: "BOOTSTRAP_NODE_TOOLCHAIN_PROVISIONER_V2" =
  PLATFORM_RELEASE_BOOTSTRAP_PACKAGE_REFS_V2.nodeToolchainProvisioner;

type JsonRecord = Record<string, unknown>;

type ArtifactEvidence<T> = Readonly<{
  classification: PlatformReleaseBootstrapNamespaceClassificationV2;
  entryCapture: NamespacePhysicalEntryCaptureV2;
  rawBytesHash: string;
  value: T;
}>;

type RollbackArtifactEvidence = ArtifactEvidence<
  NodeToolchainProvisionerBootstrapRollbackReceiptV2
> & Readonly<{ rollbackBasenameBindingHash: string }>;

export type PlatformReleaseBootstrapNodeRecursiveSemanticPreparationFixtureV2 =
  Readonly<{
    schema: typeof PREPARATION_SCHEMA_V2;
    admissionScope: "test_fixture";
    productionAuthority: false;
    authority: Readonly<{
      phase: typeof AUTHORITY_PHASE_V2;
      assertion: typeof AUTHORITY_ASSERTION_V2;
      completion: typeof AUTHORITY_COMPLETION_V2;
    }>;
    mapping:
      PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2;
    open: PlatformReleaseBootstrapNodeLiveObservationSessionOpenFrameV2;
    observation: PlatformReleaseBootstrapNodeLiveObservationFrameV2;
    semanticSnapshot:
      NodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2;
    acknowledgement: PlatformReleaseBootstrapNodeLiveObservationAckFrameV2;
    semanticAckSha256: string;
    preparationHash: string;
  }>;

export class PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2
  extends TypeError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name =
      "PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2";
  }
}

function fail(message: string, cause?: unknown): never {
  throw new PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2(
    message,
    cause === undefined ? {} : { cause },
  );
}

const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(
  Uint8Array.prototype,
) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)!.get!;
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)!.get!;

function ownedExactBytes(
  value: unknown,
  maximum: number,
  label: string,
  exactLength?: number,
): Buffer {
  if (
    value === null
    || typeof value !== "object"
    || nodeUtilTypes.isProxy(value)
    || (
      Object.getPrototypeOf(value) !== Buffer.prototype
      && Object.getPrototypeOf(value) !== Uint8Array.prototype
    )
    || ["buffer", "byteLength", "byteOffset", "length"].some(
      (key) => Object.getOwnPropertyDescriptor(value, key) !== undefined,
    )
  ) {
    return fail(`${label} must be an exact unshadowed byte array`);
  }
  let buffer: unknown;
  let byteLength: unknown;
  let byteOffset: unknown;
  try {
    buffer = TYPED_ARRAY_BUFFER_GETTER.call(value);
    byteLength = TYPED_ARRAY_BYTE_LENGTH_GETTER.call(value);
    byteOffset = TYPED_ARRAY_BYTE_OFFSET_GETTER.call(value);
  } catch (error) {
    return fail(`${label} byte-array intrinsics failed`, error);
  }
  if (
    nodeUtilTypes.isProxy(buffer)
    || !(buffer instanceof ArrayBuffer)
    || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    || Object.getOwnPropertyDescriptor(buffer, "byteLength") !== undefined
  ) {
    return fail(`${label} backing buffer is foreign or shadowed`);
  }
  let backingByteLength: unknown;
  try {
    backingByteLength = ARRAY_BUFFER_BYTE_LENGTH_GETTER.call(buffer);
  } catch (error) {
    return fail(`${label} backing buffer intrinsic failed`, error);
  }
  if (
    typeof backingByteLength !== "number"
    || !Number.isSafeInteger(backingByteLength)
    || backingByteLength < 0
    || typeof byteLength !== "number"
    || !Number.isSafeInteger(byteLength)
    || byteLength < 0
    || byteLength > maximum
    || (exactLength !== undefined && byteLength !== exactLength)
    || typeof byteOffset !== "number"
    || !Number.isSafeInteger(byteOffset)
    || byteOffset < 0
    || byteOffset + byteLength > backingByteLength
  ) {
    return fail(`${label} violates its exact pre-copy byte bound`);
  }
  try {
    return Buffer.from(new Uint8Array(buffer, byteOffset, byteLength));
  } catch (error) {
    return fail(`${label} could not be snapshotted`, error);
  }
}

function snapshotInput(input: unknown): Readonly<{
  challenge: Buffer;
  aggregateRecursiveEvidenceStream: Buffer;
}> {
  if (
    input === null
    || typeof input !== "object"
    || nodeUtilTypes.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return fail("Semantic bridge input must be one exact plain record");
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = ["challenge", "aggregateRecursiveEvidenceStream"] as const;
  if (
    Reflect.ownKeys(descriptors).length !== keys.length
    || keys.some((key, index) => {
      const descriptor = descriptors[key];
      return Object.keys(input)[index] !== key
        || descriptor === undefined
        || !("value" in descriptor)
        || !descriptor.enumerable;
    })
  ) {
    return fail("Semantic bridge input has accessors, reordered, or unknown fields");
  }
  let challenge: Buffer | undefined;
  try {
    challenge = ownedExactBytes(
      descriptors.challenge!.value,
      32,
      "Native challenge",
      32,
    );
    const aggregateRecursiveEvidenceStream = ownedExactBytes(
      descriptors.aggregateRecursiveEvidenceStream!.value,
      MAX_STREAM_BYTES,
      "Aggregate recursive evidence stream",
    );
    return Object.freeze({ challenge, aggregateRecursiveEvidenceStream });
  } catch (error) {
    challenge?.fill(0);
    throw error;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalBase64Bytes(
  value: unknown,
  expectedLength: unknown,
  label: string,
): Buffer {
  if (
    typeof expectedLength !== "number"
    || !Number.isSafeInteger(expectedLength)
    || expectedLength < 0
    || expectedLength > MAX_ARTIFACT_BYTES
    || typeof value !== "string"
    || value.length > Math.ceil(MAX_ARTIFACT_BYTES / 3) * 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
      .test(value)
  ) {
    return fail(`${label} is not bounded canonical base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.byteLength !== expectedLength
    || bytes.toString("base64") !== value
  ) {
    bytes.fill(0);
    return fail(`${label} does not round-trip to its declared byte length`);
  }
  return bytes;
}

function canonicalArtifactValue(bytes: Buffer, label: string): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    return fail(`${label} is not fatal strict UTF-8`, error);
  }
  if (text.includes("\n") || text.includes("\r")) {
    return fail(`${label} contains forbidden line whitespace`);
  }
  try {
    const value: unknown = JSON.parse(text);
    if (
      !isRecord(value)
      || canonicalJsonStringify(value) !== text
      || !Buffer.from(text, "utf8").equals(bytes)
    ) {
      return fail(`${label} is not exact canonical JSON bytes`);
    }
    return value;
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2
    ) {
      throw error;
    }
    return fail(`${label} JSON parsing failed`, error);
  }
}

function same(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function decodeBasename(value: unknown, label: string): string {
  const bytes = canonicalBase64Bytes(
    value,
    typeof value === "string" ? Buffer.from(value, "base64").byteLength : -1,
    label,
  );
  try {
    const basename = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (
      Buffer.from(basename, "utf8").equals(bytes)
      && basename !== "."
      && basename !== ".."
      && !basename.includes("/")
      && !basename.includes("\\")
      && !basename.includes("\0")
    ) {
      return basename;
    }
    return fail(`${label} is not one direct-child basename`);
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2
    ) throw error;
    return fail(`${label} is not strict UTF-8`, error);
  } finally {
    bytes.fill(0);
  }
}

type ExtractedArtifacts = Readonly<{
  claim: ArtifactEvidence<NodeToolchainProvisionerBootstrapInstallationClaimV2>;
  receipt: ArtifactEvidence<NodeToolchainProvisionerBootstrapInstallationReceiptV2>;
  rollbacks: readonly RollbackArtifactEvidence[];
}>;

function extractArtifacts(
  stream: Buffer,
  mapping: PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2,
): ExtractedArtifacts {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(stream);
  } catch (error) {
    return fail("Owned recursive evidence stream lost strict UTF-8", error);
  }
  const lines = text.slice(0, -1).split("\n");
  const namespaceFrames = lines.slice(3, -2).map((line) => {
    const parsed: unknown = JSON.parse(line);
    return isRecord(parsed)
      ? parsed
      : fail("Namespace frame is not one JSON object");
  });
  const captures =
    mapping.aggregateObservation.physicalCensus.orderedEntryCaptures;
  if (namespaceFrames.length !== captures.length) {
    return fail("Namespace frames do not positionally equal physical captures");
  }

  let claim: ExtractedArtifacts["claim"] | undefined;
  let receipt: ExtractedArtifacts["receipt"] | undefined;
  const rollbacks: RollbackArtifactEvidence[] = [];
  const ownedArtifacts: Buffer[] = [];
  let totalArtifactBytes = 0;
  try {
    for (let index = 0; index < namespaceFrames.length; index += 1) {
      const frame = namespaceFrames[index]!;
      const capture = captures[index]!;
      if (frame.schema !== ENTRY_SCHEMA_V2) {
        return fail(`Namespace frame ${index} is not an entry frame`);
      }
      const basename = decodeBasename(
        frame.basenameBase64,
        `Namespace frame ${index} basename`,
      );
      if (basename !== capture.classification.basename) {
        return fail(`Namespace frame ${index} is spliced from its capture`);
      }
      const category = capture.classification.category;
      if (
        capture.classification.ownerKind !== "package"
        || capture.classification.ownerRef !== NODE_PACKAGE_REF
      ) continue;
      if (
        category !== "active_claim"
        && category !== "active_receipt"
        && category !== "rollback_receipt"
      ) continue;
      if (
        capture.objectIdentity.objectKind !== "ordinary_file"
        || capture.contentEvidence.kind !== "bounded_regular_file_bytes"
      ) {
        return fail(`${category} is foreign to the exact Node file capture`);
      }
      const content = isRecord(frame.content)
        ? frame.content
        : fail(`${category} content is not one object`);
      if (content.kind !== "bounded_regular_file_bytes") {
        return fail(`${category} is not backed by bounded file bytes`);
      }
      const bytes = canonicalBase64Bytes(
        content.contentBase64,
        content.byteLength,
        `${category} bytes`,
      );
      ownedArtifacts.push(bytes);
      totalArtifactBytes += bytes.byteLength;
      if (totalArtifactBytes > MAX_TOTAL_ARTIFACT_BYTES) {
        return fail("Canonical lifecycle artifact bytes exceed 8 MiB total");
      }
      const rawBytesHash = createHash("sha256").update(bytes).digest("hex");
      if (
        rawBytesHash !== capture.contentEvidence.rawContentHash
        || bytes.byteLength !== capture.fingerprint.byteLength
      ) {
        return fail(`${category} bytes do not join their physical capture`);
      }
      const candidate = canonicalArtifactValue(bytes, category);
      if (rawBytesHash !== hashCanonicalJson(candidate)) {
        return fail(`${category} canonical value hash is not its raw hash`);
      }
      const common = {
        classification: capture.classification,
        entryCapture: capture,
        rawBytesHash,
      } as const;
      if (category === "active_claim") {
        if (claim !== undefined) return fail("Active claim is duplicated");
        const value =
          NodeToolchainProvisionerBootstrapInstallationClaimV2Schema.parse(
            candidate,
          );
        if (value.schema !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_CLAIM_V2_SCHEMA) {
          return fail("Active claim schema is foreign");
        }
        claim = Object.freeze({ ...common, value });
      } else if (category === "active_receipt") {
        if (receipt !== undefined) return fail("Active receipt is duplicated");
        const value =
          NodeToolchainProvisionerBootstrapInstallationReceiptV2Schema.parse(
            candidate,
          );
        if (value.schema !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_INSTALLATION_RECEIPT_V2_SCHEMA) {
          return fail("Active receipt schema is foreign");
        }
        receipt = Object.freeze({ ...common, value });
      } else {
        const value =
          NodeToolchainProvisionerBootstrapRollbackReceiptV2Schema.parse(
            candidate,
          );
        if (value.schema !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROLLBACK_RECEIPT_V2_SCHEMA) {
          return fail("Rollback receipt schema is foreign");
        }
        rollbacks.push(Object.freeze({
          ...common,
          value,
          rollbackBasenameBindingHash:
            hashNodeToolchainProvisionerBootstrapRollbackBasenameBindingV2({
              basename: capture.classification.basename,
              rollbackReceiptHash: value.receiptHash,
              removedInstallationReceiptHash:
                value.removedGeneration.installationReceiptHash,
            }),
        }));
      }
    }
    if (claim === undefined || receipt === undefined) {
      return fail("Ready census is missing its active claim or receipt");
    }
    if (
      rollbacks.some((entry, index) =>
        index > 0
        && rollbacks[index - 1]!.classification.basename
          >= entry.classification.basename)
    ) {
      return fail("Rollback receipts are not in global namespace order");
    }
    return Object.freeze({
      claim,
      receipt,
      rollbacks: Object.freeze(rollbacks),
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2
    ) throw error;
    return fail("Lifecycle artifact extraction failed", error);
  } finally {
    for (const bytes of ownedArtifacts) bytes.fill(0);
  }
}

function requireReadyProjection(
  mapping: PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2,
): void {
  if (
    mapping.semanticReady !== false
    || mapping.recursiveEvidence.status !== "complete"
    || mapping.recursiveEvidence.orderedEntries.length !== 8
    || mapping.aggregateObservation.nodeLogicalProjection.packageRef
      !== NODE_PACKAGE_REF
  ) {
    return fail("Semantic preparation requires one complete non-semantic mapping");
  }
  const categories = mapping.aggregateObservation.nodePhysicalProjection
    .orderedEntryCaptures.map((capture) => capture.classification.category);
  const count = (category: string) =>
    categories.filter((candidate) => candidate === category).length;
  if (
    count("package_lock") !== 1
    || count("package_root") !== 1
    || count("active_claim") !== 1
    || count("active_receipt") !== 1
    || count("generation_staging") !== 0
    || count("rollback_claim") !== 0
    || categories.some((category) =>
      category !== "package_lock"
      && category !== "package_root"
      && category !== "active_claim"
      && category !== "active_receipt"
      && category !== "rollback_receipt")
  ) {
    return fail("Node lifecycle projection is not one exact ready-only census");
  }
}

function sessionOccurrenceHash(
  challenge: Buffer,
  mapping: PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2,
): string {
  return hashCanonicalJson({
    schema: SESSION_OCCURRENCE_HASH_DOMAIN_V2,
    nativeChallengeHex: challenge.toString("hex"),
    rawStreamHash: mapping.rawStreamHash,
    mappingHash: mapping.mappingHash,
  });
}

function buildTreeEntries(
  mapping: PlatformReleaseBootstrapDarwinAggregateRecursiveCensusFixtureMappingV2,
  receipt: NodeToolchainProvisionerBootstrapInstallationReceiptV2,
) {
  const expected =
    buildNodeToolchainProvisionerBootstrapRollbackTreeEntriesV2(receipt);
  return mapping.recursiveEvidence.orderedEntries.map((entry, index) => {
    const common = {
      role: entry.role,
      parentObjectIdentityHash: entry.parentObjectIdentityHash,
      objectIdentity: entry.objectIdentity,
      fingerprint: entry.fingerprint,
      treeEntry: expected[index]!,
    } as const;
    return entry.content.kind === "directory_membership"
      ? Object.freeze({
          kind: "directory" as const,
          ...common,
          membership: entry.content.membership,
        })
      : Object.freeze({
          kind: "file" as const,
          ...common,
          rawContentHash: entry.content.rawContentHash,
        });
  });
}

function heldLockInput<
  Role extends
    "shared_registry_parent_lock" | "registered_node_package_lock",
>(
  role: Role,
  capture: NamespacePhysicalEntryCaptureV2,
) {
  if (capture.contentEvidence.kind !== "bounded_regular_file_bytes") {
    return fail(`${role} is not one bounded fixed-content file`);
  }
  return {
    lockRole: role,
    lockMode: "exclusive_advisory_held" as const,
    descriptorUse: "read_only_observation_only" as const,
    basename: capture.classification.basename,
    classification: capture.classification,
    parentObjectIdentityHash: capture.parentObjectIdentityHash,
    objectIdentity: capture.objectIdentity,
    fingerprint: capture.fingerprint,
    contentHash: capture.contentEvidence.rawContentHash,
  };
}

function preparationHash(
  identity: Omit<
    PlatformReleaseBootstrapNodeRecursiveSemanticPreparationFixtureV2,
    "preparationHash"
  >,
): string {
  return hashCanonicalJson({
    schema: PREPARATION_HASH_DOMAIN_V2,
    preparation: {
      schema: identity.schema,
      admissionScope: identity.admissionScope,
      productionAuthority: identity.productionAuthority,
      authority: identity.authority,
      mappingHash: identity.mapping.mappingHash,
      openFrameHash: identity.open.frameHash,
      openTranscriptHash: identity.open.transcriptHash,
      observationFrameHash: identity.observation.frameHash,
      observationTranscriptHash: identity.observation.transcriptHash,
      semanticSnapshotHash: identity.semanticSnapshot.snapshotHash,
      semanticVerifierContractHash:
        identity.semanticSnapshot.semanticVerifierContractHash,
      semanticStatus: identity.semanticSnapshot.status,
      acknowledgementFrameHash: identity.acknowledgement.frameHash,
      acknowledgementTranscriptHash:
        identity.acknowledgement.transcriptHash,
      semanticAckSha256: identity.semanticAckSha256,
    },
  });
}

export function preparePlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureV2(
  input: unknown,
): PlatformReleaseBootstrapNodeRecursiveSemanticPreparationFixtureV2 {
  const snapshot = snapshotInput(input);
  try {
    const mapping =
      mapPlatformReleaseBootstrapDarwinAggregateRecursiveCensusEvidenceStreamV2(
        snapshot.aggregateRecursiveEvidenceStream,
      );
    requireReadyProjection(mapping);
    const artifacts = extractArtifacts(
      snapshot.aggregateRecursiveEvidenceStream,
      mapping,
    );
    const aggregate = mapping.aggregateObservation;
    const captures = aggregate.physicalCensus.orderedEntryCaptures;
    const sharedLocks = captures.filter((capture) =>
      capture.classification.category === "shared_parent_lock");
    const nodeLocks = captures.filter((capture) =>
      capture.classification.ownerKind === "package"
      && capture.classification.ownerRef === NODE_PACKAGE_REF
      && capture.classification.category === "package_lock");
    const roots = captures.filter((capture) =>
      capture.classification.ownerKind === "package"
      && capture.classification.ownerRef === NODE_PACKAGE_REF
      && capture.classification.category === "package_root");
    if (
      sharedLocks.length !== 1
      || nodeLocks.length !== 1
      || roots.length !== 1
      || !same(
        sharedLocks[0]!.objectIdentity,
        aggregate.heldLocks.sharedParentLock.objectIdentity,
      )
      || !same(
        nodeLocks[0]!.objectIdentity,
        aggregate.heldLocks.registeredNodePackageLock.objectIdentity,
      )
      || aggregate.physicalCensus.parentFingerprint.mode !== "0755"
    ) {
      return fail("Parent, root, and held-lock live boundary is not exact");
    }
    const occurrenceHash = sessionOccurrenceHash(snapshot.challenge, mapping);
    const open = buildNodeLiveObservationSessionOpenFrameV2({
      sessionOccurrenceHash: occurrenceHash,
      filesystemScope: aggregate.filesystemScope,
      parent: {
        objectIdentity: aggregate.physicalCensus.parentObjectIdentity,
        fingerprint: aggregate.physicalCensus.parentFingerprint,
      },
      heldLocks: [
        heldLockInput("shared_registry_parent_lock", sharedLocks[0]!),
        heldLockInput("registered_node_package_lock", nodeLocks[0]!),
      ],
    });
    const rollbackHistory =
      buildNodeToolchainProvisionerBootstrapRollbackHistoryV2(
        artifacts.rollbacks.map((evidence) => ({
          installationReceiptHash:
            evidence.value.removedGeneration.installationReceiptHash,
          rollbackReceiptHash: evidence.value.receiptHash,
          rollbackReceiptLocatorHash: evidence.value.receiptFile.locatorHash,
        })),
      );
    const orderedTreeEntries = buildTreeEntries(mapping, artifacts.receipt.value);
    const activeGeneration = {
      claim: artifacts.claim,
      receipt: artifacts.receipt,
      packageRoot: {
        objectIdentity: roots[0]!.objectIdentity,
        fingerprint: roots[0]!.fingerprint,
      },
      orderedTreeEntries,
    } as const;
    const recursiveEvidenceHash =
      hashNodeToolchainProvisionerBootstrapRecursiveEvidenceV2({
        status: "ready",
        packageRoot: activeGeneration.packageRoot,
        orderedTreeEntries,
      });
    const observation = buildNodeLiveObservationFrameV2(open, {
      globalPhysicalCensusHash: aggregate.physicalCensus.physicalCensusHash,
      nodeRecursiveEvidence: {
        evidenceHash: recursiveEvidenceHash,
        entryCount: orderedTreeEntries.length,
        complete: true,
      },
      sourceProjectionHashes: {
        logicalCensusHash: aggregate.logicalCensus.censusHash,
        physicalCensusHash: aggregate.physicalCensus.physicalCensusHash,
        nodePackageProjectionHash:
          aggregate.nodePhysicalProjection.projectionHash,
        nodePackageLockObjectIdentityHash:
          aggregate.nodePhysicalProjection.packageLockObjectIdentityHash,
      },
      globalPhysicalCensusLockBindings: {
        physicalCensusHash: aggregate.physicalCensus.physicalCensusHash,
        sharedParentLockCaptureBindingHash:
          open.heldLocks[0].captureBindingHash,
        nodePackageLockCaptureBindingHash:
          open.heldLocks[1].captureBindingHash,
      },
    });
    const nodeLock = nodeLocks[0]!;
    if (nodeLock.contentEvidence.kind !== "bounded_regular_file_bytes") {
      return fail("Node package lock content evidence is not bounded bytes");
    }
    const semanticSnapshot =
      buildNodeToolchainProvisionerBootstrapLifecycleSemanticSnapshotV2({
        schema:
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_SNAPSHOT_V2_SCHEMA,
        version: "2.0.0",
        packageRef: NODE_PACKAGE_REF,
        admissionScope: "test_fixture",
        productionAuthority: false,
        observationAuthority:
          "captured_evidence_requires_live_native_session_receipt_v2",
        semanticVerifierContractHash:
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_SEMANTIC_VERIFIER_CONTRACT_HASH_V2,
        nodeLifecycleIdentityHash:
          NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LIFECYCLE_IDENTITY_HASH_V2,
        filesystemScope: aggregate.filesystemScope,
        expectedOwner: {
          uid: aggregate.physicalCensus.parentFingerprint.ownerUid,
          gid: aggregate.physicalCensus.parentFingerprint.ownerGid,
        },
        sourceLogicalCensusHash: aggregate.logicalCensus.censusHash,
        sourcePhysicalCensusHash:
          aggregate.physicalCensus.physicalCensusHash,
        nodeLogicalProjection: {
          ...aggregate.nodeLogicalProjection,
          packageRef: NODE_PACKAGE_REF,
        },
        nodePhysicalProjection: aggregate.nodePhysicalProjection,
        nodePhysicalProjectionHash:
          aggregate.nodePhysicalProjection.projectionHash,
        liveObservationBinding: {
          sessionOccurrenceHash: occurrenceHash,
          observationTranscriptHash: observation.transcriptHash,
          globalPhysicalCensusHash:
            aggregate.physicalCensus.physicalCensusHash,
          nodeRecursiveEvidenceHash: recursiveEvidenceHash,
          rollbackLocatorAuthority:
            "basename_binding_only_locator_hash_requires_live_native_session_receipt_v2",
        },
        heldPackageLock: {
          objectIdentity: nodeLock.objectIdentity,
          fingerprint: nodeLock.fingerprint,
          rawContentHash: nodeLock.contentEvidence.rawContentHash,
        },
        rollbackReceipts: [...artifacts.rollbacks],
        rollbackHistory,
        status: "ready",
        activeGeneration,
      });
    const acknowledgement = buildNodeLiveObservationAckFrameV2(observation, {
      disposition: "accept_read_only",
      semanticSnapshot,
    });
    if (acknowledgement.disposition !== "accept_read_only") {
      return fail("Semantic preparation did not build an accepting ACK");
    }
    const identity = {
      schema: PREPARATION_SCHEMA_V2,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      authority: {
        phase: AUTHORITY_PHASE_V2,
        assertion: AUTHORITY_ASSERTION_V2,
        completion: AUTHORITY_COMPLETION_V2,
      },
      mapping,
      open,
      observation,
      semanticSnapshot,
      acknowledgement,
      semanticAckSha256: acknowledgement.frameHash,
    } as const;
    return deepFreezePlatformReleaseJsonV2({
      ...identity,
      preparationHash: preparationHash(identity),
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBootstrapNodeRecursiveSemanticBridgeFixtureErrorV2
    ) throw error;
    return fail("Recursive semantic preparation failed closed", error);
  } finally {
    snapshot.challenge.fill(0);
    snapshot.aggregateRecursiveEvidenceStream.fill(0);
  }
}
