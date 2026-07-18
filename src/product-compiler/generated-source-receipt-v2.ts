import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isProxy, isSharedArrayBuffer } from "node:util/types";

import { z } from "zod";

import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
  type PreparedArtifactStoreBatchV1,
} from "./artifact-store-batch-plan.js";
import { DEFAULT_ARTIFACT_CAPACITY_LIMITS } from "./artifact-capacity.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { SemanticArtifactEnvelopeV1Schema, type SemanticArtifactEnvelopeV1 } from "./artifact-envelope.js";
import { bindGeneratedSourceAuthoritiesV2 } from "./generated-source-authority-v2.js";
import {
  compileDesignSourceClosureV2,
  DesignSourceClosureCompilerInputV2Schema,
  type DesignSourceClosureCompilerInputV2,
} from "./design-source-closure-compiler-v2.js";
import { produceDesignInteractionGraphV2 } from "./producers/design-graph-v2.js";
import { produceDesignGenerationTargetsV2 } from "./producers/design-targets-v2.js";
import type { DesignInteractionGraphV2 } from "./schemas/design-interaction-graph-v2.js";
import type { DesignGenerationTargetsV2 } from "./schemas/design-generation-targets-v2.js";
import type { DesignSourceClosureV2 } from "./schemas/design-source-closure-v2.js";
import {
  GitCodeShaSchema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  SourceArtifactRefV1Schema,
  type SemanticArtifactProducerV1,
} from "./schemas/common-v1.js";
import { GenerationTargetIdSchema } from "./schemas/design-generation-targets-v1.js";
import {
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  createByteBundleV1,
  type ByteBundleArtifactV1,
  type ByteChunkArtifactV1,
} from "./schemas/byte-bundle-v1.js";
import {
  GeneratedSourceReceiptSetCommitmentV2Schema,
  GENERATED_SOURCE_RECEIPT_MAX_RAW_BYTES_V2,
  GeneratedSourceReceiptV2Schema,
  generatedSourceReceiptRefV2,
  hashGeneratedSourceReceiptEntryCommitmentV2,
  hashGeneratedSourceReceiptSetCommitmentV2,
  hashGeneratedSourceSemanticIdentityClosureV2,
  type GeneratedSourceReceiptEntryAuthorityV2,
  type GeneratedSourceReceiptSetCommitmentV2,
  type GeneratedSourceReceiptV2,
  type GeneratedSourceSemanticIdentityClosureV2,
} from "./schemas/generated-source-receipt-v2.js";
import {
  GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
  STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
} from "./schemas/generated-source-contract-v2.js";
import { ProductSpecV2Schema, type ProductSpecV2 } from "./schemas/product-spec-v2.js";
import { StitchScreenIndexV2Schema } from "./schemas/stitch-screen-index-v2.js";

export const GENERATED_SOURCE_RELEASE_AUTHORITY_SCHEMA_V2 =
  "setfarm.generated-source-release-authority.v2" as const;
export const GENERATED_SOURCE_RECEIPT_MAX_SOURCE_BYTES_V2 = 14 * 1024 * 1024;
export const GENERATED_SOURCE_RECEIPT_MAX_AGGREGATE_SOURCE_BYTES_V2 = 128 * 1024 * 1024;
export const GENERATED_SOURCE_RECEIPT_MAX_GENERATOR_BYTES_V2 = 2 * 1024 * 1024;
export const GENERATED_SOURCE_RECEIPT_MAX_METADATA_BYTES_V2 = 64 * 1024 * 1024;
export const GENERATED_SOURCE_RECEIPT_MAX_VERIFICATION_GROUP_BYTES_V2 = 32 * 1024 * 1024;

const MAX_DIAGNOSTICS = 200;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
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

if (GENERATED_SOURCE_RECEIPT_MAX_SOURCE_BYTES_V2 !== GENERATED_SOURCE_RECEIPT_MAX_RAW_BYTES_V2) {
  throw new Error("Generated-source receipt schema/compiler raw-byte limits disagree");
}

const ExactSourceBytesV2Schema = z.custom<Uint8Array>(
  (value) => value instanceof Uint8Array && !isProxy(value),
  "Expected non-proxied exact source bytes",
);

const ExactGeneratorSourceV2Schema = z.object({
  source: SourceArtifactRefV1Schema,
  bytes: ExactSourceBytesV2Schema,
}).strict();

const ExactScreenIndexSourceV2Schema = z.object({
  source: SourceArtifactRefV1Schema,
  bytes: ExactSourceBytesV2Schema,
}).strict();

const ExactGeneratedSourceV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  responseScreenId: z.string().min(1).max(500),
  source: SourceArtifactRefV1Schema,
  bytes: ExactSourceBytesV2Schema,
}).strict();

export const GeneratedSourceReleaseAuthorityV2Schema = z.object({
  schema: z.literal(GENERATED_SOURCE_RELEASE_AUTHORITY_SCHEMA_V2),
  codeSha: GitCodeShaSchema,
  generatorPlatformBundleHash: Sha256Schema,
}).strict();

export type GeneratedSourceReleaseAuthorityV2 = z.infer<
  typeof GeneratedSourceReleaseAuthorityV2Schema
>;

export const GeneratedSourceReceiptCompilerInputV2Schema = z.object({
  producer: SemanticArtifactProducerV1Schema,
  releaseAuthority: GeneratedSourceReleaseAuthorityV2Schema,
  productSpec: ProductSpecV2Schema,
  designSourceClosureInput: DesignSourceClosureCompilerInputV2Schema,
  generatorImplementationSource: ExactGeneratorSourceV2Schema,
  screenIndexSource: ExactScreenIndexSourceV2Schema,
  generatedSources: z.array(ExactGeneratedSourceV2Schema).min(1).max(1_000),
}).strict().superRefine((value, context) => {
  if (value.producer.codeSha !== value.releaseAuthority.codeSha) {
    context.addIssue({
      code: "custom",
      path: ["releaseAuthority", "codeSha"],
      message: "Generated-source release code SHA must equal the receipt producer code SHA",
    });
  }
  if (value.designSourceClosureInput.kind !== "stitch") {
    context.addIssue({
      code: "custom",
      path: ["designSourceClosureInput", "kind"],
      message: "GeneratedSourceReceiptV2 requires the exact Stitch closure compiler input",
    });
  }
  if (
    value.generatorImplementationSource.bytes.byteLength < 1
    || value.generatorImplementationSource.bytes.byteLength > GENERATED_SOURCE_RECEIPT_MAX_GENERATOR_BYTES_V2
  ) {
    context.addIssue({
      code: "custom",
      path: ["generatorImplementationSource", "bytes"],
      message: "Generator implementation bytes exceed their exact bounded authority",
    });
  }
  if (
    value.screenIndexSource.bytes.byteLength < 1
    || value.screenIndexSource.bytes.byteLength > GENERATED_SOURCE_RECEIPT_MAX_SOURCE_BYTES_V2
  ) {
    context.addIssue({
      code: "custom",
      path: ["screenIndexSource", "bytes"],
      message: "SCREEN_INDEX bytes exceed their exact bounded authority",
    });
  }
  let aggregateBytes = 0;
  for (const [index, source] of value.generatedSources.entries()) {
    if (source.bytes.byteLength < 1 || source.bytes.byteLength > GENERATED_SOURCE_RECEIPT_MAX_SOURCE_BYTES_V2) {
      context.addIssue({
        code: "custom",
        path: ["generatedSources", index, "bytes"],
        message: "Generated source must contain 1..14 MiB exact raw bytes",
      });
    }
    aggregateBytes += source.bytes.byteLength;
    if (
      !Number.isSafeInteger(aggregateBytes)
      || aggregateBytes > GENERATED_SOURCE_RECEIPT_MAX_AGGREGATE_SOURCE_BYTES_V2
    ) {
      context.addIssue({
        code: "custom",
        path: ["generatedSources"],
        message: "Generated-source aggregate raw-byte capacity exceeds 128 MiB",
      });
      break;
    }
  }
});

export type GeneratedSourceReceiptCompilerInputV2 = z.infer<
  typeof GeneratedSourceReceiptCompilerInputV2Schema
>;

const CandidatePublicationGroupV2Schema = z.object({
  targetRef: GenerationTargetIdSchema,
  envelopes: z.array(z.unknown()).min(3).max(9),
}).strict();

export type GeneratedSourceReceiptDiagnosticV2 = Readonly<{
  code:
    | "GENERATED_SOURCE_RECEIPT_V2_INPUT_INVALID"
    | "GENERATED_SOURCE_RECEIPT_V2_AUTHORITY_MISMATCH"
    | "GENERATED_SOURCE_RECEIPT_V2_SOURCE_INVALID"
    | "GENERATED_SOURCE_RECEIPT_V2_PUBLICATION_INCOMPATIBLE"
    | "GENERATED_SOURCE_RECEIPT_V2_VERIFICATION_INPUT_INVALID"
    | "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_INVALID"
    | "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_MISMATCH";
  message: string;
  reference: string;
}>;

export type GeneratedSourceReceiptPublicationV2 = Readonly<{
  targetRef: string;
  receipt: Readonly<GeneratedSourceReceiptV2>;
  receiptEnvelope: Readonly<SemanticArtifactEnvelopeV1>;
  receiptArtifactHash: string;
  receiptArtifactByteLength: number;
  generatedSourceBundleArtifactHash: string;
  generatedSourceContentHash: string;
  generatedSourceByteLength: number;
  publicationEnvelopes: readonly Readonly<SemanticArtifactEnvelopeV1>[];
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type GeneratedSourceReceiptCompilationResultV2 =
  | Readonly<{
      status: "compiled";
      diagnostics: readonly [];
      receiptSet: Readonly<GeneratedSourceReceiptSetCommitmentV2>;
      publications: readonly GeneratedSourceReceiptPublicationV2[];
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly GeneratedSourceReceiptDiagnosticV2[];
    }>;

export type GeneratedSourceReceiptVerificationResultV2 =
  | Readonly<{
      status: "verified";
      diagnostics: readonly [];
      receiptSet: Readonly<GeneratedSourceReceiptSetCommitmentV2>;
      publications: readonly GeneratedSourceReceiptPublicationV2[];
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly GeneratedSourceReceiptDiagnosticV2[];
    }>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function diagnostic(
  code: GeneratedSourceReceiptDiagnosticV2["code"],
  message: string,
  reference: string,
): GeneratedSourceReceiptDiagnosticV2 {
  return Object.freeze({
    code,
    message: message.slice(0, 1_500),
    reference: reference.slice(0, 500),
  });
}

function compareDiagnostics(
  left: GeneratedSourceReceiptDiagnosticV2,
  right: GeneratedSourceReceiptDiagnosticV2,
): number {
  return compareUtf16(
    `${left.code}\0${left.reference}\0${left.message}`,
    `${right.code}\0${right.reference}\0${right.message}`,
  );
}

function diagnosticsFromZod(
  code: GeneratedSourceReceiptDiagnosticV2["code"],
  error: z.ZodError,
): GeneratedSourceReceiptDiagnosticV2[] {
  const retained = error.issues.slice(0, MAX_DIAGNOSTICS - 1).map((issue) => diagnostic(
    code,
    issue.message,
    issue.path.length > 0 ? issue.path.join(".") : "generatedSourceReceipt",
  ));
  if (error.issues.length >= MAX_DIAGNOSTICS) {
    retained.push(diagnostic(
      code,
      `Validation produced ${error.issues.length} diagnostics; retained the canonical first ${MAX_DIAGNOSTICS - 1}`,
      "generatedSourceReceipt",
    ));
  }
  return retained.sort(compareDiagnostics);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown generated-source receipt failure";
}

function boundedJsonSnapshot(value: unknown, maxBytes: number): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth,
    maxNodes: 750_000,
    maxContainerEntries: 200_000,
    maxWorkUnits: 256 * 1024 * 1024,
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
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) stack.push(child);
    }
    Object.freeze(current);
  }
  return value;
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
  ) throw new TypeError(`${label} must be a non-proxied plain object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must use the ordinary or null object prototype`);
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== exactKeys.length
    || keys.some((key) => typeof key !== "string" || !exactKeys.includes(key))
  ) throw new TypeError(`${label} must contain exactly ${exactKeys.join(", ")}`);
  const result = new Map<string, unknown>();
  for (const key of exactKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`${label}.${key} must be an enumerable data property`);
    }
    result.set(key, descriptor.value);
  }
  return result;
}

function copyExactBytes(value: unknown, maximum: number, label: string): Buffer {
  if (value === null || typeof value !== "object" || isProxy(value)) {
    throw new TypeError(`${label} must be a non-proxied Uint8Array`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
    throw new TypeError(`${label} must not use a custom typed-array subclass`);
  }
  for (const property of ["buffer", "byteLength", "byteOffset", "length"] as const) {
    if (Object.getOwnPropertyDescriptor(value, property)) {
      throw new TypeError(`${label} must not shadow intrinsic typed-array ${property}`);
    }
  }
  let backingBuffer: ArrayBufferLike;
  let observedLength: number;
  let observedOffset: number;
  try {
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []) as ArrayBufferLike;
    observedLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as number;
    observedOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as number;
  } catch {
    throw new TypeError(`${label} lacks exact intrinsic typed-array storage`);
  }
  if (isSharedArrayBuffer(backingBuffer)) {
    throw new TypeError(`${label} must not use shared mutable memory`);
  }
  if (observedLength < 1 || observedLength > maximum) {
    throw new RangeError(`${label} must contain 1..${maximum} raw bytes`);
  }
  try {
    const source = new Uint8Array(backingBuffer, observedOffset, observedLength);
    const first = Buffer.allocUnsafeSlow(observedLength);
    const second = Buffer.allocUnsafeSlow(observedLength);
    Uint8Array.prototype.set.call(first, source);
    Uint8Array.prototype.set.call(second, source);
    const finalBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []) as ArrayBufferLike;
    const finalLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as number;
    const finalOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as number;
    if (
      finalBuffer !== backingBuffer
      || finalLength !== observedLength
      || finalOffset !== observedOffset
      || !first.equals(second)
    ) throw new TypeError(`${label} changed during its bounded byte snapshot`);
    return first;
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(label)) throw error;
    throw new TypeError(`${label} changed during its bounded byte snapshot`);
  }
}

function snapshotGeneratedSources(value: unknown): ReadonlyArray<Readonly<{
  targetRef: unknown;
  responseScreenId: unknown;
  source: unknown;
  bytes: Buffer;
}>> {
  if (
    value === null
    || typeof value !== "object"
    || isProxy(value)
    || !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
  ) throw new TypeError("generatedSources must be a non-proxied ordinary array");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor && "value" in lengthDescriptor
    ? lengthDescriptor.value
    : undefined;
  if (!Number.isSafeInteger(length) || length < 1 || length > 1_000) {
    throw new RangeError("generatedSources must contain 1..1000 dense entries");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1 || !ownKeys.includes("length")) {
    throw new TypeError("generatedSources must be dense and contain only indexed entries");
  }
  const sources: Array<Readonly<{
    targetRef: unknown;
    responseScreenId: unknown;
    source: unknown;
    bytes: Buffer;
  }>> = [];
  let aggregateBytes = 0;
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`generatedSources[${index}] must be an enumerable data property`);
    }
    const source = plainRecordData(
      descriptor.value,
      ["targetRef", "responseScreenId", "source", "bytes"],
      `generatedSources[${index}]`,
    );
    const bytes = copyExactBytes(
      source.get("bytes"),
      GENERATED_SOURCE_RECEIPT_MAX_SOURCE_BYTES_V2,
      `generatedSources[${index}].bytes`,
    );
    aggregateBytes += bytes.length;
    if (
      !Number.isSafeInteger(aggregateBytes)
      || aggregateBytes > GENERATED_SOURCE_RECEIPT_MAX_AGGREGATE_SOURCE_BYTES_V2
    ) throw new RangeError("Generated-source aggregate raw bytes exceed 128 MiB");
    sources.push(Object.freeze({
      targetRef: source.get("targetRef"),
      responseScreenId: source.get("responseScreenId"),
      source: source.get("source"),
      bytes,
    }));
  }
  return Object.freeze(sources);
}

function snapshotCandidateGroupValues(value: unknown): readonly unknown[] {
  if (
    value === null
    || typeof value !== "object"
    || isProxy(value)
    || !Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
  ) throw new TypeError("candidatePublications must be a non-proxied ordinary array");
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const length = lengthDescriptor && "value" in lengthDescriptor
    ? lengthDescriptor.value
    : undefined;
  if (!Number.isSafeInteger(length) || length < 1 || length > 1_000) {
    throw new RangeError("candidatePublications must contain 1..1000 dense groups");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== length + 1 || !ownKeys.includes("length")) {
    throw new TypeError("candidatePublications must be dense and contain only indexed groups");
  }
  const groups: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      throw new TypeError(`candidatePublications[${index}] must be an enumerable data property`);
    }
    groups.push(descriptor.value);
  }
  return Object.freeze(groups);
}

function snapshotCompilerInput(value: unknown): unknown {
  const outer = plainRecordData(value, [
    "producer",
    "releaseAuthority",
    "productSpec",
    "designSourceClosureInput",
    "generatorImplementationSource",
    "screenIndexSource",
    "generatedSources",
  ], "GeneratedSourceReceiptV2 compiler input");
  const generator = plainRecordData(
    outer.get("generatorImplementationSource"),
    ["source", "bytes"],
    "generatorImplementationSource",
  );
  const screenIndex = plainRecordData(
    outer.get("screenIndexSource"),
    ["source", "bytes"],
    "screenIndexSource",
  );
  const generatedSources = snapshotGeneratedSources(outer.get("generatedSources"));
  const metadata = boundedJsonSnapshot({
    producer: outer.get("producer"),
    releaseAuthority: outer.get("releaseAuthority"),
    productSpec: outer.get("productSpec"),
    designSourceClosureInput: outer.get("designSourceClosureInput"),
    generatorImplementationSource: { source: generator.get("source") },
    screenIndexSource: { source: screenIndex.get("source") },
    generatedSources: generatedSources.map((source) => ({
      targetRef: source.targetRef,
      responseScreenId: source.responseScreenId,
      source: source.source,
    })),
  }, GENERATED_SOURCE_RECEIPT_MAX_METADATA_BYTES_V2) as Record<string, unknown>;
  const generatorMetadata = metadata.generatorImplementationSource as Record<string, unknown>;
  const screenIndexMetadata = metadata.screenIndexSource as Record<string, unknown>;
  const sourceMetadata = metadata.generatedSources as Array<Record<string, unknown>>;
  return {
    producer: metadata.producer,
    releaseAuthority: metadata.releaseAuthority,
    productSpec: metadata.productSpec,
    designSourceClosureInput: metadata.designSourceClosureInput,
    generatorImplementationSource: {
      source: generatorMetadata.source,
      bytes: copyExactBytes(
        generator.get("bytes"),
        GENERATED_SOURCE_RECEIPT_MAX_GENERATOR_BYTES_V2,
        "generatorImplementationSource.bytes",
      ),
    },
    screenIndexSource: {
      source: screenIndexMetadata.source,
      bytes: copyExactBytes(
        screenIndex.get("bytes"),
        GENERATED_SOURCE_RECEIPT_MAX_SOURCE_BYTES_V2,
        "screenIndexSource.bytes",
      ),
    },
    generatedSources: generatedSources.map((source, index) => ({
      targetRef: sourceMetadata[index]!.targetRef,
      responseScreenId: sourceMetadata[index]!.responseScreenId,
      source: sourceMetadata[index]!.source,
      bytes: source.bytes,
    })),
  };
}

function rawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function decodeExactUtf8(bytes: Uint8Array, label: string): string {
  let text: string;
  try {
    text = utf8Decoder.decode(bytes);
  } catch {
    throw new TypeError(`${label} is not exact fatal UTF-8`);
  }
  if (text.includes("\0") || !Buffer.from(text, "utf8").equals(Buffer.from(bytes))) {
    throw new TypeError(`${label} does not round-trip as exact NUL-free UTF-8`);
  }
  return text;
}

function exactBytesMatchRef(source: Readonly<{
  source: { hash: string; byteLength: number };
  bytes: Uint8Array;
}>): boolean {
  return source.source.hash === rawSha256(source.bytes)
    && source.source.byteLength === source.bytes.byteLength;
}

function reject(
  diagnostics: readonly GeneratedSourceReceiptDiagnosticV2[],
): GeneratedSourceReceiptCompilationResultV2 {
  return Object.freeze({
    status: "rejected",
    diagnostics: Object.freeze([...diagnostics].sort(compareDiagnostics)),
  });
}

type EntryPreparation = Readonly<{
  targetRef: string;
  responseScreenId: string;
  sourceLocator: string;
  semanticIdentityClosure: GeneratedSourceSemanticIdentityClosureV2;
  screenIndexEntryHash: string;
  componentApiHash: string;
  bundle: ByteBundleArtifactV1;
  chunks: readonly ByteChunkArtifactV1[];
  entryAuthority: GeneratedSourceReceiptEntryAuthorityV2;
  entryCommitmentHash: string;
}>;

type BoundCompilerInputV2 = Readonly<{
  producer: SemanticArtifactProducerV1;
  releaseAuthority: GeneratedSourceReleaseAuthorityV2;
  productSpec: ProductSpecV2;
  designSourceClosureInput: Extract<DesignSourceClosureCompilerInputV2, { kind: "stitch" }>;
  designSourceClosure: DesignSourceClosureV2;
  generationTargets: DesignGenerationTargetsV2;
  designGraph: DesignInteractionGraphV2;
  generatorImplementationSource: GeneratedSourceReceiptCompilerInputV2["generatorImplementationSource"];
  generatorImplementationText: string;
  screenIndex: z.infer<typeof StitchScreenIndexV2Schema>;
  screenIndexSource: GeneratedSourceReceiptCompilerInputV2["screenIndexSource"];
  screenIndexText: string;
  generatedSources: readonly (GeneratedSourceReceiptCompilerInputV2["generatedSources"][number]
    & Readonly<{ text: string }>)[];
}>;

function bindCompilerAuthority(
  input: GeneratedSourceReceiptCompilerInputV2,
): BoundCompilerInputV2 {
  if (input.designSourceClosureInput.kind !== "stitch") {
    throw new Error("GeneratedSourceReceiptV2 requires Stitch design-source closure authority");
  }
  const productSpecHash = hashCanonicalJson(input.productSpec);
  if (input.designSourceClosureInput.productSpecV2Hash !== productSpecHash) {
    throw new Error("Closure compiler input does not bind the exact ProductSpecV2 payload");
  }
  const targets = produceDesignGenerationTargetsV2(input.productSpec);
  if (targets.status !== "produced") {
    throw new Error(
      `Fresh DesignGenerationTargetsV2 reproduction failed: ${targets.rejectionCodes.join(",")}`,
    );
  }
  const closure = compileDesignSourceClosureV2(input.designSourceClosureInput);
  if (closure.status !== "compiled" || closure.closure.kind !== "stitch") {
    throw new Error(
      `Fresh DesignSourceClosureV2 reproduction failed: ${closure.status === "rejected"
        ? closure.issues.map((issue) => issue.code).join(",")
        : "wrong_kind"}`,
    );
  }
  const closureInput = input.designSourceClosureInput;
  if (
    canonicalJsonStringify(closureInput.generationTargets.envelope.payload)
      !== canonicalJsonStringify(targets.generationTargets)
  ) {
    throw new Error("Closure generation-target payload differs from fresh ProductSpecV2 projection");
  }
  const graph = produceDesignInteractionGraphV2({
    productSpec: input.productSpec,
    generationTargets: targets.generationTargets,
    renderedSemantics: closureInput.renderedSemantics.envelope.payload,
    candidateSelection: closureInput.candidateSelection.envelope.payload,
    responseBindings: closureInput.responseBindings.envelope.payload,
  });
  if (
    canonicalJsonStringify(closureInput.designGraph.envelope.payload)
      !== canonicalJsonStringify(graph.designGraph)
  ) {
    throw new Error("Closure design graph differs from fresh deterministic graph reproduction");
  }
  if (
    input.generatorImplementationSource.source.locator !== "scripts/stitch-to-jsx.mjs"
    || input.generatorImplementationSource.source.mediaType !== "text/javascript"
    || !exactBytesMatchRef(input.generatorImplementationSource)
  ) {
    throw new Error("Generator implementation ref does not bind exact scripts/stitch-to-jsx.mjs bytes");
  }
  if (
    input.screenIndexSource.source.locator !== "src/screens/SCREEN_INDEX.json"
    || input.screenIndexSource.source.mediaType !== "application/json"
    || !exactBytesMatchRef(input.screenIndexSource)
  ) {
    throw new Error("SCREEN_INDEX ref does not bind exact src/screens/SCREEN_INDEX.json bytes");
  }
  const generatorImplementationText = decodeExactUtf8(
    input.generatorImplementationSource.bytes,
    "generatorImplementationSource.bytes",
  );
  const screenIndexText = decodeExactUtf8(input.screenIndexSource.bytes, "screenIndexSource.bytes");
  let rawScreenIndex: unknown;
  try {
    rawScreenIndex = JSON.parse(screenIndexText);
  } catch {
    throw new Error("SCREEN_INDEX bytes are not valid JSON");
  }
  const screenIndex = StitchScreenIndexV2Schema.parse(rawScreenIndex);
  const generatedSources = input.generatedSources.map((source, index) => {
    const extension = source.source.locator.slice(source.source.locator.lastIndexOf(".")).toLowerCase();
    const expectedMediaType = [".ts", ".tsx"].includes(extension)
      ? "text/typescript"
      : [".js", ".jsx"].includes(extension)
        ? "text/javascript"
        : null;
    if (!expectedMediaType || source.source.mediaType !== expectedMediaType || !exactBytesMatchRef(source)) {
      throw new Error(`generatedSources[${index}] ref does not bind its exact raw bytes`);
    }
    return Object.freeze({
      ...source,
      text: decodeExactUtf8(source.bytes, `generatedSources[${index}].bytes`),
    });
  });
  return Object.freeze({
    producer: input.producer,
    releaseAuthority: input.releaseAuthority,
    productSpec: input.productSpec,
    designSourceClosureInput: closureInput,
    designSourceClosure: closure.closure,
    generationTargets: targets.generationTargets,
    designGraph: graph.designGraph,
    generatorImplementationSource: input.generatorImplementationSource,
    generatorImplementationText,
    screenIndex,
    screenIndexSource: input.screenIndexSource,
    screenIndexText,
    generatedSources: Object.freeze(generatedSources),
  });
}

function receiptEnvelope(
  producer: SemanticArtifactProducerV1,
  receipt: GeneratedSourceReceiptV2,
): SemanticArtifactEnvelopeV1 {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
    producer,
    payload: receipt,
  });
}

function preparedPublication(
  chunks: readonly ByteChunkArtifactV1[],
  bundle: ByteBundleArtifactV1,
  receipt: SemanticArtifactEnvelopeV1,
): PreparedArtifactStoreBatchV1 {
  return prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items: [
      ...chunks.map((chunk) => ({ durabilityTier: 0, envelope: chunk.envelope })),
      { durabilityTier: 1, envelope: bundle.envelope },
      { durabilityTier: 2, envelope: receipt },
    ],
  });
}

function snapshotPublication(
  targetRef: string,
  prepared: PreparedArtifactStoreBatchV1,
  occurrenceEnvelopes: readonly SemanticArtifactEnvelopeV1[],
): GeneratedSourceReceiptPublicationV2 {
  const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(prepared);
  const envelopes = items.map((item) => SemanticArtifactEnvelopeV1Schema.parse(
    JSON.parse(item.bytes.toString("utf8")),
  ));
  const receiptIndex = envelopes.findIndex((envelope) =>
    envelope.artifactType === GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2);
  const bundleIndex = envelopes.findIndex((envelope) =>
    envelope.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1);
  if (receiptIndex < 0 || bundleIndex < 0) {
    throw new Error("Generated-source publication lacks one receipt or byte bundle");
  }
  const parsedReceipt = GeneratedSourceReceiptV2Schema.parse(envelopes[receiptIndex]!.payload);
  if (parsedReceipt.targetRef !== targetRef) {
    throw new Error("Generated-source publication target differs from its receipt");
  }
  const immutableOccurrenceEnvelopes = deepFreezeJson(occurrenceEnvelopes.map((envelope) =>
    SemanticArtifactEnvelopeV1Schema.parse(JSON.parse(canonicalJsonStringify(envelope)))));
  const immutableReceiptEnvelope = immutableOccurrenceEnvelopes.find((envelope) =>
    envelope.artifactType === GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2)!;
  const immutableReceipt = immutableReceiptEnvelope.payload as GeneratedSourceReceiptV2;
  return Object.freeze({
    targetRef,
    receipt: immutableReceipt,
    receiptEnvelope: immutableReceiptEnvelope,
    receiptArtifactHash: items[receiptIndex]!.identity.hash,
    receiptArtifactByteLength: items[receiptIndex]!.identity.byteLength,
    generatedSourceBundleArtifactHash: items[bundleIndex]!.identity.hash,
    generatedSourceContentHash: immutableReceipt.generatedSourceContentHash,
    generatedSourceByteLength: immutableReceipt.generatedSourceByteLength,
    publicationEnvelopes: Object.freeze(immutableOccurrenceEnvelopes),
    preparedPublication: prepared,
  });
}

export function compileGeneratedSourceReceiptsV2(
  input: unknown,
): GeneratedSourceReceiptCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = snapshotCompilerInput(input);
  } catch (error) {
    return reject([diagnostic(
      "GENERATED_SOURCE_RECEIPT_V2_INPUT_INVALID",
      errorMessage(error),
      "compilerInput",
    )]);
  }
  const parsed = GeneratedSourceReceiptCompilerInputV2Schema.safeParse(snapshot);
  if (!parsed.success) {
    return reject(diagnosticsFromZod("GENERATED_SOURCE_RECEIPT_V2_INPUT_INVALID", parsed.error));
  }
  let value: BoundCompilerInputV2;
  try {
    value = bindCompilerAuthority(parsed.data);
  } catch (error) {
    return reject([diagnostic(
      "GENERATED_SOURCE_RECEIPT_V2_AUTHORITY_MISMATCH",
      errorMessage(error),
      "authority",
    )]);
  }
  const boundAuthorities = bindGeneratedSourceAuthoritiesV2({
    generationTargets: value.generationTargets,
    designGraph: value.designGraph,
    screenIndex: value.screenIndex,
    generatedSources: value.generatedSources.map((source) => ({
      targetRef: source.targetRef,
      responseScreenId: source.responseScreenId,
      sourceLocator: source.source.locator,
      sourceText: source.text,
    })),
  });
  if (boundAuthorities.status === "rejected") {
    return reject(boundAuthorities.diagnostics.map((item) => diagnostic(
      item.code === "GENERATED_SOURCE_AUTHORITY_V2_SOURCE_INVALID"
        ? "GENERATED_SOURCE_RECEIPT_V2_SOURCE_INVALID"
        : "GENERATED_SOURCE_RECEIPT_V2_AUTHORITY_MISMATCH",
      item.message,
      item.reference,
    )));
  }

  const closureHash = hashCanonicalJson(value.designSourceClosure);
  const screenIndexHash = hashCanonicalJson(value.screenIndex);
  const authorityByTarget = new Map(boundAuthorities.authorities.map((authority) =>
    [authority.targetRef, authority] as const));
  const preparations: EntryPreparation[] = [];
  try {
    for (const source of [...value.generatedSources]
      .sort((left, right) => compareUtf16(left.targetRef, right.targetRef))) {
      const boundAuthority = authorityByTarget.get(source.targetRef)!;
      const screen = boundAuthority.screenIndexEntry;
      const byteBundle = createByteBundleV1({
        bytes: source.bytes,
        producer: value.producer,
      });
      if (byteBundle.status !== "produced") {
        return reject([diagnostic(
          "GENERATED_SOURCE_RECEIPT_V2_PUBLICATION_INCOMPATIBLE",
          `${byteBundle.rejectionCode}: ${byteBundle.issues.map((issue) => issue.message).join(", ")}`,
          source.source.locator,
        )]);
      }
      const identity = boundAuthority.semanticIdentityClosure;
      const bundleRef = {
        artifactType: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
        envelopeHash: byteBundle.bundle.envelopeHash,
        envelopeByteLength: byteBundle.bundle.envelopeByteLength,
        rawHash: byteBundle.rawHash,
        rawByteLength: byteBundle.rawByteLength,
      } as const;
      const entryAuthority: GeneratedSourceReceiptEntryAuthorityV2 = {
        targetRef: source.targetRef,
        responseScreenId: source.responseScreenId,
        generatedSourceLocator: source.source.locator,
        componentApiHash: hashCanonicalJson(screen.componentApi),
        designSourceClosurePayloadHash: closureHash,
        generatorImplementationHash: value.generatorImplementationSource.source.hash,
        generatorPlatformBundleHash: value.releaseAuthority.generatorPlatformBundleHash,
        generatorExecution: {
          status: "unverified",
          blockerCode: "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED",
        },
        generatedSourceArtifactHash: byteBundle.bundle.envelopeHash,
        generatedSourceArtifactByteLength: byteBundle.bundle.envelopeByteLength,
        generatedSourceByteLength: byteBundle.rawByteLength,
        generatedSourceContentHash: byteBundle.rawHash,
        semanticIdentityClosure: identity,
        semanticIdentityClosureHash: hashGeneratedSourceSemanticIdentityClosureV2(identity),
        stitchScreenIndexEntryHash: hashCanonicalJson(screen),
        stitchScreenIndexPayloadHash: screenIndexHash,
        stitchScreenIndexSourceHash: value.screenIndexSource.source.hash,
        stitchScreenIndexSourceByteLength: value.screenIndexSource.source.byteLength,
        generatedSourceBundle: bundleRef,
      };
      preparations.push({
        targetRef: source.targetRef,
        responseScreenId: source.responseScreenId,
        sourceLocator: source.source.locator,
        semanticIdentityClosure: identity,
        screenIndexEntryHash: hashCanonicalJson(screen),
        componentApiHash: hashCanonicalJson(screen.componentApi),
        bundle: byteBundle.bundle,
        chunks: byteBundle.chunks,
        entryAuthority,
        entryCommitmentHash: hashGeneratedSourceReceiptEntryCommitmentV2(entryAuthority),
      });
    }
    const receiptSetEntries = preparations
      .map((entry) => ({
        targetRef: entry.targetRef,
        entryCommitmentHash: entry.entryCommitmentHash,
      }))
      .sort((left, right) => compareUtf16(left.targetRef, right.targetRef));
    const receiptSet = GeneratedSourceReceiptSetCommitmentV2Schema.parse({
      schema: "setfarm.generated-source-receipt-set-commitment.v2",
      entryCount: receiptSetEntries.length,
      entries: receiptSetEntries,
      commitmentHash: hashGeneratedSourceReceiptSetCommitmentV2(receiptSetEntries),
    });
    const publications = preparations.map((entry) => {
      const receipt = GeneratedSourceReceiptV2Schema.parse({
        schema: GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2,
        receiptVersion: 2,
        contractRef: "GENERATOR_STITCH_GENERATED_SOURCE_V2",
        contractHash: STITCH_GENERATED_SOURCE_CONTRACT_HASH_V2,
        receiptRef: generatedSourceReceiptRefV2(entry.entryCommitmentHash),
        entryCommitmentHash: entry.entryCommitmentHash,
        receiptSet,
        ...entry.entryAuthority,
      });
      const envelope = receiptEnvelope(value.producer, receipt);
      const occurrenceEnvelopes = [
        ...entry.chunks.map((chunk) => chunk.envelope),
        entry.bundle.envelope,
        envelope,
      ];
      return snapshotPublication(
        entry.targetRef,
        preparedPublication(entry.chunks, entry.bundle, envelope),
        occurrenceEnvelopes,
      );
    });
    for (const publication of publications) {
      candidatePublicationCanonicalByteLength(
        publication.targetRef,
        publication.publicationEnvelopes,
      );
    }
    return Object.freeze({
      status: "compiled",
      diagnostics: EMPTY_DIAGNOSTICS,
      receiptSet: deepFreezeJson(receiptSet),
      publications: Object.freeze(publications),
    });
  } catch (error) {
    return reject([diagnostic(
      "GENERATED_SOURCE_RECEIPT_V2_PUBLICATION_INCOMPATIBLE",
      errorMessage(error),
      "publication",
    )]);
  }
}

function candidatePreparedPublication(
  group: z.infer<typeof CandidatePublicationGroupV2Schema>,
): PreparedArtifactStoreBatchV1 {
  let chunks = 0;
  let bundles = 0;
  let receipts = 0;
  const items = group.envelopes.map((candidate) => {
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(candidate);
    if (envelope.artifactType === BYTE_CHUNK_ARTIFACT_TYPE_V1) {
      chunks += 1;
      return { durabilityTier: 0, envelope };
    }
    if (envelope.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1) {
      bundles += 1;
      return { durabilityTier: 1, envelope };
    }
    if (envelope.artifactType === GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2) {
      receipts += 1;
      const receipt = GeneratedSourceReceiptV2Schema.parse(envelope.payload);
      if (receipt.targetRef !== group.targetRef) {
        throw new Error("Candidate publication target differs from its receipt target");
      }
      return { durabilityTier: 2, envelope };
    }
    throw new Error(`Candidate publication contains unsupported artifact ${envelope.artifactType}`);
  });
  if (chunks < 1 || chunks > 7 || bundles !== 1 || receipts !== 1) {
    throw new Error("Candidate publication must contain 1..7 chunks, one bundle, and one receipt");
  }
  return prepareArtifactStoreBatchPlanV1({
    schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
    items,
  });
}

function samePreparedPublication(
  expected: PreparedArtifactStoreBatchV1,
  candidate: PreparedArtifactStoreBatchV1,
): boolean {
  if (
    expected.planIdentityHash !== candidate.planIdentityHash
    || expected.occurrenceCount !== candidate.occurrenceCount
  ) return false;
  const expectedItems = copyPreparedArtifactStoreBatchCanonicalItemsV1(expected);
  const candidateItems = copyPreparedArtifactStoreBatchCanonicalItemsV1(candidate);
  return expectedItems.length === candidateItems.length && expectedItems.every((item, index) => {
    const other = candidateItems[index];
    return other !== undefined
      && item.durabilityTier === other.durabilityTier
      && canonicalJsonStringify(item.identity) === canonicalJsonStringify(other.identity)
      && item.bytes.equals(other.bytes);
  });
}

function occurrenceMultiset(
  envelopes: readonly unknown[],
): readonly string[] {
  return envelopes.map((candidate) => {
    const envelope = SemanticArtifactEnvelopeV1Schema.parse(candidate);
    const durabilityTier = envelope.artifactType === BYTE_CHUNK_ARTIFACT_TYPE_V1
      ? 0
      : envelope.artifactType === BYTE_BUNDLE_ARTIFACT_TYPE_V1
        ? 1
        : envelope.artifactType === GENERATED_SOURCE_RECEIPT_ARTIFACT_TYPE_V2
          ? 2
          : -1;
    if (durabilityTier < 0) {
      throw new TypeError(`Unsupported generated-source occurrence ${envelope.artifactType}`);
    }
    const bytes = canonicalJsonBytesBounded(envelope, {
      maxBytes: DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
    return `${durabilityTier}\0${bytes.byteLength}\0${rawSha256(bytes)}`;
  }).sort(compareUtf16);
}

function sameOccurrenceMultiset(
  expected: readonly unknown[],
  candidate: readonly unknown[],
): boolean {
  return canonicalJsonStringify(occurrenceMultiset(expected))
    === canonicalJsonStringify(occurrenceMultiset(candidate));
}

function candidatePublicationCanonicalByteLength(
  targetRef: string,
  envelopes: readonly SemanticArtifactEnvelopeV1[],
): number {
  return canonicalJsonBytesBounded({ targetRef, envelopes }, {
    maxBytes: GENERATED_SOURCE_RECEIPT_MAX_VERIFICATION_GROUP_BYTES_V2,
    maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth,
    maxNodes: 750_000,
    maxContainerEntries: 200_000,
    maxWorkUnits: 256 * 1024 * 1024,
  }).byteLength;
}

export function verifyGeneratedSourceReceiptsV2(
  input: unknown,
): GeneratedSourceReceiptVerificationResultV2 {
  let compilerInput: unknown;
  let candidateGroups: readonly unknown[];
  try {
    const outer = plainRecordData(
      input,
      ["compilerInput", "candidatePublications"],
      "GeneratedSourceReceiptV2 verification input",
    );
    compilerInput = outer.get("compilerInput");
    candidateGroups = snapshotCandidateGroupValues(outer.get("candidatePublications"));
  } catch (error) {
    return Object.freeze({
      status: "rejected",
      diagnostics: Object.freeze([diagnostic(
        "GENERATED_SOURCE_RECEIPT_V2_VERIFICATION_INPUT_INVALID",
        errorMessage(error),
        "verificationInput",
      )]),
    });
  }
  const reproduced = compileGeneratedSourceReceiptsV2(compilerInput);
  if (reproduced.status === "rejected") return reproduced;
  if (candidateGroups.length !== reproduced.publications.length) {
    return Object.freeze({
      status: "rejected",
      diagnostics: Object.freeze([diagnostic(
        "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_MISMATCH",
        "Candidate publication count does not equal the reproduced target set",
        "candidatePublications",
      )]),
    });
  }
  const expectedByTarget = new Map(reproduced.publications.map((publication) =>
    [publication.targetRef, publication] as const));
  const seenTargets = new Set<string>();
  try {
    for (const [index, rawGroup] of candidateGroups.entries()) {
      const group = plainRecordData(
        rawGroup,
        ["targetRef", "envelopes"],
        `candidatePublications[${index}]`,
      );
      const target = GenerationTargetIdSchema.safeParse(group.get("targetRef"));
      if (!target.success) {
        throw new TypeError(`candidatePublications[${index}].targetRef is invalid`);
      }
      const publication = expectedByTarget.get(target.data);
      if (!publication || seenTargets.has(target.data)) {
        return Object.freeze({
          status: "rejected",
          diagnostics: Object.freeze([diagnostic(
            "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_MISMATCH",
            "Candidate publication targets do not equal the every-and-only reproduced target set",
            target.data,
          )]),
        });
      }
      const exactExpectedBytes = candidatePublicationCanonicalByteLength(
        publication.targetRef,
        publication.publicationEnvelopes,
      );
      const snapshot = boundedJsonSnapshot({
        targetRef: target.data,
        envelopes: group.get("envelopes"),
      }, exactExpectedBytes);
      const candidate = CandidatePublicationGroupV2Schema.parse(snapshot);
      const prepared = candidatePreparedPublication(candidate);
      if (
        !sameOccurrenceMultiset(publication.publicationEnvelopes, candidate.envelopes)
        || !samePreparedPublication(publication.preparedPublication, prepared)
      ) {
        return Object.freeze({
          status: "rejected",
          diagnostics: Object.freeze([diagnostic(
            "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_MISMATCH",
            "Candidate byte artifacts and receipt do not equal fresh canonical reproduction",
            publication.targetRef,
          )]),
        });
      }
      seenTargets.add(target.data);
    }
  } catch (error) {
    return Object.freeze({
      status: "rejected",
      diagnostics: Object.freeze([diagnostic(
        "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_INVALID",
        errorMessage(error),
        "candidatePublications",
      )]),
    });
  }
  if (seenTargets.size !== reproduced.publications.length) {
    return Object.freeze({
      status: "rejected",
      diagnostics: Object.freeze([diagnostic(
        "GENERATED_SOURCE_RECEIPT_V2_CANDIDATE_MISMATCH",
        "Candidate publications omit one or more reproduced targets",
        "candidatePublications",
      )]),
    });
  }
  return Object.freeze({
    status: "verified",
    diagnostics: EMPTY_DIAGNOSTICS,
    receiptSet: reproduced.receiptSet,
    publications: reproduced.publications,
  });
}
