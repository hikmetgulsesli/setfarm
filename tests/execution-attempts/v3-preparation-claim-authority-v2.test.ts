import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  V3PreparationClaimAuthorityV2Schema,
  authorityHashForV3PreparationClaimV2,
  createV3PreparationClaimAuthorityV2,
} from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { V3PreparationClaimAuthorityV1Schema } from "../../src/execution/v3-preparation-claim-authority.js";
import { topologyPathAbsenceHash } from "../../src/product-compiler/schemas/build-topology-v1.js";

function dependency(storyId: string, token: string) {
  return {
    storyId,
    attemptId: `ATT_${token.repeat(16)}`,
    attemptGeneration: token === "a" ? 1 : 2,
    attemptClass: "product_implementation" as const,
    disposition: "produced_delta" as const,
    sliceHash: token.repeat(64),
    outputHash: token.toUpperCase().repeat(64).toLowerCase(),
    sourceAfter: {
      sha: token.repeat(40),
      treeHash: token.repeat(40),
    },
    fileSignatures: [
      {
        pathRef: `PATH_${token.toUpperCase()}_OPTIONAL`,
        path: `src/${token}.optional.ts`,
        presence: "absent" as const,
        contentHash: topologyPathAbsenceHash(`src/${token}.optional.ts`),
      },
      {
        pathRef: `PATH_${token.toUpperCase()}_OWNED`,
        path: `src/${token}.ts`,
        presence: "present" as const,
        contentHash: token.repeat(64),
      },
    ],
  };
}

function authority() {
  return createV3PreparationClaimAuthorityV2({
    stateVersion: 7,
    runId: "run-native-packet-v3",
    stepId: "implement",
    storyId: "US-003",
    packetHash: "c".repeat(64),
    compilationReportHash: "f".repeat(64),
    baseRevision: { sha: "d".repeat(40), treeHash: "e".repeat(40) },
    projectedDependencyIds: ["US-002", "US-001"],
    dependencyAttempts: [dependency("US-002", "b"), dependency("US-001", "a")],
  });
}

describe("V3 preparation claim authority v2", () => {
  it("canonically binds the native packet and exact terminal dependency outputs", () => {
    const value = authority();
    assert.equal(value.schema, "setfarm.v3-preparation-claim-authority.v2");
    assert.equal(value.authorityVersion, 2);
    assert.equal(value.packetSchema, "setfarm.product-build-packet.v3");
    assert.deepEqual(value.projectedDependencyIds, ["US-001", "US-002"]);
    assert.deepEqual(value.dependencyAttempts.map((item) => item.storyId), ["US-001", "US-002"]);
    const { authorityHash: _authorityHash, ...payload } = value;
    assert.equal(value.authorityHash, authorityHashForV3PreparationClaimV2(payload));
    assert.deepEqual(V3PreparationClaimAuthorityV2Schema.parse(value), value);
    assert.equal(V3PreparationClaimAuthorityV1Schema.safeParse(value).success, false);
  });

  it("rejects missing dependency slice/output identity and every forged authority field", () => {
    const value = authority();
    for (const mutate of [
      (candidate: any) => { delete candidate.dependencyAttempts[0].sliceHash; },
      (candidate: any) => { delete candidate.dependencyAttempts[0].outputHash; },
      (candidate: any) => { delete candidate.dependencyAttempts[0].attemptGeneration; },
      (candidate: any) => { candidate.dependencyAttempts[0].attemptId = "ATT_short"; },
      (candidate: any) => { candidate.dependencyAttempts[0].sourceAfter.sha = "f".repeat(40); },
      (candidate: any) => { candidate.dependencyAttempts[0].fileSignatures = []; },
      (candidate: any) => { candidate.dependencyAttempts[0].fileSignatures.reverse(); },
      (candidate: any) => { candidate.dependencyAttempts[0].fileSignatures[1].pathRef = candidate.dependencyAttempts[0].fileSignatures[0].pathRef; },
      (candidate: any) => { candidate.dependencyAttempts[0].fileSignatures[1].path = candidate.dependencyAttempts[0].fileSignatures[0].path; },
      (candidate: any) => { candidate.dependencyAttempts[0].fileSignatures[0].contentHash = "f".repeat(64); },
      (candidate: any) => { candidate.packetHash = "f".repeat(64); },
      (candidate: any) => { candidate.compilationReportHash = "0".repeat(64); },
      (candidate: any) => { candidate.baseRevision.treeHash = "f".repeat(40); },
      (candidate: any) => { candidate.projectedDependencyIds = ["US-001"]; },
      (candidate: any) => { candidate.dependencyAttempts.reverse(); },
      (candidate: any) => { candidate.authorityHash = "0".repeat(64); },
    ]) {
      const candidate = structuredClone(value);
      mutate(candidate);
      assert.equal(V3PreparationClaimAuthorityV2Schema.safeParse(candidate).success, false);
    }
  });

  it("allows an exact zero-dependency first story without losing the version discriminator", () => {
    const value = createV3PreparationClaimAuthorityV2({
      stateVersion: 1,
      runId: "run-first-story",
      stepId: "implement",
      storyId: "US-001",
      packetHash: "1".repeat(64),
      compilationReportHash: "4".repeat(64),
      baseRevision: { sha: "2".repeat(40), treeHash: "3".repeat(40) },
      projectedDependencyIds: [],
      dependencyAttempts: [],
    });
    assert.equal(V3PreparationClaimAuthorityV2Schema.safeParse(value).success, true);
    assert.equal(value.authorityVersion, 2);
  });

  it("uses one host-independent order and the same UTF-8 identity boundary as PostgreSQL", () => {
    const mixed = createV3PreparationClaimAuthorityV2({
      stateVersion: 2,
      runId: "run-mixed-order",
      stepId: "implement",
      storyId: "US-mixed",
      packetHash: "1".repeat(64),
      compilationReportHash: "4".repeat(64),
      baseRevision: { sha: "2".repeat(40), treeHash: "3".repeat(40) },
      projectedDependencyIds: ["US_A", "US-A"],
      dependencyAttempts: [dependency("US_A", "b"), dependency("US-A", "a")],
    });
    assert.deepEqual(mixed.projectedDependencyIds, ["US-A", "US_A"]);
    assert.deepEqual(mixed.dependencyAttempts.map((item) => item.storyId), ["US-A", "US_A"]);

    assert.throws(() => createV3PreparationClaimAuthorityV2({
      stateVersion: 1,
      runId: "ü".repeat(251),
      stepId: "implement",
      storyId: "US-001",
      packetHash: "1".repeat(64),
      compilationReportHash: "4".repeat(64),
      baseRevision: { sha: "2".repeat(40), treeHash: "3".repeat(40) },
      projectedDependencyIds: [],
      dependencyAttempts: [],
    }), /500 UTF-8 bytes/);
  });
});
