/**
 * Actual compiled-release source authority for fresh owner activation.
 *
 * Source-authority data is not an activation capability. The caller must obtain
 * expectedOrigin from its captured selected installation or privately registered
 * activation transaction, verify that context/record pins and actual role OIDs,
 * and preserve those checks around its own later effects. This module neither
 * selects an installation nor opens a connection, starts a transaction, grants
 * privileges, creates a database, publishes evidence, or admits a workflow.
 */
import { fileURLToPath } from "node:url";
import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  type FreshInstallationOwnerProducerSourceBuildAuthorityAV1,
} from "../internal-production/owner-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import {
  parseFreshInstallationOriginV1,
  verifyFreshInstallationDatabaseIdentityV1,
  type FreshInstallationOriginV1,
} from "./fresh-installation-origin-v1.js";

export type FreshInstallationOwnerSourceSqlV1 = Readonly<{
  unsafe<T extends Record<string, unknown>[]>(query: string): PromiseLike<T>;
}>;

type QualifiedSourceV1 = FreshInstallationOwnerProducerSourceBuildAuthorityAV1["setfarmSource"];
type FreshJournalRowV1 = {
  version: number;
  name: string;
  checksum: string;
  state: string;
  release_sha: string | null;
  verified_release_sha: string | null;
  verified: boolean;
};

function refuse(): never {
  // No original exception, credential, URL, filesystem path or caller object is
  // attached to the public failure.
  throw new Error("FRESH_INSTALLATION_OWNER_SOURCE_AUTHORITY_UNAVAILABLE");
}

function requireCompiledModule(): void {
  // A source checkout can qualify schema-only provisioning; it cannot qualify
  // operational activation. Refuse before observing a build or querying SQL.
  if (!fileURLToPath(import.meta.url).endsWith(".js")) refuse();
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function requireSourceForOrigin(source: QualifiedSourceV1, origin: FreshInstallationOriginV1): void {
  if (source.branch !== "main" || source.clean !== true
    || source.sha !== origin.sourceSha || source.originMainSha !== source.sha) refuse();
}

async function requireCurrentMigrationIdentity(origin: FreshInstallationOriginV1): Promise<void> {
  // Delayed import avoids introducing a static cycle through the schema-only
  // controller. This returns fixed source identities and performs no migration.
  const migrations = await import("../db/contract-spine-migrations.js");
  if (!sameCanonical(origin.migrations, migrations.getContractSpineCurrentHeadJournalIdentitiesV1())) refuse();
}

function createAuthority(
  origin: FreshInstallationOriginV1,
  setfarmSource: QualifiedSourceV1,
): FreshInstallationOwnerProducerSourceBuildAuthorityAV1 {
  const body = {
    schema: "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1",
    plan: "A",
    manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    origin,
    setfarmSource,
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  } as const;
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  const authority = validateInternalProductionOwnerProducerSourceBuildAuthorityV1({
    ...body,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`,
    sourceBuildAuthorityHash,
  });
  if (authority.schema !== "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1") refuse();
  return authority;
}

async function requireConnectedJournal(
  sql: FreshInstallationOwnerSourceSqlV1,
  origin: FreshInstallationOriginV1,
): Promise<void> {
  // The same caller-owned transaction/client is used throughout. No getSql(),
  // connection reopening, SET ROLE, locks, DDL or migration API is invoked here.
  await verifyFreshInstallationDatabaseIdentityV1(sql, origin);
  const rows = await sql.unsafe<FreshJournalRowV1[]>(
    `SELECT version,name,checksum,state,release_sha,verified_release_sha,
       verified_at IS NOT NULL AS verified
     FROM public.setfarm_schema_migrations ORDER BY version LIMIT 34`,
  );
  if (rows.length !== 33 || rows.some((row, index) => {
    const expected = origin.migrations[index];
    return !expected || row.version !== expected.version || row.name !== expected.name
      || row.checksum !== expected.checksum || row.state !== "applied"
      || row.release_sha !== origin.sourceSha || row.verified_release_sha !== origin.sourceSha
      || row.verified !== true;
  })) refuse();
  await verifyFreshInstallationDatabaseIdentityV1(sql, origin);
}

/**
 * Derives data from the real current clean-main finalized release. The origin is
 * snapshotted before the first await. No caller-supplied source/build observation
 * or synthetic legacy operation/PBA observation is accepted.
 *
 * This function does not authorize mutation or prove the caller's installation
 * context. Publication must also use the connected verifier below and the
 * controller's private transaction/context checks.
 */
export async function deriveFreshInstallationOwnerProducerSourceBuildAuthorityAV1(
  expectedOriginInput: FreshInstallationOriginV1,
): Promise<FreshInstallationOwnerProducerSourceBuildAuthorityAV1> {
  try {
    requireCompiledModule();
    const origin = parseFreshInstallationOriginV1(expectedOriginInput);
    const receipt = await import("../internal-production/baseline-post-handoff-receipt-v1.js");
    const before = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    requireSourceForOrigin(before, origin);
    await requireCurrentMigrationIdentity(origin);
    const after = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    requireSourceForOrigin(after, origin);
    if (!sameCanonical(before, after)) refuse();
    return createAuthority(origin, after);
  } catch {
    return refuse();
  }
}

/**
 * Reauthenticates stored authority data against a trusted expected origin, the
 * actual caller connection and the actual current finalized release. A parsed
 * JSON origin or an arbitrary SQL handle does not confer activation authority.
 *
 * No schema/catalog, role-OID, stage, private-record, transaction-capability or
 * workflow-readiness check is replaced by this focused source-authority check.
 */
export async function verifyFreshInstallationOwnerProducerSourceBuildAuthorityAV1(
  sql: FreshInstallationOwnerSourceSqlV1,
  expectedOriginInput: FreshInstallationOriginV1,
  authorityInput: unknown,
): Promise<FreshInstallationOwnerProducerSourceBuildAuthorityAV1> {
  try {
    requireCompiledModule();
    const origin = parseFreshInstallationOriginV1(expectedOriginInput);
    const authority = validateInternalProductionOwnerProducerSourceBuildAuthorityV1(authorityInput);
    if (authority.schema !== "setfarm.fresh-installation-owner-producer-source-build-authority-a.v1"
      || !sameCanonical(authority.origin, origin)) refuse();
    const receipt = await import("../internal-production/baseline-post-handoff-receipt-v1.js");
    const before = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    requireSourceForOrigin(before, origin);
    if (!sameCanonical(authority.setfarmSource, before)) refuse();
    await requireCurrentMigrationIdentity(origin);
    await requireConnectedJournal(sql, origin);
    const after = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
    requireSourceForOrigin(after, origin);
    if (!sameCanonical(before, after) || !sameCanonical(authority.setfarmSource, after)) refuse();
    return authority;
  } catch {
    return refuse();
  }
}
