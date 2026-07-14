import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileEvidencePlanV1 } from "../../src/evidence/evidence-plan-v1.js";
import { evaluateProducedPredicateSemanticsV1 } from "../../src/evidence/canonical-evidence-runner.js";
import { produceRuntimeEvidenceContractV1 } from "../../src/evidence/runtime-evidence-contract-producer-v1.js";
import { produceProductSpecV1 } from "../../src/product-compiler/producers/product-spec.js";
import { ImplementationSliceV1Schema } from "../../src/product-compiler/schemas/implementation-slice-v1.js";
import type { ProductSpecV1 } from "../../src/product-compiler/schemas/product-spec-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const TASKS = {
  utility: "Build a compact single-page status utility with a refresh button and a ready/paused toggle. Keep status in localStorage.",
  operations: "Build a local inventory operations app that must list, create, edit, save, and delete items. Persist item records in localStorage.",
  game: "Build a browser game. The player can start, move left and right, pause and resume, and restart. Track score and store high score in localStorage.",
} as const;

function produced(productClass: keyof typeof TASKS): ProductSpecV1 {
  const result = produceProductSpecV1({ task: TASKS[productClass] });
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  return result.productSpec;
}

function compiledProfile(productClass: keyof typeof TASKS) {
  const productSpec = produced(productClass);
  const values = buildMinimalValidContracts();
  const topology = structuredClone(values.buildTopology);
  const entryRoute = productSpec.routes.find((route) => route.entry)!;
  topology.entrypoints[0]!.routeRefs = [entryRoute.id];
  if (productClass === "game") {
    topology.stackPack.id = "browser-game-canvas";
    topology.entrypoints[0]!.kind = "game";
  }
  const runtime = produceRuntimeEvidenceContractV1({ productSpec, buildTopology: topology });
  assert.equal(runtime.status, "produced");
  if (runtime.status !== "produced") throw new Error("runtime contract was not produced");

  const provenance = values.designGraph.controls[0]!.identity;
  const source = values.designGraph.controls[0]!.source;
  const controls: any[] = [];
  const bindings: any[] = [];
  for (const action of productSpec.actions.filter((candidate) => candidate.trigger.kind === "user")) {
    const token = action.id.replace(/^ACT_/, "");
    const actionControlRef = `CTRL_ACTION_${token}`;
    const sameToggle = action.id === "ACT_SET_PAUSED";
    controls.push({
      id: actionControlRef,
      identity: provenance,
      generatedLocalId: `action-${token.toLowerCase().replaceAll("_", "-")}`,
      kind: sameToggle ? "checkbox" : "button",
      label: action.name,
      accessibility: { role: sameToggle ? "checkbox" : "button", name: action.name },
      surfaceRef: action.surfaceRefs[0],
      interactive: true,
      source: { ...source, selector: `[data-action-id="${action.id}"]` },
    });
    const inputBindings: any[] = [];
    for (const field of action.input.fields) {
      if (sameToggle) {
        inputBindings.push({
          inputField: field.name,
          valueFrom: { kind: "control_value", controlRef: actionControlRef },
        });
      } else if (action.id === "ACT_SAVE_ITEM") {
        const inputControlRef = `CTRL_INPUT_${token}_${field.name.toUpperCase()}`;
        controls.push({
          id: inputControlRef,
          identity: provenance,
          generatedLocalId: `input-${field.name}`,
          kind: field.name === "status" ? "select" : "input",
          label: field.name,
          accessibility: { role: field.name === "status" ? "combobox" : "textbox", name: field.name },
          surfaceRef: action.surfaceRefs[0],
          interactive: true,
          source: { ...source, selector: `[data-input-field="${field.name}"]` },
        });
        bindings.push({
          controlRef: inputControlRef,
          disposition: "value_input",
          fields: [{ actionRef: action.id, inputField: field.name }],
        });
        inputBindings.push({
          inputField: field.name,
          valueFrom: { kind: "control_value", controlRef: inputControlRef },
        });
      } else {
        inputBindings.push({
          inputField: field.name,
          valueFrom: { kind: "literal", value: action.evidenceScenario.targetInputValues[field.name] },
        });
      }
    }
    bindings.push({
      controlRef: actionControlRef,
      disposition: "action",
      actionRef: action.id,
      routeRef: productSpec.surfaces.find((surface) => surface.id === action.surfaceRefs[0])!.routeRef,
      inputBindings,
      stateRefs: [...new Set([
        ...action.preconditions.map((item) => item.stateRef),
        ...action.stateDeltas.map((item) => item.stateRef),
      ])].sort(),
      persistenceRefs: [...new Set(action.persistenceEffects.map((item) => item.policyRef))].sort(),
      evidenceRefs: [...action.evidenceRefs].sort(),
    });
  }

  const actionRefs = productSpec.actions.map((action) => action.id).sort();
  const stateRefs = productSpec.states.map((state) => state.id).sort();
  const persistenceRefs = productSpec.persistencePolicies.map((policy) => policy.id).sort();
  const evidenceRefs = productSpec.evidencePredicates.map((predicate) => predicate.id).sort();
  const surfaceRefs = productSpec.surfaces.map((surface) => surface.id).sort();
  const slice = ImplementationSliceV1Schema.parse({
    ...values.implementationSlice,
    story: {
      ...values.implementationSlice.story,
      title: `${productClass} exact evidence story`,
      surfaceRefs,
      controlRefs: controls.map((control) => control.id).sort(),
      actionRefs,
      stateRefs,
      persistenceRefs,
      evidenceRefs,
    },
    contract: {
      routes: productSpec.routes,
      surfaces: productSpec.surfaces,
      controls,
      bindings,
      actions: productSpec.actions,
      states: productSpec.states,
      persistencePolicies: productSpec.persistencePolicies,
      evidencePredicates: productSpec.evidencePredicates,
    },
    commands: topology.commands,
    requiredEvidence: productSpec.evidencePredicates,
    runtimeEvidence: runtime.contract,
  });
  return { productSpec, plan: compileEvidencePlanV1({ slice, sliceHash: "f".repeat(64) }) };
}

function assertStructurallyConclusive(productClass: keyof typeof TASKS): ReturnType<typeof compiledProfile> {
  const compiled = compiledProfile(productClass);
  const capturedStates = new Set(compiled.plan.runtime?.adapter === "browser-service"
    ? compiled.plan.runtime.capture.stateBindings.map((binding) => binding.stateRef)
    : []);
  for (const flow of compiled.plan.flows) {
    const action = compiled.productSpec.actions.find((candidate) => candidate.id === flow.actionRef)!;
    assert.deepEqual(flow.preconditions, action.preconditions);
    assert.deepEqual(flow.scenario, action.evidenceScenario);
    assert.equal(flow.interactions[0]?.action, "reset", `${action.id} is not isolated from prior flows`);
    assert.notEqual(
      flow.interactions.find((interaction) => interaction.id === flow.actionInteractionId)?.action,
      "wait",
      `${action.id} has a non-executable action interaction`,
    );
    action.evidenceScenario.prerequisiteSteps.forEach((step, index) => {
      const interaction = flow.interactions.find((candidate) =>
        candidate.id === `prerequisite:${action.id}:${String(index + 1).padStart(3, "0")}:${step.actionRef}`);
      assert.deepEqual(interaction, {
        id: `prerequisite:${action.id}:${String(index + 1).padStart(3, "0")}:${step.actionRef}`,
        action: "invoke",
        target: step.actionRef,
        value: "action",
        inputValues: step.inputValues,
        timeoutMs: 30_000,
      });
    });
    action.stateDeltas.forEach((delta) => assert.equal(capturedStates.has(delta.stateRef), true));
    for (const predicateRef of flow.predicateRefs) {
      const predicate = compiled.productSpec.evidencePredicates.find((candidate) => candidate.id === predicateRef)!;
      if (predicate.kind !== "persistence_round_trip") continue;
      const metadata = predicate.assertion.expected as { policyRef: string; durability: string };
      if (["reload", "restart", "durable"].includes(metadata.durability)) {
        assert.ok(flow.reloadInteractionId, `${predicate.id} lacks durable readback`);
      } else {
        assert.equal(flow.reloadInteractionId, undefined, `${predicate.id} invented a session reload`);
      }
    }
  }
  return compiled;
}

function pointer(value: unknown, path: string): unknown {
  if (path === "") return value;
  let current = value;
  for (const encoded of path.slice(1).split("/")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[encoded.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return current;
}

function writePointer(state: unknown, path: string, value: unknown): unknown {
  if (path === "") return structuredClone(value);
  const root = structuredClone(state) as Record<string, unknown>;
  const tokens = path.slice(1).split("/").map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = root;
  tokens.slice(0, -1).forEach((token) => {
    if (current[token] === null || typeof current[token] !== "object" || Array.isArray(current[token])) current[token] = {};
    current = current[token] as Record<string, unknown>;
  });
  current[tokens.at(-1)!] = structuredClone(value);
  return root;
}

function applyContractAction(
  spec: ProductSpecV1,
  actionRef: string,
  inputValues: Readonly<Record<string, unknown>>,
  before: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const action = spec.actions.find((candidate) => candidate.id === actionRef)!;
  const after = structuredClone(before) as Record<string, unknown>;
  for (const delta of action.stateDeltas) {
    const source = delta.valueFrom.kind === "literal"
      ? delta.valueFrom.value
      : delta.valueFrom.kind === "input"
        ? inputValues[delta.valueFrom.field]
        : delta.valueFrom.kind === "inputs"
          ? Object.fromEntries(delta.valueFrom.fields.map((field) => [field, inputValues[field]]))
          : delta.valueFrom.kind === "state"
            ? pointer(before[delta.valueFrom.stateRef], delta.valueFrom.path)
            : undefined;
    const currentState = after[delta.stateRef];
    const currentTarget = pointer(currentState, delta.path);
    let next = source;
    if (delta.operation === "merge") next = { ...(currentTarget as Record<string, unknown>), ...(source as Record<string, unknown>) };
    if (delta.operation === "append") next = [...(currentTarget as unknown[]), source];
    if (delta.operation === "remove") {
      next = (currentTarget as unknown[]).filter((item) => {
        if (!delta.matchField || item === null || typeof item !== "object") return item !== source;
        return (item as Record<string, unknown>)[delta.matchField] !== source;
      });
    }
    if (delta.operation === "upsert") {
      const items = [...(currentTarget as unknown[])];
      const record = source as Record<string, unknown>;
      const index = items.findIndex((item) =>
        item !== null
        && typeof item === "object"
        && (item as Record<string, unknown>)[delta.matchField!] === record[delta.matchField!]);
      if (index === -1) items.push(record);
      else items[index] = record;
      next = items;
    }
    after[delta.stateRef] = writePointer(currentState, delta.path, next);
  }
  return after;
}

describe("supported profile evidence plans", () => {
  it("uses one checkbox click for the utility input/action and exact reload semantics", () => {
    const { plan } = assertStructurallyConclusive("utility");
    const flow = plan.flows.find((candidate) => candidate.actionRef === "ACT_SET_PAUSED")!;
    const clicks = flow.interactions.filter((interaction) =>
      interaction.action === "click" && interaction.target === '[data-action-id="ACT_SET_PAUSED"]');
    assert.equal(clicks.length, 1, "the ready/paused checkbox must not be toggled twice");
    assert.equal(flow.inputBindings[0]?.valueFrom.kind, "control_value");
    assert.equal(flow.inputBindings[0]?.valueFrom.kind === "control_value"
      ? flow.inputBindings[0].valueFrom.testValue
      : undefined, true);
  });

  it("binds operations create/save/select/delete prerequisites as executable exact invokes", () => {
    const { plan, productSpec } = assertStructurallyConclusive("operations");
    for (const actionRef of ["ACT_SELECT_ITEM", "ACT_SAVE_ITEM", "ACT_DELETE_ITEM"]) {
      const action = productSpec.actions.find((candidate) => candidate.id === actionRef)!;
      const flow = plan.flows.find((candidate) => candidate.actionRef === actionRef)!;
      assert.equal(flow.scenario.prerequisiteSteps.length, action.evidenceScenario.prerequisiteSteps.length);
      assert.ok(flow.scenario.prerequisiteSteps.length > 0, `${actionRef} lost its setup chain`);
    }
    const save = plan.flows.find((candidate) => candidate.actionRef === "ACT_SAVE_ITEM")!;
    assert.equal(
      save.interactions.find((interaction) => interaction.id === "input:ACT_SAVE_ITEM:status")?.action,
      "select",
      "enum inputs require an executable selectOption interaction",
    );
    const reload = save.interactions.find((interaction) => interaction.id === save.reloadInteractionId);
    assert.equal(reload?.action, "invoke");
    assert.equal(reload?.target, "ACT_LOAD_ITEMS");
    assert.equal(reload?.value, "reload");
    assert.equal(
      productSpec.evidencePredicates.some((predicate) => predicate.id === "EVID_LOAD_ITEMS_PERSIST_001"),
      false,
      "a read effect is not a persistence round-trip mutation",
    );
  });

  it("invokes game system/timer actions through the versioned bridge instead of waiting", () => {
    const { plan } = assertStructurallyConclusive("game");
    for (const actionRef of ["ACT_ADVANCE_GAME", "ACT_RECORD_HIGH_SCORE"]) {
      const flow = plan.flows.find((candidate) => candidate.actionRef === actionRef)!;
      const interaction = flow.interactions.find((candidate) => candidate.id === flow.actionInteractionId);
      assert.equal(interaction?.action, "invoke");
      assert.equal(interaction?.target, actionRef);
      assert.deepEqual(interaction?.inputValues, flow.scenario.targetInputValues);
    }
  });

  it("keeps every produced profile state/persistence predicate semantically decidable and passing", () => {
    for (const productClass of ["utility", "operations", "game"] as const) {
      const { productSpec } = assertStructurallyConclusive(productClass);
      const initial = Object.fromEntries(productSpec.states.map((state) => [state.id, structuredClone(state.initialValue)]));
      for (const action of productSpec.actions) {
        let before = structuredClone(initial);
        for (const step of action.evidenceScenario.prerequisiteSteps) {
          before = applyContractAction(productSpec, step.actionRef, step.inputValues, before);
        }
        const after = applyContractAction(
          productSpec,
          action.id,
          action.evidenceScenario.targetInputValues,
          before,
        );
        for (const predicate of productSpec.evidencePredicates.filter((candidate) =>
          candidate.subjectRef === action.id
          && ["state_transition", "persistence_round_trip"].includes(candidate.kind))) {
          const durability = predicate.kind === "persistence_round_trip"
            ? (predicate.assertion.expected as { durability: string }).durability
            : undefined;
          let reloaded = structuredClone(initial);
          if (predicate.kind === "persistence_round_trip" && durability === "reload") {
            const metadata = predicate.assertion.expected as { policyRef: string; operation: string };
            const effect = action.persistenceEffects.find((candidate) =>
              candidate.policyRef === metadata.policyRef && candidate.operation === metadata.operation)!;
            for (const statePath of effect.statePaths) {
              reloaded[statePath.stateRef] = writePointer(
                reloaded[statePath.stateRef],
                statePath.path,
                pointer(after[statePath.stateRef], statePath.path),
              );
            }
            const policy = productSpec.persistencePolicies.find((candidate) => candidate.id === metadata.policyRef)!;
            if (policy.rehydration.kind === "action") {
              const readAction = productSpec.actions.find((candidate) => candidate.id === policy.rehydration.actionRef)!;
              reloaded = applyContractAction(
                productSpec,
                readAction.id,
                readAction.evidenceScenario.targetInputValues,
                reloaded,
              );
            }
          }
          const verdict = evaluateProducedPredicateSemanticsV1({
            predicate,
            action,
            persistencePolicies: productSpec.persistencePolicies,
            inputValues: action.evidenceScenario.targetInputValues,
            stateBefore: before,
            stateAfterAction: after,
            actionPassed: true,
            runtimeAdapter: "browser-service",
            ...(["reload"].includes(durability ?? "")
              ? { stateAfterReload: reloaded, reloadPassed: true }
              : {}),
          });
          assert.equal(verdict, "pass", `${productClass}:${action.id}:${predicate.id} => ${verdict}`);
        }
      }
    }
  });
});
