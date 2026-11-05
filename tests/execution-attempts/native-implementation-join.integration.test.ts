import assert from "node:assert/strict";
import { rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { IndexedArtifactPublisher, bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { createRuntimeArtifactReader } from "../../src/product-compiler/runtime-artifact-reader.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { createV3PreparationBlockRepository } from "../../src/execution/v3-preparation-block-repository.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { createV3PreparationClaimAuthorityV1 } from "../../src/execution/v3-preparation-claim-authority.js";
import { readV3PreparationAuthorityV2 } from "../../src/execution/v3-preparation-authority-v2-repository.js";
import { createV3NormalImplementationPreclaim } from "../../src/execution/v3-normal-implementation-preclaim.js";
import { seedCanonicalCompilerStoryAdmissionFixture } from "./helpers/compiler-story-english-admission-fixture.js";
import { nativeJoinEnvelope, nativeJoinPacket, nativeJoinSourceFixture,
  NATIVE_JOIN_LIMITS, NATIVE_JOIN_PRODUCER } from "./helpers/native-implementation-join-fixture.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

// Every SQL operation below runs in the existing P3-owned isolated database.
// Packet bytes are real indexed CAS publications; no SQL response is mocked.
describe("inactive native implementation preparation join", { concurrency: 1 }, () => {
  let database: TestDatabase;
  let artifacts: { artifactRoot: string; store: ContentAddressedArtifactStore; publisher: IndexedArtifactPublisher };
  const roots: string[] = [];
  before(async () => {
    database = await createIsolatedTestDatabase();
    const source = await nativeJoinSourceFixture();
    roots.push(source.root);
    const artifactRoot = path.join(source.root, "artifacts");
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits: NATIVE_JOIN_LIMITS });
    const index = createArtifactIndex(database.sql);
    await bootstrapArtifactIndex({ index, store,
      quotaBytes: NATIVE_JOIN_LIMITS.rootQuotaBytes, maxPayloadBytes: NATIVE_JOIN_LIMITS.maxPayloadBytes });
    artifacts = { artifactRoot, store, publisher: new IndexedArtifactPublisher({ index, store, ownerInstanceId: "native-join-test" }) };
  });
  after(async () => {
    await database?.cleanup();
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  });

  async function fixture(suffix: string, twoStories = false) {
    const source = await nativeJoinSourceFixture();
    roots.push(source.root);
    const runId = `run-native-join-${suffix}`;
    const packet = nativeJoinPacket(runId, twoStories);
    const admission = await seedCanonicalCompilerStoryAdmissionFixture(database, {
      runId, releaseSha: NATIVE_JOIN_PRODUCER.codeSha, packetHash: packet.packetHash,
    });
    const { artifactRoot, store, publisher } = artifacts;
    const index = createArtifactIndex(database.sql);
    const artifactRefs: Record<string, string> = {};
    for (const [ref, payload] of [
      ["PRODUCT_SPEC", packet.productSpec], ["BUILD_TOPOLOGY", packet.buildTopology],
      ["STORY_PLAN", packet.storyPlan], ["DESIGN_SOURCE_CLOSURE", packet.designSourceClosure],
      ["IMPLEMENTATION_SOURCE_MAP", packet.implementationSourceMap],
      ["PRODUCT_BUILD_PACKET", packet.packet], ["COMPILATION_REPORT", packet.compilationReport],
    ] as const) {
      artifactRefs[ref] = (await publisher.put(nativeJoinEnvelope(payload.schema, payload))).hash;
    }
    await index.activateProductPacket({ runId, packetHash: packet.packetHash, packet: packet.packet,
      compiler: packet.packet.compiler, artifactRefs });
    const reader = createRuntimeArtifactReader({ sql: database.sql, artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS });
    assert.deepEqual(await reader.readExactSealedPacket(runId), packet);
    const blocks = createV3PreparationBlockRepository(database.sql);
    const prepare = () => blocks.resolveReady({ runId, stepId: "implement", storyId: "US-001",
      packetHash: packet.packetHash, sourceSha: source.sourceBefore.sha, sourceTreeHash: source.sourceBefore.treeHash,
      dependencyState: [], projectedDependencyIds: [] });
    const prepared = await prepare();
    assert.ok(prepared.authority);
    const readiness = prepared.authority;
    const nativeAuthority = createV3PreparationClaimAuthorityV2({
      stateVersion: readiness.stateVersion, runId, stepId: "implement", storyId: "US-001",
      packetHash: packet.packetHash, compilationReportHash: packet.refs.compilationReport,
      baseRevision: source.sourceBefore, projectedDependencyIds: [], dependencyAttempts: [],
    });
    const input = {
      runId, stepDbId: admission.implementStepDbId, workflowStepId: "implement",
      storyDbId: admission.stories[0]!.id, storyId: "US-001", claimAgentId: "feature-dev_developer",
      callerGatewayAgent: "prism", parallelLimit: 1,
      runtimeIntent: { schema: "setfarm.runtime-claim-intent.v1" as const,
        sessionId: `RTS_native-join-${suffix}`, runtimeAgentId: "prism", runtimeKind: "openclaw_session" as const,
        ownerInstanceId: "native-join-test", sessionKey: `native-join:${suffix}` },
      preparationAuthority: readiness, nativePreparationAuthority: nativeAuthority,
      nativePreparationArtifacts: { artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS },
      storyAdmissionProof: admission.storyAdmissionProof,
    };
    return { database, ...source, runId, packet, reader, artifactRoot, store, blocks,
      readiness, nativeAuthority, input, prepare, admission };
  }

  async function countEffects(value: Awaited<ReturnType<typeof fixture>>) {
    const rows = await value.database.sql<Array<{ claims: number; attempts: number; bindings: number; runtimes: number }>>`
      SELECT
        (SELECT count(*)::integer FROM claim_log WHERE run_id = ${value.runId} AND step_id = 'implement') AS claims,
        (SELECT count(*)::integer FROM execution_attempts WHERE run_id = ${value.runId}) AS attempts,
        (SELECT count(*)::integer FROM v3_preparation_authority_claims_v2 b
          JOIN v3_preparation_authorities_v2 a USING (authority_hash) WHERE a.run_id = ${value.runId}) AS bindings,
        (SELECT count(*)::integer FROM runtime_sessions WHERE run_id = ${value.runId} AND workflow_step_id = 'implement') AS runtimes
    `;
    return { ...rows[0]! };
  }

  async function claim(value: Awaited<ReturnType<typeof fixture>>) {
    const publication = await publishLoopClaimRuntime(value.database.sql, value.input);
    assert.ok(publication);
    const native = await readV3PreparationAuthorityV2(value.database.sql, value.nativeAuthority.authorityHash);
    assert.deepEqual(native, value.nativeAuthority, "claim publication must persist native authority in its own transaction");
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 0, bindings: 1, runtimes: 1 });
    return publication;
  }

  // Break: keeping the old reader in the native join. The real legacy reader
  // remains a rejection control; the exact-reader preclaim must carry V2.
  it("exposes the genuine legacy reader wall and prepares through the exact native reader", async () => {
    const value = await fixture("reader");
    await assert.rejects(value.reader.readSealedPacket(value.runId), { code: "RUNTIME_ARTIFACT_TYPE_MISMATCH" });
    const result = await createV3NormalImplementationPreclaim({
      readPacket: runId => value.reader.readExactSealedPacket(runId), blockRepository: value.blocks,
      readPendingStories: async () => [{ id: value.input.storyDbId, run_id: value.runId, story_id: "US-001",
        story_index: 0, status: "pending", depends_on: "[]" }],
      readTerminalDependencyAttempts: async () => [],
    }).prepare({ runId: value.runId, stepId: "implement", repo: value.worktree, requestedBaseRef: "HEAD" });
    assert.equal(result.status, "ready", JSON.stringify(result));
    if (result.status !== "ready") assert.fail("native exact reader must reach readiness");
    assert.ok("nativeAuthority" in result, "exact reader must join paired native authority");
    assert.deepEqual(await countEffects(value), { claims: 0, attempts: 0, bindings: 0, runtimes: 0 });
  });

  it("publishes paired native claim authority and replays the same committed owner exactly", async () => {
    const value = await fixture("claim");
    const first = await claim(value);
    const replay = await publishLoopClaimRuntime(value.database.sql, value.input);
    assert.deepEqual(replay, first);
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 0, bindings: 1, runtimes: 1 });
    const { schema: _s, authorityVersion: _v, packetSchema: _p, authorityHash: _h, ...payload } = value.nativeAuthority;
    const forged = createV3PreparationClaimAuthorityV2({ ...payload, compilationReportHash: "f".repeat(64) });
    const crossedReplay = { ...value.input, nativePreparationAuthority: forged };
    await assert.rejects(publishLoopClaimRuntime(value.database.sql, crossedReplay));
  });

  for (const mismatch of ["run", "story", "base", "report", "state"] as const) {
    it(`rolls back claim and runtime for crossed native ${mismatch} authority`, async () => {
      const value = await fixture(`wrong-${mismatch}`);
      const { schema: _s, authorityVersion: _v, packetSchema: _p, authorityHash: _h, ...payload } = value.nativeAuthority;
      const nativePreparationAuthority = createV3PreparationClaimAuthorityV2({ ...payload,
        ...(mismatch === "run" ? { runId: "other-native-run" } : {}),
        ...(mismatch === "story" ? { storyId: "US-002" } : {}),
        ...(mismatch === "base" ? { baseRevision: { ...payload.baseRevision, sha: "a".repeat(40) } } : {}),
        ...(mismatch === "report" ? { compilationReportHash: "f".repeat(64) } : {}),
        ...(mismatch === "state" ? { stateVersion: payload.stateVersion + 1 } : {}),
      });
      const input = { ...value.input, nativePreparationAuthority };
      await assert.rejects(publishLoopClaimRuntime(value.database.sql, input));
      assert.deepEqual(await countEffects(value), { claims: 0, attempts: 0, bindings: 0, runtimes: 0 });
      assert.equal(await readV3PreparationAuthorityV2(value.database.sql, nativePreparationAuthority.authorityHash), undefined);
    });
  }

  it("keeps one exact paired owner under two competing claim publications", async () => {
    const value = await fixture("race");
    const competing = { ...value.input, runtimeIntent: { ...value.input.runtimeIntent, sessionId: "RTS_native-race-other" } };
    const results = await Promise.allSettled([
      publishLoopClaimRuntime(database.sql, value.input), publishLoopClaimRuntime(database.sql, competing),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled" && result.value).length, 1);
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 0, bindings: 1, runtimes: 1 });
  });

  it("refuses stale readiness without publishing a native authority", async () => {
    const value = await fixture("stale");
    await value.blocks.resolveReady({ runId: value.runId, stepId: "implement", storyId: "US-001",
      packetHash: value.packet.packetHash, sourceSha: value.sourceBefore.sha, sourceTreeHash: "a".repeat(40),
      dependencyState: [], projectedDependencyIds: [] });
    await assert.rejects(publishLoopClaimRuntime(database.sql, value.input));
    assert.deepEqual(await countEffects(value), { claims: 0, attempts: 0, bindings: 0, runtimes: 0 });
    assert.equal(await readV3PreparationAuthorityV2(database.sql, value.nativeAuthority.authorityHash), undefined);
  });

  it("refuses plausible two-story signatures without an authenticated accepted terminal producer", async () => {
    const value = await fixture("missing-terminal", true);
    const publication = await claim(value);
    const native = await service();
    const initial = await native.reserve(reserveInput(value, publication.claimId));
    const before = await countEffects(value);
    for (const attemptId of ["ATT_native-no-such-terminal-attempt", initial.attempt.attemptId]) {
      const preparationAuthority = createV3PreparationClaimAuthorityV1({ stateVersion: 1,
        runId: value.runId, stepId: "implement", storyId: "US-002", packetHash: value.packet.packetHash,
        baseRevision: value.sourceBefore, projectedDependencyIds: ["US-001"], dependencyAttempts: [{
          storyId: "US-001", attemptId, attemptClass: "product_implementation", disposition: "produced_delta",
          sourceRevision: value.sourceBefore,
        }] });
      const nativePreparationAuthority = createV3PreparationClaimAuthorityV2({ stateVersion: 1,
        runId: value.runId, stepId: "implement", storyId: "US-002", packetHash: value.packet.packetHash,
        compilationReportHash: value.packet.refs.compilationReport, baseRevision: value.sourceBefore,
        projectedDependencyIds: ["US-001"], dependencyAttempts: [{ storyId: "US-001", attemptId,
          attemptGeneration: initial.attempt.generation, attemptClass: "product_implementation", disposition: "produced_delta",
          sliceHash: initial.sliceHash, outputHash: "f".repeat(64), sourceAfter: value.sourceBefore,
          fileSignatures: [{ pathRef: "PATH_APP", path: "src/index.ts", presence: "present", contentHash: "e".repeat(64) }],
        }] });
      const input = { ...value.input, storyId: "US-002", storyDbId: value.admission.stories[1]!.id,
        preparationAuthority, nativePreparationAuthority,
        runtimeIntent: { ...value.input.runtimeIntent, sessionId: "RTS_native-unproven-dependency" } };
      await assert.rejects(publishLoopClaimRuntime(database.sql, input), { code: "V3_NATIVE_DEPENDENCY_OUTPUT_INVALID" });
      assert.deepEqual(await countEffects(value), before);
      assert.equal(await readV3PreparationAuthorityV2(database.sql, nativePreparationAuthority.authorityHash), undefined);
    }
  });

  async function service() {
    const module = await import("../../src/execution/v3-native-implementation-attempt.js");
    return module.createNativeV3ImplementationAttemptService({ sql: database.sql,
      artifactRoot: artifacts.artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS });
  }
  function reserveInput(value: Awaited<ReturnType<typeof fixture>>, claimId: number) {
    return { claimId, nativeAuthorityHash: value.nativeAuthority.authorityHash, runId: value.runId,
      stepId: "implement", storyId: "US-001", role: "developer", agentId: "feature-dev_developer",
      branch: "main", worktree: value.worktree };
  }

  it("reserves and reloads exact original native authority after edits with no dispatch plan", async () => {
    const value = await fixture("reserve");
    const publication = await claim(value);
    const native = await service();
    const input = reserveInput(value, publication.claimId);
    const result = await native.reserve(input);
    assert.equal(result.kind, "native-prepared");
    assert.equal(result.slice.schema, "setfarm.implementation-slice.v2");
    assert.equal(result.attempt.role, "developer");
    assert.equal(result.attempt.agentId, "feature-dev_developer");
    assert.equal("evidencePlan" in result, false);
    assert.equal("handoff" in result, false);
    assert.deepEqual(result.readiness, value.readiness);
    assert.deepEqual(result.nativeAuthority, value.nativeAuthority);
    assert.deepEqual(await native.reserve(input), result);
    const rows = await database.sql`
      SELECT attempt_id, claim_id::text, slice_hash FROM v3_preparation_authority_attempts_v2
       WHERE authority_hash = ${value.nativeAuthority.authorityHash}
    `;
    assert.deepEqual(rows.map(row => ({ ...row })), [{ attempt_id: result.attempt.attemptId,
      claim_id: String(publication.claimId), slice_hash: result.sliceHash }]);
    await writeFile(path.join(value.worktree, "src/index.ts"), "export const changedAfterPreparation = true;\n");
    const locator = { runId: value.runId, storyId: "US-001", attemptId: result.attempt.attemptId };
    assert.deepEqual(await native.loadPreparedAttempt(locator), result);
    assert.deepEqual(await native.reserve(input), result);
    await assert.rejects(native.loadPreparedAttempt({ ...locator, storyId: "US-002" }));
    await assert.rejects(native.loadPreparedAttempt({ ...locator, runId: "crossed-origin" }));
    const slicePath = value.store.pathFor(result.sliceHash);
    const original = await readFile(slicePath);
    try {
      await writeFile(slicePath, "{}\n");
      await assert.rejects(native.loadPreparedAttempt(locator));
    } finally { await writeFile(slicePath, original); }
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 1, bindings: 1, runtimes: 1 });
  });

  it("refuses noninitial roles, successor inputs, crossed agent/claim and changed source before reservation", async () => {
    const value = await fixture("reserve-refusal");
    const publication = await claim(value);
    const native = await service();
    const input = reserveInput(value, publication.claimId);
    for (const wrong of [{ role: "feature-dev_developer" }, { role: "supervisor" },
      { agentId: "someone-else" }, { claimId: publication.claimId + 1 }, { storyId: "US-002" },
      { attemptClass: "infrastructure_retry" }, { attemptClass: "supervisor_repair" },
      { recoveryDelivery: { dispatchId: "untrusted" } }]) {
      await assert.rejects(native.reserve({ ...input, ...wrong }));
    }
    await writeFile(path.join(value.worktree, "src/index.ts"), "source changed before reserve\n");
    await assert.rejects(native.reserve(input));
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 0, bindings: 1, runtimes: 1 });
  });

});
