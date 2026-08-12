#include "platform-release-bootstrap-filesystem-kernel-v2.h"

#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#if defined(__APPLE__)
#include <sys/param.h>
#endif

#define SETFARM_SCOPE_MAX_ATTEMPTS_V2 8

typedef struct setfarm_scope_observation_v2 {
  bool present;
  struct stat status;
} setfarm_scope_observation_v2;

typedef struct setfarm_scope_pair_v2 {
  setfarm_bootstrap_scope_replay_state_v2 state;
  setfarm_scope_observation_v2 stage;
  setfarm_scope_observation_v2 target;
} setfarm_scope_pair_v2;

static void
setfarm_zero_bytes_v2(void *memory, size_t length)
{
  volatile uint8_t *cursor = (volatile uint8_t *)memory;
  while (length > 0) {
    *cursor = 0;
    cursor += 1;
    length -= 1;
  }
}

static void
setfarm_failure_v2(
  setfarm_bootstrap_scope_failure_v2 *failure,
  setfarm_bootstrap_scope_error_v2 code,
  int system_errno,
  setfarm_bootstrap_scope_replay_state_v2 state)
{
  if (failure == NULL) {
    return;
  }
  failure->code = code;
  failure->system_errno = system_errno;
  failure->observed_state = state;
}

static bool
setfarm_same_parent_v2(const struct stat *left, const struct stat *right)
{
  return S_ISDIR(left->st_mode) && S_ISDIR(right->st_mode) &&
    left->st_dev == right->st_dev && left->st_ino == right->st_ino &&
    left->st_uid == right->st_uid && left->st_gid == right->st_gid &&
    (left->st_mode & (mode_t)07777) == (right->st_mode & (mode_t)07777);
}

static bool
setfarm_same_file_snapshot_v2(const struct stat *left, const struct stat *right)
{
  return S_ISREG(left->st_mode) && S_ISREG(right->st_mode) &&
    left->st_dev == right->st_dev && left->st_ino == right->st_ino &&
    left->st_uid == right->st_uid && left->st_gid == right->st_gid &&
    left->st_mode == right->st_mode && left->st_nlink == right->st_nlink &&
    left->st_size == right->st_size &&
    left->st_mtimespec.tv_sec == right->st_mtimespec.tv_sec &&
    left->st_mtimespec.tv_nsec == right->st_mtimespec.tv_nsec &&
    left->st_ctimespec.tv_sec == right->st_ctimespec.tv_sec &&
    left->st_ctimespec.tv_nsec == right->st_ctimespec.tv_nsec;
}

static bool
setfarm_same_locator_v2(const struct stat *left, const struct stat *right)
{
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino;
}

static bool
setfarm_allowed_link_count_v2(nlink_t count)
{
  return count == (nlink_t)1 || count == (nlink_t)2;
}

static setfarm_bootstrap_scope_error_v2
setfarm_parent_fence_v2(
  int root_fd,
  const struct stat *expected,
  setfarm_bootstrap_scope_failure_v2 *failure,
  setfarm_bootstrap_scope_replay_state_v2 state)
{
  struct stat current;
  if (fstat(root_fd, &current) != 0) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_PARENT_CHANGED_V2, saved_errno, state);
    return SETFARM_BOOTSTRAP_SCOPE_PARENT_CHANGED_V2;
  }
  if (!setfarm_same_parent_v2(expected, &current)) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_PARENT_CHANGED_V2, 0, state);
    return SETFARM_BOOTSTRAP_SCOPE_PARENT_CHANGED_V2;
  }
  return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
}

static setfarm_bootstrap_scope_error_v2
setfarm_full_sync_v2(
  int fd,
  setfarm_bootstrap_scope_failure_v2 *failure,
  setfarm_bootstrap_scope_replay_state_v2 state,
  setfarm_bootstrap_scope_full_sync_role_v2 role,
  setfarm_bootstrap_scope_timing_v2 *timing)
{
#if defined(__APPLE__) && defined(F_FULLFSYNC)
  struct timespec started;
  struct timespec finished;
  bool started_available = false;
  bool finished_available = false;
  int sync_result;
  int saved_errno;
  if (timing != NULL) {
#if defined(CLOCK_MONOTONIC_RAW)
    started_available = clock_gettime(CLOCK_MONOTONIC_RAW, &started) == 0;
#endif
  }
  sync_result = fcntl(fd, F_FULLFSYNC, 0);
  saved_errno = sync_result == 0 ? 0 : errno;
  if (timing != NULL) {
    uint32_t call_index = timing->full_sync_call_count;
    timing->full_sync_call_count += 1;
#if defined(CLOCK_MONOTONIC_RAW)
    finished_available = clock_gettime(CLOCK_MONOTONIC_RAW, &finished) == 0;
#endif
    if (!started_available || !finished_available ||
        started.tv_sec < 0 || finished.tv_sec < started.tv_sec ||
        (finished.tv_sec == started.tv_sec &&
         finished.tv_nsec < started.tv_nsec)) {
      timing->monotonic_raw_clock_available = 0;
    } else if (
      call_index < SETFARM_BOOTSTRAP_SCOPE_MAX_RECORDED_FULL_SYNCS_V2) {
      uint64_t seconds = (uint64_t)(finished.tv_sec - started.tv_sec);
      int64_t nanoseconds =
        (int64_t)finished.tv_nsec - (int64_t)started.tv_nsec;
      if (nanoseconds < 0) {
        seconds -= 1;
        nanoseconds += 1000000000LL;
      }
      if (seconds >
          (UINT64_MAX - (uint64_t)nanoseconds) / UINT64_C(1000000000)) {
        timing->monotonic_raw_clock_available = 0;
      } else {
        timing->full_sync_nanoseconds[call_index] =
          seconds * UINT64_C(1000000000) + (uint64_t)nanoseconds;
        timing->full_sync_roles[call_index] = role;
        timing->full_sync_states[call_index] = state;
        timing->recorded_full_sync_count += 1;
      }
    } else {
      timing->recording_truncated = 1;
    }
  }
  if (sync_result != 0) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_SYNC_FAILED_V2, saved_errno, state);
    return SETFARM_BOOTSTRAP_SCOPE_SYNC_FAILED_V2;
  }
  return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
#else
  (void)fd;
  (void)role;
  (void)timing;
  setfarm_failure_v2(
    failure, SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2, ENOTSUP, state);
  return SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2;
#endif
}

static setfarm_bootstrap_scope_error_v2
setfarm_read_exact_entry_v2(
  int root_fd,
  const char *fixed_name,
  const uint8_t *expected_bytes,
  size_t expected_length,
  uid_t expected_uid,
  gid_t expected_gid,
  setfarm_scope_observation_v2 *observation,
  setfarm_bootstrap_scope_failure_v2 *failure,
  setfarm_bootstrap_scope_replay_state_v2 state)
{
  struct stat path_before;
  struct stat descriptor_before;
  struct stat descriptor_after;
  struct stat path_after;
  uint8_t *read_buffer = NULL;
  uint8_t eof_probe = 0;
  int fd = -1;
  size_t offset = 0;
  setfarm_bootstrap_scope_error_v2 code = SETFARM_BOOTSTRAP_SCOPE_OK_V2;

  memset(observation, 0, sizeof(*observation));
  if (fstatat(root_fd, fixed_name, &path_before, AT_SYMLINK_NOFOLLOW) != 0) {
    int saved_errno = errno;
    if (saved_errno == ENOENT) {
      return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
    }
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2, saved_errno, state);
    return SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2;
  }
  if (!S_ISREG(path_before.st_mode) ||
      (path_before.st_mode & (mode_t)07777) != (mode_t)0600 ||
      path_before.st_uid != expected_uid || path_before.st_gid != expected_gid ||
      !setfarm_allowed_link_count_v2(path_before.st_nlink) ||
      path_before.st_size != (off_t)expected_length) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2, 0, state);
    return SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2;
  }

  fd = openat(
    root_fd,
    fixed_name,
    O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (fd < 0) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2, saved_errno, state);
    return SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2;
  }
  if (fstat(fd, &descriptor_before) != 0 ||
      !setfarm_same_file_snapshot_v2(&path_before, &descriptor_before)) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
    goto cleanup;
  }

  read_buffer = (uint8_t *)malloc(expected_length);
  if (read_buffer == NULL) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2, ENOMEM, state);
    code = SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2;
    goto cleanup;
  }
  while (offset < expected_length) {
    ssize_t read_count = pread(
      fd, read_buffer + offset, expected_length - offset, (off_t)offset);
    if (read_count < 0 && errno == EINTR) {
      continue;
    }
    if (read_count <= 0) {
      int saved_errno = read_count < 0 ? errno : 0;
      setfarm_failure_v2(
        failure, SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2,
        saved_errno, state);
      code = SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2;
      goto cleanup;
    }
    offset += (size_t)read_count;
  }
  for (;;) {
    ssize_t probe_count = pread(fd, &eof_probe, 1, (off_t)expected_length);
    if (probe_count < 0 && errno == EINTR) {
      continue;
    }
    if (probe_count != 0) {
      int saved_errno = probe_count < 0 ? errno : 0;
      setfarm_failure_v2(
        failure, SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2,
        saved_errno, state);
      code = SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2;
      goto cleanup;
    }
    break;
  }
  if (memcmp(read_buffer, expected_bytes, expected_length) != 0) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_CONTENT_MISMATCH_V2, 0, state);
    code = SETFARM_BOOTSTRAP_SCOPE_CONTENT_MISMATCH_V2;
    goto cleanup;
  }
  if (fstat(fd, &descriptor_after) != 0 ||
      fstatat(root_fd, fixed_name, &path_after, AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_same_file_snapshot_v2(&path_before, &descriptor_after) ||
      !setfarm_same_file_snapshot_v2(&path_before, &path_after)) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
    goto cleanup;
  }
  observation->present = true;
  observation->status = path_after;

cleanup:
  if (read_buffer != NULL) {
    setfarm_zero_bytes_v2(read_buffer, expected_length);
    free(read_buffer);
  }
  eof_probe = 0;
  if (close(fd) != 0 && code == SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
  }
  return code;
}

static setfarm_bootstrap_scope_error_v2
setfarm_classify_v2(
  int root_fd,
  const uint8_t *expected_bytes,
  size_t expected_length,
  uid_t expected_uid,
  gid_t expected_gid,
  setfarm_scope_pair_v2 *pair,
  setfarm_bootstrap_scope_failure_v2 *failure)
{
  setfarm_bootstrap_scope_error_v2 code;
  memset(pair, 0, sizeof(*pair));
  pair->state = SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2;

  code = setfarm_read_exact_entry_v2(
    root_fd, SETFARM_BOOTSTRAP_SCOPE_STAGE_NAME_V2,
    expected_bytes, expected_length, expected_uid, expected_gid,
    &pair->stage, failure, pair->state);
  if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    return code;
  }
  code = setfarm_read_exact_entry_v2(
    root_fd, SETFARM_BOOTSTRAP_SCOPE_TARGET_NAME_V2,
    expected_bytes, expected_length, expected_uid, expected_gid,
    &pair->target, failure, pair->state);
  if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    return code;
  }

  if (!pair->stage.present && !pair->target.present) {
    pair->state = SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2;
    return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
  }
  if (pair->stage.present && !pair->target.present &&
      pair->stage.status.st_nlink == (nlink_t)1) {
    pair->state = SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2;
    return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
  }
  if (!pair->stage.present && pair->target.present &&
      pair->target.status.st_nlink == (nlink_t)1) {
    pair->state = SETFARM_BOOTSTRAP_SCOPE_REPLAY_FINAL_ONLY_V2;
    return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
  }
  if (pair->stage.present && pair->target.present &&
      pair->stage.status.st_nlink == (nlink_t)2 &&
      pair->target.status.st_nlink == (nlink_t)2 &&
      setfarm_same_locator_v2(&pair->stage.status, &pair->target.status)) {
    pair->state = SETFARM_BOOTSTRAP_SCOPE_REPLAY_OVERLAP_V2;
    return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
  }

  setfarm_failure_v2(
    failure, SETFARM_BOOTSTRAP_SCOPE_STATE_CONFLICT_V2, 0,
    SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2);
  return SETFARM_BOOTSTRAP_SCOPE_STATE_CONFLICT_V2;
}

static setfarm_bootstrap_scope_error_v2
setfarm_sync_exact_entry_v2(
  int root_fd,
  const char *fixed_name,
  const struct stat *expected,
  setfarm_bootstrap_scope_failure_v2 *failure,
  setfarm_bootstrap_scope_replay_state_v2 state,
  setfarm_bootstrap_scope_full_sync_role_v2 role,
  setfarm_bootstrap_scope_timing_v2 *timing)
{
  struct stat before;
  struct stat after;
  int fd = openat(
    root_fd, fixed_name,
    O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  setfarm_bootstrap_scope_error_v2 code;
  if (fd < 0) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    return SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
  }
  if (fstat(fd, &before) != 0 ||
      !setfarm_same_file_snapshot_v2(expected, &before)) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    (void)close(fd);
    return SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
  }
  code = setfarm_full_sync_v2(fd, failure, state, role, timing);
  if (code == SETFARM_BOOTSTRAP_SCOPE_OK_V2 &&
      (fstat(fd, &after) != 0 ||
       !setfarm_same_file_snapshot_v2(expected, &after))) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
  }
  if (close(fd) != 0 && code == SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, state);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
  }
  return code;
}

static setfarm_bootstrap_scope_error_v2
setfarm_create_exact_stage_v2(
  int root_fd,
  const uint8_t *scope_bytes,
  size_t scope_length,
  uid_t expected_uid,
  gid_t expected_gid,
  setfarm_bootstrap_scope_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_bootstrap_scope_timing_v2 *timing,
  setfarm_bootstrap_scope_failure_v2 *failure)
{
  int fd = openat(
    root_fd,
    SETFARM_BOOTSTRAP_SCOPE_STAGE_NAME_V2,
    O_RDWR | O_CLOEXEC | O_NOFOLLOW | O_CREAT | O_EXCL,
    (mode_t)0600);
  size_t offset = 0;
  setfarm_bootstrap_scope_error_v2 code = SETFARM_BOOTSTRAP_SCOPE_OK_V2;
  struct stat status;

  if (fd < 0) {
    int saved_errno = errno;
    if (saved_errno == EEXIST) {
      return SETFARM_BOOTSTRAP_SCOPE_STATE_CONFLICT_V2;
    }
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_CREATE_FAILED_V2,
      saved_errno, SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2);
    return SETFARM_BOOTSTRAP_SCOPE_CREATE_FAILED_V2;
  }
  if (fchmod(fd, (mode_t)0600) != 0) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_CREATE_FAILED_V2,
      saved_errno, SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2);
    code = SETFARM_BOOTSTRAP_SCOPE_CREATE_FAILED_V2;
    goto cleanup;
  }
  while (offset < scope_length) {
    ssize_t write_count = pwrite(
      fd, scope_bytes + offset, scope_length - offset, (off_t)offset);
    if (write_count < 0 && errno == EINTR) {
      continue;
    }
    if (write_count <= 0) {
      int saved_errno = write_count < 0 ? errno : 0;
      setfarm_failure_v2(
        failure, SETFARM_BOOTSTRAP_SCOPE_WRITE_FAILED_V2,
        saved_errno, SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2);
      code = SETFARM_BOOTSTRAP_SCOPE_WRITE_FAILED_V2;
      goto cleanup;
    }
    offset += (size_t)write_count;
  }
  if (fstat(fd, &status) != 0 || !S_ISREG(status.st_mode) ||
      (status.st_mode & (mode_t)07777) != (mode_t)0600 ||
      status.st_uid != expected_uid || status.st_gid != expected_gid ||
      status.st_nlink != (nlink_t)1 ||
      status.st_size != (off_t)scope_length) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
    goto cleanup;
  }
  if (checkpoint_hook != NULL) {
    checkpoint_hook(
      SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_WRITE_V2,
      checkpoint_context);
  }
  code = setfarm_full_sync_v2(
    fd, failure, SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2,
    SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_STAGE_AFTER_WRITE_V2, timing);
  if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    goto cleanup;
  }
  if (checkpoint_hook != NULL) {
    checkpoint_hook(
      SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_FULLSYNC_V2,
      checkpoint_context);
  }

cleanup:
  if (close(fd) != 0 && code == SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    int saved_errno = errno;
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
      saved_errno, SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2);
    code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
  }
  return code;
}

static void
setfarm_fill_evidence_v2(
  const struct stat *status,
  setfarm_bootstrap_scope_physical_evidence_v2 *evidence)
{
  evidence->device = (uint64_t)status->st_dev;
  evidence->inode = (uint64_t)status->st_ino;
  evidence->link_count = (uint64_t)status->st_nlink;
  evidence->byte_length = (uint64_t)status->st_size;
  evidence->owner_uid = (uint64_t)status->st_uid;
  evidence->owner_gid = (uint64_t)status->st_gid;
  evidence->mode = (uint32_t)(status->st_mode & (mode_t)07777);
  evidence->modified_seconds = (int64_t)status->st_mtimespec.tv_sec;
  evidence->modified_nanoseconds = (int64_t)status->st_mtimespec.tv_nsec;
  evidence->changed_seconds = (int64_t)status->st_ctimespec.tv_sec;
  evidence->changed_nanoseconds = (int64_t)status->st_ctimespec.tv_nsec;
}

setfarm_bootstrap_scope_error_v2
setfarm_bootstrap_scope_publish_fixed_v2(
  int inherited_root_fd,
  const uint8_t *scope_bytes,
  size_t scope_length,
  setfarm_bootstrap_scope_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_bootstrap_scope_timing_v2 *timing,
  setfarm_bootstrap_scope_result_v2 *result,
  setfarm_bootstrap_scope_failure_v2 *failure)
{
  int root_fd = -1;
  struct stat parent_initial;
  setfarm_scope_pair_v2 pair;
  setfarm_scope_pair_v2 final_pair;
  setfarm_bootstrap_scope_replay_state_v2 initial_state;
  setfarm_bootstrap_scope_error_v2 code;
  uint8_t *admitted_scope_bytes = NULL;
  int attempt;

  if (result != NULL) {
    memset(result, 0, sizeof(*result));
  }
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (timing != NULL) {
    memset(timing, 0, sizeof(*timing));
    timing->monotonic_raw_clock_available = 1;
  }
  if (inherited_root_fd < 0 || scope_bytes == NULL || scope_length == 0 ||
      scope_length > SETFARM_BOOTSTRAP_SCOPE_MAX_BYTES_V2 || result == NULL ||
      failure == NULL) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_INVALID_ARGUMENT_V2, EINVAL,
      SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2);
    return SETFARM_BOOTSTRAP_SCOPE_INVALID_ARGUMENT_V2;
  }

#if !defined(__APPLE__) || !defined(F_FULLFSYNC)
  setfarm_failure_v2(
    failure, SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2, ENOTSUP,
    SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2);
  return SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2;
#else
  admitted_scope_bytes = (uint8_t *)malloc(scope_length);
  if (admitted_scope_bytes == NULL) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2, ENOMEM,
      SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2);
    return SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2;
  }
  memcpy(admitted_scope_bytes, scope_bytes, scope_length);
  root_fd = fcntl(inherited_root_fd, F_DUPFD_CLOEXEC, 0);
  if (root_fd < 0 || fstat(root_fd, &parent_initial) != 0 ||
      !S_ISDIR(parent_initial.st_mode)) {
    int saved_errno = errno;
    if (root_fd >= 0) {
      (void)close(root_fd);
    }
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_ROOT_FD_INVALID_V2,
      saved_errno, SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2);
    setfarm_zero_bytes_v2(admitted_scope_bytes, scope_length);
    free(admitted_scope_bytes);
    return SETFARM_BOOTSTRAP_SCOPE_ROOT_FD_INVALID_V2;
  }

  code = setfarm_classify_v2(
    root_fd, admitted_scope_bytes, scope_length,
    parent_initial.st_uid, parent_initial.st_gid, &pair, failure);
  if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    (void)close(root_fd);
    setfarm_zero_bytes_v2(admitted_scope_bytes, scope_length);
    free(admitted_scope_bytes);
    return code;
  }
  initial_state = pair.state;
  result->initial_state = initial_state;

  for (attempt = 0; attempt < SETFARM_SCOPE_MAX_ATTEMPTS_V2; attempt += 1) {
    code = setfarm_parent_fence_v2(
      root_fd, &parent_initial, failure, pair.state);
    if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
      break;
    }
    code = setfarm_classify_v2(
      root_fd, admitted_scope_bytes, scope_length,
      parent_initial.st_uid, parent_initial.st_gid, &pair, failure);
    if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
      break;
    }

    if (pair.state == SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2) {
      code = setfarm_create_exact_stage_v2(
        root_fd, admitted_scope_bytes, scope_length,
        parent_initial.st_uid, parent_initial.st_gid, checkpoint_hook,
        checkpoint_context, timing, failure);
      if (code == SETFARM_BOOTSTRAP_SCOPE_STATE_CONFLICT_V2) {
        continue;
      }
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      continue;
    }

    if (pair.state == SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2) {
      code = setfarm_sync_exact_entry_v2(
        root_fd, SETFARM_BOOTSTRAP_SCOPE_STAGE_NAME_V2,
        &pair.stage.status, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_STAGE_BEFORE_LINK_V2, timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_FULLSYNC_V2,
          checkpoint_context);
      }
      code = setfarm_full_sync_v2(
        root_fd, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_BEFORE_LINK_V2, timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_PARENT_FULLSYNC_BEFORE_LINK_V2,
          checkpoint_context);
      }
      code = setfarm_classify_v2(
        root_fd, admitted_scope_bytes, scope_length,
        parent_initial.st_uid, parent_initial.st_gid, &final_pair, failure);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2 ||
          final_pair.state != SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2 ||
          !setfarm_same_file_snapshot_v2(
            &pair.stage.status, &final_pair.stage.status)) {
        if (code == SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
          setfarm_failure_v2(
            failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
            0, final_pair.state);
          code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
        }
        break;
      }
      if (linkat(
            root_fd, SETFARM_BOOTSTRAP_SCOPE_STAGE_NAME_V2,
            root_fd, SETFARM_BOOTSTRAP_SCOPE_TARGET_NAME_V2, 0) != 0) {
        int saved_errno = errno;
        if (saved_errno == EEXIST) {
          continue;
        }
        setfarm_failure_v2(
          failure, SETFARM_BOOTSTRAP_SCOPE_LINK_FAILED_V2,
          saved_errno, pair.state);
        code = SETFARM_BOOTSTRAP_SCOPE_LINK_FAILED_V2;
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_LINK_V2,
          checkpoint_context);
      }
      continue;
    }

    if (pair.state == SETFARM_BOOTSTRAP_SCOPE_REPLAY_OVERLAP_V2) {
      code = setfarm_sync_exact_entry_v2(
        root_fd, SETFARM_BOOTSTRAP_SCOPE_TARGET_NAME_V2,
        &pair.target.status, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_TARGET_BEFORE_UNLINK_V2, timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_TARGET_FULLSYNC_V2,
          checkpoint_context);
      }
      code = setfarm_full_sync_v2(
        root_fd, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_BEFORE_UNLINK_V2, timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_PARENT_FULLSYNC_BEFORE_UNLINK_V2,
          checkpoint_context);
      }
      code = setfarm_classify_v2(
        root_fd, admitted_scope_bytes, scope_length,
        parent_initial.st_uid, parent_initial.st_gid, &final_pair, failure);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2 ||
          final_pair.state != SETFARM_BOOTSTRAP_SCOPE_REPLAY_OVERLAP_V2 ||
          !setfarm_same_file_snapshot_v2(
            &pair.stage.status, &final_pair.stage.status) ||
          !setfarm_same_file_snapshot_v2(
            &pair.target.status, &final_pair.target.status)) {
        if (code == SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
          setfarm_failure_v2(
            failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
            0, final_pair.state);
          code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
        }
        break;
      }
      if (unlinkat(
            root_fd, SETFARM_BOOTSTRAP_SCOPE_STAGE_NAME_V2, 0) != 0) {
        int saved_errno = errno;
        setfarm_failure_v2(
          failure, SETFARM_BOOTSTRAP_SCOPE_UNLINK_FAILED_V2,
          saved_errno, pair.state);
        code = SETFARM_BOOTSTRAP_SCOPE_UNLINK_FAILED_V2;
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_UNLINK_V2,
          checkpoint_context);
      }
      code = setfarm_full_sync_v2(
        root_fd, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_AFTER_UNLINK_V2, timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_FINAL_PARENT_FULLSYNC_V2,
          checkpoint_context);
      }
      continue;
    }

    if (pair.state == SETFARM_BOOTSTRAP_SCOPE_REPLAY_FINAL_ONLY_V2) {
      code = setfarm_sync_exact_entry_v2(
        root_fd, SETFARM_BOOTSTRAP_SCOPE_TARGET_NAME_V2,
        &pair.target.status, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_TARGET_FINAL_REVALIDATION_V2,
        timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      code = setfarm_full_sync_v2(
        root_fd, failure, pair.state,
        SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_FINAL_REVALIDATION_V2,
        timing);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      if (checkpoint_hook != NULL) {
        checkpoint_hook(
          SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_FINAL_PARENT_FULLSYNC_V2,
          checkpoint_context);
      }
      code = setfarm_parent_fence_v2(
        root_fd, &parent_initial, failure, pair.state);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
        break;
      }
      code = setfarm_classify_v2(
        root_fd, admitted_scope_bytes, scope_length,
        parent_initial.st_uid, parent_initial.st_gid, &final_pair, failure);
      if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2 ||
          final_pair.state != SETFARM_BOOTSTRAP_SCOPE_REPLAY_FINAL_ONLY_V2 ||
          !setfarm_same_file_snapshot_v2(
            &pair.target.status, &final_pair.target.status)) {
        if (code == SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
          setfarm_failure_v2(
            failure, SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2,
            0, final_pair.state);
          code = SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2;
        }
        break;
      }
      result->initial_state = initial_state;
      result->final_state = final_pair.state;
      setfarm_fill_evidence_v2(
        &final_pair.target.status, &result->final_evidence);
      (void)close(root_fd);
      setfarm_zero_bytes_v2(admitted_scope_bytes, scope_length);
      free(admitted_scope_bytes);
      setfarm_failure_v2(
        failure, SETFARM_BOOTSTRAP_SCOPE_OK_V2, 0, final_pair.state);
      return SETFARM_BOOTSTRAP_SCOPE_OK_V2;
    }
  }

  if (attempt == SETFARM_SCOPE_MAX_ATTEMPTS_V2) {
    setfarm_failure_v2(
      failure, SETFARM_BOOTSTRAP_SCOPE_ITERATION_LIMIT_V2, 0, pair.state);
    code = SETFARM_BOOTSTRAP_SCOPE_ITERATION_LIMIT_V2;
  }
  (void)close(root_fd);
  setfarm_zero_bytes_v2(admitted_scope_bytes, scope_length);
  free(admitted_scope_bytes);
  return code;
#endif
}

const char *
setfarm_bootstrap_scope_error_name_v2(setfarm_bootstrap_scope_error_v2 code)
{
  switch (code) {
  case SETFARM_BOOTSTRAP_SCOPE_OK_V2: return "ok";
  case SETFARM_BOOTSTRAP_SCOPE_INVALID_ARGUMENT_V2: return "invalid_argument";
  case SETFARM_BOOTSTRAP_SCOPE_ROOT_FD_INVALID_V2: return "root_fd_invalid";
  case SETFARM_BOOTSTRAP_SCOPE_PARENT_CHANGED_V2: return "parent_changed";
  case SETFARM_BOOTSTRAP_SCOPE_ENTRY_INVALID_V2: return "entry_invalid";
  case SETFARM_BOOTSTRAP_SCOPE_CONTENT_MISMATCH_V2: return "content_mismatch";
  case SETFARM_BOOTSTRAP_SCOPE_STATE_CONFLICT_V2: return "state_conflict";
  case SETFARM_BOOTSTRAP_SCOPE_CREATE_FAILED_V2: return "create_failed";
  case SETFARM_BOOTSTRAP_SCOPE_WRITE_FAILED_V2: return "write_failed";
  case SETFARM_BOOTSTRAP_SCOPE_SYNC_FAILED_V2: return "sync_failed";
  case SETFARM_BOOTSTRAP_SCOPE_LINK_FAILED_V2: return "link_failed";
  case SETFARM_BOOTSTRAP_SCOPE_UNLINK_FAILED_V2: return "unlink_failed";
  case SETFARM_BOOTSTRAP_SCOPE_REVALIDATION_FAILED_V2:
    return "revalidation_failed";
  case SETFARM_BOOTSTRAP_SCOPE_ITERATION_LIMIT_V2: return "iteration_limit";
  case SETFARM_BOOTSTRAP_SCOPE_PLATFORM_UNAVAILABLE_V2:
    return "platform_unavailable";
  }
  return "unknown";
}

const char *
setfarm_bootstrap_scope_replay_state_name_v2(
  setfarm_bootstrap_scope_replay_state_v2 state)
{
  switch (state) {
  case SETFARM_BOOTSTRAP_SCOPE_REPLAY_ABSENT_V2: return "absent";
  case SETFARM_BOOTSTRAP_SCOPE_REPLAY_STAGE_ONLY_V2: return "stage_only";
  case SETFARM_BOOTSTRAP_SCOPE_REPLAY_OVERLAP_V2: return "overlap";
  case SETFARM_BOOTSTRAP_SCOPE_REPLAY_FINAL_ONLY_V2: return "final_only";
  case SETFARM_BOOTSTRAP_SCOPE_REPLAY_CONFLICT_V2: return "conflict";
  }
  return "unknown";
}

const char *
setfarm_bootstrap_scope_full_sync_role_name_v2(
  setfarm_bootstrap_scope_full_sync_role_v2 role)
{
  switch (role) {
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_STAGE_AFTER_WRITE_V2:
    return "stage_after_write";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_STAGE_BEFORE_LINK_V2:
    return "stage_before_link";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_BEFORE_LINK_V2:
    return "parent_before_link";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_TARGET_BEFORE_UNLINK_V2:
    return "target_before_unlink";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_BEFORE_UNLINK_V2:
    return "parent_before_unlink";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_AFTER_UNLINK_V2:
    return "parent_after_unlink";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_TARGET_FINAL_REVALIDATION_V2:
    return "target_final_revalidation";
  case SETFARM_BOOTSTRAP_SCOPE_FULL_SYNC_PARENT_FINAL_REVALIDATION_V2:
    return "parent_final_revalidation";
  }
  return "unknown";
}
