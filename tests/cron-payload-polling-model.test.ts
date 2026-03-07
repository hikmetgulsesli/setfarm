import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPollingPrompt } from "../dist/installer/agent-cron.js";

describe("cron payload includes polling model (regression #121)", () => {
  it("buildPollingPrompt returns a non-empty string", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.length > 100, "prompt should be substantial");
  });

  it("prompt includes correct agent id", () => {
    const prompt = buildPollingPrompt("feature-dev", "developer");
    assert.ok(prompt.includes("feature-dev_developer"));
  });

  it("prompt works for different workflows", () => {
    const p1 = buildPollingPrompt("bug-fix", "fixer");
    const p2 = buildPollingPrompt("security-audit", "scanner");
    assert.ok(p1.includes("bug-fix_fixer"));
    assert.ok(p2.includes("security-audit_scanner"));
  });
});
