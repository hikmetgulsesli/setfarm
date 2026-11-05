import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  V3PreparationClaimAuthorityV2Schema,
  authorityHashForV3PreparationClaimV2,
  createV3PreparationClaimAuthorityV2,
} from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { V3PreparationClaimAuthorityV1Schema } from "../../src/execution/v3-preparation-claim-authority.js";
import { topologyPathAbsenceHash } from "../../src/product-compiler/schemas/build-topology-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createV3PreparationClaimAuthorityV1 as createHistoricalV1 } from "../../src/execution/v3-preparation-claim-authority.js";
import {
  createV3PreparationClaimAuthorityV2 as createRuntimeV2,
  V3PreparationClaimAuthorityV1Schema as RuntimeV1Schema,
  V3PreparationClaimAuthorityV2Schema as RuntimeV2Schema,
  V3PreparationDependencyAttemptAuthorityV2Schema as RuntimeDependencyV2Schema,
  projectV3PreparationRuntimeAuthorityV1,
} from "../../src/execution/v3-preparation-runtime-authority-v1.js";


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
      runId: "\u00fc".repeat(251),
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

// DATA compatibility only. Actual source-owner/claim/lease authentication is
// separately exercised by the existing owned native integration producer.
describe("runtime preparation authority preserves frozen migration contracts", () => {
  function input() {
    const { schema: _schema, authorityVersion: _version, packetSchema: _packetSchema,
      authorityHash: _hash, ...value } = authority();
    return value;
  }
  function verifier() {
    return RuntimeDependencyV2Schema.parse({
      ...dependency("US-002", "b"), attemptGeneration: 3,
      attemptClass: "evidence_only", disposition: "verified",
      evidenceRefresh: {
        kind: "native_evidence_refresh", sourceOwnerAttemptId: `ATT_${"c".repeat(16)}`,
        sourceOwnerGeneration: 2, sourceOwnerOutputHash: "c".repeat(64), sourceOwnerClaimOutcome: "completed",
        initialAuthorityHash: "d".repeat(64), recoveryCaseId: `RCV_${"e".repeat(64)}`,
        revisionId: `RREV_${"f".repeat(64)}`, dispatchId: `RDISP_${"a".repeat(64)}`,
        evidencePlanArtifactHash: "d".repeat(64), evidenceBundleHash: "b".repeat(64),
      },
    });
  }
  function rehash<T extends { authorityHash: string }>(value: T) {
    const { authorityHash: _hash, ...payload } = value;
    return { ...payload, authorityHash: hashCanonicalJson(payload) };
  }

  it("preserves exact historical model payload/hash and scheduling projection", () => {
    for (const value of [input(), { ...input(), storyId: "US-001", projectedDependencyIds: [], dependencyAttempts: [] }]) {
      const historical = createV3PreparationClaimAuthorityV2(value);
      const runtime = createRuntimeV2(value);
      assert.equal(canonicalJsonStringify(runtime), canonicalJsonStringify(historical));
      assert.equal(runtime.authorityHash, historical.authorityHash);
      assert.deepEqual(RuntimeV2Schema.parse(historical), historical);
      const projected = projectV3PreparationRuntimeAuthorityV1(runtime);
      const expected = createHistoricalV1({
        stateVersion: historical.stateVersion, runId: historical.runId, stepId: historical.stepId,
        storyId: historical.storyId, packetHash: historical.packetHash, baseRevision: historical.baseRevision,
        projectedDependencyIds: historical.projectedDependencyIds,
        dependencyAttempts: historical.dependencyAttempts.map(item => ({
          storyId: item.storyId, attemptId: item.attemptId, attemptClass: item.attemptClass,
          disposition: item.disposition, sourceRevision: item.sourceAfter,
        })),
      });
      assert.equal(canonicalJsonStringify(projected), canonicalJsonStringify(expected));
      assert.equal(projected.authorityHash, expected.authorityHash);
    }
  });

  it("keeps mixed verifier DATA disjoint from both historical parsers", () => {
    const value = createRuntimeV2({ ...input(), dependencyAttempts: [verifier(), dependency("US-001", "a")] });
    assert.deepEqual(RuntimeV2Schema.parse(value), value);
    assert.equal(V3PreparationClaimAuthorityV2Schema.safeParse(value).success, false);
    const projected = projectV3PreparationRuntimeAuthorityV1(value);
    assert.deepEqual(RuntimeV1Schema.parse(projected), projected);
    assert.equal(V3PreparationClaimAuthorityV1Schema.safeParse(projected).success, false);
    const verified = projected.dependencyAttempts.find(item => item.attemptClass === "evidence_only");
    assert.ok(verified && verified.attemptClass === "evidence_only");
    assert.equal(verified.evidenceRefresh.sourceOwnerAttemptId, `ATT_${"c".repeat(16)}`);
    assert.equal(verified.attemptId, `ATT_${"b".repeat(16)}`);
  });


  it("keeps accepted operational fallback DATA strict beside model and verifier dependencies", () => {
    const model = dependency("US-001", "a");
    const refresh = verifier();
    const fallback = RuntimeDependencyV2Schema.parse({
      ...dependency("US-003", "d"), attemptGeneration: 3,
      attemptClass: "infrastructure_retry", disposition: "verified",
      operationalRetry: {
        kind: "native_operational_retry", priorAttemptId: `ATT_${"e".repeat(16)}`,
        priorClaimId: 17, priorGeneration: 2, initialAuthorityHash: "f".repeat(64),
        directiveHash: "a".repeat(64), directiveArtifactHash: "b".repeat(64),
        evidencePlanArtifactHash: "c".repeat(64), evidenceBundleHash: "e".repeat(64),
      },
    });
    if (fallback.attemptClass !== "infrastructure_retry") assert.fail("typed operational branch required");
    const value = createRuntimeV2({
      ...input(), storyId: "US-004", projectedDependencyIds: ["US-003", "US-001", "US-002"],
      dependencyAttempts: [fallback, model, refresh],
    });
    assert.deepEqual(RuntimeV2Schema.parse(value), value);
    assert.deepEqual(value.dependencyAttempts.map(item => item.attemptClass),
      ["product_implementation", "evidence_only", "infrastructure_retry"]);
    assert.equal(canonicalJsonStringify(value.dependencyAttempts[0]), canonicalJsonStringify(model));
    assert.equal(fallback.outputHash, "d".repeat(64));
    assert.notEqual(fallback.outputHash, fallback.operationalRetry.evidenceBundleHash);
    assert.equal(V3PreparationClaimAuthorityV2Schema.safeParse(value).success, false);
    const projected = projectV3PreparationRuntimeAuthorityV1(value);
    assert.deepEqual(RuntimeV1Schema.parse(projected), projected);
    assert.equal(V3PreparationClaimAuthorityV1Schema.safeParse(projected).success, false);
    const projectedFallback = projected.dependencyAttempts.find(item => item.attemptClass === "infrastructure_retry");
    assert.ok(projectedFallback && projectedFallback.attemptClass === "infrastructure_retry");
    assert.deepEqual(projectedFallback.operationalRetry, fallback.operationalRetry);

    const { operationalRetry: _witness, ...withoutWitness } = fallback;
    const invalidFallbacks = [
      ["missing witness", withoutWitness],
      ["extra witness field", { ...fallback, operationalRetry: { ...fallback.operationalRetry, extraAuthority: true } }],
      ["wrong witness kind", { ...fallback, operationalRetry: { ...fallback.operationalRetry, kind: "native_evidence_refresh" } }],
      ["self predecessor", { ...fallback, operationalRetry: { ...fallback.operationalRetry, priorAttemptId: fallback.attemptId } }],
      ["non-immediate generation", { ...fallback, attemptGeneration: 4 }],
      ["non-verified fallback", { ...fallback, disposition: "produced_delta" }],
    ] as const;
    for (const [label, candidate] of invalidFallbacks) {
      assert.equal(RuntimeV2Schema.safeParse(rehash({
        ...value, dependencyAttempts: [model, refresh, candidate],
      })).success, false, label);
    }
    for (const [label, dependencies] of [
      ["model cannot carry operational witness", [{ ...model, operationalRetry: fallback.operationalRetry }, refresh, fallback]],
      ["verifier cannot carry operational witness", [model, { ...refresh, operationalRetry: fallback.operationalRetry }, fallback]],
    ] as const) {
      assert.equal(RuntimeV2Schema.safeParse(rehash({
        ...value, dependencyAttempts: dependencies,
      })).success, false, label);
    }
    const { operationalRetry: _projectedWitness, ...projectedWithoutWitness } = projectedFallback;
    for (const candidate of [projectedWithoutWitness, { ...projectedFallback,
      operationalRetry: { ...projectedFallback.operationalRetry, extraAuthority: true },
    }]) {
      assert.equal(RuntimeV1Schema.safeParse(rehash({
        ...projected, dependencyAttempts: [...projected.dependencyAttempts.slice(0, 2), candidate],
      })).success, false);
    }
    const historical = createV3PreparationClaimAuthorityV2(input());
    assert.equal(canonicalJsonStringify(createRuntimeV2(input())), canonicalJsonStringify(historical));
    assert.equal(createRuntimeV2(input()).authorityHash, historical.authorityHash);
  });

  it("rejects recomputed mixed hashes with missing, duplicate, crossed or extra authority", () => {
    const native = verifier();
    assert.equal(native.attemptClass, "evidence_only");
    if (native.attemptClass !== "evidence_only") assert.fail("typed verifier branch required");
    const model = dependency("US-001", "a");
    const value = createRuntimeV2({ ...input(), dependencyAttempts: [model, native] });
    const variants = [
      { ...value, dependencyAttempts: [native, model] },
      { ...value, dependencyAttempts: [model, model, native] },
      { ...value, dependencyAttempts: [native] },
      { ...value, projectedDependencyIds: ["US-001"] },
      { ...value, projectedDependencyIds: ["US-001", "US-001", "US-002"] },
      { ...value, runId: "\u00fc".repeat(251) },
      { ...value, unexpected: true },
      { ...value, dependencyAttempts: [model, { ...native, attemptGeneration: 4 }] },
      { ...value, dependencyAttempts: [model, { ...native, disposition: "produced_delta" }] },
      { ...value, dependencyAttempts: [model, { ...native, evidenceRefresh: { ...native.evidenceRefresh,
        evidenceBundleHash: "f".repeat(64) } }] },
      { ...value, dependencyAttempts: [model, { ...native, evidenceRefresh: { ...native.evidenceRefresh,
        extraAuthority: true } }] },
      { ...value, dependencyAttempts: [model, { ...native, evidenceRefresh: undefined }] },
      { ...value, dependencyAttempts: [model, { ...native, fileSignatures: [...native.fileSignatures].reverse() }] },
      { ...value, dependencyAttempts: [model, { ...native, fileSignatures:
        native.fileSignatures.map(file => ({ ...file, path: "src/duplicate.ts" })) }] },
    ];
    for (const candidate of variants) {
      // Undefined DATA is rejected by strict parsing too; it cannot be hashed
      // into an immutable authority envelope.
      if (candidate.dependencyAttempts.some(item => "evidenceRefresh" in item && item.evidenceRefresh === undefined)) {
        assert.equal(RuntimeV2Schema.safeParse(candidate).success, false);
      } else {
        assert.equal(RuntimeV2Schema.safeParse(rehash(candidate)).success, false);
      }
    }
    const oversized = rehash({ ...value, dependencyAttempts: [model, { ...native,
      fileSignatures: Array.from({ length: 12_000 }, (_, index) => ({
        pathRef: `PATH_LONG_${String(index).padStart(5, "0")}`,
        path: `src/${"a".repeat(275)}/${String(index).padStart(5, "0")}.ts`,
        presence: "present", contentHash: "b".repeat(64),
      })),
    }] });
    assert.ok(Buffer.byteLength(canonicalJsonStringify(oversized), "utf8") > 4 * 1024 * 1024);
    assert.equal(RuntimeV2Schema.safeParse(oversized).success, false);
    const projected = projectV3PreparationRuntimeAuthorityV1(value);
    assert.equal(RuntimeV1Schema.safeParse(rehash({ ...projected,
      dependencyAttempts: projected.dependencyAttempts.slice(1) })).success, false);
  });
});
