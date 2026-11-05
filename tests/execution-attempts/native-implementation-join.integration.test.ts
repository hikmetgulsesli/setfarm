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
import { createV3NormalImplementationPreclaim, createPostgresV3PendingStoryReader } from "../../src/execution/v3-normal-implementation-preclaim.js";
import { createV3ImplementationContext, V3ImplementationClaimHandoffSchema } from "../../src/execution/v3-implementation-handoff.js";
import type { V3ImplementationAttemptResult } from "../../src/execution/v3-implementation-attempt.js";
import { ClaimEnvelopeV1Schema } from "../../src/execution/schemas/claim-envelope-v1.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1 } from "../../src/execution/v3-predecessor-completion-claim-barrier-v1.js";
import { createV3ImplementationAttemptV2Assembler } from "../../src/execution/v3-implementation-attempt-v2.js";
import { loadCompilerStoryEnglishAdmissionLedgerAuthorityV1, createCompilerStoryEnglishAdmissionClaimProofV1 } from "../../src/execution/compiler-story-english-admission-ledger-v1.js";
import { seedCanonicalCompilerStoryAdmissionFixture } from "./helpers/compiler-story-english-admission-fixture.js";
import { nativeJoinEnvelope, nativeJoinPacket, nativeJoinSourceFixture, nativeJoinRuntimeSessionId,
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

  async function fixture(suffix: string, twoStories = false, runnableCli = false, lifecycle = false, evidenceServiceUnavailable = false, sharedWritable = false) {
    const source = await nativeJoinSourceFixture(runnableCli, twoStories && lifecycle, lifecycle);
    roots.push(source.root);
    const runId = `run-native-join-${suffix}`;
    const evidencePreload = evidenceServiceUnavailable ? path.join(source.root, "evidence-service-preload.cjs") : undefined;
    assert.ok(!evidencePreload || (twoStories && lifecycle && !runnableCli));
    const packet = nativeJoinPacket(runId, twoStories, runnableCli, twoStories && lifecycle,
      evidencePreload ? { NODE_OPTIONS: `--require=${evidencePreload}` } : undefined, sharedWritable);
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
        sessionId: nativeJoinRuntimeSessionId(suffix), runtimeAgentId: `native-join-${suffix}`,
        ...(lifecycle ? { runtimeKind: "local_process" as const }
          : { runtimeKind: "openclaw_session" as const, sessionKey: `native-join:${suffix}` }),
        ownerInstanceId: "native-join-test" },
      preparationAuthority: readiness, nativePreparationAuthority: nativeAuthority,
      nativePreparationArtifacts: { artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS },
      storyAdmissionProof: admission.storyAdmissionProof,
    };
    return { database, ...source, runId, packet, reader, artifactRoot, store, blocks,
      readiness, nativeAuthority, input, prepare, admission, evidencePreload };
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
    // Read-only copy of claimStep's current full SQL selector, including its
    // actual priority/tie ordering. Diagnostics never supply selection authority.
    const selectedByActualSelector = await database.sql.unsafe(`SELECT s.id, s.step_id, s.run_id, s.step_index, s.input_template, s.type, s.loop_config, s.status as step_status, s.current_story_id, s.retry_count, s.output, r.protocol
         FROM steps s
         JOIN runs r ON r.id = s.run_id
         WHERE s.agent_id = $1
           AND (
             s.status = 'pending'
             OR s.status = 'running'
           )
           AND r.status IN ('running', 'resuming')
           AND NOT ${V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1}
           AND NOT (
  s.step_id = 'implement'
  AND s.type = 'loop'
  AND COALESCE(s.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
  AND (
    COALESCE(r.context::jsonb ->> 'failure_category', '') = 'PR_REVIEW_COMMENTS_OPEN'
    OR COALESCE(r.context::jsonb ->> 'previous_failure', '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
    OR COALESCE(r.context::jsonb ->> 'verify_feedback', '') ILIKE '%PR_REVIEW_COMMENTS_OPEN%'
  )
  AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running'))
  AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
)
           AND (
             $2::text IS NULL
             OR s.step_id <> 'implement'
             OR r.assigned_developer IS NULL
             OR r.assigned_developer = $2
           )
           AND NOT (
             s.step_id = 'verify'
             AND r.context::jsonb ? 'verify_pending_since'
             AND r.context::jsonb ? 'verify_pending_pr_url'
             AND (r.context::jsonb ->> 'verify_pending_since')::timestamptz > NOW() - ($3::int * interval '1 millisecond')
             AND NOT EXISTS (
               SELECT 1 FROM stories verify_done_st
               WHERE verify_done_st.run_id = s.run_id
                 AND verify_done_st.status = 'done'
                 AND verify_done_st.pr_url IS NOT NULL
                 AND verify_done_st.pr_url <> (r.context::jsonb ->> 'verify_pending_pr_url')
             )
           )
           AND NOT (
             s.step_id = COALESCE((
               SELECT NULLIF(verify_loop.loop_config::jsonb ->> 'verifyStep', '')
               FROM steps verify_loop
               WHERE verify_loop.run_id = s.run_id
                 AND verify_loop.type = 'loop'
                 AND verify_loop.step_id = 'implement'
                 AND COALESCE(verify_loop.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
               LIMIT 1
             ), 'verify')
             AND EXISTS (
               SELECT 1 FROM stories verify_wait_st
               WHERE verify_wait_st.run_id = s.run_id
                 AND verify_wait_st.status = 'done'
                 AND (
                   COALESCE(r.context::jsonb ->> 'supervised_story_ids', '') = ''
                   OR POSITION(',' || verify_wait_st.story_id || ',' IN ',' || COALESCE(r.context::jsonb ->> 'supervised_story_ids', '') || ',') = 0
                 )
             )
           )
           AND NOT EXISTS (
             SELECT 1 FROM steps prev
	             WHERE prev.run_id = s.run_id
	               AND prev.step_index < s.step_index
	               AND prev.status NOT IN ('done', 'failed', 'skipped', 'verified')
	               AND NOT (
	                 prev.type = 'loop'
	                 AND prev.status = 'running'
	                 AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
	                 AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
	                 AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
	                 AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND (active_st.retry_count > 0 OR COALESCE(active_st.output, '') ~* 'PR_REVIEW_COMMENTS_OPEN|actionable PR review comments|APP_INTEGRATION_[A-Z_]*REGRESSION|POST_MERGE_QUALITY_REGRESSION|VULNERABILITIES|SECURITY_FINDINGS?|STATUS:[[:space:]]*retry'))
	                 AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
	               )
	               AND NOT (
	                 prev.type = 'loop'
	                 AND prev.status = 'pending'
	                 AND COALESCE(prev.loop_config::jsonb, '{}'::jsonb) @> '{"verifyEach":true}'::jsonb
	                 AND COALESCE(prev.loop_config::jsonb ->> 'verifyStep', '') = s.step_id
	                 AND EXISTS (SELECT 1 FROM stories done_st WHERE done_st.run_id = s.run_id AND done_st.status = 'done')
	                 AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND (active_st.retry_count > 0 OR COALESCE(active_st.output, '') ~* 'PR_REVIEW_COMMENTS_OPEN|actionable PR review comments|APP_INTEGRATION_[A-Z_]*REGRESSION|POST_MERGE_QUALITY_REGRESSION|VULNERABILITIES|SECURITY_FINDINGS?|STATUS:[[:space:]]*retry'))
	                 AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
	               )
	               AND NOT (
	                 s.step_id = COALESCE((
	                   SELECT NULLIF(sup_loop.loop_config::jsonb ->> 'superviseStep', '')
	                   FROM steps sup_loop
	                   WHERE sup_loop.run_id = s.run_id
	                     AND sup_loop.type = 'loop'
	                     AND sup_loop.step_id = 'implement'
	                     AND COALESCE(sup_loop.loop_config::jsonb, '{}'::jsonb) @> '{"superviseEach":true}'::jsonb
	                   LIMIT 1
	                 ), 'supervise')
	                 AND EXISTS (
	                   SELECT 1 FROM stories sup_done_st
	                   WHERE sup_done_st.run_id = s.run_id
	                     AND sup_done_st.status = 'done'
	                 )
	                 AND NOT EXISTS (SELECT 1 FROM stories active_st WHERE active_st.run_id = s.run_id AND active_st.status IN ('pending', 'running') AND (active_st.retry_count > 0 OR COALESCE(active_st.output, '') ~* 'PR_REVIEW_COMMENTS_OPEN|actionable PR review comments|APP_INTEGRATION_[A-Z_]*REGRESSION|POST_MERGE_QUALITY_REGRESSION|VULNERABILITIES|SECURITY_FINDINGS?|STATUS:[[:space:]]*retry'))
	                 AND NOT EXISTS (SELECT 1 FROM stories fix_st WHERE fix_st.run_id = s.run_id AND fix_st.story_id LIKE 'QA-FIX-%' AND fix_st.status IN ('pending', 'running'))
	               )
	           )
         ORDER BY
           CASE
             WHEN s.status = 'running' THEN 0
             WHEN $2::text IS NOT NULL AND r.assigned_developer = $2 THEN 0
             WHEN r.assigned_developer IS NULL THEN 1
             ELSE 2
           END,
           s.step_index ASC, s.status ASC
         LIMIT 1`,
      [value.input.claimAgentId, value.input.callerGatewayAgent, 60_000]);
    const candidateFacts = await database.sql.unsafe(`SELECT s.id,s.run_id,s.step_id,s.agent_id,s.status,
      s.step_index,s.type,s.loop_config,s.current_story_id,r.status AS run_status,r.assigned_developer,
      ${V3_PENDING_SINGLE_PREDECESSOR_COMPLETION_SQL_V1} AS predecessor_completion_blocked,
      (r.assigned_developer IS NULL OR r.assigned_developer=$2) AS gateway_matches,
      EXISTS(SELECT 1 FROM steps prev WHERE prev.run_id=s.run_id AND prev.step_index<s.step_index
        AND prev.status NOT IN ('done','failed','skipped','verified')) AS unfinished_predecessor,
      (SELECT count(*)::integer FROM stories st WHERE st.run_id=s.run_id AND st.status='running') AS running_stories,
      CASE WHEN s.status='running' THEN 0 WHEN r.assigned_developer=$2 THEN 0
        WHEN r.assigned_developer IS NULL THEN 1 ELSE 2 END AS selection_priority
      FROM steps s JOIN runs r ON r.id=s.run_id WHERE s.agent_id=$1
        AND s.status IN ('pending','running') AND r.status IN ('running','resuming')
      ORDER BY selection_priority,s.step_index,s.status,s.id`,[value.input.claimAgentId,value.input.callerGatewayAgent]);
    const defaultPendingStoryReaderRows = await createPostgresV3PendingStoryReader(database.sql)({
      runId: value.runId, stepId: "implement",
    });
    const allowedRunContext = await database.sql`SELECT
      context::jsonb->>'repo' AS repo, context::jsonb->>'branch' AS branch,
      context::jsonb->>'BRANCH' AS "BRANCH", context::jsonb->>'implement_base_commit' AS implement_base_commit
      FROM runs WHERE id=${value.runId}`;
    return { callerGatewayAgent: value.input.callerGatewayAgent, selectorAgentId: value.input.claimAgentId,
      selectedByActualSelector, candidateFacts, defaultPendingStoryReaderRows, allowedRunContext,
      runs, stories, steps, runtimes, completions };
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

    // Reuse this still-clean actual caller publication. This exercises the real
    // SQL operational-failure producer, not an observed physical provider fault.
    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    const origin = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001",
      attemptId: claimed.attempt.attemptId });
    const { createOperationalRetryDirectiveV1, resolveV3ExecutionProfile } =
      await import("../../src/execution/operational-retry-directive.js");
    const { publishOperationalRetryDirectiveInTransaction, terminalizeOperationalRetryExhaustionInTransaction } =
      await import("../../src/execution/operational-retry-transition.js");
    const { releaseReservedRuntimeSessionInTransaction } = await import("../../src/execution/runtime-session-repository.js");
    const sessions = createRuntimeSessionRepository(database.sql);
    const initialRuntime = await sessions.findById(value.input.runtimeIntent.sessionId);
    assert.equal(initialRuntime?.state, "reserved");
    assert.equal(initialRuntime?.startedAt, undefined);
    const diagnostic = "IMPLEMENT_NO_DELTA_STALL: never-started SQL operational transition probe; no physical provider failure claimed";
    const directive = createOperationalRetryDirectiveV1({ runId: value.runId, stepId: "implement", storyId: "US-001",
      priorAttempt: { claimId: claimed.claimId, attemptId: origin.attempt.attemptId,
        generation: origin.attempt.generation, attemptClass: "product_implementation",
        packetHash: origin.packetHash, sliceHash: origin.sliceHash, sourceBefore: origin.sourceBefore,
        terminalDisposition: "inconclusive" },
      failure: { code: "IMPLEMENT_NO_DELTA_STALL", diagnostic }, nextSourceRevision: origin.sourceBefore,
      allowedPaths: origin.slice.files.filter(file => file.role === "owned" || file.role === "shared_writable").map(file => file.path),
    });
    const identity = { claimId: claimed.claimId, attemptId: origin.attempt.attemptId,
      attemptGeneration: origin.attempt.generation, runId: value.runId, stepId: "implement",
      stepDbId: value.admission.implementStepDbId, storyId: "US-001", storyDbId: value.input.storyDbId, agentId };
    const counts = await countEffects(value);
    await assert.rejects(database.sql.begin(tx => publishOperationalRetryDirectiveInTransaction(tx, {
      ...identity, stepDbId: "absent-native-operational-step", diagnostic, directive,
    })), /OPERATIONAL_RETRY_STEP_STATE_CAS_LOST/);
    assert.deepEqual(await countEffects(value), counts, "failed transition must roll back its real owner mutations");
    const closed = await database.sql.begin(async tx => {
      const result = await publishOperationalRetryDirectiveInTransaction(tx, { ...identity, diagnostic, directive });
      assert.equal(result.status, "closed");
      await releaseReservedRuntimeSessionInTransaction(tx, { sessionId: value.input.runtimeIntent.sessionId,
        claimId: claimed.claimId!, ownerInstanceId: value.input.runtimeIntent.ownerInstanceId, diagnostic });
      return result;
    });
    assert.equal(closed.status, "closed");
    assert.deepEqual(directive.retryBudget, { ordinal: 1, limit: 1 });
    assert.deepEqual(directive.executionProfile, resolveV3ExecutionProfile("fallback"));
    const retryIntent = { ...value.input.runtimeIntent, sessionId: "RTS_native-task11-operational-fallback",
      ownerInstanceId: "native-task11-operational-fallback-owner" };
    const retry = await claimStep(agentId, value.input.callerGatewayAgent, retryIntent);
    const retryBlocks = await database.sql`SELECT phase,error_code,detail FROM v3_preparation_blocks
      WHERE run_id=${value.runId} ORDER BY opened_at,block_id`;
    const retryObservations = await database.sql`SELECT phase,check_id,summary,detail,evidence FROM run_observations
      WHERE run_id=${value.runId} AND (phase LIKE '%pre%' OR phase LIKE '%reservation%' OR phase LIKE '%retry%')
      ORDER BY created_at,id`;
    assert.equal(retry.found, true, JSON.stringify({ retry, state: await publicationDiagnostics(value),
      preparationBlocks: retryBlocks, reservationObservations: retryObservations }));
    assert.ok(retry.attempt && retry.claimId && retry.v3ImplementationHandoff);
    const fallback = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001",
      attemptId: retry.attempt.attemptId });
    assert.equal(fallback.kind, "native-dispatch-ready");
    assert.equal(fallback.attempt.attemptClass, "infrastructure_retry");
    assert.equal(fallback.attempt.generation, origin.attempt.generation + 1);
    assert.deepEqual(fallback.sourceBefore, origin.sourceBefore);
    assert.equal(fallback.sliceHash, origin.sliceHash);
    assert.deepEqual(fallback.slice, origin.slice);
    assert.equal(fallback.evidencePlanArtifactHash, origin.evidencePlanArtifactHash);
    assert.deepEqual(fallback.evidencePlan, origin.evidencePlan);
    assert.deepEqual(fallback.executionProfile, directive.executionProfile);
    assert.ok(fallback.attempt.evidenceRefs.includes(`setfarm://operational-retry/${directive.directiveHash}`));
    const stillInitial = await database.sql`SELECT claim_id::text,attempt_id,slice_hash FROM v3_preparation_authority_attempts_v2
      WHERE authority_hash=${value.nativeAuthority.authorityHash}`;
    assert.deepEqual(stillInitial.map(row => ({ ...row })), binding.map(row => ({ ...row })));
    const exhaustedDiagnostic = "OPERATIONAL_RETRY_EXHAUSTED: bounded SQL protocol probe; no provider execution claimed";
    const exhausted = await database.sql.begin(async tx => {
      const result = await terminalizeOperationalRetryExhaustionInTransaction(tx, {
        ...identity, claimId: retry.claimId!, attemptId: fallback.attempt.attemptId,
        attemptGeneration: fallback.attempt.generation, diagnostic: exhaustedDiagnostic, directive,
      });
      await releaseReservedRuntimeSessionInTransaction(tx, { sessionId: retryIntent.sessionId,
        claimId: retry.claimId!, ownerInstanceId: retryIntent.ownerInstanceId, diagnostic: exhaustedDiagnostic });
      return result;
    });
    assert.equal(exhausted.status, "closed");
    const terminal = await database.sql`SELECT status FROM stories WHERE id=${value.input.storyDbId}`;
    assert.equal(terminal[0]?.status, "failed");
    const afterExhaustion = await countEffects(value);
    assert.equal((await claimStep(agentId, value.input.callerGatewayAgent,
      { ...retryIntent, sessionId: "RTS_native-task11-operational-forbidden-third" })).found, false);
    assert.deepEqual(await countEffects(value), afterExhaustion);
    assert.equal(afterExhaustion.attempts, 2);
  });

  async function runNativeFallbackReviewScenario(dependent=false) {
    // Success and budget exhaustion are mutually exclusive terminal outcomes.
    // Keep the existing actual-caller exhaustion regression unchanged.
    const value = await fixture(dependent ? "task11-review-fallback-dependent" : "task11-fallback-success", dependent, !dependent, true);
    const suffix = path.basename(value.root);
    const agentId = `feature-dev_native-task11-fallback-${suffix}`;
    const supervisorAgentId = `feature-dev_native-task11-fallback-review-${suffix}`;
    const superviseStepDbId = `${value.runId}-supervise-step`;
    // Seed only the ordinary workflow shape, before any implementation owner.
    await database.sql`UPDATE steps SET agent_id=${agentId} WHERE id=${value.admission.implementStepDbId}`;
    await database.sql`INSERT INTO steps (
      id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,retry_count,max_retries
    ) VALUES (
      ${superviseStepDbId},${value.runId},'supervise',${supervisorAgentId},5,
      'Review the accepted native implementation.','','waiting','single',0,3
    )`;
    const { getAgentWorkspacePath, removeStoryWorktree } = await import("../../src/installer/worktree-ops.js");
    assert.equal(getAgentWorkspacePath(agentId), null, "unique persona must stay inside its owned repo/.worktrees");
    assert.equal(getAgentWorkspacePath(supervisorAgentId), null);
    const { claimStep } = await import("../../src/installer/step-ops.js");
    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    const sessions = createRuntimeSessionRepository(database.sql);
    const initial = await claimStep(agentId, value.input.callerGatewayAgent, value.input.runtimeIntent);
    assert.equal(initial.found, true, JSON.stringify({ initial, state: await publicationDiagnostics(value) }));
    assert.equal(initial.runId, value.runId);
    assert.equal(initial.storyId, value.input.storyId);
    assert.equal(initial.claimAgentId, agentId);
    assert.ok(initial.attempt && initial.claimId && initial.v3ImplementationHandoff && initial.runtimeSessionId);
    const initialHandoff = V3ImplementationClaimHandoffSchema.parse(initial.v3ImplementationHandoff);
    assert.equal(initialHandoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    if (initialHandoff.schema !== "setfarm.v3-implementation-claim-handoff.v2") assert.fail("real initial claim must be native");
    assert.deepEqual(initialHandoff.executionAuthority, { role: "developer", attemptClass: "product_implementation" });
    const origin = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: initialHandoff.storyId,
      attemptId: initial.attempt.attemptId });
    const initialRuntime = await sessions.findById(initial.runtimeSessionId);
    assert.ok(initialRuntime);
    assert.equal(initialRuntime.state, "reserved");
    assert.equal(initialRuntime.runtimeKind, "local_process");
    assert.equal(initialRuntime.startedAt, undefined);
    assert.equal(initialRuntime.claimId, initial.claimId);
    assert.equal(initialRuntime.attemptId, origin.attempt.attemptId);
    assert.equal(initialHandoff.workdir, origin.attempt.worktree);
    assert.equal(initialHandoff.branch, origin.attempt.branch);
    const initialBindings = await database.sql`SELECT claim_id::text,attempt_id,slice_hash
      FROM v3_preparation_authority_attempts_v2 WHERE authority_hash=${initialHandoff.nativeAuthority.authorityHash}`;
    assert.deepEqual(initialBindings.map(row => ({ ...row })), [{ claim_id: String(initial.claimId),
      attempt_id: origin.attempt.attemptId, slice_hash: origin.sliceHash }]);

    const { createOperationalRetryDirectiveV1, resolveV3ExecutionProfile } =
      await import("../../src/execution/operational-retry-directive.js");
    const { publishOperationalRetryDirectiveInTransaction } =
      await import("../../src/execution/operational-retry-transition.js");
    const { releaseReservedRuntimeSessionInTransaction } = await import("../../src/execution/runtime-session-repository.js");
    const diagnostic = "IMPLEMENT_NO_DELTA_STALL: never-started SQL operational transition before successful candidate; no physical provider failure claimed";
    const directive = createOperationalRetryDirectiveV1({ runId: value.runId, stepId: "implement", storyId: initialHandoff.storyId,
      priorAttempt: { claimId: initial.claimId, attemptId: origin.attempt.attemptId,
        generation: origin.attempt.generation, attemptClass: "product_implementation",
        packetHash: origin.packetHash, sliceHash: origin.sliceHash, sourceBefore: origin.sourceBefore,
        terminalDisposition: "inconclusive" },
      failure: { code: "IMPLEMENT_NO_DELTA_STALL", diagnostic }, nextSourceRevision: origin.sourceBefore,
      allowedPaths: [...createV3ImplementationContext({ handoff: initialHandoff }).writeAuthority.allowedPaths],
    });
    await database.sql.begin(async tx => {
      const result = await publishOperationalRetryDirectiveInTransaction(tx, {
        claimId: initial.claimId!, attemptId: origin.attempt.attemptId, attemptGeneration: origin.attempt.generation,
        runId: value.runId, stepId: "implement", stepDbId: initialHandoff.stepId,
        storyId: initialHandoff.storyId, storyDbId: initialHandoff.storyDbId, agentId, diagnostic, directive,
      });
      assert.equal(result.status, "closed");
      await releaseReservedRuntimeSessionInTransaction(tx, { sessionId: initialRuntime.sessionId,
        claimId: initialRuntime.claimId, ownerInstanceId: initialRuntime.ownerInstanceId, diagnostic });
    });
    assert.deepEqual(directive.executionProfile, resolveV3ExecutionProfile("fallback"));
    const retryIntent = { ...value.input.runtimeIntent, sessionId: `${value.input.runtimeIntent.sessionId}-fallback`,
      ownerInstanceId: "native-task11-fallback-success-owner" };
    const retry = await claimStep(agentId, value.input.callerGatewayAgent, retryIntent);
    assert.equal(retry.found, true, JSON.stringify({ retry, state: await publicationDiagnostics(value) }));
    assert.equal(retry.runId, value.runId);
    assert.ok(retry.attempt && retry.claimId && retry.v3ImplementationHandoff && retry.runtimeSessionId);
    const handoff = V3ImplementationClaimHandoffSchema.parse(retry.v3ImplementationHandoff);
    assert.equal(handoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    if (handoff.schema !== "setfarm.v3-implementation-claim-handoff.v2") assert.fail("real fallback claim must be native");
    assert.deepEqual(handoff.executionAuthority, { role: "developer", attemptClass: "infrastructure_retry" });
    assert.deepEqual(handoff.executionProfile, directive.executionProfile);
    assert.deepEqual(handoff.operationalRetry, directive);
    const fallback = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: handoff.storyId,
      attemptId: retry.attempt.attemptId });
    assert.equal(fallback.attempt.attemptClass, "infrastructure_retry");
    assert.equal(fallback.attempt.role, "developer");
    assert.equal(fallback.attempt.claimId, retry.claimId);
    assert.equal(fallback.attempt.generation, origin.attempt.generation + 1);
    assert.equal(fallback.sliceHash, origin.sliceHash);
    assert.equal(fallback.evidencePlanArtifactHash, origin.evidencePlanArtifactHash);
    assert.deepEqual(fallback.sourceBefore, origin.sourceBefore);
    const fallbackWriteAuthority = createV3ImplementationContext({ handoff }).writeAuthority;
    const initialWriteAuthority = createV3ImplementationContext({ handoff: initialHandoff }).writeAuthority;
    assert.equal(initialWriteAuthority.mode, "initial");
    assert.equal(fallbackWriteAuthority.mode, "operational_retry");
    assert.deepEqual(fallbackWriteAuthority.allowedPaths, initialWriteAuthority.allowedPaths);
    const retryRuntime = await sessions.findById(retry.runtimeSessionId);
    assert.ok(retryRuntime);
    assert.equal(retryRuntime.state, "reserved");
    assert.equal(retryRuntime.runtimeKind, "local_process");
    assert.equal(retryRuntime.claimId, retry.claimId);
    assert.equal(retryRuntime.attemptId, fallback.attempt.attemptId);
    assert.equal(retryRuntime.ownerInstanceId, retry.runtimeOwnerInstanceId);
    assert.equal(handoff.workdir, fallback.attempt.worktree);
    assert.equal(handoff.branch, fallback.attempt.branch);
    const envelope = ClaimEnvelopeV1Schema.parse({ schema: "setfarm.claim-envelope.v1", protocol: "v3",
      issuedAt: new Date().toISOString(), runId: retry.runId, stepId: retry.stepId,
      workflowStepId: retry.workflowStepId, storyId: retry.storyId, storyDbId: retry.storyDbId,
      claimId: retry.claimId, claimGeneration: retry.claimGeneration,
      claimAgentId: retryRuntime.claimAgentId, runtimeAgentId: retryRuntime.runtimeAgentId,
      workdir: handoff.workdir, repo: value.repo, attempt: retry.attempt });
    const completed = await completeNeverStartedNativeSession(value, { compiled: fallback, handoff, envelope,
      sessionId: retryRuntime.sessionId, ownerInstanceId: retryRuntime.ownerInstanceId },
    (dependent ? NATIVE_JOIN_API_SOURCE : NATIVE_JOIN_CLI_SOURCE) + "// genuine operational fallback candidate\n");
    const acceptedRows = await database.sql<Array<{ attempt_id: string; attempt_class: string; disposition: string;
      output_hash: string; output: string; state: string; apply_phase: string; claim_outcome: string;
      actual_claim_outcome: string; runtime_state: string }>>`
      SELECT a.attempt_id,a.attempt_class,a.disposition,a.output_hash,q.output,q.state,q.apply_phase,q.claim_outcome,
        c.outcome AS actual_claim_outcome,r.state AS runtime_state
      FROM execution_attempts a JOIN claim_log c ON c.id=a.claim_id
      JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=a.claim_id AND q.output_hash=a.output_hash
      JOIN runtime_sessions r ON r.session_id=q.runtime_session_id AND r.claim_id=a.claim_id AND r.attempt_id=a.attempt_id
      WHERE a.attempt_id=${fallback.attempt.attemptId}`;
    assert.equal(acceptedRows.length, 1);
    const accepted = acceptedRows[0]!;
    assert.equal(accepted.attempt_class, "infrastructure_retry");
    assert.equal(accepted.disposition, "verified");
    assert.equal(accepted.state, "accepted");
    assert.equal(accepted.apply_phase, "effects_committed");
    assert.equal(accepted.claim_outcome, "completed");
    assert.equal(accepted.actual_claim_outcome, accepted.claim_outcome);
    assert.equal(accepted.runtime_state, "released");
    const canonicalModelOutputHash = createHash("sha256").update(accepted.output, "utf8").digest("hex");
    assert.equal(accepted.output_hash, canonicalModelOutputHash);
    assert.equal(JSON.parse(accepted.output).attemptId, fallback.attempt.attemptId);
    const bundleRows = await database.sql`SELECT evidence_bundle_hash,payload FROM evidence_bundles
      WHERE attempt_id=${fallback.attempt.attemptId}`;
    assert.equal(bundleRows.length, 1);
    const { EvidenceBundleV2Schema, computeEvidenceBundleHash } = await import("../../src/evidence/evidence-bundle-v2.js");
    const bundle = EvidenceBundleV2Schema.parse(bundleRows[0]!.payload);
    assert.equal(bundle.aggregateVerdict, "pass");
    assert.equal(bundle.attemptId, fallback.attempt.attemptId);
    assert.equal(bundle.sliceHash, fallback.sliceHash);
    assert.deepEqual(bundle.sourceRevision, { sha: completed.candidateSource.source_after_sha,
      treeHash: completed.candidateSource.source_after_tree_hash });
    assert.equal(computeEvidenceBundleHash(bundle), bundleRows[0]!.evidence_bundle_hash);
    assert.ok(bundle.predicates.length > 0 && bundle.predicates.every(predicate => !predicate.required || predicate.verdict === "pass"));
    const originalRows = await database.sql`SELECT a.disposition,c.outcome,r.state,
      (SELECT count(*)::integer FROM runtime_completion_requests q WHERE q.attempt_id=a.attempt_id) AS requests
      FROM execution_attempts a JOIN claim_log c ON c.id=a.claim_id
      JOIN runtime_sessions r ON r.attempt_id=a.attempt_id AND r.claim_id=a.claim_id
      WHERE a.attempt_id=${origin.attempt.attemptId}`;
    assert.deepEqual(originalRows.map(row => ({ ...row })),
      [{ disposition: "inconclusive", outcome: "infra_retry", state: "released", requests: 0 }]);
    assert.deepEqual((await database.sql`SELECT claim_id::text,attempt_id,slice_hash
      FROM v3_preparation_authority_attempts_v2 WHERE authority_hash=${initialHandoff.nativeAuthority.authorityHash}`)
      .map(row => ({ ...row })), initialBindings.map(row => ({ ...row })));
    assert.deepEqual(await countEffects(value), { claims: 2, attempts: 2, bindings: 2, runtimes: 2 });
    if(dependent) {
      await continueNativeDependencyReview(value,agentId,"infrastructure_retry",false);
      return;
    }
    const workflow = await database.sql`SELECT r.status AS run_status,r.accepted_candidate_hash,
      story.status AS story_status,i.status AS implement_status,s.status AS supervise_status
      FROM runs r JOIN stories story ON story.id=${value.input.storyDbId}
      JOIN steps i ON i.id=${value.admission.implementStepDbId}
      JOIN steps s ON s.id=${superviseStepDbId} WHERE r.id=${value.runId}`;
    assert.equal(workflow.length, 1);
    assert.ok(["done", "verified"].includes(workflow[0]!.story_status));
    assert.deepEqual({ run_status: workflow[0]!.run_status, accepted_candidate_hash: workflow[0]!.accepted_candidate_hash,
      implement_status: workflow[0]!.implement_status, supervise_status: workflow[0]!.supervise_status },
    { run_status: "running", accepted_candidate_hash: null, implement_status: "done", supervise_status: "pending" });
    assert.notEqual(completed.candidateSource.source_after_sha, origin.sourceBefore.sha);

    const { createPostgresTerminalDependencyAttemptReader } = await import("../../src/execution/v3-preparation-eligibility.js");
    const readTerminal = createPostgresTerminalDependencyAttemptReader(database.sql, {
      artifactRoot: value.artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS,
    });
    const locator = { runId: value.runId, stepId: "implement", packetHash: value.packet.packetHash, storyIds: [handoff.storyId] };
    const terminal = await readTerminal(locator);
    // Expected first missing-readback RED only after genuine acceptance above.
    assert.equal(terminal.length, 1, "accepted model fallback must remain an eligible native dependency");
    assert.equal(terminal[0]!.attemptId, fallback.attempt.attemptId);
    assert.equal(terminal[0]!.disposition, "verified");
    assert.ok(terminal[0]!.nativeAuthority);
    assert.equal(terminal[0]!.nativeAuthority.attemptClass, "infrastructure_retry");
    assert.equal(terminal[0]!.nativeAuthority.outputHash, canonicalModelOutputHash,
      "fallback dependency keeps model canonical output bytes as its output-hash domain");
    assert.deepEqual(terminal[0]!.nativeAuthority.sourceAfter, {
      sha: completed.candidateSource.source_after_sha, treeHash: completed.candidateSource.source_after_tree_hash });
    const acceptedLocator = { runId: value.runId, storyId: handoff.storyId, attemptId: fallback.attempt.attemptId };
    const originalLocator = { runId: value.runId, storyId: handoff.storyId, attemptId: origin.attempt.attemptId };
    const acceptedContext = await loadV3ImplementationAttemptContext(acceptedLocator);
    const originalContext = await loadV3ImplementationAttemptContext(originalLocator);
    const beforeReadback = await countEffects(value);
    const worktrees = new Map([[initialHandoff.branch, initialHandoff.workdir], [handoff.branch, handoff.workdir]]);
    for (const [branch, workdir] of worktrees) {
      assert.equal(await realpath(path.dirname(workdir)), await realpath(path.join(value.repo, ".worktrees")),
        "only actual fixture-owned story worktrees may be cleaned");
      removeStoryWorktree(value.repo, branch, agentId);
      await assert.rejects(stat(workdir), { code: "ENOENT" });
    }
    const git = (args: string[]) => execFileSync("git", ["--no-replace-objects", ...args],
      { cwd: value.repo, encoding: "utf8", stdio: "pipe", timeout: 10_000 }).trim();
    const retainedTip = git(["rev-parse", "--verify", "--end-of-options", `${handoff.branch}^{commit}`]);
    assert.equal(git(["merge-base", "--is-ancestor", completed.candidateSource.source_after_sha, retainedTip]), "");
    assert.equal(git(["rev-parse", `${completed.candidateSource.source_after_sha}^{tree}`]),
      completed.candidateSource.source_after_tree_hash);
    assert.equal(git(["rev-parse", `${origin.sourceBefore.sha}^{tree}`]), origin.sourceBefore.treeHash);
    assert.deepEqual(await loadV3ImplementationAttemptContext(acceptedLocator), acceptedContext,
      "accepted fallback must reload its exact operational origin after production cleanup");
    assert.deepEqual(await loadV3ImplementationAttemptContext(originalLocator), originalContext,
      "original inconclusive custody remains readable through its actual accepted model successor");
    assert.deepEqual(await readTerminal(locator), terminal);
    assert.deepEqual(await countEffects(value), beforeReadback);

    // Ordinary continuation selected this supervisor stage. Its real claim owns
    // subject publication; the test supplies no story/final-product subject.
    const supervisorIntent = { ...value.input.runtimeIntent, sessionId: `${value.input.runtimeIntent.sessionId}-supervise`,
      ownerInstanceId: "native-task11-fallback-supervisor-owner" };
    const supervisor = await claimStep(supervisorAgentId, value.input.callerGatewayAgent, supervisorIntent);
    assert.equal(supervisor.found, true, JSON.stringify({ supervisor, state: await publicationDiagnostics(value) }));
    assert.equal(supervisor.runId, value.runId);
    assert.equal(supervisor.workflowStepId, "supervise");
    assert.equal(supervisor.stepId, superviseStepDbId);
    assert.ok(supervisor.claimId && supervisor.runtimeSessionId);
    assert.equal(supervisor.attempt, undefined);
    const supervisorRuntime = await sessions.findById(supervisor.runtimeSessionId);
    assert.ok(supervisorRuntime);
    assert.equal(supervisorRuntime.claimId, supervisor.claimId);
    assert.equal(supervisorRuntime.state, "reserved");
    const supervisorEnvelope = ClaimEnvelopeV1Schema.parse({ schema: "setfarm.claim-envelope.v1", protocol: "v3",
      issuedAt: new Date().toISOString(), runId: supervisor.runId, stepId: supervisor.stepId,
      workflowStepId: supervisor.workflowStepId, claimId: supervisor.claimId,
      claimAgentId: supervisorRuntime.claimAgentId, runtimeAgentId: supervisorRuntime.runtimeAgentId });
    const { readAuthenticatedSubscriptionSuperviseContractsV1 } =
      await import("../../src/execution/subscription-supervise-contracts-v1.js");
    const contracts = await readAuthenticatedSubscriptionSuperviseContractsV1(supervisorEnvelope, supervisorRuntime.sessionId);
    assert.equal(contracts.rows.length, 1);
    assert.equal(contracts.rows[0]!.attempt_id, fallback.attempt.attemptId);
    assert.equal(contracts.rows[0]!.story_db_id, value.input.storyDbId);
    assert.equal(contracts.contexts.length, 1);
    assert.equal(contracts.contexts[0]!.sliceHash, fallback.sliceHash);
    assert.deepEqual(contracts.contexts[0]!.slice, fallback.slice);
    assert.deepEqual(await countEffects(value), beforeReadback,
      "readonly supervisor resolution must not allocate another implementation owner");
    const supervisorRequests = await database.sql`SELECT request_id FROM runtime_completion_requests
      WHERE claim_id=${supervisor.claimId}`;
    assert.equal(supervisorRequests.length, 0, "this probe does not complete or fabricate supervisor evidence");
  }

  it("native Task11 accepted operational fallback remains the model source owner after cleanup", async () => {
    await runNativeFallbackReviewScenario();
  });

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
  }>, candidate: string | Readonly<Record<string,string>>) {
    const { compiled, handoff, envelope, sessionId, ownerInstanceId } = input;
    const sessions = createRuntimeSessionRepository(database.sql);
    const context = createV3ImplementationContext({ handoff });
    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    assert.equal(handoff.storyId, envelope.storyId);
    assert.equal(compiled.attempt.storyId, handoff.storyId);
    const candidateFiles=typeof candidate==="string"
      ? {[context.writeAuthority.allowedPaths[0]!]:candidate}:candidate;
    if(typeof candidate==="string") assert.equal(context.writeAuthority.allowedPaths.length,1,
      "the default bounded probe requires exactly one authentic writable file");
    assert.ok(Object.keys(candidateFiles).length>0);
    for(const [candidatePath,contents] of Object.entries(candidateFiles)) {
      assert.ok(context.writeAuthority.allowedPaths.includes(candidatePath),"test candidate must use actual write grants");
      await writeFile(path.join(envelope.workdir,candidatePath),contents);
    }
    assert.deepEqual(await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: handoff.storyId,
      attemptId: compiled.attempt.attemptId }), compiled,
      "actual after-edit reload must reproduce immutable original/current recovery authority");
    const proposal = { schema: "setfarm.v3-implementation-agent-proposal.v1",
      disposition: "ready_for_evidence", handoffHash: context.handoffHash,
      attemptId: compiled.attempt.attemptId, packetHash: value.packet.packetHash,
      sliceHash: compiled.sliceHash, sourceBefore: compiled.sourceBefore,
      summary: "Native owned candidate probe; no selected worker was started",
      changes: Object.keys(candidateFiles).sort().map(candidatePath=>({path:candidatePath,summary:"Scoped product implementation candidate"})) };
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

  async function runNativeRefreshReviewScenario(mode:"control"|"dependent_repair"|"later_refresh") {
    const value = await fixture(mode === "control" ? "task11-native-evidence-only" : `task11-review-${mode}`, true, false, true, true);
    if(mode !== "control") await database.sql`INSERT INTO steps (
      id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,retry_count,max_retries
    ) VALUES (${`${value.runId}-supervise-step`},${value.runId},'supervise','feature-dev_supervisor',5,
      'Review the exact accepted native product.','','waiting','single',0,3)`;
    assert.ok(value.evidencePreload);
    await assert.rejects(stat(value.evidencePreload), { code: "ENOENT" });
    // Only the typed HTTP server command receives NODE_OPTIONS. Real build runs
    // normally; absent fixture-owned preload makes the real server exit before
    // readiness. No bundle, finding, verdict or accepted row is fabricated.
    const completed = await completeNeverStartedNativeCandidate(value,
      NATIVE_JOIN_API_SOURCE + "// candidate for genuine infrastructure evidence retry\n");
    const { createRecoveryDeliveryRepository } = await import("../../src/recovery/recovery-delivery-repository.js");
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const delivery = await deliveries.findActiveForStory({ runId: value.runId, storyId: "US-001" });
    assert.ok(delivery, JSON.stringify(completed.result));
    const dispatch = await deliveries.findDispatch(delivery.dispatchId);
    assert.ok(dispatch);
    assert.equal(dispatch.dispatchClass, "evidence_only", "actual canonical inconclusive producer must select non-model recovery");
    const revision = await deliveries.findRevision(dispatch.revisionId);
    assert.ok(revision);
    assert.equal(revision.owner, "infrastructure");
    assert.equal(revision.expectedDelta.kind, "evidence_refresh");
    assert.deepEqual(revision.allowedPaths, []);
    assert.deepEqual(revision.sourceRevision, { sha: completed.candidateSource.source_after_sha,
      treeHash: completed.candidateSource.source_after_tree_hash });
    const { createFindingRecoveryRepository } = await import("../../src/recovery/finding-recovery-repository.js");
    const findings = createFindingRecoveryRepository(database.sql);
    const failedFindings = await findings.findFindingSet(dispatch.findingSetHash);
    assert.ok(failedFindings);
    const observedBundleHashes = new Set(failedFindings.findings.flatMap(finding => finding.observedEvidenceRefs));
    assert.equal(observedBundleHashes.size, 1, "the real failed completion must retain exactly one canonical inconclusive bundle");
    for (const hash of observedBundleHashes) {
      const bundle = await findings.findEvidenceBundle(hash);
      assert.ok(bundle);
      assert.equal(bundle.aggregateVerdict, "inconclusive");
      const buildPredicates = bundle.predicates.filter(predicate => predicate.invariantRef === "INV_COMMAND_BUILD");
      assert.ok(buildPredicates.length > 0, "a missing build observation cannot qualify evidence-only recovery");
      assert.ok(buildPredicates.every(predicate => predicate.verdict === "pass"));
    }
    const before = await countEffects(value);
    // Use the real failed-completion cleanup before the independent verifier.
    // The runtime must restore only this exact candidate in the original owned path.
    const { removeStoryWorktree: removeOriginalEvidenceWorktree } = await import("../../src/installer/worktree-ops.js");
    removeOriginalEvidenceWorktree(value.repo, value.branch, value.input.claimAgentId);
    await assert.rejects(stat(value.worktree), { code: "ENOENT" });
    const retainedBeforeVerification = execFileSync("git", ["rev-parse", "--verify", "--end-of-options", `${value.branch}^{commit}`], {
      cwd: value.repo, encoding: "utf8", timeout: 10_000, stdio: "pipe",
    }).trim();
    // Repair only external test infrastructure. Candidate bytes/commit and
    // immutable native contract remain exactly the producer's pinned source.
    await writeFile(value.evidencePreload, "// owned evidence infrastructure restored\n", { flag: "wx" });
    const { createV3EvidenceOnlyRecoveryWorker } = await import("../../src/recovery/v3-evidence-only-worker.js");
    const { createV3EvidenceOnlyRuntimeDependencies } = await import("../../src/recovery/v3-evidence-only-runtime.js");
    const worker = createV3EvidenceOnlyRecoveryWorker(database.sql, createV3EvidenceOnlyRuntimeDependencies(database.sql));
    const lease = await worker.acquireNext({ workflowId: "feature-dev",
      ownerInstanceId: "native-task11-nonmodel-evidence-owner", leaseMs: 30_000 });
    assert.ok(lease);
    assert.equal(lease.mode, "fresh_execution");
    assert.equal(lease.runId, value.runId);
    assert.equal(lease.dispatchId, dispatch.dispatchId);
    assert.equal(lease.revisionId, revision.revisionId);
    assert.deepEqual(lease.sourceRevision, revision.sourceRevision);
    assert.equal(lease.contractSliceHash, completed.compiled.sliceHash);
    assert.equal(lease.priorEvidencePlanArtifactHash, completed.compiled.evidencePlanArtifactHash);
    assert.notDeepEqual(lease.sourceRevision, completed.compiled.sourceBefore,
      "real candidate source differs from the immutable original native slice base");
    let result: Awaited<ReturnType<typeof worker.runLease>>;
    try {
      result = await worker.runLease(lease);
    } catch (error) {
      // Emit only bounded direct error fields before the owned runner buffers
      // the final test diagnostic. Preserve the exact rejection and stack.
      const fields = (value: unknown) => value instanceof Error
        ? { name: value.name.slice(0, 120), message: value.message.slice(0, 800),
          ...("code" in value && typeof value.code === "string" ? { code: value.code.slice(0, 160) } : {}) }
        : { name: "NonError", message: typeof value === "string" ? value.slice(0, 800) : "non-Error rejection" };
      const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
      console.error("[native-evidence-only] runLease failed", JSON.stringify({
        error: fields(error), ...(cause === undefined ? {} : { cause: fields(cause) }),
      }));
      throw error;
    }
    assert.equal(result.execution, "executed");
    assert.equal(result.coordinator.status, "resolved");
    await assert.rejects(stat(value.worktree), { code: "ENOENT" },
      "the exact detached worktree restored for this verifier must be cleaned after evidence");
    const passed = await findings.findEvidenceBundle(result.evidenceBundleHash);
    assert.ok(passed);
    assert.equal(passed.aggregateVerdict, "pass");
    assert.deepEqual(passed.sourceRevision, revision.sourceRevision);
    const { loadV3ImplementationAttemptContext } = await import("../../src/execution/v3-implementation-attempt.js");
    const context = await loadV3ImplementationAttemptContext({ runId: value.runId, storyId: "US-001", attemptId: result.attemptId });
    assert.equal(context.kind, "native-dispatch-ready");
    assert.equal(context.attempt.attemptClass, "evidence_only");
    assert.equal(context.attempt.role, "evidence-orchestrator");
    assert.equal(context.attempt.generation, completed.compiled.attempt.generation + 1);
    assert.deepEqual(context.sourceBefore, revision.sourceRevision);
    assert.deepEqual(context.attempt.sourceAfter, revision.sourceRevision);
    assert.equal(context.sliceHash, completed.compiled.sliceHash);
    assert.deepEqual(context.slice, completed.compiled.slice);
    assert.deepEqual(context.evidencePlan, completed.compiled.evidencePlan);
    assert.equal(context.evidencePlanArtifactHash, completed.compiled.evidencePlanArtifactHash);
    assert.equal((await deliveries.findDelivery(dispatch.dispatchId))?.state, "succeeded");
    assert.ok(context.attempt.claimId && context.attempt.agentId);
    const { createV3RecoveryOwnerLeaseRepository } = await import("../../src/recovery/v3-recovery-owner-lease.js");
    const settledHeartbeat = await createV3RecoveryOwnerLeaseRepository(database.sql).heartbeatNativeTerminalEvidenceOnly({
      kind: "evidence_only", runId: value.runId, storyId: "US-001",
      claimId: context.attempt.claimId, claimAgentId: context.attempt.agentId,
      revisionId: lease.revisionId, dispatchId: lease.dispatchId,
      ownerInstanceId: lease.ownerInstanceId, leaseToken: lease.leaseToken,
      attempt: { attemptId: context.attempt.attemptId, generation: context.attempt.generation,
        fenceToken: context.attempt.fenceToken },
    });
    assert.equal(settledHeartbeat.status, "stale_fence",
      "successful delivery must not regain a lease after its terminal-child continuation");
    const after = await countEffects(value);
    assert.equal(after.attempts, before.attempts + 1);
    assert.equal(after.claims, before.claims + 1);
    assert.equal(after.runtimes, before.runtimes, "evidence-only publication must not allocate a model runtime");
    assert.equal(after.bindings, before.bindings, "initial V2 binding must not be rebound to evidence-only");
    assert.equal(await worker.runNext({ workflowId: "feature-dev",
      ownerInstanceId: "native-task11-nonmodel-evidence-owner" }), undefined);
    assert.deepEqual(await countEffects(value), after);

    // Keep the original producer/counter/replay assertions above complete
    // before any dependent-story owner is allocated.
    const originalOwners = await database.sql<Array<{
      disposition: string; claim_outcome: string; request_state: string;
      apply_phase: string; request_claim_outcome: string; runtime_state: string;
      source_after_sha: string; source_after_tree_hash: string;
    }>>`
      SELECT a.disposition,c.outcome AS claim_outcome,q.state AS request_state,
        q.apply_phase,q.claim_outcome AS request_claim_outcome,r.state AS runtime_state,
        a.source_after_sha,a.source_after_tree_hash
      FROM execution_attempts a
      JOIN claim_log c ON c.id=a.claim_id AND c.run_id=a.run_id AND c.story_id=a.story_id
      JOIN runtime_completion_requests q ON q.attempt_id=a.attempt_id AND q.claim_id=c.id
        AND q.run_id=a.run_id AND q.story_id=a.story_id AND q.output_hash=a.output_hash
      JOIN runtime_sessions r ON r.session_id=q.runtime_session_id AND r.attempt_id=a.attempt_id
        AND r.claim_id=c.id AND r.run_id=a.run_id AND r.story_id=a.story_id
      WHERE a.attempt_id=${completed.compiled.attempt.attemptId} AND a.run_id=${value.runId}
        AND q.request_id=${completed.accepted.requestId}
    `;
    assert.ok(completed.accepted.claimOutcome === "completed" || completed.accepted.claimOutcome === "failed",
      "preserve the original producer's actual accepted claim outcome");
    assert.deepEqual(originalOwners.map(row => ({ ...row })), [{
      disposition: "inconclusive", claim_outcome: completed.accepted.claimOutcome, request_state: "accepted",
      apply_phase: "effects_committed", request_claim_outcome: completed.accepted.claimOutcome, runtime_state: "released",
      source_after_sha: revision.sourceRevision.sha, source_after_tree_hash: revision.sourceRevision.treeHash,
    }], "independent verification must preserve original inconclusive evidence and the actual accepted model outcome");

    const verifierOwners = await database.sql<Array<{
      attempt_class: string; disposition: string; outcome: string; output_hash: string;
      runtimes: number; completions: number; initial_bindings: number;
    }>>`
      SELECT a.attempt_class,a.disposition,c.outcome,a.output_hash,
        (SELECT count(*)::integer FROM runtime_sessions r
          WHERE r.attempt_id=a.attempt_id OR r.claim_id=a.claim_id) AS runtimes,
        (SELECT count(*)::integer FROM runtime_completion_requests q
          WHERE q.attempt_id=a.attempt_id OR q.claim_id=a.claim_id) AS completions,
        (SELECT count(*)::integer FROM v3_preparation_authority_attempts_v2 b
          WHERE b.attempt_id=a.attempt_id OR b.claim_id=a.claim_id) AS initial_bindings
      FROM execution_attempts a JOIN claim_log c ON c.id=a.claim_id
        AND c.run_id=a.run_id AND c.story_id=a.story_id AND c.step_id=a.step_id
      WHERE a.attempt_id=${result.attemptId} AND a.run_id=${value.runId}
    `;
    assert.deepEqual(verifierOwners.map(row => ({ ...row })), [{
      attempt_class: "evidence_only", disposition: "verified", outcome: "completed",
      output_hash: result.evidenceBundleHash, runtimes: 0, completions: 0, initial_bindings: 0,
    }], "canonical nonmodel success must retain its bundle hash and have no model RCR/runtime");

    const projected = await database.sql<Array<{
      story_status: string; merge_status: string | null; claim_generation: number; claimed_by: string | null; claimed_at: string | null;
      step_status: string; step_output: string | null; current_story_id: string | null; run_status: string;
    }>>`
      SELECT st.status AS story_status,st.merge_status,st.claim_generation,st.claimed_by,st.claimed_at,
        s.status AS step_status,s.output AS step_output,s.current_story_id,r.status AS run_status
      FROM stories st JOIN runs r ON r.id=st.run_id
      JOIN steps s ON s.id=${value.admission.implementStepDbId} AND s.run_id=st.run_id
      WHERE st.id=${value.admission.stories[0]!.id} AND st.run_id=${value.runId} AND st.story_id='US-001'
    `;
    assert.equal(projected.length, 1);
    assert.equal(projected[0]!.story_status, "verified",
      "real nonmodel direct continuation must merge before another story can claim");
    assert.equal(projected[0]!.merge_status, "merged");
    const receiptLines = (projected[0]!.step_output ?? "").split("\n")
      .filter(line => line.startsWith("NATIVE_EVIDENCE_OWNER: "));
    assert.equal(receiptLines.length, 1);
    const receipt = JSON.parse(receiptLines[0]!.slice("NATIVE_EVIDENCE_OWNER: ".length));
    assert.equal(receipt.schema, "setfarm.v3-native-evidence-continuation.v1");
    assert.equal(receipt.attemptId, result.attemptId);
    assert.equal(receipt.generation, context.attempt.generation);
    assert.equal(receipt.sourceSha, revision.sourceRevision.sha);
    assert.equal(receipt.sourceTreeHash, revision.sourceRevision.treeHash);
    assert.equal(receipt.evidenceBundleHash, result.evidenceBundleHash);
    assert.ok(receipt.merged.includes("US-001"));
    assert.deepEqual(receipt.conflicted, []);
    assert.equal(receipt.prUrl, null, "pending sibling must not cause a final PR");
    assert.equal(projected[0]!.claim_generation, completed.envelope.claimGeneration);
    assert.equal(projected[0]!.claimed_by, null);
    assert.equal(projected[0]!.claimed_at, null);
    assert.equal(projected[0]!.current_story_id, null);
    assert.ok(["pending", "running"].includes(projected[0]!.step_status));
    assert.equal(projected[0]!.run_status, "running");

    const { createPostgresTerminalDependencyAttemptReader } = await import("../../src/execution/v3-preparation-eligibility.js");
    const readTerminal = createPostgresTerminalDependencyAttemptReader(database.sql, {
      artifactRoot: value.artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS,
    });
    const locator = { runId: value.runId, stepId: "implement", packetHash: value.packet.packetHash, storyIds: ["US-001"] };
    const verified = await readTerminal(locator);
    assert.equal(verified.length, 1);
    assert.equal(verified[0]!.attemptId, result.attemptId,
      "dependency selection must identify the genuine verifier, never relabel the inconclusive source owner");
    assert.equal(verified[0]!.disposition, "verified");
    assert.equal(verified[0]!.sourceAfterSha, revision.sourceRevision.sha);
    assert.equal(verified[0]!.sourceAfterTreeHash, revision.sourceRevision.treeHash);
    const verifiedAuthority = verified[0]!.nativeAuthority;
    assert.ok(verifiedAuthority);
    assert.equal(verifiedAuthority.attemptId, result.attemptId);
    assert.equal(verifiedAuthority.attemptGeneration, context.attempt.generation);
    assert.equal(verifiedAuthority.attemptClass, "evidence_only");
    assert.equal(verifiedAuthority.outputHash, result.evidenceBundleHash);
    assert.equal(verifiedAuthority.sliceHash, completed.compiled.sliceHash);
    assert.deepEqual(verifiedAuthority.sourceAfter, revision.sourceRevision);
    assert.deepEqual(await countEffects(value), after, "terminal authority readback must allocate no owner");

    // Original production cleanup preceded execution; the runtime restored and
    // removed its own detached candidate without changing the retained branch.
    await assert.rejects(stat(value.worktree), { code: "ENOENT" },
      "verified readback must survive actual detached cleanup");
    const git = (args: string[]) => execFileSync("git", args, {
      cwd: value.repo, encoding: "utf8", timeout: 10_000, stdio: "pipe",
    }).trim();
    const retainedTip = git(["rev-parse", "--verify", "--end-of-options", `${value.branch}^{commit}`]);
    assert.match(retainedTip, /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
    assert.equal(retainedTip, retainedBeforeVerification,
      "detached evidence execution and cleanup must preserve the retained source branch");
    assert.equal(git(["merge-base", "--is-ancestor", revision.sourceRevision.sha, "main"]), "",
      "the genuine canonical merge must contain the verified candidate");
    assert.equal(git(["merge-base", "--is-ancestor", revision.sourceRevision.sha, retainedTip]), "");
    assert.equal(git(["rev-parse", `${revision.sourceRevision.sha}^{tree}`]), revision.sourceRevision.treeHash,
      "cleanup tip must not replace the candidate's exact Git tree");
    assert.equal(git(["rev-parse", `${value.sourceBefore.sha}^{tree}`]), value.sourceBefore.treeHash);
    assert.deepEqual(await readTerminal(locator), verified,
      "nonmodel dependency authority and exact signatures must survive real source-worktree cleanup");
    const reloaded = await loadV3ImplementationAttemptContext({
      runId: value.runId, storyId: "US-001", attemptId: result.attemptId,
    });
    assert.deepEqual(reloaded, context, "nonmodel context must retain the original slice/plan and independent candidate");
    assert.deepEqual(await countEffects(value), after);

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
      assert.fail("genuine nonmodel success must enrich the pending second native story");
    assert.equal(prepared.story.story_id, "US-002");
    assert.deepEqual(prepared.nativeAuthority.dependencyAttempts, [verifiedAuthority]);
    assert.equal(prepared.authority.dependencyAttempts[0]?.attemptId, result.attemptId);
    assert.equal(prepared.authority.dependencyAttempts[0]?.attemptClass, "evidence_only");
    assert.deepEqual(await countEffects(value), after, "preclaim may publish readiness, never execution owners");

    if(mode !== "control") {
      await continueNativeDependencyReview(value,value.input.claimAgentId,"evidence_only",mode === "later_refresh");
      return;
    }
    const { claimStep } = await import("../../src/installer/step-ops.js");
    const second = await claimStep(value.input.claimAgentId, value.input.callerGatewayAgent, {
      ...value.input.runtimeIntent, sessionId: `${value.input.runtimeIntent.sessionId}-second`,
      ownerInstanceId: "native-task11-nonmodel-dependent-owner",
    });
    assert.equal(second.found, true, JSON.stringify({ second, state: await publicationDiagnostics(value) }));
    assert.equal(second.runId, value.runId);
    assert.equal(second.storyId, "US-002");
    assert.ok(second.claimId && second.attempt && second.v3ImplementationHandoff && second.runtimeSessionId);
    const handoff = V3ImplementationClaimHandoffSchema.parse(second.v3ImplementationHandoff);
    assert.equal(handoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    if (handoff.schema !== "setfarm.v3-implementation-claim-handoff.v2") assert.fail("native dependent handoff required");
    assert.deepEqual(handoff.nativeAuthority.dependencyAttempts, [verifiedAuthority]);
    assert.equal(handoff.implementationSlice.dependencyOutputs[0]?.outputHash, result.evidenceBundleHash);
    const secondRuntime = await createRuntimeSessionRepository(database.sql).findById(second.runtimeSessionId);
    assert.ok(secondRuntime);
    assert.equal(secondRuntime.claimId, second.claimId);
    assert.equal(secondRuntime.attemptId, second.attempt.attemptId);
    assert.equal(secondRuntime.state, "reserved");
    const secondContext = await loadV3ImplementationAttemptContext({
      runId: value.runId, storyId: "US-002", attemptId: second.attempt.attemptId,
    });
    assert.equal(secondContext.kind, "native-dispatch-ready");
    if (secondContext.kind !== "native-dispatch-ready") assert.fail("native dependent context required");
    assert.deepEqual(secondContext.nativeAuthority.dependencyAttempts, [verifiedAuthority]);
    assert.deepEqual(await countEffects(value), {
      claims: after.claims + 1, attempts: after.attempts + 1,
      bindings: after.bindings + 1, runtimes: after.runtimes + 1,
    });
    // Stop at authentic reservation. No second-story completion, final subject
    // or selected physical worker is manufactured to extend this proof.
  }

  it("native Task11 real evidence-plane unavailability resolves through one unchanged-source non-model lease", async () => {
    await runNativeRefreshReviewScenario("control");
  });

  async function runNativeRoutedExpiryReview(route:"supervise"|"verify") {
    const value=await fixture(`task11-review-route-${route}`,true,false,true,true);
    assert.ok(value.evidencePreload);
    const routeStep=`${value.runId}-${route}-step`;
    // Real frozen route layout is seeded before any original claim/completion.
    await database.sql`UPDATE steps SET loop_config=${JSON.stringify({over:"stories",mergeStrategy:"direct-merge",
      ...(route==="supervise"?{superviseEach:true,superviseStep:"supervise"}:{verifyEach:true,verifyStep:"verify"})})}
      WHERE id=${value.admission.implementStepDbId}`;
    await database.sql`INSERT INTO steps(id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,retry_count,max_retries)
      VALUES(${routeStep},${value.runId},${route},${`feature-dev_${route}`},5,
        'Check the exact accepted story.','','waiting','single',0,3)`;
    await completeNeverStartedNativeCandidate(value,NATIVE_JOIN_API_SOURCE+"// routed evidence refresh candidate\n");
    const {createRecoveryDeliveryRepository}=await import("../../src/recovery/recovery-delivery-repository.js");
    const deliveries=createRecoveryDeliveryRepository(database.sql);
    const delivery=await deliveries.findActiveForStory({runId:value.runId,storyId:"US-001"});assert.ok(delivery);
    await writeFile(value.evidencePreload,"// actual infrastructure restored\n",{flag:"wx"});
    const {createV3EvidenceOnlyRuntimeDependencies}=await import("../../src/recovery/v3-evidence-only-runtime.js");
    const {createV3EvidenceOnlyRecoveryWorker}=await import("../../src/recovery/v3-evidence-only-worker.js");
    const {createV3EvidenceOnlyPublication,prepareNativeEvidenceOnlyContinuation}=await import("../../src/recovery/v3-evidence-only-publication.js");
    const dependencies=createV3EvidenceOnlyRuntimeDependencies(database.sql);
    const worker=createV3EvidenceOnlyRecoveryWorker(database.sql,dependencies);
    const lease=await worker.acquireNext({workflowId:"feature-dev",ownerInstanceId:`${value.runId}-verifier`});assert.ok(lease);
    assert.equal(lease.dispatchId,delivery.dispatchId,JSON.stringify({
      expected:{runId:value.runId,storyId:"US-001",dispatchId:delivery.dispatchId},
      acquired:{runId:lease.runId,storyId:lease.storyId,dispatchId:lease.dispatchId,mode:lease.mode},
    }));
    const context=await dependencies.loadOrReserveAttempt({lease});
    const publicationLease={mode:"fresh_execution" as const,runId:lease.runId,stepDbId:lease.stepDbId,storyDbId:lease.storyDbId,
      storyId:lease.storyId,recoveryCaseId:lease.recoveryCaseId,revisionId:lease.revisionId,dispatchId:lease.dispatchId,
      packetHash:lease.packetHash,contractSliceHash:lease.contractSliceHash,findingSetHash:lease.findingSetHash,
      sourceRevision:lease.sourceRevision,evidencePlan:lease.evidencePlan,
      ...(lease.priorEvidencePlanArtifactHash?{priorEvidencePlanArtifactHash:lease.priorEvidencePlanArtifactHash}:{}),
      ownerInstanceId:lease.ownerInstanceId,leaseToken:lease.leaseToken,leaseExpiresAt:lease.leaseExpiresAt};
    const publication=createV3EvidenceOnlyPublication(database.sql);
    await publication.markRunning({lease:publicationLease,attempt:context.attempt});
    assert.deepEqual(await dependencies.captureSource(context.workdir),lease.sourceRevision);
    const evidence=await dependencies.executeEvidence({lease,context});
    assert.equal(evidence.bundle.aggregateVerdict,"pass");
    assert.deepEqual(await dependencies.captureSource(context.workdir),lease.sourceRevision);
    await publication.completeAttempt({lease:publicationLease,attempt:context.attempt,disposition:"verified",bundle:evidence.bundle});
    const {createAttemptRepository}=await import("../../src/execution/attempt-repository.js");
    const terminal=await createAttemptRepository(database.sql).findById(context.attempt.attemptId);assert.ok(terminal?.claimId&&terminal.agentId);
    await dependencies.completeClaim({lease,attempt:terminal,diagnostic:"Actual canonical terminal verifier before routed expiry probe"});
    const owner={runId:lease.runId,storyId:lease.storyId,packetHash:lease.packetHash,attemptId:terminal.attemptId,
      claimId:terminal.claimId,generation:terminal.generation,fenceToken:terminal.fenceToken,
      revisionId:lease.revisionId,dispatchId:lease.dispatchId,ownerInstanceId:lease.ownerInstanceId,leaseToken:lease.leaseToken};
    assert.equal(await prepareNativeEvidenceOnlyContinuation(database.sql,owner),undefined,
      "frozen supervise/verify route has no direct merge receipt");
    const {createV3RecoveryOwnerLeaseRepository}=await import("../../src/recovery/v3-recovery-owner-lease.js");
    const heartbeat={kind:"evidence_only" as const,runId:lease.runId,storyId:lease.storyId,claimId:terminal.claimId,
      claimAgentId:terminal.agentId,revisionId:lease.revisionId,dispatchId:lease.dispatchId,
      ownerInstanceId:lease.ownerInstanceId,leaseToken:lease.leaseToken,
      attempt:{attemptId:terminal.attemptId,generation:terminal.generation,fenceToken:terminal.fenceToken}};
    const retained=await createV3RecoveryOwnerLeaseRepository(database.sql).heartbeatNativeTerminalEvidenceOnly(heartbeat,{leaseMs:30_000});
    assert.equal(retained.status,"retained");
    if(retained.status!=="retained")assert.fail("actual routed owner must be live before expiry");
    const {createV3RecoveryCoordinator}=await import("../../src/recovery/v3-recovery-coordinator.js");
    const coordinator=createV3RecoveryCoordinator(database.sql);
    const event={kind:"recovery_evidence",recoveryCaseId:lease.recoveryCaseId,revisionId:lease.revisionId,
      dispatchId:lease.dispatchId,attemptId:terminal.attemptId,slice:context.slice,sliceHash:context.sliceHash,
      evidencePlan:context.evidencePlan,evidencePlanArtifactHash:context.evidencePlanArtifactHash,evidenceBundle:evidence.bundle};
    const before=await deliveries.findDelivery(lease.dispatchId);
    // Hold precisely the existing coordinator owner lock, without touching run,
    // attempt, delivery or case rows. The coordinator starts while its lease is
    // live and must recheck DB time only after this real lock wait finishes.
    const ownerKey=`setfarm:v3-recovery:${lease.runId}:${lease.storyId}`;
    let releaseOwner:()=>void=()=>undefined;
    const releaseGate=new Promise<void>(resolve=>{releaseOwner=resolve;});
    let reportOwner:(pid:number)=>void=()=>undefined;
    const ownerHeld=new Promise<number>(resolve=>{reportOwner=resolve;});
    const holding=database.sql.begin(async tx=>{
      await tx.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",[ownerKey]);
      const rows=await tx.unsafe<Array<{pid:number}>>("SELECT pg_backend_pid() AS pid");
      reportOwner(rows[0]!.pid);
      await releaseGate;
    });
    const blockerPid=await Promise.race([ownerHeld,holding.then(()=>{throw Error("REVIEW_OWNER_LOCK_NOT_HELD");})]);
    let coordination:Promise<{status:"resolved";value:Awaited<ReturnType<typeof coordinator.coordinate>>}|{status:"rejected";error:unknown}>|undefined;
    try {
      const live=await database.sql<Array<{live:boolean}>>`SELECT lease_expires_at>clock_timestamp() AS live
        FROM recovery_dispatch_deliveries WHERE dispatch_id=${lease.dispatchId}`;
      assert.equal(live[0]?.live,true,"coordination must enter while the real owner lease is live");
      coordination=coordinator.coordinate(event).then(value=>({status:"resolved" as const,value}),error=>({status:"rejected" as const,error}));
      let blocked=false;
      const waitDeadline=Date.now()+5_000;
      while(!blocked&&Date.now()<waitDeadline) {
        const waiting=await database.sql<Array<{pid:number;query:string}>>`
          SELECT waiting.pid,activity.query FROM pg_locks waiting
          JOIN pg_locks held ON held.locktype=waiting.locktype AND held.database IS NOT DISTINCT FROM waiting.database
            AND held.classid=waiting.classid AND held.objid=waiting.objid AND held.objsubid=waiting.objsubid
          JOIN pg_stat_activity activity ON activity.pid=waiting.pid
          WHERE held.pid=${blockerPid} AND held.granted AND waiting.locktype='advisory'
            AND NOT waiting.granted AND waiting.pid<>held.pid`;
        blocked=waiting.some(row=>row.query.includes("pg_advisory_xact_lock(hashtextextended("));
        if(!blocked)await new Promise(resolve=>setTimeout(resolve,25));
      }
      assert.equal(blocked,true,"actual coordinator must be observed waiting behind the exact held owner lock");
      await new Promise(resolve=>setTimeout(resolve,Math.max(1,Date.parse(retained.expiresAt)-Date.now()+30)));
      const expired=await database.sql<Array<{expired:boolean}>>`SELECT lease_expires_at<=clock_timestamp() AS expired
        FROM recovery_dispatch_deliveries WHERE dispatch_id=${lease.dispatchId}`;
      assert.equal(expired[0]?.expired,true,"real DB-clock lease must expire before owner lock release");
    } finally {
      releaseOwner();
      await holding;
      // Always observe any started coordinator before test/database cleanup.
      if(coordination)await coordination;
    }
    assert.ok(coordination);
    const outcome=await coordination;
    assert.equal(outcome.status,"rejected","expired-at-commit routed owner must not settle after a live-entry lock wait");
    if(outcome.status!=="rejected")assert.fail("expired routed coordination unexpectedly committed");
    assert.match(String(outcome.error),/LEASE|EXPIRED|STALE|AUTHORITY/);
    assert.deepEqual(await deliveries.findDelivery(lease.dispatchId),before);
    const target=await database.sql<Array<{status:string}>>`SELECT status FROM steps WHERE id=${routeStep}`;
    assert.equal(target[0]?.status,"waiting");
    const replay=await worker.acquireNext({workflowId:"feature-dev",ownerInstanceId:`${value.runId}-replay`});assert.ok(replay);
    assert.equal(replay.dispatchId,lease.dispatchId);assert.equal(replay.mode,"coordinator_replay");
    const resumed=await worker.runLease(replay);
    assert.equal(resumed.execution,"replayed");assert.equal(resumed.coordinator.status,"resolved");
    const effects=await countEffects(value);
    assert.deepEqual(await coordinator.coordinate(event),resumed.coordinator);
    assert.deepEqual(await countEffects(value),effects,"settled replay cannot mint another verifier or lease");
  }

  async function continueNativeDependencyReview(value:Awaited<ReturnType<typeof fixture>>,agentId:string,
    expectedDependency:"product_implementation"|"evidence_only"|"infrastructure_retry",laterRefresh:boolean) {
    const {claimStep}=await import("../../src/installer/step-ops.js");
    const {loadV3ImplementationAttemptContext}=await import("../../src/execution/v3-implementation-attempt.js");
    const sessions=createRuntimeSessionRepository(database.sql);
    const second=await claimStep(agentId,value.input.callerGatewayAgent,{...value.input.runtimeIntent,
      sessionId:`${value.input.runtimeIntent.sessionId}-dependent`,ownerInstanceId:`${value.runId}-dependent`});
    assert.equal(second.found,true,JSON.stringify({second,state:await publicationDiagnostics(value)}));
    assert.equal(second.storyId,"US-002");
    assert.ok(second.attempt&&second.claimId&&second.v3ImplementationHandoff&&second.runtimeSessionId);
    const handoff=V3ImplementationClaimHandoffSchema.parse(second.v3ImplementationHandoff);
    if(handoff.schema!=="setfarm.v3-implementation-claim-handoff.v2")assert.fail("genuine dependent native handoff required");
    assert.equal(handoff.nativeAuthority.dependencyAttempts[0]?.attemptClass,expectedDependency);
    const originalNotes=await readFile(path.join(handoff.workdir,"src/notes.ts"),"utf8");
    const context=await loadV3ImplementationAttemptContext({runId:value.runId,storyId:"US-002",attemptId:second.attempt.attemptId});
    const runtime=await sessions.findById(second.runtimeSessionId);assert.ok(runtime);
    const envelope=ClaimEnvelopeV1Schema.parse({schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:new Date().toISOString(),
      runId:value.runId,stepId:second.stepId,workflowStepId:second.workflowStepId,storyId:second.storyId,storyDbId:second.storyDbId,
      claimId:second.claimId,claimGeneration:second.claimGeneration,claimAgentId:runtime.claimAgentId,runtimeAgentId:runtime.runtimeAgentId,
      workdir:handoff.workdir,repo:value.repo,attempt:second.attempt});
    await completeNeverStartedNativeSession(value,{compiled:context,handoff,envelope,
      sessionId:runtime.sessionId,ownerInstanceId:runtime.ownerInstanceId},"export const brokenNotes = ;\n");
    const {createRecoveryDeliveryRepository}=await import("../../src/recovery/recovery-delivery-repository.js");
    const deliveries=createRecoveryDeliveryRepository(database.sql);
    const failed=await deliveries.findActiveForStory({runId:value.runId,storyId:"US-002"});assert.ok(failed);
    const dispatch=await deliveries.findDispatch(failed.dispatchId);assert.ok(dispatch);
    assert.equal(dispatch.dispatchClass,"product_implementation");
    const repair=await claimStep("feature-dev_developer",value.input.callerGatewayAgent,{...value.input.runtimeIntent,
      sessionId:`${value.input.runtimeIntent.sessionId}-dependent-repair`,ownerInstanceId:`${value.runId}-dependent-repair`},
      {workflowId:"feature-dev",recoveryDispatchClass:"product_implementation"});
    assert.equal(repair.found,true,JSON.stringify({repair,state:await publicationDiagnostics(value)}));
    assert.ok(repair.attempt&&repair.claimId&&repair.v3ImplementationHandoff&&repair.runtimeSessionId);
    assert.equal(repair.runId,value.runId);assert.equal(repair.storyId,"US-002");
    const repairHandoff=V3ImplementationClaimHandoffSchema.parse(repair.v3ImplementationHandoff);
    if(repairHandoff.schema!=="setfarm.v3-implementation-claim-handoff.v2")assert.fail("genuine dependent repair required");
    assert.equal(repairHandoff.nativeAuthority.dependencyAttempts[0]?.attemptClass,expectedDependency);
    assert.deepEqual(repairHandoff.implementationSlice.dependencyOutputs,handoff.implementationSlice.dependencyOutputs);
    const repairContext=await loadV3ImplementationAttemptContext({runId:value.runId,storyId:"US-002",attemptId:repair.attempt.attemptId});
    const repairRuntime=await sessions.findById(repair.runtimeSessionId);assert.ok(repairRuntime);
    const repairEnvelope=ClaimEnvelopeV1Schema.parse({schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:new Date().toISOString(),
      runId:value.runId,stepId:repair.stepId,workflowStepId:repair.workflowStepId,storyId:repair.storyId,storyDbId:repair.storyDbId,
      claimId:repair.claimId,claimGeneration:repair.claimGeneration,claimAgentId:repairRuntime.claimAgentId,runtimeAgentId:repairRuntime.runtimeAgentId,
      workdir:repairHandoff.workdir,repo:value.repo,attempt:repair.attempt});
    if(laterRefresh) {assert.ok(value.evidencePreload);await rm(value.evidencePreload);}
    const completed=await completeNeverStartedNativeSession(value,{compiled:repairContext,handoff:repairHandoff,envelope:repairEnvelope,
      sessionId:repairRuntime.sessionId,ownerInstanceId:repairRuntime.ownerInstanceId},originalNotes+"// genuine dependent repair\n");
    if(!laterRefresh) {assert.equal(completed.accepted.state,"accepted");return;}
    assert.ok(value.evidencePreload);
    const next=await deliveries.findActiveForStory({runId:value.runId,storyId:"US-002"});assert.ok(next);
    const nextDispatch=await deliveries.findDispatch(next.dispatchId);assert.ok(nextDispatch);
    const nextRevision=await deliveries.findRevision(next.revisionId);assert.ok(nextRevision);
    assert.equal(nextDispatch.dispatchClass,"evidence_only");
    assert.ok(nextRevision.revisionNumber>1,"actual source repair must advance the real recovery revision");
    assert.equal(nextRevision.contractSliceHash,repairContext.sliceHash);
    assert.deepEqual(nextRevision.sourceRevision,{sha:completed.candidateSource.source_after_sha,treeHash:completed.candidateSource.source_after_tree_hash});
    await writeFile(value.evidencePreload,"// genuine infrastructure restored after repair\n",{flag:"wx"});
    const {createV3EvidenceOnlyRecoveryWorker}=await import("../../src/recovery/v3-evidence-only-worker.js");
    const {createV3EvidenceOnlyRuntimeDependencies}=await import("../../src/recovery/v3-evidence-only-runtime.js");
    const worker=createV3EvidenceOnlyRecoveryWorker(database.sql,createV3EvidenceOnlyRuntimeDependencies(database.sql));
    const lease=await worker.acquireNext({workflowId:"feature-dev",ownerInstanceId:`${value.runId}-later-refresh`});assert.ok(lease);
    assert.equal(lease.dispatchId,next.dispatchId);
    const result=await worker.runLease(lease);assert.equal(result.coordinator.status,"resolved");
    const refreshed=await loadV3ImplementationAttemptContext({runId:value.runId,storyId:"US-002",attemptId:result.attemptId});
    assert.equal(refreshed.sliceHash,repairContext.sliceHash);
    assert.equal(refreshed.evidencePlanArtifactHash,repairContext.evidencePlanArtifactHash);
    assert.deepEqual(refreshed.sourceBefore,nextRevision.sourceRevision);
    assert.equal(refreshed.attempt.attemptClass,"evidence_only");
    assert.equal(refreshed.attempt.generation,repairContext.attempt.generation+1);
  }

  async function runNativeRepairReviewScenario(mode:"control"|"renewed_lease"|"repair_final") {
    const value = await fixture(mode === "control" ? "task11-owned-repair" : `task11-review-${mode}`, false, true, true);
    // This probe accepts the repaired story, not the entire product. Seed the
    // actual downstream workflow shape before publishing any implementation
    // owner, as in v3-implementation-continuation.integration.test.ts.
    const finalStepDbId = `${value.runId}-final-test-step`;
    if(mode === "repair_final") await database.sql`INSERT INTO steps (
      id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,retry_count,max_retries
    ) VALUES (${finalStepDbId},${value.runId},'final-test','feature-dev_final-tester',5,
      'Validate the exact repaired native product.','','waiting','single',0,3)`;
    const superviseStepDbId = `${value.runId}-supervise-step`;
    await database.sql`INSERT INTO steps (
      id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,retry_count,max_retries
    ) VALUES (
      ${superviseStepDbId},${value.runId},'supervise','feature-dev_supervisor',${mode === 'repair_final' ? 6 : 5},
      'Review the accepted native implementation.','','waiting','single',0,3
    )`;
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
      schema: "setfarm.runtime-claim-intent.v1", sessionId: mode === "control" ? "RTS_native-task11-real-recovery-successor" : nativeJoinRuntimeSessionId(`task11-recovery-${mode}`),
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
    if(mode === "renewed_lease") {
      assert.ok(fresh.leaseToken && fresh.ownerInstanceId && fresh.leaseExpiresAt && successor.claimId);
      const publicationBefore = await database.sql<Array<{ handoff_canonical_json:string; handoff_hash:string }>>`
        SELECT handoff_canonical_json,handoff_hash FROM internal_production_v3_recovery_claim_publications_v1
        WHERE claim_id=${successor.claimId}`;
      assert.equal(publicationBefore.length,1);
      const sessions=createRuntimeSessionRepository(database.sql);
      const starting=await sessions.markStarting({sessionId:repairRuntime.sessionId,
        ownerInstanceId:repairRuntime.ownerInstanceId,worktree:handoff.workdir,
        recoveryFence:{revisionId:revision.revisionId,dispatchId:dispatch.dispatchId,
          leaseToken:fresh.leaseToken,attempt:successor.attempt}});
      assert.equal(starting.state,"starting");
      assert.equal(starting.pid,undefined,"only a genuine start-intent row; no worker is fabricated");
      const {createV3RecoveryOwnerLeaseRepository}=await import("../../src/recovery/v3-recovery-owner-lease.js");
      const ownerLeases=createV3RecoveryOwnerLeaseRepository(database.sql);
      const heartbeat={kind:"model_runtime" as const,runId:value.runId,storyId:"US-001",
        claimId:successor.claimId,claimAgentId:repairRuntime.claimAgentId,
        runtimeSessionId:repairRuntime.sessionId,revisionId:revision.revisionId,dispatchId:dispatch.dispatchId,
        ownerInstanceId:fresh.ownerInstanceId,leaseToken:fresh.leaseToken,
        attempt:successor.attempt};
      const retained=await ownerLeases.heartbeat(heartbeat,{leaseMs:30_000});
      assert.equal(retained.status,"retained");
      const renewed=await deliveries.findDelivery(dispatch.dispatchId);
      assert.ok(renewed?.leaseExpiresAt);
      assert.notEqual(renewed.leaseExpiresAt,fresh.leaseExpiresAt,"the actual heartbeat must change the published receipt's expiry");
      assert.deepEqual(await database.sql`SELECT handoff_canonical_json,handoff_hash
        FROM internal_production_v3_recovery_claim_publications_v1 WHERE claim_id=${successor.claimId}`,publicationBefore);
      assert.equal((await ownerLeases.heartbeat({...heartbeat,leaseToken:lease.leaseToken})).status,"stale_fence");
      assert.equal((await ownerLeases.heartbeat({...heartbeat,ownerInstanceId:lease.ownerInstanceId})).status,"stale_fence");
      const reloaded=await loadV3ImplementationAttemptContext({runId:value.runId,storyId:"US-001",attemptId:successor.attempt.attemptId});
      assert.equal(reloaded.sliceHash,repairContext.sliceHash);
      assert.equal(reloaded.evidencePlanArtifactHash,repairContext.evidencePlanArtifactHash);
      await new Promise(resolve=>setTimeout(resolve,Math.max(1,Date.parse(renewed.leaseExpiresAt!)-Date.now()+30)));
      assert.equal((await ownerLeases.heartbeat(heartbeat)).status,"stale_fence");
      await assert.rejects(loadV3ImplementationAttemptContext({runId:value.runId,storyId:"US-001",attemptId:successor.attempt.attemptId}),
        /V3_NATIVE_RECOVERY_|LEASE|STALE/);
      return;
    }
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
    const workflow = await database.sql`SELECT r.status AS run_status,r.accepted_candidate_hash,
      i.status AS implement_status,s.status AS supervise_status,s.current_story_id,
      (SELECT count(*)::integer FROM claim_log c WHERE c.run_id=r.id AND c.step_id='supervise') AS supervise_claims
      FROM runs r JOIN steps i ON i.run_id=r.id AND i.step_id='implement'
      JOIN steps s ON s.id=${superviseStepDbId} WHERE r.id=${value.runId}`;
    assert.equal(workflow.length, 1);
    assert.deepEqual({ ...workflow[0]! }, { run_status: "running", accepted_candidate_hash: null,
      implement_status: "done", supervise_status: mode === "repair_final" ? "waiting" : "pending", current_story_id: null, supervise_claims: 0 });
    if(mode === "repair_final") {
      const {publishSingleClaimRuntime}=await import("../../src/execution/claim-runtime-publication.js");
      const parent=await publishSingleClaimRuntime(database.sql,{runId:value.runId,stepDbId:finalStepDbId,
        workflowStepId:"final-test",claimAgentId:"feature-dev_final-tester",runtimeIntent:{...value.input.runtimeIntent,
          sessionId:`${value.input.runtimeIntent.sessionId}-final`,ownerInstanceId:"native-task11-repaired-final-parent"}});
      assert.ok(parent);
      const rows=await database.sql<Array<{context:string}>>`SELECT context FROM runs WHERE id=${value.runId}`;
      const finalContext:Record<string,string>=JSON.parse(rows[0]!.context);
      const {createPostgresV3DownstreamEvidenceRouter}=await import("../../src/recovery/v3-downstream-evidence-router.js");
      const route=await createPostgresV3DownstreamEvidenceRouter(database.sql).route({runId:value.runId,
        stepDbId:finalStepDbId,workflowStepId:"final-test",phase:"final",parentClaimId:parent.claimId,
        worktree:finalContext.repo!,branch:finalContext.branch!,intent:"final_acceptance"});
      assert.equal(route.status,"accepted_candidate_ready",JSON.stringify(route));
      if(route.status!=="accepted_candidate_ready")assert.fail("real repaired final matrix required");
      const {createAcceptedCandidateRepository}=await import("../../src/evidence/accepted-candidate-repository.js");
      const candidates=createAcceptedCandidateRepository({sql:database.sql,artifactRoot:value.artifactRoot,artifactLimits:NATIVE_JOIN_LIMITS});
      const candidate=await candidates.publish({runId:value.runId,sourceRevision:route.sourceRevision,
        storyEvidence:route.stories.map(story=>({storyId:story.storyId,attemptId:story.attemptId,
          evidencePlanArtifactHash:story.evidencePlanArtifactHash,evidenceBundleHash:story.evidenceBundleHash}))});
      assert.equal(candidate.created,true);
      assert.deepEqual(await candidates.findByRun(value.runId),candidate.candidate);
    }
    // No final-product/supervisor subject or selected physical closure is
    // manufactured by successful SQL/canonical evidence completion.
  }

  it("native Task11 owned failed candidate creates genuine delivery before the native successor boundary", async () => {
    await runNativeRepairReviewScenario("control");
  });

  async function runNativeFinalReviewScenario(mode:"control"|"shared_writer"|"single_pool"|"later_refresh") {
    const value = await fixture(mode === "control" ? "task11-owned-dependency" : `task11-review-${mode}`, true, false, true,
      mode === "later_refresh", mode === "shared_writer");
    if(mode === "later_refresh") {
      assert.ok(value.evidencePreload);
      await writeFile(value.evidencePreload,"// infrastructure available for real initial model predecessor\n",{flag:"wx"});
    }
    // Existing producer fixture layout, seeded before any implementation owner.
    // This is the final evidence API boundary, not a claimed physical workflow.
    const finalStepDbId = `${value.runId}-final-test-step`;
    await database.sql`INSERT INTO steps (
      id,run_id,step_id,agent_id,step_index,input_template,expects,status,type,retry_count,max_retries
    ) VALUES (
      ${finalStepDbId},${value.runId},'final-test','feature-dev_final-tester',5,
      'Validate the exact completed native product.','','waiting','single',0,3
    )`;
    const completed = await completeNeverStartedNativeCandidate(value, NATIVE_JOIN_API_SOURCE + "// scoped task implementation\n");
    const mergedStory = await database.sql<Array<{ status: string; merge_status: string | null }>>`
      SELECT status,merge_status FROM stories WHERE run_id=${value.runId} AND story_id='US-001'
    `;
    assert.deepEqual(mergedStory.map(row => ({ ...row })), [{ status: "verified", merge_status: "merged" }],
      "the real model completion owner must canonically merge before the next story publication");
    assert.equal(execFileSync("git", ["merge-base", "--is-ancestor", completed.candidateSource.source_after_sha, "main"], {
      cwd: value.repo, encoding: "utf8", timeout: 10_000, stdio: "pipe",
    }).trim(), "");
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

    // Continue from the same genuine accepted predecessor. The actual caller
    // must select, authenticate, provision and publish US-002; no fixture row
    // or run base is rewritten to make a dependent claim succeed.
    const { claimStep } = await import("../../src/installer/step-ops.js");
    const secondIntent = { ...value.input.runtimeIntent,
      sessionId: `${value.input.runtimeIntent.sessionId}-second`,
      ownerInstanceId: "native-task11-second-owner" };
    const selectionBefore = await publicationDiagnostics(value);
    if(mode === "later_refresh") {
      await continueNativeDependencyReview(value,value.input.claimAgentId,"product_implementation",true);
      return;
    }
    const second = await claimStep(value.input.claimAgentId, value.input.callerGatewayAgent, secondIntent);
    const blocks = await database.sql`SELECT phase,error_code,detail FROM v3_preparation_blocks
      WHERE run_id=${value.runId} ORDER BY opened_at,block_id`;
    const observations = await database.sql`SELECT phase,check_id,summary,detail,evidence FROM run_observations
      WHERE run_id=${value.runId} ORDER BY created_at,id`;
    const fixtureLog = !second.found && process.env.SETFARM_DB_PATH
      ? await readFile(path.join(path.dirname(process.env.SETFARM_DB_PATH), "logs/workflow.log"), "utf8").catch(() => "")
      : "";
    assert.equal(second.found, true, JSON.stringify({ second, blocks, observations, selectionBefore,
      fixtureLogTail: fixtureLog.slice(-12_000), state: await publicationDiagnostics(value) }));
    assert.equal(second.storyId, prepared.story.story_id);
    assert.ok(second.claimId && second.attempt && second.v3ImplementationHandoff && second.runtimeSessionId);
    const handoff = V3ImplementationClaimHandoffSchema.parse(second.v3ImplementationHandoff);
    assert.equal(handoff.schema, "setfarm.v3-implementation-claim-handoff.v2");
    if (handoff.schema !== "setfarm.v3-implementation-claim-handoff.v2") assert.fail("native second-story handoff required");
    const ownedRelative = path.relative(ownedHostConfigRoot, await realpath(handoff.workdir));
    assert.ok(ownedRelative && !ownedRelative.startsWith("..") && !path.isAbsolute(ownedRelative),
      "actual canonical developer worktree must remain under the owned home fixture");
    const selectedStory = value.packet.storyPlan.stories.find(story => story.id === handoff.storyId);
    assert.ok(selectedStory);
    assert.deepEqual(handoff.implementationSlice.story, selectedStory);
    assert.ok(selectedStory.actionRefs.length > 0);
    assert.ok(selectedStory.actionRefs.every(ref => value.packet.productSpec.actions.some(action => action.id === ref)));
    const agentContext = createV3ImplementationContext({ handoff });
    assert.deepEqual([...agentContext.writeAuthority.allowedPaths].sort(), mode === "shared_writer"
      ? ["src/index.ts","src/notes.ts"] : ["src/notes.ts"]);
    assert.ok(handoff.implementationSlice.files.some(file => file.path === "src/index.ts"
      && file.role === (mode === "shared_writer" ? "shared_writable" : "shared_readonly")));
    const secondRuntime = await createRuntimeSessionRepository(database.sql).findById(second.runtimeSessionId);
    assert.ok(secondRuntime);
    assert.equal(secondRuntime.attemptId, second.attempt.attemptId);
    assert.equal(secondRuntime.claimId, second.claimId);
    const secondContext = await loadV3ImplementationAttemptContext({ runId: value.runId,
      storyId: handoff.storyId, attemptId: second.attempt.attemptId });
    const secondEnvelope = ClaimEnvelopeV1Schema.parse({ schema: "setfarm.claim-envelope.v1", protocol: "v3",
      issuedAt: new Date().toISOString(), runId: value.runId, stepId: second.stepId,
      workflowStepId: second.workflowStepId, storyId: second.storyId, storyDbId: second.storyDbId,
      claimId: second.claimId, claimGeneration: second.claimGeneration,
      claimAgentId: secondRuntime.claimAgentId, runtimeAgentId: secondRuntime.runtimeAgentId,
      workdir: handoff.workdir, repo: value.repo, attempt: second.attempt });
    const originalOwned = await readFile(path.join(handoff.workdir, agentContext.writeAuthority.allowedPaths[0]!), "utf8");
    // Preserve actual API behavior and selected action semantics. Only the real
    // owned module receives a scoped delta; canonical HTTP evidence decides.
    const candidateContents=mode === "shared_writer" ? Object.fromEntries(await Promise.all(
      agentContext.writeAuthority.allowedPaths.map(async file=>[file,
        await readFile(path.join(handoff.workdir,file),"utf8")+`// Accepted writer ${handoff.storyId} for ${file}\n`])))
      : originalOwned + `// Accepted native component ${handoff.storyId}\n`;
    let secondCompletion:Awaited<ReturnType<typeof completeNeverStartedNativeSession>>;
    if(mode === "shared_writer") {
      if(typeof candidateContents === "string") assert.fail("shared writer requires its actual two-path candidate");
      // B genuinely produces the shared app delta, but its owned notes fail the
      // actual API build. No accepted row, source finding or repair grant is seeded.
      const failed=await completeNeverStartedNativeSession(value,{
        compiled:secondContext,handoff,envelope:secondEnvelope,
        sessionId:secondRuntime.sessionId,ownerInstanceId:secondRuntime.ownerInstanceId,
      },{...candidateContents,"src/notes.ts":"export const brokenNotes = ;\n"});
      assert.equal(failed.accepted.state,"accepted","model completion acceptance is distinct from product evidence success");
      const initialSharedCandidate=execFileSync("git",["--no-replace-objects","show",`${failed.candidateSource.source_after_sha}:src/index.ts`],
        {cwd:value.repo,encoding:"utf8",stdio:"pipe"});
      assert.equal(initialSharedCandidate,candidateContents["src/index.ts"],
        "B's shared app write must enter its immutable candidate before any repair");
      const ownerApp=before[0]!.nativeAuthority!.fileSignatures.find(file=>file.path==="src/index.ts");assert.ok(ownerApp);
      assert.notEqual(createHash("sha256").update(initialSharedCandidate).digest("hex"),ownerApp.contentHash,
        "this is a genuine later shared write, not the earlier owner's unchanged blob");
      const {createRecoveryDeliveryRepository}=await import("../../src/recovery/recovery-delivery-repository.js");
      const deliveries=createRecoveryDeliveryRepository(database.sql);
      const delivery=await deliveries.findActiveForStory({runId:value.runId,storyId:"US-002"});assert.ok(delivery);
      const dispatch=await deliveries.findDispatch(delivery.dispatchId);assert.ok(dispatch);
      const revision=await deliveries.findRevision(delivery.revisionId);assert.ok(revision);
      assert.equal(dispatch.dispatchClass,"product_implementation");
      const repair=await claimStep(value.input.claimAgentId,value.input.callerGatewayAgent,{...value.input.runtimeIntent,
        sessionId:`${value.input.runtimeIntent.sessionId}-shared-repair`,ownerInstanceId:`${value.runId}-shared-repair`},
        {workflowId:"feature-dev",recoveryDispatchClass:"product_implementation"});
      assert.equal(repair.found,true,JSON.stringify({repair,state:await publicationDiagnostics(value)}));
      assert.equal(repair.runId,value.runId);assert.equal(repair.storyId,"US-002");
      assert.ok(repair.attempt&&repair.claimId&&repair.runtimeSessionId&&repair.v3ImplementationHandoff);
      const repairHandoff=V3ImplementationClaimHandoffSchema.parse(repair.v3ImplementationHandoff);
      if(repairHandoff.schema!=="setfarm.v3-implementation-claim-handoff.v2")assert.fail("real native repair required");
      const repairAuthority=createV3ImplementationContext({handoff:repairHandoff});
      assert.deepEqual([...repairAuthority.writeAuthority.allowedPaths].sort(),[...revision.allowedPaths].sort(),
        "retain actual compiler/finding-derived authority; never fabricate a notes-only grant");
      const repairContext=await loadV3ImplementationAttemptContext({runId:value.runId,storyId:"US-002",attemptId:repair.attempt.attemptId});
      assert.deepEqual(repairContext.sourceBefore,{sha:failed.candidateSource.source_after_sha,treeHash:failed.candidateSource.source_after_tree_hash});
      const repairRuntime=await createRuntimeSessionRepository(database.sql).findById(repair.runtimeSessionId);assert.ok(repairRuntime);
      const repairEnvelope=ClaimEnvelopeV1Schema.parse({schema:"setfarm.claim-envelope.v1",protocol:"v3",issuedAt:new Date().toISOString(),
        runId:value.runId,stepId:repair.stepId,workflowStepId:repair.workflowStepId,storyId:repair.storyId,storyDbId:repair.storyDbId,
        claimId:repair.claimId,claimGeneration:repair.claimGeneration,claimAgentId:repairRuntime.claimAgentId,
        runtimeAgentId:repairRuntime.runtimeAgentId,workdir:repairHandoff.workdir,repo:value.repo,attempt:repair.attempt});
      assert.equal(await readFile(path.join(repairHandoff.workdir,"src/index.ts"),"utf8"),candidateContents["src/index.ts"]);
      secondCompletion=await completeNeverStartedNativeSession(value,{compiled:repairContext,handoff:repairHandoff,envelope:repairEnvelope,
        sessionId:repairRuntime.sessionId,ownerInstanceId:repairRuntime.ownerInstanceId},
        {"src/notes.ts":candidateContents["src/notes.ts"]+"// genuine notes-only repair preserves the shared app writer\n"});
      const acceptedRows=await database.sql<Array<{output:string}>>`SELECT output FROM runtime_completion_requests
        WHERE attempt_id=${repair.attempt.attemptId} AND claim_id=${repair.claimId}
          AND state='accepted' AND apply_phase='effects_committed'`;
      assert.equal(acceptedRows.length,1);
      const {V3ImplementationAgentOutputV1Schema}=await import("../../src/execution/v3-implementation-output.js");
      const repairOutput=V3ImplementationAgentOutputV1Schema.parse(JSON.parse(acceptedRows[0]!.output));
      if(repairOutput.disposition!=="ready_for_evidence")assert.fail("real accepted model repair output required");
      assert.deepEqual(repairOutput.changes.map(change=>change.path),["src/notes.ts"]);
      const productDelta=execFileSync("git",["--no-replace-objects","diff","--name-only",repairContext.sourceBefore.sha,
        secondCompletion.candidateSource.source_after_sha,"--","src/index.ts","src/notes.ts"],
        {cwd:value.repo,encoding:"utf8",stdio:"pipe"}).trim();
      assert.equal(productDelta,"src/notes.ts","only the notes source changes during repair");
      const retainedApp=execFileSync("git",["--no-replace-objects","show",`${secondCompletion.candidateSource.source_after_sha}:src/index.ts`],
        {cwd:value.repo,encoding:"utf8",stdio:"pipe"});
      assert.equal(retainedApp,candidateContents["src/index.ts"]);
    } else {
      secondCompletion = await completeNeverStartedNativeSession(value, {
        compiled: secondContext, handoff, envelope: secondEnvelope,
        sessionId: secondRuntime.sessionId, ownerInstanceId: secondRuntime.ownerInstanceId,
      }, candidateContents);
    }
    assert.equal(secondCompletion.accepted.state, "accepted");
    const stories = await database.sql<Array<{ story_id: string; status: string }>>`
      SELECT story_id,status FROM stories WHERE run_id=${value.runId} ORDER BY story_index`;
    assert.deepEqual(stories.map(story => story.story_id), value.packet.storyPlan.stories.map(story => story.id));
    assert.ok(stories.every(story => story.status === "done" || story.status === "verified"), JSON.stringify(stories));
    const finalSteps = await database.sql<Array<{ status: string }>>`SELECT status FROM steps WHERE id=${finalStepDbId}`;
    assert.equal(finalSteps[0]?.status, "pending", "real implementation continuation must advance the downstream stage");

    // Real parent publication and production child evidence/candidate producers.
    // This is SQL/API acceptance proof; no final tester/supervisor was started,
    // no smoke response is fabricated, and the parent remains uncompleted.
    const { publishSingleClaimRuntime } = await import("../../src/execution/claim-runtime-publication.js");
    const parent = await publishSingleClaimRuntime(database.sql, { runId: value.runId,
      stepDbId: finalStepDbId, workflowStepId: "final-test", claimAgentId: "feature-dev_final-tester",
      runtimeIntent: { ...value.input.runtimeIntent, sessionId: `${value.input.runtimeIntent.sessionId}-final`,
        ownerInstanceId: "native-task11-final-parent-owner" } });
    assert.ok(parent, JSON.stringify(await publicationDiagnostics(value)));
    const current = await database.sql<Array<{ context: string; accepted_candidate_hash: string | null }>>`
      SELECT context,accepted_candidate_hash FROM runs WHERE id=${value.runId}`;
    assert.equal(current[0]?.accepted_candidate_hash, null);
    const finalContext: Record<string, string> = JSON.parse(current[0]!.context);
    assert.equal(finalContext.repo, value.repo);
    assert.ok(finalContext.branch);
    const exactFinal = { sha: git(["rev-parse", "HEAD"]), treeHash: git(["rev-parse", "HEAD^{tree}"]) };
    const { createPostgresV3DownstreamEvidenceRouter } = await import("../../src/recovery/v3-downstream-evidence-router.js");
    const route = await createPostgresV3DownstreamEvidenceRouter(database.sql).route({ runId: value.runId,
      stepDbId: finalStepDbId, workflowStepId: "final-test", phase: "final", parentClaimId: parent.claimId,
      worktree: finalContext.repo, branch: finalContext.branch, intent: "final_acceptance" });
    assert.equal(route.status, "accepted_candidate_ready", JSON.stringify(route));
    if (route.status !== "accepted_candidate_ready") assert.fail("actual complete final evidence matrix required");
    assert.deepEqual(route.sourceRevision, exactFinal);
    if(mode === "shared_writer") {
      if(typeof candidateContents === "string")assert.fail("shared writer candidate map required");
      assert.equal(execFileSync("git",["--no-replace-objects","show",`${exactFinal.sha}:src/index.ts`],
        {cwd:value.repo,encoding:"utf8",stdio:"pipe"}),candidateContents["src/index.ts"],
        "actual integrated final source must retain the authenticated shared writer");
    }
    assert.deepEqual(route.stories.map(story => story.storyId).sort(), stories.map(story => story.story_id).sort());
    const { createAcceptedCandidateRepository } = await import("../../src/evidence/accepted-candidate-repository.js");
    const candidates = createAcceptedCandidateRepository({ sql: database.sql,
      artifactRoot: value.artifactRoot, artifactLimits: NATIVE_JOIN_LIMITS });
    const candidateInput = { runId: value.runId, sourceRevision: route.sourceRevision,
      storyEvidence: route.stories.map(story => ({ storyId: story.storyId, attemptId: story.attemptId,
        evidencePlanArtifactHash: story.evidencePlanArtifactHash, evidenceBundleHash: story.evidenceBundleHash })) };
    let candidate: Awaited<ReturnType<typeof candidates.publish>>;
    if(mode === "single_pool") {
      const {default:postgres}=await import("postgres");
      const singleConnection=postgres(database.url,{max:1,connect_timeout:5,idle_timeout:1});
      const isolatedCandidates=createAcceptedCandidateRepository({sql:singleConnection,
        artifactRoot:value.artifactRoot,artifactLimits:NATIVE_JOIN_LIMITS});
      const publication=isolatedCandidates.publish(candidateInput);
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        candidate=await Promise.race([publication,new Promise<never>((_resolve,reject)=>{
          timer=setTimeout(()=>reject(Error("NATIVE_ACCEPTED_CANDIDATE_NESTED_POOL_WAIT")),10_000);
        })]);
      } finally {
        if(timer)clearTimeout(timer);
        await singleConnection.end({timeout:1});
        await publication.catch(()=>undefined);
      }
    } else candidate = await candidates.publish(candidateInput);
    assert.equal(candidate.created, true);
    assert.deepEqual(await candidates.findByRun(value.runId), candidate.candidate);
    assert.deepEqual(await candidates.publish(candidateInput), { created: false, candidate: candidate.candidate });
    assert.deepEqual({ sha: git(["rev-parse", "HEAD"]), treeHash: git(["rev-parse", "HEAD^{tree}"]) }, exactFinal);
    const parentRows = await database.sql<Array<{ outcome: string | null }>>`SELECT outcome FROM claim_log WHERE id=${parent.claimId}`;
    assert.equal(parentRows[0]?.outcome, null, "this probe does not claim final-stage or physical completion");
  }

  it("native Task11 accepted predecessor survives production cleanup for dependent native enrichment", async () => {
    await runNativeFinalReviewScenario("control");
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

  it("native review R1 repairs a dependent story after an authentic accepted fallback", async () => {
    await runNativeFallbackReviewScenario(true);
  });
  it("native review R1 repairs a dependent story after an authentic nonmodel refresh", async () => {
    await runNativeRefreshReviewScenario("dependent_repair");
  });
  it("native review R7 refreshes evidence after repair with a real model-owned dependency", async () => {
    await runNativeFinalReviewScenario("later_refresh");
  });
  it("native review R4 fences expired supervise routing then accepts live replay", async () => {
    await runNativeRoutedExpiryReview("supervise");
  });
  it("native review R4 fences expired verify routing then accepts live replay", async () => {
    await runNativeRoutedExpiryReview("verify");
  });
  it("native review R3 publishes final candidate with one actual SQL connection", async () => {
    await runNativeFinalReviewScenario("single_pool");
  });
  it("native review R6 authenticates a later sealed shared-writable accepted writer", async () => {
    await runNativeFinalReviewScenario("shared_writer");
  });
  it("native review R5 accepts final evidence after the real generated repair", async () => {
    await runNativeRepairReviewScenario("repair_final");
  });
  it("native review R2 reloads after real recovery renewal and refuses expired or crossed owners", async () => {
    await runNativeRepairReviewScenario("renewed_lease");
  });

});
