import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ProductRuntimeBehaviorVerificationErrorV1,
  compileProductRuntimeBehaviorContractV1,
  evaluateProductRuntimeBehaviorContractV1,
  resolveProductRuntimeEntityFieldValueV1,
  verifyProductRuntimeBehaviorContractV1,
} from "../../src/product-compiler/product-runtime-behavior-contract-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
  ProductRuntimeBehaviorContractV1Schema,
  hashProductRuntimeBehaviorContractV1,
  type ProductRuntimeBehaviorProposalV1,
} from "../../src/product-compiler/schemas/product-runtime-behavior-contract-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

function requirementRefsFor(
  productSpec: ProductSpecV2,
  semanticKind: string,
  semanticRef: string,
): string[] {
  const binding = productSpec.traceability.bindings.find((candidate) =>
    candidate.semanticKind === semanticKind
    && candidate.semanticRef === semanticRef);
  if (!binding) throw new Error(`Missing ${semanticKind}:${semanticRef} binding`);
  return [...binding.requirementRefs];
}

function assertionProposal(
  productSpec: ProductSpecV2,
  definitions: ReadonlyArray<Readonly<{
    stateRef: string;
    invariantOrdinal?: number;
    assertions: readonly Readonly<{
      subject: Record<string, unknown>;
      predicate: Record<string, unknown>;
    }>[];
  }>>,
): ProductRuntimeBehaviorProposalV1 {
  return {
    schema: "setfarm.product-runtime-behavior-proposal.v1",
    productSpecHash: hashCanonicalJson(productSpec),
    invariantBindings: definitions.map((definition) => ({
      stateRef: definition.stateRef,
      invariantOrdinal: definition.invariantOrdinal ?? 0,
      requirementRefs: requirementRefsFor(productSpec, "state", definition.stateRef),
      disposition: {
        kind: "runtime_assertions" as const,
        assertions: definition.assertions as any,
      },
    })),
    entityFieldBindings: [],
  };
}

function cliProposal(productSpec: ProductSpecV2): ProductRuntimeBehaviorProposalV1 {
  return assertionProposal(productSpec, [{
    stateRef: "STATE_TASKS",
    assertions: [
      {
        subject: {
          kind: "state_each",
          stateRef: "STATE_TASKS",
          collectionPath: "",
          itemPath: "",
        },
        predicate: { operator: "type_is", expected: "string" },
      },
      {
        subject: {
          kind: "state_each",
          stateRef: "STATE_TASKS",
          collectionPath: "",
          itemPath: "",
        },
        predicate: { operator: "min_length", expected: 1 },
      },
    ],
  }]);
}

function apiProposal(productSpec: ProductSpecV2): ProductRuntimeBehaviorProposalV1 {
  return assertionProposal(productSpec, productSpec.states.map((state) => ({
    stateRef: state.id,
    assertions: [
      {
        subject: {
          kind: "state_each",
          stateRef: state.id,
          collectionPath: "",
          itemPath: state.id === "STATE_NOTES" ? "/title" : "/project",
        },
        predicate: { operator: "type_is", expected: "string" },
      },
      {
        subject: {
          kind: "state_each",
          stateRef: state.id,
          collectionPath: "",
          itemPath: state.id === "STATE_NOTES" ? "/title" : "/project",
        },
        predicate: { operator: "min_length", expected: 1 },
      },
      ...(
        state.id === "STATE_NOTES"
          ? []
          : [
              {
                subject: {
                  kind: "state_each",
                  stateRef: state.id,
                  collectionPath: "",
                  itemPath: "/title",
                },
                predicate: { operator: "type_is", expected: "string" },
              },
              {
                subject: {
                  kind: "state_each",
                  stateRef: state.id,
                  collectionPath: "",
                  itemPath: "/title",
                },
                predicate: { operator: "min_length", expected: 1 },
              },
            ]
      ),
    ],
  })));
}

function compileOrThrow(
  productSpec: ProductSpecV2,
  proposal: ProductRuntimeBehaviorProposalV1,
) {
  const result = compileProductRuntimeBehaviorContractV1({ productSpec, proposal });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected behavior contract");
  return result;
}

function entitySnapshotProductSpec(): ProductSpecV2 {
  const value: any = structuredClone(genuineNodeExpressApiProductSpecV2());
  value.states[0].invariants = [];
  value.entities = [{
    id: "ENTITY_TASK",
    name: "Task",
    fields: [
      {
        id: "FIELD_TASK_PROJECT",
        name: "project",
        valueType: "string",
        required: true,
      },
      {
        id: "FIELD_TASK_TITLE",
        name: "title",
        valueType: "string",
        required: true,
      },
    ],
  }];
  value.states.push({
    id: "STATE_TASK_CATALOG",
    name: "Task catalog",
    kind: "domain",
    initialValue: [{ project: "setfarm", title: "Stored title" }],
    invariants: [],
  });
  value.actions[0].stateDeltas[0].valueFrom = {
    kind: "entity_field",
    entityRef: "ENTITY_TASK",
    fieldRef: "FIELD_TASK_TITLE",
  };
  const requirementRefs = requirementRefsFor(value, "state", "STATE_TASKS");
  value.traceability.bindings.push(
    {
      semanticKind: "entity",
      semanticRef: "ENTITY_TASK",
      requirementRefs,
    },
    {
      semanticKind: "state",
      semanticRef: "STATE_TASK_CATALOG",
      requirementRefs,
    },
  );
  return ProductSpecV2Schema.parse(value);
}

function entitySnapshotProposal(
  productSpec: ProductSpecV2,
): ProductRuntimeBehaviorProposalV1 {
  return {
    schema: "setfarm.product-runtime-behavior-proposal.v1",
    productSpecHash: hashCanonicalJson(productSpec),
    invariantBindings: [],
    entityFieldBindings: [{
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      snapshot: {
        stateRef: "STATE_TASK_CATALOG",
        collectionPath: "",
        selection: {
          kind: "match_input",
          matchFieldRef: "FIELD_TASK_PROJECT",
          inputField: "project",
        },
      },
    }],
  };
}

function assertRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertRecursivelyFrozen(child);
}

describe("ProductRuntimeBehaviorContractV1", () => {
  it("compiles every CLI prose invariant into bounded executable assertions", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    const compiled = compileOrThrow(productSpec, proposal);

    assert.equal(ProductRuntimeBehaviorContractV1Schema.safeParse(compiled.contract).success, true);
    assert.equal(compiled.contract.coverage.proseInvariantCount, 1);
    assert.equal(compiled.contract.coverage.invariantBindingCount, 1);
    assert.equal(compiled.contract.coverage.runtimeAssertionCount, 2);
    assert.equal(compiled.contract.coverage.entityFieldOccurrenceCount, 0);
    assert.equal(
      compiled.contract.authority.evaluatorContractHash,
      PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
    );
    assert.equal(
      PRODUCT_RUNTIME_BEHAVIOR_EVALUATOR_CONTRACT_HASH_V1,
      "b067de2365e0ea413f632073c082a077c67de2e091fccddd7cb29e653eee990f",
    );
    assert.equal(compiled.contract.readiness.productionConsumption, "forbidden");
    assertRecursivelyFrozen(compiled);

    const reordered = structuredClone(proposal);
    (reordered.invariantBindings[0]!.disposition as any).assertions.reverse();
    const reorderedCompiled = compileOrThrow(productSpec, reordered);
    assert.equal(reorderedCompiled.contractHash, compiled.contractHash);
    assert.equal(reorderedCompiled.canonicalBytes, compiled.canonicalBytes);
  });

  it("evaluates initial and after-action state without reading prose", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    const compiled = compileOrThrow(productSpec, proposal);
    const authority = {
      productSpec,
      proposal,
      candidate: compiled.contract,
    };

    const initial = evaluateProductRuntimeBehaviorContractV1({
      ...authority,
      checkpoint: "initial",
      stateSnapshot: { STATE_TASKS: [] },
    });
    assert.equal(initial.status, "passed");
    if (initial.status === "passed" || initial.status === "failed") {
      assert.equal(initial.assertionCount, 2);
      assert.equal(initial.failedAssertionCount, 0);
    }

    const after = evaluateProductRuntimeBehaviorContractV1({
      ...authority,
      checkpoint: "after_action",
      actionRef: "ACT_ADD_TASK",
      stateSnapshot: { STATE_TASKS: ["Ship Setfarm"] },
    });
    assert.equal(after.status, "passed");

    const invalid = evaluateProductRuntimeBehaviorContractV1({
      ...authority,
      checkpoint: "after_action",
      actionRef: "ACT_ADD_TASK",
      stateSnapshot: { STATE_TASKS: [""] },
    });
    assert.equal(invalid.status, "failed");
    if (invalid.status === "failed") {
      assert.equal(invalid.failedAssertionCount, 1);
      assert.equal(invalid.results.some((result) => result.verdict === "fail"), true);
      assert.equal(Object.hasOwn(invalid.results[0]!, "value"), false);
    }
  });

  it("covers one-route and two-route API state growth with the same assertion DSL", () => {
    for (const productSpec of [
      genuineNodeExpressApiProductSpecV2(),
      twoStoryNodeExpressApiProductSpecV2(),
    ]) {
      const proposal = apiProposal(productSpec);
      const compiled = compileOrThrow(productSpec, proposal);
      assert.equal(
        compiled.contract.coverage.invariantBindingCount,
        productSpec.states.length,
      );
      assert.equal(
        compiled.contract.coverage.runtimeAssertionCount,
        productSpec.states.length === 1 ? 4 : 6,
      );
      const stateSnapshot = Object.fromEntries(productSpec.states.map((state) => [
        state.id,
        state.id === "STATE_NOTES"
          ? [{ title: "Note" }]
          : [{ project: "setfarm", title: "Task" }],
      ]));
      const evaluated = evaluateProductRuntimeBehaviorContractV1({
        productSpec,
        proposal,
        candidate: compiled.contract,
        checkpoint: "after_action",
        actionRef: productSpec.actions[0]!.id,
        stateSnapshot,
      });
      assert.equal(evaluated.status, "passed");
    }
  });

  it("accepts exact structured semantics but rejects missing or unrelated coverage", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const requirementRefs = requirementRefsFor(productSpec, "state", "STATE_TASKS");
    const proposal: ProductRuntimeBehaviorProposalV1 = {
      schema: "setfarm.product-runtime-behavior-proposal.v1",
      productSpecHash: hashCanonicalJson(productSpec),
      invariantBindings: [{
        stateRef: "STATE_TASKS",
        invariantOrdinal: 0,
        requirementRefs,
        disposition: {
          kind: "structured_semantic_coverage",
          coverageRefs: [{
            kind: "action_delta",
            actionRef: "ACT_ADD_TASK",
            deltaOrdinal: 0,
          }],
        },
      }],
      entityFieldBindings: [],
    };
    const compiled = compileOrThrow(productSpec, proposal);
    assert.equal(compiled.contract.coverage.structuredSemanticCoverageCount, 1);
    assert.equal(compiled.contract.coverage.runtimeAssertionCount, 0);

    const missing = structuredClone(proposal);
    missing.invariantBindings = [];
    const missingResult = compileProductRuntimeBehaviorContractV1({
      productSpec,
      proposal: missing,
    });
    assert.equal(missingResult.status, "rejected");
    if (missingResult.status === "rejected") {
      assert.equal(
        missingResult.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_INVARIANT_COVERAGE_INVALID"),
        true,
      );
    }

    const unrelated = structuredClone(proposal);
    (unrelated.invariantBindings[0]!.disposition as any).coverageRefs[0].deltaOrdinal = 1;
    const unrelatedResult = compileProductRuntimeBehaviorContractV1({
      productSpec,
      proposal: unrelated,
    });
    assert.equal(unrelatedResult.status, "rejected");
    if (unrelatedResult.status === "rejected") {
      assert.equal(
        unrelatedResult.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_SEMANTIC_COVERAGE_INVALID"),
        true,
      );
    }
  });

  it("prevents functional requirements from being laundered as non-runtime", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    proposal.invariantBindings[0] = {
      ...proposal.invariantBindings[0]!,
      disposition: {
        kind: "non_runtime_requirement",
        evidenceRefs: ["EVID_TASK_ADDED"],
      },
    };
    const result = compileProductRuntimeBehaviorContractV1({ productSpec, proposal });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(
        result.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_NON_RUNTIME_DISPOSITION_INVALID"),
        true,
      );
    }
  });

  it("allows non-runtime disposition only from canonical constraint authority", () => {
    const candidate: any = structuredClone(genuineNodeCliProductSpecV2());
    candidate.requirements = candidate.requirements.map((requirement: any) => ({
      ...requirement,
      classification: "constraint",
    }));
    const productSpec = ProductSpecV2Schema.parse(candidate);
    const proposal = cliProposal(productSpec);
    proposal.invariantBindings[0] = {
      ...proposal.invariantBindings[0]!,
      disposition: {
        kind: "non_runtime_requirement",
        evidenceRefs: ["EVID_TASK_ADDED"],
      },
    };
    const compiled = compileOrThrow(productSpec, proposal);
    assert.equal(compiled.contract.coverage.nonRuntimeRequirementCount, 1);
    assert.equal(compiled.contract.coverage.runtimeAssertionCount, 0);
  });

  it("rejects assertions violated by the canonical initial state", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    (proposal.invariantBindings[0]!.disposition as any).assertions = [{
      subject: {
        kind: "state_path",
        stateRef: "STATE_TASKS",
        path: "",
      },
      predicate: { operator: "min_items", expected: 1 },
    }];
    const result = compileProductRuntimeBehaviorContractV1({ productSpec, proposal });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(
        result.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_ASSERTION_INVALID"),
        true,
      );
    }
  });

  it("requires each invariant to retain its state's exact requirement set", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    proposal.invariantBindings[0]!.requirementRefs = [
      ...proposal.invariantBindings[0]!.requirementRefs,
      "REQ_RUNTIME_CONSTRAINT",
    ];
    const result = compileProductRuntimeBehaviorContractV1({
      productSpec,
      proposal,
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.equal(
        result.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_REQUIREMENT_TRACEABILITY_INVALID"),
        true,
      );
    }
  });

  it("binds entity-field reads to one pre-action snapshot and exact selector", () => {
    const productSpec = entitySnapshotProductSpec();
    const proposal = entitySnapshotProposal(productSpec);
    const compiled = compileOrThrow(productSpec, proposal);
    assert.equal(compiled.contract.coverage.proseInvariantCount, 0);
    assert.equal(compiled.contract.coverage.entityFieldOccurrenceCount, 1);
    assert.equal(compiled.contract.entityFieldBindings.length, 1);

    const stateSnapshot = {
      STATE_TASKS: [],
      STATE_TASK_CATALOG: [
        { project: "setfarm", title: "Stored title" },
        { project: "other", title: "Other title" },
      ],
    };
    const resolved = resolveProductRuntimeEntityFieldValueV1({
      productSpec,
      proposal,
      candidate: compiled.contract,
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      actionInput: { project: "setfarm", title: "Ignored transport title" },
      stateSnapshot,
    });
    assert.equal(resolved.status, "resolved");
    if (resolved.status === "resolved") {
      assert.equal(resolved.value, "Stored title");
      assert.equal(resolved.valueHash, hashCanonicalJson("Stored title"));
    }

    const ambiguous = resolveProductRuntimeEntityFieldValueV1({
      productSpec,
      proposal,
      candidate: compiled.contract,
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      actionInput: { project: "setfarm", title: "Ignored" },
      stateSnapshot: {
        ...stateSnapshot,
        STATE_TASK_CATALOG: [
          { project: "setfarm", title: "One" },
          { project: "setfarm", title: "Two" },
        ],
      },
    });
    assert.equal(ambiguous.status, "action_failure");
    if (ambiguous.status === "action_failure") {
      assert.equal(ambiguous.code, "ENTITY_SNAPSHOT_MATCH_AMBIGUOUS");
    }

    const invalidMember = resolveProductRuntimeEntityFieldValueV1({
      productSpec,
      proposal,
      candidate: compiled.contract,
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      actionInput: { project: "setfarm", title: "Ignored" },
      stateSnapshot: {
        ...stateSnapshot,
        STATE_TASK_CATALOG: [
          { project: 42, title: "Wrong match type" },
          { project: "setfarm", title: "Stored title" },
        ],
      },
    });
    assert.equal(invalidMember.status, "action_failure");
    if (invalidMember.status === "action_failure") {
      assert.equal(invalidMember.code, "ENTITY_SNAPSHOT_MATCH_FIELD_INVALID");
    }

    const extraInput = resolveProductRuntimeEntityFieldValueV1({
      productSpec,
      proposal,
      candidate: compiled.contract,
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      actionInput: {
        project: "setfarm",
        title: "Ignored",
        unexpected: true,
      },
      stateSnapshot,
    });
    assert.equal(extraInput.status, "rejected");
    if (extraInput.status === "rejected") {
      assert.equal(extraInput.code, "ENTITY_SNAPSHOT_ACTION_INPUT_INVALID");
    }

    const enumValue: any = structuredClone(entitySnapshotProductSpec());
    enumValue.entities[0].fields[0].valueType = "enum";
    enumValue.entities[0].fields[0].enumValues = ["other", "setfarm"];
    enumValue.actions[0].input.fields.find((field: any) =>
      field.name === "project").valueType = "enum";
    enumValue.actions[0].input.fields.find((field: any) =>
      field.name === "project").entityFieldRef = "FIELD_TASK_PROJECT";
    const enumSpec = ProductSpecV2Schema.parse(enumValue);
    const enumProposal = entitySnapshotProposal(enumSpec);
    const enumCompiled = compileOrThrow(enumSpec, enumProposal);
    const invalidEnumInput = resolveProductRuntimeEntityFieldValueV1({
      productSpec: enumSpec,
      proposal: enumProposal,
      candidate: enumCompiled.contract,
      actionRef: "ACT_CREATE_TASK",
      deltaOrdinal: 0,
      actionInput: { project: "unknown", title: "Ignored" },
      stateSnapshot,
    });
    assert.equal(invalidEnumInput.status, "rejected");
    if (invalidEnumInput.status === "rejected") {
      assert.equal(invalidEnumInput.code, "ENTITY_SNAPSHOT_ACTION_INPUT_INVALID");
    }

    const missingProposal = structuredClone(proposal);
    missingProposal.entityFieldBindings = [];
    const missing = compileProductRuntimeBehaviorContractV1({
      productSpec,
      proposal: missingProposal,
    });
    assert.equal(missing.status, "rejected");
    if (missing.status === "rejected") {
      assert.equal(
        missing.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_FIELD_COVERAGE_INVALID"),
        true,
      );
    }

    const duplicateInitial = structuredClone(productSpec) as any;
    duplicateInitial.states.find((state: any) =>
      state.id === "STATE_TASK_CATALOG").initialValue.push({
      project: "setfarm",
      title: "Duplicate",
    });
    const duplicateSpec = ProductSpecV2Schema.parse(duplicateInitial);
    const duplicateProposal = entitySnapshotProposal(duplicateSpec);
    const duplicate = compileProductRuntimeBehaviorContractV1({
      productSpec: duplicateSpec,
      proposal: duplicateProposal,
    });
    assert.equal(duplicate.status, "rejected");
    if (duplicate.status === "rejected") {
      assert.equal(
        duplicate.diagnostics.some((item) =>
          item.code === "PRODUCT_RUNTIME_BEHAVIOR_V1_ENTITY_SNAPSHOT_INVALID"),
        true,
      );
    }
  });

  it("fresh-verifies authority and rejects a schema-valid self-rehash", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    const compiled = compileOrThrow(productSpec, proposal);
    const verified = verifyProductRuntimeBehaviorContractV1({
      productSpec,
      proposal,
      candidate: compiled.contract,
    });
    assert.equal(verified.contractHash, compiled.contractHash);
    assertRecursivelyFrozen(verified);

    const selfRehashed = structuredClone(compiled.contract) as any;
    selfRehashed.authority.proposalHash = "f".repeat(64);
    selfRehashed.contractHash = hashProductRuntimeBehaviorContractV1(selfRehashed);
    assert.equal(ProductRuntimeBehaviorContractV1Schema.safeParse(selfRehashed).success, true);
    assert.throws(
      () => verifyProductRuntimeBehaviorContractV1({
        productSpec,
        proposal,
        candidate: selfRehashed,
      }),
      (error: unknown) =>
        error instanceof ProductRuntimeBehaviorVerificationErrorV1
        && error.code
          === "PRODUCT_RUNTIME_BEHAVIOR_V1_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects evaluator collection work beyond the code-owned bound", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);
    const compiled = compileOrThrow(productSpec, proposal);
    const result = evaluateProductRuntimeBehaviorContractV1({
      productSpec,
      proposal,
      candidate: compiled.contract,
      checkpoint: "after_action",
      actionRef: "ACT_ADD_TASK",
      stateSnapshot: {
        STATE_TASKS: Array.from({ length: 10_001 }, () => "bounded"),
      },
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.match(result.diagnostics[0]?.message ?? "", /exceeded 10000 items/u);
    }
  });

  it("rejects strict extras, stale ProductSpec authority and hostile inputs", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const proposal = cliProposal(productSpec);

    const extra = compileProductRuntimeBehaviorContractV1({
      productSpec,
      proposal,
      unexpected: true,
    });
    assert.equal(extra.status, "rejected");
    if (extra.status === "rejected") {
      assert.equal(extra.diagnostics[0]?.code, "PRODUCT_RUNTIME_BEHAVIOR_V1_INPUT_INVALID");
    }

    const stale = structuredClone(proposal);
    stale.productSpecHash = "0".repeat(64);
    const staleResult = compileProductRuntimeBehaviorContractV1({
      productSpec,
      proposal: stale,
    });
    assert.equal(staleResult.status, "rejected");
    if (staleResult.status === "rejected") {
      assert.equal(
        staleResult.diagnostics[0]?.code,
        "PRODUCT_RUNTIME_BEHAVIOR_V1_PROPOSAL_AUTHORITY_MISMATCH",
      );
    }

    let getterCalls = 0;
    const accessor: Record<string, unknown> = { productSpec };
    Object.defineProperty(accessor, "proposal", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return proposal;
      },
    });
    const accessorResult = compileProductRuntimeBehaviorContractV1(accessor);
    assert.equal(accessorResult.status, "rejected");
    assert.equal(getterCalls, 0);

    let proxyCalls = 0;
    const proxy = new Proxy({ productSpec, proposal }, {
      ownKeys() {
        proxyCalls += 1;
        return ["productSpec", "proposal"];
      },
    });
    const proxyResult = compileProductRuntimeBehaviorContractV1(proxy);
    assert.equal(proxyResult.status, "rejected");
    assert.equal(proxyCalls, 0);

    const cyclic: any = { productSpec, proposal };
    cyclic.self = cyclic;
    const cyclicResult = compileProductRuntimeBehaviorContractV1(cyclic);
    assert.equal(cyclicResult.status, "rejected");
  });
});
