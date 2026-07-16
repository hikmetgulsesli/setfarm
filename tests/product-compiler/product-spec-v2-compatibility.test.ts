import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";

function containedGameSpec(): ProductSpecV2 {
  const result = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(result.status, "canonicalized");
  if (result.status !== "canonicalized") throw new Error("fixture did not compile");
  return result.productSpec;
}

function headingBlock(rendered: string, heading: string): string {
  const start = rendered.indexOf(`${heading}\n`);
  assert.notEqual(start, -1, `missing block ${heading}`);
  const remainder = rendered.slice(start + heading.length + 1);
  const nextHeading = remainder.search(/^### (?:ACTION|SURFACE):|^## \d+\./m);
  return nextHeading === -1
    ? rendered.slice(start)
    : rendered.slice(start, start + heading.length + 1 + nextHeading);
}

describe("ProductSpec v2 compatibility renderer", () => {
  it("preserves the full legacy PLAN markers and exact canonical v2 fence", () => {
    const spec = containedGameSpec();
    const first = renderProductSpecV2Compatibility(spec);
    const second = renderProductSpecV2Compatibility(structuredClone(spec));

    assert.equal(second, first);
    for (const marker of [
      "CONTRACT_SCHEMA_VERSION: setfarm.plan.v2.2",
      "STATUS: done",
      "PROJECT_NAME: Contained Game",
      "PROJECT_SLUG: contained-game",
      "PLATFORM: game",
      "TECH_STACK: browser-game",
      "UI_LANGUAGE: English",
      "DB_REQUIRED: none",
      "DESIGN_REQUIRED: true",
      "UI_VISION_SUMMARY:",
      "PRODUCT_SPEC_SCHEMA: setfarm.product-spec.v2",
      "PRD:",
      "## 1. Context And Goals",
      "## 2. Data And State Contract",
      "## 3. Behavioral And Action Contract",
      "## 4. Product Surfaces",
      "## 5. Validation And Error Strategy",
      "## 6. System Contracts",
      "### mock_data_contract",
      "### data_access_contract",
      "### environment_contract",
      "## 7. Platform Contract",
      "## 8. Testability Contract",
      "## 9. Out Of Scope",
      "## 10. Typed ProductSpec Projection",
    ]) {
      assert.ok(first.includes(marker), `missing legacy marker: ${marker}`);
    }
    assert.ok(first.includes(
      `\`\`\`product-spec-v2\n${canonicalJsonStringify(spec)}\n\`\`\``,
    ));
    assert.doesNotMatch(first, /```product-spec-v1/);
  });

  it("renders one Start control on Play Page and zero controls on contained effect surfaces", () => {
    const rendered = renderProductSpecV2Compatibility(containedGameSpec());
    const action = headingBlock(rendered, "### ACTION: ACT_START_GAME");
    const playPage = headingBlock(rendered, "### SURFACE: SURF_PLAY_PAGE");
    const gameCanvas = headingBlock(rendered, "### SURFACE: SURF_GAME_CANVAS");
    const statusPanel = headingBlock(rendered, "### SURFACE: SURF_STATUS_PANEL");

    assert.match(action, /^- Surface Bound: SURF_PLAY_PAGE$/m);
    assert.match(action, /^- Surface Refs: SURF_PLAY_PAGE$/m);
    assert.match(
      action,
      /^- Control Slots: CSLOT_START_GAME_PRIMARY_START \(surface=SURF_PLAY_PAGE; control_hint=primary_button\)$/m,
    );
    assert.match(
      action,
      /^- Affected Surface Refs: SURF_GAME_CANVAS, SURF_STATUS_PANEL$/m,
    );
    assert.match(action, /Control Slots are rendered controls; Affected Surface Refs are observable effect targets only/);

    assert.match(playPage, /^- Representation: standalone$/m);
    assert.match(playPage, /^- Host Surface ID: none$/m);
    assert.match(playPage, /^- Permitted Actions: ACT_START_GAME \(control_hint: primary_button\)$/m);
    assert.match(
      playPage,
      /^- Control Slots: CSLOT_START_GAME_PRIMARY_START \(ACT_START_GAME; control_hint: primary_button\)$/m,
    );
    assert.equal(playPage.match(/CSLOT_START_GAME_PRIMARY_START/g)?.length, 1);
    assert.match(playPage, /^- Affected By Actions: none$/m);

    for (const contained of [gameCanvas, statusPanel]) {
      assert.match(contained, /^- Representation: inline$/m);
      assert.match(contained, /^- Host Surface ID: SURF_PLAY_PAGE$/m);
      assert.match(contained, /^- Permitted Actions: none$/m);
      assert.match(contained, /^- Control Slots: none$/m);
      assert.match(contained, /^- Control Hint: none$/m);
      assert.match(contained, /^- Affected By Actions: ACT_START_GAME$/m);
      assert.doesNotMatch(contained, /CSLOT_START_GAME_PRIMARY_START/);
      assert.doesNotMatch(contained, /control_hint: primary_button/);
    }
  });

  it("rejects legacy or otherwise non-strict ProductSpec input", () => {
    const invalid: any = structuredClone(containedGameSpec());
    invalid.actions[0]!.surfaceRefs = [
      "SURF_PLAY_PAGE",
      "SURF_GAME_CANVAS",
      "SURF_STATUS_PANEL",
    ];
    assert.throws(
      () => renderProductSpecV2Compatibility(invalid),
      /Unrecognized key|surfaceRefs/i,
    );
  });
});
