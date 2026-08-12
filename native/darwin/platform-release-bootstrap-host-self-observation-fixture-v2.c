#include <CommonCrypto/CommonDigest.h>
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#include <mach-o/dyld.h>
#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <limits.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

/*
 * This binary is deliberately a characterization fixture.  It observes the
 * current process through Security.framework and emits no capability, key,
 * installer receipt, notarization proof, or production authority.
 */
#define SETFARM_HOST_OBSERVATION_INPUT_MAX_V2 ((size_t)128)
#define SETFARM_HOST_OBSERVATION_OUTPUT_MAX_V2 ((size_t)64 * (size_t)1024)
#define SETFARM_HOST_OBSERVATION_EXECUTABLE_MAX_V2 ((uint64_t)64 * (uint64_t)1024 * (uint64_t)1024)
#define SETFARM_HOST_OBSERVATION_TEXT_MAX_V2 ((size_t)4096)
#define SETFARM_HOST_OBSERVATION_RAW_DIGEST_MAX_V2 ((size_t)128)
#define SETFARM_HOST_OBSERVATION_CHALLENGE_PREFIX_V2 "self_observe_v2:"

typedef struct setfarm_executable_evidence_v2 {
  struct stat status;
  char content_hash[65];
} setfarm_executable_evidence_v2;

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
setfarm_hex_v2(const uint8_t *bytes, size_t length, char *out)
{
  static const char digits[] = "0123456789abcdef";
  for (size_t index = 0; index < length; index += 1) {
    out[index * 2] = digits[(bytes[index] >> 4) & 0x0f];
    out[index * 2 + 1] = digits[bytes[index] & 0x0f];
  }
  out[length * 2] = '\0';
}

static void
setfarm_sha256_bytes_v2(
  const uint8_t *bytes,
  size_t length,
  char out[65])
{
  uint8_t digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(bytes, (CC_LONG)length, digest);
  setfarm_hex_v2(digest, sizeof(digest), out);
  setfarm_zero_v2(digest, sizeof(digest));
}

static bool
setfarm_sha256_file_v2(int descriptor, char out[65])
{
  CC_SHA256_CTX context;
  if (CC_SHA256_Init(&context) != 1) {
    return false;
  }
  uint8_t buffer[64 * 1024];
  for (;;) {
    ssize_t count = read(descriptor, buffer, sizeof(buffer));
    if (count == 0) {
      break;
    }
    if (count < 0) {
      if (errno == EINTR) {
        continue;
      }
      setfarm_zero_v2(buffer, sizeof(buffer));
      return false;
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
  setfarm_hex_v2(digest, sizeof(digest), out);
  setfarm_zero_v2(digest, sizeof(digest));
  setfarm_zero_v2(buffer, sizeof(buffer));
  return lseek(descriptor, 0, SEEK_SET) == 0;
}

static void
setfarm_hash_requirement_v2(const char *text, char out[65])
{
  static const char domain[] =
    "setfarm.platform-release-bootstrap-darwin-host-self-observation-requirement-v2";
  CC_SHA256_CTX context;
  CC_SHA256_Init(&context);
  CC_SHA256_Update(&context, domain, (CC_LONG)(sizeof(domain) - 1));
  const uint8_t separator = 0;
  CC_SHA256_Update(&context, &separator, 1);
  CC_SHA256_Update(&context, text, (CC_LONG)strlen(text));
  uint8_t digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_Final(digest, &context);
  setfarm_hex_v2(digest, sizeof(digest), out);
  setfarm_zero_v2(digest, sizeof(digest));
}

static void
setfarm_hash_code_directory_v2(
  uint64_t algorithm,
  const uint8_t *raw,
  size_t raw_length,
  char out[65])
{
  static const char domain[] =
    "setfarm.platform-release-bootstrap-darwin-host-self-observation-code-directory-v2";
  char algorithm_text[32];
  char length_text[32];
  int algorithm_size = snprintf(
    algorithm_text,
    sizeof(algorithm_text),
    "%" PRIu64,
    algorithm);
  int length_size = snprintf(
    length_text,
    sizeof(length_text),
    "%zu",
    raw_length);
  if (algorithm_size < 0 || length_size < 0) {
    out[0] = '\0';
    return;
  }
  CC_SHA256_CTX context;
  CC_SHA256_Init(&context);
  CC_SHA256_Update(&context, domain, (CC_LONG)(sizeof(domain) - 1));
  const uint8_t separator = 0;
  CC_SHA256_Update(&context, &separator, 1);
  CC_SHA256_Update(&context, algorithm_text, (CC_LONG)algorithm_size);
  CC_SHA256_Update(&context, &separator, 1);
  CC_SHA256_Update(&context, length_text, (CC_LONG)length_size);
  CC_SHA256_Update(&context, &separator, 1);
  CC_SHA256_Update(&context, raw, (CC_LONG)raw_length);
  uint8_t digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_Final(digest, &context);
  setfarm_hex_v2(digest, sizeof(digest), out);
  setfarm_zero_v2(digest, sizeof(digest));
  setfarm_zero_v2(algorithm_text, sizeof(algorithm_text));
  setfarm_zero_v2(length_text, sizeof(length_text));
}

static bool
setfarm_host_identity_hash_v2(char out[65])
{
  static const char domain[] =
    "setfarm.platform-release-bootstrap-darwin-host-self-observation-host-identity-v2";
  uuid_t host_uuid;
  struct timespec timeout = { .tv_sec = 0, .tv_nsec = 100000000 };
  if (gethostuuid(host_uuid, &timeout) != 0) {
    setfarm_zero_v2(host_uuid, sizeof(host_uuid));
    return false;
  }
  CC_SHA256_CTX context;
  CC_SHA256_Init(&context);
  CC_SHA256_Update(&context, domain, (CC_LONG)(sizeof(domain) - 1));
  const uint8_t separator = 0;
  CC_SHA256_Update(&context, &separator, 1);
  CC_SHA256_Update(&context, host_uuid, sizeof(host_uuid));
  uint8_t digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_Final(digest, &context);
  setfarm_hex_v2(digest, sizeof(digest), out);
  setfarm_zero_v2(digest, sizeof(digest));
  setfarm_zero_v2(host_uuid, sizeof(host_uuid));
  return true;
}

static bool
setfarm_read_challenge_v2(uint8_t challenge[32], char challenge_hash[65])
{
  uint8_t input[SETFARM_HOST_OBSERVATION_INPUT_MAX_V2];
  size_t length = 0;
  for (;;) {
    if (length == sizeof(input)) {
      setfarm_zero_v2(input, sizeof(input));
      return false;
    }
    ssize_t count = read(STDIN_FILENO, input + length, sizeof(input) - length);
    if (count == 0) {
      break;
    }
    if (count < 0) {
      if (errno == EINTR) {
        continue;
      }
      setfarm_zero_v2(input, sizeof(input));
      return false;
    }
    length += (size_t)count;
  }
  const char prefix[] = SETFARM_HOST_OBSERVATION_CHALLENGE_PREFIX_V2;
  const size_t prefix_length = sizeof(prefix) - 1;
  if (length != prefix_length + 64 + 1
      || memcmp(input, prefix, prefix_length) != 0
      || input[length - 1] != '\n') {
    setfarm_zero_v2(input, sizeof(input));
    return false;
  }
  for (size_t index = 0; index < 32; index += 1) {
    uint8_t high = input[prefix_length + index * 2];
    uint8_t low = input[prefix_length + index * 2 + 1];
    int high_value =
      high >= '0' && high <= '9' ? high - '0' :
      high >= 'a' && high <= 'f' ? high - 'a' + 10 : -1;
    int low_value =
      low >= '0' && low <= '9' ? low - '0' :
      low >= 'a' && low <= 'f' ? low - 'a' + 10 : -1;
    if (high_value < 0 || low_value < 0) {
      setfarm_zero_v2(input, sizeof(input));
      return false;
    }
    challenge[index] = (uint8_t)((high_value << 4) | low_value);
  }
  setfarm_sha256_bytes_v2(challenge, 32, challenge_hash);
  setfarm_zero_v2(input, sizeof(input));
  return true;
}

static bool
setfarm_capture_executable_v2(setfarm_executable_evidence_v2 *evidence)
{
  char stack_path[PATH_MAX];
  uint32_t path_length = (uint32_t)sizeof(stack_path);
  char *path = stack_path;
  bool allocated_path = false;
  if (_NSGetExecutablePath(path, &path_length) != 0) {
    if (path_length == 0 || path_length > PATH_MAX * 4U) {
      setfarm_zero_v2(stack_path, sizeof(stack_path));
      return false;
    }
    path = (char *)calloc((size_t)path_length + 1, 1);
    if (path == NULL) {
      setfarm_zero_v2(stack_path, sizeof(stack_path));
      return false;
    }
    allocated_path = true;
    uint32_t actual_length = path_length + 1;
    if (_NSGetExecutablePath(path, &actual_length) != 0) {
      setfarm_zero_v2(path, (size_t)path_length + 1);
      free(path);
      setfarm_zero_v2(stack_path, sizeof(stack_path));
      return false;
    }
  }
  int descriptor = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
  if (allocated_path) {
    setfarm_zero_v2(path, (size_t)path_length + 1);
    free(path);
  } else {
    setfarm_zero_v2(stack_path, sizeof(stack_path));
  }
  if (descriptor < 0) {
    return false;
  }
  struct stat before;
  struct stat after;
  bool valid = fstat(descriptor, &before) == 0
    && S_ISREG(before.st_mode)
    && before.st_size > 0
    && (uint64_t)before.st_size <= SETFARM_HOST_OBSERVATION_EXECUTABLE_MAX_V2
    && setfarm_sha256_file_v2(descriptor, evidence->content_hash)
    && fstat(descriptor, &after) == 0
    && before.st_dev == after.st_dev
    && before.st_ino == after.st_ino
    && before.st_uid == after.st_uid
    && before.st_gid == after.st_gid
    && before.st_mode == after.st_mode
    && before.st_nlink == after.st_nlink
    && before.st_size == after.st_size
    && before.st_mtimespec.tv_sec == after.st_mtimespec.tv_sec
    && before.st_mtimespec.tv_nsec == after.st_mtimespec.tv_nsec
    && before.st_ctimespec.tv_sec == after.st_ctimespec.tv_sec
    && before.st_ctimespec.tv_nsec == after.st_ctimespec.tv_nsec;
  if (valid) {
    evidence->status = after;
  }
  close(descriptor);
  return valid;
}

static bool
setfarm_cf_string_v2(CFTypeRef value, char *out, size_t out_size)
{
  if (value == NULL || CFGetTypeID(value) != CFStringGetTypeID()) {
    return false;
  }
  CFStringRef string = (CFStringRef)value;
  CFIndex length = CFStringGetLength(string);
  for (CFIndex index = 0; index < length; index += 1) {
    if (CFStringGetCharacterAtIndex(string, index) == 0) {
      return false;
    }
  }
  return CFStringGetCString(
    string,
    out,
    (CFIndex)out_size,
    kCFStringEncodingUTF8);
}

static bool
setfarm_cf_number_v2(CFTypeRef value, uint64_t *out)
{
  if (value == NULL || CFGetTypeID(value) != CFNumberGetTypeID()) {
    return false;
  }
  int64_t signed_value = 0;
  if (!CFNumberGetValue((CFNumberRef)value, kCFNumberSInt64Type, &signed_value)
      || signed_value < 0) {
    return false;
  }
  *out = (uint64_t)signed_value;
  return true;
}

static bool
setfarm_cf_data_v2(CFTypeRef value, uint8_t *out, size_t *length)
{
  if (value == NULL || CFGetTypeID(value) != CFDataGetTypeID()) {
    return false;
  }
  CFIndex data_length = CFDataGetLength((CFDataRef)value);
  if (data_length < 1 || (size_t)data_length > SETFARM_HOST_OBSERVATION_RAW_DIGEST_MAX_V2) {
    return false;
  }
  memcpy(out, CFDataGetBytePtr((CFDataRef)value), (size_t)data_length);
  *length = (size_t)data_length;
  return true;
}

static void
setfarm_json_string_v2(const char *value)
{
  putchar('"');
  for (const unsigned char *cursor = (const unsigned char *)value; *cursor != '\0'; cursor += 1) {
    if (*cursor == '\\' || *cursor == '"') {
      putchar('\\');
      putchar((int)*cursor);
    } else if (*cursor < 0x20) {
      printf("\\u%04x", (unsigned int)*cursor);
    } else {
      putchar((int)*cursor);
    }
  }
  putchar('"');
}

static const char *
setfarm_architecture_v2(void)
{
#if defined(__arm64__)
  return "arm64";
#elif defined(__x86_64__)
  return "x64";
#else
  return "unknown";
#endif
}

static const char *
setfarm_signature_class_v2(
  bool information_success,
  bool has_identifier,
  bool has_cms,
  uint64_t flags)
{
  if (!information_success) return "unknown";
  if (!has_identifier) return "unsigned";
  if ((flags & kSecCodeSignatureAdhoc) != 0) return "adhoc";
  if (!has_cms) return "unknown";
  return "signed";
}

static void
setfarm_error_v2(const char *message)
{
  fprintf(stderr, "host_self_observation_fixture_error:%s\n", message);
}

int
main(void)
{
  uint8_t challenge[32];
  char challenge_hash[65];
  if (!setfarm_read_challenge_v2(challenge, challenge_hash)) {
    setfarm_error_v2("challenge_frame_invalid");
    return 64;
  }

  setfarm_executable_evidence_v2 executable;
  memset(&executable, 0, sizeof(executable));
  if (!setfarm_capture_executable_v2(&executable)) {
    setfarm_zero_v2(challenge, sizeof(challenge));
    setfarm_error_v2("executable_capture_invalid");
    return 70;
  }
  char host_identity_hash[65];
  memset(host_identity_hash, 0, sizeof(host_identity_hash));
  if (!setfarm_host_identity_hash_v2(host_identity_hash)) {
    setfarm_zero_v2(challenge, sizeof(challenge));
    setfarm_zero_v2(&executable, sizeof(executable));
    setfarm_error_v2("host_identity_capture_invalid");
    return 71;
  }

  SecCodeRef code = NULL;
  SecStaticCodeRef static_code = NULL;
  CFDictionaryRef information = NULL;
  CFStringRef requirement_text = NULL;
  OSStatus copy_self_status = SecCodeCopySelf(kSecCSDefaultFlags, &code);
  OSStatus static_copy_status = -1;
  OSStatus validity_status = -1;
  OSStatus static_validity_status = -1;
  OSStatus signing_information_status = -1;
  OSStatus requirement_status = -1;
  if (copy_self_status == errSecSuccess && code != NULL) {
    validity_status = SecCodeCheckValidity(code, kSecCSDefaultFlags, NULL);
    static_copy_status = SecCodeCopyStaticCode(
      code,
      kSecCSDefaultFlags,
      &static_code);
  }
  if (static_code != NULL) {
    static_validity_status = SecStaticCodeCheckValidity(
      static_code,
      kSecCSDefaultFlags,
      NULL);
  }
  if (code != NULL) {
    signing_information_status = SecCodeCopySigningInformation(
      code,
      kSecCSSigningInformation
        | kSecCSRequirementInformation
        | kSecCSDynamicInformation
        | kSecCSContentInformation,
      &information);
  }

  uint64_t signing_flags = 0;
  uint64_t dynamic_status_flags = 0;
  uint64_t digest_algorithm = 0;
  bool has_identifier = false;
  bool has_team_identifier = false;
  bool has_certificates = false;
  bool has_cms = false;
  bool has_stapled_ticket = false;
  char identifier[512];
  char team_identifier[256];
  char requirement_hash[65];
  char code_directory_commitment[65];
  uint8_t unique_bytes[SETFARM_HOST_OBSERVATION_RAW_DIGEST_MAX_V2];
  size_t unique_length = 0;
  char unique_hex[SETFARM_HOST_OBSERVATION_RAW_DIGEST_MAX_V2 * 2 + 1];
  memset(identifier, 0, sizeof(identifier));
  memset(team_identifier, 0, sizeof(team_identifier));
  memset(requirement_hash, 0, sizeof(requirement_hash));
  memset(code_directory_commitment, 0, sizeof(code_directory_commitment));
  memset(unique_bytes, 0, sizeof(unique_bytes));
  memset(unique_hex, 0, sizeof(unique_hex));
  if (information != NULL) {
    CFTypeRef identifier_value = CFDictionaryGetValue(
      information,
      kSecCodeInfoIdentifier);
    has_identifier = setfarm_cf_string_v2(
      identifier_value,
      identifier,
      sizeof(identifier));
    CFTypeRef team_value = CFDictionaryGetValue(
      information,
      kSecCodeInfoTeamIdentifier);
    has_team_identifier = setfarm_cf_string_v2(
      team_value,
      team_identifier,
      sizeof(team_identifier));
    (void)setfarm_cf_number_v2(
      CFDictionaryGetValue(information, kSecCodeInfoFlags),
      &signing_flags);
    (void)setfarm_cf_number_v2(
      CFDictionaryGetValue(information, kSecCodeInfoStatus),
      &dynamic_status_flags);
    (void)setfarm_cf_number_v2(
      CFDictionaryGetValue(information, kSecCodeInfoDigestAlgorithm),
      &digest_algorithm);
    CFTypeRef certificates = CFDictionaryGetValue(
      information,
      kSecCodeInfoCertificates);
    has_certificates = certificates != NULL
      && CFGetTypeID(certificates) == CFArrayGetTypeID()
      && CFArrayGetCount((CFArrayRef)certificates) > 0;
    CFTypeRef cms = CFDictionaryGetValue(information, kSecCodeInfoCMS);
    has_cms = cms != NULL
      && CFGetTypeID(cms) == CFDataGetTypeID()
      && CFDataGetLength((CFDataRef)cms) > 0;
    CFTypeRef ticket = CFDictionaryGetValue(
      information,
      kSecCodeInfoStapledNotarizationTicket);
    has_stapled_ticket = ticket != NULL
      && CFGetTypeID(ticket) == CFDataGetTypeID()
      && CFDataGetLength((CFDataRef)ticket) > 0;
    SecRequirementRef requirement = (SecRequirementRef)CFDictionaryGetValue(
      information,
      kSecCodeInfoDesignatedRequirement);
    if (requirement != NULL) {
      requirement_status = SecRequirementCopyString(
        requirement,
        kSecCSDefaultFlags,
        &requirement_text);
      if (requirement_status == errSecSuccess && requirement_text != NULL) {
        char requirement_buffer[SETFARM_HOST_OBSERVATION_TEXT_MAX_V2];
        if (setfarm_cf_string_v2(
              requirement_text,
              requirement_buffer,
              sizeof(requirement_buffer))) {
          setfarm_hash_requirement_v2(requirement_buffer, requirement_hash);
          setfarm_zero_v2(requirement_buffer, sizeof(requirement_buffer));
        } else {
          requirement_status = -2;
        }
      }
    }
    if (setfarm_cf_data_v2(
          CFDictionaryGetValue(information, kSecCodeInfoUnique),
          unique_bytes,
          &unique_length)) {
      setfarm_hex_v2(unique_bytes, unique_length, unique_hex);
      setfarm_hash_code_directory_v2(
        digest_algorithm,
        unique_bytes,
        unique_length,
        code_directory_commitment);
    }
  }

  printf(
    "{\"admissionScope\":\"test_fixture\",\"amfiProductionAdmission\":\"unproven\",\"architecture\":\"%s\",\"challengeHash\":\"%s\",\"codeDirectory\":",
    setfarm_architecture_v2(),
    challenge_hash);
  if (unique_length > 0) {
    printf(
      "{\"algorithm\":%" PRIu64 ",\"byteLength\":%zu,\"commitmentHash\":\"%s\",\"rawHex\":\"%s\"}",
      digest_algorithm,
      unique_length,
      code_directory_commitment,
      unique_hex);
  } else {
    printf("null");
  }
  printf(",\"dynamicStatusFlags\":%" PRIu64 ",\"executable\":{\"mutableFingerprint\":{\"byteLength\":%" PRIdMAX ",\"changedNanoseconds\":\"%" PRIdMAX "\",\"changedSeconds\":\"%" PRIdMAX "\",\"contentHash\":\"%s\",\"linkCount\":%" PRIuMAX ",\"mode\":\"%04o\",\"modifiedNanoseconds\":\"%" PRIdMAX "\",\"modifiedSeconds\":\"%" PRIdMAX "\",\"ownerGid\":%" PRIuMAX ",\"ownerUid\":%" PRIuMAX "},\"stableIdentity\":{\"device\":\"%" PRIuMAX "\",\"hostIdentityHash\":\"%s\",\"inode\":\"%" PRIuMAX "\",\"objectKind\":\"ordinary_file\"}},\"hasCertificates\":%s,\"hasCms\":%s,\"hasIdentifier\":%s,\"hasStapledNotarizationTicket\":%s,\"hasTeamIdentifier\":%s,\"identifier\":",
    dynamic_status_flags,
    (intmax_t)executable.status.st_size,
    (intmax_t)executable.status.st_ctimespec.tv_sec * 1000000000 + executable.status.st_ctimespec.tv_nsec,
    (intmax_t)executable.status.st_ctimespec.tv_sec,
    executable.content_hash,
    (uintmax_t)executable.status.st_nlink,
    (unsigned int)(executable.status.st_mode & 07777),
    (intmax_t)executable.status.st_mtimespec.tv_sec * 1000000000
      + executable.status.st_mtimespec.tv_nsec,
    (intmax_t)executable.status.st_mtimespec.tv_sec,
    (uintmax_t)executable.status.st_gid,
    (uintmax_t)executable.status.st_uid,
    (uintmax_t)executable.status.st_dev,
    host_identity_hash,
    (uintmax_t)executable.status.st_ino,
    has_certificates ? "true" : "false",
    has_cms ? "true" : "false",
    has_identifier ? "true" : "false",
    has_stapled_ticket ? "true" : "false",
    has_team_identifier ? "true" : "false");
  if (has_identifier) setfarm_json_string_v2(identifier); else printf("null");
  printf(",\"installerReceiptAdmission\":\"absent\",\"libraryValidationEnabled\":%s,\"notarizationAdmission\":\"unproven\",\"notarizationTicketPresent\":%s,\"osStatus\":{\"copySelf\":%" PRId32 ",\"copyStatic\":%" PRId32 ",\"requirement\":%" PRId32 ",\"signingInformation\":%" PRId32 ",\"staticValidity\":%" PRId32 ",\"validity\":%" PRId32 "},\"productionAdmission\":\"forbidden\",\"productionAuthority\":false,\"requirementHash\":",
    (signing_flags & kSecCodeSignatureLibraryValidation) != 0 ? "true" : "false",
    has_stapled_ticket ? "true" : "false",
    (int32_t)copy_self_status,
    (int32_t)static_copy_status,
    (int32_t)requirement_status,
    (int32_t)signing_information_status,
    (int32_t)static_validity_status,
    (int32_t)validity_status);
  if (requirement_hash[0] != '\0') setfarm_json_string_v2(requirement_hash); else printf("null");
  printf(",\"runtimeEnabled\":%s,\"schema\":\"setfarm.platform-release-bootstrap-darwin-host-self-observation.v2\",\"signatureClass\":",
    (signing_flags & kSecCodeSignatureRuntime) != 0 ? "true" : "false");
  setfarm_json_string_v2(setfarm_signature_class_v2(
    signing_information_status == errSecSuccess,
    has_identifier,
    has_cms,
    signing_flags));
  printf(",\"signingAuthority\":\"security_framework_observation_only\",\"signingFlags\":%" PRIu64 ",\"teamIdentifier\":",
    signing_flags);
  if (has_team_identifier) setfarm_json_string_v2(team_identifier); else printf("null");
  printf(",\"uniqueDigestAlgorithm\":%" PRIu64 "}\n",
    digest_algorithm);

  if (requirement_text != NULL) CFRelease(requirement_text);
  if (information != NULL) CFRelease(information);
  if (static_code != NULL) CFRelease(static_code);
  if (code != NULL) CFRelease(code);
  setfarm_zero_v2(challenge, sizeof(challenge));
  setfarm_zero_v2(unique_bytes, sizeof(unique_bytes));
  setfarm_zero_v2(unique_hex, sizeof(unique_hex));
  setfarm_zero_v2(identifier, sizeof(identifier));
  setfarm_zero_v2(team_identifier, sizeof(team_identifier));
  setfarm_zero_v2(requirement_hash, sizeof(requirement_hash));
  setfarm_zero_v2(code_directory_commitment, sizeof(code_directory_commitment));
  setfarm_zero_v2(host_identity_hash, sizeof(host_identity_hash));
  setfarm_zero_v2(&executable, sizeof(executable));
  return 0;
}
