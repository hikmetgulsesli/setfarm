import { createHash } from "node:crypto";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_CHILD_SOURCE_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
  NETWORK_SANDBOX_PROFILE_HASH_V2,
  NETWORK_SANDBOX_PROFILE_V2,
} from "./network-sandbox-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
} from "./schemas/network-isolation-negative-probe-v2.js";

const DENIED_PROBE_REFS_V2 = Object.freeze([
  "external_address_connect_denied_by_sandbox",
] as const);
const CONTROL_REFS_V2 = Object.freeze([
  "exact_loopback_round_trip",
  "redirect_observed_without_follow",
  "dns_result_supplementary_not_enforcement_authority",
] as const);

export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-installed-network-negative-denied-probe-set.v2",
    probes: DENIED_PROBE_REFS_V2,
  });
export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-installed-network-negative-control-set.v2",
    controls: CONTROL_REFS_V2,
  });
export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-installed-network-negative-probe-closure.v2",
    deniedProbes: DENIED_PROBE_REFS_V2,
    controls: CONTROL_REFS_V2,
  });

export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2 =
  Object.freeze({
    schema:
      "setfarm.platform-release-bootstrap-installed-network-negative-operation-policy.v2",
    version: "2.0.0",
    authorityScope: "test_fixture_characterization_only",
    productionAdmission: "forbidden",
    mutationAuthority: false,
    operation:
      "sandboxed_external_address_denial_with_loopback_redirect_controls_v2",
    target: "authenticated_cwd_directory_read_only_fenced_v2",
    scratch:
      "runner_owned_separate_deterministic_occurrence_root_exact_cleanup_v2",
    sandboxExecutableLocator: "../tools/sandbox-exec",
    sandboxProfileHash: NETWORK_SANDBOX_PROFILE_HASH_V2,
    probeProgramHash:
      NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
    normalizedEnvironmentHash:
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    probeClosureHash:
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2,
    deniedProbeSetHash:
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
    controlSetHash:
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2,
    attemptedProbeCount: DENIED_PROBE_REFS_V2.length,
    deniedProbeCount: DENIED_PROBE_REFS_V2.length,
    dnsDisposition:
      "supplementary_not_counted_as_enforcement_denial_v2",
    workingDirectoryPolicy: "authenticated_target_root_v2",
    outerEnvironmentPolicy: "exact_empty_environment_v2",
    innerEnvironmentPolicy: "exact_normalized_environment_v2",
    shell: "forbidden",
    timeoutMs: 8_000,
    maxOutputBytes: 64 * 1024,
    maxTargetEntries: 128,
    inputTransport: "preopened_read_only_fd3_exactly_once_v2",
    receiptSchema:
      "setfarm.platform-release-network-negative-probe-receipt.v2",
  } as const);

export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2 =
  hashCanonicalJson(
    PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2,
  );

export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_MODULE_SOURCE_V2 =
  [
    'import { spawn } from "node:child_process";',
    'import { createHash, randomBytes } from "node:crypto";',
    'import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, writeSync } from "node:fs";',
    'import { createServer } from "node:http";',
    'import path from "node:path";',
    'import { fileURLToPath } from "node:url";',
    `const POLICY = Object.freeze(${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_IDENTITY_V2,
    )});`,
    `const POLICY_HASH = ${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
    )};`,
    `const SANDBOX_PROFILE = ${JSON.stringify(NETWORK_SANDBOX_PROFILE_V2)};`,
    `const SANDBOX_PROFILE_HASH = ${JSON.stringify(
      NETWORK_SANDBOX_PROFILE_HASH_V2,
    )};`,
    `const PROBE_PROGRAM = ${JSON.stringify(
      NETWORK_ISOLATION_NEGATIVE_PROBE_CHILD_SOURCE_V2,
    )};`,
    `const PROBE_PROGRAM_HASH = ${JSON.stringify(
      NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
    )};`,
    `const NORMALIZED_ENVIRONMENT_NAMES = Object.freeze(${JSON.stringify(
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
    )});`,
    `const NORMALIZED_ENVIRONMENT_HASH = ${JSON.stringify(
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    )};`,
    `const PROBE_CLOSURE_HASH = ${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_PROBE_CLOSURE_HASH_V2,
    )};`,
    `const DENIED_PROBE_SET_HASH = ${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_DENIED_PROBE_SET_HASH_V2,
    )};`,
    `const CONTROL_SET_HASH = ${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_CONTROL_SET_HASH_V2,
    )};`,
    String.raw`
const INPUT_SCHEMA = "setfarm.platform-release-network-negative-probe-input.v2";
const OUTPUT_SCHEMA = "setfarm.platform-release-network-negative-probe-receipt.v2";
const FAILURE_SCHEMA = "setfarm.platform-release-bootstrap-operation-failure.v2";
const OPERATION_ABI_REF = "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2";
const VERSION = "2.0.0";
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const MAX_TARGET_ENTRIES = 128;
const TIMEOUT_MS = 8_000;
const FALLBACK_OCCURRENCE_ID = "00000000-0000-4000-8000-000000000000";
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID = /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/u;
const trustedArrayIsArray = Array.isArray;
const trustedBigInt = BigInt;
const trustedBufferAlloc = Buffer.alloc;
const trustedBufferConcat = Buffer.concat;
const trustedBufferFrom = Buffer.from;
const trustedCloseSync = closeSync;
const trustedCreateHash = createHash;
const trustedCreateServer = createServer;
const trustedExit = process.exit.bind(process);
const trustedFstatSync = fstatSync;
const trustedJsonParse = JSON.parse;
const trustedJsonStringify = JSON.stringify;
const trustedLstatSync = lstatSync;
const trustedNumber = Number;
const trustedNumberIsFinite = Number.isFinite;
const trustedObjectIs = Object.is;
const trustedObjectKeys = Object.keys;
const trustedOpenSync = openSync;
const trustedPathBasename = path.basename;
const trustedPathDirname = path.dirname;
const trustedPathJoin = path.join;
const trustedPathResolve = path.resolve;
const trustedRandomBytes = randomBytes;
const trustedReadSync = readSync;
const trustedReaddirSync = readdirSync;
const trustedReflectApply = Reflect.apply;
const trustedSpawn = spawn;
const trustedWriteSync = writeSync;
const trustedCwd = process.cwd.bind(process);
const trustedFileURLToPath = fileURLToPath;
const trustedHashPrototype = Object.getPrototypeOf(trustedCreateHash("sha256"));
const trustedHashUpdate = trustedHashPrototype.update;
const trustedHashDigest = trustedHashPrototype.digest;
const trustedReadOnlyNoFollowFlags =
  constants.O_RDONLY | (constants.O_CLOEXEC ?? 0) | (constants.O_NOFOLLOW ?? 0);
const trustedDirectoryFlags =
  trustedReadOnlyNoFollowFlags | (constants.O_DIRECTORY ?? 0);
const trustedFileTypeMask = trustedBigInt(constants.S_IFMT);
const trustedDirectoryType = trustedBigInt(constants.S_IFDIR);
const trustedRegularFileType = trustedBigInt(constants.S_IFREG);
const trustedModulePath = trustedFileURLToPath(import.meta.url);
const trustedSandboxExecutablePath = trustedPathJoin(
  trustedPathDirname(trustedModulePath), "..", "tools", "sandbox-exec",
);

function zeroBytes(value) {
  for (let index = 0; index < value.byteLength; index += 1) value[index] = 0;
}

function sortedStrings(values) {
  const result = [];
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    let cursor = result.length - 1;
    result.push(current);
    while (cursor >= 0 && result[cursor] > current) {
      result[cursor + 1] = result[cursor];
      cursor -= 1;
    }
    result[cursor + 1] = current;
  }
  return result;
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return trustedJsonStringify(value);
  if (typeof value === "number") {
    if (!trustedNumberIsFinite(value)) throw new Error("NETWORK_PROBE_NON_FINITE_NUMBER");
    return trustedObjectIs(value, -0) ? "0" : trustedJsonStringify(value);
  }
  if (trustedArrayIsArray(value)) {
    let output = "[";
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) output += ",";
      output += canonical(value[index]);
    }
    return output + "]";
  }
  if (typeof value === "object") {
    const keys = sortedStrings(trustedObjectKeys(value));
    let output = "{";
    for (let index = 0; index < keys.length; index += 1) {
      if (index > 0) output += ",";
      const key = keys[index];
      output += trustedJsonStringify(key) + ":" + canonical(value[key]);
    }
    return output + "}";
  }
  throw new Error("NETWORK_PROBE_UNSUPPORTED_VALUE");
}

function sha256Bytes(value) {
  const hash = trustedCreateHash("sha256");
  trustedReflectApply(trustedHashUpdate, hash, [value]);
  return trustedReflectApply(trustedHashDigest, hash, ["hex"]);
}

function hashCanonical(value) {
  const bytes = trustedBufferFrom(canonical(value), "utf8");
  try { return sha256Bytes(bytes); } finally { zeroBytes(bytes); }
}

function wireMessageHash(schemaRef, value) {
  const message = { ...value };
  delete message.messageHash;
  return hashCanonical({
    schema: "setfarm.platform-release-bootstrap-wire-message-hash.v2",
    schemaRef,
    message,
  });
}

function exactKeys(value, expected) {
  const actual = sortedStrings(trustedObjectKeys(value));
  const wanted = sortedStrings(expected);
  if (actual.length !== wanted.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== wanted[index]) return false;
  }
  return true;
}

function classifyChildDiagnostic(value) {
  const line = value.split("\n", 1)[0] ?? "";
  const mappings = [
    ["NETWORK_PROBE_CONFIG_INVALID", "NETWORK_PROBE_CHILD_CONFIG_INVALID"],
    ["NETWORK_PROBE_ENVIRONMENT_NOT_EXACT", "NETWORK_PROBE_CHILD_ENVIRONMENT_NOT_EXACT"],
    ["NETWORK_PROBE_ENVIRONMENT_HASH_MISMATCH", "NETWORK_PROBE_CHILD_ENVIRONMENT_HASH_MISMATCH"],
    ["NETWORK_PROBE_LOOPBACK_RESPONSE_LIMIT", "NETWORK_PROBE_CHILD_LOOPBACK_RESPONSE_LIMIT"],
    ["NETWORK_PROBE_LOOPBACK_TIMEOUT", "NETWORK_PROBE_CHILD_LOOPBACK_TIMEOUT"],
    ["NETWORK_PROBE_LOOPBACK_MISMATCH", "NETWORK_PROBE_CHILD_LOOPBACK_MISMATCH"],
    ["NETWORK_PROBE_DNS_UNTYPED", "NETWORK_PROBE_CHILD_DNS_UNTYPED"],
    ["NETWORK_PROBE_OUTBOUND_TIMEOUT", "NETWORK_PROBE_CHILD_OUTBOUND_TIMEOUT"],
    ["NETWORK_PROBE_OUTBOUND_UNTYPED", "NETWORK_PROBE_CHILD_OUTBOUND_UNTYPED"],
    ["NETWORK_PROBE_REDIRECT_MISMATCH", "NETWORK_PROBE_CHILD_REDIRECT_MISMATCH"],
    ["NETWORK_PROBE_FAILED", "NETWORK_PROBE_CHILD_FAILED"],
  ];
  for (const [prefix, diagnosticRef] of mappings) {
    if (line === prefix || line.startsWith(prefix + ":")) return diagnosticRef;
  }
  return "NETWORK_PROBE_PROCESS_FAILED";
}

function readBoundedInput() {
  const bytes = trustedBufferAlloc(MAX_INPUT_BYTES + 1);
  try {
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = trustedReadSync(3, bytes, offset, bytes.byteLength - offset, null);
      if (count === 0) break;
      offset += count;
    }
    if (offset > MAX_INPUT_BYTES) throw new Error("NETWORK_PROBE_INPUT_BOUND_INVALID");
    return trustedBufferFrom(bytes.subarray(0, offset));
  } finally {
    zeroBytes(bytes);
    try { trustedCloseSync(3); } catch { throw new Error("NETWORK_PROBE_INPUT_BOUND_INVALID"); }
  }
}

function stableIdentity(stat, hostIdentityHash, objectKind) {
  return {
    hostIdentityHash,
    objectKind,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  };
}

function boundedFilesystemNumber(value, minimum, maximum) {
  const result = trustedNumber(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
  }
  return result;
}

function mutableFingerprint(stat, contentHash, directEntryNamesHash) {
  return {
    ownerUid: boundedFilesystemNumber(stat.uid, 0, 4294967294),
    ownerGid: boundedFilesystemNumber(stat.gid, 0, 4294967294),
    mode: trustedNumber(stat.mode & 0o7777n).toString(8).padStart(4, "0"),
    linkCount: boundedFilesystemNumber(stat.nlink, 1, Number.MAX_SAFE_INTEGER),
    byteLength: boundedFilesystemNumber(stat.size, 0, Number.MAX_SAFE_INTEGER),
    contentHash,
    directEntryNamesHash,
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  };
}

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino
    && left.uid === right.uid && left.gid === right.gid
    && left.mode === right.mode && left.nlink === right.nlink
    && left.size === right.size && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function captureDirectory(directoryPath, hostIdentityHash, includeContentHash) {
  let descriptor = -1;
  try {
    const pathBefore = trustedLstatSync(directoryPath, { bigint: true });
    descriptor = trustedOpenSync(directoryPath, trustedDirectoryFlags);
    const descriptorStat = trustedFstatSync(descriptor, { bigint: true });
    const names = trustedReaddirSync(directoryPath, { encoding: "utf8" });
    const pathAfter = trustedLstatSync(directoryPath, { bigint: true });
    if (
      (descriptorStat.mode & trustedFileTypeMask) !== trustedDirectoryType
      || descriptorStat.nlink < 1n
      || !sameStat(pathBefore, descriptorStat)
      || !sameStat(descriptorStat, pathAfter)
      || names.length > MAX_TARGET_ENTRIES
      || names.some((name) => typeof name !== "string" || name.length < 1 || name.length > 255)
    ) throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
    const sortedNames = sortedStrings(names);
    const directEntryNamesHash = hashCanonical({
      schema: "setfarm.platform-release-bootstrap-installed-network-negative-directory-entries.v2",
      names: sortedNames,
    });
    const contentHash = includeContentHash
      ? hashCanonical({
          schema: "setfarm.platform-release-bootstrap-installed-network-negative-directory-content.v2",
          names: sortedNames,
        })
      : EMPTY_SHA256;
    return {
      stableIdentity: stableIdentity(descriptorStat, hostIdentityHash, "directory"),
      mutableFingerprint: mutableFingerprint(
        descriptorStat, contentHash, directEntryNamesHash,
      ),
      directEntryNames: sortedNames,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "NETWORK_PROBE_FILESYSTEM_DRIFT") throw error;
    throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
  } finally {
    if (descriptor >= 0) trustedCloseSync(descriptor);
  }
}

function captureFile(filePath, hostIdentityHash) {
  let descriptor = -1;
  let bytes;
  const eof = trustedBufferAlloc(1);
  try {
    const pathBefore = trustedLstatSync(filePath, { bigint: true });
    descriptor = trustedOpenSync(filePath, trustedReadOnlyNoFollowFlags);
    const descriptorBefore = trustedFstatSync(descriptor, { bigint: true });
    if (
      (descriptorBefore.mode & trustedFileTypeMask) !== trustedRegularFileType
      || descriptorBefore.nlink !== 1n || descriptorBefore.size < 1n
      || descriptorBefore.size > 32n * 1024n * 1024n
      || !sameStat(pathBefore, descriptorBefore)
    ) throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
    bytes = trustedBufferAlloc(trustedNumber(descriptorBefore.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = trustedReadSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const overflow = trustedReadSync(descriptor, eof, 0, 1, offset);
    const descriptorAfter = trustedFstatSync(descriptor, { bigint: true });
    const pathAfter = trustedLstatSync(filePath, { bigint: true });
    if (offset !== bytes.byteLength || overflow !== 0
      || !sameStat(descriptorBefore, descriptorAfter)
      || !sameStat(descriptorAfter, pathAfter)) {
      throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
    }
    return {
      stableIdentity: stableIdentity(descriptorAfter, hostIdentityHash, "ordinary_file"),
      mutableFingerprint: mutableFingerprint(
        descriptorAfter, sha256Bytes(bytes), EMPTY_SHA256,
      ),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "NETWORK_PROBE_FILESYSTEM_DRIFT") throw error;
    throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
  } finally {
    if (bytes !== undefined) zeroBytes(bytes);
    zeroBytes(eof);
    if (descriptor >= 0) trustedCloseSync(descriptor);
  }
}

async function runProbe(scratchRoot) {
    let requestCount = 0;
    const nonce = trustedRandomBytes(32).toString("hex");
    const redirectLocation = "https://example.com/setfarm-network-probe-v2";
    const server = trustedCreateServer((request, response) => {
      requestCount += 1;
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname === "/echo" && url.searchParams.get("nonce") === nonce) {
        response.writeHead(200, { connection: "close", "content-type": "text/plain", "content-length": String(Buffer.byteLength(nonce)) });
        response.end(nonce);
        return;
      }
      if (url.pathname === "/redirect") {
        response.writeHead(302, { connection: "close", location: redirectLocation, "content-length": "0" });
        response.end();
        return;
      }
      response.writeHead(404, { connection: "close", "content-length": "0" });
      response.end();
    });
    let child;
    let timer;
    let terminal;
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    try {
      await new Promise((listenResolve, listenReject) => {
        server.once("error", listenReject);
        server.listen(0, "127.0.0.1", listenResolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("NETWORK_PROBE_SERVER_FAILED");
      const config = {
        knownOsInjectedVariableNames: ["__CF_USER_TEXT_ENCODING"],
        dnsDisposition: POLICY.dnsDisposition,
        normalizedVariableNames: [...NORMALIZED_ENVIRONMENT_NAMES],
        normalizedEnvironmentHash: NORMALIZED_ENVIRONMENT_HASH,
        nonce,
        port: address.port,
        redirectLocation,
      };
      const environment = {
        CI: "true", HOME: trustedPathJoin(scratchRoot, "home"), HOST: "127.0.0.1",
        LANG: "C.UTF-8", LC_ALL: "C.UTF-8", NO_COLOR: "1",
        PORT: String(address.port), RUNTIME_URL: "http://127.0.0.1:" + String(address.port),
        RUN_CACHE_DIR: trustedPathJoin(scratchRoot, "cache"),
        RUN_HOME: trustedPathJoin(scratchRoot, "home"),
        RUN_TMPDIR: trustedPathJoin(scratchRoot, "tmp"),
        TEMP: trustedPathJoin(scratchRoot, "tmp"), TMP: trustedPathJoin(scratchRoot, "tmp"),
        TMPDIR: trustedPathJoin(scratchRoot, "tmp"), TZ: "UTC",
      };
      child = trustedSpawn(trustedSandboxExecutablePath, [
        "-p", SANDBOX_PROFILE, process.execPath, "-e", PROBE_PROGRAM,
        trustedBufferFrom(trustedJsonStringify(config), "utf8").toString("base64url"),
      ], {
        cwd: scratchRoot,
        env: environment,
        shell: false,
        detached: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      timer = setTimeout(() => {
        if (terminal === undefined) {
          terminal = new Error("NETWORK_PROBE_TIMEOUT");
        }
        try { child.kill("SIGKILL"); } catch { /* close owns settlement */ }
      }, TIMEOUT_MS);
      child.stdout.on("data", (chunk) => {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > MAX_OUTPUT_BYTES) {
          if (terminal === undefined) {
            terminal = new Error("NETWORK_PROBE_OUTPUT_LIMIT");
          }
          try { child.kill("SIGKILL"); } catch { /* close owns settlement */ }
          return;
        }
        stdoutChunks.push(trustedBufferFrom(chunk));
      });
      child.stderr.on("data", (chunk) => {
        stderrBytes += chunk.byteLength;
        if (stderrBytes > MAX_OUTPUT_BYTES) {
          if (terminal === undefined) {
            terminal = new Error("NETWORK_PROBE_OUTPUT_LIMIT");
          }
          try { child.kill("SIGKILL"); } catch { /* close owns settlement */ }
          return;
        }
        stderrChunks.push(trustedBufferFrom(chunk));
      });
      const settled = await new Promise((settleResolve, settleReject) => {
        child.once("error", () => settleReject(new Error("NETWORK_PROBE_SPAWN_FAILED")));
        child.once("close", (exitCode, signal) => settleResolve({ exitCode, signal }));
      });
      if (timer !== undefined) clearTimeout(timer);
      const stdout = trustedBufferConcat(stdoutChunks);
      const stderr = trustedBufferConcat(stderrChunks);
      try {
        if (terminal !== undefined) throw terminal;
        if (settled.exitCode !== 0 || settled.signal !== null) {
          const diagnostic = stderr.toString("utf8");
          if (diagnostic.startsWith("NETWORK_PROBE_OUTBOUND_ALLOWED")
            || diagnostic.startsWith("NETWORK_PROBE_DNS_ALLOWED")) {
            throw new Error("NETWORK_PROBE_POLICY_MISMATCH");
          }
          throw new Error(classifyChildDiagnostic(diagnostic));
        }
        if (stderr.byteLength !== 0 || stdout.byteLength < 2) {
          throw new Error("NETWORK_PROBE_OUTPUT_INVALID");
        }
        const observedText = stdout.toString("utf8");
        let observed;
        try { observed = trustedJsonParse(observedText); }
        catch { throw new Error("NETWORK_PROBE_OUTPUT_INVALID"); }
        if (
          observed === null || typeof observed !== "object"
          || !exactKeys(observed, ["normalizedEnvironmentHash", "probes"])
          || observed.probes === null || typeof observed.probes !== "object"
          || !exactKeys(observed.probes, ["loopback", "dns", "outbound", "redirect"])
          || observed.probes.loopback === null || typeof observed.probes.loopback !== "object"
          || !exactKeys(observed.probes.loopback, ["status", "host", "requestNonceHash", "responseNonceHash"])
          || observed.probes.dns === null || typeof observed.probes.dns !== "object"
          || !exactKeys(observed.probes.dns, ["status", "outcome", "hostname", "errorCode"])
          || observed.probes.outbound === null || typeof observed.probes.outbound !== "object"
          || !exactKeys(observed.probes.outbound, ["status", "host", "port", "errorCode"])
          || observed.probes.redirect === null || typeof observed.probes.redirect !== "object"
          || !exactKeys(observed.probes.redirect, ["status", "httpStatus", "locationHash", "requestCount"])
          || observedText !== canonical(observed) + "\n"
          || typeof observed.probes.loopback.requestNonceHash !== "string"
          || !SHA256.test(observed.probes.loopback.requestNonceHash)
          || typeof observed.probes.loopback.responseNonceHash !== "string"
          || !SHA256.test(observed.probes.loopback.responseNonceHash)
          || typeof observed.probes.redirect.locationHash !== "string"
          || !SHA256.test(observed.probes.redirect.locationHash)
        ) throw new Error("NETWORK_PROBE_OUTPUT_INVALID");
        const nonceHash = sha256Bytes(nonce);
        if (
          observed.normalizedEnvironmentHash !== NORMALIZED_ENVIRONMENT_HASH
          || observed.probes.loopback.requestNonceHash !== nonceHash
          || observed.probes.loopback.responseNonceHash !== nonceHash
          || observed.probes?.loopback?.status !== "passed"
          || observed.probes.loopback.host !== "127.0.0.1"
          || observed.probes.loopback.requestNonceHash !== observed.probes.loopback.responseNonceHash
          || observed.probes.dns.status !== "supplementary_observed"
          || observed.probes.dns.hostname !== "example.com"
          || !["lookup_error", "resolved"].includes(observed.probes.dns.outcome)
          || (observed.probes.dns.outcome === "resolved"
            && observed.probes.dns.errorCode !== null)
          || (observed.probes.dns.outcome === "lookup_error"
            && !["EACCES", "EAI_AGAIN", "ENOTFOUND", "EPERM", "OTHER"]
              .includes(observed.probes.dns.errorCode))
          || observed.probes?.outbound?.status !== "denied"
          || observed.probes.outbound.host !== "198.51.100.1"
          || observed.probes.outbound.port !== 9
          || !["EACCES", "EPERM"].includes(observed.probes.outbound.errorCode)
          || observed.probes?.redirect?.status !== "rejected_without_follow"
          || observed.probes.redirect.httpStatus !== 302
          || observed.probes.redirect.locationHash !== sha256Bytes(redirectLocation)
          || observed.probes.redirect.requestCount !== 1
          || requestCount !== 2
        ) throw new Error("NETWORK_PROBE_POLICY_MISMATCH");
        return {
          childPid: child.pid,
          stdoutHash: sha256Bytes(stdout),
          probes: observed.probes,
        };
      } finally {
        zeroBytes(stdout);
        zeroBytes(stderr);
      }
    } catch (error) {
      if (timer !== undefined) clearTimeout(timer);
      if (child !== undefined) {
        try { child.kill("SIGKILL"); } catch { /* best effort */ }
      }
      throw error;
    } finally {
      for (const chunks of [stdoutChunks, stderrChunks]) {
        for (const chunk of chunks) zeroBytes(chunk);
        chunks.length = 0;
      }
      await new Promise((closeResolve) => server.close(() => closeResolve()));
    }
}

function emitCanonicalAndExit(value, exitCode) {
  const bytes = trustedBufferFrom(canonical(value) + "\n", "utf8");
  try { trustedWriteSync(1, bytes, 0, bytes.byteLength, null); }
  finally { zeroBytes(bytes); trustedExit(exitCode); }
}

function failurePolicy(error) {
  const diagnosticRef = error instanceof Error ? error.message : "NETWORK_PROBE_INTERNAL_FAILURE";
  switch (diagnosticRef) {
    case "NETWORK_PROBE_INPUT_BOUND_INVALID":
    case "NETWORK_PROBE_INPUT_INVALID":
      return { errorCode: "INPUT_INVALID", phaseRef: "NETWORK_NEGATIVE_PROBE_INPUT_V2", retryDisposition: "terminal", diagnosticRef };
    case "NETWORK_PROBE_POLICY_MISMATCH":
      return { errorCode: "POLICY_MISMATCH", phaseRef: "NETWORK_NEGATIVE_PROBE_POLICY_V2", retryDisposition: "terminal", diagnosticRef };
    case "NETWORK_PROBE_FILESYSTEM_DRIFT":
    case "NETWORK_PROBE_TARGET_IDENTITY_MISMATCH":
      return { errorCode: "AUTHORITY_DRIFT", phaseRef: "NETWORK_NEGATIVE_PROBE_FILESYSTEM_FENCE_V2", retryDisposition: "retry_after_authority_delta", diagnosticRef };
    case "NETWORK_PROBE_TIMEOUT":
      return { errorCode: "TIMEOUT", phaseRef: "NETWORK_NEGATIVE_PROBE_EXECUTION_V2", retryDisposition: "terminal", diagnosticRef };
    case "NETWORK_PROBE_OUTPUT_LIMIT":
    case "NETWORK_PROBE_OUTPUT_INVALID":
      return { errorCode: "OUTPUT_INVALID", phaseRef: "NETWORK_NEGATIVE_PROBE_OBSERVATION_V2", retryDisposition: "terminal", diagnosticRef };
    case "NETWORK_PROBE_SPAWN_FAILED":
    case "NETWORK_PROBE_PROCESS_FAILED":
    case "NETWORK_PROBE_SERVER_FAILED":
    case "NETWORK_PROBE_CHILD_CONFIG_INVALID":
    case "NETWORK_PROBE_CHILD_ENVIRONMENT_NOT_EXACT":
    case "NETWORK_PROBE_CHILD_ENVIRONMENT_HASH_MISMATCH":
    case "NETWORK_PROBE_CHILD_LOOPBACK_RESPONSE_LIMIT":
    case "NETWORK_PROBE_CHILD_LOOPBACK_TIMEOUT":
    case "NETWORK_PROBE_CHILD_LOOPBACK_MISMATCH":
    case "NETWORK_PROBE_CHILD_DNS_UNTYPED":
    case "NETWORK_PROBE_CHILD_OUTBOUND_TIMEOUT":
    case "NETWORK_PROBE_CHILD_OUTBOUND_UNTYPED":
    case "NETWORK_PROBE_CHILD_REDIRECT_MISMATCH":
    case "NETWORK_PROBE_CHILD_FAILED":
      return { errorCode: "EXECUTION_FAILED", phaseRef: "NETWORK_NEGATIVE_PROBE_EXECUTION_V2", retryDisposition: "terminal", diagnosticRef };
    default:
      return { errorCode: "INTERNAL_FAILURE", phaseRef: "NETWORK_NEGATIVE_PROBE_EXECUTION_V2", retryDisposition: "terminal", diagnosticRef: "NETWORK_PROBE_INTERNAL_FAILURE" };
  }
}

function emitFailure(occurrenceId, authorityStateHash, error) {
  const policy = failurePolicy(error);
  const identity = {
    schema: FAILURE_SCHEMA, version: VERSION, occurrenceId,
    operationAbiRef: OPERATION_ABI_REF, errorCode: policy.errorCode,
    phaseRef: policy.phaseRef, retryDisposition: policy.retryDisposition,
    authorityStateHash,
    diagnosticHash: hashCanonical({
      schema: "setfarm.platform-release-network-negative-probe-diagnostic-hash.v2",
      diagnosticRef: policy.diagnosticRef,
    }),
  };
  emitCanonicalAndExit({ ...identity, messageHash: wireMessageHash(FAILURE_SCHEMA, identity) }, 1);
}

export async function runPlatformReleaseNetworkNegativeProbeV2() {
  let occurrenceId = FALLBACK_OCCURRENCE_ID;
  let authorityStateHash = null;
  try {
    const inputBytes = readBoundedInput();
    let input;
    let inputText;
    try { inputText = inputBytes.toString("utf8"); input = trustedJsonParse(inputText); }
    finally { zeroBytes(inputBytes); }
    if (
      input === null || typeof input !== "object" || trustedArrayIsArray(input)
      || !exactKeys(input, ["schema", "version", "occurrenceId", "hostIdentityHash", "targetRootPhysicalIdentityHash", "sandboxPolicyHash", "hostCompositionReceiptHash", "messageHash"])
      || input.schema !== INPUT_SCHEMA || input.version !== VERSION
      || typeof input.occurrenceId !== "string" || !UUID.test(input.occurrenceId)
      || typeof input.hostIdentityHash !== "string" || !SHA256.test(input.hostIdentityHash)
      || typeof input.targetRootPhysicalIdentityHash !== "string" || !SHA256.test(input.targetRootPhysicalIdentityHash)
      || typeof input.sandboxPolicyHash !== "string" || !SHA256.test(input.sandboxPolicyHash)
      || typeof input.hostCompositionReceiptHash !== "string" || !SHA256.test(input.hostCompositionReceiptHash)
      || typeof input.messageHash !== "string" || !SHA256.test(input.messageHash)
      || input.messageHash !== wireMessageHash(INPUT_SCHEMA, input)
      || inputText !== canonical(input)
    ) throw new Error("NETWORK_PROBE_INPUT_INVALID");
    occurrenceId = input.occurrenceId;
    authorityStateHash = input.hostCompositionReceiptHash;
    if (input.sandboxPolicyHash !== POLICY_HASH || POLICY.productionAdmission !== "forbidden") {
      throw new Error("NETWORK_PROBE_POLICY_MISMATCH");
    }
    const targetRoot = trustedPathResolve(trustedCwd());
    const scratchRoot = trustedPathJoin(
      "/private/tmp", "setfarm-installed-network-negative-operation-v2-" + occurrenceId,
    );
    if (trustedPathBasename(scratchRoot) !== "setfarm-installed-network-negative-operation-v2-" + occurrenceId) {
      throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
    }
    const targetBefore = captureDirectory(targetRoot, input.hostIdentityHash, false);
    const targetPhysicalIdentityHash = hashCanonical({
      schema: "setfarm.platform-release-bootstrap-installed-network-negative-target-stable-identity.v2",
      stableIdentity: targetBefore.stableIdentity,
    });
    if (targetPhysicalIdentityHash !== input.targetRootPhysicalIdentityHash) {
      throw new Error("NETWORK_PROBE_TARGET_IDENTITY_MISMATCH");
    }
    const sandboxBefore = captureFile(trustedSandboxExecutablePath, input.hostIdentityHash);
    const scratchBefore = captureDirectory(scratchRoot, input.hostIdentityHash, true);
    if (canonical(scratchBefore.directEntryNames) !== canonical(["cache", "home", "tmp"])) {
      throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
    }
    const observed = await runProbe(scratchRoot);
    const targetAfter = captureDirectory(targetRoot, input.hostIdentityHash, false);
    const sandboxAfter = captureFile(trustedSandboxExecutablePath, input.hostIdentityHash);
    const scratchAfter = captureDirectory(scratchRoot, input.hostIdentityHash, true);
    if (canonical(targetBefore) !== canonical(targetAfter)
      || canonical(sandboxBefore) !== canonical(sandboxAfter)
      || canonical(scratchBefore) !== canonical(scratchAfter)) {
      throw new Error("NETWORK_PROBE_FILESYSTEM_DRIFT");
    }
    const probeOutcome = "all_denied";
    const controlOutcome = "loopback_and_redirect_observed";
    const stableNetworkProjectionHash = hashCanonical({
      schema: "setfarm.platform-release-composition-network-negative-stable-projection-hash.v2",
      projection: {
        sandboxPolicyHash: input.sandboxPolicyHash,
        sandboxProfileHash: SANDBOX_PROFILE_HASH,
        probeProgramHash: PROBE_PROGRAM_HASH,
        normalizedEnvironmentHash: NORMALIZED_ENVIRONMENT_HASH,
        probeClosureHash: PROBE_CLOSURE_HASH,
        probeOutcome, attemptedProbeCount: 1, deniedProbeCount: 1,
        deniedProbeSetHash: DENIED_PROBE_SET_HASH,
        controlOutcome, controlSetHash: CONTROL_SET_HASH,
        hostCompositionReceiptHash: input.hostCompositionReceiptHash,
      },
    });
    const networkObservationHash = hashCanonical({
      schema: "setfarm.platform-release-bootstrap-installed-network-negative-observation.v2",
      occurrenceId: input.occurrenceId,
      target: targetBefore,
      sandbox: sandboxBefore,
      scratch: scratchBefore,
      childPid: observed.childPid,
      childStdoutHash: observed.stdoutHash,
      probes: observed.probes,
      stableNetworkProjectionHash,
    });
    const identity = {
      schema: OUTPUT_SCHEMA, version: VERSION, occurrenceId: input.occurrenceId,
      hostIdentityHash: input.hostIdentityHash,
      targetRootPhysicalIdentityHash: input.targetRootPhysicalIdentityHash,
      sandboxPolicyHash: input.sandboxPolicyHash,
      sandboxProfileHash: SANDBOX_PROFILE_HASH,
      probeProgramHash: PROBE_PROGRAM_HASH,
      normalizedEnvironmentHash: NORMALIZED_ENVIRONMENT_HASH,
      probeClosureHash: PROBE_CLOSURE_HASH,
      probeOutcome, attemptedProbeCount: 1, deniedProbeCount: 1,
      deniedProbeSetHash: DENIED_PROBE_SET_HASH,
      controlOutcome, controlSetHash: CONTROL_SET_HASH,
      stableNetworkProjectionHash, networkObservationHash,
      hostCompositionReceiptHash: input.hostCompositionReceiptHash,
    };
    emitCanonicalAndExit({ ...identity, messageHash: wireMessageHash(OUTPUT_SCHEMA, identity) }, 0);
  } catch (error) {
    emitFailure(occurrenceId, authorityStateHash, error);
  }
}
`,
  ].join("\n");

export const PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_MODULE_SOURCE_HASH_V2 =
  createHash("sha256")
    .update(
      PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_MODULE_SOURCE_V2,
      "utf8",
    )
    .digest("hex");
