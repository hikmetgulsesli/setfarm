import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  DEFAULT_ARTIFACT_CAPACITY_LIMITS,
} from "./artifact-capacity.js";
import {
  ArtifactPublicationBatchIdentityItemSchema,
  type ArtifactPublicationBatchIdentityItem,
} from "./artifact-publication-batch-identity.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonBytes } from "./canonical-json.js";
import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-envelope.js";
import type { ArtifactGetResult } from "./artifact-store.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_MAX_CHUNKS_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  parseByteBundleEnvelopeV1,
  parseByteChunkEnvelopeV1,
} from "./schemas/byte-bundle-v1.js";

export const ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1 =
  "setfarm.artifact-closure-registry.v1" as const;
export const PREPARED_ARTIFACT_CLOSURE_EVIDENCE_SET_SCHEMA_V1 =
  "setfarm.prepared-artifact-closure-evidence-set.v1" as const;
export const ARTIFACT_CLOSURE_EVIDENCE_SCHEMA_V1 =
  "setfarm.artifact-closure-evidence.v1" as const;
export const ARTIFACT_CLOSURE_MAX_MEMBERS_V1 = BYTE_BUNDLE_MAX_CHUNKS_V1 + 1;
export const ARTIFACT_CLOSURE_MAX_EVIDENCE_ITEMS_V1 = 100_000;

export const ARTIFACT_CLOSURE_REGISTRY_V1 = Object.freeze({
  schema: ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1,
  maxClosureMembers: ARTIFACT_CLOSURE_MAX_MEMBERS_V1,
  entries: Object.freeze([
    Object.freeze({
      artifactType: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
      kind: "dependency-root" as const,
      validator: "byte-bundle-v1" as const,
    }),
    Object.freeze({
      artifactType: BYTE_CHUNK_ARTIFACT_TYPE_V1,
      kind: "leaf" as const,
      validator: null,
    }),
  ]),
});

export type ArtifactClosureEvidenceErrorCode =
  | "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID"
  | "ARTIFACT_CLOSURE_EVIDENCE_CAPACITY_EXCEEDED"
  | "ARTIFACT_CLOSURE_EVIDENCE_DUPLICATE"
  | "ARTIFACT_CLOSURE_EVIDENCE_HASH_MISMATCH"
  | "ARTIFACT_CLOSURE_EVIDENCE_ENVELOPE_MISMATCH"
  | "ARTIFACT_CLOSURE_EVIDENCE_UNAUTHENTICATED";

export class ArtifactClosureEvidenceError extends Error {
  readonly code: ArtifactClosureEvidenceErrorCode;
  readonly artifactHash?: string;
  override readonly cause?: unknown;

  constructor(
    code: ArtifactClosureEvidenceErrorCode,
    message: string,
    options: Readonly<{ artifactHash?: string; cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "ArtifactClosureEvidenceError";
    this.code = code;
    this.artifactHash = options.artifactHash;
    this.cause = options.cause;
  }
}

export type ArtifactClosureRoleV1 = "leaf" | "dependency-root";

export type ArtifactClosureClassificationV1 =
  | "ARTIFACT_CLOSURE_VERIFIED"
  | "ARTIFACT_CLOSURE_ROOT_MISSING"
  | "ARTIFACT_CLOSURE_ROOT_IDENTITY_MISMATCH"
  | "ARTIFACT_CLOSURE_ROLE_MISMATCH"
  | "ARTIFACT_CLOSURE_VALIDATOR_REQUIRED"
  | "ARTIFACT_CLOSURE_ROOT_SCHEMA_INVALID"
  | "ARTIFACT_CLOSURE_DEPENDENCY_MISSING"
  | "ARTIFACT_CLOSURE_DEPENDENCY_DUPLICATE_CONFLICT"
  | "ARTIFACT_CLOSURE_DEPENDENCY_TYPE_MISMATCH"
  | "ARTIFACT_CLOSURE_DEPENDENCY_ENVELOPE_LENGTH_MISMATCH"
  | "ARTIFACT_CLOSURE_DEPENDENCY_SCHEMA_MISMATCH"
  | "ARTIFACT_CLOSURE_DEPENDENCY_RAW_HASH_MISMATCH"
  | "ARTIFACT_CLOSURE_DEPENDENCY_RAW_LENGTH_MISMATCH"
  | "ARTIFACT_CLOSURE_DEPENDENCY_ORDINAL_MISMATCH"
  | "ARTIFACT_CLOSURE_BUNDLE_RAW_HASH_MISMATCH"
  | "ARTIFACT_CLOSURE_BUNDLE_RAW_LENGTH_MISMATCH"
  | "ARTIFACT_CLOSURE_MEMBER_LIMIT_EXCEEDED";

const ArtifactClosureArtifactTypeV1Schema = z.string().min(1).max(200).regex(
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/,
  "Expected a versioned semantic artifact type",
);

const ArtifactClosureExpectedIdentityV1Schema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  artifactType: ArtifactClosureArtifactTypeV1Schema,
  byteLength: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).strict();

const ArtifactClosureMemberEvidenceV1Schema = z.enum([
  "exact",
  "missing",
  "identity_mismatch",
  "duplicate_conflict",
  "type_mismatch",
  "envelope_length_mismatch",
  "schema_mismatch",
  "raw_hash_mismatch",
  "raw_length_mismatch",
]);

const ArtifactClosureClassificationV1Schema = z.enum([
  "ARTIFACT_CLOSURE_VERIFIED",
  "ARTIFACT_CLOSURE_ROOT_MISSING",
  "ARTIFACT_CLOSURE_ROOT_IDENTITY_MISMATCH",
  "ARTIFACT_CLOSURE_ROLE_MISMATCH",
  "ARTIFACT_CLOSURE_VALIDATOR_REQUIRED",
  "ARTIFACT_CLOSURE_ROOT_SCHEMA_INVALID",
  "ARTIFACT_CLOSURE_DEPENDENCY_MISSING",
  "ARTIFACT_CLOSURE_DEPENDENCY_DUPLICATE_CONFLICT",
  "ARTIFACT_CLOSURE_DEPENDENCY_TYPE_MISMATCH",
  "ARTIFACT_CLOSURE_DEPENDENCY_ENVELOPE_LENGTH_MISMATCH",
  "ARTIFACT_CLOSURE_DEPENDENCY_SCHEMA_MISMATCH",
  "ARTIFACT_CLOSURE_DEPENDENCY_RAW_HASH_MISMATCH",
  "ARTIFACT_CLOSURE_DEPENDENCY_RAW_LENGTH_MISMATCH",
  "ARTIFACT_CLOSURE_DEPENDENCY_ORDINAL_MISMATCH",
  "ARTIFACT_CLOSURE_BUNDLE_RAW_HASH_MISMATCH",
  "ARTIFACT_CLOSURE_BUNDLE_RAW_LENGTH_MISMATCH",
  "ARTIFACT_CLOSURE_MEMBER_LIMIT_EXCEEDED",
]);

export const ArtifactClosureEvidenceV1Schema = z.object({
  schema: z.literal(ARTIFACT_CLOSURE_EVIDENCE_SCHEMA_V1),
  registrySchema: z.literal(ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1),
  status: z.enum(["verified", "rejected"]),
  classification: ArtifactClosureClassificationV1Schema,
  rootHash: z.string().regex(/^[a-f0-9]{64}$/),
  rootArtifactType: ArtifactClosureArtifactTypeV1Schema,
  role: z.enum(["leaf", "dependency-root"]),
  members: z.array(z.object({
    durabilityTier: z.number().int().min(0).max(8),
    role: z.enum(["dependency", "root"]),
    expected: ArtifactClosureExpectedIdentityV1Schema,
    observed: ArtifactPublicationBatchIdentityItemSchema.nullable(),
    evidence: ArtifactClosureMemberEvidenceV1Schema,
    publishable: z.boolean(),
  }).strict()).max(ARTIFACT_CLOSURE_MAX_MEMBERS_V1),
}).strict().superRefine((value, context) => {
  if (
    (value.status === "verified")
      !== (value.classification === "ARTIFACT_CLOSURE_VERIFIED")
  ) {
    context.addIssue({
      code: "custom",
      path: ["classification"],
      message: "Artifact closure status and classification disagree",
    });
  }
  if (
    value.status === "verified"
    && value.members.some((member) =>
      member.evidence !== "exact" || !member.publishable)
  ) {
    context.addIssue({
      code: "custom",
      path: ["members"],
      message: "Verified artifact closure requires exact publishable members",
    });
  }
});

export type ArtifactClosureEvidenceV1 = z.infer<
  typeof ArtifactClosureEvidenceV1Schema
>;

export type PreparedArtifactClosureEvidenceSetV1 = Readonly<{
  schema: typeof PREPARED_ARTIFACT_CLOSURE_EVIDENCE_SET_SCHEMA_V1;
  artifactCount: number;
  items: readonly ArtifactPublicationBatchIdentityItem[];
}>;

type PrivateArtifactClosureEvidence = Readonly<{
  identity: ArtifactPublicationBatchIdentityItem;
  envelope: SemanticArtifactEnvelopeV1;
}>;

const privateEvidenceByPreparedSet = new WeakMap<
  object,
  ReadonlyMap<string, PrivateArtifactClosureEvidence>
>();
const preparedEvidenceConstructorCapability = Object.freeze({});

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function freezeProducer(
  producer: ArtifactPublicationBatchIdentityItem["producer"],
): ArtifactPublicationBatchIdentityItem["producer"] {
  return Object.freeze({
    ...producer,
    toolVersions: Object.freeze({ ...producer.toolVersions }),
  });
}

function freezeIdentity(
  identity: ArtifactPublicationBatchIdentityItem,
): ArtifactPublicationBatchIdentityItem {
  return Object.freeze({ ...identity, producer: freezeProducer(identity.producer) });
}

function sameIdentity(
  left: ArtifactPublicationBatchIdentityItem,
  right: ArtifactPublicationBatchIdentityItem,
): boolean {
  return left.hash === right.hash
    && left.artifactType === right.artifactType
    && left.byteLength === right.byteLength
    && canonicalJsonBytes(left.producer).equals(canonicalJsonBytes(right.producer));
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      freezeDeep(child);
    }
    Object.freeze(value);
  }
  return value;
}

function dataRecord(
  value: unknown,
  exactKeys: readonly string[],
  label: string,
): ReadonlyMap<string, unknown> {
  if (
    value === null
    || typeof value !== "object"
    || isProxy(value)
    || Array.isArray(value)
  ) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      `${label} must be a non-proxied plain object`,
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      `${label} must use the ordinary or null object prototype`,
    );
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== exactKeys.length
    || keys.some((key) => typeof key !== "string" || !exactKeys.includes(key))
  ) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      `${label} must contain exactly ${exactKeys.join(", ")}`,
    );
  }
  const result = new Map<string, unknown>();
  for (const key of exactKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new ArtifactClosureEvidenceError(
        "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
        `${label}.${key} must be an enumerable data property`,
      );
    }
    result.set(key, descriptor.value);
  }
  return result;
}

function snapshotEvidenceArray(input: unknown): readonly unknown[] {
  if (
    !Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Array.prototype
  ) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      "Artifact closure evidence must be a non-proxied ordinary array",
    );
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, "length");
  const length = lengthDescriptor && "value" in lengthDescriptor
    ? lengthDescriptor.value
    : undefined;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      "Artifact closure evidence length must be a non-negative safe integer",
    );
  }
  if (length > ARTIFACT_CLOSURE_MAX_EVIDENCE_ITEMS_V1) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_CAPACITY_EXCEEDED",
      `Artifact closure evidence exceeds ${ARTIFACT_CLOSURE_MAX_EVIDENCE_ITEMS_V1} items`,
    );
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== length + 1 || !keys.includes("length")) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      "Artifact closure evidence must be dense and contain only indexed items",
    );
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new ArtifactClosureEvidenceError(
        "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
        `Artifact closure evidence item ${index} must be an enumerable data property`,
      );
    }
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function snapshotFreshEvidence(
  input: unknown,
  index: number,
): PrivateArtifactClosureEvidence {
  const record = dataRecord(
    input,
    ["hash", "path", "envelope", "bytes"],
    `Artifact closure evidence item ${index}`,
  );
  const hash = record.get("hash");
  const bytes = record.get("bytes");
  if (typeof hash !== "string" || !Buffer.isBuffer(bytes)) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      `Artifact closure evidence item ${index} requires a hash and Buffer bytes`,
    );
  }
  const artifactHash = hash;
  if (
    bytes.length < 1
    || bytes.length > DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes
    || !Number.isSafeInteger(bytes.length)
  ) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_CAPACITY_EXCEEDED",
      `Artifact closure evidence ${artifactHash} exceeds the v1 envelope boundary`,
      { artifactHash },
    );
  }
  if (sha256(bytes) !== artifactHash) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_HASH_MISMATCH",
      `Artifact closure evidence ${artifactHash} bytes do not match its hash`,
      { artifactHash },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_ENVELOPE_MISMATCH",
      `Artifact closure evidence ${artifactHash} is not valid JSON`,
      { artifactHash, cause: error },
    );
  }
  const parsedEnvelope = SemanticArtifactEnvelopeV1Schema.safeParse(parsedJson);
  if (!parsedEnvelope.success) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_ENVELOPE_MISMATCH",
      `Artifact closure evidence ${artifactHash} is not a semantic envelope`,
      { artifactHash, cause: parsedEnvelope.error },
    );
  }
  let canonical: Buffer;
  let claimedCanonical: Buffer;
  try {
    canonical = canonicalJsonBytesBounded(parsedEnvelope.data, {
      maxBytes: DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
    claimedCanonical = canonicalJsonBytesBounded(record.get("envelope"), {
      maxBytes: DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_ENVELOPE_MISMATCH",
      `Artifact closure evidence ${artifactHash} could not be canonicalized`,
      { artifactHash, cause: error },
    );
  }
  if (!canonical.equals(bytes) || !claimedCanonical.equals(bytes)) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_ENVELOPE_MISMATCH",
      `Artifact closure evidence ${artifactHash} envelope differs from exact CAS bytes`,
      { artifactHash },
    );
  }
  const parsedIdentity = ArtifactPublicationBatchIdentityItemSchema.safeParse({
    hash: artifactHash,
    artifactType: parsedEnvelope.data.artifactType,
    byteLength: bytes.length,
    producer: parsedEnvelope.data.producer,
  });
  if (!parsedIdentity.success) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_ENVELOPE_MISMATCH",
      `Artifact closure evidence ${artifactHash} lacks a publishable identity`,
      { artifactHash, cause: parsedIdentity.error },
    );
  }
  return Object.freeze({
    identity: freezeIdentity(parsedIdentity.data),
    envelope: parsedEnvelope.data,
  });
}

class PreparedArtifactClosureEvidenceSetV1Impl
implements PreparedArtifactClosureEvidenceSetV1 {
  readonly schema = PREPARED_ARTIFACT_CLOSURE_EVIDENCE_SET_SCHEMA_V1;
  readonly artifactCount: number;
  readonly items: readonly ArtifactPublicationBatchIdentityItem[];

  constructor(
    capability: object,
    evidence: ReadonlyMap<string, PrivateArtifactClosureEvidence>,
  ) {
    if (capability !== preparedEvidenceConstructorCapability) {
      throw new ArtifactClosureEvidenceError(
        "ARTIFACT_CLOSURE_EVIDENCE_UNAUTHENTICATED",
        "Prepared artifact closure evidence constructor authority is unavailable",
      );
    }
    this.artifactCount = evidence.size;
    this.items = Object.freeze([...evidence.values()]
      .map((item) => item.identity)
      .sort((left, right) => compareAscii(left.hash, right.hash)));
    privateEvidenceByPreparedSet.set(this, evidence);
    Object.freeze(this);
  }
}

export function prepareArtifactClosureEvidenceSetV1(
  input: readonly ArtifactGetResult[],
): PreparedArtifactClosureEvidenceSetV1 {
  const snapshot = snapshotEvidenceArray(input);
  const evidence = new Map<string, PrivateArtifactClosureEvidence>();
  for (const [index, candidate] of snapshot.entries()) {
    const item = snapshotFreshEvidence(candidate, index);
    if (evidence.has(item.identity.hash)) {
      throw new ArtifactClosureEvidenceError(
        "ARTIFACT_CLOSURE_EVIDENCE_DUPLICATE",
        `Artifact closure evidence repeats ${item.identity.hash}`,
        { artifactHash: item.identity.hash },
      );
    }
    evidence.set(item.identity.hash, item);
  }
  return new PreparedArtifactClosureEvidenceSetV1Impl(
    preparedEvidenceConstructorCapability,
    evidence,
  );
}

type ClosureMemberDraft = Readonly<{
  durabilityTier: number;
  role: "dependency" | "root";
  expected: Readonly<{
    hash: string;
    artifactType: string;
    byteLength: number;
  }>;
  observed: ArtifactPublicationBatchIdentityItem | null;
  evidence: z.infer<typeof ArtifactClosureMemberEvidenceV1Schema>;
  publishable: boolean;
}>;

function closureResult(input: Readonly<{
  classification: ArtifactClosureClassificationV1;
  root: ArtifactPublicationBatchIdentityItem;
  role: ArtifactClosureRoleV1;
  members: readonly ClosureMemberDraft[];
}>): ArtifactClosureEvidenceV1 {
  const ordered = [...input.members].sort((left, right) =>
    left.durabilityTier - right.durabilityTier
      || compareAscii(left.expected.hash, right.expected.hash));
  const parsed = ArtifactClosureEvidenceV1Schema.parse({
    schema: ARTIFACT_CLOSURE_EVIDENCE_SCHEMA_V1,
    registrySchema: ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1,
    status: input.classification === "ARTIFACT_CLOSURE_VERIFIED"
      ? "verified"
      : "rejected",
    classification: input.classification,
    rootHash: input.root.hash,
    rootArtifactType: input.root.artifactType,
    role: input.role,
    members: ordered,
  });
  return freezeDeep(parsed);
}

function rootMember(
  root: ArtifactPublicationBatchIdentityItem,
  observed: PrivateArtifactClosureEvidence | undefined,
  input: Readonly<{
    durabilityTier: number;
    evidence: ClosureMemberDraft["evidence"];
    publishable: boolean;
  }>,
): ClosureMemberDraft {
  return Object.freeze({
    durabilityTier: input.durabilityTier,
    role: "root",
    expected: Object.freeze({
      hash: root.hash,
      artifactType: root.artifactType,
      byteLength: root.byteLength,
    }),
    observed: observed?.identity ?? null,
    evidence: input.evidence,
    publishable: input.publishable,
  });
}

function evaluateLeaf(
  root: ArtifactPublicationBatchIdentityItem,
  role: ArtifactClosureRoleV1,
  observed: PrivateArtifactClosureEvidence,
): ArtifactClosureEvidenceV1 {
  return closureResult({
    classification: "ARTIFACT_CLOSURE_VERIFIED",
    root,
    role,
    members: [rootMember(root, observed, {
      durabilityTier: 0,
      evidence: "exact",
      publishable: true,
    })],
  });
}

function byteBundleRootClassification(
  issues: readonly Readonly<{ message: string }>[],
): ArtifactClosureClassificationV1 {
  return issues.some((issue) => issue.message === "BYTE_BUNDLE_V1_CHUNK_ORDER_INVALID")
    ? "ARTIFACT_CLOSURE_DEPENDENCY_ORDINAL_MISMATCH"
    : "ARTIFACT_CLOSURE_ROOT_SCHEMA_INVALID";
}

function sameExpectedChunk(
  left: Readonly<{
    chunkEnvelopeByteLength: number;
    chunkRawHash: string;
    rawByteLength: number;
  }>,
  right: Readonly<{
    chunkEnvelopeByteLength: number;
    chunkRawHash: string;
    rawByteLength: number;
  }>,
): boolean {
  return left.chunkEnvelopeByteLength === right.chunkEnvelopeByteLength
    && left.chunkRawHash === right.chunkRawHash
    && left.rawByteLength === right.rawByteLength;
}

function evaluateByteBundle(
  root: ArtifactPublicationBatchIdentityItem,
  role: ArtifactClosureRoleV1,
  rootEvidence: PrivateArtifactClosureEvidence,
  evidence: ReadonlyMap<string, PrivateArtifactClosureEvidence>,
): ArtifactClosureEvidenceV1 {
  const parsedRoot = parseByteBundleEnvelopeV1(rootEvidence.envelope);
  if (parsedRoot.status === "rejected") {
    return closureResult({
      classification: byteBundleRootClassification(parsedRoot.issues),
      root,
      role,
      members: [rootMember(root, rootEvidence, {
        durabilityTier: 1,
        evidence: "schema_mismatch",
        publishable: false,
      })],
    });
  }

  const expectedByHash = new Map<
    string,
    (typeof parsedRoot.envelope.payload.chunks)[number]
  >();
  const rawByHash = new Map<string, Buffer>();
  const dependencyMembers: ClosureMemberDraft[] = [];
  let classification: ArtifactClosureClassificationV1 | undefined;

  for (const reference of parsedRoot.envelope.payload.chunks) {
    const duplicate = expectedByHash.get(reference.chunkEnvelopeHash);
    if (duplicate) {
      if (!sameExpectedChunk(duplicate, reference)) {
        classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_DUPLICATE_CONFLICT";
      }
      continue;
    }
    expectedByHash.set(reference.chunkEnvelopeHash, reference);
    const observed = evidence.get(reference.chunkEnvelopeHash);
    let memberEvidence: ClosureMemberDraft["evidence"] = "exact";
    let publishable = true;
    let rawBytes: Buffer | undefined;

    if (!observed) {
      classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_MISSING";
      memberEvidence = "missing";
      publishable = false;
    } else if (observed.identity.artifactType !== BYTE_CHUNK_ARTIFACT_TYPE_V1) {
      classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_TYPE_MISMATCH";
      memberEvidence = "type_mismatch";
      publishable = false;
    } else if (
      observed.identity.byteLength !== reference.chunkEnvelopeByteLength
    ) {
      classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_ENVELOPE_LENGTH_MISMATCH";
      memberEvidence = "envelope_length_mismatch";
      publishable = false;
    } else {
      const parsedChunk = parseByteChunkEnvelopeV1(observed.envelope);
      if (parsedChunk.status === "rejected") {
        classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_SCHEMA_MISMATCH";
        memberEvidence = "schema_mismatch";
        publishable = false;
      } else if (
        parsedChunk.envelopeHash !== reference.chunkEnvelopeHash
        || parsedChunk.envelopeByteLength !== reference.chunkEnvelopeByteLength
      ) {
        classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_ENVELOPE_LENGTH_MISMATCH";
        memberEvidence = "envelope_length_mismatch";
        publishable = false;
      } else if (parsedChunk.rawHash !== reference.chunkRawHash) {
        classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_RAW_HASH_MISMATCH";
        memberEvidence = "raw_hash_mismatch";
        publishable = false;
      } else if (parsedChunk.rawByteLength !== reference.rawByteLength) {
        classification ??= "ARTIFACT_CLOSURE_DEPENDENCY_RAW_LENGTH_MISMATCH";
        memberEvidence = "raw_length_mismatch";
        publishable = false;
      } else {
        rawBytes = Buffer.from(parsedChunk.envelope.payload.bytesBase64, "base64");
      }
    }

    if (rawBytes) rawByHash.set(reference.chunkEnvelopeHash, rawBytes);
    dependencyMembers.push(Object.freeze({
      durabilityTier: 0,
      role: "dependency",
      expected: Object.freeze({
        hash: reference.chunkEnvelopeHash,
        artifactType: BYTE_CHUNK_ARTIFACT_TYPE_V1,
        byteLength: reference.chunkEnvelopeByteLength,
      }),
      observed: observed?.identity ?? null,
      evidence: memberEvidence,
      publishable,
    }));
  }

  if (dependencyMembers.length + 1 > ARTIFACT_CLOSURE_MAX_MEMBERS_V1) {
    classification ??= "ARTIFACT_CLOSURE_MEMBER_LIMIT_EXCEEDED";
  }

  if (!classification) {
    const rawParts: Buffer[] = [];
    for (const reference of parsedRoot.envelope.payload.chunks) {
      const raw = rawByHash.get(reference.chunkEnvelopeHash);
      if (!raw) {
        classification = "ARTIFACT_CLOSURE_DEPENDENCY_MISSING";
        break;
      }
      rawParts.push(raw);
    }
    if (!classification) {
      const combined = Buffer.concat(rawParts);
      if (combined.length !== parsedRoot.rawByteLength) {
        classification = "ARTIFACT_CLOSURE_BUNDLE_RAW_LENGTH_MISMATCH";
      } else if (sha256(combined) !== parsedRoot.rawHash) {
        classification = "ARTIFACT_CLOSURE_BUNDLE_RAW_HASH_MISMATCH";
      }
    }
  }

  const finalClassification = classification ?? "ARTIFACT_CLOSURE_VERIFIED";
  return closureResult({
    classification: finalClassification,
    root,
    role,
    members: [
      ...dependencyMembers,
      rootMember(root, rootEvidence, {
        durabilityTier: 1,
        evidence: "exact",
        publishable: finalClassification === "ARTIFACT_CLOSURE_VERIFIED",
      }),
    ],
  });
}

export function evaluateArtifactClosureV1(input: Readonly<{
  evidence: PreparedArtifactClosureEvidenceSetV1;
  root: ArtifactPublicationBatchIdentityItem;
  role: ArtifactClosureRoleV1;
}>): ArtifactClosureEvidenceV1 {
  const request = dataRecord(
    input,
    ["evidence", "root", "role"],
    "Artifact closure evaluation request",
  );
  const prepared = request.get("evidence");
  const evidence = typeof prepared === "object" && prepared !== null
    ? privateEvidenceByPreparedSet.get(prepared)
    : undefined;
  if (!evidence) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_UNAUTHENTICATED",
      "Artifact closure evaluation requires a prepared evidence set",
    );
  }
  let parsedRoot: ReturnType<typeof ArtifactPublicationBatchIdentityItemSchema.safeParse>;
  try {
    parsedRoot = ArtifactPublicationBatchIdentityItemSchema.safeParse(request.get("root"));
  } catch (error) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      "Artifact closure root identity could not be inspected safely",
      { cause: error },
    );
  }
  if (!parsedRoot.success) {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      "Artifact closure root identity is invalid",
      { cause: parsedRoot.error },
    );
  }
  const root = freezeIdentity(parsedRoot.data);
  const role = request.get("role");
  if (role !== "leaf" && role !== "dependency-root") {
    throw new ArtifactClosureEvidenceError(
      "ARTIFACT_CLOSURE_EVIDENCE_INPUT_INVALID",
      "Artifact closure role must be leaf or dependency-root",
      { artifactHash: root.hash },
    );
  }
  const observed = evidence.get(root.hash);
  if (!observed) {
    return closureResult({
      classification: "ARTIFACT_CLOSURE_ROOT_MISSING",
      root,
      role,
      members: [rootMember(root, undefined, {
        durabilityTier: 0,
        evidence: "missing",
        publishable: false,
      })],
    });
  }
  if (!sameIdentity(root, observed.identity)) {
    return closureResult({
      classification: "ARTIFACT_CLOSURE_ROOT_IDENTITY_MISMATCH",
      root,
      role,
      members: [rootMember(root, observed, {
        durabilityTier: 0,
        evidence: "identity_mismatch",
        publishable: false,
      })],
    });
  }

  const registryEntry = ARTIFACT_CLOSURE_REGISTRY_V1.entries.find(
    (entry) => entry.artifactType === root.artifactType,
  );
  if (role === "leaf") {
    if (registryEntry?.kind === "dependency-root") {
      return closureResult({
        classification: "ARTIFACT_CLOSURE_ROLE_MISMATCH",
        root,
        role,
        members: [rootMember(root, observed, {
          durabilityTier: 1,
          evidence: "exact",
          publishable: false,
        })],
      });
    }
    return evaluateLeaf(root, role, observed);
  }
  if (!registryEntry) {
    return closureResult({
      classification: "ARTIFACT_CLOSURE_VALIDATOR_REQUIRED",
      root,
      role,
      members: [rootMember(root, observed, {
        durabilityTier: 0,
        evidence: "exact",
        publishable: false,
      })],
    });
  }
  if (registryEntry.kind !== "dependency-root") {
    return closureResult({
      classification: "ARTIFACT_CLOSURE_ROLE_MISMATCH",
      root,
      role,
      members: [rootMember(root, observed, {
        durabilityTier: 0,
        evidence: "exact",
        publishable: false,
      })],
    });
  }
  return evaluateByteBundle(root, role, observed, evidence);
}
