import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  ProductSpecV3ProposalSchema,
} from "../../src/product-compiler/schemas/product-spec-v1.js";
import {
  canonicalizeProductSpecRejectionV1,
  canonicalizeProductSpecV3Proposal,
} from "../../src/product-compiler/producers/plan-product-spec-proposal.js";
import {
  extractTaskRequirementLedgerV1,
} from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  normalize,
  sealedDeliveryContext,
  validateOutput,
} from "../../src/installer/steps/01-plan/guards.js";
import { buildPrompt } from "../../src/installer/steps/01-plan/module.js";
import { buildMinimalValidContracts } from "./fixtures/minimal-valid-contract.js";
import { produceDesignGenerationTargetsV1 } from "../../src/product-compiler/producers/design-targets.js";
import { resolveProductDeliverySelectionV1 } from "../../src/product-compiler/product-delivery-profile-catalog.js";

const TASK = "Let a user edit and save a task, keep the saved title after reload, and show visible confirmation.";

function proposal(task = TASK): any {
  const ledger = extractTaskRequirementLedgerV1(task);
  const value: any = structuredClone(buildMinimalValidContracts().productSpec);
  const action = value.actions[0];
  action.observableEffects = [{
    id: "OBS_SAVE_CONFIRMATION",
    selector: { kind: "control", actionRef: "ACT_SAVE_TASK" },
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

describe("requirement-traceable PLAN v3", () => {
  it("inventories generic, paraphrased, and multilingual clauses without product profiles", () => {
    const tasks = [
      "Keep notes across reload. Show a visible saved label.",
      "Retain the note when the page opens again; visibly confirm the save.",
      "Notu yeniden yuklemeden sonra koru. Kaydedildigini gorunur bicimde bildir.",
      "Conserver la note apres rechargement. Afficher une confirmation visible.",
    ];
    for (const task of tasks) {
      const first = extractTaskRequirementLedgerV1(task);
      const second = extractTaskRequirementLedgerV1(task);
      assert.deepEqual(first, second);
      assert.ok(first.requirements.length >= 2);
      for (const requirement of first.requirements) {
        assert.match(requirement.id, /^REQ_[A-F0-9]{16}$/);
        assert.equal(requirement.sources[0]!.sourceRef.startsWith("task/input.txt#chars="), true);
        assert.equal(requirement.normalizedClause.length > 0, true);
      }
    }
  });

  it("canonicalizes pretty planner JSON and preserves Setfarm-owned source clauses", () => {
    const input = proposal();
    input.traceability.bindings.reverse();
    const result = canonicalizeProductSpecV3Proposal({ task: TASK, proposal: input });
    assert.equal(result.status, "canonicalized");
    if (result.status !== "canonicalized") return;
    assert.deepEqual(ProductSpecV3ProposalSchema.parse(result.productSpec), result.productSpec);
    assert.equal(result.canonicalBytes, canonicalJsonStringify(result.productSpec));
    assert.deepEqual(
      result.productSpec.requirements!.map((requirement) => requirement.normalizedClause),
      extractTaskRequirementLedgerV1(TASK).requirements.map((requirement) => requirement.normalizedClause),
    );

    const parsed: any = {
      status: "done",
      prd: `\`\`\`product-spec-v1\n${JSON.stringify(input, null, 2)}\n\`\`\``,
    };
    normalize(parsed);
    assert.equal(validateOutput(parsed).ok, true);
    assert.equal(parsed.prd.includes(canonicalJsonStringify(input)), true);
  });

  it("rejects a proposal that rewrites or omits an exact task clause", () => {
    const rewritten = proposal();
    rewritten.requirements[0].normalizedClause = "A different requirement";
    assert.equal(canonicalizeProductSpecV3Proposal({ task: TASK, proposal: rewritten }).status, "rejected");

    const omitted = proposal();
    omitted.requirements = [];
    assert.equal(canonicalizeProductSpecV3Proposal({ task: TASK, proposal: omitted }).status, "rejected");
  });

  it("rejects planner delivery that conflicts with the authoritative stack contract", () => {
    const result = canonicalizeProductSpecV3Proposal({
      task: TASK,
      proposal: proposal(),
      authoritativeDelivery: { platform: "api", techStack: "node-express" },
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.deepEqual(
      result.diagnostics.map((item) => item.code).sort(),
      ["PRODUCT_SPEC_DELIVERY_PLATFORM_MISMATCH", "PRODUCT_SPEC_DELIVERY_STACK_MISMATCH"],
    );
  });

  it("keeps topology and evidence policy authority across the PLAN compatibility adapter", () => {
    const selected = resolveProductDeliverySelectionV1({ productClass: "utility" });
    assert.equal(selected.status, "selected");
    if (selected.status !== "selected") return;

    assert.deepEqual(sealedDeliveryContext({
      product_delivery_selection: selected.canonicalBytes,
      product_delivery_selection_hash: selected.selectionHash,
    }), {
      platform: "web",
      techStack: "vite-react",
      designRequired: true,
      allowedDatabases: ["none"],
      stackPackId: "vite-react-web-app",
      evidenceCapabilityPolicyHash: selected.selection.evidenceCapabilities.policyHash,
    });
  });

  it("rejects v3 action inputs that do not drive an exact state delta", () => {
    const input = proposal();
    input.actions[0].stateDeltas[0].valueFrom = { kind: "literal", value: "Task from state" };
    const result = canonicalizeProductSpecV3Proposal({ task: TASK, proposal: input });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.some((item) =>
      item.path === "/actions/0/input/fields/0/name"
      && /behaviorally unused/.test(item.message)
      && /use a literal delta instead/.test(item.message)), true);
  });

  it("returns an actionable RFC 6901 diagnostic for malformed state paths", () => {
    const input = proposal();
    input.actions[0].stateDeltas[0].path = "title";
    const result = canonicalizeProductSpecV3Proposal({ task: TASK, proposal: input });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.some((item) =>
      item.path === "/actions/0/stateDeltas/0/path"
      && /RFC 6901 JSON Pointer/.test(item.message)
      && /beginning with '\/'/.test(item.message)), true);
  });

  it("uses a typed rejection for ambiguous or unsupported semantics", () => {
    const ledger = extractTaskRequirementLedgerV1("Connect it to the usual provider and keep it safe.");
    const rejection = canonicalizeProductSpecRejectionV1({
      task: "Connect it to the usual provider and keep it safe.",
      rejection: {
        schema: "setfarm.product-spec-rejection.v1",
        sourceTaskHash: ledger.sourceHash,
        reasons: [{
          code: "PRODUCT_SPEC_TASK_AMBIGUOUS",
          requirementRefs: ledger.requirements.map((requirement) => requirement.id),
          message: "The provider identity and persistence owner are not specified.",
        }],
      },
    });
    assert.equal(rejection.reasons[0]?.code, "PRODUCT_SPEC_TASK_AMBIGUOUS");
  });

  it("fails negative mutations that delete a requested action, persistence policy, or observable effect", () => {
    const cases = [
      (value: any) => { value.actions.splice(0, 1); },
      (value: any) => { value.persistencePolicies.splice(0, 1); },
      (value: any) => { value.actions[0].observableEffects.splice(0, 1); },
    ];
    for (const mutate of cases) {
      const value = proposal();
      mutate(value);
      const result = canonicalizeProductSpecV3Proposal({ task: TASK, proposal: value });
      assert.equal(result.status, "rejected");
    }
  });

  it("carries observable selectors into the machine-readable Stitch target", () => {
    const canonical = canonicalizeProductSpecV3Proposal({ task: TASK, proposal: proposal() });
    assert.equal(canonical.status, "canonicalized");
    if (canonical.status !== "canonicalized") return;
    const targets = produceDesignGenerationTargetsV1(canonical.productSpec);
    assert.equal(targets.status, "produced");
    if (targets.status !== "produced") return;
    assert.deepEqual(targets.generationTargets.targets[0]?.requiredObservableSelectors, [{
      observableRef: "OBS_SAVE_CONFIRMATION",
      actionRef: "ACT_SAVE_TASK",
      selector: { kind: "control", actionRef: "ACT_SAVE_TASK" },
    }]);
  });

  it("keeps v3 PLAN claimable and tells the planner to emit one typed proposal", () => {
    const source = fs.readFileSync("src/installer/steps/01-plan/preclaim.ts", "utf8");
    assert.match(source, /if \(protocol === "v3"\)[\s\S]*planner_proposal_required[\s\S]*return;/);
    const prompt = buildPrompt({
      runId: "run-plan-v3",
      task: TASK,
      context: {
        task: TASK,
        plan_protocol: "v3",
        v3_requirement_ledger: canonicalJsonStringify(extractTaskRequirementLedgerV1(TASK)),
      },
    });
    assert.match(prompt, /exactly one product-spec-v1 JSON fence/i);
    assert.match(prompt, /product-spec-rejection-v1/);
    assert.match(prompt, /Setfarm validates and canonicalizes/i);
    assert.match(prompt, /fixed button outcome is a literal state delta/i);
    assert.match(prompt, /RFC 6901 JSON Pointer/);
    assert.match(prompt, /Set capabilityRefs to \[\]/);
    assert.match(prompt, /Physical capability IDs are Product Compiler output/);
  });
});
