import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalJsonStringify } from "../../src/product-compiler/canonical-json.js";
import { getStackPack } from "../../src/installer/stack-contract/packs.js";
import {
  NodeExecutionLayoutCodeAuthorityErrorV2,
  NodeExecutionLayoutCatalogVerificationErrorV2,
  NodeExecutionLayoutVerificationErrorV2,
  getCodeOwnedNodeExecutionLayoutCatalogV2,
  getCodeOwnedNodeExecutionLayoutV2,
  nodeExecutionLayoutCatalogHashV2,
  resolveNodeExecutionLayoutV2,
  verifyNodeExecutionLayoutCatalogV2,
  verifyNodeExecutionLayoutV2,
} from "../../src/product-compiler/node-execution-layout-catalog-v2.js";
import {
  hashProductDeliverySelectionV2,
  resolveProductDeliverySelectionV2,
  type ProductDeliverySelectionV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2,
  NODE_EXECUTION_LAYOUT_CATALOG_MAX_CANONICAL_BYTES_V2,
  NODE_EXECUTION_LAYOUT_REFS_V2,
  NodeExecutionLayoutCatalogV2Schema,
  NodeExecutionLayoutV2Schema,
  hashLegacyInstallerExecutionObservationV1,
  hashNodeExecutionLayoutCatalogV2,
  hashNodeExecutionPathSlotSetV2,
  hashNodeExecutionLayoutV2,
  type NodeExecutionLayoutCatalogV2,
  type NodeExecutionLayoutV2,
} from "../../src/product-compiler/schemas/node-execution-layout-catalog-v2.js";
import type { ProductSpecV2 } from "../../src/product-compiler/schemas/product-spec-v2.js";
import { getStackTopologyCatalogContract } from "../../src/product-compiler/stack-topology-catalog.js";
import {
  genuineNodeCliProductSpecV2,
  genuineNodeExpressApiProductSpecV2,
} from "./fixtures/no-design-product-semantics-v2.js";

const CATALOG_HASH_GOLDEN_V2 =
  "f12dc89562b890016d8f86f942cc274e225b944922bdab4590b163e184b9eb97";
const CLI_LAYOUT_HASH_GOLDEN_V2 =
  "16a3e3096469316b0098c7aa56084833144fad0c8b10d1a0dcb96f47e3197f08";
const API_LAYOUT_HASH_GOLDEN_V2 =
  "e6e26a2793362b20058223a0485e71c8cb466227a48fb80513f17591d17d284d";
const CLI_PATH_SLOT_SET_HASH_GOLDEN_V2 =
  "99c4b3c6a4beb37b7ee7a75033737dc494a57ecb3c61adb1b1d27400c200a1b8";
const API_PATH_SLOT_SET_HASH_GOLDEN_V2 =
  "ea778a2956cf3215f34ce7f5953e7e864c881e2e079e58c11093c7036061a307";
const CLI_LEGACY_OBSERVATION_HASH_GOLDEN_V1 =
  "1f5276ee122ec98b0ee3e98c3722c9b42c9db6cb3885f5c9062359e259bdf175";
const API_LEGACY_OBSERVATION_HASH_GOLDEN_V1 =
  "d2933e8a8b986f1a9d86c8cc84ba541d8e9b19f818bcc6bbb522a6ea8bb93438";

function selectionFor(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
): ProductDeliverySelectionV2 {
  const result = resolveProductDeliverySelectionV2({
    productSpec,
    requestedStackPackId,
  });
  assert.equal(
    result.status,
    "shadow_selected",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_selected") throw new Error("Expected selection");
  return result.selection;
}

function authority(
  productSpec: ProductSpecV2,
  requestedStackPackId: "node-cli" | "node-express-api",
) {
  const deliverySelection = selectionFor(productSpec, requestedStackPackId);
  const result = resolveNodeExecutionLayoutV2({ productSpec, deliverySelection });
  assert.equal(
    result.status,
    "shadow_resolved",
    result.status === "rejected" ? JSON.stringify(result.diagnostics) : undefined,
  );
  if (result.status !== "shadow_resolved") throw new Error("Expected layout");
  return { productSpec, deliverySelection, result, layout: result.layout };
}

function assertRecursivelyFrozen(value: unknown): void {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    assert.equal(Object.isFrozen(current), true);
    pending.push(...Object.values(current));
  }
}

function assertCatalogVerificationError(
  operation: () => unknown,
  code: NodeExecutionLayoutCatalogVerificationErrorV2["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof NodeExecutionLayoutCatalogVerificationErrorV2
      && error.code === code,
  );
}

function assertLayoutVerificationError(
  operation: () => unknown,
  code: NodeExecutionLayoutVerificationErrorV2["code"],
): void {
  assert.throws(
    operation,
    (error: unknown) =>
      error instanceof NodeExecutionLayoutVerificationErrorV2
      && error.code === code,
  );
}

function rehashLayout(candidate: NodeExecutionLayoutV2): NodeExecutionLayoutV2 {
  candidate.layoutHash = hashNodeExecutionLayoutV2(candidate);
  return candidate;
}

function rehashPathSlots(candidate: any): void {
  candidate.pathSlots.slotSetHash = hashNodeExecutionPathSlotSetV2(
    candidate.pathSlots,
  );
}

function rehashCatalog(
  candidate: NodeExecutionLayoutCatalogV2,
): NodeExecutionLayoutCatalogV2 {
  candidate.catalogHash = hashNodeExecutionLayoutCatalogV2(candidate);
  return candidate;
}

describe("NodeExecutionLayoutCatalogV2 code-owned authority", () => {
  it("owns exactly two canonical, immutable, domain-hashed shadow layouts", () => {
    const catalog = getCodeOwnedNodeExecutionLayoutCatalogV2();

    assert.equal(catalog.schema, "setfarm.node-execution-layout-catalog.v2");
    assert.equal(catalog.catalogVersion, "2.1.0");
    assert.equal(catalog.readiness.status, "shadow");
    assert.equal(catalog.readiness.productionUse, "forbidden");
    assert.deepEqual(catalog.readiness.blockerCodes, NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2);
    assert.equal(catalog.layoutCount, 2);
    assert.deepEqual(catalog.layouts.map((layout) => layout.layoutRef), NODE_EXECUTION_LAYOUT_REFS_V2);
    assert.equal(catalog.catalogHash, CATALOG_HASH_GOLDEN_V2);
    assert.equal(catalog.catalogHash, nodeExecutionLayoutCatalogHashV2());
    assert.equal(catalog.catalogHash, hashNodeExecutionLayoutCatalogV2(catalog));
    assert.deepEqual(
      catalog.layouts.map((layout) => layout.layoutHash),
      [CLI_LAYOUT_HASH_GOLDEN_V2, API_LAYOUT_HASH_GOLDEN_V2],
    );
    catalog.layouts.forEach((layout) => {
      assert.equal(layout.layoutHash, hashNodeExecutionLayoutV2(layout));
      assert.equal(layout.pathSlots.slotContractVersion, "2.1.0");
    });
    assert.equal(NodeExecutionLayoutCatalogV2Schema.safeParse(catalog).success, true);
    assertRecursivelyFrozen(catalog);
  });

  it("binds one exact CLI source, output, candidate module, and argv ABI", () => {
    const cli = getCodeOwnedNodeExecutionLayoutV2(
      "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    );
    assert.ok(cli);
    assert.equal(cli.kind, "cli");
    assert.equal(cli.pathSlots.slotSetHash, CLI_PATH_SLOT_SET_HASH_GOLDEN_V2);
    assert.deepEqual(cli.pathSlots.packageLockJson, {
      slotRef: "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
      namespace: "repository_config",
      disposition: "planned",
      nodeKind: "file",
      locator: "package-lock.json",
      underRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
    });
    assert.deepEqual({
      source: cli.pathSlots.sourceEntrypoint.locator,
      output: cli.pathSlots.buildOutput.locator,
      candidate: cli.pathSlots.candidateModule.locator,
    }, {
      source: "src/cli.ts",
      output: "dist/cli.js",
      candidate: "candidate-bundle/application/cli.js",
    });
    assert.deepEqual(cli.sourceToRuntime, {
      sourcePathSlotRef: "PATH_SLOT_NODE_CLI_SOURCE_ENTRYPOINT_V2",
      buildOutputPathSlotRef: "PATH_SLOT_NODE_CLI_BUILD_OUTPUT_V2",
      candidateModulePathSlotRef: "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
      sourceMediaType: "text/typescript",
      outputMediaType: "text/javascript",
      moduleSystem: "node_esm",
    });
    assert.deepEqual(
      cli.topologyBinding.historicalEntrypointPathSlotRefs,
      ["PATH_SLOT_NODE_CLI_HISTORICAL_INDEX_V2"],
    );
    assert.deepEqual(
      cli.pathSlots.historicalRejectedEntrypoints.map((slot) => ({
        disposition: slot.disposition,
        locator: slot.locator,
      })),
      [{ disposition: "reject_only", locator: "src/index.ts" }],
    );
    assert.deepEqual(cli.runtimeTarget, {
      kind: "cli",
      entrypointAbi: "NODE_ESM_CLI_ENTRYPOINT_ABI_V2",
      argvOwnership: "executable_invocation_transport_binding_v2",
      nodeOptionTokens: [],
      moduleArgumentPathSlotRef: "PATH_SLOT_NODE_CLI_CANDIDATE_MODULE_V2",
      transportArguments: "append_after_module",
    });
  });

  it("binds one exact Express handler export and platform-owned listener ABI", () => {
    const api = getCodeOwnedNodeExecutionLayoutV2(
      "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
    );
    assert.ok(api);
    assert.equal(api.kind, "http_handler");
    assert.equal(api.pathSlots.slotSetHash, API_PATH_SLOT_SET_HASH_GOLDEN_V2);
    assert.equal(api.pathSlots.packageLockJson.locator, "package-lock.json");
    assert.deepEqual({
      source: api.pathSlots.sourceEntrypoint.locator,
      output: api.pathSlots.buildOutput.locator,
      candidate: api.pathSlots.candidateModule.locator,
    }, {
      source: "src/app.ts",
      output: "dist/app.js",
      candidate: "candidate-bundle/application/app.js",
    });
    assert.deepEqual(api.sourceToRuntime, {
      sourcePathSlotRef: "PATH_SLOT_NODE_API_SOURCE_ENTRYPOINT_V2",
      buildOutputPathSlotRef: "PATH_SLOT_NODE_API_BUILD_OUTPUT_V2",
      candidateModulePathSlotRef: "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
      sourceMediaType: "text/typescript",
      outputMediaType: "text/javascript",
      moduleSystem: "node_esm",
    });
    assert.deepEqual(
      api.topologyBinding.historicalEntrypointPathSlotRefs,
      [
        "PATH_SLOT_NODE_API_HISTORICAL_ROOT_SERVER_V2",
        "PATH_SLOT_NODE_API_HISTORICAL_SOURCE_SERVER_V2",
      ],
    );
    assert.deepEqual(api.runtimeTarget, {
      kind: "http_handler",
      modulePathSlotRef: "PATH_SLOT_NODE_API_CANDIDATE_MODULE_V2",
      exportName: "setfarmHttpHandlerV2",
      handlerAbi: "EXPRESS_REQUEST_HANDLER_ABI_V2",
      serverOwnership: "platform_owned",
      listenerOwnership: "platform_owned",
      socketOwnership: "platform_owned",
      candidateListen: "forbidden",
    });
  });

  it("binds the same exact compiler and direct build contract for both profiles", () => {
    const catalog = getCodeOwnedNodeExecutionLayoutCatalogV2();
    for (const layout of catalog.layouts) {
      assert.deepEqual(layout.compilerContract, {
        packageJsonPathSlotRef: "PATH_SLOT_NODE_PACKAGE_JSON_V2",
        packageType: "module",
        packageBuildScriptName: "build",
        compilerExecutable: "tsc",
        compilerExecutableRef: "TOOL_NODE_TYPESCRIPT_TSC_V2",
        compilerArguments: [
          { kind: "literal", value: "-p" },
          {
            kind: "path_slot",
            pathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
          },
        ],
        tsconfigPathSlotRef: "PATH_SLOT_NODE_TSCONFIG_JSON_V2",
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        sourceRootRef: "PATH_ROOT_NODE_SOURCE_V2",
        outputRootRef: "PATH_ROOT_NODE_BUILD_OUTPUT_V2",
        noEmitOnError: true,
      });
      assert.deepEqual(layout.dependencyContract, {
        packageLockJsonPathSlotRef: "PATH_SLOT_NODE_PACKAGE_LOCK_JSON_V2",
        packageManagerExecutableRef: "TOOL_NODE_NPM_CLI_V2",
      });
      assert.deepEqual(layout.topologyBinding.buildCommand, {
        commandRef: "CMD_BUILD",
        commandKind: "build",
        cwdRootRef: "PATH_ROOT_NODE_REPOSITORY_V2",
        executableRef: "TOOL_NODE_NPM_CLI_V2",
        directArgv: ["npm", "run", "build"],
      });
    }
  });

  it("freshly verifies the exact catalog and rejects a schema-valid rehashed forgery", () => {
    const catalog = getCodeOwnedNodeExecutionLayoutCatalogV2();
    const verified = verifyNodeExecutionLayoutCatalogV2(catalog);
    assert.equal(canonicalJsonStringify(verified), canonicalJsonStringify(catalog));
    assertRecursivelyFrozen(verified);

    const forged = structuredClone(catalog);
    forged.layouts[0]!.profileBinding.catalogHash = "0".repeat(64);
    rehashLayout(forged.layouts[0]!);
    rehashCatalog(forged);
    assert.equal(NodeExecutionLayoutCatalogV2Schema.safeParse(forged).success, true);
    assertCatalogVerificationError(
      () => verifyNodeExecutionLayoutCatalogV2(forged),
      "NODE_EXECUTION_LAYOUT_CATALOG_V2_AUTHORITY_MISMATCH",
    );

    const reversed = structuredClone(catalog);
    reversed.layouts.reverse();
    rehashCatalog(reversed);
    assert.equal(NodeExecutionLayoutCatalogV2Schema.safeParse(reversed).success, false);

    const crossDomain = structuredClone(catalog);
    crossDomain.catalogHash = crossDomain.layouts[0]!.layoutHash;
    assert.equal(NodeExecutionLayoutCatalogV2Schema.safeParse(crossDomain).success, false);
  });

  it("does not expose unknown profiles or selectable fallback locators", () => {
    assert.equal(getCodeOwnedNodeExecutionLayoutV2("PROFILE_UNKNOWN"), null);
    const cliTopology = getStackTopologyCatalogContract("node-cli")!;
    const apiTopology = getStackTopologyCatalogContract("node-express-api")!;
    assert.deepEqual(cliTopology.descriptor.buildOutputPaths, []);
    assert.deepEqual(apiTopology.descriptor.buildOutputPaths, ["dist"]);
    assert.ok(NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2.includes(
      "NODE_EXECUTION_LAYOUT_V2_LEGACY_BUILD_OUTPUT_AUTHORITY_UNMIGRATED",
    ));
    assert.ok(NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2.includes(
      "NODE_EXECUTION_LAYOUT_V2_LEGACY_ENTRYPOINT_RESOLVER_UNMIGRATED",
    ));
    assert.ok(NODE_EXECUTION_LAYOUT_BLOCKER_CODES_V2.includes(
      "NODE_EXECUTION_LAYOUT_V2_LEGACY_SCOPE_TARGET_AUTHORITY_UNMIGRATED",
    ));
    assert.equal(
      cliTopology.descriptor.entrypointRules.some((rule) =>
        rule.matcher.kind === "exact" && rule.matcher.path === "src/index.ts"),
      true,
    );
    assert.equal(
      apiTopology.descriptor.entrypointRules[0]!.matcher.kind === "exact"
      && apiTopology.descriptor.entrypointRules[0]!.matcher.path === "src/server.ts",
      true,
    );
    assert.equal(
      getCodeOwnedNodeExecutionLayoutV2("PROFILE_NODE_CLI_STATELESS_EXACT_V2")!
        .pathSlots.sourceEntrypoint.locator,
      "src/cli.ts",
    );
    assert.equal(
      getCodeOwnedNodeExecutionLayoutV2("PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2")!
        .pathSlots.sourceEntrypoint.locator,
      "src/app.ts",
    );
  });

  it("exposes exact legacy installer conflicts as hashed forbidden observations", () => {
    const catalog = getCodeOwnedNodeExecutionLayoutCatalogV2();
    const cli = catalog.layouts[0]!;
    const api = catalog.layouts[1]!;

    assert.deepEqual(cli.legacyInstallerObservation, {
      schema: "setfarm.legacy-installer-execution-observation.v1",
      authorityKind: "compatibility_unmigrated",
      productionUse: "forbidden",
      stackPackId: "node-cli",
      fileContractEntrypointLocators: ["src/cli.ts", "src/index.ts"],
      appShellTargetRule: {
        ruleId: "node-cli.app_shell",
        template: "src/cli.ts",
        allowedRoles: ["app_shell"],
        kind: "single_file",
        companionFiles: [],
      },
      sharedEntrypointLocators: ["src/cli.ts", "src/index.ts"],
      topologyBuildOutputLocators: [],
      sourceDisposition: "canonical_matches_but_fallbacks_unmigrated",
      buildOutputDisposition: "conflicts_with_v2_layout",
      migrationOwner: "build_topology_v2_materializer",
      observationHash: CLI_LEGACY_OBSERVATION_HASH_GOLDEN_V1,
    });
    assert.deepEqual(api.legacyInstallerObservation, {
      schema: "setfarm.legacy-installer-execution-observation.v1",
      authorityKind: "compatibility_unmigrated",
      productionUse: "forbidden",
      stackPackId: "node-express-api",
      fileContractEntrypointLocators: ["src/server.ts", "src/app.ts", "server.ts"],
      appShellTargetRule: {
        ruleId: "node-api.app_shell",
        template: "src/server.ts",
        allowedRoles: ["app_shell"],
        kind: "single_file",
        companionFiles: [],
      },
      sharedEntrypointLocators: ["src/server.ts", "src/app.ts"],
      topologyBuildOutputLocators: ["dist"],
      sourceDisposition: "conflicts_with_v2_layout",
      buildOutputDisposition: "matches_v2_layout",
      migrationOwner: "build_topology_v2_materializer",
      observationHash: API_LEGACY_OBSERVATION_HASH_GOLDEN_V1,
    });
    assert.equal(
      cli.legacyInstallerObservation.observationHash,
      hashLegacyInstallerExecutionObservationV1(cli.legacyInstallerObservation),
    );
    assert.equal(
      api.legacyInstallerObservation.observationHash,
      hashLegacyInstallerExecutionObservationV1(api.legacyInstallerObservation),
    );
    assert.notEqual(
      api.legacyInstallerObservation.appShellTargetRule.template,
      api.pathSlots.sourceEntrypoint.locator,
    );
  });

  it("fails closed on process-local legacy installer authority drift", () => {
    const pack = getStackPack("node-express-api");
    const originalEntrypoints = [...pack.fileContract.entrypoints];
    const originalTemplate = pack.targetResolutionRules!.app_shell.template;
    const originalSharedFiles = [
      ...pack.implementationBoundaries!.sharedFiles,
    ];
    try {
      pack.targetResolutionRules!.app_shell.template = "src/app.ts";
      assert.throws(
        () => getCodeOwnedNodeExecutionLayoutCatalogV2(),
        (error: unknown) =>
          error instanceof NodeExecutionLayoutCodeAuthorityErrorV2
          && error.code === "NODE_EXECUTION_LAYOUT_V2_CODE_AUTHORITY_DRIFT",
      );
      pack.targetResolutionRules!.app_shell.template = originalTemplate;

      pack.fileContract.entrypoints.reverse();
      assert.throws(
        () => getCodeOwnedNodeExecutionLayoutCatalogV2(),
        NodeExecutionLayoutCodeAuthorityErrorV2,
      );
      pack.fileContract.entrypoints.splice(
        0,
        pack.fileContract.entrypoints.length,
        ...originalEntrypoints,
      );

      pack.implementationBoundaries!.sharedFiles.shift();
      assert.throws(
        () => getCodeOwnedNodeExecutionLayoutCatalogV2(),
        NodeExecutionLayoutCodeAuthorityErrorV2,
      );
    } finally {
      pack.targetResolutionRules!.app_shell.template = originalTemplate;
      pack.fileContract.entrypoints.splice(
        0,
        pack.fileContract.entrypoints.length,
        ...originalEntrypoints,
      );
      pack.implementationBoundaries!.sharedFiles.splice(
        0,
        pack.implementationBoundaries!.sharedFiles.length,
        ...originalSharedFiles,
      );
    }
    assert.equal(
      getCodeOwnedNodeExecutionLayoutCatalogV2().catalogHash,
      CATALOG_HASH_GOLDEN_V2,
    );
  });
});

describe("NodeExecutionLayoutV2 ProductSpec and selection resolution", () => {
  it("freshly resolves genuine CLI and API authorities without caller paths", () => {
    const cli = authority(genuineNodeCliProductSpecV2(), "node-cli");
    const api = authority(genuineNodeExpressApiProductSpecV2(), "node-express-api");

    assert.equal(cli.result.layoutHash, CLI_LAYOUT_HASH_GOLDEN_V2);
    assert.equal(api.result.layoutHash, API_LAYOUT_HASH_GOLDEN_V2);
    assert.equal(cli.result.catalogHash, CATALOG_HASH_GOLDEN_V2);
    assert.equal(api.result.catalogHash, CATALOG_HASH_GOLDEN_V2);
    assert.equal(
      cli.result.deliverySelectionHash,
      hashProductDeliverySelectionV2(cli.deliverySelection),
    );
    assert.equal(
      api.result.deliverySelectionHash,
      hashProductDeliverySelectionV2(api.deliverySelection),
    );
    assert.equal(cli.result.canonicalBytes, canonicalJsonStringify(cli.layout));
    assertRecursivelyFrozen(cli.result);
    assertRecursivelyFrozen(api.result);
  });

  it("freshly verifies exact CLI and API layout candidates", () => {
    const cli = authority(genuineNodeCliProductSpecV2(), "node-cli");
    const api = authority(genuineNodeExpressApiProductSpecV2(), "node-express-api");

    const verifiedCli = verifyNodeExecutionLayoutV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      candidate: cli.layout,
    });
    const verifiedApi = verifyNodeExecutionLayoutV2({
      productSpec: api.productSpec,
      deliverySelection: api.deliverySelection,
      candidate: api.layout,
    });
    assert.equal(verifiedCli.status, "verified_shadow");
    assert.equal(verifiedApi.status, "verified_shadow");
    assert.equal(verifiedCli.layoutHash, CLI_LAYOUT_HASH_GOLDEN_V2);
    assert.equal(verifiedApi.layoutHash, API_LAYOUT_HASH_GOLDEN_V2);
    assertRecursivelyFrozen(verifiedCli);
    assertRecursivelyFrozen(verifiedApi);
  });

  it("rejects a schema-valid, self-consistently rehashed layout forgery", () => {
    const cli = authority(genuineNodeCliProductSpecV2(), "node-cli");
    const forged = structuredClone(cli.layout);
    forged.stackPackBinding.stackPackVersion = "1.6.1";
    rehashLayout(forged);
    assert.equal(NodeExecutionLayoutV2Schema.safeParse(forged).success, true);

    assertLayoutVerificationError(
      () => verifyNodeExecutionLayoutV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: forged,
      }),
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects cross-ProductSpec selections and cross-profile candidate layouts", () => {
    const cliSpec = genuineNodeCliProductSpecV2();
    const apiSpec = genuineNodeExpressApiProductSpecV2();
    const cli = authority(cliSpec, "node-cli");
    const api = authority(apiSpec, "node-express-api");

    const crossSelection = resolveNodeExecutionLayoutV2({
      productSpec: cliSpec,
      deliverySelection: api.deliverySelection,
    });
    assert.equal(crossSelection.status, "rejected");
    if (crossSelection.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(
      crossSelection.diagnostics[0]!.code,
      "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH",
    );

    assertLayoutVerificationError(
      () => verifyNodeExecutionLayoutV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: api.layout,
      }),
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects a stale same-profile selection after ProductSpec authority changes", () => {
    const original = genuineNodeCliProductSpecV2();
    const deliverySelection = selectionFor(original, "node-cli");
    const changed = structuredClone(original);
    changed.product.name = "Renamed Task CLI";

    const result = resolveNodeExecutionLayoutV2({
      productSpec: changed,
      deliverySelection,
    });
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(
      result.diagnostics[0]!.code,
      "NODE_EXECUTION_LAYOUT_V2_DELIVERY_SELECTION_AUTHORITY_MISMATCH",
    );
  });

  it("rejects every historical API source and rehashed output/module/export ABI drift", () => {
    const api = authority(
      genuineNodeExpressApiProductSpecV2(),
      "node-express-api",
    );
    const mutations: Array<(candidate: any) => void> = [
      (candidate) => { candidate.pathSlots.packageLockJson.locator = "npm-shrinkwrap.json"; },
      (candidate) => {
        candidate.dependencyContract.packageLockJsonPathSlotRef =
          "PATH_SLOT_NODE_PACKAGE_JSON_V2";
      },
      (candidate) => {
        candidate.dependencyContract.packageManagerExecutableRef =
          "TOOL_NODE_FAKE_NPM_CLI_V2";
      },
      (candidate) => {
        candidate.compilerContract.compilerExecutableRef =
          "TOOL_NODE_FAKE_TYPESCRIPT_TSC_V2";
      },
      (candidate) => {
        candidate.topologyBinding.buildCommand.executableRef =
          "TOOL_NODE_FAKE_NPM_CLI_V2";
      },
      (candidate) => { candidate.pathSlots.sourceEntrypoint.locator = "src/server.ts"; },
      (candidate) => { candidate.pathSlots.sourceEntrypoint.locator = "server.ts"; },
      (candidate) => { candidate.pathSlots.buildOutput.locator = "dist/server.js"; },
      (candidate) => {
        candidate.pathSlots.candidateModule.locator =
          "candidate-bundle/application/server.js";
      },
      (candidate) => { candidate.runtimeTarget.exportName = "default"; },
      (candidate) => {
        candidate.runtimeTarget.handlerAbi = "EXPRESS_APPLICATION_ABI_V2";
      },
    ];
    for (const mutate of mutations) {
      const candidate = structuredClone(api.layout) as any;
      mutate(candidate);
      rehashPathSlots(candidate);
      candidate.layoutHash = hashNodeExecutionLayoutV2(candidate);
      assert.equal(NodeExecutionLayoutV2Schema.safeParse(candidate).success, false);
    }
  });

  it("forbids injected definitions, path overrides, and invented active readiness", () => {
    const cli = authority(genuineNodeCliProductSpecV2(), "node-cli");
    const injected = resolveNodeExecutionLayoutV2({
      productSpec: cli.productSpec,
      deliverySelection: cli.deliverySelection,
      layoutDefinitions: [cli.layout],
    });
    assert.equal(injected.status, "rejected");
    if (injected.status !== "rejected") throw new Error("Expected rejection");
    assert.equal(injected.diagnostics[0]!.code, "NODE_EXECUTION_LAYOUT_V2_INPUT_INVALID");

    const fallback = structuredClone(cli.layout) as any;
    fallback.pathSlots.sourceEntrypoint.locator = "src/index.ts";
    rehashPathSlots(fallback);
    fallback.layoutHash = hashNodeExecutionLayoutV2(fallback);
    assert.equal(NodeExecutionLayoutV2Schema.safeParse(fallback).success, false);

    const active = structuredClone(cli.layout) as any;
    active.readiness.status = "active";
    active.layoutHash = hashNodeExecutionLayoutV2(active);
    assert.equal(NodeExecutionLayoutV2Schema.safeParse(active).success, false);

    const detachedLegacyObservation = structuredClone(cli.layout) as any;
    detachedLegacyObservation.legacyInstallerObservation.observationHash =
      "0".repeat(64);
    detachedLegacyObservation.layoutHash = hashNodeExecutionLayoutV2(
      detachedLegacyObservation,
    );
    assert.equal(
      NodeExecutionLayoutV2Schema.safeParse(detachedLegacyObservation).success,
      false,
    );

    const detachedPathSlots = structuredClone(cli.layout) as any;
    detachedPathSlots.pathSlots.slotSetHash = "0".repeat(64);
    detachedPathSlots.layoutHash = hashNodeExecutionLayoutV2(
      detachedPathSlots,
    );
    assert.equal(NodeExecutionLayoutV2Schema.safeParse(detachedPathSlots).success, false);
  });

  it("bounds proxies, cycles, accessors, and oversized authority inputs", () => {
    let trapCount = 0;
    const proxy = new Proxy({}, {
      ownKeys() {
        trapCount += 1;
        return [];
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        return undefined;
      },
    });
    assert.equal(resolveNodeExecutionLayoutV2(proxy).status, "rejected");
    assert.equal(trapCount, 0);
    assertCatalogVerificationError(
      () => verifyNodeExecutionLayoutCatalogV2(proxy),
      "NODE_EXECUTION_LAYOUT_CATALOG_V2_CANDIDATE_INVALID",
    );
    assert.equal(trapCount, 0);

    const cycle: any = {};
    cycle.self = cycle;
    assert.equal(resolveNodeExecutionLayoutV2(cycle).status, "rejected");

    let accessorCalls = 0;
    const accessor: any = {};
    Object.defineProperty(accessor, "productSpec", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return genuineNodeCliProductSpecV2();
      },
    });
    assert.equal(resolveNodeExecutionLayoutV2(accessor).status, "rejected");
    assert.equal(accessorCalls, 0);

    assert.equal(resolveNodeExecutionLayoutV2({
      padding: "x".repeat(8 * 1024 * 1024),
    }).status, "rejected");
    const oversizedCatalog = NodeExecutionLayoutCatalogV2Schema.safeParse({
      padding: "x".repeat(NODE_EXECUTION_LAYOUT_CATALOG_MAX_CANONICAL_BYTES_V2),
    });
    assert.equal(oversizedCatalog.success, false);
    if (!oversizedCatalog.success) {
      assert.match(oversizedCatalog.error.issues[0]!.message, /bounded work/u);
    }

    const cli = authority(genuineNodeCliProductSpecV2(), "node-cli");
    assertLayoutVerificationError(
      () => verifyNodeExecutionLayoutV2({
        productSpec: cli.productSpec,
        deliverySelection: cli.deliverySelection,
        candidate: proxy,
      }),
      "NODE_EXECUTION_LAYOUT_V2_VERIFICATION_INPUT_INVALID",
    );
    assert.equal(trapCount, 0);
  });
});
