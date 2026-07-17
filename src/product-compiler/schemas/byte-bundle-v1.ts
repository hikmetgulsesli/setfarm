import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalJsonBytes } from "../canonical-json.js";
import {
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  type SemanticArtifactProducerV1,
} from "./common-v1.js";

export const BYTE_CHUNK_ARTIFACT_TYPE_V1 = "setfarm.byte-chunk.v1" as const;
export const BYTE_BUNDLE_ARTIFACT_TYPE_V1 = "setfarm.byte-bundle.v1" as const;
export const BYTE_BUNDLE_CHUNKING_POLICY_V1 =
  "fixed-2097152-last-short.v1" as const;

export const BYTE_CHUNK_RAW_MAX_BYTES_V1 = 2 * 1024 * 1024;
export const BYTE_CHUNK_BASE64_MAX_CHARS_V1 =
  4 * Math.ceil(BYTE_CHUNK_RAW_MAX_BYTES_V1 / 3);
export const BYTE_BUNDLE_RAW_MAX_BYTES_V1 = 16 * 1024 * 1024;
export const BYTE_BUNDLE_MAX_CHUNKS_V1 =
  BYTE_BUNDLE_RAW_MAX_BYTES_V1 / BYTE_CHUNK_RAW_MAX_BYTES_V1;
export const BYTE_CHUNK_ENVELOPE_MAX_BYTES_V1 = 3 * 1024 * 1024;
export const BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1 = 64 * 1024;
export const BYTE_ARTIFACT_MAX_TOOL_VERSIONS_V1 = 64;
export const BYTE_ARTIFACT_PRODUCER_MAX_BYTES_V1 = 32 * 1024;

const CANONICAL_RFC4648_BASE64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function decodeCanonicalBase64(value: string): Buffer | undefined {
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.toString("base64") === value ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function boundedToolVersionsV1(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const output = Object.create(null) as Record<string, string>;
  let count = 0;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      count += 1;
      if (
        count > BYTE_ARTIFACT_MAX_TOOL_VERSIONS_V1
        || key.length < 1
        || key.length > 100
      ) return undefined;
      const entry = Reflect.get(value, key);
      if (typeof entry !== "string" || entry.length < 1 || entry.length > 200) {
        return undefined;
      }
      Object.defineProperty(output, key, {
        value: entry,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
  } catch {
    return undefined;
  }
  return output;
}

const ByteArtifactToolVersionsV1Schema = z.unknown().transform((value, context) => {
  const bounded = boundedToolVersionsV1(value);
  if (!bounded) {
    context.addIssue({
      code: "custom",
      message: "BYTE_ARTIFACT_V1_TOOL_VERSIONS_CAPACITY_EXCEEDED",
    });
    return z.NEVER;
  }
  return bounded;
});

export const ByteArtifactProducerV1Schema = z.object({
  pass: SemanticArtifactProducerV1Schema.shape.pass,
  codeSha: SemanticArtifactProducerV1Schema.shape.codeSha,
  model: SemanticArtifactProducerV1Schema.shape.model,
  promptHash: SemanticArtifactProducerV1Schema.shape.promptHash,
  toolVersions: ByteArtifactToolVersionsV1Schema,
}).strict().superRefine((value, context) => {
  try {
    if (canonicalJsonBytes(value).length > BYTE_ARTIFACT_PRODUCER_MAX_BYTES_V1) {
      context.addIssue({
        code: "custom",
        path: ["toolVersions"],
        message: "BYTE_ARTIFACT_V1_PRODUCER_CAPACITY_EXCEEDED",
      });
    }
  } catch {
    context.addIssue({
      code: "custom",
      path: ["toolVersions"],
      message: "BYTE_ARTIFACT_V1_PRODUCER_NONCANONICAL",
    });
  }
});

export const ByteChunkV1Schema = z.object({
  schema: z.literal(BYTE_CHUNK_ARTIFACT_TYPE_V1),
  encoding: z.literal("base64-rfc4648"),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().min(1).max(BYTE_CHUNK_RAW_MAX_BYTES_V1),
  bytesBase64: z.string()
    .min(4)
    .max(BYTE_CHUNK_BASE64_MAX_CHARS_V1)
    .regex(CANONICAL_RFC4648_BASE64, "Expected canonical RFC 4648 base64"),
}).strict().superRefine((value, context) => {
  const decoded = decodeCanonicalBase64(value.bytesBase64);
  if (!decoded) {
    context.addIssue({
      code: "custom",
      path: ["bytesBase64"],
      message: "BYTE_CHUNK_V1_BASE64_NONCANONICAL",
    });
    return;
  }
  if (decoded.length !== value.rawByteLength) {
    context.addIssue({
      code: "custom",
      path: ["rawByteLength"],
      message: "BYTE_CHUNK_V1_RAW_LENGTH_MISMATCH",
    });
  }
  if (sha256(decoded) !== value.rawHash) {
    context.addIssue({
      code: "custom",
      path: ["rawHash"],
      message: "BYTE_CHUNK_V1_RAW_HASH_MISMATCH",
    });
  }
});

export type ByteChunkV1 = z.infer<typeof ByteChunkV1Schema>;

export const ByteChunkRefV1Schema = z.object({
  ordinal: z.number().int().min(0).max(BYTE_BUNDLE_MAX_CHUNKS_V1 - 1),
  chunkEnvelopeHash: Sha256Schema,
  chunkEnvelopeByteLength: z.number().int().min(1)
    .max(BYTE_CHUNK_ENVELOPE_MAX_BYTES_V1),
  chunkRawHash: Sha256Schema,
  rawByteLength: z.number().int().min(1).max(BYTE_CHUNK_RAW_MAX_BYTES_V1),
}).strict();

export type ByteChunkRefV1 = z.infer<typeof ByteChunkRefV1Schema>;

export const ByteBundleV1Schema = z.object({
  schema: z.literal(BYTE_BUNDLE_ARTIFACT_TYPE_V1),
  chunkingPolicy: z.literal(BYTE_BUNDLE_CHUNKING_POLICY_V1),
  rawHash: Sha256Schema,
  rawByteLength: z.number().int().min(1).max(BYTE_BUNDLE_RAW_MAX_BYTES_V1),
  chunks: z.array(ByteChunkRefV1Schema).min(1).max(BYTE_BUNDLE_MAX_CHUNKS_V1),
}).strict().superRefine((value, context) => {
  const expectedChunkCount = Math.ceil(
    value.rawByteLength / BYTE_CHUNK_RAW_MAX_BYTES_V1,
  );
  if (value.chunks.length !== expectedChunkCount) {
    context.addIssue({
      code: "custom",
      path: ["chunks"],
      message: "BYTE_BUNDLE_V1_CHUNK_COUNT_MISMATCH",
    });
  }

  let projectedRawByteLength = 0;
  value.chunks.forEach((chunk, index) => {
    if (chunk.ordinal !== index) {
      context.addIssue({
        code: "custom",
        path: ["chunks", index, "ordinal"],
        message: "BYTE_BUNDLE_V1_CHUNK_ORDER_INVALID",
      });
    }
    const expectedRawByteLength = index < expectedChunkCount - 1
      ? BYTE_CHUNK_RAW_MAX_BYTES_V1
      : value.rawByteLength - (index * BYTE_CHUNK_RAW_MAX_BYTES_V1);
    if (chunk.rawByteLength !== expectedRawByteLength) {
      context.addIssue({
        code: "custom",
        path: ["chunks", index, "rawByteLength"],
        message: "BYTE_BUNDLE_V1_CHUNK_PARTITION_NONCANONICAL",
      });
    }
    projectedRawByteLength += chunk.rawByteLength;
  });
  if (projectedRawByteLength !== value.rawByteLength) {
    context.addIssue({
      code: "custom",
      path: ["chunks"],
      message: "BYTE_BUNDLE_V1_RAW_LENGTH_MISMATCH",
    });
  }
});

export type ByteBundleV1 = z.infer<typeof ByteBundleV1Schema>;

function addEnvelopeSizeIssue(
  value: unknown,
  maximumBytes: number,
  context: z.RefinementCtx,
  code: string,
): void {
  try {
    if (canonicalJsonBytes(value).length > maximumBytes) {
      context.addIssue({
        code: "custom",
        path: [],
        message: code,
      });
    }
  } catch {
    context.addIssue({
      code: "custom",
      path: [],
      message: `${code}_NONCANONICAL_INPUT`,
    });
  }
}

export const ByteChunkEnvelopeV1Schema = z.object({
  schema: z.literal("setfarm.semantic-artifact-envelope.v1"),
  artifactType: z.literal(BYTE_CHUNK_ARTIFACT_TYPE_V1),
  producer: ByteArtifactProducerV1Schema,
  payload: ByteChunkV1Schema,
}).strict().superRefine((value, context) => {
  addEnvelopeSizeIssue(
    value,
    BYTE_CHUNK_ENVELOPE_MAX_BYTES_V1,
    context,
    "BYTE_CHUNK_V1_ENVELOPE_CAPACITY_EXCEEDED",
  );
});

export type ByteChunkEnvelopeV1 = z.infer<typeof ByteChunkEnvelopeV1Schema>;

export const ByteBundleEnvelopeV1Schema = z.object({
  schema: z.literal("setfarm.semantic-artifact-envelope.v1"),
  artifactType: z.literal(BYTE_BUNDLE_ARTIFACT_TYPE_V1),
  producer: ByteArtifactProducerV1Schema,
  payload: ByteBundleV1Schema,
}).strict().superRefine((value, context) => {
  addEnvelopeSizeIssue(
    value,
    BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1,
    context,
    "BYTE_BUNDLE_V1_ENVELOPE_CAPACITY_EXCEEDED",
  );
});

export type ByteBundleEnvelopeV1 = z.infer<typeof ByteBundleEnvelopeV1Schema>;

export type ByteArtifactValidationIssueV1 = Readonly<{
  path: string;
  message: string;
}>;

type ParsedEnvelopeV1<TEnvelope> = Readonly<{
  status: "parsed";
  envelope: TEnvelope;
  envelopeHash: string;
  envelopeByteLength: number;
  rawHash: string;
  rawByteLength: number;
}>;

type RejectedEnvelopeV1 = Readonly<{
  status: "rejected";
  issues: readonly ByteArtifactValidationIssueV1[];
}>;

export type ByteChunkEnvelopeParseResultV1 =
  | ParsedEnvelopeV1<ByteChunkEnvelopeV1>
  | RejectedEnvelopeV1;

export type ByteBundleEnvelopeParseResultV1 =
  | ParsedEnvelopeV1<ByteBundleEnvelopeV1>
  | RejectedEnvelopeV1;

function validationIssues(error: z.ZodError): ByteArtifactValidationIssueV1[] {
  return error.issues.slice(0, 100).map((issue) => ({
    path: issue.path.length > 0 ? issue.path.map(String).join("/") : "$",
    message: issue.message.slice(0, 500),
  }));
}

function unexpectedIssue(error: unknown): ByteArtifactValidationIssueV1[] {
  let message = "Invalid byte artifact";
  try {
    if (typeof error === "string") {
      message = error;
    } else if (
      typeof error === "number"
      || typeof error === "boolean"
      || typeof error === "bigint"
      || typeof error === "symbol"
      || error === null
      || error === undefined
    ) {
      message = String(error);
    } else {
      let candidate: unknown;
      try {
        candidate = Reflect.get(error, "message");
      } catch {
        candidate = undefined;
      }
      if (typeof candidate === "string") message = candidate;
    }
  } catch {
    message = "Invalid byte artifact";
  }
  return [{ path: "$", message: message.slice(0, 500) || "Invalid byte artifact" }];
}

function parsedEnvelope<TEnvelope extends {
  payload: { rawHash: string; rawByteLength: number };
}>(envelope: TEnvelope): ParsedEnvelopeV1<TEnvelope> {
  const bytes = canonicalJsonBytes(envelope);
  return {
    status: "parsed",
    envelope,
    envelopeHash: sha256(bytes),
    envelopeByteLength: bytes.length,
    rawHash: envelope.payload.rawHash,
    rawByteLength: envelope.payload.rawByteLength,
  };
}

export function parseByteChunkEnvelopeV1(input: unknown): ByteChunkEnvelopeParseResultV1 {
  try {
    const parsed = ByteChunkEnvelopeV1Schema.safeParse(input);
    return parsed.success
      ? parsedEnvelope(parsed.data)
      : { status: "rejected", issues: validationIssues(parsed.error) };
  } catch (error) {
    return { status: "rejected", issues: unexpectedIssue(error) };
  }
}

export function parseByteBundleEnvelopeV1(input: unknown): ByteBundleEnvelopeParseResultV1 {
  try {
    const parsed = ByteBundleEnvelopeV1Schema.safeParse(input);
    return parsed.success
      ? parsedEnvelope(parsed.data)
      : { status: "rejected", issues: validationIssues(parsed.error) };
  } catch (error) {
    return { status: "rejected", issues: unexpectedIssue(error) };
  }
}

const ByteBundleBuilderInputV1Schema = z.object({
  bytes: z.custom<Uint8Array>(
    (value) => value instanceof Uint8Array,
    "Expected bytes as a Uint8Array",
  ),
  producer: ByteArtifactProducerV1Schema,
}).strict();

export type ByteChunkArtifactV1 = Readonly<{
  ordinal: number;
  rawHash: string;
  rawByteLength: number;
  envelopeHash: string;
  envelopeByteLength: number;
  envelope: ByteChunkEnvelopeV1;
}>;

export type ByteBundleArtifactV1 = Readonly<{
  rawHash: string;
  rawByteLength: number;
  envelopeHash: string;
  envelopeByteLength: number;
  envelope: ByteBundleEnvelopeV1;
}>;

export type ByteBundleBuildRejectionCodeV1 =
  | "BYTE_BUNDLE_V1_INPUT_INVALID"
  | "BYTE_BUNDLE_V1_EMPTY"
  | "BYTE_BUNDLE_V1_RAW_CAPACITY_EXCEEDED"
  | "BYTE_BUNDLE_V1_INTERNAL_INVALID";

export type ByteBundleBuildResultV1 =
  | Readonly<{
      status: "produced";
      rawHash: string;
      rawByteLength: number;
      chunks: readonly ByteChunkArtifactV1[];
      bundle: ByteBundleArtifactV1;
    }>
  | Readonly<{
      status: "rejected";
      rejectionCode: ByteBundleBuildRejectionCodeV1;
      issues: readonly ByteArtifactValidationIssueV1[];
    }>;

function rejectedBuild(
  rejectionCode: ByteBundleBuildRejectionCodeV1,
  issues: readonly ByteArtifactValidationIssueV1[],
): ByteBundleBuildResultV1 {
  return { status: "rejected", rejectionCode, issues };
}

function semanticEnvelope(
  artifactType: typeof BYTE_CHUNK_ARTIFACT_TYPE_V1,
  producer: SemanticArtifactProducerV1,
  payload: ByteChunkV1,
): ByteChunkEnvelopeV1;
function semanticEnvelope(
  artifactType: typeof BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  producer: SemanticArtifactProducerV1,
  payload: ByteBundleV1,
): ByteBundleEnvelopeV1;
function semanticEnvelope(
  artifactType: typeof BYTE_CHUNK_ARTIFACT_TYPE_V1 | typeof BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  producer: SemanticArtifactProducerV1,
  payload: ByteChunkV1 | ByteBundleV1,
): ByteChunkEnvelopeV1 | ByteBundleEnvelopeV1 {
  return {
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  } as ByteChunkEnvelopeV1 | ByteBundleEnvelopeV1;
}

/**
 * Produces the only canonical ByteBundleV1 partition: non-empty 2 MiB chunks
 * followed by one final chunk of at most 2 MiB. Malformed public input is a
 * typed rejection and never an exception.
 */
export function createByteBundleV1(input: unknown): ByteBundleBuildResultV1 {
  let parsedInput: z.infer<typeof ByteBundleBuilderInputV1Schema>;
  try {
    const parsed = ByteBundleBuilderInputV1Schema.safeParse(input);
    if (!parsed.success) {
      return rejectedBuild(
        "BYTE_BUNDLE_V1_INPUT_INVALID",
        validationIssues(parsed.error),
      );
    }
    parsedInput = parsed.data;
  } catch (error) {
    return rejectedBuild("BYTE_BUNDLE_V1_INPUT_INVALID", unexpectedIssue(error));
  }

  let inputByteLength: number;
  try {
    inputByteLength = parsedInput.bytes.byteLength;
  } catch (error) {
    return rejectedBuild("BYTE_BUNDLE_V1_INPUT_INVALID", unexpectedIssue(error));
  }
  if (inputByteLength === 0) {
    return rejectedBuild("BYTE_BUNDLE_V1_EMPTY", [{
      path: "bytes",
      message: "ByteBundleV1 requires at least one raw byte",
    }]);
  }
  if (inputByteLength > BYTE_BUNDLE_RAW_MAX_BYTES_V1) {
    return rejectedBuild("BYTE_BUNDLE_V1_RAW_CAPACITY_EXCEEDED", [{
      path: "bytes",
      message: `ByteBundleV1 raw bytes exceed ${BYTE_BUNDLE_RAW_MAX_BYTES_V1}`,
    }]);
  }

  let rawBytes: Buffer;
  try {
    rawBytes = Buffer.from(parsedInput.bytes);
  } catch (error) {
    return rejectedBuild("BYTE_BUNDLE_V1_INPUT_INVALID", unexpectedIssue(error));
  }
  if (rawBytes.length !== inputByteLength) {
    return rejectedBuild("BYTE_BUNDLE_V1_INPUT_INVALID", [{
      path: "bytes",
      message: "ByteBundleV1 input changed while its bounded snapshot was created",
    }]);
  }

  try {
    const chunks: ByteChunkArtifactV1[] = [];
    for (
      let offset = 0, ordinal = 0;
      offset < rawBytes.length;
      offset += BYTE_CHUNK_RAW_MAX_BYTES_V1, ordinal += 1
    ) {
      const chunkBytes = rawBytes.subarray(
        offset,
        Math.min(offset + BYTE_CHUNK_RAW_MAX_BYTES_V1, rawBytes.length),
      );
      const payload: ByteChunkV1 = {
        schema: BYTE_CHUNK_ARTIFACT_TYPE_V1,
        encoding: "base64-rfc4648",
        rawHash: sha256(chunkBytes),
        rawByteLength: chunkBytes.length,
        bytesBase64: chunkBytes.toString("base64"),
      };
      const envelope = semanticEnvelope(
        BYTE_CHUNK_ARTIFACT_TYPE_V1,
        parsedInput.producer,
        payload,
      );
      const parsedChunk = parseByteChunkEnvelopeV1(envelope);
      if (parsedChunk.status === "rejected") {
        return rejectedBuild(
          "BYTE_BUNDLE_V1_INTERNAL_INVALID",
          parsedChunk.issues.map((issue) => ({
            path: `chunks/${ordinal}/${issue.path}`,
            message: issue.message,
          })),
        );
      }
      chunks.push({
        ordinal,
        rawHash: parsedChunk.rawHash,
        rawByteLength: parsedChunk.rawByteLength,
        envelopeHash: parsedChunk.envelopeHash,
        envelopeByteLength: parsedChunk.envelopeByteLength,
        envelope: parsedChunk.envelope,
      });
    }

    const bundlePayload: ByteBundleV1 = {
      schema: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
      chunkingPolicy: BYTE_BUNDLE_CHUNKING_POLICY_V1,
      rawHash: sha256(rawBytes),
      rawByteLength: rawBytes.length,
      chunks: chunks.map((chunk) => ({
        ordinal: chunk.ordinal,
        chunkEnvelopeHash: chunk.envelopeHash,
        chunkEnvelopeByteLength: chunk.envelopeByteLength,
        chunkRawHash: chunk.rawHash,
        rawByteLength: chunk.rawByteLength,
      })),
    };
    const bundleEnvelope = semanticEnvelope(
      BYTE_BUNDLE_ARTIFACT_TYPE_V1,
      parsedInput.producer,
      bundlePayload,
    );
    const parsedBundle = parseByteBundleEnvelopeV1(bundleEnvelope);
    if (parsedBundle.status === "rejected") {
      return rejectedBuild("BYTE_BUNDLE_V1_INTERNAL_INVALID", parsedBundle.issues);
    }
    return {
      status: "produced",
      rawHash: parsedBundle.rawHash,
      rawByteLength: parsedBundle.rawByteLength,
      chunks,
      bundle: {
        rawHash: parsedBundle.rawHash,
        rawByteLength: parsedBundle.rawByteLength,
        envelopeHash: parsedBundle.envelopeHash,
        envelopeByteLength: parsedBundle.envelopeByteLength,
        envelope: parsedBundle.envelope,
      },
    };
  } catch (error) {
    return rejectedBuild("BYTE_BUNDLE_V1_INTERNAL_INVALID", unexpectedIssue(error));
  }
}
