import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalizePlanActionInvocationInterfaceV1,
  compilePlanSemanticProposalV2,
} from "../../src/product-compiler/producers/plan-semantic-proposal-v2.js";
import {
  HTTP_INVOCATION_ROUTE_COMPARISON_MAX_V1,
  findHttpInvocationRouteCollisionV1,
  invocationValueMatchesTypeV1,
} from "../../src/product-compiler/schemas/action-invocation-interface-intent-v1.js";
import { PlanSemanticProposalV2Schema } from "../../src/product-compiler/schemas/plan-semantic-proposal-v2.js";
import {
  ProductSpecV2Schema,
  deriveActionInvocationEvidenceIdV2,
} from "../../src/product-compiler/schemas/product-spec-v2.js";
import {
  CONTAINED_GAME_TASK,
  buildContainedGameProductSpecV2,
  containedGamePlanProposalV2,
} from "./fixtures/product-semantics-v2.js";
import { buildNoDesignProductBuildPacketV3Contracts } from "./fixtures/product-build-packet-v3.js";

function messages(result: ReturnType<typeof PlanSemanticProposalV2Schema.safeParse>): string[];
function messages(result: ReturnType<typeof ProductSpecV2Schema.safeParse>): string[];
function messages(
  result: ReturnType<typeof PlanSemanticProposalV2Schema.safeParse>
    | ReturnType<typeof ProductSpecV2Schema.safeParse>,
): string[] {
  assert.equal(result.success, false);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function nonRenderedPlan(): any {
  const value = containedGamePlanProposalV2();
  const action = value.actions[0];
  action.controlPlacements = [];
  delete action.evidenceScenario.controlPlacementKey;
  action.observables.forEach((observable: any, index: number) => {
    const expected = `result_${index}`;
    observable.selector = {
      kind: "invocation_output",
      coordinate: "result_value",
      pointer: `/${index}`,
      valueContract: {
        valueType: "string",
        expectedFrom: { kind: "literal", value: expected },
      },
    };
    observable.assertions = [{
      phase: "after",
      property: "value",
      operator: "equals",
      expected,
    }];
  });
  value.requirements = value.requirements.map((requirement: any) => ({
    ...requirement,
    expectedSemanticKinds: requirement.expectedSemanticKinds.filter((kind: string) =>
      kind !== "control_placement"),
  }));
  return value;
}

function cliPlan(): any {
  const value = nonRenderedPlan();
  const action = value.actions[0];
  action.trigger = { kind: "user" };
  action.inputs = [{ name: "phase", valueType: "string", required: true }];
  action.evidenceScenario.targetInputValues = { phase: "playing" };
  action.stateDeltas[0].valueFrom = { kind: "input", field: "phase" };
  action.observables[0].selector.valueContract = {
    valueType: "string",
    expectedFrom: { kind: "input", fieldName: "phase" },
  };
  action.observables[0].assertions[0].expected = "playing";
  action.invocationInterface = {
    schema: "setfarm.action-invocation-interface-intent.v1",
    kind: "cli_command",
    subcommandTokens: ["start"],
    fieldBindings: [{
      fieldName: "phase",
      optionalPresence: "not_applicable",
      channel: { kind: "argv_flag", flag: "--phase", style: "separate" },
    }],
    result: {
      kind: "stdout_json",
      successExitCodes: [0],
      valuePointer: "/result",
      failureCases: [
        {
          kind: "input_validation",
          exitCodes: [2],
          channel: "stderr_json",
          errorCode: "INPUT_VALIDATION_FAILED",
          codePointer: "/error/code",
          messagePointer: "/error/message",
        },
        {
          kind: "action_failure",
          exitCodes: [1],
          channel: "stderr_json",
          errorCode: "ACTION_FAILED",
          codePointer: "/error/code",
          messagePointer: "/error/message",
        },
      ],
    },
  };
  return value;
}

function httpPlan(): any {
  const value = nonRenderedPlan();
  value.routes[0].path = "/play/:phase";
  const action = value.actions[0];
  action.trigger = { kind: "user" };
  action.inputs = [{ name: "phase", valueType: "string", required: true }];
  action.evidenceScenario.targetInputValues = { phase: "playing" };
  action.stateDeltas[0].valueFrom = { kind: "input", field: "phase" };
  action.observables[0].selector.valueContract = {
    valueType: "string",
    expectedFrom: { kind: "input", fieldName: "phase" },
  };
  action.observables[0].assertions[0].expected = "playing";
  action.invocationInterface = {
    schema: "setfarm.action-invocation-interface-intent.v1",
    kind: "http_request",
    method: "POST",
    routeKey: "play",
    fieldBindings: [{
      fieldName: "phase",
      optionalPresence: "not_applicable",
      channel: { kind: "path_parameter", name: "phase" },
    }],
    result: {
      kind: "response_json",
      successStatusCodes: [200],
      valuePointer: "/result",
      failureCases: [
        {
          kind: "input_validation",
          statusCodes: [400],
          channel: "response_json",
          errorCode: "INPUT_VALIDATION_FAILED",
          codePointer: "/error/code",
          messagePointer: "/error/message",
        },
        {
          kind: "action_failure",
          statusCodes: [500],
          channel: "response_json",
          errorCode: "ACTION_FAILED",
          codePointer: "/error/code",
          messagePointer: "/error/message",
        },
      ],
    },
  };
  return value;
}

function productWithSecondNativeCliAction(tokens: string[]): any {
  const product: any = structuredClone(
    buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
  );
  const second = structuredClone(product.actions[0]);
  second.id = "ACT_SECOND_TASK";
  second.name = "Second Task";
  second.invocationInterface.subcommandTokens = tokens;
  second.observableEffects[0].id = "OBS_SECOND_TASK";
  second.observableEffects[0].evidenceRef = "EVID_SECOND_TASK";
  const invocationEvidenceRef = deriveActionInvocationEvidenceIdV2(second.id);
  second.evidenceRefs = ["EVID_SECOND_TASK", invocationEvidenceRef];
  second.success.evidenceRefs = ["EVID_SECOND_TASK", invocationEvidenceRef];
  product.actions.push(second);
  product.evidencePredicates.push(
    {
      id: "EVID_SECOND_TASK",
      kind: "observable_outcome",
      required: true,
      subjectRef: "OBS_SECOND_TASK",
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
    {
      id: invocationEvidenceRef,
      kind: "action_invocation",
      required: true,
      subjectRef: second.id,
      capabilityRefs: [],
      assertion: { operator: "passes" },
    },
  );
  const requirementRefs = product.requirements.map((requirement: any) => requirement.id);
  product.traceability.bindings.push(
    { semanticKind: "action", semanticRef: second.id, requirementRefs },
    { semanticKind: "observable", semanticRef: "OBS_SECOND_TASK", requirementRefs },
    { semanticKind: "evidence", semanticRef: "EVID_SECOND_TASK", requirementRefs },
    { semanticKind: "evidence", semanticRef: invocationEvidenceRef, requirementRefs },
  );
  return product;
}

describe("ActionInvocationInterfaceIntentV1 authority", () => {
  it("compiles rendered-control intent and exactly one generic invocation predicate per action", () => {
    const compiled = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: containedGamePlanProposalV2(),
    });
    assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
    if (compiled.status !== "canonicalized") return;

    const action = compiled.productSpec.actions[0]!;
    assert.deepEqual(action.invocationInterface, {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "rendered_control",
    });
    assert.deepEqual(action.trigger, { kind: "user" });
    const predicates = compiled.productSpec.evidencePredicates.filter((predicate) =>
      predicate.kind === "action_invocation" && predicate.subjectRef === action.id);
    assert.equal(predicates.length, 1);
    assert.equal(action.evidenceRefs.includes(predicates[0]!.id), true);
    assert.equal(action.success.evidenceRefs.includes(predicates[0]!.id), true);
    assert.equal(compiled.productSpec.traceability.bindings.some((binding) =>
      binding.semanticKind === "evidence" && binding.semanticRef === predicates[0]!.id), true);
  });

  it("rejects absent or delivery-incompatible invocation authority instead of inferring it", () => {
    const missing = containedGamePlanProposalV2();
    delete missing.actions[0].invocationInterface;
    assert.equal(PlanSemanticProposalV2Schema.safeParse(missing).success, false);

    const proseRenderedSource = containedGamePlanProposalV2();
    proseRenderedSource.actions[0].trigger.sourceRef = "Start Game";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(proseRenderedSource)).some((message) =>
      message.includes("INVOCATION_INTERFACE_RENDERED_TRIGGER_SOURCE_FORBIDDEN")), true);

    const cli = cliPlan();
    assert.equal(PlanSemanticProposalV2Schema.safeParse(cli).success, true);
    const compiled = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: cli,
    });
    assert.equal(compiled.status, "rejected");
    if (compiled.status === "rejected") {
      assert.equal(compiled.diagnostics.some((diagnostic) =>
        diagnostic.code === "PLAN_SEMANTIC_PROPOSAL_V2_INVOCATION_PROFILE_UNAVAILABLE"), true);
    }

    const cliRouteEntry: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    cliRouteEntry.actions[0].trigger = { kind: "route", sourceRef: "ROUTE_CLI" };
    cliRouteEntry.actions[0].invocationInterface = {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "route_entry",
      routeRef: "ROUTE_CLI",
    };
    assert.equal(messages(ProductSpecV2Schema.safeParse(cliRouteEntry)).some((message) =>
      message.includes("PRODUCT_SPEC_INVOCATION_DELIVERY_MISMATCH: route_entry")), true);
  });

  it("requires every and only logical CLI fields with collision-free presence channels", () => {
    const missing = cliPlan();
    missing.actions[0].invocationInterface.fieldBindings = [];
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(missing)).some((message) =>
      message.includes("INVOCATION_INTERFACE_FIELD_CLOSURE_MISMATCH")), true);

    const duplicate = cliPlan();
    duplicate.actions[0].inputs.push({ name: "mode", valueType: "string", required: true });
    duplicate.actions[0].evidenceScenario.targetInputValues.mode = "fast";
    duplicate.actions[0].stateDeltas.push({
      key: "set_mode",
      stateKey: "game_phase",
      operation: "set",
      path: "/mode",
      valueFrom: { kind: "input", field: "mode" },
    });
    duplicate.actions[0].invocationInterface.fieldBindings.push({
      fieldName: "mode",
      optionalPresence: "not_applicable",
      channel: { kind: "argv_flag", flag: "--phase", style: "equals" },
    });
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(duplicate)).some((message) =>
      message.includes("INVOCATION_INTERFACE_CHANNEL_DUPLICATE")), true);

    const optional = cliPlan();
    optional.actions[0].inputs[0].required = false;
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(optional)).some((message) =>
      message.includes("INVOCATION_INTERFACE_OPTIONAL_INPUT_UNSUPPORTED")), true);

    const optionalProduct: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    optionalProduct.actions[0].input.fields[0].required = false;
    assert.equal(messages(ProductSpecV2Schema.safeParse(optionalProduct)).some((message) =>
      message.includes("INVOCATION_INTERFACE_OPTIONAL_INPUT_UNSUPPORTED")), true);
  });

  it("keeps planner ordering free and ProductSpec ordering canonical with ASCII-stable field names", () => {
    const unordered = cliPlan();
    unordered.actions[0].inputs = [
      { name: "a", valueType: "string", required: true },
      { name: "B", valueType: "string", required: true },
    ];
    unordered.actions[0].evidenceScenario.targetInputValues = { a: "a", B: "B" };
    unordered.actions[0].stateDeltas[0].valueFrom = { kind: "input", field: "a" };
    unordered.actions[0].observables[0].selector.valueContract.expectedFrom = {
      kind: "input",
      fieldName: "a",
    };
    unordered.actions[0].observables[0].assertions[0].expected = "a";
    unordered.actions[0].invocationInterface.fieldBindings = [
      {
        fieldName: "a",
        optionalPresence: "not_applicable",
        channel: { kind: "argv_flag", flag: "--a", style: "separate" },
      },
      {
        fieldName: "B",
        optionalPresence: "not_applicable",
        channel: { kind: "argv_flag", flag: "--b", style: "separate" },
      },
    ];
    unordered.actions[0].invocationInterface.result.successExitCodes = [3, 0];
    unordered.actions[0].invocationInterface.result.failureCases.reverse();
    assert.equal(PlanSemanticProposalV2Schema.safeParse(unordered).success, true);
    const canonical = canonicalizePlanActionInvocationInterfaceV1(
      unordered.actions[0].invocationInterface,
    );
    assert.equal(canonical.kind, "cli_command");
    if (canonical.kind !== "cli_command") throw new Error("unreachable");
    assert.deepEqual(canonical.fieldBindings.map((binding) => binding.fieldName), ["B", "a"]);
    assert.deepEqual(canonical.result.successExitCodes, [0, 3]);
    assert.deepEqual(canonical.result.failureCases.map((failure) => failure.kind), [
      "input_validation",
      "action_failure",
    ]);

    const nonCanonicalProduct: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    nonCanonicalProduct.actions[0].input.fields.push({
      name: "B",
      valueType: "string",
      required: true,
    });
    nonCanonicalProduct.actions[0].evidenceScenario.targetInputValues.B = "B";
    nonCanonicalProduct.actions[0].invocationInterface.fieldBindings.push({
      fieldName: "B",
      optionalPresence: "not_applicable",
      channel: { kind: "argv_flag", flag: "--b", style: "separate" },
    });
    assert.equal(messages(ProductSpecV2Schema.safeParse(nonCanonicalProduct)).some((message) =>
      message.includes("INVOCATION_INTERFACE_FIELD_ORDER_NON_CANONICAL")), true);
  });

  it("closes JSON document construction with object intermediates and non-overlapping pointers", () => {
    const withPointers = (left: string, right: string) => {
      const value = cliPlan();
      value.actions[0].inputs.push({ name: "mode", valueType: "string", required: true });
      value.actions[0].evidenceScenario.targetInputValues.mode = "fast";
      value.actions[0].invocationInterface.fieldBindings = [
        {
          fieldName: "mode",
          optionalPresence: "not_applicable",
          channel: {
            kind: "stdin_json_pointer",
            pointer: right,
            containerPolicy: "object_intermediates",
          },
        },
        {
          fieldName: "phase",
          optionalPresence: "not_applicable",
          channel: {
            kind: "stdin_json_pointer",
            pointer: left,
            containerPolicy: "object_intermediates",
          },
        },
      ];
      return value;
    };

    for (const [left, right] of [
      ["", "/child"],
      ["/payload", "/payload/value"],
      ["/same", "/same"],
    ]) {
      const parsed = PlanSemanticProposalV2Schema.safeParse(withPointers(left, right));
      assert.equal(messages(parsed).some((message) =>
        message.includes("INVOCATION_INTERFACE_JSON_POINTER_OVERLAP")), true, `${left} ${right}`);
    }
    assert.equal(
      PlanSemanticProposalV2Schema.safeParse(withPointers("/a~1b", "/a/b")).success,
      true,
    );
  });

  it("binds typed dynamic outputs and every failure ABI case before implementation", () => {
    assert.equal(PlanSemanticProposalV2Schema.safeParse(cliPlan()).success, true);

    const hardcodedOutput = cliPlan();
    hardcodedOutput.actions[0].observables[0].assertions[0].expected = "hardcoded";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(hardcodedOutput)).some((message) =>
      message.includes("PLAN_SEMANTIC_INVOCATION_OUTPUT_EXPECTED_FROM_INPUT_MISMATCH")), true);

    const missingOutputContract = cliPlan();
    delete missingOutputContract.actions[0].observables[0].selector.valueContract;
    assert.equal(PlanSemanticProposalV2Schema.safeParse(missingOutputContract).success, false);

    const untypedStateSource = cliPlan();
    untypedStateSource.actions[0].observables[0].selector.valueContract.expectedFrom = {
      kind: "state",
      stateKey: "game_phase",
      path: "/phase",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(untypedStateSource).success, false);

    const uninstantiatedEntitySource = cliPlan();
    uninstantiatedEntitySource.actions[0].observables[0].selector.valueContract.expectedFrom = {
      kind: "entity_field",
      entityKey: "task",
      fieldKey: "title",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(uninstantiatedEntitySource).success, false);

    const missingValidationFailure = cliPlan();
    missingValidationFailure.actions[0].invocationInterface.result.failureCases.shift();
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(missingValidationFailure)).some((message) =>
      message.includes("INVOCATION_INTERFACE_FAILURE_CASE_CLOSURE")), true);

    const duplicateFailureCode = cliPlan();
    duplicateFailureCode.actions[0].invocationInterface.result.failureCases[1].exitCodes = [2];
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(duplicateFailureCode)).some((message) =>
      message.includes("INVOCATION_INTERFACE_FAILURE_CODE_DUPLICATE")), true);

    const overlappingErrorShape = cliPlan();
    overlappingErrorShape.actions[0].invocationInterface.result.failureCases[0].messagePointer = "/error";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(overlappingErrorShape)).some((message) =>
      message.includes("INVOCATION_INTERFACE_ERROR_POINTER_OVERLAP")), true);
  });

  it("requires exact enum domains and rejects impossible Gregorian evidence values", () => {
    const missingEnumAuthority = cliPlan();
    missingEnumAuthority.actions[0].inputs[0].valueType = "enum";
    missingEnumAuthority.actions[0].observables[0].selector.valueContract.valueType = "enum";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(missingEnumAuthority)).some((message) =>
      message.includes("PLAN_SEMANTIC_ENUM_INPUT_AUTHORITY_MISSING")), true);

    const enumPlan = cliPlan();
    enumPlan.entities.push({
      key: "phase_option",
      name: "Phase option",
      fields: [{
        key: "value",
        name: "value",
        valueType: "enum",
        required: true,
        enumValues: ["playing", "paused"],
      }],
      requirementRefs: [...enumPlan.actions[0].requirementRefs],
    });
    enumPlan.actions[0].inputs[0] = {
      name: "phase",
      valueType: "enum",
      required: true,
      entityField: { entityKey: "phase_option", fieldKey: "value" },
    };
    enumPlan.actions[0].observables[0].selector.valueContract.valueType = "enum";
    assert.equal(PlanSemanticProposalV2Schema.safeParse(enumPlan).success, true);
    enumPlan.actions[0].evidenceScenario.targetInputValues.phase = "unknown";
    enumPlan.actions[0].observables[0].assertions[0].expected = "unknown";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(enumPlan)).some((message) =>
      message.includes("PLAN_SEMANTIC_EVIDENCE_VALUE_INVALID")), true);

    const productMissingEnumAuthority: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    productMissingEnumAuthority.actions[0].input.fields[0].valueType = "enum";
    productMissingEnumAuthority.actions[0].evidenceScenario.targetInputValues.title = "UNDECLARED";
    productMissingEnumAuthority.actions[0].observableEffects[0].selector.valueContract = {
      valueType: "string",
      expectedFrom: { kind: "literal", value: "Ship Setfarm" },
    };
    assert.equal(messages(ProductSpecV2Schema.safeParse(productMissingEnumAuthority)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_ENUM_INPUT_AUTHORITY_MISSING")), true);

    assert.equal(invocationValueMatchesTypeV1("date", "2024-02-29"), true);
    assert.equal(invocationValueMatchesTypeV1("date", "2026-02-29"), false);
    assert.equal(invocationValueMatchesTypeV1("datetime", "2024-02-29T23:59:59Z"), true);
    for (const impossible of [
      "2026-02-29T00:00:00Z",
      "2026-02-30T00:00:00Z",
      "2026-01-01T24:00:00Z",
      "2026-01-01T00:60:00Z",
      "2026-01-01T00:00:60Z",
      "2026-01-01T00:00:00+24:00",
    ]) {
      assert.equal(invocationValueMatchesTypeV1("datetime", impossible), false, impossible);
    }

    const impossibleProductDate: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    impossibleProductDate.actions[0].input.fields[0].valueType = "date";
    impossibleProductDate.actions[0].evidenceScenario.targetInputValues.title = "2026-99-99";
    impossibleProductDate.actions[0].observableEffects[0].selector.valueContract = {
      valueType: "string",
      expectedFrom: { kind: "literal", value: "Ship Setfarm" },
    };
    assert.equal(messages(ProductSpecV2Schema.safeParse(impossibleProductDate)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_EVIDENCE_VALUE_INVALID")), true);
  });

  it("closes HTTP path parameters and keeps bodies, headers, and credentials fail-closed", () => {
    assert.equal(PlanSemanticProposalV2Schema.safeParse(httpPlan()).success, true);

    const missingPath = httpPlan();
    missingPath.actions[0].invocationInterface.fieldBindings[0].channel = {
      kind: "query_parameter",
      name: "phase",
    };
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(missingPath)).some((message) =>
      message.includes("PLAN_SEMANTIC_HTTP_PATH_PARAMETER_CLOSURE")), true);

    const getBody = httpPlan();
    getBody.routes[0].path = "/play";
    getBody.actions[0].invocationInterface.method = "GET";
    getBody.actions[0].invocationInterface.fieldBindings[0].channel = {
      kind: "json_body_pointer",
      pointer: "/phase",
      containerPolicy: "object_intermediates",
    };
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(getBody)).some((message) =>
      message.includes("INVOCATION_INTERFACE_HTTP_BODY_FORBIDDEN")), true);

    const missingContainerPolicy = httpPlan();
    missingContainerPolicy.routes[0].path = "/play";
    missingContainerPolicy.actions[0].invocationInterface.fieldBindings[0].channel = {
      kind: "json_body_pointer",
      pointer: "/phase",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(missingContainerPolicy).success, false);

    const protectedHeader = httpPlan();
    protectedHeader.routes[0].path = "/play";
    protectedHeader.actions[0].invocationInterface.fieldBindings[0].channel = {
      kind: "header",
      name: "Authorization",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(protectedHeader).success, false);

    const credentialHeader = httpPlan();
    credentialHeader.routes[0].path = "/play";
    credentialHeader.actions[0].invocationInterface.fieldBindings[0].channel = {
      kind: "header",
      name: "X-API-Key",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(credentialHeader).success, false);

    const optionalPath = httpPlan();
    optionalPath.actions[0].inputs[0].required = false;
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(optionalPath)).some((message) =>
      message.includes("INVOCATION_INTERFACE_OPTIONAL_INPUT_UNSUPPORTED")), true);

    const headJson = httpPlan();
    headJson.actions[0].invocationInterface.method = "HEAD";
    assert.equal(PlanSemanticProposalV2Schema.safeParse(headJson).success, false);

    const noContentJson = httpPlan();
    noContentJson.actions[0].invocationInterface.result.successStatusCodes = [204];
    assert.equal(PlanSemanticProposalV2Schema.safeParse(noContentJson).success, false);

    for (const nonPortablePath of ["/play/:phase-id", "/play/:phase.id"]) {
      const nonPortable = httpPlan();
      nonPortable.routes[0].path = nonPortablePath;
      nonPortable.actions[0].invocationInterface.fieldBindings[0].channel = {
        kind: "path_parameter",
        name: nonPortablePath.endsWith("-id") ? "phase-id" : "phase.id",
      };
      assert.equal(PlanSemanticProposalV2Schema.safeParse(nonPortable).success, false);
    }
  });

  it("makes CLI dispatch prefix-free and HTTP route languages non-overlapping", () => {
    assert.equal(ProductSpecV2Schema.safeParse(productWithSecondNativeCliAction(["remove"])).success, true);
    for (const tokens of [["add"], ["add", "nested"]]) {
      const collision = ProductSpecV2Schema.safeParse(productWithSecondNativeCliAction(tokens));
      assert.equal(messages(collision).some((message) =>
        message.includes("PRODUCT_SPEC_V2_CLI_INVOCATION_IDENTITY_COLLISION")), true);
    }

    const planCliCollision = cliPlan();
    const secondCli = structuredClone(planCliCollision.actions[0]);
    secondCli.key = "second_action";
    secondCli.name = "Second action";
    secondCli.invocationInterface.subcommandTokens = ["start", "nested"];
    planCliCollision.actions.push(secondCli);
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(planCliCollision)).some((message) =>
      message.includes("PLAN_SEMANTIC_CLI_INVOCATION_IDENTITY_COLLISION")), true);

    const exactHttpCollision = httpPlan();
    const exactSecond = structuredClone(exactHttpCollision.actions[0]);
    exactSecond.key = "second_action";
    exactSecond.name = "Second action";
    exactHttpCollision.actions.push(exactSecond);
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(exactHttpCollision)).some((message) =>
      message.includes("PLAN_SEMANTIC_HTTP_INVOCATION_IDENTITY_COLLISION")), true);

    for (const overlappingPath of ["/play/new", "/play/:other"]) {
      const overlap = httpPlan();
      overlap.routes.push({
        key: "second_route",
        path: overlappingPath,
        entry: false,
        requirementRefs: [...overlap.routes[0].requirementRefs],
      });
      overlap.surfaces.push({
        key: "second_api",
        name: "Second API",
        kind: "api",
        routeKey: "second_route",
        required: true,
        requirementRefs: [...overlap.surfaces[0].requirementRefs],
        composition: { kind: "route_root" },
      });
      const second = structuredClone(overlap.actions[0]);
      second.key = "second_action";
      second.name = "Second action";
      second.affectedSurfaceKeys = ["second_api"];
      second.invocationInterface.routeKey = "second_route";
      second.invocationInterface.fieldBindings[0].channel = overlappingPath.endsWith(":other")
        ? { kind: "path_parameter", name: "other" }
        : { kind: "query_parameter", name: "phase" };
      overlap.actions.push(second);
      assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(overlap)).some((message) =>
        message.includes("PLAN_SEMANTIC_HTTP_INVOCATION_IDENTITY_COLLISION")), true, overlappingPath);
    }

    const differentMethod = httpPlan();
    const putAction = structuredClone(differentMethod.actions[0]);
    putAction.key = "put_action";
    putAction.name = "Put action";
    putAction.invocationInterface.method = "PUT";
    differentMethod.actions.push(putAction);
    assert.equal(PlanSemanticProposalV2Schema.safeParse(differentMethod).success, true);
  });

  it("bounds HTTP overlap proof before quadratic refinement work can escape authority", () => {
    const candidates = (count: number) => Array.from({ length: count }, (_, index) => ({
      identity: `action_${index.toString().padStart(3, "0")}`,
      method: "POST",
      path: `/route-${index.toString().padStart(3, "0")}`,
    }));
    const nearLimit = findHttpInvocationRouteCollisionV1(candidates(447));
    assert.deepEqual(nearLimit, {
      status: "disjoint",
      comparisons: 99_681,
    });
    const overLimit = findHttpInvocationRouteCollisionV1(candidates(448));
    assert.deepEqual(overLimit, {
      status: "budget_exceeded",
      comparisons: HTTP_INVOCATION_ROUTE_COMPARISON_MAX_V1 + 1,
    });
  });

  it("keeps timer/system events fail-closed until a versioned event-source authority exists", () => {
    const runtime = nonRenderedPlan();
    runtime.actions[0].observables.forEach((observable: any) => {
      observable.selector = { kind: "surface", surfaceKey: "status_panel" };
    });
    runtime.actions[0].trigger = { kind: "system", sourceRef: "runtime.refresh" };
    runtime.actions[0].invocationInterface = {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "runtime_event",
      eventKind: "system",
      eventRef: "runtime.refresh",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(runtime).success, false);
  });

  it("resolves route-entry trigger and interface identities together", () => {
    const routeEntry = nonRenderedPlan();
    routeEntry.actions[0].observables.forEach((observable: any) => {
      observable.selector = { kind: "surface", surfaceKey: "status_panel" };
    });
    routeEntry.actions[0].trigger = { kind: "route", sourceRef: "play" };
    routeEntry.actions[0].invocationInterface = {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "route_entry",
      routeKey: "play",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(routeEntry).success, true);

    const compiled = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal: routeEntry,
    });
    assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
    if (compiled.status !== "canonicalized") return;
    const action = compiled.productSpec.actions[0]!;
    assert.deepEqual(action.trigger, { kind: "route", sourceRef: "ROUTE_PLAY" });
    assert.deepEqual(action.invocationInterface, {
      schema: "setfarm.action-invocation-interface-intent.v1",
      kind: "route_entry",
      routeRef: "ROUTE_PLAY",
    });
  });

  it("rejects missing, duplicate, or detached action_invocation evidence", () => {
    const missing: any = buildContainedGameProductSpecV2();
    const invocation = missing.evidencePredicates.find((predicate: any) =>
      predicate.kind === "action_invocation");
    missing.evidencePredicates = missing.evidencePredicates.filter((predicate: any) =>
      predicate.id !== invocation.id);
    assert.equal(messages(ProductSpecV2Schema.safeParse(missing)).some((message) =>
      message.includes("PRODUCT_SPEC_ACTION_INVOCATION_CARDINALITY")), true);

    const detached: any = buildContainedGameProductSpecV2();
    const detachedInvocation = detached.evidencePredicates.find((predicate: any) =>
      predicate.kind === "action_invocation");
    detached.actions[0].evidenceRefs = detached.actions[0].evidenceRefs.filter((reference: string) =>
      reference !== detachedInvocation.id);
    assert.equal(messages(ProductSpecV2Schema.safeParse(detached)).some((message) =>
      message.includes("PRODUCT_SPEC_ACTION_INVOCATION_EVIDENCE_CLOSURE")), true);
  });

  it("validates native CLI state, scenario, observable, and evidence closure without a fake surface projection", () => {
    const native = buildNoDesignProductBuildPacketV3Contracts().productSpecV2;
    assert.equal(native.actions[0]!.observableEffects[0]!.selector.kind, "invocation_output");
    assert.equal(ProductSpecV2Schema.safeParse(native).success, true);

    const unresolvedState: any = structuredClone(native);
    unresolvedState.actions[0].stateDeltas[0].stateRef = "STATE_MISSING";
    assert.equal(messages(ProductSpecV2Schema.safeParse(unresolvedState)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_REFERENCE_UNRESOLVED")), true);

    const incompleteScenario: any = structuredClone(native);
    incompleteScenario.actions[0].evidenceScenario.targetInputValues = {};
    assert.equal(messages(ProductSpecV2Schema.safeParse(incompleteScenario)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_EVIDENCE_INPUT_CLOSURE")), true);

    const detachedObservable: any = structuredClone(native);
    detachedObservable.actions[0].observableEffects[0].evidenceRef = "EVID_DETACHED";
    assert.equal(messages(ProductSpecV2Schema.safeParse(detachedObservable)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_OBSERVABLE_EVIDENCE_NOT_OWNED")), true);
  });

  it("supports stateless CLI/API query behavior without inventing state deltas", () => {
    const native: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    native.states = [];
    native.actions[0].stateDeltas = [];
    native.actions[0].success.stateRefs = [];
    native.actions[0].failure.stateRefs = [];
    native.traceability.bindings = native.traceability.bindings.filter((binding: any) =>
      binding.semanticKind !== "state");
    native.requirements.forEach((requirement: any) => {
      requirement.expectedSemanticKinds = requirement.expectedSemanticKinds.filter((kind: string) =>
        kind !== "state");
    });
    assert.equal(ProductSpecV2Schema.safeParse(native).success, true);

    const proposal = cliPlan();
    proposal.states = [];
    proposal.actions[0].stateDeltas = [];
    proposal.requirements.forEach((requirement: any) => {
      requirement.expectedSemanticKinds = requirement.expectedSemanticKinds.filter((kind: string) =>
        kind !== "state");
    });
    assert.equal(PlanSemanticProposalV2Schema.safeParse(proposal).success, true);
  });

  it("closes entity-field type, owner, and persistence-policy references exactly", () => {
    const source: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    const requirementRefs = source.requirements.map((requirement: any) => requirement.id);
    source.entities = [
      {
        id: "ENTITY_TASK",
        name: "Task",
        fields: [{
          id: "FIELD_TASK_TITLE",
          name: "title",
          valueType: "string",
          required: true,
        }],
      },
      {
        id: "ENTITY_PROJECT",
        name: "Project",
        fields: [{
          id: "FIELD_PROJECT_CODE",
          name: "code",
          valueType: "string",
          required: true,
        }],
      },
    ];
    source.traceability.bindings.push(
      { semanticKind: "entity", semanticRef: "ENTITY_TASK", requirementRefs },
      { semanticKind: "entity", semanticRef: "ENTITY_PROJECT", requirementRefs },
    );
    source.actions[0].input.fields[0].entityFieldRef = "FIELD_TASK_TITLE";
    assert.equal(ProductSpecV2Schema.safeParse(source).success, true);

    const wrongType: any = structuredClone(source);
    wrongType.actions[0].input.fields[0].valueType = "number";
    wrongType.actions[0].evidenceScenario.targetInputValues.title = 42;
    assert.equal(messages(ProductSpecV2Schema.safeParse(wrongType)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_ACTION_ENTITY_FIELD_TYPE_MISMATCH")), true);

    const wrongOwner: any = structuredClone(source);
    wrongOwner.actions[0].stateDeltas[0].valueFrom = {
      kind: "entity_field",
      entityRef: "ENTITY_PROJECT",
      fieldRef: "FIELD_TASK_TITLE",
    };
    assert.equal(messages(ProductSpecV2Schema.safeParse(wrongOwner)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_ENTITY_FIELD_OWNER_MISMATCH")), true);

    const wrongPolicy: any = structuredClone(source);
    wrongPolicy.persistencePolicies = [{
      id: "PERSIST_TASK",
      kind: "none",
      owner: "application",
      entityRefs: ["ENTITY_TASK"],
      durability: "none",
      rehydration: { kind: "none" },
    }];
    wrongPolicy.traceability.bindings.push({
      semanticKind: "persistence",
      semanticRef: "PERSIST_TASK",
      requirementRefs,
    });
    wrongPolicy.actions[0].persistenceEffects = [{
      policyRef: "PERSIST_TASK",
      operation: "read",
      entityRef: "ENTITY_PROJECT",
      payloadFields: [],
      statePaths: [{ stateRef: "STATE_TASKS", path: "" }],
    }];
    assert.equal(messages(ProductSpecV2Schema.safeParse(wrongPolicy)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_PERSISTENCE_ENTITY_OUTSIDE_POLICY")), true);
  });

  it("binds action_invocation ID, assertion, ownership, and requirement provenance exactly", () => {
    const source: any = buildContainedGameProductSpecV2();
    const predicate = source.evidencePredicates.find((candidate: any) =>
      candidate.kind === "action_invocation");

    const forgedId: any = structuredClone(source);
    const forgedPredicate = forgedId.evidencePredicates.find((candidate: any) =>
      candidate.kind === "action_invocation");
    const originalId = forgedPredicate.id;
    forgedPredicate.id = "EVID_FORGED_INVOCATION";
    forgedId.actions[0].evidenceRefs = forgedId.actions[0].evidenceRefs.map((reference: string) =>
      reference === originalId ? forgedPredicate.id : reference);
    forgedId.actions[0].success.evidenceRefs = forgedId.actions[0].success.evidenceRefs.map((reference: string) =>
      reference === originalId ? forgedPredicate.id : reference);
    forgedId.traceability.bindings.find((binding: any) =>
      binding.semanticKind === "evidence" && binding.semanticRef === originalId).semanticRef = forgedPredicate.id;
    assert.equal(messages(ProductSpecV2Schema.safeParse(forgedId)).some((message) =>
      message.includes("PRODUCT_SPEC_ACTION_INVOCATION_ID_MISMATCH")), true);

    const wrongAssertion: any = structuredClone(source);
    wrongAssertion.evidencePredicates.find((candidate: any) =>
      candidate.id === predicate.id).assertion = { operator: "passes", expected: true };
    assert.equal(messages(ProductSpecV2Schema.safeParse(wrongAssertion)).some((message) =>
      message.includes("PRODUCT_SPEC_ACTION_INVOCATION_ASSERTION")), true);

    const wrongTraceability: any = structuredClone(source);
    const actionBinding = wrongTraceability.traceability.bindings.find((binding: any) =>
      binding.semanticKind === "action" && binding.semanticRef === predicate.subjectRef);
    const evidenceBinding = wrongTraceability.traceability.bindings.find((binding: any) =>
      binding.semanticKind === "evidence" && binding.semanticRef === predicate.id);
    evidenceBinding.requirementRefs = [actionBinding.requirementRefs[0]];
    assert.equal(messages(ProductSpecV2Schema.safeParse(wrongTraceability)).some((message) =>
      message.includes("PRODUCT_SPEC_ACTION_INVOCATION_TRACEABILITY_MISMATCH")), true);
  });

  it("rejects native prerequisite cycles and durable writes without reload evidence", () => {
    const cycle: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    const first = cycle.actions[0];
    const second = structuredClone(first);
    second.id = "ACT_SECOND_TASK";
    second.name = "Second Task";
    second.invocationInterface.subcommandTokens = ["second"];
    second.observableEffects[0].id = "OBS_SECOND_TASK";
    second.observableEffects[0].evidenceRef = "EVID_SECOND_TASK";
    const secondInvocationRef = deriveActionInvocationEvidenceIdV2(second.id);
    second.evidenceRefs = ["EVID_SECOND_TASK", secondInvocationRef];
    second.success.evidenceRefs = ["EVID_SECOND_TASK", secondInvocationRef];
    first.evidenceScenario.prerequisiteSteps = [{
      actionRef: second.id,
      inputValues: { title: "Second" },
    }];
    second.evidenceScenario.prerequisiteSteps = [{
      actionRef: first.id,
      inputValues: { title: "First" },
    }];
    cycle.actions.push(second);
    cycle.evidencePredicates.push(
      {
        id: "EVID_SECOND_TASK",
        kind: "observable_outcome",
        required: true,
        subjectRef: "OBS_SECOND_TASK",
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
      {
        id: secondInvocationRef,
        kind: "action_invocation",
        required: true,
        subjectRef: second.id,
        capabilityRefs: [],
        assertion: { operator: "passes" },
      },
    );
    const requirementRefs = cycle.requirements.map((requirement: any) => requirement.id);
    cycle.traceability.bindings.push(
      { semanticKind: "action", semanticRef: second.id, requirementRefs },
      { semanticKind: "observable", semanticRef: "OBS_SECOND_TASK", requirementRefs },
      { semanticKind: "evidence", semanticRef: "EVID_SECOND_TASK", requirementRefs },
      { semanticKind: "evidence", semanticRef: secondInvocationRef, requirementRefs },
    );
    assert.equal(messages(ProductSpecV2Schema.safeParse(cycle)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_PREREQUISITE_CYCLE")), true);

    const durable: any = buildContainedGameProductSpecV2();
    durable.persistencePolicies.push({
      id: "PERSIST_GAME_PHASE",
      kind: "local_storage",
      owner: "application",
      entityRefs: [],
      durability: "reload",
      key: "contained-game-phase-v1",
      rehydration: { kind: "initialization" },
    });
    durable.actions[0].persistenceEffects.push({
      policyRef: "PERSIST_GAME_PHASE",
      operation: "write",
      payloadFields: [],
      statePaths: [{ stateRef: "STATE_GAME_PHASE", path: "/phase" }],
    });
    durable.actions[0].success.persistenceRefs = ["PERSIST_GAME_PHASE"];
    durable.traceability.bindings.push({
      semanticKind: "persistence",
      semanticRef: "PERSIST_GAME_PHASE",
      requirementRefs: durable.requirements.map((requirement: any) => requirement.id),
    });
    assert.equal(messages(ProductSpecV2Schema.safeParse(durable)).some((message) =>
      message.includes("PRODUCT_SPEC_V2_DURABLE_RELOAD_EVIDENCE_MISSING")), true);
    durable.actions[0].observableEffects[2].assertions.push({
      phase: "reload",
      property: "visible_text",
      operator: "contains",
      expected: "Playing",
    });
    assert.equal(ProductSpecV2Schema.safeParse(durable).success, true);
  });

  it("rejects unsafe or non-canonical invocation ABI and malformed HTTP templates", () => {
    const unsafeToken = cliPlan();
    unsafeToken.actions[0].invocationInterface.subcommandTokens = ["start\tdebug"];
    assert.equal(PlanSemanticProposalV2Schema.safeParse(unsafeToken).success, false);

    const unsafeEnvironment = cliPlan();
    unsafeEnvironment.actions[0].invocationInterface.fieldBindings[0].channel = {
      kind: "environment",
      name: "OPENAI_API_KEY",
    };
    assert.equal(PlanSemanticProposalV2Schema.safeParse(unsafeEnvironment).success, false);

    const nonCanonicalCodes = cliPlan();
    nonCanonicalCodes.actions[0].invocationInterface.result.successExitCodes = [1, 0];
    assert.equal(PlanSemanticProposalV2Schema.safeParse(nonCanonicalCodes).success, false);

    const conflictingTrigger = cliPlan();
    conflictingTrigger.actions[0].trigger.sourceRef = "different-command";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(conflictingTrigger)).some((message) =>
      message.includes("INVOCATION_INTERFACE_EXTERNAL_TRIGGER_SOURCE_FORBIDDEN")), true);

    const malformedRoute = httpPlan();
    malformedRoute.routes[0].path = "/play/:1phase";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(malformedRoute)).some((message) =>
      message.includes("PLAN_SEMANTIC_HTTP_PATH_PARAMETER_CLOSURE")), true);

    const networkPathEscape = httpPlan();
    networkPathEscape.routes[0].path = "//evil.example/collect";
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(networkPathEscape)).some((message) =>
      message.includes("PLAN_SEMANTIC_HTTP_ROUTE_PATH_UNSAFE")), true);

    const wrongOutputAssertion: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    wrongOutputAssertion.actions[0].observableEffects[0].assertions[0].property = "visible_text";
    assert.equal(messages(ProductSpecV2Schema.safeParse(wrongOutputAssertion)).some((message) =>
      message.includes("PRODUCT_SPEC_INVOCATION_OUTPUT_VALUE_ASSERTION_REQUIRED")), true);

    const forgedCapability: any = structuredClone(
      buildNoDesignProductBuildPacketV3Contracts().productSpecV2,
    );
    forgedCapability.evidencePredicates.find((predicate: any) =>
      predicate.kind === "action_invocation").capabilityRefs = ["CAP_CALLER_FORGED"];
    assert.equal(messages(ProductSpecV2Schema.safeParse(forgedCapability)).some((message) =>
      message.includes("PRODUCT_SPEC_ACTION_INVOCATION_CAPABILITY_FORBIDDEN")), true);
  });

  it("keeps compiler-owned invocation evidence disjoint from an observable named invocation", () => {
    const proposal = containedGamePlanProposalV2();
    proposal.actions[0].observables[0].key = "invocation";
    const compiled = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal,
    });
    assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));
    if (compiled.status !== "canonicalized") return;
    const evidenceIds = compiled.productSpec.evidencePredicates.map((predicate) => predicate.id);
    assert.equal(new Set(evidenceIds).size, evidenceIds.length);
  });

  it("reserves the inherited action evidence budget for invocation authority", () => {
    const proposal = containedGamePlanProposalV2();
    const template = proposal.actions[0].observables[1];
    proposal.actions[0].observables = Array.from({ length: 499 }, (_, index) => ({
      ...structuredClone(template),
      key: `observable_${index.toString().padStart(3, "0")}`,
    }));
    assert.equal(PlanSemanticProposalV2Schema.safeParse(proposal).success, true);
    const compiled = compilePlanSemanticProposalV2({
      task: CONTAINED_GAME_TASK,
      proposal,
    });
    assert.equal(compiled.status, "canonicalized", JSON.stringify(compiled));

    proposal.actions[0].observables.push({
      ...structuredClone(template),
      key: "observable_499",
    });
    assert.equal(PlanSemanticProposalV2Schema.safeParse(proposal).success, false);
  });

  it("rejects planner graphs whose compiler-owned traceability cannot be published", () => {
    const proposal = containedGamePlanProposalV2();
    const template = structuredClone(proposal.actions[0]);
    proposal.actions = Array.from({ length: 20 }, (_, actionIndex) => {
      const action = structuredClone(template);
      action.key = `action_${actionIndex}`;
      action.name = `Action ${actionIndex}`;
      action.controlPlacements = Array.from({ length: 1_000 }, (_, placementIndex) => ({
        ...structuredClone(template.controlPlacements[0]),
        key: `control_${actionIndex}_${placementIndex}`,
      }));
      action.evidenceScenario.controlPlacementKey = action.controlPlacements[0].key;
      return action;
    });
    assert.equal(messages(PlanSemanticProposalV2Schema.safeParse(proposal)).some((message) =>
      message.includes("PLAN_SEMANTIC_TRACEABILITY_BUDGET_EXCEEDED")), true);
  });
});
