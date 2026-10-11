import assert from "node:assert/strict";
import { parseTask6aPostgresSocketTransportV1 }
  from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";
import { createTask6aSingleBackendSocketClientV1 }
  from "../../src/internal-production/task6a-single-backend-socket-client-v1.js";
import { applyContractSpineMigrations, contractSpinePre32SourceJournalIdentitiesV1 }
  from "../../src/db/contract-spine-migrations.js";

// Private trusted fixture setup only, never imported by the closed consumer.
// Distinct from the existing owner-class PG31 diagnostic. No production grants.
export async function prepareTask6aPrivateRestrictedBaselineFixtureV1(
  transport: unknown, statements: readonly string[],
): Promise<void> {
  const refused = () => Error("TASK6A_PRIVATE_RESTRICTED_BASELINE_SETUP_REFUSED");
  const candidate = parseTask6aPostgresSocketTransportV1(transport);
  if (arguments.length !== 2 || candidate.database !== "setfarm" || candidate.user !== "task6a_admin"
    || !/^\/private\/tmp\/setfarm-task6a-protected-pg\.[A-Za-z0-9]+\/socket$/.test(candidate.socketDirectory)
    || process.getuid?.() !== candidate.osUid || process.geteuid?.() !== candidate.osUid
    || !Array.isArray(statements) || statements.length !== 52 || statements.some(query =>
      typeof query !== "string" || query.length > 20000
      || !/^(?:CREATE (?:SEQUENCE|TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS |ALTER TABLE |SELECT )/.test(query))) throw refused();
  const client = createTask6aSingleBackendSocketClientV1(candidate), failures: unknown[] = [];
  try {
    const sql = client.sql;
    await sql.unsafe(`REVOKE ALL ON DATABASE setfarm FROM PUBLIC;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT CREATE, USAGE ON SCHEMA public TO setfarm_owner;
      SET ROLE setfarm_owner`);
    const automatic = await applyContractSpineMigrations(sql);
    assert.deepEqual(automatic.guardedPending, ["contract-spine-bootstrap-main-claim-handoff-v1"]);
    for (const statement of statements) {
      const rows = await sql.unsafe(statement);
      if (statement.startsWith("SELECT ") && rows.length !== 0) throw refused();
    }
    const rows = await sql.unsafe<Array<{ version: number; name: string; checksum: string; state: string }>>(
      "SELECT version, name, checksum, state FROM public.setfarm_schema_migrations ORDER BY version");
    const source = contractSpinePre32SourceJournalIdentitiesV1();
    assert.equal(rows.length, 31); assert.equal(source.length, 31);
    for (let index = 0; index < 31; index++) assert.deepEqual(rows[index], { ...source[index], state: "applied" });
    await sql.unsafe(`RESET ROLE;
      GRANT CONNECT ON DATABASE setfarm TO setfarm_runtime;
      GRANT USAGE ON SCHEMA public TO setfarm_runtime;
      GRANT SELECT ON TABLE public.setfarm_schema_migrations TO setfarm_runtime`);
    const roles = await sql.unsafe<Array<{ ownerLogin: boolean; runtimeUnsafe: boolean;
      runtimeCreate: boolean; runtimeMembership: boolean; wrongObjectOwner: boolean }>>(`SELECT
      (SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname='setfarm_owner') AS "ownerLogin",
      (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication
        FROM pg_catalog.pg_roles WHERE rolname='setfarm_runtime') AS "runtimeUnsafe",
      pg_catalog.has_database_privilege('setfarm_runtime','setfarm','CREATE')
        OR pg_catalog.has_schema_privilege('setfarm_runtime','public','CREATE') AS "runtimeCreate",
      EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname<>'setfarm_runtime'
        AND pg_catalog.pg_has_role('setfarm_runtime',r.oid,'MEMBER')) AS "runtimeMembership",
      EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND pg_catalog.pg_get_userbyid(c.relowner)<>'setfarm_owner') AS "wrongObjectOwner"`);
    assert.deepEqual(roles[0], { ownerLogin: false, runtimeUnsafe: false,
      runtimeCreate: false, runtimeMembership: false, wrongObjectOwner: false });
  } catch (error) { failures.push(error); }
  finally {
    try { client.revoke(); } catch (error) { failures.push(error); }
    try { await client.close(); } catch (error) { failures.push(error); }
  }
  if (failures.length > 1) throw new AggregateError(failures, "TASK6A_PRIVATE_RESTRICTED_BASELINE_SETUP_AND_CLEANUP_FAILED");
  if (failures.length) throw failures[0];
}
