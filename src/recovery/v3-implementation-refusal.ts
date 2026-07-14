import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ClaimEnvelopeV1 } from "../execution/schemas/claim-envelope-v1.js";
import type { SourceRevisionV1 } from "../execution/schemas/execution-attempt-v1.js";
import type { V3ImplementationContextV1 } from "../execution/v3-implementation-handoff.js";
import type { V3ImplementationRefusalOutputV1 } from "../execution/v3-implementation-output.js";
import { createAttemptRepository } from "../execution/attempt-repository.js";
import { completeStoryClaimAndBoundAttempt } from "../execution/claim-attempt-transition.js";
import { createSingleEffectCompletionPlanDescriptorV1 } from "../execution/schemas/runtime-completion-plan-v1.js";
import { captureShadowSourceRevision } from "../execution/shadow-attempt-recorder.js";
import { createFindingSetV1, type FindingSetV1 } from "../findings/finding-set.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { topologyPathAbsenceHash } from "../product-compiler/schemas/build-topology-v1.js";
import type { ImplementationFileV1 } from "../product-compiler/schemas/implementation-slice-v1.js";
import { createFindingRecoveryRepository } from "./finding-recovery-repository.js";
import type { RecoveryCaseDraftV1, RecoveryCaseV1 } from "./recovery-case.js";
import { getSql } from "../db-pg.js";

export type V3RefusalFileSnapshot = Readonly<{
  pathRef: string;
  path: string;
  presence: "present" | "absent" | "unsupported";
  contentHash: string;
}>;

export type V3ImplementationRefusalDecision = Readonly<{
  refusalHash: string;
  findingSet: FindingSetV1;
  recoveryCase: RecoveryCaseDraftV1;
  sourceAfter: SourceRevisionV1;
  attemptDisposition: "failed" | "inconclusive";
  diagnostic: string;
}>;

function sameSource(left: SourceRevisionV1, right: SourceRevisionV1): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function sourceSnapshot(worktree: string, file: Pick<ImplementationFileV1, "pathRef" | "path">): V3RefusalFileSnapshot {
  const root = path.resolve(worktree);
  const absolute = path.resolve(root, file.path);
  if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
    throw new Error(`V3_REFUSAL_SOURCE_PATH_ESCAPE:${file.pathRef}`);
  }
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(absolute);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        pathRef: file.pathRef,
        path: file.path,
        presence: "absent",
        contentHash: topologyPathAbsenceHash(file.path),
      };
    }
    throw error;
  }
  if (!stat.isFile()) {
    return {
      pathRef: file.pathRef,
      path: file.path,
      presence: "unsupported",
      contentHash: hashCanonicalJson({ schema: "setfarm.unsupported-source-node.v1", path: file.path, mode: stat.mode }),
    };
  }
  return {
    pathRef: file.pathRef,
    path: file.path,
    presence: "present",
    contentHash: createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
  };
}

export function captureV3RefusalFileSnapshots(
  context: V3ImplementationContextV1,
): V3RefusalFileSnapshot[] {
  return context.handoff.implementationSlice.files
    .map((file) => sourceSnapshot(context.handoff.workdir, file))
    .sort((left, right) => left.pathRef.localeCompare(right.pathRef));
}

function mismatchedSliceFiles(
  context: V3ImplementationContextV1,
  snapshots: readonly V3RefusalFileSnapshot[],
): V3RefusalFileSnapshot[] {
  const expected = new Map(context.handoff.implementationSlice.files.map((file) => [file.pathRef, file]));
  return snapshots.filter((snapshot) => {
    const file = expected.get(snapshot.pathRef);
    return !file || snapshot.presence !== file.presence || snapshot.contentHash !== file.knownContentHash;
  });
}

function refusalLocator(snapshot: V3RefusalFileSnapshot): Readonly<{ path: string; contentHash: string }> {
  return { path: snapshot.path, contentHash: snapshot.contentHash };
}

/**
 * Convert an agent refusal into compiler-owned, content-addressed recovery.
 * Refusal validity is proven from current source; agent summary text is never
 * used to select an owner, invariant, predicate, or retry budget.
 */
export function buildV3ImplementationRefusalDecision(input: Readonly<{
  context: V3ImplementationContextV1;
  output: V3ImplementationRefusalOutputV1;
  observedSource: SourceRevisionV1;
  fileSnapshots: readonly V3RefusalFileSnapshot[];
}>): V3ImplementationRefusalDecision {
  const { context, output, observedSource } = input;
  const handoff = context.handoff;
  const refusalHash = hashCanonicalJson(output);
  const sourceChanged = !sameSource(observedSource, handoff.sourceBefore);
  const fileMismatches = mismatchedSliceFiles(context, input.fileSnapshots);

  let invariantRef: "INV_SOURCE_SNAPSHOT_MATCH" | "INV_COMPILER_OWNERSHIP_COMPLETE";
  let expectedPredicateRef: "EVID_SOURCE_SNAPSHOT_MATCH" | "EVID_COMPILER_OWNERSHIP_COMPLETE";
  let locators: ReadonlyArray<Readonly<{ path: string; contentHash: string }>>;
  let expectedDelta: RecoveryCaseDraftV1["expectedDelta"];
  let status: "superseded" | "blocked";
  let terminal: NonNullable<RecoveryCaseDraftV1["terminal"]>;
  let attemptDisposition: "failed" | "inconclusive";
  let diagnostic: string;

  if (output.refusal.code === "SOURCE_SNAPSHOT_MISMATCH") {
    if (!sourceChanged && fileMismatches.length === 0) {
      throw new Error("V3_REFUSAL_SOURCE_MISMATCH_NOT_PROVEN");
    }
    const mismatchRefs = new Set(fileMismatches.map((file) => file.pathRef));
    const claimedRefs = output.refusal.mismatchedPathRefs ?? [];
    if (claimedRefs.some((pathRef) => !mismatchRefs.has(pathRef))) {
      throw new Error("V3_REFUSAL_CLAIMED_PATH_MISMATCH_NOT_PROVEN");
    }
    const fallback = input.fileSnapshots[0];
    const selected = claimedRefs.length
      ? fileMismatches.filter((file) => claimedRefs.includes(file.pathRef))
      : fileMismatches.length
        ? fileMismatches
        : fallback ? [fallback] : [];
    if (selected.length === 0) throw new Error("V3_REFUSAL_SOURCE_LOCATOR_REQUIRED");
    invariantRef = "INV_SOURCE_SNAPSHOT_MATCH";
    expectedPredicateRef = "EVID_SOURCE_SNAPSHOT_MATCH";
    locators = selected.map(refusalLocator);
    expectedDelta = { kind: "upstream_recompile", artifactKinds: ["implementation_slice"] };
    status = "superseded";
    terminal = {
      owner: "compiler",
      outcome: "superseded",
      reasonCode: "source_superseded",
      evidenceBundleHashes: [],
    };
    attemptDisposition = "failed";
    diagnostic = "SOURCE_SNAPSHOT_MISMATCH proven; exact implementation slice superseded and returned to compiler ownership";
  } else {
    if (sourceChanged || fileMismatches.length > 0) {
      throw new Error("V3_REFUSAL_SCOPE_CONFLICT_REQUIRES_UNCHANGED_SOURCE");
    }
    const requiredSnapshots = output.refusal.requiredPaths.map((requiredPath) => sourceSnapshot(
      handoff.workdir,
      { pathRef: `PATH_REFUSAL_${hashCanonicalJson(requiredPath).slice(0, 16).toUpperCase()}`, path: requiredPath },
    ));
    invariantRef = "INV_COMPILER_OWNERSHIP_COMPLETE";
    expectedPredicateRef = "EVID_COMPILER_OWNERSHIP_COMPLETE";
    locators = requiredSnapshots.map(refusalLocator);
    expectedDelta = {
      kind: "upstream_recompile",
      artifactKinds: ["build_topology", "implementation_slice", "story_plan"],
    };
    status = "blocked";
    terminal = {
      owner: "compiler",
      outcome: "blocked",
      reasonCode: "upstream_recompile_required",
      evidenceBundleHashes: [],
    };
    attemptDisposition = "inconclusive";
    diagnostic = "CONTRACT_SCOPE_CONFLICT proven on unchanged source; topology/ownership contract returned to compiler ownership";
  }

  const findingSet = createFindingSetV1({
    runId: handoff.runId,
    storyId: handoff.storyId,
    packetHash: handoff.packetHash,
    sliceHash: handoff.sliceHash,
    sourceRevision: observedSource,
    findings: [{
      origin: "compiler",
      classification: "structured",
      invariantRef,
      sourceLocators: [...locators],
      observedEvidenceRefs: [refusalHash],
      expectedPredicateRef,
      status: "open",
    }],
  });
  const recoveryCase: RecoveryCaseDraftV1 = {
    runId: handoff.runId,
    storyId: handoff.storyId,
    findingSetHash: findingSet.findingSetHash,
    findingIds: findingSet.findings.map((finding) => finding.findingId),
    packetHash: handoff.packetHash,
    sliceHash: handoff.sliceHash,
    sourceRevision: observedSource,
    owner: "compiler",
    expectedDelta,
    allowedPaths: [],
    evidencePlan: [expectedPredicateRef],
    priorAttemptRefs: [handoff.attemptId],
    budget: {
      limits: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
      used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
    },
    status,
    terminal,
    decisionRefs: [refusalHash],
  };
  return {
    refusalHash,
    findingSet,
    recoveryCase,
    sourceAfter: observedSource,
    attemptDisposition,
    diagnostic,
  };
}

export type V3ImplementationRefusalHandled = Readonly<{
  findingSet: FindingSetV1;
  recoveryCase: RecoveryCaseV1;
  refusalHash: string;
}>;

export async function handleV3ImplementationRefusal(input: Readonly<{
  envelope: ClaimEnvelopeV1;
  context: V3ImplementationContextV1;
  output: V3ImplementationRefusalOutputV1;
  rawOutput: string;
}>): Promise<V3ImplementationRefusalHandled> {
  const { envelope, context } = input;
  const handoff = context.handoff;
  if (
    envelope.protocol !== "v3"
    || envelope.runId !== handoff.runId
    || envelope.stepId !== handoff.stepId
    || envelope.storyId !== handoff.storyId
    || envelope.storyDbId !== handoff.storyDbId
    || envelope.claimId !== handoff.claimId
    || envelope.attempt?.attemptId !== handoff.attemptId
    || envelope.attempt?.generation !== handoff.attemptGeneration
  ) {
    throw new Error("V3_REFUSAL_CLAIM_IDENTITY_MISMATCH");
  }
  const observedSource = await captureShadowSourceRevision(handoff.workdir);
  const decision = buildV3ImplementationRefusalDecision({
    context,
    output: input.output,
    observedSource,
    fileSnapshots: captureV3RefusalFileSnapshots(context),
  });

  const sql = getSql();
  const attempts = createAttemptRepository(sql);
  const candidate = await attempts.recordCandidateSource({
    attemptId: envelope.attempt!.attemptId,
    generation: envelope.attempt!.generation,
    fenceToken: envelope.attempt!.fenceToken,
    sourceAfter: decision.sourceAfter,
  });
  if (candidate.status !== "candidate") throw new Error("V3_REFUSAL_ATTEMPT_FENCE_LOST");

  const recovery = createFindingRecoveryRepository(sql);
  await recovery.putFindingSet(decision.findingSet);
  const opened = await recovery.openRecoveryCase(decision.recoveryCase, {
    evidencePlanArtifactHash: handoff.evidencePlanArtifactHash,
  });
  const recoveryCase = opened.recoveryCase;
  const evidenceRefs = [
    `setfarm://v3-refusal/${decision.refusalHash}`,
    `setfarm://finding-set/${decision.findingSet.findingSetHash}`,
    `setfarm://recovery-case/${recoveryCase.recoveryCaseId}`,
  ].sort();
  const refusalRecord = canonicalJsonStringify({
    schema: "setfarm.v3-implementation-refusal-record.v1",
    output: input.output,
    refusalHash: decision.refusalHash,
    findingSetHash: decision.findingSet.findingSetHash,
    recoveryCaseId: recoveryCase.recoveryCaseId,
    owner: recoveryCase.owner,
    expectedDelta: recoveryCase.expectedDelta,
    status: recoveryCase.status,
  });
  await completeStoryClaimAndBoundAttempt(sql, {
    envelope,
    sourceAfter: decision.sourceAfter,
    outputHash: createHash("sha256").update(input.rawOutput, "utf8").digest("hex"),
    evidenceRefs,
    attemptDisposition: decision.attemptDisposition,
    storyStatus: "failed",
    storyOutput: refusalRecord,
    storyBranch: handoff.branch,
    storyMergeStatus: "refused",
    stepStatus: "running",
    stepOutput: refusalRecord,
    completionPlan: createSingleEffectCompletionPlanDescriptorV1({
      kind: "loop_failure",
      continuation: { type: "failure_finalize" },
      subject: { storyDbId: handoff.storyDbId, storyId: handoff.storyId, sourceSha: decision.sourceAfter.sha },
      effectType: "v3.refusal.recorded",
      effectPayload: {
        refusalHash: decision.refusalHash,
        refusalCode: input.output.refusal.code,
        attemptId: handoff.attemptId,
        findingSetHash: decision.findingSet.findingSetHash,
        recoveryCaseId: recoveryCase.recoveryCaseId,
        owner: recoveryCase.owner,
        status: recoveryCase.status,
        ...(handoff.implementationSlice.recovery
          ? {
              priorRecoveryDispatchId: handoff.implementationSlice.recovery.recoveryDispatchId,
              priorRecoveryRevisionId: handoff.implementationSlice.recovery.recoveryCaseRevisionId,
            }
          : {}),
      },
    }),
    diagnostic: decision.diagnostic,
  });
  return {
    findingSet: decision.findingSet,
    recoveryCase,
    refusalHash: decision.refusalHash,
  };
}
