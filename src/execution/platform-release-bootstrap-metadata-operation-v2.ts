import { createHash } from "node:crypto";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

export const PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2 =
  Object.freeze({
    schema:
      "setfarm.platform-release-bootstrap-installed-metadata-operation-policy.v2",
    version: "2.0.0",
    authorityScope: "test_fixture_characterization_only",
    productionAdmission: "forbidden",
    mutationAuthority: false,
    operation: "read_only_xattr_and_acl_observation_v2",
    target: "authenticated_cwd_directory_v2",
    tools: Object.freeze([
      Object.freeze({
        toolRef: "XATTR_OBSERVER_V2",
        locator: "../tools/xattr-observe",
        argv: Object.freeze(["."]),
      }),
      Object.freeze({
        toolRef: "ACL_OBSERVER_V2",
        locator: "../tools/acl-observe",
        argv: Object.freeze(["-lde@", "."]),
      }),
    ]),
    allowedSystemManagedXattrNames: Object.freeze([
      "com.apple.provenance",
    ]),
    workingDirectoryPolicy: "authenticated_target_root_v2",
    environmentPolicy: "exact_empty_environment_v2",
    shell: "forbidden",
    timeoutMs: 8_000,
    maxOutputBytes: 64 * 1024,
    maxToolBytes: 32 * 1024 * 1024,
    inputTransport: "preopened_read_only_fd3_exactly_once_v2",
    receiptSchema:
      "setfarm.platform-release-metadata-probe-receipt.v2",
  } as const);

export const PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2 =
  hashCanonicalJson(
    PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2,
  );

export const PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2 =
  [
    'import { spawn } from "node:child_process";',
    'import { createHash } from "node:crypto";',
    'import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, readdirSync, writeSync } from "node:fs";',
    'import path from "node:path";',
    'import { fileURLToPath } from "node:url";',
    `const METADATA_POLICY = Object.freeze(${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_IDENTITY_V2,
    )});`,
    `const METADATA_POLICY_HASH = ${JSON.stringify(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
    )};`,
    String.raw`
const INPUT_SCHEMA = "setfarm.platform-release-metadata-probe-input.v2";
const OUTPUT_SCHEMA = "setfarm.platform-release-metadata-probe-receipt.v2";
const FAILURE_SCHEMA = "setfarm.platform-release-bootstrap-operation-failure.v2";
const OPERATION_ABI_REF = "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2";
const VERSION = "2.0.0";
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_TOOL_BYTES = 32 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024;
const TOOL_TIMEOUT_MS = 8_000;
const MAX_TARGET_ENTRY_COUNT = 128;
const FALLBACK_OCCURRENCE_ID = "00000000-0000-4000-8000-000000000000";
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SHA256 = /^[a-f0-9]{64}$/u;
const UUID =
  /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/u;
const trustedArrayIsArray = Array.isArray;
const trustedBigInt = BigInt;
const trustedBufferAlloc = Buffer.alloc;
const trustedBufferConcat = Buffer.concat;
const trustedBufferFrom = Buffer.from;
const trustedBufferToString = Buffer.prototype.toString;
const trustedClearTimeout = clearTimeout;
const trustedCloseSync = closeSync;
const trustedCreateHash = createHash;
const trustedFileURLToPath = fileURLToPath;
const trustedFstatSync = fstatSync;
const trustedJsonParse = JSON.parse;
const trustedJsonStringify = JSON.stringify;
const trustedLstatSync = lstatSync;
const trustedNumber = Number;
const trustedNumberIsFinite = Number.isFinite;
const trustedNumberIsSafeInteger = Number.isSafeInteger;
const trustedObjectIs = Object.is;
const trustedObjectKeys = Object.keys;
const trustedOpenSync = openSync;
const trustedPathDirname = path.dirname;
const trustedPathJoin = path.join;
const trustedPathResolve = path.resolve;
const trustedReadSync = readSync;
const trustedReaddirSync = readdirSync;
const trustedReflectApply = Reflect.apply;
const trustedSetTimeout = setTimeout;
const trustedSpawn = spawn;
const trustedWriteSync = writeSync;
const trustedExit = process.exit.bind(process);
const trustedCwd = process.cwd.bind(process);
const trustedHashPrototype = Object.getPrototypeOf(
  trustedCreateHash("sha256"),
);
const trustedHashUpdate = trustedHashPrototype.update;
const trustedHashDigest = trustedHashPrototype.digest;
const trustedReadOnlyNoFollowFlags =
  constants.O_RDONLY
  | (constants.O_CLOEXEC ?? 0)
  | (constants.O_NOFOLLOW ?? 0);
const trustedDirectoryFlags =
  trustedReadOnlyNoFollowFlags | (constants.O_DIRECTORY ?? 0);
const trustedFileTypeMask = trustedBigInt(constants.S_IFMT);
const trustedDirectoryType = trustedBigInt(constants.S_IFDIR);
const trustedRegularFileType = trustedBigInt(constants.S_IFREG);
const trustedModulePath = trustedFileURLToPath(import.meta.url);
const trustedModuleDirectory = trustedPathDirname(trustedModulePath);
const trustedXattrObserverPath = trustedPathJoin(
  trustedModuleDirectory,
  "..",
  "tools",
  "xattr-observe",
);
const trustedAclObserverPath = trustedPathJoin(
  trustedModuleDirectory,
  "..",
  "tools",
  "acl-observe",
);

function zeroBytes(value) {
  for (let index = 0; index < value.byteLength; index += 1) {
    value[index] = 0;
  }
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

function sortedKeys(value) {
  return sortedStrings(trustedObjectKeys(value));
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return trustedJsonStringify(value);
  if (typeof value === "number") {
    if (!trustedNumberIsFinite(value)) {
      throw new Error("METADATA_PROBE_NON_FINITE_NUMBER");
    }
    return trustedObjectIs(value, -0)
      ? "0"
      : trustedJsonStringify(value);
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
    const keys = sortedKeys(value);
    let output = "{";
    for (let index = 0; index < keys.length; index += 1) {
      if (index > 0) output += ",";
      const key = keys[index];
      output += trustedJsonStringify(key) + ":" + canonical(value[key]);
    }
    return output + "}";
  }
  throw new Error("METADATA_PROBE_UNSUPPORTED_VALUE");
}

function sha256Bytes(value) {
  const hash = trustedCreateHash("sha256");
  trustedReflectApply(trustedHashUpdate, hash, [value]);
  return trustedReflectApply(trustedHashDigest, hash, ["hex"]);
}

function hashCanonical(value) {
  const bytes = trustedBufferFrom(canonical(value), "utf8");
  try {
    return sha256Bytes(bytes);
  } finally {
    zeroBytes(bytes);
  }
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
  const actual = sortedKeys(value);
  const wanted = sortedStrings(expected);
  if (actual.length !== wanted.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== wanted[index]) return false;
  }
  return true;
}

function bufferText(value) {
  return trustedReflectApply(trustedBufferToString, value, ["utf8"]);
}

function readBoundedInput() {
  const bytes = trustedBufferAlloc(MAX_INPUT_BYTES + 1);
  let closeFailed = false;
  try {
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = trustedReadSync(
        3,
        bytes,
        offset,
        bytes.byteLength - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    if (offset < 1 || offset > MAX_INPUT_BYTES) {
      throw new Error("METADATA_PROBE_INPUT_BOUND_INVALID");
    }
    return bytes.subarray(0, offset);
  } catch (error) {
    zeroBytes(bytes);
    throw error;
  } finally {
    try {
      trustedCloseSync(3);
    } catch {
      closeFailed = true;
    }
    if (closeFailed) {
      zeroBytes(bytes);
      throw new Error("METADATA_PROBE_INPUT_BOUND_INVALID");
    }
  }
}

function sameStat(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.nlink === right.nlink
    && left.uid === right.uid
    && left.gid === right.gid
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function boundedOwnerId(value) {
  const number = trustedNumber(value);
  if (
    !trustedNumberIsFinite(number)
    || !trustedNumberIsSafeInteger(number)
    || number < 0
    || number > 4_294_967_294
  ) {
    throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
  }
  return number;
}

function modeText(stat) {
  return trustedNumber(stat.mode & 0o7777n)
    .toString(8)
    .padStart(4, "0");
}

function stableIdentity(stat, hostIdentityHash, objectKind) {
  return {
    hostIdentityHash,
    objectKind,
    device: stat.dev.toString(10),
    inode: stat.ino.toString(10),
  };
}

function mutableFingerprint(stat, contentHash) {
  return {
    ownerUid: boundedOwnerId(stat.uid),
    ownerGid: boundedOwnerId(stat.gid),
    mode: modeText(stat),
    linkCount: trustedNumber(stat.nlink),
    byteLength: trustedNumber(stat.size),
    contentHash,
    modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
    changedTimeNanoseconds: stat.ctimeNs.toString(10),
  };
}

function captureTarget(targetRoot, hostIdentityHash) {
  let descriptor = -1;
  try {
    const pathBefore = trustedLstatSync(targetRoot, { bigint: true });
    descriptor = trustedOpenSync(targetRoot, trustedDirectoryFlags);
    const descriptorBefore = trustedFstatSync(
      descriptor,
      { bigint: true },
    );
    if (
      (descriptorBefore.mode & trustedFileTypeMask)
        !== trustedDirectoryType
      || descriptorBefore.nlink < 1n
      || !sameStat(pathBefore, descriptorBefore)
    ) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    const names = sortedStrings(
      trustedReaddirSync(targetRoot, { encoding: "utf8" }),
    );
    if (
      names.length > MAX_TARGET_ENTRY_COUNT
      || names.some((name) =>
        typeof name !== "string"
        || name.length < 1
        || name.length > 255)
    ) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    const descriptorAfter = trustedFstatSync(
      descriptor,
      { bigint: true },
    );
    const pathAfter = trustedLstatSync(targetRoot, { bigint: true });
    if (
      !sameStat(descriptorBefore, descriptorAfter)
      || !sameStat(descriptorAfter, pathAfter)
    ) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    const directEntryNamesHash = hashCanonical({
      schema:
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-directory-entries.v2",
      entries: names,
    });
    const stable = stableIdentity(
      descriptorAfter,
      hostIdentityHash,
      "directory",
    );
    return {
      stableIdentity: stable,
      mutableFingerprint: mutableFingerprint(
        descriptorAfter,
        directEntryNamesHash,
      ),
      directEntryNames: names,
      directEntryNamesHash,
    };
  } catch (error) {
    if (
      error instanceof Error
      && error.message === "METADATA_PROBE_FILESYSTEM_DRIFT"
    ) throw error;
    throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
  } finally {
    if (descriptor >= 0) trustedCloseSync(descriptor);
  }
}

function captureTool(toolPath, hostIdentityHash, toolRef) {
  let descriptor = -1;
  let bytes;
  const eofProbe = trustedBufferAlloc(1);
  try {
    const pathBefore = trustedLstatSync(toolPath, { bigint: true });
    descriptor = trustedOpenSync(
      toolPath,
      trustedReadOnlyNoFollowFlags,
    );
    const descriptorBefore = trustedFstatSync(
      descriptor,
      { bigint: true },
    );
    if (
      (descriptorBefore.mode & trustedFileTypeMask)
        !== trustedRegularFileType
      || descriptorBefore.nlink !== 1n
      || descriptorBefore.size < 1n
      || descriptorBefore.size > trustedBigInt(MAX_TOOL_BYTES)
      || !sameStat(pathBefore, descriptorBefore)
    ) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    bytes = trustedBufferAlloc(trustedNumber(descriptorBefore.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const count = trustedReadSync(
        descriptor,
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (count === 0) break;
      offset += count;
    }
    const overflow = trustedReadSync(
      descriptor,
      eofProbe,
      0,
      1,
      offset,
    );
    const descriptorAfter = trustedFstatSync(
      descriptor,
      { bigint: true },
    );
    const pathAfter = trustedLstatSync(toolPath, { bigint: true });
    if (
      offset !== bytes.byteLength
      || overflow !== 0
      || !sameStat(descriptorBefore, descriptorAfter)
      || !sameStat(descriptorAfter, pathAfter)
    ) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    const contentHash = sha256Bytes(bytes);
    return {
      toolRef,
      stableIdentity: stableIdentity(
        descriptorAfter,
        hostIdentityHash,
        "ordinary_file",
      ),
      mutableFingerprint: mutableFingerprint(
        descriptorAfter,
        contentHash,
      ),
    };
  } catch (error) {
    if (
      error instanceof Error
      && error.message === "METADATA_PROBE_FILESYSTEM_DRIFT"
    ) throw error;
    throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
  } finally {
    if (bytes !== undefined) zeroBytes(bytes);
    zeroBytes(eofProbe);
    if (descriptor >= 0) trustedCloseSync(descriptor);
  }
}

function runObserver(toolPath, argv, targetRoot, toolRef) {
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status = "exited";
    let settled = false;
    let timer;
    let child;
    const zeroChunks = (chunks) => {
      for (let index = 0; index < chunks.length; index += 1) {
        zeroBytes(chunks[index]);
      }
      chunks.length = 0;
    };
    const kill = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The close event owns settlement after a concurrent exit.
      }
    };
    const settle = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) trustedClearTimeout(timer);
      const stdout = trustedBufferConcat(stdoutChunks);
      const stderr = trustedBufferConcat(stderrChunks);
      zeroChunks(stdoutChunks);
      zeroChunks(stderrChunks);
      if (
        status !== "exited"
        || exitCode !== 0
        || signal !== null
        || stderr.byteLength !== 0
      ) {
        zeroBytes(stdout);
        zeroBytes(stderr);
        const diagnostic = status === "timed_out"
          ? "METADATA_PROBE_TIMEOUT"
          : status === "output_limit_exceeded"
            ? "METADATA_PROBE_OUTPUT_LIMIT"
            : status === "spawn_failed"
              ? "METADATA_PROBE_SPAWN_FAILED"
              : "METADATA_PROBE_PROCESS_FAILED";
        reject(new Error(diagnostic));
        return;
      }
      resolve({
        toolRef,
        argv,
        stdout,
        stderr,
      });
    };
    try {
      child = trustedSpawn(toolPath, argv, {
        cwd: targetRoot,
        env: {},
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      reject(new Error("METADATA_PROBE_SPAWN_FAILED"));
      return;
    }
    child.once("error", () => {
      status = "spawn_failed";
      kill();
    });
    child.once("close", settle);
    if (!child.stdout || !child.stderr) {
      status = "spawn_failed";
      kill();
      return;
    }
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        status = "output_limit_exceeded";
        kill();
        return;
      }
      stdoutChunks.push(trustedBufferFrom(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > MAX_OUTPUT_BYTES) {
        status = "output_limit_exceeded";
        kill();
        return;
      }
      stderrChunks.push(trustedBufferFrom(chunk));
    });
    timer = trustedSetTimeout(() => {
      if (status === "exited") status = "timed_out";
      kill();
    }, TOOL_TIMEOUT_MS);
  });
}

function metadataStateFromOutputs(xattrStdout, aclStdout) {
  const xattrText = bufferText(xattrStdout);
  const aclText = bufferText(aclStdout);
  const xattrLines = xattrText.split(/\r?\n/u).filter(
    (line) => line.length > 0,
  );
  const aclLines = aclText.split(/\r?\n/u);
  const firstLine = aclLines[0] ?? "";
  if (firstLine.length < 10) {
    throw new Error("METADATA_PROBE_OUTPUT_INVALID");
  }
  const xattrNames = [];
  const aclEntries = [];
  for (let index = 1; index < aclLines.length; index += 1) {
    const line = aclLines[index];
    if (line.length === 0) continue;
    if (line.startsWith("\t")) {
      const match = /^\t([^\t\r\n]{1,255})\t[ \t]*[0-9]+[ \t]*$/u.exec(line);
      if (!match) throw new Error("METADATA_PROBE_OUTPUT_INVALID");
      xattrNames.push(match[1]);
      continue;
    }
    if (/^\s*[0-9]+:\s/u.test(line)) {
      aclEntries.push(line.trimEnd());
      continue;
    }
    if (line.trim().length > 0) {
      throw new Error("METADATA_PROBE_OUTPUT_INVALID");
    }
  }
  const sortedXattrNames = sortedStrings(xattrNames);
  const sortedXattrOutputNames = sortedStrings(xattrLines);
  for (let index = 1; index < sortedXattrNames.length; index += 1) {
    if (sortedXattrNames[index - 1] === sortedXattrNames[index]) {
      throw new Error("METADATA_PROBE_OUTPUT_INVALID");
    }
  }
  const unauthorizedNames = sortedXattrNames.filter(
    (name) => name !== "com.apple.provenance",
  );
  const systemManagedNames = sortedXattrNames.filter(
    (name) => name === "com.apple.provenance",
  );
  if (systemManagedNames.length > 1) {
    throw new Error("METADATA_PROBE_OUTPUT_INVALID");
  }
  const aclMarkerPresent = firstLine.slice(0, 12).includes("+");
  if (
    unauthorizedNames.length > 0
    || aclEntries.length > 0
    || aclMarkerPresent
  ) {
    throw new Error("METADATA_PROBE_METADATA_NOT_CLEAR");
  }
  if (
    sortedXattrNames.length !== sortedXattrOutputNames.length
    || sortedXattrNames.some(
      (name, index) => name !== sortedXattrOutputNames[index],
    )
  ) {
    throw new Error("METADATA_PROBE_OUTPUT_INVALID");
  }
  const valuesHash = (schema, values) => values.length === 0
    ? EMPTY_SHA256
    : hashCanonical({ schema, values });
  return {
    xattr: {
      status: "clear",
      observedNameCount: 0,
      observedNamesHash: EMPTY_SHA256,
      systemManagedNameCount: systemManagedNames.length,
      systemManagedNamesHash: valuesHash(
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-system-xattr-names.v2",
        systemManagedNames,
      ),
    },
    acl: {
      status: "clear",
      observedEntryCount: 0,
      observedEntriesHash: EMPTY_SHA256,
    },
  };
}

function emitCanonicalAndExit(value, exitCode) {
  const bytes = trustedBufferFrom(canonical(value) + "\n", "utf8");
  try {
    trustedWriteSync(1, bytes, 0, bytes.byteLength, null);
  } finally {
    zeroBytes(bytes);
    trustedExit(exitCode);
  }
}

function failurePolicy(error) {
  const diagnosticRef = error instanceof Error
    ? error.message
    : "METADATA_PROBE_INTERNAL_FAILURE";
  switch (diagnosticRef) {
    case "METADATA_PROBE_INPUT_BOUND_INVALID":
    case "METADATA_PROBE_INPUT_INVALID":
      return {
        errorCode: "INPUT_INVALID",
        phaseRef: "METADATA_PROBE_INPUT_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    case "METADATA_PROBE_POLICY_MISMATCH":
    case "METADATA_PROBE_METADATA_NOT_CLEAR":
      return {
        errorCode: "POLICY_MISMATCH",
        phaseRef: "METADATA_PROBE_POLICY_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    case "METADATA_PROBE_FILESYSTEM_DRIFT":
    case "METADATA_PROBE_TARGET_IDENTITY_MISMATCH":
      return {
        errorCode: "AUTHORITY_DRIFT",
        phaseRef: "METADATA_PROBE_FILESYSTEM_FENCE_V2",
        retryDisposition: "retry_after_authority_delta",
        diagnosticRef,
      };
    case "METADATA_PROBE_TIMEOUT":
      return {
        errorCode: "TIMEOUT",
        phaseRef: "METADATA_PROBE_EXECUTION_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    case "METADATA_PROBE_OUTPUT_LIMIT":
    case "METADATA_PROBE_OUTPUT_INVALID":
      return {
        errorCode: "OUTPUT_INVALID",
        phaseRef: "METADATA_PROBE_OBSERVATION_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    case "METADATA_PROBE_SPAWN_FAILED":
    case "METADATA_PROBE_PROCESS_FAILED":
      return {
        errorCode: "EXECUTION_FAILED",
        phaseRef: "METADATA_PROBE_EXECUTION_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    default:
      return {
        errorCode: "INTERNAL_FAILURE",
        phaseRef: "METADATA_PROBE_EXECUTION_V2",
        retryDisposition: "terminal",
        diagnosticRef: "METADATA_PROBE_INTERNAL_FAILURE",
      };
  }
}

function emitFailure(occurrenceId, authorityStateHash, error) {
  const policy = failurePolicy(error);
  const identity = {
    schema: FAILURE_SCHEMA,
    version: VERSION,
    occurrenceId,
    operationAbiRef: OPERATION_ABI_REF,
    errorCode: policy.errorCode,
    phaseRef: policy.phaseRef,
    retryDisposition: policy.retryDisposition,
    authorityStateHash,
    diagnosticHash: hashCanonical({
      schema:
        "setfarm.platform-release-metadata-probe-diagnostic-hash.v2",
      diagnosticRef: policy.diagnosticRef,
    }),
  };
  emitCanonicalAndExit({
    ...identity,
    messageHash: wireMessageHash(FAILURE_SCHEMA, identity),
  }, 1);
}

export async function runPlatformReleaseMetadataProbeV2() {
  let occurrenceId = FALLBACK_OCCURRENCE_ID;
  let authorityStateHash = null;
  let xattrResult;
  let aclResult;
  try {
    const inputBytes = readBoundedInput();
    let input;
    let inputText;
    try {
      inputText = bufferText(inputBytes);
      input = trustedJsonParse(inputText);
    } finally {
      zeroBytes(inputBytes);
    }
    if (
      input === null
      || typeof input !== "object"
      || trustedArrayIsArray(input)
      || !exactKeys(input, [
        "schema",
        "version",
        "occurrenceId",
        "hostIdentityHash",
        "targetRootPhysicalIdentityHash",
        "metadataPolicyHash",
        "hostCompositionReceiptHash",
        "messageHash",
      ])
      || input.schema !== INPUT_SCHEMA
      || input.version !== VERSION
      || typeof input.occurrenceId !== "string"
      || !UUID.test(input.occurrenceId)
      || typeof input.hostIdentityHash !== "string"
      || !SHA256.test(input.hostIdentityHash)
      || typeof input.targetRootPhysicalIdentityHash !== "string"
      || !SHA256.test(input.targetRootPhysicalIdentityHash)
      || typeof input.metadataPolicyHash !== "string"
      || !SHA256.test(input.metadataPolicyHash)
      || typeof input.hostCompositionReceiptHash !== "string"
      || !SHA256.test(input.hostCompositionReceiptHash)
      || typeof input.messageHash !== "string"
      || !SHA256.test(input.messageHash)
      || input.messageHash !== wireMessageHash(INPUT_SCHEMA, input)
      || inputText !== canonical(input)
    ) {
      throw new Error("METADATA_PROBE_INPUT_INVALID");
    }
    occurrenceId = input.occurrenceId;
    authorityStateHash = input.hostCompositionReceiptHash;
    if (
      input.metadataPolicyHash !== METADATA_POLICY_HASH
      || METADATA_POLICY.productionAdmission !== "forbidden"
      || METADATA_POLICY.mutationAuthority !== false
    ) {
      throw new Error("METADATA_PROBE_POLICY_MISMATCH");
    }
    const targetRoot = trustedPathResolve(trustedCwd());
    const targetBefore = captureTarget(
      targetRoot,
      input.hostIdentityHash,
    );
    const targetStableIdentityHash = hashCanonical({
      schema:
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-target-stable-identity.v2",
      stableIdentity: targetBefore.stableIdentity,
    });
    if (
      targetStableIdentityHash
        !== input.targetRootPhysicalIdentityHash
    ) {
      throw new Error("METADATA_PROBE_TARGET_IDENTITY_MISMATCH");
    }
    const xattrToolBefore = captureTool(
      trustedXattrObserverPath,
      input.hostIdentityHash,
      "XATTR_OBSERVER_V2",
    );
    const aclToolBefore = captureTool(
      trustedAclObserverPath,
      input.hostIdentityHash,
      "ACL_OBSERVER_V2",
    );
    if (
      xattrToolBefore.stableIdentity.device
        === aclToolBefore.stableIdentity.device
      && xattrToolBefore.stableIdentity.inode
        === aclToolBefore.stableIdentity.inode
    ) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    xattrResult = await runObserver(
      trustedXattrObserverPath,
      ["."],
      targetRoot,
      "XATTR_OBSERVER_V2",
    );
    aclResult = await runObserver(
      trustedAclObserverPath,
      ["-lde@", "."],
      targetRoot,
      "ACL_OBSERVER_V2",
    );
    const metadataState = metadataStateFromOutputs(
      xattrResult.stdout,
      aclResult.stdout,
    );
    const commandObservations = [
      {
        toolRef: xattrResult.toolRef,
        argv: xattrResult.argv,
        stdoutHash: sha256Bytes(xattrResult.stdout),
        stderrHash: sha256Bytes(xattrResult.stderr),
      },
      {
        toolRef: aclResult.toolRef,
        argv: aclResult.argv,
        stdoutHash: sha256Bytes(aclResult.stdout),
        stderrHash: sha256Bytes(aclResult.stderr),
      },
    ];
    zeroBytes(xattrResult.stdout);
    zeroBytes(xattrResult.stderr);
    zeroBytes(aclResult.stdout);
    zeroBytes(aclResult.stderr);
    xattrResult = undefined;
    aclResult = undefined;
    const targetAfter = captureTarget(
      targetRoot,
      input.hostIdentityHash,
    );
    const xattrToolAfter = captureTool(
      trustedXattrObserverPath,
      input.hostIdentityHash,
      "XATTR_OBSERVER_V2",
    );
    const aclToolAfter = captureTool(
      trustedAclObserverPath,
      input.hostIdentityHash,
      "ACL_OBSERVER_V2",
    );
    const beforeFence = {
      target: targetBefore,
      tools: [xattrToolBefore, aclToolBefore],
    };
    const afterFence = {
      target: targetAfter,
      tools: [xattrToolAfter, aclToolAfter],
    };
    if (canonical(beforeFence) !== canonical(afterFence)) {
      throw new Error("METADATA_PROBE_FILESYSTEM_DRIFT");
    }
    const observationOutcome = "metadata_policy_satisfied";
    const stableMetadataProjectionHash = hashCanonical({
      schema:
        "setfarm.platform-release-composition-metadata-test-stable-projection-hash.v2",
      projection: {
        metadataPolicyHash: input.metadataPolicyHash,
        hostCompositionReceiptHash:
          input.hostCompositionReceiptHash,
        targetEntryNamesHash:
          targetBefore.directEntryNamesHash,
        observedEntryCount: targetBefore.directEntryNames.length,
        observationOutcome,
      },
    });
    const metadataCatalogHash = hashCanonical({
      schema:
        "setfarm.platform-release-bootstrap-darwin-metadata-probe-catalog.v2",
      metadataPolicyHash: input.metadataPolicyHash,
      targetStableIdentity: targetBefore.stableIdentity,
      targetEntryNamesHash: targetBefore.directEntryNamesHash,
      tools: beforeFence.tools.map((tool) => ({
        toolRef: tool.toolRef,
        stableIdentity: tool.stableIdentity,
        mutableFingerprint: tool.mutableFingerprint,
      })),
      metadataState,
    });
    const metadataObservationHash = hashCanonical({
      schema:
        "setfarm.platform-release-bootstrap-installed-metadata-operation-observation.v2",
      before: beforeFence,
      after: afterFence,
      commandObservations,
      observationOutcome,
      metadataCatalogHash,
    });
    const identity = {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      occurrenceId: input.occurrenceId,
      hostIdentityHash: input.hostIdentityHash,
      targetRootPhysicalIdentityHash:
        input.targetRootPhysicalIdentityHash,
      metadataPolicyHash: input.metadataPolicyHash,
      observationOutcome,
      observedEntryCount: targetBefore.directEntryNames.length,
      targetEntryNamesHash:
        targetBefore.directEntryNamesHash,
      stableMetadataProjectionHash,
      metadataCatalogHash,
      metadataObservationHash,
      hostCompositionReceiptHash:
        input.hostCompositionReceiptHash,
    };
    emitCanonicalAndExit({
      ...identity,
      messageHash: wireMessageHash(OUTPUT_SCHEMA, identity),
    }, 0);
  } catch (error) {
    if (xattrResult !== undefined) {
      zeroBytes(xattrResult.stdout);
      zeroBytes(xattrResult.stderr);
    }
    if (aclResult !== undefined) {
      zeroBytes(aclResult.stdout);
      zeroBytes(aclResult.stderr);
    }
    emitFailure(occurrenceId, authorityStateHash, error);
  }
}
`,
  ].join("\n");

export const PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_HASH_V2 =
  createHash("sha256")
    .update(
      PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_MODULE_SOURCE_V2,
      "utf8",
    )
    .digest("hex");
