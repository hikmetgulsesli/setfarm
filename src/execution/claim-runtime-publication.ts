import type postgres from "postgres";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  V3RecoveryClaimAuthorityError,
  V3RecoveryClaimHandoffV1Schema,
  v3RecoveryStoryLockIdentity,
  type V3RecoveryClaimHandoffV1,
} from "../recovery/v3-recovery-claim-authority.js";
import {
  parseRuntimeClaimIntentV1,
  reserveRuntimeSessionInTransaction,
  type RuntimeClaimIntentV1,
} from "./runtime-session-repository.js";
import {
  V3PreparationClaimAuthorityError,
  V3PreparationClaimAuthorityV1Schema,
  v3PreparationStoryLockIdentity,
  type V3PreparationClaimAuthorityV1,
} from "./v3-preparation-claim-authority.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

export type ClaimRuntimePublication = Readonly<{
  claimId: number;
  protocol: "legacy" | "shadow" | "v3";
  runtime?: Readonly<{ sessionId: string; ownerInstanceId: string }>;
}>;

function validTime(value?: Date): Date {
  const result = value ? new Date(value) : new Date();
  if (!Number.isFinite(result.getTime())) throw new Error("CLAIM_PUBLICATION_TIME_INVALID");
  return result;
}

function claimIdFrom(rows: Array<{ id: string }>): number {
  const claimId = Number(rows[0]?.id);
  if (!Number.isSafeInteger(claimId) || claimId <= 0) {
    throw new Error("CLAIM_PUBLICATION_CLAIM_ID_INVALID");
  }
  return claimId;
}

function recoveryPublicationFail(code: string, message: string): never {
  throw new V3RecoveryClaimAuthorityError(code, message);
}

function preparationPublicationFail(code: string, message: string): never {
  throw new V3PreparationClaimAuthorityError(code, message);
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function timestampMillis(value: Date | string | null): number {
  if (value === null) return Number.NaN;
  const millis = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(millis) ? millis : Number.NaN;
}

function parsedJson(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function canonicalStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function parseStoryDependencyProjection(value: string | null): string[] {
  if (value === null || value.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_STORY_PROJECTION_INVALID",
      "story dependency projection is not JSON",
    );
  }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string" || item.length === 0)) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_STORY_PROJECTION_INVALID",
      "story dependency projection is not a string array",
    );
  }
  const canonical = canonicalStrings(parsed as string[]);
  if (canonical.length !== parsed.length) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_STORY_PROJECTION_INVALID",
      "story dependency projection contains duplicates",
    );
  }
  return canonical;
}

type RecoveryPublicationRow = Readonly<{
  dispatch_id: string;
  delivery_recovery_case_id: string;
  delivery_revision_id: string;
  delivery_run_id: string;
  delivery_story_id: string;
  delivery_state: string;
  owner_instance_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  attempt_id: string | null;
  claim_id: string | number | null;
  execution_slice_hash: string | null;
  case_run_id: string;
  case_story_id: string;
  current_revision_id: string | null;
  case_status: string;
  case_owner: string;
  revision_recovery_case_id: string;
  revision_run_id: string;
  revision_story_id: string;
  recovery_owner: string;
  revision_packet_hash: string;
  revision_contract_slice_hash: string;
  revision_source_sha: string;
  revision_source_tree_hash: string;
  revision_finding_set_hash: string;
  revision_finding_ids: unknown;
  revision_expected_delta: unknown;
  revision_allowed_paths: unknown;
  revision_evidence_plan: unknown;
  revision_evidence_plan_artifact_hash: string | null;
  dispatch_recovery_case_id: string;
  dispatch_revision_id: string;
  dispatch_class: string;
  dispatch_packet_hash: string;
  dispatch_contract_slice_hash: string;
  dispatch_source_sha: string;
  dispatch_source_tree_hash: string;
  dispatch_finding_set_hash: string;
  dispatch_finding_ids: unknown;
  dispatch_evidence_plan: unknown;
  dispatch_evidence_plan_artifact_hash: string | null;
}>;

async function lockV3RecoveryStory(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; storyId: string }>,
): Promise<void> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    v3RecoveryStoryLockIdentity(input),
  ]);
}

async function lockV3PreparationStory(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; stepId: string; storyId: string }>,
): Promise<void> {
  await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    v3PreparationStoryLockIdentity(input),
  ]);
}

async function normalClaimHasActiveRecoveryDelivery(
  transaction: TransactionSql,
  input: Readonly<{ runId: string; storyId: string }>,
): Promise<boolean> {
  const active = await transaction.unsafe<Array<{ dispatch_id: string }>>(
    `SELECT dispatch_id
       FROM recovery_dispatch_deliveries
      WHERE run_id = $1 AND story_id = $2
        AND state IN ('authorized', 'leased', 'attempt_reserved', 'running')
      ORDER BY authorized_at, dispatch_id
      LIMIT 1
      FOR UPDATE`,
    [input.runId, input.storyId],
  );
  return active.length > 0;
}

async function assertExactPreparationPublicationAuthority(
  transaction: TransactionSql,
  input: Readonly<{
    authority: V3PreparationClaimAuthorityV1;
    runPacketHash: string | null;
    stepDbId: string;
    storyDbId: string;
  }>,
): Promise<void> {
  const authority = input.authority;
  if (input.runPacketHash !== authority.packetHash) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_PACKET_MISMATCH",
      "authority packet is not the active run packet",
    );
  }
  const states = await transaction.unsafe<Array<{
    state_version: number;
    state: string;
    packet_hash: string;
    base_source_sha: string;
    base_source_tree_hash: string;
    projected_dependency_ids: unknown;
    dependency_attempts: unknown;
    state_fingerprint: string;
    claim_id: string | number | null;
    claimed_at: Date | string | null;
  }>>(
    `SELECT state_version, state, packet_hash, base_source_sha, base_source_tree_hash,
            projected_dependency_ids, dependency_attempts, state_fingerprint,
            claim_id, claimed_at
       FROM v3_preparation_story_state
      WHERE run_id = $1 AND step_id = $2 AND story_id = $3
      FOR UPDATE`,
    [authority.runId, authority.stepId, authority.storyId],
  );
  const state = states[0];
  if (!state) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_AUTHORITY_NOT_FOUND",
      "ready preparation state does not exist",
    );
  }
  const exactState = state.state === "ready"
    && state.state_version === authority.stateVersion
    && state.packet_hash === authority.packetHash
    && state.base_source_sha === authority.baseRevision.sha
    && state.base_source_tree_hash === authority.baseRevision.treeHash
    && state.state_fingerprint === authority.authorityHash
    && state.claim_id === null
    && state.claimed_at === null
    && sameCanonical(parsedJson(state.projected_dependency_ids), authority.projectedDependencyIds)
    && sameCanonical(parsedJson(state.dependency_attempts), authority.dependencyAttempts);
  if (!exactState) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_AUTHORITY_STALE",
      "ready preparation state version, hash or source binding changed",
    );
  }

  const steps = await transaction.unsafe<Array<{ status: string }>>(
    `SELECT status FROM steps
      WHERE id = $1 AND run_id = $2 AND step_id = $3
      FOR UPDATE`,
    [input.stepDbId, authority.runId, authority.stepId],
  );
  if (steps.length !== 1 || !["pending", "running"].includes(steps[0]!.status)) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_STEP_MISMATCH",
      "authority does not own the exact claimable loop step",
    );
  }
  const stories = await transaction.unsafe<Array<{ status: string; story_id: string; depends_on: string | null }>>(
    `SELECT status, story_id, depends_on FROM stories
      WHERE id = $1 AND run_id = $2
      FOR UPDATE`,
    [input.storyDbId, authority.runId],
  );
  const story = stories[0];
  if (!story || story.status !== "pending" || story.story_id !== authority.storyId) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_STORY_MISMATCH",
      "authority does not own the exact pending story projection",
    );
  }
  const projectedDependencies = parseStoryDependencyProjection(story.depends_on);
  if (!sameCanonical(projectedDependencies, authority.projectedDependencyIds)) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_STORY_PROJECTION_MISMATCH",
      "story dependency projection changed after preparation",
    );
  }

  if (authority.dependencyAttempts.length === 0) return;
  const attemptIds = authority.dependencyAttempts.map((attempt) => attempt.attemptId);
  const attempts = await transaction.unsafe<Array<{
    attempt_id: string;
    run_id: string;
    step_id: string;
    story_id: string;
    packet_hash: string | null;
    attempt_class: string;
    disposition: string;
    source_after_sha: string | null;
    source_after_tree_hash: string | null;
  }>>(
    `SELECT attempt_id, run_id, step_id, story_id, packet_hash, attempt_class,
            disposition, source_after_sha, source_after_tree_hash
       FROM execution_attempts
      WHERE attempt_id = ANY($1::text[])
      FOR UPDATE`,
    [attemptIds],
  );
  const attemptById = new Map(attempts.map((attempt) => [attempt.attempt_id, attempt]));
  for (const expected of authority.dependencyAttempts) {
    const attempt = attemptById.get(expected.attemptId);
    if (
      !attempt
      || attempt.run_id !== authority.runId
      || attempt.step_id !== authority.stepId
      || attempt.story_id !== expected.storyId
      || attempt.packet_hash !== authority.packetHash
      || attempt.attempt_class !== expected.attemptClass
      || attempt.disposition !== expected.disposition
      || attempt.source_after_sha !== expected.sourceRevision.sha
      || attempt.source_after_tree_hash !== expected.sourceRevision.treeHash
    ) {
      preparationPublicationFail(
        "V3_PREPARATION_PUBLICATION_DEPENDENCY_ATTEMPT_MISMATCH",
        `dependency ${expected.storyId} no longer matches its exact prepared attempt`,
      );
    }
  }
}

async function assertExactRecoveryPublicationHandoff(
  transaction: TransactionSql,
  input: Readonly<{
    handoff: V3RecoveryClaimHandoffV1;
    runPacketHash: string | null;
    now: Date;
  }>,
): Promise<void> {
  const rows = await transaction.unsafe<RecoveryPublicationRow[]>(
    `SELECT delivery.dispatch_id,
            delivery.recovery_case_id AS delivery_recovery_case_id,
            delivery.revision_id AS delivery_revision_id,
            delivery.run_id AS delivery_run_id,
            delivery.story_id AS delivery_story_id,
            delivery.state AS delivery_state,
            delivery.owner_instance_id,
            delivery.lease_token,
            delivery.lease_expires_at,
            delivery.attempt_id,
            delivery.claim_id,
            delivery.execution_slice_hash,
            recovery_case.run_id AS case_run_id,
            recovery_case.story_id AS case_story_id,
            recovery_case.current_revision_id,
            recovery_case.status AS case_status,
            recovery_case.owner AS case_owner,
            revision.recovery_case_id AS revision_recovery_case_id,
            revision.run_id AS revision_run_id,
            revision.story_id AS revision_story_id,
            revision.owner AS recovery_owner,
            revision.packet_hash AS revision_packet_hash,
            revision.contract_slice_hash AS revision_contract_slice_hash,
            revision.source_sha AS revision_source_sha,
            revision.source_tree_hash AS revision_source_tree_hash,
            revision.finding_set_hash AS revision_finding_set_hash,
            revision.finding_ids AS revision_finding_ids,
            revision.expected_delta AS revision_expected_delta,
            revision.allowed_paths AS revision_allowed_paths,
            revision.evidence_plan AS revision_evidence_plan,
            revision.evidence_plan_artifact_hash AS revision_evidence_plan_artifact_hash,
            dispatch.recovery_case_id AS dispatch_recovery_case_id,
            dispatch.revision_id AS dispatch_revision_id,
            dispatch.dispatch_class,
            dispatch.packet_hash AS dispatch_packet_hash,
            dispatch.contract_slice_hash AS dispatch_contract_slice_hash,
            dispatch.source_sha AS dispatch_source_sha,
            dispatch.source_tree_hash AS dispatch_source_tree_hash,
            dispatch.finding_set_hash AS dispatch_finding_set_hash,
            dispatch.finding_ids AS dispatch_finding_ids,
            dispatch.evidence_plan AS dispatch_evidence_plan,
            dispatch.evidence_plan_artifact_hash AS dispatch_evidence_plan_artifact_hash
       FROM recovery_dispatch_deliveries delivery
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = delivery.dispatch_id
        AND dispatch.revision_id = delivery.revision_id
       JOIN recovery_case_revisions revision
         ON revision.revision_id = delivery.revision_id
        AND revision.recovery_case_id = delivery.recovery_case_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = delivery.recovery_case_id
      WHERE delivery.dispatch_id = $1
      FOR UPDATE OF delivery, recovery_case`,
    [input.handoff.dispatchId],
  );
  const row = rows[0];
  if (!row) {
    recoveryPublicationFail("V3_RECOVERY_PUBLICATION_DELIVERY_NOT_FOUND", "handoff dispatch has no exact delivery chain");
  }

  const exactIdentity = row.dispatch_id === input.handoff.dispatchId
    && row.delivery_recovery_case_id === input.handoff.recoveryCaseId
    && row.delivery_revision_id === input.handoff.revisionId
    && row.delivery_run_id === input.handoff.runId
    && row.delivery_story_id === input.handoff.storyId
    && row.case_run_id === input.handoff.runId
    && row.case_story_id === input.handoff.storyId
    && row.current_revision_id === input.handoff.revisionId
    && row.revision_recovery_case_id === input.handoff.recoveryCaseId
    && row.revision_run_id === input.handoff.runId
    && row.revision_story_id === input.handoff.storyId
    && row.dispatch_recovery_case_id === input.handoff.recoveryCaseId
    && row.dispatch_revision_id === input.handoff.revisionId
    && row.dispatch_class === input.handoff.dispatchClass
    && row.case_owner === input.handoff.recoveryOwner
    && row.recovery_owner === input.handoff.recoveryOwner
    && (
      (row.dispatch_class === "product_implementation" && row.recovery_owner === "implement")
      || (row.dispatch_class === "supervisor_repair" && row.recovery_owner === "supervisor")
    )
    && !["resolved", "blocked", "superseded"].includes(row.case_status)
    && input.runPacketHash === input.handoff.directive.packetHash;
  if (!exactIdentity) {
    recoveryPublicationFail("V3_RECOVERY_PUBLICATION_IDENTITY_MISMATCH", "handoff is not the current run, story, case, revision and dispatch identity");
  }

  const canonicalDirective = {
    packetHash: row.revision_packet_hash,
    contractSliceHash: row.revision_contract_slice_hash,
    sourceRevision: {
      sha: row.revision_source_sha,
      treeHash: row.revision_source_tree_hash,
    },
    findingSetHash: row.revision_finding_set_hash,
    findingIds: row.revision_finding_ids,
    expectedDelta: row.revision_expected_delta,
    allowedPaths: row.revision_allowed_paths,
    evidencePlan: row.revision_evidence_plan,
    ...(row.revision_evidence_plan_artifact_hash
      ? { evidencePlanArtifactHash: row.revision_evidence_plan_artifact_hash }
      : {}),
  };
  const dispatchMatchesRevision = sameCanonical({
    packetHash: row.dispatch_packet_hash,
    contractSliceHash: row.dispatch_contract_slice_hash,
    sourceRevision: {
      sha: row.dispatch_source_sha,
      treeHash: row.dispatch_source_tree_hash,
    },
    findingSetHash: row.dispatch_finding_set_hash,
    findingIds: row.dispatch_finding_ids,
    evidencePlan: row.dispatch_evidence_plan,
    ...(row.dispatch_evidence_plan_artifact_hash
      ? { evidencePlanArtifactHash: row.dispatch_evidence_plan_artifact_hash }
      : {}),
  }, {
    packetHash: row.revision_packet_hash,
    contractSliceHash: row.revision_contract_slice_hash,
    sourceRevision: {
      sha: row.revision_source_sha,
      treeHash: row.revision_source_tree_hash,
    },
    findingSetHash: row.revision_finding_set_hash,
    findingIds: row.revision_finding_ids,
    evidencePlan: row.revision_evidence_plan,
    ...(row.revision_evidence_plan_artifact_hash
      ? { evidencePlanArtifactHash: row.revision_evidence_plan_artifact_hash }
      : {}),
  });
  if (!sameCanonical(input.handoff.directive, canonicalDirective) || !dispatchMatchesRevision) {
    recoveryPublicationFail("V3_RECOVERY_PUBLICATION_DIRECTIVE_MISMATCH", "handoff directive is not the canonical current recovery revision");
  }

  const leaseExpiresAt = timestampMillis(row.lease_expires_at);
  const handoffExpiresAt = timestampMillis(input.handoff.lease.expiresAt);
  if (
    row.delivery_state !== "leased"
    || row.owner_instance_id !== input.handoff.lease.ownerInstanceId
    || row.lease_token !== input.handoff.lease.leaseToken
    || leaseExpiresAt !== handoffExpiresAt
    || leaseExpiresAt <= input.now.getTime()
    || row.attempt_id !== null
    || row.claim_id !== null
    || row.execution_slice_hash !== null
  ) {
    recoveryPublicationFail("V3_RECOVERY_PUBLICATION_LEASE_INVALID", "handoff does not own one exact unexpired unreserved delivery lease");
  }
}

export async function publishSingleClaimRuntime(
  sql: Sql,
  rawInput: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: string;
    claimAgentId: string;
    runtimeIntent?: RuntimeClaimIntentV1;
    now?: Date;
  }>,
): Promise<ClaimRuntimePublication | undefined> {
  const now = validTime(rawInput.now);
  const runtimeIntent = rawInput.runtimeIntent
    ? parseRuntimeClaimIntentV1(rawInput.runtimeIntent)
    : undefined;
  return sql.begin(async (transaction) => {
    const runs = await transaction.unsafe<Array<{
      status: string;
      protocol: "legacy" | "shadow" | "v3";
    }>>(
      "SELECT status, protocol FROM runs WHERE id = $1 FOR UPDATE",
      [rawInput.runId],
    );
    const run = runs[0];
    if (!run || !["running", "resuming"].includes(run.status)) return undefined;
    const requests = await transaction.unsafe<Array<{ request_id: string }>>(
      "SELECT request_id FROM run_termination_requests WHERE run_id = $1 AND state <> 'terminalized' LIMIT 1",
      [rawInput.runId],
    );
    if (requests.length > 0) return undefined;
    if (run.protocol !== "legacy" && !runtimeIntent) {
      throw new Error("COMPILER_RUNTIME_CLAIM_INTENT_REQUIRED");
    }
    const unreleased = await transaction.unsafe<Array<{ session_id: string }>>(
      `SELECT session_id FROM runtime_sessions
        WHERE run_id = $1 AND workflow_step_id = $2
          AND story_id IS NULL AND state <> 'released'
        LIMIT 1`,
      [rawInput.runId, rawInput.workflowStepId],
    );
    if (unreleased.length > 0) return undefined;
    const steps = await transaction.unsafe<Array<{ status: string }>>(
      "SELECT status FROM steps WHERE id = $1 AND run_id = $2 AND step_id = $3 FOR UPDATE",
      [rawInput.stepDbId, rawInput.runId, rawInput.workflowStepId],
    );
    if (steps[0]?.status !== "pending") return undefined;
    const updated = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'running', started_at = COALESCE(started_at, $4), updated_at = $4
        WHERE id = $1 AND run_id = $2 AND step_id = $3 AND status = 'pending'
        RETURNING id`,
      [rawInput.stepDbId, rawInput.runId, rawInput.workflowStepId, now],
    );
    if (updated.length !== 1) return undefined;
    const claimId = claimIdFrom(await transaction.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, $2, NULL, $3, $4)
       RETURNING id::text AS id`,
      [rawInput.runId, rawInput.workflowStepId, rawInput.claimAgentId, now],
    ));
    let runtime: ClaimRuntimePublication["runtime"];
    if (runtimeIntent) {
      await reserveRuntimeSessionInTransaction(transaction, {
        sessionId: runtimeIntent.sessionId,
        runId: rawInput.runId,
        stepDbId: rawInput.stepDbId,
        workflowStepId: rawInput.workflowStepId,
        claimId,
        claimAgentId: rawInput.claimAgentId,
        runtimeAgentId: runtimeIntent.runtimeAgentId,
        runtimeKind: runtimeIntent.runtimeKind,
        ownerInstanceId: runtimeIntent.ownerInstanceId,
        sessionKey: runtimeIntent.sessionKey,
        worktree: runtimeIntent.worktree,
        runtimePath: runtimeIntent.runtimePath,
        transcriptPath: runtimeIntent.transcriptPath,
        now,
      });
      runtime = { sessionId: runtimeIntent.sessionId, ownerInstanceId: runtimeIntent.ownerInstanceId };
    }
    return { claimId, protocol: run.protocol, runtime };
  }) as Promise<ClaimRuntimePublication | undefined>;
}

export type LoopClaimAuthorityPublication =
  | Readonly<{ mode: "normal" }>
  | Readonly<{
      mode: "preparation";
      authority: V3PreparationClaimAuthorityV1;
      baseRevision: V3PreparationClaimAuthorityV1["baseRevision"];
    }>
  | Readonly<{
      mode: "recovery";
      handoff: V3RecoveryClaimHandoffV1;
    }>;

export type LoopClaimRuntimePublication = ClaimRuntimePublication & Readonly<{
  claimGeneration: number;
  /** Exact prepared base for normal v3 worktree creation. */
  baseRevision?: V3PreparationClaimAuthorityV1["baseRevision"];
  /** Present on v3 publications. Omitted for byte-for-byte legacy/shadow compatibility. */
  claimAuthority?: LoopClaimAuthorityPublication;
}>;

export async function publishLoopClaimRuntime(
  sql: Sql,
  rawInput: Readonly<{
    runId: string;
    stepDbId: string;
    workflowStepId: string;
    storyDbId: string;
    storyId: string;
    claimAgentId: string;
    callerGatewayAgent?: string;
    parallelLimit: number;
    runtimeIntent?: RuntimeClaimIntentV1;
    recoveryHandoff?: V3RecoveryClaimHandoffV1;
    preparationAuthority?: V3PreparationClaimAuthorityV1;
    now?: Date;
  }>,
): Promise<LoopClaimRuntimePublication | undefined> {
  const now = validTime(rawInput.now);
  const runtimeIntent = rawInput.runtimeIntent
    ? parseRuntimeClaimIntentV1(rawInput.runtimeIntent)
    : undefined;
  const recoveryHandoff = rawInput.recoveryHandoff
    ? V3RecoveryClaimHandoffV1Schema.parse(rawInput.recoveryHandoff)
    : undefined;
  const preparationAuthority = rawInput.preparationAuthority
    ? V3PreparationClaimAuthorityV1Schema.parse(rawInput.preparationAuthority)
    : undefined;
  if (recoveryHandoff && preparationAuthority) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_AUTHORITY_CONFLICT",
      "normal preparation authority and recovery handoff are mutually exclusive",
    );
  }
  if (recoveryHandoff?.status === "attempt_bound_reissue") {
    recoveryPublicationFail(
      "V3_RECOVERY_PUBLICATION_ATTEMPT_BOUND_REISSUE",
      "attempt-bound handoff must resume its exact existing attempt instead of publishing a new claim",
    );
  }
  if (
    recoveryHandoff
    && (recoveryHandoff.runId !== rawInput.runId || recoveryHandoff.storyId !== rawInput.storyId)
  ) {
    recoveryPublicationFail(
      "V3_RECOVERY_PUBLICATION_INPUT_IDENTITY_MISMATCH",
      "handoff run and story must exactly match the requested publication",
    );
  }
  if (
    preparationAuthority
    && (
      preparationAuthority.runId !== rawInput.runId
      || preparationAuthority.stepId !== rawInput.workflowStepId
      || preparationAuthority.storyId !== rawInput.storyId
    )
  ) {
    preparationPublicationFail(
      "V3_PREPARATION_PUBLICATION_INPUT_IDENTITY_MISMATCH",
      "preparation authority run, step and story must exactly match publication input",
    );
  }
  return sql.begin(async (transaction) => {
    // V3 recovery authorization takes this advisory lock before touching the
    // run row. Publication must use the same order or lease/publication can
    // deadlock while each side owns the other's lock.
    const protocolRows = await transaction.unsafe<Array<{
      protocol: "legacy" | "shadow" | "v3";
    }>>(
      "SELECT protocol FROM runs WHERE id = $1",
      [rawInput.runId],
    );
    const observedProtocol = protocolRows[0]?.protocol;
    if (observedProtocol === "v3") {
      await lockV3RecoveryStory(transaction, {
        runId: rawInput.runId,
        storyId: rawInput.storyId,
      });
      if (preparationAuthority) {
        await lockV3PreparationStory(transaction, {
          runId: rawInput.runId,
          stepId: rawInput.workflowStepId,
          storyId: rawInput.storyId,
        });
      }
    }
    const runs = await transaction.unsafe<Array<{
      status: string;
      protocol: "legacy" | "shadow" | "v3";
      assigned_developer: string | null;
      packet_hash: string | null;
    }>>(
      "SELECT status, protocol, assigned_developer, packet_hash FROM runs WHERE id = $1 FOR UPDATE",
      [rawInput.runId],
    );
    const run = runs[0];
    if (!run || !["running", "resuming"].includes(run.status)) return undefined;
    if (run.protocol !== observedProtocol) {
      throw new Error("CLAIM_PUBLICATION_PROTOCOL_CHANGED");
    }
    if (recoveryHandoff && run.protocol !== "v3") {
      recoveryPublicationFail(
        "V3_RECOVERY_PUBLICATION_PROTOCOL_REQUIRED",
        "recovery handoff publication is only valid for a v3 run",
      );
    }
    if (preparationAuthority && run.protocol !== "v3") {
      preparationPublicationFail(
        "V3_PREPARATION_PUBLICATION_PROTOCOL_REQUIRED",
        "preparation authority publication is only valid for a v3 run",
      );
    }
    const requests = await transaction.unsafe<Array<{ request_id: string }>>(
      "SELECT request_id FROM run_termination_requests WHERE run_id = $1 AND state <> 'terminalized' LIMIT 1",
      [rawInput.runId],
    );
    if (requests.length > 0) return undefined;
    if (run.protocol !== "legacy" && !runtimeIntent) {
      throw new Error("COMPILER_RUNTIME_CLAIM_INTENT_REQUIRED");
    }
    if (run.protocol === "v3") {
      if (recoveryHandoff) {
        await assertExactRecoveryPublicationHandoff(transaction, {
          handoff: recoveryHandoff,
          runPacketHash: run.packet_hash,
          now,
        });
      } else {
        if (preparationAuthority) {
          await assertExactPreparationPublicationAuthority(transaction, {
            authority: preparationAuthority,
            runPacketHash: run.packet_hash,
            stepDbId: rawInput.stepDbId,
            storyDbId: rawInput.storyDbId,
          });
        }
        if (await normalClaimHasActiveRecoveryDelivery(transaction, {
          runId: rawInput.runId,
          storyId: rawInput.storyId,
        })) {
          return undefined;
        }
        if (!preparationAuthority && run.packet_hash) {
          const packetOwners = await transaction.unsafe<Array<{ packet_hash: string }>>(
            `SELECT packet_hash FROM product_packets
              WHERE run_id = $1 AND packet_hash = $2
              FOR KEY SHARE`,
            [rawInput.runId, run.packet_hash],
          );
          if (packetOwners.length === 1) {
            preparationPublicationFail(
              "V3_PREPARATION_PUBLICATION_AUTHORITY_REQUIRED",
              "packet-ledger-backed normal v3 claims require a ready preparation authority",
            );
          }
        }
      }
    }
    const unreleased = await transaction.unsafe<Array<{ session_id: string }>>(
      `SELECT session_id FROM runtime_sessions
        WHERE run_id = $1 AND workflow_step_id = $2 AND story_id = $3
          AND state <> 'released'
        LIMIT 1`,
      [rawInput.runId, rawInput.workflowStepId, rawInput.storyId],
    );
    if (unreleased.length > 0) return undefined;
    if (!recoveryHandoff && rawInput.callerGatewayAgent) {
      if (run.assigned_developer && run.assigned_developer !== rawInput.callerGatewayAgent) return undefined;
      const occupied = await transaction.unsafe<Array<{ id: string }>>(
        `SELECT id FROM runs
          WHERE id <> $1 AND assigned_developer = $2
            AND status IN ('running', 'resuming', 'cancelling', 'failing')
          LIMIT 1 FOR UPDATE`,
        [rawInput.runId, rawInput.callerGatewayAgent],
      );
      if (occupied.length > 0) return undefined;
      if (!run.assigned_developer) {
        await transaction.unsafe(
          "UPDATE runs SET assigned_developer = $2, updated_at = $3 WHERE id = $1",
          [rawInput.runId, rawInput.callerGatewayAgent, now],
        );
      }
    }
    const steps = await transaction.unsafe<Array<{ status: string }>>(
      "SELECT status FROM steps WHERE id = $1 AND run_id = $2 AND step_id = $3 FOR UPDATE",
      [rawInput.stepDbId, rawInput.runId, rawInput.workflowStepId],
    );
    if (!steps[0] || !["pending", "running"].includes(steps[0].status)) return undefined;
    const stories = await transaction.unsafe<Array<{ status: string; story_id: string }>>(
      "SELECT status, story_id FROM stories WHERE id = $1 AND run_id = $2 FOR UPDATE",
      [rawInput.storyDbId, rawInput.runId],
    );
    const story = stories[0];
    const requiredStoryStatus = recoveryHandoff ? "failed" : "pending";
    if (!story || story.status !== requiredStoryStatus || story.story_id !== rawInput.storyId) {
      if (recoveryHandoff) {
        recoveryPublicationFail(
          "V3_RECOVERY_PUBLICATION_STORY_NOT_FAILED",
          "recovery publication may transition only the exact failed story",
        );
      }
      return undefined;
    }
    const active = await transaction.unsafe<Array<{ count: number }>>(
      "SELECT COUNT(*)::integer AS count FROM stories WHERE run_id = $1 AND status = 'running'",
      [rawInput.runId],
    );
    if ((active[0]?.count ?? 0) >= rawInput.parallelLimit) return undefined;
    const updatedStories = await transaction.unsafe<Array<{ claim_generation: number }>>(
      `UPDATE stories
          SET status = 'running', claim_generation = COALESCE(claim_generation, 0) + 1,
              claimed_at = $3, claimed_by = $4,
              started_at = COALESCE(started_at, $3), updated_at = $3
        WHERE id = $1 AND run_id = $2 AND status = $5
        RETURNING claim_generation`,
      [rawInput.storyDbId, rawInput.runId, now, rawInput.claimAgentId, requiredStoryStatus],
    );
    if (updatedStories.length !== 1) return undefined;
    const updatedSteps = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'running', current_story_id = $2,
              started_at = COALESCE(started_at, $3), updated_at = $3
        WHERE id = $1 AND run_id = $4 AND status IN ('pending', 'running')
        RETURNING id`,
      [rawInput.stepDbId, rawInput.storyDbId, now, rawInput.runId],
    );
    if (updatedSteps.length !== 1) throw new Error("LOOP_STEP_CLAIM_CAS_LOST");
    const claimId = claimIdFrom(await transaction.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::text AS id`,
      [rawInput.runId, rawInput.workflowStepId, rawInput.storyId, rawInput.claimAgentId, now],
    ));
    if (preparationAuthority) {
      const claimedStates = await transaction.unsafe<Array<{ state_version: number }>>(
        `UPDATE v3_preparation_story_state
            SET state = 'claimed', claim_id = $5, claimed_at = $6, updated_at = $6
          WHERE run_id = $1 AND step_id = $2 AND story_id = $3
            AND state = 'ready' AND state_version = $4
            AND state_fingerprint = $7
            AND claim_id IS NULL AND claimed_at IS NULL
          RETURNING state_version`,
        [
          preparationAuthority.runId,
          preparationAuthority.stepId,
          preparationAuthority.storyId,
          preparationAuthority.stateVersion,
          claimId,
          now,
          preparationAuthority.authorityHash,
        ],
      );
      if (claimedStates.length !== 1) {
        preparationPublicationFail(
          "V3_PREPARATION_PUBLICATION_CLAIM_CAS_LOST",
          "ready preparation state was consumed by another claimant",
        );
      }
    }
    let runtime: ClaimRuntimePublication["runtime"];
    if (runtimeIntent) {
      await reserveRuntimeSessionInTransaction(transaction, {
        sessionId: runtimeIntent.sessionId,
        runId: rawInput.runId,
        stepDbId: rawInput.stepDbId,
        workflowStepId: rawInput.workflowStepId,
        storyDbId: rawInput.storyDbId,
        storyId: rawInput.storyId,
        claimId,
        claimAgentId: rawInput.claimAgentId,
        runtimeAgentId: runtimeIntent.runtimeAgentId,
        runtimeKind: runtimeIntent.runtimeKind,
        ownerInstanceId: runtimeIntent.ownerInstanceId,
        sessionKey: runtimeIntent.sessionKey,
        worktree: runtimeIntent.worktree,
        runtimePath: runtimeIntent.runtimePath,
        transcriptPath: runtimeIntent.transcriptPath,
        now,
      });
      runtime = { sessionId: runtimeIntent.sessionId, ownerInstanceId: runtimeIntent.ownerInstanceId };
    }
    return {
      claimId,
      claimGeneration: Number(updatedStories[0]!.claim_generation),
      protocol: run.protocol,
      runtime,
      ...(run.protocol === "v3"
        ? {
            claimAuthority: recoveryHandoff
              ? { mode: "recovery" as const, handoff: recoveryHandoff }
              : preparationAuthority
                ? {
                    mode: "preparation" as const,
                    authority: preparationAuthority,
                    baseRevision: preparationAuthority.baseRevision,
                  }
                : { mode: "normal" as const },
            ...(preparationAuthority
              ? { baseRevision: preparationAuthority.baseRevision }
              : {}),
          }
        : {}),
    };
  }) as Promise<LoopClaimRuntimePublication | undefined>;
}
