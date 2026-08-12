import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compilePlanSemanticProposalV1 } from "../../src/product-compiler/producers/plan-semantic-proposal.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import { PlanSemanticProposalV1Schema } from "../../src/product-compiler/schemas/plan-semantic-proposal-v1.js";
import { ProductSpecV3ProposalSchema } from "../../src/product-compiler/schemas/product-spec-v1.js";

const TASK = "Build a single-page status utility at /status with a Refresh button that sets application state to refreshed, writes the status to local storage across reloads, shows the text Status refreshed and value refreshed, keeps the button visible and enabled, and remains on /status";

function proposal() {
  const ledger = extractTaskRequirementLedgerV1(TASK);
  const requirementRef = ledger.requirements[0]!.id;
  return PlanSemanticProposalV1Schema.parse({
    schema: "setfarm.plan-semantic-proposal.v1",
    sourceTaskHash: ledger.sourceHash,
    product: {
      key: "status_refresh",
      name: "Status Refresh",
      class: "utility",
      uiLanguage: "English",
      database: "none",
      uiVisionSummary: "A compact status utility with one clear refresh control, a persistent result region, and an explicit calm visual hierarchy for the single status route.",
      goals: [{
        key: "refresh_status",
        statement: "Refresh and persist the visible status on the single status route.",
        requirementRefs: [requirementRef],
      }],
      nonGoals: [],
    },
    requirements: [{
      id: requirementRef,
      classification: "functional",
      expectedSemanticKinds: ["state", "persistence", "route", "surface", "action", "observable"],
    }],
    entities: [],
    states: [{
      key: "status",
      name: "Application Status",
      kind: "application",
      initialValue: { label: "", value: "" },
      invariants: ["The status value and label are always strings."],
      requirementRefs: [requirementRef],
    }],
    persistencePolicies: [{
      key: "status_local",
      kind: "local_storage",
      entityKeys: [],
      rehydration: { kind: "initialization" },
      requirementRefs: [requirementRef],
    }],
    routes: [{
      key: "status",
      path: "/status",
      entry: true,
      requirementRefs: [requirementRef],
    }],
    surfaces: [{
      key: "status_page",
      name: "Status Page",
      kind: "page",
      routeKey: "status",
      required: true,
      requirementRefs: [requirementRef],
    }],
    actions: [{
      key: "refresh",
      name: "Refresh",
      surfaceKeys: ["status_page"],
      trigger: { kind: "user", sourceRef: "Refresh" },
      inputs: [],
      preconditions: [],
      evidenceScenario: { targetInputValues: {}, prerequisiteSteps: [] },
      stateDeltas: [
        {
          key: "status_label",
          stateKey: "status",
          operation: "set",
          path: "/label",
          valueFrom: { kind: "literal", value: "Status refreshed" },
        },
        {
          key: "status_value",
          stateKey: "status",
          operation: "set",
          path: "/value",
          valueFrom: { kind: "literal", value: "refreshed" },
        },
      ],
      navigation: { kind: "stay" },
      persistenceIntents: [{
        policyKey: "status_local",
        operation: "write",
        stateDeltaKeys: ["status_label", "status_value"],
      }],
      observables: [
        {
          key: "status_result",
          selector: { kind: "accessibility", surfaceKey: "status_page", role: "status", name: "Status" },
          assertions: [
            { phase: "after", property: "visible_text", operator: "equals", expected: "Status refreshed" },
            { phase: "after", property: "value", operator: "equals", expected: "refreshed" },
            { phase: "reload", property: "value", operator: "equals", expected: "refreshed" },
          ],
          requirementRefs: [requirementRef],
        },
        {
          key: "refresh_control",
          selector: { kind: "control" },
          assertions: [
            { phase: "after", property: "visibility", operator: "equals", expected: true },
            { phase: "after", property: "enabled", operator: "equals", expected: true },
          ],
          requirementRefs: [requirementRef],
        },
        {
          key: "status_route",
          selector: { kind: "surface", surfaceKey: "status_page" },
          assertions: [{ phase: "after", property: "route", operator: "equals", expected: "/status" }],
          requirementRefs: [requirementRef],
        },
      ],
      requirementRefs: [requirementRef],
    }],
    assumptions: [],
  });
}

describe("PlanSemanticProposalV1 compiler authority", () => {
  it("derives global identity, delivery, persistence payloads, evidence, and traceability", () => {
    const first = compilePlanSemanticProposalV1({ task: TASK, proposal: proposal() });
    const second = compilePlanSemanticProposalV1({ task: TASK, proposal: proposal() });
    assert.equal(first.status, "canonicalized");
    assert.equal(second.status, "canonicalized");
    if (first.status !== "canonicalized" || second.status !== "canonicalized") return;

    assert.equal(first.canonicalBytes, second.canonicalBytes);
    assert.equal(first.semanticProposalHash, second.semanticProposalHash);
    assert.equal(first.productSpec.product.id, "PROD_STATUS_REFRESH");
    assert.equal(first.deliverySelection.stackPackId, "vite-react-web-app");
    assert.equal(first.productSpec.delivery?.platform, "web");
    assert.equal(first.productSpec.delivery?.techStack, "vite-react");
    assert.equal(first.productSpec.persistencePolicies[0]?.key, "setfarm.status_refresh.status_local.v1");
    assert.equal(first.productSpec.persistencePolicies[0]?.owner, "application");
    assert.equal(first.productSpec.persistencePolicies[0]?.durability, "reload");
    assert.deepEqual(first.productSpec.actions[0]?.persistenceEffects[0]?.payloadFields, []);
    assert.deepEqual(
      first.productSpec.actions[0]?.success.evidenceRefs,
      first.productSpec.actions[0]?.evidenceRefs,
    );
    assert.equal(first.productSpec.evidencePredicates.every((item) => item.capabilityRefs.length > 0), true);
    assert.equal(first.productSpec.requirements?.[0]?.normalizedClause, TASK);
    assert.equal(first.productSpec.traceability?.bindings.some((binding) =>
      binding.semanticKind === "observable" && binding.semanticRef === "OBS_REFRESH_STATUS_RESULT"), true);
  });

  it("rejects the exact unowned UI-state class before STORIES can partition it", () => {
    const input = structuredClone(proposal());
    input.states.push({
      key: "refresh_busy",
      name: "Refresh Busy",
      kind: "ui",
      initialValue: false,
      invariants: ["The refresh control remains visible and enabled."],
      requirementRefs: [...input.states[0]!.requirementRefs],
    });
    const result = compilePlanSemanticProposalV1({ task: TASK, proposal: input });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.some((item) => item.code === "PLAN_SEMANTIC_STATE_UNOWNED"), true);
  });

  it("rejects model attempts to regain compiler-owned fields", () => {
    const input = { ...proposal(), delivery: { platform: "web", techStack: "vite-react" } };
    const parsed = PlanSemanticProposalV1Schema.safeParse(input);
    assert.equal(parsed.success, false);

    const persistenceInput: any = structuredClone(proposal());
    persistenceInput.persistencePolicies[0].owner = "user";
    persistenceInput.persistencePolicies[0].durability = "reload";
    const persistenceParsed = PlanSemanticProposalV1Schema.safeParse(persistenceInput);
    assert.equal(persistenceParsed.success, false);

    const localizedInput: any = structuredClone(proposal());
    localizedInput.product.uiLanguage = "Spanish";
    const localizedParsed = PlanSemanticProposalV1Schema.safeParse(localizedInput);
    assert.equal(localizedParsed.success, false);
    if (!localizedParsed.success) {
      assert.equal(localizedParsed.error.issues.some((issue) =>
        issue.path.join("/") === "product/uiLanguage"), true);
    }
  });

  it("rejects English-marker bypasses across planner-owned semantic text", () => {
    const markerBypass = `English marker ${String.fromCodePoint(0x0416)}`;
    const cases: Array<Readonly<{
      path: string;
      mutate: (input: any) => void;
    }>> = [
      { path: "product/name", mutate: (input) => { input.product.name = markerBypass; } },
      { path: "product/uiVisionSummary", mutate: (input) => { input.product.uiVisionSummary += markerBypass; } },
      { path: "product/goals/0/statement", mutate: (input) => { input.product.goals[0].statement = markerBypass; } },
      { path: "states/0/name", mutate: (input) => { input.states[0].name = markerBypass; } },
      { path: "states/0/invariants/0", mutate: (input) => { input.states[0].invariants[0] = markerBypass; } },
      { path: "surfaces/0/name", mutate: (input) => { input.surfaces[0].name = markerBypass; } },
      { path: "actions/0/name", mutate: (input) => { input.actions[0].name = markerBypass; } },
      { path: "actions/0/observables/0/assertions/0/expected", mutate: (input) => {
        input.actions[0].observables[0].assertions[0].expected = markerBypass;
      } },
    ];

    for (const entry of cases) {
      const input = structuredClone(proposal());
      entry.mutate(input);
      const parsed = PlanSemanticProposalV1Schema.safeParse(input);
      assert.equal(parsed.success, false, entry.path);
      if (!parsed.success) {
        assert.equal(parsed.error.issues.some((issue) =>
          issue.path.join("/") === entry.path
          && issue.message.includes("PLAN_SEMANTIC_ENGLISH_TEXT_REQUIRED")), true, entry.path);
      }
    }
  });

  it("rejects high-signal ASCII localized copy at planner-owned text boundaries", () => {
    const localizedCopy = String.fromCharCode(
      71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115,
    );
    const input = structuredClone(proposal());
    input.actions[0].name = localizedCopy;

    const parsed = PlanSemanticProposalV1Schema.safeParse(input);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.issues.some((issue) =>
        issue.path.join("/") === "actions/0/name"
        && issue.message.includes("ENGLISH_TEXT_UNSUPPORTED_LEXEME")), true);
    }

    const structuredVisibleText = structuredClone(proposal());
    structuredVisibleText.actions[0].observables[0].assertions[0].expected = {
      text: localizedCopy,
    };
    assert.equal(PlanSemanticProposalV1Schema.safeParse(structuredVisibleText).success, false);
  });

  it("selects lexical admission from the exact observable property role", () => {
    const localizedCopy = String.fromCharCode(
      71, 117, 97, 114, 100, 97, 114, 32, 99, 97, 109, 98, 105, 111, 115,
    );
    const technical = structuredClone(proposal());
    technical.actions[0].observables[2].assertions[0].expected = String.fromCharCode(
      47, 103, 117, 97, 114, 100, 97, 114,
    );
    assert.equal(PlanSemanticProposalV1Schema.safeParse(technical).success, true);

    const visibleText = structuredClone(proposal());
    visibleText.actions[0].observables[0].assertions[0].expected = localizedCopy;
    const parsed = PlanSemanticProposalV1Schema.safeParse(visibleText);
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.issues.some((issue) =>
        issue.path.join("/") === "actions/0/observables/0/assertions/0/expected"
        && issue.message.includes("ENGLISH_TEXT_UNSUPPORTED_LEXEME")), true);
    }
  });

  it("selects activated delivery for utility, operations, and game from semantic class only", () => {
    const expected = new Map([
      ["utility", "vite-react-web-app"],
      ["operations", "vite-react-web-app"],
      ["game", "browser-game-canvas"],
    ]);
    for (const [productClass, stackPackId] of expected) {
      const input = structuredClone(proposal());
      input.product.class = productClass as typeof input.product.class;
      const compiled = compilePlanSemanticProposalV1({ task: TASK, proposal: input });
      assert.equal(compiled.status, "canonicalized", productClass);
      if (compiled.status !== "canonicalized") continue;
      assert.equal(compiled.deliverySelection.stackPackId, stackPackId);
      assert.equal(compiled.semanticProposal.product.class, productClass);
    }
  });

  it("makes every outcome evidence ref an action-owned platform invariant", () => {
    const compiled = compilePlanSemanticProposalV1({ task: TASK, proposal: proposal() });
    assert.equal(compiled.status, "canonicalized");
    if (compiled.status !== "canonicalized") return;
    const mutated = structuredClone(compiled.productSpec);
    mutated.evidencePredicates.push({
      id: "EVID_ORPHAN_STATE",
      kind: "state_transition",
      required: true,
      subjectRef: mutated.states[0]!.id,
      capabilityRefs: ["CAP_RUNTIME_STATE"],
      assertion: { operator: "passes" },
    });
    mutated.actions[0]!.success.evidenceRefs.push("EVID_ORPHAN_STATE");
    const parsed = ProductSpecV3ProposalSchema.safeParse(mutated);
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    assert.equal(parsed.error.issues.some((issue) =>
      issue.message === "Action outcome evidence must be owned by the action evidenceRefs contract"), true);
  });
});
