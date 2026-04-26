import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { implementModule } from "../../dist/installer/steps/06-implement/module.js";
import { computeScopeFileLimits, normalize, validateOutput } from "../../dist/installer/steps/06-implement/guards.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("06-implement step module", () => {
  it("module metadata is correct", () => {
    assert.equal(implementModule.id, "implement");
    assert.equal(implementModule.type, "loop");
    assert.equal(implementModule.agentRole, "developer");
    assert.equal(implementModule.maxPromptSize, 32768);
    assert.deepEqual(implementModule.requiredOutputFields, ["STATUS"]);
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
});
