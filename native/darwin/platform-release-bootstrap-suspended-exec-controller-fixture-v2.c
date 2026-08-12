#include <CommonCrypto/CommonDigest.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <libproc.h>
#include <poll.h>
#include <signal.h>
#include <spawn.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/proc_info.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

/*
 * Test-only Darwin characterization.  posix_spawn still resolves a pathname;
 * this program never claims descriptor execution or production authority.
 */
#define SETFARM_EXEC_MAX_BYTES_V2 ((off_t)64 * (off_t)1024 * (off_t)1024)
#define SETFARM_PATH_MAX_V2 ((size_t)4095)
#define SETFARM_OUTPUT_MAX_V2 ((size_t)512)
#define SETFARM_REGION_MAX_V2 ((size_t)4096)
#define SETFARM_OBSERVATION_POLLS_V2 ((size_t)1000)
#define SETFARM_STOP_POLLS_V2 ((size_t)200)
#define SETFARM_RUN_POLLS_V2 ((size_t)400)
#define SETFARM_REAP_POLLS_V2 ((size_t)200)
#define SETFARM_POLL_NANOSECONDS_V2 ((long)5 * (long)1000 * (long)1000)
#define SETFARM_CDHASH_MAX_V2 ((size_t)128)

typedef enum setfarm_mode_v2 {
  SETFARM_MODE_BASELINE_V2,
  SETFARM_MODE_PRE_SPAWN_REPLACEMENT_V2,
  SETFARM_MODE_POST_SPAWN_RENAME_V2,
  SETFARM_MODE_POST_RESUME_DRIFT_V2,
  SETFARM_MODE_SECURITY_OBSERVATION_FAILURE_V2,
  SETFARM_MODE_MALFORMED_V2,
  SETFARM_MODE_TIMEOUT_V2,
  SETFARM_MODE_CANARY_THEN_NONZERO_EXIT_V2,
  SETFARM_MODE_CANARY_THEN_SIGNAL_V2
} setfarm_mode_v2;

typedef struct setfarm_file_evidence_v2 {
  struct stat status;
  char content_hash[65];
} setfarm_file_evidence_v2;

typedef struct setfarm_mapped_evidence_v2 {
  bool matched;
  size_t matching_region_count;
  size_t region_count;
  struct vinfo_stat status;
} setfarm_mapped_evidence_v2;

typedef struct setfarm_security_evidence_v2 {
  OSStatus guest_lookup_status;
  OSStatus validity_status;
  OSStatus signing_information_status;
  uint64_t dynamic_status_flags;
  uint64_t digest_algorithm;
  uint64_t signing_information_flags;
  bool dynamic_status_present;
  bool signing_information_flags_present;
  bool observed_before_resume;
  bool has_cms;
  bool has_identifier;
  uint8_t cdhash[SETFARM_CDHASH_MAX_V2];
  size_t cdhash_length;
} setfarm_security_evidence_v2;

typedef struct setfarm_process_evidence_v2 {
  int exit_code;
  bool held_post_execution_unchanged;
  bool reaped;
  bool sigcont_sent;
  bool sigkill_sent;
  bool target_canary_observed;
  const char *target_output_state;
  const char *termination_kind;
  int termination_signal;
} setfarm_process_evidence_v2;

extern char **environ;

static void
setfarm_zero_v2(void *memory, size_t length)
{
  volatile uint8_t *cursor = (volatile uint8_t *)memory;
  while (length > 0) {
    *cursor = 0;
    cursor += 1;
    length -= 1;
  }
}

static void
setfarm_sleep_poll_v2(void)
{
  struct timespec request = {
    .tv_sec = 0,
    .tv_nsec = SETFARM_POLL_NANOSECONDS_V2
  };
  while (nanosleep(&request, &request) != 0 && errno == EINTR) {
  }
}

static bool
setfarm_write_all_v2(int descriptor, const void *bytes, size_t length)
{
  const uint8_t *cursor = (const uint8_t *)bytes;
  while (length > 0) {
    ssize_t count = write(descriptor, cursor, length);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      return false;
    }
    cursor += (size_t)count;
    length -= (size_t)count;
  }
  return true;
}

static bool
setfarm_exact_hex_v2(const char *text, size_t byte_length)
{
  if (text == NULL || strlen(text) != byte_length * 2) {
    return false;
  }
  for (size_t index = 0; index < byte_length * 2; index += 1) {
    const char value = text[index];
    if (!((value >= '0' && value <= '9') || (value >= 'a' && value <= 'f'))) {
      return false;
    }
  }
  return true;
}

static bool
setfarm_exact_absolute_path_v2(const char *path)
{
  if (path == NULL || path[0] != '/') {
    return false;
  }
  const size_t length = strnlen(path, SETFARM_PATH_MAX_V2 + 1);
  if (length < 2 || length > SETFARM_PATH_MAX_V2) {
    return false;
  }
  for (size_t index = 0; index < length; index += 1) {
    if (path[index] == '\n' || path[index] == '\r') {
      return false;
    }
  }
  return true;
}

static void
setfarm_hex_v2(const uint8_t *bytes, size_t length, char *output)
{
  static const char digits[] = "0123456789abcdef";
  for (size_t index = 0; index < length; index += 1) {
    output[index * 2] = digits[(bytes[index] >> 4) & 0x0f];
    output[index * 2 + 1] = digits[bytes[index] & 0x0f];
  }
  output[length * 2] = '\0';
}

static bool
setfarm_hash_descriptor_v2(int descriptor, char output[65])
{
  if (lseek(descriptor, 0, SEEK_SET) != 0) {
    return false;
  }
  CC_SHA256_CTX context;
  if (CC_SHA256_Init(&context) != 1) {
    return false;
  }
  uint8_t buffer[64 * 1024];
  for (;;) {
    ssize_t count = read(descriptor, buffer, sizeof(buffer));
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0) {
      setfarm_zero_v2(buffer, sizeof(buffer));
      return false;
    }
    if (count == 0) {
      break;
    }
    if (CC_SHA256_Update(&context, buffer, (CC_LONG)count) != 1) {
      setfarm_zero_v2(buffer, sizeof(buffer));
      return false;
    }
  }
  uint8_t digest[CC_SHA256_DIGEST_LENGTH];
  if (CC_SHA256_Final(digest, &context) != 1) {
    setfarm_zero_v2(buffer, sizeof(buffer));
    return false;
  }
  setfarm_hex_v2(digest, sizeof(digest), output);
  setfarm_zero_v2(digest, sizeof(digest));
  setfarm_zero_v2(buffer, sizeof(buffer));
  return lseek(descriptor, 0, SEEK_SET) == 0;
}

static bool
setfarm_capture_descriptor_v2(
  int descriptor,
  setfarm_file_evidence_v2 *output)
{
  struct stat before;
  struct stat after;
  memset(&before, 0, sizeof(before));
  memset(&after, 0, sizeof(after));
  memset(output, 0, sizeof(*output));
  if (fstat(descriptor, &before) != 0 || !S_ISREG(before.st_mode) ||
      before.st_size < 1 || before.st_size > SETFARM_EXEC_MAX_BYTES_V2 ||
      before.st_nlink != 1 || before.st_uid != getuid() ||
      before.st_gid != getgid() || (before.st_mode & 0111) == 0 ||
      !setfarm_hash_descriptor_v2(descriptor, output->content_hash) ||
      fstat(descriptor, &after) != 0) {
    setfarm_zero_v2(output, sizeof(*output));
    return false;
  }
  if (before.st_dev != after.st_dev || before.st_ino != after.st_ino ||
      before.st_mode != after.st_mode || before.st_nlink != after.st_nlink ||
      before.st_uid != after.st_uid || before.st_gid != after.st_gid ||
      before.st_size != after.st_size ||
      before.st_mtimespec.tv_sec != after.st_mtimespec.tv_sec ||
      before.st_mtimespec.tv_nsec != after.st_mtimespec.tv_nsec ||
      before.st_ctimespec.tv_sec != after.st_ctimespec.tv_sec ||
      before.st_ctimespec.tv_nsec != after.st_ctimespec.tv_nsec) {
    setfarm_zero_v2(output, sizeof(*output));
    return false;
  }
  output->status = after;
  return true;
}

static bool
setfarm_same_stable_content_v2(
  const setfarm_file_evidence_v2 *left,
  const setfarm_file_evidence_v2 *right)
{
  return left->status.st_dev == right->status.st_dev &&
    left->status.st_ino == right->status.st_ino &&
    left->status.st_mode == right->status.st_mode &&
    left->status.st_nlink == right->status.st_nlink &&
    left->status.st_uid == right->status.st_uid &&
    left->status.st_gid == right->status.st_gid &&
    left->status.st_size == right->status.st_size &&
    strcmp(left->content_hash, right->content_hash) == 0;
}

static bool
setfarm_same_exact_file_v2(
  const setfarm_file_evidence_v2 *left,
  const setfarm_file_evidence_v2 *right)
{
  return setfarm_same_stable_content_v2(left, right) &&
    left->status.st_mtimespec.tv_sec == right->status.st_mtimespec.tv_sec &&
    left->status.st_mtimespec.tv_nsec == right->status.st_mtimespec.tv_nsec &&
    left->status.st_ctimespec.tv_sec == right->status.st_ctimespec.tv_sec &&
    left->status.st_ctimespec.tv_nsec == right->status.st_ctimespec.tv_nsec;
}

static bool
setfarm_parse_mode_v2(const char *text, setfarm_mode_v2 *mode)
{
  if (strcmp(text, "baseline") == 0) {
    *mode = SETFARM_MODE_BASELINE_V2;
  } else if (strcmp(text, "pre_spawn_replacement") == 0) {
    *mode = SETFARM_MODE_PRE_SPAWN_REPLACEMENT_V2;
  } else if (strcmp(text, "post_spawn_rename") == 0) {
    *mode = SETFARM_MODE_POST_SPAWN_RENAME_V2;
  } else if (strcmp(text, "post_resume_drift") == 0) {
    *mode = SETFARM_MODE_POST_RESUME_DRIFT_V2;
  } else if (strcmp(text, "security_observation_failure") == 0) {
    *mode = SETFARM_MODE_SECURITY_OBSERVATION_FAILURE_V2;
  } else if (strcmp(text, "malformed") == 0) {
    *mode = SETFARM_MODE_MALFORMED_V2;
  } else if (strcmp(text, "timeout") == 0) {
    *mode = SETFARM_MODE_TIMEOUT_V2;
  } else if (strcmp(text, "canary_then_nonzero_exit") == 0) {
    *mode = SETFARM_MODE_CANARY_THEN_NONZERO_EXIT_V2;
  } else if (strcmp(text, "canary_then_signal") == 0) {
    *mode = SETFARM_MODE_CANARY_THEN_SIGNAL_V2;
  } else {
    return false;
  }
  return true;
}

static const char *
setfarm_mode_text_v2(setfarm_mode_v2 mode)
{
  switch (mode) {
    case SETFARM_MODE_BASELINE_V2: return "baseline";
    case SETFARM_MODE_PRE_SPAWN_REPLACEMENT_V2:
      return "pre_spawn_replacement";
    case SETFARM_MODE_POST_SPAWN_RENAME_V2: return "post_spawn_rename";
    case SETFARM_MODE_POST_RESUME_DRIFT_V2: return "post_resume_drift";
    case SETFARM_MODE_SECURITY_OBSERVATION_FAILURE_V2:
      return "security_observation_failure";
    case SETFARM_MODE_MALFORMED_V2: return "malformed";
    case SETFARM_MODE_TIMEOUT_V2: return "timeout";
    case SETFARM_MODE_CANARY_THEN_NONZERO_EXIT_V2:
      return "canary_then_nonzero_exit";
    case SETFARM_MODE_CANARY_THEN_SIGNAL_V2:
      return "canary_then_signal";
  }
  return "invalid";
}

static const char *
setfarm_target_behavior_v2(setfarm_mode_v2 mode)
{
  if (mode == SETFARM_MODE_MALFORMED_V2) return "malformed";
  if (mode == SETFARM_MODE_TIMEOUT_V2) return "timeout";
  if (mode == SETFARM_MODE_POST_RESUME_DRIFT_V2) return "drift";
  if (mode == SETFARM_MODE_CANARY_THEN_NONZERO_EXIT_V2) {
    return "nonzero_exit";
  }
  if (mode == SETFARM_MODE_CANARY_THEN_SIGNAL_V2) return "signal";
  return "success";
}

static bool
setfarm_replace_target_v2(const char *target, const char *replacement)
{
  char backup[SETFARM_PATH_MAX_V2 + 1];
  const int length = snprintf(backup, sizeof(backup), "%s.held-v2", target);
  struct stat absent;
  memset(&absent, 0, sizeof(absent));
  if (length < 1 || (size_t)length >= sizeof(backup) ||
      lstat(backup, &absent) == 0 || errno != ENOENT ||
      rename(target, backup) != 0 || rename(replacement, target) != 0) {
    setfarm_zero_v2(backup, sizeof(backup));
    return false;
  }
  setfarm_zero_v2(backup, sizeof(backup));
  return true;
}

static bool
setfarm_wait_stopped_v2(pid_t child)
{
  for (size_t attempt = 0; attempt < SETFARM_STOP_POLLS_V2; attempt += 1) {
    int status = 0;
    const pid_t result = waitpid(child, &status, WUNTRACED | WNOHANG);
    if (result == child) {
      return WIFSTOPPED(status);
    }
    if (result < 0 && errno != EINTR) {
      return false;
    }
    setfarm_sleep_poll_v2();
  }
  return false;
}

static bool
setfarm_record_wait_status_v2(
  int status,
  setfarm_process_evidence_v2 *process)
{
  process->reaped = true;
  process->exit_code = -1;
  process->termination_signal = 0;
  process->termination_kind = "unknown";
  if (WIFEXITED(status)) {
    process->termination_kind = "exited";
    process->exit_code = WEXITSTATUS(status);
    return true;
  }
  if (WIFSIGNALED(status)) {
    process->termination_kind = "signaled";
    process->termination_signal = WTERMSIG(status);
    return true;
  }
  return false;
}

static bool
setfarm_reap_bounded_v2(
  pid_t child,
  setfarm_process_evidence_v2 *process)
{
  for (size_t attempt = 0; attempt < SETFARM_REAP_POLLS_V2; attempt += 1) {
    int status = 0;
    const pid_t result = waitpid(child, &status, WNOHANG);
    if (result == child) {
      (void)setfarm_record_wait_status_v2(status, process);
      return true;
    }
    if (result < 0 && errno == ECHILD) {
      process->reaped = true;
      process->exit_code = -1;
      process->termination_signal = 0;
      process->termination_kind = "unknown";
      return true;
    }
    if (result < 0 && errno != EINTR) {
      return false;
    }
    setfarm_sleep_poll_v2();
  }
  return false;
}

static void
setfarm_kill_and_reap_v2(
  pid_t child,
  setfarm_process_evidence_v2 *process)
{
  if (kill(child, SIGKILL) == 0) {
    process->sigkill_sent = true;
  }
  (void)setfarm_reap_bounded_v2(child, process);
}

static bool
setfarm_mapped_vnode_v2(
  pid_t child,
  const setfarm_file_evidence_v2 *held,
  setfarm_mapped_evidence_v2 *output)
{
  uint64_t cursor = 0;
  memset(output, 0, sizeof(*output));
  for (size_t index = 0; index < SETFARM_REGION_MAX_V2; index += 1) {
    struct proc_regionwithpathinfo region;
    memset(&region, 0, sizeof(region));
    errno = 0;
    const int count = proc_pidinfo(
      child,
      PROC_PIDREGIONPATHINFO,
      cursor,
      &region,
      (int)sizeof(region));
    if (count == 0) {
      setfarm_zero_v2(&region, sizeof(region));
      return true;
    }
    if (count != (int)PROC_PIDREGIONPATHINFO_SIZE ||
        region.prp_prinfo.pri_size == 0 ||
        region.prp_prinfo.pri_address < cursor ||
        UINT64_MAX - region.prp_prinfo.pri_address <
          region.prp_prinfo.pri_size) {
      setfarm_zero_v2(&region, sizeof(region));
      return false;
    }
    output->region_count += 1;
    const struct vinfo_stat *mapped = &region.prp_vip.vip_vi.vi_stat;
    if ((region.prp_prinfo.pri_protection & VM_PROT_EXECUTE) != 0 &&
        (mapped->vst_mode & S_IFMT) == S_IFREG &&
        (uint32_t)held->status.st_dev == mapped->vst_dev &&
        (uint64_t)held->status.st_ino == mapped->vst_ino &&
        (held->status.st_mode & (S_IFMT | 07777)) ==
          ((mode_t)mapped->vst_mode & (S_IFMT | 07777)) &&
        (uint64_t)held->status.st_nlink == (uint64_t)mapped->vst_nlink &&
        held->status.st_uid == mapped->vst_uid &&
        held->status.st_gid == mapped->vst_gid &&
        held->status.st_size == mapped->vst_size &&
        held->status.st_mtimespec.tv_sec == mapped->vst_mtime &&
        held->status.st_mtimespec.tv_nsec == mapped->vst_mtimensec &&
        held->status.st_ctimespec.tv_sec == mapped->vst_ctime &&
        held->status.st_ctimespec.tv_nsec == mapped->vst_ctimensec) {
      output->matching_region_count += 1;
      if (!output->matched) {
        output->status = *mapped;
      }
      output->matched = true;
    }
    cursor = region.prp_prinfo.pri_address + region.prp_prinfo.pri_size;
    setfarm_zero_v2(&region, sizeof(region));
    if (cursor == UINT64_MAX) {
      return true;
    }
  }
  return false;
}

static bool
setfarm_cf_number_u64_v2(CFTypeRef value, uint64_t *output)
{
  int64_t signed_value = 0;
  if (value == NULL || CFGetTypeID(value) != CFNumberGetTypeID() ||
      !CFNumberGetValue((CFNumberRef)value, kCFNumberSInt64Type, &signed_value) ||
      signed_value < 0) {
    return false;
  }
  *output = (uint64_t)signed_value;
  return true;
}

static bool
setfarm_security_observation_v2(
  pid_t child,
  setfarm_security_evidence_v2 *output)
{
  memset(output, 0, sizeof(*output));
  output->guest_lookup_status = -1;
  output->validity_status = -1;
  output->signing_information_status = -1;
  output->observed_before_resume = true;
  CFNumberRef pid_number = CFNumberCreate(
    kCFAllocatorDefault,
    kCFNumberIntType,
    &child);
  if (pid_number == NULL) {
    return false;
  }
  const void *keys[] = { kSecGuestAttributePid };
  const void *values[] = { pid_number };
  CFDictionaryRef attributes = CFDictionaryCreate(
    kCFAllocatorDefault,
    keys,
    values,
    1,
    &kCFTypeDictionaryKeyCallBacks,
    &kCFTypeDictionaryValueCallBacks);
  SecCodeRef code = NULL;
  CFDictionaryRef information = NULL;
  if (attributes != NULL) {
    output->guest_lookup_status = SecCodeCopyGuestWithAttributes(
      NULL,
      attributes,
      kSecCSDefaultFlags,
      &code);
  }
  if (code != NULL) {
    output->validity_status = SecCodeCheckValidity(
      code,
      kSecCSDefaultFlags,
      NULL);
    output->signing_information_status = SecCodeCopySigningInformation(
      code,
      kSecCSSigningInformation | kSecCSDynamicInformation,
      &information);
  }
  if (information != NULL) {
    output->dynamic_status_present = setfarm_cf_number_u64_v2(
      CFDictionaryGetValue(information, kSecCodeInfoStatus),
      &output->dynamic_status_flags);
    output->signing_information_flags_present = setfarm_cf_number_u64_v2(
      CFDictionaryGetValue(information, kSecCodeInfoFlags),
      &output->signing_information_flags);
    (void)setfarm_cf_number_u64_v2(
      CFDictionaryGetValue(information, kSecCodeInfoDigestAlgorithm),
      &output->digest_algorithm);
    CFTypeRef unique = CFDictionaryGetValue(information, kSecCodeInfoUnique);
    if (unique != NULL && CFGetTypeID(unique) == CFDataGetTypeID()) {
      const CFIndex length = CFDataGetLength((CFDataRef)unique);
      if (length > 0 && length <= (CFIndex)sizeof(output->cdhash)) {
        CFDataGetBytes(
          (CFDataRef)unique,
          CFRangeMake(0, length),
          output->cdhash);
        output->cdhash_length = (size_t)length;
      }
    }
    CFTypeRef cms = CFDictionaryGetValue(information, kSecCodeInfoCMS);
    output->has_cms = cms != NULL && CFGetTypeID(cms) == CFDataGetTypeID() &&
      CFDataGetLength((CFDataRef)cms) > 0;
    CFTypeRef identifier = CFDictionaryGetValue(
      information,
      kSecCodeInfoIdentifier);
    output->has_identifier = identifier != NULL &&
      CFGetTypeID(identifier) == CFStringGetTypeID() &&
      CFStringGetLength((CFStringRef)identifier) > 0;
  }
  if (information != NULL) CFRelease(information);
  if (code != NULL) CFRelease(code);
  if (attributes != NULL) CFRelease(attributes);
  CFRelease(pid_number);
  return output->guest_lookup_status == errSecSuccess &&
    output->validity_status == errSecSuccess &&
    output->signing_information_status == errSecSuccess &&
    output->dynamic_status_present &&
    output->signing_information_flags_present &&
    (output->dynamic_status_flags & kSecCodeStatusValid) != 0 &&
    output->digest_algorithm > 0 &&
    output->cdhash_length > 0;
}

static const char *
setfarm_signature_class_v2(const setfarm_security_evidence_v2 *security)
{
  if (security->signing_information_status != errSecSuccess ||
      !security->signing_information_flags_present) return "unknown";
  if (!security->has_identifier) return "unsigned";
  if ((security->signing_information_flags & kSecCodeSignatureAdhoc) != 0) {
    return "adhoc";
  }
  if (security->has_cms) return "signed";
  return "unknown";
}

static bool
setfarm_read_child_output_v2(
  int descriptor,
  uint8_t output[SETFARM_OUTPUT_MAX_V2],
  size_t *length)
{
  for (;;) {
    if (*length == SETFARM_OUTPUT_MAX_V2) return false;
    const ssize_t count = read(
      descriptor,
      output + *length,
      SETFARM_OUTPUT_MAX_V2 - *length);
    if (count > 0) {
      *length += (size_t)count;
      continue;
    }
    if (count == 0 || (count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK))) {
      return true;
    }
    if (count < 0 && errno == EINTR) continue;
    return false;
  }
}

static bool
setfarm_run_child_v2(
  pid_t child,
  int output_descriptor,
  setfarm_mode_v2 mode,
  const char *challenge,
  setfarm_process_evidence_v2 *process)
{
  uint8_t output[SETFARM_OUTPUT_MAX_V2];
  size_t output_length = 0;
  memset(output, 0, sizeof(output));
  if (kill(child, SIGCONT) != 0) {
    setfarm_zero_v2(output, sizeof(output));
    return false;
  }
  process->sigcont_sent = true;
  bool exited = false;
  for (size_t attempt = 0; attempt < SETFARM_RUN_POLLS_V2; attempt += 1) {
    if (!setfarm_read_child_output_v2(output_descriptor, output, &output_length)) {
      break;
    }
    int status = 0;
    const pid_t result = waitpid(child, &status, WNOHANG);
    if (result == child) {
      (void)setfarm_record_wait_status_v2(status, process);
      exited = true;
      break;
    }
    if (result < 0 && errno == ECHILD) {
      process->reaped = true;
      process->exit_code = -1;
      process->termination_signal = 0;
      process->termination_kind = "unknown";
      exited = true;
      break;
    }
    if (result < 0 && errno != EINTR) break;
    setfarm_sleep_poll_v2();
  }
  (void)setfarm_read_child_output_v2(output_descriptor, output, &output_length);
  static const char prefix[] = "setfarm_target_entered_v2:";
  process->target_canary_observed = output_length >= sizeof(prefix) - 1 &&
    memcmp(output, prefix, sizeof(prefix) - 1) == 0;
  if (!exited) {
    process->target_output_state = "timeout";
    setfarm_kill_and_reap_v2(child, process);
    setfarm_zero_v2(output, sizeof(output));
    return process->reaped;
  }
  char expected[sizeof(prefix) + 64 + 2];
  const int expected_length = snprintf(
    expected,
    sizeof(expected),
    "%s%s\n",
    prefix,
    challenge);
  if (mode == SETFARM_MODE_MALFORMED_V2 || expected_length < 1 ||
      output_length != (size_t)expected_length ||
      memcmp(output, expected, output_length) != 0) {
    process->target_output_state = "malformed";
  } else {
    process->target_output_state = "valid";
  }
  setfarm_zero_v2(expected, sizeof(expected));
  setfarm_zero_v2(output, sizeof(output));
  return process->reaped;
}

static int
setfarm_target_main_v2(int argc, char **argv)
{
  if (argc != 4 || strcmp(argv[1], "--setfarm-suspended-target-v2") != 0 ||
      !setfarm_exact_hex_v2(argv[3], 32)) {
    return 64;
  }
  static const char prefix[] = "setfarm_target_entered_v2:";
  char frame[sizeof(prefix) + 64 + 16];
  int length = 0;
  if (strcmp(argv[2], "success") == 0 ||
      strcmp(argv[2], "nonzero_exit") == 0 ||
      strcmp(argv[2], "signal") == 0) {
    length = snprintf(frame, sizeof(frame), "%s%s\n", prefix, argv[3]);
  } else if (strcmp(argv[2], "malformed") == 0) {
    length = snprintf(frame, sizeof(frame), "%smalformed\n", prefix);
  } else if (strcmp(argv[2], "timeout") == 0) {
    length = snprintf(frame, sizeof(frame), "%stimeout\n", prefix);
    if (length < 1 || (size_t)length >= sizeof(frame) ||
        !setfarm_write_all_v2(STDOUT_FILENO, frame, (size_t)length)) {
      setfarm_zero_v2(frame, sizeof(frame));
      return 70;
    }
    setfarm_zero_v2(frame, sizeof(frame));
    for (;;) pause();
  } else if (strcmp(argv[2], "drift") == 0) {
    length = snprintf(frame, sizeof(frame), "%s%s\n", prefix, argv[3]);
    if (length < 1 || (size_t)length >= sizeof(frame) ||
        !setfarm_write_all_v2(STDOUT_FILENO, frame, (size_t)length)) {
      setfarm_zero_v2(frame, sizeof(frame));
      return 70;
    }
    const struct timespec drift_times[2] = {
      { .tv_sec = 1, .tv_nsec = 123456789 },
      { .tv_sec = 1, .tv_nsec = 123456789 }
    };
    const int drift_status = utimensat(AT_FDCWD, argv[0], drift_times, 0);
    setfarm_zero_v2(frame, sizeof(frame));
    return drift_status == 0 ? 0 : 71;
  } else {
    return 65;
  }
  const bool written = length > 0 && (size_t)length < sizeof(frame) &&
    setfarm_write_all_v2(STDOUT_FILENO, frame, (size_t)length);
  setfarm_zero_v2(frame, sizeof(frame));
  if (!written) return 70;
  if (strcmp(argv[2], "nonzero_exit") == 0) return 23;
  if (strcmp(argv[2], "signal") == 0) {
    (void)raise(SIGTERM);
    return 72;
  }
  return 0;
}

static void
setfarm_print_stable_v2(const struct stat *status)
{
  printf(
    "{\"device\":\"%" PRIu64 "\",\"inode\":\"%" PRIu64
    "\",\"objectKind\":\"ordinary_file\"}",
    (uint64_t)status->st_dev,
    (uint64_t)status->st_ino);
}

static void
setfarm_print_mutable_v2(const setfarm_file_evidence_v2 *held)
{
  const int64_t changed_nanoseconds =
    (int64_t)held->status.st_ctimespec.tv_sec * INT64_C(1000000000) +
    (int64_t)held->status.st_ctimespec.tv_nsec;
  const int64_t modified_nanoseconds =
    (int64_t)held->status.st_mtimespec.tv_sec * INT64_C(1000000000) +
    (int64_t)held->status.st_mtimespec.tv_nsec;
  printf(
    "{\"byteLength\":%" PRId64 ",\"changedNanoseconds\":\"%" PRId64
    "\",\"changedSeconds\":\"%" PRId64 "\",\"contentHash\":\"%s\""
    ",\"linkCount\":%" PRIu64 ",\"mode\":\"0%03o\""
    ",\"modifiedNanoseconds\":\"%" PRId64
    "\",\"modifiedSeconds\":\"%" PRId64
    "\",\"ownerGid\":%u,\"ownerUid\":%u}",
    (int64_t)held->status.st_size,
    changed_nanoseconds,
    (int64_t)held->status.st_ctimespec.tv_sec,
    held->content_hash,
    (uint64_t)held->status.st_nlink,
    (unsigned int)(held->status.st_mode & 07777),
    modified_nanoseconds,
    (int64_t)held->status.st_mtimespec.tv_sec,
    (unsigned int)held->status.st_gid,
    (unsigned int)held->status.st_uid);
}

static const char *
setfarm_outcome_v2(
  setfarm_mode_v2 mode,
  const setfarm_mapped_evidence_v2 *mapped,
  bool mapped_ready,
  bool security_complete,
  const setfarm_process_evidence_v2 *process)
{
  if (strcmp(process->termination_kind, "unknown") == 0) {
    return "failed_closed_process_termination";
  }
  if (!mapped_ready) {
    return "rejected_pre_user_entry_observation_unavailable";
  }
  if (!mapped->matched) return "rejected_pre_user_entry_vnode_mismatch";
  if (mode == SETFARM_MODE_SECURITY_OBSERVATION_FAILURE_V2) {
    return "rejected_pre_user_entry_security_observation";
  }
  if (!security_complete) {
    return "rejected_pre_user_entry_observation_unavailable";
  }
  if (strcmp(process->target_output_state, "timeout") == 0 &&
      strcmp(process->termination_kind, "signaled") == 0 &&
      process->termination_signal == SIGKILL) {
    return "continued_then_timeout";
  }
  const bool exited_zero = strcmp(process->termination_kind, "exited") == 0 &&
    process->exit_code == 0;
  if (!exited_zero) {
    return "failed_closed_process_termination";
  }
  if (process->sigcont_sent &&
      !process->held_post_execution_unchanged) {
    return "failed_closed_post_resume_drift";
  }
  if (strcmp(process->target_output_state, "valid") == 0 &&
      process->held_post_execution_unchanged) {
    return "continued_and_completed";
  }
  if (strcmp(process->target_output_state, "malformed") == 0) {
    return "continued_then_malformed";
  }
  return "failed_closed";
}

static void
setfarm_print_receipt_v2(
  setfarm_mode_v2 mode,
  const setfarm_file_evidence_v2 *held,
  const setfarm_mapped_evidence_v2 *mapped,
  bool mapped_ready,
  const setfarm_security_evidence_v2 *security,
  bool security_complete,
  const setfarm_process_evidence_v2 *process)
{
  char cdhash_hex[SETFARM_CDHASH_MAX_V2 * 2 + 1];
  memset(cdhash_hex, 0, sizeof(cdhash_hex));
  if (security->cdhash_length > 0) {
    setfarm_hex_v2(security->cdhash, security->cdhash_length, cdhash_hex);
  }
  printf(
    "{\"admissionScope\":\"test_fixture\",\"credentialUse\":\"none\""
    ",\"descriptorExecution\":false,\"heldExecutable\":{\"mutableFingerprint\":");
  setfarm_print_mutable_v2(held);
  printf(",\"stableIdentity\":");
  setfarm_print_stable_v2(&held->status);
  printf(
    "},\"libprocApiStability\":\"private_unproven\",\"mappedExecutable\":{"
    "\"matched\":%s,\"matchingRegionCount\":%zu,\"regionCountObserved\":%zu,"
    "\"stableIdentity\":",
    mapped->matched ? "true" : "false",
    mapped->matching_region_count,
    mapped->region_count);
  if (mapped->matched) {
    printf(
      "{\"device\":\"%u\",\"inode\":\"%" PRIu64
      "\",\"objectKind\":\"ordinary_file\"}",
      mapped->status.vst_dev,
      mapped->status.vst_ino);
  } else {
    printf("null");
  }
  printf(
    "},\"mode\":\"%s\","
    "\"observationReadiness\":\"private_api_not_guaranteed\","
    "\"outcome\":\"%s\",\"process\":{"
    "\"exitCode\":",
    setfarm_mode_text_v2(mode),
    setfarm_outcome_v2(
      mode,
      mapped,
      mapped_ready,
      security_complete,
      process));
  if (strcmp(process->termination_kind, "exited") == 0) {
    printf("%d", process->exit_code);
  } else {
    printf("null");
  }
  printf(
    ",\"heldPostExecutionUnchanged\":%s,\"reaped\":%s,"
    "\"sigcontSent\":%s,\"sigkillSent\":%s,"
    "\"targetCanaryObserved\":%s,\"targetOutputState\":\"%s\","
    "\"terminationKind\":\"%s\",\"terminationSignal\":",
    process->held_post_execution_unchanged ? "true" : "false",
    process->reaped ? "true" : "false",
    process->sigcont_sent ? "true" : "false",
    process->sigkill_sent ? "true" : "false",
    process->target_canary_observed ? "true" : "false",
    process->target_output_state,
    process->termination_kind);
  if (strcmp(process->termination_kind, "signaled") == 0) {
    printf("%d", process->termination_signal);
  } else {
    printf("null");
  }
  printf(
    "},\"productionAuthority\":false,"
    "\"schema\":\"setfarm.platform-release-bootstrap-darwin-suspended-exec-binding.v2\","
    "\"security\":{\"cdhash\":");
  if (security->cdhash_length > 0) {
    printf("\"%s\"", cdhash_hex);
  } else {
    printf("null");
  }
  printf(
    ",\"cdhashByteLength\":%zu,\"digestAlgorithm\":%" PRIu64
    ",\"dynamicStatusFlags\":%" PRIu64
    ",\"guestLookupStatus\":%d,\"hasCms\":%s,\"hasIdentifier\":%s,"
    "\"observedBeforeResume\":%s,\"signatureClass\":\"%s\","
    "\"signingInformationFlags\":%" PRIu64
    ",\"signingInformationStatus\":%d,"
    "\"validityStatus\":%d},"
    "\"spawnFlags\":[\"POSIX_SPAWN_START_SUSPENDED\","
    "\"POSIX_SPAWN_CLOEXEC_DEFAULT\"],"
    "\"trustConclusion\":\"characterization_only\"}\n",
    security->cdhash_length,
    security->digest_algorithm,
    security->dynamic_status_flags,
    (int)security->guest_lookup_status,
    security->has_cms ? "true" : "false",
    security->has_identifier ? "true" : "false",
    security->observed_before_resume ? "true" : "false",
    setfarm_signature_class_v2(security),
    security->signing_information_flags,
    (int)security->signing_information_status,
    (int)security->validity_status);
  setfarm_zero_v2(cdhash_hex, sizeof(cdhash_hex));
}

static int
setfarm_controller_main_v2(int argc, char **argv)
{
  if (argc != 6 || strcmp(argv[1], "--setfarm-suspended-controller-v2") != 0 ||
      !setfarm_exact_absolute_path_v2(argv[3]) ||
      !setfarm_exact_absolute_path_v2(argv[4]) ||
      !setfarm_exact_hex_v2(argv[5], 32)) {
    (void)fprintf(stderr, "usage_invalid\n");
    return 64;
  }
  setfarm_mode_v2 mode;
  if (!setfarm_parse_mode_v2(argv[2], &mode)) {
    (void)fprintf(stderr, "mode_invalid\n");
    return 64;
  }
  const int held_descriptor = open(argv[3], O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  setfarm_file_evidence_v2 initial;
  setfarm_file_evidence_v2 held;
  setfarm_file_evidence_v2 final;
  memset(&initial, 0, sizeof(initial));
  memset(&held, 0, sizeof(held));
  memset(&final, 0, sizeof(final));
  if (held_descriptor < 0 ||
      !setfarm_capture_descriptor_v2(held_descriptor, &initial)) {
    if (held_descriptor >= 0) close(held_descriptor);
    (void)fprintf(stderr, "held_descriptor_invalid\n");
    return 70;
  }
  if (mode == SETFARM_MODE_PRE_SPAWN_REPLACEMENT_V2 &&
      !setfarm_replace_target_v2(argv[3], argv[4])) {
    close(held_descriptor);
    (void)fprintf(stderr, "pre_spawn_replacement_failed\n");
    return 71;
  }
  int child_output[2];
  if (pipe(child_output) != 0 ||
      fcntl(child_output[0], F_SETFL, O_NONBLOCK) != 0 ||
      fcntl(child_output[0], F_SETFD, FD_CLOEXEC) != 0 ||
      fcntl(child_output[1], F_SETFD, FD_CLOEXEC) != 0) {
    close(held_descriptor);
    (void)fprintf(stderr, "pipe_invalid\n");
    return 72;
  }
  posix_spawn_file_actions_t actions;
  posix_spawnattr_t attributes;
  bool actions_ready = posix_spawn_file_actions_init(&actions) == 0;
  bool attributes_ready = posix_spawnattr_init(&attributes) == 0;
  short spawn_flags =
    (short)(POSIX_SPAWN_START_SUSPENDED | POSIX_SPAWN_CLOEXEC_DEFAULT);
  int spawn_error = actions_ready && attributes_ready
    ? posix_spawn_file_actions_adddup2(&actions, child_output[1], STDOUT_FILENO)
    : EINVAL;
  if (spawn_error == 0) {
    spawn_error = posix_spawn_file_actions_adddup2(
      &actions,
      child_output[1],
      STDERR_FILENO);
  }
  if (spawn_error == 0) {
    spawn_error = posix_spawn_file_actions_addclose(&actions, child_output[0]);
  }
  if (spawn_error == 0) {
    spawn_error = posix_spawnattr_setflags(&attributes, spawn_flags);
  }
  char *child_argv[] = {
    argv[3],
    "--setfarm-suspended-target-v2",
    (char *)setfarm_target_behavior_v2(mode),
    argv[5],
    NULL
  };
  char *child_env[] = {
    "HOME=/var/empty",
    "LANG=C",
    "LC_ALL=C",
    "PATH=/usr/bin:/bin",
    "TZ=UTC",
    NULL
  };
  pid_t child = -1;
  if (spawn_error == 0) {
    spawn_error = posix_spawn(
      &child,
      argv[3],
      &actions,
      &attributes,
      child_argv,
      child_env);
  }
  if (actions_ready) (void)posix_spawn_file_actions_destroy(&actions);
  if (attributes_ready) (void)posix_spawnattr_destroy(&attributes);
  close(child_output[1]);
  if (spawn_error != 0 || child < 1) {
    close(child_output[0]);
    close(held_descriptor);
    (void)fprintf(stderr, "suspended_spawn_failed=%d\n", spawn_error);
    return 73;
  }
  setfarm_process_evidence_v2 process = {
    .exit_code = -1,
    .held_post_execution_unchanged = false,
    .reaped = false,
    .sigcont_sent = false,
    .sigkill_sent = false,
    .target_canary_observed = false,
    .target_output_state = "none",
    .termination_kind = "unknown",
    .termination_signal = 0
  };
  if (!setfarm_wait_stopped_v2(child)) {
    setfarm_kill_and_reap_v2(child, &process);
    close(child_output[0]);
    close(held_descriptor);
    (void)fprintf(stderr, "child_not_suspended\n");
    return 74;
  }
  if (mode == SETFARM_MODE_POST_SPAWN_RENAME_V2 &&
      !setfarm_replace_target_v2(argv[3], argv[4])) {
    setfarm_kill_and_reap_v2(child, &process);
    close(child_output[0]);
    close(held_descriptor);
    (void)fprintf(stderr, "post_spawn_rename_failed\n");
    return 75;
  }
  if (!setfarm_capture_descriptor_v2(held_descriptor, &held) ||
      !setfarm_same_stable_content_v2(&initial, &held)) {
    setfarm_kill_and_reap_v2(child, &process);
    close(child_output[0]);
    close(held_descriptor);
    (void)fprintf(stderr, "held_descriptor_drift_before_gate\n");
    return 76;
  }
  setfarm_mapped_evidence_v2 mapped;
  setfarm_security_evidence_v2 security;
  const pid_t security_subject =
    mode == SETFARM_MODE_SECURITY_OBSERVATION_FAILURE_V2
      ? (pid_t)INT32_MAX
      : child;
  bool mapped_ready = false;
  bool security_complete = false;
  memset(&mapped, 0, sizeof(mapped));
  memset(&security, 0, sizeof(security));
  for (
    size_t attempt = 0;
    attempt < SETFARM_OBSERVATION_POLLS_V2;
    attempt += 1
  ) {
    mapped_ready = setfarm_mapped_vnode_v2(child, &held, &mapped) &&
      mapped.region_count > 0;
    if (!security_complete) {
      security_complete = setfarm_security_observation_v2(
        security_subject,
        &security);
    }
    if (mapped_ready && (security_complete ||
        mode == SETFARM_MODE_SECURITY_OBSERVATION_FAILURE_V2)) {
      break;
    }
    setfarm_sleep_poll_v2();
  }
  if (!mapped_ready || !mapped.matched || !security_complete) {
    setfarm_kill_and_reap_v2(child, &process);
    uint8_t unexpected[SETFARM_OUTPUT_MAX_V2];
    size_t unexpected_length = 0;
    memset(unexpected, 0, sizeof(unexpected));
    (void)setfarm_read_child_output_v2(
      child_output[0], unexpected, &unexpected_length);
    process.target_canary_observed = unexpected_length > 0;
    setfarm_zero_v2(unexpected, sizeof(unexpected));
  } else {
    (void)setfarm_run_child_v2(
      child,
      child_output[0],
      mode,
      argv[5],
      &process);
  }
  close(child_output[0]);
  if (setfarm_capture_descriptor_v2(held_descriptor, &final)) {
    process.held_post_execution_unchanged = setfarm_same_exact_file_v2(
      &held,
      &final);
  }
  setfarm_print_receipt_v2(
    mode,
    &held,
    &mapped,
    mapped_ready,
    &security,
    security_complete,
    &process);
  close(held_descriptor);
  setfarm_zero_v2(&initial, sizeof(initial));
  setfarm_zero_v2(&held, sizeof(held));
  setfarm_zero_v2(&final, sizeof(final));
  setfarm_zero_v2(&mapped, sizeof(mapped));
  setfarm_zero_v2(&security, sizeof(security));
  return process.reaped ? 0 : 77;
}

int
main(int argc, char **argv)
{
  if (argc > 1 && strcmp(argv[1], "--setfarm-suspended-target-v2") == 0) {
    return setfarm_target_main_v2(argc, argv);
  }
  return setfarm_controller_main_v2(argc, argv);
}
