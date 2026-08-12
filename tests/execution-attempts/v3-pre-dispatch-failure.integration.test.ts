import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { publishLoopClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { createV3PreparationClaimAuthorityV1 } from "../../src/execution/v3-preparation-claim-authority.js";
import { exactProductReservation } from "./fixtures.js";
import { seedCanonicalCompilerStoryAdmissionFixture } from "./helpers/compiler-story-english-admission-fixture.js";
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
    const releaseSha = "a".repeat(40);
    const packetHash = "b".repeat(64);
    const seedManagedOwner = async (suffix: string) => {
      const managedRunId = `run-v3-pre-dispatch-${suffix}`;
      const admission = await seedCanonicalCompilerStoryAdmissionFixture(database, {
        runId: managedRunId,
        releaseSha,
        packetHash,
      });
      const story = admission.stories[0]!;
      const publication = await publishLoopClaimRuntime(database.sql, {
        runId: managedRunId,
        stepDbId: admission.implementStepDbId,
        workflowStepId: "implement",
        storyDbId: story.id,
        storyId: story.storyId,
        claimAgentId: "feature-dev_developer",
        parallelLimit: 1,
        runtimeIntent: {
          schema: "setfarm.runtime-claim-intent.v1",
          sessionId: `RTS_predispatch-${suffix}-owner`,
          runtimeAgentId: "prism",
          runtimeKind: "openclaw_session",
          ownerInstanceId: "spawner-predispatch",
        },
        storyAdmissionProof: admission.storyAdmissionProof,
      });
      assert.ok(publication?.runtime);
      const managedClaimId = publication.claimId;
      const attempts = createAttemptRepository(database.sql, {
        attemptId: () => `ATT_predispatch-${suffix}-owner`,
        fenceToken: () => "f".repeat(64),
      });
      const attempt = await attempts.reserve(exactProductReservation({
        claimId: managedClaimId,
        runId: managedRunId,
        stepId: "implement",
        storyId: story.storyId,
        agentId: "feature-dev_developer",
        packetHash,
        sourceBefore: { sha: "d".repeat(40), treeHash: "e".repeat(40) },
        evidenceRefs: [`setfarm://claim-log/${managedClaimId}`],
      }));
      const sessions = createRuntimeSessionRepository(database.sql);
      const runtime = await sessions.bindAttempt({
        sessionId: publication.runtime.sessionId,
        attemptId: attempt.attempt.attemptId,
        ownerInstanceId: publication.runtime.ownerInstanceId,
      });
      return {
        runId: managedRunId,
        stepDbId: admission.implementStepDbId,
        storyDbId: story.id,
        storyId: story.storyId,
        claimId: managedClaimId,
        attemptId: attempt.attempt.attemptId,
        runtime,
        authority: createV3PreparationClaimAuthorityV1({
          stateVersion: 1,
          runId: managedRunId,
          stepId: "implement",
          storyId: story.storyId,
          packetHash,
          baseRevision: { sha: "d".repeat(40), treeHash: "e".repeat(40) },
          projectedDependencyIds: [],
          dependencyAttempts: [],
        }),
      };
    };

    const transient = await seedManagedOwner("integration");
    const disposition = await handleV3PreDispatchFailure({
      step: { id: transient.stepDbId, run_id: transient.runId, step_id: "implement" },
      story: { id: transient.storyDbId, story_id: transient.storyId, title: "Exact transient story" },
      agentId: "feature-dev_developer",
      claimId: transient.claimId,
      runtime: {
        sessionId: transient.runtime.sessionId,
        ownerInstanceId: transient.runtime.ownerInstanceId,
      },
      authority: transient.authority,
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
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${transient.runId}) AS termination_requests,
             (SELECT COUNT(*)::integer FROM run_observations
               WHERE run_id = ${transient.runId} AND phase = 'v3-pre-dispatch') AS owner_observations
        FROM runs run
        JOIN steps step ON step.id = ${transient.stepDbId}
        JOIN stories story ON story.id = ${transient.storyDbId}
        JOIN claim_log claim ON claim.id = ${transient.claimId}
       WHERE run.id = ${transient.runId}
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

    const contractFailures = [
      {
        suffix: "input-unresolved-success",
        code: "V3_IMPLEMENTATION_INPUT_UNRESOLVED",
        detail: "Blocked: unresolved variable(s) [repo] in input",
      },
      {
        suffix: "critical-context-success",
        code: "V3_IMPLEMENTATION_CRITICAL_CONTEXT_EMPTY",
        detail: "EMPTY_CRITICAL_VARS: [repo] are empty",
      },
    ] as const;
    for (const failure of contractFailures) {
      const managed = await seedManagedOwner(failure.suffix);
      const terminal = await handleV3PreDispatchFailure({
        step: { id: managed.stepDbId, run_id: managed.runId, step_id: "implement" },
        story: { id: managed.storyDbId, story_id: managed.storyId, title: "Managed pre-dispatch story" },
        agentId: "feature-dev_developer",
        claimId: managed.claimId,
        runtime: {
          sessionId: managed.runtime.sessionId,
          ownerInstanceId: managed.runtime.ownerInstanceId,
        },
        authority: managed.authority,
        phase: "source",
        error: Object.assign(new Error(failure.detail), { code: failure.code }),
      });
      assert.equal(terminal.disposition, "terminal_contract");
      const terminalState = await database.sql<Array<{
        run_status: string;
        step_status: string;
        current_story_id: string | null;
        story_status: string;
        claimed_by: string | null;
        claim_outcome: string | null;
        attempt_disposition: string;
        runtime_state: string;
        termination_state: string;
        termination_evidence: Record<string, unknown>;
      }>>`
        SELECT run.status AS run_status, step.status AS step_status,
               step.current_story_id, story.status AS story_status, story.claimed_by,
               claim.outcome AS claim_outcome, attempt.disposition AS attempt_disposition,
               runtime.state AS runtime_state, termination.state AS termination_state,
               termination.evidence AS termination_evidence
          FROM runs run
          JOIN steps step ON step.id = ${managed.stepDbId}
          JOIN stories story ON story.id = ${managed.storyDbId}
          JOIN claim_log claim ON claim.id = ${managed.claimId}
          JOIN execution_attempts attempt ON attempt.attempt_id = ${managed.attemptId}
          JOIN runtime_sessions runtime ON runtime.session_id = ${managed.runtime.sessionId}
          JOIN run_termination_requests termination ON termination.run_id = run.id
         WHERE run.id = ${managed.runId}
      `;
      const terminalOwner = terminalState[0]!;
      assert.deepEqual({ ...terminalOwner, termination_evidence: undefined }, {
        run_status: "failing",
        step_status: "failed",
        current_story_id: null,
        story_status: "failed",
        claimed_by: null,
        claim_outcome: "failed",
        attempt_disposition: "inconclusive",
        runtime_state: "released",
        termination_state: "requested",
        termination_evidence: undefined,
      });
      assert.deepEqual(terminalOwner.termination_evidence.operationalFailureCause, {
        schema: "setfarm.operational-failure-cause.v1",
        workflowStepId: "implement",
        boundary: "implementation.pre_dispatch.source",
        failureClass: "platform_invariant_failed",
        failureCode: failure.code,
      });
    }

    const untypedManaged = await seedManagedOwner("untyped-terminal");
    const untypedTerminal = await handleV3PreDispatchFailure({
      step: {
        id: untypedManaged.stepDbId,
        run_id: untypedManaged.runId,
        step_id: "implement",
      },
      story: {
        id: untypedManaged.storyDbId,
        story_id: untypedManaged.storyId,
        title: "Managed pre-dispatch story",
      },
      agentId: "feature-dev_developer",
      claimId: untypedManaged.claimId,
      runtime: {
        sessionId: untypedManaged.runtime.sessionId,
        ownerInstanceId: untypedManaged.runtime.ownerInstanceId,
      },
      authority: untypedManaged.authority,
      phase: "source",
      error: new Error("unknown reservation failure"),
    });
    assert.equal(untypedTerminal.disposition, "terminal_contract");
    const untypedEvidence = await database.sql<Array<{ evidence: Record<string, unknown> }>>`
      SELECT evidence FROM run_termination_requests WHERE run_id = ${untypedManaged.runId}
    `;
    assert.equal(Object.hasOwn(untypedEvidence[0]!.evidence, "operationalFailureCause"), false);

    await database.sql.unsafe(`
      CREATE FUNCTION test_fail_v3_predispatch_story_terminal_update()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.run_id LIKE 'run-v3-pre-dispatch-%-rollback' AND NEW.status = 'failed' THEN
          RAISE EXCEPTION 'TEST_INJECTED_PRE_DISPATCH_STORY_UPDATE_FAILURE';
        END IF;
        RETURN NEW;
      END
      $$
    `);
    await database.sql.unsafe(`
      CREATE TRIGGER trg_test_fail_v3_predispatch_story_terminal_update
      BEFORE UPDATE ON stories
      FOR EACH ROW EXECUTE FUNCTION test_fail_v3_predispatch_story_terminal_update()
    `);
    for (const failure of [
      {
        suffix: "input-unresolved-rollback",
        code: "V3_IMPLEMENTATION_INPUT_UNRESOLVED",
        detail: "Blocked: unresolved variable(s) [repo] in input",
      },
      {
        suffix: "critical-context-rollback",
        code: "V3_IMPLEMENTATION_CRITICAL_CONTEXT_EMPTY",
        detail: "EMPTY_CRITICAL_VARS: [repo] are empty",
      },
    ] as const) {
      const managed = await seedManagedOwner(failure.suffix);
      await assert.rejects(
        handleV3PreDispatchFailure({
          step: { id: managed.stepDbId, run_id: managed.runId, step_id: "implement" },
          story: { id: managed.storyDbId, story_id: managed.storyId, title: "Managed pre-dispatch story" },
          agentId: "feature-dev_developer",
          claimId: managed.claimId,
          runtime: {
            sessionId: managed.runtime.sessionId,
            ownerInstanceId: managed.runtime.ownerInstanceId,
          },
          authority: managed.authority,
          phase: "source",
          error: Object.assign(new Error(failure.detail), { code: failure.code }),
        }),
        /TEST_INJECTED_PRE_DISPATCH_STORY_UPDATE_FAILURE/,
      );
      const rollbackState = await database.sql<Array<{
        run_status: string;
        step_status: string;
        current_story_id: string | null;
        story_status: string;
        claimed_by: string | null;
        claim_outcome: string | null;
        attempt_disposition: string;
        runtime_state: string;
        termination_count: number;
      }>>`
        SELECT run.status AS run_status, step.status AS step_status,
               step.current_story_id, story.status AS story_status, story.claimed_by,
               claim.outcome AS claim_outcome, attempt.disposition AS attempt_disposition,
               runtime.state AS runtime_state,
               (SELECT COUNT(*)::integer FROM run_termination_requests termination
                 WHERE termination.run_id = run.id) AS termination_count
          FROM runs run
          JOIN steps step ON step.id = ${managed.stepDbId}
          JOIN stories story ON story.id = ${managed.storyDbId}
          JOIN claim_log claim ON claim.id = ${managed.claimId}
          JOIN execution_attempts attempt ON attempt.attempt_id = ${managed.attemptId}
          JOIN runtime_sessions runtime ON runtime.session_id = ${managed.runtime.sessionId}
         WHERE run.id = ${managed.runId}
      `;
      assert.deepEqual({ ...rollbackState[0] }, {
        run_status: "running",
        step_status: "running",
        current_story_id: managed.storyDbId,
        story_status: "running",
        claimed_by: "feature-dev_developer",
        claim_outcome: null,
        attempt_disposition: "claimed",
        runtime_state: "reserved",
        termination_count: 0,
      });
    }
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
