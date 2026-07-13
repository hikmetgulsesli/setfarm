import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { adaptStitchSources } from "../../src/product-compiler/adapters/stitch.js";
import { linkDesignProjection } from "../../src/product-compiler/design-linker.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function sourceRef(locator: string, hash = HASH_A) {
  return {
    schema: "setfarm.source-artifact-ref.v1" as const,
    hash,
    mediaType: "text/typescript",
    locator,
    byteLength: 100,
  };
}

function projectionFor(
  sourceText: string,
  screenActions?: Array<Record<string, unknown>>,
) {
  const result = adaptStitchSources({
    rawArtifactHashes: [HASH_A],
    ...(screenActions ? {
      screenIndex: {
        source: { ...sourceRef("generated/SCREEN_INDEX.json", HASH_B), mediaType: "application/json" },
        value: [{
          screenId: "editor",
          title: "Editor",
          file: "generated/Editor.tsx",
          actions: screenActions,
        }],
      },
    } : {}),
    generatedSources: [{
      source: sourceRef("generated/Editor.tsx"),
      designSurfaceId: "DSURF_EDITOR",
      surfaceRef: "SURF_EDITOR",
      text: sourceText,
    }],
  });
  assert.ok(result.candidate);
  return result.candidate;
}

describe("exact design linker", () => {
  it("links a same-element ACT/local ID without using its label", () => {
    const { productSpec } = buildMinimalValidContracts();
    const projection = projectionFor(
      '<button data-action="ACT_SAVE_TASK" data-action-id="save-task-1">Arbitrary Label</button>',
    );
    const result = linkDesignProjection({ productSpec, projection });

    assert.ok(result.graph);
    assert.deepEqual(result.exactBindings, [{
      controlRef: projection.controls[0]!.id,
      generatedLocalId: "save-task-1",
      actionRef: "ACT_SAVE_TASK",
      sourceKind: "same_element",
    }]);
    assert.equal(result.graph.bindings[0]?.disposition, "action");
    assert.equal(
      result.diagnostics.some((item) => item.code === "LINK_ACTION_INPUT_BINDING_MISSING"),
      true,
    );
  });

  it("uses structured-index precedence only when exact candidates agree", () => {
    const { productSpec } = buildMinimalValidContracts();
    const projection = projectionFor(
      '<button data-action="ACT_SAVE_TASK" data-action-id="save-task-1">Save</button>',
      [{
        generatedLocalId: "save-task-1",
        actionRef: "ACT_SAVE_TASK",
        kind: "button",
        label: "Save",
      }],
    );
    const result = linkDesignProjection({ productSpec, projection });
    assert.equal(result.exactBindings[0]?.sourceKind, "structured_index");
    assert.equal(result.graph?.unresolvedBindings.length, 0);
  });

  it("rejects conflicting exact candidates instead of hiding them behind precedence", () => {
    const { productSpec } = buildMinimalValidContracts();
    const projection = projectionFor(
      '<button data-action="ACT_OTHER" data-action-id="save-task-1">Save</button>',
      [{
        generatedLocalId: "save-task-1",
        actionRef: "ACT_SAVE_TASK",
        kind: "button",
        label: "Save",
      }],
    );
    const result = linkDesignProjection({ productSpec, projection });
    assert.deepEqual(result.exactBindings, []);
    assert.equal(
      result.graph?.unresolvedBindings[0]?.code,
      "LINK_SEMANTIC_CANDIDATE_CONFLICT",
    );
    assert.equal(
      result.diagnostics.some((item) => item.code === "LINK_SEMANTIC_CANDIDATE_CONFLICT"),
      true,
    );
  });

  it("leaves a label-only control unresolved", () => {
    const { productSpec } = buildMinimalValidContracts();
    const projection = projectionFor(
      '<button data-action-id="save-task-1">Save Task</button>',
    );
    projection.controls[0]!.label = "Save Task";
    const result = linkDesignProjection({ productSpec, projection });
    assert.deepEqual(result.exactBindings, []);
    assert.equal(result.graph?.unresolvedBindings[0]?.code, "LINK_SEMANTIC_ACTION_MISSING");
  });

  it("verifies the approved stable derived control ID formula", () => {
    const { productSpec } = buildMinimalValidContracts();
    const projection = projectionFor(
      '<button data-action="ACT_SAVE_TASK" data-action-id="save-task-1">Save</button>',
    );
    const control = projection.controls[0]!;
    const expected = `CTRL_${createHash("sha256")
      .update(`${control.source.artifactHash}\0${control.source.selector}\0${control.kind}`)
      .digest("hex")
      .slice(0, 16)}`;
    assert.equal(control.id, expected);
    assert.equal(linkDesignProjection({ productSpec, projection }).graph?.controls[0]?.id, expected);

    control.id = "CTRL_0000000000000000";
    const invalid = linkDesignProjection({ productSpec, projection });
    assert.equal(invalid.graph?.unresolvedBindings[0]?.code, "LINK_DERIVED_CONTROL_ID_MISMATCH");
  });

  it("recovers #1925 ACT_SAVE_RECORD/local ID exactly while retaining missing payload", async () => {
    const values = buildMinimalValidContracts();
    const productSpec = structuredClone(values.productSpec);
    productSpec.actions[0]!.id = "ACT_SAVE_RECORD";
    productSpec.evidencePredicates[0]!.subjectRef = "ACT_SAVE_RECORD";
    const source = await readFile(
      path.resolve("evals/fixtures/1925-task-chip/sources/generated-control.tsx"),
      "utf8",
    );
    const saveOnly = source.split("\n").filter((line) =>
      line.includes("ACT_SAVE_RECORD") || line.includes("Save Changes"))
      .join("\n");
    const projection = projectionFor(saveOnly);
    const result = linkDesignProjection({ productSpec, projection });

    assert.equal(
      result.exactBindings.some((binding) =>
        binding.actionRef === "ACT_SAVE_RECORD"
        && binding.generatedLocalId === "save-changes-7"),
      true,
    );
    assert.equal(
      result.diagnostics.some((item) => item.code === "LINK_ACTION_INPUT_BINDING_MISSING"),
      true,
    );
  });
});
