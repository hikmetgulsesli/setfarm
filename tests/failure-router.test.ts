import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { readQaFixEnabled, routeDownstreamQualityFailure } from "../src/installer/failure-router.js";

const ENV_KEYS = ["SETFARM_QA_FIX_ENABLED"];
const savedEnv = new Map<string, string | undefined>();

describe("failure router", () => {
  beforeEach(() => {
    savedEnv.clear();
    for (const key of ENV_KEYS) {
      savedEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of savedEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("keeps QA-FIX disabled by default", () => {
    assert.equal(readQaFixEnabled(), false);
    const decision = routeDownstreamQualityFailure({
      runId: "run-1",
      stepId: "qa-test",
      currentStoryId: "US-001",
      failure: "QA_JSON says a button did not respond after browser interaction.",
      hasMachineEvidence: true,
    });

    assert.equal(decision.qaFixAllowed, false);
    assert.equal(decision.policy, "qa_fix_disabled");
    assert.equal(decision.action, "re_claim");
  });

  it("routes infrastructure and design import failures to platform bugs", () => {
    const infra = routeDownstreamQualityFailure({
      runId: "run-1",
      stepId: "qa-test",
      failure: "playwright chromium timed out with ECONNREFUSED",
      hasMachineEvidence: true,
    });
    assert.equal(infra.action, "platform_bug");
    assert.equal(infra.category, "browser_infra_failure");

    const design = routeDownstreamQualityFailure({
      runId: "run-1",
      stepId: "setup-build",
      failure: "generated-screen-validator failed SCREEN_MAP coverage",
      hasMachineEvidence: true,
    });
    assert.equal(design.action, "platform_bug");
    assert.equal(design.category, "design_import_failure");
  });

  it("only allows bounded QA-FIX when explicitly enabled and evidence-backed", () => {
    process.env.SETFARM_QA_FIX_ENABLED = "1";
    const allowed = routeDownstreamQualityFailure({
      runId: "run-1",
      stepId: "qa-test",
      failure: "QA_JSON evidence shows interaction failed.",
      hasMachineEvidence: true,
      existingRepairCount: 0,
      repeatedFailureCount: 1,
    });
    assert.equal(allowed.qaFixAllowed, true);
    assert.equal(allowed.action, "link_story");

    const blocked = routeDownstreamQualityFailure({
      runId: "run-1",
      stepId: "qa-test",
      failure: "QA agent prose says button is broken.",
      hasMachineEvidence: false,
      existingRepairCount: 0,
      repeatedFailureCount: 1,
    });
    assert.equal(blocked.qaFixAllowed, false);
    assert.equal(blocked.action, "platform_bug");
  });
});
