import type postgres from "postgres";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  RuntimeCompletionEffectInputV1Schema,
  RuntimeCompletionPlanV1Schema,
  type RuntimeCompletionPlanV1,
} from "./schemas/runtime-completion-plan-v1.js";

const MAX_RUNTIME_COMPLETION_PLAN_BYTES_V1 = 4_000_000;
const MAX_RUNTIME_COMPLETION_EFFECT_PAYLOAD_BYTES_V1 = 4_000_000;
const MAX_RUNTIME_COMPLETION_EFFECTS_V1 = 128;

type ManifestEffectRowV1 = Readonly<{
  effect_key: string;
  ordinal: number;
  effect_type: string;
  input_hash: string;
  payload: unknown;
  mandatory: boolean;
  state: string;
}>;

export type RuntimeCompletionManifestAuthorityV1 = Readonly<{
  plan: RuntimeCompletionPlanV1;
  planHash: string;
  unsettledMandatoryEffects: number;
}>;

export async function assertRuntimeCompletionManifestInTransactionV1(
  sql: postgres.TransactionSql,
  input: Readonly<{
    requestId: string;
    requireSettledMandatoryEffects?: boolean;
  }>,
): Promise<RuntimeCompletionManifestAuthorityV1> {
  const requests = await sql.unsafe<Array<{
    request_id: string;
    claim_id: string;
    run_id: string;
    step_db_id: string;
    workflow_step_id: string;
    output_hash: string;
    completion_plan: unknown | null;
    completion_plan_hash: string | null;
    completion_plan_bytes: string;
  }>>(
    `SELECT request_id,
            claim_id::text AS claim_id,
            run_id,
            step_db_id,
            workflow_step_id,
            output_hash,
            CASE
              WHEN octet_length(completion_plan::text) <= $2 THEN completion_plan
              ELSE NULL
            END AS completion_plan,
            completion_plan_hash,
            octet_length(completion_plan::text)::text AS completion_plan_bytes
       FROM runtime_completion_requests
      WHERE request_id = $1
      FOR UPDATE`,
    [input.requestId, MAX_RUNTIME_COMPLETION_PLAN_BYTES_V1],
  );
  const request = requests[0];
  const planBytes = Number(request?.completion_plan_bytes ?? 0);
  if (!request
    || request.completion_plan === null
    || !request.completion_plan_hash
    || !Number.isSafeInteger(planBytes)
    || planBytes < 1
    || planBytes > MAX_RUNTIME_COMPLETION_PLAN_BYTES_V1) {
    throw new Error("RUNTIME_COMPLETION_MANIFEST_PLAN_INVALID");
  }
  const plan = RuntimeCompletionPlanV1Schema.parse(
    typeof request.completion_plan === "string"
      ? JSON.parse(request.completion_plan)
      : request.completion_plan,
  );
  if (hashCanonicalJson(plan) !== request.completion_plan_hash) {
    throw new Error("RUNTIME_COMPLETION_MANIFEST_PLAN_HASH_MISMATCH");
  }
  const claimId = Number(request.claim_id);
  if (request.request_id !== plan.requestId
    || !Number.isSafeInteger(claimId)
    || claimId !== plan.claimId
    || request.run_id !== plan.runId
    || request.step_db_id !== plan.stepDbId
    || request.workflow_step_id !== plan.workflowStepId
    || request.output_hash !== plan.outputHash) {
    throw new Error("RUNTIME_COMPLETION_MANIFEST_PLAN_CONTEXT_MISMATCH");
  }
  if (plan.effects.some((effect, index) => effect.ordinal !== index)) {
    throw new Error("RUNTIME_COMPLETION_MANIFEST_EFFECT_ORDER_INVALID");
  }

  const census = await sql.unsafe<Array<{
    effect_count: number;
    payload_bytes: string;
  }>>(
    `SELECT COUNT(*)::integer AS effect_count,
            COALESCE(SUM(octet_length(payload::text)), 0)::text AS payload_bytes
       FROM runtime_completion_effects
      WHERE request_id = $1`,
    [input.requestId],
  );
  const effectCount = census[0]?.effect_count ?? 0;
  const payloadBytes = Number(census[0]?.payload_bytes ?? 0);
  if (effectCount < 1
    || effectCount > MAX_RUNTIME_COMPLETION_EFFECTS_V1
    || effectCount !== plan.effects.length
    || !Number.isSafeInteger(payloadBytes)
    || payloadBytes < 1
    || payloadBytes > MAX_RUNTIME_COMPLETION_EFFECT_PAYLOAD_BYTES_V1) {
    throw new Error("RUNTIME_COMPLETION_MANIFEST_EFFECT_CENSUS_INVALID");
  }
  const effects = await sql.unsafe<ManifestEffectRowV1[]>(
    `SELECT effect_key, ordinal, effect_type, input_hash, payload, mandatory, state
       FROM runtime_completion_effects
      WHERE request_id = $1
      ORDER BY ordinal, effect_key
      LIMIT $2
      FOR UPDATE`,
    [input.requestId, MAX_RUNTIME_COMPLETION_EFFECTS_V1 + 1],
  );
  if (effects.length !== plan.effects.length) {
    throw new Error("RUNTIME_COMPLETION_MANIFEST_EFFECT_CENSUS_DRIFT");
  }
  let unsettledMandatoryEffects = 0;
  for (const [index, row] of effects.entries()) {
    const spec = plan.effects[index]!;
    const effectInput = RuntimeCompletionEffectInputV1Schema.parse(row.payload);
    if (row.effect_key !== spec.effectKey
      || row.ordinal !== spec.ordinal
      || row.effect_type !== spec.effectType
      || row.mandatory !== spec.mandatory
      || hashCanonicalJson(effectInput) !== row.input_hash
      || effectInput.planHash !== request.completion_plan_hash
      || hashCanonicalJson(effectInput.plan) !== effectInput.planHash
      || hashCanonicalJson(effectInput.plan) !== hashCanonicalJson(plan)
      || hashCanonicalJson(effectInput.effect) !== hashCanonicalJson(spec.payload)) {
      throw new Error("RUNTIME_COMPLETION_MANIFEST_EFFECT_BINDING_INVALID");
    }
    if (row.mandatory && !["applied", "reconciled"].includes(row.state)) {
      unsettledMandatoryEffects += 1;
    }
  }
  if (input.requireSettledMandatoryEffects && unsettledMandatoryEffects > 0) {
    throw new Error(
      `RUNTIME_COMPLETION_MANDATORY_EFFECTS_PENDING:${unsettledMandatoryEffects}`,
    );
  }
  return Object.freeze({
    plan,
    planHash: request.completion_plan_hash,
    unsettledMandatoryEffects,
  });
}
