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
import type {
  PgTransactionSql as InternalProductionPgTransactionSql,
} from "./internal-production/owner-admission-v1.js";
import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  validateInternalProductionOwnerProducerManifestSetActivationCurrentV1,
  validateInternalProductionOwnerProducerManifestSetActivationHeadV1,
  validateInternalProductionOwnerProducerManifestSetActivationReceiptV1,
  validateInternalProductionOwnerProducerManifestV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  validateInternalProductionOwnerProducerSourceBuildAuthorityV1,
  type InternalProductionOwnerProducerManifestSetActivationCurrentV1,
  type InternalProductionOwnerProducerManifestSetActivationHeadPairV1,
  type InternalProductionOwnerProducerManifestSetActivationHeadV1,
  type InternalProductionOwnerProducerManifestSetActivationPairV1,
  type InternalProductionOwnerProducerManifestSetActivationPredecessorV1,
  type InternalProductionOwnerProducerManifestSetActivationReceiptV1,
  type InternalProductionOwnerProducerManifestV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  type InternalProductionOwnerProducerSourceBuildAuthorityV1,
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
