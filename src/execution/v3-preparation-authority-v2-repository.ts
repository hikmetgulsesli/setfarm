import type postgres from "postgres";

import { canonicalJsonStringify } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  V3PreparationClaimAuthorityV2Schema,
  type V3PreparationClaimAuthorityV2,
} from "./v3-preparation-claim-authority-v2.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export type V3PreparationAuthorityV2PublicationStatus = "published" | "duplicate";

export class V3PreparationAuthorityV2RepositoryError extends Error {
  readonly code: string;
  override readonly cause?: unknown;

  constructor(code: string, message: string, options: Readonly<{ cause?: unknown }> = {}) {
    super(`${code}: ${message}`);
    this.name = "V3PreparationAuthorityV2RepositoryError";
    this.code = code;
    this.cause = options.cause;
  }
}

function repositoryFail(code: string, message: string, cause?: unknown): never {
  throw new V3PreparationAuthorityV2RepositoryError(code, message, { cause });
}

function claimId(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    repositoryFail("V3_PREPARATION_AUTHORITY_V2_CLAIM_ID_INVALID", "claim ID must be a positive safe integer");
  }
  return parsed;
}

function attemptId(value: unknown): string {
  if (typeof value !== "string" || !/^ATT_[A-Za-z0-9-]{16,160}$/.test(value)) {
    repositoryFail("V3_PREPARATION_AUTHORITY_V2_ATTEMPT_ID_INVALID", "attempt ID is invalid");
  }
  return value;
}

function isConstraintViolation(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && ["23503", "23505", "23514"].includes(String(error.code));
}

type AuthorityRow = Readonly<{
  authority_hash: string;
  authority_payload: unknown;
}>;

async function readAuthorityRow(
  sql: Pick<Sql, "unsafe"> | Pick<TransactionSql, "unsafe">,
  authorityHash: string,
): Promise<AuthorityRow | undefined> {
  const rows = await sql.unsafe<AuthorityRow[]>(
    `SELECT authority_hash, authority_payload
       FROM public.v3_preparation_authorities_v2
      WHERE authority_hash = $1`,
    [authorityHash],
  );
  return rows[0];
}

function parseAuthorityRow(row: AuthorityRow): V3PreparationClaimAuthorityV2 {
  const parsed = V3PreparationClaimAuthorityV2Schema.safeParse(
    typeof row.authority_payload === "string"
      ? JSON.parse(row.authority_payload)
      : row.authority_payload,
  );
  if (!parsed.success || parsed.data.authorityHash !== row.authority_hash) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_STORED_PAYLOAD_INVALID",
      "stored preparation authority does not reproduce its canonical hash",
      parsed.success ? undefined : parsed.error,
    );
  }
  return parsed.data;
}

export async function readV3PreparationAuthorityV2(
  sql: Sql | TransactionSql,
  authorityHashInput: string,
): Promise<V3PreparationClaimAuthorityV2 | undefined> {
  const authorityHash = Sha256Schema.parse(authorityHashInput);
  const row = await readAuthorityRow(sql, authorityHash);
  return row ? parseAuthorityRow(row) : undefined;
}

export async function publishV3PreparationAuthorityV2InTransaction(
  transaction: TransactionSql,
  authorityInput: unknown,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  const authority = V3PreparationClaimAuthorityV2Schema.parse(authorityInput);
  try {
    const rows = await transaction.unsafe<Array<{ authority_hash: string }>>(
      `INSERT INTO public.v3_preparation_authorities_v2 (
         authority_hash, authority_schema, authority_version, packet_schema,
         run_id, step_id, story_id, state_version, packet_hash,
         compilation_report_hash, base_source_sha, base_source_tree_hash,
         authority_payload
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text::jsonb
       )
       ON CONFLICT DO NOTHING
       RETURNING authority_hash`,
      [
        authority.authorityHash,
        authority.schema,
        authority.authorityVersion,
        authority.packetSchema,
        authority.runId,
        authority.stepId,
        authority.storyId,
        authority.stateVersion,
        authority.packetHash,
        authority.compilationReportHash,
        authority.baseRevision.sha,
        authority.baseRevision.treeHash,
        canonicalJsonStringify(authority),
      ],
    );
    if (rows.length === 1) return "published";
  } catch (error) {
    if (!isConstraintViolation(error)) throw error;
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
      "preparation authority identity conflicts with durable provenance",
      error,
    );
  }
  const stored = await readAuthorityRow(transaction, authority.authorityHash);
  if (!stored) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
      "preparation identity is already bound to a different canonical authority",
    );
  }
  const parsed = parseAuthorityRow(stored);
  if (canonicalJsonStringify(parsed) !== canonicalJsonStringify(authority)) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
      "existing authority hash does not contain the exact canonical payload",
    );
  }
  return "duplicate";
}

export async function publishV3PreparationAuthorityV2(
  sql: Sql,
  authority: unknown,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  return sql.begin((transaction) =>
    publishV3PreparationAuthorityV2InTransaction(transaction, authority)) as Promise<
      V3PreparationAuthorityV2PublicationStatus
    >;
}

export async function bindV3PreparationAuthorityClaimV2InTransaction(
  transaction: TransactionSql,
  input: Readonly<{ authorityHash: string; claimId: number }>,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  const authorityHash = Sha256Schema.parse(input.authorityHash);
  const exactClaimId = claimId(input.claimId);
  try {
    const rows = await transaction.unsafe<Array<{ authority_hash: string }>>(
      `INSERT INTO public.v3_preparation_authority_claims_v2 (authority_hash, claim_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING authority_hash`,
      [authorityHash, exactClaimId],
    );
    if (rows.length === 1) return "published";
  } catch (error) {
    if (!isConstraintViolation(error)) throw error;
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT",
      "claim is not the exact active owner of the preparation authority",
      error,
    );
  }
  const rows = await transaction.unsafe<Array<{ claim_id: string | number }>>(
    `SELECT claim_id FROM public.v3_preparation_authority_claims_v2
      WHERE authority_hash = $1`,
    [authorityHash],
  );
  if (rows.length !== 1 || claimId(rows[0]!.claim_id) !== exactClaimId) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT",
      "authority was already consumed by a different claim",
    );
  }
  return "duplicate";
}

export async function bindV3PreparationAuthorityAttemptV2InTransaction(
  transaction: TransactionSql,
  input: Readonly<{
    authorityHash: string;
    claimId: number;
    attemptId: string;
    sliceHash: string;
  }>,
): Promise<V3PreparationAuthorityV2PublicationStatus> {
  const authorityHash = Sha256Schema.parse(input.authorityHash);
  const exactClaimId = claimId(input.claimId);
  const exactAttemptId = attemptId(input.attemptId);
  const sliceHash = Sha256Schema.parse(input.sliceHash);
  try {
    const rows = await transaction.unsafe<Array<{ authority_hash: string }>>(
      `INSERT INTO public.v3_preparation_authority_attempts_v2 (
         authority_hash, claim_id, attempt_id, slice_hash
       ) VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING authority_hash`,
      [authorityHash, exactClaimId, exactAttemptId, sliceHash],
    );
    if (rows.length === 1) return "published";
  } catch (error) {
    if (!isConstraintViolation(error)) throw error;
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
      "attempt is not the exact initial implementation consumer of the authority",
      error,
    );
  }
  const rows = await transaction.unsafe<Array<{
    claim_id: string | number;
    attempt_id: string;
    slice_hash: string;
  }>>(
    `SELECT claim_id, attempt_id, slice_hash
       FROM public.v3_preparation_authority_attempts_v2
      WHERE authority_hash = $1`,
    [authorityHash],
  );
  const existing = rows[0];
  if (
    rows.length !== 1
    || claimId(existing!.claim_id) !== exactClaimId
    || existing!.attempt_id !== exactAttemptId
    || existing!.slice_hash !== sliceHash
  ) {
    repositoryFail(
      "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
      "authority was already consumed by a different attempt or slice",
    );
  }
  return "duplicate";
}
