import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { implementModule } from "../../dist/installer/steps/06-implement/module.js";
import { checkBuildGate, computeScopeFileLimits, detectPackageBuildCommand, normalize, validateOutput } from "../../dist/installer/steps/06-implement/guards.js";
import { decideStorySystemSmokeGate } from "../../dist/installer/step-ops.js";
import { STACK_RULES } from "../../dist/installer/steps/06-implement/stack-rules.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

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
    assert.equal(rules.includes("small edits OK"), false);
  });

  it("React Vite stack rules allow main.tsx only when scoped", () => {
    const rules = STACK_RULES["react-vite"].pitfalls;
    assert.ok(rules.includes("If it is listed in SCOPE_FILES, it is yours to wire"));
    assert.ok(rules.includes("If it is not listed in SCOPE_FILES, treat it as read-only context"));
    assert.equal(rules.includes("do NOT declare it as an OWNED file"), false);
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
