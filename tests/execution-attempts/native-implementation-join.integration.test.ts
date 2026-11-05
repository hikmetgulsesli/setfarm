import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, realpath, rm, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it, mock } from "node:test";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { IndexedArtifactPublisher, bootstrapArtifactIndex } from "../../src/product-compiler/indexed-artifact-publisher.js";
import { createRuntimeArtifactReader } from "../../src/product-compiler/runtime-artifact-reader.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { createV3PreparationBlockRepository } from "../../src/execution/v3-preparation-block-repository.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { createV3PreparationClaimAuthorityV1 } from "../../src/execution/v3-preparation-claim-authority.js";
import { readV3PreparationAuthorityV2 } from "../../src/execution/v3-preparation-authority-v2-repository.js";
import { createV3NormalImplementationPreclaim } from "../../src/execution/v3-normal-implementation-preclaim.js";
import { createV3ImplementationContext, V3ImplementationClaimHandoffSchema } from "../../src/execution/v3-implementation-handoff.js";
import type { V3ImplementationAttemptResult } from "../../src/execution/v3-implementation-attempt.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1 } from "../../src/execution/v3-predecessor-completion-claim-barrier-v1.js";
import { createV3ImplementationAttemptV2Assembler } from "../../src/execution/v3-implementation-attempt-v2.js";
import { loadCompilerStoryEnglishAdmissionLedgerAuthorityV1, createCompilerStoryEnglishAdmissionClaimProofV1 } from "../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { seedCanonicalCompilerStoryAdmissionFixture } from "./helpers/compiler-story-english-admission-fixture.js";
import { nativeJoinEnvelope, nativeJoinPacket, nativeJoinSourceFixture,
  NATIVE_JOIN_CLI_SOURCE, NATIVE_JOIN_API_SOURCE, NATIVE_JOIN_LIMITS, NATIVE_JOIN_PRODUCER } from "./helpers/native-implementation-join-fixture.js";
import { NODE_CLI_TASK, NODE_EXPRESS_API_TASK } from "../product-compiler/fixtures/no-design-product-semantics-v2.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

// Every SQL operation below runs in the existing P3-owned isolated database.
// Packet bytes are real indexed CAS publications; no SQL response is mocked.
describe("inactive native implementation preparation join", { concurrency: 1 }, () => {
  let database: TestDatabase;
  let artifacts: { artifactRoot: string; store: ContentAddressedArtifactStore; publisher: IndexedArtifactPublisher };
  let productionDb: typeof import("../../src/db-pg.js") | undefined;
  let ownedAgentWorkspace: string;
  let ownedHostConfigRoot: string;
  let restoreFixtureHome: (() => void) | undefined;
  const previousEnvironment = {
    SETFARM_PG_URL: process.env.SETFARM_PG_URL,
    SETFARM_DB_PATH: process.env.SETFARM_DB_PATH,
    SETFARM_PRODUCT_ARTIFACT_DIR: process.env.SETFARM_PRODUCT_ARTIFACT_DIR,
    SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES: process.env.SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES,
    SETFARM_ARTIFACT_ROOT_QUOTA_BYTES: process.env.SETFARM_ARTIFACT_ROOT_QUOTA_BYTES,
    SETFARM_ARTIFACT_MIN_FREE_BYTES: process.env.SETFARM_ARTIFACT_MIN_FREE_BYTES,
  };
  const roots: string[] = [];
  before(async () => {
    database = await createIsolatedTestDatabase();
    const source = await nativeJoinSourceFixture();
    roots.push(source.root);
    // Host configuration is test data. Keep the real resolver and every
    // ownership/cleanup guard; redirect only node:os's home lookup for this
    // serial suite. Never change HOME or write the actual OpenClaw config.
    ownedHostConfigRoot = await realpath(source.root);
    const fixtureHome = path.join(ownedHostConfigRoot, "fixture-home");
    ownedAgentWorkspace = path.join(fixtureHome, ".openclaw", "agents", "developer");
    await mkdir(ownedAgentWorkspace, { recursive: true });
    await writeFile(path.join(fixtureHome, ".openclaw", "openclaw.json"), JSON.stringify({
      agents: { list: [{ id: "feature-dev_developer", workspace: ownedAgentWorkspace }] },
    }) + "\n");
    const fixtureHomeLookup = mock.method(os, "homedir", () => fixtureHome);
    restoreFixtureHome = () => fixtureHomeLookup.mock.restore();
    const { getAgentWorkspacePath } = await import("../../src/installer/worktree-ops.js");
    assert.equal(getAgentWorkspacePath("feature-dev_developer"), ownedAgentWorkspace,
      "actual agent resolver must select the owned fixture config before any caller runs");
    const artifactRoot = path.join(source.root, "artifacts");
    process.env.SETFARM_DB_PATH = path.join(source.root, "runtime", "setfarm.db");
    process.env.SETFARM_PRODUCT_ARTIFACT_DIR = artifactRoot;
    process.env.SETFARM_ARTIFACT_MAX_PAYLOAD_BYTES = String(NATIVE_JOIN_LIMITS.maxPayloadBytes);
    process.env.SETFARM_ARTIFACT_ROOT_QUOTA_BYTES = String(NATIVE_JOIN_LIMITS.rootQuotaBytes);
    process.env.SETFARM_ARTIFACT_MIN_FREE_BYTES = String(NATIVE_JOIN_LIMITS.minFreeBytes);
    productionDb = await import("../../src/db-pg.js");
    productionDb.pgConfigureIsolatedTestDatabase(database.url);
    const store = new ContentAddressedArtifactStore(artifactRoot, { limits: NATIVE_JOIN_LIMITS });
    const index = createArtifactIndex(database.sql);
    await bootstrapArtifactIndex({ index, store,
      quotaBytes: NATIVE_JOIN_LIMITS.rootQuotaBytes, maxPayloadBytes: NATIVE_JOIN_LIMITS.maxPayloadBytes });
    artifacts = { artifactRoot, store, publisher: new IndexedArtifactPublisher({ index, store, ownerInstanceId: "native-join-test" }) };
  });
  after(async () => {
    try { await productionDb?.pgClose(); }
    finally {
      try { await database?.cleanup(); }
      finally {
        try {
          for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
        } finally {
          restoreFixtureHome?.();
          for (const [key, value] of Object.entries(previousEnvironment)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
          }
        }
      }
    }
  });

  async function fixture(suffix: string, twoStories = false, runnableCli = false, lifecycle = false) {
    const source = await nativeJoinSourceFixture(runnableCli, twoStories && lifecycle, lifecycle);
    roots.push(source.root);
    const runId = `run-native-join-${suffix}`;
    const packet = nativeJoinPacket(runId, twoStories, runnableCli, twoStories && lifecycle);
    const admission = await seedCanonicalCompilerStoryAdmissionFixture(database, {
      runId, releaseSha: NATIVE_JOIN_PRODUCER.codeSha, packetHash: packet.packetHash,
      productSpec: packet.productSpec, repo: source.repo,
      task: twoStories ? NODE_EXPRESS_API_TASK : NODE_CLI_TASK,
    });
    if (runnableCli || lifecycle) {
      const rows = await database.sql<Array<{ context: string }>>`SELECT context FROM runs WHERE id = ${runId}`;
      assert.equal(rows.length, 1);
      const admittedContext: unknown = JSON.parse(rows[0]!.context);
      assert.ok(admittedContext && typeof admittedContext === "object" && !Array.isArray(admittedContext));
      assert.ok(Object.values(admittedContext).every(value => typeof value === "string"));
      // Keep the parameter text-typed. An explicitly jsonb-typed string is
      // JSON-encoded by postgres.js and object || string becomes an array.
      const context = JSON.stringify({
        ...admittedContext,
        repo: source.repo, branch: "main", implement_base_commit: source.sourceBefore.sha,
        stack_pack_id: runnableCli ? "node-cli" : "node-express-api", tech_stack: "node",
        ...(lifecycle ? { story_workdir: source.worktree, story_branch: source.branch } : {}),
      });
      await database.sql`UPDATE runs SET context = ${context} WHERE id = ${runId}`;
      await database.sql`UPDATE steps SET loop_config = '{"over":"stories","mergeStrategy":"direct-merge"}',
        input_template = 'Implement the exact sealed story.' WHERE id = ${admission.implementStepDbId}`;
      const authenticAdmission = await loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(database.sql, { runId });
      assert.deepEqual(createCompilerStoryEnglishAdmissionClaimProofV1(authenticAdmission), admission.storyAdmissionProof,
        "the actual task/product/repo must still reproduce its genuine admission before testing the caller");
      assert.equal(admission.stories.length, packet.storyPlan.stories.length);
      assert.deepEqual(admission.stories.map(story => story.storyId), packet.storyPlan.stories.map(story => story.id));
    }
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
      // A prior scenario legitimately keeps its owner active. Gateway ownership
      // is exclusive across active runs, so each scenario needs its own persona.
      callerGatewayAgent: `native-join-${suffix}`, parallelLimit: 1,
      runtimeIntent: { schema: "setfarm.runtime-claim-intent.v1" as const,
        sessionId: `RTS_native-join-${suffix}`, runtimeAgentId: `native-join-${suffix}`,
        ...(lifecycle ? { runtimeKind: "local_process" as const }
          : { runtimeKind: "openclaw_session" as const, sessionKey: `native-join:${suffix}` }),
        ownerInstanceId: "native-join-test" },
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
    assert.ok(publication, publication ? undefined : JSON.stringify(await publicationDiagnostics(value)));
    const native = await readV3PreparationAuthorityV2(value.database.sql, value.nativeAuthority.authorityHash);
    assert.deepEqual(native, value.nativeAuthority, "claim publication must persist native authority in its own transaction");
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 0, bindings: 1, runtimes: 1 });
    return publication;
  }

  async function publicationDiagnostics(value: Awaited<ReturnType<typeof fixture>>) {
    const runs = await database.sql`
      SELECT id,status,assigned_developer FROM runs
       WHERE id=${value.runId} OR (assigned_developer=${value.input.callerGatewayAgent}
         AND status IN ('running','resuming','cancelling','failing')) ORDER BY id
    `;
    const stories = await database.sql`
      SELECT id,story_id,status,claim_generation FROM stories WHERE run_id=${value.runId} ORDER BY story_index
    `;
    const steps = await database.sql`
      SELECT id,step_id,status,agent_id,type,loop_config,current_story_id,step_index FROM steps WHERE run_id=${value.runId} ORDER BY step_id
    `;
    const runtimes = await database.sql`
      SELECT session_id,workflow_step_id,story_id,state,claim_id FROM runtime_sessions WHERE run_id=${value.runId}
    `;
    const completions = await database.sql`SELECT request_id,workflow_step_id,state,apply_phase
      FROM runtime_completion_requests WHERE run_id=${value.runId} ORDER BY workflow_step_id`;
    return { callerGatewayAgent: value.input.callerGatewayAgent, runs, stories, steps, runtimes, completions };
  }

  // Break: the actual normal caller still selects the legacy packet reader,
  // drops ready.nativeAuthority and passes agentId as the execution role. This
  // invokes real claimStep; no prebuilt dispatch/handoff or SQL result is mocked.
  it("native Task11 actual claimStep publishes the native ready authority and complete model context", async () => {
    const value = await fixture("task11-caller", false, true);
    const agentId = `feature-dev_native-task11-${path.basename(value.root)}`;
    await database.sql`UPDATE steps SET agent_id = ${agentId} WHERE id = ${value.admission.implementStepDbId}`;
    const { getAgentWorkspacePath } = await import("../../src/installer/worktree-ops.js");
    assert.equal(getAgentWorkspacePath(agentId), null, "fixture agent must use only its owned repo/.worktrees path");
    const independentlyPrepared = await createV3ImplementationAttemptV2Assembler({
      readPacket: runId => value.reader.readExactSealedPacket(runId),
    }).assemble({ runId: value.runId, stepId: "implement", storyId: "US-001",
      worktree: value.worktree, preparationAuthority: value.nativeAuthority });
    assert.equal(independentlyPrepared.slice.schema, "setfarm.implementation-slice.v2");
    assert.equal(independentlyPrepared.slice.files[0]!.contentHash,
      createHash("sha256").update(NATIVE_JOIN_CLI_SOURCE).digest("hex"));
    assert.deepEqual(await countEffects(value), { claims: 0, attempts: 0, bindings: 0, runtimes: 0 });

    const { claimStep } = await import("../../src/installer/step-ops.js");
    assert.ok(productionDb);
    const selected = await productionDb.pgQuery(`SELECT current_database() AS database_name,
      s.id,s.agent_id,s.status,s.type,s.loop_config,r.status AS run_status,
      ${V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1} AS predecessor_blocked,
      EXISTS (SELECT 1 FROM steps prev WHERE prev.run_id=s.run_id AND prev.step_index<s.step_index
        AND prev.status NOT IN ('done','failed','skipped','verified')) AS predecessor_unfinished
      FROM steps s JOIN runs r ON r.id=s.run_id WHERE s.id=$1 AND s.agent_id=$2`,
    [value.admission.implementStepDbId, agentId]);
    assert.equal(selected.length, 1, JSON.stringify({ selected, fixture: await publicationDiagnostics(value) }));
    assert.equal(selected[0]!.database_name, database.database, "actual caller and admission fixture must use the same owned database");
    assert.equal(selected[0]!.predecessor_blocked, false, JSON.stringify(selected));
    assert.equal(selected[0]!.predecessor_unfinished, false, JSON.stringify(selected));
    assert.deepEqual(JSON.parse(selected[0]!.loop_config), { over: "stories", mergeStrategy: "direct-merge" });
    const claimed = await claimStep(agentId, value.input.callerGatewayAgent, value.input.runtimeIntent);
    const blocks = await database.sql`SELECT phase,error_code,detail FROM v3_preparation_blocks WHERE run_id=${value.runId}`;
    assert.equal(claimed.found, true, JSON.stringify({ claim: claimed, blocks, effects: await countEffects(value),
      selected, admission: await publicationDiagnostics(value) }));
    assert.equal(claimed.runId, value.runId);
    assert.equal(claimed.storyId, "US-001");
    assert.equal(claimed.claimAgentId, agentId);
    assert.equal(claimed.runtimeSessionId, value.input.runtimeIntent.sessionId);
    assert.ok(claimed.attempt && claimed.claimId && claimed.v3ImplementationHandoff);
    const handoff = V3ImplementationClaimHandoffSchema.parse(claimed.v3ImplementationHandoff);
    assert.equal(handoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    if (handoff.schema !== "setfarm.v3-implementation-claim-handoff.v2") assert.fail("actual caller must deliver strict native handoff");
    assert.deepEqual(handoff.executionAuthority, { role: "developer", attemptClass: "product_implementation" });
    assert.deepEqual(handoff.nativeAuthority, value.nativeAuthority);
    assert.equal(handoff.sliceHash, independentlyPrepared.sliceHash);
    assert.deepEqual(handoff.packetEnvelope, nativeJoinEnvelope(value.packet.packet.schema, value.packet.packet));
    assert.deepEqual(handoff.compilationReportEnvelope, nativeJoinEnvelope(value.packet.compilationReport.schema, value.packet.compilationReport));
    const context = createV3ImplementationContext({ handoff });
    assert.equal(context.schema, "setfarm.implementation-context.v3");
    assert.deepEqual(context.writeAuthority, { mode: "initial", allowedPaths: ["src/index.ts"] });
    const owner = await database.sql`SELECT role,agent_id FROM execution_attempts WHERE attempt_id=${claimed.attempt.attemptId}`;
    assert.deepEqual(owner.map(row => ({ ...row })), [{ role: "developer", agent_id: agentId }]);
    const binding = await database.sql`SELECT claim_id::text,attempt_id,slice_hash FROM v3_preparation_authority_attempts_v2
      WHERE authority_hash=${value.nativeAuthority.authorityHash}`;
    assert.deepEqual(binding.map(row => ({ ...row })), [{ claim_id: String(claimed.claimId),
      attempt_id: claimed.attempt.attemptId, slice_hash: handoff.sliceHash }]);
    const publishedPlan = await value.store.get(handoff.evidencePlanArtifactHash);
    assert.deepEqual(publishedPlan.envelope, nativeJoinEnvelope("setfarm.evidence-plan.v2", handoff.evidencePlan));
    const replay = await claimStep(agentId, value.input.callerGatewayAgent, value.input.runtimeIntent);
    assert.equal(replay.claimId, claimed.claimId);
    assert.deepEqual(replay.attempt, claimed.attempt);
    assert.deepEqual(replay.v3ImplementationHandoff, claimed.v3ImplementationHandoff);
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 1, bindings: 1, runtimes: 1 });
  });

  // Break: upgrading genuine prepared authority through the actual default
  // facade still calls readSealedPacket/compileEvidencePlanV1; completion also
  // reconstructs V1. The fixture supplies no plan or context to the facade.
  it("native Task11 default reserve and completion reload genuine native context after source edits", async () => {
    const value = await fixture("task11-context", false, true);
    const publication = await claim(value);
    const native = await service();
    const initial = await native.reserve(reserveInput(value, publication.claimId));
    assert.equal(initial.kind, "native-prepared");
    assert.equal("evidencePlan" in initial, false);
    assert.equal("handoff" in initial, false);
    const { reserveV3ImplementationAttempt, loadV3ImplementationAttemptContext,
      createV3ImplementationAttemptHandoffV1 } = await import("../../src/execution/v3-implementation-attempt.js");
    const compiled = await reserveV3ImplementationAttempt({ runId: value.runId, stepId: "implement", storyId: "US-001",
      claimId: publication.claimId, role: "developer", agentId: value.input.claimAgentId, branch: "main", worktree: value.worktree });
    assert.equal(compiled.attempt.attemptId, initial.attempt.attemptId, "preparation upgrade must reuse its genuine initial owner");
    assert.equal(compiled.sliceHash, initial.sliceHash);
    assert.equal(compiled.evidencePlan.schema, "setfarm.evidence-plan.v2");
    assert.deepEqual(compiled.evidencePlan.commands.map(command => ({ kind: command.kind, argv: command.argv })),
      [{ kind: "build", argv: ["npm", "run", "build"] }]);
    assert.deepEqual(compiled.sourceBefore, value.sourceBefore);
    const planRef = await database.sql`SELECT artifact_hash FROM run_artifact_refs WHERE run_id=${value.runId}
      AND ref_key=${compiled.evidencePlanRefKey}`;
    assert.deepEqual(planRef.map(row => row.artifact_hash), [compiled.evidencePlanArtifactHash]);
    const storedPlan = await value.store.get(compiled.evidencePlanArtifactHash);
    assert.deepEqual(storedPlan.envelope, nativeJoinEnvelope("setfarm.evidence-plan.v2", compiled.evidencePlan));
    await createRuntimeSessionRepository(database.sql).bindAttempt({ sessionId: value.input.runtimeIntent.sessionId,
      attemptId: initial.attempt.attemptId, ownerInstanceId: value.input.runtimeIntent.ownerInstanceId });
    const handoff = V3ImplementationClaimHandoffSchema.parse(createV3ImplementationAttemptHandoffV1({
      stepDbId: value.admission.implementStepDbId, storyDbId: value.input.storyDbId, claimId: publication.claimId,
      branch: "main", workdir: value.worktree, compiled,
    }));
    assert.equal(handoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    const context = createV3ImplementationContext({ handoff });
    await writeFile(path.join(value.worktree, "src/index.ts"), NATIVE_JOIN_CLI_SOURCE + "// scoped implementation candidate\n");
    const locator = { runId: value.runId, storyId: "US-001", attemptId: initial.attempt.attemptId };
    assert.deepEqual(await loadV3ImplementationAttemptContext(locator), compiled,
      "readback must reproduce immutable original native witnesses after allowed worker edits");
    const envelope = ClaimEnvelopeV1Schema.parse({ schema: "setfarm.claim-envelope.v1", protocol: "v3",
      issuedAt: new Date().toISOString(), runId: value.runId, stepId: value.admission.implementStepDbId,
      workflowStepId: "implement", storyId: "US-001", storyDbId: value.input.storyDbId,
      claimId: publication.claimId, claimGeneration: publication.claimGeneration,
      claimAgentId: value.input.claimAgentId, runtimeAgentId: value.input.runtimeIntent.runtimeAgentId,
      workdir: value.worktree, repo: value.worktree, attempt: { attemptId: initial.attempt.attemptId,
        generation: initial.attempt.generation, fenceToken: initial.attempt.fenceToken } });
    const rawProposal = JSON.stringify({ schema: "setfarm.v3-implementation-agent-proposal.v1", disposition: "ready_for_evidence",
      handoffHash: context.handoffHash, attemptId: initial.attempt.attemptId, packetHash: value.packet.packetHash,
      sliceHash: initial.sliceHash, sourceBefore: value.sourceBefore, summary: "Scoped native source candidate",
      changes: [{ path: "src/index.ts", summary: "Implement the exact CLI contract" }] });
    const { compileV3ImplementationCompletionProposal } = await import("../../src/execution/v3-implementation-completion.js");
    const completion = await compileV3ImplementationCompletionProposal({ sql: database.sql, envelope, rawProposal });
    const output = JSON.parse(completion.output);
    assert.equal(output.attemptId, initial.attempt.attemptId);
    assert.equal(output.sliceHash, initial.sliceHash);
    assert.equal(output.handoffHash, context.handoffHash);
    assert.equal(output.disposition, "ready_for_evidence");
    assert.deepEqual(output.sourceBefore, value.sourceBefore);
    assert.equal(completion.submissionEvidence.canonicalOutputHash,
      createHash("sha256").update(completion.output).digest("hex"));
    assert.equal(completion.sourceProposal, rawProposal);
    await assert.rejects(compileV3ImplementationCompletionProposal({ sql: database.sql,
      envelope: { ...envelope, attempt: { ...envelope.attempt!, generation: initial.attempt.generation + 1 } }, rawProposal }),
    /CLAIM_AUTHORITY/);
    const requests = await database.sql`SELECT request_id FROM runtime_completion_requests
      WHERE run_id=${value.runId} AND step_db_id=${value.admission.implementStepDbId}`;
    assert.equal(requests.length, 0, "compiler qualification alone must not manufacture accepted completion rows");
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 1, bindings: 1, runtimes: 1 });
  });

  // These are SQL/candidate/evidence probes with genuinely never-started local
  // sessions. Any production refusal fails the test; no started worker, selected
  // original, journal closure or accepted row is manufactured here.
  async function completeNeverStartedNativeCandidate(
    value: Awaited<ReturnType<typeof fixture>>, candidate: string,
  ) {
    const publication = await claim(value);
    const { reserveV3ImplementationAttempt, createV3ImplementationAttemptHandoffV1 } =
      await import("../../src/execution/v3-implementation-attempt.js");
    const compiled = await reserveV3ImplementationAttempt({ runId: value.runId, stepId: "implement",
      storyId: "US-001", claimId: publication.claimId, role: "developer", agentId: value.input.claimAgentId,
      branch: value.branch, worktree: value.worktree });
    const sessions = createRuntimeSessionRepository(database.sql);
    const sessionId = value.input.runtimeIntent.sessionId;
    const ownerInstanceId = value.input.runtimeIntent.ownerInstanceId;
    await sessions.bindAttempt({ sessionId, ownerInstanceId, attemptId: compiled.attempt.attemptId });
    const handoff = V3ImplementationClaimHandoffSchema.parse(createV3ImplementationAttemptHandoffV1({
      stepDbId: value.admission.implementStepDbId, storyDbId: value.input.storyDbId,
      claimId: publication.claimId, branch: value.branch, workdir: value.worktree, compiled,
    }));
    const envelope = ClaimEnvelopeV1Schema.parse({ schema: "setfarm.claim-envelope.v1", protocol: "v3",
      issuedAt: new Date().toISOString(), runId: value.runId, stepId: value.admission.implementStepDbId,
      workflowStepId: "implement", storyId: "US-001", storyDbId: value.input.storyDbId,
      claimId: publication.claimId, claimGeneration: publication.claimGeneration,
      claimAgentId: value.input.claimAgentId, runtimeAgentId: value.input.runtimeIntent.runtimeAgentId,
      workdir: value.worktree, repo: value.repo, attempt: { attemptId: compiled.attempt.attemptId,
        generation: compiled.attempt.generation, fenceToken: compiled.attempt.fenceToken } });
    return completeNeverStartedNativeSession(value, { compiled, handoff, envelope, sessionId, ownerInstanceId }, candidate);
  }

  // Continue either an actual initial publication or claimStep's actual recovery
  // session. No second publication, fabricated runtime or selected original.
  async function completeNeverStartedNativeSession(value: Awaited<ReturnType<typeof fixture>>, input: Readonly<{
    compiled: V3ImplementationAttemptResult;
    handoff: ReturnType<typeof V3ImplementationClaimHandoffSchema.parse>;
    envelope: ReturnType<typeof ClaimEnvelopeV1Schema.parse>;
    sessionId: string; ownerInstanceId: string;
  }>, candidate: string) {
    const { compiled, handoff, envelope, sessionId, ownerInstanceId } = input;
    const sessions = createRuntimeSessionRepository(database.sql);
    const context = createV3ImplementationContext({ handoff });
    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    await writeFile(path.join(envelope.workdir, "src/index.ts"), candidate);
    assert.deepEqual(await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001",
      attemptId: compiled.attempt.attemptId }), compiled,
      "actual after-edit reload must reproduce immutable original/current recovery authority");
    const proposal = { schema: "setfarm.v3-implementation-agent-proposal.v1",
      disposition: "ready_for_evidence", handoffHash: context.handoffHash,
      attemptId: compiled.attempt.attemptId, packetHash: value.packet.packetHash,
      sliceHash: compiled.sliceHash, sourceBefore: compiled.sourceBefore,
      summary: "Native owned candidate probe; no selected worker was started",
      changes: [{ path: "src/index.ts", summary: "Scoped product implementation candidate" }] };
    if (compiled.recovery) {
      const { compileV3ImplementationAgentOutputV1 } = await import("../../src/execution/v3-implementation-output.js");
      const effects = await countEffects(value);
      assert.throws(() => compileV3ImplementationAgentOutputV1(JSON.stringify({ ...proposal,
        changes: [{ path: "package.json", summary: "Unrelated dependency edit is outside durable repair grant" }] }), context),
      /V3_IMPLEMENTATION_OUTPUT_CHANGE_OUTSIDE_AUTHORITY/);
      assert.deepEqual(await countEffects(value), effects);
    }
    const output = JSON.stringify(proposal);
    const { requestRuntimeCompletion, createRuntimeCompletionRepository } =
      await import("../../src/execution/runtime-completion.js");
    const before = await countEffects(value);
    await assert.rejects(requestRuntimeCompletion(database.sql, { envelope: {
      ...envelope, attempt: { ...envelope.attempt!, generation: compiled.attempt.generation + 1 },
    }, output }), /CLAIM_AUTHORITY/);
    assert.deepEqual(await countEffects(value), before);
    const reserved = await sessions.findById(sessionId);
    assert.ok(reserved);
    assert.equal(reserved.state, "reserved");
    assert.equal(reserved.runtimeKind, "local_process");
    for (const key of ["pid", "runtimePath", "startedAt", "sessionKey"] as const) assert.equal(reserved[key], undefined);
    assert.deepEqual(reserved.drainEvidence, {});
    const { readClosedSelectedSubscriptionCodingRuntimeV1 } =
      await import("../../src/execution/subscription-coding-runtime-selected-v1.js");
    assert.throws(() => readClosedSelectedSubscriptionCodingRuntimeV1(sessionId), /SUBSCRIPTION/,
      "a never-started SQL probe cannot possess selected physical closure");
    const requested = await requestRuntimeCompletion(database.sql, { envelope, output });
    assert.equal(requested.status, "requested");
    if (requested.status !== "requested") assert.fail("canonical request must be created by its real producer");
    const completions = createRuntimeCompletionRepository(database.sql);
    const requestId = requested.request.requestId;
    const draining = await completions.claim({ requestId, ownerInstanceId });
    assert.equal(draining?.state, "draining");
    const requestedDrain = await sessions.findById(sessionId);
    assert.ok(requestedDrain);
    assert.equal(requestedDrain.state, "drain_requested");
    for (const key of ["pid", "runtimePath", "startedAt", "sessionKey"] as const) assert.equal(requestedDrain[key], undefined);
    assert.deepEqual(requestedDrain.drainEvidence, {});
    await sessions.markDrained({ sessionId, ownerInstanceId, evidence: {
      schema: "setfarm.runtime-drain-evidence.v1", observedAt: new Date().toISOString(),
      localProcessAbsent: true, openClawTaskAbsent: true, workspaceProcessAbsent: true,
      stableObservations: 2, evidenceRefs: [`setfarm://runtime-session/${sessionId}/never-started-reserved-observations`],
    } });
    const processing = await completions.markProcessing({ requestId, ownerInstanceId });
    assert.ok(processing.leaseExpiresAt);
    const { runWithRuntimeCompletionOwner } = await import("../../src/execution/runtime-completion-owner-context.js");
    const { completeStep, reconcileRuntimeCompletionEffects, resumeRuntimeCompletionEffects } =
      await import("../../src/installer/step-ops.js");
    const { runRuntimeCompletionEffectLedger } = await import("../../src/execution/runtime-completion-effect-runner.js");
    const { createRuntimeCompletionEffectRepository } = await import("../../src/execution/runtime-completion-effect-repository.js");
    const { createPostgresV3RecoveryEffectHandler } = await import("../../src/recovery/v3-recovery-effect.js");
    const { executeV3RecoveryRuntimeCompletionEffect } = await import("../../src/spawner.js");
    const capability = { requestId, ownerInstanceId, leaseExpiresAt: processing.leaseExpiresAt,
      ownerAttemptCount: processing.ownerAttemptCount };
    const continuation = { protocol: envelope.protocol, claimId: envelope.claimId,
      runtimeSessionId: sessionId, runId: value.runId, stepDbId: envelope.stepId,
      workflowStepId: envelope.workflowStepId, storyDbId: envelope.storyDbId,
      storyId: envelope.storyId, output: processing.output };
    await runWithRuntimeCompletionOwner(capability, () => completeStep(envelope.stepId, processing.output,
      envelope, { deferContinuationToEffectLedger: true }));
    const candidateRows = await database.sql<Array<{ source_after_sha: string; source_after_tree_hash: string }>>`
      SELECT source_after_sha,source_after_tree_hash FROM execution_attempts WHERE attempt_id=${compiled.attempt.attemptId}`;
    assert.equal(candidateRows.length, 1);
    const candidateSource = candidateRows[0]!;
    assert.match(candidateSource.source_after_sha, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
    const candidateTree = execFileSync("git", ["--no-replace-objects", "rev-parse", "--verify", "--end-of-options",
      `${candidateSource.source_after_sha}^{tree}`], { cwd: value.repo, encoding: "utf8", stdio: "pipe" }).trim();
    assert.equal(candidateSource.source_after_tree_hash, candidateTree,
      "owned native candidate must persist the exact committed Git root tree before continuation cleanup");
    assert.equal(await completions.heartbeatProcessing({ requestId, ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount }), true);
    const result = await runWithRuntimeCompletionOwner(capability, () => runRuntimeCompletionEffectLedger({
      requestId, ownerInstanceId, repository: createRuntimeCompletionEffectRepository(database.sql),
      handler: {
        reconcile: async ({ effect, input }) => {
          if (effect.effectType === "v3.recovery.coordinate") return undefined;
          const reconciled = await reconcileRuntimeCompletionEffects({ ...continuation, completionPlan: input.plan });
          return reconciled ? { resolution: "reconciled", result: reconciled.result, evidence: reconciled.evidence } : undefined;
        },
        apply: async ({ effect, input, assertLease }) => {
          if (effect.effectType === "v3.recovery.coordinate") return executeV3RecoveryRuntimeCompletionEffect({
            completionRequestId: requestId, effectKey: effect.effectKey, planHash: input.planHash, assertLease,
            coordinate: () => createPostgresV3RecoveryEffectHandler(database.sql).coordinate(input.effect),
            resumeCanonicalContinuation: () => resumeRuntimeCompletionEffects({ ...continuation, completionPlan: input.plan }),
          });
          await assertLease();
          const applied = await resumeRuntimeCompletionEffects({ ...continuation, completionPlan: input.plan });
          await assertLease();
          return { resolution: "applied", result: applied, evidence: {
            schema: "setfarm.runtime-completion-effect-evidence.v1", source: "canonical-continuation-handler",
            completionRequestId: requestId, effectKey: effect.effectKey, planHash: input.planHash,
          } };
        },
      },
    }));
    await completions.markEffectsCommitted({ requestId, ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount, result });
    const accepted = await completions.acceptAndRelease({ requestId, ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount, result });
    assert.equal(accepted.state, "accepted");
    assert.equal((await sessions.findById(sessionId))?.state, "released");
    assert.throws(() => readClosedSelectedSubscriptionCodingRuntimeV1(sessionId), /SUBSCRIPTION/);
    const replay = await requestRuntimeCompletion(database.sql, { envelope, output });
    assert.notEqual(replay.status, "direct");
    if (replay.status === "direct") assert.fail("native completion replay must remain durable");
    assert.equal(replay.request.requestId, requestId);
    return { compiled, envelope, accepted, result, candidateSource };
  }

  it("native Task11 owned failed candidate creates genuine delivery before the native successor boundary", async () => {
    const value = await fixture("task11-owned-repair", false, true, true);
    const completed = await completeNeverStartedNativeCandidate(value, "const brokenProduct = ;\n");
    const { createRecoveryDeliveryRepository } = await import("../../src/recovery/recovery-delivery-repository.js");
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const delivery = await deliveries.findActiveForStory({ runId: value.runId, storyId: "US-001" });
    assert.ok(delivery, JSON.stringify(completed.result));
    const dispatch = await deliveries.findDispatch(delivery.dispatchId);
    assert.ok(dispatch);
    const revision = await deliveries.findRevision(dispatch.revisionId);
    assert.ok(revision);
    assert.equal(dispatch.dispatchClass, "product_implementation");
    assert.equal(revision.expectedDelta.kind, "source_change");
    assert.deepEqual(revision.allowedPaths, ["src/index.ts"]);
    const { createFindingRecoveryRepository } = await import("../../src/recovery/finding-recovery-repository.js");
    const findings = await createFindingRecoveryRepository(database.sql).findFindingSet(dispatch.findingSetHash);
    assert.ok(findings);
    assert.equal(findings.runId, value.runId);
    assert.equal(findings.sliceHash, completed.compiled.sliceHash);
    assert.ok(findings.findings.length > 0);
    const { createV3RecoveryClaimAuthority } = await import("../../src/recovery/v3-recovery-claim-authority.js");
    const recoveryClaims = createV3RecoveryClaimAuthority(database.sql);
    const expiredHandoff = await recoveryClaims.acquireRecoveryClaim({ runId: value.runId, storyId: "US-001",
      ownerInstanceId: "native-task11-expired-repair-owner", leaseMs: 20 });
    assert.equal(expiredHandoff.status, "lease_acquired");
    assert.equal(expiredHandoff.dispatchId, dispatch.dispatchId);
    assert.equal(expiredHandoff.revisionId, revision.revisionId);
    const lease = expiredHandoff.lease;
    // Real database-clock expiry; no timestamps or lease rows are overwritten.
    await new Promise(resolve => setTimeout(resolve, Math.max(30, Date.parse(lease.expiresAt) - Date.now() + 30)));
    const expiry = await database.sql<Array<{ expired: boolean }>>`
      SELECT lease_expires_at <= clock_timestamp() AS expired FROM recovery_dispatch_deliveries
      WHERE dispatch_id=${dispatch.dispatchId} AND owner_instance_id=${lease.ownerInstanceId} AND lease_token=${lease.leaseToken}`;
    assert.deepEqual(expiry.map(row => ({ ...row })), [{ expired: true }]);
    await assert.rejects(recoveryClaims.acquireRecoveryClaim({ runId: value.runId, storyId: "US-001",
      ownerInstanceId: lease.ownerInstanceId, continuation: { kind: "unreserved_lease", leaseToken: lease.leaseToken } }),
    { code: "V3_RECOVERY_CONTINUATION_STALE" });
    const beforeSuccessor = await deliveries.findDelivery(dispatch.dispatchId);
    assert.equal(beforeSuccessor?.ownerInstanceId, lease.ownerInstanceId);
    assert.equal(beforeSuccessor?.leaseToken, lease.leaseToken);
    assert.equal(beforeSuccessor?.attemptCount, 0,
      "only the actual claimStep router may acquire the next live delivery and publish the successor");
    const { claimStep } = await import("../../src/installer/step-ops.js");
    const { getAgentWorkspacePath, resolveWorktreeBaseDir, findWorktreeDir } = await import("../../src/installer/worktree-ops.js");
    assert.equal(getAgentWorkspacePath("feature-dev_developer"), ownedAgentWorkspace);
    assert.equal(await realpath(resolveWorktreeBaseDir(value.repo, "feature-dev_developer")),
      path.join(ownedAgentWorkspace, "story-worktrees"), "actual recovery destination must be fixture-owned before claimStep");
    const successor = await claimStep("feature-dev_developer", value.input.callerGatewayAgent, {
      schema: "setfarm.runtime-claim-intent.v1", sessionId: "RTS_native-task11-real-recovery-successor",
      runtimeAgentId: "native-task11-repair-runtime", runtimeKind: "local_process",
      ownerInstanceId: "native-task11-live-repair-owner",
    }, { workflowId: "feature-dev", recoveryDispatchClass: "product_implementation" });
    const recoveryStories = await database.sql<Array<{ story_branch: string | null }>>`
      SELECT story_branch FROM stories WHERE run_id=${value.runId} AND story_id='US-001'`;
    const recoveryBranch = recoveryStories[0]?.story_branch;
    assert.ok(recoveryBranch, "actual recovery publication must record its branch");
    const recoveryWorktree = findWorktreeDir(value.repo, recoveryBranch, "feature-dev_developer");
    assert.equal(recoveryWorktree, path.join(ownedAgentWorkspace, "story-worktrees", recoveryBranch.toLowerCase()));
    assert.ok(recoveryWorktree);
    const ownedRelative = path.relative(ownedHostConfigRoot, await realpath(recoveryWorktree));
    assert.ok(ownedRelative && !path.isAbsolute(ownedRelative) && ownedRelative !== ".."
      && !ownedRelative.startsWith(`..${path.sep}`), "actual created recovery worktree must remain inside the owned fixture root");
    const preparation = await database.sql`SELECT phase,check_id,summary,detail,evidence
      FROM run_observations WHERE run_id=${value.runId} AND phase='v3-recovery-claim' ORDER BY created_at,id`;
    const publications = await database.sql`SELECT claim_id::text,runtime_session_id,dispatch_id,revision_id,status
      FROM internal_production_v3_recovery_claim_publications_v1 WHERE run_id=${value.runId}`;
    const fixtureLog = process.env.SETFARM_DB_PATH
      ? await readFile(path.join(path.dirname(process.env.SETFARM_DB_PATH), "logs/workflow.log"), "utf8").catch(() => "")
      : "";
    assert.equal(successor.found, true, JSON.stringify({ successor,
      delivery: await deliveries.findDelivery(delivery.dispatchId), preparation, publications,
      ownership: await publicationDiagnostics(value), fixtureLogTail: fixtureLog.slice(-12_000) }));
    assert.equal(successor.runId, value.runId);
    assert.equal(successor.storyId, "US-001");
    assert.ok(successor.attempt && successor.v3ImplementationHandoff);
    assert.equal(successor.attempt.generation, completed.compiled.attempt.generation + 1);
    const handoff = V3ImplementationClaimHandoffSchema.parse(successor.v3ImplementationHandoff);
    assert.equal(handoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    if (handoff.schema !== "setfarm.v3-implementation-claim-handoff.v2") assert.fail("genuine native recovery handoff required");
    const delta = handoff.implementationSlice.recovery?.expectedSourceDelta;
    assert.ok(delta && "mode" in delta);
    assert.equal(delta.mode, "generated_repair");
    assert.deepEqual(createV3ImplementationContext({ handoff }).writeAuthority.allowedPaths, revision.allowedPaths);
    const fresh = await deliveries.findDelivery(delivery.dispatchId);
    assert.ok(fresh);
    assert.notEqual(fresh.leaseToken, lease.leaseToken);
    assert.equal(fresh.ownerInstanceId, "native-task11-live-repair-owner");

    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    const repairContext = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001",
      attemptId: successor.attempt.attemptId });
    assert.equal(repairContext.kind, "native-dispatch-ready");
    assert.ok(repairContext.recovery);
    assert.deepEqual(repairContext.recovery.findingSet, findings);
    assert.deepEqual(repairContext.recovery.revision, revision);
    assert.equal(repairContext.attempt.claimId, successor.claimId);
    assert.deepEqual(repairContext.sourceBefore, dispatch.sourceRevision);
    assert.equal(repairContext.attempt.recoveryDispatchId, dispatch.dispatchId);
    assert.equal(repairContext.attempt.recoveryCaseRevisionId, revision.revisionId);
    const initialBindings = await database.sql`SELECT attempt_id FROM v3_preparation_authority_attempts_v2
      WHERE authority_hash=${value.nativeAuthority.authorityHash}`;
    assert.deepEqual(initialBindings.map(row => row.attempt_id), [completed.compiled.attempt.attemptId],
      "the genuine initial V2 relation must not be rebound to its recovery successor");
    assert.ok(successor.runtimeSessionId && successor.runtimeOwnerInstanceId);
    const repairRuntime = await createRuntimeSessionRepository(database.sql).findById(successor.runtimeSessionId);
    assert.ok(repairRuntime);
    assert.equal(repairRuntime.state, "reserved");
    assert.equal(repairRuntime.attemptId, repairContext.attempt.attemptId);
    assert.equal(repairRuntime.claimId, successor.claimId);
    assert.equal(repairRuntime.ownerInstanceId, successor.runtimeOwnerInstanceId);
    const repairEnvelope = ClaimEnvelopeV1Schema.parse({ schema: "setfarm.claim-envelope.v1", protocol: "v3",
      issuedAt: new Date().toISOString(), runId: successor.runId, stepId: successor.stepId,
      workflowStepId: successor.workflowStepId, storyId: successor.storyId, storyDbId: successor.storyDbId,
      claimId: successor.claimId, claimGeneration: successor.claimGeneration,
      claimAgentId: repairRuntime.claimAgentId, runtimeAgentId: repairRuntime.runtimeAgentId,
      workdir: handoff.workdir, repo: value.repo, attempt: successor.attempt });
    const repaired = await completeNeverStartedNativeSession(value, { compiled: repairContext, handoff,
      envelope: repairEnvelope, sessionId: repairRuntime.sessionId, ownerInstanceId: repairRuntime.ownerInstanceId },
    NATIVE_JOIN_CLI_SOURCE + "// bounded generated repair of the actual failed candidate\n");
    assert.notEqual(repaired.candidateSource.source_after_sha, dispatch.sourceRevision.sha,
      "repair success must produce a genuinely changed committed candidate");
    assert.notEqual(repaired.candidateSource.source_after_tree_hash, dispatch.sourceRevision.treeHash);
    const resolved = await createFindingRecoveryRepository(database.sql).findRecoveryCase(dispatch.recoveryCaseId);
    assert.ok(resolved);
    assert.equal(resolved.recoveryCaseId, dispatch.recoveryCaseId);
    assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
    const terminalDelivery = await deliveries.findDelivery(dispatch.dispatchId);
    assert.ok(terminalDelivery);
    assert.equal(terminalDelivery.state, "succeeded");
    assert.equal(terminalDelivery.attemptId, repairContext.attempt.attemptId);
    assert.equal(terminalDelivery.claimId, successor.claimId);
    const acceptedRows = await database.sql`SELECT a.attempt_id,a.disposition,c.state,c.apply_phase,
      c.claim_outcome,s.state AS runtime_state FROM execution_attempts a
      JOIN runtime_completion_requests c ON c.attempt_id=a.attempt_id AND c.claim_id=a.claim_id AND c.output_hash=a.output_hash
      JOIN runtime_sessions s ON s.session_id=c.runtime_session_id AND s.claim_id=a.claim_id AND s.attempt_id=a.attempt_id
      WHERE a.attempt_id=${repairContext.attempt.attemptId}`;
    assert.equal(acceptedRows.length, 1);
    assert.equal(acceptedRows[0]!.state, "accepted");
    assert.equal(acceptedRows[0]!.apply_phase, "effects_committed");
    assert.equal(acceptedRows[0]!.claim_outcome, "completed");
    assert.equal(acceptedRows[0]!.runtime_state, "released");
    assert.ok(["produced_delta", "already_satisfied", "verified"].includes(acceptedRows[0]!.disposition));
    const readbackEffects = await countEffects(value);
    const acceptedContext = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001",
      attemptId: repairContext.attempt.attemptId });
    assert.equal(acceptedContext.sliceHash, repairContext.sliceHash);
    assert.equal(acceptedContext.evidencePlanArtifactHash, repairContext.evidencePlanArtifactHash);
    assert.deepEqual(acceptedContext.sourceBefore, repairContext.sourceBefore);
    const { createPostgresTerminalDependencyAttemptReader } = await import("../../src/execution/v3-preparation-eligibility.js");
    const terminal = await createPostgresTerminalDependencyAttemptReader(database.sql, {
      artifactRoot: value.artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS,
    })({ runId: value.runId, stepId: "implement", packetHash: value.packet.packetHash, storyIds: ["US-001"] });
    assert.equal(terminal.length, 1);
    assert.equal(terminal[0]!.attemptId, repairContext.attempt.attemptId);
    assert.equal(terminal[0]!.sourceAfterSha, repaired.candidateSource.source_after_sha);
    assert.ok(terminal[0]!.nativeAuthority);
    assert.deepEqual(await countEffects(value), readbackEffects,
      "accepted native repair readback must create no claim, attempt, binding or runtime");
    // No final-product/supervisor subject or selected physical closure is
    // manufactured by successful SQL/canonical evidence completion.
  });

  it("native Task11 accepted predecessor survives production cleanup for dependent native enrichment", async () => {
    const value = await fixture("task11-owned-dependency", true, false, true);
    const completed = await completeNeverStartedNativeCandidate(value, NATIVE_JOIN_API_SOURCE + "// scoped task implementation\n");
    const { createPostgresTerminalDependencyAttemptReader } = await import("../../src/execution/v3-preparation-eligibility.js");
    const readTerminal = createPostgresTerminalDependencyAttemptReader(database.sql, {
      artifactRoot: value.artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS,
    });
    const locator = { runId: value.runId, stepId: "implement", packetHash: value.packet.packetHash, storyIds: ["US-001"] };
    const before = await readTerminal(locator);
    assert.equal(before.length, 1);
    assert.equal(before[0]!.attemptId, completed.compiled.attempt.attemptId);
    assert.ok(before[0]!.nativeAuthority);
    const { removeStoryWorktree } = await import("../../src/installer/worktree-ops.js");
    removeStoryWorktree(value.repo, value.branch, value.input.claimAgentId);
    await assert.rejects(stat(value.worktree), { code: "ENOENT" }, "production cleanup must really remove the old worktree");
    const git = (args: string[]) => execFileSync("git", args, { cwd: value.repo, encoding: "utf8", stdio: "pipe" }).trim();
    const retainedTip = git(["rev-parse", "--verify", "--end-of-options", `${value.branch}^{commit}`]);
    assert.match(retainedTip, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
    assert.equal(git(["merge-base", "--is-ancestor", before[0]!.sourceAfterSha, retainedTip]), "",
      "production cleanup may append an evidence auto-save commit while retaining the accepted candidate");
    assert.equal(git(["rev-parse", `${before[0]!.sourceAfterSha}^{tree}`]), before[0]!.nativeAuthority.sourceAfter.treeHash,
      "retention must preserve the exact accepted candidate tree, not substitute the cleanup tip");
    assert.equal(git(["rev-parse", `${value.sourceBefore.sha}^{tree}`]), value.sourceBefore.treeHash);
    assert.equal(git(["merge-base", "--is-ancestor", value.sourceBefore.sha, value.branch]), "");
    assert.deepEqual(await readTerminal(locator), before,
      "accepted dependency must reload exact native original from retained canonical objects after cleanup");
    const prepared = await createV3NormalImplementationPreclaim({
      readPacket: runId => value.reader.readExactSealedPacket(runId), blockRepository: value.blocks,
      readPendingStories: async () => database.sql<Array<{ id: string; run_id: string; story_id: string;
        story_index: number; status: string; depends_on: string }>>`
        SELECT id,run_id,story_id,story_index,status,depends_on FROM stories
        WHERE run_id=${value.runId} AND status='pending' ORDER BY story_index`,
      readTerminalDependencyAttempts: readTerminal,
    }).prepare({ runId: value.runId, stepId: "implement", repo: value.repo, requestedBaseRef: value.branch });
    assert.equal(prepared.status, "ready", JSON.stringify(prepared));
    if (prepared.status !== "ready" || prepared.packetSchema !== "setfarm.product-build-packet.v3")
      assert.fail("real accepted predecessor must enrich the pending second native story");
    assert.equal(prepared.story.story_id, "US-002");
    assert.deepEqual(prepared.nativeAuthority.dependencyAttempts, [before[0]!.nativeAuthority]);
    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    const acceptedContext = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001",
      attemptId: completed.compiled.attempt.attemptId });
    assert.equal(acceptedContext.sliceHash, completed.compiled.sliceHash);
    assert.equal(acceptedContext.evidencePlanArtifactHash, completed.compiled.evidencePlanArtifactHash);
    // Accepted-context reload is a prerequisite for supervisor readback, not a
    // fabricated supervisor claim or proof of selected final-product readonly.
  });

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

  it("rolls back each crossed native run, story, base, report and state authority", async () => {
    const value = await fixture("wrong-authorities");
    for (const mismatch of ["run", "story", "base", "report", "state"] as const) {
      const { schema: _s, authorityVersion: _v, packetSchema: _p, authorityHash: _h, ...payload } = value.nativeAuthority;
      const nativePreparationAuthority = createV3PreparationClaimAuthorityV2({ ...payload,
        ...(mismatch === "run" ? { runId: "other-native-run" } : {}),
        ...(mismatch === "story" ? { storyId: "US-002" } : {}),
        ...(mismatch === "base" ? { baseRevision: { ...payload.baseRevision, sha: "a".repeat(40) } } : {}),
        ...(mismatch === "report" ? { compilationReportHash: "f".repeat(64) } : {}),
        ...(mismatch === "state" ? { stateVersion: payload.stateVersion + 1 } : {}),
      });
      const input = { ...value.input, nativePreparationAuthority };
      await assert.rejects(publishLoopClaimRuntime(value.database.sql, input), `crossed ${mismatch} must reject`);
      assert.deepEqual(await countEffects(value), { claims: 0, attempts: 0, bindings: 0, runtimes: 0 },
        `crossed ${mismatch} must have zero effects`);
      assert.equal(await readV3PreparationAuthorityV2(value.database.sql, nativePreparationAuthority.authorityHash),
        undefined, `crossed ${mismatch} must not persist its authority`);
    }
  });

  it("keeps one exact paired owner under two competing claim publications", async () => {
    const value = await fixture("race");
    const competing = { ...value.input, runtimeIntent: { ...value.input.runtimeIntent, sessionId: "RTS_native-race-other" } };
    const results = await Promise.allSettled([
      publishLoopClaimRuntime(database.sql, value.input), publishLoopClaimRuntime(database.sql, competing),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled" && result.value).length, 1,
      JSON.stringify({ results, admission: await publicationDiagnostics(value) }));
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

  it("reserves while exact committed publication replays without a run/claim lock cycle", async () => {
    const value = await fixture("reserve-replay-lock-order");
    const publication = await claim(value);
    const native = await service();
    const lockIdentity = hashCanonicalJson({ schema: "setfarm.execution-attempt-lock.v1",
      runId: value.runId, stepId: "implement", storyId: "US-001" });
    let releaseGate!: () => void;
    const released = new Promise<void>(resolve => { releaseGate = resolve; });
    let gateReady!: (pid: number) => void;
    let gateFailed!: (reason: unknown) => void;
    const gatePid = new Promise<number>((resolve, reject) => { gateReady = resolve; gateFailed = reject; });
    const gate = database.sql.begin(async transaction => {
      const rows = await transaction.unsafe<Array<{ pid: number }>>("SELECT pg_backend_pid() AS pid");
      await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lockIdentity]);
      gateReady(rows[0]!.pid);
      await released;
    });
    // Install handlers immediately; cleanup below awaits every real operation.
    void gate.catch(gateFailed);
    let reservation: ReturnType<typeof native.reserve> | undefined;
    let replay: ReturnType<typeof publishLoopClaimRuntime> | undefined;
    const schedule: Array<{ stage: string; pid?: number; query?: string }> = [];
    try {
      const blockerPid = await gatePid;
      reservation = native.reserve(reserveInput(value, publication.claimId));
      void reservation.catch(() => {});
      let reservationPid: number | undefined;
      const reserveDeadline = Date.now() + 10_000;
      while (reservationPid === undefined) {
        const waiting = await database.sql.unsafe<Array<{ pid: number; query: string }>>(
          `SELECT activity.pid,activity.query FROM pg_stat_activity activity
            WHERE activity.datname=current_database()
              AND $1::integer=ANY(pg_blocking_pids(activity.pid))
              AND EXISTS (SELECT 1 FROM pg_locks waiting_lock WHERE waiting_lock.pid=activity.pid
                AND waiting_lock.locktype='advisory' AND NOT waiting_lock.granted)`, [blockerPid]);
        assert.ok(waiting.length <= 1, "only the actual native reservation may wait on this fixture's gate");
        if (waiting[0]) {
          reservationPid = waiting[0].pid;
          schedule.push({ stage: "native-reserve-blocked-on-attempt-advisory", ...waiting[0] });
          break;
        }
        assert.ok(Date.now() < reserveDeadline, "native reservation did not reach the observed attempt advisory barrier");
        await new Promise<void>(resolve => setTimeout(resolve, 10));
      }
      let replaySettled = false;
      replay = publishLoopClaimRuntime(database.sql, value.input);
      void replay.then(() => { replaySettled = true; }, () => { replaySettled = true; });
      const replayDeadline = Date.now() + 10_000;
      while (!replaySettled) {
        const waiting = await database.sql.unsafe<Array<{ pid: number; query: string }>>(
          `SELECT pid,query FROM pg_stat_activity WHERE datname=current_database()
            AND $1::integer=ANY(pg_blocking_pids(pid))`, [reservationPid]);
        if (waiting[0]) {
          schedule.push({ stage: "publication-replay-blocked-by-native-reserve", ...waiting[0] });
          break;
        }
        assert.ok(Date.now() < replayDeadline, "publication replay neither settled nor reached the observed native blocker");
        await new Promise<void>(resolve => setTimeout(resolve, 10));
      }
      if (replaySettled) schedule.push({ stage: "publication-replay-settled-before-gate-release" });
      releaseGate();
      const results = await Promise.allSettled([reservation, replay]);
      const diagnostic = JSON.stringify({ schedule, results: results.map(result => result.status === "rejected"
        ? { status: result.status, message: String(result.reason), detail: result.reason }
        : { status: result.status }) });
      assert.equal(results[0]!.status, "fulfilled", `native reserve must survive exact publication replay: ${diagnostic}`);
      assert.equal(results[1]!.status, "fulfilled", `exact publication replay must survive native reserve: ${diagnostic}`);
      const prepared = await reservation;
      assert.deepEqual(await replay, publication);
      assert.deepEqual(await countEffects(value), { claims: 1, attempts: 1, bindings: 1, runtimes: 1 });
      const bindings = await database.sql`
        SELECT attempt_id,claim_id::text,slice_hash FROM v3_preparation_authority_attempts_v2
         WHERE authority_hash=${value.nativeAuthority.authorityHash}
      `;
      assert.deepEqual(bindings.map(row => ({ ...row })), [{ attempt_id: prepared.attempt.attemptId,
        claim_id: String(publication.claimId), slice_hash: prepared.sliceHash }]);
    } finally {
      releaseGate();
      await Promise.allSettled([gate, ...(reservation ? [reservation] : []), ...(replay ? [replay] : [])]);
    }
  });

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
    const custodyRefs = result.attempt.evidenceRefs.filter(ref => ref.startsWith("setfarm://native-git-custody-v1/"));
    assert.equal(custodyRefs.length, 1);
    assert.match(custodyRefs[0]!, /^setfarm:\/\/native-git-custody-v1\/[a-f0-9]{64}$/);
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
      { evidenceRefs: [`setfarm://native-git-custody-v1/${"f".repeat(64)}`] },
      { attemptClass: "infrastructure_retry" }, { attemptClass: "supervisor_repair" },
      { recoveryDelivery: { dispatchId: "untrusted" } }]) {
      await assert.rejects(native.reserve({ ...input, ...wrong }));
    }
    await writeFile(path.join(value.worktree, "src/index.ts"), "source changed before reserve\n");
    await assert.rejects(native.reserve(input));
    assert.deepEqual(await countEffects(value), { claims: 1, attempts: 0, bindings: 1, runtimes: 1 });
  });

});
