import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { createRecoveryCaseV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryCaseRevisionV1 } from "../../src/recovery/recovery-delivery.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import {
  appendPrivateDiagnosticRecoveryPrecreateReservationV1,
  PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS,
} from "../../src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const REFUSED = /TASK6A_PRIVATE_RECOVERY_PRECREATE_RESERVATION_REFUSED/;
const TABLE = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";

test("private recovery reservation requires the exact live delivery lease before a physical target exists", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");
  const admin = postgres(adminUrl, { max: 1 });
  let database: TestDatabase | undefined;
  let failure: unknown;
  let stage = "private-cluster-preflight";
  try {
    const identity = await admin<Array<{ data_directory: string; port: string;
      socket_directories: string; server_version_num: number }>>`
      SELECT current_setting('data_directory') AS data_directory,
        current_setting('port') AS port,
        current_setting('unix_socket_directories') AS socket_directories,
        current_setting('server_version_num')::integer AS server_version_num`;
    assert.equal(identity[0]?.data_directory, expectedDataDirectory);
    assert.equal(identity[0]?.port, parsed.port);
    assert.ok(identity[0]?.socket_directories.split(",").map((value) => value.trim())
      .includes(path.dirname(expectedDataDirectory!)));
    assert.ok(identity[0]!.server_version_num >= 170000
      && identity[0]!.server_version_num < 180000);

    stage = "isolated-post33-schema";
    database = await createIsolatedTestDatabase();
    const maximum = await database.sql<Array<{ version: number }>>`
      SELECT max(version)::integer AS version FROM public.setfarm_schema_migrations`;
    assert.equal(maximum[0]?.version, 33);
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }

    stage = "real-recovery-lease";
    const suffix = randomBytes(6).toString("hex");
    const runId = `task6a-recovery-precreate-${suffix}`;
    const stepDbId = `step-${suffix}`;
    const storyDbId = `story-${suffix}`;
    const storyId = "US-001";
    const ownerInstanceId = `owner-${suffix}`;
    const sourceSha = "a".repeat(40), sourceTreeHash = "b".repeat(40);
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`INSERT INTO public.runs (
      id, run_number, workflow_id, task, status, context, protocol,
      compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
    ) VALUES (${runId}, 999989, 'workflow', 'private recovery reservation probe',
      'running', '{}', 'v3', ${releaseSha}, ${"c".repeat(64)},
      ${"e".repeat(64)}, ${releaseAdmissionHash})`;
    await database.sql`INSERT INTO public.steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects, status, type
    ) VALUES (${stepDbId}, ${runId}, 'implement', 'agent', 1, '', '', 'running', 'loop')`;
    await database.sql`INSERT INTO public.stories (
      id, run_id, story_index, story_id, title, status
    ) VALUES (${storyDbId}, ${runId}, 1, ${storyId}, 'private recovery probe', 'failed')`;
    const findingSet = createFindingSetV1({ runId, storyId,
      packetHash: "c".repeat(64), sliceHash: "d".repeat(64),
      sourceRevision: { sha: sourceSha, treeHash: sourceTreeHash },
      findings: [{ origin: "runtime", classification: "structured",
        invariantRef: "INV_RECOVERY_LEASE",
        sourceLocators: [{ path: "src/App.tsx", contentHash: "e".repeat(64) }],
        observedEvidenceRefs: ["f".repeat(64)],
        expectedPredicateRef: "EVID_RECOVERY_LEASE", status: "open" }] });
    await database.sql`INSERT INTO public.finding_sets (
      finding_set_hash, finding_set_id, run_id, story_id, packet_hash,
      slice_hash, source_sha, source_tree_hash, finding_ids, payload
    ) VALUES (${findingSet.findingSetHash}, ${findingSet.findingSetId},
      ${runId}, ${storyId}, ${findingSet.packetHash}, ${findingSet.sliceHash},
      ${sourceSha}, ${sourceTreeHash},
      ${JSON.stringify(findingSet.findings.map((finding) => finding.findingId))}::text::jsonb,
      ${JSON.stringify(findingSet)}::text::jsonb)`;
    const draft = {
      runId, storyId, findingSetHash: findingSet.findingSetHash,
      findingIds: findingSet.findings.map((finding) => finding.findingId),
      packetHash: findingSet.packetHash, sliceHash: findingSet.sliceHash,
      sourceRevision: findingSet.sourceRevision, owner: "implement",
      expectedDelta: { kind: "source_change", invariantRefs: ["INV_RECOVERY_LEASE"],
        requiredPaths: ["src/App.tsx"] }, allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_RECOVERY_LEASE"], priorAttemptRefs: [],
      budget: { limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 } },
      status: "open", decisionRefs: [],
    } as const;
    const recoveryCase = createRecoveryCaseV1(draft, { now: new Date() });
    await database.sql`INSERT INTO public.recovery_cases (
      recovery_case_id, dedupe_key, run_id, story_id, finding_set_hash, finding_ids,
      packet_hash, slice_hash, source_sha, source_tree_hash, owner, expected_delta,
      allowed_paths, evidence_plan, prior_attempt_refs, max_implement,
      max_supervisor_repair, max_evidence_only, used_implement,
      used_supervisor_repair, used_evidence_only, status, decision_refs,
      state_version
    ) VALUES (${recoveryCase.recoveryCaseId}, ${recoveryCase.dedupeKey}, ${runId},
      ${storyId}, ${recoveryCase.findingSetHash},
      ${JSON.stringify(recoveryCase.findingIds)}::text::jsonb, ${recoveryCase.packetHash},
      ${recoveryCase.sliceHash}, ${sourceSha}, ${sourceTreeHash},
      ${recoveryCase.owner}, ${JSON.stringify(recoveryCase.expectedDelta)}::text::jsonb,
      ${JSON.stringify(recoveryCase.allowedPaths)}::text::jsonb,
      ${JSON.stringify(recoveryCase.evidencePlan)}::text::jsonb,
      ${JSON.stringify(recoveryCase.priorAttemptRefs)}::text::jsonb,
      ${recoveryCase.budget.limits.implement},
      ${recoveryCase.budget.limits.supervisorRepair},
      ${recoveryCase.budget.limits.evidenceOnly},
      ${recoveryCase.budget.used.implement},
      ${recoveryCase.budget.used.supervisorRepair},
      ${recoveryCase.budget.used.evidenceOnly}, ${recoveryCase.status},
      ${JSON.stringify(recoveryCase.decisionRefs)}::text::jsonb,
      ${recoveryCase.stateVersion})`;
    const revision = createRecoveryCaseRevisionV1({
      recoveryCaseId: recoveryCase.recoveryCaseId, revisionNumber: 1,
      runId, storyId, findingSetHash: recoveryCase.findingSetHash,
      findingIds: recoveryCase.findingIds, packetHash: recoveryCase.packetHash,
      contractSliceHash: recoveryCase.sliceHash,
      sourceRevision: recoveryCase.sourceRevision, owner: recoveryCase.owner,
      expectedDelta: recoveryCase.expectedDelta,
      allowedPaths: recoveryCase.allowedPaths,
      evidencePlan: recoveryCase.evidencePlan,
    }, { now: new Date() });
    await database.sql`INSERT INTO public.recovery_case_revisions (
      revision_id, recovery_case_id, revision_number, revision_identity_key,
      run_id, story_id, finding_set_hash, finding_ids, packet_hash,
      contract_slice_hash, source_sha, source_tree_hash, owner, expected_delta,
      allowed_paths, evidence_plan
    ) VALUES (${revision.revisionId}, ${recoveryCase.recoveryCaseId}, 1,
      ${revision.revisionIdentityKey}, ${runId}, ${storyId},
      ${revision.findingSetHash}, ${JSON.stringify(revision.findingIds)}::text::jsonb,
      ${revision.packetHash}, ${revision.contractSliceHash}, ${sourceSha},
      ${sourceTreeHash}, ${revision.owner},
      ${JSON.stringify(revision.expectedDelta)}::text::jsonb,
      ${JSON.stringify(revision.allowedPaths)}::text::jsonb,
      ${JSON.stringify(revision.evidencePlan)}::text::jsonb)`;
    await database.sql`UPDATE public.recovery_cases
      SET current_revision_id = ${revision.revisionId}
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const authorized = await deliveries.authorizeCurrentRevision({
      recoveryCaseId: recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      expectedStateVersion: recoveryCase.stateVersion,
      dispatchClass: "product_implementation",
    }, { now: new Date() });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected authorization");
    const handoff = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
      runId, storyId, ownerInstanceId, leaseMs: 300_000,
    }, { now: new Date() });
    assert.equal(handoff.dispatchId, authorized.dispatch.dispatchId);
    const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
    const input = { runId, storyDbId, storyId, dispatchId: handoff.dispatchId,
      ownerInstanceId, leaseToken: handoff.lease.leaseToken, root,
      sourceSha, sourceTreeHash };
    assert.equal(fs.existsSync(root), false);

    stage = "crossed-and-stale-lease-refusal";
    for (const crossed of [
      { dispatchId: `RDISP_${"f".repeat(64)}` },
      { runId: `other-${suffix}` },
      { storyDbId: `other-${storyDbId}` },
      { storyId: "US-002" },
      { ownerInstanceId: `other-${ownerInstanceId}` },
      { leaseToken: "f".repeat(64) },
      { sourceSha: "f".repeat(40) },
      { sourceTreeHash: "f".repeat(40) },
      { root: process.cwd() },
      { unexpected: "ambient-authority" },
    ]) await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql,
      { ...input, ...crossed }), REFUSED);
    const before = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(before[0]?.count, 0);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET lease_expires_at = NOW() - INTERVAL '1 second'
      WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET lease_expires_at = NOW() + INTERVAL '5 minutes'
      WHERE dispatch_id = ${input.dispatchId}`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'authorized', owner_instance_id = NULL, lease_token = NULL,
        lease_expires_at = NULL WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'leased', owner_instance_id = ${ownerInstanceId},
        lease_token = ${input.leaseToken}, lease_expires_at = NOW() + INTERVAL '5 minutes'
      WHERE dispatch_id = ${input.dispatchId}`;
    await database.sql`UPDATE public.recovery_cases SET current_revision_id = NULL
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.recovery_cases
      SET current_revision_id = ${revision.revisionId}
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'blocked', terminal_at = NOW()
      WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'leased', terminal_at = NULL
      WHERE dispatch_id = ${input.dispatchId}`;
    const claimId = 999989;
    const attemptId = `ATT_${randomBytes(8).toString("hex")}`;
    await database.sql`INSERT INTO public.claim_log (
      id, run_id, step_id, story_id, agent_id
    ) VALUES (${claimId}, ${runId}, 'implement', ${storyId}, 'agent')`;
    await database.sql`INSERT INTO public.execution_attempts (
      attempt_id, run_id, step_id, story_id, agent_id, generation, fence_token,
      attempt_class, compilation_report_hash, source_before_sha,
      source_before_tree_hash, role, lease_acquired_at, lease_expires_at,
      heartbeat_at, disposition, claim_id, worktree
    ) VALUES (${attemptId}, ${runId}, 'implement', ${storyId}, 'agent', 1,
      ${randomBytes(32).toString("hex")}, 'product_implementation',
      'private-report', ${sourceSha}, ${sourceTreeHash}, 'implementer',
      NOW(), NOW() + INTERVAL '1 hour', NOW(), 'claimed', ${claimId}, ${root})`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'attempt_reserved', attempt_id = ${attemptId},
        claim_id = ${claimId} WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'leased', attempt_id = NULL, claim_id = NULL
      WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input),
      REFUSED, "cleared delivery linkage cannot hide an active claim or attempt");
    await database.sql`UPDATE public.claim_log SET abandoned_at = NOW()
      WHERE id = ${claimId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input),
      REFUSED, "an outcome-null claim remains open even with abandoned_at");
    await database.sql`UPDATE public.claim_log SET outcome = 'completed'
      WHERE id = ${claimId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input),
      REFUSED, "a terminal claim cannot hide its still-active attempt");
    await database.sql`UPDATE public.execution_attempts SET disposition = 'failed'
      WHERE attempt_id = ${attemptId}`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET attempt_count = 1 WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input),
      REFUSED, "a previously reserved attempt cannot become pre-attempt again");
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET attempt_count = 0 WHERE dispatch_id = ${input.dispatchId}`;
    const noRows = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(noRows[0]?.count, 0);

    stage = "rollback-before-commit";
    await database.sql.unsafe(`CREATE FUNCTION public.task6a_private_recovery_precreate_crash_probe_v1()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'TASK6A_PRIVATE_RECOVERY_PRECREATE_ROLLBACK_PROBE';
      END $$`);
    await database.sql.unsafe(`CREATE TRIGGER task6a_private_recovery_precreate_crash_probe_v1
      AFTER INSERT ON ${TABLE} FOR EACH ROW
      EXECUTE FUNCTION public.task6a_private_recovery_precreate_crash_probe_v1()`);
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await database.sql.unsafe(`DROP TRIGGER task6a_private_recovery_precreate_crash_probe_v1 ON ${TABLE}`);
    await database.sql.unsafe(`DROP FUNCTION public.task6a_private_recovery_precreate_crash_probe_v1()`);
    const rolledBack = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(rolledBack[0]?.count, 0);

    stage = "exact-lease-reservation";
    const first = await appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input);
    assert.equal(first.authority, "diagnostic-only");
    assert.equal(first.disposition, "inserted");
    assert.match(first.reservationHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(await appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input),
      { ...first, disposition: "identical-retry" });
    assert.equal(fs.existsSync(root), false);
    const row = await database.sql.unsafe<Array<{ canonicalBody: string; count: number }>>(
      `SELECT canonical_body AS "canonicalBody", count(*) OVER ()::integer AS count FROM ${TABLE}`);
    assert.equal(row[0]?.count, 1);
    assert.equal(row[0]?.canonicalBody.includes(input.leaseToken), false);
    await assert.rejects(database.sql.unsafe(`UPDATE ${TABLE} SET root = root`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    await assert.rejects(database.sql.unsafe(`DELETE FROM ${TABLE}`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    await assert.rejects(database.sql.unsafe(`TRUNCATE ${TABLE}`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");

    stage = "same-owner-lease-rotation-refuses-old-row";
    const rotatedToken = randomBytes(32).toString("hex");
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET lease_token = ${rotatedToken}, lease_expires_at = NOW() + INTERVAL '5 minutes'
      WHERE dispatch_id = ${input.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input), REFUSED);
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql,
      { ...input, leaseToken: rotatedToken }), REFUSED);
    const stable = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${TABLE}`);
    assert.equal(stable[0]?.count, 1);
    assert.equal(fs.existsSync(root), false);
  } catch (error) {
    failure = error;
    process.stderr.write(`[task6a-private-recovery-precreate-reservation] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_RECOVERY_PRECREATE_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_RECOVERY_PRECREATE_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
