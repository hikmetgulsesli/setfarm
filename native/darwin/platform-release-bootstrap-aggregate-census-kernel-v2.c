#include "platform-release-bootstrap-aggregate-census-kernel-v2.h"

#if defined(__APPLE__)
#include <CommonCrypto/CommonDigest.h>
#endif
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stdint.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static bool
setfarm_members_equal_v2(
  const setfarm_aggregate_census_member_v2 *left,
  size_t left_count,
  const setfarm_aggregate_census_member_v2 *right,
  size_t right_count);

typedef struct setfarm_capture_budget_v2 {
  size_t total_file_bytes;
  size_t total_directory_members;
  uint64_t total_recursive_file_bytes;
} setfarm_capture_budget_v2;

typedef struct setfarm_capture_pass_v2 {
  setfarm_aggregate_census_stat_v2 parent_stat;
  setfarm_aggregate_census_entry_v2 *entries;
  size_t entry_count;
  setfarm_aggregate_census_recursive_evidence_v2 node_recursive_evidence;
} setfarm_capture_pass_v2;

typedef struct setfarm_held_lock_v2 {
  const char *name;
  const uint8_t *content;
  size_t content_length;
  int fd;
  bool locked;
  struct stat status;
  setfarm_aggregate_census_stat_v2 evidence;
} setfarm_held_lock_v2;

typedef enum setfarm_aggregate_census_session_state_v2 {
  SETFARM_AGGREGATE_CENSUS_SESSION_BASELINE_READY_V2 = 1,
  SETFARM_AGGREGATE_CENSUS_SESSION_RECAPTURE_EQUAL_V2 = 2
} setfarm_aggregate_census_session_state_v2;

struct setfarm_aggregate_census_session_v2 {
  int parent_fd;
  struct stat parent_status;
  setfarm_aggregate_census_stat_v2 parent_evidence;
  setfarm_held_lock_v2 shared_lock;
  setfarm_held_lock_v2 node_lock;
  setfarm_capture_pass_v2 private_baseline;
  setfarm_aggregate_census_result_v2 observation;
  setfarm_aggregate_census_session_state_v2 state;
  bool capture_recursive;
  bool exact_entry_capture_consumed;
  int exact_entry_fd;
};

#if defined(__APPLE__)
static const uint8_t setfarm_shared_lock_content_v2[] =
  SETFARM_AGGREGATE_CENSUS_SHARED_LOCK_CONTENT_V2;
static const uint8_t setfarm_node_lock_content_v2[] =
  SETFARM_AGGREGATE_CENSUS_NODE_LOCK_CONTENT_V2;
static const char setfarm_node_manifest_name_v2[] =
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json";
static const char setfarm_node_launcher_name_v2[] =
  "setfarm-node-toolchain-provisioner-v2";
static const char setfarm_node_bundle_name_v2[] =
  "node-toolchain-provisioner-v2.cjs";
static const char setfarm_node_runtime_name_v2[] = "node";
#endif

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
setfarm_fail_v2(
  setfarm_aggregate_census_failure_v2 *failure,
  setfarm_aggregate_census_error_v2 code,
  int system_errno)
{
  if (failure == NULL) {
    return;
  }
  failure->code = code;
  failure->system_errno = system_errno;
}

static setfarm_aggregate_census_object_kind_v2
setfarm_object_kind_v2(mode_t mode)
{
  if (S_ISREG(mode)) {
    return SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2;
  }
  if (S_ISDIR(mode)) {
    return SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2;
  }
  return (setfarm_aggregate_census_object_kind_v2)0;
}

static bool
setfarm_stat_representable_v2(const struct stat *status)
{
  return status->st_dev >= 0 && status->st_ino > 0 && status->st_uid >= 0 &&
    status->st_gid >= 0 && status->st_nlink > 0 && status->st_size >= 0 &&
    status->st_mtimespec.tv_nsec >= 0 &&
    status->st_mtimespec.tv_nsec < 1000000000L &&
    status->st_ctimespec.tv_nsec >= 0 &&
    status->st_ctimespec.tv_nsec < 1000000000L &&
    setfarm_object_kind_v2(status->st_mode) != 0;
}

static void
setfarm_fill_stat_v2(
  const struct stat *status,
  setfarm_aggregate_census_stat_v2 *evidence)
{
  evidence->stable.object_kind = setfarm_object_kind_v2(status->st_mode);
  evidence->stable.device = (uint64_t)status->st_dev;
  evidence->stable.inode = (uint64_t)status->st_ino;
  evidence->mutable.owner_uid = (uint64_t)status->st_uid;
  evidence->mutable.owner_gid = (uint64_t)status->st_gid;
  evidence->mutable.mode =
    (uint32_t)(status->st_mode & (mode_t)07777);
  evidence->mutable.link_count = (uint64_t)status->st_nlink;
  evidence->mutable.byte_length = (uint64_t)status->st_size;
  evidence->mutable.modified_seconds =
    (int64_t)status->st_mtimespec.tv_sec;
  evidence->mutable.modified_nanoseconds =
    (int64_t)status->st_mtimespec.tv_nsec;
  evidence->mutable.changed_seconds =
    (int64_t)status->st_ctimespec.tv_sec;
  evidence->mutable.changed_nanoseconds =
    (int64_t)status->st_ctimespec.tv_nsec;
}

static bool
setfarm_same_evidence_v2(
  const setfarm_aggregate_census_stat_v2 *left,
  const setfarm_aggregate_census_stat_v2 *right)
{
  return left->stable.object_kind == right->stable.object_kind &&
    left->stable.device == right->stable.device &&
    left->stable.inode == right->stable.inode &&
    left->mutable.owner_uid == right->mutable.owner_uid &&
    left->mutable.owner_gid == right->mutable.owner_gid &&
    left->mutable.mode == right->mutable.mode &&
    left->mutable.link_count == right->mutable.link_count &&
    left->mutable.byte_length == right->mutable.byte_length &&
    left->mutable.modified_seconds == right->mutable.modified_seconds &&
    left->mutable.modified_nanoseconds ==
      right->mutable.modified_nanoseconds &&
    left->mutable.changed_seconds == right->mutable.changed_seconds &&
    left->mutable.changed_nanoseconds == right->mutable.changed_nanoseconds;
}

static bool
setfarm_same_status_v2(
  const struct stat *left,
  const struct stat *right)
{
  setfarm_aggregate_census_stat_v2 left_evidence;
  setfarm_aggregate_census_stat_v2 right_evidence;
  if (!setfarm_stat_representable_v2(left) ||
      !setfarm_stat_representable_v2(right)) {
    return false;
  }
  setfarm_fill_stat_v2(left, &left_evidence);
  setfarm_fill_stat_v2(right, &right_evidence);
  return setfarm_same_evidence_v2(&left_evidence, &right_evidence);
}

static bool
setfarm_same_name_v2(
  const uint8_t *left,
  size_t left_length,
  const uint8_t *right,
  size_t right_length)
{
  return left_length == right_length &&
    (left_length == 0 || memcmp(left, right, left_length) == 0);
}

static int
setfarm_member_compare_v2(const void *left_opaque, const void *right_opaque)
{
  const setfarm_aggregate_census_member_v2 *left =
    (const setfarm_aggregate_census_member_v2 *)left_opaque;
  const setfarm_aggregate_census_member_v2 *right =
    (const setfarm_aggregate_census_member_v2 *)right_opaque;
  size_t common = left->basename_length < right->basename_length
    ? left->basename_length
    : right->basename_length;
  int compared = common == 0
    ? 0
    : memcmp(left->basename, right->basename, common);
  if (compared != 0) {
    return compared;
  }
  if (left->basename_length < right->basename_length) {
    return -1;
  }
  if (left->basename_length > right->basename_length) {
    return 1;
  }
  return 0;
}

static void
setfarm_members_dispose_v2(
  setfarm_aggregate_census_member_v2 *members,
  size_t count)
{
  size_t index;
  if (members == NULL) {
    return;
  }
  for (index = 0; index < count; index += 1) {
    if (members[index].basename != NULL) {
      setfarm_zero_bytes_v2(
        members[index].basename,
        members[index].basename_length + 1);
      free(members[index].basename);
    }
  }
  setfarm_zero_bytes_v2(
    members,
    count * sizeof(setfarm_aggregate_census_member_v2));
  free(members);
}

static void
setfarm_entry_dispose_v2(setfarm_aggregate_census_entry_v2 *entry)
{
  if (entry == NULL) {
    return;
  }
  if (entry->basename != NULL) {
    setfarm_zero_bytes_v2(entry->basename, entry->basename_length + 1);
    free(entry->basename);
  }
  if (entry->file_bytes != NULL) {
    setfarm_zero_bytes_v2(entry->file_bytes, entry->file_length);
    free(entry->file_bytes);
  }
  setfarm_members_dispose_v2(entry->members, entry->member_count);
  setfarm_zero_bytes_v2(entry, sizeof(*entry));
}

static void
setfarm_entries_dispose_v2(
  setfarm_aggregate_census_entry_v2 *entries,
  size_t count)
{
  size_t index;
  if (entries == NULL) {
    return;
  }
  for (index = 0; index < count; index += 1) {
    setfarm_entry_dispose_v2(&entries[index]);
  }
  setfarm_zero_bytes_v2(
    entries,
    count * sizeof(setfarm_aggregate_census_entry_v2));
  free(entries);
}

void
setfarm_aggregate_census_exact_entry_capture_dispose_v2(
  setfarm_aggregate_census_exact_entry_capture_v2 *capture)
{
  if (capture == NULL) {
    return;
  }
  setfarm_entry_dispose_v2(&capture->first_observation);
  setfarm_entry_dispose_v2(&capture->second_observation);
  setfarm_zero_bytes_v2(capture, sizeof(*capture));
}

static void
setfarm_recursive_evidence_dispose_v2(
  setfarm_aggregate_census_recursive_evidence_v2 *evidence)
{
  size_t index;
  if (evidence == NULL) {
    return;
  }
  for (index = 0;
       index < SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_ENTRY_COUNT_V2;
       index += 1) {
    setfarm_members_dispose_v2(
      evidence->entries[index].members,
      evidence->entries[index].member_count);
    evidence->entries[index].members = NULL;
    evidence->entries[index].member_count = 0;
    setfarm_zero_bytes_v2(
      evidence->entries[index].content_sha256,
      sizeof(evidence->entries[index].content_sha256));
  }
  setfarm_zero_bytes_v2(evidence, sizeof(*evidence));
}

void
setfarm_aggregate_census_result_dispose_v2(
  setfarm_aggregate_census_result_v2 *result)
{
  if (result == NULL) {
    return;
  }
  setfarm_entries_dispose_v2(result->entries, result->entry_count);
  setfarm_recursive_evidence_dispose_v2(
    &result->node_recursive_evidence);
  setfarm_zero_bytes_v2(result, sizeof(*result));
}

static void
setfarm_pass_dispose_v2(setfarm_capture_pass_v2 *pass)
{
  if (pass == NULL) {
    return;
  }
  setfarm_entries_dispose_v2(pass->entries, pass->entry_count);
  setfarm_recursive_evidence_dispose_v2(
    &pass->node_recursive_evidence);
  setfarm_zero_bytes_v2(pass, sizeof(*pass));
}

static setfarm_aggregate_census_error_v2
setfarm_parent_fence_v2(
  int parent_fd,
  const setfarm_aggregate_census_stat_v2 *expected,
  setfarm_aggregate_census_failure_v2 *failure)
{
  struct stat current;
  setfarm_aggregate_census_stat_v2 evidence;
  if (fstat(parent_fd, &current) != 0) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2;
  }
  if (!setfarm_stat_representable_v2(&current)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2;
  }
  setfarm_fill_stat_v2(&current, &evidence);
  if (!setfarm_same_evidence_v2(expected, &evidence)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2;
  }
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

static setfarm_aggregate_census_error_v2
setfarm_enumerate_directory_v2(
  int directory_fd,
  bool count_as_nested,
  setfarm_capture_budget_v2 *budget,
  setfarm_aggregate_census_member_v2 **members_out,
  size_t *count_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  int enumeration_fd = -1;
  DIR *stream = NULL;
  setfarm_aggregate_census_member_v2 *members = NULL;
  size_t count = 0;
  size_t capacity = 0;
  setfarm_aggregate_census_error_v2 code =
    SETFARM_AGGREGATE_CENSUS_OK_V2;

  *members_out = NULL;
  *count_out = 0;
  enumeration_fd = openat(
    directory_fd,
    ".",
    O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (enumeration_fd < 0) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2,
      saved_errno);
    return SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2;
  }
  stream = fdopendir(enumeration_fd);
  if (stream == NULL) {
    int saved_errno = errno;
    (void)close(enumeration_fd);
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2,
      saved_errno);
    return SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2;
  }
  enumeration_fd = -1;

  for (;;) {
    struct dirent *entry;
    size_t name_length;
    struct stat status;
    setfarm_aggregate_census_object_kind_v2 kind;
    uint8_t *name_copy;

    errno = 0;
    entry = readdir(stream);
    if (entry == NULL) {
      if (errno != 0) {
        int saved_errno = errno;
        setfarm_fail_v2(
          failure, SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2,
          saved_errno);
        code = SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2;
      }
      break;
    }
    if (strcmp(entry->d_name, ".") == 0 ||
        strcmp(entry->d_name, "..") == 0) {
      continue;
    }
    name_length = strnlen(
      entry->d_name, SETFARM_AGGREGATE_CENSUS_MAX_BASENAME_BYTES_V2 + 1);
    if (name_length == 0 ||
        name_length > SETFARM_AGGREGATE_CENSUS_MAX_BASENAME_BYTES_V2 ||
        count >= SETFARM_AGGREGATE_CENSUS_MAX_ENTRIES_V2 ||
        (count_as_nested &&
         budget->total_directory_members >=
           SETFARM_AGGREGATE_CENSUS_MAX_TOTAL_DIRECTORY_MEMBERS_V2)) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2;
      break;
    }
    if (fstatat(
          dirfd(stream), entry->d_name, &status, AT_SYMLINK_NOFOLLOW) != 0) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2;
      break;
    }
    kind = setfarm_object_kind_v2(status.st_mode);
    if (kind == 0 || !setfarm_stat_representable_v2(&status)) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2;
      break;
    }
    if (count == capacity) {
      size_t next_capacity = capacity == 0 ? 16 : capacity * 2;
      setfarm_aggregate_census_member_v2 *grown;
      if (next_capacity > SETFARM_AGGREGATE_CENSUS_MAX_ENTRIES_V2) {
        next_capacity = SETFARM_AGGREGATE_CENSUS_MAX_ENTRIES_V2;
      }
      grown = (setfarm_aggregate_census_member_v2 *)realloc(
        members, next_capacity * sizeof(*members));
      if (grown == NULL) {
        setfarm_fail_v2(
          failure, SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2, ENOMEM);
        code = SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2;
        break;
      }
      memset(grown + capacity, 0,
        (next_capacity - capacity) * sizeof(*grown));
      members = grown;
      capacity = next_capacity;
    }
    name_copy = (uint8_t *)malloc(name_length + 1);
    if (name_copy == NULL) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2, ENOMEM);
      code = SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2;
      break;
    }
    memcpy(name_copy, entry->d_name, name_length);
    name_copy[name_length] = 0;
    members[count].basename = name_copy;
    members[count].basename_length = name_length;
    members[count].object_kind = kind;
    count += 1;
    if (count_as_nested) {
      budget->total_directory_members += 1;
    }
  }

  if (closedir(stream) != 0 && code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2,
      saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2;
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_members_dispose_v2(members, count);
    return code;
  }
  qsort(members, count, sizeof(*members), setfarm_member_compare_v2);
  for (size_t index = 1; index < count; index += 1) {
    if (setfarm_same_name_v2(
          members[index - 1].basename,
          members[index - 1].basename_length,
          members[index].basename,
          members[index].basename_length)) {
      setfarm_members_dispose_v2(members, count);
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, 0);
      return SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2;
    }
  }
  *members_out = members;
  *count_out = count;
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

static setfarm_aggregate_census_error_v2
setfarm_capture_regular_bytes_v2(
  int fd,
  const struct stat *status,
  setfarm_capture_budget_v2 *budget,
  uint8_t **bytes_out,
  size_t *length_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  uint8_t *bytes = NULL;
  size_t length;
  size_t offset = 0;
  uint8_t eof_probe = 0;

  *bytes_out = NULL;
  *length_out = 0;
  if (status->st_size < 0 ||
      (uint64_t)status->st_size >
        (uint64_t)SETFARM_AGGREGATE_CENSUS_MAX_FILE_BYTES_V2) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2;
  }
  length = (size_t)status->st_size;
  if (length >
      SETFARM_AGGREGATE_CENSUS_MAX_TOTAL_FILE_BYTES_V2 -
        budget->total_file_bytes) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2;
  }
  if (length > 0) {
    bytes = (uint8_t *)malloc(length);
    if (bytes == NULL) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2, ENOMEM);
      return SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2;
    }
  }
  while (offset < length) {
    ssize_t count = pread(fd, bytes + offset, length - offset, (off_t)offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      int saved_errno = count < 0 ? errno : 0;
      if (bytes != NULL) {
        setfarm_zero_bytes_v2(bytes, length);
        free(bytes);
      }
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2,
        saved_errno);
      return SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2;
    }
    offset += (size_t)count;
  }
  for (;;) {
    ssize_t count = pread(fd, &eof_probe, 1, (off_t)length);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count != 0) {
      int saved_errno = count < 0 ? errno : 0;
      if (bytes != NULL) {
        setfarm_zero_bytes_v2(bytes, length);
        free(bytes);
      }
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2,
        saved_errno);
      return SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2;
    }
    break;
  }
  eof_probe = 0;
  budget->total_file_bytes += length;
  *bytes_out = bytes;
  *length_out = length;
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

#if defined(__APPLE__)
static bool
setfarm_members_match_exact_v2(
  const setfarm_aggregate_census_member_v2 *members,
  size_t member_count,
  const char *const *names,
  const setfarm_aggregate_census_object_kind_v2 *kinds,
  size_t expected_count)
{
  size_t index;
  if (member_count != expected_count) {
    return false;
  }
  for (index = 0; index < expected_count; index += 1) {
    size_t name_length = strlen(names[index]);
    if (members[index].object_kind != kinds[index] ||
        !setfarm_same_name_v2(
          members[index].basename,
          members[index].basename_length,
          (const uint8_t *)names[index],
          name_length)) {
      return false;
    }
  }
  return true;
}

static setfarm_aggregate_census_error_v2
setfarm_capture_recursive_file_hash_v2(
  int fd,
  const struct stat *status,
  uint64_t maximum_bytes,
  setfarm_capture_budget_v2 *budget,
  uint8_t output[
    SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2],
  setfarm_aggregate_census_failure_v2 *failure)
{
  uint8_t scratch[64 * 1024];
  uint8_t eof_probe = 0;
  uint64_t length;
  uint64_t offset = 0;
  CC_SHA256_CTX digest;
  bool digest_initialized = false;
  setfarm_aggregate_census_error_v2 code =
    SETFARM_AGGREGATE_CENSUS_OK_V2;

  memset(scratch, 0, sizeof(scratch));
  memset(&digest, 0, sizeof(digest));
  memset(
    output,
    0,
    SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2);
  if (status->st_size <= 0 ||
      (uint64_t)status->st_size > maximum_bytes) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2;
    goto cleanup;
  }
  length = (uint64_t)status->st_size;
  if (length >
      SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_TOTAL_MAX_BYTES_V2 -
        budget->total_recursive_file_bytes) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2;
    goto cleanup;
  }
  if (CC_SHA256_Init(&digest) != 1) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2;
    goto cleanup;
  }
  digest_initialized = true;
  while (offset < length) {
    size_t requested = (size_t)(length - offset);
    ssize_t count;
    if (requested > sizeof(scratch)) {
      requested = sizeof(scratch);
    }
    count = pread(fd, scratch, requested, (off_t)offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0 ||
        CC_SHA256_Update(&digest, scratch, (CC_LONG)count) != 1) {
      int saved_errno = count < 0 ? errno : 0;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2,
        saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2;
      goto cleanup;
    }
    setfarm_zero_bytes_v2(scratch, (size_t)count);
    offset += (uint64_t)count;
  }
  for (;;) {
    ssize_t count = pread(fd, &eof_probe, 1, (off_t)length);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count != 0) {
      int saved_errno = count < 0 ? errno : 0;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2,
        saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2;
      goto cleanup;
    }
    break;
  }
  if (CC_SHA256_Final(output, &digest) != 1) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2;
    goto cleanup;
  }
  digest_initialized = false;
  budget->total_recursive_file_bytes += length;

cleanup:
  if (digest_initialized) {
    uint8_t discarded[
      SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2];
    memset(discarded, 0, sizeof(discarded));
    (void)CC_SHA256_Final(discarded, &digest);
    setfarm_zero_bytes_v2(discarded, sizeof(discarded));
  }
  setfarm_zero_bytes_v2(scratch, sizeof(scratch));
  setfarm_zero_bytes_v2(&digest, sizeof(digest));
  eof_probe = 0;
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_zero_bytes_v2(
      output,
      SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2);
  }
  return code;
}
#endif

static setfarm_aggregate_census_error_v2
setfarm_capture_entry_v2(
  int parent_fd,
  const setfarm_aggregate_census_member_v2 *listed,
  int borrowed_fd,
  setfarm_capture_budget_v2 *budget,
  setfarm_aggregate_census_entry_v2 *captured,
  setfarm_aggregate_census_failure_v2 *failure)
{
  const char *name = (const char *)listed->basename;
  struct stat path_before;
  struct stat descriptor_before;
  struct stat descriptor_after;
  struct stat path_after;
  int fd = -1;
  bool close_fd = false;
  int flags;
  setfarm_aggregate_census_error_v2 code =
    SETFARM_AGGREGATE_CENSUS_OK_V2;

  memset(captured, 0, sizeof(*captured));
  captured->basename = (uint8_t *)malloc(listed->basename_length + 1);
  if (captured->basename == NULL) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2, ENOMEM);
    return SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2;
  }
  memcpy(
    captured->basename, listed->basename, listed->basename_length + 1);
  captured->basename_length = listed->basename_length;

  if (fstatat(parent_fd, name, &path_before, AT_SYMLINK_NOFOLLOW) != 0) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  if (!setfarm_stat_representable_v2(&path_before) ||
      setfarm_object_kind_v2(path_before.st_mode) != listed->object_kind) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  flags = O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK;
  if (listed->object_kind == SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2) {
    flags |= O_DIRECTORY;
  }
  if (borrowed_fd >= 0) {
    if (listed->object_kind !=
        SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, 0);
      return SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
    }
    fd = borrowed_fd;
  } else {
    fd = openat(parent_fd, name, flags);
    if (fd < 0) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
      return SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
    }
    close_fd = true;
  }
  if (fstat(fd, &descriptor_before) != 0 ||
      !setfarm_same_status_v2(&path_before, &descriptor_before)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
    goto cleanup;
  }
  setfarm_fill_stat_v2(&descriptor_before, &captured->stat);

  if (listed->object_kind ==
      SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2) {
    code = setfarm_capture_regular_bytes_v2(
      fd, &descriptor_before, budget, &captured->file_bytes,
      &captured->file_length, failure);
  } else {
    code = setfarm_enumerate_directory_v2(
      fd, true, budget, &captured->members, &captured->member_count,
      failure);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (fstat(fd, &descriptor_after) != 0 ||
      fstatat(parent_fd, name, &path_after, AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_same_status_v2(&descriptor_before, &descriptor_after) ||
      !setfarm_same_status_v2(&descriptor_before, &path_after)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }

cleanup:
  if (close_fd && close(fd) != 0 &&
      code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  return code;
}

#if defined(__APPLE__)
static setfarm_aggregate_census_error_v2
setfarm_open_recursive_object_v2(
  int parent_fd,
  const char *name,
  setfarm_aggregate_census_object_kind_v2 expected_kind,
  uint32_t expected_mode,
  const setfarm_aggregate_census_stat_v2 *tree_root,
  setfarm_aggregate_census_recursive_role_v2 role,
  setfarm_aggregate_census_recursive_role_v2 parent_role,
  setfarm_aggregate_census_recursive_entry_v2 *entry,
  int *fd_out,
  struct stat *descriptor_before_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  struct stat path_before;
  struct stat descriptor_before;
  setfarm_aggregate_census_stat_v2 evidence;
  int flags = O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK;
  int fd;

  *fd_out = -1;
  memset(descriptor_before_out, 0, sizeof(*descriptor_before_out));
  memset(entry, 0, sizeof(*entry));
  if (expected_kind == SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2) {
    flags |= O_DIRECTORY;
  }
  if (fstatat(parent_fd, name, &path_before, AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_stat_representable_v2(&path_before) ||
      setfarm_object_kind_v2(path_before.st_mode) != expected_kind) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  fd = openat(parent_fd, name, flags);
  if (fd < 0 || fstat(fd, &descriptor_before) != 0 ||
      !setfarm_same_status_v2(&path_before, &descriptor_before)) {
    int saved_errno = errno;
    if (fd >= 0) {
      (void)close(fd);
    }
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  setfarm_fill_stat_v2(&descriptor_before, &evidence);
  if (evidence.stable.device != tree_root->stable.device ||
      evidence.mutable.owner_uid != tree_root->mutable.owner_uid ||
      evidence.mutable.owner_gid != tree_root->mutable.owner_gid ||
      evidence.mutable.mode != expected_mode ||
      (expected_kind == SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2 &&
       evidence.mutable.link_count != 1)) {
    (void)close(fd);
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2;
  }
  entry->role = role;
  entry->parent_role = parent_role;
  entry->stat = evidence;
  *fd_out = fd;
  *descriptor_before_out = descriptor_before;
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

static setfarm_aggregate_census_error_v2
setfarm_revalidate_close_recursive_object_v2(
  int parent_fd,
  const char *name,
  int fd,
  const struct stat *descriptor_before,
  setfarm_aggregate_census_failure_v2 *failure)
{
  struct stat descriptor_after;
  struct stat path_after;
  setfarm_aggregate_census_error_v2 code =
    SETFARM_AGGREGATE_CENSUS_OK_V2;
  if (fstat(fd, &descriptor_after) != 0 ||
      fstatat(parent_fd, name, &path_after, AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_same_status_v2(descriptor_before, &descriptor_after) ||
      !setfarm_same_status_v2(descriptor_before, &path_after)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  if (close(fd) != 0 && code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
  }
  return code;
}

static setfarm_aggregate_census_error_v2
setfarm_capture_recursive_file_v2(
  int parent_fd,
  const char *name,
  uint32_t mode,
  uint64_t maximum_bytes,
  const setfarm_aggregate_census_stat_v2 *tree_root,
  setfarm_aggregate_census_recursive_role_v2 role,
  setfarm_aggregate_census_recursive_role_v2 parent_role,
  setfarm_capture_budget_v2 *budget,
  setfarm_aggregate_census_recursive_entry_v2 *entry,
  setfarm_aggregate_census_failure_v2 *failure)
{
  struct stat descriptor_before;
  int fd = -1;
  setfarm_aggregate_census_error_v2 code;
  code = setfarm_open_recursive_object_v2(
    parent_fd,
    name,
    SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2,
    mode,
    tree_root,
    role,
    parent_role,
    entry,
    &fd,
    &descriptor_before,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  code = setfarm_capture_recursive_file_hash_v2(
    fd,
    &descriptor_before,
    maximum_bytes,
    budget,
    entry->content_sha256,
    failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    entry->has_content_sha256 = true;
    code = setfarm_revalidate_close_recursive_object_v2(
      parent_fd, name, fd, &descriptor_before, failure);
    fd = -1;
  }
  if (fd >= 0) {
    (void)close(fd);
  }
  return code;
}

static setfarm_aggregate_census_error_v2
setfarm_capture_recursive_leaf_directory_v2(
  int root_fd,
  const char *directory_name,
  const char *file_name,
  uint32_t file_mode,
  uint64_t file_maximum_bytes,
  const setfarm_aggregate_census_stat_v2 *tree_root,
  setfarm_aggregate_census_recursive_role_v2 directory_role,
  setfarm_aggregate_census_recursive_role_v2 file_role,
  setfarm_capture_budget_v2 *budget,
  setfarm_aggregate_census_recursive_entry_v2 *directory_entry,
  setfarm_aggregate_census_recursive_entry_v2 *file_entry,
  setfarm_aggregate_census_failure_v2 *failure)
{
  static const setfarm_aggregate_census_object_kind_v2 file_kind[] = {
    SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2
  };
  const char *names[1];
  struct stat descriptor_before;
  setfarm_aggregate_census_member_v2 *after_members = NULL;
  size_t after_count = 0;
  int directory_fd = -1;
  setfarm_aggregate_census_error_v2 code;

  names[0] = file_name;
  code = setfarm_open_recursive_object_v2(
    root_fd,
    directory_name,
    SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2,
    0555,
    tree_root,
    directory_role,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_DIRECTORY_V2,
    directory_entry,
    &directory_fd,
    &descriptor_before,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  code = setfarm_enumerate_directory_v2(
    directory_fd,
    true,
    budget,
    &directory_entry->members,
    &directory_entry->member_count,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_members_match_exact_v2(
        directory_entry->members,
        directory_entry->member_count,
        names,
        file_kind,
        1)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2;
    }
    goto cleanup;
  }
  code = setfarm_capture_recursive_file_v2(
    directory_fd,
    file_name,
    file_mode,
    file_maximum_bytes,
    tree_root,
    file_role,
    directory_role,
    budget,
    file_entry,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_enumerate_directory_v2(
    directory_fd,
    true,
    budget,
    &after_members,
    &after_count,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_members_equal_v2(
        directory_entry->members,
        directory_entry->member_count,
        after_members,
        after_count)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
    }
    goto cleanup;
  }
  code = setfarm_revalidate_close_recursive_object_v2(
    root_fd,
    directory_name,
    directory_fd,
    &descriptor_before,
    failure);
  directory_fd = -1;

cleanup:
  setfarm_members_dispose_v2(after_members, after_count);
  if (directory_fd >= 0) {
    (void)close(directory_fd);
  }
  return code;
}

static bool
setfarm_recursive_identities_are_unique_v2(
  const setfarm_aggregate_census_recursive_evidence_v2 *recursive,
  const setfarm_capture_pass_v2 *pass)
{
  size_t left;
  size_t right;
  for (left = 0; left < recursive->entry_count; left += 1) {
    for (right = left + 1; right < recursive->entry_count; right += 1) {
      if (recursive->entries[left].stat.stable.device ==
            recursive->entries[right].stat.stable.device &&
          recursive->entries[left].stat.stable.inode ==
            recursive->entries[right].stat.stable.inode) {
        return false;
      }
    }
  }
  for (left = 1; left < recursive->entry_count; left += 1) {
    for (right = 0; right < pass->entry_count; right += 1) {
      if (recursive->entries[left].stat.stable.device ==
            pass->entries[right].stat.stable.device &&
          recursive->entries[left].stat.stable.inode ==
            pass->entries[right].stat.stable.inode) {
        return false;
      }
    }
  }
  return true;
}

static setfarm_aggregate_census_error_v2
setfarm_capture_node_recursive_evidence_v2(
  int parent_fd,
  setfarm_capture_budget_v2 *budget,
  setfarm_capture_pass_v2 *pass,
  setfarm_aggregate_census_failure_v2 *failure)
{
  static const char *const root_names[] = {
    "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json",
    "bin",
    "lib",
    "runtime"
  };
  static const setfarm_aggregate_census_object_kind_v2 root_kinds[] = {
    SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2,
    SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2,
    SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2,
    SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2
  };
  setfarm_aggregate_census_entry_v2 *global_root = NULL;
  setfarm_aggregate_census_recursive_evidence_v2 *recursive =
    &pass->node_recursive_evidence;
  setfarm_aggregate_census_recursive_entry_v2 *entries =
    recursive->entries;
  setfarm_aggregate_census_member_v2 *root_after_members = NULL;
  size_t root_after_count = 0;
  struct stat root_before;
  int root_fd = -1;
  size_t index;
  setfarm_aggregate_census_error_v2 code;

  memset(recursive, 0, sizeof(*recursive));
  for (index = 0; index < pass->entry_count; index += 1) {
    if (setfarm_same_name_v2(
          pass->entries[index].basename,
          pass->entries[index].basename_length,
          (const uint8_t *)SETFARM_AGGREGATE_CENSUS_NODE_ROOT_NAME_V2,
          strlen(SETFARM_AGGREGATE_CENSUS_NODE_ROOT_NAME_V2))) {
      global_root = &pass->entries[index];
      break;
    }
  }
  if (global_root == NULL) {
    recursive->status = SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_ABSENT_V2;
    return SETFARM_AGGREGATE_CENSUS_OK_V2;
  }
  if (global_root->stat.stable.object_kind !=
        SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2 ||
      global_root->stat.stable.device != pass->parent_stat.stable.device ||
      global_root->stat.mutable.owner_uid !=
        pass->parent_stat.mutable.owner_uid ||
      global_root->stat.mutable.owner_gid !=
        pass->parent_stat.mutable.owner_gid ||
      global_root->stat.mutable.mode != 0555 ||
      !setfarm_members_match_exact_v2(
        global_root->members,
        global_root->member_count,
        root_names,
        root_kinds,
        4)) {
    recursive->status =
      SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAYOUT_NOT_EXACT_V2;
    return SETFARM_AGGREGATE_CENSUS_OK_V2;
  }
  code = setfarm_open_recursive_object_v2(
    parent_fd,
    SETFARM_AGGREGATE_CENSUS_NODE_ROOT_NAME_V2,
    SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2,
    0555,
    &global_root->stat,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_DIRECTORY_V2,
    (setfarm_aggregate_census_recursive_role_v2)0,
    &entries[0],
    &root_fd,
    &root_before,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_same_evidence_v2(&entries[0].stat, &global_root->stat)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
    }
    goto cleanup;
  }
  code = setfarm_enumerate_directory_v2(
    root_fd,
    true,
    budget,
    &entries[0].members,
    &entries[0].member_count,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_members_equal_v2(
        entries[0].members,
        entries[0].member_count,
        global_root->members,
        global_root->member_count)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
    }
    goto cleanup;
  }
  code = setfarm_capture_recursive_leaf_directory_v2(
    root_fd,
    "bin",
    setfarm_node_launcher_name_v2,
    0555,
    SETFARM_AGGREGATE_CENSUS_NODE_LAUNCHER_MAX_BYTES_V2,
    &entries[0].stat,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_BIN_DIRECTORY_V2,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAUNCHER_FILE_V2,
    budget,
    &entries[1],
    &entries[2],
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) goto cleanup;
  code = setfarm_capture_recursive_leaf_directory_v2(
    root_fd,
    "lib",
    setfarm_node_bundle_name_v2,
    0444,
    SETFARM_AGGREGATE_CENSUS_NODE_BUNDLE_MAX_BYTES_V2,
    &entries[0].stat,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_LIB_DIRECTORY_V2,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_BUNDLE_FILE_V2,
    budget,
    &entries[3],
    &entries[4],
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) goto cleanup;
  code = setfarm_capture_recursive_file_v2(
    root_fd,
    setfarm_node_manifest_name_v2,
    0444,
    SETFARM_AGGREGATE_CENSUS_NODE_MANIFEST_MAX_BYTES_V2,
    &entries[0].stat,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_MANIFEST_FILE_V2,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_DIRECTORY_V2,
    budget,
    &entries[5],
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) goto cleanup;
  code = setfarm_capture_recursive_leaf_directory_v2(
    root_fd,
    "runtime",
    setfarm_node_runtime_name_v2,
    0555,
    SETFARM_AGGREGATE_CENSUS_NODE_RUNTIME_MAX_BYTES_V2,
    &entries[0].stat,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_RUNTIME_DIRECTORY_V2,
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_BOOTSTRAP_RUNTIME_FILE_V2,
    budget,
    &entries[6],
    &entries[7],
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) goto cleanup;
  code = setfarm_enumerate_directory_v2(
    root_fd,
    true,
    budget,
    &root_after_members,
    &root_after_count,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_members_equal_v2(
        entries[0].members,
        entries[0].member_count,
        root_after_members,
        root_after_count)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
    }
    goto cleanup;
  }
  code = setfarm_revalidate_close_recursive_object_v2(
    parent_fd,
    SETFARM_AGGREGATE_CENSUS_NODE_ROOT_NAME_V2,
    root_fd,
    &root_before,
    failure);
  root_fd = -1;
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) goto cleanup;
  recursive->entry_count =
    SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_ENTRY_COUNT_V2;
  if (!setfarm_recursive_identities_are_unique_v2(recursive, pass)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2;
    goto cleanup;
  }
  recursive->status = SETFARM_AGGREGATE_CENSUS_RECURSIVE_COMPLETE_V2;

cleanup:
  setfarm_members_dispose_v2(root_after_members, root_after_count);
  if (root_fd >= 0) {
    (void)close(root_fd);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_recursive_evidence_dispose_v2(recursive);
  }
  return code;
}
#endif

static setfarm_aggregate_census_error_v2
setfarm_execute_capture_pass_v2(
  int parent_fd,
  const setfarm_aggregate_census_stat_v2 *expected_parent,
  const setfarm_held_lock_v2 *shared_lock,
  const setfarm_held_lock_v2 *node_lock,
  bool capture_recursive,
  setfarm_capture_pass_v2 *pass,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_capture_budget_v2 budget;
  setfarm_aggregate_census_member_v2 *listed = NULL;
  size_t listed_count = 0;
  size_t index;
  setfarm_aggregate_census_error_v2 code;

  memset(pass, 0, sizeof(*pass));
  memset(&budget, 0, sizeof(budget));
  code = setfarm_parent_fence_v2(parent_fd, expected_parent, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  code = setfarm_enumerate_directory_v2(
    parent_fd, false, &budget, &listed, &listed_count, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  if (listed_count > 0) {
    pass->entries = (setfarm_aggregate_census_entry_v2 *)calloc(
      listed_count, sizeof(*pass->entries));
    if (pass->entries == NULL) {
      setfarm_members_dispose_v2(listed, listed_count);
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2, ENOMEM);
      return SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2;
    }
  }
  pass->entry_count = listed_count;
  pass->parent_stat = *expected_parent;
  for (index = 0; index < listed_count; index += 1) {
    int borrowed_fd = -1;
    if (setfarm_same_name_v2(
          listed[index].basename, listed[index].basename_length,
          (const uint8_t *)shared_lock->name, strlen(shared_lock->name))) {
      borrowed_fd = shared_lock->fd;
    } else if (setfarm_same_name_v2(
          listed[index].basename, listed[index].basename_length,
          (const uint8_t *)node_lock->name, strlen(node_lock->name))) {
      borrowed_fd = node_lock->fd;
    }
    code = setfarm_capture_entry_v2(
      parent_fd, &listed[index], borrowed_fd, &budget,
      &pass->entries[index], failure);
    if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_members_dispose_v2(listed, listed_count);
      setfarm_pass_dispose_v2(pass);
      return code;
    }
  }
  setfarm_members_dispose_v2(listed, listed_count);
  if (capture_recursive) {
#if !defined(__APPLE__)
    setfarm_pass_dispose_v2(pass);
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2, ENOTSUP);
    return SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2;
#else
    code = setfarm_capture_node_recursive_evidence_v2(
      parent_fd, &budget, pass, failure);
    if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_pass_dispose_v2(pass);
      return code;
    }
#endif
  }
  return setfarm_parent_fence_v2(parent_fd, expected_parent, failure);
}

static bool
setfarm_members_equal_v2(
  const setfarm_aggregate_census_member_v2 *left,
  size_t left_count,
  const setfarm_aggregate_census_member_v2 *right,
  size_t right_count)
{
  size_t index;
  if (left_count != right_count) {
    return false;
  }
  for (index = 0; index < left_count; index += 1) {
    if (left[index].object_kind != right[index].object_kind ||
        !setfarm_same_name_v2(
          left[index].basename, left[index].basename_length,
          right[index].basename, right[index].basename_length)) {
      return false;
    }
  }
  return true;
}

static bool
setfarm_entries_equal_v2(
  const setfarm_aggregate_census_entry_v2 *left,
  const setfarm_aggregate_census_entry_v2 *right)
{
  if (!setfarm_same_name_v2(
        left->basename, left->basename_length,
        right->basename, right->basename_length) ||
      !setfarm_same_evidence_v2(&left->stat, &right->stat)) {
    return false;
  }
  if (left->stat.stable.object_kind ==
      SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2) {
    return left->file_length == right->file_length &&
      (left->file_length == 0 ||
       memcmp(left->file_bytes, right->file_bytes, left->file_length) == 0) &&
      left->member_count == 0 && right->member_count == 0;
  }
  return left->file_length == 0 && right->file_length == 0 &&
    setfarm_members_equal_v2(
      left->members, left->member_count,
      right->members, right->member_count);
}

static bool
setfarm_recursive_entries_equal_v2(
  const setfarm_aggregate_census_recursive_entry_v2 *left,
  const setfarm_aggregate_census_recursive_entry_v2 *right)
{
  return left->role == right->role &&
    left->parent_role == right->parent_role &&
    setfarm_same_evidence_v2(&left->stat, &right->stat) &&
    left->has_content_sha256 == right->has_content_sha256 &&
    (!left->has_content_sha256 ||
     memcmp(
       left->content_sha256,
       right->content_sha256,
       SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2) == 0) &&
    setfarm_members_equal_v2(
      left->members,
      left->member_count,
      right->members,
      right->member_count);
}

static bool
setfarm_recursive_evidence_equal_v2(
  const setfarm_aggregate_census_recursive_evidence_v2 *left,
  const setfarm_aggregate_census_recursive_evidence_v2 *right)
{
  size_t index;
  if (left->status != right->status ||
      left->entry_count != right->entry_count) {
    return false;
  }
  for (index = 0; index < left->entry_count; index += 1) {
    if (!setfarm_recursive_entries_equal_v2(
          &left->entries[index], &right->entries[index])) {
      return false;
    }
  }
  return true;
}

static bool
setfarm_passes_equal_v2(
  const setfarm_capture_pass_v2 *left,
  const setfarm_capture_pass_v2 *right)
{
  size_t index;
  if (!setfarm_same_evidence_v2(&left->parent_stat, &right->parent_stat) ||
      left->entry_count != right->entry_count ||
      !setfarm_recursive_evidence_equal_v2(
        &left->node_recursive_evidence,
        &right->node_recursive_evidence)) {
    return false;
  }
  for (index = 0; index < left->entry_count; index += 1) {
    if (!setfarm_entries_equal_v2(&left->entries[index], &right->entries[index])) {
      return false;
    }
  }
  return true;
}

static setfarm_aggregate_census_error_v2
setfarm_read_exact_lock_fd_v2(
  int fd,
  const uint8_t *expected,
  size_t expected_length,
  setfarm_aggregate_census_failure_v2 *failure)
{
  uint8_t buffer[128];
  uint8_t eof_probe = 0;
  size_t offset = 0;
  if (expected_length > sizeof(buffer)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2;
  }
  memset(buffer, 0, sizeof(buffer));
  while (offset < expected_length) {
    ssize_t count = pread(
      fd, buffer + offset, expected_length - offset, (off_t)offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      int saved_errno = count < 0 ? errno : 0;
      setfarm_zero_bytes_v2(buffer, sizeof(buffer));
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, saved_errno);
      return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
    }
    offset += (size_t)count;
  }
  for (;;) {
    ssize_t count = pread(fd, &eof_probe, 1, (off_t)expected_length);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count != 0 || memcmp(buffer, expected, expected_length) != 0) {
      int saved_errno = count < 0 ? errno : 0;
      setfarm_zero_bytes_v2(buffer, sizeof(buffer));
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, saved_errno);
      return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
    }
    break;
  }
  eof_probe = 0;
  setfarm_zero_bytes_v2(buffer, sizeof(buffer));
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

static bool
setfarm_lock_metadata_valid_v2(
  const struct stat *status,
  const struct stat *parent,
  size_t expected_length)
{
  return setfarm_stat_representable_v2(status) &&
    S_ISREG(status->st_mode) &&
    (status->st_mode & (mode_t)07777) == (mode_t)0600 &&
    status->st_uid == parent->st_uid && status->st_gid == parent->st_gid &&
    status->st_nlink == (nlink_t)1 &&
    status->st_size == (off_t)expected_length &&
    status->st_dev == parent->st_dev;
}

static setfarm_aggregate_census_error_v2
setfarm_lock_revalidate_v2(
  int parent_fd,
  const struct stat *parent,
  setfarm_held_lock_v2 *lock,
  setfarm_aggregate_census_failure_v2 *failure)
{
  struct stat descriptor_status;
  struct stat path_status;
  setfarm_aggregate_census_error_v2 code;
  if (fstat(lock->fd, &descriptor_status) != 0 ||
      fstatat(parent_fd, lock->name, &path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
  }
  if (!setfarm_lock_metadata_valid_v2(
        &descriptor_status, parent, lock->content_length) ||
      !setfarm_same_status_v2(&lock->status, &descriptor_status) ||
      !setfarm_same_status_v2(&lock->status, &path_status)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
  }
  code = setfarm_read_exact_lock_fd_v2(
    lock->fd, lock->content, lock->content_length, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

#if defined(__APPLE__)
static setfarm_aggregate_census_error_v2
setfarm_lock_acquire_command_v2(
  int parent_fd,
  const struct stat *parent,
  setfarm_held_lock_v2 *lock,
  int command,
  setfarm_aggregate_census_failure_v2 *failure)
{
  struct stat path_before;
  struct stat descriptor_before;
  setfarm_aggregate_census_error_v2 code;

  if (fstatat(parent_fd, lock->name, &path_before, AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_lock_metadata_valid_v2(
        &path_before, parent, lock->content_length)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
  }
  lock->fd = openat(
    parent_fd,
    lock->name,
    O_RDWR | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (lock->fd < 0) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
  }
  if (fstat(lock->fd, &descriptor_before) != 0 ||
      !setfarm_same_status_v2(&path_before, &descriptor_before)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
  }
  lock->status = descriptor_before;
  setfarm_fill_stat_v2(&descriptor_before, &lock->evidence);
  code = setfarm_read_exact_lock_fd_v2(
    lock->fd, lock->content, lock->content_length, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  if (lseek(lock->fd, (off_t)0, SEEK_SET) < 0) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2, saved_errno);
    return SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2;
  }
  for (;;) {
    if (lockf(lock->fd, command, (off_t)0) == 0) {
      lock->locked = true;
      break;
    }
    if (errno != EINTR) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2, saved_errno);
      return SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2;
    }
  }
  return setfarm_lock_revalidate_v2(
    parent_fd, parent, lock, failure);
}
#endif

static bool
setfarm_lock_release_v2(
  setfarm_held_lock_v2 *lock,
  int *system_errno_out)
{
  bool ok = true;
  int saved_errno = 0;
  if (lock->fd < 0) {
    return true;
  }
  if (lock->locked) {
    if (lseek(lock->fd, (off_t)0, SEEK_SET) < 0) {
      ok = false;
      saved_errno = errno;
    } else if (lockf(lock->fd, F_ULOCK, (off_t)0) != 0) {
      ok = false;
      saved_errno = errno;
    }
    lock->locked = false;
  }
  if (close(lock->fd) != 0) {
    ok = false;
    if (saved_errno == 0) {
      saved_errno = errno;
    }
  }
  lock->fd = -1;
  setfarm_zero_bytes_v2(&lock->status, sizeof(lock->status));
  if (system_errno_out != NULL && *system_errno_out == 0 &&
      saved_errno != 0) {
    *system_errno_out = saved_errno;
  }
  return ok;
}

#if defined(__APPLE__)
static bool
setfarm_lock_unlock_keep_open_v2(
  setfarm_held_lock_v2 *lock,
  int *system_errno_out)
{
  if (lock->fd < 0 || !lock->locked) {
    return false;
  }
  if (lseek(lock->fd, (off_t)0, SEEK_SET) < 0) {
    if (system_errno_out != NULL) {
      *system_errno_out = errno;
    }
    return false;
  }
  if (lockf(lock->fd, F_ULOCK, (off_t)0) != 0) {
    if (system_errno_out != NULL) {
      *system_errno_out = errno;
    }
    return false;
  }
  lock->locked = false;
  return true;
}
#endif

static bool
setfarm_pass_contains_lock_v2(
  const setfarm_capture_pass_v2 *pass,
  const setfarm_held_lock_v2 *lock)
{
  size_t index;
  size_t name_length = strlen(lock->name);
  for (index = 0; index < pass->entry_count; index += 1) {
    const setfarm_aggregate_census_entry_v2 *entry = &pass->entries[index];
    if (setfarm_same_name_v2(
          entry->basename, entry->basename_length,
          (const uint8_t *)lock->name, name_length)) {
      return entry->stat.stable.object_kind ==
          SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2 &&
        setfarm_same_evidence_v2(&entry->stat, &lock->evidence) &&
        entry->file_length == lock->content_length &&
        memcmp(entry->file_bytes, lock->content, lock->content_length) == 0;
    }
  }
  return false;
}

#if defined(__APPLE__)
static void
setfarm_session_initialize_v2(
  setfarm_aggregate_census_session_v2 *session)
{
  memset(session, 0, sizeof(*session));
  session->parent_fd = -1;
  session->shared_lock.name =
    SETFARM_AGGREGATE_CENSUS_SHARED_LOCK_NAME_V2;
  session->shared_lock.content = setfarm_shared_lock_content_v2;
  session->shared_lock.content_length =
    sizeof(setfarm_shared_lock_content_v2) - 1;
  session->shared_lock.fd = -1;
  session->node_lock.name = SETFARM_AGGREGATE_CENSUS_NODE_LOCK_NAME_V2;
  session->node_lock.content = setfarm_node_lock_content_v2;
  session->node_lock.content_length =
    sizeof(setfarm_node_lock_content_v2) - 1;
  session->node_lock.fd = -1;
  session->exact_entry_fd = -1;
}
#endif

static bool
setfarm_session_release_and_dispose_v2(
  setfarm_aggregate_census_session_v2 *session,
  int *system_errno_out)
{
  bool release_ok = true;
  int saved_errno = 0;
  if (session == NULL) {
    if (system_errno_out != NULL) {
      *system_errno_out = 0;
    }
    return true;
  }
  if (session->exact_entry_fd >= 0 && close(session->exact_entry_fd) != 0) {
    release_ok = false;
    saved_errno = errno;
  }
  session->exact_entry_fd = -1;
  release_ok = setfarm_lock_release_v2(
    &session->node_lock, &saved_errno);
  release_ok = setfarm_lock_release_v2(
    &session->shared_lock, &saved_errno) && release_ok;
  if (session->parent_fd >= 0 && close(session->parent_fd) != 0) {
    release_ok = false;
    if (saved_errno == 0) {
      saved_errno = errno;
    }
  }
  session->parent_fd = -1;
  setfarm_pass_dispose_v2(&session->private_baseline);
  setfarm_aggregate_census_result_dispose_v2(&session->observation);
  setfarm_zero_bytes_v2(session, sizeof(*session));
  free(session);
  if (system_errno_out != NULL) {
    *system_errno_out = saved_errno;
  }
  return release_ok;
}

static setfarm_aggregate_census_error_v2
setfarm_session_destroy_with_code_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_error_v2 code,
  setfarm_aggregate_census_failure_v2 *failure)
{
  int release_errno = 0;
  bool release_ok = true;
  if (session_io != NULL && *session_io != NULL) {
    release_ok = setfarm_session_release_and_dispose_v2(
      *session_io, &release_errno);
    *session_io = NULL;
  }
  if (!release_ok) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2,
      release_errno);
    return SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2;
  }
  return code;
}

static setfarm_aggregate_census_error_v2
setfarm_session_revalidate_v2(
  setfarm_aggregate_census_session_v2 *session,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_aggregate_census_error_v2 code = setfarm_parent_fence_v2(
    session->parent_fd, &session->parent_evidence, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      session->parent_fd,
      &session->parent_status,
      &session->shared_lock,
      failure);
  }
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      session->parent_fd,
      &session->parent_status,
      &session->node_lock,
      failure);
  }
  return code;
}

static setfarm_aggregate_census_error_v2
setfarm_session_capture_pair_v2(
  setfarm_aggregate_census_session_v2 *session,
  bool baseline_capture,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_capture_pass_v2 *first,
  setfarm_capture_pass_v2 *second,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_aggregate_census_error_v2 code;
  code = setfarm_session_revalidate_v2(session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  code = setfarm_execute_capture_pass_v2(
    session->parent_fd,
    &session->parent_evidence,
    &session->shared_lock,
    &session->node_lock,
    session->capture_recursive,
    first,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_pass_contains_lock_v2(first, &session->shared_lock) ||
      !setfarm_pass_contains_lock_v2(first, &session->node_lock)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
    }
    return code;
  }
  code = setfarm_session_revalidate_v2(session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  if (baseline_capture && checkpoint_hook != NULL) {
    checkpoint_hook(
      SETFARM_AGGREGATE_CENSUS_CHECKPOINT_AFTER_FIRST_PASS_V2,
      checkpoint_context);
  }
  code = setfarm_execute_capture_pass_v2(
    session->parent_fd,
    &session->parent_evidence,
    &session->shared_lock,
    &session->node_lock,
    session->capture_recursive,
    second,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_pass_contains_lock_v2(second, &session->shared_lock) ||
      !setfarm_pass_contains_lock_v2(second, &session->node_lock)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, 0);
      code = SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
    }
    return code;
  }
  code = setfarm_session_revalidate_v2(session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  if (!setfarm_passes_equal_v2(first, second)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2, 0);
    return SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
  }
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

static setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_open_internal_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  bool capture_recursive,
  setfarm_aggregate_census_session_v2 **session_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (session_out == NULL) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2;
  }
  if (*session_out != NULL || inherited_parent_fd < 0 || failure == NULL) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2;
  }

#if !defined(__APPLE__)
  (void)checkpoint_hook;
  (void)checkpoint_context;
  (void)capture_recursive;
  setfarm_fail_v2(
    failure, SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2, ENOTSUP);
  return SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2;
#else
  setfarm_aggregate_census_session_v2 *session = NULL;
  setfarm_capture_pass_v2 first;
  setfarm_capture_pass_v2 second;
  setfarm_aggregate_census_error_v2 code;

  memset(&first, 0, sizeof(first));
  memset(&second, 0, sizeof(second));
  session = (setfarm_aggregate_census_session_v2 *)malloc(
    sizeof(*session));
  if (session == NULL) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2, ENOMEM);
    return SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2;
  }
  setfarm_session_initialize_v2(session);
  session->capture_recursive = capture_recursive;
  session->parent_fd = fcntl(
    inherited_parent_fd, F_DUPFD_CLOEXEC, 0);
  if (session->parent_fd < 0 ||
      fstat(session->parent_fd, &session->parent_status) != 0 ||
      !setfarm_stat_representable_v2(&session->parent_status) ||
      !S_ISDIR(session->parent_status.st_mode) ||
      ((session->parent_status.st_mode & (mode_t)07777) != (mode_t)0700 &&
       (session->parent_status.st_mode & (mode_t)07777) != (mode_t)0755)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_PARENT_INVALID_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_PARENT_INVALID_V2;
    goto cleanup;
  }
  setfarm_fill_stat_v2(
    &session->parent_status, &session->parent_evidence);
  code = setfarm_lock_acquire_command_v2(
    session->parent_fd,
    &session->parent_status,
    &session->shared_lock,
    F_LOCK,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_parent_fence_v2(
    session->parent_fd, &session->parent_evidence, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_lock_acquire_command_v2(
    session->parent_fd,
    &session->parent_status,
    &session->node_lock,
    F_LOCK,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_lock_revalidate_v2(
    session->parent_fd,
    &session->parent_status,
    &session->shared_lock,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_session_capture_pair_v2(
    session,
    true,
    checkpoint_hook,
    checkpoint_context,
    &first,
    &second,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  session->observation.parent_stat = first.parent_stat;
  session->observation.entries = first.entries;
  session->observation.entry_count = first.entry_count;
  session->observation.shared_lock_stat = session->shared_lock.evidence;
  session->observation.node_lock_stat = session->node_lock.evidence;
  session->observation.node_recursive_evidence =
    first.node_recursive_evidence;
  first.entries = NULL;
  first.entry_count = 0;
  memset(&first.node_recursive_evidence, 0,
    sizeof(first.node_recursive_evidence));
  session->private_baseline = second;
  memset(&second, 0, sizeof(second));
  session->state = SETFARM_AGGREGATE_CENSUS_SESSION_BASELINE_READY_V2;
  if (checkpoint_hook != NULL) {
    checkpoint_hook(
      SETFARM_AGGREGATE_CENSUS_CHECKPOINT_BASELINE_READY_V2,
      checkpoint_context);
  }
  *session_out = session;
  setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  return SETFARM_AGGREGATE_CENSUS_OK_V2;

cleanup:
  setfarm_pass_dispose_v2(&second);
  setfarm_pass_dispose_v2(&first);
  return setfarm_session_destroy_with_code_v2(&session, code, failure);
#endif
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_open_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_session_v2 **session_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  return setfarm_aggregate_census_session_open_internal_v2(
    inherited_parent_fd,
    checkpoint_hook,
    checkpoint_context,
    false,
    session_out,
    failure);
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_composite_session_open_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_session_v2 **session_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  return setfarm_aggregate_census_session_open_internal_v2(
    inherited_parent_fd,
    checkpoint_hook,
    checkpoint_context,
    true,
    session_out,
    failure);
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_observation_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  const setfarm_aggregate_census_result_v2 **observation_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_aggregate_census_session_v2 *session =
    session_io == NULL ? NULL : *session_io;
  if (observation_out != NULL) {
    *observation_out = NULL;
  }
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (session_io == NULL || session == NULL || observation_out == NULL ||
      failure == NULL ||
      (session->state != SETFARM_AGGREGATE_CENSUS_SESSION_BASELINE_READY_V2 &&
       session->state !=
         SETFARM_AGGREGATE_CENSUS_SESSION_RECAPTURE_EQUAL_V2)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return setfarm_session_destroy_with_code_v2(
      session_io,
      SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2,
      failure);
  }
  *observation_out = &session->observation;
  setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_capture_exact_entry_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  size_t entry_index,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_exact_entry_capture_v2 *capture_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_aggregate_census_session_v2 *session =
    session_io == NULL ? NULL : *session_io;
  setfarm_aggregate_census_exact_entry_capture_v2 capture;
  setfarm_aggregate_census_member_v2 listed;
  setfarm_capture_budget_v2 first_budget;
  setfarm_capture_budget_v2 second_budget;
  const setfarm_aggregate_census_entry_v2 *issued_entry;
  const setfarm_aggregate_census_entry_v2 *baseline_entry;
  setfarm_aggregate_census_error_v2 code;
  int fd = -1;
  int saved_errno = 0;

  memset(&capture, 0, sizeof(capture));
  memset(&listed, 0, sizeof(listed));
  memset(&first_budget, 0, sizeof(first_budget));
  memset(&second_budget, 0, sizeof(second_budget));
  if (capture_out != NULL) {
    memset(capture_out, 0, sizeof(*capture_out));
  }
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (session_io == NULL || session == NULL || capture_out == NULL ||
      failure == NULL ||
      session->state != SETFARM_AGGREGATE_CENSUS_SESSION_BASELINE_READY_V2 ||
      session->exact_entry_capture_consumed ||
      entry_index >= session->observation.entry_count ||
      entry_index >= session->private_baseline.entry_count) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return setfarm_session_destroy_with_code_v2(
      session_io, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, failure);
  }
#if !defined(__APPLE__)
  (void)checkpoint_hook;
  (void)checkpoint_context;
  (void)entry_index;
  setfarm_fail_v2(
    failure, SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2, ENOTSUP);
  return setfarm_session_destroy_with_code_v2(
    session_io, SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2, failure);
#else
  issued_entry = &session->observation.entries[entry_index];
  baseline_entry = &session->private_baseline.entries[entry_index];
  if (issued_entry->stat.stable.object_kind !=
        SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2 ||
      !setfarm_entries_equal_v2(issued_entry, baseline_entry) ||
      issued_entry->basename == NULL ||
      issued_entry->basename_length == 0 ||
      issued_entry->basename_length >
        SETFARM_AGGREGATE_CENSUS_MAX_BASENAME_BYTES_V2) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, 0);
    return setfarm_session_destroy_with_code_v2(
      session_io, SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2, failure);
  }
  code = setfarm_session_revalidate_v2(session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return setfarm_session_destroy_with_code_v2(session_io, code, failure);
  }
  fd = openat(
    session->parent_fd,
    (const char *)issued_entry->basename,
    O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (fd < 0) {
    saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, saved_errno);
    return setfarm_session_destroy_with_code_v2(
      session_io, SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2, failure);
  }
  listed.basename = issued_entry->basename;
  listed.basename_length = issued_entry->basename_length;
  listed.object_kind = issued_entry->stat.stable.object_kind;
  code = setfarm_capture_entry_v2(
    session->parent_fd,
    &listed,
    fd,
    &first_budget,
    &capture.first_observation,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_entries_equal_v2(
        issued_entry, &capture.first_observation)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
      setfarm_fail_v2(failure, code, 0);
    }
    goto cleanup;
  }
  if (checkpoint_hook != NULL) {
    checkpoint_hook(
      SETFARM_AGGREGATE_CENSUS_CHECKPOINT_EXACT_ENTRY_FIRST_OBSERVATION_READY_V2,
      checkpoint_context);
  }
  code = setfarm_session_revalidate_v2(session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_capture_entry_v2(
    session->parent_fd,
    &listed,
    fd,
    &second_budget,
    &capture.second_observation,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 ||
      !setfarm_entries_equal_v2(
        &capture.first_observation, &capture.second_observation) ||
      !setfarm_entries_equal_v2(
        issued_entry, &capture.second_observation)) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
      setfarm_fail_v2(failure, code, 0);
    }
    goto cleanup;
  }
  code = setfarm_session_revalidate_v2(session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  session->exact_entry_fd = fd;
  fd = -1;
  capture.entry_index = entry_index;
  session->exact_entry_capture_consumed = true;
  *capture_out = capture;
  memset(&capture, 0, sizeof(capture));
  setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  return SETFARM_AGGREGATE_CENSUS_OK_V2;

cleanup:
  if (fd >= 0 && close(fd) != 0 &&
      code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    saved_errno = errno;
    code = SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2;
    setfarm_fail_v2(failure, code, saved_errno);
  }
  setfarm_aggregate_census_exact_entry_capture_dispose_v2(&capture);
  return setfarm_session_destroy_with_code_v2(session_io, code, failure);
#endif
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_recapture_equal_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  bool *equal_out,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_capture_pass_v2 first;
  setfarm_capture_pass_v2 second;
  setfarm_aggregate_census_error_v2 code;
  setfarm_aggregate_census_session_v2 *session =
    session_io == NULL ? NULL : *session_io;

  memset(&first, 0, sizeof(first));
  memset(&second, 0, sizeof(second));
  if (equal_out != NULL) {
    *equal_out = false;
  }
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (session_io == NULL || session == NULL || equal_out == NULL ||
      failure == NULL ||
      session->state != SETFARM_AGGREGATE_CENSUS_SESSION_BASELINE_READY_V2) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return setfarm_session_destroy_with_code_v2(
      session_io,
      SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2,
      failure);
  }
  code = setfarm_session_capture_pair_v2(
    session,
    false,
    checkpoint_hook,
    checkpoint_context,
    &first,
    &second,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (!setfarm_passes_equal_v2(&session->private_baseline, &first)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
    goto cleanup;
  }
  setfarm_pass_dispose_v2(&second);
  setfarm_pass_dispose_v2(&first);
  session->state = SETFARM_AGGREGATE_CENSUS_SESSION_RECAPTURE_EQUAL_V2;
  *equal_out = true;
  if (checkpoint_hook != NULL) {
    checkpoint_hook(
      SETFARM_AGGREGATE_CENSUS_CHECKPOINT_RECAPTURE_READY_V2,
      checkpoint_context);
  }
  setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  return SETFARM_AGGREGATE_CENSUS_OK_V2;

cleanup:
  setfarm_pass_dispose_v2(&second);
  setfarm_pass_dispose_v2(&first);
  return setfarm_session_destroy_with_code_v2(session_io, code, failure);
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_close_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_capture_pass_v2 first;
  setfarm_capture_pass_v2 second;
  setfarm_aggregate_census_error_v2 code;
  setfarm_aggregate_census_session_v2 *session =
    session_io == NULL ? NULL : *session_io;
  memset(&first, 0, sizeof(first));
  memset(&second, 0, sizeof(second));
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (session_io == NULL || session == NULL || failure == NULL ||
      session->state !=
        SETFARM_AGGREGATE_CENSUS_SESSION_RECAPTURE_EQUAL_V2) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return setfarm_session_destroy_with_code_v2(
      session_io,
      SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2,
      failure);
  }
  code = setfarm_session_capture_pair_v2(
    session,
    false,
    NULL,
    NULL,
    &first,
    &second,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (!setfarm_passes_equal_v2(&session->private_baseline, &first)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
    goto cleanup;
  }
  setfarm_pass_dispose_v2(&second);
  setfarm_pass_dispose_v2(&first);
  code = setfarm_session_destroy_with_code_v2(
    session_io, SETFARM_AGGREGATE_CENSUS_OK_V2, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  }
  return code;

cleanup:
  setfarm_pass_dispose_v2(&second);
  setfarm_pass_dispose_v2(&first);
  return setfarm_session_destroy_with_code_v2(session_io, code, failure);
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_session_abort_v2(
  setfarm_aggregate_census_session_v2 **session_io,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_aggregate_census_error_v2 code;
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (session_io == NULL || *session_io == NULL || failure == NULL) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return setfarm_session_destroy_with_code_v2(
      session_io,
      SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2,
      failure);
  }
  code = setfarm_session_destroy_with_code_v2(
    session_io, SETFARM_AGGREGATE_CENSUS_OK_V2, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  }
  return code;
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_exact_release_probe_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_exact_release_probe_stop_v2 stop_checkpoint,
  setfarm_aggregate_census_exact_release_probe_result_v2 *result,
  setfarm_aggregate_census_failure_v2 *failure)
{
  if (result != NULL) {
    memset(result, 0, sizeof(*result));
  }
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (inherited_parent_fd < 0 || result == NULL || failure == NULL ||
      stop_checkpoint <
        SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_NONE_V2 ||
      stop_checkpoint >
        SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_ALL_RELEASED_V2) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2;
  }
#if !defined(__APPLE__)
  (void)stop_checkpoint;
  setfarm_fail_v2(
    failure, SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2, ENOTSUP);
  return SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2;
#else
  setfarm_held_lock_v2 shared_lock;
  setfarm_held_lock_v2 node_lock;
  struct stat parent_status;
  setfarm_aggregate_census_stat_v2 parent_evidence;
  setfarm_aggregate_census_error_v2 code =
    SETFARM_AGGREGATE_CENSUS_OK_V2;
  int release_errno = 0;
  bool cleanup_ok;

  memset(&shared_lock, 0, sizeof(shared_lock));
  memset(&node_lock, 0, sizeof(node_lock));
  memset(&parent_status, 0, sizeof(parent_status));
  memset(&parent_evidence, 0, sizeof(parent_evidence));
  shared_lock.name = SETFARM_AGGREGATE_CENSUS_SHARED_LOCK_NAME_V2;
  shared_lock.content = setfarm_shared_lock_content_v2;
  shared_lock.content_length = sizeof(setfarm_shared_lock_content_v2) - 1;
  shared_lock.fd = -1;
  node_lock.name = SETFARM_AGGREGATE_CENSUS_NODE_LOCK_NAME_V2;
  node_lock.content = setfarm_node_lock_content_v2;
  node_lock.content_length = sizeof(setfarm_node_lock_content_v2) - 1;
  node_lock.fd = -1;

  if (fstat(inherited_parent_fd, &parent_status) != 0 ||
      !setfarm_stat_representable_v2(&parent_status) ||
      !S_ISDIR(parent_status.st_mode) ||
      ((parent_status.st_mode & (mode_t)07777) != (mode_t)0700 &&
       (parent_status.st_mode & (mode_t)07777) != (mode_t)0755)) {
    int saved_errno = errno;
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_PARENT_INVALID_V2, saved_errno);
    code = SETFARM_AGGREGATE_CENSUS_PARENT_INVALID_V2;
    goto cleanup;
  }
  setfarm_fill_stat_v2(&parent_status, &parent_evidence);
  code = setfarm_parent_fence_v2(
    inherited_parent_fd, &parent_evidence, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_lock_acquire_command_v2(
    inherited_parent_fd,
    &parent_status,
    &shared_lock,
    F_TLOCK,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (stop_checkpoint ==
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_SHARED_HELD_V2) {
    if (raise(SIGSTOP) != 0) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2, saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2;
      goto cleanup;
    }
  }
  code = setfarm_lock_revalidate_v2(
    inherited_parent_fd, &parent_status, &shared_lock, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_parent_fence_v2(
      inherited_parent_fd, &parent_evidence, failure);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  code = setfarm_lock_acquire_command_v2(
    inherited_parent_fd,
    &parent_status,
    &node_lock,
    F_TLOCK,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (shared_lock.status.st_dev == node_lock.status.st_dev &&
      shared_lock.status.st_ino == node_lock.status.st_ino) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2, 0);
    code = SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2;
    goto cleanup;
  }
  if (stop_checkpoint ==
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_BOTH_HELD_V2) {
    if (raise(SIGSTOP) != 0) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2, saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2;
      goto cleanup;
    }
  }
  code = setfarm_parent_fence_v2(
    inherited_parent_fd, &parent_evidence, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      inherited_parent_fd, &parent_status, &shared_lock, failure);
  }
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      inherited_parent_fd, &parent_status, &node_lock, failure);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (!setfarm_lock_unlock_keep_open_v2(&node_lock, &release_errno)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2, release_errno);
    code = SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2;
    goto cleanup;
  }
  if (stop_checkpoint ==
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_NODE_RELEASED_V2) {
    if (raise(SIGSTOP) != 0) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2, saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2;
      goto cleanup;
    }
  }
  code = setfarm_parent_fence_v2(
    inherited_parent_fd, &parent_evidence, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      inherited_parent_fd, &parent_status, &node_lock, failure);
  }
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      inherited_parent_fd, &parent_status, &shared_lock, failure);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  if (!setfarm_lock_unlock_keep_open_v2(&shared_lock, &release_errno)) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2, release_errno);
    code = SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2;
    goto cleanup;
  }
  if (stop_checkpoint ==
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_ALL_RELEASED_V2) {
    if (raise(SIGSTOP) != 0) {
      int saved_errno = errno;
      setfarm_fail_v2(
        failure, SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2, saved_errno);
      code = SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2;
      goto cleanup;
    }
  }
  code = setfarm_parent_fence_v2(
    inherited_parent_fd, &parent_evidence, failure);
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      inherited_parent_fd, &parent_status, &node_lock, failure);
  }
  if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
    code = setfarm_lock_revalidate_v2(
      inherited_parent_fd, &parent_status, &shared_lock, failure);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    goto cleanup;
  }
  result->parent_stat = parent_evidence;
  result->shared_lock_stat = shared_lock.evidence;
  result->node_lock_stat = node_lock.evidence;

cleanup:
  cleanup_ok = setfarm_lock_release_v2(&node_lock, &release_errno);
  cleanup_ok = setfarm_lock_release_v2(
    &shared_lock, &release_errno) && cleanup_ok;
  setfarm_zero_bytes_v2(&parent_status, sizeof(parent_status));
  setfarm_zero_bytes_v2(&parent_evidence, sizeof(parent_evidence));
  if (!cleanup_ok) {
    memset(result, 0, sizeof(*result));
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2, release_errno);
    return SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2;
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    memset(result, 0, sizeof(*result));
    return code;
  }
  setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
#endif
}

typedef struct setfarm_aggregate_census_legacy_checkpoint_v2 {
  setfarm_aggregate_census_checkpoint_hook_v2 hook;
  void *context;
} setfarm_aggregate_census_legacy_checkpoint_v2;

static void
setfarm_aggregate_census_legacy_checkpoint_hook_v2(
  setfarm_aggregate_census_checkpoint_v2 checkpoint,
  void *opaque_context)
{
  setfarm_aggregate_census_legacy_checkpoint_v2 *legacy =
    (setfarm_aggregate_census_legacy_checkpoint_v2 *)opaque_context;
  if (checkpoint ==
        SETFARM_AGGREGATE_CENSUS_CHECKPOINT_AFTER_FIRST_PASS_V2 &&
      legacy->hook != NULL) {
    legacy->hook(checkpoint, legacy->context);
  }
}

setfarm_aggregate_census_error_v2
setfarm_aggregate_census_capture_v2(
  int inherited_parent_fd,
  setfarm_aggregate_census_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_aggregate_census_result_v2 *result,
  setfarm_aggregate_census_failure_v2 *failure)
{
  setfarm_aggregate_census_session_v2 *session = NULL;
  setfarm_aggregate_census_legacy_checkpoint_v2 legacy_checkpoint;
  setfarm_aggregate_census_error_v2 code;
  legacy_checkpoint.hook = checkpoint_hook;
  legacy_checkpoint.context = checkpoint_context;
  if (result != NULL) {
    memset(result, 0, sizeof(*result));
  }
  if (failure != NULL) {
    memset(failure, 0, sizeof(*failure));
  }
  if (inherited_parent_fd < 0 || result == NULL || failure == NULL) {
    setfarm_fail_v2(
      failure, SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2, EINVAL);
    return SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2;
  }
  code = setfarm_aggregate_census_session_open_v2(
    inherited_parent_fd,
    checkpoint_hook == NULL
      ? NULL
      : setfarm_aggregate_census_legacy_checkpoint_hook_v2,
    &legacy_checkpoint,
    &session,
    failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return code;
  }
  *result = session->observation;
  memset(&session->observation, 0, sizeof(session->observation));
  code = setfarm_aggregate_census_session_abort_v2(&session, failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_aggregate_census_result_dispose_v2(result);
    return code;
  }
  setfarm_fail_v2(failure, SETFARM_AGGREGATE_CENSUS_OK_V2, 0);
  return SETFARM_AGGREGATE_CENSUS_OK_V2;
}

const char *
setfarm_aggregate_census_error_name_v2(
  setfarm_aggregate_census_error_v2 code)
{
  switch (code) {
  case SETFARM_AGGREGATE_CENSUS_OK_V2: return "ok";
  case SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2:
    return "invalid_argument";
  case SETFARM_AGGREGATE_CENSUS_PLATFORM_UNAVAILABLE_V2:
    return "platform_unavailable";
  case SETFARM_AGGREGATE_CENSUS_PARENT_INVALID_V2:
    return "parent_invalid";
  case SETFARM_AGGREGATE_CENSUS_PARENT_CHANGED_V2:
    return "parent_changed";
  case SETFARM_AGGREGATE_CENSUS_LOCK_INVALID_V2: return "lock_invalid";
  case SETFARM_AGGREGATE_CENSUS_LOCK_FAILED_V2: return "lock_failed";
  case SETFARM_AGGREGATE_CENSUS_ENUMERATION_FAILED_V2:
    return "enumeration_failed";
  case SETFARM_AGGREGATE_CENSUS_ENTRY_INVALID_V2: return "entry_invalid";
  case SETFARM_AGGREGATE_CENSUS_ENTRY_CHANGED_V2: return "entry_changed";
  case SETFARM_AGGREGATE_CENSUS_CONTENT_FAILED_V2:
    return "content_failed";
  case SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2:
    return "membership_changed";
  case SETFARM_AGGREGATE_CENSUS_BOUND_EXCEEDED_V2:
    return "bound_exceeded";
  case SETFARM_AGGREGATE_CENSUS_MEMORY_FAILED_V2: return "memory_failed";
  case SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2: return "release_failed";
  }
  return "unknown";
}
