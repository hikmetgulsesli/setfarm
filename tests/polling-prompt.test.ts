import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPollingPrompt } from "../dist/installer/agent-cron.js";

describe("buildPollingPrompt", () => {
  it("contains the step claim command with correct agent id", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes('step claim "feature-dev_developer"'));
  });

  it("instructs to reply HEARTBEAT_OK on NO_WORK", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("HEARTBEAT_OK"));
    assert.ok(prompt.includes("NO_WORK"));
  });

  it("does NOT contain workspace/AGENTS.md/SOUL.md content", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(!prompt.includes("AGENTS.md"));
    assert.ok(!prompt.includes("SOUL.md"));
  });

  it("works with different workflow/agent ids", () => {
    const prompt = buildPollingPrompt("bug-fix", "fixer");
    assert.ok(prompt.includes('step claim "bug-fix_fixer"'));
  });

  it("includes step peek command", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("step peek"), "should include step peek");
  });

  it("instructs to stop on NO_WORK from peek without running claim", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("NO_WORK"), "should mention NO_WORK");
    assert.ok(prompt.includes("HEARTBEAT_OK"), "should instruct HEARTBEAT_OK");
  });

  it("includes step complete and step fail instructions", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("step complete"), "should include step complete");
    assert.ok(prompt.includes("step fail"), "should include step fail");
  });

  it("mentions stepId for claim output", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("stepId"), "should mention stepId");
  });

  it("forbids running sessions_spawn", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("sessions_spawn"), "should mention sessions_spawn in NEVER rules");
  });

  it("is under 5000 chars", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.length < 5000, `Prompt too long: ${prompt.length} chars`);
  });
});
