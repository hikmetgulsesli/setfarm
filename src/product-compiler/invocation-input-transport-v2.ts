import { Buffer } from "node:buffer";
import {
  isProxy,
  isSharedArrayBuffer,
  isUint8Array,
} from "node:util/types";

import { z } from "zod";

import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
  type CanonicalJsonBoundedLimits,
} from "./bounded-canonical-json.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import {
  ProductDeliverySelectionV2Schema,
  ProductDeliverySelectionVerificationErrorV2,
  hashProductDeliverySelectionV2,
  verifyProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "./product-delivery-profile-catalog-v2.js";
import { ActionIdSchema } from "./schemas/common-v1.js";
import {
  ProductSpecV2Schema,
  type ProductSpecV2,
} from "./schemas/product-spec-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
  INVOCATION_INPUT_TRANSPORT_CONTRACT_VERSION_V2,
  INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2,
  INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2,
  InvocationInputTransportV2Schema,
  hashInvocationInputTransportV2,
  invocationTransportChannelCodecRefV2,
  invocationTransportCodecCatalogHashV2,
  invocationTransportValueCodecRefV2,
  recursivelyFreezeInvocationTransportV2,
  type InvocationInputTransportHashPayloadV2,
  type InvocationInputTransportV2,
  type InvocationTransportValueTypeV2,
} from "./schemas/invocation-input-transport-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_SET_ARTIFACT_TYPE_V2,
  INVOCATION_INPUT_TRANSPORT_SET_BOUNDED_WORK_LIMITS_V2,
  INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2,
  INVOCATION_INPUT_TRANSPORT_SET_VERSION_V2,
  InvocationInputTransportSetV2Schema,
  hashInvocationInputTransportMembershipV2,
  hashInvocationInputTransportSetV2,
  recursivelyFreezeInvocationInputTransportSetV2,
  type InvocationInputTransportSetV2,
} from "./schemas/invocation-input-transport-set-v2.js";

const COMPILER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const VERIFIER_INPUT_MAX_BYTES = 12 * 1024 * 1024;
const SET_VERIFIER_INPUT_MAX_BYTES = 16 * 1024 * 1024;
const ENCODER_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const ENCODED_REQUEST_MAX_BYTES = 8 * 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

/*
 * Compiler admission already spends the default node/work authority on the
 * ProductSpec + selection envelope. Set verification adds one freshly compiled
 * artifact whose canonical payload is capped independently at 3 MiB. These
 * limits are deliberately compositional: every compiler-admitted authority and
 * every compiler-produced set remain verifier-admitted, while hostile combined
 * inputs are still finitely bounded.
 */
const SET_VERIFIER_BOUNDED_WORK_LIMITS = Object.freeze({
  maxDepth: Math.max(
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth,
    INVOCATION_INPUT_TRANSPORT_SET_BOUNDED_WORK_LIMITS_V2.maxDepth + 1,
  ),
  maxNodes:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxNodes
    + INVOCATION_INPUT_TRANSPORT_SET_BOUNDED_WORK_LIMITS_V2.maxNodes
    + 4,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxWorkUnits
    + INVOCATION_INPUT_TRANSPORT_SET_BOUNDED_WORK_LIMITS_V2.maxWorkUnits
    + (1024 * 1024),
});

const RESPONSE_DECODER_POLICY_V2 = Object.freeze({
  utf8Decoding: "fatal_exact_roundtrip" as const,
  jsonGrammar: "strict_single_value" as const,
  duplicateObjectKeys: "reject_decoded_equivalent" as const,
  numberPolicy: "finite_only" as const,
  stringPolicy: "reject_nul_and_ill_formed_unicode" as const,
  responseByteLimit: 1_048_576 as const,
  maxDepth: 64 as const,
  maxNodes: 100_000 as const,
  maxContainerEntries: 10_000 as const,
});
const TYPED_ARRAY_PROTOTYPE = Object.getPrototypeOf(Uint8Array.prototype) as object;
const TYPED_ARRAY_BUFFER_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "buffer",
)!.get!;
const TYPED_ARRAY_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteLength",
)!.get!;
const TYPED_ARRAY_BYTE_OFFSET_GETTER = Object.getOwnPropertyDescriptor(
  TYPED_ARRAY_PROTOTYPE,
  "byteOffset",
)!.get!;
const TYPED_ARRAY_SET = Uint8Array.prototype.set;
const BUFFER_EQUALS = Buffer.prototype.equals;
const ARRAY_BUFFER_RESIZABLE_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "resizable",
)?.get;

const CompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  actionRef: ActionIdSchema,
}).strict();

const SetCompilerInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
}).strict();

const SetVerificationInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  candidate: z.unknown(),
}).strict();

const VerificationInputV2Schema = z.object({
  productSpec: z.unknown(),
  deliverySelection: z.unknown(),
  actionRef: ActionIdSchema,
  candidate: z.unknown(),
}).strict();

const EncoderInputV2Schema = z.object({
  contract: z.unknown(),
  inputValues: z.record(z.string().min(1).max(160), z.unknown()),
}).strict();

const UnsupportedInputPreflightV2Schema = z.object({
  actions: z.array(z.object({
    id: z.string(),
    input: z.object({
      fields: z.array(z.object({
        name: z.string(),
        valueType: z.string(),
        required: z.boolean(),
      }).passthrough()),
    }).passthrough(),
  }).passthrough()),
}).passthrough();

export type InvocationInputTransportCompilationDiagnosticCodeV2 =
  | "INVOCATION_TRANSPORT_V2_INPUT_INVALID"
  | "INVOCATION_TRANSPORT_V2_PRODUCT_SPEC_INVALID"
  | "INVOCATION_TRANSPORT_V2_ACTION_UNRESOLVED"
  | "INVOCATION_TRANSPORT_V2_INVOCATION_INTERFACE_UNSUPPORTED"
  | "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_INVALID"
  | "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH"
  | "INVOCATION_TRANSPORT_V2_PROFILE_MISMATCH"
  | "INVOCATION_TRANSPORT_V2_PROFILE_UNSUPPORTED_INPUT_TYPE"
  | "INVOCATION_TRANSPORT_V2_ENTITY_FIELD_UNRESOLVED"
  | "INVOCATION_TRANSPORT_V2_ENTITY_VALUE_TYPE_MISMATCH"
  | "INVOCATION_TRANSPORT_V2_ENUM_AUTHORITY_INVALID"
  | "INVOCATION_TRANSPORT_V2_EVIDENCE_VALUE_INVALID"
  | "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID";

export type InvocationInputTransportCompilationDiagnosticV2 = Readonly<{
  code: InvocationInputTransportCompilationDiagnosticCodeV2;
  path: string;
  message: string;
}>;

export type InvocationInputTransportCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      contract: Readonly<InvocationInputTransportV2>;
      contractHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly InvocationInputTransportCompilationDiagnosticV2[];
    }>;

export type InvocationInputTransportSetCompilationResultV2 =
  | Readonly<{
      status: "shadow_compiled";
      diagnostics: readonly [];
      contractSet: Readonly<InvocationInputTransportSetV2>;
      membershipHash: string;
      contractSetHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly InvocationInputTransportCompilationDiagnosticV2[];
    }>;

function boundedSnapshot(
  value: unknown,
  maxBytes: number,
  workLimits: Omit<CanonicalJsonBoundedLimits, "maxBytes"> =
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
): unknown {
  const bytes = canonicalJsonBytesBounded(value, {
    maxBytes,
    ...workLimits,
  });
  return JSON.parse(bytes.toString("utf8"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid bounded canonical JSON input";
}

function diagnostic(
  code: InvocationInputTransportCompilationDiagnosticCodeV2,
  path: string,
  message: string,
): InvocationInputTransportCompilationDiagnosticV2 {
  return Object.freeze({
    code,
    path: path.slice(0, 500),
    message: message.slice(0, 1_000),
  });
}

function rejected(
  diagnostics: readonly InvocationInputTransportCompilationDiagnosticV2[],
): InvocationInputTransportCompilationResultV2 {
  return recursivelyFreezeInvocationTransportV2({
    status: "rejected" as const,
    diagnostics: [...diagnostics].slice(0, MAX_DIAGNOSTICS),
  });
}

function singleRejected(
  code: InvocationInputTransportCompilationDiagnosticCodeV2,
  path: string,
  message: string,
): InvocationInputTransportCompilationResultV2 {
  return rejected([diagnostic(code, path, message)]);
}

function diagnosticsFromZod(
  code: InvocationInputTransportCompilationDiagnosticCodeV2,
  error: z.ZodError,
  pathPrefix = "",
): readonly InvocationInputTransportCompilationDiagnosticV2[] {
  const retained = error.issues.slice(0, MAX_DIAGNOSTICS - 1).map((issue) => diagnostic(
    code,
    `${pathPrefix}/${issue.path.map(String).join("/")}`.replace(/\/$/u, "") || "/",
    issue.message,
  ));
  if (error.issues.length >= MAX_DIAGNOSTICS) {
    retained.push(diagnostic(
      code,
      pathPrefix || "/",
      `Validation produced ${error.issues.length} issues; retained the first ${MAX_DIAGNOSTICS - 1}`,
    ));
  }
  return Object.freeze(retained);
}

function unsupportedInputDiagnostic(
  productSpec: unknown,
  actionRef: string,
): InvocationInputTransportCompilationDiagnosticV2 | null {
  const parsed = UnsupportedInputPreflightV2Schema.safeParse(productSpec);
  if (!parsed.success) return null;
  const matches = parsed.data.actions.filter((action) => action.id === actionRef);
  if (matches.length !== 1) return null;
  const action = matches[0]!;
  for (let fieldIndex = 0; fieldIndex < action.input.fields.length; fieldIndex += 1) {
    const field = action.input.fields[fieldIndex]!;
    if (!field.required) {
      return diagnostic(
        "INVOCATION_TRANSPORT_V2_PROFILE_UNSUPPORTED_INPUT_TYPE",
        `/productSpec/actions/${parsed.data.actions.indexOf(action)}/input/fields/${fieldIndex}/required`,
        `ProfileV2 invocation transport does not define optional/default/absence semantics for ${actionRef}.${field.name}`,
      );
    }
    if (field.valueType === "date" || field.valueType === "datetime") {
      return diagnostic(
        "INVOCATION_TRANSPORT_V2_PROFILE_UNSUPPORTED_INPUT_TYPE",
        `/productSpec/actions/${parsed.data.actions.indexOf(action)}/input/fields/${fieldIndex}/valueType`,
        `ProfileV2 invocation transport does not define external ${field.valueType} serialization/normalization semantics for ${actionRef}.${field.name}`,
      );
    }
  }
  return null;
}

export function hashInvocationTransportActionInvocationIntentV2(
  actionInvocationIntent: unknown,
): string {
  return hashCanonicalJson({
    schema: "setfarm.action-invocation-intent-hash.v2",
    actionInvocationIntent,
  });
}

function exactSelection(
  productSpec: ProductSpecV2,
  candidateInput: unknown,
):
  | Readonly<{ status: "verified"; selection: ProductDeliverySelectionV2 }>
  | Readonly<{
      status: "rejected";
      diagnostic: InvocationInputTransportCompilationDiagnosticV2;
    }> {
  const candidate = ProductDeliverySelectionV2Schema.safeParse(candidateInput);
  if (!candidate.success) {
    return {
      status: "rejected",
      diagnostic: diagnostic(
        "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_INVALID",
        "/deliverySelection",
        candidate.error.issues[0]?.message ?? "Delivery selection is invalid",
      ),
    };
  }
  try {
    const selection = verifyProductDeliverySelectionV2({
      productSpec,
      requestedStackPackId: candidate.data.requestedStackPackId,
      candidate: candidate.data,
    });
    return { status: "verified", selection };
  } catch (error) {
    const code = error instanceof ProductDeliverySelectionVerificationErrorV2
      && error.code === "PRODUCT_DELIVERY_V2_SELECTION_INVALID"
      ? "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_INVALID"
      : "INVOCATION_TRANSPORT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH";
    return {
      status: "rejected",
      diagnostic: diagnostic(code, "/deliverySelection", errorMessage(error)),
    };
  }
}

function profileMatchesAction(
  selection: ProductDeliverySelectionV2,
  kind: "cli_command" | "http_request",
): boolean {
  if (kind === "cli_command") {
    return selection.profileId === "PROFILE_NODE_CLI_STATELESS_EXACT_V2"
      && selection.requestedStackPackId === "node-cli"
      && selection.runtime.invocationKind === "cli_process"
      && selection.runtime.launcherRef === "LAUNCH_NODE_CLI_V2";
  }
  return selection.profileId === "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"
    && selection.requestedStackPackId === "node-express-api"
    && selection.runtime.invocationKind === "http_service"
    && selection.runtime.launcherRef === "LAUNCH_NODE_EXPRESS_API_V2";
}

function compileFields(
  productSpec: ProductSpecV2,
  action: ProductSpecV2["actions"][number],
  entityFieldById: ReadonlyMap<
    string,
    ProductSpecV2["entities"][number]["fields"][number]
  > = new Map(
    productSpec.entities.flatMap((entity) =>
      entity.fields.map((field) => [field.id, field] as const)),
  ),
):
  | Readonly<{ status: "compiled"; fields: readonly Record<string, unknown>[] }>
  | Readonly<{
      status: "rejected";
      diagnostic: InvocationInputTransportCompilationDiagnosticV2;
    }> {
  if (
    action.invocationInterface.kind !== "cli_command"
    && action.invocationInterface.kind !== "http_request"
  ) {
    return {
      status: "rejected",
      diagnostic: diagnostic(
        "INVOCATION_TRANSPORT_V2_INVOCATION_INTERFACE_UNSUPPORTED",
        "/productSpec/actions/invocationInterface/kind",
        `Invocation transport cannot compile ${action.invocationInterface.kind}`,
      ),
    };
  }
  const bindingByName = new Map(
    action.invocationInterface.fieldBindings.map((binding) => [binding.fieldName, binding]),
  );
  const fields: Record<string, unknown>[] = [];
  for (const field of [...action.input.fields].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    if (!field.required || field.valueType === "date" || field.valueType === "datetime") {
      return {
        status: "rejected",
        diagnostic: diagnostic(
          "INVOCATION_TRANSPORT_V2_PROFILE_UNSUPPORTED_INPUT_TYPE",
          `/productSpec/actions/${action.id}/input/fields/${field.name}`,
          !field.required
            ? `ProfileV2 invocation transport does not define optional/default/absence semantics for ${action.id}.${field.name}`
            : `ProfileV2 invocation transport does not define external ${field.valueType} serialization/normalization semantics for ${action.id}.${field.name}`,
        ),
      };
    }
    const binding = bindingByName.get(field.name);
    if (!binding) {
      return {
        status: "rejected",
        diagnostic: diagnostic(
          "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID",
          `/productSpec/actions/${action.id}/invocationInterface/fieldBindings`,
          `Invocation interface does not bind exact input ${field.name}`,
        ),
      };
    }
    const entityField = field.entityFieldRef
      ? entityFieldById.get(field.entityFieldRef)
      : undefined;
    if (field.entityFieldRef && !entityField) {
      return {
        status: "rejected",
        diagnostic: diagnostic(
          "INVOCATION_TRANSPORT_V2_ENTITY_FIELD_UNRESOLVED",
          `/productSpec/actions/${action.id}/input/fields/${field.name}/entityFieldRef`,
          `Action input ${action.id}.${field.name} references absent entity field ${field.entityFieldRef}`,
        ),
      };
    }
    if (entityField && entityField.valueType !== field.valueType) {
      return {
        status: "rejected",
        diagnostic: diagnostic(
          "INVOCATION_TRANSPORT_V2_ENTITY_VALUE_TYPE_MISMATCH",
          `/productSpec/actions/${action.id}/input/fields/${field.name}/valueType`,
          `Action input ${action.id}.${field.name} is ${field.valueType}, but ${entityField.id} is ${entityField.valueType}`,
        ),
      };
    }
    if (
      field.valueType === "enum"
      && (
        !entityField
        || entityField.valueType !== "enum"
        || !entityField.enumValues
        || new Set(entityField.enumValues).size !== entityField.enumValues.length
      )
    ) {
      return {
        status: "rejected",
        diagnostic: diagnostic(
          "INVOCATION_TRANSPORT_V2_ENUM_AUTHORITY_INVALID",
          `/productSpec/actions/${action.id}/input/fields/${field.name}`,
          `Enum input ${action.id}.${field.name} requires one exact entity-field enum authority`,
        ),
      };
    }
    const valueType = field.valueType as InvocationTransportValueTypeV2;
    fields.push({
      actionInputRef: `${action.id}.${field.name}`,
      fieldName: field.name,
      valueType,
      required: true,
      optionalPresence: binding.optionalPresence,
      entityFieldRef: field.entityFieldRef ?? null,
      enumValues: valueType === "enum" ? [...entityField!.enumValues!] : null,
      valueCodecRef: invocationTransportValueCodecRefV2(valueType),
      channel: structuredClone(binding.channel),
      channelCodecRef: invocationTransportChannelCodecRefV2(binding.channel.kind),
    });
  }
  return { status: "compiled", fields };
}

function commonHashPayload(
  selection: ProductDeliverySelectionV2,
  action: ProductSpecV2["actions"][number],
) {
  return {
    schema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
    contractVersion: INVOCATION_INPUT_TRANSPORT_CONTRACT_VERSION_V2,
    readiness: "shadow" as const,
    productionUse: "forbidden" as const,
    productSpecHash: selection.productSpecHash,
    actionInvocationIntentHash: hashInvocationTransportActionInvocationIntentV2(
      action.invocationInterface,
    ),
    deliverySelectionHash: hashProductDeliverySelectionV2(selection),
    profileBinding: {
      profileId: selection.profileId,
      profileHash: selection.profileHash,
      catalogVersion: selection.catalogVersion,
      catalogHash: selection.catalogHash,
    },
    stackPackBinding: structuredClone(selection.stackPackBinding),
    runtimeBinding: structuredClone(selection.runtime),
    codecCatalogBinding: {
      schema: INVOCATION_TRANSPORT_CODEC_CATALOG_SCHEMA_V2,
      catalogVersion: INVOCATION_TRANSPORT_CODEC_CATALOG_VERSION_V2,
      catalogHash: invocationTransportCodecCatalogHashV2(),
    },
    evidenceCapabilityPolicyBinding: structuredClone(selection.evidenceCapabilities),
    semanticSourceRuleBinding: structuredClone(selection.semanticSourceRules),
    actionRef: action.id,
  };
}

function compileFromVerifiedAuthority(
  productSpec: ProductSpecV2,
  selection: ProductDeliverySelectionV2,
  action: ProductSpecV2["actions"][number],
  entityFieldById?: ReadonlyMap<string, ProductSpecV2["entities"][number]["fields"][number]>,
): InvocationInputTransportCompilationResultV2 {
  if (
    action.invocationInterface.kind !== "cli_command"
    && action.invocationInterface.kind !== "http_request"
  ) {
    return singleRejected(
      "INVOCATION_TRANSPORT_V2_INVOCATION_INTERFACE_UNSUPPORTED",
      `/productSpec/actions/${productSpec.actions.indexOf(action)}/invocationInterface/kind`,
      `InvocationInputTransportV2 supports only cli_command and http_request; observed ${action.invocationInterface.kind}`,
    );
  }
  if (!profileMatchesAction(selection, action.invocationInterface.kind)) {
    return singleRejected(
      "INVOCATION_TRANSPORT_V2_PROFILE_MISMATCH",
      "/deliverySelection/profileId",
      `Action interface ${action.invocationInterface.kind} does not match exact selected profile ${selection.profileId}`,
    );
  }

  const compiledFields = compileFields(
    productSpec,
    action,
    entityFieldById,
  );
  if (compiledFields.status === "rejected") {
    return rejected([compiledFields.diagnostic]);
  }
  const common = commonHashPayload(selection, action);
  let hashPayload: InvocationInputTransportHashPayloadV2;
  if (action.invocationInterface.kind === "cli_command") {
    hashPayload = {
      ...common,
      kind: "cli_command",
      subcommandTokens: [...action.invocationInterface.subcommandTokens],
      argvAssemblyPolicy: "position_ascending_then_flag_code_unit",
      stdinAssemblyPolicy: "object_intermediates_canonical_json_or_null",
      fields: compiledFields.fields,
      result: {
        ...structuredClone(action.invocationInterface.result),
        successDecoderRef: "DECODE_CLI_STDOUT_SUCCESS_JSON_V2",
        failureDecoderRef: "DECODE_CLI_STDERR_FAILURE_JSON_V2",
        ...RESPONSE_DECODER_POLICY_V2,
      },
    } as InvocationInputTransportHashPayloadV2;
  } else {
    const invocationInterface = action.invocationInterface;
    const route = productSpec.routes.find((candidate) =>
      candidate.id === invocationInterface.routeRef)!;
    const hasBody = invocationInterface.fieldBindings.some((binding) =>
      binding.channel.kind === "json_body_pointer");
    hashPayload = {
      ...common,
      kind: "http_request",
      method: invocationInterface.method,
      routeRef: invocationInterface.routeRef,
      routeTemplate: route.path,
      queryAssemblyPolicy: "parameter_name_code_unit_order",
      bodyAssemblyPolicy: "object_intermediates_canonical_json_or_null",
      fixedHeaders: hasBody
        ? [
          { name: "accept", value: "application/json" },
          { name: "content-type", value: "application/json" },
        ]
        : [{ name: "accept", value: "application/json" }],
      redirectPolicy: "error",
      fields: compiledFields.fields,
      result: {
        ...structuredClone(invocationInterface.result),
        successDecoderRef: "DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2",
        failureDecoderRef: "DECODE_HTTP_FAILURE_RESPONSE_JSON_V2",
        ...RESPONSE_DECODER_POLICY_V2,
      },
    } as InvocationInputTransportHashPayloadV2;
  }

  const contractResult = InvocationInputTransportV2Schema.safeParse({
    ...hashPayload,
    contractHash: hashInvocationInputTransportV2(hashPayload),
  });
  if (!contractResult.success) {
    return rejected(diagnosticsFromZod(
      "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID",
      contractResult.error,
      "/contract",
    ));
  }
  const contract = recursivelyFreezeInvocationTransportV2(contractResult.data);
  try {
    encodeInvocationRequestV2({
      contract,
      inputValues: action.evidenceScenario.targetInputValues,
    });
  } catch (error) {
    return singleRejected(
      "INVOCATION_TRANSPORT_V2_EVIDENCE_VALUE_INVALID",
      `/productSpec/actions/${productSpec.actions.indexOf(action)}/evidenceScenario/targetInputValues`,
      `Evidence request is not encodable by the compiled transport: ${errorMessage(error)}`,
    );
  }
  return recursivelyFreezeInvocationTransportV2({
    status: "shadow_compiled" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    contract,
    contractHash: contract.contractHash,
    canonicalBytes: canonicalJsonStringify(contract),
  });
}

/**
 * Pure shadow projection. It accepts only ProductSpec, a delivery selection,
 * and one action identity; it cannot accept execution or release authority.
 */
export function compileInvocationInputTransportV2(
  input: unknown,
): InvocationInputTransportCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, COMPILER_INPUT_MAX_BYTES);
  } catch (error) {
    return singleRejected(
      "INVOCATION_TRANSPORT_V2_INPUT_INVALID",
      "/",
      errorMessage(error),
    );
  }
  const outer = CompilerInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return rejected(diagnosticsFromZod(
      "INVOCATION_TRANSPORT_V2_INPUT_INVALID",
      outer.error,
    ));
  }
  const unsupported = unsupportedInputDiagnostic(
    outer.data.productSpec,
    outer.data.actionRef,
  );
  if (unsupported) return rejected([unsupported]);

  const productSpecResult = ProductSpecV2Schema.safeParse(outer.data.productSpec);
  if (!productSpecResult.success) {
    return rejected(diagnosticsFromZod(
      "INVOCATION_TRANSPORT_V2_PRODUCT_SPEC_INVALID",
      productSpecResult.error,
      "/productSpec",
    ));
  }
  const productSpec = productSpecResult.data;
  const action = productSpec.actions.find((candidate) => candidate.id === outer.data.actionRef);
  if (!action) {
    return singleRejected(
      "INVOCATION_TRANSPORT_V2_ACTION_UNRESOLVED",
      "/actionRef",
      `ProductSpecV2 has no action ${outer.data.actionRef}`,
    );
  }
  if (
    action.invocationInterface.kind !== "cli_command"
    && action.invocationInterface.kind !== "http_request"
  ) {
    return singleRejected(
      "INVOCATION_TRANSPORT_V2_INVOCATION_INTERFACE_UNSUPPORTED",
      `/productSpec/actions/${productSpec.actions.indexOf(action)}/invocationInterface/kind`,
      `InvocationInputTransportV2 supports only cli_command and http_request; observed ${action.invocationInterface.kind}`,
    );
  }

  const verifiedSelection = exactSelection(productSpec, outer.data.deliverySelection);
  if (verifiedSelection.status === "rejected") {
    return rejected([verifiedSelection.diagnostic]);
  }
  return compileFromVerifiedAuthority(productSpec, verifiedSelection.selection, action);
}

/**
 * Compiles the every-action transport set from one bounded ProductSpec snapshot
 * and one freshly verified selection. This avoids reparsing the complete spec
 * once per action while preserving the single-action compiler's exact output.
 */
export function compileInvocationInputTransportSetV2(
  input: unknown,
): InvocationInputTransportSetCompilationResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, COMPILER_INPUT_MAX_BYTES);
  } catch (error) {
    return recursivelyFreezeInvocationTransportV2({
      status: "rejected" as const,
      diagnostics: [diagnostic(
        "INVOCATION_TRANSPORT_V2_INPUT_INVALID",
        "/",
        errorMessage(error),
      )],
    });
  }
  const outer = SetCompilerInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return recursivelyFreezeInvocationTransportV2({
      status: "rejected" as const,
      diagnostics: diagnosticsFromZod(
        "INVOCATION_TRANSPORT_V2_INPUT_INVALID",
        outer.error,
      ),
    });
  }
  const productSpecResult = ProductSpecV2Schema.safeParse(outer.data.productSpec);
  if (!productSpecResult.success) {
    return recursivelyFreezeInvocationTransportV2({
      status: "rejected" as const,
      diagnostics: diagnosticsFromZod(
        "INVOCATION_TRANSPORT_V2_PRODUCT_SPEC_INVALID",
        productSpecResult.error,
        "/productSpec",
      ),
    });
  }
  const productSpec = productSpecResult.data;
  const verifiedSelection = exactSelection(productSpec, outer.data.deliverySelection);
  if (verifiedSelection.status === "rejected") {
    return recursivelyFreezeInvocationTransportV2({
      status: "rejected" as const,
      diagnostics: [verifiedSelection.diagnostic],
    });
  }

  const contracts: InvocationInputTransportV2[] = [];
  let retainedCanonicalBytes = 2;
  const entityFieldById = new Map(productSpec.entities.flatMap((entity) =>
    entity.fields.map((field) => [field.id, field] as const)));
  for (const action of [...productSpec.actions].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0)) {
    const result = compileFromVerifiedAuthority(
      productSpec,
      verifiedSelection.selection,
      action,
      entityFieldById,
    );
    if (result.status === "rejected") {
      return recursivelyFreezeInvocationTransportV2({
        status: "rejected" as const,
        diagnostics: result.diagnostics,
      });
    }
    retainedCanonicalBytes += Buffer.byteLength(result.canonicalBytes, "utf8")
      + (contracts.length === 0 ? 0 : 1);
    if (
      retainedCanonicalBytes
      > INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2
    ) {
      return recursivelyFreezeInvocationTransportV2({
        status: "rejected" as const,
        diagnostics: [diagnostic(
          "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID",
          "/contracts",
          `Invocation transport set exceeds ${INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2} canonical bytes`,
        )],
      });
    }
    contracts.push(result.contract);
  }

  const withoutHash = {
    schema: INVOCATION_INPUT_TRANSPORT_SET_ARTIFACT_TYPE_V2,
    contractSetVersion: INVOCATION_INPUT_TRANSPORT_SET_VERSION_V2,
    readiness: "shadow" as const,
    productionUse: "forbidden" as const,
    productSpecHash: verifiedSelection.selection.productSpecHash,
    deliverySelectionHash: hashProductDeliverySelectionV2(verifiedSelection.selection),
    contractCount: contracts.length,
    contracts,
    membershipHash: hashInvocationInputTransportMembershipV2(contracts),
  };
  const parsedContractSet = InvocationInputTransportSetV2Schema.safeParse({
    ...withoutHash,
    contractSetHash: hashInvocationInputTransportSetV2(withoutHash),
  });
  if (!parsedContractSet.success) {
    return recursivelyFreezeInvocationTransportV2({
      status: "rejected" as const,
      diagnostics: diagnosticsFromZod(
        "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID",
        parsedContractSet.error,
        "/contractSet",
      ),
    });
  }
  const canonicalBytes = canonicalJsonStringify(parsedContractSet.data);
  if (
    Buffer.byteLength(canonicalBytes, "utf8")
    > INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2
  ) {
    return recursivelyFreezeInvocationTransportV2({
      status: "rejected" as const,
      diagnostics: [diagnostic(
        "INVOCATION_TRANSPORT_V2_CONTRACT_INVALID",
        "/contracts",
        `Invocation transport set exceeds ${INVOCATION_INPUT_TRANSPORT_SET_MAX_CANONICAL_BYTES_V2} canonical bytes`,
      )],
    });
  }
  const contractSet = recursivelyFreezeInvocationInputTransportSetV2(
    parsedContractSet.data,
  );
  return recursivelyFreezeInvocationInputTransportSetV2({
    status: "shadow_compiled" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    contractSet,
    membershipHash: contractSet.membershipHash,
    contractSetHash: contractSet.contractSetHash,
    canonicalBytes,
  });
}

export type InvocationInputTransportVerificationErrorCodeV2 =
  | "INVOCATION_TRANSPORT_V2_VERIFICATION_INPUT_INVALID"
  | "INVOCATION_TRANSPORT_V2_VERIFICATION_CANDIDATE_INVALID"
  | "INVOCATION_TRANSPORT_V2_VERIFICATION_REPRODUCTION_REJECTED"
  | "INVOCATION_TRANSPORT_V2_VERIFICATION_AUTHORITY_MISMATCH";

export class InvocationInputTransportVerificationErrorV2 extends Error {
  readonly code: InvocationInputTransportVerificationErrorCodeV2;

  constructor(code: InvocationInputTransportVerificationErrorCodeV2, message: string) {
    super(message);
    this.name = "InvocationInputTransportVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowInvocationInputTransportV2 = Readonly<{
  status: "verified_shadow";
  contract: Readonly<InvocationInputTransportV2>;
  contractHash: string;
  canonicalBytes: string;
}>;

/** Reproduces the candidate from fresh ProductSpec and selection authority. */
export function verifyInvocationInputTransportV2(
  input: unknown,
): VerifiedShadowInvocationInputTransportV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, VERIFIER_INPUT_MAX_BYTES);
  } catch (error) {
    throw new InvocationInputTransportVerificationErrorV2(
      "INVOCATION_TRANSPORT_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = VerificationInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new InvocationInputTransportVerificationErrorV2(
      "INVOCATION_TRANSPORT_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Verification input is invalid",
    );
  }
  const candidate = InvocationInputTransportV2Schema.safeParse(outer.data.candidate);
  if (!candidate.success) {
    throw new InvocationInputTransportVerificationErrorV2(
      "INVOCATION_TRANSPORT_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Transport candidate is invalid",
    );
  }
  const reproduced = compileInvocationInputTransportV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
    actionRef: outer.data.actionRef,
  });
  if (reproduced.status !== "shadow_compiled") {
    throw new InvocationInputTransportVerificationErrorV2(
      "INVOCATION_TRANSPORT_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh transport reproduction was rejected",
    );
  }
  if (canonicalJsonStringify(reproduced.contract) !== canonicalJsonStringify(candidate.data)) {
    throw new InvocationInputTransportVerificationErrorV2(
      "INVOCATION_TRANSPORT_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Transport candidate does not equal fresh ProductSpec/action/interface/delivery/profile/policy/codec authority",
    );
  }
  return recursivelyFreezeInvocationTransportV2({
    status: "verified_shadow" as const,
    contract: reproduced.contract,
    contractHash: reproduced.contractHash,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

export type InvocationInputTransportSetVerificationErrorCodeV2 =
  | "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_INPUT_INVALID"
  | "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_CANDIDATE_INVALID"
  | "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_REPRODUCTION_REJECTED"
  | "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_AUTHORITY_MISMATCH";

export class InvocationInputTransportSetVerificationErrorV2 extends Error {
  readonly code: InvocationInputTransportSetVerificationErrorCodeV2;

  constructor(code: InvocationInputTransportSetVerificationErrorCodeV2, message: string) {
    super(message);
    this.name = "InvocationInputTransportSetVerificationErrorV2";
    this.code = code;
  }
}

export type VerifiedShadowInvocationInputTransportSetV2 = Readonly<{
  status: "verified_shadow";
  contractSet: Readonly<InvocationInputTransportSetV2>;
  membershipHash: string;
  contractSetHash: string;
  canonicalBytes: string;
}>;

/** Reproduces the complete set from fresh ProductSpec and selection authority. */
export function verifyInvocationInputTransportSetV2(
  input: unknown,
): VerifiedShadowInvocationInputTransportSetV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      SET_VERIFIER_INPUT_MAX_BYTES,
      SET_VERIFIER_BOUNDED_WORK_LIMITS,
    );
  } catch (error) {
    throw new InvocationInputTransportSetVerificationErrorV2(
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = SetVerificationInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    throw new InvocationInputTransportSetVerificationErrorV2(
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Transport-set verification input is invalid",
    );
  }
  const candidate = InvocationInputTransportSetV2Schema.safeParse(
    outer.data.candidate,
  );
  if (!candidate.success) {
    throw new InvocationInputTransportSetVerificationErrorV2(
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_CANDIDATE_INVALID",
      candidate.error.issues[0]?.message ?? "Transport-set candidate is invalid",
    );
  }
  const reproduced = compileInvocationInputTransportSetV2({
    productSpec: outer.data.productSpec,
    deliverySelection: outer.data.deliverySelection,
  });
  if (reproduced.status !== "shadow_compiled") {
    throw new InvocationInputTransportSetVerificationErrorV2(
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_REPRODUCTION_REJECTED",
      reproduced.diagnostics[0]?.message ?? "Fresh transport-set reproduction was rejected",
    );
  }
  if (
    canonicalJsonStringify(reproduced.contractSet)
    !== canonicalJsonStringify(candidate.data)
  ) {
    throw new InvocationInputTransportSetVerificationErrorV2(
      "INVOCATION_TRANSPORT_SET_V2_VERIFICATION_AUTHORITY_MISMATCH",
      "Transport-set candidate does not equal fresh every-action ProductSpec/profile/codec authority",
    );
  }
  return recursivelyFreezeInvocationInputTransportSetV2({
    status: "verified_shadow" as const,
    contractSet: reproduced.contractSet,
    membershipHash: reproduced.membershipHash,
    contractSetHash: reproduced.contractSetHash,
    canonicalBytes: reproduced.canonicalBytes,
  });
}

export type CliEncodedInvocationRequestV2 = Readonly<{
  subcommandTokens: readonly string[];
  argvSuffix: readonly string[];
  stdinBytes: string | null;
}>;

export type HttpEncodedInvocationRequestV2 = Readonly<{
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  pathAndQuery: string;
  fixedHeaders: readonly Readonly<{
    name: "accept" | "content-type";
    value: "application/json";
  }>[];
  bodyBytes: string | null;
  redirectPolicy: "error";
}>;

export type EncodedInvocationRequestResultV2 =
  | Readonly<{
      status: "encoded";
      kind: "cli_command";
      request: CliEncodedInvocationRequestV2;
      requestHash: string;
      canonicalBytes: string;
    }>
  | Readonly<{
      status: "encoded";
      kind: "http_request";
      request: HttpEncodedInvocationRequestV2;
      requestHash: string;
      canonicalBytes: string;
    }>;

export type InvocationRequestEncodingErrorCodeV2 =
  | "INVOCATION_TRANSPORT_V2_ENCODER_INPUT_INVALID"
  | "INVOCATION_TRANSPORT_V2_ENCODER_CONTRACT_INVALID"
  | "INVOCATION_TRANSPORT_V2_INPUT_FIELD_CLOSURE_MISMATCH"
  | "INVOCATION_TRANSPORT_V2_INPUT_VALUE_INVALID"
  | "INVOCATION_TRANSPORT_V2_CHANNEL_VALUE_INVALID"
  | "INVOCATION_TRANSPORT_V2_ENCODED_REQUEST_TOO_LARGE";

export class InvocationRequestEncodingErrorV2 extends TypeError {
  readonly code: InvocationRequestEncodingErrorCodeV2;

  constructor(code: InvocationRequestEncodingErrorCodeV2, message: string) {
    super(message);
    this.name = "InvocationRequestEncodingErrorV2";
    this.code = code;
  }
}

function encodingError(
  code: InvocationRequestEncodingErrorCodeV2,
  message: string,
): never {
  throw new InvocationRequestEncodingErrorV2(code, message);
}

function validateTypedValue(
  field: InvocationInputTransportV2["fields"][number],
  value: unknown,
): void {
  const invalid = (expected: string): never => encodingError(
    "INVOCATION_TRANSPORT_V2_INPUT_VALUE_INVALID",
    `${field.actionInputRef} requires exact ${expected} input; coercion is forbidden`,
  );
  if (field.valueType === "string") {
    if (typeof value !== "string") invalid("string");
    return;
  }
  if (field.valueType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) invalid("finite number");
    return;
  }
  if (field.valueType === "boolean") {
    if (typeof value !== "boolean") invalid("boolean");
    return;
  }
  if (field.valueType === "enum") {
    if (typeof value !== "string" || !field.enumValues?.includes(value)) {
      invalid("enum member");
    }
    return;
  }
  if (field.valueType === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      invalid("JSON object");
    }
    return;
  }
  if (!Array.isArray(value)) invalid("JSON array");
}

function hasWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function deterministicTextValue(
  field: InvocationInputTransportV2["fields"][number],
  value: unknown,
): string {
  validateTypedValue(field, value);
  let text: string;
  if (field.valueType === "string" || field.valueType === "enum") {
    text = value as string;
  } else {
    text = canonicalJsonStringify(value);
  }
  if (text.includes("\0") || !hasWellFormedUtf16(text)) {
    encodingError(
      "INVOCATION_TRANSPORT_V2_CHANNEL_VALUE_INVALID",
      `${field.actionInputRef} cannot be represented as an exact transport text value`,
    );
  }
  return text;
}

function rfc3986Component(
  field: InvocationInputTransportV2["fields"][number],
  value: unknown,
): string {
  const text = deterministicTextValue(field, value);
  try {
    return encodeURIComponent(text).replace(/[!'()*]/gu, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch {
    return encodingError(
      "INVOCATION_TRANSPORT_V2_CHANNEL_VALUE_INVALID",
      `${field.actionInputRef} cannot be canonically RFC3986 encoded`,
    );
  }
}

function jsonPointerSegments(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((segment) =>
    segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
}

function defineJsonObjectValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function pointerDocument(
  entries: readonly Readonly<{ pointer: string; value: unknown }>[],
): unknown | null {
  if (entries.length === 0) return null;
  if (entries.length === 1 && entries[0]!.pointer === "") return entries[0]!.value;
  const root: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const entry of entries) {
    const segments = jsonPointerSegments(entry.pointer);
    if (segments.length === 0) {
      encodingError(
        "INVOCATION_TRANSPORT_V2_CHANNEL_VALUE_INVALID",
        "Root JSON Pointer cannot overlap another JSON field channel",
      );
    }
    let current = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]!;
      const existing = current[segment];
      if (existing === undefined) {
        const child: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
        defineJsonObjectValue(current, segment, child);
        current = child;
      } else if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
        current = existing as Record<string, unknown>;
      } else {
        encodingError(
          "INVOCATION_TRANSPORT_V2_CHANNEL_VALUE_INVALID",
          `JSON Pointer ${entry.pointer} collides with an existing scalar`,
        );
      }
    }
    defineJsonObjectValue(current, segments.at(-1)!, entry.value);
  }
  return root;
}

function exactInputValues(
  contract: InvocationInputTransportV2,
  inputValues: Record<string, unknown>,
): Map<string, unknown> {
  const expected = contract.fields.map((field) => field.fieldName).sort();
  const observed = Object.keys(inputValues).sort();
  if (canonicalJsonStringify(expected) !== canonicalJsonStringify(observed)) {
    encodingError(
      "INVOCATION_TRANSPORT_V2_INPUT_FIELD_CLOSURE_MISMATCH",
      `Input values must contain every and only [${expected.join(", ")}] exactly once`,
    );
  }
  const values = new Map<string, unknown>();
  contract.fields.forEach((field) => {
    const value = inputValues[field.fieldName];
    validateTypedValue(field, value);
    values.set(field.fieldName, value);
  });
  return values;
}

function encodeCliRequest(
  contract: Extract<InvocationInputTransportV2, { kind: "cli_command" }>,
  values: Map<string, unknown>,
): CliEncodedInvocationRequestV2 {
  const positional = contract.fields.flatMap((field) =>
    field.channel.kind === "argv_position"
      ? [{ field, position: field.channel.position }]
      : []).sort((left, right) => left.position - right.position);
  const flags = contract.fields.flatMap((field) =>
    field.channel.kind === "argv_flag"
      ? [{ field, flag: field.channel.flag, style: field.channel.style }]
      : []).sort((left, right) =>
        left.flag < right.flag ? -1 : left.flag > right.flag ? 1 : 0);
  const argvSuffix = positional.map(({ field }) =>
    deterministicTextValue(field, values.get(field.fieldName)));
  flags.forEach(({ field, flag, style }) => {
    const encoded = deterministicTextValue(field, values.get(field.fieldName));
    if (style === "separate") argvSuffix.push(flag, encoded);
    else argvSuffix.push(`${flag}=${encoded}`);
  });
  const stdinDocument = pointerDocument(contract.fields.flatMap((field) =>
    field.channel.kind === "stdin_json_pointer"
      ? [{ pointer: field.channel.pointer, value: values.get(field.fieldName) }]
      : []));
  return {
    subcommandTokens: [...contract.subcommandTokens],
    argvSuffix,
    stdinBytes: stdinDocument === null ? null : canonicalJsonStringify(stdinDocument),
  };
}

function encodeHttpRequest(
  contract: Extract<InvocationInputTransportV2, { kind: "http_request" }>,
  values: Map<string, unknown>,
): HttpEncodedInvocationRequestV2 {
  const pathValueByName = new Map(contract.fields.flatMap((field) =>
    field.channel.kind === "path_parameter"
      ? [[field.channel.name, rfc3986Component(field, values.get(field.fieldName))] as const]
      : []));
  const path = contract.routeTemplate.split("/").map((segment) => {
    const match = /^:([A-Za-z][A-Za-z0-9_]*)$/u.exec(segment);
    return match ? pathValueByName.get(match[1]!)! : segment;
  }).join("/");
  const query = contract.fields.flatMap((field) =>
    field.channel.kind === "query_parameter"
      ? [{
        name: field.channel.name,
        value: rfc3986Component(field, values.get(field.fieldName)),
      }]
      : []).sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const pathAndQuery = query.length === 0
    ? path
    : `${path}?${query.map((entry) => `${entry.name}=${entry.value}`).join("&")}`;
  const bodyDocument = pointerDocument(contract.fields.flatMap((field) =>
    field.channel.kind === "json_body_pointer"
      ? [{ pointer: field.channel.pointer, value: values.get(field.fieldName) }]
      : []));
  return {
    method: contract.method,
    pathAndQuery,
    fixedHeaders: contract.fixedHeaders.map((header) => ({ ...header })),
    bodyBytes: bodyDocument === null ? null : canonicalJsonStringify(bodyDocument),
    redirectPolicy: "error",
  };
}

export function hashEncodedInvocationRequestV2(
  contractHash: string,
  request: CliEncodedInvocationRequestV2 | HttpEncodedInvocationRequestV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.encoded-invocation-request-hash.v2",
    contractHash,
    request,
  });
}

/**
 * Pure serializer. Its exact output has no executable, cwd, environment,
 * origin/base URL, port, network, runner, or release authority.
 */
export function encodeInvocationRequestV2(
  input: unknown,
): EncodedInvocationRequestResultV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(input, ENCODER_INPUT_MAX_BYTES);
  } catch (error) {
    return encodingError(
      "INVOCATION_TRANSPORT_V2_ENCODER_INPUT_INVALID",
      errorMessage(error),
    );
  }
  const outer = EncoderInputV2Schema.safeParse(snapshot);
  if (!outer.success) {
    return encodingError(
      "INVOCATION_TRANSPORT_V2_ENCODER_INPUT_INVALID",
      outer.error.issues[0]?.message ?? "Encoder input is invalid",
    );
  }
  const contractResult = InvocationInputTransportV2Schema.safeParse(outer.data.contract);
  if (!contractResult.success) {
    return encodingError(
      "INVOCATION_TRANSPORT_V2_ENCODER_CONTRACT_INVALID",
      contractResult.error.issues[0]?.message ?? "Transport contract is invalid",
    );
  }
  const contract = contractResult.data;
  const values = exactInputValues(contract, outer.data.inputValues);
  const request = contract.kind === "cli_command"
    ? encodeCliRequest(contract, values)
    : encodeHttpRequest(contract, values);
  try {
    canonicalJsonBytesBounded(request, {
      maxBytes: ENCODED_REQUEST_MAX_BYTES,
      ...DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
    });
  } catch (error) {
    return encodingError(
      "INVOCATION_TRANSPORT_V2_ENCODED_REQUEST_TOO_LARGE",
      errorMessage(error),
    );
  }
  return recursivelyFreezeInvocationTransportV2({
    status: "encoded" as const,
    kind: contract.kind,
    request,
    requestHash: hashEncodedInvocationRequestV2(contract.contractHash, request),
    canonicalBytes: canonicalJsonStringify(request),
  }) as EncodedInvocationRequestResultV2;
}

export type InvocationResponseDecodingErrorCodeV2 =
  | "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_CONTRACT_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_KIND_MISMATCH"
  | "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_TOO_LARGE"
  | "INVOCATION_TRANSPORT_V2_DECODER_UTF8_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_JSON_DUPLICATE_KEY"
  | "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED"
  | "INVOCATION_TRANSPORT_V2_DECODER_JSON_NUMBER_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_PROTOCOL_CODE_UNKNOWN"
  | "INVOCATION_TRANSPORT_V2_DECODER_POINTER_MISSING"
  | "INVOCATION_TRANSPORT_V2_DECODER_ERROR_SHAPE_INVALID"
  | "INVOCATION_TRANSPORT_V2_DECODER_ERROR_CODE_MISMATCH";

export class InvocationResponseDecodingErrorV2 extends TypeError {
  readonly code: InvocationResponseDecodingErrorCodeV2;

  constructor(code: InvocationResponseDecodingErrorCodeV2, message: string) {
    super(message);
    this.name = "InvocationResponseDecodingErrorV2";
    this.code = code;
  }
}

export type DecodedInvocationResponseV2 =
  | Readonly<{
      status: "decoded_success";
      kind: "cli_command";
      exitCode: number;
      decoderRef: "DECODE_CLI_STDOUT_SUCCESS_JSON_V2";
      value: unknown;
    }>
  | Readonly<{
      status: "decoded_success";
      kind: "http_request";
      statusCode: number;
      decoderRef: "DECODE_HTTP_SUCCESS_RESPONSE_JSON_V2";
      value: unknown;
    }>
  | Readonly<{
      status: "decoded_failure";
      kind: "cli_command";
      exitCode: number;
      decoderRef: "DECODE_CLI_STDERR_FAILURE_JSON_V2";
      failureKind: "input_validation" | "precondition" | "action_failure";
      errorCode: string;
      message: string;
    }>
  | Readonly<{
      status: "decoded_failure";
      kind: "http_request";
      statusCode: number;
      decoderRef: "DECODE_HTTP_FAILURE_RESPONSE_JSON_V2";
      failureKind: "input_validation" | "precondition" | "action_failure";
      errorCode: string;
      message: string;
    }>;

function decodingError(
  code: InvocationResponseDecodingErrorCodeV2,
  message: string,
): never {
  throw new InvocationResponseDecodingErrorV2(code, message);
}

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || isProxy(value)) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
      `${label} must be one non-proxy plain data object`,
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
      `${label} must use the plain object prototype`,
    );
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
      `${label} cannot contain symbol properties`,
    );
  }
  const observed = (keys as string[]).sort();
  const expected = [...expectedKeys].sort();
  if (canonicalJsonStringify(observed) !== canonicalJsonStringify(expected)) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
      `${label} must contain exactly [${expected.join(", ")}]`,
    );
  }
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      return decodingError(
        "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
        `${label}.${key} must be one enumerable data property`,
      );
    }
    Object.defineProperty(output, key, {
      value: descriptor.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return output;
}

function copyResponseBytes(
  value: unknown,
  limit: number,
  label: string,
): Buffer {
  if (value === null || typeof value !== "object" || isProxy(value) || !isUint8Array(value)) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} must be a non-proxy Buffer or Uint8Array`,
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} must not use a caller-owned typed-array subclass`,
    );
  }
  for (const property of ["buffer", "byteLength", "byteOffset", "length"] as const) {
    if (Object.getOwnPropertyDescriptor(value, property)) {
      return decodingError(
        "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
        `${label} must not shadow intrinsic typed-array ${property}`,
      );
    }
  }
  let backingBuffer: ArrayBufferLike;
  let observedLength: number;
  let observedOffset: number;
  try {
    backingBuffer = Reflect.apply(TYPED_ARRAY_BUFFER_GETTER, value, []) as ArrayBufferLike;
    observedLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as number;
    observedOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as number;
  } catch {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} lacks exact intrinsic typed-array storage`,
    );
  }
  if (isSharedArrayBuffer(backingBuffer)) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} cannot share concurrently mutable memory`,
    );
  }
  if (
    ARRAY_BUFFER_RESIZABLE_GETTER
    && Reflect.apply(ARRAY_BUFFER_RESIZABLE_GETTER, backingBuffer, []) === true
  ) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} cannot use resizable backing memory`,
    );
  }
  if (!Number.isSafeInteger(observedLength) || observedLength < 0) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} has no stable intrinsic byte length`,
    );
  }
  if (observedLength > limit) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_TOO_LARGE",
      `${label} exceeds the exact ${limit}-byte response limit`,
    );
  }
  try {
    const source = new Uint8Array(backingBuffer, observedOffset, observedLength);
    const first = Buffer.allocUnsafeSlow(observedLength);
    const second = Buffer.allocUnsafeSlow(observedLength);
    Reflect.apply(TYPED_ARRAY_SET, first, [source]);
    Reflect.apply(TYPED_ARRAY_SET, second, [source]);
    const finalBuffer = Reflect.apply(
      TYPED_ARRAY_BUFFER_GETTER,
      value,
      [],
    ) as ArrayBufferLike;
    const finalLength = Reflect.apply(TYPED_ARRAY_BYTE_LENGTH_GETTER, value, []) as number;
    const finalOffset = Reflect.apply(TYPED_ARRAY_BYTE_OFFSET_GETTER, value, []) as number;
    const finalResizable = !isSharedArrayBuffer(finalBuffer)
      && ARRAY_BUFFER_RESIZABLE_GETTER
      ? Reflect.apply(ARRAY_BUFFER_RESIZABLE_GETTER, finalBuffer, []) === true
      : false;
    if (
      finalBuffer !== backingBuffer
      || finalLength !== observedLength
      || finalOffset !== observedOffset
      || isSharedArrayBuffer(finalBuffer)
      || finalResizable
      || !Reflect.apply(BUFFER_EQUALS, first, [second])
    ) {
      return decodingError(
        "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
        `${label} changed during its bounded byte snapshot`,
      );
    }
    return first;
  } catch (error) {
    if (error instanceof InvocationResponseDecodingErrorV2) throw error;
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_BYTES_INVALID",
      `${label} changed during its bounded byte snapshot`,
    );
  }
}

type JsonDecoderLimitsV2 = Readonly<{
  maxDepth: number;
  maxNodes: number;
  maxContainerEntries: number;
}>;

class StrictJsonScannerV2 {
  private index = 0;
  private nodes = 0;

  constructor(
    private readonly text: string,
    private readonly limits: JsonDecoderLimitsV2,
  ) {}

  validate(): void {
    this.skipWhitespace();
    this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
        "JSON response contains trailing tokens",
      );
    }
  }

  private fail(
    code: InvocationResponseDecodingErrorCodeV2,
    message: string,
  ): never {
    return decodingError(code, `${message} at UTF-16 offset ${this.index}`);
  }

  private skipWhitespace(): void {
    while (
      this.index < this.text.length
      && (
        this.text[this.index] === " "
        || this.text[this.index] === "\t"
        || this.text[this.index] === "\n"
        || this.text[this.index] === "\r"
      )
    ) {
      this.index += 1;
    }
  }

  private enterNode(depth: number): void {
    if (depth > this.limits.maxDepth) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
        `JSON response exceeds maximum depth ${this.limits.maxDepth}`,
      );
    }
    this.nodes += 1;
    if (this.nodes > this.limits.maxNodes) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
        `JSON response exceeds maximum node count ${this.limits.maxNodes}`,
      );
    }
  }

  private parseValue(depth: number): void {
    this.enterNode(depth);
    const token = this.text[this.index];
    if (token === "{") return this.parseObject(depth);
    if (token === "[") return this.parseArray(depth);
    if (token === "\"") {
      this.parseString(false);
      return;
    }
    if (token === "t") return this.parseLiteral("true");
    if (token === "f") return this.parseLiteral("false");
    if (token === "n") return this.parseLiteral("null");
    if (token === "-" || (token !== undefined && token >= "0" && token <= "9")) {
      this.parseNumber();
      return;
    }
    this.fail(
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
      "JSON response expected one value",
    );
  }

  private parseLiteral(expected: "true" | "false" | "null"): void {
    if (this.text.slice(this.index, this.index + expected.length) !== expected) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
        `JSON response expected ${expected}`,
      );
    }
    this.index += expected.length;
  }

  private parseObject(depth: number): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return;
    }
    const keys = new Set<string>();
    let entries = 0;
    while (true) {
      entries += 1;
      if (entries > this.limits.maxContainerEntries) {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
          `JSON object exceeds ${this.limits.maxContainerEntries} entries`,
        );
      }
      if (this.text[this.index] !== "\"") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON object expected a quoted key",
        );
      }
      const key = this.parseString(true);
      if (keys.has(key)) {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_DUPLICATE_KEY",
          `JSON object repeats decoded key ${JSON.stringify(key).slice(0, 200)}`,
        );
      }
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON object expected ':' after its key",
        );
      }
      this.index += 1;
      this.skipWhitespace();
      this.parseValue(depth + 1);
      this.skipWhitespace();
      const delimiter = this.text[this.index];
      if (delimiter === "}") {
        this.index += 1;
        return;
      }
      if (delimiter !== ",") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON object expected ',' or '}'",
        );
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseArray(depth: number): void {
    this.index += 1;
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return;
    }
    let entries = 0;
    while (true) {
      entries += 1;
      if (entries > this.limits.maxContainerEntries) {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_LIMIT_EXCEEDED",
          `JSON array exceeds ${this.limits.maxContainerEntries} entries`,
        );
      }
      this.parseValue(depth + 1);
      this.skipWhitespace();
      const delimiter = this.text[this.index];
      if (delimiter === "]") {
        this.index += 1;
        return;
      }
      if (delimiter !== ",") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON array expected ',' or ']'",
        );
      }
      this.index += 1;
      this.skipWhitespace();
    }
  }

  private parseNumber(): void {
    const start = this.index;
    if (this.text[this.index] === "-") this.index += 1;
    if (this.text[this.index] === "0") {
      this.index += 1;
    } else {
      const first = this.text[this.index];
      if (first === undefined || first < "1" || first > "9") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON number expected an integer component",
        );
      }
      while (
        this.text[this.index] !== undefined
        && this.text[this.index]! >= "0"
        && this.text[this.index]! <= "9"
      ) {
        this.index += 1;
      }
    }
    if (this.text[this.index] === ".") {
      this.index += 1;
      const firstFraction = this.text[this.index];
      if (firstFraction === undefined || firstFraction < "0" || firstFraction > "9") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON number expected a fractional digit",
        );
      }
      while (
        this.text[this.index] !== undefined
        && this.text[this.index]! >= "0"
        && this.text[this.index]! <= "9"
      ) {
        this.index += 1;
      }
    }
    if (this.text[this.index] === "e" || this.text[this.index] === "E") {
      this.index += 1;
      if (this.text[this.index] === "+" || this.text[this.index] === "-") this.index += 1;
      const firstExponent = this.text[this.index];
      if (firstExponent === undefined || firstExponent < "0" || firstExponent > "9") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          "JSON number expected an exponent digit",
        );
      }
      while (
        this.text[this.index] !== undefined
        && this.text[this.index]! >= "0"
        && this.text[this.index]! <= "9"
      ) {
        this.index += 1;
      }
    }
    const token = this.text.slice(start, this.index);
    if (!Number.isFinite(Number(token))) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_NUMBER_INVALID",
        "JSON number must decode to one finite number",
      );
    }
  }

  private parseString(capture: boolean): string {
    this.index += 1;
    const parts: string[] = [];
    let runStart = this.index;
    while (this.index < this.text.length) {
      const code = this.text.charCodeAt(this.index);
      if (code === 0x22) {
        if (capture && runStart < this.index) parts.push(this.text.slice(runStart, this.index));
        this.index += 1;
        return capture ? parts.join("") : "";
      }
      if (code === 0x5c) {
        if (capture && runStart < this.index) parts.push(this.text.slice(runStart, this.index));
        this.index += 1;
        const escape = this.text[this.index];
        if (escape === undefined) {
          this.fail(
            "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
            "JSON string ends inside an escape",
          );
        }
        if (escape === "u") {
          this.index += 1;
          const decoded = this.parseUnicodeEscape();
          if (capture) parts.push(decoded);
        } else {
          const decoded = escape === "\"" ? "\""
            : escape === "\\" ? "\\"
              : escape === "/" ? "/"
                : escape === "b" ? "\b"
                  : escape === "f" ? "\f"
                    : escape === "n" ? "\n"
                      : escape === "r" ? "\r"
                        : escape === "t" ? "\t"
                          : null;
          if (decoded === null) {
            this.fail(
              "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
              `JSON string contains invalid escape \\${escape}`,
            );
          }
          if (capture) parts.push(decoded);
          this.index += 1;
        }
        runStart = this.index;
        continue;
      }
      if (code < 0x20) {
        this.fail(
          code === 0
            ? "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID"
            : "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
          code === 0
            ? "JSON strings cannot contain NUL"
            : "JSON strings cannot contain unescaped controls",
        );
      }
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = this.text.charCodeAt(this.index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          this.fail(
            "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
            "JSON string contains an ill-formed Unicode surrogate",
          );
        }
        this.index += 2;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
          "JSON string contains an ill-formed Unicode surrogate",
        );
      } else {
        this.index += 1;
      }
    }
    this.fail(
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
      "JSON string is unterminated",
    );
  }

  private parseUnicodeEscape(): string {
    const first = this.parseHexCodeUnit();
    if (first === 0) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
        "JSON strings cannot contain escaped NUL",
      );
    }
    if (first >= 0xd800 && first <= 0xdbff) {
      if (this.text.slice(this.index, this.index + 2) !== "\\u") {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
          "JSON string contains an unpaired escaped high surrogate",
        );
      }
      this.index += 2;
      const second = this.parseHexCodeUnit();
      if (!(second >= 0xdc00 && second <= 0xdfff)) {
        this.fail(
          "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
          "JSON string contains an invalid escaped surrogate pair",
        );
      }
      return String.fromCharCode(first, second);
    }
    if (first >= 0xdc00 && first <= 0xdfff) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_STRING_INVALID",
        "JSON string contains an unpaired escaped low surrogate",
      );
    }
    return String.fromCharCode(first);
  }

  private parseHexCodeUnit(): number {
    const digits = this.text.slice(this.index, this.index + 4);
    if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) {
      this.fail(
        "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
        "JSON Unicode escape requires four hexadecimal digits",
      );
    }
    this.index += 4;
    return Number.parseInt(digits, 16);
  }
}

function decodeStrictJsonResponse(
  bytes: Buffer,
  result: InvocationInputTransportV2["result"],
): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_UTF8_INVALID",
      "Response body is not fatal-valid UTF-8",
    );
  }
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_UTF8_INVALID",
      "Response body does not round-trip through exact UTF-8 bytes",
    );
  }
  new StrictJsonScannerV2(text, {
    maxDepth: result.maxDepth,
    maxNodes: result.maxNodes,
    maxContainerEntries: result.maxContainerEntries,
  }).validate();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_JSON_GRAMMAR_INVALID",
      "Response body failed strict JSON parsing after scanner admission",
    );
  }
}

function valueAtJsonPointer(
  root: unknown,
  pointer: string,
): Readonly<{ found: boolean; value?: unknown }> {
  if (pointer === "") return { found: true, value: root };
  let current = root;
  for (const segment of jsonPointerSegments(pointer)) {
    if (current === null || typeof current !== "object") {
      return { found: false };
    }
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(segment)) return { found: false };
      const index = Number(segment);
      if (
        !Number.isSafeInteger(index)
        || index >= current.length
        || !Object.hasOwn(current, segment)
      ) {
        return { found: false };
      }
    } else if (!Object.hasOwn(current, segment)) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function requirePointer(
  root: unknown,
  pointer: string,
  label: string,
): unknown {
  const resolved = valueAtJsonPointer(root, pointer);
  if (!resolved.found) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_POINTER_MISSING",
      `${label} JSON Pointer ${pointer || "<root>"} is absent from the selected response body`,
    );
  }
  return resolved.value;
}

function decodedFailure(
  root: unknown,
  failure: InvocationInputTransportV2["result"]["failureCases"][number],
): Readonly<{
  failureKind: "input_validation" | "precondition" | "action_failure";
  errorCode: string;
  message: string;
}> {
  const errorCode = requirePointer(root, failure.codePointer, "Failure errorCode");
  const message = requirePointer(root, failure.messagePointer, "Failure message");
  if (typeof errorCode !== "string" || typeof message !== "string") {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_ERROR_SHAPE_INVALID",
      "Failure codePointer and messagePointer must resolve to strings",
    );
  }
  if (errorCode !== failure.errorCode) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_ERROR_CODE_MISMATCH",
      `Failure errorCode must equal declared code ${failure.errorCode}`,
    );
  }
  return {
    failureKind: failure.kind,
    errorCode,
    message,
  };
}

/**
 * Pure bounded response decoder. It accepts only a shadow transport contract
 * and private byte snapshots; it performs no process, network, runner, or
 * release operation.
 */
export function decodeInvocationResponseV2(input: unknown): DecodedInvocationResponseV2 {
  const outer = exactDataRecord(input, ["contract", "response"], "Decoder input");
  let contractSnapshot: unknown;
  try {
    contractSnapshot = boundedSnapshot(outer.contract, VERIFIER_INPUT_MAX_BYTES);
  } catch (error) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_CONTRACT_INVALID",
      errorMessage(error),
    );
  }
  const contractResult = InvocationInputTransportV2Schema.safeParse(contractSnapshot);
  if (!contractResult.success) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_CONTRACT_INVALID",
      contractResult.error.issues[0]?.message ?? "Decoder transport contract is invalid",
    );
  }
  const contract = contractResult.data;
  if (contract.kind === "cli_command") {
    const response = exactDataRecord(
      outer.response,
      ["kind", "exitCode", "stdoutBytes", "stderrBytes"],
      "CLI response",
    );
    if (response.kind !== "cli_process_result") {
      return decodingError(
        "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_KIND_MISMATCH",
        "CLI transport requires response kind cli_process_result",
      );
    }
    if (!Number.isInteger(response.exitCode) || (response.exitCode as number) < 0 || (response.exitCode as number) > 255) {
      return decodingError(
        "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
        "CLI response exitCode must be an integer from 0 through 255",
      );
    }
    const exitCode = response.exitCode as number;
    if (contract.result.successExitCodes.includes(exitCode)) {
      const stdoutBytes = copyResponseBytes(
        response.stdoutBytes,
        contract.result.responseByteLimit,
        "CLI stdoutBytes",
      );
      const body = decodeStrictJsonResponse(stdoutBytes, contract.result);
      const value = requirePointer(body, contract.result.valuePointer, "Success value");
      return recursivelyFreezeInvocationTransportV2({
        status: "decoded_success" as const,
        kind: "cli_command" as const,
        exitCode,
        decoderRef: contract.result.successDecoderRef,
        value,
      });
    }
    const failure = contract.result.failureCases.find((candidate) =>
      candidate.exitCodes.includes(exitCode));
    if (!failure) {
      return decodingError(
        "INVOCATION_TRANSPORT_V2_DECODER_PROTOCOL_CODE_UNKNOWN",
        `CLI exit code ${exitCode} is outside the declared success/failure ABI`,
      );
    }
    const stderrBytes = copyResponseBytes(
      response.stderrBytes,
      contract.result.responseByteLimit,
      "CLI stderrBytes",
    );
    const body = decodeStrictJsonResponse(stderrBytes, contract.result);
    const decoded = decodedFailure(body, failure);
    return recursivelyFreezeInvocationTransportV2({
      status: "decoded_failure" as const,
      kind: "cli_command" as const,
      exitCode,
      decoderRef: contract.result.failureDecoderRef,
      ...decoded,
    });
  }

  const response = exactDataRecord(
    outer.response,
    ["kind", "statusCode", "bodyBytes"],
    "HTTP response",
  );
  if (response.kind !== "http_response") {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_RESPONSE_KIND_MISMATCH",
      "HTTP transport requires response kind http_response",
    );
  }
  if (!Number.isInteger(response.statusCode) || (response.statusCode as number) < 100 || (response.statusCode as number) > 599) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_INPUT_INVALID",
      "HTTP response statusCode must be an integer from 100 through 599",
    );
  }
  const statusCode = response.statusCode as number;
  if (contract.result.successStatusCodes.includes(statusCode)) {
    const bodyBytes = copyResponseBytes(
      response.bodyBytes,
      contract.result.responseByteLimit,
      "HTTP bodyBytes",
    );
    const body = decodeStrictJsonResponse(bodyBytes, contract.result);
    const value = requirePointer(body, contract.result.valuePointer, "Success value");
    return recursivelyFreezeInvocationTransportV2({
      status: "decoded_success" as const,
      kind: "http_request" as const,
      statusCode,
      decoderRef: contract.result.successDecoderRef,
      value,
    });
  }
  const failure = contract.result.failureCases.find((candidate) =>
    candidate.statusCodes.includes(statusCode));
  if (!failure) {
    return decodingError(
      "INVOCATION_TRANSPORT_V2_DECODER_PROTOCOL_CODE_UNKNOWN",
      `HTTP status ${statusCode} is outside the declared success/failure ABI`,
    );
  }
  const bodyBytes = copyResponseBytes(
    response.bodyBytes,
    contract.result.responseByteLimit,
    "HTTP bodyBytes",
  );
  const body = decodeStrictJsonResponse(bodyBytes, contract.result);
  const decoded = decodedFailure(body, failure);
  return recursivelyFreezeInvocationTransportV2({
    status: "decoded_failure" as const,
    kind: "http_request" as const,
    statusCode,
    decoderRef: contract.result.failureDecoderRef,
    ...decoded,
  });
}
