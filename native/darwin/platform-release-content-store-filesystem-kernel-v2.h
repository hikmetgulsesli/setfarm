#ifndef SETFARM_PLATFORM_RELEASE_CONTENT_STORE_FILESYSTEM_KERNEL_V2_H
#define SETFARM_PLATFORM_RELEASE_CONTENT_STORE_FILESYSTEM_KERNEL_V2_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SETFARM_CONTENT_STORE_LOCKS_NAME_V2 ".locks"
#define SETFARM_CONTENT_STORE_STAGING_NAME_V2 ".staging"
#define SETFARM_CONTENT_STORE_RELEASES_NAME_V2 "releases"
#define SETFARM_CONTENT_STORE_ATTESTATIONS_NAME_V2 "attestations"
#define SETFARM_CONTENT_STORE_MANIFEST_NAME_V2 "manifest.json"
#define SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2 "release"
#define SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2 "attestation.json"

#define SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2 ((size_t)64)
#define SETFARM_CONTENT_STORE_MAX_MANIFEST_BYTES_V2 \
  ((size_t)8 * (size_t)1024 * (size_t)1024)
#define SETFARM_CONTENT_STORE_MAX_ATTESTATION_BYTES_V2 \
  ((size_t)8 * (size_t)1024 * (size_t)1024)

/* This mechanics kernel is fixture-only and can never mint production authority. */
#define SETFARM_CONTENT_STORE_FILESYSTEM_PRODUCTION_AUTHORITY_V2 0
#define SETFARM_CONTENT_STORE_FILESYSTEM_CAPABILITY_V2 \
  "darwin_descriptor_relative_content_store_fixture_v2"
#define SETFARM_CONTENT_STORE_UNLINK_AUTHORITY_POLICY_V2 \
  "preserve_unless_exact_identity_revalidated_no_same_uid_atomic_unlink_v2"
#define SETFARM_CONTENT_STORE_STALE_LEASE_RECOVERY_POLICY_V2 \
  "unauthenticated_fixture_exact_inode_and_f_tlock_only_v2"

typedef enum setfarm_content_store_error_v2 {
  SETFARM_CONTENT_STORE_OK_V2 = 0,
  SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2 = 1,
  SETFARM_CONTENT_STORE_PLATFORM_UNAVAILABLE_V2 = 2,
  SETFARM_CONTENT_STORE_ROOT_INVALID_V2 = 3,
  SETFARM_CONTENT_STORE_CHILD_INVALID_V2 = 4,
  SETFARM_CONTENT_STORE_BOUND_EXCEEDED_V2 = 5,
  SETFARM_CONTENT_STORE_STATE_CONFLICT_V2 = 6,
  SETFARM_CONTENT_STORE_STAGE_FAILED_V2 = 7,
  SETFARM_CONTENT_STORE_RELEASE_INVALID_V2 = 8,
  SETFARM_CONTENT_STORE_RELEASE_PUBLICATION_FAILED_V2 = 9,
  SETFARM_CONTENT_STORE_ATTESTATION_INVALID_V2 = 10,
  SETFARM_CONTENT_STORE_ATTESTATION_PUBLICATION_FAILED_V2 = 11,
  SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2 = 12,
  SETFARM_CONTENT_STORE_SYNC_FAILED_V2 = 13,
  SETFARM_CONTENT_STORE_CLEANUP_FAILED_V2 = 14,
  SETFARM_CONTENT_STORE_LEASE_FAILED_V2 = 15
} setfarm_content_store_error_v2;

typedef enum setfarm_content_store_cleanup_code_v2 {
  SETFARM_CONTENT_STORE_CLEANUP_OK_V2 = 0,
  SETFARM_CONTENT_STORE_CLEANUP_STAGE_IDENTITY_CHANGED_V2 = 1,
  SETFARM_CONTENT_STORE_CLEANUP_STAGE_SHAPE_INVALID_V2 = 2,
  SETFARM_CONTENT_STORE_CLEANUP_ENTRY_IDENTITY_CHANGED_V2 = 3,
  SETFARM_CONTENT_STORE_CLEANUP_ENTRY_UNLINK_FAILED_V2 = 4,
  SETFARM_CONTENT_STORE_CLEANUP_DIRECTORY_REMOVE_FAILED_V2 = 5,
  SETFARM_CONTENT_STORE_CLEANUP_PARENT_CHANGED_V2 = 6,
  SETFARM_CONTENT_STORE_CLEANUP_SYNC_FAILED_V2 = 7
} setfarm_content_store_cleanup_code_v2;

typedef enum setfarm_content_store_lease_code_v2 {
  SETFARM_CONTENT_STORE_LEASE_OK_V2 = 0,
  SETFARM_CONTENT_STORE_LEASE_CONTENT_ACQUIRE_FAILED_V2 = 1,
  SETFARM_CONTENT_STORE_LEASE_ATTESTATION_ACQUIRE_FAILED_V2 = 2,
  SETFARM_CONTENT_STORE_LEASE_CONTENT_CHANGED_V2 = 3,
  SETFARM_CONTENT_STORE_LEASE_ATTESTATION_CHANGED_V2 = 4,
  SETFARM_CONTENT_STORE_LEASE_CONTENT_RELEASE_FAILED_V2 = 5,
  SETFARM_CONTENT_STORE_LEASE_ATTESTATION_RELEASE_FAILED_V2 = 6,
  SETFARM_CONTENT_STORE_LEASE_PARENT_CHANGED_V2 = 7,
  SETFARM_CONTENT_STORE_LEASE_SYNC_FAILED_V2 = 8
} setfarm_content_store_lease_code_v2;

typedef enum setfarm_content_store_publication_disposition_v2 {
  SETFARM_CONTENT_STORE_PUBLICATION_NONE_V2 = 0,
  SETFARM_CONTENT_STORE_PUBLICATION_PUBLISHED_V2 = 1,
  SETFARM_CONTENT_STORE_PUBLICATION_ADOPTED_IDENTICAL_V2 = 2
} setfarm_content_store_publication_disposition_v2;

typedef enum setfarm_content_store_unlink_authority_policy_v2 {
  SETFARM_CONTENT_STORE_UNLINK_PRESERVE_UNCERTAIN_IDENTITY_V2 = 1
} setfarm_content_store_unlink_authority_policy_v2;

typedef enum setfarm_content_store_checkpoint_v2 {
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CHILDREN_PINNED_V2 = 1,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CONTENT_LEASE_ACQUIRED_V2 = 2,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_ATTESTATION_LEASE_ACQUIRED_V2 = 3,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_STAGE_DURABLE_V2 = 4,
  SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_RELEASE_RESERVATION_V2 = 5,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_RELEASE_RESERVATION_V2 = 6,
  SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_MANIFEST_LINK_V2 = 7,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_MANIFEST_LINK_V2 = 8,
  SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_ATTESTATION_LINK_V2 = 9,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_ATTESTATION_LINK_V2 = 10,
  SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_STAGE_CLEANUP_V2 = 11,
  SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_LEASE_RELEASE_V2 = 12,
  SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CLEANUP_V2 = 13
} setfarm_content_store_checkpoint_v2;

typedef struct setfarm_content_store_expected_directory_v2 {
  uint64_t device;
  uint64_t inode;
  uint64_t owner_uid;
  uint64_t owner_gid;
  uint32_t mode;
} setfarm_content_store_expected_directory_v2;

typedef struct setfarm_content_store_physical_evidence_v2 {
  uint64_t device;
  uint64_t inode;
  uint64_t owner_uid;
  uint64_t owner_gid;
  uint64_t link_count;
  uint64_t byte_length;
  uint32_t mode;
  int64_t modified_seconds;
  int64_t modified_nanoseconds;
  int64_t changed_seconds;
  int64_t changed_nanoseconds;
} setfarm_content_store_physical_evidence_v2;

typedef struct setfarm_content_store_request_v2 {
  const uint8_t *manifest_payload_hash_hex;
  size_t manifest_payload_hash_hex_length;
  const uint8_t *attestation_hash_hex;
  size_t attestation_hash_hex_length;
  const uint8_t *manifest_bytes;
  size_t manifest_byte_length;
  const uint8_t *attestation_bytes;
  size_t attestation_byte_length;
  setfarm_content_store_expected_directory_v2 root;
  setfarm_content_store_expected_directory_v2 locks;
  setfarm_content_store_expected_directory_v2 staging;
  setfarm_content_store_expected_directory_v2 releases;
  setfarm_content_store_expected_directory_v2 attestations;
} setfarm_content_store_request_v2;

typedef struct setfarm_content_store_result_v2 {
  setfarm_content_store_publication_disposition_v2 release_disposition;
  setfarm_content_store_publication_disposition_v2 attestation_disposition;
  setfarm_content_store_physical_evidence_v2 root;
  setfarm_content_store_physical_evidence_v2 locks;
  setfarm_content_store_physical_evidence_v2 staging;
  setfarm_content_store_physical_evidence_v2 releases;
  setfarm_content_store_physical_evidence_v2 attestations;
  setfarm_content_store_physical_evidence_v2 release_root;
  setfarm_content_store_physical_evidence_v2 manifest;
  setfarm_content_store_physical_evidence_v2 attestation;
  uint32_t content_lease_acquired;
  uint32_t attestation_lease_acquired;
  uint32_t stage_cleaned;
  uint32_t leases_released;
  uint32_t production_authority;
  setfarm_content_store_unlink_authority_policy_v2 unlink_authority_policy;
  uint32_t same_uid_atomic_conditional_unlink_available;
  uint32_t content_lease_recovered;
  uint32_t attestation_lease_recovered;
  uint32_t unauthenticated_stale_lease_recovery_enabled;
  uint32_t authenticated_lease_ledger_present;
} setfarm_content_store_result_v2;

typedef struct setfarm_content_store_failure_v2 {
  setfarm_content_store_error_v2 primary_code;
  setfarm_content_store_cleanup_code_v2 cleanup_code;
  setfarm_content_store_lease_code_v2 lease_code;
  int primary_errno;
  int cleanup_errno;
  int lease_errno;
  setfarm_content_store_checkpoint_v2 last_checkpoint;
} setfarm_content_store_failure_v2;

typedef void (*setfarm_content_store_checkpoint_hook_v2)(
  setfarm_content_store_checkpoint_v2 checkpoint,
  void *context);

/*
 * Fixture-only descriptor-relative composite publication. The caller supplies
 * one already-open store-root descriptor and exact expected physical identities;
 * no pathname or caller-selected relative operand is accepted. The operation
 * pins all four fixed children, acquires content then attestation leases,
 * publishes canonical bytes without replacement, and performs only exact
 * known-shape staging cleanup (never recursive deletion).
 *
 * Darwin has no descriptor-relative atomic "unlink this name only if it still
 * names this inode" primitive. This fixture therefore revalidates identity
 * immediately before each unlink and preserves the name whenever identity is
 * uncertain. A malicious same-UID writer can still race the final revalidation
 * and unlink syscall; that limitation is explicit in the result policy and is
 * one reason this kernel has production_authority == 0.
 *
 * Crash-stale O_EXCL leases may be reused only by this fixture after exact
 * descriptor/path metadata fences and successful F_TLOCK acquisition. No
 * authenticated lease ledger exists here, so a same-UID fork or forged idle
 * lease cannot be distinguished from a crashed fixture. The result exposes
 * that limitation; production use remains forbidden.
 */
setfarm_content_store_error_v2
setfarm_content_store_publish_fixture_v2(
  int inherited_root_fd,
  const setfarm_content_store_request_v2 *request,
  setfarm_content_store_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_content_store_result_v2 *result,
  setfarm_content_store_failure_v2 *failure);

const char *setfarm_content_store_error_name_v2(
  setfarm_content_store_error_v2 code);

const char *setfarm_content_store_cleanup_code_name_v2(
  setfarm_content_store_cleanup_code_v2 code);

const char *setfarm_content_store_lease_code_name_v2(
  setfarm_content_store_lease_code_v2 code);

#ifdef __cplusplus
}
#endif

#endif
