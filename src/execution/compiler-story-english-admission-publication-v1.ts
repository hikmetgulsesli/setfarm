import { createHash } from "node:crypto";

import type postgres from "postgres";

import {
  completeSingleStepClaimAndStateInTransaction,
  type CompleteSingleStepClaimAndStateInput,
  type CompletedSingleStepClaimTransitionResult,
} from "./claim-attempt-transition.js";
import {
  compilerStoryEnglishAdmissionContextProjectionV1,
  compilerStoryEnglishAdmissionStateV1,
  type CompilerStoryEnglishAdmissionAuthorityV1,
} from "../product-compiler/compiler-story-english-admission-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "./schemas/runtime-completion-plan-v1.js";
import {
  insertStoryPublicationRowsInTransactionV1,
  type StoryPublicationRowV1,
} from "../installer/story-ops.js";

type LockedRunV1 = Readonly<{
  protocol: string;
  status: string;
  context: string | null;
  context_code_units: string;
  task: string | null;
  task_bytes: string;
}>;

type LockedCompletionV1 = Readonly<{
  request_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  claim_id: number;
  story_id: string | null;
  story_db_id: string | null;
  attempt_id: string | null;
  output_hash: string;
  state: string;
  apply_phase: string;
}>;

const MAX_SOURCE_TASK_BYTES_V1 = 4_000_000;
const MAX_RUN_CONTEXT_CODE_UNITS_V1 = 16_000_000;

type StoredStoryRowV1 = Readonly<{
  story_index: number;
  story_id: string;
  title: string;
  description: string;
  acceptance_criteria: string;
  depends_on: string | null;
  scope_files: string | null;
  shared_files: string | null;
  scope_targets: string | null;
  requested_dependencies: string | null;
  shared_edit_requests: string | null;
  resolved_scope_files: string | null;
  scope_description: string | null;
  file_skeletons: string | null;
  implementation_contract: string | null;
}>;

function storedProjectionV1(row: StoredStoryRowV1): StoryPublicationRowV1 {
  return Object.freeze({
    storyIndex: row.story_index,
    storyId: row.story_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptance_criteria,
    dependsOn: row.depends_on,
    scopeFiles: row.scope_files,
    sharedFiles: row.shared_files,
    scopeTargets: row.scope_targets,
    requestedDependencies: row.requested_dependencies,
    sharedEditRequests: row.shared_edit_requests,
    resolvedScopeFiles: row.resolved_scope_files,
    scopeDescription: row.scope_description,
    fileSkeletons: row.file_skeletons,
    implementationContract: row.implementation_contract,
  });
}

function assertCompletionBindingV1(
  completion: CompleteSingleStepClaimAndStateInput,
  authority: CompilerStoryEnglishAdmissionAuthorityV1,
): void {
  const { receipt } = compilerStoryEnglishAdmissionStateV1(authority);
  const envelope = completion.envelope;
  if (envelope.protocol !== "v3"
    || envelope.runId !== receipt.runId
    || envelope.stepId !== receipt.stepDbId
    || envelope.workflowStepId !== "stories"
    || envelope.claimId !== receipt.claimId
    || envelope.storyId
    || envelope.storyDbId
    || envelope.attempt
    || completion.stepStatus !== "done"
    || createHash("sha256").update(completion.stepOutput, "utf8").digest("hex")
      !== receipt.canonicalProjectionHash
    || completion.runContextJson === undefined
    || completion.expectedRunContextJson === undefined
    || completion.requireRuntimeCompletionOwner !== true) {
    throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_COMPLETION_BINDING_INVALID");
  }
  const expectedPlan = createSingleEffectCompletionPlanDescriptorV1({
    kind: "single_completion",
    continuation: { type: "single_pipeline_advance" },
    effectPayload: {
      stepId: "stories",
      compilerStoryEnglishAdmissionReceipt: receipt,
    },
  });
  if (!completion.completionPlan
    || hashCanonicalJson(completion.completionPlan) !== hashCanonicalJson(expectedPlan)) {
    throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_EFFECT_BINDING_INVALID");
  }
  let context: unknown;
  try {
    context = JSON.parse(completion.runContextJson);
  } catch {
    throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_CONTEXT_INVALID");
  }
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_CONTEXT_INVALID");
  }
  const record = context as Record<string, unknown>;
  if (record["stories_english_authority_version"] !== receipt.authorityVersion
    || record["stories_english_admission_receipt_hash"] !== authority.receiptHash) {
    throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_CONTEXT_BINDING_INVALID");
  }
  if (hashCanonicalJson(compilerStoryEnglishAdmissionContextProjectionV1(record))
    !== receipt.admissionContextHash) {
    throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_CONTEXT_HASH_MISMATCH");
  }
}

export async function publishCompilerStoryEnglishAdmissionAndCompleteV1(
  sql: postgres.Sql,
  input: Readonly<{
    authority: CompilerStoryEnglishAdmissionAuthorityV1;
    completion: CompleteSingleStepClaimAndStateInput;
  }>,
): Promise<CompletedSingleStepClaimTransitionResult> {
  assertCompletionBindingV1(input.completion, input.authority);
  const state = compilerStoryEnglishAdmissionStateV1(input.authority);
  return sql.begin(async (transaction) => {
    const runs = await transaction.unsafe<LockedRunV1[]>(
      `SELECT protocol, status,
              CASE
                WHEN char_length(context) <= $3 THEN context
                ELSE NULL
              END AS context,
              char_length(context)::text AS context_code_units,
              CASE
                WHEN octet_length(task) BETWEEN 1 AND $2 THEN task
                ELSE NULL
              END AS task,
              octet_length(task)::text AS task_bytes
         FROM runs
        WHERE id = $1
        FOR UPDATE`,
      [
        state.receipt.runId,
        MAX_SOURCE_TASK_BYTES_V1,
        MAX_RUN_CONTEXT_CODE_UNITS_V1,
      ],
    );
    const run = runs[0];
    if (!run || run.protocol !== "v3" || !["running", "resuming"].includes(run.status)) {
      throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_RUN_INVALID");
    }
    if (run.context === null
      || Number(run.context_code_units) > MAX_RUN_CONTEXT_CODE_UNITS_V1
      || run.context !== input.completion.expectedRunContextJson) {
      throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_CONTEXT_CAS_LOST");
    }
    if (!run.task
      || Number(run.task_bytes) < 1
      || Number(run.task_bytes) > MAX_SOURCE_TASK_BYTES_V1
      || createHash("sha256").update(run.task, "utf8").digest("hex")
        !== state.receipt.sourceTaskHash) {
      throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_SOURCE_TASK_DRIFT");
    }

    await transaction.unsafe("DELETE FROM stories WHERE run_id = $1", [state.receipt.runId]);
    await insertStoryPublicationRowsInTransactionV1(transaction, state.receipt.runId, state.rows);
    const stored = await transaction.unsafe<StoredStoryRowV1[]>(
      `SELECT story_index, story_id, title, description, acceptance_criteria,
              depends_on, scope_files, shared_files, scope_targets,
              requested_dependencies, shared_edit_requests, resolved_scope_files,
              scope_description, file_skeletons, implementation_contract
         FROM stories
        WHERE run_id = $1
        ORDER BY story_index, story_id`,
      [state.receipt.runId],
    );
    const projection = stored.map(storedProjectionV1);
    if (projection.length !== state.receipt.storyCount
      || hashCanonicalJson(projection) !== state.receipt.orderedStoryRowsHash) {
      throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_ROW_BINDING_INVALID");
    }

    const result = await completeSingleStepClaimAndStateInTransaction(
      transaction,
      input.completion,
    );
    const completions = await transaction.unsafe<LockedCompletionV1[]>(
      `SELECT request_id, run_id, step_db_id, workflow_step_id,
              claim_id::integer, story_id, story_db_id, attempt_id,
              output_hash, state, apply_phase
         FROM runtime_completion_requests
        WHERE claim_id = $1
        FOR UPDATE`,
      [state.receipt.claimId],
    );
    const completion = completions[0];
    if (completions.length !== 1
      || !completion
      || completion.run_id !== state.receipt.runId
      || completion.step_db_id !== state.receipt.stepDbId
      || completion.workflow_step_id !== "stories"
      || completion.claim_id !== state.receipt.claimId
      || completion.story_id !== null
      || completion.story_db_id !== null
      || completion.attempt_id !== null
      || completion.output_hash !== state.receipt.canonicalProjectionHash
      || completion.state !== "processing"
      || completion.apply_phase !== "owner_committed") {
      throw new Error("COMPILER_STORY_ENGLISH_PUBLICATION_RUNTIME_COMPLETION_INVALID");
    }
    return result;
  }) as Promise<CompletedSingleStepClaimTransitionResult>;
}
