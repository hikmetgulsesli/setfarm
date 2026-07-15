import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listStackPacks } from "../../src/installer/stack-contract/packs.js";
import {
  STACK_TOPOLOGY_CATALOG_VERSION,
  StackTopologyCatalogDescriptorV1Schema,
  V3_STATIC_SPA_PREVIEW_SOURCE,
  computeStackTopologyCatalogContentHash,
  getStackTopologyCatalogContract,
  isPlatformOwnedV3PreviewCommand,
  listStackTopologyCatalogContracts,
  matchesStackEntrypointRule,
} from "../../src/product-compiler/stack-topology-catalog.js";

describe("versioned stack-topology catalog", () => {
  it("covers every current stack pack exactly once with stable canonical identity", () => {
    const legacyIds = listStackPacks().map((pack) => pack.id).sort();
    const contracts = listStackTopologyCatalogContracts();
    assert.deepEqual(contracts.map((contract) => contract.identity.id).sort(), legacyIds);
    assert.equal(new Set(contracts.map((contract) => contract.identity.id)).size, 12);

    contracts.forEach((contract) => {
      assert.deepEqual(StackTopologyCatalogDescriptorV1Schema.parse(contract.descriptor), contract.descriptor);
      assert.equal(contract.identity.version, STACK_TOPOLOGY_CATALOG_VERSION);
      assert.match(contract.identity.contentHash, /^[a-f0-9]{64}$/);
      assert.equal(
        computeStackTopologyCatalogContentHash(contract.descriptor),
        contract.identity.contentHash,
      );
      assert.equal(contract.descriptor.requiredCommandKinds.includes("build"), true);
      assert.equal(contract.descriptor.requiredPathRoles.includes("entrypoint"), true);
      assert.equal(contract.descriptor.requiredPathRoles.includes("source"), true);
      contract.descriptor.entrypointKinds.forEach((kind) => {
        const priorities = contract.descriptor.entrypointRules
          .filter((rule) => rule.entrypointKind === kind)
          .map((rule) => rule.selectionPriority);
        assert.equal(new Set(priorities).size, priorities.length);
      });
    });
    const viteRules = getStackTopologyCatalogContract("vite-react-web-app")!.descriptor.entrypointRules;
    assert.equal(viteRules.find((rule) => rule.id === "ENTRY_RULE_VITE_MAIN_TSX")?.selectionPriority, 10);
    assert.equal(viteRules.find((rule) => rule.id === "ENTRY_RULE_VITE_APP_TSX")?.selectionPriority, 100);
  });

  it("activates only profiles with an exact required preview command", () => {
    const active: string[] = [];
    for (const { descriptor } of listStackTopologyCatalogContracts()) {
      if (descriptor.deploymentActivation.status === "active") {
        active.push(descriptor.stackPackId);
        assert.equal(descriptor.requiredCommandKinds.includes("preview"), true);
        assert.equal(descriptor.commands.some(isPlatformOwnedV3PreviewCommand), true);
      }
    }
    assert.deepEqual(active.sort(), ["browser-game-canvas", "static-html-site", "vite-react-web-app"]);
    const nodeApi = getStackTopologyCatalogContract("node-express-api")!.descriptor;
    assert.deepEqual(
      nodeApi.commands.find((entry) => entry.kind === "preview")?.argv,
      ["npm", "run", "start"],
    );
    assert.deepEqual(nodeApi.deploymentActivation, {
      status: "not_deployable",
      reasonCode: "V3_DEPLOY_RUNTIME_NETWORK_POLICY_UNSUPPORTED",
    });
    assert.deepEqual(
      getStackTopologyCatalogContract("nextjs-web-app")!.descriptor.deploymentActivation,
      {
        status: "not_deployable",
        reasonCode: "V3_DEPLOY_RUNTIME_COMMAND_UNRESOLVED",
      },
    );
    assert.deepEqual(
      getStackTopologyCatalogContract("python-web")!.descriptor.deploymentActivation,
      {
        status: "not_deployable",
        reasonCode: "V3_DEPLOY_RUNTIME_COMMAND_UNRESOLVED",
      },
    );
  });

  it("stores direct argv and never a shell-prose command", () => {
    for (const { descriptor } of listStackTopologyCatalogContracts()) {
      for (const command of descriptor.commands) {
        assert.equal(/\s/.test(command.argv[0] ?? ""), false, `${descriptor.stackPackId}/${command.id}`);
        if (isPlatformOwnedV3PreviewCommand(command)) {
          assert.equal(command.argv[2], V3_STATIC_SPA_PREVIEW_SOURCE);
          continue;
        }
        assert.equal(
          command.argv.some((argument) => /[\n\r\0]|\$\(|`|[|;&<>]/.test(argument)),
          false,
          `${descriptor.stackPackId}/${command.id}`,
        );
      }
    }
  });

  it("rejects a mutated or caller-authored inline runtime program", () => {
    const descriptor = structuredClone(getStackTopologyCatalogContract("vite-react-web-app")!.descriptor);
    descriptor.commands.find((command) => command.kind === "preview")!.argv[2] += "\nconsole.log('mutated')";
    assert.equal(StackTopologyCatalogDescriptorV1Schema.safeParse(descriptor).success, false);
  });

  it("changes the stack identity when one machine-readable command changes", () => {
    const contract = getStackTopologyCatalogContract("vite-react-web-app")!;
    const changed = structuredClone(contract.descriptor);
    changed.commands.find((command) => command.kind === "build")!.argv.push("--mode", "production");
    assert.notEqual(
      computeStackTopologyCatalogContentHash(changed),
      contract.identity.contentHash,
    );
    assert.equal(
      getStackTopologyCatalogContract("vite-react-web-app")!.identity.contentHash,
      contract.identity.contentHash,
    );
  });

  it("uses typed path matchers for formerly glob-shaped native and Python entrypoints", () => {
    const python = getStackTopologyCatalogContract("python-cli")!;
    const pythonRule = python.descriptor.entrypointRules.find((rule) =>
      rule.id === "ENTRY_RULE_PYTHON_MODULE_MAIN")!;
    assert.equal(matchesStackEntrypointRule("src/task_tool/__main__.py", pythonRule.matcher), true);
    assert.equal(matchesStackEntrypointRule("vendor/task_tool/__main__.py", pythonRule.matcher), false);

    const android = getStackTopologyCatalogContract("android-app")!;
    const androidRule = android.descriptor.entrypointRules.find((rule) =>
      rule.id === "ENTRY_RULE_ANDROID_ACTIVITY")!;
    assert.equal(matchesStackEntrypointRule("app/src/main/java/dev/setrox/MainActivity.kt", androidRule.matcher), true);

    const ios = getStackTopologyCatalogContract("ios-app")!;
    const iosRule = ios.descriptor.entrypointRules.find((rule) => rule.id === "ENTRY_RULE_IOS_APP")!;
    assert.equal(matchesStackEntrypointRule("Sources/TaskBeaconApp.swift", iosRule.matcher), true);
  });

  it("fails closed for unknown packs and unknown descriptor fields", () => {
    assert.equal(getStackTopologyCatalogContract("unknown-stack"), null);
    const descriptor = structuredClone(getStackTopologyCatalogContract("vite-react-web-app")!.descriptor) as Record<string, unknown>;
    descriptor["shellCommand"] = "npm run build";
    assert.equal(StackTopologyCatalogDescriptorV1Schema.safeParse(descriptor).success, false);
  });
});
