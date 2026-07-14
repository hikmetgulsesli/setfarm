import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EvidencePlanV1Schema,
  compileEvidencePlanV1,
  flattenEvidencePlanInteractions,
} from "../../src/evidence/evidence-plan-v1.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

describe("EvidencePlanV1", () => {
  function fixture() {
    const values = buildMinimalValidContracts();
    return {
      slice: ImplementationSliceV1Schema.parse(values.implementationSlice),
      sliceHash: "f".repeat(64),
    };
  }

  it("compiles the same exact executable plan for the same sealed slice", () => {
    const input = fixture();
    const first = compileEvidencePlanV1(input);
    const second = compileEvidencePlanV1(input);

    assert.equal(first.planHash, second.planHash);
    assert.deepEqual(first, second);
    assert.equal(first.packetHash, input.slice.packetHash);
    assert.equal(first.sliceHash, input.sliceHash);
    assert.equal(first.runtime, undefined);
    assert.deepEqual(first.predicateRefs, ["EVID_SAVE_RELOAD"]);
    assert.deepEqual(first.commands.map((command) => command.commandRef), ["CMD_BUILD", "CMD_TEST"]);
    assert.equal(first.flows[0]?.actionRef, "ACT_SAVE_TASK");
    assert.equal(first.flows[0]?.controlRef, "CTRL_SAVE_TASK");
    assert.deepEqual(first.flows[0]?.inputBindings, [{
      inputField: "title",
      valueFrom: { kind: "state", stateRef: "STATE_EDITOR", path: "/title" },
    }]);
    assert.deepEqual(flattenEvidencePlanInteractions(first).map((interaction) => interaction.id), [
      "route:ACT_SAVE_TASK",
      "action:ACT_SAVE_TASK",
      "reload:ACT_SAVE_TASK",
    ]);
  });

  it("turns a control value binding into a typed exact selector and test value", () => {
    const input = fixture();
    const actionBinding = input.slice.contract.bindings.find((binding) => binding.disposition === "action");
    assert.ok(actionBinding && actionBinding.disposition === "action");
    actionBinding.inputBindings[0] = {
      inputField: "title",
      valueFrom: { kind: "control_value", controlRef: "CTRL_TITLE" },
    };
    input.slice.contract.controls.push({
      id: "CTRL_TITLE",
      identity: input.slice.contract.controls[0]!.identity,
      generatedLocalId: "title-1",
      kind: "input",
      label: "Title",
      accessibility: { role: "textbox", name: "Task title" },
      surfaceRef: "SURF_EDITOR",
      interactive: true,
      source: { ...input.slice.contract.controls[0]!.source, selector: '[data-control-id="title-1"]' },
    });
    input.slice.contract.bindings.push({
      controlRef: "CTRL_TITLE",
      disposition: "value_input",
      fields: [{ actionRef: "ACT_SAVE_TASK", inputField: "title" }],
    });

    const plan = compileEvidencePlanV1(input);
    const flow = plan.flows[0]!;
    assert.deepEqual(flow.inputBindings, [{
      inputField: "title",
      valueFrom: {
        kind: "control_value",
        controlRef: "CTRL_TITLE",
        testValue: "Task from state",
      },
    }]);
    assert.deepEqual(flow.interactions.find((interaction) => interaction.id.startsWith("input:")), {
      id: "input:ACT_SAVE_TASK:title",
      action: "fill",
      target: "[data-control-id=\"title-1\"]",
      value: "Task from state",
      timeoutMs: 10_000,
    });
  });

  it("executes sealed CLI prerequisites before the target action", () => {
    const values = buildMinimalValidContracts();
    const slice: any = structuredClone(values.implementationSlice);
    const target = slice.contract.actions[0];
    const prerequisite = structuredClone(target);
    prerequisite.id = "ACT_PREPARE_TASK";
    prerequisite.name = "Prepare task state";
    prerequisite.trigger = { kind: "system" };
    prerequisite.input = { fields: [] };
    prerequisite.evidenceScenario = { targetInputValues: {}, prerequisiteSteps: [] };
    prerequisite.stateDeltas = [{
      stateRef: "STATE_EDITOR",
      operation: "set",
      path: "/title",
      valueFrom: { kind: "literal", value: "Prepared" },
    }];
    prerequisite.persistenceEffects = [];
    prerequisite.success.persistenceRefs = [];
    prerequisite.failure.persistenceRefs = [];
    target.evidenceScenario.prerequisiteSteps = [{ actionRef: "ACT_PREPARE_TASK", inputValues: {} }];
    slice.contract.actions.push(prerequisite);
    slice.story.actionRefs.push("ACT_PREPARE_TASK");
    const invocation = {
      command: { argv: ["true"], cwd: ".", timeoutMs: 10_000 },
      expectedExitCode: 0,
      capture: { format: "json", statePointer: "" },
    };
    slice.runtimeEvidence = {
      schema: "setfarm.runtime-evidence-contract.v1",
      adapter: "cli-process",
      stackPackId: "node-cli",
      initial: invocation,
      actions: [
        { actionRef: "ACT_PREPARE_TASK", inputValues: {}, action: invocation },
        {
          actionRef: "ACT_SAVE_TASK",
          inputValues: { title: "Task from state" },
          action: invocation,
          reload: invocation,
        },
      ],
    };

    const parsed = ImplementationSliceV1Schema.parse(slice);
    const plan = compileEvidencePlanV1({ slice: parsed, sliceHash: "f".repeat(64) });
    assert.deepEqual(plan.flows[0]!.interactions.map((interaction) => [
      interaction.id,
      interaction.target,
      interaction.inputValues,
    ]), [
      ["prerequisite:ACT_SAVE_TASK:001:ACT_PREPARE_TASK", "ACT_PREPARE_TASK", {}],
      ["action:ACT_SAVE_TASK", "ACT_SAVE_TASK", { title: "Task from state" }],
      ["reload:ACT_SAVE_TASK", "ACT_SAVE_TASK", { title: "Task from state" }],
    ]);
  });

  it("fails closed when an action input loses its exact value binding", () => {
    const input = fixture();
    const actionBinding = input.slice.contract.bindings.find((binding) => binding.disposition === "action");
    assert.ok(actionBinding && actionBinding.disposition === "action");
    actionBinding.inputBindings = [];

    assert.throws(
      () => compileEvidencePlanV1(input),
      /EVIDENCE_PLAN_INPUT_BINDING_MISSING:ACT_SAVE_TASK:title/,
    );
  });

  it("rejects a plan whose hash no longer binds its exact instructions", () => {
    const plan = compileEvidencePlanV1(fixture());
    const tampered = structuredClone(plan);
    tampered.flows[0]!.interactions[0]!.timeoutMs += 1;

    assert.equal(EvidencePlanV1Schema.safeParse(tampered).success, false);
  });
});
