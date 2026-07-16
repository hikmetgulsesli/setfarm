import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ActionInputTransportCodecErrorV2,
  ActionInputTransportV2Schema,
  checkActionInputDomCompatibilityV2,
  compileActionInputTransportV2,
  decodeActionInputValueV2,
  encodeActionInputValueV2,
  hashActionInputTransportV2,
  type ActionInputDomCandidateV2,
  type ActionInputTransportCompilationRejectionCodeV2,
  type ActionInputTransportV2,
} from "../../src/product-compiler/schemas/action-input-transport-v2.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { buildContainedGameProductSpecV2 } from "./fixtures/product-semantics-v2.js";

type ProductValueType = ProductSpecV2["actions"][number]["input"]["fields"][number]["valueType"];

type SpecOptions = Readonly<{
  required?: boolean;
  entityValueType?: ProductValueType;
  enumValues?: string[];
}>;

const ACTION_REF = "ACT_START_GAME";
const FIELD_NAME = "payload";
const ENTITY_REF = "ENTITY_ACTION_INPUT";
const ENTITY_FIELD_REF = "FIELD_ACTION_INPUT_PAYLOAD";

function productSpecWithInput(
  valueType: ProductValueType,
  evidenceValue: unknown,
  options: SpecOptions = {},
): ProductSpecV2 {
  const productSpec = structuredClone(buildContainedGameProductSpecV2());
  const action = productSpec.actions.find((candidate) => candidate.id === ACTION_REF)!;
  const hasEntityAuthority = options.entityValueType !== undefined;
  action.input.fields = [{
    name: FIELD_NAME,
    valueType,
    required: options.required ?? true,
    ...(hasEntityAuthority ? { entityFieldRef: ENTITY_FIELD_REF } : {}),
  }];
  action.evidenceScenario.targetInputValues = { [FIELD_NAME]: evidenceValue };
  action.stateDeltas[0]!.valueFrom = { kind: "input", field: FIELD_NAME };

  if (hasEntityAuthority) {
    productSpec.entities.push({
      id: ENTITY_REF,
      name: "Action Input",
      fields: [{
        id: ENTITY_FIELD_REF,
        name: FIELD_NAME,
        valueType: options.entityValueType!,
        required: true,
        ...(options.entityValueType === "enum"
          ? { enumValues: options.enumValues ?? ["ready", "running"] }
          : {}),
      }],
    });
    productSpec.traceability.bindings.push({
      semanticKind: "entity",
      semanticRef: ENTITY_REF,
      requirementRefs: productSpec.requirements.map((requirement) => requirement.id),
    });
  }
  return productSpec;
}

function compiledContract(
  valueType: ProductValueType,
  evidenceValue: unknown,
  options: SpecOptions = {},
): ActionInputTransportV2 {
  const result = compileActionInputTransportV2({
    productSpec: productSpecWithInput(valueType, evidenceValue, options),
    actionRef: ACTION_REF,
    fieldName: FIELD_NAME,
  });
  assert.equal(result.status, "compiled", result.status === "rejected" ? result.message : undefined);
  if (result.status !== "compiled") throw new Error(result.message);
  return result.contract;
}

function assertCompileRejected(
  productSpec: ProductSpecV2,
  rejectionCode: ActionInputTransportCompilationRejectionCodeV2,
  actionRef = ACTION_REF,
  fieldName = FIELD_NAME,
): void {
  const result = compileActionInputTransportV2({ productSpec, actionRef, fieldName });
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") throw new Error("Expected compiler rejection");
  assert.equal(result.rejectionCode, rejectionCode);
}

function assertCodecError(
  operation: () => unknown,
  code: ActionInputTransportCodecErrorV2["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) => error instanceof ActionInputTransportCodecErrorV2 && error.code === code,
  );
}

function domCandidate(
  contract: ActionInputTransportV2,
  value: Partial<ActionInputDomCandidateV2> = {},
): ActionInputDomCandidateV2 {
  const requirement = contract.domRequirements[0]!;
  return {
    tagName: requirement.tagName,
    inputType: requirement.inputType,
    valueChannel: requirement.valueChannel,
    codecMarker: contract.codecId,
    enumOptions: contract.enumValues,
    ...value,
  };
}

describe("ActionInputTransportV2 compiler and schema", () => {
  it("compiles the complete supported value-type matrix with canonical profiles", () => {
    const cases: ReadonlyArray<Readonly<{
      valueType: ProductValueType;
      evidenceValue: unknown;
      options?: SpecOptions;
      codecId: ActionInputTransportV2["codecId"];
      decodedKind: ActionInputTransportV2["decodedKind"];
      domRequirements: ActionInputTransportV2["domRequirements"];
    }>> = [
      {
        valueType: "string",
        evidenceValue: "hello",
        codecId: "text.v2",
        decodedKind: "string",
        domRequirements: [
          { tagName: "input", inputType: "text", valueChannel: "value", evidenceAction: "fill" },
          { tagName: "textarea", inputType: null, valueChannel: "value", evidenceAction: "fill" },
        ],
      },
      {
        valueType: "number",
        evidenceValue: -1250,
        codecId: "json-number.v2",
        decodedKind: "number",
        domRequirements: [
          { tagName: "input", inputType: "number", valueChannel: "value", evidenceAction: "fill" },
        ],
      },
      {
        valueType: "boolean",
        evidenceValue: true,
        codecId: "boolean-checked.v2",
        decodedKind: "boolean",
        domRequirements: [
          { tagName: "input", inputType: "checkbox", valueChannel: "checked", evidenceAction: "set_checked" },
        ],
      },
      {
        valueType: "enum",
        evidenceValue: "running",
        options: { entityValueType: "enum", enumValues: ["ready", "running"] },
        codecId: "enum-token.v2",
        decodedKind: "string",
        domRequirements: [
          { tagName: "select", inputType: null, valueChannel: "value", evidenceAction: "select" },
        ],
      },
      {
        valueType: "object",
        evidenceValue: { nested: null },
        codecId: "json-object.v2",
        decodedKind: "object",
        domRequirements: [
          { tagName: "textarea", inputType: null, valueChannel: "value", evidenceAction: "fill" },
        ],
      },
      {
        valueType: "array",
        evidenceValue: [1, null, { ok: true }],
        codecId: "json-array.v2",
        decodedKind: "array",
        domRequirements: [
          { tagName: "textarea", inputType: null, valueChannel: "value", evidenceAction: "fill" },
        ],
      },
    ];

    for (const expected of cases) {
      const contract = compiledContract(
        expected.valueType,
        expected.evidenceValue,
        expected.options,
      );
      assert.equal(contract.schema, "setfarm.action-input-transport.v2");
      assert.equal(contract.actionInputRef, `${ACTION_REF}.${FIELD_NAME}`);
      assert.equal(contract.actionRef, ACTION_REF);
      assert.equal(contract.fieldRef, FIELD_NAME);
      assert.equal(contract.valueType, expected.valueType);
      assert.equal(contract.required, true);
      assert.equal(contract.codecId, expected.codecId);
      assert.equal(contract.encodedKind, "utf8-string");
      assert.equal(contract.decodedKind, expected.decodedKind);
      assert.deepEqual(contract.domRequirements, expected.domRequirements);
      assert.equal(contract.entityFieldRef, expected.valueType === "enum" ? ENTITY_FIELD_REF : null);
      assert.deepEqual(
        contract.enumValues,
        expected.valueType === "enum" ? ["ready", "running"] : null,
      );
      assert.equal(contract.contractHash, hashActionInputTransportV2(contract));
      assert.deepEqual(ActionInputTransportV2Schema.parse(contract), contract);
    }
  });

  it("binds every semantic field into a deterministic contract hash", () => {
    const contract = compiledContract("string", "hello");
    const replay = compiledContract("string", "hello");
    assert.equal(replay.contractHash, contract.contractHash);
    assert.equal(
      hashActionInputTransportV2(structuredClone(contract)),
      contract.contractHash,
    );

    for (const forged of [
      { ...structuredClone(contract), fieldRef: "other" },
      { ...structuredClone(contract), codecId: "json-number.v2" as const },
      { ...structuredClone(contract), contractHash: "0".repeat(64) },
      { ...structuredClone(contract), extra: true },
    ]) {
      assert.equal(ActionInputTransportV2Schema.safeParse(forged).success, false);
    }

    const rehashedWrongProfile = {
      ...structuredClone(contract),
      codecId: "json-number.v2" as const,
    };
    rehashedWrongProfile.contractHash = hashActionInputTransportV2(rehashedWrongProfile);
    assert.equal(ActionInputTransportV2Schema.safeParse(rehashedWrongProfile).success, false);
  });

  it("rejects unresolved identity, optional presence, and unsupported date semantics", () => {
    const stringSpec = productSpecWithInput("string", "hello");
    assertCompileRejected(stringSpec, "ACTION_INPUT_V2_ACTION_UNRESOLVED", "ACT_UNKNOWN");
    assertCompileRejected(stringSpec, "ACTION_INPUT_V2_FIELD_UNRESOLVED", ACTION_REF, "unknown");
    assertCompileRejected(
      productSpecWithInput("string", "hello", { required: false }),
      "ACTION_INPUT_V2_OPTIONAL_PRESENCE_UNSPECIFIED",
    );
    assertCompileRejected(
      productSpecWithInput("date", "2026-07-17"),
      "ACTION_INPUT_V2_VALUE_TYPE_UNSUPPORTED",
    );
    assertCompileRejected(
      productSpecWithInput("datetime", "2026-07-17T12:30:00Z"),
      "ACTION_INPUT_V2_VALUE_TYPE_UNSUPPORTED",
    );
  });

  it("rejects missing, mismatched, or non-unique entity enum authority", () => {
    assertCompileRejected(
      productSpecWithInput("enum", "ready"),
      "ACTION_INPUT_V2_ENUM_AUTHORITY_MISSING",
    );
    assertCompileRejected(
      productSpecWithInput("enum", "ready", { entityValueType: "string" }),
      "ACTION_INPUT_V2_ENTITY_VALUE_TYPE_MISMATCH",
    );
    assertCompileRejected(
      productSpecWithInput("number", 2, { entityValueType: "string" }),
      "ACTION_INPUT_V2_ENTITY_VALUE_TYPE_MISMATCH",
    );
    assertCompileRejected(
      productSpecWithInput("enum", "ready", {
        entityValueType: "enum",
        enumValues: ["ready", "ready"],
      }),
      "ACTION_INPUT_V2_ENUM_AUTHORITY_INVALID",
    );
  });

  it("rejects a payload that is not an exact ProductSpecV2", () => {
    const invalid = productSpecWithInput("string", "hello") as ProductSpecV2 & { schema: string };
    invalid.schema = "setfarm.product-spec.v1";
    assertCompileRejected(invalid, "ACTION_INPUT_V2_PRODUCT_SPEC_INVALID");
  });
});

describe("ActionInputTransportV2 codecs", () => {
  it("round-trips strings without coercion and rejects non-string roots", () => {
    const contract = compiledContract("string", "hello");
    for (const value of ["", "plain", "é", "line one\nline two"]) {
      assert.equal(decodeActionInputValueV2(contract, encodeActionInputValueV2(contract, value)), value);
    }
    for (const value of [null, 1, true, {}, []]) {
      assertCodecError(
        () => encodeActionInputValueV2(contract, value),
        "ACTION_INPUT_V2_VALUE_INVALID",
      );
    }
  });

  it("enforces JSON-number grammar and finite numeric values", () => {
    const contract = compiledContract("number", -1250);
    const validTokens = new Map<string, number>([
      ["0", 0],
      ["-0", -0],
      ["-12.5e2", -1250],
      ["6.02E+23", 6.02e23],
    ]);
    for (const [token, expected] of validTokens) {
      assert.equal(decodeActionInputValueV2(contract, token), expected);
    }
    assert.equal(encodeActionInputValueV2(contract, -0), "0");
    assert.equal(encodeActionInputValueV2(contract, -1250), "-1250");

    for (const token of ["", " 1", "1 ", "01", "+1", ".5", "1.", "NaN", "Infinity", "1e309"] ) {
      assertCodecError(
        () => decodeActionInputValueV2(contract, token),
        "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
      );
    }
    for (const value of [null, "1", Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assertCodecError(
        () => encodeActionInputValueV2(contract, value),
        "ACTION_INPUT_V2_VALUE_INVALID",
      );
    }
  });

  it("uses exact boolean checked tokens instead of HTML value coercion", () => {
    const contract = compiledContract("boolean", true);
    assert.equal(encodeActionInputValueV2(contract, true), "true");
    assert.equal(encodeActionInputValueV2(contract, false), "false");
    assert.equal(decodeActionInputValueV2(contract, "true"), true);
    assert.equal(decodeActionInputValueV2(contract, "false"), false);
    for (const token of ["on", "1", "TRUE", "", " true"] ) {
      assertCodecError(
        () => decodeActionInputValueV2(contract, token),
        "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
      );
    }
    for (const value of [null, "true", 1]) {
      assertCodecError(
        () => encodeActionInputValueV2(contract, value),
        "ACTION_INPUT_V2_VALUE_INVALID",
      );
    }
  });

  it("accepts only exact enum authority tokens", () => {
    const contract = compiledContract("enum", "running", {
      entityValueType: "enum",
      enumValues: ["ready", "running"],
    });
    for (const value of ["ready", "running"]) {
      assert.equal(encodeActionInputValueV2(contract, value), value);
      assert.equal(decodeActionInputValueV2(contract, value), value);
    }
    for (const value of ["Running", "paused", "", null, 1]) {
      assertCodecError(
        () => encodeActionInputValueV2(contract, value),
        "ACTION_INPUT_V2_VALUE_INVALID",
      );
    }
    assertCodecError(
      () => decodeActionInputValueV2(contract, "paused"),
      "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
    );
  });

  it("canonically encodes object and array roots while preserving nested null", () => {
    const objectContract = compiledContract("object", { nested: null });
    const arrayContract = compiledContract("array", [1, null]);
    const objectValue = { z: [null, { ok: true }], a: 1 };
    const arrayValue = [null, { z: 2, a: null }, [true]];

    assert.equal(
      encodeActionInputValueV2(objectContract, objectValue),
      '{"a":1,"z":[null,{"ok":true}]}',
    );
    assert.deepEqual(
      decodeActionInputValueV2(objectContract, '{"z":[null,{"ok":true}],"a":1}'),
      objectValue,
    );
    assert.equal(
      encodeActionInputValueV2(arrayContract, arrayValue),
      '[null,{"a":null,"z":2},[true]]',
    );
    assert.deepEqual(
      decodeActionInputValueV2(arrayContract, '[null,{"z":2,"a":null},[true]]'),
      arrayValue,
    );
  });

  it("rejects root null, wrong JSON roots, malformed JSON, and nested non-finite values", () => {
    const objectContract = compiledContract("object", { nested: null });
    const arrayContract = compiledContract("array", [null]);

    for (const contract of [objectContract, arrayContract]) {
      assertCodecError(
        () => encodeActionInputValueV2(contract, null),
        "ACTION_INPUT_V2_VALUE_INVALID",
      );
      assertCodecError(
        () => decodeActionInputValueV2(contract, "null"),
        "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
      );
      assertCodecError(
        () => decodeActionInputValueV2(contract, "{"),
        "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
      );
    }
    assertCodecError(
      () => encodeActionInputValueV2(objectContract, { bad: Number.POSITIVE_INFINITY }),
      "ACTION_INPUT_V2_VALUE_INVALID",
    );
    assertCodecError(
      () => decodeActionInputValueV2(objectContract, '{"bad":1e400}'),
      "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
    );
    assertCodecError(
      () => decodeActionInputValueV2(objectContract, "[]"),
      "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
    );
    assertCodecError(
      () => decodeActionInputValueV2(arrayContract, "{}"),
      "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
    );
    assertCodecError(
      () => encodeActionInputValueV2(objectContract, []),
      "ACTION_INPUT_V2_VALUE_INVALID",
    );
    assertCodecError(
      () => encodeActionInputValueV2(arrayContract, {}),
      "ACTION_INPUT_V2_VALUE_INVALID",
    );
  });

  it("rejects forged contracts before any codec operation", () => {
    const contract = compiledContract("string", "hello");
    const forged = { ...contract, contractHash: "0".repeat(64) };
    assertCodecError(
      () => encodeActionInputValueV2(forged, "hello"),
      "ACTION_INPUT_V2_CONTRACT_INVALID",
    );
    assertCodecError(
      () => decodeActionInputValueV2(forged, "hello"),
      "ACTION_INPUT_V2_CONTRACT_INVALID",
    );
  });
});

describe("ActionInputTransportV2 DOM compatibility", () => {
  it("accepts only the exact HTML control/channel/evidence matrix", () => {
    const stringContract = compiledContract("string", "hello");
    const numberContract = compiledContract("number", 2);
    const booleanContract = compiledContract("boolean", true);
    const enumContract = compiledContract("enum", "ready", {
      entityValueType: "enum",
      enumValues: ["ready", "running"],
    });
    const objectContract = compiledContract("object", { nested: null });
    const arrayContract = compiledContract("array", [null]);

    const candidates: ReadonlyArray<readonly [ActionInputTransportV2, ActionInputDomCandidateV2]> = [
      [stringContract, domCandidate(stringContract)],
      [stringContract, domCandidate(stringContract, { tagName: "textarea", inputType: null })],
      [numberContract, domCandidate(numberContract)],
      [booleanContract, domCandidate(booleanContract)],
      [enumContract, domCandidate(enumContract)],
      [objectContract, domCandidate(objectContract)],
      [arrayContract, domCandidate(arrayContract)],
    ];
    for (const [contract, candidate] of candidates) {
      const result = checkActionInputDomCompatibilityV2(contract, candidate);
      assert.equal(result.status, "compatible");
      if (result.status !== "compatible") throw new Error(result.message);
      assert.deepEqual(
        result.matchedRequirement,
        contract.domRequirements.find((requirement) =>
          requirement.tagName === candidate.tagName
          && requirement.inputType === candidate.inputType
          && requirement.valueChannel === candidate.valueChannel),
      );
    }
  });

  it("requires the exact codec marker", () => {
    const contract = compiledContract("number", 2);
    for (const marker of [null, "text.v2", "json-number.v1"]) {
      const result = checkActionInputDomCompatibilityV2(
        contract,
        domCandidate(contract, { codecMarker: marker }),
      );
      assert.equal(result.status, "rejected");
      if (result.status !== "rejected") throw new Error("Expected DOM rejection");
      assert.equal(result.rejectionCode, "CANDIDATE_ACTION_INPUT_CODEC_MARKER_MISMATCH");
    }
  });

  it("rejects button, link-like, custom, radio, file, and wrong-channel providers", () => {
    const stringContract = compiledContract("string", "hello");
    const booleanContract = compiledContract("boolean", true);
    const rejectedCandidates: unknown[] = [
      domCandidate(stringContract, { tagName: "button", inputType: null }),
      domCandidate(stringContract, { tagName: "a", inputType: null }),
      domCandidate(stringContract, { tagName: "div", inputType: null }),
      domCandidate(stringContract, { tagName: "input", inputType: "radio" }),
      domCandidate(stringContract, { tagName: "input", inputType: "file" }),
      domCandidate(stringContract, { tagName: "select", inputType: null }),
      domCandidate(booleanContract, { valueChannel: "value" }),
      domCandidate(booleanContract, { inputType: "text" }),
      { ...domCandidate(stringContract), contentEditable: true },
    ];
    for (const candidate of rejectedCandidates) {
      const contract = (candidate as ActionInputDomCandidateV2).codecMarker === booleanContract.codecId
        ? booleanContract
        : stringContract;
      const result = checkActionInputDomCompatibilityV2(contract, candidate);
      assert.equal(result.status, "rejected");
      if (result.status !== "rejected") throw new Error("Expected DOM rejection");
      assert.equal(result.rejectionCode, "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH");
    }
  });

  it("requires exact enum options and forbids enum options on non-enum controls", () => {
    const enumContract = compiledContract("enum", "ready", {
      entityValueType: "enum",
      enumValues: ["ready", "running"],
    });
    for (const enumOptions of [
      null,
      [],
      ["running", "ready"],
      ["", "ready", "running"],
      ["ready"],
      ["ready", "running", "paused"],
    ]) {
      const result = checkActionInputDomCompatibilityV2(
        enumContract,
        domCandidate(enumContract, { enumOptions }),
      );
      assert.equal(result.status, "rejected");
      if (result.status !== "rejected") throw new Error("Expected DOM rejection");
      assert.equal(result.rejectionCode, "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH");
    }

    const stringContract = compiledContract("string", "hello");
    const result = checkActionInputDomCompatibilityV2(
      stringContract,
      domCandidate(stringContract, { enumOptions: ["hello"] }),
    );
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected DOM rejection");
    assert.equal(result.rejectionCode, "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH");
  });
});
