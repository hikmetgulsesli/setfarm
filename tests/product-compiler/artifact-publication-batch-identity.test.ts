import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArtifactPublicationBatchIdentityItemSchema,
  computeArtifactPublicationBatchChildReservationId,
  computeArtifactPublicationBatchIdentityHash,
  computeArtifactPublicationBatchItemIdentityHash,
} from "../../src/product-compiler/artifact-publication-batch-identity.js";

const unicodeItems = () => [
  {
    hash: "a".repeat(64),
    artifactType: "setfarm.byte-chunk.v1",
    byteLength: 1,
    producer: {
      pass: "üretim",
      codeSha: "b".repeat(40),
      model: "模型",
      promptHash: "c".repeat(64),
      toolVersions: { é: "v:1\n", "😀": "值" },
    },
  },
  {
    hash: "f".repeat(64),
    artifactType: "setfarm.product-spec.v2",
    byteLength: Number.MAX_SAFE_INTEGER,
    producer: {
      pass: "e\u0301",
      codeSha: "d".repeat(40),
      toolVersions: { alpha: "1", β: "2" },
    },
  },
].map((item) => ArtifactPublicationBatchIdentityItemSchema.parse(item));

describe("artifact publication batch identity v1", () => {
  it("pins full-field UTF-8 identity, ordering, and child reservation golden vectors", () => {
    const items = unicodeItems();
    assert.deepEqual(items.map(computeArtifactPublicationBatchItemIdentityHash), [
      "e3dece172f3da46b880ba81ddad9af0a19bcb2a5ef0c37c5f183d53678f0aa84",
      "bc66ebb73c1ecb2e0d66596dc0eb1ff2e3e79e54e571d10be469107cf64c8c98",
    ]);
    const batchHash = computeArtifactPublicationBatchIdentityHash(items);
    assert.equal(batchHash, "35f6d66713891fb51ab75d028501f40d22f9c56881d66c26fbed66a4973ccbef");
    assert.equal(computeArtifactPublicationBatchIdentityHash([...items].reverse()), batchHash);
    assert.equal(
      computeArtifactPublicationBatchChildReservationId(
        "golden.batch:unicode-01",
        batchHash,
        items[1]!.hash,
      ),
      "APRB_a12af771faaa71b9c23b7ae97366c71909bc36a5dd76f75a5ee872d6c12f5d1d",
    );
    assert.notEqual(
      computeArtifactPublicationBatchIdentityHash([{
        ...items[0]!,
        producer: { ...items[0]!.producer, pass: "different" },
      }]),
      computeArtifactPublicationBatchIdentityHash([items[0]!]),
    );
  });

  it("rejects prototype-sensitive keys, NUL, and malformed Unicode before hashing", () => {
    const baseline = unicodeItems()[0]!;
    for (const toolVersions of [
      JSON.parse('{"__proto__":"x","node":"22"}') as unknown,
      { constructor: "x" },
      { prototype: "x" },
    ]) {
      assert.equal(ArtifactPublicationBatchIdentityItemSchema.safeParse({
        ...baseline,
        producer: { ...baseline.producer, toolVersions },
      }).success, false);
    }
    for (const pass of ["nul\u0000text", "high\ud800", "low\udc00"]) {
      assert.equal(ArtifactPublicationBatchIdentityItemSchema.safeParse({
        ...baseline,
        producer: { ...baseline.producer, pass },
      }).success, false);
    }
    assert.equal(ArtifactPublicationBatchIdentityItemSchema.safeParse({
      ...baseline,
      producer: { ...baseline.producer, pass: "😀".repeat(41) },
    }).success, false);
  });
});
