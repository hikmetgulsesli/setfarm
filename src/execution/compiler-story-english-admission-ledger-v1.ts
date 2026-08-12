import { createHash } from "node:crypto";

import type postgres from "postgres";

import {
  compilerEnglishAdmissionLedgerDesignRequiredV1,
  inspectCompilerEnglishAdmissionLedgerAuthorityV1,
  loadCompilerEnglishAdmissionLedgerAuthorityInSnapshotV1,
} from "./compiler-english-admission-ledger-v1.js";
import { designAuthoritySubjectHashV1 } from "../installer/steps/03-stories/guards.js";
import { extractExplicitMaxStories } from "../installer/steps/03-stories/context.js";
import { buildV3AutoStoriesOutput } from "../installer/steps/03-stories/preclaim.js";
import {
  compileCompilerStoryEnglishAdmissionV1,
  compilerStoryEnglishAdmissionImmutableRowsV1,
  compilerStoryEnglishAdmissionStateV1,
} from "../product-compiler/compiler-story-english-admission-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  CompilerStoryEnglishAdmissionReceiptV1Schema,
  type CompilerStoryEnglishAdmissionReceiptV1,
} from "../product-compiler/schemas/compiler-story-english-admission-receipt-v1.js";
import { prepareV3DesignContractV2 } from "../product-compiler/v3-design-contract-v2.js";
import { loadRuntimeCompletionAuthorityProjectionV1 } from "./runtime-completion-authority-projection-v1.js";
import { validateRuntimeCompletionEffectInput } from "./runtime-completion-effect-runner.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "./schemas/runtime-completion-plan-v1.js";

const MAX_RUN_CONTEXT_CODE_UNITS_V1 = 16_000_000;
const MAX_COMPLETION_OUTPUT_BYTES_V1 = 4_000_000;
const MAX_COMPLETION_EFFECTS_V1 = 128;
const MAX_STORY_ADMISSION_ROWS_BYTES_V1 = 4_000_000;
const authorityStateV1 = new WeakMap<object, CompilerStoryEnglishAdmissionReceiptV1>();
const claimAuthorityStateV1 = new WeakMap<object, Readonly<{
  receipt: CompilerStoryEnglishAdmissionReceiptV1;
  subject: CompilerStoryEnglishAdmissionClaimSubjectV1;
}>>();

export type CompilerStoryEnglishAdmissionLedgerAuthorityV1 = Readonly<{
  schema: "setfarm.compiler-story-english-admission-ledger-authority.v1";
  receiptHash: string;
}>;

export type CompilerStoryEnglishAdmissionClaimProofV1 = Readonly<{
  schema: "setfarm.compiler-story-english-admission-claim-proof.v1";
  receiptHash: string;
  subjectHash: string;
}>;

export type CompilerStoryEnglishAdmissionClaimSubjectCandidateV1 =
  | Readonly<{ kind: "story_member"; storyDbId: string; storyId: string }>
  | Readonly<{ kind: "final_product" }>;

export type CompilerStoryEnglishAdmissionClaimSubjectV1 =
  | Readonly<{
      kind: "story_member";
      storyDbId: string;
      storyId: string;
      storyIndex: number;
      storyClaimGeneration: number;
      storyStatus: string;
    }>
  | Readonly<{ kind: "final_product" }>;

export type CompilerStoryEnglishAdmissionClaimAuthorityV1 = Readonly<{
  schema: "setfarm.compiler-story-english-admission-claim-authority.v1";
  receiptHash: string;
  subjectHash: string;
  subject: CompilerStoryEnglishAdmissionClaimSubjectV1;
}>;

type CandidateRowV1 = Readonly<{
  claim_id: number;
  request_id: string;
  step_db_id: string;
  run_context: string | null;
  run_context_code_units: string;
  step_status: string;
  step_output: string | null;
  step_output_bytes: string;
  completion_output_bytes: string;
  completion_plan_bytes: string;
}>;

type StoredImmutableStoryRowV1 = Readonly<{
  story_index: number;
  story_id: string;
  title: string | null;
  description: string | null;
  acceptance_criteria: string | null;
  depends_on: string | null;
  scope_targets: string | null;
  requested_dependencies: string | null;
  shared_edit_requests: string | null;
  scope_description: string | null;
  total_bytes: string;
}>;

function parseContextV1(serialized: string): Record<string, string> {
  if (serialized.length > MAX_RUN_CONTEXT_CODE_UNITS_V1) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CONTEXT_LIMIT_EXCEEDED");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(serialized);
  } catch {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CONTEXT_INVALID");
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CONTEXT_INVALID");
  }
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(decoded)) {
    if (typeof value !== "string") {
      throw new Error(`COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CONTEXT_VALUE_INVALID:${key}`);
    }
    context[key] = value;
  }
  return context;
}

export async function loadCompilerStoryEnglishAdmissionLedgerAuthorityInSnapshotV1(
  sql: postgres.Sql | postgres.TransactionSql,
  input: Readonly<{ runId: string }>,
): Promise<CompilerStoryEnglishAdmissionLedgerAuthorityV1> {
  if (!input.runId || input.runId.length > 500) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_RUN_ID_INVALID");
  }
  const candidates = await sql.unsafe<CandidateRowV1[]>(
    `SELECT claim.id::integer AS claim_id,
            completion.request_id,
            stories.id AS step_db_id,
            CASE
              WHEN char_length(run.context) <= $2 THEN run.context
              ELSE NULL
            END AS run_context,
            char_length(run.context)::text AS run_context_code_units,
            stories.status AS step_status,
            CASE
              WHEN octet_length(stories.output) <= $3 THEN stories.output
              ELSE NULL
            END AS step_output,
            octet_length(stories.output)::text AS step_output_bytes,
            octet_length(completion.output)::text AS completion_output_bytes,
            octet_length(completion.completion_plan::text)::text AS completion_plan_bytes
       FROM runs run
       JOIN steps stories
         ON stories.run_id = run.id
        AND stories.step_id = 'stories'
       JOIN claim_log claim
         ON claim.run_id = run.id
        AND claim.step_id = 'stories'
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
    [input.runId, MAX_RUN_CONTEXT_CODE_UNITS_V1, MAX_COMPLETION_OUTPUT_BYTES_V1],
  );
  if (candidates.length !== 1) {
    throw new Error(`COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_OWNER_COUNT_INVALID:${candidates.length}`);
  }
  const candidate = candidates[0]!;
  if (candidate.step_status !== "done"
    || candidate.run_context === null
    || candidate.step_output === null
    || Number(candidate.run_context_code_units) > MAX_RUN_CONTEXT_CODE_UNITS_V1
    || Number(candidate.step_output_bytes) > MAX_COMPLETION_OUTPUT_BYTES_V1
    || Number(candidate.completion_output_bytes) > MAX_COMPLETION_OUTPUT_BYTES_V1
    || Number(candidate.completion_plan_bytes) > MAX_COMPLETION_OUTPUT_BYTES_V1) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_STEP_STATE_INVALID");
  }

  const completionAuthority = await loadRuntimeCompletionAuthorityProjectionV1(
    sql,
    { requestId: candidate.request_id },
  );
  const completion = completionAuthority.request;
  const completionPlan = completion?.completionPlan;
  if (!completion
    || completion.claimId !== candidate.claim_id
    || completion.runId !== input.runId
    || completion.stepDbId !== candidate.step_db_id
    || completion.workflowStepId !== "stories"
    || completion.storyId
    || completion.storyDbId
    || completion.attemptId
    || completion.claimOutcome !== "completed"
    || completion.state !== "accepted"
    || completion.applyPhase !== "effects_committed"
    || !completionPlan
    || !completion.completionPlanHash
    || hashCanonicalJson(completionPlan) !== completion.completionPlanHash
    || completionPlan.requestId !== completion.requestId
    || completionPlan.claimId !== completion.claimId
    || completionPlan.runId !== completion.runId
    || completionPlan.stepDbId !== completion.stepDbId
    || completionPlan.workflowStepId !== completion.workflowStepId
    || completionPlan.outputHash !== completion.outputHash
    || !completion.preparedAt
    || completionPlan.preparedAt !== completion.preparedAt
    || candidate.step_output !== completion.output
    || Buffer.byteLength(completion.output, "utf8") > MAX_COMPLETION_OUTPUT_BYTES_V1
    || createHash("sha256").update(completion.output, "utf8").digest("hex")
      !== completion.outputHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_COMPLETION_BINDING_INVALID");
  }

  const effects = completionAuthority.effects;
  if (effects.length < 1 || effects.length > MAX_COMPLETION_EFFECTS_V1) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_EFFECT_COUNT_INVALID");
  }
  if (effects.length !== completionPlan.effects.length) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_EFFECT_CENSUS_DRIFT");
  }
  const receiptCandidates: CompilerStoryEnglishAdmissionReceiptV1[] = [];
  for (const effect of effects) {
    const validated = validateRuntimeCompletionEffectInput(effect);
    if (validated.planHash !== completion.completionPlanHash) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_EFFECT_PLAN_BINDING_INVALID");
    }
    if (effect.mandatory && !["applied", "reconciled"].includes(effect.state)) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_EFFECT_STATE_INVALID");
    }
    const rawReceipt = validated.effect["compilerStoryEnglishAdmissionReceipt"];
    if (rawReceipt === undefined) continue;
    if (!effect.mandatory) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_EFFECT_STATE_INVALID");
    }
    receiptCandidates.push(CompilerStoryEnglishAdmissionReceiptV1Schema.parse(rawReceipt));
  }
  if (receiptCandidates.length !== 1) {
    throw new Error(`COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_RECEIPT_COUNT_INVALID:${receiptCandidates.length}`);
  }
  const durableReceipt = receiptCandidates[0]!;
  if (durableReceipt.claimId !== candidate.claim_id
    || durableReceipt.runId !== input.runId
    || durableReceipt.stepDbId !== candidate.step_db_id
    || durableReceipt.workflowStepId !== "stories"
    || durableReceipt.canonicalProjectionHash !== completion.outputHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_RECEIPT_IDENTITY_INVALID");
  }
  const expectedDescriptor = createSingleEffectCompletionPlanDescriptorV1({
    kind: "single_completion",
    continuation: { type: "single_pipeline_advance" },
    effectPayload: {
      stepId: "stories",
      compilerStoryEnglishAdmissionReceipt: durableReceipt,
    },
  });
  if (hashCanonicalJson({
    kind: completionPlan.kind,
    continuation: completionPlan.continuation,
    ...(completionPlan.subject ? { subject: completionPlan.subject } : {}),
    effects: completionPlan.effects,
  }) !== hashCanonicalJson(expectedDescriptor)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_COMPLETION_DESCRIPTOR_INVALID");
  }

  const planAuthority = await loadCompilerEnglishAdmissionLedgerAuthorityInSnapshotV1(
    sql,
    { runId: input.runId },
  );
  const planReceipt = inspectCompilerEnglishAdmissionLedgerAuthorityV1(planAuthority);
  if (planAuthority.receiptHash !== durableReceipt.parentPlanReceiptHash
    || planReceipt.sourceTaskHash !== durableReceipt.sourceTaskHash
    || planReceipt.productSpecHash !== durableReceipt.productSpecHash
    || planReceipt.setupIdentityHash !== durableReceipt.setupIdentityHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_PLAN_BINDING_INVALID");
  }

  const context = parseContextV1(candidate.run_context);
  if (context["stories_english_authority_version"] !== durableReceipt.authorityVersion
    || context["stories_english_admission_receipt_hash"] !== hashCanonicalJson(durableReceipt)
    || context["plan_english_admission_receipt_hash"] !== durableReceipt.parentPlanReceiptHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CONTEXT_BINDING_INVALID");
  }
  let screenMap: unknown;
  try {
    screenMap = JSON.parse(context["screen_map"] ?? "");
  } catch {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_SCREEN_MAP_INVALID");
  }
  if (hashCanonicalJson(screenMap) !== durableReceipt.screenMapHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_SCREEN_MAP_DRIFT");
  }
  const designRequired = compilerEnglishAdmissionLedgerDesignRequiredV1(planAuthority);
  const designContract = designRequired
    ? prepareV3DesignContractV2(context["prd"] ?? context["PRD"] ?? "")
    : undefined;
  const expectedDesignAuthoritySubjectHash = await designAuthoritySubjectHashV1(
    sql,
    input.runId,
    context,
    planReceipt.productSpecHash,
    designRequired,
    designContract,
  );
  if (durableReceipt.designAuthoritySubjectHash !== expectedDesignAuthoritySubjectHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_DESIGN_AUTHORITY_DRIFT");
  }
  const expectedOutput = buildV3AutoStoriesOutput({
    repo: context["repo"] ?? context["REPO"] ?? "",
    prd: context["prd"] ?? context["PRD"] ?? "",
    expectedProductSpecHash: planReceipt.productSpecHash,
    maxStories: extractExplicitMaxStories([
      context["task"] ?? "",
      context["prd"] ?? context["PRD"] ?? "",
    ].join("\n")),
    productSemanticsVersion: context["product_semantics_version"],
  });
  if (completion.output !== expectedOutput) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CANONICAL_PROJECTION_DRIFT");
  }
  const recompiled = compileCompilerStoryEnglishAdmissionV1({
    claimId: candidate.claim_id,
    runId: input.runId,
    stepDbId: candidate.step_db_id,
    workflowStepId: "stories",
    planAuthority,
    designAuthoritySubjectHash: expectedDesignAuthoritySubjectHash,
    rawOutput: completion.output,
    expectedOutput,
    finalContext: context,
  });
  const recompiledState = compilerStoryEnglishAdmissionStateV1(recompiled);
  const recompiledReceipt = recompiledState.receipt;
  if (hashCanonicalJson(recompiledReceipt) !== hashCanonicalJson(durableReceipt)
    || recompiled.receiptHash !== hashCanonicalJson(durableReceipt)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_RECEIPT_DRIFT");
  }

  const expectedImmutableRows = compilerStoryEnglishAdmissionImmutableRowsV1(
    recompiledState.rows,
  );
  const storedImmutableRows = await sql.unsafe<StoredImmutableStoryRowV1[]>(
    `WITH canonical AS (
       SELECT story_index, story_id, title, description, acceptance_criteria,
              depends_on, scope_targets, requested_dependencies,
              shared_edit_requests, scope_description,
              SUM(
                octet_length(title)
                + octet_length(description)
                + octet_length(acceptance_criteria)
                + octet_length(COALESCE(depends_on, ''))
                + octet_length(COALESCE(scope_targets, ''))
                + octet_length(COALESCE(requested_dependencies, ''))
                + octet_length(COALESCE(shared_edit_requests, ''))
                + octet_length(COALESCE(scope_description, ''))
              ) OVER () AS total_bytes
         FROM stories
        WHERE run_id = $1
     )
     SELECT story_index, story_id,
            CASE WHEN total_bytes <= $3 THEN title ELSE NULL END AS title,
            CASE WHEN total_bytes <= $3 THEN description ELSE NULL END AS description,
            CASE WHEN total_bytes <= $3 THEN acceptance_criteria ELSE NULL END AS acceptance_criteria,
            CASE WHEN total_bytes <= $3 THEN depends_on ELSE NULL END AS depends_on,
            CASE WHEN total_bytes <= $3 THEN scope_targets ELSE NULL END AS scope_targets,
            CASE WHEN total_bytes <= $3 THEN requested_dependencies ELSE NULL END AS requested_dependencies,
            CASE WHEN total_bytes <= $3 THEN shared_edit_requests ELSE NULL END AS shared_edit_requests,
            CASE WHEN total_bytes <= $3 THEN scope_description ELSE NULL END AS scope_description,
            total_bytes::text
       FROM canonical
      ORDER BY story_index, story_id
      LIMIT $2`,
    [
      input.runId,
      expectedImmutableRows.length + 1,
      MAX_STORY_ADMISSION_ROWS_BYTES_V1,
    ],
  );
  const admittedBytes = Number(storedImmutableRows[0]?.total_bytes ?? 0);
  if (!Number.isSafeInteger(admittedBytes)
    || admittedBytes < 1
    || admittedBytes > MAX_STORY_ADMISSION_ROWS_BYTES_V1
    || storedImmutableRows.some((row) => row.title === null
      || row.description === null
      || row.acceptance_criteria === null)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_STORY_ROWS_LIMIT_EXCEEDED");
  }
  const currentImmutableRows = compilerStoryEnglishAdmissionImmutableRowsV1(
    storedImmutableRows.map((row) => ({
      storyIndex: row.story_index,
      storyId: row.story_id,
      title: row.title!,
      description: row.description!,
      dependsOn: row.depends_on,
      scopeTargets: row.scope_targets,
      requestedDependencies: row.requested_dependencies,
      sharedEditRequests: row.shared_edit_requests,
      scopeDescription: row.scope_description,
    })),
  );
  if (storedImmutableRows.length !== expectedImmutableRows.length
    || hashCanonicalJson(currentImmutableRows) !== hashCanonicalJson(expectedImmutableRows)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_IMMUTABLE_STORY_DRIFT");
  }
  for (const [index, storedRow] of storedImmutableRows.entries()) {
    if (storedRow.acceptance_criteria !== recompiledState.rows[index]!.acceptanceCriteria) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_CRITERIA_DRIFT");
    }
  }

  const authority = Object.freeze({
    schema: "setfarm.compiler-story-english-admission-ledger-authority.v1" as const,
    receiptHash: hashCanonicalJson(durableReceipt),
  });
  authorityStateV1.set(authority, durableReceipt);
  return authority;
}

export async function loadCompilerStoryEnglishAdmissionLedgerAuthorityV1(
  sql: postgres.Sql,
  input: Readonly<{ runId: string }>,
): Promise<CompilerStoryEnglishAdmissionLedgerAuthorityV1> {
  return sql.begin(async (transaction) => {
    await transaction.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    return loadCompilerStoryEnglishAdmissionLedgerAuthorityInSnapshotV1(transaction, input);
  }) as Promise<CompilerStoryEnglishAdmissionLedgerAuthorityV1>;
}

export function inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1(
  authority: CompilerStoryEnglishAdmissionLedgerAuthorityV1,
): CompilerStoryEnglishAdmissionReceiptV1 {
  const receipt = authority && typeof authority === "object"
    ? authorityStateV1.get(authority)
    : undefined;
  if (!receipt) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_AUTHORITY_UNAUTHENTICATED");
  }
  return receipt;
}

export function createCompilerStoryEnglishAdmissionClaimProofV1(
  authority: CompilerStoryEnglishAdmissionLedgerAuthorityV1,
): CompilerStoryEnglishAdmissionClaimProofV1 {
  const receipt = inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1(authority);
  return Object.freeze({
    schema: "setfarm.compiler-story-english-admission-claim-proof.v1" as const,
    receiptHash: authority.receiptHash,
    subjectHash: receipt.subjectHash,
  });
}

function parseCompilerStoryEnglishAdmissionClaimProofV1(
  value: unknown,
): CompilerStoryEnglishAdmissionClaimProofV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_PROOF_INVALID");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "receiptHash,schema,subjectHash"
    || record["schema"] !== "setfarm.compiler-story-english-admission-claim-proof.v1"
    || typeof record["receiptHash"] !== "string"
    || !/^[a-f0-9]{64}$/.test(record["receiptHash"])
    || typeof record["subjectHash"] !== "string"
    || !/^[a-f0-9]{64}$/.test(record["subjectHash"])) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_PROOF_INVALID");
  }
  return Object.freeze({
    schema: "setfarm.compiler-story-english-admission-claim-proof.v1" as const,
    receiptHash: record["receiptHash"],
    subjectHash: record["subjectHash"],
  });
}

/**
 * Revalidates one previously admitted STORY authority while its owning run is
 * locked by the caller. Locking the complete bounded canonical row set before
 * recomputation prevents immutable-row drift from crossing claim publication.
 */
export async function lockAndRevalidateCompilerStoryEnglishAdmissionForClaimV1(
  transaction: postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    proof: CompilerStoryEnglishAdmissionClaimProofV1;
    story?: Readonly<{ storyDbId: string; storyId: string }>;
  }>,
): Promise<CompilerStoryEnglishAdmissionLedgerAuthorityV1> {
  const proof = parseCompilerStoryEnglishAdmissionClaimProofV1(input.proof);
  if (!input.runId || input.runId.length > 500) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_LEDGER_RUN_ID_INVALID");
  }
  if (input.story
    && (!input.story.storyDbId
      || input.story.storyDbId.length > 500
      || !input.story.storyId
      || input.story.storyId.length > 500)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_STORY_IDENTITY_INVALID");
  }

  const lockedStories = await transaction.unsafe<Array<{
    id: string | null;
    story_id: string | null;
  }>>(
    `SELECT CASE WHEN octet_length(id) BETWEEN 1 AND 500 THEN id ELSE NULL END AS id,
            CASE WHEN octet_length(story_id) BETWEEN 1 AND 500 THEN story_id ELSE NULL END AS story_id
       FROM stories
      WHERE run_id = $1
      ORDER BY story_index, story_id, id
      LIMIT 101
      FOR UPDATE`,
    [input.runId],
  );
  if (lockedStories.some((story) => story.id === null || story.story_id === null)) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_STORY_IDENTITY_INVALID");
  }
  const authority = await loadCompilerStoryEnglishAdmissionLedgerAuthorityInSnapshotV1(
    transaction,
    { runId: input.runId },
  );
  const receipt = inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1(authority);
  if (authority.receiptHash !== proof.receiptHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_RECEIPT_HASH_MISMATCH");
  }
  if (receipt.subjectHash !== proof.subjectHash) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_SUBJECT_HASH_MISMATCH");
  }
  if (input.story
    && lockedStories.filter((story) => story.id === input.story!.storyDbId
      && story.story_id === input.story!.storyId).length !== 1) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_STORY_IDENTITY_MISMATCH");
  }
  return authority;
}

/**
 * Authenticates one typed publication subject from the complete locked STORY
 * set. The returned object is process-branded; binding publication can derive
 * receipt hashes and story indexes without accepting those values from a
 * caller.
 */
export async function lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1(
  transaction: postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    proof: CompilerStoryEnglishAdmissionClaimProofV1;
    subject: CompilerStoryEnglishAdmissionClaimSubjectCandidateV1;
  }>,
): Promise<CompilerStoryEnglishAdmissionClaimAuthorityV1> {
  const authority = await lockAndRevalidateCompilerStoryEnglishAdmissionForClaimV1(
    transaction,
    {
      runId: input.runId,
      proof: input.proof,
      ...(input.subject.kind === "story_member"
        ? { story: { storyDbId: input.subject.storyDbId, storyId: input.subject.storyId } }
        : {}),
    },
  );
  const receipt = inspectCompilerStoryEnglishAdmissionLedgerAuthorityV1(authority);
  let subject: CompilerStoryEnglishAdmissionClaimSubjectV1;
  if (input.subject.kind === "final_product") {
    subject = Object.freeze({ kind: "final_product" as const });
  } else {
    const rows = await transaction.unsafe<Array<{
      id: string;
      story_id: string;
      story_index: number;
      claim_generation: number;
      status: string;
    }>>(
      `SELECT id, story_id, story_index, claim_generation, status
         FROM stories
        WHERE run_id = $1 AND id = $2 AND story_id = $3
        FOR UPDATE`,
      [input.runId, input.subject.storyDbId, input.subject.storyId],
    );
    const row = rows[0];
    if (rows.length !== 1
      || !row
      || !Number.isSafeInteger(row.story_index)
      || row.story_index < 0
      || !Number.isSafeInteger(row.claim_generation)
      || row.claim_generation < 0) {
      throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_STORY_IDENTITY_MISMATCH");
    }
    subject = Object.freeze({
      kind: "story_member" as const,
      storyDbId: row.id,
      storyId: row.story_id,
      storyIndex: row.story_index,
      storyClaimGeneration: row.claim_generation,
      storyStatus: row.status,
    });
  }
  const result = Object.freeze({
    schema: "setfarm.compiler-story-english-admission-claim-authority.v1" as const,
    receiptHash: authority.receiptHash,
    subjectHash: receipt.subjectHash,
    subject,
  });
  claimAuthorityStateV1.set(result, { receipt, subject });
  return result;
}

export function inspectCompilerStoryEnglishAdmissionClaimAuthorityV1(
  authority: CompilerStoryEnglishAdmissionClaimAuthorityV1,
): Readonly<{
  receipt: CompilerStoryEnglishAdmissionReceiptV1;
  subject: CompilerStoryEnglishAdmissionClaimSubjectV1;
}> {
  const state = authority && typeof authority === "object"
    ? claimAuthorityStateV1.get(authority)
    : undefined;
  if (!state) {
    throw new Error("COMPILER_STORY_ENGLISH_ADMISSION_CLAIM_AUTHORITY_UNAUTHENTICATED");
  }
  return state;
}
