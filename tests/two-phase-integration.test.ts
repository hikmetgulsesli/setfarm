import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPollingPrompt } from "../dist/installer/agent-cron.js";

describe("two-phase-integration", () => {
  describe("polling config creates correct prompt structure", () => {
    it("polling prompt includes peek-claim-work-complete flow", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.includes("step peek"), "has peek");
      assert.ok(prompt.includes("step claim"), "has claim");
      assert.ok(prompt.includes("step complete"), "has complete");
      assert.ok(prompt.includes("step fail"), "has fail");
    });

    it("polling prompt includes HEARTBEAT_OK stop signal", () => {
      const prompt = buildPollingPrompt("feature-dev", "developer");
      assert.ok(prompt.includes("HEARTBEAT_OK"));
    });
  });

  describe("defaults without polling config", () => {
    it("builds prompt with correct agent id regardless", () => {
      const prompt = buildPollingPrompt("test-wf", "test-agent");
      assert.ok(prompt.includes('step claim "test-wf_test-agent"'));
    });
  });
});
