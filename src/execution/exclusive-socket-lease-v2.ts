import {
  fork,
  spawn,
  type ChildProcess,
} from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { request as httpRequest } from "node:http";
import {
  createServer,
  type Server,
} from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { isProxy } from "node:util/types";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type {
  HttpEncodedInvocationRequestV2,
} from "../product-compiler/invocation-input-transport-v2.js";
import { observeProcessIdentity } from "./process-identity.js";
import {
  EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA,
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
  SERVICE_READINESS_RECEIPT_V2_SCHEMA,
  SOCKET_CLEANUP_RECEIPT_V2_SCHEMA,
  SOCKET_CLEANUP_TIMEOUT_MS_V2,
  SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA,
  SOCKET_HANDOFF_TIMEOUT_MS_V2,
  SOCKET_READINESS_MAX_RESPONSE_BYTES_V2,
  SOCKET_READINESS_TIMEOUT_MS_V2,
  SocketLaunchBindingV2Schema,
  hashExclusiveSocketLeaseV2,
  hashServiceReadinessReceiptV2,
  hashSocketCleanupReceiptV2,
  hashSocketHandoffAcknowledgementV2,
  hashSocketLaunchBindingV2,
  hashSocketProcessIdentityV2,
  parseExclusiveSocketLeaseReceiptV2,
  parseServiceReadinessReceiptV2,
  parseSocketCleanupReceiptV2,
  parseSocketHandoffAcknowledgementV2,
  type ExclusiveSocketEndpointV2,
  type ExclusiveSocketLeaseReceiptV2,
  type ServiceReadinessReceiptHashPayloadV2,
  type ServiceReadinessReceiptV2,
  type SocketCleanupReceiptHashPayloadV2,
  type SocketCleanupReceiptV2,
  type SocketHandoffAcknowledgementHashPayloadV2,
  type SocketHandoffAcknowledgementV2,
  type SocketLaunchBindingV2,
} from "./schemas/exclusive-socket-lease-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
} from "./schemas/network-isolation-negative-probe-v2.js";
import {
  sameProcessIdentity,
  type ProcessIdentityV1,
} from "./schemas/process-identity-v1.js";

const SOCKET_HANDOFF_TEST_CHILD_SOURCE_V2 = String.raw`
const crypto = require("node:crypto");
const http = require("node:http");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const exactKeys = (value, expected) => (
  value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === [...expected].sort().join(",")
);
const send = (message, callback) => {
  if (typeof process.send !== "function") process.exit(121);
  process.send(message, callback);
};
const fail = (code) => {
  try {
    send({
      schema: "setfarm.socket-test-child-failure.v2",
      code: String(code).slice(0, 500),
    }, () => process.exit(122));
  } catch {
    process.exit(123);
  }
};

delete process.env.__CF_USER_TEXT_ENCODING;
const expectedEnvironmentNames = [
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "NO_COLOR",
  "TEMP",
  "TMP",
  "TMPDIR",
  "TZ",
];
if (
  JSON.stringify(Object.keys(process.env).sort())
    !== JSON.stringify(expectedEnvironmentNames)
  || process.env.CI !== "true"
  || process.env.LANG !== "C.UTF-8"
  || process.env.LC_ALL !== "C.UTF-8"
  || process.env.NO_COLOR !== "1"
  || process.env.TZ !== "UTC"
  || !process.env.HOME
  || process.env.HOME !== process.env.TEMP
  || process.env.HOME !== process.env.TMP
  || process.env.HOME !== process.env.TMPDIR
) {
  fail("SOCKET_CHILD_ENVIRONMENT_NOT_EXACT");
}

let heldServer;
let activeLeaseHash;
let cleanupConsumed = false;
let readinessRequestCount = 0;

process.on("message", (message, receivedHandle) => {
  Promise.resolve().then(() => {
    if (message && message.schema === "setfarm.socket-test-handoff-command.v2") {
      if (
        heldServer
        || !exactKeys(message, [
          "descriptorCapabilityHash",
          "endpoint",
          "handoffNonce",
          "handoffNonceHash",
          "launchBindingHash",
          "leaseHash",
          "readinessNonce",
          "readinessNonceHash",
          "schema",
        ])
        || typeof message.handoffNonce !== "string"
        || sha256(message.handoffNonce) !== message.handoffNonceHash
        || typeof message.readinessNonce !== "string"
        || sha256(message.readinessNonce) !== message.readinessNonceHash
        || !receivedHandle
        || typeof receivedHandle.on !== "function"
        || receivedHandle.listening !== true
      ) {
        throw new Error("SOCKET_CHILD_HANDOFF_INVALID");
      }
      const address = receivedHandle.address();
      if (
        !address
        || typeof address === "string"
        || address.address !== message.endpoint.host
        || address.family !== message.endpoint.family
        || address.port !== message.endpoint.port
      ) {
        throw new Error("SOCKET_CHILD_ENDPOINT_MISMATCH");
      }
      heldServer = receivedHandle;
      activeLeaseHash = message.leaseHash;
      const readinessPath =
        "/.setfarm/readiness-v2/" + message.readinessNonce;
      const httpServer = http.createServer((request, response) => {
        readinessRequestCount += 1;
        if (
          readinessRequestCount !== 1
          || request.method !== "GET"
          || request.url !== readinessPath
        ) {
          response.writeHead(404, {
            connection: "close",
            "content-length": "0",
          });
          response.end();
          return;
        }
        const body = message.readinessNonce;
        response.writeHead(200, {
          connection: "close",
          "content-type": "text/plain; charset=utf-8",
          "content-length": String(Buffer.byteLength(body, "utf8")),
        });
        response.end(body, () => {
          send({
            schema: "setfarm.socket-test-readiness-observation.v2",
            leaseHash: activeLeaseHash,
            readinessNonceHash: message.readinessNonceHash,
            requestCount: readinessRequestCount,
            responseCommitted: true,
          });
        });
      });
      heldServer.on("connection", (socket) => {
        httpServer.emit("connection", socket);
      });
      send({
        schema: "setfarm.socket-test-handoff-ack.v2",
        leaseHash: message.leaseHash,
        descriptorCapabilityHash: message.descriptorCapabilityHash,
        handoffNonceHash: message.handoffNonceHash,
        launchBindingHash: message.launchBindingHash,
        endpoint: message.endpoint,
        childPid: process.pid,
        receivedHandle: true,
        listening: heldServer.listening,
        candidateListen: "forbidden",
      });
      return;
    }
    if (message && message.schema === "setfarm.socket-test-cleanup-command.v2") {
      if (
        cleanupConsumed
        || !heldServer
        || !exactKeys(message, [
          "cleanupNonce",
          "cleanupNonceHash",
          "leaseHash",
          "schema",
        ])
        || message.leaseHash !== activeLeaseHash
        || typeof message.cleanupNonce !== "string"
        || sha256(message.cleanupNonce) !== message.cleanupNonceHash
      ) {
        throw new Error("SOCKET_CHILD_CLEANUP_INVALID");
      }
      cleanupConsumed = true;
      heldServer.close((error) => {
        if (error) {
          fail("SOCKET_CHILD_CLOSE_FAILED");
          return;
        }
        send({
          schema: "setfarm.socket-test-cleanup-ack.v2",
          leaseHash: activeLeaseHash,
          cleanupNonceHash: message.cleanupNonceHash,
          readinessRequestCount,
          serverCloseCallback: "completed",
        }, () => {
          if (process.connected) process.disconnect();
          process.exit(0);
        });
      });
      return;
    }
    throw new Error("SOCKET_CHILD_MESSAGE_UNSUPPORTED");
  }).catch((error) => fail(
    error && error.message ? error.message : "SOCKET_CHILD_FAILED",
  ));
});
`;

export const SOCKET_HANDOFF_TEST_CHILD_PROGRAM_HASH_V2 = createHash("sha256")
  .update(SOCKET_HANDOFF_TEST_CHILD_SOURCE_V2)
  .digest("hex");

export const SOCKET_HANDOFF_TEST_HANDLER_ABI_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.socket-handoff-test-handler-abi.v2",
  method: "GET",
  path: "/.setfarm/readiness-v2/{oneUseNonce}",
  successStatus: 200,
  contentType: "text/plain; charset=utf-8",
  response: "exact_one_use_nonce",
  candidateListen: "forbidden",
});

const SOCKET_HANDOFF_TEST_LAUNCH_BINDING_IDENTITY_V2 = Object.freeze({
  launcherRef: "LAUNCH_SOCKET_HANDOFF_TEST_FIXTURE_V2" as const,
  launcherModuleHash: SOCKET_HANDOFF_TEST_CHILD_PROGRAM_HASH_V2,
  applicationModuleLocator: "fixtures/socket-handoff-test-child-v2.js",
  applicationModuleHash: SOCKET_HANDOFF_TEST_CHILD_PROGRAM_HASH_V2,
  applicationExport: "handleReadinessProbeV2",
  handlerAbiHash: SOCKET_HANDOFF_TEST_HANDLER_ABI_HASH_V2,
});

export const SOCKET_HANDOFF_TEST_LAUNCH_BINDING_V2 =
  Object.freeze(SocketLaunchBindingV2Schema.parse({
    ...SOCKET_HANDOFF_TEST_LAUNCH_BINDING_IDENTITY_V2,
    bindingHash: hashSocketLaunchBindingV2(
      SOCKET_HANDOFF_TEST_LAUNCH_BINDING_IDENTITY_V2,
    ),
  }));

export type ExclusiveSocketLeaseErrorCodeV2 =
  | "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED"
  | "EXCLUSIVE_SOCKET_V2_STATE_INVALID"
  | "EXCLUSIVE_SOCKET_V2_ALLOCATOR_IDENTITY_UNAVAILABLE"
  | "EXCLUSIVE_SOCKET_V2_BIND_FAILED"
  | "EXCLUSIVE_SOCKET_V2_DESCRIPTOR_UNAVAILABLE"
  | "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED"
  | "EXCLUSIVE_SOCKET_V2_CHILD_IDENTITY_UNAVAILABLE"
  | "EXCLUSIVE_SOCKET_V2_HANDOFF_FAILED"
  | "EXCLUSIVE_SOCKET_V2_HANDOFF_TIMEOUT"
  | "EXCLUSIVE_SOCKET_V2_ACK_INVALID"
  | "EXCLUSIVE_SOCKET_V2_PARENT_CLOSE_FAILED"
  | "EXCLUSIVE_SOCKET_V2_READINESS_FAILED"
  | "EXCLUSIVE_SOCKET_V2_READINESS_TIMEOUT"
  | "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED"
  | "EXCLUSIVE_SOCKET_V2_REQUEST_TIMEOUT"
  | "EXCLUSIVE_SOCKET_V2_RESPONSE_LIMIT"
  | "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED"
  | "EXCLUSIVE_SOCKET_V2_CLEANUP_TIMEOUT"
  | "EXCLUSIVE_SOCKET_V2_CHILD_OUTPUT"
  | "EXCLUSIVE_SOCKET_V2_PORT_RELEASE_UNPROVEN";

export class ExclusiveSocketLeaseErrorV2 extends Error {
  readonly code: ExclusiveSocketLeaseErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: ExclusiveSocketLeaseErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "ExclusiveSocketLeaseErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: ExclusiveSocketLeaseErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new ExclusiveSocketLeaseErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomNonceV2(): string {
  return randomBytes(32).toString("hex");
}

function exactDescriptor(server: Server): number {
  const descriptor = (
    server as Server & { _handle?: { fd?: unknown } }
  )._handle?.fd;
  if (!Number.isInteger(descriptor) || Number(descriptor) < 0) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_DESCRIPTOR_UNAVAILABLE",
      "Held socket did not expose one exact runtime-pinned descriptor",
    );
  }
  return Number(descriptor);
}

function exactEndpoint(server: Server): ExclusiveSocketEndpointV2 {
  const address = server.address();
  if (
    !address
    || typeof address === "string"
    || address.address !== "127.0.0.1"
    || address.family !== "IPv4"
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_BIND_FAILED",
      "Held socket did not bind one exact IPv4 loopback endpoint",
    );
  }
  return Object.freeze({
    transport: "tcp",
    host: "127.0.0.1",
    family: "IPv4",
    port: address.port,
    exclusive: true,
    reusePort: false,
  });
}

type SocketLeaseStatusV2 =
  | "bound"
  | "sent"
  | "acknowledged"
  | "ready"
  | "closing"
  | "closed"
  | "failed"
  | "destroyed";

type ChildOutputStateV2 = {
  stdoutBytes: number;
  stderrBytes: number;
};

type SocketChildProtocolV2 = Readonly<{
  kind: "test_fixture" | "node_express_api_v2";
  handoffCommandSchema: string;
  handoffAcknowledgementSchema: string;
  readinessObservationSchema: string;
  cleanupCommandSchema: string;
  cleanupAcknowledgementSchema: string;
  failureSchema?: string;
  expectedApplicationRequestCount: 0 | 1;
}>;

const SOCKET_TEST_CHILD_PROTOCOL_V2 = Object.freeze({
  kind: "test_fixture" as const,
  handoffCommandSchema: "setfarm.socket-test-handoff-command.v2",
  handoffAcknowledgementSchema: "setfarm.socket-test-handoff-ack.v2",
  readinessObservationSchema:
    "setfarm.socket-test-readiness-observation.v2",
  cleanupCommandSchema: "setfarm.socket-test-cleanup-command.v2",
  cleanupAcknowledgementSchema: "setfarm.socket-test-cleanup-ack.v2",
  expectedApplicationRequestCount: 0 as const,
});

const SOCKET_NODE_EXPRESS_API_CHILD_PROTOCOL_V2 = Object.freeze({
  kind: "node_express_api_v2" as const,
  handoffCommandSchema:
    "setfarm.socket-node-express-api-handoff-command.v2",
  handoffAcknowledgementSchema:
    "setfarm.socket-node-express-api-handoff-ack.v2",
  readinessObservationSchema:
    "setfarm.socket-node-express-api-readiness-observation.v2",
  cleanupCommandSchema:
    "setfarm.socket-node-express-api-cleanup-command.v2",
  cleanupAcknowledgementSchema:
    "setfarm.socket-node-express-api-cleanup-ack.v2",
  failureSchema: "setfarm.socket-node-express-api-failure.v2",
  expectedApplicationRequestCount: 1 as const,
});

type ObservedProcessIdentityV2 = ProcessIdentityV1 & {
  source: "observed_os";
};

function observedProcessIdentityV2(
  identity: ProcessIdentityV1 | undefined,
): ObservedProcessIdentityV2 | undefined {
  if (!identity || identity.source !== "observed_os") return undefined;
  return {
    ...identity,
    source: "observed_os",
  };
}

type ExclusiveSocketLeaseStateV2 = {
  admissionScope: "test_fixture";
  status: SocketLeaseStatusV2;
  server: Server;
  descriptor: number;
  endpoint: ExclusiveSocketEndpointV2;
  allocatorProcess: ObservedProcessIdentityV2;
  attemptNonce: string;
  descriptorCapabilityHash: string;
  receipt: ExclusiveSocketLeaseReceiptV2;
  unexpectedParentConnections: number;
  child?: ChildProcess;
  childProcess?: ObservedProcessIdentityV2;
  childOutput?: ChildOutputStateV2;
  scratchRoot?: string;
  handoffNonce?: string;
  readinessNonce?: string;
  cleanupNonce?: string;
  launchBinding?: SocketLaunchBindingV2;
  acknowledgement?: SocketHandoffAcknowledgementV2;
  readiness?: ServiceReadinessReceiptV2;
  childProtocol?: SocketChildProtocolV2;
  detachedProcessGroup?: boolean;
  applicationRequestConsumed?: boolean;
  environmentInstanceHash?: string;
};

const leaseConstructorCapabilityV2 = Object.freeze({});
const leaseStateV2 = new WeakMap<object, ExclusiveSocketLeaseStateV2>();

export class ExclusiveSocketLeaseV2 {
  readonly admissionScope: "test_fixture";
  readonly leaseHash: string;

  constructor(
    capability: object,
    state: ExclusiveSocketLeaseStateV2,
  ) {
    if (capability !== leaseConstructorCapabilityV2) {
      throw new ExclusiveSocketLeaseErrorV2(
        "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED",
        "Exclusive socket lease constructor capability is unavailable",
      );
    }
    this.admissionScope = state.admissionScope;
    this.leaseHash = state.receipt.leaseHash;
    leaseStateV2.set(this, state);
    Object.freeze(this);
  }
}

function authenticLeaseV2(
  lease: ExclusiveSocketLeaseV2,
): ExclusiveSocketLeaseStateV2 {
  if (
    typeof lease !== "object"
    || lease === null
    || isProxy(lease)
    || Object.getPrototypeOf(lease) !== ExclusiveSocketLeaseV2.prototype
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED",
      "Socket lifecycle requires one authentic private lease",
    );
  }
  const state = leaseStateV2.get(lease);
  if (!state) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_AUTHORITY_UNAUTHENTICATED",
      "Socket lifecycle requires one authentic private lease",
    );
  }
  return state;
}

function requireStateV2(
  state: ExclusiveSocketLeaseStateV2,
  expected: SocketLeaseStatusV2,
): void {
  if (state.status !== expected) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
      `Socket lifecycle expected ${expected} but observed ${state.status}`,
    );
  }
}

async function listenExclusiveV2(
  server: Server,
  port: number,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({
      host: "127.0.0.1",
      port,
      exclusive: true,
      reusePort: false,
    });
  });
}

async function closeServerV2(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function waitForChildCloseV2(
  child: ChildProcess,
  timeoutMs: number,
): Promise<Readonly<{ exitCode: number | null; signal: NodeJS.Signals | null }>> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Object.freeze({
      exitCode: child.exitCode,
      signal: child.signalCode,
    });
  }
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new ExclusiveSocketLeaseErrorV2(
        "EXCLUSIVE_SOCKET_V2_CLEANUP_TIMEOUT",
        "Socket child did not exit inside the cleanup timeout",
      ));
    }, timeoutMs);
    const cleanup = (): void => {
      clearTimeout(timer);
      child.off("close", onClose);
      child.off("error", onError);
    };
    const onClose = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      cleanup();
      resolve(Object.freeze({ exitCode, signal }));
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    child.once("close", onClose);
    child.once("error", onError);
  });
}

function killChildProcessV2(
  child: ChildProcess,
  detachedProcessGroup: boolean,
): void {
  if (child.pid === undefined) return;
  if (detachedProcessGroup) {
    try {
      process.kill(-child.pid, "SIGKILL");
      return;
    } catch {
      // The group may already be gone; the exact child fallback is still safe.
    }
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // Forced cleanup verifies termination separately.
  }
}

async function forceDisposeStateV2(
  state: ExclusiveSocketLeaseStateV2,
): Promise<void> {
  const failures: unknown[] = [];
  try {
    await closeServerV2(state.server);
  } catch (error) {
    failures.push(error);
  }
  if (state.child && state.child.exitCode === null) {
    try {
      killChildProcessV2(
        state.child,
        state.detachedProcessGroup === true,
      );
      await waitForChildCloseV2(state.child, 1_000);
    } catch (error) {
      failures.push(error);
    }
  }
  if (state.scratchRoot) {
    try {
      rmSync(state.scratchRoot, { recursive: true, force: false });
      state.scratchRoot = undefined;
    } catch (error) {
      failures.push(error);
    }
  }
  state.attemptNonce = "";
  state.handoffNonce = undefined;
  state.readinessNonce = undefined;
  state.cleanupNonce = undefined;
  state.environmentInstanceHash = undefined;
  if (failures.length > 0) {
    throw new ExclusiveSocketLeaseErrorV2(
      "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED",
      "Socket lifecycle could not clean every privately owned resource",
      { cause: failures },
    );
  }
}

export type AcquiredExclusiveSocketLeaseV2 = Readonly<{
  status: "bound_test_fixture_socket";
  lease: ExclusiveSocketLeaseV2;
  receipt: ExclusiveSocketLeaseReceiptV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

export async function acquireExclusiveSocketLeaseInternalV2(): Promise<
  AcquiredExclusiveSocketLeaseV2
> {
  const allocatorProcess = observedProcessIdentityV2(
    observeProcessIdentity(process.pid),
  );
  if (!allocatorProcess) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_ALLOCATOR_IDENTITY_UNAVAILABLE",
      "Socket allocator process identity could not be observed",
    );
  }
  const server = createServer();
  let bound = false;
  try {
    await listenExclusiveV2(server, 0);
    bound = true;
    const endpoint = exactEndpoint(server);
    const descriptor = exactDescriptor(server);
    const attemptNonce = randomNonceV2();
    const allocatorProcessIdentityHash =
      hashSocketProcessIdentityV2(allocatorProcess);
    const descriptorCapabilityHash = hashCanonicalJson({
      schema: "setfarm.exclusive-socket-private-descriptor-capability.v2",
      endpoint,
      descriptor,
      allocatorProcessIdentityHash,
      attemptNonce,
    });
    const identity = {
      schema: EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState: "observed_unverified_release_candidate" as const,
      productionUse: "forbidden_until_verified_release_join" as const,
      admissionScope: "test_fixture" as const,
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      portBandsHash: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
      allocationPolicy: "os_ephemeral_test_fixture" as const,
      endpoint,
      allocatorProcess,
      allocatorProcessIdentityHash,
      attemptNonceHash: sha256(attemptNonce),
      descriptorCapabilityHash,
      boundAt: new Date().toISOString(),
      stateTransition: "unbound_to_bound" as const,
    };
    const receipt = parseExclusiveSocketLeaseReceiptV2({
      ...identity,
      leaseHash: hashExclusiveSocketLeaseV2(identity),
    });
    const state: ExclusiveSocketLeaseStateV2 = {
      admissionScope: "test_fixture",
      status: "bound",
      server,
      descriptor,
      endpoint,
      allocatorProcess,
      attemptNonce,
      descriptorCapabilityHash,
      receipt,
      unexpectedParentConnections: 0,
    };
    server.on("connection", (socket) => {
      state.unexpectedParentConnections += 1;
      socket.destroy();
    });
    const lease = new ExclusiveSocketLeaseV2(
      leaseConstructorCapabilityV2,
      state,
    );
    return Object.freeze({
      status: "bound_test_fixture_socket",
      lease,
      receipt,
      productionDisposition:
        "forbidden_until_verified_platform_release" as const,
    });
  } catch (error) {
    if (bound) {
      try {
        await closeServerV2(server);
      } catch {
        // The original typed bind/receipt error remains authoritative.
      }
    }
    if (error instanceof ExclusiveSocketLeaseErrorV2) throw error;
    return fail(
      "EXCLUSIVE_SOCKET_V2_BIND_FAILED",
      "Exclusive socket lease could not bind one held loopback server",
      error,
    );
  }
}

export async function acquireExclusiveSocketLeaseV2ForTest(): Promise<
  AcquiredExclusiveSocketLeaseV2
> {
  return await acquireExclusiveSocketLeaseInternalV2();
}

function exactChildEnvironmentV2(
  scratchRoot: string,
): NodeJS.ProcessEnv {
  return Object.freeze({
    CI: "true",
    HOME: scratchRoot,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    TEMP: scratchRoot,
    TMP: scratchRoot,
    TMPDIR: scratchRoot,
    TZ: "UTC",
  });
}

function observeChildOutputV2(child: ChildProcess): ChildOutputStateV2 {
  if (child.stdout === null || child.stderr === null) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED",
      "Socket child did not expose its fixed output pipes",
    );
  }
  const output: ChildOutputStateV2 = {
    stdoutBytes: 0,
    stderrBytes: 0,
  };
  child.stdout.on("data", (chunk: Buffer) => {
    output.stdoutBytes += chunk.byteLength;
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output.stderrBytes += chunk.byteLength;
  });
  return output;
}

function spawnTestChildV2(
  scratchRoot: string,
): Readonly<{
  child: ChildProcess;
  output: ChildOutputStateV2;
}> {
  let child: ChildProcess;
  try {
    child = fork("-e", [SOCKET_HANDOFF_TEST_CHILD_SOURCE_V2], {
      cwd: scratchRoot,
      env: exactChildEnvironmentV2(scratchRoot),
      execArgv: [],
      execPath: process.execPath,
      serialization: "json",
      silent: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
  } catch (error) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED",
      "Socket test child could not be spawned",
      error,
    );
  }
  const output = observeChildOutputV2(child);
  return Object.freeze({ child, output });
}

export type NodeExpressApiSocketLaunchContextInternalV2 = Readonly<{
  bundleRoot: string;
  modulePath: string;
  moduleContentHash: string;
  nodeExecutablePath: string;
  sandboxExecutablePath: string;
  sandboxExecutableContentHash: string;
  sandboxExecutablePhysicalIdentityHash: string;
  sandboxProfile: string;
  sandboxProfileHash: string;
  bootstrapSource: string;
  bootstrapSourceHash: string;
  launchBinding: SocketLaunchBindingV2;
}>;

type SpawnedNodeExpressApiChildInternalV2 = Readonly<{
  child: ChildProcess;
  output: ChildOutputStateV2;
  environmentInstanceHash: string;
}>;

function exactNodeExpressApiEnvironmentInternalV2(
  scratchRoot: string,
  endpoint: ExclusiveSocketEndpointV2,
): Readonly<NodeJS.ProcessEnv> {
  const runHome = path.join(scratchRoot, "home");
  const runTmp = path.join(scratchRoot, "tmp");
  const runCache = path.join(scratchRoot, "cache");
  for (const directory of [runHome, runTmp, runCache]) {
    mkdirSync(directory, { mode: 0o700 });
  }
  const environment = Object.freeze({
    CI: "true",
    HOME: runHome,
    HOST: endpoint.host,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    PORT: String(endpoint.port),
    RUNTIME_URL: `http://${endpoint.host}:${endpoint.port}`,
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
      "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED",
      "Code-owned API environment no longer equals its normalized allowlist",
    );
  }
  return environment;
}

function validateNodeExpressApiLaunchContextInternalV2(
  input: NodeExpressApiSocketLaunchContextInternalV2,
): SocketLaunchBindingV2 {
  const launchBinding = SocketLaunchBindingV2Schema.parse(
    structuredClone(input.launchBinding),
  );
  if (
    !path.isAbsolute(input.bundleRoot)
    || !path.isAbsolute(input.modulePath)
    || !path.isAbsolute(input.nodeExecutablePath)
    || !path.isAbsolute(input.sandboxExecutablePath)
    || realpathSync(input.bundleRoot) !== input.bundleRoot
    || realpathSync(input.modulePath) !== input.modulePath
    || realpathSync(input.nodeExecutablePath) !== input.nodeExecutablePath
    || realpathSync(input.sandboxExecutablePath)
      !== input.sandboxExecutablePath
    || input.modulePath !== path.join(input.bundleRoot, "application", "app.js")
    || !/^[a-f0-9]{64}$/u.test(input.moduleContentHash)
    || sha256(input.bootstrapSource) !== input.bootstrapSourceHash
    || launchBinding.launcherRef !== "LAUNCH_NODE_EXPRESS_API_V2"
    || launchBinding.launcherModuleHash !== input.bootstrapSourceHash
    || launchBinding.applicationModuleLocator
      !== "candidate-bundle/application/app.js"
    || launchBinding.applicationModuleHash !== input.moduleContentHash
    || launchBinding.applicationExport !== "setfarmHttpHandlerV2"
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED",
      "Node Express API launch context does not form one exact sealed child",
    );
  }
  return launchBinding;
}

function spawnNodeExpressApiChildInternalV2(
  state: ExclusiveSocketLeaseStateV2,
  input: NodeExpressApiSocketLaunchContextInternalV2,
): SpawnedNodeExpressApiChildInternalV2 {
  const environment = exactNodeExpressApiEnvironmentInternalV2(
    state.scratchRoot!,
    state.endpoint,
  );
  const environmentInstanceHash = hashCanonicalJson({
    schema: "setfarm.node-express-api-environment-instance.v2",
    environment,
  });
  const encodedBootstrapConfig = Buffer.from(JSON.stringify({
    schema: "setfarm.node-express-api-bootstrap-config.v2",
    bundleRoot: input.bundleRoot,
    modulePath: input.modulePath,
    moduleContentHash: input.moduleContentHash,
    maxRequestBodyBytes: 8 * 1024 * 1024,
    environment,
  }), "utf8").toString("base64url");
  let child: ChildProcess;
  try {
    child = spawn(input.sandboxExecutablePath, [
      "-p",
      input.sandboxProfile,
      input.nodeExecutablePath,
      "-e",
      input.bootstrapSource,
      encodedBootstrapConfig,
    ], {
      cwd: input.bundleRoot,
      detached: true,
      env: environment,
      shell: false,
      serialization: "json",
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
  } catch (error) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED",
      "Authenticated Node Express API child could not be spawned",
      error,
    );
  }
  return Object.freeze({
    child,
    output: observeChildOutputV2(child),
    environmentInstanceHash,
  });
}

async function observeChildIdentityV2(
  child: ChildProcess,
): Promise<ObservedProcessIdentityV2> {
  if (!child.pid) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_IDENTITY_UNAVAILABLE",
      "Socket child has no process identifier",
    );
  }
  const deadline = Date.now() + 1_000;
  while (Date.now() <= deadline) {
    const identity = observedProcessIdentityV2(
      observeProcessIdentity(child.pid),
    );
    if (identity) return identity;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return fail(
    "EXCLUSIVE_SOCKET_V2_CHILD_IDENTITY_UNAVAILABLE",
    "Socket child process identity could not be observed",
  );
}

function assertNoChildOutputV2(state: ExclusiveSocketLeaseStateV2): void {
  if (
    !state.childOutput
    || state.childOutput.stdoutBytes !== 0
    || state.childOutput.stderrBytes !== 0
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_OUTPUT",
      `Socket bootstrap emitted output outside its typed IPC contract: stdout=${state.childOutput?.stdoutBytes ?? -1}, stderr=${state.childOutput?.stderrBytes ?? -1}`,
    );
  }
}

async function waitForChildMessageV2(
  state: ExclusiveSocketLeaseStateV2,
  timeoutMs: number,
  timeoutCode:
    | "EXCLUSIVE_SOCKET_V2_HANDOFF_TIMEOUT"
    | "EXCLUSIVE_SOCKET_V2_READINESS_TIMEOUT"
    | "EXCLUSIVE_SOCKET_V2_CLEANUP_TIMEOUT",
): Promise<unknown> {
  const child = state.child;
  if (!child || child.exitCode !== null || !child.connected) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_HANDOFF_FAILED",
      "Socket child is not available for an authenticated IPC observation",
    );
  }
  assertNoChildOutputV2(state);
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new ExclusiveSocketLeaseErrorV2(
        timeoutCode,
        "Socket child observation exceeded its code-owned timeout",
      ));
    }, timeoutMs);
    const cleanup = (): void => {
      clearTimeout(timer);
      child.off("message", onMessage);
      child.off("error", onError);
      child.off("exit", onExit);
      child.stdout!.off("data", onOutput);
      child.stderr!.off("data", onOutput);
    };
    const onMessage = (message: unknown): void => {
      cleanup();
      resolve(message);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const onExit = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      cleanup();
      reject(new Error(`SOCKET_CHILD_EXITED:${exitCode}:${signal ?? "none"}`));
    };
    const onOutput = (): void => {
      cleanup();
      reject(new ExclusiveSocketLeaseErrorV2(
        "EXCLUSIVE_SOCKET_V2_CHILD_OUTPUT",
        `Socket bootstrap emitted output outside its typed IPC contract: stdout=${state.childOutput?.stdoutBytes ?? -1}, stderr=${state.childOutput?.stderrBytes ?? -1}`,
      ));
    };
    child.once("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
    child.stdout!.once("data", onOutput);
    child.stderr!.once("data", onOutput);
  });
}

function sendServerHandleV2(
  child: ChildProcess,
  message: object,
  server: Server,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      child.send(message, server, { keepOpen: true }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function sendControlMessageV2(
  child: ChildProcess,
  message: object,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      child.send(message, (error) => {
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function exactRecordKeysV2(
  input: unknown,
  keys: readonly string[],
): input is Record<string, unknown> {
  return input !== null
    && typeof input === "object"
    && !Array.isArray(input)
    && !isProxy(input)
    && Object.keys(input).sort().join(",") === [...keys].sort().join(",");
}

export type TestSocketHandoffResultV2 = Readonly<{
  status: "acknowledged_test_fixture_socket";
  acknowledgement: SocketHandoffAcknowledgementV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

type SocketHandoffOperationResultInternalV2 = Readonly<{
  acknowledgement: SocketHandoffAcknowledgementV2;
  environmentInstanceHash?: string;
}>;

async function handoffExclusiveSocketLeaseV2WithChildInternalV2(
  lease: ExclusiveSocketLeaseV2,
  input: Readonly<{
    protocol: SocketChildProtocolV2;
    launchBinding: SocketLaunchBindingV2;
    detachedProcessGroup: boolean;
    spawnChild: (
      state: ExclusiveSocketLeaseStateV2,
    ) => Readonly<{
      child: ChildProcess;
      output: ChildOutputStateV2;
      environmentInstanceHash?: string;
    }>;
  }>,
): Promise<SocketHandoffOperationResultInternalV2> {
  const state = authenticLeaseV2(lease);
  requireStateV2(state, "bound");
  state.status = "sent";
  try {
    state.scratchRoot = realpathSync(mkdtempSync(
      path.join(tmpdir(), "setfarm-socket-v2-"),
    ));
    const spawned = input.spawnChild(state);
    state.child = spawned.child;
    state.childOutput = spawned.output;
    state.childProtocol = input.protocol;
    state.detachedProcessGroup = input.detachedProcessGroup;
    state.applicationRequestConsumed = false;
    state.environmentInstanceHash = spawned.environmentInstanceHash;
    state.childProcess = await observeChildIdentityV2(spawned.child);
    state.handoffNonce = randomNonceV2();
    state.readinessNonce = randomNonceV2();
    state.launchBinding = input.launchBinding;
    const handoffNonceHash = sha256(state.handoffNonce);
    const readinessNonceHash = sha256(state.readinessNonce);
    const sentAt = new Date().toISOString();
    const commonMessage = {
      schema: input.protocol.handoffCommandSchema,
      leaseHash: state.receipt.leaseHash,
      descriptorCapabilityHash: state.descriptorCapabilityHash,
      handoffNonce: state.handoffNonce,
      handoffNonceHash,
      readinessNonce: state.readinessNonce,
      readinessNonceHash,
      endpoint: state.endpoint,
      launchBindingHash: state.launchBinding.bindingHash,
    };
    const message = input.protocol.kind === "node_express_api_v2"
      ? {
          ...commonMessage,
          launchBinding: state.launchBinding,
        }
      : commonMessage;
    const messagePromise = waitForChildMessageV2(
      state,
      SOCKET_HANDOFF_TIMEOUT_MS_V2,
      "EXCLUSIVE_SOCKET_V2_HANDOFF_TIMEOUT",
    );
    const [observed] = await Promise.all([
      messagePromise,
      sendServerHandleV2(spawned.child, message, state.server),
    ]);
    if (
      input.protocol.failureSchema !== undefined
      && exactRecordKeysV2(observed, ["code", "schema"])
      && observed.schema === input.protocol.failureSchema
      && typeof observed.code === "string"
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_HANDOFF_FAILED",
        `Socket child rejected authenticated handoff: ${observed.code}`,
      );
    }
    if (
      !exactRecordKeysV2(observed, [
        "candidateListen",
        "childPid",
        "descriptorCapabilityHash",
        "endpoint",
        "handoffNonceHash",
        "launchBindingHash",
        "leaseHash",
        "listening",
        "receivedHandle",
        "schema",
      ])
      || observed.schema !== input.protocol.handoffAcknowledgementSchema
      || observed.leaseHash !== state.receipt.leaseHash
      || observed.descriptorCapabilityHash !== state.descriptorCapabilityHash
      || observed.handoffNonceHash !== handoffNonceHash
      || observed.launchBindingHash !== state.launchBinding.bindingHash
      || JSON.stringify(observed.endpoint) !== JSON.stringify(state.endpoint)
      || observed.childPid !== state.childProcess.pid
      || observed.receivedHandle !== true
      || observed.listening !== true
      || observed.candidateListen !== "forbidden"
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_ACK_INVALID",
        "Socket child acknowledgement did not bind the exact held handle",
      );
    }
    const freshChildIdentity = observedProcessIdentityV2(
      observeProcessIdentity(state.childProcess.pid),
    );
    if (
      !freshChildIdentity
      || !sameProcessIdentity(state.childProcess, freshChildIdentity)
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_CHILD_IDENTITY_UNAVAILABLE",
        "Socket child identity drifted before acknowledgement",
      );
    }
    const acknowledgedAt = new Date().toISOString();
    const identity: SocketHandoffAcknowledgementHashPayloadV2 = {
      schema: SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: "test_fixture",
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      leaseHash: state.receipt.leaseHash,
      descriptorCapabilityHash: state.descriptorCapabilityHash,
      endpoint: state.endpoint,
      handoffNonceHash,
      sentAt,
      acknowledgedAt,
      sendObservation: {
        transport: "node_ipc_server_handle",
        keepParentOpenThroughAcknowledgement: true,
        sendCallbackAuthority: "forbidden",
      },
      childProcess: freshChildIdentity,
      childProcessIdentityHash:
        hashSocketProcessIdentityV2(freshChildIdentity),
      launchBinding: state.launchBinding,
      listenerObservation: {
        receivedHandle: true,
        addressMatchesLease: true,
        listening: true,
        candidateListen: "forbidden",
      },
      stateTransitions: [
        "bound_to_sent",
        "sent_to_acknowledged",
      ],
    };
    state.acknowledgement = parseSocketHandoffAcknowledgementV2({
      ...identity,
      acknowledgementHash:
        hashSocketHandoffAcknowledgementV2(identity),
    });
    try {
      await closeServerV2(state.server);
    } catch (error) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_PARENT_CLOSE_FAILED",
        "Parent socket copy did not close after authenticated acknowledgement",
        error,
      );
    }
    if (
      state.server.listening
      || state.unexpectedParentConnections !== 0
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_PARENT_CLOSE_FAILED",
        "Parent retained or consumed socket authority after acknowledgement",
      );
    }
    state.status = "acknowledged";
    assertNoChildOutputV2(state);
    return Object.freeze({
      acknowledgement: state.acknowledgement,
      environmentInstanceHash: state.environmentInstanceHash,
    });
  } catch (error) {
    state.status = "failed";
    try {
      await forceDisposeStateV2(state);
    } catch (cleanupError) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED",
        "Socket handoff failed and private cleanup also failed",
        { error, cleanupError },
      );
    }
    if (error instanceof ExclusiveSocketLeaseErrorV2) throw error;
    return fail(
      "EXCLUSIVE_SOCKET_V2_HANDOFF_FAILED",
      "Socket server-handle handoff failed",
      error,
    );
  }
}

export async function handoffExclusiveSocketLeaseV2ToTestChild(
  lease: ExclusiveSocketLeaseV2,
): Promise<TestSocketHandoffResultV2> {
  const result = await handoffExclusiveSocketLeaseV2WithChildInternalV2(
    lease,
    {
      protocol: SOCKET_TEST_CHILD_PROTOCOL_V2,
      launchBinding: SOCKET_HANDOFF_TEST_LAUNCH_BINDING_V2,
      detachedProcessGroup: false,
      spawnChild: (state) => spawnTestChildV2(state.scratchRoot!),
    },
  );
  return Object.freeze({
    status: "acknowledged_test_fixture_socket",
    acknowledgement: result.acknowledgement,
    productionDisposition:
      "forbidden_until_verified_platform_release" as const,
  });
}

export type NodeExpressApiSocketHandoffResultInternalV2 = Readonly<{
  status: "acknowledged_node_express_api_socket";
  leaseReceipt: ExclusiveSocketLeaseReceiptV2;
  acknowledgement: SocketHandoffAcknowledgementV2;
  environmentInstanceHash: string;
  normalizedEnvironmentHash:
    typeof NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

export async function handoffExclusiveSocketLeaseV2ToNodeExpressApiInternalV2(
  lease: ExclusiveSocketLeaseV2,
  context: NodeExpressApiSocketLaunchContextInternalV2,
): Promise<NodeExpressApiSocketHandoffResultInternalV2> {
  const launchBinding =
    validateNodeExpressApiLaunchContextInternalV2(context);
  const result = await handoffExclusiveSocketLeaseV2WithChildInternalV2(
    lease,
    {
      protocol: SOCKET_NODE_EXPRESS_API_CHILD_PROTOCOL_V2,
      launchBinding,
      detachedProcessGroup: true,
      spawnChild: (state) =>
        spawnNodeExpressApiChildInternalV2(state, context),
    },
  );
  if (result.environmentInstanceHash === undefined) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_CHILD_SPAWN_FAILED",
      "Node Express API handoff lost its exact environment identity",
    );
  }
  const state = authenticLeaseV2(lease);
  return Object.freeze({
    status: "acknowledged_node_express_api_socket",
    leaseReceipt: state.receipt,
    acknowledgement: result.acknowledgement,
    environmentInstanceHash: result.environmentInstanceHash,
    normalizedEnvironmentHash:
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    productionDisposition:
      "forbidden_until_verified_platform_release" as const,
  });
}

type ReadinessHttpObservationV2 = Readonly<{
  statusCode: number;
  contentType: string | undefined;
  body: Buffer;
}>;

function requestReadinessV2(
  endpoint: ExclusiveSocketEndpointV2,
  readinessNonce: string,
): Promise<ReadinessHttpObservationV2> {
  return new Promise((resolve, reject) => {
    const operation = httpRequest({
      host: endpoint.host,
      port: endpoint.port,
      method: "GET",
      path: `/.setfarm/readiness-v2/${readinessNonce}`,
      headers: { connection: "close" },
    }, (response) => {
      const chunks: Buffer[] = [];
      let byteLength = 0;
      response.on("data", (chunk: Buffer) => {
        byteLength += chunk.byteLength;
        if (byteLength > SOCKET_READINESS_MAX_RESPONSE_BYTES_V2) {
          response.destroy(new Error("SOCKET_READINESS_RESPONSE_LIMIT"));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.once("error", reject);
      response.once("end", () => resolve(Object.freeze({
        statusCode: response.statusCode ?? 0,
        contentType: Array.isArray(response.headers["content-type"])
          ? undefined
          : response.headers["content-type"],
        body: Buffer.concat(chunks),
      })));
    });
    operation.setTimeout(SOCKET_READINESS_TIMEOUT_MS_V2, () => {
      operation.destroy(new ExclusiveSocketLeaseErrorV2(
        "EXCLUSIVE_SOCKET_V2_READINESS_TIMEOUT",
        "Socket readiness HTTP observation timed out",
      ));
    });
    operation.once("error", reject);
    operation.end();
  });
}

export type TestSocketReadinessResultV2 = Readonly<{
  status: "ready_test_fixture_socket";
  receipt: ServiceReadinessReceiptV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

async function observeExclusiveSocketServiceReadinessInternalV2(
  lease: ExclusiveSocketLeaseV2,
): Promise<ServiceReadinessReceiptV2> {
  const state = authenticLeaseV2(lease);
  requireStateV2(state, "acknowledged");
  try {
    const child = state.child!;
    const childProcess = state.childProcess!;
    const readinessNonce = state.readinessNonce!;
    const readinessNonceHash = sha256(readinessNonce);
    const started = Date.now();
    const messagePromise = waitForChildMessageV2(
      state,
      SOCKET_READINESS_TIMEOUT_MS_V2,
      "EXCLUSIVE_SOCKET_V2_READINESS_TIMEOUT",
    );
    const [http, observed] = await Promise.all([
      requestReadinessV2(state.endpoint, readinessNonce),
      messagePromise,
    ]);
    const responseText = http.body.toString("utf8");
    if (
      http.statusCode !== 200
      || http.contentType !== "text/plain; charset=utf-8"
      || http.body.byteLength !== 64
      || responseText !== readinessNonce
      || !exactRecordKeysV2(observed, [
        "leaseHash",
        "readinessNonceHash",
        "requestCount",
        "responseCommitted",
        "schema",
      ])
      || observed.schema
        !== state.childProtocol?.readinessObservationSchema
      || observed.leaseHash !== state.receipt.leaseHash
      || observed.readinessNonceHash !== readinessNonceHash
      || observed.requestCount !== 1
      || observed.responseCommitted !== true
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_READINESS_FAILED",
        "Socket child failed exact HTTP and IPC readiness agreement",
      );
    }
    const freshChildIdentity = observedProcessIdentityV2(
      observeProcessIdentity(childProcess.pid),
    );
    if (
      !freshChildIdentity
      || !sameProcessIdentity(childProcess, freshChildIdentity)
      || child.exitCode !== null
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_READINESS_FAILED",
        "Socket child identity drifted during readiness",
      );
    }
    const finished = Date.now();
    const identity: ServiceReadinessReceiptHashPayloadV2 = {
      schema: SERVICE_READINESS_RECEIPT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: "test_fixture",
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      leaseHash: state.receipt.leaseHash,
      acknowledgementHash: state.acknowledgement!.acknowledgementHash,
      descriptorCapabilityHash: state.descriptorCapabilityHash,
      childProcessIdentityHash:
        state.acknowledgement!.childProcessIdentityHash,
      endpoint: state.endpoint,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      probe: {
        method: "GET",
        pathPolicy: "one_use_nonce_path_v2",
        redirectPolicy: "never_follow",
        requestNonceHash: readinessNonceHash,
        responseNonceHash: sha256(responseText),
        statusCode: 200,
        contentType: "text/plain; charset=utf-8",
        responseByteLength: 64,
        requestCount: 1,
        childObservation: "response_committed",
      },
      stateTransition: "acknowledged_to_ready",
    };
    state.readiness = parseServiceReadinessReceiptV2({
      ...identity,
      readinessHash: hashServiceReadinessReceiptV2(identity),
    });
    state.status = "ready";
    assertNoChildOutputV2(state);
    return state.readiness;
  } catch (error) {
    state.status = "failed";
    try {
      await forceDisposeStateV2(state);
    } catch (cleanupError) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED",
        "Socket readiness failed and private cleanup also failed",
        { error, cleanupError },
      );
    }
    if (error instanceof ExclusiveSocketLeaseErrorV2) throw error;
    return fail(
      "EXCLUSIVE_SOCKET_V2_READINESS_FAILED",
      "Socket readiness observation failed",
      error,
    );
  }
}

export async function observeExclusiveSocketServiceReadinessV2ForTest(
  lease: ExclusiveSocketLeaseV2,
): Promise<TestSocketReadinessResultV2> {
  const receipt = await observeExclusiveSocketServiceReadinessInternalV2(
    lease,
  );
  return Object.freeze({
    status: "ready_test_fixture_socket",
    receipt,
    productionDisposition:
      "forbidden_until_verified_platform_release" as const,
  });
}

export type NodeExpressApiSocketReadinessResultInternalV2 = Readonly<{
  status: "ready_node_express_api_socket";
  receipt: ServiceReadinessReceiptV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

export async function observeExclusiveSocketNodeExpressApiReadinessInternalV2(
  lease: ExclusiveSocketLeaseV2,
): Promise<NodeExpressApiSocketReadinessResultInternalV2> {
  const state = authenticLeaseV2(lease);
  if (state.childProtocol?.kind !== "node_express_api_v2") {
    return fail(
      "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
      "Node Express API readiness requires its exact child protocol",
    );
  }
  const receipt = await observeExclusiveSocketServiceReadinessInternalV2(
    lease,
  );
  return Object.freeze({
    status: "ready_node_express_api_socket",
    receipt,
    productionDisposition:
      "forbidden_until_verified_platform_release" as const,
  });
}

export type NodeExpressApiSocketRequestObservationInternalV2 = Readonly<{
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  requestCount: 1;
  redirectCount: 0;
  statusCode: number;
  contentType: string | undefined;
  body: Buffer;
  childProcessIdentityHash: string;
}>;

function exactNodeExpressApiRequestInternalV2(
  input: HttpEncodedInvocationRequestV2,
): Readonly<{
  method: HttpEncodedInvocationRequestV2["method"];
  pathAndQuery: string;
  headers: Readonly<Record<string, string>>;
  body: Buffer | null;
}> {
  if (
    !exactRecordKeysV2(input, [
      "bodyBytes",
      "fixedHeaders",
      "method",
      "pathAndQuery",
      "redirectPolicy",
    ])
    || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(input.method)
    || typeof input.pathAndQuery !== "string"
    || !input.pathAndQuery.startsWith("/")
    || input.pathAndQuery.includes("\0")
    || input.pathAndQuery.includes("\r")
    || input.pathAndQuery.includes("\n")
    || input.pathAndQuery.includes("#")
    || input.pathAndQuery.includes("://")
    || Buffer.from(input.pathAndQuery, "utf8").toString("utf8")
      !== input.pathAndQuery
    || Buffer.byteLength(input.pathAndQuery, "utf8") > 256 * 1024
    || !Array.isArray(input.fixedHeaders)
    || input.redirectPolicy !== "error"
    || (input.bodyBytes !== null && typeof input.bodyBytes !== "string")
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED",
      "Node Express API request is not one exact bounded transport request",
    );
  }
  const expectedHeaders = input.bodyBytes === null
    ? [{ name: "accept", value: "application/json" }]
    : [
        { name: "accept", value: "application/json" },
        { name: "content-type", value: "application/json" },
      ];
  if (
    JSON.stringify(input.fixedHeaders) !== JSON.stringify(expectedHeaders)
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED",
      "Node Express API fixed headers differ from the transport ABI",
    );
  }
  const body = input.bodyBytes === null
    ? null
    : Buffer.from(input.bodyBytes, "utf8");
  if (
    body !== null
    && (
      body.byteLength > 8 * 1024 * 1024
      || body.toString("utf8") !== input.bodyBytes
    )
  ) {
    body?.fill(0);
    return fail(
      "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED",
      "Node Express API request body exceeds its exact UTF-8 byte authority",
    );
  }
  const headers: Record<string, string> = {
    accept: "application/json",
    connection: "close",
  };
  if (body !== null) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(body.byteLength);
  } else {
    headers["content-length"] = "0";
  }
  return Object.freeze({
    method: input.method,
    pathAndQuery: input.pathAndQuery,
    headers: Object.freeze(headers),
    body,
  });
}

export async function requestExclusiveSocketNodeExpressApiInternalV2(
  lease: ExclusiveSocketLeaseV2,
  request: HttpEncodedInvocationRequestV2,
): Promise<NodeExpressApiSocketRequestObservationInternalV2> {
  const state = authenticLeaseV2(lease);
  requireStateV2(state, "ready");
  if (
    state.childProtocol?.kind !== "node_express_api_v2"
    || state.applicationRequestConsumed
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
      "Node Express API socket accepts one application request",
    );
  }
  state.applicationRequestConsumed = true;
  const transport = exactNodeExpressApiRequestInternalV2(request);
  const childProcess = state.childProcess!;
  const started = Date.now();
  let body: Buffer | undefined;
  try {
    assertNoChildOutputV2(state);
    const http = await new Promise<Readonly<{
      body: Buffer;
      statusCode: number;
      contentType: string | undefined;
    }>>((resolve, reject) => {
      const operation = httpRequest({
        host: state.endpoint.host,
        port: state.endpoint.port,
        method: transport.method,
        path: transport.pathAndQuery,
        headers: transport.headers,
      }, (response) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;
        response.on("data", (chunk: Buffer) => {
          byteLength += chunk.byteLength;
          const remaining = 1_048_576
            - Math.min(byteLength - chunk.byteLength, 1_048_576);
          if (remaining > 0) {
            chunks.push(Buffer.from(chunk.subarray(0, remaining)));
          }
          if (byteLength > 1_048_576) {
            response.destroy(new ExclusiveSocketLeaseErrorV2(
              "EXCLUSIVE_SOCKET_V2_RESPONSE_LIMIT",
              "Node Express API response exceeded its code-owned byte limit",
            ));
          }
        });
        response.once("error", reject);
        response.once("end", () => {
          const captured = Buffer.concat(chunks);
          const statusCode = response.statusCode ?? 0;
          const contentTypeHeader = response.headers["content-type"];
          const contentType = Array.isArray(contentTypeHeader)
            ? undefined
            : contentTypeHeader;
          resolve(Object.freeze({
            body: captured,
            statusCode,
            contentType,
          }));
        });
      });
      operation.setTimeout(30_000, () => {
        operation.destroy(new ExclusiveSocketLeaseErrorV2(
          "EXCLUSIVE_SOCKET_V2_REQUEST_TIMEOUT",
          "Node Express API request exceeded its code-owned timeout",
        ));
      });
      operation.once("error", reject);
      if (transport.body === null) operation.end();
      else operation.end(transport.body);
    });
    body = http.body;
    const finished = Date.now();
    const freshChildIdentity = observedProcessIdentityV2(
      observeProcessIdentity(childProcess.pid),
    );
    if (
      !freshChildIdentity
      || !sameProcessIdentity(childProcess, freshChildIdentity)
      || state.child?.exitCode !== null
    ) {
      body.fill(0);
      return fail(
        "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED",
        "Node Express API child identity drifted during its request",
      );
    }
    assertNoChildOutputV2(state);
    if (
      !Number.isInteger(http.statusCode)
      || http.statusCode < 100
      || http.statusCode > 599
      || (
        http.contentType !== undefined
        && typeof http.contentType !== "string"
      )
    ) {
      body.fill(0);
      return fail(
        "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED",
        "Node Express API response did not expose one exact HTTP status",
      );
    }
    return Object.freeze({
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      requestCount: 1 as const,
      redirectCount: 0 as const,
      statusCode: http.statusCode,
      contentType: http.contentType,
      body,
      childProcessIdentityHash:
        hashSocketProcessIdentityV2(freshChildIdentity),
    });
  } catch (error) {
    body?.fill(0);
    if (error instanceof ExclusiveSocketLeaseErrorV2) throw error;
    return fail(
      "EXCLUSIVE_SOCKET_V2_REQUEST_FAILED",
      "Node Express API request failed at its held-socket boundary",
      error,
    );
  } finally {
    transport.body?.fill(0);
  }
}

async function provePortReleasedV2(
  endpoint: ExclusiveSocketEndpointV2,
): Promise<void> {
  const probe = createServer();
  try {
    await listenExclusiveV2(probe, endpoint.port);
    const observed = exactEndpoint(probe);
    if (JSON.stringify(observed) !== JSON.stringify(endpoint)) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_PORT_RELEASE_UNPROVEN",
        "Cleanup rebind probe acquired a different endpoint",
      );
    }
  } catch (error) {
    try {
      await closeServerV2(probe);
    } catch (cleanupError) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_PORT_RELEASE_UNPROVEN",
        "Failed cleanup rebind observation also retained its probe socket",
        { error, cleanupError },
      );
    }
    if (error instanceof ExclusiveSocketLeaseErrorV2) throw error;
    return fail(
      "EXCLUSIVE_SOCKET_V2_PORT_RELEASE_UNPROVEN",
      "Cleanup could not exclusively rebind the released endpoint",
      error,
    );
  }
  try {
    await closeServerV2(probe);
  } catch (error) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_PORT_RELEASE_UNPROVEN",
      "Cleanup rebind probe did not close its exact server",
      error,
    );
  }
}

export type TestSocketCleanupResultV2 = Readonly<{
  status: "closed_test_fixture_socket";
  receipt: SocketCleanupReceiptV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

async function closeExclusiveSocketLeaseInternalV2(
  lease: ExclusiveSocketLeaseV2,
): Promise<SocketCleanupReceiptV2> {
  const state = authenticLeaseV2(lease);
  requireStateV2(state, "ready");
  if (
    state.childProtocol?.expectedApplicationRequestCount === 1
    && state.applicationRequestConsumed !== true
  ) {
    return fail(
      "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
      "Node Express API cleanup requires its one application request",
    );
  }
  state.status = "closing";
  try {
    const child = state.child!;
    state.cleanupNonce = randomNonceV2();
    const cleanupNonceHash = sha256(state.cleanupNonce);
    const started = Date.now();
    const messagePromise = waitForChildMessageV2(
      state,
      SOCKET_CLEANUP_TIMEOUT_MS_V2,
      "EXCLUSIVE_SOCKET_V2_CLEANUP_TIMEOUT",
    );
    const closePromise = waitForChildCloseV2(
      child,
      SOCKET_CLEANUP_TIMEOUT_MS_V2,
    );
    const [observed, _send, termination] = await Promise.all([
      messagePromise,
      sendControlMessageV2(child, {
        schema: state.childProtocol!.cleanupCommandSchema,
        leaseHash: state.receipt.leaseHash,
        cleanupNonce: state.cleanupNonce,
        cleanupNonceHash,
      }),
      closePromise,
    ]);
    const expectedKeys = state.childProtocol!
      .expectedApplicationRequestCount === 1
      ? [
          "applicationRequestCount",
          "cleanupNonceHash",
          "leaseHash",
          "readinessRequestCount",
          "schema",
          "serverCloseCallback",
        ]
      : [
          "cleanupNonceHash",
          "leaseHash",
          "readinessRequestCount",
          "schema",
          "serverCloseCallback",
        ];
    if (
      !exactRecordKeysV2(observed, expectedKeys)
      || observed.schema
        !== state.childProtocol!.cleanupAcknowledgementSchema
      || observed.leaseHash !== state.receipt.leaseHash
      || observed.cleanupNonceHash !== cleanupNonceHash
      || observed.readinessRequestCount !== 1
      || (
        state.childProtocol!.expectedApplicationRequestCount === 1
        && observed.applicationRequestCount !== 1
      )
      || observed.serverCloseCallback !== "completed"
      || termination.exitCode !== 0
      || termination.signal !== null
      || child.connected
    ) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED",
        "Socket child cleanup acknowledgement or termination was invalid",
      );
    }
    assertNoChildOutputV2(state);
    await provePortReleasedV2(state.endpoint);
    if (state.scratchRoot) {
      rmSync(state.scratchRoot, { recursive: true, force: false });
      state.scratchRoot = undefined;
    }
    const finished = Date.now();
    const identity: SocketCleanupReceiptHashPayloadV2 = {
      schema: SOCKET_CLEANUP_RECEIPT_V2_SCHEMA,
      version: "2.0.0",
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: "test_fixture",
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      leaseHash: state.receipt.leaseHash,
      acknowledgementHash: state.acknowledgement!.acknowledgementHash,
      readinessHash: state.readiness!.readinessHash,
      descriptorCapabilityHash: state.descriptorCapabilityHash,
      childProcessIdentityHash:
        state.acknowledgement!.childProcessIdentityHash,
      endpoint: state.endpoint,
      cleanupNonceHash,
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date(finished).toISOString(),
      durationMs: finished - started,
      childObservation: {
        transport: "authenticated_node_ipc",
        nonceMatched: true,
        serverCloseCallback: "completed",
        readinessRequestCount: 1,
      },
      processTermination: {
        ipcDisconnected: true,
        exitCode: 0,
        signal: null,
      },
      portRelease: {
        method: "exclusive_rebind_probe",
        rebound: true,
        probeServerClosed: true,
      },
      stateTransition: "ready_to_closed",
    };
    const receipt = parseSocketCleanupReceiptV2({
      ...identity,
      cleanupHash: hashSocketCleanupReceiptV2(identity),
    });
    state.attemptNonce = "";
    state.handoffNonce = undefined;
    state.readinessNonce = undefined;
    state.cleanupNonce = undefined;
    state.status = "closed";
    return receipt;
  } catch (error) {
    state.status = "failed";
    try {
      await forceDisposeStateV2(state);
    } catch (cleanupError) {
      return fail(
        "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED",
        "Socket cleanup failed and forced cleanup also failed",
        { error, cleanupError },
      );
    }
    if (error instanceof ExclusiveSocketLeaseErrorV2) throw error;
    return fail(
      "EXCLUSIVE_SOCKET_V2_CLEANUP_FAILED",
      "Socket cleanup receipt could not be issued",
      error,
    );
  }
}

export async function closeExclusiveSocketLeaseV2ForTest(
  lease: ExclusiveSocketLeaseV2,
): Promise<TestSocketCleanupResultV2> {
  const receipt = await closeExclusiveSocketLeaseInternalV2(lease);
  return Object.freeze({
    status: "closed_test_fixture_socket",
    receipt,
    productionDisposition:
      "forbidden_until_verified_platform_release" as const,
  });
}

export type NodeExpressApiSocketCleanupResultInternalV2 = Readonly<{
  status: "closed_node_express_api_socket";
  receipt: SocketCleanupReceiptV2;
  productionDisposition: "forbidden_until_verified_platform_release";
}>;

export async function closeExclusiveSocketNodeExpressApiInternalV2(
  lease: ExclusiveSocketLeaseV2,
): Promise<NodeExpressApiSocketCleanupResultInternalV2> {
  const state = authenticLeaseV2(lease);
  if (state.childProtocol?.kind !== "node_express_api_v2") {
    return fail(
      "EXCLUSIVE_SOCKET_V2_STATE_INVALID",
      "Node Express API cleanup requires its exact child protocol",
    );
  }
  const receipt = await closeExclusiveSocketLeaseInternalV2(lease);
  return Object.freeze({
    status: "closed_node_express_api_socket",
    receipt,
    productionDisposition:
      "forbidden_until_verified_platform_release" as const,
  });
}

export async function destroyExclusiveSocketLeaseInternalV2(
  lease: ExclusiveSocketLeaseV2,
): Promise<void> {
  const state = authenticLeaseV2(lease);
  if (state.status === "closed" || state.status === "destroyed") return;
  await forceDisposeStateV2(state);
  state.status = "destroyed";
}

export async function destroyExclusiveSocketLeaseV2ForTest(
  lease: ExclusiveSocketLeaseV2,
): Promise<void> {
  await destroyExclusiveSocketLeaseInternalV2(lease);
}
