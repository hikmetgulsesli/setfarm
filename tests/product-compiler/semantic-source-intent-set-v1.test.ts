import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import {
  compileInvocationInputTransportSetV2,
  compileInvocationInputTransportV2,
} from "../../src/product-compiler/invocation-input-transport-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  SemanticSourceIntentVerificationErrorV1,
  compileSemanticSourceIntentSetV1,
  verifySemanticSourceIntentSetV1,
} from "../../src/product-compiler/semantic-source-intent-set-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1,
  SemanticSourceIntentSetV1Schema,
  hashSemanticSourceIntentSetV1,
  hashSemanticSourceIntentV1,
  hashSemanticSourceSubjectOriginV1,
  type SemanticSourceIntentSetV1,
  type SemanticSourceIntentV1,
} from "../../src/product-compiler/schemas/semantic-source-intent-set-v1.js";
import {
  entityFieldNodeExpressApiProductSpecV2,
  entityFieldNodeRuntimeBehaviorAuthorityV1,
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
  twoStoryNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const NO_DESIGN_CLOSURE = Object.freeze({
  schema: "setfarm.design-source-closure.v2" as const,
  kind: "none" as const,
  reason: "product_delivery_design_not_required" as const,
});

const CLI_INTENT_SET_HASH_GOLDEN_V1 =
  "14b02148f3c93b0ac647a35468e970623120e889b6a40a2868c1f9392e406e59";
const API_INTENT_SET_HASH_GOLDEN_V1 =
  "bcdc10ec06a2536bc107c6bb069777793521d9484c12cacec0d7eb28bab50249";

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function selectionFor(
  productSpec: ProductSpecV2,
  stackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId: stackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected selection");
  return result.selection;
}

function compileFor(
  productSpec: ProductSpecV2,
  stackPackId: "node-cli" | "node-express-api",
) {
  const selection = selectionFor(productSpec, stackPackId);
  const result = compileSemanticSourceIntentSetV1({
    productSpec,
    deliverySelection: selection,
    designSourceClosure: NO_DESIGN_CLOSURE,
  });
  assert.equal(
    result.status,
    "shadow_compiled",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_compiled") throw new Error("Expected intent set");
  return { productSpec, selection, result, intentSet: result.intentSet };
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function rehashIntent(intent: SemanticSourceIntentV1): SemanticSourceIntentV1 {
  const candidate = structuredClone(intent);
  candidate.subjectHash = hashSemanticSourceSubjectOriginV1(candidate.subjectOrigin);
  candidate.intentHash = hashSemanticSourceIntentV1(candidate);
  return candidate;
}

function rehashSet(candidate: SemanticSourceIntentSetV1): SemanticSourceIntentSetV1 {
  candidate.intentSetHash = hashSemanticSourceIntentSetV1(candidate);
  return candidate;
}

function assertVerificationError(
  operation: () => unknown,
  code: SemanticSourceIntentVerificationErrorV1["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof SemanticSourceIntentVerificationErrorV1 && error.code === code,
  );
}

describe("SemanticSourceIntentSetV1 shadow compiler", () => {
  it("compiles the genuine CLI every-and-only obligations", () => {
    const { intentSet, result } = compileFor(genuineNodeCliProductSpecV2(), "node-cli");
    assert.equal(intentSet.schema, "setfarm.semantic-source-intent-set.v1");
    assert.equal(intentSet.authorityState, "shadow_blocked");
    assert.equal(intentSet.productionUse, "forbidden");
    assert.deepEqual(intentSet.blockerCodes, SEMANTIC_SOURCE_INTENT_BLOCKER_CODES_V1);
    assert.equal(intentSet.intentCount, 17);
    assert.equal(intentSet.intentSetHash, CLI_INTENT_SET_HASH_GOLDEN_V1);
    assert.equal(intentSet.authority.runtimeBehavior, null);
    assert.equal(
      intentSet.authority.storyPartition.schema,
      "setfarm.semantic-story-partition.v3",
    );
    assert.equal(intentSet.authority.storyPartition.partitionVersion, 3);
    assert.ok(intentSet.authority.storyPartition.stories.every((story) =>
      story.entityRefs.length === 0));
    assert.equal(result.intentSetHash, intentSet.intentSetHash);
    assert.equal(result.canonicalBytes, canonicalJsonStringify(intentSet));
    assert.equal(SemanticSourceIntentSetV1Schema.parse(intentSet).intentSetHash, intentSet.intentSetHash);

    const responsibilityCounts = new Map<string, number>();
    intentSet.intents.forEach((intent) => responsibilityCounts.set(
      intent.responsibility,
      (responsibilityCounts.get(intent.responsibility) ?? 0) + 1,
    ));
    assert.equal(responsibilityCounts.get("action_handler"), 1);
    assert.equal(responsibilityCounts.get("cli_output_adapter"), 1);
    assert.equal(responsibilityCounts.get("action_input_transport"), 1);
    assert.equal(responsibilityCounts.get("platform_command"), 3);
    assert.equal(responsibilityCounts.get("predicate_source_binding"), 2);
    assert.equal(responsibilityCounts.get("persistence_exemption"), 1);
    assert.equal(responsibilityCounts.get("runtime_data_fixture"), 1);
    assert.equal(responsibilityCounts.get("platform_registration"), 1);

    const entrypointIntents = intentSet.intents.filter((intent) =>
      intent.subjectKind === "entrypoint");
    assert.equal(entrypointIntents.length, 2);
    assert.ok(entrypointIntents.every((intent) => intent.semanticScope.kind === "setup"));
    const commandIntents = intentSet.intents.filter((intent) =>
      intent.subjectKind === "command");
    assert.ok(commandIntents.every((intent) => intent.semanticScope.kind === "platform"));
    const predicateIntents = intentSet.intents.filter((intent) =>
      intent.target.kind === "predicate_requirement");
    assert.equal(predicateIntents.length, 2);
    assert.ok(predicateIntents.every((intent) =>
      intent.target.kind === "predicate_requirement"
      && intent.target.resolutionState === "unresolved_shadow"));
    assert.ok(predicateIntents.every((intent) =>
      intent.subjectOrigin.originKind === "evidence_predicate"
      && intent.subjectOrigin.required
      && intent.subjectOrigin.actionReferenceRefs.includes("ACT_ADD_TASK")
      && intent.subjectOrigin.predicateSubjectRef.length > 0));

    const persistence = intentSet.intents.find((intent) =>
      intent.responsibility === "persistence_exemption")!;
    assert.equal(persistence.subjectOrigin.originKind, "persistence_absence");
    assert.equal(persistence.semanticScope.kind, "story");
    assert.deepEqual(persistence.target, {
      kind: "typed_exemption",
      targetKind: "typed_exemption",
      exemptionCode: "PERSISTENCE_NONE_NO_SOURCE_REQUIRED",
      backingResponsibility: null,
      backingResolution: { state: "not_applicable" },
    });
    assertDeepFrozen(result);
  });

  it("compiles the genuine API transport fields and exact obligations", () => {
    const { intentSet } = compileFor(genuineNodeExpressApiProductSpecV2(), "node-express-api");
    assert.equal(intentSet.intentCount, 19);
    assert.equal(intentSet.intentSetHash, API_INTENT_SET_HASH_GOLDEN_V1);
    const inputIntents = intentSet.intents.filter((intent) =>
      intent.responsibility === "action_input_transport");
    assert.equal(inputIntents.length, 2);
    assert.deepEqual(
      inputIntents.map((intent) =>
        intent.subjectOrigin.originKind === "action_input"
          ? intent.subjectOrigin.fieldName
          : "invalid"),
      ["project", "title"],
    );
    const binding = intentSet.authority.invocationTransportSet.bindings[0]!;
    assert.equal(binding.transportKind, "http_request");
    inputIntents.forEach((intent) => {
      assert.equal(intent.target.kind, "source_slot");
      if (intent.target.kind !== "source_slot") return;
      assert.equal(
        intent.target.subjectContractResolution.kind,
        "http_invocation_input_transport",
      );
      assert.equal(
        intent.target.resolvedSubjectContract.kind,
        "invocation_input_transport_v2",
      );
      if (intent.target.resolvedSubjectContract.kind !== "invocation_input_transport_v2") return;
      assert.equal(intent.target.resolvedSubjectContract.contractHash, binding.contractHash);
      assert.equal(intent.target.resolvedSubjectContract.transportKind, "http_request");
      assert.equal(
        intent.target.resolvedSubjectContract.resolutionContractRef,
        "ACTION_INPUT_HTTP_INVOCATION_V2",
      );
    });
  });

  it("compiles the transport set once with exact single-action parity", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const selection = selectionFor(productSpec, "node-cli");
    const setResult = compileInvocationInputTransportSetV2({
      productSpec,
      deliverySelection: selection,
    });
    const single = compileInvocationInputTransportV2({
      productSpec,
      deliverySelection: selection,
      actionRef: "ACT_ADD_TASK",
    });
    assert.equal(setResult.status, "shadow_compiled");
    assert.equal(single.status, "shadow_compiled");
    if (setResult.status !== "shadow_compiled" || single.status !== "shadow_compiled") return;
    assert.equal(setResult.contractSet.contracts.length, 1);
    assert.deepEqual(setResult.contractSet.contracts[0], single.contract);
    assertDeepFrozen(setResult);
  });

  it("keeps stable obligation refs and path contracts across prose-only name changes", () => {
    const originalProduct = genuineNodeCliProductSpecV2();
    const changedProduct = structuredClone(originalProduct);
    changedProduct.product.name = "Renamed Task CLI";
    changedProduct.states[0]!.name = "Renamed Tasks";
    changedProduct.surfaces[0]!.name = "Renamed Terminal";
    changedProduct.actions[0]!.name = "Renamed Add";
    const original = compileFor(originalProduct, "node-cli").intentSet;
    const changed = compileFor(ProductSpecV2Schema.parse(changedProduct), "node-cli").intentSet;

    assert.notEqual(original.authority.productSpecHash, changed.authority.productSpecHash);
    assert.notEqual(
      original.authority.deliverySelection.selectionHash,
      changed.authority.deliverySelection.selectionHash,
    );
    assert.deepEqual(
      original.intents.map((intent) => ({
        key: `${intent.subjectKind}\0${intent.subjectRef}\0${intent.responsibility}`,
        intentRef: intent.intentRef,
        scopeRef: intent.semanticScope.scopeRef,
        pathResolution: intent.target.kind === "source_slot"
          ? intent.target.pathResolution
          : null,
      })),
      changed.intents.map((intent) => ({
        key: `${intent.subjectKind}\0${intent.subjectRef}\0${intent.responsibility}`,
        intentRef: intent.intentRef,
        scopeRef: intent.semanticScope.scopeRef,
        pathResolution: intent.target.kind === "source_slot"
          ? intent.target.pathResolution
          : null,
      })),
    );
    assert.ok(original.intents.some((intent, index) =>
      intent.intentHash !== changed.intents[index]!.intentHash));
  });

  it("namespaces story obligations by product while preserving platform obligations", () => {
    const originalProduct = genuineNodeCliProductSpecV2();
    const otherProductValue = structuredClone(originalProduct);
    otherProductValue.product.id = "PROD_OTHER_TASK_CLI";
    otherProductValue.product.name = "Other Task CLI";
    const otherProduct = ProductSpecV2Schema.parse(otherProductValue);
    const original = compileFor(originalProduct, "node-cli").intentSet;
    const other = compileFor(otherProduct, "node-cli").intentSet;
    const originalStory = original.intents.filter((intent) =>
      intent.semanticScope.kind === "story");
    const otherStory = other.intents.filter((intent) =>
      intent.semanticScope.kind === "story");
    assert.equal(originalStory.length, otherStory.length);
    assert.ok(originalStory.every((intent, index) =>
      intent.semanticScope.kind === "story"
      && otherStory[index]!.semanticScope.kind === "story"
      && intent.semanticScope.productRef === "PROD_TASK_CLI"
      && otherStory[index]!.semanticScope.productRef === "PROD_OTHER_TASK_CLI"
      && intent.intentRef !== otherStory[index]!.intentRef
      && intent.intentHash !== otherStory[index]!.intentHash));
    assert.deepEqual(
      original.intents.filter((intent) => intent.semanticScope.kind === "platform")
        .map((intent) => intent.intentRef),
      other.intents.filter((intent) => intent.semanticScope.kind === "platform")
        .map((intent) => intent.intentRef),
    );
  });

  it("derives persistence absence per story and rejects cross-story optional evidence", () => {
    const mixed = twoStoryNodeExpressApiProductSpecV2({
      memoryOnOriginalStory: true,
    });
    const mixedIntentSet = compileFor(mixed, "node-express-api").intentSet;
    const persistenceIntents = mixedIntentSet.intents.filter((intent) =>
      intent.responsibility === "persistence_exemption");
    assert.equal(persistenceIntents.length, 2);
    assert.deepEqual(
      persistenceIntents.map((intent) => intent.subjectOrigin.originKind).sort(compareUtf16),
      ["persistence_absence", "persistence_policy"],
    );
    assert.deepEqual(
      persistenceIntents.map((intent) =>
        intent.target.kind === "typed_exemption" ? intent.target.exemptionCode : "invalid")
        .sort(compareUtf16),
      ["PERSISTENCE_MEMORY_USES_STATE_STORE", "PERSISTENCE_NONE_NO_SOURCE_REQUIRED"],
    );
    assert.equal(new Set(persistenceIntents.map((intent) =>
      intent.semanticScope.scopeRef)).size, 2);

    const crossStory = twoStoryNodeExpressApiProductSpecV2({
      crossStoryOptionalEvidence: true,
    });
    const crossStoryResult = compileSemanticSourceIntentSetV1({
      productSpec: crossStory,
      deliverySelection: selectionFor(crossStory, "node-express-api"),
      designSourceClosure: NO_DESIGN_CLOSURE,
    });
    assert.equal(crossStoryResult.status, "rejected");
    if (crossStoryResult.status === "rejected") {
      assert.ok(crossStoryResult.diagnostics.some((item) =>
        item.code === "SEMANTIC_SOURCE_INTENT_V1_SUBJECT_OWNERSHIP_AMBIGUOUS"
        && item.message.includes("StoryPartitionV3")));
    }
  });

  it("rejects authority callers that inject paths, rules, transports or closure prose", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const selection = selectionFor(productSpec, "node-cli");
    const injected = compileSemanticSourceIntentSetV1({
      productSpec,
      deliverySelection: selection,
      designSourceClosure: NO_DESIGN_CLOSURE,
      paths: { ACT_ADD_TASK: "src/convenient.ts" },
    });
    assert.equal(injected.status, "rejected");
    if (injected.status === "rejected") {
      assert.equal(injected.diagnostics[0]!.code, "SEMANTIC_SOURCE_INTENT_V1_INPUT_INVALID");
    }
    for (const field of ["rules", "stories", "transports", "verified"] as const) {
      const result = compileSemanticSourceIntentSetV1({
        productSpec,
        deliverySelection: selection,
        designSourceClosure: NO_DESIGN_CLOSURE,
        [field]: [],
      });
      assert.equal(result.status, "rejected");
    }
    const closureWithProse = compileSemanticSourceIntentSetV1({
      productSpec,
      deliverySelection: selection,
      designSourceClosure: { ...NO_DESIGN_CLOSURE, explanation: "trust me" },
    });
    assert.equal(closureWithProse.status, "rejected");
  });

  it("rejects wrong selection authority and entity ownership without behavior authority", () => {
    const cli = genuineNodeCliProductSpecV2();
    const api = genuineNodeExpressApiProductSpecV2();
    const apiSelection = selectionFor(api, "node-express-api");
    const wrongSelection = compileSemanticSourceIntentSetV1({
      productSpec: cli,
      deliverySelection: apiSelection,
      designSourceClosure: NO_DESIGN_CLOSURE,
    });
    assert.equal(wrongSelection.status, "rejected");
    if (wrongSelection.status === "rejected") {
      assert.equal(
        wrongSelection.diagnostics[0]!.code,
        "SEMANTIC_SOURCE_INTENT_V1_DELIVERY_SELECTION_AUTHORITY_MISMATCH",
      );
    }

    const entityProduct = structuredClone(cli);
    entityProduct.entities = [{
      id: "ENTITY_TASK",
      name: "Task",
      fields: [{
        id: "FIELD_TASK_TITLE",
        name: "title",
        valueType: "string",
        required: true,
      }],
    }];
    entityProduct.actions[0]!.input.fields[0]!.entityFieldRef = "FIELD_TASK_TITLE";
    entityProduct.traceability.bindings.push({
      semanticKind: "entity",
      semanticRef: "ENTITY_TASK",
      requirementRefs: [entityProduct.requirements[0]!.id],
    });
    entityProduct.traceability.bindings.sort((left, right) =>
      left.semanticKind.localeCompare(right.semanticKind)
      || left.semanticRef.localeCompare(right.semanticRef));
    entityProduct.requirements[0]!.expectedSemanticKinds = [
      ...entityProduct.requirements[0]!.expectedSemanticKinds,
      "entity",
    ].sort() as typeof entityProduct.requirements[0]["expectedSemanticKinds"];
    const parsedEntityProduct = ProductSpecV2Schema.parse(entityProduct);
    const entityResult = compileSemanticSourceIntentSetV1({
      productSpec: parsedEntityProduct,
      deliverySelection: selectionFor(parsedEntityProduct, "node-cli"),
      designSourceClosure: NO_DESIGN_CLOSURE,
    });
    assert.equal(entityResult.status, "rejected");
    if (entityResult.status === "rejected") {
      assert.equal(
        entityResult.diagnostics[0]!.code,
        "SEMANTIC_SOURCE_INTENT_V1_STORY_PARTITION_REJECTED",
      );
      assert.match(
        entityResult.diagnostics[0]!.message,
        /behavior authority/i,
      );
    }
  });

  it("binds entity ownership to exact StoryPartitionV3 behavior authority", () => {
    const productSpec = entityFieldNodeExpressApiProductSpecV2();
    const selection = selectionFor(productSpec, "node-express-api");
    const behavior = entityFieldNodeRuntimeBehaviorAuthorityV1(productSpec);
    const result = compileSemanticSourceIntentSetV1({
      productSpec,
      deliverySelection: selection,
      designSourceClosure: NO_DESIGN_CLOSURE,
      ...behavior,
    });
    assert.equal(
      result.status,
      "shadow_compiled",
      result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
    );
    if (result.status !== "shadow_compiled") return;

    assert.deepEqual(result.intentSet.authority.runtimeBehavior, {
      proposalSchema: "setfarm.product-runtime-behavior-proposal.v1",
      proposalHash: behavior.runtimeBehaviorContract.authority.proposalHash,
      contractSchema: "setfarm.product-runtime-behavior-contract.v1",
      contractVersion: "1.0.0",
      contractHash: behavior.runtimeBehaviorContract.contractHash,
      evaluatorContractHash:
        behavior.runtimeBehaviorContract.authority.evaluatorContractHash,
    });
    assert.equal(
      result.intentSet.authority.storyPartition.schema,
      "setfarm.semantic-story-partition.v3",
    );
    assert.equal(result.intentSet.authority.storyPartition.partitionVersion, 3);
    assert.equal(result.intentSet.authority.storyPartition.storyCount, 1);
    assert.deepEqual(
      result.intentSet.authority.storyPartition.stories[0]!.entityRefs,
      ["ENTITY_TASK_CATALOG_ENTRY"],
    );
    const entityIntent = result.intentSet.intents.find((intent) =>
      intent.subjectKind === "entity");
    assert.ok(entityIntent);
    assert.equal(entityIntent.responsibility, "entity_model");
    assert.equal(entityIntent.semanticScope.kind, "story");
    assert.equal(entityIntent.semanticScope.storyId, "US-001");
    assert.deepEqual(entityIntent.subjectOrigin, {
      originKind: "entity",
      entityRef: "ENTITY_TASK_CATALOG_ENTRY",
      entityContractHash:
        "0d05518c46ee000093f35e6d745783d3d0e213b049b2c5b1d7b12f1073bca15f",
      fieldRefs: [
        "FIELD_TASK_CATALOG_PROJECT",
        "FIELD_TASK_CATALOG_TASK",
      ],
      fieldContractHash:
        "7808e55dcdd91e564a09be2a4b67e80e18f40c4dbdb3383b35c977f8561cba38",
    });

    const verified = verifySemanticSourceIntentSetV1({
      productSpec,
      deliverySelection: selection,
      designSourceClosure: NO_DESIGN_CLOSURE,
      ...behavior,
      candidate: result.intentSet,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.intentSetHash, result.intentSetHash);
  });

  it("fresh-verifies and rejects self-consistently rehashed missing or mutated intents", () => {
    const authority = compileFor(genuineNodeCliProductSpecV2(), "node-cli");
    const verified = verifySemanticSourceIntentSetV1({
      productSpec: authority.productSpec,
      deliverySelection: authority.selection,
      designSourceClosure: NO_DESIGN_CLOSURE,
      candidate: authority.intentSet,
    });
    assert.equal(verified.status, "verified_shadow");
    assert.equal(verified.intentSetHash, CLI_INTENT_SET_HASH_GOLDEN_V1);
    assertDeepFrozen(verified);

    const missing = structuredClone(authority.intentSet);
    missing.intents.splice(0, 1);
    missing.intentCount = missing.intents.length;
    rehashSet(missing);
    assert.equal(SemanticSourceIntentSetV1Schema.safeParse(missing).success, true);
    assertVerificationError(
      () => verifySemanticSourceIntentSetV1({
        productSpec: authority.productSpec,
        deliverySelection: authority.selection,
        designSourceClosure: NO_DESIGN_CLOSURE,
        candidate: missing,
      }),
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const mismatchedTransport = structuredClone(authority.intentSet);
    const actionInputIndex = mismatchedTransport.intents.findIndex((intent) =>
      intent.subjectOrigin.originKind === "action_input");
    assert.notEqual(actionInputIndex, -1);
    const actionInputIntent = mismatchedTransport.intents[actionInputIndex]!;
    assert.equal(actionInputIntent.target.kind, "source_slot");
    if (
      actionInputIntent.target.kind === "source_slot"
      && actionInputIntent.target.resolvedSubjectContract.kind
        === "invocation_input_transport_v2"
    ) {
      actionInputIntent.target.resolvedSubjectContract.rawActionInputRef =
        "ACT_ADD_TASK.forged";
    }
    mismatchedTransport.intents[actionInputIndex] = rehashIntent(actionInputIntent);
    rehashSet(mismatchedTransport);
    assert.equal(SemanticSourceIntentSetV1Schema.safeParse(mismatchedTransport).success, false);

    const mutated = structuredClone(authority.intentSet);
    const sourceIndex = mutated.intents.findIndex((intent) =>
      intent.target.kind === "source_slot"
      && intent.target.pathResolution.kind === "compiler_semantic_token_path");
    assert.notEqual(sourceIndex, -1);
    const source = mutated.intents[sourceIndex]!;
    assert.equal(source.target.kind, "source_slot");
    if (
      source.target.kind === "source_slot"
      && source.target.pathResolution.kind === "compiler_semantic_token_path"
    ) {
      source.target.pathResolution.root = "src/forged";
    }
    mutated.intents[sourceIndex] = rehashIntent(source);
    rehashSet(mutated);
    assert.equal(SemanticSourceIntentSetV1Schema.safeParse(mutated).success, true);
    assertVerificationError(
      () => verifySemanticSourceIntentSetV1({
        productSpec: authority.productSpec,
        deliverySelection: authority.selection,
        designSourceClosure: NO_DESIGN_CLOSURE,
        candidate: mutated,
      }),
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_AUTHORITY_MISMATCH",
    );

    const promoted = structuredClone(authority.intentSet) as any;
    promoted.authorityState = "active";
    assertVerificationError(
      () => verifySemanticSourceIntentSetV1({
        productSpec: authority.productSpec,
        deliverySelection: authority.selection,
        designSourceClosure: NO_DESIGN_CLOSURE,
        candidate: promoted,
      }),
      "SEMANTIC_SOURCE_INTENT_V1_VERIFICATION_CANDIDATE_INVALID",
    );
  });

  it("rejects proxy, cycle, sparse and oversized hostile inputs without invoking proxy traps", () => {
    let trapCount = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        trapCount += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        return undefined;
      },
    });
    const proxied = compileSemanticSourceIntentSetV1(proxy);
    assert.equal(proxied.status, "rejected");
    assert.equal(trapCount, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(compileSemanticSourceIntentSetV1(cycle).status, "rejected");

    const productSpec = genuineNodeCliProductSpecV2();
    const sparse = structuredClone(productSpec) as any;
    sparse.actions = new Array(2);
    sparse.actions[1] = productSpec.actions[0];
    assert.equal(compileSemanticSourceIntentSetV1({
      productSpec: sparse,
      deliverySelection: selectionFor(productSpec, "node-cli"),
      designSourceClosure: NO_DESIGN_CLOSURE,
    }).status, "rejected");

    assert.equal(compileSemanticSourceIntentSetV1({
      productSpec,
      deliverySelection: selectionFor(productSpec, "node-cli"),
      designSourceClosure: NO_DESIGN_CLOSURE,
      padding: "x".repeat(8 * 1024 * 1024),
    }).status, "rejected");
  });
});
