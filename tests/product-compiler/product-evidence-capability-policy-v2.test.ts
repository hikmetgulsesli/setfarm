import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify, hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  ProductEvidenceCapabilityBindingSetV2Schema,
  compileProductEvidenceCapabilityBindingsV2,
  hashProductEvidenceCapabilityBindingSetV2,
  hashProductEvidenceCapabilityBindingV2,
  verifyProductEvidenceCapabilityBindingsV2,
} from "../../src/product-compiler/product-evidence-capability-bindings-v2.js";
import {
  PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION,
  ProductEvidenceCapabilityPolicyV2Schema,
  canonicalProductEvidenceCapabilityPolicyV2,
  getProductEvidenceCapabilityPolicyV2,
  productEvidenceCapabilityPolicyHashV2,
} from "../../src/product-compiler/product-evidence-capability-policy-v2.js";
import {
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
  derivePersistenceRoundTripEvidenceIdV2,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function selectionFor(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({ productSpec, requestedStackPackId });
  assert.equal(result.status, "shadow_selected", result.status === "rejected"
    ? JSON.stringify(result.diagnostics)
    : undefined);
  if (result.status !== "shadow_selected") throw new Error("Expected a shadow selection");
  return result.selection;
}

function compiledFor(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
) {
  const deliverySelection = selectionFor(productSpec, requestedStackPackId);
  const result = compileProductEvidenceCapabilityBindingsV2({ productSpec, deliverySelection });
  assert.equal(result.status, "compiled", result.status === "rejected"
    ? JSON.stringify(result.diagnostics)
    : undefined);
  if (result.status !== "compiled") throw new Error("Expected a compiled binding set");
  return { result, deliverySelection };
}

function rehashBindingSet(candidate: any): void {
  for (const binding of candidate.bindings) {
    const { bindingHash: _bindingHash, ...withoutBindingHash } = binding;
    binding.bindingHash = hashProductEvidenceCapabilityBindingV2(withoutBindingHash);
  }
  const { bindingSetHash: _bindingSetHash, ...withoutSetHash } = candidate;
  candidate.bindingSetHash = hashProductEvidenceCapabilityBindingSetV2(withoutSetHash);
}

function withVisualEvidence(
  productSpec: ProductSpecV2,
  count = 1,
): ProductSpecV2 {
  const candidate: any = clone(productSpec);
  const requirementRefs = candidate.traceability.bindings[0].requirementRefs;
  for (let index = 0; index < count; index += 1) {
    const evidenceRef = `EVID_VISUAL_${String(index).padStart(4, "0")}`;
    candidate.evidencePredicates.push({
      id: evidenceRef,
      kind: "visual",
      required: false,
      subjectRef: candidate.surfaces[0].id,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    });
    candidate.traceability.bindings.push({
      semanticKind: "evidence",
      semanticRef: evidenceRef,
      requirementRefs,
    });
  }
  return ProductSpecV2Schema.parse(candidate);
}

function withBuildEvidence(
  productSpec: ProductSpecV2,
  count: number,
  ownedCount = 0,
): ProductSpecV2 {
  const candidate: any = clone(productSpec);
  const requirementRefs = candidate.traceability.bindings[0].requirementRefs;
  const evidenceRefs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const evidenceRef = `EVID_BUILD_${String(index).padStart(4, "0")}`;
    evidenceRefs.push(evidenceRef);
    candidate.evidencePredicates.push({
      id: evidenceRef,
      kind: "build",
      required: false,
      subjectRef: candidate.surfaces[0].id,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    });
    candidate.traceability.bindings.push({
      semanticKind: "evidence",
      semanticRef: evidenceRef,
      requirementRefs,
    });
  }
  candidate.actions[0].evidenceRefs.push(...evidenceRefs.slice(0, ownedCount));
  candidate.actions[0].evidenceRefs.sort();
  return ProductSpecV2Schema.parse(candidate);
}

function withMemoryPersistence(productSpec: ProductSpecV2): ProductSpecV2 {
  const candidate: any = clone(productSpec);
  const policyRef = "PERSIST_TASKS_MEMORY";
  const action = candidate.actions[0];
  const evidenceRef = derivePersistenceRoundTripEvidenceIdV2(action.id, policyRef);
  const requirementRefs = candidate.traceability.bindings[0].requirementRefs;
  candidate.persistencePolicies.push({
    id: policyRef,
    kind: "memory",
    owner: "server",
    entityRefs: [],
    durability: "session",
    rehydration: { kind: "none" },
  });
  action.persistenceEffects.push({
    policyRef,
    operation: "write",
    payloadFields: [],
    statePaths: [{ stateRef: candidate.states[0].id, path: "" }],
  });
  action.success.persistenceRefs = [policyRef];
  action.evidenceRefs.push(evidenceRef);
  action.evidenceRefs.sort();
  action.success.evidenceRefs.push(evidenceRef);
  action.success.evidenceRefs.sort();
  candidate.evidencePredicates.push({
    id: evidenceRef,
    kind: "persistence_round_trip",
    required: true,
    subjectRef: policyRef,
    capabilityRefs: [],
    assertion: { operator: "passes" },
  });
  candidate.traceability.bindings.push({
    semanticKind: "persistence",
    semanticRef: policyRef,
    requirementRefs,
  });
  candidate.traceability.bindings.push({
    semanticKind: "evidence",
    semanticRef: evidenceRef,
    requirementRefs,
  });
  return ProductSpecV2Schema.parse(candidate);
}

function withTwoMemoryPersistences(productSpec: ProductSpecV2): ProductSpecV2 {
  const candidate: any = clone(withMemoryPersistence(productSpec));
  const policyRef = "PERSIST_TASKS_MEMORY_SECONDARY";
  const action = candidate.actions[0];
  const evidenceRef = derivePersistenceRoundTripEvidenceIdV2(action.id, policyRef);
  const requirementRefs = candidate.traceability.bindings[0].requirementRefs;
  candidate.persistencePolicies.push({
    id: policyRef,
    kind: "memory",
    owner: "server",
    entityRefs: [],
    durability: "session",
    rehydration: { kind: "none" },
  });
  action.persistenceEffects.push({
    policyRef,
    operation: "write",
    payloadFields: [],
    statePaths: [{ stateRef: candidate.states[0].id, path: "" }],
  });
  action.success.persistenceRefs.push(policyRef);
  action.evidenceRefs.push(evidenceRef);
  action.evidenceRefs.sort();
  action.success.evidenceRefs.push(evidenceRef);
  action.success.evidenceRefs.sort();
  candidate.evidencePredicates.push({
    id: evidenceRef,
    kind: "persistence_round_trip",
    required: true,
    subjectRef: policyRef,
    capabilityRefs: [],
    assertion: { operator: "passes" },
  });
  candidate.traceability.bindings.push({
    semanticKind: "persistence",
    semanticRef: policyRef,
    requirementRefs,
  }, {
    semanticKind: "evidence",
    semanticRef: evidenceRef,
    requirementRefs,
  });
  return ProductSpecV2Schema.parse(candidate);
}

function withSecondApiActionOwning(
  productSpec: ProductSpecV2,
  sharedEvidenceRef: string,
): unknown {
  const candidate: any = clone(productSpec);
  const first = candidate.actions[0];
  const firstInvocationRef = deriveActionInvocationEvidenceIdV2(first.id);
  const firstObservable = first.observableEffects[0];
  const second = clone(first);
  second.id = "ACT_CREATE_TASK_SECONDARY";
  second.name = "Create Secondary Task";
  second.invocationInterface.method = "PUT";
  const secondInvocationRef = deriveActionInvocationEvidenceIdV2(second.id);
  const secondObservableRef = "OBS_TASK_CREATED_SECONDARY";
  const secondObservableEvidenceRef = "EVID_TASK_CREATED_SECONDARY";
  second.observableEffects[0].id = secondObservableRef;
  second.observableEffects[0].evidenceRef = secondObservableEvidenceRef;
  second.evidenceRefs = second.evidenceRefs.map((reference: string) =>
    reference === firstInvocationRef
      ? secondInvocationRef
      : reference === firstObservable.evidenceRef
        ? secondObservableEvidenceRef
        : reference);
  second.success.evidenceRefs = second.success.evidenceRefs.map((reference: string) =>
    reference === firstInvocationRef
      ? secondInvocationRef
      : reference === firstObservable.evidenceRef
        ? secondObservableEvidenceRef
        : reference);
  assert.ok(second.evidenceRefs.includes(sharedEvidenceRef));
  candidate.actions.push(second);
  candidate.evidencePredicates.push({
    id: secondObservableEvidenceRef,
    kind: "observable_outcome",
    required: true,
    subjectRef: secondObservableRef,
    capabilityRefs: [],
    assertion: { operator: "passes" },
  }, {
    id: secondInvocationRef,
    kind: "action_invocation",
    required: true,
    subjectRef: second.id,
    capabilityRefs: [],
    assertion: { operator: "passes" },
  });
  const requirementRefs = candidate.traceability.bindings.find((binding: any) =>
    binding.semanticKind === "action" && binding.semanticRef === first.id).requirementRefs;
  candidate.traceability.bindings.push(
    { semanticKind: "action", semanticRef: second.id, requirementRefs },
    { semanticKind: "evidence", semanticRef: secondObservableEvidenceRef, requirementRefs },
    { semanticKind: "evidence", semanticRef: secondInvocationRef, requirementRefs },
    { semanticKind: "observable", semanticRef: secondObservableRef, requirementRefs },
  );
  return candidate;
}

function withManyExactPoliciesAndObservables(
  productSpec: ProductSpecV2,
  count: number,
): ProductSpecV2 {
  const candidate: any = clone(productSpec);
  const action = candidate.actions[0];
  const observableTemplate = clone(action.observableEffects[0]);
  const requirementRefs = candidate.traceability.bindings[0].requirementRefs;
  for (let index = 0; index < count; index += 1) {
    const suffix = String(index).padStart(4, "0");
    const policyRef = `PERSIST_TASKS_MEMORY_${suffix}`;
    const persistenceEvidenceRef = derivePersistenceRoundTripEvidenceIdV2(action.id, policyRef);
    const observableRef = `OBS_TASK_CREATED_EXTRA_${suffix}`;
    const observableEvidenceRef = `EVID_TASK_CREATED_EXTRA_${suffix}`;
    candidate.persistencePolicies.push({
      id: policyRef,
      kind: "memory",
      owner: "server",
      entityRefs: [],
      durability: "session",
      rehydration: { kind: "none" },
    });
    action.persistenceEffects.push({
      policyRef,
      operation: "write",
      payloadFields: [],
      statePaths: [{ stateRef: candidate.states[0].id, path: "" }],
    });
    action.success.persistenceRefs.push(policyRef);
    action.observableEffects.push({
      ...clone(observableTemplate),
      id: observableRef,
      evidenceRef: observableEvidenceRef,
      selector: {
        ...clone(observableTemplate.selector),
        pointer: `/extra_${suffix}`,
      },
    });
    action.evidenceRefs.push(persistenceEvidenceRef, observableEvidenceRef);
    action.success.evidenceRefs.push(persistenceEvidenceRef, observableEvidenceRef);
    candidate.evidencePredicates.push({
      id: persistenceEvidenceRef,
      kind: "persistence_round_trip",
      required: true,
      subjectRef: policyRef,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    }, {
      id: observableEvidenceRef,
      kind: "observable_outcome",
      required: true,
      subjectRef: observableRef,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    });
    candidate.traceability.bindings.push(
      { semanticKind: "persistence", semanticRef: policyRef, requirementRefs },
      { semanticKind: "evidence", semanticRef: persistenceEvidenceRef, requirementRefs },
      { semanticKind: "evidence", semanticRef: observableEvidenceRef, requirementRefs },
      { semanticKind: "observable", semanticRef: observableRef, requirementRefs },
    );
  }
  action.evidenceRefs.sort();
  action.success.evidenceRefs.sort();
  action.success.persistenceRefs.sort();
  return ProductSpecV2Schema.parse(candidate);
}

function schemaMessages(candidate: unknown): string[] {
  const result = ProductSpecV2Schema.safeParse(candidate);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("ProductEvidenceCapabilityPolicyV2", () => {
  it("owns a complete deterministic invocation-aware policy without mutable singleton state", () => {
    const first = getProductEvidenceCapabilityPolicyV2();
    const second = getProductEvidenceCapabilityPolicyV2();

    assert.equal(first.version, PRODUCT_EVIDENCE_CAPABILITY_POLICY_V2_VERSION);
    assert.equal(first.productSpecCapabilityRefsDisposition, "forbidden");
    assert.equal(first.topologyCapabilityResolution, "exactly_one_enabled");
    assert.equal(first.evidenceRules.length, 12);
    assert.equal(first.invocationRules.length, 4);
    assert.equal(first.persistenceRules.length, 6);
    assert.deepEqual(ProductEvidenceCapabilityPolicyV2Schema.parse(first), first);
    assert.equal(canonicalProductEvidenceCapabilityPolicyV2(), canonicalJsonStringify(first));
    assert.equal(productEvidenceCapabilityPolicyHashV2(), hashCanonicalJson(first));
    assert.notEqual(first, second);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.evidenceRules));
    assert.ok(Object.isFrozen(first.evidenceRules[0]));
    assert.throws(() => {
      (first.evidenceRules as any[]).push(first.evidenceRules[0]);
    }, TypeError);
    assert.deepEqual(getProductEvidenceCapabilityPolicyV2(), second);
  });

  it("maps typed CLI and HTTP invocation semantics instead of trigger prose", () => {
    const policy = getProductEvidenceCapabilityPolicyV2();
    const invocationCapabilities = Object.fromEntries(policy.invocationRules.map((rule) => [
      rule.invocationKind,
      rule.capabilityKinds,
    ]));

    assert.deepEqual(invocationCapabilities, {
      cli_command: ["cli_interaction"],
      http_request: ["network"],
      rendered_control: ["browser_interaction"],
      route_entry: ["browser_interaction"],
    });
    assert.equal(
      policy.evidenceRules.find((rule) => rule.evidenceKind === "action_invocation")
        ?.subjectActionInvocation,
      "required",
    );
    assert.equal(
      policy.evidenceRules.find((rule) => rule.evidenceKind === "observable_outcome")
        ?.subjectActionInvocation,
      "required",
    );
    assert.deepEqual(
      Object.fromEntries(policy.evidenceRules.map((rule) => [rule.evidenceKind, {
        subjectActionInvocation: rule.subjectActionInvocation,
        persistenceResolution: rule.persistenceResolution,
      }])),
      {
        action_invocation: { subjectActionInvocation: "required", persistenceResolution: "none" },
        build: { subjectActionInvocation: "none", persistenceResolution: "none" },
        control_action: { subjectActionInvocation: "required", persistenceResolution: "none" },
        control_visible: { subjectActionInvocation: "none", persistenceResolution: "none" },
        download: { subjectActionInvocation: "when_resolvable", persistenceResolution: "none" },
        navigation: { subjectActionInvocation: "when_resolvable", persistenceResolution: "none" },
        observable_outcome: { subjectActionInvocation: "required", persistenceResolution: "none" },
        persistence_round_trip: {
          subjectActionInvocation: "required",
          persistenceResolution: "exact_subject_policy",
        },
        runtime: { subjectActionInvocation: "when_resolvable", persistenceResolution: "none" },
        state_transition: { subjectActionInvocation: "none", persistenceResolution: "none" },
        test: { subjectActionInvocation: "none", persistenceResolution: "none" },
        visual: { subjectActionInvocation: "none", persistenceResolution: "none" },
      },
    );
  });
});

describe("ProductEvidenceCapabilityBindingSetV2", () => {
  it("compiles every-and-only genuine CLI and API evidence through typed invocation semantics", () => {
    for (const [productSpec, stackPackId, expectedKind, expectedRef] of [
      [genuineNodeCliProductSpecV2(), "node-cli", "cli_interaction", "CAP_CLI_INTERACTION"],
      [genuineNodeExpressApiProductSpecV2(), "node-express-api", "network", "CAP_NETWORK_ACCESS"],
    ] as const) {
      const snapshot = clone(productSpec);
      const { result, deliverySelection } = compiledFor(productSpec, stackPackId);

      assert.deepEqual(productSpec, snapshot);
      assert.equal(result.bindingSet.bindings.length, productSpec.evidencePredicates.length);
      assert.deepEqual(
        result.bindingSet.bindings.map((binding) => binding.evidenceRef),
        productSpec.evidencePredicates.map((predicate) => predicate.id).sort(),
      );
      for (const binding of result.bindingSet.bindings) {
        assert.equal(binding.subjectAction.kind, "action");
        assert.deepEqual(binding.capabilities.map((capability) => ({
          kind: capability.capabilityKind,
          ref: capability.capabilityRef,
        })), [{ kind: expectedKind, ref: expectedRef }]);
      }
      assert.equal(result.bindingSet.deliverySelection.profileId, deliverySelection.profileId);
      assert.deepEqual(ProductEvidenceCapabilityBindingSetV2Schema.parse(result.bindingSet), result.bindingSet);
      assert.equal(result.canonicalBytes, canonicalJsonStringify(result.bindingSet));
      assert.equal(result.bindingSetHash, result.bindingSet.bindingSetHash);
      assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.bindingSet));
      assert.ok(Object.isFrozen(result.bindingSet.bindings));
      assert.ok(Object.isFrozen(result.bindingSet.bindings[0]?.capabilities));
    }
  });

  it("is deterministic across caller object-key order and keeps capability ownership outside ProductSpec", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const selection = selectionFor(productSpec, "node-cli");
    const first = compileProductEvidenceCapabilityBindingsV2({ productSpec, deliverySelection: selection });
    const second = compileProductEvidenceCapabilityBindingsV2({
      deliverySelection: clone(selection),
      productSpec: clone(productSpec),
    });

    assert.equal(first.status, "compiled");
    assert.equal(second.status, "compiled");
    if (first.status !== "compiled" || second.status !== "compiled") return;
    assert.equal(first.canonicalBytes, second.canonicalBytes);
    assert.equal(first.bindingSetHash, second.bindingSetHash);
    assert.ok(productSpec.evidencePredicates.every((predicate) => predicate.capabilityRefs.length === 0));
  });

  it("rejects caller-authored physical refs and unsupported rendered evidence under a CLI profile", () => {
    const callerOwned: any = clone(genuineNodeCliProductSpecV2());
    callerOwned.evidencePredicates.find((item: any) => item.kind === "observable_outcome")
      .capabilityRefs = ["CAP_CLI_INTERACTION"];
    const callerProduct = ProductSpecV2Schema.parse(callerOwned);
    const callerSelection = selectionFor(callerProduct, "node-cli");
    const callerResult = compileProductEvidenceCapabilityBindingsV2({
      productSpec: callerProduct,
      deliverySelection: callerSelection,
    });
    assert.equal(callerResult.status, "rejected");
    if (callerResult.status === "rejected") {
      assert.ok(callerResult.diagnostics.some((item) =>
        item.code === "PRODUCT_EVIDENCE_CAPABILITY_V2_CALLER_REF_FORBIDDEN"));
    }

    const visualProduct = withVisualEvidence(genuineNodeCliProductSpecV2());
    const visualSelection = selectionFor(visualProduct, "node-cli");
    const visualResult = compileProductEvidenceCapabilityBindingsV2({
      productSpec: visualProduct,
      deliverySelection: visualSelection,
    });
    assert.equal(visualResult.status, "rejected");
    if (visualResult.status === "rejected") {
      assert.ok(visualResult.diagnostics.some((item) =>
        item.code === "PRODUCT_EVIDENCE_CAPABILITY_V2_CAPABILITY_UNAVAILABLE"
        && item.reference === "visual_capture"));
    }
  });

  it("binds only an exact round-trip policy while observable evidence remains invocation-only", () => {
    const productSpec = withMemoryPersistence(genuineNodeExpressApiProductSpecV2());
    const { result } = compiledFor(productSpec, "node-express-api");
    const observable = result.bindingSet.bindings.find((binding) =>
      binding.evidenceKind === "observable_outcome");
    assert.ok(observable);
    assert.deepEqual(observable.capabilities.map((capability) => capability.capabilityKind), ["network"]);
    const persistence = result.bindingSet.bindings.find((binding) =>
      binding.evidenceKind === "persistence_round_trip");
    assert.ok(persistence);
    assert.equal(persistence.subjectRef, "PERSIST_TASKS_MEMORY");
    assert.deepEqual(persistence.capabilities.map((capability) => capability.capabilityKind), [
      "network",
      "runtime_state",
    ]);
    assert.equal(
      persistence.capabilities.find((capability) => capability.capabilityKind === "runtime_state")
        ?.reasons[0]?.kind,
      "persistence",
    );
  });

  it("rejects state, action, and entity round-trip subjects plus zero or multiple action owners", () => {
    const valid = withMemoryPersistence(genuineNodeExpressApiProductSpecV2());
    const predicateIndex = valid.evidencePredicates.findIndex((predicate) =>
      predicate.kind === "persistence_round_trip");
    assert.ok(predicateIndex >= 0);

    for (const subjectRef of [valid.states[0]!.id, valid.actions[0]!.id]) {
      const candidate: any = clone(valid);
      candidate.evidencePredicates[predicateIndex].subjectRef = subjectRef;
      assert.ok(schemaMessages(candidate).some((message) =>
        message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_SUBJECT_INVALID")));
    }

    const entitySubject: any = clone(valid);
    entitySubject.entities.push({
      id: "ENTITY_AUDIT_TASK",
      name: "Audit Task",
      fields: [{
        id: "FIELD_AUDIT_TASK_TITLE",
        name: "title",
        valueType: "string",
        required: true,
      }],
    });
    entitySubject.traceability.bindings.push({
      semanticKind: "entity",
      semanticRef: "ENTITY_AUDIT_TASK",
      requirementRefs: entitySubject.traceability.bindings[0].requirementRefs,
    });
    entitySubject.evidencePredicates[predicateIndex].subjectRef = "ENTITY_AUDIT_TASK";
    assert.ok(schemaMessages(entitySubject).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_SUBJECT_INVALID")));

    const zeroOwner: any = clone(valid);
    const evidenceRef = zeroOwner.evidencePredicates[predicateIndex].id;
    zeroOwner.actions[0].evidenceRefs = zeroOwner.actions[0].evidenceRefs.filter(
      (reference: string) => reference !== evidenceRef,
    );
    zeroOwner.actions[0].success.evidenceRefs = zeroOwner.actions[0].success.evidenceRefs.filter(
      (reference: string) => reference !== evidenceRef,
    );
    assert.ok(schemaMessages(zeroOwner).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_OWNER_CARDINALITY")
      && message.includes("observed 0")));

    const multiOwner = withSecondApiActionOwning(valid, evidenceRef);
    assert.ok(schemaMessages(multiOwner).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_OWNER_CARDINALITY")
      && message.includes("observed 2")));
  });

  it("rejects an exact policy subject when its sole owner has no effect for that policy", () => {
    const candidate: any = clone(withMemoryPersistence(genuineNodeExpressApiProductSpecV2()));
    const predicate = candidate.evidencePredicates.find((item: any) =>
      item.kind === "persistence_round_trip");
    const oldEvidenceRef = predicate.id;
    const policyRef = "PERSIST_UNOWNED_MEMORY";
    const evidenceRef = derivePersistenceRoundTripEvidenceIdV2(candidate.actions[0].id, policyRef);
    candidate.persistencePolicies.push({
      id: policyRef,
      kind: "memory",
      owner: "server",
      entityRefs: [],
      durability: "session",
      rehydration: { kind: "none" },
    });
    predicate.id = evidenceRef;
    predicate.subjectRef = policyRef;
    candidate.actions[0].evidenceRefs = candidate.actions[0].evidenceRefs.map((reference: string) =>
      reference === oldEvidenceRef ? evidenceRef : reference);
    candidate.actions[0].success.evidenceRefs = candidate.actions[0].success.evidenceRefs.map(
      (reference: string) => reference === oldEvidenceRef ? evidenceRef : reference,
    );
    candidate.traceability.bindings.find((binding: any) =>
      binding.semanticKind === "evidence" && binding.semanticRef === oldEvidenceRef).semanticRef = evidenceRef;
    candidate.traceability.bindings.push({
      semanticKind: "persistence",
      semanticRef: policyRef,
      requirementRefs: candidate.traceability.bindings[0].requirementRefs,
    });
    assert.ok(schemaMessages(candidate).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_EFFECT_MISSING")));
  });

  it("requires the exact round trip on success and forbids claiming it on failure", () => {
    const valid = withMemoryPersistence(genuineNodeExpressApiProductSpecV2());
    const evidenceRef = valid.evidencePredicates.find((predicate) =>
      predicate.kind === "persistence_round_trip")!.id;
    const missingSuccess: any = clone(valid);
    missingSuccess.actions[0].success.evidenceRefs = missingSuccess.actions[0].success.evidenceRefs.filter(
      (reference: string) => reference !== evidenceRef,
    );
    assert.ok(schemaMessages(missingSuccess).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_OUTCOME_CLOSURE")));

    const claimedFailure: any = clone(valid);
    claimedFailure.actions[0].failure.evidenceRefs.push(evidenceRef);
    assert.ok(schemaMessages(claimedFailure).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_OUTCOME_CLOSURE")));
  });

  it("rejects a round-trip policy omitted from success persistence refs", () => {
    const valid = withMemoryPersistence(genuineNodeExpressApiProductSpecV2());
    const policyRef = valid.evidencePredicates.find((predicate) =>
      predicate.kind === "persistence_round_trip")!.subjectRef;
    const missingSuccess: any = clone(valid);
    missingSuccess.actions[0].success.persistenceRefs = missingSuccess.actions[0]
      .success.persistenceRefs.filter((reference: string) => reference !== policyRef);
    assert.ok(schemaMessages(missingSuccess).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_PERSISTENCE_OUTCOME_CLOSURE")));
  });

  it("rejects a round-trip policy claimed by failure persistence refs", () => {
    const valid = withMemoryPersistence(genuineNodeExpressApiProductSpecV2());
    const policyRef = valid.evidencePredicates.find((predicate) =>
      predicate.kind === "persistence_round_trip")!.subjectRef;
    const claimedFailure: any = clone(valid);
    claimedFailure.actions[0].failure.persistenceRefs.push(policyRef);
    assert.ok(schemaMessages(claimedFailure).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_PERSISTENCE_OUTCOME_CLOSURE")));
  });

  it("rejects a forged round-trip ID even when owner, policy, effect, and outcomes agree", () => {
    const candidate: any = clone(withMemoryPersistence(genuineNodeExpressApiProductSpecV2()));
    const predicate = candidate.evidencePredicates.find((item: any) =>
      item.kind === "persistence_round_trip");
    const originalRef = predicate.id;
    const forgedRef = "EVID_PERSISTENCE_ROUND_TRIP_FORGED";
    predicate.id = forgedRef;
    candidate.actions[0].evidenceRefs = candidate.actions[0].evidenceRefs.map((reference: string) =>
      reference === originalRef ? forgedRef : reference);
    candidate.actions[0].success.evidenceRefs = candidate.actions[0].success.evidenceRefs.map(
      (reference: string) => reference === originalRef ? forgedRef : reference,
    );
    candidate.traceability.bindings.find((binding: any) =>
      binding.semanticKind === "evidence" && binding.semanticRef === originalRef).semanticRef = forgedRef;
    assert.ok(schemaMessages(candidate).some((message) =>
      message.includes("PRODUCT_SPEC_PERSISTENCE_ROUND_TRIP_ID_MISMATCH")));
  });

  it("keeps two policies on one action as two exact, single-policy reasons", () => {
    const productSpec = withTwoMemoryPersistences(genuineNodeExpressApiProductSpecV2());
    const { result } = compiledFor(productSpec, "node-express-api");
    const roundTrips = result.bindingSet.bindings.filter((binding) =>
      binding.evidenceKind === "persistence_round_trip");
    assert.equal(roundTrips.length, 2);
    for (const binding of roundTrips) {
      assert.equal(binding.subjectAction.kind, "action");
      const runtimeState = binding.capabilities.find((capability) =>
        capability.capabilityKind === "runtime_state");
      assert.ok(runtimeState);
      assert.deepEqual(runtimeState.reasons, [{
        kind: "persistence",
        ruleRef: "PERSISTENCE_MEMORY_V2",
        persistenceRef: binding.subjectRef,
        persistenceKind: "memory",
      }]);
    }
    assert.equal(new Set(roundTrips.map((binding) => binding.subjectRef)).size, 2);
  });

  it("handles many policies and observables without Cartesian persistence amplification", () => {
    const count = 120;
    const productSpec = withManyExactPoliciesAndObservables(
      genuineNodeExpressApiProductSpecV2(),
      count,
    );
    assert.ok(Buffer.byteLength(canonicalJsonStringify(productSpec), "utf8") < 1024 * 1024);
    const { result } = compiledFor(productSpec, "node-express-api");
    const roundTrips = result.bindingSet.bindings.filter((binding) =>
      binding.evidenceKind === "persistence_round_trip");
    const observables = result.bindingSet.bindings.filter((binding) =>
      binding.evidenceKind === "observable_outcome");
    assert.equal(roundTrips.length, count);
    assert.equal(observables.length, count + 1);
    assert.equal(roundTrips.reduce((total, binding) => total + binding.capabilities.reduce(
      (subtotal, capability) => subtotal + capability.reasons.filter((reason) =>
        reason.kind === "persistence").length,
      0,
    ), 0), count);
    assert.equal(observables.some((binding) => binding.capabilities.some((capability) =>
      capability.reasons.some((reason) => reason.kind === "persistence"))), false);
  });

  it("keeps near-boundary irrelevant action evidence refs out of binding authority", () => {
    const base = withBuildEvidence(genuineNodeCliProductSpecV2(), 1_999);
    const irrelevantOwned = withBuildEvidence(genuineNodeCliProductSpecV2(), 1_999, 498);
    const historicalAggregateEdgeCount = irrelevantOwned.actions.length
      + irrelevantOwned.evidencePredicates.length
      + irrelevantOwned.persistencePolicies.length
      + irrelevantOwned.actions.reduce((total, action) => total
        + action.evidenceRefs.length
        + action.observableEffects.length
        + action.persistenceEffects.length, 0);
    assert.ok(historicalAggregateEdgeCount > 2_500);
    assert.equal(base.evidencePredicates.length, 2_001);
    assert.ok(Buffer.byteLength(canonicalJsonStringify(irrelevantOwned), "utf8") < 1024 * 1024);
    const baseCompiled = compiledFor(base, "node-cli").result;
    const irrelevantCompiled = compiledFor(irrelevantOwned, "node-cli").result;
    assert.deepEqual(irrelevantCompiled.bindingSet.bindings, baseCompiled.bindingSet.bindings);
  });

  it("fresh-verifies exact output and rejects missing, reordered, or self-consistently rehashed forgery", () => {
    const productSpec = genuineNodeCliProductSpecV2();
    const { result, deliverySelection } = compiledFor(productSpec, "node-cli");
    const verified = verifyProductEvidenceCapabilityBindingsV2({
      productSpec,
      deliverySelection,
      candidateBindingSet: result.bindingSet,
    });
    assert.equal(verified.status, "verified");
    if (verified.status === "verified") {
      assert.equal(verified.bindingSetHash, result.bindingSetHash);
      assert.notEqual(verified.bindingSet, result.bindingSet);
      assert.deepEqual(verified.bindingSet, result.bindingSet);
      assert.ok(Object.isFrozen(verified.bindingSet));
    }

    const forged: any = clone(result.bindingSet);
    forged.bindings[0].capabilities[0].capabilityRef = "CAP_TEST_RUNNER";
    rehashBindingSet(forged);
    assert.deepEqual(ProductEvidenceCapabilityBindingSetV2Schema.parse(forged), forged);
    const forgedVerification = verifyProductEvidenceCapabilityBindingsV2({
      productSpec,
      deliverySelection,
      candidateBindingSet: forged,
    });
    assert.equal(forgedVerification.status, "rejected");
    if (forgedVerification.status === "rejected") {
      assert.deepEqual(forgedVerification.diagnostics.map((item) => item.code), [
        "PRODUCT_EVIDENCE_CAPABILITY_V2_CANDIDATE_MISMATCH",
      ]);
    }

    const missing: any = clone(result.bindingSet);
    missing.bindings.splice(0, 1);
    rehashBindingSet(missing);
    const missingVerification = verifyProductEvidenceCapabilityBindingsV2({
      productSpec,
      deliverySelection,
      candidateBindingSet: missing,
    });
    assert.equal(missingVerification.status, "rejected");

    const reordered: any = clone(result.bindingSet);
    reordered.bindings.reverse();
    const reorderedVerification = verifyProductEvidenceCapabilityBindingsV2({
      productSpec,
      deliverySelection,
      candidateBindingSet: reordered,
    });
    assert.equal(reorderedVerification.status, "rejected");
  });

  it("rejects a valid but wrong ProfileV2 selection instead of trusting its embedded hashes", () => {
    const cliProduct = genuineNodeCliProductSpecV2();
    const apiProduct = genuineNodeExpressApiProductSpecV2();
    const apiSelection = selectionFor(apiProduct, "node-express-api");
    const result = compileProductEvidenceCapabilityBindingsV2({
      productSpec: cliProduct,
      deliverySelection: apiSelection,
    });

    assert.equal(result.status, "rejected");
    if (result.status === "rejected") {
      assert.deepEqual(result.diagnostics.map((item) => item.code), [
        "PRODUCT_EVIDENCE_CAPABILITY_V2_SELECTION_INVALID",
      ]);
    }
  });

  it("fails closed on proxy, accessor, cycle, sparse, and oversize input without invoking traps", () => {
    let trapCalls = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        trapCalls += 1;
        throw new Error("must not run");
      },
    });
    const proxyResult = compileProductEvidenceCapabilityBindingsV2(proxy);
    assert.equal(proxyResult.status, "rejected");
    assert.equal(trapCalls, 0);

    let getterCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "productSpec", {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error("must not run");
      },
    });
    const accessorResult = compileProductEvidenceCapabilityBindingsV2(accessor);
    assert.equal(accessorResult.status, "rejected");
    assert.equal(getterCalls, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(compileProductEvidenceCapabilityBindingsV2(cycle).status, "rejected");

    const productSpec: any = clone(genuineNodeCliProductSpecV2());
    productSpec.actions = new Array(2);
    productSpec.actions[0] = genuineNodeCliProductSpecV2().actions[0];
    const sparseResult = compileProductEvidenceCapabilityBindingsV2({
      productSpec,
      deliverySelection: selectionFor(genuineNodeCliProductSpecV2(), "node-cli"),
    });
    assert.equal(sparseResult.status, "rejected");

    const oversizeResult = compileProductEvidenceCapabilityBindingsV2({
      productSpec: genuineNodeCliProductSpecV2(),
      deliverySelection: selectionFor(genuineNodeCliProductSpecV2(), "node-cli"),
      padding: "x".repeat(4 * 1024 * 1024),
    });
    assert.equal(oversizeResult.status, "rejected");
  });

  it("caps canonically ordered diagnostics at 200 with an overflow sentinel", () => {
    const productSpec = withVisualEvidence(genuineNodeCliProductSpecV2(), 220);
    const selection = selectionFor(productSpec, "node-cli");
    const result = compileProductEvidenceCapabilityBindingsV2({
      productSpec,
      deliverySelection: selection,
    });

    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.equal(result.diagnostics.length, 200);
    assert.equal(
      result.diagnostics.filter((item) =>
        item.code === "PRODUCT_EVIDENCE_CAPABILITY_V2_DIAGNOSTICS_TRUNCATED").length,
      1,
    );
    const identities = result.diagnostics.map((item) =>
      `${item.path}\0${item.code}\0${item.reference ?? ""}\0${item.message}`);
    assert.deepEqual(identities, [...identities].sort());
  });
});
