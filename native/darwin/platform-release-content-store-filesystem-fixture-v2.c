#include "platform-release-content-store-filesystem-kernel-v2.h"

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
#include <unistd.h>

#define SETFARM_CONTENT_STORE_FIXTURE_ROOT_FD_V2 3
#define SETFARM_CONTENT_STORE_FIXTURE_READY_FD_V2 4
#define SETFARM_CONTENT_STORE_FIXTURE_ACK_FD_V2 5
#define SETFARM_CONTENT_STORE_FIXTURE_VERSION_V2 UINT32_C(2)
#define SETFARM_CONTENT_STORE_FIXTURE_ACK_V2 UINT8_C(0xa5)
#define SETFARM_CONTENT_STORE_FIXTURE_MAGIC_V2 "SETFARM-CSTORE2"
#define SETFARM_CONTENT_STORE_FIXTURE_DIRECTORY_COUNT_V2 ((size_t)5)
#define SETFARM_CONTENT_STORE_FIXTURE_DIRECTORY_BYTES_V2 ((size_t)36)
#define SETFARM_CONTENT_STORE_FIXTURE_HEADER_BYTES_V2 \
  (sizeof(SETFARM_CONTENT_STORE_FIXTURE_MAGIC_V2) + (size_t)8 + \
   SETFARM_CONTENT_STORE_FIXTURE_DIRECTORY_COUNT_V2 * \
     SETFARM_CONTENT_STORE_FIXTURE_DIRECTORY_BYTES_V2 + \
   (size_t)16 + (size_t)2 * SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2)
#define SETFARM_CONTENT_STORE_FIXTURE_MAX_INPUT_BYTES_V2 \
  (SETFARM_CONTENT_STORE_FIXTURE_HEADER_BYTES_V2 + \
   SETFARM_CONTENT_STORE_MAX_MANIFEST_BYTES_V2 + \
   SETFARM_CONTENT_STORE_MAX_ATTESTATION_BYTES_V2)
#define SETFARM_CONTENT_STORE_FIXTURE_OUTPUT_BYTES_V2 ((size_t)16384)

typedef struct setfarm_content_store_fixture_checkpoint_context_v2 {
  setfarm_content_store_checkpoint_v2 selected;
  bool fired;
} setfarm_content_store_fixture_checkpoint_context_v2;

static void
setfarm_content_store_fixture_zero_v2(void *memory, size_t length)
{
  volatile uint8_t *cursor = (volatile uint8_t *)memory;
  while (length > 0) {
    *cursor = 0;
    cursor += 1;
    length -= 1;
  }
}

static bool
setfarm_content_store_fixture_write_exact_v2(
  int descriptor,
  const uint8_t *bytes,
  size_t length)
{
  size_t offset = 0;
  while (offset < length) {
    ssize_t count = write(descriptor, bytes + offset, length - offset);
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
setfarm_content_store_fixture_read_exact_v2(
  int descriptor,
  uint8_t *bytes,
  size_t length)
{
  size_t offset = 0;
  while (offset < length) {
    ssize_t count = read(descriptor, bytes + offset, length - offset);
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

static uint32_t
setfarm_content_store_fixture_read_u32_v2(const uint8_t *bytes)
{
  return ((uint32_t)bytes[0] << 24) |
         ((uint32_t)bytes[1] << 16) |
         ((uint32_t)bytes[2] << 8) |
         (uint32_t)bytes[3];
}

static uint64_t
setfarm_content_store_fixture_read_u64_v2(const uint8_t *bytes)
{
  return ((uint64_t)bytes[0] << 56) |
         ((uint64_t)bytes[1] << 48) |
         ((uint64_t)bytes[2] << 40) |
         ((uint64_t)bytes[3] << 32) |
         ((uint64_t)bytes[4] << 24) |
         ((uint64_t)bytes[5] << 16) |
         ((uint64_t)bytes[6] << 8) |
         (uint64_t)bytes[7];
}

static void
setfarm_content_store_fixture_write_u32_v2(uint8_t *bytes, uint32_t value)
{
  bytes[0] = (uint8_t)(value >> 24);
  bytes[1] = (uint8_t)(value >> 16);
  bytes[2] = (uint8_t)(value >> 8);
  bytes[3] = (uint8_t)value;
}

static bool
setfarm_content_store_fixture_decode_directory_v2(
  const uint8_t *input,
  size_t input_length,
  size_t *offset,
  setfarm_content_store_expected_directory_v2 *directory)
{
  if (input == NULL || offset == NULL || directory == NULL ||
      *offset > input_length ||
      input_length - *offset < SETFARM_CONTENT_STORE_FIXTURE_DIRECTORY_BYTES_V2) {
    return false;
  }
  directory->device = setfarm_content_store_fixture_read_u64_v2(input + *offset);
  *offset += 8;
  directory->inode = setfarm_content_store_fixture_read_u64_v2(input + *offset);
  *offset += 8;
  directory->owner_uid =
    setfarm_content_store_fixture_read_u64_v2(input + *offset);
  *offset += 8;
  directory->owner_gid =
    setfarm_content_store_fixture_read_u64_v2(input + *offset);
  *offset += 8;
  directory->mode = setfarm_content_store_fixture_read_u32_v2(input + *offset);
  *offset += 4;
  return true;
}

static bool
setfarm_content_store_fixture_checkpoint_valid_v2(uint32_t checkpoint)
{
  return checkpoint == 0 ||
         (checkpoint >=
            (uint32_t)SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CHILDREN_PINNED_V2 &&
          checkpoint <=
            (uint32_t)SETFARM_CONTENT_STORE_CHECKPOINT_AFTER_CLEANUP_V2);
}

static void
setfarm_content_store_fixture_checkpoint_v2(
  setfarm_content_store_checkpoint_v2 checkpoint,
  void *opaque_context)
{
  setfarm_content_store_fixture_checkpoint_context_v2 *context =
    (setfarm_content_store_fixture_checkpoint_context_v2 *)opaque_context;
  uint8_t ready[8];
  uint8_t acknowledgement = 0;
  if (context == NULL || context->selected != checkpoint || context->fired) {
    return;
  }
  context->fired = true;
  setfarm_content_store_fixture_write_u32_v2(ready, UINT32_C(0x53464332));
  setfarm_content_store_fixture_write_u32_v2(ready + 4, (uint32_t)checkpoint);
  if (!setfarm_content_store_fixture_write_exact_v2(
        SETFARM_CONTENT_STORE_FIXTURE_READY_FD_V2,
        ready,
        sizeof(ready))) {
    _exit(74);
  }
  if (raise(SIGSTOP) != 0 ||
      !setfarm_content_store_fixture_read_exact_v2(
        SETFARM_CONTENT_STORE_FIXTURE_ACK_FD_V2,
        &acknowledgement,
        1) ||
      acknowledgement != SETFARM_CONTENT_STORE_FIXTURE_ACK_V2) {
    _exit(74);
  }
}

static bool
setfarm_content_store_fixture_append_v2(
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

static const char *
setfarm_content_store_fixture_disposition_name_v2(
  setfarm_content_store_publication_disposition_v2 disposition)
{
  switch (disposition) {
    case SETFARM_CONTENT_STORE_PUBLICATION_NONE_V2:
      return "none";
    case SETFARM_CONTENT_STORE_PUBLICATION_PUBLISHED_V2:
      return "published";
    case SETFARM_CONTENT_STORE_PUBLICATION_ADOPTED_IDENTICAL_V2:
      return "adopted_identical";
  }
  return "unknown";
}

static const char *
setfarm_content_store_fixture_unlink_policy_name_v2(
  setfarm_content_store_unlink_authority_policy_v2 policy)
{
  if (policy ==
      SETFARM_CONTENT_STORE_UNLINK_PRESERVE_UNCERTAIN_IDENTITY_V2) {
    return SETFARM_CONTENT_STORE_UNLINK_AUTHORITY_POLICY_V2;
  }
  return "unknown";
}

static bool
setfarm_content_store_fixture_append_evidence_v2(
  char *output,
  size_t capacity,
  size_t *used,
  const char *name,
  const setfarm_content_store_physical_evidence_v2 *evidence,
  bool comma)
{
  return setfarm_content_store_fixture_append_v2(
    output,
    capacity,
    used,
    "%s\"%s\":{\"byteLength\":\"%" PRIu64
    "\",\"changedNanoseconds\":\"%" PRId64
    "\",\"changedSeconds\":\"%" PRId64
    "\",\"device\":\"%" PRIu64 "\",\"inode\":\"%" PRIu64
    "\",\"linkCount\":\"%" PRIu64 "\",\"mode\":%" PRIu32
    ",\"modifiedNanoseconds\":\"%" PRId64
    "\",\"modifiedSeconds\":\"%" PRId64
    "\",\"ownerGid\":\"%" PRIu64 "\",\"ownerUid\":\"%" PRIu64
    "\"}",
    comma ? "," : "",
    name,
    evidence->byte_length,
    evidence->changed_nanoseconds,
    evidence->changed_seconds,
    evidence->device,
    evidence->inode,
    evidence->link_count,
    evidence->mode,
    evidence->modified_nanoseconds,
    evidence->modified_seconds,
    evidence->owner_gid,
    evidence->owner_uid);
}

static bool
setfarm_content_store_fixture_emit_v2(
  setfarm_content_store_error_v2 code,
  const setfarm_content_store_result_v2 *result,
  const setfarm_content_store_failure_v2 *failure)
{
  char output[SETFARM_CONTENT_STORE_FIXTURE_OUTPUT_BYTES_V2];
  size_t used = 0;
  if (!setfarm_content_store_fixture_append_v2(
        output,
        sizeof(output),
        &used,
        "{\"admissionScope\":\"test_fixture\","
        "\"capability\":\"%s\",\"error\":{"
        "\"cleanupCode\":%d,\"cleanupCodeName\":\"%s\","
        "\"cleanupErrno\":%d,\"lastCheckpoint\":%d,"
        "\"leaseCode\":%d,\"leaseCodeName\":\"%s\","
        "\"leaseErrno\":%d,\"primaryCode\":%d,"
        "\"primaryCodeName\":\"%s\",\"primaryErrno\":%d,"
        "\"terminalCode\":%d,\"terminalCodeName\":\"%s\"},"
        "\"productionAuthority\":false,\"result\":{"
        "\"attestationDisposition\":\"%s\","
        "\"attestationLeaseAcquired\":%s,"
        "\"attestationLeaseRecovered\":%s,"
        "\"authenticatedLeaseLedgerPresent\":%s,"
        "\"contentLeaseAcquired\":%s,"
        "\"contentLeaseRecovered\":%s,\"evidence\":{",
        SETFARM_CONTENT_STORE_FILESYSTEM_CAPABILITY_V2,
        (int)failure->cleanup_code,
        setfarm_content_store_cleanup_code_name_v2(failure->cleanup_code),
        failure->cleanup_errno,
        (int)failure->last_checkpoint,
        (int)failure->lease_code,
        setfarm_content_store_lease_code_name_v2(failure->lease_code),
        failure->lease_errno,
        (int)failure->primary_code,
        setfarm_content_store_error_name_v2(failure->primary_code),
        failure->primary_errno,
        (int)code,
        setfarm_content_store_error_name_v2(code),
        setfarm_content_store_fixture_disposition_name_v2(
          result->attestation_disposition),
        result->attestation_lease_acquired == 1 ? "true" : "false",
        result->attestation_lease_recovered == 1 ? "true" : "false",
        result->authenticated_lease_ledger_present == 1 ? "true" : "false",
        result->content_lease_acquired == 1 ? "true" : "false",
        result->content_lease_recovered == 1 ? "true" : "false") ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "attestation", &result->attestation, false) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "attestations", &result->attestations, true) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "locks", &result->locks, true) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "manifest", &result->manifest, true) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "releaseRoot", &result->release_root, true) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "releases", &result->releases, true) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "root", &result->root, true) ||
      !setfarm_content_store_fixture_append_evidence_v2(
        output, sizeof(output), &used, "staging", &result->staging, true) ||
      !setfarm_content_store_fixture_append_v2(
        output,
        sizeof(output),
        &used,
        "},\"leasesReleased\":%s,\"releaseDisposition\":\"%s\","
        "\"sameUidAtomicConditionalUnlinkAvailable\":%s,"
        "\"stageCleaned\":%s,\"staleLeaseRecoveryPolicy\":\"%s\","
        "\"unauthenticatedStaleLeaseRecoveryEnabled\":%s,"
        "\"unlinkAuthorityPolicy\":\"%s\","
        "\"unlinkAuthorityPolicyCode\":%d},"
        "\"schema\":\"setfarm.platform-release-content-store-filesystem-fixture-result.v2\","
        "\"status\":\"%s\"}\n",
        result->leases_released == 1 ? "true" : "false",
        setfarm_content_store_fixture_disposition_name_v2(
          result->release_disposition),
        result->same_uid_atomic_conditional_unlink_available == 1
          ? "true" : "false",
        result->stage_cleaned == 1 ? "true" : "false",
        SETFARM_CONTENT_STORE_STALE_LEASE_RECOVERY_POLICY_V2,
        result->unauthenticated_stale_lease_recovery_enabled == 1
          ? "true" : "false",
        setfarm_content_store_fixture_unlink_policy_name_v2(
          result->unlink_authority_policy),
        (int)result->unlink_authority_policy,
        code == SETFARM_CONTENT_STORE_OK_V2 ? "ok" : "error")) {
    return false;
  }
  return setfarm_content_store_fixture_write_exact_v2(
    STDOUT_FILENO, (const uint8_t *)output, used);
}

int
main(int argc, char **argv)
{
  uint8_t *input = NULL;
  size_t used = 0;
  size_t offset = 0;
  uint32_t version;
  uint32_t checkpoint_value;
  uint64_t manifest_length_u64;
  uint64_t attestation_length_u64;
  size_t manifest_length;
  size_t attestation_length;
  setfarm_content_store_request_v2 request;
  setfarm_content_store_result_v2 result;
  setfarm_content_store_failure_v2 failure;
  setfarm_content_store_fixture_checkpoint_context_v2 checkpoint_context;
  setfarm_content_store_error_v2 code;

  (void)argv;
  if (argc != 1) {
    (void)fprintf(stderr, "fixture_accepts_no_arguments\n");
    return 64;
  }
  input = (uint8_t *)calloc(
    SETFARM_CONTENT_STORE_FIXTURE_MAX_INPUT_BYTES_V2 + (size_t)1,
    sizeof(uint8_t));
  if (input == NULL) {
    (void)fprintf(stderr, "fixture_input_allocation_failed\n");
    return 71;
  }
  for (;;) {
    ssize_t count;
    if (used == SETFARM_CONTENT_STORE_FIXTURE_MAX_INPUT_BYTES_V2 + (size_t)1) {
      (void)fprintf(stderr, "fixture_stdin_exceeds_bound\n");
      setfarm_content_store_fixture_zero_v2(input, used);
      free(input);
      return 65;
    }
    count = read(
      STDIN_FILENO,
      input + used,
      SETFARM_CONTENT_STORE_FIXTURE_MAX_INPUT_BYTES_V2 + (size_t)1 - used);
    if (count < 0 && errno == EINTR) {
      continue;
    }
    if (count < 0) {
      (void)fprintf(stderr, "fixture_stdin_read_failed errno=%d\n", errno);
      setfarm_content_store_fixture_zero_v2(input, used);
      free(input);
      return 74;
    }
    if (count == 0) {
      break;
    }
    used += (size_t)count;
  }
  if (used < SETFARM_CONTENT_STORE_FIXTURE_HEADER_BYTES_V2 ||
      used > SETFARM_CONTENT_STORE_FIXTURE_MAX_INPUT_BYTES_V2 ||
      memcmp(
        input,
        SETFARM_CONTENT_STORE_FIXTURE_MAGIC_V2,
        sizeof(SETFARM_CONTENT_STORE_FIXTURE_MAGIC_V2)) != 0) {
    (void)fprintf(stderr, "fixture_stdin_frame_invalid\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 65;
  }
  memset(&request, 0, sizeof(request));
  memset(&result, 0, sizeof(result));
  memset(&failure, 0, sizeof(failure));
  memset(&checkpoint_context, 0, sizeof(checkpoint_context));
  offset = sizeof(SETFARM_CONTENT_STORE_FIXTURE_MAGIC_V2);
  version = setfarm_content_store_fixture_read_u32_v2(input + offset);
  offset += 4;
  checkpoint_value = setfarm_content_store_fixture_read_u32_v2(input + offset);
  offset += 4;
  if (version != SETFARM_CONTENT_STORE_FIXTURE_VERSION_V2 ||
      !setfarm_content_store_fixture_checkpoint_valid_v2(checkpoint_value) ||
      !setfarm_content_store_fixture_decode_directory_v2(
        input, used, &offset, &request.root) ||
      !setfarm_content_store_fixture_decode_directory_v2(
        input, used, &offset, &request.locks) ||
      !setfarm_content_store_fixture_decode_directory_v2(
        input, used, &offset, &request.staging) ||
      !setfarm_content_store_fixture_decode_directory_v2(
        input, used, &offset, &request.releases) ||
      !setfarm_content_store_fixture_decode_directory_v2(
        input, used, &offset, &request.attestations) ||
      used - offset < (size_t)16 +
        (size_t)2 * SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2) {
    (void)fprintf(stderr, "fixture_stdin_frame_invalid\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 65;
  }
  manifest_length_u64 = setfarm_content_store_fixture_read_u64_v2(input + offset);
  offset += 8;
  attestation_length_u64 =
    setfarm_content_store_fixture_read_u64_v2(input + offset);
  offset += 8;
  if (manifest_length_u64 == 0 || attestation_length_u64 == 0 ||
      manifest_length_u64 > SETFARM_CONTENT_STORE_MAX_MANIFEST_BYTES_V2 ||
      attestation_length_u64 > SETFARM_CONTENT_STORE_MAX_ATTESTATION_BYTES_V2) {
    (void)fprintf(stderr, "fixture_stdin_frame_invalid\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 65;
  }
  manifest_length = (size_t)manifest_length_u64;
  attestation_length = (size_t)attestation_length_u64;
  request.manifest_payload_hash_hex = input + offset;
  request.manifest_payload_hash_hex_length =
    SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2;
  offset += SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2;
  request.attestation_hash_hex = input + offset;
  request.attestation_hash_hex_length = SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2;
  offset += SETFARM_CONTENT_STORE_SHA256_HEX_BYTES_V2;
  if (offset > used || manifest_length > used - offset ||
      attestation_length != used - offset - manifest_length) {
    (void)fprintf(stderr, "fixture_stdin_frame_invalid\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 65;
  }
  request.manifest_bytes = input + offset;
  request.manifest_byte_length = manifest_length;
  offset += manifest_length;
  request.attestation_bytes = input + offset;
  request.attestation_byte_length = attestation_length;
  checkpoint_context.selected =
    (setfarm_content_store_checkpoint_v2)checkpoint_value;
  if (checkpoint_value != 0 &&
      (fcntl(SETFARM_CONTENT_STORE_FIXTURE_READY_FD_V2, F_GETFD) < 0 ||
       fcntl(SETFARM_CONTENT_STORE_FIXTURE_ACK_FD_V2, F_GETFD) < 0 ||
       signal(SIGPIPE, SIG_IGN) == SIG_ERR)) {
    (void)fprintf(stderr, "fixture_checkpoint_channels_invalid\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 65;
  }
  code = setfarm_content_store_publish_fixture_v2(
    SETFARM_CONTENT_STORE_FIXTURE_ROOT_FD_V2,
    &request,
    checkpoint_value == 0 ? NULL : setfarm_content_store_fixture_checkpoint_v2,
    checkpoint_value == 0 ? NULL : &checkpoint_context,
    &result,
    &failure);
  if (checkpoint_value != 0 && !checkpoint_context.fired) {
    (void)fprintf(stderr, "fixture_checkpoint_not_reached\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 70;
  }
  if (!setfarm_content_store_fixture_emit_v2(code, &result, &failure)) {
    (void)fprintf(stderr, "fixture_stdout_write_failed\n");
    setfarm_content_store_fixture_zero_v2(input, used);
    free(input);
    return 74;
  }
  setfarm_content_store_fixture_zero_v2(input, used);
  free(input);
  return code == SETFARM_CONTENT_STORE_OK_V2 ? 0 : 1;
}
