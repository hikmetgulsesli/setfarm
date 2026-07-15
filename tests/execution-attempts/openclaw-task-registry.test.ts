import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyOpenClawTaskRegistryRows,
  type OpenClawTaskRegistryRow,
} from "../../src/execution/openclaw-task-registry.js";

const SESSION = "agent:feature-dev_planner:explicit:spawner-exact";

function row(overrides: Partial<OpenClawTaskRegistryRow> = {}): OpenClawTaskRegistryRow {
  return {
    taskId: "task-exact",
    status: "running",
    error: null,
    endedAt: null,
    requesterSessionKey: SESSION,
    ownerKey: SESSION,
    childSessionKey: SESSION,
    ...overrides,
  };
}

describe("OpenClaw exact task-registry projection", () => {
  it("does not infer terminal state from unrelated or still-running tasks", () => {
    assert.deepEqual(classifyOpenClawTaskRegistryRows([
      row({ requesterSessionKey: "other", ownerKey: "other", childSessionKey: "other" }),
    ], SESSION, 10_000, 5_000), { kind: "absent" });
    assert.deepEqual(classifyOpenClawTaskRegistryRows([
      row(),
    ], SESSION, 10_000, 5_000), {
      kind: "active",
      taskId: "task-exact",
      status: "running",
    });
  });

  it("waits for the terminal row to settle before publishing authority", () => {
    assert.deepEqual(classifyOpenClawTaskRegistryRows([
      row({ status: "failed", error: "LLM request timed out.", endedAt: 8_000 }),
    ], SESSION, 10_000, 5_000), {
      kind: "settling",
      taskId: "task-exact",
      status: "failed",
      endedAt: 8_000,
    });
    assert.deepEqual(classifyOpenClawTaskRegistryRows([
      row({ status: "failed", error: "LLM request timed out.", endedAt: 8_000 }),
    ], SESSION, 13_000, 5_000), {
      kind: "terminal",
      task: {
        taskId: "task-exact",
        status: "failed",
        error: "LLM request timed out.",
        endedAt: 8_000,
      },
    });
  });

  it("fails closed when an exact session resolves multiple task owners", () => {
    assert.deepEqual(classifyOpenClawTaskRegistryRows([
      row({ taskId: "task-a" }),
      row({ taskId: "task-b", status: "failed", endedAt: 1 }),
    ], SESSION, 10_000, 5_000), {
      kind: "ambiguous",
      taskIds: ["task-a", "task-b"],
    });
  });

  it("keeps unsupported registry states non-authoritative", () => {
    const result = classifyOpenClawTaskRegistryRows([
      row({ status: "provider-paused" }),
    ], SESSION, 10_000, 5_000);
    assert.equal(result.kind, "unavailable");
    if (result.kind !== "unavailable") assert.fail("expected unavailable projection");
    assert.equal(result.code, "OPENCLAW_TASK_REGISTRY_STATUS_UNSUPPORTED");
  });
});
