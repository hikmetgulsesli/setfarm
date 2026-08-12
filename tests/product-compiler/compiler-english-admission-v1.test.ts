import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compileCompilerEnglishAdmissionV1,
  compilerEnglishAdmissionReceiptV1,
} from "../../src/product-compiler/compiler-english-admission-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { renderProductSpecV2Compatibility } from "../../src/product-compiler/renderers/product-spec-v2-compatibility.js";
import { resolveV3PlanOutputAuthorityV2 } from "../../src/execution/v3-plan-output-authority-v2.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProductBuildProposalV1,
} from "./fixtures/product-semantics-v2.js";

function fixture() {
  const resolved = resolveV3PlanOutputAuthorityV2({
    task: CONTAINED_GAME_TASK,
    parsed: {
      status: "done",
      prd: `\`\`\`plan-product-build-proposal-v1\n${JSON.stringify(
        containedGamePlanProductBuildProposalV1(),
      )}\n\`\`\``,
    },
  });
  assert.equal(resolved.status, "proposal");
  if (resolved.status !== "proposal") throw new Error("compiler admission fixture rejected");
  const rendered = renderProductSpecV2Compatibility(resolved.productSpec);
  const marker = "\nPRD:\n";
  const markerIndex = rendered.indexOf(marker);
  assert.notEqual(markerIndex, -1);
  const name = resolved.productSpec.product.name;
  return {
    resolved,
    context: {
      product_spec_schema: resolved.productSpec.schema,
      product_spec_hash: hashCanonicalJson(resolved.productSpec),
      product_spec_source_task_hash: resolved.productSpec.traceability.sourceTaskHash,
      ui_language: "English",
      project_name: name,
      project_display_name: name,
      project_slug: "contained-game",
      app_title: name,
      ui_vision_summary: resolved.productSpec.delivery.uiVisionSummary,
      prd: rendered.slice(markerIndex + marker.length),
    },
  };
}

describe("compiler English admission v1", () => {
  it("issues a pathless false-production receipt from exact compiler output", () => {
    const value = fixture();
    const authority = compileCompilerEnglishAdmissionV1({
      claimId: 41,
      runId: "run-compiler-english-admission",
      stepDbId: "step-compiler-english-admission",
      workflowStepId: "plan",
      productSpec: value.resolved.productSpec,
      finalContext: value.context,
    });
    const receipt = compilerEnglishAdmissionReceiptV1(authority);
    assert.equal(receipt.schema, "setfarm.compiler-english-admission-receipt.v1");
    assert.equal(receipt.admissionScope, "compiler_owned_english_publication_surface");
    assert.equal(receipt.productionAuthority, false);
    assert.equal(receipt.productSpecHash, hashCanonicalJson(value.resolved.productSpec));
    assert.equal(Object.isFrozen(authority), true);
    assert.equal(Object.isFrozen(receipt), true);
  });

  it("rejects cloned authority and final ProductSpec or PRD drift", () => {
    const value = fixture();
    const authority = compileCompilerEnglishAdmissionV1({
      claimId: 42,
      runId: "run-compiler-english-admission-drift",
      stepDbId: "step-compiler-english-admission-drift",
      workflowStepId: "plan",
      productSpec: value.resolved.productSpec,
      finalContext: value.context,
    });
    assert.throws(
      () => compilerEnglishAdmissionReceiptV1({ ...authority }),
      /COMPILER_ENGLISH_ADMISSION_AUTHORITY_UNAUTHENTICATED/,
    );
    assert.throws(
      () => compileCompilerEnglishAdmissionV1({
        claimId: 43,
        runId: "run-compiler-english-admission-drifted-prd",
        stepDbId: "step-compiler-english-admission-drifted-prd",
        workflowStepId: "plan",
        productSpec: value.resolved.productSpec,
        finalContext: { ...value.context, prd: `${value.context.prd}\nDrifted output.` },
      }),
      /COMPILER_ENGLISH_ADMISSION_PRD_BINDING_INVALID/,
    );
    assert.throws(
      () => compileCompilerEnglishAdmissionV1({
        claimId: 44,
        runId: "run-compiler-english-admission-drifted-spec",
        stepDbId: "step-compiler-english-admission-drifted-spec",
        workflowStepId: "plan",
        productSpec: value.resolved.productSpec,
        finalContext: { ...value.context, product_spec_hash: "0".repeat(64) },
      }),
      /COMPILER_ENGLISH_ADMISSION_CONTEXT_BINDING_INVALID/,
    );
  });
});
