import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import {
  NodeCliLaunchAuthorityV2,
  NodeCliLaunchObservationV2,
  NodeCliLauncherErrorV2,
  copyNodeCliLaunchCaptureBytesV2ForTest,
  destroyNodeCliLaunchObservationV2,
  issueNodeCliLaunchAuthorityV2ForTest,
  launchNodeCliV2,
} from "../../src/execution/launchers/node-cli-v2.js";
import * as launcherSchemaModule from "../../src/execution/schemas/node-cli-launcher-v2.js";
import {
  NODE_CLI_APPLICATION_MODULE_LOCATOR_V2,
  NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_CLI_BOOTSTRAP_SOURCE_V2,
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_POLICY_V2,
  NODE_CLI_LAUNCHER_ABI_POLICY_V2_SCHEMA,
  NODE_CLI_LAUNCHER_ABI_REF_V2,
  NODE_CLI_LAUNCHER_EXPORT_V2,
  NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCHER_REF_V2,
  NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2,
  NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2,
  NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2,
  NODE_CLI_LAUNCH_RECEIPT_V2_SCHEMA,
  NodeCliLaunchReceiptV2Schema,
  NodeCliLauncherAbiPolicyV2Schema,
  hashNodeCliLaunchReceiptV2,
  parseNodeCliLaunchReceiptV2,
  type NodeCliLaunchReceiptHashPayloadV2,
  type NodeCliLaunchReceiptV2,
} from "../../src/execution/schemas/node-cli-launcher-v2.js";
import {
  NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
} from "../../src/execution/schemas/network-isolation-negative-probe-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
} from "../../src/execution/schemas/platform-release-common-v2.js";

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

function receipt(): NodeCliLaunchReceiptV2 {
  const identity: NodeCliLaunchReceiptHashPayloadV2 = {
    schema: NODE_CLI_LAUNCH_RECEIPT_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    authorityState: "observed_unverified_release_candidate",
    productionUse: "forbidden_until_verified_release_join",
    admissionScope: "test_fixture",
    launcher: {
      launcherRef: NODE_CLI_LAUNCHER_REF_V2,
      releaseModuleLocator: NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
      requiredExport: NODE_CLI_LAUNCHER_EXPORT_V2,
      abiRef: NODE_CLI_LAUNCHER_ABI_REF_V2,
      abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
      observedImplementation: {
        scope: "test_fixture_typescript_source",
        moduleLocator: NODE_CLI_LAUNCHER_SOURCE_MODULE_LOCATOR_V2,
        moduleContentHash: sha("launcher-module-content"),
        modulePhysicalIdentityHash: sha("launcher-module-physical"),
      },
    },
    candidate: {
      runtimeBundleHash: sha("runtime-bundle"),
      runtimeBundleClosureHash: sha("runtime-bundle-closure"),
      buildReceiptHash: sha("build-receipt"),
      applicationTreeHash: sha("application-tree"),
      materializationHash: sha("materialization"),
      moduleLocator: NODE_CLI_APPLICATION_MODULE_LOCATOR_V2,
      moduleContentHash: sha("candidate-module-content"),
      moduleByteLength: 2_048,
      moduleMode: "0444",
      modulePhysicalIdentityHash: sha("candidate-module-physical"),
    },
    transport: {
      actionRef: "ACTION_CREATE_TASK",
      contractHash: sha("transport-contract"),
      contractSetHash: sha("transport-contract-set"),
      contractMembershipHash: sha("transport-contract-membership"),
      runtimeSourceLogicalReceiptHash: sha("runtime-source-logical-receipt"),
      requestHash: sha("transport-request"),
      argvTokenCount: 2,
      argvByteLength: 31,
      stdinContentHash: sha("stdin"),
      stdinByteLength: 19,
    },
    execution: {
      hostToolchainReceiptHash: sha("host-toolchain-receipt"),
      nodeIdentityHash: sha("node-identity"),
      nodeExecutableContentHash: sha("node-executable-content"),
      sandboxExecutableContentHash: sha("sandbox-executable-content"),
      sandboxExecutablePhysicalIdentityHash: sha("sandbox-executable-physical"),
      sandboxProfileHash: sha("sandbox-profile"),
      bootstrapSourceHash: NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
      normalizedEnvironmentHash:
        NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
      environmentInstanceHash: sha("environment-instance"),
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
    startedAt: "2026-07-26T10:00:00.000Z",
    finishedAt: "2026-07-26T10:00:00.123Z",
    durationMs: 123,
    process: {
      pid: 42_424,
      termination: {
        status: "exited",
        exitCode: 0,
        signal: null,
      },
      stdout: {
        contentHash: sha("stdout"),
        byteLength: 17,
      },
      stderr: {
        contentHash: sha("stderr"),
        byteLength: 0,
      },
    },
  };
  return {
    ...identity,
    receiptHash: hashNodeCliLaunchReceiptV2(identity),
  };
}

function rehash(value: NodeCliLaunchReceiptV2): void {
  value.receiptHash = hashNodeCliLaunchReceiptV2(value);
}

test("Node CLI ABI is one exact frozen code-owned launcher policy", () => {
  assert.equal(
    NodeCliLauncherAbiPolicyV2Schema.safeParse(
      clone(NODE_CLI_LAUNCHER_ABI_POLICY_V2),
    ).success,
    true,
  );
  assert.equal(
    NODE_CLI_LAUNCHER_ABI_POLICY_V2.schema,
    NODE_CLI_LAUNCHER_ABI_POLICY_V2_SCHEMA,
  );
  assert.equal(
    NODE_CLI_LAUNCHER_ABI_POLICY_V2.abiHash,
    NODE_CLI_LAUNCHER_ABI_HASH_V2,
  );
  assert.deepEqual(NODE_CLI_LAUNCHER_ABI_POLICY_V2.nodeOptionTokens, ["-e"]);
  assert.deepEqual(
    NODE_CLI_LAUNCHER_ABI_POLICY_V2.candidateVisibleExecArgv,
    [],
  );
  assert.equal(
    NODE_CLI_LAUNCHER_ABI_POLICY_V2.bootstrapSourceHash,
    createHash("sha256").update(NODE_CLI_BOOTSTRAP_SOURCE_V2).digest("hex"),
  );
  assert.equal(NODE_CLI_LAUNCHER_ABI_POLICY_V2.ambientEnvironment, "forbidden");
  assert.equal(NODE_CLI_LAUNCHER_ABI_POLICY_V2.shell, "forbidden");
  assert.equal(
    NODE_CLI_LAUNCHER_ABI_POLICY_V2.productionAdmission,
    "current_activated_platform_release_and_candidate_execution_lease_required",
  );
  assertRecursivelyFrozen(NODE_CLI_LAUNCHER_ABI_POLICY_V2);

  const changedTimeout = clone(NODE_CLI_LAUNCHER_ABI_POLICY_V2) as unknown as
    Record<string, unknown>;
  changedTimeout.timeoutMs = 30_001;
  changedTimeout.abiHash = sha("self-consistent-forgery");
  assert.equal(
    NodeCliLauncherAbiPolicyV2Schema.safeParse(changedTimeout).success,
    false,
  );
  assert.equal(
    NodeCliLauncherAbiPolicyV2Schema.safeParse({
      ...NODE_CLI_LAUNCHER_ABI_POLICY_V2,
      callerEnvironment: { TOKEN: "forbidden" },
    }).success,
    false,
  );
});

test("Node CLI receipt is strict, bounded, pathless, hash-bound, and frozen", () => {
  const value = receipt();
  assert.equal(NodeCliLaunchReceiptV2Schema.safeParse(value).success, true);
  const parsed = parseNodeCliLaunchReceiptV2(clone(value));
  assert.deepEqual(parsed, value);
  assert.notStrictEqual(parsed, value);
  assertRecursivelyFrozen(parsed);
  assert.equal(parsed.authorityState, "observed_unverified_release_candidate");
  assert.equal(
    parsed.productionUse,
    "forbidden_until_verified_release_join",
  );
  assert.equal(parsed.execution.sourceFenceBeforeHash,
    parsed.execution.sourceFenceAfterHash);

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
  ]) {
    assert.equal(canonical.includes(`\"${forbidden}\"`), false, forbidden);
  }

  const staleHash = clone(value);
  staleHash.process.stdout.byteLength += 1;
  assert.equal(NodeCliLaunchReceiptV2Schema.safeParse(staleHash).success, false);

  const drifted = clone(value);
  drifted.execution.sourceFenceAfterHash = sha("drifted-source-fence");
  rehash(drifted);
  assert.equal(NodeCliLaunchReceiptV2Schema.safeParse(drifted).success, false);

  const falseDuration = clone(value);
  falseDuration.durationMs += 1;
  rehash(falseDuration);
  assert.equal(
    NodeCliLaunchReceiptV2Schema.safeParse(falseDuration).success,
    false,
  );

  const oversizedOutput = clone(value);
  oversizedOutput.process.stdout.byteLength =
    NODE_CLI_LAUNCH_MAX_OUTPUT_BYTES_V2 + 1;
  rehash(oversizedOutput);
  assert.equal(
    NodeCliLaunchReceiptV2Schema.safeParse(oversizedOutput).success,
    false,
  );

  const oversizedArgv = clone(value);
  oversizedArgv.transport.argvByteLength = NODE_CLI_LAUNCH_MAX_ARGV_BYTES_V2 + 1;
  rehash(oversizedArgv);
  assert.equal(NodeCliLaunchReceiptV2Schema.safeParse(oversizedArgv).success, false);

  const oversizedStdin = clone(value);
  oversizedStdin.transport.stdinByteLength =
    NODE_CLI_LAUNCH_MAX_STDIN_BYTES_V2 + 1;
  rehash(oversizedStdin);
  assert.equal(
    NodeCliLaunchReceiptV2Schema.safeParse(oversizedStdin).success,
    false,
  );

  const extraAuthority = {
    ...value,
    absolutePath: "/private/candidate-bundle/application/cli.js",
  };
  assert.equal(
    NodeCliLaunchReceiptV2Schema.safeParse(extraAuthority).success,
    false,
  );
});

test("bounded receipt parser rejects accessors, cycles, and proxies without invoking them", () => {
  const value = receipt();
  const cyclic: Record<string, unknown> = { ...value };
  cyclic.self = cyclic;
  assert.throws(() => parseNodeCliLaunchReceiptV2(cyclic));

  let accessorCalls = 0;
  const accessor = { ...value };
  Object.defineProperty(accessor, "hidden", {
    enumerable: true,
    get() {
      accessorCalls += 1;
      return "forbidden";
    },
  });
  assert.throws(() => parseNodeCliLaunchReceiptV2(accessor));
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
  assert.throws(() => parseNodeCliLaunchReceiptV2(hostile));
  assert.equal(proxyTraps, 0);
});

test("Node CLI ABI and receipt hashes have stable domain-separated goldens", () => {
  const value = receipt();
  const actual = {
    bootstrapSourceHash: NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
    launcherAbiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
    launchReceiptHash: value.receiptHash,
    abiCanonicalBytes:
      canonicalJsonBytes(NODE_CLI_LAUNCHER_ABI_POLICY_V2).byteLength,
    receiptCanonicalBytes: canonicalJsonBytes(value).byteLength,
  };
  assert.deepEqual(actual, {
    bootstrapSourceHash: "b46ffedfd573ebf2d71af1c1704eed055979c1117adbe70b36512e8b3a595fb1",
    launcherAbiHash: "1a41c1f39b8912fec37f314da3d36d010f212648898e537541323a82b6db46dd",
    launchReceiptHash: "4734998a3d91f8256e3fd9a61bb2a8d287be5684c6cd2eec0803272cfa4980af",
    abiCanonicalBytes: 1_928,
    receiptCanonicalBytes: 3_903,
  });
  assert.equal(
    new Set([
      actual.bootstrapSourceHash,
      actual.launcherAbiHash,
      actual.launchReceiptHash,
    ]).size,
    3,
  );
});

test("schema module exports no process executor or private byte authority", () => {
  const exportNames = Object.keys(launcherSchemaModule);
  for (const forbidden of [
    "execute",
    "spawn",
    "launchNodeCliV2",
    "copyNodeCliLaunchCaptureBytesV2ForTest",
  ]) {
    assert.equal(exportNames.includes(forbidden), false);
  }
});

test("operational launcher boundary rejects forged, accessor, and proxied authority without side effects", async () => {
  assert.throws(
    () => new NodeCliLaunchAuthorityV2({}, {} as never),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );
  assert.throws(
    () => new NodeCliLaunchObservationV2({}, {} as never),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );

  let nestedProxyTraps = 0;
  const proxiedRuntime = new Proxy({}, {
    getPrototypeOf() {
      nestedProxyTraps += 1;
      throw new Error("nested runtime proxy trap must not run");
    },
  });
  await assert.rejects(
    issueNodeCliLaunchAuthorityV2ForTest({
      runtimeAuthority: proxiedRuntime,
      expectedBundleHash: sha("runtime-bundle"),
      actionRef: "ACTION_CREATE_TASK",
    }),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
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
    issueNodeCliLaunchAuthorityV2ForTest(accessor),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_INPUT_INVALID",
  );
  assert.equal(accessorCalls, 0);

  const forgedAuthority = Object.create(
    NodeCliLaunchAuthorityV2.prototype,
  ) as NodeCliLaunchAuthorityV2;
  await assert.rejects(
    launchNodeCliV2({
      authority: forgedAuthority,
      encodedRequest: {},
    }),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );

  const forgedObservation = Object.create(
    NodeCliLaunchObservationV2.prototype,
  ) as NodeCliLaunchObservationV2;
  assert.throws(
    () => copyNodeCliLaunchCaptureBytesV2ForTest(forgedObservation),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );
  assert.throws(
    () => destroyNodeCliLaunchObservationV2(forgedObservation),
    (error: unknown) => error instanceof NodeCliLauncherErrorV2
      && error.code === "NODE_CLI_LAUNCHER_V2_AUTHORITY_UNAUTHENTICATED",
  );
});
