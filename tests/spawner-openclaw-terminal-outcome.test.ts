import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf8");

describe("spawner OpenClaw terminal ownership", () => {
  it("reads the JSON terminal envelope before treating process code zero as completion", () => {
    const exitStart = source.indexOf('child.once("exit"');
    const exitEnd = source.indexOf("if (child.pid && claim.runId", exitStart);
    assert.notEqual(exitStart, -1);
    assert.notEqual(exitEnd, -1);
    const exitHandler = source.slice(exitStart, exitEnd);
    assert.match(exitHandler, /readOpenClawAgentTerminalOutcome\(transcriptPath\)/);
    assert.ok(
      exitHandler.indexOf("readOpenClawAgentTerminalOutcome") < exitHandler.indexOf("code === 0"),
      "machine-readable terminal status must be evaluated before process code zero",
    );
    assert.match(exitHandler, /new OpenClawAgentTerminalError\(openClawTerminalOutcome\)/);
  });

  it("routes typed retryable transport outcomes to the infra owner without a prose regex", () => {
    const settleStart = source.indexOf("async function failClaimIfStillRunning");
    const settleEnd = source.indexOf("async function settleExitedClaimAndRuntime", settleStart);
    assert.notEqual(settleStart, -1);
    assert.notEqual(settleEnd, -1);
    const settle = source.slice(settleStart, settleEnd);
    assert.match(settle, /err instanceof OpenClawAgentTerminalError/);
    assert.match(settle, /openClawTerminalFailure\?\.retryable/);
    assert.match(settle, /retryActiveSingleStepClaim\(active, row\.step_id, reason\)/);
    assert.match(settle, /requeueOpenStoryClaim/);
    assert.doesNotMatch(settle, /OPENCLAW_AGENT_TIMEOUT.*includes|includes.*OPENCLAW_AGENT_TIMEOUT/);
  });
});
