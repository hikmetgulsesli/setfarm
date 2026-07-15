import { z } from "zod";

import { AcceptedCandidateV1Schema } from "../../evidence/accepted-candidate-v1.js";
import { evaluateOperationalFailureCauseEvidenceAuthorityV1 } from "../../execution/operational-failure-cause-authority-v1.js";
import { OperationalFailureCauseV1Schema } from "../../execution/schemas/operational-failure-cause-v1.js";
import { V3DeployAuthorityEvidenceV1Schema } from "../../execution/schemas/v3-deploy-authority-evidence-v1.js";
import { V3DeployReceiptV1Schema } from "../../execution/schemas/v3-deploy-receipt-v1.js";
import { V3ProjectTransferAckV1Schema } from "../../execution/schemas/v3-project-transfer-ack-v1.js";
import {
  V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1,
  V3RecoveryTerminalReasonCodeV1Schema,
} from "../../recovery/v3-downstream-terminal-cause-v1.js";

const IdentitySchema = z.string().min(1).max(1_000);
const OptionalIdentitySchema = IdentitySchema.nullable();
const TimestampSchema = z.string().datetime({ offset: true });
const OptionalTimestampSchema = TimestampSchema.nullable();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const GitObjectHashSchema = z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/);
const CanonicalRefSchema = z.string().regex(/^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/).max(4_000);
const ReasonCodeSchema = z.string().regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/).max(160);

export const OperationalProjectionCapabilitiesV1Schema = z.object({
  attempts: z.boolean(),
  claimBinding: z.boolean(),
  runtimeOwnership: z.boolean(),
  managerCompletion: z.boolean(),
  effectLedger: z.boolean(),
  findingRecovery: z.boolean(),
  evidenceLedger: z.boolean(),
  acceptedCandidate: z.boolean(),
  deploymentReceipt: z.boolean(),
  projectTransferAck: z.boolean(),
}).strict();

export const OperationalProjectionSourceV1Schema = z.object({
  database: z.literal("postgres"),
  projection: z.enum(["complete", "partial", "unavailable"]),
  migrationVersions: z.array(z.number().int().positive()).max(1_000),
  verifiedReleaseSha: GitObjectHashSchema.nullable(),
  capabilities: OperationalProjectionCapabilitiesV1Schema,
}).strict().superRefine((value, context) => {
  const sorted = [...value.migrationVersions].sort((left, right) => left - right);
  if (new Set(sorted).size !== sorted.length || sorted.some((version, index) => version !== value.migrationVersions[index])) {
    context.addIssue({
      code: "custom",
      path: ["migrationVersions"],
      message: "Migration versions must be unique and sorted",
    });
  }
  const allCapabilities = Object.values(value.capabilities).every(Boolean);
  if (value.projection === "complete" && !allCapabilities) {
    context.addIssue({
      code: "custom",
      path: ["projection"],
      message: "A complete projection requires every operational capability",
    });
  }
});

export const OperationalRunV1Schema = z.object({
  ref: CanonicalRefSchema,
  id: IdentitySchema,
  runNumber: z.number().int().positive().nullable(),
  protocol: z.enum(["legacy", "shadow", "v3"]).nullable(),
  status: IdentitySchema,
  terminal: z.boolean(),
  updatedAt: OptionalTimestampSchema,
}).strict();

const OperatorActionV1Schema = z.object({
  allowed: z.boolean(),
  reasonCode: ReasonCodeSchema,
  stateHash: Sha256Schema,
}).strict();

export const OperationalSummaryV1Schema = z.object({
  lifecycleState: z.enum([
    "legacy_untracked",
    "idle",
    "claimed",
    "runtime_active",
    "completion_requested",
    "effects_applying",
    "settled",
    "terminal",
    "inconsistent",
  ]),
  health: z.enum(["ok", "attention", "blocked", "unavailable"]),
  activeClaims: z.number().int().nonnegative(),
  activeAttempts: z.number().int().nonnegative(),
  activeRuntimes: z.number().int().nonnegative(),
  openCompletions: z.number().int().nonnegative(),
  mandatoryEffectsPending: z.number().int().nonnegative(),
  unpublishedOutbox: z.number().int().nonnegative(),
  invariantViolations: z.number().int().nonnegative(),
  operatorActions: z.object({
    stop: OperatorActionV1Schema,
    resume: OperatorActionV1Schema,
  }).strict(),
}).strict();

export const OperationalClaimV1Schema = z.object({
  ref: CanonicalRefSchema,
  id: z.string().regex(/^[1-9][0-9]*$/),
  runRef: CanonicalRefSchema,
  stepRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema.nullable(),
  workflowStepId: IdentitySchema,
  storyId: OptionalIdentitySchema,
  agentId: IdentitySchema,
  state: z.enum(["open", "closed"]),
  outcome: OptionalIdentitySchema,
  claimedAt: TimestampSchema,
  abandonedAt: OptionalTimestampSchema,
}).strict();

const SourceRevisionV1Schema = z.object({
  sha: GitObjectHashSchema,
  treeHash: GitObjectHashSchema,
}).strict();

export const OperationalAttemptV1Schema = z.object({
  ref: CanonicalRefSchema,
  attemptId: IdentitySchema,
  runRef: CanonicalRefSchema,
  claimRef: CanonicalRefSchema.nullable(),
  stepRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema.nullable(),
  workflowStepId: IdentitySchema,
  storyId: OptionalIdentitySchema,
  generation: z.number().int().positive(),
  attemptClass: z.enum([
    "product_implementation",
    "evidence_only",
    "infrastructure_retry",
    "supervisor_repair",
  ]),
  packetHash: Sha256Schema.nullable(),
  compilationReportHash: Sha256Schema,
  sliceHash: Sha256Schema.nullable(),
  sourceBefore: SourceRevisionV1Schema,
  sourceAfter: SourceRevisionV1Schema.nullable(),
  findingSetHash: Sha256Schema.nullable(),
  role: IdentitySchema,
  agentId: OptionalIdentitySchema,
  disposition: z.enum([
    "claimed",
    "running",
    "produced_delta",
    "already_satisfied",
    "no_progress",
    "inconclusive",
    "failed",
    "verified",
    "superseded",
  ]),
  outputHash: Sha256Schema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export const OperationalRuntimeSessionV1Schema = z.object({
  ref: CanonicalRefSchema,
  sessionId: IdentitySchema,
  runRef: CanonicalRefSchema,
  claimRef: CanonicalRefSchema,
  attemptRef: CanonicalRefSchema.nullable(),
  stepRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema.nullable(),
  workflowStepId: IdentitySchema,
  storyId: OptionalIdentitySchema,
  runtimeKind: z.enum(["local_process", "openclaw_session", "external_session"]),
  state: z.enum([
    "reserved",
    "starting",
    "running",
    "drain_requested",
    "drained",
    "released",
    "quarantined",
  ]),
  stateVersion: z.number().int().positive(),
  startedAt: OptionalTimestampSchema,
  heartbeatAt: TimestampSchema,
  drainRequestedAt: OptionalTimestampSchema,
  drainedAt: OptionalTimestampSchema,
  releasedAt: OptionalTimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export const OperationalCompletionEffectV1Schema = z.object({
  ref: CanonicalRefSchema,
  effectKey: IdentitySchema,
  ordinal: z.number().int().nonnegative(),
  effectType: IdentitySchema,
  inputHash: Sha256Schema,
  mandatory: z.boolean(),
  state: z.enum(["pending", "leased", "applied", "reconciled", "quarantined"]),
  attemptCount: z.number().int().nonnegative(),
  appliedAt: OptionalTimestampSchema,
  reconciledAt: OptionalTimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export const OperationalCompletionRequestV1Schema = z.object({
  ref: CanonicalRefSchema,
  requestId: IdentitySchema,
  runRef: CanonicalRefSchema,
  runtimeSessionRef: CanonicalRefSchema,
  claimRef: CanonicalRefSchema,
  attemptRef: CanonicalRefSchema.nullable(),
  stepRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema.nullable(),
  workflowStepId: IdentitySchema,
  storyId: OptionalIdentitySchema,
  outputHash: Sha256Schema,
  applyPhase: z.enum(["proposed", "executing", "owner_committed", "effects_committed"]),
  claimOutcome: OptionalIdentitySchema,
  completionPlanHash: Sha256Schema.nullable(),
  state: z.enum(["requested", "draining", "processing", "accepted", "rejected", "quarantined"]),
  requestedAt: TimestampSchema,
  drainedAt: OptionalTimestampSchema,
  processingAt: OptionalTimestampSchema,
  acceptedAt: OptionalTimestampSchema,
  rejectedAt: OptionalTimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  effects: z.array(OperationalCompletionEffectV1Schema).max(100_000),
}).strict();

const V3DeployAuthorityCodeSchema = z.enum([
  "V3_DEPLOY_RUN_NOT_FOUND",
  "V3_DEPLOY_ACCEPTED_CANDIDATE_MISSING",
  "V3_DEPLOY_ACCEPTED_CANDIDATE_INVALID",
  "V3_DEPLOY_ACCEPTED_CANDIDATE_POINTER_MISMATCH",
  "V3_DEPLOY_SOURCE_UNAVAILABLE",
  "V3_DEPLOY_SOURCE_REVISION_MISMATCH",
  "V3_DEPLOY_PACKET_INVALID",
  "V3_DEPLOY_RUNTIME_ENV_MISSING",
  "V3_DEPLOY_TARGET_UNSUPPORTED",
  "V3_DEPLOY_PLATFORM_FAILED",
  "V3_DEPLOY_HEALTH_FAILED",
  "V3_DEPLOY_ROLLBACK_FAILED",
]);

const TerminationLifecycleEvidenceFields = {
  operationalFailureCause: OperationalFailureCauseV1Schema.optional(),
  deferredForCompletionRequestId: IdentitySchema.optional(),
  runtimeSessionCount: z.number().int().nonnegative().optional(),
  ownerInstanceId: IdentitySchema.optional(),
} as const;

export const OperationalV3DeployTerminationEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.v3-deploy-authority-termination.v1"),
  terminalFailure: z.literal(true),
  owner: z.literal("compiler"),
  refusalHash: Sha256Schema,
  authorityCode: V3DeployAuthorityCodeSchema,
  authorityEvidence: V3DeployAuthorityEvidenceV1Schema,
  claimId: z.number().int().positive(),
  modelRedispatchBudget: z.literal(0),
  ...TerminationLifecycleEvidenceFields,
}).strict();

export const OperationalV3PlanClarificationTerminationEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.v3-plan-clarification-termination.v1"),
  terminalFailure: z.literal(true),
  owner: z.literal("compiler"),
  rejectionHash: Sha256Schema,
  sourceTaskHash: Sha256Schema,
  reasonCodes: z.array(ReasonCodeSchema).min(1).max(1_000),
  requirementRefs: z.array(IdentitySchema).max(10_000),
  modelRedispatchBudget: z.literal(0),
  ...TerminationLifecycleEvidenceFields,
}).strict();

export const OperationalV3DownstreamTerminationEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.v3-downstream-termination-evidence.v1"),
  routeHash: Sha256Schema,
  packetHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  outcome: z.enum(["packet_amendment_required", "bounded_recovery_blocked"]),
  storyEvidenceRefs: z.array(CanonicalRefSchema).max(10_000),
  requiredArtifact: z.literal("setfarm.product-build-packet.v.next").optional(),
  terminalReasonCodes: z.array(V3RecoveryTerminalReasonCodeV1Schema)
    .min(1)
    .max(V3_RECOVERY_TERMINAL_REASON_CARDINALITY_V1)
    .optional(),
  ...TerminationLifecycleEvidenceFields,
}).strict().superRefine((value, context) => {
  if ((value.outcome === "packet_amendment_required") !== Boolean(value.requiredArtifact)) {
    context.addIssue({
      code: "custom",
      path: ["requiredArtifact"],
      message: "Only packet-amendment termination may require the next packet artifact",
    });
  }
  if ((value.outcome === "bounded_recovery_blocked") !== Boolean(value.terminalReasonCodes)) {
    context.addIssue({
      code: "custom",
      path: ["terminalReasonCodes"],
      message: "Only bounded recovery termination must carry exact terminal reasons",
    });
  }
});

export const OperationalV3StageInputUnresolvedTerminationEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-input-unresolved.v1"),
  missingVariables: z.array(z.string().min(1).max(500).regex(/^[a-z0-9_]+$/))
    .min(1)
    .max(1_000),
  modelRedispatchBudget: z.literal(0),
  ...TerminationLifecycleEvidenceFields,
}).strict();

export const OperationalV3StageRetryDedupeTerminationEvidenceV1Schema = z.object({
  schema: z.literal("setfarm.v3-stage-retry-dedupe-block.v1"),
  dedupeKey: Sha256Schema,
  modelRedispatchBudget: z.literal(0),
  ...TerminationLifecycleEvidenceFields,
}).strict();

export const OperationalTerminationEvidenceV1Schema = z.record(z.string(), z.unknown());

export const OperationalTerminationRequestV1Schema = z.object({
  ref: CanonicalRefSchema,
  requestId: IdentitySchema,
  runRef: CanonicalRefSchema,
  targetStatus: z.enum(["cancelled", "failed"]),
  state: z.enum(["requested", "draining", "drained", "terminalized", "quarantined"]),
  requestedBy: z.string().min(1).max(500),
  diagnostic: z.string().min(1).max(4_000),
  evidence: OperationalTerminationEvidenceV1Schema,
  requestedAt: TimestampSchema,
  drainedAt: OptionalTimestampSchema,
  terminalizedAt: OptionalTimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  if (Object.hasOwn(value.evidence, "schema") && typeof value.evidence.schema !== "string") {
    context.addIssue({
      code: "custom",
      path: ["evidence", "schema"],
      message: "Versioned termination evidence schema must be a string",
    });
    return;
  }
  const evidenceSchema = typeof value.evidence.schema === "string" ? value.evidence.schema : null;
  const failureCauseResult = Object.hasOwn(value.evidence, "operationalFailureCause")
    ? OperationalFailureCauseV1Schema.safeParse(value.evidence.operationalFailureCause)
    : null;
  if (failureCauseResult && !failureCauseResult.success) {
    for (const issue of failureCauseResult.error.issues) {
      context.addIssue({
        code: "custom",
        path: ["evidence", "operationalFailureCause", ...issue.path],
        message: issue.message,
      });
    }
    return;
  }
  if (value.targetStatus === "cancelled" && failureCauseResult?.success) {
    context.addIssue({
      code: "custom",
      path: ["evidence", "operationalFailureCause"],
      message: "Cancelled termination cannot carry an operational failure cause",
    });
    return;
  }
  if (failureCauseResult?.success) {
    const authority = evaluateOperationalFailureCauseEvidenceAuthorityV1({
      requestedBy: value.requestedBy,
      cause: failureCauseResult.data,
      evidence: value.evidence,
    });
    if (!authority.trusted) {
      context.addIssue({
        code: "custom",
        path: ["evidence", "operationalFailureCause"],
        message: `Operational failure cause lacks canonical producer authority: ${authority.reasonCode}`,
      });
      return;
    }
  }
  const knownEvidence = new Map<string, Readonly<{
    requestedBy: string;
    schema: z.ZodTypeAny;
  }>>([
    ["setfarm.v3-deploy-authority-termination.v1", {
      requestedBy: "setfarm.product-compiler.deploy-refusal",
      schema: OperationalV3DeployTerminationEvidenceV1Schema,
    }],
    ["setfarm.v3-plan-clarification-termination.v1", {
      requestedBy: "setfarm.product-compiler.plan-refusal",
      schema: OperationalV3PlanClarificationTerminationEvidenceV1Schema,
    }],
    ["setfarm.v3-downstream-termination-evidence.v1", {
      requestedBy: "setfarm-v3-downstream-compiler",
      schema: OperationalV3DownstreamTerminationEvidenceV1Schema,
    }],
    ["setfarm.v3-stage-input-unresolved.v1", {
      requestedBy: "setfarm.v3-stage-input-authority",
      schema: OperationalV3StageInputUnresolvedTerminationEvidenceV1Schema,
    }],
    ["setfarm.v3-stage-retry-dedupe-block.v1", {
      requestedBy: "setfarm.v3-stage-retry-authority",
      schema: OperationalV3StageRetryDedupeTerminationEvidenceV1Schema,
    }],
  ]);
  const expectedByRequester = [...knownEvidence.entries()].find(([, entry]) => entry.requestedBy === value.requestedBy);
  if (expectedByRequester && evidenceSchema !== expectedByRequester[0]) {
    context.addIssue({
      code: "custom",
      path: ["evidence", "schema"],
      message: "Typed compiler termination requester requires its exact versioned evidence schema",
    });
    return;
  }
  const known = evidenceSchema ? knownEvidence.get(evidenceSchema) : undefined;
  if (known) {
    if (value.requestedBy !== known.requestedBy || value.targetStatus !== "failed") {
      context.addIssue({
        code: "custom",
        path: ["requestedBy"],
        message: "Typed compiler termination evidence is bound to its exact failed-request authority",
      });
    }
    const evidenceResult = known.schema.safeParse(value.evidence);
    if (!evidenceResult.success) {
      for (const issue of evidenceResult.error.issues) {
        context.addIssue({
          code: "custom",
          path: ["evidence", ...issue.path],
          message: issue.message,
        });
      }
    }
  } else if (evidenceSchema?.startsWith("setfarm.v3-")) {
    context.addIssue({
      code: "custom",
      path: ["evidence", "schema"],
      message: "Unknown versioned v3 termination evidence schema",
    });
  }
});

export const OperationalOutboxItemV1Schema = z.object({
  ref: CanonicalRefSchema,
  outboxId: IdentitySchema,
  requestRef: CanonicalRefSchema.nullable(),
  eventKey: IdentitySchema,
  eventType: IdentitySchema,
  aggregateType: IdentitySchema,
  aggregateId: IdentitySchema,
  state: z.enum(["pending", "leased", "published", "quarantined"]),
  attemptCount: z.number().int().nonnegative(),
  publishedAt: OptionalTimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export const OperationalInvariantV1Schema = z.object({
  code: ReasonCodeSchema,
  severity: z.enum(["warning", "error"]),
  refs: z.array(CanonicalRefSchema).min(1).max(100),
  observedAt: TimestampSchema,
}).strict();

const FindingIdSchema = z.string().regex(/^FIND_[a-f0-9]{64}$/);
const FindingSetIdSchema = z.string().regex(/^FSET_[a-f0-9]{64}$/);
const EvidenceBundleIdSchema = z.string().regex(/^EVB_[a-f0-9]{64}$/);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);
const MachineReasonCodeSchema = z.string().regex(/^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z][a-z0-9]*(?:_[a-z0-9]+)*)$/).max(160);
const RecoveryTerminalReasonCodeSchema = z.enum([
  "evidence_satisfied",
  "specification_incomplete",
  "evidence_inconclusive",
  "budget_exhausted",
  "source_superseded",
  "upstream_recompile_required",
  "operator_required",
]);
const FindingIdsSchema = z.array(FindingIdSchema).min(1).max(5_000).superRefine((values, context) => {
  const canonical = [...new Set(values)].sort();
  if (canonical.length !== values.length || values.some((value, index) => value !== canonical[index])) {
    context.addIssue({ code: "custom", message: "Finding IDs must be unique and canonically sorted" });
  }
});

export const OperationalFindingSetV1Schema = z.object({
  ref: CanonicalRefSchema,
  findingSetId: FindingSetIdSchema,
  findingSetHash: Sha256Schema,
  runRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema,
  storyId: IdentitySchema,
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  findingIds: FindingIdsSchema,
  createdAt: TimestampSchema,
}).strict();

export const OperationalEvidenceBundleV1Schema = z.object({
  ref: CanonicalRefSchema,
  evidenceId: EvidenceBundleIdSchema,
  evidenceBundleHash: Sha256Schema,
  runRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema,
  storyId: IdentitySchema,
  attemptRef: CanonicalRefSchema.nullable(),
  attemptId: AttemptIdSchema.nullable(),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  aggregateVerdict: z.enum(["pass", "fail", "inconclusive", "incomplete"]),
  predicateCount: z.number().int().positive(),
  observationCount: z.number().int().positive(),
  createdAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  if (Boolean(value.attemptRef) !== Boolean(value.attemptId)) {
    context.addIssue({ code: "custom", path: ["attemptRef"], message: "Evidence attempt ref and ID must be paired" });
  }
});

export const OperationalRecoveryBudgetV1Schema = z.object({
  limits: z.object({
    implement: z.number().int().min(0).max(1),
    supervisorRepair: z.number().int().min(0).max(1),
    evidenceOnly: z.number().int().min(0).max(3),
  }).strict(),
  used: z.object({
    implement: z.number().int().min(0).max(1),
    supervisorRepair: z.number().int().min(0).max(1),
    evidenceOnly: z.number().int().min(0).max(3),
  }).strict(),
}).strict().superRefine((value, context) => {
  for (const key of ["implement", "supervisorRepair", "evidenceOnly"] as const) {
    if (value.used[key] > value.limits[key]) {
      context.addIssue({ code: "custom", path: ["used", key], message: "Recovery usage exceeds its bounded limit" });
    }
  }
});

export const OperationalRecoveryCaseV1Schema = z.object({
  ref: CanonicalRefSchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionRef: CanonicalRefSchema,
  revisionId: RecoveryRevisionIdSchema,
  revisionNumber: z.number().int().positive(),
  runRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema,
  storyId: IdentitySchema,
  findingSetRef: CanonicalRefSchema,
  findingSetHash: Sha256Schema,
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  owner: z.enum(["implement", "supervisor", "compiler", "infrastructure", "operator"]),
  expectedDeltaKind: z.enum(["source_change", "evidence_refresh", "upstream_recompile", "operator_action"]),
  status: z.enum(["open", "repairing", "evidencing", "resolved", "blocked", "superseded"]),
  budget: OperationalRecoveryBudgetV1Schema,
  stateVersion: z.number().int().positive(),
  terminalReasonCode: RecoveryTerminalReasonCodeSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  const terminal = ["resolved", "blocked", "superseded"].includes(value.status);
  if (terminal !== Boolean(value.terminalReasonCode)) {
    context.addIssue({ code: "custom", path: ["terminalReasonCode"], message: "Recovery terminal reason must match case state" });
  }
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) {
    context.addIssue({ code: "custom", path: ["updatedAt"], message: "Recovery update cannot precede creation" });
  }
});

export const OperationalRecoveryDispatchV1Schema = z.object({
  ref: CanonicalRefSchema,
  dispatchId: RecoveryDispatchIdSchema,
  recoveryCaseRef: CanonicalRefSchema,
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionRef: CanonicalRefSchema,
  revisionId: RecoveryRevisionIdSchema,
  revisionNumber: z.number().int().positive(),
  runRef: CanonicalRefSchema,
  storyRef: CanonicalRefSchema,
  storyId: IdentitySchema,
  findingSetRef: CanonicalRefSchema,
  findingSetHash: Sha256Schema,
  dispatchClass: z.enum(["product_implementation", "supervisor_repair", "evidence_only"]),
  packetHash: Sha256Schema,
  sliceHash: Sha256Schema,
  sourceRevision: SourceRevisionV1Schema,
  findingIds: FindingIdsSchema,
  deliveryState: z.enum(["authorized", "leased", "attempt_reserved", "running", "succeeded", "failed", "blocked", "superseded"]),
  attemptRef: CanonicalRefSchema.nullable(),
  attemptId: AttemptIdSchema.nullable(),
  claimRef: CanonicalRefSchema.nullable(),
  executionSliceHash: Sha256Schema.nullable(),
  attemptCount: z.number().int().nonnegative(),
  leaseOwnerInstanceId: IdentitySchema.nullable(),
  leaseExpiresAt: TimestampSchema.nullable(),
  terminalReasonCode: MachineReasonCodeSchema.nullable(),
  authorizedAt: TimestampSchema,
  terminalAt: TimestampSchema.nullable(),
}).strict().superRefine((value, context) => {
  const attemptFields = [value.attemptRef, value.attemptId, value.claimRef].filter(Boolean).length;
  if (attemptFields !== 0 && attemptFields !== 3) {
    context.addIssue({ code: "custom", path: ["attemptRef"], message: "Delivery attempt and claim refs must be jointly present" });
  }
  const leaseFields = [value.leaseOwnerInstanceId, value.leaseExpiresAt].filter(Boolean).length;
  if ((value.deliveryState === "authorized" && leaseFields !== 0) || (value.deliveryState !== "authorized" && leaseFields !== 2)) {
    context.addIssue({ code: "custom", path: ["leaseOwnerInstanceId"], message: "Delivery lease projection must match its state" });
  }
  const requiresAttempt = ["attempt_reserved", "running", "succeeded", "failed"].includes(value.deliveryState);
  if (requiresAttempt && (attemptFields !== 3 || !value.executionSliceHash)) {
    context.addIssue({ code: "custom", path: ["attemptRef"], message: "Attempt delivery state requires exact attempt and execution slice" });
  }
  const terminal = ["succeeded", "failed", "blocked", "superseded"].includes(value.deliveryState);
  if (terminal !== Boolean(value.terminalAt)) {
    context.addIssue({ code: "custom", path: ["terminalAt"], message: "Delivery terminal timestamp must match its state" });
  }
  if (!terminal && value.terminalReasonCode) {
    context.addIssue({ code: "custom", path: ["terminalReasonCode"], message: "Only terminal delivery may expose a reason" });
  }
});

export const OperationalAcceptedCandidateV1Schema = z.object({
  ref: CanonicalRefSchema,
  candidate: AcceptedCandidateV1Schema,
  createdAt: TimestampSchema,
}).strict();

export const OperationalV3DeployReceiptV1Schema = z.object({
  ref: CanonicalRefSchema,
  receipt: V3DeployReceiptV1Schema,
  createdAt: TimestampSchema,
}).strict();

export const OperationalV3ProjectTransferAckV1Schema = z.object({
  ref: CanonicalRefSchema,
  acknowledgement: V3ProjectTransferAckV1Schema,
  createdAt: TimestampSchema,
}).strict();

export const RunOperationalSnapshotV1Schema = z.object({
  schema: z.literal("setfarm.run-operational-snapshot.v1"),
  generatedAt: TimestampSchema,
  snapshotHash: Sha256Schema,
  source: OperationalProjectionSourceV1Schema,
  run: OperationalRunV1Schema,
  summary: OperationalSummaryV1Schema,
  claims: z.array(OperationalClaimV1Schema).max(100_000),
  attempts: z.array(OperationalAttemptV1Schema).max(100_000),
  runtimeSessions: z.array(OperationalRuntimeSessionV1Schema).max(100_000),
  completionRequests: z.array(OperationalCompletionRequestV1Schema).max(100_000),
  terminationRequests: z.array(OperationalTerminationRequestV1Schema).max(100_000),
  outbox: z.array(OperationalOutboxItemV1Schema).max(100_000),
  invariants: z.array(OperationalInvariantV1Schema).max(100_000),
  findingSets: z.array(OperationalFindingSetV1Schema).max(100_000).optional(),
  evidenceBundles: z.array(OperationalEvidenceBundleV1Schema).max(100_000).optional(),
  recoveryCases: z.array(OperationalRecoveryCaseV1Schema).max(100_000).optional(),
  recoveryDispatches: z.array(OperationalRecoveryDispatchV1Schema).max(100_000).optional(),
  acceptedCandidate: OperationalAcceptedCandidateV1Schema.nullable().optional(),
  deploymentReceipt: OperationalV3DeployReceiptV1Schema.nullable().optional(),
  projectTransferAck: OperationalV3ProjectTransferAckV1Schema.nullable().optional(),
}).strict().superRefine((value, context) => {
  const violationCount = value.invariants.length;
  if (value.summary.invariantViolations !== violationCount) {
    context.addIssue({
      code: "custom",
      path: ["summary", "invariantViolations"],
      message: "Invariant summary count does not match the projected invariant list",
    });
  }
  if (value.source.projection === "unavailable" && value.summary.health !== "unavailable") {
    context.addIssue({
      code: "custom",
      path: ["summary", "health"],
      message: "An unavailable source requires unavailable health",
    });
  }
  if (value.summary.lifecycleState === "inconsistent" && !value.invariants.some((item) => item.severity === "error")) {
    context.addIssue({
      code: "custom",
      path: ["summary", "lifecycleState"],
      message: "An inconsistent lifecycle requires an error invariant",
    });
  }
  const findingCollections = [value.findingSets, value.recoveryCases, value.recoveryDispatches];
  if (value.source.capabilities.findingRecovery !== findingCollections.every((collection) => collection !== undefined)) {
    context.addIssue({ code: "custom", path: ["findingSets"], message: "Finding-recovery collections must match capability" });
  }
  if (!value.source.capabilities.findingRecovery && findingCollections.some((collection) => collection !== undefined)) {
    context.addIssue({ code: "custom", path: ["findingSets"], message: "Unsupported recovery projection must remain absent" });
  }
  if (value.source.capabilities.evidenceLedger !== (value.evidenceBundles !== undefined)) {
    context.addIssue({ code: "custom", path: ["evidenceBundles"], message: "Evidence collection must match capability" });
  }
  if (value.source.capabilities.acceptedCandidate !== (value.acceptedCandidate !== undefined)) {
    context.addIssue({ code: "custom", path: ["acceptedCandidate"], message: "Accepted candidate projection must match capability" });
  }
  if (value.source.capabilities.deploymentReceipt !== (value.deploymentReceipt !== undefined)) {
    context.addIssue({ code: "custom", path: ["deploymentReceipt"], message: "Deployment receipt projection must match capability" });
  }
  if (value.source.capabilities.deploymentReceipt
    && (!value.source.capabilities.acceptedCandidate || !value.source.capabilities.effectLedger)) {
    context.addIssue({ code: "custom", path: ["source", "capabilities", "deploymentReceipt"], message: "Deployment receipt requires accepted-candidate and effect ledgers" });
  }
  if (value.source.capabilities.projectTransferAck !== (value.projectTransferAck !== undefined)) {
    context.addIssue({ code: "custom", path: ["projectTransferAck"], message: "Project transfer acknowledgement projection must match capability" });
  }
  if (value.source.capabilities.projectTransferAck
    && (!value.source.capabilities.acceptedCandidate || !value.source.capabilities.deploymentReceipt)) {
    context.addIssue({ code: "custom", path: ["source", "capabilities", "projectTransferAck"], message: "Project transfer acknowledgement requires candidate and deployment receipt authority" });
  }

  const runRef = value.run.ref;
  const findingSets = value.findingSets ?? [];
  const evidenceBundles = value.evidenceBundles ?? [];
  const recoveryCases = value.recoveryCases ?? [];
  const recoveryDispatches = value.recoveryDispatches ?? [];
  const collections = [findingSets, evidenceBundles, recoveryCases, recoveryDispatches] as const;
  collections.forEach((collection, collectionIndex) => collection.forEach((item, itemIndex) => {
    if (item.runRef !== runRef) {
      context.addIssue({ code: "custom", path: [["findingSets", "evidenceBundles", "recoveryCases", "recoveryDispatches"][collectionIndex], itemIndex, "runRef"], message: "Projection row must bind the exact run" });
    }
  }));

  const findingSetByHash = new Map(findingSets.map((item) => [item.findingSetHash, item]));
  recoveryCases.forEach((item, index) => {
    const findingSet = findingSetByHash.get(item.findingSetHash);
    if (!findingSet
      || item.findingSetRef !== findingSet.ref
      || item.storyRef !== findingSet.storyRef
      || item.storyId !== findingSet.storyId
      || item.packetHash !== findingSet.packetHash
      || item.sliceHash !== findingSet.sliceHash
      || item.sourceRevision.sha !== findingSet.sourceRevision.sha
      || item.sourceRevision.treeHash !== findingSet.sourceRevision.treeHash) {
      context.addIssue({ code: "custom", path: ["recoveryCases", index], message: "Current revision must bind its exact finding-set identity" });
    }
  });
  const recoveryCaseById = new Map(recoveryCases.map((item) => [item.recoveryCaseId, item]));
  recoveryDispatches.forEach((item, index) => {
    const recoveryCase = recoveryCaseById.get(item.recoveryCaseId);
    const findingSet = findingSetByHash.get(item.findingSetHash);
    if (!recoveryCase || item.recoveryCaseRef !== recoveryCase.ref || item.storyId !== recoveryCase.storyId || item.storyRef !== recoveryCase.storyRef) {
      context.addIssue({ code: "custom", path: ["recoveryDispatches", index, "recoveryCaseRef"], message: "Delivery must bind its recovery case" });
    }
    if (!findingSet
      || item.findingSetRef !== findingSet.ref
      || item.storyId !== findingSet.storyId
      || item.storyRef !== findingSet.storyRef
      || item.packetHash !== findingSet.packetHash
      || item.sliceHash !== findingSet.sliceHash
      || item.sourceRevision.sha !== findingSet.sourceRevision.sha
      || item.sourceRevision.treeHash !== findingSet.sourceRevision.treeHash
      || item.findingIds.some((findingId) => !findingSet.findingIds.includes(findingId))) {
      context.addIssue({ code: "custom", path: ["recoveryDispatches", index], message: "Delivery must bind its revision finding-set identity" });
    }
  });

  const acceptedCandidate = value.acceptedCandidate?.candidate;
  if (acceptedCandidate) {
    if (value.run.protocol !== "v3" || acceptedCandidate.runId !== value.run.id) {
      context.addIssue({ code: "custom", path: ["acceptedCandidate", "candidate", "runId"], message: "Accepted candidate must bind the exact v3 run" });
    }
    if (value.acceptedCandidate?.ref !== `setfarm://accepted-candidate/${acceptedCandidate.candidateHash}`) {
      context.addIssue({ code: "custom", path: ["acceptedCandidate", "ref"], message: "Accepted candidate ref must bind its hash" });
    }
    const attemptById = new Map(value.attempts.map((attempt) => [attempt.attemptId, attempt]));
    const evidenceByHash = new Map(evidenceBundles.map((bundle) => [bundle.evidenceBundleHash, bundle]));
    acceptedCandidate.storyEvidence.forEach((story, index) => {
      const attempt = attemptById.get(story.attemptId);
      const evidence = evidenceByHash.get(story.evidenceBundleHash);
      if (!attempt
        || attempt.storyId !== story.storyId
        || attempt.attemptClass !== "evidence_only"
        || attempt.packetHash !== acceptedCandidate.packetHash
        || attempt.sliceHash !== story.sliceHash
        || attempt.disposition !== "verified"
        || attempt.outputHash !== story.evidenceBundleHash
        || attempt.sourceAfter?.sha !== acceptedCandidate.sourceRevision.sha
        || attempt.sourceAfter?.treeHash !== acceptedCandidate.sourceRevision.treeHash) {
        context.addIssue({ code: "custom", path: ["acceptedCandidate", "candidate", "storyEvidence", index, "attemptId"], message: "Accepted story must bind a verified final-source evidence attempt" });
      }
      if (!evidence
        || evidence.storyId !== story.storyId
        || evidence.attemptId !== story.attemptId
        || evidence.packetHash !== acceptedCandidate.packetHash
        || evidence.sliceHash !== story.sliceHash
        || evidence.aggregateVerdict !== "pass"
        || evidence.sourceRevision.sha !== acceptedCandidate.sourceRevision.sha
        || evidence.sourceRevision.treeHash !== acceptedCandidate.sourceRevision.treeHash) {
        context.addIssue({ code: "custom", path: ["acceptedCandidate", "candidate", "storyEvidence", index, "evidenceBundleHash"], message: "Accepted story must bind its canonical passing final-source evidence bundle" });
      }
    });
  }
  const successfulV3 = value.run.protocol === "v3"
    && value.run.terminal
    && ["completed", "done"].includes(value.run.status.toLowerCase());
  if (value.source.capabilities.acceptedCandidate && successfulV3 && !acceptedCandidate
    && !value.invariants.some((invariant) => invariant.code === "SUCCESSFUL_V3_RUN_MISSING_ACCEPTED_CANDIDATE")) {
    context.addIssue({ code: "custom", path: ["acceptedCandidate"], message: "A successful v3 run without an accepted candidate must be inconsistent" });
  }
  const deploymentReceipt = value.deploymentReceipt?.receipt;
  if (deploymentReceipt) {
    if (!acceptedCandidate
      || value.run.protocol !== "v3"
      || deploymentReceipt.runId !== value.run.id
      || deploymentReceipt.candidateId !== acceptedCandidate.candidateId
      || deploymentReceipt.candidateHash !== acceptedCandidate.candidateHash
      || deploymentReceipt.packetHash !== acceptedCandidate.packetHash
      || deploymentReceipt.sourceBefore.sha !== acceptedCandidate.sourceRevision.sha
      || deploymentReceipt.sourceBefore.treeHash !== acceptedCandidate.sourceRevision.treeHash
      || deploymentReceipt.sourceAfter.sha !== acceptedCandidate.sourceRevision.sha
      || deploymentReceipt.sourceAfter.treeHash !== acceptedCandidate.sourceRevision.treeHash) {
      context.addIssue({ code: "custom", path: ["deploymentReceipt", "receipt"], message: "Deployment receipt must bind the exact run AcceptedCandidate source" });
    }
    if (value.deploymentReceipt?.ref !== `setfarm://v3-deploy-receipts/${deploymentReceipt.receiptHash}`) {
      context.addIssue({ code: "custom", path: ["deploymentReceipt", "ref"], message: "Deployment receipt ref must bind its hash" });
    }
  }
  const projectTransferAck = value.projectTransferAck?.acknowledgement;
  if (projectTransferAck) {
    if (!acceptedCandidate
      || !deploymentReceipt
      || value.run.protocol !== "v3"
      || projectTransferAck.runId !== value.run.id
      || projectTransferAck.candidateId !== acceptedCandidate.candidateId
      || projectTransferAck.candidateHash !== acceptedCandidate.candidateHash
      || projectTransferAck.packetHash !== acceptedCandidate.packetHash
      || projectTransferAck.sourceRevision.sha !== acceptedCandidate.sourceRevision.sha
      || projectTransferAck.sourceRevision.treeHash !== acceptedCandidate.sourceRevision.treeHash
      || projectTransferAck.deploymentReceiptHash !== deploymentReceipt.receiptHash
      || projectTransferAck.deploymentReceiptRef !== value.deploymentReceipt?.ref) {
      context.addIssue({ code: "custom", path: ["projectTransferAck", "acknowledgement"], message: "Project transfer acknowledgement must bind the exact candidate and deploy receipt" });
    }
    if (value.projectTransferAck?.ref !== `setfarm://v3-project-transfer-acks/${projectTransferAck.ackHash}`) {
      context.addIssue({ code: "custom", path: ["projectTransferAck", "ref"], message: "Project transfer acknowledgement ref must bind its hash" });
    }
  }
});

export type OperationalProjectionCapabilitiesV1 = z.infer<typeof OperationalProjectionCapabilitiesV1Schema>;
export type OperationalProjectionSourceV1 = z.infer<typeof OperationalProjectionSourceV1Schema>;
export type OperationalRunV1 = z.infer<typeof OperationalRunV1Schema>;
export type OperationalSummaryV1 = z.infer<typeof OperationalSummaryV1Schema>;
export type OperationalClaimV1 = z.infer<typeof OperationalClaimV1Schema>;
export type OperationalAttemptV1 = z.infer<typeof OperationalAttemptV1Schema>;
export type OperationalRuntimeSessionV1 = z.infer<typeof OperationalRuntimeSessionV1Schema>;
export type OperationalCompletionEffectV1 = z.infer<typeof OperationalCompletionEffectV1Schema>;
export type OperationalCompletionRequestV1 = z.infer<typeof OperationalCompletionRequestV1Schema>;
export type OperationalV3DeployTerminationEvidenceV1 = z.infer<typeof OperationalV3DeployTerminationEvidenceV1Schema>;
export type OperationalV3PlanClarificationTerminationEvidenceV1 = z.infer<typeof OperationalV3PlanClarificationTerminationEvidenceV1Schema>;
export type OperationalV3DownstreamTerminationEvidenceV1 = z.infer<typeof OperationalV3DownstreamTerminationEvidenceV1Schema>;
export type OperationalTerminationEvidenceV1 = z.infer<typeof OperationalTerminationEvidenceV1Schema>;
export type OperationalTerminationRequestV1 = z.infer<typeof OperationalTerminationRequestV1Schema>;
export type OperationalOutboxItemV1 = z.infer<typeof OperationalOutboxItemV1Schema>;
export type OperationalInvariantV1 = z.infer<typeof OperationalInvariantV1Schema>;
export type OperationalFindingSetV1 = z.infer<typeof OperationalFindingSetV1Schema>;
export type OperationalEvidenceBundleV1 = z.infer<typeof OperationalEvidenceBundleV1Schema>;
export type OperationalRecoveryBudgetV1 = z.infer<typeof OperationalRecoveryBudgetV1Schema>;
export type OperationalRecoveryCaseV1 = z.infer<typeof OperationalRecoveryCaseV1Schema>;
export type OperationalRecoveryDispatchV1 = z.infer<typeof OperationalRecoveryDispatchV1Schema>;
export type OperationalAcceptedCandidateV1 = z.infer<typeof OperationalAcceptedCandidateV1Schema>;
export type OperationalV3DeployReceiptV1 = z.infer<typeof OperationalV3DeployReceiptV1Schema>;
export type OperationalV3ProjectTransferAckV1 = z.infer<typeof OperationalV3ProjectTransferAckV1Schema>;
export type RunOperationalSnapshotV1 = z.infer<typeof RunOperationalSnapshotV1Schema>;
