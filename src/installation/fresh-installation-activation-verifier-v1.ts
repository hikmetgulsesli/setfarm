import { FRESH_INSTALLATION_ARTIFACT_CAPACITY_LIMITS_V1 } from "./fresh-installation-artifact-policy-v1.js";
import { fileURLToPath } from "node:url";
import {
  canonicalJsonStringify,
} from "../product-compiler/canonical-json.js";
import {
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  validateInternalProductionOwnerProducerManifestSetActivationCurrentV1,
  validateInternalProductionOwnerProducerManifestSetActivationReceiptV1,
  validateInternalProductionOwnerProducerManifestSetActivationHeadV1,
} from "../internal-production/owner-admission-v1.js";
import { parseFreshInstallationOriginV1 } from "./fresh-installation-origin-v1.js";
import { readFreshInstallationCatalogHashV1 } from "./fresh-installation-catalog-v1.js";
import {
  verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1,
  type FreshInstallationOwnerSourceSqlV1,
} from "./fresh-installation-owner-source-v1.js";
import type {
  FreshInstallationActivationStateV1,
  readFreshInstallationPreparedStateV1,
} from "./fresh-installation-records-v1.js";

export type FreshInstallationActivationVerificationModeV1 = "runtime" | "owner" | "reconcile-runtime";
type SchemaStateV1 = ReturnType<typeof readFreshInstallationPreparedStateV1>;
type RowV1 = Record<string, unknown>;

function refuse(): never { throw new Error("FRESH_INSTALLATION_ACTIVATED_DATABASE_UNVERIFIED"); }
function same(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}
function literal(value: string): string { return "'" + value.replaceAll("'", "''") + "'"; }
function canonicalBody(value: unknown): unknown {
  if (typeof value !== "string" || Buffer.byteLength(value) < 2 || Buffer.byteLength(value) > 65_536) refuse();
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || canonicalJsonStringify(parsed) !== value) refuse();
  return parsed;
}
async function one(sql: FreshInstallationOwnerSourceSqlV1, statement: string): Promise<RowV1> {
  const rows = await sql.unsafe<RowV1[]>(statement);
  if (rows.length !== 1 || !rows[0]) refuse();
  return rows[0];
}

/**
 * Verification only, always on the supplied actual transaction. The two state
 * assertions are the internal captured filesystem snapshots, not injected
 * observer/build/SQL callbacks. Parsed caller data alone confers no authority.
 *
 * runtime: acknowledged captured stage + current/session runtime role.
 * owner: prepared stage permitted + current owner role, private controller only.
 * reconcile-runtime: prepared stage permitted + current/session runtime role;
 * this mode only supports complete-state reconciliation, never admission.
 */
export async function verifyFreshInstallationActivatedDatabaseOnTransactionV1(
  sql: FreshInstallationOwnerSourceSqlV1,
  activation: FreshInstallationActivationStateV1,
  base: SchemaStateV1,
  mode: FreshInstallationActivationVerificationModeV1 = "runtime",
): Promise<void> {
  try {
    // This must be first: source tests cannot query a database or fabricate an
    // actual finalized build by handing the verifier synthetic snapshot data.
    if (!fileURLToPath(import.meta.url).endsWith(".js")) refuse();
    if (!["runtime", "owner", "reconcile-runtime"].includes(mode)) refuse();
    const prepared = activation.prepared;
    const origin = parseFreshInstallationOriginV1(base.origin);
    const authority = validateInternalProductionOwnerProducerSourceBuildAuthorityV1(prepared.sourceAuthority);
    const expectedCurrent = validateInternalProductionOwnerProducerManifestSetActivationCurrentV1(prepared.current);
    const ownerOid = base.ownerOid, runtimeOid = base.runtimeOid;
    const assertBase = base.assertUnchanged, assertActivation = activation.assertUnchanged;
    const unchanged = (): void => { assertBase(); assertActivation(); };
    if (!base.committed || (mode === "runtime" && (!activation.acknowledged || !activation.activatedPin))
      || authority.schema !== "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1"
      || !same(prepared.origin, origin) || !same(authority.origin, origin)
      || !same(prepared.schemaRecordPins, {
        "schema-prepared.json": base.baseRecordPins["schema-prepared.json"],
        "schema-committed.json": base.baseRecordPins["schema-committed.json"],
      })
      || expectedCurrent.currentRevision !== 1 || expectedCurrent.receipt.phase !== "A"
      || expectedCurrent.receipt.orderedSourceBuildAuthorities.length !== 1
      || !same(expectedCurrent.receipt.orderedSourceBuildAuthorities[0], {
        plan: "A", sourceBuildAuthorityRef: authority.sourceBuildAuthorityRef,
        sourceBuildAuthorityHash: authority.sourceBuildAuthorityHash,
      })) refuse();
    unchanged();
    const sourceBefore = await verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1(sql, origin, authority);
    unchanged();
    if (!same(sourceBefore, authority)) refuse();

    const roles = await one(sql, `SELECT count(*)=2
      AND bool_and(NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
        AND NOT r.rolreplication AND NOT r.rolbypassrls AND NOT r.rolinherit
        AND r.rolcanlogin=(r.rolname=${literal(origin.runtimeRole)}))
      AND bool_and(CASE WHEN r.rolname=${literal(origin.ownerRole)} THEN r.oid=${ownerOid}::oid ELSE r.oid=${runtimeOid}::oid END)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles p
        ON p.oid=m.member OR p.oid=m.roleid
        WHERE p.rolname IN (${literal(origin.ownerRole)},${literal(origin.runtimeRole)}))
      AND pg_catalog.has_database_privilege(${literal(origin.runtimeRole)},current_database(),'CONNECT')
      AND NOT pg_catalog.has_database_privilege(${literal(origin.runtimeRole)},current_database(),'CREATE')
      AND NOT pg_catalog.has_database_privilege(${literal(origin.runtimeRole)},current_database(),'TEMPORARY') AS valid,
      current_user::text AS current_role,session_user::text AS session_role
      FROM pg_catalog.pg_roles r WHERE r.rolname IN (${literal(origin.ownerRole)},${literal(origin.runtimeRole)})`);
    unchanged();
    const expectedRole = mode === "owner" ? origin.ownerRole : origin.runtimeRole;
    if (roles.valid !== true || roles.current_role !== expectedRole
      || (mode !== "owner" && roles.session_role !== origin.runtimeRole)) refuse();

    if (await readFreshInstallationCatalogHashV1(sql) !== prepared.catalogHash) refuse();
    unchanged();
    // Capacity policy is row data, so catalog equality alone cannot authenticate it.
    const capacity = await one(sql, `SELECT capacity_key,quota_bytes::text AS quota,
      max_payload_bytes::text AS payload,total_bytes::text AS total,reserved_bytes::text AS reserved,
      state,reconciled_at IS NOT NULL AS reconciled FROM public.artifact_capacity LIMIT 2`);
    const limits = FRESH_INSTALLATION_ARTIFACT_CAPACITY_LIMITS_V1;
    const total = Number(capacity.total), reserved = Number(capacity.reserved);
    if (capacity.capacity_key !== "semantic-artifacts" || capacity.quota !== String(limits.rootQuotaBytes)
      || capacity.payload !== String(limits.maxPayloadBytes) || capacity.state !== "ready"
      || capacity.reconciled !== true || !Number.isSafeInteger(total) || total < 0
      || !Number.isSafeInteger(reserved) || reserved < 0 || total + reserved > limits.rootQuotaBytes) refuse();
    unchanged();

    // A is the only supported fresh activation. Selecting all rows with LIMIT2
    // rejects extra/orphan nodes as well as missing/crossed target metadata.
    const sourceRow = await one(sql, `SELECT source_build_authority_ref,source_build_authority_hash,plan,manifest_hash,
      owner_category_registry_hash,owner_category_census_map_hash,canonical_body
      FROM public.internal_production_owner_producer_source_build_authorities_v1 LIMIT 2`);
    unchanged();
    const storedSource = validateInternalProductionOwnerProducerSourceBuildAuthorityV1(canonicalBody(sourceRow.canonical_body));
    if (!same(storedSource, authority) || sourceRow.source_build_authority_ref !== authority.sourceBuildAuthorityRef
      || sourceRow.source_build_authority_hash !== authority.sourceBuildAuthorityHash || sourceRow.plan !== authority.plan
      || sourceRow.manifest_hash !== authority.manifestHash
      || sourceRow.owner_category_registry_hash !== authority.ownerCategoryRegistryHash
      || sourceRow.owner_category_census_map_hash !== authority.ownerCategoryCensusMapHash) refuse();

    const activationRow = await one(sql, `SELECT activation_ref,activation_hash,phase,manifest_set_hash,
      owner_category_registry_hash,owner_category_census_map_hash,predecessor_activation_ref,predecessor_activation_hash,
      predecessor_head_ref,predecessor_head_hash,canonical_body
      FROM public.internal_production_owner_producer_manifest_set_activations_v1 LIMIT 2`);
    unchanged();
    const receipt = validateInternalProductionOwnerProducerManifestSetActivationReceiptV1(canonicalBody(activationRow.canonical_body));
    if (!same(receipt, expectedCurrent.receipt) || activationRow.activation_ref !== receipt.activationRef
      || activationRow.activation_hash !== receipt.activationHash || activationRow.phase !== receipt.phase
      || activationRow.manifest_set_hash !== receipt.manifestSetHash
      || activationRow.owner_category_registry_hash !== receipt.ownerCategoryRegistryHash
      || activationRow.owner_category_census_map_hash !== receipt.ownerCategoryCensusMapHash
      || activationRow.predecessor_activation_ref !== receipt.predecessorActivationRef
      || activationRow.predecessor_activation_hash !== receipt.predecessorActivationHash
      || activationRow.predecessor_head_ref !== receipt.predecessorHeadRef
      || activationRow.predecessor_head_hash !== receipt.predecessorHeadHash) refuse();

    const headRow = await one(sql, `SELECT head_ref,head_hash,phase,activation_ref,activation_hash,
      predecessor_head_ref,predecessor_head_hash,canonical_body
      FROM public.internal_production_owner_producer_manifest_activation_heads_v1 LIMIT 2`);
    unchanged();
    const head = validateInternalProductionOwnerProducerManifestSetActivationHeadV1(canonicalBody(headRow.canonical_body));
    if (!same(head, expectedCurrent.head) || headRow.head_ref !== head.headRef || headRow.head_hash !== head.headHash
      || headRow.phase !== head.phase || headRow.activation_ref !== head.activationRef
      || headRow.activation_hash !== head.activationHash || headRow.predecessor_head_ref !== head.predecessorHeadRef
      || headRow.predecessor_head_hash !== head.predecessorHeadHash) refuse();

    const currentRow = await one(sql, `SELECT singleton_key,current_revision::text AS revision,phase,
      activation_ref,activation_hash,head_ref,head_hash
      FROM public.internal_production_owner_producer_manifest_set_current_v1 LIMIT 2`);
    unchanged();
    if (currentRow.singleton_key !== true || currentRow.revision !== "1" || currentRow.phase !== "A"
      || currentRow.activation_ref !== receipt.activationRef || currentRow.activation_hash !== receipt.activationHash
      || currentRow.head_ref !== head.headRef || currentRow.head_hash !== head.headHash) refuse();

    const sourceAfter = await verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1(sql, origin, authority);
    unchanged();
    if (!same(sourceBefore, sourceAfter)) refuse();
  } catch { return refuse(); }
}
