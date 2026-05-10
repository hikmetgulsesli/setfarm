import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
    assert.ok(prompt.includes("Rules"));
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

  it("preClaim supports auto-completion instead of setup-repo agent handoff", () => {
    const preclaim = fs.readFileSync("src/installer/steps/04-setup-repo/preclaim.ts", "utf-8");
    assert.ok(preclaim.includes("SETFARM_DISABLE_AUTO_SETUP_REPO"), "auto-complete should have an opt-out env guard");
    assert.ok(preclaim.includes("AUTO-COMPLETED setup-repo"), "setup-repo should complete in preClaim when the repo is ready");
    assert.ok(preclaim.includes("completeStep(step.id, output)"), "preClaim should use the normal completeStep path");
    assert.ok(preclaim.includes("repoReady"), "auto-complete must require a real prepared repo");
  });

  it("onComplete canonicalizes setup-repo branch to the run id", async () => {
    const { onComplete } = await import("../../dist/installer/steps/04-setup-repo/guards.js");
    const context: Record<string, string> = { branch: "feature-long-plan-branch", BRANCH: "feature-long-plan-branch" };
    await onComplete({
      runId: "run-123",
      stepId: "setup-repo",
      parsed: { status: "done", existing_code: "false" } as ParsedOutput,
      context,
    });

    assert.equal(context.branch, "run-123");
    assert.equal(context.BRANCH, "run-123");
    assert.equal(context.existing_code, "false");
  });

  it("vite scaffold template is project-neutral", () => {
    const script = fs.readFileSync("scripts/setup-repo.sh", "utf-8");
    assert.ok(script.includes('git init -b main'), "fresh repos should initialize main directly");
    assert.ok(script.includes("normalize_stack()"), "setup-repo should normalize planner TECH_STACK labels");
    assert.ok(script.includes("react-vite-typescript"), "React/Vite/TypeScript labels should map to vite-react");
    assert.ok(script.includes("nextjs)"), "Next.js should have a first-class scaffold case");
    assert.ok(script.includes('"build": "next build"'), "Next.js scaffold should build with next build");
    assert.ok(script.includes('"name": "$PACKAGE_NAME"'), "package name should come from project slug");
    assert.ok(script.includes("<title>$PROJECT_NAME</title>"), "HTML title should come from project slug");
    assert.ok(script.includes('data-setfarm-root="baseline"'), "App baseline should be machine-detectable");
    assert.ok(script.includes("baseline scaffold did not create package.json"), "fresh frontend repos must fail if scaffold is missing");
    assert.equal(script.includes("<title>Notlar</title>"), false);
    assert.equal(script.includes("useNotes"), false);
    assert.equal(script.includes("NoteStatus"), false);
    assert.equal(script.includes("setfarm-notlar"), false);
  });
});
