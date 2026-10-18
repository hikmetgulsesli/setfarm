import type postgres from "postgres";
import path from "node:path";
import { lstat, mkdir, readdir, realpath } from "node:fs/promises";
import { readFreshInstallationPreparedStateV1 } from "./fresh-installation-records-v1.js";
import { verifyFreshInstallationDatabaseIdentityV1 } from "./fresh-installation-origin-v1.js";
import { FRESH_INSTALLATION_ARTIFACT_CAPACITY_LIMITS_V1 } from "./fresh-installation-artifact-policy-v1.js";
import { createArtifactIndex } from "../product-compiler/artifact-index.js";
import { createArtifactInventoryStoreV1 } from "../product-compiler/artifact-inventory-store.js";
import { bootstrapArtifactIndex } from "../product-compiler/indexed-artifact-publisher.js";

// Owner-transaction COMPONENT only, like the provenance/MC components. Parsing
// records and this component do not qualify a build or admit activation. The
// private activation controller authenticates the actual release and exact
// transaction, calls this before runtime business grants, and owns COMMIT.
// There are no connections, getSql(), injected callbacks, environment-derived
// roots/limits, inventory adoption, hybrid mode, or readiness receipts here.
const EMPTY_TABLES = Object.freeze([
  "semantic_artifacts", "run_artifact_refs", "product_packets",
  "artifact_publication_reservations", "artifact_publication_batches",
  "artifact_publication_batch_items", "artifact_publication_batch_plans",
  "artifact_publication_batch_plan_items",
]);
function refuse(): never { throw new Error("FRESH_INSTALLATION_ARTIFACT_BOOTSTRAP_REFUSED"); }

async function privateDirectory(directory: string): Promise<Readonly<{ dev: bigint; ino: bigint; uid: bigint; mode: bigint }>> {
  const info = await lstat(directory, { bigint: true });
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== BigInt(process.getuid!())
    || (info.mode & 0o7777n) !== 0o700n || await realpath(directory) !== directory) refuse();
  return Object.freeze({ dev: info.dev, ino: info.ino, uid: info.uid, mode: info.mode });
}

/** Real driver savepoints keep all bootstrap work inside the caller's COMMIT.
 * The existing index currently consumes only unsafe and callback-only begin.
 * Its broad Sql parameter requires this local bridge assertion; the actual
 * TransactionSql is never asserted to be a connection or exposed to callers.
 * Any future begin(options, callback) use refuses until separately implemented.
 */
function indexConnectionAdapter(transaction: postgres.TransactionSql): postgres.Sql {
  const adapter = {
    unsafe: transaction.unsafe.bind(transaction),
    begin(operation: unknown, unexpected?: unknown) {
      if (typeof operation !== "function" || unexpected !== undefined) refuse();
      return transaction.savepoint(operation as (sql: postgres.TransactionSql) => unknown);
    },
  };
  return adapter as unknown as postgres.Sql;
}

export async function installFreshInstallationEmptyArtifactIndexV1(
  transaction: postgres.TransactionSql,
  directory: string,
): Promise<void> {
  try {
    if (typeof directory !== "string" || !path.isAbsolute(directory)
      || directory !== path.normalize(directory) || directory.includes("\0")) refuse();
    const base = readFreshInstallationPreparedStateV1(directory, true);
    // Existing schema records bind this physical directory already. Preserve
    // ordinary /var -> /private/var spelling accepted by fresh provisioning.
    const canonicalDirectory = await realpath(directory);
    base.assertUnchanged();
    await verifyFreshInstallationDatabaseIdentityV1(transaction, base.origin);
    const roles = await transaction.unsafe<Array<{ valid: boolean }>>(`SELECT count(*)=2 AND bool_and(
      CASE WHEN rolname=$1 THEN oid=$3 AND NOT rolcanlogin ELSE oid=$4 AND rolcanlogin END
      AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
      AND NOT rolbypassrls AND NOT rolinherit)
      AND current_user=$1
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member IN ($3,$4) OR roleid IN ($3,$4)) AS valid
      FROM pg_catalog.pg_roles WHERE rolname IN ($1,$2)`,
      [base.origin.ownerRole, base.origin.runtimeRole, base.ownerOid, base.runtimeOid]);
    if (roles.length !== 1 || roles[0]?.valid !== true) refuse();
    base.assertUnchanged();
    const empty = await transaction.unsafe<Array<{ empty: boolean }>>(`SELECT ${EMPTY_TABLES
      .map(table => `NOT EXISTS(SELECT 1 FROM public.${table} LIMIT 1)`).join(" AND ")} AS empty`);
    if (empty.length !== 1 || empty[0]?.empty !== true) refuse();
    const initial = await transaction.unsafe<Array<{
      capacity_key: string; quota: string; payload: string; total: string; reserved: string;
      state: string; reconciled_at: unknown; diagnostic: string | null;
    }>>(`SELECT capacity_key,quota_bytes::text AS quota,max_payload_bytes::text AS payload,
      total_bytes::text AS total,reserved_bytes::text AS reserved,state,reconciled_at,diagnostic
      FROM public.artifact_capacity LIMIT 2`);
    const row = initial[0], limits = FRESH_INSTALLATION_ARTIFACT_CAPACITY_LIMITS_V1;
    if (initial.length !== 1 || !row || row.capacity_key !== "semantic-artifacts"
      || row.quota !== String(limits.rootQuotaBytes) || row.payload !== String(limits.maxPayloadBytes)
      || row.total !== "0" || row.reserved !== "0" || row.state !== "bootstrap_required"
      || row.reconciled_at !== null || row.diagnostic !== null) refuse();

    let artifactRoot = canonicalDirectory;
    const identities: Array<Readonly<{ directory: string; dev: bigint; ino: bigint; uid: bigint; mode: bigint }>> = [];
    for (const part of ["runtime", "product-compiler", "artifacts", "sha256"]) {
      artifactRoot = path.join(artifactRoot, part);
      try { await mkdir(artifactRoot, { mode: 0o700 }); }
      catch (error) { if ((error as { code?: string }).code !== "EEXIST") throw error; }
      identities.push(Object.freeze({ directory: artifactRoot, ...await privateDirectory(artifactRoot) }));
    }
    if ((await readdir(artifactRoot)).length !== 0) refuse();
    const adapter = indexConnectionAdapter(transaction);
    const index = createArtifactIndex(adapter);
    const { store, publicationAuthority } = createArtifactInventoryStoreV1({
      sql: adapter, artifactRoot, artifactLimits: limits,
      purpose: "inventory-adoption", publicationAuthorityMode: "standalone",
    });
    if (publicationAuthority !== "standalone") refuse();
    // The generic API sees the real complete filesystem snapshot. This fixed
    // fresh component rejects all nonempty inventories instead of adopting them.
    const bootstrapped = await bootstrapArtifactIndex({ index, store,
      quotaBytes: limits.rootQuotaBytes, maxPayloadBytes: limits.maxPayloadBytes });
    if (bootstrapped.artifacts.length !== 0 || bootstrapped.capacity.state !== "ready"
      || bootstrapped.capacity.quotaBytes !== limits.rootQuotaBytes
      || bootstrapped.capacity.maxPayloadBytes !== limits.maxPayloadBytes
      || bootstrapped.capacity.totalBytes !== 0 || bootstrapped.capacity.reservedBytes !== 0) refuse();
    for (const before of identities) {
      const after = await privateDirectory(before.directory);
      if (after.dev !== before.dev || after.ino !== before.ino || after.uid !== before.uid || after.mode !== before.mode) refuse();
    }
    if ((await readdir(artifactRoot)).length !== 0) refuse();
    await verifyFreshInstallationDatabaseIdentityV1(transaction, base.origin);
    base.assertUnchanged();
  } catch { return refuse(); }
}
