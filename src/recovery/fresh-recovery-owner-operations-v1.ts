import postgres from "postgres";
import { lstatSync,realpathSync } from "node:fs";
import path from "node:path";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { getSql } from "../db-pg.js";
import { freshInstallationSelectionV1 } from "../installation/fresh-installation-selection-v1.js";
import { assertHeldFreshServiceCurrentV1, type FreshServiceCustodyV1 } from "../server/fresh-installation-service-controls-v1.js";
import { assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { currentRuntimeCompletionOwnerCapability } from "../execution/runtime-completion-owner-context.js";
import { RuntimeCompletionEffectInputV1Schema } from "../execution/schemas/runtime-completion-plan-v1.js";
import { hashCanonicalJson } from "../product-compiler/canonical-json.js";
import { createPostgresV3RecoveryEffectHandler } from "./v3-recovery-effect.js";
import { createOwnerRecoveryAccessV1, closeOwnerRecoveryAccessV1, ownerRecoveryRefusedV1,
  type OwnerRecoveryAccessV1, type OwnerRecoveryOperationKindV1 } from "./v3-owner-recovery-authority-v1.js";

import { createV3RecoveryWorkRouter } from "./v3-recovery-work-router.js";
import { createV3RecoveryClaimAuthority } from "./v3-recovery-claim-authority.js";
import { createV3RecoveryOwnerLeaseRepository } from "./v3-recovery-owner-lease.js";
import { createV3RecoveryLifecycleReconciler } from "./v3-recovery-lifecycle-reconciler.js";
import { createV3EvidenceOnlyRecoveryWorker } from "./v3-evidence-only-worker.js";
import { createV3EvidenceOnlyRuntimeDependencies } from "./v3-evidence-only-runtime.js";
import { reserveV3ImplementationAttempt } from "../execution/v3-implementation-attempt.js";
import { createRuntimeSessionRepository } from "../execution/runtime-session-repository.js";
import { createRunTerminationRepository } from "../execution/run-termination.js";
import { settleV3RefusalRecoveryLineageWithOwnerV1 } from "../installer/step-ops.js";

const refuse: () => never = ownerRecoveryRefusedV1;
let selectedOperations: Awaited<ReturnType<typeof prepareFreshRecoveryOwnerOperationsV1>> | undefined;

/** Trusted control-plane facade only. No connection/options/SQL/callback escapes. */
export function selectedFreshRecoveryOwnerOperationsV1() {
  if (!selectedOperations) refuse();
  selectedOperations.assertCurrent();
  return selectedOperations;
}

export async function prepareFreshRecoveryOwnerOperationsV1(held: FreshServiceCustodyV1) {
  if (selectedOperations || !fileURLToPath(import.meta.url).endsWith(".js")) refuse();
  assertHeldFreshServiceCurrentV1(held, "spawner");
  assertFreshInstallationOperationalEntryV1();
  const selected = freshInstallationSelectionV1;
  if (!selected) refuse();
  selected.assertUnchanged();
  const adminRole = userInfo().username;
  if (adminRole !== "setrox") refuse();
  const endpoint = new URL(selected.state.runtimeUrl);
  const port = Number(endpoint.port || "5432");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) refuse();
  const uid=process.getuid?.();
  if(uid===undefined)refuse();
  const socketDirectory=realpathSync("/tmp");
  const socketPath=path.join(socketDirectory,`.s.PGSQL.${port}`);
  const identityKeys=["dev","ino","mode","uid","gid","nlink"] as const;
  const socketPaths=["/",path.dirname(socketDirectory),socketDirectory,socketPath];
  const pins=socketPaths.map((file,index)=>{
    const stat=lstatSync(file,{bigint:true});
    if(stat.isSymbolicLink()||realpathSync(file)!==file
      ||(index===socketPaths.length-1?(!stat.isSocket()||stat.uid!==BigInt(uid)):
        (!stat.isDirectory()||(stat.uid!==0n&&stat.uid!==BigInt(uid)))))refuse();
    return {file,stat};
  });
  function assertSocketCurrent(){for(const pin of pins){
    const stat=lstatSync(pin.file,{bigint:true});
    if(realpathSync(pin.file)!==pin.file||identityKeys.some(key=>(key!=="nlink"||pin.file===socketPath)&&stat[key]!==pin.stat[key]))refuse();
  }}
  // Explicit Unix peer transport; never PGHOST/PGUSER/PGPASSWORD or TCP fallback.
  // Empty password intentionally overrides postgres.js' ambient password option.
  const writer = postgres({ host: socketDirectory, port, database: selected.state.origin.databaseName,
    username: adminRole, password: "", ssl: false, max: 1, connect_timeout: 5,
    idle_timeout: 2, onnotice() {} });
  let closed = false;
  const active = new Set<OwnerRecoveryAccessV1>();
  function assertCurrent() {
    if (closed) refuse();
    assertHeldFreshServiceCurrentV1(held, "spawner");
    assertFreshInstallationOperationalEntryV1();
    selected!.assertUnchanged();
    if(process.getuid?.()!==uid||userInfo().username!==adminRole)refuse();
    assertSocketCurrent();
  }
  try {
    const identity = await writer.unsafe<Array<{ admin_oid: string; owner_oid: string; runtime_oid: string; valid: boolean }>>(`SELECT
      admin.oid::text AS admin_oid, owner.oid::text AS owner_oid, runtime.oid::text AS runtime_oid,
      session_user=$1 AND current_user=$1 AND current_database()=$2
      AND db.oid::text=$3 AND db.datdba=owner.oid AND control.system_identifier::text=$4
      AND NOT owner.rolcanlogin AND NOT owner.rolsuper AND NOT owner.rolcreatedb AND NOT owner.rolcreaterole AND NOT owner.rolbypassrls
      AND NOT runtime.rolsuper AND NOT runtime.rolcreatedb AND NOT runtime.rolcreaterole AND NOT runtime.rolbypassrls
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=runtime.oid AND roleid=owner.oid) AS valid
      FROM pg_catalog.pg_roles admin, pg_catalog.pg_roles owner, pg_catalog.pg_roles runtime,
      pg_catalog.pg_database db, pg_catalog.pg_control_system() control
      WHERE admin.rolname=$1 AND owner.rolname=$5 AND runtime.rolname=$6 AND db.datname=current_database()`,
    [adminRole, selected.state.origin.databaseName, String(selected.state.origin.databaseOid), selected.state.origin.systemIdentifier,
      selected.state.origin.ownerRole, selected.state.origin.runtimeRole]);
    assertCurrent();
    const row = identity[0];
    if (identity.length !== 1 || !row?.valid||row.owner_oid!==String(selected.state.ownerOid)||row.runtime_oid!==String(selected.state.runtimeOid)) refuse();
    const base = { held, writeSql: writer, adminRole, adminOid: row.admin_oid, ownerOid: row.owner_oid, runtimeOid: row.runtime_oid };
    // This callback is a private lexical implementation, never a public argument.
    // Every invocation below selects a fixed repository operation; it receives no
    // caller SQL, pool, transaction callback or connection options.
    async function operation<T>(kind: OwnerRecoveryOperationKindV1,
      implementation: (access: OwnerRecoveryAccessV1) => Promise<T>,
      completion?: Parameters<typeof createOwnerRecoveryAccessV1>[0]["completion"]): Promise<T> {
      assertCurrent();
      const access = createOwnerRecoveryAccessV1({ ...base, kind, ...(completion ? { completion } : {}) });
      active.add(access);
      try { const result = await implementation(access); assertCurrent(); return result; }
      finally { closeOwnerRecoveryAccessV1(access); active.delete(access); }
    }
    const facade = Object.freeze({
      assertCurrent,
      async coordinateCurrentEffect(input: Readonly<{ requestId: string; effectKey: string; leaseToken: string }>) {
        assertCurrent();
        const actual = currentRuntimeCompletionOwnerCapability();
        if (!actual || actual.requestId !== input.requestId) refuse();
        // Reload exact durable payload. Caller supplies only the existing lease
        // locators, never a replacement verdict, manifest or owner identity.
        const rows = await getSql().unsafe<Array<{ payload: unknown; input_hash: string; attempt_count: number }>>(
          `SELECT payload,input_hash,attempt_count FROM runtime_completion_effects
           WHERE request_id=$1 AND effect_key=$2 AND owner_instance_id=$3 AND lease_token=$4
             AND state='leased' AND mandatory AND effect_type='v3.recovery.coordinate'
             AND lease_expires_at>clock_timestamp()`,
          [input.requestId,input.effectKey,actual.ownerInstanceId,input.leaseToken]);
        assertCurrent();
        if (rows.length !== 1) refuse();
        const effect = rows[0]!;
        const payload = RuntimeCompletionEffectInputV1Schema.parse(effect.payload);
        if (hashCanonicalJson(payload) !== effect.input_hash) refuse();
        return operation("coordinate", access => createPostgresV3RecoveryEffectHandler(getSql(), access).coordinate(payload.effect), {
          requestId: input.requestId, effectKey: input.effectKey, leaseToken: input.leaseToken,
          ownerInstanceId: actual.ownerInstanceId, ownerAttemptCount: actual.ownerAttemptCount,
          effectAttemptCount: effect.attempt_count, inputHash: effect.input_hash, planHash: payload.planHash,
        });
      },
      acquireNextRecoveryWork(raw: Parameters<ReturnType<typeof createV3RecoveryWorkRouter>["acquireNext"]>[0],
        admission: Parameters<typeof createV3RecoveryWorkRouter>[1]) {
        // Existing candidate admission runs before its owner transaction and is
        // given only candidate identities, never access/client/transaction.
        return operation("claim", access => createV3RecoveryWorkRouter(getSql(),admission,access).acquireNext(raw));
      },
      acquireRecoveryClaim(raw: Parameters<ReturnType<typeof createV3RecoveryClaimAuthority>["acquireRecoveryClaim"]>[0]) {
        return operation("claim", access => createV3RecoveryClaimAuthority(getSql(),access).acquireRecoveryClaim(raw));
      },
      reserveRecoveryAttempt(input: Parameters<typeof reserveV3ImplementationAttempt>[0]) {
        if(!input.recoveryDelivery)refuse();
        return operation("reserve", access => reserveV3ImplementationAttempt(input,access));
      },
      markRecoveryRuntimeRunning(input: Parameters<ReturnType<typeof createRuntimeSessionRepository>["markRunning"]>[0]) {
        if(!input.recoveryFence)refuse();
        return operation("running", access => createRuntimeSessionRepository(getSql(),access).markRunning(input));
      },
      heartbeatRecoveryOwner(input: Parameters<ReturnType<typeof createV3RecoveryOwnerLeaseRepository>["heartbeat"]>[0],
        options?: Parameters<ReturnType<typeof createV3RecoveryOwnerLeaseRepository>["heartbeat"]>[1]) {
        return operation("heartbeat", access => createV3RecoveryOwnerLeaseRepository(getSql(),access).heartbeat(input,options));
      },
      relinquishRecoveryOwner(input: Parameters<ReturnType<typeof createV3RecoveryOwnerLeaseRepository>["relinquish"]>[0]) {
        return operation("relinquish", access => createV3RecoveryOwnerLeaseRepository(getSql(),access).relinquish(input));
      },
      runEvidenceOnlyRecovery(raw: Parameters<ReturnType<typeof createV3EvidenceOnlyRecoveryWorker>["runNext"]>[0]) {
        return operation("evidence", access => createV3EvidenceOnlyRecoveryWorker(getSql(),
          createV3EvidenceOnlyRuntimeDependencies(getSql(),access),{},access).runNext(raw));
      },
      reconcileRecoveryLifecycle(raw: Parameters<ReturnType<typeof createV3RecoveryLifecycleReconciler>["reconcileActive"]>[0],
        options?: Parameters<ReturnType<typeof createV3RecoveryLifecycleReconciler>["reconcileActive"]>[1]) {
        return operation("lifecycle", access => createV3RecoveryLifecycleReconciler(getSql(),access).reconcileActive(raw,options));
      },
      settleRefusalRecoveryLineage(effect: Parameters<typeof settleV3RefusalRecoveryLineageWithOwnerV1>[0]) {
        return operation("refusal", access => settleV3RefusalRecoveryLineageWithOwnerV1(effect,access));
      },
      transitionRunRecoveryTerminal(input: Parameters<ReturnType<typeof createRunTerminationRepository>["terminalize"]>[0]) {
        return operation("terminal", access => createRunTerminationRepository(getSql(),access).terminalize(input));
      },
      async close() {
        if (closed) return;
        closed = true;
        // Fence every pending transaction synchronously before waiting on SQL.
        for (const access of active) closeOwnerRecoveryAccessV1(access);
        await writer.end({ timeout: 5 });
      },
    });
    selectedOperations = facade;
    return facade;
  } catch {
    closed = true;
    await writer.end({ timeout: 5 }).catch(() => {});
    refuse();
  }
}
