import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import postgres from "postgres";

import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createRecoveryCaseV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryCaseRevisionV1 } from "../../src/recovery/recovery-delivery.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createV3RecoveryClaimAuthority } from "../../src/recovery/v3-recovery-claim-authority.js";
import { PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-precreate-reservation-contract-v1.js";
import { appendPrivateDiagnosticRecoveryPrecreateReservationV1,
  PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-recovery-precreate-reservation-contract-v1.js";
import { observePrivatePendingPositiveWorktreeReservationsV1 } from
  "../../src/internal-production/baseline-positive-worktree-private-pending-reservation-census-v1.js";
import { createPrivateDiagnosticRecoveryReservedWorktreeV1 } from
  "../../src/internal-production/baseline-positive-worktree-private-recovery-reserved-create-v1.js";
import { PRIVATE_POSITIVE_WORKTREE_RECOVERY_CREATE_RECEIPT_V1_STATEMENTS } from
  "../../src/internal-production/baseline-positive-worktree-private-recovery-create-receipt-v1.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";
import { requireTask6aPrivateLoopbackHostname } from "./task6a-private-cluster-loopback.js";

const expectedDataDirectory = process.env.SETFARM_TASK6A_TEST_PG_DATA_DIRECTORY;
const REFUSED = /TASK6A_PRIVATE_RECOVERY_RESERVED_CREATE_REFUSED/;
const git = (cwd: string, ...args: string[]): string => execFileSync("git", args,
  { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim();

async function withFixture(operation: (fixture: Readonly<{ database: TestDatabase;
  repo: string; root: string; reservationHash: string; sourceSha: string;
  sourceTreeHash: string; runId: string; storyDbId: string; storyId: string;
  dispatchId: string; leaseToken: string; ownerInstanceId: string }>) => Promise<void>): Promise<void> {
  assert.equal(process.env.SETFARM_PG_URL, undefined);
  assert.match(expectedDataDirectory!, /^\/tmp\/setfarm-task6a-pg\.[A-Za-z0-9]+\/data$/);
  const adminUrl = process.env.SETFARM_TEST_PG_ADMIN_URL;
  assert.ok(adminUrl);
  const parsed = new URL(adminUrl);
  assert.equal(parsed.pathname, "/postgres");
  requireTask6aPrivateLoopbackHostname(parsed);
  assert.notEqual(parsed.port, "5432");
  const admin = postgres(adminUrl, { max: 1 });
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-task6a-create-only."));
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

    const repo = path.join(home, "repo");
    fs.mkdirSync(repo);
    git(repo, "init", "-q");
    git(repo, "config", "user.name", "Task6A Fixture");
    git(repo, "config", "user.email", "task6a-fixture@example.invalid");
    fs.writeFileSync(path.join(repo, "tracked.txt"), "pinned source\n");
    git(repo, "add", "tracked.txt");
    git(repo, "commit", "-qm", "fixture source");
    const sourceSha = git(repo, "rev-parse", "HEAD");
    const sourceTreeHash = git(repo, "rev-parse", "HEAD^{tree}");
    fs.mkdirSync(path.join(home, "reserved-worktrees"));
    const root = path.join(home, "reserved-worktrees", "reserved-story");

    database = await createIsolatedTestDatabase();
    const maximum = await database.sql<Array<{ version: number }>>`
      SELECT max(version)::integer AS version FROM public.setfarm_schema_migrations`;
    assert.equal(maximum[0]?.version, 33);
    for (const statement of PRIVATE_POSITIVE_WORKTREE_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }
    for (const statement of PRIVATE_POSITIVE_WORKTREE_RECOVERY_CREATE_RECEIPT_V1_STATEMENTS) {
      await database.sql.unsafe(statement);
    }

    const suffix = randomBytes(6).toString("hex");
    const runId = `task6a-reserved-create-${suffix}`;
    const storyDbId = `story-${suffix}`;
    const storyId = "US-001";
    const ownerInstanceId = `owner-${suffix}`;
    const releaseSha = "d".repeat(40);
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(releaseSha);
    await database.sql`INSERT INTO public.runs (
      id, run_number, workflow_id, task, status, context, protocol,
      compiler_release_sha, packet_hash, activation_preflight_hash, release_admission_hash
    ) VALUES (${runId}, 999987, 'workflow', 'private reserved create probe',
      'running', '{}', 'v3', ${releaseSha}, ${"c".repeat(64)},
      ${"e".repeat(64)}, ${releaseAdmissionHash})`;
    await database.sql`INSERT INTO public.steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects, status, type
    ) VALUES (${`step-${suffix}`}, ${runId}, 'implement', 'agent', 1, '', '', 'running', 'loop')`;
    await database.sql`INSERT INTO public.stories (id, run_id, story_index, story_id, title, status)
      VALUES (${storyDbId}, ${runId}, 1, ${storyId}, 'private reserved create', 'failed')`;
    const findingSet = createFindingSetV1({ runId, storyId,
      packetHash: "c".repeat(64), sliceHash: "d".repeat(64),
      sourceRevision: { sha: sourceSha, treeHash: sourceTreeHash },
      findings: [{ origin: "runtime", classification: "structured",
        invariantRef: "INV_RESERVED_CREATE",
        sourceLocators: [{ path: "src/App.tsx", contentHash: "e".repeat(64) }],
        observedEvidenceRefs: ["f".repeat(64)],
        expectedPredicateRef: "EVID_RESERVED_CREATE", status: "open" }] });
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
      expectedDelta: { kind: "source_change", invariantRefs: ["INV_RESERVED_CREATE"],
        requiredPaths: ["src/App.tsx"] }, allowedPaths: ["src/App.tsx"],
      evidencePlan: ["EVID_RESERVED_CREATE"], priorAttemptRefs: [],
      budget: { limits: { implement: 1, supervisorRepair: 1, evidenceOnly: 1 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 } },
      status: "open", decisionRefs: [] } as const;
    const recoveryCase = createRecoveryCaseV1(draft, { now: new Date() });
    await database.sql`INSERT INTO public.recovery_cases (
      recovery_case_id, dedupe_key, run_id, story_id, finding_set_hash, finding_ids,
      packet_hash, slice_hash, source_sha, source_tree_hash, owner, expected_delta,
      allowed_paths, evidence_plan, prior_attempt_refs, max_implement,
      max_supervisor_repair, max_evidence_only, used_implement,
      used_supervisor_repair, used_evidence_only, status, decision_refs, state_version
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
      runId, storyId, ownerInstanceId, leaseMs: 300_000,
    }, { now: new Date() });
    assert.equal(handoff.dispatchId, authorized.dispatch.dispatchId);
    const reservation = await appendPrivateDiagnosticRecoveryPrecreateReservationV1(database.sql, {
      runId, storyDbId, storyId, dispatchId: handoff.dispatchId,
      ownerInstanceId, leaseToken: handoff.lease.leaseToken,
      root, sourceSha, sourceTreeHash,
    });
    assert.equal(reservation.disposition, "inserted");
    await operation({ database, repo, root, reservationHash: reservation.reservationHash,
      sourceSha, sourceTreeHash, runId, storyDbId, storyId,
      dispatchId: handoff.dispatchId, leaseToken: handoff.lease.leaseToken,
      ownerInstanceId });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    const cleanupFailures: string[] = [];
    try { await database?.cleanup(); } catch { cleanupFailures.push("fixture_database"); }
    delete process.env.SETFARM_PG_URL;
    try { await admin.end({ timeout: 5 }); } catch { cleanupFailures.push("admin_connection"); }
    try { fs.rmSync(home, { recursive: true, force: true }); } catch { cleanupFailures.push("fixture_git"); }
    if (cleanupFailures.length > 0) {
      const cleanupError = new Error(`TASK6A_PRIVATE_RESERVED_CREATE_CLEANUP_FAILED:${cleanupFailures.join(",")}`);
      if (failure !== undefined) throw new AggregateError([failure, cleanupError], "TASK6A_PRIVATE_RESERVED_CREATE_TEST_AND_CLEANUP_FAILED");
      throw cleanupError;
    }
  }
}

test("private recovery reservation derives a pinned disposable Git create without caller root or source", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash, sourceSha, sourceTreeHash }) => {
  const before = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
  assert.deepEqual(before.counts, { ordinary: 0, recovery: 1, total: 1 });
  const receiptTable = "public.internal_production_positive_worktree_recovery_create_receipts_v1";
  assert.equal((await database.sql.unsafe(`SELECT receipt_hash FROM ${receiptTable}`)).length, 0);
  assert.equal(fs.existsSync(root), false);
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash: "a".repeat(64), repo,
  }), REFUSED);
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo, root,
  }), REFUSED, "caller root overrides must refuse before physical creation");
  assert.equal(fs.existsSync(root), false);
  const created = await createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  });
  assert.equal(created.authority, "diagnostic-only");
  assert.equal(created.disposition, "created");
  assert.equal(created.reservationHash, reservationHash);
  assert.equal(JSON.stringify(created).includes("leaseToken"), false);
  assert.equal(git(root, "rev-parse", "HEAD"), sourceSha);
  assert.equal(git(root, "rev-parse", "HEAD^{tree}"), sourceTreeHash);
  assert.equal(git(root, "branch", "--show-current"), "");
  const receipts = await database.sql.unsafe<Array<{ receiptHash: string; canonicalBody: string;
    reservationHash: string; root: string; sourceSha: string; sourceTreeHash: string;
    gitPrimaryRoot: string; physicalDev: string; physicalIno: string;
    physicalBirthtimeNs: string; physicalIdentityHash: string }>>(`SELECT
      receipt_hash AS "receiptHash", canonical_body AS "canonicalBody",
      reservation_hash AS "reservationHash", root,
      source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
      git_primary_root AS "gitPrimaryRoot", physical_dev AS "physicalDev",
      physical_ino AS "physicalIno", physical_birthtime_ns AS "physicalBirthtimeNs",
      physical_identity_hash AS "physicalIdentityHash"
      FROM ${receiptTable}`);
  assert.equal(receipts.length, 1, "one durable create receipt is committed before return");
  const receipt = receipts[0]!;
  assert.equal(created.receiptHash, receipt.receiptHash);
  const stat = fs.lstatSync(root, { bigint: true });
  const physical = { root, dev: String(stat.dev), ino: String(stat.ino),
    birthtimeNs: String(stat.birthtimeNs), gitPrimaryRoot: repo };
  assert.equal(receipt.reservationHash, reservationHash);
  assert.equal(receipt.root, root);
  assert.equal(receipt.sourceSha, sourceSha);
  assert.equal(receipt.sourceTreeHash, sourceTreeHash);
  assert.equal(receipt.gitPrimaryRoot, repo);
  assert.deepEqual([receipt.physicalDev, receipt.physicalIno, receipt.physicalBirthtimeNs],
    [physical.dev, physical.ino, physical.birthtimeNs]);
  assert.equal(receipt.physicalIdentityHash, hashCanonicalJson({
    schema: "setfarm.internal-production-positive-worktree-identity.v2", ...physical }));
  const body = JSON.parse(receipt.canonicalBody) as Record<string, unknown>;
  assert.equal(canonicalJsonStringify(body), receipt.canonicalBody);
  assert.equal(hashCanonicalJson(body), receipt.receiptHash);
  assert.deepEqual(body.physical, physical);
  assert.equal(body.physicalIdentityHash, receipt.physicalIdentityHash);
  await assert.rejects(database.sql.unsafe(`UPDATE ${receiptTable}
    SET physical_ino = '1' WHERE receipt_hash = $1`, [receipt.receiptHash]),
  /TASK6A_PRIVATE_RECOVERY_CREATE_RECEIPT_IMMUTABLE/);
  await assert.rejects(database.sql.unsafe(`DELETE FROM ${receiptTable}
    WHERE receipt_hash = $1`, [receipt.receiptHash]),
  /TASK6A_PRIVATE_RECOVERY_CREATE_RECEIPT_IMMUTABLE/);
  await assert.rejects(database.sql.unsafe(`TRUNCATE ${receiptTable}`),
  /TASK6A_PRIVATE_RECOVERY_CREATE_RECEIPT_IMMUTABLE/);
  const inode = fs.lstatSync(root).ino;
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  }), REFUSED, "a second call cannot adopt the already-created physical root");
  assert.equal(fs.lstatSync(root).ino, inode);
  const after = await observePrivatePendingPositiveWorktreeReservationsV1(database.sql);
  assert.deepEqual(after, before,
    "physical creation alone cannot settle a pending reservation or grant an owner");
}));

for (const scenario of ["expired", "rotated", "active-claim", "execution-slice-residue",
  "started-at-residue", "case-owner-residue", "case-status-drift", "case-dedupe-drift",
  "case-opening-finding-drift",
  "finding-payload-drift", "step-type-drift", "step-status-drift", "duplicate-implement-step",
  "duplicate-failed-story", "unreleased-runtime", "authorization-time-residue",
  "revision-identity-drift", "dispatch-identity-drift",
  "occupied", "wrong-repo"] as const) {
  test(`private recovery reserved create refuses ${scenario} before Git mutation`, {
    skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
  }, async () => withFixture(async ({ database, repo, root, reservationHash,
    dispatchId, runId, storyId }) => {
    if (scenario === "expired") {
      await database.sql`UPDATE public.recovery_dispatch_deliveries
        SET lease_expires_at = NOW() - INTERVAL '1 second'
        WHERE dispatch_id = ${dispatchId}`;
    }
    if (scenario === "rotated") {
      await database.sql`UPDATE public.recovery_dispatch_deliveries
        SET lease_token = ${randomBytes(32).toString("hex")},
          lease_expires_at = NOW() + INTERVAL '5 minutes'
        WHERE dispatch_id = ${dispatchId}`;
    }
    if (scenario === "active-claim") {
      await database.sql`INSERT INTO public.claim_log (
        id, run_id, step_id, story_id, agent_id
      ) VALUES (999987, ${runId}, 'implement', ${storyId}, 'agent')`;
    }
    if (scenario === "execution-slice-residue") {
      await database.sql`UPDATE public.recovery_dispatch_deliveries
        SET execution_slice_hash = ${"a".repeat(64)}
        WHERE dispatch_id = ${dispatchId}`;
    }
    if (scenario === "started-at-residue") {
      await database.sql`UPDATE public.recovery_dispatch_deliveries
        SET started_at = NOW() WHERE dispatch_id = ${dispatchId}`;
    }
    if (scenario === "case-owner-residue") {
      await database.sql`UPDATE public.recovery_cases SET owner = 'supervisor'
        WHERE recovery_case_id = (SELECT recovery_case_id
          FROM public.recovery_dispatch_deliveries WHERE dispatch_id = ${dispatchId})`;
    }
    if (scenario === "case-status-drift") {
      await database.sql`UPDATE public.recovery_cases SET status = 'evidencing'
        WHERE recovery_case_id = (SELECT recovery_case_id
          FROM public.recovery_dispatch_deliveries WHERE dispatch_id = ${dispatchId})`;
    }
    if (scenario === "case-dedupe-drift") {
      await database.sql`UPDATE public.recovery_cases SET dedupe_key = ${"f".repeat(64)}
        WHERE recovery_case_id = (SELECT recovery_case_id
          FROM public.recovery_dispatch_deliveries WHERE dispatch_id = ${dispatchId})`;
    }
    if (scenario === "case-opening-finding-drift") {
      await database.sql`UPDATE public.recovery_cases SET finding_ids = '[]'::jsonb
        WHERE recovery_case_id = (SELECT recovery_case_id
          FROM public.recovery_dispatch_deliveries WHERE dispatch_id = ${dispatchId})`;
    }
    if (scenario === "finding-payload-drift") {
      await database.sql`ALTER TABLE public.finding_sets DISABLE TRIGGER trg_finding_sets_immutable`;
      await database.sql`UPDATE public.finding_sets SET payload = jsonb_set(payload,
        '{findings}', '[]'::jsonb)
        WHERE finding_set_hash = (SELECT finding_set_hash
          FROM public.recovery_revision_dispatches WHERE dispatch_id = ${dispatchId})`;
      await database.sql`ALTER TABLE public.finding_sets ENABLE TRIGGER trg_finding_sets_immutable`;
    }
    if (scenario === "step-type-drift") {
      await database.sql`UPDATE public.steps SET type = 'single'
        WHERE run_id = ${runId} AND step_id = 'implement'`;
    }
    if (scenario === "step-status-drift") {
      await database.sql`UPDATE public.steps SET status = 'completed'
        WHERE run_id = ${runId} AND step_id = 'implement'`;
    }
    if (scenario === "duplicate-implement-step") {
      await database.sql`INSERT INTO public.steps (
        id, run_id, step_id, agent_id, step_index, input_template, expects, status, type
      ) VALUES ('duplicate-implement-step', ${runId}, 'implement', 'agent', 2,
        '', '', 'running', 'loop')`;
    }
    if (scenario === "duplicate-failed-story") {
      await database.sql`INSERT INTO public.stories (
        id, run_id, story_index, story_id, title, status
      ) VALUES ('duplicate-failed-story', ${runId}, 2, ${storyId},
        'duplicate failed story', 'failed')`;
    }
    if (scenario === "unreleased-runtime") {
      await database.sql`INSERT INTO public.claim_log (
        id, run_id, step_id, story_id, agent_id, outcome
      ) VALUES (999988, ${runId}, 'implement', ${storyId}, 'agent', 'failed')`;
      await database.sql`INSERT INTO public.runtime_sessions (
        session_id, run_id, step_db_id, workflow_step_id, story_db_id, story_id,
        claim_id, claim_agent_id, runtime_agent_id, runtime_kind, state,
        owner_instance_id, heartbeat_at, drained_at
      ) VALUES ('unreleased-runtime', ${runId},
        (SELECT id FROM public.steps WHERE run_id = ${runId} AND step_id = 'implement'),
        'implement', (SELECT id FROM public.stories
          WHERE run_id = ${runId} AND story_id = ${storyId}), ${storyId},
        999988, 'agent', 'agent', 'external_session', 'drained', 'old-owner', NOW(), NOW())`;
    }
    if (scenario === "revision-identity-drift") {
      await database.sql`ALTER TABLE public.recovery_case_revisions
        DISABLE TRIGGER trg_recovery_case_revisions_immutable`;
      await database.sql`UPDATE public.recovery_case_revisions
        SET revision_identity_key = ${"a".repeat(64)}
        WHERE revision_id = (SELECT revision_id
          FROM public.recovery_revision_dispatches WHERE dispatch_id = ${dispatchId})`;
      await database.sql`ALTER TABLE public.recovery_case_revisions
        ENABLE TRIGGER trg_recovery_case_revisions_immutable`;
    }
    if (scenario === "dispatch-identity-drift") {
      await database.sql`ALTER TABLE public.recovery_revision_dispatches
        DISABLE TRIGGER trg_recovery_revision_dispatches_immutable`;
      await database.sql`UPDATE public.recovery_revision_dispatches
        SET dispatch_dedupe_key = ${"b".repeat(64)}
        WHERE dispatch_id = ${dispatchId}`;
      await database.sql`ALTER TABLE public.recovery_revision_dispatches
        ENABLE TRIGGER trg_recovery_revision_dispatches_immutable`;
    }
    if (scenario === "authorization-time-residue") {
      await database.sql`UPDATE public.recovery_dispatch_deliveries
        SET authorized_at = authorized_at + INTERVAL '1 second'
        WHERE dispatch_id = ${dispatchId}`;
    }
    if (scenario === "occupied") fs.symlinkSync(path.join(path.dirname(root), "missing"), root);
    const selectedRepo = scenario === "wrong-repo" ? path.dirname(repo) : repo;
    const inode = scenario === "occupied" ? fs.lstatSync(root).ino : undefined;
    await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
      reservationHash, repo: selectedRepo,
    }), REFUSED);
    if (scenario === "occupied") assert.equal(fs.lstatSync(root).ino, inode);
    else assert.equal(fs.existsSync(root), false);
    assert.deepEqual((await observePrivatePendingPositiveWorktreeReservationsV1(database.sql)).counts,
      { ordinary: 0, recovery: 1, total: 1 });
    assert.equal((await database.sql.unsafe(`SELECT receipt_hash FROM
      public.internal_production_positive_worktree_recovery_create_receipts_v1`)).length, 0);
  }));
}

test("private reserved create refuses a hash-valid recovery body crossed with its SQL columns", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash, sourceSha,
  sourceTreeHash, runId, storyDbId, storyId, dispatchId, ownerInstanceId }) => {
  const rows = await database.sql.unsafe<Array<{ recoveryCaseId: string;
    revisionId: string; leaseTokenHash: string }>>(`SELECT
      recovery_case_id AS "recoveryCaseId", revision_id AS "revisionId",
      lease_token_hash AS "leaseTokenHash"
      FROM public.internal_production_positive_worktree_recovery_precreate_reservations_v1
      WHERE reservation_hash = $1`, [reservationHash]);
  assert.equal(rows.length, 1);
  const body = { schema: "setfarm.internal-production-positive-worktree-private-recovery-precreate-reservation.v1",
    runId, storyDbId, storyId, dispatchId, recoveryCaseId: rows[0]!.recoveryCaseId,
    revisionId: rows[0]!.revisionId, ownerInstanceId,
    root: `${root}-forged`, sourceSha, sourceTreeHash,
    leaseTokenHash: rows[0]!.leaseTokenHash };
  const forgedHash = hashCanonicalJson(body);
  const table = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";
  await database.sql.unsafe(`ALTER TABLE ${table}
    DISABLE TRIGGER task6a_private_recovery_precreate_no_replace_v1`);
  await database.sql.unsafe(`UPDATE ${table} SET reservation_hash = $1,
    canonical_body = $2 WHERE reservation_hash = $3`,
  [forgedHash, canonicalJsonStringify(body), reservationHash]);
  await database.sql.unsafe(`ALTER TABLE ${table}
    ENABLE TRIGGER task6a_private_recovery_precreate_no_replace_v1`);
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash: forgedHash, repo,
  }), REFUSED);
  assert.equal(fs.existsSync(root), false);
  await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql));
}));

test("private reserved create refuses a direct-SQL ordinary root competitor", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash, sourceSha,
  sourceTreeHash, runId, storyDbId, storyId, ownerInstanceId }) => {
  const body = { schema: "setfarm.internal-production-positive-worktree-private-precreate-reservation.v1",
    runId, storyDbId, storyId, dispatchKey: "direct-sql-competitor",
    ownerInstanceId, root, sourceSha, sourceTreeHash };
  await database.sql`INSERT INTO public.internal_production_positive_worktree_precreate_reservations_v1 (
    reservation_hash, run_id, story_db_id, story_id, dispatch_key,
    owner_instance_id, root, source_sha, source_tree_hash, canonical_body
  ) VALUES (${hashCanonicalJson(body)}, ${runId}, ${storyDbId}, ${storyId},
    ${body.dispatchKey}, ${ownerInstanceId}, ${root}, ${sourceSha},
    ${sourceTreeHash}, ${canonicalJsonStringify(body)})`;
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  }), REFUSED);
  assert.equal(fs.existsSync(root), false);
  await assert.rejects(observePrivatePendingPositiveWorktreeReservationsV1(database.sql));
}));

test("a lease expiring during Git add leaves a visible pending one-shot root", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash, dispatchId }) => {
  const gitExecutable = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  assert.match(gitExecutable, /^\/[A-Za-z0-9/_-]+\/git$/);
  const wrapperHome = path.dirname(repo);
  const wrapper = path.join(wrapperHome, "git");
  fs.writeFileSync(wrapper, `#!/bin/sh\ncase " $* " in *" worktree add "*) /bin/sleep 7;; esac\nexec '${gitExecutable}' "$@"\n`);
  fs.chmodSync(wrapper, 0o700);
  await database.sql`UPDATE public.recovery_dispatch_deliveries
    SET lease_expires_at = NOW() + INTERVAL '5 seconds'
    WHERE dispatch_id = ${dispatchId}`;
  const previousPath = process.env.PATH;
  try {
    process.env.PATH = `${wrapperHome}:${previousPath ?? "/usr/bin:/bin"}`;
    await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
      reservationHash, repo,
    }), REFUSED);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
  }
  assert.equal(fs.lstatSync(root).isDirectory(), true,
    "an external Git add is not rolled back by the expired lease");
  assert.ok(git(repo, "worktree", "list", "--porcelain").includes(root));
  const inode = fs.lstatSync(root).ino;
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  }), REFUSED);
  assert.equal(fs.lstatSync(root).ino, inode);
  assert.deepEqual((await observePrivatePendingPositiveWorktreeReservationsV1(database.sql)).counts,
    { ordinary: 0, recovery: 1, total: 1 });
  assert.equal((await database.sql.unsafe(`SELECT receipt_hash FROM
    public.internal_production_positive_worktree_recovery_create_receipts_v1`)).length, 0);
}));

test("receipt insert failure after Git add leaves the root visible but no durable create claim", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash }) => {
  const table = "public.internal_production_positive_worktree_recovery_create_receipts_v1";
  await database.sql.unsafe(`CREATE FUNCTION public.task6a_test_reject_create_receipt_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_TEST_RECEIPT_INSERT_FAILURE';
    END $$`);
  await database.sql.unsafe(`CREATE TRIGGER task6a_test_reject_create_receipt_v1
    BEFORE INSERT ON ${table} FOR EACH ROW
    EXECUTE FUNCTION public.task6a_test_reject_create_receipt_v1()`);
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  }), REFUSED);
  assert.equal(fs.lstatSync(root).isDirectory(), true);
  assert.ok(git(repo, "worktree", "list", "--porcelain").includes(root));
  assert.equal((await database.sql.unsafe(`SELECT receipt_hash FROM ${table}`)).length, 0);
  assert.deepEqual((await observePrivatePendingPositiveWorktreeReservationsV1(database.sql)).counts,
    { ordinary: 0, recovery: 1, total: 1 });
  const inode = fs.lstatSync(root).ino;
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  }), REFUSED);
  assert.equal(fs.lstatSync(root).ino, inode);
  assert.equal((await database.sql.unsafe(`SELECT receipt_hash FROM ${table}`)).length, 0);
}));

test("a root replaced after Git add cannot receive the created inode's receipt", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash }) => {
  const original = `${root}-original`;
  let replaced = false;
  const intercepted = new Proxy(database.sql as any, {
    get(target, property) {
      if (property === "begin") return (mode: string, callback: (tx: any) => Promise<unknown>) =>
        target.begin(mode, (tx: any) => callback(new Proxy(tx, {
          get(transaction, key) {
            if (key !== "unsafe") return Reflect.get(transaction, key);
            return (query: string, parameters?: unknown[]) => {
              if (!replaced && fs.existsSync(root)
                && query.includes("FROM public.recovery_dispatch_deliveries")) {
                fs.renameSync(root, original);
                fs.mkdirSync(root);
                replaced = true;
              }
              return transaction.unsafe(query, parameters);
            };
          },
        })));
      return Reflect.get(target, property);
    },
  }) as postgres.Sql;
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(intercepted, {
    reservationHash, repo,
  }), REFUSED);
  assert.equal(replaced, true, "interception must occur after the Git add");
  assert.equal(fs.lstatSync(original).isDirectory(), true);
  assert.equal(fs.lstatSync(root).isDirectory(), true);
  assert.notEqual(fs.lstatSync(original).ino, fs.lstatSync(root).ino);
  assert.equal((await database.sql.unsafe(`SELECT receipt_hash FROM
    public.internal_production_positive_worktree_recovery_create_receipts_v1`)).length, 0);
  assert.deepEqual((await observePrivatePendingPositiveWorktreeReservationsV1(database.sql)).counts,
    { ordinary: 0, recovery: 1, total: 1 });
}));

test("missing private create-receipt table refuses before Git add", {
  skip: expectedDataDirectory ? false : "requires an explicitly identified private PostgreSQL 17 cluster",
}, async () => withFixture(async ({ database, repo, root, reservationHash }) => {
  await database.sql.unsafe(`DROP TABLE
    public.internal_production_positive_worktree_recovery_create_receipts_v1`);
  await assert.rejects(createPrivateDiagnosticRecoveryReservedWorktreeV1(database.sql, {
    reservationHash, repo,
  }), REFUSED);
  assert.equal(fs.existsSync(root), false);
  assert.equal(git(repo, "worktree", "list", "--porcelain").includes(root), false);
}));
