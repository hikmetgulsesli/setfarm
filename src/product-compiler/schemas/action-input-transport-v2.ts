import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  EntityFieldIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./product-spec-v2.js";

export const ACTION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2 =
  "setfarm.action-input-transport.v2" as const;

export const ActionInputTransportValueTypeV2Schema = z.enum([
  "string",
  "number",
  "boolean",
  "enum",
  "object",
  "array",
]);

export type ActionInputTransportValueTypeV2 = z.infer<
  typeof ActionInputTransportValueTypeV2Schema
>;

export const ActionInputCodecIdV2Schema = z.enum([
  "text.v2",
  "json-number.v2",
  "boolean-checked.v2",
  "enum-token.v2",
  "json-object.v2",
  "json-array.v2",
]);

export type ActionInputCodecIdV2 = z.infer<typeof ActionInputCodecIdV2Schema>;

export const ActionInputDecodedKindV2Schema = z.enum([
  "string",
  "number",
  "boolean",
  "object",
  "array",
]);

export const ActionInputDomRequirementV2Schema = z.object({
  tagName: z.enum(["input", "textarea", "select"]),
  inputType: z.enum(["text", "number", "checkbox"]).nullable(),
  valueChannel: z.enum(["value", "checked"]),
  evidenceAction: z.enum(["fill", "select", "set_checked"]),
}).strict();

export type ActionInputDomRequirementV2 = z.infer<
  typeof ActionInputDomRequirementV2Schema
>;

type CodecProfileV2 = Readonly<{
  codecId: ActionInputCodecIdV2;
  decodedKind: z.infer<typeof ActionInputDecodedKindV2Schema>;
  domRequirements: readonly ActionInputDomRequirementV2[];
}>;

const CODEC_PROFILE_BY_VALUE_TYPE_V2 = Object.freeze({
  string: {
    codecId: "text.v2",
    decodedKind: "string",
    domRequirements: [
      {
        tagName: "input",
        inputType: "text",
        valueChannel: "value",
        evidenceAction: "fill",
      },
      {
        tagName: "textarea",
        inputType: null,
        valueChannel: "value",
        evidenceAction: "fill",
      },
    ],
  },
  number: {
    codecId: "json-number.v2",
    decodedKind: "number",
    domRequirements: [{
      tagName: "input",
      inputType: "number",
      valueChannel: "value",
      evidenceAction: "fill",
    }],
  },
  boolean: {
    codecId: "boolean-checked.v2",
    decodedKind: "boolean",
    domRequirements: [{
      tagName: "input",
      inputType: "checkbox",
      valueChannel: "checked",
      evidenceAction: "set_checked",
    }],
  },
  enum: {
    codecId: "enum-token.v2",
    decodedKind: "string",
    domRequirements: [{
      tagName: "select",
      inputType: null,
      valueChannel: "value",
      evidenceAction: "select",
    }],
  },
  object: {
    codecId: "json-object.v2",
    decodedKind: "object",
    domRequirements: [{
      tagName: "textarea",
      inputType: null,
      valueChannel: "value",
      evidenceAction: "fill",
    }],
  },
  array: {
    codecId: "json-array.v2",
    decodedKind: "array",
    domRequirements: [{
      tagName: "textarea",
      inputType: null,
      valueChannel: "value",
      evidenceAction: "fill",
    }],
  },
} satisfies Readonly<Record<ActionInputTransportValueTypeV2, CodecProfileV2>>);

const ActionInputFieldRefV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/);

const ActionInputTransportV2BaseSchema = z.object({
  schema: z.literal(ACTION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
  actionInputRef: z.string().min(3).max(500),
  actionRef: ActionIdSchema,
  fieldRef: ActionInputFieldRefV2Schema,
  valueType: ActionInputTransportValueTypeV2Schema,
  required: z.literal(true),
  entityFieldRef: EntityFieldIdSchema.nullable(),
  enumValues: z.array(z.string().min(1).max(500)).min(1).max(500).nullable(),
  codecId: ActionInputCodecIdV2Schema,
  encodedKind: z.literal("utf8-string"),
  decodedKind: ActionInputDecodedKindV2Schema,
  domRequirements: z.array(ActionInputDomRequirementV2Schema).min(1).max(2),
  contractHash: Sha256Schema,
}).strict();

export type ActionInputTransportV2 = z.infer<
  typeof ActionInputTransportV2BaseSchema
>;

export type ActionInputTransportHashPayloadV2 = Omit<
  ActionInputTransportV2,
  "contractHash"
>;

export function hashActionInputTransportV2(
  value: ActionInputTransportV2 | ActionInputTransportHashPayloadV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.contractHash;
  return hashCanonicalJson(payload);
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

export const ActionInputTransportV2Schema = ActionInputTransportV2BaseSchema
  .superRefine((value, context) => {
    if (value.actionInputRef !== `${value.actionRef}.${value.fieldRef}`) {
      context.addIssue({
        code: "custom",
        path: ["actionInputRef"],
        message: "ACTION_INPUT_V2_REF_MISMATCH: actionInputRef must derive from actionRef and fieldRef",
      });
    }

    if (value.valueType === "enum") {
      if (value.entityFieldRef === null) {
        context.addIssue({
          code: "custom",
          path: ["entityFieldRef"],
          message: "ACTION_INPUT_V2_ENUM_AUTHORITY_MISSING: enum transport requires an entity field authority",
        });
      }
      if (value.enumValues === null || !hasUniqueStrings(value.enumValues)) {
        context.addIssue({
          code: "custom",
          path: ["enumValues"],
          message: "ACTION_INPUT_V2_ENUM_AUTHORITY_INVALID: enum values must be present and unique",
        });
      }
    } else if (value.enumValues !== null) {
      context.addIssue({
        code: "custom",
        path: ["enumValues"],
        message: "ACTION_INPUT_V2_ENUM_VALUES_FORBIDDEN: non-enum transports cannot carry enum values",
      });
    }

    const expected = CODEC_PROFILE_BY_VALUE_TYPE_V2[value.valueType];
    if (
      value.codecId !== expected.codecId
      || value.decodedKind !== expected.decodedKind
      || !sameCanonicalValue(value.domRequirements, expected.domRequirements)
    ) {
      context.addIssue({
        code: "custom",
        path: ["codecId"],
        message: "ACTION_INPUT_V2_CODEC_PROFILE_MISMATCH: codec and DOM requirements must equal the canonical value-type profile",
      });
    }

    if (value.contractHash !== hashActionInputTransportV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["contractHash"],
        message: "ACTION_INPUT_V2_CONTRACT_HASH_MISMATCH: contractHash must bind the exact canonical transport payload",
      });
    }
  });

export type ActionInputTransportCompilationRejectionCodeV2 =
  | "ACTION_INPUT_V2_PRODUCT_SPEC_INVALID"
  | "ACTION_INPUT_V2_ACTION_UNRESOLVED"
  | "ACTION_INPUT_V2_FIELD_UNRESOLVED"
  | "ACTION_INPUT_V2_OPTIONAL_PRESENCE_UNSPECIFIED"
  | "ACTION_INPUT_V2_VALUE_TYPE_UNSUPPORTED"
  | "ACTION_INPUT_V2_ENTITY_FIELD_UNRESOLVED"
  | "ACTION_INPUT_V2_ENTITY_VALUE_TYPE_MISMATCH"
  | "ACTION_INPUT_V2_ENUM_AUTHORITY_MISSING"
  | "ACTION_INPUT_V2_ENUM_AUTHORITY_INVALID"
  | "ACTION_INPUT_V2_EVIDENCE_VALUE_INVALID";

export type ActionInputTransportCompilationResultV2 =
  | Readonly<{
      status: "compiled";
      contract: ActionInputTransportV2;
    }>
  | Readonly<{
      status: "rejected";
      rejectionCode: ActionInputTransportCompilationRejectionCodeV2;
      message: string;
    }>;

function compilationRejection(
  rejectionCode: ActionInputTransportCompilationRejectionCodeV2,
  message: string,
): Extract<ActionInputTransportCompilationResultV2, { status: "rejected" }> {
  return { status: "rejected", rejectionCode, message };
}

/**
 * Compiles one exact ProductSpecV2 action-input field into a browser transport
 * contract. Unsupported or ambiguous presence/type semantics fail closed.
 */
export function compileActionInputTransportV2(input: Readonly<{
  productSpec: ProductSpecV2;
  actionRef: string;
  fieldName: string;
}>): ActionInputTransportCompilationResultV2 {
  const parsed = ProductSpecV2Schema.safeParse(input.productSpec);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return compilationRejection(
      "ACTION_INPUT_V2_PRODUCT_SPEC_INVALID",
      `ProductSpecV2 failed at ${first?.path.join("/") || "$"}: ${first?.message || "schema mismatch"}`,
    );
  }

  const action = parsed.data.actions.find((candidate) => candidate.id === input.actionRef);
  if (!action) {
    return compilationRejection(
      "ACTION_INPUT_V2_ACTION_UNRESOLVED",
      `ProductSpecV2 has no action ${input.actionRef}`,
    );
  }
  const field = action.input.fields.find((candidate) => candidate.name === input.fieldName);
  if (!field) {
    return compilationRejection(
      "ACTION_INPUT_V2_FIELD_UNRESOLVED",
      `ProductSpecV2 action ${input.actionRef} has no input field ${input.fieldName}`,
    );
  }
  if (!field.required) {
    return compilationRejection(
      "ACTION_INPUT_V2_OPTIONAL_PRESENCE_UNSPECIFIED",
      `Action input ${input.actionRef}.${input.fieldName} is optional, but v2 has no absent/blank transport semantics`,
    );
  }
  if (field.valueType === "date" || field.valueType === "datetime") {
    return compilationRejection(
      "ACTION_INPUT_V2_VALUE_TYPE_UNSUPPORTED",
      `Action input ${input.actionRef}.${input.fieldName} uses unsupported value type ${field.valueType}`,
    );
  }

  const entityField = field.entityFieldRef
    ? parsed.data.entities.flatMap((entity) => entity.fields)
      .find((candidate) => candidate.id === field.entityFieldRef)
    : undefined;
  if (field.entityFieldRef && !entityField) {
    return compilationRejection(
      "ACTION_INPUT_V2_ENTITY_FIELD_UNRESOLVED",
      `Action input ${input.actionRef}.${input.fieldName} references absent entity field ${field.entityFieldRef}`,
    );
  }
  if (entityField && entityField.valueType !== field.valueType) {
    return compilationRejection(
      "ACTION_INPUT_V2_ENTITY_VALUE_TYPE_MISMATCH",
      `Action input ${input.actionRef}.${input.fieldName} is ${field.valueType}, but ${entityField.id} is ${entityField.valueType}`,
    );
  }
  if (field.valueType === "enum" && (!entityField || entityField.valueType !== "enum")) {
    return compilationRejection(
      "ACTION_INPUT_V2_ENUM_AUTHORITY_MISSING",
      `Enum action input ${input.actionRef}.${input.fieldName} requires an exact enum entity field authority`,
    );
  }
  if (
    field.valueType === "enum"
    && (!entityField?.enumValues || !hasUniqueStrings(entityField.enumValues))
  ) {
    return compilationRejection(
      "ACTION_INPUT_V2_ENUM_AUTHORITY_INVALID",
      `Enum authority for ${input.actionRef}.${input.fieldName} must contain unique exact values`,
    );
  }

  const valueType = field.valueType;
  const profile = CODEC_PROFILE_BY_VALUE_TYPE_V2[valueType];
  const hashPayload: ActionInputTransportHashPayloadV2 = {
    schema: ACTION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
    actionInputRef: `${action.id}.${field.name}`,
    actionRef: action.id,
    fieldRef: field.name,
    valueType,
    required: true,
    entityFieldRef: field.entityFieldRef ?? null,
    enumValues: valueType === "enum" ? [...entityField!.enumValues!] : null,
    codecId: profile.codecId,
    encodedKind: "utf8-string",
    decodedKind: profile.decodedKind,
    domRequirements: profile.domRequirements.map((requirement) => ({ ...requirement })),
  };
  const contract = ActionInputTransportV2Schema.parse({
    ...hashPayload,
    contractHash: hashActionInputTransportV2(hashPayload),
  });

  try {
    encodeActionInputValueV2(
      contract,
      action.evidenceScenario.targetInputValues[field.name],
    );
  } catch (error) {
    return compilationRejection(
      "ACTION_INPUT_V2_EVIDENCE_VALUE_INVALID",
      `Evidence value for ${contract.actionInputRef} is not encodable by ${contract.codecId}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { status: "compiled", contract };
}

export type ActionInputTransportCodecErrorCodeV2 =
  | "ACTION_INPUT_V2_CONTRACT_INVALID"
  | "ACTION_INPUT_V2_VALUE_INVALID"
  | "ACTION_INPUT_V2_ENCODED_VALUE_INVALID";

export class ActionInputTransportCodecErrorV2 extends TypeError {
  readonly code: ActionInputTransportCodecErrorCodeV2;

  constructor(code: ActionInputTransportCodecErrorCodeV2, message: string) {
    super(message);
    this.name = "ActionInputTransportCodecErrorV2";
    this.code = code;
  }
}

function requireTransportContractV2(value: unknown): ActionInputTransportV2 {
  const parsed = ActionInputTransportV2Schema.safeParse(value);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ActionInputTransportCodecErrorV2(
      "ACTION_INPUT_V2_CONTRACT_INVALID",
      `Action-input transport contract failed at ${first?.path.join("/") || "$"}: ${first?.message || "schema mismatch"}`,
    );
  }
  return parsed.data;
}

function invalidValue(contract: ActionInputTransportV2, detail: string): never {
  throw new ActionInputTransportCodecErrorV2(
    "ACTION_INPUT_V2_VALUE_INVALID",
    `${contract.actionInputRef} cannot encode ${detail} with ${contract.codecId}`,
  );
}

function invalidEncodedValue(contract: ActionInputTransportV2, detail: string): never {
  throw new ActionInputTransportCodecErrorV2(
    "ACTION_INPUT_V2_ENCODED_VALUE_INVALID",
    `${contract.actionInputRef} cannot decode ${detail} with ${contract.codecId}`,
  );
}

function canonicalJsonForRoot(
  contract: ActionInputTransportV2,
  value: unknown,
  rootKind: "object" | "array",
): string {
  const validRoot = rootKind === "array"
    ? Array.isArray(value)
    : value !== null && typeof value === "object" && !Array.isArray(value);
  if (!validRoot) invalidValue(contract, `a non-${rootKind} root value`);
  try {
    return canonicalJsonStringify(value);
  } catch (error) {
    return invalidValue(
      contract,
      `a non-JSON ${rootKind} value (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

/** Encodes one typed value into the exact UTF-8 string token owned by v2. */
export function encodeActionInputValueV2(contractInput: unknown, value: unknown): string {
  const contract = requireTransportContractV2(contractInput);
  switch (contract.valueType) {
    case "string":
      if (typeof value !== "string") invalidValue(contract, "a non-string value");
      return value;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        invalidValue(contract, "a non-finite or non-number value");
      }
      return Object.is(value, -0) ? "0" : JSON.stringify(value);
    case "boolean":
      if (typeof value !== "boolean") invalidValue(contract, "a non-boolean value");
      return value ? "true" : "false";
    case "enum":
      if (typeof value !== "string" || !contract.enumValues?.includes(value)) {
        invalidValue(contract, "a token outside the exact enum authority");
      }
      return value;
    case "object":
      return canonicalJsonForRoot(contract, value, "object");
    case "array":
      return canonicalJsonForRoot(contract, value, "array");
  }
}

const JSON_NUMBER_TOKEN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;

function parseJsonRoot(
  contract: ActionInputTransportV2,
  encoded: string,
  rootKind: "object" | "array",
): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    return invalidEncodedValue(contract, `malformed JSON for a ${rootKind} root`);
  }
  const validRoot = rootKind === "array"
    ? Array.isArray(parsed)
    : parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  if (!validRoot) invalidEncodedValue(contract, `a non-${rootKind} JSON root`);
  try {
    canonicalJsonStringify(parsed);
  } catch (error) {
    return invalidEncodedValue(
      contract,
      `a non-canonicalizable JSON ${rootKind} (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  return parsed;
}

/** Decodes one exact UTF-8 string token into its typed ProductSpec value. */
export function decodeActionInputValueV2(contractInput: unknown, encoded: string): unknown {
  const contract = requireTransportContractV2(contractInput);
  if (typeof encoded !== "string") {
    return invalidEncodedValue(contract, "a non-string transport token");
  }
  switch (contract.valueType) {
    case "string":
      return encoded;
    case "number": {
      if (!JSON_NUMBER_TOKEN.test(encoded)) {
        return invalidEncodedValue(contract, "a token outside the JSON-number grammar");
      }
      const value = Number(encoded);
      if (!Number.isFinite(value)) {
        return invalidEncodedValue(contract, "a non-finite JSON-number token");
      }
      return value;
    }
    case "boolean":
      if (encoded === "true") return true;
      if (encoded === "false") return false;
      return invalidEncodedValue(contract, "a token other than true or false");
    case "enum":
      if (!contract.enumValues?.includes(encoded)) {
        return invalidEncodedValue(contract, "a token outside the exact enum authority");
      }
      return encoded;
    case "object":
      return parseJsonRoot(contract, encoded, "object");
    case "array":
      return parseJsonRoot(contract, encoded, "array");
  }
}

export const ActionInputDomCandidateV2Schema = z.object({
  tagName: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*$/),
  inputType: z.string().min(1).max(100).regex(/^[a-z][a-z0-9-]*$/).nullable(),
  valueChannel: z.enum(["value", "checked"]),
  codecMarker: z.string().min(1).max(100).nullable(),
  enumOptions: z.array(z.string().min(1).max(500)).max(500).nullable(),
}).strict();

export type ActionInputDomCandidateV2 = z.infer<
  typeof ActionInputDomCandidateV2Schema
>;

export type ActionInputDomCompatibilityResultV2 =
  | Readonly<{
      status: "compatible";
      matchedRequirement: ActionInputDomRequirementV2;
    }>
  | Readonly<{
      status: "rejected";
      rejectionCode:
        | "CANDIDATE_ACTION_INPUT_CODEC_MARKER_MISMATCH"
        | "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH";
      message: string;
    }>;

/**
 * Checks physical DOM transport compatibility without guessing from prose or
 * coercing incompatible HTML controls.
 */
export function checkActionInputDomCompatibilityV2(
  contractInput: unknown,
  candidateInput: unknown,
): ActionInputDomCompatibilityResultV2 {
  const contract = requireTransportContractV2(contractInput);
  const candidate = ActionInputDomCandidateV2Schema.safeParse(candidateInput);
  if (!candidate.success) {
    const first = candidate.error.issues[0];
    return {
      status: "rejected",
      rejectionCode: "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH",
      message: `DOM candidate failed at ${first?.path.join("/") || "$"}: ${first?.message || "schema mismatch"}`,
    };
  }
  if (candidate.data.codecMarker !== contract.codecId) {
    return {
      status: "rejected",
      rejectionCode: "CANDIDATE_ACTION_INPUT_CODEC_MARKER_MISMATCH",
      message: `DOM codec marker ${String(candidate.data.codecMarker)} does not equal ${contract.codecId}`,
    };
  }

  const matchedRequirement = contract.domRequirements.find((requirement) =>
    requirement.tagName === candidate.data.tagName
    && requirement.inputType === candidate.data.inputType
    && requirement.valueChannel === candidate.data.valueChannel);
  if (!matchedRequirement) {
    return {
      status: "rejected",
      rejectionCode: "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH",
      message: `DOM ${candidate.data.tagName}/${String(candidate.data.inputType)}/${candidate.data.valueChannel} is incompatible with ${contract.valueType}`,
    };
  }

  const exactEnumOptions = contract.valueType === "enum"
    ? candidate.data.enumOptions !== null
      && sameCanonicalValue(candidate.data.enumOptions, contract.enumValues)
    : candidate.data.enumOptions === null;
  if (!exactEnumOptions) {
    return {
      status: "rejected",
      rejectionCode: "CANDIDATE_ACTION_INPUT_DOM_TRANSPORT_MISMATCH",
      message: contract.valueType === "enum"
        ? "DOM select options do not exactly equal the enum authority"
        : "Non-enum DOM transport cannot declare enum options",
    };
  }

  return { status: "compatible", matchedRequirement };
}
