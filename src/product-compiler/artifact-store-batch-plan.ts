import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  CanonicalJsonLimitError,
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { CanonicalJsonError } from "./canonical-json.js";
import {
  ARTIFACT_BATCH_CAPACITY_MAX_ITEMS_V1,
  ArtifactCapacityError,
  DEFAULT_ARTIFACT_CAPACITY_LIMITS,
} from "./artifact-capacity.js";
import {
  SemanticArtifactEnvelopeV1Schema,
} from "./artifact-envelope.js";
import {
  ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES,
  ARTIFACT_PUBLICATION_BATCH_MAX_TOTAL_PRODUCER_IDENTITY_BYTES,
  ArtifactPublicationBatchIdentityItemSchema,
  computeArtifactPublicationBatchProducerIdentityByteLength,
  type ArtifactPublicationBatchIdentityItem,
} from "./artifact-publication-batch-identity.js";
import {
  ARTIFACT_STORE_BATCH_MAX_DURABILITY_TIER_V1,
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  ArtifactStoreBatchPlanError,
  computeArtifactStoreBatchPlanIdentityHashV1,
} from "./artifact-publication-batch-plan-binding.js";

export {
  ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1,
  ARTIFACT_STORE_BATCH_MAX_DURABILITY_TIER_V1,
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  ArtifactStoreBatchPlanError,
  computeArtifactStoreBatchPlanIdentityHashV1,
  createArtifactPublicationBatchPlanBindingV1,
  normalizeArtifactPublicationBatchPlanBindingV1,
  type ArtifactPublicationBatchPlanBindingV1,
  type ArtifactStoreBatchPlanErrorCode,
} from "./artifact-publication-batch-plan-binding.js";

export const PREPARED_ARTIFACT_STORE_BATCH_SCHEMA_V1 =
  "setfarm.prepared-artifact-store-batch.v1" as const;
export const ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1 =
  "setfarm.artifact-store-batch-put-result.v1" as const;
export const ARTIFACT_STORE_BATCH_MAX_OCCURRENCES_V1 =
  ARTIFACT_BATCH_CAPACITY_MAX_ITEMS_V1;

export type ArtifactStoreBatchPutPlanItemV1 = Readonly<{
  durabilityTier: number;
  envelope: unknown;
}>;

export type ArtifactStoreBatchPutPlanV1 = Readonly<{
  schema: typeof ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1;
  items: readonly ArtifactStoreBatchPutPlanItemV1[];
}>;

export type PreparedArtifactStoreBatchItemViewV1 = Readonly<{
  durabilityTier: number;
  identity: ArtifactPublicationBatchIdentityItem;
}>;

export type PreparedArtifactStoreBatchCanonicalItemV1 = Readonly<{
  durabilityTier: number;
  identity: ArtifactPublicationBatchIdentityItem;
  bytes: Buffer;
}>;

type PrivatePreparedItem = Readonly<{
  durabilityTier: number;
  identity: ArtifactPublicationBatchIdentityItem;
  bytes: Buffer;
}>;

export type PreparedArtifactStoreBatchViewV1 = Readonly<{
  schema: typeof PREPARED_ARTIFACT_STORE_BATCH_SCHEMA_V1;
  planIdentityHash: string;
  occurrenceCount: number;
  items: readonly PreparedArtifactStoreBatchItemViewV1[];
}>;

export type PreparedArtifactStoreBatchV1 = PreparedArtifactStoreBatchViewV1;

export type ArtifactStoreBatchPutResultItemV1 = Readonly<{
  durabilityTier: number;
  hash: string;
  path: string;
  byteLength: number;
  created: boolean;
}>;

export type ArtifactStoreBatchPutResultV1 = Readonly<{
  schema: typeof ARTIFACT_STORE_BATCH_PUT_RESULT_SCHEMA_V1;
  planIdentityHash: string;
  createdCount: number;
  createdBytes: number;
  items: readonly ArtifactStoreBatchPutResultItemV1[];
}>;

const privatePreparedBatchItems = new WeakMap<object, readonly PrivatePreparedItem[]>();
const preparedBatchConstructorCapability = Object.freeze({});

function invalid(message: string, cause?: unknown): never {
  throw new ArtifactStoreBatchPlanError(
    "ARTIFACT_BATCH_PLAN_INVALID",
    message,
    cause === undefined ? {} : { cause },
  );
}

function plainRecordData(
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
    return invalid(`${label} must be a non-proxied plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return invalid(`${label} must use the ordinary or null object prototype`);
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== exactKeys.length
    || ownKeys.some((key) => typeof key !== "string" || !exactKeys.includes(key))
  ) {
    return invalid(`${label} must contain exactly ${exactKeys.join(", ")}`);
  }
  const result = new Map<string, unknown>();
  for (const key of exactKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return invalid(`${label}.${key} must be an enumerable data property`);
    }
    result.set(key, descriptor.value);
  }
  return result;
}

function snapshotItems(value: unknown): readonly Readonly<{
  durabilityTier: number;
  envelope: unknown;
}>[] {
  if (
    value === null
    || typeof value !== "object"
    || isProxy(value)
    || !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
  ) {
    return invalid("Artifact batch plan items must be a non-proxied ordinary array");
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor && "value" in lengthDescriptor
    ? lengthDescriptor.value
    : undefined;
  if (
    !Number.isSafeInteger(length)
    || length < 1
    || length > ARTIFACT_STORE_BATCH_MAX_OCCURRENCES_V1
  ) {
    return invalid(
      `Artifact batch plan requires 1..${ARTIFACT_STORE_BATCH_MAX_OCCURRENCES_V1} occurrences`,
    );
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1 || !ownKeys.includes("length")) {
    return invalid("Artifact batch plan items must be dense and contain only indexed entries");
  }
  const items: Array<Readonly<{ durabilityTier: number; envelope: unknown }>> = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!ownKeys.includes(key)) {
      return invalid(`Artifact batch plan items are sparse at index ${index}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return invalid(`Artifact batch plan item ${index} must be an enumerable data property`);
    }
    const item = plainRecordData(
      descriptor.value,
      ["durabilityTier", "envelope"],
      `Artifact batch plan item ${index}`,
    );
    const durabilityTier = item.get("durabilityTier");
    if (
      !Number.isSafeInteger(durabilityTier)
      || (durabilityTier as number) < 0
      || (durabilityTier as number) > ARTIFACT_STORE_BATCH_MAX_DURABILITY_TIER_V1
    ) {
      return invalid(
        `Artifact batch plan item ${index} durabilityTier must be an integer from 0 to ${ARTIFACT_STORE_BATCH_MAX_DURABILITY_TIER_V1}`,
      );
    }
    items.push(Object.freeze({
      durabilityTier: durabilityTier as number,
      envelope: item.get("envelope"),
    }));
  }
  return Object.freeze(items);
}

function canonicalEnvelopeBytes(value: unknown, maxPayloadBytes: number): Buffer {
  try {
    return canonicalJsonBytesBounded(value, {
      maxBytes: maxPayloadBytes,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    if (error instanceof CanonicalJsonLimitError) {
      throw new ArtifactCapacityError(
        "ARTIFACT_PAYLOAD_TOO_LARGE",
        `Artifact batch canonicalization exceeded bounded payload authority: ${error.code}`,
      );
    }
    if (error instanceof CanonicalJsonError) {
      return invalid("Artifact batch envelope is not canonical JSON input", error);
    }
    throw error;
  }
}

function frozenIdentity(
  identity: ArtifactPublicationBatchIdentityItem,
): ArtifactPublicationBatchIdentityItem {
  const toolVersions = Object.freeze({ ...identity.producer.toolVersions });
  const producer = Object.freeze({ ...identity.producer, toolVersions });
  return Object.freeze({ ...identity, producer });
}

function unpooledBufferCopy(source: Buffer): Buffer {
  const copy = Buffer.allocUnsafeSlow(source.length);
  source.copy(copy);
  return copy;
}

function prepareItem(
  value: Readonly<{ durabilityTier: number; envelope: unknown }>,
  maxPayloadBytes: number,
): PrivatePreparedItem {
  const sourceBytes = canonicalEnvelopeBytes(value.envelope, maxPayloadBytes);
  let snapshot: unknown;
  try {
    snapshot = JSON.parse(sourceBytes.toString("utf8"));
  } catch (error) {
    return invalid("Artifact batch envelope snapshot is not valid JSON", error);
  }
  const envelope = SemanticArtifactEnvelopeV1Schema.safeParse(snapshot);
  if (!envelope.success) {
    return invalid("Artifact batch envelope does not match semantic envelope v1", envelope.error);
  }
  assertDatabaseSafeUnicodeSnapshot(envelope.data);
  const normalizedBytes = canonicalEnvelopeBytes(envelope.data, maxPayloadBytes);
  if (!normalizedBytes.equals(sourceBytes)) {
    return invalid("Artifact batch envelope schema normalization changed canonical bytes");
  }
  const hash = createHash("sha256").update(normalizedBytes).digest("hex");
  const parsedIdentity = ArtifactPublicationBatchIdentityItemSchema.safeParse({
    hash,
    artifactType: envelope.data.artifactType,
    byteLength: normalizedBytes.length,
    producer: envelope.data.producer,
  });
  if (!parsedIdentity.success) {
    return invalid(
      "Artifact batch envelope identity is not database-publication compatible",
      parsedIdentity.error,
    );
  }
  return Object.freeze({
    durabilityTier: value.durabilityTier,
    identity: frozenIdentity(parsedIdentity.data),
    bytes: unpooledBufferCopy(normalizedBytes),
  });
}

function databaseSafeUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) return false;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function assertDatabaseSafeUnicodeSnapshot(root: unknown): void {
  const stack: unknown[] = [root];
  let nodes = 0;
  while (stack.length > 0) {
    const value = stack.pop();
    nodes += 1;
    if (nodes > DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes) {
      throw new ArtifactCapacityError(
        "ARTIFACT_PAYLOAD_TOO_LARGE",
        "Artifact batch Unicode validation exceeded bounded node authority",
      );
    }
    if (typeof value === "string") {
      if (!databaseSafeUnicode(value)) {
        return invalid(
          "Artifact batch envelope contains Unicode that is unsafe for canonical database publication",
        );
      }
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push(value[index]);
      }
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      if (!databaseSafeUnicode(key)) {
        return invalid(
          "Artifact batch envelope contains a Unicode-unsafe object key",
        );
      }
      stack.push(child);
    }
  }
}

function normalizedItems(items: readonly PrivatePreparedItem[]): readonly PrivatePreparedItem[] {
  const byHash = new Map<string, PrivatePreparedItem>();
  for (const item of items) {
    const existing = byHash.get(item.identity.hash);
    if (!existing) {
      byHash.set(item.identity.hash, item);
      continue;
    }
    if (
      existing.durabilityTier !== item.durabilityTier
      || !existing.bytes.equals(item.bytes)
    ) {
      throw new ArtifactStoreBatchPlanError(
        "ARTIFACT_BATCH_DUPLICATE_CONFLICT",
        `Artifact ${item.identity.hash} has conflicting bytes, identity, or durability tier`,
      );
    }
  }
  const unique = [...byHash.values()].sort((left, right) =>
    left.durabilityTier - right.durabilityTier
      || (left.identity.hash < right.identity.hash
        ? -1
        : left.identity.hash > right.identity.hash ? 1 : 0));
  const tiers = [...new Set(unique.map((item) => item.durabilityTier))];
  for (let expected = 0; expected < tiers.length; expected += 1) {
    if (tiers[expected] !== expected) {
      return invalid("Artifact batch durability tiers must be dense and begin at zero");
    }
  }
  let producerIdentityBytes = 0;
  for (const item of unique) {
    producerIdentityBytes += computeArtifactPublicationBatchProducerIdentityByteLength(
      item.identity.producer,
    );
    if (
      !Number.isSafeInteger(producerIdentityBytes)
      || producerIdentityBytes > ARTIFACT_PUBLICATION_BATCH_MAX_TOTAL_PRODUCER_IDENTITY_BYTES
    ) {
      return invalid("Artifact batch producer identities exceed the aggregate byte budget");
    }
  }
  return Object.freeze(unique);
}

class PreparedArtifactStoreBatchV1Impl implements PreparedArtifactStoreBatchV1 {
  readonly schema = PREPARED_ARTIFACT_STORE_BATCH_SCHEMA_V1;
  readonly planIdentityHash: string;
  readonly occurrenceCount: number;
  readonly items: readonly PreparedArtifactStoreBatchItemViewV1[];

  constructor(
    capability: object,
    occurrenceCount: number,
    items: readonly PrivatePreparedItem[],
  ) {
    if (capability !== preparedBatchConstructorCapability) {
      invalid("Prepared artifact store batch constructor authority is unavailable");
    }
    this.occurrenceCount = occurrenceCount;
    this.items = Object.freeze(items.map((item) => Object.freeze({
      durabilityTier: item.durabilityTier,
      identity: item.identity,
    })));
    this.planIdentityHash = computeArtifactStoreBatchPlanIdentityHashV1(this.items);
    privatePreparedBatchItems.set(this, items);
    Object.freeze(this);
  }
}

export function copyPreparedArtifactStoreBatchCanonicalItemsV1(
  prepared: PreparedArtifactStoreBatchV1,
): readonly PreparedArtifactStoreBatchCanonicalItemV1[] {
  if (
    typeof prepared !== "object"
    || prepared === null
    || isProxy(prepared)
  ) {
    return invalid("Prepared artifact store batch authority is forged or unavailable");
  }
  const items = privatePreparedBatchItems.get(prepared);
  if (!items) {
    return invalid("Prepared artifact store batch authority is forged or unavailable");
  }
  return Object.freeze(items.map((item) => Object.freeze({
    durabilityTier: item.durabilityTier,
    identity: item.identity,
    bytes: unpooledBufferCopy(item.bytes),
  })));
}

export function prepareArtifactStoreBatchPlanV1(
  input: unknown,
  options: Readonly<{ maxPayloadBytes?: number }> = {},
): PreparedArtifactStoreBatchV1 {
  const maxPayloadBytes = options.maxPayloadBytes
    ?? DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes;
  if (!Number.isSafeInteger(maxPayloadBytes) || maxPayloadBytes < 1) {
    throw new RangeError("maxPayloadBytes must be a positive safe integer");
  }
  const outer = plainRecordData(input, ["schema", "items"], "Artifact batch plan");
  if (outer.get("schema") !== ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1) {
    return invalid(`Artifact batch plan schema must be ${ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1}`);
  }
  const occurrences = snapshotItems(outer.get("items"));
  const prepared = normalizedItems(
    occurrences.map((item) => prepareItem(item, maxPayloadBytes)),
  );
  return new PreparedArtifactStoreBatchV1Impl(
    preparedBatchConstructorCapability,
    occurrences.length,
    prepared,
  );
}
