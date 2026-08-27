import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import type { PgTransactionSql } from "../../src/db-pg.js";
import { publishSingleClaimRuntime } from "../../src/execution/claim-runtime-publication.js";
import { persistWorkflowRunInTransaction } from "../../src/execution/run-persistence.js";
import { requestRunTermination } from "../../src/execution/run-termination.js";
import {
  createRuntimeCompletionRepository,
  requestRuntimeCompletion,
} from "../../src/execution/runtime-completion.js";
import { createRuntimeSessionRepository } from "../../src/execution/runtime-session-repository.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase } from "./test-database.js";

test("v3 platform preclaim fails closed when another termination cause already owns the run", async () => {
  const previousPgUrl = process.env.SETFARM_PG_URL;
  const database = await createIsolatedTestDatabase();
  const repo = await mkdtemp(path.join(tmpdir(), "setfarm-v3-preclaim-race-"));
  let runtimeDb: typeof import("../../src/db-pg.js") | undefined;
  try {
    runtimeDb = await import("../../src/db-pg.js");
    runtimeDb.pgConfigureIsolatedTestDatabase(database.url);
    await runtimeDb.initializeInternalProductionCurrentEntryDatabaseV1();
    const runId = "run-v3-platform-preclaim-existing-termination";
    const stepDbId = "step-v3-platform-preclaim-existing-termination";
    const claimAgentId = "feature-dev_builder";
    const releaseSha = "f".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    fs.mkdirSync(path.join(repo, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(repo, "stitch"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({
      name: "preclaim-termination-race-fixture",
      version: "1.0.0",
      type: "module",
      scripts: { build: "node -e \"process.exit(0)\"" },
    }));
    fs.writeFileSync(path.join(repo, "stitch", "DESIGN_MANIFEST.json"), "{ malformed-json\n");
    await database.sql.begin((transaction) => persistWorkflowRunInTransaction(
      transaction as PgTransactionSql,
      {
        run: {
          id: runId,
          runNumber: 8602,
          workflowId: "feature-dev",
          task: "Prove preclaim termination conflict fencing",
          context: JSON.stringify({
            repo,
            stack_pack_id: "vite-react-web-app",
            tech_stack: "vite-react",
            task: "Prove preclaim termination conflict fencing",
          }),
          notifyUrl: null,
          createdAt: "2026-07-15T12:01:00.000Z",
          protocol: {
            mode: "v3",
            version: 1,
            compilerReleaseSha: releaseSha,
            activationPreflightHash: hashCanonicalJson({
              fixture: "v3-release-preflight",
              releaseSha,
            }),
            releaseAdmissionHash,
            releaseAdmissionKind: "release_go",
            canaryAdmission: null,
          },
        },
        steps: [
          { id: stepDbId, stepId: "setup-build", agentId: claimAgentId, stepIndex: 5, inputTemplate: "", expects: "", status: "pending", maxRetries: 3, type: "single", loopConfig: null },
        ],
      },
    ));
    const runtimeIntent = {
      schema: "setfarm.runtime-claim-intent.v1",
      sessionId: "RTS_v3-platform-preclaim-race",
      runtimeAgentId: claimAgentId,
      runtimeKind: "openclaw_session",
      ownerInstanceId: "v3-platform-preclaim-race-owner",
    } as const;
    const publication = await publishSingleClaimRuntime(database.sql, {
      runId,
      stepDbId,
      workflowStepId: "setup-build",
      claimAgentId,
      runtimeIntent,
      now: new Date("2026-07-15T12:01:00.000Z"),
    });
    assert.ok(publication?.runtime);
    assert.equal(publication.protocol, "v3");
    assert.deepEqual(publication.runtime, {
      sessionId: "RTS_v3-platform-preclaim-race",
      ownerInstanceId: "v3-platform-preclaim-race-owner",
    });
    const { claimStep } = await import("../../src/installer/step-ops.js");
    assert.deepEqual(
      await claimStep("feature-dev_fixture-no-work", "v3-platform-preclaim-cleanup-quiescence"),
      { found: false },
    );
    const completionOwnerInstanceId = "v3-platform-preclaim-race-completion-owner";
    const sessions = createRuntimeSessionRepository(database.sql);
    await sessions.markStarting({
      sessionId: publication.runtime.sessionId,
      ownerInstanceId: publication.runtime.ownerInstanceId,
    });
    await sessions.markRunning({
      sessionId: publication.runtime.sessionId,
      ownerInstanceId: publication.runtime.ownerInstanceId,
    });
    const completion = await requestRuntimeCompletion(database.sql, {
      envelope: {
        schema: "setfarm.claim-envelope.v1",
        protocol: publication.protocol,
        issuedAt: "2026-07-15T12:01:00.000Z",
        stepId: stepDbId,
        workflowStepId: "setup-build",
        runId,
        claimId: publication.claimId,
        claimAgentId,
        runtimeAgentId: claimAgentId,
      },
      output: "STATUS: blocked by the preclaim termination race",
      requestId: "RCR_v3-platform-preclaim-race",
    });
    assert.equal(completion.status, "requested");
    if (completion.status !== "requested") throw new Error("race completion request missing");
    const completions = createRuntimeCompletionRepository(database.sql);
    await completions.claim({
      requestId: completion.request.requestId,
      ownerInstanceId: completionOwnerInstanceId,
    });
    await sessions.markDrained({
      sessionId: publication.runtime.sessionId,
      ownerInstanceId: publication.runtime.ownerInstanceId,
      evidence: {
        schema: "setfarm.runtime-drain-evidence.v1",
        observedAt: "2026-07-15T12:01:30.000Z",
        localProcessAbsent: true,
        openClawTaskAbsent: true,
        workspaceProcessAbsent: true,
        stableObservations: 2,
        evidenceRefs: ["setfarm://test/v3-platform-preclaim-race"],
      },
    });
    const processing = await completions.markProcessing({
      requestId: completion.request.requestId,
      ownerInstanceId: completionOwnerInstanceId,
    });
    assert.equal(processing.state, "processing");
    const existingCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "product_compiler.setup_build_packet",
      failureClass: "contract_invalid",
      failureCode: "SETUP_PACKET_DESIGN_GRAPH_REJECTED",
    } as const;
    const termination = await requestRunTermination(database.sql, {
      runId,
      targetStatus: "failed",
      requestedBy: "setfarm.step-fail.single",
      diagnostic: "existing authoritative failure",
      evidence: {},
      failureCause: existingCause,
      requestId: "RTR_v3-preclaim-existing-cause",
      now: new Date("2026-07-15T12:02:00.000Z"),
    });
    assert.equal(termination.status, "requested");

    const readLifecycleSnapshot = async () => {
      const snapshots = await database.sql<Array<{
        claim_rows: unknown;
        runtime_rows: unknown;
        completion_rows: unknown;
        termination_rows: unknown;
        owner_rows: unknown;
      }>>`
        SELECT (SELECT COALESCE(jsonb_agg(to_jsonb(claim) ORDER BY claim.id), '[]'::jsonb)
                  FROM claim_log claim WHERE claim.run_id = ${runId}) AS claim_rows,
               (SELECT COALESCE(jsonb_agg(to_jsonb(runtime) ORDER BY runtime.session_id), '[]'::jsonb)
                  FROM runtime_sessions runtime WHERE runtime.run_id = ${runId}) AS runtime_rows,
               (SELECT COALESCE(jsonb_agg(to_jsonb(completion) ORDER BY completion.request_id), '[]'::jsonb)
                  FROM runtime_completion_requests completion WHERE completion.run_id = ${runId}) AS completion_rows,
               (SELECT COALESCE(jsonb_agg(to_jsonb(termination) ORDER BY termination.request_id), '[]'::jsonb)
                  FROM run_termination_requests termination WHERE termination.run_id = ${runId}) AS termination_rows,
               (SELECT COALESCE(jsonb_agg(to_jsonb(owner) ORDER BY owner.reservation_ref), '[]'::jsonb)
                  FROM internal_production_owner_reservations_v1 owner
                 WHERE owner.owner_key IN (
                   ${String(publication.claimId)},
                   ${publication.runtime.sessionId},
                   ${completion.request.requestId},
                   ${termination.request.requestId}
                 )) AS owner_rows
      `;
      assert.equal(snapshots.length, 1);
      return { ...snapshots[0]! };
    };
    const lifecycleBeforeRejectedClaim = await readLifecycleSnapshot();
    const readOwnerSnapshot = async () => {
      const snapshot = await database.sql<Array<{
        head_version: string;
        head_hash: string;
        reservation_count: number;
      }>>`
        SELECT head.head_version::text AS head_version,
               head.head_hash,
               (SELECT COUNT(*)::integer
                  FROM internal_production_owner_reservations_v1) AS reservation_count
          FROM internal_production_owner_admission_head_v1 head
         WHERE head.singleton = TRUE
      `;
      assert.equal(snapshot.length, 1);
      return { ...snapshot[0]! };
    };
    const ownerSnapshotBeforeRejectedClaim = await readOwnerSnapshot();

    assert.deepEqual(
      await claimStep(claimAgentId, "v3-platform-preclaim-existing-termination", runtimeIntent),
      { found: false },
    );
    assert.deepEqual(
      await readLifecycleSnapshot(),
      lifecycleBeforeRejectedClaim,
      "a drained runtime must refuse reissue before any lifecycle or owner byte changes",
    );

    const rows = await database.sql<Array<{
      step_status: string;
      claim_outcome: string | null;
      claim_count: number;
      completion_count: number;
      termination_count: number;
      termination_evidence: Record<string, unknown>;
      claim_owner_count: number;
      claim_owner_implementation: string;
      claim_owner_state: string;
      runtime_owner_count: number;
      runtime_owner_implementation: string;
      runtime_owner_state: string;
      runtime_state: string;
      completion_owner_count: number;
      completion_owner_implementation: string;
      completion_owner_state: string;
      termination_owner_count: number;
      termination_owner_implementation: string;
      termination_owner_state: string;
    }>>`
      SELECT step.status AS step_status,
             claim.outcome AS claim_outcome,
             (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claim_count,
             (SELECT COUNT(*)::integer FROM runtime_completion_requests WHERE run_id = ${runId}) AS completion_count,
             (SELECT COUNT(*)::integer FROM run_termination_requests WHERE run_id = ${runId}) AS termination_count,
             termination.evidence AS termination_evidence,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'claim'
                 AND reservation.owner_key = claim.id::text) AS claim_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'claim'
                 AND reservation.owner_key = claim.id::text) AS claim_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'claim'
                 AND reservation.owner_key = claim.id::text) AS claim_owner_state,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'runtime-session'
                 AND reservation.owner_key = ${publication.runtime.sessionId}) AS runtime_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'runtime-session'
                 AND reservation.owner_key = ${publication.runtime.sessionId}) AS runtime_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'runtime-session'
                 AND reservation.owner_key = ${publication.runtime.sessionId}) AS runtime_owner_state,
             (SELECT runtime.state
                FROM runtime_sessions runtime
               WHERE runtime.session_id = ${publication.runtime.sessionId}) AS runtime_state,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'completion-owner'
                 AND reservation.owner_key = ${completion.request.requestId}) AS completion_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'completion-owner'
                 AND reservation.owner_key = ${completion.request.requestId}) AS completion_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'completion-owner'
                 AND reservation.owner_key = ${completion.request.requestId}) AS completion_owner_state,
             (SELECT COUNT(*)::integer
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'termination'
                 AND reservation.owner_key = termination.request_id) AS termination_owner_count,
             (SELECT MIN(reservation.producer_implementation_id)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'termination'
                 AND reservation.owner_key = termination.request_id) AS termination_owner_implementation,
             (SELECT MIN(reservation.state)
                FROM internal_production_owner_reservations_v1 reservation
               WHERE reservation.category = 'termination'
                 AND reservation.owner_key = termination.request_id) AS termination_owner_state
        FROM steps step
        JOIN claim_log claim
          ON claim.run_id = step.run_id
         AND claim.step_id = step.step_id
         AND claim.story_id IS NULL
        JOIN run_termination_requests termination ON termination.run_id = step.run_id
       WHERE step.id = ${stepDbId}
    `;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.step_status, "running", "the rejected lifecycle transaction must roll back");
    assert.equal(rows[0]!.claim_outcome, null, "no false terminal claim may be published");
    assert.equal(rows[0]!.claim_count, 1, "the claim is not silently redispatched");
    assert.equal(rows[0]!.completion_count, 1, "the exact pre-existing completion stays unique");
    assert.equal(rows[0]!.termination_count, 1, "the first termination owner stays unique");
    assert.deepEqual(rows[0]!.termination_evidence.operationalFailureCause, existingCause);
    assert.equal(rows[0]!.claim_owner_count, 1);
    assert.equal(rows[0]!.claim_owner_implementation, "a-claim-single-runtime-v1");
    assert.equal(rows[0]!.claim_owner_state, "bound");
    assert.equal(rows[0]!.runtime_owner_count, 1);
    assert.equal(rows[0]!.runtime_owner_implementation, "a-runtime-session-v1");
    assert.equal(rows[0]!.runtime_owner_state, "bound");
    assert.equal(rows[0]!.runtime_state, "drained");
    assert.equal(rows[0]!.completion_owner_count, 1);
    assert.equal(rows[0]!.completion_owner_implementation, "a-completion-owner-v1");
    assert.equal(rows[0]!.completion_owner_state, "bound");
    assert.equal(rows[0]!.termination_owner_count, 1);
    assert.equal(rows[0]!.termination_owner_implementation, "a-termination-v1");
    assert.equal(rows[0]!.termination_owner_state, "bound");
    assert.deepEqual(
      await readOwnerSnapshot(),
      ownerSnapshotBeforeRejectedClaim,
      "the rejected lifecycle must not transition the owner head or add a reservation",
    );
  } finally {
    await runtimeDb?.pgClose();
    await rm(repo, { recursive: true, force: true });
    await database.cleanup();
    if (previousPgUrl === undefined) delete process.env.SETFARM_PG_URL;
    else process.env.SETFARM_PG_URL = previousPgUrl;
  }
});
