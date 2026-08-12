#define _DARWIN_C_SOURCE 1

#include "platform-release-content-store-filesystem-kernel-v2.h"

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#define SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2 ((mode_t)0700)
#define SETFARM_CONTENT_STORE_RELEASE_MODE_V2 ((mode_t)0555)
#define SETFARM_CONTENT_STORE_FILE_MODE_V2 ((mode_t)0444)
#define SETFARM_CONTENT_STORE_LEASE_MODE_V2 ((mode_t)0600)
#define SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2 ((size_t)137)
#define SETFARM_CONTENT_STORE_ATTESTATION_NAME_BYTES_V2 ((size_t)69)
#define SETFARM_CONTENT_STORE_CONTENT_LEASE_NAME_BYTES_V2 ((size_t)77)
#define SETFARM_CONTENT_STORE_ATTESTATION_LEASE_NAME_BYTES_V2 ((size_t)81)

typedef struct setfarm_content_store_children_v2 {
  int locks_fd;
  int staging_fd;
  int releases_fd;
  int attestations_fd;
  struct stat locks_status;
  struct stat staging_status;
  struct stat releases_status;
  struct stat attestations_status;
} setfarm_content_store_children_v2;

typedef struct setfarm_content_store_lease_v2 {
  int fd;
  const char *name;
  struct stat status;
  bool acquired;
  bool lock_held;
  bool created_owned;
  bool recovered_stale;
  setfarm_content_store_lease_code_v2 changed_code;
  setfarm_content_store_lease_code_v2 release_code;
} setfarm_content_store_lease_v2;

typedef struct setfarm_content_store_stage_v2 {
  int root_fd;
  int release_fd;
  char name[SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2 + 1];
  struct stat root_status;
  struct stat release_status;
  struct stat manifest_status;
  struct stat attestation_status;
  bool created;
  bool release_created;
  bool manifest_created;
  bool attestation_created;
} setfarm_content_store_stage_v2;

typedef struct setfarm_content_store_owned_request_v2 {
  setfarm_content_store_request_v2 value;
  uint8_t manifest_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2];
  uint8_t attestation_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2];
  uint8_t *manifest_bytes;
  uint8_t *attestation_bytes;
} setfarm_content_store_owned_request_v2;

static void
setfarm_zero_v2(void *value, size_t length)
{
  volatile uint8_t *bytes = (volatile uint8_t *)value;
  while (length > 0) {
    *bytes = 0;
    bytes += 1;
    length -= 1;
  }
}

static void
setfarm_owned_request_initialize_v2(
  setfarm_content_store_owned_request_v2 *owned)
{
  memset(owned, 0, sizeof(*owned));
}

static void
setfarm_owned_request_destroy_v2(
  setfarm_content_store_owned_request_v2 *owned)
{
  if (owned->manifest_bytes != NULL) {
    setfarm_zero_v2(
      owned->manifest_bytes, owned->value.manifest_byte_length);
    free(owned->manifest_bytes);
  }
  if (owned->attestation_bytes != NULL) {
    setfarm_zero_v2(
      owned->attestation_bytes, owned->value.attestation_byte_length);
    free(owned->attestation_bytes);
  }
  setfarm_zero_v2(owned, sizeof(*owned));
}

static void
setfarm_children_initialize_v2(setfarm_content_store_children_v2 *children)
{
  memset(children, 0, sizeof(*children));
  children->locks_fd = -1;
  children->staging_fd = -1;
  children->releases_fd = -1;
  children->attestations_fd = -1;
}

static void
setfarm_stage_initialize_v2(setfarm_content_store_stage_v2 *stage)
{
  memset(stage, 0, sizeof(*stage));
  stage->root_fd = -1;
  stage->release_fd = -1;
}

static void
setfarm_lease_initialize_v2(
  setfarm_content_store_lease_v2 *lease,
  const char *name,
  setfarm_content_store_lease_code_v2 changed_code,
  setfarm_content_store_lease_code_v2 release_code)
{
  memset(lease, 0, sizeof(*lease));
  lease->fd = -1;
  lease->name = name;
  lease->changed_code = changed_code;
  lease->release_code = release_code;
}

static void
setfarm_failure_initialize_v2(setfarm_content_store_failure_v2 *failure)
{
  memset(failure, 0, sizeof(*failure));
  failure->primary_code = SETFARM_CONTENT_STORE_OK_V2;
  failure->cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_OK_V2;
  failure->lease_code = SETFARM_CONTENT_STORE_LEASE_OK_V2;
}

static setfarm_content_store_error_v2
setfarm_fail_primary_v2(
  setfarm_content_store_failure_v2 *failure,
  setfarm_content_store_error_v2 code,
  int system_errno)
{
  if (failure->primary_code == SETFARM_CONTENT_STORE_OK_V2) {
    failure->primary_code = code;
    failure->primary_errno = system_errno;
  }
  return code;
}

static void
setfarm_fail_cleanup_v2(
  setfarm_content_store_failure_v2 *failure,
  setfarm_content_store_cleanup_code_v2 code,
  int system_errno)
{
  if (failure->cleanup_code == SETFARM_CONTENT_STORE_CLEANUP_OK_V2) {
    failure->cleanup_code = code;
    failure->cleanup_errno = system_errno;
  }
}

static void
setfarm_fail_lease_v2(
  setfarm_content_store_failure_v2 *failure,
  setfarm_content_store_lease_code_v2 code,
  int system_errno)
{
  if (failure->lease_code == SETFARM_CONTENT_STORE_LEASE_OK_V2) {
    failure->lease_code = code;
    failure->lease_errno = system_errno;
  }
}

static void
setfarm_checkpoint_v2(
  setfarm_content_store_checkpoint_v2 checkpoint,
  setfarm_content_store_checkpoint_hook_v2 hook,
  void *context,
  setfarm_content_store_failure_v2 *failure)
{
  failure->last_checkpoint = checkpoint;
  if (hook != NULL) {
    hook(checkpoint, context);
  }
}

static bool
setfarm_stat_representable_v2(const struct stat *status)
{
  return status->st_nlink >= (nlink_t)0 && status->st_size >= (off_t)0 &&
    status->st_mtimespec.tv_sec >= (time_t)0 &&
    status->st_mtimespec.tv_nsec >= 0 &&
    status->st_mtimespec.tv_nsec < 1000000000L &&
    status->st_ctimespec.tv_sec >= (time_t)0 &&
    status->st_ctimespec.tv_nsec >= 0 &&
    status->st_ctimespec.tv_nsec < 1000000000L;
}

static uint32_t
setfarm_mode_v2(const struct stat *status)
{
  return (uint32_t)(status->st_mode & (mode_t)07777);
}

static bool
setfarm_same_object_v2(const struct stat *left, const struct stat *right)
{
  return left->st_dev == right->st_dev && left->st_ino == right->st_ino;
}

static bool
setfarm_same_snapshot_v2(const struct stat *left, const struct stat *right)
{
  return setfarm_same_object_v2(left, right) &&
    left->st_mode == right->st_mode && left->st_uid == right->st_uid &&
    left->st_gid == right->st_gid && left->st_nlink == right->st_nlink &&
    left->st_size == right->st_size &&
    left->st_mtimespec.tv_sec == right->st_mtimespec.tv_sec &&
    left->st_mtimespec.tv_nsec == right->st_mtimespec.tv_nsec &&
    left->st_ctimespec.tv_sec == right->st_ctimespec.tv_sec &&
    left->st_ctimespec.tv_nsec == right->st_ctimespec.tv_nsec;
}

static bool
setfarm_matches_expected_directory_v2(
  const struct stat *status,
  const setfarm_content_store_expected_directory_v2 *expected,
  uint32_t required_mode)
{
  return setfarm_stat_representable_v2(status) && S_ISDIR(status->st_mode) &&
    (uint64_t)status->st_dev == expected->device &&
    (uint64_t)status->st_ino == expected->inode &&
    (uint64_t)status->st_uid == expected->owner_uid &&
    (uint64_t)status->st_gid == expected->owner_gid &&
    setfarm_mode_v2(status) == expected->mode &&
    expected->mode == required_mode;
}

static void
setfarm_fill_evidence_v2(
  const struct stat *status,
  setfarm_content_store_physical_evidence_v2 *evidence)
{
  memset(evidence, 0, sizeof(*evidence));
  evidence->device = (uint64_t)status->st_dev;
  evidence->inode = (uint64_t)status->st_ino;
  evidence->owner_uid = (uint64_t)status->st_uid;
  evidence->owner_gid = (uint64_t)status->st_gid;
  evidence->link_count = (uint64_t)status->st_nlink;
  evidence->byte_length = (uint64_t)status->st_size;
  evidence->mode = setfarm_mode_v2(status);
  evidence->modified_seconds = (int64_t)status->st_mtimespec.tv_sec;
  evidence->modified_nanoseconds = (int64_t)status->st_mtimespec.tv_nsec;
  evidence->changed_seconds = (int64_t)status->st_ctimespec.tv_sec;
  evidence->changed_nanoseconds = (int64_t)status->st_ctimespec.tv_nsec;
}

static bool
setfarm_lower_hex_v2(const uint8_t *value, size_t length)
{
  size_t index;
  if (value == NULL || length != SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2) {
    return false;
  }
  for (index = 0; index < length; index += 1) {
    if (!((value[index] >= (uint8_t)'0' && value[index] <= (uint8_t)'9') ||
          (value[index] >= (uint8_t)'a' && value[index] <= (uint8_t)'f'))) {
      return false;
    }
  }
  return true;
}

static bool
setfarm_capture_owned_request_v2(
  const setfarm_content_store_request_v2 *request,
  setfarm_content_store_owned_request_v2 *owned,
  setfarm_content_store_error_v2 *error_out,
  int *system_errno)
{
  size_t manifest_length;
  size_t attestation_length;
  if (request == NULL) {
    *error_out = SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2;
    *system_errno = EINVAL;
    return false;
  }
  manifest_length = request->manifest_byte_length;
  attestation_length = request->attestation_byte_length;
  if (manifest_length == 0 ||
      manifest_length > SETFARM_CONTENT_STORE_MAX_MANIFEST_BYTES_V2 ||
      attestation_length == 0 ||
      attestation_length > SETFARM_CONTENT_STORE_MAX_ATTESTATION_BYTES_V2) {
    *error_out = SETFARM_CONTENT_STORE_BOUND_EXCEEDED_V2;
    *system_errno = EFBIG;
    return false;
  }
  if (request->manifest_bytes == NULL || request->attestation_bytes == NULL ||
      !setfarm_lower_hex_v2(
        request->manifest_payload_hash_hex,
        request->manifest_payload_hash_hex_length) ||
      !setfarm_lower_hex_v2(
        request->attestation_hash_hex,
        request->attestation_hash_hex_length)) {
    *error_out = SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2;
    *system_errno = EINVAL;
    return false;
  }
  owned->manifest_bytes = (uint8_t *)malloc(manifest_length);
  owned->attestation_bytes = (uint8_t *)malloc(attestation_length);
  if (owned->manifest_bytes == NULL || owned->attestation_bytes == NULL) {
    *error_out = SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2;
    *system_errno = ENOMEM;
    return false;
  }
  memcpy(
    owned->manifest_hash, request->manifest_payload_hash_hex,
    sizeof(owned->manifest_hash));
  memcpy(
    owned->attestation_hash, request->attestation_hash_hex,
    sizeof(owned->attestation_hash));
  memcpy(owned->manifest_bytes, request->manifest_bytes, manifest_length);
  memcpy(
    owned->attestation_bytes, request->attestation_bytes,
    attestation_length);
  owned->value.manifest_payload_hash_hex = owned->manifest_hash;
  owned->value.manifest_payload_hash_hex_length = sizeof(owned->manifest_hash);
  owned->value.attestation_hash_hex = owned->attestation_hash;
  owned->value.attestation_hash_hex_length = sizeof(owned->attestation_hash);
  owned->value.manifest_bytes = owned->manifest_bytes;
  owned->value.manifest_byte_length = manifest_length;
  owned->value.attestation_bytes = owned->attestation_bytes;
  owned->value.attestation_byte_length = attestation_length;
  owned->value.root = request->root;
  owned->value.locks = request->locks;
  owned->value.staging = request->staging;
  owned->value.releases = request->releases;
  owned->value.attestations = request->attestations;
  if (!setfarm_lower_hex_v2(
        owned->value.manifest_payload_hash_hex,
        owned->value.manifest_payload_hash_hex_length) ||
      !setfarm_lower_hex_v2(
        owned->value.attestation_hash_hex,
        owned->value.attestation_hash_hex_length)) {
    *error_out = SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2;
    *system_errno = EINVAL;
    return false;
  }
  *error_out = SETFARM_CONTENT_STORE_OK_V2;
  *system_errno = 0;
  return true;
}

static bool
setfarm_build_names_v2(
  const setfarm_content_store_request_v2 *request,
  char manifest_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2 + 1],
  char attestation_name[SETFARM_CONTENT_STORE_ATTESTATION_NAME_BYTES_V2 + 1],
  char content_lease_name[SETFARM_CONTENT_STORE_CONTENT_LEASE_NAME_BYTES_V2 + 1],
  char attestation_lease_name[SETFARM_CONTENT_STORE_ATTESTATION_LEASE_NAME_BYTES_V2 + 1],
  char stage_name[SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2 + 1])
{
  char attestation_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2 + 1];
  int count;
  memcpy(
    manifest_hash, request->manifest_payload_hash_hex,
    SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2);
  manifest_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2] = '\0';
  memcpy(
    attestation_hash, request->attestation_hash_hex,
    SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2);
  attestation_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2] = '\0';
  count = snprintf(
    attestation_name,
    SETFARM_CONTENT_STORE_ATTESTATION_NAME_BYTES_V2 + 1,
    "%s.json", attestation_hash);
  if (count != (int)SETFARM_CONTENT_STORE_ATTESTATION_NAME_BYTES_V2) {
    return false;
  }
  count = snprintf(
    content_lease_name,
    SETFARM_CONTENT_STORE_CONTENT_LEASE_NAME_BYTES_V2 + 1,
    "content-%s.lock", manifest_hash);
  if (count != (int)SETFARM_CONTENT_STORE_CONTENT_LEASE_NAME_BYTES_V2) {
    return false;
  }
  count = snprintf(
    attestation_lease_name,
    SETFARM_CONTENT_STORE_ATTESTATION_LEASE_NAME_BYTES_V2 + 1,
    "attestation-%s.lock", attestation_hash);
  if (count != (int)SETFARM_CONTENT_STORE_ATTESTATION_LEASE_NAME_BYTES_V2) {
    return false;
  }
  count = snprintf(
    stage_name,
    SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2 + 1,
    "publish-%s-%s", manifest_hash, attestation_hash);
  setfarm_zero_v2(attestation_hash, sizeof(attestation_hash));
  return count == (int)SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2;
}

static bool
setfarm_full_sync_v2(int descriptor, int *system_errno)
{
#if defined(__APPLE__) && defined(F_FULLFSYNC)
  if (fcntl(descriptor, F_FULLFSYNC, 0) == 0) {
    return true;
  }
  *system_errno = errno;
  return false;
#else
  (void)descriptor;
  *system_errno = ENOTSUP;
  return false;
#endif
}

static bool
setfarm_open_child_v2(
  int root_fd,
  const char *name,
  const setfarm_content_store_expected_directory_v2 *expected,
  int *descriptor_out,
  struct stat *status_out,
  int *system_errno)
{
  struct stat path_status;
  struct stat descriptor_status;
  int descriptor = -1;
  if (fstatat(root_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    return false;
  }
  descriptor = openat(
    root_fd, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, &descriptor_status) != 0) {
    *system_errno = errno;
    if (descriptor >= 0) {
      (void)close(descriptor);
    }
    return false;
  }
  if (!setfarm_same_snapshot_v2(&path_status, &descriptor_status) ||
      !setfarm_matches_expected_directory_v2(
        &descriptor_status, expected, (uint32_t)0700)) {
    *system_errno = 0;
    (void)close(descriptor);
    return false;
  }
  *descriptor_out = descriptor;
  *status_out = descriptor_status;
  return true;
}

static bool
setfarm_revalidate_child_v2(
  int root_fd,
  const char *name,
  int descriptor,
  const struct stat *expected,
  int *system_errno)
{
  struct stat path_status;
  struct stat descriptor_status;
  if (fstatat(root_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0 ||
      fstat(descriptor, &descriptor_status) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!S_ISDIR(path_status.st_mode) ||
      !setfarm_same_snapshot_v2(&path_status, &descriptor_status) ||
      !setfarm_same_object_v2(&descriptor_status, expected) ||
      descriptor_status.st_uid != expected->st_uid ||
      descriptor_status.st_gid != expected->st_gid ||
      setfarm_mode_v2(&descriptor_status) != (uint32_t)0700 ||
      !setfarm_stat_representable_v2(&descriptor_status)) {
    *system_errno = 0;
    return false;
  }
  return true;
}

static bool
setfarm_revalidate_directory_entry_v2(
  int parent_fd,
  const char *name,
  int descriptor,
  const struct stat *expected,
  uid_t owner_uid,
  gid_t owner_gid,
  uint32_t required_mode,
  struct stat *current_out,
  int *system_errno)
{
  struct stat path_status;
  struct stat descriptor_status;
  if (fstatat(parent_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0 ||
      fstat(descriptor, &descriptor_status) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!S_ISDIR(descriptor_status.st_mode) ||
      !setfarm_same_snapshot_v2(&path_status, &descriptor_status) ||
      !setfarm_same_object_v2(&descriptor_status, expected) ||
      descriptor_status.st_uid != owner_uid ||
      descriptor_status.st_gid != owner_gid ||
      setfarm_mode_v2(&descriptor_status) != required_mode ||
      !setfarm_stat_representable_v2(&descriptor_status)) {
    *system_errno = 0;
    return false;
  }
  if (current_out != NULL) {
    *current_out = descriptor_status;
  }
  return true;
}

static bool
setfarm_revalidate_children_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  int *system_errno)
{
  return
    setfarm_revalidate_child_v2(
      root_fd, SETFARM_CONTENT_STORE_LOCKS_NAME_V2, children->locks_fd,
      &children->locks_status, system_errno) &&
    setfarm_revalidate_child_v2(
      root_fd, SETFARM_CONTENT_STORE_STAGING_NAME_V2, children->staging_fd,
      &children->staging_status, system_errno) &&
    setfarm_revalidate_child_v2(
      root_fd, SETFARM_CONTENT_STORE_RELEASES_NAME_V2, children->releases_fd,
      &children->releases_status, system_errno) &&
    setfarm_revalidate_child_v2(
      root_fd, SETFARM_CONTENT_STORE_ATTESTATIONS_NAME_V2,
      children->attestations_fd, &children->attestations_status, system_errno);
}

static bool
setfarm_directory_has_names_v2(
  int descriptor,
  const char *const *allowed,
  size_t allowed_count,
  bool require_all,
  int *system_errno)
{
  int duplicate = -1;
  DIR *directory;
  struct dirent *entry;
  struct stat descriptor_before;
  struct stat descriptor_after;
  struct stat reopened_before;
  struct stat reopened_after;
  bool *seen;
  bool valid = true;
  size_t index;
  *system_errno = 0;
  if (fstat(descriptor, &descriptor_before) != 0) {
    *system_errno = errno;
    return false;
  }
  duplicate = openat(
    descriptor, ".",
    O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (duplicate < 0) {
    *system_errno = errno;
    return false;
  }
  if (fstat(duplicate, &reopened_before) != 0) {
    *system_errno = errno;
    (void)close(duplicate);
    return false;
  }
  if (!setfarm_same_snapshot_v2(&descriptor_before, &reopened_before)) {
    *system_errno = 0;
    (void)close(duplicate);
    return false;
  }
  directory = fdopendir(duplicate);
  if (directory == NULL) {
    *system_errno = errno;
    (void)close(duplicate);
    return false;
  }
  seen = (bool *)calloc(allowed_count == 0 ? 1 : allowed_count, sizeof(bool));
  if (seen == NULL) {
    *system_errno = ENOMEM;
    (void)closedir(directory);
    return false;
  }
  errno = 0;
  while ((entry = readdir(directory)) != NULL) {
    bool matched = false;
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
      continue;
    }
    for (index = 0; index < allowed_count; index += 1) {
      if (strcmp(entry->d_name, allowed[index]) == 0 && !seen[index]) {
        seen[index] = true;
        matched = true;
        break;
      }
    }
    if (!matched) {
      valid = false;
      break;
    }
  }
  if (entry == NULL && errno != 0) {
    *system_errno = errno;
    valid = false;
  }
  if (valid && require_all) {
    for (index = 0; index < allowed_count; index += 1) {
      if (!seen[index]) {
        valid = false;
        *system_errno = 0;
      }
    }
  }
  if (valid &&
      (fstat(descriptor, &descriptor_after) != 0 ||
       fstat(duplicate, &reopened_after) != 0)) {
    *system_errno = errno;
    valid = false;
  }
  if (valid &&
      (!setfarm_same_snapshot_v2(&descriptor_before, &descriptor_after) ||
       !setfarm_same_snapshot_v2(&descriptor_after, &reopened_after))) {
    *system_errno = 0;
    valid = false;
  }
  free(seen);
  if (closedir(directory) != 0 && valid) {
    *system_errno = errno;
    valid = false;
  }
  return valid;
}

static bool
setfarm_probe_entry_v2(
  int parent_fd,
  const char *name,
  bool *exists,
  struct stat *status,
  int *system_errno)
{
  if (fstatat(parent_fd, name, status, AT_SYMLINK_NOFOLLOW) == 0) {
    *exists = true;
    return true;
  }
  if (errno == ENOENT) {
    memset(status, 0, sizeof(*status));
    *exists = false;
    return true;
  }
  *system_errno = errno;
  return false;
}

static bool
setfarm_write_exact_file_v2(
  int parent_fd,
  const char *name,
  const uint8_t *bytes,
  size_t length,
  uid_t owner_uid,
  gid_t owner_gid,
  struct stat *status_out,
  bool *created_out,
  int *system_errno)
{
  int descriptor = openat(
    parent_fd, name,
    O_RDWR | O_CLOEXEC | O_NOFOLLOW | O_CREAT | O_EXCL,
    SETFARM_CONTENT_STORE_FILE_MODE_V2);
  size_t offset = 0;
  struct stat descriptor_status;
  struct stat path_status;
  if (descriptor < 0) {
    *system_errno = errno;
    return false;
  }
  if (fstat(descriptor, status_out) != 0) {
    *system_errno = errno;
    (void)close(descriptor);
    return false;
  }
  *created_out = true;
  while (offset < length) {
    ssize_t count = pwrite(
      descriptor, bytes + offset, length - offset, (off_t)offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      *system_errno = count < 0 ? errno : EIO;
      (void)close(descriptor);
      return false;
    }
    offset += (size_t)count;
  }
  if (fchmod(descriptor, SETFARM_CONTENT_STORE_FILE_MODE_V2) != 0 ||
      fstat(descriptor, &descriptor_status) != 0 ||
      fstatat(parent_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    (void)close(descriptor);
    return false;
  }
  if (!S_ISREG(descriptor_status.st_mode) ||
      !setfarm_same_snapshot_v2(&descriptor_status, &path_status) ||
      descriptor_status.st_uid != owner_uid ||
      descriptor_status.st_gid != owner_gid ||
      setfarm_mode_v2(&descriptor_status) != (uint32_t)0444 ||
      descriptor_status.st_nlink != (nlink_t)1 ||
      descriptor_status.st_size != (off_t)length) {
    *system_errno = 0;
    (void)close(descriptor);
    return false;
  }
  if (!setfarm_full_sync_v2(descriptor, system_errno)) {
    (void)close(descriptor);
    return false;
  }
  if (close(descriptor) != 0) {
    *system_errno = errno;
    return false;
  }
  *status_out = descriptor_status;
  return true;
}

static bool
setfarm_read_exact_file_v2(
  int parent_fd,
  const char *name,
  const uint8_t *expected_bytes,
  size_t expected_length,
  uid_t owner_uid,
  gid_t owner_gid,
  struct stat *status_out,
  int *system_errno)
{
  int descriptor = openat(parent_fd, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  struct stat before;
  struct stat after;
  struct stat path_after;
  uint8_t *bytes = NULL;
  size_t offset = 0;
  bool valid = false;
  if (descriptor < 0 || fstat(descriptor, &before) != 0) {
    *system_errno = errno;
    if (descriptor >= 0) {
      (void)close(descriptor);
    }
    return false;
  }
  if (!S_ISREG(before.st_mode) || before.st_uid != owner_uid ||
      before.st_gid != owner_gid || setfarm_mode_v2(&before) != (uint32_t)0444 ||
      before.st_nlink != (nlink_t)1 || before.st_size != (off_t)expected_length) {
    *system_errno = 0;
    (void)close(descriptor);
    return false;
  }
  bytes = (uint8_t *)malloc(expected_length);
  if (bytes == NULL) {
    *system_errno = ENOMEM;
    (void)close(descriptor);
    return false;
  }
  while (offset < expected_length) {
    ssize_t count = pread(
      descriptor, bytes + offset, expected_length - offset, (off_t)offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      *system_errno = count < 0 ? errno : EIO;
      goto cleanup;
    }
    offset += (size_t)count;
  }
  if (memcmp(bytes, expected_bytes, expected_length) != 0) {
    *system_errno = 0;
    goto cleanup;
  }
  if (fstat(descriptor, &after) != 0 ||
      fstatat(parent_fd, name, &path_after, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    goto cleanup;
  }
  if (!setfarm_same_snapshot_v2(&before, &after) ||
      !setfarm_same_snapshot_v2(&after, &path_after)) {
    *system_errno = 0;
    goto cleanup;
  }
  *status_out = after;
  valid = true;

cleanup:
  setfarm_zero_v2(bytes, expected_length);
  free(bytes);
  if (close(descriptor) != 0 && valid) {
    *system_errno = errno;
    valid = false;
  }
  return valid;
}

static bool
setfarm_open_exact_staged_file_v2(
  int parent_fd,
  const char *name,
  const struct stat *expected,
  uid_t owner_uid,
  gid_t owner_gid,
  size_t expected_length,
  int *descriptor_out,
  int *system_errno)
{
  int descriptor = openat(
    parent_fd, name, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  struct stat descriptor_status;
  struct stat path_status;
  if (descriptor < 0 || fstat(descriptor, &descriptor_status) != 0 ||
      fstatat(parent_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    if (descriptor >= 0) {
      (void)close(descriptor);
    }
    return false;
  }
  if (!S_ISREG(descriptor_status.st_mode) ||
      !setfarm_same_snapshot_v2(&descriptor_status, &path_status) ||
      !setfarm_same_snapshot_v2(&descriptor_status, expected) ||
      descriptor_status.st_uid != owner_uid ||
      descriptor_status.st_gid != owner_gid ||
      setfarm_mode_v2(&descriptor_status) != (uint32_t)0444 ||
      descriptor_status.st_nlink != (nlink_t)1 ||
      descriptor_status.st_size != (off_t)expected_length) {
    *system_errno = 0;
    (void)close(descriptor);
    return false;
  }
  *descriptor_out = descriptor;
  return true;
}

static bool
setfarm_revalidate_open_staged_file_v2(
  int descriptor,
  int parent_fd,
  const char *name,
  const struct stat *expected,
  uid_t owner_uid,
  gid_t owner_gid,
  size_t expected_length,
  int *system_errno)
{
  struct stat descriptor_status;
  struct stat path_status;
  if (fstat(descriptor, &descriptor_status) != 0 ||
      fstatat(parent_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!S_ISREG(descriptor_status.st_mode) ||
      !setfarm_same_snapshot_v2(&descriptor_status, &path_status) ||
      !setfarm_same_snapshot_v2(&descriptor_status, expected) ||
      descriptor_status.st_uid != owner_uid ||
      descriptor_status.st_gid != owner_gid ||
      setfarm_mode_v2(&descriptor_status) != (uint32_t)0444 ||
      descriptor_status.st_nlink != (nlink_t)1 ||
      descriptor_status.st_size != (off_t)expected_length) {
    *system_errno = 0;
    return false;
  }
  return true;
}

static bool
setfarm_validate_link_pair_v2(
  int source_fd,
  int source_parent_fd,
  const char *source_name,
  int target_parent_fd,
  const char *target_name,
  const struct stat *staged_status,
  uid_t owner_uid,
  gid_t owner_gid,
  size_t expected_length,
  int *system_errno)
{
  struct stat descriptor_status;
  struct stat source_status;
  struct stat target_status;
  if (fstat(source_fd, &descriptor_status) != 0 ||
      fstatat(
        source_parent_fd, source_name, &source_status,
        AT_SYMLINK_NOFOLLOW) != 0 ||
      fstatat(
        target_parent_fd, target_name, &target_status,
        AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!S_ISREG(descriptor_status.st_mode) ||
      !setfarm_same_snapshot_v2(&descriptor_status, &source_status) ||
      !setfarm_same_snapshot_v2(&descriptor_status, &target_status) ||
      !setfarm_same_object_v2(&descriptor_status, staged_status) ||
      descriptor_status.st_uid != owner_uid ||
      descriptor_status.st_gid != owner_gid ||
      setfarm_mode_v2(&descriptor_status) != (uint32_t)0444 ||
      descriptor_status.st_nlink != (nlink_t)2 ||
      descriptor_status.st_size != (off_t)expected_length) {
    *system_errno = 0;
    return false;
  }
  return true;
}

static bool
setfarm_validate_unlinked_stage_target_v2(
  int source_fd,
  int target_parent_fd,
  const char *target_name,
  const struct stat *staged_status,
  uid_t owner_uid,
  gid_t owner_gid,
  size_t expected_length,
  struct stat *target_status_out,
  int *system_errno)
{
  struct stat descriptor_status;
  struct stat target_status;
  if (fstat(source_fd, &descriptor_status) != 0 ||
      fstatat(
        target_parent_fd, target_name, &target_status,
        AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!S_ISREG(descriptor_status.st_mode) ||
      !setfarm_same_snapshot_v2(&descriptor_status, &target_status) ||
      !setfarm_same_object_v2(&descriptor_status, staged_status) ||
      descriptor_status.st_uid != owner_uid ||
      descriptor_status.st_gid != owner_gid ||
      setfarm_mode_v2(&descriptor_status) != (uint32_t)0444 ||
      descriptor_status.st_nlink != (nlink_t)1 ||
      descriptor_status.st_size != (off_t)expected_length) {
    *system_errno = 0;
    return false;
  }
  *target_status_out = target_status;
  return true;
}

static bool
setfarm_try_recover_stale_lease_v2(
  int locks_fd,
  const char *name,
  uid_t owner_uid,
  gid_t owner_gid,
  setfarm_content_store_lease_v2 *lease,
  int *system_errno)
{
  struct stat path_before;
  struct stat descriptor_before;
  struct stat descriptor_after;
  struct stat path_after;
  int descriptor;
  if (fstatat(locks_fd, name, &path_before, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!S_ISREG(path_before.st_mode) || path_before.st_uid != owner_uid ||
      path_before.st_gid != owner_gid ||
      setfarm_mode_v2(&path_before) != (uint32_t)0600 ||
      path_before.st_nlink != (nlink_t)1 ||
      path_before.st_size != (off_t)0) {
    *system_errno = 0;
    return false;
  }
  descriptor = openat(
    locks_fd, name,
    O_RDWR | O_NONBLOCK | O_CLOEXEC | O_NOFOLLOW);
  if (descriptor < 0 || fstat(descriptor, &descriptor_before) != 0 ||
      fstatat(locks_fd, name, &path_after, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    if (descriptor >= 0) {
      (void)close(descriptor);
    }
    return false;
  }
  if (!setfarm_same_snapshot_v2(&path_before, &descriptor_before) ||
      !setfarm_same_snapshot_v2(&descriptor_before, &path_after)) {
    *system_errno = 0;
    (void)close(descriptor);
    return false;
  }
  if (lockf(descriptor, F_TLOCK, (off_t)0) != 0) {
    *system_errno = errno;
    (void)close(descriptor);
    return false;
  }
  if (fstat(descriptor, &descriptor_after) != 0 ||
      fstatat(locks_fd, name, &path_after, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    (void)lockf(descriptor, F_ULOCK, (off_t)0);
    (void)close(descriptor);
    return false;
  }
  if (!setfarm_same_snapshot_v2(&descriptor_before, &descriptor_after) ||
      !setfarm_same_snapshot_v2(&descriptor_after, &path_after)) {
    *system_errno = 0;
    (void)lockf(descriptor, F_ULOCK, (off_t)0);
    (void)close(descriptor);
    return false;
  }
  lease->fd = descriptor;
  lease->status = descriptor_after;
  lease->acquired = true;
  lease->lock_held = true;
  lease->created_owned = false;
  lease->recovered_stale = true;
  return setfarm_full_sync_v2(lease->fd, system_errno) &&
    setfarm_full_sync_v2(locks_fd, system_errno);
}

static bool
setfarm_acquire_lease_v2(
  int locks_fd,
  const char *name,
  uid_t owner_uid,
  gid_t owner_gid,
  setfarm_content_store_lease_v2 *lease,
  int *system_errno)
{
  struct stat path_status;
  int original_errno;
  lease->fd = openat(
    locks_fd, name,
    O_RDWR | O_CLOEXEC | O_NOFOLLOW | O_CREAT | O_EXCL,
    SETFARM_CONTENT_STORE_LEASE_MODE_V2);
  if (lease->fd < 0) {
    int open_errno = errno;
    if (open_errno == EEXIST) {
      return setfarm_try_recover_stale_lease_v2(
        locks_fd, name, owner_uid, owner_gid, lease, system_errno);
    }
    *system_errno = open_errno;
    return false;
  }
  lease->created_owned = true;
  if (fchmod(lease->fd, SETFARM_CONTENT_STORE_LEASE_MODE_V2) != 0 ||
      fstat(lease->fd, &lease->status) != 0 ||
      fstatat(locks_fd, name, &path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    original_errno = errno;
    goto recover_failed_acquisition;
  }
  if (!S_ISREG(lease->status.st_mode) ||
      !setfarm_same_snapshot_v2(&lease->status, &path_status) ||
      lease->status.st_uid != owner_uid || lease->status.st_gid != owner_gid ||
      setfarm_mode_v2(&lease->status) != (uint32_t)0600 ||
      lease->status.st_nlink != (nlink_t)1 ||
      lease->status.st_size != (off_t)0) {
    original_errno = 0;
    goto recover_failed_acquisition;
  }
  if (lockf(lease->fd, F_TLOCK, (off_t)0) != 0) {
    original_errno = errno;
    goto recover_failed_acquisition;
  }
  lease->acquired = true;
  lease->lock_held = true;
  return setfarm_full_sync_v2(lease->fd, system_errno) &&
    setfarm_full_sync_v2(locks_fd, system_errno);

recover_failed_acquisition:
  {
    struct stat descriptor_before;
    struct stat descriptor_after;
    struct stat path_before;
    struct stat path_after;
    int ignored_errno = 0;
    bool recovery_lock_held = false;
    if (lease->created_owned &&
        fstat(lease->fd, &descriptor_before) == 0 &&
        fstatat(
          locks_fd, name, &path_before, AT_SYMLINK_NOFOLLOW) == 0 &&
        S_ISREG(descriptor_before.st_mode) &&
        setfarm_same_snapshot_v2(&descriptor_before, &path_before) &&
        descriptor_before.st_uid == owner_uid &&
        descriptor_before.st_gid == owner_gid &&
        descriptor_before.st_nlink == (nlink_t)1 &&
        descriptor_before.st_size == (off_t)0 &&
        lockf(lease->fd, F_TLOCK, (off_t)0) == 0) {
      recovery_lock_held = true;
      if (fstat(lease->fd, &descriptor_after) == 0 &&
          fstatat(
            locks_fd, name, &path_after, AT_SYMLINK_NOFOLLOW) == 0 &&
          setfarm_same_snapshot_v2(&descriptor_before, &descriptor_after) &&
          setfarm_same_snapshot_v2(&descriptor_after, &path_after) &&
          unlinkat(locks_fd, name, 0) == 0) {
        (void)setfarm_full_sync_v2(locks_fd, &ignored_errno);
      }
    }
    if (recovery_lock_held) {
      (void)lockf(lease->fd, F_ULOCK, (off_t)0);
    }
    (void)close(lease->fd);
    lease->fd = -1;
    lease->acquired = false;
    lease->lock_held = false;
    lease->created_owned = false;
    *system_errno = original_errno;
    return false;
  }
}

static bool
setfarm_release_lease_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  setfarm_content_store_lease_v2 *lease,
  setfarm_content_store_failure_v2 *failure)
{
  struct stat descriptor_status;
  struct stat path_status;
  int saved_errno = 0;
  bool valid = true;
  if (!lease->acquired) {
    return true;
  }
  if (!setfarm_revalidate_child_v2(
        root_fd, SETFARM_CONTENT_STORE_LOCKS_NAME_V2, children->locks_fd,
        &children->locks_status, &saved_errno)) {
    setfarm_fail_lease_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_PARENT_CHANGED_V2, saved_errno);
    valid = false;
  } else if (fstat(lease->fd, &descriptor_status) != 0 ||
             fstatat(
               children->locks_fd, lease->name, &path_status,
               AT_SYMLINK_NOFOLLOW) != 0) {
    setfarm_fail_lease_v2(failure, lease->changed_code, errno);
    valid = false;
  } else if (!setfarm_same_snapshot_v2(&descriptor_status, &path_status) ||
             !setfarm_same_snapshot_v2(
               &descriptor_status, &lease->status) ||
             !S_ISREG(descriptor_status.st_mode) ||
             descriptor_status.st_uid != lease->status.st_uid ||
             descriptor_status.st_gid != lease->status.st_gid ||
             descriptor_status.st_nlink != (nlink_t)1 ||
             descriptor_status.st_size != (off_t)0 ||
             setfarm_mode_v2(&descriptor_status) != (uint32_t)0600 ||
             !lease->lock_held) {
    setfarm_fail_lease_v2(failure, lease->changed_code, 0);
    valid = false;
  } else if (lockf(lease->fd, F_TLOCK, (off_t)0) != 0) {
    setfarm_fail_lease_v2(failure, lease->changed_code, errno);
    valid = false;
  } else if (!setfarm_full_sync_v2(lease->fd, &saved_errno)) {
    setfarm_fail_lease_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_SYNC_FAILED_V2, saved_errno);
    valid = false;
  }
  if (valid) {
    if (fstat(lease->fd, &descriptor_status) != 0 ||
        fstatat(
          children->locks_fd, lease->name, &path_status,
          AT_SYMLINK_NOFOLLOW) != 0) {
      setfarm_fail_lease_v2(failure, lease->changed_code, errno);
      valid = false;
    } else if (!setfarm_same_snapshot_v2(
                 &descriptor_status, &path_status) ||
               !setfarm_same_snapshot_v2(
                 &descriptor_status, &lease->status)) {
      setfarm_fail_lease_v2(failure, lease->changed_code, 0);
      valid = false;
    } else if (unlinkat(children->locks_fd, lease->name, 0) != 0) {
      setfarm_fail_lease_v2(failure, lease->release_code, errno);
      valid = false;
    }
  }
  if (valid && !setfarm_full_sync_v2(children->locks_fd, &saved_errno)) {
    setfarm_fail_lease_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_SYNC_FAILED_V2, saved_errno);
    valid = false;
  }
  if (lease->lock_held && lockf(lease->fd, F_ULOCK, (off_t)0) != 0 && valid) {
    setfarm_fail_lease_v2(failure, lease->release_code, errno);
    valid = false;
  }
  lease->lock_held = false;
  if (close(lease->fd) != 0 && valid) {
    setfarm_fail_lease_v2(failure, lease->release_code, errno);
    valid = false;
  }
  lease->fd = -1;
  lease->acquired = false;
  lease->created_owned = false;
  return valid;
}

static bool
setfarm_unlink_exact_file_if_present_v2(
  int parent_fd,
  const char *name,
  const struct stat *expected,
  setfarm_content_store_cleanup_code_v2 *cleanup_code,
  int *system_errno)
{
  struct stat status;
  if (fstatat(parent_fd, name, &status, AT_SYMLINK_NOFOLLOW) != 0) {
    if (errno == ENOENT) {
      return true;
    }
    *cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_ENTRY_UNLINK_FAILED_V2;
    *system_errno = errno;
    return false;
  }
  if (!S_ISREG(status.st_mode) || !setfarm_same_object_v2(&status, expected)) {
    *cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_ENTRY_IDENTITY_CHANGED_V2;
    *system_errno = 0;
    return false;
  }
  if (unlinkat(parent_fd, name, 0) != 0) {
    *cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_ENTRY_UNLINK_FAILED_V2;
    *system_errno = errno;
    return false;
  }
  return true;
}

static bool
setfarm_cleanup_stage_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  setfarm_content_store_stage_v2 *stage,
  setfarm_content_store_failure_v2 *failure)
{
  const char *release_names[] = { SETFARM_CONTENT_STORE_MANIFEST_NAME_V2 };
  const char *stage_names[] = {
    SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2,
    SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2
  };
  struct stat path_status;
  int saved_errno = 0;
  setfarm_content_store_cleanup_code_v2 cleanup_code =
    SETFARM_CONTENT_STORE_CLEANUP_OK_V2;
  bool valid = true;
  if (!stage->created) {
    return true;
  }
  if (!setfarm_revalidate_child_v2(
        root_fd, SETFARM_CONTENT_STORE_STAGING_NAME_V2, children->staging_fd,
        &children->staging_status, &saved_errno)) {
    setfarm_fail_cleanup_v2(
      failure, SETFARM_CONTENT_STORE_CLEANUP_PARENT_CHANGED_V2, saved_errno);
    return false;
  }
  errno = 0;
  if (fstatat(
        children->staging_fd, stage->name, &path_status,
        AT_SYMLINK_NOFOLLOW) != 0 ||
      !S_ISDIR(path_status.st_mode) ||
      !setfarm_same_object_v2(&path_status, &stage->root_status)) {
    setfarm_fail_cleanup_v2(
      failure, SETFARM_CONTENT_STORE_CLEANUP_STAGE_IDENTITY_CHANGED_V2,
      errno == 0 ? 0 : errno);
    return false;
  }
  if (!setfarm_directory_has_names_v2(
        stage->root_fd, stage_names, 2, false, &saved_errno) ||
      (stage->release_created && !setfarm_directory_has_names_v2(
        stage->release_fd, release_names, 1, false, &saved_errno))) {
    setfarm_fail_cleanup_v2(
      failure, SETFARM_CONTENT_STORE_CLEANUP_STAGE_SHAPE_INVALID_V2,
      saved_errno);
    return false;
  }
  if (stage->manifest_created && !setfarm_unlink_exact_file_if_present_v2(
        stage->release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
        &stage->manifest_status, &cleanup_code, &saved_errno)) {
    valid = false;
  }
  if (valid && stage->attestation_created &&
      !setfarm_unlink_exact_file_if_present_v2(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        &stage->attestation_status, &cleanup_code, &saved_errno)) {
    valid = false;
  }
  if (valid && stage->release_created) {
    if (!setfarm_directory_has_names_v2(
          stage->release_fd, NULL, 0, true, &saved_errno)) {
      cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_STAGE_SHAPE_INVALID_V2;
      valid = false;
    }
    if (close(stage->release_fd) != 0 && valid) {
      cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_DIRECTORY_REMOVE_FAILED_V2;
      saved_errno = errno;
      valid = false;
    }
    stage->release_fd = -1;
    if (valid) {
      errno = 0;
      if (fstatat(
            stage->root_fd, SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2,
            &path_status, AT_SYMLINK_NOFOLLOW) != 0 ||
          !S_ISDIR(path_status.st_mode) ||
          !setfarm_same_object_v2(&path_status, &stage->release_status)) {
        cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_STAGE_IDENTITY_CHANGED_V2;
        saved_errno = errno == 0 ? 0 : errno;
        valid = false;
      } else if (unlinkat(
                   stage->root_fd,
                   SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2,
                   AT_REMOVEDIR) != 0) {
        cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_DIRECTORY_REMOVE_FAILED_V2;
        saved_errno = errno;
        valid = false;
      }
    }
  }
  if (valid && !setfarm_directory_has_names_v2(
        stage->root_fd, NULL, 0, true, &saved_errno)) {
    cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_STAGE_SHAPE_INVALID_V2;
    valid = false;
  }
  if (close(stage->root_fd) != 0 && valid) {
    cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_DIRECTORY_REMOVE_FAILED_V2;
    saved_errno = errno;
    valid = false;
  }
  stage->root_fd = -1;
  if (valid) {
    errno = 0;
    if (fstatat(
          children->staging_fd, stage->name, &path_status,
          AT_SYMLINK_NOFOLLOW) != 0 ||
        !S_ISDIR(path_status.st_mode) ||
        !setfarm_same_object_v2(&path_status, &stage->root_status)) {
      cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_STAGE_IDENTITY_CHANGED_V2;
      saved_errno = errno == 0 ? 0 : errno;
      valid = false;
    } else if (unlinkat(
                 children->staging_fd, stage->name, AT_REMOVEDIR) != 0) {
      cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_DIRECTORY_REMOVE_FAILED_V2;
      saved_errno = errno;
      valid = false;
    }
  }
  if (valid && !setfarm_full_sync_v2(children->staging_fd, &saved_errno)) {
    cleanup_code = SETFARM_CONTENT_STORE_CLEANUP_SYNC_FAILED_V2;
    valid = false;
  }
  if (!valid) {
    setfarm_fail_cleanup_v2(failure, cleanup_code, saved_errno);
  }
  stage->created = false;
  return valid;
}

static bool
setfarm_create_stage_v2(
  const setfarm_content_store_children_v2 *children,
  const setfarm_content_store_request_v2 *request,
  const char *stage_name,
  uid_t owner_uid,
  gid_t owner_gid,
  setfarm_content_store_stage_v2 *stage,
  int *system_errno)
{
  struct stat path_status;
  if (strlen(stage_name) > SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2) {
    *system_errno = ENAMETOOLONG;
    return false;
  }
  memcpy(stage->name, stage_name, strlen(stage_name) + 1);
  if (mkdirat(children->staging_fd, stage->name, SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2) != 0) {
    *system_errno = errno;
    return false;
  }
  stage->created = true;
  errno = 0;
  stage->root_fd = openat(
    children->staging_fd, stage->name,
    O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (stage->root_fd < 0 ||
      fchmod(stage->root_fd, SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2) != 0 ||
      fstat(stage->root_fd, &stage->root_status) != 0 ||
      fstatat(
        children->staging_fd, stage->name, &path_status,
        AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_same_snapshot_v2(&stage->root_status, &path_status) ||
      !S_ISDIR(stage->root_status.st_mode) ||
      stage->root_status.st_uid != owner_uid || stage->root_status.st_gid != owner_gid ||
      setfarm_mode_v2(&stage->root_status) != (uint32_t)0700) {
    *system_errno = errno == 0 ? 0 : errno;
    return false;
  }
  if (mkdirat(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2,
        SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2) != 0) {
    *system_errno = errno;
    return false;
  }
  stage->release_created = true;
  errno = 0;
  stage->release_fd = openat(
    stage->root_fd, SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2,
    O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (stage->release_fd < 0 ||
      fchmod(stage->release_fd, SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2) != 0 ||
      fstat(stage->release_fd, &stage->release_status) != 0 ||
      fstatat(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_RELEASE_NAME_V2,
        &path_status, AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_same_snapshot_v2(&stage->release_status, &path_status) ||
      !S_ISDIR(stage->release_status.st_mode) ||
      stage->release_status.st_uid != owner_uid ||
      stage->release_status.st_gid != owner_gid ||
      setfarm_mode_v2(&stage->release_status) != (uint32_t)0700) {
    *system_errno = errno == 0 ? 0 : errno;
    return false;
  }
  if (!setfarm_write_exact_file_v2(
        stage->release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
        request->manifest_bytes, request->manifest_byte_length,
        owner_uid, owner_gid, &stage->manifest_status,
        &stage->manifest_created, system_errno)) {
    return false;
  }
  if (!setfarm_write_exact_file_v2(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        request->attestation_bytes, request->attestation_byte_length,
        owner_uid, owner_gid, &stage->attestation_status,
        &stage->attestation_created, system_errno)) {
    return false;
  }
  return setfarm_full_sync_v2(stage->release_fd, system_errno) &&
    setfarm_full_sync_v2(stage->root_fd, system_errno) &&
    setfarm_full_sync_v2(children->staging_fd, system_errno);
}

static bool
setfarm_open_release_v2(
  int releases_fd,
  const char *manifest_hash,
  uid_t owner_uid,
  gid_t owner_gid,
  int *release_fd_out,
  struct stat *release_status_out,
  int *system_errno)
{
  struct stat path_status;
  int descriptor = openat(
    releases_fd, manifest_hash,
    O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (descriptor < 0 || fstat(descriptor, release_status_out) != 0 ||
      fstatat(
        releases_fd, manifest_hash, &path_status,
        AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    if (descriptor >= 0) {
      (void)close(descriptor);
    }
    return false;
  }
  if (!S_ISDIR(release_status_out->st_mode) ||
      !setfarm_same_snapshot_v2(release_status_out, &path_status) ||
      release_status_out->st_uid != owner_uid ||
      release_status_out->st_gid != owner_gid ||
      setfarm_mode_v2(release_status_out) != (uint32_t)0555) {
    *system_errno = 0;
    (void)close(descriptor);
    return false;
  }
  *release_fd_out = descriptor;
  return true;
}

static bool
setfarm_validate_release_v2(
  int releases_fd,
  const char *manifest_hash,
  const setfarm_content_store_request_v2 *request,
  uid_t owner_uid,
  gid_t owner_gid,
  struct stat *release_status_out,
  struct stat *manifest_status_out,
  int *system_errno)
{
  const char *names[] = { SETFARM_CONTENT_STORE_MANIFEST_NAME_V2 };
  int release_fd = -1;
  struct stat release_status;
  struct stat manifest_status;
  struct stat manifest_path_status;
  bool valid = setfarm_open_release_v2(
    releases_fd, manifest_hash, owner_uid, owner_gid,
    &release_fd, &release_status, system_errno);
  if (valid) {
    valid = setfarm_directory_has_names_v2(
      release_fd, names, 1, true, system_errno);
  }
  if (valid) {
    valid = setfarm_read_exact_file_v2(
      release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
      request->manifest_bytes, request->manifest_byte_length,
      owner_uid, owner_gid, &manifest_status, system_errno);
  }
  if (valid) {
    valid = setfarm_revalidate_directory_entry_v2(
      releases_fd, manifest_hash, release_fd, &release_status,
      owner_uid, owner_gid, (uint32_t)0555, &release_status, system_errno);
  }
  if (valid) {
    valid = setfarm_directory_has_names_v2(
      release_fd, names, 1, true, system_errno);
  }
  if (valid &&
      fstatat(
        release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
        &manifest_path_status, AT_SYMLINK_NOFOLLOW) != 0) {
    *system_errno = errno;
    valid = false;
  }
  if (valid &&
      !setfarm_same_snapshot_v2(&manifest_status, &manifest_path_status)) {
    *system_errno = 0;
    valid = false;
  }
  if (valid) {
    *release_status_out = release_status;
    *manifest_status_out = manifest_status;
  }
  if (release_fd >= 0 && close(release_fd) != 0 && valid) {
    *system_errno = errno;
    valid = false;
  }
  return valid;
}

static bool
setfarm_validate_attestation_v2(
  int attestations_fd,
  const char *attestation_name,
  const setfarm_content_store_request_v2 *request,
  uid_t owner_uid,
  gid_t owner_gid,
  struct stat *status_out,
  int *system_errno)
{
  if (!setfarm_read_exact_file_v2(
        attestations_fd, attestation_name,
        request->attestation_bytes, request->attestation_byte_length,
        owner_uid, owner_gid, status_out, system_errno)) {
    return false;
  }
  return true;
}

static bool
setfarm_validate_store_census_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  const char *content_lease_name,
  const char *attestation_lease_name,
  bool leases_present,
  const char *manifest_hash,
  bool release_present,
  const char *attestation_name,
  bool attestation_present,
  int *system_errno)
{
  const char *root_names[] = {
    SETFARM_CONTENT_STORE_LOCKS_NAME_V2,
    SETFARM_CONTENT_STORE_STAGING_NAME_V2,
    SETFARM_CONTENT_STORE_RELEASES_NAME_V2,
    SETFARM_CONTENT_STORE_ATTESTATIONS_NAME_V2
  };
  const char *lock_names[] = { content_lease_name, attestation_lease_name };
  const char *release_names[] = { manifest_hash };
  const char *attestation_names[] = { attestation_name };
  return setfarm_directory_has_names_v2(
      root_fd, root_names, 4, true, system_errno) &&
    setfarm_directory_has_names_v2(
      children->locks_fd, leases_present ? lock_names : NULL,
      leases_present ? 2 : 0, true, system_errno) &&
    setfarm_directory_has_names_v2(
      children->staging_fd, NULL, 0, true, system_errno) &&
    setfarm_directory_has_names_v2(
      children->releases_fd, release_present ? release_names : NULL,
      release_present ? 1 : 0, true, system_errno) &&
    setfarm_directory_has_names_v2(
      children->attestations_fd,
      attestation_present ? attestation_names : NULL,
      attestation_present ? 1 : 0, true, system_errno);
}

static bool
setfarm_capture_final_store_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  const setfarm_content_store_request_v2 *request,
  const char *manifest_hash,
  const char *attestation_name,
  uid_t owner_uid,
  gid_t owner_gid,
  bool release_was_published,
  bool attestation_was_published,
  const setfarm_content_store_stage_v2 *stage,
  setfarm_content_store_result_v2 *result,
  int *system_errno)
{
  struct stat root_first;
  struct stat locks_first;
  struct stat staging_first;
  struct stat releases_first;
  struct stat attestations_first;
  struct stat release_first;
  struct stat manifest_first;
  struct stat attestation_first;
  struct stat root_second;
  struct stat locks_second;
  struct stat staging_second;
  struct stat releases_second;
  struct stat attestations_second;
  struct stat release_second;
  struct stat manifest_second;
  struct stat attestation_second;
  if (fstat(root_fd, &root_first) != 0 ||
      fstat(children->locks_fd, &locks_first) != 0 ||
      fstat(children->staging_fd, &staging_first) != 0 ||
      fstat(children->releases_fd, &releases_first) != 0 ||
      fstat(children->attestations_fd, &attestations_first) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!setfarm_validate_store_census_v2(
        root_fd, children, NULL, NULL, false, manifest_hash, true,
        attestation_name, true, system_errno) ||
      !setfarm_revalidate_children_v2(root_fd, children, system_errno) ||
      !setfarm_validate_release_v2(
        children->releases_fd, manifest_hash, request,
        owner_uid, owner_gid,
        &release_first, &manifest_first, system_errno) ||
      !setfarm_validate_attestation_v2(
        children->attestations_fd, attestation_name, request,
        owner_uid, owner_gid,
        &attestation_first, system_errno) ||
      !setfarm_validate_store_census_v2(
        root_fd, children, NULL, NULL, false, manifest_hash, true,
        attestation_name, true, system_errno) ||
      !setfarm_revalidate_children_v2(root_fd, children, system_errno) ||
      !setfarm_validate_release_v2(
        children->releases_fd, manifest_hash, request,
        owner_uid, owner_gid,
        &release_second, &manifest_second, system_errno) ||
      !setfarm_validate_attestation_v2(
        children->attestations_fd, attestation_name, request,
        owner_uid, owner_gid,
        &attestation_second, system_errno) ||
      !setfarm_validate_store_census_v2(
        root_fd, children, NULL, NULL, false, manifest_hash, true,
        attestation_name, true, system_errno) ||
      !setfarm_revalidate_children_v2(root_fd, children, system_errno)) {
    return false;
  }
  if (fstat(root_fd, &root_second) != 0 ||
      fstat(children->locks_fd, &locks_second) != 0 ||
      fstat(children->staging_fd, &staging_second) != 0 ||
      fstat(children->releases_fd, &releases_second) != 0 ||
      fstat(children->attestations_fd, &attestations_second) != 0) {
    *system_errno = errno;
    return false;
  }
  if (!setfarm_same_snapshot_v2(&root_first, &root_second) ||
      !setfarm_same_snapshot_v2(&locks_first, &locks_second) ||
      !setfarm_same_snapshot_v2(&staging_first, &staging_second) ||
      !setfarm_same_snapshot_v2(&releases_first, &releases_second) ||
      !setfarm_same_snapshot_v2(
        &attestations_first, &attestations_second) ||
      !setfarm_same_snapshot_v2(&release_first, &release_second) ||
      !setfarm_same_snapshot_v2(&manifest_first, &manifest_second) ||
      !setfarm_same_snapshot_v2(
        &attestation_first, &attestation_second)) {
    *system_errno = 0;
    return false;
  }
  if ((release_was_published &&
       !setfarm_same_object_v2(&manifest_second, &stage->manifest_status)) ||
      (attestation_was_published &&
       !setfarm_same_object_v2(
         &attestation_second, &stage->attestation_status))) {
    *system_errno = 0;
    return false;
  }
  if (!setfarm_matches_expected_directory_v2(
        &root_second, &request->root, (uint32_t)0700) ||
      !setfarm_matches_expected_directory_v2(
        &locks_second, &request->locks, (uint32_t)0700) ||
      !setfarm_matches_expected_directory_v2(
        &staging_second, &request->staging, (uint32_t)0700) ||
      !setfarm_matches_expected_directory_v2(
        &releases_second, &request->releases, (uint32_t)0700) ||
      !setfarm_matches_expected_directory_v2(
        &attestations_second, &request->attestations, (uint32_t)0700)) {
    *system_errno = 0;
    return false;
  }
  setfarm_fill_evidence_v2(&root_second, &result->root);
  setfarm_fill_evidence_v2(&locks_second, &result->locks);
  setfarm_fill_evidence_v2(&staging_second, &result->staging);
  setfarm_fill_evidence_v2(&releases_second, &result->releases);
  setfarm_fill_evidence_v2(&attestations_second, &result->attestations);
  setfarm_fill_evidence_v2(&release_second, &result->release_root);
  setfarm_fill_evidence_v2(&manifest_second, &result->manifest);
  setfarm_fill_evidence_v2(&attestation_second, &result->attestation);
  return true;
}

static setfarm_content_store_error_v2
setfarm_publish_new_release_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  const setfarm_content_store_request_v2 *request,
  const char *manifest_hash,
  uid_t owner_uid,
  gid_t owner_gid,
  setfarm_content_store_stage_v2 *stage,
  setfarm_content_store_checkpoint_hook_v2 hook,
  void *hook_context,
  setfarm_content_store_result_v2 *result,
  setfarm_content_store_failure_v2 *failure)
{
  int release_fd = -1;
  int stage_manifest_fd = -1;
  int saved_errno = 0;
  struct stat release_path_status;
  struct stat release_status;
  struct stat manifest_status;
  if (!setfarm_revalidate_children_v2(root_fd, children, &saved_errno)) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_RELEASE_RESERVATION_V2,
    hook, hook_context, failure);
  if (mkdirat(
        children->releases_fd, manifest_hash,
        SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2) != 0) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_PUBLICATION_FAILED_V2, errno);
  }
  errno = 0;
  release_fd = openat(
    children->releases_fd, manifest_hash,
    O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (release_fd < 0 ||
      fchmod(release_fd, SETFARM_CONTENT_STORE_DIRECTORY_MODE_V2) != 0 ||
      fstat(release_fd, &release_status) != 0 ||
      fstatat(
        children->releases_fd, manifest_hash, &release_path_status,
        AT_SYMLINK_NOFOLLOW) != 0 ||
      !setfarm_same_snapshot_v2(&release_status, &release_path_status) ||
      !S_ISDIR(release_status.st_mode) || release_status.st_uid != owner_uid ||
      release_status.st_gid != owner_gid ||
      setfarm_mode_v2(&release_status) != (uint32_t)0700) {
    saved_errno = errno == 0 ? 0 : errno;
    if (release_fd >= 0) {
      (void)close(release_fd);
    }
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_PUBLICATION_FAILED_V2,
      saved_errno);
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_RELEASE_RESERVATION_V2,
    hook, hook_context, failure);
  if (!setfarm_revalidate_children_v2(root_fd, children, &saved_errno) ||
      !setfarm_revalidate_directory_entry_v2(
        children->releases_fd, manifest_hash, release_fd, &release_status,
        owner_uid, owner_gid, (uint32_t)0700, NULL, &saved_errno)) {
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_open_exact_staged_file_v2(
        stage->release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
        &stage->manifest_status, owner_uid, owner_gid,
        request->manifest_byte_length, &stage_manifest_fd, &saved_errno)) {
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_revalidate_open_staged_file_v2(
        stage_manifest_fd, stage->release_fd,
        SETFARM_CONTENT_STORE_MANIFEST_NAME_V2, &stage->manifest_status,
        owner_uid, owner_gid, request->manifest_byte_length,
        &saved_errno) ||
      !setfarm_revalidate_children_v2(root_fd, children, &saved_errno) ||
      !setfarm_revalidate_directory_entry_v2(
        children->releases_fd, manifest_hash, release_fd, &release_status,
        owner_uid, owner_gid, (uint32_t)0700, NULL, &saved_errno)) {
    (void)close(stage_manifest_fd);
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_MANIFEST_LINK_V2,
    hook, hook_context, failure);
  if (linkat(
        stage->release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
        release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2, 0) != 0) {
    saved_errno = errno;
    (void)close(stage_manifest_fd);
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_PUBLICATION_FAILED_V2,
      saved_errno);
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_MANIFEST_LINK_V2,
    hook, hook_context, failure);
  if (!setfarm_validate_link_pair_v2(
        stage_manifest_fd, stage->release_fd,
        SETFARM_CONTENT_STORE_MANIFEST_NAME_V2, release_fd,
        SETFARM_CONTENT_STORE_MANIFEST_NAME_V2, &stage->manifest_status,
        owner_uid, owner_gid, request->manifest_byte_length, &saved_errno)) {
    (void)close(stage_manifest_fd);
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  if (unlinkat(
        stage->release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2, 0) != 0) {
    saved_errno = errno;
    (void)close(stage_manifest_fd);
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_PUBLICATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_validate_unlinked_stage_target_v2(
        stage_manifest_fd, release_fd,
        SETFARM_CONTENT_STORE_MANIFEST_NAME_V2, &stage->manifest_status,
        owner_uid, owner_gid, request->manifest_byte_length,
        &manifest_status, &saved_errno)) {
    (void)close(stage_manifest_fd);
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  if (close(stage_manifest_fd) != 0) {
    saved_errno = errno;
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  stage_manifest_fd = -1;
  if (fchmod(release_fd, SETFARM_CONTENT_STORE_RELEASE_MODE_V2) != 0 ||
      !setfarm_full_sync_v2(release_fd, &saved_errno) ||
      !setfarm_full_sync_v2(children->releases_fd, &saved_errno)) {
    saved_errno = errno == 0 ? saved_errno : errno;
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_SYNC_FAILED_V2, saved_errno);
  }
  if (!setfarm_read_exact_file_v2(
        release_fd, SETFARM_CONTENT_STORE_MANIFEST_NAME_V2,
        request->manifest_bytes, request->manifest_byte_length,
        owner_uid, owner_gid, &manifest_status, &saved_errno)) {
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_INVALID_V2, saved_errno);
  }
  if (!setfarm_revalidate_directory_entry_v2(
        children->releases_fd, manifest_hash, release_fd, &release_status,
        owner_uid, owner_gid, (uint32_t)0555, &release_status,
        &saved_errno)) {
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  if (fstat(release_fd, &release_status) != 0) {
    saved_errno = errno;
    (void)close(release_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_INVALID_V2, saved_errno);
  }
  result->release_disposition = SETFARM_CONTENT_STORE_PUBLICATION_PUBLISHED_V2;
  if (close(release_fd) != 0) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_INVALID_V2, errno);
  }
  stage->manifest_created = false;
  return SETFARM_CONTENT_STORE_OK_V2;
}

static setfarm_content_store_error_v2
setfarm_publish_new_attestation_v2(
  int root_fd,
  const setfarm_content_store_children_v2 *children,
  const setfarm_content_store_request_v2 *request,
  const char *attestation_name,
  uid_t owner_uid,
  gid_t owner_gid,
  setfarm_content_store_stage_v2 *stage,
  setfarm_content_store_checkpoint_hook_v2 hook,
  void *hook_context,
  setfarm_content_store_result_v2 *result,
  setfarm_content_store_failure_v2 *failure)
{
  int stage_attestation_fd = -1;
  int saved_errno = 0;
  struct stat attestation_status;
  if (!setfarm_revalidate_children_v2(root_fd, children, &saved_errno)) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_open_exact_staged_file_v2(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        &stage->attestation_status, owner_uid, owner_gid,
        request->attestation_byte_length, &stage_attestation_fd,
        &saved_errno)) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_revalidate_open_staged_file_v2(
        stage_attestation_fd, stage->root_fd,
        SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        &stage->attestation_status, owner_uid, owner_gid,
        request->attestation_byte_length, &saved_errno) ||
      !setfarm_revalidate_children_v2(root_fd, children, &saved_errno)) {
    (void)close(stage_attestation_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_ATTESTATION_LINK_V2,
    hook, hook_context, failure);
  if (linkat(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        children->attestations_fd, attestation_name, 0) != 0) {
    saved_errno = errno;
    (void)close(stage_attestation_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ATTESTATION_PUBLICATION_FAILED_V2,
      saved_errno);
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_ATTESTATION_LINK_V2,
    hook, hook_context, failure);
  if (!setfarm_validate_link_pair_v2(
        stage_attestation_fd, stage->root_fd,
        SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        children->attestations_fd, attestation_name,
        &stage->attestation_status, owner_uid, owner_gid,
        request->attestation_byte_length, &saved_errno)) {
    (void)close(stage_attestation_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  if (unlinkat(
        stage->root_fd, SETFARM_CONTENT_STORE_STAGE_ATTESTATION_NAME_V2,
        0) != 0) {
    saved_errno = errno;
    (void)close(stage_attestation_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ATTESTATION_PUBLICATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_validate_unlinked_stage_target_v2(
        stage_attestation_fd, children->attestations_fd, attestation_name,
        &stage->attestation_status, owner_uid, owner_gid,
        request->attestation_byte_length, &attestation_status,
        &saved_errno)) {
    (void)close(stage_attestation_fd);
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  if (close(stage_attestation_fd) != 0) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, errno);
  }
  stage_attestation_fd = -1;
  if (!setfarm_full_sync_v2(children->attestations_fd, &saved_errno)) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ATTESTATION_PUBLICATION_FAILED_V2,
      saved_errno);
  }
  if (!setfarm_validate_attestation_v2(
        children->attestations_fd, attestation_name, request,
        owner_uid, owner_gid, &attestation_status, &saved_errno)) {
    return setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ATTESTATION_INVALID_V2, saved_errno);
  }
  result->attestation_disposition =
    SETFARM_CONTENT_STORE_PUBLICATION_PUBLISHED_V2;
  stage->attestation_created = false;
  return SETFARM_CONTENT_STORE_OK_V2;
}

setfarm_content_store_error_v2
setfarm_content_store_publish_fixture_v2(
  int inherited_root_fd,
  const setfarm_content_store_request_v2 *request,
  setfarm_content_store_checkpoint_hook_v2 checkpoint_hook,
  void *checkpoint_context,
  setfarm_content_store_result_v2 *result,
  setfarm_content_store_failure_v2 *failure)
{
  int root_fd = -1;
  int saved_errno = 0;
  struct stat root_status;
  struct stat validated_manifest_status;
  setfarm_content_store_owned_request_v2 owned_request;
  const setfarm_content_store_request_v2 *snapshot = &owned_request.value;
  setfarm_content_store_error_v2 capture_error =
    SETFARM_CONTENT_STORE_OK_V2;
  setfarm_content_store_children_v2 children;
  setfarm_content_store_stage_v2 stage;
  setfarm_content_store_lease_v2 content_lease;
  setfarm_content_store_lease_v2 attestation_lease;
  setfarm_content_store_error_v2 code = SETFARM_CONTENT_STORE_OK_V2;
  bool release_exists = false;
  bool attestation_exists = false;
  struct stat release_probe;
  struct stat attestation_probe;
  char manifest_hash[SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2 + 1];
  char attestation_name[SETFARM_CONTENT_STORE_ATTESTATION_NAME_BYTES_V2 + 1];
  char content_lease_name[SETFARM_CONTENT_STORE_CONTENT_LEASE_NAME_BYTES_V2 + 1];
  char attestation_lease_name[
    SETFARM_CONTENT_STORE_ATTESTATION_LEASE_NAME_BYTES_V2 + 1];
  char stage_name[SETFARM_CONTENT_STORE_STAGE_NAME_BYTES_V2 + 1];

  if (result != NULL) {
    memset(result, 0, sizeof(*result));
    result->production_authority =
      (uint32_t)SETFARM_CONTENT_STORE_FILESYSTEM_PRODUCTION_AUTHORITY_V2;
    result->unlink_authority_policy =
      SETFARM_CONTENT_STORE_UNLINK_PRESERVE_UNCERTAIN_IDENTITY_V2;
    result->same_uid_atomic_conditional_unlink_available = 0;
    result->unauthenticated_stale_lease_recovery_enabled = 1;
    result->authenticated_lease_ledger_present = 0;
  }
  if (failure != NULL) {
    setfarm_failure_initialize_v2(failure);
  }
  setfarm_children_initialize_v2(&children);
  setfarm_stage_initialize_v2(&stage);
  setfarm_owned_request_initialize_v2(&owned_request);
  memset(manifest_hash, 0, sizeof(manifest_hash));
  memset(attestation_name, 0, sizeof(attestation_name));
  memset(content_lease_name, 0, sizeof(content_lease_name));
  memset(attestation_lease_name, 0, sizeof(attestation_lease_name));
  memset(stage_name, 0, sizeof(stage_name));

  if (inherited_root_fd < 0 || request == NULL || result == NULL ||
      failure == NULL) {
    return failure == NULL
      ? SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2
      : setfarm_fail_primary_v2(
          failure, SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2, EINVAL);
  }
  if (!setfarm_capture_owned_request_v2(
        request, &owned_request, &capture_error, &saved_errno)) {
    code = setfarm_fail_primary_v2(failure, capture_error, saved_errno);
    setfarm_owned_request_destroy_v2(&owned_request);
    return code;
  }
  if (!setfarm_build_names_v2(
        snapshot, manifest_hash, attestation_name, content_lease_name,
        attestation_lease_name, stage_name)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2, EINVAL);
    setfarm_owned_request_destroy_v2(&owned_request);
    return code;
  }
  setfarm_lease_initialize_v2(
    &content_lease, content_lease_name,
    SETFARM_CONTENT_STORE_LEASE_CONTENT_CHANGED_V2,
    SETFARM_CONTENT_STORE_LEASE_CONTENT_RELEASE_FAILED_V2);
  setfarm_lease_initialize_v2(
    &attestation_lease, attestation_lease_name,
    SETFARM_CONTENT_STORE_LEASE_ATTESTATION_CHANGED_V2,
    SETFARM_CONTENT_STORE_LEASE_ATTESTATION_RELEASE_FAILED_V2);

#if !defined(__APPLE__) || !defined(F_FULLFSYNC)
  code = setfarm_fail_primary_v2(
    failure, SETFARM_CONTENT_STORE_PLATFORM_UNAVAILABLE_V2, ENOTSUP);
  goto finalize;
#else
  errno = 0;
  root_fd = fcntl(inherited_root_fd, F_DUPFD_CLOEXEC, 0);
  if (root_fd < 0) {
    saved_errno = errno;
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ROOT_INVALID_V2, saved_errno);
    goto finalize;
  }
  if (fstat(root_fd, &root_status) != 0) {
    saved_errno = errno;
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ROOT_INVALID_V2, saved_errno);
    goto finalize;
  }
  if (!setfarm_matches_expected_directory_v2(
        &root_status, &snapshot->root, (uint32_t)0700)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ROOT_INVALID_V2, 0);
    goto finalize;
  }
  if (!setfarm_open_child_v2(
        root_fd, SETFARM_CONTENT_STORE_LOCKS_NAME_V2, &snapshot->locks,
        &children.locks_fd, &children.locks_status, &saved_errno) ||
      !setfarm_open_child_v2(
        root_fd, SETFARM_CONTENT_STORE_STAGING_NAME_V2, &snapshot->staging,
        &children.staging_fd, &children.staging_status, &saved_errno) ||
      !setfarm_open_child_v2(
        root_fd, SETFARM_CONTENT_STORE_RELEASES_NAME_V2, &snapshot->releases,
        &children.releases_fd, &children.releases_status, &saved_errno) ||
      !setfarm_open_child_v2(
        root_fd, SETFARM_CONTENT_STORE_ATTESTATIONS_NAME_V2,
        &snapshot->attestations, &children.attestations_fd,
        &children.attestations_status, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_CHILD_INVALID_V2, saved_errno);
    goto finalize;
  }
  if (children.locks_status.st_dev != root_status.st_dev ||
      children.staging_status.st_dev != root_status.st_dev ||
      children.releases_status.st_dev != root_status.st_dev ||
      children.attestations_status.st_dev != root_status.st_dev) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_CHILD_INVALID_V2, EXDEV);
    goto finalize;
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CHILDREN_PINNED_V2,
    checkpoint_hook, checkpoint_context, failure);
  if (!setfarm_revalidate_children_v2(root_fd, &children, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
    goto finalize;
  }
  if (!setfarm_acquire_lease_v2(
        children.locks_fd, content_lease.name,
        root_status.st_uid, root_status.st_gid,
        &content_lease, &saved_errno)) {
    setfarm_fail_lease_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_CONTENT_ACQUIRE_FAILED_V2,
      saved_errno);
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_FAILED_V2, saved_errno);
    goto finalize;
  }
  result->content_lease_acquired = 1;
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CONTENT_LEASE_ACQUIRED_V2,
    checkpoint_hook, checkpoint_context, failure);
  if (!setfarm_revalidate_children_v2(root_fd, &children, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
    goto finalize;
  }
  if (!setfarm_acquire_lease_v2(
        children.locks_fd, attestation_lease.name,
        root_status.st_uid, root_status.st_gid,
        &attestation_lease, &saved_errno)) {
    setfarm_fail_lease_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_ATTESTATION_ACQUIRE_FAILED_V2,
      saved_errno);
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_LEASE_FAILED_V2, saved_errno);
    goto finalize;
  }
  result->attestation_lease_acquired = 1;
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_ATTESTATION_LEASE_ACQUIRED_V2,
    checkpoint_hook, checkpoint_context, failure);
  if (!setfarm_revalidate_children_v2(root_fd, &children, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
    goto finalize;
  }
  if (!setfarm_probe_entry_v2(
        children.releases_fd, manifest_hash, &release_exists,
        &release_probe, &saved_errno) ||
      !setfarm_probe_entry_v2(
        children.attestations_fd, attestation_name, &attestation_exists,
        &attestation_probe, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
    goto finalize;
  }
  if (release_exists && !S_ISDIR(release_probe.st_mode)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_INVALID_V2, 0);
    goto finalize;
  }
  if (attestation_exists && !S_ISREG(attestation_probe.st_mode)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ATTESTATION_INVALID_V2, 0);
    goto finalize;
  }
  if (!setfarm_validate_store_census_v2(
        root_fd, &children, content_lease.name, attestation_lease.name, true,
        manifest_hash, release_exists, attestation_name, attestation_exists,
        &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_STATE_CONFLICT_V2, saved_errno);
    goto finalize;
  }
  if (release_exists != attestation_exists) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_STATE_CONFLICT_V2, 0);
    goto finalize;
  }
  if (release_exists && !setfarm_validate_release_v2(
        children.releases_fd, manifest_hash, snapshot,
        root_status.st_uid, root_status.st_gid, &release_probe,
        &validated_manifest_status, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_RELEASE_INVALID_V2, saved_errno);
    goto finalize;
  }
  if (release_exists) {
    result->release_disposition =
      SETFARM_CONTENT_STORE_PUBLICATION_ADOPTED_IDENTICAL_V2;
  }
  if (attestation_exists && !setfarm_validate_attestation_v2(
        children.attestations_fd, attestation_name, snapshot,
        root_status.st_uid, root_status.st_gid, &attestation_probe,
        &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_ATTESTATION_INVALID_V2, saved_errno);
    goto finalize;
  }
  if (attestation_exists) {
    result->attestation_disposition =
      SETFARM_CONTENT_STORE_PUBLICATION_ADOPTED_IDENTICAL_V2;
  }
  if (!release_exists || !attestation_exists) {
    if (!setfarm_create_stage_v2(
          &children, snapshot, stage_name, root_status.st_uid,
          root_status.st_gid, &stage, &saved_errno)) {
      code = setfarm_fail_primary_v2(
        failure, SETFARM_CONTENT_STORE_STAGE_FAILED_V2, saved_errno);
      goto finalize;
    }
    setfarm_checkpoint_v2(
      SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_STAGE_DURABLE_V2,
      checkpoint_hook, checkpoint_context, failure);
  }
  if (!release_exists) {
    code = setfarm_publish_new_release_v2(
      root_fd, &children, snapshot, manifest_hash, root_status.st_uid,
      root_status.st_gid, &stage, checkpoint_hook, checkpoint_context,
      result, failure);
    if (code != SETFARM_CONTENT_STORE_OK_V2) {
      goto finalize;
    }
  }
  if (!attestation_exists) {
    code = setfarm_publish_new_attestation_v2(
      root_fd, &children, snapshot, attestation_name, root_status.st_uid,
      root_status.st_gid, &stage, checkpoint_hook, checkpoint_context,
      result, failure);
    if (code != SETFARM_CONTENT_STORE_OK_V2) {
      goto finalize;
    }
  }
  if (!setfarm_full_sync_v2(root_fd, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_SYNC_FAILED_V2, saved_errno);
    goto finalize;
  }
  if (!setfarm_revalidate_children_v2(root_fd, &children, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
    goto finalize;
  }
#endif

finalize:
  if (stage.created) {
    setfarm_checkpoint_v2(
      SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_STAGE_CLEANUP_V2,
      checkpoint_hook, checkpoint_context, failure);
    if (!setfarm_cleanup_stage_v2(root_fd, &children, &stage, failure) &&
        code == SETFARM_CONTENT_STORE_OK_V2) {
      code = SETFARM_CONTENT_STORE_CLEANUP_FAILED_V2;
    }
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_BEFORE_LEASE_RELEASE_V2,
    checkpoint_hook, checkpoint_context, failure);
  if (!setfarm_release_lease_v2(
        root_fd, &children, &attestation_lease, failure) &&
      code == SETFARM_CONTENT_STORE_OK_V2) {
    code = SETFARM_CONTENT_STORE_LEASE_FAILED_V2;
  }
  if (!setfarm_release_lease_v2(
        root_fd, &children, &content_lease, failure) &&
      code == SETFARM_CONTENT_STORE_OK_V2) {
    code = SETFARM_CONTENT_STORE_LEASE_FAILED_V2;
  }
  if (failure != NULL &&
      failure->cleanup_code != SETFARM_CONTENT_STORE_CLEANUP_OK_V2 &&
      code == SETFARM_CONTENT_STORE_OK_V2) {
    code = SETFARM_CONTENT_STORE_CLEANUP_FAILED_V2;
  }
  if (failure != NULL &&
      failure->lease_code != SETFARM_CONTENT_STORE_LEASE_OK_V2 &&
      code == SETFARM_CONTENT_STORE_OK_V2) {
    code = SETFARM_CONTENT_STORE_LEASE_FAILED_V2;
  }
  setfarm_checkpoint_v2(
    SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CLEANUP_V2,
    checkpoint_hook, checkpoint_context, failure);
  if (code == SETFARM_CONTENT_STORE_OK_V2 &&
      !setfarm_capture_final_store_v2(
        root_fd, &children, snapshot, manifest_hash, attestation_name,
        root_status.st_uid, root_status.st_gid, !release_exists,
        !attestation_exists, &stage, result, &saved_errno)) {
    code = setfarm_fail_primary_v2(
      failure, SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2, saved_errno);
  }
  if (code == SETFARM_CONTENT_STORE_OK_V2) {
    result->release_disposition = release_exists
      ? SETFARM_CONTENT_STORE_PUBLICATION_ADOPTED_IDENTICAL_V2
      : SETFARM_CONTENT_STORE_PUBLICATION_PUBLISHED_V2;
    result->attestation_disposition = attestation_exists
      ? SETFARM_CONTENT_STORE_PUBLICATION_ADOPTED_IDENTICAL_V2
      : SETFARM_CONTENT_STORE_PUBLICATION_PUBLISHED_V2;
    result->content_lease_acquired = 1;
    result->attestation_lease_acquired = 1;
    result->stage_cleaned = 1;
    result->leases_released = 1;
  }
  if (result != NULL) {
    result->production_authority =
      (uint32_t)SETFARM_CONTENT_STORE_FILESYSTEM_PRODUCTION_AUTHORITY_V2;
    result->unlink_authority_policy =
      SETFARM_CONTENT_STORE_UNLINK_PRESERVE_UNCERTAIN_IDENTITY_V2;
    result->same_uid_atomic_conditional_unlink_available = 0;
    result->content_lease_recovered = content_lease.recovered_stale ? 1U : 0U;
    result->attestation_lease_recovered =
      attestation_lease.recovered_stale ? 1U : 0U;
    result->unauthenticated_stale_lease_recovery_enabled = 1;
    result->authenticated_lease_ledger_present = 0;
  }
  if (stage.release_fd >= 0) {
    (void)close(stage.release_fd);
  }
  if (stage.root_fd >= 0) {
    (void)close(stage.root_fd);
  }
  if (children.attestations_fd >= 0) {
    (void)close(children.attestations_fd);
  }
  if (children.releases_fd >= 0) {
    (void)close(children.releases_fd);
  }
  if (children.staging_fd >= 0) {
    (void)close(children.staging_fd);
  }
  if (children.locks_fd >= 0) {
    (void)close(children.locks_fd);
  }
  if (root_fd >= 0) {
    (void)close(root_fd);
  }
  setfarm_zero_v2(manifest_hash, sizeof(manifest_hash));
  setfarm_zero_v2(attestation_name, sizeof(attestation_name));
  setfarm_zero_v2(content_lease_name, sizeof(content_lease_name));
  setfarm_zero_v2(attestation_lease_name, sizeof(attestation_lease_name));
  setfarm_zero_v2(stage_name, sizeof(stage_name));
  setfarm_owned_request_destroy_v2(&owned_request);
  return code;
}

const char *
setfarm_content_store_error_name_v2(setfarm_content_store_error_v2 code)
{
  switch (code) {
  case SETFARM_CONTENT_STORE_OK_V2: return "ok";
  case SETFARM_CONTENT_STORE_INVALID_ARGUMENT_V2: return "invalid_argument";
  case SETFARM_CONTENT_STORE_PLATFORM_UNAVAILABLE_V2: return "platform_unavailable";
  case SETFARM_CONTENT_STORE_ROOT_INVALID_V2: return "root_invalid";
  case SETFARM_CONTENT_STORE_CHILD_INVALID_V2: return "child_invalid";
  case SETFARM_CONTENT_STORE_BOUND_EXCEEDED_V2: return "bound_exceeded";
  case SETFARM_CONTENT_STORE_STATE_CONFLICT_V2: return "state_conflict";
  case SETFARM_CONTENT_STORE_STAGE_FAILED_V2: return "stage_failed";
  case SETFARM_CONTENT_STORE_RELEASE_INVALID_V2: return "release_invalid";
  case SETFARM_CONTENT_STORE_RELEASE_PUBLICATION_FAILED_V2: return "release_publication_failed";
  case SETFARM_CONTENT_STORE_ATTESTATION_INVALID_V2: return "attestation_invalid";
  case SETFARM_CONTENT_STORE_ATTESTATION_PUBLICATION_FAILED_V2: return "attestation_publication_failed";
  case SETFARM_CONTENT_STORE_REVALIDATION_FAILED_V2: return "revalidation_failed";
  case SETFARM_CONTENT_STORE_SYNC_FAILED_V2: return "sync_failed";
  case SETFARM_CONTENT_STORE_CLEANUP_FAILED_V2: return "cleanup_failed";
  case SETFARM_CONTENT_STORE_LEASE_FAILED_V2: return "lease_failed";
  }
  return "unknown";
}

const char *
setfarm_content_store_cleanup_code_name_v2(
  setfarm_content_store_cleanup_code_v2 code)
{
  switch (code) {
  case SETFARM_CONTENT_STORE_CLEANUP_OK_V2: return "ok";
  case SETFARM_CONTENT_STORE_CLEANUP_STAGE_IDENTITY_CHANGED_V2: return "stage_identity_changed";
  case SETFARM_CONTENT_STORE_CLEANUP_STAGE_SHAPE_INVALID_V2: return "stage_shape_invalid";
  case SETFARM_CONTENT_STORE_CLEANUP_ENTRY_IDENTITY_CHANGED_V2: return "entry_identity_changed";
  case SETFARM_CONTENT_STORE_CLEANUP_ENTRY_UNLINK_FAILED_V2: return "entry_unlink_failed";
  case SETFARM_CONTENT_STORE_CLEANUP_DIRECTORY_REMOVE_FAILED_V2: return "directory_remove_failed";
  case SETFARM_CONTENT_STORE_CLEANUP_PARENT_CHANGED_V2: return "parent_changed";
  case SETFARM_CONTENT_STORE_CLEANUP_SYNC_FAILED_V2: return "sync_failed";
  }
  return "unknown";
}

const char *
setfarm_content_store_lease_code_name_v2(
  setfarm_content_store_lease_code_v2 code)
{
  switch (code) {
  case SETFARM_CONTENT_STORE_LEASE_OK_V2: return "ok";
  case SETFARM_CONTENT_STORE_LEASE_CONTENT_ACQUIRE_FAILED_V2: return "content_acquire_failed";
  case SETFARM_CONTENT_STORE_LEASE_ATTESTATION_ACQUIRE_FAILED_V2: return "attestation_acquire_failed";
  case SETFARM_CONTENT_STORE_LEASE_CONTENT_CHANGED_V2: return "content_changed";
  case SETFARM_CONTENT_STORE_LEASE_ATTESTATION_CHANGED_V2: return "attestation_changed";
  case SETFARM_CONTENT_STORE_LEASE_CONTENT_RELEASE_FAILED_V2: return "content_release_failed";
  case SETFARM_CONTENT_STORE_LEASE_ATTESTATION_RELEASE_FAILED_V2: return "attestation_release_failed";
  case SETFARM_CONTENT_STORE_LEASE_PARENT_CHANGED_V2: return "parent_changed";
  case SETFARM_CONTENT_STORE_LEASE_SYNC_FAILED_V2: return "sync_failed";
  }
  return "unknown";
}
