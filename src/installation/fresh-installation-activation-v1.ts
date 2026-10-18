/** Headless operational activation. No process, listener or legacy transition. */
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import { statfsSync } from "node:fs";
import {
  readFreshInstallationPreparedStateV1, readFreshInstallationActivationStateV1,
  captureFreshInstallationActivationAbsenceV1, publishFreshInstallationActivationPreparedV1,
  acknowledgeFreshInstallationActivationV1,
} from "./fresh-installation-records-v1.js";
import { deriveFreshInstallationOwnerProducerSourceBuildAuthorityAV1,
  verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1 } from "./fresh-installation-owner-source-v1.js";
import { verifyFreshInstallationRuntimeConnectionV1 } from "./fresh-installation-runtime-v1.js";
import { verifyFreshInstallationDatabaseIdentityV1 } from "./fresh-installation-origin-v1.js";
import { readFreshInstallationCatalogHashV1 } from "./fresh-installation-catalog-v1.js";
import type { PgTransactionSql, FreshInstallationOwnerProducerSourceBuildAuthorityAV1 } from "../internal-production/owner-admission-v1.js";

const activeTransactions = new WeakMap<object, Readonly<{
  sourceAuthority: FreshInstallationOwnerProducerSourceBuildAuthorityAV1;
  assertUnchanged(): void;
}>>();
function refuse(): never { throw new Error("FRESH_INSTALLATION_ACTIVATION_UNAVAILABLE"); }
function requireCompiled(): void { if (!fileURLToPath(import.meta.url).endsWith(".js")) refuse(); }
const quote=(value:string):string=>`"${value.replaceAll('"','""')}"`;

/** Only the privately owned controller transaction can possess this context. */
export function peekFreshInstallationActivationTransactionV1(sql: unknown) {
  return ((typeof sql === "function" || (sql !== null && typeof sql === "object"))
    ? activeTransactions.get(sql as object) : undefined) ?? null;
}
export function requireFreshInstallationActivationTransactionV1(sql: unknown) {
  const context=peekFreshInstallationActivationTransactionV1(sql);
  if (!context) throw new Error("FRESH_INSTALLATION_ACTIVATION_TRANSACTION_NOT_OWNED");
  context.assertUnchanged();
  return context;
}

export type FreshInstallationActivationVerificationV1=Readonly<{
  schema:"setfarm.fresh-installation-activation-verification.v1";
  state:"activated";
  installationId:string;
  sourceSha:string;
  catalogHash:string;
}>;

async function inspect(directory:string,reconcile:boolean):Promise<FreshInstallationActivationVerificationV1> {
  try {
    requireCompiled();
    const base=readFreshInstallationPreparedStateV1(directory,true);
    const state=readFreshInstallationActivationStateV1(directory,reconcile?"reconcile":"required");
    if (!state) refuse();
    const sql=postgres(base.runtimeUrl,{max:1,connect_timeout:5,idle_timeout:2,onnotice(){}});
    try {
      const {verifyFreshInstallationActivatedDatabaseOnTransactionV1}=await import("./fresh-installation-activation-verifier-v1.js");
      await sql.begin("isolation level repeatable read read only",async tx=>{
        await tx.unsafe("SELECT set_config('lock_timeout','1000ms',true),set_config('statement_timeout','30000ms',true),set_config('search_path','public',true)");
        await verifyFreshInstallationActivatedDatabaseOnTransactionV1(tx,state,base,reconcile?"reconcile-runtime":"runtime");
      });
      state.assertUnchanged(); base.assertUnchanged();
      if (reconcile) acknowledgeFreshInstallationActivationV1(directory,{
        activationPreparedPin:state.preparedPin,origin:state.prepared.origin,catalogHash:state.prepared.catalogHash,
      });
      const final=readFreshInstallationActivationStateV1(directory,"required");
      if (!final || final.preparedPin.sha256!==state.preparedPin.sha256) refuse();
      final.assertUnchanged();
      return Object.freeze({schema:"setfarm.fresh-installation-activation-verification.v1",state:"activated",
        installationId:state.prepared.origin.installationId,sourceSha:state.prepared.origin.sourceSha,catalogHash:state.prepared.catalogHash});
    } finally {await sql.end({timeout:5});}
  } catch {return refuse();}
}

/** Read-only reopen; acknowledgment never substitutes for actual verification. */
export function verifyFreshInstallationActivationV1(directory:string) {return inspect(directory,false);}
/** Recovery only publishes an absent ack after complete actual restricted verification. */
export function reconcileFreshInstallationActivationV1(directory:string) {return inspect(directory,true);}

export async function activateFreshInstallationManifestAV1(options:Readonly<{directory:string;adminUrl:string}>):Promise<FreshInstallationActivationVerificationV1> {
  try {
    requireCompiled(); // Before filesystem, getter invocation, connection or effects.
    if (!options || typeof options!=="object" || types.isProxy(options) || Object.getPrototypeOf(options)!==Object.prototype) refuse();
    const d=Object.getOwnPropertyDescriptors(options);
    if (Reflect.ownKeys(options).length!==2 || ["directory","adminUrl"].some(k=>!d[k]?.enumerable || !Object.hasOwn(d[k]!,"value") || typeof d[k]!.value!=="string")) refuse();
    const directory=d.directory!.value as string,adminUrl=d.adminUrl!.value as string;
    const endpoint=new URL(adminUrl);
    if (!["postgres:","postgresql:"].includes(endpoint.protocol) || !["localhost","127.0.0.1","[::1]"].includes(endpoint.hostname)
      || endpoint.pathname!=="/postgres" || !endpoint.username || endpoint.hash || endpoint.search) refuse();
    const base=readFreshInstallationPreparedStateV1(directory,true);
    const sourceAuthority=await deriveFreshInstallationOwnerProducerSourceBuildAuthorityAV1(base.origin);
    base.assertUnchanged();
    let absent:()=>void;
    try { absent=captureFreshInstallationActivationAbsenceV1(directory); }
    catch { return await reconcileFreshInstallationActivationV1(directory); }
    const capacity=statfsSync(directory,{bigint:true});
    if (capacity.bavail*capacity.bsize < 8n*1024n**3n+64n*1024n**2n) refuse();
    const restricted=postgres(base.runtimeUrl,{max:1,connect_timeout:5,idle_timeout:2,onnotice(){}});
    try {
      await verifyFreshInstallationRuntimeConnectionV1(restricted,base.origin,base.catalogHash,base.ownerOid,base.runtimeOid,()=>{base.assertUnchanged();absent();});
    } finally {await restricted.end({timeout:5});}
    base.assertUnchanged();absent();
    const target=new URL(endpoint);target.pathname="/"+base.origin.databaseName;
    const owner=postgres(target.href,{max:1,connect_timeout:5,idle_timeout:2,onnotice(){}});
    let prepared:ReturnType<typeof readFreshInstallationActivationStateV1>=null;
    try {
      await owner.begin("isolation level serializable",async tx=>{
        await tx.unsafe("SELECT set_config('lock_timeout','5000ms',true),set_config('statement_timeout','30000ms',true),set_config('search_path','public',true)");
        const {contractSpineMigrationLockKey}=await import("../db/contract-spine-migrations.js");
        await tx.unsafe("SELECT pg_advisory_xact_lock($1)",[contractSpineMigrationLockKey]);
        await tx.unsafe(`SET LOCAL ROLE ${quote(base.origin.ownerRole)}`);
        await verifyFreshInstallationDatabaseIdentityV1(tx,base.origin);
        const roles=await tx.unsafe<Array<{valid:boolean}>>(`SELECT count(*)=2 AND bool_and(
          CASE WHEN rolname=$1 THEN oid=$3 AND NOT rolcanlogin ELSE oid=$4 AND rolcanlogin END
          AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
          AND NOT rolbypassrls AND NOT rolinherit)
          AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member IN ($3,$4) OR roleid IN ($3,$4)) AS valid
          FROM pg_catalog.pg_roles WHERE rolname IN ($1,$2)`,
          [base.origin.ownerRole,base.origin.runtimeRole,base.ownerOid,base.runtimeOid]);
        if (roles.length!==1 || roles[0]?.valid!==true) refuse();
        if (await readFreshInstallationCatalogHashV1(tx)!==base.catalogHash) refuse();
        await verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1(tx,base.origin,sourceAuthority);
        const assertUnchanged=()=>{base.assertUnchanged();if(prepared)prepared.assertUnchanged();else absent();};
        assertUnchanged();
        activeTransactions.set(tx as object,Object.freeze({sourceAuthority,assertUnchanged}));
        try {
          const {activateFreshInstallationManifestAInOwnedTransactionV1}=await import("../db-pg.js");
          const current=await activateFreshInstallationManifestAInOwnedTransactionV1(tx as PgTransactionSql);
          const {installFreshInstallationProvenanceProtectionV1}=await import("./fresh-installation-provenance-v1.js");
          const {installFreshInstallationMissionControlSchemaV1}=await import("./fresh-installation-mission-control-schema-v1.js");
          const {installFreshInstallationRuntimeBusinessGrantsV1}=await import("./fresh-installation-runtime-grants-v1.js");
          await installFreshInstallationProvenanceProtectionV1(tx,base.origin.runtimeRole);
          await installFreshInstallationMissionControlSchemaV1(tx,base.origin.runtimeRole);
          const {installFreshInstallationEmptyArtifactIndexV1}=await import("./fresh-installation-artifact-bootstrap-v1.js");
          await installFreshInstallationEmptyArtifactIndexV1(tx,directory);
          await installFreshInstallationRuntimeBusinessGrantsV1(tx,base.origin.runtimeRole);
          assertUnchanged();
          await verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1(tx,base.origin,sourceAuthority);
          const catalogHash=await readFreshInstallationCatalogHashV1(tx);
          publishFreshInstallationActivationPreparedV1(directory,{sourceAuthority,current,catalogHash});
          prepared=readFreshInstallationActivationStateV1(directory,"reconcile");
          if (!prepared) refuse();
          const {verifyFreshInstallationActivatedDatabaseOnTransactionV1}=await import("./fresh-installation-activation-verifier-v1.js");
          await verifyFreshInstallationActivatedDatabaseOnTransactionV1(tx,prepared,base,"owner");
          assertUnchanged();
        } finally {activeTransactions.delete(tx as object);}
      });
    } catch {
      // Never repeat a CAS or repair effects after uncertain COMMIT. The durable
      // prepared file permits only complete actual-state acknowledgment recovery.
      if (!prepared) refuse();
      try {return await reconcileFreshInstallationActivationV1(directory);}
      catch {throw new Error("FRESH_INSTALLATION_ACTIVATION_COMMIT_UNCONFIRMED");}
    } finally {await owner.end({timeout:5});}
    return await reconcileFreshInstallationActivationV1(directory);
  } catch (error) {
    if (error instanceof Error && error.message === "FRESH_INSTALLATION_ACTIVATION_COMMIT_UNCONFIRMED") throw error;
    return refuse();
  }
}
