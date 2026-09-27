import { createHash } from "node:crypto";
import { types } from "node:util";
import type postgres from "postgres";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";

// Private post-33 fixture only. This link correlates two committed rows; it
// does not authenticate a physical creator, settle a pending reservation,
// fence writers, register a migration, or grant owner/admission authority.
// The shared-field FKs are not a complete DB-side proof of every projected
// column; no consumer may treat direct SQL inserts as authenticated links.
const RESERVATIONS = "public.internal_production_positive_worktree_precreate_reservations_v1";
const RECEIPTS = "public.internal_production_positive_worktree_receipt_journal_v1";
const LINKS = "public.internal_production_positive_worktree_reservation_receipt_links_v1";
const SCHEMA = "setfarm.internal-production-positive-worktree-private-reservation-receipt-link.v1";
const FENCE_SCHEMA = "setfarm.internal-production-positive-worktree-fence-commitment.v1";
const REFUSED = "TASK6A_PRIVATE_RESERVATION_RECEIPT_LINK_REFUSED";
const fail = (): never => { throw new Error(REFUSED); };

export const PRIVATE_POSITIVE_WORKTREE_RESERVATION_RECEIPT_LINK_V1_STATEMENTS = Object.freeze([
  `CREATE UNIQUE INDEX task6a_private_precreate_link_identity_v1 ON ${RESERVATIONS}
    (reservation_hash, run_id, owner_instance_id, root, source_sha, source_tree_hash)`,
  `CREATE UNIQUE INDEX task6a_private_receipt_link_identity_v1 ON ${RECEIPTS}
    (receipt_hash, run_id, owner_instance_id, root, source_sha, source_tree_hash)`,
  `CREATE TABLE ${LINKS} (
    link_hash text PRIMARY KEY CHECK (link_hash ~ '^[a-f0-9]{64}$'),
    reservation_hash text NOT NULL UNIQUE,
    receipt_hash text NOT NULL UNIQUE,
    run_id text NOT NULL,
    story_db_id text NOT NULL,
    story_id text NOT NULL,
    dispatch_key text NOT NULL,
    claim_id bigint NOT NULL,
    attempt_id text NOT NULL,
    session_id text NOT NULL,
    generation integer NOT NULL CHECK (generation > 0),
    owner_instance_id text NOT NULL,
    root text NOT NULL,
    source_sha text NOT NULL,
    source_tree_hash text NOT NULL,
    physical_identity_hash text NOT NULL CHECK (physical_identity_hash ~ '^[a-f0-9]{64}$'),
    fence_token_hash text NOT NULL CHECK (fence_token_hash ~ '^[a-f0-9]{64}$'),
    canonical_body text NOT NULL CHECK (octet_length(canonical_body) BETWEEN 1 AND 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task6a_private_link_reservation_v1 FOREIGN KEY
      (reservation_hash, run_id, owner_instance_id, root, source_sha, source_tree_hash)
      REFERENCES ${RESERVATIONS}
      (reservation_hash, run_id, owner_instance_id, root, source_sha, source_tree_hash)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT task6a_private_link_receipt_v1 FOREIGN KEY
      (receipt_hash, run_id, owner_instance_id, root, source_sha, source_tree_hash)
      REFERENCES ${RECEIPTS}
      (receipt_hash, run_id, owner_instance_id, root, source_sha, source_tree_hash)
      ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT task6a_private_link_body_hash_v1 CHECK
      (link_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(canonical_body, 'UTF8')), 'hex'))
  )`,
  `CREATE FUNCTION public.task6a_private_link_immutable_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_PRIVATE_RESERVATION_RECEIPT_LINK_IMMUTABLE' USING ERRCODE = '42501';
    END $$`,
  `CREATE TRIGGER task6a_private_link_no_replace_v1 BEFORE UPDATE OR DELETE ON ${LINKS}
    FOR EACH ROW EXECUTE FUNCTION public.task6a_private_link_immutable_v1()`,
  `CREATE TRIGGER task6a_private_link_no_truncate_v1 BEFORE TRUNCATE ON ${LINKS}
    FOR EACH STATEMENT EXECUTE FUNCTION public.task6a_private_link_immutable_v1()`,
] as const);

type ReservationRow = Readonly<{ reservationHash: string; runId: string;
  storyDbId: string; storyId: string; dispatchKey: string;
  ownerInstanceId: string; root: string; sourceSha: string; sourceTreeHash: string }>;
type ReceiptRow = Readonly<{ receiptHash: string; runId: string; claimId: string;
  attemptId: string; sessionId: string; generation: number; ownerInstanceId: string;
  root: string; sourceSha: string; sourceTreeHash: string;
  physicalIdentityHash: string; fenceTokenHash: string }>;
type LinkRow = Readonly<{
  linkHash: string; reservationHash: string; receiptHash: string; runId: string;
  storyDbId: string; storyId: string; dispatchKey: string; claimId: string;
  attemptId: string; sessionId: string; generation: number; ownerInstanceId: string;
  root: string; sourceSha: string; sourceTreeHash: string;
  physicalIdentityHash: string; fenceTokenHash: string; canonicalBody: string;
}>;

function project(input: unknown): Readonly<{ reservationHash: string; receiptHash: string }> {
  if (input === null || typeof input !== "object" || types.isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype) return fail();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || keys.some((key) => typeof key !== "string"
    || !["reservationHash", "receiptHash"].includes(key))) fail();
  const field = (key: "reservationHash" | "receiptHash"): string => {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable
      || typeof descriptor.value !== "string"
      || !/^[a-f0-9]{64}$/.test(descriptor.value)) return fail();
    return descriptor.value;
  };
  return Object.freeze({ reservationHash: field("reservationHash"),
    receiptHash: field("receiptHash") });
}

export async function appendPrivateDiagnosticReservationReceiptLinkV1(
  sql: postgres.Sql, input: unknown,
): Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "inserted" | "identical-retry"; linkHash: string }>> {
  try {
    const { reservationHash, receiptHash } = project(input);
    return await sql.begin("isolation level serializable", async (tx) => {
      const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`
        SELECT pg_catalog.current_setting('transaction_isolation') AS isolation,
          pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
      if (mode.length !== 1 || mode[0]?.isolation !== "serializable"
        || mode[0]?.readOnly !== "off") fail();
      const reservations = await tx.unsafe<Array<ReservationRow>>(`SELECT
        reservation_hash AS "reservationHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_key AS "dispatchKey", owner_instance_id AS "ownerInstanceId",
        root, source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash"
        FROM ${RESERVATIONS} WHERE reservation_hash = $1 FOR UPDATE`, [reservationHash]);
      const receipts = await tx.unsafe<Array<ReceiptRow>>(`SELECT
        receipt_hash AS "receiptHash", run_id AS "runId", claim_id::text AS "claimId",
        attempt_id AS "attemptId", session_id AS "sessionId", generation,
        owner_instance_id AS "ownerInstanceId", root,
        source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        physical_identity_hash AS "physicalIdentityHash",
        fence_token_hash AS "fenceTokenHash"
        FROM ${RECEIPTS} WHERE receipt_hash = $1 FOR UPDATE`, [receiptHash]);
      if (reservations.length !== 1 || receipts.length !== 1) fail();
      const reservation = reservations[0]!, receipt = receipts[0]!;
      if (reservation.runId !== receipt.runId
        || reservation.ownerInstanceId !== receipt.ownerInstanceId
        || reservation.root !== receipt.root
        || reservation.sourceSha !== receipt.sourceSha
        || reservation.sourceTreeHash !== receipt.sourceTreeHash) fail();

      const active = await tx.unsafe<Array<{ fenceToken: string }>>(`SELECT
        a.fence_token AS "fenceToken" FROM public.runs r
        JOIN public.stories st ON st.run_id = r.id
        JOIN public.claim_log c ON c.run_id = r.id AND c.story_id = st.story_id
        JOIN public.execution_attempts a ON a.claim_id = c.id
          AND a.run_id = r.id AND a.step_id = c.step_id AND a.story_id = st.story_id
        JOIN public.runtime_sessions s ON s.claim_id = c.id
          AND s.run_id = r.id AND s.attempt_id = a.attempt_id
        JOIN public.v3_story_claim_runtime_bindings_v1 b
          ON b.claim_id = c.id AND b.runtime_session_id = s.session_id
          AND b.run_id = r.id AND b.step_db_id = s.step_db_id
          AND b.workflow_step_id = c.step_id AND b.subject_kind = 'story_member'
          AND b.story_db_id = st.id AND b.story_id = st.story_id
          AND b.story_index = st.story_index
          AND b.story_claim_generation = st.claim_generation
        WHERE r.id = $1 AND r.status = 'running' AND r.protocol = 'v3'
          AND st.id = $2 AND st.story_id = $3 AND st.status IN ('pending', 'running')
          AND c.id = $4::bigint AND c.step_id = 'implement'
          AND c.outcome IS NULL AND c.abandoned_at IS NULL
          AND a.attempt_id = $5 AND a.generation = $6
          AND a.agent_id = c.agent_id AND a.role = 'implementer'
          AND a.disposition IN ('claimed', 'running')
          AND a.worktree = $7 AND a.source_before_sha = $8
          AND a.source_before_tree_hash = $9
          AND s.session_id = $10 AND s.owner_instance_id = $11
          AND s.story_db_id = st.id AND s.story_id = st.story_id
          AND s.claim_agent_id = c.agent_id AND s.workflow_step_id = c.step_id
          AND s.worktree = $7
          AND s.state IN ('reserved', 'starting', 'running', 'drain_requested', 'drained')
        FOR UPDATE OF r, st, c, a, s, b`, [reservation.runId,
      reservation.storyDbId, reservation.storyId, receipt.claimId,
      receipt.attemptId, receipt.generation, reservation.root,
      reservation.sourceSha, reservation.sourceTreeHash, receipt.sessionId,
      receipt.ownerInstanceId]);
      if (active.length !== 1 || typeof active[0]?.fenceToken !== "string") fail();
      const fenceTokenHash = hashCanonicalJson({ schema: FENCE_SCHEMA,
        attemptId: receipt.attemptId, generation: receipt.generation,
        fenceToken: active[0].fenceToken });
      if (fenceTokenHash !== receipt.fenceTokenHash) fail();

      const body = Object.freeze({ schema: SCHEMA, reservationHash, receiptHash,
        runId: reservation.runId, storyDbId: reservation.storyDbId,
        storyId: reservation.storyId, dispatchKey: reservation.dispatchKey,
        claimId: receipt.claimId, attemptId: receipt.attemptId,
        sessionId: receipt.sessionId, generation: receipt.generation,
        ownerInstanceId: reservation.ownerInstanceId, root: reservation.root,
        sourceSha: reservation.sourceSha, sourceTreeHash: reservation.sourceTreeHash,
        physicalIdentityHash: receipt.physicalIdentityHash,
        fenceTokenHash: receipt.fenceTokenHash });
      const canonicalBody = canonicalJsonStringify(body);
      if (Buffer.byteLength(canonicalBody, "utf8") > 4096) fail();
      const linkHash = createHash("sha256").update(canonicalBody, "utf8").digest("hex");
      const { schema: bodySchema, ...columns } = body;
      if (bodySchema !== SCHEMA) fail();
      const expected: LinkRow = Object.freeze({ ...columns, linkHash, canonicalBody });
      const inserted = await tx.unsafe(`INSERT INTO ${LINKS} (
        link_hash, reservation_hash, receipt_hash, run_id, story_db_id,
        story_id, dispatch_key, claim_id, attempt_id, session_id, generation,
        owner_instance_id, root, source_sha, source_tree_hash,
        physical_identity_hash, fence_token_hash, canonical_body
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::bigint,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT DO NOTHING RETURNING link_hash`, [linkHash, reservationHash,
      receiptHash, reservation.runId, reservation.storyDbId,
      reservation.storyId, reservation.dispatchKey, receipt.claimId,
      receipt.attemptId, receipt.sessionId, receipt.generation,
      reservation.ownerInstanceId, reservation.root, reservation.sourceSha,
      reservation.sourceTreeHash, receipt.physicalIdentityHash,
      receipt.fenceTokenHash, canonicalBody]);
      if (inserted.length === 1) return Object.freeze({ schema: SCHEMA,
        authority: "diagnostic-only" as const, disposition: "inserted" as const,
        linkHash });
      const existing = await tx.unsafe<Array<LinkRow>>(`SELECT
        link_hash AS "linkHash", reservation_hash AS "reservationHash",
        receipt_hash AS "receiptHash", run_id AS "runId",
        story_db_id AS "storyDbId", story_id AS "storyId",
        dispatch_key AS "dispatchKey", claim_id::text AS "claimId",
        attempt_id AS "attemptId", session_id AS "sessionId", generation,
        owner_instance_id AS "ownerInstanceId", root,
        source_sha AS "sourceSha", source_tree_hash AS "sourceTreeHash",
        physical_identity_hash AS "physicalIdentityHash",
        fence_token_hash AS "fenceTokenHash", canonical_body AS "canonicalBody"
        FROM ${LINKS} WHERE link_hash = $1 OR reservation_hash = $2 OR receipt_hash = $3`,
      [linkHash, reservationHash, receiptHash]);
      if (existing.length !== 1 || !Object.keys(expected).every((key) =>
        existing[0]![key as keyof LinkRow] === expected[key as keyof LinkRow])) fail();
      return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
        disposition: "identical-retry" as const, linkHash });
    });
  } catch { return fail(); }
}
