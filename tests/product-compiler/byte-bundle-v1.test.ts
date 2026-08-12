import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { DEFAULT_ARTIFACT_CAPACITY_LIMITS } from "../../src/product-compiler/artifact-capacity.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  BYTE_ARTIFACT_MAX_TOOL_VERSIONS_V1,
  BYTE_BUNDLE_ARTIFACT_TYPE_V1,
  BYTE_BUNDLE_CHUNKING_POLICY_V1,
  BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1,
  BYTE_BUNDLE_RAW_MAX_BYTES_V1,
  BYTE_CHUNK_ARTIFACT_TYPE_V1,
  BYTE_CHUNK_ENVELOPE_MAX_BYTES_V1,
  BYTE_CHUNK_RAW_MAX_BYTES_V1,
  ByteBundleEnvelopeV1Schema,
  ByteChunkEnvelopeV1Schema,
  createByteBundleV1,
  parseByteBundleEnvelopeV1,
  parseByteChunkEnvelopeV1,
  type ByteBundleBuildResultV1,
  type ByteChunkRefV1,
} from "../../src/product-compiler/schemas/byte-bundle-v1.js";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function producer(codeSha = "5840ae3") {
  return {
    pass: "byte-bundle-v1-test",
    codeSha,
    toolVersions: { node: process.versions.node },
  };
}

function maximumByteArtifactProducer(toolVersionCount = BYTE_ARTIFACT_MAX_TOOL_VERSIONS_V1) {
  return {
    pass: "p".repeat(160),
    codeSha: "a".repeat(64),
    model: "m".repeat(200),
    promptHash: "b".repeat(64),
    toolVersions: Object.fromEntries(Array.from(
      { length: toolVersionCount },
      (_, index) => [
        `${String(index).padStart(3, "0")}${"k".repeat(97)}`,
        "v".repeat(200),
      ],
    )),
  };
}

type ProducedBundle = Extract<ByteBundleBuildResultV1, { status: "produced" }>;

function mustProduce(
  bytes: Uint8Array,
  codeSha = "5840ae3",
): ProducedBundle {
  const result = createByteBundleV1({ bytes, producer: producer(codeSha) });
  assert.equal(
    result.status,
    "produced",
    result.status === "rejected" ? JSON.stringify(result) : undefined,
  );
  if (result.status !== "produced") throw new Error("Expected ByteBundleV1");
  return result;
}

function chunkRefFor(
  bytes: Buffer,
  ordinal: number,
): ByteChunkRefV1 {
  const payload = {
    schema: BYTE_CHUNK_ARTIFACT_TYPE_V1,
    encoding: "base64-rfc4648" as const,
    rawHash: sha256(bytes),
    rawByteLength: bytes.length,
    bytesBase64: bytes.toString("base64"),
  };
  const envelope = {
    schema: "setfarm.semantic-artifact-envelope.v1" as const,
    artifactType: BYTE_CHUNK_ARTIFACT_TYPE_V1,
    producer: producer(),
    payload,
  };
  const parsed = parseByteChunkEnvelopeV1(envelope);
  assert.equal(parsed.status, "parsed");
  if (parsed.status !== "parsed") throw new Error("Expected forged chunk to be valid");
  return {
    ordinal,
    chunkEnvelopeHash: parsed.envelopeHash,
    chunkEnvelopeByteLength: parsed.envelopeByteLength,
    chunkRawHash: parsed.rawHash,
    rawByteLength: parsed.rawByteLength,
  };
}

describe("ByteChunkV1 and ByteBundleV1", () => {
  it("uses the exact fixed partition at 1 byte, 2 MiB, 2 MiB + 1, and 16 MiB", () => {
    const cases = [
      { byteLength: 1, chunkLengths: [1] },
      {
        byteLength: BYTE_CHUNK_RAW_MAX_BYTES_V1,
        chunkLengths: [BYTE_CHUNK_RAW_MAX_BYTES_V1],
      },
      {
        byteLength: BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1,
        chunkLengths: [BYTE_CHUNK_RAW_MAX_BYTES_V1, 1],
      },
      {
        byteLength: BYTE_BUNDLE_RAW_MAX_BYTES_V1,
        chunkLengths: Array.from({ length: 8 }, () => BYTE_CHUNK_RAW_MAX_BYTES_V1),
      },
    ] as const;

    for (const [caseIndex, boundary] of cases.entries()) {
      const bytes = Buffer.alloc(boundary.byteLength, caseIndex + 1);
      const result = mustProduce(bytes);
      assert.equal(result.rawByteLength, boundary.byteLength);
      assert.deepEqual(
        result.chunks.map((chunk) => chunk.rawByteLength),
        boundary.chunkLengths,
      );
      assert.deepEqual(
        result.chunks.map((chunk) => chunk.ordinal),
        boundary.chunkLengths.map((_, index) => index),
      );
      assert.equal(result.bundle.envelope.payload.rawByteLength, boundary.byteLength);
      assert.equal(result.bundle.envelope.payload.rawHash, sha256(bytes));
      assert.equal(
        result.bundle.envelope.payload.chunkingPolicy,
        BYTE_BUNDLE_CHUNKING_POLICY_V1,
      );

      for (const chunk of result.chunks) {
        const serialized = canonicalJsonBytes(chunk.envelope);
        assert.equal(chunk.envelopeByteLength, serialized.length);
        assert.equal(chunk.envelopeHash, sha256(serialized));
        assert.ok(serialized.length <= BYTE_CHUNK_ENVELOPE_MAX_BYTES_V1);
        assert.ok(
          serialized.length < DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes,
          `serialized ${serialized.length} byte chunk envelope must fit the live 4 MiB CAS payload limit`,
        );
      }
      const serializedBundle = canonicalJsonBytes(result.bundle.envelope);
      assert.equal(result.bundle.envelopeByteLength, serializedBundle.length);
      assert.equal(result.bundle.envelopeHash, sha256(serializedBundle));
      assert.ok(serializedBundle.length <= BYTE_BUNDLE_ENVELOPE_MAX_BYTES_V1);
      assert.ok(serializedBundle.length < DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes);
    }
  });

  it("separates raw chunk, chunk envelope, raw bundle, and bundle envelope identities", () => {
    const bytes = Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1, 0x5a);
    bytes[bytes.length - 1] = 0xa5;
    const first = mustProduce(bytes);
    const repeated = mustProduce(bytes);
    const otherProducer = mustProduce(bytes, "6840ae3");

    assert.equal(first.rawHash, sha256(bytes));
    assert.equal(first.bundle.rawHash, first.rawHash);
    assert.equal(first.bundle.envelopeHash, sha256(canonicalJsonBytes(first.bundle.envelope)));
    assert.notEqual(first.bundle.rawHash, first.bundle.envelopeHash);
    assert.notEqual(first.chunks[0]!.rawHash, first.chunks[0]!.envelopeHash);
    assert.notEqual(first.chunks[0]!.rawHash, first.bundle.rawHash);
    assert.deepEqual(
      first.bundle.envelope.payload.chunks,
      first.chunks.map((chunk) => ({
        ordinal: chunk.ordinal,
        chunkEnvelopeHash: chunk.envelopeHash,
        chunkEnvelopeByteLength: chunk.envelopeByteLength,
        chunkRawHash: chunk.rawHash,
        rawByteLength: chunk.rawByteLength,
      })),
    );

    assert.equal(repeated.bundle.envelopeHash, first.bundle.envelopeHash);
    assert.deepEqual(
      repeated.chunks.map((chunk) => chunk.envelopeHash),
      first.chunks.map((chunk) => chunk.envelopeHash),
    );
    assert.equal(otherProducer.rawHash, first.rawHash);
    assert.deepEqual(
      otherProducer.chunks.map((chunk) => chunk.rawHash),
      first.chunks.map((chunk) => chunk.rawHash),
    );
    assert.notEqual(otherProducer.bundle.envelopeHash, first.bundle.envelopeHash);
    assert.notDeepEqual(
      otherProducer.chunks.map((chunk) => chunk.envelopeHash),
      first.chunks.map((chunk) => chunk.envelopeHash),
    );
  });

  it("bounds producer metadata while preserving worst-case raw chunk capacity", () => {
    const bytes = Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1, 0x41);
    const maximum = createByteBundleV1({
      bytes,
      producer: maximumByteArtifactProducer(),
    });
    assert.equal(
      maximum.status,
      "produced",
      maximum.status === "rejected" ? JSON.stringify(maximum) : undefined,
    );
    if (maximum.status !== "produced") return;
    assert.equal(maximum.chunks.length, 1);
    assert.ok(
      maximum.chunks[0]!.envelopeByteLength <= BYTE_CHUNK_ENVELOPE_MAX_BYTES_V1,
    );
    assert.ok(
      maximum.chunks[0]!.envelopeByteLength
        < DEFAULT_ARTIFACT_CAPACITY_LIMITS.maxPayloadBytes,
    );

    const oneOverProducer = maximumByteArtifactProducer(
      BYTE_ARTIFACT_MAX_TOOL_VERSIONS_V1 + 1,
    );
    const oneOver = createByteBundleV1({ bytes, producer: oneOverProducer });
    assert.equal(oneOver.status, "rejected");
    assert.equal(
      oneOver.status === "rejected" ? oneOver.rejectionCode : undefined,
      "BYTE_BUNDLE_V1_INPUT_INVALID",
    );

    const chunkEnvelope: any = structuredClone(maximum.chunks[0]!.envelope);
    chunkEnvelope.producer = oneOverProducer;
    const bundleEnvelope: any = structuredClone(maximum.bundle.envelope);
    bundleEnvelope.producer = oneOverProducer;
    assert.equal(parseByteChunkEnvelopeV1(chunkEnvelope).status, "rejected");
    assert.equal(parseByteBundleEnvelopeV1(bundleEnvelope).status, "rejected");
  });

  it("rejects empty and over-16-MiB inputs without throwing", () => {
    const empty = createByteBundleV1({ bytes: Buffer.alloc(0), producer: producer() });
    assert.deepEqual(
      empty.status === "rejected" ? empty.rejectionCode : undefined,
      "BYTE_BUNDLE_V1_EMPTY",
    );

    const oversized = createByteBundleV1({
      bytes: Buffer.alloc(BYTE_BUNDLE_RAW_MAX_BYTES_V1 + 1),
      producer: producer(),
    });
    assert.deepEqual(
      oversized.status === "rejected" ? oversized.rejectionCode : undefined,
      "BYTE_BUNDLE_V1_RAW_CAPACITY_EXCEEDED",
    );
  });

  it("requires canonical RFC 4648 re-encoding and exact raw chunk identity", () => {
    const valid = mustProduce(Buffer.from([0xff])).chunks[0]!.envelope;
    assert.equal(parseByteChunkEnvelopeV1(valid).status, "parsed");

    const noncanonicalPadBits: any = structuredClone(valid);
    noncanonicalPadBits.payload.bytesBase64 = "/x==";
    const noncanonical = parseByteChunkEnvelopeV1(noncanonicalPadBits);
    assert.equal(noncanonical.status, "rejected");
    assert.ok(
      noncanonical.status === "rejected"
      && noncanonical.issues.some((issue) =>
        issue.message === "BYTE_CHUNK_V1_BASE64_NONCANONICAL"),
    );

    const missingPadding: any = structuredClone(valid);
    missingPadding.payload.bytesBase64 = "/w";
    assert.equal(parseByteChunkEnvelopeV1(missingPadding).status, "rejected");

    const wrongLength: any = structuredClone(valid);
    wrongLength.payload.rawByteLength = 2;
    const lengthResult = parseByteChunkEnvelopeV1(wrongLength);
    assert.ok(
      lengthResult.status === "rejected"
      && lengthResult.issues.some((issue) =>
        issue.message === "BYTE_CHUNK_V1_RAW_LENGTH_MISMATCH"),
    );

    const wrongHash: any = structuredClone(valid);
    wrongHash.payload.rawHash = "0".repeat(64);
    const hashResult = parseByteChunkEnvelopeV1(wrongHash);
    assert.ok(
      hashResult.status === "rejected"
      && hashResult.issues.some((issue) =>
        issue.message === "BYTE_CHUNK_V1_RAW_HASH_MISMATCH"),
    );
  });

  it("strictly rejects undeclared payload and envelope fields", () => {
    const chunk: any = structuredClone(mustProduce(Buffer.from([1])).chunks[0]!.envelope);
    chunk.createdAt = "2026-07-17T00:00:00Z";
    assert.equal(ByteChunkEnvelopeV1Schema.safeParse(chunk).success, false);
    delete chunk.createdAt;
    chunk.payload.mediaType = "application/octet-stream";
    assert.equal(ByteChunkEnvelopeV1Schema.safeParse(chunk).success, false);

    const bundle: any = structuredClone(mustProduce(Buffer.from([1])).bundle.envelope);
    bundle.payload.role = "html";
    assert.equal(ByteBundleEnvelopeV1Schema.safeParse(bundle).success, false);
  });

  it("rejects reordered and duplicated chunk refs", () => {
    const valid = mustProduce(Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1, 3));

    const reordered: any = structuredClone(valid.bundle.envelope);
    reordered.payload.chunks.reverse();
    const reorderedResult = parseByteBundleEnvelopeV1(reordered);
    assert.ok(
      reorderedResult.status === "rejected"
      && reorderedResult.issues.some((issue) =>
        issue.message === "BYTE_BUNDLE_V1_CHUNK_ORDER_INVALID"),
    );

    const duplicated: any = structuredClone(valid.bundle.envelope);
    duplicated.payload.chunks = [
      structuredClone(duplicated.payload.chunks[0]),
      structuredClone(duplicated.payload.chunks[0]),
    ];
    const duplicatedResult = parseByteBundleEnvelopeV1(duplicated);
    assert.ok(
      duplicatedResult.status === "rejected"
      && duplicatedResult.issues.some((issue) =>
        issue.message === "BYTE_BUNDLE_V1_CHUNK_ORDER_INVALID"
        || issue.message === "BYTE_BUNDLE_V1_RAW_LENGTH_MISMATCH"),
    );
  });

  it("rejects a fully rehashed but noncanonical repartition", () => {
    const bytes = Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1, 7);
    bytes[bytes.length - 1] = 9;
    const split = 1024 * 1024;
    const forgedEnvelope = {
      schema: "setfarm.semantic-artifact-envelope.v1" as const,
      artifactType: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
      producer: producer(),
      payload: {
        schema: BYTE_BUNDLE_ARTIFACT_TYPE_V1,
        chunkingPolicy: BYTE_BUNDLE_CHUNKING_POLICY_V1,
        rawHash: sha256(bytes),
        rawByteLength: bytes.length,
        chunks: [
          chunkRefFor(bytes.subarray(0, split), 0),
          chunkRefFor(bytes.subarray(split), 1),
        ],
      },
    };

    const result = parseByteBundleEnvelopeV1(forgedEnvelope);
    assert.ok(
      result.status === "rejected"
      && result.issues.some((issue) =>
        issue.message === "BYTE_BUNDLE_V1_CHUNK_PARTITION_NONCANONICAL"),
    );
  });

  it("binds structurally valid manifest tampering to a different envelope identity", () => {
    const valid = mustProduce(Buffer.alloc(BYTE_CHUNK_RAW_MAX_BYTES_V1 + 1, 11));
    const original = parseByteBundleEnvelopeV1(valid.bundle.envelope);
    assert.equal(original.status, "parsed");

    const tampered: any = structuredClone(valid.bundle.envelope);
    tampered.payload.chunks[0].chunkRawHash = "f".repeat(64);
    const reparsed = parseByteBundleEnvelopeV1(tampered);
    assert.equal(reparsed.status, "parsed");
    assert.ok(
      original.status === "parsed"
      && reparsed.status === "parsed"
      && reparsed.envelopeHash !== original.envelopeHash,
    );
  });

  it("returns typed rejections for sparse arrays and malformed public input", () => {
    const valid = mustProduce(Buffer.from([1]));
    const sparseChunks = new Array(1);
    const sparseEnvelope: any = {
      ...structuredClone(valid.bundle.envelope),
      payload: {
        ...structuredClone(valid.bundle.envelope.payload),
        chunks: sparseChunks,
      },
    };
    let sparseResult: ReturnType<typeof parseByteBundleEnvelopeV1> | undefined;
    assert.doesNotThrow(() => {
      sparseResult = parseByteBundleEnvelopeV1(sparseEnvelope);
    });
    assert.equal(sparseResult?.status, "rejected");

    const hostile = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys");
      },
    });
    const hostileTypedArray = new Proxy(new Uint8Array([1]), {
      get(target, property, receiver) {
        if (property === "byteLength") throw new Error("hostile byteLength");
        return Reflect.get(target, property, receiver);
      },
    });
    const malformed: unknown[] = [
      null,
      {},
      { bytes: [], producer: producer() },
      { bytes: Buffer.from([1]), producer: { ...producer(), extra: true } },
      { bytes: hostileTypedArray, producer: producer() },
      hostile,
    ];
    for (const input of malformed) {
      let result: ByteBundleBuildResultV1 | undefined;
      assert.doesNotThrow(() => {
        result = createByteBundleV1(input);
      });
      assert.equal(result?.status, "rejected");
      assert.equal(
        result?.status === "rejected" ? result.rejectionCode : undefined,
        "BYTE_BUNDLE_V1_INPUT_INVALID",
      );
    }
    assert.doesNotThrow(() => parseByteChunkEnvelopeV1(hostile));
    assert.equal(parseByteChunkEnvelopeV1(hostile).status, "rejected");
  });

  it("never coerces a hostile thrown value while reporting malformed input", () => {
    const secondary = new Proxy({}, {
      get() {
        throw new Error("secondary property trap");
      },
      getPrototypeOf() {
        throw new Error("secondary prototype trap");
      },
    });
    const primary = new Proxy({}, {
      ownKeys() {
        throw secondary;
      },
    });

    let chunk: ReturnType<typeof parseByteChunkEnvelopeV1> | undefined;
    let bundle: ReturnType<typeof parseByteBundleEnvelopeV1> | undefined;
    let build: ByteBundleBuildResultV1 | undefined;
    assert.doesNotThrow(() => {
      chunk = parseByteChunkEnvelopeV1(primary);
      bundle = parseByteBundleEnvelopeV1(primary);
      build = createByteBundleV1(primary);
    });
    assert.equal(chunk?.status, "rejected");
    assert.equal(bundle?.status, "rejected");
    assert.equal(build?.status, "rejected");
  });
});
