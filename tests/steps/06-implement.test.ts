import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { implementModule } from "../../dist/installer/steps/06-implement/module.js";
import { checkBuildGate, checkTestGate, computeScopeFileLimits, detectPackageBuildCommand, findDesignDomImplementationFindings, findDesignDomImplementationIssues, getOutOfScopeStoryFiles, normalize, parseGitStatusPorcelainPath, sourceExposesWindowApp, validateOutput } from "../../dist/installer/steps/06-implement/guards.js";
import { cleanupOutOfScopeWorktreeFiles } from "../../dist/installer/steps/06-implement/context.js";
import { commitStoryWorktreeScopeIfNeeded, decideStorySystemSmokeGate } from "../../dist/installer/step-ops.js";
import { createStoryWorktree, ensureStoryBranchWorktree } from "../../dist/installer/worktree-ops.js";
import { IMPLICIT_STORY_SCOPE_FILES, isImplicitStoryScopeFile } from "../../dist/installer/story-scope.js";
import { checkStoryDesignCompliance } from "../../dist/installer/step-guardrails.js";
import { STACK_RULES } from "../../dist/installer/steps/06-implement/stack-rules.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 10000,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Setfarm Test",
      GIT_AUTHOR_EMAIL: "setfarm-test@example.test",
      GIT_COMMITTER_NAME: "Setfarm Test",
      GIT_COMMITTER_EMAIL: "setfarm-test@example.test",
    },
  }).trim();
}

describe("06-implement step module", () => {
  it("module metadata is correct", () => {
    assert.equal(implementModule.id, "implement");
    assert.equal(implementModule.type, "loop");
    assert.equal(implementModule.agentRole, "developer");
    assert.equal(implementModule.maxPromptSize, 32768);
    assert.deepEqual(implementModule.requiredOutputFields, ["STATUS"]);
  });

  it("rules treat shared files as read-only context", () => {
    const rules = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/rules.md"), "utf-8");
    assert.ok(rules.includes("SHARED_FILES are read/import context only"));
    assert.ok(rules.includes("Do NOT invent props for components imported from SHARED_FILES"));
    assert.ok(rules.includes("typed `actions` prop"));
    assert.ok(rules.includes("textContent"));
    assert.ok(rules.includes("Keep reducers/state transition functions pure"));
    assert.ok(rules.includes("vite.config.*"));
    assert.ok(rules.includes("Do NOT edit `index.html`"));
    assert.equal(rules.includes("small edits OK"), false);
  });

  it("keeps git ownership in the platform instead of the implement agent", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/prompt.md"), "utf-8");
    const rules = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/rules.md"), "utf-8");
    const workflow = fs.readFileSync(path.join(process.cwd(), "workflows/feature-dev/workflow.yml"), "utf-8");
    const implementInput = workflow.split("\n  - id: implement\n")[1]?.split("\n  - id: verify\n")[0] || "";
    assert.match(prompt, /Do NOT run `git add`, `git commit`, `git push`, `gh pr create`, or any branch command/);
    assert.match(prompt, /Setfarm performs the final scoped story commit after build\/scope\/supervisor gates pass/);
    assert.match(rules, /Do NOT run `git add`, `git commit`, `git push`/);
    assert.match(implementInput, /Setfarm performs the final\s+scoped story commit/);
    assert.doesNotMatch(prompt, /xargs -a \.story-scope-files git add --/);
    assert.doesNotMatch(prompt, /git commit -m "feat: <story-id> - <description>"/);
    assert.doesNotMatch(rules, /Commit once at the end/);
    assert.doesNotMatch(implementInput, /git commit -m "feat:/);
    assert.doesNotMatch(implementInput, /git push -u origin/);
  });

  it("platform story commit stages only declared scope and implicit test files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/Other.tsx"), "export const other = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "src/Other.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'changed';\n");
      fs.writeFileSync(path.join(tmp, "src/App.test.tsx"), "it('works', () => {});\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "state shell");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles.sort(), ["src/App.test.tsx", "src/App.tsx"].sort());
      assert.match(git(tmp, ["log", "-1", "--format=%s"]), /feat: US-001 - state shell/);
      const status = git(tmp, ["status", "--porcelain"]);
      assert.doesNotMatch(status, /src\/App/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit can use declared DB scope and ignores pre-staged internal files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-db-scope-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "SUPERVISOR_MEMORY.md"), "base memory\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "SUPERVISOR_MEMORY.md"]);
      git(tmp, ["commit", "-m", "base"]);

      fs.writeFileSync(path.join(tmp, "SUPERVISOR_MEMORY.md"), "dirty internal memory\n");
      git(tmp, ["add", "SUPERVISOR_MEMORY.md"]);
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'supervisor fix';\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "supervisor fix", ["src/App.tsx"], "fix");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles, ["src/App.tsx"]);
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "fix: US-001 - supervisor fix");
      const committedFiles = git(tmp, ["show", "--name-only", "--format=", "HEAD"]).trim().split(/\r?\n/).filter(Boolean);
      assert.deepEqual(committedFiles, ["src/App.tsx"]);
      const status = git(tmp, ["status", "--porcelain"]);
      assert.match(status, /^M SUPERVISOR_MEMORY\.md$/m);
      assert.doesNotMatch(status, /^M  SUPERVISOR_MEMORY\.md$/m);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rehydrates a deleted story branch worktree for supervisor and reviewer audits", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-review-worktree-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'main';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      git(tmp, ["checkout", "-b", "33d23f10-us-001"]);
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'story';\n");
      git(tmp, ["add", "src/App.tsx"]);
      git(tmp, ["commit", "-m", "feat: US-001 story"]);
      git(tmp, ["checkout", "main"]);

      const reviewWorkdir = ensureStoryBranchWorktree(tmp, "33d23f10-us-001");

      assert.ok(reviewWorkdir.endsWith(path.join(".worktrees", "33d23f10-us-001")));
      assert.equal(git(reviewWorkdir, ["branch", "--show-current"]), "33d23f10-us-001");
      assert.equal(fs.readFileSync(path.join(reviewWorkdir, "src/App.tsx"), "utf-8"), "export const app = 'story';\n");
      assert.equal(git(tmp, ["branch", "--show-current"]), "main");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("uses one implicit story scope rule for runtime guard and platform commit", () => {
    assert.equal(isImplicitStoryScopeFile("src/test/utils.tsx"), true);
    assert.equal(isImplicitStoryScopeFile("./src/test/setup.mts"), true);
    assert.equal(isImplicitStoryScopeFile("src/types/domain.test.ts"), true);
    assert.equal(isImplicitStoryScopeFile("src/types/domain.ts"), false);
    assert.ok(IMPLICIT_STORY_SCOPE_FILES.includes("src/test/utils.tsx"));

    const guards = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    const context = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/context.js"), "utf-8");
    assert.match(guards, /isImplicitStoryScopeFile/);
    assert.match(stepOps, /isImplicitStoryScopeFile/);
    assert.match(stepOps, /IMPLICIT_STORY_SCOPE_FILES/);
    assert.match(context, /IMPLICIT_STORY_SCOPE_FILES/);
    assert.doesNotMatch(stepOps, /PLATFORM_STORY_COMMIT_ALLOWED_PATTERNS/);
  });

  it("platform story commit refuses out-of-scope files", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-block-"));
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/Other.tsx"), "export const other = 'base';\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "src/App.tsx", "src/Other.tsx"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), "src/App.tsx\n");
      fs.writeFileSync(path.join(tmp, "src/Other.tsx"), "export const other = 'blocked';\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-002", "blocked scope");

      assert.equal(result.committed, false);
      assert.match(result.error, /PLATFORM_STORY_COMMIT_SCOPE_BLOCKED/);
      assert.match(result.error, /src\/Other\.tsx/);
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "base");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("platform story commit expands untracked scoped directories before checking scope", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-platform-commit-uall-"));
    try {
      fs.writeFileSync(path.join(tmp, "README.md"), "base\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "README.md"]);
      git(tmp, ["commit", "-m", "base"]);
      fs.writeFileSync(path.join(tmp, ".story-scope-files"), [
        "src/contexts/AppContext.tsx",
        "src/hooks/useAppState.ts",
        "src/types/domain.ts",
        "src/utils/storage.ts",
      ].join("\n") + "\n");
      fs.mkdirSync(path.join(tmp, "src/contexts"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/hooks"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/types"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/utils"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/contexts/AppContext.tsx"), "export const AppContext = {};\n");
      fs.writeFileSync(path.join(tmp, "src/hooks/useAppState.ts"), "export const useAppState = () => null;\n");
      fs.writeFileSync(path.join(tmp, "src/types/domain.ts"), "export type GameState = {};\n");
      fs.writeFileSync(path.join(tmp, "src/utils/storage.ts"), "export const storage = {};\n");
      fs.writeFileSync(path.join(tmp, "src/utils/storage.test.ts"), "import './storage';\n");

      const result = commitStoryWorktreeScopeIfNeeded(tmp, "US-001", "scoped directories");

      assert.equal(result.error, "");
      assert.equal(result.committed, true);
      assert.deepEqual(result.stagedFiles.sort(), [
        "src/contexts/AppContext.tsx",
        "src/hooks/useAppState.ts",
        "src/types/domain.ts",
        "src/utils/storage.test.ts",
        "src/utils/storage.ts",
      ].sort());
      assert.equal(git(tmp, ["log", "-1", "--format=%s"]), "feat: US-001 - scoped directories");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not tell implement agents to read raw Stitch design corpus", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/prompt.md"), "utf-8");
    const contextSource = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/context.js"), "utf-8");

    assert.match(prompt, /Do not read raw `stitch\/\*\.html`/);
    assert.match(contextSource, /use UI_CONTRACT, SCREEN_INDEX, and story-owned generated screens instead of reading raw stitch HTML/);
    assert.doesNotMatch(contextSource, /read stitch files for full design/);
    assert.doesNotMatch(contextSource, /read stitch\/DESIGN_DOM\.json for full DOM/);
    assert.doesNotMatch(contextSource, /read stitch\/DESIGN_DOM\.json for the full behavior contract/);

    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.doesNotMatch(stepOps, /read stitch\/DESIGN_DOM\.json for full DOM/);
    assert.match(stepOps, /use injected UI behavior contract instead of reading full DESIGN_DOM\.json/);
  });

  it("scope gate treats shared_files as read-only context, not completion-allowed files", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    assert.match(source, /SELECT scope_files, shared_files FROM stories WHERE id/);
    assert.match(source, /const declaredSharedFiles = parseScopeFiles\(scopeRow\?\.shared_files\)/);
    assert.doesNotMatch(source, /declaredSharedFiles\.forEach\(f => allowed\.add\(f\)\)/);
    assert.match(source, /void declaredSharedFiles/);

    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /cleanupOutOfScopeWorktreeFiles/);
    assert.match(stepOps, /vite\.config\.\*, tailwind\.config\.\*, tsconfig\.\*, index\.html/);
    assert.doesNotMatch(stepOps, /src\/types\/\* shared API files are also allowed/);

    const guards = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    assert.doesNotMatch(guards, /src\\\/types\\\/\.\*/);

    const worktreeOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/worktree-ops.js"), "utf-8");
    assert.doesNotMatch(worktreeOps, /src\/types\/\*/);
  });

  it("treats shared type/domain files as out of scope unless explicitly owned", () => {
    const changed = [
      "src/screens/GameBoard.tsx",
      "src/types/domain.ts",
      "src/screens/GameBoard.test.tsx",
      "vitest.config.ts",
    ];

    assert.deepEqual(getOutOfScopeStoryFiles(changed, ["src/screens/GameBoard.tsx"]), [
      "src/types/domain.ts",
    ]);
    assert.deepEqual(getOutOfScopeStoryFiles(changed, ["src/screens/GameBoard.tsx", "src/types/domain.ts"]), []);
  });

  it("allows shared test helpers through the scope gate", () => {
    const changed = [
      "src/App.tsx",
      "src/test/utils.tsx",
      "src/test/setup.mts",
      "src/types/domain.test.ts",
    ];

    assert.deepEqual(getOutOfScopeStoryFiles(changed, ["src/App.tsx"]), []);
  });


  it("parses git porcelain dirty paths without trimming away the status columns", () => {
    assert.equal(parseGitStatusPorcelainPath(" M src/App.tsx"), "src/App.tsx");
    assert.equal(parseGitStatusPorcelainPath("M  src/hooks/useAppState.ts"), "src/hooks/useAppState.ts");
    assert.equal(parseGitStatusPorcelainPath("?? src/types/domain.test.ts"), "src/types/domain.test.ts");
    assert.equal(parseGitStatusPorcelainPath("R  src/Old.tsx -> src/New.tsx"), "src/New.tsx");
  });

  it("blocks SCOPE_BLEED completion instead of silently accepting it", () => {
    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /scope-bleed-cleanup/);
    assert.match(stepOps, /failing story for retry/);
    assert.match(stepOps, /await failStep\(stepId, scopeResult\.reason\)/);
    assert.doesNotMatch(stepOps, /scope-bleed-silent/);
    assert.doesNotMatch(stepOps, /story kept DONE/);
    assert.doesNotMatch(stepOps, /kept DONE despite scope bleed/);
  });

  it("cleans dirty out-of-scope files before reusing a story worktree", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-scope-clean-"));
    try {
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/utils"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'base';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "export const board = 'base';\n");
      fs.writeFileSync(path.join(tmp, "tsconfig.json"), "{}\n");
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "baseline"]);

      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export const app = 'allowed';\n");
      fs.writeFileSync(path.join(tmp, "src/utils/storage.ts"), "export const storage = true;\n");
      fs.writeFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "export const board = 'dirty';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/Extra.tsx"), "export const extra = true;\n");
      fs.writeFileSync(path.join(tmp, "tsconfig.json"), "{\"dirty\":true}\n");

      const cleaned = cleanupOutOfScopeWorktreeFiles(tmp, ["src/App.tsx", "src/utils/storage.ts"], "US-001", "run-test");

      assert.ok(cleaned.includes("src/screens/GameBoard.tsx"));
      assert.ok(cleaned.includes("src/screens/Extra.tsx"));
      assert.ok(cleaned.includes("tsconfig.json"));
      assert.equal(fs.readFileSync(path.join(tmp, "src/App.tsx"), "utf-8"), "export const app = 'allowed';\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/utils/storage.ts"), "utf-8"), "export const storage = true;\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/screens/GameBoard.tsx"), "utf-8"), "export const board = 'base';\n");
      assert.equal(fs.existsSync(path.join(tmp, "src/screens/Extra.tsx")), false);
      assert.equal(fs.readFileSync(path.join(tmp, "tsconfig.json"), "utf-8"), "{}\n");

      const status = git(tmp, ["status", "--porcelain"]);
      assert.match(status, /M src\/App\.tsx/);
      assert.match(status, /\?\? src\/utils\//);
      assert.doesNotMatch(status, /src\/screens/);
      assert.doesNotMatch(status, /tsconfig/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("React Vite stack rules allow main.tsx only when scoped", () => {
    const rules = STACK_RULES["react-vite"].pitfalls;
    assert.ok(rules.includes("If it is listed in SCOPE_FILES, it is yours to wire"));
    assert.ok(rules.includes("If it is not listed in SCOPE_FILES, treat it as read-only context"));
    assert.equal(rules.includes("do NOT declare it as an OWNED file"), false);
  });

  it("prompt requires runtime window.app bridge when accepted by story contract", () => {
    const prompt = fs.readFileSync(path.join(process.cwd(), "src/installer/steps/06-implement/prompt.md"), "utf-8");
    assert.match(prompt, /implement it\s+as a real runtime test bridge/i);
    assert.match(prompt, /requested game's score\/progress/i);
    assert.match(prompt, /gameplay\s+entities/i);
    assert.match(prompt, /active\s+screen\/route, selected record, counts, storage status, last error/i);
    assert.match(prompt, /Supervisor Memory/i);
    assert.match(prompt, /Stack Contract/i);
    assert.match(prompt, /resolved by Setfarm before implementation/i);
    assert.match(prompt, /Stack-Specific Implementation Rules/i);
    assert.match(prompt, /Stack Verification Contract/i);
    assert.match(prompt, /do not invent props/i);
    assert.match(prompt, /If TypeScript says a prop does not exist on a shared component/i);
    assert.match(prompt, /Generated Stitch screen components may declare an `actions` prop/i);
    assert.match(prompt, /do not infer actions from `textContent`/i);
    assert.match(prompt, /do not use `read`, `cat`, `sed`, `head`, `tail`, `rg`, `grep`, `find`, `awk`, `node`, or `python` on that `src\/screens\/\*\.tsx` file/i);
    assert.match(prompt, /Read generated screen source only when that exact `src\/screens\/\*\.tsx` file is listed in SCOPE_FILES/i);
    assert.doesNotMatch(prompt, /If exact detail is\s+still needed, inspect one relevant file/i);
    assert.match(prompt, /Reducers and state transition functions must be pure/i);
    assert.match(prompt, /`vite\.config\.\*` is app\/toolchain config and is forbidden/i);
    assert.match(prompt, /Do not edit `index\.html` for title, Google fonts, icon fonts, metadata, or root markup/i);
    assert.match(prompt, /Shared domain\/type files \(`src\/types\/\*`, `src\/types\.ts`, domain model files\) are read-only unless they are explicitly listed in SCOPE_FILES/i);
    assert.match(prompt, /local display\/render type or adapter/i);
  });

  it("buildPrompt is the loop source of truth for implement instructions", () => {
    const result = implementModule.buildPrompt({ runId: "r1", task: "anything", context: { repo: "/x" } });
    assert.match(result, /# Developer Task/);
    assert.match(result, /Setfarm commits the allowed story scope/);
    assert.doesNotMatch(result, /Commit and push your changes/);
  });

  it("loop claims use step module buildPrompt instead of stale workflow fallback", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/installer/step-ops.ts"), "utf-8");
    assert.match(source, /Step module takeover for loop claims/);
    assert.match(source, /withStepModulePromptAliases/);
    assert.match(source, /assign\("SCOPE_FILES", "story_scope_files"\)/);
    assert.match(source, /assign\("STORY_ROADMAP", "story_roadmap"\)/);
    assert.match(source, /assign\("STORY", "current_story"\)/);
    assert.match(source, /loop buildPrompt override/);
    assert.ok(source.includes("resolveTemplate(_modulePrompt, renderContext)"));
    assert.ok(source.includes("await resolveLoopClaimInput(step, prunedContextLoop, context)"));
  });

  it("injectContext is a no-op (real work happens in injectStoryContext post-selection)", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await implementModule.injectContext({
      runId: "r1", stepId: "implement", task: "t", context,
    });
    assert.deepEqual(context, { foo: "bar" });
  });

  it("validateOutput rejects missing STATUS", () => {
    const r = validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput accepts STATUS: retry (no extra fields needed)", () => {
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects STATUS: done without CHANGES or STORY_BRANCH", () => {
    const r = validateOutput({ status: "done" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("CHANGES or STORY_BRANCH")));
  });

  it("validateOutput accepts STATUS: done when CHANGES is set", () => {
    const r = validateOutput({ status: "done", changes: "src/App.tsx modified" } as ParsedOutput);
    assert.equal(r.ok, true);
  });

  it("validateOutput accepts STATUS: done when STORY_BRANCH is set", () => {
    const r = validateOutput({ status: "done", story_branch: "story-US-001" } as ParsedOutput);
    assert.equal(r.ok, true);
  });

  it("normalize extracts first word, lowercase, multi-line STATUS leak fix", () => {
    const parsed = { status: "DONE\nSome trailing narrative text" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });

  it("normalize trims whitespace around STATUS", () => {
    const parsed = { status: "  retry  " } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "retry");
  });

  it("normalize leaves STATUS untouched when absent", () => {
    const parsed = { changes: "x" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], undefined);
  });

  it("expands scope overflow limits for large planner-owned single-story scopes", () => {
    const declaredScope = [
      "src/screens/HomeCounter.tsx",
      "src/screens/ErrorStateFallback.tsx",
      "src/screens/EmptyInitialState.tsx",
      "src/components/CounterDisplay/CounterDisplay.tsx",
      "src/components/CounterDisplay/CounterDisplay.module.css",
      "src/components/ActionButtons/ActionButtons.tsx",
      "src/components/ActionButtons/ActionButtons.module.css",
      "src/components/ResetButton/ResetButton.tsx",
      "src/components/ResetButton/ResetButton.module.css",
      "src/hooks/useCounter.ts",
      "src/types/counter.ts",
      "src/utils/storage.ts",
      "src/App.tsx",
      "src/App.css",
      "src/main.tsx",
      "src/index.css",
    ];

    const { hardLimit, softLimit } = computeScopeFileLimits(false, declaredScope);
    assert.ok(hardLimit >= 22, `hard limit ${hardLimit} should cover declared files plus test helpers`);
    assert.ok(softLimit >= 16, `soft limit ${softLimit} should scale with hard limit`);
  });

  it("expands scope overflow limits for shared Stitch screen wiring", () => {
    const appScope = [
      "src/App.tsx",
      "src/App.css",
      "src/main.tsx",
      "src/index.css",
      "src/types/domain.ts",
      "src/hooks/useAppState.ts",
      "src/utils/storage.ts",
    ];
    const sharedScreens = [
      "src/screens/LeadEditor.tsx",
      "src/screens/LeadList.tsx",
      "src/screens/InsightsDashboard.tsx",
      "src/screens/SettingsScreen.tsx",
      "src/screens/EmptyState.tsx",
      "src/screens/ErrorState.tsx",
      "src/screens/PipelineBoard.tsx",
      "src/screens/ProfilePanel.tsx",
    ];

    const withShared = computeScopeFileLimits(false, appScope, sharedScreens);
    const withoutShared = computeScopeFileLimits(false, appScope);
    assert.equal(withShared.hardLimit, withoutShared.hardLimit, "shared_files must not inflate writable scope limits");
    assert.equal(withShared.softLimit, withoutShared.softLimit, "shared_files must remain read-only context");

    const implicitTestAndConfig = [
      "src/App.test.tsx",
      "src/hooks/useAppState.test.ts",
      "src/test/storage.test.ts",
      "src/test/setup.ts",
      "src/setupTests.ts",
      "vitest.config.ts",
      "jest.config.ts",
      "jest.config.js",
    ];
    const { hardLimit, softLimit } = computeScopeFileLimits(false, appScope, sharedScreens, implicitTestAndConfig);
    assert.ok(hardLimit >= 20, `hard limit ${hardLimit} should cover app shell and implicit test/config files`);
    assert.ok(softLimit >= 14, `soft limit ${softLimit} should scale with writable and implicit file count`);
  });

  it("checks critical UI contracts only against the story scope when scope is available", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-contract-scope-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "stitch/design-tokens.css"), ":root { --color-background: #000; }\n");
      fs.writeFileSync(path.join(tmp, "src/index.css"), "@import '../stitch/design-tokens.css';\n");
      fs.writeFileSync(path.join(tmp, "src/screens/Allowed.tsx"), "export function Allowed() { return <span>Clean</span>; }\n");
      fs.writeFileSync(path.join(tmp, "src/screens/Legacy.tsx"), "export function Legacy() { return <button className=\"transition-all\"><span className=\"material-symbols-outlined\">warning</span></button>; }\n");

      assert.equal(checkStoryDesignCompliance({
        repo: tmp,
        story_workdir: tmp,
        story_scope_files: "src/screens/Allowed.tsx",
      }), null);

      const scopedContractFailure = checkStoryDesignCompliance({
        repo: tmp,
        story_workdir: tmp,
        story_scope_files: "src/screens/Legacy.tsx",
      }) || "";
      assert.match(scopedContractFailure, /CRITICAL DESIGN CONTRACT/);
      assert.match(scopedContractFailure, /inline SVG components or an installed SVG icon library/);
      assert.match(scopedContractFailure, /transition-colors, transition-transform, transition-opacity/);
      assert.doesNotMatch(scopedContractFailure, /hardcoded colors|import stitch\/design-tokens\.css/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("catches scoped screen controls that drift from DESIGN_DOM before verify retries are spent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-gate-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "pause-1", title: "Pause Overlay", file: "src/screens/PauseOverlay.tsx" },
        { screenId: "over-1", title: "Game Over", file: "src/screens/GameOver.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "pause-1",
            title: "Pause Overlay",
            buttons: [{ label: "SUPERVISOR", action: "click-action" }],
            navLinks: [{ label: "terminal", href: "#", icon: "terminal" }],
          },
          {
            screenId: "over-1",
            title: "Game Over",
            buttons: [
              { label: "REBOOT SESSION", icon: "restart_alt", action: "reset" },
              { label: "DISCONNECT (MAIN MENU)", icon: "logout", action: "navigate" },
            ],
            navLinks: [],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/PauseOverlay.tsx"), [
        "export function PauseOverlay() {",
        "  return <nav>",
        "    <div>SUPERVISOR</div>",
        "    <a aria-current=\"page\"><span data-icon=\"terminal\" />TERMINAL</a>",
        "  </nav>;",
        "}",
        "",
      ].join("\n"));
      fs.writeFileSync(path.join(tmp, "src/screens/GameOver.tsx"), [
        "import { Circle } from 'lucide-react';",
        "export function GameOver({ actions }: any) {",
        "  return <main>",
        "    <button type=\"button\" onClick={actions?.restart}><Circle />REBOOT SESSION</button>",
        "    <button type=\"button\" onClick={actions?.menu}><Circle />DISCONNECT (MAIN MENU)</button>",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const findings = findDesignDomImplementationFindings(tmp, [
        "src/screens/PauseOverlay.tsx",
        "src/screens/GameOver.tsx",
      ]);
      const issues = findings.filter((finding: any) => finding.severity === "blocker").map((finding: any) => finding.message);
      const warnings = findings.filter((finding: any) => finding.severity === "warning").map((finding: any) => finding.message);

      assert.ok(issues.some((issue) => issue.includes('SUPERVISOR_CHECKLIST button "SUPERVISOR" is static') || issue.includes('missing button "SUPERVISOR"')), issues.join("\n"));
      assert.ok(issues.some((issue) => issue.includes('link "terminal" lacks href="#"')), issues.join("\n"));
      assert.ok(warnings.some((issue) => issue.includes('expected icon "restart_alt"')), warnings.join("\n"));
      assert.ok(warnings.some((issue) => issue.includes('expected icon "logout"')), warnings.join("\n"));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("accepts Lucide SVG aliases for common Material DESIGN_DOM icon names", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-icon-aliases-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-1", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "main-1",
            title: "Main Menu",
            buttons: [
              { label: "Start New Game", icon: "sports_esports", action: "start" },
              { label: "Resume", icon: "play_circle", action: "resume" },
              { label: "How to Play", icon: "menu_book", action: "help" },
              { icon: "arrow_drop_up", action: "up" },
              { icon: "arrow_drop_down", action: "down" },
            ],
            navLinks: [],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "import { BookOpen, ChevronDown, ChevronUp, CirclePlay, Gamepad2 } from 'lucide-react';",
        "export function MainMenu({ actions }: any) {",
        "  return <main>",
        "    <button type=\"button\" onClick={actions?.start}><Gamepad2 />Start New Game</button>",
        "    <button type=\"button\" onClick={actions?.resume}><CirclePlay />Resume</button>",
        "    <button type=\"button\" onClick={actions?.help}><BookOpen />How to Play</button>",
        "    <button type=\"button\" onClick={actions?.up}><ChevronUp aria-label=\"up\" /></button>",
        "    <button type=\"button\" onClick={actions?.down}><ChevronDown aria-label=\"down\" /></button>",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const issues = findDesignDomImplementationIssues(tmp, ["src/screens/MainMenu.tsx"]);

      assert.deepEqual(issues, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not match icon aliases inside CSS words or force display-only title controls to be actions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-title-alias-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "main-1", title: "Main Menu", file: "src/screens/MainMenu.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "main-1",
            title: "Main Menu",
            buttons: [
              { label: "Resume", icon: "play_circle", classes: ["h-touch-target"], action: "resume" },
            ],
            navLinks: [],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/MainMenu.tsx"), [
        "import { PlayCircle } from 'lucide-react';",
        "export function MainMenu({ actions }: any) {",
        "  return <main>",
        "    <h1 className=\"font-display-score text-display-score\">PONG ARCADE</h1>",
        "    <button type=\"button\" onClick={actions?.resume}><PlayCircle />Resume</button>",
        "  </main>;",
        "}",
        "",
      ].join("\n"));

      const issues = findDesignDomImplementationIssues(tmp, ["src/screens/MainMenu.tsx"]);

      assert.deepEqual(issues, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("allows explicitly inert DESIGN_DOM hash anchors when href and aria state are preserved", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-design-dom-anchor-"));
    try {
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.mkdirSync(path.join(tmp, "src/screens"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/screens/SCREEN_INDEX.json"), JSON.stringify([
        { screenId: "pause-1", title: "Pause Overlay", file: "src/screens/PauseOverlay.tsx" },
      ]));
      fs.writeFileSync(path.join(tmp, "stitch/DESIGN_DOM.json"), JSON.stringify({
        screens: [
          {
            screenId: "pause-1",
            title: "Pause Overlay",
            buttons: [],
            navLinks: [
              { label: "terminal", href: "#", icon: "terminal" },
              { label: "RECORDS", href: "#", icon: "emoji_events" },
            ],
          },
        ],
      }));
      fs.writeFileSync(path.join(tmp, "src/screens/PauseOverlay.tsx"), [
        "import { Terminal, Trophy } from 'lucide-react';",
        "export function PauseOverlay() {",
        "  return <nav>",
        "    <a href=\"#\" aria-current=\"page\"><Terminal />TERMINAL</a>",
        "    <a href=\"#\" aria-disabled=\"true\" tabIndex={-1}><Trophy />RECORDS</a>",
        "  </nav>;",
        "}",
        "",
      ].join("\n"));

      assert.deepEqual(findDesignDomImplementationIssues(tmp, ["src/screens/PauseOverlay.tsx"]), []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("detects package build scripts for implement build gate", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-build-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "node -e \"process.exit(0)\"" } }));
      assert.deepEqual(detectPackageBuildCommand(tmp), ["npm", "run", "build"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fails implement build gate when npm run build fails", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-build-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: { build: "node -e \"console.error('synthetic build failure'); process.exit(2)\"" },
      }));
      const result = checkBuildGate("US-001", "Failing Build", tmp, 0, 3);
      assert.equal(result.passed, false);
      assert.equal(result.category, "BUILD_FAILED");
      assert.match(result.reason || "", /synthetic build failure|Command failed/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("detects real window.app runtime bridge assignments only", () => {
    assert.equal(sourceExposesWindowApp("window.app = { score: 10 };\n"), true);
    assert.equal(sourceExposesWindowApp("globalThis['app'] = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("(window as any).app = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("(window as unknown as Record<string, unknown>).app = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("(globalThis as any)['app'] = bridge;\n"), true);
    assert.equal(sourceExposesWindowApp("window.game = bridge;\n"), false);
    assert.equal(sourceExposesWindowApp("declare global { interface Window { app: unknown } }\n"), false);
    assert.equal(sourceExposesWindowApp("// window.app = bridge;\nconst ready = true;\n"), false);
    assert.equal(sourceExposesWindowApp("/* globalThis.app = bridge; */\nconst ready = true;\n"), false);
  });

  it("prepares implement worktrees with safe design and reference corpus", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-implement-safe-assets-"));
    try {
      const referenceSource = path.join(tmp, "reference-source");
      fs.mkdirSync(referenceSource, { recursive: true });
      fs.writeFileSync(path.join(referenceSource, "game-dev-guide.md"), "# full game guide\n".repeat(400));
      fs.symlinkSync(referenceSource, path.join(tmp, "references"), "dir");
      fs.mkdirSync(path.join(tmp, "stitch"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "stitch", "screen.html"), "<html>raw stitch</html>\n");
      fs.writeFileSync(path.join(tmp, "stitch", "screen.png"), "png bytes\n");
      fs.writeFileSync(path.join(tmp, "stitch", "DESIGN_DOM.json"), JSON.stringify({ raw: true }));
      fs.writeFileSync(path.join(tmp, "stitch", "UI_CONTRACT.json"), JSON.stringify([{ screen: "Main" }]));
      fs.writeFileSync(path.join(tmp, "stitch", "DESIGN_MANIFEST.json"), JSON.stringify([{ id: "screen" }]));
      fs.writeFileSync(path.join(tmp, "stitch", "SCREEN_MAP.json"), JSON.stringify([{ id: "screen" }]));
      fs.writeFileSync(path.join(tmp, "stitch", "design-tokens.css"), ":root { --color-bg: #000; }\n");
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ scripts: { build: "vite build" } }));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "base"]);

      const worktree = createStoryWorktree(tmp, "44aa2211-us-001", "main");

      assert.ok(worktree);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "screen.html")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "DESIGN_DOM.json")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "screen.png")), false);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "UI_CONTRACT.json")), true);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "DESIGN_MANIFEST.json")), true);
      assert.equal(fs.existsSync(path.join(worktree, "stitch", "design-tokens.css")), true);
      assert.equal(fs.lstatSync(path.join(worktree, "references")).isSymbolicLink(), false);
      assert.equal(fs.existsSync(path.join(worktree, "references", "game-dev-guide.md")), false);
      assert.match(fs.readFileSync(path.join(worktree, "references", "README.md"), "utf-8"), /Full reference manuals are intentionally not mounted/);
      assert.equal(git(worktree, ["status", "--porcelain", "--", "references", "stitch"]).trim(), "");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blocks implement completion when touched tests fail", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-test-gate-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: {
          "test:run": "node -e \"console.error('synthetic test failure'); process.exit(2)\"",
        },
        devDependencies: { vitest: "1.0.0" },
      }));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "baseline"]);
      git(tmp, ["checkout", "-b", "story"]);

      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/failing.test.ts"), "import assert from 'node:assert/strict';\nassert.equal(1, 2);\n");
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "add failing test"]);

      const result = checkTestGate("US-001", "Failing Tests", tmp, "main", 0, 3);
      assert.equal(result.passed, false);
      assert.equal(result.category, "TEST_FAILED");
      assert.match(result.reason || "", /src\/failing\.test\.ts/);
      assert.match(result.reason || "", /synthetic test failure|Command failed/);
      assert.match(result.suggestion || "", /TEST FAILURES DETECTED/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("does not run test gate when story did not touch tests", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-test-gate-clean-"));
    try {
      fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({
        scripts: {
          "test:run": "node -e \"console.error('should not run'); process.exit(2)\"",
        },
        devDependencies: { vitest: "1.0.0" },
      }));
      git(tmp, ["init", "-b", "main"]);
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "baseline"]);
      git(tmp, ["checkout", "-b", "story"]);

      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/App.tsx"), "export function App() { return null; }\n");
      git(tmp, ["add", "."]);
      git(tmp, ["commit", "-m", "add app"]);

      const result = checkTestGate("US-001", "No Test Touch", tmp, "main", 0, 3);
      assert.equal(result.passed, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("wires runtime bridge and touched-test gates into implement completion", () => {
    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /const bridgeResult = await checkRuntimeBridgeGate/);
    assert.match(stepOps, /await failStep\(stepId, bridgeResult\.reason\)/);
    assert.match(stepOps, /const testResult = checkTestGate/);
    assert.match(stepOps, /await failStep\(stepId, testResult\.reason\)/);
  });

  it("defers full system smoke until later UI story owns the app surface", () => {
    const decision = decideStorySystemSmokeGate("US-001", [
      {
        story_id: "US-001",
        story_index: 0,
        status: "done",
        scope_files: JSON.stringify(["src/types/habit.ts", "src/hooks/useLocalStorage.ts"]),
      },
      {
        story_id: "US-002",
        story_index: 1,
        status: "pending",
        scope_files: JSON.stringify(["src/screens/Home.tsx", "src/App.tsx"]),
      },
    ]);

    assert.equal(decision.run, false);
    assert.match(decision.reason, /US-002/);
  });

  it("runs full system smoke for the last pending UI boundary story", () => {
    const decision = decideStorySystemSmokeGate("US-003", [
      {
        story_id: "US-001",
        story_index: 0,
        status: "verified",
        scope_files: JSON.stringify(["src/types/habit.ts"]),
      },
      {
        story_id: "US-002",
        story_index: 1,
        status: "verified",
        scope_files: JSON.stringify(["src/screens/Home.tsx"]),
      },
      {
        story_id: "US-003",
        story_index: 2,
        status: "done",
        scope_files: JSON.stringify(["src/App.tsx", "src/main.tsx", "src/index.css"]),
      },
    ]);

    assert.equal(decision.run, true);
  });
});
