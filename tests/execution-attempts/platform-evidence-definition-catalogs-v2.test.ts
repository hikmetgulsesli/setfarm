import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as platformCatalogModule from "../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  EVIDENCE_RUNNER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA,
  EMPTY_OPERATIONAL_EVIDENCE_CATALOG_V2_SCHEMA,
  LAUNCHER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA,
  PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2,
  PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA,
  EvidenceRunnerDefinitionRequirementsCatalogV2Schema,
  LauncherDefinitionRequirementsCatalogV2Schema,
  PlatformEvidenceDefinitionCatalogsV2Schema,
  getEvidenceRunnerDefinitionRequirementsCatalogV2,
  getLauncherDefinitionRequirementsCatalogV2,
  getPlatformEvidenceDefinitionCatalogsV2,
  hashEmptyOperationalEvidenceCatalogV2,
  hashEvidenceRunnerDefinitionRequirementV2,
  hashEvidenceRunnerDefinitionRequirementsCatalogV2,
  hashLauncherDefinitionRequirementV2,
  hashLauncherDefinitionRequirementsCatalogV2,
  hashPlatformEvidenceDefinitionCatalogsV2,
  type PlatformEvidenceDefinitionCatalogsV2,
} from "../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  getProductDeliveryProfileCatalogV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  getInvocationTransportCodecCatalogV2,
  invocationTransportCodecCatalogHashV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  evidenceReceiptAbiPolicyHashV2,
  getEvidenceReceiptAbiPolicyV2,
} from "../../src/evidence/schemas/evidence-receipt-v2.js";

const PLATFORM_CATALOG_HASH_GOLDEN_V2 =
  "cbc6062a8a8bf265e7970eebb4ebd1f3e0ec24ca10e77ae07376124091cac952";
const LAUNCHER_CATALOG_HASH_GOLDEN_V2 =
  "8accc2a9c7c1cf11aedfb73c427f065536b05a6216c35c34e50f4fc4472389de";
const RUNNER_CATALOG_HASH_GOLDEN_V2 =
  "cef4aaf7c6808047ec6cfd5affad92da1d024ede717fb3ebe4f697cf6fa9ad8a";
const EMPTY_OPERATIONAL_CATALOG_HASH_GOLDEN_V2 =
  "de973bdf987c9e4b3059a5885897f376fef3d32a739543dc1d6b6b8a94a3167e";

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
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

describe("Platform evidence definition requirements catalogs v2", () => {
  it("publishes exact zero-input launcher and runner requirements with literal hashes", () => {
    const first = getPlatformEvidenceDefinitionCatalogsV2();
    const second = getPlatformEvidenceDefinitionCatalogsV2();
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    assert.equal(first.schema, PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA);
    assert.equal(first.readiness, "shadow_blocked");
    assert.equal(first.productionUse, "forbidden");
    assert.deepEqual(first.blockerCodes, PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2);
    assert.equal(first.launcherRequirements.schema, LAUNCHER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA);
    assert.equal(first.launcherRequirements.authorityKind, "requirements_only");
    assert.equal(first.launcherRequirements.productionUse, "forbidden");
    assert.equal(
      first.runnerRequirements.schema,
      EVIDENCE_RUNNER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA,
    );
    assert.equal(first.runnerRequirements.authorityKind, "requirements_only");
    assert.equal(first.runnerRequirements.productionUse, "forbidden");
    assert.deepEqual(
      first.launcherRequirements.definitions.map((entry) => entry.launcherRef),
      ["LAUNCH_NODE_CLI_V2", "LAUNCH_NODE_EXPRESS_API_V2"],
    );
    assert.deepEqual(
      first.runnerRequirements.definitions.map((entry) => entry.runnerEntrypointRef),
      [
        "ENTRY_EVIDENCE_CLI_PROCESS_V2",
        "ENTRY_EVIDENCE_COMMAND_V2",
        "ENTRY_EVIDENCE_HTTP_SERVICE_V2",
      ],
    );
    assert.deepEqual(first.operationalCatalog, {
      schema: EMPTY_OPERATIONAL_EVIDENCE_CATALOG_V2_SCHEMA,
      entries: [],
      catalogHash: first.operationalCatalog.catalogHash,
    });
    assert.equal(first.catalogHash, PLATFORM_CATALOG_HASH_GOLDEN_V2);
    assert.equal(first.launcherRequirements.catalogHash, LAUNCHER_CATALOG_HASH_GOLDEN_V2);
    assert.equal(first.runnerRequirements.catalogHash, RUNNER_CATALOG_HASH_GOLDEN_V2);
    assert.equal(first.operationalCatalog.catalogHash, EMPTY_OPERATIONAL_CATALOG_HASH_GOLDEN_V2);
    assert.equal(first.catalogHash, hashPlatformEvidenceDefinitionCatalogsV2(first));
    assert.equal(
      first.launcherRequirements.catalogHash,
      hashLauncherDefinitionRequirementsCatalogV2(first.launcherRequirements),
    );
    assert.equal(
      first.runnerRequirements.catalogHash,
      hashEvidenceRunnerDefinitionRequirementsCatalogV2(first.runnerRequirements),
    );
    assertDeepFrozen(first);
  });

  it("derives receipt, codec, profile, and launcher joins from code-owned catalogs", () => {
    const catalog = getPlatformEvidenceDefinitionCatalogsV2();
    const receipt = getEvidenceReceiptAbiPolicyV2();
    const codec = getInvocationTransportCodecCatalogV2();
    const profiles = getProductDeliveryProfileCatalogV2();
    assert.deepEqual(catalog.receiptSchemaBinding, {
      policySchema: receipt.schema,
      policyVersion: receipt.version,
      receiptSchema: receipt.receiptSchema,
      policyHash: evidenceReceiptAbiPolicyHashV2(),
    });
    assert.deepEqual(catalog.invocationCodecCatalogBinding, {
      schema: codec.schema,
      catalogVersion: codec.catalogVersion,
      catalogHash: invocationTransportCodecCatalogHashV2(),
    });
    assert.deepEqual(catalog.profileCatalogBinding, {
      catalogSchema: profiles.schema,
      profileSchema: "setfarm.product-delivery-profile.v2",
      catalogVersion: profiles.catalogVersion,
      catalogHash: profiles.catalogHash,
    });
    for (const requirement of catalog.launcherRequirements.definitions) {
      const profile = profiles.profiles.find((entry) => entry.id === requirement.profileId)!;
      assert.equal(requirement.launcherRef, profile.runtime.launcherRef);
      assert.equal(requirement.invocationKind, profile.runtime.invocationKind);
      assert.match(requirement.requiredModuleLocator, /^dist\/execution\/launchers\//u);
      assert.match(requirement.requiredExport, /^launchNode/u);
      assert.match(requirement.requiredAbiRef, /_ABI_V2$/u);
      assert.equal(requirement.definitionHash, hashLauncherDefinitionRequirementV2(requirement));
    }
    for (const requirement of catalog.runnerRequirements.definitions) {
      assert.match(requirement.requiredModuleLocator, /^dist\/evidence\/runners\//u);
      assert.equal(requirement.requiredExport, "runEvidenceAdapterV2");
      assert.match(requirement.requiredAbiRef, /_RUNNER_ABI_V2$/u);
      assert.equal(
        requirement.definitionHash,
        hashEvidenceRunnerDefinitionRequirementV2(requirement),
      );
    }
  });

  it("rejects self-consistently rehashed caller forgeries in every authority catalog", () => {
    const baseline = getPlatformEvidenceDefinitionCatalogsV2();

    const launcherForgery = structuredClone(baseline);
    launcherForgery.launcherRequirements.definitions[0]!.requiredModuleLocator =
      "dist/execution/launchers/caller-fixture-v2.js";
    launcherForgery.launcherRequirements.definitions[0]!.definitionHash =
      hashLauncherDefinitionRequirementV2(
        launcherForgery.launcherRequirements.definitions[0]!,
      );
    launcherForgery.launcherRequirements.catalogHash =
      hashLauncherDefinitionRequirementsCatalogV2(launcherForgery.launcherRequirements);
    launcherForgery.catalogHash = hashPlatformEvidenceDefinitionCatalogsV2(launcherForgery);
    assert.equal(
      LauncherDefinitionRequirementsCatalogV2Schema.safeParse(
        launcherForgery.launcherRequirements,
      ).success,
      false,
    );
    assert.equal(PlatformEvidenceDefinitionCatalogsV2Schema.safeParse(launcherForgery).success, false);

    const runnerForgery = structuredClone(baseline);
    runnerForgery.runnerRequirements.definitions[0]!.requiredAbiRef =
      "CALLER_FIXTURE_RUNNER_ABI_V2";
    runnerForgery.runnerRequirements.definitions[0]!.definitionHash =
      hashEvidenceRunnerDefinitionRequirementV2(
        runnerForgery.runnerRequirements.definitions[0]!,
      );
    runnerForgery.runnerRequirements.catalogHash =
      hashEvidenceRunnerDefinitionRequirementsCatalogV2(runnerForgery.runnerRequirements);
    runnerForgery.catalogHash = hashPlatformEvidenceDefinitionCatalogsV2(runnerForgery);
    assert.equal(
      EvidenceRunnerDefinitionRequirementsCatalogV2Schema.safeParse(
        runnerForgery.runnerRequirements,
      ).success,
      false,
    );
    assert.equal(PlatformEvidenceDefinitionCatalogsV2Schema.safeParse(runnerForgery).success, false);

    for (const mutate of [
      (value: PlatformEvidenceDefinitionCatalogsV2) => {
        value.receiptSchemaBinding.policyHash = "a".repeat(64);
      },
      (value: PlatformEvidenceDefinitionCatalogsV2) => {
        value.invocationCodecCatalogBinding.catalogHash = "b".repeat(64);
      },
      (value: PlatformEvidenceDefinitionCatalogsV2) => {
        value.profileCatalogBinding.catalogHash = "c".repeat(64);
      },
    ]) {
      const candidate = structuredClone(baseline);
      mutate(candidate);
      candidate.catalogHash = hashPlatformEvidenceDefinitionCatalogsV2(candidate);
      assert.equal(PlatformEvidenceDefinitionCatalogsV2Schema.safeParse(candidate).success, false);
    }
  });

  it("cannot materialize a fixture operational entry even after rehashing", () => {
    const candidate = structuredClone(getPlatformEvidenceDefinitionCatalogsV2()) as unknown as {
      operationalCatalog: { schema: string; entries: unknown[]; catalogHash: string };
      catalogHash: string;
    };
    candidate.operationalCatalog.entries = [{ fixture: "fake runnable support" }];
    candidate.operationalCatalog.catalogHash = hashEmptyOperationalEvidenceCatalogV2(
      candidate.operationalCatalog as never,
    );
    candidate.catalogHash = hashPlatformEvidenceDefinitionCatalogsV2(candidate as never);
    assert.equal(PlatformEvidenceDefinitionCatalogsV2Schema.safeParse(candidate).success, false);
  });

  it("contains no module hash, toolchain, support-signature, or runnable authority", () => {
    const catalog = getPlatformEvidenceDefinitionCatalogsV2();
    const forbidden = new Set([
      "moduleHash",
      "toolchainHash",
      "supportSignature",
      "supportSignatures",
      "executable",
      "environment",
      "env",
      "command",
      "origin",
      "runner",
      "run",
    ]);
    for (const key of allKeys(catalog)) assert.equal(forbidden.has(key), false, key);
    for (const getter of [
      getLauncherDefinitionRequirementsCatalogV2,
      getEvidenceRunnerDefinitionRequirementsCatalogV2,
      getPlatformEvidenceDefinitionCatalogsV2,
    ]) {
      assert.equal(getter.length, 0);
    }
    assert.deepEqual(Object.keys(platformCatalogModule).sort(), [
      "EMPTY_OPERATIONAL_EVIDENCE_CATALOG_V2_SCHEMA",
      "EVIDENCE_RUNNER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA",
      "EVIDENCE_RUNNER_DEFINITION_REQUIREMENT_V2_SCHEMA",
      "EmptyOperationalEvidenceCatalogV2Schema",
      "EvidenceRunnerDefinitionRequirementV2Schema",
      "EvidenceRunnerDefinitionRequirementsCatalogV2Schema",
      "LAUNCHER_DEFINITION_REQUIREMENTS_CATALOG_V2_SCHEMA",
      "LAUNCHER_DEFINITION_REQUIREMENT_V2_SCHEMA",
      "LauncherDefinitionRequirementV2Schema",
      "LauncherDefinitionRequirementsCatalogV2Schema",
      "PLATFORM_EVIDENCE_DEFINITION_BLOCKER_CODES_V2",
      "PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_SCHEMA",
      "PLATFORM_EVIDENCE_DEFINITION_CATALOGS_V2_VERSION",
      "PlatformEvidenceDefinitionCatalogsV2Schema",
      "getEvidenceRunnerDefinitionRequirementsCatalogV2",
      "getLauncherDefinitionRequirementsCatalogV2",
      "getPlatformEvidenceDefinitionCatalogsV2",
      "hashEmptyOperationalEvidenceCatalogV2",
      "hashEvidenceRunnerDefinitionRequirementV2",
      "hashEvidenceRunnerDefinitionRequirementsCatalogV2",
      "hashLauncherDefinitionRequirementV2",
      "hashLauncherDefinitionRequirementsCatalogV2",
      "hashPlatformEvidenceDefinitionCatalogsV2",
    ]);
  });
});
