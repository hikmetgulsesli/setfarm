import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
  StableReferenceSchema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-wire-contract-set.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_CONTRACT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-wire-schema-contract.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-operation-failure.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_AUTHORITY_REF_V2 =
  "AUTH_PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_COUNT_V2 = 23;
export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_MESSAGE_MAX_CANONICAL_BYTES_V2 =
  1024 * 1024;

const WireSchemaRefV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(
    /^setfarm\.[a-z0-9]+(?:[.-][a-z0-9]+)*\.v2$/,
    "Expected one exact V2 wire schema reference",
  );

const WireFieldNameV2Schema = z.string()
  .min(1)
  .max(100)
  .regex(/^[a-z][A-Za-z0-9]*$/);

const WireFieldKindV2Schema = z.enum([
  "ascii_token",
  "boolean",
  "enum",
  "nullable_runtime_uid_gid",
  "nullable_sha256",
  "nullable_uuid",
  "nonnegative_integer",
  "positive_integer",
  "runtime_uid_gid",
  "sha256",
  "stable_ref",
  "uuid",
]);

const WireFieldDefinitionV2Schema = z.object({
  name: WireFieldNameV2Schema,
  kind: WireFieldKindV2Schema,
  enumValues: z.array(z.string().min(1).max(100))
    .min(1).max(32).nullable(),
}).strict().superRefine((value, context) => {
  if (
    (value.kind === "enum") !== (value.enumValues !== null)
    || value.enumValues !== null
      && new Set(value.enumValues).size !== value.enumValues.length
  ) {
    context.addIssue({
      code: "custom",
      path: ["enumValues"],
      message:
        "Wire field enum values must be present, unique, and enum-only",
    });
  }
});

const WireSchemaContractIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_CONTRACT_V2_SCHEMA,
  ),
  schemaRef: WireSchemaRefV2Schema,
  messageKind: z.enum([
    "operation_failure",
    "operation_input",
    "operation_success",
  ]),
  encoding: z.literal("bounded_canonical_json_utf8_v2"),
  transport: z.enum([
    "preopened_read_only_fd3_exactly_once_v2",
    "single_canonical_json_stdout_line_v2",
  ]),
  maxCanonicalBytes: z.number().int().positive()
    .max(PLATFORM_RELEASE_BOOTSTRAP_WIRE_MESSAGE_MAX_CANONICAL_BYTES_V2),
  relationPolicy: z.enum([
    "lookup_record_state_nullable_fields_all_or_none_equal_uid_gid_v2",
    "network_all_attempts_denied_v2",
    "none",
    "runtime_uid_gid_equal_distinct_observation_receipts_equal_states_v2",
  ]),
  fields: z.array(WireFieldDefinitionV2Schema).min(1).max(32),
}).strict().superRefine((value, context) => {
  const names = value.fields.map((field) => field.name);
  if (
    new Set(names).size !== names.length
    || names.some((name) =>
      name === "schema"
      || name === "version"
      || name === "messageHash")
  ) {
    context.addIssue({
      code: "custom",
      path: ["fields"],
      message:
        "Wire schema fields must be unique and cannot replace envelope fields",
    });
  }
});

export type PlatformReleaseBootstrapWireSchemaContractHashPayloadV2 =
  z.infer<typeof WireSchemaContractIdentityV2Schema>;

let exactWireContractCanonicalByRefV2:
ReadonlyMap<string, string> | undefined;

export function hashPlatformReleaseBootstrapWireSchemaContractV2(
  value:
    | PlatformReleaseBootstrapWireSchemaContractHashPayloadV2
    | PlatformReleaseBootstrapWireSchemaContractV2,
): string {
  const contract = { ...value } as Record<string, unknown>;
  delete contract.wireSchemaHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-wire-schema-contract-hash.v2",
    contract,
  });
}

export const PlatformReleaseBootstrapWireSchemaContractV2Schema =
  WireSchemaContractIdentityV2Schema.extend({
    wireSchemaHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const exactCanonical =
      exactWireContractCanonicalByRefV2?.get(value.schemaRef);
    if (
      value.wireSchemaHash
        !== hashPlatformReleaseBootstrapWireSchemaContractV2(value)
      || exactWireContractCanonicalByRefV2 !== undefined
        && exactCanonical !== canonicalJsonStringify(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["wireSchemaHash"],
        message:
          "Bootstrap wire schema contract must be one exact code-owned member",
      });
    }
  });

export type PlatformReleaseBootstrapWireSchemaContractV2 =
  z.infer<typeof PlatformReleaseBootstrapWireSchemaContractV2Schema>;

type WireFieldDefinitionV2 =
  z.infer<typeof WireFieldDefinitionV2Schema>;

function field(
  name: string,
  kind: WireFieldDefinitionV2["kind"],
  enumValues: readonly string[] | null = null,
): WireFieldDefinitionV2 {
  return {
    name,
    kind,
    enumValues: enumValues === null ? null : [...enumValues],
  };
}

function input(
  schemaRef: string,
  fields: readonly WireFieldDefinitionV2[],
  maxCanonicalBytes = 256 * 1024,
  relationPolicy:
    PlatformReleaseBootstrapWireSchemaContractHashPayloadV2[
      "relationPolicy"
    ] = "none",
): PlatformReleaseBootstrapWireSchemaContractHashPayloadV2 {
  return {
    schema: PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_CONTRACT_V2_SCHEMA,
    schemaRef,
    messageKind: "operation_input",
    encoding: "bounded_canonical_json_utf8_v2",
    transport: "preopened_read_only_fd3_exactly_once_v2",
    maxCanonicalBytes,
    relationPolicy,
    fields: [
      field("occurrenceId", "uuid"),
      ...fields.map((entry) => ({ ...entry })),
    ],
  };
}

function success(
  schemaRef: string,
  fields: readonly WireFieldDefinitionV2[],
  maxCanonicalBytes = 512 * 1024,
  relationPolicy:
    PlatformReleaseBootstrapWireSchemaContractHashPayloadV2[
      "relationPolicy"
    ] = "none",
): PlatformReleaseBootstrapWireSchemaContractHashPayloadV2 {
  return {
    schema: PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_CONTRACT_V2_SCHEMA,
    schemaRef,
    messageKind: "operation_success",
    encoding: "bounded_canonical_json_utf8_v2",
    transport: "single_canonical_json_stdout_line_v2",
    maxCanonicalBytes,
    relationPolicy,
    fields: [
      field("occurrenceId", "uuid"),
      ...fields.map((entry) => ({ ...entry })),
    ],
  };
}

function failure(
  schemaRef: string,
  fields: readonly WireFieldDefinitionV2[],
  maxCanonicalBytes = 64 * 1024,
): PlatformReleaseBootstrapWireSchemaContractHashPayloadV2 {
  return {
    schema: PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_CONTRACT_V2_SCHEMA,
    schemaRef,
    messageKind: "operation_failure",
    encoding: "bounded_canonical_json_utf8_v2",
    transport: "single_canonical_json_stdout_line_v2",
    maxCanonicalBytes,
    relationPolicy: "none",
    fields: [
      field("occurrenceId", "uuid"),
      ...fields.map((entry) => ({ ...entry })),
    ],
  };
}

const wireSchemaIdentitiesV2 = [
  input("setfarm.platform-release-apply-local-account-input.v2", [
    field("accountRef", "stable_ref"),
    field("accountPolicyHash", "sha256"),
    field("preclaimHash", "sha256"),
    field("intentHash", "sha256"),
    field("planReceiptHash", "sha256"),
    field("absenceObservationSetHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-apply-local-account-receipt.v2", [
    field("accountRef", "stable_ref"),
    field("preclaimHash", "sha256"),
    field("intentHash", "sha256"),
    field("recordIdentityHash", "sha256"),
    field("mutationReceiptHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  input("setfarm.platform-release-host-operation-input.v2", [
    field("operationScopeHash", "sha256"),
    field("targetRootPhysicalIdentityHash", "sha256"),
    field("requestPayloadHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ], 512 * 1024),
  success("setfarm.platform-release-host-operation-receipt.v2", [
    field("operationScopeHash", "sha256"),
    field("targetRootPhysicalIdentityHash", "sha256"),
    field("operationOutcome", "enum", ["completed"]),
    field("stableResultHash", "sha256"),
    field("resultByteLength", "nonnegative_integer"),
    field("operationObservationHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ], 1024 * 1024),
  input("setfarm.platform-release-lookup-local-account-input.v2", [
    field("accountRef", "stable_ref"),
    field("accountPolicyHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-lookup-local-account-receipt.v2", [
    field("accountRef", "stable_ref"),
    field("recordState", "enum", ["absent", "present_exact"]),
    field("uid", "nullable_runtime_uid_gid"),
    field("gid", "nullable_runtime_uid_gid"),
    field("userRecordUuid", "nullable_uuid"),
    field("groupRecordUuid", "nullable_uuid"),
    field("recordIdentityHash", "nullable_sha256"),
    field("hostIdentityHash", "sha256"),
    field("observationHash", "sha256"),
  ], 512 * 1024,
  "lookup_record_state_nullable_fields_all_or_none_equal_uid_gid_v2"),
  input("setfarm.platform-release-metadata-probe-input.v2", [
    field("targetRootPhysicalIdentityHash", "sha256"),
    field("metadataPolicyHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ]),
  success("setfarm.platform-release-metadata-probe-receipt.v2", [
    field("targetRootPhysicalIdentityHash", "sha256"),
    field("metadataPolicyHash", "sha256"),
    field(
      "observationOutcome",
      "enum",
      ["metadata_policy_satisfied"],
    ),
    field("observedEntryCount", "nonnegative_integer"),
    field("metadataCatalogHash", "sha256"),
    field("metadataObservationHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ]),
  input("setfarm.platform-release-module-export-probe-input.v2", [
    field("moduleRef", "stable_ref"),
    field("moduleContentHash", "sha256"),
    field("requiredExportSetHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ]),
  success("setfarm.platform-release-module-export-probe-receipt.v2", [
    field("moduleRef", "stable_ref"),
    field("moduleContentHash", "sha256"),
    field("loadOutcome", "enum", ["loaded"]),
    field("observedExportCount", "positive_integer"),
    field("observedExportSetHash", "sha256"),
    field("observedExportKindSetHash", "sha256"),
    field("moduleLoadObservationHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ]),
  input("setfarm.platform-release-network-negative-probe-input.v2", [
    field("targetRootPhysicalIdentityHash", "sha256"),
    field("sandboxPolicyHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ]),
  success("setfarm.platform-release-network-negative-probe-receipt.v2", [
    field("targetRootPhysicalIdentityHash", "sha256"),
    field("sandboxPolicyHash", "sha256"),
    field("probeOutcome", "enum", ["all_denied"]),
    field("attemptedProbeCount", "positive_integer"),
    field("deniedProbeCount", "positive_integer"),
    field("deniedProbeSetHash", "sha256"),
    field("networkObservationHash", "sha256"),
    field("hostCompositionReceiptHash", "sha256"),
  ], 512 * 1024, "network_all_attempts_denied_v2"),
  input("setfarm.platform-release-plan-local-account-input.v2", [
    field("accountRef", "stable_ref"),
    field("accountPolicyHash", "sha256"),
    field("verifierPackageVerificationHash", "sha256"),
    field("verifierSelfAttestationHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-plan-local-account-receipt.v2", [
    field("accountRef", "stable_ref"),
    field("uid", "runtime_uid_gid"),
    field("gid", "runtime_uid_gid"),
    field("userRecordUuid", "uuid"),
    field("groupRecordUuid", "uuid"),
    field("absenceObservationBeforeReceiptHash", "sha256"),
    field("absenceObservationAfterReceiptHash", "sha256"),
    field("absenceObservationBeforeStateHash", "sha256"),
    field("absenceObservationAfterStateHash", "sha256"),
    field("absenceObservationSetHash", "sha256"),
    field("intentHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ], 512 * 1024,
  "runtime_uid_gid_equal_distinct_observation_receipts_equal_states_v2"),
  input("setfarm.platform-release-rollback-local-account-input.v2", [
    field("accountRef", "stable_ref"),
    field("preclaimHash", "sha256"),
    field("mutationReceiptHash", "sha256"),
    field("expectedRecordIdentityHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-rollback-local-account-receipt.v2", [
    field("accountRef", "stable_ref"),
    field("preclaimHash", "sha256"),
    field("finalRecordState", "enum", ["absent", "removed_exact"]),
    field("tombstoneHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  input("setfarm.platform-release-self-attest-input.v2", [
    field("challengeHash", "sha256"),
    field("admittedExecutablePhysicalIdentityHash", "sha256"),
    field("distributionAttestationHash", "sha256"),
    field("operationAbiSetHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-self-attest-receipt.v2", [
    field("challengeHash", "sha256"),
    field("executableContentHash", "sha256"),
    field("executablePhysicalIdentityHash", "sha256"),
    field("designatedRequirementHash", "sha256"),
    field("embeddedReleaseKeyHash", "sha256"),
    field("distributionAttestationHash", "sha256"),
    field("operationAbiSetHash", "sha256"),
    field("hostIdentityHash", "sha256"),
    field("selfAttestationHash", "sha256"),
  ]),
  input("setfarm.platform-release-verify-package-input.v2", [
    field("packageRef", "stable_ref"),
    field("packageContractHash", "sha256"),
    field("expectedManifestHash", "sha256"),
    field("epochStateHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-verify-package-receipt.v2", [
    field("packageRef", "stable_ref"),
    field("packageContractHash", "sha256"),
    field("manifestHash", "sha256"),
    field("physicalClosureHash", "sha256"),
    field("sourceAuthorityHash", "sha256"),
    field("epochStateHash", "sha256"),
    field("verifierSelfAttestationHash", "sha256"),
    field("hostIdentityHash", "sha256"),
    field("verificationHash", "sha256"),
  ]),
  input("setfarm.platform-release-verify-system-anchors-input.v2", [
    field("systemPolicyHash", "sha256"),
    field("hostIdentityHash", "sha256"),
  ]),
  success("setfarm.platform-release-verify-system-anchors-receipt.v2", [
    field("systemPolicyHash", "sha256"),
    field("parentSetHash", "sha256"),
    field("physicalFileSetHash", "sha256"),
    field("logicalBindingHash", "sha256"),
    field("verifierSelfAttestationHash", "sha256"),
    field("hostIdentityHash", "sha256"),
    field("verificationHash", "sha256"),
  ]),
] as const;

const failureIdentityV2 = failure(
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  [
    field("operationAbiRef", "stable_ref"),
    field("errorCode", "enum", [
      "AUTHORITY_DRIFT",
      "AUTHORITY_UNAVAILABLE",
      "EXECUTION_FAILED",
      "INPUT_INVALID",
      "INTERNAL_FAILURE",
      "OUTPUT_INVALID",
      "POLICY_MISMATCH",
      "TIMEOUT",
    ]),
    field("phaseRef", "stable_ref"),
    field("retryDisposition", "enum", [
      "retry_after_authority_delta",
      "terminal",
    ]),
    field("authorityStateHash", "nullable_sha256"),
    field("diagnosticHash", "sha256"),
  ],
  64 * 1024,
);

const allWireIdentitiesV2 = [
  ...wireSchemaIdentitiesV2,
  failureIdentityV2,
].sort((left, right) =>
  left.schemaRef < right.schemaRef
    ? -1
    : left.schemaRef > right.schemaRef
      ? 1
      : 0);

const wireContractsV2 =
  allWireIdentitiesV2.map((identity) => ({
    ...identity,
    wireSchemaHash:
      hashPlatformReleaseBootstrapWireSchemaContractV2(identity),
  }));

exactWireContractCanonicalByRefV2 = new Map(
  wireContractsV2.map((contract) => [
    contract.schemaRef,
    canonicalJsonStringify(contract),
  ]),
);

const WireContractSetIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_AUTHORITY_REF_V2,
  ),
  encodingPolicy: z.literal(
    "strict_bounded_canonical_json_self_hashed_messages_v2",
  ),
  inputTransport: z.literal(
    "preopened_read_only_fd3_exactly_once_v2",
  ),
  successTransport: z.literal(
    "single_canonical_json_stdout_line_v2",
  ),
  failureTransport: z.literal(
    "single_canonical_json_stdout_line_v2",
  ),
  failureSchemaRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  ),
  schemaCount: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_COUNT_V2,
  ),
  schemas: z.array(
    PlatformReleaseBootstrapWireSchemaContractV2Schema,
  ).length(PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_COUNT_V2),
}).strict();

export type PlatformReleaseBootstrapWireContractSetHashPayloadV2 =
  z.infer<typeof WireContractSetIdentityV2Schema>;

export function hashPlatformReleaseBootstrapWireContractSetV2(
  value:
    | PlatformReleaseBootstrapWireContractSetHashPayloadV2
    | PlatformReleaseBootstrapWireContractSetV2,
): string {
  const contractSet = { ...value } as Record<string, unknown>;
  delete contractSet.contractSetHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-wire-contract-set-hash.v2",
    contractSet,
  });
}

const wireContractSetIdentityV2 = {
  schema: PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  authorityRef:
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_AUTHORITY_REF_V2,
  encodingPolicy:
    "strict_bounded_canonical_json_self_hashed_messages_v2",
  inputTransport:
    "preopened_read_only_fd3_exactly_once_v2",
  successTransport:
    "single_canonical_json_stdout_line_v2",
  failureTransport:
    "single_canonical_json_stdout_line_v2",
  failureSchemaRef:
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  schemaCount: PLATFORM_RELEASE_BOOTSTRAP_WIRE_SCHEMA_COUNT_V2,
  schemas: wireContractsV2,
} as const;

export const PlatformReleaseBootstrapWireContractSetV2Schema =
  WireContractSetIdentityV2Schema.extend({
    contractSetHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { contractSetHash: _contractSetHash, ...identity } = value;
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_MAX_CANONICAL_BYTES_V2,
      )
      || canonicalJsonStringify(identity)
        !== canonicalJsonStringify(wireContractSetIdentityV2)
      || value.contractSetHash
        !== hashPlatformReleaseBootstrapWireContractSetV2(identity)
      || value.schemas.some((schema, index) =>
        index > 0
        && value.schemas[index - 1]!.schemaRef >= schema.schemaRef)
    ) {
      context.addIssue({
        code: "custom",
        path: ["contractSetHash"],
        message:
          "Bootstrap wire contract set must equal the exact code-owned catalog",
      });
    }
  });

export type PlatformReleaseBootstrapWireContractSetV2 =
  z.infer<typeof PlatformReleaseBootstrapWireContractSetV2Schema>;

export const PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2:
PlatformReleaseBootstrapWireContractSetV2 =
  deepFreezePlatformReleaseJsonV2({
    ...PlatformReleaseBootstrapWireContractSetV2Schema.parse({
      ...wireContractSetIdentityV2,
      contractSetHash:
        hashPlatformReleaseBootstrapWireContractSetV2(
          wireContractSetIdentityV2,
        ),
    }),
  });

const RuntimeUidGidV2Schema = z.string()
  .regex(/^(?:6[0-9]{2})$/)
  .refine((value) => {
    const parsed = Number(value);
    return parsed >= 600 && parsed <= 699;
  }, {
    message: "Expected one code-owned runtime UID/GID in 600..699",
  });
const UuidV2Schema = z.string().regex(
  /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/,
);
const AsciiTokenV2Schema = z.string().min(1).max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/);

function fieldRuntimeSchema(
  definition: WireFieldDefinitionV2,
): z.ZodType {
  switch (definition.kind) {
    case "ascii_token":
      return AsciiTokenV2Schema;
    case "boolean":
      return z.boolean();
    case "enum":
      return z.enum(
        definition.enumValues as [string, ...string[]],
      );
    case "nullable_runtime_uid_gid":
      return RuntimeUidGidV2Schema.nullable();
    case "nullable_sha256":
      return Sha256Schema.nullable();
    case "nullable_uuid":
      return UuidV2Schema.nullable();
    case "nonnegative_integer":
      return z.number().int().nonnegative().safe();
    case "positive_integer":
      return z.number().int().positive().safe();
    case "runtime_uid_gid":
      return RuntimeUidGidV2Schema;
    case "sha256":
      return Sha256Schema;
    case "stable_ref":
      return StableReferenceSchema;
    case "uuid":
      return UuidV2Schema;
  }
}

export function hashPlatformReleaseBootstrapWireMessageV2(
  schemaRef: string,
  value: Readonly<Record<string, unknown>>,
): string {
  const message = { ...value };
  delete message.messageHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-wire-message-hash.v2",
    schemaRef,
    message,
  });
}

const runtimeSchemasV2 = new Map<string, z.ZodType>();
for (const contract of wireContractsV2) {
  const shape: Record<string, z.ZodType> = {
    schema: z.literal(contract.schemaRef),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  };
  for (const definition of contract.fields) {
    shape[definition.name] = fieldRuntimeSchema(definition);
  }
  shape.messageHash = Sha256Schema;
  runtimeSchemasV2.set(
    contract.schemaRef,
    z.object(shape).strict().superRefine((value, context) => {
      const nullableLookupFields = [
        "uid",
        "gid",
        "userRecordUuid",
        "groupRecordUuid",
        "recordIdentityHash",
      ] as const;
      const lookupRelationInvalid =
        contract.relationPolicy
          ===
            "lookup_record_state_nullable_fields_all_or_none_equal_uid_gid_v2"
        && (
          value.recordState === "absent"
            ? nullableLookupFields.some((name) =>
              value[name] !== null)
            : value.recordState === "present_exact"
              ? nullableLookupFields.some((name) =>
                value[name] === null)
                || value.uid !== value.gid
              : true
        );
      const doubleObservationRelationInvalid =
        contract.relationPolicy
          ===
            "runtime_uid_gid_equal_distinct_observation_receipts_equal_states_v2"
        && (
          value.absenceObservationBeforeReceiptHash
            === value.absenceObservationAfterReceiptHash
          || value.absenceObservationBeforeStateHash
            !== value.absenceObservationAfterStateHash
        );
      const networkRelationInvalid =
        contract.relationPolicy === "network_all_attempts_denied_v2"
        && value.probeOutcome === "all_denied"
        && value.attemptedProbeCount !== value.deniedProbeCount;
      const runtimeUidGidRelationInvalid =
        contract.relationPolicy
          ===
            "runtime_uid_gid_equal_distinct_observation_receipts_equal_states_v2"
        && value.uid !== value.gid;
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          contract.maxCanonicalBytes,
        )
        || lookupRelationInvalid
        || doubleObservationRelationInvalid
        || networkRelationInvalid
        || runtimeUidGidRelationInvalid
        || value.messageHash
          !== hashPlatformReleaseBootstrapWireMessageV2(
            contract.schemaRef,
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["messageHash"],
          message:
            "Bootstrap wire message must be bounded, relationally exact, and self-hashed",
        });
      }
    }),
  );
}

export function getPlatformReleaseBootstrapWireContractSetV2():
PlatformReleaseBootstrapWireContractSetV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2,
    ),
  );
}

export function getPlatformReleaseBootstrapWireSchemaContractV2(
  schemaRef: string,
): PlatformReleaseBootstrapWireSchemaContractV2 {
  const found =
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas
      .find((entry) => entry.schemaRef === schemaRef);
  if (!found) {
    throw new TypeError(
      "Bootstrap wire schema reference is not code-owned",
    );
  }
  return deepFreezePlatformReleaseJsonV2(structuredClone(found));
}

export function parsePlatformReleaseBootstrapWireMessageV2(
  schemaRef: string,
  input: unknown,
): Readonly<Record<string, unknown>> {
  const contract =
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_SET_V2.schemas
      .find((entry) => entry.schemaRef === schemaRef);
  const schema = runtimeSchemasV2.get(schemaRef);
  if (!contract || !schema) {
    throw new TypeError(
      "Bootstrap wire schema reference is not code-owned",
    );
  }
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    contract.maxCanonicalBytes,
  );
  return deepFreezePlatformReleaseJsonV2(
    schema.parse(snapshot) as Readonly<Record<string, unknown>>,
  );
}

export function parsePlatformReleaseBootstrapWireContractSetCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapWireContractSetV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_WIRE_CONTRACT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapWireContractSetV2Schema.parse(snapshot),
  );
}
