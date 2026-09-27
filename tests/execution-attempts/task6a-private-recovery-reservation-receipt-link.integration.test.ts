import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { derivePositiveWorktreeBindingReceiptCandidateV1 } from
  "../../src/internal-production/baseline-positive-worktree-binding-contract-v1.js";
import { appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1,
  PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-receipt-journal-contract-v1.js";
import { appendPrivateDiagnosticRecoveryReservationReceiptLinkV1,
  PRIVATE_POSITIVE_WORKTREE_RECOVERY_RESERVATION_RECEIPT_LINK_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-recovery-reservation-receipt-link-contract-v1.js";
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
const REFUSED = /TASK6A_PRIVATE_RECOVERY_RESERVATION_RECEIPT_LINK_REFUSED/;
const LINK = "public.internal_production_positive_worktree_recovery_reservation_receipt_links_v1";

for (const dispatchClass of ["product_implementation", "supervisor_repair"] as const) {
test(`private ${dispatchClass} recovery link requires the exact committed lease/publication/receipt chain`, {
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

    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_RESERVATION_RECEIPT_LINK_V1_STATEMENTS) {
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
      sourceRevision: findingSet.sourceRevision,
      owner: dispatchClass === "product_implementation" ? "implement" : "supervisor",
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
      dispatchClass,
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
stage = "reservation-before-claim";
    const reservation = await appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, input);
    const claimId = 999988;
    const attemptId = `ATT_${randomBytes(8).toString("hex")}`;
    const sessionId = `RTS_${randomBytes(8).toString("hex")}`;
    const fenceToken = randomBytes(32).toString("hex");
    const sliceHash = handoff.directive.contractSliceHash;
    const hashes = { reservationHash: reservation.reservationHash, receiptHash: "f".repeat(64) };
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, hashes), REFUSED);

    stage = "exact-active-claim-and-receipt";
    await database.sql`UPDATE public.stories
      SET status = 'running', claim_generation = 1 WHERE id = ${storyDbId}`;
    await database.sql`UPDATE public.steps SET current_story_id = ${storyDbId}
      WHERE id = ${stepDbId}`;
    await database.sql`INSERT INTO public.claim_log (id, run_id, step_id, story_id, agent_id)
      VALUES (${claimId}, ${runId}, 'implement', ${storyId}, 'agent')`;
    await database.sql`UPDATE public.stories
      SET claimed_by = 'agent', claimed_at = c.claimed_at
      FROM public.claim_log c WHERE stories.id = ${storyDbId} AND c.id = ${claimId}`;
    await database.sql`INSERT INTO public.execution_attempts (
      attempt_id, run_id, step_id, story_id, agent_id, generation, fence_token,
      attempt_class, compilation_report_hash, source_before_sha, source_before_tree_hash,
      role, lease_acquired_at, lease_expires_at, heartbeat_at, disposition,
      claim_id, worktree, recovery_dispatch_id, recovery_case_revision_id,
      packet_hash, slice_hash, finding_set_hash, dedupe_key
    ) VALUES (
      ${attemptId}, ${runId}, 'implement', ${storyId}, 'agent', 1, ${fenceToken},
      ${dispatchClass}, 'private-report', ${sourceSha}, ${sourceTreeHash},
      ${dispatchClass === "product_implementation" ? "developer" : "supervisor"},
      NOW(), NOW() + INTERVAL '1 hour', NOW(), 'claimed',
      ${claimId}, ${root}, ${handoff.dispatchId}, ${handoff.revisionId},
      ${handoff.directive.packetHash}, ${sliceHash}, ${handoff.directive.findingSetHash},
      ${dispatchClass === "product_implementation" ? "e".repeat(64) : null}
    )`;
    await database.sql`INSERT INTO public.runtime_sessions (
      session_id, run_id, step_db_id, workflow_step_id, claim_id, attempt_id,
      claim_agent_id, runtime_agent_id, runtime_kind, state, owner_instance_id,
      heartbeat_at, worktree, story_db_id, story_id
    ) VALUES (
      ${sessionId}, ${runId}, ${stepDbId}, 'implement', ${claimId}, ${attemptId},
      'agent', 'agent', 'external_session', 'reserved', ${ownerInstanceId},
      NOW(), ${root}, ${storyDbId}, ${storyId}
    )`;
    await database.sql`INSERT INTO public.v3_story_claim_runtime_bindings_v1 (
      claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
      subject_kind, story_db_id, story_id, story_index, story_claim_generation,
      story_admission_receipt_hash, story_admission_subject_hash, bound_at
    ) SELECT ${claimId}, ${sessionId}, ${runId}, ${stepDbId}, 'implement',
      'story_member', ${storyDbId}, ${storyId}, 1, 1,
      ${"c".repeat(64)}, ${"d".repeat(64)}, c.claimed_at
      FROM public.claim_log c WHERE c.id = ${claimId}`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET state = 'attempt_reserved', attempt_id = ${attemptId},
        claim_id = ${claimId}, attempt_count = 1,
        execution_slice_hash = ${sliceHash}, started_at = clock_timestamp()
      WHERE dispatch_id = ${handoff.dispatchId}`;
    const attempt = { runId, claimId: String(claimId), attemptId, generation: 1,
      fenceToken, worktreeRoot: root, sourceSha, sourceTreeHash, disposition: "claimed" };
    const session = { runId, claimId: String(claimId), attemptId, sessionId,
      ownerInstanceId, worktreeRoot: root, state: "reserved" };
    const physical = { root, dev: "11", ino: "22", birthtimeNs: "33",
      gitPrimaryRoot: `/tmp/projects/${suffix}` };
    const receipt = derivePositiveWorktreeBindingReceiptCandidateV1({ attempt, session, physical }).receipt;
    await appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(database.sql,
      { attempt, session, physical, receipt });
    const exact = { reservationHash: reservation.reservationHash, receiptHash: receipt.receiptHash };
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "the immutable V3 publication is mandatory");

    stage = "exact-v3-publication";
    await database.sql`INSERT INTO public.internal_production_v3_recovery_claim_publications_v1 (
      claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
      story_db_id, story_id, story_index, recovery_case_id, revision_id,
      dispatch_id, status, handoff_canonical_json, handoff_hash, bound_at
    ) VALUES (
      ${claimId}, ${sessionId}, ${runId}, ${stepDbId}, 'implement',
      ${storyDbId}, ${storyId}, 1, ${handoff.recoveryCaseId}, ${handoff.revisionId},
      ${handoff.dispatchId}, ${handoff.status}, ${canonicalJsonStringify(handoff)},
      ${hashCanonicalJson(handoff)},
      (SELECT claimed_at FROM public.claim_log WHERE id = ${claimId})
    )`;
    for (const crossed of [
      { ...exact, reservationHash: "f".repeat(64) },
      { ...exact, receiptHash: "e".repeat(64) },
      { ...exact, extra: "ambient-authority" },
    ]) await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(
      database.sql, crossed), REFUSED);
    stage = "stale-chain-refusal";
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET authorized_at = authorized_at + INTERVAL '1 second'
      WHERE dispatch_id = ${handoff.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "delivery authorization time must equal the dispatch birth");
    await database.sql`UPDATE public.recovery_dispatch_deliveries delivery
      SET authorized_at = dispatch.authorized_at
      FROM public.recovery_revision_dispatches dispatch
      WHERE delivery.dispatch_id = ${handoff.dispatchId}
        AND dispatch.dispatch_id = delivery.dispatch_id`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries SET started_at = NULL
      WHERE dispatch_id = ${handoff.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "an active delivery requires its start time");
    await database.sql`UPDATE public.recovery_dispatch_deliveries delivery
      SET started_at = runtime.created_at - INTERVAL '1 second'
      FROM public.runtime_sessions runtime
      WHERE delivery.dispatch_id = ${handoff.dispatchId}
        AND runtime.session_id = ${sessionId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "delivery cannot start before runtime creation");
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET started_at = clock_timestamp() WHERE dispatch_id = ${handoff.dispatchId}`;
    await database.sql`UPDATE public.stories SET claimed_by = 'crossed-agent'
      WHERE id = ${storyDbId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "live story claimant must be the active claim agent");
    await database.sql`UPDATE public.stories SET claimed_by = 'agent'
      WHERE id = ${storyDbId}`;
    await database.sql`UPDATE public.stories
      SET claimed_at = claimed_at + INTERVAL '1 second' WHERE id = ${storyDbId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "story claim birth must equal the immutable publication bound time");
    await database.sql`UPDATE public.stories SET claimed_at = c.claimed_at
      FROM public.claim_log c WHERE stories.id = ${storyDbId} AND c.id = ${claimId}`;
    await assert.rejects(database.sql`UPDATE public.runs
      SET packet_hash = ${"f".repeat(64)} WHERE id = ${runId}`,
      /RUN_PACKET_HASH_IMMUTABLE/, "the base schema independently protects the live run packet");
    await database.sql`UPDATE public.steps SET current_story_id = NULL
      WHERE id = ${stepDbId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "claim step must still own the exact story");
    await database.sql`UPDATE public.steps SET current_story_id = ${storyDbId}
      WHERE id = ${stepDbId}`;
    await database.sql`UPDATE public.steps SET status = 'completed'
      WHERE id = ${stepDbId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "claim step must remain running");
    await database.sql`UPDATE public.steps SET status = 'running'
      WHERE id = ${stepDbId}`;
    await database.sql`UPDATE public.recovery_cases SET status = 'evidencing'
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "implementation recovery requires a repairing case");
    await database.sql`UPDATE public.recovery_cases SET status = 'repairing'
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    await database.sql`UPDATE public.execution_attempts
      SET role = ${dispatchClass === "product_implementation" ? "supervisor" : "developer"}
      WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "recovery role must match dispatch class");
    await database.sql`UPDATE public.execution_attempts
      SET role = ${dispatchClass === "product_implementation" ? "developer" : "supervisor"}
      WHERE attempt_id = ${attemptId}`;
    await database.sql`UPDATE public.recovery_cases
      SET expected_delta = ${JSON.stringify({ kind: "source_change",
        invariantRefs: ["INV_CROSSED_CASE"], requiredPaths: ["src/App.tsx"] })}::text::jsonb
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      REFUSED, "mutable current case must still match the published revision");
    await database.sql`UPDATE public.recovery_cases
      SET expected_delta = ${JSON.stringify(revision.expectedDelta)}::text::jsonb
      WHERE recovery_case_id = ${recoveryCase.recoveryCaseId}`;
    await database.sql`UPDATE public.claim_log SET abandoned_at = NOW() WHERE id = ${claimId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    await database.sql`UPDATE public.claim_log SET abandoned_at = NULL WHERE id = ${claimId}`;
    await database.sql`UPDATE public.execution_attempts
      SET lease_acquired_at = NOW() - INTERVAL '1 hour',
        heartbeat_at = NOW() - INTERVAL '2 seconds',
        lease_expires_at = NOW() - INTERVAL '1 second'
      WHERE attempt_id = ${attemptId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    await database.sql`UPDATE public.execution_attempts
      SET lease_acquired_at = NOW(), heartbeat_at = NOW(),
        lease_expires_at = NOW() + INTERVAL '1 hour' WHERE attempt_id = ${attemptId}`;
    await database.sql`UPDATE public.runtime_sessions SET story_id = 'other-story'
      WHERE session_id = ${sessionId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    await database.sql`UPDATE public.runtime_sessions SET story_id = ${storyId}
      WHERE session_id = ${sessionId}`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET execution_slice_hash = ${"a".repeat(64)} WHERE dispatch_id = ${handoff.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET execution_slice_hash = ${sliceHash} WHERE dispatch_id = ${handoff.dispatchId}`;
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET lease_expires_at = NOW() - INTERVAL '1 second' WHERE dispatch_id = ${handoff.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET lease_expires_at = NOW() + INTERVAL '5 minutes' WHERE dispatch_id = ${handoff.dispatchId}`;

    stage = "rollback-before-commit";
    await database.sql.unsafe(`CREATE FUNCTION public.task6a_private_recovery_link_crash_probe_v1()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'TASK6A_PRIVATE_RECOVERY_LINK_ROLLBACK_PROBE';
      END $$`);
    await database.sql.unsafe(`CREATE TRIGGER task6a_private_recovery_link_crash_probe_v1
      AFTER INSERT ON ${LINK} FOR EACH ROW
      EXECUTE FUNCTION public.task6a_private_recovery_link_crash_probe_v1()`);
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    await database.sql.unsafe(`DROP TRIGGER task6a_private_recovery_link_crash_probe_v1 ON ${LINK}`);
    await database.sql.unsafe(`DROP FUNCTION public.task6a_private_recovery_link_crash_probe_v1()`);
    assert.equal((await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${LINK}`))[0]?.count, 0);

    stage = "insert-and-identical-retry";
    const first = await appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact);
    assert.equal(first.authority, "diagnostic-only");
    assert.equal(first.disposition, "inserted");
    assert.deepEqual(await appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact),
      { ...first, disposition: "identical-retry" });
    const rows = await database.sql.unsafe<Array<{ canonicalBody: string; count: number }>>(
      `SELECT canonical_body AS "canonicalBody", count(*) OVER ()::integer AS count FROM ${LINK}`);
    assert.equal(rows[0]?.count, 1);
    assert.equal(rows[0]?.canonicalBody.includes(handoff.lease.leaseToken), false);
    assert.equal(rows[0]?.canonicalBody.includes(fenceToken), false);
    await assert.rejects(database.sql.unsafe(`UPDATE ${LINK} SET root = root`),
      (error: unknown) => error !== null && typeof error === "object"
        && "code" in error && error.code === "42501");
    for (const operation of [`DELETE FROM ${LINK}`, `TRUNCATE ${LINK}`]) {
      await assert.rejects(database.sql.unsafe(operation),
        (error: unknown) => error !== null && typeof error === "object"
          && "code" in error && error.code === "42501");
    }
    const pending = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM
        public.internal_production_positive_worktree_recovery_precreate_reservations_v1`);
    assert.equal(pending[0]?.count, 1, "a diagnostic link cannot settle the pending reservation");

    stage = "stale-retry-refusal";
    await database.sql`UPDATE public.recovery_dispatch_deliveries
      SET lease_token = ${randomBytes(32).toString("hex")}
      WHERE dispatch_id = ${handoff.dispatchId}`;
    await assert.rejects(appendPrivateDiagnosticRecoveryReservationReceiptLinkV1(database.sql, exact), REFUSED);
    const stable = await database.sql.unsafe<Array<{ count: number }>>(
      `SELECT count(*)::integer AS count FROM ${LINK}`);
    assert.equal(stable[0]?.count, 1);
    assert.equal(fs.existsSync(root), false);
  } catch (error) {
    failure = error;
    process.stderr.write(`[task6a-private-recovery-reservation-receipt-link] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    delete process.env.SETFARM_PG_URL;
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_RECOVERY_LINK_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_RECOVERY_LINK_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
}
