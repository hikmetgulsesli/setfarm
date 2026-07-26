import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as adapterCatalogModule from "../../src/evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import {
  EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2,
  EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA,
  EMPTY_OPERATIONAL_EVIDENCE_ADAPTER_CATALOG_V2_SCHEMA,
  EvidenceAdapterDefinitionCatalogV2Schema,
  getEvidenceAdapterDefinitionCatalogV2,
  hashEmptyOperationalEvidenceAdapterCatalogV2,
  hashEvidenceAdapterDefinitionCatalogV2,
  hashEvidenceAdapterRequirementDefinitionV2,
  type EvidenceAdapterDefinitionCatalogV2,
} from "../../src/evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import {
  getProductDeliveryProfileCatalogV2,
} from "../../src/product-compiler/product-delivery-profile-catalog-v2.js";
import {
  INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
  getInvocationTransportCodecCatalogV2,
  invocationTransportCodecCatalogHashV2,
} from "../../src/product-compiler/schemas/invocation-input-transport-v2.js";
import {
  evidenceReceiptAbiPolicyHashV2,
  getEvidenceReceiptAbiPolicyV2,
} from "../../src/evidence/schemas/evidence-receipt-v2.js";

const ADAPTER_CATALOG_HASH_GOLDEN_V2 =
  "f119941bb001cc5a50b624fd508774d5f9cb225ad962c8a9464b5d84c1a05154";
const EMPTY_OPERATIONAL_ADAPTER_CATALOG_HASH_GOLDEN_V2 =
  "c264dca319f59f4d3d483caa8c9e0b323372ae988978ef6685a26d0e7dc197ce";
const ADAPTER_DEFINITION_HASH_GOLDENS_V2 = [
  "b0ae604edba867690a8b3caa06a28a1384d46701d2c129228a30f5a989844ebd",
  "b8053ecb3a3124e5071416d70d212c2f0f8274b4e5dd72a1e0ecb7ff10f15576",
  "8990869b66d6eafbe7857ec4aa4a36ada67310d289c04a0bd735baa8c7943ec8",
  "fff1cbf05b4a986589ae9a0756a338add92da83e718de511a5d8b95f35f2fc9a",
  "ec0a77311eb8bb393d2bf3181a0054fbbd7ab458cbeb599d6e9cc4cb202326ef",
  "c07cfaefecb63590ea2e047f44c7e2d25cb5bdc0d62c3237829d0733204a11ef",
] as const;

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

describe("EvidenceAdapterDefinitionCatalogV2 requirements-only authority", () => {
  it("publishes exact CLI/API invocation and generated-test requirements", () => {
    const first = getEvidenceAdapterDefinitionCatalogV2();
    const second = getEvidenceAdapterDefinitionCatalogV2();
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
    assert.equal(first.schema, EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA);
    assert.equal(first.readiness, "shadow_blocked");
    assert.equal(first.productionUse, "forbidden");
    assert.deepEqual(first.blockerCodes, EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2);
    assert.deepEqual(
      first.definitions.map((definition) => definition.definitionRef),
      [
        "ADAPTER_REQUIREMENT_NODE_CLI_ACTION_INVOCATION_V2",
        "ADAPTER_REQUIREMENT_NODE_CLI_INVOCATION_OUTPUT_V2",
        "ADAPTER_REQUIREMENT_NODE_CLI_GENERATED_TEST_V2",
        "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_ACTION_INVOCATION_V2",
        "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_INVOCATION_OUTPUT_V2",
        "ADAPTER_REQUIREMENT_NODE_EXPRESS_API_GENERATED_TEST_V2",
      ],
    );
    assert.deepEqual(
      first.definitions.map((definition) => [
        definition.invocationKind,
        definition.checkRequirement.predicateKind,
        definition.checkRequirement.checkRef,
        definition.checkRequirement.selectorRequirement,
        definition.executionRequirement.kind === "invocation_transport"
          ? definition.executionRequirement.transportKind
          : definition.executionRequirement.commandRef,
      ]),
      [
        ["cli_process", "action_invocation", "CHECK_ACTION_INVOCATION", "action_subject", "cli_command"],
        ["cli_process", "observable_outcome", "CHECK_OBSERVABLE_OUTCOME", "invocation_output", "cli_command"],
        ["command", "test", "CHECK_TEST_PASS", "generated_test_command", "CMD_NODE_PRODUCT_TEST_V3"],
        ["http_service", "action_invocation", "CHECK_ACTION_INVOCATION", "action_subject", "http_request"],
        ["http_service", "observable_outcome", "CHECK_OBSERVABLE_OUTCOME", "invocation_output", "http_request"],
        ["command", "test", "CHECK_TEST_PASS", "generated_test_command", "CMD_NODE_PRODUCT_TEST_V3"],
      ],
    );
    assert.deepEqual(first.operationalCatalog, {
      schema: EMPTY_OPERATIONAL_EVIDENCE_ADAPTER_CATALOG_V2_SCHEMA,
      entries: [],
      catalogHash: first.operationalCatalog.catalogHash,
    });
    assert.equal(first.catalogHash, ADAPTER_CATALOG_HASH_GOLDEN_V2);
    assert.equal(
      first.operationalCatalog.catalogHash,
      EMPTY_OPERATIONAL_ADAPTER_CATALOG_HASH_GOLDEN_V2,
    );
    assert.deepEqual(
      first.definitions.map((definition) => definition.definitionHash),
      ADAPTER_DEFINITION_HASH_GOLDENS_V2,
    );
    assert.equal(first.catalogHash, hashEvidenceAdapterDefinitionCatalogV2(first));
    first.definitions.forEach((definition) => {
      assert.equal(
        definition.definitionHash,
        hashEvidenceAdapterRequirementDefinitionV2(definition),
      );
    });
    assertDeepFrozen(first);
  });

  it("binds every definition to exact ProfileV2, codec, receipt, check, and transport authority", () => {
    const catalog = getEvidenceAdapterDefinitionCatalogV2();
    const profiles = getProductDeliveryProfileCatalogV2();
    const codec = getInvocationTransportCodecCatalogV2();
    const receipt = getEvidenceReceiptAbiPolicyV2();
    assert.deepEqual(catalog.invocationCodecCatalogBinding, {
      schema: codec.schema,
      catalogVersion: codec.catalogVersion,
      catalogHash: invocationTransportCodecCatalogHashV2(),
    });
    assert.deepEqual(catalog.receiptSchemaBinding, {
      policySchema: receipt.schema,
      policyVersion: receipt.version,
      receiptSchema: receipt.receiptSchema,
      policyHash: evidenceReceiptAbiPolicyHashV2(),
    });
    for (const definition of catalog.definitions) {
      const profile = profiles.profiles.find((entry) =>
        entry.id === definition.profileRequirement.profileId)!;
      assert.equal(definition.profileRequirement.catalogSchema, profiles.schema);
      assert.equal(definition.profileRequirement.catalogVersion, profiles.catalogVersion);
      assert.equal(definition.profileRequirement.catalogHash, profiles.catalogHash);
      assert.equal(definition.profileRequirement.profileHash, profile.profileHash);
      if (definition.profileRequirement.executionKind === "profile_launcher") {
        assert.equal(definition.profileRequirement.launcherRef, profile.runtime.launcherRef);
      } else {
        assert.equal("launcherRef" in definition.profileRequirement, false);
      }
      if (definition.executionRequirement.kind === "invocation_transport") {
        assert.equal(
          definition.executionRequirement.transportSchema,
          INVOCATION_INPUT_TRANSPORT_ARTIFACT_TYPE_V2,
        );
        assert.equal(
          definition.executionRequirement.codecCatalogHash,
          invocationTransportCodecCatalogHashV2(),
        );
      } else {
        assert.equal(
          definition.executionRequirement.commandRef,
          "CMD_NODE_PRODUCT_TEST_V3",
        );
        assert.equal(
          definition.executionRequirement.runnerAbi,
          "NODE_TEST_RUNNER_DIRECT_FILE_ABI_V2",
        );
      }
      assert.equal(
        definition.executionRequirement.receiptAbiPolicyHash,
        evidenceReceiptAbiPolicyHashV2(),
      );
    }
  });

  it("rejects self-consistently rehashed profile, check, and transport forgeries", () => {
    type Mutation = (value: EvidenceAdapterDefinitionCatalogV2) => void;
    const mutations: readonly Mutation[] = [
      (value) => {
        value.definitions[0]!.profileRequirement.profileHash = "a".repeat(64);
      },
      (value) => {
        const profile = value.definitions[0]!.profileRequirement;
        if (profile.executionKind !== "profile_launcher") assert.fail();
        profile.launcherRef = "LAUNCH_NODE_EXPRESS_API_V2";
      },
      (value) => {
        Object.assign(value.definitions[0]!.checkRequirement, {
          predicateKind: "observable_outcome",
          checkRef: "CHECK_OBSERVABLE_OUTCOME",
          selectorRequirement: "invocation_output",
        });
      },
      (value) => {
        const requirement = value.definitions[0]!.executionRequirement;
        if (requirement.kind !== "invocation_transport") assert.fail();
        requirement.transportKind = "http_request";
      },
      (value) => {
        const requirement = value.definitions[0]!.executionRequirement;
        if (requirement.kind !== "invocation_transport") assert.fail();
        requirement.codecCatalogHash = "b".repeat(64);
      },
      (value) => {
        value.definitions[0]!.executionRequirement.receiptAbiPolicyHash = "c".repeat(64);
      },
      (value) => {
        value.receiptSchemaBinding.policyHash = "d".repeat(64);
      },
      (value) => {
        value.invocationCodecCatalogBinding.catalogHash = "e".repeat(64);
      },
    ];
    const baseline = getEvidenceAdapterDefinitionCatalogV2();
    for (const mutate of mutations) {
      const candidate = structuredClone(baseline);
      mutate(candidate);
      candidate.definitions[0]!.definitionHash =
        hashEvidenceAdapterRequirementDefinitionV2(candidate.definitions[0]!);
      candidate.catalogHash = hashEvidenceAdapterDefinitionCatalogV2(candidate);
      assert.equal(EvidenceAdapterDefinitionCatalogV2Schema.safeParse(candidate).success, false);
    }
  });

  it("forbids operational fixtures, unknown fields, and unsupported evidence classes", () => {
    const candidate = structuredClone(getEvidenceAdapterDefinitionCatalogV2()) as unknown as {
      operationalCatalog: { schema: string; entries: unknown[]; catalogHash: string };
      catalogHash: string;
    };
    candidate.operationalCatalog.entries = [{ adapterRef: "FIXTURE_ADAPTER" }];
    candidate.operationalCatalog.catalogHash = hashEmptyOperationalEvidenceAdapterCatalogV2(
      candidate.operationalCatalog as never,
    );
    candidate.catalogHash = hashEvidenceAdapterDefinitionCatalogV2(candidate as never);
    assert.equal(EvidenceAdapterDefinitionCatalogV2Schema.safeParse(candidate).success, false);

    const extra = structuredClone(getEvidenceAdapterDefinitionCatalogV2()) as unknown as
      Record<string, unknown>;
    extra.runnerRef = "ENTRY_EVIDENCE_CLI_PROCESS_V2";
    extra.catalogHash = hashEvidenceAdapterDefinitionCatalogV2(extra as never);
    assert.equal(EvidenceAdapterDefinitionCatalogV2Schema.safeParse(extra).success, false);

    const serialized = JSON.stringify(getEvidenceAdapterDefinitionCatalogV2());
    for (const forbidden of [
      "CHECK_BUILD_PASS",
      "browser_dom",
      "persistence_round_trip",
      "download",
      "visual",
      "database",
      "filesystem",
      "remote_api",
      "state_probe",
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    const commandDefinitions = getEvidenceAdapterDefinitionCatalogV2().definitions
      .filter((definition) => definition.invocationKind === "command");
    assert.equal(commandDefinitions.length, 2);
    for (const definition of commandDefinitions) {
      assert.equal(definition.profileRequirement.executionKind, "generated_test_command");
      assert.equal("launcherRef" in definition.profileRequirement, false);
      assert.equal(definition.executionRequirement.kind, "generated_test_command");
      assert.equal("transportSchema" in definition.executionRequirement, false);
    }
  });

  it("exposes no runnable authority, project hardcode, or caller-input getter", () => {
    const catalog = getEvidenceAdapterDefinitionCatalogV2();
    const forbiddenKeys = new Set([
      "runnerRef",
      "runnerEntrypointRef",
      "moduleHash",
      "moduleLocator",
      "toolchainHash",
      "supportSignature",
      "supportSignatures",
      "adapterRef",
      "executable",
      "command",
      "environment",
      "env",
      "origin",
    ]);
    for (const key of allKeys(catalog)) assert.equal(forbiddenKeys.has(key), false, key);
    assert.equal(getEvidenceAdapterDefinitionCatalogV2.length, 0);
    assert.deepEqual(Object.keys(adapterCatalogModule).sort(), [
      "EMPTY_OPERATIONAL_EVIDENCE_ADAPTER_CATALOG_V2_SCHEMA",
      "EVIDENCE_ADAPTER_DEFINITION_BLOCKER_CODES_V2",
      "EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_SCHEMA",
      "EVIDENCE_ADAPTER_DEFINITION_CATALOG_V2_VERSION",
      "EVIDENCE_ADAPTER_REQUIREMENT_DEFINITION_V2_SCHEMA",
      "EmptyOperationalEvidenceAdapterCatalogV2Schema",
      "EvidenceAdapterDefinitionCatalogV2Schema",
      "EvidenceAdapterRequirementDefinitionV2Schema",
      "getEvidenceAdapterDefinitionCatalogV2",
      "hashEmptyOperationalEvidenceAdapterCatalogV2",
      "hashEvidenceAdapterDefinitionCatalogV2",
      "hashEvidenceAdapterRequirementDefinitionV2",
    ]);
    const serialized = JSON.stringify(catalog);
    for (const projectHardcode of [
      "ACT_ADD_TASK",
      "ACT_CREATE_TASK",
      "Ship Setfarm",
      "#1925",
      "/tasks/:project",
      "setrox",
    ]) {
      assert.equal(serialized.includes(projectHardcode), false, projectHardcode);
    }
  });
});
