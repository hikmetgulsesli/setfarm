import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as commandRunnerSchemaModule from
  "../../src/evidence/schemas/command-runner-v2.js";
import {
  CommandEvidenceRunnerAuthorityV2,
  CommandEvidenceRunnerErrorV2,
  issueCommandEvidenceRunnerAuthorityV2ForTest,
  runEvidenceAdapterV2,
} from "../../src/evidence/runners/command-v2.js";
import {
  EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2,
  EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2,
  EVIDENCE_COMMAND_RUNNER_ABI_REF_V2,
  EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_COMMAND_RUNNER_EXPORT_V2,
  EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
  EVIDENCE_COMMAND_TIMEOUT_MS_V2,
  EvidenceCommandRunnerAbiPolicyV2Schema,
  getEvidenceCommandRunnerAbiPolicyV2,
} from "../../src/evidence/schemas/command-runner-v2.js";
import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from "../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

describe("command evidence runner V2 code authority", () => {
  it("publishes one strict frozen ABI with a stable domain-separated hash", () => {
    const first = getEvidenceCommandRunnerAbiPolicyV2();
    const second = getEvidenceCommandRunnerAbiPolicyV2();
    assert.notStrictEqual(first, second);
    assert.deepEqual(first, second);
    assert.equal(
      EvidenceCommandRunnerAbiPolicyV2Schema.safeParse(first).success,
      true,
    );
    assert.equal(
      first.runnerEntrypointRef,
      EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
    );
    assert.equal(first.moduleLocator, EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2);
    assert.equal(first.requiredExport, EVIDENCE_COMMAND_RUNNER_EXPORT_V2);
    assert.equal(first.abiRef, EVIDENCE_COMMAND_RUNNER_ABI_REF_V2);
    assert.equal(first.timeoutMs, EVIDENCE_COMMAND_TIMEOUT_MS_V2);
    assert.equal(first.maxStdoutBytes, EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2);
    assert.equal(first.maxStderrBytes, EVIDENCE_COMMAND_MAX_OUTPUT_BYTES_V2);
    assert.equal(first.abiHash, EVIDENCE_COMMAND_RUNNER_ABI_HASH_V2);
    assert.equal(
      first.abiHash,
      "8b5764fbf6be0908541e59d455da92faed8c0515e3e3ddd821d1d230c8ccd347",
    );
    assert.equal(canonicalJsonBytes(first).byteLength, 1_989);
    assertDeepFrozen(first);
  });

  it("rejects self-rehashed policy drift, unknown fields, and mutable-path authority", () => {
    const timeoutDrift = structuredClone(
      getEvidenceCommandRunnerAbiPolicyV2(),
    ) as unknown as Record<string, unknown>;
    timeoutDrift.timeoutMs = EVIDENCE_COMMAND_TIMEOUT_MS_V2 + 1;
    timeoutDrift.abiHash = "a".repeat(64);
    assert.equal(
      EvidenceCommandRunnerAbiPolicyV2Schema.safeParse(timeoutDrift).success,
      false,
    );

    const extra = {
      ...getEvidenceCommandRunnerAbiPolicyV2(),
      testPath: "/private/generated-project/dist/test.js",
    };
    assert.equal(
      EvidenceCommandRunnerAbiPolicyV2Schema.safeParse(extra).success,
      false,
    );

    const serialized = JSON.stringify(getEvidenceCommandRunnerAbiPolicyV2());
    for (const forbidden of [
      "absolutePath",
      "bundleRoot",
      "worktree",
      "callerCommand",
      "callerEnvironment",
      "githubComment",
      "regexClassifier",
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  });

  it("closes the platform runner requirement without claiming operational release support", () => {
    const platform = getPlatformEvidenceDefinitionCatalogsV2();
    const requirement = platform.runnerRequirements.definitions.find(
      (candidate) =>
        candidate.runnerEntrypointRef
          === EVIDENCE_COMMAND_RUNNER_ENTRYPOINT_REF_V2,
    );
    assert.ok(requirement);
    assert.equal(
      requirement.requiredModuleLocator,
      EVIDENCE_COMMAND_RUNNER_MODULE_LOCATOR_V2,
    );
    assert.equal(requirement.requiredExport, EVIDENCE_COMMAND_RUNNER_EXPORT_V2);
    assert.equal(requirement.requiredAbiRef, EVIDENCE_COMMAND_RUNNER_ABI_REF_V2);
    assert.equal(platform.readiness, "shadow_blocked");
    assert.equal(platform.productionUse, "forbidden");
    assert.deepEqual(platform.operationalCatalog.entries, []);
  });

  it("rejects forged, proxied, accessor, and extra-field authority before execution", async () => {
    assert.throws(
      () => new CommandEvidenceRunnerAuthorityV2({}, {} as never),
      (error: unknown) => error instanceof CommandEvidenceRunnerErrorV2
        && error.code
          === "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_UNAUTHENTICATED",
    );

    const forged = Object.create(
      CommandEvidenceRunnerAuthorityV2.prototype,
    ) as CommandEvidenceRunnerAuthorityV2;
    await assert.rejects(
      runEvidenceAdapterV2({ authority: forged }),
      (error: unknown) => error instanceof CommandEvidenceRunnerErrorV2
        && error.code
          === "EVIDENCE_COMMAND_RUNNER_V2_AUTHORITY_UNAUTHENTICATED",
    );

    let proxyTraps = 0;
    const proxiedRuntime = new Proxy({}, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error("runtime proxy trap must not run");
      },
    });
    await assert.rejects(
      issueCommandEvidenceRunnerAuthorityV2ForTest({
        runtimeAuthority: proxiedRuntime,
        expectedBundleHash: "a".repeat(64),
        store: {},
        execution: {},
      }),
      (error: unknown) => error instanceof CommandEvidenceRunnerErrorV2
        && error.code === "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
    );
    assert.equal(proxyTraps, 0);

    let accessorCalls = 0;
    const accessor = {
      expectedBundleHash: "a".repeat(64),
      store: {},
      execution: {},
    } as Record<string, unknown>;
    Object.defineProperty(accessor, "runtimeAuthority", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("authority accessor must not run");
      },
    });
    await assert.rejects(
      issueCommandEvidenceRunnerAuthorityV2ForTest(accessor),
      (error: unknown) => error instanceof CommandEvidenceRunnerErrorV2
        && error.code === "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
    );
    assert.equal(accessorCalls, 0);

    await assert.rejects(
      runEvidenceAdapterV2({ authority: forged, callerCommand: ["node"] }),
      (error: unknown) => error instanceof CommandEvidenceRunnerErrorV2
        && error.code === "EVIDENCE_COMMAND_RUNNER_V2_INPUT_INVALID",
    );
  });

  it("keeps schema authority separate from runnable implementation exports", () => {
    const exports = Object.keys(commandRunnerSchemaModule);
    for (const forbidden of [
      "runEvidenceAdapterV2",
      "issueCommandEvidenceRunnerAuthorityV2ForTest",
      "spawn",
      "executePrivateNodeTestCommandV2",
    ]) {
      assert.equal(exports.includes(forbidden), false);
    }
  });
});
