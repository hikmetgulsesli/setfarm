import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "../../src/db/contract-spine-migration-digests.generated.js";
import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditAuthorityV3ContractSpineThroughMigration31V1,
  auditCurrentArtifactPublicationAuthorityLedgerData,
  planContractSpineMigrations,
  rollbackArtifactPublicationBatchPlanLedgerToV25,
  rollbackPlatformReleaseStoreRecordLedgerV3ToV26,
  rollbackPreparationAuthorityV2LedgerToV24 as rollbackPreparationAuthorityV2LedgerToV24Raw,
  rollbackRuntimeCompletionManifestAuthorityToV27,
  rollbackOperationalFailureCauseAuthorityV2ToV29,
  rollbackOperationalFailureCauseAuthorityV3ToV30,
  rollbackV3StoryClaimRuntimeBindingToV28,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import {
  V3PreparationAuthorityV2RepositoryError,
  bindV3PreparationAuthorityAttemptV2InTransaction,
  bindV3PreparationAuthorityClaimV2InTransaction,
  publishV3PreparationAuthorityV2,
  publishV3PreparationAuthorityV2InTransaction,
  readV3PreparationAuthorityV2,
} from "../../src/execution/v3-preparation-authority-v2-repository.js";
import { createV3PreparationClaimAuthorityV2 } from "../../src/execution/v3-preparation-claim-authority-v2.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const RELEASE_SHA = "a".repeat(40);
const TARGET_RELEASE_SHA = "b".repeat(40);
const PACKET_HASH = "c".repeat(64);
const COMPILATION_REPORT_HASH = "d".repeat(64);
const BASE_SHA = "e".repeat(40);
const BASE_TREE = "f".repeat(40);
const SLICE_HASH = "1".repeat(64);

async function rollbackCurrentHeadToV26(sql: TestDatabase["sql"]): Promise<void> {
  await rollbackOperationalFailureCauseAuthorityV3ToV30(sql, {
    targetReleaseSha: "4".repeat(40),
  });
  await rollbackOperationalFailureCauseAuthorityV2ToV29(sql, {
    targetReleaseSha: "5".repeat(40),
  });
  await rollbackV3StoryClaimRuntimeBindingToV28(sql, {
    targetReleaseSha: "6".repeat(40),
  });
  await rollbackRuntimeCompletionManifestAuthorityToV27(sql, {
    targetReleaseSha: "7".repeat(40),
  });
  await rollbackPlatformReleaseStoreRecordLedgerV3ToV26(sql, {
    targetReleaseSha: "8".repeat(40),
  });
}

async function rollbackPreparationAuthorityV2LedgerToV24(
  sql: TestDatabase["sql"],
  options: Parameters<typeof rollbackPreparationAuthorityV2LedgerToV24Raw>[1],
) {
  await rollbackCurrentHeadToV26(sql);
  await rollbackArtifactPublicationBatchPlanLedgerToV25(sql, {
    targetReleaseSha: "9".repeat(40),
  });
  return rollbackPreparationAuthorityV2LedgerToV24Raw(sql, options);
}

function authority(runId: string, storyId = "US-001") {
  return createV3PreparationClaimAuthorityV2({
    stateVersion: 1,
    runId,
    stepId: "implement",
    storyId,
    packetHash: PACKET_HASH,
    compilationReportHash: COMPILATION_REPORT_HASH,
    baseRevision: { sha: BASE_SHA, treeHash: BASE_TREE },
    projectedDependencyIds: [],
    dependencyAttempts: [],
  });
}

async function seedRun(database: TestDatabase, suffix: string) {
  const runId = `run-preparation-v2-${suffix}`;
  const storyId = "US-001";
  await database.sql.unsafe(
    `INSERT INTO runs (
       id, workflow_id, task, status, protocol, protocol_version,
       compiler_release_sha, packet_hash, activation_preflight_hash
     ) VALUES (
       $1, 'feature-dev', 'preparation authority v2 test', 'running',
       'shadow', 1, $2, $3, $4
     )`,
    [runId, RELEASE_SHA, PACKET_HASH, "2".repeat(64)],
  );
  await database.sql.unsafe(
    `INSERT INTO semantic_artifacts (
       artifact_hash, artifact_type, byte_length, producer_metadata
     ) VALUES ($1, 'setfarm.product-build-packet.v3', 1, $2::text::jsonb)
     ON CONFLICT (artifact_hash) DO NOTHING`,
    [PACKET_HASH, JSON.stringify({
      pass: "preparation-authority-v2-test",
      codeSha: RELEASE_SHA,
      toolVersions: { setfarm: "test" },
    })],
  );
  await database.sql.unsafe(
    `INSERT INTO product_packets (run_id, packet_hash, compiler_metadata)
     VALUES ($1, $2, $3::text::jsonb)`,
    [runId, PACKET_HASH, JSON.stringify({ version: "3.0.0", codeSha: RELEASE_SHA })],
  );
  const claimRows = await database.sql.unsafe<Array<{ id: string }>>(
    `INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
     VALUES ($1, 'implement', $2, 'feature-dev_developer')
     RETURNING id::text AS id`,
    [runId, storyId],
  );
  return { runId, storyId, claimId: Number(claimRows[0]!.id) };
}

async function seedAttempt(
  database: TestDatabase,
  input: Awaited<ReturnType<typeof seedRun>>,
  suffix: string,
  overrides: Readonly<{
    storyId?: string;
    sourceSha?: string;
    attemptClass?: "product_implementation" | "supervisor_repair";
    role?: "developer" | "supervisor";
    sliceHash?: string;
  }> = {},
) {
  const attemptId = `ATT_${suffix.padEnd(16, "x")}`;
  await database.sql.unsafe(
    `INSERT INTO execution_attempts (
       attempt_id, claim_id, run_id, step_id, story_id, generation, fence_token,
       attempt_class, packet_hash, compilation_report_hash, slice_hash,
       source_before_sha, source_before_tree_hash, finding_set_hash, dedupe_key,
       role, agent_id, branch, worktree,
       lease_acquired_at, lease_expires_at, heartbeat_at,
       disposition, evidence_refs
     ) VALUES (
       $1,$2,$3,'implement',$4,1,$5,$6,$7,$8,$9,$10,$11,$12,$13,
       $14,'feature-dev_developer','setfarm/test','/tmp/setfarm-test',
       NOW(),NOW() + INTERVAL '5 minutes',NOW(),'claimed','[]'
     )`,
    [
      attemptId,
      input.claimId,
      input.runId,
      overrides.storyId ?? input.storyId,
      "3".repeat(64),
      overrides.attemptClass ?? "product_implementation",
      PACKET_HASH,
      COMPILATION_REPORT_HASH,
      overrides.sliceHash ?? SLICE_HASH,
      overrides.sourceSha ?? BASE_SHA,
      BASE_TREE,
      "4".repeat(64),
      `dedupe-${suffix}`,
      overrides.role ?? "developer",
    ],
  );
  return attemptId;
}

describe("preparation authority v2 migration 25", () => {
  let database: TestDatabase;

  before(async () => {
    database = await createIsolatedTestDatabase({ migrate: false });
  });

  after(async () => database.cleanup());

  beforeEach(async () => {
    await database.sql.unsafe("DROP SCHEMA IF EXISTS evil CASCADE");
    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
  });

  it("installs, verifies, and rolls an empty exact ledger back to v24", async () => {
    const applied = await applyContractSpineMigrations(database.sql, {
      releaseSha: RELEASE_SHA,
    });
    assert.equal(applied.applied.includes("025_v3_preparation_authority_v2_ledger"), true);
    assert.equal(
      (await auditAuthorityV3ContractSpineThroughMigration31V1(database.sql)).status,
      "verified",
    );
    const rollback = await rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
      targetReleaseSha: TARGET_RELEASE_SHA,
    });
    assert.deepEqual({
      schema: rollback.schema,
      fromVersion: rollback.fromVersion,
      targetVersion: rollback.targetVersion,
      targetReleaseSha: rollback.targetReleaseSha,
      rowsRewritten: rollback.rowsRewritten,
    }, {
      schema: "setfarm.contract-spine-rollback.v1",
      fromVersion: 25,
      targetVersion: 24,
      targetReleaseSha: TARGET_RELEASE_SHA,
      rowsRewritten: 0,
    });
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "applied");
    assert.equal(plan.migrations.find((item) => item.version === 25)?.state, "pending");
  });

  it("publishes and consumes one exact authority through claim and initial attempt", async () => {
    await applyContractSpineMigrations(database.sql);
    const fixture = await seedRun(database, "exact");
    const prepared = authority(fixture.runId);
    const attemptId = await seedAttempt(database, fixture, "exact-attempt");
    await database.sql.begin(async (transaction) => {
      assert.equal(
        await publishV3PreparationAuthorityV2InTransaction(transaction, prepared),
        "published",
      );
      assert.equal(
        await bindV3PreparationAuthorityClaimV2InTransaction(transaction, {
          authorityHash: prepared.authorityHash,
          claimId: fixture.claimId,
        }),
        "published",
      );
      assert.equal(
        await bindV3PreparationAuthorityAttemptV2InTransaction(transaction, {
          authorityHash: prepared.authorityHash,
          claimId: fixture.claimId,
          attemptId,
          sliceHash: SLICE_HASH,
        }),
        "published",
      );
    });
    assert.deepEqual(await readV3PreparationAuthorityV2(database.sql, prepared.authorityHash), prepared);

    await assert.rejects(
      database.sql`UPDATE public.claim_log
                      SET story_id = 'US-EVIL'
                    WHERE id = ${fixture.claimId}`,
      /V3_PREPARATION_BOUND_CLAIM_V2_IDENTITY_IMMUTABLE/,
    );
    await database.sql`UPDATE public.claim_log
                          SET outcome = 'completed'
                        WHERE id = ${fixture.claimId}`;
    await database.sql`UPDATE execution_attempts SET disposition = 'running' WHERE attempt_id = ${attemptId}`;
    await assert.rejects(
      database.sql`UPDATE execution_attempts SET packet_hash = ${"9".repeat(64)} WHERE attempt_id = ${attemptId}`,
      /V3_PREPARATION_BOUND_ATTEMPT_V2_IDENTITY_IMMUTABLE/,
    );
    for (const operation of [
      () => database.sql`DELETE FROM v3_preparation_authorities_v2 WHERE authority_hash = ${prepared.authorityHash}`,
      () => database.sql`TRUNCATE TABLE v3_preparation_authority_claims_v2 CASCADE`,
      () => database.sql`UPDATE v3_preparation_authority_attempts_v2 SET slice_hash = ${"8".repeat(64)}`,
    ]) {
      await assert.rejects(operation(), /V3_PREPARATION_AUTHORITY.*V2_IMMUTABLE/);
    }
    assert.equal(
      (await auditAuthorityV3ContractSpineThroughMigration31V1(database.sql)).status,
      "verified",
    );
  });

  it("rejects structurally incomplete JSON payloads at the database boundary", async () => {
    await applyContractSpineMigrations(database.sql);
    const fixture = await seedRun(database, "empty-payload");
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO public.v3_preparation_authorities_v2 (
           authority_hash, authority_schema, authority_version, packet_schema,
           run_id, step_id, story_id, state_version, packet_hash,
           compilation_report_hash, base_source_sha, base_source_tree_hash,
           authority_payload
         ) VALUES (
           $1, 'setfarm.v3-preparation-claim-authority.v2', 2,
           'setfarm.product-build-packet.v3', $2, 'implement', 'US-001', 1,
           $3, $4, $5, $6, '{}'::jsonb
         )`,
        ["7".repeat(64), fixture.runId, PACKET_HASH, COMPILATION_REPORT_HASH, BASE_SHA, BASE_TREE],
      ),
      /v3_prep_authorities_v2_payload_check/,
    );
  });

  it("keeps startup bounded but makes the current audit reject nested payload forgery", async () => {
    await applyContractSpineMigrations(database.sql);
    const fixture = await seedRun(database, "nested-payload-forgery");
    const prepared = authority(fixture.runId);
    const forged = {
      ...prepared,
      dependencyAttempts: [{}],
    };
    await database.sql.unsafe(
      `INSERT INTO public.v3_preparation_authorities_v2 (
         authority_hash, authority_schema, authority_version, packet_schema,
         run_id, step_id, story_id, state_version, packet_hash,
         compilation_report_hash, base_source_sha, base_source_tree_hash,
         authority_payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text::jsonb)`,
      [
        prepared.authorityHash,
        prepared.schema,
        prepared.authorityVersion,
        prepared.packetSchema,
        prepared.runId,
        prepared.stepId,
        prepared.storyId,
        prepared.stateVersion,
        prepared.packetHash,
        prepared.compilationReportHash,
        prepared.baseRevision.sha,
        prepared.baseRevision.treeHash,
        JSON.stringify(forged),
      ],
    );
    assert.equal(
      (await auditAuthorityV3ContractSpineThroughMigration31V1(database.sql)).status,
      "verified",
    );
    await rollbackCurrentHeadToV26(database.sql);
    await assert.rejects(
      auditCurrentArtifactPublicationAuthorityLedgerData(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("uses only public preparation authority tables under a hostile search path", async () => {
    await applyContractSpineMigrations(database.sql);
    const fixture = await seedRun(database, "hostile-search-path");
    const prepared = authority(fixture.runId);
    const attemptId = await seedAttempt(database, fixture, "hostile-path-attempt");
    await database.sql.unsafe(`
      CREATE SCHEMA evil;
      CREATE TABLE evil.v3_preparation_authorities_v2 (
        authority_hash TEXT PRIMARY KEY,
        authority_schema TEXT NOT NULL,
        authority_version SMALLINT NOT NULL,
        packet_schema TEXT NOT NULL,
        run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        story_id TEXT NOT NULL,
        state_version INTEGER NOT NULL,
        packet_hash TEXT NOT NULL,
        compilation_report_hash TEXT NOT NULL,
        base_source_sha TEXT NOT NULL,
        base_source_tree_hash TEXT NOT NULL,
        authority_payload JSONB NOT NULL
      );
      CREATE TABLE evil.v3_preparation_authority_claims_v2 (
        authority_hash TEXT PRIMARY KEY,
        claim_id BIGINT NOT NULL
      );
      CREATE TABLE evil.v3_preparation_authority_attempts_v2 (
        authority_hash TEXT PRIMARY KEY,
        claim_id BIGINT NOT NULL,
        attempt_id TEXT NOT NULL,
        slice_hash TEXT NOT NULL
      )
    `);

    await database.sql.begin(async (transaction) => {
      await transaction.unsafe("SELECT set_config('search_path', 'evil, public', true)");
      assert.equal(
        await publishV3PreparationAuthorityV2InTransaction(transaction, prepared),
        "published",
      );
      assert.equal(
        await bindV3PreparationAuthorityClaimV2InTransaction(transaction, {
          authorityHash: prepared.authorityHash,
          claimId: fixture.claimId,
        }),
        "published",
      );
      assert.equal(
        await bindV3PreparationAuthorityAttemptV2InTransaction(transaction, {
          authorityHash: prepared.authorityHash,
          claimId: fixture.claimId,
          attemptId,
          sliceHash: SLICE_HASH,
        }),
        "published",
      );
      assert.deepEqual(
        await readV3PreparationAuthorityV2(transaction, prepared.authorityHash),
        prepared,
      );
    });

    const counts = await database.sql.unsafe<Array<{
      public_authorities: number;
      public_claims: number;
      public_attempts: number;
      evil_authorities: number;
      evil_claims: number;
      evil_attempts: number;
    }>>(
      `SELECT
         (SELECT COUNT(*)::integer FROM public.v3_preparation_authorities_v2)
           AS public_authorities,
         (SELECT COUNT(*)::integer FROM public.v3_preparation_authority_claims_v2)
           AS public_claims,
         (SELECT COUNT(*)::integer FROM public.v3_preparation_authority_attempts_v2)
           AS public_attempts,
         (SELECT COUNT(*)::integer FROM evil.v3_preparation_authorities_v2)
           AS evil_authorities,
         (SELECT COUNT(*)::integer FROM evil.v3_preparation_authority_claims_v2)
           AS evil_claims,
         (SELECT COUNT(*)::integer FROM evil.v3_preparation_authority_attempts_v2)
           AS evil_attempts`,
    );
    assert.deepEqual(counts[0], {
      public_authorities: 1,
      public_claims: 1,
      public_attempts: 1,
      evil_authorities: 0,
      evil_claims: 0,
      evil_attempts: 0,
    });
  });

  it("rejects wrong claim identity, terminal claims, and non-exact attempt consumers", async () => {
    await applyContractSpineMigrations(database.sql);
    const fixture = await seedRun(database, "reject");
    const prepared = authority(fixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, prepared);

    const wrongClaim = await database.sql.unsafe<Array<{ id: string }>>(
      `INSERT INTO claim_log (run_id, step_id, story_id, agent_id)
       VALUES ($1, 'implement', 'US-WRONG', 'feature-dev_developer')
       RETURNING id::text AS id`,
      [fixture.runId],
    );
    await assert.rejects(
      database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
        transaction,
        { authorityHash: prepared.authorityHash, claimId: Number(wrongClaim[0]!.id) },
      )),
      (error: unknown) => error instanceof V3PreparationAuthorityV2RepositoryError
        && error.code === "V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT",
    );
    await database.sql`UPDATE claim_log SET outcome = 'infra_retry' WHERE id = ${fixture.claimId}`;
    await assert.rejects(
      database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
        transaction,
        { authorityHash: prepared.authorityHash, claimId: fixture.claimId },
      )),
      /V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT/,
    );

    const terminalFixture = await seedRun(database, "terminal-attempt-reject");
    const terminalAuthority = authority(terminalFixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, terminalAuthority);
    await database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
      transaction,
      { authorityHash: terminalAuthority.authorityHash, claimId: terminalFixture.claimId },
    ));
    const terminalAttempt = await seedAttempt(
      database,
      terminalFixture,
      "terminal-claim",
    );
    await database.sql`UPDATE claim_log SET outcome = 'failed' WHERE id = ${terminalFixture.claimId}`;
    await assert.rejects(
      database.sql.begin((transaction) => bindV3PreparationAuthorityAttemptV2InTransaction(
        transaction,
        {
          authorityHash: terminalAuthority.authorityHash,
          claimId: terminalFixture.claimId,
          attemptId: terminalAttempt,
          sliceHash: SLICE_HASH,
        },
      )),
      (error: unknown) => error instanceof V3PreparationAuthorityV2RepositoryError
        && error.code === "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
    );

    const activeFixture = await seedRun(database, "attempt-reject");
    const activeAuthority = authority(activeFixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, activeAuthority);
    await database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
      transaction,
      { authorityHash: activeAuthority.authorityHash, claimId: activeFixture.claimId },
    ));
    const wrongAttempt = await seedAttempt(database, activeFixture, "wrong-source", {
      sourceSha: "0".repeat(40),
    });
    await assert.rejects(
      database.sql.begin((transaction) => bindV3PreparationAuthorityAttemptV2InTransaction(
        transaction,
        {
          authorityHash: activeAuthority.authorityHash,
          claimId: activeFixture.claimId,
          attemptId: wrongAttempt,
          sliceHash: SLICE_HASH,
        },
      )),
      (error: unknown) => error instanceof V3PreparationAuthorityV2RepositoryError
        && error.code === "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
    );
  });

  it("linearizes claim terminalization and attempt identity writers before binding", async () => {
    await applyContractSpineMigrations(database.sql);

    const claimFixture = await seedRun(database, "claim-writer-race");
    const claimAuthority = authority(claimFixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, claimAuthority);
    let releaseClaimWriter!: () => void;
    let markClaimWriterStarted!: () => void;
    const claimWriterRelease = new Promise<void>((resolve) => {
      releaseClaimWriter = resolve;
    });
    const claimWriterStarted = new Promise<void>((resolve) => {
      markClaimWriterStarted = resolve;
    });
    const claimWriter = database.sql.begin(async (transaction) => {
      await transaction`UPDATE claim_log SET outcome = 'failed' WHERE id = ${claimFixture.claimId}`;
      markClaimWriterStarted();
      await claimWriterRelease;
    });
    await claimWriterStarted;
    let claimBindingSettled = false;
    const claimBinding = database.sql.begin((transaction) =>
      bindV3PreparationAuthorityClaimV2InTransaction(transaction, {
        authorityHash: claimAuthority.authorityHash,
        claimId: claimFixture.claimId,
      })).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    ).finally(() => {
      claimBindingSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.equal(claimBindingSettled, false, "claim binding must wait for an in-flight terminal writer");
    releaseClaimWriter();
    await claimWriter;
    const claimBindingResult = await claimBinding;
    assert.equal(claimBindingResult.status, "rejected");
    assert.equal(
      claimBindingResult.status === "rejected"
        && claimBindingResult.error instanceof V3PreparationAuthorityV2RepositoryError
        && claimBindingResult.error.code,
      "V3_PREPARATION_AUTHORITY_V2_CLAIM_CONFLICT",
    );

    const attemptFixture = await seedRun(database, "attempt-writer-race");
    const attemptAuthority = authority(attemptFixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, attemptAuthority);
    await database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
      transaction,
      { authorityHash: attemptAuthority.authorityHash, claimId: attemptFixture.claimId },
    ));
    const attemptId = await seedAttempt(database, attemptFixture, "identity-writer");
    let releaseAttemptWriter!: () => void;
    let markAttemptWriterStarted!: () => void;
    const attemptWriterRelease = new Promise<void>((resolve) => {
      releaseAttemptWriter = resolve;
    });
    const attemptWriterStarted = new Promise<void>((resolve) => {
      markAttemptWriterStarted = resolve;
    });
    const attemptWriter = database.sql.begin(async (transaction) => {
      await transaction`UPDATE execution_attempts
                           SET packet_hash = ${"9".repeat(64)}
                         WHERE attempt_id = ${attemptId}`;
      markAttemptWriterStarted();
      await attemptWriterRelease;
    });
    await attemptWriterStarted;
    let attemptBindingSettled = false;
    const attemptBinding = database.sql.begin((transaction) =>
      bindV3PreparationAuthorityAttemptV2InTransaction(transaction, {
        authorityHash: attemptAuthority.authorityHash,
        claimId: attemptFixture.claimId,
        attemptId,
        sliceHash: SLICE_HASH,
      })).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    ).finally(() => {
      attemptBindingSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.equal(attemptBindingSettled, false, "attempt binding must wait for an in-flight identity writer");
    releaseAttemptWriter();
    await attemptWriter;
    const attemptBindingResult = await attemptBinding;
    assert.equal(attemptBindingResult.status, "rejected");
    assert.equal(
      attemptBindingResult.status === "rejected"
        && attemptBindingResult.error instanceof V3PreparationAuthorityV2RepositoryError
        && attemptBindingResult.error.code,
      "V3_PREPARATION_AUTHORITY_V2_ATTEMPT_CONFLICT",
    );
  });

  it("linearizes reverse identity writers that start after claim and attempt binding", async () => {
    await applyContractSpineMigrations(database.sql);

    const claimFixture = await seedRun(database, "bound-claim-writer-race");
    const claimAuthority = authority(claimFixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, claimAuthority);
    let releaseClaimBinding!: () => void;
    let markClaimBindingReady!: () => void;
    const claimBindingRelease = new Promise<void>((resolve) => {
      releaseClaimBinding = resolve;
    });
    const claimBindingReady = new Promise<void>((resolve) => {
      markClaimBindingReady = resolve;
    });
    const claimBinding = database.sql.begin(async (transaction) => {
      await bindV3PreparationAuthorityClaimV2InTransaction(transaction, {
        authorityHash: claimAuthority.authorityHash,
        claimId: claimFixture.claimId,
      });
      markClaimBindingReady();
      await claimBindingRelease;
    });
    await claimBindingReady;
    let claimWriterSettled = false;
    const claimWriter = database.sql`
      UPDATE public.claim_log
         SET story_id = 'US-RACED'
       WHERE id = ${claimFixture.claimId}
    `.then(
      () => ({ status: "fulfilled" as const }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    ).finally(() => {
      claimWriterSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.equal(claimWriterSettled, false, "claim identity writer must wait for binding commit");
    releaseClaimBinding();
    await claimBinding;
    const claimWriterResult = await claimWriter;
    assert.equal(claimWriterResult.status, "rejected");
    assert.match(
      String(claimWriterResult.status === "rejected" && claimWriterResult.error),
      /V3_PREPARATION_BOUND_CLAIM_V2_IDENTITY_IMMUTABLE/,
    );

    const attemptFixture = await seedRun(database, "bound-attempt-writer-race");
    const attemptAuthority = authority(attemptFixture.runId);
    await publishV3PreparationAuthorityV2(database.sql, attemptAuthority);
    await database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
      transaction,
      { authorityHash: attemptAuthority.authorityHash, claimId: attemptFixture.claimId },
    ));
    const attemptId = await seedAttempt(database, attemptFixture, "bound-attempt-writer");
    let releaseAttemptBinding!: () => void;
    let markAttemptBindingReady!: () => void;
    const attemptBindingRelease = new Promise<void>((resolve) => {
      releaseAttemptBinding = resolve;
    });
    const attemptBindingReady = new Promise<void>((resolve) => {
      markAttemptBindingReady = resolve;
    });
    const attemptBinding = database.sql.begin(async (transaction) => {
      await bindV3PreparationAuthorityAttemptV2InTransaction(transaction, {
        authorityHash: attemptAuthority.authorityHash,
        claimId: attemptFixture.claimId,
        attemptId,
        sliceHash: SLICE_HASH,
      });
      markAttemptBindingReady();
      await attemptBindingRelease;
    });
    await attemptBindingReady;
    let attemptWriterSettled = false;
    const attemptWriter = database.sql`
      UPDATE public.execution_attempts
         SET packet_hash = ${"9".repeat(64)}
       WHERE attempt_id = ${attemptId}
    `.then(
      () => ({ status: "fulfilled" as const }),
      (error: unknown) => ({ status: "rejected" as const, error }),
    ).finally(() => {
      attemptWriterSettled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    assert.equal(attemptWriterSettled, false, "attempt identity writer must wait for binding commit");
    releaseAttemptBinding();
    await attemptBinding;
    const attemptWriterResult = await attemptWriter;
    assert.equal(attemptWriterResult.status, "rejected");
    assert.match(
      String(attemptWriterResult.status === "rejected" && attemptWriterResult.error),
      /V3_PREPARATION_BOUND_ATTEMPT_V2_IDENTITY_IMMUTABLE/,
    );
  });

  it("linearizes identical concurrent publication across distinct state generations", async () => {
    await applyContractSpineMigrations(database.sql);
    const fixture = await seedRun(database, "race");
    for (let stateVersion = 1; stateVersion <= 5; stateVersion += 1) {
      const prepared = createV3PreparationClaimAuthorityV2({
        stateVersion,
        runId: fixture.runId,
        stepId: "implement",
        storyId: fixture.storyId,
        packetHash: PACKET_HASH,
        compilationReportHash: COMPILATION_REPORT_HASH,
        baseRevision: { sha: BASE_SHA, treeHash: BASE_TREE },
        projectedDependencyIds: [],
        dependencyAttempts: [],
      });
      const results = await Promise.all([
        publishV3PreparationAuthorityV2(database.sql, prepared),
        publishV3PreparationAuthorityV2(database.sql, prepared),
      ]);
      assert.deepEqual([...results].sort(), ["duplicate", "published"]);
    }
    const conflicting = createV3PreparationClaimAuthorityV2({
      stateVersion: 1,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      packetHash: PACKET_HASH,
      compilationReportHash: "0".repeat(64),
      baseRevision: { sha: BASE_SHA, treeHash: BASE_TREE },
      projectedDependencyIds: [],
      dependencyAttempts: [],
    });
    await assert.rejects(
      publishV3PreparationAuthorityV2(database.sql, conflicting),
      (error: unknown) => error instanceof V3PreparationAuthorityV2RepositoryError
        && error.code === "V3_PREPARATION_AUTHORITY_V2_PUBLICATION_CONFLICT",
    );

    const first = createV3PreparationClaimAuthorityV2({
      stateVersion: 1,
      runId: fixture.runId,
      stepId: "implement",
      storyId: fixture.storyId,
      packetHash: PACKET_HASH,
      compilationReportHash: COMPILATION_REPORT_HASH,
      baseRevision: { sha: BASE_SHA, treeHash: BASE_TREE },
      projectedDependencyIds: [],
      dependencyAttempts: [],
    });
    const claimResults = await Promise.all([
      database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
        transaction,
        { authorityHash: first.authorityHash, claimId: fixture.claimId },
      )),
      database.sql.begin((transaction) => bindV3PreparationAuthorityClaimV2InTransaction(
        transaction,
        { authorityHash: first.authorityHash, claimId: fixture.claimId },
      )),
    ]);
    assert.deepEqual([...claimResults].sort(), ["duplicate", "published"]);
    const attemptId = await seedAttempt(database, fixture, "concurrent-consumer");
    const attemptResults = await Promise.all([
      database.sql.begin((transaction) => bindV3PreparationAuthorityAttemptV2InTransaction(
        transaction,
        {
          authorityHash: first.authorityHash,
          claimId: fixture.claimId,
          attemptId,
          sliceHash: SLICE_HASH,
        },
      )),
      database.sql.begin((transaction) => bindV3PreparationAuthorityAttemptV2InTransaction(
        transaction,
        {
          authorityHash: first.authorityHash,
          claimId: fixture.claimId,
          attemptId,
          sliceHash: SLICE_HASH,
        },
      )),
    ]);
    assert.deepEqual([...attemptResults].sort(), ["duplicate", "published"]);
    const rows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM v3_preparation_authorities_v2
    `;
    assert.equal(rows[0]?.count, 5);
  });

  it("rejects catalog drift and refuses rollback after provenance exists", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: RELEASE_SHA });
    const fixture = await seedRun(database, "rollback-refusal");
    await publishV3PreparationAuthorityV2(database.sql, authority(fixture.runId));
    await assert.rejects(
      rollbackPreparationAuthorityV2LedgerToV24(database.sql, {
        targetReleaseSha: TARGET_RELEASE_SHA,
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );

    await database.sql`ALTER TABLE v3_preparation_authorities_v2 ADD COLUMN poison TEXT`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 25)?.state, "adoption_mismatch");
  });

  it("rejects a same-name constraint that retains one expected fragment but weakens the authority", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      "ALTER TABLE v3_preparation_authorities_v2 DROP CONSTRAINT v3_prep_authorities_v2_payload_check",
    );
    await database.sql.unsafe(
      `ALTER TABLE v3_preparation_authorities_v2
         ADD CONSTRAINT v3_prep_authorities_v2_payload_check
         CHECK (
           (authority_payload ->> 'authorityHash') = authority_hash
           OR TRUE
         )`,
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 25)?.state, "adoption_mismatch");
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects a same-name trigger retarget and extra index authority", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(
      `CREATE FUNCTION setfarm_v25_noop_trigger()
       RETURNS trigger LANGUAGE plpgsql
       AS $$ BEGIN RETURN NEW; END; $$`,
    );
    await database.sql.unsafe(
      "DROP TRIGGER trg_v3_preparation_authorities_v2_immutable ON v3_preparation_authorities_v2",
    );
    await database.sql.unsafe(
      `CREATE TRIGGER trg_v3_preparation_authorities_v2_immutable
       BEFORE INSERT OR UPDATE OR DELETE ON v3_preparation_authorities_v2
       FOR EACH ROW EXECUTE FUNCTION setfarm_v25_noop_trigger()`,
    );
    await database.sql.unsafe(
      "CREATE INDEX v3_preparation_authorities_v2_poison ON v3_preparation_authorities_v2 (created_at)",
    );
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 25)?.state, "adoption_mismatch");
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("preserves deployed migration 23 and 24 semantic identities", () => {
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[23],
      "dfeac8a3e38de094192e21d0281ff28330ae75d1227c994920f9a35c1b48e7fe",
    );
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[24],
      "62fd9d92eaceffee527aa734b1ae91b17594e4898750b0468bbe9d6acd9b75b4",
    );
  });
});
