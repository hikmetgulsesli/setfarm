import type postgres from "postgres";
import { z } from "zod";

import { readDatabaseWallClock } from "../db/database-wall-clock.js";
import {
  closeExactSingleStepClaimInTransaction,
} from "../execution/claim-attempt-transition.js";
import {
  ClaimEnvelopeV1Schema,
  type ClaimEnvelopeV1,
} from "../execution/schemas/claim-envelope-v1.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";
import {
  RuntimeCompletionPlanDescriptorV1Schema,
  type RuntimeCompletionPlanDescriptorV1,
} from "../execution/schemas/runtime-completion-plan-v1.js";
import { markRuntimeCompletionOwnerCommittedInTransaction } from "../execution/runtime-completion.js";
import { requestRunTerminationInTransaction } from "../execution/run-termination.js";
import type { OperationalFailureCauseV1 } from "../execution/schemas/operational-failure-cause-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  V3DownstreamEvidenceRouteResultV1Schema,
  type V3DownstreamEvidenceRouteResult,
} from "./v3-downstream-evidence-router.js";
import {
  createV3DownstreamTerminalOperationalFailureCauseV1,
  V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1,
  V3RecoveryTerminalReasonCodeV1Schema,
} from "./v3-downstream-terminal-cause-v1.js";

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

const BoundedIdentitySchema = z.string().min(1).max(500);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const StoryEvidenceDecisionSchema = z.object({
  storyDbId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  attemptId: AttemptIdSchema,
  sliceHash: Sha256Schema,
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundleHash: Sha256Schema,
  aggregateVerdict: z.enum(["pass", "fail", "inconclusive"]),
}).strict();

const RecoveryRouteDecisionSchema = z.object({
  storyDbId: BoundedIdentitySchema,
  storyId: BoundedIdentitySchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  dispatchId: RecoveryDispatchIdSchema,
  dispatchClass: z.enum(["product_implementation", "evidence_only", "infrastructure_retry", "supervisor_repair"]),
  modelDispatch: z.boolean(),
  evidenceBundleHash: Sha256Schema,
}).strict();

export const V3DownstreamOperationalDecisionV1Schema = z.object({
  schema: z.literal("setfarm.v3-downstream-operational-decision.v1"),
  routeHash: Sha256Schema,
  runId: BoundedIdentitySchema,
  workflowStepId: z.enum(["qa-test", "final-test"]),
  phase: z.enum(["qa", "final", "integration"]),
  packetHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  outcome: z.enum(["recovery_routed", "packet_amendment_required", "bounded_recovery_blocked"]),
  storyEvidence: z.array(StoryEvidenceDecisionSchema).max(10_000),
  recoveryRoutes: z.array(RecoveryRouteDecisionSchema).max(10_000),
  blockedStoryIds: z.array(BoundedIdentitySchema).max(10_000),
  terminalReasonCodes: z.array(V3RecoveryTerminalReasonCodeV1Schema)
    .max(V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1),
  reasonCode: BoundedIdentitySchema.optional(),
  requiredArtifact: z.literal("setfarm.product-build-packet.v.next").optional(),
}).strict().superRefine((value, context) => {
  if ((value.outcome === "recovery_routed") !== (value.recoveryRoutes.length > 0)) {
    context.addIssue({ code: "custom", path: ["recoveryRoutes"], message: "only routed recovery may name dispatches" });
  }
  if ((value.outcome === "bounded_recovery_blocked") !== (value.blockedStoryIds.length > 0)) {
    context.addIssue({ code: "custom", path: ["blockedStoryIds"], message: "only blocked recovery may name blocked stories" });
  }
  if ((value.outcome === "bounded_recovery_blocked") !== (value.terminalReasonCodes.length > 0)) {
    context.addIssue({ code: "custom", path: ["terminalReasonCodes"], message: "only blocked recovery may carry terminal reasons" });
  }
  if (value.outcome === "packet_amendment_required") {
    if (!value.reasonCode || !value.requiredArtifact) {
      context.addIssue({ code: "custom", path: ["requiredArtifact"], message: "packet amendment authority is incomplete" });
    }
  } else if (value.requiredArtifact) {
    context.addIssue({ code: "custom", path: ["requiredArtifact"], message: "non-amendment decision cannot request a packet" });
  }
});

export type V3DownstreamOperationalDecisionV1 = z.infer<typeof V3DownstreamOperationalDecisionV1Schema>;

type RecoveryChainRow = Readonly<{
  run_status: string;
  run_protocol: string;
  run_packet_hash: string | null;
  story_status: string;
  attempt_id: string;
  attempt_step_id: string;
  attempt_class: string;
  attempt_packet_hash: string | null;
  attempt_slice_hash: string | null;
  attempt_source_before_sha: string;
  attempt_source_before_tree_hash: string;
  attempt_source_after_sha: string | null;
  attempt_source_after_tree_hash: string | null;
  attempt_output_hash: string | null;
  attempt_recovery_dispatch_id: string | null;
  bundle_hash: string;
  bundle_attempt_id: string | null;
  bundle_verdict: string;
  bundle_source_sha: string;
  bundle_source_tree_hash: string;
  recovery_case_id: string;
  current_revision_id: string | null;
  recovery_case_status: string;
  revision_id: string;
  revision_packet_hash: string;
  revision_slice_hash: string;
  revision_evidence_plan_artifact_hash: string | null;
  revision_source_sha: string;
  revision_source_tree_hash: string;
  revision_finding_set_hash: string;
  dispatch_id: string;
  dispatch_class: string;
  dispatch_revision_id: string;
  dispatch_packet_hash: string;
  dispatch_slice_hash: string;
  dispatch_evidence_plan_artifact_hash: string | null;
  dispatch_source_sha: string;
  dispatch_source_tree_hash: string;
  dispatch_finding_set_hash: string;
  delivery_state: string;
  delivery_revision_id: string;
  finding_packet_hash: string;
  finding_slice_hash: string;
  finding_source_sha: string;
  finding_source_tree_hash: string;
}>;

export class V3DownstreamRecoveryTransitionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3DownstreamRecoveryTransitionError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3DownstreamRecoveryTransitionError(code, message);
}

function phaseOwnsStep(phase: V3DownstreamEvidenceRouteResult["phase"], workflowStepId: string): boolean {
  return phase === "qa" ? workflowStepId === "qa-test" : workflowStepId === "final-test";
}

export function createV3DownstreamOperationalDecision(input: Readonly<{
  envelope: ClaimEnvelopeV1;
  route: V3DownstreamEvidenceRouteResult;
}>): V3DownstreamOperationalDecisionV1 {
  const envelope = ClaimEnvelopeV1Schema.parse(input.envelope);
  const route = V3DownstreamEvidenceRouteResultV1Schema.parse(input.route);
  if (route.status === "accepted_candidate_ready") {
    fail(
      "V3_DOWNSTREAM_ACCEPTED_CANDIDATE_NOT_FAILURE",
      "accepted final-source evidence must publish AcceptedCandidate, not enter failure recovery",
    );
  }
  if (
    envelope.protocol !== "v3"
    || envelope.runId !== route.runId
    || envelope.storyId !== undefined
    || envelope.storyDbId !== undefined
    || envelope.attempt !== undefined
    || !phaseOwnsStep(route.phase, envelope.workflowStepId)
  ) {
    fail("V3_DOWNSTREAM_DECISION_AUTHORITY_MISMATCH", "route is not owned by the exact v3 QA/final single-step claim");
  }
  const recoveryRoutes = route.stories.flatMap((story) => story.coordinator.status === "dispatched"
    ? [{
        storyDbId: story.storyDbId,
        storyId: story.storyId,
        recoveryCaseId: story.coordinator.recoveryCaseId,
        revisionId: story.coordinator.revisionId,
        dispatchId: story.coordinator.dispatchId,
        dispatchClass: story.coordinator.dispatchClass,
        modelDispatch: story.coordinator.modelDispatch,
        evidenceBundleHash: story.evidenceBundleHash,
      }]
    : []);
  return V3DownstreamOperationalDecisionV1Schema.parse({
    schema: "setfarm.v3-downstream-operational-decision.v1",
    routeHash: hashCanonicalJson(route),
    runId: route.runId,
    workflowStepId: envelope.workflowStepId,
    phase: route.phase,
    packetHash: route.packetHash,
    sourceRevision: route.sourceRevision,
    outcome: route.status,
    storyEvidence: route.stories.map((story) => ({
      storyDbId: story.storyDbId,
      storyId: story.storyId,
      attemptId: story.attemptId,
      sliceHash: story.sliceHash,
      evidencePlanArtifactHash: story.evidencePlanArtifactHash,
      evidenceBundleHash: story.evidenceBundleHash,
      aggregateVerdict: story.aggregateVerdict,
    })),
    recoveryRoutes,
    blockedStoryIds: route.status === "bounded_recovery_blocked" ? route.blockedStoryIds : [],
    terminalReasonCodes: route.status === "bounded_recovery_blocked" ? route.terminalReasonCodes : [],
    ...(route.status === "packet_amendment_required"
      ? { reasonCode: route.reasonCode, requiredArtifact: route.requiredArtifact }
      : {}),
  });
}

function downstreamOperationalFailureCause(
  decision: V3DownstreamOperationalDecisionV1,
): OperationalFailureCauseV1 | undefined {
  if (decision.outcome === "packet_amendment_required") {
    return {
      schema: "setfarm.operational-failure-cause.v1",
      workflowStepId: decision.workflowStepId,
      boundary: "product_compiler.downstream_recovery",
      failureClass: "contract_invalid",
      failureCode: "V3_DOWNSTREAM_PACKET_AMENDMENT_REQUIRED",
    };
  }
  if (decision.outcome !== "bounded_recovery_blocked") return undefined;
  return createV3DownstreamTerminalOperationalFailureCauseV1({
    workflowStepId: decision.workflowStepId,
    terminalReasonCodes: decision.terminalReasonCodes,
  });
}

export function createV3DownstreamCompletionPlan(
  decision: V3DownstreamOperationalDecisionV1,
): RuntimeCompletionPlanDescriptorV1 {
  const exact = V3DownstreamOperationalDecisionV1Schema.parse(decision);
  const terminal = exact.outcome !== "recovery_routed";
  return RuntimeCompletionPlanDescriptorV1Schema.parse({
    kind: terminal ? "terminal_transition" : "quality_route",
    continuation: { type: terminal ? "terminal_finalize" : "quality_route_finalize" },
    effects: [{
      effectKey: `v3/downstream/${exact.routeHash}`,
      ordinal: 0,
      effectType: terminal
        ? "v3.downstream-recovery.terminal"
        : "v3.downstream-recovery.routed",
      mandatory: true,
      payload: exact,
    }],
  });
}

async function loadRecoveryChain(
  transaction: TransactionSql,
  decision: V3DownstreamOperationalDecisionV1,
  route: V3DownstreamOperationalDecisionV1["recoveryRoutes"][number],
): Promise<RecoveryChainRow> {
  const rows = await transaction.unsafe<RecoveryChainRow[]>(
    `SELECT run_row.status AS run_status,
            run_row.protocol AS run_protocol,
            run_row.packet_hash AS run_packet_hash,
            story_row.status AS story_status,
            attempt.attempt_id,
            attempt.step_id AS attempt_step_id,
            attempt.attempt_class,
            attempt.packet_hash AS attempt_packet_hash,
            attempt.slice_hash AS attempt_slice_hash,
            attempt.source_before_sha AS attempt_source_before_sha,
            attempt.source_before_tree_hash AS attempt_source_before_tree_hash,
            attempt.source_after_sha AS attempt_source_after_sha,
            attempt.source_after_tree_hash AS attempt_source_after_tree_hash,
            attempt.output_hash AS attempt_output_hash,
            attempt.recovery_dispatch_id AS attempt_recovery_dispatch_id,
            bundle.evidence_bundle_hash AS bundle_hash,
            bundle.attempt_id AS bundle_attempt_id,
            bundle.aggregate_verdict AS bundle_verdict,
            bundle.source_sha AS bundle_source_sha,
            bundle.source_tree_hash AS bundle_source_tree_hash,
            recovery_case.recovery_case_id,
            recovery_case.current_revision_id,
            recovery_case.status AS recovery_case_status,
            revision.revision_id,
            revision.packet_hash AS revision_packet_hash,
            revision.contract_slice_hash AS revision_slice_hash,
            revision.evidence_plan_artifact_hash AS revision_evidence_plan_artifact_hash,
            revision.source_sha AS revision_source_sha,
            revision.source_tree_hash AS revision_source_tree_hash,
            revision.finding_set_hash AS revision_finding_set_hash,
            dispatch.dispatch_id,
            dispatch.dispatch_class,
            dispatch.revision_id AS dispatch_revision_id,
            dispatch.packet_hash AS dispatch_packet_hash,
            dispatch.contract_slice_hash AS dispatch_slice_hash,
            dispatch.evidence_plan_artifact_hash AS dispatch_evidence_plan_artifact_hash,
            dispatch.source_sha AS dispatch_source_sha,
            dispatch.source_tree_hash AS dispatch_source_tree_hash,
            dispatch.finding_set_hash AS dispatch_finding_set_hash,
            delivery.state AS delivery_state,
            delivery.revision_id AS delivery_revision_id,
            finding_set.packet_hash AS finding_packet_hash,
            finding_set.slice_hash AS finding_slice_hash,
            finding_set.source_sha AS finding_source_sha,
            finding_set.source_tree_hash AS finding_source_tree_hash
       FROM runs run_row
       JOIN stories story_row
         ON story_row.id = $2 AND story_row.run_id = run_row.id AND story_row.story_id = $3
       JOIN execution_attempts attempt
         ON attempt.attempt_id = $4 AND attempt.run_id = run_row.id AND attempt.story_id = story_row.story_id
       JOIN evidence_bundles bundle
         ON bundle.evidence_bundle_hash = $5 AND bundle.run_id = run_row.id AND bundle.story_id = story_row.story_id
       JOIN recovery_cases recovery_case
         ON recovery_case.recovery_case_id = $6 AND recovery_case.run_id = run_row.id AND recovery_case.story_id = story_row.story_id
       JOIN recovery_case_revisions revision
         ON revision.revision_id = $7 AND revision.recovery_case_id = recovery_case.recovery_case_id
       JOIN recovery_revision_dispatches dispatch
         ON dispatch.dispatch_id = $8 AND dispatch.recovery_case_id = recovery_case.recovery_case_id
       JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = dispatch.dispatch_id
       JOIN finding_sets finding_set ON finding_set.finding_set_hash = revision.finding_set_hash
      WHERE run_row.id = $1
      FOR UPDATE OF run_row, story_row, attempt, recovery_case, revision, dispatch, delivery`,
    [
      decision.runId,
      route.storyDbId,
      route.storyId,
      decision.storyEvidence.find((story) => story.storyId === route.storyId)?.attemptId ?? "",
      route.evidenceBundleHash,
      route.recoveryCaseId,
      route.revisionId,
      route.dispatchId,
    ],
  );
  if (rows.length !== 1) {
    fail("V3_DOWNSTREAM_RECOVERY_CHAIN_NOT_FOUND", `${route.storyId} does not own one exact durable recovery chain`);
  }
  return rows[0]!;
}

function assertRecoveryChain(
  row: RecoveryChainRow,
  decision: V3DownstreamOperationalDecisionV1,
  route: V3DownstreamOperationalDecisionV1["recoveryRoutes"][number],
): void {
  const evidence = decision.storyEvidence.find((story) => story.storyDbId === route.storyDbId && story.storyId === route.storyId);
  if (
    !evidence
    || row.run_protocol !== "v3"
    || !["running", "resuming"].includes(row.run_status)
    || row.run_packet_hash !== decision.packetHash
    || !["done", "verified", "skipped", "failed"].includes(row.story_status)
    || row.attempt_id !== evidence.attemptId
    || row.attempt_step_id !== decision.workflowStepId
    || row.attempt_class !== "evidence_only"
    || row.attempt_packet_hash !== decision.packetHash
    || row.attempt_slice_hash !== evidence.sliceHash
    || row.attempt_source_before_sha !== decision.sourceRevision.sha
    || row.attempt_source_before_tree_hash !== decision.sourceRevision.treeHash
    || row.attempt_source_after_sha !== decision.sourceRevision.sha
    || row.attempt_source_after_tree_hash !== decision.sourceRevision.treeHash
    || row.attempt_output_hash !== evidence.evidenceBundleHash
    || row.attempt_recovery_dispatch_id !== null
    || row.bundle_hash !== evidence.evidenceBundleHash
    || row.bundle_attempt_id !== evidence.attemptId
    || row.bundle_verdict !== evidence.aggregateVerdict
    || row.bundle_verdict === "pass"
    || row.bundle_source_sha !== decision.sourceRevision.sha
    || row.bundle_source_tree_hash !== decision.sourceRevision.treeHash
    || row.recovery_case_id !== route.recoveryCaseId
    || row.current_revision_id !== route.revisionId
    || !["open", "repairing", "evidencing"].includes(row.recovery_case_status)
    || row.revision_id !== route.revisionId
    || row.revision_packet_hash !== decision.packetHash
    || row.revision_slice_hash !== evidence.sliceHash
    || row.revision_evidence_plan_artifact_hash !== evidence.evidencePlanArtifactHash
    || row.revision_source_sha !== decision.sourceRevision.sha
    || row.revision_source_tree_hash !== decision.sourceRevision.treeHash
    || row.dispatch_id !== route.dispatchId
    || row.dispatch_revision_id !== route.revisionId
    || row.dispatch_class !== route.dispatchClass
    || row.dispatch_packet_hash !== row.revision_packet_hash
    || row.dispatch_slice_hash !== row.revision_slice_hash
    || row.dispatch_evidence_plan_artifact_hash !== row.revision_evidence_plan_artifact_hash
    || row.dispatch_source_sha !== row.revision_source_sha
    || row.dispatch_source_tree_hash !== row.revision_source_tree_hash
    || row.dispatch_finding_set_hash !== row.revision_finding_set_hash
    || row.delivery_revision_id !== route.revisionId
    || !["authorized", "leased"].includes(row.delivery_state)
    || row.finding_packet_hash !== decision.packetHash
    || row.finding_slice_hash !== evidence.sliceHash
    || row.finding_source_sha !== decision.sourceRevision.sha
    || row.finding_source_tree_hash !== decision.sourceRevision.treeHash
  ) {
    fail("V3_DOWNSTREAM_RECOVERY_CHAIN_MISMATCH", `${route.storyId} recovery chain drifted from canonical final evidence`);
  }
}

async function commitRecoveryRoute(
  sql: Sql,
  envelope: ClaimEnvelopeV1,
  decision: V3DownstreamOperationalDecisionV1,
  plan: RuntimeCompletionPlanDescriptorV1,
): Promise<void> {
  await sql.begin(async (transaction) => {
    const loopRows = await transaction.unsafe<Array<{ id: string; step_index: number; status: string }>>(
      `SELECT id, step_index, status
         FROM steps
        WHERE run_id = $1 AND step_id = 'implement' AND type = 'loop'
        FOR UPDATE`,
      [decision.runId],
    );
    if (loopRows.length !== 1 || !["done", "waiting", "pending", "running"].includes(loopRows[0]!.status)) {
      fail("V3_DOWNSTREAM_RECOVERY_IMPLEMENT_OWNER_MISSING", "run does not have one exact reusable implement loop");
    }
    const loop = loopRows[0]!;
    for (const route of decision.recoveryRoutes) {
      assertRecoveryChain(await loadRecoveryChain(transaction, decision, route), decision, route);
    }
    await closeExactSingleStepClaimInTransaction(transaction, {
      envelope,
      outcome: "completed",
      diagnostic: `Canonical downstream evidence routed ${decision.recoveryRoutes.length} sealed stor${decision.recoveryRoutes.length === 1 ? "y" : "ies"}`,
    });
    const now = await readDatabaseWallClock(
      transaction,
      "V3_DOWNSTREAM_DATABASE_TIME_UNAVAILABLE",
    );
    for (const route of decision.recoveryRoutes) {
      const changed = await transaction.unsafe<Array<{ id: string }>>(
        `UPDATE stories
            SET status = 'failed', claimed_by = NULL, claimed_at = NULL, updated_at = $4
          WHERE id = $1 AND run_id = $2 AND story_id = $3
            AND status IN ('done', 'verified', 'skipped', 'failed')
          RETURNING id`,
        [route.storyDbId, decision.runId, route.storyId, now],
      );
      if (changed.length !== 1) fail("V3_DOWNSTREAM_RECOVERY_STORY_CAS_LOST", `${route.storyId} changed before recovery routing`);
    }
    const loopChanged = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'pending', current_story_id = NULL, updated_at = $3
        WHERE id = $1 AND run_id = $2 AND status IN ('done', 'waiting', 'pending', 'running')
        RETURNING id`,
      [loop.id, decision.runId, now],
    );
    if (loopChanged.length !== 1) fail("V3_DOWNSTREAM_RECOVERY_IMPLEMENT_CAS_LOST", "implement loop changed before recovery routing");
    await transaction.unsafe(
      `UPDATE steps
          SET status = 'waiting', current_story_id = NULL, updated_at = $3
        WHERE run_id = $1 AND step_index > $2`,
      [decision.runId, loop.step_index, now],
    );
    const stepOutput = canonicalJsonStringify(decision);
    const sourceChanged = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'waiting', output = $2, current_story_id = NULL, updated_at = $3
        WHERE id = $1 AND run_id = $4
        RETURNING id`,
      [envelope.stepId, stepOutput, now, decision.runId],
    );
    if (sourceChanged.length !== 1) fail("V3_DOWNSTREAM_RECOVERY_SOURCE_STEP_CAS_LOST", "QA/final step disappeared during route commit");
    await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
      claimId: envelope.claimId,
      claimOutcome: "completed",
      plan,
      now,
    });
  });
}

async function commitTerminalDecision(
  sql: Sql,
  envelope: ClaimEnvelopeV1,
  decision: V3DownstreamOperationalDecisionV1,
  plan: RuntimeCompletionPlanDescriptorV1,
): Promise<void> {
  const operationalFailureCause = downstreamOperationalFailureCause(decision);
  await sql.begin(async (transaction) => {
    const runRows = await transaction.unsafe<Array<{ protocol: string; status: string; packet_hash: string | null }>>(
      "SELECT protocol, status, packet_hash FROM runs WHERE id = $1 FOR UPDATE",
      [decision.runId],
    );
    const run = runRows[0];
    if (
      !run
      || run.protocol !== "v3"
      || !["running", "resuming"].includes(run.status)
      || run.packet_hash !== decision.packetHash
    ) {
      fail("V3_DOWNSTREAM_TERMINAL_RUN_MISMATCH", "packet amendment refusal lost exact active v3 run authority");
    }
    await closeExactSingleStepClaimInTransaction(transaction, {
      envelope,
      outcome: "failed",
      diagnostic: `${decision.outcome}:${decision.reasonCode ?? decision.terminalReasonCodes.join(",")}`,
    });
    const now = await readDatabaseWallClock(
      transaction,
      "V3_DOWNSTREAM_DATABASE_TIME_UNAVAILABLE",
    );
    const stepOutput = canonicalJsonStringify(decision);
    const changed = await transaction.unsafe<Array<{ id: string }>>(
      `UPDATE steps
          SET status = 'failed', output = $2, current_story_id = NULL, updated_at = $3
        WHERE id = $1 AND run_id = $4 AND status IN ('running', 'pending')
        RETURNING id`,
      [envelope.stepId, stepOutput, now, decision.runId],
    );
    if (changed.length !== 1) fail("V3_DOWNSTREAM_TERMINAL_STEP_CAS_LOST", "QA/final terminal state changed before refusal commit");
    await requestRunTerminationInTransaction(transaction, {
      requestId: `RTR_${decision.routeHash}`,
      runId: decision.runId,
      targetStatus: "failed",
      requestedBy: "setfarm-v3-downstream-compiler",
      diagnostic: `${decision.outcome}:${decision.reasonCode ?? decision.terminalReasonCodes.join(",")}`,
      ...(operationalFailureCause ? { failureCause: operationalFailureCause } : {}),
      evidence: {
        schema: "setfarm.v3-downstream-termination-evidence.v1",
        routeHash: decision.routeHash,
        packetHash: decision.packetHash,
        sourceRevision: decision.sourceRevision,
        outcome: decision.outcome,
        ...(decision.terminalReasonCodes.length > 0
          ? { terminalReasonCodes: decision.terminalReasonCodes }
          : {}),
        storyEvidenceRefs: decision.storyEvidence.map((story) => `setfarm://evidence-bundle/${story.evidenceBundleHash}`),
        ...(decision.requiredArtifact ? { requiredArtifact: decision.requiredArtifact } : {}),
      },
      now,
    });
    await markRuntimeCompletionOwnerCommittedInTransaction(transaction, {
      claimId: envelope.claimId,
      claimOutcome: "failed",
      plan,
      now,
    });
  });
}

export async function commitV3DownstreamEvidenceDecision(
  sql: Sql,
  input: Readonly<{
    envelope: ClaimEnvelopeV1;
    route: V3DownstreamEvidenceRouteResult;
    now?: Date;
  }>,
): Promise<Readonly<{
  decision: V3DownstreamOperationalDecisionV1;
  completionPlan: RuntimeCompletionPlanDescriptorV1;
}>> {
  const envelope = ClaimEnvelopeV1Schema.parse(input.envelope);
  const decision = createV3DownstreamOperationalDecision({ envelope, route: input.route });
  const completionPlan = createV3DownstreamCompletionPlan(decision);
  if (input.now && !Number.isFinite(new Date(input.now).getTime())) {
    fail("V3_DOWNSTREAM_TRANSITION_TIME_INVALID", "transition time is invalid");
  }
  if (decision.outcome === "recovery_routed") {
    await commitRecoveryRoute(sql, envelope, decision, completionPlan);
  } else {
    await commitTerminalDecision(sql, envelope, decision, completionPlan);
  }
  return Object.freeze({ decision, completionPlan });
}
