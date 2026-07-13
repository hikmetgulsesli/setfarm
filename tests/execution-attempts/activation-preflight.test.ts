import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
import { ContentAddressedArtifactStore } from "../../src/product-compiler/artifact-store.js";
import { createIsolatedTestDatabase } from "./test-database.js";

const RELEASE_SHA = "d".repeat(40);
const REPORT_HASH = "e".repeat(64);

function dependencies(
  overrides: Partial<ActivationPreflightDependencies> = {},
): ActivationPreflightDependencies {
  return {
    verifyMigrations: async () => ({
      status: "verified",
      versions: [1, 2, 3, 4],
      verifiedReleaseSha: RELEASE_SHA,
    }),
    probeDatabase: async () => ({ ok: true }),
    inspectArtifactCapacity: async () => ({
      rootBytes: 100,
      rootQuotaBytes: 1_000,
      freeBytes: 10_000,
      minFreeBytes: 100,
    }),
    readActivity: async () => ({ activeRuns: 0, openClaims: 0 }),
    storeReport: async () => ({ hash: REPORT_HASH }),
    ...overrides,
  };
}

describe("Product Compiler activation preflight", () => {
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
        versions: [1, 2, 3, 4],
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
      }),
      readActivity: async () => ({ activeRuns: 1, openClaims: 2 }),
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
      const stored = await new ContentAddressedArtifactStore(root, { limits }).get(result.hash);
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
});
