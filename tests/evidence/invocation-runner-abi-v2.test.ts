import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as cliRunnerAbiModule from
  "../../src/evidence/schemas/cli-process-runner-v2.js";
import * as httpRunnerAbiModule from
  "../../src/evidence/schemas/http-service-runner-v2.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
  EvidenceCliProcessRunnerAbiPolicyV2Schema,
  getEvidenceCliProcessRunnerAbiPolicyV2,
  hashEvidenceCliProcessRunnerAbiPolicyV2,
} from "../../src/evidence/schemas/cli-process-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
  EvidenceHttpServiceRunnerAbiPolicyV2Schema,
  getEvidenceHttpServiceRunnerAbiPolicyV2,
  hashEvidenceHttpServiceRunnerAbiPolicyV2,
} from "../../src/evidence/schemas/http-service-runner-v2.js";
import {
  EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
  evidenceReceiptAbiPolicyHashV2,
} from "../../src/evidence/schemas/evidence-receipt-v2.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from
  "../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  NODE_CLI_LAUNCHER_ABI_HASH_V2,
} from "../../src/execution/schemas/node-cli-launcher-v2.js";
import {
  NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
  NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
} from
  "../../src/execution/schemas/node-express-api-launcher-v2.js";
import {
  INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
} from
  "../../src/product-compiler/schemas/invocation-evidence-check-v2.js";
import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

describe("CLI/HTTP evidence runner ABI V2", () => {
  it("publishes exact frozen source-derived CLI and HTTP policies", () => {
    const cli = getEvidenceCliProcessRunnerAbiPolicyV2();
    const http = getEvidenceHttpServiceRunnerAbiPolicyV2();
    assert.equal(
      EvidenceCliProcessRunnerAbiPolicyV2Schema.safeParse(cli).success,
      true,
    );
    assert.equal(
      EvidenceHttpServiceRunnerAbiPolicyV2Schema.safeParse(http).success,
      true,
    );
    assert.equal(
      cli.abiHash,
      "ddf29ae4adf6e1b6cf552c8c7200d14ad5ba2284051f1dbb052e2a2c12036920",
    );
    assert.equal(
      http.abiHash,
      "e6a06075d465426ad73c8c70af3eafb52d080f52ed841e44ed3d5bf61906acd9",
    );
    assert.equal(canonicalJsonBytes(cli).byteLength, 2_757);
    assert.equal(canonicalJsonBytes(http).byteLength, 3_003);
    assert.equal(
      cli.checkAuthority.contractHash,
      INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
    );
    assert.equal(
      http.checkAuthority.contractHash,
      INVOCATION_EVIDENCE_CHECK_CONTRACT_HASH_V2,
    );
    assert.equal(cli.launcher.abiHash, NODE_CLI_LAUNCHER_ABI_HASH_V2);
    assert.equal(
      http.launcher.abiHash,
      NODE_EXPRESS_API_LAUNCHER_ABI_HASH_V2,
    );
    assert.equal(
      cli.receipt.abiPolicyHash,
      evidenceReceiptAbiPolicyHashV2(),
    );
    assert.equal(
      http.receipt.abiPolicyHash,
      evidenceReceiptAbiPolicyHashV2(),
    );
    assert.equal(
      EVIDENCE_HTTP_RESPONSE_MAX_BYTES_V2,
      NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
    );
    assert.equal(
      http.servicePolicy.responseByteLimit,
      NODE_EXPRESS_API_MAX_RESPONSE_BYTES_V2,
    );
    assertDeepFrozen(cli);
    assertDeepFrozen(http);
  });

  it("closes exact platform requirements but does not claim operational support", () => {
    const platform = getPlatformEvidenceDefinitionCatalogsV2();
    const cliRequirement = platform.runnerRequirements.definitions.find(
      (candidate) => candidate.runnerEntrypointRef
        === EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
    );
    const httpRequirement = platform.runnerRequirements.definitions.find(
      (candidate) => candidate.runnerEntrypointRef
        === EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
    );
    assert.ok(cliRequirement);
    assert.ok(httpRequirement);
    assert.deepEqual(
      {
        moduleLocator: cliRequirement.requiredModuleLocator,
        requiredExport: cliRequirement.requiredExport,
        abiRef: cliRequirement.requiredAbiRef,
      },
      {
        moduleLocator: EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
        requiredExport: EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2,
        abiRef: EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2,
      },
    );
    assert.deepEqual(
      {
        moduleLocator: httpRequirement.requiredModuleLocator,
        requiredExport: httpRequirement.requiredExport,
        abiRef: httpRequirement.requiredAbiRef,
      },
      {
        moduleLocator: EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
        requiredExport: EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2,
        abiRef: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2,
      },
    );
    assert.equal(platform.readiness, "shadow_blocked");
    assert.equal(platform.productionUse, "forbidden");
    assert.deepEqual(platform.operationalCatalog.entries, []);
  });

  it("rejects self-rehashed policy drift and caller-owned expected/runtime fields", () => {
    const cliDrift = structuredClone(
      getEvidenceCliProcessRunnerAbiPolicyV2(),
    ) as unknown as Record<string, unknown>;
    (cliDrift.checkAuthority as Record<string, unknown>)
      .callerExpectedValue = "permitted";
    cliDrift.abiHash =
      hashEvidenceCliProcessRunnerAbiPolicyV2(cliDrift);
    assert.equal(
      EvidenceCliProcessRunnerAbiPolicyV2Schema.safeParse(cliDrift).success,
      false,
    );

    const httpDrift = structuredClone(
      getEvidenceHttpServiceRunnerAbiPolicyV2(),
    ) as unknown as Record<string, unknown>;
    (httpDrift.servicePolicy as Record<string, unknown>).requestCount = 2;
    httpDrift.abiHash =
      hashEvidenceHttpServiceRunnerAbiPolicyV2(httpDrift);
    assert.equal(
      EvidenceHttpServiceRunnerAbiPolicyV2Schema.safeParse(httpDrift)
        .success,
      false,
    );

    for (const policy of [
      getEvidenceCliProcessRunnerAbiPolicyV2(),
      getEvidenceHttpServiceRunnerAbiPolicyV2(),
    ]) {
      const serialized = JSON.stringify(policy);
      for (const forbidden of [
        "callerCommand",
        "callerEnvironment",
        "callerExpectedValue\":\"permitted",
        "githubComment",
        "regexClassifier",
        "worktreePath",
        "/Users/",
      ]) {
        assert.equal(serialized.includes(forbidden), false, forbidden);
      }
    }
  });

  it("exports policy data only, with no early authority issuer or activation API", () => {
    assert.deepEqual(
      Object.keys(cliRunnerAbiModule).sort(),
      [
        "EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2",
        "EVIDENCE_CLI_PROCESS_RUNNER_ABI_POLICY_V2_SCHEMA",
        "EVIDENCE_CLI_PROCESS_RUNNER_ABI_REF_V2",
        "EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2",
        "EVIDENCE_CLI_PROCESS_RUNNER_EXPORT_V2",
        "EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2",
        "EVIDENCE_CLI_PROCESS_RUNNER_SOURCE_MODULE_LOCATOR_V2",
        "EvidenceCliProcessRunnerAbiPolicyV2Schema",
        "getEvidenceCliProcessRunnerAbiPolicyV2",
        "hashEvidenceCliProcessRunnerAbiPolicyV2",
      ].sort(),
    );
    assert.deepEqual(
      Object.keys(httpRunnerAbiModule).sort(),
      [
        "EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2",
        "EVIDENCE_HTTP_SERVICE_RUNNER_ABI_POLICY_V2_SCHEMA",
        "EVIDENCE_HTTP_SERVICE_RUNNER_ABI_REF_V2",
        "EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2",
        "EVIDENCE_HTTP_SERVICE_RUNNER_EXPORT_V2",
        "EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2",
        "EVIDENCE_HTTP_SERVICE_RUNNER_SOURCE_MODULE_LOCATOR_V2",
        "EvidenceHttpServiceRunnerAbiPolicyV2Schema",
        "getEvidenceHttpServiceRunnerAbiPolicyV2",
        "hashEvidenceHttpServiceRunnerAbiPolicyV2",
      ].sort(),
    );
  });
});
