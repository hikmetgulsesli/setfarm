import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { describe, it } from "node:test";

import { createCanonicalEvidenceBundleV2 } from "../../src/evidence/canonical-evidence-runner.js";
import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import type { CapturedRuntimeState } from "../../src/installer/runtime-driver.js";
import { WebPreviewRuntimeDriver } from "../../src/installer/web-runtime-driver.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const SOURCE = { sha: "1".repeat(40), treeHash: "2".repeat(40) };

describe("typed observable action outcomes", () => {
  function fixture(selector: any = { kind: "control", actionRef: "ACT_SAVE_TASK" }, valueOutcome = false) {
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
    if (valueOutcome) {
      action.observableEffects[0].assertions = [
        { phase: "before", property: "value", operator: "equals", expected: "pending" },
        { phase: "after", property: "value", operator: "equals", expected: "refreshed" },
        { phase: "reload", property: "value", operator: "equals", expected: "refreshed" },
      ];
      raw.contract.observableBindings = [{
        observableRef: "OBS_SAVE_CONFIRMATION", actionRef: "ACT_SAVE_TASK", evidenceRef: "EVID_SAVE_CONFIRMATION",
        target: {
          kind: "accessibility", surfaceRef: "SURF_EDITOR", role: "status", name: "Refresh status",
          identity: { kind: "explicit", attribute: "data-observable-refs", provenance: [{
            schema: "setfarm.provenance-ref.v1", sourceHash: "a".repeat(64), locator: "stitch/editor.html", confidence: "exact",
          }] },
          source: { artifactHash: "a".repeat(64), locator: "stitch/editor.html", selector: '[data-observable-refs~="OBS_SAVE_CONFIRMATION"]' },
        },
      }];
    }
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

  async function capturedValue(
    value: ReturnType<typeof fixture>,
    phase: "before" | "after" | "reload",
    options: { payload?: string; surface?: string; observableRef?: string } = {},
  ): Promise<CapturedRuntimeState> {
    const payload = options.payload ?? (phase === "before" ? "pending" : "refreshed");
    const surface = options.surface ?? "SURF_EDITOR";
    const observableRef = options.observableRef ?? "OBS_SAVE_CONFIRMATION";
    // Minimal owned DOM interface; execute captureState's actual serialized
    // expression rather than synthesizing the value observation under test.
    const element = (tagName: string, attributes: Record<string, string>, textContent: string) => ({
      tagName, textContent, innerText: textContent,
      getAttribute: (name: string) => attributes[name] ?? null,
      hasAttribute: (name: string) => Object.hasOwn(attributes, name),
      closest: () => ({ getAttribute: () => surface }),
      getBoundingClientRect: () => ({ width: 100, height: 24 }),
    });
    const elements = [
      element("BUTTON", { "data-action-id": "save-task-1", "data-control-id": "CTRL_SAVE_TASK" }, phase === "before" ? "Save" : "Saved"),
      element("DIV", { "data-value": payload, "data-observable-refs": observableRef, role: "status", "aria-label": "Refresh status" }, "Status"),
    ];
    const document = {
      title: "Task Editor", body: { innerText: "Save Status" },
      querySelectorAll: () => elements,
      querySelector: () => ({ outerHTML: '<main id="root">Save Status</main>' }),
      getElementById: () => null,
    };
    const driver = new WebPreviewRuntimeDriver();
    Object.defineProperty(driver, "sessionPage", { value: async () => ({
      waitForLoadState: async () => {}, screenshot: async () => {},
      url: () => "http://127.0.0.1:3000/editor",
      evaluate: async (expression: unknown) => typeof expression === "string"
        ? vm.runInNewContext(expression, { document, getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }) })
        : null,
    }) });
    const capture = await driver.captureState({
      kind: "browser", sessionId: `value-${phase}`, workdir: value.workdir,
      host: "127.0.0.1", port: 3000, url: "http://127.0.0.1:3000", startedAt: "2026-11-05T00:00:00.000Z",
    });
    // Existing state/persistence controls remain independent of the DOM value.
    return { ...capture, stateBridge: {
      schema: "setfarm.runtime-state-bridge.v1",
      states: { STATE_EDITOR: { title: phase === "before" ? "Before" : "Task from state" } }, missingStateRefs: [],
    } };
  }

  async function runCapturedValues(
    value: ReturnType<typeof fixture>,
    overrides: { after?: Parameters<typeof capturedValue>[2]; reload?: Parameters<typeof capturedValue>[2] } = {},
  ) {
    const before = await capturedValue(value, "before");
    const after = await capturedValue(value, "after", overrides.after);
    const reload = await capturedValue(value, "reload", overrides.reload);
    const trace = execution(value);
    trace.initialCapture = before;
    trace.interactions[0]!.before = before;
    trace.interactions[0]!.after = before;
    trace.interactions[1]!.before = before;
    trace.interactions[1]!.after = after;
    trace.interactions[2]!.before = after;
    trace.interactions[2]!.after = reload;
    return createCanonicalEvidenceBundleV2({
      runId: "run-observable-1", storyId: value.slice.storyId, workdir: value.workdir,
      attemptId: "ATT_observable-value-0001", sourceRevision: SOURCE, slice: value.slice, plan: value.plan,
      execution: trace, startedAt: "2026-07-13T00:00:00.000Z", completedAt: "2026-07-13T00:00:09.000Z",
    });
  }

  it("accepts captured non-native value outcomes after action and reload with an exact observable binding", async () => {
    const value = fixture({ kind: "accessibility", surfaceRef: "SURF_EDITOR", actionRef: "ACT_SAVE_TASK", role: "status", name: "Refresh status" }, true);
    try {
      const result = await runCapturedValues(value);
      assert.equal(result.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_CONFIRMATION")?.verdict, "pass");
      assert.equal(result.bundle.aggregateVerdict, "pass");
    } finally {
      fs.rmSync(value.workdir, { recursive: true, force: true });
    }
  });

  for (const [label, overrides, expected] of [
    ["wrong surface", { after: { surface: "SURF_OTHER" } }, "inconclusive"],
    ["wrong observable ref", { after: { observableRef: "OBS_OTHER" } }, "inconclusive"],
    ["wrong action value", { after: { payload: "stale" } }, "fail"],
    ["wrong reload value", { reload: { payload: "stale" } }, "fail"],
  ] as const) {
    it(`refuses captured value evidence with ${label}`, async () => {
      const value = fixture({ kind: "accessibility", surfaceRef: "SURF_EDITOR", actionRef: "ACT_SAVE_TASK", role: "status", name: "Refresh status" }, true);
      try {
        const result = await runCapturedValues(value, overrides);
        assert.equal(result.bundle.predicates.find((predicate) => predicate.predicateRef === "EVID_SAVE_CONFIRMATION")?.verdict, expected);
        assert.notEqual(result.bundle.aggregateVerdict, "pass");
      } finally {
        fs.rmSync(value.workdir, { recursive: true, force: true });
      }
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
