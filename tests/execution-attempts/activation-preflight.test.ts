import assert from "node:assert/strict";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  ActivationPreflightError,
  createActivationPreflightDependencies,
  runActivationPreflight,
  type ActivationPreflightDependencies,
} from "../../src/execution/activation-preflight.js";
import { applyContractSpineMigrations } from "../../src/db/contract-spine-migrations.js";
import {
  ArtifactStoreError,
  ContentAddressedArtifactStore,
} from "../../src/product-compiler/artifact-store.js";
import { createHybridArtifactStoreCapacityLeaseProviderV1 } from "../../src/product-compiler/artifact-store-authority.js";
import { createArtifactIndex } from "../../src/product-compiler/artifact-index.js";
import {
  IndexedArtifactPublisherError,
  bootstrapArtifactIndex,
} from "../../src/product-compiler/indexed-artifact-publisher.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const RELEASE_SHA = "d".repeat(40);
const REPORT_HASH = "e".repeat(64);

function dependencies(
  overrides: Partial<ActivationPreflightDependencies> = {},
): ActivationPreflightDependencies {
  return {
    verifyMigrations: async () => ({
      status: "verified",
      versions: [1, 2, 3, 4, 5],
      verifiedReleaseSha: RELEASE_SHA,
    }),
    probeDatabase: async () => ({ ok: true }),
    inspectArtifactCapacity: async () => ({
      rootBytes: 100,
      rootQuotaBytes: 1_000,
      freeBytes: 10_000,
      minFreeBytes: 100,
      indexState: "ready",
      indexedBytes: 100,
      reservedBytes: 0,
    }),
    readActivity: async () => ({ activeRuns: 0, openClaims: 0, activeAttempts: 0 }),
    storeReport: async () => ({ hash: REPORT_HASH }),
    ...overrides,
  };
}

describe("Product Compiler activation preflight", () => {
  it("constructs hybrid activation with separate inventory and existing-writer capabilities", () => {
    const created = createActivationPreflightDependencies({
      sql: {} as never,
      artifactRoot: path.join(tmpdir(), "setfarm-e1-authority", "sha256"),
      artifactLimits: {
        maxPayloadBytes: 4 * 1024 * 1024,
        rootQuotaBytes: 8 * 1024 * 1024,
        minFreeBytes: 0,
      },
      compilerReleaseSha: RELEASE_SHA,
      publicationAuthorityMode: "hybrid-required",
    });
    assert.equal(typeof created.inspectArtifactCapacity, "function");
    assert.equal(typeof created.storeReport, "function");
  });

  it("produces one stored canonical pass report for a clean v3 admission", async () => {
    const result = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: true,
    }, dependencies());
    assert.equal(result.status, "pass");
    assert.equal(result.hash, REPORT_HASH);
    assert.equal(result.stored, true);
    assert.equal(result.report.schema, "setfarm.activation-preflight.v1");
    assert.equal(result.report.checks.every((check) => check.status === "pass"), true);
  });

  it("keeps release attestation advisory in shadow but blocking in v3", async () => {
    const unattested = dependencies({
      verifyMigrations: async () => ({
        status: "verified",
        versions: [1, 2, 3, 4, 5],
        verifiedReleaseSha: null,
      }),
    });
    const shadow = await runActivationPreflight({
      protocol: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: false,
    }, unattested);
    assert.equal(shadow.status, "pass");
    assert.equal(
      shadow.report.checks.find((check) => check.id === "migration_attestation")?.status,
      "advisory",
    );

    const v3 = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: true,
    }, unattested);
    assert.equal(v3.status, "fail");
    assert.equal(
      v3.report.checks.find((check) => check.id === "migration_attestation")?.status,
      "fail",
    );
  });

  it("blocks low disk, DB failure, activity, or disabled v3 without leaking raw errors", async () => {
    const secret = "postgresql://secret-user:secret-pass@private/db /Users/private/payload";
    const result = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: false,
    }, dependencies({
      probeDatabase: async () => { throw new Error(secret); },
      inspectArtifactCapacity: async () => ({
        rootBytes: 100,
        rootQuotaBytes: 1_000,
        freeBytes: 99,
        minFreeBytes: 100,
        indexState: "ready",
        indexedBytes: 100,
        reservedBytes: 0,
      }),
      readActivity: async () => ({ activeRuns: 1, openClaims: 2, activeAttempts: 3 }),
    }));
    assert.equal(result.status, "fail");
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /secret-user|secret-pass|\/Users\/private/);
    assert.equal(result.report.checks.filter((check) => check.status === "fail").length >= 4, true);
  });

  it("fails closed when the report cannot be stored", async () => {
    await assert.rejects(
      runActivationPreflight({
        protocol: "shadow",
        compilerReleaseSha: RELEASE_SHA,
        v3ActivationEnabled: false,
      }, dependencies({
        storeReport: async () => { throw new Error("private store path"); },
      })),
      (error: unknown) =>
        error instanceof ActivationPreflightError
        && error.code === "ACTIVATION_PREFLIGHT_STORE_FAILED"
        && !error.message.includes("private store path"),
    );
  });

  it("projects typed inventory failure codes instead of agent or filesystem prose", async () => {
    const result = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: true,
    }, dependencies({
      inspectArtifactCapacity: async () => {
        throw new IndexedArtifactPublisherError(
          "ARTIFACT_INVENTORY_CLOSURE_REJECTED",
          "private root detail must not become operational evidence",
        );
      },
    }));
    assert.equal(
      result.report.checks.find((item) => item.id === "artifact_capacity")?.code,
      "ARTIFACT_INVENTORY_CLOSURE_REJECTED",
    );
    assert.doesNotMatch(JSON.stringify(result.report), /private root detail/);

    const bounded = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: true,
    }, dependencies({
      inspectArtifactCapacity: async () => {
        throw new ArtifactStoreError(
          "ARTIFACT_INVENTORY_LIMIT_EXCEEDED",
          "private aggregate-byte detail must not become operational evidence",
        );
      },
    }));
    assert.equal(
      bounded.report.checks.find((item) => item.id === "artifact_capacity")?.code,
      "ARTIFACT_INVENTORY_LIMIT_EXCEEDED",
    );
    assert.doesNotMatch(JSON.stringify(bounded.report), /private aggregate-byte detail/);
  });

  it("projects non-ready index state without trying to initialize inventory authority", async () => {
    const result = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: true,
    }, dependencies({
      inspectArtifactCapacity: async () => ({
        rootBytes: 0,
        rootQuotaBytes: 1_000,
        freeBytes: 10_000,
        minFreeBytes: 100,
        indexState: "quarantined",
        indexedBytes: 0,
        reservedBytes: 0,
      }),
    }));
    assert.equal(
      result.report.checks.find((item) => item.id === "artifact_capacity")?.code,
      "ARTIFACT_INDEX_QUARANTINED",
    );
  });

  it("blocks activation when a terminal legacy lifecycle leaked an active attempt", async () => {
    const result = await runActivationPreflight({
      protocol: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: false,
    }, dependencies({
      readActivity: async () => ({ activeRuns: 0, openClaims: 0, activeAttempts: 1 }),
    }));
    assert.equal(result.status, "fail");
    const activity = result.report.checks.find((check) => check.id === "activity");
    assert.equal(activity?.code, "ACTIVATION_ACTIVITY_CONFLICT");
    assert.deepEqual(activity?.metrics, {
      activeRuns: 0,
      openClaims: 0,
      activeAttempts: 1,
      activeAttemptBindingConflicts: 0,
      activeRuntimes: 0,
      activeRuntimeCompletions: 0,
      activeRecoveryCases: 0,
      activeRecoveryDeliveries: 0,
      activeTerminationRequests: 0,
    });
  });

  it("blocks activation on orphaned runtime, completion, recovery, or termination ownership", async () => {
    const result = await runActivationPreflight({
      protocol: "v3",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: true,
    }, dependencies({
      readActivity: async () => ({
        activeRuns: 0,
        openClaims: 0,
        activeAttempts: 0,
        activeRuntimes: 1,
        activeRuntimeCompletions: 1,
        activeRecoveryCases: 1,
        activeRecoveryDeliveries: 1,
        activeTerminationRequests: 1,
      }),
    }));
    assert.equal(result.status, "fail");
    const activity = result.report.checks.find((check) => check.id === "activity");
    assert.equal(activity?.code, "ACTIVATION_ACTIVITY_CONFLICT");
    assert.deepEqual(activity?.metrics, {
      activeRuns: 0,
      openClaims: 0,
      activeAttempts: 0,
      activeAttemptBindingConflicts: 0,
      activeRuntimes: 1,
      activeRuntimeCompletions: 1,
      activeRecoveryCases: 1,
      activeRecoveryDeliveries: 1,
      activeTerminationRequests: 1,
    });
  });

  it("reports an active attempt without its exact open relational claim as ownership drift", async () => {
    const result = await runActivationPreflight({
      protocol: "shadow",
      compilerReleaseSha: RELEASE_SHA,
      v3ActivationEnabled: false,
    }, dependencies({
      readActivity: async () => ({
        activeRuns: 0,
        openClaims: 0,
        activeAttempts: 1,
        activeAttemptBindingConflicts: 1,
      }),
    }));
    const activity = result.report.checks.find((check) => check.id === "activity");
    assert.equal(result.status, "fail");
    assert.equal(activity?.code, "ACTIVATION_ATTEMPT_CLAIM_BINDING_CONFLICT");
    assert.equal(activity?.metrics?.activeAttemptBindingConflicts, 1);
  });

  it("verifies an isolated DB and stores the exact report envelope", async () => {
    const database = await createIsolatedTestDatabase();
    const temp = await mkdtemp(path.join(tmpdir(), "setfarm-preflight-integration-"));
    const root = path.join(temp, "sha256");
    const limits = {
      maxPayloadBytes: 4 * 1024 * 1024,
      rootQuotaBytes: 8 * 1024 * 1024,
      minFreeBytes: 0,
    };
    try {
      await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
      const artifactStore = new ContentAddressedArtifactStore(root, { limits });
      await bootstrapArtifactIndex({
        index: createArtifactIndex(database.sql),
        store: artifactStore,
        quotaBytes: limits.rootQuotaBytes,
        maxPayloadBytes: limits.maxPayloadBytes,
      });
      const result = await runActivationPreflight({
        protocol: "v3",
        compilerReleaseSha: RELEASE_SHA,
        v3ActivationEnabled: true,
      }, createActivationPreflightDependencies({
        sql: database.sql,
        artifactRoot: root,
        artifactLimits: limits,
        compilerReleaseSha: RELEASE_SHA,
      }));
      assert.equal(result.status, "pass");
      const stored = await artifactStore.get(result.hash);
      assert.deepEqual(stored.envelope.payload, result.report);
      assert.equal(stored.envelope.producer.codeSha, RELEASE_SHA);

      await database.sql`
        INSERT INTO runs (id, run_number, workflow_id, task, status)
        VALUES ('preflight-resuming-owner', 97, 'feature-dev', 'resuming owner', 'resuming')
      `;
      const blocked = await runActivationPreflight({
        protocol: "shadow",
        compilerReleaseSha: RELEASE_SHA,
        v3ActivationEnabled: false,
      }, createActivationPreflightDependencies({
        sql: database.sql,
        artifactRoot: root,
        artifactLimits: limits,
        compilerReleaseSha: RELEASE_SHA,
      }));
      assert.equal(blocked.status, "fail");
      assert.equal(
        blocked.report.checks.find((item) => item.id === "activity")?.code,
        "ACTIVATION_ACTIVITY_CONFLICT",
      );
    } finally {
      await database.cleanup();
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("verifies one held hybrid inventory generation and stores through existing-writer authority", async () => {
    const database = await createIsolatedTestDatabase();
    const temp = await mkdtemp(path.join(tmpdir(), "setfarm-preflight-hybrid-"));
    const root = path.join(temp, "sha256");
    const limits = {
      maxPayloadBytes: 4 * 1024 * 1024,
      rootQuotaBytes: 8 * 1024 * 1024,
      minFreeBytes: 0,
    };
    try {
      await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
      const adoptionStore = new ContentAddressedArtifactStore(root, {
        limits,
        capacityLeaseProvider: createHybridArtifactStoreCapacityLeaseProviderV1({
          sql: database.sql,
          artifactRoot: root,
          purpose: "inventory-adoption",
        }),
      });
      await bootstrapArtifactIndex({
        index: createArtifactIndex(database.sql),
        store: adoptionStore,
        quotaBytes: limits.rootQuotaBytes,
        maxPayloadBytes: limits.maxPayloadBytes,
      });

      const result = await runActivationPreflight({
        protocol: "v3",
        compilerReleaseSha: RELEASE_SHA,
        v3ActivationEnabled: true,
      }, createActivationPreflightDependencies({
        sql: database.sql,
        artifactRoot: root,
        artifactLimits: limits,
        compilerReleaseSha: RELEASE_SHA,
        publicationAuthorityMode: "hybrid-required",
      }));

      assert.equal(result.status, "pass");
      const stored = await adoptionStore.get(result.hash);
      assert.deepEqual(stored.envelope.payload, result.report);
      assert.equal((await createArtifactIndex(database.sql).getCapacity()).state, "ready");
    } finally {
      await database.cleanup();
      await rm(temp, { recursive: true, force: true });
    }
  });

  it("observes bootstrap-required hybrid state without creating root authority", async () => {
    const database = await createIsolatedTestDatabase();
    const temp = await mkdtemp(path.join(tmpdir(), "setfarm-preflight-hybrid-unready-"));
    const root = path.join(temp, "sha256");
    const limits = {
      maxPayloadBytes: 4 * 1024 * 1024,
      rootQuotaBytes: 8 * 1024 * 1024,
      minFreeBytes: 0,
    };
    try {
      const observed = await createActivationPreflightDependencies({
        sql: database.sql,
        artifactRoot: root,
        artifactLimits: limits,
        compilerReleaseSha: RELEASE_SHA,
        publicationAuthorityMode: "hybrid-required",
      }).inspectArtifactCapacity();

      assert.equal(observed.indexState, "bootstrap_required");
      assert.deepEqual(
        Array.from(await database.sql.unsafe("SELECT * FROM artifact_store_authorities")),
        [],
      );
      await assert.rejects(lstat(root), /ENOENT/);
    } finally {
      await database.cleanup();
      await rm(temp, { recursive: true, force: true });
    }
  });
});
