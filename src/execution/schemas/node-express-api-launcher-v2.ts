import { createHash } from "node:crypto";

import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "./network-isolation-negative-probe-v2.js";
import {
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  ExclusiveSocketLeaseReceiptV2Schema,
  ServiceReadinessReceiptV2Schema,
  SocketCleanupReceiptV2Schema,
  SocketHandoffAcknowledgementV2Schema,
} from "./exclusive-socket-lease-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2_SCHEMA =
  "setfarm.node-express-api-handler-abi-policy.v2" as const;
export const NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2_SCHEMA =
  "setfarm.node-express-api-launcher-abi-policy.v2" as const;
export const NODE_EXPRESS_API_LAUNCH_RECEIPT_V2_SCHEMA =
  "setfarm.node-express-api-launch-receipt.v2" as const;
export const NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2 =
  "LAUNCHER_NODE_EXPRESS_API_ABI_V2" as const;
export const NODE_EXPRESS_API_LAUNCHER_REF_V2 =
  "LAUNCH_NODE_EXPRESS_API_V2" as const;
export const NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2 =
  "dist/execution/launchers/node-express-api-v2.js" as const;
export const NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2 =
  "src/execution/launchers/node-express-api-v2.ts" as const;
export const NODE_EXPRESS_API_LAUNCHER_EXPORT_V2 =
  "launchNodeExpressApiV2" as const;
export const NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2 =
  "candidate-bundle/application/app.js" as const;
export const NODE_EXPRESS_API_APPLICATION_EXPORT_V2 =
  "setfarmHttpHandlerV2" as const;
export const NODE_EXPRESS_API_HANDLER_ABI_REF_V2 =
  "EXPRESS_REQUEST_HANDLER_ABI_V2" as const;
export const NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2 = "5.2.1" as const;
export const NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2 = 30_000 as const;
export const NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2 =
  8 * 1024 * 1024;
export const NODE_EXPRESS_API_MAX_PATH_AND_QUERY_BYTES_V2 =
  256 * 1024;
export const NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2 = 1_048_576 as const;
export const NODE_EXPRESS_API_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;

/**
 * This is the complete child program passed to the exact admitted Node
 * executable through sandbox-exec. It owns the HTTP server, imports the sealed
 * candidate module, attaches the one exact Express handler export, and speaks
 * only the authenticated socket lifecycle IPC protocol.
 */
export const NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2 = String.raw`
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { createRequire } = require("node:module");
const { pathToFileURL } = require("node:url");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const exactKeys = (value, expected) => (
  value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort())
    === JSON.stringify([...expected].sort())
);
const send = (message, callback) => {
  if (typeof process.send !== "function") process.exit(121);
  process.send(message, callback);
};
const fail = (code) => {
  try {
    send({
      schema: "setfarm.socket-node-express-api-failure.v2",
      code: String(code).slice(0, 500),
    }, () => process.exit(122));
  } catch {
    process.exit(123);
  }
};

let config;
try {
  config = JSON.parse(Buffer.from(process.argv[1], "base64url").toString("utf8"));
} catch {
  fail("NODE_EXPRESS_API_BOOTSTRAP_CONFIG_INVALID");
}
if (!exactKeys(config, [
  "bundleRoot",
  "environment",
  "maxRequestBodyBytes",
  "moduleContentHash",
  "modulePath",
  "schema",
])) {
  fail("NODE_EXPRESS_API_BOOTSTRAP_CONFIG_INVALID");
}
delete process.env.__CF_USER_TEXT_ENCODING;
const expectedEnvironmentNames = Object.keys(config.environment).sort();
const observedEnvironmentNames = Object.keys(process.env).sort();
if (
  config.schema !== "setfarm.node-express-api-bootstrap-config.v2"
  || typeof config.bundleRoot !== "string"
  || typeof config.modulePath !== "string"
  || !/^[a-f0-9]{64}$/.test(config.moduleContentHash)
  || config.maxRequestBodyBytes !== 8388608
  || !exactKeys(config.environment, expectedEnvironmentNames)
  || JSON.stringify(observedEnvironmentNames)
    !== JSON.stringify(expectedEnvironmentNames)
  || expectedEnvironmentNames.some((name) =>
    process.env[name] !== config.environment[name])
) {
  fail("NODE_EXPRESS_API_BOOTSTRAP_AUTHORITY_INVALID");
}
let moduleBytes;
try {
  if (
    fs.realpathSync(config.bundleRoot) !== config.bundleRoot
    || fs.realpathSync(process.cwd()) !== config.bundleRoot
    || fs.realpathSync(config.modulePath) !== config.modulePath
    || path.dirname(path.dirname(config.modulePath)) !== config.bundleRoot
    || path.basename(path.dirname(config.modulePath)) !== "application"
    || path.basename(config.modulePath) !== "app.js"
  ) {
    fail("NODE_EXPRESS_API_BOOTSTRAP_MODULE_NONCANONICAL");
  }
  moduleBytes = fs.readFileSync(config.modulePath);
} catch {
  fail("NODE_EXPRESS_API_BOOTSTRAP_MODULE_UNREADABLE");
}
if (
  crypto.createHash("sha256").update(moduleBytes).digest("hex")
    !== config.moduleContentHash
) {
  fail("NODE_EXPRESS_API_BOOTSTRAP_MODULE_DRIFT");
}
let packageDocument;
try {
  const packagePath = path.join(
    config.bundleRoot,
    "node_modules",
    "express",
    "package.json",
  );
  if (fs.realpathSync(packagePath) !== packagePath) {
    fail("NODE_EXPRESS_API_BOOTSTRAP_EXPRESS_NONCANONICAL");
  }
  packageDocument = JSON.parse(fs.readFileSync(packagePath, "utf8"));
} catch {
  fail("NODE_EXPRESS_API_BOOTSTRAP_EXPRESS_UNREADABLE");
}
if (
  !packageDocument
  || packageDocument.name !== "express"
  || packageDocument.version !== "5.2.1"
) {
  fail("NODE_EXPRESS_API_BOOTSTRAP_EXPRESS_IDENTITY_INVALID");
}

process.umask(0o077);
process.execArgv = [];
process.argv = [process.execPath, config.modulePath];

let heldServer;
let httpServer;
let activeLeaseHash;
let cleanupConsumed = false;
let handoffConsumed = false;
let readinessRequestCount = 0;
let applicationRequestCount = 0;

process.on("message", (message, receivedHandle) => {
  Promise.resolve().then(async () => {
    if (
      message
      && message.schema === "setfarm.socket-node-express-api-handoff-command.v2"
    ) {
      if (
        handoffConsumed
        || heldServer
        || !exactKeys(message, [
          "descriptorCapabilityHash",
          "endpoint",
          "handoffNonce",
          "handoffNonceHash",
          "launchBinding",
          "launchBindingHash",
          "leaseHash",
          "readinessNonce",
          "readinessNonceHash",
          "schema",
        ])
        || !exactKeys(message.launchBinding, [
          "applicationExport",
          "applicationModuleHash",
          "applicationModuleLocator",
          "bindingHash",
          "handlerAbiHash",
          "launcherModuleHash",
          "launcherRef",
        ])
        || message.launchBindingHash !== message.launchBinding.bindingHash
        || message.launchBinding.applicationModuleHash
          !== config.moduleContentHash
        || message.launchBinding.applicationModuleLocator
          !== "candidate-bundle/application/app.js"
        || message.launchBinding.applicationExport !== "setfarmHttpHandlerV2"
        || typeof message.handoffNonce !== "string"
        || sha256(message.handoffNonce) !== message.handoffNonceHash
        || typeof message.readinessNonce !== "string"
        || sha256(message.readinessNonce) !== message.readinessNonceHash
        || !receivedHandle
        || typeof receivedHandle.on !== "function"
        || receivedHandle.listening !== true
      ) {
        throw new Error("NODE_EXPRESS_API_CHILD_HANDOFF_INVALID");
      }
      const address = receivedHandle.address();
      if (
        !address
        || typeof address === "string"
        || address.address !== message.endpoint.host
        || address.family !== message.endpoint.family
        || address.port !== message.endpoint.port
      ) {
        throw new Error("NODE_EXPRESS_API_CHILD_ENDPOINT_MISMATCH");
      }
      Object.defineProperty(net.Server.prototype, "listen", {
        value: () => {
          throw new Error(
            "NODE_EXPRESS_API_CHILD_CANDIDATE_LISTEN_FORBIDDEN",
          );
        },
        writable: false,
        enumerable: false,
        configurable: false,
      });
      const runtimeModule = await import(pathToFileURL(config.modulePath).href);
      const exportDescriptor = Object.getOwnPropertyDescriptor(
        runtimeModule,
        message.launchBinding.applicationExport,
      );
      if (
        !exportDescriptor
        || typeof exportDescriptor.value !== "function"
        || exportDescriptor.get !== undefined
        || exportDescriptor.set !== undefined
      ) {
        throw new Error("NODE_EXPRESS_API_CHILD_EXPORT_INVALID");
      }
      const requireFromBundle = createRequire(
        path.join(config.bundleRoot, "package.json"),
      );
      const express = requireFromBundle("express");
      if (typeof express !== "function" || typeof express.json !== "function") {
        throw new Error("NODE_EXPRESS_API_CHILD_EXPRESS_INVALID");
      }
      const handler = exportDescriptor.value;
      const application = express();
      application.disable("x-powered-by");
      application.use(express.json({
        limit: config.maxRequestBodyBytes,
        strict: true,
        type: "application/json",
      }));
      application.use(handler);
      application.use((request, response) => {
        response.status(404).json({
          error: {
            code: "PLATFORM_ROUTE_NOT_HANDLED",
            message: "Candidate handler did not handle the authoritative route",
          },
        });
      });
      application.use((error, request, response, next) => {
        void request;
        void next;
        if (response.headersSent) return;
        response.status(400).json({
          error: {
            code: "PLATFORM_REQUEST_REJECTED",
            message: error && error.message
              ? String(error.message).slice(0, 500)
              : "Request rejected",
          },
        });
      });
      handoffConsumed = true;
      heldServer = receivedHandle;
      activeLeaseHash = message.leaseHash;
      const readinessPath =
        "/.setfarm/readiness-v2/" + message.readinessNonce;
      httpServer = http.createServer((request, response) => {
        if (request.method === "GET" && request.url === readinessPath) {
          readinessRequestCount += 1;
          if (readinessRequestCount !== 1) {
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
              schema:
                "setfarm.socket-node-express-api-readiness-observation.v2",
              leaseHash: activeLeaseHash,
              readinessNonceHash: message.readinessNonceHash,
              requestCount: readinessRequestCount,
              responseCommitted: true,
            });
          });
          return;
        }
        applicationRequestCount += 1;
        if (applicationRequestCount !== 1) {
          response.writeHead(409, {
            connection: "close",
            "content-length": "0",
          });
          response.end();
          return;
        }
        application(request, response);
      });
      heldServer.on("connection", (socket) => {
        httpServer.emit("connection", socket);
      });
      send({
        schema: "setfarm.socket-node-express-api-handoff-ack.v2",
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
    if (
      message
      && message.schema === "setfarm.socket-node-express-api-cleanup-command.v2"
    ) {
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
        || readinessRequestCount !== 1
        || applicationRequestCount !== 1
      ) {
        throw new Error("NODE_EXPRESS_API_CHILD_CLEANUP_INVALID");
      }
      cleanupConsumed = true;
      heldServer.close((error) => {
        if (error) {
          fail("NODE_EXPRESS_API_CHILD_CLOSE_FAILED");
          return;
        }
        send({
          schema: "setfarm.socket-node-express-api-cleanup-ack.v2",
          leaseHash: activeLeaseHash,
          cleanupNonceHash: message.cleanupNonceHash,
          readinessRequestCount,
          applicationRequestCount,
          serverCloseCallback: "completed",
        }, () => {
          if (process.connected) process.disconnect();
          process.exit(0);
        });
      });
      return;
    }
    throw new Error("NODE_EXPRESS_API_CHILD_MESSAGE_UNSUPPORTED");
  }).catch((error) => fail(
    error && error.message ? error.message : "NODE_EXPRESS_API_CHILD_FAILED",
  ));
});
`;

export const NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2 =
  createHash("sha256")
    .update(NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2)
    .digest("hex");

const NODE_EXPRESS_API_HANDLER_ABI_POLICY_IDENTITY_V2 = Object.freeze({
  schema: NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  abiRef: NODE_EXPRESS_API_HANDLER_ABI_REF_V2,
  applicationExport: NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
  exactExpressVersion: NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2,
  callShape: "express_request_response_next" as const,
  serverOwnership: "platform_owned" as const,
  listenerOwnership: "platform_owned" as const,
  socketOwnership: "platform_owned" as const,
  candidateListen: "forbidden" as const,
  bodyParser: Object.freeze({
    mediaType: "application/json" as const,
    strict: true as const,
    maxBytes: NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2,
  }),
  fallbackRouteOwner: "platform_owned_json_404" as const,
  middlewareErrorOwner: "platform_owned_json_400" as const,
  applicationRequestCount: 1 as const,
});

const NodeExpressApiHandlerAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  abiRef: z.literal(NODE_EXPRESS_API_HANDLER_ABI_REF_V2),
  applicationExport: z.literal(NODE_EXPRESS_API_APPLICATION_EXPORT_V2),
  exactExpressVersion: z.literal(NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2),
  callShape: z.literal("express_request_response_next"),
  serverOwnership: z.literal("platform_owned"),
  listenerOwnership: z.literal("platform_owned"),
  socketOwnership: z.literal("platform_owned"),
  candidateListen: z.literal("forbidden"),
  bodyParser: z.object({
    mediaType: z.literal("application/json"),
    strict: z.literal(true),
    maxBytes: z.literal(NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2),
  }).strict(),
  fallbackRouteOwner: z.literal("platform_owned_json_404"),
  middlewareErrorOwner: z.literal("platform_owned_json_400"),
  applicationRequestCount: z.literal(1),
}).strict();

export function hashNodeExpressApiHandlerAbiPolicyV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const policy = { ...value };
  delete policy.abiHash;
  return hashCanonicalJson({
    schema: "setfarm.node-express-api-handler-abi-policy-hash.v2",
    policy,
  });
}

export const NODE_EXPRESS_API_HANDLER_ABI_HASH_V2 =
  hashNodeExpressApiHandlerAbiPolicyV2(
    NODE_EXPRESS_API_HANDLER_ABI_POLICY_IDENTITY_V2,
  );

export const NodeExpressApiHandlerAbiPolicyV2Schema =
  NodeExpressApiHandlerAbiPolicyIdentityV2Schema.extend({
    abiHash: z.literal(NODE_EXPRESS_API_HANDLER_ABI_HASH_V2),
  }).strict().superRefine((value, context) => {
    if (
      value.abiHash !== hashNodeExpressApiHandlerAbiPolicyV2(value)
      || JSON.stringify(value)
        !== JSON.stringify({
          ...NODE_EXPRESS_API_HANDLER_ABI_POLICY_IDENTITY_V2,
          abiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
        })
    ) {
      context.addIssue({
        code: "custom",
        message: "Node Express API handler ABI must equal exact code-owned policy",
      });
    }
  });

export type NodeExpressApiHandlerAbiPolicyV2 = z.infer<
  typeof NodeExpressApiHandlerAbiPolicyV2Schema
>;

export const NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2 =
  deepFreezePlatformReleaseJsonV2(
    NodeExpressApiHandlerAbiPolicyV2Schema.parse({
      ...NODE_EXPRESS_API_HANDLER_ABI_POLICY_IDENTITY_V2,
      abiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
    }),
  );

const NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_IDENTITY_V2 = Object.freeze({
  schema: NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2_SCHEMA,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
  moduleLocator: NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2" as const,
  stackPackId: "node-express-api" as const,
  invocationKind: "http_service" as const,
  applicationModuleLocator: NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
  applicationModuleSystem: "node_esm" as const,
  applicationExport: NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
  handlerAbiRef: NODE_EXPRESS_API_HANDLER_ABI_REF_V2,
  handlerAbiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  exactExpressVersion: NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2,
  bootstrapSourceHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
  bootstrapConfigSchema:
    "setfarm.node-express-api-bootstrap-config.v2" as const,
  nodeOptionTokens: Object.freeze(["-e"] as const),
  candidateVisibleExecArgv: Object.freeze([] as const),
  candidateVisibleArgv:
    "node_executable_candidate_module_without_transport_arguments" as const,
  childUmask: "0077" as const,
  processGroupPolicy: "isolated_group_killed_on_every_terminal_path" as const,
  shell: "forbidden" as const,
  ambientEnvironment: "forbidden" as const,
  cwdPolicy: "candidate_bundle_root" as const,
  networkPolicy: "macos_sandbox_exec_loopback_only_v2" as const,
  normalizedEnvironmentHash:
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  socketLifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  socketHandoff:
    "held_descriptor_authenticated_node_ipc_keep_parent_until_ack" as const,
  candidateListenEnforcement:
    "net_server_listen_disabled_before_candidate_import" as const,
  readiness:
    "one_use_nonce_http_plus_child_commit_observation" as const,
  requestPolicy:
    "one_authoritative_transport_request_no_redirect" as const,
  cleanup:
    "authenticated_child_close_exit_zero_and_exclusive_rebind" as const,
  requestTimeoutMs: NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2,
  maxPathAndQueryBytes: NODE_EXPRESS_API_MAX_PATH_AND_QUERY_BYTES_V2,
  maxRequestBodyBytes: NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2,
  maxResponseBytes: NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
  capturePolicy: "bounded_private_response_bytes_plus_canonical_hashes" as const,
  sourceFencePolicy:
    "fresh_runtime_bundle_and_exact_module_before_after" as const,
  resultAuthority:
    "service_observation_only_never_product_verdict" as const,
  productionAdmission:
    "current_activated_platform_release_and_candidate_execution_lease_required" as const,
  testFixtureAdmission:
    "authentic_test_runtime_bundle_but_production_forbidden" as const,
});

const NodeExpressApiLauncherAbiPolicyIdentityV2Schema = z.object({
  schema: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  launcherRef: z.literal(NODE_EXPRESS_API_LAUNCHER_REF_V2),
  moduleLocator: z.literal(NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2),
  requiredExport: z.literal(NODE_EXPRESS_API_LAUNCHER_EXPORT_V2),
  abiRef: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2),
  profileId: z.literal("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2"),
  stackPackId: z.literal("node-express-api"),
  invocationKind: z.literal("http_service"),
  applicationModuleLocator: z.literal(
    NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
  ),
  applicationModuleSystem: z.literal("node_esm"),
  applicationExport: z.literal(NODE_EXPRESS_API_APPLICATION_EXPORT_V2),
  handlerAbiRef: z.literal(NODE_EXPRESS_API_HANDLER_ABI_REF_V2),
  handlerAbiHash: z.literal(NODE_EXPRESS_API_HANDLER_ABI_HASH_V2),
  exactExpressVersion: z.literal(NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2),
  bootstrapSourceHash: z.literal(NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2),
  bootstrapConfigSchema: z.literal(
    "setfarm.node-express-api-bootstrap-config.v2",
  ),
  nodeOptionTokens: z.tuple([z.literal("-e")]),
  candidateVisibleExecArgv: z.tuple([]),
  candidateVisibleArgv: z.literal(
    "node_executable_candidate_module_without_transport_arguments",
  ),
  childUmask: z.literal("0077"),
  processGroupPolicy: z.literal(
    "isolated_group_killed_on_every_terminal_path",
  ),
  shell: z.literal("forbidden"),
  ambientEnvironment: z.literal("forbidden"),
  cwdPolicy: z.literal("candidate_bundle_root"),
  networkPolicy: z.literal("macos_sandbox_exec_loopback_only_v2"),
  normalizedEnvironmentHash: z.literal(
    NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
  ),
  socketLifecycleAbiHash: z.literal(EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2),
  socketHandoff: z.literal(
    "held_descriptor_authenticated_node_ipc_keep_parent_until_ack",
  ),
  candidateListenEnforcement: z.literal(
    "net_server_listen_disabled_before_candidate_import",
  ),
  readiness: z.literal(
    "one_use_nonce_http_plus_child_commit_observation",
  ),
  requestPolicy: z.literal(
    "one_authoritative_transport_request_no_redirect",
  ),
  cleanup: z.literal(
    "authenticated_child_close_exit_zero_and_exclusive_rebind",
  ),
  requestTimeoutMs: z.literal(NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2),
  maxPathAndQueryBytes: z.literal(
    NODE_EXPRESS_API_MAX_PATH_AND_QUERY_BYTES_V2,
  ),
  maxRequestBodyBytes: z.literal(
    NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2,
  ),
  maxResponseBytes: z.literal(NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2),
  capturePolicy: z.literal(
    "bounded_private_response_bytes_plus_canonical_hashes",
  ),
  sourceFencePolicy: z.literal(
    "fresh_runtime_bundle_and_exact_module_before_after",
  ),
  resultAuthority: z.literal(
    "service_observation_only_never_product_verdict",
  ),
  productionAdmission: z.literal(
    "current_activated_platform_release_and_candidate_execution_lease_required",
  ),
  testFixtureAdmission: z.literal(
    "authentic_test_runtime_bundle_but_production_forbidden",
  ),
}).strict();

export function hashNodeExpressApiLauncherAbiPolicyV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const policy = { ...value };
  delete policy.abiHash;
  return hashCanonicalJson({
    schema: "setfarm.node-express-api-launcher-abi-policy-hash.v2",
    policy,
  });
}

export const NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2 =
  hashNodeExpressApiLauncherAbiPolicyV2(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_IDENTITY_V2,
  );

export const NodeExpressApiLauncherAbiPolicyV2Schema =
  NodeExpressApiLauncherAbiPolicyIdentityV2Schema.extend({
    abiHash: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2),
  }).strict().superRefine((value, context) => {
    if (
      value.abiHash !== hashNodeExpressApiLauncherAbiPolicyV2(value)
      || JSON.stringify(value)
        !== JSON.stringify({
          ...NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_IDENTITY_V2,
          abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
        })
    ) {
      context.addIssue({
        code: "custom",
        message: "Node Express API launcher ABI must equal exact code-owned policy",
      });
    }
  });

export type NodeExpressApiLauncherAbiPolicyV2 = z.infer<
  typeof NodeExpressApiLauncherAbiPolicyV2Schema
>;

export const NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2 =
  deepFreezePlatformReleaseJsonV2(
    NodeExpressApiLauncherAbiPolicyV2Schema.parse({
      ...NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_IDENTITY_V2,
      abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
    }),
  );

const ExactUtcMillisecondTimestampV2Schema = z.string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    "Expected one exact UTC millisecond timestamp",
  )
  .refine((value) => {
    const milliseconds = Date.parse(value);
    return !Number.isNaN(milliseconds)
      && new Date(milliseconds).toISOString() === value;
  }, "Expected one valid round-tripping UTC timestamp");

const NodeExpressApiLaunchReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_EXPRESS_API_LAUNCH_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_unverified_release_candidate"),
  productionUse: z.literal("forbidden_until_verified_release_join"),
  admissionScope: z.literal("test_fixture"),
  launcher: z.object({
    launcherRef: z.literal(NODE_EXPRESS_API_LAUNCHER_REF_V2),
    releaseModuleLocator: z.literal(
      NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
    ),
    requiredExport: z.literal(NODE_EXPRESS_API_LAUNCHER_EXPORT_V2),
    abiRef: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2),
    abiHash: z.literal(NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2),
    handlerAbiHash: z.literal(NODE_EXPRESS_API_HANDLER_ABI_HASH_V2),
    observedImplementation: z.object({
      scope: z.literal("test_fixture_typescript_source"),
      moduleLocator: z.literal(
        NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
      ),
      moduleContentHash: Sha256Schema,
      modulePhysicalIdentityHash: Sha256Schema,
    }).strict(),
  }).strict(),
  candidate: z.object({
    runtimeBundleHash: Sha256Schema,
    runtimeBundleClosureHash: Sha256Schema,
    buildReceiptHash: Sha256Schema,
    applicationTreeHash: Sha256Schema,
    materializationHash: Sha256Schema,
    moduleLocator: z.literal(
      NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
    ),
    moduleContentHash: Sha256Schema,
    moduleByteLength: z.number().int().positive()
      .max(64 * 1024 * 1024),
    moduleMode: z.literal("0444"),
    modulePhysicalIdentityHash: Sha256Schema,
    applicationExport: z.literal(
      NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
    ),
  }).strict(),
  transport: z.object({
    actionRef: z.string().min(1).max(160),
    contractHash: Sha256Schema,
    contractSetHash: Sha256Schema,
    contractMembershipHash: Sha256Schema,
    runtimeSourceLogicalReceiptHash: Sha256Schema,
    requestHash: Sha256Schema,
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    pathAndQueryHash: Sha256Schema,
    pathAndQueryByteLength: z.number().int().positive()
      .max(NODE_EXPRESS_API_MAX_PATH_AND_QUERY_BYTES_V2),
    fixedHeadersHash: Sha256Schema,
    bodyContentHash: Sha256Schema,
    bodyByteLength: z.number().int().nonnegative()
      .max(NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2),
    redirectPolicy: z.literal("error"),
  }).strict(),
  execution: z.object({
    hostToolchainReceiptHash: Sha256Schema,
    nodeIdentityHash: Sha256Schema,
    nodeExecutableContentHash: Sha256Schema,
    sandboxExecutableContentHash: Sha256Schema,
    sandboxExecutablePhysicalIdentityHash: Sha256Schema,
    sandboxProfileHash: Sha256Schema,
    bootstrapSourceHash: z.literal(
      NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
    ),
    normalizedEnvironmentHash: z.literal(
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    ),
    environmentInstanceHash: Sha256Schema,
    socketLifecycleAbiHash: z.literal(
      EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
    ),
    shell: z.literal("forbidden"),
    ambientEnvironment: z.literal("forbidden"),
    nodeOptionTokens: z.tuple([z.literal("-e")]),
    candidateVisibleExecArgv: z.tuple([]),
    childUmask: z.literal("0077"),
    processGroupPolicy: z.literal(
      "isolated_group_killed_on_every_terminal_path",
    ),
    cwdPolicy: z.literal("candidate_bundle_root"),
    sourceFenceBeforeHash: Sha256Schema,
    sourceFenceAfterHash: Sha256Schema,
  }).strict(),
  socket: z.object({
    lease: ExclusiveSocketLeaseReceiptV2Schema,
    acknowledgement: SocketHandoffAcknowledgementV2Schema,
    readiness: ServiceReadinessReceiptV2Schema,
    cleanup: SocketCleanupReceiptV2Schema,
  }).strict(),
  request: z.object({
    startedAt: ExactUtcMillisecondTimestampV2Schema,
    finishedAt: ExactUtcMillisecondTimestampV2Schema,
    durationMs: z.number().int().nonnegative()
      .max(NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2),
    requestCount: z.literal(1),
    childCommittedRequestCount: z.literal(1),
    redirectCount: z.literal(0),
    statusCode: z.number().int().min(100).max(599),
    contentType: z.literal("application/json; charset=utf-8"),
    responseContentHash: Sha256Schema,
    responseByteLength: z.number().int().nonnegative()
      .max(NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2),
    childProcessIdentityHash: Sha256Schema,
  }).strict(),
  startedAt: ExactUtcMillisecondTimestampV2Schema,
  finishedAt: ExactUtcMillisecondTimestampV2Schema,
  durationMs: z.number().int().nonnegative()
    .max(NODE_EXPRESS_API_REQUEST_TIMEOUT_MS_V2 + 20_000),
}).strict().superRefine((value, context) => {
  const started = Date.parse(value.startedAt);
  const finished = Date.parse(value.finishedAt);
  const requestStarted = Date.parse(value.request.startedAt);
  const requestFinished = Date.parse(value.request.finishedAt);
  if (finished < started || finished - started !== value.durationMs) {
    context.addIssue({
      code: "custom",
      path: ["durationMs"],
      message: "Node Express API duration must equal its exact UTC interval",
    });
  }
  if (
    requestFinished < requestStarted
    || requestFinished - requestStarted !== value.request.durationMs
    || requestStarted < Date.parse(value.socket.readiness.finishedAt)
    || Date.parse(value.socket.cleanup.startedAt) < requestFinished
    || started > Date.parse(value.socket.lease.boundAt)
    || finished < Date.parse(value.socket.cleanup.finishedAt)
  ) {
    context.addIssue({
      code: "custom",
      path: ["request"],
      message: "Node Express API request must occur after readiness and before cleanup inside the launch interval",
    });
  }
  if (
    value.execution.sourceFenceBeforeHash
      !== value.execution.sourceFenceAfterHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["execution", "sourceFenceAfterHash"],
      message: "Node Express API launch cannot issue evidence across source drift",
    });
  }
  const socket = value.socket;
  if (
    socket.acknowledgement.leaseHash !== socket.lease.leaseHash
    || socket.readiness.leaseHash !== socket.lease.leaseHash
    || socket.cleanup.leaseHash !== socket.lease.leaseHash
    || socket.readiness.acknowledgementHash
      !== socket.acknowledgement.acknowledgementHash
    || socket.cleanup.acknowledgementHash
      !== socket.acknowledgement.acknowledgementHash
    || socket.cleanup.readinessHash !== socket.readiness.readinessHash
    || JSON.stringify(socket.acknowledgement.endpoint)
      !== JSON.stringify(socket.lease.endpoint)
    || JSON.stringify(socket.readiness.endpoint)
      !== JSON.stringify(socket.lease.endpoint)
    || JSON.stringify(socket.cleanup.endpoint)
      !== JSON.stringify(socket.lease.endpoint)
    || value.request.childProcessIdentityHash
      !== socket.acknowledgement.childProcessIdentityHash
    || socket.acknowledgement.launchBinding.launcherRef
      !== NODE_EXPRESS_API_LAUNCHER_REF_V2
    || socket.acknowledgement.launchBinding.launcherModuleHash
      !== NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2
    || socket.acknowledgement.launchBinding.applicationModuleLocator
      !== NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2
    || socket.acknowledgement.launchBinding.applicationModuleHash
      !== value.candidate.moduleContentHash
    || socket.acknowledgement.launchBinding.applicationExport
      !== NODE_EXPRESS_API_APPLICATION_EXPORT_V2
    || socket.acknowledgement.launchBinding.handlerAbiHash
      !== NODE_EXPRESS_API_HANDLER_ABI_HASH_V2
  ) {
    context.addIssue({
      code: "custom",
      path: ["socket"],
      message: "Node Express API socket receipts must form one exact candidate, process and lifecycle chain",
    });
  }
});

export type NodeExpressApiLaunchReceiptHashPayloadV2 = z.infer<
  typeof NodeExpressApiLaunchReceiptIdentityV2Schema
>;

export function hashNodeExpressApiLaunchReceiptV2(
  value:
    | NodeExpressApiLaunchReceiptHashPayloadV2
    | NodeExpressApiLaunchReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-express-api-launch-receipt-hash.v2",
    receipt,
  });
}

export const NodeExpressApiLaunchReceiptV2Schema =
  NodeExpressApiLaunchReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        NODE_EXPRESS_API_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Node Express API receipt exceeds ${NODE_EXPRESS_API_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2} canonical bytes`,
      });
      return;
    }
    if (value.receiptHash !== hashNodeExpressApiLaunchReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Node Express API receipt hash must bind the exact observation",
      });
    }
  });

export type NodeExpressApiLaunchReceiptV2 = z.infer<
  typeof NodeExpressApiLaunchReceiptV2Schema
>;

export function parseNodeExpressApiLaunchReceiptV2(
  input: unknown,
): NodeExpressApiLaunchReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    NODE_EXPRESS_API_LAUNCH_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    NodeExpressApiLaunchReceiptV2Schema.parse(snapshot),
  );
}
