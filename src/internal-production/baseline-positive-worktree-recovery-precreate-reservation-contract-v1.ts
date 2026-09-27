import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import type postgres from "postgres";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { lockV3RecoveryRunMutationAuthorityInTransaction } from
  "../recovery/v3-recovery-run-mutation-authority.js";

// Private post-33 fixture only. Database correlation does not authenticate a
// physical creator, continuously fence OS/DB writers, settle a pending row,
// register a migration, or grant owner/admission authority. Direct SQL rows
// are not a producer proof. The separate ordinary V1 table can still contain
// a competing root; future census must consider both. The raw lease token
// never enters persisted data.
const TABLE = "public.internal_production_positive_worktree_recovery_precreate_reservations_v1";
const SCHEMA = "setfarm.internal-production-positive-worktree-private-recovery-precreate-reservation.v1";
const TOKEN_SCHEMA = "setfarm.internal-production-positive-worktree-recovery-lease-token-commitment.v1";
const REFUSED = "TASK6A_PRIVATE_RECOVERY_PRECREATE_RESERVATION_REFUSED";
const fail = (): never => { throw new Error(REFUSED); };

export const PRIVATE_POSITIVE_WORKTREE_RECOVERY_PRECREATE_RESERVATION_V1_STATEMENTS = Object.freeze([
  `CREATE UNIQUE INDEX task6a_private_recovery_precreate_story_identity_v1
    ON public.stories(id, run_id, story_id)`,
  `CREATE TABLE ${TABLE} (
    reservation_hash text PRIMARY KEY CHECK (reservation_hash ~ '^[a-f0-9]{64}$'),
    run_id text NOT NULL REFERENCES public.runs(id) ON DELETE RESTRICT,
    story_db_id text NOT NULL UNIQUE,
    story_id text NOT NULL,
    dispatch_id text NOT NULL UNIQUE,
    recovery_case_id text NOT NULL,
    revision_id text NOT NULL,
    owner_instance_id text NOT NULL,
    root text NOT NULL UNIQUE,
    source_sha text NOT NULL CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    source_tree_hash text NOT NULL CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    lease_token_hash text NOT NULL CHECK (lease_token_hash ~ '^[a-f0-9]{64}$'),
    canonical_body text NOT NULL CHECK (octet_length(canonical_body) BETWEEN 1 AND 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task6a_private_recovery_logical_story_v1 UNIQUE (run_id, story_id),
    CONSTRAINT task6a_private_recovery_story_v1 FOREIGN KEY (story_db_id, run_id, story_id)
      REFERENCES public.stories(id, run_id, story_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT task6a_private_recovery_dispatch_v1 FOREIGN KEY (dispatch_id, revision_id)
      REFERENCES public.recovery_revision_dispatches(dispatch_id, revision_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT task6a_private_recovery_delivery_v1 FOREIGN KEY (dispatch_id)
      REFERENCES public.recovery_dispatch_deliveries(dispatch_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT task6a_private_recovery_body_hash_v1 CHECK
      (reservation_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(canonical_body, 'UTF8')), 'hex'))
  )`,
  `CREATE FUNCTION public.task6a_private_recovery_precreate_immutable_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_PRIVATE_RECOVERY_PRECREATE_RESERVATION_IMMUTABLE' USING ERRCODE = '42501';
    END $$`,
  `CREATE TRIGGER task6a_private_recovery_precreate_no_replace_v1 BEFORE UPDATE OR DELETE ON ${TABLE}
    FOR EACH ROW EXECUTE FUNCTION public.task6a_private_recovery_precreate_immutable_v1()`,
  `CREATE TRIGGER task6a_private_recovery_precreate_no_truncate_v1 BEFORE TRUNCATE ON ${TABLE}
    FOR EACH STATEMENT EXECUTE FUNCTION public.task6a_private_recovery_precreate_immutable_v1()`,
] as const);

type Input = Readonly<{ runId: string; storyDbId: string; storyId: string;
  dispatchId: string; ownerInstanceId: string; leaseToken: string; root: string;
  sourceSha: string; sourceTreeHash: string }>;
type Row = Readonly<{ reservationHash: string; runId: string; storyDbId: string;
  storyId: string; dispatchId: string; recoveryCaseId: string; revisionId: string;
  ownerInstanceId: string; root: string; sourceSha: string; sourceTreeHash: string;
  leaseTokenHash: string; canonicalBody: string }>;
const INPUT_KEYS = Object.freeze(["runId", "storyDbId", "storyId", "dispatchId",
  "ownerInstanceId", "leaseToken", "root", "sourceSha", "sourceTreeHash"] as const);

function project(input: unknown): Input {
  if (input === null || typeof input !== "object" || types.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype) return fail();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== INPUT_KEYS.length || keys.some((key) => typeof key !== "string"
    || !INPUT_KEYS.includes(key as typeof INPUT_KEYS[number]))) fail();
  const field = (key: typeof INPUT_KEYS[number], max = 256): string => {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)
      || typeof descriptor.value !== "string" || descriptor.value.length < 1
      || descriptor.value.length > max || descriptor.value.trim() !== descriptor.value
      || descriptor.value.includes("\0")) return fail();
    return descriptor.value;
  };
  const root = field("root", 1024);
  if (!path.isAbsolute(root) || root === path.parse(root).root
    || path.normalize(root) !== root || root.endsWith(path.sep)) fail();
  const sourceSha = field("sourceSha"), sourceTreeHash = field("sourceTreeHash");
  if (!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceSha)
    || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceTreeHash)
    || sourceSha.length !== sourceTreeHash.length) fail();
  const dispatchId = field("dispatchId");
  if (!/^RDISP_[a-f0-9]{64}$/.test(dispatchId)) fail();
  const leaseToken = field("leaseToken", 500);
  if (leaseToken.length < 16) fail();
  return Object.freeze({ runId: field("runId"), storyDbId: field("storyDbId"),
    storyId: field("storyId"), dispatchId, ownerInstanceId: field("ownerInstanceId"),
    leaseToken, root, sourceSha, sourceTreeHash });
}

function exactTargetAbsent(root: string): boolean {
  try { fs.lstatSync(root); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
}

export async function appendPrivateDiagnosticRecoveryPrecreateReservationV1(
  sql: postgres.Sql, input: unknown,
): Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "inserted" | "identical-retry"; reservationHash: string }>> {
  try {
    const value = project(input);
    if (!exactTargetAbsent(value.root)) fail();
    const result = await sql.begin("isolation level serializable", async (tx) => {
      const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`
        SELECT pg_catalog.current_setting('transaction_isolation') AS isolation,
          pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
      if (mode.length !== 1 || mode[0]?.isolation !== "serializable"
        || mode[0]?.readOnly !== "off") fail();
      const authority = await lockV3RecoveryRunMutationAuthorityInTransaction(tx, {
        runId: value.runId, storyId: value.storyId });
      if (authority.protocol !== "v3") fail();
      const deliveries = await tx.unsafe<Array<{ recoveryCaseId: string; revisionId: string;
        runId: string; storyId: string; state: string; ownerInstanceId: string | null;
        leaseToken: string | null; leaseExpiresAt: Date | null;
        attemptId: string | null; claimId: string | null; attemptCount: number }>>(`SELECT
          recovery_case_id AS "recoveryCaseId", revision_id AS "revisionId",
          run_id AS "runId", story_id AS "storyId", state,
          owner_instance_id AS "ownerInstanceId", lease_token AS "leaseToken",
          lease_expires_at AS "leaseExpiresAt", attempt_id AS "attemptId",
          claim_id::text AS "claimId", attempt_count AS "attemptCount"
          FROM public.recovery_dispatch_deliveries
          WHERE dispatch_id = $1 FOR UPDATE`, [value.dispatchId]);
      if (deliveries.length !== 1) fail();
      const delivery = deliveries[0]!;
      if (delivery.runId !== value.runId || delivery.storyId !== value.storyId
        || delivery.state !== "leased" || delivery.ownerInstanceId !== value.ownerInstanceId
        || delivery.leaseToken !== value.leaseToken
        || delivery.attemptId !== null || delivery.claimId !== null
        || delivery.attemptCount !== 0) fail();
      const cases = await tx.unsafe<Array<{ currentRevisionId: string; status: string }>>(`SELECT
        current_revision_id AS "currentRevisionId", status
        FROM public.recovery_cases WHERE recovery_case_id = $1
          AND run_id = $2 AND story_id = $3 FOR UPDATE`,
      [delivery.recoveryCaseId, value.runId, value.storyId]);
      if (cases.length !== 1 || cases[0]?.currentRevisionId !== delivery.revisionId
        || !["open", "repairing", "evidencing"].includes(cases[0].status)) fail();
      const revisions = await tx.unsafe<Array<{ sourceSha: string; sourceTreeHash: string }>>(`SELECT
        source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash"
        FROM public.recovery_case_revisions WHERE revision_id = $1
          AND recovery_case_id = $2 AND run_id = $3 AND story_id = $4 FOR KEY SHARE`,
      [delivery.revisionId, delivery.recoveryCaseId, value.runId, value.storyId]);
      if (revisions.length !== 1 || revisions[0]?.sourceSha !== value.sourceSha
        || revisions[0]?.sourceTreeHash !== value.sourceTreeHash) fail();
      const dispatches = await tx.unsafe<Array<{ sourceSha: string; sourceTreeHash: string;
        dispatchClass: string }>>(`SELECT source_sha AS "sourceSha",
        source_tree_hash AS "sourceTreeHash", dispatch_class AS "dispatchClass"
        FROM public.recovery_revision_dispatches WHERE dispatch_id = $1
          AND revision_id = $2 AND recovery_case_id = $3 FOR KEY SHARE`,
      [value.dispatchId, delivery.revisionId, delivery.recoveryCaseId]);
      if (dispatches.length !== 1 || dispatches[0]?.sourceSha !== value.sourceSha
        || dispatches[0]?.sourceTreeHash !== value.sourceTreeHash
        || !["product_implementation", "supervisor_repair"].includes(dispatches[0].dispatchClass)) fail();
      const stories = await tx.unsafe(`SELECT id FROM public.stories
        WHERE id = $1 AND run_id = $2 AND story_id = $3 AND status = 'failed'
        FOR UPDATE`, [value.storyDbId, value.runId, value.storyId]);
      if (stories.length !== 1) fail();
      const activeClaims = await tx.unsafe(`SELECT id FROM public.claim_log
        WHERE run_id = $1 AND story_id = $2 AND step_id = 'implement'
          AND outcome IS NULL
        ORDER BY id LIMIT 1 FOR UPDATE`, [value.runId, value.storyId]);
      if (activeClaims.length !== 0) fail();
      const activeAttempts = await tx.unsafe(`SELECT attempt_id FROM public.execution_attempts
        WHERE run_id = $1 AND story_id = $2 AND step_id = 'implement'
          AND disposition IN ('claimed', 'running')
        ORDER BY attempt_id LIMIT 1 FOR UPDATE`, [value.runId, value.storyId]);
      if (activeAttempts.length !== 0) fail();
      const now = await readDatabaseWallClock(tx,
        "TASK6A_PRIVATE_RECOVERY_PRECREATE_DATABASE_TIME_UNAVAILABLE");
      if (!(delivery.leaseExpiresAt instanceof Date)
        || !Number.isFinite(delivery.leaseExpiresAt.getTime())
        || delivery.leaseExpiresAt.getTime() <= now.getTime()) fail();
      const leaseTokenHash = hashCanonicalJson({ schema: TOKEN_SCHEMA,
        dispatchId: value.dispatchId, leaseToken: value.leaseToken });
      const body = Object.freeze({ schema: SCHEMA, runId: value.runId,
        storyDbId: value.storyDbId, storyId: value.storyId,
        dispatchId: value.dispatchId, recoveryCaseId: delivery.recoveryCaseId,
        revisionId: delivery.revisionId, ownerInstanceId: value.ownerInstanceId,
        root: value.root, sourceSha: value.sourceSha,
        sourceTreeHash: value.sourceTreeHash, leaseTokenHash });
      const canonicalBody = canonicalJsonStringify(body);
      if (Buffer.byteLength(canonicalBody, "utf8") > 4096) fail();
      const reservationHash = createHash("sha256").update(canonicalBody, "utf8").digest("hex");
      const { schema: bodySchema, ...columns } = body;
      if (bodySchema !== SCHEMA) fail();
      const expected: Row = Object.freeze({ ...columns, reservationHash, canonicalBody });
      const inserted = await tx.unsafe(`INSERT INTO ${TABLE} (
        reservation_hash, run_id, story_db_id, story_id, dispatch_id,
        recovery_case_id, revision_id, owner_instance_id, root, source_sha,
        source_tree_hash, lease_token_hash, canonical_body
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT DO NOTHING RETURNING reservation_hash`, [reservationHash,
      value.runId, value.storyDbId, value.storyId, value.dispatchId,
      delivery.recoveryCaseId, delivery.revisionId, value.ownerInstanceId,
      value.root, value.sourceSha, value.sourceTreeHash, leaseTokenHash, canonicalBody]);
      if (inserted.length === 1) {
        if (!exactTargetAbsent(value.root)) fail();
        return Object.freeze({ schema: SCHEMA,
          authority: "diagnostic-only" as const, disposition: "inserted" as const,
          reservationHash });
      }
      const existing = await tx.unsafe<Array<Row>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_id AS "dispatchId", recovery_case_id AS "recoveryCaseId",
        revision_id AS "revisionId", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        lease_token_hash AS "leaseTokenHash", canonical_body AS "canonicalBody"
        FROM ${TABLE} WHERE reservation_hash = $1 OR dispatch_id = $2
          OR story_db_id = $3 OR root = $4 OR (run_id = $5 AND story_id = $6)`,
      [reservationHash, value.dispatchId, value.storyDbId, value.root,
        value.runId, value.storyId]);
      if (existing.length !== 1 || !Object.keys(expected).every((key) =>
        existing[0]![key as keyof Row] === expected[key as keyof Row])) fail();
      if (!exactTargetAbsent(value.root)) fail();
      return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
        disposition: "identical-retry" as const, reservationHash });
    });
    return result;
  } catch { return fail(); }
}
