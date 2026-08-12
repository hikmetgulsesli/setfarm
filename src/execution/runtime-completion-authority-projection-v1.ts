import type postgres from "postgres";

import {
  mapRuntimeCompletionEffectRowV1,
  type RuntimeCompletionEffect,
  type RuntimeCompletionEffectRow,
} from "./runtime-completion-effect-repository.js";
import {
  mapRuntimeCompletionRequestRowV1,
  type RuntimeCompletionRequest,
  type RuntimeCompletionRow,
} from "./runtime-completion.js";

const MAX_IDENTITY_BYTES_V1 = 500;
const MAX_HASH_BYTES_V1 = 64;
const MAX_DOCUMENT_BYTES_V1 = 4_000_000;
const MAX_EFFECTS_V1 = 128;

type BoundedRequestRowV1 = Readonly<{
  request_id: string | null;
  runtime_session_id: string | null;
  claim_id: string;
  run_id: string | null;
  step_db_id: string | null;
  workflow_step_id: string | null;
  story_db_id: string | null;
  story_id: string | null;
  attempt_id: string | null;
  claim_envelope: unknown | null;
  output: string | null;
  output_hash: string | null;
  source_proposal: string | null;
  submission_evidence: unknown | null;
  apply_phase: string | null;
  claim_outcome: string | null;
  claim_committed_at: Date | string | null;
  effects_committed_at: Date | string | null;
  completion_plan: unknown | null;
  completion_plan_hash: string | null;
  prepared_at: Date | string | null;
  owner_attempt_count: number;
  state: string | null;
  requested_by: string | null;
  owner_instance_id: string | null;
  lease_expires_at: Date | string | null;
  requested_at: Date | string;
  drained_at: Date | string | null;
  processing_at: Date | string | null;
  accepted_at: Date | string | null;
  rejected_at: Date | string | null;
  diagnostic: string | null;
  result: unknown | null;
  created_at: Date | string;
  updated_at: Date | string;
  oversized_fields: string[];
}>;

type BoundedEffectRowV1 = Readonly<{
  request_id: string | null;
  effect_key: string | null;
  ordinal: number;
  effect_type: string | null;
  input_hash: string | null;
  payload: unknown | null;
  mandatory: boolean;
  state: string | null;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_count: number;
  result: unknown | null;
  evidence: unknown | null;
  applied_at: Date | string | null;
  reconciled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  oversized_fields: string[];
}>;

export type RuntimeCompletionAuthorityProjectionV1 = Readonly<{
  request?: RuntimeCompletionRequest;
  effects: readonly RuntimeCompletionEffect[];
}>;

function oversizedFields(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((field) => typeof field !== "string")) {
    throw new Error("RUNTIME_COMPLETION_AUTHORITY_SIZE_PROJECTION_INVALID");
  }
  return value as string[];
}

/**
 * Loads the complete request/effect surface used by compiler admission without
 * allowing an unbounded TEXT or JSONB value to cross the database boundary.
 */
export async function loadRuntimeCompletionAuthorityProjectionV1(
  sql: postgres.Sql | postgres.TransactionSql,
  input: Readonly<{ requestId: string }>,
): Promise<RuntimeCompletionAuthorityProjectionV1> {
  if (!input.requestId || Buffer.byteLength(input.requestId, "utf8") > MAX_IDENTITY_BYTES_V1) {
    throw new Error("RUNTIME_COMPLETION_AUTHORITY_REQUEST_ID_INVALID");
  }
  const requestRows = await sql.unsafe<BoundedRequestRowV1[]>(
    `SELECT
       CASE WHEN octet_length(request_id) BETWEEN 1 AND $2 THEN request_id ELSE NULL END AS request_id,
       CASE WHEN octet_length(runtime_session_id) BETWEEN 1 AND $2 THEN runtime_session_id ELSE NULL END AS runtime_session_id,
       claim_id::text,
       CASE WHEN octet_length(run_id) BETWEEN 1 AND $2 THEN run_id ELSE NULL END AS run_id,
       CASE WHEN octet_length(step_db_id) BETWEEN 1 AND $2 THEN step_db_id ELSE NULL END AS step_db_id,
       CASE WHEN octet_length(workflow_step_id) BETWEEN 1 AND $2 THEN workflow_step_id ELSE NULL END AS workflow_step_id,
       CASE WHEN story_db_id IS NULL OR octet_length(story_db_id) BETWEEN 1 AND $2 THEN story_db_id ELSE NULL END AS story_db_id,
       CASE WHEN story_id IS NULL OR octet_length(story_id) BETWEEN 1 AND $2 THEN story_id ELSE NULL END AS story_id,
       CASE WHEN attempt_id IS NULL OR octet_length(attempt_id) BETWEEN 1 AND $2 THEN attempt_id ELSE NULL END AS attempt_id,
       CASE WHEN octet_length(claim_envelope::text) BETWEEN 1 AND $3 THEN claim_envelope ELSE NULL END AS claim_envelope,
       CASE WHEN octet_length(output) <= $3 THEN output ELSE NULL END AS output,
       CASE WHEN octet_length(output_hash) = $4 THEN output_hash ELSE NULL END AS output_hash,
       CASE WHEN source_proposal IS NULL OR octet_length(source_proposal) <= $3 THEN source_proposal ELSE NULL END AS source_proposal,
       CASE WHEN submission_evidence IS NULL OR octet_length(submission_evidence::text) <= $3 THEN submission_evidence ELSE NULL END AS submission_evidence,
       CASE WHEN octet_length(apply_phase) BETWEEN 1 AND $2 THEN apply_phase ELSE NULL END AS apply_phase,
       CASE WHEN claim_outcome IS NULL OR octet_length(claim_outcome) BETWEEN 1 AND $2 THEN claim_outcome ELSE NULL END AS claim_outcome,
       claim_committed_at, effects_committed_at,
       CASE WHEN completion_plan IS NULL OR octet_length(completion_plan::text) <= $3 THEN completion_plan ELSE NULL END AS completion_plan,
       CASE WHEN completion_plan_hash IS NULL OR octet_length(completion_plan_hash) = $4 THEN completion_plan_hash ELSE NULL END AS completion_plan_hash,
       prepared_at, owner_attempt_count,
       CASE WHEN octet_length(state) BETWEEN 1 AND $2 THEN state ELSE NULL END AS state,
       CASE WHEN octet_length(requested_by) BETWEEN 1 AND $2 THEN requested_by ELSE NULL END AS requested_by,
       CASE WHEN owner_instance_id IS NULL OR octet_length(owner_instance_id) BETWEEN 1 AND $2 THEN owner_instance_id ELSE NULL END AS owner_instance_id,
       lease_expires_at, requested_at, drained_at, processing_at, accepted_at, rejected_at,
       CASE WHEN diagnostic IS NULL OR octet_length(diagnostic) <= $3 THEN diagnostic ELSE NULL END AS diagnostic,
       CASE WHEN octet_length(result::text) <= $3 THEN result ELSE NULL END AS result,
       created_at, updated_at,
       ARRAY_REMOVE(ARRAY[
         CASE WHEN octet_length(request_id) NOT BETWEEN 1 AND $2 THEN 'request_id' END,
         CASE WHEN octet_length(runtime_session_id) NOT BETWEEN 1 AND $2 THEN 'runtime_session_id' END,
         CASE WHEN octet_length(run_id) NOT BETWEEN 1 AND $2 THEN 'run_id' END,
         CASE WHEN octet_length(step_db_id) NOT BETWEEN 1 AND $2 THEN 'step_db_id' END,
         CASE WHEN octet_length(workflow_step_id) NOT BETWEEN 1 AND $2 THEN 'workflow_step_id' END,
         CASE WHEN story_db_id IS NOT NULL AND octet_length(story_db_id) NOT BETWEEN 1 AND $2 THEN 'story_db_id' END,
         CASE WHEN story_id IS NOT NULL AND octet_length(story_id) NOT BETWEEN 1 AND $2 THEN 'story_id' END,
         CASE WHEN attempt_id IS NOT NULL AND octet_length(attempt_id) NOT BETWEEN 1 AND $2 THEN 'attempt_id' END,
         CASE WHEN octet_length(claim_envelope::text) NOT BETWEEN 1 AND $3 THEN 'claim_envelope' END,
         CASE WHEN octet_length(output) > $3 THEN 'output' END,
         CASE WHEN octet_length(output_hash) <> $4 THEN 'output_hash' END,
         CASE WHEN source_proposal IS NOT NULL AND octet_length(source_proposal) > $3 THEN 'source_proposal' END,
         CASE WHEN submission_evidence IS NOT NULL AND octet_length(submission_evidence::text) > $3 THEN 'submission_evidence' END,
         CASE WHEN octet_length(apply_phase) NOT BETWEEN 1 AND $2 THEN 'apply_phase' END,
         CASE WHEN claim_outcome IS NOT NULL AND octet_length(claim_outcome) NOT BETWEEN 1 AND $2 THEN 'claim_outcome' END,
         CASE WHEN completion_plan IS NOT NULL AND octet_length(completion_plan::text) > $3 THEN 'completion_plan' END,
         CASE WHEN completion_plan_hash IS NOT NULL AND octet_length(completion_plan_hash) <> $4 THEN 'completion_plan_hash' END,
         CASE WHEN octet_length(state) NOT BETWEEN 1 AND $2 THEN 'state' END,
         CASE WHEN octet_length(requested_by) NOT BETWEEN 1 AND $2 THEN 'requested_by' END,
         CASE WHEN owner_instance_id IS NOT NULL AND octet_length(owner_instance_id) NOT BETWEEN 1 AND $2 THEN 'owner_instance_id' END,
         CASE WHEN diagnostic IS NOT NULL AND octet_length(diagnostic) > $3 THEN 'diagnostic' END,
         CASE WHEN octet_length(result::text) > $3 THEN 'result' END
       ], NULL)::text[] AS oversized_fields
     FROM runtime_completion_requests
     WHERE request_id = $1
     LIMIT 1`,
    [input.requestId, MAX_IDENTITY_BYTES_V1, MAX_DOCUMENT_BYTES_V1, MAX_HASH_BYTES_V1],
  );
  const requestRow = requestRows[0];
  if (!requestRow) return Object.freeze({ effects: Object.freeze([]) });
  const requestOversized = oversizedFields(requestRow.oversized_fields);
  if (requestOversized.length > 0) {
    throw new Error(
      `RUNTIME_COMPLETION_AUTHORITY_REQUEST_FIELD_LIMIT_EXCEEDED:${requestOversized.join(",")}`,
    );
  }
  const request = mapRuntimeCompletionRequestRowV1(requestRow as RuntimeCompletionRow);

  const effectCensus = await sql.unsafe<Array<{
    effect_count: string;
    total_payload_bytes: string;
    total_result_bytes: string;
    total_evidence_bytes: string;
  }>>(
    `SELECT COUNT(*)::text AS effect_count,
            COALESCE(SUM(octet_length(payload::text)), 0)::text AS total_payload_bytes,
            COALESCE(SUM(octet_length(result::text)), 0)::text AS total_result_bytes,
            COALESCE(SUM(octet_length(evidence::text)), 0)::text AS total_evidence_bytes
       FROM runtime_completion_effects
      WHERE request_id = $1`,
    [input.requestId],
  );
  const census = effectCensus[0];
  const effectCount = Number(census?.effect_count);
  const effectTotals = {
    payload: Number(census?.total_payload_bytes),
    result: Number(census?.total_result_bytes),
    evidence: Number(census?.total_evidence_bytes),
  };
  if (!Number.isSafeInteger(effectCount) || effectCount < 0) {
    throw new Error("RUNTIME_COMPLETION_AUTHORITY_EFFECT_CENSUS_INVALID");
  }
  if (effectCount > MAX_EFFECTS_V1) {
    throw new Error("RUNTIME_COMPLETION_AUTHORITY_EFFECT_COUNT_LIMIT_EXCEEDED");
  }
  const oversizedEffectTotals = Object.entries(effectTotals)
    .filter(([, bytes]) => !Number.isSafeInteger(bytes)
      || bytes < 0
      || bytes > MAX_DOCUMENT_BYTES_V1)
    .map(([field]) => field);
  if (oversizedEffectTotals.length > 0) {
    throw new Error(
      `RUNTIME_COMPLETION_AUTHORITY_EFFECT_FIELD_LIMIT_EXCEEDED:${oversizedEffectTotals.join(",")}`,
    );
  }

  const effectRows = await sql.unsafe<BoundedEffectRowV1[]>(
    `SELECT
       CASE WHEN octet_length(request_id) BETWEEN 1 AND $3 THEN request_id ELSE NULL END AS request_id,
       CASE WHEN octet_length(effect_key) BETWEEN 1 AND $3 THEN effect_key ELSE NULL END AS effect_key,
       ordinal,
       CASE WHEN octet_length(effect_type) BETWEEN 1 AND $3 THEN effect_type ELSE NULL END AS effect_type,
       CASE WHEN octet_length(input_hash) = $4 THEN input_hash ELSE NULL END AS input_hash,
       CASE WHEN octet_length(payload::text) <= $5 THEN payload ELSE NULL END AS payload,
       mandatory,
       CASE WHEN octet_length(state) BETWEEN 1 AND $3 THEN state ELSE NULL END AS state,
       CASE WHEN owner_instance_id IS NULL OR octet_length(owner_instance_id) BETWEEN 1 AND $3 THEN owner_instance_id ELSE NULL END AS owner_instance_id,
       CASE WHEN lease_token IS NULL OR octet_length(lease_token) BETWEEN 1 AND $3 THEN lease_token ELSE NULL END AS lease_token,
       lease_expires_at, attempt_count,
       CASE WHEN octet_length(result::text) <= $5 THEN result ELSE NULL END AS result,
       CASE WHEN octet_length(evidence::text) <= $5 THEN evidence ELSE NULL END AS evidence,
       applied_at, reconciled_at, created_at, updated_at,
       ARRAY_REMOVE(ARRAY[
         CASE WHEN octet_length(request_id) NOT BETWEEN 1 AND $3 THEN 'request_id' END,
         CASE WHEN octet_length(effect_key) NOT BETWEEN 1 AND $3 THEN 'effect_key' END,
         CASE WHEN octet_length(effect_type) NOT BETWEEN 1 AND $3 THEN 'effect_type' END,
         CASE WHEN octet_length(input_hash) <> $4 THEN 'input_hash' END,
         CASE WHEN octet_length(payload::text) > $5 THEN 'payload' END,
         CASE WHEN octet_length(state) NOT BETWEEN 1 AND $3 THEN 'state' END,
         CASE WHEN owner_instance_id IS NOT NULL AND octet_length(owner_instance_id) NOT BETWEEN 1 AND $3 THEN 'owner_instance_id' END,
         CASE WHEN lease_token IS NOT NULL AND octet_length(lease_token) NOT BETWEEN 1 AND $3 THEN 'lease_token' END,
         CASE WHEN octet_length(result::text) > $5 THEN 'result' END,
         CASE WHEN octet_length(evidence::text) > $5 THEN 'evidence' END
       ], NULL)::text[] AS oversized_fields
       FROM runtime_completion_effects
      WHERE request_id = $1
        AND (
          SELECT COUNT(*) = $6::bigint
             AND COALESCE(SUM(octet_length(census.payload::text)), 0) = $7::bigint
             AND COALESCE(SUM(octet_length(census.result::text)), 0) = $8::bigint
             AND COALESCE(SUM(octet_length(census.evidence::text)), 0) = $9::bigint
            FROM runtime_completion_effects census
           WHERE census.request_id = $1
        )
      ORDER BY ordinal, effect_key
      LIMIT $2`,
    [
      input.requestId,
      MAX_EFFECTS_V1 + 1,
      MAX_IDENTITY_BYTES_V1,
      MAX_HASH_BYTES_V1,
      MAX_DOCUMENT_BYTES_V1,
      effectCount,
      effectTotals.payload,
      effectTotals.result,
      effectTotals.evidence,
    ],
  );
  if (effectRows.length !== effectCount) {
    throw new Error("RUNTIME_COMPLETION_AUTHORITY_EFFECT_CENSUS_DRIFT");
  }
  const effects = effectRows.map((row) => {
    const effectOversized = oversizedFields(row.oversized_fields);
    if (effectOversized.length > 0) {
      throw new Error(
        `RUNTIME_COMPLETION_AUTHORITY_EFFECT_FIELD_LIMIT_EXCEEDED:${effectOversized.join(",")}`,
      );
    }
    return mapRuntimeCompletionEffectRowV1(row as RuntimeCompletionEffectRow);
  });
  return Object.freeze({ request, effects: Object.freeze(effects) });
}
