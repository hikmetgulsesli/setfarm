import assert from "node:assert/strict";
import { parseTask6aPostgresSocketTransportV1 }
  from "../../src/internal-production/task6a-postgres-socket-transport-v1.js";
import { createTask6aSingleBackendSocketClientV1 }
  from "../../src/internal-production/task6a-single-backend-socket-client-v1.js";
import { applyContractSpineMigrations, contractSpinePre32SourceJournalIdentitiesV1 }
  from "../../src/db/contract-spine-migrations.js";

export { withTask6aPrivateHeldPg31DiagnosticV2 }
  from "../../src/internal-production/task6a-held-pg31-diagnostic-v2.js";

// Test-only trusted setup actor. No production URL/descriptor, no migration32
// evidence and no ambient db-pg import. The private observing DB principal is
// explicitly source-owner-class, NOT a least-privilege production runtime role.
export async function prepareTask6aPrivateSource31FixtureV2(
  transport: unknown, statements: readonly string[],
): Promise<void> {
  const refused = () => Error("TASK6A_PRIVATE_SOURCE31_SETUP_REFUSED");
  const candidate = parseTask6aPostgresSocketTransportV1(transport);
  if (arguments.length !== 2 || candidate.database !== "setfarm" || candidate.user !== "task6a_admin"
    || !/^\/private\/tmp\/setfarm-task6a-protected-pg\.[A-Za-z0-9]+\/socket$/.test(candidate.socketDirectory)
    || process.getuid?.() !== candidate.osUid || process.geteuid?.() !== candidate.osUid
    || !Array.isArray(statements) || statements.length !== 52 || statements.some(query =>
      typeof query !== "string" || query.length > 20000
      || !/^(?:CREATE (?:SEQUENCE|TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS |ALTER TABLE |SELECT )/.test(query))) throw refused();
  const client = createTask6aSingleBackendSocketClientV1(candidate);
  const failures: unknown[] = [];
  try {
    const sql = client.sql;
    await sql.unsafe(`REVOKE ALL ON DATABASE setfarm FROM PUBLIC;
      GRANT CONNECT, TEMPORARY ON DATABASE setfarm TO task6a_runtime;
      REVOKE CREATE ON SCHEMA public FROM PUBLIC;
      GRANT CREATE, USAGE ON SCHEMA public TO task6a_runtime;
      SET ROLE task6a_runtime`);
    // Match pgMigrate's source order. Its ordinary open-claim indexes overlap
    // migration5, and installing them first correctly trips partial adoption.
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
    for (let index = 0; index < 31; index++) {
      assert.deepEqual(rows[index], { ...source[index], state: "applied" });
    }
    // Frozen source contracts require exact owner-default ACLs, so no second
    // principal gets table/function/column grants. CREATE revocation does not
    // remove this private role's inherent ownership powers outside READ ONLY.
    await sql.unsafe(`RESET ROLE;
      REVOKE CREATE ON SCHEMA public FROM task6a_runtime`);
    const roles = await sql.unsafe<Array<{ ownerLogin: boolean; runtimeUnsafe: boolean;
      runtimeCanCreateSchema: boolean; runtimeOwnsSource: boolean;
      runtimeOwnerMember: boolean; runtimeAdminMember: boolean }>>(`SELECT
      (SELECT rolcanlogin FROM pg_catalog.pg_roles WHERE rolname='task6a_owner') AS "ownerLogin",
      (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls FROM pg_catalog.pg_roles
        WHERE rolname='task6a_runtime') AS "runtimeUnsafe",
      pg_catalog.has_schema_privilege('task6a_runtime', 'public', 'CREATE') AS "runtimeCanCreateSchema",
      (SELECT pg_catalog.pg_get_userbyid(relowner)='task6a_runtime' FROM pg_catalog.pg_class
        WHERE oid='public.setfarm_schema_migrations'::regclass)
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')
            AND pg_catalog.pg_get_userbyid(c.relowner)<>'task6a_runtime')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND pg_catalog.pg_get_userbyid(p.proowner)<>'task6a_runtime') AS "runtimeOwnsSource",
      pg_catalog.pg_has_role('task6a_runtime', 'task6a_owner', 'MEMBER') AS "runtimeOwnerMember",
      pg_catalog.pg_has_role('task6a_runtime', 'task6a_admin', 'MEMBER') AS "runtimeAdminMember"`);
    assert.deepEqual(roles[0], { ownerLogin: false, runtimeUnsafe: false,
      runtimeCanCreateSchema: false, runtimeOwnsSource: true, runtimeOwnerMember: false, runtimeAdminMember: false });
  } catch (error) { failures.push(error); }
  finally {
    try { client.revoke(); } catch (error) { failures.push(error); }
    try { await client.close(); } catch (error) { failures.push(error); }
  }
  const distinct = failures.filter((error, index) => failures.findIndex(previous => Object.is(previous, error)) === index);
  if (distinct.length > 1) throw new AggregateError(distinct, "TASK6A_PRIVATE_SOURCE31_SETUP_AND_CLEANUP_FAILED");
  if (distinct.length) throw distinct[0];
}
