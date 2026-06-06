import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { finalTestModule } from "../../dist/installer/steps/10-final-test/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/10-final-test/guards.js";
import { classifyFinalSystemSmokeResult } from "../../dist/installer/steps/10-final-test/preclaim.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

const sourcePreclaim = readFileSync(resolve(import.meta.dirname, "../../src/installer/steps/10-final-test/preclaim.ts"), "utf-8");

describe("10-final-test step module", () => {
  it("module metadata", () => {
    assert.equal(finalTestModule.id, "final-test");
    assert.equal(finalTestModule.type, "single");
    assert.equal(finalTestModule.agentRole, "tester");
    assert.equal(finalTestModule.maxPromptSize, 12288);
    assert.equal(typeof finalTestModule.onComplete, "function");
  });

  it("injectContext adds stack evidence context", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await finalTestModule.injectContext({ runId: "r1", stepId: "final-test", task: "t", context });
    assert.equal(context.foo, "bar");
    assert.equal(context.stack_pack_id, "needs-reconcile");
    assert.match(context.stack_contract, /Schema: setfarm\.stack-contract\.v1/);
    assert.match(context.stack_verification_contract, /no stack-specific verification/i);
  });

  it("buildPrompt substitutes REPO/BRANCH/FINAL_PR/STORIES_JSON", () => {
    const prompt = finalTestModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/app-12345",
        branch: "feature-app",
        final_pr: "https://github.com/u/r/pull/3",
        stories_json: '[{"id":"US-001"}]',
      },
    });
    assert.ok(prompt.includes("app-12345"));
    assert.ok(prompt.includes("smoke-test.mjs"));
    assert.ok(prompt.includes("Phase 16"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt stays within maxPromptSize", () => {
    const prompt = finalTestModule.buildPrompt({ runId: "r1", task: "t", context: {} });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < finalTestModule.maxPromptSize);
  });

  it("final preclaim uses deterministic runtime port and tool preflight", () => {
    assert.match(sourcePreclaim, /allocateRuntimePort/);
    assert.match(sourcePreclaim, /writeRunRuntimeArtifact/);
    assert.match(sourcePreclaim, /--port/);
    assert.match(sourcePreclaim, /DEV_SERVER_URL/);
    assert.match(sourcePreclaim, /run_runtime_json/);
    assert.match(sourcePreclaim, /artifactPath/);
    assert.match(sourcePreclaim, /toolPreflight/);
    assert.match(sourcePreclaim, /FINAL_TEST_JSON/);
    assert.match(sourcePreclaim, /setfarm\.final-test\.v1/);
  });

  it("final preclaim resolves smoke-test from the active platform build", () => {
    assert.match(sourcePreclaim, /resolvePlatformScript\("smoke-test\.mjs"\)/);
    assert.doesNotMatch(sourcePreclaim, /\.openclaw["',\s]+["']setfarm-repo["',\s]+["']scripts["',\s]+["']smoke-test\.mjs/);
  });

  it("final preclaim rebuilds before browser smoke so dist artifacts are fresh", () => {
    assert.match(sourcePreclaim, /ensureSmokeBuildFresh\(repo/);
    assert.match(sourcePreclaim, /final-smoke-prebuild/);
  });

  it("validateOutput rejects missing STATUS", () => {
    assert.equal(validateOutput({} as ParsedOutput).ok, false);
  });

  it("validateOutput accepts STATUS: done with final JSON evidence and skip", () => {
    assert.equal(validateOutput({
      status: "done",
      smoke_test_result: "pass",
      final_test_json: "quality-reports/final-test-1.json",
    } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, true);
  });

  it("validateOutput requires final JSON for done and retry/fail states", () => {
    assert.equal(validateOutput({ status: "done", smoke_test_result: "pass" } as ParsedOutput).ok, false);
    assert.equal(validateOutput({ status: "retry", test_failures: "Phase 3 fail" } as ParsedOutput).ok, false);
    assert.equal(validateOutput({
      status: "retry",
      final_test_json: "quality-reports/final-test-1.json",
      test_failures: "Phase 3 fail",
    } as ParsedOutput).ok, true);
  });

  it("system smoke classification routes zero-interaction pass to retry", () => {
    const decision = classifyFinalSystemSmokeResult({
      status: "pass",
      routesDiscovered: 1,
      buttonsChecked: 0,
      formsChecked: 0,
      failures: [],
    }, JSON.stringify({ status: "pass" }), false);

    assert.equal(decision.status, "retry");
    assert.match(decision.result.failures.join("\n"), /no interaction evidence/i);
  });

  it("system smoke classification counts browser-game flow evidence as interaction", () => {
    const decision = classifyFinalSystemSmokeResult({
      status: "pass",
      routesDiscovered: 1,
      buttonsChecked: 0,
      formsChecked: 0,
      flowsChecked: 1,
      failures: [],
    }, JSON.stringify({ status: "pass" }), false);

    assert.equal(decision.status, "done");
  });

  it("system smoke classification rejects unstructured successful output", () => {
    const decision = classifyFinalSystemSmokeResult(null, "loaded ok", false);

    assert.equal(decision.status, "retry");
    assert.match(decision.result.failures.join("\n"), /structured JSON/);
  });

  it("validateOutput rejects unknown STATUS", () => {
    assert.equal(validateOutput({ status: "tested" } as ParsedOutput).ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "DONE\nsmoke_test_result: pass" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "done");
  });

  it("onComplete validates FINAL_TEST_JSON schema", async () => {
    const repo = mkdtempSync(join(tmpdir(), "setfarm-final-test-"));
    mkdirSync(join(repo, "quality-reports"), { recursive: true });
    writeFileSync(join(repo, "quality-reports", "final-test-1.json"), JSON.stringify({
      schema: "setfarm.final-test.v1",
      status: "done",
      routesTested: 1,
      interactionsTested: 1,
      issueCount: 0,
    }));

    await finalTestModule.onComplete!({
      runId: "r1",
      stepId: "final-test",
      context: { repo },
      parsed: {
        status: "done",
        smoke_test_result: "pass",
        final_test_json: "quality-reports/final-test-1.json",
      },
    });
  });

  it("onComplete rejects missing FINAL_TEST_JSON file", async () => {
    const repo = mkdtempSync(join(tmpdir(), "setfarm-final-test-"));
    await assert.rejects(
      finalTestModule.onComplete!({
        runId: "r1",
        stepId: "final-test",
        context: { repo },
        parsed: {
          status: "done",
          smoke_test_result: "pass",
          final_test_json: "quality-reports/final-test-1.json",
        },
      }),
      /FINAL_TEST_AUDIT: JSON report file not found/,
    );
  });

  it("onComplete rejects done FINAL_TEST_JSON with zero interactions", async () => {
    const repo = mkdtempSync(join(tmpdir(), "setfarm-final-test-"));
    mkdirSync(join(repo, "quality-reports"), { recursive: true });
    writeFileSync(join(repo, "quality-reports", "final-test-1.json"), JSON.stringify({
      schema: "setfarm.final-test.v1",
      status: "done",
      routesTested: 1,
      interactionsTested: 0,
      issueCount: 0,
    }));

    await assert.rejects(
      finalTestModule.onComplete!({
        runId: "r1",
        stepId: "final-test",
        context: { repo },
        parsed: {
          status: "done",
          smoke_test_result: "pass",
          final_test_json: "quality-reports/final-test-1.json",
        },
      }),
      /FINAL_TEST_AUDIT: STATUS done requires FINAL_TEST_JSON interactionsTested > 0/,
    );
  });
});
