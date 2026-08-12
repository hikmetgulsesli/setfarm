import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { ARTIFACT_BATCH_CAPACITY_MAX_ITEMS_V1 } from "./artifact-capacity.js";
import {
  ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES,
  ArtifactPublicationBatchIdentityItemSchema,
  type ArtifactPublicationBatchIdentityItem,
} from "./artifact-publication-batch-identity.js";

export const ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1 =
  "setfarm.artifact-store-batch-put-plan.v1" as const;
export const ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1 =
  "setfarm.artifact-publication-batch-plan-binding.v1" as const;
export const ARTIFACT_STORE_BATCH_MAX_DURABILITY_TIER_V1 = 8;

export type ArtifactStoreBatchPlanErrorCode =
  | "ARTIFACT_BATCH_PLAN_INVALID"
  | "ARTIFACT_BATCH_DUPLICATE_CONFLICT";

export class ArtifactStoreBatchPlanError extends Error {
  readonly code: ArtifactStoreBatchPlanErrorCode;
  override readonly cause?: unknown;

  constructor(
    code: ArtifactStoreBatchPlanErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message);
    this.name = "ArtifactStoreBatchPlanError";
    this.code = code;
    this.cause = options.cause;
  }
}

export type ArtifactPublicationBatchPlanIdentityItemV1 = Readonly<{
  durabilityTier: number;
  identity: ArtifactPublicationBatchIdentityItem;
}>;

export type ArtifactPublicationBatchPlanBindingV1 = Readonly<{
  schema: typeof ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1;
  planIdentityHash: string;
  items: readonly ArtifactPublicationBatchPlanIdentityItemV1[];
}>;

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

function frozenIdentity(
  identity: ArtifactPublicationBatchIdentityItem,
): ArtifactPublicationBatchIdentityItem {
  const toolVersions = Object.freeze({ ...identity.producer.toolVersions });
  const producer = Object.freeze({ ...identity.producer, toolVersions });
  return Object.freeze({ ...identity, producer });
}

function normalizePlanIdentityViews(
  input: readonly ArtifactPublicationBatchPlanIdentityItemV1[],
): readonly ArtifactPublicationBatchPlanIdentityItemV1[] {
  if (
    !Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Array.prototype
    || input.length < 1
    || input.length > ARTIFACT_BATCH_CAPACITY_MAX_ITEMS_V1
  ) {
    return invalid(
      `Artifact batch recovery identity requires 1..${ARTIFACT_BATCH_CAPACITY_MAX_ITEMS_V1} ordinary items`,
    );
  }
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== input.length + 1 || !ownKeys.includes("length")) {
    return invalid("Artifact batch recovery identity items must be dense");
  }
  const normalized: ArtifactPublicationBatchPlanIdentityItemV1[] = [];
  const seenHashes = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return invalid(`Artifact batch recovery identity item ${index} is not plain data`);
    }
    const item = plainRecordData(
      descriptor.value,
      ["durabilityTier", "identity"],
      `Artifact batch recovery identity item ${index}`,
    );
    const durabilityTier = item.get("durabilityTier");
    if (
      !Number.isSafeInteger(durabilityTier)
      || (durabilityTier as number) < 0
      || (durabilityTier as number) > ARTIFACT_STORE_BATCH_MAX_DURABILITY_TIER_V1
    ) {
      return invalid(
        `Artifact batch recovery identity item ${index} has an invalid durability tier`,
      );
    }
    let identitySnapshot: unknown;
    try {
      identitySnapshot = JSON.parse(canonicalJsonBytesBounded(item.get("identity"), {
        maxBytes: ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES,
        ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
      }).toString("utf8"));
    } catch (cause) {
      return invalid(
        `Artifact batch recovery identity item ${index} is not bounded canonical data`,
        cause,
      );
    }
    const identity = ArtifactPublicationBatchIdentityItemSchema.safeParse(identitySnapshot);
    if (!identity.success) {
      return invalid(
        `Artifact batch recovery identity item ${index} has invalid immutable identity`,
        identity.error,
      );
    }
    if (seenHashes.has(identity.data.hash)) {
      return invalid(`Artifact batch recovery identity repeats ${identity.data.hash}`);
    }
    seenHashes.add(identity.data.hash);
    normalized.push(Object.freeze({
      durabilityTier: durabilityTier as number,
      identity: frozenIdentity(identity.data),
    }));
  }
  const canonical = [...normalized].sort((left, right) =>
    left.durabilityTier - right.durabilityTier
      || (left.identity.hash < right.identity.hash
        ? -1
        : left.identity.hash > right.identity.hash ? 1 : 0));
  if (canonical.some((item, index) => item !== normalized[index])) {
    return invalid("Artifact batch recovery identity is not in canonical tier/hash order");
  }
  const tiers = [...new Set(normalized.map((item) => item.durabilityTier))];
  for (let expected = 0; expected < tiers.length; expected += 1) {
    if (tiers[expected] !== expected) {
      return invalid("Artifact batch recovery identity tiers must be dense and begin at zero");
    }
  }
  return Object.freeze(normalized);
}

export function normalizeArtifactPublicationBatchPlanBindingV1(
  input: unknown,
): ArtifactPublicationBatchPlanBindingV1 {
  const binding = plainRecordData(
    input,
    ["schema", "planIdentityHash", "items"],
    "Artifact publication batch plan binding",
  );
  if (binding.get("schema") !== ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1) {
    return invalid(
      `Artifact publication batch plan binding schema must be ${ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1}`,
    );
  }
  const items = normalizePlanIdentityViews(
    binding.get("items") as readonly ArtifactPublicationBatchPlanIdentityItemV1[],
  );
  const planIdentityHash = computeArtifactStoreBatchPlanIdentityHashV1(items);
  if (binding.get("planIdentityHash") !== planIdentityHash) {
    return invalid("Artifact publication batch plan binding hash does not match its exact items");
  }
  return Object.freeze({
    schema: ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1,
    planIdentityHash,
    items,
  });
}

export function createArtifactPublicationBatchPlanBindingV1(
  items: readonly ArtifactPublicationBatchPlanIdentityItemV1[],
): ArtifactPublicationBatchPlanBindingV1 {
  const planIdentityHash = computeArtifactStoreBatchPlanIdentityHashV1(items);
  return normalizeArtifactPublicationBatchPlanBindingV1({
    schema: ARTIFACT_PUBLICATION_BATCH_PLAN_BINDING_SCHEMA_V1,
    planIdentityHash,
    items,
  });
}

export function computeArtifactStoreBatchPlanIdentityHashV1(
  items: readonly ArtifactPublicationBatchPlanIdentityItemV1[],
): string {
  const normalized = normalizePlanIdentityViews(items);
  const identityBytes = canonicalJsonBytesBounded({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: normalized.map((item) => ({
      durabilityTier: item.durabilityTier,
      identity: item.identity,
    })),
  }, {
    maxBytes: ARTIFACT_PUBLICATION_BATCH_MAX_CANONICAL_BYTES,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  });
  return createHash("sha256").update(identityBytes).digest("hex");
}
