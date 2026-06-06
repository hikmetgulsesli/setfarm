import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { qaTestModule } from "../../dist/installer/steps/09-qa-test/module.js";
import { normalize, validateOutput } from "../../dist/installer/steps/09-qa-test/guards.js";
import { classifyQaSystemSmokeResult } from "../../dist/installer/steps/09-qa-test/preclaim.js";
import type { ParsedOutput } from "../../dist/installer/steps/types.js";

const sourcePrompt = readFileSync(resolve(import.meta.dirname, "../../src/installer/steps/09-qa-test/prompt.md"), "utf-8");
const sourcePreclaim = readFileSync(resolve(import.meta.dirname, "../../src/installer/steps/09-qa-test/preclaim.ts"), "utf-8");
const sourceStepOps = readFileSync(resolve(import.meta.dirname, "../../src/installer/step-ops.ts"), "utf-8");

describe("09-qa-test step module", () => {
  it("module metadata is correct", () => {
    assert.equal(qaTestModule.id, "qa-test");
    assert.equal(qaTestModule.type, "single");
    assert.equal(qaTestModule.agentRole, "qa-tester");
    assert.equal(typeof qaTestModule.preClaim, "function");
    assert.equal(typeof qaTestModule.onComplete, "function");
    assert.equal(qaTestModule.maxPromptSize, 12288);
    assert.deepEqual(qaTestModule.requiredOutputFields, ["STATUS"]);
  });

  it("injectContext adds stack evidence context", async () => {
    const context: Record<string, string> = { foo: "bar" };
    await qaTestModule.injectContext({ runId: "r1", stepId: "qa-test", task: "t", context });
    assert.equal(context.foo, "bar");
    assert.equal(context.stack_pack_id, "needs-reconcile");
    assert.match(context.stack_contract, /Schema: setfarm\.stack-contract\.v1/);
    assert.match(context.stack_verification_contract, /no stack-specific verification/i);
  });

  it("buildPrompt substitutes REPO/BRANCH/STORIES_JSON/FINAL_PR", () => {
    const prompt = qaTestModule.buildPrompt({
      runId: "r1",
      task: "t",
      context: {
        repo: "$HOME/projects/app",
        branch: "feature-app",
        stories_json: '[{"id":"US-001"}]',
        pr_url: "https://github.com/u/r/pull/9",
      },
    });
    assert.ok(prompt.includes("$HOME/projects/app"));
    assert.ok(prompt.includes("feature-app"));
    assert.ok(prompt.includes("pull/9"));
    assert.ok(prompt.includes("happy path"));
    assert.ok(prompt.includes("quality-reports/qa-test-1.md"));
    assert.ok(prompt.includes("quality-reports/qa-test-1.json"));
    assert.ok(prompt.includes("QA_JSON"));
    assert.ok(prompt.includes("Route/link traversal"));
    assert.ok(prompt.includes("Rules"));
  });

  it("buildPrompt within maxPromptSize", () => {
    const prompt = qaTestModule.buildPrompt({ runId: "r1", task: "t", context: { repo: "$HOME/x" } });
    assert.ok(Buffer.byteLength(prompt, "utf-8") < qaTestModule.maxPromptSize);
  });

  it("QA server lifecycle avoids fixed local ports and wrong-app evidence", () => {
    assert.doesNotMatch(sourcePrompt, /\b5173\b/);
    assert.match(sourcePrompt, /collision-free port/i);
    assert.match(sourcePrompt, /--strictPort/);
    assert.match(sourcePrompt, /Mission Control, Setfarm, another local dashboard/i);
    assert.match(sourcePrompt, /Do not report wrong-app evidence as a product QA failure/i);
  });

  it("QA preclaim persists runtime URL artifact for Mission Control visibility", () => {
    assert.match(sourcePreclaim, /writeRunRuntimeArtifact/);
    assert.match(sourcePreclaim, /run_runtime_json/);
    assert.match(sourcePreclaim, /artifactPath/);
  });

  it("QA preclaim resolves smoke-test from the active platform build", () => {
    assert.match(sourcePreclaim, /resolvePlatformScript\("smoke-test\.mjs"\)/);
    assert.doesNotMatch(sourcePreclaim, /\.openclaw["',\s]+["']setfarm-repo["',\s]+["']scripts["',\s]+["']smoke-test\.mjs/);
  });

  it("QA preclaim rebuilds before browser smoke so dist artifacts are fresh", () => {
    assert.match(sourcePreclaim, /ensureSmokeBuildFresh\(repo/);
    assert.match(sourcePreclaim, /qa-smoke-prebuild/);
  });

  it("QA prompt overrides external browser examples with lifecycle URLs", () => {
    assert.match(sourcePrompt, /Setfarm\s+lifecycle\s+is\s+authoritative/i);
    assert.match(sourcePrompt, /DEV_SERVER_URL/);
    assert.match(sourcePrompt, /QA_URL/);
    assert.match(sourcePrompt, /Do not run\s+`agent-browser skills get \.\.\.`/);
    assert.match(sourcePrompt, /Some installed CLI versions do not provide that subcommand/);
    assert.match(sourcePrompt, /do not import `expect` from\s+`playwright`/i);
    assert.match(sourcePrompt, /recreate it from\s+scratch/i);
  });

  it("validateOutput rejects missing STATUS", () => {
    assert.equal(validateOutput({} as ParsedOutput).ok, false);
  });

  it("validateOutput rejects STATUS: done without QA evidence", () => {
    const r = validateOutput({ status: "done" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("QA_REPORT")));
  });

  it("validateOutput accepts STATUS: done with QA evidence", () => {
    assert.equal(validateOutput({
      status: "done",
      qa_report: "quality-reports/qa-test-1.md",
      qa_json: "quality-reports/qa-test-1.json",
      qa_screens_tested: "4",
      qa_routes_tested: "3",
      qa_interactions_tested: "12",
      qa_total_issues: "0",
    } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects done with zero interactions", () => {
    const r = validateOutput({
      status: "done",
      qa_report: "quality-reports/qa-test-1.md",
      qa_json: "quality-reports/qa-test-1.json",
      qa_screens_tested: "4",
      qa_routes_tested: "3",
      qa_interactions_tested: "0",
      qa_total_issues: "0",
    } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("QA_INTERACTIONS_TESTED")));
  });

  it("system smoke classification routes zero-interaction pass to retry", () => {
    const decision = classifyQaSystemSmokeResult({
      status: "pass",
      routesDiscovered: 1,
      buttonsChecked: 0,
      formsChecked: 0,
      failures: [],
    }, JSON.stringify({ status: "pass" }), false);

    assert.equal(decision.status, "retry");
    assert.equal(decision.interactionsTested, 0);
    assert.equal(decision.issueCount, 1);
    assert.match(decision.result.failures.join("\n"), /no interaction evidence/i);
  });

  it("system smoke classification counts browser-game flow evidence as interaction", () => {
    const decision = classifyQaSystemSmokeResult({
      status: "pass",
      routesDiscovered: 1,
      buttonsChecked: 0,
      formsChecked: 0,
      flowsChecked: 1,
      failures: [],
    }, JSON.stringify({ status: "pass" }), false);

    assert.equal(decision.status, "done");
    assert.equal(decision.interactionsTested, 1);
    assert.equal(decision.issueCount, 0);
  });

  it("system smoke classification rejects unstructured successful output", () => {
    const decision = classifyQaSystemSmokeResult(null, "loaded ok", false);

    assert.equal(decision.status, "retry");
    assert.equal(decision.issueCount, 1);
    assert.match(decision.result.failures.join("\n"), /structured JSON/);
  });

  it("routes unstructured system smoke output as infrastructure retry instead of QA-FIX", () => {
    assert.match(sourceStepOps, /SMOKE_INFRA_FAILURE\s*=\s*\/[\s\S]*structured JSON/);

    const retryBranchStart = sourceStepOps.indexOf('if (statusVal === "retry")');
    const retryBranchEnd = sourceStepOps.indexOf('if (statusVal && statusVal !== "done"', retryBranchStart);
    assert.notEqual(retryBranchStart, -1);
    assert.notEqual(retryBranchEnd, -1);

    const retryBranch = sourceStepOps.slice(retryBranchStart, retryBranchEnd);
    assert.ok(
      retryBranch.indexOf("isSmokeInfrastructureFailure(output)") < retryBranch.indexOf("routeQualityFailureToImplement"),
      "smoke infrastructure failures must retry the QA/final/verify step before QA-FIX routing",
    );
  });

  it("validateOutput rejects done with positive issue count", () => {
    const r = validateOutput({
      status: "done",
      qa_report: "quality-reports/qa-test-1.md",
      qa_json: "quality-reports/qa-test-1.json",
      qa_screens_tested: "4",
      qa_routes_tested: "3",
      qa_interactions_tested: "12",
      qa_total_issues: "1",
    } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("QA_TOTAL_ISSUES")));
  });

  it("validateOutput requires skip reason", () => {
    assert.equal(validateOutput({ status: "skip" } as ParsedOutput).ok, false);
    assert.equal(validateOutput({ status: "skip", skip_reason: "Not a browser app" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects retry without batched findings", () => {
    const r = validateOutput({ status: "retry" } as ParsedOutput);
    assert.equal(r.ok, false);
    assert.ok(r.errors.some(e => e.includes("batched QA findings")));
  });

  it("validateOutput accepts retry with batched findings", () => {
    assert.equal(validateOutput({ status: "retry", qa_report: "quality-reports/qa-test-1.md", qa_json: "quality-reports/qa-test-1.json", test_failures: "x" } as ParsedOutput).ok, true);
    assert.equal(validateOutput({ status: "retry", qa_report_path: "quality-reports/qa-test-1.md", qa_json_path: "quality-reports/qa-test-1.json", issues: "x", qa_total_issues: "2" } as ParsedOutput).ok, true);
  });

  it("validateOutput rejects unknown STATUS", () => {
    assert.equal(validateOutput({ status: "tested" } as ParsedOutput).ok, false);
  });

  it("normalize first-word lowercase", () => {
    const parsed = { status: "RETRY\ntest_failures: counter broken" } as ParsedOutput;
    normalize(parsed);
    assert.equal(parsed["status"], "retry");
  });

  it("onComplete rejects shallow STATUS: done reports without required QA evidence sections", async () => {
    const repo = mkdtempSync(join(tmpdir(), "setfarm-qa-report-"));
    mkdirSync(join(repo, "quality-reports"), { recursive: true });
    writeFileSync(join(repo, "quality-reports", "qa-test-1.md"), [
      "# QA Test Report",
      "",
      "## Scope",
      "- App loaded.",
      "",
      "## Issues",
      "No blocking QA issues found.",
      "",
    ].join("\n"));
    writeFileSync(join(repo, "quality-reports", "qa-test-1.json"), JSON.stringify({ schema: "setfarm.qa-report.v1" }));

    await assert.rejects(
      qaTestModule.onComplete!({
        runId: "r1",
        stepId: "qa-test",
        context: { repo },
        parsed: {
          status: "done",
          qa_report: "quality-reports/qa-test-1.md",
          qa_json: "quality-reports/qa-test-1.json",
          qa_screens_tested: "4",
          qa_routes_tested: "4",
          qa_interactions_tested: "12",
          qa_total_issues: "0",
        },
      }),
      /QA_REPORT_AUDIT: .*Summary.*Environment.*Screenshots/s,
    );
  });

  it("onComplete accepts a concrete STATUS: done report with screenshots and interaction evidence", async () => {
    const repo = mkdtempSync(join(tmpdir(), "setfarm-qa-report-"));
    mkdirSync(join(repo, "quality-reports"), { recursive: true });
    writeFileSync(join(repo, "quality-reports", "qa-test-1.md"), [
      "# QA Test Report",
      "",
      "## Summary",
      "- Decision: pass.",
      "## Environment",
      "- Commit: abc123",
      "## Routes Tested",
      "- /: loaded",
      "## Interactions Tested",
      "- button Create Return: opened editor",
      "## Screenshots",
      "- desktop: quality-reports/desktop.png",
      "- mobile: quality-reports/mobile.png",
      "## Console",
      "- No warnings/errors.",
      "## Visual/Layout Findings",
      "- None.",
      "## Functional Findings",
      "- None.",
      "## Semantic/Test Findings",
      "- None.",
      "## Batch Fix Plan",
      "- None.",
      "",
    ].join("\n"));
    writeFileSync(join(repo, "quality-reports", "qa-test-1.json"), JSON.stringify({ schema: "setfarm.qa-report.v1" }));

    await qaTestModule.onComplete!({
      runId: "r1",
      stepId: "qa-test",
      context: { repo },
      parsed: {
        status: "done",
        qa_report: "quality-reports/qa-test-1.md",
        qa_json: "quality-reports/qa-test-1.json",
        qa_screens_tested: "4",
        qa_routes_tested: "4",
        qa_interactions_tested: "12",
        qa_total_issues: "0",
      },
    });
  });
});
