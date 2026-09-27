import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { createPrivateDiagnosticPinnedWorktreeV1 } from
  "../../src/internal-production/baseline-positive-worktree-create-only-fixture-v1.js";

const REFUSED = /TASK6A_PRIVATE_CREATE_ONLY_WORKTREE_REFUSED/;
const git = (cwd: string, ...args: string[]): string => execFileSync("git", args,
  { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 }).trim();

function fixture(t: TestContext) {
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "setfarm-task6a-create-only."));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const repo = path.join(tmp, "repo");
  fs.mkdirSync(repo);
  git(repo, "init", "-q");
  git(repo, "config", "user.name", "Task6A Fixture");
  git(repo, "config", "user.email", "task6a-fixture@example.invalid");
  fs.writeFileSync(path.join(repo, "tracked.txt"), "pinned source\n");
  git(repo, "add", "tracked.txt");
  git(repo, "commit", "-qm", "fixture source");
  const sourceSha = git(repo, "rev-parse", "HEAD");
  const sourceTreeHash = git(repo, "rev-parse", "HEAD^{tree}");
  const parent = path.join(tmp, "reserved-worktrees");
  fs.mkdirSync(parent);
  const root = path.join(parent, "reserved-story");
  const input = { reservationHash: "a".repeat(64), repo, root, sourceSha, sourceTreeHash };
  return { tmp, repo, parent, root, input };
}

test("private create-only fixture pins detached source and leaves a dirty primary checkout untouched", (t) => {
  const { repo, root, input } = fixture(t);
  fs.writeFileSync(path.join(repo, "untracked-preserved.txt"), "do not stash\n");
  const before = git(repo, "status", "--porcelain");
  const result = createPrivateDiagnosticPinnedWorktreeV1(input);
  const stat = fs.lstatSync(root, { bigint: true });
  assert.deepEqual(result, { schema: "setfarm.internal-production-positive-worktree-private-create-only.v1",
    authority: "diagnostic-only", reservationHash: input.reservationHash,
    root, sourceSha: input.sourceSha, sourceTreeHash: input.sourceTreeHash,
    physical: { root, dev: String(stat.dev), ino: String(stat.ino),
      birthtimeNs: String(stat.birthtimeNs), gitPrimaryRoot: repo } });
  assert.equal(git(root, "rev-parse", "HEAD"), input.sourceSha);
  assert.equal(git(root, "rev-parse", "HEAD^{tree}"), input.sourceTreeHash);
  assert.equal(git(root, "branch", "--show-current"), "");
  assert.equal(git(repo, "status", "--porcelain"), before);
  assert.equal(fs.readFileSync(path.join(repo, "untracked-preserved.txt"), "utf8"), "do not stash\n");
});

test("private create-only fixture refuses occupied directory, file and dangling symlink without replacement", (t) => {
  const { root, input } = fixture(t);
  for (const kind of ["directory", "file", "symlink"] as const) {
    if (kind === "directory") fs.mkdirSync(root);
    if (kind === "file") fs.writeFileSync(root, "preserve file\n");
    if (kind === "symlink") fs.symlinkSync(path.join(path.dirname(root), "absent"), root);
    const before = fs.lstatSync(root);
    assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(input), REFUSED);
    assert.equal(fs.lstatSync(root).ino, before.ino);
    if (kind === "file") assert.equal(fs.readFileSync(root, "utf8"), "preserve file\n");
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("private create-only fixture refuses source and tree drift before Git worktree mutation", (t) => {
  const { repo, root, input } = fixture(t);
  for (const changed of [
    { sourceSha: "b".repeat(40) },
    { sourceTreeHash: "c".repeat(40) },
    { sourceSha: input.sourceSha.slice(0, 39) },
    { reservationHash: "not-a-hash" },
  ]) {
    assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1({ ...input, ...changed }), REFUSED);
    assert.equal(fs.existsSync(root), false);
  }
  assert.equal(git(repo, "worktree", "list", "--porcelain").includes(root), false);
});

test("private create-only fixture refuses a replacement ref for the pinned commit", (t) => {
  const { repo, root, input } = fixture(t);
  fs.writeFileSync(path.join(repo, "tracked.txt"), "different source\n");
  git(repo, "add", "tracked.txt");
  git(repo, "commit", "-qm", "different source");
  const replacedSha = git(repo, "rev-parse", "HEAD");
  git(repo, "replace", replacedSha, input.sourceSha);
  assert.equal(git(repo, "rev-parse", `${replacedSha}^{tree}`), input.sourceTreeHash);
  assert.notEqual(execFileSync("git", ["rev-parse", `${replacedSha}^{tree}`], {
    cwd: repo, encoding: "utf8", env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
  }).trim(), input.sourceTreeHash);
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(
    { ...input, sourceSha: replacedSha }), REFUSED);
  assert.equal(fs.existsSync(root), false);
});

test("private create-only fixture does not lazy-fetch a missing promisor commit", (t) => {
  const { tmp, repo, root, input } = fixture(t);
  const donor = path.join(tmp, "donor");
  git(tmp, "clone", "-q", repo, donor);
  git(donor, "config", "user.name", "Task6A Fixture");
  git(donor, "config", "user.email", "task6a-fixture@example.invalid");
  git(donor, "commit", "--allow-empty", "-qm", "remote-only source");
  const remoteSha = git(donor, "rev-parse", "HEAD");
  const marker = path.join(tmp, "unexpected-fetch");
  const uploadPack = path.join(tmp, "upload-pack");
  fs.writeFileSync(uploadPack, `#!/bin/sh\nprintf 'unexpected fetch\\n' > '${marker}'\nexec git-upload-pack "$@"\n`);
  fs.chmodSync(uploadPack, 0o700);
  git(repo, "config", "core.repositoryformatversion", "1");
  git(repo, "config", "extensions.partialClone", "origin");
  git(repo, "config", "remote.origin.promisor", "true");
  git(repo, "config", "remote.origin.url", donor);
  git(repo, "config", "remote.origin.uploadpack", uploadPack);
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(
    { ...input, sourceSha: remoteSha }), REFUSED);
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.existsSync(root), false);
  assert.equal(execFileSync("git", ["rev-parse", "--verify", `${remoteSha}^{commit}`], {
    cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "0" },
  }).trim(), remoteSha);
  assert.equal(fs.readFileSync(marker, "utf8"), "unexpected fetch\n");
});

test("private create-only fixture refuses a symlinked target parent", (t) => {
  const { repo, parent, root, input } = fixture(t);
  fs.renameSync(parent, path.join(path.dirname(parent), "real-worktrees"));
  fs.symlinkSync(path.join(path.dirname(parent), "real-worktrees"), parent);
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(input), REFUSED);
  assert.equal(fs.existsSync(root), false);
  assert.equal(fs.lstatSync(parent).isSymbolicLink(), true);
});

test("private create-only fixture refuses stale registration without pruning metadata", (t) => {
  const { repo, root, input } = fixture(t);
  git(repo, "worktree", "add", "--detach", root, input.sourceSha);
  fs.rmSync(root, { recursive: true, force: true });
  assert.ok(git(repo, "worktree", "list", "--porcelain").includes(root));
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(input), REFUSED);
  assert.ok(git(repo, "worktree", "list", "--porcelain").includes(root));
});

test("private create-only fixture disables a repository post-checkout hook", (t) => {
  const { repo, root, input } = fixture(t);
  const hook = path.join(repo, ".git", "hooks", "post-checkout");
  fs.writeFileSync(hook, "#!/bin/sh\nprintf 'hook output\\n' > dirty-hook-file\n");
  fs.chmodSync(hook, 0o700);
  assert.equal(createPrivateDiagnosticPinnedWorktreeV1(input).authority, "diagnostic-only");
  assert.equal(fs.existsSync(root), true);
  assert.equal(fs.existsSync(path.join(root, "dirty-hook-file")), false);
  assert.ok(git(repo, "worktree", "list", "--porcelain").includes(root));
});

test("private create-only fixture preserves a post-add fault for census instead of cleaning it", (t) => {
  const { repo, root, input } = fixture(t);
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(input, "after-add"), REFUSED);
  assert.equal(fs.existsSync(root), true);
  assert.ok(git(repo, "worktree", "list", "--porcelain").includes(root));
});

test("private create-only fixture refuses Git attributes that could activate checkout filters", (t) => {
  const { repo, root, input } = fixture(t);
  const privateAttributes = path.join(repo, ".git", "info", "attributes");
  fs.writeFileSync(privateAttributes, "tracked.txt filter=external\n");
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(input), REFUSED);
  assert.equal(fs.existsSync(root), false);
  fs.rmSync(privateAttributes);
  fs.writeFileSync(path.join(repo, ".gitattributes"), "tracked.txt filter=external\n");
  git(repo, "add", ".gitattributes");
  git(repo, "commit", "-qm", "add unsafe attributes");
  const sourceSha = git(repo, "rev-parse", "HEAD");
  const sourceTreeHash = git(repo, "rev-parse", "HEAD^{tree}");
  assert.throws(() => createPrivateDiagnosticPinnedWorktreeV1(
    { ...input, sourceSha, sourceTreeHash }), REFUSED);
  assert.equal(fs.existsSync(root), false);
});
