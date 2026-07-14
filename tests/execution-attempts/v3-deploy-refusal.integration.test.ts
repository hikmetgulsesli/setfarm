import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { publishSingleClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import { completeV3DeployAuthorityRefusal } from "../../src/execution/v3-deploy-refusal.js";
import { V3DeployAuthorityError } from "../../src/execution/v3-deploy-authority.js";
import { createRunTerminationRepository } from "../../src/execution/run-termination.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { rethrowV3DeployAuthorityAfterObservation } from "../../src/installer/steps/11-deploy/preclaim.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("deploy authority failure becomes compiler-owned terminal refusal with zero model redispatch", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  try {
    const runId = "run-v3-deploy-refusal";
    const stepDbId = "step-v3-deploy-refusal";
    const claimAgentId = "feature-dev_deployer";
    const runtimeAgentId = "deployer-runtime";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'deploy accepted candidate', 'running',
        ${JSON.stringify({ task: "deploy accepted candidate" })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${stepDbId}, ${runId}, 'deploy', ${claimAgentId}, 11, '', '',
        'running', 'single', 0, 3
      )
    `;
    const claims = await database.sql<Array<{ id: number }>>`
      INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
      VALUES (${runId}, 'deploy', NULL, ${claimAgentId})
      RETURNING id::integer AS id
    `;
    const claimId = claims[0]!.id;
    const sessions = createRuntimeSessionRepository(database.sql);
    const session = await sessions.reserve({
      sessionId: "RTS_v3-deploy-refusal-session",
      runId,
      stepDbId,
      workflowStepId: "deploy",
      claimId,
      claimAgentId,
      runtimeAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "spawner-test",
    });
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1",
      protocol: "v3",
      issuedAt: "2026-07-13T12:00:00.000Z",
      stepId: stepDbId,
      workflowStepId: "deploy",
      runId,
      claimId,
      claimAgentId,
      runtimeAgentId,
    };
    const authorityError = new V3DeployAuthorityError(
      "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
      "deploy source changed after final-tree acceptance",
      {
        runId,
        candidateHash: "a".repeat(64),
        expectedTreeHash: "b".repeat(40),
        observedTreeHash: "c".repeat(40),
      },
    );

    const refusal = await completeV3DeployAuthorityRefusal({
      sql: database.sql,
      envelope,
      error: authorityError,
      now: new Date("2026-07-13T12:00:00.500Z"),
    });
    assert.equal(refusal.claimClosure, "pre_spawn_released");

    const ownerRows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      step_output: string;
      retry_count: number;
      claim_outcome: string | null;
      runtime_state: string;
      termination_state: string;
      requested_by: string;
      termination_evidence: Record<string, unknown>;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             step.output AS step_output,
             step.retry_count,
             claim.outcome AS claim_outcome,
             runtime.state AS runtime_state,
             termination.state AS termination_state,
             termination.requested_by,
             termination.evidence AS termination_evidence
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
        JOIN claim_log claim ON claim.id = ${claimId}
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE run.id = ${runId}
    `;
    const owner = ownerRows[0]!;
    assert.equal(owner.run_status, "failing");
    assert.equal(owner.step_status, "failed");
    assert.equal(owner.retry_count, 0);
    assert.equal(owner.claim_outcome, "failed");
    assert.equal(owner.runtime_state, "released");
    assert.equal(owner.termination_state, "requested");
    assert.equal(owner.requested_by, "setfarm.product-compiler.deploy-refusal");
    assert.equal(owner.termination_evidence.owner, "compiler");
    assert.equal(owner.termination_evidence.refusalHash, refusal.refusalHash);
    assert.equal(owner.termination_evidence.modelRedispatchBudget, 0);
    const record = JSON.parse(owner.step_output);
    assert.equal(record.schema, "setfarm.v3-deploy-authority-refusal.v1");
    assert.equal(record.refusalHash, refusal.refusalHash);
    assert.equal(record.terminal.modelRedispatchBudget, 0);

    const redispatch = await publishSingleClaimRuntime(database.sql, {
      runId,
      stepDbId,
      workflowStepId: "deploy",
      claimAgentId,
      runtimeIntent: {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-deploy-refusal-redispatch",
        runtimeAgentId,
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-test",
      },
    });
    assert.equal(redispatch, undefined, "failing run cannot publish the same work again");

    const terminations = createRunTerminationRepository(database.sql);
    const termination = await terminations.claim({
      requestId: refusal.terminationRequestId,
      ownerInstanceId: "termination-test",
    });
    assert.equal(termination?.state, "draining");
    const alreadyReleased = await sessions.findById(session.sessionId);
    assert.equal(alreadyReleased?.state, "released");
    await terminations.markDrained({
      requestId: refusal.terminationRequestId,
      ownerInstanceId: "termination-test",
      evidence: { source: "v3-deploy-refusal-test" },
    });
    await terminations.terminalize({ requestId: refusal.terminationRequestId });

    const terminalRows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      claim_outcome: string;
      runtime_state: string;
      termination_state: string;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             claim.outcome AS claim_outcome,
             runtime.state AS runtime_state,
             termination.state AS termination_state
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
        JOIN claim_log claim ON claim.id = ${claimId}
        JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
        JOIN run_termination_requests termination ON termination.run_id = run.id
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...terminalRows[0] }, {
      run_status: "failed",
      step_status: "failed",
      claim_outcome: "failed",
      runtime_state: "released",
      termination_state: "terminalized",
    });
  } finally {
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});

test("deploy refusal rejects non-deploy claim capabilities before any database access", async () => {
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1",
    protocol: "v3",
    issuedAt: "2026-07-13T12:00:00.000Z",
    stepId: "step-final-test",
    workflowStepId: "final-test",
    runId: "run-wrong-step",
    claimId: 1,
    claimAgentId: "tester",
    runtimeAgentId: "tester-runtime",
  };
  await assert.rejects(
    completeV3DeployAuthorityRefusal({
      sql: undefined as never,
      envelope,
      error: new V3DeployAuthorityError(
        "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING",
        "candidate missing",
      ),
    }),
    /V3_DEPLOY_REFUSAL_CLAIM_IDENTITY_INVALID/,
  );
});

test("deploy observation failure preserves the original typed authority error", async () => {
  const authorityError = new V3DeployAuthorityError(
    "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING",
    "candidate missing",
  );
  await assert.rejects(
    rethrowV3DeployAuthorityAfterObservation(
      { runId: "run-observation-failure", stepId: "deploy" },
      authorityError,
      async () => { throw new Error("observation store unavailable"); },
    ),
    (error: unknown) => error === authorityError,
  );
});

test("claimStep refuses v3 deploy before handoff and cannot publish the unchanged work again", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-deploy-refusal-"));
  let productionDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    execFileSync("git", ["init", "-q"], { cwd: repo });
    execFileSync("git", ["config", "user.email", "setfarm-test@example.invalid"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "Setfarm Test"], { cwd: repo });
    await writeFile(path.join(repo, "README.md"), "accepted source authority test\n", "utf8");
    execFileSync("git", ["add", "README.md"], { cwd: repo });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: repo });

    const runId = "run-v3-deploy-claim-refusal";
    const stepDbId = "step-v3-deploy-claim-refusal";
    const agentId = "feature-dev_deployer";
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`
      INSERT INTO runs (
        id, workflow_id, task, status, context, protocol,
        compiler_release_sha, activation_preflight_hash, release_admission_hash
      ) VALUES (
        ${runId}, 'feature-dev', 'deploy candidate refusal', 'running',
        ${JSON.stringify({ task: "deploy candidate refusal", repo })}, 'v3',
        ${releaseSha}, ${"e".repeat(64)}, ${releaseAdmissionHash}
      )
    `;
    await database.sql`
      INSERT INTO steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects,
        status, type, retry_count, max_retries
      ) VALUES (
        ${stepDbId}, ${runId}, 'deploy', ${agentId}, 11, '', '',
        'pending', 'single', 0, 3
      )
    `;
    productionDb = await import("../../src/db-pg.js");
    productionDb.pgConfigureIsolatedTestDatabase(database.url);
    const { claimStep } = await import("../../src/installer/step-ops.js");
    const claim = await claimStep(
      agentId,
      "v3-deploy-refusal-e2e",
      {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-deploy-refusal-e2e-0001",
        runtimeAgentId: "deployer-e2e-runtime",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-e2e-test",
      },
    );
    assert.deepEqual(claim, { found: false });

    const firstRows = await database.sql<Array<{
      run_status: string;
      step_status: string;
      retry_count: number;
      claims: number;
      open_claims: number;
      runtimes: number;
      released_runtimes: number;
      terminations: number;
    }>>`
      SELECT run.status AS run_status,
             step.status AS step_status,
             step.retry_count,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id) AS claims,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = run.id AND outcome IS NULL) AS open_claims,
             (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id) AS runtimes,
             (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = run.id AND state = 'released') AS released_runtimes,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = run.id) AS terminations
        FROM runs run
        JOIN steps step ON step.id = ${stepDbId}
       WHERE run.id = ${runId}
    `;
    assert.deepEqual({ ...firstRows[0] }, {
      run_status: "failing",
      step_status: "failed",
      retry_count: 0,
      claims: 1,
      open_claims: 0,
      runtimes: 1,
      released_runtimes: 1,
      terminations: 1,
    });

    const replay = await claimStep(
      agentId,
      "v3-deploy-refusal-e2e-replay",
      {
        schema: "setfarm.runtime-claim-intent.v1",
        sessionId: "RTS_v3-deploy-refusal-e2e-0002",
        runtimeAgentId: "deployer-e2e-replay-runtime",
        runtimeKind: "openclaw_session",
        ownerInstanceId: "spawner-e2e-replay-test",
      },
    );
    assert.deepEqual(replay, { found: false });
    const replayCounts = await database.sql<Array<{ claims: number; runtimes: number; terminations: number }>>`
      SELECT (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claims,
             (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${runId}) AS runtimes,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS terminations
    `;
    assert.deepEqual({ ...replayCounts[0] }, { claims: 1, runtimes: 1, terminations: 1 });
  } finally {
    await rm(repo, { recursive: true, force: true });
    if (productionDb) await productionDb.pgClose().catch(() => {});
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
