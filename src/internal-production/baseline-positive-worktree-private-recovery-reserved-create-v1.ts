import path from "node:path";
import { types } from "node:util";
import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { FindingSetV1Schema } from "../findings/finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { RecoveryCaseV1Schema } from "../recovery/recovery-case.js";
import { RecoveryCaseRevisionV1Schema, RecoveryRevisionDispatchV1Schema } from
  "../recovery/recovery-delivery.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from
  "../recovery/v3-recovery-run-mutation-authority.js";
import { createPrivateDiagnosticPinnedWorktreeV1 } from
  "./baseline-positive-worktree-create-only-fixture-v1.js";

// One-shot, disposable-Git diagnostic. A database rollback cannot undo Git;
// any partial root stays visible and its immutable reservation stays pending.
// Direct SQL parents are not producer proof. This neither fences old OS/DB
// writers nor publishes a receipt, settles a reservation, or grants an owner.
const SCHEMA = "setfarm.internal-production-positive-worktree-private-recovery-reserved-create.v1";
const RESERVATION_SCHEMA = "setfarm.internal-production-positive-worktree-private-recovery-precreate-reservation.v1";
const TOKEN_SCHEMA = "setfarm.internal-production-positive-worktree-recovery-lease-token-commitment.v1";
const RECOVERY = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";
const ORDINARY = "public.internal_production_positive_worktree_precreate_reservations_v1";
const REFUSED = "TASK6A_PRIVATE_RECOVERY_RESERVED_CREATE_REFUSED";
const fail = (): never => { throw new Error(REFUSED); };

type Reservation = Readonly<{ reservationHash: string; runId: string;
  storyDbId: string; storyId: string; dispatchId: string;
  recoveryCaseId: string; revisionId: string; ownerInstanceId: string;
  root: string; sourceSha: string; sourceTreeHash: string;
  leaseTokenHash: string; canonicalBody: string }>;
type Delivery = Readonly<{ recoveryCaseId: string; revisionId: string;
  runId: string; storyId: string; state: string;
  ownerInstanceId: string | null; leaseToken: string | null;
  leaseExpiresAt: Date | null; attemptId: string | null;
  claimId: string | null; executionSliceHash: string | null;
  attemptCount: number; startedAt: Date | null; authorizedAt: Date }>;

function input(value: unknown): Readonly<{ reservationHash: string; repo: string }> {
  if (value === null || typeof value !== "object" || types.isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || !keys.includes("reservationHash") || !keys.includes("repo")) fail();
  const field = (key: "reservationHash" | "repo"): string => {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)
      || typeof descriptor.value !== "string") fail();
    return descriptor.value;
  };
  const reservationHash = field("reservationHash"), repo = field("repo");
  if (!/^[a-f0-9]{64}$/.test(reservationHash)
    || !path.isAbsolute(repo) || path.normalize(repo) !== repo
    || repo.endsWith(path.sep) || repo.includes("\0")) fail();
  return Object.freeze({ reservationHash, repo });
}

function bounded(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max
    || value.trim() !== value || value.includes("\0")) return fail();
  return value;
}

function timestamp(value: unknown): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return fail();
  return value.toISOString();
}

function validateReservation(row: Reservation, requestedHash: string): void {
  if (row.reservationHash !== requestedHash
    || !/^RDISP_[a-f0-9]{64}$/.test(row.dispatchId)
    || !/^RCV_[a-f0-9]{64}$/.test(row.recoveryCaseId)
    || !/^RREV_[a-f0-9]{64}$/.test(row.revisionId)
    || !/^[a-f0-9]{64}$/.test(row.leaseTokenHash)) fail();
  for (const value of [row.runId, row.storyDbId, row.storyId, row.ownerInstanceId]) {
    bounded(value, 256);
  }
  const root = bounded(row.root, 1024);
  if (!path.isAbsolute(root) || root === path.parse(root).root
    || path.normalize(root) !== root || root.endsWith(path.sep)) fail();
  if (!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(row.sourceSha)
    || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(row.sourceTreeHash)
    || row.sourceSha.length !== row.sourceTreeHash.length) fail();
  const body = { schema: RESERVATION_SCHEMA, runId: row.runId,
    storyDbId: row.storyDbId, storyId: row.storyId,
    dispatchId: row.dispatchId, recoveryCaseId: row.recoveryCaseId,
    revisionId: row.revisionId, ownerInstanceId: row.ownerInstanceId,
    root, sourceSha: row.sourceSha, sourceTreeHash: row.sourceTreeHash,
    leaseTokenHash: row.leaseTokenHash };
  if (canonicalJsonStringify(body) !== row.canonicalBody
    || hashCanonicalJson(body) !== row.reservationHash) fail();
}

function validateDelivery(delivery: Delivery | undefined, row: Reservation,
  now: Date): void {
  if (!delivery || delivery.runId !== row.runId || delivery.storyId !== row.storyId
    || delivery.recoveryCaseId !== row.recoveryCaseId
    || delivery.revisionId !== row.revisionId
    || delivery.state !== "leased" || delivery.ownerInstanceId !== row.ownerInstanceId
    || typeof delivery.leaseToken !== "string" || delivery.leaseToken.length < 16
    || delivery.attemptId !== null || delivery.claimId !== null
    || delivery.executionSliceHash !== null || delivery.attemptCount !== 0
    || delivery.startedAt !== null
    || !(delivery.leaseExpiresAt instanceof Date)
    || !Number.isFinite(delivery.leaseExpiresAt.getTime())
    || delivery.leaseExpiresAt.getTime() <= now.getTime()
    || hashCanonicalJson({ schema: TOKEN_SCHEMA, dispatchId: row.dispatchId,
      leaseToken: delivery.leaseToken }) !== row.leaseTokenHash) fail();
}

export async function createPrivateDiagnosticRecoveryReservedWorktreeV1(
  sql: postgres.Sql, rawInput: unknown,
): Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "created"; reservationHash: string }>> {
  try {
    const fixed = input(rawInput);
    return await sql.begin("isolation level serializable", async (tx) => {
      await tx.unsafe("SET LOCAL statement_timeout = '5s'");
      await tx.unsafe("SET LOCAL lock_timeout = '1s'");
      await tx.unsafe("SET LOCAL idle_in_transaction_session_timeout = '60s'");
      const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`SELECT
        pg_catalog.current_setting('transaction_isolation') AS isolation,
        pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
      if (mode.length !== 1 || mode[0]?.isolation !== "serializable"
        || mode[0]?.readOnly !== "off") fail();
      const identity = await tx.unsafe<Array<{ runId: string; storyId: string }>>(`SELECT
        run_id AS "runId", story_id AS "storyId" FROM ${RECOVERY}
        WHERE reservation_hash = $1`, [fixed.reservationHash]);
      if (identity.length !== 1) fail();
      const runId = bounded(identity[0]?.runId, 256);
      const storyId = bounded(identity[0]?.storyId, 256);
      const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(tx,
        { runId, storyId });
      if (authority.protocol !== "v3") fail();
      const reservations = await tx.unsafe<Array<Reservation>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_id AS "dispatchId", recovery_case_id AS "recoveryCaseId",
        revision_id AS "revisionId", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        lease_token_hash AS "leaseTokenHash", canonical_body AS "canonicalBody"
        FROM ${RECOVERY} WHERE reservation_hash = $1 FOR KEY SHARE`,
      [fixed.reservationHash]);
      if (reservations.length !== 1) fail();
      const row = reservations[0]!;
      validateReservation(row, fixed.reservationHash);
      if (row.runId !== runId || row.storyId !== storyId) fail();
      const deliveries = await tx.unsafe<Array<Delivery>>(`SELECT
        recovery_case_id AS "recoveryCaseId", revision_id AS "revisionId",
        run_id AS "runId", story_id AS "storyId", state,
        owner_instance_id AS "ownerInstanceId", lease_token AS "leaseToken",
        lease_expires_at AS "leaseExpiresAt", attempt_id AS "attemptId",
        claim_id::text AS "claimId", execution_slice_hash AS "executionSliceHash",
        attempt_count AS "attemptCount", started_at AS "startedAt",
        authorized_at AS "authorizedAt"
        FROM public.recovery_dispatch_deliveries
        WHERE dispatch_id = $1 FOR UPDATE`, [row.dispatchId]);
      if (deliveries.length !== 1) fail();
      const delivery = deliveries[0]!;
      const cases = await tx.unsafe<Array<Record<string, unknown>>>(`SELECT *
        FROM public.recovery_cases WHERE recovery_case_id = $1
          AND run_id = $2 AND story_id = $3 FOR UPDATE`,
      [row.recoveryCaseId, row.runId, row.storyId]);
      if (cases.length !== 1 || cases[0]?.current_revision_id !== row.revisionId
        || cases[0].status !== "repairing") fail();
      const caseRow = cases[0]!;
      const parsedCase = RecoveryCaseV1Schema.safeParse({
        schema: "setfarm.recovery-case.v1",
        recoveryCaseId: caseRow.recovery_case_id,
        dedupeKey: caseRow.dedupe_key,
        runId: caseRow.run_id, storyId: caseRow.story_id,
        findingSetHash: caseRow.finding_set_hash,
        findingIds: caseRow.finding_ids,
        packetHash: caseRow.packet_hash,
        sliceHash: caseRow.slice_hash,
        sourceRevision: { sha: caseRow.source_sha, treeHash: caseRow.source_tree_hash },
        owner: caseRow.owner,
        expectedDelta: caseRow.expected_delta,
        allowedPaths: caseRow.allowed_paths,
        evidencePlan: caseRow.evidence_plan,
        priorAttemptRefs: caseRow.prior_attempt_refs,
        budget: { limits: { implement: caseRow.max_implement,
          supervisorRepair: caseRow.max_supervisor_repair,
          evidenceOnly: caseRow.max_evidence_only },
        used: { implement: caseRow.used_implement,
          supervisorRepair: caseRow.used_supervisor_repair,
          evidenceOnly: caseRow.used_evidence_only } },
        status: caseRow.status,
        ...(caseRow.terminal !== null ? { terminal: caseRow.terminal } : {}),
        decisionRefs: caseRow.decision_refs,
        stateVersion: caseRow.state_version,
        createdAt: timestamp(caseRow.created_at),
        updatedAt: timestamp(caseRow.updated_at),
      });
      if (!parsedCase.success) fail();
      const revisions = await tx.unsafe<Array<Record<string, unknown>>>(`SELECT *
        FROM public.recovery_case_revisions WHERE revision_id = $1
          AND recovery_case_id = $2 AND run_id = $3 AND story_id = $4 FOR KEY SHARE`,
      [row.revisionId, row.recoveryCaseId, row.runId, row.storyId]);
      if (revisions.length !== 1 || revisions[0]?.source_sha !== row.sourceSha
        || revisions[0]?.source_tree_hash !== row.sourceTreeHash) fail();
      const revisionRow = revisions[0]!;
      const parsedRevision = RecoveryCaseRevisionV1Schema.safeParse({
        schema: "setfarm.recovery-case-revision.v1",
        revisionId: revisionRow.revision_id,
        revisionIdentityKey: revisionRow.revision_identity_key,
        recoveryCaseId: revisionRow.recovery_case_id,
        revisionNumber: revisionRow.revision_number,
        ...(revisionRow.parent_revision_id !== null
          ? { parentRevisionId: revisionRow.parent_revision_id } : {}),
        runId: revisionRow.run_id, storyId: revisionRow.story_id,
        findingSetHash: revisionRow.finding_set_hash,
        findingIds: revisionRow.finding_ids,
        packetHash: revisionRow.packet_hash,
        contractSliceHash: revisionRow.contract_slice_hash,
        sourceRevision: { sha: revisionRow.source_sha, treeHash: revisionRow.source_tree_hash },
        owner: revisionRow.owner,
        expectedDelta: revisionRow.expected_delta,
        allowedPaths: revisionRow.allowed_paths,
        evidencePlan: revisionRow.evidence_plan,
        ...(revisionRow.evidence_plan_artifact_hash !== null
          ? { evidencePlanArtifactHash: revisionRow.evidence_plan_artifact_hash } : {}),
        createdAt: timestamp(revisionRow.created_at),
      });
      if (!parsedRevision.success) fail();
      const revision = parsedRevision.data;
      if (!revision) return fail();
      const dispatches = await tx.unsafe<Array<Record<string, unknown>>>(`SELECT *
        FROM public.recovery_revision_dispatches WHERE dispatch_id = $1
          AND revision_id = $2 AND recovery_case_id = $3 FOR KEY SHARE`,
      [row.dispatchId, row.revisionId, row.recoveryCaseId]);
      if (dispatches.length !== 1 || dispatches[0]?.source_sha !== row.sourceSha
        || dispatches[0]?.source_tree_hash !== row.sourceTreeHash
        || !["product_implementation", "supervisor_repair"].includes(
          String(dispatches[0]?.dispatch_class))) fail();
      const dispatchRow = dispatches[0]!;
      const parsedDispatch = RecoveryRevisionDispatchV1Schema.safeParse({
        schema: "setfarm.recovery-revision-dispatch.v1",
        dispatchId: dispatchRow.dispatch_id,
        recoveryCaseId: dispatchRow.recovery_case_id,
        revisionId: dispatchRow.revision_id,
        dispatchClass: dispatchRow.dispatch_class,
        dispatchDedupeKey: dispatchRow.dispatch_dedupe_key,
        runId: revision.runId, storyId: revision.storyId,
        sourceRevision: { sha: dispatchRow.source_sha, treeHash: dispatchRow.source_tree_hash },
        packetHash: dispatchRow.packet_hash,
        contractSliceHash: dispatchRow.contract_slice_hash,
        findingSetHash: dispatchRow.finding_set_hash,
        findingIds: dispatchRow.finding_ids,
        evidencePlan: dispatchRow.evidence_plan,
        ...(dispatchRow.evidence_plan_artifact_hash !== null
          ? { evidencePlanArtifactHash: dispatchRow.evidence_plan_artifact_hash } : {}),
        authorizedAt: timestamp(dispatchRow.authorized_at),
      });
      if (!parsedDispatch.success) fail();
      // The immutable reservation records a past lease. A physical add also
      // requires the present full directive chain, not merely a matching SHA.
      const exactChain = await tx.unsafe<Array<{ findingSetHash: string;
        findingIds: string[]; packetHash: string; sliceHash: string;
        sourceSha: string; sourceTreeHash: string; findingPayload: unknown }>>(`SELECT
        r.finding_set_hash AS "findingSetHash", r.finding_ids AS "findingIds",
        r.packet_hash AS "packetHash", r.contract_slice_hash AS "sliceHash",
        r.source_sha AS "sourceSha", r.source_tree_hash AS "sourceTreeHash",
        f.payload AS "findingPayload"
        FROM public.recovery_cases c
        JOIN public.recovery_case_revisions r
          ON r.revision_id = c.current_revision_id
          AND r.recovery_case_id = c.recovery_case_id
        JOIN public.recovery_revision_dispatches d
          ON d.revision_id = r.revision_id AND d.recovery_case_id = c.recovery_case_id
        JOIN public.recovery_dispatch_deliveries v ON v.dispatch_id = d.dispatch_id
        JOIN public.finding_sets f ON f.finding_set_hash = r.finding_set_hash
        JOIN public.runs run ON run.id = r.run_id
        WHERE d.dispatch_id = $1 AND c.recovery_case_id = $2
          AND c.run_id = $3 AND c.story_id = $4
          AND r.run_id = c.run_id AND r.story_id = c.story_id
          AND c.owner = r.owner AND c.packet_hash = r.packet_hash
          AND c.expected_delta = r.expected_delta
          AND c.allowed_paths = r.allowed_paths
          AND c.evidence_plan = r.evidence_plan
          AND EXISTS (SELECT 1 FROM public.recovery_case_revisions opening
            WHERE opening.recovery_case_id = c.recovery_case_id
              AND opening.revision_number = 1
              AND opening.parent_revision_id IS NULL
              AND opening.run_id = c.run_id AND opening.story_id = c.story_id
              AND opening.finding_set_hash = c.finding_set_hash
              AND opening.finding_ids = c.finding_ids
              AND opening.packet_hash = c.packet_hash
              AND opening.contract_slice_hash = c.slice_hash
              AND opening.source_sha = c.source_sha
              AND opening.source_tree_hash = c.source_tree_hash)
          AND d.source_sha = r.source_sha AND d.source_tree_hash = r.source_tree_hash
          AND d.packet_hash = r.packet_hash
          AND d.contract_slice_hash = r.contract_slice_hash
          AND d.finding_set_hash = r.finding_set_hash
          AND d.finding_ids = r.finding_ids
          AND d.evidence_plan = r.evidence_plan
          AND d.evidence_plan_artifact_hash IS NOT DISTINCT FROM r.evidence_plan_artifact_hash
          AND ((d.dispatch_class = 'product_implementation' AND r.owner = 'implement')
            OR (d.dispatch_class = 'supervisor_repair' AND r.owner = 'supervisor'))
          AND v.recovery_case_id = c.recovery_case_id
          AND v.revision_id = r.revision_id
          AND v.run_id = r.run_id AND v.story_id = r.story_id
          AND v.authorized_at = d.authorized_at
          AND f.run_id = r.run_id AND f.story_id = r.story_id
          AND f.packet_hash = r.packet_hash
          AND f.slice_hash = r.contract_slice_hash
          AND f.source_sha = r.source_sha AND f.source_tree_hash = r.source_tree_hash
          AND f.finding_ids = r.finding_ids
          AND run.packet_hash = r.packet_hash`,
      [row.dispatchId, row.recoveryCaseId, row.runId, row.storyId]);
      if (exactChain.length !== 1) fail();
      const chain = exactChain[0]!;
      const parsedFinding = FindingSetV1Schema.safeParse(chain.findingPayload);
      if (!parsedFinding.success) fail();
      const finding = parsedFinding.data;
      if (!finding) return fail();
      if (finding.findingSetHash !== chain.findingSetHash
        || finding.runId !== row.runId || finding.storyId !== row.storyId
        || finding.packetHash !== chain.packetHash
        || finding.sliceHash !== chain.sliceHash
        || finding.sourceRevision.sha !== chain.sourceSha
        || finding.sourceRevision.treeHash !== chain.sourceTreeHash
        || canonicalJsonStringify(finding.findings.map((item) => item.findingId))
          !== canonicalJsonStringify(chain.findingIds)) fail();
      const stories = await tx.unsafe<Array<{ id: string }>>(`SELECT id FROM public.stories
        WHERE run_id = $1 AND story_id = $2 AND status = 'failed'
        ORDER BY id LIMIT 2 FOR UPDATE`, [row.runId, row.storyId]);
      if (stories.length !== 1 || stories[0]?.id !== row.storyDbId) fail();
      const steps = await tx.unsafe(`SELECT id FROM public.steps
        WHERE run_id = $1 AND step_id = 'implement' AND type = 'loop'
          AND status IN ('pending', 'running')
        ORDER BY id LIMIT 2 FOR UPDATE`, [row.runId]);
      if (steps.length !== 1) fail();
      const activeClaims = await tx.unsafe(`SELECT id FROM public.claim_log
        WHERE run_id = $1 AND story_id = $2 AND step_id = 'implement'
          AND outcome IS NULL ORDER BY id LIMIT 1 FOR UPDATE`, [row.runId, row.storyId]);
      if (activeClaims.length !== 0) fail();
      const activeAttempts = await tx.unsafe(`SELECT attempt_id FROM public.execution_attempts
        WHERE run_id = $1 AND story_id = $2 AND step_id = 'implement'
          AND disposition IN ('claimed', 'running')
        ORDER BY attempt_id LIMIT 1 FOR UPDATE`, [row.runId, row.storyId]);
      if (activeAttempts.length !== 0) fail();
      const unreleasedRuntimes = await tx.unsafe(`SELECT session_id FROM public.runtime_sessions
        WHERE run_id = $1 AND workflow_step_id = 'implement' AND story_id = $2
          AND state <> 'released'
        ORDER BY session_id LIMIT 1 FOR UPDATE`, [row.runId, row.storyId]);
      if (unreleasedRuntimes.length !== 0) fail();
      const competing = await tx.unsafe(`SELECT reservation_hash FROM ${ORDINARY}
        WHERE root = $1 LIMIT 1`, [row.root]);
      if (competing.length !== 0) fail();
      validateDelivery(delivery, row, await readDatabaseWallClock(tx, REFUSED));

      const created = createPrivateDiagnosticPinnedWorktreeV1({
        reservationHash: row.reservationHash, repo: fixed.repo, root: row.root,
        sourceSha: row.sourceSha, sourceTreeHash: row.sourceTreeHash,
      });
      if (created.authority !== "diagnostic-only"
        || created.reservationHash !== row.reservationHash
        || created.root !== row.root || created.sourceSha !== row.sourceSha
        || created.sourceTreeHash !== row.sourceTreeHash) fail();
      const after = await tx.unsafe<Array<Delivery>>(`SELECT
        recovery_case_id AS "recoveryCaseId", revision_id AS "revisionId",
        run_id AS "runId", story_id AS "storyId", state,
        owner_instance_id AS "ownerInstanceId", lease_token AS "leaseToken",
        lease_expires_at AS "leaseExpiresAt", attempt_id AS "attemptId",
        claim_id::text AS "claimId", execution_slice_hash AS "executionSliceHash",
        attempt_count AS "attemptCount", started_at AS "startedAt",
        authorized_at AS "authorizedAt"
        FROM public.recovery_dispatch_deliveries
        WHERE dispatch_id = $1 FOR UPDATE`, [row.dispatchId]);
      if (after.length !== 1 || after[0]?.leaseToken !== delivery.leaseToken
        || after[0]?.leaseExpiresAt?.getTime() !== delivery.leaseExpiresAt?.getTime()
        || after[0]?.authorizedAt?.getTime() !== delivery.authorizedAt?.getTime()) fail();
      validateDelivery(after[0], row, await readDatabaseWallClock(tx, REFUSED));
      return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
        disposition: "created" as const, reservationHash: row.reservationHash });
    });
  } catch { return fail(); }
}
