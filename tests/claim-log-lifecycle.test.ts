import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = path.resolve(import.meta.dirname, "..");

function claimSingleStepSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function claimSingleStep(");
  const end = source.indexOf("// ── End extracted helpers", start);
  assert.notEqual(start, -1, "claimSingleStep source not found");
  assert.notEqual(end, -1, "claimSingleStep end marker not found");
  return source.slice(start, end);
}

function handleVerifyEachSource(): string {
  const source = fs.readFileSync(path.join(root, "src", "installer", "step-ops.ts"), "utf-8");
  const start = source.indexOf("async function handleVerifyEachCompletion(");
  const end = source.indexOf("async function autoVerifyDoneStories(", start);
  assert.notEqual(start, -1, "handleVerifyEachCompletion source not found");
  assert.notEqual(end, -1, "handleVerifyEachCompletion end marker not found");
  return source.slice(start, end);
}

describe("single-step claim_log lifecycle", () => {
  it("records single-step handoff observability only after defer gates pass", () => {
    const source = claimSingleStepSource();
    const claimInsert = source.indexOf("INSERT INTO claim_log");
    const transitionRecord = source.indexOf("recordStepTransition(step.id, step.run_id, \"pending\", \"running\"");
    const runningEvent = source.indexOf("event: \"step.running\"");
    const verifyContextGate = source.indexOf("injectVerifyContext");
    const reviewDelayGate = source.indexOf("PR REVIEW DELAY GATE");
    const modulePreClaimGate = source.indexOf("preClaim changed step status");
    const missingInputGate = source.indexOf("MISSING_INPUT_GUARD");
    const handoffReturn = source.indexOf("return {\n    found: true");

    assert.ok(claimInsert > verifyContextGate, "claim_log insert must run after verify auto/defer gate");
    assert.ok(claimInsert > reviewDelayGate, "claim_log insert must run after PR review delay gate");
    assert.ok(claimInsert > modulePreClaimGate, "claim_log insert must run after module preClaim no-spawn gate");
    assert.ok(claimInsert > missingInputGate, "claim_log insert must run after missing-input no-spawn gate");
    assert.ok(claimInsert < handoffReturn, "claim_log insert must run before handoff return");
    assert.ok(transitionRecord > missingInputGate, "step transition must run only after no-spawn gates pass");
    assert.ok(transitionRecord < handoffReturn, "step transition must run before handoff return");
    assert.ok(runningEvent > missingInputGate, "step.running event must run only after no-spawn gates pass");
    assert.ok(runningEvent < handoffReturn, "step.running event must run before handoff return");
    assert.doesNotMatch(source.slice(0, missingInputGate), /INSERT INTO claim_log/);
    assert.doesNotMatch(source.slice(0, missingInputGate), /event: "step\.running"/);
  });

  it("does not duplicate idempotent running single-step claims", () => {
    const source = claimSingleStepSource();
    assert.match(source, /let shouldRecordSingleStepClaim = false/);
    assert.match(source, /SELECT id FROM claim_log WHERE run_id = \$1 AND step_id = \$2 AND story_id IS NULL AND agent_id = \$3 AND outcome IS NULL LIMIT 1/);
    assert.match(source, /Requeued orphaned running step/);
    assert.match(source, /NOT EXISTS \(\s*SELECT 1 FROM claim_log/);
    assert.match(source, /return \{ found: false \}/);
    assert.doesNotMatch(source, /shouldRecordSingleStepClaim = !existingOpenClaim/);
    assert.match(source, /shouldRecordSingleStepClaim = true/);
  });

  it("resolves verify_each single-step claims when verify output is accepted", () => {
    const source = handleVerifyEachSource();
    const acceptedOutputGuard = source.indexOf("UPDATE steps SET status = 'waiting'");
    const duplicateGuard = source.indexOf("if (_pgChanged.changes === 0)");
    const claimUpdate = source.indexOf("UPDATE claim_log SET outcome = 'completed'");
    const retryBranch = source.indexOf("if (status === \"retry\")");
    const passedBranch = source.indexOf("// Verify PASSED");

    assert.ok(claimUpdate > acceptedOutputGuard, "claim_log must close after verify output atomically transitions the step");
    assert.ok(claimUpdate > duplicateGuard, "claim_log must not close on duplicate/late verify completions");
    assert.ok(claimUpdate < retryBranch, "claim_log must close before retry branch returns");
    assert.ok(claimUpdate < passedBranch, "claim_log must close before passed branch returns");
    assert.match(source, /WHERE run_id = \$1 AND step_id = \$2 AND story_id IS NULL AND outcome IS NULL/);
  });

  it("closes single-step failure claims by workflow step id, not step UUID", () => {
    const source = fs.readFileSync(path.join(root, "src", "installer", "step-fail.ts"), "utf-8");
    const singleFailureStart = source.indexOf("async function handleSingleStepFailurePG(");
    const singleFailureEnd = source.indexOf("// Post-transaction side effects", singleFailureStart);
    assert.notEqual(singleFailureStart, -1, "handleSingleStepFailurePG source not found");
    assert.notEqual(singleFailureEnd, -1, "handleSingleStepFailurePG transaction block not found");
    const singleFailureSource = source.slice(singleFailureStart, singleFailureEnd);

    assert.match(singleFailureSource, /const workflowStepId = stepRow\?\.step_id \|\| ""/);
    assert.match(singleFailureSource, /step_id = \$\{workflowStepId\}/);
    assert.doesNotMatch(singleFailureSource, /claim_log[\s\S]*step_id = \$\{stepId\}/);
  });
});
