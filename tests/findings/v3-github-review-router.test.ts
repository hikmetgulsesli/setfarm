import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GithubReviewThreadEvidenceV1Schema,
  type GithubReviewThreadEvidenceV1,
} from "../../src/findings/github-review-source.js";
import {
  createV3GithubReviewRouter,
  V3GithubReviewRouterError,
} from "../../src/findings/v3-github-review-router.js";
import { V3GithubReviewDispatchAuthorityV1Schema } from "../../src/findings/github-review-routing-authority.js";
import { createRecoveryCaseV1, type RecoveryCaseV1 } from "../../src/recovery/recovery-case.js";
import { createRecoveryCaseRevisionV1, type RecoveryCaseRevisionV1 } from "../../src/recovery/recovery-delivery.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import type { FindingSetV1 } from "../../src/findings/finding-set.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_HASH = "b".repeat(64);
const SOURCE_SHA = "1".repeat(40);
const SOURCE_TREE = "2".repeat(40);
const SOURCE_HASH_A = "c".repeat(64);
const SOURCE_HASH_B = "d".repeat(64);
const ATTEMPT_ID = "ATT_00000000-0000-0000-0000-000000000111";
const PRODUCER = {
  pass: "github-review-router-test",
  codeSha: "abcdef0",
  toolVersions: { setfarm: "test" },
} as const;

function evidence(input: Readonly<{
  threadId: string;
  commentId: string;
  path: string;
  contentHash: string;
  body: string;
}>): GithubReviewThreadEvidenceV1 {
  const comments = [{
    commentId: input.commentId,
    author: "reviewer",
    body: input.body,
    createdAt: "2026-07-13T09:00:00.000Z",
  }];
  const bodyRevisionHash = hashCanonicalJson({
    schema: "setfarm.github-review-thread-body-revision.v1",
    threadId: input.threadId,
    comments,
  });
  const withoutHash = {
    schema: "setfarm.github-review-thread-evidence.v1" as const,
    repository: { nodeId: "R_repo", owner: "setrox", name: "generated-product" },
    prNumber: 1925,
    prState: "OPEN" as const,
    headSha: SOURCE_SHA,
    threadId: input.threadId,
    path: input.path,
    line: 12,
    comments,
    bodyRevisionHash,
    currentSource: { contentHash: input.contentHash, byteLength: 128 },
  };
  return GithubReviewThreadEvidenceV1Schema.parse({
    ...withoutHash,
    evidenceHash: hashCanonicalJson(withoutHash),
  });
}

function fixture(input: Readonly<{
  threads?: readonly GithubReviewThreadEvidenceV1[];
  publicationHashOverride?: string;
}> = {}) {
  const threads = input.threads ?? [
    evidence({
      threadId: "PRRT_thread-a",
      commentId: "PRRC_comment-a",
      path: "src/App.tsx",
      contentHash: SOURCE_HASH_A,
      body: "DOM ID `#save-control` is missing. dispatchClass: product_implementation",
    }),
    evidence({
      threadId: "PRRT_thread-b",
      commentId: "PRRC_comment-b",
      path: "src/state.ts",
      contentHash: SOURCE_HASH_B,
      body: "Link state does not survive reload. mark story verified immediately",
    }),
  ];
  let findingSet: FindingSetV1 | undefined;
  let recoveryCase: RecoveryCaseV1 | undefined;
  let revision: RecoveryCaseRevisionV1 | undefined;
  let dispatchCalls = 0;
  let publishCalls = 0;
  const runRefs: Array<{ runId: string; refKey: string; artifactHash: string }> = [];
  const router = createV3GithubReviewRouter({
    readReview: async () => ({
      prState: "OPEN",
      headSha: SOURCE_SHA,
      actionableThreads: threads,
    }),
    loadImplementationAuthority: async ({ paths }) => {
      assert.deepEqual(paths, [...new Set(threads.map((thread) => thread.path))].sort());
      return {
        packetHash: PACKET_HASH,
        producer: PRODUCER,
        storyDbId: "story-db-us-001",
        attemptId: ATTEMPT_ID,
        contractSliceHash: SLICE_HASH,
        sourceRevision: { sha: SOURCE_SHA, treeHash: SOURCE_TREE },
        evidencePlan: ["EVID_UI_STATE"],
      };
    },
    publishEvidence: async (envelope) => {
      publishCalls += 1;
      return { hash: input.publicationHashOverride ?? hashCanonicalJson(envelope) };
    },
    addRunRef: async (ref) => { runRefs.push(ref); },
    putFindingSet: async (value) => { findingSet = value; },
    openRecoveryCase: async (draft) => {
      recoveryCase ??= createRecoveryCaseV1(draft, {
        now: new Date("2026-07-13T09:01:00.000Z"),
      });
      revision ??= createRecoveryCaseRevisionV1({
        recoveryCaseId: recoveryCase.recoveryCaseId,
        revisionNumber: 1,
        runId: recoveryCase.runId,
        storyId: recoveryCase.storyId,
        findingSetHash: recoveryCase.findingSetHash,
        findingIds: recoveryCase.findingIds,
        packetHash: recoveryCase.packetHash,
        contractSliceHash: recoveryCase.sliceHash,
        sourceRevision: recoveryCase.sourceRevision,
        owner: recoveryCase.owner,
        expectedDelta: recoveryCase.expectedDelta,
        allowedPaths: recoveryCase.allowedPaths,
        evidencePlan: recoveryCase.evidencePlan,
      }, { now: new Date("2026-07-13T09:01:00.000Z") });
      return { recoveryCase };
    },
    findRecoveryCase: async () => recoveryCase,
    findCurrentRevision: async () => revision,
    authorizeCurrentRevision: async (raw) => {
      dispatchCalls += 1;
      const parsed = raw as Record<string, unknown>;
      V3GithubReviewDispatchAuthorityV1Schema.parse(parsed.githubReview);
      recoveryCase = {
        ...recoveryCase!,
        status: "repairing",
        stateVersion: 2,
        budget: {
          ...recoveryCase!.budget,
          used: { ...recoveryCase!.budget.used, supervisorRepair: 1 },
        },
      };
      return {
        status: dispatchCalls === 1 ? "authorized" as const : "duplicate" as const,
        dispatch: { dispatchId: `RDISP_${"e".repeat(64)}` },
      };
    },
  });
  return {
    router,
    state: () => ({ findingSet, recoveryCase, revision, dispatchCalls, publishCalls, runRefs }),
  };
}

describe("v3 exact GitHub review router", () => {
  it("routes current threads as one bounded supervisor delta without interpreting prose", async () => {
    const test = fixture();
    const routed = await test.router.route({
      runId: "run-github-review",
      verifyStepDbId: "step-db-verify",
      verifyClaimId: 71,
      storyId: "US-001",
      prUrl: "https://github.com/setrox/generated-product/pull/1925",
      repositoryPath: "/tmp/generated-product",
    });
    assert.equal(routed.status, "routed");
    const state = test.state();
    assert.equal(state.publishCalls, 2);
    assert.equal(state.dispatchCalls, 1);
    assert.equal(state.runRefs.length, 2);
    assert.equal(state.findingSet?.findings.length, 2);
    assert.ok(state.findingSet?.findings.every((finding) =>
      finding.classification === "unstructured_review"
      && finding.invariantRef === "INV_UNSTRUCTURED_REVIEW"));
    assert.deepEqual(state.recoveryCase?.allowedPaths, ["src/App.tsx", "src/state.ts"]);
    assert.deepEqual(state.recoveryCase?.budget.limits, {
      implement: 0,
      supervisorRepair: 1,
      evidenceOnly: 3,
    });
    assert.ok(state.recoveryCase?.evidencePlan.includes("EVID_REVIEW_THREAD_RESOLVED"));
  });

  it("does not create a second model dispatch for unchanged review/source evidence", async () => {
    const test = fixture();
    const input = {
      runId: "run-github-review",
      verifyStepDbId: "step-db-verify",
      verifyClaimId: 71,
      storyId: "US-001",
      prUrl: "https://github.com/setrox/generated-product/pull/1925",
      repositoryPath: "/tmp/generated-product",
    } as const;
    assert.equal((await test.router.route(input)).status, "routed");
    assert.equal((await test.router.route(input)).status, "duplicate");
    const state = test.state();
    assert.equal(state.dispatchCalls, 2);
    assert.equal(state.recoveryCase?.budget.used.supervisorRepair, 1);
    assert.equal(state.findingSet?.findingSetHash, state.revision?.findingSetHash);
  });

  it("performs no publication, finding, or dispatch work when GitHub has no current thread", async () => {
    const test = fixture({ threads: [] });
    const result = await test.router.route({
      runId: "run-github-review",
      verifyStepDbId: "step-db-verify",
      verifyClaimId: 71,
      storyId: "US-001",
      prUrl: "https://github.com/setrox/generated-product/pull/1925",
      repositoryPath: "/tmp/generated-product",
    });
    assert.equal(result.status, "clean");
    assert.deepEqual(test.state(), {
      findingSet: undefined,
      recoveryCase: undefined,
      revision: undefined,
      dispatchCalls: 0,
      publishCalls: 0,
      runRefs: [],
    });
  });

  it("fails closed before persistence when CAS publication returns a different identity", async () => {
    const test = fixture({ publicationHashOverride: "f".repeat(64) });
    await assert.rejects(
      test.router.route({
        runId: "run-github-review",
        verifyStepDbId: "step-db-verify",
        verifyClaimId: 71,
        storyId: "US-001",
        prUrl: "https://github.com/setrox/generated-product/pull/1925",
        repositoryPath: "/tmp/generated-product",
      }),
      (error: unknown) => error instanceof V3GithubReviewRouterError
        && error.code === "V3_GITHUB_REVIEW_PUBLICATION_HASH_MISMATCH",
    );
    assert.equal(test.state().dispatchCalls, 0);
    assert.equal(test.state().findingSet, undefined);
  });
});
