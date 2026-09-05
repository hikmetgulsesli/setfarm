import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COMPILER_OWNED_CONTEXT_KEYS,
  RECOVERY_SOURCE_BOOTSTRAP_OWNED_CONTEXT_KEYS,
  isStepOutputContextKeyProtected,
} from "../../src/installer/constants.js";
import { mergeContextSafe, parseOutputKeyValues } from "../../src/installer/context-ops.js";

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
    context.product_runtime_behavior_proposal_hash = "c".repeat(64);
    mergeContextSafe(context, {
      plan_output_authority_version: "semantic_only_v2",
      product_runtime_behavior_contract_hash: "b".repeat(64),
      product_runtime_behavior_proposal_hash: "d".repeat(64),
    });
    assert.equal(context.plan_output_authority_version, "product_build_v1");
    assert.equal(context.product_runtime_behavior_contract_hash, "a".repeat(64));
    assert.equal(context.product_runtime_behavior_proposal_hash, "c".repeat(64));
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

  it("rejects every normalized agent-output alias of recovery run authority", () => {
    const context: Record<string, string> = {
      schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1",
      task: "recover the source bootstrap",
      repo: "/setfarm",
      branch: "run-recovery",
      purpose: "recovery-d-source-delivery-v1",
      repository: "setfarm",
      workflow: "feature-dev",
      protocol: "v3",
    };
    const output = JSON.stringify(Object.fromEntries(
      [...RECOVERY_SOURCE_BOOTSTRAP_OWNED_CONTEXT_KEYS]
        .map((key) => [key.toUpperCase(), `forged:${key}`]),
    ));
    const parsed = parseOutputKeyValues(output);
    assert.deepEqual(Object.keys(parsed).sort(), [...RECOVERY_SOURCE_BOOTSTRAP_OWNED_CONTEXT_KEYS].sort());
    const before = structuredClone(context);

    mergeContextSafe(context, parsed);

    assert.deepEqual(context, before);
    for (const key of RECOVERY_SOURCE_BOOTSTRAP_OWNED_CONTEXT_KEYS) {
      assert.equal(isStepOutputContextKeyProtected(key, context), true, key);
    }
  });
});
