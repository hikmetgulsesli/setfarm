import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import ts from "typescript";

// Extract just the production declaration as finite source DATA. Never import
// pr-state, step-ops, DB, selected installation, GitHub or provider runtime.
function productionMerge(ports: Record<string, unknown>): (...args: unknown[]) => boolean {
  const file = new URL("../../src/installer/pr-state.ts", import.meta.url);
  const text = readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file.pathname, text, ts.ScriptTarget.Latest, true);
  const declarations = tree.statements.filter((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "tryAutoMergePR");
  assert.equal(declarations.length, 1, "actual production merge function must be unique");
  const body = declarations[0]!.getText(tree).replace(/^export\s+/, "");
  const js = ts.transpileModule(body, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
  } }).outputText;
  return new Function(...Object.keys(ports), js + "; return tryAutoMergePR;")(...Object.values(ports));
}

function withOwnedGitFixture(action: (fixture: {
  repo: string; candidate: string; url: string;
  merge: (...args: unknown[]) => boolean;
  git: (args: string[]) => string;
  ancestry: () => number | null;
  commands: string[][];
}) => void): void {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "setfarm-native-pr-ancestry-")));
  const repo = root;
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0", GIT_NO_REPLACE_OBJECTS: "1", GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "Owned Native Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Owned Native Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  };
  const git = (args: string[]): string => {
    const result = spawnSync("git", ["--no-replace-objects", "--literal-pathspecs", ...args], {
      cwd: repo, env, encoding: "utf8", timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `owned Git ${args[0]} failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  try {
    git(["init", "--initial-branch=main"]);
    writeFileSync(path.join(repo, "candidate.txt"), "base\n", { flag: "wx" });
    git(["add", "--", "candidate.txt"]);
    git(["commit", "-m", "base"]);
    git(["switch", "-c", "accepted-candidate"]);
    writeFileSync(path.join(repo, "candidate.txt"), "verified candidate\n");
    git(["add", "--", "candidate.txt"]);
    git(["commit", "-m", "accepted candidate"]);
    const candidate = git(["rev-parse", "HEAD"]);
    git(["switch", "main"]);
    const url = "https://example.invalid/owned-native/pr/1";
    const commands: string[][] = [];
    const merge = productionMerge({
      GH_CLI_TIMEOUT: 5000, GH_MERGE_TIMEOUT: 5000,
      logger: { info() {}, warn() {} },
      invalidatePRStateCache: (actual: string) => assert.equal(actual, url),
      execFileSync: (command: string, args: string[]) => {
        // This is a local command port, never an invocation of real gh.
        assert.equal(command, "gh");
        commands.push([...args]);
        assert.deepEqual(args.slice(0, 3), ["pr", "merge", url]);
        assert.equal(args.length, 7);
        assert.equal(args[4], "--delete-branch");
        assert.equal(args[5], "--match-head-commit");
        assert.equal(args[6], candidate, "merge may only use the authenticated tested head");
        assert.equal(git(["rev-parse", "accepted-candidate"]), candidate);
        assert.equal(args.includes("--admin"), false);
        if (args[3] === "--squash") {
          git(["merge", "--squash", candidate]);
          git(["commit", "-m", "squashed integration"]);
        } else {
          assert.equal(args[3], "--merge");
          git(["merge", "--no-ff", "-m", "ancestry-preserving integration", candidate]);
        }
        return "";
      },
    });
    const ancestry = () => {
      const result = spawnSync("git", ["--no-replace-objects", "merge-base", "--is-ancestor", candidate, "HEAD"], {
        cwd: repo, env, encoding: "utf8", timeout: 5000,
      });
      assert.ifError(result.error);
      assert.equal(result.stderr, "");
      return result.status;
    };
    action({ repo, candidate, url, merge, git, ancestry, commands });
  } finally {
    assert.equal(path.dirname(root), realpathSync(tmpdir()));
    assert.ok(path.basename(root).startsWith("setfarm-native-pr-ancestry-"));
    rmSync(root, { recursive: true, force: true });
  }
}

it("native actual merge helper preserves accepted candidate ancestry through real local Git integration", () => {
  withOwnedGitFixture(({ candidate, url, merge, git, ancestry, commands }) => {
    assert.equal(merge(url, "US-001", "run-git", candidate, "preserve-ancestry"), true);
    assert.equal(git(["rev-parse", "HEAD^{tree}"]), git(["rev-parse", `${candidate}^{tree}`]));
    // The old helper returns true with identical content but a sibling squash
    // commit. Only this real ancestry check exposes the provenance regression.
    assert.equal(ancestry(), 0, "accepted candidate must remain an ancestor of integrated target");
    assert.deepEqual(commands, [["pr", "merge", url, "--merge", "--delete-branch", "--match-head-commit", candidate]]);
  });
});

it("legacy actual merge helper keeps real local squash integration behavior", () => {
  withOwnedGitFixture(({ candidate, url, merge, git, ancestry, commands }) => {
    assert.equal(merge(url, "US-001", "run-legacy", candidate), true);
    assert.equal(git(["rev-parse", "HEAD^{tree}"]), git(["rev-parse", `${candidate}^{tree}`]));
    assert.equal(ancestry(), 1, "legacy squash control must remain a same-content nonancestor");
    assert.deepEqual(commands, [["pr", "merge", url, "--squash", "--delete-branch", "--match-head-commit", candidate]]);
  });
});
