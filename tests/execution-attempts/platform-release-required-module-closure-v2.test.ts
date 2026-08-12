import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";

import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";
import {
  PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
  hashPlatformReleaseModuleRefV2,
  type PlatformReleaseModuleRefV2,
} from
  "../../src/execution/schemas/platform-release-module-catalogs-v2.js";
import {
  PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_ENTRY_V2_SCHEMA,
  PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES,
  PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA,
  PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2_SCHEMA,
  PlatformReleaseRequiredModuleClosureV2Schema,
  bindPlatformReleaseRequiredModuleClosureCandidateV2,
  getPlatformReleaseRequiredModuleRequirementV2,
  hashPlatformReleaseRequiredModuleClosureEntryV2,
  hashPlatformReleaseRequiredModuleClosureV2,
  hashPlatformReleaseRequiredModuleRequirementV2,
  parsePlatformReleaseRequiredModuleClosureCandidateV2,
} from
  "../../src/execution/schemas/platform-release-required-module-closure-v2.js";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function recursivelyAssertFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(recursivelyAssertFrozen);
}

function moduleRefs(): readonly PlatformReleaseModuleRefV2[] {
  return getPlatformReleaseRequiredModuleRequirementV2()
    .entries.map((definition, index) => {
      const identity = {
        schema: PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
        moduleLocator: definition.moduleLocator,
        payloadLocator:
          `payload/${definition.moduleLocator}`,
        mediaType: "text/javascript" as const,
        contentHash: sha(definition.moduleLocator),
        byteLength: index + 1,
        mode: "0444" as const,
      };
      return {
        ...identity,
        moduleRefHash:
          hashPlatformReleaseModuleRefV2(identity),
      };
    });
}

function closure() {
  return bindPlatformReleaseRequiredModuleClosureCandidateV2({
    platformTreeHash: sha("platform-tree"),
    runtimePayloadHash: sha("runtime-payload"),
    modules: moduleRefs(),
  });
}

function rehashClosure(candidate: any): void {
  candidate.closureHash =
    hashPlatformReleaseRequiredModuleClosureV2(candidate);
}

describe("PlatformReleaseRequiredModuleClosureV2", () => {
  it("owns one exact zero-input 17-module/export requirement", () => {
    const requirement =
      getPlatformReleaseRequiredModuleRequirementV2();
    assert.equal(
      requirement.schema,
      PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2_SCHEMA,
    );
    assert.equal(requirement.entryCount, 17);
    assert.deepEqual(
      requirement.entries.map((entry) => entry.role),
      [
        "bootstrap_cli",
        "bootstrap_http",
        "catalog_adapter_definition",
        "catalog_evidence_definition",
        "catalog_profile",
        "codec_catalog",
        "codec_runtime",
        "evaluator",
        "launcher_cli",
        "launcher_http",
        "network",
        "receipt_abi",
        "result_abi",
        "runner_cli",
        "runner_command",
        "runner_http",
        "runner_invocation_core",
      ],
    );
    assert.deepEqual(
      requirement.entries.find(
        (entry) => entry.role === "network",
      )?.requiredExports,
      [
        {
          name:
            "acquireNetworkSandboxLaunchContextInternalV2",
          kind: "function",
        },
        {
          name: "runNetworkIsolatedV2",
          kind: "function",
        },
      ],
    );
    assert.equal(
      requirement.operationalAdapterStatus,
      "blocked_until_verified_release_registry_v2",
    );
    assert.equal(
      requirement.requirementHash,
      hashPlatformReleaseRequiredModuleRequirementV2(
        requirement,
      ),
    );
    const commandRunner = requirement.entries.find(
      (entry) => entry.role === "runner_command",
    );
    assert.equal(
      commandRunner?.implementationUse,
      "test_fixture_runtime_blocked",
    );
    assert.equal(
      commandRunner?.verificationPolicy,
      "test_fixture_only_function_exports_present_v2",
    );
    recursivelyAssertFrozen(requirement);
    assert.notEqual(
      requirement,
      getPlatformReleaseRequiredModuleRequirementV2(),
    );
  });

  it("binds every-and-only observed module ref and freezes the candidate", () => {
    const candidate = closure();
    assert.equal(
      candidate.schema,
      PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA,
    );
    assert.equal(candidate.entries.length, 17);
    assert.equal(
      new Set(
        candidate.entries.map(
          (entry) => entry.module.moduleLocator,
        ),
      ).size,
      17,
    );
    assert.ok(
      canonicalJsonBytes(candidate).byteLength
        < PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES,
    );
    assert.equal(
      PlatformReleaseRequiredModuleClosureV2Schema
        .safeParse(candidate).success,
      true,
    );
    assert.deepEqual(
      parsePlatformReleaseRequiredModuleClosureCandidateV2(
        structuredClone(candidate),
      ),
      candidate,
    );
    recursivelyAssertFrozen(candidate);
  });

  it("keeps literal requirement and synthetic closure identity goldens", () => {
    const requirement =
      getPlatformReleaseRequiredModuleRequirementV2();
    const candidate = closure();
    assert.deepEqual(
      {
        requirementHash: requirement.requirementHash,
        requirementBytes:
          canonicalJsonBytes(requirement).byteLength,
        closureHash: candidate.closureHash,
        closureBytes: canonicalJsonBytes(candidate).byteLength,
      },
      {
        requirementHash:
          "2eb3d4914952add70d9d6ed47964dfcaf8cd9f856af7d0a06b9ed4ab88fbcb2d",
        requirementBytes: 6_952,
        closureHash:
          "0f235a028ab3c9c1a1dc69ee53cfbb181b4a0ceffe62bf8b6eb69ad3b5ae2308",
        closureBytes: 24_052,
      },
    );
  });

  it("rejects missing, duplicate, extra and self-rehashed definition drift", () => {
    const refs = [...moduleRefs()];
    assert.throws(
      () =>
        bindPlatformReleaseRequiredModuleClosureCandidateV2({
          platformTreeHash: sha("platform-tree"),
          runtimePayloadHash: sha("runtime-payload"),
          modules: refs.slice(1),
        }),
      /PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MEMBERSHIP_INVALID/,
    );
    assert.throws(
      () =>
        bindPlatformReleaseRequiredModuleClosureCandidateV2({
          platformTreeHash: sha("platform-tree"),
          runtimePayloadHash: sha("runtime-payload"),
          modules: [...refs.slice(0, -1), refs[0]!],
        }),
      /PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MEMBERSHIP_INVALID/,
    );
    const extraIdentity = {
      schema: PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
      moduleLocator: "dist/unknown.js",
      payloadLocator: "payload/dist/unknown.js",
      mediaType: "text/javascript" as const,
      contentHash: sha("unknown"),
      byteLength: 7,
      mode: "0444" as const,
    };
    assert.throws(
      () =>
        bindPlatformReleaseRequiredModuleClosureCandidateV2({
          platformTreeHash: sha("platform-tree"),
          runtimePayloadHash: sha("runtime-payload"),
          modules: [
            ...refs,
            {
              ...extraIdentity,
              moduleRefHash:
                hashPlatformReleaseModuleRefV2(
                  extraIdentity,
                ),
            },
          ],
        }),
      /PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MEMBERSHIP_INVALID/,
    );

    const definitionDrifts:
    readonly ((definition: any) => void)[] = [
      (definition) => {
        definition.requiredExports = [{
          name: "attackerExportV2",
          kind: "function",
        }];
      },
      (definition) => {
        definition.requiredExports[0].kind = "function";
      },
      (definition) => {
        definition.verificationPolicy =
          "function_exports_present_v2";
      },
      (definition) => {
        definition.implementationUse = "runtime";
      },
    ];
    for (const mutateDefinition of definitionDrifts) {
      const drifted: any = structuredClone(closure());
      mutateDefinition(drifted.requirement.entries[0]);
      drifted.requirement.requirementHash =
        hashPlatformReleaseRequiredModuleRequirementV2(
          drifted.requirement,
        );
      drifted.entries[0].definition =
        structuredClone(drifted.requirement.entries[0]);
      drifted.entries[0].entryHash =
        hashPlatformReleaseRequiredModuleClosureEntryV2(
          drifted.entries[0],
        );
      rehashClosure(drifted);
      assert.equal(
        PlatformReleaseRequiredModuleClosureV2Schema
          .safeParse(drifted).success,
        false,
      );
    }
  });

  it("rejects module locator drift, proxy input and oversized snapshots", () => {
    const drifted: any = structuredClone(closure());
    drifted.entries[0].module.moduleLocator =
      "dist/execution/schemas/node-express-api-launcher-v2.js";
    drifted.entries[0].module.payloadLocator =
      "payload/dist/execution/schemas/node-express-api-launcher-v2.js";
    drifted.entries[0].module.moduleRefHash =
      hashPlatformReleaseModuleRefV2(
        drifted.entries[0].module,
      );
    drifted.entries[0].entryHash =
      hashPlatformReleaseRequiredModuleClosureEntryV2(
        drifted.entries[0],
      );
    rehashClosure(drifted);
    assert.equal(
      PlatformReleaseRequiredModuleClosureV2Schema
        .safeParse(drifted).success,
      false,
    );
    assert.throws(
      () =>
        parsePlatformReleaseRequiredModuleClosureCandidateV2(
          new Proxy(structuredClone(closure()), {}),
        ),
    );
    let proxyTraps = 0;
    const binderInput = {
      platformTreeHash: sha("platform-tree"),
      runtimePayloadHash: sha("runtime-payload"),
      modules: moduleRefs(),
    };
    assert.throws(
      () =>
        bindPlatformReleaseRequiredModuleClosureCandidateV2(
          new Proxy(binderInput, {
            ownKeys() {
              proxyTraps += 1;
              throw new Error("binder proxy trap must not run");
            },
          }),
        ),
    );
    assert.equal(proxyTraps, 0);
    assert.throws(
      () =>
        bindPlatformReleaseRequiredModuleClosureCandidateV2({
          ...binderInput,
          modules: new Proxy([...binderInput.modules], {
            ownKeys() {
              proxyTraps += 1;
              throw new Error("module-array trap must not run");
            },
          }),
        }),
    );
    assert.equal(proxyTraps, 0);
    const accessorModule = structuredClone(
      binderInput.modules[0]!,
    ) as any;
    Object.defineProperty(accessorModule, "contentHash", {
      enumerable: true,
      get() {
        proxyTraps += 1;
        throw new Error("module accessor must not run");
      },
    });
    assert.throws(
      () =>
        bindPlatformReleaseRequiredModuleClosureCandidateV2({
          ...binderInput,
          modules: [
            accessorModule,
            ...binderInput.modules.slice(1),
          ],
        }),
    );
    assert.equal(proxyTraps, 0);
    assert.throws(
      () =>
        parsePlatformReleaseRequiredModuleClosureCandidateV2({
          ...structuredClone(closure()),
          attackerPadding: "x".repeat(
            PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES,
          ),
        }),
    );
  });

  it("names exports that exist on every current source module", async () => {
    const requirement =
      getPlatformReleaseRequiredModuleRequirementV2();
    for (const definition of requirement.entries) {
      const moduleUrl = pathToFileURL(
        path.resolve(definition.sourceModuleLocator),
      ).href;
      const loaded = await import(moduleUrl);
      for (const requiredExport of definition.requiredExports) {
        assert.equal(
          Object.hasOwn(loaded, requiredExport.name),
          true,
          `${definition.role} is missing ${requiredExport.name}`,
        );
        assert.equal(
          typeof loaded[requiredExport.name],
          requiredExport.kind,
          `${definition.role}.${requiredExport.name} has the wrong kind`,
        );
      }
      if (
        definition.verificationPolicy
          === "bootstrap_source_hash_pair_v2"
      ) {
        const sourceName = definition.requiredExports.find(
          (entry) => entry.name.endsWith("_SOURCE_V2"),
        )!.name;
        const hashName = definition.requiredExports.find(
          (entry) => entry.name.endsWith("_SOURCE_HASH_V2"),
        )!.name;
        assert.equal(
          createHash("sha256")
            .update(loaded[sourceName])
            .digest("hex"),
          loaded[hashName],
        );
      }
    }
  });

  it("exports only the exact candidate schema surface", async () => {
    const module = await import(
      "../../src/execution/schemas/platform-release-required-module-closure-v2.js"
    );
    assert.deepEqual(
      Object.keys(module).sort(),
      [
        "PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_ENTRY_V2_SCHEMA",
        "PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_MAX_CANONICAL_BYTES",
        "PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_V2_SCHEMA",
        "PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2",
        "PLATFORM_RELEASE_REQUIRED_MODULE_REQUIREMENT_V2_SCHEMA",
        "PlatformReleaseRequiredModuleClosureEntryV2Schema",
        "PlatformReleaseRequiredModuleClosureV2Schema",
        "PlatformReleaseRequiredModuleRequirementV2Schema",
        "PlatformReleaseRequiredModuleRoleV2Schema",
        "bindPlatformReleaseRequiredModuleClosureCandidateV2",
        "getPlatformReleaseRequiredModuleRequirementV2",
        "hashPlatformReleaseRequiredModuleClosureEntryV2",
        "hashPlatformReleaseRequiredModuleClosureV2",
        "hashPlatformReleaseRequiredModuleRequirementV2",
        "parsePlatformReleaseRequiredModuleClosureCandidateV2",
      ],
    );
    assert.equal(
      PLATFORM_RELEASE_REQUIRED_MODULE_CLOSURE_ENTRY_V2_SCHEMA,
      "setfarm.platform-release-required-module-closure-entry.v2",
    );
  });
});
