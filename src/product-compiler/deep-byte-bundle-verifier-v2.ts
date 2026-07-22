import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";

import type postgres from "postgres";

import {
  ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1,
  evaluateArtifactClosureV1,
  prepareArtifactClosureEvidenceSetV1,
  type ArtifactClosureEvidenceV1,
} from "./artifact-closure.js";
import {
  ContentAddressedArtifactStore,
  type ArtifactGetResult,
} from "./artifact-store.js";
import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
} from "./artifact-store-authority.js";
import {
  createArtifactIndex,
  type ArtifactIdentity,
} from "./artifact-index.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  ArtifactPublicationBatchIdentityItemSchema,
} from "./artifact-publication-batch-identity.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  parseByteBundleEnvelopeV1,
  parseByteChunkEnvelopeV1,
} from "./schemas/byte-bundle-v1.js";
import {
  DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
  DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_VERSION_V2,
  DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_REF_V2,
  DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_VERSION_V2,
  DeepByteBundleConsumerBindingV2Schema,
  DeepByteBundleExpectedRefV2Schema,
  DeepByteBundleVerificationReceiptV2Schema,
  hashDeepByteBundleVerificationReceiptV2,
  type DeepByteBundleConsumerBindingV2,
  type DeepByteBundleExpectedRefV2,
  type DeepByteBundleVerificationReceiptV2,
} from "./schemas/deep-byte-bundle-verification-receipt-v2.js";

export type DeepByteBundleVerificationErrorCodeV2 =
  | "DEEP_BYTE_BUNDLE_V2_INPUT_INVALID"
  | "DEEP_BYTE_BUNDLE_V2_PRODUCTION_AUTHORITY_REQUIRED"
  | "DEEP_BYTE_BUNDLE_V2_ROOT_UNAVAILABLE"
  | "DEEP_BYTE_BUNDLE_V2_ROOT_IDENTITY_MISMATCH"
  | "DEEP_BYTE_BUNDLE_V2_CHUNK_UNAVAILABLE"
  | "DEEP_BYTE_BUNDLE_V2_INDEX_UNAVAILABLE"
  | "DEEP_BYTE_BUNDLE_V2_INDEX_IDENTITY_MISMATCH"
  | "DEEP_BYTE_BUNDLE_V2_CLOSURE_REJECTED"
  | "DEEP_BYTE_BUNDLE_V2_REASSEMBLY_MISMATCH"
  | "DEEP_BYTE_BUNDLE_V2_RECEIPT_INVALID"
  | "DEEP_BYTE_BUNDLE_V2_HANDLE_UNAUTHENTICATED";

export class DeepByteBundleVerificationErrorV2 extends Error {
  readonly code: DeepByteBundleVerificationErrorCodeV2;
  readonly artifactHash?: string;
  readonly closure?: ArtifactClosureEvidenceV1;
  override readonly cause?: unknown;

  constructor(
    code: DeepByteBundleVerificationErrorCodeV2,
    message: string,
    options: Readonly<{
      artifactHash?: string;
      closure?: ArtifactClosureEvidenceV1;
      cause?: unknown;
    }> = {},
  ) {
    super(message.slice(0, 1_500));
    this.name = "DeepByteBundleVerificationErrorV2";
    this.code = code;
    this.artifactHash = options.artifactHash;
    this.closure = options.closure;
    this.cause = options.cause;
  }
}

const verifiedHandleConstructorCapabilityV2 = Object.freeze({});
const privateVerifiedBytesV2 = new WeakMap<object, Buffer>();
const casAuthorityConstructorCapabilityV2 = Object.freeze({});
const privateCasAuthorityStateV2 = new WeakMap<object, Readonly<{
  store: ContentAddressedArtifactStore;
  index: Pick<ReturnType<typeof createArtifactIndex>, "getArtifact">;
}>>();

export const DEEP_BYTE_BUNDLE_CAS_AUTHORITY_V2_SCHEMA =
  "setfarm.deep-byte-bundle-cas-authority.v2" as const;

export class DeepByteBundleCasAuthorityV2 {
  readonly schema = DEEP_BYTE_BUNDLE_CAS_AUTHORITY_V2_SCHEMA;

  constructor(
    capability: object,
    state: Readonly<{
      store: ContentAddressedArtifactStore;
      index: Pick<ReturnType<typeof createArtifactIndex>, "getArtifact">;
    }>,
  ) {
    if (capability !== casAuthorityConstructorCapabilityV2) {
      throw new DeepByteBundleVerificationErrorV2(
        "DEEP_BYTE_BUNDLE_V2_PRODUCTION_AUTHORITY_REQUIRED",
        "Deep ByteBundle CAS authority constructor capability is unavailable",
      );
    }
    privateCasAuthorityStateV2.set(this, state);
    Object.freeze(this);
  }
}

export function createDeepByteBundleCasAuthorityV2(input: Readonly<{
  sql: postgres.Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  testHooks?: Readonly<{
    afterArtifactRead?: (context: Readonly<{
      target: string;
      artifactHash: string;
      byteLength: number;
    }>) => void | Promise<void>;
  }>;
}>): DeepByteBundleCasAuthorityV2 {
  const store = new ContentAddressedArtifactStore(input.artifactRoot, {
    limits: input.artifactLimits,
    capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
      sql: input.sql,
      artifactRoot: input.artifactRoot,
      purpose: "reader",
    }),
    ...(input.testHooks ? { testHooks: input.testHooks } : {}),
  });
  return new DeepByteBundleCasAuthorityV2(
    casAuthorityConstructorCapabilityV2,
    Object.freeze({
      store,
      index: createArtifactIndex(input.sql),
    }),
  );
}

function unpooledBufferCopy(bytes: Uint8Array): Buffer {
  const copy = Buffer.allocUnsafeSlow(bytes.byteLength);
  Uint8Array.prototype.set.call(copy, bytes);
  return copy;
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

export class VerifiedDeepByteBundleV2 {
  readonly receipt: Readonly<DeepByteBundleVerificationReceiptV2>;

  constructor(
    capability: object,
    receipt: DeepByteBundleVerificationReceiptV2,
    bytes: Buffer,
  ) {
    if (capability !== verifiedHandleConstructorCapabilityV2) {
      throw new DeepByteBundleVerificationErrorV2(
        "DEEP_BYTE_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
        "Verified Deep ByteBundle handle constructor authority is unavailable",
      );
    }
    this.receipt = deepFreezeJson(receipt);
    privateVerifiedBytesV2.set(this, unpooledBufferCopy(bytes));
    Object.freeze(this);
  }
}

export function copyVerifiedDeepByteBundleBytesV2(
  handle: VerifiedDeepByteBundleV2,
): Buffer {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle) !== VerifiedDeepByteBundleV2.prototype
  ) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
      "Verified Deep ByteBundle byte access requires an authentic handle",
    );
  }
  const bytes = privateVerifiedBytesV2.get(handle);
  if (!bytes) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_HANDLE_UNAUTHENTICATED",
      "Verified Deep ByteBundle byte access requires an authentic handle",
    );
  }
  return unpooledBufferCopy(bytes);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactInputRecord(
  input: unknown,
): Readonly<{
  authority: unknown;
  binding: unknown;
  bundle: unknown;
}> {
  try {
    if (
      input === null
      || typeof input !== "object"
      || isProxy(input)
      || Array.isArray(input)
    ) throw new TypeError("input must be a non-proxied plain object");
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("input must use the ordinary or null object prototype");
    }
    const exactKeys = ["authority", "binding", "bundle"];
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== exactKeys.length
      || keys.some((key) => typeof key !== "string" || !exactKeys.includes(key))
    ) throw new TypeError("input must contain exactly authority, binding, bundle");
    const values = new Map<string, unknown>();
    for (const key of exactKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError(`input.${key} must be an enumerable data property`);
      }
      values.set(key, descriptor.value);
    }
    return {
      authority: values.get("authority"),
      binding: values.get("binding"),
      bundle: values.get("bundle"),
    };
  } catch (error) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_INPUT_INVALID",
      "Deep ByteBundle verification input is invalid",
      { cause: error },
    );
  }
}

function boundedJsonSnapshot(value: unknown): unknown {
  return JSON.parse(canonicalJsonBytesBounded(value, {
    maxBytes: 128 * 1024,
    ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  }).toString("utf8"));
}

function parsePublicAuthorityInput(input: Readonly<{
  binding: unknown;
  bundle: unknown;
}>): Readonly<{
  binding: DeepByteBundleConsumerBindingV2;
  bundle: DeepByteBundleExpectedRefV2;
}> {
  try {
    return {
      binding: DeepByteBundleConsumerBindingV2Schema.parse(
        boundedJsonSnapshot(input.binding),
      ),
      bundle: DeepByteBundleExpectedRefV2Schema.parse(
        boundedJsonSnapshot(input.bundle),
      ),
    };
  } catch (error) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_INPUT_INVALID",
      "Deep ByteBundle binding or expected bundle reference is invalid",
      { cause: error },
    );
  }
}

const concreteArtifactStoreGet = ContentAddressedArtifactStore.prototype.get;

async function readRoot(
  store: ContentAddressedArtifactStore,
  hash: string,
): Promise<ArtifactGetResult> {
  try {
    return await concreteArtifactStoreGet.call(store, hash);
  } catch (error) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_ROOT_UNAVAILABLE",
      `Deep ByteBundle root ${hash} is unavailable from the exact CAS reader`,
      { artifactHash: hash, cause: error },
    );
  }
}

function assertExpectedRoot(
  stored: ArtifactGetResult,
  expected: DeepByteBundleExpectedRefV2,
) {
  const parsed = parseByteBundleEnvelopeV1(stored.envelope);
  if (
    stored.hash !== expected.envelopeHash
    || stored.envelope.artifactType !== BYTE_BUNDLE_ARTIFACT_TYPE_V1
    || stored.bytes.length !== expected.envelopeByteLength
    || parsed.status !== "parsed"
    || parsed.envelopeHash !== expected.envelopeHash
    || parsed.envelopeByteLength !== expected.envelopeByteLength
    || parsed.rawHash !== expected.rawHash
    || parsed.rawByteLength !== expected.rawByteLength
  ) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_ROOT_IDENTITY_MISMATCH",
      `Deep ByteBundle root ${expected.envelopeHash} differs from its expected identity`,
      { artifactHash: expected.envelopeHash },
    );
  }
  return parsed;
}

async function readEveryChunk(
  store: ContentAddressedArtifactStore,
  references: readonly Readonly<{ chunkEnvelopeHash: string }>[],
): Promise<readonly ArtifactGetResult[]> {
  const reads = references.map((reference) =>
    concreteArtifactStoreGet.call(store, reference.chunkEnvelopeHash));
  const settled = await Promise.allSettled(reads);
  const firstFailure = settled.findIndex((result) => result.status === "rejected");
  if (firstFailure >= 0) {
    const reference = references[firstFailure]!;
    const rejected = settled[firstFailure] as PromiseRejectedResult;
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_CHUNK_UNAVAILABLE",
      `Deep ByteBundle chunk ${reference.chunkEnvelopeHash} is unavailable or corrupt`,
      { artifactHash: reference.chunkEnvelopeHash, cause: rejected.reason },
    );
  }
  return Object.freeze(settled.map((result) =>
    (result as PromiseFulfilledResult<ArtifactGetResult>).value));
}

function rootIdentity(stored: ArtifactGetResult) {
  const parsed = ArtifactPublicationBatchIdentityItemSchema.safeParse({
    hash: stored.hash,
    artifactType: stored.envelope.artifactType,
    byteLength: stored.bytes.length,
    producer: stored.envelope.producer,
  });
  if (!parsed.success) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_ROOT_IDENTITY_MISMATCH",
      `Deep ByteBundle root ${stored.hash} lacks an exact publication identity`,
      { artifactHash: stored.hash, cause: parsed.error },
    );
  }
  return parsed.data;
}

function identityForStored(stored: ArtifactGetResult): ArtifactIdentity {
  return rootIdentity(stored);
}

function sameIndexedIdentity(
  expected: ArtifactIdentity,
  observed: ArtifactIdentity | undefined,
): boolean {
  return observed !== undefined
    && observed.hash === expected.hash
    && observed.artifactType === expected.artifactType
    && observed.byteLength === expected.byteLength
    && hashCanonicalJson(observed.producer) === hashCanonicalJson(expected.producer);
}

async function assertEveryArtifactIndexed(
  index: Pick<ReturnType<typeof createArtifactIndex>, "getArtifact">,
  artifacts: readonly ArtifactGetResult[],
): Promise<void> {
  const expected = artifacts.map(identityForStored);
  const settled = await Promise.allSettled(
    expected.map((identity) => index.getArtifact(identity.hash)),
  );
  const failed = settled.findIndex((result) => result.status === "rejected");
  if (failed >= 0) {
    const rejected = settled[failed] as PromiseRejectedResult;
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_INDEX_UNAVAILABLE",
      `Deep ByteBundle index lookup for ${expected[failed]!.hash} failed`,
      { artifactHash: expected[failed]!.hash, cause: rejected.reason },
    );
  }
  for (const [position, identity] of expected.entries()) {
    const observed = (settled[position] as PromiseFulfilledResult<
      ArtifactIdentity | undefined
    >).value;
    if (sameIndexedIdentity(identity, observed)) continue;
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_INDEX_IDENTITY_MISMATCH",
      `Deep ByteBundle artifact ${identity.hash} is absent or differs in the semantic artifact index`,
      { artifactHash: identity.hash },
    );
  }
}

function reassembleVerifiedBytes(
  root: ReturnType<typeof parseByteBundleEnvelopeV1> & { status: "parsed" },
  chunks: readonly ArtifactGetResult[],
): Buffer {
  const byHash = new Map(chunks.map((stored) => [stored.hash, stored]));
  const parts = root.envelope.payload.chunks.map((reference) => {
    const stored = byHash.get(reference.chunkEnvelopeHash);
    const parsed = stored && parseByteChunkEnvelopeV1(stored.envelope);
    if (
      !stored
      || stored.envelope.artifactType !== BYTE_CHUNK_ARTIFACT_TYPE_V1
      || parsed?.status !== "parsed"
      || parsed.envelopeHash !== reference.chunkEnvelopeHash
      || parsed.envelopeByteLength !== reference.chunkEnvelopeByteLength
      || parsed.rawHash !== reference.chunkRawHash
      || parsed.rawByteLength !== reference.rawByteLength
    ) {
      throw new DeepByteBundleVerificationErrorV2(
        "DEEP_BYTE_BUNDLE_V2_REASSEMBLY_MISMATCH",
        `Deep ByteBundle chunk ${reference.chunkEnvelopeHash} changed after closure verification`,
        { artifactHash: reference.chunkEnvelopeHash },
      );
    }
    return Buffer.from(parsed.envelope.payload.bytesBase64, "base64");
  });
  const raw = Buffer.concat(parts, root.rawByteLength);
  if (raw.length !== root.rawByteLength || sha256(raw) !== root.rawHash) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_REASSEMBLY_MISMATCH",
      `Deep ByteBundle root ${root.envelopeHash} did not reassemble to its exact raw identity`,
      { artifactHash: root.envelopeHash },
    );
  }
  return raw;
}

/**
 * Reads a ByteBundle root and every declared chunk through the concrete hybrid
 * CAS capability. Public receipt data is never sufficient to recover bytes;
 * only the returned process-local authenticated handle carries that authority.
 */
export async function verifyDeepByteBundleFromCasV2(
  input: Readonly<{
    authority: DeepByteBundleCasAuthorityV2;
    binding: DeepByteBundleConsumerBindingV2;
    bundle: DeepByteBundleExpectedRefV2;
  }>,
): Promise<VerifiedDeepByteBundleV2> {
  const outer = exactInputRecord(input);
  const state = typeof outer.authority === "object"
    && outer.authority !== null
    && !isProxy(outer.authority)
    && Object.getPrototypeOf(outer.authority) === DeepByteBundleCasAuthorityV2.prototype
    ? privateCasAuthorityStateV2.get(outer.authority)
    : undefined;
  if (!state) {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_PRODUCTION_AUTHORITY_REQUIRED",
      "Deep ByteBundle verification requires an authenticated hybrid CAS and Postgres index authority",
    );
  }
  const authority = parsePublicAuthorityInput({
    binding: outer.binding,
    bundle: outer.bundle,
  });
  const storedRoot = await readRoot(state.store, authority.bundle.envelopeHash);
  const parsedRoot = assertExpectedRoot(storedRoot, authority.bundle);

  // Start and settle every declared exact read before semantic closure
  // classification. A missing first chunk cannot hide later CAS drift.
  const storedChunks = await readEveryChunk(
    state.store,
    parsedRoot.envelope.payload.chunks,
  );
  await assertEveryArtifactIndexed(state.index, [storedRoot, ...storedChunks]);
  const evidence = prepareArtifactClosureEvidenceSetV1([
    storedRoot,
    ...storedChunks,
  ]);
  const closure = evaluateArtifactClosureV1({
    evidence,
    root: rootIdentity(storedRoot),
    role: "dependency-root",
  });
  if (closure.status !== "verified") {
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_CLOSURE_REJECTED",
      `Deep ByteBundle root ${storedRoot.hash} closure was rejected as ${closure.classification}`,
      { artifactHash: storedRoot.hash, closure },
    );
  }
  const rawBytes = reassembleVerifiedBytes(parsedRoot, storedChunks);
  const receiptIdentity = {
    schema: DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_V2_SCHEMA,
    receiptVersion: DEEP_BYTE_BUNDLE_VERIFICATION_RECEIPT_VERSION_V2,
    status: "verified" as const,
    verifier: {
      contractRef: DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_REF_V2,
      contractVersion: DEEP_BYTE_BUNDLE_VERIFIER_CONTRACT_VERSION_V2,
      closureRegistrySchema: ARTIFACT_CLOSURE_REGISTRY_SCHEMA_V1,
      casReadAuthority: "hybrid-postgres-filesystem-v1" as const,
      indexReadAuthority: "semantic-artifacts-postgres-v1" as const,
    },
    binding: authority.binding,
    bundle: authority.bundle,
    chunkCount: parsedRoot.envelope.payload.chunks.length,
    chunks: parsedRoot.envelope.payload.chunks,
    closureMemberCount: closure.members.length,
    closureEvidenceHash: hashCanonicalJson(closure),
  };
  const candidate = {
    ...receiptIdentity,
    receiptHash: hashDeepByteBundleVerificationReceiptV2(receiptIdentity),
  };
  const parsedReceipt = DeepByteBundleVerificationReceiptV2Schema.safeParse(candidate);
  if (!parsedReceipt.success) {
    rawBytes.fill(0);
    throw new DeepByteBundleVerificationErrorV2(
      "DEEP_BYTE_BUNDLE_V2_RECEIPT_INVALID",
      "Deep ByteBundle verifier produced an invalid canonical receipt",
      { artifactHash: storedRoot.hash, cause: parsedReceipt.error },
    );
  }
  const handle = new VerifiedDeepByteBundleV2(
    verifiedHandleConstructorCapabilityV2,
    parsedReceipt.data,
    rawBytes,
  );
  rawBytes.fill(0);
  return handle;
}
