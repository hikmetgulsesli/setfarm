import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CandidateInvocationEvidenceExecutionAuthorityV2,
} from
  "../../src/evidence/candidate-invocation-evidence-v2.js";
import * as invocationRunnerExecutionModule from
  "../../src/evidence/invocation-evidence-runner-execution-v2.js";
import {
  ActivatedInvocationEvidenceRunnerExecutionLeaseV2,
  InvocationEvidenceRunnerExecutionErrorV2,
} from
  "../../src/evidence/invocation-evidence-runner-execution-v2.js";
import * as cliRunnerModule from
  "../../src/evidence/runners/cli-process-v2.js";
import {
  runEvidenceAdapterV2 as runCliEvidenceAdapterV2,
} from "../../src/evidence/runners/cli-process-v2.js";
import * as httpRunnerModule from
  "../../src/evidence/runners/http-service-v2.js";
import {
  runEvidenceAdapterV2 as runHttpEvidenceAdapterV2,
} from "../../src/evidence/runners/http-service-v2.js";
import {
  EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
} from "../../src/evidence/schemas/cli-process-runner-v2.js";
import {
  EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
  EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
} from "../../src/evidence/schemas/http-service-runner-v2.js";
import {
  INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2,
  INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
  InvocationEvidenceRunnerExecutionLeasePolicyV2Schema,
  getInvocationEvidenceRunnerExecutionLeasePolicyV2,
  hashInvocationEvidenceRunnerExecutionLeasePolicyV2,
} from
  "../../src/evidence/schemas/invocation-evidence-runner-execution-lease-v2.js";
import {
  getPlatformEvidenceDefinitionCatalogsV2,
} from
  "../../src/execution/schemas/platform-evidence-definition-catalogs-v2.js";
import {
  canonicalJsonBytes,
} from "../../src/product-compiler/canonical-json.js";

function assertDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(assertDeepFrozen);
}

function hasRunnerError(
  error: unknown,
  code:
    | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID"
    | "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
): boolean {
  return error instanceof InvocationEvidenceRunnerExecutionErrorV2
    && error.code === code;
}

describe("invocation evidence runner execution lease v2", () => {
  it("binds the exact CLI/HTTP admission pairs and all missing authorities", () => {
    const policy =
      getInvocationEvidenceRunnerExecutionLeasePolicyV2();
    assert.equal(
      InvocationEvidenceRunnerExecutionLeasePolicyV2Schema.safeParse(
        policy,
      ).success,
      true,
    );
    assert.equal(
      policy.contractHash,
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_CONTRACT_HASH_V2,
    );
    assert.equal(
      policy.contractHash,
      "3fd5c64ff985e178a5edc1a6c7c28e1ea685dd9edacf8b9fc7dbd7f81ba48ce0",
    );
    assert.equal(canonicalJsonBytes(policy).byteLength, 3_016);
    assert.deepEqual(
      policy.blockers,
      INVOCATION_EVIDENCE_RUNNER_EXECUTION_LEASE_BLOCKERS_V2,
    );
    assert.deepEqual(
      policy.acceptedRunners.map((runner) => ({
        runnerEntrypointRef: runner.runnerEntrypointRef,
        moduleLocator: runner.moduleLocator,
        abiHash: runner.abiHash,
      })),
      [
        {
          runnerEntrypointRef:
            EVIDENCE_CLI_PROCESS_RUNNER_ENTRYPOINT_REF_V2,
          moduleLocator:
            EVIDENCE_CLI_PROCESS_RUNNER_MODULE_LOCATOR_V2,
          abiHash: EVIDENCE_CLI_PROCESS_RUNNER_ABI_HASH_V2,
        },
        {
          runnerEntrypointRef:
            EVIDENCE_HTTP_SERVICE_RUNNER_ENTRYPOINT_REF_V2,
          moduleLocator:
            EVIDENCE_HTTP_SERVICE_RUNNER_MODULE_LOCATOR_V2,
          abiHash: EVIDENCE_HTTP_SERVICE_RUNNER_ABI_HASH_V2,
        },
      ],
    );
    assert.equal(
      policy.preReleaseAuthority.promotion,
      "forbidden_fresh_release_join_required",
    );
    assert.equal(policy.callerAuthority.callback, "forbidden");
    assertDeepFrozen(policy);
  });

  it("rejects self-rehashed policy drift and detached authority claims", () => {
    const drift = structuredClone(
      getInvocationEvidenceRunnerExecutionLeasePolicyV2(),
    ) as unknown as Record<string, unknown>;
    (drift.callerAuthority as Record<string, unknown>).callback =
      "permitted";
    drift.contractHash =
      hashInvocationEvidenceRunnerExecutionLeasePolicyV2(drift);
    assert.equal(
      InvocationEvidenceRunnerExecutionLeasePolicyV2Schema.safeParse(
        drift,
      ).success,
      false,
    );

    const reordered = structuredClone(
      getInvocationEvidenceRunnerExecutionLeasePolicyV2(),
    ) as unknown as Record<string, unknown>;
    (reordered.blockers as unknown[]).reverse();
    reordered.contractHash =
      hashInvocationEvidenceRunnerExecutionLeasePolicyV2(reordered);
    assert.equal(
      InvocationEvidenceRunnerExecutionLeasePolicyV2Schema.safeParse(
        reordered,
      ).success,
      false,
    );
  });

  it("publishes the real exact runner exports without an issuer or operational catalog claim", () => {
    assert.deepEqual(
      Object.keys(cliRunnerModule),
      ["runEvidenceAdapterV2"],
    );
    assert.deepEqual(
      Object.keys(httpRunnerModule),
      ["runEvidenceAdapterV2"],
    );
    assert.equal(
      typeof cliRunnerModule.runEvidenceAdapterV2,
      "function",
    );
    assert.equal(
      typeof httpRunnerModule.runEvidenceAdapterV2,
      "function",
    );
    const platform = getPlatformEvidenceDefinitionCatalogsV2();
    assert.equal(platform.readiness, "shadow_blocked");
    assert.equal(platform.productionUse, "forbidden");
    assert.deepEqual(platform.operationalCatalog.entries, []);

    const exportedNames = [
      ...Object.keys(invocationRunnerExecutionModule),
      ...Object.keys(cliRunnerModule),
      ...Object.keys(httpRunnerModule),
    ];
    for (const forbidden of [
      "issue",
      "create",
      "activate",
      "ForTest",
      "CandidateInvocationEvidenceExecutionAuthorityV2",
    ]) {
      assert.equal(
        exportedNames.some((name) => name.includes(forbidden)),
        false,
        forbidden,
      );
    }
  });

  it("rejects constructors, structural promotion, proxies, accessors, and extra fields before execution", async () => {
    assert.throws(
      () => new ActivatedInvocationEvidenceRunnerExecutionLeaseV2(
        {},
        {} as never,
      ),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      ),
    );

    const forgedLease = Object.create(
      ActivatedInvocationEvidenceRunnerExecutionLeaseV2.prototype,
    );
    await assert.rejects(
      runCliEvidenceAdapterV2({ lease: forgedLease }),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      ),
    );
    await assert.rejects(
      runHttpEvidenceAdapterV2({ lease: forgedLease }),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      ),
    );

    const preReleaseAuthority = Object.create(
      CandidateInvocationEvidenceExecutionAuthorityV2.prototype,
    );
    await assert.rejects(
      runCliEvidenceAdapterV2({ lease: preReleaseAuthority }),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      ),
    );

    let proxyTraps = 0;
    const proxiedLease = new Proxy({}, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error("lease proxy trap must not run");
      },
    });
    await assert.rejects(
      runHttpEvidenceAdapterV2({ lease: proxiedLease }),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_LEASE_UNAUTHENTICATED",
      ),
    );
    assert.equal(proxyTraps, 0);

    let accessorCalls = 0;
    const accessor = {};
    Object.defineProperty(accessor, "lease", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        throw new Error("lease accessor must not run");
      },
    });
    await assert.rejects(
      runCliEvidenceAdapterV2(accessor),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID",
      ),
    );
    assert.equal(accessorCalls, 0);

    await assert.rejects(
      runCliEvidenceAdapterV2({
        lease: forgedLease,
        expectedValue: "caller-owned",
      }),
      (error: unknown) => hasRunnerError(
        error,
        "INVOCATION_EVIDENCE_RUNNER_EXECUTION_V2_INPUT_INVALID",
      ),
    );
  });
});
