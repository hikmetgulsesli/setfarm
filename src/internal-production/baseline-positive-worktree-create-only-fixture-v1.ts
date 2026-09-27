import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Disposable Git fixture only. This module is import-inert and has no live
// spawner, database, producer, owner or admission integration. A correlation
// hash is not a verified reservation capability; all physical checks here are
// samples, not continuous DB/OS writer exclusion.
const SCHEMA = "setfarm.internal-production-positive-worktree-private-create-only.v1";
const REFUSED = "TASK6A_PRIVATE_CREATE_ONLY_WORKTREE_REFUSED";
const fail = (): never => { throw new Error(REFUSED); };

type Input = Readonly<{
  reservationHash: string;
  repo: string;
  root: string;
  sourceSha: string;
  sourceTreeHash: string;
}>;

function project(input: unknown): Input {
  if (input === null || typeof input !== "object"
    || Object.getPrototypeOf(input) !== Object.prototype) return fail();
  const keys = ["reservationHash", "repo", "root", "sourceSha", "sourceTreeHash"];
  const own = Reflect.ownKeys(input);
  if (own.length !== keys.length
    || own.some((key) => typeof key !== "string" || !keys.includes(key))) fail();
  const field = (key: string): string => {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable
      || typeof descriptor.value !== "string") return fail();
    return descriptor.value;
  };
  const reservationHash = field("reservationHash");
  const repo = field("repo"), root = field("root");
  const sourceSha = field("sourceSha"), sourceTreeHash = field("sourceTreeHash");
  if (!/^[a-f0-9]{64}$/.test(reservationHash)
    || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceSha)
    || !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceTreeHash)
    || sourceSha.length !== sourceTreeHash.length) fail();
  for (const value of [repo, root]) {
    if (!path.isAbsolute(value) || path.normalize(value) !== value
      || value.endsWith(path.sep) || value.includes("\0")) fail();
  }
  const tempRoot = fs.realpathSync(os.tmpdir());
  const fixtureHome = path.dirname(repo);
  if (path.basename(repo) !== "repo"
    || path.dirname(fixtureHome) !== tempRoot
    || !/^setfarm-task6a-create-only\.[A-Za-z0-9]+$/.test(path.basename(fixtureHome))
    || path.dirname(root) !== path.join(fixtureHome, "reserved-worktrees")
    || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(path.basename(root))) fail();
  return Object.freeze({ reservationHash, repo, root, sourceSha, sourceTreeHash });
}

function realDirectory(target: string): fs.BigIntStats {
  const stat = fs.lstatSync(target, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || fs.realpathSync(target) !== target) fail();
  return stat;
}

function absent(target: string): boolean {
  try { fs.lstatSync(target); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
}

function gitRaw(cwd: string, ...args: string[]): string {
  return execFileSync("git", [
    "-c", "core.hooksPath=/dev/null",
    "-c", "core.fsmonitor=false",
    "-c", "core.attributesFile=/dev/null",
    ...args,
  ], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15_000,
    env: {
      PATH: process.env.PATH || "/usr/bin:/bin",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_ATTR_NOSYSTEM: "1",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_NO_LAZY_FETCH: "1",
    },
  });
}

function git(cwd: string, ...args: string[]): string {
  return gitRaw(cwd, ...args).trim();
}

function commonGitDir(cwd: string): string {
  return fs.realpathSync(path.resolve(cwd, git(cwd, "rev-parse", "--git-common-dir")));
}

function registeredRoots(repo: string): string[] {
  return git(repo, "worktree", "list", "--porcelain")
    .split("\n").filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}

export function createPrivateDiagnosticPinnedWorktreeV1(
  input: unknown, fixtureFault?: "after-add",
): Readonly<{
  schema: typeof SCHEMA;
  authority: "diagnostic-only";
  reservationHash: string;
  root: string;
  sourceSha: string;
  sourceTreeHash: string;
  physical: Readonly<{ root: string; dev: string; ino: string;
    birthtimeNs: string; gitPrimaryRoot: string }>;
}> {
  try {
    if (fixtureFault !== undefined && fixtureFault !== "after-add") fail();
    const fixed = project(input);
    const repoStat = realDirectory(fixed.repo);
    const parent = path.dirname(fixed.root);
    const parentStat = realDirectory(parent);
    const gitDir = path.join(fixed.repo, ".git");
    realDirectory(gitDir);
    const privateAttributes = path.join(gitDir, "info", "attributes");
    if (!absent(privateAttributes)) fail();
    if (git(fixed.repo, "rev-parse", "--show-toplevel") !== fixed.repo
      || commonGitDir(fixed.repo) !== gitDir
      || git(fixed.repo, "rev-parse", "HEAD").length !== fixed.sourceSha.length
      || git(fixed.repo, "rev-parse", "--verify", `${fixed.sourceSha}^{commit}`) !== fixed.sourceSha
      || git(fixed.repo, "rev-parse", "--verify", `${fixed.sourceSha}^{tree}`) !== fixed.sourceTreeHash
      || !new RegExp(`^100644 blob [a-f0-9]{${fixed.sourceSha.length}}\\ttracked\\.txt$`)
        .test(git(fixed.repo, "ls-tree", fixed.sourceSha))
      || gitRaw(fixed.repo, "show", `${fixed.sourceSha}:tracked.txt`) !== "pinned source\n"
      || !absent(fixed.root)
      || registeredRoots(fixed.repo).includes(fixed.root)) fail();

    // No pre-add mkdir, cleanup, branch change, fallback or reuse. A failed
    // add or post-add check intentionally leaves any partial state visible.
    git(fixed.repo, "worktree", "add", "--detach", fixed.root, fixed.sourceSha);
    if (fixtureFault === "after-add") fail();

    const rootStat = realDirectory(fixed.root);
    const parentAfter = realDirectory(parent);
    const repoAfter = realDirectory(fixed.repo);
    if (repoAfter.dev !== repoStat.dev || repoAfter.ino !== repoStat.ino
      || parentAfter.dev !== parentStat.dev || parentAfter.ino !== parentStat.ino
      || rootStat.dev !== parentStat.dev
      || git(fixed.root, "rev-parse", "--show-toplevel") !== fixed.root
      || commonGitDir(fixed.root) !== gitDir
      || git(fixed.root, "rev-parse", "HEAD") !== fixed.sourceSha
      || git(fixed.root, "rev-parse", "HEAD^{tree}") !== fixed.sourceTreeHash
      || git(fixed.root, "branch", "--show-current") !== ""
      || git(fixed.root, "status", "--porcelain", "--untracked-files=all", "--ignored=matching") !== ""
      || fs.readdirSync(fixed.root).sort().join("\0") !== [".git", "tracked.txt"].join("\0")
      || !fs.lstatSync(path.join(fixed.root, ".git")).isFile()
      || !fs.lstatSync(path.join(fixed.root, "tracked.txt")).isFile()
      || fs.readFileSync(path.join(fixed.root, "tracked.txt"), "utf8") !== "pinned source\n"
      || registeredRoots(fixed.repo).filter((root) => root === fixed.root).length !== 1) fail();
    const finalRootStat = realDirectory(fixed.root);
    if (rootStat.dev <= 0n || rootStat.ino <= 0n || rootStat.birthtimeNs <= 0n
      || finalRootStat.dev !== rootStat.dev || finalRootStat.ino !== rootStat.ino
      || finalRootStat.birthtimeNs !== rootStat.birthtimeNs) fail();
    const physical = Object.freeze({ root: fixed.root, dev: String(rootStat.dev),
      ino: String(rootStat.ino), birthtimeNs: String(rootStat.birthtimeNs),
      gitPrimaryRoot: fixed.repo });
    if ([physical.dev, physical.ino, physical.birthtimeNs].some((value) =>
      !/^[1-9][0-9]{0,19}$/.test(value))) fail();
    return Object.freeze({ schema: SCHEMA, authority: "diagnostic-only",
      reservationHash: fixed.reservationHash, root: fixed.root,
      sourceSha: fixed.sourceSha, sourceTreeHash: fixed.sourceTreeHash,
      physical });
  } catch { return fail(); }
}
