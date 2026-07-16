import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  projectCanonicalV3PlanParsedOutputV2,
  resolveV3PlanOutputAuthorityV2,
  shouldRunLegacyProductSupervisorV2,
  V3PlanOutputV2RejectedError,
} from "../../src/execution/v3-plan-output-authority-v2.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  CONTAINED_GAME_TASK,
  containedGamePlanProposalV2,
} from "../product-compiler/fixtures/product-semantics-v2.js";

function block(kind: string, value: unknown): string {
  return `\`\`\`${kind}\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function typedRejection(overrides: Record<string, unknown> = {}): any {
  const ledger = extractTaskRequirementLedgerV1(CONTAINED_GAME_TASK);
  return {
    schema: "setfarm.product-spec-rejection.v1",
    sourceTaskHash: ledger.sourceHash,
    reasons: [{
      code: "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
      requirementRefs: ledger.requirements.map((requirement) => requirement.id),
      message: "The requested external runtime owner is unspecified.",
    }],
    ...overrides,
  };
}

describe("PLAN v3 product semantics v2 output authority", () => {
  it("compiles one primary v2 proposal and projects immutable compiler-owned ProductSpec v2 bytes", () => {
    const proposal = containedGamePlanProposalV2();
    const parsed = {
      status: "done",
      prd: `Planner preface\n${block("plan-semantic-proposal-v2", proposal)}\nPlanner suffix`,
    };
    const original = structuredClone(parsed);

    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed,
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.sourceTransport, "semantic_proposal_v2");
    assert.equal(authority.sourceProposalHash.length, 64);
    assert.equal(authority.productSpec.schema, "setfarm.product-spec.v2");
    assert.equal(authority.productSpec.routes[0]?.rootSurfaceRef, "SURF_PLAY_PAGE");
    assert.deepEqual(authority.productSpec.actions[0]?.controlPlacements, [{
      id: "CSLOT_START_GAME_PRIMARY_START",
      surfaceRef: "SURF_PLAY_PAGE",
      controlHint: "primary_button",
    }]);
    assert.deepEqual(
      authority.productSpec.actions[0]?.affectedSurfaceRefs,
      ["SURF_GAME_CANVAS", "SURF_STATUS_PANEL"],
    );
    assert.equal(authority.canonicalBytes, canonicalJsonStringify(authority.productSpec));

    const projected = projectCanonicalV3PlanParsedOutputV2({ parsed, authority });
    assert.doesNotMatch(projected.prd, /plan-semantic-proposal-v2/);
    assert.match(projected.prd, /```product-spec-v2/);
    assert.match(projected.prd, new RegExp(
      authority.canonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.deepEqual(parsed, original);
  });

  it("rejects lossy v1 semantics instead of inventing control placement authority", () => {
    const legacy = {
      ...containedGamePlanProposalV2(),
      schema: "setfarm.plan-semantic-proposal.v1",
    };
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: block("plan-semantic-proposal-v1", legacy) },
      }),
      (error: unknown) => {
        assert.ok(error instanceof V3PlanOutputV2RejectedError);
        assert.equal(error.message, "V3_PLAN_V2_LEGACY_SEMANTICS_FORBIDDEN");
        return true;
      },
    );
  });

  it("rejects planner-owned ProductSpec v2 even when its bytes were previously compiled", () => {
    const proposalAuthority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { prd: block("plan-semantic-proposal-v2", containedGamePlanProposalV2()) },
    });
    assert.equal(proposalAuthority.status, "proposal");
    if (proposalAuthority.status !== "proposal") return;

    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: block("product-spec-v2", proposalAuthority.productSpec) },
      }),
      /V3_PLAN_V2_COMPILER_PROJECTION_FORBIDDEN/,
    );
  });

  it("accepts and task-binds one typed refusal without invoking the product compiler", () => {
    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { prd: block("product-spec-rejection-v1", typedRejection()) },
    });
    assert.equal(authority.status, "rejection");
    if (authority.status !== "rejection") return;
    assert.equal(authority.rejection.reasons[0]?.code, "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING");

    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: [
            block("product-spec-rejection-v1", typedRejection()),
            block("product-spec-rejection-v1", typedRejection()),
          ].join("\n"),
        },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:2/,
    );
  });

  it("rejects missing or mixed typed transports before retry classification", () => {
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: "No typed artifact" },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:0:0/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: `${block("plan-semantic-proposal-v2", containedGamePlanProposalV2())}\n${block("product-spec-rejection-v1", typedRejection())}`,
        },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:1:1/,
    );
  });

  it("bypasses the legacy supervisor only for an accepted v2 PLAN proposal", () => {
    const proposal = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { prd: block("plan-semantic-proposal-v2", containedGamePlanProposalV2()) },
    });
    const refusal = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: { prd: block("product-spec-rejection-v1", typedRejection()) },
    });
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "v3",
      stepId: "plan",
      planAuthority: proposal,
    }), false);
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "v3",
      stepId: "plan",
      planAuthority: refusal,
    }), true);
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "shadow",
      stepId: "plan",
      planAuthority: proposal,
    }), true);
    assert.equal(shouldRunLegacyProductSupervisorV2({
      protocol: "v3",
      stepId: "design",
      planAuthority: proposal,
    }), true);
  });
});
