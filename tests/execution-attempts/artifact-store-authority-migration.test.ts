import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import postgres from "postgres";

import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "../../src/db/contract-spine-migration-digests.generated.js";
import {
  ContractSpineMigrationError,
  applyContractSpineMigrations,
  auditArtifactStoreAuthorityLedgerData as auditArtifactStoreAuthorityLedgerDataV24,
  auditCurrentArtifactStoreAuthorityLedgerData,
  planContractSpineMigrations,
  readContractSpineMigrationAttestation,
  rollbackArtifactStoreAuthorityLedgerToV23 as rollbackArtifactStoreAuthorityLedgerToV23Raw,
  rollbackPreparationAuthorityV2LedgerToV24,
  verifyContractSpineMigrations,
} from "../../src/db/contract-spine-migrations.js";
import { createIsolatedTestDatabase, type TestDatabase } from "./test-database.js";

const sourceRelease = "a".repeat(40);
const targetRelease = "b".repeat(40);
const authorityId = "11111111-1111-4111-8111-111111111111";
const rootLocatorHash = "c".repeat(64);

async function rollbackPreparationAuthorityIfPresent(sql: postgres.Sql): Promise<void> {
  const rows = await sql.unsafe<Array<{ present: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 25
     ) AS present`,
  );
  if (!rows[0]?.present) return;
  await rollbackPreparationAuthorityV2LedgerToV24(sql, {
    targetReleaseSha: "9".repeat(40),
  });
}

async function auditArtifactStoreAuthorityLedgerData(sql: postgres.Sql) {
  return auditCurrentArtifactStoreAuthorityLedgerData(sql);
}

async function rollbackArtifactStoreAuthorityLedgerToV23(
  sql: postgres.Sql,
  options: Parameters<typeof rollbackArtifactStoreAuthorityLedgerToV23Raw>[1],
) {
  await rollbackPreparationAuthorityIfPresent(sql);
  return rollbackArtifactStoreAuthorityLedgerToV23Raw(sql, options);
}

async function insertBindingAuthority(database: TestDatabase): Promise<void> {
  await database.sql.unsafe(
    `INSERT INTO artifact_store_authorities (
       authority_key, authority_schema, authority_id, root_locator_hash, state
     ) VALUES (
       'semantic-artifacts', 'setfarm.artifact-store-authority.v1', $1, $2, 'binding'
     )`,
    [authorityId, rootLocatorHash],
  );
}

describe("artifact store authority migration 24", () => {
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

  it("installs, verifies, audits, and rolls an empty exact ledger back to v23", async () => {
    const applied = await applyContractSpineMigrations(database.sql, {
      releaseSha: sourceRelease,
    });
    assert.equal(applied.applied.includes("024_artifact_store_authority_ledger"), true);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
    assert.deepEqual(await auditArtifactStoreAuthorityLedgerData(database.sql), {
      schema: "setfarm.artifact-store-authority-ledger-audit.v1",
      scope: "database-ledger-only",
      status: "verified",
      authority: null,
    });
    const objects = await database.sql<Array<{ table_name: string | null; function_name: string | null }>>`
      SELECT
        to_regclass('public.artifact_store_authorities')::text AS table_name,
        to_regprocedure(
          'public.setfarm_enforce_artifact_store_authority_transition()'
        )::text AS function_name
    `;
    assert.deepEqual(objects[0], {
      table_name: "artifact_store_authorities",
      function_name: "setfarm_enforce_artifact_store_authority_transition()",
    });

    const rollback = await rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
      targetReleaseSha: targetRelease,
    });
    assert.deepEqual({
      schema: rollback.schema,
      fromVersion: rollback.fromVersion,
      targetVersion: rollback.targetVersion,
      targetReleaseSha: rollback.targetReleaseSha,
      rowsRewritten: rollback.rowsRewritten,
    }, {
      schema: "setfarm.contract-spine-rollback.v1",
      fromVersion: 24,
      targetVersion: 23,
      targetReleaseSha: targetRelease,
      rowsRewritten: 0,
    });
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.migrations.find((item) => item.version === 23)?.state, "applied");
    assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "pending");
  });

  it("enforces exact state shapes and one-way database-owned transitions", async () => {
    await applyContractSpineMigrations(database.sql);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO artifact_store_authorities (
           authority_key, authority_schema, authority_id, root_locator_hash, state
         ) VALUES (
           'semantic-artifacts', 'setfarm.artifact-store-authority.v1', $1, $2, 'ready'
         )`,
        [authorityId, rootLocatorHash],
      ),
      /ARTIFACT_STORE_AUTHORITY_INITIAL_STATE_INVALID/,
    );
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO artifact_store_authorities (
           authority_key, authority_schema, authority_id, root_locator_hash,
           state, diagnostic
         ) VALUES (
           'semantic-artifacts', 'setfarm.artifact-store-authority.v1',
           $1, $2, 'binding', ''
         )`,
        [authorityId, rootLocatorHash],
      ),
      /artifact_store_authorities_diagnostic_check/,
    );
    await insertBindingAuthority(database);
    await assert.rejects(
      database.sql.unsafe(
        `UPDATE artifact_store_authorities
            SET root_locator_hash = $1
          WHERE authority_key = 'semantic-artifacts'`,
        ["d".repeat(64)],
      ),
      /ARTIFACT_STORE_AUTHORITY_IDENTITY_IMMUTABLE/,
    );
    await database.sql`
      UPDATE artifact_store_authorities
         SET state = 'ready'
       WHERE authority_key = 'semantic-artifacts'
    `;
    await assert.rejects(
      database.sql`
        UPDATE artifact_store_authorities
           SET state = 'binding'
         WHERE authority_key = 'semantic-artifacts'
      `,
      /ARTIFACT_STORE_AUTHORITY_TRANSITION_INVALID/,
    );
    await database.sql`
      UPDATE artifact_store_authorities
         SET state = 'quarantined', diagnostic = 'marker identity changed'
       WHERE authority_key = 'semantic-artifacts'
    `;
    await assert.rejects(
      database.sql`
        DELETE FROM artifact_store_authorities
         WHERE authority_key = 'semantic-artifacts'
      `,
      /ARTIFACT_STORE_AUTHORITY_TERMINAL_IMMUTABLE/,
    );
    const audited = (await auditArtifactStoreAuthorityLedgerData(database.sql)).authority!;
    assert.deepEqual({
      authorityKey: audited.authorityKey,
      authoritySchema: audited.authoritySchema,
      authorityId: audited.authorityId,
      rootLocatorHash: audited.rootLocatorHash,
      state: audited.state,
      diagnostic: audited.diagnostic,
    }, {
      authorityKey: "semantic-artifacts",
      authoritySchema: "setfarm.artifact-store-authority.v1",
      authorityId,
      rootLocatorHash,
      state: "quarantined",
      diagnostic: "marker identity changed",
    });
    assert.equal(Number.isNaN(Date.parse(audited.createdAt)), false);
    assert.equal(Date.parse(audited.updatedAt) >= Date.parse(audited.createdAt), true);
  });

  it("blocks TRUNCATE so permanent authority evidence cannot disappear", async () => {
    await applyContractSpineMigrations(database.sql);
    await insertBindingAuthority(database);
    await assert.rejects(
      database.sql`TRUNCATE TABLE artifact_store_authorities`,
      /ARTIFACT_STORE_AUTHORITY_TERMINAL_IMMUTABLE/,
    );
    const rows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count FROM artifact_store_authorities
    `;
    assert.equal(rows[0]?.count, 1);
    assert.equal(
      (await auditArtifactStoreAuthorityLedgerData(database.sql)).authority?.authorityId,
      authorityId,
    );
  });

  it("adopts only an exact empty unjournaled migration schema", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 24`;
    const emptyPlan = await planContractSpineMigrations(database.sql);
    assert.equal(emptyPlan.migrations.find((item) => item.version === 24)?.state, "adoptable");
    const adopted = await applyContractSpineMigrations(database.sql);
    assert.deepEqual(adopted.adopted, ["024_artifact_store_authority_ledger"]);

    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
    await applyContractSpineMigrations(database.sql);
    await insertBindingAuthority(database);
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 24`;
    const populatedPlan = await planContractSpineMigrations(database.sql);
    assert.equal(
      populatedPlan.migrations.find((item) => item.version === 24)?.state,
      "adoption_mismatch",
    );
    await assert.rejects(
      applyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const evidence = await database.sql<Array<{ journals: number; authorities: number }>>`
      SELECT
        (SELECT COUNT(*)::integer FROM setfarm_schema_migrations WHERE version = 24)
          AS journals,
        (SELECT COUNT(*)::integer FROM artifact_store_authorities) AS authorities
    `;
    assert.deepEqual(evidence[0], { journals: 0, authorities: 1 });
  });

  it("requires an exact v24 journal before reporting a database-ledger audit", async () => {
    await applyContractSpineMigrations(database.sql);
    await rollbackPreparationAuthorityIfPresent(database.sql);
    await database.sql`DELETE FROM setfarm_schema_migrations WHERE version = 24`;
    await assert.rejects(
      auditArtifactStoreAuthorityLedgerDataV24(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
  });

  it("rejects structurally weakened migration-journal authority during audit", async () => {
    for (const mutation of [
      "ALTER TABLE public.setfarm_schema_migrations ENABLE ROW LEVEL SECURITY",
      `CREATE RULE setfarm_schema_migrations_ignore_update AS
       ON UPDATE TO public.setfarm_schema_migrations DO INSTEAD NOTHING`,
    ]) {
      await database.sql.unsafe("DROP SCHEMA public CASCADE");
      await database.sql.unsafe("CREATE SCHEMA public");
      await applyContractSpineMigrations(database.sql);
      await database.sql.unsafe(mutation);
      await assert.rejects(
        auditArtifactStoreAuthorityLedgerData(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("keeps the historical v24 audit bounded when the real v25 ledger is installed", async () => {
    await applyContractSpineMigrations(database.sql);
    await assert.rejects(
      auditArtifactStoreAuthorityLedgerDataV24(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_UNKNOWN_VERSION",
    );
  });

  it("rejects weakened v23 prerequisite authority during the v24 ledger audit", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`ALTER TABLE public.artifact_capacity ENABLE ROW LEVEL SECURITY`;
    await assert.rejects(
      auditArtifactStoreAuthorityLedgerData(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("linearizes the ledger audit after an in-flight authority writer commits", async () => {
    await applyContractSpineMigrations(database.sql);
    const writerSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    const auditSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    let signalWriterReady!: () => void;
    let releaseWriter!: () => void;
    const writerReady = new Promise<void>((resolve) => { signalWriterReady = resolve; });
    const writerRelease = new Promise<void>((resolve) => { releaseWriter = resolve; });
    const writer = writerSql.begin(async (transaction) => {
      await transaction.unsafe(
        `INSERT INTO public.artifact_store_authorities (
           authority_key, authority_schema, authority_id, root_locator_hash, state
         ) VALUES (
           'semantic-artifacts', 'setfarm.artifact-store-authority.v1',
           $1, $2, 'binding'
         )`,
        [authorityId, rootLocatorHash],
      );
      signalWriterReady();
      await writerRelease;
    });
    let audit: ReturnType<typeof auditArtifactStoreAuthorityLedgerData> | undefined;
    try {
      await writerReady;
      const auditPidRows = await auditSql.unsafe<Array<{ pid: number }>>(
        "SELECT pg_backend_pid()::integer AS pid",
      );
      const auditPid = auditPidRows[0]!.pid;
      audit = auditArtifactStoreAuthorityLedgerData(auditSql);
      let lockWaitObserved = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const waits = await database.sql.unsafe<Array<{ waiting: boolean }>>(
          `SELECT EXISTS (
             SELECT 1
               FROM pg_locks
              WHERE pid = $1
                AND relation = 'public.artifact_store_authorities'::regclass
                AND mode = 'ShareLock'
                AND NOT granted
           ) AS waiting`,
          [auditPid],
        );
        if (waits[0]?.waiting) {
          lockWaitObserved = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(lockWaitObserved, true);
      releaseWriter();
      await writer;
      const audited = await audit;
      assert.equal(audited.authority?.authorityId, authorityId);
      assert.equal(audited.authority?.state, "binding");
    } finally {
      releaseWriter();
      await writer.catch(() => {});
      await audit?.catch(() => {});
      await Promise.all([
        writerSql.end({ timeout: 2 }),
        auditSql.end({ timeout: 2 }),
      ]);
    }
  });

  it("keeps the deployed migration 23 semantic and journal identities exact", async () => {
    assert.equal(
      CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[23],
      "dfeac8a3e38de094192e21d0281ff28330ae75d1227c994920f9a35c1b48e7fe",
    );
    await applyContractSpineMigrations(database.sql);
    const journal = await database.sql<Array<{ checksum: string }>>`
      SELECT checksum FROM setfarm_schema_migrations WHERE version = 23
    `;
    assert.equal(
      journal[0]?.checksum,
      "11325a4362172f995607ca8494aeeac397c86d3310a26832b51f62245a1f17fe",
    );
  });

  it("does not report attestation against a source-validity checksum drift", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql`
      UPDATE public.setfarm_schema_migrations
         SET checksum = repeat('0', 64)
       WHERE version = 23
    `;
    await assert.rejects(
      readContractSpineMigrationAttestation(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_CHECKSUM_MISMATCH",
    );
  });

  it("rejects a collation-weakened canonical migration journal", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql.unsafe(`
      CREATE COLLATION public.setfarm_journal_ci (
        provider = icu,
        locale = 'und-u-ks-level2',
        deterministic = false
      );
      ALTER TABLE public.setfarm_schema_migrations
        ALTER COLUMN state
        TYPE text COLLATE public.setfarm_journal_ci;
      UPDATE public.setfarm_schema_migrations
         SET state = 'APPLIED'
       WHERE version = 24
    `);
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => readContractSpineMigrationAttestation(database.sql),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects extra catalog authority and journaled missing helpers as typed drift", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql`ALTER TABLE artifact_store_authorities ADD COLUMN poison TEXT`;
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.status, "drift");
    assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "adoption_mismatch");
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );

    await database.sql`ALTER TABLE artifact_store_authorities DROP COLUMN poison`;
    await database.sql`
      DROP FUNCTION setfarm_enforce_artifact_store_authority_transition() CASCADE
    `;
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => applyContractSpineMigrations(database.sql),
      () => auditArtifactStoreAuthorityLedgerData(database.sql),
      () => rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
        targetReleaseSha: targetRelease,
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) =>
          error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects extra overloads in the migration-owned function namespace", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE FUNCTION public.setfarm_enforce_artifact_store_authority_transition(integer)
      RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$
    `);
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
        targetReleaseSha: targetRelease,
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("scopes trigger names to the authority table but rejects external function consumers", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE TABLE public.unrelated_authority_trigger_host (state TEXT);
      CREATE FUNCTION public.unrelated_authority_trigger()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
      CREATE TRIGGER trg_artifact_store_authorities_transition
        BEFORE INSERT OR UPDATE OR DELETE
        ON public.unrelated_authority_trigger_host
        FOR EACH ROW EXECUTE FUNCTION public.unrelated_authority_trigger();
      CREATE TRIGGER trg_artifact_store_authorities_no_truncate
        BEFORE TRUNCATE
        ON public.unrelated_authority_trigger_host
        FOR EACH STATEMENT EXECUTE FUNCTION public.unrelated_authority_trigger()
    `);
    assert.equal((await planContractSpineMigrations(database.sql)).status, "current");
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");

    await database.sql.unsafe(`
      DROP TRIGGER trg_artifact_store_authorities_transition
        ON public.unrelated_authority_trigger_host;
      DROP TRIGGER trg_artifact_store_authorities_no_truncate
        ON public.unrelated_authority_trigger_host;
      CREATE TRIGGER trg_artifact_store_authorities_transition
        BEFORE INSERT OR UPDATE OR DELETE
        ON public.unrelated_authority_trigger_host
        FOR EACH ROW EXECUTE FUNCTION
          public.setfarm_enforce_artifact_store_authority_transition();
      CREATE TRIGGER trg_artifact_store_authorities_no_truncate
        BEFORE TRUNCATE
        ON public.unrelated_authority_trigger_host
        FOR EACH STATEMENT EXECUTE FUNCTION
          public.setfarm_enforce_artifact_store_authority_transition()
    `);
    const plan = await planContractSpineMigrations(database.sql);
    assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "adoption_mismatch");
  });

  it("rejects non-ordinary or policy-weakened authority relations", async () => {
    for (const mutation of [
      "ALTER TABLE artifact_store_authorities SET UNLOGGED",
      "ALTER TABLE artifact_store_authorities ENABLE ROW LEVEL SECURITY",
      `ALTER TABLE artifact_store_authorities ENABLE ROW LEVEL SECURITY;
       ALTER TABLE artifact_store_authorities FORCE ROW LEVEL SECURITY`,
      "CREATE INDEX artifact_store_authorities_poison ON artifact_store_authorities(state)",
    ]) {
      await database.sql.unsafe("DROP SCHEMA public CASCADE");
      await database.sql.unsafe("CREATE SCHEMA public");
      await applyContractSpineMigrations(database.sql);
      await database.sql.unsafe(mutation);
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) =>
          error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("binds every authority text comparison to the deterministic C collation", async () => {
    await applyContractSpineMigrations(database.sql);
    await assert.rejects(
      database.sql.unsafe(
        `INSERT INTO public.artifact_store_authorities (
           authority_key, authority_schema, authority_id, root_locator_hash, state
         ) VALUES (
           'semantic-artifacts', 'SETFARM.ARTIFACT-STORE-AUTHORITY.V1',
           $1, $2, 'binding'
         )`,
        [authorityId, rootLocatorHash],
      ),
      /artifact_store_authorities_schema_check/,
    );
    await database.sql.unsafe(`
      CREATE COLLATION public.setfarm_ci (
        provider = icu,
        locale = 'und-u-ks-level2',
        deterministic = false
      );
      ALTER TABLE public.artifact_store_authorities
        ALTER COLUMN authority_schema
        TYPE text COLLATE public.setfarm_ci
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects authority inheritance in either direction", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE TABLE artifact_store_authority_shadow ()
      INHERITS (artifact_store_authorities)
    `);
    await database.sql.unsafe(
      `INSERT INTO artifact_store_authority_shadow (
         authority_key, authority_schema, authority_id, root_locator_hash, state
       ) VALUES (
         'semantic-artifacts', 'setfarm.artifact-store-authority.v1', $1, $2, 'ready'
       )`,
      [authorityId, rootLocatorHash],
    );
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );

    await database.sql.unsafe("DROP SCHEMA public CASCADE");
    await database.sql.unsafe("CREATE SCHEMA public");
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE TABLE artifact_store_authority_parent ();
      ALTER TABLE artifact_store_authorities
      INHERIT artifact_store_authority_parent
    `);
    await assert.rejects(
      verifyContractSpineMigrations(database.sql),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
  });

  it("rejects partitioned and view-like replacements as typed topology drift", async () => {
    for (const kind of ["partitioned", "view"] as const) {
      await database.sql.unsafe("DROP SCHEMA public CASCADE");
      await database.sql.unsafe("CREATE SCHEMA public");
      await applyContractSpineMigrations(database.sql);
      await database.sql.unsafe("DROP TABLE artifact_store_authorities CASCADE");
      if (kind === "partitioned") {
        await database.sql.unsafe(`
          CREATE TABLE artifact_store_authorities (
            authority_key TEXT NOT NULL,
            authority_schema TEXT NOT NULL,
            authority_id UUID NOT NULL,
            root_locator_hash TEXT NOT NULL,
            state TEXT NOT NULL,
            diagnostic TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          ) PARTITION BY LIST (authority_key)
        `);
      } else {
        await database.sql.unsafe(`
          CREATE VIEW artifact_store_authorities AS
          SELECT 'semantic-artifacts'::text AS authority_key
          WHERE FALSE
        `);
      }
      const plan = await planContractSpineMigrations(database.sql);
      assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "adoption_mismatch");
    }
  });

  it("binds transition triggers to the exact public function OID", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE SCHEMA evil;
      CREATE FUNCTION evil.setfarm_enforce_artifact_store_authority_transition()
      RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
      DROP TRIGGER trg_artifact_store_authorities_transition
        ON public.artifact_store_authorities;
      DROP TRIGGER trg_artifact_store_authorities_no_truncate
        ON public.artifact_store_authorities;
      CREATE TRIGGER trg_artifact_store_authorities_transition
        BEFORE INSERT OR UPDATE OR DELETE ON public.artifact_store_authorities
        FOR EACH ROW
        EXECUTE FUNCTION evil.setfarm_enforce_artifact_store_authority_transition();
      CREATE TRIGGER trg_artifact_store_authorities_no_truncate
        BEFORE TRUNCATE ON public.artifact_store_authorities
        FOR EACH STATEMENT
        EXECUTE FUNCTION evil.setfarm_enforce_artifact_store_authority_transition()
    `);
    const poisonedSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    try {
      await poisonedSql.unsafe("SET search_path TO evil, public");
      const rendered = await poisonedSql.unsafe<Array<{
        definition: string;
        function_matches: boolean;
      }>>(
        `SELECT pg_get_triggerdef(t.oid, true) AS definition,
                t.tgfoid = to_regprocedure(
                  'public.setfarm_enforce_artifact_store_authority_transition()'
                ) AS function_matches
           FROM pg_trigger t
          WHERE t.tgrelid = 'public.artifact_store_authorities'::regclass
            AND NOT t.tgisinternal
          ORDER BY t.tgname`,
      );
      assert.equal(rendered.every((row) => !row.definition.includes("evil.")), true);
      assert.equal(rendered.every((row) => row.function_matches === false), true);
      const plan = await planContractSpineMigrations(poisonedSql);
      assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "adoption_mismatch");
    } finally {
      await poisonedSql.end({ timeout: 2 });
    }
  });

  it("binds the authority foreign key to public artifact capacity by OID", async () => {
    await applyContractSpineMigrations(database.sql);
    await database.sql.unsafe(`
      CREATE SCHEMA evil;
      CREATE TABLE evil.artifact_capacity (capacity_key TEXT PRIMARY KEY);
      INSERT INTO evil.artifact_capacity VALUES ('semantic-artifacts');
      ALTER TABLE public.artifact_store_authorities
        DROP CONSTRAINT artifact_store_authorities_authority_key_fkey;
      ALTER TABLE public.artifact_store_authorities
        ADD CONSTRAINT artifact_store_authorities_authority_key_fkey
        FOREIGN KEY (authority_key)
        REFERENCES evil.artifact_capacity(capacity_key) ON DELETE RESTRICT
    `);
    const poisonedSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    try {
      await poisonedSql.unsafe("SET search_path TO evil, public");
      const foreignKey = await poisonedSql.unsafe<Array<{
        definition: string;
        reference_matches: boolean;
      }>>(
        `SELECT pg_get_constraintdef(oid, true) AS definition,
                confrelid = to_regclass('public.artifact_capacity') AS reference_matches
           FROM pg_constraint
          WHERE conrelid = 'public.artifact_store_authorities'::regclass
            AND conname = 'artifact_store_authorities_authority_key_fkey'`,
      );
      assert.equal(foreignKey[0]?.definition.includes("evil."), false);
      assert.equal(foreignKey[0]?.reference_matches, false);
      const plan = await planContractSpineMigrations(poisonedSql);
      assert.equal(plan.migrations.find((item) => item.version === 24)?.state, "adoption_mismatch");
    } finally {
      await poisonedSql.end({ timeout: 2 });
    }
  });

  it("rejects non-catalog CHECK dependencies even when deparsed prose is identical", async () => {
    await applyContractSpineMigrations(database.sql);
    const poisonedSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    try {
      await poisonedSql.unsafe(`
        CREATE SCHEMA evil;
        CREATE FUNCTION evil.octet_length(bytea)
        RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 0 $$;
        SET search_path TO evil, pg_catalog, public;
        ALTER TABLE public.artifact_store_authorities
          DROP CONSTRAINT artifact_store_authorities_diagnostic_check;
        ALTER TABLE public.artifact_store_authorities
          ADD CONSTRAINT artifact_store_authorities_diagnostic_check
          CHECK (
            (
              (state = 'quarantined' AND NULLIF(diagnostic, '') IS NOT NULL)
              OR (state IN ('binding', 'ready') AND diagnostic IS NULL)
            )
            AND (
              diagnostic IS NULL
              OR octet_length(convert_to(diagnostic, 'UTF8')) <= 4000
            )
          )
      `);
      const dependency = await poisonedSql.unsafe<Array<{
        definition: string;
        evil_functions: number;
      }>>(
        `SELECT pg_get_constraintdef(c.oid, true) AS definition,
                (SELECT COUNT(*)::integer
                   FROM pg_depend d
                   JOIN pg_proc p
                     ON d.refclassid = 'pg_proc'::regclass
                    AND p.oid = d.refobjid
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE d.classid = 'pg_constraint'::regclass
                    AND d.objid = c.oid
                    AND n.nspname = 'evil') AS evil_functions
           FROM pg_constraint c
          WHERE c.conrelid = 'public.artifact_store_authorities'::regclass
            AND c.conname = 'artifact_store_authorities_diagnostic_check'`,
      );
      assert.equal(dependency[0]?.definition.includes("evil."), false);
      assert.equal(dependency[0]?.evil_functions, 1);
    } finally {
      await poisonedSql.end({ timeout: 2 });
    }
    await insertBindingAuthority(database);
    await database.sql.unsafe(
      `UPDATE artifact_store_authorities
          SET state = 'quarantined', diagnostic = $1
        WHERE authority_key = 'semantic-artifacts'`,
      ["x".repeat(5_000)],
    );
    for (const operation of [
      () => verifyContractSpineMigrations(database.sql),
      () => auditArtifactStoreAuthorityLedgerData(database.sql),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("rejects rewrite rules and dormant policies on the authority relation", async () => {
    for (const mutation of [
      `CREATE RULE artifact_store_authorities_ignore_update AS
       ON UPDATE TO artifact_store_authorities DO INSTEAD NOTHING`,
      `CREATE POLICY artifact_store_authorities_latent_policy
       ON artifact_store_authorities USING (true)`,
    ]) {
      await database.sql.unsafe("DROP SCHEMA public CASCADE");
      await database.sql.unsafe("CREATE SCHEMA public");
      await applyContractSpineMigrations(database.sql);
      await database.sql.unsafe(mutation);
      await assert.rejects(
        verifyContractSpineMigrations(database.sql),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
  });

  it("refuses rollback once physical authority evidence exists", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await insertBindingAuthority(database);
    await assert.rejects(
      rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
        targetReleaseSha: targetRelease,
      }),
      (error: unknown) =>
        error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_INCOMPLETE",
    );
    const rows = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM setfarm_schema_migrations
       WHERE version = 24
    `;
    assert.equal(rows[0]?.count, 1);
  });

  it("refuses empty v24 rollback when any retained journal identity is missing or poisoned", async () => {
    for (const mutation of [
      "DELETE FROM setfarm_schema_migrations WHERE version = 23",
      "UPDATE setfarm_schema_migrations SET checksum = repeat('0', 64) WHERE version = 23",
    ]) {
      await database.sql.unsafe("DROP SCHEMA public CASCADE");
      await database.sql.unsafe("CREATE SCHEMA public");
      await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
      await database.sql.unsafe(mutation);
      await assert.rejects(
        rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
          targetReleaseSha: targetRelease,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_CHECKSUM_MISMATCH",
      );
      const evidence = await database.sql<Array<{
        journaled: boolean;
        authority_relation: string | null;
      }>>`
        SELECT EXISTS (
                 SELECT 1 FROM setfarm_schema_migrations WHERE version = 24
               ) AS journaled,
               to_regclass('public.artifact_store_authorities')::text
                 AS authority_relation
      `;
      assert.deepEqual(evidence[0], {
        journaled: true,
        authority_relation: "artifact_store_authorities",
      });
    }
  });

  it("refuses rollback before an incoming journal FK can cascade external data", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql.unsafe(`
      CREATE TABLE public.rollback_victim (
        migration_version INTEGER NOT NULL
          REFERENCES public.setfarm_schema_migrations(version) ON DELETE CASCADE
      );
      INSERT INTO public.rollback_victim (migration_version) VALUES (24)
    `);
    await assert.rejects(
      rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
        targetReleaseSha: targetRelease,
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const evidence = await database.sql<Array<{
      journaled: boolean;
      victims: number;
      authority_relation: string | null;
    }>>`
      SELECT EXISTS (
               SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 24
             ) AS journaled,
             (SELECT COUNT(*)::integer FROM public.rollback_victim) AS victims,
             to_regclass('public.artifact_store_authorities')::text
               AS authority_relation
    `;
    assert.deepEqual(evidence[0], {
      journaled: true,
      victims: 1,
      authority_relation: "artifact_store_authorities",
    });
  });

  it("uses public journal and receipt authority under a hostile search path", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql.unsafe(`
      CREATE SCHEMA evil;
      CREATE TABLE evil.setfarm_schema_migrations
        (LIKE public.setfarm_schema_migrations INCLUDING ALL);
      INSERT INTO evil.setfarm_schema_migrations
        SELECT * FROM public.setfarm_schema_migrations
    `);
    const poisonedSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    try {
      await poisonedSql.unsafe("SET search_path TO evil, public");
      await rollbackArtifactStoreAuthorityLedgerToV23(poisonedSql, {
        targetReleaseSha: targetRelease,
      });
    } finally {
      await poisonedSql.end({ timeout: 2 });
    }
    const evidence = await database.sql<Array<{
      public_journaled: boolean;
      evil_journaled: boolean;
      authority_relation: string | null;
      public_receipts: number;
    }>>`
      SELECT EXISTS (
               SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 24
             ) AS public_journaled,
             EXISTS (
               SELECT 1 FROM evil.setfarm_schema_migrations WHERE version = 24
             ) AS evil_journaled,
             to_regclass('public.artifact_store_authorities')::text
               AS authority_relation,
             (SELECT COUNT(*)::integer
                FROM public.setfarm_schema_migration_rollbacks
               WHERE from_version = 24) AS public_receipts
    `;
    assert.deepEqual(evidence[0], {
      public_journaled: false,
      evil_journaled: true,
      authority_relation: null,
      public_receipts: 1,
    });
  });

  it("uses public migration evidence for plan, verify, and apply under a hostile search path", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql.unsafe(`
      CREATE SCHEMA evil;
      CREATE TABLE evil.setfarm_schema_migrations
        (LIKE public.setfarm_schema_migrations INCLUDING ALL);
      INSERT INTO evil.setfarm_schema_migrations
        SELECT * FROM public.setfarm_schema_migrations;
      UPDATE evil.setfarm_schema_migrations
         SET checksum = repeat('0', 64)
       WHERE version = 24
    `);
    const poisonedSql = postgres(database.url, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    try {
      await poisonedSql.unsafe("SET search_path TO evil, pg_catalog, public");
      assert.equal((await planContractSpineMigrations(poisonedSql)).status, "current");
      assert.equal((await verifyContractSpineMigrations(poisonedSql)).status, "verified");

      await database.sql.unsafe("DROP SCHEMA public CASCADE");
      await database.sql.unsafe("CREATE SCHEMA public");
      const applied = await applyContractSpineMigrations(poisonedSql, {
        releaseSha: sourceRelease,
      });
      assert.equal(applied.applied.includes("024_artifact_store_authority_ledger"), true);
      const evidence = await poisonedSql.unsafe<Array<{
        public_rows: number;
        evil_checksum: string;
      }>>(
        `SELECT
           (SELECT COUNT(*)::integer FROM public.setfarm_schema_migrations)
             AS public_rows,
           (SELECT checksum FROM evil.setfarm_schema_migrations WHERE version = 24)
             AS evil_checksum`,
      );
      assert.deepEqual(evidence[0], {
      public_rows: 25,
        evil_checksum: "0".repeat(64),
      });
    } finally {
      await poisonedSql.end({ timeout: 2 });
    }
  });

  it("refuses rollback when the durable receipt ledger can suppress insertion", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql.unsafe(`
      CREATE TABLE public.setfarm_schema_migration_rollbacks (
        rollback_id TEXT PRIMARY KEY,
        from_version INTEGER NOT NULL,
        target_version INTEGER NOT NULL,
        target_release_sha TEXT NOT NULL,
        rows_rewritten INTEGER NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL
      );
      CREATE RULE setfarm_schema_migration_rollbacks_ignore_insert AS
      ON INSERT TO public.setfarm_schema_migration_rollbacks DO INSTEAD NOTHING
    `);
    await assert.rejects(
      rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
        targetReleaseSha: targetRelease,
      }),
      (error: unknown) => error instanceof ContractSpineMigrationError
        && error.code === "MIGRATION_ADOPTION_MISMATCH",
    );
    const evidence = await database.sql<Array<{
      journaled: boolean;
      authority_relation: string | null;
      receipts: number;
    }>>`
      SELECT EXISTS (
               SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 24
             ) AS journaled,
             to_regclass('public.artifact_store_authorities')::text
               AS authority_relation,
             (SELECT COUNT(*)::integer
                FROM public.setfarm_schema_migration_rollbacks) AS receipts
    `;
    assert.deepEqual(evidence[0], {
      journaled: true,
      authority_relation: "artifact_store_authorities",
      receipts: 0,
    });
  });

  it("rejects rewrite authority on the canonical migration journal", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    await database.sql.unsafe(`
      CREATE RULE setfarm_schema_migrations_ignore_delete AS
      ON DELETE TO public.setfarm_schema_migrations DO INSTEAD NOTHING
    `);
    for (const operation of [
      () => planContractSpineMigrations(database.sql),
      () => rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
        targetReleaseSha: targetRelease,
      }),
    ]) {
      await assert.rejects(
        operation(),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_ADOPTION_MISMATCH",
      );
    }
    const evidence = await database.sql<Array<{
      journaled: boolean;
      authority_relation: string | null;
    }>>`
      SELECT EXISTS (
               SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 24
             ) AS journaled,
             to_regclass('public.artifact_store_authorities')::text
               AS authority_relation
    `;
    assert.deepEqual(evidence[0], {
      journaled: true,
      authority_relation: "artifact_store_authorities",
    });
  });

  it("bounds apply, verify, attestation, and rollback behind a direct journal writer", async () => {
    await applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease });
    let announceLocked!: () => void;
    let releaseWriter!: () => void;
    const locked = new Promise<void>((resolve) => {
      announceLocked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseWriter = resolve;
    });
    const writer = database.sql.begin(async (transaction) => {
      await transaction.unsafe(
        `UPDATE public.setfarm_schema_migrations
            SET name = name
          WHERE version = 23`,
      );
      announceLocked();
      await release;
    });
    await locked;
    try {
      await assert.rejects(
        applyContractSpineMigrations(database.sql, {
          lockTimeoutMs: 50,
          statementTimeoutMs: 500,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT",
      );
      await assert.rejects(
        verifyContractSpineMigrations(database.sql, {
          lockTimeoutMs: 50,
          statementTimeoutMs: 500,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT",
      );
      await assert.rejects(
        readContractSpineMigrationAttestation(database.sql, {
          lockTimeoutMs: 50,
          statementTimeoutMs: 500,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT",
      );
      await assert.rejects(
        rollbackArtifactStoreAuthorityLedgerToV23(database.sql, {
          targetReleaseSha: targetRelease,
          lockTimeoutMs: 50,
          statementTimeoutMs: 500,
        }),
        (error: unknown) => error instanceof ContractSpineMigrationError
          && error.code === "MIGRATION_LOCK_TIMEOUT",
      );
    } finally {
      releaseWriter();
      await writer;
    }
    const evidence = await database.sql<Array<{ journaled: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM public.setfarm_schema_migrations WHERE version = 24
      ) AS journaled
    `;
    assert.equal(evidence[0]?.journaled, true);
  });

  it("serializes concurrent apply without exposing an adoptable intermediate", async () => {
    const [first, second] = await Promise.all([
      applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease }),
      applyContractSpineMigrations(database.sql, { releaseSha: sourceRelease }),
    ]);
    assert.equal(
      [first, second].filter((result) =>
        result.applied.includes("024_artifact_store_authority_ledger")).length,
      1,
    );
    assert.equal(
      [first, second].filter((result) =>
        result.alreadyApplied.includes("024_artifact_store_authority_ledger")).length,
      1,
    );
    assert.equal(
      [first, second].some((result) =>
        result.adopted.includes("024_artifact_store_authority_ledger")),
      false,
    );
    const journal = await database.sql<Array<{ count: number }>>`
      SELECT COUNT(*)::integer AS count
        FROM setfarm_schema_migrations
       WHERE version = 24
    `;
    assert.equal(journal[0]?.count, 1);
    assert.equal((await verifyContractSpineMigrations(database.sql)).status, "verified");
  });
});
