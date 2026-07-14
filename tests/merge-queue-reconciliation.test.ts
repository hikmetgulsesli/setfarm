import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  ensureFinalPullRequest,
  findFinalPullRequestByIdentity,
  mergeExactSourceIntoFeature,
  proveExactCommitAncestor,
  reconcileStoryMerge,
} from "../src/installer/merge-queue-ops.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function createDivergedRepository(): Readonly<{ root: string; repo: string; sourceSha: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-merge-reconcile-"));
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo);
  git(repo, ["init", "--initial-branch=main"]);
  git(repo, ["config", "user.email", "setfarm@example.invalid"]);
  git(repo, ["config", "user.name", "Setfarm Test"]);
  fs.writeFileSync(path.join(repo, "base.txt"), "base\n");
  git(repo, ["add", "base.txt"]);
  git(repo, ["commit", "-m", "base"]);
  git(repo, ["branch", "feature"]);
  git(repo, ["checkout", "-b", "story"]);
  fs.writeFileSync(path.join(repo, "story.txt"), "story\n");
  git(repo, ["add", "story.txt"]);
  git(repo, ["commit", "-m", "story"]);
  const sourceSha = git(repo, ["rev-parse", "HEAD"]);
  git(repo, ["checkout", "feature"]);
  fs.writeFileSync(path.join(repo, "feature.txt"), "feature\n");
  git(repo, ["add", "feature.txt"]);
  git(repo, ["commit", "-m", "feature"]);
  return { root, repo, sourceSha };
}

function createRemoteDivergedRepository(): Readonly<{
  root: string;
  repo: string;
  sourceSha: string;
}> {
  const fixture = createDivergedRepository();
  const remote = path.join(fixture.root, "origin.git");
  git(fixture.root, ["init", "--bare", "--initial-branch=main", remote]);
  git(fixture.repo, ["remote", "add", "origin", remote]);
  git(fixture.repo, ["push", "-u", "origin", "main", "feature", "story"]);
  return fixture;
}

function installFakeGh(root: string): Readonly<{
  binDir: string;
  statePath: string;
  logPath: string;
}> {
  const binDir = path.join(root, "bin");
  const statePath = path.join(root, "pull-requests.json");
  const logPath = path.join(root, "gh.log");
  fs.mkdirSync(binDir, { recursive: true });
  const script = path.join(binDir, "gh");
  fs.writeFileSync(script, `#!/bin/sh
set -eu
if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  printf '%s\\n' 'acme/widget'
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  if [ -f "$SETFARM_TEST_GH_STATE" ]; then
    /bin/cat "$SETFARM_TEST_GH_STATE"
  else
    printf '%s\\n' '[]'
  fi
  exit 0
fi
if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  printf '%s\\n' 'create' >> "$SETFARM_TEST_GH_LOG"
  printf '%s\\n' '[{"url":"https://github.com/acme/widget/pull/41","number":41,"state":"OPEN","headRefName":"feature/run-1","baseRefName":"main","isCrossRepository":false}]' > "$SETFARM_TEST_GH_STATE"
  if [ "\${SETFARM_TEST_GH_FAIL_AFTER_CREATE:-0}" = "1" ]; then
    printf '%s\\n' 'simulated transport failure after create' >&2
    exit 1
  fi
  printf '%s\\n' 'https://github.com/acme/widget/pull/41'
  exit 0
fi
printf '%s\\n' "unexpected fake gh command: $*" >&2
exit 2
`);
  fs.chmodSync(script, 0o755);
  return { binDir, statePath, logPath };
}

function withFakeGh<T>(root: string, operation: (fixture: ReturnType<typeof installFakeGh>) => T): T {
  const fixture = installFakeGh(root);
  const originalPath = process.env.PATH;
  const originalState = process.env.SETFARM_TEST_GH_STATE;
  const originalLog = process.env.SETFARM_TEST_GH_LOG;
  const originalFailure = process.env.SETFARM_TEST_GH_FAIL_AFTER_CREATE;
  process.env.PATH = `${fixture.binDir}:${originalPath ?? ""}`;
  process.env.SETFARM_TEST_GH_STATE = fixture.statePath;
  process.env.SETFARM_TEST_GH_LOG = fixture.logPath;
  delete process.env.SETFARM_TEST_GH_FAIL_AFTER_CREATE;
  try {
    return operation(fixture);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalState === undefined) delete process.env.SETFARM_TEST_GH_STATE;
    else process.env.SETFARM_TEST_GH_STATE = originalState;
    if (originalLog === undefined) delete process.env.SETFARM_TEST_GH_LOG;
    else process.env.SETFARM_TEST_GH_LOG = originalLog;
    if (originalFailure === undefined) delete process.env.SETFARM_TEST_GH_FAIL_AFTER_CREATE;
    else process.env.SETFARM_TEST_GH_FAIL_AFTER_CREATE = originalFailure;
  }
}

describe("direct-merge effect reconciliation", { concurrency: false }, () => {
  it("proves an exact source SHA only after the target contains it", () => {
    const fixture = createDivergedRepository();
    try {
      const before = proveExactCommitAncestor(fixture.repo, fixture.sourceSha, "feature");
      assert.equal(before.outcome, "not_ancestor");
      assert.equal(before.sourceCommitSha, fixture.sourceSha);
      assert.match(before.targetCommitSha ?? "", /^[a-f0-9]{40}$/);

      git(fixture.repo, ["merge", "--no-ff", "story", "-m", "merge story"]);
      const after = proveExactCommitAncestor(fixture.repo, fixture.sourceSha, "feature");
      assert.equal(after.outcome, "ancestor");
      assert.equal(after.reason, "exact-source-is-ancestor");
      assert.equal(after.targetCommitSha, git(fixture.repo, ["rev-parse", "feature"]));
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("reconciles a crash-replayed merge instead of classifying it as empty/no-op", () => {
    const fixture = createDivergedRepository();
    try {
      const pending = reconcileStoryMerge({
        repoPath: fixture.repo,
        sourceSha: fixture.sourceSha,
        targetRef: "feature",
      });
      assert.equal(pending.status, "not_applied");
      assert.equal(pending.success, false);

      git(fixture.repo, ["merge", "--no-ff", "story", "-m", "merge story"]);
      const firstReplay = reconcileStoryMerge({
        repoPath: fixture.repo,
        sourceSha: fixture.sourceSha,
        targetRef: "feature",
      });
      const secondReplay = reconcileStoryMerge({
        repoPath: fixture.repo,
        sourceSha: fixture.sourceSha,
        targetRef: "feature",
      });
      assert.equal(firstReplay.status, "reconciled");
      assert.equal(firstReplay.success, true);
      assert.deepEqual(secondReplay, firstReplay);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("merges the exact immutable source and reconciles every replay from remote publication", () => {
    const fixture = createRemoteDivergedRepository();
    try {
      const first = mergeExactSourceIntoFeature({
        repoPath: fixture.repo,
        sourceSha: fixture.sourceSha,
        featureBranch: "feature",
        commitMessage: "merge exact story source",
      });
      assert.equal(first.success, true);
      assert.equal(first.resolution, "applied");
      assert.equal(
        proveExactCommitAncestor(fixture.repo, fixture.sourceSha, "origin/feature").outcome,
        "ancestor",
      );

      const replay = mergeExactSourceIntoFeature({
        repoPath: fixture.repo,
        sourceSha: fixture.sourceSha,
        featureBranch: "feature",
        commitMessage: "merge exact story source",
      });
      assert.equal(replay.success, true);
      assert.equal(replay.resolution, "reconciled");
      assert.deepEqual(replay.conflicts, []);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when an exact source SHA cannot be resolved", () => {
    const fixture = createDivergedRepository();
    try {
      const malformed = proveExactCommitAncestor(fixture.repo, "abc123", "feature");
      assert.equal(malformed.outcome, "unresolvable");
      assert.equal(malformed.reason, "source-sha-invalid");

      const missing = reconcileStoryMerge({
        repoPath: fixture.repo,
        sourceSha: "f".repeat(40),
        targetRef: "feature",
      });
      assert.equal(missing.status, "indeterminate");
      assert.equal(missing.proof.reason, "source-commit-unresolvable");
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("finds only an exact repository/head/base final PR identity", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-final-pr-find-"));
    try {
      withFakeGh(root, ({ statePath }) => {
        fs.writeFileSync(statePath, JSON.stringify([
          { url: "https://github.com/acme/widget/pull/38", number: 38, state: "OPEN", headRefName: "other", baseRefName: "main", isCrossRepository: false },
          { url: "https://github.com/acme/widget/pull/39", number: 39, state: "OPEN", headRefName: "feature/run-1", baseRefName: "develop", isCrossRepository: false },
          { url: "https://github.com/acme/widget/pull/40", number: 40, state: "OPEN", headRefName: "feature/run-1", baseRefName: "main", isCrossRepository: true },
          { url: "https://github.com/acme/widget/pull/41", number: 41, state: "OPEN", headRefName: "feature/run-1", baseRefName: "main", isCrossRepository: false },
        ]));
        const found = findFinalPullRequestByIdentity({
          repoPath: root,
          headBranch: "feature/run-1",
          baseBranch: "main",
        });
        assert.equal(found.status, "found");
        assert.equal(found.identity.repository, "acme/widget");
        assert.equal(found.pullRequest?.url, "https://github.com/acme/widget/pull/41");
        assert.equal(found.candidates.length, 1);
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("ensures one final PR and reuses it on every replay", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-final-pr-ensure-"));
    try {
      withFakeGh(root, ({ logPath }) => {
        const input = {
          repoPath: root,
          headBranch: "feature/run-1",
          baseBranch: "main",
          title: "feat: test",
          body: "body",
        };
        const created = ensureFinalPullRequest(input);
        const replayed = ensureFinalPullRequest(input);
        assert.equal(created.success, true);
        assert.equal(created.action, "created");
        assert.equal(created.pullRequest?.url, "https://github.com/acme/widget/pull/41");
        assert.equal(replayed.success, true);
        assert.equal(replayed.action, "existing");
        assert.equal(replayed.pullRequest?.url, created.pullRequest?.url);
        assert.equal(fs.readFileSync(logPath, "utf8").trim().split("\n").length, 1);
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reconciles a PR created before the create command reports failure", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-final-pr-crash-"));
    try {
      withFakeGh(root, ({ logPath }) => {
        process.env.SETFARM_TEST_GH_FAIL_AFTER_CREATE = "1";
        const reconciled = ensureFinalPullRequest({
          repoPath: root,
          headBranch: "feature/run-1",
          baseBranch: "main",
          title: "feat: test",
          body: "body",
        });
        assert.equal(reconciled.success, true);
        assert.equal(reconciled.action, "reconciled_after_create_error");
        assert.equal(reconciled.pullRequest?.url, "https://github.com/acme/widget/pull/41");
        assert.equal(fs.readFileSync(logPath, "utf8").trim(), "create");
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
