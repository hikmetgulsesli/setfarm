import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditCurrentArtifactPublicationAuthorityLedgerAtV28Data,
  auditCurrentContractSpineAuthorityLedgersAtV28Data,
  auditCurrentContractSpineAuthorityLedgersAtV31Data,
  auditCurrentPlatformReleaseStoreRecordLedgerAtV28Data,
  contractSpineMigrationLockKey,
  planContractSpineMigrations,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackV3StoryClaimRuntimeBindingToV28,
  throwPlatformReleaseStoreRecordLedgerV3RollbackFailureForTest,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS,
} from "../../src/db/operational-failure-cause-authority-v3-migration.js";
import {
  PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS,
  applyPlatformReleaseStoreRecordLedgerV3,
} from "../../src/db/platform-release-store-record-ledger-v3-migration.js";
import {
  createIsolatedTestDatabase,
  type TestDatabase,
} from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const TARGET_RELEASE_SHA = "b".repeat(40);
const LEDGER_ADOPTION_FENCE_TIMEOUT_MILLISECONDS = 20_000;
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function runMigrationCli(databaseUrl: string, ...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/contract-spine-migrate.ts",
      ...args,
      "--database",
      databaseUrl,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
}

function quoteIdentifier(value: string): string {
  assert.match(value, /^[A-Za-z_][A-Za-z0-9_]*$/u);
  return `"${value}"`;
}

const REMAINING_PRODUCTION_BLOCKERS = [
  "production_store_bootstrap_absent",
  "authenticated_content_lease_absent",
  "authenticated_attestation_lease_absent",
  "authenticated_global_census_absent",
  "production_publisher_preflight_absent",
  "atomic_conditional_unlink_absent",
  "crash_replay_ledger_absent",
  "whole_content_root_atomic_rename_absent",
  "authenticated_restart_rejoin_absent",
  "canonical_release_payload_layout_absent",
  "b5d_composer_bridge_absent",
  "runtime_payload_unbound",
  "fresh_production_verifier_absent",
] as const;

async function insertValidGenesisRecord(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<void> {
  const recordHash = "0".repeat(64);
  const hostIdentityHash = "1".repeat(64);
  const manifestPayloadHash = "2".repeat(64);
  const attestationHash = "3".repeat(64);
  const candidateHash = "4".repeat(64);
  const preflightHash = "5".repeat(64);
  const leafReceiptHash = "6".repeat(64);
  const publishedCensusHash = "7".repeat(64);
  const payload = {
    schema: "setfarm.platform-release-content-store-durable-record-test.v3",
    version: "3.0.0",
    admissionScope: "test_fixture",
    authorityState: "durable_database_record_test_fixture_unverified",
    productionAuthority: false,
    productionAdmission: "forbidden",
    credentialUse: "none",
    signingAuthority: "unsigned_test_fixture",
    mutationAuthority: false,
    storeAuthority: false,
    restartAuthority: false,
    preparedPlatformReleaseIssued: false,
    serializedValueAuthority: false,
    trustConclusion: "characterization_only",
    persistenceScope: "exact_database_occurrence_required",
    closedProductionBlocker: "durable_release_store_records_absent",
    remainingProductionBlockers: REMAINING_PRODUCTION_BLOCKERS,
    recordOrdinal: 0,
    priorRecordHash: null,
    preflight: {
      productionAuthority: false,
      productionAdmission: "forbidden",
      mutationAuthority: false,
      candidateFinalCensus: { hostIdentityHash },
      candidate: {
        manifestPayloadHash,
        attestationHash,
        releaseContentHash: manifestPayloadHash,
        candidateHash,
        manifestByteLength: 1,
        attestationByteLength: 1,
      },
      preflightHash,
      expectedFinalCensusHash: publishedCensusHash,
    },
    leafReceipt: {
      productionAuthority: false,
      productionAdmission: "forbidden",
      mutationAuthority: false,
      publishedCensus: { hostIdentityHash },
      leaf: {
        manifestPayloadHash,
        attestationHash,
        releaseContentHash: manifestPayloadHash,
        candidateHash,
        manifestByteLength: 1,
        attestationByteLength: 1,
      },
      preflightHash,
      receiptHash: leafReceiptHash,
      publishedCensusHash,
      publication: "published",
    },
    recordHash,
  };
  await sql.unsafe(
    `INSERT INTO public.platform_release_store_records_v3 (
       record_hash, record_schema, record_version, admission_scope,
       production_authority, production_admission, record_ordinal,
       prior_record_hash, host_identity_hash, manifest_payload_hash,
       attestation_hash, release_content_hash, candidate_hash,
       preflight_hash, leaf_receipt_hash, published_census_hash,
       manifest_byte_length, attestation_byte_length, publication,
       record_payload
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::text::jsonb
     )`,
    [
      recordHash,
      payload.schema,
      payload.version,
      payload.admissionScope,
      payload.productionAuthority,
      payload.productionAdmission,
      payload.recordOrdinal,
      payload.priorRecordHash,
      hostIdentityHash,
      manifestPayloadHash,
      attestationHash,
      manifestPayloadHash,
      candidateHash,
      preflightHash,
      leafReceiptHash,
      publishedCensusHash,
      1,
      1,
      "published",
      JSON.stringify(payload),
    ],
  );
}

type LedgerAdoptionFenceEvidence = Readonly<{
  adopterWaiting: boolean;
  journalCount: number;
  waitEvent: string | null;
  waitEventType: string | null;
  writerBlocksAdopter: boolean;
  writerHoldsRowExclusive: boolean;
}>;

async function waitForLedgerAdoptionFence(
  sql: postgres.Sql,
  input: Readonly<{ adopterPid: number; writerPid: number }>,
): Promise<LedgerAdoptionFenceEvidence> {
  const deadline = Date.now() + LEDGER_ADOPTION_FENCE_TIMEOUT_MILLISECONDS;
  let lastEvidence: LedgerAdoptionFenceEvidence | undefined;
  do {
    const rows = await sql.unsafe<Array<{
      adopter_waiting: boolean;
      journal_count: number;
      wait_event: string | null;
      wait_event_type: string | null;
      writer_blocks_adopter: boolean;
      writer_holds_row_exclusive: boolean;
    }>>(
      `SELECT
         EXISTS (
           SELECT 1
             FROM pg_locks
            WHERE pid = $1::integer
              AND relation = 'public.platform_release_store_records_v3'::regclass
              AND mode = 'AccessExclusiveLock'
              AND NOT granted
         ) AS adopter_waiting,
         (SELECT COUNT(*)::integer
            FROM public.setfarm_schema_migrations
           WHERE version = 27) AS journal_count,
         (SELECT wait_event
            FROM pg_stat_activity
           WHERE pid = $1::integer) AS wait_event,
         (SELECT wait_event_type
            FROM pg_stat_activity
           WHERE pid = $1::integer) AS wait_event_type,
         $2::integer = ANY(pg_blocking_pids($1::integer)) AS writer_blocks_adopter,
         EXISTS (
           SELECT 1
             FROM pg_locks
            WHERE pid = $2::integer
              AND relation = 'public.platform_release_store_records_v3'::regclass
              AND mode = 'RowExclusiveLock'
              AND granted
         ) AS writer_holds_row_exclusive`,
      [input.adopterPid, input.writerPid],
    );
    const row = rows[0];
    lastEvidence = Object.freeze({
      adopterWaiting: row?.adopter_waiting === true,
      journalCount: row?.journal_count ?? -1,
      waitEvent: row?.wait_event ?? null,
      waitEventType: row?.wait_event_type ?? null,
      writerBlocksAdopter: row?.writer_blocks_adopter === true,
      writerHoldsRowExclusive: row?.writer_holds_row_exclusive === true,
    });
    if (
      lastEvidence.adopterWaiting
      && lastEvidence.journalCount === 0
      && lastEvidence.waitEventType === "Lock"
      && lastEvidence.writerBlocksAdopter
      && lastEvidence.writerHoldsRowExclusive
    ) {
      return lastEvidence;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  } while (Date.now() < deadline);
  throw new Error(
    `LEDGER_ADOPTION_FENCE_NOT_OBSERVED: ${JSON.stringify(lastEvidence ?? null)}`,
  );
}

describe("platform release-store record ledger v3 contract integration", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  it("keeps v27 audit nesting and rollback timeout classification exact", () => {
    const source = readFileSync(
      path.join(REPO_ROOT, "src/db/contract-spine-migrations.ts"),
      "utf8",
    );
    const auditRegion = source.slice(
      source.indexOf(
        "// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v27-current-authority-audit:BEGIN",
      ),
      source.indexOf(
        "// SETFARM_SEMANTIC_MIGRATION_REGION:migration-v27-current-authority-audit:END",
      ),
    );
    assert.equal(auditRegion.match(/sql\.begin\(/gu)?.length, 1);
    assert.match(auditRegion, /new Proxy\(transaction/u);
    assert.match(auditRegion, /boundedCurrentAuthorityAuditResult/u);
    assert.match(auditRegion, /result access/u);
    assert.match(auditRegion, /property !== "unsafe"/u);
    assert.match(auditRegion, /set_config\('statement_timeout'/u);
    assert.doesNotMatch(
      auditRegion,
      /await auditCurrentArtifactPublicationAuthorityLedgerData\(/u,
    );

    const lockTimeout = Object.assign(new Error("simulated lock timeout"), {
      code: "55P03",
    });
    assert.throws(
      () => throwPlatformReleaseStoreRecordLedgerV3RollbackFailureForTest(
        lockTimeout,
      ),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_LOCK_TIMEOUT"
        && error.message === "Migration 27 rollback exceeded its bounded database timeout"
        && error.cause === lockTimeout,
    );
    const statementTimeout = Object.assign(
      new Error("canceling statement due to statement timeout"),
      { code: "57014" },
    );
    assert.throws(
      () => throwPlatformReleaseStoreRecordLedgerV3RollbackFailureForTest(
        statementTimeout,
      ),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_LOCK_TIMEOUT"
        && error.message === "Migration 27 rollback exceeded its bounded database timeout"
        && error.cause === statementTimeout,
    );
    const userCancel = Object.assign(
      new Error("canceling statement due to user request"),
      { code: "57014" },
    );
    assert.throws(
      () => throwPlatformReleaseStoreRecordLedgerV3RollbackFailureForTest(
        userCancel,
      ),
      (error: unknown) => error === userCancel,
    );
  });

  it("preserves configured v27 domain errors without relabeling SQL failures", async () => {
    const operationalFailure = Object.assign(new Error("simulated SQL failure"), {
      code: "XX000",
    });
    const operationalSql = {
      async unsafe(query: string): Promise<readonly unknown[]> {
        const normalized = query.replace(/\s+/gu, " ").trim();
        if (normalized.startsWith("SELECT pg_advisory_xact_lock")) return [];
        if (normalized.startsWith("SELECT to_regclass")) return [{ relation: null }];
        if (normalized.includes("FROM pg_proc")) return [{ count: 0 }];
        if (normalized.includes("FROM pg_trigger")) return [{ count: 0 }];
        if (normalized.startsWith("CREATE TABLE")) throw operationalFailure;
        throw new Error(`UNEXPECTED_OPERATIONAL_SQL:${normalized}`);
      },
    } as unknown as postgres.TransactionSql;
    await assert.rejects(
      applyPlatformReleaseStoreRecordLedgerV3(operationalSql),
      (error: unknown) => error === operationalFailure
        && !(error instanceof ContractSpineMigrationError),
    );

    let relationDetectionCount = 0;
    const issuedDomainSql = {
      async unsafe(query: string): Promise<readonly unknown[]> {
        const normalized = query.replace(/\s+/gu, " ").trim();
        if (normalized.startsWith("SELECT pg_advisory_xact_lock")) return [];
        if (normalized.startsWith("SELECT to_regclass")) {
          relationDetectionCount += 1;
          return [{
            relation: relationDetectionCount === 1
              ? null
              : "public.platform_release_store_records_v3",
          }];
        }
        if (normalized.includes("FROM pg_proc")) return [{ count: 0 }];
        if (normalized.includes("FROM pg_trigger")) return [{ count: 0 }];
        if (normalized.startsWith("CREATE ") || normalized.startsWith("REVOKE ")) {
          return [];
        }
        throw new Error(`UNEXPECTED_DOMAIN_SQL:${normalized}`);
      },
    } as unknown as postgres.TransactionSql;
    await assert.rejects(
      applyPlatformReleaseStoreRecordLedgerV3(issuedDomainSql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH"
        && /installation did not create one exact object set/u.test(error.message),
    );
  });

  it("fences an uncommitted valid insert before the locked empty-adoption recheck", async () => {
    const raceDatabase = await createIsolatedTestDatabase({ migrate: false });
    const writer = postgres(raceDatabase.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 30,
      onnotice: () => {},
    });
    const adopter = postgres(raceDatabase.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 30,
      onnotice: () => {},
    });
    let releaseWriter!: () => void;
    const writerRelease = new Promise<void>((resolve) => {
      releaseWriter = resolve;
    });
    let announceWriter!: (pid: number) => void;
    let rejectWriter!: (error: unknown) => void;
    const writerReady = new Promise<number>((resolve, reject) => {
      announceWriter = resolve;
      rejectWriter = reject;
    });
    let writerTransaction: Promise<unknown> | undefined;
    try {
      await applyContractSpineMigrations(raceDatabase.sql, {
        releaseSha: RELEASE_SHA,
      });
      await raceDatabase.sql`DELETE FROM setfarm_schema_migrations WHERE version = 27`;

      writerTransaction = writer.begin(async (transaction) => {
        try {
          await insertValidGenesisRecord(transaction);
          const pidRows = await transaction<Array<{ pid: number }>>`
            SELECT pg_backend_pid()::integer AS pid
          `;
          announceWriter(pidRows[0]!.pid);
          await writerRelease;
        } catch (error) {
          rejectWriter(error);
          throw error;
        }
      });
      const writerPid = await writerReady;
      const adopterPidRows = await adopter<Array<{ pid: number }>>`
        SELECT pg_backend_pid()::integer AS pid
      `;
      const adopterPid = adopterPidRows[0]!.pid;

      const adoption = applyContractSpineMigrations(adopter, {
        releaseSha: RELEASE_SHA,
        lockTimeoutMs: 30_000,
        statementTimeoutMs: 60_000,
      }).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (error: unknown) => ({ status: "rejected" as const, error }),
      );
      const fence = await Promise.race([
        waitForLedgerAdoptionFence(raceDatabase.sql, { adopterPid, writerPid }),
        adoption.then((settled) => {
          throw new Error(
            `LEDGER_ADOPTION_SETTLED_BEFORE_FENCE: ${settled.status}`,
          );
        }),
      ]);
      assert.deepEqual(fence, {
        adopterWaiting: true,
        journalCount: 0,
        waitEvent: "relation",
        waitEventType: "Lock",
        writerBlocksAdopter: true,
        writerHoldsRowExclusive: true,
      });

      // Without the fenced adopter, COUNT(*) sees zero while this INSERT is
      // uncommitted, then the row commits after the count and is mis-adopted.
      releaseWriter();
      await writerTransaction;
      const result = await adoption;
      assert.equal(result.status, "rejected");
      if (result.status === "rejected") {
        assert.equal(result.error instanceof ContractSpineMigrationError, true);
        assert.equal(
          (result.error as ContractSpineMigrationError).code,
          "MIGRATION_ADOPTION_MISMATCH",
        );
      }
      const rows = await raceDatabase.sql<Array<{ records: number; journal: number }>>`
        SELECT
          (SELECT COUNT(*)::integer
             FROM public.platform_release_store_records_v3) AS records,
          (SELECT COUNT(*)::integer
             FROM public.setfarm_schema_migrations
            WHERE version = 27) AS journal
      `;
      assert.deepEqual(rows[0], { records: 1, journal: 0 });
    } finally {
      releaseWriter();
      await writerTransaction?.catch(() => {});
      await writer.end({ timeout: 2 }).catch(() => {});
      await adopter.end({ timeout: 2 }).catch(() => {});
      await raceDatabase.cleanup();
    }
  });

  it("installs exact PostgreSQL objects, audits false authority, and rolls an empty v27 back", async () => {
    const applied = await applyContractSpineMigrations(database.sql, {
      releaseSha: RELEASE_SHA,
    });
    assert.equal(
      applied.applied.includes("027_platform_release_store_record_ledger_v3"),
      true,
    );
    assert.equal(
      (await verifyContractSpineMigrations(database.sql)).status,
      "verified",
    );
    const currentHeadCliResult = runMigrationCli(
      database.url,
      "audit-current-authority-ledgers",
    );
    assert.equal(currentHeadCliResult.status, 0, currentHeadCliResult.stderr);
    const currentHeadCliAudit = JSON.parse(currentHeadCliResult.stdout) as Record<
      string,
      unknown
    >;
    assert.equal(
      currentHeadCliAudit.schema,
      "setfarm.contract-spine-current-authority-ledgers-audit.v2",
    );
    assert.deepEqual(currentHeadCliAudit.v3StoryClaimRuntimeBinding, {
      schema: "setfarm.v3-story-claim-runtime-binding-current-audit.v1",
      scope: "database-binding-integrity-only",
      status: "integrity_verified",
      authorityState: "database_binding_integrity_audit_only",
      productionAuthority: false,
      productionAdmission: "forbidden",
      mutationAuthority: false,
      bindingCount: 0,
      requiredOwnerCount: 0,
    });

    let monotonicMilliseconds = 0;
    const deadlineQueries: string[] = [];
    await assert.rejects(
      auditCurrentContractSpineAuthorityLedgersAtV31Data(database.sql, {
        lockTimeoutMs: 1,
        statementTimeoutMs: 50,
        monotonicNowForTest: () => monotonicMilliseconds,
        onUnsafeQueryForTest: (query) => {
          const normalized = query.replace(/\s+/gu, " ").trim();
          deadlineQueries.push(normalized);
          if (normalized.includes("FROM pg_constraint")) {
            monotonicMilliseconds = 100;
          }
        },
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_LOCK_TIMEOUT"
        && /total deadline/u.test(error.message),
    );
    assert.equal(deadlineQueries.length <= 32, true);
    assert.equal(
      deadlineQueries.some((query) => query.includes("FROM pg_class c")),
      false,
    );
    assert.equal(
      deadlineQueries.some((query) => query.includes("information_schema.columns")),
      false,
    );
    assert.equal(
      deadlineQueries.some((query) => query.includes("FROM pg_constraint")),
      true,
    );
    assert.equal(
      deadlineQueries.some((query) => query.includes("FROM pg_index")),
      false,
    );
    let headResultReached = false;
    let headResultClockReads = 0;
    const resultAccessQueries: string[] = [];
    await assert.rejects(
      auditCurrentContractSpineAuthorityLedgersAtV31Data(database.sql, {
        lockTimeoutMs: 1,
        statementTimeoutMs: 50,
        monotonicNowForTest: () => {
          if (!headResultReached) return 0;
          headResultClockReads += 1;
          return headResultClockReads >= 8 ? 100 : 0;
        },
        onUnsafeQueryForTest: (query) => {
          const normalized = query.replace(/\s+/gu, " ").trim();
          resultAccessQueries.push(normalized);
          if (normalized.includes("WHERE version >= 26")) {
            headResultReached = true;
          }
        },
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_LOCK_TIMEOUT"
        && /result access/u.test(error.message),
    );
    assert.equal(headResultReached, true);
    assert.equal(
      resultAccessQueries.some((query) =>
        query.startsWith("LOCK TABLE public.semantic_artifacts")),
      false,
    );
    assert.equal(
      (await verifyContractSpineMigrations(database.sql)).status,
      "verified",
    );

    const driftConnection = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    const replaceFailureCauseConstraintWithTrue = async () => {
      await driftConnection.unsafe(
        "ALTER TABLE public.run_termination_requests DROP CONSTRAINT run_termination_requests_operational_failure_cause_check",
      );
      await driftConnection.unsafe(
        `ALTER TABLE public.run_termination_requests
           ADD CONSTRAINT run_termination_requests_operational_failure_cause_check
           CHECK (TRUE)`,
      );
    };
    const restoreFailureCauseConstraint = async () => {
      for (const statement of OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS) {
        await driftConnection.unsafe(statement);
      }
    };
    try {
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtV31Data(database.sql, {
          afterV31FailureCauseVerificationForTest:
            replaceFailureCauseConstraintWithTrue,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH"
          && /changed during audit/u.test(error.message),
      );
      await restoreFailureCauseConstraint();
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtV31Data(database.sql, {
          afterV31ReadOnlyBeginBeforeFailureCauseLockForTest:
            replaceFailureCauseConstraintWithTrue,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH"
          && /changed during audit/u.test(error.message),
      );
    } finally {
      await restoreFailureCauseConstraint();
      await driftConnection.end({ timeout: 2 });
    }
    assert.equal(
      (await verifyContractSpineMigrations(database.sql)).status,
      "verified",
    );

    await database.sql.unsafe(
      "DROP TRIGGER trg_platform_release_store_records_v3_guard ON public.platform_release_store_records_v3",
    );
    await database.sql.unsafe(`
      CREATE TRIGGER trg_platform_release_store_records_v3_guard
        BEFORE INSERT OR UPDATE OR DELETE
        ON public.platform_release_store_records_v3
        FOR EACH ROW WHEN (false)
        EXECUTE FUNCTION public.setfarm_enforce_platform_release_store_record_v3()
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 27`;
    await assert.rejects(
      applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const unadopted = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM setfarm_schema_migrations
       WHERE version = 27
    `;
    assert.equal(unadopted[0]?.count, 0);
    await database.sql.unsafe(
      "DROP TRIGGER trg_platform_release_store_records_v3_guard ON public.platform_release_store_records_v3",
    );
    await database.sql.unsafe(`
      CREATE TRIGGER trg_platform_release_store_records_v3_guard
        BEFORE INSERT OR UPDATE OR DELETE
        ON public.platform_release_store_records_v3
        FOR EACH ROW
        EXECUTE FUNCTION public.setfarm_enforce_platform_release_store_record_v3()
    `);
    const adopted = await applyContractSpineMigrations(database.sql, {
      releaseSha: RELEASE_SHA,
    });
    assert.equal(
      adopted.adopted.includes("027_platform_release_store_record_ledger_v3"),
      true,
    );
    assert.equal(
      (await verifyContractSpineMigrations(database.sql)).status,
      "verified",
    );

    const functionStatement = PLATFORM_RELEASE_STORE_RECORD_LEDGER_V3_STATEMENTS.find(
      (statement) => statement.startsWith("CREATE FUNCTION"),
    )!;
    const createOrReplaceFunction = functionStatement.replace(
      "CREATE FUNCTION",
      "CREATE OR REPLACE FUNCTION",
    );
    await database.sql.unsafe(createOrReplaceFunction.replace(
      "TG_OP = 'INSERT'",
      "TG_OP = 'insert'",
    ));
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await database.sql.unsafe(createOrReplaceFunction);

    const ownerRows = await database.sql<Array<{ owner: string }>>`
      SELECT pg_get_userbyid(relowner) AS owner
        FROM pg_class
       WHERE oid = 'public.setfarm_schema_migrations'::regclass
    `;
    const expectedOwner = ownerRows[0]!.owner;
    const hostileOwner = `setfarm_v27_owner_${database.database.slice(-12)}`;
    await database.sql.unsafe(`CREATE ROLE ${quoteIdentifier(hostileOwner)} NOLOGIN`);
    try {
      await database.sql.unsafe(
        `ALTER TABLE public.platform_release_store_records_v3 OWNER TO ${quoteIdentifier(hostileOwner)}`,
      );
      await database.sql.unsafe(
        `ALTER FUNCTION public.setfarm_enforce_platform_release_store_record_v3() OWNER TO ${quoteIdentifier(hostileOwner)}`,
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 27`;
      await assert.rejects(
        applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      const hostileAdoption = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count
          FROM setfarm_schema_migrations
         WHERE version = 27
      `;
      assert.equal(hostileAdoption[0]?.count, 0);
    } finally {
      await database.sql.unsafe(
        `ALTER TABLE public.platform_release_store_records_v3 OWNER TO ${quoteIdentifier(expectedOwner)}`,
      );
      await database.sql.unsafe(
        `ALTER FUNCTION public.setfarm_enforce_platform_release_store_record_v3() OWNER TO ${quoteIdentifier(expectedOwner)}`,
      );
      await database.sql.unsafe(`DROP ROLE ${quoteIdentifier(hostileOwner)}`);
    }
    const ownerRestored = await applyContractSpineMigrations(database.sql, {
      releaseSha: RELEASE_SHA,
    });
    assert.equal(
      ownerRestored.adopted.includes("027_platform_release_store_record_ledger_v3"),
      true,
    );

    const columnReader = `setfarm_v27_column_${database.database.slice(-12)}`;
    await database.sql.unsafe(`CREATE ROLE ${quoteIdentifier(columnReader)} NOLOGIN`);
    try {
      await database.sql.unsafe(
        "GRANT INSERT (record_hash) ON public.platform_release_store_records_v3 TO PUBLIC",
      );
      const publicColumnGrant = await database.sql.unsafe<Array<{ granted: boolean }>>(
        `SELECT has_column_privilege(
           $1,
           'public.platform_release_store_records_v3',
           'record_hash',
           'INSERT'
         ) AS granted`,
        [columnReader],
      );
      assert.equal(publicColumnGrant[0]?.granted, true);
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 27`;
      await assert.rejects(
        applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
      const columnAclAdoption = await database.sql<Array<{ count: number }>>`
        SELECT COUNT(*)::integer AS count
          FROM setfarm_schema_migrations
         WHERE version = 27
      `;
      assert.equal(columnAclAdoption[0]?.count, 0);
    } finally {
      await database.sql.unsafe(
        "REVOKE INSERT (record_hash) ON public.platform_release_store_records_v3 FROM PUBLIC",
      );
      await database.sql.unsafe(`DROP ROLE ${quoteIdentifier(columnReader)}`);
    }
    const columnAclRestored = await applyContractSpineMigrations(database.sql, {
      releaseSha: RELEASE_SHA,
    });
    assert.equal(
      columnAclRestored.adopted.includes("027_platform_release_store_record_ledger_v3"),
      true,
    );

    await database.sql.unsafe(
      "GRANT SELECT, INSERT ON public.platform_release_store_records_v3 TO PUBLIC",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await database.sql.unsafe(
      "REVOKE ALL ON public.platform_release_store_records_v3 FROM PUBLIC",
    );
    await database.sql.unsafe(
      "GRANT EXECUTE ON FUNCTION public.setfarm_enforce_platform_release_store_record_v3() TO PUBLIC",
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await database.sql.unsafe(
      "REVOKE ALL ON FUNCTION public.setfarm_enforce_platform_release_store_record_v3() FROM PUBLIC",
    );
    await rollbackOperationalFailureCauseAuthorityV3ToV30(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    await rollbackOperationalFailureCauseAuthorityV2ToV29(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    await rollbackV3StoryClaimRuntimeBindingToV28(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    await rollbackRuntimeCompletionManifestAuthorityToV27(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });

    await database.sql.unsafe(`
      CREATE TABLE public.platform_release_store_record_v3_external_ref (
        record_hash TEXT REFERENCES public.platform_release_store_records_v3(record_hash)
      )
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    await assert.rejects(
      rollbackPlatformReleaseStoreRecordLedgerV3ToV26(database.sql, {
        targetReleaseSha: TARGET_RELEASE_SHA,
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const journalAfterRejectedRollback = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM setfarm_schema_migrations
       WHERE version = 27
    `;
    assert.equal(journalAfterRejectedRollback[0]?.count, 1);
    await database.sql.unsafe(
      "DROP TABLE public.platform_release_store_record_v3_external_ref",
    );

    let announceAuditLock!: () => void;
    const auditLocked = new Promise<void>((resolve) => {
      announceAuditLock = resolve;
    });
    let releaseAuditLock!: () => void;
    const releaseAudit = new Promise<void>((resolve) => {
      releaseAuditLock = resolve;
    });
    const auditBlocker = database.sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT pg_advisory_xact_lock($1)", [
        contractSpineMigrationLockKey,
      ]);
      announceAuditLock();
      await releaseAudit;
    });
    await auditLocked;
    try {
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtV28Data(database.sql, {
          lockTimeoutMs: 50,
          statementTimeoutMs: 500,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT",
      );
      const cliAuditTimeout = runMigrationCli(
        database.url,
        "audit-platform-release-store-records",
      );
      assert.notEqual(cliAuditTimeout.status, 0);
      assert.match(cliAuditTimeout.stderr, /^MIGRATION_LOCK_TIMEOUT:/u);
      assert.doesNotMatch(cliAuditTimeout.stderr, /connect timeout/iu);
    } finally {
      releaseAuditLock();
      await auditBlocker;
    }
    const planAfterV28Rollback = await planContractSpineMigrations(database.sql);
    assert.equal(
      planAfterV28Rollback.migrations.find((item) => item.version === 27)?.state,
      "adopted",
    );
    assert.equal(
      planAfterV28Rollback.migrations.find((item) => item.version === 28)?.state,
      "pending",
    );

    const composite =
      await auditCurrentContractSpineAuthorityLedgersAtV28Data(database.sql);
    assert.equal(Object.isFrozen(composite), true);
    assert.equal(Object.isFrozen(composite.artifactPublicationAuthorityLedger), true);
    assert.equal(Object.isFrozen(composite.platformReleaseStoreRecordLedger), true);
    assert.deepEqual(
      Object.keys(composite.platformReleaseStoreRecordLedger).sort(),
      [
        "authorityState",
        "mutationAuthority",
        "productionAdmission",
        "productionAuthority",
        "recordCount",
        "restartAuthority",
        "schema",
        "scope",
        "status",
        "storeAuthority",
        "tailPublishedCensusHash",
        "tailRecordHash",
        "trustConclusion",
      ],
    );
    assert.deepEqual(Object.keys(composite).sort(), [
      "artifactPublicationAuthorityLedger",
      "authorityState",
      "mutationAuthority",
      "platformReleaseStoreRecordLedger",
      "productionAdmission",
      "productionAuthority",
      "restartAuthority",
      "schema",
      "scope",
      "status",
      "storeAuthority",
      "trustConclusion",
      "version",
    ]);
    assert.deepEqual({
      schema: composite.schema,
      version: composite.version,
      scope: composite.scope,
      status: composite.status,
      authorityState: composite.authorityState,
      productionAuthority: composite.productionAuthority,
      productionAdmission: composite.productionAdmission,
      mutationAuthority: composite.mutationAuthority,
      storeAuthority: composite.storeAuthority,
      restartAuthority: composite.restartAuthority,
      trustConclusion: composite.trustConclusion,
    }, {
      schema: "setfarm.contract-spine-current-authority-ledgers-audit.v1",
      version: "1.0.0",
      scope: "database-current-authority-ledgers-only",
      status: "verified",
      authorityState: "database_integrity_audit_only",
      productionAuthority: false,
      productionAdmission: "forbidden",
      mutationAuthority: false,
      storeAuthority: false,
      restartAuthority: false,
      trustConclusion: "characterization_only",
    });
    assert.equal(
      composite.artifactPublicationAuthorityLedger.schema,
      "setfarm.artifact-publication-authority-ledger-audit.v2",
    );
    assert.equal(composite.artifactPublicationAuthorityLedger.status, "verified");
    assert.equal(composite.artifactPublicationAuthorityLedger.batchPlanCount, 0);
    assert.deepEqual(
      await auditCurrentPlatformReleaseStoreRecordLedgerAtV28Data(database.sql),
      composite.platformReleaseStoreRecordLedger,
    );

    for (const currentHeadMode of [
      "audit-current-authority-ledgers",
      "audit-platform-release-store-records",
      "audit-artifact-publication-batches",
      "audit-artifact-store-authority-ledger",
    ]) {
      const unsupportedHistoricalHeadResult = runMigrationCli(
        database.url,
        currentHeadMode,
      );
      assert.notEqual(unsupportedHistoricalHeadResult.status, 0);
      assert.match(unsupportedHistoricalHeadResult.stderr, /^MIGRATION_INCOMPLETE:/u);
    }

    const v26Journal = await database.sql<Array<{ checksum: string }>>`
      SELECT checksum
        FROM public.setfarm_schema_migrations
       WHERE version = 26
    `;
    assert.equal(v26Journal.length, 1);
    await database.sql`
      UPDATE public.setfarm_schema_migrations
         SET checksum = ${"0".repeat(64)}
       WHERE version = 26
    `;
    try {
      await assert.rejects(
        auditCurrentContractSpineAuthorityLedgersAtV28Data(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_CHECKSUM_MISMATCH",
      );
    } finally {
      await database.sql`
        UPDATE public.setfarm_schema_migrations
           SET checksum = ${v26Journal[0]!.checksum}
         WHERE version = 26
      `;
    }

    const rollbackResult = runMigrationCli(
      database.url,
      "rollback-27-to-26",
      "--target-release",
      TARGET_RELEASE_SHA,
    );
    assert.equal(rollbackResult.status, 0, rollbackResult.stderr);
    const rollback = JSON.parse(rollbackResult.stdout) as Record<string, unknown>;
    assert.deepEqual({
      fromVersion: rollback.fromVersion,
      targetVersion: rollback.targetVersion,
      rowsRewritten: rollback.rowsRewritten,
    }, {
      fromVersion: 27,
      targetVersion: 26,
      rowsRewritten: 0,
    });
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(
      plan.migrations.find((item) => item.version === 26)?.state,
      "applied",
    );
    assert.equal(
      plan.migrations.find((item) => item.version === 27)?.state,
      "pending",
    );
    const supportedHeadArtifact =
      await auditCurrentArtifactPublicationAuthorityLedgerAtV28Data(
        database.sql,
      );
    assert.equal(
      supportedHeadArtifact.schema,
      composite.artifactPublicationAuthorityLedger.schema,
    );
    assert.equal(supportedHeadArtifact.status, "verified");
    for (const currentHeadMode of [
      "audit-artifact-publication-batches",
      "audit-artifact-store-authority-ledger",
    ]) {
      const unsupportedHistoricalHeadResult = runMigrationCli(
        database.url,
        currentHeadMode,
      );
      assert.notEqual(unsupportedHistoricalHeadResult.status, 0);
      assert.match(unsupportedHistoricalHeadResult.stderr, /^MIGRATION_INCOMPLETE:/u);
    }
    await database.sql.unsafe(
      "CREATE TABLE public.platform_release_store_records_v3 (probe INTEGER)",
    );
    try {
      await assert.rejects(
        auditCurrentArtifactPublicationAuthorityLedgerAtV28Data(
          database.sql,
        ),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH"
          && /unjournaled migration-27 objects/u.test(error.message),
      );
    } finally {
      await database.sql.unsafe(
        "DROP TABLE public.platform_release_store_records_v3",
      );
    }
    for (const v27RequiredMode of [
      "audit-current-authority-ledgers",
      "audit-platform-release-store-records",
    ]) {
      const v27RequiredResult = runMigrationCli(database.url, v27RequiredMode);
      assert.notEqual(v27RequiredResult.status, 0);
      assert.match(v27RequiredResult.stderr, /^MIGRATION_INCOMPLETE:/u);
    }
  });
});
