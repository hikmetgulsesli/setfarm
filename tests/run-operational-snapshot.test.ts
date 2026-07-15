import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { createAcceptedCandidateV1 } from "../src/evidence/accepted-candidate-v1.js";
import {
  createEvidenceBundleV2,
  computeEvidenceBundleHash,
  computeObservationRef,
} from "../src/evidence/evidence-bundle-v2.js";
import { createAttemptRepository } from "../src/execution/attempt-repository.js";
import { createOperationalOutboxPublisher } from "../src/execution/operational-outbox-publisher.js";
import { createOperationalOutboxRepository } from "../src/execution/operational-outbox-repository.js";
import { createV3DeployReceiptRepository } from "../src/execution/v3-deploy-receipt-repository.js";
import { createV3ProjectTransferAckRepository } from "../src/execution/v3-project-transfer-ack-repository.js";
import { ClaimEnvelopeV1Schema } from "../src/execution/schemas/claim-envelope-v1.js";
import {
  createV3BuildArtifactV1,
  createV3DeployReceiptV1,
} from "../src/execution/schemas/v3-deploy-receipt-v1.js";
import { V3ProjectTransferAckV1Schema } from "../src/execution/schemas/v3-project-transfer-ack-v1.js";
import {
  createV3RuntimeIsolationAuthorityV1,
  createV3RuntimeIsolationChallengeV1,
  createV3RuntimeVolumeProvisioningV1,
  V3RuntimeIsolationProofV1Schema,
} from "../src/execution/schemas/v3-runtime-isolation-v1.js";
import { createFindingSetV1 } from "../src/findings/finding-set.js";
import { createFindingRecoveryRepository } from "../src/recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../src/recovery/recovery-delivery-repository.js";
import type { RecoveryCaseDraftV1 } from "../src/recovery/recovery-case.js";
import { hashCanonicalJson } from "../src/product-compiler/canonical-json.js";
import {
  buildRunOperationalSnapshot,
  computeRunOperationalSnapshotHash,
  reduceRunOperationalLifecycle,
} from "../src/server/run-operational-snapshot.js";
import {
  OperationalTerminationRequestV1Schema,
  RunOperationalSnapshotV1Schema,
} from "../src/server/schemas/run-operational-snapshot-v1.js";
import { RunOperationalSnapshotV2Schema } from "../src/server/schemas/run-operational-snapshot-v2.js";
import { createIsolatedTestDatabase } from "./execution-attempts/test-database.js";

const SHA = "a".repeat(40);
const TREE = "b".repeat(40);
const HASH = "c".repeat(64);
const INPUT_HASH = "d".repeat(64);
const PLAN_HASH = "e".repeat(64);
const PACKET_HASH = "f".repeat(64);
const SLICE_HASH = "8".repeat(64);
const EXECUTION_SLICE_HASH = "9".repeat(64);

function findingSet(runId: string) {
  return createFindingSetV1({
    runId,
    storyId: "US-RECOVERY",
    packetHash: PACKET_HASH,
    sliceHash: SLICE_HASH,
    sourceRevision: { sha: SHA, treeHash: TREE },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: INPUT_HASH }],
      observedEvidenceRefs: [PLAN_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(findings: ReturnType<typeof findingSet>): RecoveryCaseDraftV1 {
  return {
    runId: findings.runId,
    storyId: findings.storyId,
    findingSetHash: findings.findingSetHash,
    findingIds: findings.findings.map((finding) => finding.findingId),
    packetHash: findings.packetHash,
    sliceHash: findings.sliceHash,
    sourceRevision: findings.sourceRevision,
    owner: "implement",
    expectedDelta: {
      kind: "source_change",
      invariantRefs: ["INV_SAVE_RELOAD"],
      requiredPaths: ["src/App.tsx"],
    },
    allowedPaths: ["src/App.tsx"],
    evidencePlan: ["EVID_SAVE_RELOAD"],
    priorAttemptRefs: [],
    budget: {
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 2 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
}

function evidenceBundle(runId: string) {
  const observation = {
    kind: "runtime" as const,
    owner: "setfarm-orchestrator" as const,
    runtimeSessionId: "snapshot-runtime-evidence",
    runtimeArtifactHash: INPUT_HASH,
    startedAt: "2026-07-13T08:00:00.000Z",
    completedAt: "2026-07-13T08:00:01.000Z",
  };
  return createEvidenceBundleV2({
    runId,
    storyId: "US-RECOVERY",
    packetHash: PACKET_HASH,
    sliceHash: SLICE_HASH,
    sourceRevision: { sha: SHA, treeHash: TREE },
    predicates: [{
      invariantRef: "INV_SAVE_RELOAD",
      predicateRef: "EVID_SAVE_RELOAD",
      required: true,
      verdict: "fail",
      observationRefs: [computeObservationRef(observation)],
    }],
    observations: [observation],
    artifacts: [{ hash: INPUT_HASH, mediaType: "application/json", locator: "evidence/runtime.json" }],
    runner: { id: "setfarm-runtime-runner", version: "3.0.0", environmentHash: PLAN_HASH },
    startedAt: "2026-07-13T08:00:00.000Z",
    completedAt: "2026-07-13T08:00:01.000Z",
  });
}

async function seedClaimAndAttempt(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  disposition: "claimed" | "verified",
): Promise<Readonly<{ claimId: string; attemptId: string }>> {
  const claimRows = await database.sql<Array<{ id: string }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'implement', 'US-001', 'feature-dev_developer')
    RETURNING id::text AS id
  `;
  const claimId = claimRows[0]!.id;
  const attemptId = `ATT_${runId}-00000001`;
  await database.sql.unsafe(
    `INSERT INTO execution_attempts (
       attempt_id, run_id, step_id, story_id, generation, fence_token,
       attempt_class, compilation_report_hash, source_before_sha,
       source_before_tree_hash, role, agent_id, lease_acquired_at,
       lease_expires_at, heartbeat_at, disposition, evidence_refs, claim_id
     ) VALUES (
       $1, $2, 'implement', 'US-001', 1, $3,
       'evidence_only', $4, $5, $6, 'developer', 'feature-dev_developer',
       NOW(), NOW() + interval '5 minutes', NOW(), $7, $8, $9
     )`,
    [attemptId, runId, "FENCE_TOKEN_MUST_NOT_LEAK", HASH, SHA, TREE, disposition, `["setfarm://claim-log/${claimId}"]`, claimId],
  );
  return { claimId, attemptId };
}

async function attestSnapshotMigrationShape(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
): Promise<void> {
  await database.sql.unsafe(
    `UPDATE setfarm_schema_migrations
        SET verified_release_sha = $1, verified_at = NOW()`,
    [SHA],
  );
}

function reducerInput(options: Readonly<{
  protocol: "legacy" | "shadow" | "v3" | null;
  status: string;
  terminal: boolean;
}>): Parameters<typeof reduceRunOperationalLifecycle>[0] {
  return {
    source: {
      database: "postgres",
      projection: "complete",
      migrationVersions: [7, 8, 9, 10, 11, 12, 13, 14],
      verifiedReleaseSha: SHA,
      capabilities: {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: true,
        implementationSubmissionEvidence: true,
        effectLedger: true,
        findingRecovery: true,
        evidenceLedger: true,
        acceptedCandidate: true,
        deploymentReceipt: true,
        projectTransferAck: true,
      },
    },
    run: {
      ref: "setfarm://run/action-matrix",
      id: "action-matrix",
      runNumber: 1,
      protocol: options.protocol,
      status: options.status,
      terminal: options.terminal,
      updatedAt: "2026-07-13T13:00:00.000Z",
    },
    claims: [],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    legacyResumePlan: {
      status: "ready",
      stateHash: HASH,
      plan: {},
    } as Parameters<typeof reduceRunOperationalLifecycle>[0]["legacyResumePlan"],
  };
}

describe("canonical run operational snapshot", () => {
  it("publishes the canonical snapshot through the Setfarm dashboard API", () => {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, "../src/server/dashboard.ts"),
      "utf8",
    );
    assert.match(source, /buildRunOperationalSnapshot/);
    assert.equal(source.includes("/operational-snapshot"), true);
  });
  it("exposes stop only for live stoppable states and resume only for failed legacy runs", () => {
    for (const status of ["running", "resuming"]) {
      const summary = reduceRunOperationalLifecycle(reducerInput({ protocol: "legacy", status, terminal: false }));
      assert.deepEqual(summary.operatorActions.stop, { allowed: true, reasonCode: "RUN_CAN_BE_STOPPED", stateHash: HASH });
      assert.deepEqual(summary.operatorActions.resume, { allowed: false, reasonCode: "RUN_STATUS_NOT_RESUMABLE", stateHash: HASH });
    }

    const idle = reduceRunOperationalLifecycle(reducerInput({ protocol: "legacy", status: "idle", terminal: false }));
    assert.deepEqual(idle.operatorActions.stop, { allowed: false, reasonCode: "RUN_STATUS_NOT_STOPPABLE", stateHash: HASH });
    assert.deepEqual(idle.operatorActions.resume, { allowed: false, reasonCode: "RUN_STATUS_NOT_RESUMABLE", stateHash: HASH });

    const nonRunPending = reduceRunOperationalLifecycle(reducerInput({ protocol: "legacy", status: "pending", terminal: false }));
    assert.deepEqual(nonRunPending.operatorActions.stop, { allowed: false, reasonCode: "RUN_STATUS_NOT_STOPPABLE", stateHash: HASH });

    for (const status of ["failed", "cancelled", "canceled"]) {
      const summary = reduceRunOperationalLifecycle(reducerInput({ protocol: "legacy", status, terminal: true }));
      assert.deepEqual(summary.operatorActions.stop, { allowed: false, reasonCode: "RUN_ALREADY_TERMINAL", stateHash: HASH });
      assert.deepEqual(summary.operatorActions.resume, { allowed: true, reasonCode: "RUN_CAN_BE_RESUMED", stateHash: HASH });
    }

    for (const protocol of ["shadow", "v3", null] as const) {
      const summary = reduceRunOperationalLifecycle(reducerInput({ protocol, status: "failed", terminal: true }));
      assert.deepEqual(summary.operatorActions.resume, {
        allowed: false,
        reasonCode: "COMPILER_PROTOCOL_RESUME_FORBIDDEN",
        stateHash: HASH,
      });
    }
  });

  it("keeps resume blocked but exposes bounded stop for quarantine-only invariants", () => {
    const base = reducerInput({ protocol: "v3", status: "running", terminal: false });
    const quarantineOnly = reduceRunOperationalLifecycle({
      ...base,
      invariants: [
        { code: "COMPLETION_REQUEST_QUARANTINED", severity: "error" },
        { code: "RUNTIME_SESSION_QUARANTINED", severity: "error" },
      ] as Parameters<typeof reduceRunOperationalLifecycle>[0]["invariants"],
    });
    assert.deepEqual(quarantineOnly.operatorActions.stop, {
      allowed: true,
      reasonCode: "RUN_CAN_BE_STOPPED_WITH_QUARANTINE_RECOVERY",
      stateHash: HASH,
    });
    assert.deepEqual(quarantineOnly.operatorActions.resume, {
      allowed: false,
      reasonCode: "COMPILER_PROTOCOL_RESUME_FORBIDDEN",
      stateHash: HASH,
    });

    const mixed = reduceRunOperationalLifecycle({
      ...base,
      invariants: [
        { code: "RUNTIME_SESSION_QUARANTINED", severity: "error" },
        { code: "ATTEMPT_CLAIM_BINDING_MISMATCH", severity: "error" },
      ] as Parameters<typeof reduceRunOperationalLifecycle>[0]["invariants"],
    });
    assert.deepEqual(mixed.operatorActions.stop, {
      allowed: false,
      reasonCode: "INVARIANT_VIOLATION_BLOCKS_ACTION",
      stateHash: HASH,
    });
  });

  it("denies legacy resume until ownership, every effect, outbox, and invariants are settled", () => {
    const base = reducerInput({ protocol: "legacy", status: "failed", terminal: true });
    const activeClaim = reduceRunOperationalLifecycle({
      ...base,
      claims: [{ state: "open" } as Parameters<typeof reduceRunOperationalLifecycle>[0]["claims"][number]],
    });
    assert.deepEqual(activeClaim.operatorActions.resume, {
      allowed: false,
      reasonCode: "ACTIVE_OWNERSHIP_PREVENTS_RESUME",
      stateHash: HASH,
    });

    const optionalEffectPending = reduceRunOperationalLifecycle({
      ...base,
      completionRequests: [{
        state: "accepted",
        effects: [{ mandatory: false, state: "pending" }],
      } as Parameters<typeof reduceRunOperationalLifecycle>[0]["completionRequests"][number]],
    });
    assert.deepEqual(optionalEffectPending.operatorActions.resume, {
      allowed: false,
      reasonCode: "ACTIVE_OWNERSHIP_PREVENTS_RESUME",
      stateHash: HASH,
    });

    const unpublishedOutbox = reduceRunOperationalLifecycle({
      ...base,
      outbox: [{ state: "pending" } as Parameters<typeof reduceRunOperationalLifecycle>[0]["outbox"][number]],
    });
    assert.deepEqual(unpublishedOutbox.operatorActions.resume, {
      allowed: false,
      reasonCode: "ACTIVE_OWNERSHIP_PREVENTS_RESUME",
      stateHash: HASH,
    });

    const invariantViolation = reduceRunOperationalLifecycle({
      ...base,
      invariants: [{ severity: "error" } as Parameters<typeof reduceRunOperationalLifecycle>[0]["invariants"][number]],
    });
    assert.deepEqual(invariantViolation.operatorActions.resume, {
      allowed: false,
      reasonCode: "INVARIANT_VIOLATION_BLOCKS_ACTION",
      stateHash: HASH,
    });
  });
  it("projects the complete claim-to-outbox chain with exact refs and no unsafe payload fields", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_snapshot-full-0001";
      await database.insertRun(runId);
      await attestSnapshotMigrationShape(database);
      const { claimId, attemptId } = await seedClaimAndAttempt(database, runId, "verified");
      const sessionId = "RTS_snapshot-full-0001";
      const requestId = "RCR_snapshot-full-0001";
      const terminationId = "RTR_snapshot-full-0001";
      const canonicalOutput = JSON.stringify({
        schema: "setfarm.v3-implementation-output-contract.v2",
        privatePayload: "TOP_SECRET_RAW_OUTPUT",
      });
      const sourceProposal = JSON.stringify({
        schema: "setfarm.v3-implementation-agent-proposal.v1",
        providerAnnotation: "TOP_SECRET_SOURCE_PROPOSAL",
      });
      const canonicalOutputHash = createHash("sha256").update(canonicalOutput, "utf8").digest("hex");
      const sourceProposalHash = createHash("sha256").update(sourceProposal, "utf8").digest("hex");
      const submissionEvidence = {
        schema: "setfarm.runtime-completion-submission-evidence.v1" as const,
        compiler: "setfarm.v3-implementation-output-compilation.v1" as const,
        sourceSchema: "setfarm.v3-implementation-agent-proposal.v1" as const,
        sourceProposalHash,
        canonicalOutputHash,
        ignoredFieldPaths: ["/providerAnnotation"],
      };

      await database.sql.unsafe(
        `INSERT INTO runtime_sessions (
           session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
           claim_id, attempt_id, claim_agent_id, runtime_agent_id, runtime_kind,
           session_key, worktree, runtime_path, transcript_path, state,
           owner_instance_id, state_version, heartbeat_at, drained_at, released_at
         ) VALUES (
           $1, $2, 'STEP_DB_1', 'implement', 'STORY_DB_1', 'US-001',
           $3, $4, 'feature-dev_developer', 'prism', 'openclaw_session',
           'SECRET_SESSION_KEY', '/secret/worktree', '/secret/runtime',
           'TOP_SECRET_TRANSCRIPT', 'released', 'SECRET_OWNER', 4, NOW(), NOW(), NOW()
         )`,
        [sessionId, runId, claimId, attemptId],
      );
      await database.sql.unsafe(
        `INSERT INTO runtime_completion_requests (
           request_id, runtime_session_id, claim_id, run_id, step_db_id,
           workflow_step_id, story_db_id, story_id, attempt_id, claim_envelope,
           output, output_hash, source_proposal, submission_evidence, apply_phase,
           claim_outcome, claim_committed_at, effects_committed_at, state,
           requested_by, requested_at, drained_at, processing_at, accepted_at,
           result, completion_plan,
           completion_plan_hash, prepared_at
         ) VALUES (
           $1, $2, $3, $4, 'STEP_DB_1', 'implement', 'STORY_DB_1', 'US-001', $5,
           $6::jsonb, $7, $8, $9, $10::jsonb, 'effects_committed', 'completed',
           NOW(), NOW(), 'accepted', 'runtime-agent', NOW(), NOW(), NOW(), NOW(),
           $11::jsonb, $12::jsonb, $13, NOW()
         )`,
        [
          requestId,
          sessionId,
          claimId,
          runId,
          attemptId,
          { protocol: "v3", fenceToken: "SECRET_ENVELOPE_FENCE" },
          canonicalOutput,
          canonicalOutputHash,
          sourceProposal,
          submissionEvidence,
          { raw: "SECRET_RESULT" },
          { schema: "setfarm.runtime-completion-plan.v1" },
          PLAN_HASH,
        ],
      );
      await database.sql.unsafe(
        `INSERT INTO runtime_completion_effects (
           request_id, effect_key, ordinal, effect_type, input_hash, payload,
           mandatory, state, result, evidence, applied_at
         ) VALUES (
           $1, 'continuation', 0, 'advance_pipeline', $2, $3::jsonb,
           TRUE, 'applied', $4::jsonb, $5::jsonb, NOW()
         )`,
        [
          requestId,
          INPUT_HASH,
          { raw: "SECRET_EFFECT_PAYLOAD" },
          { raw: "SECRET_EFFECT_RESULT" },
          { raw: "SECRET_EFFECT_EVIDENCE" },
        ],
      );
      const outboxRepository = createOperationalOutboxRepository(database.sql);
      await outboxRepository.enqueue({
        requestId,
        eventKey: "event-key-1",
        eventType: "run.completed",
        aggregateType: "run",
        aggregateId: runId,
        payload: {
          schema: "setfarm.operational-outbox-event.v1",
          raw: "SECRET_OUTBOX_PAYLOAD",
        },
      });
      const publisher = createOperationalOutboxPublisher({
        repository: outboxRepository,
        ownerInstanceId: "snapshot-test-publisher",
      });
      assert.equal((await publisher.publishNext()).status, "published");
      await database.sql.unsafe(
        `INSERT INTO run_termination_requests (
           request_id, run_id, target_status, state, requested_by,
           requested_at, drained_at, terminalized_at, diagnostic, evidence
         ) VALUES (
           $1, $2, 'failed', 'terminalized', 'setfarm.product-compiler.deploy-refusal',
           NOW(), NOW(), NOW(), 'V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal', $3::jsonb
         )`,
        [terminationId, runId, {
          schema: "setfarm.v3-deploy-authority-termination.v1",
          terminalFailure: true,
          owner: "compiler",
          refusalHash: INPUT_HASH,
          authorityCode: "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
          authorityEvidence: {
            runId,
            expectedSha: SHA,
            observedSha: TREE,
          },
          claimId: Number(claimId),
          modelRedispatchBudget: 0,
          runtimeSessionCount: 1,
          ownerInstanceId: "setfarm-spawner",
        }],
      );
      await database.sql.unsafe("UPDATE claim_log SET outcome = 'completed' WHERE id = $1", [claimId]);
      await database.sql.unsafe("UPDATE runs SET status = 'failed', updated_at = NOW() WHERE id = $1", [runId]);

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.schema, "setfarm.run-operational-snapshot.v2");
      assert.equal(snapshot.source.projection, "complete");
      assert.deepEqual(snapshot.source.capabilities, {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: true,
        implementationSubmissionEvidence: true,
        effectLedger: true,
        findingRecovery: true,
        evidenceLedger: true,
        acceptedCandidate: true,
        deploymentReceipt: true,
        projectTransferAck: true,
      });
      assert.deepEqual(snapshot.findingSets, []);
      assert.deepEqual(snapshot.evidenceBundles, []);
      assert.deepEqual(snapshot.recoveryCases, []);
      assert.deepEqual(snapshot.recoveryDispatches, []);
      assert.equal(snapshot.acceptedCandidate, null);
      assert.equal(snapshot.deploymentReceipt, null);
      assert.equal(snapshot.projectTransferAck, null);
      assert.equal(snapshot.run.ref, `setfarm://run/${runId}`);
      assert.equal(snapshot.claims[0]?.ref, `setfarm://claim-log/${claimId}`);
      assert.equal(snapshot.attempts[0]?.ref, `setfarm://execution-attempt/${attemptId}`);
      assert.equal(snapshot.attempts[0]?.claimRef, `setfarm://claim-log/${claimId}`);
      assert.equal(snapshot.runtimeSessions[0]?.ref, `setfarm://runtime-session/${sessionId}`);
      assert.equal(snapshot.completionRequests[0]?.ref, `setfarm://runtime-completion/${requestId}`);
      assert.deepEqual(snapshot.completionRequests[0]?.implementationSubmissionEvidence, {
        receipt: submissionEvidence,
        sourceProposalRef: `setfarm://runtime-completion/${requestId}/source-proposal/${sourceProposalHash}`,
      });
      assert.equal(snapshot.completionRequests[0]?.effects[0]?.ref, `setfarm://runtime-completion/${requestId}/effect/continuation`);
      assert.equal(snapshot.terminationRequests[0]?.ref, `setfarm://run-termination/${terminationId}`);
      assert.equal(snapshot.terminationRequests[0]?.requestedBy, "setfarm.product-compiler.deploy-refusal");
      assert.equal(snapshot.terminationRequests[0]?.diagnostic, "V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal");
      assert.deepEqual(snapshot.terminationRequests[0]?.evidence, {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        terminalFailure: true,
        owner: "compiler",
        refusalHash: INPUT_HASH,
        authorityCode: "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
        authorityEvidence: { runId, expectedSha: SHA, observedSha: TREE },
        claimId: Number(claimId),
        modelRedispatchBudget: 0,
        runtimeSessionCount: 1,
        ownerInstanceId: "setfarm-spawner",
      });
      assert.equal(snapshot.outbox[0]?.requestRef, `setfarm://runtime-completion/${requestId}`);
      assert.equal(snapshot.summary.lifecycleState, "terminal");
      assert.equal(snapshot.summary.health, "ok");
      assert.equal(snapshot.invariants.length, 0);
      assert.doesNotThrow(() => RunOperationalSnapshotV2Schema.parse(snapshot));
      assert.throws(
        () => RunOperationalSnapshotV2Schema.parse({
          ...snapshot,
          source: {
            ...snapshot.source,
            migrationVersions: snapshot.source.migrationVersions.filter((version) => version !== 19),
          },
        }),
        /attested migration 19 shape/,
      );
      const projectedCompletion = snapshot.completionRequests[0];
      assert.ok(projectedCompletion?.implementationSubmissionEvidence);
      assert.throws(
        () => RunOperationalSnapshotV2Schema.parse({
          ...snapshot,
          completionRequests: [{
            ...projectedCompletion,
            implementationSubmissionEvidence: {
              ...projectedCompletion.implementationSubmissionEvidence,
              receipt: {
                ...projectedCompletion.implementationSubmissionEvidence.receipt,
                canonicalOutputHash: HASH,
              },
            },
          }],
        }),
        /bind the completion output hash/,
      );

      const serialized = JSON.stringify(snapshot);
      for (const secret of [
        "FENCE_TOKEN_MUST_NOT_LEAK",
        "TOP_SECRET_RAW_OUTPUT",
        "TOP_SECRET_SOURCE_PROPOSAL",
        "TOP_SECRET_TRANSCRIPT",
        "SECRET_SESSION_KEY",
        "SECRET_ENVELOPE_FENCE",
        "SECRET_RESULT",
        "SECRET_EFFECT_PAYLOAD",
        "SECRET_EFFECT_RESULT",
        "SECRET_EFFECT_EVIDENCE",
        "SECRET_OUTBOX_PAYLOAD",
      ]) {
        assert.equal(serialized.includes(secret), false, `${secret} leaked into canonical snapshot`);
      }

      // Even a row marked published cannot become Mission Control evidence
      // without the immutable v12 canonical projection written in the same DB
      // transaction as settlement.
      await database.sql.unsafe(
        `INSERT INTO operational_outbox (
           outbox_id, event_key, event_type, aggregate_type, aggregate_id,
           payload, state, published_at
         ) VALUES (
           'OBX_orphan-published-without-canonical',
           'orphan-published-without-canonical', 'run.unsafe', 'run', $1,
           $2::text::jsonb, 'published', NOW()
         )`,
        [
          runId,
          JSON.stringify({ schema: "setfarm.operational-outbox-event.v1", unsafe: true }),
        ],
      );
      await database.sql.unsafe("SELECT pg_sleep(0.01)");
      const unchanged = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(unchanged);
      assert.equal(unchanged.outbox.length, 1);
      assert.notEqual(unchanged.generatedAt, snapshot.generatedAt);
      assert.equal(unchanged.snapshotHash, snapshot.snapshotHash);
      const { snapshotHash: _ignored, ...hashable } = unchanged;
      assert.equal(computeRunOperationalSnapshotHash(hashable), unchanged.snapshotHash);

      // The presentation boundary must independently re-bind the private bytes
      // even if storage protections are bypassed by a privileged corruption.
      await database.sql.unsafe(
        "ALTER TABLE runtime_completion_requests DISABLE TRIGGER trg_runtime_completion_submission_validate",
      );
      await database.sql.unsafe(
        "ALTER TABLE runtime_completion_requests DISABLE TRIGGER trg_runtime_completion_submission_evidence_immutable",
      );
      await database.sql.unsafe(
        "UPDATE runtime_completion_requests SET source_proposal = $2 WHERE request_id = $1",
        [requestId, JSON.stringify({ schema: "tampered-private-source-proposal" })],
      );
      await assert.rejects(
        buildRunOperationalSnapshot(database.sql, runId),
        /OPERATIONAL_SNAPSHOT_SUBMISSION_EVIDENCE_DB_BINDING_INVALID/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("projects the exact deploy receipt and Mission Control transfer acknowledgement", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_snapshot-deploy-receipt-v3";
      const attemptId = "ATT_snapshot-deploy-00000001";
      const storyId = "US-001";
      const sourceRevision = { sha: SHA, treeHash: TREE };
      const evidencePlanArtifactHash = "7".repeat(64);
      const startedAt = "2026-07-13T13:00:00.000Z";
      const completedAt = "2026-07-13T13:00:10.000Z";
      const observation = {
        kind: "runtime" as const,
        owner: "setfarm-orchestrator" as const,
        runtimeSessionId: "snapshot-deploy-proof",
        runtimeArtifactHash: INPUT_HASH,
        startedAt,
        completedAt,
      };
      const bundle = createEvidenceBundleV2({
        runId,
        storyId,
        packetHash: PACKET_HASH,
        sliceHash: SLICE_HASH,
        sourceRevision,
        attemptId,
        predicates: [{
          invariantRef: "INV_RUNTIME_HEALTH",
          predicateRef: "EVID_RUNTIME_HEALTH",
          required: true,
          verdict: "pass",
          observationRefs: [computeObservationRef(observation)],
        }],
        observations: [observation],
        artifacts: [{ hash: INPUT_HASH, mediaType: "application/json", locator: "evidence/deploy-health.json" }],
        runner: {
          id: "setfarm-canonical-evidence-runner",
          version: "1.0.0",
          environmentHash: HASH,
        },
        startedAt,
        completedAt,
      });
      const evidenceBundleHash = computeEvidenceBundleHash(bundle);
      const candidate = createAcceptedCandidateV1({
        runId,
        packetHash: PACKET_HASH,
        storyPlanHash: PLAN_HASH,
        sourceRevision,
        storyEvidence: [{
          storyId,
          attemptId,
          sliceHash: SLICE_HASH,
          evidencePlanHash: PLAN_HASH,
          evidencePlanArtifactHash,
          evidenceBundleHash,
          evidenceId: bundle.evidenceId,
          predicateRefs: ["EVID_RUNTIME_HEALTH"],
        }],
        acceptor: {
          id: "setfarm-final-tree-acceptor",
          version: "1.0.0",
          codeSha: SHA,
          environmentHash: HASH,
        },
      });
      const producer = JSON.stringify({
        pass: "snapshot-deploy-receipt-test",
        codeSha: SHA,
        toolVersions: {},
      });
      await database.sql.unsafe(
        `INSERT INTO semantic_artifacts (
           artifact_hash, artifact_type, byte_length, producer_metadata
         ) VALUES
           ($1, 'setfarm.product-build-packet.v1', 1, $4::text::jsonb),
           ($2, 'setfarm.implementation-slice.v1', 1, $4::text::jsonb),
           ($3, 'setfarm.evidence-plan.v1', 1, $4::text::jsonb)`,
        [PACKET_HASH, SLICE_HASH, evidencePlanArtifactHash, producer],
      );
      const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(SHA);
      await database.sql.unsafe(
        `INSERT INTO runs (
           id, workflow_id, task, status, protocol, compiler_release_sha,
           activation_preflight_hash, packet_hash, release_admission_hash
         ) VALUES ($1, 'feature-dev', 'canonical deploy receipt snapshot',
           'running', 'v3', $2, $3, $4, $5)`,
        [runId, SHA, INPUT_HASH, PACKET_HASH, releaseAdmissionHash],
      );
      await attestSnapshotMigrationShape(database);
      await database.sql.unsafe(
        `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
         VALUES ($1, $2, $3::text::jsonb)`,
        [runId, PACKET_HASH, JSON.stringify({ version: "3.0.0", codeSha: SHA })],
      );
      await database.sql.unsafe(
        `INSERT INTO execution_attempts (
           attempt_id, run_id, step_id, story_id, generation, fence_token,
           attempt_class, packet_hash, compilation_report_hash, slice_hash,
           source_before_sha, source_before_tree_hash, source_after_sha,
           source_after_tree_hash, role, agent_id, lease_acquired_at,
           lease_expires_at, heartbeat_at, disposition, output_hash,
           evidence_refs, created_at, updated_at
         ) VALUES (
           $1, $2, 'final-test', $3, 1, $4, 'evidence_only', $5, $6, $7,
           $8, $9, $8, $9, 'tester', 'feature-dev_tester', $10, $11, $11,
           'verified', $12, $13::text::jsonb, $10, $11
         )`,
        [
          attemptId,
          runId,
          storyId,
          "snapshot-deploy-fence",
          PACKET_HASH,
          HASH,
          SLICE_HASH,
          sourceRevision.sha,
          sourceRevision.treeHash,
          new Date(startedAt),
          new Date(completedAt),
          evidenceBundleHash,
          JSON.stringify([`setfarm://evidence-bundle/${evidenceBundleHash}`]),
        ],
      );
      await database.sql.unsafe(
        `INSERT INTO evidence_bundles (
           evidence_bundle_hash, evidence_id, run_id, story_id, packet_hash,
           slice_hash, source_sha, source_tree_hash, attempt_id,
           aggregate_verdict, payload, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pass', $10::text::jsonb, $11)`,
        [
          evidenceBundleHash,
          bundle.evidenceId,
          runId,
          storyId,
          PACKET_HASH,
          SLICE_HASH,
          sourceRevision.sha,
          sourceRevision.treeHash,
          attemptId,
          JSON.stringify(bundle),
          new Date(completedAt),
        ],
      );
      await database.sql.unsafe(
        `INSERT INTO accepted_candidates (
           candidate_hash, candidate_id, run_id, packet_hash, story_plan_hash,
           source_sha, source_tree_hash, integration_evidence_hash, payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb)`,
        [
          candidate.candidateHash,
          candidate.candidateId,
          runId,
          PACKET_HASH,
          candidate.storyPlanHash,
          sourceRevision.sha,
          sourceRevision.treeHash,
          candidate.integrationEvidenceHash,
          JSON.stringify(candidate),
        ],
      );
      const storyEvidence = candidate.storyEvidence[0]!;
      await database.sql.unsafe(
        `INSERT INTO accepted_candidate_story_evidence (
           candidate_hash, story_id, attempt_id, slice_hash,
           evidence_plan_hash, evidence_plan_artifact_hash,
           evidence_bundle_hash, evidence_id, predicate_refs
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text::jsonb)`,
        [
          candidate.candidateHash,
          storyEvidence.storyId,
          storyEvidence.attemptId,
          storyEvidence.sliceHash,
          storyEvidence.evidencePlanHash,
          storyEvidence.evidencePlanArtifactHash,
          storyEvidence.evidenceBundleHash,
          storyEvidence.evidenceId,
          JSON.stringify(storyEvidence.predicateRefs),
        ],
      );
      await database.sql.unsafe(
        "UPDATE runs SET accepted_candidate_hash = $2 WHERE id = $1",
        [runId, candidate.candidateHash],
      );
      const stepDbId = `${runId}-deploy-step`;
      await database.sql.unsafe(
        `INSERT INTO steps (
           id, run_id, step_id, agent_id, step_index, input_template, expects, status
         ) VALUES ($1, $2, 'deploy', 'deployer', 11, '', '', 'running')`,
        [stepDbId, runId],
      );
      const claimRows = await database.sql.unsafe<Array<{ id: number }>>(
        `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
         VALUES ($1, 'deploy', NULL, 'deployer', NOW())
         RETURNING id::integer AS id`,
        [runId],
      );
      const claimId = claimRows[0]!.id;
      const envelope = ClaimEnvelopeV1Schema.parse({
        schema: "setfarm.claim-envelope.v1",
        protocol: "v3",
        issuedAt: "2026-07-13T13:00:15.000Z",
        stepId: stepDbId,
        workflowStepId: "deploy",
        runId,
        claimId,
        claimAgentId: "deployer",
        runtimeAgentId: "setfarm-v3-deploy-executor",
      });
      const projectId = `prod-ledger-${candidate.candidateHash.slice(0, 12)}`;
      const port = 45321;
      const healthUrl = `http://127.0.0.1:${port}/`;
      const buildArtifact = createV3BuildArtifactV1({
        runId,
        schema: "setfarm.v3-build-artifact.v1",
        outputPaths: ["dist"],
        files: [{
          path: "dist/index.html",
          byteLength: 14,
          contentHash: "7".repeat(64),
          executable: false,
        }],
        totalBytes: 14,
      });
      const sealedRuntimeManifestHash = "8".repeat(64);
      const sealedRuntimeManifestEvidenceRef = `setfarm://deploy/sealed-runtime-manifest/${runId}/${candidate.candidateHash}/${buildArtifact.artifactHash}/${sealedRuntimeManifestHash}`;
      const ownerProcess = {
        schema: "setfarm.process-identity.v1" as const,
        pid: port,
        processStartedAt: "2026-07-13T13:00:18.000Z",
        processGroupId: port,
        source: "observed_os" as const,
      };
      const runtimeDataContractHash = "3".repeat(64);
      const volumeProvisioning = createV3RuntimeVolumeProvisioningV1({
        schema: "setfarm.v3-runtime-volume-provisioning.v1",
        runId,
        projectId,
        runtimeDataContractHash,
        writableVolumes: [],
        scratch: { kind: "none" },
      });
      const runtimeIsolation = createV3RuntimeIsolationAuthorityV1({
        schema: "setfarm.v3-runtime-isolation-authority.v1",
        adapterId: "darwin-sandbox-exec",
        adapterVersion: "1.0.0",
        runId,
        projectId,
        candidateHash: candidate.candidateHash,
        buildArtifactHash: buildArtifact.artifactHash,
        policyHash: "4".repeat(64),
        profileHash: "5".repeat(64),
        wrapperArtifactHash: "6".repeat(64),
        runtimeDataContractHash,
        volumeProvisioningHash: volumeProvisioning.volumeProvisioningHash,
      });
      const isolationChallenge = createV3RuntimeIsolationChallengeV1({
        schema: "setfarm.v3-runtime-isolation-challenge.v1",
        nonce: "9".repeat(64),
        authorityHash: runtimeIsolation.authorityHash,
        wrapperProcessIdentity: ownerProcess,
        deniedRootProbes: [
          { rootId: "sealed-runtime", outcome: "denied" },
          { rootId: "state-authority", outcome: "denied" },
        ],
        deniedReadProbes: [
          { authorityId: "launch-agents", outcome: "denied" },
          { authorityId: "mission-control-config", outcome: "denied" },
          { authorityId: "setfarm-config", outcome: "denied" },
        ],
        deniedNetworkProbes: [{ authorityId: "all-outbound", outcome: "denied" }],
        deniedProcessExecProbes: [{ executableId: "launchctl", outcome: "denied" }],
        deniedSignalProbes: [{ authorityId: "control-sentinel", outcome: "denied" }],
        allowedVolumeProbes: [],
        challengedAt: "2026-07-13T13:00:19.000Z",
      });
      const isolationProof = V3RuntimeIsolationProofV1Schema.parse({
        ...runtimeIsolation,
        schema: "setfarm.v3-runtime-isolation-proof.v1",
        challenge: isolationChallenge,
        checkedAt: "2026-07-13T13:00:20.000Z",
        checks: { runtimeIsolation: "pass" },
      });
      const sealAuthorityHash = "2".repeat(64);
      const sealAuthorityEvidenceRef = `setfarm://deploy/seal-authority/${runId}/${candidate.candidateHash}/${buildArtifact.artifactHash}/${sealAuthorityHash}`;
      const receipt = createV3DeployReceiptV1({
        schema: "setfarm.v3-deploy-receipt.v1",
        runId,
        candidateId: candidate.candidateId,
        candidateHash: candidate.candidateHash,
        packetHash: candidate.packetHash,
        project: {
          schema: "setfarm.v3-deploy-project.v1",
          productId: "PROD_LEDGER",
          projectId,
          displayName: "Receipt Snapshot",
          summary: "Canonical immutable deploy receipt projected to Mission Control.",
        },
        stack: {
          schema: "setfarm.v3-deploy-stack.v1",
          stackPackId: "vite-react-web-app",
          stackPackVersion: "1.1.0",
          stackPackContentHash: "6".repeat(64),
          platform: "web",
          techStack: "vite-react",
        },
        buildCommandId: "CMD_BUILD",
        previewCommandId: "CMD_PREVIEW",
        sourceBefore: sourceRevision,
        sourceAfter: sourceRevision,
        buildArtifact,
        runtime: {
          schema: "setfarm.v3-runtime-deployment.v1",
          mode: "local",
          projectId,
          serviceId: `process:${port}`,
          host: "127.0.0.1",
          port,
          healthUrl,
          deployUrl: `http://127.0.0.1:${port}/`,
          evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}`,
          buildArtifactHash: buildArtifact.artifactHash,
          buildArtifactEvidenceRef: buildArtifact.evidenceRef,
          sealedRuntimeRef: `setfarm://deploy/sealed-runtime/${runId}/${candidate.candidateHash}/${buildArtifact.artifactHash}`,
          sealedRuntimeManifestHash,
          sealedRuntimeManifestEvidenceRef,
          sealAuthorityHash,
          sealAuthorityEvidenceRef,
          runtimeDataContractHash,
          volumeProvisioning,
          runtimeIsolation,
        },
        health: {
          schema: "setfarm.v3-deploy-health-proof.v1",
          status: "pass",
          httpStatus: 200,
          checkedAt: "2026-07-13T13:00:20.000Z",
          evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}/health`,
          buildArtifactHash: buildArtifact.artifactHash,
          buildArtifactEvidenceRef: buildArtifact.evidenceRef,
          sealedRuntimeManifestHash,
          sealedRuntimeManifestEvidenceRef,
          listenerOwnership: {
            schema: "setfarm.v3-listener-ownership.v1",
            ownerProcess,
            listenerPids: [port],
            listenerProcesses: [ownerProcess],
            host: "127.0.0.1",
            port,
            checkedAt: "2026-07-13T13:00:20.000Z",
            evidenceRef: `setfarm://deploy/runtime/${runId}/${projectId}/listener/${port}`,
          },
          runtimeIsolation: isolationProof,
        },
        terminalProjectProjection: {
          schema: "setfarm.v3-terminal-project-projection.v1",
          owner: "mission-control-terminal-projector",
          state: "pending_terminal_projection",
          runId,
          candidateHash: candidate.candidateHash,
          projectId,
          serviceId: `process:${port}`,
          port,
          healthUrl,
          evidenceRef: `setfarm://run/${runId}/deploy-receipt`,
          buildArtifactHash: buildArtifact.artifactHash,
        },
        environmentNames: ["DATABASE_URL"],
        completedAt: "2026-07-13T13:00:25.000Z",
      });
      await createV3DeployReceiptRepository(database.sql).publishAndComplete({
        receipt,
        completion: {
          envelope,
          stepStatus: "done",
          stepOutput: `STATUS: done\nDEPLOY_RECEIPT_HASH: ${receipt.receiptHash}`,
          now: new Date("2026-07-13T13:00:30.000Z"),
        },
      });

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.source.capabilities.deploymentReceipt, true);
      assert.equal(snapshot.acceptedCandidate?.candidate.candidateHash, candidate.candidateHash);
      assert.equal(snapshot.deploymentReceipt?.ref, `setfarm://v3-deploy-receipts/${receipt.receiptHash}`);
      assert.deepEqual(snapshot.deploymentReceipt?.receipt, receipt);
      assert.equal(snapshot.deploymentReceipt?.receipt.runtime.serviceId, `process:${port}`);
      assert.equal(snapshot.deploymentReceipt?.receipt.runtime.deployUrl, `http://127.0.0.1:${port}/`);
      assert.equal(snapshot.summary.unpublishedOutbox, 1);
      assert.equal(snapshot.summary.lifecycleState, "effects_applying");
      assert.doesNotThrow(() => RunOperationalSnapshotV2Schema.parse(snapshot));

      const outbox = createOperationalOutboxPublisher({
        repository: createOperationalOutboxRepository(database.sql),
        ownerInstanceId: "snapshot-project-transfer-publisher",
        now: () => new Date("2026-07-13T13:01:00.000Z"),
      });
      assert.equal((await outbox.drain({ maxEvents: 10 })).published, 1);
      await database.sql.unsafe(
        "UPDATE runs SET status = 'completed', updated_at = $2 WHERE id = $1",
        [runId, new Date("2026-07-13T13:00:45.000Z")],
      );
      const terminalSnapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(terminalSnapshot);
      assert.equal(terminalSnapshot.summary.lifecycleState, "terminal");
      assert.equal(terminalSnapshot.summary.health, "ok");
      assert.equal(terminalSnapshot.projectTransferAck, null);

      const projectProjection = {
        id: receipt.project.projectId,
        name: receipt.project.displayName,
        description: receipt.project.summary,
        type: "web" as const,
        ports: { frontend: receipt.runtime.port },
        deployUrl: receipt.runtime.deployUrl,
        service: receipt.runtime.serviceId,
        serviceStatus: "active" as const,
        status: "active" as const,
        stack: [receipt.stack.techStack ?? receipt.stack.stackPackId].sort(),
        createdBy: "setfarm-v3-terminal-projector" as const,
        productCompilerProtocol: "v3" as const,
        workflowRunId: runId,
        setfarmRunIds: [runId],
        ...(terminalSnapshot.run.runNumber ? { runNumber: terminalSnapshot.run.runNumber } : {}),
        acceptedCandidateId: candidate.candidateId,
        acceptedCandidateHash: candidate.candidateHash,
        acceptedPacketHash: candidate.packetHash,
        acceptedSourceSha: candidate.sourceRevision.sha,
        acceptedSourceTreeHash: candidate.sourceRevision.treeHash,
        deploymentReceiptHash: receipt.receiptHash,
        deploymentReceiptRef: `setfarm://v3-deploy-receipts/${receipt.receiptHash}`,
        deploymentHealthRef: receipt.health.evidenceRef,
        deploymentHealthUrl: receipt.runtime.healthUrl,
        deployedAt: receipt.completedAt,
        completedAt: receipt.completedAt,
      };
      const projectionHash = hashCanonicalJson(projectProjection);
      const persistedAt = "2026-07-13T13:00:50.000Z";
      const projectRecordHash = hashCanonicalJson({
        schema: "mission-control.v3-canonical-project-record.v1",
        projection: projectProjection,
        projectionHash,
        persistedAt,
      });
      const ackPayload = {
        schema: "setfarm.v3-project-transfer-ack.v1" as const,
        ackVersion: 1 as const,
        runId,
        candidateId: candidate.candidateId,
        candidateHash: candidate.candidateHash,
        packetHash: candidate.packetHash,
        sourceRevision: candidate.sourceRevision,
        deploymentReceiptHash: receipt.receiptHash,
        deploymentReceiptRef: `setfarm://v3-deploy-receipts/${receipt.receiptHash}`,
        sourceSnapshotHash: terminalSnapshot.snapshotHash,
        projectId: receipt.project.projectId,
        projectProjection,
        projectionHash,
        projectRecordHash,
        projectRecordRef: `mission-control://projects/${receipt.project.projectId}/${projectRecordHash}`,
        persistedAt,
        projector: { service: "mission-control" as const, protocol: "v3" as const },
      };
      const acknowledgement = V3ProjectTransferAckV1Schema.parse({
        ...ackPayload,
        ackHash: hashCanonicalJson(ackPayload),
      });
      const hostileCallerTime = new Date("2999-01-01T00:00:00.000Z");
      const ackRepository = createV3ProjectTransferAckRepository(database.sql, {
        now: () => hostileCallerTime,
      });
      const publications = await Promise.all([
        ackRepository.publish(acknowledgement),
        ackRepository.publish(acknowledgement),
      ]);
      assert.deepEqual(publications.map((item) => item.status).sort(), ["committed", "existing"]);
      assert.deepEqual(await ackRepository.findByRunId(runId), acknowledgement);
      const acknowledgementTimes = await database.sql<Array<{
        ack_created_at: Date;
        run_updated_at: Date;
        outbox_created_at: Date;
      }>>`
        SELECT acknowledgement.created_at AS ack_created_at,
               run.updated_at AS run_updated_at,
               event.created_at AS outbox_created_at
          FROM v3_project_transfer_acks acknowledgement
          JOIN runs run ON run.id = acknowledgement.run_id
          JOIN operational_outbox event
            ON event.aggregate_id = run.id
           AND event.event_type = 'v3.project_transfer_acknowledged'
         WHERE acknowledgement.run_id = ${runId}
      `;
      assert.equal(acknowledgementTimes.length, 1);
      for (const value of Object.values(acknowledgementTimes[0]!)) {
        assert.ok(new Date(value).getTime() < hostileCallerTime.getTime());
      }
      await assert.rejects(
        database.sql`UPDATE v3_project_transfer_acks SET project_id = 'forged' WHERE run_id = ${runId}`,
        /ARTIFACT_IDENTITY_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql`UPDATE runs SET project_transfer_ack_hash = NULL WHERE id = ${runId}`,
        /SETFARM_PROJECT_TRANSFER_ACK_POINTER_IMMUTABLE/,
      );

      const acknowledgedSnapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(acknowledgedSnapshot);
      assert.equal(acknowledgedSnapshot.projectTransferAck?.acknowledgement.ackHash, acknowledgement.ackHash);
      assert.equal(acknowledgedSnapshot.summary.unpublishedOutbox, 1);
      assert.doesNotThrow(() => RunOperationalSnapshotV2Schema.parse(acknowledgedSnapshot));
      assert.equal((await outbox.drain({ maxEvents: 10 })).published, 1);
      const settledSnapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(settledSnapshot);
      assert.equal(settledSnapshot.summary.lifecycleState, "terminal");
      assert.equal(settledSnapshot.summary.health, "ok");
      assert.equal(settledSnapshot.projectTransferAck?.acknowledgement.projectRecordHash, projectRecordHash);
    } finally {
      await database.cleanup();
    }
  });

  it("reduces the #1996 terminal-run/closed-claim/active-attempt shape to inconsistent", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_snapshot-1996-0001";
      await database.insertRun(runId);
      const { claimId } = await seedClaimAndAttempt(database, runId, "claimed");
      await database.sql.unsafe(
        "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW() WHERE id = $1",
        [claimId],
      );
      await database.sql.unsafe("UPDATE runs SET status = 'failed', updated_at = NOW() WHERE id = $1", [runId]);

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.summary.activeClaims, 0);
      assert.equal(snapshot.summary.activeAttempts, 1);
      assert.equal(snapshot.summary.lifecycleState, "inconsistent");
      assert.equal(snapshot.summary.health, "blocked");
      assert.equal(snapshot.summary.operatorActions.resume.allowed, false);
      const codes = new Set(snapshot.invariants.map((invariant) => invariant.code));
      assert.equal(codes.has("TERMINAL_RUN_HAS_ACTIVE_ATTEMPT"), true);
      assert.equal(codes.has("CLOSED_CLAIM_HAS_ACTIVE_ATTEMPT"), true);
      assert.equal(snapshot.invariants.every((invariant) => invariant.refs.every((ref) => ref.startsWith("setfarm://"))), true);
    } finally {
      await database.cleanup();
    }
  });

  it("projects v11 finding, evidence, current revision, and delivered dispatch state without prose or lease secrets", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "RUN_snapshot-recovery-v11";
      await database.insertRun(runId);
      const findingRepository = createFindingRecoveryRepository(database.sql);
      const deliveryRepository = createRecoveryDeliveryRepository(database.sql);
      const attemptRepository = createAttemptRepository(database.sql);
      const findings = findingSet(runId);
      await database.sql`
        INSERT INTO stories (id, run_id, story_index, story_id, title, status)
        VALUES (${`${runId}-story`}, ${runId}, 1, ${findings.storyId}, 'Snapshot recovery story', 'failed')
      `;
      await findingRepository.putFindingSet(findings);
      const evidence = await findingRepository.putEvidenceBundle(evidenceBundle(runId));
      const opened = await findingRepository.openRecoveryCase(recoveryDraft(findings), {
        now: new Date("2026-07-13T08:01:00.000Z"),
      });
      const revision = await deliveryRepository.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
      assert.ok(revision);
      const authorized = await deliveryRepository.authorizeCurrentRevision({
        recoveryCaseId: opened.recoveryCase.recoveryCaseId,
        revisionId: revision.revisionId,
        expectedStateVersion: opened.recoveryCase.stateVersion,
        dispatchClass: "product_implementation",
      }, { now: new Date("2026-07-13T08:02:00.000Z") });
      assert.equal(authorized.status, "authorized");
      if (authorized.status !== "authorized") throw new Error("expected recovery authorization");
      const leased = await deliveryRepository.leaseNext({
        ownerInstanceId: "snapshot-recovery-worker",
        runId,
        storyId: findings.storyId,
        leaseMs: 60_000,
      }, { now: new Date("2026-07-13T08:03:00.000Z") });
      assert.ok(leased);
      const claimRows = await database.sql<Array<{ id: number }>>`
        INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
        VALUES (${runId}, 'implement', ${findings.storyId}, 'snapshot-recovery-agent')
        RETURNING id::integer AS id
      `;
      const claimId = claimRows[0]!.id;
      const reserved = await attemptRepository.reserve({
        claimId,
        runId,
        stepId: "implement",
        storyId: findings.storyId,
        attemptClass: "product_implementation",
        packetHash: findings.packetHash,
        compilationReportHash: HASH,
        sliceHash: EXECUTION_SLICE_HASH,
        sourceBefore: findings.sourceRevision,
        findingSetHash: findings.findingSetHash,
        recoveryCaseRevisionId: revision.revisionId,
        recoveryDispatchId: authorized.dispatch.dispatchId,
        recoveryDeliveryLease: {
          ownerInstanceId: leased.ownerInstanceId!,
          leaseToken: leased.leaseToken!,
        },
        role: "developer",
        agentId: "snapshot-recovery-agent",
        branch: "story/snapshot-recovery",
        worktree: ".worktrees/snapshot-recovery",
        evidenceRefs: [`setfarm://claim-log/${claimId}`],
      }, { now: new Date("2026-07-13T08:03:01.000Z") });
      assert.equal(reserved.status, "reserved");
      const failedDelivery = await deliveryRepository.completeDelivery({
        dispatchId: authorized.dispatch.dispatchId,
        revisionId: revision.revisionId,
        attemptId: reserved.attempt.attemptId,
        state: "failed",
        terminalResult: {
          reasonCode: "verification_failed",
          narrative: "SECRET_TERMINAL_RESULT_PROSE",
        },
        diagnostic: "SECRET_RECOVERY_DIAGNOSTIC",
      }, { now: new Date("2026-07-13T08:04:00.000Z") });
      assert.equal(failedDelivery?.state, "failed");

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.source.capabilities.findingRecovery, true);
      assert.equal(snapshot.source.capabilities.evidenceLedger, true);
      assert.equal(snapshot.findingSets?.[0]?.findingSetId, findings.findingSetId);
      assert.equal(snapshot.evidenceBundles?.[0]?.evidenceBundleHash, evidence.bundleHash);
      assert.equal(snapshot.evidenceBundles?.[0]?.aggregateVerdict, "fail");
      assert.equal(snapshot.evidenceBundles?.[0]?.predicateCount, 1);
      assert.equal(snapshot.evidenceBundles?.[0]?.observationCount, 1);

      const recoveryCase = snapshot.recoveryCases?.[0];
      assert.ok(recoveryCase);
      assert.equal(recoveryCase.revisionId, revision.revisionId);
      assert.equal(recoveryCase.revisionNumber, 1);
      assert.equal(recoveryCase.owner, "implement");
      assert.equal(recoveryCase.status, "repairing");
      assert.equal(recoveryCase.packetHash, findings.packetHash);
      assert.equal(recoveryCase.sliceHash, findings.sliceHash);
      assert.deepEqual(recoveryCase.sourceRevision, findings.sourceRevision);

      const dispatch = snapshot.recoveryDispatches?.[0];
      assert.ok(dispatch);
      assert.equal(dispatch.revisionId, revision.revisionId);
      assert.equal(dispatch.revisionNumber, 1);
      assert.equal(dispatch.deliveryState, "failed");
      assert.equal(dispatch.attemptId, reserved.attempt.attemptId);
      assert.equal(dispatch.attemptRef, `setfarm://execution-attempt/${reserved.attempt.attemptId}`);
      assert.equal(dispatch.claimRef, `setfarm://claim-log/${claimId}`);
      assert.equal(dispatch.executionSliceHash, EXECUTION_SLICE_HASH);
      assert.equal(dispatch.attemptCount, 1);
      assert.equal(dispatch.leaseOwnerInstanceId, "snapshot-recovery-worker");
      assert.equal(dispatch.terminalReasonCode, "verification_failed");
      assert.ok(dispatch.leaseExpiresAt);
      assert.ok(dispatch.terminalAt);
      assert.doesNotThrow(() => RunOperationalSnapshotV2Schema.parse(snapshot));

      const serialized = JSON.stringify(snapshot);
      assert.equal(serialized.includes(leased.leaseToken!), false);
      assert.equal(serialized.includes("SECRET_TERMINAL_RESULT_PROSE"), false);
      assert.equal(serialized.includes("SECRET_RECOVERY_DIAGNOSTIC"), false);
      assert.equal(serialized.includes("terminalResult"), false);
      assert.equal(serialized.includes("diagnostic"), false);

      await database.sql`DELETE FROM recovery_dispatch_deliveries WHERE dispatch_id = ${authorized.dispatch.dispatchId}`;
      const missingDelivery = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(missingDelivery);
      assert.deepEqual(missingDelivery.recoveryDispatches, []);
    } finally {
      await database.cleanup();
    }
  });

  it("reports a v4-shaped database as partial instead of an empty successful projection", async () => {
    const database = await createIsolatedTestDatabase({ migrate: false });
    try {
      await database.sql.unsafe(`
        CREATE TABLE setfarm_schema_migrations (
          version INTEGER PRIMARY KEY,
          verified_release_sha TEXT,
          verified_at TIMESTAMPTZ
        )
      `);
      await database.sql.unsafe(
        `INSERT INTO setfarm_schema_migrations (version, verified_release_sha, verified_at)
         SELECT version, $1, NOW() FROM generate_series(1, 4) AS version`,
        ["f".repeat(40)],
      );
      await database.sql.unsafe(`
        CREATE TABLE runs (
          id TEXT PRIMARY KEY,
          run_number INTEGER,
          protocol TEXT,
          status TEXT,
          updated_at TIMESTAMPTZ
        )
      `);
      await database.sql.unsafe(`
        CREATE TABLE claim_log (
          id BIGSERIAL PRIMARY KEY,
          run_id TEXT,
          step_id TEXT,
          story_id TEXT,
          agent_id TEXT,
          claimed_at TIMESTAMPTZ,
          outcome TEXT,
          abandoned_at TIMESTAMPTZ
        )
      `);
      await database.sql.unsafe(`
        CREATE TABLE execution_attempts (
          attempt_id TEXT PRIMARY KEY,
          run_id TEXT,
          step_id TEXT,
          story_id TEXT,
          generation INTEGER,
          attempt_class TEXT,
          packet_hash TEXT,
          compilation_report_hash TEXT,
          slice_hash TEXT,
          source_before_sha TEXT,
          source_before_tree_hash TEXT,
          source_after_sha TEXT,
          source_after_tree_hash TEXT,
          finding_set_hash TEXT,
          role TEXT,
          agent_id TEXT,
          disposition TEXT,
          output_hash TEXT,
          created_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ
        )
      `);
      const runId = "RUN_snapshot-v4-0001";
      await database.sql.unsafe(
        "INSERT INTO runs VALUES ($1, 44, 'shadow', 'running', NOW())",
        [runId],
      );
      await database.sql.unsafe(
        `INSERT INTO execution_attempts VALUES (
           'ATT_snapshot-v4-0001', $1, 'implement', 'US-001', 1,
           'evidence_only', NULL, $2, NULL, $3, $4, NULL, NULL, NULL,
           'developer', 'agent-v4', 'claimed', NULL, NOW(), NOW()
         )`,
        [runId, HASH, SHA, TREE],
      );

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.source.projection, "partial");
      assert.deepEqual(snapshot.source.migrationVersions, [1, 2, 3, 4]);
      assert.equal(snapshot.source.verifiedReleaseSha, "f".repeat(40));
      assert.deepEqual(snapshot.source.capabilities, {
        attempts: true,
        claimBinding: false,
        runtimeOwnership: false,
        managerCompletion: false,
        implementationSubmissionEvidence: false,
        effectLedger: false,
        findingRecovery: false,
        evidenceLedger: false,
        acceptedCandidate: false,
        deploymentReceipt: false,
        projectTransferAck: false,
      });
      assert.equal(snapshot.findingSets, undefined);
      assert.equal(snapshot.evidenceBundles, undefined);
      assert.equal(snapshot.recoveryCases, undefined);
      assert.equal(snapshot.recoveryDispatches, undefined);
      assert.equal(snapshot.acceptedCandidate, undefined);
      assert.equal(snapshot.deploymentReceipt, undefined);
      assert.equal(snapshot.projectTransferAck, undefined);
      assert.equal(snapshot.attempts.length, 1);
      assert.equal(snapshot.attempts[0]?.claimRef, null);
      assert.equal(snapshot.summary.lifecycleState, "claimed");
      assert.equal(snapshot.summary.health, "attention");
      assert.equal(snapshot.summary.operatorActions.stop.allowed, false);
      assert.deepEqual(snapshot.invariants.map((invariant) => invariant.code), ["OPERATIONAL_PROJECTION_PARTIAL"]);
    } finally {
      await database.cleanup();
    }
  });

  it("keeps the v2 projection readable on a pre-v19 manager-completion database", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.sql.unsafe(
        "DROP TRIGGER trg_runtime_completion_submission_validate ON runtime_completion_requests",
      );
      await database.sql.unsafe(
        "DROP TRIGGER trg_runtime_completion_submission_evidence_immutable ON runtime_completion_requests",
      );
      await database.sql.unsafe(
        "ALTER TABLE runtime_completion_requests DROP CONSTRAINT runtime_completion_requests_submission_evidence_check",
      );
      await database.sql.unsafe(
        "ALTER TABLE runtime_completion_requests DROP COLUMN submission_evidence, DROP COLUMN source_proposal",
      );
      await database.sql.unsafe("DELETE FROM setfarm_schema_migrations WHERE version = 19");
      const runId = "RUN_snapshot-pre-v19-manager-completion";
      await database.insertRun(runId);

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.schema, "setfarm.run-operational-snapshot.v2");
      assert.equal(snapshot.source.projection, "complete");
      assert.equal(snapshot.source.capabilities.managerCompletion, true);
      assert.equal(snapshot.source.capabilities.implementationSubmissionEvidence, false);
      assert.deepEqual(snapshot.completionRequests, []);
      assert.doesNotThrow(() => RunOperationalSnapshotV2Schema.parse(snapshot));
    } finally {
      await database.cleanup();
    }
  });

  it("does not advertise submission evidence from an unattested v19 shape", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await database.sql.unsafe(
        "UPDATE setfarm_schema_migrations SET verified_release_sha = NULL, verified_at = NULL",
      );
      const runId = "RUN_snapshot-unattested-v19";
      await database.insertRun(runId);

      const snapshot = await buildRunOperationalSnapshot(database.sql, runId);
      assert.ok(snapshot);
      assert.equal(snapshot.source.verifiedReleaseSha, null);
      assert.equal(snapshot.source.projection, "complete");
      assert.equal(snapshot.source.capabilities.managerCompletion, true);
      assert.equal(snapshot.source.capabilities.implementationSubmissionEvidence, false);
      assert.doesNotThrow(() => RunOperationalSnapshotV2Schema.parse(snapshot));
    } finally {
      await database.cleanup();
    }
  });

  it("uses an explicit repeatable-read, read-only transaction and strict schema", async () => {
    const source = await readFile(new URL("../src/server/run-operational-snapshot.ts", import.meta.url), "utf8");
    assert.match(source, /sql\.begin\(\s*["']isolation level repeatable read read only["']/);
    assert.throws(
      () => RunOperationalSnapshotV1Schema.parse({ schema: "setfarm.run-operational-snapshot.v1", unexpected: true }),
      /generatedAt|Required|Invalid input/,
    );
    assert.throws(
      () => RunOperationalSnapshotV2Schema.parse({ schema: "setfarm.run-operational-snapshot.v2", unexpected: true }),
      /generatedAt|Required|Invalid input/,
    );
  });

  it("fails closed on malformed or mismatched versioned compiler termination evidence", () => {
    const request = {
      ref: "setfarm://run-termination/RTR_projection-refusal-0001",
      requestId: "RTR_projection-refusal-0001",
      runRef: "setfarm://run/RUN_projection-refusal-0001",
      targetStatus: "failed",
      state: "terminalized",
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      diagnostic: "V3_DEPLOY_SOURCE_REVISION_MISMATCH:canonical refusal",
      evidence: {
        schema: "setfarm.v3-deploy-authority-termination.v1",
        terminalFailure: true,
        owner: "compiler",
        refusalHash: INPUT_HASH,
        authorityCode: "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
        authorityEvidence: { expectedSha: SHA, observedSha: TREE },
        claimId: 42,
        modelRedispatchBudget: 0,
      },
      requestedAt: "2026-07-13T12:00:00.000Z",
      drainedAt: "2026-07-13T12:00:01.000Z",
      terminalizedAt: "2026-07-13T12:00:02.000Z",
      createdAt: "2026-07-13T12:00:00.000Z",
      updatedAt: "2026-07-13T12:00:02.000Z",
    } as const;
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse(request));
    assert.throws(
      () => OperationalTerminationRequestV1Schema.parse({
        ...request,
        evidence: {
          ...request.evidence,
          authorityEvidence: {
            ...request.evidence.authorityEvidence,
            sourcePath: "/Users/setrox/private/generated-project",
          },
        },
      }),
      /Unrecognized key|unrecognized/i,
    );
    assert.throws(
      () => OperationalTerminationRequestV1Schema.parse({
        ...request,
        evidence: {
          ...request.evidence,
          authorityEvidence: {
            primaryFailure: "Error: failed at \/Users\/setrox\/private\/generated-project",
          },
        },
      }),
      /Unrecognized key|unrecognized/i,
    );
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.product-compiler.plan-refusal",
      diagnostic: "V3_PLAN_CLARIFICATION_REQUIRED:PRODUCT_SPEC_TASK_AMBIGUOUS:REQ_PRIMARY",
      evidence: {
        schema: "setfarm.v3-plan-clarification-termination.v1",
        terminalFailure: true,
        owner: "compiler",
        rejectionHash: HASH,
        sourceTaskHash: INPUT_HASH,
        reasonCodes: ["PRODUCT_SPEC_TASK_AMBIGUOUS"],
        requirementRefs: ["REQ_PRIMARY"],
        modelRedispatchBudget: 0,
      },
    }));
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      diagnostic: "packet_amendment_required:canonical contract gap",
      evidence: {
        schema: "setfarm.v3-downstream-termination-evidence.v1",
        routeHash: HASH,
        packetHash: INPUT_HASH,
        sourceRevision: { sha: SHA, treeHash: TREE },
        outcome: "packet_amendment_required",
        storyEvidenceRefs: ["setfarm://evidence-bundle/example"],
        requiredArtifact: "setfarm.product-build-packet.v.next",
      },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      evidence: { ...request.evidence, modelRedispatchBudget: 1 },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "agent-prose-classifier",
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      evidence: { schema: "setfarm.v3-deploy-authority-termination.v2" },
    }));
    const genericOperationalCause = {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: "setup-build",
      boundary: "stitch.converter.generated_tsx",
      failureClass: "generated_artifact_invalid",
      failureCode: "V3_OBSERVABLE_REF_INVALID",
    } as const;
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.step-fail.single",
      evidence: {
        schema: "setfarm.v3-stitch-converter-termination.v1",
        operationalFailureCause: genericOperationalCause,
        diagnosticRef: "setfarm://observation/converter-failure",
      },
    }));
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.step-fail.single",
      evidence: {
        operationalFailureCause: genericOperationalCause,
        diagnosticRef: "setfarm://observation/converter-failure",
      },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.step-fail.single",
      evidence: {
        schema: "setfarm.v3-stitch-converter-termination.v1",
        operationalFailureCause: { ...genericOperationalCause, runId: "volatile-run" },
      },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "agent-prose-classifier",
      evidence: { operationalFailureCause: genericOperationalCause },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      targetStatus: "cancelled",
      requestedBy: "operator",
      evidence: { operationalFailureCause: genericOperationalCause },
    }));
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.v3-stage-input-authority",
      evidence: {
        schema: "setfarm.v3-stage-input-unresolved.v1",
        missingVariables: ["required_contract"],
        modelRedispatchBudget: 0,
        operationalFailureCause: {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "verify",
          boundary: "stage_context_assembly",
          failureClass: "contract_invalid",
          failureCode: "V3_STAGE_INPUT_UNRESOLVED",
        },
      },
    }));
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.v3-stage-retry-authority",
      evidence: {
        schema: "setfarm.v3-stage-retry-dedupe-block.v1",
        dedupeKey: HASH,
        modelRedispatchBudget: 0,
        operationalFailureCause: {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "final-test",
          boundary: "stage_retry_authority",
          failureClass: "retry_delta_missing",
          failureCode: "V3_STAGE_RETRY_DUPLICATE_UNCHANGED_TUPLE",
        },
      },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm.v3-stage-input-authority",
      evidence: {
        schema: "setfarm.v3-stage-retry-dedupe-block.v1",
        dedupeKey: HASH,
        modelRedispatchBudget: 0,
      },
    }));
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      evidence: {
        schema: "setfarm.v3-downstream-termination-evidence.v1",
        routeHash: HASH,
        packetHash: INPUT_HASH,
        sourceRevision: { sha: SHA, treeHash: TREE },
        outcome: "bounded_recovery_blocked",
        storyEvidenceRefs: ["setfarm://evidence-bundle/historical-v1"],
      },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      evidence: {
        schema: "setfarm.v3-downstream-termination-evidence.v1",
        routeHash: HASH,
        packetHash: INPUT_HASH,
        sourceRevision: { sha: SHA, treeHash: TREE },
        outcome: "packet_amendment_required",
        storyEvidenceRefs: ["setfarm://evidence-bundle/contradictory-v1"],
        requiredArtifact: "setfarm.product-build-packet.v.next",
        terminalReasonCodes: ["budget_exhausted"],
      },
    }));
    const boundedDownstreamEvidence = {
      schema: "setfarm.v3-downstream-termination-evidence.v1" as const,
      routeHash: HASH,
      packetHash: INPUT_HASH,
      sourceRevision: { sha: SHA, treeHash: TREE },
      outcome: "bounded_recovery_blocked" as const,
      storyEvidenceRefs: ["setfarm://evidence-bundle/example"],
      terminalReasonCodes: ["specification_incomplete", "operator_required"] as const,
      operationalFailureCause: {
        schema: "setfarm.operational-failure-cause.v1" as const,
        workflowStepId: "qa-test",
        boundary: "product_compiler.downstream_recovery",
        failureClass: "contract_invalid",
        failureCode: "V3_DOWNSTREAM_TERMINAL_REASON_SET_21",
      },
    };
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      evidence: boundedDownstreamEvidence,
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      evidence: {
        ...boundedDownstreamEvidence,
        terminalReasonCodes: ["budget_exhausted"],
      },
    }), /EVIDENCE_BINDING_INVALID/);
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      evidence: {
        ...boundedDownstreamEvidence,
        terminalReasonCodes: ["operator_required", "specification_incomplete"],
      },
    }), /EVIDENCE_BINDING_INVALID/);
    assert.doesNotThrow(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      evidence: {
        ...request.evidence,
        operationalFailureCause: {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "deploy",
          boundary: "product_compiler.deploy_authority",
          failureClass: "contract_invalid",
          failureCode: "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
        },
      },
    }));
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      evidence: {
        ...request.evidence,
        operationalFailureCause: {
          schema: "setfarm.operational-failure-cause.v1",
          workflowStepId: "deploy",
          boundary: "product_compiler.deploy_authority",
          failureClass: "contract_invalid",
          failureCode: "V3_DEPLOY_PACKET_INVALID",
        },
      },
    }), /EVIDENCE_BINDING_INVALID/);
    assert.throws(() => OperationalTerminationRequestV1Schema.parse({
      ...request,
      requestedBy: "setfarm-v3-downstream-compiler",
      evidence: {
        schema: "setfarm.v3-downstream-termination-evidence.v1",
        routeHash: HASH,
        packetHash: INPUT_HASH,
        sourceRevision: { sha: SHA, treeHash: TREE },
        outcome: "packet_amendment_required",
        storyEvidenceRefs: [],
      },
    }));
  });
});
