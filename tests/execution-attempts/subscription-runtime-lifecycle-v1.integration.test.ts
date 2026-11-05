import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { completeSingleStepClaimAndState } from "../../src/execution/claim-attempt-transition.js";
import { insertAndBindInternalProductionClaimBirthV1, prepareInternalProductionClaimBirthV1 }
  from "../../src/execution/claim-runtime-publication.js";
import { createRuntimeSessionRepository, releaseDrainedRuntimeSessionInTransaction,
  type ClaimRuntimeSession } from "../../src/execution/runtime-session-repository.js";
import { requestRunTermination, createRunTerminationRepository } from "../../src/execution/run-termination.js";
import { createRuntimeCompletionRepository, requestRuntimeCompletion } from "../../src/execution/runtime-completion.js";
import { createRuntimeCompletionEffectRepository } from "../../src/execution/runtime-completion-effect-repository.js";
import { runWithRuntimeCompletionOwner } from "../../src/execution/runtime-completion-owner-context.js";
import { createSubscriptionRuntimeAttachmentV1, type SubscriptionRuntimeBindingV1,
  type SubscriptionRuntimeAuthorityV1 } from "../../src/execution/subscription-runtime-attachment-v1.js";
import type { ClaimEnvelopeV1 } from "../../src/execution/schemas/claim-envelope-v1.js";
import type { PgTransactionSql } from "../../src/db-pg.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { createV3ImplementationClaimHandoffV1, createV3ImplementationContextV1 }
  from "../../src/execution/v3-implementation-handoff.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";
import { exactProductReservation } from "./fixtures.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

// OWNER_BACKED_TESTS dispatcher only. The existing FD3-authenticated P3 harness
// owns database creation/migrations/drop. No selected facade or credential read,
// broker, worker, subprocess, SDK, or provider is invoked by this suite.
type AuthenticatedStartInput = Readonly<{
  sessionId: string; ownerInstanceId: string; envelope: ClaimEnvelopeV1;
  runtimePath: string; worktree: string; transcriptPath: string;
  subscriptionBinding?: SubscriptionRuntimeBindingV1;
  subscriptionAuthority?: SubscriptionRuntimeAuthorityV1;
}>;
function authenticatedReader(sessions: ReturnType<typeof createRuntimeSessionRepository>) {
  const reader = (sessions as typeof sessions & {
    readAuthenticatedStartingClaim?: (input: AuthenticatedStartInput) => Promise<ClaimRuntimeSession>;
  }).readAuthenticatedStartingClaim;
  assert.equal(typeof reader, "function", "authenticated starting claim lookup is required before selected acquisition");
  return reader!;
}
const ABSENT = {
  schema: "setfarm.runtime-drain-evidence.v1", observedAt: "2026-11-04T12:00:00.000Z",
  localProcessAbsent: true, openClawTaskAbsent: true, workspaceProcessAbsent: true,
  stableObservations: 2, evidenceRefs: ["setfarm://tests/subscription-runtime/original-absence"],
};

async function fixture(database: TestDatabase, stage = false, subscription = true, reserved = false) {
  const suffix = randomUUID();
  const runId = `run-subscription-${suffix}`, stepDbId = `step-${suffix}`, storyDbId = `story-${suffix}`;
  const workflowStepId = stage ? "plan" : "implement";
  const claimAgentId = stage ? "feature-dev_planner" : "feature-dev_developer";
  const runtimeAgentId = "subscription-fixture-worker";
  const ownerInstanceId = `fixture.local:43100:${suffix}`;
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "sf-sub-runtime-lifecycle-")));
  chmodSync(directory, 0o700);
  const worktree = path.join(directory, "worktree"); mkdirSync(worktree, { mode: 0o700 });
  const sessionId = `RTS_${suffix}`;
  const container = path.join(directory, "attempt-workspaces", "subscription", sessionId);
  if (!reserved) mkdirSync(container, { recursive: true, mode: 0o700 });
  const runtimePath = subscription ? path.join(container, "owner") : path.join(directory, "legacy-codex-runtime");
  const transcriptPath = subscription ? path.join(container, "worker-output.log") : path.join(directory, "codex-output.log");
  try {
    await database.insertRun(runId);
    await database.sql`INSERT INTO steps
      (id,run_id,step_id,agent_id,step_index,input_template,expects,status,current_story_id)
      VALUES (${stepDbId},${runId},${workflowStepId},${claimAgentId},1,'','','running',${stage ? null : storyDbId})`;
    if (!stage) await database.sql`INSERT INTO stories
      (id,run_id,story_index,story_id,title,status,claimed_by,claim_generation)
      VALUES (${storyDbId},${runId},1,'US-002','Subscription lifecycle','running',${claimAgentId},4)`;
    // Same real claim-birth/owner fixture operations as runtime-session tests.
    const claimId = await database.sql.begin(async sql => {
      const ids = await sql.unsafe<Array<{ id: unknown }>>(
        "SELECT nextval(pg_get_serial_sequence('claim_log','id'))::bigint::text AS id");
      const birth = await prepareInternalProductionClaimBirthV1(sql as PgTransactionSql,
        stage ? "a-claim-single-runtime-v1" : "a-claim-loop-runtime-v1", ids);
      return insertAndBindInternalProductionClaimBirthV1(sql as PgTransactionSql, birth, {
        runId, workflowStepId, storyId: stage ? null : "US-002", claimAgentId, claimedAt: new Date(),
      });
    });
    const reservation = stage ? undefined : await createAttemptRepository(database.sql).reserve(exactProductReservation({
      claimId, runId, agentId: claimAgentId, worktree,
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    }));
    const envelope: ClaimEnvelopeV1 = {
      schema: "setfarm.claim-envelope.v1", protocol: "shadow", issuedAt: new Date().toISOString(),
      runId, stepId: stepDbId, workflowStepId, claimId, claimAgentId, runtimeAgentId, workdir: worktree,
      ...(reservation ? { storyId: "US-002", storyDbId, claimGeneration: 4, attempt: {
        attemptId: reservation.attempt.attemptId, generation: reservation.attempt.generation,
        fenceToken: reservation.attempt.fenceToken,
      } } : {}),
    };
    const sessions = createRuntimeSessionRepository(database.sql);
    await sessions.reserve({ sessionId, runId, stepDbId, workflowStepId, claimId, claimAgentId,
      runtimeAgentId, runtimeKind: "local_process", ownerInstanceId, worktree, transcriptPath,
      ...(!reserved ? { runtimePath } : {}),
      ...(reservation ? { storyId: "US-002", storyDbId, attemptId: reservation.attempt.attemptId } : {}),
    });
    const start = { sessionId, ownerInstanceId, worktree, runtimePath, transcriptPath };
    if (!reserved) await sessions.markStarting(start);
    return { sessions, envelope, start, runId, claimId, storyDbId, stepDbId, directory,
      auth: { ...start, envelope }, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}
async function withFixture(body: (f: Awaited<ReturnType<typeof fixture>>, db: TestDatabase) => Promise<void>, stage = false, subscription = true, reserved = false) {
  const db = await createIsolatedTestDatabase();
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  try { f = await fixture(db, stage, subscription, reserved); await body(f, db); }
  finally { f?.cleanup(); await db.cleanup(); }
}
function subscriptionStart(f: Awaited<ReturnType<typeof fixture>>) {
  const common = { runtimeSessionId: f.start.sessionId, claimId: f.claimId,
    ownerInstanceId: f.start.ownerInstanceId, modelRef: "minimax/MiniMax-M3.1-Flash",
    sourceSha: "a".repeat(40), worktree: f.start.worktree,
  };
  const binding: SubscriptionRuntimeBindingV1 = f.envelope.attempt
    ? { ...common, modelRef: "minimax/MiniMax-M3.1-Flash", kind: "execution-attempt", ...f.envelope.attempt }
    : { ...common, modelRef: "minimax/MiniMax-M3.1-Flash", kind: "stage-claim" };
  // Fixture DATA, never claimed as an OS observation or selected admission.
  const authority: SubscriptionRuntimeAuthorityV1 = {
    sourceSha: binding.sourceSha, activationPreparedHash: "b".repeat(64),
    activationAcknowledgedHash: "c".repeat(64), policySourceHash: "d".repeat(64), preloadHash: "e".repeat(64),
    parentIdentity: { schema: "setfarm.process-identity.v1", pid: 43100,
      processStartedAt: "2026-11-04T12:00:00.000Z", processGroupId: 43000, source: "observed_os" },
  };
  return { ...f.auth, subscriptionBinding: binding, subscriptionAuthority: authority };
}

// This complete real canonical implementation fixture stays in the owned suite:
// its existing production schema imports generic selected profile eagerly.
// Never move it into the direct inert DATA test's import graph.
function canonicalImplementation() {
  const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
  const producer = { pass: "subscription-binding-fixture", codeSha: "5840ae3", toolVersions: { setfarm: "test" } };
  const artifact = (artifactType: string, payload: unknown) => hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1", artifactType, producer, payload,
  });
  const sliceHash = artifact("setfarm.implementation-slice.v1", slice);
  const evidencePlan = compileEvidencePlanV1({ slice, sliceHash });
  const evidenceHash = artifact("setfarm.evidence-plan.v1", evidencePlan);
  const workdir = "/installation/runtime/projects/genuine-story";
  const handoff = createV3ImplementationClaimHandoffV1({
    schema: "setfarm.v3-implementation-claim-handoff.v1", protocol: "v3",
    runId: "run-subscription-canonical-v3", stepId: "step-subscription-canonical-v3",
    storyId: slice.storyId, storyDbId: "story-subscription-canonical-v3", claimId: 901,
    attemptId: "ATT_00000000-0000-0000-0000-000000000901", attemptGeneration: 1,
    branch: "run-subscription-us-001", workdir, packetHash: slice.packetHash,
    compilationReportHash: "9".repeat(64), sliceHash,
    sliceRef: `SLICE_US_001_${sliceHash.slice(0, 16).toUpperCase()}`,
    evidencePlanHash: evidencePlan.planHash, evidencePlanArtifactHash: evidenceHash,
    evidencePlanRef: `EVIDENCE_PLAN_US_001_${evidenceHash.slice(0, 16).toUpperCase()}`,
    executionAuthority: { role: "developer", attemptClass: "product_implementation" },
    sourceBefore: { sha: slice.sourceRevision.baseSha, treeHash: slice.sourceRevision.treeHash },
    artifactProducer: producer, implementationSlice: slice, evidencePlan,
  });
  const envelope: ClaimEnvelopeV1 = {
    schema: "setfarm.claim-envelope.v1", protocol: "v3", issuedAt: "2026-11-04T12:00:00.000Z",
    stepId: handoff.stepId, workflowStepId: "implement", runId: handoff.runId,
    storyId: handoff.storyId, storyDbId: handoff.storyDbId, claimId: handoff.claimId,
    claimAgentId: "feature-dev_developer", runtimeAgentId: "developer", claimGeneration: 1,
    workdir, attempt: { attemptId: handoff.attemptId, generation: handoff.attemptGeneration, fenceToken: "7".repeat(64) },
  };
  return { envelope, authority: createV3ImplementationContextV1({ handoff }),
    runtimeSessionId: "RTS_00000000-0000-0000-0000-000000000901",
    ownerInstanceId: "fixture.local:43100:12345678-1234-4234-8234-123456789abc",
    selectedProfile: handoff.executionProfile, platformSourceSha: "f".repeat(40) };
}
async function projectCanonical(input: ReturnType<typeof canonicalImplementation>) {
  const api = await import("../../src/execution/subscription-coding-runtime-binding-v1.js");
  return api.projectSubscriptionCodingRuntimeBindingV1(input);
}

it("subscription transport preserves native implementation proposal bytes beyond legacy stage report cap",async()=>{
  const input=canonicalImplementation(), context=input.authority;
  const {compileV3ImplementationAgentOutputV1}=await import("../../src/execution/v3-implementation-output.js");
  const raw=JSON.stringify({schema:"setfarm.v3-implementation-agent-proposal.v1",disposition:"ready_for_evidence",
    handoffHash:context.handoffHash,attemptId:context.handoff.attemptId,packetHash:context.handoff.packetHash,
    sliceHash:context.handoff.sliceHash,sourceBefore:context.handoff.sourceBefore,summary:"Exact owned implementation",
    changes:context.writeAuthority.allowedPaths.map(path=>({path,summary:"Owned change"})),annotation:"a".repeat(70000)});
  assert.ok(Buffer.byteLength(raw)>65536);compileV3ImplementationAgentOutputV1(raw,context);
  const transport=await import("../../src/execution/subscription-workflow-transport-v1.js");
  assert.deepEqual(transport.parseSubscriptionWorkflowReportV1({claim:input.envelope,authority:context,assistantText:raw}),{output:raw});
});
it("subscription implementation report refuses crossed canonical handoff and attempt identity",async()=>{
  const input=canonicalImplementation(), context=input.authority;
  const transport=await import("../../src/execution/subscription-workflow-transport-v1.js");
  const raw={schema:"setfarm.v3-implementation-agent-proposal.v1",disposition:"ready_for_evidence",
    handoffHash:context.handoffHash,attemptId:context.handoff.attemptId,packetHash:context.handoff.packetHash,
    sliceHash:context.handoff.sliceHash,sourceBefore:context.handoff.sourceBefore,summary:"Exact implementation",changes:[]};
  for(const change of [{handoffHash:"0".repeat(64)},{attemptId:"ATT_00000000-0000-0000-0000-000000000902"}])
    assert.throws(()=>transport.parseSubscriptionWorkflowReportV1({claim:input.envelope,authority:context,assistantText:JSON.stringify({...raw,...change})}),/MISMATCH|REFUSED/);
});

it("canonical implementation binding uses selected platform origin rather than generated sourceBefore", async () => {
  const input = canonicalImplementation();
  assert.notEqual(input.platformSourceSha, input.authority.handoff.sourceBefore.sha);
  const actual = await projectCanonical(input);
  assert.equal(actual.sourceSha, "f".repeat(40));
  assert.equal(actual.kind, "execution-attempt");
  if (actual.kind !== "execution-attempt") assert.fail("genuine implementation requires execution attempt binding");
  assert.equal(actual.attemptId, input.envelope.attempt!.attemptId);
  assert.equal(actual.generation, 1);
  assert.equal(actual.fenceToken, "7".repeat(64));
});
it("canonical implementation selected provider model and selection must all match", async () => {
  const input = canonicalImplementation();
  for (const selectedProfile of [{ ...input.selectedProfile, selection: "fallback" as const },
    { ...input.selectedProfile, providerId: "kimi", modelId: "kimi/k3.1-pro" },
    { ...input.selectedProfile, modelId: "minimax/foreign-model" }]) {
    await assert.rejects(projectCanonical({ ...input, selectedProfile }), /MISMATCH|REFUSED/);
  }
});
it("canonical implementation cannot cross the original envelope attempt generation", async () => {
  const input = canonicalImplementation();
  await assert.rejects(projectCanonical({ ...input, envelope: { ...input.envelope,
    attempt: { ...input.envelope.attempt!, generation: 2 } } }), /MISMATCH|REFUSED/);
});

it("authenticates a genuine ordinary claim without turning its snapshot into running", async () => {
  await withFixture(async f => {
    const before = await f.sessions.findById(f.start.sessionId);
    const actual = await authenticatedReader(f.sessions)(f.auth);
    assert.equal(actual.claimId, f.claimId);
    assert.equal(actual.attemptId, f.envelope.attempt!.attemptId);
    assert.equal(actual.ownerInstanceId, f.start.ownerInstanceId);
    assert.equal(actual.state, "starting");
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, before!.state);
  });
});

const crossedStart = [
  ["owner", (f: Awaited<ReturnType<typeof fixture>>) => ({ ownerInstanceId: "foreign.local:43200:foreign" })],
  ["worktree", (f: Awaited<ReturnType<typeof fixture>>) => ({ worktree: path.join(f.directory, "foreign") })],
  ["runtime journal", (f: Awaited<ReturnType<typeof fixture>>) => ({ runtimePath: path.dirname(f.start.runtimePath) })],
  ["transcript", (f: Awaited<ReturnType<typeof fixture>>) => ({ transcriptPath: path.join(f.directory, "foreign.log") })],
] as const;
for (const [name, change] of crossedStart) it(`refuses crossed ${name} before acquisition without changing runtime`, async () => {
  await withFixture(async f => {
    const before = await f.sessions.findById(f.start.sessionId), read = authenticatedReader(f.sessions);
    await assert.rejects(read({ ...f.auth, ...change(f) }), /MISMATCH|REFUSED/);
    assert.deepEqual(await f.sessions.findById(f.start.sessionId), before);
  });
});
for (const [name, change] of [
  ["claim", (e: ClaimEnvelopeV1) => ({ ...e, claimId: e.claimId + 1 })],
  ["runtime agent", (e: ClaimEnvelopeV1) => ({ ...e, runtimeAgentId: "foreign-agent" })],
  ["story generation", (e: ClaimEnvelopeV1) => ({ ...e, claimGeneration: 5 })],
  ["attempt generation", (e: ClaimEnvelopeV1) => ({ ...e, attempt: { ...e.attempt!, generation: e.attempt!.generation + 1 } })],
  ["attempt fence", (e: ClaimEnvelopeV1) => ({ ...e, attempt: { ...e.attempt!, fenceToken: "0".repeat(64) } })],
] as const) it(`refuses forged ${name} against locked claim authority`, async () => {
  await withFixture(async f => {
    const read = authenticatedReader(f.sessions), before = await f.sessions.findById(f.start.sessionId);
    await assert.rejects(read({ ...f.auth, envelope: change(f.envelope) }), /CLAIM_AUTHORITY|MISMATCH|REFUSED/);
    assert.deepEqual(await f.sessions.findById(f.start.sessionId), before);
  });
});
it("refuses terminal claim authority before acquisition", async () => {
  await withFixture(async (f, db) => {
    const read = authenticatedReader(f.sessions);
    await db.sql`UPDATE claim_log SET outcome='infra_retry' WHERE id=${f.claimId}`;
    await assert.rejects(read(f.auth), /CLAIM_AUTHORITY_ALREADY_TERMINAL/);
  });
});
it("refuses expired ordinary attempt lease using database time", async () => {
  await withFixture(async (f, db) => {
    const read = authenticatedReader(f.sessions);
    await db.sql`UPDATE execution_attempts SET lease_expires_at=clock_timestamp()-interval '1 second'
      WHERE attempt_id=${f.envelope.attempt!.attemptId}`;
    await assert.rejects(read(f.auth), /LEASE|FENCE_STALE/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "starting");
  });
});
it("repeats original attempt fence after lookup before publishing running", async () => {
  await withFixture(async f => {
    await authenticatedReader(f.sessions)(f.auth);
    await assert.rejects(f.sessions.markRunning({ ...f.start,
      envelope: { ...f.envelope, attempt: { ...f.envelope.attempt!, fenceToken: "0".repeat(64) } },
    } as Parameters<typeof f.sessions.markRunning>[0]), /CLAIM_AUTHORITY|MISMATCH|REFUSED/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "starting");
  });
});
it("repeats ordinary lease after lookup before publishing running", async () => {
  await withFixture(async (f, db) => {
    await authenticatedReader(f.sessions)(f.auth);
    await db.sql`UPDATE execution_attempts SET lease_expires_at=clock_timestamp()-interval '1 second'
      WHERE attempt_id=${f.envelope.attempt!.attemptId}`;
    await assert.rejects(f.sessions.markRunning({ ...f.auth } as Parameters<typeof f.sessions.markRunning>[0]), /LEASE|FENCE_STALE/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "starting");
  });
});
it("hands off a drain that wins between authenticated lookup and running without publication", async () => {
  await withFixture(async f => {
    await authenticatedReader(f.sessions)(f.auth);
    await f.sessions.requestDrain({ ...f.start, diagnostic: "termination won during selected acquisition" });
    const result = await f.sessions.markRunning({ ...f.auth } as Parameters<typeof f.sessions.markRunning>[0]);
    assert.equal(result.status, "drain_requested");
    assert.equal(result.session.state, "drain_requested");
  });
});
it("real termination intent between lookup and running refuses publication", async () => {
  await withFixture(async (f, db) => {
    await authenticatedReader(f.sessions)(f.auth);
    const intent = await requestRunTermination(db.sql, { runId: f.runId, targetStatus: "cancelled",
      requestedBy: "subscription-runtime-lifecycle", diagnostic: "termination wins selected startup",
      requestId: `RTR_${randomUUID()}` });
    assert.equal(intent.status, "requested");
    await assert.rejects(f.sessions.markRunning({ ...f.auth } as Parameters<typeof f.sessions.markRunning>[0]),
      /TERMINATION_PENDING|RUN_NOT_ACTIVE/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "starting");
  });
});
it("authenticates honest nonstory stage with no invented execution attempt or fence", async () => {
  await withFixture(async (f, db) => {
    const actual = await authenticatedReader(f.sessions)(f.auth);
    assert.equal(actual.workflowStepId, "plan");
    assert.equal(actual.attemptId, undefined);
    assert.equal(f.envelope.attempt, undefined);
    const rows = await db.sql<Array<{ count: string }>>`SELECT count(*)::text AS count FROM execution_attempts WHERE claim_id=${f.claimId}`;
    assert.equal(rows[0]!.count, "0");
  }, true);
});
it("neutral reserved compiler completion drains and accepts through its genuine owner without subscription closure", async () => {
  await withFixture(async (f, db) => {
    const reserved = (await f.sessions.findById(f.start.sessionId))!;
    assert.equal(reserved.state, "reserved");assert.equal(reserved.runtimePath, undefined);
    assert.equal(reserved.pid, undefined);assert.equal(reserved.startedAt, undefined);
    assert.deepEqual(reserved.drainEvidence, {});
    const output = "STATUS: done\nRESULT: exact compiler-owned stage projection";
    const requested = await requestRuntimeCompletion(db.sql, {
      envelope: f.envelope, output, requestId: `RCR_${randomUUID()}`,
    });
    assert.equal(requested.status, "requested");
    if (requested.status !== "requested") assert.fail("owned compiler completion request required");
    assert.equal(requested.request.output, output);
    const completions = createRuntimeCompletionRepository(db.sql), ownerInstanceId = f.start.ownerInstanceId;
    const draining = await completions.claim({ requestId: requested.request.requestId, ownerInstanceId });
    assert.equal(draining!.state, "draining");
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "drain_requested");
    const drained = await f.sessions.markDrained({ ...f.start, evidence: ABSENT });
    assert.equal(drained.state, "drained");assert.equal(drained.runtimePath, undefined);
    for (const key of ["subscriptionStart", "subscriptionClosure"]) assert.equal(Object.hasOwn(drained.drainEvidence, key), false);
    const processing = await completions.markProcessing({ requestId: requested.request.requestId, ownerInstanceId });
    assert.ok(processing.leaseExpiresAt);
    const completed = await runWithRuntimeCompletionOwner({ requestId: processing.requestId, ownerInstanceId,
      leaseExpiresAt: processing.leaseExpiresAt!, ownerAttemptCount: processing.ownerAttemptCount },
    () => completeSingleStepClaimAndState(db.sql, { envelope: f.envelope, stepStatus: "done", stepOutput: output,
      requireRuntimeCompletionOwner: true }));
    assert.equal(completed.status, "completed");
    const effects = createRuntimeCompletionEffectRepository(db.sql), result = { advanced: false, runCompleted: false };
    const effect = await effects.claimNext({ requestId: processing.requestId, ownerInstanceId });
    assert.ok(effect?.leaseToken);
    await effects.settle({ requestId: processing.requestId, effectKey: effect.effectKey, ownerInstanceId,
      leaseToken: effect.leaseToken, resolution: "applied", result, evidence: { source: "neutral-compiler-completion-fixture" } });
    await completions.markEffectsCommitted({ requestId: processing.requestId, ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount, result });
    const accepted = await completions.acceptAndRelease({ requestId: processing.requestId, ownerInstanceId,
      ownerAttemptCount: processing.ownerAttemptCount, result });
    assert.equal(accepted.state, "accepted");
    const released = (await f.sessions.findById(f.start.sessionId))!;
    assert.equal(released.state, "released");assert.equal(released.runtimePath, undefined);
    assert.equal(released.pid, undefined);assert.equal(released.startedAt, undefined);
    assert.deepEqual(released.drainEvidence, drained.drainEvidence);
    const rows = await db.sql<Array<{ outcome: string; status: string; output: string }>>`
      SELECT cl.outcome, s.status, s.output FROM claim_log cl JOIN steps s ON s.id=${f.stepDbId} WHERE cl.id=${f.claimId}`;
    assert.deepEqual(rows.map(row => ({ ...row })), [{ outcome: "completed", status: "done", output }]);
  }, true, true, true);
});
it("neutral reservation pins subscription starting paths even when acquisition then refuses without a journal", async () => {
  await withFixture(async f => {
    assert.equal((await f.sessions.findById(f.start.sessionId))!.runtimePath, undefined);
    const starting = await f.sessions.markStarting(f.start);
    assert.equal(starting.state, "starting");assert.equal(starting.runtimePath, f.start.runtimePath);
    assert.equal(starting.transcriptPath, f.start.transcriptPath);assert.equal(starting.worktree, f.start.worktree);
    assert.equal(starting.pid, undefined);assert.equal(Object.hasOwn(starting.drainEvidence, "subscriptionStart"), false);
    assert.deepEqual(await f.sessions.markStarting(f.start), starting);
    await assert.rejects(f.sessions.markStarting({ ...f.start, runtimePath: path.join(f.directory, "foreign") }), /MISMATCH/);
    await f.sessions.requestDrain({ ...f.start, diagnostic: "selected startup refused after atomic starting publication" });
    await assert.rejects(f.sessions.markDrained({ ...f.start, evidence: ABSENT }), /SUBSCRIPTION/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "drain_requested");
  }, true, true, true);
});
it("missing subscription journal cannot downgrade to legacy absence-only drainage", async () => {
  await withFixture(async f => {
    await f.sessions.requestDrain({ ...f.start, diagnostic: "journal missing after acquisition" });
    await assert.rejects(f.sessions.markDrained({ ...f.start, evidence: ABSENT }), /SUBSCRIPTION/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "drain_requested");
  }, true);
});
it("partial subscription journal cannot downgrade to legacy absence-only drainage", async () => {
  await withFixture(async f => {
    mkdirSync(f.start.runtimePath, { mode: 0o700 });
    await f.sessions.requestDrain({ ...f.start, diagnostic: "journal partial after acquisition" });
    await assert.rejects(f.sessions.markDrained({ ...f.start, evidence: ABSENT }), /SUBSCRIPTION/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "drain_requested");
  }, true);
});
it("persists independent immutable subscription binding and prepared authority before journal acquisition", async () => {
  await withFixture(async f => {
    const input = subscriptionStart(f), read = authenticatedReader(f.sessions);
    const actual = await read(input);
    const seed = actual.drainEvidence.subscriptionStart as Record<string, unknown>;
    assert.ok(seed, "subscription start authority must survive parent restart and journal deletion");
    assert.deepEqual(seed.binding, input.subscriptionBinding);
    assert.deepEqual(seed.authority, input.subscriptionAuthority);
    assert.deepEqual(seed.envelope, f.envelope);
    assert.equal(seed.runtimePath, f.start.runtimePath);
    assert.equal(seed.transcriptPath, f.start.transcriptPath);
    assert.match(String(seed.attachmentHash), /^[a-f0-9]{64}$/);
    assert.deepEqual((await read(f.auth)).drainEvidence, actual.drainEvidence);
    assert.equal((await read(input)).stateVersion, actual.stateVersion);
  }, true);
});
for (const field of ["modelRef", "sourceSha", "ownerInstanceId", "claimId"] as const) {
  it(`immutable persisted subscription ${field} cannot be replaced on replay`, async () => {
    await withFixture(async f => {
      const input = subscriptionStart(f), read = authenticatedReader(f.sessions);
      const seeded = await read(input);
      const changed = { modelRef: "kimi/k3.1-pro", sourceSha: "f".repeat(40),
        ownerInstanceId: "foreign.local:444:other", claimId: f.claimId + 1 }[field];
      await assert.rejects(read({ ...input, subscriptionBinding: { ...input.subscriptionBinding, [field]: changed } as SubscriptionRuntimeBindingV1 }),
        /SUBSCRIPTION|MISMATCH/);
      assert.deepEqual(await f.sessions.findById(f.start.sessionId), seeded);
    }, true);
  });
}
it("quarantine preserves original subscription seed and refuses caller metadata replacement", async () => {
  await withFixture(async f => {
    const seeded = await authenticatedReader(f.sessions)(subscriptionStart(f));
    await assert.rejects(f.sessions.quarantine({ sessionId: f.start.sessionId,
      expectedOwnerInstanceId: f.start.ownerInstanceId, expectedStateVersion: seeded.stateVersion,
      diagnostic: "caller cannot erase restart discriminator", evidence: { subscriptionStart: null } }), /SUBSCRIPTION/);
    assert.deepEqual(await f.sessions.findById(f.start.sessionId), seeded);
    const quarantined = await f.sessions.quarantine({ sessionId: f.start.sessionId,
      expectedOwnerInstanceId: f.start.ownerInstanceId, expectedStateVersion: seeded.stateVersion,
      diagnostic: "retain partial original owners", evidence: { failure: "partial-owner" } });
    assert.equal(quarantined.state, "quarantined");
    assert.deepEqual(quarantined.drainEvidence.subscriptionStart, seeded.drainEvidence.subscriptionStart);
  }, true);
});
it("authentic journal publication and caller closed flags cannot substitute original joint ownership", async () => {
  await withFixture(async f => {
    const input = subscriptionStart(f);
    await authenticatedReader(f.sessions)(input);
    const journal = createSubscriptionRuntimeAttachmentV1({ runtimePath: f.start.runtimePath,
      binding: input.subscriptionBinding, authority: input.subscriptionAuthority });
    await journal.bindWorker({ processIdentity: { ...input.subscriptionAuthority.parentIdentity, pid: 43200 },
      brokerPort: 49157, isolation: { materialHash: "1".repeat(64), policyHash: "2".repeat(64),
        preloadHash: input.subscriptionAuthority.preloadHash, proofHash: "3".repeat(64), isolationHash: "4".repeat(64) } });
    const forged = { binding: input.subscriptionBinding, attachmentHash: journal.attachmentHash,
      status: "closed" as const, broker: "closed" as const, worker: "closed" as const,
      evidenceRefs: ["original-broker", "original-process-and-streams"] };
    await journal.publishClosed(forged);
    await f.sessions.requestDrain({ ...f.start, diagnostic: "publication is DATA, never original closure" });
    await assert.rejects(f.sessions.markDrained({ ...f.start, evidence: { ...ABSENT, subscriptionClosure: forged } }), /SUBSCRIPTION/);
    assert.equal((await f.sessions.findById(f.start.sessionId))!.state, "drain_requested");
  }, true);
});
it("execution-attempt seed binds the actual joined generation and fence rather than a stage tuple", async () => {
  await withFixture(async f => {
    const input = subscriptionStart(f), read = authenticatedReader(f.sessions);
    assert.equal(input.subscriptionBinding.kind, "execution-attempt");
    const seeded = await read(input);
    for (const change of [{ generation: f.envelope.attempt!.generation + 1 }, { fenceToken: "0".repeat(64) }]) {
      await assert.rejects(read({ ...input, subscriptionBinding: { ...input.subscriptionBinding, ...change } as SubscriptionRuntimeBindingV1 }), /SUBSCRIPTION|MISMATCH/);
      assert.deepEqual(await f.sessions.findById(f.start.sessionId), seeded);
    }
  });
});
it("seeded subscription runtime cannot bypass envelope checks through legacy markRunning input", async () => {
  await withFixture(async f => {
    const seeded = await authenticatedReader(f.sessions)(subscriptionStart(f));
    await assert.rejects(f.sessions.markRunning(f.start), /SUBSCRIPTION|REFUSED/);
    assert.deepEqual(await f.sessions.findById(f.start.sessionId), seeded);
  });
});
it("quarantine termination recovery cannot erase subscription seed or invent original closure", async () => {
  await withFixture(async (f, db) => {
    const input = subscriptionStart(f), seeded = await authenticatedReader(f.sessions)(input);
    const quarantined = await f.sessions.quarantine({ sessionId: f.start.sessionId,
      expectedOwnerInstanceId: f.start.ownerInstanceId, expectedStateVersion: seeded.stateVersion,
      diagnostic: "restart has no original streams or joint closure" });
    const request = await requestRunTermination(db.sql, { runId: f.runId, targetStatus: "cancelled",
      requestId: `RTR_${randomUUID()}`, requestedBy: "subscription-fixture", diagnostic: "terminate quarantined owner" });
    assert.equal(request.status, "requested");
    if (request.status === "already_terminal") assert.fail("owned termination request required");
    const termination = await createRunTerminationRepository(db.sql).claim({ requestId: request.request.requestId,
      ownerInstanceId: "termination-fixture-owner" });
    assert.equal(termination!.state, "draining");
    for (const evidence of [ABSENT, { ...ABSENT, subscriptionClosure: { binding: input.subscriptionBinding,
      attachmentHash: "f".repeat(64), status: "closed", broker: "closed", worker: "closed", evidenceRefs: [] } }]) {
      await assert.rejects(f.sessions.recoverQuarantinedForTermination({ sessionId: f.start.sessionId,
        expectedStateVersion: quarantined.stateVersion, terminationRequestId: termination!.requestId,
        terminationOwnerInstanceId: termination!.ownerInstanceId!, diagnostic: "no original must remain quarantined", evidence }), /SUBSCRIPTION/);
      assert.deepEqual(await f.sessions.findById(f.start.sessionId), quarantined);
    }
  }, true);
});
it("legacy Codex absence-only drainage and exactly one release remain unchanged", async () => {
  await withFixture(async (f, db) => {
    await f.sessions.requestDrain({ ...f.start, diagnostic: "legacy codex original absence" });
    const drained = await f.sessions.markDrained({ ...f.start, evidence: ABSENT });
    assert.equal(drained.state, "drained");
    await db.sql`UPDATE claim_log SET outcome='infra_retry' WHERE id=${f.claimId}`;
    const release = () => db.sql.begin(sql => releaseDrainedRuntimeSessionInTransaction(sql, {
      sessionId: f.start.sessionId, claimId: f.claimId, ownerInstanceId: f.start.ownerInstanceId,
    }));
    const first = await release(), replay = await release();
    assert.equal(first.state, "released"); assert.equal(replay.stateVersion, first.stateVersion);
    assert.deepEqual(replay.drainEvidence, drained.drainEvidence);
  }, true, false);
});
