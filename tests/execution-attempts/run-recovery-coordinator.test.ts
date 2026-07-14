import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRunRecoveryCoordinator } from "../../src/execution/run-recovery-coordinator.js";
import {
  processRunTerminationBatch,
  type RunTerminationRequest,
} from "../../src/execution/run-termination.js";

function drainedTermination(requestId: string, runId: string): RunTerminationRequest {
  const timestamp = "2026-07-13T12:00:00.000Z";
  return {
    requestId,
    runId,
    targetStatus: "failed",
    state: "drained",
    requestedBy: "test",
    requestedAt: timestamp,
    drainedAt: timestamp,
    diagnostic: `terminate ${runId}`,
    evidence: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("unified run recovery coordinator", () => {
  it("always gives termination the first lifecycle ownership attempt", async () => {
    const calls: string[] = [];
    const coordinator = createRunRecoveryCoordinator({
      processTerminations: async () => { calls.push("termination"); return 0; },
      processCompletions: async () => { calls.push("completion"); return 0; },
      processOutbox: async () => { calls.push("outbox"); return 0; },
    });
    await coordinator.signal("startup");
    assert.deepEqual(calls, ["termination", "completion", "outbox"]);
  });

  it("coalesces concurrent signals and drains work until both queues are empty", async () => {
    const calls: string[] = [];
    let terminationBatches = 2;
    let completionBatches = 1;
    let outboxBatches = 1;
    let releaseFirstTermination!: () => void;
    const firstTermination = new Promise<void>((resolve) => { releaseFirstTermination = resolve; });
    let first = true;
    const coordinator = createRunRecoveryCoordinator({
      processTerminations: async () => {
        calls.push("termination");
        if (first) {
          first = false;
          await firstTermination;
        }
        if (terminationBatches > 0) {
          terminationBatches -= 1;
          return 1;
        }
        return 0;
      },
      processCompletions: async () => {
        calls.push("completion");
        if (completionBatches > 0) {
          completionBatches -= 1;
          return 1;
        }
        return 0;
      },
      processOutbox: async () => {
        calls.push("outbox");
        if (outboxBatches > 0) {
          outboxBatches -= 1;
          return 1;
        }
        return 0;
      },
    });
    const firstSignal = coordinator.signal("notify-a");
    const secondSignal = coordinator.signal("notify-b");
    assert.equal(coordinator.isRunning(), true);
    releaseFirstTermination();
    await Promise.all([firstSignal, secondSignal]);
    assert.equal(terminationBatches, 0);
    assert.equal(completionBatches, 0);
    assert.equal(outboxBatches, 0);
    assert.deepEqual(calls.slice(0, 3), ["termination", "completion", "outbox"]);
    assert.ok(calls.length >= 9, "coordinator must observe an empty cycle before yielding");
  });

  it("joins active work and rejects new ownership after close", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const coordinator = createRunRecoveryCoordinator({
      processTerminations: async () => { await blocked; return 0; },
      processCompletions: async () => 0,
    });
    void coordinator.signal("shutdown-race");
    const closing = coordinator.close();
    release();
    await closing;
    await assert.rejects(coordinator.signal("late"), /RUN_RECOVERY_COORDINATOR_CLOSED/);
  });

  it("quarantines one poison drained request without blocking healthy termination, completion, or outbox", async () => {
    const poison = drainedTermination("RTR_poison-drained-0001", "run-poison");
    const healthy = drainedTermination("RTR_healthy-drained-001", "run-healthy");
    const terminalized: string[] = [];
    const quarantined: string[] = [];
    const lifecycle: string[] = [];
    let pending = [poison, healthy] as RunTerminationRequest[];
    const coordinator = createRunRecoveryCoordinator({
      processTerminations: async () => {
        lifecycle.push("termination");
        const candidates = pending;
        pending = [];
        return processRunTerminationBatch({
          candidates,
          async process(candidate) {
            if (candidate.requestId === poison.requestId) throw new Error("poison terminal transition");
            terminalized.push(candidate.requestId);
            return "processed";
          },
          async quarantine(candidate) {
            quarantined.push(candidate.requestId);
          },
        });
      },
      processCompletions: async () => {
        lifecycle.push("completion");
        return 0;
      },
      processOutbox: async () => {
        lifecycle.push("outbox");
        return 0;
      },
    });

    await coordinator.signal("poison-drained-test");
    assert.deepEqual(quarantined, [poison.requestId]);
    assert.deepEqual(terminalized, [healthy.requestId]);
    assert.ok(lifecycle.includes("completion"));
    assert.ok(lifecycle.includes("outbox"));
  });
});
