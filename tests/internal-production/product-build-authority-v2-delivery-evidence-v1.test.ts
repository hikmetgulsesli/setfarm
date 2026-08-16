import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../src/product-compiler/canonical-json.js";
import {
  GIT_OBJECT_HASH_V1_PATTERN,
  PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1,
  PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1,
  SHA256_V1_PATTERN,
  parseProductBuildAuthorityV2DeliveryEvidenceResponseV1,
} from "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.js";

const INVALID_RESPONSE_CODE =
  "PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_INVALID";
const DELIVERY_EVIDENCE_HASH =
  "f72e19755f5ab92a0053b5779d5dc2c49e6008e1426c0b32171bb409256c6424";
const DELIVERY_EVIDENCE_REF =
  `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${DELIVERY_EVIDENCE_HASH}`;
const FOCUSED_TEST_HASH =
  "d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667";
const FOCUSED_TEST_REF =
  `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${FOCUSED_TEST_HASH}`;

const VALID_RESPONSE = {
  schema: "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
  currentStatus: "current",
  deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
  deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
  evidence: {
    schema: "mission-control.product-build-authority-v2-delivery-evidence.v1",
    currentStatus: "current",
    deliveryPrNumber: 19,
    deliveryMergeSha: "240e779d78804843a1202cbf0440fe423b806b1a",
    deliveryMergeAncestorOfCurrentSource: true,
    currentSource: {
      branch: "main",
      clean: true,
      sha: "1111111111111111111111111111111111111111",
      treeHash: "2222222222222222222222222222222222222222222222222222222222222222",
      buildHash: "3333333333333333333333333333333333333333333333333333333333333333",
      originMainSha: "1111111111111111111111111111111111111111",
    },
    deliveredPathBlobs: [
      {
        path: "server/routes/setfarm-operational.test.ts",
        blobHash: "4444444444444444444444444444444444444444444444444444444444444444",
      },
      {
        path: "server/routes/setfarm-operational.ts",
        blobHash: "5555555555555555555555555555555555555555555555555555555555555555",
      },
      {
        path: "server/services/setfarm-product-build-authority.ts",
        blobHash: "6666666666666666666666666666666666666666666666666666666666666666",
      },
      {
        path: "server/services/setfarm-product-build-authority.test.ts",
        blobHash: "7777777777777777777777777777777777777777777777777777777777777777",
      },
      {
        path: "src/lib/product-build-authority.ts",
        blobHash: "8888888888888888888888888888888888888888888888888888888888888888",
      },
      {
        path: "src/components/run-detail/ProductBuildAuthority.tsx",
        blobHash: "9999999999999999999999999999999999999999999999999999999999999999",
      },
      {
        path: "tests/product-build-authority-render.test.tsx",
        blobHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      {
        path: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
        blobHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ],
    focusedTests: {
      schema: "mission-control.product-build-authority-v2-focused-test-receipt.v1",
      argv: [
        "node",
        "--import",
        "tsx",
        "--test",
        "server/routes/setfarm-operational.test.ts",
        "server/services/setfarm-product-build-authority.test.ts",
        "tests/product-build-authority-render.test.tsx",
      ],
      commandContractHash:
        "0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b",
      testPathBlobs: [
        {
          path: "server/routes/setfarm-operational.test.ts",
          blobHash: "4444444444444444444444444444444444444444444444444444444444444444",
        },
        {
          path: "server/services/setfarm-product-build-authority.test.ts",
          blobHash: "7777777777777777777777777777777777777777777777777777777777777777",
        },
        {
          path: "tests/product-build-authority-render.test.tsx",
          blobHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
      exitCode: 0,
      passed: true,
      focusedTestReceiptRef: FOCUSED_TEST_REF,
      focusedTestReceiptHash: FOCUSED_TEST_HASH,
    },
    vendorLock: {
      schema: "mission-control.product-build-authority-v2-vendor-lock-projection.v1",
      lockPath: "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
      producerRepository: "https://github.com/hikmetgulsesli/setfarm.git",
      producerCommit: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      lockContentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      artifacts: [
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json",
          sha256: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json",
          sha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json",
          sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v2.schema.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json",
          sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json",
          sha256: "1111111111111111111111111111111111111111111111111111111111111111",
        },
        {
          producerPath: "contracts/generated/mission-control/run-operational-snapshot.v3.schema.json",
          vendoredPath: "contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json",
          sha256: "2222222222222222222222222222222222222222222222222222222222222222",
        },
        {
          producerPath: "contracts/generated/mission-control/deployment-observation.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/deployment-observation.v1.compatibility.json",
          sha256: "3333333333333333333333333333333333333333333333333333333333333333",
        },
        {
          producerPath: "contracts/generated/mission-control/deployment-observation.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/deployment-observation.v1.schema.json",
          sha256: "4444444444444444444444444444444444444444444444444444444444444444",
        },
        {
          producerPath: "contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json",
          sha256: "5555555555555555555555555555555555555555555555555555555555555555",
        },
        {
          producerPath: "contracts/generated/mission-control/project-transfer-ack.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/project-transfer-ack.v1.schema.json",
          sha256: "6666666666666666666666666666666666666666666666666666666666666666",
        },
        {
          producerPath: "contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json",
          vendoredPath: "contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json",
          sha256: "7777777777777777777777777777777777777777777777777777777777777777",
        },
        {
          producerPath: "contracts/generated/mission-control/operational-active-run-status.v1.schema.json",
          vendoredPath: "contracts/vendor/setfarm/operational-active-run-status.v1.schema.json",
          sha256: "8888888888888888888888888888888888888888888888888888888888888888",
        },
      ],
      compatibilitySetHash:
        "d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407",
      vendorLockProjectionHash:
        "c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471",
    },
    deliveryEvidenceRef: DELIVERY_EVIDENCE_REF,
    deliveryEvidenceHash: DELIVERY_EVIDENCE_HASH,
  },
} as const;

const EXPECTED_EVIDENCE_CORE_CANONICAL_BYTES = `{"currentSource":{"branch":"main","buildHash":"3333333333333333333333333333333333333333333333333333333333333333","clean":true,"originMainSha":"1111111111111111111111111111111111111111","sha":"1111111111111111111111111111111111111111","treeHash":"2222222222222222222222222222222222222222222222222222222222222222"},"currentStatus":"current","deliveredPathBlobs":[{"blobHash":"4444444444444444444444444444444444444444444444444444444444444444","path":"server/routes/setfarm-operational.test.ts"},{"blobHash":"5555555555555555555555555555555555555555555555555555555555555555","path":"server/routes/setfarm-operational.ts"},{"blobHash":"6666666666666666666666666666666666666666666666666666666666666666","path":"server/services/setfarm-product-build-authority.ts"},{"blobHash":"7777777777777777777777777777777777777777777777777777777777777777","path":"server/services/setfarm-product-build-authority.test.ts"},{"blobHash":"8888888888888888888888888888888888888888888888888888888888888888","path":"src/lib/product-build-authority.ts"},{"blobHash":"9999999999999999999999999999999999999999999999999999999999999999","path":"src/components/run-detail/ProductBuildAuthority.tsx"},{"blobHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","path":"tests/product-build-authority-render.test.tsx"},{"blobHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","path":"contracts/vendor/setfarm/mission-control-contracts.v1.lock.json"}],"deliveryMergeAncestorOfCurrentSource":true,"deliveryMergeSha":"240e779d78804843a1202cbf0440fe423b806b1a","deliveryPrNumber":19,"focusedTests":{"argv":["node","--import","tsx","--test","server/routes/setfarm-operational.test.ts","server/services/setfarm-product-build-authority.test.ts","tests/product-build-authority-render.test.tsx"],"commandContractHash":"0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b","exitCode":0,"focusedTestReceiptHash":"d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667","focusedTestReceiptRef":"mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/d279cd2e9b2c984bbc4e290b4d7e608fad7502e92bd9f4df06a012afa0e1e667","passed":true,"schema":"mission-control.product-build-authority-v2-focused-test-receipt.v1","testPathBlobs":[{"blobHash":"4444444444444444444444444444444444444444444444444444444444444444","path":"server/routes/setfarm-operational.test.ts"},{"blobHash":"7777777777777777777777777777777777777777777777777777777777777777","path":"server/services/setfarm-product-build-authority.test.ts"},{"blobHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","path":"tests/product-build-authority-render.test.tsx"}]},"schema":"mission-control.product-build-authority-v2-delivery-evidence.v1","vendorLock":{"artifacts":[{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v1.compatibility.json","sha256":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v1.schema.json","sha256":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v1.schema.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v2.compatibility.json","sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v2.compatibility.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v2.schema.json","sha256":"0000000000000000000000000000000000000000000000000000000000000000","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v2.schema.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v3.compatibility.json","sha256":"1111111111111111111111111111111111111111111111111111111111111111","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v3.compatibility.json"},{"producerPath":"contracts/generated/mission-control/run-operational-snapshot.v3.schema.json","sha256":"2222222222222222222222222222222222222222222222222222222222222222","vendoredPath":"contracts/vendor/setfarm/run-operational-snapshot.v3.schema.json"},{"producerPath":"contracts/generated/mission-control/deployment-observation.v1.compatibility.json","sha256":"3333333333333333333333333333333333333333333333333333333333333333","vendoredPath":"contracts/vendor/setfarm/deployment-observation.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/deployment-observation.v1.schema.json","sha256":"4444444444444444444444444444444444444444444444444444444444444444","vendoredPath":"contracts/vendor/setfarm/deployment-observation.v1.schema.json"},{"producerPath":"contracts/generated/mission-control/project-transfer-ack.v1.compatibility.json","sha256":"5555555555555555555555555555555555555555555555555555555555555555","vendoredPath":"contracts/vendor/setfarm/project-transfer-ack.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/project-transfer-ack.v1.schema.json","sha256":"6666666666666666666666666666666666666666666666666666666666666666","vendoredPath":"contracts/vendor/setfarm/project-transfer-ack.v1.schema.json"},{"producerPath":"contracts/generated/mission-control/operational-active-run-status.v1.compatibility.json","sha256":"7777777777777777777777777777777777777777777777777777777777777777","vendoredPath":"contracts/vendor/setfarm/operational-active-run-status.v1.compatibility.json"},{"producerPath":"contracts/generated/mission-control/operational-active-run-status.v1.schema.json","sha256":"8888888888888888888888888888888888888888888888888888888888888888","vendoredPath":"contracts/vendor/setfarm/operational-active-run-status.v1.schema.json"}],"compatibilitySetHash":"d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407","lockContentHash":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","lockPath":"contracts/vendor/setfarm/mission-control-contracts.v1.lock.json","producerCommit":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","producerRepository":"https://github.com/hikmetgulsesli/setfarm.git","schema":"mission-control.product-build-authority-v2-vendor-lock-projection.v1","vendorLockProjectionHash":"c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471"}}`;

type MutableResponse = Record<string, any>;

function cloneFixture(): MutableResponse {
  return structuredClone(VALID_RESPONSE) as MutableResponse;
}

function assertInvalid(value: unknown): void {
  assert.throws(
    () => parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(value),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, INVALID_RESPONSE_CODE);
      assert.equal((error as Error & { code?: string }).code, INVALID_RESPONSE_CODE);
      return true;
    },
  );
}

function invalidMutation(mutator: (candidate: MutableResponse) => void): void {
  const candidate = cloneFixture();
  mutator(candidate);
  assertInvalid(candidate);
}

describe("Product Build Authority V2 delivery-evidence response v1", () => {
  it("accepts the exact canonical current response and literal hash projections", () => {
    assert.equal(
      PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_RESPONSE_SCHEMA_V1,
      "mission-control.product-build-authority-v2-delivery-evidence-response.v1",
    );
    assert.equal(
      PRODUCT_BUILD_AUTHORITY_V2_DELIVERY_EVIDENCE_CURRENT_STATUS_V1,
      "current",
    );
    assert.deepEqual(
      parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(cloneFixture()),
      VALID_RESPONSE,
    );

    const focusedCore = structuredClone(VALID_RESPONSE.evidence.focusedTests) as MutableResponse;
    delete focusedCore.focusedTestReceiptRef;
    delete focusedCore.focusedTestReceiptHash;
    assert.equal(
      hashCanonicalJson({ argv: VALID_RESPONSE.evidence.focusedTests.argv }),
      "0db837757920ce51b060993d379611fba899058e3ab9272888ab92d81fc5093b",
    );
    assert.equal(hashCanonicalJson(focusedCore), FOCUSED_TEST_HASH);

    assert.equal(
      hashCanonicalJson({
        schema: "mission-control.setfarm-contract-compatibility-set.v1",
        artifacts: VALID_RESPONSE.evidence.vendorLock.artifacts,
      }),
      "d81f264f01999758c95d6ce30a3312f67ce1fb9309daf0dcb1a0711c665a4407",
    );
    const vendorCore = structuredClone(VALID_RESPONSE.evidence.vendorLock) as MutableResponse;
    delete vendorCore.vendorLockProjectionHash;
    assert.equal(
      hashCanonicalJson(vendorCore),
      "c98a5ac68d8f6b2c9653a8f64fb6d4142f2245862c630a8b79c96a5403fd3471",
    );

    const evidenceCore = structuredClone(VALID_RESPONSE.evidence) as MutableResponse;
    delete evidenceCore.deliveryEvidenceRef;
    delete evidenceCore.deliveryEvidenceHash;
    assert.equal(
      canonicalJsonStringify(evidenceCore),
      EXPECTED_EVIDENCE_CORE_CANONICAL_BYTES,
    );
    assert.equal(hashCanonicalJson(evidenceCore), DELIVERY_EVIDENCE_HASH);
  });

  it("rejects absent, half-null, null, mixed, and extra success members", () => {
    for (const value of [undefined, null, true, [], {}, { currentStatus: "current" }]) {
      assertInvalid(value);
    }
    for (const key of [
      "schema",
      "currentStatus",
      "deliveryEvidenceRef",
      "deliveryEvidenceHash",
      "evidence",
    ]) {
      invalidMutation((candidate) => {
        delete candidate[key];
      });
      invalidMutation((candidate) => {
        candidate[key] = null;
      });
    }
    invalidMutation((candidate) => {
      candidate.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.currentSource.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.focusedTests.extra = true;
    });
    invalidMutation((candidate) => {
      candidate.evidence.vendorLock.extra = true;
    });
  });

  it("rejects response, evidence, delivery, and clean-main identity drift", () => {
    const mutations: Array<(candidate: MutableResponse) => void> = [
      (candidate) => { candidate.schema = "mission-control.product-build-authority-v2-delivery-evidence-response.v2"; },
      (candidate) => { candidate.currentStatus = "stale"; },
      (candidate) => { candidate.evidence.schema = "mission-control.product-build-authority-v2-delivery-evidence.v2"; },
      (candidate) => { candidate.evidence.currentStatus = "stale"; },
      (candidate) => { candidate.evidence.deliveryPrNumber = 20; },
      (candidate) => { candidate.evidence.deliveryMergeSha = "0".repeat(40); },
      (candidate) => { candidate.evidence.deliveryMergeAncestorOfCurrentSource = false; },
      (candidate) => { candidate.evidence.currentSource.branch = "feature"; },
      (candidate) => { candidate.evidence.currentSource.clean = false; },
      (candidate) => { candidate.evidence.currentSource.originMainSha = "0".repeat(40); },
      (candidate) => { candidate.evidence.currentSource.buildHash = "0".repeat(64); },
    ];
    for (const mutate of mutations) invalidMutation(mutate);
  });

  it("rejects delivered path/blob reorder, duplicate, count, and identity drift", () => {
    invalidMutation((candidate) => {
      [candidate.evidence.deliveredPathBlobs[0], candidate.evidence.deliveredPathBlobs[1]] =
        [candidate.evidence.deliveredPathBlobs[1], candidate.evidence.deliveredPathBlobs[0]];
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs[1] = candidate.evidence.deliveredPathBlobs[0];
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs.pop();
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs.push(candidate.evidence.deliveredPathBlobs[0]);
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs[4].path = "src/lib/other.ts";
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveredPathBlobs[4].blobHash = "0".repeat(64);
    });
  });

  it("rejects focused-test command, path/blob, result, and receipt drift", () => {
    const mutations: Array<(candidate: MutableResponse) => void> = [
      (candidate) => { candidate.evidence.focusedTests.schema = "wrong"; },
      (candidate) => { candidate.evidence.focusedTests.argv.reverse(); },
      (candidate) => { candidate.evidence.focusedTests.commandContractHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.focusedTests.testPathBlobs.reverse(); },
      (candidate) => { candidate.evidence.focusedTests.testPathBlobs[0].blobHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.focusedTests.exitCode = 1; },
      (candidate) => { candidate.evidence.focusedTests.passed = false; },
      (candidate) => { candidate.evidence.focusedTests.focusedTestReceiptHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.focusedTests.focusedTestReceiptRef = `${FOCUSED_TEST_REF}x`; },
    ];
    for (const mutate of mutations) invalidMutation(mutate);
  });

  it("rejects vendor-lock identity reorder, duplicate, count, projection, and cross-field drift", () => {
    const mutations: Array<(candidate: MutableResponse) => void> = [
      (candidate) => { candidate.evidence.vendorLock.schema = "wrong"; },
      (candidate) => { candidate.evidence.vendorLock.lockPath = "contracts/vendor/setfarm/other.lock.json"; },
      (candidate) => { candidate.evidence.vendorLock.producerRepository = "https://example.invalid/setfarm.git"; },
      (candidate) => { candidate.evidence.vendorLock.lockContentHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.vendorLock.compatibilitySetHash = "0".repeat(64); },
      (candidate) => { candidate.evidence.vendorLock.vendorLockProjectionHash = "0".repeat(64); },
      (candidate) => {
        [candidate.evidence.vendorLock.artifacts[0], candidate.evidence.vendorLock.artifacts[1]] =
          [candidate.evidence.vendorLock.artifacts[1], candidate.evidence.vendorLock.artifacts[0]];
      },
      (candidate) => {
        candidate.evidence.vendorLock.artifacts[1] = candidate.evidence.vendorLock.artifacts[0];
      },
      (candidate) => { candidate.evidence.vendorLock.artifacts.pop(); },
      (candidate) => {
        candidate.evidence.vendorLock.artifacts.push(candidate.evidence.vendorLock.artifacts[0]);
      },
      (candidate) => { candidate.evidence.vendorLock.artifacts[6].producerPath = "wrong"; },
      (candidate) => { candidate.evidence.vendorLock.artifacts[6].vendoredPath = "wrong"; },
      (candidate) => { candidate.evidence.vendorLock.artifacts[6].sha256 = "0".repeat(64); },
    ];
    for (const mutate of mutations) invalidMutation(mutate);
  });

  it("rejects malformed hashes at every Git-object and SHA-256 boundary", () => {
    assert.equal(GIT_OBJECT_HASH_V1_PATTERN.test("a".repeat(40)), true);
    assert.equal(GIT_OBJECT_HASH_V1_PATTERN.test("b".repeat(64)), true);
    assert.equal(SHA256_V1_PATTERN.test("c".repeat(64)), true);

    const gitSetters = [
      (candidate: MutableResponse, value: string) => { candidate.evidence.deliveryMergeSha = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.sha = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.treeHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.originMainSha = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.producerCommit = value; },
    ];
    for (const setHash of gitSetters) {
      for (const value of [
        "a".repeat(39),
        "a".repeat(41),
        "a".repeat(63),
        "a".repeat(65),
        "A".repeat(40),
        `${"a".repeat(39)}g`,
      ]) {
        invalidMutation((candidate) => setHash(candidate, value));
      }
    }

    const shaSetters = [
      (candidate: MutableResponse, value: string) => { candidate.deliveryEvidenceHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.deliveryEvidenceHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.currentSource.buildHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.deliveredPathBlobs[0].blobHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.focusedTests.commandContractHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.focusedTests.testPathBlobs[0].blobHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.focusedTests.focusedTestReceiptHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.lockContentHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.artifacts[0].sha256 = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.compatibilitySetHash = value; },
      (candidate: MutableResponse, value: string) => { candidate.evidence.vendorLock.vendorLockProjectionHash = value; },
    ];
    for (const setHash of shaSetters) {
      for (const value of [
        "a".repeat(40),
        "a".repeat(63),
        "a".repeat(65),
        "A".repeat(64),
        `${"a".repeat(63)}g`,
      ]) {
        invalidMutation((candidate) => setHash(candidate, value));
      }
    }
  });

  it("rejects crossed refs, hashes, and bodies even when each scalar is well formed", () => {
    invalidMutation((candidate) => {
      candidate.deliveryEvidenceHash = "0".repeat(64);
      candidate.deliveryEvidenceRef =
        `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${"0".repeat(64)}`;
    });
    invalidMutation((candidate) => {
      candidate.evidence.deliveryEvidenceHash = "0".repeat(64);
      candidate.evidence.deliveryEvidenceRef =
        `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${"0".repeat(64)}`;
    });
    invalidMutation((candidate) => {
      candidate.evidence.focusedTests.focusedTestReceiptHash = "0".repeat(64);
      candidate.evidence.focusedTests.focusedTestReceiptRef =
        `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${"0".repeat(64)}`;
    });
    invalidMutation((candidate) => {
      candidate.evidence.currentSource.treeHash = "0".repeat(64);
    });
  });

  it("has a Setfarm-local static import boundary and exposes no injectable production port", async () => {
    const source = await readFile(
      new URL(
        "../../src/internal-production/product-build-authority-v2-delivery-evidence-v1.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const imports = [...source.matchAll(
      /^\s*import(?:\s+type)?(?:[^;]*?\sfrom\s*)?["']([^"']+)["'];/gmu,
    )].map((match) => match[1]);
    assert.deepEqual(imports, ["zod", "../product-compiler/canonical-json.js"]);
    assert.equal(source.includes("import type"), false);
    assert.equal(source.includes("import("), false);
    assert.equal(source.includes("require("), false);
    assert.equal(imports.some((specifier) => specifier?.includes("mission-control")), false);
    assert.equal(imports.some((specifier) => specifier?.startsWith("../../")), false);
    assert.deepEqual(
      [...source.matchAll(/export function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]),
      ["parseProductBuildAuthorityV2DeliveryEvidenceResponseV1"],
    );
    assert.match(
      source,
      /parseProductBuildAuthorityV2DeliveryEvidenceResponseV1\(value: unknown\)/u,
    );
    assert.doesNotMatch(source, /(?:parser|transport|sourceRoot|missionControlRoot)\s*[?:]/u);
  });
});
