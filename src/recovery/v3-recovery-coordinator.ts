import type postgres from "postgres";
import { z } from "zod";

import {
  EvidenceBundleV2Schema,
  computeEvidenceBundleHash,
  type EvidenceBundleV2,
} from "../evidence/evidence-bundle-v2.js";
import { EvidencePlanV1Schema, type EvidencePlanV1 } from "../evidence/evidence-plan-v1.js";
import { createAttemptRepository } from "../execution/attempt-repository.js";
import type { ExecutionAttemptV1 } from "../execution/schemas/execution-attempt-v1.js";
import { FindingSetV1Schema, type FindingSetV1 } from "../findings/finding-set.js";
import { createGithubReviewResolutionEvidenceRepository } from "../findings/github-review-resolution-evidence-repository.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { Sha256Schema } from "../product-compiler/schemas/common-v1.js";
import {
  ImplementationSliceV1Schema,
  type ImplementationSliceV1,
} from "../product-compiler/schemas/implementation-slice-v1.js";
import {
  createFindingRecoveryRepository,
} from "./finding-recovery-repository.js";
import {
  createRecoveryDeliveryRepository,
  recoveryDeliveryDecisionRef,
} from "./recovery-delivery-repository.js";
import type {
  RecoveryCaseRevisionV1,
  RecoveryDispatchDeliveryV1,
  RecoveryRevisionDispatchV1,
} from "./recovery-delivery.js";
import type {
  RecoveryCaseDraftV1,
  RecoveryCaseV1,
} from "./recovery-case.js";
import {
  V3DownstreamEvidenceAuthorityV1Schema,
  type V3DownstreamEvidenceAuthorityV1,
} from "./v3-downstream-evidence-publication.js";

type Sql = postgres.Sql;

const FailureClassV1Schema = z.enum(["product", "infrastructure"]);
const RecoveryCaseIdSchema = z.string().regex(/^RCV_[a-f0-9]{64}$/);
const RecoveryRevisionIdSchema = z.string().regex(/^RREV_[a-f0-9]{64}$/);
const RecoveryDispatchIdSchema = z.string().regex(/^RDISP_[a-f0-9]{64}$/);
const AttemptIdSchema = z.string().regex(/^ATT_[A-Za-z0-9-]{16,160}$/);

const InitialEvidenceInputSchema = z.object({
  kind: z.literal("initial_evidence"),
  slice: z.unknown(),
  sliceHash: Sha256Schema,
  evidencePlan: z.unknown(),
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundle: z.unknown(),
  findingSet: z.unknown().optional(),
  failureClass: FailureClassV1Schema.optional(),
  downstreamAuthority: V3DownstreamEvidenceAuthorityV1Schema.optional(),
}).strict();

const RecoveryEvidenceInputSchema = z.object({
  kind: z.literal("recovery_evidence"),
  recoveryCaseId: RecoveryCaseIdSchema,
  revisionId: RecoveryRevisionIdSchema,
  dispatchId: RecoveryDispatchIdSchema,
  attemptId: AttemptIdSchema,
  slice: z.unknown(),
  sliceHash: Sha256Schema,
  evidencePlan: z.unknown(),
  evidencePlanArtifactHash: Sha256Schema,
  evidenceBundle: z.unknown(),
  findingSet: z.unknown().optional(),
  failureClass: FailureClassV1Schema.optional(),
}).strict();

export const V3RecoveryCoordinatorInputSchema = z.discriminatedUnion("kind", [
  InitialEvidenceInputSchema,
  RecoveryEvidenceInputSchema,
]);

export const V3GithubReviewResolutionCoordinatorInputSchema = z.object({
  evidenceHash: Sha256Schema,
}).strict();

type FailureClassV1 = z.infer<typeof FailureClassV1Schema>;
type DispatchClass = RecoveryRevisionDispatchV1["dispatchClass"];

type ParsedEvidenceContext = Readonly<{
  slice: ImplementationSliceV1;
  sliceHash: string;
  evidencePlan: EvidencePlanV1;
  evidencePlanArtifactHash: string;
  evidenceBundle: EvidenceBundleV2;
  findingSet?: FindingSetV1;
  failureClass?: FailureClassV1;
  bundleHash: string;
}>;

type RecoveryIdentity = Readonly<{
  recoveryCase: RecoveryCaseV1;
  revision: RecoveryCaseRevisionV1;
  dispatch: RecoveryRevisionDispatchV1;
  delivery: RecoveryDispatchDeliveryV1;
  attempt: ExecutionAttemptV1;
}>;

export type V3RecoveryCoordinatorResult =
  | Readonly<{
      status: "verified";
      evidenceBundleHash: string;
      attemptId: string;
    }>
  | Readonly<{
      status: "dispatched";
      recoveryCaseId: string;
      revisionId: string;
      dispatchId: string;
      dispatchClass: DispatchClass;
      modelDispatch: boolean;
      deliveryState: RecoveryDispatchDeliveryV1["state"];
      evidenceBundleHash: string;
    }>
  | Readonly<{
      status: "resolved";
      recoveryCaseId: string;
      revisionId: string;
      evidenceBundleHash: string;
      attemptId: string;
    }>
  | Readonly<{
      status: "blocked" | "superseded";
      recoveryCaseId: string;
      revisionId: string;
      reasonCode: string;
      evidenceBundleHash: string;
    }>
  | Readonly<{
      status: "pending";
      recoveryCaseId: string;
      revisionId: string;
      reasonCode: string;
      evidenceBundleHash: string;
    }>;

export type V3GithubReviewResolutionCoordinatorResult = Readonly<{
  status: "resolved";
  recoveryCaseId: string;
  revisionId: string;
  reviewResolutionEvidenceHash: string;
  attemptId: string;
}>;

export class V3RecoveryCoordinatorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}:${message}`);
    this.name = "V3RecoveryCoordinatorError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new V3RecoveryCoordinatorError(code, message);
}

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function exactStrings(left: readonly string[], right: readonly string[]): boolean {
  const a = canonical(left);
  const b = canonical(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameRevision(
  left: Readonly<{ sha: string; treeHash: string }>,
  right: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function sameSliceRevision(
  slice: ImplementationSliceV1,
  source: Readonly<{ sha: string; treeHash: string }>,
): boolean {
  return slice.sourceRevision.baseSha === source.sha && slice.sourceRevision.treeHash === source.treeHash;
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function modelDispatch(dispatchClass: DispatchClass): boolean {
  return dispatchClass === "product_implementation" || dispatchClass === "supervisor_repair";
}

function terminalAttempt(attempt: ExecutionAttemptV1): boolean {
  return !["claimed", "running", "superseded"].includes(attempt.disposition);
}

function evidenceBundleRef(hash: string): string {
  return `setfarm://evidence-bundle/${hash}`;
}

function hasEvidenceBundleRef(attempt: ExecutionAttemptV1, hash: string): boolean {
  return attempt.evidenceRefs.includes(hash) || attempt.evidenceRefs.includes(evidenceBundleRef(hash));
}

export function computeV3RecoveryCoordinatorEventHashV1(value: unknown): string {
  return hashCanonicalJson({ schema: "setfarm.v3-recovery-coordinator-event.v1", value });
}

function terminalResult(input: Readonly<{
  eventHash: string;
  evidenceBundleHash: string;
  attemptId: string;
  verdict: EvidenceBundleV2["aggregateVerdict"];
  failureClass?: FailureClassV1;
}>) {
  return {
    schema: "setfarm.v3-recovery-coordinator-result.v1",
    eventHash: input.eventHash,
    evidenceBundleHash: input.evidenceBundleHash,
    attemptId: input.attemptId,
    verdict: input.verdict,
    ...(input.failureClass ? { failureClass: input.failureClass } : {}),
  };
}

function semanticObservation(observation: EvidenceBundleV2["observations"][number]): unknown {
  if (observation.kind === "command") {
    return {
      kind: observation.kind,
      commandRef: observation.commandRef,
      exitCode: observation.exitCode,
    };
  }
  if (observation.kind === "runtime") {
    return { kind: observation.kind };
  }
  return {
    kind: observation.kind,
    ...(observation.actionRef ? { actionRef: observation.actionRef } : {}),
    ...(observation.controlRef ? { controlRef: observation.controlRef } : {}),
  };
}

function canonicalSemanticValues(values: readonly unknown[]): unknown[] {
  return [...values].sort((left, right) => {
    const a = canonicalJsonStringify(left);
    const b = canonicalJsonStringify(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Machine evidence identity intentionally excludes clocks, session IDs,
 * locators, raw command output, screenshots, DOM/runtime capture bytes and
 * their hashes. Those artifacts remain authoritative audit evidence, but they
 * are not proof of a semantic delta: captures commonly embed timestamps,
 * random runtime identities and clock-driven UI. Only the sealed identity and
 * typed predicate/action/control/command outcomes can authorize another
 * recovery dispatch on unchanged source.
 */
export function computeMachineEvidenceFingerprintV1(input: EvidenceBundleV2): string {
  const bundle = EvidenceBundleV2Schema.parse(input);
  return hashCanonicalJson({
    schema: "setfarm.machine-evidence-fingerprint.v1",
    runId: bundle.runId,
    storyId: bundle.storyId,
    packetHash: bundle.packetHash,
    sliceHash: bundle.sliceHash,
    sourceRevision: bundle.sourceRevision,
    aggregateVerdict: bundle.aggregateVerdict,
    predicates: canonicalSemanticValues(bundle.predicates.map((predicate) => ({
      invariantRef: predicate.invariantRef,
      predicateRef: predicate.predicateRef,
      ...(predicate.actionRef ? { actionRef: predicate.actionRef } : {}),
      ...(predicate.controlRef ? { controlRef: predicate.controlRef } : {}),
      required: predicate.required,
      verdict: predicate.verdict,
    }))),
    observations: canonicalSemanticValues(bundle.observations.map(semanticObservation)),
  });
}

function parseContext(raw: z.infer<typeof V3RecoveryCoordinatorInputSchema>): ParsedEvidenceContext {
  const slice = ImplementationSliceV1Schema.parse(raw.slice);
  const evidencePlan = EvidencePlanV1Schema.parse(raw.evidencePlan);
  const evidenceBundle = EvidenceBundleV2Schema.parse(raw.evidenceBundle);
  const findingSet = raw.findingSet === undefined ? undefined : FindingSetV1Schema.parse(raw.findingSet);
  const bundleHash = computeEvidenceBundleHash(evidenceBundle);
  const context = {
    slice,
    sliceHash: raw.sliceHash,
    evidencePlan,
    evidencePlanArtifactHash: raw.evidencePlanArtifactHash,
    evidenceBundle,
    ...(findingSet ? { findingSet } : {}),
    ...(raw.failureClass ? { failureClass: raw.failureClass } : {}),
    bundleHash,
  } satisfies ParsedEvidenceContext;
  validateEvidenceContext(context);
  return context;
}

function validateEvidenceContext(context: ParsedEvidenceContext): void {
  const { slice, sliceHash, evidencePlan, evidenceBundle, findingSet, failureClass } = context;
  if (
    slice.packetHash !== evidencePlan.packetHash
    || slice.packetHash !== evidenceBundle.packetHash
    || slice.storyId !== evidencePlan.storyId
    || slice.storyId !== evidenceBundle.storyId
    || evidencePlan.sliceHash !== sliceHash
    || evidenceBundle.sliceHash !== sliceHash
  ) {
    fail("V3_RECOVERY_CONTEXT_IDENTITY_MISMATCH", "slice, plan and evidence do not share one packet/story/slice identity");
  }
  const productPredicateRefs = canonical(slice.requiredEvidence.map((predicate) => predicate.id));
  const commandPredicateRefs = evidencePlan.commands.map((command) => `EVID_COMMAND_${command.commandRef}`);
  const requiredPredicates = canonical([...productPredicateRefs, ...commandPredicateRefs]);
  if (!exactStrings(evidencePlan.predicateRefs, productPredicateRefs)) {
    fail("V3_RECOVERY_EVIDENCE_PLAN_INCOMPLETE", "evidence plan is not the exact slice predicate set");
  }
  const bundlePredicateRefs = evidenceBundle.predicates.map((predicate) => predicate.predicateRef);
  if (!exactStrings(bundlePredicateRefs, requiredPredicates)) {
    fail("V3_RECOVERY_EVIDENCE_BUNDLE_INCOMPLETE", "evidence bundle is not the exact slice predicate set");
  }
  const slicePredicateById = new Map(slice.requiredEvidence.map((predicate) => [predicate.id, predicate]));
  const commandByPredicate = new Map(evidencePlan.commands.map((command) => [
    `EVID_COMMAND_${command.commandRef}`,
    command,
  ]));
  for (const predicate of evidenceBundle.predicates) {
    const expected = slicePredicateById.get(predicate.predicateRef);
    const expectedCommand = commandByPredicate.get(predicate.predicateRef);
    if (expectedCommand) {
      const commandObservation = predicate.observationRefs.length === 1
        ? evidenceBundle.observations.find((observation) =>
          observation.observationRef === predicate.observationRefs[0]
          && observation.kind === "command"
          && observation.commandRef === expectedCommand.commandRef)
        : undefined;
      const commandVerdictMatches = commandObservation?.kind === "command"
        && (
          predicate.verdict === "inconclusive"
          || (predicate.verdict === "pass" && commandObservation.exitCode === 0)
          || (predicate.verdict === "fail" && commandObservation.exitCode !== 0)
        );
      if (
        !predicate.required
        || predicate.invariantRef !== `INV_COMMAND_${expectedCommand.kind.toUpperCase()}`
        || predicate.actionRef !== undefined
        || predicate.controlRef !== undefined
        || !commandVerdictMatches
      ) {
        fail("V3_RECOVERY_COMMAND_EVIDENCE_INVALID", `command predicate ${predicate.predicateRef} lacks exact command evidence`);
      }
      continue;
    }
    const flows = evidencePlan.flows.filter((flow) => flow.predicateRefs.includes(predicate.predicateRef));
    if (!expected || flows.length !== 1) {
      fail("V3_RECOVERY_EVIDENCE_BINDING_INVALID", `predicate ${predicate.predicateRef} lacks one exact compiler flow`);
    }
    const flow = flows[0]!;
    if (
      !predicate.required
      || predicate.invariantRef !== `INV_${expected.kind.toUpperCase()}`
      || predicate.actionRef !== flow.actionRef
      || predicate.controlRef !== flow.controlRef
    ) {
      fail("V3_RECOVERY_EVIDENCE_BINDING_INVALID", `predicate ${predicate.predicateRef} differs from its sealed flow`);
    }
  }
  if (evidenceBundle.aggregateVerdict === "incomplete") {
    fail("V3_RECOVERY_EVIDENCE_INCOMPLETE", "incomplete evidence cannot drive recovery");
  }
  if (evidenceBundle.aggregateVerdict === "pass") {
    if (findingSet || failureClass) {
      fail("V3_RECOVERY_PASS_HAS_FAILURE_PAYLOAD", "passing evidence cannot publish a failure set or failure owner");
    }
  } else if (!findingSet || !failureClass) {
    fail("V3_RECOVERY_FAILURE_PAYLOAD_REQUIRED", "non-passing evidence requires an exact finding set and typed owner");
  }
}

function validateFailureFindingSet(context: ParsedEvidenceContext): FindingSetV1 {
  const findingSet = context.findingSet;
  if (!findingSet) fail("V3_RECOVERY_FINDING_SET_REQUIRED", "failure has no finding set");
  const { slice, evidenceBundle, bundleHash } = context;
  if (
    findingSet.runId !== evidenceBundle.runId
    || findingSet.storyId !== evidenceBundle.storyId
    || findingSet.packetHash !== evidenceBundle.packetHash
    || findingSet.sliceHash !== evidenceBundle.sliceHash
    || !sameRevision(findingSet.sourceRevision, evidenceBundle.sourceRevision)
  ) {
    fail("V3_RECOVERY_FINDING_IDENTITY_MISMATCH", "finding set does not describe the exact evidence source");
  }
  const nonPassing = new Map(evidenceBundle.predicates
    .filter((predicate) => predicate.verdict !== "pass")
    .map((predicate) => [predicate.predicateRef, predicate]));
  const findingPredicates: string[] = [];
  const declaredPaths = new Set(slice.files.map((file) => file.path));
  const writablePaths = canonical(slice.files
    .filter((file) => file.role === "owned" || file.role === "shared_writable")
    .map((file) => file.path));
  const compilerLocatablePaths = writablePaths.length > 0
    ? writablePaths
    : canonical(slice.files.filter((file) => file.role !== "dependency").map((file) => file.path));
  for (const finding of findingSet.findings) {
    if (finding.status !== "open" || finding.classification !== "structured" || !finding.expectedPredicateRef) {
      fail("V3_RECOVERY_FINDING_NOT_STRUCTURED", `finding ${finding.findingId} is not an open typed defect`);
    }
    const predicate = nonPassing.get(finding.expectedPredicateRef);
    if (!predicate || predicate.invariantRef !== finding.invariantRef) {
      fail("V3_RECOVERY_FINDING_PREDICATE_MISMATCH", `finding ${finding.findingId} is not backed by a failing predicate`);
    }
    if (!finding.observedEvidenceRefs.includes(bundleHash)) {
      fail("V3_RECOVERY_FINDING_EVIDENCE_MISSING", `finding ${finding.findingId} omits the exact evidence bundle hash`);
    }
    if (finding.sourceLocators.some((locator) => !declaredPaths.has(locator.path))) {
      fail("V3_RECOVERY_FINDING_PATH_UNDECLARED", `finding ${finding.findingId} references undeclared source`);
    }
    if (!exactStrings(finding.sourceLocators.map((locator) => locator.path), compilerLocatablePaths)) {
      fail(
        "V3_RECOVERY_FINDING_PATH_AUTHORITY_INVALID",
        `finding ${finding.findingId} source paths are not the compiler-declared topology surface`,
      );
    }
    findingPredicates.push(finding.expectedPredicateRef);
  }
  if (!exactStrings(findingPredicates, [...nonPassing.keys()])) {
    fail("V3_RECOVERY_FINDING_SET_INCOMPLETE", "finding set does not exactly cover every non-passing predicate");
  }
  return findingSet;
}

function recoveryEvidenceRefs(context: ParsedEvidenceContext): string[] {
  return canonical(context.evidenceBundle.predicates
    .filter((predicate) => predicate.required)
    .map((predicate) => predicate.predicateRef));
}

function deriveSourceRecovery(
  slice: ImplementationSliceV1,
  findingSet: FindingSetV1,
): Readonly<{
  owner: "implement" | "supervisor";
  expectedDelta: Extract<RecoveryCaseDraftV1["expectedDelta"], { kind: "source_change" }>;
  allowedPaths: string[];
}> | undefined {
  const allowedPaths = canonical(slice.files
    .filter((file) => file.role === "owned" || file.role === "shared_writable")
    .map((file) => file.path));
  const allowed = new Set(allowedPaths);
  const requiredPaths = canonical(findingSet.findings
    .flatMap((finding) => finding.sourceLocators.map((locator) => locator.path))
    .filter((path) => allowed.has(path)));
  if (allowedPaths.length === 0 || requiredPaths.length === 0) return undefined;
  return {
    owner: "implement",
    expectedDelta: {
      kind: "source_change",
      invariantRefs: canonical(findingSet.findings.map((finding) => finding.invariantRef)),
      requiredPaths,
    },
    allowedPaths,
  };
}

function assertAttemptEvidence(input: Readonly<{
  attempt: ExecutionAttemptV1;
  context: ParsedEvidenceContext;
  recovery?: RecoveryRevisionDispatchV1;
}>): void {
  const { attempt, context, recovery } = input;
  const bundleAttemptId = context.evidenceBundle.attemptId;
  if (!bundleAttemptId || bundleAttemptId !== attempt.attemptId) {
    fail("V3_RECOVERY_EVIDENCE_ATTEMPT_REQUIRED", "evidence must name the exact execution attempt");
  }
  if (
    attempt.runId !== context.evidenceBundle.runId
    || attempt.storyId !== context.evidenceBundle.storyId
    || attempt.packetHash !== context.evidenceBundle.packetHash
    || attempt.sliceHash !== context.sliceHash
    || !attempt.sourceAfter
    || !sameRevision(attempt.sourceAfter, context.evidenceBundle.sourceRevision)
    || !terminalAttempt(attempt)
  ) {
    fail("V3_RECOVERY_ATTEMPT_EVIDENCE_MISMATCH", "attempt fence does not attest the evidence candidate source");
  }
  if (
    !hasEvidenceBundleRef(attempt, context.bundleHash)
    || !attempt.evidenceRefs.includes(`setfarm://artifact/${context.evidencePlanArtifactHash}`)
  ) {
    fail("V3_RECOVERY_ATTEMPT_EVIDENCE_MISSING", "terminal attempt omits canonical evidence or plan refs");
  }
  if (!recovery) {
    if (attempt.recoveryDispatchId || attempt.recoveryCaseRevisionId) {
      fail("V3_RECOVERY_INITIAL_ATTEMPT_IS_RECOVERY", "initial evidence cannot reuse a recovery dispatch");
    }
    return;
  }
  if (
    attempt.recoveryDispatchId !== recovery.dispatchId
    || attempt.recoveryCaseRevisionId !== recovery.revisionId
    || attempt.attemptClass !== recovery.dispatchClass
    || attempt.findingSetHash !== recovery.findingSetHash
    || !sameRevision(attempt.sourceBefore, recovery.sourceRevision)
  ) {
    fail("V3_RECOVERY_ATTEMPT_DISPATCH_MISMATCH", "attempt is not fenced by the exact recovery dispatch");
  }
  if (recovery.dispatchClass === "evidence_only" && !sameRevision(attempt.sourceAfter!, attempt.sourceBefore)) {
    fail("V3_RECOVERY_EVIDENCE_ONLY_SOURCE_CHANGED", "non-model evidence delivery cannot mutate product source");
  }
}

function assertRecoverySlice(input: Readonly<{
  context: ParsedEvidenceContext;
  revision: RecoveryCaseRevisionV1;
  dispatch: RecoveryRevisionDispatchV1;
  delivery: RecoveryDispatchDeliveryV1;
}>): void {
  const { context, revision, dispatch, delivery } = input;
  const directive = context.slice.recovery;
  if (dispatch.dispatchClass === "evidence_only") {
    if (
      directive
      || !sameSliceRevision(context.slice, dispatch.sourceRevision)
      || delivery.executionSliceHash !== context.sliceHash
      || context.slice.packetHash !== dispatch.packetHash
      || context.slice.storyId !== dispatch.storyId
    ) {
      fail(
        "V3_RECOVERY_EVIDENCE_SLICE_MISMATCH",
        "non-model evidence delivery must use an unmodified slice at the exact dispatch source",
      );
    }
    return;
  }
  if (
    !directive
    || directive.recoveryCaseRevisionId !== revision.revisionId
    || directive.recoveryDispatchId !== dispatch.dispatchId
    || directive.dispatchClass !== dispatch.dispatchClass
    || directive.findingSetHash !== dispatch.findingSetHash
    || directive.contractSliceHash !== dispatch.contractSliceHash
    || !exactStrings(directive.findingIds, dispatch.findingIds)
    || !sameSliceRevision(context.slice, dispatch.sourceRevision)
    || directive.sourceRevision.baseSha !== dispatch.sourceRevision.sha
    || directive.sourceRevision.treeHash !== dispatch.sourceRevision.treeHash
    || !sameCanonical(directive.expectedDelta, revision.expectedDelta)
    || !exactStrings(directive.allowedPaths, revision.allowedPaths)
    || directive.evidencePlanArtifactHash !== revision.evidencePlanArtifactHash
    || delivery.executionSliceHash !== context.sliceHash
  ) {
    fail("V3_RECOVERY_SLICE_DISPATCH_MISMATCH", "execution slice is not the exact revision-bound recovery directive");
  }
  const writable = canonical(context.slice.files
    .filter((file) => file.role === "owned" || file.role === "shared_writable")
    .map((file) => file.path));
  if (directive.allowedPaths.some((path) => !writable.includes(path))) {
    fail("V3_RECOVERY_PATH_AUTHORITY_INVALID", "recovery directive grants a non-writable topology path");
  }
}

function initialCaseDraft(input: Readonly<{
  context: ParsedEvidenceContext;
  findingSet: FindingSetV1;
  attemptId: string;
  decisionRef: string;
}>): RecoveryCaseDraftV1 {
  const { context, findingSet } = input;
  const sourceRecovery = deriveSourceRecovery(context.slice, findingSet);
  const clearProductFailure = context.evidenceBundle.aggregateVerdict === "fail"
    && context.failureClass === "product";
  const common = {
    runId: findingSet.runId,
    storyId: findingSet.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: findingSet.packetHash,
    sliceHash: findingSet.sliceHash,
    sourceRevision: findingSet.sourceRevision,
    evidencePlan: recoveryEvidenceRefs(context),
    priorAttemptRefs: [input.attemptId],
    budget: {
      limits: { implement: 1 as const, supervisorRepair: 1 as const, evidenceOnly: 1 as const },
      used: { implement: 0 as const, supervisorRepair: 0 as const, evidenceOnly: 0 as const },
    },
    decisionRefs: [input.decisionRef],
  };
  if (clearProductFailure && sourceRecovery) {
    return {
      ...common,
      owner: "implement",
      expectedDelta: sourceRecovery.expectedDelta,
      allowedPaths: sourceRecovery.allowedPaths,
      status: "open",
    };
  }
  if (clearProductFailure) {
    return {
      ...common,
      owner: "operator",
      expectedDelta: { kind: "operator_action", reasonCode: "specification_decision_required" },
      allowedPaths: [],
      status: "blocked",
      terminal: {
        owner: "operator",
        outcome: "blocked",
        reasonCode: "specification_incomplete",
        evidenceBundleHashes: [context.bundleHash],
      },
    };
  }
  return {
    ...common,
    owner: "infrastructure",
    expectedDelta: { kind: "evidence_refresh", predicateRefs: recoveryEvidenceRefs(context) },
    allowedPaths: [],
    status: "open",
  };
}

export function createV3RecoveryCoordinator(sql: Sql) {
  const findings = createFindingRecoveryRepository(sql);
  const deliveries = createRecoveryDeliveryRepository(sql);
  const attempts = createAttemptRepository(sql);
  const reviewResolutions = createGithubReviewResolutionEvidenceRepository(sql);

  async function loadRecoveryIdentity(input: Readonly<{
    recoveryCaseId: string;
    revisionId: string;
    dispatchId: string;
    attemptId: string;
    context: ParsedEvidenceContext;
  }>): Promise<RecoveryIdentity> {
    const [recoveryCase, revision, dispatch, delivery, attempt] = await Promise.all([
      findings.findRecoveryCase(input.recoveryCaseId),
      deliveries.findRevision(input.revisionId),
      deliveries.findDispatch(input.dispatchId),
      deliveries.findDelivery(input.dispatchId),
      attempts.findById(input.attemptId),
    ]);
    if (!recoveryCase || !revision || !dispatch || !delivery || !attempt) {
      fail("V3_RECOVERY_IDENTITY_NOT_FOUND", "case, revision, dispatch, delivery or attempt is missing");
    }
    if (
      revision.recoveryCaseId !== recoveryCase.recoveryCaseId
      || dispatch.recoveryCaseId !== recoveryCase.recoveryCaseId
      || dispatch.revisionId !== revision.revisionId
      || delivery.recoveryCaseId !== recoveryCase.recoveryCaseId
      || delivery.revisionId !== revision.revisionId
      || delivery.dispatchId !== dispatch.dispatchId
      || delivery.attemptId !== attempt.attemptId
      || dispatch.packetHash !== revision.packetHash
      || dispatch.contractSliceHash !== revision.contractSliceHash
      || dispatch.findingSetHash !== revision.findingSetHash
      || !sameRevision(dispatch.sourceRevision, revision.sourceRevision)
      || !exactStrings(dispatch.findingIds, revision.findingIds)
      || !exactStrings(dispatch.evidencePlan, revision.evidencePlan)
    ) {
      fail("V3_RECOVERY_LEDGER_IDENTITY_MISMATCH", "recovery ledger rows do not form one exact identity chain");
    }
    assertRecoverySlice({ context: input.context, revision, dispatch, delivery });
    assertAttemptEvidence({ attempt, context: input.context, recovery: dispatch });
    return { recoveryCase, revision, dispatch, delivery, attempt };
  }

  async function completeDeliveryExactly(input: Readonly<{
    identity: RecoveryIdentity;
    context: ParsedEvidenceContext;
    coordinatorEventHash: string;
    now: Date;
  }>): Promise<RecoveryDispatchDeliveryV1> {
    const expectedState = input.context.evidenceBundle.aggregateVerdict === "pass" ? "succeeded" : "failed";
    const expectedResult = terminalResult({
      eventHash: input.coordinatorEventHash,
      evidenceBundleHash: input.context.bundleHash,
      attemptId: input.identity.attempt.attemptId,
      verdict: input.context.evidenceBundle.aggregateVerdict,
      ...(input.context.failureClass ? { failureClass: input.context.failureClass } : {}),
    });
    let delivery = input.identity.delivery;
    const terminal = ["succeeded", "failed", "blocked", "superseded"].includes(delivery.state);
    if (terminal) {
      if (delivery.state !== expectedState || !sameCanonical(delivery.terminalResult, expectedResult)) {
        fail("V3_RECOVERY_DELIVERY_TERMINAL_CONFLICT", "delivery already has a different terminal result");
      }
      return delivery;
    }
    if (!["attempt_reserved", "running"].includes(delivery.state)) {
      fail("V3_RECOVERY_DELIVERY_NOT_COMPLETABLE", `delivery is ${delivery.state}, not attempt-bound`);
    }
    const completed = await deliveries.completeDelivery({
      dispatchId: input.identity.dispatch.dispatchId,
      revisionId: input.identity.revision.revisionId,
      attemptId: input.identity.attempt.attemptId,
      state: expectedState,
      terminalResult: expectedResult,
    }, { now: input.now });
    if (completed) return completed;
    const replay = await deliveries.findDelivery(input.identity.dispatch.dispatchId);
    if (
      !replay
      || replay.state !== expectedState
      || !sameCanonical(replay.terminalResult, expectedResult)
    ) {
      fail("V3_RECOVERY_DELIVERY_COMPLETION_LOST", "delivery completion CAS did not converge");
    }
    delivery = replay;
    return delivery;
  }

  async function resultFromCurrentCase(input: Readonly<{
    recoveryCase: RecoveryCaseV1;
    evidenceBundleHash: string;
  }>): Promise<V3RecoveryCoordinatorResult> {
    const revision = await deliveries.findCurrentRevision(input.recoveryCase.recoveryCaseId);
    if (!revision) fail("V3_RECOVERY_CURRENT_REVISION_MISSING", "case has no current revision");
    if (input.recoveryCase.status === "resolved") {
      const terminalEvidenceHash = input.recoveryCase.terminal?.evidenceBundleHashes.at(-1);
      const terminalEvidence = terminalEvidenceHash
        ? await findings.findEvidenceBundle(terminalEvidenceHash)
        : undefined;
      if (!terminalEvidenceHash || !terminalEvidence?.attemptId) {
        fail("V3_RECOVERY_RESOLVED_ATTEMPT_MISSING", "resolved case lacks exact attempt-bound terminal evidence");
      }
      return {
        status: "resolved",
        recoveryCaseId: input.recoveryCase.recoveryCaseId,
        revisionId: revision.revisionId,
        evidenceBundleHash: terminalEvidenceHash,
        attemptId: terminalEvidence.attemptId,
      };
    }
    if (input.recoveryCase.status === "blocked" || input.recoveryCase.status === "superseded") {
      const terminalEvidenceHash = input.recoveryCase.terminal?.evidenceBundleHashes.at(-1)
        ?? input.evidenceBundleHash;
      return {
        status: input.recoveryCase.status,
        recoveryCaseId: input.recoveryCase.recoveryCaseId,
        revisionId: revision.revisionId,
        reasonCode: input.recoveryCase.terminal?.reasonCode ?? "operator_required",
        evidenceBundleHash: terminalEvidenceHash,
      };
    }
    const active = await deliveries.findActiveForStory({
      runId: input.recoveryCase.runId,
      storyId: input.recoveryCase.storyId,
    });
    if (active) {
      const dispatch = await deliveries.findDispatch(active.dispatchId);
      if (!dispatch) fail("V3_RECOVERY_ACTIVE_DISPATCH_MISSING", "active delivery has no dispatch artifact");
      return {
        status: "dispatched",
        recoveryCaseId: dispatch.recoveryCaseId,
        revisionId: dispatch.revisionId,
        dispatchId: dispatch.dispatchId,
        dispatchClass: dispatch.dispatchClass,
        modelDispatch: modelDispatch(dispatch.dispatchClass),
        deliveryState: active.state,
        evidenceBundleHash: input.evidenceBundleHash,
      };
    }
    return {
      status: "pending",
      recoveryCaseId: input.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      reasonCode: "recovery_checkpoint_requires_replay",
      evidenceBundleHash: input.evidenceBundleHash,
    };
  }

  async function transitionTerminal(input: Readonly<{
    recoveryCaseId: string;
    status: "resolved" | "blocked" | "superseded";
    reasonCode: "evidence_satisfied" | "specification_incomplete" | "evidence_inconclusive" | "budget_exhausted" | "source_superseded" | "operator_required";
    evidenceBundleHash: string;
    attemptId: string;
    dispatch: RecoveryRevisionDispatchV1;
    owner?: RecoveryCaseV1["owner"];
    expectedDelta?: RecoveryCaseDraftV1["expectedDelta"];
    allowedPaths?: string[];
    decisionRef: string;
    now: Date;
  }>): Promise<RecoveryCaseV1> {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const current = await findings.findRecoveryCase(input.recoveryCaseId);
      if (!current) fail("V3_RECOVERY_CASE_NOT_FOUND", "terminal transition case disappeared");
      if (["resolved", "blocked", "superseded"].includes(current.status)) {
        if (
          current.status !== input.status
          || current.terminal?.reasonCode !== input.reasonCode
          || !current.terminal.evidenceBundleHashes.includes(input.evidenceBundleHash)
        ) {
          fail("V3_RECOVERY_TERMINAL_CASE_CONFLICT", "case already has a different terminal outcome");
        }
        return current;
      }
      const owner = input.owner ?? current.owner;
      const transitioned = await findings.transitionRecoveryCase({
        recoveryCaseId: current.recoveryCaseId,
        expectedStateVersion: current.stateVersion,
        status: input.status,
        owner,
        ...(input.expectedDelta ? { expectedDelta: input.expectedDelta } : {}),
        ...(input.allowedPaths ? { allowedPaths: input.allowedPaths } : {}),
        evidencePlan: current.evidencePlan,
        attemptRef: input.attemptId,
        recoveryEvidence: {
          revisionId: input.dispatch.revisionId,
          dispatchId: input.dispatch.dispatchId,
          attemptId: input.attemptId,
        },
        terminal: {
          owner,
          outcome: input.status,
          reasonCode: input.reasonCode,
          evidenceBundleHashes: [input.evidenceBundleHash],
        },
        decisionRef: input.decisionRef,
      }, { now: input.now });
      if (transitioned.status === "transitioned") return transitioned.recoveryCase;
    }
    fail("V3_RECOVERY_TERMINAL_CAS_EXHAUSTED", "terminal transition did not converge after replay");
  }

  async function advanceRevisionExactly(input: Readonly<{
    identity: RecoveryIdentity;
    findingSet: FindingSetV1;
    owner: RecoveryCaseRevisionV1["owner"];
    expectedDelta: RecoveryCaseRevisionV1["expectedDelta"];
    allowedPaths: string[];
    evidencePlan: string[];
    evidencePlanArtifactHash: string;
    decisionRef: string;
    now: Date;
  }>): Promise<Readonly<{ revision: RecoveryCaseRevisionV1; recoveryCase: RecoveryCaseV1 }>> {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const currentCase = await findings.findRecoveryCase(input.identity.recoveryCase.recoveryCaseId);
      const currentRevision = await deliveries.findCurrentRevision(input.identity.recoveryCase.recoveryCaseId);
      if (!currentCase || !currentRevision) {
        fail("V3_RECOVERY_ADVANCE_IDENTITY_MISSING", "case or current revision is missing");
      }
      if (["resolved", "blocked", "superseded"].includes(currentCase.status)) {
        return { revision: currentRevision, recoveryCase: currentCase };
      }
      if (currentRevision.revisionId !== input.identity.revision.revisionId) {
        if (
          currentRevision.parentRevisionId === input.identity.revision.revisionId
          && currentRevision.findingSetHash === input.findingSet.findingSetHash
          && currentRevision.owner === input.owner
          && sameCanonical(currentRevision.expectedDelta, input.expectedDelta)
          && exactStrings(currentRevision.allowedPaths, input.allowedPaths)
          && exactStrings(currentRevision.evidencePlan, input.evidencePlan)
          && currentRevision.evidencePlanArtifactHash === input.evidencePlanArtifactHash
        ) {
          return { revision: currentRevision, recoveryCase: currentCase };
        }
        fail("V3_RECOVERY_REVISION_ADVANCE_CONFLICT", "another recovery outcome advanced the case");
      }
      const advanced = await deliveries.advanceRevision({
        recoveryCaseId: currentCase.recoveryCaseId,
        expectedStateVersion: currentCase.stateVersion,
        parentRevisionId: currentRevision.revisionId,
        findingSetHash: input.findingSet.findingSetHash,
        owner: input.owner,
        expectedDelta: input.expectedDelta,
        allowedPaths: input.allowedPaths,
        evidencePlan: input.evidencePlan,
        evidencePlanArtifactHash: input.evidencePlanArtifactHash,
        decisionRef: input.decisionRef,
      }, { now: input.now });
      if (advanced.status === "advanced" || advanced.status === "duplicate") {
        const recoveryCase = await findings.findRecoveryCase(currentCase.recoveryCaseId);
        if (!recoveryCase) fail("V3_RECOVERY_CASE_NOT_FOUND", "advanced case disappeared");
        return { revision: advanced.revision, recoveryCase };
      }
    }
    fail("V3_RECOVERY_REVISION_CAS_EXHAUSTED", "revision advance did not converge after replay");
  }

  async function terminalizeWithoutDispatch(input: Readonly<{
    recoveryCase: RecoveryCaseV1;
    status: "blocked" | "superseded";
    reasonCode: "specification_incomplete" | "evidence_inconclusive" | "budget_exhausted" | "source_superseded" | "operator_required";
    evidenceBundleHash: string;
    decisionRef: string;
    now: Date;
  }>): Promise<RecoveryCaseV1> {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const current = await findings.findRecoveryCase(input.recoveryCase.recoveryCaseId);
      if (!current) fail("V3_RECOVERY_CASE_NOT_FOUND", "case disappeared before terminalization");
      if (["blocked", "superseded"].includes(current.status)) return current;
      const transitioned = await findings.transitionRecoveryCase({
        recoveryCaseId: current.recoveryCaseId,
        expectedStateVersion: current.stateVersion,
        status: input.status,
        terminal: {
          owner: current.owner,
          outcome: input.status,
          reasonCode: input.reasonCode,
          evidenceBundleHashes: [input.evidenceBundleHash],
        },
        decisionRef: input.decisionRef,
      }, { now: input.now });
      if (transitioned.status === "transitioned") return transitioned.recoveryCase;
    }
    fail("V3_RECOVERY_TERMINAL_CAS_EXHAUSTED", "case terminalization did not converge");
  }

  async function authorizeRevision(input: Readonly<{
    recoveryCaseId: string;
    revisionId: string;
    dispatchClass: DispatchClass;
    evidenceBundleHash: string;
    downstreamAuthority?: V3DownstreamEvidenceAuthorityV1;
    downstreamAttemptId?: string;
    now: Date;
  }>): Promise<V3RecoveryCoordinatorResult> {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const recoveryCase = await findings.findRecoveryCase(input.recoveryCaseId);
      const revision = await deliveries.findCurrentRevision(input.recoveryCaseId);
      if (!recoveryCase || !revision) fail("V3_RECOVERY_AUTHORIZATION_IDENTITY_MISSING", "case or revision is missing");
      if (["resolved", "blocked", "superseded"].includes(recoveryCase.status)) {
        return resultFromCurrentCase({ recoveryCase, evidenceBundleHash: input.evidenceBundleHash });
      }
      if (revision.revisionId !== input.revisionId) {
        return resultFromCurrentCase({ recoveryCase, evidenceBundleHash: input.evidenceBundleHash });
      }
      const authorized = await deliveries.authorizeCurrentRevision({
        recoveryCaseId: recoveryCase.recoveryCaseId,
        revisionId: revision.revisionId,
        expectedStateVersion: recoveryCase.stateVersion,
        dispatchClass: input.dispatchClass,
        ...(input.downstreamAuthority && input.downstreamAttemptId
          ? {
              downstreamEvidence: {
                authority: input.downstreamAuthority,
                attemptId: input.downstreamAttemptId,
                evidenceBundleHash: input.evidenceBundleHash,
              },
            }
          : {}),
      }, { now: input.now });
      if (authorized.status === "authorized" || authorized.status === "duplicate") {
        if (
          authorized.status === "duplicate"
          && authorized.dispatch.revisionId !== revision.revisionId
        ) {
          const terminal = await terminalizeWithoutDispatch({
            recoveryCase,
            status: "blocked",
            reasonCode: input.dispatchClass === "evidence_only" ? "evidence_inconclusive" : "budget_exhausted",
            evidenceBundleHash: input.evidenceBundleHash,
            decisionRef: recoveryDeliveryDecisionRef({
              kind: "unchanged_source_dispatch_suppressed",
              recoveryCaseId: recoveryCase.recoveryCaseId,
              requestedRevisionId: revision.revisionId,
              existingDispatchId: authorized.dispatch.dispatchId,
            }),
            now: input.now,
          });
          return resultFromCurrentCase({ recoveryCase: terminal, evidenceBundleHash: input.evidenceBundleHash });
        }
        return {
          status: "dispatched",
          recoveryCaseId: authorized.dispatch.recoveryCaseId,
          revisionId: authorized.dispatch.revisionId,
          dispatchId: authorized.dispatch.dispatchId,
          dispatchClass: authorized.dispatch.dispatchClass,
          modelDispatch: modelDispatch(authorized.dispatch.dispatchClass),
          deliveryState: authorized.delivery.state,
          evidenceBundleHash: input.evidenceBundleHash,
        };
      }
      if (authorized.status === "finding_conflict") {
        const terminal = await terminalizeWithoutDispatch({
          recoveryCase,
          status: "superseded",
          reasonCode: "source_superseded",
          evidenceBundleHash: input.evidenceBundleHash,
          decisionRef: recoveryDeliveryDecisionRef({
            kind: "finding_dispatch_conflict",
            recoveryCaseId: recoveryCase.recoveryCaseId,
            findingIds: authorized.findingIds,
          }),
          now: input.now,
        });
        return resultFromCurrentCase({ recoveryCase: terminal, evidenceBundleHash: input.evidenceBundleHash });
      }
      if (authorized.status === "budget_exhausted") {
        const terminal = await terminalizeWithoutDispatch({
          recoveryCase,
          status: "blocked",
          reasonCode: "budget_exhausted",
          evidenceBundleHash: input.evidenceBundleHash,
          decisionRef: recoveryDeliveryDecisionRef({
            kind: "dispatch_budget_exhausted",
            recoveryCaseId: recoveryCase.recoveryCaseId,
            dispatchClass: input.dispatchClass,
          }),
          now: input.now,
        });
        return resultFromCurrentCase({ recoveryCase: terminal, evidenceBundleHash: input.evidenceBundleHash });
      }
    }
    fail("V3_RECOVERY_AUTHORIZATION_CAS_EXHAUSTED", "dispatch authorization did not converge after replay");
  }

  async function hasNewMachineEvidence(
    dispatch: RecoveryRevisionDispatchV1,
    bundle: EvidenceBundleV2,
  ): Promise<boolean> {
    const priorFindingSet = await findings.findFindingSet(dispatch.findingSetHash);
    if (!priorFindingSet) return false;
    const priorHashes = canonical(priorFindingSet.findings.flatMap((finding) => finding.observedEvidenceRefs));
    const priorBundles = (await Promise.all(priorHashes.map((hash) => findings.findEvidenceBundle(hash))))
      .filter((value): value is EvidenceBundleV2 => value !== undefined);
    if (priorBundles.length === 0) return false;
    const currentFingerprint = computeMachineEvidenceFingerprintV1(bundle);
    return priorBundles.every((prior) => computeMachineEvidenceFingerprintV1(prior) !== currentFingerprint);
  }

  async function coordinateInitial(
    raw: z.infer<typeof InitialEvidenceInputSchema>,
    context: ParsedEvidenceContext,
    now: Date,
  ): Promise<V3RecoveryCoordinatorResult> {
    if (context.slice.recovery) {
      fail("V3_RECOVERY_INITIAL_SLICE_HAS_DIRECTIVE", "initial evidence cannot contain a recovery directive");
    }
    const attemptId = context.evidenceBundle.attemptId;
    if (!attemptId) fail("V3_RECOVERY_EVIDENCE_ATTEMPT_REQUIRED", "initial evidence requires an exact attempt");
    const attempt = await attempts.findById(attemptId);
    if (!attempt) fail("V3_RECOVERY_ATTEMPT_NOT_FOUND", `attempt ${attemptId} does not exist`);
    if (!sameSliceRevision(context.slice, attempt.sourceBefore)) {
      fail("V3_RECOVERY_INITIAL_SLICE_SOURCE_MISMATCH", "initial slice does not match the attempt source-before fence");
    }
    if (raw.downstreamAuthority && (
      raw.downstreamAuthority.runId !== context.evidenceBundle.runId
      || raw.downstreamAuthority.storyId !== context.evidenceBundle.storyId
      || raw.downstreamAuthority.packetHash !== context.evidenceBundle.packetHash
      || raw.downstreamAuthority.workflowStepId !== attempt.stepId
      || attempt.attemptClass !== "evidence_only"
      || attempt.role !== "downstream-evidence-orchestrator"
      || attempt.recoveryDispatchId !== undefined
      || attempt.recoveryCaseRevisionId !== undefined
    )) {
      fail("V3_RECOVERY_DOWNSTREAM_AUTHORITY_MISMATCH", "downstream initial evidence does not own the exact QA/final story attempt");
    }
    assertAttemptEvidence({ attempt, context });
    await findings.putEvidenceBundle(context.evidenceBundle);
    if (context.evidenceBundle.aggregateVerdict === "pass") {
      return { status: "verified", evidenceBundleHash: context.bundleHash, attemptId };
    }
    const findingSet = validateFailureFindingSet(context);
    await findings.putFindingSet(findingSet);
    const coordinatorEventHash = computeV3RecoveryCoordinatorEventHashV1({
      kind: raw.kind,
      evidenceBundleHash: context.bundleHash,
      findingSetHash: findingSet.findingSetHash,
      attemptId,
      failureClass: context.failureClass,
    });
    const decisionRef = recoveryDeliveryDecisionRef({
      kind: "initial_evidence_classified",
      coordinatorEventHash,
    });
    const opened = await findings.openRecoveryCase(initialCaseDraft({
      context,
      findingSet,
      attemptId,
      decisionRef,
    }), {
      now,
      evidencePlanArtifactHash: context.evidencePlanArtifactHash,
    });
    if (["resolved", "blocked", "superseded"].includes(opened.recoveryCase.status)) {
      return resultFromCurrentCase({
        recoveryCase: opened.recoveryCase,
        evidenceBundleHash: context.bundleHash,
      });
    }
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    if (!revision) fail("V3_RECOVERY_CURRENT_REVISION_MISSING", "opened case has no revision");
    if (opened.recoveryCase.status !== "open" || revision.findingSetHash !== findingSet.findingSetHash) {
      return resultFromCurrentCase({
        recoveryCase: opened.recoveryCase,
        evidenceBundleHash: context.bundleHash,
      });
    }
    const dispatchClass: DispatchClass = revision.owner === "implement"
      ? "product_implementation"
      : revision.owner === "supervisor"
        ? "supervisor_repair"
        : "evidence_only";
    return authorizeRevision({
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      dispatchClass,
      evidenceBundleHash: context.bundleHash,
      ...(raw.downstreamAuthority
        ? { downstreamAuthority: raw.downstreamAuthority, downstreamAttemptId: attemptId }
        : {}),
      now,
    });
  }

  async function coordinateRecovery(
    raw: z.infer<typeof RecoveryEvidenceInputSchema>,
    context: ParsedEvidenceContext,
    now: Date,
  ): Promise<V3RecoveryCoordinatorResult> {
    if (context.evidenceBundle.attemptId !== raw.attemptId) {
      fail("V3_RECOVERY_INPUT_ATTEMPT_MISMATCH", "input and evidence bundle name different attempts");
    }
    const identity = await loadRecoveryIdentity({
      recoveryCaseId: raw.recoveryCaseId,
      revisionId: raw.revisionId,
      dispatchId: raw.dispatchId,
      attemptId: raw.attemptId,
      context,
    });
    const originalFindingSet = await findings.findFindingSet(identity.dispatch.findingSetHash);
    if (
      !originalFindingSet
      || originalFindingSet.findings.some((finding) => finding.classification === "unstructured_review")
    ) {
      fail(
        "V3_RECOVERY_GITHUB_REVIEW_RESOLUTION_EVIDENCE_REQUIRED",
        "Unstructured review recovery can resolve only from exact durable GitHub thread-state evidence",
      );
    }
    await findings.putEvidenceBundle(context.evidenceBundle);
    const coordinatorEventHash = computeV3RecoveryCoordinatorEventHashV1({
      kind: raw.kind,
      recoveryCaseId: raw.recoveryCaseId,
      revisionId: raw.revisionId,
      dispatchId: raw.dispatchId,
      attemptId: raw.attemptId,
      evidenceBundleHash: context.bundleHash,
      ...(context.findingSet ? { findingSetHash: context.findingSet.findingSetHash } : {}),
      ...(context.failureClass ? { failureClass: context.failureClass } : {}),
    });
    await completeDeliveryExactly({ identity, context, coordinatorEventHash, now });

    if (context.evidenceBundle.aggregateVerdict === "pass") {
      const recoveryCase = await transitionTerminal({
        recoveryCaseId: identity.recoveryCase.recoveryCaseId,
        status: "resolved",
        reasonCode: "evidence_satisfied",
        evidenceBundleHash: context.bundleHash,
        attemptId: identity.attempt.attemptId,
        dispatch: identity.dispatch,
        decisionRef: recoveryDeliveryDecisionRef({
          kind: "recovery_evidence_satisfied",
          coordinatorEventHash,
        }),
        now,
      });
      const revision = await deliveries.findCurrentRevision(recoveryCase.recoveryCaseId);
      if (!revision) fail("V3_RECOVERY_CURRENT_REVISION_MISSING", "resolved case has no revision");
      return {
        status: "resolved",
        recoveryCaseId: recoveryCase.recoveryCaseId,
        revisionId: revision.revisionId,
        evidenceBundleHash: context.bundleHash,
        attemptId: identity.attempt.attemptId,
      };
    }

    const findingSet = validateFailureFindingSet(context);
    await findings.putFindingSet(findingSet);
    let currentCase = await findings.findRecoveryCase(identity.recoveryCase.recoveryCaseId);
    let currentRevision = await deliveries.findCurrentRevision(identity.recoveryCase.recoveryCaseId);
    if (!currentCase || !currentRevision) {
      fail("V3_RECOVERY_CURRENT_IDENTITY_MISSING", "case or revision disappeared after delivery completion");
    }
    if (
      ["resolved", "blocked", "superseded"].includes(currentCase.status)
      || currentRevision.revisionId !== identity.revision.revisionId
    ) {
      return resultFromCurrentCase({ recoveryCase: currentCase, evidenceBundleHash: context.bundleHash });
    }

    const clearProductFailure = context.evidenceBundle.aggregateVerdict === "fail"
      && context.failureClass === "product";
    const sourceRecovery = deriveSourceRecovery(context.slice, findingSet);
    const machineEvidenceDelta = identity.dispatch.dispatchClass === "evidence_only"
      ? await hasNewMachineEvidence(identity.dispatch, context.evidenceBundle)
      : false;

    type Next =
      | Readonly<{
          kind: "dispatch";
          dispatchClass: DispatchClass;
          owner: RecoveryCaseRevisionV1["owner"];
          expectedDelta: RecoveryCaseRevisionV1["expectedDelta"];
          allowedPaths: string[];
        }>
      | Readonly<{
          kind: "blocked";
          owner: RecoveryCaseRevisionV1["owner"];
          expectedDelta: RecoveryCaseRevisionV1["expectedDelta"];
          allowedPaths: string[];
          reasonCode: "specification_incomplete" | "evidence_inconclusive" | "budget_exhausted" | "operator_required";
        }>;

    let next: Next;
    if (!clearProductFailure) {
      if (identity.dispatch.dispatchClass !== "evidence_only" && currentCase.budget.used.evidenceOnly < 1) {
        next = {
          kind: "dispatch",
          dispatchClass: "evidence_only",
          owner: "infrastructure",
          expectedDelta: { kind: "evidence_refresh", predicateRefs: recoveryEvidenceRefs(context) },
          allowedPaths: [],
        };
      } else {
        next = {
          kind: "blocked",
          owner: "operator",
          expectedDelta: { kind: "operator_action", reasonCode: "specification_decision_required" },
          allowedPaths: [],
          reasonCode: "evidence_inconclusive",
        };
      }
    } else if (!sourceRecovery) {
      next = {
        kind: "blocked",
        owner: "operator",
        expectedDelta: { kind: "operator_action", reasonCode: "specification_decision_required" },
        allowedPaths: [],
        reasonCode: "specification_incomplete",
      };
    } else if (identity.dispatch.dispatchClass === "product_implementation") {
      next = {
        kind: "dispatch",
        dispatchClass: "supervisor_repair",
        owner: "supervisor",
        expectedDelta: sourceRecovery.expectedDelta,
        allowedPaths: sourceRecovery.allowedPaths,
      };
    } else if (identity.dispatch.dispatchClass === "supervisor_repair") {
      next = {
        kind: "blocked",
        owner: "supervisor",
        expectedDelta: sourceRecovery.expectedDelta,
        allowedPaths: sourceRecovery.allowedPaths,
        reasonCode: "budget_exhausted",
      };
    } else if (!machineEvidenceDelta) {
      next = {
        kind: "blocked",
        owner: "operator",
        expectedDelta: { kind: "operator_action", reasonCode: "specification_decision_required" },
        allowedPaths: [],
        reasonCode: "evidence_inconclusive",
      };
    } else if (currentCase.budget.used.implement < 1) {
      next = {
        kind: "dispatch",
        dispatchClass: "product_implementation",
        owner: "implement",
        expectedDelta: sourceRecovery.expectedDelta,
        allowedPaths: sourceRecovery.allowedPaths,
      };
    } else if (currentCase.budget.used.supervisorRepair < 1) {
      next = {
        kind: "dispatch",
        dispatchClass: "supervisor_repair",
        owner: "supervisor",
        expectedDelta: sourceRecovery.expectedDelta,
        allowedPaths: sourceRecovery.allowedPaths,
      };
    } else {
      next = {
        kind: "blocked",
        owner: "operator",
        expectedDelta: { kind: "operator_action", reasonCode: "specification_decision_required" },
        allowedPaths: [],
        reasonCode: "budget_exhausted",
      };
    }

    const advanced = await advanceRevisionExactly({
      identity,
      findingSet,
      owner: next.owner,
      expectedDelta: next.expectedDelta,
      allowedPaths: next.allowedPaths,
      evidencePlan: recoveryEvidenceRefs(context),
      evidencePlanArtifactHash: context.evidencePlanArtifactHash,
      decisionRef: recoveryDeliveryDecisionRef({
        kind: "recovery_evidence_revision",
        coordinatorEventHash,
        next: next.kind,
        ...(next.kind === "dispatch" ? { dispatchClass: next.dispatchClass } : { reasonCode: next.reasonCode }),
      }),
      now,
    });
    currentCase = advanced.recoveryCase;
    currentRevision = advanced.revision;
    if (["resolved", "blocked", "superseded"].includes(currentCase.status)) {
      return resultFromCurrentCase({ recoveryCase: currentCase, evidenceBundleHash: context.bundleHash });
    }
    if (next.kind === "dispatch") {
      return authorizeRevision({
        recoveryCaseId: currentCase.recoveryCaseId,
        revisionId: currentRevision.revisionId,
        dispatchClass: next.dispatchClass,
        evidenceBundleHash: context.bundleHash,
        now,
      });
    }
    const terminal = await transitionTerminal({
      recoveryCaseId: currentCase.recoveryCaseId,
      status: "blocked",
      reasonCode: next.reasonCode,
      evidenceBundleHash: context.bundleHash,
      attemptId: identity.attempt.attemptId,
      dispatch: identity.dispatch,
      decisionRef: recoveryDeliveryDecisionRef({
        kind: "recovery_bounded_terminal",
        coordinatorEventHash,
        reasonCode: next.reasonCode,
      }),
      now,
    });
    return resultFromCurrentCase({ recoveryCase: terminal, evidenceBundleHash: context.bundleHash });
  }

  return {
    async coordinateGithubReviewResolution(
      input: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<V3GithubReviewResolutionCoordinatorResult> {
      const request = V3GithubReviewResolutionCoordinatorInputSchema.parse(input);
      const now = new Date(options.now ?? new Date());
      if (!Number.isFinite(now.getTime())) {
        fail("V3_RECOVERY_TIME_INVALID", "coordinator time is invalid");
      }
      const evidence = await reviewResolutions.findByHash(request.evidenceHash);
      if (!evidence) {
        fail("V3_RECOVERY_GITHUB_REVIEW_RESOLUTION_EVIDENCE_MISSING", "Durable review resolution evidence does not exist");
      }
      const [recoveryCase, revision, dispatch, delivery, attempt, findingSet] = await Promise.all([
        findings.findRecoveryCase(evidence.recoveryCaseId),
        deliveries.findRevision(evidence.recoveryCaseRevisionId),
        deliveries.findDispatch(evidence.recoveryDispatchId),
        deliveries.findDelivery(evidence.recoveryDispatchId),
        attempts.findById(evidence.attemptId),
        findings.findFindingSet(evidence.findingSetHash),
      ]);
      if (!recoveryCase || !revision || !dispatch || !delivery || !attempt || !findingSet) {
        fail("V3_RECOVERY_GITHUB_REVIEW_IDENTITY_MISSING", "Resolution recovery identity chain is incomplete");
      }
      if (
        revision.recoveryCaseId !== evidence.recoveryCaseId
        || revision.revisionId !== evidence.recoveryCaseRevisionId
        || revision.findingSetHash !== evidence.findingSetHash
        || dispatch.recoveryCaseId !== evidence.recoveryCaseId
        || dispatch.revisionId !== evidence.recoveryCaseRevisionId
        || dispatch.dispatchId !== evidence.recoveryDispatchId
        || dispatch.dispatchClass !== "supervisor_repair"
        || dispatch.findingSetHash !== evidence.findingSetHash
        || delivery.recoveryCaseId !== evidence.recoveryCaseId
        || delivery.revisionId !== evidence.recoveryCaseRevisionId
        || delivery.attemptId !== evidence.attemptId
        || attempt.recoveryDispatchId !== evidence.recoveryDispatchId
        || attempt.recoveryCaseRevisionId !== evidence.recoveryCaseRevisionId
        || attempt.attemptClass !== "supervisor_repair"
        || !terminalAttempt(attempt)
        || !attempt.sourceAfter
        || !sameRevision(attempt.sourceBefore, evidence.originalSourceRevision)
        || !sameRevision(attempt.sourceAfter, evidence.observedSourceRevision)
        || recoveryCase.runId !== evidence.runId
        || recoveryCase.storyId !== evidence.storyId
        || recoveryCase.packetHash !== evidence.packetHash
        || recoveryCase.sliceHash !== evidence.contractSliceHash
        || recoveryCase.findingSetHash !== evidence.findingSetHash
        || !sameRevision(recoveryCase.sourceRevision, evidence.originalSourceRevision)
        || findingSet.findings.length !== evidence.threads.length
        || findingSet.findings.some((finding) => finding.classification !== "unstructured_review")
      ) {
        fail("V3_RECOVERY_GITHUB_REVIEW_IDENTITY_MISMATCH", "Resolution evidence differs from its recovery authority chain");
      }
      await reviewResolutions.resolve(evidence.evidenceHash, { now });
      return {
        status: "resolved",
        recoveryCaseId: evidence.recoveryCaseId,
        revisionId: evidence.recoveryCaseRevisionId,
        reviewResolutionEvidenceHash: evidence.evidenceHash,
        attemptId: evidence.attemptId,
      };
    },

    async coordinate(
      input: unknown,
      options: Readonly<{ now?: Date }> = {},
    ): Promise<V3RecoveryCoordinatorResult> {
      const raw = V3RecoveryCoordinatorInputSchema.parse(input);
      const now = new Date(options.now ?? new Date());
      if (!Number.isFinite(now.getTime())) fail("V3_RECOVERY_TIME_INVALID", "coordinator time is invalid");
      const context = parseContext(raw);
      const ownerKey = `setfarm:v3-recovery:${context.evidenceBundle.runId}:${context.evidenceBundle.storyId}`;
      // One story-level decision owner must finish revision advancement plus
      // authorization/terminalization before a concurrent replay observes it.
      // Repository CAS remains the durable fence; this lock removes the narrow
      // open-revision/no-delivery observation window between those CAS steps.
      return sql.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerKey]);
        return raw.kind === "initial_evidence"
          ? coordinateInitial(raw, context, now)
          : coordinateRecovery(raw, context, now);
      }) as Promise<V3RecoveryCoordinatorResult>;
    },
  };
}
