import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  projectCanonicalV3PlanParsedOutputV1,
  resolveV3PlanOutputAuthorityV1,
  shouldRunLegacyProductSupervisorV1,
  V3PlanOutputRejectedError,
} from "../../src/execution/v3-plan-output-authority.js";
import { validateOutput as validatePlanOutput } from "../../src/installer/steps/01-plan/guards.js";
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

function semanticProposal(): any {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const requirementRef = ledger.requirements[0]!.id;
  return {
    schema: "setfarm.plan-semantic-proposal.v1",
    sourceTaskHash: ledger.sourceHash,
    product: {
      key: "task_editor",
      name: "Task Editor",
      class: "operations",
      uiLanguage: "en",
      database: "none",
      uiVisionSummary: "A focused task editor with a clear save control, an explicit saved confirmation region, and a compact single-route layout that keeps the current title visible.",
      goals: [{ key: "save_task", statement: "Edit and persist a task title with visible confirmation.", requirementRefs: [requirementRef] }],
      nonGoals: [],
    },
    requirements: [{
      id: requirementRef,
      classification: "functional",
      expectedSemanticKinds: ["entity", "state", "persistence", "route", "surface", "action", "observable"],
    }],
    entities: [{
      key: "task",
      name: "Task",
      fields: [{ key: "title", name: "title", valueType: "string", required: true }],
      requirementRefs: [requirementRef],
    }],
    states: [{
      key: "task",
      name: "Task State",
      kind: "domain",
      initialValue: { title: "" },
      invariants: ["The task title is always a string."],
      requirementRefs: [requirementRef],
    }],
    persistencePolicies: [{
      key: "task_local",
      kind: "local_storage",
      entityKeys: ["task"],
      rehydration: { kind: "initialization" },
      requirementRefs: [requirementRef],
    }],
    routes: [{ key: "tasks", path: "/tasks", entry: true, requirementRefs: [requirementRef] }],
    surfaces: [{
      key: "task_page",
      name: "Task Page",
      kind: "page",
      routeKey: "tasks",
      required: true,
      requirementRefs: [requirementRef],
    }],
    actions: [{
      key: "save_task",
      name: "Save Task",
      surfaceKeys: ["task_page"],
      trigger: { kind: "user", sourceRef: "Save" },
      inputs: [{ name: "title", valueType: "string", required: true, entityField: { entityKey: "task", fieldKey: "title" } }],
      preconditions: [],
      evidenceScenario: { targetInputValues: { title: "Updated task" }, prerequisiteSteps: [] },
      stateDeltas: [{
        key: "task_title",
        stateKey: "task",
        operation: "set",
        path: "/title",
        valueFrom: { kind: "input", field: "title" },
      }],
      navigation: { kind: "stay" },
      persistenceIntents: [{
        policyKey: "task_local",
        operation: "write",
        entityKey: "task",
        stateDeltaKeys: ["task_title"],
      }],
      observables: [{
        key: "saved_confirmation",
        selector: { kind: "accessibility", surfaceKey: "task_page", role: "status", name: "Saved" },
        assertions: [
          { phase: "after", property: "visible_text", operator: "equals", expected: "Saved" },
          { phase: "reload", property: "visible_text", operator: "equals", expected: "Saved" },
        ],
        requirementRefs: [requirementRef],
      }],
      requirementRefs: [requirementRef],
    }],
    assumptions: [],
  };
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
  it("compiles the semantic transport and exposes only canonical ProductSpec downstream", () => {
    const parsed = {
      status: "done",
      prd: `Planner preface\n\`\`\`plan-semantic-proposal-v1\n${JSON.stringify(semanticProposal(), null, 2)}\n\`\`\`\nPlanner suffix`,
    };
    const originalPrd = parsed.prd;
    const authority = resolveV3PlanOutputAuthorityV1({ task: TASK, parsed });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.sourceTransport, "semantic_proposal");
    assert.equal(authority.sourceProposalHash.length, 64);
    assert.equal(authority.productSpec.product.id, "PROD_TASK_EDITOR");
    assert.equal(authority.productSpec.actions[0]?.id, "ACT_SAVE_TASK");
    assert.deepEqual(authority.productSpec.actions[0]?.persistenceEffects[0]?.payloadFields, ["title"]);

    const projected = projectCanonicalV3PlanParsedOutputV1({ parsed, authority });
    assert.equal(validatePlanOutput(projected).ok, true);
    assert.doesNotMatch(projected.prd, /plan-semantic-proposal-v1/);
    assert.match(projected.prd, /```product-spec-v1/);
    assert.equal(parsed.prd, originalPrd);
  });

  it("hands compiler-owned persistence bytes to the downstream PLAN module", () => {
    const input = proposal();
    input.actions[0].input.fields = [];
    input.actions[0].evidenceScenario.targetInputValues = {};
    input.actions[0].stateDeltas[0].valueFrom = { kind: "literal", value: "refreshed" };
    input.actions[0].persistenceEffects[0].payloadFields = ["title"];
    const parsed = {
      status: "done",
      prd: `Planner preface\n\`\`\`product-spec-v1\n${JSON.stringify(input, null, 2)}\n\`\`\`\nPlanner suffix`,
    };
    const originalPrd = parsed.prd;
    assert.equal(validatePlanOutput(parsed).ok, false);

    const authority = resolveV3PlanOutputAuthorityV1({ task: TASK, parsed });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    const projected = projectCanonicalV3PlanParsedOutputV1({ parsed, authority });

    assert.equal(validatePlanOutput(projected).ok, true);
    assert.match(projected.prd, new RegExp(authority.canonicalBytes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.deepEqual(authority.productSpec.actions[0]?.persistenceEffects[0]?.payloadFields, []);
    assert.equal(parsed.prd, originalPrd);
    assert.notEqual(projected.prd, originalPrd);
  });

  it("bypasses the legacy Product Supervisor only for a canonical typed v3 proposal", () => {
    const input = proposal();
    input.evidencePredicates.forEach((predicate: any) => {
      predicate.capabilityRefs = ["CAP_BROWSER_RUN", "CAP_LOCAL_STORAGE"];
    });
    const authority = resolveV3PlanOutputAuthorityV1({
      task: TASK,
      parsed: {
        status: "done",
        prd: `\`\`\`product-spec-v1\n${JSON.stringify(input, null, 2)}\n\`\`\``,
      },
    });
    assert.equal(authority.status, "proposal");
    if (authority.status !== "proposal") return;
    assert.equal(authority.canonicalBytes, canonicalJsonStringify(authority.productSpec));
    assert.equal(authority.deliverySelection.profileId, "PROFILE_WEB_REACT_EXACT_V1");
    assert.equal(authority.deliverySelection.stackPackId, "vite-react-web-app");
    assert.equal(authority.deliverySelectionHash.length, 64);
    assert.equal(authority.deliverySelection.evidenceCapabilities.policyHash.length, 64);
    assert.equal(authority.productSpec.evidencePredicates.every((predicate) =>
      !predicate.capabilityRefs.includes("CAP_BROWSER_RUN")
      && !predicate.capabilityRefs.includes("CAP_LOCAL_STORAGE")), true);
    assert.deepEqual(
      authority.productSpec.evidencePredicates.find((predicate) =>
        predicate.id === "EVID_SAVE_CONFIRMATION")?.capabilityRefs,
      ["CAP_BROWSER_INTERACTION", "CAP_LOCAL_PERSISTENCE"],
    );
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

  it("preserves the exact missing topology capability in typed PLAN retry evidence", () => {
    const invalid = proposal();
    invalid.evidencePredicates[0].kind = "download";

    assert.throws(
      () => resolveV3PlanOutputAuthorityV1({
        task: TASK,
        parsed: { prd: `\`\`\`product-spec-v1\n${JSON.stringify(invalid)}\n\`\`\`` },
      }),
      (error: unknown) => {
        assert.ok(error instanceof V3PlanOutputRejectedError);
        assert.equal(error.diagnostics.some((item) =>
          item.code === "PRODUCT_SPEC_EVIDENCE_CAPABILITY_UNAVAILABLE"
          && item.path === "/evidencePredicates/0/capabilityRefs"
          && item.reference === "download"), true);
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
