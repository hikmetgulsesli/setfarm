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
  applyContractSpineMigrations,
  auditAuthorityV3ContractSpineThroughMigration31V1,
  auditCurrentContractSpineAuthorityLedgersAtV31Data,
  inspectPendingBootstrapMainClaimHandoffGuardedSuccessorV1,
  verifyContractSpineMigrations,
} from "./db/contract-spine-migrations.js";
import { computeContractSpineMigrationChecksumV1 } from "./db/contract-spine-migration-checksum.js";
import { CONTRACT_SPINE_SEMANTIC_MIGRATION_DIGESTS } from "./db/contract-spine-migration-digests.generated.js";
import { OPERATIONAL_FAILURE_CAUSE_AUTHORITY_V3_STATEMENTS } from "./db/operational-failure-cause-authority-v3-migration.js";
import type {
  PgTransactionSql as InternalProductionPgTransactionSql,
} from "./internal-production/owner-admission-v1.js";
import {
  createInternalProductionBoundOwnerReservationV1,
  createInternalProductionOwnerReservationCloseV1,
  createInternalProductionOwnerReservationV1,
  createInternalProductionTerminalOwnerAuthorityV1,
  deriveInternalProductionTerminalOwnerAuthorityPairV1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
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
  validateInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionTerminalOwnerAuthorityV1,
  type InternalProductionBoundOwnerReservationV1,
  type InternalProductionCanonicalOwnerIdentityV1,
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
  type InternalProductionTerminalOwnerAuthorityPairV1,
  type InternalProductionTerminalOwnerAuthorityV1,
} from "./internal-production/owner-admission-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./product-compiler/canonical-json.js";

let _sql: ReturnType<typeof postgres> | null = null;
let _schemaReady = false;
let _schemaReadyPromise: Promise<void> | null = null;
let _isMigrating = false;
let _isolatedTestPgUrl: string | null = null;

const ISOLATED_TEST_DATABASE = /^setfarm_contract_spine_test_[0-9]+_[a-f0-9]{12}$/;

export function pgConfigureIsolatedTestDatabase(rawUrl: string): void {
  if (_sql || _schemaReady || _schemaReadyPromise || _isMigrating) {
    throw new Error("ISOLATED_TEST_DATABASE_ALREADY_CONNECTED");
  }
  const parsed = new URL(rawUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (
    !["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)
    || !ISOLATED_TEST_DATABASE.test(database)
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
const RUN_PERSISTENCE_READINESS_MODULE_HREF_V1 = new URL("./internal-production/baseline-spawner-startup-admission-v1.js", import.meta.url).href;
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
  const expectedSuccessor = ownerAdmissionSuccessorV1({
    version: reservationSuccessorVersion - 1,
    predecessorHeadHash: reservation.ownerAdmissionHeadPredecessorHash,
    transitionKind: "reservation",
    transitionRef: reservation.reservationRef,
    transitionHash: reservation.reservationHash,
    migrationApplication,
  });
  if (
    expectedSuccessor.version !== reservationSuccessorVersion
    || authority.successor_head_hash !== expectedSuccessor.hash
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
  const terminal = validateInternalProductionTerminalOwnerAuthorityV1(
    await resolver.resolveByTerminalOwnerPair(sql, {
      terminalOwnerRef: close.terminalOwnerRef,
      terminalOwnerHash: close.terminalOwnerHash,
    }),
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
  if (implementationId === "a-runtime-run-v1") await requireWorkflowRunAdmissionReadyV1(currentResolution);
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
  type ReadinessModuleV1 = Readonly<{
    observeInternalProductionPreSchemaSpawnerRebindStatusV1: () => Promise<unknown>;
    resolveInternalProductionTask0SpawnerAdmissionReadyV1: (pair: unknown) => Promise<unknown>;
  }>;
  let module: ReadinessModuleV1;
  let status: Record<string, unknown>;
  try {
    const loaded = await import(RUN_PERSISTENCE_READINESS_MODULE_HREF_V1) as Readonly<Record<string, unknown>>;
    module = loaded as unknown as ReadinessModuleV1;
    if (
      JSON.stringify(Object.keys(module)) !== JSON.stringify([
        "observeInternalProductionPreSchemaSpawnerRebindStatusV1",
        "resolveInternalProductionTask0SpawnerAdmissionReadyV1",
      ])
      || typeof module.observeInternalProductionPreSchemaSpawnerRebindStatusV1 !== "function"
      || module.observeInternalProductionPreSchemaSpawnerRebindStatusV1.length !== 0
      || typeof module.resolveInternalProductionTask0SpawnerAdmissionReadyV1 !== "function"
      || module.resolveInternalProductionTask0SpawnerAdmissionReadyV1.length !== 1
    ) throw new Error();
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

async function lockOwnerAdmissionHeadV1(
  sql: InternalProductionPgTransactionSql,
): Promise<Readonly<{
  version: number;
  hash: string;
  migrationApplication: OwnerAdmissionMigrationApplicationV1;
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
      || (headPayload.transitionKind !== "reservation" && headPayload.transitionKind !== "close")
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
  if (row.active_fence_ref !== null) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_FENCED");
  return Object.freeze({ version, hash: row.head_hash, migrationApplication });
}

function ownerAdmissionSuccessorV1(input: Readonly<{
  version: number;
  predecessorHeadHash: string;
  transitionKind: "reservation" | "close";
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
  if (typeof input.ownerKey !== "string" || input.ownerKey.length === 0 || input.ownerKey.length > 4_000 || /[\u0000-\u001f\u007f]/.test(input.ownerKey)) {
    throw new TypeError("INTERNAL_PRODUCTION_OWNER_KEY_INVALID");
  }
  const head = await lockOwnerAdmissionHeadV1(sql);
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
  ) => Promise<InternalProductionTerminalOwnerAuthorityV1>;
  resolveByTerminalOwnerPair: (
    sql: InternalProductionPgTransactionSql,
    pair: Readonly<{ terminalOwnerRef: string; terminalOwnerHash: string }>,
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
    if (
      reservation.producerImplementationId !== "a-runtime-run-v1"
      || reservation.category !== "run"
      || bound.producerImplementationId !== "a-runtime-run-v1"
      || bound.category !== "run"
      || bound.ownerKey !== reservation.ownerKey
      || !sameJsonValueV1(bound.canonicalOwnerIdentity, expectedIdentity)
    ) throw new Error();
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

const OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1: Readonly<Partial<Record<
  InternalProductionOwnerCategoryV1,
  OwnerTerminalResolverV1
>>> = Object.freeze({
  run: Object.freeze({
    resolveByAuthorityPair: resolveWorkflowRunTerminalAuthorityByAuthorityPairV1,
    resolveByTerminalOwnerPair: resolveWorkflowRunTerminalAuthorityByTerminalOwnerPairV1,
  }),
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
    exactObjectKeys(input, ["reservationRef", "reservationHash", "terminalAuthorityRef", "terminalAuthorityHash"], "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_INPUT_INVALID");
    const reservation = await OWNER_ADMISSION_REPOSITORY_V1.resolveReservation(sql, {
      reservationRef: input.reservationRef,
      reservationHash: input.reservationHash,
    });
    const resolver = OWNER_TERMINAL_AUTHORITY_RESOLVERS_V1[reservation.category];
    if (!resolver) throw new Error("TERMINAL_AUTHORITY_UNAVAILABLE");
    const terminalPair = validateOwnerAdmissionPairV1(
      {
        terminalAuthorityRef: input.terminalAuthorityRef,
        terminalAuthorityHash: input.terminalAuthorityHash,
      },
      "terminalAuthorityRef",
      "terminalAuthorityHash",
      "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID",
    ) as InternalProductionTerminalOwnerAuthorityPairV1;
    const authority = validateInternalProductionTerminalOwnerAuthorityV1(
      await resolver.resolveByAuthorityPair(sql, terminalPair),
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

export async function resolveBoundInternalProductionWorkflowRunOwnerV1(input: Readonly<{
  runOwnerReservationRef: string;
  runOwnerReservationHash: string;
}>): Promise<InternalProductionBoundOwnerReservationV1<"run">> {
  exactObjectKeys(
    input,
    ["runOwnerReservationRef", "runOwnerReservationHash"],
    "INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_PAIR_INVALID",
  );
  return OWNER_ADMISSION_REPOSITORY_V1.withTransaction(async (sql) => (
    (await resolveStoredWorkflowRunOwnerByPairInTransactionV1(
      sql,
      input,
      ["bound"],
    )).bound
  ));
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
       WHERE producer_implementation_id='a-runtime-run-v1'
         AND category='run'
         AND owner_key=${input.runId}
         AND state='bound'
    `;
    if (pairs.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_WORKFLOW_RUN_OWNER_UNAVAILABLE");
    }
    return (await resolveStoredWorkflowRunOwnerByPairInTransactionV1(sql, {
      runOwnerReservationRef: pairs[0]!.reservation_ref,
      runOwnerReservationHash: pairs[0]!.reservation_hash,
    }, ["bound"])).bound;
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
