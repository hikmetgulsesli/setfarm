import assert from "node:assert/strict";
import { describe, it } from "node:test";
import postgres from "postgres";

import { computeContractSpineMigrationChecksumV1 } from "../../src/db/contract-spine-migration-checksum.js";
import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "../../src/db/contract-spine-migration-digests.generated.js";
import {
  applyContractSpineMigrations,
  auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData,
  ContractSpineMigrationError,
  contractSpineMigrationLockKey,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackV3StoryClaimRuntimeBindingToV28,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_STATEMENTS,
  applyRuntimeCompletionManifestAuthorityV1,
  auditRuntimeCompletionManifestAuthorityV1Data,
  detectRuntimeCompletionManifestAuthorityV1,
} from "../../src/db/runtime-completion-manifest-authority-migration.js";
import {
  createRuntimeCompletionPlanV1,
  createSingleEffectCompletionPlanDescriptorV1,
  type RuntimeCompletionPlanV1,
} from "../../src/execution/schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const ADVISORY_WAIT_TIMEOUT_MS = 20_000;

async function rollbackEmptyV29ToV28(
  sql: TestDatabase["sql"],
): Promise<void> {
  await rollbackV3StoryClaimRuntimeBindingToV28(sql, {
    targetReleaseSha: "9".repeat(40),
  });
}

async function applyHistoricalRuntimeCompletionManifestAuthorityV28(
  sql: TestDatabase["sql"],
  options: Readonly<{
    releaseSha: string;
    lockTimeoutMs: number;
    statementTimeoutMs: number;
  }>,
): Promise<void> {
  const migration = Object.freeze({
    version: 28,
    name: "028_runtime_completion_manifest_authority",
    statements: RUNTIME_COMPLETION_MANIFEST_AUTHORITY_V1_STATEMENTS,
    implementationDigest: CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[28],
  });
  const migrationChecksum = computeContractSpineMigrationChecksumV1(migration);
  await sql.begin(async (transaction) => {
    await transaction.unsafe("SELECT set_config('lock_timeout', $1, true)", [
      `${options.lockTimeoutMs}ms`,
    ]);
    await transaction.unsafe("SELECT set_config('statement_timeout', $1, true)", [
      `${options.statementTimeoutMs}ms`,
    ]);
    await transaction.unsafe("SELECT set_config('search_path', 'public', true)");
    await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [
      contractSpineMigrationLockKey,
    ]);
    await transaction.unsafe(
      "LOCK TABLE public.setfarm_schema_migrations IN SHARE ROW EXCLUSIVE MODE",
    );
    const heads = await transaction.unsafe<Array<{ head: number }>>(
      "SELECT MAX(version)::integer AS head FROM public.setfarm_schema_migrations",
    );
    assert.equal(heads[0]?.head, 27);
    assert.equal(
      await applyRuntimeCompletionManifestAuthorityV1(transaction),
      "created",
    );
    await transaction.unsafe(
      `INSERT INTO public.setfarm_schema_migrations (
         version, name, checksum, state, release_sha
       ) VALUES (28, $1, $2, 'applied', $3)`,
      [migration.name, migrationChecksum, options.releaseSha],
    );
    await transaction.unsafe(
      `UPDATE public.setfarm_schema_migrations
          SET verified_release_sha = $1,
              verified_at = NOW()
        WHERE version <= 28`,
      [options.releaseSha],
    );
  });
}

type Fixture = Readonly<{
  requestId: string;
  claimId: number;
  runId: string;
  stepDbId: string;
  outputHash: string;
}>;

async function seedExecutingRequest(database: TestDatabase, suffix: string): Promise<Fixture> {
  const runId = `v28-manifest-${suffix}`;
  const stepDbId = `${runId}-step`;
  const sessionId = `RTS_${runId}-session`;
  const requestId = `RCR_${runId}-request`;
  const outputHash = hashCanonicalJson(`completion-${suffix}`);
  await database.insertRun(runId);
  await database.sql`
    INSERT INTO steps (
      id, run_id, step_id, agent_id, step_index, input_template, expects, status
    ) VALUES (
      ${stepDbId}, ${runId}, 'verify', 'feature-dev_reviewer', 1, '', '', 'running'
    )
  `;
  const claims = await database.sql<Array<{ id: number }>>`
    INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
    VALUES (${runId}, 'verify', NULL, 'feature-dev_reviewer')
    RETURNING id::integer AS id
  `;
  const claimId = claims[0]!.id;
  await database.sql`
    INSERT INTO runtime_sessions (
      session_id, run_id, step_db_id, workflow_step_id, claim_id,
      claim_agent_id, runtime_agent_id, runtime_kind, state,
      owner_instance_id, heartbeat_at, drained_at, drain_evidence
    ) VALUES (
      ${sessionId}, ${runId}, ${stepDbId}, 'verify', ${claimId},
      'feature-dev_reviewer', 'flux', 'openclaw_session', 'drained',
      'v28-test-owner', NOW(), NOW(), ${{ source: "v28-test" }}::jsonb
    )
  `;
  await database.sql`
    INSERT INTO runtime_completion_requests (
      request_id, runtime_session_id, claim_id, run_id, step_db_id,
      workflow_step_id, claim_envelope, output, output_hash, apply_phase,
      state, requested_by, owner_instance_id, lease_expires_at,
      requested_at, drained_at, processing_at, result
    ) VALUES (
      ${requestId}, ${sessionId}, ${claimId}, ${runId}, ${stepDbId},
      'verify', ${{ protocol: "shadow" }}::jsonb, ${`STATUS: done\nSUFFIX: ${suffix}`},
      ${outputHash}, 'executing', 'processing', 'v28-test', 'v28-test-owner',
      NOW() + INTERVAL '5 minutes', NOW(), NOW(), NOW(), '{}'::jsonb
    )
  `;
  return Object.freeze({ requestId, claimId, runId, stepDbId, outputHash });
}

function preparedPlan(fixture: Fixture, preparedAt: Date) {
  return createRuntimeCompletionPlanV1({
    requestId: fixture.requestId,
    claimId: fixture.claimId,
    runId: fixture.runId,
    stepDbId: fixture.stepDbId,
    workflowStepId: "verify",
    outputHash: fixture.outputHash,
    descriptor: createSingleEffectCompletionPlanDescriptorV1({
      kind: "single_completion",
      continuation: { type: "single_pipeline_advance", targetStepId: "final-test" },
      effectType: "single.pipeline.advance",
      effectPayload: { stepId: "verify" },
    }),
    preparedAt,
  });
}

function effectInput(plan: RuntimeCompletionPlanV1, planHash: string) {
  const spec = plan.effects[0]!;
  const payload = {
    schema: "setfarm.runtime-completion-effect-input.v1" as const,
    planHash,
    plan,
    effect: spec.payload,
  };
  return Object.freeze({ spec, payload, inputHash: hashCanonicalJson(payload) });
}

async function publishPlan(
  database: TestDatabase,
  fixture: Fixture,
): Promise<Readonly<{ plan: RuntimeCompletionPlanV1; planHash: string }>> {
  const preparedAt = new Date("2026-08-12T12:00:00.000Z");
  const prepared = preparedPlan(fixture, preparedAt);
  const effect = effectInput(prepared.plan, prepared.planHash);
  await database.sql.begin(async (transaction) => {
    await transaction.unsafe(
      `UPDATE runtime_completion_requests
          SET apply_phase = 'owner_committed',
              claim_outcome = 'completed',
              claim_committed_at = $2,
              completion_plan = $3::text::jsonb,
              completion_plan_hash = $4,
              prepared_at = $2,
              updated_at = $2
        WHERE request_id = $1`,
      [fixture.requestId, preparedAt, JSON.stringify(prepared.plan), prepared.planHash],
    );
    await transaction.unsafe(
      `INSERT INTO runtime_completion_effects (
         request_id, effect_key, ordinal, effect_type, input_hash,
         payload, mandatory, state, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, 'pending', $8, $8)`,
      [
        fixture.requestId,
        effect.spec.effectKey,
        effect.spec.ordinal,
        effect.spec.effectType,
        effect.inputHash,
        JSON.stringify(effect.payload),
        effect.spec.mandatory,
        preparedAt,
      ],
    );
  });
  return prepared;
}

function isolatedClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
    onnotice: () => {},
  });
}

async function waitForAdvisoryWaiter(
  observer: TestDatabase["sql"],
  blockedPid: number,
): Promise<void> {
  const expiresAt = Date.now() + ADVISORY_WAIT_TIMEOUT_MS;
  while (Date.now() < expiresAt) {
    const rows = await observer.unsafe<Array<{
      blocked: boolean;
      wait_event_type: string | null;
    }>>(
      `SELECT COALESCE(array_length(pg_blocking_pids($1::integer), 1), 0) > 0 AS blocked,
              wait_event_type
         FROM pg_stat_activity
        WHERE pid = $1::integer`,
      [blockedPid],
    );
    if (rows[0]?.blocked === true && rows[0].wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`ADVISORY_LOCK_WAITER_NOT_OBSERVED:${blockedPid}`);
}

async function assertMigrationLockAvailable(sql: TestDatabase["sql"]): Promise<void> {
  const reserved = await sql.reserve();
  try {
    const rows = await reserved.unsafe<Array<{ acquired: boolean }>>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [contractSpineMigrationLockKey],
    );
    assert.equal(rows[0]?.acquired, true);
    const released = await reserved.unsafe<Array<{ released: boolean }>>(
      "SELECT pg_advisory_unlock($1) AS released",
      [contractSpineMigrationLockKey],
    );
    assert.equal(released[0]?.released, true);
  } finally {
    reserved.release();
  }
}

describe("runtime completion manifest authority migration 28", () => {
  it("orders a reserved session lock before repeatable read and preserves user cancellation", async () => {
    const events: string[] = [];
    const userCancel = Object.assign(
      new Error("canceling statement due to user request"),
      { code: "57014" },
    );
    let timeoutConfigurationCount = 0;
    const reserved = {
      async unsafe(query: string): Promise<readonly unknown[]> {
        const normalized = query.replace(/\s+/gu, " ").trim();
        if (normalized.includes("set_config('lock_timeout'")) {
          timeoutConfigurationCount += 1;
          if (timeoutConfigurationCount === 1) {
            events.push("session-timeouts");
            return [];
          }
          events.push("transaction-timeouts");
          throw userCancel;
        }
        if (normalized === "ROLLBACK") {
          events.push("rollback");
          return [];
        }
        if (normalized === "SELECT pg_advisory_lock($1)") {
          events.push("session-lock");
          return [];
        }
        if (normalized === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY") {
          events.push("begin:isolation level repeatable read read only");
          return [];
        }
        if (normalized === "SELECT pg_advisory_unlock($1) AS unlocked") {
          events.push("session-unlock");
          return [{ unlocked: true }];
        }
        if (normalized === "RESET lock_timeout") {
          events.push("reset-lock-timeout");
          return [];
        }
        if (normalized === "RESET statement_timeout") {
          events.push("reset-statement-timeout");
          return [];
        }
        throw new Error(`UNEXPECTED_RESERVED_QUERY:${normalized}`);
      },
      release(): void {
        events.push("release");
      },
    };
    const sql = {
      async reserve() {
        events.push("reserve");
        return reserved;
      },
    } as unknown as Parameters<
      typeof auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData
    >[0];

    await assert.rejects(
      auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData(sql),
      (error: unknown) => error === userCancel,
    );
    assert.deepEqual(events, [
      "reserve",
      "session-timeouts",
      "session-lock",
      "begin:isolation level repeatable read read only",
      "transaction-timeouts",
      "rollback",
      "session-unlock",
      "reset-lock-timeout",
      "reset-statement-timeout",
      "release",
    ]);
  });

  it("keeps the primary failure and poisons an unsuccessfully cleaned session", async () => {
    const events: string[] = [];
    const primary = Object.assign(new Error("primary audit failure"), { code: "XX000" });
    const unlockFailure = Object.assign(new Error("unlock failed"), { code: "XX001" });
    const reserved = {
      async unsafe(query: string): Promise<readonly unknown[]> {
        const normalized = query.replace(/\s+/gu, " ").trim();
        if (normalized.includes("set_config('lock_timeout'")) return [];
        if (normalized === "SELECT pg_advisory_lock($1)") return [];
        if (normalized === "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY") {
          throw primary;
        }
        if (normalized === "SELECT pg_advisory_unlock($1) AS unlocked") {
          events.push("unlock-failed");
          throw unlockFailure;
        }
        if (normalized === "SELECT pg_terminate_backend(pg_backend_pid())") {
          events.push("terminated");
          throw new Error("CONNECTION_CLOSED");
        }
        throw new Error(`UNEXPECTED_RESERVED_QUERY:${normalized}`);
      },
      release(): void {
        events.push("released-unsafe-session");
      },
    };
    const sql = {
      async reserve() {
        return reserved;
      },
    } as unknown as Parameters<
      typeof auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData
    >[0];

    await assert.rejects(
      auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData(sql),
      (error: unknown) => error instanceof AggregateError
        && error.errors[0] === primary
        && error.errors[1] === unlockFailure
        && error.cause === primary,
    );
    assert.deepEqual(events, ["unlock-failed", "terminated"]);
  });

  it("audits the committed head after queued migration-28 rollback and apply", async () => {
    const database = await createIsolatedTestDatabase();
    const blocker = isolatedClient(database.url);
    const writer = isolatedClient(database.url);
    const auditor = isolatedClient(database.url);
    let releaseBlocker = () => {};
    let blockerTask: Promise<unknown> | undefined;
    let transitionTask: Promise<unknown> | undefined;
    let auditTask: Promise<unknown> | undefined;
    try {
      await rollbackEmptyV29ToV28(database.sql);
      const writerPid = (await writer<Array<{ pid: number }>>`
        SELECT pg_backend_pid()::integer AS pid
      `)[0]!.pid;
      const auditorPid = (await auditor<Array<{ pid: number }>>`
        SELECT pg_backend_pid()::integer AS pid
      `)[0]!.pid;

      const runTransitionAheadOfAudit = async (
        transition: () => Promise<unknown>,
        queries: string[],
      ) => {
        let announceBlocker!: () => void;
        const blockerReady = new Promise<void>((resolve) => {
          announceBlocker = resolve;
        });
        let unblock!: () => void;
        const blockerRelease = new Promise<void>((resolve) => {
          unblock = resolve;
        });
        releaseBlocker = unblock;
        blockerTask = blocker.begin(async (transaction) => {
          await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [
            contractSpineMigrationLockKey,
          ]);
          announceBlocker();
          await blockerRelease;
        });
        await blockerReady;

        transitionTask = transition();
        await Promise.race([
          waitForAdvisoryWaiter(database.sql, writerPid),
          transitionTask.then(
            () => { throw new Error("MIGRATION_TRANSITION_SETTLED_BEFORE_LOCK_WAIT"); },
            (error: unknown) => { throw error; },
          ),
        ]);
        auditTask = auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData(
          auditor,
          {
            lockTimeoutMs: 20_000,
            statementTimeoutMs: 60_000,
            onUnsafeQueryForTest: (query) => {
              queries.push(query.replace(/\s+/gu, " ").trim());
            },
          },
        );
        await Promise.race([
          waitForAdvisoryWaiter(database.sql, auditorPid),
          auditTask.then(
            () => { throw new Error("CURRENT_HEAD_AUDIT_SETTLED_BEFORE_LOCK_WAIT"); },
            (error: unknown) => { throw error; },
          ),
        ]);

        releaseBlocker();
        await blockerTask;
        await transitionTask;
        const audit = await auditTask;
        releaseBlocker = () => {};
        blockerTask = undefined;
        transitionTask = undefined;
        auditTask = undefined;
        return audit;
      };

      const rollbackQueries: string[] = [];
      const rollbackAudit = await runTransitionAheadOfAudit(
        () => rollbackRuntimeCompletionManifestAuthorityToV27(writer, {
          targetReleaseSha: "7".repeat(40),
          lockTimeoutMs: 20_000,
          statementTimeoutMs: 60_000,
        }),
        rollbackQueries,
      );
      assert.equal(
        (rollbackAudit as { status: string }).status,
        "verified",
      );
      assert.equal(
        (await database.sql<Array<{ head: number }>>`
          SELECT MAX(version)::integer AS head FROM setfarm_schema_migrations
        `)[0]?.head,
        27,
      );
      assert.equal(
        rollbackQueries.some((query) =>
          query.startsWith("LOCK TABLE public.semantic_artifacts")
          && query.includes("runtime_completion_requests")),
        false,
      );
      await assertMigrationLockAvailable(database.sql);

      const applyQueries: string[] = [];
      const applyAudit = await runTransitionAheadOfAudit(
        () => applyHistoricalRuntimeCompletionManifestAuthorityV28(writer, {
          releaseSha: "8".repeat(40),
          lockTimeoutMs: 20_000,
          statementTimeoutMs: 60_000,
        }),
        applyQueries,
      );
      assert.equal((applyAudit as { status: string }).status, "verified");
      assert.equal(
        (await database.sql<Array<{ head: number }>>`
          SELECT MAX(version)::integer AS head FROM setfarm_schema_migrations
        `)[0]?.head,
        28,
      );
      assert.equal(
        applyQueries.some((query) =>
          query.startsWith("LOCK TABLE public.semantic_artifacts")
          && query.includes("runtime_completion_requests")),
        true,
      );
      assert.equal(
        applyQueries.some((query) => query.includes("pg_advisory_xact_lock")),
        false,
      );
      await assertMigrationLockAvailable(database.sql);

      const settings = await auditor<Array<{
        advisory_locks: number;
        lock_timeout: string;
        statement_timeout: string;
      }>>`
        SELECT current_setting('lock_timeout') AS lock_timeout,
               current_setting('statement_timeout') AS statement_timeout,
               (SELECT COUNT(*)::integer
                  FROM pg_locks
                 WHERE pid = pg_backend_pid()
                   AND locktype = 'advisory') AS advisory_locks
      `;
      assert.deepEqual({ ...settings[0] }, {
        advisory_locks: 0,
        lock_timeout: "0",
        statement_timeout: "0",
      });
    } finally {
      releaseBlocker();
      await blockerTask?.catch(() => {});
      await transitionTask?.catch(() => {});
      await auditTask?.catch(() => {});
      await blocker.end({ timeout: 2 }).catch(() => {});
      await writer.end({ timeout: 2 }).catch(() => {});
      await auditor.end({ timeout: 2 }).catch(() => {});
      await database.cleanup();
    }
  });

  it("bounds the session lock and releases it after an in-transaction deadline failure", async () => {
    const database = await createIsolatedTestDatabase();
    const blocker = isolatedClient(database.url);
    const auditor = isolatedClient(database.url);
    const contender = isolatedClient(database.url);
    let releaseBlocker = () => {};
    let blockerTask: Promise<unknown> | undefined;
    try {
      let announceBlocker!: () => void;
      const blockerReady = new Promise<void>((resolve) => {
        announceBlocker = resolve;
      });
      let unblock!: () => void;
      const blockerRelease = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      releaseBlocker = unblock;
      blockerTask = blocker.begin(async (transaction) => {
        await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [
          contractSpineMigrationLockKey,
        ]);
        announceBlocker();
        await blockerRelease;
      });
      await blockerReady;
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData(auditor, {
          lockTimeoutMs: 50,
          statementTimeoutMs: 500,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT"
          && error.cause instanceof Error
          && "code" in error.cause
          && error.cause.code === "55P03",
      );
      releaseBlocker();
      await blockerTask;
      releaseBlocker = () => {};
      blockerTask = undefined;

      let deadlineExpired = false;
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtCurrentHeadData(auditor, {
          lockTimeoutMs: 500,
          statementTimeoutMs: 1_000,
          monotonicNowForTest: () => deadlineExpired ? 2_000 : 0,
          onUnsafeQueryForTest: (query) => {
            if (query.includes("MAX(version)")) deadlineExpired = true;
          },
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT"
          && /total deadline/u.test(error.message),
      );

      const settings = await auditor<Array<{
        advisory_locks: number;
        lock_timeout: string;
        statement_timeout: string;
      }>>`
        SELECT current_setting('lock_timeout') AS lock_timeout,
               current_setting('statement_timeout') AS statement_timeout,
               (SELECT COUNT(*)::integer
                  FROM pg_locks
                 WHERE pid = pg_backend_pid()
                   AND locktype = 'advisory') AS advisory_locks
      `;
      assert.deepEqual({ ...settings[0] }, {
        advisory_locks: 0,
        lock_timeout: "0",
        statement_timeout: "0",
      });
      const available = await contender<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_lock(${contractSpineMigrationLockKey}) AS acquired
      `;
      assert.equal(available[0]?.acquired, true);
      const released = await contender<Array<{ released: boolean }>>`
        SELECT pg_advisory_unlock(${contractSpineMigrationLockKey}) AS released
      `;
      assert.equal(released[0]?.released, true);
    } finally {
      releaseBlocker();
      await blockerTask?.catch(() => {});
      await blocker.end({ timeout: 2 }).catch(() => {});
      await auditor.end({ timeout: 2 }).catch(() => {});
      await contender.end({ timeout: 2 }).catch(() => {});
      await database.cleanup();
    }
  });

  it("uses a scalar census and fixed keyset pages without returning plans in aggregate", async () => {
    const calls: Array<Readonly<{ query: string; parameters: readonly unknown[] }>> = [];
    const sql = {
      unsafe: async (query: string, parameters: readonly unknown[] = []) => {
        calls.push(Object.freeze({ query, parameters }));
        return calls.length === 1 ? [{ request_count: "0" }] : [];
      },
    } as unknown as Parameters<typeof auditRuntimeCompletionManifestAuthorityV1Data>[0];

    assert.deepEqual(await auditRuntimeCompletionManifestAuthorityV1Data(sql), {
      requestCount: 0,
      planCount: 0,
      effectCount: 0,
    });
    assert.equal(calls.length, 2);
    const censusQuery = calls[0]!.query.replace(/\s+/gu, " ").trim();
    const pageQuery = calls[1]!.query.replace(/\s+/gu, " ").trim();
    assert.equal(
      censusQuery,
      "SELECT COUNT(*)::text AS request_count FROM public.runtime_completion_requests",
    );
    assert.match(
      pageQuery,
      /WITH request_page AS \( SELECT request_id AS raw_request_id, .* WHERE request_id > \$1 ORDER BY request_id LIMIT \$2 \)/u,
    );
    assert.match(
      pageQuery,
      /CASE WHEN octet_length\(request_id\) BETWEEN 1 AND 164 THEN request_id END AS request_id/u,
    );
    assert.match(
      pageQuery,
      /CASE WHEN octet_length\(run_id\) BETWEEN 1 AND 2000 THEN run_id END AS run_id/u,
    );
    assert.match(pageQuery, /ORDER BY request\.raw_request_id$/u);
    assert.doesNotMatch(pageQuery, /\bAS completion_plan\b/iu);
    assert.doesNotMatch(pageQuery, /\bTHEN (?:request\.)?completion_plan\b/iu);
    assert.deepEqual(calls[1]!.parameters, ["", 64]);
  });

  it("audits valid manifests across more than one fixed keyset page", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixtures: Fixture[] = [];
      for (let index = 0; index < 65; index += 1) {
        fixtures.push(await seedExecutingRequest(
          database,
          `page-${index.toString().padStart(2, "0")}`,
        ));
      }
      for (const index of [0, 32, 64]) {
        await publishPlan(database, fixtures[index]!);
      }

      assert.deepEqual(
        await auditRuntimeCompletionManifestAuthorityV1Data(database.sql),
        { requestCount: 65, planCount: 3, effectCount: 3 },
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects an oversized legacy plan atomically before installing authority", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await rollbackEmptyV29ToV28(database.sql);
      await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
        targetReleaseSha: "6".repeat(40),
      });
      const fixture = await seedExecutingRequest(database, "oversized-plan");
      const preparedAt = new Date("2026-08-12T12:00:00.000Z");
      const oversized = createRuntimeCompletionPlanV1({
        requestId: fixture.requestId,
        claimId: fixture.claimId,
        runId: fixture.runId,
        stepDbId: fixture.stepDbId,
        workflowStepId: "verify",
        outputHash: fixture.outputHash,
        descriptor: createSingleEffectCompletionPlanDescriptorV1({
          kind: "single_completion",
          continuation: { type: "single_pipeline_advance", targetStepId: "final-test" },
          effectType: "single.pipeline.advance",
          effectPayload: { oversized: "x".repeat(4_000_000) },
        }),
        preparedAt,
      });
      const serializedPlan = JSON.stringify(oversized.plan);
      assert.ok(Buffer.byteLength(serializedPlan, "utf8") > 4_000_000);
      const oversizedEffect = effectInput(oversized.plan, oversized.planHash);
      await database.sql.unsafe(
        `UPDATE runtime_completion_requests
            SET apply_phase = 'owner_committed',
                claim_outcome = 'completed',
                claim_committed_at = $2,
                completion_plan = $3::text::jsonb,
                completion_plan_hash = $4,
                prepared_at = $2,
                updated_at = $2
          WHERE request_id = $1`,
        [fixture.requestId, preparedAt, serializedPlan, oversized.planHash],
      );
      await database.sql.unsafe(
        `INSERT INTO runtime_completion_effects (
           request_id, effect_key, ordinal, effect_type, input_hash,
           payload, mandatory, state, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::text::jsonb, $7, 'pending', $8, $8)`,
        [
          fixture.requestId,
          oversizedEffect.spec.effectKey,
          oversizedEffect.spec.ordinal,
          oversizedEffect.spec.effectType,
          oversizedEffect.inputHash,
          JSON.stringify(oversizedEffect.payload),
          oversizedEffect.spec.mandatory,
          preparedAt,
        ],
      );

      await assert.rejects(
        applyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH"
          && /manifest census is unsafe/u.test(error.message),
      );
      assert.equal(await detectRuntimeCompletionManifestAuthorityV1(database.sql), "absent");
      const retained = await database.sql<Array<{
        head: number;
        plan_bytes: number;
        completion_plan_hash: string;
      }>>`
        SELECT (SELECT MAX(version)::integer FROM setfarm_schema_migrations) AS head,
               octet_length(completion_plan::text)::integer AS plan_bytes,
               completion_plan_hash
          FROM runtime_completion_requests
         WHERE request_id = ${fixture.requestId}
      `;
      assert.equal(retained[0]?.head, 27);
      assert.ok((retained[0]?.plan_bytes ?? 0) > 4_000_000);
      assert.equal(retained[0]?.completion_plan_hash, oversized.planHash);
    } finally {
      await database.cleanup();
    }
  });

  it("publishes one exact manifest atomically and protects its immutable identity", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedExecutingRequest(database, "immutable");
      const prepared = await publishPlan(database, fixture);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");

      await assert.rejects(
        database.sql`
          UPDATE runtime_completion_requests
             SET completion_plan_hash = ${"f".repeat(64)}
           WHERE request_id = ${fixture.requestId}
        `,
        /RUNTIME_COMPLETION_PLAN_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql`
          UPDATE runtime_completion_requests
             SET claim_envelope = ${{ protocol: "foreign" }}::jsonb
           WHERE request_id = ${fixture.requestId}
        `,
        /RUNTIME_COMPLETION_PLAN_CONTEXT_IMMUTABLE/,
      );
      await assert.rejects(
        database.sql`
          UPDATE runtime_completion_effects
             SET input_hash = ${"e".repeat(64)}
           WHERE request_id = ${fixture.requestId}
        `,
        /RUNTIME_COMPLETION_EFFECT_IDENTITY_IMMUTABLE/,
      );
      await database.sql`
        UPDATE runtime_completion_effects
           SET result = ${{ observed: true }}::jsonb,
               evidence = ${{ source: "v28-test" }}::jsonb,
               updated_at = NOW()
         WHERE request_id = ${fixture.requestId}
      `;
      await assert.rejects(
        database.sql`DELETE FROM runtime_completion_effects WHERE request_id = ${fixture.requestId}`,
        /RUNTIME_COMPLETION_EFFECT_DELETE_FORBIDDEN/,
      );
      await assert.rejects(
        database.sql.unsafe("TRUNCATE TABLE runtime_completion_effects"),
        /RUNTIME_COMPLETION_EFFECT_TRUNCATE_FORBIDDEN/,
      );

      await database.sql.unsafe(
        "ALTER TABLE public.runtime_completion_effects ENABLE ROW LEVEL SECURITY",
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql.unsafe(
        "ALTER TABLE public.runtime_completion_effects DISABLE ROW LEVEL SECURITY",
      );

      await database.sql.unsafe(
        "GRANT UPDATE (payload) ON public.runtime_completion_effects TO PUBLIC",
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql.unsafe(
        "REVOKE UPDATE (payload) ON public.runtime_completion_effects FROM PUBLIC",
      );

      await database.sql.unsafe(`
        CREATE FUNCTION public.setfarm_v28_test_external_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        SET search_path TO pg_catalog, public
        AS $function$
        BEGIN
          RETURN NEW;
        END
        $function$;
        CREATE TRIGGER zzz_v28_test_external
        BEFORE UPDATE ON public.runtime_completion_effects
        FOR EACH ROW
        EXECUTE FUNCTION public.setfarm_v28_test_external_trigger()
      `);
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql.unsafe(`
        DROP TRIGGER zzz_v28_test_external ON public.runtime_completion_effects;
        DROP FUNCTION public.setfarm_v28_test_external_trigger()
      `);
      assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");

      const retained = await database.sql<Array<{
        completion_plan_hash: string;
        effect_count: number;
      }>>`
        SELECT request.completion_plan_hash,
               COUNT(effect.effect_key)::integer AS effect_count
          FROM runtime_completion_requests request
          JOIN runtime_completion_effects effect
            ON effect.request_id = request.request_id
         WHERE request.request_id = ${fixture.requestId}
         GROUP BY request.request_id
      `;
      assert.deepEqual({ ...retained[0] }, {
        completion_plan_hash: prepared.planHash,
        effect_count: 1,
      });
      await rollbackEmptyV29ToV28(database.sql);
      await assert.rejects(
        rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
          targetReleaseSha: "7".repeat(40),
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_INCOMPLETE",
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rejects preseed, incomplete, foreign, and noncanonical manifests before commit", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      const fixture = await seedExecutingRequest(database, "rejections");
      const preparedAt = new Date("2026-08-12T12:00:00.000Z");
      const prepared = preparedPlan(fixture, preparedAt);
      const exactEffect = effectInput(prepared.plan, prepared.planHash);
      await assert.rejects(
        database.sql`
          INSERT INTO runtime_completion_effects (
            request_id, effect_key, ordinal, effect_type, input_hash,
            payload, mandatory, state
          ) VALUES (
            ${fixture.requestId}, ${exactEffect.spec.effectKey}, 0,
            ${exactEffect.spec.effectType}, ${exactEffect.inputHash},
            ${database.sql.json(exactEffect.payload)}, TRUE, 'pending'
          )
        `,
        /RUNTIME_COMPLETION_EFFECT_PARENT_BINDING_INVALID/,
      );

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(
            `UPDATE runtime_completion_requests
                SET apply_phase = 'owner_committed', claim_outcome = 'completed',
                    claim_committed_at = $2, completion_plan = $3::text::jsonb,
                    completion_plan_hash = $4, prepared_at = $2
              WHERE request_id = $1`,
            [fixture.requestId, preparedAt, JSON.stringify(prepared.plan), prepared.planHash],
          );
        }),
        /RUNTIME_COMPLETION_EFFECT_MANIFEST_INCOMPLETE/,
      );

      const noncanonicalPlan = {
        ...prepared.plan,
        effects: prepared.plan.effects.map((effect) => ({ ...effect, ordinal: 1 })),
      };
      await assert.rejects(
        database.sql.unsafe(
          `UPDATE runtime_completion_requests
              SET apply_phase = 'owner_committed', claim_outcome = 'completed',
                  claim_committed_at = $2, completion_plan = $3::text::jsonb,
                  completion_plan_hash = $4, prepared_at = $2
            WHERE request_id = $1`,
          [
            fixture.requestId,
            preparedAt,
            JSON.stringify(noncanonicalPlan),
            hashCanonicalJson(noncanonicalPlan),
          ],
        ),
        /RUNTIME_COMPLETION_PLAN_BINDING_INVALID/,
      );

      await assert.rejects(
        database.sql.begin(async (transaction) => {
          await transaction.unsafe(
            `UPDATE runtime_completion_requests
                SET apply_phase = 'owner_committed', claim_outcome = 'completed',
                    claim_committed_at = $2, completion_plan = $3::text::jsonb,
                    completion_plan_hash = $4, prepared_at = $2
              WHERE request_id = $1`,
            [fixture.requestId, preparedAt, JSON.stringify(prepared.plan), prepared.planHash],
          );
          await transaction.unsafe(
            `INSERT INTO runtime_completion_effects (
               request_id, effect_key, ordinal, effect_type, input_hash,
               payload, mandatory, state
             ) VALUES ($1, $2, 0, $3, $4, $5::text::jsonb, TRUE, 'pending')`,
            [
              fixture.requestId,
              exactEffect.spec.effectKey,
              exactEffect.spec.effectType,
              exactEffect.inputHash,
              JSON.stringify({ ...exactEffect.payload, planHash: "0".repeat(64) }),
            ],
          );
        }),
        /RUNTIME_COMPLETION_EFFECT_PARENT_BINDING_INVALID/,
      );
    } finally {
      await database.cleanup();
    }
  });

  it("rolls an empty authority back to the exact migration-27 head", async () => {
    const database = await createIsolatedTestDatabase();
    try {
      await rollbackEmptyV29ToV28(database.sql);
      const result = await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
        targetReleaseSha: "8".repeat(40),
      });
      assert.equal(result.fromVersion, 28);
      assert.equal(result.targetVersion, 27);
      const versions = await database.sql<Array<{ version: number }>>`
        SELECT version FROM setfarm_schema_migrations ORDER BY version
      `;
      assert.equal(versions.at(-1)?.version, 27);
    } finally {
      await database.cleanup();
    }
  });
});
