#include "platform-release-bootstrap-filesystem-kernel-v2.h"

#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <signal.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define SETFARM_FIXTURE_ROOT_FD_V2 3
#define SETFARM_FIXTURE_TIMING_FD_V2 4
#define SETFARM_FIXTURE_CONTROL_MAX_V2 ((size_t)96)
#define SETFARM_FIXTURE_TIMING_FRAME_MAX_V2 ((size_t)8192)

typedef struct setfarm_fixture_checkpoint_context_v2 {
  bool enabled;
  bool timing_enabled;
  setfarm_bootstrap_scope_checkpoint_v2 selected;
  const char *selected_name;
  setfarm_bootstrap_scope_timing_v2 *timing;
  uint64_t run_started_nanoseconds;
  size_t payload_byte_length;
} setfarm_fixture_checkpoint_context_v2;

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
setfarm_fixture_parse_checkpoint_v2(
  const uint8_t *text,
  size_t length,
  setfarm_fixture_checkpoint_context_v2 *context)
{
#define SETFARM_TIMING_PREFIX_V2 "timing_"
#define SETFARM_MATCH_CHECKPOINT_V2(literal, value) \
  if (checkpoint_length == sizeof(literal) - 1 && \
      memcmp(checkpoint_text, literal, sizeof(literal) - 1) == 0) { \
    context->enabled = true; \
    context->selected = value; \
    context->selected_name = literal; \
    return true; \
  }
  const uint8_t *checkpoint_text = text;
  size_t checkpoint_length = length;
  context->enabled = false;
  context->timing_enabled = false;
  context->selected_name = "completed";
  if (length > sizeof(SETFARM_TIMING_PREFIX_V2) - 1 &&
      memcmp(
        text,
        SETFARM_TIMING_PREFIX_V2,
        sizeof(SETFARM_TIMING_PREFIX_V2) - 1) == 0) {
    context->timing_enabled = true;
    checkpoint_text += sizeof(SETFARM_TIMING_PREFIX_V2) - 1;
    checkpoint_length -= sizeof(SETFARM_TIMING_PREFIX_V2) - 1;
  }
  if (checkpoint_length == sizeof("none") - 1 &&
      memcmp(checkpoint_text, "none", sizeof("none") - 1) == 0) {
    return true;
  }
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_stage_write",
    SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_WRITE_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_stage_fullsync",
    SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_STAGE_FULLSYNC_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_parent_fullsync_before_link",
    SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_PARENT_FULLSYNC_BEFORE_LINK_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_link", SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_LINK_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_target_fullsync",
    SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_TARGET_FULLSYNC_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_parent_fullsync_before_unlink",
    SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_PARENT_FULLSYNC_BEFORE_UNLINK_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_unlink", SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_UNLINK_V2)
  SETFARM_MATCH_CHECKPOINT_V2(
    "after_final_parent_fullsync",
    SETFARM_BOOTSTRAP_SCOPE_CHECKPOINT_AFTER_FINAL_PARENT_FULLSYNC_V2)
  return false;
#undef SETFARM_MATCH_CHECKPOINT_V2
#undef SETFARM_TIMING_PREFIX_V2
}

static bool
setfarm_fixture_raw_now_v2(uint64_t *nanoseconds)
{
#if defined(__APPLE__) && defined(CLOCK_MONOTONIC_RAW)
  struct timespec value;
  uint64_t seconds;
  uint64_t subsecond_nanoseconds;
  if (nanoseconds == NULL || clock_gettime(CLOCK_MONOTONIC_RAW, &value) != 0 ||
      value.tv_sec < 0 || value.tv_nsec < 0 || value.tv_nsec >= 1000000000L) {
    return false;
  }
  seconds = (uint64_t)value.tv_sec;
  subsecond_nanoseconds = (uint64_t)value.tv_nsec;
  if (seconds >
      (UINT64_MAX - subsecond_nanoseconds) / UINT64_C(1000000000)) {
    return false;
  }
  *nanoseconds =
    seconds * UINT64_C(1000000000) + subsecond_nanoseconds;
  return true;
#else
  (void)nanoseconds;
  return false;
#endif
}

static bool
setfarm_fixture_append_v2(
  char *output,
  size_t capacity,
  size_t *used,
  const char *format,
  ...)
{
  va_list arguments;
  int count;
  if (output == NULL || used == NULL || format == NULL || *used >= capacity) {
    return false;
  }
  va_start(arguments, format);
  count = vsnprintf(output + *used, capacity - *used, format, arguments);
  va_end(arguments);
  if (count < 0 || (size_t)count >= capacity - *used) {
    return false;
  }
  *used += (size_t)count;
  return true;
}

static bool
setfarm_fixture_write_exact_v2(int fd, const uint8_t *bytes, size_t length)
{
  size_t offset = 0;
  while (offset < length) {
    ssize_t count = write(fd, bytes + offset, length - offset);
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
setfarm_fixture_emit_timing_v2(
  const setfarm_fixture_checkpoint_context_v2 *context,
  const char *checkpoint)
{
  char output[SETFARM_FIXTURE_TIMING_FRAME_MAX_V2];
  uint64_t finished_nanoseconds;
  uint64_t elapsed_nanoseconds;
  size_t used = 0;
  uint32_t index;
  const setfarm_bootstrap_scope_timing_v2 *timing = context->timing;
  if (timing == NULL || checkpoint == NULL ||
      timing->monotonic_raw_clock_available != 1 ||
      timing->recording_truncated != 0 ||
      timing->recorded_full_sync_count != timing->full_sync_call_count ||
      !setfarm_fixture_raw_now_v2(&finished_nanoseconds) ||
      finished_nanoseconds < context->run_started_nanoseconds) {
    return false;
  }
  elapsed_nanoseconds =
    finished_nanoseconds - context->run_started_nanoseconds;
  if (!setfarm_fixture_append_v2(
        output, sizeof(output), &used,
        "{\"admissionScope\":\"test_fixture\","
        "\"characterizationClaim\":\"syscall_return_latency_not_power_loss_proof\","
        "\"checkpoint\":\"%s\",\"clock\":\"CLOCK_MONOTONIC_RAW\","
        "\"completedFullSyncCount\":%" PRIu32 ","
        "\"elapsedNanoseconds\":\"%" PRIu64 "\","
        "\"fullSyncSamples\":[",
        checkpoint,
        timing->recorded_full_sync_count,
        elapsed_nanoseconds)) {
    return false;
  }
  for (index = 0; index < timing->recorded_full_sync_count; index += 1) {
    if (!setfarm_fixture_append_v2(
          output, sizeof(output), &used,
          "%s{\"durationNanoseconds\":\"%" PRIu64 "\","
          "\"ordinal\":%" PRIu32 ",\"replayState\":\"%s\","
          "\"role\":\"%s\"}",
          index == 0 ? "" : ",",
          timing->full_sync_nanoseconds[index],
          index,
          setfarm_bootstrap_scope_replay_state_name_v2(
            timing->full_sync_states[index]),
          setfarm_bootstrap_scope_full_sync_role_name_v2(
            timing->full_sync_roles[index]))) {
      return false;
    }
  }
  if (!setfarm_fixture_append_v2(
        output, sizeof(output), &used,
        "],\"payloadByteLength\":%zu,\"productionAuthority\":false,"
        "\"recordingTruncated\":false,"
        "\"schema\":\"setfarm.platform-release-bootstrap-filesystem-fixture-timing.v2\","
        "\"timingAuthority\":\"characterization_only_no_sla\"}\n",
        context->payload_byte_length)) {
    return false;
  }
  return setfarm_fixture_write_exact_v2(
    SETFARM_FIXTURE_TIMING_FD_V2, (const uint8_t *)output, used);
}

static void
setfarm_fixture_checkpoint_v2(
  setfarm_bootstrap_scope_checkpoint_v2 checkpoint,
  void *opaque_context)
{
  setfarm_fixture_checkpoint_context_v2 *context =
    (setfarm_fixture_checkpoint_context_v2 *)opaque_context;
  if (context->enabled && context->selected == checkpoint) {
    if (context->timing_enabled &&
        !setfarm_fixture_emit_timing_v2(context, context->selected_name)) {
      _exit(74);
    }
    (void)kill(getpid(), SIGKILL);
    _exit(137);
  }
}

int
main(int argc, char **argv)
{
  uint8_t input[
    SETFARM_BOOTSTRAP_SCOPE_MAX_BYTES_V2 + SETFARM_FIXTURE_CONTROL_MAX_V2 + 2];
  size_t used = 0;
  size_t separator = 0;
  bool found_separator = false;
  setfarm_fixture_checkpoint_context_v2 checkpoint_context;
  setfarm_bootstrap_scope_result_v2 result;
  setfarm_bootstrap_scope_failure_v2 failure;
  setfarm_bootstrap_scope_timing_v2 timing;
  setfarm_bootstrap_scope_error_v2 code;

  (void)argv;
  if (argc != 1) {
    (void)fprintf(stderr, "fixture_accepts_no_arguments\n");
    return 64;
  }
  for (;;) {
    ssize_t read_count = read(STDIN_FILENO, input + used, sizeof(input) - used);
    if (read_count < 0 && errno == EINTR) {
      continue;
    }
    if (read_count < 0) {
      (void)fprintf(stderr, "fixture_stdin_read_failed errno=%d\n", errno);
      setfarm_fixture_zero_v2(input, sizeof(input));
      return 74;
    }
    if (read_count == 0) {
      break;
    }
    used += (size_t)read_count;
    if (used == sizeof(input)) {
      uint8_t overflow_probe;
      ssize_t overflow_count;
      do {
        overflow_count = read(STDIN_FILENO, &overflow_probe, 1);
      } while (overflow_count < 0 && errno == EINTR);
      if (overflow_count != 0) {
        (void)fprintf(stderr, "fixture_stdin_exceeds_bound\n");
        setfarm_fixture_zero_v2(input, sizeof(input));
        return 65;
      }
      break;
    }
  }
  for (separator = 0; separator < used; separator += 1) {
    if (input[separator] == (uint8_t)'\n') {
      found_separator = true;
      break;
    }
  }
  if (!found_separator || separator == 0 ||
      separator > SETFARM_FIXTURE_CONTROL_MAX_V2 ||
      used - separator - 1 == 0 ||
      used - separator - 1 > SETFARM_BOOTSTRAP_SCOPE_MAX_BYTES_V2 ||
      !setfarm_fixture_parse_checkpoint_v2(
        input, separator, &checkpoint_context)) {
    (void)fprintf(stderr, "fixture_stdin_frame_invalid\n");
    setfarm_fixture_zero_v2(input, sizeof(input));
    return 65;
  }
  checkpoint_context.timing =
    checkpoint_context.timing_enabled ? &timing : NULL;
  checkpoint_context.payload_byte_length = used - separator - 1;
  checkpoint_context.run_started_nanoseconds = 0;
  if (checkpoint_context.timing_enabled &&
      (fcntl(SETFARM_FIXTURE_TIMING_FD_V2, F_GETFD) < 0 ||
       signal(SIGPIPE, SIG_IGN) == SIG_ERR ||
       !setfarm_fixture_raw_now_v2(
         &checkpoint_context.run_started_nanoseconds))) {
    (void)fprintf(stderr, "fixture_timing_channel_or_clock_unavailable\n");
    setfarm_fixture_zero_v2(input, sizeof(input));
    return 69;
  }

  code = setfarm_bootstrap_scope_publish_fixed_v2(
    SETFARM_FIXTURE_ROOT_FD_V2,
    input + separator + 1,
    used - separator - 1,
    setfarm_fixture_checkpoint_v2,
    &checkpoint_context,
    checkpoint_context.timing,
    &result,
    &failure);
  setfarm_fixture_zero_v2(input, sizeof(input));
  if (code != SETFARM_BOOTSTRAP_SCOPE_OK_V2) {
    (void)fprintf(
      stderr,
      "fixture_failed code=%s errno=%d state=%s\n",
      setfarm_bootstrap_scope_error_name_v2(code),
      failure.system_errno,
      setfarm_bootstrap_scope_replay_state_name_v2(failure.observed_state));
    return 70;
  }
  if (checkpoint_context.timing_enabled &&
      !setfarm_fixture_emit_timing_v2(&checkpoint_context, "completed")) {
    (void)fprintf(stderr, "fixture_timing_emit_failed\n");
    return 74;
  }

  (void)printf(
    "{\"schema\":\"setfarm.platform-release-bootstrap-filesystem-fixture-result.v2\","
    "\"admissionScope\":\"test_fixture\",\"capability\":\"%s\","
    "\"productionAuthority\":false,"
    "\"signingAuthority\":\"adhoc_or_unsigned_test_fixture\","
    "\"initialState\":\"%s\",\"finalState\":\"%s\","
    "\"objectKind\":\"ordinary_file\",\"device\":\"%" PRIu64 "\","
    "\"inode\":\"%" PRIu64 "\",\"linkCount\":%" PRIu64 ","
    "\"byteLength\":%" PRIu64 ",\"ownerUid\":%" PRIu64 ","
    "\"ownerGid\":%" PRIu64 ",\"mode\":\"%04o\","
    "\"modifiedSeconds\":\"%" PRId64 "\","
    "\"modifiedNanoseconds\":\"%" PRId64 "\","
    "\"changedSeconds\":\"%" PRId64 "\","
    "\"changedNanoseconds\":\"%" PRId64 "\"}\n",
    SETFARM_BOOTSTRAP_FILESYSTEM_KERNEL_CAPABILITY_V2,
    setfarm_bootstrap_scope_replay_state_name_v2(result.initial_state),
    setfarm_bootstrap_scope_replay_state_name_v2(result.final_state),
    result.final_evidence.device,
    result.final_evidence.inode,
    result.final_evidence.link_count,
    result.final_evidence.byte_length,
    result.final_evidence.owner_uid,
    result.final_evidence.owner_gid,
    (unsigned int)result.final_evidence.mode,
    result.final_evidence.modified_seconds,
    result.final_evidence.modified_nanoseconds,
    result.final_evidence.changed_seconds,
    result.final_evidence.changed_nanoseconds);
  return 0;
}
