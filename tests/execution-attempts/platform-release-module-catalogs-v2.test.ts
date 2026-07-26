import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import * as moduleCatalogModule from
  "../../src/execution/schemas/platform-release-module-catalogs-v2.js";
import {
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
  NODE_CLI_LAUNCHER_ABI_REF_V2,
  NODE_CLI_LAUNCHER_EXPORT_V2,
  NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_CLI_LAUNCHER_REF_V2,
} from "../../src/execution/schemas/node-cli-launcher-v2.js";
import {
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
  NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
  NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
  NODE_EXPRESS_API_LAUNCHER_REF_V2,
} from
  "../../src/execution/schemas/node-express-api-launcher-v2.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from
  "../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA,
  PLATFORM_LAUNCHER_CATALOG_V2_SCHEMA,
  PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
  PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
  PLATFORM_RUNNER_CATALOG_ENTRY_V2_SCHEMA,
  PLATFORM_RUNNER_CATALOG_V2_SCHEMA,
  PlatformLauncherCatalogV2Schema,
  PlatformRunnerCatalogV2Schema,
  hashPlatformLauncherCatalogEntryV2,
  hashPlatformLauncherCatalogV2,
  hashPlatformReleaseModuleRefV2,
  hashPlatformRunnerCatalogEntryV2,
  hashPlatformRunnerCatalogV2,
  hashPlatformRunnerToolchainV2,
  parsePlatformLauncherCatalogCandidateV2,
  parsePlatformRunnerCatalogCandidateV2,
  type PlatformLauncherCatalogV2,
  type PlatformReleaseModuleRefV2,
  type PlatformRunnerCatalogV2,
} from
  "../../src/execution/schemas/platform-release-module-catalogs-v2.js";
import {
  getProductDeliveryProfileCatalogV2,
} from
  "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
} from "../../src/evidence/schemas/cli-process-runner-v2.js";
import {
  EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
  EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
  EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
  EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
} from "../../src/evidence/schemas/command-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
} from "../../src/evidence/schemas/http-service-runner-v2.js";
import {
  INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
} from
  "../../src/evidence/schemas/invocation-evidence-runner-execution-lease-v2.js";

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function moduleRef(
  moduleLocator: string,
  byteLength: number,
): PlatformReleaseModuleRefV2 {
  const identity = {
    schema: PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
    moduleLocator,
    payloadLocator: `payload/${moduleLocator}`,
    mediaType: "text/javascript" as const,
    contentHash: sha(moduleLocator),
    byteLength,
    mode: "0444" as const,
  };
  return {
    ...identity,
    moduleRefHash: hashPlatformReleaseModuleRefV2(identity as never),
  } as PlatformReleaseModuleRefV2;
}

function fixtureCatalogs(): Readonly<{
  launcher: PlatformLauncherCatalogV2;
  runner: PlatformRunnerCatalogV2;
}> {
  const profiles = getProductDeliveryProfileCatalogV2();
  const definitions = getPlatformEvidenceDefinitionCatalogsV2();
  const cliProfile = profiles.profiles[0]!;
  const apiProfile = profiles.profiles[1]!;
  const environmentCapsuleHash = sha("environment");
  const runtimePayloadHash = sha("runtime-payload");
  const platformTreeHash = sha("platform-tree");
  const dependencyTreeHash = sha("dependency-tree");
  const externalResolutionHash = sha("external-resolution");
  const productionResolutionGraphHash = sha("production-graph");
  const transportCodecCatalogHash = sha("transport-codecs");
  const receiptSchemaHash = sha("receipt-schema");
  const adapterDefinitionCatalogHash = sha("adapter-definitions");

  const launcherEntries = [
    {
      schema: PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA,
      launcherRef: NODE_CLI_LAUNCHER_REF_V2,
      invocationKind: "cli_process" as const,
      profile: {
        profileId: cliProfile.id,
        profileHash: cliProfile.profileHash,
      },
      requirementDefinitionHash:
        definitions.launcherRequirements.definitions[0]!
          .definitionHash,
      module: moduleRef(
        NODE_CLI_LAUNCHER_MODULE_LOCATOR_V2,
        10_001,
      ),
      requiredExport: NODE_CLI_LAUNCHER_EXPORT_V2,
      abiRef: NODE_CLI_LAUNCHER_ABI_REF_V2,
      abiHash: NODE_CLI_LAUNCHER_ABI_HASH_V2,
      runnerEntrypointRef:
        EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
      executableRef: PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
      environmentCapsuleHash,
    },
    {
      schema: PLATFORM_LAUNCHER_CATALOG_ENTRY_V2_SCHEMA,
      launcherRef: NODE_EXPRESS_API_LAUNCHER_REF_V2,
      invocationKind: "http_service" as const,
      profile: {
        profileId: apiProfile.id,
        profileHash: apiProfile.profileHash,
      },
      requirementDefinitionHash:
        definitions.launcherRequirements.definitions[1]!
          .definitionHash,
      module: moduleRef(
        NODE_EXPRESS_API_LAUNCHER_MODULE_LOCATOR_V2,
        10_002,
      ),
      requiredExport: NODE_EXPRESS_API_LAUNCHER_EXPORT_V2,
      abiRef: NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2,
      abiHash: NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
      runnerEntrypointRef:
        EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
      executableRef: PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
      environmentCapsuleHash,
    },
  ].map((identity) => ({
    ...identity,
    entryHash:
      hashPlatformLauncherCatalogEntryV2(identity as never),
  }));
  const launcherIdentity = {
    schema: PLATFORM_LAUNCHER_CATALOG_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "candidate_module_bytes_unverified" as const,
    productionUse:
      "forbidden_until_fresh_verified_release" as const,
    runtimePayloadHash,
    platformTreeHash,
    externalResolutionHash,
    environmentCapsuleHash,
    profileCatalogHash: profiles.catalogHash,
    requirementCatalogHash:
      definitions.launcherRequirements.catalogHash,
    entries: launcherEntries,
  };
  const launcher = {
    ...launcherIdentity,
    catalogHash:
      hashPlatformLauncherCatalogV2(launcherIdentity as never),
  } as PlatformLauncherCatalogV2;

  const runnerStatic = [
    {
      runnerEntrypointRef:
        EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
      invocationKind: "cli_process" as const,
      profileBindings: [{
        profileId: cliProfile.id,
        profileHash: cliProfile.profileHash,
      }],
      module: moduleRef(
        EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
        20_001,
      ),
      requiredExport: EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
      admission: {
        kind: "invocation" as const,
        readiness:
          "admission_boundary_only_until_verified_release_join" as const,
        productionUse: "forbidden" as const,
        executionLeaseContractHash:
          INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
      },
    },
    {
      runnerEntrypointRef:
        EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
      invocationKind: "command" as const,
      profileBindings: [
        {
          profileId: cliProfile.id,
          profileHash: cliProfile.profileHash,
        },
        {
          profileId: apiProfile.id,
          profileHash: apiProfile.profileHash,
        },
      ],
      module: moduleRef(
        EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
        20_002,
      ),
      requiredExport: EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
      admission: {
        kind: "command" as const,
        readiness:
          "shadow_blocked_until_activated_command_execution_lease" as const,
        productionUse: "forbidden" as const,
      },
    },
    {
      runnerEntrypointRef:
        EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
      invocationKind: "http_service" as const,
      profileBindings: [{
        profileId: apiProfile.id,
        profileHash: apiProfile.profileHash,
      }],
      module: moduleRef(
        EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
        20_003,
      ),
      requiredExport: EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
      abiRef: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
      abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
      admission: {
        kind: "invocation" as const,
        readiness:
          "admission_boundary_only_until_verified_release_join" as const,
        productionUse: "forbidden" as const,
        executionLeaseContractHash:
          INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
      },
    },
  ] as const;

  const runnerEntries = runnerStatic.map((entry, index) => {
    const requirementDefinitionHash =
      definitions.runnerRequirements.definitions[index]!
        .definitionHash;
    const executionAdmissionHash =
      entry.admission.kind === "invocation"
        ? entry.admission.executionLeaseContractHash
        : entry.abiHash;
    const toolchainHash = hashPlatformRunnerToolchainV2({
      runnerEntrypointRef: entry.runnerEntrypointRef,
      runnerModuleHash: entry.module.contentHash,
      runnerAbiHash: entry.abiHash,
      platformTreeHash,
      dependencyTreeHash,
      runtimePayloadHash,
      externalResolutionHash,
      productionResolutionGraphHash,
      environmentCapsuleHash,
      launcherCatalogHash: launcher.catalogHash,
      transportCodecCatalogHash,
      receiptSchemaHash,
      adapterDefinitionCatalogHash,
      executionAdmissionHash,
    });
    const identity = {
      schema: PLATFORM_RUNNER_CATALOG_ENTRY_V2_SCHEMA,
      ...entry,
      requirementDefinitionHash,
      executableRefs: [
        PLATFORM_RELEASE_NODE_EXECUTABLE_REF_V2,
      ] as const,
      toolchainHash,
    };
    return {
      ...identity,
      entryHash:
        hashPlatformRunnerCatalogEntryV2(identity as never),
    };
  });
  const runnerIdentity = {
    schema: PLATFORM_RUNNER_CATALOG_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "candidate_module_bytes_unverified" as const,
    productionUse:
      "forbidden_until_fresh_verified_release_and_derived_adapter_catalog" as const,
    runtimePayloadHash,
    platformTreeHash,
    dependencyTreeHash,
    externalResolutionHash,
    productionResolutionGraphHash,
    environmentCapsuleHash,
    profileCatalogHash: profiles.catalogHash,
    requirementCatalogHash:
      definitions.runnerRequirements.catalogHash,
    launcherCatalogHash: launcher.catalogHash,
    transportCodecCatalogHash,
    receiptSchemaHash,
    adapterDefinitionCatalogHash,
    invocationExecutionLeasePolicyHash:
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
    entries: runnerEntries,
  };
  const runner = {
    ...runnerIdentity,
    catalogHash:
      hashPlatformRunnerCatalogV2(runnerIdentity as never),
  } as PlatformRunnerCatalogV2;
  return { launcher, runner };
}

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

describe("Platform release materialized module catalogs V2", () => {
  it("binds exact launcher and runner bytes without claiming operational support", () => {
    const { launcher, runner } = fixtureCatalogs();
    assert.equal(
      PlatformLauncherCatalogV2Schema.safeParse(launcher).success,
      true,
    );
    assert.equal(
      PlatformRunnerCatalogV2Schema.safeParse(runner).success,
      true,
    );
    assert.deepEqual(
      {
        launcherHash: launcher.catalogHash,
        runnerHash: runner.catalogHash,
        launcherBytes: canonicalJsonBytes(launcher).byteLength,
        runnerBytes: canonicalJsonBytes(runner).byteLength,
      },
      {
        launcherHash:
          "9b275c8f58d5d5d8dae8009ad3f0a6779567416b416003d4a52a69ede4f82839",
        runnerHash:
          "8338a0a15eeb82cf37d60435bfe73e6cc32c1117344f3855b6cdafdcd2977cb4",
        launcherBytes: 3_227,
        runnerBytes: 5_705,
      },
    );
    assert.equal(
      launcher.productionUse,
      "forbidden_until_fresh_verified_release",
    );
    assert.equal(
      runner.productionUse,
      "forbidden_until_fresh_verified_release_and_derived_adapter_catalog",
    );
    assert.deepEqual(
      runner.entries.map((entry) => entry.admission.readiness),
      [
        "admission_boundary_only_until_verified_release_join",
        "shadow_blocked_until_activated_command_execution_lease",
        "admission_boundary_only_until_verified_release_join",
      ],
    );
  });

  it("fresh-parses immutable snapshots and preserves every toolchain join", () => {
    const { launcher, runner } = fixtureCatalogs();
    const parsedLauncher =
      parsePlatformLauncherCatalogCandidateV2(launcher);
    const parsedRunner =
      parsePlatformRunnerCatalogCandidateV2(runner);
    assert.notStrictEqual(parsedLauncher, launcher);
    assert.notStrictEqual(parsedRunner, runner);
    assert.deepEqual(parsedLauncher, launcher);
    assert.deepEqual(parsedRunner, runner);
    assertDeepFrozen(parsedLauncher);
    assertDeepFrozen(parsedRunner);
    assert.equal(
      new Set(
        runner.entries.map((entry) => entry.toolchainHash),
      ).size,
      3,
    );
  });

  it("identity-advances candidate module bytes and rejects ABI, profile, admission, and root-join drift", () => {
    const fixture = fixtureCatalogs();
    const cases: unknown[] = [];

    const moduleDrift = structuredClone(fixture.launcher);
    moduleDrift.entries[0].module.contentHash = sha("caller-module");
    moduleDrift.entries[0].module.moduleRefHash =
      hashPlatformReleaseModuleRefV2(
        moduleDrift.entries[0].module,
      );
    moduleDrift.entries[0].entryHash =
      hashPlatformLauncherCatalogEntryV2(moduleDrift.entries[0]);
    moduleDrift.catalogHash =
      hashPlatformLauncherCatalogV2(moduleDrift);
    assert.equal(
      PlatformLauncherCatalogV2Schema.safeParse(moduleDrift).success,
      true,
    );
    assert.notEqual(
      moduleDrift.entries[0].entryHash,
      fixture.launcher.entries[0].entryHash,
    );
    assert.notEqual(
      moduleDrift.catalogHash,
      fixture.launcher.catalogHash,
    );

    const abiDrift = structuredClone(fixture.launcher);
    abiDrift.entries[0].abiRef =
      NODE_EXPRESS_API_LAUNCHER_ABI_REF_V2;
    abiDrift.entries[0].abiHash =
      NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2;
    abiDrift.entries[0].entryHash =
      hashPlatformLauncherCatalogEntryV2(abiDrift.entries[0]);
    abiDrift.catalogHash =
      hashPlatformLauncherCatalogV2(abiDrift);
    cases.push(abiDrift);

    const profileDrift = structuredClone(fixture.runner);
    profileDrift.entries[0].profileBindings[0]!.profileHash =
      sha("caller-profile");
    profileDrift.entries[0].entryHash =
      hashPlatformRunnerCatalogEntryV2(profileDrift.entries[0]);
    profileDrift.catalogHash =
      hashPlatformRunnerCatalogV2(profileDrift);
    cases.push(profileDrift);

    const admissionDrift = structuredClone(
      fixture.runner,
    ) as unknown as {
      entries: Array<{
        admission: unknown;
        entryHash: string;
      }>;
      catalogHash: string;
    };
    admissionDrift.entries[1].admission = {
      kind: "invocation",
      readiness:
        "admission_boundary_only_until_verified_release_join",
      productionUse: "forbidden",
      executionLeaseContractHash:
        INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
    };
    admissionDrift.entries[1].entryHash =
      hashPlatformRunnerCatalogEntryV2(
        admissionDrift.entries[1] as never,
      );
    admissionDrift.catalogHash =
      hashPlatformRunnerCatalogV2(admissionDrift as never);
    cases.push(admissionDrift);

    const rootDrift = structuredClone(fixture.runner);
    rootDrift.environmentCapsuleHash = sha("other-environment");
    rootDrift.catalogHash = hashPlatformRunnerCatalogV2(rootDrift);
    cases.push(rootDrift);

    for (const candidate of cases) {
      const launcherResult =
        PlatformLauncherCatalogV2Schema.safeParse(candidate);
      const runnerResult =
        PlatformRunnerCatalogV2Schema.safeParse(candidate);
      assert.equal(
        launcherResult.success || runnerResult.success,
        false,
      );
    }
  });

  it("rejects hostile input before traps and exports no materializer, verifier, issuer, or activation", () => {
    let traps = 0;
    const hostile = new Proxy({}, {
      ownKeys() {
        traps += 1;
        throw new Error("catalog proxy trap must not run");
      },
    });
    assert.throws(
      () => parsePlatformRunnerCatalogCandidateV2(hostile),
    );
    assert.equal(traps, 0);

    const exports = Object.keys(moduleCatalogModule);
    for (const forbidden of [
      "materialize",
      "verify",
      "issue",
      "activate",
      "operational",
      "ForTest",
    ]) {
      assert.equal(
        exports.some((name) => name.includes(forbidden)),
        false,
        forbidden,
      );
    }
  });
});
