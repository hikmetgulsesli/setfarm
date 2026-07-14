import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import type { CapturedRuntimeState } from "../../src/installer/runtime-driver.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const SOURCE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };

describe("typed observable action outcomes", () => {
  function fixture(selector: any = { kind: "control", actionRef: "ACT_SAVE_TASK" }) {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "setfarm-observable-outcome-"));
    const raw: any = structuredClone(buildMinimalValidContracts().implementationSlice);
    const action = raw.contract.actions[0];
    action.observableEffects = [{
      id: "OBS_SAVE_CONFIRMATION",
      selector,
      assertions: [
        { phase: "before", property: "visible_text", operator: "equals", expected: "Save" },
        { phase: "after", property: "visible_text", operator: "equals", expected: "Saved" },
        { phase: "reload", property: "visible_text", operator: "equals", expected: "Saved" },
        { phase: "after", property: "visibility", operator: "equals", expected: true },
        { phase: "after", property: "enabled", operator: "equals", expected: true },
        { phase: "after", property: "route", operator: "equals", expected: "/editor" },
      ],
      evidenceRef: "EVID_SAVE_CONFIRMATION",
    }];
    action.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
    action.success.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
    const observablePredicate = {
      id: "EVID_SAVE_CONFIRMATION",
      kind: "observable_outcome" as const,
      required: true,
      subjectRef: "OBS_SAVE_CONFIRMATION",
      capabilityRefs: ["CAP_BROWSER_INTERACTION"],
      assertion: { operator: "passes" as const },
    };
    raw.contract.evidencePredicates = [...raw.contract.evidencePredicates, observablePredicate];
    raw.requiredEvidence = [...raw.requiredEvidence, observablePredicate];
    raw.story.evidenceRefs.push(observablePredicate.id);
    const binding = raw.contract.bindings.find((candidate: any) => candidate.disposition === "action");
    binding.inputBindings = [{ inputField: "title", valueFrom: { kind: "literal", value: "Task from state" } }];
    const slice = ImplementationSliceV1Schema.parse(raw);
    const plan = compileEvidencePlanV1({ slice, sliceHash: "f".repeat(64) });

    let captureIndex = 0;
    const capture = (text: string, title: string, structured = true): CapturedRuntimeState => {
      captureIndex += 1;
      const domSnapshotPath = path.join(workdir, `.setfarm/runtime/dom-${captureIndex}.json`);
      fs.mkdirSync(path.dirname(domSnapshotPath), { recursive: true });
      fs.writeFileSync(domSnapshotPath, JSON.stringify(structured ? {
        schema: "setfarm.browser-dom-observation.v1",
        title: "Task Editor",
        bodyText: text,
        rootHtml: `<button data-action-id="save-task-1">${text}</button>`,
        elements: [{
          controlId: "CTRL_SAVE_TASK",
          actionId: "save-task-1",
          surfaceId: null,
          containingSurfaceId: "SURF_EDITOR",
          role: "button",
          accessibleName: "Save task",
          visibleText: text,
          value: null,
          visible: true,
          enabled: true,
        }, {
          controlId: null,
          actionId: null,
          surfaceId: null,
          containingSurfaceId: "SURF_OTHER",
          role: "button",
          accessibleName: "Save task",
          visibleText: "Unrelated duplicate",
          value: null,
          visible: true,
          enabled: true,
        }],
      } : { rootHtml: `<button data-action-id="save-task-1">${text}</button>` }));
      return {
        capturedAt: `2026-07-13T00:00:0${captureIndex}.000Z`,
        url: "http://127.0.0.1:3000/editor",
        domSnapshotPath,
        stateBridge: {
          schema: "setfarm.runtime-state-bridge.v1",
          states: { STATE_EDITOR: { title } },
          missingStateRefs: [],
        },
      };
    };
    return { workdir, slice, plan, capture };
  }

  function execution(value: ReturnType<typeof fixture>, afterText = "Saved", structured = true) {
    const before = value.capture("Save", "Before", structured);
    const after = value.capture(afterText, "Task from state", structured);
    const reload = value.capture(afterText, "Task from state", structured);
    const result = (id: string, action: "navigate" | "click") => ({
      id,
      action,
      status: "pass" as const,
      startedAt: "2026-07-13T00:00:01.000Z",
      completedAt: "2026-07-13T00:00:02.000Z",
    });
    return {
      runtimeSessionId: "runtime-observable-1",
      initialCapture: before,
      commands: value.plan.commands.map((command) => ({
        commandRef: command.commandRef,
        exitCode: 0,
        stdout: "passed\n",
        stderr: "",
        startedAt: "2026-07-13T00:00:00.000Z",
        completedAt: "2026-07-13T00:00:00.500Z",
      })),
      interactions: [
        {
          request: { id: "route:ACT_SAVE_TASK", action: "navigate" as const, value: "__SETFARM_RUNTIME_URL__/editor" },
          result: result("route:ACT_SAVE_TASK", "navigate"),
          before,
          after: before,
        },
        {
          request: { id: "action:ACT_SAVE_TASK", action: "click" as const, target: '[data-action-id="save-task-1"]' },
          result: result("action:ACT_SAVE_TASK", "click"),
          before,
          after,
        },
        {
          request: { id: "reload:ACT_SAVE_TASK", action: "navigate" as const, value: "__SETFARM_RUNTIME_URL__/editor" },
          result: result("reload:ACT_SAVE_TASK", "navigate"),
          before: after,
          after: reload,
        },
      ],
    };
  }

  function run(value: ReturnType<typeof fixture>, attemptId: string, afterText = "Saved", structured = true) {
    return createCanonicalEvidenceBundleV2({
      runId: "run-observable-1",
      storyId: value.slice.storyId,
      workdir: value.workdir,
      attemptId,
      sourceRevision: SOURCE,
      slice: value.slice,
      plan: value.plan,
      execution: execution(value, afterText, structured),
      startedAt: "2026-07-13T00:00:00.000Z",
      completedAt: "2026-07-13T00:00:09.000Z",
    });
  }

  it("seals DOM/control before, after, reload, visibility, enabled, and route assertions into the plan", () => {
    const value = fixture();
    try {
      assert.deepEqual(value.plan.flows[0]!.observableEffects, value.slice.contract.actions[0]!.observableEffects);
      assert.equal(value.plan.flows[0]!.reloadInteractionId, "reload:ACT_SAVE_TASK");
      const result = run(value, "ATT_observable-pass-0001");
      assert.equal(
        result.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_CONFIRMATION")?.verdict,
        "pass",
      );
      assert.equal(result.bundle.aggregateVerdict, "pass");
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });

  it("fails a wrong visible outcome and treats app-state-only evidence as inconclusive", () => {
    const wrong = fixture();
    const stateOnly = fixture();
    try {
      const failed = run(wrong, "ATT_observable-fail-0001", "Not saved");
      assert.equal(
        failed.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_CONFIRMATION")?.verdict,
        "fail",
      );
      const inconclusive = run(stateOnly, "ATT_observable-inconclusive-0001", "Saved", false);
      assert.equal(
        inconclusive.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_CONFIRMATION")?.verdict,
        "inconclusive",
      );
      assert.equal(inconclusive.bundle.aggregateVerdict, "inconclusive");
    } finally {
      fs.rmSync(wrong.workdir, { recursive: true, force: true });
      fs.rmSync(stateOnly.workdir, { recursive: true, force: true });
    }
  });

  it("resolves an accessibility outcome by exact surface as well as role and name", () => {
    const value = fixture({
      kind: "accessibility",
      surfaceRef: "SURF_EDITOR",
      actionRef: "ACT_SAVE_TASK",
      role: "button",
      name: "Save task",
    });
    try {
      const result = run(value, "ATT_observable-accessibility-0001");
      assert.equal(
        result.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_CONFIRMATION")?.verdict,
        "pass",
      );
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });
});
