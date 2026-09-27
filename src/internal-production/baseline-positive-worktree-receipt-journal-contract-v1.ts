import type postgres from "postgres";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { projectPositiveWorktreeBindingCandidateV1 } from
  "./baseline-positive-worktree-binding-contract-v1.js";

// Private post-33 fixture contract only. No registered migration, runtime call,
// producer authentication, or owner/admission authority. A table trigger does
// not fence a table owner or superuser; the real transition needs a separate
// continuous DB/OS writer fence and an earlier pre-create reservation.
const TABLE = "public.internal_production_positive_worktree_receipt_journal_v1";
const REFUSED = "TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_REFUSED";
const SCHEMA = "setfarm.internal-production-positive-worktree-private-journal-append.v1";
const fail = (): never => { throw new Error(REFUSED); };

export const PRIVATE_POSITIVE_WORKTREE_RECEIPT_JOURNAL_V1_STATEMENTS = Object.freeze([
  `CREATE UNIQUE INDEX task6a_private_receipt_session_claim_run_v1
    ON public.runtime_sessions(session_id, claim_id, run_id)`,
  `CREATE TABLE ${TABLE} (
    receipt_hash text PRIMARY KEY CHECK (receipt_hash ~ '^[a-f0-9]{64}$'),
    run_id text NOT NULL,
    claim_id bigint NOT NULL,
    attempt_id text NOT NULL UNIQUE,
    session_id text NOT NULL UNIQUE,
    owner_instance_id text NOT NULL,
    generation integer NOT NULL CHECK (generation > 0),
    root text NOT NULL,
    physical_identity_hash text NOT NULL CHECK (physical_identity_hash ~ '^[a-f0-9]{64}$'),
    fence_token_hash text NOT NULL CHECK (fence_token_hash ~ '^[a-f0-9]{64}$'),
    source_sha text NOT NULL CHECK (source_sha ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    source_tree_hash text NOT NULL CHECK (source_tree_hash ~ '^([a-f0-9]{40}|[a-f0-9]{64})$'),
    canonical_body text NOT NULL CHECK (octet_length(canonical_body) BETWEEN 1 AND 4096),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT task6a_private_receipt_body_hash_v1
      CHECK (receipt_hash = encode(pg_catalog.sha256(pg_catalog.convert_to(canonical_body, 'UTF8')), 'hex')),
    CONSTRAINT task6a_private_receipt_claim_v1
      FOREIGN KEY (claim_id, run_id) REFERENCES public.claim_log(id, run_id) ON DELETE RESTRICT,
    CONSTRAINT task6a_private_receipt_attempt_v1
      FOREIGN KEY (attempt_id, claim_id) REFERENCES public.execution_attempts(attempt_id, claim_id) ON DELETE RESTRICT,
    CONSTRAINT task6a_private_receipt_session_v1
      FOREIGN KEY (session_id, claim_id, run_id)
      REFERENCES public.runtime_sessions(session_id, claim_id, run_id) ON DELETE RESTRICT
  )`,
  `CREATE FUNCTION public.task6a_private_receipt_immutable_v1() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'TASK6A_POST33_PRIVATE_RECEIPT_JOURNAL_IMMUTABLE' USING ERRCODE = '42501';
    END $$`,
  `CREATE TRIGGER task6a_private_receipt_no_replace_v1 BEFORE UPDATE OR DELETE ON ${TABLE}
    FOR EACH ROW EXECUTE FUNCTION public.task6a_private_receipt_immutable_v1()`,
  `CREATE TRIGGER task6a_private_receipt_no_truncate_v1 BEFORE TRUNCATE ON ${TABLE}
    FOR EACH STATEMENT EXECUTE FUNCTION public.task6a_private_receipt_immutable_v1()`,
] as const);

type JournalRow = Readonly<{
  receiptHash: string;
  runId: string;
  claimId: string;
  attemptId: string;
  sessionId: string;
  ownerInstanceId: string;
  generation: number;
  root: string;
  physicalIdentityHash: string;
  fenceTokenHash: string;
  sourceSha: string;
  sourceTreeHash: string;
  canonicalBody: string;
}>;

function rawFenceToken(input: unknown): string {
  const attempt = Object.getOwnPropertyDescriptor(input as object, "attempt")?.value as object;
  const token = Object.getOwnPropertyDescriptor(attempt, "fenceToken")?.value as unknown;
  if (typeof token !== "string") return fail();
  if (!/^[a-f0-9]{64}$/.test(token)) return fail();
  return token;
}

export async function appendPrivateDiagnosticPositiveWorktreeReceiptJournalV1(
  sql: postgres.Sql, input: unknown,
): Promise<Readonly<{ schema: typeof SCHEMA; authority: "diagnostic-only";
  disposition: "inserted" | "identical-retry"; receiptHash: string }>> {
  try {
    const candidate = projectPositiveWorktreeBindingCandidateV1(input);
    const fenceToken = rawFenceToken(input);
    const { receiptHash, ...receiptBody } = candidate.receipt;
    const expected: JournalRow = Object.freeze({ receiptHash,
      runId: candidate.attempt.runId, claimId: candidate.attempt.claimId,
      attemptId: candidate.attempt.attemptId, sessionId: candidate.session.sessionId,
      ownerInstanceId: candidate.session.ownerInstanceId,
      generation: candidate.attempt.generation, root: candidate.physical.root,
      physicalIdentityHash: candidate.receipt.physicalIdentityHash,
      fenceTokenHash: candidate.receipt.fenceTokenHash,
      sourceSha: candidate.receipt.sourceSha, sourceTreeHash: candidate.receipt.sourceTreeHash,
      canonicalBody: canonicalJsonStringify(receiptBody) });

    return await sql.begin("isolation level serializable", async (tx) => {
    const mode = await tx.unsafe<Array<{ isolation: string; readOnly: string }>>(`
      SELECT pg_catalog.current_setting('transaction_isolation') AS isolation,
        pg_catalog.current_setting('transaction_read_only') AS "readOnly"`);
    if (mode.length !== 1 || mode[0]?.isolation !== "serializable"
      || mode[0]?.readOnly !== "off") fail();

    // This module owns the SERIALIZABLE transaction. Lock all three exact rows
    // before publishing; the raw fence is used only as a CAS predicate and is
    // never stored in the journal or returned from this adapter.
    const locked = await tx.unsafe(`
      SELECT a.attempt_id FROM public.execution_attempts a
      JOIN public.runtime_sessions s ON s.attempt_id = a.attempt_id
        AND s.claim_id = a.claim_id AND s.run_id = a.run_id
      JOIN public.claim_log c ON c.id = a.claim_id AND c.run_id = a.run_id
      WHERE a.run_id = $1 AND a.claim_id = $2::bigint AND a.attempt_id = $3
        AND a.generation = $4 AND a.fence_token = $5 AND a.worktree = $6
        AND a.source_before_sha = $7 AND a.source_before_tree_hash = $8
        AND a.disposition IN ('claimed', 'running')
        AND s.session_id = $9 AND s.owner_instance_id = $10
        AND s.worktree = $6
        AND s.state IN ('reserved', 'starting', 'running', 'drain_requested', 'drained')
      FOR UPDATE OF a, s, c`, [expected.runId, expected.claimId, expected.attemptId,
      expected.generation, fenceToken, expected.root, expected.sourceSha,
      expected.sourceTreeHash, expected.sessionId, expected.ownerInstanceId]);
    if (locked.length !== 1) fail();

    const values = [expected.receiptHash, expected.runId, expected.claimId,
      expected.attemptId, expected.sessionId, expected.ownerInstanceId,
      expected.generation, expected.root, expected.physicalIdentityHash,
      expected.fenceTokenHash, expected.sourceSha, expected.sourceTreeHash,
      expected.canonicalBody];
    const inserted = await tx.unsafe(`INSERT INTO ${TABLE} (
      receipt_hash, run_id, claim_id, attempt_id, session_id, owner_instance_id,
      generation, root, physical_identity_hash, fence_token_hash, source_sha,
      source_tree_hash, canonical_body
    ) VALUES ($1, $2, $3::bigint, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT DO NOTHING RETURNING receipt_hash`, values);
    if (inserted.length === 1) return Object.freeze({ schema: SCHEMA,
      authority: "diagnostic-only" as const, disposition: "inserted" as const,
      receiptHash });

    const existing = await tx.unsafe<Array<JournalRow>>(`SELECT
      receipt_hash AS "receiptHash", run_id AS "runId", claim_id::text AS "claimId",
      attempt_id AS "attemptId", session_id AS "sessionId",
      owner_instance_id AS "ownerInstanceId", generation, root,
      physical_identity_hash AS "physicalIdentityHash",
      fence_token_hash AS "fenceTokenHash", source_sha AS "sourceSha",
      source_tree_hash AS "sourceTreeHash", canonical_body AS "canonicalBody"
      FROM ${TABLE} WHERE receipt_hash = $1 OR attempt_id = $2 OR session_id = $3`,
    [expected.receiptHash, expected.attemptId, expected.sessionId]);
    if (existing.length !== 1 || !Object.keys(expected).every((key) =>
      existing[0]![key as keyof JournalRow] === expected[key as keyof JournalRow])) fail();
    return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only" as const,
      disposition: "identical-retry" as const, receiptHash });
    });
  } catch { return fail(); }
}
