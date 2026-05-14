import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyModule } from "../../dist/installer/steps/07-verify/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/07-verify/guards.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

const verifyPromptSource = readFileSync(
  resolve(import.meta.dirname, "../../src/installer/steps/07-verify/prompt.md"),
  "utf-8"
);

describe("07-verify step module", () => {
  it("module metadata is correct", () => {
    assert.equal(verifyModule.id, "verify");
    assert.equal(verifyModule.type, "single");
    assert.equal(verifyModule.agentRole, "reviewer");
    assert.equal(verifyModule.maxPromptSize, 16384);
    assert.deepEqual(verifyModule.requiredOutputFields, ["STATUS"]);
  });

  it("injectContext seeds supervisor memory and PR metadata defaults", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await verifyModule.injectContext({
      runId: "r1", stepId: "verify", task: "t", context,
    });
    assert.deepEqual(context, {
      foo: "bar",
      supervisor_memory: "(no supervisor memory yet)",
      pr_comments: "",
      pr_check_state: "",
      pr_mergeable: "",
      pr_merge_state_status: "",
    });
  });

  it("buildPrompt substitutes worktree, main repo, PR, and preflight context", () => {
    const prompt = verifyModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/sayac-12345",
        story_workdir: "/tmp/story-worktrees/r1-us-001",
        branch: "feature-sayac",
        pr_url: "https://github.com/u/r/pull/42",
        preflight_analysis: "3 files changed, 0 ESLint errors",
        current_story: "US-002: Domain state",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/sayac-12345"));
    assert.ok(prompt.includes("MAIN_REPO: $HOME/projects/sayac-12345"));
    assert.ok(prompt.includes("STORY_WORKDIR: /tmp/story-worktrees/r1-us-001"));
    assert.ok(prompt.includes("VERIFY_WORKDIR: /tmp/story-worktrees/r1-us-001"));
    assert.ok(prompt.includes("REPO: /tmp/story-worktrees/r1-us-001"));
    assert.ok(prompt.includes("feature-sayac"));
    assert.ok(prompt.includes("https://github.com/u/r/pull/42"));
    assert.ok(prompt.includes("3 files changed"));
    assert.ok(prompt.includes("US-002"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt falls back to final_pr when pr_url missing", () => {
    const prompt = verifyModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { final_pr: "https://github.com/u/r/pull/99" },
    });
    assert.ok(prompt.includes("https://github.com/u/r/pull/99"));
  });

  it("buildPrompt default PREFLIGHT notice when analysis not run", () => {
    const prompt = verifyModule.buildPrompt({ runId: "r1", task: "t", context: {} });
    assert.ok(prompt.includes("(no pre-flight run)"));
  });

  it("source prompt keeps verify as a gatekeeper instead of a fixer", () => {
    assert.ok(verifyPromptSource.includes("does not fix code"));
    assert.ok(verifyPromptSource.includes("git commit"));
    assert.ok(verifyPromptSource.includes("git push"));
    assert.ok(verifyPromptSource.includes("STATUS: retry"));
    assert.ok(verifyPromptSource.includes("STATUS: done` is allowed only after the PR is actually `MERGED`"));
    assert.ok(verifyPromptSource.includes("Do not dismiss them as \"pre-existing\""));
    assert.ok(verifyPromptSource.includes("current-main runtime/smoke evidence is clean"));
    assert.ok(verifyPromptSource.includes("8 minutes"));
    assert.ok(verifyPromptSource.includes("VERIFY_INFRA_PR_URL_MISSING"));
    assert.ok(verifyPromptSource.includes("Setfarm must create/reuse the story PR before reviewer runs"));
    assert.ok(verifyPromptSource.includes("Bounded Manager Protocol"));
    assert.ok(verifyPromptSource.includes("Verify is an evidence gate"));
    assert.ok(verifyPromptSource.includes("Build/test/smoke verification before source review"));
    assert.ok(verifyPromptSource.includes("inspect only files changed by the PR"));
    assert.ok(verifyPromptSource.includes("VERIFY_WORKDIR"));
    assert.ok(verifyPromptSource.includes("STORY_WORKDIR"));
    assert.ok(verifyPromptSource.includes("VERIFY_WORKDIR_BRANCH_MISMATCH"));
    assert.ok(verifyPromptSource.includes("Do not check out the story branch inside"));
  });

  it("buildPrompt stays within maxPromptSize for typical context", () => {
    const prompt = verifyModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/app",
        branch: "feature-app",
        preflight_analysis: "ESLint: 0 errors, 2 warnings\nTSC: clean\n5 files changed",
        stories_json: JSON.stringify(Array.from({ length: 5 }, (_, i) => ({
          id: `US-00${i + 1}`,
          title: `Story ${i + 1}`,
          description: "lorem ipsum ".repeat(20),
        }))),
      },
    });
    assert.ok(
      Buffer.byteLength(prompt, "utf-8") < verifyModule.maxPromptSize,
      `prompt ${Buffer.byteLength(prompt, "utf-8")} >= budget ${verifyModule.maxPromptSize}`
    );
  });

  it("validateOutput rejects missing STATUS", () => {
    const r = validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput accepts STATUS: done", () => {
    assert.equal(validateOutput({ status: "done" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts STATUS: skip", () => {
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("validateOutput accepts STATUS: retry without extra fields (retry handled upstream in step-ops)", () => {
    // Note: step-ops.ts early-returns on STATUS: retry before module delegation,
    // so module.validateOutput() never runs for retry. We accept it here for
    // API symmetry and unit-test clarity; enforcement lives upstream.
    assert.equal(validateOutput({ status: "retry" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", feedback: "x" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS values", () => {
    const r = validateOutput({ status: "ok" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("Unknown STATUS")));
  });

  it("normalize trims + lowercases + extracts first word from STATUS", () => {
    const parsed = { status: "DONE\n\nExtra narrative" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });

  it("normalize leaves STATUS untouched when absent", () => {
    const parsed = { feedback: "x" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], undefined);
  });
});
