import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { V3RecoveryCoordinatorResult } from "../../src/recovery/v3-recovery-coordinator.js";

process.env.SETFARM_AGENT_RUNTIME ||= "codex";
const { executeV3RecoveryRuntimeCompletionEffect } = await import("../../src/spawner.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EVIDENCE_BUNDLE_HASH = "a".repeat(64);
const RECOVERY_CASE_ID = `RCV_${"b".repeat(64)}`;
const REVISION_ID = `RREV_${"c".repeat(64)}`;
const DISPATCH_ID = `RDISP_${"d".repeat(64)}`;

function executorInput(input: Readonly<{
  result: V3RecoveryCoordinatorResult;
  calls: string[];
  resumeResult?: { advanced: boolean; runCompleted: boolean };
}>) {
  return {
    completionRequestId: "RCR_spawner-v3-effect-0001",
    effectKey: "v3-recovery/att_spawner-v3-effect-0001",
    planHash: "e".repeat(64),
    assertLease: async () => { input.calls.push("lease"); },
    coordinate: async () => {
      input.calls.push("coordinate");
      return input.result;
    },
    resumeCanonicalContinuation: async () => {
      input.calls.push("resume");
      return input.resumeResult ?? { advanced: true, runCompleted: false };
    },
  };
}

describe("spawner v3 recovery runtime-completion effect", () => {
  it("routes v3 effects around both generic reconcile and generic apply", () => {
    const source = fs.readFileSync(path.join(root, "src", "spawner.ts"), "utf8");
    const start = source.indexOf("async function applyAndAcceptRuntimeCompletionEffects(");
    const end = source.indexOf("async function executeRuntimeCompletionOwner(", start);
    assert.notEqual(start, -1, "runtime completion effect handler not found");
    assert.notEqual(end, -1, "runtime completion effect handler end not found");
    const handler = source.slice(start, end);

    const reconcileGuard = handler.indexOf(
      "if (effect.effectType === V3_RECOVERY_COORDINATE_EFFECT_TYPE) return undefined;",
    );
    const genericReconcile = handler.indexOf("const reconciled = await reconcileRuntimeCompletionEffects(");
    const applyGuard = handler.indexOf("if (effect.effectType === V3_RECOVERY_COORDINATE_EFFECT_TYPE) {", reconcileGuard + 1);
    const genericApply = handler.lastIndexOf("const applied = await resumeRuntimeCompletionEffects(");

    assert.ok(reconcileGuard >= 0 && genericReconcile > reconcileGuard);
    assert.ok(applyGuard > genericReconcile && genericApply > applyGuard);
    assert.match(
      handler,
      /createPostgresV3RecoveryEffectHandler\(getSql\(\)\)\.coordinate\(effectInput\.effect\)/,
    );
  });

  it("continues only verified or resolved recovery outcomes", async () => {
    for (const result of [
      {
        status: "verified",
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
        attemptId: "ATT_spawner-v3-effect-0001",
      },
      {
        status: "resolved",
        recoveryCaseId: RECOVERY_CASE_ID,
        revisionId: REVISION_ID,
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
        attemptId: "ATT_spawner-v3-effect-0002",
      },
    ] satisfies V3RecoveryCoordinatorResult[]) {
      const calls: string[] = [];
      const resolution = await executeV3RecoveryRuntimeCompletionEffect(executorInput({ result, calls }));
      assert.equal(resolution.resolution, "applied");
      assert.equal(resolution.result.advanced, true);
      assert.equal(resolution.result.runCompleted, false);
      assert.equal(resolution.result.recoveryStatus, result.status);
      assert.deepEqual(calls, ["lease", "coordinate", "lease", "resume", "lease"]);

      const recovery = resolution.result.recovery as Record<string, unknown>;
      assert.equal(recovery.evidenceBundleHash, EVIDENCE_BUNDLE_HASH);
      assert.equal(recovery.evidenceBundleRef, `setfarm://evidence-bundle/${EVIDENCE_BUNDLE_HASH}`);
      if (result.status === "resolved") {
        assert.equal(recovery.recoveryCaseRef, `setfarm://recovery-case/${RECOVERY_CASE_ID}`);
        assert.equal(recovery.revisionRef, `setfarm://recovery-revision/${REVISION_ID}`);
      }
      assert.deepEqual(resolution.evidence.recovery, recovery);
      assert.equal(resolution.evidence.continuationApplied, true);
    }
  });

  it("settles dispatched, blocked, superseded and pending outcomes without loop continuation", async () => {
    const outcomes: V3RecoveryCoordinatorResult[] = [
      {
        status: "dispatched",
        recoveryCaseId: RECOVERY_CASE_ID,
        revisionId: REVISION_ID,
        dispatchId: DISPATCH_ID,
        dispatchClass: "product_implementation",
        modelDispatch: true,
        deliveryState: "authorized",
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
      },
      {
        status: "dispatched",
        recoveryCaseId: RECOVERY_CASE_ID,
        revisionId: REVISION_ID,
        dispatchId: DISPATCH_ID,
        dispatchClass: "supervisor_repair",
        modelDispatch: true,
        deliveryState: "authorized",
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
      },
      {
        status: "blocked",
        recoveryCaseId: RECOVERY_CASE_ID,
        revisionId: REVISION_ID,
        reasonCode: "budget_exhausted",
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
      },
      {
        status: "superseded",
        recoveryCaseId: RECOVERY_CASE_ID,
        revisionId: REVISION_ID,
        reasonCode: "source_superseded",
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
      },
      {
        status: "pending",
        recoveryCaseId: RECOVERY_CASE_ID,
        revisionId: REVISION_ID,
        reasonCode: "recovery_checkpoint_requires_replay",
        evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
      },
    ];

    for (const result of outcomes) {
      const calls: string[] = [];
      const resolution = await executeV3RecoveryRuntimeCompletionEffect(executorInput({ result, calls }));
      assert.equal(resolution.result.advanced, false);
      assert.equal(resolution.result.runCompleted, false);
      assert.equal(resolution.result.recoveryStatus, result.status);
      assert.deepEqual(calls, ["lease", "coordinate", "lease", "lease"]);
      assert.equal(resolution.evidence.continuationApplied, false);

      const recovery = resolution.result.recovery as Record<string, unknown>;
      assert.equal(recovery.recoveryCaseRef, `setfarm://recovery-case/${RECOVERY_CASE_ID}`);
      assert.equal(recovery.revisionRef, `setfarm://recovery-revision/${REVISION_ID}`);
      if (result.status === "dispatched") {
        assert.equal(recovery.dispatchId, DISPATCH_ID);
        assert.equal(recovery.dispatchRef, `setfarm://recovery-dispatch/${DISPATCH_ID}`);
      } else {
        assert.equal("dispatchRef" in recovery, false);
      }
      assert.deepEqual(resolution.evidence.recovery, recovery);
    }
  });

  it("replays a crash after coordinate and before settlement without duplicating dispatch", async () => {
    const result: V3RecoveryCoordinatorResult = {
      status: "dispatched",
      recoveryCaseId: RECOVERY_CASE_ID,
      revisionId: REVISION_ID,
      dispatchId: DISPATCH_ID,
      dispatchClass: "product_implementation",
      modelDispatch: true,
      deliveryState: "authorized",
      evidenceBundleHash: EVIDENCE_BUNDLE_HASH,
    };
    let durableDispatches = 0;
    let dispatchExists = false;
    let coordinateCalls = 0;
    let resumeCalls = 0;
    const execute = () => executeV3RecoveryRuntimeCompletionEffect({
      completionRequestId: "RCR_spawner-v3-effect-crash",
      effectKey: "v3-recovery/att_spawner-v3-effect-crash",
      planHash: "f".repeat(64),
      assertLease: async () => {},
      coordinate: async () => {
        coordinateCalls += 1;
        if (!dispatchExists) {
          dispatchExists = true;
          durableDispatches += 1;
        }
        return result;
      },
      resumeCanonicalContinuation: async () => {
        resumeCalls += 1;
        return { advanced: true, runCompleted: false };
      },
    });

    const beforeCrash = await execute();
    // The first receipt is intentionally not settled. A new effect lease runs
    // the same content-addressed coordinator input after the simulated crash.
    const replay = await execute();

    assert.equal(coordinateCalls, 2);
    assert.equal(durableDispatches, 1);
    assert.equal(resumeCalls, 0);
    assert.deepEqual(replay, beforeCrash);
  });
});
