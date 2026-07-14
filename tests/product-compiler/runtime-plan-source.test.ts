import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { resolveCanonicalProductSpecFromPlan } from "../../src/product-compiler/runtime-plan-source.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";

describe("runtime PLAN ProductSpec source", () => {
  it("resolves the exact canonical typed projection", () => {
    const { productSpec } = buildMinimalValidContracts();
    const text = `# Compatibility PRD\n\n\`\`\`product-spec-v1\n${canonicalJsonStringify(productSpec)}\n\`\`\`\n`;
    const result = resolveCanonicalProductSpecFromPlan({ text });
    assert.equal(result.status, "resolved");
    if (result.status !== "resolved") return;
    assert.deepEqual(result.productSpec, productSpec);
  });

  it("rejects duplicate projections even when both parse", () => {
    const { productSpec } = buildMinimalValidContracts();
    const block = `\`\`\`product-spec-v1\n${canonicalJsonStringify(productSpec)}\n\`\`\``;
    const result = resolveCanonicalProductSpecFromPlan({ text: `${block}\n${block}` });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["PLAN_PRODUCT_SPEC_PROJECTION_COUNT_INVALID"]);
  });

  it("rejects semantically valid but non-canonical JSON bytes", () => {
    const { productSpec } = buildMinimalValidContracts();
    const pretty = JSON.stringify(productSpec, null, 2);
    const result = resolveCanonicalProductSpecFromPlan({
      text: `\`\`\`product-spec-v1\n${pretty}\n\`\`\``,
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["PLAN_PRODUCT_SPEC_PROJECTION_NON_CANONICAL"]);
  });

  it("refuses a legacy/base ProductSpec when the runtime requires the v3 proposal contract", () => {
    const { productSpec } = buildMinimalValidContracts();
    const result = resolveCanonicalProductSpecFromPlan({
      text: `\`\`\`product-spec-v1\n${canonicalJsonStringify(productSpec)}\n\`\`\``,
      requireV3Proposal: true,
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(result.rejectionCodes, ["PLAN_PRODUCT_SPEC_V3_CONTRACT_INCOMPLETE"]);
  });
});
