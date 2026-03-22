import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPollingPrompt } from "../dist/installer/agent-cron.js";

describe("buildPollingPrompt", () => {
  it("contains step complete instructions", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("step complete"));
  });

  it("contains step fail instructions", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("step fail"));
  });

  it("contains step claim command", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("step claim"));
  });

  it("includes polling signals", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("HEARTBEAT_OK"));
    assert.ok(prompt.includes("NO_WORK"));
  });

  it("works with different workflow/agent ids without errors", () => {
    const p1 = buildPollingPrompt("security-audit", "scanner");
    const p2 = buildPollingPrompt("bug-fix", "fixer");
    assert.ok(p1.includes("step complete"));
    assert.ok(p2.includes("step complete"));
    assert.ok(p1.includes("step claim"));
    assert.ok(p2.includes("step claim"));
  });
});
