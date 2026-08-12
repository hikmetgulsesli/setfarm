import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  buildV3BatchStitchPromptV2,
  extractCanonicalProductSpecV2FromPrd,
  prepareV3DesignContractV2,
} from "../../src/product-compiler/v3-design-contract-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";

function planPrd(): string {
  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(compiled.status, "canonicalized");
  if (compiled.status !== "canonicalized") throw new Error("fixture compilation failed");
  return `# Compatibility view\n\n\`\`\`product-spec-v2\n${compiled.canonicalBytes}\n\`\`\``;
}

describe("v3 ProductSpec v2 DESIGN contract", () => {
  it("extracts only one canonical v2 projection and never promotes v1", () => {
    const prd = planPrd();
    assert.equal(extractCanonicalProductSpecV2FromPrd(prd).schema, "setfarm.product-spec.v2");
    assert.throws(
      () => extractCanonicalProductSpecV2FromPrd(prd.replaceAll("product-spec-v2", "product-spec-v1")),
      /DESIGN_V2_LEGACY_PRODUCT_SPEC_FORBIDDEN/,
    );
    const parsed = extractCanonicalProductSpecV2FromPrd(prd);
    assert.throws(
      () => extractCanonicalProductSpecV2FromPrd(
        `\`\`\`product-spec-v2\n${JSON.stringify(parsed, null, 2)}\n\`\`\``,
      ),
      /not Setfarm Canonical JSON/,
    );
  });

  it("compiles one route-root target that owns its contained surfaces and one exact control slot", () => {
    const contract = prepareV3DesignContractV2(planPrd());
    assert.equal(contract.generationTargets.targets.length, 1);
    const target = contract.generationTargets.targets[0]!;
    assert.equal(target.surfaceRef, "SURF_PLAY_PAGE");
    assert.deepEqual(target.containedSurfaceRefs, ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"]);
    assert.deepEqual(target.requiredControlPlacements.map((placement) => ({
      slot: placement.controlSlotRef,
      action: placement.actionRef,
      surface: placement.surfaceRef,
    })), [{
      slot: "CSLOT_START_GAME_PRIMARY_START",
      action: "ACT_START_GAME",
      surface: "SURF_PLAY_PAGE",
    }]);
    assert.deepEqual(target.affectingActionRefs, ["ACT_START_GAME"]);
  });

  it("requests physical controls only from placements while preserving phase and accessibility evidence", () => {
    const contract = prepareV3DesignContractV2(planPrd());
    const prompt = buildV3BatchStitchPromptV2({
      contract,
      targetRefs: contract.generationTargets.targets.map((target) => target.targetId),
      deviceType: "DESKTOP",
      stageId: "STAGE_01",
    });
    assert.match(prompt, /All visible user-facing text must be in English\./);
    assert.match(prompt, /exact_same_element_attributes: data-action="ACT_START_GAME" data-control-slot="CSLOT_START_GAME_PRIMARY_START"/);
    assert.match(prompt, /surface_ref: SURF_GAME_CANVAS[\s\S]*composition: contained[\s\S]*host_surface_ref: SURF_PLAY_PAGE/);
    assert.match(prompt, /affecting_action_refs_context_only: ACT_START_GAME/);
    assert.match(prompt, /"phase":"after"/);
    assert.match(prompt, /"kind":"accessibility"/);
    assert.match(prompt, /native named elements are valid/);
    assert.match(prompt, /required only after\/reload may be represented by a semantically present hidden placeholder/);
    assert.equal(
      (prompt.match(/exact_same_element_attributes: data-action="ACT_START_GAME"/g) || []).length,
      1,
    );
    assert.doesNotMatch(
      prompt,
      /owning_surface_ref: SURF_(?:GAME_CANVAS|STATUS_PANEL)/,
    );
    assert.equal(canonicalJsonStringify(contract.generationTargets).includes("surfaceRefs"), false);
  });

  it("rejects a canonical ProductSpec whose publication text is not English", () => {
    const parsed = extractCanonicalProductSpecV2FromPrd(planPrd());
    const contaminated = {
      ...parsed,
      product: {
        ...parsed.product,
        name: `Game${String.fromCharCode(0x00e9)}`,
      },
    };
    const fence = String.fromCharCode(96).repeat(3);
    assert.throws(
      () => extractCanonicalProductSpecV2FromPrd(
        `${fence}product-spec-v2\n${canonicalJsonStringify(contaminated)}\n${fence}`,
      ),
      /DESIGN_V2_PRODUCT_SPEC_PROJECTION_INVALID/,
    );
  });
});
