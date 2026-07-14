import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GithubReviewResolutionEvidenceV1Schema,
  GithubReviewResolutionObservationAuthorityV1Schema,
  createGithubReviewResolutionEvidenceV1,
} from "../../src/findings/github-review-resolution-evidence.js";
import {
  GithubReviewSourceError,
  createGithubReviewSource,
} from "../../src/findings/github-review-source.js";

const ORIGINAL_SHA = "1".repeat(40);
const ORIGINAL_TREE = "2".repeat(40);
const OBSERVED_SHA = "3".repeat(40);
const OBSERVED_TREE = "4".repeat(40);

function authority() {
  return GithubReviewResolutionObservationAuthorityV1Schema.parse({
    schema: "setfarm.github-review-resolution-observation-authority.v1",
    runId: "run-review-resolution",
    storyId: "US-001",
    packetHash: "a".repeat(64),
    contractSliceHash: "b".repeat(64),
    recoveryCaseId: `RCV_${"c".repeat(64)}`,
    recoveryCaseRevisionId: `RREV_${"d".repeat(64)}`,
    recoveryDispatchId: `RDISP_${"e".repeat(64)}`,
    attemptId: "ATT_00000000-0000-0000-0000-000000000117",
    findingSetHash: "f".repeat(64),
    repository: { nodeId: "R_repo", owner: "setrox", name: "generated" },
    prNumber: 1925,
    originalHeadSha: ORIGINAL_SHA,
    originalSourceRevision: { sha: ORIGINAL_SHA, treeHash: ORIGINAL_TREE },
    observedHeadSha: OBSERVED_SHA,
    observedSourceRevision: { sha: OBSERVED_SHA, treeHash: OBSERVED_TREE },
    threads: [
      {
        findingId: `FIND_${"1".repeat(64)}`,
        threadId: "PRRT_a",
        originalEvidenceArtifactHash: "5".repeat(64),
        originalBodyRevisionHash: "6".repeat(64),
      },
      {
        findingId: `FIND_${"2".repeat(64)}`,
        threadId: "PRRT_b",
        originalEvidenceArtifactHash: "7".repeat(64),
        originalBodyRevisionHash: "8".repeat(64),
      },
    ],
  });
}

function page(input: Readonly<{
  head?: string;
  repositoryNodeId?: string;
  threads?: readonly Readonly<{ id: string; resolved: boolean; outdated: boolean }>[];
}> = {}) {
  return {
    data: {
      repository: {
        id: input.repositoryNodeId ?? "R_repo",
        pullRequest: {
          number: 1925,
          state: "OPEN",
          headRefOid: input.head ?? OBSERVED_SHA,
          reviewThreads: {
            nodes: (input.threads ?? [
              { id: "PRRT_a", resolved: true, outdated: false },
              { id: "PRRT_b", resolved: false, outdated: true },
            ]).map((thread) => ({
              id: thread.id,
              isResolved: thread.resolved,
              isOutdated: thread.outdated,
              path: "src/App.tsx",
              line: 10,
              startLine: null,
              comments: {
                nodes: [{
                  id: `comment-${thread.id}`,
                  body: "original review prose is not interpreted",
                  author: { login: "reviewer" },
                  createdAt: "2026-07-14T10:00:00.000Z",
                  lastEditedAt: null,
                }],
                pageInfo: { hasNextPage: false },
              },
            })),
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  };
}

describe("v3 GitHub review resolution evidence", () => {
  it("observes exactly the original thread set without source reads or GitHub mutation", async () => {
    let sourceReads = 0;
    const source = createGithubReviewSource({
      fetchPage: async () => page({
        threads: [
          { id: "PRRT_unrelated", resolved: false, outdated: false },
          { id: "PRRT_b", resolved: false, outdated: true },
          { id: "PRRT_a", resolved: true, outdated: false },
        ],
      }),
      readSource: async () => { sourceReads += 1; return Buffer.from("unused"); },
    });
    const evidence = await source.readResolution({ authority: authority() });
    assert.equal(sourceReads, 0);
    assert.equal(GithubReviewResolutionEvidenceV1Schema.safeParse(evidence).success, true);
    assert.deepEqual(evidence.threads.map((thread) => [thread.threadId, thread.status]), [
      ["PRRT_a", "RESOLVED"],
      ["PRRT_b", "OUTDATED"],
    ]);
    assert.equal(evidence.observedHeadSha, OBSERVED_SHA);
  });

  it("fails closed for a stale head, missing thread, or still-actionable original thread", async () => {
    for (const [expectedCode, observed] of [
      ["GITHUB_REVIEW_RESOLUTION_STALE_HEAD", page({ head: "9".repeat(40) })],
      ["GITHUB_REVIEW_RESOLUTION_THREAD_MISSING", page({
        threads: [{ id: "PRRT_a", resolved: true, outdated: false }],
      })],
      ["GITHUB_REVIEW_RESOLUTION_THREAD_UNRESOLVED", page({
        threads: [
          { id: "PRRT_a", resolved: true, outdated: false },
          { id: "PRRT_b", resolved: false, outdated: false },
        ],
      })],
    ] as const) {
      const source = createGithubReviewSource({
        fetchPage: async () => observed,
        readSource: async () => Buffer.from("unused"),
      });
      await assert.rejects(
        source.readResolution({ authority: authority() }),
        (error: unknown) => error instanceof GithubReviewSourceError && error.code === expectedCode,
      );
    }
  });

  it("rejects tampered hashes, duplicate originals, and extra payload fields", () => {
    const exactAuthority = authority();
    const { schema: _schema, ...identity } = exactAuthority;
    const evidence = createGithubReviewResolutionEvidenceV1({
      ...identity,
      prState: "OPEN",
      threads: exactAuthority.threads.map((thread) => ({ ...thread, status: "RESOLVED" as const })),
    });
    assert.equal(GithubReviewResolutionEvidenceV1Schema.safeParse({
      ...evidence,
      evidenceHash: "0".repeat(64),
    }).success, false);
    assert.equal(GithubReviewResolutionEvidenceV1Schema.safeParse({
      ...evidence,
      threads: [evidence.threads[0], { ...evidence.threads[1], threadId: evidence.threads[0]!.threadId }],
    }).success, false);
    assert.equal(GithubReviewResolutionEvidenceV1Schema.safeParse({
      ...evidence,
      inventedResolution: true,
    }).success, false);
  });
});
