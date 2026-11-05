import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { IndexedArtifactPublisher, bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { createRuntimeArtifactReader } from "../../src/product-compiler/runtime-artifact-reader.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { createV3PreparationBlockRepository } from "../../src/execution/v3-preparation-block-repository.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { readV3PreparationAuthorityV2 } from "../../src/execution/v3-preparation-authority-v2-repository.js";
import { createV3NormalImplementationPreclaim } from "../../src/execution/v3-normal-implementation-preclaim.js";
import { seedCanonicalCompilerStoryAdmissionFixture } from "./helpers/compiler-story-english-admission-fixture.js";
import { nativeJoinEnvelope, nativeJoinPacket, nativeJoinSourceFixture,
  NATIVE_JOIN_LIMITS, NATIVE_JOIN_PRODUCER } from "./helpers/native-implementation-join-fixture.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

// Every SQL operation below runs in the existing P3-owned isolated database.
// Packet bytes are real indexed CAS publications; no SQL response is mocked.
describe("inactive native implementation preparation join", { concurrency: 1 }, () => {
  const databases: TestDatabase[] = [];
  const roots: string[] = [];
  afterEach(async () => {
    for (const database of databases.splice(0)) await database.cleanup();
    for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  });

  async function fixture(suffix: string) {
    const database = await createIsolatedTestDatabase();
    databases.push(database);
    const source = await nativeJoinSourceFixture();
    roots.push(source.root);
    const runId = `run-native-join-${suffix}`;
    const packet = nativeJoinPacket(runId);
    const admission = await seedCanonicalCompilerStoryAdmissionFixture(database, {
      runId, releaseSha: NATIVE_JOIN_PRODUCER.codeSha, packetHash: packet.packetHash,
    });
    const artifactRoot = path.join(source.root, "artifacts");
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits: NATIVE_JOIN_LIMITS });
    const index = createArtifactIndex(database.sql);
    await bootstrapArtifactIndex({ index, store,
      quotaBytes: NATIVE_JOIN_LIMITS.rootQuotaBytes, maxPayloadBytes: NATIVE_JOIN_LIMITS.maxPayloadBytes });
    const publisher = new IndexedArtifactPublisher({ index, store, ownerInstanceId: "native-join-test" });
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
      storyAdmissionProof: admission.storyAdmissionProof,
    };
    return { database, ...source, runId, packet, reader, artifactRoot, store, blocks,
      readiness, nativeAuthority, input, prepare };
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

});
