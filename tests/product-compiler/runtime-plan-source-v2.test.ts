import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import { resolveCanonicalProductSpecV2FromPlan } from "../../src/product-compiler/runtime-plan-source-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";

function compiledProductSpec(): any {
  const result = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal: containedGamePlanProposalV2(),
  });
  assert.equal(result.status, "canonicalized");
  if (result.status !== "canonicalized") throw new Error("fixture did not compile");
  return result.productSpec;
}

describe("runtime PLAN ProductSpec v2 source", () => {
  it("resolves one exact canonical compiler projection", () => {
    const productSpec = compiledProductSpec();
    const result = resolveCanonicalProductSpecV2FromPlan({
      text: `# Compatibility view\n\n\`\`\`product-spec-v2\n${canonicalJsonStringify(productSpec)}\n\`\`\`\n`,
    });
    assert.equal(result.status, "resolved");
    if (result.status !== "resolved") return;
    assert.deepEqual(result.productSpec, productSpec);
    assert.equal(result.sourceHash.length, 64);
  });

  it("rejects v1 rather than reconstructing missing placement semantics", () => {
    const productSpec = compiledProductSpec();
    const result = resolveCanonicalProductSpecV2FromPlan({
      text: `\`\`\`product-spec-v1\n${canonicalJsonStringify(productSpec)}\n\`\`\``,
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["PLAN_PRODUCT_SPEC_V2_LEGACY_PROJECTION_FORBIDDEN"]);
  });

  it("rejects duplicate, malformed, and non-canonical projections", () => {
    const productSpec = compiledProductSpec();
    const block = `\`\`\`product-spec-v2\n${canonicalJsonStringify(productSpec)}\n\`\`\``;
    const duplicate = resolveCanonicalProductSpecV2FromPlan({ text: `${block}\n${block}` });
    assert.equal(duplicate.status, "rejected");
    if (duplicate.status === "rejected") {
      assert.deepEqual(duplicate.rejectionCodes, ["PLAN_PRODUCT_SPEC_V2_PROJECTION_COUNT_INVALID"]);
    }

    const malformed = resolveCanonicalProductSpecV2FromPlan({
      text: "```product-spec-v2\n{not-json}\n```",
    });
    assert.equal(malformed.status, "rejected");
    if (malformed.status === "rejected") {
      assert.deepEqual(malformed.rejectionCodes, ["PLAN_PRODUCT_SPEC_V2_JSON_INVALID"]);
    }

    const nonCanonical = resolveCanonicalProductSpecV2FromPlan({
      text: `\`\`\`product-spec-v2\n${JSON.stringify(productSpec, null, 2)}\n\`\`\``,
    });
    assert.equal(nonCanonical.status, "rejected");
    if (nonCanonical.status === "rejected") {
      assert.deepEqual(nonCanonical.rejectionCodes, ["PLAN_PRODUCT_SPEC_V2_PROJECTION_NON_CANONICAL"]);
    }
  });
});
