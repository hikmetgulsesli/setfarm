import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createV3PreparationClaimAuthorityV1 } from "../../src/execution/v3-preparation-claim-authority.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("typed transient pre-dispatch failure atomically closes ownership and requeues exact work", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const previousDbPath = process.env.SETFARM_DB_PATH;
  const eventRoot = await mkdtemp(path.join(tmpdir(), "setfarm-v3-pre-dispatch-"));
  process.env.SETFARM_DB_PATH = path.join(eventRoot, "setfarm.db");
  const database = await createIsolatedTestDatabase();
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    const { handleV3PreDispatchFailure } = await import("../../src/installer/v3-pre-dispatch-failure.js");
    const runId = "run-v3-pre-dispatch-integration";
    const stepDbId = "step-v3-pre-dispatch-integration";
    const storyDbId = "story-v3-pre-dispatch-integration";
    const storyId = "US-001";
    const releaseSha = "a".repeat(40);
    const packetHash = "b".repeat(64);
    const admissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol, protocol_version,
        compiler_release_sha, activation_preflight_hash, packet_hash,
        release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'pre-dispatch integration', 'running', '{}', 'v3', 1,
        ${releaseSha}, ${"c".repeat(64)}, ${packetHash}, ${admissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, loop_config, current_story_id
      ) VALUES (
        ${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '',
        'running', 'loop', '{"over":"stories","parallel":1}', ${storyDbId}
      )
    `;
    await database.sql`
      INSERT INTO stories (
        id, run_id, story_index, story_id, title, status, claimed_by,
        claimed_at, claim_generation
      ) VALUES (
        ${storyDbId}, ${runId}, 1, ${storyId}, 'Exact transient story', 'running',
        'feature-dev_developer', NOW(), 1
      )
    `;
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
      VALUES (${runId}, 'implement', ${storyId}, 'feature-dev_developer', NOW())
      RETURNING id::integer AS id
    `;
    const authority = createV3PreparationClaimAuthorityV1({
      stateVersion: 1,
      runId,
      stepId: "implement",
      storyId,
      packetHash,
      baseRevision: { sha: "d".repeat(40), treeHash: "e".repeat(40) },
      projectedDependencyIds: [],
      dependencyAttempts: [],
    });

    const disposition = await handleV3PreDispatchFailure({
      step: { id: stepDbId, run_id: runId, step_id: "implement" },
      story: { id: storyDbId, story_id: storyId, title: "Exact transient story" },
      agentId: "feature-dev_developer",
      claimId: claims[0]!.id,
      authority,
      phase: "source",
      error: Object.assign(new Error("temporary worktree timeout"), { code: "ETIMEDOUT" }),
    });
    assert.equal(disposition.disposition, "retry_transient");
    assert.equal(disposition.occurrence, 1);

    const state = await database.sql<Array<{
      run_status: string;
      step_status: string;
      current_story_id: string | null;
      story_status: string;
      claimed_by: string | null;
      claim_outcome: string | null;
      diagnostic: string | null;
      termination_requests: number;
      owner_observations: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             step.current_story_id,
             story.status AS story_status,
             story.claimed_by,
             claim.outcome AS claim_outcome,
             claim.diagnostic,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_requests,
             (SELECT COUNT(*)::integer FROM run_observations
               WHERE run_id = ${runId} AND phase = 'v3-pre-dispatch') AS owner_observations
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
        JOIN stories story ON story.id = ${storyDbId}
        JOIN claim_log claim ON claim.id = ${claims[0]!.id}
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...state[0] }, {
      run_status: "running",
      step_status: "pending",
      current_story_id: null,
      story_status: "pending",
      claimed_by: null,
      claim_outcome: "infra_retry",
      diagnostic: disposition.diagnostic,
      termination_requests: 0,
      owner_observations: 1,
    });
  } finally {
    await runtimeDb?.pgClose();
    await database.cleanup();
    await rm(eventRoot, { recursive: true, force: true });
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
    if (previousDbPath === undefined) delete process.env.SETFARM_DB_PATH;
    else process.env.SETFARM_DB_PATH = previousDbPath;
  }
});
