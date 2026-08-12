import type postgres from "postgres";

import {
  inspectCompilerStoryEnglishAdmissionClaimAuthorityV1,
  lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1,
  type CompilerStoryEnglishAdmissionClaimAuthorityV1,
  type CompilerStoryEnglishAdmissionClaimSubjectV1,
} from "./compiler-story-english-admission-ledger-v1.js";

export type V3StoryClaimRuntimeSubjectV1 =
  | Readonly<{
      kind: "story_member";
      storyDbId: string;
      storyId: string;
      storyIndex: number;
      storyClaimGeneration: number;
    }>
  | Readonly<{ kind: "final_product" }>;

type BindingIdentityRowV1 = Readonly<{
  claim_id: string | number;
  runtime_session_id: string;
  run_id: string;
  step_db_id: string;
  workflow_step_id: string;
  subject_kind: "story_member" | "final_product";
  story_db_id: string | null;
  story_id: string | null;
  story_index: number | null;
  story_claim_generation: number | null;
  story_admission_receipt_hash: string;
  story_admission_subject_hash: string;
}>;

type BindingRowV1 = BindingIdentityRowV1 & Readonly<{
  claim_run_id: string;
  claim_step_id: string;
  claim_story_id: string | null;
  claim_outcome: string | null;
  runtime_claim_id: string | number;
  runtime_run_id: string;
  runtime_step_db_id: string;
  runtime_workflow_step_id: string;
  runtime_story_db_id: string | null;
  runtime_story_id: string | null;
  step_run_id: string;
  step_workflow_step_id: string;
}>;

function publicSubject(
  subject: CompilerStoryEnglishAdmissionClaimSubjectV1,
): V3StoryClaimRuntimeSubjectV1 {
  return subject.kind === "final_product"
    ? Object.freeze({ kind: "final_product" as const })
    : Object.freeze({
        kind: "story_member" as const,
        storyDbId: subject.storyDbId,
        storyId: subject.storyId,
        storyIndex: subject.storyIndex,
        storyClaimGeneration: subject.storyClaimGeneration,
      });
}

async function lockAndAssertV3StoryClaimRuntimeSubjectEligibilityV1(
  transaction: postgres.TransactionSql,
  input: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: "implement" | "supervise";
    authority: CompilerStoryEnglishAdmissionClaimAuthorityV1;
  }>,
): Promise<CompilerStoryEnglishAdmissionClaimAuthorityV1> {
  const supplied = inspectCompilerStoryEnglishAdmissionClaimAuthorityV1(input.authority);
  const authority = await lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1(
    transaction,
    {
      runId: input.runId,
      proof: {
        schema: "setfarm.compiler-story-english-admission-claim-proof.v1",
        receiptHash: input.authority.receiptHash,
        subjectHash: input.authority.subjectHash,
      },
      subject: supplied.subject.kind === "final_product"
        ? { kind: "final_product" }
        : {
            kind: "story_member",
            storyDbId: supplied.subject.storyDbId,
            storyId: supplied.subject.storyId,
          },
    },
  );
  const state = inspectCompilerStoryEnglishAdmissionClaimAuthorityV1(authority);
  if (input.workflowStepId === "implement") {
    if (state.subject.kind !== "story_member"
      || state.subject.storyClaimGeneration < 1
      || state.subject.storyStatus !== "running") {
      throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_IMPLEMENT_SUBJECT_INVALID");
    }
    const implementRows = await transaction.unsafe<Array<{
      id: string;
      step_id: string;
      type: string;
      current_story_id: string | null;
    }>>(
      `SELECT id, step_id, type, current_story_id
         FROM steps
        WHERE run_id = $1 AND (id = $2 OR step_id = 'implement')
        ORDER BY step_index, id
        LIMIT 3
        FOR UPDATE`,
      [input.runId, input.stepDbId],
    );
    const exact = implementRows.filter((step) => step.id === input.stepDbId);
    const canonical = implementRows.filter((step) => step.step_id === "implement");
    if (exact.length !== 1
      || canonical.length !== 1
      || exact[0] !== canonical[0]
      || exact[0]!.type !== "loop"
      || exact[0]!.current_story_id !== state.subject.storyDbId) {
      throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_IMPLEMENT_WORKFLOW_INVALID");
    }
    return authority;
  }

  const steps = await transaction.unsafe<Array<{
    id: string;
    step_id: string;
    type: string;
    status: string;
    current_story_id: string | null;
    loop_config: string | null;
    loop_config_bytes: string;
  }>>(
    `SELECT id, step_id, type, status, current_story_id,
            CASE WHEN octet_length(COALESCE(loop_config, '{}')) <= 65536
              THEN loop_config ELSE NULL END AS loop_config,
            octet_length(COALESCE(loop_config, '{}'))::text AS loop_config_bytes
       FROM steps
      WHERE run_id = $1 AND (id = $2 OR step_id = 'implement')
      ORDER BY step_index, id
      LIMIT 3
      FOR UPDATE`,
    [input.runId, input.stepDbId],
  );
  const superviseRows = steps.filter((step) => step.id === input.stepDbId
    && step.step_id === "supervise");
  const implementRows = steps.filter((step) => step.step_id === "implement");
  const supervise = superviseRows[0];
  const implement = implementRows[0];
  if (superviseRows.length !== 1
    || implementRows.length !== 1
    || !supervise
    || !implement
    || supervise.type !== "single"
    || implement.type !== "loop") {
    throw new Error("V3_SUPERVISE_WORKFLOW_CONTRACT_INVALID");
  }
  const loopConfigBytes = Number(implement.loop_config_bytes);
  if (!Number.isSafeInteger(loopConfigBytes)
    || loopConfigBytes < 0
    || loopConfigBytes > 65_536
    || implement.loop_config === null) {
    throw new Error("V3_SUPERVISE_LOOP_CONFIG_LIMIT_EXCEEDED");
  }
  let loopConfig: unknown;
  try {
    loopConfig = JSON.parse(implement.loop_config);
  } catch {
    throw new Error("V3_SUPERVISE_LOOP_CONFIG_INVALID");
  }
  if (!loopConfig || typeof loopConfig !== "object" || Array.isArray(loopConfig)) {
    throw new Error("V3_SUPERVISE_LOOP_CONFIG_INVALID");
  }
  const config = loopConfig as Record<string, unknown>;
  if (config["superviseEach"] !== undefined && typeof config["superviseEach"] !== "boolean") {
    throw new Error("V3_SUPERVISE_LOOP_CONFIG_INVALID");
  }
  if (config["superviseStep"] !== undefined
    && (typeof config["superviseStep"] !== "string"
      || config["superviseStep"].length < 1
      || config["superviseStep"].length > 500)) {
    throw new Error("V3_SUPERVISE_LOOP_CONFIG_INVALID");
  }
  const superviseEach = config["superviseEach"] === true;
  const configuredStep = (config["superviseStep"] as string | undefined) ?? "supervise";
  if (configuredStep !== "supervise") {
    throw new Error("V3_SUPERVISE_WORKFLOW_CONTRACT_INVALID");
  }

  if (state.subject.kind === "story_member") {
    if (!superviseEach) throw new Error("V3_SUPERVISE_STORY_SCOPE_DISABLED");
    if (supervise.current_story_id !== state.subject.storyDbId
      || state.subject.storyStatus !== "done"
      || state.subject.storyClaimGeneration < 1) {
      throw new Error("V3_SUPERVISE_STORY_SUBJECT_NOT_ELIGIBLE");
    }
    const settled = await transaction.unsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::integer AS count
         FROM v3_story_claim_runtime_bindings_v1 binding
         JOIN claim_log claim
           ON claim.id = binding.claim_id
          AND claim.run_id = binding.run_id
          AND claim.step_id = binding.workflow_step_id
         JOIN runtime_sessions runtime
           ON runtime.session_id = binding.runtime_session_id
          AND runtime.claim_id = binding.claim_id
          AND runtime.run_id = binding.run_id
         JOIN runtime_completion_requests completion
           ON completion.claim_id = binding.claim_id
          AND completion.runtime_session_id = binding.runtime_session_id
          AND completion.run_id = binding.run_id
        WHERE binding.run_id = $1
          AND binding.workflow_step_id = 'supervise'
          AND binding.subject_kind = 'story_member'
          AND binding.story_db_id = $2
          AND binding.story_id = $3
          AND binding.story_index = $4
          AND binding.story_claim_generation = $5
          AND binding.story_admission_receipt_hash = $6
          AND binding.story_admission_subject_hash = $7
          AND claim.outcome = 'completed'
          AND runtime.state = 'released'
          AND completion.state = 'accepted'
          AND completion.apply_phase = 'effects_committed'
          AND completion.claim_outcome = 'completed'`,
      [
        input.runId,
        state.subject.storyDbId,
        state.subject.storyId,
        state.subject.storyIndex,
        state.subject.storyClaimGeneration,
        authority.receiptHash,
        authority.subjectHash,
      ],
    );
    if ((settled[0]?.count ?? 0) !== 0) {
      throw new Error("V3_SUPERVISE_STORY_SUBJECT_ALREADY_SETTLED");
    }
    return authority;
  }

  if (supervise.current_story_id !== null
    || implement.current_story_id !== null
    || implement.status !== "done") {
    throw new Error("V3_SUPERVISE_FINAL_PRODUCT_NOT_ELIGIBLE");
  }
  const storyCensus = await transaction.unsafe<Array<{ total: number; nonterminal: number }>>(
    `SELECT COUNT(*)::integer AS total,
            COUNT(*) FILTER (
              WHERE status IS NULL OR status NOT IN ('done', 'verified', 'skipped')
            )::integer AS nonterminal
       FROM stories
      WHERE run_id = $1`,
    [input.runId],
  );
  const total = storyCensus[0]?.total ?? 0;
  if (total < 1 || (storyCensus[0]?.nonterminal ?? 1) !== 0) {
    throw new Error("V3_SUPERVISE_FINAL_PRODUCT_STORY_CENSUS_INVALID");
  }
  if (!superviseEach) return authority;
  const unsettled = await transaction.unsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::integer AS count
       FROM stories story
      WHERE story.run_id = $1
        AND (
          story.status = 'skipped'
          OR (
            SELECT COUNT(*)
              FROM v3_story_claim_runtime_bindings_v1 binding
              JOIN claim_log claim
                ON claim.id = binding.claim_id
               AND claim.run_id = binding.run_id
               AND claim.step_id = binding.workflow_step_id
              JOIN runtime_sessions runtime
                ON runtime.session_id = binding.runtime_session_id
               AND runtime.claim_id = binding.claim_id
               AND runtime.run_id = binding.run_id
              JOIN runtime_completion_requests completion
                ON completion.claim_id = binding.claim_id
               AND completion.runtime_session_id = binding.runtime_session_id
               AND completion.run_id = binding.run_id
             WHERE binding.run_id = story.run_id
               AND binding.workflow_step_id = 'supervise'
               AND binding.subject_kind = 'story_member'
               AND binding.story_db_id = story.id
               AND binding.story_id = story.story_id
               AND binding.story_index = story.story_index
               AND binding.story_claim_generation = story.claim_generation
               AND binding.story_admission_receipt_hash = $2
               AND binding.story_admission_subject_hash = $3
               AND claim.outcome = 'completed'
               AND runtime.state = 'released'
               AND completion.state = 'accepted'
               AND completion.apply_phase = 'effects_committed'
               AND completion.claim_outcome = 'completed'
          ) <> 1
        )`,
    [input.runId, authority.receiptHash, authority.subjectHash],
  );
  if ((unsettled[0]?.count ?? total) !== 0) {
    throw new Error("V3_SUPERVISE_FINAL_PRODUCT_STORY_SUPERVISION_INCOMPLETE");
  }
  return authority;
}

export async function insertV3StoryClaimRuntimeBindingV1(
  transaction: postgres.TransactionSql,
  input: Readonly<{
    claimId: number;
    runtimeSessionId: string;
    runId: string;
    stepDbId: string;
    workflowStepId: "implement" | "supervise";
    authority: CompilerStoryEnglishAdmissionClaimAuthorityV1;
  }>,
): Promise<V3StoryClaimRuntimeSubjectV1> {
  const runs = await transaction.unsafe<Array<{ id: string }>>(
    "SELECT id FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  if (runs.length !== 1) throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_RUN_INVALID");
  const currentAuthority = await lockAndAssertV3StoryClaimRuntimeSubjectEligibilityV1(
    transaction,
    input,
  );
  const authenticated = inspectCompilerStoryEnglishAdmissionClaimAuthorityV1(currentAuthority);
  const subject = authenticated.subject;
  if (input.workflowStepId === "implement" && subject.kind !== "story_member") {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_IMPLEMENT_SUBJECT_INVALID");
  }
  const inserted = await transaction.unsafe<Array<{
    claim_id: string;
    subject_kind: "story_member" | "final_product";
    story_db_id: string | null;
    story_id: string | null;
    story_index: number | null;
    story_claim_generation: number | null;
  }>>(
    `INSERT INTO v3_story_claim_runtime_bindings_v1 (
       claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
       subject_kind, story_db_id, story_id, story_index, story_claim_generation,
       story_admission_receipt_hash, story_admission_subject_hash, bound_at
     )
     SELECT claim.id, runtime.session_id, claim.run_id, step.id, claim.step_id,
            $6,
            CASE WHEN $6 = 'story_member' THEN story.id ELSE NULL END,
            CASE WHEN $6 = 'story_member' THEN story.story_id ELSE NULL END,
            CASE WHEN $6 = 'story_member' THEN story.story_index ELSE NULL END,
            CASE WHEN $6 = 'story_member' THEN story.claim_generation ELSE NULL END,
            $9, $10, claim.claimed_at
       FROM claim_log claim
       JOIN runtime_sessions runtime
         ON runtime.session_id = $2
        AND runtime.claim_id = claim.id
        AND runtime.run_id = claim.run_id
       JOIN steps step
         ON step.id = $4
        AND step.run_id = claim.run_id
        AND step.step_id = claim.step_id
       LEFT JOIN stories story
         ON $6 = 'story_member'
        AND story.id = $7
        AND story.run_id = claim.run_id
        AND story.story_id = $8
      WHERE claim.id = $1
        AND claim.run_id = $3
        AND claim.step_id = $5
        AND claim.outcome IS NULL
        AND (
          ($5 = 'implement'
            AND claim.story_id = $8
            AND runtime.story_db_id = $7
            AND runtime.story_id = $8)
          OR
          ($5 = 'supervise'
            AND claim.story_id IS NULL
            AND runtime.story_db_id IS NULL
            AND runtime.story_id IS NULL)
        )
        AND ($6 = 'final_product' OR (
          story.story_index = $11
          AND story.claim_generation = $12
        ))
      RETURNING claim_id::text, subject_kind, story_db_id, story_id,
                story_index, story_claim_generation`,
    [
      input.claimId,
      input.runtimeSessionId,
      input.runId,
      input.stepDbId,
      input.workflowStepId,
      subject.kind,
      subject.kind === "story_member" ? subject.storyDbId : null,
      subject.kind === "story_member" ? subject.storyId : null,
      currentAuthority.receiptHash,
      currentAuthority.subjectHash,
      subject.kind === "story_member" ? subject.storyIndex : null,
      subject.kind === "story_member" ? subject.storyClaimGeneration : null,
    ],
  );
  if (inserted.length !== 1 || Number(inserted[0]!.claim_id) !== input.claimId) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_INSERT_FAILED");
  }
  const row = inserted[0]!;
  if (row.subject_kind === "final_product") {
    if (row.story_db_id !== null
      || row.story_id !== null
      || row.story_index !== null
      || row.story_claim_generation !== null) {
      throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_INSERT_RESULT_INVALID");
    }
    return Object.freeze({ kind: "final_product" as const });
  }
  if (!row.story_db_id
    || !row.story_id
    || !Number.isSafeInteger(row.story_index)
    || row.story_index! < 0
    || !Number.isSafeInteger(row.story_claim_generation)
    || row.story_claim_generation! < 1) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_INSERT_RESULT_INVALID");
  }
  return Object.freeze({
    kind: "story_member" as const,
    storyDbId: row.story_db_id,
    storyId: row.story_id,
    storyIndex: row.story_index!,
    storyClaimGeneration: row.story_claim_generation!,
  });
}

/**
 * Loads and reauthenticates a binding before a V3 IMPLEMENT or SUPERVISE
 * completion request may consume it. Stored hashes select no authority: they
 * must reproduce the current locked STORY receipt and exact member.
 */
export async function loadAndRevalidateV3StoryClaimRuntimeBindingV1(
  transaction: postgres.TransactionSql,
  input: Readonly<{
    claimId: number;
    runtimeSessionId: string;
    runId: string;
    stepDbId: string;
    workflowStepId: "implement" | "supervise";
  }>,
): Promise<V3StoryClaimRuntimeSubjectV1> {
  const runs = await transaction.unsafe<Array<{ id: string }>>(
    "SELECT id FROM runs WHERE id = $1 FOR UPDATE",
    [input.runId],
  );
  if (runs.length !== 1) throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_RUN_INVALID");
  const initialRows = await transaction.unsafe<BindingIdentityRowV1[]>(
    `SELECT claim_id, runtime_session_id, run_id, step_db_id, workflow_step_id,
            subject_kind, story_db_id, story_id, story_index,
            story_claim_generation,
            story_admission_receipt_hash, story_admission_subject_hash
       FROM v3_story_claim_runtime_bindings_v1
      WHERE claim_id = $1 OR runtime_session_id = $2
      ORDER BY claim_id
      LIMIT 2`,
    [input.claimId, input.runtimeSessionId],
  );
  const initial = initialRows[0];
  if (initialRows.length !== 1 || !initial
    || Number(initial.claim_id) !== input.claimId
    || initial.runtime_session_id !== input.runtimeSessionId
    || initial.run_id !== input.runId
    || initial.step_db_id !== input.stepDbId
    || initial.workflow_step_id !== input.workflowStepId) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_IDENTITY_INVALID");
  }
  const candidate = initial.subject_kind === "final_product"
    ? initial.story_db_id === null
        && initial.story_id === null
        && initial.story_index === null
        && initial.story_claim_generation === null
      ? { kind: "final_product" as const }
      : undefined
    : initial.subject_kind === "story_member"
        && initial.story_db_id
        && initial.story_id
        && initial.story_index !== null
        && initial.story_claim_generation !== null
        && Number.isSafeInteger(initial.story_index)
        && initial.story_index >= 0
        && Number.isSafeInteger(initial.story_claim_generation)
        && initial.story_claim_generation > 0
      ? {
          kind: "story_member" as const,
          storyDbId: initial.story_db_id,
          storyId: initial.story_id,
        }
      : undefined;
  if (!candidate) throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_SUBJECT_INVALID");
  const authority = await lockAndAuthenticateCompilerStoryEnglishAdmissionClaimSubjectV1(
    transaction,
    {
      runId: input.runId,
      proof: {
        schema: "setfarm.compiler-story-english-admission-claim-proof.v1",
        receiptHash: initial.story_admission_receipt_hash,
        subjectHash: initial.story_admission_subject_hash,
      },
      subject: candidate,
    },
  );
  const authenticated = inspectCompilerStoryEnglishAdmissionClaimAuthorityV1(authority);
  if (authority.receiptHash !== initial.story_admission_receipt_hash
    || authority.subjectHash !== initial.story_admission_subject_hash
    || (authenticated.subject.kind === "story_member"
      && (authenticated.subject.storyIndex !== initial.story_index
        || authenticated.subject.storyClaimGeneration !== initial.story_claim_generation))) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_AUTHORITY_DRIFT");
  }
  if (input.workflowStepId === "implement" && authenticated.subject.kind !== "story_member") {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_IMPLEMENT_SUBJECT_INVALID");
  }

  const rows = await transaction.unsafe<BindingRowV1[]>(
    `SELECT binding.claim_id, binding.runtime_session_id, binding.run_id,
            binding.step_db_id, binding.workflow_step_id, binding.subject_kind,
            binding.story_db_id, binding.story_id, binding.story_index,
            binding.story_claim_generation,
            binding.story_admission_receipt_hash, binding.story_admission_subject_hash,
            claim.run_id AS claim_run_id, claim.step_id AS claim_step_id,
            claim.story_id AS claim_story_id, claim.outcome AS claim_outcome,
            runtime.claim_id AS runtime_claim_id, runtime.run_id AS runtime_run_id,
            runtime.step_db_id AS runtime_step_db_id,
            runtime.workflow_step_id AS runtime_workflow_step_id,
            runtime.story_db_id AS runtime_story_db_id, runtime.story_id AS runtime_story_id,
            step.run_id AS step_run_id, step.step_id AS step_workflow_step_id
       FROM v3_story_claim_runtime_bindings_v1 binding
       JOIN claim_log claim ON claim.id = binding.claim_id
       JOIN runtime_sessions runtime ON runtime.session_id = binding.runtime_session_id
       JOIN steps step ON step.id = binding.step_db_id
      WHERE binding.claim_id = $1 OR binding.runtime_session_id = $2
      ORDER BY binding.claim_id
      LIMIT 2
      FOR UPDATE OF binding, claim, runtime, step`,
    [input.claimId, input.runtimeSessionId],
  );
  const row = rows[0];
  if (rows.length !== 1 || !row
    || Number(row.claim_id) !== input.claimId
    || row.runtime_session_id !== input.runtimeSessionId
    || row.run_id !== input.runId
    || row.step_db_id !== input.stepDbId
    || row.workflow_step_id !== input.workflowStepId
    || row.claim_run_id !== row.run_id
    || row.claim_step_id !== row.workflow_step_id
    || Number(row.runtime_claim_id) !== Number(row.claim_id)
    || row.runtime_run_id !== row.run_id
    || row.runtime_step_db_id !== row.step_db_id
    || row.runtime_workflow_step_id !== row.workflow_step_id
    || row.step_run_id !== row.run_id
    || row.step_workflow_step_id !== row.workflow_step_id
    || row.subject_kind !== initial.subject_kind
    || row.story_db_id !== initial.story_db_id
    || row.story_id !== initial.story_id
    || row.story_index !== initial.story_index
    || row.story_claim_generation !== initial.story_claim_generation
    || row.story_admission_receipt_hash !== initial.story_admission_receipt_hash
    || row.story_admission_subject_hash !== initial.story_admission_subject_hash) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_IDENTITY_INVALID");
  }
  if (candidate.kind === "story_member") {
    const stories = await transaction.unsafe<Array<{
      id: string;
      run_id: string;
      story_id: string;
      story_index: number;
      claim_generation: number;
    }>>(
      `SELECT id, run_id, story_id, story_index, claim_generation
         FROM stories
        WHERE id = $1 AND run_id = $2 AND story_id = $3
          AND story_index = $4 AND claim_generation = $5
        FOR UPDATE`,
      [
        candidate.storyDbId,
        row.run_id,
        candidate.storyId,
        row.story_index,
        row.story_claim_generation,
      ],
    );
    if (stories.length !== 1
      || (input.workflowStepId === "implement"
        && (row.claim_story_id !== candidate.storyId
          || row.runtime_story_db_id !== candidate.storyDbId
          || row.runtime_story_id !== candidate.storyId))
      || (input.workflowStepId === "supervise"
        && (row.claim_story_id !== null
          || row.runtime_story_db_id !== null
          || row.runtime_story_id !== null))) {
      throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_PARENT_SUBJECT_INVALID");
    }
  } else if (row.claim_story_id !== null
    || row.runtime_story_db_id !== null
    || row.runtime_story_id !== null) {
    throw new Error("V3_STORY_CLAIM_RUNTIME_BINDING_PARENT_SUBJECT_INVALID");
  }
  return publicSubject(authenticated.subject);
}
