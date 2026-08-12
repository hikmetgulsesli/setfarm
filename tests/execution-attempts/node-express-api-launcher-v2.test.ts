import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  NodeExpressApiLaunchAuthorityV2,
  NodeExpressApiLaunchObservationV2,
  NodeExpressApiLauncherErrorV2,
  copyNodeExpressApiLaunchResponseBytesV2ForTest,
  destroyNodeExpressApiLaunchObservationV2,
  issueNodeExpressApiLaunchAuthorityV2ForTest,
  launchNodeExpressApiV2,
} from "../../src/execution/launchers/node-express-api-v2.js";
import * as launcherSchemaModule from "../../src/execution/schemas/node-express-api-launcher-v2.js";
import {
  NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
  NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2,
  NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2,
  NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCH_RECEIPT_V2_SCHEMA,
  NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2,
  NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
  NodeExpressApiHandlerAbiPolicyV2Schema,
  NodeExpressApiLaunchReceiptV2Schema,
  NodeExpressApiLauncherAbiPolicyV2Schema,
  hashNodeExpressApiLaunchReceiptV2,
  parseNodeExpressApiLaunchReceiptV2,
  type NodeExpressApiLaunchReceiptHashPayloadV2,
  type NodeExpressApiLaunchReceiptV2,
} from "../../src/execution/schemas/node-express-api-launcher-v2.js";
import {
  EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA,
  EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
  EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
  SERVICE_READINESS_RECEIPT_V2_SCHEMA,
  SOCKET_CLEANUP_RECEIPT_V2_SCHEMA,
  SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA,
  ExclusiveSocketLeaseReceiptV2Schema,
  ServiceReadinessReceiptV2Schema,
  SocketCleanupReceiptV2Schema,
  SocketHandoffAcknowledgementV2Schema,
  SocketLaunchBindingV2Schema,
  hashExclusiveSocketLeaseV2,
  hashServiceReadinessReceiptV2,
  hashSocketCleanupReceiptV2,
  hashSocketHandoffAcknowledgementV2,
  hashSocketLaunchBindingV2,
  hashSocketProcessIdentityV2,
  type ExclusiveSocketLeaseHashPayloadV2,
  type ServiceReadinessReceiptHashPayloadV2,
  type SocketCleanupReceiptHashPayloadV2,
  type SocketHandoffAcknowledgementHashPayloadV2,
} from "../../src/execution/schemas/exclusive-socket-lease-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "../../src/execution/schemas/network-isolation-negative-probe-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
} from "../../src/execution/schemas/platform-release-common-v2.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";

function sha(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertRecursivelyFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

function socketChain(moduleContentHash: string) {
  const endpoint = {
    transport: "tcp" as const,
    host: "127.0.0.1" as const,
    family: "IPv4" as const,
    port: 6_123,
    exclusive: true as const,
    reusePort: false as const,
  };
  const allocatorProcess = {
    schema: "setfarm.process-identity.v1" as const,
    pid: 40_001,
    processStartedAt: "2026-07-26T09:59:00.000Z",
    processGroupId: 40_001,
    source: "observed_os" as const,
  };
  const childProcess = {
    schema: "setfarm.process-identity.v1" as const,
    pid: 40_002,
    processStartedAt: "2026-07-26T10:00:00.005Z",
    processGroupId: 40_002,
    source: "observed_os" as const,
  };
  const descriptorCapabilityHash = sha("descriptor-capability");
  const leaseIdentity: ExclusiveSocketLeaseHashPayloadV2 = {
    schema: EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "observed_unverified_release_candidate",
    productionUse: "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
    portBandsHash: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
    allocationPolicy: "os_ephemeral_test_fixture",
    endpoint,
    allocatorProcess,
    allocatorProcessIdentityHash: hashSocketProcessIdentityV2(allocatorProcess),
    attemptNonceHash: sha("attempt-nonce"),
    descriptorCapabilityHash,
    boundAt: "2026-07-26T10:00:00.000Z",
    stateTransition: "unbound_to_bound",
  };
  const lease = ExclusiveSocketLeaseReceiptV2Schema.parse({
    ...leaseIdentity,
    leaseHash: hashExclusiveSocketLeaseV2(leaseIdentity),
  });
  const launchBindingIdentity = {
    launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
    launcherModuleHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
    applicationModuleLocator:
      NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
    applicationModuleHash: moduleContentHash,
    applicationExport: NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
    handlerAbiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  };
  const launchBinding = SocketLaunchBindingV2Schema.parse({
    ...launchBindingIdentity,
    bindingHash: hashSocketLaunchBindingV2(launchBindingIdentity),
  });
  const acknowledgementIdentity:
    SocketHandoffAcknowledgementHashPayloadV2 = {
      schema: SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA,
      version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
      authorityState: "observed_unverified_release_candidate",
      productionUse: "forbidden_until_verified_release_join",
      admissionScope: "test_fixture",
      lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      leaseHash: lease.leaseHash,
      descriptorCapabilityHash,
      endpoint,
      handoffNonceHash: sha("handoff-nonce"),
      sentAt: "2026-07-26T10:00:00.010Z",
      acknowledgedAt: "2026-07-26T10:00:00.020Z",
      sendObservation: {
        transport: "node_ipc_server_handle",
        keepParentOpenThroughAcknowledgement: true,
        sendCallbackAuthority: "forbidden",
      },
      childProcess,
      childProcessIdentityHash: hashSocketProcessIdentityV2(childProcess),
      launchBinding,
      listenerObservation: {
        receivedHandle: true,
        addressMatchesLease: true,
        listening: true,
        candidateListen: "forbidden",
      },
      stateTransitions: ["bound_to_sent", "sent_to_acknowledged"],
    };
  const acknowledgement = SocketHandoffAcknowledgementV2Schema.parse({
    ...acknowledgementIdentity,
    acknowledgementHash:
      hashSocketHandoffAcknowledgementV2(acknowledgementIdentity),
  });
  const readinessNonceHash = sha("readiness-nonce");
  const readinessIdentity: ServiceReadinessReceiptHashPayloadV2 = {
    schema: SERVICE_READINESS_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "observed_unverified_release_candidate",
    productionUse: "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
    leaseHash: lease.leaseHash,
    acknowledgementHash: acknowledgement.acknowledgementHash,
    descriptorCapabilityHash,
    childProcessIdentityHash: acknowledgement.childProcessIdentityHash,
    endpoint,
    startedAt: "2026-07-26T10:00:00.030Z",
    finishedAt: "2026-07-26T10:00:00.040Z",
    durationMs: 10,
    probe: {
      method: "GET",
      pathPolicy: "one_use_nonce_path_v2",
      redirectPolicy: "never_follow",
      requestNonceHash: readinessNonceHash,
      responseNonceHash: readinessNonceHash,
      statusCode: 200,
      contentType: "text/plain; charset=utf-8",
      responseByteLength: 64,
      requestCount: 1,
      childObservation: "response_committed",
    },
    stateTransition: "acknowledged_to_ready",
  };
  const readiness = ServiceReadinessReceiptV2Schema.parse({
    ...readinessIdentity,
    readinessHash: hashServiceReadinessReceiptV2(readinessIdentity),
  });
  const cleanupIdentity: SocketCleanupReceiptHashPayloadV2 = {
    schema: SOCKET_CLEANUP_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "observed_unverified_release_candidate",
    productionUse: "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    lifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
    leaseHash: lease.leaseHash,
    acknowledgementHash: acknowledgement.acknowledgementHash,
    readinessHash: readiness.readinessHash,
    descriptorCapabilityHash,
    childProcessIdentityHash: acknowledgement.childProcessIdentityHash,
    endpoint,
    cleanupNonceHash: sha("cleanup-nonce"),
    startedAt: "2026-07-26T10:00:00.070Z",
    finishedAt: "2026-07-26T10:00:00.080Z",
    durationMs: 10,
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
  const cleanup = SocketCleanupReceiptV2Schema.parse({
    ...cleanupIdentity,
    cleanupHash: hashSocketCleanupReceiptV2(cleanupIdentity),
  });
  return { lease, acknowledgement, readiness, cleanup };
}

function receipt(): NodeExpressApiLaunchReceiptV2 {
  const moduleContentHash = sha("candidate-api-module-content");
  const socket = socketChain(moduleContentHash);
  const identity: NodeExpressApiLaunchReceiptHashPayloadV2 = {
    schema: NODE_EXPRESS_API_LAUNCH_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "observed_unverified_release_candidate",
    productionUse: "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    launcher: {
      launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
      releaseModuleLocator: NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
      requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
      abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
      abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
      handlerAbiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
      observedImplementation: {
        scope: "test_fixture_typescript_source",
        moduleLocator: NODE_EXPRESS_API_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
        moduleContentHash: sha("api-launcher-content"),
        modulePhysicalIdentityHash: sha("api-launcher-physical"),
      },
    },
    candidate: {
      runtimeBundleHash: sha("runtime-bundle"),
      runtimeBundleClosureHash: sha("runtime-bundle-closure"),
      buildReceiptHash: sha("build-receipt"),
      applicationTreeHash: sha("application-tree"),
      materializationHash: sha("materialization"),
      moduleLocator: NODE_EXPRESS_API_APPLICATION_MODULE_LOCATOR_V2,
      moduleContentHash,
      moduleByteLength: 2_048,
      moduleMode: "0444",
      modulePhysicalIdentityHash: sha("candidate-module-physical"),
      applicationExport: NODE_EXPRESS_API_APPLICATION_EXPORT_V2,
    },
    transport: {
      actionRef: "ACTION_CREATE_TASK",
      contractHash: sha("transport-contract"),
      contractSetHash: sha("transport-contract-set"),
      contractMembershipHash: sha("transport-contract-membership"),
      runtimeSourceLogicalReceiptHash: sha("runtime-source-logical-receipt"),
      requestHash: sha("transport-request"),
      method: "POST",
      pathAndQueryHash: sha("/api/tasks"),
      pathAndQueryByteLength: 10,
      fixedHeadersHash: sha("fixed-headers"),
      bodyContentHash: sha("{\"title\":\"Ship Setfarm\"}"),
      bodyByteLength: 24,
      redirectPolicy: "error",
    },
    execution: {
      hostToolchainReceiptHash: sha("host-toolchain-receipt"),
      nodeIdentityHash: sha("node-identity"),
      nodeExecutableContentHash: sha("node-executable-content"),
      sandboxExecutableContentHash: sha("sandbox-executable-content"),
      sandboxExecutablePhysicalIdentityHash: sha("sandbox-physical"),
      sandboxProfileHash: sha("sandbox-profile"),
      bootstrapSourceHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
      normalizedEnvironmentHash:
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      environmentInstanceHash: sha("environment-instance"),
      socketLifecycleAbiHash: EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2,
      shell: "forbidden",
      ambientEnvironment: "forbidden",
      nodeOptionTokens: ["-e"],
      candidateVisibleExecArgv: [],
      childUmask: "0077",
      processGroupPolicy: "isolated_group_killed_on_every_terminal_path",
      cwdPolicy: "candidate_bundle_root",
      sourceFenceBeforeHash: sha("source-fence"),
      sourceFenceAfterHash: sha("source-fence"),
    },
    socket,
    request: {
      startedAt: "2026-07-26T10:00:00.050Z",
      finishedAt: "2026-07-26T10:00:00.060Z",
      durationMs: 10,
      requestCount: 1,
      childCommittedRequestCount: 1,
      redirectCount: 0,
      statusCode: 201,
      contentType: "application/json; charset=utf-8",
      responseContentHash: sha("{\"task\":{\"title\":\"Ship Setfarm\"}}"),
      responseByteLength: 33,
      childProcessIdentityHash:
        socket.acknowledgement.childProcessIdentityHash,
    },
    startedAt: "2026-07-26T09:59:59.900Z",
    finishedAt: "2026-07-26T10:00:00.090Z",
    durationMs: 190,
  };
  return {
    ...identity,
    receiptHash: hashNodeExpressApiLaunchReceiptV2(identity),
  };
}

function rehash(value: NodeExpressApiLaunchReceiptV2): void {
  value.receiptHash = hashNodeExpressApiLaunchReceiptV2(value);
}

test("Node Express API handler and launcher ABIs are exact frozen code-owned policies", () => {
  assert.equal(
    NodeExpressApiHandlerAbiPolicyV2Schema.safeParse(
      clone(NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2),
    ).success,
    true,
  );
  assert.equal(
    NodeExpressApiLauncherAbiPolicyV2Schema.safeParse(
      clone(NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2),
    ).success,
    true,
  );
  assert.equal(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2.abiHash,
    NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  );
  assert.equal(
    NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2.abiHash,
    NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
  );
  assert.equal(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2.exactExpressVersion,
    NODE_EXPRESS_API_EXACT_EXPRESS_VERSION_V2,
  );
  assert.equal(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2.bootstrapSourceHash,
    createHash("sha256")
      .update(NODE_EXPRESS_API_BOOTSTRAP_SOURCE_V2)
      .digest("hex"),
  );
  assert.equal(
    NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2.applicationRequestCount,
    1,
  );
  assert.equal(
    NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2.candidateListen,
    "forbidden",
  );
  assert.equal(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2.candidateListenEnforcement,
    "net_server_listen_disabled_before_candidate_import",
  );
  assert.equal(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2.productionAdmission,
    "current_activated_platform_release_and_candidate_execution_lease_required",
  );
  assertRecursivelyFrozen(NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2);
  assertRecursivelyFrozen(NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2);

  const changedExpress = clone(
    NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2,
  ) as unknown as Record<string, unknown>;
  changedExpress.exactExpressVersion = "5.2.0";
  changedExpress.abiHash = sha("self-consistent-forgery");
  assert.equal(
    NodeExpressApiLauncherAbiPolicyV2Schema.safeParse(changedExpress).success,
    false,
  );
});

test("Node Express API receipt is strict, bounded, pathless, joined, and frozen", () => {
  const value = receipt();
  assert.equal(NodeExpressApiLaunchReceiptV2Schema.safeParse(value).success, true);
  const parsed = parseNodeExpressApiLaunchReceiptV2(clone(value));
  assert.deepEqual(parsed, value);
  assert.notStrictEqual(parsed, value);
  assertRecursivelyFrozen(parsed);
  assert.equal(parsed.request.requestCount, 1);
  assert.equal(parsed.request.childCommittedRequestCount, 1);
  assert.equal(parsed.request.redirectCount, 0);
  assert.equal(
    parsed.socket.cleanup.readinessHash,
    parsed.socket.readiness.readinessHash,
  );

  const canonical = JSON.stringify(parsed);
  for (const forbidden of [
    "absolutePath",
    "bundleRoot",
    "worktree",
    "cwd",
    "environment",
    "command",
    "baseUrl",
    "origin",
    "responseBody",
  ]) {
    assert.equal(canonical.includes(`\"${forbidden}\"`), false, forbidden);
  }

  const staleHash = clone(value);
  staleHash.request.responseByteLength += 1;
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(staleHash).success,
    false,
  );

  const driftedSource = clone(value);
  driftedSource.execution.sourceFenceAfterHash = sha("drifted-source");
  rehash(driftedSource);
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(driftedSource).success,
    false,
  );

  const wrongProcess = clone(value);
  wrongProcess.request.childProcessIdentityHash = sha("other-child");
  rehash(wrongProcess);
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(wrongProcess).success,
    false,
  );

  const brokenChain = clone(value);
  brokenChain.socket.cleanup.readinessHash = sha("other-readiness");
  brokenChain.socket.cleanup.cleanupHash =
    hashSocketCleanupReceiptV2(brokenChain.socket.cleanup);
  rehash(brokenChain);
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(brokenChain).success,
    false,
  );

  const falseDuration = clone(value);
  falseDuration.request.durationMs += 1;
  rehash(falseDuration);
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(falseDuration).success,
    false,
  );

  const oversizedBody = clone(value);
  oversizedBody.transport.bodyByteLength =
    NODE_EXPRESS_API_MAX_REQUEST_BODY_BYTES_V2 + 1;
  rehash(oversizedBody);
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(oversizedBody).success,
    false,
  );

  const oversizedResponse = clone(value);
  oversizedResponse.request.responseByteLength =
    NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2 + 1;
  rehash(oversizedResponse);
  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse(oversizedResponse).success,
    false,
  );

  assert.equal(
    NodeExpressApiLaunchReceiptV2Schema.safeParse({
      ...value,
      absolutePath: "/private/candidate-bundle/application/app.js",
    }).success,
    false,
  );
});

test("bounded API receipt parser rejects accessors, cycles, and proxies without invoking them", () => {
  const value = receipt();
  const cyclic: Record<string, unknown> = { ...value };
  cyclic.self = cyclic;
  assert.throws(() => parseNodeExpressApiLaunchReceiptV2(cyclic));

  let accessorCalls = 0;
  const accessor = { ...value };
  Object.defineProperty(accessor, "hidden", {
    enumerable: true,
    get() {
      accessorCalls += 1;
      return "forbidden";
    },
  });
  assert.throws(() => parseNodeExpressApiLaunchReceiptV2(accessor));
  assert.equal(accessorCalls, 0);

  let proxyTraps = 0;
  const hostile = new Proxy({}, {
    getPrototypeOf() {
      proxyTraps += 1;
      throw new Error("proxy prototype trap must not run");
    },
    ownKeys() {
      proxyTraps += 1;
      throw new Error("proxy ownKeys trap must not run");
    },
  });
  assert.throws(() => parseNodeExpressApiLaunchReceiptV2(hostile));
  assert.equal(proxyTraps, 0);
});

test("Node Express API ABI and receipt hashes have stable domain-separated goldens", () => {
  const value = receipt();
  const actual = {
    bootstrapSourceHash: NODE_EXPRESS_API_BOOTSTRAP_SOURCE_HASH_V2,
    handlerAbiHash: NODE_EXPRESS_API_HANDLER_ABI_HASH_V2,
    launcherAbiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
    launchReceiptHash: value.receiptHash,
    handlerAbiCanonicalBytes:
      canonicalJsonBytes(NODE_EXPRESS_API_HANDLER_ABI_POLICY_V2).byteLength,
    launcherAbiCanonicalBytes:
      canonicalJsonBytes(NODE_EXPRESS_API_LAUNCHER_ABI_POLICY_V2).byteLength,
    receiptCanonicalBytes: canonicalJsonBytes(value).byteLength,
  };
  assert.deepEqual(actual, {
    bootstrapSourceHash: "323b3087a7abb49cf0ef477aaee2efe4f77f2cb40d1cb2c85e052d2bc0fda62f",
    handlerAbiHash: "2006064cdf4661c9dbfada51ad4cca6a5090826ac161f35f8b38141810aaa7ef",
    launcherAbiHash: "8263982b630a28b6d6e9503cfe5614a60ec7af530493caf0b29d56d77de5cf12",
    launchReceiptHash: "6ee86ea1cedf1fd6fbabfb4d1408cfaecfaeded60a4367a18b7047a0b2d192c6",
    handlerAbiCanonicalBytes: 653,
    launcherAbiCanonicalBytes: 2_361,
    receiptCanonicalBytes: 10_478,
  });
  assert.equal(
    new Set([
      actual.bootstrapSourceHash,
      actual.handlerAbiHash,
      actual.launcherAbiHash,
      actual.launchReceiptHash,
    ]).size,
    4,
  );
});

test("API schema module exports no process executor or private response bytes", () => {
  const exportNames = Object.keys(launcherSchemaModule);
  for (const forbidden of [
    "execute",
    "spawn",
    "launchNodeExpressApiV2",
    "copyNodeExpressApiLaunchResponseBytesV2ForTest",
  ]) {
    assert.equal(exportNames.includes(forbidden), false);
  }
});

test("operational API boundary rejects forged, accessor, and proxied authority without side effects", async () => {
  assert.throws(
    () => new NodeExpressApiLaunchAuthorityV2({}, {} as never),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );
  assert.throws(
    () => new NodeExpressApiLaunchObservationV2({}, {} as never),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );

  let nestedProxyTraps = 0;
  const proxiedRuntime = new Proxy({}, {
    getPrototypeOf() {
      nestedProxyTraps += 1;
      throw new Error("nested runtime proxy trap must not run");
    },
  });
  await assert.rejects(
    issueNodeExpressApiLaunchAuthorityV2ForTest({
      runtimeAuthority: proxiedRuntime,
      expectedBundleHash: sha("runtime-bundle"),
      actionRef: "ACTION_CREATE_TASK",
    }),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
  );
  assert.equal(nestedProxyTraps, 0);

  let accessorCalls = 0;
  const accessor = {
    expectedBundleHash: sha("runtime-bundle"),
    actionRef: "ACTION_CREATE_TASK",
  } as Record<string, unknown>;
  Object.defineProperty(accessor, "runtimeAuthority", {
    enumerable: true,
    get() {
      accessorCalls += 1;
      throw new Error("launcher input accessor must not run");
    },
  });
  await assert.rejects(
    issueNodeExpressApiLaunchAuthorityV2ForTest(accessor),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_INPUT_INVALID",
  );
  assert.equal(accessorCalls, 0);

  const forgedAuthority = Object.create(
    NodeExpressApiLaunchAuthorityV2.prototype,
  ) as NodeExpressApiLaunchAuthorityV2;
  await assert.rejects(
    launchNodeExpressApiV2({
      authority: forgedAuthority,
      encodedRequest: {},
    }),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );

  const forgedObservation = Object.create(
    NodeExpressApiLaunchObservationV2.prototype,
  ) as NodeExpressApiLaunchObservationV2;
  assert.throws(
    () => copyNodeExpressApiLaunchResponseBytesV2ForTest(forgedObservation),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );
  assert.throws(
    () => destroyNodeExpressApiLaunchObservationV2(forgedObservation),
    (error: unknown) => error instanceof NodeExpressApiLauncherErrorV2
      && error.code === "NODE_EXPRESS_API_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );
});
