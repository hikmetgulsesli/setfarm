#include "platform-release-bootstrap-aggregate-census-kernel-v2.h"

#include <CommonCrypto/CommonDigest.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/random.h>
#include <time.h>
#include <unistd.h>

#ifdef __APPLE__
#include <libproc.h>
#include <mach-o/dyld.h>
#include <mach/vm_prot.h>
#include <sys/proc_info.h>
#endif

#define SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2 3
#define SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2 4
#define SETFARM_AGGREGATE_CENSUS_FIXTURE_BINARY_FD_V2 5
#define SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2 ((size_t)24)
#define SETFARM_EXACT_RELEASE_PROBE_OUTPUT_MAX_BYTES_V2 ((size_t)16384)
#define SETFARM_AGGREGATE_CENSUS_RECURSIVE_FRAME_MAX_BYTES_V2 \
  ((size_t)64 * (size_t)1024)
#define SETFARM_AGGREGATE_CENSUS_SLOT_CATALOG_MAX_BYTES_V2 \
  ((size_t)4 + (size_t)SETFARM_AGGREGATE_CENSUS_MAX_ENTRIES_V2 * (size_t)37)
#define SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2 \
  ((size_t)256 * (size_t)1024)
#define SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_HEADER_BYTES_V2 ((size_t)61)
#define SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_FRAME_MAX_BYTES_V2 \
  (SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_HEADER_BYTES_V2 + \
   SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2)
#define SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2 ((size_t)32)
#define SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2 ((size_t)32)
#define SETFARM_FIXTURE_PROTOCOL_ACK_BODY_BYTES_V2 ((size_t)97)
#define SETFARM_FIXTURE_PROTOCOL_TERMINAL_BODY_BYTES_V2 ((size_t)98)
#define SETFARM_FIXTURE_PROTOCOL_IO_TIMEOUT_SECONDS_V2 ((uint64_t)10)

typedef enum setfarm_fixture_protocol_type_v2 {
  SETFARM_FIXTURE_PROTOCOL_OPEN_V2 = 1,
  SETFARM_FIXTURE_PROTOCOL_OBSERVATION_V2 = 2,
  SETFARM_FIXTURE_PROTOCOL_SLOT_CATALOG_V2 = 3,
  SETFARM_FIXTURE_PROTOCOL_SLOT_CAPTURE_REQUEST_V2 = 4,
  SETFARM_FIXTURE_PROTOCOL_SLOT_CONTENT_OBSERVATION_V2 = 5,
  SETFARM_FIXTURE_PROTOCOL_ACK_ACCEPT_V2 = 16,
  SETFARM_FIXTURE_PROTOCOL_ACK_ABORT_V2 = 17,
  SETFARM_FIXTURE_PROTOCOL_TERMINAL_ACCEPT_V2 = 32,
  SETFARM_FIXTURE_PROTOCOL_TERMINAL_ABORT_V2 = 33,
  SETFARM_FIXTURE_PROTOCOL_AUTHORITY_SELF_ASSERTED_TEST_FIXTURE_V2 = 1
} setfarm_fixture_protocol_type_v2;

_Static_assert(
  sizeof("session_after_recapture\n") - 1 ==
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "fixture control bound must equal the longest accepted frame");
_Static_assert(
  sizeof("recursive_semantic_live\n") - 1 ==
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "recursive semantic live control must equal the exact control bound");
_Static_assert(
  sizeof("semantic_pinned_live\n") - 1 == (size_t)21,
  "semantic pinned live control width must remain exact");
_Static_assert(
  sizeof("semantic_pinned_live\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "semantic pinned live control must fit the exact control bound");
_Static_assert(
  sizeof("exact_release_probe_v2\n") - 1 == (size_t)23,
  "exact release probe control width must remain exact");
_Static_assert(
  sizeof("exact_release_probe_v2\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "exact release probe control must fit the exact control bound");
_Static_assert(
  sizeof("probe_shared_held\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2 &&
  sizeof("probe_both_held\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2 &&
  sizeof("probe_node_released\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2 &&
  sizeof("probe_all_released\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "exact release stop controls must fit the exact control bound");
_Static_assert(
  sizeof("recursive_revalidate\n") - 1 == (size_t)21,
  "recursive revalidation control width must remain exact");
_Static_assert(
  sizeof("recursive_revalidate\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "recursive revalidation control must fit the exact control bound");
_Static_assert(
  sizeof("live_release_stop\n") - 1 == (size_t)18,
  "live release checkpoint control must remain exact");
_Static_assert(
  sizeof("live_release_stop\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "live release checkpoint control must fit the exact control bound");
_Static_assert(
  sizeof("slot_ledger_live\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "slot ledger live control must fit the exact control bound");
_Static_assert(
  sizeof("slot_ledger_drift\n") - 1 <=
    SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2,
  "slot ledger drift control must fit the exact control bound");

typedef enum setfarm_fixture_control_mode_v2 {
  SETFARM_FIXTURE_CONTROL_LEGACY_NONE_V2 = 1,
  SETFARM_FIXTURE_CONTROL_LEGACY_AFTER_FIRST_PASS_V2 = 2,
  SETFARM_FIXTURE_CONTROL_SESSION_NONE_V2 = 3,
  SETFARM_FIXTURE_CONTROL_SESSION_AFTER_BASELINE_V2 = 4,
  SETFARM_FIXTURE_CONTROL_SESSION_AFTER_RECAPTURE_V2 = 5,
  SETFARM_FIXTURE_CONTROL_SESSION_SECOND_OPEN_V2 = 6,
  SETFARM_FIXTURE_CONTROL_SESSION_LIVE_V2 = 7,
  SETFARM_FIXTURE_CONTROL_LIVE_RELEASE_STOP_V2 = 8,
  SETFARM_FIXTURE_CONTROL_SESSION_LIVE_RECURSIVE_V2 = 9,
  SETFARM_FIXTURE_CONTROL_RECURSIVE_REVALIDATE_V2 = 10,
  SETFARM_FIXTURE_CONTROL_RECURSIVE_SEMANTIC_LIVE_V2 = 11,
  SETFARM_FIXTURE_CONTROL_SEMANTIC_PINNED_LIVE_V2 = 12,
  SETFARM_FIXTURE_CONTROL_EXACT_RELEASE_PROBE_V2 = 13,
  SETFARM_FIXTURE_CONTROL_PROBE_SHARED_HELD_V2 = 14,
  SETFARM_FIXTURE_CONTROL_PROBE_BOTH_HELD_V2 = 15,
  SETFARM_FIXTURE_CONTROL_PROBE_NODE_RELEASED_V2 = 16,
  SETFARM_FIXTURE_CONTROL_PROBE_ALL_RELEASED_V2 = 17,
  SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_LIVE_V2 = 18,
  SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_DRIFT_V2 = 19
} setfarm_fixture_control_mode_v2;

typedef struct setfarm_fixture_checkpoint_context_v2 {
  setfarm_fixture_control_mode_v2 mode;
} setfarm_fixture_checkpoint_context_v2;

typedef struct setfarm_fixture_output_v2 {
  uint8_t *bytes;
  size_t length;
  size_t capacity;
} setfarm_fixture_output_v2;

typedef struct setfarm_fixture_protocol_ack_v2 {
  bool accept;
  uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2];
  uint8_t aggregate_sha256[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2];
  uint8_t semantic_ack_sha256[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2];
} setfarm_fixture_protocol_ack_v2;

static void
setfarm_fixture_zero_v2(void *memory, size_t length)
{
  volatile uint8_t *cursor = (volatile uint8_t *)memory;
  while (length > 0) {
    *cursor = 0;
    cursor += 1;
    length -= 1;
  }
}

static bool
setfarm_fixture_parse_control_v2(
  const uint8_t *bytes,
  size_t length,
  setfarm_fixture_checkpoint_context_v2 *context)
{
  static const uint8_t none[] = "none\n";
  static const uint8_t after_first_pass[] = "after_first_pass\n";
  static const uint8_t session_none[] = "session_none\n";
  static const uint8_t session_after_baseline[] =
    "session_after_baseline\n";
  static const uint8_t session_after_recapture[] =
    "session_after_recapture\n";
  static const uint8_t session_second_open[] = "session_second_open\n";
  static const uint8_t session_live[] = "session_live\n";
  static const uint8_t session_live_recursive[] =
    "session_live_recursive\n";
  static const uint8_t recursive_revalidate[] =
    "recursive_revalidate\n";
  static const uint8_t recursive_semantic_live[] =
    "recursive_semantic_live\n";
  static const uint8_t semantic_pinned_live[] =
    "semantic_pinned_live\n";
  static const uint8_t exact_release_probe[] =
    "exact_release_probe_v2\n";
  static const uint8_t probe_shared_held[] = "probe_shared_held\n";
  static const uint8_t probe_both_held[] = "probe_both_held\n";
  static const uint8_t probe_node_released[] = "probe_node_released\n";
  static const uint8_t probe_all_released[] = "probe_all_released\n";
  static const uint8_t live_release_stop[] = "live_release_stop\n";
  static const uint8_t slot_ledger_live[] = "slot_ledger_live\n";
  static const uint8_t slot_ledger_drift[] = "slot_ledger_drift\n";
  context->mode = (setfarm_fixture_control_mode_v2)0;
  if (length == sizeof(none) - 1 &&
      memcmp(bytes, none, sizeof(none) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_LEGACY_NONE_V2;
    return true;
  }
  if (length == sizeof(after_first_pass) - 1 &&
      memcmp(bytes, after_first_pass, sizeof(after_first_pass) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_LEGACY_AFTER_FIRST_PASS_V2;
    return true;
  }
  if (length == sizeof(session_none) - 1 &&
      memcmp(bytes, session_none, sizeof(session_none) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SESSION_NONE_V2;
    return true;
  }
  if (length == sizeof(session_after_baseline) - 1 &&
      memcmp(
        bytes, session_after_baseline, sizeof(session_after_baseline) - 1) ==
        0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SESSION_AFTER_BASELINE_V2;
    return true;
  }
  if (length == sizeof(session_after_recapture) - 1 &&
      memcmp(
        bytes,
        session_after_recapture,
        sizeof(session_after_recapture) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SESSION_AFTER_RECAPTURE_V2;
    return true;
  }
  if (length == sizeof(session_second_open) - 1 &&
      memcmp(
        bytes, session_second_open, sizeof(session_second_open) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SESSION_SECOND_OPEN_V2;
    return true;
  }
  if (length == sizeof(session_live) - 1 &&
      memcmp(bytes, session_live, sizeof(session_live) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SESSION_LIVE_V2;
    return true;
  }
  if (length == sizeof(session_live_recursive) - 1 &&
      memcmp(
        bytes,
        session_live_recursive,
        sizeof(session_live_recursive) - 1) == 0) {
    context->mode =
      SETFARM_FIXTURE_CONTROL_SESSION_LIVE_RECURSIVE_V2;
    return true;
  }
  if (length == sizeof(recursive_revalidate) - 1 &&
      memcmp(
        bytes,
        recursive_revalidate,
        sizeof(recursive_revalidate) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_RECURSIVE_REVALIDATE_V2;
    return true;
  }
  if (length == sizeof(recursive_semantic_live) - 1 &&
      memcmp(
        bytes,
        recursive_semantic_live,
        sizeof(recursive_semantic_live) - 1) == 0) {
    context->mode =
      SETFARM_FIXTURE_CONTROL_RECURSIVE_SEMANTIC_LIVE_V2;
    return true;
  }
  if (length == sizeof(semantic_pinned_live) - 1 &&
      memcmp(
        bytes,
        semantic_pinned_live,
        sizeof(semantic_pinned_live) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SEMANTIC_PINNED_LIVE_V2;
    return true;
  }
  if (length == sizeof(exact_release_probe) - 1 &&
      memcmp(
        bytes,
        exact_release_probe,
        sizeof(exact_release_probe) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_EXACT_RELEASE_PROBE_V2;
    return true;
  }
  if (length == sizeof(probe_shared_held) - 1 &&
      memcmp(
        bytes,
        probe_shared_held,
        sizeof(probe_shared_held) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_PROBE_SHARED_HELD_V2;
    return true;
  }
  if (length == sizeof(probe_both_held) - 1 &&
      memcmp(
        bytes, probe_both_held, sizeof(probe_both_held) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_PROBE_BOTH_HELD_V2;
    return true;
  }
  if (length == sizeof(probe_node_released) - 1 &&
      memcmp(
        bytes,
        probe_node_released,
        sizeof(probe_node_released) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_PROBE_NODE_RELEASED_V2;
    return true;
  }
  if (length == sizeof(probe_all_released) - 1 &&
      memcmp(
        bytes,
        probe_all_released,
        sizeof(probe_all_released) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_PROBE_ALL_RELEASED_V2;
    return true;
  }
  if (length == sizeof(live_release_stop) - 1 &&
      memcmp(
        bytes, live_release_stop, sizeof(live_release_stop) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_LIVE_RELEASE_STOP_V2;
    return true;
  }
  if (length == sizeof(slot_ledger_live) - 1 &&
      memcmp(bytes, slot_ledger_live, sizeof(slot_ledger_live) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_LIVE_V2;
    return true;
  }
  if (length == sizeof(slot_ledger_drift) - 1 &&
      memcmp(bytes, slot_ledger_drift, sizeof(slot_ledger_drift) - 1) == 0) {
    context->mode = SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_DRIFT_V2;
    return true;
  }
  return false;
}

static bool
setfarm_fixture_verify_pinned_running_binary_v2(void)
{
#ifdef __APPLE__
  struct stat pinned_stat;
  struct proc_regionwithpathinfo region;
  const struct mach_header *main_header = _dyld_get_image_header(0);
  const struct vinfo_stat *mapped_stat;
  uint64_t header_address;
  int query_count;
  int query_errno;

  memset(&pinned_stat, 0, sizeof(pinned_stat));
  memset(&region, 0, sizeof(region));
  if (fstat(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_BINARY_FD_V2,
        &pinned_stat) != 0) {
    (void)fprintf(
      stderr,
      "fixture_semantic_pinned_fd_invalid errno=%d\n",
      errno);
    return false;
  }
  if (!S_ISREG(pinned_stat.st_mode)) {
    (void)fprintf(stderr, "fixture_semantic_pinned_fd_not_regular\n");
    return false;
  }
  if (main_header == NULL) {
    (void)fprintf(stderr, "fixture_semantic_main_image_header_absent\n");
    return false;
  }
  header_address = (uint64_t)(uintptr_t)main_header;
  errno = 0;
  query_count = proc_pidinfo(
    getpid(),
    PROC_PIDREGIONPATHINFO,
    header_address,
    &region,
    (int)sizeof(region));
  query_errno = errno;
  if (query_count != (int)PROC_PIDREGIONPATHINFO_SIZE) {
    setfarm_fixture_zero_v2(&region, sizeof(region));
    (void)fprintf(
      stderr,
      "fixture_semantic_mapped_vnode_query_failed errno=%d\n",
      query_errno);
    return false;
  }
  mapped_stat = &region.prp_vip.vip_vi.vi_stat;
  if (
    header_address < region.prp_prinfo.pri_address
    || region.prp_prinfo.pri_size == 0
    || header_address - region.prp_prinfo.pri_address
      >= region.prp_prinfo.pri_size
    || (region.prp_prinfo.pri_protection & VM_PROT_EXECUTE) == 0
    || (mapped_stat->vst_mode & S_IFMT) != S_IFREG) {
    setfarm_fixture_zero_v2(&region, sizeof(region));
    (void)fprintf(stderr, "fixture_semantic_mapped_vnode_not_executable_file\n");
    return false;
  }
  if (
    (uint32_t)pinned_stat.st_dev != mapped_stat->vst_dev
    || (uint64_t)pinned_stat.st_ino != mapped_stat->vst_ino
    || (pinned_stat.st_mode & (S_IFMT | 07777))
      != ((mode_t)mapped_stat->vst_mode & (S_IFMT | 07777))
    || (uint64_t)pinned_stat.st_nlink != (uint64_t)mapped_stat->vst_nlink
    || pinned_stat.st_uid != mapped_stat->vst_uid
    || pinned_stat.st_gid != mapped_stat->vst_gid
    || pinned_stat.st_size != mapped_stat->vst_size
    || pinned_stat.st_mtimespec.tv_sec != mapped_stat->vst_mtime
    || pinned_stat.st_mtimespec.tv_nsec != mapped_stat->vst_mtimensec
    || pinned_stat.st_ctimespec.tv_sec != mapped_stat->vst_ctime
    || pinned_stat.st_ctimespec.tv_nsec != mapped_stat->vst_ctimensec) {
    setfarm_fixture_zero_v2(&region, sizeof(region));
    (void)fprintf(stderr, "fixture_semantic_pinned_mapped_vnode_mismatch\n");
    return false;
  }
  setfarm_fixture_zero_v2(&region, sizeof(region));
  return true;
#else
  (void)fprintf(stderr, "fixture_semantic_pinned_vnode_unsupported\n");
  return false;
#endif
}

static void
setfarm_fixture_stop_v2(const char *marker, size_t marker_length)
{
  (void)write(STDERR_FILENO, marker, marker_length);
  (void)raise(SIGSTOP);
}

static void
setfarm_fixture_checkpoint_v2(
  setfarm_aggregate_census_checkpoint_v2 checkpoint,
  void *opaque_context)
{
  setfarm_fixture_checkpoint_context_v2 *context =
    (setfarm_fixture_checkpoint_context_v2 *)opaque_context;
  if (context->mode ==
        SETFARM_FIXTURE_CONTROL_LEGACY_AFTER_FIRST_PASS_V2 &&
      checkpoint ==
        SETFARM_AGGREGATE_CENSUS_CHECKPOINT_AFTER_FIRST_PASS_V2) {
    static const char marker[] = "fixture_checkpoint_after_first_pass\n";
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  } else if (
    context->mode == SETFARM_FIXTURE_CONTROL_SESSION_AFTER_BASELINE_V2 &&
    checkpoint == SETFARM_AGGREGATE_CENSUS_CHECKPOINT_BASELINE_READY_V2) {
    static const char marker[] = "fixture_checkpoint_after_baseline\n";
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  } else if (
    context->mode == SETFARM_FIXTURE_CONTROL_RECURSIVE_REVALIDATE_V2 &&
    checkpoint == SETFARM_AGGREGATE_CENSUS_CHECKPOINT_BASELINE_READY_V2) {
    static const char marker[] =
      "fixture_checkpoint_recursive_baseline\n";
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  } else if (
    context->mode == SETFARM_FIXTURE_CONTROL_SESSION_AFTER_RECAPTURE_V2 &&
    checkpoint == SETFARM_AGGREGATE_CENSUS_CHECKPOINT_RECAPTURE_READY_V2) {
    static const char marker[] = "fixture_checkpoint_after_recapture\n";
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  } else if (
    context->mode == SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_DRIFT_V2 &&
    checkpoint ==
      SETFARM_AGGREGATE_CENSUS_CHECKPOINT_EXACT_ENTRY_FIRST_OBSERVATION_READY_V2) {
    static const char marker[] = "fixture_checkpoint_slot_ledger_first_entry\n";
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  }
}

static void
setfarm_fixture_output_dispose_v2(setfarm_fixture_output_v2 *output)
{
  if (output->bytes != NULL) {
    setfarm_fixture_zero_v2(output->bytes, output->capacity);
    free(output->bytes);
  }
  memset(output, 0, sizeof(*output));
}

static bool
setfarm_fixture_output_reserve_v2(
  setfarm_fixture_output_v2 *output,
  size_t additional)
{
  size_t required;
  size_t capacity;
  uint8_t *grown;
  if (additional >
      SETFARM_AGGREGATE_CENSUS_MAX_OUTPUT_BYTES_V2 - output->length) {
    return false;
  }
  required = output->length + additional;
  if (required <= output->capacity) {
    return true;
  }
  capacity = output->capacity == 0 ? (size_t)4096 : output->capacity;
  while (capacity < required) {
    if (capacity > SETFARM_AGGREGATE_CENSUS_MAX_OUTPUT_BYTES_V2 / 2) {
      capacity = SETFARM_AGGREGATE_CENSUS_MAX_OUTPUT_BYTES_V2;
      break;
    }
    capacity *= 2;
  }
  grown = (uint8_t *)realloc(output->bytes, capacity);
  if (grown == NULL) {
    return false;
  }
  if (capacity > output->capacity) {
    memset(grown + output->capacity, 0, capacity - output->capacity);
  }
  output->bytes = grown;
  output->capacity = capacity;
  return true;
}

static bool
setfarm_fixture_output_append_v2(
  setfarm_fixture_output_v2 *output,
  const void *bytes,
  size_t length)
{
  if (!setfarm_fixture_output_reserve_v2(output, length)) {
    return false;
  }
  if (length > 0) {
    memcpy(output->bytes + output->length, bytes, length);
  }
  output->length += length;
  return true;
}

static bool
setfarm_fixture_output_literal_v2(
  setfarm_fixture_output_v2 *output,
  const char *literal)
{
  return setfarm_fixture_output_append_v2(output, literal, strlen(literal));
}

static bool
setfarm_fixture_output_format_v2(
  setfarm_fixture_output_v2 *output,
  const char *format,
  ...)
{
  char stack[512];
  va_list arguments;
  int count;
  va_start(arguments, format);
  count = vsnprintf(stack, sizeof(stack), format, arguments);
  va_end(arguments);
  if (count < 0 || (size_t)count >= sizeof(stack)) {
    setfarm_fixture_zero_v2(stack, sizeof(stack));
    return false;
  }
  if (!setfarm_fixture_output_append_v2(output, stack, (size_t)count)) {
    setfarm_fixture_zero_v2(stack, sizeof(stack));
    return false;
  }
  setfarm_fixture_zero_v2(stack, sizeof(stack));
  return true;
}

static bool
setfarm_fixture_output_base64_v2(
  setfarm_fixture_output_v2 *output,
  const uint8_t *bytes,
  size_t length)
{
  static const uint8_t alphabet[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t index = 0;
  size_t encoded_length;
  if (length > (SIZE_MAX - 2) / 3) {
    return false;
  }
  encoded_length = ((length + 2) / 3) * 4;
  if (!setfarm_fixture_output_reserve_v2(output, encoded_length)) {
    return false;
  }
  while (index + 3 <= length) {
    uint32_t value = ((uint32_t)bytes[index] << 16) |
      ((uint32_t)bytes[index + 1] << 8) |
      (uint32_t)bytes[index + 2];
    output->bytes[output->length++] = alphabet[(value >> 18) & 63U];
    output->bytes[output->length++] = alphabet[(value >> 12) & 63U];
    output->bytes[output->length++] = alphabet[(value >> 6) & 63U];
    output->bytes[output->length++] = alphabet[value & 63U];
    index += 3;
  }
  if (index < length) {
    uint32_t value = (uint32_t)bytes[index] << 16;
    output->bytes[output->length++] = alphabet[(value >> 18) & 63U];
    if (index + 1 < length) {
      value |= (uint32_t)bytes[index + 1] << 8;
      output->bytes[output->length++] = alphabet[(value >> 12) & 63U];
      output->bytes[output->length++] = alphabet[(value >> 6) & 63U];
      output->bytes[output->length++] = (uint8_t)'=';
    } else {
      output->bytes[output->length++] = alphabet[(value >> 12) & 63U];
      output->bytes[output->length++] = (uint8_t)'=';
      output->bytes[output->length++] = (uint8_t)'=';
    }
  }
  return true;
}

static const char *
setfarm_fixture_kind_name_v2(
  setfarm_aggregate_census_object_kind_v2 kind)
{
  switch (kind) {
  case SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2:
    return "ordinary_file";
  case SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2:
    return "directory";
  }
  return NULL;
}

static bool
setfarm_fixture_output_stat_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_stat_v2 *stat)
{
  const char *kind = setfarm_fixture_kind_name_v2(stat->stable.object_kind);
  if (kind == NULL) {
    return false;
  }
  return setfarm_fixture_output_format_v2(
    output,
    "\"stable\":{\"objectKind\":\"%s\",\"device\":\"%" PRIu64
    "\",\"inode\":\"%" PRIu64
    "\"},\"mutable\":{\"ownerUid\":%" PRIu64
    ",\"ownerGid\":%" PRIu64 ",\"mode\":\"%04o\""
    ",\"linkCount\":%" PRIu64 ",\"byteLength\":%" PRIu64
    ",\"modifiedSeconds\":\"%" PRId64
    "\",\"modifiedNanoseconds\":\"%" PRId64
    "\",\"changedSeconds\":\"%" PRId64
    "\",\"changedNanoseconds\":\"%" PRId64 "\"}",
    kind,
    stat->stable.device,
    stat->stable.inode,
    stat->mutable.owner_uid,
    stat->mutable.owner_gid,
    (unsigned int)stat->mutable.mode,
    stat->mutable.link_count,
    stat->mutable.byte_length,
    stat->mutable.modified_seconds,
    stat->mutable.modified_nanoseconds,
    stat->mutable.changed_seconds,
    stat->mutable.changed_nanoseconds);
}

static bool
setfarm_fixture_output_exact_release_probe_v2(
  setfarm_fixture_output_v2 *output,
  const uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2],
  const setfarm_aggregate_census_exact_release_probe_result_v2 *result)
{
  size_t start = output->length;
  if (!setfarm_fixture_output_literal_v2(
        output,
        "{\"schema\":\"setfarm.platform-release-bootstrap-node-native-exact-release-probe-frame.v2\","
        "\"admissionScope\":\"test_fixture\","
        "\"productionAuthority\":false,"
        "\"nativeExternalPidAuthority\":\"distinct_process_descriptor_relative_f_tlock_fixture_v2\","
        "\"challengeBase64\":\"") ||
      !setfarm_fixture_output_base64_v2(
        output,
        challenge,
        SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2) ||
      !setfarm_fixture_output_literal_v2(output, "\",\"parent\":{") ||
      !setfarm_fixture_output_stat_v2(output, &result->parent_stat) ||
      !setfarm_fixture_output_literal_v2(
        output, "},\"sharedParentLock\":{") ||
      !setfarm_fixture_output_stat_v2(output, &result->shared_lock_stat) ||
      !setfarm_fixture_output_literal_v2(
        output,
        ",\"contentStatus\":\"exact_fixed_bytes_and_eof\","
        "\"outcome\":\"exclusive_nonblocking_lock_acquired_then_released\"},"
        "\"registeredNodePackageLock\":{") ||
      !setfarm_fixture_output_stat_v2(output, &result->node_lock_stat) ||
      !setfarm_fixture_output_literal_v2(
        output,
        ",\"contentStatus\":\"exact_fixed_bytes_and_eof\","
        "\"outcome\":\"exclusive_nonblocking_lock_acquired_then_released\"},"
        "\"acquisitionOrder\":[\"shared_parent_lock\","
          "\"registered_node_package_lock\"],"
        "\"releaseOrder\":[\"registered_node_package_lock\","
          "\"shared_parent_lock\"]}\n")) {
    return false;
  }
  return output->length - start <=
    SETFARM_EXACT_RELEASE_PROBE_OUTPUT_MAX_BYTES_V2;
}

static bool
setfarm_fixture_output_header_v2(setfarm_fixture_output_v2 *output)
{
  return setfarm_fixture_output_literal_v2(
    output,
    "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v2\","
    "\"admissionScope\":\"test_fixture\","
    "\"capability\":\"" SETFARM_AGGREGATE_CENSUS_CAPABILITY_V2 "\","
    "\"productionAuthority\":false,"
    "\"signingAuthority\":\"adhoc_or_unsigned_test_fixture\","
    "\"observationAuthority\":\""
      SETFARM_AGGREGATE_CENSUS_OBSERVATION_AUTHORITY_V2 "\","
    "\"capturePasses\":2,"
    "\"lockOrder\":[\"shared_parent_lock\","
      "\"registered_node_package_lock\"]}\n");
}

static bool
setfarm_fixture_output_parent_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_stat_v2 *parent)
{
  return setfarm_fixture_output_literal_v2(
      output,
      "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-parent.v2\",") &&
    setfarm_fixture_output_stat_v2(output, parent) &&
    setfarm_fixture_output_literal_v2(output, "}\n");
}

static bool
setfarm_fixture_output_locks_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_result_v2 *result)
{
  return setfarm_fixture_output_literal_v2(
      output,
      "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-locks.v2\","
      "\"lockOrder\":[\"shared_parent_lock\","
        "\"registered_node_package_lock\"],"
      "\"sharedParentLock\":{") &&
    setfarm_fixture_output_stat_v2(output, &result->shared_lock_stat) &&
    setfarm_fixture_output_literal_v2(
      output, "},\"registeredNodePackageLock\":{") &&
    setfarm_fixture_output_stat_v2(output, &result->node_lock_stat) &&
    setfarm_fixture_output_literal_v2(output, "}}\n");
}

static bool
setfarm_fixture_output_member_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_member_v2 *member)
{
  const char *kind = setfarm_fixture_kind_name_v2(member->object_kind);
  return kind != NULL &&
    setfarm_fixture_output_literal_v2(output, "{\"basenameBase64\":\"") &&
    setfarm_fixture_output_base64_v2(
      output, member->basename, member->basename_length) &&
    setfarm_fixture_output_format_v2(
      output, "\",\"objectKind\":\"%s\"}", kind);
}

static bool
setfarm_fixture_output_entry_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_entry_v2 *entry)
{
  size_t index;
  if (!setfarm_fixture_output_literal_v2(
        output,
        "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-entry.v2\","
        "\"basenameBase64\":\"") ||
      !setfarm_fixture_output_base64_v2(
        output, entry->basename, entry->basename_length) ||
      !setfarm_fixture_output_literal_v2(output, "\",") ||
      !setfarm_fixture_output_stat_v2(output, &entry->stat) ||
      !setfarm_fixture_output_literal_v2(output, ",\"content\":{")) {
    return false;
  }
  if (entry->stat.stable.object_kind ==
      SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2) {
    if (!setfarm_fixture_output_format_v2(
          output,
          "\"kind\":\"bounded_regular_file_bytes\","
          "\"byteLength\":%zu,\"contentBase64\":\"",
          entry->file_length) ||
        !setfarm_fixture_output_base64_v2(
          output, entry->file_bytes, entry->file_length) ||
        !setfarm_fixture_output_literal_v2(output, "\"}}\n")) {
      return false;
    }
    return true;
  }
  if (!setfarm_fixture_output_literal_v2(
        output, "\"kind\":\"directory_membership\",\"members\":[")) {
    return false;
  }
  for (index = 0; index < entry->member_count; index += 1) {
    if ((index > 0 && !setfarm_fixture_output_literal_v2(output, ",")) ||
        !setfarm_fixture_output_member_v2(output, &entry->members[index])) {
      return false;
    }
  }
  return setfarm_fixture_output_literal_v2(output, "]}}\n");
}

static const char *
setfarm_fixture_recursive_status_name_v2(
  setfarm_aggregate_census_recursive_status_v2 status)
{
  switch (status) {
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_ABSENT_V2:
    return "root_absent";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAYOUT_NOT_EXACT_V2:
    return "layout_not_exact";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_COMPLETE_V2:
    return "complete";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_NOT_CAPTURED_V2:
    break;
  }
  return NULL;
}

static const char *
setfarm_fixture_recursive_role_name_v2(
  setfarm_aggregate_census_recursive_role_v2 role)
{
  switch (role) {
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_DIRECTORY_V2:
    return "root_directory";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_BIN_DIRECTORY_V2:
    return "bin_directory";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAUNCHER_FILE_V2:
    return "launcher_file";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_LIB_DIRECTORY_V2:
    return "lib_directory";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_BUNDLE_FILE_V2:
    return "bundle_file";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_MANIFEST_FILE_V2:
    return "manifest_file";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_RUNTIME_DIRECTORY_V2:
    return "runtime_directory";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_BOOTSTRAP_RUNTIME_FILE_V2:
    return "bootstrap_runtime_file";
  }
  return NULL;
}

static const char *
setfarm_fixture_recursive_locator_v2(
  setfarm_aggregate_census_recursive_role_v2 role)
{
  switch (role) {
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_ROOT_DIRECTORY_V2:
    return ".";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_BIN_DIRECTORY_V2:
    return "bin";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_LAUNCHER_FILE_V2:
    return "bin/setfarm-node-toolchain-provisioner-v2";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_LIB_DIRECTORY_V2:
    return "lib";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_BUNDLE_FILE_V2:
    return "lib/node-toolchain-provisioner-v2.cjs";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_MANIFEST_FILE_V2:
    return "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_RUNTIME_DIRECTORY_V2:
    return "runtime";
  case SETFARM_AGGREGATE_CENSUS_RECURSIVE_BOOTSTRAP_RUNTIME_FILE_V2:
    return "runtime/node";
  }
  return NULL;
}

static bool
setfarm_fixture_output_sha256_v2(
  setfarm_fixture_output_v2 *output,
  const uint8_t digest[
    SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2])
{
  static const char hex[] = "0123456789abcdef";
  size_t index;
  for (index = 0;
       index < SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_SHA256_BYTES_V2;
       index += 1) {
    char pair[2];
    pair[0] = hex[digest[index] >> 4];
    pair[1] = hex[digest[index] & 0x0f];
    if (!setfarm_fixture_output_append_v2(
          output, (const uint8_t *)pair, sizeof(pair))) {
      pair[0] = 0;
      pair[1] = 0;
      return false;
    }
    pair[0] = 0;
    pair[1] = 0;
  }
  return true;
}

static bool
setfarm_fixture_output_recursive_entry_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_recursive_entry_v2 *entry)
{
  const char *role = setfarm_fixture_recursive_role_name_v2(entry->role);
  const char *locator = setfarm_fixture_recursive_locator_v2(entry->role);
  const char *parent_role = entry->parent_role == 0
    ? "global_parent"
    : setfarm_fixture_recursive_role_name_v2(entry->parent_role);
  size_t index;
  if (role == NULL || locator == NULL || parent_role == NULL ||
      !setfarm_fixture_output_format_v2(
        output,
        "{\"role\":\"%s\",\"parentRole\":\"%s\","
        "\"locator\":\"%s\",",
        role,
        parent_role,
        locator) ||
      !setfarm_fixture_output_stat_v2(output, &entry->stat) ||
      !setfarm_fixture_output_literal_v2(output, ",\"content\":{")) {
    return false;
  }
  if (entry->stat.stable.object_kind ==
      SETFARM_AGGREGATE_CENSUS_OBJECT_DIRECTORY_V2) {
    if (entry->has_content_sha256 ||
        !setfarm_fixture_output_literal_v2(
          output, "\"kind\":\"directory_membership\",\"members\":[")) {
      return false;
    }
    for (index = 0; index < entry->member_count; index += 1) {
      if ((index > 0 && !setfarm_fixture_output_literal_v2(output, ",")) ||
          !setfarm_fixture_output_member_v2(output, &entry->members[index])) {
        return false;
      }
    }
    return setfarm_fixture_output_literal_v2(output, "]}}");
  }
  if (!entry->has_content_sha256 || entry->member_count != 0 ||
      !setfarm_fixture_output_literal_v2(
        output, "\"kind\":\"sha256_regular_file\",\"sha256\":\"")) {
    return false;
  }
  return setfarm_fixture_output_sha256_v2(
      output, entry->content_sha256) &&
    setfarm_fixture_output_literal_v2(output, "\"}}");
}

static bool
setfarm_fixture_output_recursive_frame_v2(
  setfarm_fixture_output_v2 *output,
  const setfarm_aggregate_census_recursive_evidence_v2 *recursive)
{
  const char *status =
    setfarm_fixture_recursive_status_name_v2(recursive->status);
  size_t start = output->length;
  size_t index;
  if (status == NULL ||
      (recursive->status ==
         SETFARM_AGGREGATE_CENSUS_RECURSIVE_COMPLETE_V2
       ? recursive->entry_count !=
           SETFARM_AGGREGATE_CENSUS_NODE_RECURSIVE_ENTRY_COUNT_V2
       : recursive->entry_count != 0) ||
      !setfarm_fixture_output_format_v2(
        output,
        "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-node-recursive-evidence.v3\","
        "\"admissionScope\":\"test_fixture\","
        "\"productionAuthority\":false,"
        "\"joinStatus\":\"native_capture_only_requires_ts_aggregate_join_v2\","
        "\"rootBasename\":\"%s\",\"status\":\"%s\","
        "\"entryCount\":%zu,\"orderedEntries\":[",
        SETFARM_AGGREGATE_CENSUS_NODE_ROOT_NAME_V2,
        status,
        recursive->entry_count)) {
    return false;
  }
  for (index = 0; index < recursive->entry_count; index += 1) {
    if (recursive->entries[index].role !=
          (setfarm_aggregate_census_recursive_role_v2)(index + 1) ||
        (index > 0 && !setfarm_fixture_output_literal_v2(output, ",")) ||
        !setfarm_fixture_output_recursive_entry_v2(
          output, &recursive->entries[index])) {
      return false;
    }
  }
  if (!setfarm_fixture_output_literal_v2(output, "]}\n")) {
    return false;
  }
  return output->length - start <=
    SETFARM_AGGREGATE_CENSUS_RECURSIVE_FRAME_MAX_BYTES_V2;
}

static bool
setfarm_fixture_serialize_recursive_v2(
  const setfarm_aggregate_census_result_v2 *result,
  setfarm_fixture_output_v2 *output)
{
  size_t index;
  if (!setfarm_fixture_output_literal_v2(
        output,
        "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-header.v3\","
        "\"admissionScope\":\"test_fixture\","
        "\"capability\":\"darwin_read_only_aggregate_census_with_node_recursive_evidence_fixture_v3\","
        "\"productionAuthority\":false,"
        "\"signingAuthority\":\"adhoc_or_unsigned_test_fixture\","
        "\"observationAuthority\":\"fixture_evidence_only_never_backend_capability_v2\","
        "\"capturePasses\":2,"
        "\"recursiveEvidencePolicy\":\"code_owned_exact_node_tree_descriptor_relative_v3\","
        "\"lockOrder\":[\"shared_parent_lock\","
          "\"registered_node_package_lock\"]}\n") ||
      !setfarm_fixture_output_parent_v2(output, &result->parent_stat) ||
      !setfarm_fixture_output_locks_v2(output, result)) {
    return false;
  }
  for (index = 0; index < result->entry_count; index += 1) {
    if (!setfarm_fixture_output_entry_v2(output, &result->entries[index])) {
      return false;
    }
  }
  if (!setfarm_fixture_output_recursive_frame_v2(
        output, &result->node_recursive_evidence)) {
    return false;
  }
  return setfarm_fixture_output_format_v2(
    output,
    "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v3\","
    "\"namespaceEntryCount\":%zu,\"recursiveFrameCount\":1,"
    "\"frameCount\":%zu,\"completed\":true}\n",
    result->entry_count,
    result->entry_count + 5);
}

static bool
setfarm_fixture_serialize_v2(
  const setfarm_aggregate_census_result_v2 *result,
  setfarm_fixture_output_v2 *output)
{
  size_t index;
  if (!setfarm_fixture_output_header_v2(output) ||
      !setfarm_fixture_output_parent_v2(output, &result->parent_stat) ||
      !setfarm_fixture_output_locks_v2(output, result)) {
    return false;
  }
  for (index = 0; index < result->entry_count; index += 1) {
    if (!setfarm_fixture_output_entry_v2(output, &result->entries[index])) {
      return false;
    }
  }
  return setfarm_fixture_output_format_v2(
    output,
    "{\"schema\":\"setfarm.platform-release-bootstrap-darwin-aggregate-census-fixture-stream-footer.v2\","
    "\"entryCount\":%zu,\"frameCount\":%zu,\"completed\":true}\n",
    result->entry_count,
    result->entry_count + 4);
}

static bool
setfarm_fixture_write_all_v2(const uint8_t *bytes, size_t length)
{
  size_t offset = 0;
  while (offset < length) {
    ssize_t count = write(STDOUT_FILENO, bytes + offset, length - offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      return false;
    }
    offset += (size_t)count;
  }
  return true;
}

static bool
setfarm_fixture_write_probe_result_v2(
  const uint8_t *bytes,
  size_t length)
{
  size_t offset = 0;
  if (length == 0 || length > SETFARM_EXACT_RELEASE_PROBE_OUTPUT_MAX_BYTES_V2) {
    errno = EOVERFLOW;
    return false;
  }
  while (offset < length) {
    ssize_t count = write(
      SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
      bytes + offset,
      length - offset);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count <= 0) {
      return false;
    }
    offset += (size_t)count;
  }
  return true;
}

static bool
setfarm_fixture_monotonic_milliseconds_v2(uint64_t *milliseconds_out)
{
  struct timespec current;
  uint64_t seconds;
  if (clock_gettime(CLOCK_MONOTONIC, &current) != 0 ||
      current.tv_sec < 0 || current.tv_nsec < 0 ||
      current.tv_nsec >= 1000000000L) {
    return false;
  }
  seconds = (uint64_t)current.tv_sec;
  if (seconds > (UINT64_MAX - 999U) / 1000U) {
    errno = EOVERFLOW;
    return false;
  }
  *milliseconds_out = seconds * 1000U +
    (uint64_t)current.tv_nsec / 1000000U;
  return true;
}

static bool
setfarm_fixture_protocol_deadline_v2(uint64_t *deadline_out)
{
  uint64_t current;
  uint64_t duration =
    SETFARM_FIXTURE_PROTOCOL_IO_TIMEOUT_SECONDS_V2 * 1000U;
  if (!setfarm_fixture_monotonic_milliseconds_v2(&current) ||
      current > UINT64_MAX - duration) {
    errno = EOVERFLOW;
    return false;
  }
  *deadline_out = current + duration;
  return true;
}

static bool
setfarm_fixture_protocol_wait_v2(
  int fd,
  short requested,
  uint64_t deadline)
{
  for (;;) {
    struct pollfd descriptor;
    uint64_t current;
    uint64_t remaining;
    int timeout;
    int count;
    if (!setfarm_fixture_monotonic_milliseconds_v2(&current)) {
      return false;
    }
    if (current >= deadline) {
      errno = ETIMEDOUT;
      return false;
    }
    remaining = deadline - current;
    timeout = remaining > (uint64_t)INT_MAX
      ? INT_MAX
      : (int)remaining;
    memset(&descriptor, 0, sizeof(descriptor));
    descriptor.fd = fd;
    descriptor.events = requested;
    count = poll(&descriptor, (nfds_t)1, timeout);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0) {
      return false;
    }
    if (count == 0) {
      errno = ETIMEDOUT;
      return false;
    }
    if ((descriptor.revents & POLLNVAL) != 0) {
      errno = EBADF;
      return false;
    }
    if ((descriptor.revents & requested) != 0 ||
        (requested == POLLIN &&
         (descriptor.revents & POLLHUP) != 0)) {
      return true;
    }
    if ((descriptor.revents & (POLLERR | POLLHUP)) != 0) {
      errno = EPIPE;
      return false;
    }
  }
}

static bool
setfarm_fixture_protocol_write_exact_v2(
  int fd,
  const uint8_t *bytes,
  size_t length,
  uint64_t deadline)
{
  size_t offset = 0;
  while (offset < length) {
    ssize_t count = write(fd, bytes + offset, length - offset);
    if (count > 0) {
      offset += (size_t)count;
      continue;
    }
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
      if (!setfarm_fixture_protocol_wait_v2(fd, POLLOUT, deadline)) {
        return false;
      }
      continue;
    }
    if (count == 0) {
      errno = EPIPE;
    }
    return false;
  }
  return true;
}

static bool
setfarm_fixture_protocol_read_exact_v2(
  int fd,
  uint8_t *bytes,
  size_t length,
  uint64_t deadline)
{
  size_t offset = 0;
  while (offset < length) {
    ssize_t count = read(fd, bytes + offset, length - offset);
    if (count > 0) {
      offset += (size_t)count;
      continue;
    }
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
      if (!setfarm_fixture_protocol_wait_v2(fd, POLLIN, deadline)) {
        return false;
      }
      continue;
    }
    errno = count == 0 ? EPROTO : errno;
    return false;
  }
  return true;
}

static bool
setfarm_fixture_protocol_require_write_eof_v2(
  int fd,
  uint64_t deadline)
{
  uint8_t trailing = 0;
  for (;;) {
    ssize_t count = read(fd, &trailing, 1);
    if (count == 0) {
      trailing = 0;
      return true;
    }
    if (count > 0) {
      trailing = 0;
      errno = EPROTO;
      return false;
    }
    if (errno == EINTR) {
      continue;
    }
    if (errno == EAGAIN || errno == EWOULDBLOCK) {
      if (!setfarm_fixture_protocol_wait_v2(fd, POLLIN, deadline)) {
        trailing = 0;
        return false;
      }
      continue;
    }
    trailing = 0;
    return false;
  }
}

static void
setfarm_fixture_protocol_u32_v2(uint32_t value, uint8_t bytes[4])
{
  bytes[0] = (uint8_t)((value >> 24) & 0xffU);
  bytes[1] = (uint8_t)((value >> 16) & 0xffU);
  bytes[2] = (uint8_t)((value >> 8) & 0xffU);
  bytes[3] = (uint8_t)(value & 0xffU);
}

static uint32_t
setfarm_fixture_protocol_read_u32_v2(const uint8_t bytes[4])
{
  return ((uint32_t)bytes[0] << 24) |
    ((uint32_t)bytes[1] << 16) |
    ((uint32_t)bytes[2] << 8) |
    (uint32_t)bytes[3];
}

static bool
setfarm_fixture_protocol_bytes_equal_v2(
  const uint8_t *left,
  const uint8_t *right,
  size_t length)
{
  uint8_t different = 0;
  size_t index;
  for (index = 0; index < length; index += 1) {
    different |= (uint8_t)(left[index] ^ right[index]);
  }
  return different == 0;
}

static bool
setfarm_fixture_protocol_write_frame_v2(
  setfarm_fixture_protocol_type_v2 type,
  const uint8_t *payload,
  size_t payload_length)
{
  uint8_t header[4];
  uint8_t type_byte = (uint8_t)type;
  uint64_t deadline;
  uint32_t body_length;
  bool ok;
  if (payload_length > (size_t)UINT32_MAX - 1 ||
      !setfarm_fixture_protocol_deadline_v2(&deadline)) {
    errno = EOVERFLOW;
    return false;
  }
  body_length = (uint32_t)(payload_length + 1);
  setfarm_fixture_protocol_u32_v2(body_length, header);
  ok = setfarm_fixture_protocol_write_exact_v2(
      SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
      header,
      sizeof(header),
      deadline) &&
    setfarm_fixture_protocol_write_exact_v2(
      SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
      &type_byte,
      1,
      deadline) &&
    setfarm_fixture_protocol_write_exact_v2(
      SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
      payload,
      payload_length,
      deadline);
  setfarm_fixture_zero_v2(header, sizeof(header));
  type_byte = 0;
  return ok;
}

static void
setfarm_fixture_protocol_u64_v2(uint64_t value, uint8_t bytes[8])
{
  bytes[0] = (uint8_t)((value >> 56) & 0xffU);
  bytes[1] = (uint8_t)((value >> 48) & 0xffU);
  bytes[2] = (uint8_t)((value >> 40) & 0xffU);
  bytes[3] = (uint8_t)((value >> 32) & 0xffU);
  bytes[4] = (uint8_t)((value >> 24) & 0xffU);
  bytes[5] = (uint8_t)((value >> 16) & 0xffU);
  bytes[6] = (uint8_t)((value >> 8) & 0xffU);
  bytes[7] = (uint8_t)(value & 0xffU);
}

static void
setfarm_fixture_slot_hash_v2(
  const uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2],
  size_t entry_index,
  const setfarm_aggregate_census_entry_v2 *entry,
  uint8_t slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2])
{
  static const uint8_t domain[] =
    "setfarm.darwin.descriptor-backed-member-slot.v2";
  CC_SHA256_CTX context;
  uint8_t index_bytes[4];
  uint8_t kind_byte;
  uint8_t device_bytes[8];
  uint8_t inode_bytes[8];
  setfarm_fixture_protocol_u32_v2((uint32_t)entry_index, index_bytes);
  setfarm_fixture_protocol_u64_v2(entry->stat.stable.device, device_bytes);
  setfarm_fixture_protocol_u64_v2(entry->stat.stable.inode, inode_bytes);
  kind_byte = (uint8_t)entry->stat.stable.object_kind;
  (void)CC_SHA256_Init(&context);
  (void)CC_SHA256_Update(&context, domain, sizeof(domain) - 1);
  (void)CC_SHA256_Update(&context, challenge,
    SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2);
  (void)CC_SHA256_Update(&context, index_bytes, sizeof(index_bytes));
  (void)CC_SHA256_Update(&context, &kind_byte, sizeof(kind_byte));
  (void)CC_SHA256_Update(&context, device_bytes, sizeof(device_bytes));
  (void)CC_SHA256_Update(&context, inode_bytes, sizeof(inode_bytes));
  (void)CC_SHA256_Final(slot, &context);
  setfarm_fixture_zero_v2(index_bytes, sizeof(index_bytes));
  setfarm_fixture_zero_v2(device_bytes, sizeof(device_bytes));
  setfarm_fixture_zero_v2(inode_bytes, sizeof(inode_bytes));
  kind_byte = 0;
}

static bool
setfarm_fixture_build_slot_catalog_v2(
  const setfarm_aggregate_census_result_v2 *observation,
  const uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2],
  uint8_t **catalog_out,
  size_t *catalog_length_out)
{
  uint8_t *catalog;
  size_t length;
  size_t index;
  if (observation == NULL || catalog_out == NULL ||
      catalog_length_out == NULL ||
      observation->entry_count > SETFARM_AGGREGATE_CENSUS_MAX_ENTRIES_V2 ||
      observation->entry_count >
        (SIZE_MAX - 4) / (size_t)37) {
    errno = EOVERFLOW;
    return false;
  }
  length = 4 + observation->entry_count * (size_t)37;
  if (length > SETFARM_AGGREGATE_CENSUS_SLOT_CATALOG_MAX_BYTES_V2) {
    errno = EOVERFLOW;
    return false;
  }
  catalog = (uint8_t *)calloc(1, length);
  if (catalog == NULL) {
    errno = ENOMEM;
    return false;
  }
  setfarm_fixture_protocol_u32_v2(
    (uint32_t)observation->entry_count, catalog);
  for (index = 0; index < observation->entry_count; index += 1) {
    uint8_t slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2];
    size_t offset = 4 + index * (size_t)37;
    size_t prior;
    setfarm_fixture_slot_hash_v2(
      challenge, index, &observation->entries[index], slot);
    for (prior = 0; prior < index; prior += 1) {
      if (setfarm_fixture_protocol_bytes_equal_v2(
            slot,
            catalog + 4 + prior * (size_t)37,
            SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2)) {
        setfarm_fixture_zero_v2(slot, sizeof(slot));
        setfarm_fixture_zero_v2(catalog, length);
        free(catalog);
        errno = EPROTO;
        return false;
      }
    }
    memcpy(catalog + offset, slot, sizeof(slot));
    setfarm_fixture_protocol_u32_v2((uint32_t)index, catalog + offset + 32);
    catalog[offset + 36] =
      (uint8_t)observation->entries[index].stat.stable.object_kind;
    setfarm_fixture_zero_v2(slot, sizeof(slot));
  }
  *catalog_out = catalog;
  *catalog_length_out = length;
  return true;
}

static bool
setfarm_fixture_read_slot_request_v2(
  uint8_t slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2])
{
  uint8_t header[4];
  uint8_t type;
  uint64_t deadline;
  uint32_t body_length;
  bool ok = false;
  memset(header, 0, sizeof(header));
  if (!setfarm_fixture_protocol_deadline_v2(&deadline) ||
      !setfarm_fixture_protocol_read_exact_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        header, sizeof(header), deadline)) {
    goto cleanup;
  }
  body_length = setfarm_fixture_protocol_read_u32_v2(header);
  if (body_length != 1 + SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2 ||
      !setfarm_fixture_protocol_read_exact_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        &type, sizeof(type), deadline) ||
      type != (uint8_t)SETFARM_FIXTURE_PROTOCOL_SLOT_CAPTURE_REQUEST_V2 ||
      !setfarm_fixture_protocol_read_exact_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        slot, SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2, deadline)) {
    errno = EPROTO;
    goto cleanup;
  }
  ok = true;
cleanup:
  setfarm_fixture_zero_v2(header, sizeof(header));
  type = 0;
  return ok;
}

static bool
setfarm_fixture_resolve_slot_index_v2(
  const setfarm_aggregate_census_result_v2 *observation,
  const uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2],
  const uint8_t requested_slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2],
  size_t *entry_index_out)
{
  size_t index;
  size_t found = 0;
  bool has_found = false;
  for (index = 0; index < observation->entry_count; index += 1) {
    uint8_t slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2];
    setfarm_fixture_slot_hash_v2(
      challenge, index, &observation->entries[index], slot);
    if (setfarm_fixture_protocol_bytes_equal_v2(
          slot, requested_slot,
          SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2)) {
      if (has_found) {
        setfarm_fixture_zero_v2(slot, sizeof(slot));
        errno = EPROTO;
        return false;
      }
      has_found = true;
      found = index;
    }
    setfarm_fixture_zero_v2(slot, sizeof(slot));
  }
  if (!has_found || entry_index_out == NULL) {
    errno = ENOENT;
    return false;
  }
  *entry_index_out = found;
  return true;
}

static bool
setfarm_fixture_write_slot_content_v2(
  uint8_t slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2],
  uint8_t observation_ordinal,
  const setfarm_aggregate_census_entry_v2 *entry)
{
  size_t chunk_count;
  size_t chunk_index;
  size_t total = entry->file_length;
  uint8_t *payload = NULL;
  size_t payload_length;
  if (entry->stat.stable.object_kind !=
        SETFARM_AGGREGATE_CENSUS_OBJECT_ORDINARY_FILE_V2 ||
      total > SETFARM_AGGREGATE_CENSUS_MAX_FILE_BYTES_V2) {
    errno = EINVAL;
    return false;
  }
  chunk_count = total == 0 ? 1 :
    (total + SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2 - 1) /
      SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2;
  if (chunk_count > 4) {
    errno = EOVERFLOW;
    return false;
  }
  payload = (uint8_t *)malloc(
    SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_FRAME_MAX_BYTES_V2);
  if (payload == NULL) {
    errno = ENOMEM;
    return false;
  }
  for (chunk_index = 0; chunk_index < chunk_count; chunk_index += 1) {
    size_t offset = chunk_index *
      SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2;
    size_t chunk_length = total == 0 ? 0 :
      (total - offset > SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2
        ? SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_CHUNK_BYTES_V2
        : total - offset);
    memcpy(payload, slot, SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2);
    payload[32] = observation_ordinal;
    setfarm_fixture_protocol_u32_v2((uint32_t)chunk_index, payload + 33);
    setfarm_fixture_protocol_u32_v2((uint32_t)chunk_count, payload + 37);
    setfarm_fixture_protocol_u64_v2((uint64_t)offset, payload + 41);
    setfarm_fixture_protocol_u64_v2((uint64_t)total, payload + 49);
    setfarm_fixture_protocol_u32_v2((uint32_t)chunk_length, payload + 57);
    if (chunk_length > 0) {
      memcpy(payload + SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_HEADER_BYTES_V2,
        entry->file_bytes + offset, chunk_length);
    }
    payload_length =
      SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_HEADER_BYTES_V2 + chunk_length;
    if (!setfarm_fixture_protocol_write_frame_v2(
          SETFARM_FIXTURE_PROTOCOL_SLOT_CONTENT_OBSERVATION_V2,
          payload, payload_length)) {
      setfarm_fixture_zero_v2(payload,
        SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_FRAME_MAX_BYTES_V2);
      free(payload);
      return false;
    }
  }
  setfarm_fixture_zero_v2(payload,
    SETFARM_AGGREGATE_CENSUS_SLOT_CONTENT_FRAME_MAX_BYTES_V2);
  free(payload);
  return true;
}

static bool
setfarm_fixture_protocol_read_ack_v2(
  const uint8_t expected_challenge[
    SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2],
  const uint8_t expected_aggregate_sha256[
    SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2],
  setfarm_fixture_protocol_ack_v2 *ack)
{
  uint8_t header[4];
  uint8_t body[SETFARM_FIXTURE_PROTOCOL_ACK_BODY_BYTES_V2];
  uint64_t deadline;
  uint32_t body_length;
  bool ok = false;
  memset(header, 0, sizeof(header));
  memset(body, 0, sizeof(body));
  memset(ack, 0, sizeof(*ack));
  if (!setfarm_fixture_protocol_deadline_v2(&deadline) ||
      !setfarm_fixture_protocol_read_exact_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        header,
        sizeof(header),
        deadline)) {
    goto cleanup;
  }
  body_length = setfarm_fixture_protocol_read_u32_v2(header);
  if (body_length != (uint32_t)sizeof(body) ||
      !setfarm_fixture_protocol_read_exact_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        body,
        sizeof(body),
        deadline) ||
      !setfarm_fixture_protocol_require_write_eof_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        deadline)) {
    errno = errno == 0 ? EPROTO : errno;
    goto cleanup;
  }
  if ((body[0] != (uint8_t)SETFARM_FIXTURE_PROTOCOL_ACK_ACCEPT_V2 &&
       body[0] != (uint8_t)SETFARM_FIXTURE_PROTOCOL_ACK_ABORT_V2) ||
      !setfarm_fixture_protocol_bytes_equal_v2(
        body + 1,
        expected_challenge,
        SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2) ||
      !setfarm_fixture_protocol_bytes_equal_v2(
        body + 1 + SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2,
        expected_aggregate_sha256,
        SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2)) {
    errno = EPROTO;
    goto cleanup;
  }
  ack->accept = body[0] ==
    (uint8_t)SETFARM_FIXTURE_PROTOCOL_ACK_ACCEPT_V2;
  memcpy(
    ack->challenge,
    body + 1,
    SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2);
  memcpy(
    ack->aggregate_sha256,
    body + 1 + SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2,
    SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2);
  memcpy(
    ack->semantic_ack_sha256,
    body + 1 + SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2 +
      SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2,
    SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2);
  ok = true;

cleanup:
  setfarm_fixture_zero_v2(header, sizeof(header));
  setfarm_fixture_zero_v2(body, sizeof(body));
  if (!ok) {
    setfarm_fixture_zero_v2(ack, sizeof(*ack));
  }
  return ok;
}

static bool
setfarm_fixture_protocol_write_terminal_v2(
  const setfarm_fixture_protocol_ack_v2 *ack)
{
  uint8_t payload[SETFARM_FIXTURE_PROTOCOL_TERMINAL_BODY_BYTES_V2 - 1];
  setfarm_fixture_protocol_type_v2 terminal_type = ack->accept
    ? SETFARM_FIXTURE_PROTOCOL_TERMINAL_ACCEPT_V2
    : SETFARM_FIXTURE_PROTOCOL_TERMINAL_ABORT_V2;
  bool ok;
  memset(payload, 0, sizeof(payload));
  memcpy(
    payload,
    ack->challenge,
    SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2);
  memcpy(
    payload + SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2,
    ack->aggregate_sha256,
    SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2);
  memcpy(
    payload + SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2 +
      SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2,
    ack->semantic_ack_sha256,
    SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2);
  payload[sizeof(payload) - 1] =
    (uint8_t)
      SETFARM_FIXTURE_PROTOCOL_AUTHORITY_SELF_ASSERTED_TEST_FIXTURE_V2;
  ok = setfarm_fixture_protocol_write_frame_v2(
    terminal_type, payload, sizeof(payload));
  setfarm_fixture_zero_v2(payload, sizeof(payload));
  return ok;
}

static int
setfarm_fixture_report_kernel_failure_v2(
  setfarm_aggregate_census_error_v2 code,
  const setfarm_aggregate_census_failure_v2 *failure)
{
  (void)fprintf(
    stderr,
    "fixture_failed code=%s errno=%d\n",
    setfarm_aggregate_census_error_name_v2(code),
    failure->system_errno);
  return 70;
}

static int
setfarm_fixture_run_exact_release_probe_v2(
  setfarm_fixture_checkpoint_context_v2 *checkpoint_context,
  setfarm_fixture_output_v2 *output)
{
  setfarm_aggregate_census_exact_release_probe_result_v2 result;
  setfarm_aggregate_census_failure_v2 failure;
  setfarm_aggregate_census_error_v2 code;
  uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2];
  int saved_errno;
  setfarm_aggregate_census_exact_release_probe_stop_v2 stop_checkpoint =
    SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_NONE_V2;

  memset(&result, 0, sizeof(result));
  memset(&failure, 0, sizeof(failure));
  memset(challenge, 0, sizeof(challenge));
  if (!setfarm_fixture_verify_pinned_running_binary_v2()) {
    return 65;
  }
  switch (checkpoint_context->mode) {
  case SETFARM_FIXTURE_CONTROL_EXACT_RELEASE_PROBE_V2:
    break;
  case SETFARM_FIXTURE_CONTROL_PROBE_SHARED_HELD_V2:
    stop_checkpoint =
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_SHARED_HELD_V2;
    break;
  case SETFARM_FIXTURE_CONTROL_PROBE_BOTH_HELD_V2:
    stop_checkpoint =
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_BOTH_HELD_V2;
    break;
  case SETFARM_FIXTURE_CONTROL_PROBE_NODE_RELEASED_V2:
    stop_checkpoint =
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_NODE_RELEASED_V2;
    break;
  case SETFARM_FIXTURE_CONTROL_PROBE_ALL_RELEASED_V2:
    stop_checkpoint =
      SETFARM_AGGREGATE_CENSUS_EXACT_RELEASE_PROBE_STOP_ALL_RELEASED_V2;
    break;
  default:
    (void)fprintf(stderr, "fixture_exact_release_probe_control_invalid\n");
    return 65;
  }
  if (getentropy(challenge, sizeof(challenge)) != 0) {
    saved_errno = errno;
    (void)fprintf(
      stderr,
      "fixture_exact_release_probe_challenge_failed errno=%d\n",
      saved_errno);
    setfarm_fixture_zero_v2(challenge, sizeof(challenge));
    return 74;
  }
  code = setfarm_aggregate_census_exact_release_probe_v2(
    SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
    stop_checkpoint,
    &result,
    &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    (void)fprintf(
      stderr,
      "fixture_exact_release_probe_failed code=%s errno=%d\n",
      setfarm_aggregate_census_error_name_v2(code),
      failure.system_errno);
    setfarm_fixture_zero_v2(challenge, sizeof(challenge));
    setfarm_fixture_zero_v2(&result, sizeof(result));
    setfarm_fixture_zero_v2(&failure, sizeof(failure));
    return 65;
  }
  if (!setfarm_fixture_output_exact_release_probe_v2(
        output, challenge, &result) ||
      !setfarm_fixture_write_probe_result_v2(
        output->bytes, output->length)) {
    saved_errno = errno;
    (void)fprintf(
      stderr,
      "fixture_exact_release_probe_output_failed errno=%d\n",
      saved_errno);
    setfarm_fixture_zero_v2(challenge, sizeof(challenge));
    setfarm_fixture_zero_v2(&result, sizeof(result));
    setfarm_fixture_zero_v2(&failure, sizeof(failure));
    return 74;
  }
  setfarm_fixture_zero_v2(challenge, sizeof(challenge));
  setfarm_fixture_zero_v2(&result, sizeof(result));
  setfarm_fixture_zero_v2(&failure, sizeof(failure));
  return 0;
}

static int
setfarm_fixture_run_legacy_v2(
  setfarm_fixture_checkpoint_context_v2 *checkpoint_context,
  setfarm_fixture_output_v2 *output)
{
  setfarm_aggregate_census_result_v2 result;
  setfarm_aggregate_census_failure_v2 failure;
  setfarm_aggregate_census_error_v2 code;
  memset(&result, 0, sizeof(result));
  memset(&failure, 0, sizeof(failure));
  code = setfarm_aggregate_census_capture_v2(
    SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
    setfarm_fixture_checkpoint_v2,
    checkpoint_context,
    &result,
    &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    setfarm_aggregate_census_result_dispose_v2(&result);
    return setfarm_fixture_report_kernel_failure_v2(code, &failure);
  }
  if (!setfarm_fixture_serialize_v2(&result, output)) {
    (void)fprintf(stderr, "fixture_serialization_failed\n");
    setfarm_aggregate_census_result_dispose_v2(&result);
    return 74;
  }
  setfarm_aggregate_census_result_dispose_v2(&result);
  return 0;
}

static int
setfarm_fixture_run_session_v2(
  setfarm_fixture_checkpoint_context_v2 *checkpoint_context,
  setfarm_fixture_output_v2 *output,
  bool capture_recursive)
{
  setfarm_aggregate_census_session_v2 *session = NULL;
  setfarm_aggregate_census_session_v2 *preserved_session;
  const setfarm_aggregate_census_result_v2 *observation = NULL;
  setfarm_aggregate_census_failure_v2 failure;
  setfarm_aggregate_census_error_v2 code;
  bool equal = false;

  memset(&failure, 0, sizeof(failure));
  code = capture_recursive
    ? setfarm_aggregate_census_composite_session_open_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
        setfarm_fixture_checkpoint_v2,
        checkpoint_context,
        &session,
        &failure)
    : setfarm_aggregate_census_session_open_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
        setfarm_fixture_checkpoint_v2,
        checkpoint_context,
        &session,
        &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return setfarm_fixture_report_kernel_failure_v2(code, &failure);
  }
  if (checkpoint_context->mode ==
      SETFARM_FIXTURE_CONTROL_SESSION_SECOND_OPEN_V2) {
    static const char marker[] = "fixture_checkpoint_session_second_open\n";
    preserved_session = session;
    code = setfarm_aggregate_census_session_open_v2(
      SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
      setfarm_fixture_checkpoint_v2,
      checkpoint_context,
      &session,
      &failure);
    if (code != SETFARM_AGGREGATE_CENSUS_INVALID_ARGUMENT_V2 ||
        session != preserved_session) {
      (void)setfarm_aggregate_census_session_abort_v2(&session, &failure);
      (void)fprintf(stderr, "fixture_second_open_invariant_failed\n");
      return 70;
    }
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  }
  code = setfarm_aggregate_census_session_observation_v2(
    &session, &observation, &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return setfarm_fixture_report_kernel_failure_v2(code, &failure);
  }
  if (!(capture_recursive
          ? setfarm_fixture_serialize_recursive_v2(observation, output)
          : setfarm_fixture_serialize_v2(observation, output))) {
    (void)setfarm_aggregate_census_session_abort_v2(&session, &failure);
    (void)fprintf(stderr, "fixture_serialization_failed\n");
    return 74;
  }
  code = setfarm_aggregate_census_session_recapture_equal_v2(
    &session,
    setfarm_fixture_checkpoint_v2,
    checkpoint_context,
    &equal,
    &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 || !equal) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
      failure.code = code;
      failure.system_errno = 0;
      (void)setfarm_aggregate_census_session_abort_v2(&session, &failure);
    }
    return setfarm_fixture_report_kernel_failure_v2(code, &failure);
  }
  code = setfarm_aggregate_census_session_close_v2(&session, &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    return setfarm_fixture_report_kernel_failure_v2(code, &failure);
  }
  return 0;
}

static int
setfarm_fixture_run_live_v2(
  setfarm_fixture_checkpoint_context_v2 *checkpoint_context,
  setfarm_fixture_output_v2 *output,
  bool capture_recursive,
  bool allow_recursive_semantic_accept,
  bool slot_ledger_live)
{
  setfarm_aggregate_census_session_v2 *session = NULL;
  const setfarm_aggregate_census_result_v2 *observation = NULL;
  setfarm_aggregate_census_failure_v2 failure;
  setfarm_aggregate_census_failure_v2 cleanup_failure;
  setfarm_aggregate_census_error_v2 code;
  setfarm_fixture_protocol_ack_v2 ack;
  uint8_t challenge[SETFARM_FIXTURE_PROTOCOL_CHALLENGE_BYTES_V2];
  uint8_t aggregate_sha256[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2];
  int protocol_flags;
  int failure_errno = 0;
  int status = 74;
  bool equal = false;
  uint8_t *slot_catalog = NULL;
  size_t slot_catalog_length = 0;
  uint8_t requested_slot[SETFARM_FIXTURE_PROTOCOL_SHA256_BYTES_V2];
  size_t selected_entry_index = 0;
  setfarm_aggregate_census_exact_entry_capture_v2 exact_capture;
  bool exact_capture_ready = false;

  memset(&failure, 0, sizeof(failure));
  memset(&cleanup_failure, 0, sizeof(cleanup_failure));
  memset(&ack, 0, sizeof(ack));
  memset(challenge, 0, sizeof(challenge));
  memset(aggregate_sha256, 0, sizeof(aggregate_sha256));
  memset(requested_slot, 0, sizeof(requested_slot));
  memset(&exact_capture, 0, sizeof(exact_capture));
  if (signal(SIGPIPE, SIG_IGN) == SIG_ERR ||
      getentropy(challenge, sizeof(challenge)) != 0) {
    failure_errno = errno;
    goto cleanup;
  }
  protocol_flags = fcntl(
    SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2, F_GETFL);
  if (protocol_flags < 0 ||
      fcntl(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PROTOCOL_FD_V2,
        F_SETFL,
        protocol_flags | O_NONBLOCK) != 0) {
    failure_errno = errno;
    goto cleanup;
  }
  code = capture_recursive
    ? setfarm_aggregate_census_composite_session_open_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
        NULL,
        NULL,
        &session,
        &failure)
    : setfarm_aggregate_census_session_open_v2(
        SETFARM_AGGREGATE_CENSUS_FIXTURE_PARENT_FD_V2,
        NULL,
        NULL,
        &session,
        &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    status = setfarm_fixture_report_kernel_failure_v2(code, &failure);
    goto cleanup;
  }
  code = setfarm_aggregate_census_session_observation_v2(
    &session, &observation, &failure);
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
    status = setfarm_fixture_report_kernel_failure_v2(code, &failure);
    goto cleanup;
  }
  if (!(capture_recursive
          ? setfarm_fixture_serialize_recursive_v2(observation, output)
          : setfarm_fixture_serialize_v2(observation, output)) ||
      output->length > SETFARM_AGGREGATE_CENSUS_MAX_OUTPUT_BYTES_V2 ||
      output->length > (size_t)UINT_MAX ||
      CC_SHA256(
        output->bytes,
        (CC_LONG)output->length,
        aggregate_sha256) == NULL) {
    (void)fprintf(stderr, "fixture_live_observation_failed\n");
    status = 74;
    goto cleanup;
  }
  if (!setfarm_fixture_protocol_write_frame_v2(
        SETFARM_FIXTURE_PROTOCOL_OPEN_V2,
        challenge,
        sizeof(challenge)) ||
      !setfarm_fixture_protocol_write_frame_v2(
        SETFARM_FIXTURE_PROTOCOL_OBSERVATION_V2,
        output->bytes,
        output->length)) {
    failure_errno = errno;
    (void)fprintf(
      stderr, "fixture_live_protocol_write_failed errno=%d\n",
      failure_errno);
    status = 74;
    goto cleanup;
  }
  if (slot_ledger_live) {
    if (!setfarm_fixture_build_slot_catalog_v2(
          observation,
          challenge,
          &slot_catalog,
          &slot_catalog_length) ||
        !setfarm_fixture_protocol_write_frame_v2(
          SETFARM_FIXTURE_PROTOCOL_SLOT_CATALOG_V2,
          slot_catalog,
          slot_catalog_length)) {
      failure_errno = errno;
      (void)fprintf(
        stderr, "fixture_slot_catalog_failed errno=%d\n", failure_errno);
      status = 74;
      goto cleanup;
    }
    setfarm_fixture_zero_v2(slot_catalog, slot_catalog_length);
    free(slot_catalog);
    slot_catalog = NULL;
    slot_catalog_length = 0;
    if (!setfarm_fixture_read_slot_request_v2(requested_slot) ||
        !setfarm_fixture_resolve_slot_index_v2(
          observation,
          challenge,
          requested_slot,
          &selected_entry_index)) {
      failure_errno = errno;
      (void)fprintf(
        stderr, "fixture_slot_request_invalid errno=%d\n", failure_errno);
      status = 65;
      goto cleanup;
    }
    code = setfarm_aggregate_census_session_capture_exact_entry_v2(
      &session,
      selected_entry_index,
      setfarm_fixture_checkpoint_v2,
      checkpoint_context,
      &exact_capture,
      &failure);
    if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
      status = setfarm_fixture_report_kernel_failure_v2(code, &failure);
      goto cleanup;
    }
    exact_capture_ready = true;
    if (!setfarm_fixture_write_slot_content_v2(
          requested_slot,
          0,
          &exact_capture.first_observation) ||
        !setfarm_fixture_write_slot_content_v2(
          requested_slot,
          1,
          &exact_capture.second_observation)) {
      failure_errno = errno;
      (void)fprintf(
        stderr, "fixture_slot_content_write_failed errno=%d\n",
        failure_errno);
      status = 74;
      goto cleanup;
    }
    setfarm_aggregate_census_exact_entry_capture_dispose_v2(&exact_capture);
    exact_capture_ready = false;
  }
  if (!setfarm_fixture_protocol_read_ack_v2(
        challenge, aggregate_sha256, &ack)) {
    failure_errno = errno;
    (void)fprintf(
      stderr, "fixture_live_ack_invalid errno=%d\n", failure_errno);
    status = 65;
    goto cleanup;
  }
  if (capture_recursive && ack.accept &&
      !allow_recursive_semantic_accept) {
    (void)fprintf(
      stderr, "fixture_recursive_accept_requires_ts_semantic_join\n");
    status = 65;
    goto cleanup;
  }
  if (capture_recursive && ack.accept &&
      allow_recursive_semantic_accept &&
      observation->node_recursive_evidence.status !=
        SETFARM_AGGREGATE_CENSUS_RECURSIVE_COMPLETE_V2) {
    (void)fprintf(
      stderr,
      "fixture_recursive_semantic_accept_requires_complete_evidence\n");
    status = 65;
    goto cleanup;
  }
  if (ack.accept) {
    code = setfarm_aggregate_census_session_recapture_equal_v2(
      &session, NULL, NULL, &equal, &failure);
    if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 || !equal) {
      if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
        code = SETFARM_AGGREGATE_CENSUS_MEMBERSHIP_CHANGED_V2;
        failure.system_errno = 0;
      }
      status = setfarm_fixture_report_kernel_failure_v2(code, &failure);
      goto cleanup;
    }
    code = setfarm_aggregate_census_session_close_v2(&session, &failure);
  } else {
    code = setfarm_aggregate_census_session_abort_v2(&session, &failure);
  }
  if (code != SETFARM_AGGREGATE_CENSUS_OK_V2 || session != NULL) {
    if (code == SETFARM_AGGREGATE_CENSUS_OK_V2) {
      code = SETFARM_AGGREGATE_CENSUS_RELEASE_FAILED_V2;
      failure.system_errno = 0;
    }
    status = setfarm_fixture_report_kernel_failure_v2(code, &failure);
    goto cleanup;
  }
  if (checkpoint_context->mode ==
      SETFARM_FIXTURE_CONTROL_LIVE_RELEASE_STOP_V2) {
    static const char marker[] =
      "fixture_checkpoint_live_release_complete\n";
    setfarm_fixture_stop_v2(marker, sizeof(marker) - 1);
  }
  if (!setfarm_fixture_protocol_write_terminal_v2(&ack)) {
    failure_errno = errno;
    (void)fprintf(
      stderr, "fixture_live_terminal_write_failed errno=%d\n",
      failure_errno);
    status = 74;
    goto cleanup;
  }
  status = 0;

cleanup:
  if (slot_catalog != NULL) {
    setfarm_fixture_zero_v2(slot_catalog, slot_catalog_length);
    free(slot_catalog);
    slot_catalog = NULL;
    slot_catalog_length = 0;
  }
  if (exact_capture_ready) {
    setfarm_aggregate_census_exact_entry_capture_dispose_v2(&exact_capture);
    exact_capture_ready = false;
  }
  if (session != NULL) {
    code = setfarm_aggregate_census_session_abort_v2(
      &session, &cleanup_failure);
    if (code != SETFARM_AGGREGATE_CENSUS_OK_V2) {
      (void)fprintf(
        stderr,
        "fixture_live_cleanup_failed code=%s errno=%d\n",
        setfarm_aggregate_census_error_name_v2(code),
        cleanup_failure.system_errno);
      status = 70;
    }
  }
  setfarm_fixture_zero_v2(&ack, sizeof(ack));
  setfarm_fixture_zero_v2(challenge, sizeof(challenge));
  setfarm_fixture_zero_v2(
    aggregate_sha256, sizeof(aggregate_sha256));
  setfarm_fixture_zero_v2(requested_slot, sizeof(requested_slot));
  failure_errno = 0;
  protocol_flags = 0;
  equal = false;
  return status;
}

int
main(int argc, char **argv)
{
  uint8_t control[SETFARM_AGGREGATE_CENSUS_CONTROL_MAX_BYTES_V2];
  size_t used = 0;
  setfarm_fixture_checkpoint_context_v2 checkpoint_context;
  setfarm_fixture_output_v2 output;
  int run_status;

  (void)argv;
  memset(control, 0, sizeof(control));
  memset(&checkpoint_context, 0, sizeof(checkpoint_context));
  memset(&output, 0, sizeof(output));
  if (argc != 1) {
    (void)fprintf(stderr, "fixture_accepts_no_arguments\n");
    return 64;
  }
  for (;;) {
    ssize_t count;
    if (used == sizeof(control)) {
      uint8_t overflow = 0;
      do {
        count = read(STDIN_FILENO, &overflow, 1);
      } while (count < 0 && errno == EINTR);
      overflow = 0;
      if (count != 0) {
        (void)fprintf(stderr, "fixture_stdin_exceeds_bound\n");
        setfarm_fixture_zero_v2(control, sizeof(control));
        return 65;
      }
      break;
    }
    count = read(STDIN_FILENO, control + used, sizeof(control) - used);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0) {
      (void)fprintf(stderr, "fixture_stdin_read_failed errno=%d\n", errno);
      setfarm_fixture_zero_v2(control, sizeof(control));
      return 74;
    }
    if (count == 0) {
      break;
    }
    used += (size_t)count;
  }
  if (!setfarm_fixture_parse_control_v2(
        control, used, &checkpoint_context)) {
    (void)fprintf(stderr, "fixture_stdin_frame_invalid\n");
    setfarm_fixture_zero_v2(control, sizeof(control));
    return 65;
  }
  setfarm_fixture_zero_v2(control, sizeof(control));

  if (checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_EXACT_RELEASE_PROBE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_PROBE_SHARED_HELD_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_PROBE_BOTH_HELD_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_PROBE_NODE_RELEASED_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_PROBE_ALL_RELEASED_V2) {
    run_status = setfarm_fixture_run_exact_release_probe_v2(
      &checkpoint_context, &output);
    setfarm_fixture_output_dispose_v2(&output);
    return run_status;
  }

  if (checkpoint_context.mode == SETFARM_FIXTURE_CONTROL_SESSION_LIVE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_LIVE_RELEASE_STOP_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_SESSION_LIVE_RECURSIVE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_RECURSIVE_SEMANTIC_LIVE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_SEMANTIC_PINNED_LIVE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_LIVE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_DRIFT_V2) {
    if (checkpoint_context.mode ==
          SETFARM_FIXTURE_CONTROL_SEMANTIC_PINNED_LIVE_V2 &&
        !setfarm_fixture_verify_pinned_running_binary_v2()) {
      setfarm_fixture_output_dispose_v2(&output);
      return 65;
    }
    run_status = setfarm_fixture_run_live_v2(
      &checkpoint_context,
      &output,
      checkpoint_context.mode ==
          SETFARM_FIXTURE_CONTROL_SESSION_LIVE_RECURSIVE_V2 ||
        checkpoint_context.mode ==
          SETFARM_FIXTURE_CONTROL_RECURSIVE_SEMANTIC_LIVE_V2 ||
        checkpoint_context.mode ==
          SETFARM_FIXTURE_CONTROL_SEMANTIC_PINNED_LIVE_V2,
      checkpoint_context.mode ==
          SETFARM_FIXTURE_CONTROL_RECURSIVE_SEMANTIC_LIVE_V2 ||
        checkpoint_context.mode ==
          SETFARM_FIXTURE_CONTROL_SEMANTIC_PINNED_LIVE_V2,
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_LIVE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_SLOT_LEDGER_DRIFT_V2);
    setfarm_fixture_output_dispose_v2(&output);
    return run_status;
  }
  if (checkpoint_context.mode == SETFARM_FIXTURE_CONTROL_LEGACY_NONE_V2 ||
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_LEGACY_AFTER_FIRST_PASS_V2) {
    run_status = setfarm_fixture_run_legacy_v2(
      &checkpoint_context, &output);
  } else {
    run_status = setfarm_fixture_run_session_v2(
      &checkpoint_context,
      &output,
      checkpoint_context.mode ==
        SETFARM_FIXTURE_CONTROL_RECURSIVE_REVALIDATE_V2);
  }
  if (run_status != 0) {
    setfarm_fixture_output_dispose_v2(&output);
    return run_status;
  }
  if (!setfarm_fixture_write_all_v2(output.bytes, output.length)) {
    (void)fprintf(stderr, "fixture_stdout_write_failed errno=%d\n", errno);
    setfarm_fixture_output_dispose_v2(&output);
    return 74;
  }
  setfarm_fixture_output_dispose_v2(&output);
  return 0;
}
