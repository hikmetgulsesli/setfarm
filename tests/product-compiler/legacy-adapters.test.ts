import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { adaptLegacyPlan } from "../../src/product-compiler/adapters/legacy-plan.js";
import { adaptLegacyStories } from "../../src/product-compiler/adapters/legacy-stories.js";
import { adaptSetupTopology } from "../../src/product-compiler/adapters/setup-topology.js";
import { adaptStitchSources } from "../../src/product-compiler/adapters/stitch.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function sourceRef(locator: string, hash = HASH_A) {
  return {
    schema: "setfarm.source-artifact-ref.v1" as const,
    hash,
    mediaType: locator.endsWith(".json") ? "application/json" : "text/markdown",
    locator,
    byteLength: 100,
  };
}

describe("provenance-preserving legacy adapters", () => {
  it("accepts an exact structured ProductSpec without rewriting IDs", () => {
    const { productSpec } = buildMinimalValidContracts();
    const result = adaptLegacyPlan({
      source: sourceRef("plan/product-spec.json"),
      text: JSON.stringify(productSpec),
    });
    assert.deepEqual(result.candidate, productSpec);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(result.provenance[0]?.confidence, "exact");
    assert.equal(result.candidate?.actions[0]?.id, "ACT_SAVE_TASK");
  });

  it("reports exact legacy action/surface refs but does not fabricate ProductSpec", async () => {
    const text = await readFile(
      path.resolve("evals/fixtures/1925-task-chip/sources/plan-gap.md"),
      "utf8",
    );
    const result = adaptLegacyPlan({
      source: sourceRef("plan/plan-gap.md"),
      text,
    });
    assert.equal(result.candidate, undefined);
    assert.equal(
      result.diagnostics.some((item) =>
        item.code === "ADAPTER_EXACT_ACTION_SURFACE_REF"
        && item.reference === "ACT_FILTER_INSIGHTS->SURF_INSIGHTS"),
      true,
    );
    assert.equal(
      result.diagnostics.some((item) => item.code === "CONTRACT_PRODUCT_SPEC_MISSING"),
      true,
    );
    assert.equal(result.provenance.every((item) => item.confidence === "exact"), true);
  });

  it("retains structured and same-element semantic candidates without label guesses", () => {
    const source = [
      '<button data-action="ACT_SAVE_RECORD" data-action-id="save-changes-7">Save Changes</button>',
      '<button data-action-id="cancel-6">Cancel</button>',
    ].join("\n");
    const result = adaptStitchSources({
      rawArtifactHashes: [HASH_A],
      screenIndex: {
        source: sourceRef("generated/SCREEN_INDEX.json", HASH_B),
        value: [{
          screenId: "screen-editor",
          title: "Editor",
          file: "generated/Editor.tsx",
          actions: [
            {
              generatedLocalId: "save-changes-7",
              actionRef: "ACT_SAVE_RECORD",
              kind: "button",
              label: "Save Changes",
            },
            { id: "cancel-6", kind: "button", label: "Cancel" },
          ],
        }],
      },
      generatedSources: [{
        source: { ...sourceRef("generated/Editor.tsx"), mediaType: "text/typescript" },
        designSurfaceId: "DSURF_EDITOR",
        surfaceRef: "SURF_EDITOR",
        text: source,
      }],
    });

    assert.ok(result.candidate);
    const save = result.candidate.controls.find((control) =>
      control.generatedLocalId === "save-changes-7");
    const cancel = result.candidate.controls.find((control) =>
      control.generatedLocalId === "cancel-6");
    assert.deepEqual(
      save?.semanticCandidates.map((candidate) => candidate.sourceKind).sort(),
      ["same_element", "structured_index"],
    );
    assert.equal(save?.semanticCandidates.every((candidate) => candidate.actionRef === "ACT_SAVE_RECORD"), true);
    assert.deepEqual(cancel?.semanticCandidates, []);
    assert.equal(
      result.diagnostics.some((item) =>
        item.reference === "cancel-6"
        && item.code === "ADAPTER_SEMANTIC_ACTION_MISSING"),
      true,
    );
  });

  it("never upgrades a matching label into a semantic action", () => {
    const result = adaptStitchSources({
      rawArtifactHashes: [HASH_A],
      screenIndex: {
        source: sourceRef("generated/SCREEN_INDEX.json", HASH_B),
        value: [{
          screenId: "screen-editor",
          title: "Editor",
          actions: [{ id: "save-1", kind: "button", label: "Save Task" }],
        }],
      },
      generatedSources: [],
    });
    assert.ok(result.candidate);
    assert.deepEqual(result.candidate.controls[0]?.semanticCandidates, []);
    assert.equal(
      result.diagnostics.some((item) => item.code === "ADAPTER_HEURISTIC_LABEL_SUGGESTION"),
      true,
    );
  });

  it("does not join equal local IDs across different source files", () => {
    const result = adaptStitchSources({
      rawArtifactHashes: [HASH_A],
      screenIndex: {
        source: sourceRef("generated/SCREEN_INDEX.json", HASH_B),
        value: [{
          screenId: "screen-a",
          title: "Screen A",
          file: "generated/ScreenA.tsx",
          actions: [{
            generatedLocalId: "save-1",
            actionRef: "ACT_SAVE_TASK",
            kind: "button",
            label: "Save",
          }],
        }],
      },
      generatedSources: [{
        source: { ...sourceRef("generated/ScreenB.tsx"), mediaType: "text/typescript" },
        designSurfaceId: "DSURF_EDITOR",
        surfaceRef: "SURF_EDITOR",
        text: '<button data-action="ACT_SAVE_RECORD" data-action-id="save-1">Save</button>',
      }],
    });
    assert.equal(result.candidate?.controls.length, 2);
    assert.equal(
      result.candidate?.controls.some((control) => control.semanticCandidates.length === 2),
      false,
    );
  });

  it("returns a typed diagnostic instead of throwing on an invalid projection", () => {
    const result = adaptStitchSources({
      rawArtifactHashes: [HASH_A],
      generatedSources: [{
        source: { ...sourceRef("generated/Editor.tsx"), mediaType: "text/typescript" },
        designSurfaceId: "DSURF_EDITOR",
        surfaceRef: "SURF_EDITOR",
        text: [
          '<button data-action-id="duplicate-1">First</button>',
          '<button data-action-id="duplicate-1">Second</button>',
        ].join("\n"),
      }],
    });
    assert.equal(result.candidate, undefined);
    assert.equal(
      result.diagnostics.some((item) => item.code === "ADAPTER_STITCH_PROJECTION_INVALID"),
      true,
    );
  });

  it("projects exact story refs without minting or renaming actions", () => {
    const result = adaptLegacyStories({
      source: sourceRef("stories/stories.json"),
      rows: [{
        storyId: "US-001",
        order: 1,
        title: "Save task",
        description: "Implement exact save behavior.",
        ownerRef: "OWNER_US_001",
        dependsOn: [],
        surfaceRefs: ["SURF_EDITOR"],
        controlRefs: ["CTRL_SAVE_TASK"],
        actionRefs: ["ACT_SAVE_TASK"],
        stateRefs: ["STATE_EDITOR"],
        persistenceRefs: ["PERSIST_TASK_LOCAL"],
        evidenceRefs: ["EVID_SAVE_RELOAD"],
        ownedPathRefs: ["PATH_APP"],
        sharedGrantRefs: [],
      }],
    });
    assert.equal(result.candidate?.stories[0]?.actionRefs[0], "ACT_SAVE_TASK");
    assert.equal(result.provenance[0]?.confidence, "derived_with_provenance");

    const invalid = adaptLegacyStories({
      source: sourceRef("stories/invalid.json"),
      rows: [{
        storyId: "US-001",
        order: 1,
        title: "Save task",
        description: "Invalid renamed action.",
        ownerRef: "OWNER_US_001",
        dependsOn: [],
        surfaceRefs: ["SURF_EDITOR"],
        controlRefs: [],
        actionRefs: ["save-task"],
        stateRefs: [],
        persistenceRefs: [],
        evidenceRefs: ["EVID_SAVE_RELOAD"],
        ownedPathRefs: ["PATH_APP"],
        sharedGrantRefs: [],
      }],
    });
    assert.equal(invalid.candidate, undefined);
    assert.equal(invalid.diagnostics.some((item) => item.code === "ADAPTER_STORY_CONTRACT_INVALID"), true);
  });

  it("accepts an explicit complete topology and rejects invalid legacy paths", () => {
    const { buildTopology } = buildMinimalValidContracts();
    const exact = adaptSetupTopology({
      sources: [sourceRef("setup/SETUP_CERTIFICATE.json")],
      topology: buildTopology,
    });
    assert.deepEqual(exact.candidate, buildTopology);
    assert.equal(exact.provenance[0]?.confidence, "derived_with_provenance");

    const invalidTopology = structuredClone(buildTopology);
    invalidTopology.pathBindings[0]!.path = "/tmp/App.tsx";
    const invalid = adaptSetupTopology({
      sources: [sourceRef("setup/SETUP_CERTIFICATE.json")],
      topology: invalidTopology,
    });
    assert.equal(invalid.candidate, undefined);
    assert.equal(invalid.diagnostics.some((item) => item.code === "ADAPTER_TOPOLOGY_CONTRACT_INVALID"), true);
  });
});
