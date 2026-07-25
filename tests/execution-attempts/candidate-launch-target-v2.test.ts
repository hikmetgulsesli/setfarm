import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
  PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
  PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import { canonicalJsonBytes } from "../../src/product-compiler/canonical-json.js";
import * as launchModule from "../../src/execution/schemas/candidate-launch-target-v2.js";
import {
  CANDIDATE_BUNDLED_APPLICATION_MODULE_REF_V2_SCHEMA,
  CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES,
  CANDIDATE_LAUNCH_TARGET_V2_SCHEMA,
  CANDIDATE_NODE_ESM_CLI_TARGET_V2_SCHEMA,
  HTTP_HANDLER_EXPORT_V2_SCHEMA,
  CandidateLaunchTargetV2Schema,
  hashCandidateBundledApplicationModuleRefV2,
  hashCandidateExecutableTransportLaunchBindingV2,
  hashCandidateLaunchTargetV2,
  hashCandidateNodeEsmCliTargetV2,
  hashCandidateRuntimeBundleLaunchBindingV2,
  hashHttpHandlerExportV2,
  parseCandidateLaunchTargetV2,
  type CandidateBundledApplicationModuleRefHashPayloadV2,
  type CandidateExecutableTransportLaunchBindingV2,
  type CandidateLaunchTargetHashPayloadV2,
  type CandidateLaunchTargetV2,
  type CandidateNodeEsmCliTargetHashPayloadV2,
  type CandidateRuntimeBundleLaunchBindingV2,
  type HttpHandlerExportHashPayloadV2,
} from "../../src/execution/schemas/candidate-launch-target-v2.js";
import {
  CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
} from "../../src/execution/schemas/candidate-build-receipt-v2.js";
import {
  NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
} from "../../src/execution/schemas/node-cli-launcher-v2.js";
import {
  CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
  CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
  CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
  CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
  hashCandidateRuntimeApplicationTreeBindingV2,
  type CandidateRuntimeApplicationTreeBindingHashPayloadV2,
  type CandidateRuntimeApplicationTreeBindingV2,
} from "../../src/execution/schemas/candidate-runtime-bundle-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
  createCanonicalRuntimeTreeV2,
} from "../../src/execution/schemas/canonical-runtime-tree-v2.js";
import {
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA,
  EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION,
} from "../../src/product-compiler/schemas/executable-invocation-transport-binding-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";

type TargetKind = "cli" | "http_handler";

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

function allKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (value === null || typeof value !== "object") return output;
  if (Array.isArray(value)) {
    value.forEach((entry) => allKeys(entry, output));
    return output;
  }
  for (const [key, child] of Object.entries(value)) {
    output.add(key);
    allKeys(child, output);
  }
  return output;
}

function moduleLocator(kind: TargetKind): string {
  return kind === "cli"
    ? "candidate-bundle/application/cli.js"
    : "candidate-bundle/application/handlers/task-handler.js";
}

function moduleContentLabel(kind: TargetKind): string {
  return kind === "cli" ? "candidate-cli-module" : "candidate-api-handler-module";
}

function applicationTree(kind: TargetKind) {
  const relativePath = moduleLocator(kind).slice("candidate-bundle/application/".length);
  const segments = relativePath.split("/");
  const entries: Array<
    | { path: string; type: "directory"; mode: "0555" }
    | {
      path: string;
      type: "file";
      mode: "0444";
      executable: false;
      byteLength: number;
      contentHash: string;
    }
  > = [];
  if (segments.length > 1) {
    entries.push({ path: segments[0]!, type: "directory", mode: "0555" });
  }
  entries.push({
    path: relativePath,
    type: "file",
    mode: "0444",
    executable: false,
    byteLength: 32,
    contentHash: sha(moduleContentLabel(kind)),
  });
  return createCanonicalRuntimeTreeV2({
    schema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dist",
    rootMode: "0555",
    entries,
    fileCount: 1,
    directoryCount: entries.length - 1,
    totalBytes: 32,
  });
}

function applicationTreeBinding(kind: TargetKind): CandidateRuntimeApplicationTreeBindingV2 {
  const tree = applicationTree(kind);
  const identity: CandidateRuntimeApplicationTreeBindingHashPayloadV2 = {
    schema: CANDIDATE_RUNTIME_APPLICATION_TREE_BINDING_V2_SCHEMA,
    treeSchema: tree.schema,
    profile: "dist",
    logicalRoot: "candidate-bundle/application",
    treeArtifact: {
      schema: CANDIDATE_CANONICAL_RUNTIME_TREE_ARTIFACT_REF_V2_SCHEMA,
      artifactType: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
      envelopeHash: sha(`${kind}-application-tree-envelope`),
      envelopeByteLength: 2_048,
      producer: {
        pass: "candidate-build-authority-v2",
        codeSha: "abcdef0",
        toolVersions: {
          candidateBuild: "2.1.0",
          candidateSource: "1.0.0",
          buildTopology: "3.2.0",
          canonicalRuntimeTree: "2.0.0",
        },
      },
    },
    treeHash: tree.treeHash,
    treePayloadHash: tree.payloadHash,
    fileCount: tree.fileCount,
    directoryCount: tree.directoryCount,
    totalBytes: tree.totalBytes,
  };
  return {
    ...identity,
    bindingHash: hashCandidateRuntimeApplicationTreeBindingV2(identity),
  };
}

function sourceAuthority() {
  return {
    schema: CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
    candidateSourceEnvelopeHash: sha("candidate-source-envelope"),
    candidateSourceReceiptHash: sha("candidate-source-receipt"),
    semanticRevisionHash: sha("candidate-source-semantic-revision"),
  } as const;
}

function runtimeBundleBinding(kind: TargetKind): CandidateRuntimeBundleLaunchBindingV2 {
  const applicationTreeBindingValue = applicationTreeBinding(kind);
  const identity: Omit<CandidateRuntimeBundleLaunchBindingV2, "bindingHash"> = {
    runtimeBundleSchema: CANDIDATE_RUNTIME_BUNDLE_V2_SCHEMA,
    runtimeBundleVersion: CANDIDATE_RUNTIME_BUNDLE_V2_VERSION,
    runtimeBundleContractHash: CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2,
    runtimeBundleHash: sha(`${kind}-runtime-bundle`),
    packetEnvelopeHash: sha("candidate-packet-envelope"),
    buildTopologyHash: sha("candidate-build-topology"),
    sourceAuthority: sourceAuthority(),
    applicationTreeBinding: applicationTreeBindingValue,
    applicationTreeBindingHash: applicationTreeBindingValue.bindingHash,
    applicationTreeHash: applicationTreeBindingValue.treeHash,
  };
  return {
    ...identity,
    bindingHash: hashCandidateRuntimeBundleLaunchBindingV2(identity),
  };
}

function executableTransportBinding(
  kind: TargetKind,
): CandidateExecutableTransportLaunchBindingV2 {
  if (kind === "cli") {
    const identity = {
      bindingSchema: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA,
      bindingVersion: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION,
      bindingHash: sha("cli-executable-transport-binding"),
      transportSchema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
      transportContractHash: sha("cli-invocation-transport-contract"),
      transportKind: "cli_command" as const,
    };
    return {
      ...identity,
      transportBindingHash: hashCandidateExecutableTransportLaunchBindingV2(identity),
    };
  }
  const identity = {
    bindingSchema: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_SCHEMA,
    bindingVersion: EXECUTABLE_INVOCATION_TRANSPORT_BINDING_V2_VERSION,
    bindingHash: sha("api-executable-transport-binding"),
    transportSchema: INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
    transportContractHash: sha("api-invocation-transport-contract"),
    transportKind: "http_request" as const,
  };
  return {
    ...identity,
    transportBindingHash: hashCandidateExecutableTransportLaunchBindingV2(identity),
  };
}

function bundledModule(kind: TargetKind) {
  const identity: CandidateBundledApplicationModuleRefHashPayloadV2 = {
    schema: CANDIDATE_BUNDLED_APPLICATION_MODULE_REF_V2_SCHEMA,
    logicalLocator: moduleLocator(kind),
    mediaType: "text/javascript",
    contentHash: sha(moduleContentLabel(kind)),
    byteLength: 32,
    mode: "0444",
  };
  return {
    ...identity,
    moduleRefHash: hashCandidateBundledApplicationModuleRefV2(identity),
  };
}

function cliTarget() {
  const identity: CandidateNodeEsmCliTargetHashPayloadV2 = {
    schema: CANDIDATE_NODE_ESM_CLI_TARGET_V2_SCHEMA,
    kind: "cli",
    module: bundledModule("cli"),
    moduleSystem: "node_esm",
    entrypointAbi: "NODE_ESM_CLI_ENTRYPOINT_ABI_V2",
    argvOwnership: "executable_invocation_transport_binding_v2",
    argvLayout: {
      launcherNodeOptionTokens: ["-e"],
      launcherBootstrapSourceHash: NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
      launcherAbiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
      bootstrapControlArgument:
        "authenticated_config_after_eval_source_hidden_before_candidate_import",
      candidateVisibleNodeOptionTokens: [],
      candidateModuleArgumentLocator: bundledModule("cli").logicalLocator,
      candidateArgvRewrite:
        "node_executable_candidate_module_then_transport_arguments",
      transportArguments:
        "append_after_candidate_module_after_rewrite",
    },
  };
  return { ...identity, targetHash: hashCandidateNodeEsmCliTargetV2(identity) };
}

function httpTarget() {
  const identity: HttpHandlerExportHashPayloadV2 = {
    schema: HTTP_HANDLER_EXPORT_V2_SCHEMA,
    kind: "http_handler",
    module: bundledModule("http_handler"),
    exportName: "handleTaskRequest",
    handlerAbi: "EXPRESS_REQUEST_HANDLER_ABI_V2",
    serverOwnership: "platform_owned",
    listenerOwnership: "platform_owned",
    socketOwnership: "platform_owned",
    candidateListen: "forbidden",
  };
  return { ...identity, exportHash: hashHttpHandlerExportV2(identity) };
}

function launchTarget(kind: "cli"): Extract<CandidateLaunchTargetV2, { kind: "cli" }>;
function launchTarget(
  kind: "http_handler",
): Extract<CandidateLaunchTargetV2, { kind: "http_handler" }>;
function launchTarget(kind: TargetKind): CandidateLaunchTargetV2 {
  const common = {
    schema: CANDIDATE_LAUNCH_TARGET_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState: "candidate_unverified" as const,
    productionUse: "forbidden" as const,
    packetEnvelopeHash: sha("candidate-packet-envelope"),
    buildTopologyHash: sha("candidate-build-topology"),
    sourceAuthority: sourceAuthority(),
    runtimeBundle: runtimeBundleBinding(kind),
  };
  let identity: CandidateLaunchTargetHashPayloadV2;
  if (kind === "cli") {
    identity = {
      ...common,
      kind,
      profile: {
        catalogSchema: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
        profileSchema: PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
        catalogVersion: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
        catalogHash: sha("profile-catalog"),
        profileHash: sha("cli-profile"),
        profileId: "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
      },
      stackPack: {
        stackPackVersion: "2.0.0",
        stackPackContentHash: sha("node-cli-stack-pack"),
        stackPackId: "node-cli",
      },
      launcher: {
        launcherDefinitionHash: sha("cli-launcher-definition"),
        launcherModuleHash: sha("cli-launcher-module"),
        launcherAbiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
        launcherRef: "LAUNCH_NODE_CLI_V2",
      },
      executableTransport: executableTransportBinding("cli") as Extract<
        CandidateExecutableTransportLaunchBindingV2,
        { transportKind: "cli_command" }
      >,
      target: cliTarget(),
    };
  } else {
    identity = {
      ...common,
      kind,
      profile: {
        catalogSchema: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_SCHEMA,
        profileSchema: PRODUCT_DELIVERY_PROFILE_V2_SCHEMA,
        catalogVersion: PRODUCT_DELIVERY_PROFILE_CATALOG_V2_VERSION,
        catalogHash: sha("profile-catalog"),
        profileHash: sha("api-profile"),
        profileId: "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
      },
      stackPack: {
        stackPackVersion: "2.0.0",
        stackPackContentHash: sha("node-express-api-stack-pack"),
        stackPackId: "node-express-api",
      },
      launcher: {
        launcherDefinitionHash: sha("api-launcher-definition"),
        launcherModuleHash: sha("api-launcher-module"),
        launcherAbiHash: sha("api-launcher-abi"),
        launcherRef: "LAUNCH_NODE_EXPRESS_API_V2",
      },
      executableTransport: executableTransportBinding("http_handler") as Extract<
        CandidateExecutableTransportLaunchBindingV2,
        { transportKind: "http_request" }
      >,
      target: httpTarget(),
    };
  }
  return {
    ...identity,
    launchTargetHash: hashCandidateLaunchTargetV2(identity),
  } as CandidateLaunchTargetV2;
}

function rehashCandidate(candidate: CandidateLaunchTargetV2): void {
  candidate.runtimeBundle.packetEnvelopeHash = candidate.packetEnvelopeHash;
  candidate.runtimeBundle.buildTopologyHash = candidate.buildTopologyHash;
  candidate.runtimeBundle.sourceAuthority = clone(candidate.sourceAuthority);
  candidate.runtimeBundle.applicationTreeBinding.bindingHash =
    hashCandidateRuntimeApplicationTreeBindingV2(
      candidate.runtimeBundle.applicationTreeBinding,
    );
  candidate.runtimeBundle.applicationTreeBindingHash =
    candidate.runtimeBundle.applicationTreeBinding.bindingHash;
  candidate.runtimeBundle.applicationTreeHash =
    candidate.runtimeBundle.applicationTreeBinding.treeHash;
  candidate.runtimeBundle.bindingHash =
    hashCandidateRuntimeBundleLaunchBindingV2(candidate.runtimeBundle);
  candidate.executableTransport.transportBindingHash =
    hashCandidateExecutableTransportLaunchBindingV2(candidate.executableTransport);
  candidate.target.module.moduleRefHash =
    hashCandidateBundledApplicationModuleRefV2(candidate.target.module);
  if (candidate.kind === "cli") {
    candidate.target.argvLayout.candidateModuleArgumentLocator =
      candidate.target.module.logicalLocator;
    candidate.target.targetHash = hashCandidateNodeEsmCliTargetV2(candidate.target);
  } else {
    candidate.target.exportHash = hashHttpHandlerExportV2(candidate.target);
  }
  candidate.launchTargetHash = hashCandidateLaunchTargetV2(candidate);
}

test("CLI and HTTP launch candidates bind exact literal projections and parse as frozen data", () => {
  const cli = launchTarget("cli");
  const api = launchTarget("http_handler");
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(cli).success, true);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(api).success, true);
  assert.equal(cli.authorityState, "candidate_unverified");
  assert.equal(cli.productionUse, "forbidden");
  assert.equal("sourceRevision" in cli, false);
  assert.equal(cli.sourceAuthority.semanticRevisionHash,
    cli.runtimeBundle.sourceAuthority.semanticRevisionHash);
  assert.equal(cli.runtimeBundle.runtimeBundleVersion,
    CANDIDATE_RUNTIME_BUNDLE_V2_VERSION);
  assert.equal(cli.runtimeBundle.runtimeBundleContractHash,
    CANDIDATE_RUNTIME_BUNDLE_CONTRACT_HASH_V2);
  assert.equal(cli.profile.profileId, "PROFILE_NODE_CLI_STATELESS_EXACT_V2");
  assert.equal(cli.stackPack.stackPackId, "node-cli");
  assert.equal(cli.launcher.launcherRef, "LAUNCH_NODE_CLI_V2");
  assert.equal(cli.executableTransport.transportKind, "cli_command");
  assert.equal(cli.target.moduleSystem, "node_esm");
  assert.equal(cli.target.entrypointAbi, "NODE_ESM_CLI_ENTRYPOINT_ABI_V2");
  assert.equal(cli.target.argvOwnership,
    "executable_invocation_transport_binding_v2");
  assert.deepEqual(cli.target.argvLayout.launcherNodeOptionTokens, ["-e"]);
  assert.equal(
    cli.target.argvLayout.launcherBootstrapSourceHash,
    NODE_CLI_BOOTSTRAP_SOURCE_HASH_V2,
  );
  assert.equal(
    cli.target.argvLayout.launcherAbiHash,
    NODE_CLI_LAUNCHER_ABI_HASH_V2,
  );
  assert.deepEqual(cli.target.argvLayout.candidateVisibleNodeOptionTokens, []);
  assert.equal(cli.target.argvLayout.candidateModuleArgumentLocator,
    cli.target.module.logicalLocator);
  assert.equal(
    cli.target.argvLayout.candidateArgvRewrite,
    "node_executable_candidate_module_then_transport_arguments",
  );
  assert.equal(
    cli.target.argvLayout.transportArguments,
    "append_after_candidate_module_after_rewrite",
  );
  assert.equal(api.profile.profileId,
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2");
  assert.equal(api.stackPack.stackPackId, "node-express-api");
  assert.equal(api.launcher.launcherRef, "LAUNCH_NODE_EXPRESS_API_V2");
  assert.equal(api.executableTransport.transportKind, "http_request");
  assert.equal(api.target.exportName, "handleTaskRequest");
  assert.equal(api.target.handlerAbi, "EXPRESS_REQUEST_HANDLER_ABI_V2");
  assert.equal(api.target.serverOwnership, "platform_owned");
  assert.equal(api.target.listenerOwnership, "platform_owned");
  assert.equal(api.target.socketOwnership, "platform_owned");
  assert.equal(api.target.candidateListen, "forbidden");
  assert.equal(cli.runtimeBundle.applicationTreeBindingHash,
    cli.runtimeBundle.applicationTreeBinding.bindingHash);
  assert.equal(cli.runtimeBundle.applicationTreeHash,
    cli.runtimeBundle.applicationTreeBinding.treeHash);

  const parsedCli = parseCandidateLaunchTargetV2(clone(cli));
  const parsedApi = parseCandidateLaunchTargetV2(clone(api));
  assert.deepEqual(parsedCli, cli);
  assert.deepEqual(parsedApi, api);
  assert.notStrictEqual(parsedCli, cli);
  assert.notStrictEqual(parsedApi, api);
  assertRecursivelyFrozen(parsedCli);
  assertRecursivelyFrozen(parsedApi);
});

test("nested joins and every domain hash fail closed when only one side changes", () => {
  const staleTreeBinding = launchTarget("cli");
  staleTreeBinding.runtimeBundle.applicationTreeBindingHash = sha("stale-binding");
  staleTreeBinding.runtimeBundle.bindingHash =
    hashCandidateRuntimeBundleLaunchBindingV2(staleTreeBinding.runtimeBundle);
  staleTreeBinding.launchTargetHash = hashCandidateLaunchTargetV2(staleTreeBinding);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleTreeBinding).success, false);

  const staleTreeHash = launchTarget("cli");
  staleTreeHash.runtimeBundle.applicationTreeHash = sha("stale-tree");
  staleTreeHash.runtimeBundle.bindingHash =
    hashCandidateRuntimeBundleLaunchBindingV2(staleTreeHash.runtimeBundle);
  staleTreeHash.launchTargetHash = hashCandidateLaunchTargetV2(staleTreeHash);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleTreeHash).success, false);

  const staleRuntimeHash = launchTarget("cli");
  staleRuntimeHash.runtimeBundle.runtimeBundleHash = sha("other-runtime");
  staleRuntimeHash.launchTargetHash = hashCandidateLaunchTargetV2(staleRuntimeHash);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleRuntimeHash).success, false);

  const staleSourceBinding = launchTarget("cli");
  staleSourceBinding.runtimeBundle.sourceAuthority.semanticRevisionHash =
    sha("other-runtime-source");
  staleSourceBinding.runtimeBundle.bindingHash =
    hashCandidateRuntimeBundleLaunchBindingV2(staleSourceBinding.runtimeBundle);
  staleSourceBinding.launchTargetHash =
    hashCandidateLaunchTargetV2(staleSourceBinding);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleSourceBinding).success,
    false);

  const staleTransportHash = launchTarget("cli");
  staleTransportHash.executableTransport.transportContractHash = sha("other-contract");
  staleTransportHash.launchTargetHash = hashCandidateLaunchTargetV2(staleTransportHash);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleTransportHash).success, false);

  const staleModuleHash = launchTarget("cli");
  staleModuleHash.target.module.contentHash = sha("other-module");
  staleModuleHash.target.targetHash = hashCandidateNodeEsmCliTargetV2(
    staleModuleHash.target,
  );
  staleModuleHash.launchTargetHash = hashCandidateLaunchTargetV2(staleModuleHash);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleModuleHash).success, false);

  const staleTargetHash = launchTarget("http_handler");
  staleTargetHash.target.exportName = "otherHandler";
  staleTargetHash.launchTargetHash = hashCandidateLaunchTargetV2(staleTargetHash);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleTargetHash).success, false);

  const staleRootHash = launchTarget("http_handler");
  staleRootHash.packetEnvelopeHash = sha("other-packet");
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(staleRootHash).success, false);
});

test("the root discriminant structurally rejects every CLI/API cross-combination", () => {
  const cli = launchTarget("cli");
  const api = launchTarget("http_handler");
  const forgeries: unknown[] = [
    { ...cli, profile: api.profile },
    { ...cli, stackPack: api.stackPack },
    { ...cli, launcher: api.launcher },
    { ...cli, executableTransport: api.executableTransport },
    { ...cli, target: api.target },
    { ...api, profile: cli.profile },
    { ...api, stackPack: cli.stackPack },
    { ...api, launcher: cli.launcher },
    { ...api, executableTransport: cli.executableTransport },
    { ...api, target: cli.target },
    { ...cli, kind: "http_handler" },
    { ...api, kind: "cli" },
  ];
  for (const forgery of forgeries) {
    const candidate = forgery as Record<string, unknown>;
    candidate.launchTargetHash = hashCandidateLaunchTargetV2(candidate as never);
    assert.equal(CandidateLaunchTargetV2Schema.safeParse(candidate).success, false);
  }
});

test("self-consistent external-authority changes remain explicitly unverified candidate data", () => {
  const candidate = launchTarget("cli");
  candidate.packetEnvelopeHash = sha("self-consistent-other-packet");
  candidate.buildTopologyHash = sha("self-consistent-other-topology");
  candidate.sourceAuthority = {
    schema: CANDIDATE_RUNTIME_SOURCE_BINDING_V2_SCHEMA,
    candidateSourceEnvelopeHash: sha("self-consistent-other-source-envelope"),
    candidateSourceReceiptHash: sha("self-consistent-other-source-receipt"),
    semanticRevisionHash: sha("self-consistent-other-source-revision"),
  };
  candidate.runtimeBundle.runtimeBundleHash = sha("self-consistent-other-bundle");
  candidate.profile.catalogHash = sha("self-consistent-other-profile-catalog");
  candidate.profile.profileHash = sha("self-consistent-other-profile");
  candidate.stackPack.stackPackVersion = "9.9.9";
  candidate.stackPack.stackPackContentHash = sha("self-consistent-other-stack");
  candidate.launcher.launcherDefinitionHash = sha("self-consistent-other-launcher-def");
  candidate.launcher.launcherModuleHash = sha("self-consistent-other-launcher-module");
  candidate.executableTransport.bindingHash = sha("self-consistent-other-binding");
  candidate.executableTransport.transportContractHash = sha("self-consistent-other-contract");
  candidate.target.module.contentHash = sha("self-consistent-other-module");
  candidate.target.module.byteLength = 64;
  rehashCandidate(candidate);

  const result = CandidateLaunchTargetV2Schema.safeParse(candidate);
  assert.equal(result.success, true);
  if (!result.success) throw new Error("Expected candidate-only self-consistent data");
  assert.equal(result.data.authorityState, "candidate_unverified");
  assert.equal(result.data.productionUse, "forbidden");
  assert.equal("verified" in result.data, false);
});

test("module locators and handler exports reject absolute, traversal, NUL, Unicode, and non-ESM forms", () => {
  const invalidLocators = [
    "/candidate-bundle/application/cli.js",
    "candidate-bundle/application/../cli.js",
    "candidate-bundle/application/chunks\\cli.js",
    "candidate-bundle/application/cli\0hidden.js",
    "candidate-bundle/application/café.js",
    "candidate-bundle/application/\ud800.js",
    "candidate-bundle/node_modules/pkg.js",
    "candidate-bundle/application/cli.cjs",
  ];
  for (const locator of invalidLocators) {
    const candidate = launchTarget("cli");
    candidate.target.module.logicalLocator = locator;
    rehashCandidate(candidate);
    assert.equal(
      CandidateLaunchTargetV2Schema.safeParse(candidate).success,
      false,
      JSON.stringify(locator),
    );
  }

  const validNested = launchTarget("cli");
  validNested.target.module.logicalLocator =
    "candidate-bundle/application/chunks/entry.mjs";
  rehashCandidate(validNested);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(validNested).success, true);

  for (const exportName of ["handler-name", "listen()", "i\u015fle", "bad\0name"]) {
    const candidate = launchTarget("http_handler") as unknown as {
      target: { exportName: string; exportHash: string };
      launchTargetHash: string;
    };
    candidate.target.exportName = exportName;
    candidate.target.exportHash = hashHttpHandlerExportV2(candidate.target as never);
    candidate.launchTargetHash = hashCandidateLaunchTargetV2(candidate as never);
    assert.equal(CandidateLaunchTargetV2Schema.safeParse(candidate).success, false);
  }
});

test("API ownership and CLI argv policies cannot be weakened even with fresh hashes", () => {
  const apiMutations: Array<(candidate: Record<string, unknown>) => void> = [
    (candidate) => {
      (candidate.target as Record<string, unknown>).serverOwnership = "candidate_owned";
    },
    (candidate) => {
      (candidate.target as Record<string, unknown>).listenerOwnership = "candidate_owned";
    },
    (candidate) => {
      (candidate.target as Record<string, unknown>).socketOwnership = "candidate_owned";
    },
    (candidate) => {
      (candidate.target as Record<string, unknown>).candidateListen = "allowed";
    },
    (candidate) => {
      (candidate.target as Record<string, unknown>).handlerAbi = "GENERIC_HTTP_ABI_V1";
    },
  ];
  for (const mutate of apiMutations) {
    const candidate = clone(launchTarget("http_handler")) as unknown as Record<string, unknown>;
    mutate(candidate);
    const target = candidate.target as Record<string, unknown>;
    target.exportHash = hashHttpHandlerExportV2(target as never);
    candidate.launchTargetHash = hashCandidateLaunchTargetV2(candidate as never);
    assert.equal(CandidateLaunchTargetV2Schema.safeParse(candidate).success, false);
  }

  const cli = clone(launchTarget("cli")) as unknown as Record<string, unknown>;
  const cliProjection = cli.target as Record<string, unknown>;
  cliProjection.argvOwnership = "candidate_process";
  cliProjection.targetHash = hashCandidateNodeEsmCliTargetV2(cliProjection as never);
  cli.launchTargetHash = hashCandidateLaunchTargetV2(cli as never);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(cli).success, false);

  const wrongModuleArgument = launchTarget("cli");
  wrongModuleArgument.target.argvLayout.candidateModuleArgumentLocator =
    "candidate-bundle/application/other-entry.js";
  wrongModuleArgument.target.targetHash = hashCandidateNodeEsmCliTargetV2(
    wrongModuleArgument.target,
  );
  wrongModuleArgument.launchTargetHash = hashCandidateLaunchTargetV2(
    wrongModuleArgument,
  );
  assert.equal(
    CandidateLaunchTargetV2Schema.safeParse(wrongModuleArgument).success,
    false,
  );

  const cliPolicyMutations: Array<(argvLayout: Record<string, unknown>) => void> = [
    (argvLayout) => {
      argvLayout.launcherNodeOptionTokens = [];
    },
    (argvLayout) => {
      argvLayout.launcherBootstrapSourceHash = sha("other-bootstrap");
    },
    (argvLayout) => {
      argvLayout.launcherAbiHash = sha("other-cli-launcher-abi");
    },
    (argvLayout) => {
      argvLayout.bootstrapControlArgument = "caller_visible_bootstrap_config";
    },
    (argvLayout) => {
      argvLayout.candidateVisibleNodeOptionTokens = ["-e"];
    },
    (argvLayout) => {
      argvLayout.candidateArgvRewrite = "leave_bootstrap_argv_visible";
    },
    (argvLayout) => {
      argvLayout.transportArguments = "append_after_bootstrap_config";
    },
  ];
  for (const mutate of cliPolicyMutations) {
    const candidate = clone(launchTarget("cli")) as unknown as Record<string, unknown>;
    const target = candidate.target as Record<string, unknown>;
    mutate(target.argvLayout as Record<string, unknown>);
    target.targetHash = hashCandidateNodeEsmCliTargetV2(target as never);
    candidate.launchTargetHash = hashCandidateLaunchTargetV2(candidate as never);
    assert.equal(CandidateLaunchTargetV2Schema.safeParse(candidate).success, false);
  }

  const wrongLauncherAbi = launchTarget("cli");
  wrongLauncherAbi.launcher.launcherAbiHash = sha("other-cli-launcher-abi");
  wrongLauncherAbi.launchTargetHash = hashCandidateLaunchTargetV2(
    wrongLauncherAbi,
  );
  assert.equal(
    CandidateLaunchTargetV2Schema.safeParse(wrongLauncherAbi).success,
    false,
  );
});

test("bounded parser rejects extra authority, oversize, cycles, accessors, and proxies without side effects", () => {
  const candidate = launchTarget("http_handler");
  assert.equal(canonicalJsonBytes(candidate).byteLength
    < CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES, true);
  assert.equal(CandidateLaunchTargetV2Schema.safeParse({
    ...candidate,
    env: { TOKEN: "caller-authored" },
  }).success, false);
  assert.throws(() => parseCandidateLaunchTargetV2({
    ...candidate,
    padding: "x".repeat(CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES),
  }));

  const cyclic: Record<string, unknown> = { ...candidate };
  cyclic.self = cyclic;
  assert.throws(() => parseCandidateLaunchTargetV2(cyclic));

  let accessorCalls = 0;
  const accessor = { ...candidate };
  Object.defineProperty(accessor, "hidden", {
    enumerable: true,
    get() {
      accessorCalls += 1;
      return "forbidden";
    },
  });
  assert.throws(() => parseCandidateLaunchTargetV2(accessor));
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
  assert.equal(CandidateLaunchTargetV2Schema.safeParse(hostile).success, false);
  assert.throws(() => parseCandidateLaunchTargetV2(hostile));
  assert.equal(proxyTraps, 0);
});

test("literal launch hashes are golden and every hash domain is separated", () => {
  const cli = launchTarget("cli");
  const api = launchTarget("http_handler");
  const actual = {
    cliApplicationBindingHash: cli.runtimeBundle.applicationTreeBinding.bindingHash,
    cliRuntimeBindingHash: cli.runtimeBundle.bindingHash,
    cliExecutableBindingHash: cli.executableTransport.transportBindingHash,
    cliModuleRefHash: cli.target.module.moduleRefHash,
    cliTargetHash: cli.target.targetHash,
    cliLaunchTargetHash: cli.launchTargetHash,
    apiApplicationBindingHash: api.runtimeBundle.applicationTreeBinding.bindingHash,
    apiRuntimeBindingHash: api.runtimeBundle.bindingHash,
    apiExecutableBindingHash: api.executableTransport.transportBindingHash,
    apiModuleRefHash: api.target.module.moduleRefHash,
    apiHandlerExportHash: api.target.exportHash,
    apiLaunchTargetHash: api.launchTargetHash,
    cliCanonicalBytes: canonicalJsonBytes(cli).byteLength,
    apiCanonicalBytes: canonicalJsonBytes(api).byteLength,
  };
  assert.deepEqual(actual, {
    cliApplicationBindingHash: "d27489b691eabcfdffc785ad9c8510f6442d0bd5259b3c8039aefcd7f0bcfc7f",
    cliRuntimeBindingHash: "abd770eccf66e2cdf4bd57605860ad3841841663f228e0514431ec8fa3251ec3",
    cliExecutableBindingHash: "6a50196b4ccd0f9ff710e155c0cca9cb88f678cf6cddad2cd8c81da57a6cdfaf",
    cliModuleRefHash: "4f405d08e63be1885c720846b91007d1d0dd2415e1d907fb82b695cef9910abe",
    cliTargetHash: "e014de4ea3028fac7dcfcd2c8d23499d3a28cdadf334fa55998f1242ef930576",
    cliLaunchTargetHash: "c741f608fc916ab50ee600b33fbadeeb8f9f22dd174726fd5025d70386ce2772",
    apiApplicationBindingHash: "d0d742a7163b629e1ed162af75eb22e9c4dbccba8d60a21e9e5e046d6884be15",
    apiRuntimeBindingHash: "8f023a8af1385b92e93f15f7eb7588f8cf5ce1c6c6e3a9987fc12981c6c1d3b5",
    apiExecutableBindingHash: "e7e3af38d3c783697e31b2e810b1ce45531522c34c4e765b388f0c6613ecb768",
    apiModuleRefHash: "a521a1831ef85313ec5b381569396eb6e3e116b6e1380d157f1758307ac61485",
    apiHandlerExportHash: "c4ad9f5c58125077802c566f0703bde7168fb266baa91e280e1bdce9018f053f",
    apiLaunchTargetHash: "836be818d6523adb48dd286f38e709dcee6bbbd6490cb35e85596738891a221f",
    cliCanonicalBytes: 5_319,
    apiCanonicalBytes: 4_861,
  });
  const hashes = Object.entries(actual)
    .filter(([name]) => name.endsWith("Hash"))
    .map(([, value]) => value);
  assert.equal(new Set(hashes).size, hashes.length);
});

test("public DTO surface and payload contain no operational execution authority", () => {
  assert.deepEqual(Object.keys(launchModule).sort(), [
    "CANDIDATE_BUNDLED_APPLICATION_MODULE_REF_V2_SCHEMA",
    "CANDIDATE_LAUNCH_TARGET_V2_MAX_CANONICAL_BYTES",
    "CANDIDATE_LAUNCH_TARGET_V2_SCHEMA",
    "CANDIDATE_NODE_ESM_CLI_TARGET_V2_SCHEMA",
    "CandidateBundledApplicationModuleRefV2Schema",
    "CandidateExecutableTransportLaunchBindingV2Schema",
    "CandidateLaunchTargetV2Schema",
    "CandidateNodeEsmCliTargetV2Schema",
    "CandidateRuntimeBundleLaunchBindingV2Schema",
    "HTTP_HANDLER_EXPORT_V2_SCHEMA",
    "HttpHandlerExportV2Schema",
    "hashCandidateBundledApplicationModuleRefV2",
    "hashCandidateExecutableTransportLaunchBindingV2",
    "hashCandidateLaunchTargetV2",
    "hashCandidateNodeEsmCliTargetV2",
    "hashCandidateRuntimeBundleLaunchBindingV2",
    "hashHttpHandlerExportV2",
    "parseCandidateLaunchTargetV2",
  ]);

  const forbiddenKeys = new Set([
    "absolutePath",
    "worktree",
    "attemptDirectory",
    "attemptId",
    "runId",
    "env",
    "environment",
    "command",
    "cwd",
    "port",
    "origin",
    "baseUrl",
  ]);
  for (const candidate of [launchTarget("cli"), launchTarget("http_handler")]) {
    for (const key of allKeys(candidate)) {
      assert.equal(forbiddenKeys.has(key), false, key);
    }
    assert.equal(candidate.target.module.logicalLocator.startsWith("/"), false);
  }
});
