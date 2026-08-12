import { createHash } from "node:crypto";

import {
  hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2,
  hashPlatformReleaseBootstrapModuleExportProbeExportSetV2,
} from "./schemas/platform-release-bootstrap-module-export-probe-v2.js";
import {
  getPlatformReleaseRequiredModuleRequirementV2,
} from "./schemas/platform-release-required-module-closure-v2.js";
import {
  getPlatformReleaseRequiredModuleOperationRefV2,
} from "./platform-release-required-module-operation-ref-v2.js";

const operationDefinitionsV2 =
  getPlatformReleaseRequiredModuleRequirementV2()
    .entries.map((definition) => ({
      moduleRef:
        getPlatformReleaseRequiredModuleOperationRefV2(
          definition.role,
        ),
      moduleLocator: definition.moduleLocator,
      requiredExports: definition.requiredExports,
      requiredExportSetHash:
        hashPlatformReleaseBootstrapModuleExportProbeExportSetV2(
          definition.requiredExports,
        ),
      requiredExportKindSetHash:
        hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2(
          definition.requiredExports,
        ),
    }));

export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_MODULE_SOURCE_V2 =
  [
    'import { spawn } from "node:child_process";',
    'import { createHash, randomBytes } from "node:crypto";',
    'import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, writeSync } from "node:fs";',
    'import path from "node:path";',
    `const definitions = Object.freeze(${JSON.stringify(operationDefinitionsV2)});`,
    String.raw`
const INPUT_SCHEMA = "setfarm.platform-release-module-export-probe-input.v2";
const OUTPUT_SCHEMA = "setfarm.platform-release-module-export-probe-receipt.v2";
const FAILURE_SCHEMA = "setfarm.platform-release-bootstrap-operation-failure.v2";
const INNER_OBSERVATION_SCHEMA = "setfarm.platform-release-module-export-inner-observation.v2";
const OPERATION_ABI_REF = "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2";
const VERSION = "2.0.0";
const MAX_INPUT_BYTES = 256 * 1024;
const MAX_MODULE_BYTES = 16 * 1024 * 1024;
const MAX_INNER_OUTPUT_BYTES = 64 * 1024;
const INNER_TIMEOUT_MS = 8_000;
const FALLBACK_OCCURRENCE_ID = "00000000-0000-4000-8000-000000000000";
const SHA256 = /^[a-f0-9]{64}$/;
const UUID = /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/;
const STABLE_REF = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const trustedArrayIsArray = Array.isArray;
const trustedBufferAlloc = Buffer.alloc;
const trustedBufferFrom = Buffer.from;
const trustedBigInt = BigInt;
const trustedCloseSync = closeSync;
const trustedCreateHash = createHash;
const trustedFstatSync = fstatSync;
const trustedJsonParse = JSON.parse;
const trustedJsonStringify = JSON.stringify;
const trustedLstatSync = lstatSync;
const trustedNumberIsFinite = Number.isFinite;
const trustedNumber = Number;
const trustedObjectIs = Object.is;
const trustedObjectKeys = Object.keys;
const trustedOpenSync = openSync;
const trustedReadSync = readSync;
const trustedRandomBytes = randomBytes;
const trustedSpawn = spawn;
const trustedWriteSync = writeSync;
const trustedReadOnlyNoFollowFlags =
  constants.O_RDONLY | constants.O_CLOEXEC | constants.O_NOFOLLOW;
const trustedRegularFileModeMask = trustedBigInt(constants.S_IFMT);
const trustedRegularFileMode = trustedBigInt(constants.S_IFREG);
const trustedReflectApply = Reflect.apply;
const trustedHashPrototype = Object.getPrototypeOf(
  trustedCreateHash("sha256"),
);
const trustedHashUpdate = trustedHashPrototype.update;
const trustedHashDigest = trustedHashPrototype.digest;
const trustedExit = process.exit.bind(process);
const trustedNodeExecutablePath = process.execPath;
const trustedBootstrapExecutablePath = process.argv[1];

function zeroBytes(value) {
  for (let index = 0; index < value.byteLength; index += 1) {
    value[index] = 0;
  }
}

function sortedKeys(value) {
  const keys = trustedObjectKeys(value);
  for (let index = 1; index < keys.length; index += 1) {
    const current = keys[index];
    let cursor = index - 1;
    while (cursor >= 0 && keys[cursor] > current) {
      keys[cursor + 1] = keys[cursor];
      cursor -= 1;
    }
    keys[cursor + 1] = current;
  }
  return keys;
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return trustedJsonStringify(value);
  if (typeof value === "number") {
    if (!trustedNumberIsFinite(value)) throw new Error("WIRE_NON_FINITE_NUMBER");
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
    const keys = sortedKeys(value);
    let output = "{";
    for (let index = 0; index < keys.length; index += 1) {
      if (index > 0) output += ",";
      const key = keys[index];
      output += trustedJsonStringify(key) + ":" + canonical(value[key]);
    }
    return output + "}";
  }
  throw new Error("WIRE_UNSUPPORTED_VALUE");
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
  const wanted = sortedKeys(Object.fromEntries(
    expected.map((key) => [key, true]),
  ));
  if (actual.length !== wanted.length) return false;
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== wanted[index]) return false;
  }
  return true;
}

function readBoundedInput() {
  const bytes = trustedBufferAlloc(MAX_INPUT_BYTES + 1);
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
      throw new Error("MODULE_EXPORT_INPUT_BOUND_INVALID");
    }
    return bytes.subarray(0, offset);
  } catch (error) {
    zeroBytes(bytes);
    throw error;
  }
}

function sameFileIdentity(left, right) {
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

function readBoundedModule(modulePath) {
  let descriptor = -1;
  let bytes;
  const eofProbe = trustedBufferAlloc(1);
  try {
    const pathBefore = trustedLstatSync(modulePath, { bigint: true });
    descriptor = trustedOpenSync(
      modulePath,
      trustedReadOnlyNoFollowFlags,
    );
    const before = trustedFstatSync(descriptor, { bigint: true });
    if (
      (before.mode & trustedRegularFileModeMask)
        !== trustedRegularFileMode
      || before.nlink !== 1n
      || before.size < 1n
      || before.size > trustedBigInt(MAX_MODULE_BYTES)
      || !sameFileIdentity(pathBefore, before)
    ) {
      throw new Error("MODULE_EXPORT_CONTENT_MISMATCH");
    }
    bytes = trustedBufferAlloc(trustedNumber(before.size));
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
    const after = trustedFstatSync(descriptor, { bigint: true });
    const pathAfter = trustedLstatSync(modulePath, { bigint: true });
    if (
      offset !== bytes.byteLength
      || overflow !== 0
      || !sameFileIdentity(before, after)
      || !sameFileIdentity(after, pathAfter)
    ) {
      throw new Error("MODULE_EXPORT_CONTENT_MISMATCH");
    }
    return {
      bytes,
      contentHash: sha256Bytes(bytes),
      identity: after,
    };
  } catch (error) {
    if (bytes !== undefined) zeroBytes(bytes);
    throw error;
  } finally {
    zeroBytes(eofProbe);
    if (descriptor >= 0) trustedCloseSync(descriptor);
  }
}

function runIsolatedModuleObservation(definition, payloadRoot) {
  return new Promise((resolve, reject) => {
    if (
      typeof trustedNodeExecutablePath !== "string"
      || !path.isAbsolute(trustedNodeExecutablePath)
      || typeof trustedBootstrapExecutablePath !== "string"
      || !path.isAbsolute(trustedBootstrapExecutablePath)
    ) {
      reject(new Error("MODULE_EXPORT_OBSERVER_PROCESS_FAILED"));
      return;
    }
    const stdoutChunks = [];
    const stderrChunks = [];
    const challenge = trustedRandomBytes(32);
    const challengeHash = sha256Bytes(challenge);
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let invalid = false;
    let timer;
    let child;
    const zeroChunks = (chunks) => {
      for (let index = 0; index < chunks.length; index += 1) {
        zeroBytes(chunks[index]);
      }
      chunks.length = 0;
    };
    const zeroChallenge = () => zeroBytes(challenge);
    const kill = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The close event owns settlement after a concurrent exit.
      }
    };
    const finish = (exitCode, signal) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      zeroChallenge();
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      zeroChunks(stdoutChunks);
      zeroChunks(stderrChunks);
      try {
        if (
          invalid
          || exitCode !== 0
          || signal !== null
          || stderr.byteLength !== 0
          || stdout.byteLength < 1
        ) {
          throw new Error("MODULE_EXPORT_OBSERVER_PROCESS_FAILED");
        }
        const text = stdout.toString("utf8");
        const observation = trustedJsonParse(text);
        if (
          observation === null
          || typeof observation !== "object"
          || trustedArrayIsArray(observation)
          || !exactKeys(observation, [
            "schema", "moduleRef", "challengeHash", "observed",
          ])
          || observation.schema !== INNER_OBSERVATION_SCHEMA
          || observation.moduleRef !== definition.moduleRef
          || observation.challengeHash !== challengeHash
          || !trustedArrayIsArray(observation.observed)
          || observation.observed.length
            !== definition.requiredExports.length
          || text !== canonical(observation) + "\n"
        ) {
          throw new Error("MODULE_EXPORT_OBSERVER_PROCESS_FAILED");
        }
        const observed = [];
        for (
          let index = 0;
          index < observation.observed.length;
          index += 1
        ) {
          const entry = observation.observed[index];
          if (
            entry === null
            || typeof entry !== "object"
            || trustedArrayIsArray(entry)
            || !exactKeys(entry, ["name", "kind"])
            || entry.name
              !== definition.requiredExports[index].name
            || typeof entry.kind !== "string"
            || ![
              "function", "string", "number", "boolean",
              "object", "undefined", "symbol", "bigint",
            ].includes(entry.kind)
          ) {
            throw new Error("MODULE_EXPORT_OBSERVER_PROCESS_FAILED");
          }
          observed[index] = {
            name: entry.name,
            kind: entry.kind,
          };
        }
        resolve(observed);
      } catch {
        reject(new Error("MODULE_EXPORT_OBSERVER_PROCESS_FAILED"));
      } finally {
        zeroBytes(stdout);
        zeroBytes(stderr);
      }
    };
    try {
      child = trustedSpawn(
        trustedNodeExecutablePath,
        [
          trustedBootstrapExecutablePath,
          "observe-module-export-internal-v2",
          definition.moduleRef,
        ],
        {
          cwd: payloadRoot,
          env: {},
          shell: false,
          stdio: ["ignore", "pipe", "pipe", "pipe"],
        },
      );
    } catch {
      zeroChallenge();
      reject(new Error("MODULE_EXPORT_OBSERVER_PROCESS_FAILED"));
      return;
    }
    timer = setTimeout(() => {
      invalid = true;
      kill();
    }, INNER_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > MAX_INNER_OUTPUT_BYTES) {
        invalid = true;
        kill();
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > MAX_INNER_OUTPUT_BYTES) {
        invalid = true;
        kill();
        return;
      }
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", () => {
      invalid = true;
      kill();
    });
    child.once("close", finish);
    const challengeDescriptor = child.stdio[3];
    if (
      !challengeDescriptor
      || typeof challengeDescriptor === "string"
      || typeof challengeDescriptor.end !== "function"
      || typeof challengeDescriptor.once !== "function"
    ) {
      invalid = true;
      zeroChallenge();
      kill();
      return;
    }
    challengeDescriptor.once("error", () => {
      invalid = true;
      zeroChallenge();
      kill();
    });
    challengeDescriptor.end(challenge, zeroChallenge);
  });
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
    : "MODULE_EXPORT_INTERNAL_FAILURE";
  switch (diagnosticRef) {
    case "MODULE_EXPORT_INPUT_BOUND_INVALID":
    case "MODULE_EXPORT_INPUT_INVALID":
      return {
        errorCode: "INPUT_INVALID",
        phaseRef: "MODULE_EXPORT_INPUT_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    case "MODULE_EXPORT_REQUIREMENT_INVALID":
    case "MODULE_EXPORT_LOCATOR_INVALID":
      return {
        errorCode: "POLICY_MISMATCH",
        phaseRef: "MODULE_EXPORT_POLICY_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    case "MODULE_EXPORT_CONTENT_MISMATCH":
      return {
        errorCode: "AUTHORITY_DRIFT",
        phaseRef: "MODULE_EXPORT_CONTENT_FENCE_V2",
        retryDisposition: "retry_after_authority_delta",
        diagnosticRef,
      };
    case "MODULE_EXPORT_OBSERVATION_MISMATCH":
    case "MODULE_EXPORT_OBSERVER_PROCESS_FAILED":
      return {
        errorCode: "OUTPUT_INVALID",
        phaseRef: "MODULE_EXPORT_OBSERVATION_V2",
        retryDisposition: "terminal",
        diagnosticRef,
      };
    default:
      return {
        errorCode: "INTERNAL_FAILURE",
        phaseRef: "MODULE_EXPORT_EXECUTION_V2",
        retryDisposition: "terminal",
        diagnosticRef: "MODULE_EXPORT_INTERNAL_FAILURE",
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
        "setfarm.platform-release-module-export-probe-diagnostic-hash.v2",
      diagnosticRef: policy.diagnosticRef,
    }),
  };
  emitCanonicalAndExit({
    ...identity,
    messageHash: wireMessageHash(FAILURE_SCHEMA, identity),
  }, 1);
}

export function runPlatformReleaseHostOperationV2() {
  throw new Error("HOST_OPERATION_NOT_IMPLEMENTED");
}

export async function runPlatformReleaseModuleExportProbeV2() {
  let occurrenceId = FALLBACK_OCCURRENCE_ID;
  let authorityStateHash = null;
  try {
    const inputBytes = readBoundedInput();
    let input;
    try {
      input = trustedJsonParse(inputBytes.toString("utf8"));
    } finally {
      zeroBytes(inputBytes);
    }
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || !exactKeys(input, [
      "schema", "version", "occurrenceId", "moduleRef",
      "moduleContentHash", "requiredExportSetHash",
      "hostCompositionReceiptHash", "messageHash",
    ])
    || input.schema !== INPUT_SCHEMA
    || input.version !== VERSION
    || typeof input.occurrenceId !== "string"
    || !UUID.test(input.occurrenceId)
    || typeof input.moduleRef !== "string"
    || !STABLE_REF.test(input.moduleRef)
    || typeof input.moduleContentHash !== "string"
    || !SHA256.test(input.moduleContentHash)
    || typeof input.requiredExportSetHash !== "string"
    || !SHA256.test(input.requiredExportSetHash)
    || typeof input.hostCompositionReceiptHash !== "string"
    || !SHA256.test(input.hostCompositionReceiptHash)
    || typeof input.messageHash !== "string"
    || input.messageHash !== wireMessageHash(INPUT_SCHEMA, input)
  ) {
    throw new Error("MODULE_EXPORT_INPUT_INVALID");
  }
  occurrenceId = input.occurrenceId;
  authorityStateHash = input.hostCompositionReceiptHash;
  const definition = definitions.find(
    (candidate) => candidate.moduleRef === input.moduleRef,
  );
  if (
    !definition
    || input.requiredExportSetHash !== definition.requiredExportSetHash
  ) {
    throw new Error("MODULE_EXPORT_REQUIREMENT_INVALID");
  }
  const payloadRoot = path.resolve(process.cwd());
  const modulePath = path.resolve(
    payloadRoot,
    definition.moduleLocator,
  );
  if (
    path.relative(payloadRoot, modulePath) !== definition.moduleLocator
    || !modulePath.startsWith(payloadRoot + path.sep)
  ) {
    throw new Error("MODULE_EXPORT_LOCATOR_INVALID");
  }
  const before = readBoundedModule(modulePath);
  if (before.contentHash !== input.moduleContentHash) {
    zeroBytes(before.bytes);
    throw new Error("MODULE_EXPORT_CONTENT_MISMATCH");
  }
  zeroBytes(before.bytes);
  const observed = await runIsolatedModuleObservation(
    definition,
    payloadRoot,
  );
  let kindsMatch = true;
  for (
    let index = 0;
    index < definition.requiredExports.length;
    index += 1
  ) {
    const required = definition.requiredExports[index];
    const entry = observed[index];
    if (entry.kind !== required.kind) kindsMatch = false;
  }
  const after = readBoundedModule(modulePath);
  const stableBytes = sameFileIdentity(before.identity, after.identity)
    && after.contentHash === input.moduleContentHash;
  zeroBytes(after.bytes);
  if (!kindsMatch || !stableBytes) {
    throw new Error("MODULE_EXPORT_OBSERVATION_MISMATCH");
  }
  const observation = {
    occurrenceId: input.occurrenceId,
    moduleRef: input.moduleRef,
    moduleContentHash: input.moduleContentHash,
    loadOutcome: "loaded",
    observedExportCount: observed.length,
    observedExportSetHash: definition.requiredExportSetHash,
    observedExportKindSetHash: definition.requiredExportKindSetHash,
    hostCompositionReceiptHash: input.hostCompositionReceiptHash,
  };
  const outputIdentity = {
    schema: OUTPUT_SCHEMA,
    version: VERSION,
    ...observation,
    moduleLoadObservationHash: hashCanonical({
      schema:
        "setfarm.platform-release-bootstrap-module-export-load-observation-hash.v2",
      observation,
    }),
  };
  const output = {
    ...outputIdentity,
    messageHash: wireMessageHash(OUTPUT_SCHEMA, outputIdentity),
  };
  emitCanonicalAndExit(output, 0);
  } catch (error) {
    emitFailure(occurrenceId, authorityStateHash, error);
  }
}
`,
  ].join("\n");

export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_EXECUTABLE_SOURCE_V2 =
  [
    "#!/usr/bin/env node",
    `const definitions = Object.freeze(${JSON.stringify(operationDefinitionsV2)});`,
    String.raw`const INNER_OBSERVATION_SCHEMA =
  "setfarm.platform-release-module-export-inner-observation.v2";
const { createHash } = require("node:crypto");
const { closeSync, readSync, writeSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const trustedDispatchArrayIsArray = Array.isArray;
const trustedDispatchBufferAlloc = Buffer.alloc;
const trustedDispatchBufferFrom = Buffer.from;
const trustedDispatchJsonStringify = JSON.stringify;
const trustedDispatchNumberIsFinite = Number.isFinite;
const trustedDispatchObjectIs = Object.is;
const trustedDispatchObjectKeys = Object.keys;
const trustedDispatchExit = process.exit.bind(process);
const trustedDispatchReadSync = readSync;
const trustedDispatchWriteSync = writeSync;

function zeroDispatchBytes(value) {
  for (let index = 0; index < value.byteLength; index += 1) {
    value[index] = 0;
  }
}

function sortedDispatchKeys(value) {
  const keys = trustedDispatchObjectKeys(value);
  for (let index = 1; index < keys.length; index += 1) {
    const current = keys[index];
    let cursor = index - 1;
    while (cursor >= 0 && keys[cursor] > current) {
      keys[cursor + 1] = keys[cursor];
      cursor -= 1;
    }
    keys[cursor + 1] = current;
  }
  return keys;
}

function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    return trustedDispatchJsonStringify(value);
  }
  if (typeof value === "number") {
    if (!trustedDispatchNumberIsFinite(value)) {
      throw new Error("WIRE_NON_FINITE_NUMBER");
    }
    return trustedDispatchObjectIs(value, -0)
      ? "0"
      : trustedDispatchJsonStringify(value);
  }
  if (trustedDispatchArrayIsArray(value)) {
    let output = "[";
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) output += ",";
      output += canonical(value[index]);
    }
    return output + "]";
  }
  if (typeof value === "object") {
    const keys = sortedDispatchKeys(value);
    let output = "{";
    for (let index = 0; index < keys.length; index += 1) {
      if (index > 0) output += ",";
      const key = keys[index];
      output += trustedDispatchJsonStringify(key)
        + ":" + canonical(value[key]);
    }
    return output + "}";
  }
  throw new Error("WIRE_UNSUPPORTED_VALUE");
}

function hashCanonical(value) {
  return createHash("sha256")
    .update(Buffer.from(canonical(value), "utf8"))
    .digest("hex");
}

let dispatchOperationAbiRef =
  "ABI_PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2";

function emitDispatchFailure() {
  const schema =
    "setfarm.platform-release-bootstrap-operation-failure.v2";
  const identity = {
    schema,
    version: "2.0.0",
    occurrenceId: "00000000-0000-4000-8000-000000000000",
    operationAbiRef: dispatchOperationAbiRef,
    errorCode: "INTERNAL_FAILURE",
    phaseRef: "RELEASE_BOOTSTRAP_DISPATCH_V2",
    retryDisposition: "terminal",
    authorityStateHash: null,
    diagnosticHash: hashCanonical({
      schema:
        "setfarm.platform-release-module-export-probe-diagnostic-hash.v2",
      diagnosticRef: "RELEASE_BOOTSTRAP_DISPATCH_FAILURE",
    }),
  };
  const message = {
    ...identity,
    messageHash: hashCanonical({
      schema:
        "setfarm.platform-release-bootstrap-wire-message-hash.v2",
      schemaRef: schema,
      message: identity,
    }),
  };
  const bytes = trustedDispatchBufferFrom(
    canonical(message) + "\n",
    "utf8",
  );
  try {
    trustedDispatchWriteSync(
      1,
      bytes,
      0,
      bytes.byteLength,
      null,
    );
  } finally {
    zeroDispatchBytes(bytes);
    trustedDispatchExit(1);
  }
}

function emitInnerObservationAndExit(value) {
  const bytes = trustedDispatchBufferFrom(
    canonical(value) + "\n",
    "utf8",
  );
  try {
    trustedDispatchWriteSync(
      1,
      bytes,
      0,
      bytes.byteLength,
      null,
    );
  } finally {
    zeroDispatchBytes(bytes);
    trustedDispatchExit(0);
  }
}

function readInnerChallengeHash() {
  const bytes = trustedDispatchBufferAlloc(33);
  let offset = 0;
  try {
    while (offset < bytes.byteLength) {
      const count = trustedDispatchReadSync(
        3,
        bytes,
        offset,
        bytes.byteLength - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    if (offset !== 32) {
      throw new Error(
        "RELEASE_BOOTSTRAP_INNER_CHALLENGE_INVALID",
      );
    }
    return createHash("sha256")
      .update(bytes.subarray(0, offset))
      .digest("hex");
  } finally {
    zeroDispatchBytes(bytes);
    closeSync(3);
  }
}

async function observeModuleExportsInternal(
  moduleRef,
  challengeHash,
) {
  const definition = definitions.find(
    (candidate) => candidate.moduleRef === moduleRef,
  );
  if (!definition) {
    throw new Error("RELEASE_BOOTSTRAP_INNER_MODULE_REF_INVALID");
  }
  const payloadRoot = path.resolve(process.cwd());
  const modulePath = path.resolve(
    payloadRoot,
    definition.moduleLocator,
  );
  if (
    path.relative(payloadRoot, modulePath)
      !== definition.moduleLocator
    || !modulePath.startsWith(payloadRoot + path.sep)
  ) {
    throw new Error("RELEASE_BOOTSTRAP_INNER_LOCATOR_INVALID");
  }
  const namespace = await import(pathToFileURL(modulePath).href);
  const observed = [];
  for (
    let index = 0;
    index < definition.requiredExports.length;
    index += 1
  ) {
    const required = definition.requiredExports[index];
    observed[index] = {
      name: required.name,
      kind: typeof namespace[required.name],
    };
  }
  emitInnerObservationAndExit({
    schema: INNER_OBSERVATION_SCHEMA,
    moduleRef,
    challengeHash,
    observed,
  });
}

(async () => {
  const directArgv = process.argv.slice(2);
  if (
    directArgv.length === 2
    && directArgv[0]
      === "observe-module-export-internal-v2"
  ) {
    const challengeHash = readInnerChallengeHash();
    await observeModuleExportsInternal(
      directArgv[1],
      challengeHash,
    );
    return;
  }
  if (
    directArgv.length === 2
    && directArgv[0] === "run-network-negative-probe-v2"
    && directArgv[1]
      === "PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2"
  ) {
    dispatchOperationAbiRef =
      "ABI_PLATFORM_RELEASE_NETWORK_NEGATIVE_PROBE_V2";
    const modulePath = path.join(
      __dirname,
      "..",
      "lib",
      "network-wrapper.mjs",
    );
    const implementation = await import(
      pathToFileURL(modulePath).href
    );
    if (
      typeof implementation.runPlatformReleaseNetworkNegativeProbeV2
        !== "function"
    ) {
      throw new Error("RELEASE_BOOTSTRAP_EXPORT_INVALID");
    }
    await implementation.runPlatformReleaseNetworkNegativeProbeV2();
    return;
  }
  if (
    directArgv.length === 2
    && directArgv[0] === "run-metadata-probe-v2"
    && directArgv[1]
      === "PLATFORM_RELEASE_METADATA_PROBE_V2"
  ) {
    dispatchOperationAbiRef =
      "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2";
    const modulePath = path.join(
      __dirname,
      "..",
      "lib",
      "metadata-bootstrap.mjs",
    );
    const implementation = await import(
      pathToFileURL(modulePath).href
    );
    if (
      typeof implementation.runPlatformReleaseMetadataProbeV2
        !== "function"
    ) {
      throw new Error("RELEASE_BOOTSTRAP_EXPORT_INVALID");
    }
    await implementation.runPlatformReleaseMetadataProbeV2();
    return;
  }
  if (
    directArgv.length !== 2
    || directArgv[0] !== "run-module-export-probe-v2"
    || directArgv[1] !== "PLATFORM_RELEASE_MODULE_EXPORT_PROBE_V2"
  ) {
    throw new Error("RELEASE_BOOTSTRAP_ARGV_INVALID");
  }
  const modulePath = path.join(
    __dirname,
    "..",
    "lib",
    "release-bootstrap.mjs",
  );
  const implementation = await import(pathToFileURL(modulePath).href);
  if (
    typeof implementation.runPlatformReleaseModuleExportProbeV2
      !== "function"
  ) {
    throw new Error("RELEASE_BOOTSTRAP_EXPORT_INVALID");
  }
  await implementation.runPlatformReleaseModuleExportProbeV2();
})().catch(() => {
  emitDispatchFailure();
});
`,
  ].join("\n");

export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_MODULE_SOURCE_HASH_V2 =
  createHash("sha256")
    .update(
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_MODULE_SOURCE_V2,
      "utf8",
    )
    .digest("hex");

export const PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_EXECUTABLE_SOURCE_HASH_V2 =
  createHash("sha256")
    .update(
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_OPERATION_EXECUTABLE_SOURCE_V2,
      "utf8",
    )
    .digest("hex");
