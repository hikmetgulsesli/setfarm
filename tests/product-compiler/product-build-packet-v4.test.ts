import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from
  "../../src/product-compiler/canonical-json.js";
import {
  PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
  PRODUCT_BUILD_PACKET_CONTRACT_V4,
  PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES,
  PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS,
  hashProductBuildPacketV4,
} from "../../src/product-compiler/schemas/product-build-packet-v4.js";

const PRODUCT_BUILD_PACKET_CONTRACT_HASH_GOLDEN_V4 =
  "27baefc41281d6892e5d962ecf17988c34ee850fe2db60a0b538d2b5ab9d528e";

describe("ProductBuildPacketV4 contract", () => {
  it("pins one forward SourceMap trust anchor and exact blockers", () => {
    assert.equal(
      PRODUCT_BUILD_PACKET_CONTRACT_V4.authority.packetDirection,
      "packet_binds_source_map_root_never_reverse",
    );
    assert.equal(
      PRODUCT_BUILD_PACKET_CONTRACT_V4.retryIdentity
        .operationalAttemptReceipts,
      "excluded",
    );
    assert.deepEqual(PRODUCT_BUILD_PACKET_V4_BLOCKER_CODES, [
      "PRODUCT_BUILD_PACKET_V4_ATOMIC_ARTIFACT_SET_ACTIVATION_UNVERIFIED",
      "PRODUCT_BUILD_PACKET_V4_AUTHENTICATED_BUILD_TEST_EVIDENCE_UNVERIFIED",
      "PRODUCT_BUILD_PACKET_V4_EVIDENCE_REGISTRY_V2_UNVERIFIED",
      "PRODUCT_BUILD_PACKET_V4_IMPLEMENTATION_SLICE_V2_UNVERIFIED",
      "PRODUCT_BUILD_PACKET_V4_RELEASE_MANIFEST_UNVERIFIED",
    ]);
    assert.deepEqual(PRODUCT_BUILD_PACKET_V4_VALIDATION_IDS, [
      "VALIDATE_PACKET_V4_ATTEMPT_RECEIPTS_EXCLUDED",
      "VALIDATE_PACKET_V4_INDIVIDUAL_CAS_PREFLIGHT",
      "VALIDATE_PACKET_V4_LOGICAL_EXECUTION_EXACT",
      "VALIDATE_PACKET_V4_SOURCE_MAP_FORWARD_BINDING",
      "VALIDATE_PACKET_V4_SOURCE_MAP_ROOT_FRESH",
      "VALIDATE_PACKET_V4_UPSTREAM_AUTHORITY_EXACT",
    ]);
    assert.equal(
      PRODUCT_BUILD_PACKET_CONTRACT_HASH_V4,
      PRODUCT_BUILD_PACKET_CONTRACT_HASH_GOLDEN_V4,
    );
  });

  it("uses a separate packet domain and ignores only the derived packet hash", () => {
    const identity = { schema: "example", value: 1 } as any;
    const packetHash = hashProductBuildPacketV4(identity);
    assert.equal(
      hashProductBuildPacketV4({ ...identity, packetHash } as any),
      packetHash,
    );
    assert.notEqual(packetHash, hashCanonicalJson(identity));
    assert.notEqual(
      packetHash,
      hashCanonicalJson({
        schema: "setfarm.product-build-packet-hash.v3",
        packet: identity,
      }),
    );
  });
});
