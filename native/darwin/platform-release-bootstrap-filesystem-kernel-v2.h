#ifndef SETFARM_PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_KERNEL_V2_H
#define SETFARM_PLATFORM_RELEASE_BOOTSTRAP_FILESYSTEM_KERNEL_V2_H

#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SETFARM_BOOTSTRAP_SCOPE_STAGE_NAME_V2 \
  ".setfarm-bootstrap-filesystem-scope-v2.stage"
#define SETFARM_BOOTSTRAP_SCOPE_TARGET_NAME_V2 \
  "setfarm-bootstrap-filesystem-scope-v2.json"
#define SETFARM_BOOTSTRAP_SCOPE_MAX_BYTES_V2 ((size_t)65536)
#define SETFARM_BOOTSTRAP_SCOPE_MAX_RECORDED_FULL_SYNCS_V2 ((size_t)32)

/* This fixture kernel is deliberately not a production authority. */
#define SETFARM_BOOTSTRAP_FILESYSTEM_KERNEL_PRODUCTION_AUTHORITY_V2 0
#define SETFARM_BOOTSTRAP_FILESYSTEM_KERNEL_CAPABILITY_V2 \
  "darwin_fixed_scope_publication_fixture_v2"

typedef enum setfarm_bootstrap_scope_error_v2 {
  SETFARM_BOOTSTRAP_SCOPE_OK_V2 = 0,
  SETFARM_BOOTSTRAP_SCOPE_INVALID_ARGUMENT_V2 = 1,
  SETFARM_BOOTSTRAP_SCOPE_ROOT_FD_INVALID_V2 = 2,
  SETFARM_BOOTSTRAP_SCOPE_PARENT_CHANGED_V2 = 3,
  SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2 = 4,
  SETFARM_BOOTSTRAP_SCOPE_CONTENT_MISMATCH_V2 = 5,
  SETFARM_BOOTSTRAP_SCOPE_STATE_CONFLICT_V2 = 6,
  SETFARM_BOOTSTRAP_SCOPE_CREATE_FAILED_V2 = 7,
  SETFARM_BOOTSTRAP_SCOPE_WRITE_FAILED_V2 = 8,
  SETFARM_BOOTSTRAP_SCOPE_SYNC_FAILED_V2 = 9,
  SETFARM_BOOTSTRAP_SCOPE_LINK_FAILED_V2 = 10,
  SETFARM_BOOTSTRAP_SCOPE_UNLINK_FAILED_V2 = 11,
  SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2 = 12,
  SETFARM_BOOTSTRAP_SCOPE_ITERATION_LIMIT_V2 = 13,
  SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2 = 14
} setfarm_bootstrap_scope_error_v2;

typedef enum setfarm_bootstrap_scope_replay_state_v2 {
  SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2 = 0,
  SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2 = 1,
  SETFARM_BOOTSTRAP_SCOPE_REPLAY_OVERLAP_V2 = 2,
  SETFARM_BOOTSTRAP_SCOPE_REPLAY_FINAL_ONLY_V2 = 3,
  SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2 = 4
} setfarm_bootstrap_scope_replay_state_v2;

typedef enum setfarm_bootstrap_scope_checkpoint_v2 {
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_WRITE_V2 = 1,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_FULLSYNC_V2 = 2,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_PARENT_FULLSYNC_BEFORE_LINK_V2 = 3,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_LINK_V2 = 4,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_TARGET_FULLSYNC_V2 = 5,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_PARENT_FULLSYNC_BEFORE_UNLINK_V2 = 6,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_UNLINK_V2 = 7,
  SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_FINAL_PARENT_FULLSYNC_V2 = 8
} setfarm_bootstrap_scope_checkpoint_v2;

typedef enum setfarm_bootstrap_scope_full_sync_role_v2 {
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_STAGE_AFTER_WRITE_V2 = 1,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_STAGE_BEFORE_LINK_V2 = 2,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_BEFORE_LINK_V2 = 3,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_TARGET_BEFORE_UNLINK_V2 = 4,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_BEFORE_UNLINK_V2 = 5,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_AFTER_UNLINK_V2 = 6,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_TARGET_FINAL_REVALIDATION_V2 = 7,
  SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_FINAL_REVALIDATION_V2 = 8
} setfarm_bootstrap_scope_full_sync_role_v2;

typedef struct setfarm_bootstrap_scope_physical_evidence_v2 {
  uint64_t device;
  uint64_t inode;
  uint64_t link_count;
  uint64_t byte_length;
  uint64_t owner_uid;
  uint64_t owner_gid;
  uint32_t mode;
  int64_t modified_seconds;
  int64_t modified_nanoseconds;
  int64_t changed_seconds;
  int64_t changed_nanoseconds;
} setfarm_bootstrap_scope_physical_evidence_v2;

typedef struct setfarm_bootstrap_scope_result_v2 {
  setfarm_bootstrap_scope_replay_state_v2 initial_state;
  setfarm_bootstrap_scope_replay_state_v2 final_state;
  setfarm_bootstrap_scope_physical_evidence_v2 final_evidence;
} setfarm_bootstrap_scope_result_v2;

typedef struct setfarm_bootstrap_scope_failure_v2 {
  setfarm_bootstrap_scope_error_v2 code;
  int system_errno;
  setfarm_bootstrap_scope_replay_state_v2 observed_state;
} setfarm_bootstrap_scope_failure_v2;

/* Non-authoritative fixture timing; never an availability or durability SLA. */
typedef struct setfarm_bootstrap_scope_timing_v2 {
  uint64_t full_sync_nanoseconds[
    SETFARM_BOOTSTRAP_SCOPE_MAX_RECORDED_FULL_SYNCS_V2];
  setfarm_bootstrap_scope_full_sync_role_v2 full_sync_roles[
    SETFARM_BOOTSTRAP_SCOPE_MAX_RECORDED_FULL_SYNCS_V2];
  setfarm_bootstrap_scope_replay_state_v2 full_sync_states[
    SETFARM_BOOTSTRAP_SCOPE_MAX_RECORDED_FULL_SYNCS_V2];
  uint32_t full_sync_call_count;
  uint32_t recorded_full_sync_count;
  uint32_t monotonic_raw_clock_available;
  uint32_t recording_truncated;
} setfarm_bootstrap_scope_timing_v2;

typedef void (*setfarm_bootstrap_scope_checkpoint_hook_v2)(
  setfarm_bootstrap_scope_checkpoint_v2 checkpoint,
  void *context);

/*
 * Publishes exactly one fixed scope document beneath an already-open directory.
 * The function duplicates and pins inherited_root_fd, never accepts a pathname
 * or caller-selected operand, and accepts only exact replay of scope_bytes.
 *
 * A zero-length or partial stage is intentionally not cleanup-authorized.  The
 * first supported crash checkpoint is after the complete bounded pwrite loop.
 */
setfarm_bootstrap_scope_error_v2
setfarm_bootstrap_scope_publish_fixed_v2(
  int inherited_root_fd,
  const uint8_t *scope_bytes,
  size_t scope_length,
  setfarm_bootstrap_scope_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_bootstrap_scope_timing_v2 *timing,
  setfarm_bootstrap_scope_result_v2 *result,
  setfarm_bootstrap_scope_failure_v2 *failure);

const char *setfarm_bootstrap_scope_error_name_v2(
  setfarm_bootstrap_scope_error_v2 code);

const char *setfarm_bootstrap_scope_replay_state_name_v2(
  setfarm_bootstrap_scope_replay_state_v2 state);

const char *setfarm_bootstrap_scope_full_sync_role_name_v2(
  setfarm_bootstrap_scope_full_sync_role_v2 role);

#ifdef __cplusplus
}
#endif

#endif
