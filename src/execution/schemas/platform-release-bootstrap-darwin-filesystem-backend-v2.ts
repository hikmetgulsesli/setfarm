import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  BootstrapFilesystemScopeIdentityV2Schema,
  DirectoryMembershipIdentityV2Schema,
  FsObservationFingerprintV2Schema,
  StableFsObjectIdentityV2Schema,
  StableFsObjectKindV2Schema,
} from "../../product-compiler/platform-release-bootstrap-physical-census-v2.js";
import { PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2 } from "./platform-release-bootstrap-contract-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2,
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
} from "./platform-release-bootstrap-darwin-capture-transcripts-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-abi-set.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-operation.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_CAPABILITY_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-capability-receipt.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-wire-contract-catalog.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_REQUEST_FRAME_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-request-frame.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_SUCCESS_FRAME_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-success-frame.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FAILURE_FRAME_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-filesystem-backend-failure-frame.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_AUTHORITY_REF_V2 =
  "AUTH_PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  128 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2 =
  1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2 = 65_536;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2 = 512;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2 =
  Object.freeze([
    "ACQUIRE_CODE_OWNED_LOCK_SESSION_V2",
    "CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2",
    "CAPTURE_EXACT_ENTRY_TWICE_V2",
    "CLOSE_OR_ABORT_SESSION_V2",
    "CREATE_PRIVATE_DIRECTORY_EXCLUSIVE_V2",
    "CREATE_PRIVATE_FILE_EXCLUSIVE_V2",
    "FULL_SYNC_DIRECTORY_V2",
    "FULL_SYNC_FILE_V2",
    "GENERATE_FILESYSTEM_SCOPE_NONCE_V2",
    "LINK_FIXED_STAGED_FILE_NO_REPLACE_V2",
    "PIN_FIXED_CHILD_DIRECTORY_V2",
    "REMOVE_EXACT_EMPTY_DIRECTORY_V2",
    "RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2",
    "REVALIDATE_FIXED_SESSION_V2",
    "SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2",
    "UNLINK_EXACT_OBSERVED_ENTRY_V2",
    "WRITE_EXACT_BOUNDED_FILE_V2",
  ] as const);

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2 =
  Object.freeze([
    "BOOTSTRAP_PARENT_V2",
    "FILESYSTEM_SCOPE_STAGE_V2",
    "FILESYSTEM_SCOPE_DOCUMENT_V2",
    "LEGACY_NODE_LOCK_V2",
    "SHARED_PARENT_LOCK_V2",
    "REGISTERED_PACKAGE_LOCK_V2",
    "TRANSACTION_STAGING_DIRECTORY_V2",
    "ACTIVATION_CLAIM_STAGE_V2",
    "ACTIVATION_CLAIM_V2",
    "ACTIVATION_RECEIPT_V2",
    "EPOCH_CLAIM_V2",
    "EPOCH_CLAIM_STAGE_V2",
    "EPOCH_FLOOR_V2",
    "STAGED_ACTIVATION_RECEIPT_V2",
    "STAGED_GENESIS_EPOCH_STATE_V2",
    "STAGED_SHARED_LOCK_V2",
    "STAGED_TARGET_EPOCH_STATE_V2",
  ] as const);

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2 =
  Object.freeze([
    Object.freeze({
      mappingRef: "FILESYSTEM_SCOPE_PUBLICATION_V2",
      sourceOperandRef: "FILESYSTEM_SCOPE_STAGE_V2",
      targetOperandRef: "FILESYSTEM_SCOPE_DOCUMENT_V2",
    }),
    Object.freeze({
      mappingRef: "ACTIVATION_CLAIM_PUBLICATION_V2",
      sourceOperandRef: "ACTIVATION_CLAIM_STAGE_V2",
      targetOperandRef: "ACTIVATION_CLAIM_V2",
    }),
    Object.freeze({
      mappingRef: "EPOCH_CLAIM_PUBLICATION_V2",
      sourceOperandRef: "EPOCH_CLAIM_STAGE_V2",
      targetOperandRef: "EPOCH_CLAIM_V2",
    }),
    Object.freeze({
      mappingRef: "ACTIVATION_RECEIPT_PUBLICATION_V2",
      sourceOperandRef: "STAGED_ACTIVATION_RECEIPT_V2",
      targetOperandRef: "ACTIVATION_RECEIPT_V2",
    }),
    Object.freeze({
      mappingRef: "GENESIS_EPOCH_PUBLICATION_V2",
      sourceOperandRef: "STAGED_GENESIS_EPOCH_STATE_V2",
      targetOperandRef: "EPOCH_FLOOR_V2",
    }),
    Object.freeze({
      mappingRef: "SHARED_LOCK_PUBLICATION_V2",
      sourceOperandRef: "STAGED_SHARED_LOCK_V2",
      targetOperandRef: "SHARED_PARENT_LOCK_V2",
    }),
  ] as const);

const legacyNodePackageV2 =
  PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.packages.find(
    (candidate) => candidate.packageKind === "legacy_node_compatibility",
  );
if (legacyNodePackageV2 === undefined) {
  throw new TypeError(
    "Darwin backend ABI requires the exact legacy Node package contract",
  );
}

const fixedFileOperandV2 = (
  operandRef: (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2)[number],
  parentRef: "BOOTSTRAP_PARENT_V2" | "TRANSACTION_STAGING_DIRECTORY_V2",
  codeOwnedName: string,
  contentPolicy:
    | "canonical_json_exact_hash_v2"
    | "fixed_lock_content_exact_hash_v2"
    | "registry_derived_package_lock_content_v2",
  linkPolicy: "exactly_one_v2" | "one_or_two_during_no_replace_publication_v2",
) =>
  Object.freeze({
    operandRef,
    parentRef,
    codeOwnedName,
    objectKind: "ordinary_file" as const,
    metadataPolicy: "root_uid_gid_mode_0600_v2" as const,
    contentPolicy,
    linkPolicy,
  });

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_CATALOG_V2 =
  Object.freeze([
    Object.freeze({
      operandRef: "BOOTSTRAP_PARENT_V2",
      parentRef: "PROCESS_FIXED_BOOTSTRAP_PARENT_V2",
      codeOwnedName: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.parent,
      objectKind: "directory",
      metadataPolicy: "root_uid_gid_mode_0755_v2",
      contentPolicy: "directory_membership_every_only_v2",
      linkPolicy: "directory_link_policy_v2",
    }),
    fixedFileOperandV2(
      "FILESYSTEM_SCOPE_STAGE_V2",
      "BOOTSTRAP_PARENT_V2",
      ".setfarm-bootstrap-filesystem-scope-v2.stage",
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "FILESYSTEM_SCOPE_DOCUMENT_V2",
      "BOOTSTRAP_PARENT_V2",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.filesystemScopeBasename,
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "LEGACY_NODE_LOCK_V2",
      "BOOTSTRAP_PARENT_V2",
      legacyNodePackageV2.lifecycle.packageLockBasename,
      "fixed_lock_content_exact_hash_v2",
      "exactly_one_v2",
    ),
    fixedFileOperandV2(
      "SHARED_PARENT_LOCK_V2",
      "BOOTSTRAP_PARENT_V2",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.sharedLockBasename,
      "fixed_lock_content_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "REGISTERED_PACKAGE_LOCK_V2",
      "BOOTSTRAP_PARENT_V2",
      "registry_classified_package_lock_slot",
      "registry_derived_package_lock_content_v2",
      "exactly_one_v2",
    ),
    Object.freeze({
      operandRef: "TRANSACTION_STAGING_DIRECTORY_V2",
      parentRef: "BOOTSTRAP_PARENT_V2",
      codeOwnedName:
        PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry
          .transactionStagingBasename,
      objectKind: "directory",
      metadataPolicy: "root_uid_gid_mode_0700_v2",
      contentPolicy: "directory_membership_every_only_v2",
      linkPolicy: "directory_link_policy_v2",
    }),
    fixedFileOperandV2(
      "ACTIVATION_CLAIM_STAGE_V2",
      "BOOTSTRAP_PARENT_V2",
      ".setfarm-bootstrap-package-registry-v2.activation-claim.stage",
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "ACTIVATION_CLAIM_V2",
      "BOOTSTRAP_PARENT_V2",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.activationClaimBasename,
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "ACTIVATION_RECEIPT_V2",
      "BOOTSTRAP_PARENT_V2",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.activationReceiptBasename,
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "EPOCH_CLAIM_V2",
      "BOOTSTRAP_PARENT_V2",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.epochClaimBasename,
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "EPOCH_CLAIM_STAGE_V2",
      "BOOTSTRAP_PARENT_V2",
      ".setfarm-bootstrap-package-registry-v2.epoch-claim.stage",
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "EPOCH_FLOOR_V2",
      "BOOTSTRAP_PARENT_V2",
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.registry.epochFloorBasename,
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "STAGED_ACTIVATION_RECEIPT_V2",
      "TRANSACTION_STAGING_DIRECTORY_V2",
      "staged_activation_receipt",
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "STAGED_GENESIS_EPOCH_STATE_V2",
      "TRANSACTION_STAGING_DIRECTORY_V2",
      "staged_genesis_epoch_state",
      "canonical_json_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "STAGED_SHARED_LOCK_V2",
      "TRANSACTION_STAGING_DIRECTORY_V2",
      "staged_shared_lock",
      "fixed_lock_content_exact_hash_v2",
      "one_or_two_during_no_replace_publication_v2",
    ),
    fixedFileOperandV2(
      "STAGED_TARGET_EPOCH_STATE_V2",
      "TRANSACTION_STAGING_DIRECTORY_V2",
      "staged_target_epoch_state",
      "canonical_json_exact_hash_v2",
      "exactly_one_v2",
    ),
  ] as const);

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_BLOCKER_CODES_V2 =
  Object.freeze([
    "SIGNED_NATIVE_DISTRIBUTION_UNAVAILABLE",
    "EXPECTED_PRIOR_ATOMIC_REPLACE_UNPROVEN",
    "ALL_COMPONENT_BENEATH_RESOLUTION_UNPROVEN",
    "DIRECTORY_POWER_LOSS_DURABILITY_UNPROVEN",
    "PAGINATED_CAPTURE_LIVE_LEDGER_UNAVAILABLE",
  ] as const);

const OperationRefV2Schema = z.enum(
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2,
);

const OperationClassV2Schema = z.enum([
  "cleanup",
  "durability",
  "entropy",
  "observation",
  "publication",
  "session",
]);

const FixedOperandRefV2Schema = z.enum(
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2,
);

const FixedOperandCatalogEntryV2Schema = z
  .object({
    operandRef: FixedOperandRefV2Schema,
    parentRef: z.enum([
      "PROCESS_FIXED_BOOTSTRAP_PARENT_V2",
      "BOOTSTRAP_PARENT_V2",
      "TRANSACTION_STAGING_DIRECTORY_V2",
    ]),
    codeOwnedName: z.string().min(1).max(255),
    objectKind: z.enum(["directory", "ordinary_file"]),
    metadataPolicy: z.enum([
      "root_uid_gid_mode_0600_v2",
      "root_uid_gid_mode_0700_v2",
      "root_uid_gid_mode_0755_v2",
    ]),
    contentPolicy: z.enum([
      "canonical_json_exact_hash_v2",
      "directory_membership_every_only_v2",
      "fixed_lock_content_exact_hash_v2",
      "registry_derived_package_lock_content_v2",
    ]),
    linkPolicy: z.enum([
      "directory_link_policy_v2",
      "exactly_one_v2",
      "one_or_two_during_no_replace_publication_v2",
    ]),
  })
  .strict();

const NoReplacePublicationMappingV2Schema = z
  .object({
    mappingRef: z.enum([
      "FILESYSTEM_SCOPE_PUBLICATION_V2",
      "ACTIVATION_CLAIM_PUBLICATION_V2",
      "EPOCH_CLAIM_PUBLICATION_V2",
      "ACTIVATION_RECEIPT_PUBLICATION_V2",
      "GENESIS_EPOCH_PUBLICATION_V2",
      "SHARED_LOCK_PUBLICATION_V2",
    ]),
    sourceOperandRef: FixedOperandRefV2Schema,
    targetOperandRef: FixedOperandRefV2Schema,
  })
  .strict();

const OperationFieldKindV2Schema = z.enum([
  "bounded_bytes",
  "closed_session_receipt",
  "directory_membership",
  "durability_receipt",
  "expected_absence",
  "exact_entry_content_evidence",
  "filesystem_scope_identity",
  "lock_intent",
  "mutable_fingerprint",
  "nonnegative_integer",
  "opaque_slot_ref",
  "opaque_slot_membership",
  "opaque_member_slot_bindings",
  "operand_ref",
  "publication_mapping_ref",
  "scope_nonce",
  "sha256",
  "stable_object_identity",
]);

const OperationFieldV2Schema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z][A-Za-z0-9]*$/),
    kind: OperationFieldKindV2Schema,
  })
  .strict();

const OperationErrorCodeV2Schema = z.enum([
  "ALREADY_EXISTS",
  "ATTESTATION_FAILED",
  "CONTENT_MISMATCH",
  "CROSS_DEVICE",
  "DURABILITY_UNAVAILABLE",
  "IDENTITY_MISMATCH",
  "INVALID_OPERAND",
  "INVALID_SEQUENCE",
  "LOCK_LOST",
  "MEMBERSHIP_MISMATCH",
  "NOT_EMPTY",
  "OBJECT_ABSENT",
  "SESSION_CLOSED",
  "SYSCALL_FAILED",
]);

const SemanticPolicyV2Schema = z
  .string()
  .min(1)
  .max(240)
  .regex(/^[a-z][a-z0-9_]*_v2$/);

function operationWireSchemaRefV2(
  operationRef: (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2)[number],
  frameKind: "REQUEST" | "SUCCESS" | "FAILURE",
): string {
  return `DARWIN_BACKEND_${operationRef}_${frameKind}`;
}

const BackendOperationIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_V2_SCHEMA,
    ),
    operationRef: OperationRefV2Schema,
    operationClass: OperationClassV2Schema,
    operandPolicy: z.literal(
      "code_owned_refs_and_opaque_session_slots_only_v2",
    ),
    inputPolicy: z.literal(
      "bounded_canonical_fd3_frames_no_application_argv_v2",
    ),
    resultPolicy: z.literal(
      "pathless_sequence_bound_expected_observed_identity_receipt_v2",
    ),
    errorPolicy: z.literal(
      "closed_domain_errno_attached_no_ambient_fallback_v2",
    ),
    requestSchemaRef: z
      .string()
      .min(1)
      .max(180)
      .regex(/^[A-Z0-9_]+$/),
    successSchemaRef: z
      .string()
      .min(1)
      .max(180)
      .regex(/^[A-Z0-9_]+$/),
    failureSchemaRef: z
      .string()
      .min(1)
      .max(180)
      .regex(/^[A-Z0-9_]+$/),
    requestFields: z.array(OperationFieldV2Schema).max(16),
    resultFields: z.array(OperationFieldV2Schema).max(16),
    allowedOperandRefs: z
      .array(FixedOperandRefV2Schema)
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2.length,
      ),
    preconditionPolicy: SemanticPolicyV2Schema,
    slotTransitionPolicy: SemanticPolicyV2Schema,
    postconditionPolicy: SemanticPolicyV2Schema,
    errorCodes: z.array(OperationErrorCodeV2Schema).min(1).max(14),
  })
  .strict();

export type PlatformReleaseBootstrapDarwinFilesystemBackendOperationV2 =
  z.infer<typeof BackendOperationIdentityV2Schema>;

const operationClassByRefV2: Readonly<
  Record<
    (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2)[number],
    z.infer<typeof OperationClassV2Schema>
  >
> = Object.freeze({
  ACQUIRE_CODE_OWNED_LOCK_SESSION_V2: "session",
  CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2: "observation",
  CAPTURE_EXACT_ENTRY_TWICE_V2: "observation",
  CLOSE_OR_ABORT_SESSION_V2: "session",
  CREATE_PRIVATE_DIRECTORY_EXCLUSIVE_V2: "publication",
  CREATE_PRIVATE_FILE_EXCLUSIVE_V2: "publication",
  FULL_SYNC_DIRECTORY_V2: "durability",
  FULL_SYNC_FILE_V2: "durability",
  GENERATE_FILESYSTEM_SCOPE_NONCE_V2: "entropy",
  LINK_FIXED_STAGED_FILE_NO_REPLACE_V2: "publication",
  PIN_FIXED_CHILD_DIRECTORY_V2: "session",
  REMOVE_EXACT_EMPTY_DIRECTORY_V2: "cleanup",
  RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2: "publication",
  REVALIDATE_FIXED_SESSION_V2: "observation",
  SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2: "session",
  UNLINK_EXACT_OBSERVED_ENTRY_V2: "cleanup",
  WRITE_EXACT_BOUNDED_FILE_V2: "publication",
});

const fieldV2 = (
  name: string,
  kind: z.infer<typeof OperationFieldKindV2Schema>,
) => Object.freeze({ name, kind });

const operationSemanticsByRefV2 = Object.freeze({
  ACQUIRE_CODE_OWNED_LOCK_SESSION_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("lockOperand", "operand_ref"),
      fieldV2("lockIntent", "lock_intent"),
      fieldV2("observedLockSlot", "opaque_slot_ref"),
      fieldV2("expectedLockIdentity", "stable_object_identity"),
      fieldV2("expectedLockFingerprint", "mutable_fingerprint"),
      fieldV2("expectedLockContentHash", "sha256"),
    ],
    resultFields: [
      fieldV2("lockSlot", "opaque_slot_ref"),
      fieldV2("lockIdentity", "stable_object_identity"),
      fieldV2("lockFingerprint", "mutable_fingerprint"),
      fieldV2("lockContentHash", "sha256"),
      fieldV2("lockEvidenceHash", "sha256"),
    ],
    allowedOperandRefs: [
      "LEGACY_NODE_LOCK_V2",
      "SHARED_PARENT_LOCK_V2",
      "REGISTERED_PACKAGE_LOCK_V2",
    ],
    preconditionPolicy:
      "session_open_sequence_exact_lock_order_and_operand_fixed_v2",
    slotTransitionPolicy: "fresh_lock_slot_created_and_owned_by_session_v2",
    postconditionPolicy:
      "lock_identity_and_exclusive_ownership_authenticated_v2",
    errorCodes: [
      "ALREADY_EXISTS",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("directorySlot", "opaque_slot_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
    ],
    resultFields: [
      fieldV2("directoryIdentity", "stable_object_identity"),
      fieldV2("directoryFingerprint", "mutable_fingerprint"),
      fieldV2("firstMembership", "directory_membership"),
      fieldV2("secondMembership", "directory_membership"),
      fieldV2("memberBindings", "opaque_member_slot_bindings"),
    ],
    allowedOperandRefs: [],
    preconditionPolicy:
      "session_open_sequence_exact_pinned_directory_identity_v2",
    slotTransitionPolicy:
      "existing_directory_revalidated_and_exact_member_slots_pinned_v2",
    postconditionPolicy:
      "same_identity_fingerprint_membership_and_indexed_member_bindings_twice_v2",
    errorCodes: [
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "MEMBERSHIP_MISMATCH",
      "OBJECT_ABSENT",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  CAPTURE_EXACT_ENTRY_TWICE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("entrySlot", "opaque_slot_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
    ],
    resultFields: [
      fieldV2("entrySlot", "opaque_slot_ref"),
      fieldV2("entryIdentity", "stable_object_identity"),
      fieldV2("entryFingerprint", "mutable_fingerprint"),
      fieldV2("contentEvidence", "exact_entry_content_evidence"),
    ],
    allowedOperandRefs: [],
    preconditionPolicy: "session_open_sequence_exact_pinned_member_identity_v2",
    slotTransitionPolicy:
      "existing_member_slot_revalidated_without_rebinding_v2",
    postconditionPolicy:
      "same_identity_fingerprint_and_kind_specific_content_observed_twice_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "OBJECT_ABSENT",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  CLOSE_OR_ABORT_SESSION_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("expectedTranscriptHash", "sha256"),
    ],
    resultFields: [
      fieldV2("closedSessionReceipt", "closed_session_receipt"),
      fieldV2("finalTranscriptHash", "sha256"),
    ],
    allowedOperandRefs: [],
    preconditionPolicy: "session_open_sequence_exact_and_transcript_matches_v2",
    slotTransitionPolicy: "all_session_slots_closed_exactly_once_v2",
    postconditionPolicy: "no_live_slot_or_lock_survives_closed_receipt_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  CREATE_PRIVATE_DIRECTORY_EXCLUSIVE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("parentSlot", "opaque_slot_ref"),
      fieldV2("expectedParentIdentity", "stable_object_identity"),
      fieldV2("directoryOperand", "operand_ref"),
      fieldV2("expectedAbsence", "expected_absence"),
    ],
    resultFields: [
      fieldV2("directorySlot", "opaque_slot_ref"),
      fieldV2("directoryIdentity", "stable_object_identity"),
    ],
    allowedOperandRefs: ["TRANSACTION_STAGING_DIRECTORY_V2"],
    preconditionPolicy:
      "session_open_sequence_exact_parent_and_absence_authenticated_v2",
    slotTransitionPolicy: "fresh_private_directory_slot_created_exclusively_v2",
    postconditionPolicy:
      "new_directory_identity_pinned_and_parent_membership_exact_v2",
    errorCodes: [
      "ALREADY_EXISTS",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  CREATE_PRIVATE_FILE_EXCLUSIVE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("parentSlot", "opaque_slot_ref"),
      fieldV2("expectedParentIdentity", "stable_object_identity"),
      fieldV2("fileOperand", "operand_ref"),
      fieldV2("expectedAbsence", "expected_absence"),
    ],
    resultFields: [
      fieldV2("fileSlot", "opaque_slot_ref"),
      fieldV2("fileIdentity", "stable_object_identity"),
    ],
    allowedOperandRefs: [
      "FILESYSTEM_SCOPE_STAGE_V2",
      "ACTIVATION_CLAIM_STAGE_V2",
      "EPOCH_CLAIM_STAGE_V2",
      "STAGED_ACTIVATION_RECEIPT_V2",
      "STAGED_GENESIS_EPOCH_STATE_V2",
      "STAGED_SHARED_LOCK_V2",
      "STAGED_TARGET_EPOCH_STATE_V2",
    ],
    preconditionPolicy:
      "session_open_sequence_exact_parent_and_absence_authenticated_v2",
    slotTransitionPolicy: "fresh_private_file_slot_created_exclusively_v2",
    postconditionPolicy:
      "new_empty_file_identity_pinned_and_parent_membership_exact_v2",
    errorCodes: [
      "ALREADY_EXISTS",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  FULL_SYNC_DIRECTORY_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("directorySlot", "opaque_slot_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
    ],
    resultFields: [fieldV2("durabilityReceipt", "durability_receipt")],
    allowedOperandRefs: [],
    preconditionPolicy:
      "session_open_sequence_exact_and_directory_identity_matches_v2",
    slotTransitionPolicy:
      "existing_directory_slot_revalidated_without_rebinding_v2",
    postconditionPolicy: "directory_power_loss_barrier_authenticated_v2",
    errorCodes: [
      "DURABILITY_UNAVAILABLE",
      "IDENTITY_MISMATCH",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  FULL_SYNC_FILE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("fileSlot", "opaque_slot_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
      fieldV2("expectedFingerprint", "mutable_fingerprint"),
      fieldV2("expectedContentHash", "sha256"),
    ],
    resultFields: [fieldV2("durabilityReceipt", "durability_receipt")],
    allowedOperandRefs: [],
    preconditionPolicy:
      "session_open_sequence_exact_identity_fingerprint_and_content_match_v2",
    slotTransitionPolicy: "existing_file_slot_revalidated_without_rebinding_v2",
    postconditionPolicy:
      "exact_file_content_power_loss_barrier_authenticated_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "DURABILITY_UNAVAILABLE",
      "IDENTITY_MISMATCH",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  GENERATE_FILESYSTEM_SCOPE_NONCE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
    ],
    resultFields: [fieldV2("scopeNonce", "scope_nonce")],
    allowedOperandRefs: [],
    preconditionPolicy:
      "session_open_sequence_exact_and_native_entropy_available_v2",
    slotTransitionPolicy:
      "session_transcript_advances_without_object_slot_change_v2",
    postconditionPolicy: "fresh_unpredictable_scope_nonce_bound_to_session_v2",
    errorCodes: ["INVALID_SEQUENCE", "SESSION_CLOSED", "SYSCALL_FAILED"],
  },
  LINK_FIXED_STAGED_FILE_NO_REPLACE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("sourceSlot", "opaque_slot_ref"),
      fieldV2("publicationMapping", "publication_mapping_ref"),
      fieldV2("expectedSourceIdentity", "stable_object_identity"),
      fieldV2("expectedSourceFingerprint", "mutable_fingerprint"),
      fieldV2("expectedSourceContentHash", "sha256"),
      fieldV2("expectedTargetAbsence", "expected_absence"),
    ],
    resultFields: [
      fieldV2("targetSlot", "opaque_slot_ref"),
      fieldV2("targetIdentity", "stable_object_identity"),
      fieldV2("targetFingerprint", "mutable_fingerprint"),
      fieldV2("targetContentHash", "sha256"),
    ],
    allowedOperandRefs: [
      "FILESYSTEM_SCOPE_STAGE_V2",
      "FILESYSTEM_SCOPE_DOCUMENT_V2",
      "ACTIVATION_CLAIM_STAGE_V2",
      "ACTIVATION_CLAIM_V2",
      "EPOCH_CLAIM_STAGE_V2",
      "EPOCH_CLAIM_V2",
      "STAGED_ACTIVATION_RECEIPT_V2",
      "ACTIVATION_RECEIPT_V2",
      "STAGED_GENESIS_EPOCH_STATE_V2",
      "EPOCH_FLOOR_V2",
      "STAGED_SHARED_LOCK_V2",
      "SHARED_PARENT_LOCK_V2",
    ],
    preconditionPolicy:
      "session_open_sequence_exact_mapping_source_fingerprint_content_and_target_absent_v2",
    slotTransitionPolicy:
      "target_slot_created_as_same_inode_without_rebinding_source_v2",
    postconditionPolicy:
      "target_same_identity_fingerprint_and_no_replace_authenticated_v2",
    errorCodes: [
      "ALREADY_EXISTS",
      "CROSS_DEVICE",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  PIN_FIXED_CHILD_DIRECTORY_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("parentSlot", "opaque_slot_ref"),
      fieldV2("expectedParentIdentity", "stable_object_identity"),
      fieldV2("directoryOperand", "operand_ref"),
      fieldV2("expectedDirectoryIdentity", "stable_object_identity"),
    ],
    resultFields: [
      fieldV2("directorySlot", "opaque_slot_ref"),
      fieldV2("directoryIdentity", "stable_object_identity"),
    ],
    allowedOperandRefs: ["TRANSACTION_STAGING_DIRECTORY_V2"],
    preconditionPolicy:
      "session_open_sequence_exact_parent_and_fixed_child_operand_v2",
    slotTransitionPolicy:
      "fresh_directory_slot_pinned_beneath_existing_parent_slot_v2",
    postconditionPolicy:
      "all_components_beneath_and_no_symlink_authenticated_v2",
    errorCodes: [
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "OBJECT_ABSENT",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  REMOVE_EXACT_EMPTY_DIRECTORY_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("parentSlot", "opaque_slot_ref"),
      fieldV2("expectedParentIdentity", "stable_object_identity"),
      fieldV2("directorySlot", "opaque_slot_ref"),
      fieldV2("directoryOperand", "operand_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
      fieldV2("expectedMembership", "directory_membership"),
    ],
    resultFields: [
      fieldV2("parentMembership", "directory_membership"),
      fieldV2("observedAbsence", "expected_absence"),
    ],
    allowedOperandRefs: ["TRANSACTION_STAGING_DIRECTORY_V2"],
    preconditionPolicy:
      "session_open_sequence_exact_identity_and_empty_membership_v2",
    slotTransitionPolicy:
      "directory_slot_consumed_only_after_exact_empty_removal_v2",
    postconditionPolicy:
      "exact_directory_absent_and_parent_membership_authenticated_v2",
    errorCodes: [
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "MEMBERSHIP_MISMATCH",
      "NOT_EMPTY",
      "OBJECT_ABSENT",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("sourceSlot", "opaque_slot_ref"),
      fieldV2("targetSlot", "opaque_slot_ref"),
      fieldV2("expectedSourceIdentity", "stable_object_identity"),
      fieldV2("expectedSourceFingerprint", "mutable_fingerprint"),
      fieldV2("expectedSourceContentHash", "sha256"),
      fieldV2("expectedPriorIdentity", "stable_object_identity"),
      fieldV2("expectedPriorFingerprint", "mutable_fingerprint"),
      fieldV2("expectedPriorContentHash", "sha256"),
    ],
    resultFields: [
      fieldV2("replacementTargetSlot", "opaque_slot_ref"),
      fieldV2("replacementIdentity", "stable_object_identity"),
      fieldV2("replacementFingerprint", "mutable_fingerprint"),
      fieldV2("replacementContentHash", "sha256"),
      fieldV2("consumedPriorHash", "sha256"),
    ],
    allowedOperandRefs: ["STAGED_TARGET_EPOCH_STATE_V2", "EPOCH_FLOOR_V2"],
    preconditionPolicy:
      "session_open_sequence_exact_source_and_prior_identity_fingerprint_content_v2",
    slotTransitionPolicy:
      "source_consumed_target_rebound_only_by_atomic_compare_replace_v2",
    postconditionPolicy:
      "expected_prior_replaced_or_namespace_unmodified_authenticated_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "CROSS_DEVICE",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "OBJECT_ABSENT",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  REVALIDATE_FIXED_SESSION_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("expectedTranscriptHash", "sha256"),
    ],
    resultFields: [
      fieldV2("transcriptHash", "sha256"),
      fieldV2("openSlotMembership", "opaque_slot_membership"),
    ],
    allowedOperandRefs: [],
    preconditionPolicy: "session_open_sequence_exact_and_transcript_matches_v2",
    slotTransitionPolicy:
      "all_open_slots_and_locks_revalidated_without_rebinding_v2",
    postconditionPolicy:
      "session_sequence_lock_and_identity_state_authenticated_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "IDENTITY_MISMATCH",
      "INVALID_SEQUENCE",
      "LOCK_LOST",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2: {
    requestFields: [
      fieldV2("challengeHash", "sha256"),
      fieldV2("initialSequence", "nonnegative_integer"),
    ],
    resultFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("attestationReceiptHash", "sha256"),
      fieldV2("bootstrapParentSlot", "opaque_slot_ref"),
      fieldV2("bootstrapParentIdentity", "stable_object_identity"),
      fieldV2("bootstrapParentFingerprint", "mutable_fingerprint"),
      fieldV2("filesystemScopeSlot", "opaque_slot_ref"),
      fieldV2("filesystemScopeIdentity", "filesystem_scope_identity"),
      fieldV2("filesystemScopeContentHash", "sha256"),
    ],
    allowedOperandRefs: ["BOOTSTRAP_PARENT_V2"],
    preconditionPolicy:
      "fresh_process_zero_argv_exact_binary_and_challenge_authenticated_v2",
    slotTransitionPolicy:
      "fresh_session_bootstrap_parent_and_fixed_scope_slots_created_once_v2",
    postconditionPolicy:
      "binary_distribution_host_abi_parent_and_fixed_scope_joined_v2",
    errorCodes: [
      "ATTESTATION_FAILED",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "SYSCALL_FAILED",
    ],
  },
  UNLINK_EXACT_OBSERVED_ENTRY_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("parentSlot", "opaque_slot_ref"),
      fieldV2("expectedParentIdentity", "stable_object_identity"),
      fieldV2("entrySlot", "opaque_slot_ref"),
      fieldV2("entryOperand", "operand_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
      fieldV2("expectedFingerprint", "mutable_fingerprint"),
      fieldV2("expectedContentHash", "sha256"),
    ],
    resultFields: [
      fieldV2("parentMembership", "directory_membership"),
      fieldV2("observedAbsence", "expected_absence"),
    ],
    allowedOperandRefs: [
      "FILESYSTEM_SCOPE_STAGE_V2",
      "ACTIVATION_CLAIM_STAGE_V2",
      "EPOCH_CLAIM_STAGE_V2",
      "STAGED_ACTIVATION_RECEIPT_V2",
      "STAGED_GENESIS_EPOCH_STATE_V2",
      "STAGED_SHARED_LOCK_V2",
      "STAGED_TARGET_EPOCH_STATE_V2",
      "ACTIVATION_CLAIM_V2",
      "EPOCH_CLAIM_V2",
    ],
    preconditionPolicy:
      "session_open_sequence_exact_identity_fingerprint_and_content_match_v2",
    slotTransitionPolicy: "entry_slot_consumed_only_after_exact_unlink_v2",
    postconditionPolicy:
      "exact_entry_absent_and_parent_membership_authenticated_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "IDENTITY_MISMATCH",
      "INVALID_OPERAND",
      "INVALID_SEQUENCE",
      "OBJECT_ABSENT",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
  WRITE_EXACT_BOUNDED_FILE_V2: {
    requestFields: [
      fieldV2("sessionSlot", "opaque_slot_ref"),
      fieldV2("sequence", "nonnegative_integer"),
      fieldV2("fileSlot", "opaque_slot_ref"),
      fieldV2("expectedIdentity", "stable_object_identity"),
      fieldV2("expectedPriorFingerprint", "mutable_fingerprint"),
      fieldV2("contentBytes", "bounded_bytes"),
      fieldV2("contentHash", "sha256"),
    ],
    resultFields: [
      fieldV2("fileIdentity", "stable_object_identity"),
      fieldV2("fileFingerprint", "mutable_fingerprint"),
      fieldV2("observedContentHash", "sha256"),
    ],
    allowedOperandRefs: [],
    preconditionPolicy:
      "session_open_sequence_exact_fresh_private_file_and_content_hash_v2",
    slotTransitionPolicy:
      "existing_file_slot_identity_preserved_while_fingerprint_changes_v2",
    postconditionPolicy:
      "bounded_exact_content_and_mutable_fingerprint_authenticated_v2",
    errorCodes: [
      "CONTENT_MISMATCH",
      "IDENTITY_MISMATCH",
      "INVALID_SEQUENCE",
      "SESSION_CLOSED",
      "SYSCALL_FAILED",
    ],
  },
} as const);

const exactOperationsV2 =
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2.map(
    (operationRef) =>
      Object.freeze({
        schema:
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_V2_SCHEMA,
        operationRef,
        operationClass: operationClassByRefV2[operationRef],
        operandPolicy: "code_owned_refs_and_opaque_session_slots_only_v2",
        inputPolicy: "bounded_canonical_fd3_frames_no_application_argv_v2",
        resultPolicy:
          "pathless_sequence_bound_expected_observed_identity_receipt_v2",
        errorPolicy: "closed_domain_errno_attached_no_ambient_fallback_v2",
        requestSchemaRef: operationWireSchemaRefV2(operationRef, "REQUEST"),
        successSchemaRef: operationWireSchemaRefV2(operationRef, "SUCCESS"),
        failureSchemaRef: operationWireSchemaRefV2(operationRef, "FAILURE"),
        ...operationSemanticsByRefV2[operationRef],
      } as const),
  );

const OpaqueSlotRefV2Schema = z.string().regex(/^slot_[a-f0-9]{64}$/);

const PublicationMappingRefV2Schema = z.enum(
  PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2.map(
    (mapping) => mapping.mappingRef,
  ) as [
    (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2)[number]["mappingRef"],
    ...(typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2)[number]["mappingRef"][],
  ],
);

const ExpectedAbsenceIdentityV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-darwin-expected-absence.v2",
    ),
    parentIdentity: StableFsObjectIdentityV2Schema,
    targetOperandRef: FixedOperandRefV2Schema,
    firstObservationHash: Sha256Schema,
    secondObservationHash: Sha256Schema,
  })
  .strict();

export function hashPlatformReleaseBootstrapDarwinExpectedAbsenceV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const identity = { ...value };
  delete identity.absenceHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-expected-absence-hash.v2",
    identity,
  });
}

const ExpectedAbsenceV2Schema = ExpectedAbsenceIdentityV2Schema.extend({
  absenceHash: Sha256Schema,
})
  .strict()
  .superRefine((value, context) => {
    const { absenceHash: _absenceHash, ...identity } = value;
    if (
      value.firstObservationHash === value.secondObservationHash ||
      value.absenceHash !==
        hashPlatformReleaseBootstrapDarwinExpectedAbsenceV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["absenceHash"],
        message:
          "Expected absence must bind two distinct authenticated observations",
      });
    }
  });

const BoundedBytesV2Schema = z
  .object({
    encoding: z.literal("base64"),
    byteLength: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2,
      ),
    contentBase64: z
      .string()
      .max(
        Math.ceil(
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2 /
            3,
        ) * 4,
      ),
    contentHash: Sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    const bytes = Buffer.from(value.contentBase64, "base64");
    if (
      bytes.byteLength !== value.byteLength ||
      bytes.toString("base64") !== value.contentBase64 ||
      createHash("sha256").update(bytes).digest("hex") !== value.contentHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["contentHash"],
        message: "Bounded bytes must use exact canonical base64 and SHA-256",
      });
    }
  });

const ExactEntryContentEvidenceV2Schema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("bounded_regular_file_bytes"),
        contentHash: Sha256Schema,
        contentBytes: BoundedBytesV2Schema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("directory_membership"),
        membership: DirectoryMembershipIdentityV2Schema,
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.kind === "bounded_regular_file_bytes" &&
      value.contentHash !== value.contentBytes.contentHash
    ) {
      context.addIssue({
        code: "custom",
        path: ["contentHash"],
        message:
          "Exact regular-file evidence must bind its bounded bytes hash",
      });
    }
  });

const OpaqueSlotMembershipIdentityV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-darwin-opaque-slot-membership.v2",
    ),
    slotCount: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
      ),
    orderedSlots: z
      .array(OpaqueSlotRefV2Schema)
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
      ),
  })
  .strict();

const OpaqueSlotMembershipV2Schema =
  OpaqueSlotMembershipIdentityV2Schema.extend({
    membershipHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const { membershipHash: _membershipHash, ...identity } = value;
      if (
        value.slotCount !== value.orderedSlots.length ||
        new Set(value.orderedSlots).size !== value.orderedSlots.length ||
        value.membershipHash !==
          hashCanonicalJson({
            schema:
              "setfarm.platform-release-bootstrap-darwin-opaque-slot-membership-hash.v2",
            identity,
          })
      ) {
        context.addIssue({
          code: "custom",
          path: ["membershipHash"],
          message:
            "Opaque slot membership must be exact, unique, and self-hashed",
        });
      }
    });

const OpaqueMemberSlotBindingEntryV2Schema = z
  .object({
    membershipIndex: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2 -
          1,
      ),
    basename: z
      .string()
      .min(1)
      .max(255)
      .refine(
        (value) =>
          value !== "." &&
          value !== ".." &&
          !value.includes("/") &&
          !value.includes("\\") &&
          !value.includes("\0"),
        "Expected one exact direct-child basename",
      ),
    objectKind: StableFsObjectKindV2Schema,
    slot: OpaqueSlotRefV2Schema,
    objectIdentity: StableFsObjectIdentityV2Schema,
  })
  .strict();

const OpaqueMemberSlotBindingsIdentityV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings.v2",
    ),
    filesystemScopeIdentityHash: Sha256Schema,
    entryCount: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2,
      ),
    orderedEntries: z
      .array(OpaqueMemberSlotBindingEntryV2Schema)
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2,
      ),
  })
  .strict();

const OpaqueMemberSlotBindingsV2Schema =
  OpaqueMemberSlotBindingsIdentityV2Schema.extend({
    bindingsHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const slots = new Set<string>();
      const objectLocators = new Set<string>();
      let ordered = true;
      let kindsMatch = true;
      let scopeMatches = true;
      for (let index = 0; index < value.orderedEntries.length; index += 1) {
        const entry = value.orderedEntries[index]!;
        const previous = value.orderedEntries[index - 1];
        if (previous !== undefined && previous.basename >= entry.basename) {
          ordered = false;
        }
        if (
          entry.membershipIndex !== index ||
          entry.objectIdentity.objectKind !== entry.objectKind
        ) {
          kindsMatch = false;
        }
        if (
          entry.objectIdentity.filesystemScopeIdentityHash !==
          value.filesystemScopeIdentityHash
        ) {
          scopeMatches = false;
        }
        slots.add(entry.slot);
        objectLocators.add(
          [
            entry.objectIdentity.filesystemScopeIdentityHash,
            entry.objectIdentity.device,
            entry.objectIdentity.inode,
          ].join("\0"),
        );
      }
      const { bindingsHash: _bindingsHash, ...identity } = value;
      if (
        value.entryCount !== value.orderedEntries.length ||
        slots.size !== value.entryCount ||
        objectLocators.size !== value.entryCount ||
        !ordered ||
        !kindsMatch ||
        !scopeMatches ||
        value.bindingsHash !==
          hashCanonicalJson({
            schema:
              "setfarm.platform-release-bootstrap-darwin-opaque-member-slot-bindings-hash.v2",
            identity,
          })
      ) {
        context.addIssue({
          code: "custom",
          path: ["bindingsHash"],
          message:
            "Opaque member bindings must be exact, indexed, ordered, scope-bound, locator-unique, and self-hashed",
        });
      }
    });

const DurabilityReceiptIdentityV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-darwin-durability-receipt.v2",
    ),
    barrierKind: z.enum(["file_full_sync", "directory_power_loss_barrier"]),
    objectIdentity: StableFsObjectIdentityV2Schema,
    fingerprint: FsObservationFingerprintV2Schema.nullable(),
    contentHash: Sha256Schema.nullable(),
    nativeProofHash: Sha256Schema,
    transcriptHash: Sha256Schema,
  })
  .strict();

const DurabilityReceiptV2Schema = DurabilityReceiptIdentityV2Schema.extend({
  durabilityReceiptHash: Sha256Schema,
})
  .strict()
  .superRefine((value, context) => {
    const { durabilityReceiptHash: _receiptHash, ...identity } = value;
    if (
      (value.barrierKind === "file_full_sync" &&
        (value.fingerprint === null || value.contentHash === null)) ||
      (value.barrierKind === "directory_power_loss_barrier" &&
        (value.fingerprint !== null || value.contentHash !== null)) ||
      value.durabilityReceiptHash !==
        hashCanonicalJson({
          schema:
            "setfarm.platform-release-bootstrap-darwin-durability-receipt-hash.v2",
          identity,
        })
    ) {
      context.addIssue({
        code: "custom",
        path: ["durabilityReceiptHash"],
        message:
          "Durability receipt must bind the exact barrier and object state",
      });
    }
  });

const ClosedSessionReceiptIdentityV2Schema = z
  .object({
    schema: z.literal(
      "setfarm.platform-release-bootstrap-darwin-closed-session-receipt.v2",
    ),
    sessionOccurrenceHash: Sha256Schema,
    finalSequence: z.number().int().positive().safe(),
    finalTranscriptHash: Sha256Schema,
    closeDisposition: z.enum(["closed", "aborted"]),
  })
  .strict();

const ClosedSessionReceiptV2Schema =
  ClosedSessionReceiptIdentityV2Schema.extend({
    closedSessionReceiptHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const { closedSessionReceiptHash: _receiptHash, ...identity } = value;
      if (
        value.closedSessionReceiptHash !==
        hashCanonicalJson({
          schema:
            "setfarm.platform-release-bootstrap-darwin-closed-session-receipt-hash.v2",
          identity,
        })
      ) {
        context.addIssue({
          code: "custom",
          path: ["closedSessionReceiptHash"],
          message: "Closed-session receipt hash mismatch",
        });
      }
    });

const operationFieldSchemaByKindV2: Readonly<
  Record<z.infer<typeof OperationFieldKindV2Schema>, z.ZodTypeAny>
> = Object.freeze({
  bounded_bytes: BoundedBytesV2Schema,
  closed_session_receipt: ClosedSessionReceiptV2Schema,
  directory_membership: DirectoryMembershipIdentityV2Schema,
  durability_receipt: DurabilityReceiptV2Schema,
  expected_absence: ExpectedAbsenceV2Schema,
  exact_entry_content_evidence: ExactEntryContentEvidenceV2Schema,
  filesystem_scope_identity: BootstrapFilesystemScopeIdentityV2Schema,
  lock_intent: z.enum([
    "acquire_existing_exclusive",
    "create_and_acquire_exclusive",
  ]),
  mutable_fingerprint: FsObservationFingerprintV2Schema,
  nonnegative_integer: z.number().int().nonnegative().safe(),
  opaque_slot_ref: OpaqueSlotRefV2Schema,
  opaque_slot_membership: OpaqueSlotMembershipV2Schema,
  opaque_member_slot_bindings: OpaqueMemberSlotBindingsV2Schema,
  operand_ref: FixedOperandRefV2Schema,
  publication_mapping_ref: PublicationMappingRefV2Schema,
  scope_nonce: z.string().regex(/^[a-f0-9]{64}$/),
  sha256: Sha256Schema,
  stable_object_identity: StableFsObjectIdentityV2Schema,
});

function operationPayloadSchemaV2(
  fields: readonly z.infer<typeof OperationFieldV2Schema>[],
): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (shape[field.name] !== undefined) {
      throw new TypeError(
        `Duplicate Darwin backend operation field ${field.name}`,
      );
    }
    shape[field.name] = operationFieldSchemaByKindV2[field.kind];
  }
  return z.object(shape).strict();
}

const wireFieldKindBindingsV2 = OperationFieldKindV2Schema.options.map(
  (fieldKind) =>
    Object.freeze({
      fieldKind,
      dtoSchemaRef:
        fieldKind === "stable_object_identity"
          ? "setfarm.platform-release-bootstrap-stable-fs-object-identity.v2"
          : fieldKind === "mutable_fingerprint"
            ? "setfarm.platform-release-bootstrap-fs-observation-fingerprint.v2"
            : fieldKind === "directory_membership"
              ? "setfarm.platform-release-bootstrap-directory-membership-identity.v2"
              : fieldKind === "filesystem_scope_identity"
                ? "setfarm.platform-release-bootstrap-filesystem-scope-identity.v2"
              : `setfarm.platform-release-bootstrap-darwin-${fieldKind.replaceAll("_", "-")}.v2`,
      relationPolicy: `${fieldKind}_strict_bounded_canonical_relation_v2`,
    }),
);

const BackendWireContractCatalogIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    transportPolicy: z.literal(
      "one_request_one_success_or_failure_monotonic_sequence_transcript_v2",
    ),
    requestFrameSchema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_REQUEST_FRAME_V2_SCHEMA,
    ),
    successFrameSchema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_SUCCESS_FRAME_V2_SCHEMA,
    ),
    failureFrameSchema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FAILURE_FRAME_V2_SCHEMA,
    ),
    captureTranscriptContractHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
    ),
    captureTranscriptSchemas: z.object({
      header: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA),
      directoryPage: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA),
      contentChunk: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA),
    }).strict(),
    captureTranscriptCaps: z.object({
      maxRecordCanonicalBytes: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2),
      maxDirectoryBindingsPerPage: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2),
      maxDirectoryTotalBindings: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2),
      maxDirectoryPagesPerObservation: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2),
      maxContentRawBytesPerChunk: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2),
      maxContentTotalRawBytes: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2),
      maxContentChunksPerObservation: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2),
    }).strict(),
    fieldKindBindings: z.array(
      z
        .object({
          fieldKind: OperationFieldKindV2Schema,
          dtoSchemaRef: z.string().min(1).max(180),
          relationPolicy: SemanticPolicyV2Schema,
        })
        .strict(),
    ),
    operationContracts: z.array(
      z
        .object({
          operationRef: OperationRefV2Schema,
          requestSchemaRef: z.string().min(1).max(180),
          successSchemaRef: z.string().min(1).max(180),
          failureSchemaRef: z.string().min(1).max(180),
          requestFields: z.array(OperationFieldV2Schema).max(16),
          resultFields: z.array(OperationFieldV2Schema).max(16),
          errorCodes: z.array(OperationErrorCodeV2Schema).min(1).max(14),
        })
        .strict(),
    ),
  })
  .strict();

const wireContractCatalogIdentityV2 = {
  schema:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  transportPolicy:
    "one_request_one_success_or_failure_monotonic_sequence_transcript_v2",
  requestFrameSchema:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_REQUEST_FRAME_V2_SCHEMA,
  successFrameSchema:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_SUCCESS_FRAME_V2_SCHEMA,
  failureFrameSchema:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FAILURE_FRAME_V2_SCHEMA,
  captureTranscriptContractHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  captureTranscriptSchemas: {
    header: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA,
    directoryPage: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
    contentChunk: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
  },
  captureTranscriptCaps: {
    maxRecordCanonicalBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
    maxDirectoryBindingsPerPage: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
    maxDirectoryTotalBindings: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
    maxDirectoryPagesPerObservation: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2,
    maxContentRawBytesPerChunk: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
    maxContentTotalRawBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
    maxContentChunksPerObservation: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2,
  },
  fieldKindBindings: wireFieldKindBindingsV2,
  operationContracts: exactOperationsV2.map((operation) => ({
    operationRef: operation.operationRef,
    requestSchemaRef: operation.requestSchemaRef,
    successSchemaRef: operation.successSchemaRef,
    failureSchemaRef: operation.failureSchemaRef,
    requestFields: operation.requestFields,
    resultFields: operation.resultFields,
    errorCodes: operation.errorCodes,
  })),
} as const;

export function hashPlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const catalog = { ...value };
  delete catalog.wireContractCatalogHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-backend-wire-contract-catalog-hash.v2",
    catalog,
  });
}

export const PlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2Schema =
  BackendWireContractCatalogIdentityV2Schema.extend({
    wireContractCatalogHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const { wireContractCatalogHash: _wireContractCatalogHash, ...identity } =
        value;
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_MAX_CANONICAL_BYTES_V2,
        ) ||
        canonicalJsonStringify(identity) !==
          canonicalJsonStringify(wireContractCatalogIdentityV2) ||
        value.wireContractCatalogHash !==
          hashPlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["wireContractCatalogHash"],
          message:
            "Darwin filesystem backend wire catalog must equal the exact code-owned contract",
        });
      }
    });

export type PlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2Schema
  >;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2 =
  deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2Schema.parse(
      {
        ...wireContractCatalogIdentityV2,
        wireContractCatalogHash:
          hashPlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2(
            wireContractCatalogIdentityV2,
          ),
      },
    ),
  );

export function parsePlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinFilesystemBackendWireContractCatalogV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}

export function hashPlatformReleaseBootstrapDarwinFilesystemBackendOperationSetV2(
  operationRefs: readonly string[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-backend-operation-set-hash.v2",
    orderedOperationRefs: [...operationRefs],
  });
}

const BackendAbiSetIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    authorityRef: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_AUTHORITY_REF_V2,
    ),
    registryContractHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    ),
    platform: z.literal("darwin"),
    requiredArchitectures: z.tuple([z.literal("arm64"), z.literal("x64")]),
    providerPolicy: z.literal(
      "authenticated_signed_native_zero_argv_private_session_v2",
    ),
    transportPolicy: z.literal(
      "bounded_canonical_duplex_fd3_sequence_protocol_v2",
    ),
    wireContractCatalogHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2.wireContractCatalogHash,
    ),
    captureTranscriptContractHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
    ),
    captureTranscriptSchemas: z.object({
      header: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA),
      directoryPage: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA),
      contentChunk: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA),
    }).strict(),
    captureTranscriptCaps: z.object({
      maxRecordCanonicalBytes: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2),
      maxDirectoryBindingsPerPage: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2),
      maxDirectoryTotalBindings: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2),
      maxDirectoryPagesPerObservation: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2),
      maxContentRawBytesPerChunk: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2),
      maxContentTotalRawBytes: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2),
      maxContentChunksPerObservation: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2),
    }).strict(),
    ambientPolicy: z.literal(
      "stdin_shell_path_environment_cwd_callbacks_and_generic_execute_forbidden_v2",
    ),
    operandPolicy: z.literal(
      "fixed_refs_and_opaque_slots_no_raw_paths_fds_basenames_or_flags_v2",
    ),
    resolutionPolicy: z.literal(
      "pinned_parent_all_components_no_symlink_beneath_descriptor_relative_v2",
    ),
    identityPolicy: z.literal(
      "stable_scope_kind_device_inode_separate_mutable_fingerprint_v2",
    ),
    lockPolicy: z.literal(
      "activation_legacy_then_shared_post_receipt_shared_then_legacy_or_package_v2",
    ),
    durabilityPolicy: z.literal(
      "file_full_sync_directory_barrier_exact_replay_v2",
    ),
    atomicReplacePolicy: z.literal(
      "expected_prior_identity_or_no_mutation_semantic_required_v2",
    ),
    renameSwapPolicy: z.literal("forbidden_unmodeled_fourth_crash_state_v2"),
    sessionPolicy: z.literal(
      "self_attested_monotonic_sequence_exactly_once_close_or_abort_v2",
    ),
    productionAdmissionPolicy: z.literal(
      "forbidden_until_every_blocker_has_authenticated_external_evidence_v2",
    ),
    maxMessageBytes: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2,
    ),
    maxMemberBindingsPerFrame: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2,
    ),
    maxOperationsPerSession: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
    ),
    operationCount: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2.length,
    ),
    fixedOperandRefs: z.tuple([
      ...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2.map(
        (value) => z.literal(value),
      ),
    ] as [
      z.ZodLiteral<
        (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2)[0]
      >,
      ...z.ZodTypeAny[],
    ]),
    fixedOperandCatalog: z
      .array(FixedOperandCatalogEntryV2Schema)
      .length(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_CATALOG_V2.length,
      ),
    noReplacePublicationMappings: z
      .array(NoReplacePublicationMappingV2Schema)
      .length(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2.length,
      ),
    blockerCodes: z.tuple([
      ...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_BLOCKER_CODES_V2.map(
        (value) => z.literal(value),
      ),
    ] as [
      z.ZodLiteral<
        (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_BLOCKER_CODES_V2)[0]
      >,
      ...z.ZodTypeAny[],
    ]),
    operationSetHash: Sha256Schema,
    operations: z
      .array(BackendOperationIdentityV2Schema)
      .length(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2.length,
      ),
  })
  .strict();

export type PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetHashPayloadV2 =
  z.infer<typeof BackendAbiSetIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(
  value:
    | PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetHashPayloadV2
    | PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2
    | Readonly<Record<string, unknown>>,
): string {
  const abiSet = { ...value } as Record<string, unknown>;
  delete abiSet.backendAbiHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-backend-abi-set-hash.v2",
    abiSet,
  });
}

const exactAbiIdentityV2 = {
  schema:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  authorityRef:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_AUTHORITY_REF_V2,
  registryContractHash: PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
  platform: "darwin",
  requiredArchitectures: ["arm64", "x64"],
  providerPolicy: "authenticated_signed_native_zero_argv_private_session_v2",
  transportPolicy: "bounded_canonical_duplex_fd3_sequence_protocol_v2",
  wireContractCatalogHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_WIRE_CONTRACT_CATALOG_V2.wireContractCatalogHash,
  captureTranscriptContractHash:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_CONTRACT_V2.captureTranscriptContractHash,
  captureTranscriptSchemas: {
    header: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_TRANSCRIPT_HEADER_V2_SCHEMA,
    directoryPage: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_CAPTURE_PAGE_V2_SCHEMA,
    contentChunk: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_CAPTURE_CHUNK_V2_SCHEMA,
  },
  captureTranscriptCaps: {
    maxRecordCanonicalBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CAPTURE_RECORD_MAX_CANONICAL_BYTES_V2,
    maxDirectoryBindingsPerPage: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_BINDINGS_PER_PAGE_V2,
    maxDirectoryTotalBindings: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_TOTAL_BINDINGS_V2,
    maxDirectoryPagesPerObservation: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_DIRECTORY_MAX_PAGES_PER_OBSERVATION_V2,
    maxContentRawBytesPerChunk: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_RAW_BYTES_PER_CHUNK_V2,
    maxContentTotalRawBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_TOTAL_RAW_BYTES_V2,
    maxContentChunksPerObservation: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_CONTENT_MAX_CHUNKS_PER_OBSERVATION_V2,
  },
  ambientPolicy:
    "stdin_shell_path_environment_cwd_callbacks_and_generic_execute_forbidden_v2",
  operandPolicy:
    "fixed_refs_and_opaque_slots_no_raw_paths_fds_basenames_or_flags_v2",
  resolutionPolicy:
    "pinned_parent_all_components_no_symlink_beneath_descriptor_relative_v2",
  identityPolicy:
    "stable_scope_kind_device_inode_separate_mutable_fingerprint_v2",
  lockPolicy:
    "activation_legacy_then_shared_post_receipt_shared_then_legacy_or_package_v2",
  durabilityPolicy: "file_full_sync_directory_barrier_exact_replay_v2",
  atomicReplacePolicy:
    "expected_prior_identity_or_no_mutation_semantic_required_v2",
  renameSwapPolicy: "forbidden_unmodeled_fourth_crash_state_v2",
  sessionPolicy:
    "self_attested_monotonic_sequence_exactly_once_close_or_abort_v2",
  productionAdmissionPolicy:
    "forbidden_until_every_blocker_has_authenticated_external_evidence_v2",
  maxMessageBytes:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2,
  maxMemberBindingsPerFrame:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MEMBER_BINDINGS_PER_FRAME_V2,
  maxOperationsPerSession:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
  operationCount:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2.length,
  fixedOperandRefs: [
    ...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_REFS_V2,
  ],
  fixedOperandCatalog:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FIXED_OPERAND_CATALOG_V2.map(
      (operand) => ({ ...operand }),
    ),
  noReplacePublicationMappings:
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2.map(
      (mapping) => ({ ...mapping }),
    ),
  blockerCodes: [
    ...PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_BLOCKER_CODES_V2,
  ],
  operationSetHash:
    hashPlatformReleaseBootstrapDarwinFilesystemBackendOperationSetV2(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2,
    ),
  operations: exactOperationsV2,
} as const;

let exactAbiCanonicalV2: string | undefined;

export const PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2Schema =
  BackendAbiSetIdentityV2Schema.extend({
    backendAbiHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const { backendAbiHash: _backendAbiHash, ...identity } = value;
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_MAX_CANONICAL_BYTES_V2,
        ) ||
        value.operationSetHash !==
          hashPlatformReleaseBootstrapDarwinFilesystemBackendOperationSetV2(
            value.operations.map((operation) => operation.operationRef),
          ) ||
        (exactAbiCanonicalV2 !== undefined &&
          canonicalJsonStringify(value) !== exactAbiCanonicalV2) ||
        value.backendAbiHash !==
          hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(identity)
      ) {
        context.addIssue({
          code: "custom",
          path: ["backendAbiHash"],
          message:
            "Darwin filesystem backend ABI must equal the exact bounded code-owned contract",
        });
      }
    });

export type PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2 = z.infer<
  typeof PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2Schema
>;

const parsedExactAbiV2 =
  PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2Schema.parse({
    ...exactAbiIdentityV2,
    backendAbiHash:
      hashPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(
        exactAbiIdentityV2,
      ),
  });

exactAbiCanonicalV2 = canonicalJsonStringify(parsedExactAbiV2);

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2: PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2 =
  deepFreezePlatformReleaseJsonV2(parsedExactAbiV2);

export function getPlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2(): PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2,
    ),
  );
}

export function parsePlatformReleaseBootstrapDarwinFilesystemBackendAbiSetCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinFilesystemBackendAbiSetV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}

const BackendRequestFrameV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_REQUEST_FRAME_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    backendAbiHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    ),
    sessionOccurrenceHash: Sha256Schema,
    operationRef: OperationRefV2Schema,
    operationSchemaRef: z.string().min(1).max(180),
    sequence: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
      ),
    payload: z.unknown(),
    requestHash: Sha256Schema,
  })
  .strict();

const BackendSuccessFrameV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_SUCCESS_FRAME_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    backendAbiHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    ),
    sessionOccurrenceHash: Sha256Schema,
    operationRef: OperationRefV2Schema,
    operationSchemaRef: z.string().min(1).max(180),
    sequence: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
      ),
    requestHash: Sha256Schema,
    status: z.literal("success"),
    payload: z.unknown(),
    transcriptHash: Sha256Schema,
    responseHash: Sha256Schema,
  })
  .strict();

const BackendFailureFrameV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_FAILURE_FRAME_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    backendAbiHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    ),
    sessionOccurrenceHash: Sha256Schema,
    operationRef: OperationRefV2Schema,
    operationSchemaRef: z.string().min(1).max(180),
    sequence: z
      .number()
      .int()
      .nonnegative()
      .max(
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_OPERATIONS_PER_SESSION_V2,
      ),
    requestHash: Sha256Schema,
    status: z.literal("failure"),
    errorCode: OperationErrorCodeV2Schema,
    nativeErrno: z.number().int().nonnegative().safe().nullable(),
    errorMessage: z.string().min(1).max(1_500),
    transcriptHash: Sha256Schema,
    responseHash: Sha256Schema,
  })
  .strict();

export type PlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2 =
  z.infer<typeof BackendRequestFrameV2Schema>;
export type PlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2 =
  | z.infer<typeof BackendSuccessFrameV2Schema>
  | z.infer<typeof BackendFailureFrameV2Schema>;

export function hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const frame = { ...value };
  delete frame.requestHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-backend-request-frame-hash.v2",
    frame,
  });
}

export function hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const frame = { ...value };
  delete frame.responseHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-backend-response-frame-hash.v2",
    frame,
  });
}

function backendOperationV2(
  operationRef: (typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_OPERATION_REFS_V2)[number],
) {
  const operation =
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operations.find(
      (candidate) => candidate.operationRef === operationRef,
    );
  if (operation === undefined) {
    throw new TypeError("Unknown Darwin filesystem backend operation");
  }
  return operation;
}

function requestPayloadRelationsMatchV2(
  frame: z.infer<typeof BackendRequestFrameV2Schema>,
  payload: Record<string, unknown>,
): boolean {
  if (
    ("sequence" in payload && payload.sequence !== frame.sequence) ||
    (frame.operationRef === "SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2"
      ? frame.sequence !== 0 || payload.initialSequence !== 0
      : frame.sequence < 1)
  ) {
    return false;
  }
  const operation = backendOperationV2(frame.operationRef);
  const requestSlots = operation.requestFields
    .filter((field) => field.kind === "opaque_slot_ref")
    .map((field) => payload[field.name]);
  if (new Set(requestSlots).size !== requestSlots.length) {
    return false;
  }
  for (const field of operation.requestFields) {
    if (
      field.kind === "operand_ref" &&
      !operation.allowedOperandRefs.includes(payload[field.name] as never)
    ) {
      return false;
    }
  }
  if (
    "expectedParentIdentity" in payload &&
    StableFsObjectIdentityV2Schema.safeParse(payload.expectedParentIdentity)
      .data?.objectKind !== "directory"
  ) {
    return false;
  }
  if (frame.operationRef === "PIN_FIXED_CHILD_DIRECTORY_V2") {
    const directory = StableFsObjectIdentityV2Schema.safeParse(
      payload.expectedDirectoryIdentity,
    );
    const parent = StableFsObjectIdentityV2Schema.safeParse(
      payload.expectedParentIdentity,
    );
    return (
      directory.success &&
      parent.success &&
      directory.data.objectKind === "directory" &&
      directory.data.filesystemScopeIdentityHash ===
        parent.data.filesystemScopeIdentityHash &&
      directory.data.device === parent.data.device
    );
  }
  if (frame.operationRef === "ACQUIRE_CODE_OWNED_LOCK_SESSION_V2") {
    return (
      identityHasKindV2(payload.expectedLockIdentity, "ordinary_file") &&
      fingerprintJoinsIdentityV2(
        payload.expectedLockFingerprint,
        payload.expectedLockIdentity,
      )
    );
  }
  if (frame.operationRef === "CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2") {
    return identityHasKindV2(payload.expectedIdentity, "directory");
  }
  if (frame.operationRef === "CAPTURE_EXACT_ENTRY_TWICE_V2") {
    return StableFsObjectIdentityV2Schema.safeParse(payload.expectedIdentity)
      .success;
  }
  if (frame.operationRef === "FULL_SYNC_DIRECTORY_V2") {
    return identityHasKindV2(payload.expectedIdentity, "directory");
  }
  if (frame.operationRef === "FULL_SYNC_FILE_V2") {
    return (
      identityHasKindV2(payload.expectedIdentity, "ordinary_file") &&
      fingerprintJoinsIdentityV2(
        payload.expectedFingerprint,
        payload.expectedIdentity,
      )
    );
  }
  if (frame.operationRef === "LINK_FIXED_STAGED_FILE_NO_REPLACE_V2") {
    if (
      !identityHasKindV2(payload.expectedSourceIdentity, "ordinary_file") ||
      !fingerprintJoinsIdentityV2(
        payload.expectedSourceFingerprint,
        payload.expectedSourceIdentity,
      ) ||
      !identitiesShareScopeAndDeviceV2(
        payload.expectedSourceIdentity,
        (
          payload.expectedTargetAbsence as z.infer<
            typeof ExpectedAbsenceV2Schema
          >
        ).parentIdentity,
      )
    )
      return false;
  }
  if (frame.operationRef === "RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2") {
    return (
      identityHasKindV2(payload.expectedSourceIdentity, "ordinary_file") &&
      identityHasKindV2(payload.expectedPriorIdentity, "ordinary_file") &&
      identitiesShareScopeAndDeviceV2(
        payload.expectedSourceIdentity,
        payload.expectedPriorIdentity,
      ) &&
      identitiesAreDistinctV2(
        payload.expectedSourceIdentity,
        payload.expectedPriorIdentity,
      ) &&
      fingerprintJoinsIdentityV2(
        payload.expectedSourceFingerprint,
        payload.expectedSourceIdentity,
      ) &&
      fingerprintJoinsIdentityV2(
        payload.expectedPriorFingerprint,
        payload.expectedPriorIdentity,
      )
    );
  }
  if (
    frame.operationRef === "UNLINK_EXACT_OBSERVED_ENTRY_V2" &&
    (!identityHasKindV2(payload.expectedIdentity, "ordinary_file") ||
      !identitiesShareScopeAndDeviceV2(
        payload.expectedParentIdentity,
        payload.expectedIdentity,
      ) ||
      !identitiesAreDistinctV2(
        payload.expectedParentIdentity,
        payload.expectedIdentity,
      ) ||
      !fingerprintJoinsIdentityV2(
        payload.expectedFingerprint,
        payload.expectedIdentity,
      ))
  ) {
    return false;
  }
  if (frame.operationRef === "REMOVE_EXACT_EMPTY_DIRECTORY_V2") {
    const membership = payload.expectedMembership as z.infer<
      typeof DirectoryMembershipIdentityV2Schema
    >;
    return (
      identityHasKindV2(payload.expectedIdentity, "directory") &&
      identitiesShareScopeAndDeviceV2(
        payload.expectedParentIdentity,
        payload.expectedIdentity,
      ) &&
      identitiesAreDistinctV2(
        payload.expectedParentIdentity,
        payload.expectedIdentity,
      ) &&
      membership.entryCount === 0
    );
  }
  if (
    frame.operationRef === "WRITE_EXACT_BOUNDED_FILE_V2" &&
    (!identityHasKindV2(payload.expectedIdentity, "ordinary_file") ||
      !fingerprintJoinsIdentityV2(
        payload.expectedPriorFingerprint,
        payload.expectedIdentity,
      ) ||
      payload.contentHash !==
        (payload.contentBytes as z.infer<typeof BoundedBytesV2Schema>)
          .contentHash)
  ) {
    return false;
  }
  if (
    frame.operationRef === "CREATE_PRIVATE_DIRECTORY_EXCLUSIVE_V2" ||
    frame.operationRef === "CREATE_PRIVATE_FILE_EXCLUSIVE_V2"
  ) {
    const expectedAbsence = payload.expectedAbsence as
      z.infer<typeof ExpectedAbsenceV2Schema> | undefined;
    const operand =
      frame.operationRef === "CREATE_PRIVATE_DIRECTORY_EXCLUSIVE_V2"
        ? payload.directoryOperand
        : payload.fileOperand;
    return (
      expectedAbsence !== undefined &&
      expectedAbsence.targetOperandRef === operand &&
      sameCanonicalV2(
        expectedAbsence.parentIdentity,
        payload.expectedParentIdentity,
      )
    );
  }
  if (frame.operationRef === "LINK_FIXED_STAGED_FILE_NO_REPLACE_V2") {
    const mapping =
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_NO_REPLACE_MAPPINGS_V2.find(
        (candidate) => candidate.mappingRef === payload.publicationMapping,
      );
    const expectedAbsence = payload.expectedTargetAbsence as
      z.infer<typeof ExpectedAbsenceV2Schema> | undefined;
    return (
      mapping !== undefined &&
      expectedAbsence?.targetOperandRef === mapping.targetOperandRef
    );
  }
  return true;
}

function sameCanonicalV2(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function identityHasKindV2(
  candidate: unknown,
  objectKind: "directory" | "ordinary_file",
): boolean {
  const identity = StableFsObjectIdentityV2Schema.safeParse(candidate);
  return identity.success && identity.data.objectKind === objectKind;
}

function identitiesShareScopeAndDeviceV2(
  leftCandidate: unknown,
  rightCandidate: unknown,
): boolean {
  const left = StableFsObjectIdentityV2Schema.safeParse(leftCandidate);
  const right = StableFsObjectIdentityV2Schema.safeParse(rightCandidate);
  return (
    left.success &&
    right.success &&
    left.data.filesystemScopeIdentityHash ===
      right.data.filesystemScopeIdentityHash &&
    left.data.device === right.data.device
  );
}

function identitiesAreDistinctV2(
  leftCandidate: unknown,
  rightCandidate: unknown,
): boolean {
  const left = StableFsObjectIdentityV2Schema.safeParse(leftCandidate);
  const right = StableFsObjectIdentityV2Schema.safeParse(rightCandidate);
  return (
    left.success &&
    right.success &&
    left.data.objectIdentityHash !== right.data.objectIdentityHash
  );
}

function fingerprintJoinsIdentityV2(
  fingerprint: unknown,
  identity: unknown,
): boolean {
  const parsedFingerprint =
    FsObservationFingerprintV2Schema.safeParse(fingerprint);
  const parsedIdentity = StableFsObjectIdentityV2Schema.safeParse(identity);
  return (
    parsedFingerprint.success &&
    parsedIdentity.success &&
    parsedFingerprint.data.objectIdentityHash ===
      parsedIdentity.data.objectIdentityHash
  );
}

function fingerprintCommonMetadataPreservedV2(
  prior: z.infer<typeof FsObservationFingerprintV2Schema>,
  next: z.infer<typeof FsObservationFingerprintV2Schema>,
): boolean {
  return (
    prior.objectIdentityHash === next.objectIdentityHash &&
    prior.ownerUid === next.ownerUid &&
    prior.ownerGid === next.ownerGid &&
    prior.mode === next.mode
  );
}

function timestampDoesNotMoveBackwardV2(prior: string, next: string): boolean {
  return BigInt(next) >= BigInt(prior);
}

function linkFingerprintTransitionMatchesV2(
  priorCandidate: unknown,
  nextCandidate: unknown,
): boolean {
  const prior = FsObservationFingerprintV2Schema.safeParse(priorCandidate);
  const next = FsObservationFingerprintV2Schema.safeParse(nextCandidate);
  return (
    prior.success &&
    next.success &&
    fingerprintCommonMetadataPreservedV2(prior.data, next.data) &&
    prior.data.linkCount === 1 &&
    next.data.linkCount === 2 &&
    next.data.byteLength === prior.data.byteLength &&
    next.data.modifiedTimeNanoseconds === prior.data.modifiedTimeNanoseconds &&
    timestampDoesNotMoveBackwardV2(
      prior.data.changedTimeNanoseconds,
      next.data.changedTimeNanoseconds,
    )
  );
}

function renameFingerprintTransitionMatchesV2(
  priorCandidate: unknown,
  nextCandidate: unknown,
): boolean {
  const prior = FsObservationFingerprintV2Schema.safeParse(priorCandidate);
  const next = FsObservationFingerprintV2Schema.safeParse(nextCandidate);
  return (
    prior.success &&
    next.success &&
    fingerprintCommonMetadataPreservedV2(prior.data, next.data) &&
    prior.data.linkCount === 1 &&
    next.data.linkCount === 1 &&
    next.data.byteLength === prior.data.byteLength &&
    next.data.modifiedTimeNanoseconds === prior.data.modifiedTimeNanoseconds &&
    timestampDoesNotMoveBackwardV2(
      prior.data.changedTimeNanoseconds,
      next.data.changedTimeNanoseconds,
    )
  );
}

function writeFingerprintTransitionMatchesV2(
  priorCandidate: unknown,
  nextCandidate: unknown,
  expectedByteLength: number,
): boolean {
  const prior = FsObservationFingerprintV2Schema.safeParse(priorCandidate);
  const next = FsObservationFingerprintV2Schema.safeParse(nextCandidate);
  return (
    prior.success &&
    next.success &&
    fingerprintCommonMetadataPreservedV2(prior.data, next.data) &&
    prior.data.linkCount === 1 &&
    next.data.linkCount === 1 &&
    next.data.byteLength === expectedByteLength &&
    timestampDoesNotMoveBackwardV2(
      prior.data.modifiedTimeNanoseconds,
      next.data.modifiedTimeNanoseconds,
    ) &&
    timestampDoesNotMoveBackwardV2(
      prior.data.changedTimeNanoseconds,
      next.data.changedTimeNanoseconds,
    )
  );
}

function responsePayloadRelationsMatchV2(
  request: PlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2,
  response: z.infer<typeof BackendSuccessFrameV2Schema>,
  result: Record<string, unknown>,
): boolean {
  const input = request.payload as Record<string, unknown>;
  switch (request.operationRef) {
    case "ACQUIRE_CODE_OWNED_LOCK_SESSION_V2":
      return (
        result.lockSlot === input.observedLockSlot &&
        sameCanonicalV2(result.lockIdentity, input.expectedLockIdentity) &&
        sameCanonicalV2(
          result.lockFingerprint,
          input.expectedLockFingerprint,
        ) &&
        result.lockContentHash === input.expectedLockContentHash
      );
    case "CAPTURE_DIRECTORY_EVERY_ONLY_TWICE_V2": {
      const first = DirectoryMembershipIdentityV2Schema.safeParse(
        result.firstMembership,
      );
      const second = DirectoryMembershipIdentityV2Schema.safeParse(
        result.secondMembership,
      );
      const bindings = OpaqueMemberSlotBindingsV2Schema.safeParse(
        result.memberBindings,
      );
      const directoryIdentity = StableFsObjectIdentityV2Schema.safeParse(
        result.directoryIdentity,
      );
      const membershipJoinsBindings =
        first.success &&
        second.success &&
        bindings.success &&
        first.data.entryCount === bindings.data.entryCount &&
        bindings.data.orderedEntries.every((binding, index) => {
          const member = first.data.orderedEntries[index];
          return (
            member !== undefined &&
            binding.membershipIndex === index &&
            binding.basename === member.basename &&
            binding.objectKind === member.objectKind
          );
        });
      const bindingSlotsAreFresh =
        bindings.success &&
        bindings.data.orderedEntries.every(
          (binding) =>
            binding.slot !== input.sessionSlot &&
            binding.slot !== input.directorySlot,
        );
      const bindingIdentitiesJoinDirectory =
        bindings.success &&
        directoryIdentity.success &&
        bindings.data.filesystemScopeIdentityHash ===
          directoryIdentity.data.filesystemScopeIdentityHash &&
        bindings.data.orderedEntries.every(
          (binding) =>
            binding.objectIdentity.filesystemScopeIdentityHash ===
              directoryIdentity.data.filesystemScopeIdentityHash &&
            binding.objectIdentity.device === directoryIdentity.data.device &&
            !(
              binding.objectIdentity.device === directoryIdentity.data.device &&
              binding.objectIdentity.inode === directoryIdentity.data.inode
            ),
        );
      return (
        sameCanonicalV2(result.directoryIdentity, input.expectedIdentity) &&
        fingerprintJoinsIdentityV2(
          result.directoryFingerprint,
          result.directoryIdentity,
        ) &&
        sameCanonicalV2(result.firstMembership, result.secondMembership) &&
        membershipJoinsBindings &&
        bindingSlotsAreFresh &&
        bindingIdentitiesJoinDirectory
      );
    }
    case "CAPTURE_EXACT_ENTRY_TWICE_V2": {
      const identity = StableFsObjectIdentityV2Schema.safeParse(
        result.entryIdentity,
      );
      const fingerprint = FsObservationFingerprintV2Schema.safeParse(
        result.entryFingerprint,
      );
      const contentEvidence = ExactEntryContentEvidenceV2Schema.safeParse(
        result.contentEvidence,
      );
      const contentKindJoinsIdentity =
        identity.success &&
        fingerprint.success &&
        contentEvidence.success &&
        (identity.data.objectKind === "ordinary_file"
          ? contentEvidence.data.kind === "bounded_regular_file_bytes" &&
            fingerprint.data.byteLength ===
              contentEvidence.data.contentBytes.byteLength
          : contentEvidence.data.kind === "directory_membership");
      return (
        result.entrySlot === input.entrySlot &&
        sameCanonicalV2(result.entryIdentity, input.expectedIdentity) &&
        fingerprintJoinsIdentityV2(
          result.entryFingerprint,
          result.entryIdentity,
        ) &&
        contentKindJoinsIdentity
      );
    }
    case "CLOSE_OR_ABORT_SESSION_V2": {
      const receipt = ClosedSessionReceiptV2Schema.safeParse(
        result.closedSessionReceipt,
      );
      return (
        receipt.success &&
        receipt.data.sessionOccurrenceHash === request.sessionOccurrenceHash &&
        receipt.data.finalSequence === request.sequence &&
        receipt.data.finalTranscriptHash === result.finalTranscriptHash &&
        result.finalTranscriptHash === response.transcriptHash
      );
    }
    case "CREATE_PRIVATE_DIRECTORY_EXCLUSIVE_V2": {
      const identity = StableFsObjectIdentityV2Schema.safeParse(
        result.directoryIdentity,
      );
      const absence = input.expectedAbsence as z.infer<
        typeof ExpectedAbsenceV2Schema
      >;
      return (
        identity.success &&
        identity.data.objectKind === "directory" &&
        identity.data.filesystemScopeIdentityHash ===
          absence.parentIdentity.filesystemScopeIdentityHash &&
        identity.data.device === absence.parentIdentity.device &&
        result.directorySlot !== input.parentSlot
      );
    }
    case "CREATE_PRIVATE_FILE_EXCLUSIVE_V2": {
      const identity = StableFsObjectIdentityV2Schema.safeParse(
        result.fileIdentity,
      );
      const absence = input.expectedAbsence as z.infer<
        typeof ExpectedAbsenceV2Schema
      >;
      return (
        identity.success &&
        identity.data.objectKind === "ordinary_file" &&
        identity.data.filesystemScopeIdentityHash ===
          absence.parentIdentity.filesystemScopeIdentityHash &&
        identity.data.device === absence.parentIdentity.device &&
        result.fileSlot !== input.parentSlot
      );
    }
    case "FULL_SYNC_DIRECTORY_V2": {
      const receipt = DurabilityReceiptV2Schema.safeParse(
        result.durabilityReceipt,
      );
      return (
        receipt.success &&
        receipt.data.barrierKind === "directory_power_loss_barrier" &&
        sameCanonicalV2(receipt.data.objectIdentity, input.expectedIdentity) &&
        receipt.data.transcriptHash === response.transcriptHash
      );
    }
    case "FULL_SYNC_FILE_V2": {
      const receipt = DurabilityReceiptV2Schema.safeParse(
        result.durabilityReceipt,
      );
      return (
        receipt.success &&
        receipt.data.barrierKind === "file_full_sync" &&
        sameCanonicalV2(receipt.data.objectIdentity, input.expectedIdentity) &&
        sameCanonicalV2(receipt.data.fingerprint, input.expectedFingerprint) &&
        receipt.data.contentHash === input.expectedContentHash &&
        receipt.data.transcriptHash === response.transcriptHash
      );
    }
    case "LINK_FIXED_STAGED_FILE_NO_REPLACE_V2":
      return (
        sameCanonicalV2(result.targetIdentity, input.expectedSourceIdentity) &&
        linkFingerprintTransitionMatchesV2(
          input.expectedSourceFingerprint,
          result.targetFingerprint,
        ) &&
        result.targetContentHash === input.expectedSourceContentHash &&
        result.targetSlot !== input.sourceSlot
      );
    case "PIN_FIXED_CHILD_DIRECTORY_V2": {
      return (
        sameCanonicalV2(
          result.directoryIdentity,
          input.expectedDirectoryIdentity,
        ) && result.directorySlot !== input.parentSlot
      );
    }
    case "REMOVE_EXACT_EMPTY_DIRECTORY_V2": {
      const absence = ExpectedAbsenceV2Schema.safeParse(result.observedAbsence);
      return (
        absence.success &&
        sameCanonicalV2(
          absence.data.parentIdentity,
          input.expectedParentIdentity,
        ) &&
        absence.data.targetOperandRef === input.directoryOperand
      );
    }
    case "RENAME_EPOCH_TARGET_OVER_EXACT_PRIOR_V2":
      return (
        result.replacementTargetSlot === input.targetSlot &&
        sameCanonicalV2(
          result.replacementIdentity,
          input.expectedSourceIdentity,
        ) &&
        renameFingerprintTransitionMatchesV2(
          input.expectedSourceFingerprint,
          result.replacementFingerprint,
        ) &&
        result.replacementContentHash === input.expectedSourceContentHash &&
        result.consumedPriorHash === input.expectedPriorContentHash
      );
    case "REVALIDATE_FIXED_SESSION_V2":
      return (
        result.transcriptHash === response.transcriptHash &&
        OpaqueSlotMembershipV2Schema.safeParse(result.openSlotMembership)
          .success
      );
    case "SELF_ATTEST_AND_OPEN_FIXED_BOOTSTRAP_SESSION_V2": {
      const identity = StableFsObjectIdentityV2Schema.safeParse(
        result.bootstrapParentIdentity,
      );
      const fingerprint = FsObservationFingerprintV2Schema.safeParse(
        result.bootstrapParentFingerprint,
      );
      const filesystemScope =
        BootstrapFilesystemScopeIdentityV2Schema.safeParse(
          result.filesystemScopeIdentity,
        );
      return (
        new Set([
          result.sessionSlot,
          result.bootstrapParentSlot,
          result.filesystemScopeSlot,
        ]).size === 3 &&
        identity.success &&
        fingerprint.success &&
        filesystemScope.success &&
        identity.data.objectKind === "directory" &&
        identity.data.filesystemScopeIdentityHash ===
          filesystemScope.data.scopeIdentityHash &&
        fingerprintJoinsIdentityV2(
          result.bootstrapParentFingerprint,
          result.bootstrapParentIdentity,
        ) &&
        fingerprint.data.ownerUid === 0 &&
        fingerprint.data.ownerGid === 0 &&
        fingerprint.data.mode === "0755" &&
        result.filesystemScopeContentHash ===
          hashCanonicalJson(filesystemScope.data) &&
        result.filesystemScopeContentHash !==
          filesystemScope.data.scopeIdentityHash
      );
    }
    case "UNLINK_EXACT_OBSERVED_ENTRY_V2": {
      const absence = ExpectedAbsenceV2Schema.safeParse(result.observedAbsence);
      return (
        absence.success &&
        sameCanonicalV2(
          absence.data.parentIdentity,
          input.expectedParentIdentity,
        ) &&
        absence.data.targetOperandRef === input.entryOperand
      );
    }
    case "WRITE_EXACT_BOUNDED_FILE_V2":
      return (
        sameCanonicalV2(result.fileIdentity, input.expectedIdentity) &&
        writeFingerprintTransitionMatchesV2(
          input.expectedPriorFingerprint,
          result.fileFingerprint,
          (input.contentBytes as z.infer<typeof BoundedBytesV2Schema>)
            .byteLength,
        ) &&
        result.observedContentHash === input.contentHash &&
        input.contentHash ===
          (input.contentBytes as z.infer<typeof BoundedBytesV2Schema>)
            .contentHash
      );
    case "GENERATE_FILESYSTEM_SCOPE_NONCE_V2":
      return true;
  }
}

export function parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2,
  );
  const frame = BackendRequestFrameV2Schema.parse(snapshot);
  const operation = backendOperationV2(frame.operationRef);
  const payload = operationPayloadSchemaV2(operation.requestFields).parse(
    frame.payload,
  ) as Record<string, unknown>;
  if (
    frame.operationSchemaRef !== operation.requestSchemaRef ||
    frame.requestHash !==
      hashPlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2(
        frame,
      ) ||
    !requestPayloadRelationsMatchV2(frame, payload)
  ) {
    throw new TypeError(
      "Darwin filesystem backend request frame relation mismatch",
    );
  }
  return deepFreezePlatformReleaseJsonV2({
    ...frame,
    payload,
  }) as PlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2;
}

export function parsePlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameCandidateV2(
  input: unknown,
  expectedRequest: PlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameV2,
): PlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2 {
  const request =
    parsePlatformReleaseBootstrapDarwinFilesystemBackendRequestFrameCandidateV2(
      expectedRequest,
    );
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_MAX_MESSAGE_BYTES_V2,
  );
  const common = z
    .object({ status: z.enum(["success", "failure"]) })
    .passthrough()
    .parse(snapshot);
  if (common.status === "failure") {
    const frame = BackendFailureFrameV2Schema.parse(snapshot);
    const operation = backendOperationV2(frame.operationRef);
    if (
      frame.operationSchemaRef !== operation.failureSchemaRef ||
      !operation.errorCodes.includes(frame.errorCode) ||
      frame.requestHash !== request.requestHash ||
      frame.sessionOccurrenceHash !== request.sessionOccurrenceHash ||
      frame.operationRef !== request.operationRef ||
      frame.sequence !== request.sequence ||
      frame.responseHash !==
        hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(
          frame,
        )
    ) {
      throw new TypeError(
        "Darwin filesystem backend failure frame relation mismatch",
      );
    }
    return deepFreezePlatformReleaseJsonV2(frame);
  }
  const frame = BackendSuccessFrameV2Schema.parse(snapshot);
  const operation = backendOperationV2(frame.operationRef);
  const payload = operationPayloadSchemaV2(operation.resultFields).parse(
    frame.payload,
  );
  if (
    frame.operationSchemaRef !== operation.successSchemaRef ||
    frame.requestHash !== request.requestHash ||
    frame.sessionOccurrenceHash !== request.sessionOccurrenceHash ||
    frame.operationRef !== request.operationRef ||
    frame.sequence !== request.sequence ||
    !responsePayloadRelationsMatchV2(
      request,
      frame,
      payload as Record<string, unknown>,
    ) ||
    frame.responseHash !==
      hashPlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2(frame)
  ) {
    throw new TypeError(
      "Darwin filesystem backend success frame relation mismatch",
    );
  }
  return deepFreezePlatformReleaseJsonV2({
    ...frame,
    payload,
  }) as PlatformReleaseBootstrapDarwinFilesystemBackendResponseFrameV2;
}

export function hashPlatformReleaseBootstrapDarwinDistributionCatalogBindingV2(
  value: Readonly<{
    architecture: "arm64" | "x64";
    distributionEpoch: number;
    distributionEpochFloor: number;
    distributionEpochFloorStateHash: string;
    nativeDistributionReceiptHash: string;
    signedCatalogEntryHash: string;
    executableContentHash: string;
    buildAttestationHash: string;
    backendAbiHash: string;
    registryContractHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-distribution-catalog-binding-hash.v2",
    architecture: value.architecture,
    distributionEpoch: value.distributionEpoch,
    distributionEpochFloor: value.distributionEpochFloor,
    distributionEpochFloorStateHash: value.distributionEpochFloorStateHash,
    nativeDistributionReceiptHash: value.nativeDistributionReceiptHash,
    signedCatalogEntryHash: value.signedCatalogEntryHash,
    executableContentHash: value.executableContentHash,
    buildAttestationHash: value.buildAttestationHash,
    backendAbiHash: value.backendAbiHash,
    registryContractHash: value.registryContractHash,
  });
}

export function hashPlatformReleaseBootstrapDarwinSelfAttestationBindingV2(
  value: Readonly<{
    selfAttestationChallengeHash: string;
    selfAttestationReceiptHash: string;
    executableContentHash: string;
    executablePhysicalIdentityHash: string;
    hostIdentityHash: string;
    architecture: "arm64" | "x64";
    distributionCatalogBindingHash: string;
    designatedRequirementHash: string;
    developerTeamIdentityHash: string;
    codeDirectoryHash: string;
    hardenedRuntimePolicyHash: string;
    libraryValidationPolicyHash: string;
    backendAbiHash: string;
    supportedOperationSetHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-self-attestation-binding-hash.v2",
    selfAttestationChallengeHash: value.selfAttestationChallengeHash,
    selfAttestationReceiptHash: value.selfAttestationReceiptHash,
    executableContentHash: value.executableContentHash,
    executablePhysicalIdentityHash: value.executablePhysicalIdentityHash,
    hostIdentityHash: value.hostIdentityHash,
    architecture: value.architecture,
    distributionCatalogBindingHash: value.distributionCatalogBindingHash,
    designatedRequirementHash: value.designatedRequirementHash,
    developerTeamIdentityHash: value.developerTeamIdentityHash,
    codeDirectoryHash: value.codeDirectoryHash,
    hardenedRuntimePolicyHash: value.hardenedRuntimePolicyHash,
    libraryValidationPolicyHash: value.libraryValidationPolicyHash,
    backendAbiHash: value.backendAbiHash,
    supportedOperationSetHash: value.supportedOperationSetHash,
  });
}

export function hashPlatformReleaseBootstrapDarwinCapabilityProofBindingV2(
  value: Readonly<{
    nativeSyscallSupportReceiptHash: string;
    allComponentResolutionProofHash: string;
    conditionalReplaceProofHash: string;
    directoryDurabilityProofHash: string;
    selfAttestationBindingHash: string;
    backendAbiHash: string;
    supportedOperationSetHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-capability-proof-binding-hash.v2",
    nativeSyscallSupportReceiptHash: value.nativeSyscallSupportReceiptHash,
    allComponentResolutionProofHash: value.allComponentResolutionProofHash,
    conditionalReplaceProofHash: value.conditionalReplaceProofHash,
    directoryDurabilityProofHash: value.directoryDurabilityProofHash,
    selfAttestationBindingHash: value.selfAttestationBindingHash,
    backendAbiHash: value.backendAbiHash,
    supportedOperationSetHash: value.supportedOperationSetHash,
  });
}

export function hashPlatformReleaseBootstrapDarwinSessionBindingV2(
  value: Readonly<{
    sessionOccurrenceHash: string;
    transcriptHash: string;
    selfAttestationBindingHash: string;
    capabilityProofBindingHash: string;
    supportedOperationSetHash: string;
    sessionLifecycle: "open_fresh";
    initialSequence: 0;
  }>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-session-binding-hash.v2",
    sessionOccurrenceHash: value.sessionOccurrenceHash,
    transcriptHash: value.transcriptHash,
    selfAttestationBindingHash: value.selfAttestationBindingHash,
    capabilityProofBindingHash: value.capabilityProofBindingHash,
    supportedOperationSetHash: value.supportedOperationSetHash,
    sessionLifecycle: value.sessionLifecycle,
    initialSequence: value.initialSequence,
  });
}

const BackendCapabilityReceiptIdentityV2Schema = z
  .object({
    schema: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_CAPABILITY_RECEIPT_V2_SCHEMA,
    ),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    authorityRef: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_AUTHORITY_REF_V2,
    ),
    admissionScope: z.literal("production_host"),
    productionUse: z.literal(
      "live_private_capability_required_serialized_receipt_is_not_authority_v2",
    ),
    backendAbiHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.backendAbiHash,
    ),
    registryContractHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_CONTRACT_V2.contractHash,
    ),
    platform: z.literal("darwin"),
    architecture: z.enum(["arm64", "x64"]),
    hostIdentityHash: Sha256Schema,
    nativeDistributionReceiptHash: Sha256Schema,
    signedCatalogEntryHash: Sha256Schema,
    distributionEpoch: z.number().int().positive().safe(),
    distributionEpochFloor: z.number().int().nonnegative().safe(),
    distributionEpochFloorStateHash: Sha256Schema,
    distributionCatalogBindingHash: Sha256Schema,
    executableContentHash: Sha256Schema,
    executablePhysicalIdentityHash: Sha256Schema,
    buildAttestationHash: Sha256Schema,
    designatedRequirementHash: Sha256Schema,
    developerTeamIdentityHash: Sha256Schema,
    codeDirectoryHash: Sha256Schema,
    hardenedRuntimePolicyHash: Sha256Schema,
    libraryValidationPolicyHash: Sha256Schema,
    selfAttestationChallengeHash: Sha256Schema,
    selfAttestationReceiptHash: Sha256Schema,
    selfAttestationBindingHash: Sha256Schema,
    nativeSyscallSupportReceiptHash: Sha256Schema,
    allComponentResolutionProofHash: Sha256Schema,
    conditionalReplaceProofHash: Sha256Schema,
    directoryDurabilityProofHash: Sha256Schema,
    capabilityProofBindingHash: Sha256Schema,
    supportedOperationSetHash: z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_ABI_SET_V2.operationSetHash,
    ),
    sessionOccurrenceHash: Sha256Schema,
    transcriptHash: Sha256Schema,
    sessionLifecycle: z.literal("open_fresh"),
    initialSequence: z.literal(0),
    sessionBindingHash: Sha256Schema,
  })
  .strict();

export type PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptHashPayloadV2 =
  z.infer<typeof BackendCapabilityReceiptIdentityV2Schema>;

export function hashPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
  value:
    | PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptHashPayloadV2
    | PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-filesystem-backend-capability-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2Schema =
  BackendCapabilityReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  })
    .strict()
    .superRefine((value, context) => {
      const hashes = Object.entries(value)
        .filter(([key]) => key.endsWith("Hash"))
        .map(([, hash]) => hash);
      if (
        !platformReleaseCandidateFitsCanonicalCapV2(
          value,
          PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_RECEIPT_MAX_CANONICAL_BYTES_V2,
        ) ||
        value.distributionEpoch < value.distributionEpochFloor ||
        new Set(hashes).size !== hashes.length ||
        value.distributionCatalogBindingHash !==
          hashPlatformReleaseBootstrapDarwinDistributionCatalogBindingV2(
            value,
          ) ||
        value.selfAttestationBindingHash !==
          hashPlatformReleaseBootstrapDarwinSelfAttestationBindingV2(value) ||
        value.capabilityProofBindingHash !==
          hashPlatformReleaseBootstrapDarwinCapabilityProofBindingV2(value) ||
        value.sessionBindingHash !==
          hashPlatformReleaseBootstrapDarwinSessionBindingV2(value) ||
        value.receiptHash !==
          hashPlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2(
            value,
          )
      ) {
        context.addIssue({
          code: "custom",
          path: ["receiptHash"],
          message:
            "Darwin filesystem backend receipt must bind one exact distinct authenticated live-session evidence chain",
        });
      }
    });

export type PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2 =
  z.infer<
    typeof PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2Schema
  >;

export function parsePlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2 {
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBootstrapDarwinFilesystemBackendCapabilityReceiptV2Schema.parse(
      boundedPlatformReleaseJsonSnapshotV2(
        input,
        PLATFORM_RELEASE_BOOTSTRAP_DARWIN_FILESYSTEM_BACKEND_RECEIPT_MAX_CANONICAL_BYTES_V2,
      ),
    ),
  );
}
