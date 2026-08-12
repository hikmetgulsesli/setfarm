import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { produceDesignGenerationTargetsV2 } from "../../src/product-compiler/producers/design-targets-v2.js";
import { compilePlanSemanticProposalV2 } from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  produceDesignGenerationTargetsV3,
  verifyDesignGenerationTargetsV3,
} from "../../src/product-compiler/producers/design-targets-v3.js";
import {
  hashActionInputTransportV2,
  type ActionInputTransportV2,
} from "../../src/product-compiler/schemas/action-input-transport-v2.js";
import {
  DesignGenerationTargetsV3Schema,
  hashDesignGenerationTargetV3,
  hashDesignGenerationTargetsV3,
  hashRequiredActionInputTransportsV3,
  requiredEvidenceRefsForActionsV3,
  type DesignGenerationTargetsV3,
} from "../../src/product-compiler/schemas/design-generation-targets-v3.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  CONTAINED_GAME_TASK,
  buildContainedGameProductSpecV2,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "./fixtures/product-build-packet-v3.js";

type ProductValueType = ProductSpecV2["actions"][number]["input"]["fields"][number]["valueType"];

const ACTION_REF = "ACT_START_GAME";
const ENTITY_REF = "ENTITY_ACTION_INPUT";
const ENUM_FIELD_REF = "FIELD_ACTION_INPUT_MODE";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function attachEntityTraceability(productSpec: ProductSpecV2): void {
  productSpec.traceability.bindings.push({
    semanticKind: "entity",
    semanticRef: ENTITY_REF,
    requirementRefs: productSpec.requirements.map((requirement) => requirement.id),
  });
}

function supportedInputProductSpec(): ProductSpecV2 {
  const productSpec = clone(buildContainedGameProductSpecV2());
  const action = productSpec.actions.find((candidate) => candidate.id === ACTION_REF)!;
  action.input.fields = [
    { name: "stringValue", valueType: "string", required: true },
    { name: "objectValue", valueType: "object", required: true },
    { name: "numberValue", valueType: "number", required: true },
    {
      name: "enumValue",
      valueType: "enum",
      required: true,
      entityFieldRef: ENUM_FIELD_REF,
    },
    { name: "booleanValue", valueType: "boolean", required: true },
    { name: "arrayValue", valueType: "array", required: true },
  ];
  action.evidenceScenario.targetInputValues = {
    stringValue: "hello",
    objectValue: { nested: null, enabled: true },
    numberValue: -12.5e2,
    enumValue: "running",
    booleanValue: false,
    arrayValue: [1, null, { ok: true }],
  };
  action.stateDeltas[0]!.valueFrom = {
    kind: "inputs",
    fields: action.input.fields.map((field) => field.name),
  };
  productSpec.entities.push({
    id: ENTITY_REF,
    name: "Action Input",
    fields: [{
      id: ENUM_FIELD_REF,
      name: "enumValue",
      valueType: "enum",
      required: true,
      enumValues: ["ready", "running"],
    }],
  });
  attachEntityTraceability(productSpec);
  return ProductSpecV2Schema.parse(productSpec);
}

function singleInputProductSpec(
  valueType: ProductValueType,
  evidenceValue: unknown,
  options: Readonly<{
    required?: boolean;
    enumAuthority?: boolean;
  }> = {},
): ProductSpecV2 {
  const productSpec = clone(buildContainedGameProductSpecV2());
  const action = productSpec.actions.find((candidate) => candidate.id === ACTION_REF)!;
  action.input.fields = [{
    name: "payload",
    valueType,
    required: options.required ?? true,
    ...(options.enumAuthority ? { entityFieldRef: ENUM_FIELD_REF } : {}),
  }];
  action.evidenceScenario.targetInputValues = { payload: evidenceValue };
  action.stateDeltas[0]!.valueFrom = { kind: "input", field: "payload" };
  if (options.enumAuthority) {
    productSpec.entities.push({
      id: ENTITY_REF,
      name: "Action Input",
      fields: [{
        id: ENUM_FIELD_REF,
        name: "payload",
        valueType: "enum",
        required: true,
        enumValues: ["ready", "running"],
      }],
    });
    attachEntityTraceability(productSpec);
  }
  return productSpec;
}

function noControlOptionalDateProductSpec(): ProductSpecV2 {
  const productSpec = clone(buildContainedGameProductSpecV2());
  const action = productSpec.actions.find((candidate) => candidate.id === ACTION_REF)!;
  const removedControlSlots = new Set(action.controlPlacements.map((placement) =>
    placement.id));
  action.trigger = { kind: "route", sourceRef: productSpec.routes[0]!.id };
  action.invocationInterface = {
    schema: "setfarm.action-invocation-interface-intent.v1",
    kind: "route_entry",
    routeRef: productSpec.routes[0]!.id,
  };
  action.controlPlacements = [];
  action.input.fields = [{
    name: "scheduledDate",
    valueType: "date",
    required: false,
  }];
  action.evidenceScenario = {
    targetInputValues: { scheduledDate: "2026-07-17" },
    prerequisiteSteps: [],
  };
  action.stateDeltas[0]!.valueFrom = { kind: "input", field: "scheduledDate" };
  action.observableEffects = action.observableEffects.map((observable) => ({
    ...observable,
    selector: observable.selector.kind === "control"
      ? { kind: "surface" as const, surfaceRef: productSpec.surfaces[0]!.id }
      : observable.selector,
  }));
  action.affectedSurfaceRefs = [...new Set(action.observableEffects.map((observable) =>
    observable.selector.kind === "control"
      ? productSpec.surfaces[0]!.id
      : observable.selector.surfaceRef))].sort();
  productSpec.traceability.bindings = productSpec.traceability.bindings.filter((binding) =>
    binding.semanticKind !== "control_placement"
    || !removedControlSlots.has(binding.semanticRef));
  productSpec.requirements = productSpec.requirements.map((requirement) => ({
    ...requirement,
    expectedSemanticKinds: requirement.expectedSemanticKinds.filter((kind) =>
      kind !== "control_placement"),
  }));
  return ProductSpecV2Schema.parse(productSpec);
}

function transitivePrerequisiteProductSpec(options: Readonly<{
  cycle?: boolean;
  duplicateHumanTitles?: boolean;
}> = {}): ProductSpecV2 {
  const proposal = containedGamePlanProposalV2();
  const requirementRefs = proposal.requirements.map((requirement: any) => requirement.id);
  const addPrerequisiteAction = (
    key: string,
    routePath: string,
    prerequisiteActionKey?: string,
  ): void => {
    const surfaceKey = `${key}_page`;
    const humanTitle = options.duplicateHumanTitles ? "Play Page" : `${key} Page`;
    proposal.routes.push({
      key,
      path: routePath,
      entry: false,
      requirementRefs,
    });
    proposal.surfaces.push({
      key: surfaceKey,
      name: humanTitle,
      kind: "page",
      routeKey: key,
      required: true,
      composition: { kind: "route_root" },
      requirementRefs,
    });
    proposal.actions.push({
      key,
      name: `${key} Action`,
      controlPlacements: [{
        key: "primary_action",
        surfaceKey,
        controlHint: "primary_button",
        requirementRefs,
      }],
      affectedSurfaceKeys: [],
      trigger: { kind: "user" },
      invocationInterface: {
        schema: "setfarm.action-invocation-interface-intent.v1",
        kind: "rendered_control",
      },
      inputs: [],
      preconditions: [],
      evidenceScenario: {
        controlPlacementKey: "primary_action",
        targetInputValues: {},
        prerequisiteSteps: prerequisiteActionKey
          ? [{ actionKey: prerequisiteActionKey, inputValues: {} }]
          : [],
      },
      stateDeltas: [{
        key: "set_phase",
        stateKey: "game_phase",
        operation: "set",
        path: "/phase",
        valueFrom: { kind: "literal", value: "ready" },
      }],
      navigation: { kind: "stay" },
      persistenceIntents: [],
      observables: [{
        key: "action_control",
        selector: { kind: "control", controlPlacementKey: "primary_action" },
        assertions: [{
          phase: "after",
          property: "visibility",
          operator: "equals",
          expected: true,
        }],
        requirementRefs,
      }],
      requirementRefs,
    });
  };

  addPrerequisiteAction(
    "initialize_game",
    "/initialize",
  );
  addPrerequisiteAction("prepare_game", "/prepare", "initialize_game");
  proposal.actions.find((action: any) => action.key === "start_game")!
    .evidenceScenario.prerequisiteSteps = [{
      actionKey: "prepare_game",
      inputValues: {},
    }];

  const compiled = compilePlanSemanticProposalV2({
    task: CONTAINED_GAME_TASK,
    proposal,
  });
  assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
  if (compiled.status !== "canonicalized") throw new Error("Expected canonical ProductSpecV2");
  const productSpec = ProductSpecV2Schema.parse(compiled.productSpec);
  if (options.cycle) {
    productSpec.actions.find((action) => action.id === "ACT_INITIALIZE_GAME")!
      .evidenceScenario.prerequisiteSteps = [{
        actionRef: "ACT_START_GAME",
        inputValues: {},
      }];
    return productSpec;
  }
  return ProductSpecV2Schema.parse(productSpec);
}

function produced(productSpec: ProductSpecV2): DesignGenerationTargetsV3 {
  const result = produceDesignGenerationTargetsV3(productSpec);
  assert.equal(result.status, "produced", JSON.stringify(result.diagnostics));
  if (result.status !== "produced") throw new Error(JSON.stringify(result.diagnostics));
  return result.generationTargets;
}

function rejectionMessages(input: unknown): string[] {
  const result = DesignGenerationTargetsV3Schema.safeParse(input);
  assert.equal(result.success, false);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function rehashArtifact(value: DesignGenerationTargetsV3): void {
  for (const target of value.targets) {
    for (const placement of target.requiredControlPlacements) {
      placement.actionInputTransportsHash = hashRequiredActionInputTransportsV3(
        placement.actionInputTransports,
      );
    }
    target.targetHash = hashDesignGenerationTargetV3(target);
  }
  value.targetsHash = hashCanonicalJson(value.targets);
  value.payloadHash = hashDesignGenerationTargetsV3(value);
}

function assertRejectedWithCode(productSpec: ProductSpecV2, expectedCode: string): void {
  const result = produceDesignGenerationTargetsV3(productSpec);
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") throw new Error("Expected V3 producer rejection");
  assert.equal(result.rejectionCodes.includes(expectedCode), true, JSON.stringify(result.diagnostics));
}

describe("DesignGenerationTargetsV3 typed projection", () => {
  it("projects all six supported ProductSpec types into compiler-owned contracts", () => {
    const productSpec = supportedInputProductSpec();
    const artifact = produced(productSpec);
    assert.equal(artifact.schema, "setfarm.design-generation-targets.v3");
    assert.equal(artifact.productSpecHash, hashCanonicalJson(productSpec));
    assert.equal(artifact.targetsHash, hashCanonicalJson(artifact.targets));
    assert.equal(artifact.payloadHash, hashDesignGenerationTargetsV3(artifact));
    assert.equal(artifact.targets.length, 1);

    const target = artifact.targets[0]!;
    assert.equal(target.targetHash, hashDesignGenerationTargetV3(target));
    assert.equal(target.productSpecHash, artifact.productSpecHash);
    assert.deepEqual(target.requiredActionRefs, [ACTION_REF]);
    assert.deepEqual(
      target.requiredActions,
      [productSpec.actions.find((action) => action.id === ACTION_REF)!],
    );
    assert.deepEqual(
      target.requiredEvidencePredicates.map((predicate) => predicate.id),
      [...productSpec.actions.find((action) => action.id === ACTION_REF)!.evidenceRefs].sort(),
    );
    assert.equal(
      target.requiredObservableSelectors.every((observable) =>
        typeof observable.evidenceRef === "string"),
      true,
    );
    assert.deepEqual(target.affectingActionRefs, [ACTION_REF]);
    assert.equal(target.requiredControlPlacements.length, 1);
    const placement = target.requiredControlPlacements[0]!;
    assert.equal(placement.actionRef, ACTION_REF);
    assert.equal("inputFields" in placement, false);
    assert.equal(
      placement.actionInputTransportsHash,
      hashRequiredActionInputTransportsV3(placement.actionInputTransports),
    );
    assert.deepEqual(
      placement.actionInputTransports.map((contract) => contract.fieldRef),
      [
        "arrayValue",
        "booleanValue",
        "enumValue",
        "numberValue",
        "objectValue",
        "stringValue",
      ],
    );
    assert.deepEqual(
      placement.actionInputTransports.map((contract) => [
        contract.valueType,
        contract.codecId,
        contract.domRequirements[0]!.tagName,
        contract.domRequirements[0]!.valueChannel,
      ]),
      [
        ["array", "json-array.v2", "textarea", "value"],
        ["boolean", "boolean-checked.v2", "input", "checked"],
        ["enum", "enum-token.v2", "select", "value"],
        ["number", "json-number.v2", "input", "value"],
        ["object", "json-object.v2", "textarea", "value"],
        ["string", "text.v2", "input", "value"],
      ],
    );
    assert.equal(
      placement.actionInputTransports.every((contract) =>
        contract.actionRef === placement.actionRef
        && contract.contractHash === hashActionInputTransportV2(contract)),
      true,
    );
    const enumContract = placement.actionInputTransports.find((contract) =>
      contract.valueType === "enum")!;
    assert.equal(enumContract.entityFieldRef, ENUM_FIELD_REF);
    assert.deepEqual(enumContract.enumValues, ["ready", "running"]);
  });

  it("preserves exact action evidence and changes target identity when evidence changes", () => {
    const productSpec = supportedInputProductSpec();
    const first = produced(productSpec);
    const target = first.targets[0]!;
    const action = productSpec.actions.find((candidate) => candidate.id === ACTION_REF)!;
    assert.deepEqual(target.requiredActions[0]!.evidenceScenario, action.evidenceScenario);
    assert.deepEqual(
      target.requiredObservableSelectors.map((observable) => observable.evidenceRef),
      action.observableEffects.map((observable) => observable.evidenceRef).sort(),
    );

    const changed = clone(productSpec);
    changed.actions.find((candidate) => candidate.id === ACTION_REF)!
      .evidenceScenario.targetInputValues.stringValue = "changed-evidence";
    const second = produced(changed);
    assert.notEqual(second.productSpecHash, first.productSpecHash);
    assert.notEqual(second.targets[0]!.targetHash, target.targetHash);
  });

  it("separates direct actions from the exact transitive evidence prerequisite closure", () => {
    const artifact = produced(transitivePrerequisiteProductSpec());
    const startTarget = artifact.targets.find((target) =>
      target.directActionRefs.includes("ACT_START_GAME"))!;
    assert.deepEqual(startTarget.directActionRefs, ["ACT_START_GAME"]);
    assert.deepEqual(startTarget.dependencyActionRefs, [
      "ACT_INITIALIZE_GAME",
      "ACT_PREPARE_GAME",
    ]);
    assert.deepEqual(startTarget.requiredActionRefs, [
      "ACT_INITIALIZE_GAME",
      "ACT_PREPARE_GAME",
      "ACT_START_GAME",
    ]);
    assert.deepEqual(
      startTarget.requiredActions.map((action) => action.id),
      startTarget.requiredActionRefs,
    );
    assert.deepEqual(
      startTarget.requiredEvidencePredicates.map((predicate) => predicate.id),
      requiredEvidenceRefsForActionsV3(startTarget.requiredActions),
    );
    assert.deepEqual(
      startTarget.requiredActions.find((action) => action.id === "ACT_PREPARE_GAME")!
        .evidenceScenario.prerequisiteSteps.map((step) => step.actionRef),
      ["ACT_INITIALIZE_GAME"],
    );

    const prepareTarget = artifact.targets.find((target) =>
      target.directActionRefs.includes("ACT_PREPARE_GAME"))!;
    assert.deepEqual(prepareTarget.directActionRefs, ["ACT_PREPARE_GAME"]);
    assert.deepEqual(prepareTarget.dependencyActionRefs, ["ACT_INITIALIZE_GAME"]);
    const initializeTarget = artifact.targets.find((target) =>
      target.directActionRefs.includes("ACT_INITIALIZE_GAME"))!;
    assert.deepEqual(initializeTarget.dependencyActionRefs, []);
  });

  it("keeps duplicate human screen titles while deriving unique route/surface request identities", () => {
    const artifact = produced(transitivePrerequisiteProductSpec({
      duplicateHumanTitles: true,
    }));
    assert.equal(new Set(
      artifact.targets.map((target) => target.expectedScreenTitle),
    ).size, 1);
    assert.equal(new Set(
      artifact.targets.map((target) => target.requestScreenKey),
    ).size, artifact.targets.length);
    assert.equal(artifact.targets.every((target) =>
      target.requestScreenKey
        === `route:${target.routeRef};surface:${target.surfaceRef}`), true);
  });

  it("is deterministic and canonicalizes source field order", () => {
    const productSpec = supportedInputProductSpec();
    const first = produceDesignGenerationTargetsV3(productSpec);
    const second = produceDesignGenerationTargetsV3(clone(productSpec));
    assert.deepEqual(second, first);
    assert.equal(first.status, "produced", JSON.stringify(first.diagnostics));
    if (first.status !== "produced") return;
    const refs = first.generationTargets.targets[0]!.requiredControlPlacements[0]!
      .actionInputTransports.map((contract) => contract.actionInputRef);
    assert.deepEqual(refs, [...refs].sort());
  });

  it("derives bounded deterministic target identities from maximum-length surface refs", () => {
    const source = supportedInputProductSpec();
    const rootSurface = source.surfaces.find((surface) =>
      surface.composition.kind === "route_root")!;
    const maximumSurfaceRef = `SURF_${"A".repeat(155)}`;
    const productSpec = ProductSpecV2Schema.parse(JSON.parse(
      JSON.stringify(source).replaceAll(rootSurface.id, maximumSurfaceRef),
    ));

    const first = produced(productSpec);
    const second = produced(productSpec);
    assert.deepEqual(second, first);
    assert.equal(first.targets[0]!.targetId.length <= 160, true);
    assert.equal(first.targets[0]!.designSurfaceId.length <= 160, true);
    assert.match(first.targets[0]!.targetId, /^TARGET_HASH_[A-F0-9]{64}$/);
    assert.match(first.targets[0]!.designSurfaceId, /^DSURF_HASH_[A-F0-9]{64}$/);
  });

  it("preserves no-input user actions as an exact empty transport set", () => {
    const productSpec = buildContainedGameProductSpecV2();
    const artifact = produced(productSpec);
    const target = artifact.targets[0]!;
    const placement = target.requiredControlPlacements[0]!;
    assert.deepEqual(target.requiredActionRefs, [ACTION_REF]);
    assert.deepEqual(placement.actionInputTransports, []);
    assert.equal(placement.actionInputTransportsHash, hashCanonicalJson([]));
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(artifact).success, true);
  });

  it("preserves V2 route, surface, control, affecting-action, and observable authority", () => {
    const productSpec = supportedInputProductSpec();
    const v2 = produceDesignGenerationTargetsV2(productSpec);
    const v3 = produceDesignGenerationTargetsV3(productSpec);
    assert.equal(v2.status, "produced", JSON.stringify(v2.diagnostics));
    assert.equal(v3.status, "produced", JSON.stringify(v3.diagnostics));
    if (v2.status !== "produced" || v3.status !== "produced") return;
    const v2Target = v2.generationTargets.targets[0]!;
    const v3Target = v3.generationTargets.targets[0]!;
    assert.deepEqual(
      {
        targetId: v3Target.targetId,
        designSurfaceId: v3Target.designSurfaceId,
        routeRef: v3Target.routeRef,
        surfaceRef: v3Target.surfaceRef,
        containedSurfaceRefs: v3Target.containedSurfaceRefs,
        expectedScreenTitle: v3Target.expectedScreenTitle,
        affectingActionRefs: v3Target.affectingActionRefs,
        requiredObservableSelectors: v3Target.requiredObservableSelectors.map(({
          evidenceRef: _evidenceRef,
          ...observable
        }) => observable),
        controls: v3Target.requiredControlPlacements.map((placement) => ({
          controlSlotRef: placement.controlSlotRef,
          actionRef: placement.actionRef,
          surfaceRef: placement.surfaceRef,
          controlHint: placement.controlHint,
          inputFields: placement.actionInputTransports.map((contract) => contract.fieldRef),
        })),
      },
      {
        targetId: v2Target.targetId,
        designSurfaceId: v2Target.designSurfaceId,
        routeRef: v2Target.routeRef,
        surfaceRef: v2Target.surfaceRef,
        containedSurfaceRefs: v2Target.containedSurfaceRefs,
        expectedScreenTitle: v2Target.expectedScreenTitle,
        affectingActionRefs: v2Target.affectingActionRefs,
        requiredObservableSelectors: v2Target.requiredObservableSelectors,
        controls: v2Target.requiredControlPlacements.map((placement) => ({
          controlSlotRef: placement.controlSlotRef,
          actionRef: placement.actionRef,
          surfaceRef: placement.surfaceRef,
          controlHint: placement.controlHint,
          inputFields: placement.inputFields,
        })),
      },
    );
    assert.equal(
      v3Target.requestScreenKey,
      `route:${v3Target.routeRef};surface:${v3Target.surfaceRef}`,
    );
  });
});

describe("DesignGenerationTargetsV3 fail-closed publication", () => {
  it("rejects no-design delivery instead of manufacturing Stitch targets", () => {
    const productSpec = buildNoDesignProductBuildPacketV3Contracts().productSpecV2;
    assertRejectedWithCode(
      productSpec,
      "DESIGN_TARGET_V3_DESIGN_NOT_REQUIRED",
    );
  });

  it("rejects transitive evidence prerequisite cycles with a typed diagnostic", () => {
    const parsed = ProductSpecV2Schema.safeParse(
      transitivePrerequisiteProductSpec({ cycle: true }),
    );
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      assert.equal(parsed.error.issues.some((issue) =>
        issue.message.includes("PRODUCT_SPEC_V2_PREREQUISITE_CYCLE")), true);
    }
  });

  it("rejects unsupported rendered-control transport semantics at ProductSpec authority", () => {
    for (const [candidate, diagnostic] of [
      [
        singleInputProductSpec("string", "hello", { required: false }),
        "INVOCATION_INTERFACE_RENDERED_OPTIONAL_INPUT_UNSUPPORTED",
      ],
      [
        singleInputProductSpec("date", "2026-07-17"),
        "INVOCATION_INTERFACE_RENDERED_TEMPORAL_INPUT_UNSUPPORTED",
      ],
      [
        singleInputProductSpec("datetime", "2026-07-17T12:00:00Z"),
        "INVOCATION_INTERFACE_RENDERED_TEMPORAL_INPUT_UNSUPPORTED",
      ],
      [
        singleInputProductSpec("enum", "ready"),
        "PRODUCT_SPEC_V2_ENUM_INPUT_AUTHORITY_MISSING",
      ],
    ] as const) {
      const parsed = ProductSpecV2Schema.safeParse(candidate);
      assert.equal(parsed.success, false);
      if (!parsed.success) {
        assert.equal(parsed.error.issues.some((issue) =>
          issue.message.includes(diagnostic)), true, JSON.stringify(parsed.error.issues));
      }
    }
  });

  it("rejects unbound route-entry inputs instead of laundering them into DOM transport", () => {
    assert.throws(
      () => noControlOptionalDateProductSpec(),
      /INVOCATION_INTERFACE_UNBOUND_INPUTS/,
    );
  });

  it("rejects invalid ProductSpec evidence without path-fragment reclassification", () => {
    const invalidEvidence = singleInputProductSpec("number", "not-a-number");
    const result = produceDesignGenerationTargetsV3(invalidEvidence);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected invalid evidence rejection");
    assert.equal(
      result.rejectionCodes.includes("DESIGN_TARGET_V3_PRODUCT_SPEC_INVALID"),
      true,
      JSON.stringify(result.diagnostics),
    );
    assert.equal(
      result.rejectionCodes.includes("ACTION_INPUT_V2_EVIDENCE_VALUE_INVALID"),
      false,
    );
    assert.equal("generationTargets" in result, false);
  });

  it("rejects ProductSpec envelopes that try to supply caller-authored transports", () => {
    const callerAuthored: any = clone(supportedInputProductSpec());
    callerAuthored.actionInputTransports = [{ schema: "caller-authored" }];
    const result = produceDesignGenerationTargetsV3(callerAuthored);
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected strict ProductSpec rejection");
    assert.deepEqual(result.rejectionCodes, ["DESIGN_TARGET_V3_PRODUCT_SPEC_INVALID"]);
  });

  it("rejects V2-shaped and lossy inputFields payloads", () => {
    const productSpec = supportedInputProductSpec();
    const v2 = produceDesignGenerationTargetsV2(productSpec);
    assert.equal(v2.status, "produced", JSON.stringify(v2.diagnostics));
    if (v2.status !== "produced") return;
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(v2.generationTargets).success, false);

    const lossy: any = clone(produced(productSpec));
    lossy.targets[0].requiredControlPlacements[0].inputFields = ["stringValue"];
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(lossy).success, false);
  });
});

describe("DesignGenerationTargetsV3 closure and hash integrity", () => {
  it("rejects fully rehashed prerequisite closure tampering", () => {
    const productSpec = transitivePrerequisiteProductSpec();
    const artifact = produced(productSpec);
    const malformed = clone(artifact);
    const malformedStart = malformed.targets.find((target) =>
      target.directActionRefs.includes("ACT_START_GAME"))!;
    malformedStart.dependencyActionRefs = [];
    rehashArtifact(malformed);
    assert.equal(rejectionMessages(malformed).some((message) =>
      message.includes("DESIGN_TARGET_V3_DEPENDENCY_ACTION_CLOSURE_MISMATCH")), true);

    const forged = clone(artifact);
    const startTarget = forged.targets.find((target) =>
      target.directActionRefs.includes("ACT_START_GAME"))!;
    const startAction = startTarget.requiredActions.find((action) =>
      action.id === "ACT_START_GAME")!;
    startAction.evidenceScenario.prerequisiteSteps = [];
    startTarget.dependencyActionRefs = [];
    startTarget.requiredActionRefs = ["ACT_START_GAME"];
    startTarget.requiredActions = [startAction];
    const directEvidenceRefs = new Set(requiredEvidenceRefsForActionsV3([startAction]));
    startTarget.requiredEvidencePredicates = startTarget.requiredEvidencePredicates
      .filter((predicate) => directEvidenceRefs.has(predicate.id));
    rehashArtifact(forged);
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(forged).success, true);

    const rejected = verifyDesignGenerationTargetsV3({
      productSpec,
      generationTargets: forged,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status !== "rejected") throw new Error("Expected authority mismatch");
    assert.equal(
      rejected.rejectionCodes.includes("DESIGN_TARGET_V3_AUTHORITY_MISMATCH"),
      true,
      JSON.stringify(rejected.diagnostics),
    );
  });

  it("verifies exact reproduction and rejects a fully rehashed ProductSpec forgery", () => {
    const productSpec = supportedInputProductSpec();
    const artifact = produced(productSpec);
    const verified = verifyDesignGenerationTargetsV3({ productSpec, generationTargets: artifact });
    assert.equal(verified.status, "verified", JSON.stringify(verified.diagnostics));

    const forged = clone(artifact);
    const target = forged.targets[0]!;
    const placement = target.requiredControlPlacements[0]!;
    const forgedHint = placement.controlHint === "primary_button"
      ? "secondary_button" as const
      : "primary_button" as const;
    placement.controlHint = forgedHint;
    target.requiredActions.find((action) => action.id === placement.actionRef)!
      .controlPlacements.find((candidate) => candidate.id === placement.controlSlotRef)!
      .controlHint = forgedHint;
    rehashArtifact(forged);
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(forged).success, true);
    assert.equal(forged.productSpecHash, artifact.productSpecHash);

    const rejected = verifyDesignGenerationTargetsV3({
      productSpec,
      generationTargets: forged,
    });
    assert.equal(rejected.status, "rejected");
    if (rejected.status !== "rejected") throw new Error("Expected authority mismatch");
    assert.equal(
      rejected.rejectionCodes.includes("DESIGN_TARGET_V3_AUTHORITY_MISMATCH"),
      true,
      JSON.stringify(rejected.diagnostics),
    );
  });

  it("rejects direct contract tampering and child-only rehashing", () => {
    const artifact = produced(supportedInputProductSpec());
    const directTamper: any = clone(artifact);
    directTamper.targets[0].requiredControlPlacements[0]
      .actionInputTransports[0].codecId = "text.v2";
    assert.equal(DesignGenerationTargetsV3Schema.safeParse(directTamper).success, false);

    const childRehash = clone(artifact);
    const placement = childRehash.targets[0]!.requiredControlPlacements[0]!;
    const enumContract = placement.actionInputTransports.find((contract) =>
      contract.valueType === "enum")!;
    enumContract.enumValues = ["running", "ready"];
    enumContract.contractHash = hashActionInputTransportV2(enumContract);
    placement.actionInputTransportsHash = hashRequiredActionInputTransportsV3(
      placement.actionInputTransports,
    );
    childRehash.targets[0]!.targetHash = hashDesignGenerationTargetV3(
      childRehash.targets[0]!,
    );
    const messages = rejectionMessages(childRehash);
    assert.equal(messages.some((message) =>
      message.includes("DESIGN_TARGET_V3_TARGETS_HASH_MISMATCH")), true);
    assert.equal(messages.some((message) =>
      message.includes("DESIGN_TARGET_V3_PAYLOAD_HASH_MISMATCH")), true);
  });

  it("rejects fully rehashed action, control, and input closure drift", () => {
    const missingAction = clone(produced(supportedInputProductSpec()));
    missingAction.targets[0]!.requiredActionRefs = [];
    rehashArtifact(missingAction);
    assert.equal(rejectionMessages(missingAction).some((message) =>
      message.includes("DESIGN_TARGET_V3_REQUIRED_ACTION_UNION_MISMATCH")), true);

    const duplicateInput = clone(produced(supportedInputProductSpec()));
    const placement = duplicateInput.targets[0]!.requiredControlPlacements[0]!;
    placement.actionInputTransports.push(clone(placement.actionInputTransports[0]!));
    rehashArtifact(duplicateInput);
    assert.equal(rejectionMessages(duplicateInput).some((message) =>
      message.includes("DESIGN_TARGET_V3_ACTION_INPUT_DUPLICATE")
      || message.includes("DESIGN_TARGET_V3_ACTION_INPUT_ORDER_INVALID")), true);

    const wrongOwner = clone(produced(supportedInputProductSpec()));
    const ownedTransport = wrongOwner.targets[0]!.requiredControlPlacements[0]!
      .actionInputTransports[0]!;
    ownedTransport.actionRef = "ACT_OTHER";
    ownedTransport.actionInputRef = `ACT_OTHER.${ownedTransport.fieldRef}`;
    ownedTransport.contractHash = hashActionInputTransportV2(ownedTransport);
    rehashArtifact(wrongOwner);
    assert.equal(rejectionMessages(wrongOwner).some((message) =>
      message.includes("DESIGN_TARGET_V3_ACTION_INPUT_OWNER_MISMATCH")), true);
  });

  it("rejects canonical ordering and every-target ownership drift after rehash", () => {
    const reordered = clone(produced(supportedInputProductSpec()));
    reordered.targets[0]!.requiredControlPlacements[0]!.actionInputTransports.reverse();
    rehashArtifact(reordered);
    assert.equal(rejectionMessages(reordered).some((message) =>
      message.includes("DESIGN_TARGET_V3_ACTION_INPUT_ORDER_INVALID")), true);

    const duplicateSurface = clone(produced(supportedInputProductSpec()));
    duplicateSurface.targets.push(clone(duplicateSurface.targets[0]!));
    duplicateSurface.targets[1]!.targetId = "TARGET_Z_DUPLICATE";
    duplicateSurface.targets[1]!.designSurfaceId = "DSURF_Z_DUPLICATE";
    duplicateSurface.targets[1]!.routeRef = "ROUTE_Z_DUPLICATE";
    duplicateSurface.targets[1]!.requestScreenKey = "Duplicate";
    duplicateSurface.targets[1]!.expectedScreenTitle = "Duplicate";
    rehashArtifact(duplicateSurface);
    assert.equal(rejectionMessages(duplicateSurface).some((message) =>
      message.includes("DESIGN_TARGET_V3_SURFACE_OWNERSHIP_DUPLICATE")), true);
  });
});
