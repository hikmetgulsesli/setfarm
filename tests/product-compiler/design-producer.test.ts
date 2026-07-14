import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  produceDesignInteractionGraphV1,
  type DesignGraphProducerInput,
} from "../../src/product-compiler/producers/design-graph.js";
import { DesignInteractionGraphV1Schema } from "../../src/product-compiler/schemas/design-interaction-graph-v1.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

const SOURCE_HASH = "a".repeat(64);

function productSpecFor1925() {
  const { productSpec } = buildMinimalValidContracts();
  const exact = structuredClone(productSpec);
  exact.actions[0]!.id = "ACT_SAVE_RECORD";
  exact.evidencePredicates[0]!.subjectRef = "ACT_SAVE_RECORD";
  return exact;
}

function exactInput(): DesignGraphProducerInput {
  return {
    productSpec: productSpecFor1925(),
    generationTargets: [{
      targetId: "TARGET_EDITOR",
      designSurfaceId: "DSURF_EDITOR",
      surfaceRef: "SURF_EDITOR",
      requestScreenKey: "patient-editor",
      returnedScreenId: "stitch-screen-1925",
      sourceArtifactHash: SOURCE_HASH,
      sourceLocator: "stitch/patient-editor.html",
      diagnosticHints: {
        title: "Patient Editor",
        tokens: ["save", "changes"],
      },
    }],
    converterOutputs: [{
      targetRef: "TARGET_EDITOR",
      responseScreenId: "stitch-screen-1925",
      designSurfaceId: "DSURF_EDITOR",
      surfaceRef: "SURF_EDITOR",
      sourceArtifactHash: SOURCE_HASH,
      sourceLocator: "stitch/patient-editor.html",
      controls: [{
        generatedLocalId: "save-changes-7",
        kind: "button",
        interactive: true,
        label: "Save Changes",
        accessibility: { role: "button", name: "Save Changes" },
        source: {
          selector: "[data-action-id=\"save-changes-7\"]",
          line: 6,
          column: 0,
        },
        bindings: [{
          disposition: "action",
          sameElement: {
            generatedLocalId: "save-changes-7",
            dataAction: "ACT_SAVE_RECORD",
            actionRef: "ACT_SAVE_RECORD",
          },
          routeRef: "ROUTE_HOME",
          inputBindings: [{
            inputField: "title",
            valueFrom: {
              kind: "state",
              stateRef: "STATE_EDITOR",
              path: "/title",
            },
          }],
          stateRefs: ["STATE_EDITOR"],
          persistenceRefs: ["PERSIST_TASK_LOCAL"],
          evidenceRefs: ["EVID_SAVE_RELOAD"],
        }],
        diagnosticHints: { label: "Save Changes" },
      }],
      diagnosticHints: { title: "Patient Editor" },
    }],
  };
}

describe("typed exact design graph producer", () => {
  it("preserves the #1925 same-element data-action and generated DOM action ID", async () => {
    const fixture = await readFile(
      path.resolve("evals/fixtures/1925-task-chip/sources/generated-control.tsx"),
      "utf8",
    );
    assert.match(fixture, /data-action="ACT_SAVE_RECORD"/);
    assert.match(fixture, /data-action-id="save-changes-7"/);

    const result = produceDesignInteractionGraphV1(exactInput());
    assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
    assert.deepEqual(DesignInteractionGraphV1Schema.parse(result.designGraph), result.designGraph);
    assert.equal(result.designGraph.surfaces[0]?.surfaceRef, "SURF_EDITOR");
    assert.equal(result.designGraph.controls[0]?.generatedLocalId, "save-changes-7");
    assert.equal(
      result.designGraph.controls[0]?.source.selector,
      "[data-action-id=\"save-changes-7\"]",
    );
    assert.deepEqual(result.exactControlBindings.map((binding) => ({
      generatedLocalId: binding.generatedLocalId,
      dataAction: binding.dataAction,
      actionRef: binding.actionRef,
      responseScreenId: binding.responseScreenId,
    })), [{
      generatedLocalId: "save-changes-7",
      dataAction: "ACT_SAVE_RECORD",
      actionRef: "ACT_SAVE_RECORD",
      responseScreenId: "stitch-screen-1925",
    }]);
    assert.equal(result.designGraph.bindings[0]?.disposition, "action");
    assert.equal(
      result.diagnostics.every((item) => item.code === "DESIGN_HEURISTIC_HINT_IGNORED"),
      true,
    );
  });

  it("rejects a label-only control because prose similarity is not authority", () => {
    const input = exactInput();
    input.converterOutputs[0]!.controls[0]!.bindings = [];
    input.converterOutputs[0]!.controls[0]!.label = "Save record";
    input.converterOutputs[0]!.controls[0]!.diagnosticHints = {
      label: "ACT_SAVE_RECORD Save record",
      tokens: ["ACT_SAVE_RECORD"],
    };

    const result = produceDesignInteractionGraphV1(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_CONTROL_DISPOSITION_MISSING"), true);
    assert.equal("designGraph" in result, false);
    const missing = result.diagnostics.find((item) => item.code === "DESIGN_CONTROL_DISPOSITION_MISSING");
    assert.equal(missing?.suggestions[0]?.confidence, "heuristic_legacy_only");
  });

  it("rejects multiple exact dispositions instead of picking one by precedence", () => {
    const input = exactInput();
    const binding = input.converterOutputs[0]!.controls[0]!.bindings[0]!;
    input.converterOutputs[0]!.controls[0]!.bindings.push(structuredClone(binding));

    const result = produceDesignInteractionGraphV1(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_CONTROL_DISPOSITION_AMBIGUOUS"), true);
    assert.equal("designGraph" in result, false);
  });

  it("rejects an exact target/response screen identity mismatch even when titles match", () => {
    const input = exactInput();
    input.converterOutputs[0]!.responseScreenId = "different-stitch-screen";
    input.converterOutputs[0]!.diagnosticHints = { title: "Patient Editor" };

    const result = produceDesignInteractionGraphV1(input);
    assert.equal(result.status, "rejected");
    assert.equal(result.rejectionCodes.includes("DESIGN_RESPONSE_SCREEN_ID_MISMATCH"), true);
    assert.equal("designGraph" in result, false);
    assert.equal(
      result.diagnostics.some((item) =>
        item.code === "DESIGN_HEURISTIC_HINT_IGNORED" && item.severity === "info"),
      true,
    );
  });

  it("requires an exact accessibility selector for a typed observable outcome", () => {
    const input: any = exactInput();
    const action = input.productSpec.actions[0];
    action.observableEffects = [{
      id: "OBS_SAVE_CONFIRMATION",
      selector: {
        kind: "accessibility",
        surfaceRef: "SURF_EDITOR",
        actionRef: "ACT_SAVE_RECORD",
        role: "button",
        name: "Save Changes",
      },
      assertions: [{ phase: "after", property: "visible_text", operator: "equals", expected: "Saved" }],
      evidenceRef: "EVID_SAVE_CONFIRMATION",
    }];
    action.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
    action.success.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
    input.productSpec.evidencePredicates.push({
      id: "EVID_SAVE_CONFIRMATION",
      kind: "observable_outcome",
      required: true,
      subjectRef: "OBS_SAVE_CONFIRMATION",
      capabilityRefs: ["CAP_BROWSER_INTERACTION"],
      assertion: { operator: "passes" },
    });
    input.converterOutputs[0].controls[0].bindings[0].evidenceRefs.push("EVID_SAVE_CONFIRMATION");

    const produced = produceDesignInteractionGraphV1(input);
    assert.equal(produced.status, "produced", JSON.stringify(produced.diagnostics));

    input.converterOutputs[0].controls[0].accessibility.name = "A different control";
    const rejected = produceDesignInteractionGraphV1(input);
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionCodes.includes("DESIGN_OBSERVABLE_ACCESSIBILITY_UNRESOLVED"), true);
  });
});
