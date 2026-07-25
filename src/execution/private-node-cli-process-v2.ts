import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type {
  CliEncodedInvocationRequestV2,
} from "../product-compiler/invocation-input-transport-v2.js";
import {
  acquireNetworkSandboxLaunchContextInternalV2,
} from "./network-sandbox-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
} from "./schemas/network-isolation-negative-probe-v2.js";
import {
  NODE_CLI_BOOTSTRAP_SOURCE_V2,
  NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2,
  NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
  NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2,
  NODE_CLI_LAUNCH_TIMEOUT_MS_V2,
} from "./schemas/node-cli-launcher-v2.js";

export type PrivateNodeCliProcessErrorCodeV2 =
  | "NODE_CLI_PROCESS_V2_INPUT_INVALID"
  | "NODE_CLI_PROCESS_V2_HOST_DRIFT"
  | "NODE_CLI_PROCESS_V2_SPAWN_FAILED"
  | "NODE_CLI_PROCESS_V2_CLEANUP_FAILED";

export class PrivateNodeCliProcessErrorV2 extends Error {
  readonly code: PrivateNodeCliProcessErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PrivateNodeCliProcessErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PrivateNodeCliProcessErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: PrivateNodeCliProcessErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PrivateNodeCliProcessErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function byteLengthOfArgv(tokens: readonly string[]): number {
  return tokens.reduce(
    (total, token) => total + Buffer.byteLength(token, "utf8") + 1,
    0,
  );
}

function exactTransportRequest(
  request: CliEncodedInvocationRequestV2,
): Readonly<{
  subcommandTokens: readonly string[];
  argvSuffix: readonly string[];
  stdin: Buffer | null;
  argvByteLength: number;
}> {
  const tokens = [...request.subcommandTokens, ...request.argvSuffix];
  if (
    tokens.length > 10_000
    || tokens.some((token) =>
      typeof token !== "string"
      || token.includes("\0")
      || Buffer.from(token, "utf8").toString("utf8") !== token)
  ) {
    return fail(
      "NODE_CLI_PROCESS_V2_INPUT_INVALID",
      "CLI transport argv is not one bounded exact UTF-8 token sequence",
    );
  }
  const argvByteLength = byteLengthOfArgv(tokens);
  if (argvByteLength > NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2) {
    return fail(
      "NODE_CLI_PROCESS_V2_INPUT_INVALID",
      "CLI transport argv exceeds the code-owned launch byte limit",
    );
  }
  const stdin = request.stdinBytes === null
    ? null
    : Buffer.from(request.stdinBytes, "utf8");
  if (
    stdin !== null
    && (
      stdin.byteLength > NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2
      || stdin.toString("utf8") !== request.stdinBytes
    )
  ) {
    stdin?.fill(0);
    return fail(
      "NODE_CLI_PROCESS_V2_INPUT_INVALID",
      "CLI transport stdin is not one bounded exact UTF-8 byte sequence",
    );
  }
  return Object.freeze({
    subcommandTokens: Object.freeze([...request.subcommandTokens]),
    argvSuffix: Object.freeze([...request.argvSuffix]),
    stdin,
    argvByteLength,
  });
}

type PrivateNodeCliProcessTerminationV2 =
  | Readonly<{
      status: "exited";
      exitCode: number;
      signal: null;
    }>
  | Readonly<{
      status: "signal_exit";
      exitCode: null;
      signal: string;
    }>
  | Readonly<{
      status: "platform_terminated";
      reason: "output_limit" | "timeout";
      exitCode: null;
      signal: "SIGKILL";
    }>;

export type PrivateNodeCliProcessResultV2 = Readonly<{
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pid: number;
  termination: PrivateNodeCliProcessTerminationV2;
  stdout: Buffer;
  stderr: Buffer;
  argvTokenCount: number;
  argvByteLength: number;
  stdinContentHash: string;
  stdinByteLength: number;
  environmentInstanceHash: string;
  normalizedEnvironmentHash:
    typeof NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2;
  sandboxExecutableContentHash: string;
  sandboxExecutablePhysicalIdentityHash: string;
  sandboxProfileHash: string;
}>;

type BoundedSpawnResultV2 = Readonly<{
  pid: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  forcedReason: "output_limit" | "timeout" | null;
  stdout: Buffer;
  stderr: Buffer;
}>;

function killProcessGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The complete group may already have exited.
    }
  }
}

function spawnBoundedNodeCliV2(input: Readonly<{
  sandboxExecutablePath: string;
  sandboxProfile: string;
  nodeExecutablePath: string;
  encodedBootstrapConfig: string;
  cwd: string;
  environment: NodeJS.ProcessEnv;
  transport: ReturnType<typeof exactTransportRequest>;
}>): Promise<BoundedSpawnResultV2> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.sandboxExecutablePath, [
      "-p",
      input.sandboxProfile,
      input.nodeExecutablePath,
      "-e",
      NODE_CLI_BOOTSTRAP_SOURCE_V2,
      input.encodedBootstrapConfig,
      ...input.transport.subcommandTokens,
      ...input.transport.argvSuffix,
    ], {
      cwd: input.cwd,
      detached: true,
      env: input.environment,
      shell: false,
      stdio: [
        input.transport.stdin === null ? "ignore" : "pipe",
        "pipe",
        "pipe",
      ],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const childStdout = child.stdout;
    const childStderr = child.stderr;
    const childStdin = child.stdin;
    if (
      childStdout === null
      || childStderr === null
      || (input.transport.stdin !== null && childStdin === null)
    ) {
      if (child.pid !== undefined) killProcessGroup(child.pid);
      reject(new PrivateNodeCliProcessErrorV2(
        "NODE_CLI_PROCESS_V2_SPAWN_FAILED",
        "Authenticated Node CLI process did not expose its fixed stdio pipes",
      ));
      return;
    }
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let forcedReason: "output_limit" | "timeout" | null = null;
    let spawnFailure: unknown;
    let closed = false;
    const appendBounded = (
      chunks: Buffer[],
      chunk: Buffer,
      observedBytes: number,
    ): number => {
      const remaining = NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2
        - Math.min(observedBytes, NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2);
      if (remaining > 0) chunks.push(Buffer.from(chunk.subarray(0, remaining)));
      return observedBytes + chunk.byteLength;
    };
    const terminate = (reason: "output_limit" | "timeout"): void => {
      if (closed || forcedReason !== null) return;
      forcedReason = reason;
      if (child.pid !== undefined) killProcessGroup(child.pid);
    };
    const timer = setTimeout(
      () => terminate("timeout"),
      NODE_CLI_LAUNCH_TIMEOUT_MS_V2,
    );
    child.once("error", (error) => {
      spawnFailure = error;
      clearTimeout(timer);
      if (child.pid !== undefined) killProcessGroup(child.pid);
    });
    childStdout.on("data", (chunk: Buffer) => {
      stdoutBytes = appendBounded(stdoutChunks, chunk, stdoutBytes);
      if (stdoutBytes > NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2) {
        terminate("output_limit");
      }
    });
    childStderr.on("data", (chunk: Buffer) => {
      stderrBytes = appendBounded(stderrChunks, chunk, stderrBytes);
      if (stderrBytes > NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2) {
        terminate("output_limit");
      }
    });
    if (input.transport.stdin !== null) {
      childStdin!.once("error", () => {
        // EPIPE is part of the observed child behavior, not launch authority.
      });
      childStdin!.end(input.transport.stdin);
    }
    child.once("close", (exitCode, signal) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      if (child.pid !== undefined) killProcessGroup(child.pid);
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      if (spawnFailure !== undefined || child.pid === undefined) {
        stdout.fill(0);
        stderr.fill(0);
        reject(new PrivateNodeCliProcessErrorV2(
          "NODE_CLI_PROCESS_V2_SPAWN_FAILED",
          "Authenticated Node CLI process could not start",
          { cause: spawnFailure },
        ));
        return;
      }
      resolve(Object.freeze({
        pid: child.pid,
        exitCode,
        signal,
        forcedReason,
        stdout,
        stderr,
      }));
    });
  });
}

/**
 * @internal Executes one already-authorized private candidate context. Absolute
 * locators never enter its result.
 */
export async function executePrivateNodeCliProcessV2(input: Readonly<{
  bundleRoot: string;
  modulePath: string;
  moduleContentHash: string;
  nodeExecutablePath: string;
  request: CliEncodedInvocationRequestV2;
}>): Promise<PrivateNodeCliProcessResultV2> {
  const transport = exactTransportRequest(input.request);
  let scratchRoot: string | undefined;
  let capturedProcess: BoundedSpawnResultV2 | undefined;
  try {
    const sandboxBefore =
      await acquireNetworkSandboxLaunchContextInternalV2();
    scratchRoot = realpathSync(
      mkdtempSync(path.join(tmpdir(), "setfarm-node-cli-launch-v2-")),
    );
    const runHome = path.join(scratchRoot, "home");
    const runTmp = path.join(scratchRoot, "tmp");
    const runCache = path.join(scratchRoot, "cache");
    for (const directory of [runHome, runTmp, runCache]) {
      mkdirSync(directory, { mode: 0o700 });
    }
    const environment = Object.freeze({
      CI: "true",
      HOME: runHome,
      HOST: "127.0.0.1",
      LANG: "C.UTF-8",
      LC_ALL: "C.UTF-8",
      NO_COLOR: "1",
      PORT: "0",
      RUNTIME_URL: "http://127.0.0.1:0",
      RUN_CACHE_DIR: runCache,
      RUN_HOME: runHome,
      RUN_TMPDIR: runTmp,
      TEMP: runTmp,
      TMP: runTmp,
      TMPDIR: runTmp,
      TZ: "UTC",
    });
    if (
      JSON.stringify(Object.keys(environment).sort())
        !== JSON.stringify(
          [...NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2].sort(),
        )
    ) {
      return fail(
        "NODE_CLI_PROCESS_V2_INPUT_INVALID",
        "Code-owned CLI environment no longer equals its normalized allowlist",
      );
    }
    const environmentInstanceHash = hashCanonicalJson({
      schema: "setfarm.node-cli-environment-instance.v2",
      environment,
    });
    const encodedBootstrapConfig = Buffer.from(JSON.stringify({
      schema: "setfarm.node-cli-bootstrap-config.v2",
      bundleRoot: input.bundleRoot,
      modulePath: input.modulePath,
      moduleContentHash: input.moduleContentHash,
      environment,
    }), "utf8").toString("base64url");
    const started = Date.now();
    capturedProcess = await spawnBoundedNodeCliV2({
      sandboxExecutablePath: sandboxBefore.sandboxExecutablePath,
      sandboxProfile: sandboxBefore.sandboxProfile,
      nodeExecutablePath: input.nodeExecutablePath,
      encodedBootstrapConfig,
      cwd: input.bundleRoot,
      environment,
      transport,
    });
    const child = capturedProcess;
    const finished = Date.now();
    const sandboxAfter =
      await acquireNetworkSandboxLaunchContextInternalV2();
    if (
      sandboxAfter.sandboxExecutableContentHash
        !== sandboxBefore.sandboxExecutableContentHash
      || sandboxAfter.sandboxExecutablePhysicalIdentityHash
        !== sandboxBefore.sandboxExecutablePhysicalIdentityHash
      || sandboxAfter.sandboxProfileHash !== sandboxBefore.sandboxProfileHash
    ) {
      child.stdout.fill(0);
      child.stderr.fill(0);
      return fail(
        "NODE_CLI_PROCESS_V2_HOST_DRIFT",
        "Network sandbox authority changed across candidate execution",
      );
    }
    const termination: PrivateNodeCliProcessTerminationV2 =
      child.forcedReason !== null
      ? Object.freeze({
          status: "platform_terminated" as const,
          reason: child.forcedReason,
          exitCode: null,
          signal: "SIGKILL" as const,
        })
      : child.exitCode !== null
      ? Object.freeze({
          status: "exited" as const,
          exitCode: child.exitCode,
          signal: null,
        })
      : Object.freeze({
          status: "signal_exit" as const,
          exitCode: null,
          signal: child.signal ?? "SIGUNKNOWN",
        });
    return Object.freeze({
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      pid: child.pid,
      termination,
      stdout: child.stdout,
      stderr: child.stderr,
      argvTokenCount:
        transport.subcommandTokens.length + transport.argvSuffix.length,
      argvByteLength: transport.argvByteLength,
      stdinContentHash: sha256(transport.stdin ?? Buffer.alloc(0)),
      stdinByteLength: transport.stdin?.byteLength ?? 0,
      environmentInstanceHash,
      normalizedEnvironmentHash:
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      sandboxExecutableContentHash:
        sandboxBefore.sandboxExecutableContentHash,
      sandboxExecutablePhysicalIdentityHash:
        sandboxBefore.sandboxExecutablePhysicalIdentityHash,
      sandboxProfileHash: sandboxBefore.sandboxProfileHash,
    });
  } catch (error) {
    capturedProcess?.stdout.fill(0);
    capturedProcess?.stderr.fill(0);
    if (
      error instanceof PrivateNodeCliProcessErrorV2
      || (
        error !== null
        && typeof error === "object"
        && "code" in error
        && typeof error.code === "string"
        && error.code.startsWith("NETWORK_ISOLATION_V2_")
      )
    ) {
      throw error;
    }
    return fail(
      "NODE_CLI_PROCESS_V2_SPAWN_FAILED",
      "Private Node CLI execution failed at one typed platform boundary",
      error,
    );
  } finally {
    transport.stdin?.fill(0);
    if (scratchRoot !== undefined) {
      try {
        rmSync(scratchRoot, { force: true, recursive: true });
      } catch (error) {
        capturedProcess?.stdout.fill(0);
        capturedProcess?.stderr.fill(0);
        throw new PrivateNodeCliProcessErrorV2(
          "NODE_CLI_PROCESS_V2_CLEANUP_FAILED",
          "Private Node CLI scratch allocation could not be destroyed",
          { cause: error },
        );
      }
    }
  }
}
