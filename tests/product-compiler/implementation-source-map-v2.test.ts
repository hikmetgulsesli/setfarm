import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
  IMPLEMENTATION_SOURCE_MAP_CONTRACT_V2,
  IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES,
  hashImplementationSourceMapMerkleLeafV2,
  hashImplementationSourceMapMerklePairV2,
  hashImplementationSourceMapMerkleUnaryV2,
  implementationSourceMapMerkleRootV2,
  type ImplementationSourceMapLeafRefV2,
} from "../../src/product-compiler/schemas/implementation-source-map-v2.js";

const IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_GOLDEN_V2 =
  "228602d6fd20d0dc2c73a8e2d07b676422cd677329f48a91f9928ad9c6b095f7";

function leaf(index: number): ImplementationSourceMapLeafRefV2 {
  const suffix = String(index + 1).padStart(2, "0");
  return {
    index,
    storyId: `US-${suffix}`,
    storyHash: String(index + 1).repeat(64).slice(0, 64),
    leafEnvelopeHash: String(index + 6).repeat(64).slice(0, 64),
    byteLength: 1_000 + index,
  };
}

describe("ImplementationSourceMapV2 Merkle contract", () => {
  it("pins separate leaf, pair and unary domains", () => {
    const first = leaf(0);
    const leafHash = hashImplementationSourceMapMerkleLeafV2(first);
    assert.notEqual(
      hashImplementationSourceMapMerkleUnaryV2(leafHash),
      hashImplementationSourceMapMerklePairV2(leafHash, leafHash),
    );
    assert.equal(
      IMPLEMENTATION_SOURCE_MAP_CONTRACT_V2.merkle.oddChild,
      "explicit_unary_never_duplicate_or_pad",
    );
    assert.deepEqual(IMPLEMENTATION_SOURCE_MAP_V2_BLOCKER_CODES, [
      "IMPLEMENTATION_SOURCE_MAP_V2_AUTHENTICATED_BUILD_TEST_EVIDENCE_UNVERIFIED",
      "IMPLEMENTATION_SOURCE_MAP_V2_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
      "IMPLEMENTATION_SOURCE_MAP_V2_EVIDENCE_REGISTRY_V2_UNVERIFIED",
      "IMPLEMENTATION_SOURCE_MAP_V2_PRODUCT_BUILD_PACKET_V4_UNVERIFIED",
      "IMPLEMENTATION_SOURCE_MAP_V2_RELEASE_MANIFEST_UNVERIFIED",
    ]);
    assert.equal(
      IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_V2,
      IMPLEMENTATION_SOURCE_MAP_CONTRACT_HASH_GOLDEN_V2,
    );
  });

  it("uses explicit unary nodes for odd levels without duplication", () => {
    const one = [leaf(0)];
    const two = [leaf(0), leaf(1)];
    const three = [leaf(0), leaf(1), leaf(2)];
    const five = [leaf(0), leaf(1), leaf(2), leaf(3), leaf(4)];
    const hashes = five.map(hashImplementationSourceMapMerkleLeafV2);

    assert.equal(implementationSourceMapMerkleRootV2(one), hashes[0]);
    assert.equal(
      implementationSourceMapMerkleRootV2(two),
      hashImplementationSourceMapMerklePairV2(hashes[0]!, hashes[1]!),
    );
    assert.equal(
      implementationSourceMapMerkleRootV2(three),
      hashImplementationSourceMapMerklePairV2(
        hashImplementationSourceMapMerklePairV2(hashes[0]!, hashes[1]!),
        hashImplementationSourceMapMerkleUnaryV2(hashes[2]!),
      ),
    );
    assert.equal(
      implementationSourceMapMerkleRootV2(five),
      hashImplementationSourceMapMerklePairV2(
        hashImplementationSourceMapMerklePairV2(
          hashImplementationSourceMapMerklePairV2(hashes[0]!, hashes[1]!),
          hashImplementationSourceMapMerklePairV2(hashes[2]!, hashes[3]!),
        ),
        hashImplementationSourceMapMerkleUnaryV2(
          hashImplementationSourceMapMerkleUnaryV2(hashes[4]!),
        ),
      ),
    );
    assert.notEqual(
      implementationSourceMapMerkleRootV2(three),
      hashImplementationSourceMapMerklePairV2(
        hashImplementationSourceMapMerklePairV2(hashes[0]!, hashes[1]!),
        hashImplementationSourceMapMerklePairV2(hashes[2]!, hashes[2]!),
      ),
    );
  });

  it("rejects an empty tree", () => {
    assert.throws(
      () => implementationSourceMapMerkleRootV2([]),
      /requires one leaf/u,
    );
  });
});
