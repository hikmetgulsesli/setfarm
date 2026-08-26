/**
 * PostgreSQL database layer for Setfarm.
 * Async API, PostgreSQL-only database layer.
 * Uses porsager/postgres (tagged template SQL).
 */
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeConfig } from "./runtime-config.js";
import {
  applyBootstrapMainClaimHandoffGuardedMigration32V1,
  applyContractSpineMigrations,
  auditAuthorityV3ContractSpineThroughMigration31V1,
  auditCurrentContractSpineAuthorityLedgersAtV31Data,
  inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1,
  verifyContractSpineMigrations,
  type BootstrapMainClaimHandoffGuardedMigration32ApplyResultV1,
} from "./db/contract-spine-migrations.js";
import type {
  BootstrapMainClaimHandoffGuardedMigration32EvidenceV1,
} from "./db/bootstrap-main-claim-handoff-v1-migration.js";
import {
  projectBootstrapMainClaimHandoffV1Schema,
  verifyBootstrapMainClaimHandoffV1Schema,
} from "./db/bootstrap-main-claim-handoff-v1-migration.js";
import { computeContractSpineMigrationChecksumV1 } from "./db/contract-spine-migration-checksum.js";
import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "./db/contract-spine-migration-digests.generated.js";
import { OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS } from "./db/operational-failure-cause-authority-v3-migration.js";
import type {
  PgTransactionSql as InternalProductionPgTransactionSql,
} from "./internal-production/owner-admission-v1.js";
import {
  createInternalProductionBoundOwnerReservationV1,
  createInternalProductionClaimCanonicalOwnerIdentityV1,
  createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
  createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1,
  createInternalProductionFindingCanonicalOwnerIdentityV1,
  createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
  createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1,
  createInternalProductionOwnerReservationCloseV1,
  createInternalProductionOwnerReservationV1,
  createInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  createInternalProductionGlobalOwnerAdmissionFenceV1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  createInternalProductionSourceRunLaunchTargetFamilyV1,
  createInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1,
  createInternalProductionTerminalOwnerAuthorityV1,
  createInternalProductionTerminationCanonicalOwnerIdentityV1,
  deriveInternalProductionTerminalOwnerAuthorityPairV1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  validateInternalProductionBoundOwnerReservationV1,
  validateInternalProductionCanonicalOwnerIdentityV1,
  validateInternalProductionOwnerProducerManifestSetActivationCurrentV1,
  validateInternalProductionOwnerProducerManifestSetActivationHeadV1,
  validateInternalProductionOwnerProducerManifestSetActivationReceiptV1,
  validateInternalProductionOwnerProducerManifestV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  validateInternalProductionOwnerReservationCloseV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  validateInternalProductionGlobalOwnerAdmissionFenceV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  validateInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionTerminalOwnerAuthorityV1,
  type InternalProductionBoundOwnerReservationV1,
  type InternalProductionCanonicalOwnerIdentityV1,
  type InternalProductionCompleteZeroOwnerCensusV1,
  type InternalProductionOwnerAdmissionControllerV1,
  type InternalProductionOwnerAdmissionRepositoryV1,
  type InternalProductionOwnerCategoryV1,
  type InternalProductionOwnerProducerManifestSetActivationCurrentV1,
  type InternalProductionOwnerProducerManifestSetActivationHeadPairV1,
  type InternalProductionOwnerProducerManifestSetActivationHeadV1,
  type InternalProductionOwnerProducerManifestSetActivationPairV1,
  type InternalProductionOwnerProducerManifestSetActivationPredecessorV1,
  type InternalProductionOwnerProducerManifestSetActivationReceiptV1,
  type InternalProductionOwnerProducerManifestV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityV1,
  type InternalProductionOwnerReservationCloseV1,
  type InternalProductionOwnerReservationV1,
  type InternalProductionRecoveryRestartOwnerAdmissionFenceInputV1,
  type InternalProductionRecoveryRestartOwnerAdmissionFenceResultV1,
  type InternalProductionRecoveryRestartTargetSetCloseV1,
  type InternalProductionGlobalOwnerAdmissionFenceV1,
  type InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1,
  type InternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  type InternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  type InternalProductionResolvedOwnerTerminalCloseInputV1,
  type InternalProductionTerminalOwnerAuthorityPairV1,
  type InternalProductionTerminalOwnerAuthorityV1,
} from "./internal-production/owner-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./product-compiler/canonical-json.js";
import {
  RuntimeCompletionEffectInputV1Schema,
  RuntimeCompletionPlanV1Schema,
} from "./execution/schemas/runtime-completion-plan-v1.js";

let _sql: ReturnType<typeof postgres> | null = null;
let _schemaReady = false;
let _schemaReadyPromise: Promise<void> | null = null;
let _isMigrating = false;
let _isolatedTestPgUrl: string | null = null;

const LEGACY_ISOLATED_TEST_DATABASE_V1 = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;
const P3_ISOLATED_TEST_DATABASE_V1 = /^setfarm_p3_[a-f0-9]{24}_(?:template|primary|clone_[a-f0-9]{12}|empty_[a-f0-9]{12})$/;

function isExactIsolatedTestDatabaseNameV1(database: string): boolean {
  return [LEGACY_ISOLATED_TEST_DATABASE_V1, P3_ISOLATED_TEST_DATABASE_V1]
    .filter((pattern) => pattern.test(database)).length === 1;
}

export function pgConfigureIsolatedTestDatabase(rawUrl: string): void {
  if (_sql || _schemaReady || _schemaReadyPromise || _isMigrating) {
    throw new Error("ISOLATED_TEST_DATABASE_ALREADY_CONNECTED");
  }
  const parsed = new URL(rawUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (
    !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    || !isExactIsolatedTestDatabaseNameV1(database)
  ) {
    throw new Error("ISOLATED_TEST_DATABASE_URL_REJECTED");
  }
  _isolatedTestPgUrl = parsed.toString();
}

function resolvePgUrl(): string {
  return _isolatedTestPgUrl ?? runtimeConfig.setfarmPgUrl;
}

function quoteIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function maintenanceUrlFor(rawUrl: string): { url: string; database: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, "")) || "postgres";
  if (!database || database === "postgres") return null;
  parsed.pathname = "/postgres";
  return { url: parsed.toString(), database };
}

async function ensureDatabaseExists(rawUrl: string): Promise<void> {
  const target = maintenanceUrlFor(rawUrl);
  if (!target) return;
  const admin = postgres(target.url, {
    max: 1,
    idle_timeout: 1,
    onnotice: () => {},
    connect_timeout: 5,
  });
  try {
    const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${target.database} LIMIT 1`;
    if (rows.length === 0) {
      await admin.unsafe(`CREATE DATABASE ${quoteIdent(target.database)}`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

function getSql() {
  if (!_sql) {
    const url = resolvePgUrl();
    _sql = postgres(url, {
      max: 50,
      idle_timeout: 5,
      onnotice: () => {},
      connect_timeout: 10,
    });
  }
  return _sql;
}

export { getSql };

type OwnerProducerSourceRowV1 = Readonly<{
  source_build_authority_ref: string;
  source_build_authority_hash: string;
  plan: string;
  manifest_hash: string;
  owner_category_registry_hash: string;
  owner_category_census_map_hash: string;
  canonical_body: string;
}>;

type OwnerProducerActivationRowV1 = Readonly<{
  activation_ref: string;
  activation_hash: string;
  phase: string;
  manifest_set_hash: string;
  owner_category_registry_hash: string;
  owner_category_census_map_hash: string;
  predecessor_activation_ref: string | null;
  predecessor_activation_hash: string | null;
  predecessor_head_ref: string | null;
  predecessor_head_hash: string | null;
  canonical_body: string;
}>;

type OwnerProducerHeadRowV1 = Readonly<{
  head_ref: string;
  head_hash: string;
  phase: string;
  activation_ref: string;
  activation_hash: string;
  predecessor_head_ref: string | null;
  predecessor_head_hash: string | null;
  canonical_body: string;
}>;
type OwnerProducerSourceCacheV1 = Map<string, InternalProductionOwnerProducerSourceBuildAuthorityV1>;

function strictCanonicalText(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") < 2 || Buffer.byteLength(value, "utf8") > 65_536) throw new Error(code);
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(code); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || canonicalJsonStringify(parsed) !== value) throw new Error(code);
  return parsed as Record<string, unknown>;
}

function exactObjectKeys(value: unknown, keys: readonly string[], code: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(code);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string") || JSON.stringify((ownKeys as string[]).sort()) !== JSON.stringify([...keys].sort())) throw new TypeError(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError(code);
  }
}

const P3_RESOLVED_CLOSE_INPUT_KEYS_V1 = Object.freeze([
  "reservationRef", "reservationHash", "terminalAuthorityRef", "terminalAuthorityHash",
] as const);

const OWNER_PRODUCER_REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OWNER_PRODUCER_CURRENT_SOURCE_DRIFT = Symbol("owner-producer-current-source-drift");
async function deriveCurrentOwnerProducerSourceAuthorityAForDatabaseV1() {
  const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js");
  const pba = await import("./internal-production/product-build-authority-v2-delivery-evidence-v1.js");
  const git = await import("./execution/v3-git-revision.js");
  const operation = await receipt.observePreparedInternalProductionCurrentEntryOperationV1();
  if (operation === null) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_CURRENT_ENTRY_UNAVAILABLE");
  }
  const source0 = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (source0.sha !== source0.originMainSha) throw OWNER_PRODUCER_CURRENT_SOURCE_DRIFT;
  const observation = await pba.observeCurrentProductBuildAuthorityV2DeliveryEvidenceV1();
  const response = pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(observation.response);
  if (
    canonicalJsonStringify(operation.controllerSource) !== canonicalJsonStringify(source0)
    || operation.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceRef !== response.deliveryEvidenceRef
    || operation.productBuildAuthorityV2DeliveryEvidence.deliveryEvidenceHash !== response.deliveryEvidenceHash
    || canonicalJsonStringify(operation.productBuildAuthorityV2Observation.response) !== canonicalJsonStringify(response)
  ) throw OWNER_PRODUCER_CURRENT_SOURCE_DRIFT;
  const vendorProducerCommit = response.evidence.vendorLock.producerCommit;
  const vendorRevision = git.captureV3GitCommitRevision({ repo: OWNER_PRODUCER_REPOSITORY_ROOT, commitSha: vendorProducerCommit });
  git.replayV3HistoricalGitCommitAncestryV1({ repo: OWNER_PRODUCER_REPOSITORY_ROOT, ancestorSha: vendorProducerCommit, descendantSha: source0.sha, expectedAncestorTreeHash: vendorRevision.treeHash, expectedDescendantTreeHash: source0.treeHash, expectedMergeBase: vendorProducerCommit });
  const source1 = receipt.observeCurrentInternalProductionCleanSetfarmSourceBuildV1();
  if (canonicalJsonStringify(source0) !== canonicalJsonStringify(source1)) throw OWNER_PRODUCER_CURRENT_SOURCE_DRIFT;
  const body = {
    schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1",
    plan: "A",
    manifestHash: INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    currentEntryOperationRef: operation.operationRef,
    currentEntryOperationHash: operation.operationHash,
    setfarmSource: source0,
    productBuildAuthorityV2DeliveryEvidenceRef: response.deliveryEvidenceRef,
    productBuildAuthorityV2DeliveryEvidenceHash: response.deliveryEvidenceHash,
    productBuildAuthorityV2Observation: observation,
    vendorProducerCommit,
    vendorProducerCommitAncestorProof: { schema: "setfarm.internal-production-vendor-ancestor-proof.v1", vendorProducerCommit, setfarmSourceSha: source0.sha, mergeBase: vendorProducerCommit, verified: true },
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  } as const;
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  const candidate = {
    ...body,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`,
    sourceBuildAuthorityHash,
  };
  const canonical = canonicalJsonStringify(candidate);
  const reparsed = JSON.parse(canonical) as unknown;
  if (canonicalJsonStringify(reparsed) !== canonical) throw OWNER_PRODUCER_CURRENT_SOURCE_DRIFT;
  return validateInternalProductionOwnerProducerSourceBuildAuthorityV1(reparsed);
}

async function resolveOwnerProducerSourceInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  pairInput: InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  cache?: OwnerProducerSourceCacheV1,
): Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1> {
  const pair = validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1(pairInput);
  const cacheKey = `${pair.plan}\u0000${pair.sourceBuildAuthorityRef}\u0000${pair.sourceBuildAuthorityHash}`;
  const cached = cache?.get(cacheKey);
  if (cached) return cached;
  const rows = await sql<OwnerProducerSourceRowV1[]>`
    SELECT source_build_authority_ref, source_build_authority_hash, plan, manifest_hash,
           owner_category_registry_hash, owner_category_census_map_hash, canonical_body
      FROM internal_production_owner_producer_source_build_authorities_v1
     WHERE source_build_authority_ref = ${pair.sourceBuildAuthorityRef}
       AND source_build_authority_hash = ${pair.sourceBuildAuthorityHash}
  `;
  if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_UNAVAILABLE");
  const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js");
  const pba = await import("./internal-production/product-build-authority-v2-delivery-evidence-v1.js");
  const git = await import("./execution/v3-git-revision.js");
  const row = rows[0]!;
  const authority = validateInternalProductionOwnerProducerSourceBuildAuthorityV1(strictCanonicalText(row.canonical_body, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION"));
  pba.parseProductBuildAuthorityV2DeliveryEvidenceResponseV1(
    authority.productBuildAuthorityV2Observation.response,
  );
  const operation = await receipt.resolveInternalProductionCurrentEntryOperationV1({
    operationRef: authority.currentEntryOperationRef,
    operationHash: authority.currentEntryOperationHash,
  });
  if (
    canonicalJsonStringify(operation.productBuildAuthorityV2Observation)
      !== canonicalJsonStringify(authority.productBuildAuthorityV2Observation)
    || canonicalJsonStringify(operation.controllerSource)
      !== canonicalJsonStringify(authority.setfarmSource)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION");
  const vendorRevision = git.captureV3GitCommitRevision({ repo: OWNER_PRODUCER_REPOSITORY_ROOT, commitSha: authority.vendorProducerCommit });
  const sourceRevision = git.captureV3GitCommitRevision({ repo: OWNER_PRODUCER_REPOSITORY_ROOT, commitSha: authority.setfarmSource.sha });
  if (sourceRevision.treeHash !== authority.setfarmSource.treeHash) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION");
  git.replayV3HistoricalGitCommitAncestryV1({
    repo: OWNER_PRODUCER_REPOSITORY_ROOT,
    ancestorSha: authority.vendorProducerCommit,
    descendantSha: authority.setfarmSource.sha,
    expectedAncestorTreeHash: vendorRevision.treeHash,
    expectedDescendantTreeHash: authority.setfarmSource.treeHash,
    expectedMergeBase: authority.vendorProducerCommitAncestorProof.mergeBase,
  });
  if (row.source_build_authority_ref !== authority.sourceBuildAuthorityRef || row.source_build_authority_hash !== authority.sourceBuildAuthorityHash || row.plan !== authority.plan || row.manifest_hash !== authority.manifestHash || row.owner_category_registry_hash !== authority.ownerCategoryRegistryHash || row.owner_category_census_map_hash !== authority.ownerCategoryCensusMapHash) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION");
  cache?.set(cacheKey, authority);
  return authority;
}

export async function resolveInternalProductionOwnerProducerSourceBuildAuthorityV1(
  pair: InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
): Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1> {
  return getSql().begin((sql) => resolveOwnerProducerSourceInTransactionV1(sql as InternalProductionPgTransactionSql, pair)) as unknown as Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1>;
}

async function resolveActivationInTransactionV1(sql: InternalProductionPgTransactionSql, pair: InternalProductionOwnerProducerManifestSetActivationPairV1, sourceCache?: OwnerProducerSourceCacheV1): Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1> {
  exactObjectKeys(pair, ["activationRef", "activationHash"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PAIR_INVALID");
  const rows = await sql<OwnerProducerActivationRowV1[]>`SELECT activation_ref, activation_hash, phase, manifest_set_hash, owner_category_registry_hash, owner_category_census_map_hash, predecessor_activation_ref, predecessor_activation_hash, predecessor_head_ref, predecessor_head_hash, canonical_body FROM internal_production_owner_producer_manifest_set_activations_v1 WHERE activation_ref=${pair.activationRef} AND activation_hash=${pair.activationHash}`;
  if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_UNAVAILABLE");
  const row = rows[0]!;
  const receipt = validateInternalProductionOwnerProducerManifestSetActivationReceiptV1(strictCanonicalText(row.canonical_body, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION"));
  if (row.activation_ref !== receipt.activationRef || row.activation_hash !== receipt.activationHash || row.phase !== receipt.phase || row.manifest_set_hash !== receipt.manifestSetHash || row.owner_category_registry_hash !== receipt.ownerCategoryRegistryHash || row.owner_category_census_map_hash !== receipt.ownerCategoryCensusMapHash || row.predecessor_activation_ref !== receipt.predecessorActivationRef || row.predecessor_activation_hash !== receipt.predecessorActivationHash || row.predecessor_head_ref !== receipt.predecessorHeadRef || row.predecessor_head_hash !== receipt.predecessorHeadHash) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
  for (const sourcePair of receipt.orderedSourceBuildAuthorities) await resolveOwnerProducerSourceInTransactionV1(sql, sourcePair, sourceCache);
  return receipt;
}

export async function resolveInternalProductionOwnerProducerManifestSetActivationV1(pair: InternalProductionOwnerProducerManifestSetActivationPairV1): Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1> {
  return getSql().begin(async (rawSql) => {
    const sql = rawSql as InternalProductionPgTransactionSql;
    const heads = await sql<Array<{ head_ref: string; head_hash: string }>>`SELECT head_ref, head_hash FROM internal_production_owner_producer_manifest_activation_heads_v1 WHERE activation_ref=${pair.activationRef} AND activation_hash=${pair.activationHash}`;
    if (heads.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    return (await resolveOwnerProducerActivationChainInTransactionV1(sql, pair, { headRef: heads[0]!.head_ref, headHash: heads[0]!.head_hash }, new Map())).receipt;
  }) as unknown as Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1>;
}

async function resolveHeadInTransactionV1(sql: InternalProductionPgTransactionSql, pair: InternalProductionOwnerProducerManifestSetActivationHeadPairV1): Promise<InternalProductionOwnerProducerManifestSetActivationHeadV1> {
  exactObjectKeys(pair, ["headRef", "headHash"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_PAIR_INVALID");
  const rows = await sql<OwnerProducerHeadRowV1[]>`SELECT head_ref, head_hash, phase, activation_ref, activation_hash, predecessor_head_ref, predecessor_head_hash, canonical_body FROM internal_production_owner_producer_manifest_activation_heads_v1 WHERE head_ref=${pair.headRef} AND head_hash=${pair.headHash}`;
  if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_UNAVAILABLE");
  const row = rows[0]!;
  const head = validateInternalProductionOwnerProducerManifestSetActivationHeadV1(strictCanonicalText(row.canonical_body, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_CORRUPTION"));
  if (row.head_ref !== head.headRef || row.head_hash !== head.headHash || row.phase !== head.phase || row.activation_ref !== head.activationRef || row.activation_hash !== head.activationHash || row.predecessor_head_ref !== head.predecessorHeadRef || row.predecessor_head_hash !== head.predecessorHeadHash) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_CORRUPTION");
  return head;
}

async function resolveOwnerProducerActivationChainInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  activationPair: InternalProductionOwnerProducerManifestSetActivationPairV1,
  headPair: InternalProductionOwnerProducerManifestSetActivationHeadPairV1,
  sourceCache: OwnerProducerSourceCacheV1,
  seen = new Set<string>(),
): Promise<Readonly<{
  receipt: InternalProductionOwnerProducerManifestSetActivationReceiptV1;
  head: InternalProductionOwnerProducerManifestSetActivationHeadV1;
  ancestry: readonly InternalProductionOwnerProducerManifestSetActivationPairV1[];
  nodes: readonly Readonly<{
    receipt: InternalProductionOwnerProducerManifestSetActivationReceiptV1;
    head: InternalProductionOwnerProducerManifestSetActivationHeadV1;
  }>[];
}>> {
  const identity = `${activationPair.activationRef}\u0000${activationPair.activationHash}\u0000${headPair.headRef}\u0000${headPair.headHash}`;
  if (seen.has(identity) || seen.size >= 5) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
  seen.add(identity);
  const receipt = await resolveActivationInTransactionV1(sql, activationPair, sourceCache);
  const head = await resolveHeadInTransactionV1(sql, headPair);
  if (
    head.activationRef !== receipt.activationRef
    || head.activationHash !== receipt.activationHash
    || head.phase !== receipt.phase
    || head.predecessorHeadRef !== receipt.predecessorHeadRef
    || head.predecessorHeadHash !== receipt.predecessorHeadHash
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
  if (receipt.predecessorActivationRef === null) {
    if (receipt.predecessorActivationHash !== null || receipt.predecessorHeadRef !== null || receipt.predecessorHeadHash !== null || head.predecessorHeadRef !== null || head.predecessorHeadHash !== null) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    return Object.freeze({
      receipt,
      head,
      ancestry: Object.freeze([{ activationRef: receipt.activationRef, activationHash: receipt.activationHash }]),
      nodes: Object.freeze([Object.freeze({ receipt, head })]),
    });
  }
  if (receipt.predecessorActivationHash === null || receipt.predecessorHeadRef === null || receipt.predecessorHeadHash === null) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
  const predecessor = await resolveOwnerProducerActivationChainInTransactionV1(
    sql,
    { activationRef: receipt.predecessorActivationRef, activationHash: receipt.predecessorActivationHash },
    { headRef: receipt.predecessorHeadRef, headHash: receipt.predecessorHeadHash },
    sourceCache,
    seen,
  );
  if (
    predecessor.receipt.activationRef !== receipt.predecessorActivationRef
    || predecessor.receipt.activationHash !== receipt.predecessorActivationHash
    || predecessor.head.headRef !== receipt.predecessorHeadRef
    || predecessor.head.headHash !== receipt.predecessorHeadHash
    || head.predecessorHeadRef !== predecessor.head.headRef
    || head.predecessorHeadHash !== predecessor.head.headHash
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
  return Object.freeze({
    receipt,
    head,
    ancestry: Object.freeze([
      { activationRef: receipt.activationRef, activationHash: receipt.activationHash },
      ...predecessor.ancestry,
    ]),
    nodes: Object.freeze([Object.freeze({ receipt, head }), ...predecessor.nodes]),
  });
}

export async function resolveInternalProductionOwnerProducerManifestSetActivationHeadV1(pair: InternalProductionOwnerProducerManifestSetActivationHeadPairV1): Promise<InternalProductionOwnerProducerManifestSetActivationHeadV1> {
  return getSql().begin(async (rawSql) => {
    const sql = rawSql as InternalProductionPgTransactionSql;
    const head = await resolveHeadInTransactionV1(sql, pair);
    return (await resolveOwnerProducerActivationChainInTransactionV1(sql, { activationRef: head.activationRef, activationHash: head.activationHash }, pair, new Map())).head;
  }) as unknown as Promise<InternalProductionOwnerProducerManifestSetActivationHeadV1>;
}

async function resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql: InternalProductionPgTransactionSql, lock = true, sourceCache: OwnerProducerSourceCacheV1 = new Map()): Promise<Readonly<{
  current: InternalProductionOwnerProducerManifestSetActivationCurrentV1;
  ancestry: readonly InternalProductionOwnerProducerManifestSetActivationPairV1[];
  nodes: readonly Readonly<{
    receipt: InternalProductionOwnerProducerManifestSetActivationReceiptV1;
    head: InternalProductionOwnerProducerManifestSetActivationHeadV1;
  }>[];
}> | null> {
  const rows = lock
    ? await sql<Array<{current_revision:string|number;phase:string|null;activation_ref:string|null;activation_hash:string|null;head_ref:string|null;head_hash:string|null}>>`SELECT current_revision, phase, activation_ref, activation_hash, head_ref, head_hash FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE FOR UPDATE`
    : await sql<Array<{current_revision:string|number;phase:string|null;activation_ref:string|null;activation_hash:string|null;head_ref:string|null;head_hash:string|null}>>`SELECT current_revision, phase, activation_ref, activation_hash, head_ref, head_hash FROM internal_production_owner_producer_manifest_set_current_v1 WHERE singleton_key=TRUE`;
  if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_CORRUPTION");
  const row = rows[0]!;
  const revision = Number(row.current_revision);
  const nullable = [row.phase,row.activation_ref,row.activation_hash,row.head_ref,row.head_hash];
  if (revision === 0 && nullable.every((member) => member === null)) return null;
  if (!Number.isSafeInteger(revision) || revision <= 0 || nullable.some((member) => member === null)) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_CORRUPTION");
  const chain = await resolveOwnerProducerActivationChainInTransactionV1(sql, {activationRef:row.activation_ref!,activationHash:row.activation_hash!}, {headRef:row.head_ref!,headHash:row.head_hash!}, sourceCache);
  const { receipt, head } = chain;
  if (row.phase !== receipt.phase || row.phase !== head.phase) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_CORRUPTION");
  return Object.freeze({
    current: validateInternalProductionOwnerProducerManifestSetActivationCurrentV1({currentRevision:revision,head,receipt}),
    ancestry: chain.ancestry,
    nodes: chain.nodes,
  });
}

export async function resolveCurrentInternalProductionOwnerProducerManifestSetActivationInTransactionV1(sql: InternalProductionPgTransactionSql): Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null> {
  return (await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql))?.current ?? null;
}

export async function resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1(): Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null> {
  return getSql().begin("isolation level repeatable read read only", async (sql) => (await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql as InternalProductionPgTransactionSql, false))?.current ?? null) as unknown as Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null>;
}

export type InternalProductionPostManifestOwnerCensusSnapshotV1 = Readonly<{
  census: Omit<InternalProductionCompleteZeroOwnerCensusV1,
    "ownedProcessCount" | "ownedListenerCount" | "ownedWorktreeCount" |
    "dirtyWorktreeCount" | "staleChildCount">;
  currentManifestActivation: InternalProductionOwnerProducerManifestSetActivationCurrentV1;
  reservationIdentitySetHash: string;
  ownerIdentitySetHash: string;
}>;

/**
 * The post-manifest database half of the complete owner census.  Unlike the
 * pre-manifest observer, this requires and authenticates the migration-32
 * sidecar and the current producer-manifest activation.  Physical process,
 * listener and worktree counts remain receipt-owned so both physical passes
 * can bracket this one repeatable-read snapshot.
 */
export async function observeInternalProductionPostManifestOwnerCensusSnapshotV1(
): Promise<InternalProductionPostManifestOwnerCensusSnapshotV1> {
  return getSql().begin("isolation level repeatable read read only", async (rawSql) => {
    const sql = rawSql as InternalProductionPgTransactionSql;
    const currentManifestActivation = (await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(
      sql,
      false,
    ))?.current ?? null;
    if (currentManifestActivation === null) {
      throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_MANIFEST_ACTIVATION_UNAVAILABLE");
    }
    const aggregates = await sql<Array<Record<string, unknown>>>`
      WITH aprb_child_violations AS (
        SELECT COUNT(*) AS count
          FROM artifact_publication_reservations reservation
         WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
           AND (SELECT COUNT(*)
                  FROM artifact_publication_batch_items item
                  JOIN artifact_publication_batches batch
                    ON batch.batch_reservation_id=item.batch_reservation_id
                   AND batch.state='active'
                 WHERE (item.reservation_id,item.artifact_hash)=
                       (reservation.reservation_id,reservation.artifact_hash)
                   AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
                   AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
                   AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)<>1
      ), ordinary_batch_violations AS (
        SELECT COUNT(*) AS count
          FROM artifact_publication_reservations reservation
          JOIN artifact_publication_batch_items item
            ON (item.reservation_id,item.artifact_hash)=
               (reservation.reservation_id,reservation.artifact_hash)
         WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)<>'APRB_'
      ), active_header_violations AS (
        SELECT COUNT(*) AS count
          FROM artifact_publication_batches batch
         WHERE batch.state='active' AND NOT EXISTS (
           SELECT 1
             FROM artifact_publication_batch_items item
             JOIN artifact_publication_reservations reservation
               ON (reservation.reservation_id,reservation.artifact_hash)=
                  (item.reservation_id,item.artifact_hash)
            WHERE item.batch_reservation_id=batch.batch_reservation_id
              AND reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_'
              AND reservation.owner_instance_id IS NOT DISTINCT FROM batch.owner_instance_id
              AND reservation.lease_token IS NOT DISTINCT FROM batch.lease_token
              AND reservation.lease_expires_at IS NOT DISTINCT FROM batch.lease_expires_at)
      )
      SELECT
        (SELECT count FROM aprb_child_violations)::text AS "aprbChildViolationCount",
        (SELECT count FROM ordinary_batch_violations)::text AS "ordinaryBatchViolationCount",
        (SELECT count FROM active_header_violations)::text AS "activeHeaderViolationCount",
        (SELECT COUNT(*) FROM runs WHERE status IN ('running','resuming','cancelling','failing'))::text AS "activeRunCount",
        (SELECT COUNT(*) FROM claim_log WHERE outcome IS NULL)::text AS "openClaimCount",
        (SELECT COUNT(*) FROM execution_attempts WHERE disposition IN ('claimed','running'))::text AS "executionAttemptCount",
        (SELECT COUNT(*) FROM runtime_sessions WHERE state NOT IN ('released','quarantined'))::text AS "activeRuntimeSessionCount",
        (SELECT COUNT(*) FROM runtime_completion_requests WHERE state NOT IN ('accepted','rejected','quarantined'))::text AS "activeCompletionOwnerCount",
        (SELECT COUNT(*) FROM runtime_completion_effects WHERE mandatory IS TRUE AND state NOT IN ('applied','reconciled'))::text AS "unsettledMandatoryEffectCount",
        (SELECT COUNT(*) FROM artifact_publication_reservations WHERE state='reserved' AND left(reservation_id,5)<>'APRB_')::text AS "artifactReservationCount",
        (SELECT COUNT(*) FROM artifact_publication_batches WHERE state='active')::text AS "publicationBatchCount",
        (SELECT COUNT(*) FROM artifact_publication_batch_items item
           JOIN artifact_publication_reservations reservation
             ON (reservation.reservation_id,reservation.artifact_hash)=(item.reservation_id,item.artifact_hash)
           JOIN artifact_publication_batches batch
             ON batch.batch_reservation_id=item.batch_reservation_id
          WHERE reservation.state='reserved' AND left(reservation.reservation_id,5)='APRB_' AND batch.state='active')::text AS "artifactPublicationCount",
        (SELECT COUNT(*) FROM run_termination_requests WHERE state<>'terminalized')::text AS "terminationOwnerCount",
        (SELECT COUNT(*) FROM findings WHERE status='open')::text AS "findingOwnerCount",
        ((SELECT COUNT(*) FROM recovery_cases WHERE status IN ('open','repairing','evidencing'))
          +(SELECT COUNT(*) FROM recovery_dispatch_deliveries WHERE state IN ('authorized','leased','attempt_reserved','running')))::text AS "recoveryOwnerCount",
        (SELECT COUNT(*) FROM operational_event_deliveries WHERE state IN ('pending','leased'))::text AS "operationalDeliveryCount"
    `;
    if (aggregates.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_DATABASE_CENSUS_CORRUPTION");
    }
    const aggregate = aggregates[0]!;
    const parseCount = (key: string): number => {
      const value = aggregate[key];
      if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) {
        throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_DATABASE_CENSUS_CORRUPTION");
      }
      const count = Number(value);
      if (!Number.isSafeInteger(count)) {
        throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_DATABASE_CENSUS_CORRUPTION");
      }
      return count;
    };
    for (const key of ["aprbChildViolationCount", "ordinaryBatchViolationCount", "activeHeaderViolationCount"] as const) {
      if (parseCount(key) !== 0) {
        throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_DATABASE_CENSUS_CORRUPTION");
      }
    }
    const openRows = await sql<OwnerReservationRowV1[]>`
      SELECT * FROM internal_production_owner_reservations_v1
       WHERE state IN ('pending','bound')
       ORDER BY category,producer_implementation_id,owner_key_hash,reservation_ref,reservation_hash
    `;
    const categoryCounts = new Map<InternalProductionOwnerCategoryV1, number>(
      INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.map((category) => [category, 0]),
    );
    const reservationIdentities: Array<Readonly<{
      category: InternalProductionOwnerCategoryV1;
      producerImplementationId: string;
      ownerKeyHash: string;
      reservationRef: string;
      reservationHash: string;
    }>> = [];
    const ownerIdentities: InternalProductionCanonicalOwnerIdentityV1[] = [];
    for (const row of openRows) {
      const producer = ownerProducerRowForImplementationV1(row.producer_implementation_id);
      if (!producer) throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_SIDECAR_CORRUPTION");
      const reservation = validateInternalProductionOwnerReservationV1(row.reservation_payload, producer);
      validateOwnerReservationStateShapeV1(row);
      if (
        reservation.category !== row.category
        || reservation.producerImplementationId !== row.producer_implementation_id
        || reservation.ownerKeyHash !== row.owner_key_hash
        || reservation.reservationRef !== row.reservation_ref
        || reservation.reservationHash !== row.reservation_hash
      ) throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_SIDECAR_CORRUPTION");
      categoryCounts.set(reservation.category, (categoryCounts.get(reservation.category) ?? 0) + 1);
      reservationIdentities.push(Object.freeze({
        category: reservation.category,
        producerImplementationId: reservation.producerImplementationId,
        ownerKeyHash: reservation.ownerKeyHash,
        reservationRef: reservation.reservationRef,
        reservationHash: reservation.reservationHash,
      }));
      if (row.state === "bound") {
        ownerIdentities.push(validateInternalProductionCanonicalOwnerIdentityV1(row.canonical_owner_identity));
      }
    }
    if (openRows.length !== 0 || reservationIdentities.length !== 0 || ownerIdentities.length !== 0 || [...categoryCounts.values()].some((count) => count !== 0)) {
      throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_SIDECAR_NONZERO");
    }
    const sidecarCensus = Object.fromEntries(
      INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.flatMap((category) => (
        INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category].map((key) => [key, categoryCounts.get(category) ?? 0])
      )),
    ) as Record<keyof InternalProductionCompleteZeroOwnerCensusV1, number>;
    const census = Object.freeze({
      ...sidecarCensus,
      activeRunCount: parseCount("activeRunCount"),
      openClaimCount: parseCount("openClaimCount"),
      executionAttemptCount: parseCount("executionAttemptCount"),
      activeRuntimeSessionCount: parseCount("activeRuntimeSessionCount"),
      activeCompletionOwnerCount: parseCount("activeCompletionOwnerCount"),
      unsettledMandatoryEffectCount: parseCount("unsettledMandatoryEffectCount"),
      artifactReservationCount: parseCount("artifactReservationCount"),
      publicationBatchCount: parseCount("publicationBatchCount"),
      artifactPublicationCount: parseCount("artifactPublicationCount"),
      terminationOwnerCount: parseCount("terminationOwnerCount"),
      findingOwnerCount: parseCount("findingOwnerCount"),
      recoveryOwnerCount: parseCount("recoveryOwnerCount"),
      operationalDeliveryCount: parseCount("operationalDeliveryCount"),
    });
    const {
      ownedProcessCount: _ownedProcessCount,
      ownedListenerCount: _ownedListenerCount,
      ownedWorktreeCount: _ownedWorktreeCount,
      dirtyWorktreeCount: _dirtyWorktreeCount,
      staleChildCount: _staleChildCount,
      ...databaseCensus
    } = census;
    const emptyIdentitySetHash = hashCanonicalJson([]);
    const reservationIdentitySetHash = hashCanonicalJson(reservationIdentities);
    const ownerIdentitySetHash = hashCanonicalJson(ownerIdentities);
    if (reservationIdentitySetHash !== emptyIdentitySetHash || ownerIdentitySetHash !== emptyIdentitySetHash) {
      throw new Error("INTERNAL_PRODUCTION_COMPLETE_OWNER_IDENTITY_SET_NONZERO");
    }
    return Object.freeze({
      census: Object.freeze(databaseCensus),
      currentManifestActivation,
      reservationIdentitySetHash,
      ownerIdentitySetHash,
    });
  }) as unknown as Promise<InternalProductionPostManifestOwnerCensusSnapshotV1>;
}

class OwnerProducerActivationSupersededError extends Error {
  readonly code = "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SUPERSEDED";
  constructor() { super("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SUPERSEDED"); }
}

async function activateInternalProductionOwnerProducerManifestSetCoreV1(input: Readonly<{
  expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
  manifests: readonly InternalProductionOwnerProducerManifestV1[];
  orderedSourceBuildAuthorities: readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
}>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1> {
  exactObjectKeys(input, ["expectedPredecessor", "manifests", "orderedSourceBuildAuthorities"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_INPUT_INVALID");
  if (!Array.isArray(input.manifests) || !Array.isArray(input.orderedSourceBuildAuthorities) || input.manifests.length !== 1 || input.orderedSourceBuildAuthorities.length !== 1) throw new TypeError("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PHASE_INVALID");
  const manifest = validateInternalProductionOwnerProducerManifestV1(input.manifests[0]);
  const sourcePair = validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1(input.orderedSourceBuildAuthorities[0]);
  if (manifest.plan !== "A" || sourcePair.plan !== "A" || input.expectedPredecessor !== null) throw new TypeError("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PHASE_INVALID");
  const result = await getSql().begin(async (rawSql) => {
    const sql = rawSql as InternalProductionPgTransactionSql;
    const sourceCache = new Map<string, InternalProductionOwnerProducerSourceBuildAuthorityV1>();
    let source: InternalProductionOwnerProducerSourceBuildAuthorityV1;
    try {
      source = await resolveOwnerProducerSourceInTransactionV1(sql, sourcePair, sourceCache);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_UNAVAILABLE") {
        throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
      }
      source = await deriveCurrentOwnerProducerSourceAuthorityAForDatabaseV1();
      if (source.sourceBuildAuthorityRef !== sourcePair.sourceBuildAuthorityRef || source.sourceBuildAuthorityHash !== sourcePair.sourceBuildAuthorityHash) throw OWNER_PRODUCER_CURRENT_SOURCE_DRIFT;
    }
    const manifestSetBody = { schema: "setfarm.internal-production-owner-producer-manifest-set.v1", phase: "A", orderedPlans: ["A"], orderedManifestHashes: [manifest.manifestHash], orderedSourceBuildAuthorities: [sourcePair], ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1, ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1 } as const;
    const receiptBody = { schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1", phase: "A", orderedPlans: ["A"], orderedManifestHashes: [manifest.manifestHash], orderedSourceBuildAuthorities: [sourcePair], manifestSetHash: hashCanonicalJson(manifestSetBody), ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1, ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1, predecessorActivationRef: null, predecessorActivationHash: null, predecessorHeadRef: null, predecessorHeadHash: null } as const;
    const activationHash = hashCanonicalJson(receiptBody);
    const receipt = validateInternalProductionOwnerProducerManifestSetActivationReceiptV1({ ...receiptBody, activationRef: `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`, activationHash });
    const headBody = { schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1", phase: "A", activationRef: receipt.activationRef, activationHash, predecessorHeadRef: null, predecessorHeadHash: null } as const;
    const headHash = hashCanonicalJson(headBody);
    const head = validateInternalProductionOwnerProducerManifestSetActivationHeadV1({ ...headBody, headRef: `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`, headHash });
    const currentResolution = await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql, true, sourceCache);
    const current = currentResolution?.current ?? null;
    const currentChainContainsTarget = currentResolution !== null && currentResolution.ancestry.some((pair) => pair.activationRef === receipt.activationRef && pair.activationHash === receipt.activationHash);
    const currentTargetNode = currentResolution?.nodes.find((node) => node.receipt.activationRef === receipt.activationRef && node.receipt.activationHash === receipt.activationHash);
    if (currentTargetNode !== undefined) {
      if (canonicalJsonStringify(currentTargetNode.receipt) !== canonicalJsonStringify(receipt) || canonicalJsonStringify(currentTargetNode.head) !== canonicalJsonStringify(head)) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
      if (current?.receipt.activationRef === receipt.activationRef && current.head.headRef === head.headRef) return { activationRef: receipt.activationRef, activationHash: receipt.activationHash };
      if (currentChainContainsTarget) throw new OwnerProducerActivationSupersededError();
      throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    }
    const activationRows = await sql<OwnerProducerActivationRowV1[]>`SELECT activation_ref, activation_hash, phase, manifest_set_hash, owner_category_registry_hash, owner_category_census_map_hash, predecessor_activation_ref, predecessor_activation_hash, predecessor_head_ref, predecessor_head_hash, canonical_body FROM internal_production_owner_producer_manifest_set_activations_v1 WHERE activation_ref=${receipt.activationRef}`;
    const headRows = await sql<OwnerProducerHeadRowV1[]>`SELECT head_ref, head_hash, phase, activation_ref, activation_hash, predecessor_head_ref, predecessor_head_hash, canonical_body FROM internal_production_owner_producer_manifest_activation_heads_v1 WHERE head_ref=${head.headRef}`;
    if (activationRows.length > 1 || headRows.length > 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    const hasActivation = activationRows.length === 1;
    const hasHead = headRows.length === 1;
    if (hasActivation !== hasHead) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    if (hasActivation) {
      const exactReceipt = await resolveActivationInTransactionV1(sql, { activationRef: receipt.activationRef, activationHash: receipt.activationHash }, sourceCache);
      const exactHead = await resolveHeadInTransactionV1(sql, { headRef: head.headRef, headHash: head.headHash });
      if (canonicalJsonStringify(exactReceipt) !== canonicalJsonStringify(receipt) || canonicalJsonStringify(exactHead) !== canonicalJsonStringify(head)) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
      throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    }
    if (current !== null) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    await sql`INSERT INTO internal_production_owner_producer_source_build_authorities_v1 (source_build_authority_ref,source_build_authority_hash,plan,manifest_hash,owner_category_registry_hash,owner_category_census_map_hash,canonical_body) VALUES (${source.sourceBuildAuthorityRef},${source.sourceBuildAuthorityHash},${source.plan},${source.manifestHash},${source.ownerCategoryRegistryHash},${source.ownerCategoryCensusMapHash},${canonicalJsonStringify(source)}) ON CONFLICT (source_build_authority_ref) DO NOTHING`;
    const adoptedSource = await resolveOwnerProducerSourceInTransactionV1(sql, sourcePair, sourceCache);
    if (canonicalJsonStringify(adoptedSource) !== canonicalJsonStringify(source)) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_CORRUPTION");
    await sql`INSERT INTO internal_production_owner_producer_manifest_set_activations_v1 (activation_ref,activation_hash,phase,manifest_set_hash,owner_category_registry_hash,owner_category_census_map_hash,predecessor_activation_ref,predecessor_activation_hash,predecessor_head_ref,predecessor_head_hash,canonical_body) VALUES (${receipt.activationRef},${receipt.activationHash},${receipt.phase},${receipt.manifestSetHash},${receipt.ownerCategoryRegistryHash},${receipt.ownerCategoryCensusMapHash},${receipt.predecessorActivationRef},${receipt.predecessorActivationHash},${receipt.predecessorHeadRef},${receipt.predecessorHeadHash},${canonicalJsonStringify(receipt)})`;
    await sql`INSERT INTO internal_production_owner_producer_manifest_activation_heads_v1 (head_ref,head_hash,phase,activation_ref,activation_hash,predecessor_head_ref,predecessor_head_hash,canonical_body) VALUES (${head.headRef},${head.headHash},${head.phase},${head.activationRef},${head.activationHash},${head.predecessorHeadRef},${head.predecessorHeadHash},${canonicalJsonStringify(head)})`;
    const updated = await sql`UPDATE internal_production_owner_producer_manifest_set_current_v1 SET current_revision=current_revision+1,phase=${receipt.phase},activation_ref=${receipt.activationRef},activation_hash=${receipt.activationHash},head_ref=${head.headRef},head_hash=${head.headHash} WHERE singleton_key=TRUE AND current_revision=0 AND phase IS NULL AND activation_ref IS NULL AND activation_hash IS NULL AND head_ref IS NULL AND head_hash IS NULL RETURNING current_revision`;
    if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
    return { activationRef: receipt.activationRef, activationHash: receipt.activationHash };
  });
  return result as InternalProductionOwnerProducerManifestSetActivationPairV1;
}

function validateOwnerProducerActivationInputV1(input: Readonly<{
  expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
  manifests: readonly InternalProductionOwnerProducerManifestV1[];
  orderedSourceBuildAuthorities: readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
}>): void {
  exactObjectKeys(input, ["expectedPredecessor", "manifests", "orderedSourceBuildAuthorities"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_INPUT_INVALID");
  if (!Array.isArray(input.manifests) || !Array.isArray(input.orderedSourceBuildAuthorities) || input.manifests.length !== 1 || input.orderedSourceBuildAuthorities.length !== 1) throw new TypeError("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PHASE_INVALID");
  const manifest = validateInternalProductionOwnerProducerManifestV1(input.manifests[0]);
  const sourcePair = validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1(input.orderedSourceBuildAuthorities[0]);
  if (manifest.plan !== "A" || sourcePair.plan !== "A" || input.expectedPredecessor !== null) throw new TypeError("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PHASE_INVALID");
}

export async function activateInternalProductionOwnerProducerManifestSetV1(input: Readonly<{
  expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
  manifests: readonly InternalProductionOwnerProducerManifestV1[];
  orderedSourceBuildAuthorities: readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
}>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1> {
  validateOwnerProducerActivationInputV1(input);
  try {
    return await activateInternalProductionOwnerProducerManifestSetCoreV1(input);
  } catch (error) {
    if (error instanceof OwnerProducerActivationSupersededError) throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SUPERSEDED");
    throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CORRUPTION");
  }
}

export async function activateInternalProductionBaselineOwnerProducerManifestAFromControllerV1(input: Readonly<{
  sourceBuildAuthority: InternalProductionOwnerProducerSourceBuildAuthorityPairV1;
}>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1> {
  try {
    exactObjectKeys(input, ["sourceBuildAuthority"], "INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_INPUT_INVALID");
    const sourceBuildAuthority = validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1(input.sourceBuildAuthority);
    if (sourceBuildAuthority.plan !== "A") throw new TypeError("INTERNAL_PRODUCTION_BASELINE_OWNER_PRODUCER_ACTIVATION_INPUT_INVALID");
    return await activateInternalProductionOwnerProducerManifestSetCoreV1({
      expectedPredecessor: null,
      manifests: [INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1],
      orderedSourceBuildAuthorities: [sourceBuildAuthority],
    });
  } catch (error) {
    if (error === OWNER_PRODUCER_CURRENT_SOURCE_DRIFT) throw new Error("CURRENT_SOURCE_DRIFT");
    if (error instanceof OwnerProducerActivationSupersededError) throw new Error("SUPERSEDED");
    throw new Error("CORRUPTION");
  }
}

type OwnerReservationRowV1 = Readonly<{
  reservation_ref: string;
  reservation_hash: string;
  category: string;
  owner_key: string;
  owner_key_hash: string;
  producer_purpose_hash: string;
  producer_implementation_id: string;
  producer_implementation_hash: string;
  reservation_payload: unknown;
  reservation_head_predecessor_hash: string;
  state: string;
  canonical_owner_identity: unknown | null;
  binding_hash: string | null;
  binding_payload: unknown | null;
  close_kind: string | null;
  terminal_owner_ref: string | null;
  terminal_owner_hash: string | null;
  close_head_predecessor_hash: string | null;
  close_head_successor_hash: string | null;
  preserved_fence_ref: string | null;
  preserved_fence_hash: string | null;
  close_ref: string | null;
  close_hash: string | null;
  close_payload: unknown | null;
  head_version: string | number;
}>;

type OwnerAdmissionAuthorityRowV1 = Readonly<{
  authority_ref: string;
  authority_hash: string;
  authority_kind: string;
  phase_key: string;
  predecessor_head_hash: string;
  successor_head_hash: string;
  authority_body: unknown;
}>;

type OwnerAdmissionHeadRowV1 = Readonly<{
  head_version: string | number;
  head_hash: string;
  active_fence_ref: string | null;
  active_fence_hash: string | null;
  active_target_family_hash: string | null;
  migration_application_evidence_hash: string;
  head_payload: unknown;
}>;

type OwnerAdmissionMigrationApplicationV1 = Readonly<{
  schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1";
  evidenceHash: string;
  authorizationRef: string;
  authorizationHash: string;
  authorizationConsumptionRef: string;
  authorizationConsumptionHash: string;
  applicationHash: string;
}>;

type OwnerAdmissionAdvancingAuthorityV1 = Readonly<{
  version: number;
  authority: OwnerAdmissionAuthorityRowV1;
}>;

const OWNER_ADMISSION_SHA256_V1 = /^[a-f0-9]{64}$/;
const OWNER_ADMISSION_REF_V1 = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const WORKFLOW_RUN_TERMINAL_STATUSES_V1 = Object.freeze([
  "completed", "failed", "cancelled",
] as const);
type WorkflowRunTerminalStatusV1 = typeof WORKFLOW_RUN_TERMINAL_STATUSES_V1[number];
const WORKFLOW_RUN_MANIFEST_A_HASH_V1 =
  "6cf01b73fab3004670c98f71ef0c2ac9ee4852f697cfbd976d359807f65abf17";
const RUN_PERSISTENCE_READINESS_MODULE_SPECIFIER_V1 = "./internal-production/baseline-spawner-startup-admission-v1.js";
const RUN_PERSISTENCE_READINESS_REQUIRED_EXPORTS_V1 = Object.freeze([
  "observeInternalProductionPreSchemaSpawnerRebindStatusV1",
  "resolveInternalProductionTask0SpawnerAdmissionReadyV1",
] as const);
const RUN_PERSISTENCE_READINESS_DECLARED_EXTRA_EXPORTS_V1 = Object.freeze([
  "prepareInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
  "executeOrRecoverInternalProductionPreSchemaSpawnerRebindV1",
  "resolveInternalProductionPreSchemaSpawnerRebindAuthorizationV1",
  "resolveInternalProductionPreSchemaSpawnerRebindStatusV1",
  "resolveInternalProductionPreSchemaSpawnerStartupTokenV1",
  "resolveInternalProductionPreSchemaSpawnerRestartAuthorityV1",
  "resolveInternalProductionPreSchemaSpawnerPredecessorTerminationObservationV1",
  "resolveInternalProductionPreSchemaSpawnerReplacementProcessObservationV1",
  "resolveInternalProductionPreSchemaSpawnerSealedAdmissionV1",
] as const);
const RUN_PERSISTENCE_READINESS_ALLOWED_EXPORTS_V1 = new Set<string>([
  ...RUN_PERSISTENCE_READINESS_REQUIRED_EXPORTS_V1,
  ...RUN_PERSISTENCE_READINESS_DECLARED_EXTRA_EXPORTS_V1,
]);
type RunPersistenceReadinessModuleV1 = Readonly<{
  observeInternalProductionPreSchemaSpawnerRebindStatusV1: () => Promise<unknown>;
  resolveInternalProductionTask0SpawnerAdmissionReadyV1: (pair: unknown) => Promise<unknown>;
}>;

function validateInternalProductionRunPersistenceReadinessModuleNamespaceV1(
  loaded: unknown,
): RunPersistenceReadinessModuleV1 {
  if (loaded === null || (typeof loaded !== "object" && typeof loaded !== "function")) {
    throw new Error("RUN_PERSISTENCE_READINESS_MODULE_NAMESPACE_INVALID");
  }
  const namespace = loaded as Readonly<Record<string, unknown>>;
  const ownKeys = Reflect.ownKeys(namespace);
  const ownExports = ownKeys.filter((name): name is string => typeof name === "string");
  const symbols = ownKeys.filter((name): name is symbol => typeof name === "symbol");
  const module = namespace as unknown as RunPersistenceReadinessModuleV1;
  if (
    symbols.some((name) => name !== Symbol.toStringTag)
    || RUN_PERSISTENCE_READINESS_REQUIRED_EXPORTS_V1.some((name) => !ownExports.includes(name))
    || ownExports.some((name) => !RUN_PERSISTENCE_READINESS_ALLOWED_EXPORTS_V1.has(name))
    || ownExports.some((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(namespace, name);
      return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
    })
    || typeof module.observeInternalProductionPreSchemaSpawnerRebindStatusV1 !== "function"
    || module.observeInternalProductionPreSchemaSpawnerRebindStatusV1.length !== 0
    || typeof module.resolveInternalProductionTask0SpawnerAdmissionReadyV1 !== "function"
    || module.resolveInternalProductionTask0SpawnerAdmissionReadyV1.length !== 1
  ) throw new Error("RUN_PERSISTENCE_READINESS_MODULE_NAMESPACE_INVALID");
  return module;
}
const WORKFLOW_RUN_OWNER_BEGIN_PROVENANCE_SETTING_V1 =
  "setfarm.workflow_run_owner_begin_provenance_v1";
const RUN_PERSISTENCE_MIGRATION_31_FENCE_V1 = Object.freeze({
  version: 31 as const,
  name: "031_operational_failure_cause_authority_v3" as const,
  checksum: computeContractSpineMigrationChecksumV1({
    version: 31,
    name: "031_operational_failure_cause_authority_v3",
    statements: OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS,
    implementationDigest: CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS[31],
  }),
});

function isRecursivelyFrozenV1(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return true;
  const object = value as object;
  if (seen.has(object) || !Object.isFrozen(object)) return false;
  seen.add(object);
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    if (!descriptor || !("value" in descriptor) || !isRecursivelyFrozenV1(descriptor.value, seen)) {
      return false;
    }
  }
  seen.delete(object);
  return true;
}

function decodeCanonicalWorkflowRunIdSegmentV1(encodedRunId: string): string {
  try {
    if (!encodedRunId || encodedRunId.includes("/")) throw new Error();
    const decoded = decodeURIComponent(encodedRunId);
    if (!decoded || encodeURIComponent(decoded) !== encodedRunId) throw new Error();
    return decoded;
  } catch {
    throw new TypeError("INTERNAL_PRODUCTION_WORKFLOW_RUN_REF_INVALID");
  }
}

function encodeCanonicalWorkflowRunIdSegmentV1(runId: string): string {
  if (typeof runId !== "string" || runId.length === 0) {
    throw new TypeError("INTERNAL_PRODUCTION_WORKFLOW_RUN_ID_INVALID");
  }
  try {
    const encoded = encodeURIComponent(runId);
    if (decodeCanonicalWorkflowRunIdSegmentV1(encoded) !== runId) throw new Error();
    return encoded;
  } catch {
    throw new TypeError("INTERNAL_PRODUCTION_WORKFLOW_RUN_ID_INVALID");
  }
}

export function createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(
  runId: string,
): InternalProductionCanonicalOwnerIdentityV1<"run"> {
  const encodedRunId = encodeCanonicalWorkflowRunIdSegmentV1(runId);
  return Object.freeze({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: runId,
    ownerRef: `setfarm://runs/${encodedRunId}`,
    ownerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-workflow-run-owner.v1",
      runId,
    }),
  });
}

function validateOwnerAdmissionPairV1(
  input: unknown,
  refKey: string,
  hashKey: string,
  code: string,
): Readonly<Record<string, string>> {
  exactObjectKeys(input, [refKey, hashKey], code);
  const pair = input as Record<string, unknown>;
  if (
    typeof pair[refKey] !== "string"
    || !OWNER_ADMISSION_REF_V1.test(pair[refKey])
    || typeof pair[hashKey] !== "string"
    || !OWNER_ADMISSION_SHA256_V1.test(pair[hashKey])
  ) throw new TypeError(code);
  return Object.freeze({ [refKey]: pair[refKey], [hashKey]: pair[hashKey] } as Record<string, string>);
}

function ownerProducerRowForImplementationV1(implementationId: string) {
  return INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.rows.find(
    (row) => row.implementationId === implementationId,
  );
}

function sameJsonValueV1(left: unknown, right: unknown): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

function validateOwnerAdmissionMigrationApplicationV1(
  value: unknown,
  evidenceHash: string,
): OwnerAdmissionMigrationApplicationV1 {
  exactObjectKeys(value, [
    "schema", "evidenceHash", "authorizationRef", "authorizationHash",
    "authorizationConsumptionRef", "authorizationConsumptionHash", "applicationHash",
  ], "INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  const application = value as Record<string, unknown>;
  const hashes = [
    application.evidenceHash,
    application.authorizationHash,
    application.authorizationConsumptionHash,
    application.applicationHash,
  ];
  if (
    application.schema !== "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1"
    || application.evidenceHash !== evidenceHash
    || !OWNER_ADMISSION_SHA256_V1.test(evidenceHash)
    || evidenceHash === "0".repeat(64)
    || hashes.some((hash) => typeof hash !== "string" || !OWNER_ADMISSION_SHA256_V1.test(hash))
    || typeof application.authorizationRef !== "string"
    || !OWNER_ADMISSION_REF_V1.test(application.authorizationRef)
    || typeof application.authorizationConsumptionRef !== "string"
    || !OWNER_ADMISSION_REF_V1.test(application.authorizationConsumptionRef)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  const body = {
    schema: application.schema,
    evidenceHash: application.evidenceHash,
    authorizationRef: application.authorizationRef,
    authorizationHash: application.authorizationHash,
    authorizationConsumptionRef: application.authorizationConsumptionRef,
    authorizationConsumptionHash: application.authorizationConsumptionHash,
  };
  if (application.applicationHash !== hashCanonicalJson(body)) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  return Object.freeze({ ...body, applicationHash: application.applicationHash }) as OwnerAdmissionMigrationApplicationV1;
}

function validateReservationRowV1(
  row: OwnerReservationRowV1,
  authority: OwnerAdmissionAuthorityRowV1,
): InternalProductionOwnerReservationV1 {
  const producer = ownerProducerRowForImplementationV1(row.producer_implementation_id);
  if (!producer) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  const reservation = validateInternalProductionOwnerReservationV1(row.reservation_payload, producer);
  if (
    row.reservation_ref !== reservation.reservationRef
    || row.reservation_hash !== reservation.reservationHash
    || row.category !== reservation.category
    || row.owner_key !== reservation.ownerKey
    || row.owner_key_hash !== reservation.ownerKeyHash
    || row.producer_purpose_hash !== reservation.producerPurposeHash
    || row.producer_implementation_id !== reservation.producerImplementationId
    || row.producer_implementation_hash !== reservation.producerImplementationHash
    || row.reservation_head_predecessor_hash !== reservation.ownerAdmissionHeadPredecessorHash
    || authority.authority_ref !== reservation.reservationRef
    || authority.authority_hash !== reservation.reservationHash
    || authority.authority_kind !== "reservation"
    || authority.phase_key !== reservation.reservationRef
    || authority.predecessor_head_hash !== reservation.ownerAdmissionHeadPredecessorHash
    || !sameJsonValueV1(authority.authority_body, reservation)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  return reservation;
}

function validateOwnerReservationStateShapeV1(row: OwnerReservationRowV1): void {
  const bindingMembers = [
    row.canonical_owner_identity,
    row.binding_hash,
    row.binding_payload,
  ];
  const requiredCloseMembers = [
    row.close_kind,
    row.terminal_owner_ref,
    row.terminal_owner_hash,
    row.close_head_predecessor_hash,
    row.close_head_successor_hash,
    row.close_ref,
    row.close_hash,
    row.close_payload,
  ];
  const optionalFenceIsPair = (row.preserved_fence_ref === null)
    === (row.preserved_fence_hash === null);
  const valid = optionalFenceIsPair && (
    (row.state === "pending"
      && bindingMembers.every((member) => member === null)
      && requiredCloseMembers.every((member) => member === null)
      && row.preserved_fence_ref === null)
    || (row.state === "bound"
      && bindingMembers.every((member) => member !== null)
      && requiredCloseMembers.every((member) => member === null)
      && row.preserved_fence_ref === null)
    || (row.state === "closed"
      && bindingMembers.every((member) => member !== null)
      && requiredCloseMembers.every((member) => member !== null))
  );
  if (!valid) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
}

async function resolveOwnerReservationInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ reservationRef: string; reservationHash: string }>,
  lock = false,
): Promise<InternalProductionOwnerReservationV1> {
  const pair = validateOwnerAdmissionPairV1(
    input,
    "reservationRef",
    "reservationHash",
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_PAIR_INVALID",
  );
  const rows = lock
    ? await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${pair.reservationRef} AND reservation_hash=${pair.reservationHash} FOR UPDATE`
    : await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${pair.reservationRef} AND reservation_hash=${pair.reservationHash}`;
  const authorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${pair.reservationRef} AND authority_hash=${pair.reservationHash}`;
  if (rows.length !== 1 || authorities.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE");
  }
  const row = rows[0]!;
  const authority = authorities[0]!;
  const reservation = validateReservationRowV1(row, authority);
  validateOwnerReservationStateShapeV1(row);
  const headVersion = Number(row.head_version);
  if (!Number.isSafeInteger(headVersion) || headVersion <= 0) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  }
  const migrationApplication = await resolveOwnerAdmissionMigrationApplicationV1(sql);
  const ancestryHeadHash = row.state === "closed"
    ? row.close_head_successor_hash
    : authority.successor_head_hash;
  if (typeof ancestryHeadHash !== "string") {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  }
  let ancestry: readonly OwnerAdmissionAdvancingAuthorityV1[];
  try {
    ancestry = await validateOwnerAdmissionAncestryToGenesisV1(
      sql,
      ancestryHeadHash,
      headVersion,
      migrationApplication,
    );
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  }
  const reservationEdges = ancestry.filter(({ authority: edge }) => (
    edge.authority_kind === "reservation"
    && edge.authority_ref === reservation.reservationRef
    && edge.authority_hash === reservation.reservationHash
  ));
  if (reservationEdges.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  }
  const reservationSuccessorVersion = reservationEdges[0]!.version;
  const containingFenceEdges = ancestry.filter(({ version: edgeVersion, authority: edge }) => {
    if (edgeVersion !== reservationSuccessorVersion || edge.authority_kind !== "fence" || edge.successor_head_hash !== authority.successor_head_hash || edge.predecessor_head_hash !== authority.predecessor_head_hash) return false;
    try {
      const fence = validateInternalProductionGlobalOwnerAdmissionFenceV1(edge.authority_body);
      return fence.targetFamily.kind === "source-run-launch" && [fence.targetFamily.sourceRunReservation, fence.targetFamily.runReservation].some((target) => target.reservationRef === reservation.reservationRef && target.reservationHash === reservation.reservationHash);
    } catch { return false; }
  });
  if (containingFenceEdges.length === 0) {
    const expectedSuccessor = ownerAdmissionSuccessorV1({
      version: reservationSuccessorVersion - 1,
      predecessorHeadHash: reservation.ownerAdmissionHeadPredecessorHash,
      transitionKind: "reservation",
      transitionRef: reservation.reservationRef,
      transitionHash: reservation.reservationHash,
      migrationApplication,
    });
    if (expectedSuccessor.version !== reservationSuccessorVersion || authority.successor_head_hash !== expectedSuccessor.hash) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
    }
  } else if (
    containingFenceEdges.length !== 1
    || authority.predecessor_head_hash !== reservation.ownerAdmissionHeadPredecessorHash
    || headVersion !== reservationSuccessorVersion
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  try {
    if (row.state === "bound") {
      await validateBoundOwnerReservationRowV1(sql, row, reservation);
    } else if (row.state === "closed") {
      if (row.close_payload === null || row.close_ref === null || row.close_hash === null) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
      }
      const close = validateInternalProductionOwnerReservationCloseV1(row.close_payload);
      const closeAuthorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${row.close_ref} AND authority_hash=${row.close_hash}`;
      if (closeAuthorities.length !== 1) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
      }
      await validateClosedOwnerReservationRowV1(
        sql,
        row,
        reservation,
        close,
        closeAuthorities[0]!,
      );
    }
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  }
  return reservation;
}

async function validateBoundOwnerReservationRowV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
>(
  sql: InternalProductionPgTransactionSql,
  row: OwnerReservationRowV1,
  reservation: InternalProductionOwnerReservationV1,
): Promise<InternalProductionBoundOwnerReservationV1<Category>> {
  if (
    (row.state !== "bound" && row.state !== "closed")
    || row.canonical_owner_identity === null
    || row.binding_hash === null
    || row.binding_payload === null
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  const identity = validateInternalProductionCanonicalOwnerIdentityV1<Category>(
    row.canonical_owner_identity,
  );
  const bound = validateInternalProductionBoundOwnerReservationV1<Category>(row.binding_payload);
  const expectedBindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
  const authorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${expectedBindingRef} AND authority_hash=${bound.bindingHash}`;
  const reservationAuthorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${reservation.reservationRef} AND authority_hash=${reservation.reservationHash}`;
  const authority = authorities[0];
  const reservationAuthority = reservationAuthorities[0];
  if (
    authorities.length !== 1
    || reservationAuthorities.length !== 1
    || !authority
    || !reservationAuthority
    || row.binding_hash !== bound.bindingHash
    || !sameJsonValueV1(identity, bound.canonicalOwnerIdentity)
    || bound.category !== reservation.category
    || bound.producerImplementationId !== reservation.producerImplementationId
    || bound.ownerKey !== reservation.ownerKey
    || bound.reservationRef !== reservation.reservationRef
    || bound.reservationHash !== reservation.reservationHash
    || authority.authority_kind !== "binding"
    || authority.phase_key !== reservation.reservationRef
    || authority.predecessor_head_hash !== reservationAuthority.successor_head_hash
    || authority.successor_head_hash !== reservationAuthority.successor_head_hash
    || !sameJsonValueV1(authority.authority_body, bound)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  return bound;
}

async function resolveOwnerAdmissionMigrationApplicationV1(
  sql: InternalProductionPgTransactionSql,
): Promise<OwnerAdmissionMigrationApplicationV1> {
  const rows = await sql<Array<{
    migration_application_evidence_hash: string;
    head_payload: unknown;
  }>>`SELECT migration_application_evidence_hash,head_payload FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE`;
  if (rows.length !== 1 || !rows[0] || !rows[0].head_payload || typeof rows[0].head_payload !== "object") {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  const payload = rows[0].head_payload as Record<string, unknown>;
  try {
    return validateOwnerAdmissionMigrationApplicationV1(
      payload.migrationApplication,
      rows[0].migration_application_evidence_hash,
    );
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
}

async function validateClosedOwnerReservationRowV1(
  sql: InternalProductionPgTransactionSql,
  row: OwnerReservationRowV1,
  reservation: InternalProductionOwnerReservationV1,
  close: InternalProductionOwnerReservationCloseV1,
  authority: OwnerAdmissionAuthorityRowV1,
): Promise<InternalProductionBoundOwnerReservationV1> {
  const bound = await validateBoundOwnerReservationRowV1(sql, row, reservation);
  const headVersion = Number(row.head_version);
  if (!Number.isSafeInteger(headVersion) || headVersion <= 0) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  }
  const migrationApplication = await resolveOwnerAdmissionMigrationApplicationV1(sql);
  const transition = {
    schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
    reservationRef: close.reservationRef,
    reservationHash: close.reservationHash,
    terminalOwnerRef: close.terminalOwnerRef,
    terminalOwnerHash: close.terminalOwnerHash,
  };
  const transitionHash = hashCanonicalJson(transition);
  const expectedSuccessor = ownerAdmissionSuccessorV1({
    version: headVersion - 1,
    predecessorHeadHash: close.ownerAdmissionHeadPredecessorHash,
    transitionKind: "close",
    transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${transitionHash}`,
    transitionHash,
    migrationApplication,
  });
  if (
    row.state !== "closed"
    || row.close_kind !== close.closeKind
    || row.reservation_ref !== close.reservationRef
    || row.reservation_hash !== close.reservationHash
    || row.terminal_owner_ref !== close.terminalOwnerRef
    || row.terminal_owner_hash !== close.terminalOwnerHash
    || row.close_head_predecessor_hash !== close.ownerAdmissionHeadPredecessorHash
    || row.close_head_successor_hash !== close.ownerAdmissionHeadSuccessorHash
    || row.preserved_fence_ref !== close.preservedFenceRef
    || row.preserved_fence_hash !== close.preservedFenceHash
    || row.close_ref !== close.closeRef
    || row.close_hash !== close.closeHash
    || close.ownerAdmissionHeadSuccessorHash !== expectedSuccessor.hash
    || authority.authority_ref !== close.closeRef
    || authority.authority_hash !== close.closeHash
    || authority.authority_kind !== "close"
    || authority.phase_key !== close.reservationRef
    || authority.predecessor_head_hash !== close.ownerAdmissionHeadPredecessorHash
    || authority.successor_head_hash !== close.ownerAdmissionHeadSuccessorHash
    || !sameJsonValueV1(authority.authority_body, close)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  try {
    await validateOwnerAdmissionAncestryToGenesisV1(
      sql,
      expectedSuccessor.hash,
      headVersion,
      migrationApplication,
    );
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  }
  return bound;
}

async function resolveOwnerCloseInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ closeRef: string; closeHash: string }>,
): Promise<InternalProductionOwnerReservationCloseV1> {
  const pair = validateOwnerAdmissionPairV1(
    input,
    "closeRef",
    "closeHash",
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PAIR_INVALID",
  );
  const rows = await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE close_ref=${pair.closeRef} AND close_hash=${pair.closeHash}`;
  const authorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${pair.closeRef} AND authority_hash=${pair.closeHash}`;
  if (rows.length !== 1 || authorities.length !== 1 || rows[0]!.close_payload === null) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_UNAVAILABLE");
  }
  const row = rows[0]!;
  const authority = authorities[0]!;
  const close = validateInternalProductionOwnerReservationCloseV1(row.close_payload);
  let reservation: InternalProductionOwnerReservationV1;
  try {
    reservation = await resolveOwnerReservationInTransactionV1(sql, {
      reservationRef: close.reservationRef,
      reservationHash: close.reservationHash,
    });
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  }
  let bound: InternalProductionBoundOwnerReservationV1;
  try {
    bound = await validateClosedOwnerReservationRowV1(
      sql,
      row,
      reservation,
      close,
      authority,
    );
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  }
  const resolver = OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1[reservation.category];
  if (!resolver) throw new Error("TERMINAL_AUTHORITY_UNAVAILABLE");
  const p3InputProjector = P3_TERMINAL_EXACT_INPUT_PROJECTORS_V1[reservation.category];
  const exactInput = p3InputProjector?.(bound.canonicalOwnerIdentity);
  const terminal = validateInternalProductionTerminalOwnerAuthorityV1(
    await resolver.resolveByTerminalOwnerPair(sql, {
      terminalOwnerRef: close.terminalOwnerRef,
      terminalOwnerHash: close.terminalOwnerHash,
    }, exactInput),
  );
  if (
    terminal.category !== bound.category
    || terminal.ownerKey !== bound.ownerKey
    || terminal.ownerRef !== bound.canonicalOwnerIdentity.ownerRef
    || terminal.ownerHash !== bound.canonicalOwnerIdentity.ownerHash
    || terminal.terminalOwnerRef !== close.terminalOwnerRef
    || terminal.terminalOwnerHash !== close.terminalOwnerHash
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  return close;
}

async function resolveActiveOwnerProducerV1(
  sql: InternalProductionPgTransactionSql,
  implementationId: string,
) {
  if (typeof implementationId !== "string" || implementationId.length === 0) {
    throw new TypeError("INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_ID_INVALID");
  }
  const producer = ownerProducerRowForImplementationV1(implementationId);
  if (!producer) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE");
  }
  let currentResolution: Awaited<ReturnType<typeof resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1>>;
  try {
    currentResolution = await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql);
  } catch (error) {
    if (implementationId === "a-runtime-run-v1") {
      throw new Error("RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID");
    }
    throw error;
  }
  const current = currentResolution?.current ?? null;
  const planIndex = current?.receipt.orderedPlans.indexOf("A") ?? -1;
  if (
    current === null
    || planIndex < 0
    || current.receipt.orderedManifestHashes[planIndex]
      !== INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash
  ) {
    throw new Error(implementationId === "a-runtime-run-v1"
      ? "RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID"
      : "INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_UNAVAILABLE");
  }
  if (producer.plan === "A") await requireWorkflowRunAdmissionReadyV1(currentResolution);
  return producer;
}

async function requireWorkflowRunAdmissionReadyV1(
  currentResolution: Awaited<ReturnType<typeof resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1>>,
): Promise<void> {
  if (!currentResolution) throw new Error("RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID");
  const aNodes = currentResolution.nodes.filter(({ receipt }) => (
    receipt.phase === "A"
    && sameJsonValueV1(receipt.orderedPlans, ["A"])
    && sameJsonValueV1(receipt.orderedManifestHashes, [WORKFLOW_RUN_MANIFEST_A_HASH_V1])
  ));
  if (
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash !== WORKFLOW_RUN_MANIFEST_A_HASH_V1
    || aNodes.length !== 1
  ) throw new Error("RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID");
  const aNode = aNodes[0]!;
  let module: RunPersistenceReadinessModuleV1;
  let status: Record<string, unknown>;
  try {
    const loaded = await import(RUN_PERSISTENCE_READINESS_MODULE_SPECIFIER_V1);
    module = validateInternalProductionRunPersistenceReadinessModuleNamespaceV1(loaded);
    const observed = await module.observeInternalProductionPreSchemaSpawnerRebindStatusV1();
    if (
      !isRecursivelyFrozenV1(observed)
      || observed === null
      || typeof observed !== "object"
      || (observed as Record<string, unknown>).state !== "normal_task0_admission_ready"
      || (observed as Record<string, unknown>).admissionReady === null
      || typeof (observed as Record<string, unknown>).admissionReady !== "object"
    ) throw new Error();
    status = observed as Record<string, unknown>;
  } catch {
    throw new Error("RUN_PERSISTENCE_ADMISSION_READY_UNAVAILABLE");
  }
  try {
    const admissionReady = status.admissionReady as Record<string, unknown>;
    const ready = await module.resolveInternalProductionTask0SpawnerAdmissionReadyV1(status.admissionReady);
    if (
      !isRecursivelyFrozenV1(ready)
      || ready === null
      || typeof ready !== "object"
      || (ready as Record<string, unknown>).state !== "normal-task0-admission-ready"
    ) throw new Error();
    const body = ready as Record<string, unknown>;
    if (
      body.admissionReadyRef !== admissionReady.admissionReadyRef
      || body.admissionReadyHash !== admissionReady.admissionReadyHash
      || body.manifestActivationRef !== aNode.receipt.activationRef
      || body.manifestActivationHash !== aNode.receipt.activationHash
      || body.manifestHeadRef !== aNode.head.headRef
      || body.manifestHeadHash !== aNode.head.headHash
    ) throw new Error();
  } catch {
    throw new Error("RUN_PERSISTENCE_ADMISSION_READY_IDENTITY_INVALID");
  }
}

type InternalProductionCompletionBootstrapHeadLockModeV1 = "target" | "release" | "ordinary-target-adoption";
type InternalProductionCompletionBootstrapHeadLockContextV1 = Readonly<{
  mode: InternalProductionCompletionBootstrapHeadLockModeV1;
  requestId: string;
  targetGuardReceiptRef?: string;
  targetGuardReceiptHash?: string;
  operationRef?: string;
  operationHash?: string;
  producerImplementationId?: string;
}>;
const internalProductionCompletionBootstrapHeadLockContextsV1 = new WeakMap<object, InternalProductionCompletionBootstrapHeadLockContextV1>();

const INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RESULT_KEYS_V1 = Object.freeze([
  "schema", "state", "targetGuardReceiptRef", "targetGuardReceiptHash", "operationRef", "operationHash",
  "targetGuardConsumptionRef", "targetGuardConsumptionHash", "recoveredOwnerGenerationHash",
  "targetOwnerReleaseReceiptHash", "sequenceRef", "sequenceHash",
] as const);

function validateInternalProductionCompletionBootstrapBarrierResultV1(value: unknown): Record<string, unknown> {
  exactObjectKeys(value, INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RESULT_KEYS_V1, "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RESULT_CORRUPTION");
  const result = value as Record<string, unknown>;
  const state = String(result.state);
  const sha = (member: unknown): member is string => typeof member === "string" && OWNER_ADMISSION_SHA256_V1.test(member);
  const pair = (ref: unknown, hash: unknown, prefix: string): boolean => sha(hash) && ref === `${prefix}${hash}`;
  if (
    result.schema !== "setfarm.internal-production-baseline-spawner-bootstrap-completion-result.v1"
    || !["guard_prepared", "operation_bound", "guard_consumed", "owner_recovered", "owner_released", "completed"].includes(state)
    || !pair(result.targetGuardReceiptRef, result.targetGuardReceiptHash, "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/")
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RESULT_CORRUPTION");
  const operationPresent = pair(result.operationRef, result.operationHash, "setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/");
  const consumptionPresent = pair(result.targetGuardConsumptionRef, result.targetGuardConsumptionHash, "setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-consumption/sha256/");
  const recoveredPresent = sha(result.recoveredOwnerGenerationHash);
  const releasePresent = sha(result.targetOwnerReleaseReceiptHash);
  const sequencePresent = pair(result.sequenceRef, result.sequenceHash, "setfarm://internal-production/baseline-spawner-bootstrap-restart-sequence/sha256/");
  if (
    (state === "guard_prepared" && (result.operationRef !== null || result.operationHash !== null || result.targetGuardConsumptionRef !== null || result.targetGuardConsumptionHash !== null || result.recoveredOwnerGenerationHash !== null || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "operation_bound" && (!operationPresent || result.targetGuardConsumptionRef !== null || result.targetGuardConsumptionHash !== null || result.recoveredOwnerGenerationHash !== null || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "guard_consumed" && (!operationPresent || !consumptionPresent || result.recoveredOwnerGenerationHash !== null || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "owner_recovered" && (!operationPresent || !consumptionPresent || !recoveredPresent || result.targetOwnerReleaseReceiptHash !== null || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "owner_released" && (!operationPresent || !consumptionPresent || !recoveredPresent || !releasePresent || result.sequenceRef !== null || result.sequenceHash !== null))
    || (state === "completed" && (!operationPresent || !consumptionPresent || !recoveredPresent || !releasePresent || !sequencePresent))
  ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RESULT_CORRUPTION");
  return result;
}

async function observeInternalProductionCompletionBootstrapHeadBarrierV1(
  sql: InternalProductionPgTransactionSql,
): Promise<void> {
  const rows = await sql<Array<{
    request_id: string; request_state: string; apply_phase: string; runtime_session_state: string | null; bootstrap_result: unknown; bootstrap_state: string;
    target_guard_receipt_ref: string | null; target_guard_receipt_hash: string | null; operation_ref: string | null; operation_hash: string | null;
    reservation_ref: string | null; reservation_hash: string | null; reservation_state: string | null; producer_implementation_id: string | null;
    owner_key: string | null; owner_key_hash: string | null; reservation_payload: unknown; canonical_owner_identity: unknown;
  }>>`
    SELECT request.request_id,request.state AS request_state,request.apply_phase,session.state AS runtime_session_state,
           request.result->'internalProductionBaselineSpawnerBootstrap' AS bootstrap_result,
           request.result->'internalProductionBaselineSpawnerBootstrap'->>'state' AS bootstrap_state,
           request.result->'internalProductionBaselineSpawnerBootstrap'->>'targetGuardReceiptRef' AS target_guard_receipt_ref,
           request.result->'internalProductionBaselineSpawnerBootstrap'->>'targetGuardReceiptHash' AS target_guard_receipt_hash,
           request.result->'internalProductionBaselineSpawnerBootstrap'->>'operationRef' AS operation_ref,
           request.result->'internalProductionBaselineSpawnerBootstrap'->>'operationHash' AS operation_hash,
           reservation.reservation_ref,reservation.reservation_hash,reservation.state AS reservation_state,
           reservation.producer_implementation_id,reservation.owner_key,reservation.owner_key_hash,
           reservation.reservation_payload,reservation.canonical_owner_identity
      FROM runtime_completion_requests request
      LEFT JOIN runtime_sessions session ON session.session_id=request.runtime_session_id
      LEFT JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.category='completion-owner' AND reservation.owner_key=request.request_id
       AND reservation.state IN ('pending','bound')
     WHERE request.result ? 'internalProductionBaselineSpawnerBootstrap'
     ORDER BY request.request_id,reservation.reservation_ref
  `;
  const context = internalProductionCompletionBootstrapHeadLockContextsV1.get(sql as unknown as object);
  const active: Array<{ request_id: string; bootstrap_state: string; reservation_ref: string; reservation_hash: string }> = [];
  for (const row of rows) {
    const result = validateInternalProductionCompletionBootstrapBarrierResultV1(row.bootstrap_result);
    if (result.state !== row.bootstrap_state) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RESULT_CORRUPTION");
    const terminal = row.bootstrap_state === "owner_released" || row.bootstrap_state === "completed";
    if (terminal) {
      if (row.request_state !== "accepted" || row.runtime_session_state !== "released" || row.reservation_ref !== null) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TERMINAL_OWNER_CORRUPTION");
      continue;
    }
    const expectedIdentity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId: row.request_id });
    const expectedOwnerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-owner-key.v1", ownerKeyDerivationId: "completion-request-id-v1", ownerKey: row.request_id });
    const reservationPayload = row.reservation_payload as Record<string, unknown> | null;
    const releaseClosePrefix = context?.mode === "release" && context.requestId === row.request_id && row.bootstrap_state === "owner_recovered" && row.request_state === "accepted" && row.runtime_session_state === "released";
    if (context?.mode === "release" && context.requestId === row.request_id && (row.target_guard_receipt_ref !== context.targetGuardReceiptRef || row.target_guard_receipt_hash !== context.targetGuardReceiptHash || row.operation_ref !== context.operationRef || row.operation_hash !== context.operationHash)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RELEASE_CAUSAL_CHAIN_CROSSED");
    if (
      ((!releaseClosePrefix && (row.request_state !== "processing" || row.runtime_session_state !== "drained")) || row.apply_phase !== "effects_committed")
      || row.reservation_ref === null || row.reservation_hash === null || row.reservation_state !== "bound"
      || row.producer_implementation_id !== "a-completion-owner-v1" || row.owner_key !== row.request_id || row.owner_key_hash !== expectedOwnerKeyHash
      || !reservationPayload || reservationPayload.ownerKey !== row.request_id || reservationPayload.ownerKeyHash !== expectedOwnerKeyHash
      || !sameJsonValueV1(row.canonical_owner_identity, expectedIdentity)
    ) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    active.push({ request_id: row.request_id, bootstrap_state: row.bootstrap_state, reservation_ref: row.reservation_ref, reservation_hash: row.reservation_hash });
  }
  if (new Set(active.map((row) => row.request_id)).size !== active.length) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
  if (!context) {
    if (active.length !== 0) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_COMPLETION_BOOTSTRAP_FENCED");
    return;
  }
  if (context.mode === "target") {
    if (active.length > 1 || (active.length === 1 && active[0]!.request_id !== context.requestId)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_HEAD_BARRIER_CROSSED");
    return;
  }
  if (context.mode === "ordinary-target-adoption") {
    if (active.length === 0) return;
    if (context.producerImplementationId !== "a-completion-owner-v1" || active.length !== 1 || active[0]!.request_id !== context.requestId) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_ADOPTION_CROSSED");
    return;
  }
  if (active.length !== 1 || active[0]!.request_id !== context.requestId || active[0]!.bootstrap_state !== "owner_recovered") throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RELEASE_HEAD_BARRIER_CROSSED");
}

async function lockOwnerAdmissionHeadV1(
  sql: InternalProductionPgTransactionSql,
  activeFencePolicy: "absent" | "present" | "either" = "absent",
): Promise<Readonly<{
  version: number;
  hash: string;
  migrationApplication: OwnerAdmissionMigrationApplicationV1;
  activeFenceRef: string | null;
  activeFenceHash: string | null;
  activeTargetFamilyHash: string | null;
}>> {
  const rows = await sql<OwnerAdmissionHeadRowV1[]>`SELECT head_version,head_hash,active_fence_ref,active_fence_hash,active_target_family_hash,migration_application_evidence_hash,head_payload FROM internal_production_owner_admission_head_v1 WHERE singleton=TRUE FOR UPDATE`;
  const row = rows[0];
  const version = Number(row?.head_version);
  if (
    rows.length !== 1
    || !Number.isSafeInteger(version)
    || version < 0
    || !row
    || !OWNER_ADMISSION_SHA256_V1.test(row.head_hash)
    || !OWNER_ADMISSION_SHA256_V1.test(row.migration_application_evidence_hash)
    || (row.active_fence_ref === null) !== (row.active_fence_hash === null)
    || (row.active_target_family_hash !== null && row.active_fence_ref === null)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  const payload = row.head_payload;
  const expectedPayloadKeys = version === 0
    ? ["schema", "version", "migrationApplication"]
    : [
        "schema", "version", "predecessorHeadHash", "transitionKind",
        "transitionRef", "transitionHash", "migrationApplication",
      ];
  try {
    exactObjectKeys(payload, expectedPayloadKeys, "INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  const headPayload = payload as Record<string, unknown>;
  let migrationApplication: OwnerAdmissionMigrationApplicationV1;
  try {
    migrationApplication = validateOwnerAdmissionMigrationApplicationV1(
      headPayload.migrationApplication,
      row.migration_application_evidence_hash,
    );
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  if (
    headPayload.schema !== "setfarm.internal-production-owner-admission-head.v1"
    || headPayload.version !== version
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  if (version === 0) {
    if (row.head_hash !== "0".repeat(64)) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
  } else {
    if (
      typeof headPayload.predecessorHeadHash !== "string"
      || !OWNER_ADMISSION_SHA256_V1.test(headPayload.predecessorHeadHash)
      || !["reservation", "close", "fence", "release"].includes(String(headPayload.transitionKind))
      || typeof headPayload.transitionRef !== "string"
      || !OWNER_ADMISSION_REF_V1.test(headPayload.transitionRef)
      || typeof headPayload.transitionHash !== "string"
      || !OWNER_ADMISSION_SHA256_V1.test(headPayload.transitionHash)
      || hashCanonicalJson(headPayload) !== row.head_hash
    ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    await validateOwnerAdmissionAncestryToGenesisV1(
      sql,
      row.head_hash,
      version,
      migrationApplication,
    );
  }
  if (activeFencePolicy === "absent" && row.active_fence_ref !== null) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_FENCED");
  }
  if (activeFencePolicy === "present" && row.active_fence_ref === null) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_FENCE_UNAVAILABLE");
  }
  await observeInternalProductionCompletionBootstrapHeadBarrierV1(sql);
  return Object.freeze({
    version,
    hash: row.head_hash,
    migrationApplication,
    activeFenceRef: row.active_fence_ref,
    activeFenceHash: row.active_fence_hash,
    activeTargetFamilyHash: row.active_target_family_hash,
  });
}

export async function lockInternalProductionBaselineCompletionOwnerBootstrapTargetInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ requestId: string }>,
): Promise<Readonly<{ ownerAdmissionHeadVersion: number; ownerAdmissionHeadHash: string; targetOwnerReservationRef: string; targetOwnerReservationHash: string }>> {
  exactObjectKeys(input, ["requestId"], "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_LOCK_INPUT_INVALID");
  if (typeof input.requestId !== "string" || input.requestId.length < 1 || input.requestId.length > 200 || /[\u0000-\u001f\u007f]/.test(input.requestId)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_LOCK_INPUT_INVALID");
  const key = sql as unknown as object;
  if (internalProductionCompletionBootstrapHeadLockContextsV1.has(key)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_HEAD_LOCK_REENTRY");
  internalProductionCompletionBootstrapHeadLockContextsV1.set(key, Object.freeze({ mode: "target", requestId: input.requestId }));
  try {
    const head = await lockOwnerAdmissionHeadV1(sql, "absent");
    const rows = await sql<Array<{ reservation_ref: string; reservation_hash: string }>>`SELECT reservation_ref,reservation_hash FROM internal_production_owner_reservations_v1 WHERE category='completion-owner' AND owner_key=${input.requestId} AND state='bound'`;
    if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    const reservation = await resolveOwnerReservationInTransactionV1(sql, { reservationRef: rows[0]!.reservation_ref, reservationHash: rows[0]!.reservation_hash });
    const expectedIdentity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId: input.requestId });
    const expectedOwnerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-owner-key.v1", ownerKeyDerivationId: "completion-request-id-v1", ownerKey: input.requestId });
    if (reservation.category !== "completion-owner" || reservation.producerImplementationId !== "a-completion-owner-v1" || reservation.ownerKey !== input.requestId || reservation.ownerKeyHash !== expectedOwnerKeyHash || reservation.reservationRef !== rows[0]!.reservation_ref || reservation.reservationHash !== rows[0]!.reservation_hash) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    const boundRows = await sql<Array<{ canonical_owner_identity: unknown; binding_payload: unknown }>>`SELECT canonical_owner_identity,binding_payload FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${reservation.reservationRef} AND reservation_hash=${reservation.reservationHash} AND state='bound'`;
    if (boundRows.length !== 1 || !sameJsonValueV1(boundRows[0]!.canonical_owner_identity, expectedIdentity)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    return Object.freeze({ ownerAdmissionHeadVersion: head.version, ownerAdmissionHeadHash: head.hash, targetOwnerReservationRef: rows[0]!.reservation_ref, targetOwnerReservationHash: rows[0]!.reservation_hash });
  } catch (error) { internalProductionCompletionBootstrapHeadLockContextsV1.delete(key); throw error; }
}

export async function lockInternalProductionBaselineCompletionOwnerBootstrapReleaseInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ requestId: string; targetGuardReceiptRef: string; targetGuardReceiptHash: string; operationRef: string; operationHash: string }>,
): Promise<Readonly<{ ownerAdmissionHeadVersion: number; ownerAdmissionHeadHash: string; targetOwnerReservationRef: string; targetOwnerReservationHash: string }>> {
  exactObjectKeys(input, ["requestId", "targetGuardReceiptRef", "targetGuardReceiptHash", "operationRef", "operationHash"], "INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RELEASE_LOCK_INPUT_INVALID");
  if (typeof input.requestId !== "string" || input.requestId.length < 1 || input.requestId.length > 200 || /[\u0000-\u001f\u007f]/.test(input.requestId)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RELEASE_LOCK_INPUT_INVALID");
  if (typeof input.targetGuardReceiptHash !== "string" || !OWNER_ADMISSION_SHA256_V1.test(input.targetGuardReceiptHash) || input.targetGuardReceiptRef !== `setfarm://internal-production/baseline-completion-owner-bootstrap-target-guard-receipt/sha256/${input.targetGuardReceiptHash}` || typeof input.operationHash !== "string" || !OWNER_ADMISSION_SHA256_V1.test(input.operationHash) || input.operationRef !== `setfarm://internal-production/baseline-spawner-bootstrap-restart-operation/sha256/${input.operationHash}`) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_RELEASE_LOCK_INPUT_INVALID");
  const key = sql as unknown as object;
  if (internalProductionCompletionBootstrapHeadLockContextsV1.has(key)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_HEAD_LOCK_REENTRY");
  internalProductionCompletionBootstrapHeadLockContextsV1.set(key, Object.freeze({ mode: "release", ...input }));
  try {
    const head = await lockOwnerAdmissionHeadV1(sql, "absent");
    const rows = await sql<Array<{ reservation_ref: string; reservation_hash: string }>>`SELECT reservation_ref,reservation_hash FROM internal_production_owner_reservations_v1 WHERE category='completion-owner' AND owner_key=${input.requestId} AND state='bound'`;
    if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    const reservation = await resolveOwnerReservationInTransactionV1(sql, { reservationRef: rows[0]!.reservation_ref, reservationHash: rows[0]!.reservation_hash });
    const expectedIdentity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1({ requestId: input.requestId });
    const expectedOwnerKeyHash = hashCanonicalJson({ schema: "setfarm.internal-production-owner-key.v1", ownerKeyDerivationId: "completion-request-id-v1", ownerKey: input.requestId });
    if (reservation.category !== "completion-owner" || reservation.producerImplementationId !== "a-completion-owner-v1" || reservation.ownerKey !== input.requestId || reservation.ownerKeyHash !== expectedOwnerKeyHash || reservation.reservationRef !== rows[0]!.reservation_ref || reservation.reservationHash !== rows[0]!.reservation_hash) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    const boundRows = await sql<Array<{ canonical_owner_identity: unknown }>>`SELECT canonical_owner_identity FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${reservation.reservationRef} AND reservation_hash=${reservation.reservationHash} AND state='bound'`;
    if (boundRows.length !== 1 || !sameJsonValueV1(boundRows[0]!.canonical_owner_identity, expectedIdentity)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_TARGET_OWNER_CORRUPTION");
    return Object.freeze({ ownerAdmissionHeadVersion: head.version, ownerAdmissionHeadHash: head.hash, targetOwnerReservationRef: rows[0]!.reservation_ref, targetOwnerReservationHash: rows[0]!.reservation_hash });
  } catch (error) { internalProductionCompletionBootstrapHeadLockContextsV1.delete(key); throw error; }
}

function ownerAdmissionSuccessorV1(input: Readonly<{
  version: number;
  predecessorHeadHash: string;
  transitionKind: "reservation" | "close" | "fence" | "release";
  transitionRef: string;
  transitionHash: string;
  migrationApplication: OwnerAdmissionMigrationApplicationV1;
}>): Readonly<{ version: number; hash: string; payload: Readonly<Record<string, unknown>> }> {
  const payload = Object.freeze({
    schema: "setfarm.internal-production-owner-admission-head.v1",
    version: input.version + 1,
    predecessorHeadHash: input.predecessorHeadHash,
    transitionKind: input.transitionKind,
    transitionRef: input.transitionRef,
    transitionHash: input.transitionHash,
    migrationApplication: input.migrationApplication,
  });
  return Object.freeze({ version: input.version + 1, hash: hashCanonicalJson(payload), payload });
}

async function validateOwnerAdmissionAncestryToGenesisV1(
  sql: InternalProductionPgTransactionSql,
  headHash: string,
  version: number,
  migrationApplication: OwnerAdmissionMigrationApplicationV1,
  seen = new Set<string>(),
): Promise<readonly OwnerAdmissionAdvancingAuthorityV1[]> {
  if (!Number.isSafeInteger(version) || version < 0 || !OWNER_ADMISSION_SHA256_V1.test(headHash)) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  if (version === 0) {
    if (headHash !== "0".repeat(64)) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
    return Object.freeze([]);
  }
  if (seen.has(headHash)) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  seen.add(headHash);
  const authorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE successor_head_hash=${headHash} AND predecessor_head_hash<>successor_head_hash`;
  const fenceAuthorities = authorities.filter(({ authority_kind }) => authority_kind === "fence");
  if (fenceAuthorities.length === 1) {
    const authority = fenceAuthorities[0]!;
    let fence: InternalProductionGlobalOwnerAdmissionFenceV1;
    try {
      fence = validateInternalProductionGlobalOwnerAdmissionFenceV1(authority.authority_body);
    } catch {
      throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
    const expectedCount = fence.targetFamily.kind === "source-run-launch" ? 3 : 1;
    if (authorities.length !== expectedCount) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
    const transition = createInternalProductionGlobalOwnerAdmissionFenceTransitionV1({
      purpose: fence.purpose,
      pendingInputRef: fence.pendingInputRef,
      pendingInputHash: fence.pendingInputHash,
      targetFamilyHash: fence.targetFamily.kind === "source-run-launch"
        ? fence.targetFamily.targetFamilyHash
        : hashCanonicalJson(fence.targetFamily),
      ownerIdentitySetHash: fence.ownerIdentitySetHash,
    });
    const expectedSuccessor = ownerAdmissionSuccessorV1({
      version: version - 1,
      predecessorHeadHash: authority.predecessor_head_hash,
      transitionKind: "fence",
      transitionRef: transition.transitionRef,
      transitionHash: transition.transitionHash,
      migrationApplication,
    });
    if (
      expectedSuccessor.hash !== headHash
      || fence.ownerAdmissionHeadHash !== headHash
      || authority.authority_ref !== fence.fenceRef
      || authority.authority_hash !== fence.fenceHash
      || authority.phase_key !== fence.pendingInputRef
      || authority.predecessor_head_hash !== fence.predecessorFenceHeadHash
      || !sameJsonValueV1(authority.authority_body, fence)
    ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    if (fence.targetFamily.kind === "source-run-launch") {
      const reservations = authorities.filter(({ authority_kind }) => authority_kind === "reservation");
      const expectedPairs = [
        fence.targetFamily.sourceRunReservation,
        fence.targetFamily.runReservation,
      ];
      if (reservations.length !== 2 || expectedPairs.some((pair) => !reservations.some((candidate) => (
        candidate.authority_ref === pair.reservationRef
        && candidate.authority_hash === pair.reservationHash
        && candidate.predecessor_head_hash === authority.predecessor_head_hash
        && candidate.successor_head_hash === headHash
      )))) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
    const predecessors = await validateOwnerAdmissionAncestryToGenesisV1(
      sql,
      authority.predecessor_head_hash,
      version - 1,
      migrationApplication,
      seen,
    );
    return Object.freeze([
      ...authorities.map((member) => Object.freeze({ version, authority: member })),
      ...predecessors,
    ]);
  }
  const authority = authorities[0];
  if (authorities.length !== 1 || !authority) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  let expectedSuccessor: ReturnType<typeof ownerAdmissionSuccessorV1>;
  try {
    if (authority.authority_kind === "reservation") {
      const body = authority.authority_body as Partial<InternalProductionOwnerReservationV1>;
      const producer = typeof body.producerImplementationId === "string"
        ? ownerProducerRowForImplementationV1(body.producerImplementationId)
        : undefined;
      if (!producer) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
      const reservation = validateInternalProductionOwnerReservationV1(body, producer);
      expectedSuccessor = ownerAdmissionSuccessorV1({
        version: version - 1,
        predecessorHeadHash: reservation.ownerAdmissionHeadPredecessorHash,
        transitionKind: "reservation",
        transitionRef: reservation.reservationRef,
        transitionHash: reservation.reservationHash,
        migrationApplication,
      });
      if (
        authority.authority_ref !== reservation.reservationRef
        || authority.authority_hash !== reservation.reservationHash
        || authority.phase_key !== reservation.reservationRef
        || authority.predecessor_head_hash !== reservation.ownerAdmissionHeadPredecessorHash
        || !sameJsonValueV1(authority.authority_body, reservation)
      ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    } else if (authority.authority_kind === "close") {
      const close = validateInternalProductionOwnerReservationCloseV1(authority.authority_body);
      const transition = {
        schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
        reservationRef: close.reservationRef,
        reservationHash: close.reservationHash,
        terminalOwnerRef: close.terminalOwnerRef,
        terminalOwnerHash: close.terminalOwnerHash,
      };
      const transitionHash = hashCanonicalJson(transition);
      expectedSuccessor = ownerAdmissionSuccessorV1({
        version: version - 1,
        predecessorHeadHash: close.ownerAdmissionHeadPredecessorHash,
        transitionKind: "close",
        transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${transitionHash}`,
        transitionHash,
        migrationApplication,
      });
      if (
        authority.authority_ref !== close.closeRef
        || authority.authority_hash !== close.closeHash
        || authority.phase_key !== close.reservationRef
        || authority.predecessor_head_hash !== close.ownerAdmissionHeadPredecessorHash
        || !sameJsonValueV1(authority.authority_body, close)
      ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    } else if (authority.authority_kind === "release") {
      const release = validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(authority.authority_body);
      const transition = createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1({
        fenceRef: release.fenceRef,
        fenceHash: release.fenceHash,
        releaseAuthority: release.releaseAuthority,
      });
      expectedSuccessor = ownerAdmissionSuccessorV1({
        version: version - 1,
        predecessorHeadHash: release.ownerAdmissionHeadPredecessorHash,
        transitionKind: "release",
        transitionRef: transition.transitionRef,
        transitionHash: transition.transitionHash,
        migrationApplication,
      });
      if (
        authority.authority_ref !== release.releaseRef
        || authority.authority_hash !== release.releaseHash
        || authority.phase_key !== release.fenceRef
        || authority.predecessor_head_hash !== release.ownerAdmissionHeadPredecessorHash
        || !sameJsonValueV1(authority.authority_body, release)
      ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    } else {
      throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
  } catch {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  if (
    expectedSuccessor.version !== version
    || expectedSuccessor.hash !== headHash
    || authority.successor_head_hash !== headHash
    || authority.predecessor_head_hash !== expectedSuccessor.payload.predecessorHeadHash
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  const predecessors = await validateOwnerAdmissionAncestryToGenesisV1(
    sql,
    authority.predecessor_head_hash,
    version - 1,
    migrationApplication,
    seen,
  );
  return Object.freeze([
    Object.freeze({ version, authority }),
    ...predecessors,
  ]);
}

async function beginOrAdoptOwnerReservationInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ producerImplementationId: string; ownerKey: string }>,
): Promise<InternalProductionOwnerReservationV1> {
  exactObjectKeys(input, ["producerImplementationId", "ownerKey"], "INTERNAL_PRODUCTION_OWNER_RESERVATION_BEGIN_INPUT_INVALID");
  if (typeof input.ownerKey !== "string" || input.ownerKey.length === 0 || input.ownerKey.length > 8_462 || /[\u0000-\u001f\u007f]/.test(input.ownerKey)) {
    throw new TypeError("INTERNAL_PRODUCTION_OWNER_KEY_INVALID");
  }
  const barrierKey = sql as unknown as object;
  if (internalProductionCompletionBootstrapHeadLockContextsV1.has(barrierKey)) throw new Error("INTERNAL_PRODUCTION_COMPLETION_BOOTSTRAP_HEAD_LOCK_REENTRY");
  internalProductionCompletionBootstrapHeadLockContextsV1.set(barrierKey, Object.freeze({ mode: "ordinary-target-adoption", requestId: input.ownerKey, producerImplementationId: input.producerImplementationId }));
  let head: Awaited<ReturnType<typeof lockOwnerAdmissionHeadV1>>;
  try { head = await lockOwnerAdmissionHeadV1(sql); }
  finally { internalProductionCompletionBootstrapHeadLockContextsV1.delete(barrierKey); }
  const producer = await resolveActiveOwnerProducerV1(sql, input.producerImplementationId);
  const candidate = createInternalProductionOwnerReservationV1({
    producer,
    ownerKey: input.ownerKey,
    ownerAdmissionHeadPredecessorHash: head.hash,
  });
  const existing = await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE category=${candidate.category} AND owner_key_hash=${candidate.ownerKeyHash} FOR UPDATE`;
  if (existing.length > 1) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  if (existing.length === 1) {
    const adopted = await resolveOwnerReservationInTransactionV1(sql, {
      reservationRef: existing[0]!.reservation_ref,
      reservationHash: existing[0]!.reservation_hash,
    }, true);
    if (adopted.producerImplementationId !== producer.implementationId || adopted.ownerKey !== input.ownerKey) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CONFLICT");
    }
    await sql`SELECT set_config(
      ${WORKFLOW_RUN_OWNER_BEGIN_PROVENANCE_SETTING_V1},
      ${canonicalJsonStringify({
        schema: "setfarm.internal-production-workflow-run-owner-begin-provenance.v1",
        ownerKey: input.ownerKey,
        reservationRef: adopted.reservationRef,
        reservationHash: adopted.reservationHash,
        createdHere: false,
      })},
      TRUE
    )`;
    return adopted;
  }
  const successor = ownerAdmissionSuccessorV1({
    version: head.version,
    predecessorHeadHash: head.hash,
    transitionKind: "reservation",
    transitionRef: candidate.reservationRef,
    transitionHash: candidate.reservationHash,
    migrationApplication: head.migrationApplication,
  });
  await sql`INSERT INTO internal_production_owner_reservations_v1 (reservation_ref,reservation_hash,category,owner_key,owner_key_hash,producer_purpose_hash,producer_implementation_id,producer_implementation_hash,reservation_payload,reservation_head_predecessor_hash,state,head_version) VALUES (${candidate.reservationRef},${candidate.reservationHash},${candidate.category},${candidate.ownerKey},${candidate.ownerKeyHash},${candidate.producerPurposeHash},${candidate.producerImplementationId},${candidate.producerImplementationHash},${sql.json(candidate)},${candidate.ownerAdmissionHeadPredecessorHash},'pending',${successor.version})`;
  await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${candidate.reservationRef},${candidate.reservationHash},'reservation',${candidate.reservationRef},${head.hash},${successor.hash},${sql.json(candidate)})`;
  const updated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${successor.version},head_hash=${successor.hash},head_payload=${sql.json(successor.payload as postgres.JSONValue)},updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} RETURNING head_version`;
  if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
  await sql`SELECT set_config(
    ${WORKFLOW_RUN_OWNER_BEGIN_PROVENANCE_SETTING_V1},
    ${canonicalJsonStringify({
      schema: "setfarm.internal-production-workflow-run-owner-begin-provenance.v1",
      ownerKey: input.ownerKey,
      reservationRef: candidate.reservationRef,
      reservationHash: candidate.reservationHash,
      createdHere: true,
    })},
    TRUE
  )`;
  return candidate;
}

async function bindOwnerReservationInTransactionV1<Category extends InternalProductionOwnerCategoryV1>(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{
    reservationRef: string;
    reservationHash: string;
    canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
  }>,
): Promise<InternalProductionBoundOwnerReservationV1<Category>> {
  exactObjectKeys(input, ["reservationRef", "reservationHash", "canonicalOwnerIdentity"], "INTERNAL_PRODUCTION_OWNER_RESERVATION_BIND_INPUT_INVALID");
  const reservationPair = validateOwnerAdmissionPairV1(
    { reservationRef: input.reservationRef, reservationHash: input.reservationHash },
    "reservationRef",
    "reservationHash",
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_PAIR_INVALID",
  );
  const identity = validateInternalProductionCanonicalOwnerIdentityV1<Category>(input.canonicalOwnerIdentity);
  const producer = ownerProducerRowForImplementationV1(
    (await sql<Array<{ producer_implementation_id: string }>>`SELECT producer_implementation_id FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${reservationPair.reservationRef} AND reservation_hash=${reservationPair.reservationHash}`)[0]?.producer_implementation_id ?? "",
  );
  if (!producer) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE");
  await resolveActiveOwnerProducerV1(sql, producer.implementationId);
  const lockedHead = await lockOwnerAdmissionHeadV1(sql);
  const reservation = await resolveOwnerReservationInTransactionV1(sql, {
    reservationRef: reservationPair.reservationRef,
    reservationHash: reservationPair.reservationHash,
  }, true);
  const bound = createInternalProductionBoundOwnerReservationV1({ reservation, canonicalOwnerIdentity: identity });
  const state = await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${reservation.reservationRef} FOR UPDATE`;
  if (state.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  if (state[0]!.state === "bound" || state[0]!.state === "closed") {
    const adopted = await validateBoundOwnerReservationRowV1<Category>(sql, state[0]!, reservation);
    if (!sameJsonValueV1(adopted, bound)) throw new Error("INTERNAL_PRODUCTION_OWNER_IDENTITY_CONFLICT");
    if (state[0]!.state === "closed") {
      if (state[0]!.close_payload === null || state[0]!.close_ref === null || state[0]!.close_hash === null) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
      }
      const close = validateInternalProductionOwnerReservationCloseV1(state[0]!.close_payload);
      const closeAuthorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${state[0]!.close_ref} AND authority_hash=${state[0]!.close_hash}`;
      if (closeAuthorities.length !== 1) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
      }
      await validateClosedOwnerReservationRowV1(
        sql,
        state[0]!,
        reservation,
        close,
        closeAuthorities[0]!,
      );
    }
    return adopted;
  }
  if (state[0]!.state !== "pending") throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  const reservationAuthorities = await sql<Array<{ successor_head_hash: string }>>`SELECT successor_head_hash FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${reservation.reservationRef} AND authority_hash=${reservation.reservationHash}`;
  if (reservationAuthorities.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  const reservationSuccessorHash = reservationAuthorities[0]!.successor_head_hash;
  if (lockedHead.hash !== reservationSuccessorHash) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
  }
  const updated = await sql`UPDATE internal_production_owner_reservations_v1 SET state='bound',canonical_owner_identity=${sql.json(identity)},binding_hash=${bound.bindingHash},binding_payload=${sql.json(bound)},updated_at=NOW() WHERE reservation_ref=${reservation.reservationRef} AND reservation_hash=${reservation.reservationHash} AND state='pending' RETURNING reservation_ref`;
  if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CONFLICT");
  const bindingRef = `setfarm://internal-production/bound-owner-reservations/${bound.bindingHash}`;
  await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${bindingRef},${bound.bindingHash},'binding',${reservation.reservationRef},${reservationSuccessorHash},${reservationSuccessorHash},${sql.json(bound)})`;
  const publishedReservation = await resolveOwnerReservationInTransactionV1(sql, {
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
  }, true);
  const publishedRows = await sql<OwnerReservationRowV1[]>`
    SELECT *
      FROM internal_production_owner_reservations_v1
     WHERE reservation_ref=${reservation.reservationRef}
       AND reservation_hash=${reservation.reservationHash}
     FOR UPDATE
  `;
  if (publishedRows.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  }
  const published = await validateBoundOwnerReservationRowV1<Category>(
    sql,
    publishedRows[0]!,
    publishedReservation,
  );
  const publishedHead = await lockOwnerAdmissionHeadV1(sql);
  if (
    publishedHead.version !== lockedHead.version
    || publishedHead.hash !== reservationSuccessorHash
    || !sameJsonValueV1(publishedReservation, reservation)
    || !sameJsonValueV1(published, bound)
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CORRUPTION");
  return published;
}

async function closeOwnerReservationInTransactionV1<
  Category extends InternalProductionOwnerCategoryV1,
>(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{
    reservationRef: string;
    reservationHash: string;
    resolvedTerminalAuthority: InternalProductionTerminalOwnerAuthorityV1<Category>;
  }>,
): Promise<InternalProductionOwnerReservationCloseV1> {
  exactObjectKeys(
    input,
    ["reservationRef", "reservationHash", "resolvedTerminalAuthority"],
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_INPUT_INVALID",
  );
  const reservationPair = validateOwnerAdmissionPairV1(
    { reservationRef: input.reservationRef, reservationHash: input.reservationHash },
    "reservationRef",
    "reservationHash",
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_PAIR_INVALID",
  );
  const terminal = validateInternalProductionTerminalOwnerAuthorityV1<Category>(
    input.resolvedTerminalAuthority,
  );
  const implementationRows = await sql<Array<{ producer_implementation_id: string }>>`
    SELECT producer_implementation_id
      FROM internal_production_owner_reservations_v1
     WHERE reservation_ref=${reservationPair.reservationRef}
       AND reservation_hash=${reservationPair.reservationHash}
  `;
  if (implementationRows.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_UNAVAILABLE");
  }
  await resolveActiveOwnerProducerV1(sql, implementationRows[0]!.producer_implementation_id);
  const head = await lockOwnerAdmissionHeadV1(sql);
  const reservation = await resolveOwnerReservationInTransactionV1(sql, {
    reservationRef: reservationPair.reservationRef,
    reservationHash: reservationPair.reservationHash,
  }, true);
  const rows = await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${reservation.reservationRef} FOR UPDATE`;
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_NOT_BOUND");
  }
  if (row.state === "closed") {
    if (row.close_payload === null || row.close_ref === null || row.close_hash === null) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
    }
    const adopted = validateInternalProductionOwnerReservationCloseV1(row.close_payload);
    const closeAuthorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${row.close_ref} AND authority_hash=${row.close_hash}`;
    if (closeAuthorities.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
    }
    const bound = await validateClosedOwnerReservationRowV1(
      sql,
      row,
      reservation,
      adopted,
      closeAuthorities[0]!,
    );
    if (
      adopted.terminalOwnerRef !== terminal.terminalOwnerRef
      || adopted.terminalOwnerHash !== terminal.terminalOwnerHash
      || terminal.ownerRef !== bound.canonicalOwnerIdentity.ownerRef
      || terminal.ownerHash !== bound.canonicalOwnerIdentity.ownerHash
    ) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CONFLICT");
    return adopted;
  }
  if (row.state !== "bound" || row.close_payload !== null) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_NOT_BOUND");
  }
  const bound = await validateBoundOwnerReservationRowV1<Category>(sql, row, reservation);
  const closeTransition = Object.freeze({
    schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
    terminalOwnerRef: terminal.terminalOwnerRef,
    terminalOwnerHash: terminal.terminalOwnerHash,
  });
  const closeTransitionHash = hashCanonicalJson(closeTransition);
  const successor = ownerAdmissionSuccessorV1({
    version: head.version,
    predecessorHeadHash: head.hash,
    transitionKind: "close",
    transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${closeTransitionHash}`,
    transitionHash: closeTransitionHash,
    migrationApplication: head.migrationApplication,
  });
  const close = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: head.hash,
    ownerAdmissionHeadSuccessorHash: successor.hash,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  const updated = await sql`UPDATE internal_production_owner_reservations_v1 SET state='closed',close_kind=${close.closeKind},terminal_owner_ref=${close.terminalOwnerRef},terminal_owner_hash=${close.terminalOwnerHash},close_head_predecessor_hash=${close.ownerAdmissionHeadPredecessorHash},close_head_successor_hash=${close.ownerAdmissionHeadSuccessorHash},preserved_fence_ref=${close.preservedFenceRef},preserved_fence_hash=${close.preservedFenceHash},close_ref=${close.closeRef},close_hash=${close.closeHash},close_payload=${sql.json(close)},head_version=${successor.version},updated_at=NOW() WHERE reservation_ref=${reservation.reservationRef} AND reservation_hash=${reservation.reservationHash} AND state='bound' RETURNING reservation_ref`;
  if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CONFLICT");
  await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${close.closeRef},${close.closeHash},'close',${reservation.reservationRef},${head.hash},${successor.hash},${sql.json(close)})`;
  const headUpdated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${successor.version},head_hash=${successor.hash},head_payload=${sql.json(successor.payload as postgres.JSONValue)},updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} RETURNING head_version`;
  if (headUpdated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
  const publishedRows = await sql<OwnerReservationRowV1[]>`SELECT * FROM internal_production_owner_reservations_v1 WHERE reservation_ref=${reservation.reservationRef} FOR UPDATE`;
  const publishedAuthorities = await sql<OwnerAdmissionAuthorityRowV1[]>`SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body FROM internal_production_owner_admission_authorities_v1 WHERE authority_ref=${close.closeRef} AND authority_hash=${close.closeHash}`;
  if (publishedRows.length !== 1 || publishedAuthorities.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_CORRUPTION");
  }
  await validateClosedOwnerReservationRowV1(
    sql,
    publishedRows[0]!,
    reservation,
    close,
    publishedAuthorities[0]!,
  );
  return close;
}

type OwnerTerminalResolverV1 = Readonly<{
  resolveByAuthorityPair: (
    sql: InternalProductionPgTransactionSql,
    pair: InternalProductionTerminalOwnerAuthorityPairV1,
    exactInput?: unknown,
  ) => Promise<InternalProductionTerminalOwnerAuthorityV1>;
  resolveByTerminalOwnerPair: (
    sql: InternalProductionPgTransactionSql,
    pair: Readonly<{ terminalOwnerRef: string; terminalOwnerHash: string }>,
    exactInput?: unknown,
  ) => Promise<InternalProductionTerminalOwnerAuthorityV1>;
}>;

type WorkflowRunTerminalRowV1 = Readonly<{
  id: string;
  status: string;
}>;

async function resolveStoredWorkflowRunOwnerByPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ runOwnerReservationRef: string; runOwnerReservationHash: string }>,
  allowedStates: readonly ("bound" | "closed")[],
): Promise<Readonly<{
  row: OwnerReservationRowV1;
  bound: InternalProductionBoundOwnerReservationV1<"run">;
}>> {
  const pair = validateOwnerAdmissionPairV1(
    input,
    "runOwnerReservationRef",
    "runOwnerReservationHash",
    "INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_PAIR_INVALID",
  );
  const rows = await sql<OwnerReservationRowV1[]>`
    SELECT *
      FROM internal_production_owner_reservations_v1
     WHERE reservation_ref=${pair.runOwnerReservationRef}
       AND reservation_hash=${pair.runOwnerReservationHash}
     FOR UPDATE
  `;
  const row = rows[0];
  if (rows.length !== 1 || !row || !allowedStates.includes(row.state as "bound" | "closed")) {
    throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
  }
  try {
    const reservation = await resolveOwnerReservationInTransactionV1(sql, {
      reservationRef: pair.runOwnerReservationRef,
      reservationHash: pair.runOwnerReservationHash,
    }, true);
    const bound = await validateBoundOwnerReservationRowV1<"run">(sql, row, reservation);
    const expectedIdentity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(
      reservation.ownerKey,
    );
    if (reservation.category !== "run" || bound.category !== "run" || bound.ownerKey !== reservation.ownerKey || !sameJsonValueV1(bound.canonicalOwnerIdentity, expectedIdentity)) throw new Error();
    if (reservation.producerImplementationId === "a-runtime-run-v1") {
      if (bound.producerImplementationId !== "a-runtime-run-v1" || row.state !== "bound") throw new Error();
    } else if (reservation.producerImplementationId === "a-recovery-source-bootstrap-run-v1") {
      if (bound.producerImplementationId !== "a-recovery-source-bootstrap-run-v1" || row.state !== "closed") throw new Error();
      const runRows = await sql<Array<{ id: string; context: string; status: string }>>`
        SELECT id,context,status FROM runs WHERE id=${reservation.ownerKey} FOR SHARE
      `;
      const run = runRows[0];
      if (runRows.length !== 1 || !run || run.id !== reservation.ownerKey || !["running", "completed", "failed", "cancelled"].includes(run.status)) throw new Error();
      const context = strictCanonicalText(run.context, "INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_CONTEXT_INVALID");
      exactObjectKeys(context, [
        "schema", "task", "purpose", "repository", "workflow", "protocol", "promptManifestHash",
        "baseSourceSha", "baseSourceTreeHash", "buildHash", "activationPreflightHash", "releaseAdmissionHash",
        "pendingInputRef", "pendingInputHash", "startIntentRef", "startIntentHash", "startOutboxRef", "startOutboxHash",
        "operationRef", "operationHash", "targetSourceRunReservationRef", "targetSourceRunReservationHash",
        "targetRunReservationRef", "targetRunReservationHash", "targetRunLaunchCompositeHash", "sourceRunOwnerRef",
        "sourceRunOwnerHash", "runOwnerRef", "runOwnerHash", "operationRunBindingHash", "reciprocalRunOperationBindingHash",
      ], "INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_CONTEXT_INVALID");
      if (
        context.schema !== "setfarm.internal-production-recovery-source-bootstrap-run-context.v1"
        || context.runOwnerRef !== bound.canonicalOwnerIdentity.ownerRef
        || context.runOwnerHash !== bound.canonicalOwnerIdentity.ownerHash
        || context.targetRunReservationRef !== reservation.reservationRef
        || context.targetRunReservationHash !== reservation.reservationHash
      ) throw new Error();
      const sourceRows = await sql<OwnerReservationRowV1[]>`
        SELECT * FROM internal_production_owner_reservations_v1
         WHERE reservation_ref=${String(context.targetSourceRunReservationRef)}
           AND reservation_hash=${String(context.targetSourceRunReservationHash)}
         FOR UPDATE
      `;
      const sourceRow = sourceRows[0];
      if (sourceRows.length !== 1 || !sourceRow || sourceRow.state !== "closed" || sourceRow.close_kind !== "fence-target" || row.close_kind !== "fence-target" || !sourceRow.close_payload || !row.close_payload) throw new Error();
      const sourceClose = validateInternalProductionOwnerReservationCloseV1(sourceRow.close_payload);
      const runClose = validateInternalProductionOwnerReservationCloseV1(row.close_payload);
      if (sourceClose.reservationRef !== context.targetSourceRunReservationRef || sourceClose.reservationHash !== context.targetSourceRunReservationHash || runClose.reservationRef !== context.targetRunReservationRef || runClose.reservationHash !== context.targetRunReservationHash || sourceClose.ownerAdmissionHeadSuccessorHash !== runClose.ownerAdmissionHeadPredecessorHash || sourceClose.preservedFenceRef === null || sourceClose.preservedFenceHash === null || sourceClose.preservedFenceRef !== runClose.preservedFenceRef || sourceClose.preservedFenceHash !== runClose.preservedFenceHash) throw new Error();
      const pairClose = createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
        fenceRef: sourceClose.preservedFenceRef,
        fenceHash: sourceClose.preservedFenceHash,
        targetRunLaunchCompositeHash: String(context.targetRunLaunchCompositeHash),
        sourceRunReservationRef: String(context.targetSourceRunReservationRef),
        sourceRunReservationHash: String(context.targetSourceRunReservationHash),
        runReservationRef: String(context.targetRunReservationRef),
        runReservationHash: String(context.targetRunReservationHash),
        terminalSourceRunRef: sourceClose.terminalOwnerRef,
        terminalSourceRunHash: sourceClose.terminalOwnerHash,
        terminalRunLaunchRef: runClose.terminalOwnerRef,
        terminalRunLaunchHash: runClose.terminalOwnerHash,
        ownerAdmissionHeadPredecessorHash: sourceClose.ownerAdmissionHeadPredecessorHash,
        ownerAdmissionHeadSuccessorHash: runClose.ownerAdmissionHeadSuccessorHash,
        preservedFenceRef: sourceClose.preservedFenceRef,
        preservedFenceHash: sourceClose.preservedFenceHash,
      });
      const releaseRows = await sql<OwnerAdmissionAuthorityRowV1[]>`
        SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body
          FROM internal_production_owner_admission_authorities_v1
         WHERE authority_kind='release' AND phase_key=${sourceClose.preservedFenceRef}
         LIMIT 2
         FOR SHARE
      `;
      if (releaseRows.length !== 1) throw new Error();
      const release = await resolveGlobalOwnerAdmissionFenceReleaseInTransactionV1(sql, { releaseRef: releaseRows[0]!.authority_ref, releaseHash: releaseRows[0]!.authority_hash });
      if (release.fenceRef !== sourceClose.preservedFenceRef || release.fenceHash !== sourceClose.preservedFenceHash || release.releaseAuthority.purpose !== "recovery-d-source-delivery-v1" || release.releaseAuthority.targetFamilyKind !== "source-run-launch" || release.releaseAuthority.targetReservationPairCloseRef !== pairClose.targetReservationPairCloseRef || release.releaseAuthority.targetReservationPairCloseHash !== pairClose.targetReservationPairCloseHash) throw new Error();
      const receiptModule = await import("./internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
      const resolvePending = receiptModule.resolveInternalProductionRecoverySourceBootstrapPendingInputV1;
      const resolveSourceTerminal = receiptModule.resolveInternalProductionRecoverySourceRunTerminalAuthorityV1;
      const resolveRunTerminal = receiptModule.resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1;
      const resolvePairClose = receiptModule.resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1;
      const resolveRunReceipt = receiptModule.resolveInternalProductionRecoverySourceBootstrapRunReceiptV1;
      if ([resolvePending, resolveSourceTerminal, resolveRunTerminal, resolvePairClose, resolveRunReceipt].some((port) => typeof port !== "function" || port.length !== 1)) throw new Error();
      const pending = await (resolvePending as (pair: unknown) => Promise<Record<string, unknown>>)({ pendingInputRef: context.pendingInputRef, pendingInputHash: context.pendingInputHash });
      const sourceTerminal = await (resolveSourceTerminal as (pair: unknown) => Promise<Record<string, unknown>>)({ terminalSourceRunRef: sourceClose.terminalOwnerRef, terminalSourceRunHash: sourceClose.terminalOwnerHash });
      const runTerminal = await (resolveRunTerminal as (pair: unknown) => Promise<Record<string, unknown>>)({ terminalRunLaunchRef: runClose.terminalOwnerRef, terminalRunLaunchHash: runClose.terminalOwnerHash });
      const resolvedPairClose = await (resolvePairClose as (pair: unknown) => Promise<Record<string, unknown>>)({ targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef, targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash });
      if (pending.pendingInputRef !== context.pendingInputRef || pending.pendingInputHash !== context.pendingInputHash || sourceTerminal.operationRef !== context.operationRef || sourceTerminal.operationHash !== context.operationHash || runTerminal.operationRef !== context.operationRef || runTerminal.operationHash !== context.operationHash || sourceTerminal.runId !== reservation.ownerKey || runTerminal.runId !== reservation.ownerKey || sourceTerminal.operationRunBindingHash !== context.operationRunBindingHash || runTerminal.operationRunBindingHash !== context.operationRunBindingHash || sourceTerminal.reciprocalRunOperationBindingHash !== context.reciprocalRunOperationBindingHash || runTerminal.reciprocalRunOperationBindingHash !== context.reciprocalRunOperationBindingHash || !sameJsonValueV1(resolvedPairClose, pairClose)) throw new Error();
      const receiptBody = {
        schema: "setfarm.internal-production-recovery-source-bootstrap-run-receipt.v1", purpose: "recovery-d-source-delivery-v1",
        pendingInputRef: context.pendingInputRef, pendingInputHash: context.pendingInputHash,
        operationRef: context.operationRef, operationHash: context.operationHash,
        targetSourceRunReservationRef: context.targetSourceRunReservationRef, targetSourceRunReservationHash: context.targetSourceRunReservationHash,
        targetRunReservationRef: context.targetRunReservationRef, targetRunReservationHash: context.targetRunReservationHash,
        targetRunLaunchCompositeHash: context.targetRunLaunchCompositeHash,
        ownerAdmissionFenceRef: sourceClose.preservedFenceRef, ownerAdmissionFenceHash: sourceClose.preservedFenceHash,
        startIntentRef: context.startIntentRef, startIntentHash: context.startIntentHash,
        startOutboxRef: context.startOutboxRef, startOutboxHash: context.startOutboxHash,
        runId: reservation.ownerKey,
        operationRunBindingHash: context.operationRunBindingHash, reciprocalRunOperationBindingHash: context.reciprocalRunOperationBindingHash,
        terminalOwnerRef: sourceTerminal.terminalOwnerRef, terminalOwnerHash: sourceTerminal.terminalOwnerHash,
        terminalSourceRunRef: sourceTerminal.terminalSourceRunRef, terminalSourceRunHash: sourceTerminal.terminalSourceRunHash,
        terminalRunLaunchRef: runTerminal.terminalRunLaunchRef, terminalRunLaunchHash: runTerminal.terminalRunLaunchHash,
        targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef, targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash,
        fenceReleaseRef: release.releaseRef, fenceReleaseHash: release.releaseHash,
      };
      const sourceRunHash = hashCanonicalJson(receiptBody);
      const sourceRunRef = `setfarm://internal-production/recovery-source-bootstrap-run-receipt/sha256/${sourceRunHash}`;
      const sourceReceipt = await (resolveRunReceipt as (pair: unknown) => Promise<Record<string, unknown>>)({ sourceRunRef, sourceRunHash });
      if (!sameJsonValueV1(sourceReceipt, { ...receiptBody, sourceRunRef, sourceRunHash })) throw new Error();
      if (
        sourceReceipt.runId !== reservation.ownerKey
        || sourceReceipt.operationRef !== context.operationRef || sourceReceipt.operationHash !== context.operationHash
        || sourceReceipt.targetRunReservationRef !== reservation.reservationRef || sourceReceipt.targetRunReservationHash !== reservation.reservationHash
        || sourceReceipt.operationRunBindingHash !== context.operationRunBindingHash
        || sourceReceipt.reciprocalRunOperationBindingHash !== context.reciprocalRunOperationBindingHash
      ) throw new Error();
    } else {
      throw new Error();
    }
    return Object.freeze({ row, bound });
  } catch {
    throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION");
  }
}

async function resolveLockedWorkflowRunOwnerByRunIdV1(
  sql: InternalProductionPgTransactionSql,
  runId: string,
  allowedStates: readonly ("bound" | "closed")[],
): Promise<Readonly<{
  run: WorkflowRunTerminalRowV1;
  row: OwnerReservationRowV1;
  bound: InternalProductionBoundOwnerReservationV1<"run">;
}>> {
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
  const runs = await sql<WorkflowRunTerminalRowV1[]>`
    SELECT id,status FROM runs WHERE id=${runId} FOR UPDATE
  `;
  const pairs = await sql<Array<{ reservation_ref: string; reservation_hash: string }>>`
    SELECT reservation_ref,reservation_hash
      FROM internal_production_owner_reservations_v1
     WHERE producer_implementation_id='a-runtime-run-v1'
       AND category='run'
       AND owner_key=${runId}
       AND state=ANY(${allowedStates})
     FOR UPDATE
  `;
  if (runs.length !== 1 || pairs.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
  }
  const resolved = await resolveStoredWorkflowRunOwnerByPairInTransactionV1(sql, {
    runOwnerReservationRef: pairs[0]!.reservation_ref,
    runOwnerReservationHash: pairs[0]!.reservation_hash,
  }, allowedStates);
  if (resolved.bound.ownerKey !== runId) {
    throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION");
  }
  return Object.freeze({ run: runs[0]!, ...resolved });
}

function createWorkflowRunTerminalAuthorityFromLockedRowsV1(
  run: WorkflowRunTerminalRowV1,
  bound: InternalProductionBoundOwnerReservationV1<"run">,
): InternalProductionTerminalOwnerAuthorityV1<"run"> {
  if (!WORKFLOW_RUN_TERMINAL_STATUSES_V1.includes(run.status as WorkflowRunTerminalStatusV1)) {
    throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_STATUS_INVALID");
  }
  const status = run.status as WorkflowRunTerminalStatusV1;
  const encodedRunId = encodeCanonicalWorkflowRunIdSegmentV1(run.id);
  return createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: bound.canonicalOwnerIdentity,
    terminalOwnerRef: `setfarm://runs/${encodedRunId}/terminal/${status}`,
    terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
      runId: run.id,
      status,
    }),
  });
}

function bindWorkflowRunTerminalAuthorityToReservationStateV1(
  resolved: Readonly<{ row: OwnerReservationRowV1 }>,
  authority: InternalProductionTerminalOwnerAuthorityV1<"run">,
): void {
  if (
    resolved.row.state === "closed"
    && (
      resolved.row.terminal_owner_ref !== authority.terminalOwnerRef
      || resolved.row.terminal_owner_hash !== authority.terminalOwnerHash
    )
  ) throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_CORRUPTION");
}

async function resolveWorkflowRunTerminalAuthorityByTerminalOwnerPairV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ terminalOwnerRef: string; terminalOwnerHash: string }>,
): Promise<InternalProductionTerminalOwnerAuthorityV1<"run">> {
  const pair = validateOwnerAdmissionPairV1(
    input,
    "terminalOwnerRef",
    "terminalOwnerHash",
    "INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_OWNER_PAIR_INVALID",
  );
  const match = /^setfarm:\/\/runs\/([^/]+)\/terminal\/(completed|failed|cancelled)$/.exec(
    pair.terminalOwnerRef,
  );
  if (!match) throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_OWNER_PAIR_INVALID");
  const runId = decodeCanonicalWorkflowRunIdSegmentV1(match[1]!);
  const resolved = await resolveLockedWorkflowRunOwnerByRunIdV1(
    sql,
    runId,
    ["bound", "closed"],
  );
  const authority = createWorkflowRunTerminalAuthorityFromLockedRowsV1(
    resolved.run,
    resolved.bound,
  );
  bindWorkflowRunTerminalAuthorityToReservationStateV1(resolved, authority);
  if (
    authority.terminalOwnerRef !== pair.terminalOwnerRef
    || authority.terminalOwnerHash !== pair.terminalOwnerHash
  ) throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_OWNER_PAIR_INVALID");
  return authority;
}

async function resolveWorkflowRunTerminalAuthorityByAuthorityPairV1(
  sql: InternalProductionPgTransactionSql,
  input: InternalProductionTerminalOwnerAuthorityPairV1,
): Promise<InternalProductionTerminalOwnerAuthorityV1<"run">> {
  const pair = validateOwnerAdmissionPairV1(
    input,
    "terminalAuthorityRef",
    "terminalAuthorityHash",
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID",
  ) as InternalProductionTerminalOwnerAuthorityPairV1;
  const candidates = await sql<Array<{
    id: string;
    status: string;
  }>>`
    SELECT run.id,run.status
      FROM runs run
      JOIN internal_production_owner_reservations_v1 reservation
        ON reservation.owner_key=run.id
     WHERE reservation.producer_implementation_id='a-runtime-run-v1'
       AND reservation.category='run'
       AND reservation.state IN ('bound','closed')
       AND run.status IN ('completed','failed','cancelled')
  `;
  const matches: string[] = [];
  for (const candidate of candidates) {
    const expectedIdentity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(candidate.id);
    const status = candidate.status as WorkflowRunTerminalStatusV1;
    const terminalOwnerRef = `setfarm://runs/${encodeCanonicalWorkflowRunIdSegmentV1(candidate.id)}/terminal/${status}`;
    const terminalOwnerHash = hashCanonicalJson({
      schema: "setfarm.internal-production-workflow-run-terminal-owner.v1",
      runId: candidate.id,
      status,
    });
    const projected = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: expectedIdentity,
      terminalOwnerRef,
      terminalOwnerHash,
    });
    const projectedPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(projected);
    if (
      projectedPair.terminalAuthorityRef === pair.terminalAuthorityRef
      && projectedPair.terminalAuthorityHash === pair.terminalAuthorityHash
    ) {
      matches.push(candidate.id);
    }
  }
  if (matches.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
  }
  const resolved = await resolveLockedWorkflowRunOwnerByRunIdV1(
    sql,
    matches[0]!,
    ["bound", "closed"],
  );
  const authority = createWorkflowRunTerminalAuthorityFromLockedRowsV1(
    resolved.run,
    resolved.bound,
  );
  bindWorkflowRunTerminalAuthorityToReservationStateV1(resolved, authority);
  const lockedPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(authority);
  if (
    lockedPair.terminalAuthorityRef !== pair.terminalAuthorityRef
    || lockedPair.terminalAuthorityHash !== pair.terminalAuthorityHash
  ) throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
  return authority;
}

const CLAIM_TERMINAL_STATUSES_V1 = Object.freeze([
  "completed", "infra_retry", "failed", "skipped", "abandoned", "cancelled",
] as const);
const EXECUTION_ATTEMPT_TERMINAL_STATUSES_V1 = Object.freeze([
  "produced_delta", "already_satisfied", "no_progress", "inconclusive", "failed", "verified",
] as const);
const RUNTIME_SESSION_TERMINAL_STATUSES_V1 = Object.freeze([
  "released", "quarantined",
] as const);
const COMPLETION_OWNER_TERMINAL_STATUSES_V1 = Object.freeze([
  "accepted", "rejected", "quarantined",
] as const);
const MANDATORY_EFFECT_TERMINAL_STATUSES_V1 = Object.freeze([
  "applied", "reconciled",
] as const);
const OPERATIONAL_DELIVERY_TERMINAL_STATUSES_V1 = Object.freeze([
  "delivered", "skipped", "quarantined",
] as const);

const CLAIM_OWNER_IMPLEMENTATION_IDS_V1 = Object.freeze([
  "a-claim-single-runtime-v1",
  "a-claim-loop-runtime-v1",
  "a-claim-v3-downstream-evidence-v1",
  "a-claim-v3-evidence-only-v1",
] as const);
const FINDING_OWNER_IMPLEMENTATION_IDS_V1 = Object.freeze([
  "a-finding-recovery-repository-v1",
  "a-finding-v3-downstream-evidence-v1",
  "a-finding-v3-evidence-only-v1",
] as const);

type P3TerminalProjectionV1<
  Category extends InternalProductionOwnerCategoryV1,
> = Readonly<{
  identity: InternalProductionCanonicalOwnerIdentityV1<Category>;
  status: string;
  terminalOwnerHash: string;
}>;

type P3TerminalResolverConfigV1<
  Category extends InternalProductionOwnerCategoryV1,
> = Readonly<{
  category: Category;
  implementationIds: readonly string[];
  exactInputFromIdentity: (
    identity: InternalProductionCanonicalOwnerIdentityV1<Category>,
  ) => Readonly<Record<string, unknown>>;
  lockProjection: (
    sql: InternalProductionPgTransactionSql,
    input: unknown,
  ) => Promise<P3TerminalProjectionV1<Category>>;
}>;

type P3IssuedTerminalCloseInputV1 = Readonly<{
  sql: InternalProductionPgTransactionSql;
  category: InternalProductionOwnerCategoryV1;
  exactInput: Readonly<Record<string, unknown>>;
  reservationRef: string;
  reservationHash: string;
  terminalAuthorityRef: string;
  terminalAuthorityHash: string;
}>;

const P3_ISSUED_TERMINAL_CLOSE_INPUTS_V1 = new WeakMap<
object,
P3IssuedTerminalCloseInputV1
>();

function exactP3InputFromIdentityV1<
  Category extends InternalProductionOwnerCategoryV1,
>(
  identity: InternalProductionCanonicalOwnerIdentityV1<Category>,
  input: Record<string, unknown>,
  builder: (input: never) => InternalProductionCanonicalOwnerIdentityV1<Category>,
  code: string,
): Readonly<Record<string, unknown>> {
  let expected: InternalProductionCanonicalOwnerIdentityV1<Category>;
  try {
    expected = builder(input as never);
  } catch {
    throw new Error(code);
  }
  if (!sameJsonValueV1(identity, expected)) throw new Error(code);
  return Object.freeze({ ...input });
}

function p3CompositeOwnerKeyV1(
  ownerKey: string,
  keys: readonly string[],
  schema: string,
  code: string,
): Record<string, unknown> {
  let body: Record<string, unknown>;
  try {
    body = strictCanonicalText(ownerKey, code);
    exactObjectKeys(body, keys, code);
  } catch {
    throw new Error(code);
  }
  if (body.schema !== schema) throw new Error(code);
  return body;
}

function validateP3IssuedTerminalCloseInputV1(
  sql: InternalProductionPgTransactionSql,
  input: unknown,
): P3IssuedTerminalCloseInputV1 {
  const code = "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_INPUT_INVALID";
  if (
    input === null
    || typeof input !== "object"
    || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype
    || !Object.isFrozen(input)
  ) throw new TypeError(code);
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== P3_RESOLVED_CLOSE_INPUT_KEYS_V1.length
    || ownKeys.some((key, index) => key !== P3_RESOLVED_CLOSE_INPUT_KEYS_V1[index])
  ) throw new TypeError(code);
  const values: Record<string, unknown> = {};
  for (const key of P3_RESOLVED_CLOSE_INPUT_KEYS_V1) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      !descriptor
      || !("value" in descriptor)
      || !descriptor.enumerable
      || descriptor.configurable
      || descriptor.writable
      || typeof descriptor.value !== "string"
    ) throw new TypeError(code);
    values[key] = descriptor.value;
  }
  const issued = P3_ISSUED_TERMINAL_CLOSE_INPUTS_V1.get(input);
  if (
    !issued
    || issued.sql !== sql
    || issued.reservationRef !== values.reservationRef
    || issued.reservationHash !== values.reservationHash
    || issued.terminalAuthorityRef !== values.terminalAuthorityRef
    || issued.terminalAuthorityHash !== values.terminalAuthorityHash
  ) throw new TypeError(code);
  return issued;
}

async function resolveUniqueP3OwnerSidecarV1<
  Category extends InternalProductionOwnerCategoryV1,
>(
  sql: InternalProductionPgTransactionSql,
  config: P3TerminalResolverConfigV1<Category>,
  identity: InternalProductionCanonicalOwnerIdentityV1<Category>,
): Promise<Readonly<{
  row: OwnerReservationRowV1;
  bound: InternalProductionBoundOwnerReservationV1<Category>;
}>> {
  const rows = await sql<OwnerReservationRowV1[]>`
    SELECT *
      FROM internal_production_owner_reservations_v1
     WHERE category=${config.category}
       AND owner_key=${identity.ownerKey}
       AND producer_implementation_id=ANY(${config.implementationIds})
       AND state IN ('bound','closed')
     FOR UPDATE
  `;
  if (rows.length !== 1) throw new Error(`INTERNAL_PRODUCTION_${config.category.toUpperCase().replaceAll("-", "_")}_OWNER_UNAVAILABLE`);
  const row = rows[0]!;
  try {
    const reservation = await resolveOwnerReservationInTransactionV1(sql, {
      reservationRef: row.reservation_ref,
      reservationHash: row.reservation_hash,
    }, true);
    const bound = await validateBoundOwnerReservationRowV1<Category>(sql, row, reservation);
    if (
      !config.implementationIds.includes(reservation.producerImplementationId)
      || reservation.category !== config.category
      || bound.category !== config.category
      || bound.ownerKey !== identity.ownerKey
      || !sameJsonValueV1(bound.canonicalOwnerIdentity, identity)
    ) throw new Error();
    return Object.freeze({ row, bound });
  } catch {
    throw new Error(`INTERNAL_PRODUCTION_${config.category.toUpperCase().replaceAll("-", "_")}_OWNER_CORRUPTION`);
  }
}

async function resolveExactP3TerminalAuthorityV1<
  Category extends InternalProductionOwnerCategoryV1,
>(
  sql: InternalProductionPgTransactionSql,
  config: P3TerminalResolverConfigV1<Category>,
  input: unknown,
): Promise<Readonly<{
  sidecar: Readonly<{
    row: OwnerReservationRowV1;
    bound: InternalProductionBoundOwnerReservationV1<Category>;
  }>;
  authority: InternalProductionTerminalOwnerAuthorityV1<Category>;
}>> {
  const projection = await config.lockProjection(sql, input);
  const sidecar = await resolveUniqueP3OwnerSidecarV1(sql, config, projection.identity);
  const authority = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: sidecar.bound.canonicalOwnerIdentity,
    terminalOwnerRef: `${projection.identity.ownerRef}/terminal/${projection.status}`,
    terminalOwnerHash: projection.terminalOwnerHash,
  });
  if (
    sidecar.row.state === "closed"
    && (
      sidecar.row.terminal_owner_ref !== authority.terminalOwnerRef
      || sidecar.row.terminal_owner_hash !== authority.terminalOwnerHash
    )
  ) throw new Error(`INTERNAL_PRODUCTION_${config.category.toUpperCase().replaceAll("-", "_")}_OWNER_CORRUPTION`);
  return Object.freeze({ sidecar, authority });
}

function createPrivateP3TerminalResolverV1<
  Category extends InternalProductionOwnerCategoryV1,
>(config: P3TerminalResolverConfigV1<Category>): OwnerTerminalResolverV1 {
  return Object.freeze({
    resolveByAuthorityPair: async (sql, input, exactInput) => {
      const pair = validateOwnerAdmissionPairV1(
        input,
        "terminalAuthorityRef",
        "terminalAuthorityHash",
        "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID",
      ) as InternalProductionTerminalOwnerAuthorityPairV1;
      if (exactInput === undefined) {
        throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
      }
      const resolved = await resolveExactP3TerminalAuthorityV1(sql, config, exactInput);
      const exactPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(
        resolved.authority,
      );
      if (
        exactPair.terminalAuthorityRef !== pair.terminalAuthorityRef
        || exactPair.terminalAuthorityHash !== pair.terminalAuthorityHash
      ) throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
      return resolved.authority;
    },
    resolveByTerminalOwnerPair: async (sql, input, exactInput) => {
      const pair = validateOwnerAdmissionPairV1(
        input,
        "terminalOwnerRef",
        "terminalOwnerHash",
        "INTERNAL_PRODUCTION_TERMINAL_OWNER_PAIR_INVALID",
      );
      if (exactInput === undefined) {
        throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
      }
      const resolved = await resolveExactP3TerminalAuthorityV1(sql, config, exactInput);
      if (
        resolved.authority.terminalOwnerRef !== pair.terminalOwnerRef
        || resolved.authority.terminalOwnerHash !== pair.terminalOwnerHash
      ) throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
      return resolved.authority;
    },
  });
}

const CLAIM_TERMINAL_RESOLVER_CONFIG_V1: P3TerminalResolverConfigV1<"claim"> = Object.freeze({
  category: "claim",
  implementationIds: CLAIM_OWNER_IMPLEMENTATION_IDS_V1,
  exactInputFromIdentity: (identity) => exactP3InputFromIdentityV1(
    identity,
    { claimIdText: identity.ownerKey },
    createInternalProductionClaimCanonicalOwnerIdentityV1,
    "INTERNAL_PRODUCTION_CLAIM_OWNER_CORRUPTION",
  ),
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionClaimCanonicalOwnerIdentityV1(input as never);
    const rows = await sql<Array<{ claim_id_text: string; outcome: string | null }>>`
      SELECT id::text AS claim_id_text,outcome FROM claim_log
       WHERE id=${identity.ownerKey}::bigint FOR UPDATE
    `;
    const row = rows[0];
    if (
      rows.length !== 1
      || !row
      || row.claim_id_text !== identity.ownerKey
      || !CLAIM_TERMINAL_STATUSES_V1.includes(row.outcome as never)
    ) throw new Error("INTERNAL_PRODUCTION_CLAIM_OWNER_UNAVAILABLE");
    const status = row.outcome as typeof CLAIM_TERMINAL_STATUSES_V1[number];
    return Object.freeze({
      identity,
      status,
      terminalOwnerHash: hashCanonicalJson({
        schema: "setfarm.internal-production-claim-terminal-owner.v1",
        claimId: identity.ownerKey,
        status,
      }),
    });
  },
});

const EXECUTION_ATTEMPT_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"execution-attempt"> = Object.freeze({
  category: "execution-attempt",
  implementationIds: Object.freeze(["a-execution-attempt-v1"]),
  exactInputFromIdentity: (identity) => exactP3InputFromIdentityV1(
    identity,
    { attemptId: identity.ownerKey },
    createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1,
    "INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_OWNER_CORRUPTION",
  ),
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1(input as never);
    const rows = await sql<Array<{ attempt_id: string; disposition: string }>>`
      SELECT attempt_id,disposition FROM execution_attempts
       WHERE attempt_id=${identity.ownerKey} FOR UPDATE
    `;
    const row = rows[0];
    if (
      rows.length !== 1
      || !row
      || !EXECUTION_ATTEMPT_TERMINAL_STATUSES_V1.includes(row.disposition as never)
    ) throw new Error("INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_OWNER_UNAVAILABLE");
    const status = row.disposition as typeof EXECUTION_ATTEMPT_TERMINAL_STATUSES_V1[number];
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-execution-attempt-terminal-owner.v1",
      attemptId: row.attempt_id,
      status,
    }) });
  },
});

const RUNTIME_SESSION_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"runtime-session"> = Object.freeze({
  category: "runtime-session",
  implementationIds: Object.freeze(["a-runtime-session-v1"]),
  exactInputFromIdentity: (identity) => exactP3InputFromIdentityV1(
    identity,
    { sessionId: identity.ownerKey },
    createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1,
    "INTERNAL_PRODUCTION_RUNTIME_SESSION_OWNER_CORRUPTION",
  ),
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1(input as never);
    const rows = await sql<Array<{ session_id: string; state: string }>>`
      SELECT session_id,state FROM runtime_sessions
       WHERE session_id=${identity.ownerKey} FOR UPDATE
    `;
    const row = rows[0];
    if (rows.length !== 1 || !row || !RUNTIME_SESSION_TERMINAL_STATUSES_V1.includes(row.state as never)) {
      throw new Error("INTERNAL_PRODUCTION_RUNTIME_SESSION_OWNER_UNAVAILABLE");
    }
    const status = row.state as typeof RUNTIME_SESSION_TERMINAL_STATUSES_V1[number];
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-runtime-session-terminal-owner.v1",
      sessionId: row.session_id,
      status,
    }) });
  },
});

const COMPLETION_OWNER_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"completion-owner"> = Object.freeze({
  category: "completion-owner",
  implementationIds: Object.freeze(["a-completion-owner-v1"]),
  exactInputFromIdentity: (identity) => exactP3InputFromIdentityV1(
    identity,
    { requestId: identity.ownerKey },
    createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1,
    "INTERNAL_PRODUCTION_COMPLETION_OWNER_CORRUPTION",
  ),
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1(input as never);
    const rows = await sql<Array<{
      request_id: string;
      state: string;
      claim_id_text: string;
      run_id: string;
      step_db_id: string;
      workflow_step_id: string;
      output_hash: string;
      completion_plan: unknown;
      completion_plan_hash: string | null;
      prepared_at: Date | string | null;
    }>>`
      SELECT request_id,state,claim_id::text AS claim_id_text,run_id,step_db_id,
             workflow_step_id,output_hash,completion_plan,completion_plan_hash,prepared_at
        FROM runtime_completion_requests
       WHERE request_id=${identity.ownerKey} FOR UPDATE
    `;
    const effects = await sql<Array<{
      effect_key: string;
      ordinal: number;
      effect_type: string;
      input_hash: string;
      payload: unknown;
      mandatory: boolean;
    }>>`
      SELECT effect_key,ordinal,effect_type,input_hash,payload,mandatory
        FROM runtime_completion_effects
       WHERE request_id=${identity.ownerKey} ORDER BY ordinal,effect_key FOR UPDATE`;
    const row = rows[0];
    if (rows.length !== 1 || !row || !COMPLETION_OWNER_TERMINAL_STATUSES_V1.includes(row.state as never)) {
      throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_UNAVAILABLE");
    }
    try {
      if (row.completion_plan === null) {
        if (
          row.state === "accepted"
          || row.completion_plan_hash !== null
          || row.prepared_at !== null
          || effects.length !== 0
        ) throw new Error();
      } else {
        const plan = RuntimeCompletionPlanV1Schema.parse(row.completion_plan);
        const preparedAt = row.prepared_at instanceof Date
          ? row.prepared_at.toISOString()
          : new Date(row.prepared_at as string).toISOString();
        if (
          row.completion_plan_hash === null
          || row.prepared_at === null
          || hashCanonicalJson(plan) !== row.completion_plan_hash
          || plan.requestId !== row.request_id
          || String(plan.claimId) !== row.claim_id_text
          || plan.runId !== row.run_id
          || plan.stepDbId !== row.step_db_id
          || plan.workflowStepId !== row.workflow_step_id
          || plan.outputHash !== row.output_hash
          || plan.preparedAt !== preparedAt
          || plan.effects.some((effect, index) => effect.ordinal !== index)
          || plan.effects.length !== effects.length
        ) throw new Error();
        for (const [index, effect] of effects.entries()) {
          const spec = plan.effects[index]!;
          const effectInput = RuntimeCompletionEffectInputV1Schema.parse(effect.payload);
          if (
            effect.effect_key !== spec.effectKey
            || effect.ordinal !== spec.ordinal
            || effect.effect_type !== spec.effectType
            || effect.mandatory !== spec.mandatory
            || hashCanonicalJson(effectInput) !== effect.input_hash
            || effectInput.planHash !== row.completion_plan_hash
            || !sameJsonValueV1(effectInput.plan, plan)
            || !sameJsonValueV1(effectInput.effect, spec.payload)
          ) throw new Error();
        }
      }
    } catch {
      throw new Error("INTERNAL_PRODUCTION_COMPLETION_OWNER_UNAVAILABLE");
    }
    const status = row.state as typeof COMPLETION_OWNER_TERMINAL_STATUSES_V1[number];
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-completion-owner-terminal.v1",
      requestId: row.request_id,
      status,
    }) });
  },
});

const MANDATORY_EFFECT_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"mandatory-effect"> = Object.freeze({
  category: "mandatory-effect",
  implementationIds: Object.freeze(["a-mandatory-effect-v1"]),
  exactInputFromIdentity: (identity) => {
    const body = p3CompositeOwnerKeyV1(
      identity.ownerKey,
      ["schema", "requestId", "effectKey"],
      "setfarm.internal-production-completion-request-id-effect-key.v1",
      "INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_CORRUPTION",
    );
    return exactP3InputFromIdentityV1(
      identity,
      { requestId: body.requestId, effectKey: body.effectKey },
      createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1,
      "INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_CORRUPTION",
    );
  },
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(input as never);
    const exact = input as Readonly<{ requestId: string; effectKey: string }>;
    const parents = await sql`SELECT request_id,state FROM runtime_completion_requests
       WHERE request_id=${exact.requestId} FOR UPDATE`;
    const rows = await sql<Array<{ request_id: string; effect_key: string; state: string }>>`
      SELECT request_id,effect_key,state FROM runtime_completion_effects
       WHERE request_id=${exact.requestId} AND effect_key=${exact.effectKey} AND mandatory=TRUE
       FOR UPDATE
    `;
    const row = rows[0];
    if (
      parents.length !== 1
      || rows.length !== 1
      || !row
      || !MANDATORY_EFFECT_TERMINAL_STATUSES_V1.includes(row.state as never)
    ) throw new Error("INTERNAL_PRODUCTION_MANDATORY_EFFECT_OWNER_UNAVAILABLE");
    const status = row.state as typeof MANDATORY_EFFECT_TERMINAL_STATUSES_V1[number];
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-mandatory-effect-terminal-owner.v1",
      requestId: row.request_id,
      effectKey: row.effect_key,
      status,
    }) });
  },
});

const TERMINATION_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"termination"> = Object.freeze({
  category: "termination",
  implementationIds: Object.freeze(["a-termination-v1"]),
  exactInputFromIdentity: (identity) => exactP3InputFromIdentityV1(
    identity,
    { requestId: identity.ownerKey },
    createInternalProductionTerminationCanonicalOwnerIdentityV1,
    "INTERNAL_PRODUCTION_TERMINATION_OWNER_CORRUPTION",
  ),
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionTerminationCanonicalOwnerIdentityV1(input as never);
    const rows = await sql<Array<{ request_id: string; state: string }>>`
      SELECT request_id,state FROM run_termination_requests
       WHERE request_id=${identity.ownerKey} FOR UPDATE
    `;
    const row = rows[0];
    if (rows.length !== 1 || !row || row.state !== "terminalized") {
      throw new Error("INTERNAL_PRODUCTION_TERMINATION_OWNER_UNAVAILABLE");
    }
    const status = "terminalized" as const;
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-termination-terminal-owner.v1",
      requestId: row.request_id,
      status,
    }) });
  },
});

const FINDING_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"finding"> = Object.freeze({
  category: "finding",
  implementationIds: FINDING_OWNER_IMPLEMENTATION_IDS_V1,
  exactInputFromIdentity: (identity) => exactP3InputFromIdentityV1(
    identity,
    { findingSetHash: identity.ownerKey },
    createInternalProductionFindingCanonicalOwnerIdentityV1,
    "INTERNAL_PRODUCTION_FINDING_OWNER_CORRUPTION",
  ),
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionFindingCanonicalOwnerIdentityV1(input as never);
    const sets = await sql<Array<{ finding_set_hash: string; finding_ids: unknown }>>`
      SELECT finding_set_hash,finding_ids FROM finding_sets
       WHERE finding_set_hash=${identity.ownerKey} FOR UPDATE
    `;
    const children = await sql<Array<{ finding_id: string }>>`
      SELECT finding_id FROM findings
       WHERE finding_set_hash=${identity.ownerKey} ORDER BY finding_id FOR UPDATE
    `;
    const set = sets[0];
    const childIds = children.map(({ finding_id }) => finding_id).sort();
    const rawFindingIds = set?.finding_ids;
    const expectedIds = Array.isArray(rawFindingIds)
      ? [...rawFindingIds].map(String).sort()
      : null;
    if (sets.length !== 1 || !set || expectedIds === null || !sameJsonValueV1(childIds, expectedIds)) {
      throw new Error("INTERNAL_PRODUCTION_FINDING_OWNER_UNAVAILABLE");
    }
    const status = "published" as const;
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-finding-terminal-owner.v1",
      findingSetHash: set.finding_set_hash,
      status,
    }) });
  },
});

const OPERATIONAL_DELIVERY_TERMINAL_RESOLVER_CONFIG_V1:
P3TerminalResolverConfigV1<"operational-delivery"> = Object.freeze({
  category: "operational-delivery",
  implementationIds: Object.freeze(["a-operational-delivery-v1"]),
  exactInputFromIdentity: (identity) => {
    const body = p3CompositeOwnerKeyV1(
      identity.ownerKey,
      ["schema", "eventKey", "consumer"],
      "setfarm.internal-production-operational-event-key-consumer.v1",
      "INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_OWNER_CORRUPTION",
    );
    return exactP3InputFromIdentityV1(
      identity,
      { eventKey: body.eventKey, consumer: body.consumer },
      createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1,
      "INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_OWNER_CORRUPTION",
    );
  },
  lockProjection: async (sql, input) => {
    const identity = createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(input as never);
    const exact = input as Readonly<{ eventKey: string; consumer: "jsonl" | "webhook" }>;
    const events = await sql`SELECT event_key,event_hash FROM operational_events
       WHERE event_key=${exact.eventKey} FOR UPDATE`;
    const rows = await sql<Array<{ event_key: string; consumer: "jsonl" | "webhook"; state: string }>>`
      SELECT event_key,consumer,state FROM operational_event_deliveries
       WHERE event_key=${exact.eventKey} AND consumer=${exact.consumer} FOR UPDATE
    `;
    const row = rows[0];
    if (
      events.length !== 1
      || rows.length !== 1
      || !row
      || !OPERATIONAL_DELIVERY_TERMINAL_STATUSES_V1.includes(row.state as never)
    ) throw new Error("INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_OWNER_UNAVAILABLE");
    const status = row.state as typeof OPERATIONAL_DELIVERY_TERMINAL_STATUSES_V1[number];
    return Object.freeze({ identity, status, terminalOwnerHash: hashCanonicalJson({
      schema: "setfarm.internal-production-operational-delivery-terminal-owner.v1",
      eventKey: row.event_key,
      consumer: row.consumer,
      status,
    }) });
  },
});

const CLAIM_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(CLAIM_TERMINAL_RESOLVER_CONFIG_V1);
const EXECUTION_ATTEMPT_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(EXECUTION_ATTEMPT_TERMINAL_RESOLVER_CONFIG_V1);
const RUNTIME_SESSION_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(RUNTIME_SESSION_TERMINAL_RESOLVER_CONFIG_V1);
const COMPLETION_OWNER_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(COMPLETION_OWNER_TERMINAL_RESOLVER_CONFIG_V1);
const MANDATORY_EFFECT_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(MANDATORY_EFFECT_TERMINAL_RESOLVER_CONFIG_V1);
const TERMINATION_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(TERMINATION_TERMINAL_RESOLVER_CONFIG_V1);
const FINDING_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(FINDING_TERMINAL_RESOLVER_CONFIG_V1);
const OPERATIONAL_DELIVERY_TERMINAL_AUTHORITY_RESOLVER_V1 =
  createPrivateP3TerminalResolverV1(OPERATIONAL_DELIVERY_TERMINAL_RESOLVER_CONFIG_V1);

const OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1: Readonly<Partial<Record<
  InternalProductionOwnerCategoryV1,
  OwnerTerminalResolverV1
>>> = Object.freeze({
  run: Object.freeze({
    resolveByAuthorityPair: resolveWorkflowRunTerminalAuthorityByAuthorityPairV1,
    resolveByTerminalOwnerPair: resolveWorkflowRunTerminalAuthorityByTerminalOwnerPairV1,
  }),
  claim: CLAIM_TERMINAL_AUTHORITY_RESOLVER_V1,
  "execution-attempt": EXECUTION_ATTEMPT_TERMINAL_AUTHORITY_RESOLVER_V1,
  "runtime-session": RUNTIME_SESSION_TERMINAL_AUTHORITY_RESOLVER_V1,
  "completion-owner": COMPLETION_OWNER_TERMINAL_AUTHORITY_RESOLVER_V1,
  "mandatory-effect": MANDATORY_EFFECT_TERMINAL_AUTHORITY_RESOLVER_V1,
  termination: TERMINATION_TERMINAL_AUTHORITY_RESOLVER_V1,
  finding: FINDING_TERMINAL_AUTHORITY_RESOLVER_V1,
  "operational-delivery": OPERATIONAL_DELIVERY_TERMINAL_AUTHORITY_RESOLVER_V1,
});

const P3_TERMINAL_EXACT_INPUT_PROJECTORS_V1: Readonly<Partial<Record<
  InternalProductionOwnerCategoryV1,
  (
    identity: InternalProductionCanonicalOwnerIdentityV1,
  ) => Readonly<Record<string, unknown>>
>>> = Object.freeze({
  claim: (identity) => CLAIM_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
    identity as InternalProductionCanonicalOwnerIdentityV1<"claim">,
  ),
  "execution-attempt": (identity) => (
    EXECUTION_ATTEMPT_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
      identity as InternalProductionCanonicalOwnerIdentityV1<"execution-attempt">,
    )
  ),
  "runtime-session": (identity) => (
    RUNTIME_SESSION_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
      identity as InternalProductionCanonicalOwnerIdentityV1<"runtime-session">,
    )
  ),
  "completion-owner": (identity) => (
    COMPLETION_OWNER_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
      identity as InternalProductionCanonicalOwnerIdentityV1<"completion-owner">,
    )
  ),
  "mandatory-effect": (identity) => (
    MANDATORY_EFFECT_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
      identity as InternalProductionCanonicalOwnerIdentityV1<"mandatory-effect">,
    )
  ),
  termination: (identity) => TERMINATION_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
    identity as InternalProductionCanonicalOwnerIdentityV1<"termination">,
  ),
  finding: (identity) => FINDING_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
    identity as InternalProductionCanonicalOwnerIdentityV1<"finding">,
  ),
  "operational-delivery": (identity) => (
    OPERATIONAL_DELIVERY_TERMINAL_RESOLVER_CONFIG_V1.exactInputFromIdentity(
      identity as InternalProductionCanonicalOwnerIdentityV1<"operational-delivery">,
    )
  ),
});

const OWNER_ADMISSION_REPOSITORY_V1: InternalProductionOwnerAdmissionRepositoryV1 = Object.freeze({
  withTransaction: <Result>(operation: (sql: InternalProductionPgTransactionSql) => Promise<Result>) => (
    getSql().begin((rawSql) => operation(rawSql as InternalProductionPgTransactionSql)) as unknown as Promise<Result>
  ),
  resolveReservation: resolveOwnerReservationInTransactionV1,
  resolveClose: resolveOwnerCloseInTransactionV1,
  beginOrAdoptInTransactionV1: beginOrAdoptOwnerReservationInTransactionV1,
  bindInTransactionV1: bindOwnerReservationInTransactionV1,
  closeInTransactionV1: closeOwnerReservationInTransactionV1,
});

const OWNER_ADMISSION_CONTROLLER_V1: InternalProductionOwnerAdmissionControllerV1 = Object.freeze({
  resolveInternalProductionOwnerReservationV1: OWNER_ADMISSION_REPOSITORY_V1.resolveReservation,
  resolveInternalProductionOwnerReservationCloseV1: OWNER_ADMISSION_REPOSITORY_V1.resolveClose,
  beginOrAdoptInternalProductionOwnerReservationV1: OWNER_ADMISSION_REPOSITORY_V1.beginOrAdoptInTransactionV1,
  bindInternalProductionOwnerReservationV1: OWNER_ADMISSION_REPOSITORY_V1.bindInTransactionV1,
  closeInternalProductionOwnerReservationV1: async (
    sql: InternalProductionPgTransactionSql,
    input: Readonly<{
      reservationRef: string;
      reservationHash: string;
      terminalAuthorityRef: string;
      terminalAuthorityHash: string;
    }>,
  ) => {
    const issuedCandidate = input !== null && typeof input === "object"
      ? P3_ISSUED_TERMINAL_CLOSE_INPUTS_V1.get(input)
      : undefined;
    const p3Issued = issuedCandidate === undefined
      ? null
      : validateP3IssuedTerminalCloseInputV1(sql, input);
    if (p3Issued === null) {
      exactObjectKeys(
        input,
        P3_RESOLVED_CLOSE_INPUT_KEYS_V1,
        "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_INPUT_INVALID",
      );
    }
    const reservation = await OWNER_ADMISSION_REPOSITORY_V1.resolveReservation(sql, {
      reservationRef: p3Issued?.reservationRef ?? input.reservationRef,
      reservationHash: p3Issued?.reservationHash ?? input.reservationHash,
    });
    const resolver = OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1[reservation.category];
    if (!resolver) throw new Error("TERMINAL_AUTHORITY_UNAVAILABLE");
    const p3InputProjector = P3_TERMINAL_EXACT_INPUT_PROJECTORS_V1[reservation.category];
    if (
      (p3Issued === null && p3InputProjector !== undefined)
      || (p3Issued !== null && (
        p3InputProjector === undefined
        || p3Issued.category !== reservation.category
      ))
    ) throw new TypeError("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_INPUT_INVALID");
    const terminalPair = validateOwnerAdmissionPairV1(
      {
        terminalAuthorityRef: p3Issued?.terminalAuthorityRef ?? input.terminalAuthorityRef,
        terminalAuthorityHash: p3Issued?.terminalAuthorityHash ?? input.terminalAuthorityHash,
      },
      "terminalAuthorityRef",
      "terminalAuthorityHash",
      "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID",
    ) as InternalProductionTerminalOwnerAuthorityPairV1;
    const authority = validateInternalProductionTerminalOwnerAuthorityV1(
      await resolver.resolveByAuthorityPair(sql, terminalPair, p3Issued?.exactInput),
    );
    validateInternalProductionTerminalOwnerAuthorityPairV1(terminalPair, authority);
    return OWNER_ADMISSION_REPOSITORY_V1.closeInTransactionV1(sql, {
      reservationRef: reservation.reservationRef,
      reservationHash: reservation.reservationHash,
      resolvedTerminalAuthority: authority,
    });
  },
});

export async function beginOrAdoptInternalProductionOwnerReservationV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ producerImplementationId: string; ownerKey: string }>,
): Promise<InternalProductionOwnerReservationV1> {
  return OWNER_ADMISSION_CONTROLLER_V1.beginOrAdoptInternalProductionOwnerReservationV1(sql, input);
}

export async function bindInternalProductionOwnerReservationV1<
  Category extends InternalProductionOwnerCategoryV1,
>(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{
    reservationRef: string;
    reservationHash: string;
    canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
  }>,
): Promise<InternalProductionBoundOwnerReservationV1<Category>> {
  return OWNER_ADMISSION_CONTROLLER_V1.bindInternalProductionOwnerReservationV1(sql, input);
}

export async function closeInternalProductionOwnerReservationV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{
    reservationRef: string;
    reservationHash: string;
    terminalAuthorityRef: string;
    terminalAuthorityHash: string;
  }>,
): Promise<InternalProductionOwnerReservationCloseV1> {
  return OWNER_ADMISSION_CONTROLLER_V1.closeInternalProductionOwnerReservationV1(sql, input);
}

export async function resolveInternalProductionOwnerReservationV1(input: Readonly<{
  reservationRef: string;
  reservationHash: string;
}>): Promise<InternalProductionOwnerReservationV1> {
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction((sql) => (
    OWNER_ADMISSION_REPOSITORY_V1.resolveReservation(sql, input)
  ));
}

export async function resolveInternalProductionOwnerReservationCloseV1(input: Readonly<{
  closeRef: string;
  closeHash: string;
}>): Promise<InternalProductionOwnerReservationCloseV1> {
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction((sql) => (
    OWNER_ADMISSION_REPOSITORY_V1.resolveClose(sql, input)
  ));
}

function sourceRunFenceProducerV1(
  implementationId: "a-recovery-source-run-v1" | "a-recovery-source-bootstrap-run-v1",
) {
  const producer = INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.rows.find(
    (row) => row.implementationId === implementationId,
  );
  if (!producer || producer.module !== "src/db-pg.ts") {
    throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PRODUCER_INVALID");
  }
  return producer;
}

async function requireActiveSourceRunFenceProducersV1(
  sql: InternalProductionPgTransactionSql,
): Promise<void> {
  const current = await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql);
  const aNode = current?.nodes.find(({ receipt }) => receipt.phase === "A");
  if (
    !aNode
    || aNode.receipt.orderedManifestHashes.length !== 1
    || aNode.receipt.orderedManifestHashes[0] !== INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash
  ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_MANIFEST_A_INVALID");
  sourceRunFenceProducerV1("a-recovery-source-run-v1");
  sourceRunFenceProducerV1("a-recovery-source-bootstrap-run-v1");
}

function reserveRecoverySourceRunOwnerV1(input: Readonly<{
  ownerKey: string;
  ownerAdmissionHeadPredecessorHash: string;
}>): InternalProductionOwnerReservationV1 {
  return createInternalProductionOwnerReservationV1({
    producer: sourceRunFenceProducerV1("a-recovery-source-run-v1"),
    ownerKey: input.ownerKey,
    ownerAdmissionHeadPredecessorHash: input.ownerAdmissionHeadPredecessorHash,
  });
}

function reserveRecoverySourceBootstrapRunOwnerV1(input: Readonly<{
  ownerKey: string;
  ownerAdmissionHeadPredecessorHash: string;
}>): InternalProductionOwnerReservationV1 {
  return createInternalProductionOwnerReservationV1({
    producer: sourceRunFenceProducerV1("a-recovery-source-bootstrap-run-v1"),
    ownerKey: input.ownerKey,
    ownerAdmissionHeadPredecessorHash: input.ownerAdmissionHeadPredecessorHash,
  });
}

async function resolveGlobalOwnerAdmissionFenceInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  pair: Readonly<{ fenceRef: string; fenceHash: string }>,
): Promise<InternalProductionGlobalOwnerAdmissionFenceV1> {
  exactObjectKeys(pair, ["fenceRef", "fenceHash"], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PAIR_INVALID");
  const rows = await sql<OwnerAdmissionAuthorityRowV1[]>`
    SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body
      FROM internal_production_owner_admission_authorities_v1
     WHERE authority_ref=${pair.fenceRef} AND authority_hash=${pair.fenceHash}
  `;
  if (rows.length !== 1 || rows[0]!.authority_kind !== "fence") {
    throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_UNAVAILABLE");
  }
  const fence = validateInternalProductionGlobalOwnerAdmissionFenceV1(rows[0]!.authority_body);
  if (
    fence.fenceRef !== pair.fenceRef
    || fence.fenceHash !== pair.fenceHash
    || rows[0]!.phase_key !== fence.pendingInputRef
    || rows[0]!.predecessor_head_hash !== fence.predecessorFenceHeadHash
    || rows[0]!.successor_head_hash !== fence.ownerAdmissionHeadHash
  ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_CORRUPTION");
  return fence;
}

async function resolveSourceRunFenceReservationsV1(
  sql: InternalProductionPgTransactionSql,
  fence: InternalProductionGlobalOwnerAdmissionFenceV1,
): Promise<Readonly<{
  sourceRunReservation: InternalProductionOwnerReservationV1;
  runReservation: InternalProductionOwnerReservationV1;
}>> {
  if (fence.targetFamily.kind !== "source-run-launch") {
    throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_TARGET_INVALID");
  }
  const sourceRunReservation = await resolveOwnerReservationInTransactionV1(sql, {
    reservationRef: fence.targetFamily.sourceRunReservation.reservationRef,
    reservationHash: fence.targetFamily.sourceRunReservation.reservationHash,
  }, true);
  const runReservation = await resolveOwnerReservationInTransactionV1(sql, {
    reservationRef: fence.targetFamily.runReservation.reservationRef,
    reservationHash: fence.targetFamily.runReservation.reservationHash,
  }, true);
  if (
    sourceRunReservation.category !== "source-run"
    || sourceRunReservation.producerImplementationId !== "a-recovery-source-run-v1"
    || sourceRunReservation.ownerKeyHash !== fence.targetFamily.sourceRunReservation.ownerKeyHash
    || runReservation.category !== "run"
    || runReservation.producerImplementationId !== "a-recovery-source-bootstrap-run-v1"
    || runReservation.ownerKeyHash !== fence.targetFamily.runReservation.ownerKeyHash
  ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_RESERVATION_INVALID");
  return Object.freeze({ sourceRunReservation, runReservation });
}

async function requireNoUnrelatedOpenOwnerReservationsV1(
  sql: InternalProductionPgTransactionSql,
  allowedPairs: readonly Readonly<{ reservationRef: string; reservationHash: string }>[] = [],
  requireEveryAllowedPairOpen = false,
): Promise<void> {
  const rows = await sql<Array<{ reservation_ref: string; reservation_hash: string; state: string }>>`
    SELECT reservation_ref,reservation_hash,state
      FROM internal_production_owner_reservations_v1
     WHERE state <> 'closed'
     FOR UPDATE
  `;
  if (rows.some((row) => !allowedPairs.some((pair) => (
    pair.reservationRef === row.reservation_ref && pair.reservationHash === row.reservation_hash
  ))) || (requireEveryAllowedPairOpen && rows.length !== allowedPairs.length)) {
    throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_UNRELATED_OWNER_NONZERO");
  }
}

export type InternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-source-bootstrap-run-protocol-authority.v1";
  protocol: "v3";
  protocolVersion: 1;
  compilerReleaseSha: string;
  baseSourceTreeHash: string;
  buildHash: string;
  activationPreflightHash: string;
  releaseAdmissionHash: string;
  releaseAdmissionKind: "release_go";
}>;

export type InternalProductionRecoverySourceBootstrapRunInsertionAuthorityV1 = Readonly<{
  operationRef: string;
  operationHash: string;
  targetRunLaunchCompositeHash: string;
  targetSourceRunReservationRef: string;
  targetSourceRunReservationHash: string;
  targetRunReservationRef: string;
  targetRunReservationHash: string;
  runId: string;
  sourceRunCanonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<"source-run">;
  runCanonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<"run">;
  operationRunBindingHash: string;
  reciprocalRunOperationBindingHash: string;
  activationPreflightHash: string;
  releaseAdmissionHash: string;
}>;

async function resolveRecoverySourceBootstrapRunProtocolAuthorityInTransactionV1(
  sql: InternalProductionPgTransactionSql,
): Promise<InternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1> {
  const current = await resolveCurrentOwnerProducerManifestSetActivationWithChainInTransactionV1(sql, false);
  const sourcePair = current?.current.receipt.orderedSourceBuildAuthorities.find((pair) => pair.plan === "A");
  if (!sourcePair) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_PROTOCOL_SOURCE_UNAVAILABLE");
  const sourceAuthority = await resolveOwnerProducerSourceInTransactionV1(sql, sourcePair);
  const source = sourceAuthority.setfarmSource;
  const rows = await sql<Array<{
    admission_hash: string;
    kind: string;
    release_sha: string;
    suite_hash: string;
    result_hash: string | null;
    result_ref: string | null;
    gate_hash: string | null;
    gate_ref: string | null;
    expires_at: Date | string | null;
    payload: unknown;
  }>>`
    SELECT admission_hash,kind,release_sha,suite_hash,result_hash,result_ref,
           gate_hash,gate_ref,expires_at,payload
      FROM v3_release_admissions
     WHERE kind='release_go' AND release_sha=${source.sha}
     LIMIT 2
  `;
  if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RELEASE_GO_UNAVAILABLE");
  const row = rows[0]!;
  const admissionModule = await import("./execution/v3-release-admission.js");
  const parsed = admissionModule.V3ReleaseAdmissionV1Schema.safeParse(row.payload);
  if (!parsed.success || parsed.data.kind !== "release_go") {
    throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RELEASE_GO_INVALID");
  }
  const admission = parsed.data;
  if (
    row.admission_hash !== admission.admissionHash
    || row.kind !== admission.kind
    || row.release_sha !== admission.releaseSha
    || row.suite_hash !== admission.suiteHash
    || row.result_hash !== admission.result.hash
    || row.result_ref !== admission.result.ref
    || row.gate_hash !== admission.gate.hash
    || row.gate_ref !== admission.gate.ref
    || row.expires_at !== null
    || admission.releaseSha !== source.sha
    || admission.expiresAt !== null
    || admission.slots.length !== 0
  ) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RELEASE_GO_INVALID");
  const [{ ContentAddressedEvalResultStore }, runtime] = await Promise.all([
    import("./evals/report.js"),
    import("./runtime-config.js"),
  ]);
  const store = new ContentAddressedEvalResultStore(runtime.resolveConvergenceEvalResultDir());
  const [result, gate] = await Promise.all([
    store.getVersionedResult(admission.result.hash),
    store.getReleaseGate(admission.gate.hash),
  ]);
  if (
    result.releaseSha !== admission.releaseSha
    || result.suiteHash !== admission.suiteHash
    || result.preflight.preflightHash !== admission.preflightHash
    || gate.releaseSha !== admission.releaseSha
    || gate.resultHash !== admission.result.hash
    || gate.gateHash !== admission.gate.hash
  ) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RELEASE_GO_ARTIFACT_INVALID");
  return Object.freeze({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-protocol-authority.v1",
    protocol: "v3",
    protocolVersion: 1,
    compilerReleaseSha: source.sha,
    baseSourceTreeHash: source.treeHash,
    buildHash: source.buildHash,
    activationPreflightHash: admission.preflightHash,
    releaseAdmissionHash: admission.admissionHash,
    releaseAdmissionKind: "release_go",
  });
}

export async function resolveCurrentInternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1(
): Promise<InternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1> {
  if (arguments.length !== 0) {
    throw new Error("RECOVERY_SOURCE_BOOTSTRAP_PROTOCOL_INPUT_FORBIDDEN");
  }
  return getSql().begin("isolation level repeatable read read only", async (rawSql) => (
    resolveRecoverySourceBootstrapRunProtocolAuthorityInTransactionV1(rawSql as InternalProductionPgTransactionSql)
  )) as unknown as Promise<InternalProductionRecoverySourceBootstrapRunProtocolAuthorityV1>;
}

function recoverySourceBootstrapRunBindingAuthorityV1(
  operation: Readonly<Record<string, unknown>>,
): InternalProductionRecoverySourceBootstrapRunInsertionAuthorityV1 {
  const pendingInputRef = String(operation.pendingInputRef);
  const pendingInputHash = String(operation.pendingInputHash);
  const runId = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1",
    pendingInputRef,
    pendingInputHash,
  });
  const sourceRunOwnerKeyHash = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-run-owner-key.v1",
    pendingInputRef,
    pendingInputHash,
  });
  const sourceRunCanonicalOwnerIdentity = Object.freeze({
    schema: "setfarm.internal-production-canonical-owner-identity.v1" as const,
    category: "source-run" as const,
    ownerKey: sourceRunOwnerKeyHash,
    ownerRef: String(operation.operationRef),
    ownerHash: String(operation.operationHash),
  });
  const runCanonicalOwnerIdentity = createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(runId);
  const operationRunBindingHash = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-operation-run-binding.v1",
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    sourceRunReservationRef: operation.targetSourceRunReservationRef,
    sourceRunReservationHash: operation.targetSourceRunReservationHash,
    sourceRunOwnerRef: sourceRunCanonicalOwnerIdentity.ownerRef,
    sourceRunOwnerHash: sourceRunCanonicalOwnerIdentity.ownerHash,
    runReservationRef: operation.targetRunReservationRef,
    runReservationHash: operation.targetRunReservationHash,
    runId,
    runOwnerRef: runCanonicalOwnerIdentity.ownerRef,
    runOwnerHash: runCanonicalOwnerIdentity.ownerHash,
  });
  const reciprocalRunOperationBindingHash = hashCanonicalJson({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-operation-binding.v1",
    runId,
    runOwnerRef: runCanonicalOwnerIdentity.ownerRef,
    runOwnerHash: runCanonicalOwnerIdentity.ownerHash,
    runReservationRef: operation.targetRunReservationRef,
    runReservationHash: operation.targetRunReservationHash,
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    sourceRunOwnerRef: sourceRunCanonicalOwnerIdentity.ownerRef,
    sourceRunOwnerHash: sourceRunCanonicalOwnerIdentity.ownerHash,
    sourceRunReservationRef: operation.targetSourceRunReservationRef,
    sourceRunReservationHash: operation.targetSourceRunReservationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    operationRunBindingHash,
  });
  return Object.freeze({
    operationRef: String(operation.operationRef),
    operationHash: String(operation.operationHash),
    targetRunLaunchCompositeHash: String(operation.targetRunLaunchCompositeHash),
    targetSourceRunReservationRef: String(operation.targetSourceRunReservationRef),
    targetSourceRunReservationHash: String(operation.targetSourceRunReservationHash),
    targetRunReservationRef: String(operation.targetRunReservationRef),
    targetRunReservationHash: String(operation.targetRunReservationHash),
    runId,
    sourceRunCanonicalOwnerIdentity,
    runCanonicalOwnerIdentity,
    operationRunBindingHash,
    reciprocalRunOperationBindingHash,
    activationPreflightHash: String(operation.activationPreflightHash),
    releaseAdmissionHash: String(operation.releaseAdmissionHash),
  });
}

export async function lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ operationRef: string; operationHash: string }>,
): Promise<InternalProductionRecoverySourceBootstrapRunInsertionAuthorityV1> {
  try {
    exactObjectKeys(input, ["operationRef", "operationHash"], "INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_INSERTION_INPUT_INVALID");
    if (typeof input.operationRef !== "string" || typeof input.operationHash !== "string" || !OWNER_ADMISSION_SHA256_V1.test(input.operationHash)) throw new Error();
  } catch {
    throw new TypeError("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_INSERTION_INPUT_INVALID");
  }
  await lockInternalProductionWorkflowRunInsertionFenceV1(sql);
  const head = await lockOwnerAdmissionHeadV1(sql, "present");
  if (!head.activeFenceRef || !head.activeFenceHash) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_FENCE_UNAVAILABLE");
  const fence = await resolveGlobalOwnerAdmissionFenceInTransactionV1(sql, { fenceRef: head.activeFenceRef, fenceHash: head.activeFenceHash });
  if (fence.purpose !== "recovery-d-source-delivery-v1" || fence.targetFamily.kind !== "source-run-launch" || head.activeTargetFamilyHash !== fence.targetFamily.targetFamilyHash) {
    throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_FENCE_INVALID");
  }
  const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
  const resolveOperation = receipt.resolveInternalProductionRecoverySourceBootstrapOperationV1;
  if (typeof resolveOperation !== "function" || resolveOperation.length !== 1) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_OPERATION_RESOLVER_INVALID");
  const operation = await (resolveOperation as (pair: unknown) => Promise<Record<string, unknown>>)(input);
  const authority = recoverySourceBootstrapRunBindingAuthorityV1(operation);
  if (
    authority.targetSourceRunReservationRef !== fence.targetFamily.sourceRunReservation.reservationRef
    || authority.targetSourceRunReservationHash !== fence.targetFamily.sourceRunReservation.reservationHash
    || authority.targetRunReservationRef !== fence.targetFamily.runReservation.reservationRef
    || authority.targetRunReservationHash !== fence.targetFamily.runReservation.reservationHash
    || authority.targetRunLaunchCompositeHash !== fence.targetFamily.targetRunLaunchCompositeHash
  ) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_OPERATION_FENCE_CROSSED");
  const reservations = await resolveSourceRunFenceReservationsV1(sql, fence);
  await requireNoUnrelatedOpenOwnerReservationsV1(sql, [
    { reservationRef: reservations.sourceRunReservation.reservationRef, reservationHash: reservations.sourceRunReservation.reservationHash },
    { reservationRef: reservations.runReservation.reservationRef, reservationHash: reservations.runReservation.reservationHash },
  ], true);
  const protocol = await resolveRecoverySourceBootstrapRunProtocolAuthorityInTransactionV1(sql);
  if (
    operation.baseSourceSha !== protocol.compilerReleaseSha
    || operation.baseSourceTreeHash !== protocol.baseSourceTreeHash
    || operation.buildHash !== protocol.buildHash
    || operation.activationPreflightHash !== protocol.activationPreflightHash
    || operation.releaseAdmissionHash !== protocol.releaseAdmissionHash
  ) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_PROTOCOL_CROSSED");
  return authority;
}

export async function bindInternalProductionRecoverySourceBootstrapRunInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{
    operationRef: string;
    operationHash: string;
    runId: string;
    operationRunBindingHash: string;
    reciprocalRunOperationBindingHash: string;
  }>,
): Promise<Readonly<{
  sourceRunOwnerReservationRef: string;
  sourceRunOwnerReservationHash: string;
  runOwnerReservationRef: string;
  runOwnerReservationHash: string;
}>> {
  try {
    exactObjectKeys(input, ["operationRef", "operationHash", "runId", "operationRunBindingHash", "reciprocalRunOperationBindingHash"], "INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_INPUT_INVALID");
    for (const key of ["operationHash", "runId", "operationRunBindingHash", "reciprocalRunOperationBindingHash"] as const) if (typeof input[key] !== "string" || !OWNER_ADMISSION_SHA256_V1.test(input[key])) throw new Error();
    if (typeof input.operationRef !== "string") throw new Error();
  } catch {
    throw new TypeError("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_INPUT_INVALID");
  }
  const authority = await lockInternalProductionRecoverySourceBootstrapRunInsertionFenceV1(sql, { operationRef: input.operationRef, operationHash: input.operationHash });
  if (input.runId !== authority.runId || input.operationRunBindingHash !== authority.operationRunBindingHash || input.reciprocalRunOperationBindingHash !== authority.reciprocalRunOperationBindingHash) {
    throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_RUN_BINDING_CROSSED");
  }
  const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
  const resolveOperation = receipt.resolveInternalProductionRecoverySourceBootstrapOperationV1;
  if (typeof resolveOperation !== "function" || resolveOperation.length !== 1) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_OPERATION_RESOLVER_INVALID");
  const operation = await (resolveOperation as (pair: unknown) => Promise<Record<string, unknown>>)({ operationRef: input.operationRef, operationHash: input.operationHash });
  const paths = await import("./installer/paths.js");
  const workflowSpec = await import("./installer/workflow-spec.js");
  const workflow = await workflowSpec.loadWorkflowSpec(paths.resolveBundledWorkflowDir("feature-dev"));
  if (workflow.id !== "feature-dev" || !Array.isArray(workflow.steps) || workflow.steps.length === 0 || (workflow.context !== undefined && Reflect.ownKeys(workflow.context).length !== 0)) {
    throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_WORKFLOW_INVALID");
  }
  const sourceTask = "Implement Tasks 1 and 2 from docs/superpowers/plans/2026-08-13-internal-production-recovery-mc-reconciliation-plan.md exactly as written.";
  const expectedContext = canonicalJsonStringify({
    schema: "setfarm.internal-production-recovery-source-bootstrap-run-context.v1",
    task: sourceTask,
    purpose: operation.purpose,
    repository: operation.repository,
    workflow: operation.workflow,
    protocol: operation.protocol,
    promptManifestHash: operation.promptManifestHash,
    baseSourceSha: operation.baseSourceSha,
    baseSourceTreeHash: operation.baseSourceTreeHash,
    buildHash: operation.buildHash,
    activationPreflightHash: operation.activationPreflightHash,
    releaseAdmissionHash: operation.releaseAdmissionHash,
    pendingInputRef: operation.pendingInputRef,
    pendingInputHash: operation.pendingInputHash,
    startIntentRef: operation.startIntentRef,
    startIntentHash: operation.startIntentHash,
    startOutboxRef: operation.startOutboxRef,
    startOutboxHash: operation.startOutboxHash,
    operationRef: operation.operationRef,
    operationHash: operation.operationHash,
    targetSourceRunReservationRef: operation.targetSourceRunReservationRef,
    targetSourceRunReservationHash: operation.targetSourceRunReservationHash,
    targetRunReservationRef: operation.targetRunReservationRef,
    targetRunReservationHash: operation.targetRunReservationHash,
    targetRunLaunchCompositeHash: operation.targetRunLaunchCompositeHash,
    sourceRunOwnerRef: authority.sourceRunCanonicalOwnerIdentity.ownerRef,
    sourceRunOwnerHash: authority.sourceRunCanonicalOwnerIdentity.ownerHash,
    runOwnerRef: authority.runCanonicalOwnerIdentity.ownerRef,
    runOwnerHash: authority.runCanonicalOwnerIdentity.ownerHash,
    operationRunBindingHash: authority.operationRunBindingHash,
    reciprocalRunOperationBindingHash: authority.reciprocalRunOperationBindingHash,
  });
  const runRows = await sql.unsafe<Array<{
    id: string; workflow_id: string; task: string; status: string; context: string;
    notify_url: string | null; protocol: string; protocol_version: number;
    compiler_release_sha: string | null; activation_preflight_hash: string | null;
    release_admission_hash: string | null; created_at: Date | string; updated_at: Date | string;
  }>>(
    `SELECT id,workflow_id,task,status,context,notify_url,protocol,protocol_version,
            compiler_release_sha,activation_preflight_hash,release_admission_hash,
            created_at,updated_at
       FROM runs WHERE id=$1 FOR UPDATE`,
    [authority.runId],
  );
  const run = runRows[0];
  if (
    runRows.length !== 1 || !run || run.id !== authority.runId
    || run.workflow_id !== "feature-dev" || run.task !== sourceTask || run.status !== "running"
    || run.context !== expectedContext || run.notify_url !== null || run.protocol !== "v3"
    || run.protocol_version !== 1 || run.compiler_release_sha !== operation.baseSourceSha
    || run.activation_preflight_hash !== authority.activationPreflightHash
    || run.release_admission_hash !== authority.releaseAdmissionHash
    || !Number.isFinite(new Date(run.created_at).getTime())
    || new Date(run.created_at).toISOString() !== new Date(run.updated_at).toISOString()
  ) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_STORED_RUN_INVALID");
  const storedSteps = await sql.unsafe<Array<{
    id: string; run_id: string; step_id: string; agent_id: string; step_index: number;
    input_template: string; expects: string; status: string; max_retries: number;
    type: string; loop_config: string | null; created_at: Date | string; updated_at: Date | string;
  }>>(
    `SELECT id,run_id,step_id,agent_id,step_index,input_template,expects,status,
            max_retries,type,loop_config,created_at,updated_at
       FROM steps WHERE run_id=$1 ORDER BY step_index,id FOR UPDATE`,
    [authority.runId],
  );
  const workflowStepIds = workflow.steps.map((step) => step.id);
  if (new Set(workflowStepIds).size !== workflowStepIds.length || storedSteps.length !== workflow.steps.length || storedSteps.some((stored, index) => {
    const step = workflow.steps[index];
    if (!step) return true;
    const expectedId = hashCanonicalJson({ schema: "setfarm.internal-production-recovery-source-bootstrap-step-id.v1", runId: authority.runId, stepId: step.id, stepIndex: index });
    return stored.id !== expectedId || stored.run_id !== authority.runId || stored.step_id !== step.id
      || stored.agent_id !== `feature-dev_${step.agent}` || stored.step_index !== index
      || stored.input_template !== step.input || stored.expects !== step.expects
      || stored.status !== (index === 0 ? "pending" : "waiting")
      || stored.max_retries !== (step.max_retries ?? step.on_fail?.max_retries ?? 2)
      || stored.type !== (step.type ?? "single")
      || stored.loop_config !== (step.loop === undefined ? null : canonicalJsonStringify(step.loop))
      || new Date(stored.created_at).toISOString() !== new Date(run.created_at).toISOString()
      || new Date(stored.updated_at).toISOString() !== new Date(run.created_at).toISOString();
  })) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_STORED_STEPS_INVALID");
  const sourceBound = await bindInternalProductionOwnerReservationV1(sql, {
    reservationRef: authority.targetSourceRunReservationRef,
    reservationHash: authority.targetSourceRunReservationHash,
    canonicalOwnerIdentity: authority.sourceRunCanonicalOwnerIdentity,
  });
  const runBound = await bindInternalProductionOwnerReservationV1(sql, {
    reservationRef: authority.targetRunReservationRef,
    reservationHash: authority.targetRunReservationHash,
    canonicalOwnerIdentity: authority.runCanonicalOwnerIdentity,
  });
  return Object.freeze({
    sourceRunOwnerReservationRef: sourceBound.reservationRef,
    sourceRunOwnerReservationHash: sourceBound.reservationHash,
    runOwnerReservationRef: runBound.reservationRef,
    runOwnerReservationHash: runBound.reservationHash,
  });
}

export async function acquireInternalProductionGlobalOwnerAdmissionFenceV1(input: Readonly<{
  purpose:
    | "golden-launch-operation-migration-release-v1"
    | "recovery-d-physical-service-restart-authority-cutover-v1";
  pendingInputRef: string;
  pendingInputHash: string;
  targetFamily: null;
}>): Promise<InternalProductionGlobalOwnerAdmissionFenceV1 & { targetFamily: { kind: "none"; targetFamilyHash: null } }> {
  exactObjectKeys(input, ["purpose", "pendingInputRef", "pendingInputHash", "targetFamily"],
    "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_INPUT_KEYS_INVALID");
  if (
    (input.purpose !== "golden-launch-operation-migration-release-v1"
      && input.purpose !== "recovery-d-physical-service-restart-authority-cutover-v1")
    || typeof input.pendingInputRef !== "string"
    || typeof input.pendingInputHash !== "string"
    || !OWNER_ADMISSION_SHA256_V1.test(input.pendingInputHash)
    || input.targetFamily !== null
  ) throw new TypeError("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_INPUT_INVALID");
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => {
    const head = await lockOwnerAdmissionHeadV1(sql, "either");
    if (head.activeFenceRef !== null && head.activeFenceHash !== null) {
      const adopted = await resolveGlobalOwnerAdmissionFenceInTransactionV1(sql, {
        fenceRef: head.activeFenceRef,
        fenceHash: head.activeFenceHash,
      });
      if (
        adopted.purpose !== input.purpose
        || adopted.pendingInputRef !== input.pendingInputRef
        || adopted.pendingInputHash !== input.pendingInputHash
        || adopted.targetFamily.kind !== "none"
        || head.activeTargetFamilyHash !== null
      ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_CONFLICT");
      await requireNoUnrelatedOpenOwnerReservationsV1(sql);
      return adopted as never;
    }
    await requireNoUnrelatedOpenOwnerReservationsV1(sql);
    const targetFamily = Object.freeze({ kind: "none" as const, targetFamilyHash: null });
    const transition = createInternalProductionGlobalOwnerAdmissionFenceTransitionV1({
      purpose: input.purpose,
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
      targetFamilyHash: hashCanonicalJson(targetFamily),
      ownerIdentitySetHash: hashCanonicalJson([]),
    });
    const successor = ownerAdmissionSuccessorV1({
      version: head.version,
      predecessorHeadHash: head.hash,
      transitionKind: "fence",
      transitionRef: transition.transitionRef,
      transitionHash: transition.transitionHash,
      migrationApplication: head.migrationApplication,
    });
    const fence = createInternalProductionGlobalOwnerAdmissionFenceV1({
      purpose: input.purpose,
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
      targetFamily,
      observedUnrelatedReservationCount: 0,
      observedUnrelatedOwnerCount: 0,
      ownerIdentitySetHash: hashCanonicalJson([]),
      predecessorFenceHeadHash: head.hash,
      ownerAdmissionHeadHash: successor.hash,
    });
    await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${fence.fenceRef},${fence.fenceHash},'fence',${fence.pendingInputRef},${head.hash},${successor.hash},${sql.json(fence)})`;
    const updated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${successor.version},head_hash=${successor.hash},head_payload=${sql.json(successor.payload as postgres.JSONValue)},active_fence_ref=${fence.fenceRef},active_fence_hash=${fence.fenceHash},active_target_family_hash=NULL,updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} AND active_fence_ref IS NULL RETURNING head_version`;
    if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
    return fence as never;
  });
}

export async function acquireInternalProductionRecoveryRestartOwnerAdmissionFenceV1(
  _input: InternalProductionRecoveryRestartOwnerAdmissionFenceInputV1,
): Promise<InternalProductionRecoveryRestartOwnerAdmissionFenceResultV1> {
  throw new Error("BARRIER_AUTHORITY_UNAVAILABLE");
}

export async function closeInternalProductionRecoveryRestartTargetsUnderFenceV1(
  _input: Readonly<{ fenceRef: string; fenceHash: string; terminalCoreRef: string; terminalCoreHash: string }>,
): Promise<InternalProductionRecoveryRestartTargetSetCloseV1> {
  throw new Error("BARRIER_AUTHORITY_UNAVAILABLE");
}

export async function resolveInternalProductionRecoveryRestartTargetSetCloseV1(
  _input: Readonly<{ targetSetCloseRef: string; targetSetCloseHash: string }>,
): Promise<InternalProductionRecoveryRestartTargetSetCloseV1> {
  throw new Error("BARRIER_AUTHORITY_UNAVAILABLE");
}

export async function acquireInternalProductionSourceRunLaunchOwnerAdmissionFenceV1(input: Readonly<{
  purpose: "recovery-d-source-delivery-v1";
  pendingInputRef: string;
  pendingInputHash: string;
}>): Promise<Readonly<{
  fence: InternalProductionGlobalOwnerAdmissionFenceV1 & { targetFamily: { kind: "source-run-launch" } };
  sourceRunReservation: InternalProductionOwnerReservationV1;
  runReservation: InternalProductionOwnerReservationV1;
}>> {
  exactObjectKeys(input, ["purpose", "pendingInputRef", "pendingInputHash"],
    "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_INPUT_KEYS_INVALID");
  if (
    input.purpose !== "recovery-d-source-delivery-v1"
    || typeof input.pendingInputRef !== "string"
    || typeof input.pendingInputHash !== "string"
    || !OWNER_ADMISSION_SHA256_V1.test(input.pendingInputHash)
  ) throw new TypeError("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_INPUT_INVALID");
  const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
  const resolvePending = receipt.resolveInternalProductionRecoverySourceBootstrapPendingInputV1;
  if (typeof resolvePending !== "function" || resolvePending.length !== 1) {
    throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PENDING_RESOLVER_INVALID");
  }
  const pending = await (resolvePending as (pair: Readonly<{ pendingInputRef: string; pendingInputHash: string }>) => Promise<unknown>)({
    pendingInputRef: input.pendingInputRef,
    pendingInputHash: input.pendingInputHash,
  });
  if (
    pending === null || typeof pending !== "object"
    || (pending as Record<string, unknown>).pendingInputRef !== input.pendingInputRef
    || (pending as Record<string, unknown>).pendingInputHash !== input.pendingInputHash
  ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PENDING_INVALID");
  return getSql().begin(async (rawSql) => {
    const sql = rawSql as InternalProductionPgTransactionSql;
    const head = await lockOwnerAdmissionHeadV1(sql, "either");
    const sourceRunSemanticOwnerKeyHash = hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-run-owner-key.v1",
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
    });
    const runSemanticOwnerKeyHash = hashCanonicalJson({
      schema: "setfarm.internal-production-recovery-source-bootstrap-run-owner-key.v1",
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
    });
    const targetRunLaunchCompositeHash = hashCanonicalJson({
      schema: "setfarm.internal-production-source-run-launch-target-composite.v1",
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
      sourceRunOwnerKeyHash: sourceRunSemanticOwnerKeyHash,
      runOwnerKeyHash: runSemanticOwnerKeyHash,
    });
    if (head.activeFenceRef !== null && head.activeFenceHash !== null) {
      const fence = await resolveGlobalOwnerAdmissionFenceInTransactionV1(sql, {
        fenceRef: head.activeFenceRef,
        fenceHash: head.activeFenceHash,
      });
      const reservations = await resolveSourceRunFenceReservationsV1(sql, fence);
      await requireNoUnrelatedOpenOwnerReservationsV1(sql, [
        { reservationRef: reservations.sourceRunReservation.reservationRef, reservationHash: reservations.sourceRunReservation.reservationHash },
        { reservationRef: reservations.runReservation.reservationRef, reservationHash: reservations.runReservation.reservationHash },
      ], true);
      if (
        fence.purpose !== input.purpose
        || fence.pendingInputRef !== input.pendingInputRef
        || fence.pendingInputHash !== input.pendingInputHash
        || fence.targetFamily.kind !== "source-run-launch"
        || fence.targetFamily.targetRunLaunchCompositeHash !== targetRunLaunchCompositeHash
      ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_CONFLICT");
      return Object.freeze({ fence, ...reservations }) as never;
    }
    await requireActiveSourceRunFenceProducersV1(sql);
    await requireNoUnrelatedOpenOwnerReservationsV1(sql);
    const sourceRunReservation = reserveRecoverySourceRunOwnerV1({
      ownerKey: sourceRunSemanticOwnerKeyHash,
      ownerAdmissionHeadPredecessorHash: head.hash,
    });
    const runReservation = reserveRecoverySourceBootstrapRunOwnerV1({
      ownerKey: runSemanticOwnerKeyHash,
      ownerAdmissionHeadPredecessorHash: head.hash,
    });
    const targetFamily = createInternalProductionSourceRunLaunchTargetFamilyV1({
      sourceRunReservation,
      runReservation,
      targetRunLaunchCompositeHash,
    });
    const transition = createInternalProductionGlobalOwnerAdmissionFenceTransitionV1({
      purpose: input.purpose,
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
      targetFamilyHash: targetFamily.targetFamilyHash,
      ownerIdentitySetHash: hashCanonicalJson([]),
    });
    const successor = ownerAdmissionSuccessorV1({
      version: head.version,
      predecessorHeadHash: head.hash,
      transitionKind: "fence",
      transitionRef: transition.transitionRef,
      transitionHash: transition.transitionHash,
      migrationApplication: head.migrationApplication,
    });
    const fence = createInternalProductionGlobalOwnerAdmissionFenceV1({
      purpose: input.purpose,
      pendingInputRef: input.pendingInputRef,
      pendingInputHash: input.pendingInputHash,
      targetFamily,
      observedUnrelatedReservationCount: 0,
      observedUnrelatedOwnerCount: 0,
      ownerIdentitySetHash: hashCanonicalJson([]),
      predecessorFenceHeadHash: head.hash,
      ownerAdmissionHeadHash: successor.hash,
    });
    for (const reservation of [sourceRunReservation, runReservation]) {
      await sql`INSERT INTO internal_production_owner_reservations_v1 (reservation_ref,reservation_hash,category,owner_key,owner_key_hash,producer_purpose_hash,producer_implementation_id,producer_implementation_hash,reservation_payload,reservation_head_predecessor_hash,state,head_version) VALUES (${reservation.reservationRef},${reservation.reservationHash},${reservation.category},${reservation.ownerKey},${reservation.ownerKeyHash},${reservation.producerPurposeHash},${reservation.producerImplementationId},${reservation.producerImplementationHash},${sql.json(reservation)},${head.hash},'pending',${successor.version})`;
      await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${reservation.reservationRef},${reservation.reservationHash},'reservation',${reservation.reservationRef},${head.hash},${successor.hash},${sql.json(reservation)})`;
    }
    await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${fence.fenceRef},${fence.fenceHash},'fence',${fence.pendingInputRef},${head.hash},${successor.hash},${sql.json(fence)})`;
    const updated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${successor.version},head_hash=${successor.hash},head_payload=${sql.json(successor.payload as postgres.JSONValue)},active_fence_ref=${fence.fenceRef},active_fence_hash=${fence.fenceHash},active_target_family_hash=${targetFamily.targetFamilyHash},updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} AND active_fence_ref IS NULL RETURNING head_version`;
    if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
    return Object.freeze({ fence, sourceRunReservation, runReservation }) as never;
  }) as unknown as Promise<Readonly<{
    fence: InternalProductionGlobalOwnerAdmissionFenceV1 & { targetFamily: { kind: "source-run-launch" } };
    sourceRunReservation: InternalProductionOwnerReservationV1;
    runReservation: InternalProductionOwnerReservationV1;
  }>>;
}

export async function reobserveInternalProductionGlobalOwnerAdmissionFenceV1(input: Readonly<{
  fenceRef: string;
  fenceHash: string;
}>): Promise<InternalProductionGlobalOwnerAdmissionFenceV1> {
  exactObjectKeys(input, ["fenceRef", "fenceHash"], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PAIR_INVALID");
  if (
    typeof input.fenceRef !== "string"
    || typeof input.fenceHash !== "string"
    || !OWNER_ADMISSION_SHA256_V1.test(input.fenceHash)
  ) throw new TypeError("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PAIR_INVALID");
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => {
    const head = await lockOwnerAdmissionHeadV1(sql, "present");
    if (
      head.activeFenceRef !== input.fenceRef
      || head.activeFenceHash !== input.fenceHash
    ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_NOT_ACTIVE");
    const fence = await resolveGlobalOwnerAdmissionFenceInTransactionV1(sql, input);
    if (fence.targetFamily.kind === "none") {
      if (head.activeTargetFamilyHash !== null) {
        throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TARGET_INVALID");
      }
      await requireNoUnrelatedOpenOwnerReservationsV1(sql);
      return fence;
    }
    const reservations = await resolveSourceRunFenceReservationsV1(sql, fence);
    if (
      fence.targetFamily.kind !== "source-run-launch"
      || head.activeTargetFamilyHash !== fence.targetFamily.targetFamilyHash
    ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_TARGET_INVALID");
    const states = await sql<Array<{ reservation_ref: string; reservation_hash: string; state: string }>>`
      SELECT reservation_ref,reservation_hash,state
        FROM internal_production_owner_reservations_v1
       WHERE reservation_ref IN (${reservations.sourceRunReservation.reservationRef},${reservations.runReservation.reservationRef})
       ORDER BY reservation_ref
       FOR UPDATE
    `;
    if (
      states.length !== 2
      || !(
        states.every(({ state }) => state === "pending")
        || states.every(({ state }) => state === "bound")
        || states.every(({ state }) => state === "closed")
      )
    ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_FENCE_RESERVATION_STATE_INVALID");
    await requireNoUnrelatedOpenOwnerReservationsV1(sql, [
      { reservationRef: reservations.sourceRunReservation.reservationRef, reservationHash: reservations.sourceRunReservation.reservationHash },
      { reservationRef: reservations.runReservation.reservationRef, reservationHash: reservations.runReservation.reservationHash },
    ]);
    return fence;
  });
}

export async function closeInternalProductionSourceRunLaunchTargetReservationsUnderFenceV1(input: Readonly<{
  fenceRef: string;
  fenceHash: string;
  sourceRunReservationRef: string;
  sourceRunReservationHash: string;
  runReservationRef: string;
  runReservationHash: string;
  terminalSourceRunRef: string;
  terminalSourceRunHash: string;
  terminalRunLaunchRef: string;
  terminalRunLaunchHash: string;
}>): Promise<InternalProductionSourceRunLaunchTargetReservationPairCloseV1> {
  exactObjectKeys(input, [
    "fenceRef", "fenceHash", "sourceRunReservationRef", "sourceRunReservationHash",
    "runReservationRef", "runReservationHash", "terminalSourceRunRef", "terminalSourceRunHash",
    "terminalRunLaunchRef", "terminalRunLaunchHash",
  ], "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_INPUT_KEYS_INVALID");
  for (const [refKey, hashKey] of [
    ["fenceRef", "fenceHash"],
    ["sourceRunReservationRef", "sourceRunReservationHash"],
    ["runReservationRef", "runReservationHash"],
    ["terminalSourceRunRef", "terminalSourceRunHash"],
    ["terminalRunLaunchRef", "terminalRunLaunchHash"],
  ] as const) {
    if (
      typeof input[refKey] !== "string"
      || typeof input[hashKey] !== "string"
      || !OWNER_ADMISSION_SHA256_V1.test(input[hashKey])
    ) throw new TypeError("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_INPUT_INVALID");
  }
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => {
    const head = await lockOwnerAdmissionHeadV1(sql, "present");
    if (head.activeFenceRef !== input.fenceRef || head.activeFenceHash !== input.fenceHash) {
      throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_NOT_ACTIVE");
    }
    const fence = await resolveGlobalOwnerAdmissionFenceInTransactionV1(sql, {
      fenceRef: input.fenceRef,
      fenceHash: input.fenceHash,
    });
    const reservations = await resolveSourceRunFenceReservationsV1(sql, fence);
    if (
      fence.targetFamily.kind !== "source-run-launch"
      || head.activeTargetFamilyHash !== fence.targetFamily.targetFamilyHash
      || reservations.sourceRunReservation.reservationRef !== input.sourceRunReservationRef
      || reservations.sourceRunReservation.reservationHash !== input.sourceRunReservationHash
      || reservations.runReservation.reservationRef !== input.runReservationRef
      || reservations.runReservation.reservationHash !== input.runReservationHash
    ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_TARGET_INVALID");
    const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
    const resolveSourceTerminal = receipt.resolveInternalProductionRecoverySourceRunTerminalAuthorityV1;
    const resolveRunTerminal = receipt.resolveInternalProductionRecoveryRunLaunchTerminalAuthorityV1;
    if (typeof resolveSourceTerminal !== "function" || resolveSourceTerminal.length !== 1 || typeof resolveRunTerminal !== "function" || resolveRunTerminal.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TERMINAL_RESOLVERS_UNAVAILABLE");
    }
    const sourceTerminalBody = await (resolveSourceTerminal as (pair: unknown) => Promise<Record<string, unknown>>)({ terminalSourceRunRef: input.terminalSourceRunRef, terminalSourceRunHash: input.terminalSourceRunHash });
    const runTerminalBody = await (resolveRunTerminal as (pair: unknown) => Promise<Record<string, unknown>>)({ terminalRunLaunchRef: input.terminalRunLaunchRef, terminalRunLaunchHash: input.terminalRunLaunchHash });
    if (
      sourceTerminalBody.targetSourceRunReservationRef !== input.sourceRunReservationRef
      || sourceTerminalBody.targetSourceRunReservationHash !== input.sourceRunReservationHash
      || runTerminalBody.targetRunReservationRef !== input.runReservationRef
      || runTerminalBody.targetRunReservationHash !== input.runReservationHash
      || sourceTerminalBody.targetRunLaunchCompositeHash !== fence.targetFamily.targetRunLaunchCompositeHash
      || runTerminalBody.targetRunLaunchCompositeHash !== fence.targetFamily.targetRunLaunchCompositeHash
      || sourceTerminalBody.operationRef !== runTerminalBody.operationRef
      || sourceTerminalBody.operationHash !== runTerminalBody.operationHash
      || sourceTerminalBody.runId !== runTerminalBody.runId
      || sourceTerminalBody.operationRunBindingHash !== runTerminalBody.operationRunBindingHash
      || sourceTerminalBody.reciprocalRunOperationBindingHash !== runTerminalBody.reciprocalRunOperationBindingHash
    ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TERMINAL_AUTHORITY_CROSSED");
    await requireNoUnrelatedOpenOwnerReservationsV1(sql, [
      { reservationRef: input.sourceRunReservationRef, reservationHash: input.sourceRunReservationHash },
      { reservationRef: input.runReservationRef, reservationHash: input.runReservationHash },
    ]);
    const rows = await sql<OwnerReservationRowV1[]>`
      SELECT * FROM internal_production_owner_reservations_v1
       WHERE reservation_ref IN (${input.sourceRunReservationRef},${input.runReservationRef})
       ORDER BY reservation_ref
       FOR UPDATE
    `;
    if (rows.length !== 2) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_TARGET_INVALID");
    const sourceRow = rows.find(({ reservation_ref }) => reservation_ref === input.sourceRunReservationRef);
    const runRow = rows.find(({ reservation_ref }) => reservation_ref === input.runReservationRef);
    if (!sourceRow || !runRow || sourceRow.state !== runRow.state) {
      throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_PARTIAL");
    }
    if (sourceRow.state === "closed") {
      if (!sourceRow.close_payload || !runRow.close_payload) {
        throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_CORRUPTION");
      }
      const sourceClose = validateInternalProductionOwnerReservationCloseV1(sourceRow.close_payload);
      const runClose = validateInternalProductionOwnerReservationCloseV1(runRow.close_payload);
      const pairClose = createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
        fenceRef: fence.fenceRef,
        fenceHash: fence.fenceHash,
        targetRunLaunchCompositeHash: fence.targetFamily.targetRunLaunchCompositeHash,
        sourceRunReservationRef: input.sourceRunReservationRef,
        sourceRunReservationHash: input.sourceRunReservationHash,
        runReservationRef: input.runReservationRef,
        runReservationHash: input.runReservationHash,
        terminalSourceRunRef: sourceClose.terminalOwnerRef,
        terminalSourceRunHash: sourceClose.terminalOwnerHash,
        terminalRunLaunchRef: runClose.terminalOwnerRef,
        terminalRunLaunchHash: runClose.terminalOwnerHash,
        ownerAdmissionHeadPredecessorHash: sourceClose.ownerAdmissionHeadPredecessorHash,
        ownerAdmissionHeadSuccessorHash: runClose.ownerAdmissionHeadSuccessorHash,
        preservedFenceRef: fence.fenceRef,
        preservedFenceHash: fence.fenceHash,
      });
      if (
        pairClose.terminalSourceRunRef !== input.terminalSourceRunRef
        || pairClose.terminalSourceRunHash !== input.terminalSourceRunHash
        || pairClose.terminalRunLaunchRef !== input.terminalRunLaunchRef
        || pairClose.terminalRunLaunchHash !== input.terminalRunLaunchHash
        || head.hash !== pairClose.ownerAdmissionHeadSuccessorHash
      ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_CONFLICT");
      return pairClose;
    }
    if (sourceRow.state !== "bound") {
      throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_TARGET_NOT_BOUND");
    }
    const sourceBound = await validateBoundOwnerReservationRowV1(sql, sourceRow, reservations.sourceRunReservation);
    const runBound = await validateBoundOwnerReservationRowV1(sql, runRow, reservations.runReservation);
    const sourceTerminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: sourceBound.canonicalOwnerIdentity,
      terminalOwnerRef: input.terminalSourceRunRef,
      terminalOwnerHash: input.terminalSourceRunHash,
    });
    const runTerminal = createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: runBound.canonicalOwnerIdentity,
      terminalOwnerRef: input.terminalRunLaunchRef,
      terminalOwnerHash: input.terminalRunLaunchHash,
    });
    const sourceTransitionHash = hashCanonicalJson({
      schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
      reservationRef: reservations.sourceRunReservation.reservationRef,
      reservationHash: reservations.sourceRunReservation.reservationHash,
      terminalOwnerRef: sourceTerminal.terminalOwnerRef,
      terminalOwnerHash: sourceTerminal.terminalOwnerHash,
    });
    const firstSuccessor = ownerAdmissionSuccessorV1({
      version: head.version,
      predecessorHeadHash: head.hash,
      transitionKind: "close",
      transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${sourceTransitionHash}`,
      transitionHash: sourceTransitionHash,
      migrationApplication: head.migrationApplication,
    });
    const runTransitionHash = hashCanonicalJson({
      schema: "setfarm.internal-production-owner-reservation-close-transition.v1",
      reservationRef: reservations.runReservation.reservationRef,
      reservationHash: reservations.runReservation.reservationHash,
      terminalOwnerRef: runTerminal.terminalOwnerRef,
      terminalOwnerHash: runTerminal.terminalOwnerHash,
    });
    const secondSuccessor = ownerAdmissionSuccessorV1({
      version: firstSuccessor.version,
      predecessorHeadHash: firstSuccessor.hash,
      transitionKind: "close",
      transitionRef: `setfarm://internal-production/owner-reservation-close-transitions/${runTransitionHash}`,
      transitionHash: runTransitionHash,
      migrationApplication: head.migrationApplication,
    });
    const sourceClose = createInternalProductionOwnerReservationCloseV1({
      closeKind: "fence-target",
      boundReservation: sourceBound,
      terminalAuthority: sourceTerminal,
      ownerAdmissionHeadPredecessorHash: head.hash,
      ownerAdmissionHeadSuccessorHash: firstSuccessor.hash,
      preservedFenceRef: fence.fenceRef,
      preservedFenceHash: fence.fenceHash,
    });
    const runClose = createInternalProductionOwnerReservationCloseV1({
      closeKind: "fence-target",
      boundReservation: runBound,
      terminalAuthority: runTerminal,
      ownerAdmissionHeadPredecessorHash: firstSuccessor.hash,
      ownerAdmissionHeadSuccessorHash: secondSuccessor.hash,
      preservedFenceRef: fence.fenceRef,
      preservedFenceHash: fence.fenceHash,
    });
    for (const [row, close, successor] of [
      [sourceRow, sourceClose, firstSuccessor],
      [runRow, runClose, secondSuccessor],
    ] as const) {
      const updated = await sql`UPDATE internal_production_owner_reservations_v1 SET state='closed',close_kind=${close.closeKind},terminal_owner_ref=${close.terminalOwnerRef},terminal_owner_hash=${close.terminalOwnerHash},close_head_predecessor_hash=${close.ownerAdmissionHeadPredecessorHash},close_head_successor_hash=${close.ownerAdmissionHeadSuccessorHash},preserved_fence_ref=${close.preservedFenceRef},preserved_fence_hash=${close.preservedFenceHash},close_ref=${close.closeRef},close_hash=${close.closeHash},close_payload=${sql.json(close)},head_version=${successor.version},updated_at=NOW() WHERE reservation_ref=${row.reservation_ref} AND reservation_hash=${row.reservation_hash} AND state='bound' RETURNING reservation_ref`;
      if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_CONFLICT");
      await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${close.closeRef},${close.closeHash},'close',${close.reservationRef},${close.ownerAdmissionHeadPredecessorHash},${close.ownerAdmissionHeadSuccessorHash},${sql.json(close)})`;
    }
    const headUpdated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${secondSuccessor.version},head_hash=${secondSuccessor.hash},head_payload=${sql.json(secondSuccessor.payload as postgres.JSONValue)},updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} AND active_fence_ref=${fence.fenceRef} AND active_fence_hash=${fence.fenceHash} AND active_target_family_hash=${fence.targetFamily.targetFamilyHash} RETURNING head_version`;
    if (headUpdated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
    return createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
      fenceRef: fence.fenceRef,
      fenceHash: fence.fenceHash,
      targetRunLaunchCompositeHash: fence.targetFamily.targetRunLaunchCompositeHash,
      sourceRunReservationRef: input.sourceRunReservationRef,
      sourceRunReservationHash: input.sourceRunReservationHash,
      runReservationRef: input.runReservationRef,
      runReservationHash: input.runReservationHash,
      terminalSourceRunRef: input.terminalSourceRunRef,
      terminalSourceRunHash: input.terminalSourceRunHash,
      terminalRunLaunchRef: input.terminalRunLaunchRef,
      terminalRunLaunchHash: input.terminalRunLaunchHash,
      ownerAdmissionHeadPredecessorHash: head.hash,
      ownerAdmissionHeadSuccessorHash: secondSuccessor.hash,
      preservedFenceRef: fence.fenceRef,
      preservedFenceHash: fence.fenceHash,
    });
  });
}

async function resolveGlobalOwnerAdmissionFenceReleaseInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ releaseRef: string; releaseHash: string }>,
): Promise<InternalProductionGlobalOwnerAdmissionFenceReleaseV1> {
  exactObjectKeys(input, ["releaseRef", "releaseHash"], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_PAIR_INVALID");
  const rows = await sql<OwnerAdmissionAuthorityRowV1[]>`
    SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body
      FROM internal_production_owner_admission_authorities_v1
     WHERE authority_ref=${input.releaseRef} AND authority_hash=${input.releaseHash}
  `;
  if (rows.length !== 1 || rows[0]!.authority_kind !== "release") {
    throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_UNAVAILABLE");
  }
  const release = validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(rows[0]!.authority_body);
  if (
    release.releaseRef !== input.releaseRef
    || release.releaseHash !== input.releaseHash
    || rows[0]!.phase_key !== release.fenceRef
    || rows[0]!.predecessor_head_hash !== release.ownerAdmissionHeadPredecessorHash
    || rows[0]!.successor_head_hash !== release.ownerAdmissionHeadSuccessorHash
  ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_CORRUPTION");
  return release;
}

export async function resolveInternalProductionGlobalOwnerAdmissionFenceReleaseV1(input: Readonly<{
  releaseRef: string;
  releaseHash: string;
}>): Promise<InternalProductionGlobalOwnerAdmissionFenceReleaseV1> {
  if (
    input === null || typeof input !== "object"
    || typeof input.releaseRef !== "string"
    || typeof input.releaseHash !== "string"
    || !OWNER_ADMISSION_SHA256_V1.test(input.releaseHash)
  ) throw new TypeError("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_PAIR_INVALID");
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction((sql) => (
    resolveGlobalOwnerAdmissionFenceReleaseInTransactionV1(sql, input)
  ));
}

export async function releaseInternalProductionGlobalOwnerAdmissionFenceV1(input: Readonly<{
  fenceRef: string;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
}>): Promise<InternalProductionGlobalOwnerAdmissionFenceReleaseV1> {
  exactObjectKeys(input, ["fenceRef", "fenceHash", "releaseAuthority"],
    "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_INPUT_KEYS_INVALID");
  if (
    typeof input.fenceRef !== "string"
    || typeof input.fenceHash !== "string"
    || !OWNER_ADMISSION_SHA256_V1.test(input.fenceHash)
  ) throw new TypeError("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_INPUT_INVALID");
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => {
    const head = await lockOwnerAdmissionHeadV1(sql, "either");
    if (head.activeFenceRef === null) {
      const rows = await sql<OwnerAdmissionAuthorityRowV1[]>`
        SELECT authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body
          FROM internal_production_owner_admission_authorities_v1
         WHERE authority_kind='release' AND phase_key=${input.fenceRef}
      `;
      if (rows.length !== 1) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_CONFLICT");
      const adopted = await resolveGlobalOwnerAdmissionFenceReleaseInTransactionV1(sql, {
        releaseRef: rows[0]!.authority_ref,
        releaseHash: rows[0]!.authority_hash,
      });
      const ancestry = await validateOwnerAdmissionAncestryToGenesisV1(
        sql,
        head.hash,
        head.version,
        head.migrationApplication,
      );
      const adoptedEdges = ancestry.filter(({ authority }) => (
        authority.authority_kind === "release"
        && authority.authority_ref === adopted.releaseRef
        && authority.authority_hash === adopted.releaseHash
      ));
      if (
        adopted.fenceHash !== input.fenceHash
        || !sameJsonValueV1(adopted.releaseAuthority, input.releaseAuthority)
        || adoptedEdges.length !== 1
      ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_CONFLICT");
      return adopted;
    }
    if (head.activeFenceRef !== input.fenceRef || head.activeFenceHash !== input.fenceHash) {
      throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_NOT_ACTIVE");
    }
    const fence = await resolveGlobalOwnerAdmissionFenceInTransactionV1(sql, {
      fenceRef: input.fenceRef,
      fenceHash: input.fenceHash,
    });
    if (fence.targetFamily.kind === "none") {
      await requireNoUnrelatedOpenOwnerReservationsV1(sql);
      if (
        input.releaseAuthority.purpose !== fence.purpose
        || input.releaseAuthority.targetFamilyKind !== "none"
        || head.activeTargetFamilyHash !== null
      ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_INVALID");
      const transition = createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1({
        fenceRef: fence.fenceRef,
        fenceHash: fence.fenceHash,
        releaseAuthority: input.releaseAuthority,
      });
      const successor = ownerAdmissionSuccessorV1({
        version: head.version,
        predecessorHeadHash: head.hash,
        transitionKind: "release",
        transitionRef: transition.transitionRef,
        transitionHash: transition.transitionHash,
        migrationApplication: head.migrationApplication,
      });
      const release = createInternalProductionGlobalOwnerAdmissionFenceReleaseV1({
        fenceRef: fence.fenceRef,
        fenceHash: fence.fenceHash,
        releaseAuthority: input.releaseAuthority,
        ownerAdmissionHeadPredecessorHash: head.hash,
        ownerAdmissionHeadSuccessorHash: successor.hash,
      });
      await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${release.releaseRef},${release.releaseHash},'release',${release.fenceRef},${head.hash},${successor.hash},${sql.json(release)})`;
      const updated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${successor.version},head_hash=${successor.hash},head_payload=${sql.json(successor.payload as postgres.JSONValue)},active_fence_ref=NULL,active_fence_hash=NULL,active_target_family_hash=NULL,updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} AND active_fence_ref=${fence.fenceRef} AND active_fence_hash=${fence.fenceHash} AND active_target_family_hash IS NULL RETURNING head_version`;
      if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
      return release;
    }
    const reservations = await resolveSourceRunFenceReservationsV1(sql, fence);
    if (fence.targetFamily.kind !== "source-run-launch") {
      throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TARGET_INVALID");
    }
    const rows = await sql<OwnerReservationRowV1[]>`
      SELECT * FROM internal_production_owner_reservations_v1
       WHERE reservation_ref IN (${reservations.sourceRunReservation.reservationRef},${reservations.runReservation.reservationRef})
       ORDER BY reservation_ref
       FOR UPDATE
    `;
    if (rows.length !== 2 || rows.some(({ state, close_kind }) => state !== "closed" || close_kind !== "fence-target")) {
      throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TARGET_OPEN");
    }
    await requireNoUnrelatedOpenOwnerReservationsV1(sql);
    const sourceRow = rows.find(({ reservation_ref }) => reservation_ref === reservations.sourceRunReservation.reservationRef)!;
    const runRow = rows.find(({ reservation_ref }) => reservation_ref === reservations.runReservation.reservationRef)!;
    const sourceClose = validateInternalProductionOwnerReservationCloseV1(sourceRow.close_payload);
    const runClose = validateInternalProductionOwnerReservationCloseV1(runRow.close_payload);
    const pairClose = createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
      fenceRef: fence.fenceRef,
      fenceHash: fence.fenceHash,
      targetRunLaunchCompositeHash: fence.targetFamily.targetRunLaunchCompositeHash,
      sourceRunReservationRef: reservations.sourceRunReservation.reservationRef,
      sourceRunReservationHash: reservations.sourceRunReservation.reservationHash,
      runReservationRef: reservations.runReservation.reservationRef,
      runReservationHash: reservations.runReservation.reservationHash,
      terminalSourceRunRef: sourceClose.terminalOwnerRef,
      terminalSourceRunHash: sourceClose.terminalOwnerHash,
      terminalRunLaunchRef: runClose.terminalOwnerRef,
      terminalRunLaunchHash: runClose.terminalOwnerHash,
      ownerAdmissionHeadPredecessorHash: sourceClose.ownerAdmissionHeadPredecessorHash,
      ownerAdmissionHeadSuccessorHash: runClose.ownerAdmissionHeadSuccessorHash,
      preservedFenceRef: fence.fenceRef,
      preservedFenceHash: fence.fenceHash,
    });
    if (
      sourceClose.ownerAdmissionHeadSuccessorHash !== runClose.ownerAdmissionHeadPredecessorHash
      || head.hash !== pairClose.ownerAdmissionHeadSuccessorHash
    ) throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_HEAD_INVALID");
    const receipt = await import("./internal-production/baseline-post-handoff-receipt-v1.js") as unknown as Record<string, unknown>;
    const resolvePairClose = receipt.resolveInternalProductionSourceRunLaunchTargetReservationPairCloseV1;
    if (typeof resolvePairClose !== "function" || resolvePairClose.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_RESOLVER_INVALID");
    }
    const resolvedPairClose = await (resolvePairClose as (pair: Readonly<{
      targetReservationPairCloseRef: string;
      targetReservationPairCloseHash: string;
    }>) => Promise<unknown>)({
      targetReservationPairCloseRef: pairClose.targetReservationPairCloseRef,
      targetReservationPairCloseHash: pairClose.targetReservationPairCloseHash,
    });
    if (!sameJsonValueV1(resolvedPairClose, pairClose)) {
      throw new Error("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_CORRUPTION");
    }
    if (
      input.releaseAuthority.purpose !== "recovery-d-source-delivery-v1"
      || input.releaseAuthority.targetFamilyKind !== "source-run-launch"
      || input.releaseAuthority.targetReservationPairCloseRef !== pairClose.targetReservationPairCloseRef
      || input.releaseAuthority.targetReservationPairCloseHash !== pairClose.targetReservationPairCloseHash
    ) throw new Error("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_INVALID");
    const transition = createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1({
      fenceRef: fence.fenceRef,
      fenceHash: fence.fenceHash,
      releaseAuthority: input.releaseAuthority,
    });
    const successor = ownerAdmissionSuccessorV1({
      version: head.version,
      predecessorHeadHash: head.hash,
      transitionKind: "release",
      transitionRef: transition.transitionRef,
      transitionHash: transition.transitionHash,
      migrationApplication: head.migrationApplication,
    });
    const release = createInternalProductionGlobalOwnerAdmissionFenceReleaseV1({
      fenceRef: fence.fenceRef,
      fenceHash: fence.fenceHash,
      releaseAuthority: input.releaseAuthority,
      ownerAdmissionHeadPredecessorHash: head.hash,
      ownerAdmissionHeadSuccessorHash: successor.hash,
    });
    await sql`INSERT INTO internal_production_owner_admission_authorities_v1 (authority_ref,authority_hash,authority_kind,phase_key,predecessor_head_hash,successor_head_hash,authority_body) VALUES (${release.releaseRef},${release.releaseHash},'release',${release.fenceRef},${head.hash},${successor.hash},${sql.json(release)})`;
    const updated = await sql`UPDATE internal_production_owner_admission_head_v1 SET head_version=${successor.version},head_hash=${successor.hash},head_payload=${sql.json(successor.payload as postgres.JSONValue)},active_fence_ref=NULL,active_fence_hash=NULL,active_target_family_hash=NULL,updated_at=NOW() WHERE singleton=TRUE AND head_version=${head.version} AND head_hash=${head.hash} AND active_fence_ref=${fence.fenceRef} AND active_fence_hash=${fence.fenceHash} AND active_target_family_hash=${fence.targetFamily.targetFamilyHash} RETURNING head_version`;
    if (updated.length !== 1) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CONFLICT");
    return release;
  });
}

export async function resolveBoundInternalProductionWorkflowRunOwnerV1(input: Readonly<{
  runOwnerReservationRef: string;
  runOwnerReservationHash: string;
}>): Promise<InternalProductionBoundOwnerReservationV1<"run">> {
  exactObjectKeys(
    input,
    ["runOwnerReservationRef", "runOwnerReservationHash"],
    "INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_PAIR_INVALID",
  );
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => {
    const resolved = await resolveStoredWorkflowRunOwnerByPairInTransactionV1(
      sql,
      input,
      ["bound", "closed"],
    );
    if (resolved.bound.producerImplementationId === "a-recovery-source-bootstrap-run-v1") {
      const runs = await sql<Array<{ status: string }>>`SELECT status FROM runs WHERE id=${resolved.bound.ownerKey} FOR SHARE`;
      if (runs.length !== 1 || runs[0]!.status !== "running") throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
    }
    return resolved.bound;
  });
}

export async function recoverBoundInternalProductionWorkflowRunOwnerV1(input: Readonly<{
  runId: string;
}>): Promise<InternalProductionBoundOwnerReservationV1<"run">> {
  exactObjectKeys(input, ["runId"], "INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_INPUT_INVALID");
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(input.runId);
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => {
    const pairs = await sql<Array<{ reservation_ref: string; reservation_hash: string }>>`
      SELECT reservation_ref,reservation_hash
        FROM internal_production_owner_reservations_v1
       WHERE producer_implementation_id=ANY(${["a-runtime-run-v1", "a-recovery-source-bootstrap-run-v1"]})
         AND category='run'
         AND owner_key=${input.runId}
         AND state=ANY(${["bound", "closed"]})
    `;
    if (pairs.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
    }
    const resolved = await resolveStoredWorkflowRunOwnerByPairInTransactionV1(sql, {
      runOwnerReservationRef: pairs[0]!.reservation_ref,
      runOwnerReservationHash: pairs[0]!.reservation_hash,
    }, ["bound", "closed"]);
    if (resolved.bound.producerImplementationId === "a-recovery-source-bootstrap-run-v1") {
      const runs = await sql<Array<{ status: string }>>`SELECT status FROM runs WHERE id=${input.runId} FOR SHARE`;
      if (runs.length !== 1 || runs[0]!.status !== "running") throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
    }
    return resolved.bound;
  });
}

export async function resolveInternalProductionRecoverySourceBootstrapActualRunTerminalInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ runId: string }>,
): Promise<Readonly<{
  producerImplementationId: "a-recovery-source-bootstrap-run-v1";
  runOwnerReservationRef: string;
  runOwnerReservationHash: string;
  terminalAuthorityRef: string;
  terminalAuthorityHash: string;
}> | null> {
  exactObjectKeys(input, ["runId"], "INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_ACTUAL_TERMINAL_INPUT_INVALID");
  createInternalProductionWorkflowRunCanonicalOwnerIdentityV1(input.runId);
  const pairs = await sql<Array<{ reservation_ref: string; reservation_hash: string }>>`
    SELECT reservation_ref,reservation_hash
      FROM internal_production_owner_reservations_v1
     WHERE producer_implementation_id='a-recovery-source-bootstrap-run-v1'
       AND category='run' AND owner_key=${input.runId} AND state='closed'
     FOR UPDATE
  `;
  if (pairs.length === 0) return null;
  if (pairs.length !== 1) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_ACTUAL_TERMINAL_CORRUPTION");
  const resolved = await resolveStoredWorkflowRunOwnerByPairInTransactionV1(sql, {
    runOwnerReservationRef: pairs[0]!.reservation_ref,
    runOwnerReservationHash: pairs[0]!.reservation_hash,
  }, ["closed"]);
  const runs = await sql<WorkflowRunTerminalRowV1[]>`SELECT id,status FROM runs WHERE id=${input.runId} FOR UPDATE`;
  if (runs.length !== 1) throw new Error("INTERNAL_PRODUCTION_RECOVERY_SOURCE_BOOTSTRAP_ACTUAL_TERMINAL_CORRUPTION");
  const authority = createWorkflowRunTerminalAuthorityFromLockedRowsV1(runs[0]!, resolved.bound);
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(authority);
  validateInternalProductionTerminalOwnerAuthorityPairV1(pair, authority);
  return Object.freeze({
    producerImplementationId: "a-recovery-source-bootstrap-run-v1" as const,
    runOwnerReservationRef: resolved.bound.reservationRef,
    runOwnerReservationHash: resolved.bound.reservationHash,
    terminalAuthorityRef: pair.terminalAuthorityRef,
    terminalAuthorityHash: pair.terminalAuthorityHash,
  });
}

export async function resolveInternalProductionWorkflowRunTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ runId: string }>,
): Promise<Readonly<{
  runOwnerReservationRef: string;
  runOwnerReservationHash: string;
  terminalAuthorityRef: string;
  terminalAuthorityHash: string;
}>> {
  exactObjectKeys(input, ["runId"], "INTERNAL_PRODUCTION_WORKFLOW_RUN_TERMINAL_INPUT_INVALID");
  const resolved = await resolveLockedWorkflowRunOwnerByRunIdV1(
    sql,
    input.runId,
    ["bound", "closed"],
  );
  const authority = createWorkflowRunTerminalAuthorityFromLockedRowsV1(
    resolved.run,
    resolved.bound,
  );
  bindWorkflowRunTerminalAuthorityToReservationStateV1(resolved, authority);
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(authority);
  const authenticated = await resolveWorkflowRunTerminalAuthorityByAuthorityPairV1(
    sql,
    terminalPair,
  );
  validateInternalProductionTerminalOwnerAuthorityPairV1(terminalPair, authenticated);
  return Object.freeze({
    runOwnerReservationRef: resolved.bound.reservationRef,
    runOwnerReservationHash: resolved.bound.reservationHash,
    terminalAuthorityRef: terminalPair.terminalAuthorityRef,
    terminalAuthorityHash: terminalPair.terminalAuthorityHash,
  });
}

async function resolveP3TerminalCloseInputInTransactionV1<
  Category extends InternalProductionOwnerCategoryV1,
>(
  sql: InternalProductionPgTransactionSql,
  input: unknown,
  config: P3TerminalResolverConfigV1<Category>,
  resolver: OwnerTerminalResolverV1,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  const resolved = await resolveExactP3TerminalAuthorityV1(sql, config, input);
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(resolved.authority);
  const authenticated = await resolver.resolveByAuthorityPair(sql, terminalPair, input);
  validateInternalProductionTerminalOwnerAuthorityPairV1(terminalPair, authenticated);
  if (!sameJsonValueV1(authenticated, resolved.authority)) {
    throw new Error("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_UNAVAILABLE");
  }
  const issued = Object.freeze({
    reservationRef: resolved.sidecar.bound.reservationRef,
    reservationHash: resolved.sidecar.bound.reservationHash,
    terminalAuthorityRef: terminalPair.terminalAuthorityRef,
    terminalAuthorityHash: terminalPair.terminalAuthorityHash,
  });
  P3_ISSUED_TERMINAL_CLOSE_INPUTS_V1.set(issued, Object.freeze({
    sql,
    category: config.category,
    exactInput: config.exactInputFromIdentity(
      resolved.sidecar.bound.canonicalOwnerIdentity,
    ),
    reservationRef: issued.reservationRef,
    reservationHash: issued.reservationHash,
    terminalAuthorityRef: issued.terminalAuthorityRef,
    terminalAuthorityHash: issued.terminalAuthorityHash,
  }));
  return issued;
}

export async function resolveInternalProductionClaimTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ claimIdText: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    CLAIM_TERMINAL_RESOLVER_CONFIG_V1,
    CLAIM_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionExecutionAttemptTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ attemptId: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    EXECUTION_ATTEMPT_TERMINAL_RESOLVER_CONFIG_V1,
    EXECUTION_ATTEMPT_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionRuntimeSessionTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ sessionId: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    RUNTIME_SESSION_TERMINAL_RESOLVER_CONFIG_V1,
    RUNTIME_SESSION_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionCompletionOwnerTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ requestId: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    COMPLETION_OWNER_TERMINAL_RESOLVER_CONFIG_V1,
    COMPLETION_OWNER_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionMandatoryEffectTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ requestId: string; effectKey: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    MANDATORY_EFFECT_TERMINAL_RESOLVER_CONFIG_V1,
    MANDATORY_EFFECT_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionTerminationTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ requestId: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    TERMINATION_TERMINAL_RESOLVER_CONFIG_V1,
    TERMINATION_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionFindingTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ findingSetHash: string }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    FINDING_TERMINAL_RESOLVER_CONFIG_V1,
    FINDING_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionOperationalDeliveryTerminalAuthorityPairInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ eventKey: string; consumer: "jsonl" | "webhook" }>,
): Promise<InternalProductionResolvedOwnerTerminalCloseInputV1> {
  return resolveP3TerminalCloseInputInTransactionV1(
    sql,
    input,
    OPERATIONAL_DELIVERY_TERMINAL_RESOLVER_CONFIG_V1,
    OPERATIONAL_DELIVERY_TERMINAL_AUTHORITY_RESOLVER_V1,
  );
}

export async function resolveInternalProductionOwnerReservationCloseInTransactionV1(
  sql: InternalProductionPgTransactionSql,
  input: Readonly<{ closeRef: string; closeHash: string }>,
): Promise<InternalProductionOwnerReservationCloseV1> {
  return OWNER_ADMISSION_REPOSITORY_V1.resolveClose(sql, input);
}

export async function lockInternalProductionWorkflowRunInsertionFenceV1(
  sql: InternalProductionPgTransactionSql,
): Promise<void> {
  const rows = await sql<Array<{ version: number; name: string; checksum: string; state: string }>>`
    SELECT version,name,checksum,state
      FROM public.setfarm_schema_migrations
     WHERE version = 31
     FOR UPDATE
  `;
  const row = rows[0];
  if (rows.length !== 1 || !row) {
    throw new Error("RUN_PERSISTENCE_MIGRATION_31_FENCE_UNAVAILABLE");
  }
  if (
    row.version !== RUN_PERSISTENCE_MIGRATION_31_FENCE_V1.version
    || row.name !== RUN_PERSISTENCE_MIGRATION_31_FENCE_V1.name
    || row.checksum !== RUN_PERSISTENCE_MIGRATION_31_FENCE_V1.checksum
    || row.state !== "applied"
  ) throw new Error("RUN_PERSISTENCE_MIGRATION_31_FENCE_DRIFT");
}

// SETFARM_P4_MIGRATION_32_TRANSACTION_V1:BEGIN
export type InternalProductionCurrentEntryMigration32TransactionV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-migration-32-transaction.v1";
}>;

type InternalProductionMigration32TransactionPhaseV1 =
  | "locked_v31"
  | "staged"
  | "committing"
  | "terminal";

type InternalProductionMigration32TransactionDispositionV1 = "commit" | "abort";
type InternalProductionMigration32TransactionSettlementV1 =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "committed" }>
  | Readonly<{ status: "rejected"; error: unknown }>;

type InternalProductionMigration32TransactionStateV1 = {
  transaction: postgres.TransactionSql | null;
  phase: InternalProductionMigration32TransactionPhaseV1;
  stageInFlight: boolean;
  tentativeResult: BootstrapMainClaimHandoffGuardedMigration32ApplyResultV1 | null;
  releaseDisposition: (disposition: InternalProductionMigration32TransactionDispositionV1) => void;
  settlement: InternalProductionMigration32TransactionSettlementV1;
  settlementPromise: Promise<void>;
};

const INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_SCHEMA_V1 =
  "setfarm.internal-production-current-entry-migration-32-transaction.v1" as const;
const INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_ABORT_V1 = Symbol(
  "setfarm.internal-production-current-entry-migration-32-transaction-abort.v1",
);
const internalProductionMigration32TransactionsV1 = new WeakMap<
  object,
  InternalProductionMigration32TransactionStateV1
>();
const applyInternalProductionBaselineBootstrapHandoffMigrationV1 =
  applyBootstrapMainClaimHandoffGuardedMigration32V1;

function createInternalProductionMigration32DeferredV1<T>(): Readonly<{
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}

function requireInternalProductionMigration32TransactionStateV1(
  transaction: InternalProductionCurrentEntryMigration32TransactionV1,
): InternalProductionMigration32TransactionStateV1 {
  if (!transaction || typeof transaction !== "object") {
    throw new TypeError("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID");
  }
  const state = internalProductionMigration32TransactionsV1.get(transaction);
  if (!state) {
    throw new TypeError("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INVALID");
  }
  return state;
}

function createInternalProductionMigration32HeldSqlFacadeV1(
  transaction: postgres.TransactionSql,
): postgres.Sql {
  return new Proxy(transaction as unknown as postgres.Sql, {
    apply(_target, _thisArgument, argumentsList) {
      return Reflect.apply(
        transaction as unknown as (...args: unknown[]) => unknown,
        transaction,
        argumentsList,
      );
    },
    get(target, property) {
      if (property === "begin") {
        return (callback: (sql: postgres.TransactionSql) => unknown) =>
          transaction.savepoint(callback);
      }
      const value = Reflect.get(target as unknown as object, property, transaction);
      return typeof value === "function" ? value.bind(transaction) : value;
    },
  });
}

export async function openInternalProductionCurrentEntryMigration32TransactionV1():
Promise<InternalProductionCurrentEntryMigration32TransactionV1> {
  if (arguments.length !== 0) {
    throw new TypeError("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INPUT_INVALID");
  }
  const handle = Object.freeze({
    schema: INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_SCHEMA_V1,
  });
  const ready = createInternalProductionMigration32DeferredV1<
    InternalProductionCurrentEntryMigration32TransactionV1
  >();
  const disposition = createInternalProductionMigration32DeferredV1<
    InternalProductionMigration32TransactionDispositionV1
  >();
  const state: InternalProductionMigration32TransactionStateV1 = {
    transaction: null,
    phase: "locked_v31",
    stageInFlight: false,
    tentativeResult: null,
    releaseDisposition: disposition.resolve,
    settlement: Object.freeze({ status: "pending" }),
    settlementPromise: Promise.resolve(),
  };
  internalProductionMigration32TransactionsV1.set(handle, state);
  let readySettled = false;
  let outerTransaction: Promise<unknown>;
  try {
    outerTransaction = getSql().begin(async (transaction) => {
      await transaction.unsafe("SELECT set_config('lock_timeout', '5000ms', true)");
      await transaction.unsafe("SELECT set_config('statement_timeout', '30000ms', true)");
      await transaction.unsafe("SELECT set_config('search_path', 'public', true)");
      await lockInternalProductionWorkflowRunInsertionFenceV1(
        transaction as unknown as InternalProductionPgTransactionSql,
      );
      state.transaction = transaction;
      readySettled = true;
      ready.resolve(handle);
      if (await disposition.promise === "abort") {
        throw INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_ABORT_V1;
      }
    }) as unknown as Promise<unknown>;
  } catch (error) {
    readySettled = true;
    state.phase = "terminal";
    state.settlement = Object.freeze({ status: "rejected", error });
    internalProductionMigration32TransactionsV1.delete(handle);
    ready.reject(error);
    return ready.promise;
  }
  state.settlementPromise = Promise.resolve(outerTransaction).then(
    () => {
      state.settlement = Object.freeze({ status: "committed" });
    },
    (error: unknown) => {
      state.settlement = Object.freeze({ status: "rejected", error });
      if (!readySettled) {
        readySettled = true;
        state.phase = "terminal";
        internalProductionMigration32TransactionsV1.delete(handle);
        ready.reject(error);
      }
    },
  );
  return ready.promise;
}

export async function stageInternalProductionCurrentEntryMigration32InTransactionV1(
  transaction: InternalProductionCurrentEntryMigration32TransactionV1,
  evidence: BootstrapMainClaimHandoffGuardedMigration32EvidenceV1,
): Promise<void> {
  if (arguments.length !== 2) {
    throw new TypeError("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INPUT_INVALID");
  }
  const state = requireInternalProductionMigration32TransactionStateV1(transaction);
  if (state.phase !== "locked_v31" || state.stageInFlight || !state.transaction) {
    throw new Error("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID");
  }
  state.stageInFlight = true;
  try {
    const facade = createInternalProductionMigration32HeldSqlFacadeV1(state.transaction);
    state.tentativeResult = await applyInternalProductionBaselineBootstrapHandoffMigrationV1(
      facade,
      evidence,
    );
    state.phase = "staged";
  } catch (error) {
    state.phase = "terminal";
    state.releaseDisposition("abort");
    await state.settlementPromise;
    internalProductionMigration32TransactionsV1.delete(transaction);
    throw error;
  } finally {
    state.stageInFlight = false;
  }
}

export async function commitInternalProductionCurrentEntryMigration32TransactionV1(
  transaction: InternalProductionCurrentEntryMigration32TransactionV1,
): Promise<BootstrapMainClaimHandoffGuardedMigration32ApplyResultV1> {
  if (arguments.length !== 1) {
    throw new TypeError("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INPUT_INVALID");
  }
  const state = requireInternalProductionMigration32TransactionStateV1(transaction);
  if (state.phase !== "staged" || state.stageInFlight || !state.tentativeResult) {
    throw new Error("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID");
  }
  state.phase = "committing";
  state.releaseDisposition("commit");
  await state.settlementPromise;
  state.phase = "terminal";
  internalProductionMigration32TransactionsV1.delete(transaction);
  if (state.settlement.status === "rejected") throw state.settlement.error;
  if (state.settlement.status !== "committed") {
    throw new Error("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_SETTLEMENT_INVALID");
  }
  return state.tentativeResult;
}

export async function abortInternalProductionCurrentEntryMigration32TransactionV1(
  transaction: InternalProductionCurrentEntryMigration32TransactionV1,
): Promise<void> {
  if (arguments.length !== 1) {
    throw new TypeError("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_INPUT_INVALID");
  }
  const state = requireInternalProductionMigration32TransactionStateV1(transaction);
  if (
    (state.phase !== "locked_v31" && state.phase !== "staged")
    || state.stageInFlight
  ) {
    throw new Error("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_PHASE_INVALID");
  }
  state.phase = "terminal";
  state.releaseDisposition("abort");
  await state.settlementPromise;
  internalProductionMigration32TransactionsV1.delete(transaction);
  if (
    state.settlement.status === "rejected"
    && state.settlement.error !== INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_ABORT_V1
  ) throw state.settlement.error;
  if (state.settlement.status !== "rejected") {
    throw new Error("INTERNAL_PRODUCTION_MIGRATION_32_TRANSACTION_SETTLEMENT_INVALID");
  }
}
// SETFARM_P4_MIGRATION_32_TRANSACTION_V1:END

/**
 * Read-only current-entry composition. The called audit implementations own
 * their exact transaction and advisory-lock topology; this port intentionally
 * does not run generic schema readiness or generic transactions.
 */
export async function auditCurrentInternalProductionAuthorityV3Migration31V1(): Promise<Readonly<{
  authorityV3ContractSpineThroughMigration31: Awaited<ReturnType<typeof auditAuthorityV3ContractSpineThroughMigration31V1>>;
  currentAuthorityAudit: Awaited<ReturnType<typeof auditCurrentContractSpineAuthorityLedgersAtV31Data>>;
}>> {
  const sql = getSql();
  const authorityV3ContractSpineThroughMigration31 = await auditAuthorityV3ContractSpineThroughMigration31V1(sql);
  const currentAuthorityAudit = await auditCurrentContractSpineAuthorityLedgersAtV31Data(sql);
  await inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(sql);
  return Object.freeze({ authorityV3ContractSpineThroughMigration31, currentAuthorityAudit });
}

/** Read-only current-entry pending-successor composition with no generic DB gate. */
export async function inspectCurrentInternalProductionPendingBootstrapHandoffMigrationV1(): Promise<
  Awaited<ReturnType<typeof inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1>>
> {
  return inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1(getSql());
}

/** Read-only post-commit audit for the controller's immutable migration-32 receipt. */
export async function auditCurrentInternalProductionBaselineBootstrapHandoffMigration32V1(): Promise<Readonly<{
  migrationOrdinal: 32;
  migrationId: "contract-spine-bootstrap-main-claim-handoff-v1";
  migrationChecksum: string;
  migrationState: "current";
  schemaProjectionHash: string;
}>> {
  const sql = getSql();
  const rows = await sql.unsafe<Array<{ version: number; name: string; checksum: string; state: string }>>(
    "SELECT version,name,checksum,state FROM public.setfarm_schema_migrations WHERE version=32 LIMIT 2",
  );
  const row = rows[0];
  if (rows.length !== 1 || !row || Number(row.version) !== 32 || row.name !== "contract-spine-bootstrap-main-claim-handoff-v1" || !/^[a-f0-9]{64}$/.test(row.checksum) || row.state !== "applied") throw new Error("INTERNAL_PRODUCTION_CURRENT_ENTRY_MIGRATION_32_INVALID");
  await verifyBootstrapMainClaimHandoffV1Schema(sql);
  return Object.freeze({ migrationOrdinal: 32, migrationId: "contract-spine-bootstrap-main-claim-handoff-v1", migrationChecksum: row.checksum, migrationState: "current", schemaProjectionHash: hashCanonicalJson(await projectBootstrapMainClaimHandoffV1Schema(sql)) });
}

export type InternalProductionCurrentEntryMigration33ObservationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-migration-33-observation.v1";
  migrationOrdinal: 33;
  migrationName: string;
  migrationChecksum: string;
  migrationState: "current";
  schemaProjectionHash: string;
}>;

export type InternalProductionCurrentEntryDatabaseVerificationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-database-verification.v1";
  maximumMigrationOrdinal: 33;
  migration33Name: string;
  migration33Checksum: string;
  manifestActivationRef: string;
  manifestActivationHash: string;
  verificationHash: string;
}>;

export type InternalProductionCurrentEntryDatabaseInitializationV1 = Readonly<{
  schema: "setfarm.internal-production-current-entry-database-initialization.v1";
  migrationOrdinal: 33;
  manifestPhase: "A";
  state: "ready";
  initializationHash: string;
}>;

type CurrentEntryMigrationJournalRowV1 = Readonly<{
  version: number;
  name: string;
  checksum: string;
  state: string;
}>;

async function observeExactCurrentEntryMigration33V1(): Promise<InternalProductionCurrentEntryMigration33ObservationV1> {
  const rows = await getSql().unsafe<CurrentEntryMigrationJournalRowV1[]>(
    `SELECT version,name,checksum,state
       FROM public.setfarm_schema_migrations
      WHERE version = 33
      LIMIT 2`,
  );
  const row = rows[0];
  if (
    rows.length !== 1
    || !row
    || Number(row.version) !== 33
    || typeof row.name !== "string"
    || row.name.length < 1
    || typeof row.checksum !== "string"
    || !/^[a-f0-9]{64}$/.test(row.checksum)
    || row.state !== "applied"
  ) throw new Error("INTERNAL_PRODUCTION_CURRENT_ENTRY_MIGRATION_33_INVALID");
  const projection = Object.freeze({
    schema: "setfarm.internal-production-current-entry-migration-33-schema-projection.v1" as const,
    migrationOrdinal: 33 as const,
    migrationName: row.name,
    migrationChecksum: row.checksum,
    migrationState: "current" as const,
  });
  return Object.freeze({
    schema: "setfarm.internal-production-current-entry-migration-33-observation.v1",
    migrationOrdinal: 33,
    migrationName: row.name,
    migrationChecksum: row.checksum,
    migrationState: "current",
    schemaProjectionHash: hashCanonicalJson(projection),
  });
}

/** Applies only source-known ordinary successors; guarded migration 32 remains controller-owned. */
export async function applyOrAdoptInternalProductionCurrentEntryOrdinaryMigration33V1(
): Promise<InternalProductionCurrentEntryMigration33ObservationV1> {
  const sql = getSql();
  await applyContractSpineMigrations(sql);
  await verifyContractSpineMigrations(sql);
  return observeExactCurrentEntryMigration33V1();
}

export async function verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1(
): Promise<InternalProductionCurrentEntryDatabaseVerificationV1> {
  const sql = getSql();
  await verifyContractSpineMigrations(sql);
  const migration = await observeExactCurrentEntryMigration33V1();
  const current = await resolveCurrentInternalProductionOwnerProducerManifestSetActivationV1();
  if (!current || current.receipt.phase !== "A") {
    throw new Error("INTERNAL_PRODUCTION_CURRENT_ENTRY_MANIFEST_A_NOT_CURRENT");
  }
  const core = Object.freeze({
    schema: "setfarm.internal-production-current-entry-database-verification.v1" as const,
    maximumMigrationOrdinal: 33 as const,
    migration33Name: migration.migrationName,
    migration33Checksum: migration.migrationChecksum,
    manifestActivationRef: current.receipt.activationRef,
    manifestActivationHash: current.receipt.activationHash,
  });
  return Object.freeze({ ...core, verificationHash: hashCanonicalJson(core) });
}

export async function initializeInternalProductionCurrentEntryDatabaseV1(
): Promise<InternalProductionCurrentEntryDatabaseInitializationV1> {
  await verifyInternalProductionCurrentEntryDatabaseThroughMigration33AndManifestAV1();
  _schemaReady = true;
  const core = Object.freeze({
    schema: "setfarm.internal-production-current-entry-database-initialization.v1" as const,
    migrationOrdinal: 33 as const,
    manifestPhase: "A" as const,
    state: "ready" as const,
  });
  return Object.freeze({ ...core, initializationHash: hashCanonicalJson(core) });
}

async function ensureSchemaReady(): Promise<void> {
  if (_schemaReady || _isMigrating) return;
  if (!_schemaReadyPromise) {
    _schemaReadyPromise = pgMigrate()
      .then(() => {
        _schemaReady = true;
      })
      .finally(() => {
        _schemaReadyPromise = null;
      });
  }
  await _schemaReadyPromise;
}

export async function pgQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ensureSchemaReady();
  const s = getSql();
  if (params.length === 0) {
    return s.unsafe(sql) as any;
  }
  return s.unsafe(sql, params) as any;
}

export async function pgGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await pgQuery<T>(sql, params);
  return rows[0];
}

export async function pgRun(sql: string, params: any[] = []): Promise<{ changes: number }> {
  await ensureSchemaReady();
  const s = getSql();
  const result = params.length === 0 ? await s.unsafe(sql) : await s.unsafe(sql, params);
  return { changes: (result as any).count ?? 0 };
}

export async function pgExec(sql: string): Promise<void> {
  await ensureSchemaReady();
  const s = getSql();
  await s.unsafe(sql);
}

export type PgTransactionSql = InternalProductionPgTransactionSql;

export async function pgBegin<T>(fn: (sql: PgTransactionSql) => Promise<T>): Promise<T> {
  await ensureSchemaReady();
  const s = getSql();
  return s.begin(fn as any) as any;
}

export type PgMigrationOptions = Readonly<{
  contractSpineMode?: "verify" | "apply";
}>;

export async function pgMigrate(options: PgMigrationOptions = {}): Promise<void> {
  if (_isMigrating) return;
  _isMigrating = true;
  const url = resolvePgUrl();
  try {
    await ensureDatabaseExists(url);
    const s = getSql();

    // Contract-spine migrations are release operations. Runtime startup fails
    // closed on a missing or drifted journal; only the explicit migration CLI
    // and isolated test fixtures opt into applying them.
    if (options.contractSpineMode === "apply") {
      await applyContractSpineMigrations(s);
    } else {
      await verifyContractSpineMigrations(s);
    }

    await s`CREATE SEQUENCE IF NOT EXISTS runs_run_number_seq`;
    await s`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        run_number INTEGER NOT NULL DEFAULT nextval('runs_run_number_seq'::regclass),
        workflow_id TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        context TEXT NOT NULL DEFAULT '{}',
        meta TEXT,
        notify_url TEXT,
        assigned_developer TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await s`
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        step_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        input_template TEXT NOT NULL,
        expects TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        output TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 2,
        abandoned_count INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ,
        type TEXT NOT NULL DEFAULT 'single',
        loop_config TEXT,
        current_story_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await s`
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        story_index INTEGER NOT NULL,
        story_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        acceptance_criteria TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        output TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 2,
        abandoned_count INTEGER NOT NULL DEFAULT 0,
        claimed_by TEXT,
        claimed_at TIMESTAMPTZ,
        claim_generation INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ,
        depends_on TEXT,
        scope_files TEXT,
        shared_files TEXT,
        scope_targets TEXT,
        requested_dependencies TEXT,
        shared_edit_requests TEXT,
        resolved_scope_files TEXT,
        scope_description TEXT,
        file_skeletons TEXT,
        implementation_contract TEXT,
        story_screens TEXT,
        story_branch TEXT,
        pr_url TEXT,
        merge_status TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await s`
      CREATE TABLE IF NOT EXISTS claim_log (
        id BIGSERIAL PRIMARY KEY,
        run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        story_id TEXT,
        agent_id TEXT NOT NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        outcome TEXT,
        abandoned_at TIMESTAMPTZ,
        duration_ms INTEGER,
        diagnostic TEXT
      )
    `;
    await s`
      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        project_type TEXT NOT NULL DEFAULT 'general',
        source TEXT,
        severity TEXT NOT NULL DEFAULT 'mandatory',
        applies_to TEXT NOT NULL DEFAULT 'implement',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        readonly BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await s`
      CREATE TABLE IF NOT EXISTS medic_checks (
        id TEXT PRIMARY KEY,
        checked_at TIMESTAMPTZ NOT NULL,
        issues_found INTEGER NOT NULL DEFAULT 0,
        actions_taken INTEGER NOT NULL DEFAULT 0,
        summary TEXT NOT NULL DEFAULT '',
        details TEXT NOT NULL DEFAULT '[]'
      )
    `;
    await s`
      CREATE TABLE IF NOT EXISTS run_observations (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        step_id TEXT NOT NULL,
        story_id TEXT NOT NULL DEFAULT '',
        agent_id TEXT,
        phase TEXT,
        check_id TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT,
        detail TEXT,
        evidence TEXT NOT NULL DEFAULT '{}',
        file_paths TEXT NOT NULL DEFAULT '[]',
        github TEXT NOT NULL DEFAULT '{}',
        metadata TEXT NOT NULL DEFAULT '{}',
        event_type TEXT,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_number INTEGER DEFAULT nextval('runs_run_number_seq'::regclass)`;
    await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS meta TEXT`;
    await s`ALTER TABLE runs ADD COLUMN IF NOT EXISTS assigned_developer TEXT`;
    await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS abandoned_count INTEGER NOT NULL DEFAULT 0`;
    await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
    await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'single'`;
    await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS loop_config TEXT`;
    await s`ALTER TABLE steps ADD COLUMN IF NOT EXISTS current_story_id TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS abandoned_count INTEGER NOT NULL DEFAULT 0`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS claimed_by TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS claim_generation INTEGER NOT NULL DEFAULT 0`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS depends_on TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_files TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS shared_files TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_targets TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS requested_dependencies TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS shared_edit_requests TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS resolved_scope_files TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS scope_description TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS file_skeletons TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS implementation_contract TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_screens TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS story_branch TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS pr_url TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS merge_status TEXT`;
    await s`ALTER TABLE stories ADD COLUMN IF NOT EXISTS quality_failure_fingerprint TEXT`;
    await s`ALTER TABLE run_observations ADD COLUMN IF NOT EXISTS event_type TEXT`;
    await s`ALTER TABLE run_observations ADD COLUMN IF NOT EXISTS detail TEXT`;

    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_run_number_unique ON runs(run_number)`;
    await s`CREATE INDEX IF NOT EXISTS idx_steps_run_status ON steps(run_id, status)`;
    await s`CREATE INDEX IF NOT EXISTS idx_stories_run_status ON stories(run_id, status)`;
    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_active_story_id_unique ON stories(run_id, story_id) WHERE status IN ('pending', 'running')`;
    await s`CREATE INDEX IF NOT EXISTS idx_stories_quality_failure_fingerprint ON stories(run_id, quality_failure_fingerprint) WHERE quality_failure_fingerprint IS NOT NULL`;
    await s`CREATE INDEX IF NOT EXISTS idx_steps_agent_status ON steps(agent_id, status) WHERE status IN ('pending', 'running')`;
    await s`CREATE INDEX IF NOT EXISTS idx_runs_status_dev ON runs(status, assigned_developer) WHERE status = 'running'`;
    await s`CREATE INDEX IF NOT EXISTS idx_run_observations_run_created ON run_observations(run_id, created_at DESC)`;
    await s`CREATE INDEX IF NOT EXISTS idx_run_observations_step_story ON run_observations(run_id, step_id, story_id, created_at DESC)`;
    await s`CREATE INDEX IF NOT EXISTS idx_run_observations_status ON run_observations(run_id, status, created_at DESC)`;

    // Runtime schema bootstrap is intentionally read-only with respect to
    // lifecycle rows. Duplicate owners require an explicit, quiesced recovery
    // operation; a process that merely opens the database must never choose a
    // winner or close a claim behind the spawner's back.
    const duplicateOpenSingle = await s<Array<{ run_id: string; step_id: string }>>`
      SELECT run_id, step_id
        FROM claim_log
       WHERE outcome IS NULL AND story_id IS NULL
       GROUP BY run_id, step_id
      HAVING COUNT(*) > 1
       LIMIT 1
    `;
    if (duplicateOpenSingle.length > 0) {
      throw new Error("CLAIM_LOG_OPEN_SINGLE_DUPLICATE_REQUIRES_RECOVERY");
    }
    const duplicateOpenStory = await s<Array<{ run_id: string; step_id: string; story_id: string }>>`
      SELECT run_id, step_id, story_id
        FROM claim_log
       WHERE outcome IS NULL AND story_id IS NOT NULL
       GROUP BY run_id, step_id, story_id
      HAVING COUNT(*) > 1
       LIMIT 1
    `;
    if (duplicateOpenStory.length > 0) {
      throw new Error("CLAIM_LOG_OPEN_STORY_DUPLICATE_REQUIRES_RECOVERY");
    }
    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_single_unique ON claim_log(run_id, step_id) WHERE outcome IS NULL AND story_id IS NULL`;
    await s`CREATE UNIQUE INDEX IF NOT EXISTS idx_claim_log_open_story_unique ON claim_log(run_id, step_id, story_id) WHERE outcome IS NULL AND story_id IS NOT NULL`;
    _schemaReady = true;
  } finally {
    _isMigrating = false;
  }
}

export async function pgNextRunNumber(): Promise<number> {
  const row = await pgGet<{ next: number }>(
    "SELECT nextval('runs_run_number_seq'::regclass) AS next",
  );
  return row?.next ?? 1;
}

export async function pgCleanupOrphans(): Promise<{ deletedSteps: number; deletedStories: number }> {
  await ensureSchemaReady();
  const s = getSql();
  const r1 = await s`DELETE FROM steps WHERE run_id NOT IN (SELECT id FROM runs)`;
  const r2 = await s`DELETE FROM stories WHERE run_id NOT IN (SELECT id FROM runs)`;
  return { deletedSteps: r1.count, deletedStories: r2.count };
}

export async function pgCheckpoint(): Promise<void> {
  // PostgreSQL handles WAL internally; no manual checkpoint is needed.
}

export async function pgClose(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _schemaReady = false;
    _schemaReadyPromise = null;
    _isolatedTestPgUrl = null;
  }
}

export const now = (): string => new Date().toISOString();

export function installPgSignalHandlers(): void {
  process.on("SIGTERM", () => { pgClose().catch(() => {}); });
  process.on("SIGINT", () => { pgClose().catch(() => {}); });
}
