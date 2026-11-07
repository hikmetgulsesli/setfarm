import type postgres from "postgres";
import { freshInstallationSelectionV1, assertFreshInstallationSelectionUnchangedV1 } from "../installation/fresh-installation-selection-v1.js";
import { assertFreshInstallationOperationalEntryV1 } from "../installation/fresh-installation-entry-v1.js";
import { assertHeldFreshServiceCurrentV1, type FreshServiceCustodyV1 } from "../server/fresh-installation-service-controls-v1.js";
import { readFreshInstallationCatalogHashV1 } from "../installation/fresh-installation-catalog-v1.js";
import { currentRuntimeCompletionOwnerCapability } from "../execution/runtime-completion-owner-context.js";
import { lockRuntimeCompletionChainInTransaction } from "../execution/runtime-completion.js";
import { assertRuntimeCompletionManifestInTransactionV1 } from "../execution/runtime-completion-manifest-authority-v1.js";
import { assertRuntimeCompletionEffectLeaseInTransaction } from "../execution/runtime-completion-effect-repository.js";
import { readDatabaseWallClock } from "../db/database-wall-clock.js";

export type OwnerRecoveryOperationKindV1 = "coordinate" | "claim" | "reserve" | "running" | "heartbeat" | "relinquish" | "evidence" | "lifecycle" | "refusal" | "terminal";
export type OwnerRecoveryOperationV1 = Readonly<{ readonly ownerRecoveryOperation: unique symbol }>;
/** Internal constructor input only. Fixed executor keeps both client and token private. */
export type OwnerRecoveryAccessV1 = Readonly<{ writeSql: postgres.Sql; operation: OwnerRecoveryOperationV1 }>;
export type OwnerRecoveryTransactionFenceV1 = Readonly<{ readonly ownerRecoveryFence: unique symbol }>;
type CompletionFence = Readonly<{ requestId: string; ownerInstanceId: string; ownerAttemptCount: number; effectKey: string; leaseToken: string; effectAttemptCount: number; inputHash: string; planHash: string }>;
type State = { held: FreshServiceCustodyV1; sql: postgres.Sql; kind: OwnerRecoveryOperationKindV1; adminRole: string;
  adminOid: string; ownerOid: string; runtimeOid: string; completion?: CompletionFence; closed: boolean };
const operations = new WeakMap<object, State>();
type DeliveryLeaseV1 = Readonly<{dispatchId:string;revisionId:string;ownerInstanceId:string;leaseToken:string;attempt?:Readonly<{attemptId:string;generation:number;fenceToken:string}>}>;
const transactions = new WeakMap<object, { transaction: postgres.TransactionSql; state: State; leases:DeliveryLeaseV1[]; originalLeaseDeadlines:number[] }>();
const ownedTransactions = new WeakMap<object, OwnerRecoveryTransactionFenceV1>();
export function ownerRecoveryRefusedV1(): never { throw Error("RECOVERY_OWNER_AUTHORITY_REFUSED"); }
const refuse: () => never = ownerRecoveryRefusedV1;
function current(state: State) {
  if (state.closed) refuse();
  assertHeldFreshServiceCurrentV1(state.held, "spawner");
  assertFreshInstallationSelectionUnchangedV1();assertFreshInstallationOperationalEntryV1();
  const selected = freshInstallationSelectionV1;
  if (!selected) refuse();selected.assertUnchanged();
  if(String(selected.state.ownerOid)!==state.ownerOid||String(selected.state.runtimeOid)!==state.runtimeOid)refuse();
  return selected;
}
/** Called only by the fixed compiled executor after its peer identity read. */
export function createOwnerRecoveryAccessV1(input: Readonly<{ held: FreshServiceCustodyV1; writeSql: postgres.Sql;
  kind: OwnerRecoveryOperationKindV1; adminRole: string; adminOid: string; ownerOid: string; runtimeOid: string; completion?: CompletionFence }>): OwnerRecoveryAccessV1 {
  const state: State = { ...input, sql: input.writeSql, closed: false };
  current(state);
  const operation = Object.freeze({}) as OwnerRecoveryOperationV1;
  operations.set(operation, state);
  return Object.freeze({ writeSql: input.writeSql, operation });
}
export function assertOwnerRecoveryAccessV1(access: OwnerRecoveryAccessV1): void {
  const state = access && typeof access === "object" ? operations.get(access.operation) : undefined;
  if (!state || state.sql !== access.writeSql) refuse();current(state);
}
export function closeOwnerRecoveryAccessV1(access: OwnerRecoveryAccessV1): void {
  const state = operations.get(access.operation);if (!state || state.sql !== access.writeSql) refuse();state.closed = true;
}
async function verifyIdentity(transaction: postgres.TransactionSql, state: State): Promise<void> {
  const s = current(state), o = s.state.origin;
  const rows = await transaction.unsafe<Array<{ valid: boolean }>>(`SELECT
    current_user=$1 AND session_user=$2 AND current_database()=$3
    AND (SELECT oid::text=$4 AND datdba::text=$5 FROM pg_catalog.pg_database WHERE datname=current_database())
    AND (SELECT system_identifier::text=$6 FROM pg_catalog.pg_control_system())
    AND (SELECT oid::text=$5 AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=$1)
    AND (SELECT oid::text=$7 AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=$8)
    AND (SELECT oid::text=$9 FROM pg_catalog.pg_roles WHERE rolname=session_user)
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=$7::oid AND roleid=$5::oid) AS valid`,
    [o.ownerRole, state.adminRole, o.databaseName, String(o.databaseOid), state.ownerOid, o.systemIdentifier, state.runtimeOid, o.runtimeRole, state.adminOid]);
  if (rows.length !== 1 || rows[0]?.valid !== true) refuse();
  if (await readFreshInstallationCatalogHashV1(transaction) !== s.catalogHash) refuse();
  current(state);
}
async function verifyCompletion(transaction: postgres.TransactionSql, state: State): Promise<void> {
  const c = state.completion;if (!c) return;
  const actual = currentRuntimeCompletionOwnerCapability();
  if (!actual || actual.requestId !== c.requestId || actual.ownerInstanceId !== c.ownerInstanceId || actual.ownerAttemptCount !== c.ownerAttemptCount) refuse();
  const rows = await transaction.unsafe<Array<{ valid: boolean }>>(`SELECT r.state='processing' AND r.apply_phase='owner_committed'
    AND r.owner_instance_id=$2 AND r.owner_attempt_count=$3 AND r.lease_expires_at>clock_timestamp()
    AND r.completion_plan_hash=$4 AND r.drained_at IS NOT NULL AND r.claim_committed_at IS NOT NULL
    AND runtime.state='drained' AND runtime.claim_id=r.claim_id AND runtime.run_id=r.run_id
    AND claim.outcome=r.claim_outcome AND claim.run_id=r.run_id
    AND e.owner_instance_id=$2 AND e.state='leased' AND e.mandatory AND e.effect_type='v3.recovery.coordinate'
    AND e.lease_token=$6 AND e.attempt_count=$7 AND e.input_hash=$8 AND e.lease_expires_at>clock_timestamp() AS valid
    FROM runtime_completion_requests r JOIN runtime_sessions runtime ON runtime.session_id=r.runtime_session_id
    JOIN claim_log claim ON claim.id=r.claim_id
    JOIN runtime_completion_effects e ON e.request_id=r.request_id AND e.effect_key=$5
    WHERE r.request_id=$1`, [c.requestId,c.ownerInstanceId,c.ownerAttemptCount,c.planHash,c.effectKey,c.leaseToken,c.effectAttemptCount,c.inputHash]);
  if (rows.length !== 1 || rows[0]?.valid !== true) refuse();
}
/** Actual BEGIN callback entry; no caller-provided privileged callback executes here. */
export async function enterOwnerRecoveryTransactionV1(transaction: postgres.TransactionSql, access: OwnerRecoveryAccessV1): Promise<OwnerRecoveryTransactionFenceV1> {
  assertOwnerRecoveryAccessV1(access);const state = operations.get(access.operation)!;const s = current(state);
  await transaction.unsafe("SET LOCAL statement_timeout='30s'");
  await transaction.unsafe("SET LOCAL lock_timeout='10s'");
  await transaction.unsafe("SET LOCAL search_path=pg_catalog,public");
  await transaction.unsafe(`SET LOCAL ROLE "${s.state.origin.ownerRole.replaceAll('"','""')}"`);
  await verifyIdentity(transaction,state);
  if(state.completion){
    const c=state.completion;
    const chain=await lockRuntimeCompletionChainInTransaction(transaction,c.requestId);
    if(!chain||chain.runtimeState!=="drained"||chain.terminationRequestId)refuse();
    await assertRuntimeCompletionManifestInTransactionV1(transaction,{requestId:c.requestId});
    await assertRuntimeCompletionEffectLeaseInTransaction(transaction,{requestId:c.requestId,effectKey:c.effectKey,ownerInstanceId:c.ownerInstanceId,leaseToken:c.leaseToken});
  }
  await verifyCompletion(transaction,state);
  const fence = Object.freeze({}) as OwnerRecoveryTransactionFenceV1;
  transactions.set(fence,{transaction,state,leases:[],originalLeaseDeadlines:[]});ownedTransactions.set(transaction,fence);return fence;
}
export async function assertOwnerRecoveryTransactionLiveV1(transaction: postgres.TransactionSql, fence: OwnerRecoveryTransactionFenceV1): Promise<Date> {
  const held = transactions.get(fence);if (!held || held.transaction !== transaction) refuse();
  await verifyIdentity(transaction,held.state);await verifyCompletion(transaction,held.state);
  for(const lease of held.leases)await verifyDeliveryLeaseV1(transaction,lease);
  const now=await readDatabaseWallClock(transaction,"RECOVERY_OWNER_DATABASE_TIME_UNAVAILABLE");
  if(held.originalLeaseDeadlines.some(deadline=>deadline<=now.getTime()))refuse();
  return now;
}
/** Only an actual entered transaction can select owner verification. Unknown
 * callers retain runtime checks; a revoked registered fence never falls back. */
export async function freshRecoveryTransactionVerifierModeV1(transaction:unknown):Promise<"owner"|"runtime"> {
  if((typeof transaction!=="object"||transaction===null)&&typeof transaction!=="function")return "runtime";
  const fence=ownedTransactions.get(transaction as object);if(!fence)return "runtime";
  const held=transactions.get(fence);if(!held||held.transaction!==transaction)refuse();
  await assertOwnerRecoveryTransactionLiveV1(held.transaction,fence);
  return "owner";
}
export async function assertOwnerRecoveryTransactionBeforeCommitV1(transaction: postgres.TransactionSql, fence: OwnerRecoveryTransactionFenceV1): Promise<void> {
  await assertOwnerRecoveryTransactionLiveV1(transaction,fence);
}

/** Shared lexical mutation bodies retain ordinary behavior; only an actual
 * entered owner transaction has a fence. Owner constructors require entry. */
export async function assertOwnerRecoveryMutationLiveIfOwnedV1(transaction: postgres.TransactionSql): Promise<void> {
  const fence=ownedTransactions.get(transaction);if(fence)await assertOwnerRecoveryTransactionLiveV1(transaction,fence);
}

// This supplements the existing canonical repository joins/locks; it never
// grants a lease or acquires a new prefix lock. Register only after the actual
// domain lock/validation, and re-read its DB-clock liveness before commit.
async function verifyDeliveryLeaseV1(transaction:postgres.TransactionSql,lease:DeliveryLeaseV1):Promise<void> {
  const rows=await transaction.unsafe<Array<{valid:boolean}>>(`SELECT
    delivery.revision_id=$2 AND delivery.owner_instance_id=$3 AND delivery.lease_token=$4
    AND delivery.state IN ('leased','attempt_reserved','running')
    AND delivery.lease_expires_at>clock_timestamp()
    AND recovery_case.current_revision_id=delivery.revision_id
    AND recovery_case.status IN ('open','repairing','evidencing')
    AND ($5::text IS NULL OR EXISTS(SELECT 1 FROM execution_attempts attempt
      WHERE attempt.attempt_id=$5 AND attempt.attempt_id=delivery.attempt_id
        AND attempt.claim_id=delivery.claim_id AND attempt.run_id=delivery.run_id AND attempt.story_id=delivery.story_id
        AND attempt.generation=$6 AND attempt.fence_token=$7
        AND attempt.disposition IN ('claimed','running') AND attempt.lease_expires_at>clock_timestamp())) AS valid
    FROM recovery_dispatch_deliveries delivery
    JOIN recovery_case_revisions revision ON revision.revision_id=delivery.revision_id
    JOIN recovery_cases recovery_case ON recovery_case.recovery_case_id=revision.recovery_case_id
    WHERE delivery.dispatch_id=$1`,[lease.dispatchId,lease.revisionId,lease.ownerInstanceId,lease.leaseToken,lease.attempt?.attemptId??null,lease.attempt?.generation??null,lease.attempt?.fenceToken??null]);
  if(rows.length!==1||rows[0]?.valid!==true)refuse();
}
export async function pinOwnerRecoveryDeliveryLeaseV1(transaction:postgres.TransactionSql,lease:DeliveryLeaseV1):Promise<void> {
  const fence=ownedTransactions.get(transaction);if(!fence)return;
  const held=transactions.get(fence);if(!held||held.transaction!==transaction)refuse();
  await assertOwnerRecoveryTransactionLiveV1(transaction,fence);
  await verifyDeliveryLeaseV1(transaction,lease);
  held.leases.push(Object.freeze({...lease,...(lease.attempt?{attempt:Object.freeze({...lease.attempt})}:{})}));
}

/** Exact locked original lease deadlines survive this transaction's own terminal
 * child transition. This neither renews a terminal attempt nor invents an active
 * post-settlement owner; canonical native/terminal tuple proofs remain required. */
export async function pinOwnerRecoveryOriginalLeaseDeadlinesV1(transaction:postgres.TransactionSql,deadlines:readonly (Date|string|null)[]):Promise<void>{
  const fence=ownedTransactions.get(transaction);if(!fence)return;
  const held=transactions.get(fence);if(!held||held.transaction!==transaction)refuse();
  const parsed=deadlines.map(value=>value===null?NaN:new Date(value).getTime());
  if(parsed.some(value=>!Number.isFinite(value)))refuse();
  held.originalLeaseDeadlines.push(...parsed);
  await assertOwnerRecoveryTransactionLiveV1(transaction,fence);
}
