import type postgres from "postgres";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  RuntimeCompletionEffectInputV1Schema,
  RuntimeCompletionPlanV1Schema,
  type RuntimeCompletionPlanV1,
} from "../execution/schemas/runtime-completion-plan-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v28-runtime-completion-manifest-authority:BEGIN
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION =
  "setfarm_guard_runtime_completion_plan_v1" as const;
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION =
  "setfarm_guard_runtime_completion_effect_manifest_v1" as const;
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION =
  "setfarm_assert_runtime_completion_manifest_complete_v1" as const;
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_TRIGGER =
  "trg_runtime_completion_plan_guard_v1" as const;
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_TRIGGER =
  "trg_runtime_completion_manifest_complete_v1" as const;
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_TRIGGER =
  "trg_runtime_completion_effect_manifest_guard_v1" as const;
export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_TRUNCATE_TRIGGER =
  "trg_runtime_completion_effect_manifest_no_truncate_v1" as const;

const MAX_PLAN_BYTES = 4_000_000;
const MAX_EFFECT_PAYLOAD_BYTES = 4_000_000;
const MAX_EFFECTS = 128;
const REQUEST_AUDIT_PAGE_SIZE = 64;

export type RuntimeCompletionManifestAuthorityMigrationErrorCode =
  | "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_PARTIAL"
  | "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_TOPOLOGY_INVALID"
  | "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID"
  | "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_SQL_FAILED";

export class RuntimeCompletionManifestAuthorityMigrationError extends Error {
  readonly code: RuntimeCompletionManifestAuthorityMigrationErrorCode;

  constructor(
    code: RuntimeCompletionManifestAuthorityMigrationErrorCode,
    message: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "RuntimeCompletionManifestAuthorityMigrationError";
    this.code = code;
  }
}

type MigrationErrorFactory = (
  code: RuntimeCompletionManifestAuthorityMigrationErrorCode,
  message: string,
  cause?: unknown,
) => Error;

let migrationErrorFactory: MigrationErrorFactory | undefined;

export function configureRuntimeCompletionManifestAuthorityMigrationErrorFactory(
  factory: MigrationErrorFactory,
): void {
  if (migrationErrorFactory && migrationErrorFactory !== factory) {
    throw new Error(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_MIGRATION_ERROR_FACTORY_ALREADY_BOUND",
    );
  }
  migrationErrorFactory = factory;
}

function migrationError(
  code: RuntimeCompletionManifestAuthorityMigrationErrorCode,
  message: string,
  cause?: unknown,
): Error {
  return migrationErrorFactory
    ? migrationErrorFactory(code, message, cause)
    : new RuntimeCompletionManifestAuthorityMigrationError(
      code,
      message,
      cause === undefined ? {} : { cause },
    );
}

export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION_BODY = `
  DECLARE
    bound_claim_id BIGINT;
    bound_prepared_at TIMESTAMPTZ;
  BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.completion_plan IS NOT NULL
       AND (
         OLD.completion_plan IS DISTINCT FROM NEW.completion_plan
         OR OLD.completion_plan_hash IS DISTINCT FROM NEW.completion_plan_hash
         OR OLD.prepared_at IS DISTINCT FROM NEW.prepared_at
       ) THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_PLAN_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.completion_plan IS NOT NULL
       AND (
         OLD.request_id IS DISTINCT FROM NEW.request_id
         OR OLD.runtime_session_id IS DISTINCT FROM NEW.runtime_session_id
         OR OLD.claim_id IS DISTINCT FROM NEW.claim_id
         OR OLD.run_id IS DISTINCT FROM NEW.run_id
         OR OLD.step_db_id IS DISTINCT FROM NEW.step_db_id
         OR OLD.workflow_step_id IS DISTINCT FROM NEW.workflow_step_id
         OR OLD.story_db_id IS DISTINCT FROM NEW.story_db_id
         OR OLD.story_id IS DISTINCT FROM NEW.story_id
         OR OLD.attempt_id IS DISTINCT FROM NEW.attempt_id
         OR OLD.claim_envelope IS DISTINCT FROM NEW.claim_envelope
         OR OLD.output IS DISTINCT FROM NEW.output
         OR OLD.output_hash IS DISTINCT FROM NEW.output_hash
       ) THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_PLAN_CONTEXT_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;

    IF NOT (
      (NEW.completion_plan IS NULL
       AND NEW.completion_plan_hash IS NULL
       AND NEW.prepared_at IS NULL)
      OR
      (NEW.completion_plan IS NOT NULL
       AND NEW.completion_plan_hash IS NOT NULL
       AND NEW.prepared_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_PLAN_PUBLICATION_INCOMPLETE'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.completion_plan IS NULL THEN
      RETURN NEW;
    END IF;

    IF jsonb_typeof(NEW.completion_plan) IS DISTINCT FROM 'object'
       OR octet_length(NEW.completion_plan::text) NOT BETWEEN 2 AND ${MAX_PLAN_BYTES}
       OR NOT NEW.completion_plan ?& ARRAY[
         'schema', 'planVersion', 'requestId', 'claimId', 'runId',
         'stepDbId', 'workflowStepId', 'outputHash', 'kind',
         'continuation', 'effects', 'preparedAt'
       ]
       OR (NEW.completion_plan - ARRAY[
         'schema', 'planVersion', 'requestId', 'claimId', 'runId',
         'stepDbId', 'workflowStepId', 'outputHash', 'kind',
         'continuation', 'subject', 'effects', 'preparedAt'
       ]::text[]) <> '{}'::jsonb
       OR NEW.completion_plan ->> 'schema'
            IS DISTINCT FROM 'setfarm.runtime-completion-plan.v1'
       OR NEW.completion_plan ->> 'planVersion' IS DISTINCT FROM '1'
       OR NEW.completion_plan ->> 'requestId' IS DISTINCT FROM NEW.request_id
       OR NEW.completion_plan ->> 'runId' IS DISTINCT FROM NEW.run_id
       OR NEW.completion_plan ->> 'stepDbId' IS DISTINCT FROM NEW.step_db_id
       OR NEW.completion_plan ->> 'workflowStepId'
            IS DISTINCT FROM NEW.workflow_step_id
       OR NEW.completion_plan ->> 'outputHash' IS DISTINCT FROM NEW.output_hash
       OR jsonb_typeof(NEW.completion_plan -> 'continuation')
            IS DISTINCT FROM 'object'
       OR jsonb_typeof(NEW.completion_plan -> 'effects') IS DISTINCT FROM 'array'
       OR jsonb_array_length(NEW.completion_plan -> 'effects')
            NOT BETWEEN 1 AND ${MAX_EFFECTS}
       OR EXISTS (
         SELECT 1
           FROM jsonb_array_elements(NEW.completion_plan -> 'effects')
                WITH ORDINALITY AS effect(value, position)
          WHERE jsonb_typeof(effect.value) IS DISTINCT FROM 'object'
             OR NOT effect.value ?& ARRAY[
               'effectKey', 'ordinal', 'effectType', 'mandatory', 'payload'
             ]
             OR (effect.value - ARRAY[
               'effectKey', 'ordinal', 'effectType', 'mandatory', 'payload'
             ]::text[]) <> '{}'::jsonb
             OR CASE
                  WHEN effect.value ->> 'ordinal' ~ '^(0|[1-9][0-9]*)$'
                  THEN (effect.value ->> 'ordinal')::bigint
                       IS DISTINCT FROM effect.position - 1
                  ELSE TRUE
                END
       )
       OR (
         SELECT COUNT(*) IS DISTINCT FROM COUNT(DISTINCT effect.value ->> 'effectKey')
           FROM jsonb_array_elements(NEW.completion_plan -> 'effects')
                AS effect(value)
       )
       OR NEW.state IS DISTINCT FROM 'processing'
       OR NEW.apply_phase NOT IN ('owner_committed', 'effects_committed')
       OR NEW.claim_outcome IS NULL
       OR NEW.claim_committed_at IS NULL
    THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_PLAN_BINDING_INVALID'
        USING ERRCODE = '23514';
    END IF;

    BEGIN
      bound_claim_id := (NEW.completion_plan ->> 'claimId')::bigint;
      bound_prepared_at := (NEW.completion_plan ->> 'preparedAt')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_PLAN_BINDING_INVALID'
        USING ERRCODE = '23514';
    END;
    IF bound_claim_id IS DISTINCT FROM NEW.claim_id
       OR bound_prepared_at IS DISTINCT FROM NEW.prepared_at THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_PLAN_BINDING_INVALID'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END;
`;

export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION_BODY = `
  DECLARE
    parent_plan JSONB;
    parent_plan_hash TEXT;
    parent_apply_phase TEXT;
    matching_specs INTEGER;
    matching_spec JSONB;
  BEGIN
    IF TG_OP = 'TRUNCATE' THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_EFFECT_TRUNCATE_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_EFFECT_DELETE_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.request_id IS DISTINCT FROM NEW.request_id
         OR OLD.effect_key IS DISTINCT FROM NEW.effect_key
         OR OLD.ordinal IS DISTINCT FROM NEW.ordinal
         OR OLD.effect_type IS DISTINCT FROM NEW.effect_type
         OR OLD.input_hash IS DISTINCT FROM NEW.input_hash
         OR OLD.payload IS DISTINCT FROM NEW.payload
         OR OLD.mandatory IS DISTINCT FROM NEW.mandatory
         OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
        RAISE EXCEPTION 'RUNTIME_COMPLETION_EFFECT_IDENTITY_IMMUTABLE'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END IF;

    SELECT completion_plan, completion_plan_hash, apply_phase
      INTO parent_plan, parent_plan_hash, parent_apply_phase
      FROM public.runtime_completion_requests
     WHERE request_id = NEW.request_id
     FOR KEY SHARE;
    IF NOT FOUND
       OR parent_plan IS NULL
       OR parent_plan_hash IS NULL
       OR parent_apply_phase NOT IN ('owner_committed', 'effects_committed')
       OR octet_length(parent_plan::text) NOT BETWEEN 2 AND ${MAX_PLAN_BYTES}
       OR jsonb_typeof(parent_plan -> 'effects') IS DISTINCT FROM 'array'
       OR jsonb_typeof(NEW.payload) IS DISTINCT FROM 'object'
       OR octet_length(NEW.payload::text) NOT BETWEEN 2 AND ${MAX_EFFECT_PAYLOAD_BYTES}
       OR NOT NEW.payload ?& ARRAY['schema', 'planHash', 'plan', 'effect']
       OR (NEW.payload - ARRAY['schema', 'planHash', 'plan', 'effect']::text[])
            <> '{}'::jsonb
       OR NEW.payload ->> 'schema'
            IS DISTINCT FROM 'setfarm.runtime-completion-effect-input.v1'
       OR NEW.payload ->> 'planHash' IS DISTINCT FROM parent_plan_hash
       OR NEW.payload -> 'plan' IS DISTINCT FROM parent_plan
       OR jsonb_typeof(NEW.payload -> 'effect') IS DISTINCT FROM 'object'
    THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_EFFECT_PARENT_BINDING_INVALID'
        USING ERRCODE = '23514';
    END IF;

    SELECT COUNT(*)::integer, (jsonb_agg(candidate.value) -> 0)
      INTO matching_specs, matching_spec
      FROM jsonb_array_elements(parent_plan -> 'effects') AS candidate(value)
     WHERE candidate.value ->> 'effectKey' = NEW.effect_key;
    IF matching_specs IS DISTINCT FROM 1
       OR jsonb_typeof(matching_spec) IS DISTINCT FROM 'object'
       OR NOT matching_spec ?& ARRAY[
         'effectKey', 'ordinal', 'effectType', 'mandatory', 'payload'
       ]
       OR (matching_spec - ARRAY[
         'effectKey', 'ordinal', 'effectType', 'mandatory', 'payload'
       ]::text[]) <> '{}'::jsonb
       OR matching_spec ->> 'ordinal' !~ '^(0|[1-9][0-9]*)$'
       OR (matching_spec ->> 'ordinal')::bigint IS DISTINCT FROM NEW.ordinal
       OR matching_spec ->> 'effectType' IS DISTINCT FROM NEW.effect_type
       OR jsonb_typeof(matching_spec -> 'mandatory') IS DISTINCT FROM 'boolean'
       OR (matching_spec ->> 'mandatory')::boolean IS DISTINCT FROM NEW.mandatory
       OR jsonb_typeof(matching_spec -> 'payload') IS DISTINCT FROM 'object'
       OR matching_spec -> 'payload' IS DISTINCT FROM NEW.payload -> 'effect'
    THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_EFFECT_MANIFEST_BINDING_INVALID'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END;
`;

export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION_BODY = `
  DECLARE
    effect_count INTEGER;
    effect_payload_bytes BIGINT;
  BEGIN
    IF NEW.completion_plan IS NULL THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.completion_plan IS NOT NULL THEN
      RETURN NEW;
    END IF;
    SELECT COUNT(*)::integer,
           COALESCE(SUM(octet_length(payload::text)), 0)::bigint
      INTO effect_count, effect_payload_bytes
      FROM public.runtime_completion_effects
     WHERE request_id = NEW.request_id;
    IF effect_count IS DISTINCT FROM jsonb_array_length(
         NEW.completion_plan -> 'effects'
       )
       OR effect_count NOT BETWEEN 1 AND ${MAX_EFFECTS}
       OR effect_payload_bytes NOT BETWEEN 2 AND ${MAX_EFFECT_PAYLOAD_BYTES}
    THEN
      RAISE EXCEPTION 'RUNTIME_COMPLETION_EFFECT_MANIFEST_INCOMPLETE'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END;
`;

export const RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_STATEMENTS = Object.freeze([
  `CREATE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION}()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION_BODY}$$`,
  `CREATE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION}()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION_BODY}$$`,
  `CREATE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION}()
   RETURNS trigger
   LANGUAGE plpgsql
   SET search_path TO pg_catalog, public
   AS $$${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION_BODY}$$`,
  `REVOKE ALL ON FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION}()
     FROM PUBLIC`,
  `REVOKE ALL ON FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION}()
     FROM PUBLIC`,
  `REVOKE ALL ON FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION}()
     FROM PUBLIC`,
  `CREATE TRIGGER ${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_TRIGGER}
     BEFORE INSERT OR UPDATE OF
       completion_plan, completion_plan_hash, prepared_at,
       request_id, runtime_session_id, claim_id, run_id, step_db_id,
       workflow_step_id, story_db_id, story_id, attempt_id,
       claim_envelope, output, output_hash
     ON public.runtime_completion_requests
     FOR EACH ROW
     EXECUTE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION}()`,
  `CREATE CONSTRAINT TRIGGER ${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_TRIGGER}
     AFTER INSERT OR UPDATE
     ON public.runtime_completion_requests
     DEFERRABLE INITIALLY DEFERRED
     FOR EACH ROW
     EXECUTE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION}()`,
  `CREATE TRIGGER ${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_TRIGGER}
     BEFORE INSERT OR UPDATE OR DELETE
     ON public.runtime_completion_effects
     FOR EACH ROW
     EXECUTE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION}()`,
  `CREATE TRIGGER ${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_TRUNCATE_TRIGGER}
     BEFORE TRUNCATE
     ON public.runtime_completion_effects
     FOR EACH STATEMENT
     EXECUTE FUNCTION public.${RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION}()`,
] as const);

function normalizeSql(value: string): string {
  return value.replace(/\s+/gu, " ").trim().toLowerCase();
}

async function objectCensus(sql: Sql | TransactionSql): Promise<Readonly<{
  functions: number;
  triggers: number;
}>> {
  const rows = await sql.unsafe<Array<{ functions: number; triggers: number }>>(
    `SELECT
       (SELECT COUNT(*)::integer
          FROM pg_proc routine
          JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
         WHERE namespace.nspname = 'public'
           AND routine.proname = ANY($1::text[])) AS functions,
       (SELECT COUNT(*)::integer
          FROM pg_trigger trigger
         WHERE NOT trigger.tgisinternal
           AND trigger.tgname = ANY($2::text[])) AS triggers`,
    [[
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION,
    ], [
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_TRIGGER,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_TRIGGER,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_TRIGGER,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_TRUNCATE_TRIGGER,
    ]],
  );
  return Object.freeze({
    functions: rows[0]?.functions ?? 0,
    triggers: rows[0]?.triggers ?? 0,
  });
}

export async function detectRuntimeCompletionManifestAuthorityV1(
  sql: Sql | TransactionSql,
): Promise<"absent" | "present" | "partial"> {
  const census = await objectCensus(sql);
  if (census.functions === 0 && census.triggers === 0) return "absent";
  if (census.functions === 3 && census.triggers === 4) return "present";
  return "partial";
}

type RequestAuditCensusRow = Readonly<{
  request_count: string;
}>;

type PlanAuditRow = Readonly<{
  request_id: string | null;
  request_id_bytes: string;
  claim_id: string;
  run_id: string | null;
  run_id_bytes: string;
  step_db_id: string | null;
  step_db_id_bytes: string;
  workflow_step_id: string | null;
  workflow_step_id_bytes: string;
  output_hash: string | null;
  output_hash_bytes: string;
  completion_plan_hash: string | null;
  completion_plan_hash_bytes: string | null;
  prepared_at: Date | string | null;
  plan_bytes: string;
  effect_count: number;
  effect_payload_bytes: string;
}>;

type PlanPayloadAuditRow = Readonly<{
  completion_plan: unknown;
}>;

type EffectAuditRow = Readonly<{
  effect_key: string;
  ordinal: number;
  effect_type: string;
  input_hash: string;
  payload: unknown;
  mandatory: boolean;
}>;

function parsedTimestamp(value: Date | string | null): string | undefined {
  if (value === null) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
}

function positiveClaimId(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePlan(value: unknown): RuntimeCompletionPlanV1 {
  return RuntimeCompletionPlanV1Schema.parse(
    typeof value === "string" ? JSON.parse(value) as unknown : value,
  );
}

export async function auditRuntimeCompletionManifestAuthorityV1Data(
  sql: Sql | TransactionSql,
): Promise<Readonly<{ requestCount: number; planCount: number; effectCount: number }>> {
  const censusRows = await sql.unsafe<RequestAuditCensusRow[]>(
    `SELECT COUNT(*)::text AS request_count
       FROM public.runtime_completion_requests`,
  );
  const requestCount = Number(censusRows[0]?.request_count);
  if (!Number.isSafeInteger(requestCount) || requestCount < 0) {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
      "runtime completion request census is unsafe",
    );
  }
  let auditedRequestCount = 0;
  let planCount = 0;
  let effectCount = 0;
  let requestCursor = "";
  while (true) {
    const rows = await sql.unsafe<PlanAuditRow[]>(
      `WITH request_page AS (
         SELECT request_id AS raw_request_id,
                CASE WHEN octet_length(request_id) BETWEEN 1 AND 164
                     THEN request_id END AS request_id,
                octet_length(request_id)::text AS request_id_bytes,
                claim_id,
                CASE WHEN octet_length(run_id) BETWEEN 1 AND 2000
                     THEN run_id END AS run_id,
                octet_length(run_id)::text AS run_id_bytes,
                CASE WHEN octet_length(step_db_id) BETWEEN 1 AND 2000
                     THEN step_db_id END AS step_db_id,
                octet_length(step_db_id)::text AS step_db_id_bytes,
                CASE WHEN octet_length(workflow_step_id) BETWEEN 1 AND 2000
                     THEN workflow_step_id END AS workflow_step_id,
                octet_length(workflow_step_id)::text AS workflow_step_id_bytes,
                CASE WHEN octet_length(output_hash) = 64
                     THEN output_hash END AS output_hash,
                octet_length(output_hash)::text AS output_hash_bytes,
                CASE WHEN completion_plan_hash IS NULL
                       OR octet_length(completion_plan_hash) = 64
                     THEN completion_plan_hash END AS completion_plan_hash,
                CASE WHEN completion_plan_hash IS NULL THEN NULL
                     ELSE octet_length(completion_plan_hash)::text
                END AS completion_plan_hash_bytes,
                prepared_at,
                COALESCE(octet_length(completion_plan::text), 0)::text AS plan_bytes
           FROM public.runtime_completion_requests
          WHERE request_id > $1
          ORDER BY request_id
          LIMIT $2
       )
       SELECT request.request_id,
              request.request_id_bytes,
              request.claim_id::text AS claim_id,
              request.run_id,
              request.run_id_bytes,
              request.step_db_id,
              request.step_db_id_bytes,
              request.workflow_step_id,
              request.workflow_step_id_bytes,
              request.output_hash,
              request.output_hash_bytes,
              request.completion_plan_hash,
              request.completion_plan_hash_bytes,
              request.prepared_at,
              request.plan_bytes,
              (SELECT COUNT(*)::integer
                 FROM public.runtime_completion_effects effect
                WHERE effect.request_id = request.raw_request_id) AS effect_count,
              (SELECT COALESCE(SUM(octet_length(effect.payload::text)), 0)::text
                 FROM public.runtime_completion_effects effect
                WHERE effect.request_id = request.raw_request_id)
                AS effect_payload_bytes
         FROM request_page request
        ORDER BY request.raw_request_id`,
      [requestCursor, REQUEST_AUDIT_PAGE_SIZE],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      const requestIdBytes = Number(row.request_id_bytes);
      const runIdBytes = Number(row.run_id_bytes);
      const stepDbIdBytes = Number(row.step_db_id_bytes);
      const workflowStepIdBytes = Number(row.workflow_step_id_bytes);
      const outputHashBytes = Number(row.output_hash_bytes);
      const completionPlanHashBytes = row.completion_plan_hash_bytes === null
        ? null
        : Number(row.completion_plan_hash_bytes);
      if (row.request_id === null
        || !/^RCR_[A-Za-z0-9-]{16,160}$/.test(row.request_id)
        || !Number.isSafeInteger(requestIdBytes)
        || requestIdBytes < 20
        || requestIdBytes > 164
        || row.run_id === null
        || row.run_id.length < 1
        || row.run_id.length > 500
        || !Number.isSafeInteger(runIdBytes)
        || runIdBytes < 1
        || runIdBytes > 2_000
        || row.step_db_id === null
        || row.step_db_id.length < 1
        || row.step_db_id.length > 500
        || !Number.isSafeInteger(stepDbIdBytes)
        || stepDbIdBytes < 1
        || stepDbIdBytes > 2_000
        || row.workflow_step_id === null
        || row.workflow_step_id.length < 1
        || row.workflow_step_id.length > 500
        || !Number.isSafeInteger(workflowStepIdBytes)
        || workflowStepIdBytes < 1
        || workflowStepIdBytes > 2_000
        || row.output_hash === null
        || !/^[a-f0-9]{64}$/.test(row.output_hash)
        || outputHashBytes !== 64
        || (completionPlanHashBytes === null
          ? row.completion_plan_hash !== null
          : row.completion_plan_hash === null
            || !/^[a-f0-9]{64}$/.test(row.completion_plan_hash)
            || completionPlanHashBytes !== 64)) {
        throw migrationError(
          "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
          "runtime completion request identity census is unsafe",
        );
      }
      auditedRequestCount += 1;
      requestCursor = row.request_id;
      const planBytes = Number(row.plan_bytes);
      const payloadBytes = Number(row.effect_payload_bytes);
      if (!Number.isSafeInteger(planBytes)
        || !Number.isSafeInteger(payloadBytes)
        || row.effect_count < 0
        || row.effect_count > MAX_EFFECTS
        || payloadBytes < 0
        || payloadBytes > MAX_EFFECT_PAYLOAD_BYTES) {
        throw migrationError(
          "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
          `runtime completion manifest census is unsafe: ${row.request_id}`,
        );
      }
      if (row.completion_plan_hash === null || row.prepared_at === null) {
        if (planBytes !== 0 || row.effect_count !== 0) {
          throw migrationError(
            "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
            `runtime completion null plan has effect or partial authority: ${row.request_id}`,
          );
        }
        continue;
      }
      if (planBytes < 2 || planBytes > MAX_PLAN_BYTES) {
        throw migrationError(
          "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
          `runtime completion plan exceeds its bounded authority: ${row.request_id}`,
        );
      }
      const planRows = await sql.unsafe<PlanPayloadAuditRow[]>(
        `SELECT completion_plan
           FROM public.runtime_completion_requests
          WHERE request_id = $1
            AND completion_plan IS NOT NULL
            AND octet_length(completion_plan::text) BETWEEN 2 AND $2
          LIMIT 1`,
        [row.request_id, MAX_PLAN_BYTES],
      );
      let plan: RuntimeCompletionPlanV1;
      try {
        if (!planRows[0]) throw new Error("bounded runtime completion plan is absent");
        plan = parsePlan(planRows[0].completion_plan);
      } catch (cause) {
        throw migrationError(
          "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
          `runtime completion plan schema is invalid: ${row.request_id}`,
          cause,
        );
      }
      const preparedAt = parsedTimestamp(row.prepared_at);
      if (hashCanonicalJson(plan) !== row.completion_plan_hash
        || plan.requestId !== row.request_id
        || plan.claimId !== positiveClaimId(row.claim_id)
        || plan.runId !== row.run_id
        || plan.stepDbId !== row.step_db_id
        || plan.workflowStepId !== row.workflow_step_id
        || plan.outputHash !== row.output_hash
        || plan.preparedAt !== preparedAt
        || plan.effects.some((effect, index) => effect.ordinal !== index)
        || row.effect_count !== plan.effects.length
        || payloadBytes < 2) {
        throw migrationError(
          "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
          `runtime completion plan does not bind its owner and manifest: ${row.request_id}`,
        );
      }
      const effects = await sql.unsafe<EffectAuditRow[]>(
        `SELECT effect_key, ordinal, effect_type, input_hash, payload, mandatory
           FROM public.runtime_completion_effects
          WHERE request_id = $1
          ORDER BY ordinal, effect_key
          LIMIT $2`,
        [row.request_id, MAX_EFFECTS + 1],
      );
      if (effects.length !== plan.effects.length) {
        throw migrationError(
          "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
          `runtime completion effect manifest census drifted: ${row.request_id}`,
        );
      }
      for (const [index, effect] of effects.entries()) {
        const spec = plan.effects[index]!;
        let effectInput;
        try {
          effectInput = RuntimeCompletionEffectInputV1Schema.parse(
            typeof effect.payload === "string"
              ? JSON.parse(effect.payload) as unknown
              : effect.payload,
          );
        } catch (cause) {
          throw migrationError(
            "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
            `runtime completion effect input is invalid: ${row.request_id}/${effect.effect_key}`,
            cause,
          );
        }
        if (effect.effect_key !== spec.effectKey
          || effect.ordinal !== spec.ordinal
          || effect.effect_type !== spec.effectType
          || effect.mandatory !== spec.mandatory
          || hashCanonicalJson(effectInput) !== effect.input_hash
          || effectInput.planHash !== row.completion_plan_hash
          || hashCanonicalJson(effectInput.plan) !== effectInput.planHash
          || hashCanonicalJson(effectInput.plan) !== hashCanonicalJson(plan)
          || hashCanonicalJson(effectInput.effect) !== hashCanonicalJson(spec.payload)) {
          throw migrationError(
            "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
            `runtime completion effect does not bind its plan: ${row.request_id}/${effect.effect_key}`,
          );
        }
      }
      planCount += 1;
      effectCount += effects.length;
    }
    if (rows.length < REQUEST_AUDIT_PAGE_SIZE) break;
  }
  if (auditedRequestCount !== requestCount) {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_DATA_INVALID",
      "runtime completion request census drifted during manifest audit",
    );
  }
  return Object.freeze({ requestCount, planCount, effectCount });
}

async function verifyFunctions(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    body: string;
    language: string;
    volatility: string;
    security_definer: boolean;
    configuration: string[] | null;
    public_execute: boolean;
    owner_exact: boolean;
    acl_exact: boolean;
  }>>(
    `WITH expected_owner AS (
       SELECT COALESCE(
         (
           SELECT journal.relowner
             FROM pg_class journal
             JOIN pg_namespace journal_namespace
               ON journal_namespace.oid = journal.relnamespace
            WHERE journal_namespace.nspname = 'public'
              AND journal.relname = 'setfarm_schema_migrations'
         ),
         (SELECT oid FROM pg_roles WHERE rolname = current_user)
       ) AS oid
     )
     SELECT routine.proname AS name,
            routine.prosrc AS body,
            language.lanname AS language,
            routine.provolatile AS volatility,
            routine.prosecdef AS security_definer,
            routine.proconfig AS configuration,
            has_function_privilege(
              'public', routine.oid, 'EXECUTE'
            ) AS public_execute,
            routine.proowner = expected_owner.oid AS owner_exact,
            (
              SELECT COUNT(*) = 1
                 AND COALESCE(BOOL_AND(
                   acl.grantor = routine.proowner
                   AND acl.grantee = routine.proowner
                   AND acl.privilege_type = 'EXECUTE'
                   AND NOT acl.is_grantable
                 ), FALSE)
                FROM aclexplode(COALESCE(
                  routine.proacl,
                  acldefault('f', routine.proowner)
                )) acl
            ) AS acl_exact
       FROM pg_proc routine
       JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
       JOIN pg_language language ON language.oid = routine.prolang
       CROSS JOIN expected_owner
      WHERE namespace.nspname = 'public'
        AND routine.proname = ANY($1::text[])
      ORDER BY routine.proname`,
    [[
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION,
    ]],
  );
  const expectedBodies = new Map<string, string>([
    [
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION_BODY,
    ],
    [
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION_BODY,
    ],
    [
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION,
      RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION_BODY,
    ],
  ]);
  if (rows.length !== expectedBodies.size) {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_TOPOLOGY_INVALID",
      "runtime completion manifest authority function census mismatch",
    );
  }
  for (const row of rows) {
    if (normalizeSql(row.body) !== normalizeSql(expectedBodies.get(row.name) ?? "")
      || row.language !== "plpgsql"
      || row.volatility !== "v"
      || row.security_definer
      || JSON.stringify(row.configuration) !== JSON.stringify([
        "search_path=pg_catalog, public",
      ])
      || row.public_execute
      || !row.owner_exact
      || !row.acl_exact) {
      throw migrationError(
        "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_TOPOLOGY_INVALID",
        `runtime completion manifest authority function mismatch: ${row.name}`,
      );
    }
  }
}

async function verifyGuardedTableOwnershipAndPrivileges(
  sql: Sql | TransactionSql,
): Promise<void> {
  const rows = await sql.unsafe<Array<{
    relation_name: string;
    owner_exact: boolean;
    acl_exact: boolean;
    column_acl_exact: boolean;
    relation_shape_exact: boolean;
    no_inheritance: boolean;
    no_row_policies: boolean;
    no_rewrite_rules: boolean;
  }>>(
    `WITH expected_owner AS (
       SELECT COALESCE(
         (
           SELECT journal.relowner
             FROM pg_class journal
             JOIN pg_namespace journal_namespace
               ON journal_namespace.oid = journal.relnamespace
            WHERE journal_namespace.nspname = 'public'
              AND journal.relname = 'setfarm_schema_migrations'
         ),
         (SELECT oid FROM pg_roles WHERE rolname = current_user)
       ) AS oid
     )
     SELECT relation.relname AS relation_name,
            relation.relowner = expected_owner.oid AS owner_exact,
            NOT EXISTS (
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(
                    relation.relacl,
                    acldefault('r', relation.relowner)
                  ))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', relation.relowner))
              )
              UNION ALL
              (
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(acldefault('r', relation.relowner))
                EXCEPT
                SELECT grantor, grantee, privilege_type, is_grantable
                  FROM aclexplode(COALESCE(
                    relation.relacl,
                    acldefault('r', relation.relowner)
                  ))
              )
            ) AS acl_exact,
            NOT EXISTS (
              SELECT 1
                FROM pg_attribute attribute
               WHERE attribute.attrelid = relation.oid
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND attribute.attacl IS NOT NULL
            ) AS column_acl_exact,
            relation.relkind = 'r'
              AND relation.relpersistence = 'p'
              AND NOT relation.relispartition
              AND NOT relation.relrowsecurity
              AND NOT relation.relforcerowsecurity
              AS relation_shape_exact,
            NOT EXISTS (
              SELECT 1
                FROM pg_inherits inheritance
               WHERE inheritance.inhrelid = relation.oid
                  OR inheritance.inhparent = relation.oid
            ) AS no_inheritance,
            NOT EXISTS (
              SELECT 1
                FROM pg_policy policy
               WHERE policy.polrelid = relation.oid
            ) AS no_row_policies,
            NOT EXISTS (
              SELECT 1
                FROM pg_rewrite rewrite
               WHERE rewrite.ev_class = relation.oid
            ) AS no_rewrite_rules
       FROM pg_class relation
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
       CROSS JOIN expected_owner
      WHERE namespace.nspname = 'public'
        AND relation.relname = ANY($1::text[])
      ORDER BY relation.relname`,
    [["runtime_completion_effects", "runtime_completion_requests"]],
  );
  if (rows.length !== 2
    || rows.some((row) => !row.owner_exact
      || !row.acl_exact
      || !row.column_acl_exact
      || !row.relation_shape_exact
      || !row.no_inheritance
      || !row.no_row_policies
      || !row.no_rewrite_rules)) {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_TOPOLOGY_INVALID",
      "runtime completion manifest authority guarded table owner or ACL mismatch",
    );
  }
}

async function verifyTriggers(sql: Sql | TransactionSql): Promise<void> {
  const rows = await sql.unsafe<Array<{
    name: string;
    enabled: string;
    type_bits: number;
    function_name: string;
    function_schema: string;
    function_arguments: string;
    relation_name: string;
    deferrable: boolean;
    initially_deferred: boolean;
    update_columns: string[];
    has_when_clause: boolean;
  }>>(
    `SELECT trigger.tgname AS name,
            trigger.tgenabled AS enabled,
            trigger.tgtype::integer AS type_bits,
            routine.proname AS function_name,
            routine_namespace.nspname AS function_schema,
            pg_get_function_identity_arguments(routine.oid) AS function_arguments,
            relation.relname AS relation_name,
            trigger.tgdeferrable AS deferrable,
            trigger.tginitdeferred AS initially_deferred,
            trigger.tgqual IS NOT NULL AS has_when_clause,
            COALESCE((
              SELECT ARRAY_AGG(attribute.attname ORDER BY attribute.attname)
                FROM unnest(trigger.tgattr::smallint[]) AS column_number(attnum)
                JOIN pg_attribute attribute
                  ON attribute.attrelid = trigger.tgrelid
                 AND attribute.attnum = column_number.attnum
            ), ARRAY[]::text[]) AS update_columns
       FROM pg_trigger trigger
       JOIN pg_proc routine ON routine.oid = trigger.tgfoid
       JOIN pg_namespace routine_namespace
         ON routine_namespace.oid = routine.pronamespace
       JOIN pg_class relation ON relation.oid = trigger.tgrelid
       JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND NOT trigger.tgisinternal
        AND (
          relation.relname = ANY($1::text[])
          OR trigger.tgname = ANY($2::text[])
          OR routine.proname = ANY($3::text[])
        )
      ORDER BY trigger.tgname`,
    [
      ["runtime_completion_effects", "runtime_completion_requests"],
      [
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_TRIGGER,
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_TRIGGER,
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_TRIGGER,
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_TRUNCATE_TRIGGER,
      ],
      [
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION,
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION,
        RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION,
      ],
    ],
  );
  const expected = new Map<string, Readonly<{
    bits: number;
    functionName: string;
    relation: string;
    deferrable: boolean;
    updateColumns?: readonly string[];
  }>>([
    ["trg_runtime_completion_submission_validate", {
      bits: 23,
      functionName: "setfarm_validate_runtime_completion_submission",
      relation: "runtime_completion_requests",
      deferrable: false,
      updateColumns: Object.freeze([
        "claim_envelope",
        "output",
        "output_hash",
        "source_proposal",
        "submission_evidence",
        "workflow_step_id",
      ]),
    }],
    ["trg_runtime_completion_submission_evidence_immutable", {
      bits: 19,
      functionName: "setfarm_forbid_runtime_completion_submission_update",
      relation: "runtime_completion_requests",
      deferrable: false,
      updateColumns: Object.freeze([
        "output",
        "output_hash",
        "source_proposal",
        "submission_evidence",
      ]),
    }],
    [RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_TRIGGER, {
      bits: 23,
      functionName: RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_PLAN_FUNCTION,
      relation: "runtime_completion_requests",
      deferrable: false,
      updateColumns: Object.freeze([
        "attempt_id",
        "claim_envelope",
        "claim_id",
        "completion_plan",
        "completion_plan_hash",
        "output",
        "output_hash",
        "prepared_at",
        "request_id",
        "run_id",
        "runtime_session_id",
        "step_db_id",
        "story_db_id",
        "story_id",
        "workflow_step_id",
      ]),
    }],
    [RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_TRIGGER, {
      bits: 21,
      functionName: RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_COMPLETENESS_FUNCTION,
      relation: "runtime_completion_requests",
      deferrable: true,
    }],
    [RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_TRIGGER, {
      bits: 31,
      functionName: RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION,
      relation: "runtime_completion_effects",
      deferrable: false,
    }],
    [RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_TRUNCATE_TRIGGER, {
      bits: 34,
      functionName: RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_EFFECT_FUNCTION,
      relation: "runtime_completion_effects",
      deferrable: false,
    }],
  ]);
  if (rows.length !== expected.size) {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_TOPOLOGY_INVALID",
      "runtime completion manifest authority trigger census mismatch",
    );
  }
  for (const row of rows) {
    const shape = expected.get(row.name);
    if (!shape
      || row.enabled !== "O"
      || row.type_bits !== shape.bits
      || row.function_name !== shape.functionName
      || row.function_schema !== "public"
      || row.function_arguments !== ""
      || row.relation_name !== shape.relation
      || row.deferrable !== shape.deferrable
      || row.initially_deferred !== shape.deferrable
      || row.has_when_clause
      || JSON.stringify(row.update_columns)
        !== JSON.stringify(shape.updateColumns ?? [])) {
      throw migrationError(
        "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_TOPOLOGY_INVALID",
        `runtime completion manifest authority trigger mismatch: ${row.name}`,
      );
    }
  }
}

export async function verifyRuntimeCompletionManifestAuthorityV1(
  sql: Sql | TransactionSql,
): Promise<void> {
  if (await detectRuntimeCompletionManifestAuthorityV1(sql) !== "present") {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_PARTIAL",
      "runtime completion manifest authority is not fully installed",
    );
  }
  await verifyGuardedTableOwnershipAndPrivileges(sql);
  await verifyFunctions(sql);
  await verifyTriggers(sql);
  await auditRuntimeCompletionManifestAuthorityV1Data(sql);
}

async function lockAuthorityTables(sql: TransactionSql): Promise<void> {
  await sql.unsafe(
    "LOCK TABLE public.runtime_completion_requests IN SHARE ROW EXCLUSIVE MODE",
  );
  await sql.unsafe(
    "LOCK TABLE public.runtime_completion_effects IN SHARE ROW EXCLUSIVE MODE",
  );
}

export async function applyRuntimeCompletionManifestAuthorityV1(
  sql: TransactionSql,
): Promise<"created" | "adopted"> {
  await lockAuthorityTables(sql);
  const state = await detectRuntimeCompletionManifestAuthorityV1(sql);
  if (state === "partial") {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_PARTIAL",
      "runtime completion manifest authority is partially installed",
    );
  }
  if (state === "present") {
    await verifyRuntimeCompletionManifestAuthorityV1(sql);
    return "adopted";
  }
  await auditRuntimeCompletionManifestAuthorityV1Data(sql);
  try {
    for (const statement of RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_STATEMENTS) {
      await sql.unsafe(statement);
    }
  } catch (cause) {
    throw migrationError(
      "RUNTIME_COMPLETION_MANIFEST_AUTHORITY_SQL_FAILED",
      "runtime completion manifest authority installation failed",
      cause,
    );
  }
  await verifyRuntimeCompletionManifestAuthorityV1(sql);
  return "created";
}
// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v28-runtime-completion-manifest-authority:END
