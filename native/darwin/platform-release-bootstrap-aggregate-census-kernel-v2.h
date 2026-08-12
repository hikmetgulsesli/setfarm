#ifndef SETFARM_PLATFORM_RELEASE_BOOTSTRAP_AGGREGATE_CENSUS_KERNEL_V2_H
#define SETFARM_PLATFORM_RELEASE_BOOTSTRAP_AGGREGATE_CENSUS_KERNEL_V2_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SETFARM_AGGREGATE_CENSUS_SHARED_LOCK_NAME_V2 \
  ".setfarm-bootstrap-package-registry-v2.lock"
#define SETFARM_AGGREGATE_CENSUS_SHARED_LOCK_CONTENT_V2 \
  "setfarm.bootstrap-package-registry-parent-lock.v2\n"
#define SETFARM_AGGREGATE_CENSUS_NODE_LOCK_NAME_V2 \
  ".setfarm-node-toolchain-provisioner-installation-v2.lock"
#define SETFARM_AGGREGATE_CENSUS_NODE_LOCK_CONTENT_V2 \
  "setfarm.node-toolchain-provisioner-bootstrap-installation-lock.v2\n"

#define SETFARM_AGGREGATE_CENSUS_MAX_ENTRIES_V2 ((size_t)16384)
#define SETFARM_AGGREGATE_CENSUS_MAX_BASENAME_BYTES_V2 ((size_t)255)
#define SETFARM_AGGREGATE_CENSUS_MAX_FILE_BYTES_V2 \
  ((size_t)1024 * (size_t)1024)
#define SETFARM_AGGREGATE_CENSUS_MAX_TOTAL_FILE_BYTES_V2 \
  ((size_t)8 * (size_t)1024 * (size_t)1024)
#define SETFARM_AGGREGATE_CENSUS_MAX_TOTAL_DIRECTORY_MEMBERS_V2 \
  ((size_t)65536)
#define SETFARM_AGGREGATE_CENSUS_MAX_OUTPUT_BYTES_V2 \
  ((size_t)64 * (size_t)1024 * (size_t)1024)

#define SETFARM_AGGREGATE_CENSUS_NODE_ROOT_NAME_V2 \
  "node-toolchain-provisioner-v2"
#define SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_ENTRY_COUNT_V2 ((size_t)8)
#define SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2 ((size_t)32)
#define SETFARM_AGGREGATE_CENSUS_NODE_MANIFEST_MAX_BYTES_V2 \
  ((uint64_t)4 * (uint64_t)1024 * (uint64_t)1024)
#define SETFARM_AGGREGATE_CENSUS_NODE_LAUNCHER_MAX_BYTES_V2 \
  ((uint64_t)64 * (uint64_t)1024)
#define SETFARM_AGGREGATE_CENSUS_NODE_BUNDLE_MAX_BYTES_V2 \
  ((uint64_t)32 * (uint64_t)1024 * (uint64_t)1024)
#define SETFARM_AGGREGATE_CENSUS_NODE_RUNTIME_MAX_BYTES_V2 \
  ((uint64_t)128 * (uint64_t)1024 * (uint64_t)1024)
#define SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_TOTAL_MAX_BYTES_V2 \
  (SETFARM_AGGREGATE_CENSUS_NODE_MANIFEST_MAX_BYTES_V2 + \
   SETFARM_AGGREGATE_CENSUS_NODE_LAUNCHER_MAX_BYTES_V2 + \
   SETFARM_AGGREGATE_CENSUS_NODE_BUNDLE_MAX_BYTES_V2 + \
   SETFARM_AGGREGATE_CENSUS_NODE_RUNTIME_MAX_BYTES_V2)

/* This mechanics fixture can never mint production authority. */
#define SETFARM_AGGREGATE_CENSUS_PRODUCTION_AUTHORITY_V2 0
#define SETFARM_AGGREGATE_CENSUS_CAPABILITY_V2 \
  "darwin_read_only_aggregate_census_fixture_v2"
#define SETFARM_AGGREGATE_CENSUS_OBSERVATION_AUTHORITY_V2 \
  "fixture_evidence_only_never_backend_capability_v2"

typedef enum setfarm_aggregate_census_error_v2 {
  SETFARM_AGGREGATE_CENSUS_OK_V2 = 0,
  SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2 = 2,
  SETFARM_AGGREGATE_CENSUS_PARENT_INVALID_V2 = 3,
  SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2 = 4,
  SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2 = 5,
  SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2 = 6,
  SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2 = 7,
  SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2 = 8,
  SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2 = 9,
  SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2 = 10,
  SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2 = 11,
  SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2 = 12,
  SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2 = 13,
  SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2 = 14
} setfarm_aggregate_census_error_v2;

typedef enum setfarm_aggregate_census_object_kind_v2 {
  SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2 = 2
} setfarm_aggregate_census_object_kind_v2;

typedef enum setfarm_aggregate_census_checkpoint_v2 {
  SETFARM_AGGREGATE_CENSUS_CHECKPOINT_AFTER_FIRST_PASS_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_CHECKPOINT_BASELINE_READY_V2 = 2,
  SETFARM_AGGREGATE_CENSUS_CHECKPOINT_RECAPTURE_READY_V2 = 3,
  SETFARM_AGGREGATE_CENSUS_CHECKPOINT_EXACT_ENTRY_FIRST_OBSERVATION_READY_V2 = 4
} setfarm_aggregate_census_checkpoint_v2;

typedef enum setfarm_aggregate_census_exact_release_probe_stop_v2 {
  SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_NONE_V2 = 0,
  SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_SHARED_HELD_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_BOTH_HELD_V2 = 2,
  SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_NODE_RELEASED_V2 = 3,
  SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_ALL_RELEASED_V2 = 4
} setfarm_aggregate_census_exact_release_probe_stop_v2;

typedef enum setfarm_aggregate_census_recursive_status_v2 {
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_NOT_CAPTURED_V2 = 0,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_ABSENT_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAYOUT_NOT_EXACT_V2 = 2,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_COMPLETE_V2 = 3
} setfarm_aggregate_census_recursive_status_v2;

typedef enum setfarm_aggregate_census_recursive_role_v2 {
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_DIRECTORY_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_BIN_DIRECTORY_V2 = 2,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAUNCHER_FILE_V2 = 3,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_LIB_DIRECTORY_V2 = 4,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_BUNDLE_FILE_V2 = 5,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_MANIFEST_FILE_V2 = 6,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_RUNTIME_DIRECTORY_V2 = 7,
  SETFARM_AGGREGATE_CENSUS_RECURSIVE_BOOTSTRAP_RUNTIME_FILE_V2 = 8
} setfarm_aggregate_census_recursive_role_v2;

typedef struct setfarm_aggregate_census_stable_stat_v2 {
  setfarm_aggregate_census_object_kind_v2 object_kind;
  uint64_t device;
  uint64_t inode;
} setfarm_aggregate_census_stable_stat_v2;

typedef struct setfarm_aggregate_census_mutable_stat_v2 {
  uint64_t owner_uid;
  uint64_t owner_gid;
  uint32_t mode;
  uint64_t link_count;
  uint64_t byte_length;
  int64_t modified_seconds;
  int64_t modified_nanoseconds;
  int64_t changed_seconds;
  int64_t changed_nanoseconds;
} setfarm_aggregate_census_mutable_stat_v2;

typedef struct setfarm_aggregate_census_stat_v2 {
  setfarm_aggregate_census_stable_stat_v2 stable;
  setfarm_aggregate_census_mutable_stat_v2 mutable;
} setfarm_aggregate_census_stat_v2;

typedef struct setfarm_aggregate_census_member_v2 {
  uint8_t *basename;
  size_t basename_length;
  setfarm_aggregate_census_object_kind_v2 object_kind;
} setfarm_aggregate_census_member_v2;

typedef struct setfarm_aggregate_census_entry_v2 {
  uint8_t *basename;
  size_t basename_length;
  setfarm_aggregate_census_stat_v2 stat;
  uint8_t *file_bytes;
  size_t file_length;
  setfarm_aggregate_census_member_v2 *members;
  size_t member_count;
} setfarm_aggregate_census_entry_v2;

typedef struct setfarm_aggregate_census_recursive_entry_v2 {
  setfarm_aggregate_census_recursive_role_v2 role;
  setfarm_aggregate_census_recursive_role_v2 parent_role;
  setfarm_aggregate_census_stat_v2 stat;
  setfarm_aggregate_census_member_v2 *members;
  size_t member_count;
  uint8_t content_sha256[
    SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2];
  bool has_content_sha256;
} setfarm_aggregate_census_recursive_entry_v2;

typedef struct setfarm_aggregate_census_recursive_evidence_v2 {
  setfarm_aggregate_census_recursive_status_v2 status;
  setfarm_aggregate_census_recursive_entry_v2 entries[
    SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_ENTRY_COUNT_V2];
  size_t entry_count;
} setfarm_aggregate_census_recursive_evidence_v2;

typedef struct setfarm_aggregate_census_result_v2 {
  setfarm_aggregate_census_stat_v2 parent_stat;
  setfarm_aggregate_census_entry_v2 *entries;
  size_t entry_count;
  setfarm_aggregate_census_stat_v2 shared_lock_stat;
  setfarm_aggregate_census_stat_v2 node_lock_stat;
  setfarm_aggregate_census_recursive_evidence_v2 node_recursive_evidence;
} setfarm_aggregate_census_result_v2;

/*
 * Fixture-only slot-selected capture result. Both observations are read from
 * one pinned ordinary-file descriptor and must be exactly equal.
 */
typedef struct setfarm_aggregate_census_exact_entry_capture_v2 {
  size_t entry_index;
  setfarm_aggregate_census_entry_v2 first_observation;
  setfarm_aggregate_census_entry_v2 second_observation;
} setfarm_aggregate_census_exact_entry_capture_v2;

typedef struct setfarm_aggregate_census_failure_v2 {
  setfarm_aggregate_census_error_v2 code;
  int system_errno;
} setfarm_aggregate_census_failure_v2;

/* Fixture-only exact-object release mechanics; never production authority. */
typedef struct setfarm_aggregate_census_exact_release_probe_result_v2 {
  setfarm_aggregate_census_stat_v2 parent_stat;
  setfarm_aggregate_census_stat_v2 shared_lock_stat;
  setfarm_aggregate_census_stat_v2 node_lock_stat;
} setfarm_aggregate_census_exact_release_probe_result_v2;

typedef void (*setfarm_aggregate_census_checkpoint_hook_v2)(
  setfarm_aggregate_census_checkpoint_v2 checkpoint,
  void *context);

typedef struct setfarm_aggregate_census_session_v2
  setfarm_aggregate_census_session_v2;

/*
 * session_out must point to NULL. A non-NULL existing session is preserved
 * and rejected with INVALID_ARGUMENT. Other failures leave it NULL.
 */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_open_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_session_v2 **session_out,
  setfarm_aggregate_census_failure_v2 *failure);

/* Opt-in fixture-only composite capture. Legacy V2 open remains unchanged. */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_composite_session_open_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_session_v2 **session_out,
  setfarm_aggregate_census_failure_v2 *failure);

/* The observation is borrowed, session-owned, and invalid after close/abort. */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_observation_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  const setfarm_aggregate_census_result_v2 **observation_out,
  setfarm_aggregate_census_failure_v2 *failure);

/*
 * entry_index is resolved by the native fixture from one occurrence-bound
 * opaque slot. Callers never provide a basename/path. Success preserves the
 * session; any failure destroys it. Exactly one capture is allowed.
 */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_capture_exact_entry_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  size_t entry_index,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_exact_entry_capture_v2 *capture_out,
  setfarm_aggregate_census_failure_v2 *failure);

/* Every failure destroys the session and leaves session_io pointing to NULL. */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_recapture_equal_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  bool *equal_out,
  setfarm_aggregate_census_failure_v2 *failure);

/* Close requires a successful recapture and always consumes the session. */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_close_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_failure_v2 *failure);

/* Abort accepts every live state and always consumes the session. */
setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_abort_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_failure_v2 *failure);

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_capture_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_result_v2 *result,
  setfarm_aggregate_census_failure_v2 *failure);

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_exact_release_probe_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_exact_release_probe_stop_v2 stop_checkpoint,
  setfarm_aggregate_census_exact_release_probe_result_v2 *result,
  setfarm_aggregate_census_failure_v2 *failure);

void setfarm_aggregate_census_result_dispose_v2(
  setfarm_aggregate_census_result_v2 *result);

void setfarm_aggregate_census_exact_entry_capture_dispose_v2(
  setfarm_aggregate_census_exact_entry_capture_v2 *capture);

const char *setfarm_aggregate_census_error_name_v2(
  setfarm_aggregate_census_error_v2 code);

#ifdef __cplusplus
}
#endif

#endif
