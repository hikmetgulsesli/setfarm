import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveV3PlanOutputAuthorityV1,
  shouldRunLegacyProductSupervisorV1,
  V3PlanOutputRejectedError,
} from "../../src/execution/v3-plan-output-authority.js";
import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { buildMinimalValidContracts } from "../product-compiler/fixtures/minimal-valid-contract.js";

const TASK = "Let a user edit and save a task, keep the saved title after reload, and show visible confirmation.";

function proposal(): any {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const value: any = structuredClone(buildMinimalValidContracts().productSpec);
  const action = value.actions[0];
  action.observableEffects = [{
    id: "OBS_SAVE_CONFIRMATION",
    selector: { kind: "control", actionRef: action.id },
    assertions: [
      { phase: "before", property: "visible_text", operator: "equals", expected: "Save" },
      { phase: "after", property: "visible_text", operator: "equals", expected: "Saved" },
      { phase: "reload", property: "visible_text", operator: "equals", expected: "Saved" },
    ],
    evidenceRef: "EVID_SAVE_CONFIRMATION",
  }];
  action.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
  action.success.evidenceRefs.push("EVID_SAVE_CONFIRMATION");
  value.evidencePredicates.push({
    id: "EVID_SAVE_CONFIRMATION",
    kind: "observable_outcome",
    required: true,
    subjectRef: "OBS_SAVE_CONFIRMATION",
    capabilityRefs: ["CAP_BROWSER_INTERACTION"],
    assertion: { operator: "passes" },
  });
  value.delivery = {
    platform: "web",
    techStack: "vite-react",
    uiLanguage: "English",
    database: "none",
    designRequired: true,
    uiVisionSummary: "A focused editor exposes the save control and visible saved state without unrelated product modules.",
  };
  value.requirements = ledger.requirements.map((requirement) => ({
    ...requirement,
    classification: "functional",
    expectedSemanticKinds: ["action", "persistence", "observable"],
  }));
  const requirementRefs = ledger.requirements.map((requirement) => requirement.id);
  const semantics = [
    ...value.product.goals.map((entry: any) => ["goal", entry.id]),
    ...value.product.nonGoals.map((entry: any) => ["non_goal", entry.id]),
    ...value.entities.map((entry: any) => ["entity", entry.id]),
    ...value.states.map((entry: any) => ["state", entry.id]),
    ...value.persistencePolicies.map((entry: any) => ["persistence", entry.id]),
    ...value.routes.map((entry: any) => ["route", entry.id]),
    ...value.surfaces.map((entry: any) => ["surface", entry.id]),
    ...value.actions.map((entry: any) => ["action", entry.id]),
    ...value.evidencePredicates.map((entry: any) => ["evidence", entry.id]),
    ["observable", "OBS_SAVE_CONFIRMATION"],
  ];
  value.traceability = {
    schema: "setfarm.product-requirement-traceability.v1",
    sourceTaskHash: ledger.sourceHash,
    bindings: semantics.map(([semanticKind, semanticRef]) => ({
      semanticKind,
      semanticRef,
      requirementRefs,
    })),
  };
  return value;
}

function rejection(overrides: Record<string, unknown> = {}): any {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  return {
    schema: "setfarm.product-spec-rejection.v1",
    sourceTaskHash: ledger.sourceHash,
    reasons: [{
      code: "PRODUCT_SPEC_REQUIRED_INFORMATION_MISSING",
      requirementRefs: ledger.requirements.map((requirement) => requirement.id),
      message: "The external persistence owner is not specified.",
    }],
    ...overrides,
  };
}

describe("PLAN v3 output authority", () => {
  it("bypasses the legacy Product Supervisor only for a canonical typed v3 proposal", () => {
    const authority = resolveV3PlanOutputAuthorityV1({
      task: TASK,
      parsed: {
        status: "done",
        prd: `\`\`\`product-spec-v1\n${JSON.stringify(proposal(), null, 2)}\n\`\`\``,
      },
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.canonicalBytes, canonicalJsonStringify(authority.productSpec));
    assert.equal(authority.deliverySelection.profileId, "PROFILE_WEB_REACT_EXACT_V1");
    assert.equal(authority.deliverySelection.stackPackId, "vite-react-web-app");
    assert.equal(authority.deliverySelectionHash.length, 64);
    assert.equal(shouldRunLegacyProductSupervisorV1({
      protocol: "v3",
      stepId: "plan",
      planAuthority: authority,
    }), false);
  });

  it("rejects planner-owned static delivery for a utility with an exact profile delta", () => {
    const invalid = proposal();
    invalid.delivery.techStack = "static-html";

    assert.throws(
      () => resolveV3PlanOutputAuthorityV1({
        task: TASK,
        parsed: { prd: `\`\`\`product-spec-v1\n${JSON.stringify(invalid)}\n\`\`\`` },
      }),
      (error: unknown) => {
        assert.ok(error instanceof V3PlanOutputRejectedError);
        assert.equal(error.diagnostics.some((item) =>
          item.code === "PRODUCT_SPEC_DELIVERY_STACK_MISMATCH"
          && item.path === "/delivery/techStack"), true);
        return true;
      },
    );
  });

  it("selects the browser-game profile from semantic class without task-language regex", () => {
    const game = proposal();
    game.product.class = "game";
    game.delivery.platform = "game";
    game.delivery.techStack = "browser-game";
    const authority = resolveV3PlanOutputAuthorityV1({
      task: TASK,
      parsed: { prd: `\`\`\`product-spec-v1\n${JSON.stringify(game)}\n\`\`\`` },
    });

    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.deliverySelection.profileId, "PROFILE_BROWSER_GAME_REACT_CANVAS_EXACT_V1");
    assert.equal(authority.deliverySelection.stackPackId, "browser-game-canvas");
  });

  it("rejects an explicit stack prefix that has no exact v3 design projection", () => {
    assert.throws(
      () => resolveV3PlanOutputAuthorityV1({
        task: TASK,
        requestedStackPackId: "static-html-site",
        parsed: { prd: `\`\`\`product-spec-v1\n${JSON.stringify(proposal())}\n\`\`\`` },
      }),
      (error: unknown) => {
        assert.ok(error instanceof V3PlanOutputRejectedError);
        assert.deepEqual(error.diagnostics.map((item) => item.code), ["PRODUCT_DELIVERY_EXPLICIT_STACK_UNSUPPORTED"]);
        return true;
      },
    );
  });

  it("rejects visual delivery that disables design before DESIGN can consume a contradictory packet", () => {
    const invalid = proposal();
    invalid.delivery.designRequired = false;

    assert.throws(
      () => resolveV3PlanOutputAuthorityV1({
        task: TASK,
        parsed: {
          status: "done",
          prd: `\`\`\`product-spec-v1\n${JSON.stringify(invalid, null, 2)}\n\`\`\``,
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof V3PlanOutputRejectedError);
        assert.equal(error.diagnostics.some((item) =>
          item.path === "/delivery/designRequired"
          && item.message.includes("DESIGN_V1_VISUAL_PLATFORM_REQUIRES_DESIGN")), true);
        return true;
      },
    );
  });

  it("fails forged task hashes and requirement refs closed before retry routing", () => {
    assert.throws(
      () => resolveV3PlanOutputAuthorityV1({
        task: TASK,
        parsed: {
          prd: `\`\`\`product-spec-rejection-v1\n${JSON.stringify(rejection({ sourceTaskHash: "0".repeat(64) }))}\n\`\`\``,
        },
      }),
      /PRODUCT_SPEC_REJECTION_TASK_HASH_MISMATCH/,
    );
    const unknown = rejection();
    unknown.reasons[0].requirementRefs = ["REQ_0000000000000000"];
    assert.throws(
      () => resolveV3PlanOutputAuthorityV1({
        task: TASK,
        parsed: {
          prd: `\`\`\`product-spec-rejection-v1\n${JSON.stringify(unknown)}\n\`\`\``,
        },
      }),
      /PRODUCT_SPEC_REJECTION_REQUIREMENT_UNKNOWN/,
    );
  });

  it("leaves legacy and shadow PLAN supervisor behavior unchanged", () => {
    const authority = resolveV3PlanOutputAuthorityV1({
      task: TASK,
      parsed: { prd: `\`\`\`product-spec-v1\n${JSON.stringify(proposal())}\n\`\`\`` },
    });
    assert.equal(shouldRunLegacyProductSupervisorV1({
      protocol: "legacy",
      stepId: "plan",
      planAuthority: authority,
    }), true);
    assert.equal(shouldRunLegacyProductSupervisorV1({
      protocol: "shadow",
      stepId: "plan",
      planAuthority: authority,
    }), true);
    assert.equal(shouldRunLegacyProductSupervisorV1({
      protocol: "v3",
      stepId: "design",
      planAuthority: authority,
    }), true);
  });
});
