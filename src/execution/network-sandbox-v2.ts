import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  type BigIntStats,
} from "node:fs";
import { arch, release, tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
  EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
  NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
  NetworkIsolationAuthorityCandidateV2Schema,
  hashNetworkIsolationAuthorityV2,
  type NetworkIsolationAuthorityCandidateV2,
} from "./schemas/evidence-environment-capsule-v2.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_REF_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
  NETWORK_ISOLATION_NEGATIVE_PROBE_TIMEOUT_MS_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
  NetworkIsolationNegativeProbeReceiptV2Schema,
  NetworkIsolationProbeSetV2Schema,
  hashNetworkIsolationNegativeProbeReceiptV2,
  hashNetworkIsolationProbeSetV2,
  type NetworkIsolationNegativeProbeReceiptHashPayloadV2,
  type NetworkIsolationNegativeProbeReceiptV2,
  type NetworkIsolationProbeSetV2,
} from "./schemas/network-isolation-negative-probe-v2.js";

export const NETWORK_SANDBOX_EXECUTABLE_V2 = "/usr/bin/sandbox-exec" as const;
export const NETWORK_SANDBOX_PROFILE_V2 = [
  "(version 1)",
  "(allow default)",
  "(deny network-inbound)",
  "(allow network-inbound (local ip \"localhost:*\"))",
  "(deny network-outbound)",
  "(allow network-outbound (remote ip \"localhost:*\"))",
  "",
].join("\n");
export const NETWORK_SANDBOX_PROFILE_HASH_V2 = createHash("sha256")
  .update(NETWORK_SANDBOX_PROFILE_V2)
  .digest("hex");

export const NETWORK_ISOLATION_NEGATIVE_PROBE_CHILD_SOURCE_V2 = String.raw`
const crypto = require("node:crypto");
const dns = require("node:dns");
const http = require("node:http");
const net = require("node:net");

const fail = (code) => {
  process.stderr.write(String(code).slice(0, 1000) + "\n");
  process.exit(2);
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  }
  throw new Error("NETWORK_PROBE_OUTPUT_UNSUPPORTED");
};
let config;
try {
  config = JSON.parse(Buffer.from(process.argv[1], "base64url").toString("utf8"));
} catch {
  fail("NETWORK_PROBE_CONFIG_INVALID");
}
for (const name of config.knownOsInjectedVariableNames) delete process.env[name];
const observedNames = Object.keys(process.env).sort();
if (JSON.stringify(observedNames) !== JSON.stringify(config.normalizedVariableNames)) {
  fail("NETWORK_PROBE_ENVIRONMENT_NOT_EXACT:" + observedNames.join(","));
}
const normalizedEnvironment = {
  CI: process.env.CI,
  HOME: "RUN_HOME",
  HOST: process.env.HOST,
  LANG: process.env.LANG,
  LC_ALL: process.env.LC_ALL,
  NO_COLOR: process.env.NO_COLOR,
  PORT: "EPHEMERAL_LOOPBACK_PORT",
  RUNTIME_URL: "EPHEMERAL_LOOPBACK_ORIGIN",
  RUN_CACHE_DIR: "RUN_CACHE_DIR",
  RUN_HOME: "RUN_HOME",
  RUN_TMPDIR: "RUN_TMPDIR",
  TEMP: "RUN_TMPDIR",
  TMP: "RUN_TMPDIR",
  TMPDIR: "RUN_TMPDIR",
  TZ: process.env.TZ,
};
const expectedNormalizedEnvironment = {
  CI: "true",
  HOME: "RUN_HOME",
  HOST: "127.0.0.1",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  NO_COLOR: "1",
  PORT: "EPHEMERAL_LOOPBACK_PORT",
  RUNTIME_URL: "EPHEMERAL_LOOPBACK_ORIGIN",
  RUN_CACHE_DIR: "RUN_CACHE_DIR",
  RUN_HOME: "RUN_HOME",
  RUN_TMPDIR: "RUN_TMPDIR",
  TEMP: "RUN_TMPDIR",
  TMP: "RUN_TMPDIR",
  TMPDIR: "RUN_TMPDIR",
  TZ: "UTC",
};
if (JSON.stringify(normalizedEnvironment) !== JSON.stringify(expectedNormalizedEnvironment)) {
  fail("NETWORK_PROBE_ENVIRONMENT_HASH_MISMATCH");
}

const request = (pathname) => new Promise((resolve, reject) => {
  const operation = http.request({
    host: "127.0.0.1",
    port: config.port,
    path: pathname,
    method: "GET",
    headers: { connection: "close" },
  }, (response) => {
    const chunks = [];
    let length = 0;
    response.on("data", (chunk) => {
      length += chunk.length;
      if (length > 4096) {
        response.destroy(new Error("NETWORK_PROBE_LOOPBACK_RESPONSE_LIMIT"));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve({
      statusCode: response.statusCode,
      headers: response.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    }));
  });
  operation.setTimeout(1000, () => operation.destroy(new Error("NETWORK_PROBE_LOOPBACK_TIMEOUT")));
  operation.once("error", reject);
  operation.end();
});

const dnsObserved = () => new Promise((resolve, reject) => {
  dns.lookup("example.com", (error) => {
    if (config.dnsDisposition === "supplementary_not_counted_as_enforcement_denial_v2") {
      return resolve(error
        ? {
            status: "supplementary_observed",
            outcome: "lookup_error",
            errorCode: ["EACCES", "EAI_AGAIN", "ENOTFOUND", "EPERM"].includes(error.code)
              ? error.code
              : "OTHER",
          }
        : {
            status: "supplementary_observed",
            outcome: "resolved",
            errorCode: null,
          });
    }
    if (!error) return reject(new Error("NETWORK_PROBE_DNS_ALLOWED"));
    if (!["EACCES", "EAI_AGAIN", "ENOTFOUND", "EPERM"].includes(error.code)) {
      return reject(new Error("NETWORK_PROBE_DNS_UNTYPED:" + error.code));
    }
    resolve({ status: "denied", errorCode: error.code });
  });
});

const outboundDenied = () => new Promise((resolve, reject) => {
  const socket = net.connect({ host: "198.51.100.1", port: 9 });
  const timer = setTimeout(() => {
    socket.destroy();
    reject(new Error("NETWORK_PROBE_OUTBOUND_TIMEOUT"));
  }, 1000);
  socket.once("connect", () => {
    clearTimeout(timer);
    socket.destroy();
    reject(new Error("NETWORK_PROBE_OUTBOUND_ALLOWED"));
  });
  socket.once("error", (error) => {
    clearTimeout(timer);
    if (!["EACCES", "EPERM"].includes(error.code)) {
      return reject(new Error("NETWORK_PROBE_OUTBOUND_UNTYPED:" + error.code));
    }
    resolve(error.code);
  });
});

Promise.all([
  request("/echo?nonce=" + encodeURIComponent(config.nonce)),
  request("/redirect"),
  dnsObserved(),
  outboundDenied(),
]).then(([loopback, redirect, dnsObservation, outboundErrorCode]) => {
  if (loopback.statusCode !== 200 || loopback.body !== config.nonce) {
    throw new Error("NETWORK_PROBE_LOOPBACK_MISMATCH");
  }
  if (
    redirect.statusCode !== 302
    || redirect.body !== ""
    || redirect.headers.location !== config.redirectLocation
  ) {
    throw new Error("NETWORK_PROBE_REDIRECT_MISMATCH");
  }
  process.stdout.write(canonical({
    normalizedEnvironmentHash: config.normalizedEnvironmentHash,
    probes: {
      loopback: {
        status: "passed",
        host: "127.0.0.1",
        requestNonceHash: sha256(config.nonce),
        responseNonceHash: sha256(loopback.body),
      },
      dns: {
        ...dnsObservation,
        hostname: "example.com",
      },
      outbound: {
        status: "denied",
        host: "198.51.100.1",
        port: 9,
        errorCode: outboundErrorCode,
      },
      redirect: {
        status: "rejected_without_follow",
        httpStatus: 302,
        locationHash: sha256(config.redirectLocation),
        requestCount: 1,
      },
    },
  }) + "\n");
}).catch((error) => fail(error && error.message ? error.message : "NETWORK_PROBE_FAILED"));
`;

export const NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2 = createHash(
  "sha256",
).update(NETWORK_ISOLATION_NEGATIVE_PROBE_CHILD_SOURCE_V2).digest("hex");

const EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

export type NetworkIsolationSandboxErrorCodeV2 =
  | "NETWORK_ISOLATION_V2_HOST_UNSUPPORTED"
  | "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED"
  | "NETWORK_ISOLATION_V2_ALREADY_RUNNING"
  | "NETWORK_ISOLATION_V2_DESTROYED"
  | "NETWORK_ISOLATION_V2_HOST_DRIFT"
  | "NETWORK_ISOLATION_V2_SPAWN_FAILED"
  | "NETWORK_ISOLATION_V2_TIMEOUT"
  | "NETWORK_ISOLATION_V2_OUTPUT_LIMIT"
  | "NETWORK_ISOLATION_V2_PROBE_FAILED"
  | "NETWORK_ISOLATION_V2_RECEIPT_INVALID"
  | "NETWORK_ISOLATION_V2_CLEANUP_FAILED";

export class NetworkIsolationSandboxErrorV2 extends Error {
  readonly code: NetworkIsolationSandboxErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NetworkIsolationSandboxErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "NetworkIsolationSandboxErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: NetworkIsolationSandboxErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NetworkIsolationSandboxErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        pending.push(child);
      }
    }
    Object.freeze(current);
  }
  return value;
}

async function hashFile(absolutePath: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(absolutePath);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(digest.digest("hex")));
  });
}

function exactRegularFile(absolutePath: string): string {
  if (!path.isAbsolute(absolutePath) || !existsSync(absolutePath)) {
    return fail(
      "NETWORK_ISOLATION_V2_HOST_UNSUPPORTED",
      "Network isolation requires one existing absolute executable or module",
    );
  }
  const literal = path.resolve(absolutePath);
  const literalStat = lstatSync(literal, { bigint: true });
  const real = realpathSync(literal);
  const stat = lstatSync(real, { bigint: true });
  if (
    literalStat.isSymbolicLink()
    || real !== literal
    || !stat.isFile()
    || stat.isSymbolicLink()
    || stat.nlink !== 1n
  ) {
    return fail(
      "NETWORK_ISOLATION_V2_HOST_UNSUPPORTED",
      "Network isolation executable or module is not one stable regular file",
    );
  }
  return real;
}

type ExactPhysicalStableIdentityV2 = Readonly<{
  objectKind: "ordinary_file";
  device: string;
  inode: string;
}>;

type ExactPhysicalMutableFingerprintV2 = Readonly<{
  ownerUid: string;
  ownerGid: string;
  mode: string;
  linkCount: string;
  byteLength: string;
  modifiedTimeNanoseconds: string;
  changedTimeNanoseconds: string;
  contentHash: string;
}>;

type ExactPhysicalFileV2 = Readonly<{
  absolutePath: string;
  stableIdentity: ExactPhysicalStableIdentityV2;
  mutableFingerprint: ExactPhysicalMutableFingerprintV2;
}>;

function exactPhysicalModeV2(stat: BigIntStats): string {
  return Number(stat.mode & 0o7777n).toString(8).padStart(4, "0");
}

function exactPhysicalStatMatchesV2(left: BigIntStats, right: BigIntStats): boolean {
  return left.isFile()
    && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.rdev === right.rdev
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

async function captureExactPhysicalFileV2(
  absolutePath: string,
): Promise<ExactPhysicalFileV2> {
  const canonical = exactRegularFile(absolutePath);
  const before = lstatSync(canonical, { bigint: true });
  const contentHash = await hashFile(canonical);
  const after = lstatSync(canonical, { bigint: true });
  if (!exactPhysicalStatMatchesV2(before, after)) {
    return fail(
      "NETWORK_ISOLATION_V2_HOST_DRIFT",
      "Network isolation executable or module changed while hashing",
    );
  }
  return Object.freeze({
    absolutePath: canonical,
    stableIdentity: Object.freeze({
      objectKind: "ordinary_file" as const,
      device: after.dev.toString(10),
      inode: after.ino.toString(10),
    }),
    mutableFingerprint: Object.freeze({
      ownerUid: after.uid.toString(10),
      ownerGid: after.gid.toString(10),
      mode: exactPhysicalModeV2(after),
      linkCount: after.nlink.toString(10),
      byteLength: after.size.toString(10),
      modifiedTimeNanoseconds: after.mtimeNs.toString(10),
      changedTimeNanoseconds: after.ctimeNs.toString(10),
      contentHash,
    }),
  });
}

/**
 * @internal Code-owned bridge used by candidate launchers. It exposes only the
 * fixed macOS sandbox executable and fixed profile after a fresh physical-file
 * capture; callers cannot select either value.
 */
export async function acquireNetworkSandboxLaunchContextInternalV2(): Promise<
  Readonly<{
    sandboxExecutablePath: typeof NETWORK_SANDBOX_EXECUTABLE_V2;
    sandboxExecutableContentHash: string;
    sandboxExecutablePhysicalIdentityHash: string;
    sandboxProfile: typeof NETWORK_SANDBOX_PROFILE_V2;
    sandboxProfileHash: typeof NETWORK_SANDBOX_PROFILE_HASH_V2;
  }>
> {
  if (process.platform !== "darwin") {
    return fail(
      "NETWORK_ISOLATION_V2_HOST_UNSUPPORTED",
      "The first candidate launcher requires macOS sandbox-exec",
    );
  }
  const captured = await captureExactPhysicalFileV2(
    NETWORK_SANDBOX_EXECUTABLE_V2,
  );
  if (
    captured.mutableFingerprint.ownerUid !== "0"
    || captured.mutableFingerprint.ownerGid !== "0"
    || captured.mutableFingerprint.mode !== "0755"
  ) {
    return fail(
      "NETWORK_ISOLATION_V2_HOST_UNSUPPORTED",
      "The code-owned macOS sandbox executable must remain root-owned mode 0755",
    );
  }
  return Object.freeze({
    sandboxExecutablePath: NETWORK_SANDBOX_EXECUTABLE_V2,
    sandboxExecutableContentHash: captured.mutableFingerprint.contentHash,
    sandboxExecutablePhysicalIdentityHash: hashCanonicalJson({
      schema: "setfarm.network-sandbox-physical-file.v3",
      stableIdentity: captured.stableIdentity,
      mutableFingerprint: captured.mutableFingerprint,
    }),
    sandboxProfile: NETWORK_SANDBOX_PROFILE_V2,
    sandboxProfileHash: NETWORK_SANDBOX_PROFILE_HASH_V2,
  });
}

type NetworkIsolationProbeContextStateV2 = Readonly<{
  admissionScope: "test_fixture";
  wrapperModule: ExactPhysicalFileV2;
  sandboxExecutable: ExactPhysicalFileV2;
  nodeExecutable: ExactPhysicalFileV2;
  platformTreeHash: string;
  runtimePayloadHash: string;
  hostRuntimeIdentityHash: string;
  lifecycle: { status: "ready" | "running" | "destroyed" };
}>;

const contextConstructorCapabilityV2 = Object.freeze({});
const contextStateV2 = new WeakMap<object, NetworkIsolationProbeContextStateV2>();

export class NetworkIsolationProbeContextV2 {
  readonly admissionScope: "test_fixture";
  readonly wrapperModuleHash: string;
  readonly sandboxExecutableHash: string;
  readonly nodeExecutableHash: string;
  readonly platformTreeHash: string;
  readonly runtimePayloadHash: string;
  readonly hostRuntimeIdentityHash: string;

  constructor(capability: object, state: NetworkIsolationProbeContextStateV2) {
    if (capability !== contextConstructorCapabilityV2) {
      throw new NetworkIsolationSandboxErrorV2(
        "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED",
        "Network isolation context constructor capability is unavailable",
      );
    }
    this.admissionScope = state.admissionScope;
    this.wrapperModuleHash = state.wrapperModule.mutableFingerprint.contentHash;
    this.sandboxExecutableHash = state.sandboxExecutable.mutableFingerprint.contentHash;
    this.nodeExecutableHash = state.nodeExecutable.mutableFingerprint.contentHash;
    this.platformTreeHash = state.platformTreeHash;
    this.runtimePayloadHash = state.runtimePayloadHash;
    this.hostRuntimeIdentityHash = state.hostRuntimeIdentityHash;
    contextStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticContextV2(
  context: NetworkIsolationProbeContextV2,
): NetworkIsolationProbeContextStateV2 {
  if (
    typeof context !== "object"
    || context === null
    || isProxy(context)
    || Object.getPrototypeOf(context) !== NetworkIsolationProbeContextV2.prototype
  ) {
    return fail(
      "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED",
      "Network isolation requires one authentic private context",
    );
  }
  const state = contextStateV2.get(context);
  if (!state) {
    return fail(
      "NETWORK_ISOLATION_V2_AUTHORITY_UNAUTHENTICATED",
      "Network isolation requires one authentic private context",
    );
  }
  return state;
}

export async function createNetworkIsolationProbeContextV2ForTest(): Promise<
  NetworkIsolationProbeContextV2
> {
  if (process.platform !== "darwin") {
    return fail(
      "NETWORK_ISOLATION_V2_HOST_UNSUPPORTED",
      "The first network isolation implementation requires macOS sandbox-exec",
    );
  }
  const [wrapperModule, sandboxExecutable, nodeExecutable] = await Promise.all([
    captureExactPhysicalFileV2(fileURLToPath(import.meta.url)),
    captureExactPhysicalFileV2(NETWORK_SANDBOX_EXECUTABLE_V2),
    captureExactPhysicalFileV2(process.execPath),
  ]);
  const hostRuntimeIdentityHash = hashCanonicalJson({
    schema: "setfarm.network-isolation-test-host-runtime-identity.v2",
    platform: process.platform,
    architecture: arch(),
    kernelRelease: release(),
    nodeVersion: process.version,
    nodeExecutableHash: nodeExecutable.mutableFingerprint.contentHash,
    sandboxExecutableHash: sandboxExecutable.mutableFingerprint.contentHash,
  });
  const platformTreeHash = hashCanonicalJson({
    schema: "setfarm.network-isolation-test-platform-tree.v2",
    wrapperModuleLocator: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
    wrapperModuleHash: wrapperModule.mutableFingerprint.contentHash,
    probeProgramHash: NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
  });
  const runtimePayloadHash = hashCanonicalJson({
    schema: "setfarm.network-isolation-test-runtime-payload.v2",
    platformTreeHash,
    hostRuntimeIdentityHash,
    receiptSchemaHash:
      NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  });
  const lifecycle: NetworkIsolationProbeContextStateV2["lifecycle"] = {
    status: "ready",
  };
  const state: NetworkIsolationProbeContextStateV2 = Object.freeze({
    admissionScope: "test_fixture",
    wrapperModule,
    sandboxExecutable,
    nodeExecutable,
    platformTreeHash,
    runtimePayloadHash,
    hostRuntimeIdentityHash,
    lifecycle,
  });
  return new NetworkIsolationProbeContextV2(
    contextConstructorCapabilityV2,
    state,
  );
}

type BoundedChildResultV2 = Readonly<{
  pid: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

function spawnProbeV2(input: Readonly<{
  state: NetworkIsolationProbeContextStateV2;
  encodedConfig: string;
  cwd: string;
  environment: NodeJS.ProcessEnv;
}>): Promise<BoundedChildResultV2> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.state.sandboxExecutable.absolutePath, [
      "-p",
      NETWORK_SANDBOX_PROFILE_V2,
      input.state.nodeExecutable.absolutePath,
      "-e",
      NETWORK_ISOLATION_NEGATIVE_PROBE_CHILD_SOURCE_V2,
      input.encodedConfig,
    ], {
      cwd: input.cwd,
      env: input.environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminalFailure: NetworkIsolationSandboxErrorV2 | undefined;
    const terminateWithFailure = (
      code: NetworkIsolationSandboxErrorCodeV2,
      message: string,
      cause?: unknown,
    ): void => {
      if (settled || terminalFailure) return;
      terminalFailure = new NetworkIsolationSandboxErrorV2(
        code,
        message,
        cause === undefined ? undefined : { cause },
      );
      clearTimeout(timer);
      try { child.kill("SIGKILL"); } catch { /* best effort */ }
    };
    const timer = setTimeout(() => terminateWithFailure(
      "NETWORK_ISOLATION_V2_TIMEOUT",
      "Network isolation probe exceeded its code-owned timeout",
    ), NETWORK_ISOLATION_NEGATIVE_PROBE_TIMEOUT_MS_V2);
    child.once("error", (error) => terminateWithFailure(
      "NETWORK_ISOLATION_V2_SPAWN_FAILED",
      "Network isolation probe process could not start",
      error,
    ));
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2) {
        terminateWithFailure(
          "NETWORK_ISOLATION_V2_OUTPUT_LIMIT",
          "Network isolation probe stdout exceeded its code-owned limit",
        );
        return;
      }
      stdout.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2) {
        terminateWithFailure(
          "NETWORK_ISOLATION_V2_OUTPUT_LIMIT",
          "Network isolation probe stderr exceeded its code-owned limit",
        );
        return;
      }
      stderr.push(Buffer.from(chunk));
    });
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (terminalFailure) {
        reject(terminalFailure);
        return;
      }
      resolve(Object.freeze({
        pid: child.pid!,
        exitCode,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      }));
    });
  });
}

function parseChildProbeOutputV2(
  output: Buffer,
  normalizedEnvironmentHash: string,
): NetworkIsolationProbeSetV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.toString("utf8"));
  } catch (error) {
    return fail(
      "NETWORK_ISOLATION_V2_PROBE_FAILED",
      "Network isolation probe did not emit one JSON observation",
      error,
    );
  }
  if (
    parsed === null
    || typeof parsed !== "object"
    || Array.isArray(parsed)
    || Object.keys(parsed).sort().join(",")
      !== "normalizedEnvironmentHash,probes"
    || (parsed as { normalizedEnvironmentHash?: unknown })
      .normalizedEnvironmentHash !== normalizedEnvironmentHash
  ) {
    return fail(
      "NETWORK_ISOLATION_V2_PROBE_FAILED",
      "Network isolation probe changed its exact output or environment binding",
    );
  }
  const probes = (parsed as { probes: unknown }).probes;
  const result = NetworkIsolationProbeSetV2Schema.safeParse(probes);
  if (!result.success) {
    return fail(
      "NETWORK_ISOLATION_V2_PROBE_FAILED",
      "Network isolation child observation failed the exact probe schema",
      result.error,
    );
  }
  return result.data;
}

export type NetworkIsolationProbeExecutionResultV2 = Readonly<{
  status: "verified_test_fixture_network_isolation";
  diagnostics: readonly [];
  networkAuthority: NetworkIsolationAuthorityCandidateV2;
  receipt: NetworkIsolationNegativeProbeReceiptV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

type NetworkIsolationProbeRunOptionsV2 = Readonly<{
  scratchRoot?: string;
  retainScratchRoot?: boolean;
  reuseScratchDirectories?: boolean;
}>;

async function runNetworkIsolatedInternalV2(
  context: NetworkIsolationProbeContextV2,
  options: NetworkIsolationProbeRunOptionsV2 = {},
): Promise<NetworkIsolationProbeExecutionResultV2> {
  const state = authenticContextV2(context);
  if (state.lifecycle.status === "destroyed") {
    return fail(
      "NETWORK_ISOLATION_V2_DESTROYED",
      "Network isolation context has already been destroyed",
    );
  }
  if (state.lifecycle.status === "running") {
    return fail(
      "NETWORK_ISOLATION_V2_ALREADY_RUNNING",
      "Network isolation context owns at most one in-flight probe",
    );
  }
  state.lifecycle.status = "running";
  let scratchRoot: string | undefined;
  let scratchRootIdentity: Readonly<{ dev: bigint; ino: bigint }> | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  let primaryFailure: unknown;
  try {
    const before = await Promise.all([
      captureExactPhysicalFileV2(state.wrapperModule.absolutePath),
      captureExactPhysicalFileV2(state.sandboxExecutable.absolutePath),
      captureExactPhysicalFileV2(state.nodeExecutable.absolutePath),
    ]);
    if (canonicalJsonStringify(before) !== canonicalJsonStringify([
      state.wrapperModule,
      state.sandboxExecutable,
      state.nodeExecutable,
    ])) {
      return fail(
        "NETWORK_ISOLATION_V2_HOST_DRIFT",
        "Network isolation implementation or executable identity drifted",
      );
    }
    if (options.scratchRoot !== undefined) {
      if (!path.isAbsolute(options.scratchRoot)) {
        return fail(
          "NETWORK_ISOLATION_V2_HOST_DRIFT",
          "Network isolation scratch root must be one absolute private directory",
        );
      }
      const scratchStat = lstatSync(options.scratchRoot, { bigint: true });
      if (
        scratchStat.isSymbolicLink()
        || !scratchStat.isDirectory()
        || (scratchStat.mode & 0o7777n) !== 0o700n
      ) {
        return fail(
          "NETWORK_ISOLATION_V2_HOST_DRIFT",
          "Network isolation scratch root must remain one non-symlink mode-0700 directory",
        );
      }
      scratchRoot = options.scratchRoot;
    } else {
      scratchRoot = mkdtempSync(path.join(tmpdir(), "setfarm-network-v2-"));
    }
    {
      const scratchIdentity = lstatSync(
        scratchRoot,
        { bigint: true },
      ) as { dev: bigint; ino: bigint };
      scratchRootIdentity = {
        dev: scratchIdentity.dev,
        ino: scratchIdentity.ino,
      };
    }
    const runHome = path.join(scratchRoot, "home");
    const runTmp = path.join(scratchRoot, "tmp");
    const runCache = path.join(scratchRoot, "cache");
    for (const directory of [runHome, runTmp, runCache]) {
      mkdirSync(directory, {
        mode: 0o700,
        recursive: options.reuseScratchDirectories === true,
      });
    }
    const nonce = randomBytes(32).toString("hex");
    const redirectLocation = `/echo?nonce=${encodeURIComponent(nonce)}`;
    let requestCount = 0;
    server = createServer((request, response) => {
      requestCount += 1;
      if (request.url === redirectLocation) {
        response.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
          connection: "close",
        });
        response.end(nonce);
        return;
      }
      if (request.url === "/redirect") {
        response.writeHead(302, {
          location: redirectLocation,
          connection: "close",
          "content-length": "0",
        });
        response.end();
        return;
      }
      response.writeHead(404, { connection: "close", "content-length": "0" });
      response.end();
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      return fail(
        "NETWORK_ISOLATION_V2_PROBE_FAILED",
        "Network isolation loopback probe did not acquire one private port",
      );
    }
    const normalizedEnvironmentHash =
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2;
    const environment = Object.freeze({
      CI: "true",
      HOME: runHome,
      HOST: "127.0.0.1",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NO_COLOR: "1",
      PORT: String(address.port),
      RUNTIME_URL: `http://127.0.0.1:${address.port}`,
      RUN_CACHE_DIR: runCache,
      RUN_HOME: runHome,
      RUN_TMPDIR: runTmp,
      TEMP: runTmp,
      TMP: runTmp,
      TMPDIR: runTmp,
      TZ: "UTC",
    });
    const config = {
      knownOsInjectedVariableNames: ["__CF_USER_TEXT_ENCODING"],
      normalizedVariableNames: [...NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2],
      normalizedEnvironmentHash,
      nonce,
      port: address.port,
      redirectLocation,
    };
    const started = Date.now();
    const child = await spawnProbeV2({
      state,
      encodedConfig: Buffer.from(JSON.stringify(config), "utf8").toString("base64url"),
      cwd: scratchRoot,
      environment,
    });
    const finished = Date.now();
    if (
      child.exitCode !== 0
      || child.signal !== null
      || child.stderr.byteLength !== 0
      || requestCount !== 2
    ) {
      return fail(
        "NETWORK_ISOLATION_V2_PROBE_FAILED",
        "Network isolation child did not complete every exact negative probe",
        {
          exitCode: child.exitCode,
          signal: child.signal,
          stderr: child.stderr.toString("utf8").slice(0, 1_000),
          requestCount,
        },
      );
    }
    const probes = parseChildProbeOutputV2(
      child.stdout,
      normalizedEnvironmentHash,
    );
    const receiptIdentity: NetworkIsolationNegativeProbeReceiptHashPayloadV2 = {
      schema: NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: state.admissionScope,
      releaseCandidate: {
        platformTreeHash: state.platformTreeHash,
        runtimePayloadHash: state.runtimePayloadHash,
      },
      implementation: {
        enforcementRef: EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
        wrapperModuleLocator: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
        wrapperExport: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
        wrapperModuleHash: state.wrapperModule.mutableFingerprint.contentHash,
        sandboxExecutableRef: EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
        sandboxExecutableHash: state.sandboxExecutable.mutableFingerprint.contentHash,
        nodeExecutableRef: "EXEC_NODE_RUNTIME_V2",
        nodeExecutableHash: state.nodeExecutable.mutableFingerprint.contentHash,
        canonicalProfileHash: NETWORK_SANDBOX_PROFILE_HASH_V2,
        hostRuntimeIdentityHash: state.hostRuntimeIdentityHash,
        probeProgramRef: NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_REF_V2,
        probeProgramHash: NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_HASH_V2,
        receiptSchemaHash:
          NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
      },
      environment: {
        constructionPolicy: "deny_all_then_exact_set",
        inheritAmbientEnvironment: false,
        shell: "forbidden",
        knownOsInjectedVariableNames: ["__CF_USER_TEXT_ENCODING"],
        osInjectionDisposition: "removed_before_probe_or_candidate_import",
        normalizedVariableNames:
          [...NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2],
        normalizedEnvironmentHash,
      },
      attemptNonceHash: sha256(nonce),
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      process: {
        pid: child.pid,
        termination: "normal_exit",
        exitCode: 0,
        signal: null,
        stdout: {
          contentHash: sha256(child.stdout),
          byteLength: child.stdout.byteLength,
        },
        stderr: {
          contentHash: EMPTY_SHA256_V2,
          byteLength: child.stderr.byteLength,
        },
      },
      probes,
      probeSetHash: hashNetworkIsolationProbeSetV2(probes),
    };
    const receipt = NetworkIsolationNegativeProbeReceiptV2Schema.parse({
      ...receiptIdentity,
      receiptHash: hashNetworkIsolationNegativeProbeReceiptV2(receiptIdentity),
    });
    const authorityIdentity = {
      schema: NETWORK_ISOLATION_AUTHORITY_V2_SCHEMA,
      enforcementRef: EVIDENCE_ENVIRONMENT_NETWORK_ENFORCEMENT_REF_V2,
      wrapperModuleLocator: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
      wrapperExport: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_EXPORT_V2,
      wrapperModuleHash: state.wrapperModule.mutableFingerprint.contentHash,
      sandboxExecutableRef: EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
      canonicalProfileHash: NETWORK_SANDBOX_PROFILE_HASH_V2,
      hostRuntimeIdentityHash: state.hostRuntimeIdentityHash,
      negativeProbeReceiptSchema:
        NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
      negativeProbeReceiptSchemaHash:
        NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
    } as const;
    const networkAuthority = NetworkIsolationAuthorityCandidateV2Schema.parse({
      ...authorityIdentity,
      authorityHash: hashNetworkIsolationAuthorityV2(authorityIdentity),
    });
    const after = await Promise.all([
      captureExactPhysicalFileV2(state.wrapperModule.absolutePath),
      captureExactPhysicalFileV2(state.sandboxExecutable.absolutePath),
      captureExactPhysicalFileV2(state.nodeExecutable.absolutePath),
    ]);
    if (canonicalJsonStringify(before) !== canonicalJsonStringify(after)) {
      return fail(
        "NETWORK_ISOLATION_V2_HOST_DRIFT",
        "Network isolation implementation or executable changed during probe",
      );
    }
    return deepFreezeJson({
      status: "verified_test_fixture_network_isolation" as const,
      diagnostics: [] as readonly [],
      networkAuthority: structuredClone(networkAuthority),
      receipt: structuredClone(receipt),
      productionDisposition:
        "forbidden_until_verified_platform_release" as const,
    });
  } catch (error) {
    primaryFailure = error;
    if (error instanceof NetworkIsolationSandboxErrorV2) throw error;
    return fail(
      "NETWORK_ISOLATION_V2_RECEIPT_INVALID",
      "Network isolation probe failed at an untyped boundary",
      error,
    );
  } finally {
    const cleanupErrors: unknown[] = [];
    if (server) {
      try {
        await new Promise<void>((resolve, reject) => {
          server!.close((error) => error ? reject(error) : resolve());
        });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (scratchRoot && !options.retainScratchRoot) {
      try {
        if (scratchRootIdentity === undefined) {
          throw new Error("Network isolation scratch root identity was not captured");
        }
        const currentRoot = lstatSync(
          scratchRoot,
          { bigint: true },
        ) as ReturnType<typeof lstatSync> & { dev: bigint; ino: bigint };
        if (
          currentRoot.isSymbolicLink()
          || !currentRoot.isDirectory()
          || currentRoot.dev !== scratchRootIdentity.dev
          || currentRoot.ino !== scratchRootIdentity.ino
        ) {
          throw new Error(
            "Network isolation scratch root changed; refusing destructive cleanup",
          );
        }
        rmSync(scratchRoot, { recursive: true, force: false });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    state.lifecycle.status = "ready";
    if (cleanupErrors.length > 0) {
      throw new NetworkIsolationSandboxErrorV2(
        "NETWORK_ISOLATION_V2_CLEANUP_FAILED",
        "Network isolation probe could not clean every owned resource",
        { cause: { primaryFailure, cleanupErrors } },
      );
    }
  }
}

export async function runNetworkIsolatedV2(
  context: NetworkIsolationProbeContextV2,
): Promise<NetworkIsolationProbeExecutionResultV2> {
  return runNetworkIsolatedInternalV2(context);
}

/**
 * @internal Test-only bridge. It keeps the production launcher zero-input
 * while allowing a characterization fixture to own and fence its private
 * scratch root around the unchanged network probe.
 */
export async function runNetworkIsolatedWithScratchRootForTestV2(
  context: NetworkIsolationProbeContextV2,
  scratchRoot: string,
): Promise<NetworkIsolationProbeExecutionResultV2> {
  return runNetworkIsolatedInternalV2(context, {
    scratchRoot,
    retainScratchRoot: true,
    reuseScratchDirectories: true,
  });
}

export function destroyNetworkIsolationProbeContextV2(
  context: NetworkIsolationProbeContextV2,
): void {
  const state = authenticContextV2(context);
  if (state.lifecycle.status === "running") {
    return fail(
      "NETWORK_ISOLATION_V2_ALREADY_RUNNING",
      "An in-flight network isolation probe cannot be destroyed",
    );
  }
  state.lifecycle.status = "destroyed";
}
