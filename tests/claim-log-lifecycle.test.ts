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

describe("single-step claim_log lifecycle", () => {
  it("records a claim only after single-step defer gates pass", () => {
    const source = claimSingleStepSource();
    const claimInsert = source.indexOf("INSERT INTO claim_log");
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
    assert.doesNotMatch(source.slice(0, missingInputGate), /INSERT INTO claim_log/);
  });

  it("does not duplicate idempotent running single-step claims", () => {
    const source = claimSingleStepSource();
    assert.match(source, /let shouldRecordSingleStepClaim = false/);
    assert.match(source, /SELECT id FROM claim_log WHERE run_id = \$1 AND step_id = \$2 AND story_id IS NULL AND agent_id = \$3 AND outcome IS NULL LIMIT 1/);
    assert.match(source, /shouldRecordSingleStepClaim = !existingOpenClaim/);
    assert.match(source, /shouldRecordSingleStepClaim = true/);
  });
});
