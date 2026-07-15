import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

import { ContentAddressedEvalResultStore } from "../../src/evals/report.js";
import {
  RunProtocolError,
  createRunProtocolRepository,
  resolveNewRunProtocol,
} from "../../src/execution/run-protocol.js";
import {
  RunActivationConflictError,
  persistWorkflowRun,
} from "../../src/execution/run-persistence.js";
import {
  V3ReleaseAdmissionError,
  createV3ReleaseAdmissionRepository,
} from "../../src/execution/v3-release-admission-repository.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { verifyContractSpineMigrations } from "../../src/db/contract-spine-migrations.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const SUITE_HASH = "b".repeat(64);
const PREFLIGHT_HASH = "c".repeat(64);
const PASS_PREFLIGHT = { status: "pass" as const, hash: PREFLIGHT_HASH, stored: true };

describe("v3 release-bound admission", () => {
  let database: TestDatabase;
  let root: string;
  let store: ContentAddressedEvalResultStore;

  before(async () => {
    database = await createIsolatedTestDatabase();
    root = await mkdtemp(path.join(tmpdir(), "setfarm-v3-release-admission-"));
    store = new ContentAddressedEvalResultStore(root);
  });

  after(async () => {
    await database.cleanup();
    await rm(root, { recursive: true, force: true });
  });

  function canaryInput(suffix: string, task: string, repetitions = [1]) {
    return {
      releaseSha: RELEASE_SHA,
      suiteHash: SUITE_HASH,
      preflightHash: PREFLIGHT_HASH,
      ttlMs: 60 * 60 * 1_000,
      slots: repetitions.map((repetition) => ({
        caseHash: hashCanonicalJson({ suffix, repetition }),
        taskHash: hashCanonicalJson(task),
        repetition,
        slotToken: `${suffix}-${repetition}-${"x".repeat(48)}`,
      })),
    } as const;
  }

  it("creates exact immutable canary slots idempotently and rejects tamper or expiry", async () => {
    const task = "build the exact admission fixture";
    const input = canaryInput("idempotent", task, [1, 2]);
    const repository = createV3ReleaseAdmissionRepository(database.sql, store, {
      now: () => new Date("2999-01-01T00:00:00.000Z"),
    });
    const [first, second] = await Promise.all([
      repository.createCanary(input),
      repository.createCanary(input),
    ]);
    assert.deepEqual(second, first);
    assert.deepEqual(
      await repository.createCanary({ ...input, slots: [...input.slots].reverse() }),
      first,
    );
    assert.ok(new Date(first.admission.issuedAt).getTime() < new Date("2999-01-01T00:00:00.000Z").getTime());
    assert.equal(
      new Date(first.admission.expiresAt).getTime() - new Date(first.admission.issuedAt).getTime(),
      input.ttlMs,
    );

    const rows = await database.sql<Array<{ admissions: number; claims: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM v3_release_admissions
          WHERE admission_hash = ${first.admission.admissionHash}) AS admissions,
        (SELECT COUNT(*)::integer FROM v3_canary_admission_claims
          WHERE admission_hash = ${first.admission.admissionHash}) AS claims
    `;
    assert.deepEqual({ ...rows[0] }, { admissions: 1, claims: 2 });

    const context = first.contexts[0]!;
    const selected = await repository.verifyCanarySelection({
      releaseSha: RELEASE_SHA,
      taskHash: hashCanonicalJson(task),
      context,
    });
    assert.equal(selected.kind, "convergence_canary");
    assert.equal(selected.admissionHash, first.admission.admissionHash);

    await assert.rejects(
      repository.verifyCanarySelection({
        releaseSha: RELEASE_SHA,
        taskHash: hashCanonicalJson(task),
        context: { ...context, slotToken: `${"z".repeat(64)}` },
      }),
      (error: unknown) => error instanceof V3ReleaseAdmissionError
        && error.code === "V3_CANARY_ADMISSION_INVALID",
    );
    const expiringInput = {
      ...canaryInput("expiring", task),
      ttlMs: 200,
    };
    const expiring = await repository.createCanary(expiringInput);
    await database.sql`SELECT pg_sleep(0.3)`;
    await assert.rejects(
      repository.verifyCanarySelection({
        releaseSha: RELEASE_SHA,
        taskHash: hashCanonicalJson(task),
        context: expiring.contexts[0]!,
      }),
      (error: unknown) => error instanceof V3ReleaseAdmissionError
        && error.code === "V3_CANARY_ADMISSION_EXPIRED",
    );

    await assert.rejects(
      database.sql`UPDATE v3_release_admissions SET suite_hash = ${"d".repeat(64)}
                    WHERE admission_hash = ${first.admission.admissionHash}`,
    );
    await assert.rejects(
      database.sql`DELETE FROM v3_canary_admission_claims WHERE slot_hash = ${context.slotHash}`,
    );
  });

  it("consumes one exact canary slot atomically with the v3 run and sets the pointer once", async () => {
    const task = "persist one release-bound canary run";
    const repository = createV3ReleaseAdmissionRepository(database.sql, store);
    const created = await repository.createCanary(canaryInput("atomic", task));
    const releaseAdmission = await repository.verifyCanarySelection({
      releaseSha: RELEASE_SHA,
      taskHash: hashCanonicalJson(task),
      context: created.contexts[0]!,
    });
    const protocol = resolveNewRunProtocol({
      requestedMode: "v3",
      compilerReleaseSha: RELEASE_SHA,
      env: { SETFARM_V3_ACTIVATION: "enabled" },
      activationPreflight: PASS_PREFLIGHT,
      releaseAdmission,
    });
    const createdAt = "2999-01-01T00:00:00.000Z";
    await database.sql.begin((sql) => persistWorkflowRun(sql, {
      run: {
        id: "v3-canary-atomic-run",
        runNumber: 301,
        workflowId: "feature-dev",
        task,
        context: "{}",
        notifyUrl: null,
        createdAt,
        protocol,
      },
      steps: [],
    }));

    const rows = await database.sql<Array<{
      release_admission_hash: string;
      run_id: string;
      run_created_at: Date;
      consumed_at: Date;
    }>>`
      SELECT run.release_admission_hash, claim.run_id,
             run.created_at AS run_created_at, claim.consumed_at
        FROM runs run
        JOIN v3_canary_admission_claims claim
          ON claim.run_id = run.id
       WHERE run.id = 'v3-canary-atomic-run'
    `;
    assert.equal(rows[0]?.release_admission_hash, created.admission.admissionHash);
    assert.equal(rows[0]?.run_id, "v3-canary-atomic-run");
    assert.equal(rows[0]?.consumed_at.toISOString(), rows[0]?.run_created_at.toISOString());
    assert.ok(rows[0]!.run_created_at.getTime() < new Date(createdAt).getTime());
    const stored = await createRunProtocolRepository(database.sql).read("v3-canary-atomic-run");
    assert.equal(stored.releaseAdmissionHash, created.admission.admissionHash);
    assert.equal(stored.releaseAdmissionKind, "convergence_canary");

    await assert.rejects(
      repository.verifyCanarySelection({
        releaseSha: RELEASE_SHA,
        taskHash: hashCanonicalJson(task),
        context: created.contexts[0]!,
      }),
      (error: unknown) => error instanceof V3ReleaseAdmissionError
        && error.code === "V3_CANARY_ADMISSION_SLOT_CONSUMED",
    );
    await assert.rejects(
      database.sql`UPDATE runs SET release_admission_hash = NULL WHERE id = 'v3-canary-atomic-run'`,
      /SETFARM_RUN_RELEASE_ADMISSION_IMMUTABLE/,
    );
    await database.sql`UPDATE runs SET status = 'completed' WHERE id = 'v3-canary-atomic-run'`;
  });

  it("rolls back slot consumption with a failed run insert and serializes concurrent reuse", async () => {
    const task = "rollback and race the same canary slot";
    const repository = createV3ReleaseAdmissionRepository(database.sql, store);
    const created = await repository.createCanary(canaryInput("rollback", task));
    const releaseAdmission = await repository.verifyCanarySelection({
      releaseSha: RELEASE_SHA,
      taskHash: hashCanonicalJson(task),
      context: created.contexts[0]!,
    });
    const protocol = resolveNewRunProtocol({
      requestedMode: "v3",
      compilerReleaseSha: RELEASE_SHA,
      env: { SETFARM_V3_ACTIVATION: "enabled" },
      activationPreflight: PASS_PREFLIGHT,
      releaseAdmission,
    });
    const run = (id: string, runNumber: number, steps: Parameters<typeof persistWorkflowRun>[1]["steps"]) =>
      database.sql.begin((sql) => persistWorkflowRun(sql, {
        run: {
          id,
          runNumber,
          workflowId: "feature-dev",
          task,
          context: "{}",
          notifyUrl: null,
          createdAt: new Date().toISOString(),
          protocol,
        },
        steps,
      }));
    const duplicateStep = {
      id: "v3-canary-duplicate-step",
      stepId: "plan",
      agentId: "feature-dev_planner",
      stepIndex: 0,
      inputTemplate: "task",
      expects: "plan",
      status: "pending",
      maxRetries: 1,
      type: "single",
      loopConfig: null,
    };
    await assert.rejects(run("v3-canary-rolled-back", 302, [duplicateStep, duplicateStep]));
    const afterRollback = await database.sql<Array<{ run_id: string | null }>>`
      SELECT run_id FROM v3_canary_admission_claims
       WHERE slot_hash = ${created.contexts[0]!.slotHash}
    `;
    assert.equal(afterRollback[0]?.run_id, null);

    const results = await Promise.allSettled([
      run("v3-canary-race-a", 303, []),
      run("v3-canary-race-b", 304, []),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected");
    assert.ok(
      rejected.reason instanceof RunActivationConflictError
      || /RUN_CANARY_ADMISSION_SLOT_UNAVAILABLE/.test(String(rejected.reason)),
    );
    const consumers = await database.sql<Array<{ run_id: string }>>`
      SELECT run_id FROM v3_canary_admission_claims
       WHERE slot_hash = ${created.contexts[0]!.slotHash}
    `;
    assert.equal(consumers.length, 1);
    assert.ok(["v3-canary-race-a", "v3-canary-race-b"].includes(consumers[0]!.run_id));
    await database.sql`UPDATE runs SET status = 'completed'
                        WHERE id IN ('v3-canary-race-a', 'v3-canary-race-b')`;
  });

  it("proves the kill switch and preflight cannot grant v3 without an admission", () => {
    assert.throws(
      () => resolveNewRunProtocol({
        requestedMode: "v3",
        compilerReleaseSha: RELEASE_SHA,
        env: { SETFARM_V3_ACTIVATION: "enabled" },
        activationPreflight: PASS_PREFLIGHT,
      }),
      (error: unknown) => error instanceof RunProtocolError
        && error.code === "RUN_PROTOCOL_RELEASE_ADMISSION_REQUIRED",
    );
  });

  it("journals v15 and detects a disabled immutability trigger", async () => {
    const journal = await database.sql<Array<{ name: string }>>`
      SELECT name FROM setfarm_schema_migrations WHERE version = 15
    `;
    assert.equal(journal[0]?.name, "015_v3_release_admission_ledger");
    await database.sql`ALTER TABLE v3_release_admissions
                       DISABLE TRIGGER trg_v3_release_admissions_immutable`;
    try {
      await assert.rejects(verifyContractSpineMigrations(database.sql), /trigger mismatch/);
    } finally {
      await database.sql`ALTER TABLE v3_release_admissions
                         ENABLE TRIGGER trg_v3_release_admissions_immutable`;
    }
    await database.sql`ALTER TABLE v3_canary_admission_claims
                       DROP CONSTRAINT v3_canary_claims_task_hash_check`;
    try {
      await assert.rejects(verifyContractSpineMigrations(database.sql), /constraint mismatch/);
    } finally {
      await database.sql`ALTER TABLE v3_canary_admission_claims
                         ADD CONSTRAINT v3_canary_claims_task_hash_check
                         CHECK (task_hash ~ '^[a-f0-9]{64}$')`;
    }
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });
});
