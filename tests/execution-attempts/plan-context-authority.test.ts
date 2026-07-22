import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPILER_OWNED_CONTEXT_KEYS,
  isStepOutputContextKeyProtected,
} from "../../src/installer/constants.js";
import { mergeContextSafe } from "../../src/installer/context-ops.js";

describe("PLAN compiler-owned context authority", () => {
  it("rejects model introduction as well as overwrite of canonical PLAN keys", () => {
    const context: Record<string, string> = {};
    const attempted = Object.fromEntries(
      [...COMPILER_OWNED_CONTEXT_KEYS].map((key) => [key, `forged:${key}`]),
    );
    mergeContextSafe(context, attempted);
    assert.deepEqual(context, {});

    context.plan_output_authority_version = "product_build_v1";
    context.product_runtime_behavior_contract_hash = "a".repeat(64);
    mergeContextSafe(context, {
      plan_output_authority_version: "semantic_only_v2",
      product_runtime_behavior_contract_hash: "b".repeat(64),
    });
    assert.equal(context.plan_output_authority_version, "product_build_v1");
    assert.equal(context.product_runtime_behavior_contract_hash, "a".repeat(64));
  });

  it("preserves legacy initialize-once behavior for non-compiler protected keys", () => {
    const context: Record<string, string> = {};
    assert.equal(isStepOutputContextKeyProtected("design_required", context), false);
    mergeContextSafe(context, { design_required: "true" });
    assert.equal(context.design_required, "true");
    assert.equal(isStepOutputContextKeyProtected("design_required", context), true);
    mergeContextSafe(context, { design_required: "false" });
    assert.equal(context.design_required, "true");
  });
});
