import path from "node:path";
import type postgres from "postgres";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Private post-33 read-only diagnostic. A link never settles a reservation;
// text roots are not physical identities. This does not authenticate a writer,
// fence concurrent creation, register a migration, or grant owner/admission.
const ORDINARY = "public.internal_production_positive_worktree_precreate_reservations_v1";
const RECOVERY = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";
const ORDINARY_SCHEMA = "setfarm.internal-production-positive-worktree-private-precreate-reservation.v1";
const RECOVERY_SCHEMA = "setfarm.internal-production-positive-worktree-private-recovery-precreate-reservation.v1";
const SCHEMA = "setfarm.internal-production-positive-worktree-private-pending-reservation-census.v1";
const MODE = "isolation level repeatable read read only";
const MAX_ROWS = 256;
const REFUSED = "TASK6A_PRIVATE_PENDING_RESERVATION_CENSUS_REFUSED";
const fail = (): never => { throw new Error(REFUSED); };

type CommonRow = Readonly<{ reservationHash: string; runId: string;
  storyDbId: string; storyId: string; ownerInstanceId: string; root: string;
  sourceSha: string; sourceTreeHash: string; canonicalBody: string }>;
type OrdinaryRow = CommonRow & Readonly<{ dispatchKey: string }>;
type RecoveryRow = CommonRow & Readonly<{ dispatchId: string;
  recoveryCaseId: string; revisionId: string; leaseTokenHash: string }>;

function bounded(value: unknown, maxBytes: number): string {
  if (typeof value !== "string" || value.length === 0
    || Buffer.byteLength(value, "utf8") > maxBytes
    || value.trim() !== value || value.includes("\0")) return fail();
  return value;
}

function validateCommon(row: CommonRow): void {
  for (const value of [row.runId, row.storyDbId, row.storyId, row.ownerInstanceId]) {
    bounded(value, 256);
  }
  const root = bounded(row.root, 1024);
  if (!path.isAbsolute(root) || root === path.parse(root).root
    || path.normalize(root) !== root || root.endsWith(path.sep)) fail();
  if (!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(row.sourceSha)
    || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(row.sourceTreeHash)
    || row.sourceSha.length !== row.sourceTreeHash.length
    || !/^[a-f0-9]{64}$/.test(row.reservationHash)
    || Buffer.byteLength(row.canonicalBody, "utf8") > 4096) fail();
}

function validateOrdinary(row: OrdinaryRow): void {
  validateCommon(row);
  bounded(row.dispatchKey, 256);
  const body = { schema: ORDINARY_SCHEMA, runId: row.runId,
    storyDbId: row.storyDbId, storyId: row.storyId,
    dispatchKey: row.dispatchKey, ownerInstanceId: row.ownerInstanceId,
    root: row.root, sourceSha: row.sourceSha,
    sourceTreeHash: row.sourceTreeHash };
  if (canonicalJsonStringify(body) !== row.canonicalBody
    || hashCanonicalJson(body) !== row.reservationHash) fail();
}

function validateRecovery(row: RecoveryRow): void {
  validateCommon(row);
  if (!/^RDISP_[a-f0-9]{64}$/.test(row.dispatchId)
    || !/^RCV_[a-f0-9]{64}$/.test(row.recoveryCaseId)
    || !/^RREV_[a-f0-9]{64}$/.test(row.revisionId)
    || !/^[a-f0-9]{64}$/.test(row.leaseTokenHash)) fail();
  const body = { schema: RECOVERY_SCHEMA, runId: row.runId,
    storyDbId: row.storyDbId, storyId: row.storyId,
    dispatchId: row.dispatchId, recoveryCaseId: row.recoveryCaseId,
    revisionId: row.revisionId, ownerInstanceId: row.ownerInstanceId,
    root: row.root, sourceSha: row.sourceSha,
    sourceTreeHash: row.sourceTreeHash,
    leaseTokenHash: row.leaseTokenHash };
  if (canonicalJsonStringify(body) !== row.canonicalBody
    || hashCanonicalJson(body) !== row.reservationHash) fail();
}

function count(value: unknown): number {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) fail();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_ROWS) fail();
  return parsed;
}

export async function observePrivatePendingPositiveWorktreeReservationsV1(sql: postgres.Sql):
Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "empty" | "pending"; physicalIdentityProvenance: "unverified";
  counts: Readonly<{ ordinary: number; recovery: number; total: number }>;
  identitySetHash: string }>> {
  try {
    return await sql.begin(MODE, async (tx) => {
      await tx.unsafe("SET LOCAL statement_timeout = '5s'");
      await tx.unsafe("SET LOCAL lock_timeout = '1s'");
      await tx.unsafe("SET LOCAL idle_in_transaction_session_timeout = '10s'");
      const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`SELECT
        pg_catalog.current_setting('transaction_isolation') AS isolation,
        pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
      if (mode.length !== 1 || mode[0]?.isolation !== "repeatable read"
        || mode[0]?.readOnly !== "on") fail();
      const totals = await tx.unsafe<Array<{ ordinary: string; recovery: string }>>(`SELECT
        (SELECT count(*)::text FROM ${ORDINARY}) AS ordinary,
        (SELECT count(*)::text FROM ${RECOVERY}) AS recovery`);
      if (totals.length !== 1) fail();
      const ordinaryCount = count(totals[0]?.ordinary);
      const recoveryCount = count(totals[0]?.recovery);
      if (ordinaryCount + recoveryCount > MAX_ROWS) fail();
      const ordinary = await tx.unsafe<Array<OrdinaryRow>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_key AS "dispatchKey", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        canonical_body AS "canonicalBody"
        FROM ${ORDINARY} ORDER BY reservation_hash COLLATE "C" LIMIT 257`);
      const recovery = await tx.unsafe<Array<RecoveryRow>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_id AS "dispatchId", recovery_case_id AS "recoveryCaseId",
        revision_id AS "revisionId", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        lease_token_hash AS "leaseTokenHash", canonical_body AS "canonicalBody"
        FROM ${RECOVERY} ORDER BY reservation_hash COLLATE "C" LIMIT 257`);
      if (ordinary.length !== ordinaryCount || recovery.length !== recoveryCount) fail();
      const roots = new Set<string>();
      for (const row of ordinary) {
        validateOrdinary(row);
        if (roots.has(row.root)) fail();
        roots.add(row.root);
      }
      for (const row of recovery) {
        validateRecovery(row);
        if (roots.has(row.root)) fail();
        roots.add(row.root);
      }
      const counts = Object.freeze({ ordinary: ordinaryCount,
        recovery: recoveryCount, total: ordinaryCount + recoveryCount });
      return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
        disposition: counts.total === 0 ? "empty" as const : "pending" as const,
        physicalIdentityProvenance: "unverified" as const, counts,
        identitySetHash: hashCanonicalJson({ schema: SCHEMA,
          ordinary: ordinary.map((row) => row.reservationHash),
          recovery: recovery.map((row) => row.reservationHash) }) });
    });
  } catch { return fail(); }
}
