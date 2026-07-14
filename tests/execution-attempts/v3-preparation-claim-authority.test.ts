import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  publishLoopClaimRuntime,
  publishSingleClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import { releaseReservedRuntimeSessionInTransaction } from "../../src/execution/runtime-session-repository.js";
import { createV3PreparationBlockRepository } from "../../src/execution/v3-preparation-block-repository.js";
import {
  V3PreparationClaimAuthorityError,
  type V3PreparationClaimAuthorityV1,
} from "../../src/execution/v3-preparation-claim-authority.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const PACKET_HASH = "a".repeat(64);
const RELEASE_SHA = "3".repeat(40);
const BASE_SHA = "1".repeat(40);
const BASE_TREE = "2".repeat(40);
const DEPENDENCY_SHA = "4".repeat(40);
const DEPENDENCY_TREE = "5".repeat(40);

function runtimeIntent(sessionId: string) {
  return {
    schema: "setfarm.runtime-claim-intent.v1" as const,
    sessionId,
    runtimeAgentId: "prism",
    runtimeKind: "openclaw_session" as const,
    ownerInstanceId: "preparation-authority-test",
    sessionKey: `key:${sessionId}`,
  };
}

async function seedFixture(
  database: TestDatabase,
  suffix: string,
  options: Readonly<{ dependency?: boolean }> = {},
) {
  const runId = `run-v3-preparation-authority-${suffix}`;
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  const admissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
  await database.sql.unsafe(
    `INSERT INTO runs (
       id, workflow_id, task, status, protocol, protocol_version,
       compiler_release_sha, packet_hash, activation_preflight_hash,
       release_admission_hash
     ) VALUES ($1, 'feature-dev', 'preparation authority test', 'running',
               'v3', 1, $2, $3, $4, $5)`,
    [runId, RELEASE_SHA, PACKET_HASH, "e".repeat(64), admissionHash],
  );
  await database.sql.unsafe(
    `INSERT INTO semantic_artifacts (
       artifact_hash, artifact_type, byte_length, producer_metadata
     ) VALUES ($1, 'setfarm.product-build-packet.v1', 1, $2::text::jsonb)`,
    [PACKET_HASH, JSON.stringify({
      pass: "preparation-authority-test",
      codeSha: RELEASE_SHA,
      toolVersions: { setfarm: "test" },
    })],
  );
  await database.sql.unsafe(
    `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
     VALUES ($1, $2, $3::text::jsonb)`,
    [runId, PACKET_HASH, JSON.stringify({ version: "3.0.0", codeSha: RELEASE_SHA })],
  );
  await database.sql.unsafe(
    `INSERT INTO steps (
       id, run_id, step_id, agent_id, step_index, input_template,
       expects, status, type
     ) VALUES ($1,$2,'implement','feature-dev_developer',1,'','','pending','loop')`,
    [stepDbId, runId],
  );
  const projectedDependencyIds = options.dependency ? ["US-001"] : [];
  await database.sql.unsafe(
    `INSERT INTO stories (
       id, run_id, story_index, story_id, title, status,
       claim_generation, depends_on
     ) VALUES ($1,$2,2,'US-002','Target story','pending',0,$3)`,
    [storyDbId, runId, projectedDependencyIds.length > 0 ? JSON.stringify(projectedDependencyIds) : null],
  );

  let dependencyState: Array<{
    storyId: string;
    state: "ready";
    attemptId: string;
    disposition: "produced_delta";
    sourceAfterSha: string;
    sourceAfterTreeHash: string;
  }> = [];
  if (options.dependency) {
    const dependencyClaimRows = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, outcome)
       VALUES ($1, 'implement', 'US-001', 'feature-dev_developer', 'completed')
       RETURNING id::text AS id`,
      [runId],
    );
    const dependencyClaimId = dependencyClaimRows[0]!.id;
    const attemptId = `ATT_dependency-${suffix.padEnd(16, "x")}`;
    await database.sql.unsafe(
      `INSERT INTO execution_attempts (
         attempt_id, run_id, step_id, story_id, generation, fence_token,
         attempt_class, packet_hash, compilation_report_hash,
         source_before_sha, source_before_tree_hash,
         source_after_sha, source_after_tree_hash,
         role, agent_id, lease_acquired_at, lease_expires_at, heartbeat_at,
         disposition, evidence_refs, claim_id
       ) VALUES (
         $1,$2,'implement','US-001',1,$3,'supervisor_repair',$4,$5,
         $6,$7,$8,$9,'supervisor','feature-dev_supervisor',
         NOW(),NOW() + INTERVAL '5 minutes',NOW(),'produced_delta',$10,$11::bigint
       )`,
      [
        attemptId,
        runId,
        "f".repeat(64),
        PACKET_HASH,
        "b".repeat(64),
        "6".repeat(40),
        "7".repeat(40),
        DEPENDENCY_SHA,
        DEPENDENCY_TREE,
        JSON.stringify([`setfarm://claim-log/${dependencyClaimId}`]),
        dependencyClaimId,
      ],
    );
    dependencyState = [{
      storyId: "US-001",
      state: "ready",
      attemptId,
      disposition: "produced_delta",
      sourceAfterSha: DEPENDENCY_SHA,
      sourceAfterTreeHash: DEPENDENCY_TREE,
    }];
  }
  return { runId, stepDbId, storyDbId, projectedDependencyIds, dependencyState };
}

async function prepare(
  database: TestDatabase,
  fixture: Awaited<ReturnType<typeof seedFixture>>,
  sourceTreeHash = BASE_TREE,
): Promise<V3PreparationClaimAuthorityV1> {
  const result = await createV3PreparationBlockRepository(database.sql).resolveReady({
    runId: fixture.runId,
    stepId: "implement",
    storyId: "US-002",
    packetHash: PACKET_HASH,
    sourceSha: BASE_SHA,
    sourceTreeHash,
    dependencyState: fixture.dependencyState,
    projectedDependencyIds: fixture.projectedDependencyIds,
  });
  assert.ok(result.authority);
  return result.authority;
}

function publicationInput(
  fixture: Awaited<ReturnType<typeof seedFixture>>,
  authority: V3PreparationClaimAuthorityV1,
  sessionId: string,
) {
  return {
    runId: fixture.runId,
    stepDbId: fixture.stepDbId,
    workflowStepId: "implement",
    storyDbId: fixture.storyDbId,
    storyId: "US-002",
    claimAgentId: "feature-dev_developer",
    callerGatewayAgent: "prism",
    parallelLimit: 1,
    runtimeIntent: runtimeIntent(sessionId),
    preparationAuthority: authority,
  } as const;
}

describe("v3 preparation claim authority", () => {
  it("claims exact ready state, dependency attempts, story and runtime atomically", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedFixture(database, "exact", { dependency: true });
      const authority = await prepare(database, fixture);
      const publication = await publishLoopClaimRuntime(
        database.sql,
        publicationInput(fixture, authority, "RTS_preparation-exact-01"),
      );
      assert.ok(publication);
      assert.equal(publication.claimAuthority?.mode, "preparation");
      assert.deepEqual(publication.baseRevision, { sha: BASE_SHA, treeHash: BASE_TREE });
      const rows = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        state: string;
        state_version: number;
        state_claim_id: string;
        claim_count: number;
        runtime_count: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               state.state,
               state.state_version,
               state.claim_id::text AS state_claim_id,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${fixture.runId} AND story_id = 'US-002') AS claim_count,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${fixture.runId}) AS runtime_count
          FROM stories story
          JOIN v3_preparation_story_state state
            ON state.run_id = story.run_id AND state.story_id = story.story_id
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        story_status: "running",
        claim_generation: 1,
        state: "claimed",
        state_version: 1,
        state_claim_id: String(publication.claimId),
        claim_count: 1,
        runtime_count: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects missing, forged, stale and dependency-drifted authority before ownership", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedFixture(database, "stale", { dependency: true });
      const authority = await prepare(database, fixture);
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          ...publicationInput(fixture, authority, "RTS_preparation-missing-01"),
          preparationAuthority: undefined,
        }),
        (error: unknown) => error instanceof V3PreparationClaimAuthorityError
          && error.code === "V3_PREPARATION_PUBLICATION_AUTHORITY_REQUIRED",
      );
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, publicationInput(fixture, {
          ...authority,
          baseRevision: { ...authority.baseRevision, treeHash: "9".repeat(40) },
        }, "RTS_preparation-forged-01")),
        /authority hash/i,
      );

      const newer = await prepare(database, fixture, "8".repeat(40));
      assert.equal(newer.stateVersion, authority.stateVersion + 1);
      await assert.rejects(
        publishLoopClaimRuntime(
          database.sql,
          publicationInput(fixture, authority, "RTS_preparation-stale-01"),
        ),
        (error: unknown) => error instanceof V3PreparationClaimAuthorityError
          && error.code === "V3_PREPARATION_PUBLICATION_AUTHORITY_STALE",
      );

      await database.sql.unsafe(
        `UPDATE execution_attempts
            SET source_after_tree_hash = $2
          WHERE attempt_id = $1`,
        [newer.dependencyAttempts[0]!.attemptId, "0".repeat(40)],
      );
      await assert.rejects(
        publishLoopClaimRuntime(
          database.sql,
          publicationInput(fixture, newer, "RTS_preparation-drift-01"),
        ),
        (error: unknown) => error instanceof V3PreparationClaimAuthorityError
          && error.code === "V3_PREPARATION_PUBLICATION_DEPENDENCY_ATTEMPT_MISMATCH",
      );
      const counts = await database.sql<Array<{ claims: number; sessions: number }>>`
        SELECT (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${fixture.runId} AND story_id = 'US-002') AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${fixture.runId}) AS sessions
      `;
      assert.deepEqual({ ...counts[0] }, { claims: 0, sessions: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("allows exactly one concurrent claimant for one ready generation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedFixture(database, "race");
      const authority = await prepare(database, fixture);
      const results = await Promise.allSettled([
        publishLoopClaimRuntime(
          database.sql,
          publicationInput(fixture, authority, "RTS_preparation-race-left"),
        ),
        publishLoopClaimRuntime(
          database.sql,
          publicationInput(fixture, authority, "RTS_preparation-race-right"),
        ),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled" && Boolean(result.value)).length, 1);
      assert.equal(results.filter((result) => result.status === "rejected").length, 1);
      const rejection = results.find((result) => result.status === "rejected");
      assert.ok(rejection?.status === "rejected");
      assert.ok(rejection.reason instanceof V3PreparationClaimAuthorityError);
      assert.equal(rejection.reason.code, "V3_PREPARATION_PUBLICATION_AUTHORITY_STALE");
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back ready state, story and claim when runtime reservation fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const duplicateSessionId = "RTS_preparation-runtime-rollback";
      const ownerRunId = "run-preparation-runtime-owner";
      await database.insertRun(ownerRunId);
      const ownerStepDbId = `${ownerRunId}-step`;
      await database.sql.unsafe(
        `INSERT INTO steps (
           id, run_id, step_id, agent_id, step_index, input_template, expects, status
         ) VALUES ($1,$2,'plan','feature-dev_planner',1,'','','pending')`,
        [ownerStepDbId, ownerRunId],
      );
      await publishSingleClaimRuntime(database.sql, {
        runId: ownerRunId,
        stepDbId: ownerStepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(duplicateSessionId),
      });

      const fixture = await seedFixture(database, "rollback");
      const authority = await prepare(database, fixture);
      await assert.rejects(
        publishLoopClaimRuntime(
          database.sql,
          publicationInput(fixture, authority, duplicateSessionId),
        ),
        /duplicate key value|unique constraint/i,
      );
      const rows = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        step_status: string;
        state: string;
        state_claim_id: string | null;
        target_claims: number;
        target_sessions: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               step.status AS step_status,
               state.state,
               state.claim_id::text AS state_claim_id,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${fixture.runId} AND story_id = 'US-002') AS target_claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions
                 WHERE run_id = ${fixture.runId}) AS target_sessions
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
          JOIN v3_preparation_story_state state
            ON state.run_id = story.run_id AND state.story_id = story.story_id
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        story_status: "pending",
        claim_generation: 0,
        step_status: "pending",
        state: "ready",
        state_claim_id: null,
        target_claims: 0,
        target_sessions: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rearms only a terminal infra_retry claim as a new ready generation", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedFixture(database, "rearm");
      const firstAuthority = await prepare(database, fixture);
      const first = await publishLoopClaimRuntime(
        database.sql,
        publicationInput(fixture, firstAuthority, "RTS_preparation-rearm-first"),
      );
      assert.ok(first?.runtime);
      await database.sql.unsafe(
        `UPDATE stories SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [fixture.storyDbId],
      );
      await assert.rejects(
        prepare(database, fixture),
        (error: unknown) => error instanceof V3PreparationClaimAuthorityError
          && error.code === "V3_PREPARATION_PRIOR_CLAIM_ACTIVE",
      );
      await database.sql.unsafe(
        `UPDATE claim_log SET outcome = 'infra_retry' WHERE id = $1`,
        [first!.claimId],
      );
      await releaseReservedRuntimeSessionInTransaction(database.sql, {
        sessionId: first!.runtime!.sessionId,
        claimId: first!.claimId,
        ownerInstanceId: first!.runtime!.ownerInstanceId,
        diagnostic: "test terminal infra retry before worktree/runtime start",
      });

      const secondAuthority = await prepare(database, fixture);
      assert.equal(secondAuthority.stateVersion, firstAuthority.stateVersion + 1);
      const second = await publishLoopClaimRuntime(
        database.sql,
        publicationInput(fixture, secondAuthority, "RTS_preparation-rearm-second"),
      );
      assert.ok(second);
      assert.equal(second.claimGeneration, 2);
      const rows = await database.sql<Array<{
        state: string;
        state_version: number;
        claim_id: string;
        claims: number;
      }>>`
        SELECT state.state, state.state_version, state.claim_id::text AS claim_id,
               (SELECT COUNT(*)::integer FROM claim_log
                 WHERE run_id = ${fixture.runId} AND story_id = 'US-002') AS claims
          FROM v3_preparation_story_state state
         WHERE state.run_id = ${fixture.runId} AND state.story_id = 'US-002'
      `;
      assert.deepEqual({ ...rows[0] }, {
        state: "claimed",
        state_version: 2,
        claim_id: String(second.claimId),
        claims: 2,
      });
    } finally {
      await database.cleanup();
    }
  });
});
