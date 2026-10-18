import postgres, { type Sql } from "postgres";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { verifyOrdinaryBaseSchemaCatalogReadOnlyV1 } from "../db/base-schema-readonly-verifier-v1.js";
import { verifyContractSpineCurrentHeadJournalReadOnlyV1 } from "../db/contract-spine-readonly-verifier-v1.js";
import { verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1 } from "../db/public-object-owner-readonly-verifier-v1.js";
import { verifyFreshInstallationDatabaseIdentityV1, type FreshInstallationOriginV1 } from "./fresh-installation-origin-v1.js";
import { captureFreshInstallationSourceShaV1 } from "./fresh-installation-source-v1.js";
import { acknowledgeFreshInstallationCommitV1, readFreshInstallationPreparedStateV1, readFreshInstallationActivationStateV1 } from "./fresh-installation-records-v1.js";

export type FreshInstallationSchemaVerificationV1 = Readonly<{
  schema: "setfarm.fresh-installation-schema-verification.v1";
  state: "committed";
  origin: FreshInstallationOriginV1;
  catalogHash: string;
}>;

/** Read-only checks; never initializes a schema or registers an initialization transaction. */
export async function verifyFreshInstallationRuntimeConnectionV1(sql: Sql, origin: FreshInstallationOriginV1,
  catalogHash: string, ownerOid: number, runtimeOid: number, assertUnchanged: () => void): Promise<void> {
  const { ownerRole, runtimeRole } = origin;
  await sql.begin("isolation level repeatable read read only", async tx => {
    await tx.unsafe("SELECT set_config('lock_timeout','1000ms',true), set_config('statement_timeout','5000ms',true)");
    await verifyFreshInstallationDatabaseIdentityV1(tx, origin);
    const roles = await tx.unsafe<Array<{ valid: boolean }>>(`
      SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
        AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit AND rolcanlogin=(rolname=$1))
        AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles r ON r.oid=m.member OR r.oid=m.roleid WHERE r.rolname IN ($2,$1))
        AND bool_and(CASE WHEN rolname=$2 THEN oid=$3 ELSE oid=$4 END)
        AND current_user=$1 AND session_user=$1
        AND pg_catalog.has_database_privilege(current_user,current_database(),'CONNECT')
        AND NOT pg_catalog.has_database_privilege(current_user,current_database(),'CREATE')
        AND NOT pg_catalog.has_database_privilege(current_user,current_database(),'TEMPORARY') AS valid
      FROM pg_catalog.pg_roles WHERE rolname IN ($2,$1)`, [runtimeRole, ownerRole, ownerOid, runtimeOid]);
    if (roles.length !== 1 || roles[0]?.valid !== true) throw new Error("FRESH_INSTALLATION_ROLE_POLICY_MISMATCH");
    await verifyExpectedPublicObjectOwnerInTransactionReadOnlyV1(tx, ownerRole);
  });
  assertUnchanged();
  await verifyContractSpineCurrentHeadJournalReadOnlyV1(sql); assertUnchanged();
  await verifyOrdinaryBaseSchemaCatalogReadOnlyV1(sql); assertUnchanged();
  const { verifyFreshInstallationSchemaReadOnlyV1 } = await import("../db/contract-spine-migrations.js");
  await verifyFreshInstallationSchemaReadOnlyV1(sql, origin, catalogHash); assertUnchanged();
}

async function inspect(directory: string, reconcile: boolean): Promise<FreshInstallationSchemaVerificationV1> {
  try {
    const state = readFreshInstallationPreparedStateV1(directory, !reconcile);
    if (await captureFreshInstallationSourceShaV1() !== state.origin.sourceSha) throw new Error();
    state.assertUnchanged();
    const sql = postgres(state.runtimeUrl, { max: 1, connect_timeout: 5, idle_timeout: 2, onnotice() {} });
    try {
      await verifyFreshInstallationRuntimeConnectionV1(sql, state.origin, state.catalogHash, state.ownerOid, state.runtimeOid, state.assertUnchanged);
      if (await captureFreshInstallationSourceShaV1() !== state.origin.sourceSha) throw new Error();
      state.assertUnchanged();
      if (reconcile) acknowledgeFreshInstallationCommitV1(directory, state.origin, state.catalogHash);
      const final = readFreshInstallationPreparedStateV1(directory, true);
      if (hashCanonicalJson(final.origin) !== hashCanonicalJson(state.origin) || final.catalogHash !== state.catalogHash) throw new Error();
      final.assertUnchanged();
      return Object.freeze({ schema: "setfarm.fresh-installation-schema-verification.v1", state: "committed", origin: state.origin, catalogHash: state.catalogHash });
    } finally { await sql.end({ timeout: 5 }); }
  } catch { throw new Error(reconcile ? "FRESH_INSTALLATION_RECONCILIATION_REFUSED" : "FRESH_INSTALLATION_SCHEMA_VERIFICATION_REFUSED"); }
}

/** Explicit recovery may publish only the missing acknowledgment after actual verification. */
export function reconcileFreshInstallationSchemaV1(directory: string): Promise<FreshInstallationSchemaVerificationV1> {
  return inspect(directory, true);
}
/** Normal reopen is read-only and requires an already committed private record. */
export function verifyFreshInstallationSchemaV1(directory: string): Promise<FreshInstallationSchemaVerificationV1> {
  return inspect(directory, false);
}

/** Explicit stage-aware reopen. Incomplete activation evidence never falls back. */
export async function verifyFreshInstallationRuntimeV1(directory: string) {
  const activation = readFreshInstallationActivationStateV1(directory, "optional");
  if (activation) {
    const { verifyFreshInstallationActivationV1 } = await import("./fresh-installation-activation-v1.js");
    return verifyFreshInstallationActivationV1(directory);
  }
  return verifyFreshInstallationSchemaV1(directory);
}
