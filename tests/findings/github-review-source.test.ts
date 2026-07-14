import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGithubReviewSource,
  GithubReviewThreadEvidenceV1Schema,
} from "../../src/findings/github-review-source.js";

const HEAD = "a".repeat(40);

function page(input: Readonly<{
  body?: string;
  resolved?: boolean;
  outdated?: boolean;
  head?: string;
  hasNextPage?: boolean;
  endCursor?: string | null;
}> = {}) {
  return {
    data: {
      repository: {
        id: "R_repo_node",
        pullRequest: {
          number: 1925,
          state: "OPEN",
          headRefOid: input.head ?? HEAD,
          reviewThreads: {
            nodes: [{
              id: "PRRT_dom_id_thread",
              isResolved: input.resolved ?? false,
              isOutdated: input.outdated ?? false,
              path: "src/App.tsx",
              line: 42,
              startLine: null,
              comments: {
                nodes: [{
                  id: "PRRC_dom_id_comment",
                  body: input.body ?? "The DOM-ID lookup still misses the control.",
                  author: { login: "reviewer" },
                  createdAt: "2026-07-13T10:00:00.000Z",
                  lastEditedAt: null,
                }],
                pageInfo: { hasNextPage: false },
              },
            }],
            pageInfo: {
              hasNextPage: input.hasNextPage ?? false,
              endCursor: input.endCursor ?? null,
            },
          },
        },
      },
    },
  };
}

describe("exact GitHub review source", () => {
  it("treats unresolved current thread state as authority without interpreting #1925 prose", async () => {
    const sourceReads: Array<{ headSha: string; path: string }> = [];
    const source = createGithubReviewSource({
      fetchPage: async () => page({
        body: "Use getElementById here; the current code uses a selector and misses IDs with punctuation.",
      }),
      readSource: async (input) => {
        sourceReads.push({ headSha: input.headSha, path: input.path });
        return Buffer.from("export const current = document.querySelector(value);\n");
      },
    });
    const result = await source.read({
      prUrl: "https://github.com/setrox/generated/pull/1925",
      repositoryPath: "/repo",
    });
    assert.equal(result.actionableThreads.length, 1);
    const evidence = result.actionableThreads[0]!;
    assert.equal(GithubReviewThreadEvidenceV1Schema.safeParse(evidence).success, true);
    assert.equal(evidence.threadId, "PRRT_dom_id_thread");
    assert.equal(evidence.path, "src/App.tsx");
    assert.deepEqual(sourceReads, [{ headSha: HEAD, path: "src/App.tsx" }]);
  });

  it("uses only GitHub resolved/outdated flags to remove a thread from current work", async () => {
    for (const state of [{ resolved: true }, { outdated: true }]) {
      let sourceRead = false;
      const source = createGithubReviewSource({
        fetchPage: async () => page(state),
        readSource: async () => { sourceRead = true; return Buffer.from("unused"); },
      });
      const result = await source.read({
        prUrl: "https://github.com/setrox/generated/pull/1925",
        repositoryPath: "/repo",
      });
      assert.deepEqual(result.actionableThreads, []);
      assert.equal(sourceRead, false);
    }
  });

  it("changes exact evidence on body or head source delta without auto-resolving anything", async () => {
    let body = "first review revision";
    let bytes = Buffer.from("first source");
    const source = createGithubReviewSource({
      fetchPage: async () => page({ body }),
      readSource: async () => bytes,
    });
    const input = {
      prUrl: "https://github.com/setrox/generated/pull/1925",
      repositoryPath: "/repo",
    };
    const first = (await source.read(input)).actionableThreads[0]!;
    body = "edited review revision";
    const edited = (await source.read(input)).actionableThreads[0]!;
    bytes = Buffer.from("changed source");
    const changedSource = (await source.read(input)).actionableThreads[0]!;
    assert.notEqual(first.bodyRevisionHash, edited.bodyRevisionHash);
    assert.notEqual(first.evidenceHash, edited.evidenceHash);
    assert.equal(edited.bodyRevisionHash, changedSource.bodyRevisionHash);
    assert.notEqual(edited.currentSource.contentHash, changedSource.currentSource.contentHash);
    assert.notEqual(edited.evidenceHash, changedSource.evidenceHash);
  });

  it("fails closed if the PR head changes while paginating", async () => {
    let call = 0;
    const source = createGithubReviewSource({
      fetchPage: async () => ++call === 1
        ? page({ hasNextPage: true, endCursor: "cursor-1" })
        : page({ head: "b".repeat(40) }),
      readSource: async () => Buffer.from("source"),
    });
    await assert.rejects(
      source.read({
        prUrl: "https://github.com/setrox/generated/pull/1925",
        repositoryPath: "/repo",
      }),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "GITHUB_REVIEW_HEAD_CHANGED_DURING_FETCH",
    );
  });
});
