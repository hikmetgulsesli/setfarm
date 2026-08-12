import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EVIDENCE_RECEIPT_V2_SCHEMA } from
  "../../src/evidence/schemas/evidence-receipt-v2.js";
import { CANDIDATE_BUILD_RECEIPT_V2_SCHEMA } from
  "../../src/execution/schemas/candidate-build-receipt-v2.js";
import {
  BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3,
  BUILD_TOPOLOGY_BUILD_PROCESS_POLICY_V3,
  BUILD_TOPOLOGY_CONTRACT_HASH_V3,
  BUILD_TOPOLOGY_CONTRACT_V3,
  BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3,
  BUILD_TOPOLOGY_VERSION_V3,
} from "../../src/product-compiler/schemas/build-topology-v3.js";

const BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V3_2 =
  "f0ff27887299b07851128df3293280ef2f0d6bdd4c4463da14764e49c9fa3ac4";

describe("BuildTopologyV3.2 operation authority", () => {
  it("uses the only implemented candidate build and evidence receipt schemas", () => {
    assert.equal(BUILD_TOPOLOGY_VERSION_V3, "3.2.0");
    assert.equal(
      BUILD_TOPOLOGY_CONTRACT_HASH_V3,
      BUILD_TOPOLOGY_CONTRACT_HASH_GOLDEN_V3_2,
    );
    assert.deepEqual(BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3.map(
      (item) => item.receiptSchema,
    ), [
      "setfarm.node-product-runtime-source-receipt.v2",
      "setfarm.node-product-test-source-receipt.v2",
    ]);
    assert.deepEqual(BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3.map(
      (item) => item.receiptSchema,
    ), [
      CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
      "setfarm.node-product-runtime-source-receipt.v2",
      "setfarm.node-product-test-source-receipt.v2",
    ]);
    assert.equal(EVIDENCE_RECEIPT_V2_SCHEMA, "setfarm.evidence-receipt.v2");
  });

  it("pins the complete bounded direct-build process policy", () => {
    assert.deepEqual(BUILD_TOPOLOGY_BUILD_PROCESS_POLICY_V3, {
      stdin: "closed",
      timeoutMs: 120_000,
      maxStdoutBytes: 1_048_576,
      maxStderrBytes: 1_048_576,
      shell: "forbidden",
      ambientEnvironment: "forbidden",
      outputLimitDisposition: "typed_build_rejection",
      timeoutDisposition: "typed_build_rejection",
      nonzeroOrSignalDisposition: "typed_build_rejection",
    });
    assert.equal(Object.isFrozen(BUILD_TOPOLOGY_BUILD_PROCESS_POLICY_V3), true);
  });

  it("contains no unimplemented parallel V3 receipt identity", () => {
    const authority = JSON.stringify({
      contract: BUILD_TOPOLOGY_CONTRACT_V3,
      build: BUILD_TOPOLOGY_BUILD_REQUIRED_PRECONDITIONS_V3,
      test: BUILD_TOPOLOGY_TEST_REQUIRED_PRECONDITIONS_V3,
      candidateBuild: CANDIDATE_BUILD_RECEIPT_V2_SCHEMA,
      evidence: EVIDENCE_RECEIPT_V2_SCHEMA,
    });
    assert.equal(authority.includes("node-product-build-receipt.v3"), false);
    assert.equal(
      authority.includes("node-product-test-execution-receipt.v3"),
      false,
    );
  });
});
