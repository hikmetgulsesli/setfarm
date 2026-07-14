import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import type { CapturedRuntimeState, InteractionRequest, InteractionResult } from "../../src/installer/runtime-driver.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const SOURCE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };

describe("canonical evidence runner", () => {
  function fixture(reloadedTitle = "Task from state", includeState = true) {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-canonical-evidence-"));
    const slice = ImplementationSliceV1Schema.parse(buildMinimalValidContracts().implementationSlice);
    const plan = compileEvidencePlanV1({ slice, sliceHash: "f".repeat(64) });
    const dom = path.join(workdir, ".setfarm", "runtime", "dom.json");
    fs.mkdirSync(path.dirname(dom), { recursive: true });
    fs.writeFileSync(dom, JSON.stringify({ rootHtml: '<button data-action-id="save-task-1">Save</button>' }));
    const capture = (at: string, title: string, url = "http://127.0.0.1:3000/editor"): CapturedRuntimeState => ({
      capturedAt: at,
      url,
      domSnapshotPath: dom,
      ...(includeState ? { stateBridge: { state: { title } } } : { stateBridge: null }),
    });
    const request = (id: string, action: InteractionRequest["action"]): InteractionRequest => ({ id, action, timeoutMs: 1_000 });
    const result = (id: string, action: InteractionResult["action"], start: string, end: string): InteractionResult => ({
      id,
      action,
      status: "pass",
      startedAt: start,
      completedAt: end,
    });
    const routed = capture("2026-07-13T00:00:02.000Z", "Task from state");
    const afterAction = capture("2026-07-13T00:00:04.000Z", "Task from state");
    const afterReload = capture("2026-07-13T00:00:06.000Z", reloadedTitle);
    return {
      workdir,
      slice,
      plan,
      execution: {
        runtimeSessionId: "runtime-session-1",
        initialCapture: capture("2026-07-13T00:00:00.500Z", "Task from state", "http://127.0.0.1:3000/"),
        commands: plan.commands.map((command, index) => ({
          commandRef: command.commandRef,
          exitCode: 0,
          stdout: `${command.commandRef} passed\n`,
          stderr: "",
          startedAt: `2026-07-13T00:00:0${index}.000Z`,
          completedAt: `2026-07-13T00:00:0${index}.250Z`,
        })),
        interactions: [
          {
            request: { ...request("route:ACT_SAVE_TASK", "navigate"), value: "__SETFARM_RUNTIME_URL__/editor" },
            result: result("route:ACT_SAVE_TASK", "navigate", "2026-07-13T00:00:01.000Z", "2026-07-13T00:00:02.000Z"),
            before: capture("2026-07-13T00:00:00.500Z", "Task from state", "http://127.0.0.1:3000/"),
            after: routed,
          },
          {
            request: { ...request("action:ACT_SAVE_TASK", "click"), target: '[data-action-id="save-task-1"]' },
            result: result("action:ACT_SAVE_TASK", "click", "2026-07-13T00:00:03.000Z", "2026-07-13T00:00:04.000Z"),
            before: routed,
            after: afterAction,
          },
          {
            request: { ...request("reload:ACT_SAVE_TASK", "navigate"), value: "__SETFARM_RUNTIME_URL__/editor" },
            result: result("reload:ACT_SAVE_TASK", "navigate", "2026-07-13T00:00:05.000Z", "2026-07-13T00:00:06.000Z"),
            before: afterAction,
            after: afterReload,
          },
        ],
      },
    };
  }

  it("binds a passing persistence round trip to the exact attempt candidate", () => {
    const value = fixture();
    try {
      const result = createCanonicalEvidenceBundleV2({
        runId: "run-canonical-1",
        storyId: value.slice.storyId,
        workdir: value.workdir,
        attemptId: "ATT_canonical-evidence-0001",
        sourceRevision: SOURCE,
        slice: value.slice,
        plan: value.plan,
        execution: value.execution,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:07.000Z",
      });
      assert.equal(result.bundle.aggregateVerdict, "pass");
      assert.deepEqual(result.bundle.sourceRevision, SOURCE);
      assert.equal(result.bundle.attemptId, "ATT_canonical-evidence-0001");
      assert.equal(result.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_RELOAD")?.verdict, "pass");
      assert.ok(result.bundle.predicates.some((predicate) => predicate.predicateRef === "EVID_COMMAND_CMD_BUILD"));
      assert.ok(result.bundle.observations.some((observation) => observation.kind === "control"));
      assert.ok(result.bundle.observations.some((observation) => observation.kind === "runtime"));
      assert.ok(result.artifactPaths.some((file) => file.endsWith("EVIDENCE_BUNDLE.json")));
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });

  it("fails a reload mismatch and never promotes missing state instrumentation", () => {
    const mismatch = fixture("Different title");
    const missing = fixture("Task from state", false);
    try {
      const common = {
        runId: "run-canonical-2",
        storyId: mismatch.slice.storyId,
        attemptId: "ATT_canonical-evidence-0002",
        sourceRevision: SOURCE,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:07.000Z",
      };
      const failed = createCanonicalEvidenceBundleV2({
        ...common,
        workdir: mismatch.workdir,
        slice: mismatch.slice,
        plan: mismatch.plan,
        execution: mismatch.execution,
      });
      assert.equal(failed.bundle.aggregateVerdict, "fail");
      const inconclusive = createCanonicalEvidenceBundleV2({
        ...common,
        attemptId: "ATT_canonical-evidence-0003",
        workdir: missing.workdir,
        slice: missing.slice,
        plan: missing.plan,
        execution: missing.execution,
      });
      assert.equal(inconclusive.bundle.aggregateVerdict, "inconclusive");
    } finally {
      fs.rmSync(mismatch.workdir, { recursive: true, force: true });
      fs.rmSync(missing.workdir, { recursive: true, force: true });
    }
  });

  it("evaluates produced passes metadata through exact action deltas instead of treating metadata as a boolean", () => {
    const value = fixture();
    try {
      const binding = value.slice.contract.bindings.find((candidate) => candidate.disposition === "action");
      assert.ok(binding && binding.disposition === "action");
      binding.inputBindings = [{
        inputField: "title",
        valueFrom: { kind: "literal", value: "Task after" },
      }];
      value.slice.contract.actions[0]!.evidenceScenario.targetInputValues = { title: "Task after" };
      const passesAssertion = {
        operator: "passes" as const,
        expected: {
          policyRef: "PERSIST_TASK_LOCAL",
          durability: "reload",
          operation: "write",
          statePaths: [{ stateRef: "STATE_EDITOR", path: "/title" }],
        },
      };
      value.slice.contract.evidencePredicates[0]!.assertion = passesAssertion;
      value.slice.requiredEvidence[0]!.assertion = passesAssertion;
      value.plan = compileEvidencePlanV1({ slice: value.slice, sliceHash: "f".repeat(64) });
      const exactState = (title: string, unrelated = false) => ({
        schema: "setfarm.runtime-state-bridge.v1",
        captureSchema: "setfarm.browser-state-capture.v1",
        globalName: "__SETFARM_TEST_BRIDGE__",
        states: { STATE_EDITOR: { title, ...(unrelated ? { unrelated: true } : {}) } },
        missingStateRefs: [],
      });
      const actionTrace = value.execution.interactions.find((trace) => trace.request.id === "action:ACT_SAVE_TASK")!;
      const reloadTrace = value.execution.interactions.find((trace) => trace.request.id === "reload:ACT_SAVE_TASK")!;
      actionTrace.before.stateBridge = exactState("Before");
      actionTrace.after.stateBridge = exactState("Task after");
      reloadTrace.before.stateBridge = exactState("Task after");
      reloadTrace.after.stateBridge = exactState("Task after");
      const common = {
        runId: "run-canonical-passes",
        storyId: value.slice.storyId,
        workdir: value.workdir,
        sourceRevision: SOURCE,
        slice: value.slice,
        plan: value.plan,
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:07.000Z",
      };
      const passed = createCanonicalEvidenceBundleV2({
        ...common,
        attemptId: "ATT_canonical-passes-0001",
        execution: value.execution,
      });
      assert.equal(
        passed.bundle.predicates.find((candidate) => candidate.predicateRef === "EVID_SAVE_RELOAD")?.verdict,
        "pass",
      );

      actionTrace.after.stateBridge = exactState("Before", true);
      reloadTrace.before.stateBridge = exactState("Before", true);
      reloadTrace.after.stateBridge = exactState("Before", true);
      const failed = createCanonicalEvidenceBundleV2({
        ...common,
        attemptId: "ATT_canonical-passes-0002",
        execution: value.execution,
      });
      assert.equal(
        failed.bundle.predicates.find((candidate) => candidate.predicateRef === "EVID_SAVE_RELOAD")?.verdict,
        "fail",
        "an unrelated state mutation cannot satisfy the contracted title delta",
      );
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });
});
