import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  publishLoopClaimRuntime,
  publishSingleClaimRuntime,
} from "../../src/execution/claim-runtime-publication.js";
import { requestRunTermination } from "../../src/execution/run-termination.js";
import { releaseReservedRuntimeSessionInTransaction } from "../../src/execution/runtime-session-repository.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import type { RecoveryCaseDraftV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import {
  V3RecoveryClaimAuthorityError,
  V3RecoveryClaimHandoffV1Schema,
  createV3RecoveryClaimAuthority,
  type V3RecoveryClaimHandoffV1,
} from "../../src/recovery/v3-recovery-claim-authority.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const PACKET_HASH = "a".repeat(64);
const CONTRACT_SLICE_HASH = "b".repeat(64);
const EVIDENCE_HASH = "c".repeat(64);
const CONTENT_HASH = "d".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE_HASH = "2".repeat(40);
const RECOVERY_LEASE_AT = new Date("2026-07-13T10:00:00.000Z");

function runtimeIntent(sessionId: string, runtimeAgentId = "prism") {
  return {
    schema: "setfarm.runtime-claim-intent.v1" as const,
    sessionId,
    runtimeAgentId,
    runtimeKind: "openclaw_session" as const,
    ownerInstanceId: "spawner-test",
    sessionKey: `key:${sessionId}`,
  };
}

async function seedSingle(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  await database.insertRun(runId);
  const stepDbId = `${runId}-step`;
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status)
    VALUES
      (${stepDbId}, ${runId}, 'plan', 'feature-dev_planner', 1, '', '', 'pending')
  `;
  return stepDbId;
}

async function seedLoop(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  protocol: "shadow" | "v3" = "shadow",
) {
  if (protocol === "v3") {
    const releaseSha = "3".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
       ) VALUES ($1, 'feature-dev', 'claim publication test', 'running', 'v3', 1, $2, $3, $4, $5)`,
      [runId, releaseSha, PACKET_HASH, "e".repeat(64), releaseAdmissionHash],
    );
  } else {
    await database.insertRun(runId);
  }
  const stepDbId = `${runId}-step`;
  const storyDbId = `${runId}-story`;
  await database.sql`
    INSERT INTO steps
      (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type)
    VALUES
      (${stepDbId}, ${runId}, 'implement', 'feature-dev_developer', 1, '', '', 'pending', 'loop')
  `;
  await database.sql`
    INSERT INTO stories
      (id, run_id, story_index, story_id, title, status, claim_generation)
    VALUES
      (${storyDbId}, ${runId}, 1, 'US-001', 'Story', 'pending', 0)
  `;
  return { stepDbId, storyDbId };
}

function recoveryFindingSet(runId: string) {
  return createFindingSetV1({
    runId,
    storyId: "US-001",
    packetHash: PACKET_HASH,
    sliceHash: CONTRACT_SLICE_HASH,
    sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE_HASH },
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_SAVE_RELOAD",
      sourceLocators: [{ path: "src/App.tsx", contentHash: CONTENT_HASH }],
      observedEvidenceRefs: [EVIDENCE_HASH],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function recoveryDraft(
  findingSet: ReturnType<typeof recoveryFindingSet>,
): RecoveryCaseDraftV1 {
  return {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
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
      limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status: "open",
    decisionRefs: [],
  };
}

async function seedRecoveryCase(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
  storyStatus: "pending" | "failed" = "failed",
) {
  const loop = await seedLoop(database, runId, "v3");
  await database.sql`
    UPDATE stories SET status = ${storyStatus} WHERE id = ${loop.storyDbId}
  `;
  const findingSet = recoveryFindingSet(runId);
  const findings = createFindingRecoveryRepository(database.sql);
  await findings.putFindingSet(findingSet);
  const opened = await findings.openRecoveryCase(recoveryDraft(findingSet), {
    now: new Date("2026-07-13T09:59:58.000Z"),
  });
  const deliveries = createRecoveryDeliveryRepository(database.sql);
  const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
  assert.ok(revision);
  return {
    ...loop,
    findingSet,
    recoveryCase: opened.recoveryCase,
    revision,
    deliveries,
  };
}

async function seedRecoveryLoop(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  runId: string,
) {
  const fixture = await seedRecoveryCase(database, runId);
  const authorization = await fixture.deliveries.authorizeCurrentRevision({
    recoveryCaseId: fixture.recoveryCase.recoveryCaseId,
    revisionId: fixture.revision.revisionId,
    expectedStateVersion: fixture.recoveryCase.stateVersion,
    dispatchClass: "product_implementation",
  }, { now: new Date("2026-07-13T09:59:59.000Z") });
  assert.equal(authorization.status, "authorized");
  if (authorization.status !== "authorized") throw new Error("expected recovery dispatch authorization");
  return {
    ...fixture,
    dispatch: authorization.dispatch,
  };
}

async function acquireRecoveryHandoff(
  database: Awaited<ReturnType<typeof createIsolatedTestDatabase>>,
  input: Readonly<{ runId: string; ownerInstanceId?: string; leaseMs?: number }>,
): Promise<V3RecoveryClaimHandoffV1> {
  return createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
    runId: input.runId,
    storyId: "US-001",
    ownerInstanceId: input.ownerInstanceId ?? "recovery-worker",
    leaseMs: input.leaseMs ?? 60_000,
  }, { now: RECOVERY_LEASE_AT });
}

function recoveryPublicationInput(
  runId: string,
  loop: Readonly<{ stepDbId: string; storyDbId: string }>,
  sessionId: string,
  recoveryHandoff?: V3RecoveryClaimHandoffV1,
) {
  return {
    runId,
    stepDbId: loop.stepDbId,
    workflowStepId: "implement",
    storyDbId: loop.storyDbId,
    storyId: "US-001",
    claimAgentId: "recovery-implement-agent",
    callerGatewayAgent: "supervisor-gateway-pool",
    parallelLimit: 1,
    runtimeIntent: runtimeIntent(sessionId, "recovery-runtime-agent"),
    ...(recoveryHandoff ? { recoveryHandoff } : {}),
    now: new Date("2026-07-13T10:00:01.000Z"),
  } as const;
}

describe("atomic claim and durable runtime publication", () => {
  it("publishes a single claim, running step, and reserved runtime in one commit", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-publication";
      const stepDbId = await seedSingle(database, runId);
      const result = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-publication-01"),
      });
      assert.ok(result);
      const rows = await database.sql<Array<{
        step_status: string;
        claim_count: number;
        session_count: number;
        claim_id: number;
        session_claim_id: number;
        session_state: string;
      }>>`
        SELECT s.status AS step_status,
               COUNT(DISTINCT cl.id)::integer AS claim_count,
               COUNT(DISTINCT rs.session_id)::integer AS session_count,
               MIN(cl.id)::integer AS claim_id,
               MIN(rs.claim_id)::integer AS session_claim_id,
               MIN(rs.state) AS session_state
          FROM steps s
          JOIN claim_log cl ON cl.run_id = s.run_id AND cl.step_id = s.step_id
          JOIN runtime_sessions rs ON rs.claim_id = cl.id
         WHERE s.id = ${stepDbId}
         GROUP BY s.status
      `;
      assert.deepEqual({ ...rows[0] }, {
        step_status: "running",
        claim_count: 1,
        session_count: 1,
        claim_id: result!.claimId,
        session_claim_id: result!.claimId,
        session_state: "reserved",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back step and claim publication when runtime reservation fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const firstRun = "run-publication-fault-a";
      const firstStep = await seedSingle(database, firstRun);
      const duplicateSessionId = "RTS_publication-fault-01";
      await publishSingleClaimRuntime(database.sql, {
        runId: firstRun,
        stepDbId: firstStep,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(duplicateSessionId),
      });

      const secondRun = "run-publication-fault-b";
      const secondStep = await seedSingle(database, secondRun);
      await assert.rejects(
        publishSingleClaimRuntime(database.sql, {
          runId: secondRun,
          stepDbId: secondStep,
          workflowStepId: "plan",
          claimAgentId: "feature-dev_planner",
          runtimeIntent: runtimeIntent(duplicateSessionId),
        }),
        /duplicate key value|unique constraint/i,
      );
      const state = await database.sql<Array<{ status: string; claims: number }>>`
        SELECT s.status, COUNT(cl.id)::integer AS claims
          FROM steps s
          LEFT JOIN claim_log cl ON cl.run_id = s.run_id
         WHERE s.id = ${secondStep}
         GROUP BY s.status
      `;
      assert.deepEqual({ ...state[0] }, { status: "pending", claims: 0 });
    } finally {
      await database.cleanup();
    }
  });

  it("does not republish the same single-step work until its previous runtime owner is released", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-single-unreleased-owner";
      const stepDbId = await seedSingle(database, runId);
      const firstSessionId = "RTS_single-unreleased-owner-01";
      const first = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(firstSessionId),
      });
      assert.ok(first);

      await database.sql.begin(async (transaction) => {
        await transaction.unsafe(
          "UPDATE claim_log SET outcome = 'infra_retry', abandoned_at = NOW() WHERE id = $1",
          [first!.claimId],
        );
        await transaction.unsafe(
          "UPDATE steps SET status = 'pending', updated_at = NOW() WHERE id = $1",
          [stepDbId],
        );
      });

      const blocked = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-unreleased-owner-02"),
      });
      assert.equal(blocked, undefined);

      await database.sql.begin((transaction) => releaseReservedRuntimeSessionInTransaction(transaction, {
        sessionId: firstSessionId,
        claimId: first!.claimId,
        ownerInstanceId: "spawner-test",
        diagnostic: "test proved the first runtime never spawned",
      }));
      const retried = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_single-unreleased-owner-03"),
      });
      assert.ok(retried);
      assert.notEqual(retried!.claimId, first!.claimId);
    } finally {
      await database.cleanup();
    }
  });

  it("serializes cancellation before claim publication on the run row", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-cancel-first-publication";
      const stepDbId = await seedSingle(database, runId);
      await requestRunTermination(database.sql, {
        runId,
        targetStatus: "cancelled",
        requestedBy: "test",
        diagnostic: "cancel first",
        requestId: "RTR_cancel-first-publish01",
      });
      const claim = await publishSingleClaimRuntime(database.sql, {
        runId,
        stepDbId,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent("RTS_cancel-first-publish01"),
      });
      assert.equal(claim, undefined);
      const rows = await database.sql<Array<{ run_status: string; step_status: string; claims: number; sessions: number }>>`
        SELECT r.status AS run_status, s.status AS step_status,
               COUNT(DISTINCT cl.id)::integer AS claims,
               COUNT(DISTINCT rs.session_id)::integer AS sessions
          FROM runs r
          JOIN steps s ON s.run_id = r.id
          LEFT JOIN claim_log cl ON cl.run_id = r.id
          LEFT JOIN runtime_sessions rs ON rs.run_id = r.id
         WHERE r.id = ${runId}
         GROUP BY r.status, s.status
      `;
      assert.deepEqual({ ...rows[0] }, {
        run_status: "cancelling",
        step_status: "pending",
        claims: 0,
        sessions: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("publishes exactly one loop claim and runtime under concurrent claimers", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-loop-publication-race";
      const { stepDbId, storyDbId } = await seedLoop(database, runId);
      const input = {
        runId,
        stepDbId,
        workflowStepId: "implement",
        storyDbId,
        storyId: "US-001",
        claimAgentId: "feature-dev_developer",
        callerGatewayAgent: "prism",
        parallelLimit: 1,
      } as const;
      const [left, right] = await Promise.all([
        publishLoopClaimRuntime(database.sql, {
          ...input,
          runtimeIntent: runtimeIntent("RTS_loop-publication-left"),
        }),
        publishLoopClaimRuntime(database.sql, {
          ...input,
          runtimeIntent: runtimeIntent("RTS_loop-publication-right"),
        }),
      ]);
      assert.equal([left, right].filter(Boolean).length, 1);
      const rows = await database.sql<Array<{ claims: number; sessions: number; generation: number; story_status: string }>>`
        SELECT COUNT(DISTINCT cl.id)::integer AS claims,
               COUNT(DISTINCT rs.session_id)::integer AS sessions,
               MAX(st.claim_generation)::integer AS generation,
               MIN(st.status) AS story_status
          FROM stories st
          LEFT JOIN claim_log cl ON cl.run_id = st.run_id AND cl.story_id = st.story_id
          LEFT JOIN runtime_sessions rs ON rs.claim_id = cl.id
         WHERE st.id = ${storyDbId}
      `;
      assert.deepEqual({ ...rows[0] }, {
        claims: 1,
        sessions: 1,
        generation: 1,
        story_status: "running",
      });
    } finally {
      await database.cleanup();
    }
  });

  it("fails closed for normal v3 publication while an active recovery delivery owns the story", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const blockedRunId = "run-v3-normal-blocked-by-recovery";
      const blockedFixture = await seedRecoveryLoop(database, blockedRunId);
      const blocked = await publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
        blockedRunId,
        blockedFixture,
        "RTS_v3-normal-blocked",
      ));
      assert.equal(blocked, undefined);
      const blockedState = await database.sql<Array<{
        story_status: string;
        step_status: string;
        claims: number;
        sessions: number;
        assigned_developer: string | null;
      }>>`
        SELECT story.status AS story_status,
               step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${blockedRunId}) AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${blockedRunId}) AS sessions,
               run.assigned_developer
          FROM stories story
          JOIN steps step ON step.run_id = story.run_id
          JOIN runs run ON run.id = story.run_id
         WHERE story.id = ${blockedFixture.storyDbId}
           AND step.id = ${blockedFixture.stepDbId}
      `;
      assert.deepEqual({ ...blockedState[0] }, {
        story_status: "failed",
        step_status: "pending",
        claims: 0,
        sessions: 0,
        assigned_developer: null,
      });

      const normalRunId = "run-v3-normal-publication-mode";
      const normalLoop = await seedLoop(database, normalRunId, "v3");
      const normal = await publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
        normalRunId,
        normalLoop,
        "RTS_v3-normal-publication",
      ));
      assert.ok(normal);
      assert.deepEqual(normal!.claimAuthority, { mode: "normal" });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes pending normal publication against recovery authorization with one authority winner", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-authorization-normal-race";
      const fixture = await seedRecoveryCase(database, runId, "pending");
      const publicationInput = recoveryPublicationInput(
        runId,
        fixture,
        "RTS_v3-authorization-normal-race",
      );
      const [normalResult, authorizationResult] = await Promise.allSettled([
        publishLoopClaimRuntime(database.sql, publicationInput),
        fixture.deliveries.authorizeCurrentRevision({
          recoveryCaseId: fixture.recoveryCase.recoveryCaseId,
          revisionId: fixture.revision.revisionId,
          expectedStateVersion: fixture.recoveryCase.stateVersion,
          dispatchClass: "product_implementation",
        }, { now: new Date("2026-07-13T10:00:00.000Z") }),
      ]);

      assert.equal(normalResult.status, "fulfilled");
      if (normalResult.status !== "fulfilled") throw normalResult.reason;
      assert.ok(normalResult.value);
      assert.equal(normalResult.value.claimAuthority?.mode, "normal");
      assert.equal(authorizationResult.status, "rejected");
      if (authorizationResult.status !== "rejected") {
        throw new Error(`expected recovery authorization rejection, got ${authorizationResult.value.status}`);
      }
      assert.match(String(authorizationResult.reason), /RECOVERY_DISPATCH_STORY_NOT_FAILED:(pending|running)/);

      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        claims: number;
        sessions: number;
        dispatches: number;
        deliveries: number;
        state_version: number;
        used_implement: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${runId}) AS sessions,
               (SELECT COUNT(*)::integer FROM recovery_revision_dispatches WHERE recovery_case_id = recovery.recovery_case_id) AS dispatches,
               (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries WHERE recovery_case_id = recovery.recovery_case_id) AS deliveries,
               recovery.state_version,
               recovery.used_implement
          FROM stories story
          JOIN recovery_cases recovery
            ON recovery.run_id = story.run_id AND recovery.story_id = story.story_id
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "running",
        claim_generation: 1,
        claims: 1,
        sessions: 1,
        dispatches: 0,
        deliveries: 0,
        state_version: fixture.recoveryCase.stateVersion,
        used_implement: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("publishes an exact lease-reissued recovery handoff without taking the normal gateway assignment", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-exact-recovery-publication";
      const fixture = await seedRecoveryLoop(database, runId);
      const leased = await acquireRecoveryHandoff(database, {
        runId,
        ownerInstanceId: "exact-recovery-owner",
      });
      const handoff = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
        runId,
        storyId: "US-001",
        ownerInstanceId: leased.lease.ownerInstanceId,
        continuation: {
          kind: "unreserved_lease",
          leaseToken: leased.lease.leaseToken,
        },
      }, { now: new Date("2026-07-13T10:00:00.500Z") });
      assert.equal(handoff.status, "lease_reissued");

      const publication = await publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
        runId,
        fixture,
        "RTS_v3-exact-recovery",
        handoff,
      ));
      assert.ok(publication);
      assert.deepEqual(publication!.claimAuthority, { mode: "recovery", handoff });
      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        claimed_by: string | null;
        step_status: string;
        current_story_id: string | null;
        assigned_developer: string | null;
        claim_agent_id: string;
        session_state: string;
        runtime_agent_id: string;
        delivery_state: string;
        attempt_id: string | null;
        delivery_claim_id: string | number | null;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               story.claimed_by,
               step.status AS step_status,
               step.current_story_id,
               run.assigned_developer,
               claim.agent_id AS claim_agent_id,
               runtime.state AS session_state,
               runtime.runtime_agent_id,
               delivery.state AS delivery_state,
               delivery.attempt_id,
               delivery.claim_id AS delivery_claim_id
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
          JOIN runs run ON run.id = story.run_id
          JOIN claim_log claim ON claim.run_id = story.run_id AND claim.story_id = story.story_id
          JOIN runtime_sessions runtime ON runtime.claim_id = claim.id
          JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = ${handoff.dispatchId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "running",
        claim_generation: 1,
        claimed_by: "recovery-implement-agent",
        step_status: "running",
        current_story_id: fixture.storyDbId,
        assigned_developer: null,
        claim_agent_id: "recovery-implement-agent",
        session_state: "reserved",
        runtime_agent_id: "recovery-runtime-agent",
        delivery_state: "leased",
        attempt_id: null,
        delivery_claim_id: null,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("serializes concurrent normal and recovery publication so only the recovery owner can publish", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-normal-recovery-publication-race";
      const fixture = await seedRecoveryLoop(database, runId);
      const handoff = await acquireRecoveryHandoff(database, { runId });
      const [normal, recovery] = await Promise.all([
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-race-normal-session",
        )),
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-race-recovery",
          handoff,
        )),
      ]);
      assert.equal([normal, recovery].filter(Boolean).length, 1);
      assert.equal(normal, undefined);
      assert.equal(recovery?.claimAuthority?.mode, "recovery");
      const counts = await database.sql<Array<{
        claims: number;
        sessions: number;
        story_status: string;
        claim_generation: number;
      }>>`
        SELECT (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${runId}) AS sessions,
               status AS story_status,
               claim_generation
          FROM stories
         WHERE id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...counts[0] }, {
        claims: 1,
        sessions: 1,
        story_status: "running",
        claim_generation: 1,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rejects forged, stale, and attempt-bound recovery handoffs without publishing ownership", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const runId = "run-v3-invalid-recovery-publication";
      const fixture = await seedRecoveryLoop(database, runId);
      const handoff = await acquireRecoveryHandoff(database, { runId });
      const forgedLease = V3RecoveryClaimHandoffV1Schema.parse({
        ...handoff,
        lease: { ...handoff.lease, leaseToken: "f".repeat(64) },
      });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-forged-lease-session",
          forgedLease,
        )),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_LEASE_INVALID",
      );

      const forgedDirective = V3RecoveryClaimHandoffV1Schema.parse({
        ...handoff,
        directive: { ...handoff.directive, contractSliceHash: "f".repeat(64) },
      });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-forged-directive",
          forgedDirective,
        )),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_DIRECTIVE_MISMATCH",
      );

      await assert.rejects(
        publishLoopClaimRuntime(database.sql, {
          ...recoveryPublicationInput(runId, fixture, "RTS_v3-stale-lease-session", handoff),
          now: new Date("2026-07-13T10:01:01.000Z"),
        }),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_LEASE_INVALID",
      );

      const attemptBound = V3RecoveryClaimHandoffV1Schema.parse({
        ...handoff,
        status: "attempt_bound_reissue",
        attemptBinding: {
          attemptId: `ATT_${"x".repeat(16)}`,
          claimId: 123,
          executionSliceHash: "9".repeat(64),
        },
        reservationBoundary: {
          leaseAndAttemptAtomicInThisModule: false,
          state: "attempt_already_reserved_requires_exact_resume",
          reconcileRequired: true,
          requiredNextOperation: "resume_exact_attempt_only",
        },
      });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          "RTS_v3-attempt-bound",
          attemptBound,
        )),
        (error: unknown) => error instanceof V3RecoveryClaimAuthorityError
          && error.code === "V3_RECOVERY_PUBLICATION_ATTEMPT_BOUND_REISSUE",
      );

      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        step_status: string;
        claims: number;
        sessions: number;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               step.status AS step_status,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${runId}) AS sessions
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "failed",
        claim_generation: 0,
        step_status: "pending",
        claims: 0,
        sessions: 0,
      });
    } finally {
      await database.cleanup();
    }
  });

  it("rolls back recovery story, step, and claim publication when runtime reservation fails", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const duplicateSessionId = "RTS_v3-recovery-rollback";
      const ownerRunId = "run-v3-recovery-runtime-owner";
      const ownerStep = await seedSingle(database, ownerRunId);
      await publishSingleClaimRuntime(database.sql, {
        runId: ownerRunId,
        stepDbId: ownerStep,
        workflowStepId: "plan",
        claimAgentId: "feature-dev_planner",
        runtimeIntent: runtimeIntent(duplicateSessionId),
      });

      const runId = "run-v3-recovery-publication-rollback";
      const fixture = await seedRecoveryLoop(database, runId);
      const handoff = await acquireRecoveryHandoff(database, { runId });
      await assert.rejects(
        publishLoopClaimRuntime(database.sql, recoveryPublicationInput(
          runId,
          fixture,
          duplicateSessionId,
          handoff,
        )),
        /duplicate key value|unique constraint/i,
      );
      const state = await database.sql<Array<{
        story_status: string;
        claim_generation: number;
        claimed_by: string | null;
        step_status: string;
        current_story_id: string | null;
        claims: number;
        sessions: number;
        delivery_state: string;
        attempt_id: string | null;
        delivery_claim_id: string | number | null;
      }>>`
        SELECT story.status AS story_status,
               story.claim_generation,
               story.claimed_by,
               step.status AS step_status,
               step.current_story_id,
               (SELECT COUNT(*)::integer FROM claim_log WHERE run_id = ${runId}) AS claims,
               (SELECT COUNT(*)::integer FROM runtime_sessions WHERE run_id = ${runId}) AS sessions,
               delivery.state AS delivery_state,
               delivery.attempt_id,
               delivery.claim_id AS delivery_claim_id
          FROM stories story
          JOIN steps step ON step.id = ${fixture.stepDbId}
          JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = ${handoff.dispatchId}
         WHERE story.id = ${fixture.storyDbId}
      `;
      assert.deepEqual({ ...state[0] }, {
        story_status: "failed",
        claim_generation: 0,
        claimed_by: null,
        step_status: "pending",
        current_story_id: null,
        claims: 0,
        sessions: 0,
        delivery_state: "leased",
        attempt_id: null,
        delivery_claim_id: null,
      });
    } finally {
      await database.cleanup();
    }
  });
});
