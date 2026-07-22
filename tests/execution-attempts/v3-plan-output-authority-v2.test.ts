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
  containedGamePlanProductBuildProposalV1,
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
  it("compiles one atomic build proposal and projects all compiler-owned authority bytes", () => {
    const proposal = containedGamePlanProductBuildProposalV1();
    const parsed = {
      status: "done",
      prd: `Planner preface\n${block("plan-product-build-proposal-v1", proposal)}\nPlanner suffix`,
    };
    const original = structuredClone(parsed);

    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed,
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.sourceTransport, "product_build_proposal_v1");
    assert.equal(authority.sourceProposalHash.length, 64);
    if (authority.sourceTransport !== "product_build_proposal_v1") return;
    assert.equal(authority.sourceSemanticProposalHash.length, 64);
    assert.equal(authority.runtimeBehaviorContract.schema,
      "setfarm.product-runtime-behavior-contract.v1");
    assert.equal(authority.planProductBuildAuthority.schema,
      "setfarm.plan-product-build-authority.v1");
    assert.equal(
      authority.planProductBuildAuthority.outputs.runtimeBehaviorContractHash,
      authority.runtimeBehaviorContract.contractHash,
    );
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
    assert.doesNotMatch(projected.prd, /plan-product-build-proposal-v1/);
    assert.match(projected.prd, /```product-spec-v2/);
    assert.match(projected.prd, /```product-runtime-behavior-contract-v1/);
    assert.match(projected.prd, /```plan-product-build-authority-v1/);
    assert.match(projected.prd, new RegExp(
      authority.canonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.match(projected.prd, new RegExp(
      authority.runtimeBehaviorCanonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.match(projected.prd, new RegExp(
      authority.planProductBuildAuthorityCanonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ));
    assert.deepEqual(parsed, original);
    assert.throws(
      () => projectCanonicalV3PlanParsedOutputV2({
        parsed: {
          ...parsed,
          prd: `${parsed.prd}\n${block("product-spec-v2", authority.productSpec)}`,
        },
        authority,
      }),
      /V3_PLAN_V2_CANONICAL_PROJECTION_SOURCE_MISMATCH/u,
    );
  });

  it("reads semantic-only v2 as explicit compatibility without fabricating behavior", () => {
    const parsed = {
      status: "done",
      prd: block("plan-semantic-proposal-v2", containedGamePlanProposalV2()),
    };
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({ task: CONTAINED_GAME_TASK, parsed }),
      /V3_PLAN_V2_SEMANTIC_ONLY_COMPATIBILITY_NOT_AUTHORIZED/u,
    );
    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed,
      allowSemanticOnlyCompatibility: true,
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.sourceTransport, "semantic_proposal_v2");
    assert.equal("runtimeBehaviorContract" in authority, false);
    const projected = projectCanonicalV3PlanParsedOutputV2({ parsed, authority });
    assert.match(projected.prd, /```product-spec-v2/);
    assert.doesNotMatch(projected.prd, /product-runtime-behavior-contract-v1/);
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
      parsed: {
        prd: block(
          "plan-product-build-proposal-v1",
          containedGamePlanProductBuildProposalV1(),
        ),
      },
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
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: [
            block("plan-product-build-proposal-v1", containedGamePlanProductBuildProposalV1()),
            block("plan-semantic-proposal-v2", containedGamePlanProposalV2()),
          ].join("\n"),
        },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:2:0/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: {
          prd: block(
            "plan-runtime-behavior-proposal-v1",
            containedGamePlanProductBuildProposalV1().runtimeBehavior,
          ),
        },
      }),
      /V3_PLAN_V2_SPLIT_BEHAVIOR_FORBIDDEN/,
    );
  });

  it("bounds PLAN prose before regex and JSON parsing and saturates cardinality", () => {
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: "x".repeat((4 * 1024 * 1024) + 1) },
      }),
      /V3_PLAN_V2_PRD_TOO_LARGE/,
    );
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: 42 } as any,
      }),
      /V3_PLAN_V2_PRD_TYPE_INVALID/,
    );

    const many = Array.from({ length: 1_000 }, () =>
      block("plan-semantic-proposal-v2", {})).join("\n");
    assert.throws(
      () => resolveV3PlanOutputAuthorityV2({
        task: CONTAINED_GAME_TASK,
        parsed: { prd: many },
      }),
      /V3_PLAN_V2_TYPED_ARTIFACT_REQUIRED:2:0/,
    );

    const authority = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: {
        prd: block(
          "plan-product-build-proposal-v1",
          containedGamePlanProductBuildProposalV1(),
        ),
      },
    });
    assert.equal(authority.status, "proposal");
    if (authority.status === "proposal") {
      assert.throws(
        () => projectCanonicalV3PlanParsedOutputV2({
          parsed: { prd: "x".repeat((4 * 1024 * 1024) + 1) },
          authority,
        }),
        /V3_PLAN_V2_PRD_TOO_LARGE/,
      );
    }
  });

  it("bypasses the legacy supervisor only for an accepted v2 PLAN proposal", () => {
    const proposal = resolveV3PlanOutputAuthorityV2({
      task: CONTAINED_GAME_TASK,
      parsed: {
        prd: block(
          "plan-product-build-proposal-v1",
          containedGamePlanProductBuildProposalV1(),
        ),
      },
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
