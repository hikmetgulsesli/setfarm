import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const stepOps = readFileSync(path.join(root, "src/installer/step-ops.ts"), "utf8");
const stepFail = readFileSync(path.join(root, "src/installer/step-fail.ts"), "utf8");
const recorder = readFileSync(path.join(root, "src/execution/shadow-attempt-recorder.ts"), "utf8");

describe("shadow runtime hook boundaries", () => {
  it("observes claim only after worktree, actual branch, claim log, and claim metadata", () => {
    const worktree = stepOps.indexOf("const storyWorkdir = createStoryWorktree");
    const actualBranch = stepOps.indexOf('execFileSync("git", ["branch", "--show-current"]', worktree);
    const claimLog = stepOps.indexOf('INSERT INTO claim_log (run_id, step_id, story_id, agent_id, claimed_at)', actualBranch);
    const claimMetadata = stepOps.indexOf('UPDATE stories SET claimed_at = $1, claimed_by = $2', claimLog);
    const hook = stepOps.indexOf("await observeShadowAttemptClaim({", claimMetadata);
    const resolvedInput = stepOps.indexOf("const resolvedInput = await resolveLoopClaimInput", claimMetadata);
    const handoff = stepOps.indexOf("return { found: true, stepId: step.id", resolvedInput);
    assert.ok(worktree >= 0 && actualBranch > worktree && claimLog > actualBranch && claimMetadata > claimLog);
    assert.ok(hook > claimMetadata, "shadow claim must follow established legacy identity");
    assert.ok(hook > resolvedInput && hook < handoff, "source-before must capture the final agent-visible worktree");
  });

  it("observes successful source after story status and before claim-log close", () => {
    const storyUpdate = stepOps.indexOf('UPDATE stories SET status = $1, output = $2, pr_url = $3');
    const hook = stepOps.indexOf("await observeShadowAttemptSuccess({", storyUpdate);
    const claimClose = stepOps.indexOf("UPDATE claim_log SET outcome = 'completed'", storyUpdate);
    assert.ok(storyUpdate >= 0 && hook > storyUpdate && claimClose > hook);
  });

  it("prepares failure before cleanup and finalizes every loop return after state transactions", () => {
    const start = stepFail.indexOf("async function handleLoopStepFailurePG(");
    const end = stepFail.indexOf("// ── Single step failure", start);
    const block = stepFail.slice(start, end);
    const prepare = block.indexOf("await prepareShadowAttemptFailure({");
    const firstStoryRead = block.indexOf("const story = await pgGet");
    const cleanup = block.indexOf("await cleanupProjectEphemera");
    assert.ok(prepare >= 0 && prepare < firstStoryRead && prepare < cleanup);
    assert.equal((block.match(/await finalizeShadowAttemptFailure\(/g) || []).length, 3);
    assert.equal((block.match(/return \{ retrying:/g) || []).length, 3);
  });

  it("keeps classifiers, supervisor, and prompt parsing out of the recorder", () => {
    assert.doesNotMatch(recorder, /pr-comment|product-supervisor|supervisor\/|parseOutputKeyValues|GitHub/i);
    assert.doesNotMatch(recorder, /spawner(?:-prompt)?\.js/);
    assert.doesNotMatch(recorder, /await db\.pgMigrate\(/);
  });
});
