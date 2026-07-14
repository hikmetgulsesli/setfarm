import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Socket } from "node:net";
import { z } from "zod";

import type { RuntimeDataContractV1 } from "../product-compiler/schemas/runtime-data-contract-v1.js";
import type { ProcessIdentityV1 } from "./schemas/process-identity-v1.js";
import {
  createV3RuntimeIsolationAuthorityV1,
  createV3RuntimeIsolationChallengeV1,
  createV3RuntimeIsolationPolicyV1,
  createV3RuntimeVolumeProvisioningV1,
  type V3RuntimeIsolationAuthorityV1,
  type V3RuntimeIsolationChallengeV1,
  type V3RuntimeIsolationPolicyV1,
  type V3RuntimeVolumeProvisioningV1,
} from "./schemas/v3-runtime-isolation-v1.js";

export const V3_DARWIN_ISOLATION_ADAPTER_ID = "darwin-sandbox-exec" as const;
export const V3_DARWIN_ISOLATION_ADAPTER_VERSION = "1.0.0" as const;
export const V3_DARWIN_SANDBOX_EXECUTABLE = "/usr/bin/sandbox-exec";

export function darwinRuntimeIsolationAvailable(): boolean {
  return process.platform === "darwin" && existsSync(V3_DARWIN_SANDBOX_EXECUTABLE);
}

const WrapperDeniedRootProbeSchema = z.object({
  rootId: z.enum(["sealed-runtime", "state-authority"]),
  outcome: z.literal("denied"),
}).strict();
const WrapperDeniedReadProbeSchema = z.object({
  authorityId: z.enum(["launch-agents", "mission-control-config", "setfarm-config"]),
  outcome: z.literal("denied"),
}).strict();
const WrapperAllowedVolumeProbeSchema = z.object({
  volumeId: z.string().regex(/^VOLUME_[A-Z0-9]+(?:_[A-Z0-9]+)*$/),
  outcome: z.literal("write_read_delete_pass"),
}).strict();
const WrapperProbeResultSchema = z.object({
  deniedRootProbes: z.tuple([WrapperDeniedRootProbeSchema, WrapperDeniedRootProbeSchema]),
  deniedReadProbes: z.tuple([
    WrapperDeniedReadProbeSchema,
    WrapperDeniedReadProbeSchema,
    WrapperDeniedReadProbeSchema,
  ]),
  deniedNetworkProbes: z.tuple([z.object({ authorityId: z.literal("all-outbound"), outcome: z.literal("denied") }).strict()]),
  deniedProcessExecProbes: z.tuple([z.object({ executableId: z.literal("launchctl"), outcome: z.literal("denied") }).strict()]),
  deniedSignalProbes: z.tuple([z.object({ authorityId: z.literal("control-sentinel"), outcome: z.literal("denied") }).strict()]),
  allowedVolumeProbes: z.array(WrapperAllowedVolumeProbeSchema).max(1_000),
  challengedAt: z.string().datetime({ offset: true }),
}).strict();

const WrapperStartupSchema = WrapperProbeResultSchema.extend({
  schema: z.literal("setfarm.v3-darwin-wrapper-startup.v1"),
  controlPort: z.number().int().min(1).max(65_535),
}).strict();

const WrapperChallengeResponseSchema = WrapperProbeResultSchema.extend({
  schema: z.literal("setfarm.v3-darwin-wrapper-challenge-response.v1"),
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type WrapperStartup = z.infer<typeof WrapperStartupSchema>;

export const V3_DARWIN_RUNTIME_WRAPPER_SOURCE = String.raw`
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");
const [gatePath, expectedGate64, cwd64, argv64, config64, logPath64] = process.argv.slice(1);
const expectedGate = Buffer.from(expectedGate64, "base64url").toString("utf8");
const cwd = Buffer.from(cwd64, "base64url").toString("utf8");
const argv = JSON.parse(Buffer.from(argv64, "base64url").toString("utf8"));
const config = JSON.parse(Buffer.from(config64, "base64url").toString("utf8"));
const logPath = Buffer.from(logPath64, "base64url").toString("utf8");
const controlToken = fs.readFileSync(0, "utf8").trim();
if (!/^[a-f0-9]{64}$/.test(controlToken)) process.exit(125);
let child;
let stopped = false;
let logBytes = 0;
const MAX_LOG_BYTES = 1024 * 1024;
const logFd = fs.openSync(logPath, "a", 0o600);
try { logBytes = fs.fstatSync(logFd).size; } catch {}
const writeLog = (chunk) => {
  if (logBytes >= MAX_LOG_BYTES) return;
  const bytes = Buffer.from(chunk);
  const accepted = bytes.subarray(0, Math.max(0, MAX_LOG_BYTES - logBytes));
  if (accepted.length > 0) {
    fs.writeSync(logFd, accepted);
    logBytes += accepted.length;
  }
};
const deniedError = (error) => error && (error.code === "EPERM" || error.code === "EACCES");
const probeDeniedWrite = (entry) => {
  try {
    fs.chmodSync(entry.path, entry.mode);
    throw new Error("WRITE_ALLOWED:" + entry.rootId);
  } catch (error) {
    if (!deniedError(error)) throw error;
    return { rootId: entry.rootId, outcome: "denied" };
  }
};
const probeDeniedRead = (entry) => {
  try {
    fs.readdirSync(entry.path);
    throw new Error("READ_ALLOWED:" + entry.authorityId);
  } catch (error) {
    if (!deniedError(error)) throw error;
    return { authorityId: entry.authorityId, outcome: "denied" };
  }
};
const probeAllowedVolume = (entry) => {
  const probe = entry.path + "/.setfarm-volume-probe-" + crypto.randomBytes(16).toString("hex");
  const expected = crypto.randomBytes(32);
  fs.writeFileSync(probe, expected, { flag: "wx", mode: 0o600 });
  const observed = fs.readFileSync(probe);
  fs.unlinkSync(probe);
  if (!observed.equals(expected)) throw new Error("ALLOWED_VOLUME_PROBE_MISMATCH:" + entry.volumeId);
  return { volumeId: entry.volumeId, outcome: "write_read_delete_pass" };
};
const probeOutboundDenied = () => new Promise((resolve, reject) => {
  const socket = net.connect({ host: "127.0.0.1", port: 1 });
  const timer = setTimeout(() => { socket.destroy(); reject(new Error("OUTBOUND_PROBE_TIMEOUT")); }, 1000);
  socket.once("connect", () => { clearTimeout(timer); socket.destroy(); reject(new Error("OUTBOUND_ALLOWED")); });
  socket.once("error", (error) => {
    clearTimeout(timer);
    if (!deniedError(error)) reject(error);
    else resolve({ authorityId: "all-outbound", outcome: "denied" });
  });
});
const probeLaunchctlDenied = () => new Promise((resolve, reject) => {
  try {
    const attempted = spawn("/bin/launchctl", ["help"], { stdio: "ignore" });
    attempted.once("spawn", () => { try { attempted.kill("SIGKILL"); } catch {} reject(new Error("LAUNCHCTL_EXEC_ALLOWED")); });
    attempted.once("error", (error) => deniedError(error)
      ? resolve({ executableId: "launchctl", outcome: "denied" })
      : reject(error));
  } catch (error) {
    if (deniedError(error)) resolve({ executableId: "launchctl", outcome: "denied" });
    else reject(error);
  }
});
const probeCrossSandboxSignalDenied = (sentinelPid) => {
  if (!Number.isSafeInteger(sentinelPid) || sentinelPid <= 1) throw new Error("CONTROL_SENTINEL_INVALID");
  try {
    process.kill(sentinelPid, "SIGCONT");
    throw new Error("CROSS_SANDBOX_SIGNAL_ALLOWED");
  } catch (error) {
    if (!deniedError(error)) throw error;
    return { authorityId: "control-sentinel", outcome: "denied" };
  }
};
const runProbes = async (sentinelPid) => ({
  deniedRootProbes: config.deniedWriteRoots.map(probeDeniedWrite),
  deniedReadProbes: config.deniedReadRoots.map(probeDeniedRead),
  deniedNetworkProbes: [await probeOutboundDenied()],
  deniedProcessExecProbes: [await probeLaunchctlDenied()],
  deniedSignalProbes: [probeCrossSandboxSignalDenied(sentinelPid)],
  allowedVolumeProbes: config.allowedVolumes.map(probeAllowedVolume),
  challengedAt: new Date().toISOString(),
});
const stop = (signal) => {
  stopped = true;
  if (child) { try { child.kill(signal); } catch {} }
  else process.exit(signal === "SIGTERM" ? 143 : 130);
};
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGINT", () => stop("SIGINT"));
const server = net.createServer((socket) => {
  let bytes = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    bytes += chunk;
    if (bytes.length > 8192) socket.destroy();
    const newline = bytes.indexOf("\n");
    if (newline < 0) return;
    socket.pause();
    Promise.resolve().then(async () => {
      const request = JSON.parse(bytes.slice(0, newline));
      if (request.token !== controlToken || !/^[a-f0-9]{64}$/.test(request.nonce)) {
        throw new Error("CONTROL_AUTHORITY_INVALID");
      }
      const probes = await runProbes(request.sentinelPid);
      socket.end(JSON.stringify({
        schema: "setfarm.v3-darwin-wrapper-challenge-response.v1",
        nonce: request.nonce,
        ...probes,
      }) + "\n");
    }).catch(() => socket.destroy());
  });
});
const start = async () => {
  const startupProbes = await runProbes(config.startupSentinelPid);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("CONTROL_LISTENER_INVALID");
  fs.writeSync(3, JSON.stringify({
    schema: "setfarm.v3-darwin-wrapper-startup.v1",
    controlPort: address.port,
    ...startupProbes,
  }) + "\n");
  fs.closeSync(3);
  let attempts = 0;
  const waitForGate = () => {
    if (stopped) return;
    attempts += 1;
    try {
      if (fs.readFileSync(gatePath, "utf8").trim() === expectedGate) {
        child = spawn(argv[0], argv.slice(1), { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
        child.stdout.on("data", writeLog);
        child.stderr.on("data", writeLog);
        child.once("error", (error) => { writeLog("V3_DEPLOY_PREVIEW_START_FAILED:" + String(error) + "\n"); process.exit(127); });
        child.once("exit", (code, signal) => {
          if (signal === "SIGTERM") process.exit(143);
          else if (signal === "SIGINT") process.exit(130);
          else if (signal) process.exit(128);
          else process.exit(code === null ? 1 : code);
        });
        return;
      }
    } catch {}
    if (attempts >= 1200) process.exit(124);
    else setTimeout(waitForGate, 50);
  };
  waitForGate();
};
start().catch((error) => { try { writeLog("V3_ISOLATION_STARTUP_FAILED:" + String(error) + "\n"); } catch {} process.exit(126); });
`;

export const V3_DARWIN_RUNTIME_WRAPPER_HASH = createHash("sha256")
  .update(V3_DARWIN_RUNTIME_WRAPPER_SOURCE)
  .digest("hex");

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function canonicalExistingPath(input: string): string {
  const resolved = path.resolve(input);
  const stats = lstatSync(resolved);
  if (stats.isSymbolicLink()) throw new Error(`V3_DEPLOY_ISOLATION_PATH_SYMLINK:${input}`);
  if (realpathSync(resolved) !== resolved) throw new Error(`V3_DEPLOY_ISOLATION_PATH_NONCANONICAL:${input}`);
  return resolved;
}

function resolvedExistingPath(input: string): string {
  return realpathSync(path.resolve(input));
}

function executablePathVariants(candidate: string): readonly string[] {
  const literal = path.resolve(candidate);
  if (!existsSync(literal)) throw new Error(`V3_DEPLOY_ISOLATION_EXECUTABLE_MISSING:${candidate}`);
  return [...new Set([literal, resolvedExistingPath(literal)])];
}

export function canonicalDarwinIsolationConfigRoots(input: Readonly<{
  setfarmConfigRoot: string;
  missionControlConfigRoot: string;
}>): Readonly<{ setfarmConfigRoot: string; missionControlConfigRoot: string }> {
  const setfarmConfigRoot = canonicalExistingPath(input.setfarmConfigRoot);
  const missionControlConfigRoot = canonicalExistingPath(input.missionControlConfigRoot);
  if (!lstatSync(setfarmConfigRoot).isDirectory() || !lstatSync(missionControlConfigRoot).isDirectory()) {
    throw new Error("V3_DEPLOY_ISOLATION_CONFIG_ROOT_NOT_DIRECTORY");
  }
  return { setfarmConfigRoot, missionControlConfigRoot };
}

function resolveExecutable(command: string, environment: NodeJS.ProcessEnv): readonly string[] {
  if (command.includes(path.sep)) return executablePathVariants(command);
  for (const directory of String(environment.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, command);
    if (existsSync(candidate)) return executablePathVariants(candidate);
  }
  throw new Error(`V3_DEPLOY_ISOLATION_EXECUTABLE_MISSING:${command}`);
}

function sbplString(value: string): string {
  if (/[\x00\n\r]/.test(value)) throw new Error("V3_DEPLOY_ISOLATION_PROFILE_PATH_INVALID");
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function canonicalProfile(input: Readonly<{
  homeAuthorityRoot: string;
  readExceptionSubpaths: readonly string[];
  readExceptionLiterals: readonly string[];
  readTraversalLiterals: readonly string[];
  allowedWritePaths: readonly string[];
  executableAllowlist: readonly string[];
}>): string {
  const subpaths = (values: readonly string[]) => values.map((entry) => `(subpath ${sbplString(entry)})`).join(" ");
  const literals = (values: readonly string[]) => values.map((entry) => `(literal ${sbplString(entry)})`).join(" ");
  return [
    "(version 1)",
    "(allow default)",
    `(deny file-read* (subpath ${sbplString(input.homeAuthorityRoot)}))`,
    `(allow file-read-metadata file-test-existence ${literals(input.readTraversalLiterals)})`,
    `(allow file-read* file-test-existence file-map-executable ${subpaths(input.readExceptionSubpaths)} ${literals(input.readExceptionLiterals)})`,
    "(deny file-write*)",
    `(allow file-write* ${literals(input.allowedWritePaths)})`,
    "(deny network-outbound)",
    "(deny network-inbound)",
    '(allow network-inbound (local ip "localhost:*"))',
    "(deny signal)",
    "(allow signal (target self))",
    "(allow signal (target same-sandbox))",
    "(deny process-exec)",
    `(allow process-exec ${literals(input.executableAllowlist)})`,
    "(deny process-info*)",
    "(allow process-info* (target self))",
    "(allow process-info* (target same-sandbox))",
    "",
  ].join("\n");
}

function traversalPaths(homeAuthorityRoot: string, targetPaths: readonly string[]): readonly string[] {
  const found = new Set<string>([homeAuthorityRoot]);
  for (const targetPath of targetPaths) {
    let current = path.dirname(targetPath);
    while (current === homeAuthorityRoot || current.startsWith(`${homeAuthorityRoot}${path.sep}`)) {
      found.add(current);
      if (current === homeAuthorityRoot) break;
      current = path.dirname(current);
    }
  }
  return [...found].sort();
}

export type DarwinIsolationBundle = Readonly<{
  profile: string;
  policy: V3RuntimeIsolationPolicyV1;
  authority: V3RuntimeIsolationAuthorityV1;
  volumeProvisioning: V3RuntimeVolumeProvisioningV1;
  sensitiveReadRoots: readonly Readonly<{ authorityId: "launch-agents" | "mission-control-config" | "setfarm-config"; path: string }>[];
  allowedVolumes: readonly Readonly<{ volumeId: string; path: string }>[];
}>;

export function createWriteFreeDarwinIsolationBundle(input: Readonly<{
  runId: string;
  projectId: string;
  candidateHash: string;
  buildArtifactHash: string;
  stateRoot: string;
  sealedRuntimeRoot: string;
  gatePath: string;
  logPath: string;
  previewArgv: readonly string[];
  environment: NodeJS.ProcessEnv;
  runtimeDataContract: RuntimeDataContractV1;
  runtimeDataContractHash: string;
  missionControlConfigRoot: string;
  setfarmConfigRoot: string;
}>): DarwinIsolationBundle {
  if (
    input.runtimeDataContract.writableVolumes.length > 0
    || input.runtimeDataContract.scratch.kind !== "none"
  ) {
    throw new Error("V3_DEPLOY_RUNTIME_DATA_HARD_QUOTA_UNSUPPORTED");
  }
  const stateRoot = canonicalExistingPath(input.stateRoot);
  const sealedRuntimeRoot = canonicalExistingPath(input.sealedRuntimeRoot);
  const logPath = path.resolve(input.logPath);
  const logParent = canonicalExistingPath(path.dirname(logPath));
  if (path.dirname(logPath) !== logParent) throw new Error("V3_DEPLOY_ISOLATION_LOG_PATH_NONCANONICAL");
  const logStats = lstatSync(logPath);
  if (logStats.isSymbolicLink() || !logStats.isFile() || realpathSync(logPath) !== logPath) {
    throw new Error("V3_DEPLOY_ISOLATION_LOG_PATH_UNSAFE");
  }
  const gatePath = path.resolve(input.gatePath);
  const gateParent = canonicalExistingPath(path.dirname(gatePath));
  if (path.dirname(gatePath) !== gateParent) throw new Error("V3_DEPLOY_ISOLATION_GATE_PATH_NONCANONICAL");
  if (existsSync(gatePath)) {
    const gateStats = lstatSync(gatePath);
    if (gateStats.isSymbolicLink() || !gateStats.isFile() || realpathSync(gatePath) !== gatePath) {
      throw new Error("V3_DEPLOY_ISOLATION_GATE_PATH_UNSAFE");
    }
  }
  const homeAuthorityRoot = canonicalExistingPath(homedir());
  const sensitiveReadRoots = [
    { authorityId: "launch-agents" as const, path: canonicalExistingPath(path.join(homedir(), "Library", "LaunchAgents")) },
    { authorityId: "mission-control-config" as const, path: canonicalExistingPath(input.missionControlConfigRoot) },
    { authorityId: "setfarm-config" as const, path: canonicalExistingPath(input.setfarmConfigRoot) },
  ];
  const executableAllowlist = [...new Set([
    ...executablePathVariants(process.execPath),
    ...resolveExecutable(input.previewArgv[0]!, input.environment),
  ])].sort();
  const volumeProvisioning = createV3RuntimeVolumeProvisioningV1({
    schema: "setfarm.v3-runtime-volume-provisioning.v1",
    runId: input.runId,
    projectId: input.projectId,
    runtimeDataContractHash: input.runtimeDataContractHash,
    writableVolumes: [],
    scratch: { kind: "none" },
  });
  const readExceptionSubpaths = [sealedRuntimeRoot];
  const readExceptionLiterals = [gatePath];
  const readTraversalLiterals = traversalPaths(homeAuthorityRoot, [sealedRuntimeRoot, gatePath, logPath]);
  const allowedWritePaths = [logPath, "/dev/null"];
  const profile = canonicalProfile({
    homeAuthorityRoot,
    readExceptionSubpaths,
    readExceptionLiterals,
    readTraversalLiterals,
    allowedWritePaths,
    executableAllowlist,
  });
  const profileHash = createHash("sha256").update(profile).digest("hex");
  const policy = createV3RuntimeIsolationPolicyV1({
    schema: "setfarm.v3-runtime-isolation-policy.v1",
    adapterId: V3_DARWIN_ISOLATION_ADAPTER_ID,
    adapterVersion: V3_DARWIN_ISOLATION_ADAPTER_VERSION,
    runId: input.runId,
    projectId: input.projectId,
    candidateHash: input.candidateHash,
    buildArtifactHash: input.buildArtifactHash,
    profileHash,
    wrapperArtifactHash: V3_DARWIN_RUNTIME_WRAPPER_HASH,
    runtimeDataContractHash: input.runtimeDataContractHash,
    volumeProvisioningHash: volumeProvisioning.volumeProvisioningHash,
    deniedWriteRoots: [
      { rootId: "sealed-runtime", canonicalPath: sealedRuntimeRoot },
      { rootId: "state-authority", canonicalPath: stateRoot },
    ],
    deniedReadRoots: sensitiveReadRoots.map((entry) => ({
      rootId: entry.authorityId,
      canonicalPath: entry.path,
    })) as [
      { rootId: "launch-agents"; canonicalPath: string },
      { rootId: "mission-control-config"; canonicalPath: string },
      { rootId: "setfarm-config"; canonicalPath: string },
    ],
    homeAuthorityRoot,
    readExceptions: [
      { rootId: "sealed-runtime", canonicalPath: sealedRuntimeRoot },
      { rootId: "platform-control-gate", canonicalPath: gatePath },
    ],
    readTraversalPaths: [...readTraversalLiterals],
    allowedWriteRoots: [
      { rootId: "platform-log", canonicalPath: logPath },
      { rootId: "platform-null-device", canonicalPath: "/dev/null" },
    ],
    executableAllowlist,
    networkPolicy: { outbound: "deny", inbound: "loopback-any-port" },
    signalPolicy: { crossSandbox: "deny", sameSandbox: "allow" },
    processInfoPolicy: "self-and-same-sandbox-only",
  });
  const authority = createV3RuntimeIsolationAuthorityV1({
    schema: "setfarm.v3-runtime-isolation-authority.v1",
    adapterId: V3_DARWIN_ISOLATION_ADAPTER_ID,
    adapterVersion: V3_DARWIN_ISOLATION_ADAPTER_VERSION,
    runId: input.runId,
    projectId: input.projectId,
    candidateHash: input.candidateHash,
    buildArtifactHash: input.buildArtifactHash,
    policyHash: policy.policyHash,
    profileHash,
    wrapperArtifactHash: V3_DARWIN_RUNTIME_WRAPPER_HASH,
    runtimeDataContractHash: input.runtimeDataContractHash,
    volumeProvisioningHash: volumeProvisioning.volumeProvisioningHash,
  });
  return {
    profile,
    policy,
    authority,
    volumeProvisioning,
    sensitiveReadRoots,
    allowedVolumes: [],
  };
}

function readLine(stream: NodeJS.ReadableStream, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = "";
    const timeout = setTimeout(() => finish(new Error("V3_DEPLOY_ISOLATION_STARTUP_TIMEOUT")), timeoutMs);
    const finish = (error?: Error, line?: string) => {
      clearTimeout(timeout);
      stream.removeListener("data", onData);
      stream.removeListener("error", onError);
      stream.removeListener("end", onEnd);
      stream.removeListener("close", onEnd);
      if (error) reject(error);
      else resolve(line ?? "");
    };
    const onError = (error: Error) => finish(error);
    const onEnd = () => finish(new Error("V3_DEPLOY_ISOLATION_STARTUP_PIPE_CLOSED"));
    const onData = (chunk: Buffer | string) => {
      value += chunk.toString();
      if (value.length > 64 * 1024) return finish(new Error("V3_DEPLOY_ISOLATION_RESPONSE_TOO_LARGE"));
      const newline = value.indexOf("\n");
      if (newline >= 0) finish(undefined, value.slice(0, newline));
    };
    stream.on("data", onData);
    stream.once("error", onError);
    stream.once("end", onEnd);
    stream.once("close", onEnd);
  });
}

async function spawnControlSentinel(): Promise<ChildProcess> {
  const sentinel = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  await new Promise<void>((resolve, reject) => {
    sentinel.once("spawn", resolve);
    sentinel.once("error", reject);
  });
  if (!sentinel.pid || sentinel.pid <= 1) {
    try { sentinel.kill("SIGKILL"); } catch { /* best effort */ }
    throw new Error("V3_DEPLOY_ISOLATION_CONTROL_SENTINEL_UNAVAILABLE");
  }
  return sentinel;
}

function assertSentinelAlive(sentinel: ChildProcess): void {
  if (!sentinel.pid || sentinel.exitCode !== null || sentinel.signalCode !== null) {
    throw new Error("V3_DEPLOY_ISOLATION_CONTROL_SENTINEL_TERMINATED");
  }
  try {
    process.kill(sentinel.pid, 0);
  } catch {
    throw new Error("V3_DEPLOY_ISOLATION_CONTROL_SENTINEL_TERMINATED");
  }
}

function disposeSentinel(sentinel: ChildProcess): void {
  try { sentinel.kill("SIGKILL"); } catch { /* best effort */ }
}

export async function spawnDarwinIsolatedRuntime(input: Readonly<{
  gatePath: string;
  expectedGate: unknown;
  cwd: string;
  argv: readonly string[];
  environment: NodeJS.ProcessEnv;
  logPath: string;
  isolation: DarwinIsolationBundle;
}>): Promise<Readonly<{
  child: ChildProcess;
  controlPort: number;
  controlToken: string;
  startup: WrapperStartup;
}>> {
  if (!darwinRuntimeIsolationAvailable()) {
    throw new Error("V3_DEPLOY_ISOLATION_ADAPTER_UNAVAILABLE");
  }
  const controlToken = randomBytes(32).toString("hex");
  const startupSentinel = await spawnControlSentinel();
  const config = {
    deniedWriteRoots: input.isolation.policy.deniedWriteRoots.map((entry) => ({
      rootId: entry.rootId,
      path: entry.canonicalPath,
      mode: lstatSync(entry.canonicalPath).mode & 0o7777,
    })),
    deniedReadRoots: input.isolation.sensitiveReadRoots,
    allowedVolumes: input.isolation.allowedVolumes,
    startupSentinelPid: startupSentinel.pid,
  };
  const child = spawn(V3_DARWIN_SANDBOX_EXECUTABLE, [
    "-p",
    input.isolation.profile,
    process.execPath,
    "-e",
    V3_DARWIN_RUNTIME_WRAPPER_SOURCE,
    input.gatePath,
    base64Url(JSON.stringify(input.expectedGate)),
    base64Url(input.cwd),
    base64Url(JSON.stringify(input.argv)),
    base64Url(JSON.stringify(config)),
    base64Url(input.logPath),
  ], {
    detached: true,
    stdio: ["pipe", "ignore", "pipe", "pipe"],
    env: input.environment,
  });
  let sandboxDiagnostic = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    sandboxDiagnostic = `${sandboxDiagnostic}${chunk.toString()}`.slice(-4_000);
  });
  const startupStream = child.stdio[3];
  const tokenStream = child.stdin;
  if (!startupStream || !tokenStream) {
    disposeSentinel(startupSentinel);
    try { child.kill("SIGKILL"); } catch { /* best effort */ }
    throw new Error("V3_DEPLOY_ISOLATION_CONTROL_PIPE_UNAVAILABLE");
  }
  (tokenStream as import("node:stream").Writable).end(`${controlToken}\n`);
  let startup: WrapperStartup;
  try {
    startup = WrapperStartupSchema.parse(JSON.parse(await readLine(startupStream as import("node:stream").Readable, 10_000)));
    assertSentinelAlive(startupSentinel);
  } catch (error) {
    try { process.kill(-(child.pid ?? 0), "SIGKILL"); } catch { /* best effort */ }
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timeout = setTimeout(resolve, 100);
      child.once("close", () => { clearTimeout(timeout); resolve(); });
    });
    let diagnostic = "";
    try { diagnostic = readFileSync(input.logPath, "utf8").slice(-2_000); } catch { /* no diagnostic */ }
    throw new Error(`V3_DEPLOY_ISOLATION_STARTUP_PROOF_INVALID:${String(error).slice(0, 500)}:exit=${String(child.exitCode)}:signal=${String(child.signalCode)}:${sandboxDiagnostic}:${diagnostic}`);
  } finally {
    disposeSentinel(startupSentinel);
    if ("destroy" in startupStream) startupStream.destroy();
    tokenStream.destroy();
    child.stderr?.destroy();
  }
  return { child, controlPort: startup.controlPort, controlToken, startup };
}

export async function challengeDarwinIsolatedRuntime(input: Readonly<{
  controlPort: number;
  controlToken: string;
  authorityHash: string;
  wrapperProcessIdentity: ProcessIdentityV1;
}>): Promise<V3RuntimeIsolationChallengeV1> {
  const nonce = randomBytes(32).toString("hex");
  const sentinel = await spawnControlSentinel();
  const response = await new Promise<z.infer<typeof WrapperChallengeResponseSchema>>((resolve, reject) => {
    const socket = new Socket();
    let value = "";
    const timeout = setTimeout(() => { socket.destroy(); reject(new Error("V3_DEPLOY_ISOLATION_CHALLENGE_TIMEOUT")); }, 3_000);
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      value += chunk;
      if (value.length > 64 * 1024) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error("V3_DEPLOY_ISOLATION_RESPONSE_TOO_LARGE"));
        return;
      }
      const newline = value.indexOf("\n");
      if (newline < 0) return;
      clearTimeout(timeout);
      socket.destroy();
      try { resolve(WrapperChallengeResponseSchema.parse(JSON.parse(value.slice(0, newline)))); }
      catch (error) { reject(error); }
    });
    socket.once("error", (error) => { clearTimeout(timeout); reject(error); });
    socket.connect(input.controlPort, "127.0.0.1", () => {
      socket.write(`${JSON.stringify({ token: input.controlToken, nonce, sentinelPid: sentinel.pid })}\n`);
    });
  }).finally(() => {
    try { assertSentinelAlive(sentinel); }
    finally { disposeSentinel(sentinel); }
  });
  if (response.nonce !== nonce) throw new Error("V3_DEPLOY_ISOLATION_CHALLENGE_NONCE_MISMATCH");
  return createV3RuntimeIsolationChallengeV1({
    schema: "setfarm.v3-runtime-isolation-challenge.v1",
    nonce,
    authorityHash: input.authorityHash,
    wrapperProcessIdentity: input.wrapperProcessIdentity,
    deniedRootProbes: response.deniedRootProbes,
    deniedReadProbes: response.deniedReadProbes,
    deniedNetworkProbes: response.deniedNetworkProbes,
    deniedProcessExecProbes: response.deniedProcessExecProbes,
    deniedSignalProbes: response.deniedSignalProbes,
    allowedVolumeProbes: response.allowedVolumeProbes,
    challengedAt: response.challengedAt,
  });
}
