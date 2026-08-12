import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TaskIntentOracleV1Schema,
  evaluateTaskIntentOracleTaskBindingV1,
  evaluateTaskIntentOracleV1,
  type TaskIntentOracleV1,
} from "../../src/evals/task-intent-oracle.js";
import { extractTaskRequirementLedgerV1 } from "../../src/product-compiler/requirements/task-requirements-v1.js";
import {
  TASK_INTENT_ORACLE_TASK,
  buildTaskIntentOracleFixture,
} from "./fixtures/task-intent-oracle-fixture.js";

const TASK = TASK_INTENT_ORACLE_TASK;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fixture() {
  const value = buildTaskIntentOracleFixture();
  return {
    productSpec: value.productSpec,
    designGraph: value.designGraph,
    oracle: value.oracle,
    candidate: value.candidate,
  };
}

function evaluate(input: ReturnType<typeof fixture>) {
  return evaluateTaskIntentOracleV1({
    task: TASK,
    oracle: input.oracle,
    actual: {
      kind: "accepted_candidate",
      productSpec: input.productSpec,
      designGraph: input.designGraph,
      sealedStackPackId: "vite-react-web-app",
      acceptedCandidate: input.candidate,
      passingPredicateRefs: ["EVID_SAVE_OBSERVABLE", "EVID_SAVE_RELOAD"],
    },
  });
}

function mutateAssertion(
  input: ReturnType<typeof fixture>,
  property: "visible_text" | "value" | "visibility" | "enabled" | "route",
  expected: unknown,
): ReturnType<typeof fixture> {
  const mutated = clone(input);
  const assertion = mutated.productSpec.actions[0]!.observableEffects!
    .flatMap((effect) => effect.assertions)
    .find((candidate) => candidate.phase === "after" && candidate.property === property)!;
  assertion.expected = expected as never;
  return mutated;
}

describe("TaskIntentOracleV1", () => {
  it("accepts English compositional metadata and rejects legacy multilingual metadata", () => {
    const compositional = clone(fixture().oracle);
    compositional.cohort = "holdout";
    compositional.variant = "compositional";
    assert.equal(TaskIntentOracleV1Schema.safeParse(compositional).success, true);

    const multilingual = { ...compositional, variant: "multilingual" };
    assert.equal(TaskIntentOracleV1Schema.safeParse(multilingual).success, false);
    const nonEnglish = { ...compositional, locale: "tr" };
    assert.equal(TaskIntentOracleV1Schema.safeParse(nonEnglish).success, false);
  });

  it("accepts a source-bound contract only after canonical AcceptedCandidate evidence passes", () => {
    const input = fixture();
    assert.deepEqual(evaluateTaskIntentOracleTaskBindingV1(TASK, input.oracle).mismatchCodes, []);
    const result = evaluate(input);
    assert.equal(result.contractComplete, true);
    assert.equal(result.decisionEvidenceVerified, true);
    assert.deepEqual(result.mismatchCodes, []);
    assert.deepEqual(result.matchedIntentIds, [
      "editor-state", "editor-surface", "home-route", "reload-storage", "save-action", "task-entity",
    ]);
  });

  it("rejects missing control, action, state, persistence, and observable semantics", () => {
    const missingControl = fixture();
    missingControl.designGraph.bindings = [{
      controlRef: "CTRL_SAVE_TASK",
      disposition: "disabled",
      reason: "Mutation removes action ownership.",
    }];
    assert.ok(evaluate(missingControl).mismatchCodes.includes("ORACLE_CONTROL_MISSING"));

    const mutations: Array<[string, (input: ReturnType<typeof fixture>) => void]> = [
      ["action", (input) => { input.productSpec.actions = []; }],
      ["state", (input) => { input.productSpec.states = []; }],
      ["persistence", (input) => { input.productSpec.persistencePolicies = []; }],
      ["observable", (input) => { delete input.productSpec.actions[0]!.observableEffects; }],
    ];
    mutations.forEach(([label, mutate]) => {
      const input = fixture();
      mutate(input);
      assert.ok(evaluate(input).mismatchCodes.includes("ORACLE_PRODUCT_SPEC_INVALID"), label);
    });
  });

  it("rejects wrong route, text, value, visibility, and enabled outcomes independently", () => {
    const cases: Array<[string, unknown, string]> = [
      ["visible_text", "Not saved", "ORACLE_OBSERVABLE_TEXT_MISMATCH"],
      ["value", "Wrong value", "ORACLE_OBSERVABLE_VALUE_MISMATCH"],
      ["visibility", false, "ORACLE_OBSERVABLE_VISIBILITY_MISMATCH"],
      ["enabled", false, "ORACLE_OBSERVABLE_ENABLED_MISMATCH"],
      ["route", "/wrong", "ORACLE_OBSERVABLE_ROUTE_MISMATCH"],
    ];
    cases.forEach(([property, expected, mismatch]) => {
      const result = evaluate(mutateAssertion(
        fixture(),
        property as "visible_text" | "value" | "visibility" | "enabled" | "route",
        expected,
      ));
      assert.ok(result.mismatchCodes.includes(mismatch), `${property}: ${result.mismatchCodes.join(",")}`);
    });
  });

  it("compares changed assertions without trying to hash an undefined expected value", () => {
    const input = fixture();
    const actualAssertion = input.productSpec.actions[0]!.observableEffects![0]!.assertions
      .find((assertion) => assertion.phase === "after" && assertion.property === "value")!;
    actualAssertion.operator = "changed";
    delete actualAssertion.expected;
    const actionExpectation = input.oracle.expectations
      .find((expectation) => expectation.kind === "action");
    assert.equal(actionExpectation?.kind, "action");
    const expectedAssertion = actionExpectation.observableAssertions
      .find((assertion) => assertion.phase === "after" && assertion.property === "value")!;
    expectedAssertion.operator = "changed";
    delete expectedAssertion.expected;

    assert.deepEqual(evaluate(input).mismatchCodes, []);
  });

  it("does not let AcceptedCandidate evidence self-certify a missing predicate", () => {
    const input = fixture();
    const result = evaluateTaskIntentOracleV1({
      task: TASK,
      oracle: input.oracle,
      actual: {
        kind: "accepted_candidate",
        productSpec: input.productSpec,
        designGraph: input.designGraph,
        sealedStackPackId: "vite-react-web-app",
        acceptedCandidate: input.candidate,
        passingPredicateRefs: [],
      },
    });
    assert.equal(result.contractComplete, true);
    assert.equal(result.decisionEvidenceVerified, false);
    assert.ok(result.mismatchCodes.includes("ORACLE_ACCEPTED_EVIDENCE_NOT_PASSING"));
  });

  it("binds an oracle to exact task spans, not keyword or producer identities", () => {
    const input = fixture();
    const shifted: TaskIntentOracleV1 = clone(input.oracle);
    shifted.clauses[0]!.source.endOffset -= 1;
    assert.ok(evaluateTaskIntentOracleTaskBindingV1(TASK, shifted).mismatchCodes.includes("ORACLE_TASK_SPAN_MISMATCH"));
  });

  it("requires a source-cited typed rejection with exact reason, compiler owner, and zero redispatch", () => {
    const task = "Build a polished experience but leave its users, workflow, data, actions, and platform deliberately unspecified";
    const ledger = extractTaskRequirementLedgerV1(task);
    const oracle = {
      schema: "setfarm.task-intent-oracle.v1" as const,
      oracleId: "ambiguous-negative-control",
      oracleVersion: 1 as const,
      locale: "en",
      cohort: "negative" as const,
      variant: "ambiguous" as const,
      expectedDecision: {
        kind: "typed_rejection" as const,
        reasonCodes: ["PRODUCT_SPEC_TASK_AMBIGUOUS" as const],
      },
      clauses: [{
        clauseId: "ambiguous-task",
        source: { startOffset: 0, endOffset: task.length, normalizedClause: task },
        requiredSemanticKinds: [],
      }],
      expectations: [],
    };
    const rejection = {
      schema: "setfarm.product-spec-rejection.v1" as const,
      sourceTaskHash: ledger.sourceHash,
      reasons: [{
        code: "PRODUCT_SPEC_TASK_AMBIGUOUS" as const,
        requirementRefs: ledger.requirements.map((requirement) => requirement.id),
        message: "The product semantics are intentionally withheld.",
      }],
    };
    const accepted = evaluateTaskIntentOracleV1({
      task,
      oracle,
      actual: { kind: "typed_rejection", rejection, owner: "compiler", modelRedispatchBudget: 0 },
    });
    assert.deepEqual(accepted.mismatchCodes, []);

    const mutated = evaluateTaskIntentOracleV1({
      task,
      oracle,
      actual: {
        kind: "typed_rejection",
        rejection: {
          ...rejection,
          reasons: [{ ...rejection.reasons[0]!, code: "PRODUCT_SPEC_SEMANTIC_UNSUPPORTED" }],
        },
        owner: "supervisor",
        modelRedispatchBudget: 1,
      },
    });
    assert.ok(mutated.mismatchCodes.includes("ORACLE_REJECTION_CODE_MISMATCH"));
    assert.ok(mutated.mismatchCodes.includes("ORACLE_REJECTION_OWNER_INVALID"));
    assert.ok(mutated.mismatchCodes.includes("ORACLE_REJECTION_REDISPATCH_NOT_ZERO"));
  });
});
