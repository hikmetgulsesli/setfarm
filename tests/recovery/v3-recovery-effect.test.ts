import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeEvidenceBundleHash,
  computeObservationRef,
  createEvidenceBundleV2,
  type EvidenceBundleV2,
  type EvidenceObservationDraftV2,
} from "../../src/evidence/evidence-bundle-v2.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import type { V3ImplementationAttemptResult } from "../../src/execution/v3-implementation-attempt.js";
import { createFindingSetV1 } from "../../src/findings/finding-set.js";
import { createGithubReviewResolutionEvidenceV1 } from "../../src/findings/github-review-resolution-evidence.js";
import { GithubReviewThreadEvidenceV1Schema } from "../../src/findings/github-review-source.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import {
  coordinateV3RecoveryEffect,
  createV3RecoveryCompletionPlanDescriptor,
  V3RecoveryEffectPayloadV1Schema,
} from "../../src/recovery/v3-recovery-effect.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const RUN_ID = "run-v3-recovery-effect";
const ATTEMPT_ID = "ATT_v3-recovery-effect-0001";
const SLICE_HASH = "a".repeat(64);
const PLAN_ARTIFACT_HASH = "b".repeat(64);
const SOURCE = { sha: "1".repeat(40), treeHash: "2".repeat(64) };
const ORIGINAL_SOURCE = { sha: "3".repeat(40), treeHash: "4".repeat(64) };
const STARTED_AT = "2026-07-13T00:00:00.000Z";
const COMPLETED_AT = "2026-07-13T00:00:01.000Z";

function evidence(verdict: "pass" | "fail"): EvidenceBundleV2 {
  const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
  const artifactHash = "c".repeat(64);
  const observation: EvidenceObservationDraftV2 = {
    kind: "runtime",
    owner: "setfarm-orchestrator",
    runtimeSessionId: "runtime-v3-recovery-effect",
    runtimeArtifactHash: artifactHash,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
  };
  const observationRef = computeObservationRef(observation);
  return createEvidenceBundleV2({
    runId: RUN_ID,
    storyId: slice.storyId,
    packetHash: slice.packetHash,
    sliceHash: SLICE_HASH,
    sourceRevision: SOURCE,
    attemptId: ATTEMPT_ID,
    predicates: [{
      invariantRef: "INV_RUNTIME",
      predicateRef: "EVID_SAVE_RELOAD",
      required: true,
      verdict,
      observationRefs: [observationRef],
    }],
    observations: [observation],
    artifacts: [{ hash: artifactHash, mediaType: "application/json", locator: ".setfarm/runtime.json" }],
    runner: { id: "setfarm-test", version: "1", environmentHash: "d".repeat(64) },
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
  });
}

function context(bundle: EvidenceBundleV2, recovery = false): V3ImplementationAttemptResult {
  const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
  const evidencePlan = compileEvidencePlanV1({ slice, sliceHash: SLICE_HASH });
  return {
    attempt: {
      attemptId: ATTEMPT_ID,
      runId: RUN_ID,
      storyId: slice.storyId,
      packetHash: bundle.packetHash,
      sliceHash: SLICE_HASH,
      ...(recovery
        ? {
            recoveryCaseRevisionId: `RREV_${"e".repeat(64)}`,
            recoveryDispatchId: `RDISP_${"f".repeat(64)}`,
          }
        : {}),
    },
    slice,
    sliceHash: SLICE_HASH,
    sliceRefKey: "SLICE_TEST",
    evidencePlan,
    evidencePlanArtifactHash: PLAN_ARTIFACT_HASH,
    evidencePlanRefKey: "EVIDENCE_PLAN_TEST",
    packetHash: bundle.packetHash,
    compilationReportHash: "9".repeat(64),
    sourceBefore: SOURCE,
    ...(recovery
      ? {
          recovery: {
            revision: {
              recoveryCaseId: `RCV_${"8".repeat(64)}`,
              revisionId: `RREV_${"e".repeat(64)}`,
            },
            dispatch: { dispatchId: `RDISP_${"f".repeat(64)}` },
            findingSet: findingSet(bundle),
            reviewEvidenceArtifacts: [],
          },
        }
      : {}),
  } as V3ImplementationAttemptResult;
}

function findingSet(bundle: EvidenceBundleV2) {
  const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
  return createFindingSetV1({
    runId: bundle.runId,
    storyId: bundle.storyId,
    packetHash: bundle.packetHash,
    sliceHash: bundle.sliceHash,
    sourceRevision: bundle.sourceRevision,
    findings: [{
      origin: "runtime",
      classification: "structured",
      invariantRef: "INV_RUNTIME",
      sourceLocators: [{ path: slice.files[0]!.path, contentHash: "7".repeat(64) }],
      observedEvidenceRefs: [computeEvidenceBundleHash(bundle)],
      expectedPredicateRef: "EVID_SAVE_RELOAD",
      status: "open",
    }],
  });
}

function githubReviewContext(bundle: EvidenceBundleV2): V3ImplementationAttemptResult {
  const base = context(bundle);
  const path = base.slice.files[0]!.path;
  const artifactHash = "5".repeat(64);
  const comments = [{
    commentId: "PRRC_v3-recovery-effect",
    author: "reviewer",
    body: "Review prose is evidence only, never a classifier input.",
    createdAt: STARTED_AT,
  }];
  const bodyRevisionHash = hashCanonicalJson({
    schema: "setfarm.github-review-thread-body-revision.v1",
    threadId: "PRRT_v3-recovery-effect",
    comments,
  });
  const evidenceWithoutHash = {
    schema: "setfarm.github-review-thread-evidence.v1" as const,
    repository: { nodeId: "R_repo", owner: "setrox", name: "generated" },
    prNumber: 1925,
    prState: "OPEN" as const,
    headSha: ORIGINAL_SOURCE.sha,
    threadId: "PRRT_v3-recovery-effect",
    path,
    line: 42,
    comments,
    bodyRevisionHash,
    currentSource: { contentHash: "6".repeat(64), byteLength: 42 },
  };
  const reviewEvidence = GithubReviewThreadEvidenceV1Schema.parse({
    ...evidenceWithoutHash,
    evidenceHash: hashCanonicalJson(evidenceWithoutHash),
  });
  const reviews = createFindingSetV1({
    runId: bundle.runId,
    storyId: bundle.storyId,
    packetHash: bundle.packetHash,
    sliceHash: bundle.sliceHash,
    sourceRevision: ORIGINAL_SOURCE,
    findings: [{
      origin: "review",
      classification: "unstructured_review",
      externalRef: {
        platform: "github",
        repositoryNodeId: reviewEvidence.repository.nodeId,
        prNumber: reviewEvidence.prNumber,
        threadId: reviewEvidence.threadId,
        commentId: comments[0]!.commentId,
        headSha: reviewEvidence.headSha,
        commentRevisionHash: reviewEvidence.bodyRevisionHash,
      },
      invariantRef: "INV_UNSTRUCTURED_REVIEW",
      sourceLocators: [{ path, contentHash: reviewEvidence.currentSource.contentHash }],
      observedEvidenceRefs: [artifactHash],
      status: "open",
    }],
  });
  return {
    ...base,
    sourceBefore: ORIGINAL_SOURCE,
    attempt: {
      ...base.attempt,
      attemptClass: "supervisor_repair",
      disposition: "produced_delta",
      sourceBefore: ORIGINAL_SOURCE,
      sourceAfter: SOURCE,
      recoveryCaseRevisionId: `RREV_${"e".repeat(64)}`,
      recoveryDispatchId: `RDISP_${"f".repeat(64)}`,
    },
    recovery: {
      revision: {
        recoveryCaseId: `RCV_${"8".repeat(64)}`,
        revisionId: `RREV_${"e".repeat(64)}`,
      },
      dispatch: {
        dispatchId: `RDISP_${"f".repeat(64)}`,
        dispatchClass: "supervisor_repair",
      },
      findingSet: reviews,
      reviewEvidenceArtifacts: [{ artifactHash, evidence: reviewEvidence }],
    },
  } as V3ImplementationAttemptResult;
}

describe("v3 recovery completion effect", () => {
  it("publishes only immutable evidence refs and derives initial coordinator input from durable state", async () => {
    const bundle = evidence("pass");
    const attemptContext = context(bundle);
    const descriptor = createV3RecoveryCompletionPlanDescriptor({
      context: attemptContext,
      evidenceBundle: bundle,
      continuation: { type: "story_loop_continue" },
      subject: { storyDbId: "story-db-1", storyId: bundle.storyId, sourceSha: SOURCE.sha },
    });
    const payload = V3RecoveryEffectPayloadV1Schema.parse(descriptor.effects[0]!.payload);
    assert.equal(payload.evidenceBundleHash, computeEvidenceBundleHash(bundle));
    assert.equal("recoveryCaseId" in payload, false);
    assert.equal("allowedPaths" in payload, false);

    let coordinated: unknown;
    const result = await coordinateV3RecoveryEffect(payload, {
      loadAttemptContext: async () => attemptContext,
      findEvidenceBundle: async () => bundle,
      findFindingSet: async () => undefined,
      coordinate: async (input) => {
        coordinated = input;
        return { status: "verified", evidenceBundleHash: payload.evidenceBundleHash, attemptId: ATTEMPT_ID };
      },
    });
    assert.equal(result.status, "verified");
    assert.equal((coordinated as { kind: string }).kind, "initial_evidence");
  });

  it("loads the exact finding set and derives recovery identity from the attempt ledger", async () => {
    const bundle = evidence("fail");
    const attemptContext = context(bundle, true);
    const findings = findingSet(bundle);
    const descriptor = createV3RecoveryCompletionPlanDescriptor({
      context: attemptContext,
      evidenceBundle: bundle,
      findingSet: findings,
      failureClass: "product",
      continuation: { type: "story_loop_continue" },
      subject: { storyDbId: "story-db-1", storyId: bundle.storyId, sourceSha: SOURCE.sha },
    });
    const payload = descriptor.effects[0]!.payload;
    let coordinated: any;
    await coordinateV3RecoveryEffect(payload, {
      loadAttemptContext: async () => attemptContext,
      findEvidenceBundle: async () => bundle,
      findFindingSet: async () => findings,
      coordinate: async (input) => {
        coordinated = input;
        return {
          status: "blocked",
          recoveryCaseId: attemptContext.recovery!.revision.recoveryCaseId,
          revisionId: attemptContext.recovery!.revision.revisionId,
          reasonCode: "budget_exhausted",
          evidenceBundleHash: computeEvidenceBundleHash(bundle),
        };
      },
    });
    assert.equal(coordinated.kind, "recovery_evidence");
    assert.equal(coordinated.recoveryCaseId, attemptContext.recovery!.revision.recoveryCaseId);
    assert.equal(coordinated.dispatchId, attemptContext.recovery!.dispatch.dispatchId);
    assert.equal(coordinated.findingSet.findingSetHash, findings.findingSetHash);
  });

  it("fails closed when a content-addressed evidence ref resolves to different bytes", async () => {
    const bundle = evidence("pass");
    const attemptContext = context(bundle);
    const payload = {
      schema: "setfarm.v3-recovery-effect.v1",
      runId: RUN_ID,
      storyId: bundle.storyId,
      attemptId: ATTEMPT_ID,
      sliceHash: SLICE_HASH,
      evidencePlanArtifactHash: PLAN_ARTIFACT_HASH,
      evidenceBundleHash: "0".repeat(64),
    };
    await assert.rejects(
      coordinateV3RecoveryEffect(payload, {
        loadAttemptContext: async () => attemptContext,
        findEvidenceBundle: async () => bundle,
        findFindingSet: async () => undefined,
        coordinate: async () => { throw new Error("must not coordinate"); },
      }),
      /V3_RECOVERY_EFFECT_DURABLE_IDENTITY_MISMATCH/,
    );
  });

  it("resolves GitHub review recovery only from exact terminal thread-state evidence", async () => {
    const bundle = evidence("pass");
    const attemptContext = githubReviewContext(bundle);
    const descriptor = createV3RecoveryCompletionPlanDescriptor({
      context: attemptContext,
      evidenceBundle: bundle,
      continuation: { type: "story_loop_continue" },
      subject: { storyDbId: "story-db-1", storyId: bundle.storyId, sourceSha: SOURCE.sha },
    });
    let observedAuthority: any;
    let storedHash: string | undefined;
    let coordinatedHash: string | undefined;
    const result = await coordinateV3RecoveryEffect(descriptor.effects[0]!.payload, {
      loadAttemptContext: async () => attemptContext,
      findEvidenceBundle: async () => bundle,
      findFindingSet: async () => undefined,
      coordinate: async () => { throw new Error("generic recovery must not interpret review prose"); },
      observeGithubReviewResolution: async ({ authority }) => {
        observedAuthority = authority;
        const { schema: _schema, ...identity } = authority;
        return createGithubReviewResolutionEvidenceV1({
          ...identity,
          prState: "OPEN",
          threads: authority.threads.map((thread) => ({ ...thread, status: "OUTDATED" as const })),
        });
      },
      putGithubReviewResolution: async (resolution) => {
        storedHash = resolution.evidenceHash;
        return { evidence: resolution };
      },
      coordinateGithubReviewResolution: async ({ evidenceHash }) => {
        coordinatedHash = evidenceHash;
        return {
          status: "resolved",
          recoveryCaseId: attemptContext.recovery!.revision.recoveryCaseId,
          revisionId: attemptContext.recovery!.revision.revisionId,
          reviewResolutionEvidenceHash: evidenceHash,
          attemptId: ATTEMPT_ID,
        };
      },
    });
    assert.equal(result.status, "resolved");
    assert.equal(observedAuthority.originalHeadSha, ORIGINAL_SOURCE.sha);
    assert.equal(observedAuthority.observedHeadSha, SOURCE.sha);
    assert.equal(observedAuthority.threads.length, 1);
    assert.equal(storedHash, coordinatedHash);
    assert.equal("reviewResolutionEvidenceHash" in result, true);
  });
});
