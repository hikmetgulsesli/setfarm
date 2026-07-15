import { z } from "zod";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "../product-compiler/schemas/common-v1.js";
import {
  ConvergenceProductClassV1Schema,
  ConvergenceRuntimeAdapterV1Schema,
  ConvergenceStackPackV1Schema,
} from "./suite-schema.js";
import { TaskIntentOracleEvaluationV1Schema } from "./task-intent-oracle.js";

const TimestampSchema = z.string().datetime({ offset: true });
const SlugSchema = z.string().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ReasonCodeSchema = z.string().min(3).max(160).regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/);

export const ConvergencePreflightCheckIdV1Schema = z.enum([
  "release_identity",
  "release_cleanliness",
  "migration_attestation",
  "database_ownership",
  "setfarm_health",
  "mission_control_health",
  "execution_profile",
  "result_store",
]);

export const ConvergencePreflightCheckV1Schema = z.object({
  id: ConvergencePreflightCheckIdV1Schema,
  status: z.enum(["pass", "fail"]),
  code: ReasonCodeSchema,
  evidenceHash: Sha256Schema,
}).strict();

export const ConvergencePreflightV1Schema = z.object({
  status: z.enum(["pass", "fail"]),
  checks: z.array(ConvergencePreflightCheckV1Schema).length(8),
  preflightHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.checks.map((item) => item.id))) {
    context.addIssue({ code: "custom", path: ["checks"], message: "Preflight check IDs must be unique" });
  }
  const calculatedStatus = value.checks.some((item) => item.status === "fail") ? "fail" : "pass";
  if (value.status !== calculatedStatus) {
    context.addIssue({ code: "custom", path: ["status"], message: "Preflight status must reduce its checks" });
  }
  const payload = { status: value.status, checks: value.checks };
  if (value.preflightHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["preflightHash"], message: "Preflight hash mismatch" });
  }
});

const PacketEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  packetHash: Sha256Schema.nullable(),
  casAuditHash: Sha256Schema,
  casDeepVerified: z.boolean(),
  sealedStackPackId: ConvergenceStackPackV1Schema.nullable(),
  packetRows: z.number().int().nonnegative(),
  artifactRefs: z.number().int().nonnegative(),
  missingRequiredRefs: z.number().int().nonnegative(),
  missingArtifacts: z.number().int().nonnegative(),
  invalidBindings: z.number().int().nonnegative(),
}).strict();

const AttemptEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  attempts: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  duplicateActiveTuples: z.number().int().nonnegative(),
  staleOwnership: z.number().int().nonnegative(),
  incompleteBindings: z.number().int().nonnegative(),
}).strict();

const FindingEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  findingSets: z.number().int().nonnegative(),
  openFindings: z.number().int().nonnegative(),
  invalidBindings: z.number().int().nonnegative(),
}).strict();

const RecoveryEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  cases: z.number().int().nonnegative(),
  activeCases: z.number().int().nonnegative(),
  activeDeliveries: z.number().int().nonnegative(),
  overBudget: z.number().int().nonnegative(),
  invalidBindings: z.number().int().nonnegative(),
}).strict();

const EvidenceLedgerV1Schema = z.object({
  stateHash: Sha256Schema,
  predicateCoverageHash: Sha256Schema,
  bundles: z.number().int().nonnegative(),
  passing: z.number().int().nonnegative(),
  nonPassing: z.number().int().nonnegative(),
  missingAttemptEvidence: z.number().int().nonnegative(),
  invalidBindings: z.number().int().nonnegative(),
  missingExpectedPredicates: z.number().int().nonnegative(),
  unexpectedProductPredicates: z.number().int().nonnegative(),
  missingInvariantRefs: z.number().int().nonnegative(),
  nonPassingRequiredPredicates: z.number().int().nonnegative(),
}).strict();

const AcceptedCandidateEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  candidateHash: Sha256Schema.nullable(),
  candidates: z.number().int().nonnegative(),
  storyEvidence: z.number().int().nonnegative(),
  sourceSha: GitObjectHashSchema.nullable(),
  sourceTreeHash: GitObjectHashSchema.nullable(),
  invalidBindings: z.number().int().nonnegative(),
}).strict();

export const ConvergenceCanonicalEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  packet: PacketEvidenceV1Schema,
  attempts: AttemptEvidenceV1Schema,
  findings: FindingEvidenceV1Schema,
  recovery: RecoveryEvidenceV1Schema,
  evidence: EvidenceLedgerV1Schema,
  acceptance: AcceptedCandidateEvidenceV1Schema,
  oracle: TaskIntentOracleEvaluationV1Schema,
  invariantCodes: z.array(ReasonCodeSchema).max(100_000).refine(hasUniqueStrings, {
    message: "Canonical invariant codes must be unique",
  }),
}).strict();

const ProjectionCapabilitiesV1Schema = z.object({
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

export const ConvergenceProjectionEvidenceV1Schema = z.object({
  setfarmSnapshotHash: Sha256Schema,
  missionControlSnapshotHash: Sha256Schema,
  exactHashMatch: z.boolean(),
  setfarmProjection: z.enum(["complete", "partial", "unavailable"]),
  missionControlProjection: z.enum(["complete", "partial", "unavailable"]),
  capabilities: ProjectionCapabilitiesV1Schema,
  operationalSettled: z.boolean(),
  transferAcknowledged: z.boolean(),
  projectTransferAckHash: Sha256Schema.nullable(),
  projectRecordHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  const hasTransferIdentity = value.projectTransferAckHash !== null && value.projectRecordHash !== null;
  if (value.transferAcknowledged !== hasTransferIdentity) {
    context.addIssue({ code: "custom", path: ["transferAcknowledged"], message: "Transfer acknowledgement must bind both canonical hashes" });
  }
});

export const ConvergenceOwnershipEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  openClaims: z.number().int().nonnegative(),
  activeAttempts: z.number().int().nonnegative(),
  activeRuntimes: z.number().int().nonnegative(),
  activeRecoveryDeliveries: z.number().int().nonnegative(),
  projectIdentityState: z.enum(["not_applicable", "provisional", "verified", "invalid"]).optional(),
  workingTreeDirty: z.boolean().optional(),
  manualProjectMutationDetected: z.boolean(),
  sourceHeadMatchesCanonical: z.boolean(),
  projectHeadSha: GitObjectHashSchema.nullable(),
  projectTreeHash: GitObjectHashSchema.nullable(),
  canonicalHeadSha: GitObjectHashSchema.nullable(),
  canonicalTreeHash: GitObjectHashSchema.nullable(),
}).strict().superRefine((value, context) => {
  const identityState = value.projectIdentityState ?? (
    value.sourceHeadMatchesCanonical
      ? value.projectHeadSha ? "verified" : "not_applicable"
      : "invalid"
  );
  if (value.manualProjectMutationDetected && identityState !== "invalid") {
    context.addIssue({ code: "custom", path: ["manualProjectMutationDetected"], message: "Manual mutation evidence requires invalid project identity" });
  }
  if (identityState === "verified" && (
    !value.sourceHeadMatchesCanonical
    || !value.projectHeadSha
    || !value.projectTreeHash
    || !value.canonicalHeadSha
    || !value.canonicalTreeHash
  )) {
    context.addIssue({ code: "custom", path: ["projectIdentityState"], message: "Verified project identity requires exact project and canonical revisions" });
  }
  if (identityState === "provisional" && (
    value.sourceHeadMatchesCanonical
    || value.canonicalHeadSha !== null
    || value.canonicalTreeHash !== null
  )) {
    context.addIssue({ code: "custom", path: ["projectIdentityState"], message: "Provisional project identity cannot claim a canonical accepted revision" });
  }
  if (identityState === "not_applicable" && (
    !value.sourceHeadMatchesCanonical
    || value.projectHeadSha !== null
    || value.projectTreeHash !== null
    || value.canonicalHeadSha !== null
    || value.canonicalTreeHash !== null
  )) {
    context.addIssue({ code: "custom", path: ["projectIdentityState"], message: "Not-applicable project identity cannot carry source revisions" });
  }
  if (identityState === "invalid" && value.sourceHeadMatchesCanonical) {
    context.addIssue({ code: "custom", path: ["sourceHeadMatchesCanonical"], message: "Invalid project identity cannot match canonical source" });
  }
});

export const ConvergenceGitHubEvidenceV1Schema = z.object({
  stateHash: Sha256Schema,
  pullRequests: z.number().int().nonnegative(),
  unverified: z.number().int().nonnegative(),
  open: z.number().int().nonnegative(),
}).strict().superRefine((value, context) => {
  if (value.unverified > value.pullRequests || value.open > value.pullRequests) {
    context.addIssue({ code: "custom", path: ["unverified"], message: "GitHub counts cannot exceed PR count" });
  }
});

const ConvergenceEvalRunPayloadV1Schema = z.object({
  schema: z.literal("setfarm.product-convergence-run-result.v1"),
  suiteId: SlugSchema,
  suiteVersion: z.literal(1),
  suiteHash: Sha256Schema,
  caseId: SlugSchema,
  caseHash: Sha256Schema,
  productClass: ConvergenceProductClassV1Schema,
  repetition: z.number().int().min(1).max(2),
  runId: z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  runNumber: z.number().int().positive(),
  protocol: z.literal("v3"),
  releaseSha: GitObjectHashSchema,
  taskHash: Sha256Schema,
  oracleHash: Sha256Schema,
  expectedDecision: z.enum(["accepted_candidate", "typed_rejection"]),
  expectedProviderHash: Sha256Schema,
  expectedModelHash: Sha256Schema,
  expectedStackHash: Sha256Schema,
  runnerHash: Sha256Schema,
  environmentHash: Sha256Schema,
  expectedStackPackId: ConvergenceStackPackV1Schema.nullable(),
  actualStackPackId: ConvergenceStackPackV1Schema.nullable(),
  runtimeAdapter: ConvergenceRuntimeAdapterV1Schema.nullable(),
  startedAt: TimestampSchema,
  finishedAt: TimestampSchema,
  disposition: z.enum(["completed", "failed", "cancelled", "timeout", "invalidated"]),
  passed: z.boolean(),
  rootCauseHash: Sha256Schema.nullable(),
  canonical: ConvergenceCanonicalEvidenceV1Schema,
  projection: ConvergenceProjectionEvidenceV1Schema,
  ownership: ConvergenceOwnershipEvidenceV1Schema,
  github: ConvergenceGitHubEvidenceV1Schema,
}).strict().superRefine((value, context) => {
  const commonCanonicalClean = value.canonical.attempts.active === 0
    && value.canonical.attempts.duplicateActiveTuples === 0
    && value.canonical.attempts.staleOwnership === 0
    && value.canonical.attempts.incompleteBindings === 0
    && value.canonical.findings.openFindings === 0
    && value.canonical.findings.invalidBindings === 0
    && value.canonical.recovery.activeCases === 0
    && value.canonical.recovery.activeDeliveries === 0
    && value.canonical.recovery.overBudget === 0
    && value.canonical.recovery.invalidBindings === 0
    && value.canonical.invariantCodes.length === 0;
  const oracleClean = value.canonical.oracle.oracleHash === value.oracleHash
    && value.canonical.oracle.expectedDecision === value.expectedDecision
    && value.canonical.oracle.actualDecision === value.expectedDecision
    && value.canonical.oracle.contractComplete
    && value.canonical.oracle.decisionEvidenceVerified
    && value.canonical.oracle.mismatchCodes.length === 0;
  const acceptedCanonicalClean = value.canonical.packet.packetRows === 1
    && value.canonical.packet.packetHash !== null
    && value.canonical.packet.casDeepVerified
    && value.canonical.packet.sealedStackPackId !== null
    && value.canonical.packet.missingRequiredRefs === 0
    && value.canonical.packet.missingArtifacts === 0
    && value.canonical.packet.invalidBindings === 0
    && value.canonical.attempts.attempts > 0
    && value.canonical.evidence.bundles > 0
    && value.canonical.evidence.passing > 0
    && value.canonical.evidence.nonPassing === 0
    && value.canonical.evidence.missingAttemptEvidence === 0
    && value.canonical.evidence.invalidBindings === 0
    && value.canonical.evidence.missingExpectedPredicates === 0
    && value.canonical.evidence.unexpectedProductPredicates === 0
    && value.canonical.evidence.missingInvariantRefs === 0
    && value.canonical.evidence.nonPassingRequiredPredicates === 0
    && value.canonical.acceptance.candidates === 1
    && value.canonical.acceptance.candidateHash !== null
    && value.canonical.acceptance.storyEvidence > 0
    && value.canonical.acceptance.sourceSha !== null
    && value.canonical.acceptance.sourceTreeHash !== null
    && value.canonical.acceptance.invalidBindings === 0
    && commonCanonicalClean
    && oracleClean;
  const rejectedCanonicalClean = value.canonical.packet.packetRows === 0
    && value.canonical.packet.packetHash === null
    && !value.canonical.packet.casDeepVerified
    && value.canonical.packet.sealedStackPackId === null
    && value.canonical.packet.artifactRefs === 0
    && value.canonical.packet.missingRequiredRefs === 0
    && value.canonical.packet.missingArtifacts === 0
    && value.canonical.packet.invalidBindings === 0
    && value.canonical.attempts.attempts === 0
    && value.canonical.findings.findingSets === 0
    && value.canonical.recovery.cases === 0
    && value.canonical.evidence.bundles === 0
    && value.canonical.evidence.passing === 0
    && value.canonical.evidence.nonPassing === 0
    && value.canonical.evidence.missingAttemptEvidence === 0
    && value.canonical.evidence.invalidBindings === 0
    && value.canonical.evidence.missingExpectedPredicates === 0
    && value.canonical.evidence.unexpectedProductPredicates === 0
    && value.canonical.evidence.missingInvariantRefs === 0
    && value.canonical.evidence.nonPassingRequiredPredicates === 0
    && value.canonical.acceptance.candidates === 0
    && value.canonical.acceptance.candidateHash === null
    && value.canonical.acceptance.storyEvidence === 0
    && value.canonical.acceptance.sourceSha === null
    && value.canonical.acceptance.sourceTreeHash === null
    && value.canonical.acceptance.invalidBindings === 0
    && commonCanonicalClean
    && oracleClean;
  const ownershipClean = value.ownership.openClaims === 0
    && value.ownership.activeAttempts === 0
    && value.ownership.activeRuntimes === 0
    && value.ownership.activeRecoveryDeliveries === 0
    && !value.ownership.manualProjectMutationDetected
    && value.ownership.projectIdentityState !== "invalid";
  const projectionClean = value.projection.exactHashMatch
    && value.projection.setfarmProjection === "complete"
    && value.projection.missionControlProjection === "complete"
    && value.projection.operationalSettled
    && Object.values(value.projection.capabilities).every(Boolean);
  const accepted = value.expectedDecision === "accepted_candidate";
  const transferClean = accepted
    ? value.projection.transferAcknowledged
      && value.projection.projectTransferAckHash !== null
      && value.projection.projectRecordHash !== null
    : !value.projection.transferAcknowledged
      && value.projection.projectTransferAckHash === null
      && value.projection.projectRecordHash === null;
  const githubClean = accepted
    ? value.github.pullRequests > 0 && value.github.unverified === 0 && value.github.open === 0
    : value.github.pullRequests === 0 && value.github.unverified === 0 && value.github.open === 0;
  const projectIdentityClean = accepted
    ? (value.ownership.projectIdentityState ?? (
        value.ownership.sourceHeadMatchesCanonical && value.ownership.projectHeadSha ? "verified" : "invalid"
      )) === "verified"
      && !(value.ownership.workingTreeDirty ?? false)
      && value.ownership.sourceHeadMatchesCanonical
      && value.ownership.projectHeadSha !== null
      && value.ownership.projectTreeHash !== null
      && value.ownership.canonicalHeadSha !== null
      && value.ownership.canonicalTreeHash !== null
    : (value.ownership.projectIdentityState ?? (
        value.ownership.sourceHeadMatchesCanonical && !value.ownership.projectHeadSha ? "not_applicable" : "invalid"
      )) === "not_applicable"
      && !(value.ownership.workingTreeDirty ?? false)
      && value.ownership.sourceHeadMatchesCanonical
      && value.ownership.projectHeadSha === null
      && value.ownership.projectTreeHash === null
      && value.ownership.canonicalHeadSha === null
      && value.ownership.canonicalTreeHash === null;
  const identityShapeClean = accepted
    ? value.productClass !== "negative" && value.expectedStackPackId !== null && value.runtimeAdapter !== null
    : value.productClass === "negative" && value.expectedStackPackId === null && value.runtimeAdapter === null;
  const derivedPass = identityShapeClean
    && ownershipClean
    && projectIdentityClean
    && projectionClean
    && transferClean
    && githubClean
    && (accepted
      ? value.disposition === "completed"
        && value.actualStackPackId === value.expectedStackPackId
        && acceptedCanonicalClean
      : value.disposition === "failed"
        && value.actualStackPackId === null
        && rejectedCanonicalClean);
  if (value.passed !== derivedPass) {
    context.addIssue({
      code: "custom",
      path: ["passed"],
      message: `Run pass flag does not match canonical evidence:${JSON.stringify({
        identityShapeClean,
        ownershipClean,
        projectIdentityClean,
        projectionClean,
        transferClean,
        githubClean,
        acceptedCanonicalClean,
        rejectedCanonicalClean,
        disposition: value.disposition,
        actualStackMatches: value.actualStackPackId === value.expectedStackPackId,
      })}`,
    });
  }
  if (value.passed === (value.rootCauseHash !== null)) {
    context.addIssue({
      code: "custom",
      path: ["rootCauseHash"],
      message: "Exactly failed runs require a canonical root-cause hash",
    });
  }
});

export const ConvergenceEvalRunResultV1Schema = ConvergenceEvalRunPayloadV1Schema.extend({
  resultHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { resultHash, ...payload } = value;
  if (resultHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["resultHash"], message: "Run result hash mismatch" });
  }
});

export type ConvergenceEvalRunResultV1 = z.infer<typeof ConvergenceEvalRunResultV1Schema>;

const RootCauseCountV1Schema = z.object({
  rootCauseHash: Sha256Schema,
  count: z.number().int().min(1).max(3),
}).strict();

const ConvergenceEvalResultPayloadV1Schema = z.object({
  schema: z.literal("setfarm.product-convergence-result.v1"),
  suiteId: SlugSchema,
  suiteVersion: z.literal(1),
  suiteHash: Sha256Schema,
  releaseSha: GitObjectHashSchema,
  runnerHash: Sha256Schema,
  environmentHash: Sha256Schema,
  executionMode: z.enum(["preflight", "execute"]),
  startedAt: TimestampSchema,
  finishedAt: TimestampSchema,
  plannedRuns: z.number().int().min(8).max(16),
  status: z.enum(["planned", "pass", "fail", "blocked"]),
  preflight: ConvergencePreflightV1Schema,
  runs: z.array(ConvergenceEvalRunResultV1Schema).max(16),
  rootCauseCounts: z.array(RootCauseCountV1Schema).max(16),
  stoppedOnRepeatedRootCause: Sha256Schema.nullable(),
  blockerCodes: z.array(ReasonCodeSchema).max(100).refine(hasUniqueStrings, {
    message: "Blocker codes must be unique",
  }),
}).strict().superRefine((value, context) => {
  if (!hasUniqueStrings(value.runs.map((item) => item.resultHash))) {
    context.addIssue({ code: "custom", path: ["runs"], message: "Run result hashes must be unique" });
  }
  const actualCounts = new Map<string, number>();
  for (const run of value.runs) {
    if (run.suiteHash !== value.suiteHash || run.releaseSha !== value.releaseSha
      || run.runnerHash !== value.runnerHash || run.environmentHash !== value.environmentHash) {
      context.addIssue({ code: "custom", path: ["runs"], message: "Run identities must match the suite result" });
    }
    if (run.rootCauseHash) actualCounts.set(run.rootCauseHash, (actualCounts.get(run.rootCauseHash) ?? 0) + 1);
  }
  const declaredCounts = new Map(value.rootCauseCounts.map((item) => [item.rootCauseHash, item.count]));
  if (hashCanonicalJson([...actualCounts.entries()].sort()) !== hashCanonicalJson([...declaredCounts.entries()].sort())) {
    context.addIssue({ code: "custom", path: ["rootCauseCounts"], message: "Root-cause counts must match run results" });
  }
  if (value.stoppedOnRepeatedRootCause !== null && actualCounts.get(value.stoppedOnRepeatedRootCause) !== 3) {
    context.addIssue({
      code: "custom",
      path: ["stoppedOnRepeatedRootCause"],
      message: "Repeated-root stop requires exactly three observations",
    });
  }
  if (value.executionMode === "preflight") {
    if (value.runs.length !== 0 || value.rootCauseCounts.length !== 0 || value.stoppedOnRepeatedRootCause !== null) {
      context.addIssue({ code: "custom", path: ["runs"], message: "Preflight result cannot contain executed runs" });
    }
    const expected = value.preflight.status === "pass" ? "planned" : "blocked";
    if (value.status !== expected) context.addIssue({ code: "custom", path: ["status"], message: "Preflight status mismatch" });
  } else {
    const allPassed = value.runs.length === value.plannedRuns && value.runs.every((item) => item.passed);
    const expected = allPassed
      ? "pass"
      : value.runs.length === value.plannedRuns && value.stoppedOnRepeatedRootCause === null
        ? "fail"
        : "blocked";
    if (value.status !== expected) context.addIssue({ code: "custom", path: ["status"], message: "Execution status mismatch" });
  }
  if (value.status === "pass" && value.blockerCodes.length > 0) {
    context.addIssue({ code: "custom", path: ["blockerCodes"], message: "Passing result cannot contain blockers" });
  }
});

export const ConvergenceEvalResultV1Schema = ConvergenceEvalResultPayloadV1Schema.extend({
  resultHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { resultHash, ...payload } = value;
  if (resultHash !== hashCanonicalJson(payload)) {
    context.addIssue({ code: "custom", path: ["resultHash"], message: "Suite result hash mismatch" });
  }
});

export type ConvergenceEvalResultV1 = z.infer<typeof ConvergenceEvalResultV1Schema>;
export type ConvergenceEvalResultPayloadV1 = z.infer<typeof ConvergenceEvalResultPayloadV1Schema>;

export function createConvergencePreflight(input: Readonly<{
  checks: z.infer<typeof ConvergencePreflightCheckV1Schema>[];
}>): z.infer<typeof ConvergencePreflightV1Schema> {
  const checks = input.checks.map((item) => ConvergencePreflightCheckV1Schema.parse(item));
  const payload = {
    status: checks.some((item) => item.status === "fail") ? "fail" as const : "pass" as const,
    checks,
  };
  return ConvergencePreflightV1Schema.parse({ ...payload, preflightHash: hashCanonicalJson(payload) });
}

export function createConvergenceRunResult(input: unknown): ConvergenceEvalRunResultV1 {
  const payload = ConvergenceEvalRunPayloadV1Schema.parse(input);
  return ConvergenceEvalRunResultV1Schema.parse({ ...payload, resultHash: hashCanonicalJson(payload) });
}

export function createConvergenceResult(input: unknown): ConvergenceEvalResultV1 {
  const payload = ConvergenceEvalResultPayloadV1Schema.parse(input);
  return ConvergenceEvalResultV1Schema.parse({ ...payload, resultHash: hashCanonicalJson(payload) });
}
