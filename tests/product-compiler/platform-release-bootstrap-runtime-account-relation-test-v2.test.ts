import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA,
  hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2,
} from "../../src/execution/schemas/platform-release-host-composition-v2.js";
import {
  hashPlatformReleaseBootstrapWireMessageV2,
} from "../../src/execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_LOOKUP_SUCCESS_V2_SCHEMA,
  PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2,
  buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2,
  parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2,
} from "../../src/product-compiler/platform-release-bootstrap-runtime-account-relation-test-support-v2.js";

const HOST_HASH = "a".repeat(64);
const USER_UUID = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
const GROUP_UUID = "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB";
const RECORD_HASH = "c".repeat(64);

function receiptV2() {
  const identity = {
    schema: PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA,
    receiptVersion: "2.0.0" as const,
    accountRef: "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2" as const,
    authorityState: "test_fixture_identity_unverified" as const,
    uid: 601,
    gid: 601,
    ownerSeparationPolicy:
      "uid_gid_nonzero_and_distinct_from_every_host_file_owner_v2" as const,
    hostIdentityHash: HOST_HASH,
  };
  return {
    ...identity,
    receiptHash: hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2(
      identity,
    ),
  };
}

function lookupV2(
  occurrenceId: string,
  observationHash: string,
  overrides: Record<string, unknown> = {},
) {
  const identity = {
    schema: PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_LOOKUP_SUCCESS_V2_SCHEMA,
    version: "2.0.0" as const,
    occurrenceId,
    accountRef: "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2",
    recordState: "present_exact" as const,
    uid: "601",
    gid: "601",
    userRecordUuid: USER_UUID,
    groupRecordUuid: GROUP_UUID,
    recordIdentityHash: RECORD_HASH,
    hostIdentityHash: HOST_HASH,
    observationHash,
    ...overrides,
  };
  return {
    ...identity,
    messageHash: hashPlatformReleaseBootstrapWireMessageV2(
      identity.schema,
      identity,
    ),
  };
}

function inputV2(
  before = lookupV2(
    "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
    "d".repeat(64),
  ),
  after = lookupV2(
    "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB",
    "e".repeat(64),
  ),
) {
  return {
    provisioningReceipt: receiptV2(),
    beforeLookupObservation: before,
    afterLookupObservation: after,
  };
}

function assertInvalidV2(action: () => unknown, code?: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(
      error instanceof PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2,
    );
    if (code !== undefined) assert.equal(error.code, code);
    return true;
  });
}

describe("test-only runtime-account dual-observation relation", () => {
  it("joins two equal fixture lookup observations without exposing account identity", () => {
    const relation =
      buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(inputV2());
    assert.deepEqual(Object.keys(relation).sort(), [
      "admissionScope",
      "afterLookupObservationHash",
      "authorityState",
      "beforeLookupObservationHash",
      "credentialUse",
      "mutationAuthority",
      "observationHash",
      "productionAdmission",
      "productionAuthority",
      "provisioningReceiptHash",
      "schema",
      "stableRecordProjectionHash",
      "trustConclusion",
      "version",
    ]);
    assert.equal(relation.admissionScope, "test_fixture");
    assert.equal(relation.authorityState, "observed_test_fixture_unverified");
    assert.equal(relation.productionAuthority, false);
    assert.equal(relation.productionAdmission, "forbidden");
    assert.equal(relation.credentialUse, "none");
    assert.equal(relation.mutationAuthority, false);
    assert.equal(relation.trustConclusion, "characterization_only");
    assert.equal(Object.isFrozen(relation), true);
    const serialized = JSON.stringify(relation);
    assert.equal(serialized.includes("TEST_FIXTURE"), false);
    assert.equal(serialized.includes("/Library"), false);
    assert.equal(Object.hasOwn(relation, "uid"), false);
    assert.equal(Object.hasOwn(relation, "gid"), false);
    assert.deepEqual(
      parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2(
        JSON.parse(serialized),
      ),
      relation,
    );
  });

  it("rejects a durable or production-shaped receipt", () => {
    const receipt = receiptV2();
    const production = {
      ...receipt,
      accountRef: "SETFARM_PLATFORM_RELEASE_RUNTIME_V2" as const,
      authorityState: "durable_os_account_verified" as const,
    };
    production.receiptHash = hashPlatformReleaseHostCompositionRuntimeAccountReceiptV2({
      schema: production.schema,
      receiptVersion: production.receiptVersion,
      accountRef: production.accountRef,
      authorityState: production.authorityState,
      uid: production.uid,
      gid: production.gid,
      ownerSeparationPolicy: production.ownerSeparationPolicy,
      hostIdentityHash: production.hostIdentityHash,
    });
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2({
        ...inputV2(),
        provisioningReceipt: production,
      }),
      "RUNTIME_ACCOUNT_RELATION_RECEIPT_INVALID",
    );
  });

  it("rejects tampering, unequal state, repeated occurrences, and repeated observations", () => {
    const tampered = receiptV2();
    tampered.uid = 602;
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2({
        ...inputV2(),
        provisioningReceipt: tampered,
      }),
      "RUNTIME_ACCOUNT_RELATION_RECEIPT_INVALID",
    );
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
        inputV2(
          lookupV2(
            "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
            "d".repeat(64),
          ),
          lookupV2(
            "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB",
            "e".repeat(64),
            { uid: "602", gid: "602" },
          ),
        ),
      ),
      "RUNTIME_ACCOUNT_RELATION_MISMATCH",
    );
    const repeatedOccurrence = lookupV2(
      "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
      "e".repeat(64),
    );
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
        inputV2(undefined, repeatedOccurrence),
      ),
      "RUNTIME_ACCOUNT_RELATION_MISMATCH",
    );
    const repeatedObservation = lookupV2(
      "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB",
      "d".repeat(64),
    );
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
        inputV2(undefined, repeatedObservation),
      ),
      "RUNTIME_ACCOUNT_RELATION_MISMATCH",
    );
    for (const [field, value] of [
      ["accountRef", "OTHER_ACCOUNT_V2"],
      ["hostIdentityHash", "f".repeat(64)],
      ["userRecordUuid", "CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC"],
      ["groupRecordUuid", "DDDDDDDD-DDDD-4DDD-8DDD-DDDDDDDDDDDD"],
      ["recordIdentityHash", "f".repeat(64)],
    ] as const) {
      assertInvalidV2(
        () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
          inputV2(
            lookupV2(
              "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
              "d".repeat(64),
              { [field]: value },
            ),
          ),
        ),
        "RUNTIME_ACCOUNT_RELATION_MISMATCH",
      );
    }
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
        inputV2(
          lookupV2(
            "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
            "d".repeat(64),
            { recordState: "absent", uid: null, gid: null },
          ),
        ),
      ),
      "RUNTIME_ACCOUNT_RELATION_OBSERVATION_INVALID",
    );
  });

  it("rejects proxy and unknown-field input before unsafe reads", () => {
    let trapCalls = 0;
    const proxied = new Proxy(inputV2(), {
      ownKeys() {
        trapCalls += 1;
        throw new Error("proxy trap must not run");
      },
    });
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(proxied),
      "RUNTIME_ACCOUNT_RELATION_INPUT_INVALID",
    );
    assert.equal(trapCalls, 0);
    assertInvalidV2(
      () => buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2({
        ...inputV2(),
        unexpected: true,
      } as never),
      "RUNTIME_ACCOUNT_RELATION_INPUT_INVALID",
    );
  });

  it("keeps the support module outside production mutation and process surfaces", () => {
    const source = readFileSync(
      new URL(
        "../../src/product-compiler/platform-release-bootstrap-runtime-account-relation-test-support-v2.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.equal(source.includes("node:fs"), false);
    assert.equal(source.includes("node:child_process"), false);
    assert.equal(source.includes("platform-release-host-composition-authority-v2"), false);
    assert.equal(source.includes("openPlatformReleaseHostCompositionAuthorityV2Internal"), false);
    assert.equal(source.includes("mutationAuthority: false"), true);
  });
});
