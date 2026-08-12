import { z } from "zod";

import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  EntityFieldIdSchema,
  RouteIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";

export const INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2 =
  "setfarm.invocation-input-transport.v2" as const;
export const INVOCATION_INPUT_TRANSPORT_CONTRACT_VERSION_V2 = 2 as const;
export const INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2 =
  "setfarm.invocation-transport-codec-catalog.v2" as const;
export const INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2 = "2.0.0" as const;

const TRANSPORT_HASH_DOMAIN_V2 = "setfarm.invocation-input-transport-hash.v2";
const CODEC_CATALOG_HASH_DOMAIN_V2 = "setfarm.invocation-transport-codec-catalog-hash.v2";

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

export function recursivelyFreezeInvocationTransportV2<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

export const InvocationTransportValueTypeV2Schema = z.enum([
  "string",
  "number",
  "boolean",
  "enum",
  "object",
  "array",
]);

export type InvocationTransportValueTypeV2 = z.infer<
  typeof InvocationTransportValueTypeV2Schema
>;

export const InvocationTransportValueCodecRefV2Schema = z.enum([
  "VALUE_STRING_EXACT_V2",
  "VALUE_NUMBER_FINITE_CANONICAL_JSON_V2",
  "VALUE_BOOLEAN_CANONICAL_JSON_V2",
  "VALUE_ENUM_EXACT_V2",
  "VALUE_OBJECT_CANONICAL_JSON_V2",
  "VALUE_ARRAY_CANONICAL_JSON_V2",
]);

export const InvocationTransportChannelCodecRefV2Schema = z.enum([
  "CHANNEL_CLI_ARGV_TOKEN_V2",
  "CHANNEL_CLI_STDIN_CANONICAL_JSON_V2",
  "CHANNEL_HTTP_PATH_RFC3986_V2",
  "CHANNEL_HTTP_QUERY_RFC3986_V2",
  "CHANNEL_HTTP_BODY_CANONICAL_JSON_V2",
]);

export const InvocationResponseDecoderRefV2Schema = z.enum([
  "DECODE_CLI_STDERR_FAILURE_JSON_V2",
  "DECODE_CLI_STDOUT_SUCCESS_JSON_V2",
  "DECODE_HTTP_FAILURE_RESPONSE_JSON_V2",
  "DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2",
]);

const ValueCodecDefinitionV2Schema = z.object({
  valueType: InvocationTransportValueTypeV2Schema,
  codecRef: InvocationTransportValueCodecRefV2Schema,
  inputCoercion: z.literal("forbidden"),
  valueSemantics: z.literal("typed_json_value"),
  canonicalForm: z.enum([
    "exact_string",
    "finite_json_number",
    "json_boolean",
    "exact_enum_member",
    "canonical_json_object",
    "canonical_json_array",
  ]),
}).strict();

const ChannelCodecDefinitionV2Schema = z.object({
  channelKind: z.enum([
    "argv_position",
    "argv_flag",
    "stdin_json_pointer",
    "path_parameter",
    "query_parameter",
    "json_body_pointer",
  ]),
  codecRef: InvocationTransportChannelCodecRefV2Schema,
  representation: z.enum([
    "utf8_argv_token",
    "canonical_json_utf8",
    "rfc3986_path_component",
    "rfc3986_query_component",
  ]),
}).strict();

const ResponseDecoderDefinitionV2Schema = z.object({
  decoderRef: InvocationResponseDecoderRefV2Schema,
  invocationKind: z.enum(["cli_command", "http_request"]),
  outcome: z.enum(["success", "failure"]),
  byteChannel: z.enum(["stdout", "stderr", "response_body"]),
}).strict();

const InvocationTransportCodecCatalogV2BaseSchema = z.object({
  schema: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2),
  catalogVersion: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2),
  valueCodecs: z.array(ValueCodecDefinitionV2Schema).length(6),
  channelCodecs: z.array(ChannelCodecDefinitionV2Schema).length(6),
  responseDecoders: z.array(ResponseDecoderDefinitionV2Schema).length(4),
  catalogHash: Sha256Schema,
}).strict();

export type InvocationTransportCodecCatalogV2 = z.infer<
  typeof InvocationTransportCodecCatalogV2BaseSchema
>;

export type InvocationTransportCodecCatalogHashPayloadV2 = Omit<
  InvocationTransportCodecCatalogV2,
  "catalogHash"
>;

export function hashInvocationTransportCodecCatalogV2(
  value:
    | InvocationTransportCodecCatalogV2
    | InvocationTransportCodecCatalogHashPayloadV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.catalogHash;
  return hashCanonicalJson({
    schema: CODEC_CATALOG_HASH_DOMAIN_V2,
    catalog: payload,
  });
}

const CODE_OWNED_CODEC_CATALOG_PAYLOAD_V2 = {
  schema: INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2,
  catalogVersion: INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2,
  valueCodecs: [
    {
      valueType: "array",
      codecRef: "VALUE_ARRAY_CANONICAL_JSON_V2",
      inputCoercion: "forbidden",
      valueSemantics: "typed_json_value",
      canonicalForm: "canonical_json_array",
    },
    {
      valueType: "boolean",
      codecRef: "VALUE_BOOLEAN_CANONICAL_JSON_V2",
      inputCoercion: "forbidden",
      valueSemantics: "typed_json_value",
      canonicalForm: "json_boolean",
    },
    {
      valueType: "enum",
      codecRef: "VALUE_ENUM_EXACT_V2",
      inputCoercion: "forbidden",
      valueSemantics: "typed_json_value",
      canonicalForm: "exact_enum_member",
    },
    {
      valueType: "number",
      codecRef: "VALUE_NUMBER_FINITE_CANONICAL_JSON_V2",
      inputCoercion: "forbidden",
      valueSemantics: "typed_json_value",
      canonicalForm: "finite_json_number",
    },
    {
      valueType: "object",
      codecRef: "VALUE_OBJECT_CANONICAL_JSON_V2",
      inputCoercion: "forbidden",
      valueSemantics: "typed_json_value",
      canonicalForm: "canonical_json_object",
    },
    {
      valueType: "string",
      codecRef: "VALUE_STRING_EXACT_V2",
      inputCoercion: "forbidden",
      valueSemantics: "typed_json_value",
      canonicalForm: "exact_string",
    },
  ],
  channelCodecs: [
    {
      channelKind: "argv_flag",
      codecRef: "CHANNEL_CLI_ARGV_TOKEN_V2",
      representation: "utf8_argv_token",
    },
    {
      channelKind: "argv_position",
      codecRef: "CHANNEL_CLI_ARGV_TOKEN_V2",
      representation: "utf8_argv_token",
    },
    {
      channelKind: "json_body_pointer",
      codecRef: "CHANNEL_HTTP_BODY_CANONICAL_JSON_V2",
      representation: "canonical_json_utf8",
    },
    {
      channelKind: "path_parameter",
      codecRef: "CHANNEL_HTTP_PATH_RFC3986_V2",
      representation: "rfc3986_path_component",
    },
    {
      channelKind: "query_parameter",
      codecRef: "CHANNEL_HTTP_QUERY_RFC3986_V2",
      representation: "rfc3986_query_component",
    },
    {
      channelKind: "stdin_json_pointer",
      codecRef: "CHANNEL_CLI_STDIN_CANONICAL_JSON_V2",
      representation: "canonical_json_utf8",
    },
  ],
  responseDecoders: [
    {
      decoderRef: "DECODE_CLI_STDERR_FAILURE_JSON_V2",
      invocationKind: "cli_command",
      outcome: "failure",
      byteChannel: "stderr",
    },
    {
      decoderRef: "DECODE_CLI_STDOUT_SUCCESS_JSON_V2",
      invocationKind: "cli_command",
      outcome: "success",
      byteChannel: "stdout",
    },
    {
      decoderRef: "DECODE_HTTP_FAILURE_RESPONSE_JSON_V2",
      invocationKind: "http_request",
      outcome: "failure",
      byteChannel: "response_body",
    },
    {
      decoderRef: "DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2",
      invocationKind: "http_request",
      outcome: "success",
      byteChannel: "response_body",
    },
  ],
} as const satisfies InvocationTransportCodecCatalogHashPayloadV2;

export const InvocationTransportCodecCatalogV2Schema =
  InvocationTransportCodecCatalogV2BaseSchema.superRefine((value, context) => {
    const { catalogHash: _catalogHash, ...payload } = value;
    if (!sameCanonicalValue(
      payload,
      CODE_OWNED_CODEC_CATALOG_PAYLOAD_V2,
    )) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "INVOCATION_TRANSPORT_V2_CODEC_CATALOG_AUTHORITY_MISMATCH: catalog must equal the code-owned codec definitions",
      });
    }
    if (value.catalogHash !== hashInvocationTransportCodecCatalogV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["catalogHash"],
        message: "INVOCATION_TRANSPORT_V2_CODEC_CATALOG_HASH_MISMATCH: catalogHash must bind the exact domain-separated codec catalog payload",
      });
    }
  });

const CODE_OWNED_CODEC_CATALOG_V2 = recursivelyFreezeInvocationTransportV2(
  InvocationTransportCodecCatalogV2Schema.parse({
    ...CODE_OWNED_CODEC_CATALOG_PAYLOAD_V2,
    catalogHash: hashInvocationTransportCodecCatalogV2(
      CODE_OWNED_CODEC_CATALOG_PAYLOAD_V2,
    ),
  }),
);

export function getInvocationTransportCodecCatalogV2(): InvocationTransportCodecCatalogV2 {
  return recursivelyFreezeInvocationTransportV2(
    structuredClone(CODE_OWNED_CODEC_CATALOG_V2),
  );
}

export function invocationTransportCodecCatalogHashV2(): string {
  return CODE_OWNED_CODEC_CATALOG_V2.catalogHash;
}

const ActionInputFieldNameV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/);

function isNulFreeWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0) return false;
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

const JsonPointerV2Schema = z.string()
  .max(500)
  .refine(
    (value) => /^(?:\/(?:[^~]|~[01])*)*$/u.test(value),
    "Expected an empty or RFC 6901 JSON Pointer",
  )
  .refine(
    isNulFreeWellFormedUnicode,
    "Expected a NUL-free JSON Pointer containing only well-formed Unicode",
  );

const CliChannelV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("argv_position"),
    position: z.number().int().min(0).max(499),
  }).strict(),
  z.object({
    kind: z.literal("argv_flag"),
    flag: z.string().min(3).max(128).regex(/^--[a-z0-9][a-z0-9-]*$/u),
    style: z.enum(["separate", "equals"]),
  }).strict(),
  z.object({
    kind: z.literal("stdin_json_pointer"),
    pointer: JsonPointerV2Schema,
    containerPolicy: z.literal("object_intermediates"),
  }).strict(),
]);

const HttpChannelV2Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("path_parameter"),
    name: z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_]*$/u),
  }).strict(),
  z.object({
    kind: z.literal("query_parameter"),
    name: z.string().min(1).max(128).regex(/^[A-Za-z][A-Za-z0-9_.-]*$/u),
  }).strict(),
  z.object({
    kind: z.literal("json_body_pointer"),
    pointer: JsonPointerV2Schema,
    containerPolicy: z.literal("object_intermediates"),
  }).strict(),
]);

const InvocationInputFieldV2BaseShape = {
  actionInputRef: z.string().min(3).max(500),
  fieldName: ActionInputFieldNameV2Schema,
  valueType: InvocationTransportValueTypeV2Schema,
  required: z.literal(true),
  optionalPresence: z.literal("not_applicable"),
  entityFieldRef: EntityFieldIdSchema.nullable(),
  enumValues: z.array(z.string().min(1).max(500)).min(1).max(500).nullable(),
  valueCodecRef: InvocationTransportValueCodecRefV2Schema,
} as const;

const CliInvocationInputFieldV2Schema = z.object({
  ...InvocationInputFieldV2BaseShape,
  channel: CliChannelV2Schema,
  channelCodecRef: InvocationTransportChannelCodecRefV2Schema,
}).strict();

const HttpInvocationInputFieldV2Schema = z.object({
  ...InvocationInputFieldV2BaseShape,
  channel: HttpChannelV2Schema,
  channelCodecRef: InvocationTransportChannelCodecRefV2Schema,
}).strict();

const InvocationFailureKindV2Schema = z.enum([
  "input_validation",
  "precondition",
  "action_failure",
]);

const InvocationErrorShapeV2 = {
  errorCode: z.string().min(1).max(128).regex(/^[A-Z][A-Z0-9_]*$/u),
  codePointer: JsonPointerV2Schema,
  messagePointer: JsonPointerV2Schema,
} as const;

const CliFailureCaseV2Schema = z.object({
  kind: InvocationFailureKindV2Schema,
  exitCodes: z.array(z.number().int().min(1).max(255)).min(1).max(32),
  channel: z.literal("stderr_json"),
  ...InvocationErrorShapeV2,
}).strict();

const HttpFailureCaseV2Schema = z.object({
  kind: InvocationFailureKindV2Schema,
  statusCodes: z.array(z.number().int().min(400).max(599)).min(1).max(100),
  channel: z.literal("response_json"),
  ...InvocationErrorShapeV2,
}).strict();

export const CliInvocationResultAbiV2Schema = z.object({
  kind: z.literal("stdout_json"),
  successDecoderRef: z.literal("DECODE_CLI_STDOUT_SUCCESS_JSON_V2"),
  failureDecoderRef: z.literal("DECODE_CLI_STDERR_FAILURE_JSON_V2"),
  utf8Decoding: z.literal("fatal_exact_roundtrip"),
  jsonGrammar: z.literal("strict_single_value"),
  duplicateObjectKeys: z.literal("reject_decoded_equivalent"),
  numberPolicy: z.literal("finite_only"),
  stringPolicy: z.literal("reject_nul_and_ill_formed_unicode"),
  responseByteLimit: z.literal(1_048_576),
  maxDepth: z.literal(64),
  maxNodes: z.literal(100_000),
  maxContainerEntries: z.literal(10_000),
  successExitCodes: z.array(z.number().int().min(0).max(255)).min(1).max(32),
  valuePointer: JsonPointerV2Schema,
  failureCases: z.array(CliFailureCaseV2Schema).min(1).max(3),
}).strict();

export const HttpInvocationResultAbiV2Schema = z.object({
  kind: z.literal("response_json"),
  successDecoderRef: z.literal("DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2"),
  failureDecoderRef: z.literal("DECODE_HTTP_FAILURE_RESPONSE_JSON_V2"),
  utf8Decoding: z.literal("fatal_exact_roundtrip"),
  jsonGrammar: z.literal("strict_single_value"),
  duplicateObjectKeys: z.literal("reject_decoded_equivalent"),
  numberPolicy: z.literal("finite_only"),
  stringPolicy: z.literal("reject_nul_and_ill_formed_unicode"),
  responseByteLimit: z.literal(1_048_576),
  maxDepth: z.literal(64),
  maxNodes: z.literal(100_000),
  maxContainerEntries: z.literal(10_000),
  successStatusCodes: z.array(z.number().int().min(200).max(299)).min(1).max(100),
  valuePointer: JsonPointerV2Schema,
  failureCases: z.array(HttpFailureCaseV2Schema).min(1).max(3),
}).strict();

const ProfileBindingV2Schema = z.object({
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  profileHash: Sha256Schema,
  catalogVersion: z.literal("2.0.0"),
  catalogHash: Sha256Schema,
}).strict();

const StackPackBindingV2Schema = z.object({
  stackPackId: z.enum(["node-cli", "node-express-api"]),
  stackPackVersion: z.string().min(1).max(160),
  stackPackContentHash: Sha256Schema,
}).strict();

const RuntimeBindingV2Schema = z.object({
  invocationKind: z.enum(["cli_process", "http_service"]),
  invocationTransportSchema: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
  launcherOwner: z.literal("platform_release_manifest_v2"),
  launcherRef: z.enum(["LAUNCH_NODE_CLI_V2", "LAUNCH_NODE_EXPRESS_API_V2"]),
}).strict();

const CodecCatalogBindingV2Schema = z.object({
  schema: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2),
  catalogVersion: z.literal(INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2),
  catalogHash: Sha256Schema,
}).strict();

const EvidenceCapabilityPolicyBindingV2Schema = z.object({
  policySchema: z.literal("setfarm.product-evidence-capability-policy.v2"),
  policyVersion: z.literal("2.0.0"),
  policyHash: Sha256Schema,
}).strict();

const SemanticSourceRuleBindingV2Schema = z.object({
  catalogVersion: z.literal("1.0.0"),
  ruleSetRef: z.enum([
    "RULESET_NODE_CLI_V1",
    "RULESET_NODE_EXPRESS_API_STATELESS_V1",
  ]),
  ruleSetVersion: z.literal("1.0.0"),
  ruleSetHash: Sha256Schema,
  readiness: z.object({
    status: z.literal("shadow"),
    blockerCodes: z.array(z.enum([
      "SEMANTIC_SOURCE_GENERATED_RECEIPT_UNVERIFIED",
      "SEMANTIC_SOURCE_GENERATOR_EXECUTION_UNVERIFIED",
      "SEMANTIC_SOURCE_INVOCATION_INPUT_TRANSPORT_UNVERIFIED",
      "SEMANTIC_SOURCE_PARSER_IMPLEMENTATION_UNVERIFIED",
      "SEMANTIC_SOURCE_RELEASE_MANIFEST_UNVERIFIED",
    ])).min(1).max(16),
  }).strict(),
}).strict().superRefine((value, context) => {
  const blockers = value.readiness.blockerCodes;
  if (
    !hasUniqueStrings(blockers)
    || blockers.some((blocker, index) =>
      index > 0 && compareUtf16(blockers[index - 1]!, blocker) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["readiness", "blockerCodes"],
      message: "INVOCATION_TRANSPORT_V2_SEMANTIC_RULE_BLOCKERS_INVALID: blocker codes must be unique and canonically ordered",
    });
  }
});

const FixedHeaderV2Schema = z.object({
  name: z.enum(["accept", "content-type"]),
  value: z.literal("application/json"),
}).strict();

const InvocationInputTransportV2CommonShape = {
  schema: z.literal(INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2),
  contractVersion: z.literal(INVOCATION_INPUT_TRANSPORT_CONTRACT_VERSION_V2),
  readiness: z.literal("shadow"),
  productionUse: z.literal("forbidden"),
  productSpecHash: Sha256Schema,
  actionInvocationIntentHash: Sha256Schema,
  deliverySelectionHash: Sha256Schema,
  profileBinding: ProfileBindingV2Schema,
  stackPackBinding: StackPackBindingV2Schema,
  runtimeBinding: RuntimeBindingV2Schema,
  codecCatalogBinding: CodecCatalogBindingV2Schema,
  evidenceCapabilityPolicyBinding: EvidenceCapabilityPolicyBindingV2Schema,
  semanticSourceRuleBinding: SemanticSourceRuleBindingV2Schema,
  actionRef: ActionIdSchema,
} as const;

const CliInvocationInputTransportV2BaseSchema = z.object({
  ...InvocationInputTransportV2CommonShape,
  kind: z.literal("cli_command"),
  subcommandTokens: z.array(
    z.string().min(1).max(256).regex(/^[a-z0-9][a-z0-9_-]*$/u),
  ).max(32),
  argvAssemblyPolicy: z.literal("position_ascending_then_flag_code_unit"),
  stdinAssemblyPolicy: z.literal("object_intermediates_canonical_json_or_null"),
  fields: z.array(CliInvocationInputFieldV2Schema).max(500),
  result: CliInvocationResultAbiV2Schema,
  contractHash: Sha256Schema,
}).strict();

const HttpInvocationInputTransportV2BaseSchema = z.object({
  ...InvocationInputTransportV2CommonShape,
  kind: z.literal("http_request"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  routeRef: RouteIdSchema,
  routeTemplate: z.string().min(1).max(500),
  queryAssemblyPolicy: z.literal("parameter_name_code_unit_order"),
  bodyAssemblyPolicy: z.literal("object_intermediates_canonical_json_or_null"),
  fixedHeaders: z.array(FixedHeaderV2Schema).min(1).max(2),
  redirectPolicy: z.literal("error"),
  fields: z.array(HttpInvocationInputFieldV2Schema).max(500),
  result: HttpInvocationResultAbiV2Schema,
  contractHash: Sha256Schema,
}).strict();

export type CliInvocationInputTransportV2 = z.infer<
  typeof CliInvocationInputTransportV2BaseSchema
>;
export type HttpInvocationInputTransportV2 = z.infer<
  typeof HttpInvocationInputTransportV2BaseSchema
>;
export type InvocationInputTransportV2 =
  | CliInvocationInputTransportV2
  | HttpInvocationInputTransportV2;
export type InvocationInputTransportHashPayloadV2 =
  | Omit<CliInvocationInputTransportV2, "contractHash">
  | Omit<HttpInvocationInputTransportV2, "contractHash">;

export function hashInvocationInputTransportV2(
  value: InvocationInputTransportV2 | InvocationInputTransportHashPayloadV2,
): string {
  const payload = { ...value } as Record<string, unknown>;
  delete payload.contractHash;
  return hashCanonicalJson({
    schema: TRANSPORT_HASH_DOMAIN_V2,
    transport: payload,
  });
}

const VALUE_CODEC_BY_TYPE_V2 = Object.freeze({
  string: "VALUE_STRING_EXACT_V2",
  number: "VALUE_NUMBER_FINITE_CANONICAL_JSON_V2",
  boolean: "VALUE_BOOLEAN_CANONICAL_JSON_V2",
  enum: "VALUE_ENUM_EXACT_V2",
  object: "VALUE_OBJECT_CANONICAL_JSON_V2",
  array: "VALUE_ARRAY_CANONICAL_JSON_V2",
} as const);

const CHANNEL_CODEC_BY_KIND_V2 = Object.freeze({
  argv_position: "CHANNEL_CLI_ARGV_TOKEN_V2",
  argv_flag: "CHANNEL_CLI_ARGV_TOKEN_V2",
  stdin_json_pointer: "CHANNEL_CLI_STDIN_CANONICAL_JSON_V2",
  path_parameter: "CHANNEL_HTTP_PATH_RFC3986_V2",
  query_parameter: "CHANNEL_HTTP_QUERY_RFC3986_V2",
  json_body_pointer: "CHANNEL_HTTP_BODY_CANONICAL_JSON_V2",
} as const);

export function invocationTransportValueCodecRefV2(
  valueType: InvocationTransportValueTypeV2,
): z.infer<typeof InvocationTransportValueCodecRefV2Schema> {
  return VALUE_CODEC_BY_TYPE_V2[valueType];
}

export function invocationTransportChannelCodecRefV2(
  channelKind: keyof typeof CHANNEL_CODEC_BY_KIND_V2,
): z.infer<typeof InvocationTransportChannelCodecRefV2Schema> {
  return CHANNEL_CODEC_BY_KIND_V2[channelKind];
}

function pointerSegments(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

function pointerOverlaps(left: string, right: string): boolean {
  const leftSegments = pointerSegments(left);
  const rightSegments = pointerSegments(right);
  const common = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < common; index += 1) {
    if (leftSegments[index] !== rightSegments[index]) return false;
  }
  return true;
}

function isSafeHttpRouteTemplate(value: string): boolean {
  if (value === "/") return true;
  if (!value.startsWith("/") || value.startsWith("//") || value.endsWith("/")) return false;
  if (/[\\?#%\u0000-\u001f\u007f]/u.test(value)) return false;
  return value.slice(1).split("/").every((segment) =>
    /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u.test(segment)
    || /^:[A-Za-z][A-Za-z0-9_]*$/u.test(segment));
}

function addCommonTransportIssues(
  value: InvocationInputTransportV2,
  context: z.RefinementCtx,
): void {
  if (value.codecCatalogBinding.catalogHash !== CODE_OWNED_CODEC_CATALOG_V2.catalogHash) {
    context.addIssue({
      code: "custom",
      path: ["codecCatalogBinding", "catalogHash"],
      message: "INVOCATION_TRANSPORT_V2_CODEC_CATALOG_BINDING_MISMATCH: transport must bind the exact code-owned codec catalog",
    });
  }
  const fieldNames = value.fields.map((field) => field.fieldName);
  if (
    !hasUniqueStrings(fieldNames)
    || fieldNames.some((fieldName, index) =>
      index > 0 && compareUtf16(fieldNames[index - 1]!, fieldName) >= 0)
  ) {
    context.addIssue({
      code: "custom",
      path: ["fields"],
      message: "INVOCATION_TRANSPORT_V2_FIELD_ORDER_INVALID: fields must be unique and canonically ordered by fieldName",
    });
  }
  value.fields.forEach((field, fieldIndex) => {
    if (field.actionInputRef !== `${value.actionRef}.${field.fieldName}`) {
      context.addIssue({
        code: "custom",
        path: ["fields", fieldIndex, "actionInputRef"],
        message: "INVOCATION_TRANSPORT_V2_ACTION_INPUT_REF_MISMATCH: actionInputRef must derive from actionRef and fieldName",
      });
    }
    if (field.valueCodecRef !== VALUE_CODEC_BY_TYPE_V2[field.valueType]) {
      context.addIssue({
        code: "custom",
        path: ["fields", fieldIndex, "valueCodecRef"],
        message: "INVOCATION_TRANSPORT_V2_VALUE_CODEC_MISMATCH: field value codec must equal the code-owned value-type codec",
      });
    }
    if (field.channelCodecRef !== CHANNEL_CODEC_BY_KIND_V2[field.channel.kind]) {
      context.addIssue({
        code: "custom",
        path: ["fields", fieldIndex, "channelCodecRef"],
        message: "INVOCATION_TRANSPORT_V2_CHANNEL_CODEC_MISMATCH: field channel codec must equal the code-owned channel codec",
      });
    }
    if (field.valueType === "enum") {
      if (
        field.entityFieldRef === null
        || field.enumValues === null
        || !hasUniqueStrings(field.enumValues)
      ) {
        context.addIssue({
          code: "custom",
          path: ["fields", fieldIndex, "enumValues"],
          message: "INVOCATION_TRANSPORT_V2_ENUM_AUTHORITY_INVALID: enum fields require an entity field and unique exact enum values",
        });
      }
    } else if (field.enumValues !== null) {
      context.addIssue({
        code: "custom",
        path: ["fields", fieldIndex, "enumValues"],
        message: "INVOCATION_TRANSPORT_V2_ENUM_VALUES_FORBIDDEN: non-enum fields cannot carry enum values",
      });
    }
  });
  if (value.contractHash !== hashInvocationInputTransportV2(value)) {
    context.addIssue({
      code: "custom",
      path: ["contractHash"],
      message: "INVOCATION_TRANSPORT_V2_CONTRACT_HASH_MISMATCH: contractHash must bind the exact domain-separated transport payload",
    });
  }
}

function addPointerCollisionIssues(
  fields: InvocationInputTransportV2["fields"],
  pointerKind: "stdin_json_pointer" | "json_body_pointer",
  context: z.RefinementCtx,
): void {
  const pointers = fields.flatMap((field, index) =>
    field.channel.kind === pointerKind
      ? [{ index, pointer: field.channel.pointer }]
      : []);
  for (let left = 0; left < pointers.length; left += 1) {
    for (let right = left + 1; right < pointers.length; right += 1) {
      if (!pointerOverlaps(pointers[left]!.pointer, pointers[right]!.pointer)) continue;
      context.addIssue({
        code: "custom",
        path: ["fields", pointers[right]!.index, "channel", "pointer"],
        message: "INVOCATION_TRANSPORT_V2_JSON_POINTER_COLLISION: JSON pointer channels must be pairwise disjoint",
      });
    }
  }
}

function addResultCodeIssues(
  value: InvocationInputTransportV2,
  context: z.RefinementCtx,
): void {
  const result = value.result;
  const successCodes = "successExitCodes" in result
    ? result.successExitCodes
    : result.successStatusCodes;
  if (
    !hasUniqueStrings(successCodes.map(String))
    || successCodes.some((code, index) => index > 0 && successCodes[index - 1]! >= code)
    || ("successStatusCodes" in result && successCodes.some((code) => code === 204 || code === 205))
  ) {
    context.addIssue({
      code: "custom",
      path: ["result"],
      message: "INVOCATION_TRANSPORT_V2_SUCCESS_CODES_INVALID: success codes must be unique and ascending",
    });
  }
  const failureCodes: number[] = [];
  const failureKinds: string[] = [];
  const errorCodes: string[] = [];
  result.failureCases.forEach((failure, failureIndex) => {
    const codes = "exitCodes" in failure ? failure.exitCodes : failure.statusCodes;
    if (
      !hasUniqueStrings(codes.map(String))
      || codes.some((code, index) => index > 0 && codes[index - 1]! >= code)
    ) {
      context.addIssue({
        code: "custom",
        path: ["result", "failureCases", failureIndex],
        message: "INVOCATION_TRANSPORT_V2_FAILURE_CODES_INVALID: failure codes must be unique and ascending",
      });
    }
    if (pointerOverlaps(failure.codePointer, failure.messagePointer)) {
      context.addIssue({
        code: "custom",
        path: ["result", "failureCases", failureIndex],
        message: "INVOCATION_TRANSPORT_V2_ERROR_POINTER_COLLISION: error code and message pointers must be disjoint",
      });
    }
    failureCodes.push(...codes);
    failureKinds.push(failure.kind);
    errorCodes.push(failure.errorCode);
  });
  if (
    !hasUniqueStrings(failureCodes.map(String))
    || !hasUniqueStrings(failureKinds)
    || !hasUniqueStrings(errorCodes)
  ) {
    context.addIssue({
      code: "custom",
      path: ["result", "failureCases"],
      message: "INVOCATION_TRANSPORT_V2_FAILURE_ABI_COLLISION: failure kinds, error codes, and status/exit codes must be unique",
    });
  }
  if ("successExitCodes" in result) {
    const successSet = new Set(result.successExitCodes);
    if (failureCodes.some((code) => successSet.has(code))) {
      context.addIssue({
        code: "custom",
        path: ["result"],
        message: "INVOCATION_TRANSPORT_V2_RESULT_CODE_COLLISION: CLI success and failure exit codes must be disjoint",
      });
    }
  }
}

const CliInvocationInputTransportV2Schema = CliInvocationInputTransportV2BaseSchema
  .superRefine((value, context) => {
    addCommonTransportIssues(value, context);
    addResultCodeIssues(value, context);
    if (
      value.profileBinding.profileId !== "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      || value.stackPackBinding.stackPackId !== "node-cli"
      || value.runtimeBinding.invocationKind !== "cli_process"
      || value.runtimeBinding.launcherRef !== "LAUNCH_NODE_CLI_V2"
      || value.semanticSourceRuleBinding.ruleSetRef !== "RULESET_NODE_CLI_V1"
    ) {
      context.addIssue({
        code: "custom",
        path: ["profileBinding"],
        message: "INVOCATION_TRANSPORT_V2_CLI_PROFILE_MISMATCH: CLI transport must bind the exact Node CLI profile, stack pack, runtime kind, and launcher ref",
      });
    }
    const positions = value.fields.flatMap((field, index) =>
      field.channel.kind === "argv_position"
        ? [{ index, position: field.channel.position }]
        : []).sort((left, right) => left.position - right.position);
    positions.forEach((entry, expectedPosition) => {
      if (entry.position === expectedPosition) return;
      context.addIssue({
        code: "custom",
        path: ["fields", entry.index, "channel", "position"],
        message: "INVOCATION_TRANSPORT_V2_ARGV_POSITION_GAP: positional indexes must be contiguous from zero",
      });
    });
    const flags = value.fields.flatMap((field) =>
      field.channel.kind === "argv_flag" ? [field.channel.flag] : []);
    if (!hasUniqueStrings(flags)) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "INVOCATION_TRANSPORT_V2_ARGV_FLAG_COLLISION: argv flags must be unique",
      });
    }
    addPointerCollisionIssues(value.fields, "stdin_json_pointer", context);
  });

const HttpInvocationInputTransportV2Schema = HttpInvocationInputTransportV2BaseSchema
  .superRefine((value, context) => {
    addCommonTransportIssues(value, context);
    addResultCodeIssues(value, context);
    if (
      value.profileBinding.profileId !== "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
      || value.stackPackBinding.stackPackId !== "node-express-api"
      || value.runtimeBinding.invocationKind !== "http_service"
      || value.runtimeBinding.launcherRef !== "LAUNCH_NODE_EXPRESS_API_V2"
      || value.semanticSourceRuleBinding.ruleSetRef !== "RULESET_NODE_EXPRESS_API_STATELESS_V1"
    ) {
      context.addIssue({
        code: "custom",
        path: ["profileBinding"],
        message: "INVOCATION_TRANSPORT_V2_HTTP_PROFILE_MISMATCH: HTTP transport must bind the exact Node Express API profile, stack pack, runtime kind, and launcher ref",
      });
    }
    if (!isSafeHttpRouteTemplate(value.routeTemplate)) {
      context.addIssue({
        code: "custom",
        path: ["routeTemplate"],
        message: "INVOCATION_TRANSPORT_V2_HTTP_ROUTE_TEMPLATE_UNSAFE: route template must be one safe origin-relative path with exact named parameters",
      });
    }
    const hasBody = value.fields.some((field) => field.channel.kind === "json_body_pointer");
    const expectedHeaders = hasBody
      ? [
        { name: "accept", value: "application/json" },
        { name: "content-type", value: "application/json" },
      ]
      : [{ name: "accept", value: "application/json" }];
    if (!sameCanonicalValue(value.fixedHeaders, expectedHeaders)) {
      context.addIssue({
        code: "custom",
        path: ["fixedHeaders"],
        message: "INVOCATION_TRANSPORT_V2_FIXED_HEADERS_MISMATCH: fixed headers must equal the code-owned JSON request policy",
      });
    }
    if (value.method === "GET" && hasBody) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "INVOCATION_TRANSPORT_V2_GET_BODY_FORBIDDEN: GET transport cannot carry JSON body fields",
      });
    }
    const pathNames = value.fields.flatMap((field) =>
      field.channel.kind === "path_parameter" ? [field.channel.name] : []);
    const expectedPathNames = value.routeTemplate.split("/").flatMap((segment) => {
      const match = /^:([A-Za-z][A-Za-z0-9_]*)$/u.exec(segment);
      return match ? [match[1]!] : [];
    });
    if (
      !hasUniqueStrings(pathNames)
      || !hasUniqueStrings(expectedPathNames)
      || !sameCanonicalValue([...pathNames].sort(compareUtf16), [...expectedPathNames].sort(compareUtf16))
    ) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "INVOCATION_TRANSPORT_V2_PATH_PARAMETER_CLOSURE: path channels must cover every and only route-template parameter",
      });
    }
    const queryNames = value.fields.flatMap((field) =>
      field.channel.kind === "query_parameter" ? [field.channel.name] : []);
    if (!hasUniqueStrings(queryNames)) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "INVOCATION_TRANSPORT_V2_QUERY_PARAMETER_COLLISION: query parameter names must be unique",
      });
    }
    addPointerCollisionIssues(value.fields, "json_body_pointer", context);
  });

export const InvocationInputTransportV2Schema = z.discriminatedUnion("kind", [
  CliInvocationInputTransportV2Schema,
  HttpInvocationInputTransportV2Schema,
]);
