import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { implementModule } from "../../dist/installer/steps/06-implement/module.js";
import { checkBuildGate, computeScopeFileLimits, detectPackageBuildCommand, normalize, validateOutput } from "../../dist/installer/steps/06-implement/guards.js";
import { cleanupOutOfScopeWorktreeFiles } from "../../dist/installer/steps/06-implement/context.js";
import { decideStorySystemSmokeGate } from "../../dist/installer/step-ops.js";
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

  it("scope gate treats shared_files as read-only context, not completion-allowed files", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "dist/installer/steps/06-implement/guards.js"), "utf-8");
    assert.match(source, /SELECT scope_files, shared_files FROM stories WHERE id/);
    assert.match(source, /const declaredSharedFiles = parseScopeFiles\(scopeRow\?\.shared_files\)/);
    assert.doesNotMatch(source, /declaredSharedFiles\.forEach\(f => allowed\.add\(f\)\)/);
    assert.match(source, /void declaredSharedFiles/);

    const stepOps = fs.readFileSync(path.join(process.cwd(), "dist/installer/step-ops.js"), "utf-8");
    assert.match(stepOps, /cleanupOutOfScopeWorktreeFiles/);
    assert.match(stepOps, /vite\.config\.\*, tailwind\.config\.\*, tsconfig\.\*, index\.html/);
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
    assert.match(prompt, /score\/status\/level\/lines\/paused\/\s+gameOver\/activePiece\/nextPiece/i);
    assert.match(prompt, /active\s+screen\/route, selected record, counts, storage status, last error/i);
    assert.match(prompt, /do not invent props/i);
    assert.match(prompt, /If TypeScript says a prop does not exist on a shared component/i);
    assert.match(prompt, /Generated Stitch screen components may declare an `actions` prop/i);
    assert.match(prompt, /do not infer actions from `textContent`/i);
    assert.match(prompt, /Reducers and state transition functions must be pure/i);
    assert.match(prompt, /`vite\.config\.\*` is app\/toolchain config and is forbidden/i);
    assert.match(prompt, /Do not edit `index\.html` for title, Google fonts, icon fonts, metadata, or root markup/i);
  });

  it("buildPrompt returns empty string — loop delegates to AGENTS.md", () => {
    const result = implementModule.buildPrompt({ runId: "r1", task: "anything", context: { repo: "/x" } });
    assert.equal(result, "");
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
      "src/screens/AnaSayfaSayac.tsx",
      "src/screens/HataDurumuSessizFallback.tsx",
      "src/screens/BaslangicDurumuBos.tsx",
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
      "src/screens/AdayEkleduzenle.tsx",
      "src/screens/AdaylarLeads.tsx",
      "src/screens/AnalizlerInsights.tsx",
      "src/screens/AyarlarSettings.tsx",
      "src/screens/BosDurumEmptyState.tsx",
      "src/screens/HataDurumuErrorState.tsx",
      "src/screens/PipelineBoard.tsx",
      "src/screens/ProfilPaneli.tsx",
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
      fs.writeFileSync(path.join(tmp, "src/screens/Legacy.tsx"), "export function Legacy() { return <span className=\"material-symbols-outlined\">warning</span>; }\n");

      assert.equal(checkStoryDesignCompliance({
        repo: tmp,
        story_workdir: tmp,
        story_scope_files: "src/screens/Allowed.tsx",
      }), null);

      assert.match(checkStoryDesignCompliance({
        repo: tmp,
        story_workdir: tmp,
        story_scope_files: "src/screens/Legacy.tsx",
      }) || "", /CRITICAL DESIGN CONTRACT/);
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
        scope_files: JSON.stringify(["src/screens/AnaSayfa.tsx", "src/App.tsx"]),
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
        scope_files: JSON.stringify(["src/screens/AnaSayfa.tsx"]),
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
