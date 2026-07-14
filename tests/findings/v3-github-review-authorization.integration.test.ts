import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createAttemptRepository } from "../../src/execution/attempt-repository.js";
import { ingestGithubReviewThreadsV1 } from "../../src/findings/github-review-ingestion.js";
import { createGithubReviewResolutionEvidenceRepository } from "../../src/findings/github-review-resolution-evidence-repository.js";
import { createGithubReviewResolutionEvidenceV1 } from "../../src/findings/github-review-resolution-evidence.js";
import {
  V3GithubReviewDispatchAuthorityV1Schema,
  type V3GithubReviewDispatchAuthorityV1,
} from "../../src/findings/github-review-routing-authority.js";
import {
  GithubReviewThreadEvidenceV1Schema,
  type GithubReviewThreadEvidenceV1,
} from "../../src/findings/github-review-source.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createFindingRecoveryRepository } from "../../src/recovery/finding-recovery-repository.js";
import { createRecoveryDeliveryRepository } from "../../src/recovery/recovery-delivery-repository.js";
import { createV3RecoveryCoordinator } from "../../src/recovery/v3-recovery-coordinator.js";
import { createIsolatedTestDatabase, type TestDatabase } from "../execution-attempts/test-database.js";

const RELEASE_SHA = "3".repeat(40);
const REVIEW_ARTIFACT_TYPE = "setfarm.github-review-thread-evidence.v1";
const REVIEW_EVIDENCE_PLAN = "EVID_REVIEW_THREAD_CURRENT";
const NOW = new Date("2026-07-14T08:00:00.000Z");

type Fixture = Readonly<{
  runId: string;
  storyId: string;
  storyDbId: string;
  recoveryCaseId: string;
  revisionId: string;
  findingSetHash: string;
  initialStateVersion: number;
  authority: V3GithubReviewDispatchAuthorityV1;
}>;

type StateSnapshot = Readonly<{
  story_status: string;
  recovery_status: string;
  state_version: number;
  used_supervisor_repair: number;
  dispatches: number;
  deliveries: number;
}>;

function testHash(label: string, sequence: number): string {
  return hashCanonicalJson({ schema: "setfarm.github-review-authorization-test-hash.v1", label, sequence });
}

function gitHash(label: string, sequence: number): string {
  return testHash(label, sequence).slice(0, 40);
}

function reviewEvidence(input: Readonly<{
  sequence: number;
  threadId: string;
  path: string;
  headSha: string;
}>): GithubReviewThreadEvidenceV1 {
  const comments = [{
    commentId: `COMMENT_${input.threadId}`,
    author: "setfarm-reviewer",
    body: `Review ${input.threadId}: exact current-source repair requested`,
    createdAt: "2026-07-14T07:55:00.000Z",
  }];
  const bodyRevisionHash = hashCanonicalJson({
    schema: "setfarm.github-review-thread-body-revision.v1",
    threadId: input.threadId,
    comments,
  });
  const withoutEvidenceHash = {
    schema: "setfarm.github-review-thread-evidence.v1" as const,
    repository: {
      nodeId: "REPO_NODE_SETROX_PROJECT",
      owner: "setrox",
      name: "generated-project",
    },
    prNumber: 1925,
    prState: "OPEN" as const,
    headSha: input.headSha,
    threadId: input.threadId,
    path: input.path,
    line: 12,
    comments,
    bodyRevisionHash,
    currentSource: {
      contentHash: testHash(`source:${input.path}`, input.sequence),
      byteLength: 128,
    },
  };
  return GithubReviewThreadEvidenceV1Schema.parse({
    ...withoutEvidenceHash,
    evidenceHash: hashCanonicalJson(withoutEvidenceHash),
  });
}

describe("v3 GitHub review recovery authorization", () => {
  let database: TestDatabase;
  let sequence = 0;

  before(async () => {
    database = await createIsolatedTestDatabase();
  });

  after(async () => database.cleanup());

  async function setup(): Promise<Fixture> {
    sequence += 1;
    const current = sequence;
    const runId = `run-v3-github-review-authorization-${current}`;
    const storyId = `US-GITHUB-${current}`;
    const storyDbId = `story-v3-github-review-authorization-${current}`;
    const verifyStepDbId = `verify-v3-github-review-authorization-${current}`;
    const packetHash = testHash("packet", current);
    const contractSliceHash = testHash("slice", current);
    const compilationReportHash = testHash("compilation-report", current);
    const sourceBefore = {
      sha: gitHash("source-before-sha", current),
      treeHash: gitHash("source-before-tree", current),
    };
    const sourceRevision = {
      sha: gitHash("review-head", current),
      treeHash: gitHash("review-tree", current),
    };
    const releaseAdmissionHash = await database.seedV3ReleaseGoAdmission(RELEASE_SHA);
    const producer = JSON.stringify({
      pass: "v3-github-review-authorization-integration-test",
      codeSha: RELEASE_SHA,
      toolVersions: { setfarm: "test" },
    });

    await database.sql.unsafe(
      `INSERT INTO semantic_artifacts (
         artifact_hash, artifact_type, byte_length, producer_metadata
       ) VALUES ($1, 'setfarm.product-build-packet.v3', 1, $2::text::jsonb)
       ON CONFLICT (artifact_hash) DO NOTHING`,
      [packetHash, producer],
    );
    await database.sql.unsafe(
      `INSERT INTO runs (
         id, workflow_id, task, status, protocol, protocol_version,
         compiler_release_sha, packet_hash, activation_preflight_hash,
         release_admission_hash
       ) VALUES ($1, 'feature-dev', 'typed GitHub review authorization', 'running',
                 'v3', 1, $2, $3, $4, $5)`,
      [runId, RELEASE_SHA, packetHash, testHash("activation-preflight", current), releaseAdmissionHash],
    );
    await database.sql.unsafe(
      `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
       VALUES ($1, $2, $3::text::jsonb)`,
      [runId, packetHash, JSON.stringify({ version: "3.0.0", codeSha: RELEASE_SHA })],
    );
    await database.sql.unsafe(
      `INSERT INTO steps (
         id, run_id, step_id, agent_id, step_index, input_template, expects,
         status, type, retry_count
       ) VALUES ($1, $2, 'verify', 'reviewer', 7, 'verify', 'STATUS: done',
                 'running', 'single', 0)`,
      [verifyStepDbId, runId],
    );
    await database.sql.unsafe(
      `INSERT INTO stories (
         id, run_id, story_index, story_id, title, status, scope_files,
         resolved_scope_files, story_branch, pr_url
       ) VALUES ($1, $2, 1, $3, 'GitHub reviewed story', 'done', $4, $4,
                 $5, 'https://github.com/setrox/generated-project/pull/1925')`,
      [
        storyDbId,
        runId,
        storyId,
        JSON.stringify(["src/App.tsx", "src/components/Nav.tsx"]),
        `story/${storyId.toLowerCase()}`,
      ],
    );

    const implementationClaimRows = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, 'implement', $2, 'developer', $3)
       RETURNING id::text`,
      [runId, storyId, new Date("2026-07-14T07:40:00.000Z")],
    );
    const implementationClaimId = Number(implementationClaimRows[0]!.id);
    const attempts = createAttemptRepository(database.sql);
    const reserved = await attempts.reserve({
      claimId: implementationClaimId,
      runId,
      stepId: "implement",
      storyId,
      attemptClass: "product_implementation",
      packetHash,
      compilationReportHash,
      sliceHash: contractSliceHash,
      sourceBefore,
      role: "developer",
      agentId: "developer",
      branch: `story/${storyId.toLowerCase()}`,
      worktree: `/tmp/${runId}`,
      evidenceRefs: [`setfarm://claim-log/${implementationClaimId}`],
    }, { now: new Date("2026-07-14T07:41:00.000Z") });
    assert.equal(reserved.status, "reserved");
    const completed = await attempts.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "produced_delta",
      sourceAfter: sourceRevision,
      outputHash: testHash("implementation-output", current),
      evidenceRefs: ["setfarm://github-review/source-head"],
    }, { now: new Date("2026-07-14T07:50:00.000Z") });
    assert.equal(completed.status, "completed");
    await database.sql.unsafe(
      "UPDATE claim_log SET outcome = 'completed' WHERE id = $1",
      [implementationClaimId],
    );

    const parentClaimRows = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, 'verify', NULL, 'reviewer', $2)
       RETURNING id::text`,
      [runId, new Date("2026-07-14T07:51:00.000Z")],
    );
    const parentClaimId = Number(parentClaimRows[0]!.id);
    const evidence = [
      reviewEvidence({
        sequence: current,
        threadId: `THREAD_${String(current).padStart(2, "0")}_A`,
        path: "src/App.tsx",
        headSha: sourceRevision.sha,
      }),
      reviewEvidence({
        sequence: current,
        threadId: `THREAD_${String(current).padStart(2, "0")}_B`,
        path: "src/components/Nav.tsx",
        headSha: sourceRevision.sha,
      }),
    ].sort((left, right) => left.threadId.localeCompare(right.threadId));

    for (const [index, artifact] of evidence.entries()) {
      await database.sql.unsafe(
        `INSERT INTO semantic_artifacts (
           artifact_hash, artifact_type, byte_length, producer_metadata
         ) VALUES ($1, $2, $3, $4::text::jsonb)`,
        [artifact.evidenceHash, REVIEW_ARTIFACT_TYPE, Buffer.byteLength(JSON.stringify(artifact)), producer],
      );
      await database.sql.unsafe(
        `INSERT INTO run_artifact_refs (run_id, ref_key, artifact_hash)
         VALUES ($1, $2, $3)`,
        [runId, `GITHUB_REVIEW_THREAD_${index + 1}`, artifact.evidenceHash],
      );
    }

    const findingSet = ingestGithubReviewThreadsV1({
      schema: "setfarm.github-review-finding-set-input.v1",
      runId,
      storyId,
      packetHash,
      sliceHash: contractSliceHash,
      sourceRevision,
      reviews: evidence.map((artifact) => ({
        evidenceArtifactHash: artifact.evidenceHash,
        comment: {
          repositoryNodeId: artifact.repository.nodeId,
          prNumber: artifact.prNumber,
          threadId: artifact.threadId,
          commentId: artifact.comments.at(-1)!.commentId,
          headSha: artifact.headSha,
          bodyRevisionHash: artifact.bodyRevisionHash,
          currentSource: {
            path: artifact.path,
            contentHash: artifact.currentSource.contentHash,
          },
        },
      })),
    });
    const findings = createFindingRecoveryRepository(database.sql);
    await findings.putFindingSet(findingSet);
    const exactPaths = findingSet.findings
      .flatMap((finding) => finding.sourceLocators.map((locator) => locator.path))
      .sort();
    const opened = await findings.openRecoveryCase({
      runId,
      storyId,
      findingSetHash: findingSet.findingSetHash,
      findingIds: findingSet.findings.map((finding) => finding.findingId),
      packetHash,
      sliceHash: contractSliceHash,
      sourceRevision,
      owner: "supervisor",
      expectedDelta: {
        kind: "source_change",
        invariantRefs: ["INV_UNSTRUCTURED_REVIEW"],
        requiredPaths: exactPaths,
      },
      allowedPaths: exactPaths,
      evidencePlan: [REVIEW_EVIDENCE_PLAN],
      priorAttemptRefs: [reserved.attempt.attemptId],
      budget: {
        limits: { implement: 0, supervisorRepair: 1, evidenceOnly: 1 },
        used: { implement: 0, supervisorRepair: 0, evidenceOnly: 0 },
      },
      status: "open",
      decisionRefs: [],
    }, { now: new Date("2026-07-14T07:59:00.000Z") });
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const revision = await deliveries.findCurrentRevision(opened.recoveryCase.recoveryCaseId);
    assert.ok(revision);
    const authority = V3GithubReviewDispatchAuthorityV1Schema.parse({
      schema: "setfarm.v3-github-review-dispatch-authority.v1",
      runId,
      verifyStepDbId,
      workflowStepId: "verify",
      parentClaimId,
      storyId,
      storyDbId,
      packetHash,
      implementationAttemptId: reserved.attempt.attemptId,
      contractSliceHash,
      sourceRevision,
      reviews: evidence.map((artifact) => ({
        evidenceArtifactHash: artifact.evidenceHash,
        repositoryNodeId: artifact.repository.nodeId,
        prNumber: artifact.prNumber,
        threadId: artifact.threadId,
        commentId: artifact.comments.at(-1)!.commentId,
        headSha: artifact.headSha,
        bodyRevisionHash: artifact.bodyRevisionHash,
        path: artifact.path,
        sourceContentHash: artifact.currentSource.contentHash,
      })),
    });
    return {
      runId,
      storyId,
      storyDbId,
      recoveryCaseId: opened.recoveryCase.recoveryCaseId,
      revisionId: revision.revisionId,
      findingSetHash: findingSet.findingSetHash,
      initialStateVersion: opened.recoveryCase.stateVersion,
      authority,
    };
  }

  async function state(fixture: Fixture): Promise<StateSnapshot> {
    const rows = await database.sql.unsafe<StateSnapshot[]>(
      `SELECT story.status AS story_status,
              recovery.status AS recovery_status,
              recovery.state_version,
              recovery.used_supervisor_repair,
              (SELECT COUNT(*)::integer FROM recovery_revision_dispatches dispatch
                WHERE dispatch.recovery_case_id = recovery.recovery_case_id) AS dispatches,
              (SELECT COUNT(*)::integer FROM recovery_dispatch_deliveries delivery
                WHERE delivery.recovery_case_id = recovery.recovery_case_id) AS deliveries
         FROM recovery_cases recovery
         JOIN stories story ON story.id = $2 AND story.run_id = recovery.run_id
        WHERE recovery.recovery_case_id = $1`,
      [fixture.recoveryCaseId, fixture.storyDbId],
    );
    assert.equal(rows.length, 1);
    return { ...rows[0]! };
  }

  function authorizeInput(fixture: Fixture, githubReview: unknown = fixture.authority) {
    return {
      recoveryCaseId: fixture.recoveryCaseId,
      revisionId: fixture.revisionId,
      expectedStateVersion: fixture.initialStateVersion,
      dispatchClass: "supervisor_repair",
      githubReview,
    };
  }

  async function rejectsWithoutMutation(
    fixture: Fixture,
    authority: unknown,
    expected: RegExp,
  ): Promise<void> {
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const beforeState = await state(fixture);
    await assert.rejects(deliveries.authorizeCurrentRevision(
      authorizeInput(fixture, authority),
      { now: NOW },
    ), expected);
    assert.deepEqual(await state(fixture), beforeState);
  }

  async function terminalSupervisorRepair(fixture: Fixture) {
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    const authorized = await deliveries.authorizeCurrentRevision(
      authorizeInput(fixture),
      { now: NOW },
    );
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected GitHub review authorization");
    const leased = await deliveries.leaseNext({
      ownerInstanceId: `github-review-resolution-worker-${fixture.storyId}`,
      runId: fixture.runId,
      storyId: fixture.storyId,
      leaseMs: 60_000,
    }, { now: new Date("2026-07-14T08:00:01.000Z") });
    assert.ok(leased);
    assert.equal(leased.dispatchId, authorized.dispatch.dispatchId);
    const claimRows = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)
       VALUES ($1, 'implement', $2, 'github-review-supervisor', $3)
       RETURNING id::text`,
      [fixture.runId, fixture.storyId, new Date("2026-07-14T08:00:02.000Z")],
    );
    const claimId = Number(claimRows[0]!.id);
    const attempts = createAttemptRepository(database.sql);
    const reserved = await attempts.reserve({
      claimId,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      attemptClass: "supervisor_repair",
      packetHash: authorized.dispatch.packetHash,
      compilationReportHash: testHash("resolution-compilation-report", claimId),
      sliceHash: authorized.dispatch.contractSliceHash,
      sourceBefore: authorized.dispatch.sourceRevision,
      findingSetHash: authorized.dispatch.findingSetHash,
      recoveryCaseRevisionId: authorized.dispatch.revisionId,
      recoveryDispatchId: authorized.dispatch.dispatchId,
      recoveryDeliveryLease: {
        ownerInstanceId: leased.ownerInstanceId!,
        leaseToken: leased.leaseToken!,
      },
      role: "supervisor",
      agentId: "github-review-supervisor",
      evidenceRefs: [`setfarm://claim-log/${claimId}`],
    }, { now: new Date("2026-07-14T08:00:03.000Z") });
    assert.equal(reserved.status, "reserved");
    const runningAttempt = await attempts.markRunning({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
    }, { now: new Date("2026-07-14T08:00:04.000Z") });
    assert.equal(runningAttempt.status, "running");
    const runningDelivery = await deliveries.markRunning({
      dispatchId: authorized.dispatch.dispatchId,
      revisionId: authorized.dispatch.revisionId,
      attemptId: reserved.attempt.attemptId,
    }, { now: new Date("2026-07-14T08:00:05.000Z") });
    assert.equal(runningDelivery?.state, "running");
    const observedSourceRevision = {
      sha: gitHash("review-resolution-head", claimId),
      treeHash: gitHash("review-resolution-tree", claimId),
    };
    const candidate = await attempts.recordCandidateSource({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      sourceAfter: observedSourceRevision,
    }, { now: new Date("2026-07-14T08:00:06.000Z") });
    assert.equal(candidate.status, "candidate");
    const completed = await attempts.complete({
      attemptId: reserved.attempt.attemptId,
      generation: reserved.attempt.generation,
      fenceToken: reserved.attempt.fenceToken,
      disposition: "produced_delta",
      sourceAfter: observedSourceRevision,
      outputHash: testHash("review-resolution-output", claimId),
      evidenceRefs: ["setfarm://github-review/resolution-observation-pending"],
    }, { now: new Date("2026-07-14T08:00:07.000Z") });
    assert.equal(completed.status, "completed");
    const terminalAttempt = await attempts.findById(reserved.attempt.attemptId);
    assert.ok(terminalAttempt);
    assert.deepEqual(terminalAttempt.sourceBefore, fixture.authority.sourceRevision);
    assert.deepEqual(terminalAttempt.sourceAfter, observedSourceRevision);
    await database.sql.unsafe(
      "UPDATE claim_log SET outcome = 'completed' WHERE id = $1",
      [claimId],
    );
    const findingSet = await createFindingRecoveryRepository(database.sql)
      .findFindingSet(fixture.findingSetHash);
    assert.ok(findingSet);
    const reviewsByThread = new Map(fixture.authority.reviews.map((review) => [review.threadId, review]));
    const resolution = createGithubReviewResolutionEvidenceV1({
      runId: fixture.runId,
      storyId: fixture.storyId,
      packetHash: fixture.authority.packetHash,
      contractSliceHash: fixture.authority.contractSliceHash,
      recoveryCaseId: fixture.recoveryCaseId,
      recoveryCaseRevisionId: fixture.revisionId,
      recoveryDispatchId: authorized.dispatch.dispatchId,
      attemptId: reserved.attempt.attemptId,
      findingSetHash: fixture.findingSetHash,
      repository: {
        nodeId: fixture.authority.reviews[0]!.repositoryNodeId,
        owner: "setrox",
        name: "generated-project",
      },
      prNumber: fixture.authority.reviews[0]!.prNumber,
      originalHeadSha: fixture.authority.sourceRevision.sha,
      originalSourceRevision: fixture.authority.sourceRevision,
      observedHeadSha: observedSourceRevision.sha,
      observedSourceRevision,
      prState: "OPEN",
      threads: findingSet.findings.map((finding, index) => {
        assert.ok(finding.externalRef);
        const review = reviewsByThread.get(finding.externalRef.threadId);
        assert.ok(review);
        return {
          findingId: finding.findingId,
          threadId: review.threadId,
          originalEvidenceArtifactHash: review.evidenceArtifactHash,
          originalBodyRevisionHash: review.bodyRevisionHash,
          status: index === 0 ? "RESOLVED" as const : "OUTDATED" as const,
        };
      }),
    });
    return { resolution, dispatch: authorized.dispatch, attempt: reserved.attempt };
  }

  it("atomically moves one done story to one bounded supervisor dispatch and dedupes unchanged replay", async () => {
    const fixture = await setup();
    const deliveries = createRecoveryDeliveryRepository(database.sql);
    assert.deepEqual(await state(fixture), {
      story_status: "done",
      recovery_status: "open",
      state_version: fixture.initialStateVersion,
      used_supervisor_repair: 0,
      dispatches: 0,
      deliveries: 0,
    });

    const authorized = await deliveries.authorizeCurrentRevision(
      authorizeInput(fixture),
      { now: NOW },
    );
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("expected GitHub review authorization");
    assert.equal(authorized.dispatch.dispatchClass, "supervisor_repair");
    assert.equal(authorized.dispatch.findingIds.length, 2);
    assert.equal(authorized.delivery.state, "authorized");
    assert.deepEqual(await state(fixture), {
      story_status: "failed",
      recovery_status: "repairing",
      state_version: fixture.initialStateVersion + 1,
      used_supervisor_repair: 1,
      dispatches: 1,
      deliveries: 1,
    });

    const replay = await deliveries.authorizeCurrentRevision({
      ...authorizeInput(fixture),
      expectedStateVersion: authorized.stateVersion,
    }, { now: new Date("2026-07-14T08:00:01.000Z") });
    assert.equal(replay.status, "duplicate");
    assert.deepEqual(await state(fixture), {
      story_status: "failed",
      recovery_status: "repairing",
      state_version: fixture.initialStateVersion + 1,
      used_supervisor_repair: 1,
      dispatches: 1,
      deliveries: 1,
    });
  });

  it("fails closed on a tampered PR head without mutating story, dispatch, or budget", async () => {
    const fixture = await setup();
    const tamperedHead = "f".repeat(40);
    await rejectsWithoutMutation(fixture, {
      ...fixture.authority,
      sourceRevision: { ...fixture.authority.sourceRevision, sha: tamperedHead },
      reviews: fixture.authority.reviews.map((review) => ({ ...review, headSha: tamperedHead })),
    }, /RECOVERY_DISPATCH_GITHUB_AUTHORITY_MISMATCH/);
  });

  it("fails closed on a tampered source path without mutating story, dispatch, or budget", async () => {
    const fixture = await setup();
    await rejectsWithoutMutation(fixture, {
      ...fixture.authority,
      reviews: fixture.authority.reviews.map((review, index) => index === 0
        ? { ...review, path: "src/Tampered.tsx" }
        : review),
    }, /RECOVERY_DISPATCH_GITHUB_AUTHORITY_MISMATCH/);
  });

  it("fails closed on a tampered evidence artifact without mutating story, dispatch, or budget", async () => {
    const fixture = await setup();
    await rejectsWithoutMutation(fixture, {
      ...fixture.authority,
      reviews: fixture.authority.reviews.map((review, index) => index === 0
        ? { ...review, evidenceArtifactHash: "f".repeat(64) }
        : review),
    }, /RECOVERY_DISPATCH_GITHUB_AUTHORITY_MISMATCH/);
  });

  it("fails closed on a tampered verify claim without mutating story, dispatch, or budget", async () => {
    const fixture = await setup();
    await rejectsWithoutMutation(fixture, {
      ...fixture.authority,
      parentClaimId: fixture.authority.parentClaimId + 1_000_000,
    }, /RECOVERY_DISPATCH_GITHUB_AUTHORITY_MISMATCH/);
  });

  it("rejects an already-failed story with no exact dispatch and preserves the empty ledger", async () => {
    const fixture = await setup();
    await database.sql.unsafe("UPDATE stories SET status = 'failed' WHERE id = $1", [fixture.storyDbId]);
    await rejectsWithoutMutation(
      fixture,
      fixture.authority,
      /RECOVERY_DISPATCH_GITHUB_STORY_ALREADY_FAILED/,
    );
  });

  it("durably resolves only from the exact immutable original thread set and replays idempotently", async () => {
    const fixture = await setup();
    const { resolution, dispatch } = await terminalSupervisorRepair(fixture);
    const repository = createGithubReviewResolutionEvidenceRepository(database.sql);
    const inserted = await repository.put(resolution);
    assert.equal(inserted.status, "inserted");
    assert.deepEqual(await repository.findByHash(resolution.evidenceHash), resolution);
    const duplicate = await repository.put(resolution);
    assert.equal(duplicate.status, "duplicate");

    const coordinator = createV3RecoveryCoordinator(database.sql);
    const results = await Promise.all([
      coordinator.coordinateGithubReviewResolution({ evidenceHash: resolution.evidenceHash }, {
        now: new Date("2026-07-14T08:01:00.000Z"),
      }),
      coordinator.coordinateGithubReviewResolution({ evidenceHash: resolution.evidenceHash }, {
        now: new Date("2026-07-14T08:01:00.001Z"),
      }),
    ]);
    assert.deepEqual(results.map((result) => result.status), ["resolved", "resolved"]);
    assert.ok(results.every((result) => result.reviewResolutionEvidenceHash === resolution.evidenceHash));

    const terminalRows = await database.sql.unsafe<Array<{
      recovery_status: string;
      resolution_hash: string | null;
      terminal: unknown;
      delivery_state: string;
      delivery_terminal_result: unknown;
    }>>(
      `SELECT recovery.status AS recovery_status,
              recovery.github_review_resolution_evidence_hash AS resolution_hash,
              recovery.terminal,
              delivery.state AS delivery_state,
              delivery.terminal_result AS delivery_terminal_result
         FROM recovery_cases recovery
         JOIN recovery_dispatch_deliveries delivery ON delivery.dispatch_id = $2
        WHERE recovery.recovery_case_id = $1`,
      [fixture.recoveryCaseId, dispatch.dispatchId],
    );
    assert.equal(terminalRows.length, 1);
    assert.equal(terminalRows[0]!.recovery_status, "resolved");
    assert.equal(terminalRows[0]!.resolution_hash, resolution.evidenceHash);
    assert.deepEqual(terminalRows[0]!.terminal, {
      owner: "supervisor",
      outcome: "resolved",
      reasonCode: "evidence_satisfied",
      evidenceBundleHashes: [resolution.evidenceHash],
    });
    assert.equal(terminalRows[0]!.delivery_state, "succeeded");
    assert.deepEqual(terminalRows[0]!.delivery_terminal_result, {
      schema: "setfarm.github-review-resolution-result.v1",
      evidenceHash: resolution.evidenceHash,
      recoveryCaseId: fixture.recoveryCaseId,
      revisionId: fixture.revisionId,
      dispatchId: dispatch.dispatchId,
      attemptId: resolution.attemptId,
      observedSourceRevision: resolution.observedSourceRevision,
      threads: resolution.threads.map((thread) => ({
        threadId: thread.threadId,
        status: thread.status,
      })),
    });

    await assert.rejects(
      database.sql.unsafe(
        "UPDATE github_review_resolution_evidence SET repository_name = 'tampered' WHERE evidence_hash = $1",
        [resolution.evidenceHash],
      ),
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
    await assert.rejects(
      database.sql.unsafe(
        "DELETE FROM github_review_resolution_evidence WHERE evidence_hash = $1",
        [resolution.evidenceHash],
      ),
      /ARTIFACT_IDENTITY_IMMUTABLE/,
    );
  });

  it("fails closed on missing, extra, stale, and altered original thread authority without terminal mutation", async () => {
    const fixture = await setup();
    const { resolution } = await terminalSupervisorRepair(fixture);
    const repository = createGithubReviewResolutionEvidenceRepository(database.sql);
    const {
      schema: _schema,
      evidenceHash: _evidenceHash,
      ...base
    } = resolution;
    const missing = createGithubReviewResolutionEvidenceV1({
      ...base,
      threads: resolution.threads.slice(0, 1),
    });
    await assert.rejects(
      repository.put(missing),
      /GITHUB_REVIEW_RESOLUTION_FINDING_SET_MISMATCH/,
    );
    const extra = createGithubReviewResolutionEvidenceV1({
      ...base,
      threads: [
        ...resolution.threads,
        {
          findingId: `FIND_${testHash("extra-finding", fixture.initialStateVersion)}`,
          threadId: "THREAD_EXTRA_NOT_IN_ORIGINAL_SET",
          originalEvidenceArtifactHash: testHash("extra-artifact", fixture.initialStateVersion),
          originalBodyRevisionHash: testHash("extra-body", fixture.initialStateVersion),
          status: "RESOLVED",
        },
      ],
    });
    await assert.rejects(
      repository.put(extra),
      /GITHUB_REVIEW_RESOLUTION_FINDING_SET_MISMATCH/,
    );
    const staleSource = {
      sha: gitHash("stale-observed-head", fixture.initialStateVersion),
      treeHash: gitHash("stale-observed-tree", fixture.initialStateVersion),
    };
    const stale = createGithubReviewResolutionEvidenceV1({
      ...base,
      observedHeadSha: staleSource.sha,
      observedSourceRevision: staleSource,
      threads: resolution.threads,
    });
    await assert.rejects(
      repository.put(stale),
      /GITHUB_REVIEW_RESOLUTION_RECOVERY_AUTHORITY_MISMATCH/,
    );
    const alteredOriginal = createGithubReviewResolutionEvidenceV1({
      ...base,
      threads: resolution.threads.map((thread, index) => index === 0
        ? { ...thread, originalBodyRevisionHash: testHash("altered-original-body", fixture.initialStateVersion) }
        : thread),
    });
    await assert.rejects(
      repository.put(alteredOriginal),
      /GITHUB_REVIEW_RESOLUTION_THREAD_SET_MISMATCH/,
    );

    const rows = await database.sql.unsafe<Array<{
      status: string;
      resolution_hash: string | null;
      evidence_count: number;
    }>>(
      `SELECT recovery.status,
              recovery.github_review_resolution_evidence_hash AS resolution_hash,
              (SELECT COUNT(*)::integer
                 FROM github_review_resolution_evidence evidence
                WHERE evidence.recovery_case_id = recovery.recovery_case_id) AS evidence_count
         FROM recovery_cases recovery
        WHERE recovery.recovery_case_id = $1`,
      [fixture.recoveryCaseId],
    );
    assert.equal(rows.length, 1);
    assert.deepEqual(
      { ...rows[0]! },
      { status: "repairing", resolution_hash: null, evidence_count: 0 },
    );
  });

  it("requires a durable typed resolution artifact before the dedicated coordinator can mutate recovery", async () => {
    const fixture = await setup();
    await terminalSupervisorRepair(fixture);
    const coordinator = createV3RecoveryCoordinator(database.sql);
    await assert.rejects(
      coordinator.coordinateGithubReviewResolution({ evidenceHash: testHash("missing-resolution", fixture.initialStateVersion) }),
      /V3_RECOVERY_GITHUB_REVIEW_RESOLUTION_EVIDENCE_MISSING/,
    );
    const rows = await database.sql.unsafe<Array<{ status: string; resolution_hash: string | null }>>(
      `SELECT status, github_review_resolution_evidence_hash AS resolution_hash
         FROM recovery_cases WHERE recovery_case_id = $1`,
      [fixture.recoveryCaseId],
    );
    assert.equal(rows.length, 1);
    assert.deepEqual({ ...rows[0]! }, { status: "repairing", resolution_hash: null });
  });
});
