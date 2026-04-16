import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { setupRepoModule } from "../../dist/installer/steps/04-setup-repo/module.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

describe("04-setup-repo step module", () => {
  it("module metadata is correct", () => {
    assert.equal(setupRepoModule.id, "setup-repo");
    assert.equal(setupRepoModule.type, "single");
    assert.equal(setupRepoModule.agentRole, "setup-repo");
    assert.equal(setupRepoModule.maxPromptSize, 6144);
    assert.deepEqual(setupRepoModule.requiredOutputFields, ["STATUS"]);
    assert.ok(typeof setupRepoModule.preClaim === "function");
    assert.ok(typeof setupRepoModule.onComplete === "function");
  });

  it("buildPrompt substitutes REPO/BRANCH/TECH_STACK/DB_REQUIRED from context", () => {
    const prompt = setupRepoModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/testapp-99999",
        branch: "feature-testapp",
        tech_stack: "vite-react",
        db_required: "postgres",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/testapp-99999"));
    assert.ok(prompt.includes("feature-testapp"));
    assert.ok(prompt.includes("vite-react"));
    assert.ok(prompt.includes("postgres"));
    assert.ok(prompt.includes("Kurallar"));
  });

  it("buildPrompt uses defaults when context keys missing", () => {
    const prompt = setupRepoModule.buildPrompt({ runId: "r1", task: "t", context: {} });
    assert.ok(prompt.includes("main"));
    assert.ok(prompt.includes("vite-react"));
    assert.ok(prompt.includes("none"));
  });

  it("buildPrompt stays within maxPromptSize", () => {
    const prompt = setupRepoModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: { repo: "$HOME/projects/typical-app", tech_stack: "vite-react", db_required: "none" },
    });
    assert.ok(
      Buffer.byteLength(prompt, "utf-8") < setupRepoModule.maxPromptSize,
      `prompt ${Buffer.byteLength(prompt, "utf-8")} >= budget ${setupRepoModule.maxPromptSize}`
    );
  });

  it("validateOutput rejects when STATUS is missing", () => {
    const r = setupRepoModule.validateOutput({} as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("STATUS")));
  });

  it("validateOutput rejects STATUS that is not 'done'", () => {
    const r = setupRepoModule.validateOutput({ status: "retry" } as ParsedOutput);
    assert.equal(r.ok, false);
  });

  it("validateOutput accepts STATUS: done (case-insensitive)", () => {
    assert.equal(setupRepoModule.validateOutput({ status: "done" } as ParsedOutput).ok, true);
    assert.equal(setupRepoModule.validateOutput({ status: "DONE" } as ParsedOutput).ok, true);
  });
});
