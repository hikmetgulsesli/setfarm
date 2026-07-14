import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GithubReviewFindingSetInputV1Schema,
  ingestGithubReviewCommentV1,
} from "../../src/findings/github-review-ingestion.js";
import { FindingSetV1Schema } from "../../src/findings/finding-set.js";

const PACKET_HASH = "a".repeat(64);
const SLICE_HASH = "b".repeat(64);
const BODY_REVISION_HASH = "c".repeat(64);
const SOURCE_CONTENT_HASH = "d".repeat(64);
const HEAD_SHA = "1".repeat(40);
const TREE_HASH = "2".repeat(40);

function input() {
  return {
    schema: "setfarm.github-review-finding-input.v1" as const,
    runId: "run-review-ingestion-1",
    storyId: "US-001",
    packetHash: PACKET_HASH,
    sliceHash: SLICE_HASH,
    sourceRevision: { sha: HEAD_SHA, treeHash: TREE_HASH },
    evidenceArtifactHash: "9".repeat(64),
    comment: {
      repositoryNodeId: "R_repo_node",
      prNumber: 1925,
      threadId: "PRRT_thread_node",
      commentId: "PRRC_comment_node",
      headSha: HEAD_SHA,
      bodyRevisionHash: BODY_REVISION_HASH,
      currentSource: {
        path: "src/App.tsx",
        contentHash: SOURCE_CONTENT_HASH,
      },
    },
  };
}

describe("typed GitHub review ingestion", () => {
  it("maps exact actionable metadata to one unstructured review finding", () => {
    const result = ingestGithubReviewCommentV1(input());
    const finding = result.findings[0]!;

    assert.equal(result.schema, "setfarm.finding-set.v1");
    assert.equal(FindingSetV1Schema.safeParse(result).success, true);
    assert.equal(result.findings.length, 1);
    assert.equal(finding.origin, "review");
    assert.equal(finding.classification, "unstructured_review");
    assert.equal(finding.invariantRef, "INV_UNSTRUCTURED_REVIEW");
    assert.equal(finding.expectedPredicateRef, undefined);
    assert.equal(finding.status, "open");
    assert.deepEqual(finding.sourceLocators, [{
      path: "src/App.tsx",
      contentHash: SOURCE_CONTENT_HASH,
    }]);
    assert.deepEqual(finding.observedEvidenceRefs, ["9".repeat(64)]);
    assert.deepEqual(finding.externalRef, {
      platform: "github",
      repositoryNodeId: "R_repo_node",
      prNumber: 1925,
      threadId: "PRRT_thread_node",
      commentId: "PRRC_comment_node",
      headSha: HEAD_SHA,
      commentRevisionHash: BODY_REVISION_HASH,
    });
  });

  it("is deterministic and makes exact evidence or source changes visible", () => {
    const first = ingestGithubReviewCommentV1(input());
    const duplicate = ingestGithubReviewCommentV1(input());
    const revisedBody = ingestGithubReviewCommentV1({
      ...input(),
      comment: { ...input().comment, bodyRevisionHash: "e".repeat(64) },
    });
    const revisedSource = ingestGithubReviewCommentV1({
      ...input(),
      comment: {
        ...input().comment,
        currentSource: { ...input().comment.currentSource, contentHash: "f".repeat(64) },
      },
    });
    const otherThread = ingestGithubReviewCommentV1({
      ...input(),
      comment: { ...input().comment, threadId: "PRRT_other_thread" },
    });

    assert.deepEqual(duplicate, first);
    assert.equal(revisedBody.findings[0]!.findingId, first.findings[0]!.findingId);
    assert.notEqual(revisedBody.findingSetHash, first.findingSetHash);
    assert.notEqual(revisedSource.findings[0]!.findingId, first.findings[0]!.findingId);
    assert.notEqual(otherThread.findings[0]!.findingId, first.findings[0]!.findingId);
  });

  it("rejects prose and classifier output instead of interpreting either", () => {
    const withBody = {
      ...input(),
      comment: { ...input().comment, body: "The button looks broken." },
    };
    const withClassification = {
      ...input(),
      comment: { ...input().comment, inferredInvariantRef: "INV_BUTTON_WORKS" },
    };

    assert.equal(GithubReviewFindingSetInputV1Schema.safeParse(withBody).success, false);
    assert.equal(GithubReviewFindingSetInputV1Schema.safeParse(withClassification).success, false);
  });

  it("fails closed when GitHub head and current source revision disagree", () => {
    const mismatched = {
      ...input(),
      comment: { ...input().comment, headSha: "3".repeat(40) },
    };

    assert.throws(
      () => ingestGithubReviewCommentV1(mismatched),
      /GitHub review head must equal the current source revision/,
    );
  });

  it("requires exact thread, comment, body revision, and normalized source identities", () => {
    const { commentId: _commentId, ...withoutCommentId } = input().comment;
    const invalidPath = {
      ...input(),
      comment: {
        ...input().comment,
        currentSource: { ...input().comment.currentSource, path: "../src/App.tsx" },
      },
    };
    const invalidBodyHash = {
      ...input(),
      comment: { ...input().comment, bodyRevisionHash: "not-a-hash" },
    };

    assert.equal(GithubReviewFindingSetInputV1Schema.safeParse({
      ...input(),
      comment: withoutCommentId,
    }).success, false);
    assert.equal(GithubReviewFindingSetInputV1Schema.safeParse(invalidPath).success, false);
    assert.equal(GithubReviewFindingSetInputV1Schema.safeParse(invalidBodyHash).success, false);
  });
});
