import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPollingPrompt } from "../dist/installer/agent-cron.js";

describe("two-phase-cron-setup", () => {
  describe("buildPollingPrompt output", () => {
    it("includes sessions_spawn in NEVER rules", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.includes("sessions_spawn"), "should mention sessions_spawn");
    });

    it("includes step peek and claim commands", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.includes("step peek"), "should include peek");
      assert.ok(prompt.includes("step claim"), "should include claim");
    });

    it("includes step complete and fail commands", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.includes("step complete"));
      assert.ok(prompt.includes("step fail"));
    });

    it("still includes HEARTBEAT_OK for NO_WORK", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.includes("HEARTBEAT_OK"));
    });

    it("remains under 5000 chars", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.length < 5000, `Prompt too long: ${prompt.length} chars`);
    });
  });

  describe("setupAgentCrons config resolution", () => {
    it("polling prompt uses correct agent id format", () => {
      const prompt = buildPollingPrompt("security-audit", "scanner");
      assert.ok(prompt.includes("security-audit_scanner"));
    });
  });
});
