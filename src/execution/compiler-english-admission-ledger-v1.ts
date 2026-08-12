import { createHash } from "node:crypto";

import type postgres from "postgres";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../product-compiler/compiler-english-admission-v1.js";
import {
  CompilerEnglishAdmissionReceiptV1Schema,
  type CompilerEnglishAdmissionReceiptV1,
} from "../product-compiler/schemas/compiler-english-admission-receipt-v1.js";
import {
  ProductSpecV1EnglishWriteSchema,
  type ProductSpecV1,
} from "../product-compiler/schemas/product-spec-v1.js";
import {
  ProductSpecV2EnglishWriteSchema,
  type ProductSpecV2,
} from "../product-compiler/schemas/product-spec-v2.js";
import { loadRuntimeCompletionAuthorityProjectionV1 } from "./runtime-completion-authority-projection-v1.js";
import { validateRuntimeCompletionEffectInput } from "./runtime-completion-effect-runner.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "./schemas/runtime-completion-plan-v1.js";

const MAX_RUN_CONTEXT_CODE_UNITS_V1 = 16_000_000;
const MAX_SOURCE_TASK_BYTES_V1 = 4_000_000;
const MAX_COMPLETION_OUTPUT_BYTES_V1 = 4_000_000;
const MAX_COMPLETION_EFFECTS_V1 = 128;
type CompilerEnglishAdmissionLedgerStateV1 = Readonly<{
  receipt: CompilerEnglishAdmissionReceiptV1;
  designRequired: boolean;
}>;

const authorityStateV1 = new WeakMap<object, CompilerEnglishAdmissionLedgerStateV1>();

export type CompilerEnglishAdmissionLedgerAuthorityV1 = Readonly<{
  schema: "setfarm.compiler-english-admission-ledger-authority.v1";
  receiptHash: string;
}>;

type CandidateRowV1 = Readonly<{
  claim_id: number;
  request_id: string;
  step_db_id: string;
  run_task: string | null;
  run_task_bytes: string;
  run_context: string | null;
  run_context_code_units: string;
  step_status: string;
  step_output: string | null;
  step_output_bytes: string;
  completion_output_bytes: string;
  completion_plan_bytes: string;
}>;

function parseContextV1(serialized: string): Record<string, string> {
  if (serialized.length > MAX_RUN_CONTEXT_CODE_UNITS_V1) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_CONTEXT_LIMIT_EXCEEDED");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized);
  } catch {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_CONTEXT_INVALID");
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_CONTEXT_INVALID");
  }
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(decoded)) {
    if (typeof value !== "string") {
      throw new Error(`COMPILER_ENGLISH_ADMISSION_LEDGER_CONTEXT_VALUE_INVALID:${key}`);
    }
    context[key] = value;
  }
  return context;
}

function exactProductSpecFromPrdV1(
  prd: string,
  expectedSchema: string,
): ProductSpecV1 | ProductSpecV2 {
  const blockKind = expectedSchema === "setfarm.product-spec.v2"
    ? "product-spec-v2"
    : expectedSchema === "setfarm.product-spec.v1"
      ? "product-spec-v1"
      : undefined;
  if (!blockKind) throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_PRODUCT_SPEC_SCHEMA_INVALID");
  const fence = String.fromCharCode(96).repeat(3);
  const matches = [...prd.matchAll(new RegExp(
    `${fence}${blockKind}\\s*\\n([\\s\\S]*?)\\n${fence}`,
    "g",
  ))];
  if (matches.length !== 1) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_PRODUCT_SPEC_COUNT_INVALID");
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(matches[0]![1]!.trim());
  } catch {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_PRODUCT_SPEC_JSON_INVALID");
  }
  const productSpec = expectedSchema === "setfarm.product-spec.v2"
    ? ProductSpecV2EnglishWriteSchema.parse(candidate)
    : ProductSpecV1EnglishWriteSchema.parse(candidate);
  if (canonicalJsonStringify(productSpec) !== matches[0]![1]!.trim()) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_PRODUCT_SPEC_NON_CANONICAL");
  }
  return productSpec;
}

export async function loadCompilerEnglishAdmissionLedgerAuthorityInSnapshotV1(
  sql: postgres.Sql | postgres.TransactionSql,
  input: Readonly<{ runId: string }>,
): Promise<CompilerEnglishAdmissionLedgerAuthorityV1> {
  if (!input.runId || input.runId.length > 500) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_RUN_ID_INVALID");
  }
  const candidates = await sql.unsafe<CandidateRowV1[]>(
    `SELECT claim.id::integer AS claim_id,
            completion.request_id,
            plan.id AS step_db_id,
            CASE
              WHEN octet_length(run.task) BETWEEN 1 AND $2 THEN run.task
              ELSE NULL
            END AS run_task,
            octet_length(run.task)::text AS run_task_bytes,
            CASE
              WHEN char_length(run.context) <= $3 THEN run.context
              ELSE NULL
            END AS run_context,
            char_length(run.context)::text AS run_context_code_units,
            plan.status AS step_status,
            CASE
              WHEN octet_length(plan.output) <= $4 THEN plan.output
              ELSE NULL
            END AS step_output,
            octet_length(plan.output)::text AS step_output_bytes,
            octet_length(completion.output)::text AS completion_output_bytes,
            octet_length(completion.completion_plan::text)::text AS completion_plan_bytes
       FROM runs run
       JOIN steps plan
         ON plan.run_id = run.id
        AND plan.step_id = 'plan'
       JOIN claim_log claim
         ON claim.run_id = run.id
        AND claim.step_id = 'plan'
        AND claim.story_id IS NULL
       JOIN runtime_completion_requests completion
         ON completion.claim_id = claim.id
      WHERE run.id = $1
        AND run.protocol = 'v3'
        AND claim.outcome = 'completed'
        AND completion.state = 'accepted'
        AND completion.apply_phase = 'effects_committed'
      ORDER BY claim.id DESC
      LIMIT 2`,
    [
      input.runId,
      MAX_SOURCE_TASK_BYTES_V1,
      MAX_RUN_CONTEXT_CODE_UNITS_V1,
      MAX_COMPLETION_OUTPUT_BYTES_V1,
    ],
  );
  if (candidates.length !== 1) {
    throw new Error(`COMPILER_ENGLISH_ADMISSION_LEDGER_OWNER_COUNT_INVALID:${candidates.length}`);
  }
  const candidate = candidates[0]!;
  if (candidate.step_status !== "done"
    || candidate.run_context === null
    || candidate.step_output === null
    || Number(candidate.run_context_code_units) > MAX_RUN_CONTEXT_CODE_UNITS_V1
    || Number(candidate.step_output_bytes) > MAX_COMPLETION_OUTPUT_BYTES_V1
    || Number(candidate.completion_output_bytes) > MAX_COMPLETION_OUTPUT_BYTES_V1
    || Number(candidate.completion_plan_bytes) > MAX_COMPLETION_OUTPUT_BYTES_V1) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_PLAN_STATE_INVALID");
  }

  const completionAuthority = await loadRuntimeCompletionAuthorityProjectionV1(
    sql,
    { requestId: candidate.request_id },
  );
  const completion = completionAuthority.request;
  if (!completion
    || completion.claimId !== candidate.claim_id
    || completion.runId !== input.runId
    || completion.stepDbId !== candidate.step_db_id
    || completion.workflowStepId !== "plan"
    || completion.claimOutcome !== "completed"
    || completion.state !== "accepted"
    || completion.applyPhase !== "effects_committed"
    || completion.storyId
    || completion.storyDbId
    || completion.attemptId
    || !completion.completionPlan
    || !completion.completionPlanHash
    || hashCanonicalJson(completion.completionPlan) !== completion.completionPlanHash
    || completion.completionPlan.requestId !== completion.requestId
    || completion.completionPlan.claimId !== completion.claimId
    || completion.completionPlan.runId !== completion.runId
    || completion.completionPlan.stepDbId !== completion.stepDbId
    || completion.completionPlan.workflowStepId !== completion.workflowStepId
    || completion.completionPlan.outputHash !== completion.outputHash
    || !completion.preparedAt
    || completion.completionPlan.preparedAt !== completion.preparedAt
    || completion.output !== candidate.step_output
    || Buffer.byteLength(completion.output, "utf8") > MAX_COMPLETION_OUTPUT_BYTES_V1
    || createHash("sha256").update(completion.output, "utf8").digest("hex")
      !== completion.outputHash) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_COMPLETION_BINDING_INVALID");
  }

  const effects = completionAuthority.effects;
  if (effects.length < 1 || effects.length > MAX_COMPLETION_EFFECTS_V1) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_EFFECT_COUNT_INVALID");
  }
  if (effects.length !== completion.completionPlan.effects.length) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_EFFECT_CENSUS_DRIFT");
  }
  const receiptCandidates: CompilerEnglishAdmissionReceiptV1[] = [];
  for (const effect of effects) {
    const validated = validateRuntimeCompletionEffectInput(effect);
    if (validated.planHash !== completion.completionPlanHash) {
      throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_EFFECT_PLAN_BINDING_INVALID");
    }
    if (effect.mandatory && !["applied", "reconciled"].includes(effect.state)) {
      throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_EFFECT_STATE_INVALID");
    }
    const rawReceipt = validated.effect["compilerEnglishAdmissionReceipt"];
    if (rawReceipt === undefined) continue;
    if (!effect.mandatory || !["applied", "reconciled"].includes(effect.state)) {
      throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_EFFECT_STATE_INVALID");
    }
    receiptCandidates.push(CompilerEnglishAdmissionReceiptV1Schema.parse(rawReceipt));
  }
  if (receiptCandidates.length !== 1) {
    throw new Error(`COMPILER_ENGLISH_ADMISSION_LEDGER_RECEIPT_COUNT_INVALID:${receiptCandidates.length}`);
  }

  const durableReceipt = receiptCandidates[0]!;
  if (durableReceipt.claimId !== candidate.claim_id
    || durableReceipt.runId !== input.runId
    || durableReceipt.stepDbId !== candidate.step_db_id
    || durableReceipt.workflowStepId !== "plan") {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_RECEIPT_IDENTITY_INVALID");
  }
  const expectedDescriptor = createSingleEffectCompletionPlanDescriptorV1({
    kind: "single_completion",
    continuation: { type: "single_pipeline_advance" },
    effectPayload: {
      stepId: "plan",
      compilerEnglishAdmissionReceipt: durableReceipt,
    },
  });
  if (hashCanonicalJson({
    kind: completion.completionPlan.kind,
    continuation: completion.completionPlan.continuation,
    ...(completion.completionPlan.subject ? { subject: completion.completionPlan.subject } : {}),
    effects: completion.completionPlan.effects,
  }) !== hashCanonicalJson(expectedDescriptor)) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_COMPLETION_DESCRIPTOR_INVALID");
  }
  const context = parseContextV1(candidate.run_context);
  if (!candidate.run_task
    || Number(candidate.run_task_bytes) < 1
    || Number(candidate.run_task_bytes) > MAX_SOURCE_TASK_BYTES_V1
    || context["task"] !== candidate.run_task
    || createHash("sha256").update(candidate.run_task, "utf8").digest("hex")
      !== durableReceipt.sourceTaskHash) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_SOURCE_TASK_DRIFT");
  }
  const productSpec = exactProductSpecFromPrdV1(
    context["prd"] ?? "",
    context["product_spec_schema"] ?? "",
  );
  const recompiledAuthority = compileCompilerEnglishAdmissionV1({
    claimId: candidate.claim_id,
    runId: input.runId,
    stepDbId: candidate.step_db_id,
    workflowStepId: "plan",
    productSpec,
    finalContext: context,
  });
  const recompiledReceipt = compilerEnglishAdmissionReceiptV1(recompiledAuthority);
  const designRequired = productSpec.delivery?.designRequired;
  if (typeof designRequired !== "boolean") {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_DESIGN_REQUIREMENT_INVALID");
  }
  if (hashCanonicalJson(recompiledReceipt) !== hashCanonicalJson(durableReceipt)
    || context["plan_english_authority_version"] !== durableReceipt.authorityVersion
    || context["plan_english_admission_receipt_hash"] !== hashCanonicalJson(durableReceipt)) {
    throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_RECEIPT_DRIFT");
  }

  const authority = Object.freeze({
    schema: "setfarm.compiler-english-admission-ledger-authority.v1" as const,
    receiptHash: hashCanonicalJson(durableReceipt),
  });
  authorityStateV1.set(authority, Object.freeze({
    receipt: durableReceipt,
    designRequired,
  }));
  return authority;
}

export async function loadCompilerEnglishAdmissionLedgerAuthorityV1(
  sql: postgres.Sql,
  input: Readonly<{ runId: string }>,
): Promise<CompilerEnglishAdmissionLedgerAuthorityV1> {
  return sql.begin(async (transaction) => {
    await transaction.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return loadCompilerEnglishAdmissionLedgerAuthorityInSnapshotV1(transaction, input);
  }) as Promise<CompilerEnglishAdmissionLedgerAuthorityV1>;
}

export function inspectCompilerEnglishAdmissionLedgerAuthorityV1(
  authority: CompilerEnglishAdmissionLedgerAuthorityV1,
): CompilerEnglishAdmissionReceiptV1 {
  const state = authority && typeof authority === "object"
    ? authorityStateV1.get(authority)
    : undefined;
  if (!state) throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_AUTHORITY_UNAUTHENTICATED");
  return state.receipt;
}

export function compilerEnglishAdmissionLedgerDesignRequiredV1(
  authority: CompilerEnglishAdmissionLedgerAuthorityV1,
): boolean {
  const state = authority && typeof authority === "object"
    ? authorityStateV1.get(authority)
    : undefined;
  if (!state) throw new Error("COMPILER_ENGLISH_ADMISSION_LEDGER_AUTHORITY_UNAUTHENTICATED");
  return state.designRequired;
}
