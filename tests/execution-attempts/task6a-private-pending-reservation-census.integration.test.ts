import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { createRecoveryCaseV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryCaseRevisionV1 } from "../../src/recovery/recovery-delivery.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import { observePrivatePendingPositiveWorktreeReservationsV1 } from
  "../../src/internal-production/baseline-positive-worktree-private-pending-reservation-census-v1.js";
import { appendPrivateDiagnosticPrecreateReservationV1,
  PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-precreate-reservation-contract-v1.js";
import { appendPrivateDiagnosticRecoveryPrecreateReservationV1,
  PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const REFUSED = /TASK6A_PRIVATE_PENDING_RESERVATION_CENSUS_REFUSED/;
const ORDINARY_REFUSED = /TASK6A_PRIVATE_PRECREATE_RESERVATION_REFUSED/;
const RECOVERY_REFUSED = /TASK6A_PRIVATE_RECOVERY_PRECREATE_RESERVATION_REFUSED/;
const ORDINARY = "public.internal_production_positive_worktree_precreate_reservations_v1";

async function createPrivateReservationTables(database: TestDatabase): Promise<void> {
  for (const statement of PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS) {
    await database.sql.unsafe(statement);
  }
  for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS) {
    await database.sql.unsafe(statement);
  }
}

async function withPrivateDatabase(operation: (database: TestDatabase) => Promise<void>): Promise<void> {
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
    database = await createIsolatedTestDatabase();
    const maximum = await database.sql<Array<{ version: number }>>`
      SELECT max(version)::integer AS version FROM public.setfarm_schema_migrations`;
    assert.equal(maximum[0]?.version, 33);
    await createPrivateReservationTables(database);
    await operation(database);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    delete process.env.SETFARM_PG_URL;
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_PENDING_CENSUS_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_PENDING_CENSUS_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
}

for (const scenario of ["normal", "malformed-recovery", "concurrent"] as const) {
test(`private pending census ${scenario === "normal"
  ? "counts both complete post-33 reservation tables without admitting owners"
  : scenario === "malformed-recovery"
    ? "refuses recovery parent body-column divergence"
    : "allows only one concurrent cross-table same-root appender"}`, {
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
    await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql), REFUSED,
      "missing private tables cannot be read as zero pending reservations");
    await createPrivateReservationTables(database);
    const empty = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
    assert.equal(empty.authority, "diagnostic-only");
    assert.equal(empty.disposition, "empty");
    assert.equal(empty.physicalIdentityProvenance, "unverified");
    assert.deepEqual(empty.counts, { ordinary: 0, recovery: 0, total: 0 });

    stage = "ordinary-pending-row";
    const suffix = randomBytes(6).toString("hex");
    const runId = `task6a-census-${suffix}`;
    const storyDbId = `story-${suffix}`;
    const storyId = "US-001";
    const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
    const sourceSha = "a".repeat(40), sourceTreeHash = "b".repeat(40);
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`INSERT INTO public.runs (
      id, run_number, workflow_id, task, status, context, protocol,
      compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
    ) VALUES (${runId}, 999991, 'workflow', 'private census probe',
      'running', '{}', 'v3', ${releaseSha}, ${"c".repeat(64)},
      ${"e".repeat(64)}, ${releaseAdmissionHash})`;
    await database.sql`INSERT INTO public.steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects, status, type
    ) VALUES (${`step-${suffix}`}, ${runId}, 'implement', 'agent', 1, '', '', 'running', 'loop')`;
    await database.sql`INSERT INTO public.stories (id, run_id, story_index, story_id, title, status)
      VALUES (${storyDbId}, ${runId}, 1, ${storyId}, 'private census probe', 'failed')`;
    await appendPrivateDiagnosticPrecreateReservationV1(database.sql, {
      runId, storyDbId, storyId, dispatchKey: `ordinary-${suffix}`,
      ownerInstanceId: `owner-${suffix}`, root,
      sourceSha, sourceTreeHash,
    });
    const pending = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
    assert.equal(pending.disposition, "pending");
    assert.deepEqual(pending.counts, { ordinary: 1, recovery: 0, total: 1 });
    assert.match(pending.identitySetHash, /^[a-f0-9]{64}$/);
    assert.notEqual(pending.identitySetHash, empty.identitySetHash);
    assert.equal(JSON.stringify(pending).includes(root), false,
      "the diagnostic response must not expose raw root paths");

    stage = "real-recovery-dispatch";
    const findingSet = createFindingSetV1({ runId, storyId,
      packetHash: "c".repeat(64), sliceHash: "d".repeat(64),
      sourceRevision: { sha: sourceSha, treeHash: sourceTreeHash },
      findings: [{ origin: "runtime", classification: "structured",
        invariantRef: "INV_CENSUS",
        sourceLocators: [{ path: "src/App.tsx", contentHash: "e".repeat(64) }],
        observedEvidenceRefs: ["f".repeat(64)],
        expectedPredicateRef: "EVID_CENSUS", status: "open" }] });
    await database.sql`INSERT INTO public.finding_sets (
      finding_set_hash, finding_set_id, run_id, story_id, packet_hash,
      slice_hash, source_sha, source_tree_hash, finding_ids, payload
    ) VALUES (${findingSet.findingSetHash}, ${findingSet.findingSetId},
      ${runId}, ${storyId}, ${findingSet.packetHash}, ${findingSet.sliceHash},
      ${sourceSha}, ${sourceTreeHash},
      ${JSON.stringify(findingSet.findings.map((finding) => finding.findingId))}::text::jsonb,
      ${JSON.stringify(findingSet)}::text::jsonb)`;
    const draft = { runId, storyId, findingSetHash: findingSet.findingSetHash,
      findingIds: findingSet.findings.map((finding) => finding.findingId),
      packetHash: findingSet.packetHash, sliceHash: findingSet.sliceHash,
      sourceRevision: findingSet.sourceRevision, owner: "implement",
      expectedDelta: { kind: "source_change", invariantRefs: ["INV_CENSUS"],
        requiredPaths: ["src/App.tsx"] }, allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_CENSUS"], priorAttemptRefs: [],
      budget: { limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 } },
      status: "open", decisionRefs: [] } as const;
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
    const authorized = await createRecoveryDeliveryRepository(database.sql)
      .authorizeCurrentRevision({ recoveryCaseId: recoveryCase.recoveryCaseId,
        revisionId: revision.revisionId,
        expectedStateVersion: recoveryCase.stateVersion,
        dispatchClass: "product_implementation" }, { now: new Date() });
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected authorization");
    const handoff = await createV3RecoveryClaimAuthority(database.sql).acquireRecoveryClaim({
      runId, storyId, ownerInstanceId: `owner-${suffix}`, leaseMs: 300_000,
    }, { now: new Date() });
    assert.equal(handoff.dispatchId, authorized.dispatch.dispatchId);
    const recoveryRoot = `/tmp/projects/${suffix}/.worktrees/story-1-recovery`;
    if (scenario === "concurrent") {
      stage = "concurrent-cross-table-root";
      const otherRunId = `task6a-census-race-${suffix}`;
      const otherStoryDbId = `race-story-${suffix}`;
      await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
        VALUES (${otherRunId}, 999988, 'workflow', 'cross-table race', 'running', '{}')`;
      await database.sql`INSERT INTO public.stories (id, run_id, story_index, story_id, title, status)
        VALUES (${otherStoryDbId}, ${otherRunId}, 1, 'US-RACE', 'cross-table race', 'pending')`;
      const ordinaryClient = postgres(database.url, { max: 1 });
      const recoveryClient = postgres(database.url, { max: 1 });
      const blockerClient = postgres(database.url, { max: 1 });
      let releaseBlocker = (): void => {};
      let blockerPromise: Promise<unknown> | undefined;
      let settleStarted: Promise<unknown> | undefined;
      try {
        const ordinaryPid = (await ordinaryClient<Array<{ pid: number }>>`
          SELECT pg_backend_pid()::integer AS pid`)[0]!.pid;
        const recoveryPid = (await recoveryClient<Array<{ pid: number }>>`
          SELECT pg_backend_pid()::integer AS pid`)[0]!.pid;
        let lockReady!: () => void;
        const ready = new Promise<void>((resolve) => { lockReady = resolve; });
        const released = new Promise<void>((resolve) => { releaseBlocker = resolve; });
        blockerPromise = blockerClient.begin(async (tx) => {
          await tx.unsafe(`LOCK TABLE ${ORDINARY},
            public.internal_production_positive_worktree_recovery_precreate_reservations_v1
            IN SHARE MODE`);
          lockReady();
          await released;
        });
        await Promise.race([ready, blockerPromise]);
        const outcomesPromise = Promise.allSettled([
          appendPrivateDiagnosticPrecreateReservationV1(ordinaryClient, {
            runId: otherRunId, storyDbId: otherStoryDbId, storyId: "US-RACE",
            dispatchKey: `race-ordinary-${suffix}`, ownerInstanceId: `race-owner-${suffix}`,
            root: recoveryRoot, sourceSha, sourceTreeHash,
          }),
          appendPrivateDiagnosticRecoveryPrecreateReservationV1(recoveryClient, {
            runId, storyDbId, storyId, dispatchId: handoff.dispatchId,
            ownerInstanceId: `owner-${suffix}`, leaseToken: handoff.lease.leaseToken,
            root: recoveryRoot, sourceSha, sourceTreeHash,
          }),
        ]);
        settleStarted = outcomesPromise;
        let bothBlockedAtInsert = false;
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          const activity = await database.sql<Array<{ pid: number;
            waitEventType: string | null; query: string }>>`SELECT pid,
              wait_event_type AS "waitEventType", query
              FROM pg_catalog.pg_stat_activity
              WHERE pid IN (${ordinaryPid}, ${recoveryPid})`;
          bothBlockedAtInsert = activity.length === 2 && activity.every((row) =>
            row.waitEventType === "Lock"
            && row.query.includes("INSERT INTO public.internal_production_positive_worktree_"));
          if (bothBlockedAtInsert) break;
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
        assert.equal(bothBlockedAtInsert, true,
          "both independent appenders must reach blocked INSERT after reciprocal absent-key reads");
        releaseBlocker();
        await blockerPromise;
        const outcomes = await outcomesPromise;
        assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
        const refused = outcomes.find((outcome) => outcome.status === "rejected");
        assert.ok(refused && refused.status === "rejected");
        assert.match(String(refused.reason),
          /TASK6A_PRIVATE_(?:RECOVERY_)?PRECREATE_RESERVATION_REFUSED/);
        const owners = await database.sql.unsafe<Array<{ ordinary: number; recovery: number }>>(`
          SELECT (SELECT count(*)::integer FROM ${ORDINARY} WHERE root = $1) AS ordinary,
            (SELECT count(*)::integer FROM
              public.internal_production_positive_worktree_recovery_precreate_reservations_v1
              WHERE root = $1) AS recovery`, [recoveryRoot]);
        assert.equal(owners[0]!.ordinary + owners[0]!.recovery, 1);
        const census = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
        assert.equal(census.disposition, "pending");
        assert.equal(census.counts.total, 2);
      } finally {
        releaseBlocker();
        await blockerPromise?.catch(() => undefined);
        await settleStarted;
        await Promise.all([ordinaryClient.end({ timeout: 5 }),
          recoveryClient.end({ timeout: 5 }), blockerClient.end({ timeout: 5 })]);
      }
      return;
    }
    if (scenario === "malformed-recovery") {
      const leaseTokenHash = hashCanonicalJson({
        schema: "setfarm.internal-production-positive-worktree-recovery-lease-token-commitment.v1",
        dispatchId: handoff.dispatchId, leaseToken: handoff.lease.leaseToken,
      });
      const body = {
        schema: "setfarm.internal-production-positive-worktree-private-recovery-precreate-reservation.v1",
        runId, storyDbId, storyId, dispatchId: handoff.dispatchId,
        recoveryCaseId: handoff.recoveryCaseId, revisionId: handoff.revisionId,
        ownerInstanceId: `owner-${suffix}`, root: `${recoveryRoot}-forged`,
        sourceSha, sourceTreeHash, leaseTokenHash,
      };
      await database.sql`INSERT INTO public.internal_production_positive_worktree_recovery_precreate_reservations_v1 (
        reservation_hash, run_id, story_db_id, story_id, dispatch_id,
        recovery_case_id, revision_id, owner_instance_id, root, source_sha,
        source_tree_hash, lease_token_hash, canonical_body
      ) VALUES (${hashCanonicalJson(body)}, ${runId}, ${storyDbId}, ${storyId},
        ${handoff.dispatchId}, ${handoff.recoveryCaseId}, ${handoff.revisionId},
        ${`owner-${suffix}`}, ${recoveryRoot}, ${sourceSha}, ${sourceTreeHash},
        ${leaseTokenHash}, ${canonicalJsonStringify(body)})`;
      await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql),
        REFUSED, "a hash-valid recovery body cannot disagree with sibling columns");
      return;
    }
    await assert.rejects(appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, {
      runId, storyDbId, storyId, dispatchId: handoff.dispatchId,
      ownerInstanceId: `owner-${suffix}`, leaseToken: handoff.lease.leaseToken,
      root, sourceSha, sourceTreeHash,
    }), RECOVERY_REFUSED,
    "the recovery appender must refuse the ordinary reservation's exact root");
    await appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, {
      runId, storyDbId, storyId, dispatchId: handoff.dispatchId,
      ownerInstanceId: `owner-${suffix}`, leaseToken: handoff.lease.leaseToken,
      root: recoveryRoot, sourceSha, sourceTreeHash,
    });
    const both = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
    assert.equal(both.disposition, "pending");
    assert.deepEqual(both.counts, { ordinary: 1, recovery: 1, total: 2 });
    assert.notEqual(both.identitySetHash, pending.identitySetHash);
    assert.equal(JSON.stringify(both).includes(recoveryRoot), false);
    assert.deepEqual(await observePrivatePendingPositiveWorktreeReservationsV1(database.sql), both,
      "the same complete identity set must hash identically in a fresh snapshot");

    stage = "multirow-stable-order";
    const secondStoryDbId = `story-2-${suffix}`;
    await database.sql`INSERT INTO public.stories (
      id, run_id, story_index, story_id, title, status
    ) VALUES (${secondStoryDbId}, ${runId}, 2, 'US-002', 'ordering probe', 'pending')`;
    await assert.rejects(appendPrivateDiagnosticPrecreateReservationV1(database.sql, {
      runId, storyDbId: secondStoryDbId, storyId: "US-002",
      dispatchKey: `second-ordinary-${suffix}`, ownerInstanceId: `owner-${suffix}`,
      root: recoveryRoot, sourceSha, sourceTreeHash,
    }), ORDINARY_REFUSED,
    "the ordinary appender must refuse the recovery reservation's exact root");
    await appendPrivateDiagnosticPrecreateReservationV1(database.sql, {
      runId, storyDbId: secondStoryDbId, storyId: "US-002",
      dispatchKey: `second-ordinary-${suffix}`, ownerInstanceId: `owner-${suffix}`,
      root: `/tmp/projects/${suffix}/.worktrees/story-2`, sourceSha, sourceTreeHash,
    });
    const three = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
    assert.deepEqual(three.counts, { ordinary: 2, recovery: 1, total: 3 });
    assert.deepEqual(await observePrivatePendingPositiveWorktreeReservationsV1(database.sql), three);

    stage = "cross-table-exact-root-collision";
    const thirdStoryDbId = `story-3-${suffix}`;
    await database.sql`INSERT INTO public.stories (
      id, run_id, story_index, story_id, title, status
    ) VALUES (${thirdStoryDbId}, ${runId}, 3, 'US-003', 'collision probe', 'pending')`;
    const directBody = { schema: "setfarm.internal-production-positive-worktree-private-precreate-reservation.v1",
      runId, storyDbId: thirdStoryDbId, storyId: "US-003",
      dispatchKey: `third-ordinary-${suffix}`, ownerInstanceId: `owner-${suffix}`,
      root: recoveryRoot, sourceSha, sourceTreeHash };
    await database.sql`INSERT INTO public.internal_production_positive_worktree_precreate_reservations_v1 (
      reservation_hash, run_id, story_db_id, story_id, dispatch_key,
      owner_instance_id, root, source_sha, source_tree_hash, canonical_body
    ) VALUES (${hashCanonicalJson(directBody)}, ${runId}, ${thirdStoryDbId}, 'US-003',
      ${directBody.dispatchKey}, ${directBody.ownerInstanceId}, ${recoveryRoot},
      ${sourceSha}, ${sourceTreeHash}, ${canonicalJsonStringify(directBody)})`;
    await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql),
      REFUSED, "exact cross-table root collision cannot be silently counted as safe");
  } catch (error) {
    failure = error;
    process.stderr.write(`[task6a-private-pending-reservation-census] failed at ${stage}\n`);
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    delete process.env.SETFARM_PG_URL;
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_PENDING_CENSUS_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_PENDING_CENSUS_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
});
}

test("private pending census refuses a hash-valid parent whose columns disagree with its body", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withPrivateDatabase(async (database) => {
  const suffix = randomBytes(6).toString("hex");
  const runId = `task6a-census-forged-${suffix}`;
  const storyDbId = `story-${suffix}`;
  const root = `/tmp/projects/${suffix}/.worktrees/story-1`;
  await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
    VALUES (${runId}, 999990, 'workflow', 'forged census parent', 'running', '{}')`;
  await database.sql`INSERT INTO public.stories (id, run_id, story_index, story_id, title)
    VALUES (${storyDbId}, ${runId}, 1, 'US-001', 'forged census parent')`;
  const body = { schema: "setfarm.internal-production-positive-worktree-private-precreate-reservation.v1",
    runId, storyDbId, storyId: "US-001", dispatchKey: `ordinary-${suffix}`,
    ownerInstanceId: `owner-${suffix}`, root: `${root}-forged`,
    sourceSha: "a".repeat(40), sourceTreeHash: "b".repeat(40) };
  await database.sql`INSERT INTO public.internal_production_positive_worktree_precreate_reservations_v1 (
    reservation_hash, run_id, story_db_id, story_id, dispatch_key,
    owner_instance_id, root, source_sha, source_tree_hash, canonical_body
  ) VALUES (${hashCanonicalJson(body)}, ${runId}, ${storyDbId}, 'US-001',
    ${body.dispatchKey}, ${body.ownerInstanceId}, ${root},
    ${body.sourceSha}, ${body.sourceTreeHash}, ${canonicalJsonStringify(body)})`;
  await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql), REFUSED);
}));

test("private pending census refuses more than its complete bounded snapshot capacity", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withPrivateDatabase(async (database) => {
  const suffix = randomBytes(6).toString("hex");
  const runId = `task6a-census-overflow-${suffix}`;
  await database.sql`INSERT INTO public.runs (id, run_number, workflow_id, task, status, context)
    VALUES (${runId}, 999989, 'workflow', 'overflow census parent', 'running', '{}')`;
  await database.sql.unsafe(`INSERT INTO public.stories (
    id, run_id, story_index, story_id, title, status
  ) SELECT 'story-' || $1 || '-' || g::text, $2, g,
      'US-' || lpad(g::text, 3, '0'), 'overflow census story', 'pending'
    FROM generate_series(1, 257) AS g`, [suffix, runId]);
  const insertRows = async (first: number, last: number): Promise<void> => {
    await database.sql.unsafe(`INSERT INTO ${ORDINARY} (
      reservation_hash, run_id, story_db_id, story_id, dispatch_key,
      owner_instance_id, root, source_sha, source_tree_hash, canonical_body
    ) SELECT encode(pg_catalog.sha256(pg_catalog.convert_to(body.canonical, 'UTF8')), 'hex'),
        $2, 'story-' || $1 || '-' || g::text,
        'US-' || lpad(g::text, 3, '0'), 'ordinary-' || g::text,
        'owner-overflow', '/tmp/projects/' || $1 || '/.worktrees/story-' || g::text,
        repeat('a', 40), repeat('b', 40), body.canonical
      FROM generate_series($3::integer, $4::integer) AS g
      CROSS JOIN LATERAL (SELECT format(
        '{"dispatchKey":"ordinary-%s","ownerInstanceId":"owner-overflow","root":"/tmp/projects/%s/.worktrees/story-%s","runId":"%s","schema":"setfarm.internal-production-positive-worktree-private-precreate-reservation.v1","sourceSha":"%s","sourceTreeHash":"%s","storyDbId":"story-%s-%s","storyId":"US-%s"}',
        g, $1::text, g, $2::text, repeat('a', 40), repeat('b', 40), $1::text, g,
        lpad(g::text, 3, '0')) AS canonical) AS body`,
    [suffix, runId, first, last]);
  };
  await insertRows(1, 256);
  const atCapacity = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
  assert.equal(atCapacity.disposition, "pending");
  assert.deepEqual(atCapacity.counts, { ordinary: 256, recovery: 0, total: 256 },
    "all 256 canonical reservations must be accepted before testing the cap");
  await insertRows(257, 257);
  const countRows = await database.sql.unsafe<Array<{ count: number }>>(
    `SELECT count(*)::integer AS count FROM ${ORDINARY}`);
  assert.equal(countRows[0]?.count, 257);
  await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql), REFUSED,
    "over-limit census must refuse before emitting a truncated zero-owner snapshot");
}));

test("private pending census refuses a held relation lock within its bounded timeout", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withPrivateDatabase(async (database) => {
  const blocker = postgres(database.url, { max: 1 });
  let acquired!: () => void;
  const lockAcquired = new Promise<void>((resolve) => { acquired = resolve; });
  const held = blocker.begin(async (tx) => {
    await tx.unsafe(`LOCK TABLE ${ORDINARY} IN ACCESS EXCLUSIVE MODE`);
    acquired();
    await new Promise<void>((resolve) => setTimeout(resolve, 2_500));
  });
  try {
    await lockAcquired;
    const started = Date.now();
    await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql), REFUSED);
    assert.ok(Date.now() - started < 2_300,
      "relation lock must time out before the independent blocker releases");
  } finally {
    await held;
    await blocker.end({ timeout: 5 });
  }
}));
