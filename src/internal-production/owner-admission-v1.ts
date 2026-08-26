import type postgres from "postgres";

import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_HASH = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const CANONICAL_REF = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
const INTERNAL_PRODUCTION_OWNER_KEY_MAXIMUM_V1 = 8_462;
const INTERNAL_PRODUCTION_OWNER_REF_MAXIMUM_V1 = 12_499;
const INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_MAXIMUM_V1 = 12_519;
const PLANS = ["A", "B", "C", "D", "E"] as const;
const PLAN_ROW_COUNTS = [16, 10, 6, 16, 9] as const;

function fail(code: string): never {
  throw new TypeError(code);
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  if (Object.getPrototypeOf(value) !== Object.prototype) fail(code);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], code: string): void {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) fail(code);
  const actual = ownKeys as string[];
  const wanted = [...expected].sort();
  if (JSON.stringify([...actual].sort()) !== JSON.stringify(wanted)) fail(code);
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(code);
  }
}

function arrayValue(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(code);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) fail(code);
  const expected = [
    ...Array.from({ length: value.length }, (_, index) => String(index)),
    "length",
  ].sort();
  if (JSON.stringify((ownKeys as string[]).sort()) !== JSON.stringify(expected)) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(code);
  }
  return value;
}

function detachedDeepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((member) => detachedDeepFreeze(member))) as T;
  }
  const clone: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") fail("INTERNAL_PRODUCTION_OWNER_VALUE_SYMBOL_INVALID");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
      fail("INTERNAL_PRODUCTION_OWNER_VALUE_PROPERTY_INVALID");
    }
    clone[key] = detachedDeepFreeze(descriptor.value);
  }
  return Object.freeze(clone) as T;
}

function stringValue(value: unknown, code: string, maximum = 4_000): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/.test(value)
  ) fail(code);
  return value;
}

function sha256(value: unknown, code: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) fail(code);
  return value;
}

function canonicalRef(value: unknown, code: string, maximum = 4_000): string {
  if (typeof value !== "string" || value.length > maximum || !CANONICAL_REF.test(value)) fail(code);
  return value;
}

function equalCanonical(left: unknown, right: unknown): boolean {
  return hashCanonicalJson(left) === hashCanonicalJson(right);
}

function contentRef(namespace: string, hash: string): string {
  return `setfarm://internal-production/${namespace}/${hash}`;
}

export const INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1 = detachedDeepFreeze([
  "run", "claim", "execution-attempt", "runtime-session", "completion-owner", "mandatory-effect",
  "ordinary-service-start", "restart-reservation", "service-restart-operation",
  "launch-preparation", "prepared-launch", "staged-case", "fixture-attempt",
  "artifact-reservation", "artifact-publication", "docs-session", "docs-lease",
  "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight",
  "launch-outbox", "termination", "finding", "recovery", "operational-delivery",
  "source-run", "cold-rehearsal", "compilation-lease", "execution-lease",
  "process", "listener", "worktree", "dirty-worktree", "stale-child",
] as const);

export type InternalProductionOwnerCategoryV1 =
  typeof INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1[number];

const CATEGORY_SET = new Set<string>(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1);

function category(value: unknown, code: string): InternalProductionOwnerCategoryV1 {
  if (typeof value !== "string" || !CATEGORY_SET.has(value)) fail(code);
  return value as InternalProductionOwnerCategoryV1;
}

export type InternalProductionCompleteZeroOwnerCensusV1 = Readonly<{
  activeRunCount: number;
  openClaimCount: number;
  executionAttemptCount: number;
  activeRuntimeSessionCount: number;
  activeCompletionOwnerCount: number;
  unsettledMandatoryEffectCount: number;
  ordinaryStartingCount: number;
  restartReservationCount: number;
  serviceRestartOperationCount: number;
  launchPreparationCount: number;
  preparedLaunchCount: number;
  stagedCaseCount: number;
  fixtureAttemptCount: number;
  artifactReservationCount: number;
  publicationBatchCount: number;
  artifactPublicationCount: number;
  docsSessionCount: number;
  docsLeaseCount: number;
  fleetStageCount: number;
  fleetInflightCount: number;
  fleetPendingReviewCount: number;
  matrixInflightCount: number;
  launchOutboxCount: number;
  terminationOwnerCount: number;
  findingOwnerCount: number;
  recoveryOwnerCount: number;
  operationalDeliveryCount: number;
  sourceRunOwnerCount: number;
  coldRehearsalOwnerCount: number;
  compilationLeaseCount: number;
  executionLeaseCount: number;
  ownedProcessCount: number;
  ownedListenerCount: number;
  ownedWorktreeCount: number;
  dirtyWorktreeCount: number;
  staleChildCount: number;
}>;

export const INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1 = detachedDeepFreeze({
  run: ["activeRunCount"],
  claim: ["openClaimCount"],
  "execution-attempt": ["executionAttemptCount"],
  "runtime-session": ["activeRuntimeSessionCount"],
  "completion-owner": ["activeCompletionOwnerCount"],
  "mandatory-effect": ["unsettledMandatoryEffectCount"],
  "ordinary-service-start": ["ordinaryStartingCount"],
  "restart-reservation": ["restartReservationCount"],
  "service-restart-operation": ["serviceRestartOperationCount"],
  "launch-preparation": ["launchPreparationCount"],
  "prepared-launch": ["preparedLaunchCount"],
  "staged-case": ["stagedCaseCount"],
  "fixture-attempt": ["fixtureAttemptCount"],
  "artifact-reservation": ["artifactReservationCount"],
  "artifact-publication": ["publicationBatchCount", "artifactPublicationCount"],
  "docs-session": ["docsSessionCount"],
  "docs-lease": ["docsLeaseCount"],
  "fleet-stage": ["fleetStageCount"],
  "fleet-inflight": ["fleetInflightCount"],
  "fleet-review": ["fleetPendingReviewCount"],
  "matrix-inflight": ["matrixInflightCount"],
  "launch-outbox": ["launchOutboxCount"],
  termination: ["terminationOwnerCount"],
  finding: ["findingOwnerCount"],
  recovery: ["recoveryOwnerCount"],
  "operational-delivery": ["operationalDeliveryCount"],
  "source-run": ["sourceRunOwnerCount"],
  "cold-rehearsal": ["coldRehearsalOwnerCount"],
  "compilation-lease": ["compilationLeaseCount"],
  "execution-lease": ["executionLeaseCount"],
  process: ["ownedProcessCount"],
  listener: ["ownedListenerCount"],
  worktree: ["ownedWorktreeCount"],
  "dirty-worktree": ["dirtyWorktreeCount"],
  "stale-child": ["staleChildCount"],
} as const satisfies Record<
  InternalProductionOwnerCategoryV1,
  readonly (keyof InternalProductionCompleteZeroOwnerCensusV1)[]
>);

export const INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1 = hashCanonicalJson({
  schema: "setfarm.internal-production-owner-category-registry.v1",
  categories: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
});

export const INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1 = hashCanonicalJson({
  schema: "setfarm.internal-production-owner-category-census-map.v1",
  entries: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1.map((ownerCategory) => ({
    category: ownerCategory,
    censusKeys: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[ownerCategory],
  })),
});

export type InternalProductionOwnerProducerRowV1 = Readonly<{
  plan: "A" | "B" | "C" | "D" | "E";
  module: string;
  function: string;
  implementationId: string;
  category: InternalProductionOwnerCategoryV1;
  ownerKeyDerivationId: string;
  censusKeys: readonly (keyof InternalProductionCompleteZeroOwnerCensusV1)[];
}>;

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1 = detachedDeepFreeze([
  { plan: "A", module: "src/execution/run-persistence.ts", function: "persistWorkflowRunInTransaction", implementationId: "a-runtime-run-v1", category: "run", ownerKeyDerivationId: "run-id-generation-v1", censusKeys: ["activeRunCount"] },
  { plan: "A", module: "src/execution/claim-runtime-publication.ts", function: "publishSingleClaimRuntime", implementationId: "a-claim-single-runtime-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/execution/claim-runtime-publication.ts", function: "publishLoopClaimRuntime", implementationId: "a-claim-loop-runtime-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/recovery/v3-downstream-evidence-publication.ts", function: "createV3DownstreamEvidencePublication.reserve", implementationId: "a-claim-v3-downstream-evidence-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/recovery/v3-evidence-only-publication.ts", function: "createV3EvidenceOnlyPublication.reserve", implementationId: "a-claim-v3-evidence-only-v1", category: "claim", ownerKeyDerivationId: "claim-log-id-v1", censusKeys: ["openClaimCount"] },
  { plan: "A", module: "src/execution/attempt-repository.ts", function: "reserveAttemptInTransaction", implementationId: "a-execution-attempt-v1", category: "execution-attempt", ownerKeyDerivationId: "execution-attempt-id-generation-v1", censusKeys: ["executionAttemptCount"] },
  { plan: "A", module: "src/execution/runtime-session-repository.ts", function: "reserveRuntimeSessionInTransaction", implementationId: "a-runtime-session-v1", category: "runtime-session", ownerKeyDerivationId: "runtime-session-id-v1", censusKeys: ["activeRuntimeSessionCount"] },
  { plan: "A", module: "src/execution/runtime-completion.ts", function: "createRuntimeCompletionRepository.claim", implementationId: "a-completion-owner-v1", category: "completion-owner", ownerKeyDerivationId: "completion-request-id-v1", censusKeys: ["activeCompletionOwnerCount"] },
  { plan: "A", module: "src/execution/runtime-completion.ts", function: "markRuntimeCompletionOwnerCommittedInTransaction", implementationId: "a-mandatory-effect-v1", category: "mandatory-effect", ownerKeyDerivationId: "completion-request-id-effect-key-v1", censusKeys: ["unsettledMandatoryEffectCount"] },
  { plan: "A", module: "src/execution/run-termination.ts", function: "requestRunTerminationInTransaction", implementationId: "a-termination-v1", category: "termination", ownerKeyDerivationId: "termination-request-id-v1", censusKeys: ["terminationOwnerCount"] },
  { plan: "A", module: "src/recovery/finding-recovery-repository.ts", function: "createFindingRecoveryRepository.putFindingSet", implementationId: "a-finding-recovery-repository-v1", category: "finding", ownerKeyDerivationId: "finding-set-hash-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/recovery/v3-downstream-evidence-publication.ts", function: "putFindingSet", implementationId: "a-finding-v3-downstream-evidence-v1", category: "finding", ownerKeyDerivationId: "finding-set-hash-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/recovery/v3-evidence-only-publication.ts", function: "putFindingSetInTransaction", implementationId: "a-finding-v3-evidence-only-v1", category: "finding", ownerKeyDerivationId: "finding-set-hash-v1", censusKeys: ["findingOwnerCount"] },
  { plan: "A", module: "src/execution/operational-outbox-repository.ts", function: "createOperationalOutboxRepository.publish", implementationId: "a-operational-delivery-v1", category: "operational-delivery", ownerKeyDerivationId: "operational-event-key-consumer-v1", censusKeys: ["operationalDeliveryCount"] },
  { plan: "A", module: "src/db-pg.ts", function: "reserveRecoverySourceRunOwnerV1", implementationId: "a-recovery-source-run-v1", category: "source-run", ownerKeyDerivationId: "source-bootstrap-operation-run-v1", censusKeys: ["sourceRunOwnerCount"] },
  { plan: "A", module: "src/db-pg.ts", function: "reserveRecoverySourceBootstrapRunOwnerV1", implementationId: "a-recovery-source-bootstrap-run-v1", category: "run", ownerKeyDerivationId: "source-bootstrap-reciprocal-run-v1", censusKeys: ["activeRunCount"] },
] as const satisfies readonly InternalProductionOwnerProducerRowV1[]);

export type InternalProductionOwnerProducerManifestV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest.v1";
  plan: "A" | "B" | "C" | "D" | "E";
  rows: readonly InternalProductionOwnerProducerRowV1[];
  manifestHash: string;
}>;

export type InternalProductionOwnerProducerImplementationIdV1 = string;

export const INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1 = detachedDeepFreeze({
  schema: "setfarm.internal-production-owner-producer-manifest.v1",
  plan: "A",
  rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  manifestHash: hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan: "A",
    rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  }),
} as const satisfies InternalProductionOwnerProducerManifestV1);

function validateProducerRow(value: unknown, expectedPlan?: string): InternalProductionOwnerProducerRowV1 {
  const row = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_INVALID");
  exactKeys(row, [
    "plan", "module", "function", "implementationId", "category",
    "ownerKeyDerivationId", "censusKeys",
  ], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_KEYS_INVALID");
  if (!PLANS.includes(row.plan as typeof PLANS[number])) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_PLAN_INVALID");
  if (expectedPlan !== undefined && row.plan !== expectedPlan) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_PLAN_INVALID");
  stringValue(row.module, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_MODULE_INVALID");
  stringValue(row.function, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_FUNCTION_INVALID");
  stringValue(row.implementationId, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_IMPLEMENTATION_ID_INVALID");
  const ownerCategory = category(row.category, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_CATEGORY_INVALID");
  stringValue(row.ownerKeyDerivationId, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_OWNER_KEY_DERIVATION_INVALID");
  arrayValue(row.censusKeys, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_CENSUS_KEYS_INVALID");
  if (!equalCanonical(row.censusKeys, INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[ownerCategory])) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ROW_CENSUS_KEYS_INVALID");
  }
  return detachedDeepFreeze(value as InternalProductionOwnerProducerRowV1);
}

export function validateInternalProductionOwnerProducerManifestV1(
  value: unknown,
): InternalProductionOwnerProducerManifestV1 {
  const manifest = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_INVALID");
  exactKeys(manifest, ["schema", "plan", "rows", "manifestHash"],
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_KEYS_INVALID");
  if (manifest.schema !== "setfarm.internal-production-owner-producer-manifest.v1") {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_SCHEMA_INVALID");
  }
  if (!PLANS.includes(manifest.plan as typeof PLANS[number])) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_PLAN_INVALID");
  }
  const manifestRows = arrayValue(
    manifest.rows,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_ROWS_INVALID",
  );
  const rows = manifestRows.map((row) => validateProducerRow(row, manifest.plan as string));
  const implementationIds = new Set<string>();
  const moduleFunctions = new Set<string>();
  const ownerKeyTuples = new Set<string>();
  for (const row of rows) {
    if (implementationIds.has(row.implementationId)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_ID_DUPLICATE");
    }
    implementationIds.add(row.implementationId);
    const moduleFunction = `${row.module}\u0000${row.function}`;
    if (moduleFunctions.has(moduleFunction)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MODULE_FUNCTION_DUPLICATE");
    }
    moduleFunctions.add(moduleFunction);
    const ownerKeyTuple = `${moduleFunction}\u0000${row.ownerKeyDerivationId}`;
    if (ownerKeyTuples.has(ownerKeyTuple)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_OWNER_KEY_TUPLE_DUPLICATE");
    }
    ownerKeyTuples.add(ownerKeyTuple);
  }
  const expectedHash = hashCanonicalJson({
    schema: manifest.schema,
    plan: manifest.plan,
    rows: manifest.rows,
  });
  if (manifest.manifestHash !== expectedHash || !SHA256.test(String(manifest.manifestHash))) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_HASH_INVALID");
  }
  if (manifest.plan === "A" && !equalCanonical(manifest.rows, INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1)) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_PLAN_A_ROWS_INVALID");
  }
  return detachedDeepFreeze(value as InternalProductionOwnerProducerManifestV1);
}

export type InternalProductionOwnerProducerManifestSetPhaseV1 =
  | "A" | "A+B" | "A+B+C" | "A+B+C+D" | "A+B+C+D+E";

export type InternalProductionOwnerProducerSourceBuildAuthorityPairV1 = Readonly<{
  plan: "A" | "B" | "C" | "D" | "E";
  sourceBuildAuthorityRef: string;
  sourceBuildAuthorityHash: string;
}>;

type InternalProductionProductBuildAuthorityV2DeliveryEvidenceObservationV1 = import(
  "./product-build-authority-v2-delivery-evidence-v1.js"
).ProductBuildAuthorityV2DeliveryEvidenceObservationV1;

export type InternalProductionOwnerProducerSourceBuildAuthorityAV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-source-build-authority-a.v1";
  plan: "A";
  manifestHash: string;
  currentEntryOperationRef: string;
  currentEntryOperationHash: string;
  setfarmSource: Readonly<{
    branch: "main";
    clean: true;
    sha: string;
    treeHash: string;
    buildHash: string;
    originMainSha: string;
  }>;
  productBuildAuthorityV2DeliveryEvidenceRef: string;
  productBuildAuthorityV2DeliveryEvidenceHash: string;
  productBuildAuthorityV2Observation:
    InternalProductionProductBuildAuthorityV2DeliveryEvidenceObservationV1;
  vendorProducerCommit: string;
  vendorProducerCommitAncestorProof: Readonly<{
    schema: "setfarm.internal-production-vendor-ancestor-proof.v1";
    vendorProducerCommit: string;
    setfarmSourceSha: string;
    mergeBase: string;
    verified: true;
  }>;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  sourceBuildAuthorityRef: string;
  sourceBuildAuthorityHash: string;
}>;

export type InternalProductionOwnerProducerSourceBuildAuthorityV1 =
  InternalProductionOwnerProducerSourceBuildAuthorityAV1;

type SourceBuildAuthorityAInputV1 = Omit<
  InternalProductionOwnerProducerSourceBuildAuthorityAV1,
  "sourceBuildAuthorityRef" | "sourceBuildAuthorityHash"
>;

function gitHash(value: unknown, code: string): string {
  if (typeof value !== "string" || !GIT_HASH.test(value)) fail(code);
  return value;
}

const PBA_DELIVERED_PATHS = Object.freeze([
  "server/routes/setfarm-operational.test.ts",
  "server/routes/setfarm-operational.ts",
  "server/services/setfarm-product-build-authority.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "src/lib/product-build-authority.ts",
  "src/components/run-detail/ProductBuildAuthority.tsx",
  "tests/product-build-authority-render.test.tsx",
  "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json",
] as const);
const PBA_FOCUSED_ARGV = Object.freeze([
  "node", "--import", "tsx", "--test",
  "server/routes/setfarm-operational.test.ts",
  "server/services/setfarm-product-build-authority.test.ts",
  "tests/product-build-authority-render.test.tsx",
] as const);
const PBA_VENDOR_ARTIFACT_NAMES = Object.freeze([
  "run-operational-snapshot.v1.compatibility.json", "run-operational-snapshot.v1.schema.json",
  "run-operational-snapshot.v2.compatibility.json", "run-operational-snapshot.v2.schema.json",
  "run-operational-snapshot.v3.compatibility.json", "run-operational-snapshot.v3.schema.json",
  "deployment-observation.v1.compatibility.json", "deployment-observation.v1.schema.json",
  "project-transfer-ack.v1.compatibility.json", "project-transfer-ack.v1.schema.json",
  "operational-active-run-status.v1.compatibility.json", "operational-active-run-status.v1.schema.json",
] as const);

function validatePbaPathIdentity(value: unknown, expectedPath: string): Readonly<{ path: string; blobHash: string }> {
  const identity = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  exactKeys(identity, ["path", "blobHash"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  if (identity.path !== expectedPath) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  return { path: expectedPath, blobHash: sha256(identity.blobHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID") };
}

function validateCompletePbaObservation(value: unknown): InternalProductionProductBuildAuthorityV2DeliveryEvidenceObservationV1 {
  const code = "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID";
  const observation = record(value, code);
  exactKeys(observation, ["schema", "observationTransport", "response"], code);
  if (observation.schema !== "setfarm.product-build-authority-v2-delivery-evidence-observation.v1" || observation.observationTransport !== "source-cli") fail(code);
  const response = record(observation.response, code);
  exactKeys(response, ["schema", "currentStatus", "deliveryEvidenceRef", "deliveryEvidenceHash", "evidence"], code);
  if (response.schema !== "mission-control.product-build-authority-v2-delivery-evidence-response.v1" || response.currentStatus !== "current") fail(code);
  const evidence = record(response.evidence, code);
  exactKeys(evidence, ["schema", "currentStatus", "deliveryPrNumber", "deliveryMergeSha", "deliveryMergeAncestorOfCurrentSource", "currentSource", "deliveredPathBlobs", "focusedTests", "vendorLock", "deliveryEvidenceRef", "deliveryEvidenceHash"], code);
  if (evidence.schema !== "mission-control.product-build-authority-v2-delivery-evidence.v1" || evidence.currentStatus !== "current" || evidence.deliveryPrNumber !== 19 || evidence.deliveryMergeSha !== "240e779d78804843a1202cbf0440fe423b806b1a" || evidence.deliveryMergeAncestorOfCurrentSource !== true) fail(code);
  const currentSource = record(evidence.currentSource, code);
  exactKeys(currentSource, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"], code);
  if (currentSource.branch !== "main" || currentSource.clean !== true) fail(code);
  const currentSha = gitHash(currentSource.sha, code);
  gitHash(currentSource.treeHash, code);
  sha256(currentSource.buildHash, code);
  if (gitHash(currentSource.originMainSha, code) !== currentSha) fail(code);
  const delivered = arrayValue(evidence.deliveredPathBlobs, code);
  if (delivered.length !== PBA_DELIVERED_PATHS.length) fail(code);
  const deliveredIdentities = delivered.map((member, index) => validatePbaPathIdentity(member, PBA_DELIVERED_PATHS[index]!));
  const focused = record(evidence.focusedTests, code);
  exactKeys(focused, ["schema", "argv", "commandContractHash", "testPathBlobs", "exitCode", "passed", "focusedTestReceiptRef", "focusedTestReceiptHash"], code);
  if (focused.schema !== "mission-control.product-build-authority-v2-focused-test-receipt.v1" || focused.exitCode !== 0 || focused.passed !== true) fail(code);
  const argv = arrayValue(focused.argv, code);
  if (JSON.stringify(argv) !== JSON.stringify(PBA_FOCUSED_ARGV) || focused.commandContractHash !== hashCanonicalJson({ argv })) fail(code);
  const focusedPaths = arrayValue(focused.testPathBlobs, code);
  const focusedIndexes = [0, 3, 6] as const;
  if (focusedPaths.length !== focusedIndexes.length) fail(code);
  focusedPaths.forEach((member, index) => {
    const identity = validatePbaPathIdentity(member, PBA_DELIVERED_PATHS[focusedIndexes[index]!]!);
    if (!equalCanonical(identity, deliveredIdentities[focusedIndexes[index]!]!)) fail(code);
  });
  const { focusedTestReceiptRef: _focusedRef, focusedTestReceiptHash: _focusedHash, ...focusedBody } = focused;
  const focusedHash = hashCanonicalJson(focusedBody);
  if (focused.focusedTestReceiptHash !== focusedHash || focused.focusedTestReceiptRef !== `mission-control://internal-production/product-build-authority-v2-focused-test-receipt/sha256/${focusedHash}`) fail(code);
  const vendor = record(evidence.vendorLock, code);
  exactKeys(vendor, ["schema", "lockPath", "producerRepository", "producerCommit", "lockContentHash", "artifacts", "compatibilitySetHash", "vendorLockProjectionHash"], code);
  if (vendor.schema !== "mission-control.product-build-authority-v2-vendor-lock-projection.v1" || vendor.lockPath !== "contracts/vendor/setfarm/mission-control-contracts.v1.lock.json" || vendor.producerRepository !== "https://github.com/hikmetgulsesli/setfarm.git") fail(code);
  gitHash(vendor.producerCommit, code);
  if (sha256(vendor.lockContentHash, code) !== deliveredIdentities[7]!.blobHash) fail(code);
  const artifacts = arrayValue(vendor.artifacts, code);
  if (artifacts.length !== PBA_VENDOR_ARTIFACT_NAMES.length) fail(code);
  artifacts.forEach((member, index) => {
    const artifact = record(member, code);
    exactKeys(artifact, ["producerPath", "vendoredPath", "sha256"], code);
    const basename = PBA_VENDOR_ARTIFACT_NAMES[index]!;
    if (artifact.producerPath !== `contracts/generated/mission-control/${basename}` || artifact.vendoredPath !== `contracts/vendor/setfarm/${basename}`) fail(code);
    sha256(artifact.sha256, code);
  });
  if (vendor.compatibilitySetHash !== hashCanonicalJson({ schema: "mission-control.setfarm-contract-compatibility-set.v1", artifacts })) fail(code);
  const { vendorLockProjectionHash: _vendorHash, ...vendorBody } = vendor;
  if (vendor.vendorLockProjectionHash !== hashCanonicalJson(vendorBody)) fail(code);
  const { deliveryEvidenceRef: _evidenceRef, deliveryEvidenceHash: _evidenceHash, ...evidenceBody } = evidence;
  const evidenceHash = hashCanonicalJson(evidenceBody);
  if (evidence.deliveryEvidenceHash !== evidenceHash || evidence.deliveryEvidenceRef !== `mission-control://internal-production/product-build-authority-v2-delivery-evidence/sha256/${evidenceHash}` || response.deliveryEvidenceHash !== evidenceHash || response.deliveryEvidenceRef !== evidence.deliveryEvidenceRef) fail(code);
  return detachedDeepFreeze(value as InternalProductionProductBuildAuthorityV2DeliveryEvidenceObservationV1);
}

function validateSourceAuthorityABody(
  value: unknown,
  includePair: boolean,
): SourceBuildAuthorityAInputV1 {
  const authority = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_INVALID");
  const bodyKeys = [
    "schema", "plan", "manifestHash", "currentEntryOperationRef", "currentEntryOperationHash",
    "setfarmSource", "productBuildAuthorityV2DeliveryEvidenceRef",
    "productBuildAuthorityV2DeliveryEvidenceHash", "productBuildAuthorityV2Observation",
    "vendorProducerCommit", "vendorProducerCommitAncestorProof", "ownerCategoryRegistryHash",
    "ownerCategoryCensusMapHash",
  ];
  exactKeys(
    authority,
    includePair ? [...bodyKeys, "sourceBuildAuthorityRef", "sourceBuildAuthorityHash"] : bodyKeys,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_KEYS_INVALID",
  );
  if (authority.schema !== "setfarm.internal-production-owner-producer-source-build-authority-a.v1" || authority.plan !== "A") {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_DISCRIMINATOR_INVALID");
  }
  if (
    sha256(authority.manifestHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_MANIFEST_INVALID")
      !== INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash
  ) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_MANIFEST_INVALID");
  canonicalRef(authority.currentEntryOperationRef, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_OPERATION_INVALID");
  sha256(authority.currentEntryOperationHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_OPERATION_INVALID");
  if (authority.currentEntryOperationRef !== `setfarm://internal-production/current-entry-operation/sha256/${authority.currentEntryOperationHash}`) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_OPERATION_INVALID");
  }
  const source = record(authority.setfarmSource, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  exactKeys(source, ["branch", "clean", "sha", "treeHash", "buildHash", "originMainSha"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  if (source.branch !== "main" || source.clean !== true) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  const sourceSha = gitHash(source.sha, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  gitHash(source.treeHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  sha256(source.buildHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  if (gitHash(source.originMainSha, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID") !== sourceSha) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_SOURCE_INVALID");
  }
  const observation = validateCompletePbaObservation(authority.productBuildAuthorityV2Observation);
  const response = observation.response;
  const pbaHash = sha256(authority.productBuildAuthorityV2DeliveryEvidenceHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  if (response.deliveryEvidenceRef !== authority.productBuildAuthorityV2DeliveryEvidenceRef || response.deliveryEvidenceHash !== pbaHash) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  const evidence = record(response.evidence, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  if (evidence.deliveryEvidenceRef !== response.deliveryEvidenceRef || evidence.deliveryEvidenceHash !== response.deliveryEvidenceHash) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_PBA_INVALID");
  const vendorLock = record(evidence.vendorLock, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_VENDOR_INVALID");
  const vendorCommit = gitHash(authority.vendorProducerCommit, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_VENDOR_INVALID");
  if (vendorLock.producerCommit !== vendorCommit) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_VENDOR_INVALID");
  const proof = record(authority.vendorProducerCommitAncestorProof, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID");
  exactKeys(proof, ["schema", "vendorProducerCommit", "setfarmSourceSha", "mergeBase", "verified"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID");
  if (vendorCommit === sourceSha || proof.schema !== "setfarm.internal-production-vendor-ancestor-proof.v1" || proof.vendorProducerCommit !== vendorCommit || proof.setfarmSourceSha !== sourceSha || proof.verified !== true) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID");
  if (gitHash(proof.mergeBase, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID") !== vendorCommit) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_ANCESTRY_INVALID");
  }
  if (authority.ownerCategoryRegistryHash !== INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1 || authority.ownerCategoryCensusMapHash !== INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_OWNER_HASH_INVALID");
  if (canonicalJsonBytes(authority).length > 65_536) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_BYTES_INVALID");
  return authority as SourceBuildAuthorityAInputV1;
}

function createInternalProductionOwnerProducerSourceBuildAuthorityAV1(
  input: SourceBuildAuthorityAInputV1,
): InternalProductionOwnerProducerSourceBuildAuthorityAV1 {
  const body = validateSourceAuthorityABody(input, false);
  const sourceBuildAuthorityHash = hashCanonicalJson(body);
  return detachedDeepFreeze({
    ...body,
    sourceBuildAuthorityRef: `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`,
    sourceBuildAuthorityHash,
  });
}

export function validateInternalProductionOwnerProducerSourceBuildAuthorityV1(
  value: unknown,
): InternalProductionOwnerProducerSourceBuildAuthorityV1 {
  const body = validateSourceAuthorityABody(value, true) as InternalProductionOwnerProducerSourceBuildAuthorityAV1;
  const {
    sourceBuildAuthorityRef: _ref,
    sourceBuildAuthorityHash: _hash,
    ...projection
  } = body;
  const sourceBuildAuthorityHash = hashCanonicalJson(projection);
  if (
    body.sourceBuildAuthorityHash !== sourceBuildAuthorityHash
    || body.sourceBuildAuthorityRef !== `setfarm://internal-production/owner-producer-source-build-authority/A/sha256/${sourceBuildAuthorityHash}`
  ) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_A_DERIVATION_INVALID");
  return detachedDeepFreeze(body);
}

export type InternalProductionOwnerProducerManifestSetActivationReceiptV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest-set-activation.v1";
  phase: InternalProductionOwnerProducerManifestSetPhaseV1;
  orderedPlans: readonly ("A" | "B" | "C" | "D" | "E")[];
  orderedManifestHashes: readonly string[];
  orderedSourceBuildAuthorities: readonly Readonly<{
    plan: "A" | "B" | "C" | "D" | "E";
    sourceBuildAuthorityRef: string;
    sourceBuildAuthorityHash: string;
  }>[];
  manifestSetHash: string;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  predecessorActivationRef: string | null;
  predecessorActivationHash: string | null;
  predecessorHeadRef: string | null;
  predecessorHeadHash: string | null;
  activationRef: string;
  activationHash: string;
}>;

export type InternalProductionOwnerProducerManifestSetActivationHeadV1 = Readonly<{
  schema: "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1";
  phase: InternalProductionOwnerProducerManifestSetPhaseV1;
  activationRef: string;
  activationHash: string;
  predecessorHeadRef: string | null;
  predecessorHeadHash: string | null;
  headRef: string;
  headHash: string;
}>;

export type InternalProductionOwnerProducerManifestSetActivationPredecessorV1 = Readonly<{
  activationRef: string;
  activationHash: string;
  headRef: string;
  headHash: string;
}>;

export type InternalProductionOwnerProducerManifestSetActivationCurrentV1 = Readonly<{
  currentRevision: number;
  head: InternalProductionOwnerProducerManifestSetActivationHeadV1;
  receipt: InternalProductionOwnerProducerManifestSetActivationReceiptV1;
}>;

export type InternalProductionOwnerProducerManifestSetActivationPairV1 = Readonly<{
  activationRef: string;
  activationHash: string;
}>;

export type InternalProductionOwnerProducerManifestSetActivationHeadPairV1 = Readonly<{
  headRef: string;
  headHash: string;
}>;

export interface InternalProductionOwnerProducerManifestSetActivationStoreV1 {
  activate(input: Readonly<{
    expectedPredecessor: InternalProductionOwnerProducerManifestSetActivationPredecessorV1 | null;
    manifests: readonly InternalProductionOwnerProducerManifestV1[];
    orderedSourceBuildAuthorities:
      readonly InternalProductionOwnerProducerSourceBuildAuthorityPairV1[];
  }>): Promise<InternalProductionOwnerProducerManifestSetActivationPairV1>;
  resolveSourceBuildAuthority(
    input: InternalProductionOwnerProducerSourceBuildAuthorityPairV1,
  ): Promise<InternalProductionOwnerProducerSourceBuildAuthorityV1>;
  resolve(input: InternalProductionOwnerProducerManifestSetActivationPairV1):
    Promise<InternalProductionOwnerProducerManifestSetActivationReceiptV1>;
  resolveHead(input: InternalProductionOwnerProducerManifestSetActivationHeadPairV1):
    Promise<InternalProductionOwnerProducerManifestSetActivationHeadV1>;
  resolveCurrent(): Promise<InternalProductionOwnerProducerManifestSetActivationCurrentV1 | null>;
}

const PHASE_PLANS = Object.freeze({
  A: Object.freeze(["A"]),
  "A+B": Object.freeze(["A", "B"]),
  "A+B+C": Object.freeze(["A", "B", "C"]),
  "A+B+C+D": Object.freeze(["A", "B", "C", "D"]),
  "A+B+C+D+E": Object.freeze(["A", "B", "C", "D", "E"]),
} as const);

function activationPhase(value: unknown): InternalProductionOwnerProducerManifestSetPhaseV1 {
  if (typeof value !== "string" || !(value in PHASE_PLANS)) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PHASE_INVALID");
  }
  return value as InternalProductionOwnerProducerManifestSetPhaseV1;
}

export function validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1(
  value: unknown,
): InternalProductionOwnerProducerSourceBuildAuthorityPairV1 {
  const pair = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_PAIR_INVALID");
  exactKeys(pair, ["plan", "sourceBuildAuthorityRef", "sourceBuildAuthorityHash"],
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_PAIR_KEYS_INVALID");
  if (!PLANS.includes(pair.plan as typeof PLANS[number])) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_PLAN_INVALID");
  }
  const sourceHash = sha256(
    pair.sourceBuildAuthorityHash,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_HASH_INVALID",
  );
  const expectedRef =
    `setfarm://internal-production/owner-producer-source-build-authority/${pair.plan}/sha256/${sourceHash}`;
  if (pair.sourceBuildAuthorityRef !== expectedRef) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_SOURCE_BUILD_AUTHORITY_REF_INVALID");
  }
  return detachedDeepFreeze(value as InternalProductionOwnerProducerSourceBuildAuthorityPairV1);
}

export function validateInternalProductionOwnerProducerManifestSetActivationReceiptV1(
  value: unknown,
): InternalProductionOwnerProducerManifestSetActivationReceiptV1 {
  const receipt = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_INVALID");
  exactKeys(receipt, [
    "schema", "phase", "orderedPlans", "orderedManifestHashes",
    "orderedSourceBuildAuthorities", "manifestSetHash", "ownerCategoryRegistryHash",
    "ownerCategoryCensusMapHash", "predecessorActivationRef",
    "predecessorActivationHash", "predecessorHeadRef", "predecessorHeadHash",
    "activationRef", "activationHash",
  ], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_KEYS_INVALID");
  if (receipt.schema !== "setfarm.internal-production-owner-producer-manifest-set-activation.v1") {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SCHEMA_INVALID");
  }
  const phase = activationPhase(receipt.phase);
  const expectedPlans = PHASE_PLANS[phase];
  const orderedPlans = arrayValue(
    receipt.orderedPlans,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PLANS_INVALID",
  );
  if (JSON.stringify(orderedPlans) !== JSON.stringify(expectedPlans)) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PLANS_INVALID");
  }
  const manifestHashes = arrayValue(
    receipt.orderedManifestHashes,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_MANIFEST_HASHES_INVALID",
  );
  if (manifestHashes.length !== expectedPlans.length) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_MANIFEST_HASHES_INVALID");
  }
  manifestHashes.forEach((hash) => sha256(
    hash,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_MANIFEST_HASHES_INVALID",
  ));
  const sourcePairs = arrayValue(
    receipt.orderedSourceBuildAuthorities,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SOURCE_AUTHORITIES_INVALID",
  ).map(validateInternalProductionOwnerProducerSourceBuildAuthorityPairV1);
  if (
    sourcePairs.length !== expectedPlans.length
    || sourcePairs.some((pair, index) => pair.plan !== expectedPlans[index])
  ) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_SOURCE_AUTHORITIES_INVALID");
  if (receipt.ownerCategoryRegistryHash !== INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_REGISTRY_HASH_INVALID");
  }
  if (receipt.ownerCategoryCensusMapHash !== INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CENSUS_MAP_HASH_INVALID");
  }
  const manifestSetHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-manifest-set.v1",
    phase,
    orderedPlans,
    orderedManifestHashes: manifestHashes,
    orderedSourceBuildAuthorities: sourcePairs,
    ownerCategoryRegistryHash: receipt.ownerCategoryRegistryHash,
    ownerCategoryCensusMapHash: receipt.ownerCategoryCensusMapHash,
  });
  if (receipt.manifestSetHash !== manifestSetHash) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_SET_HASH_INVALID");
  }
  const predecessorMembers = [
    receipt.predecessorActivationRef, receipt.predecessorActivationHash,
    receipt.predecessorHeadRef, receipt.predecessorHeadHash,
  ];
  if (phase === "A") {
    if (!predecessorMembers.every((member) => member === null)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PREDECESSOR_INVALID");
    }
  } else {
    if (predecessorMembers.some((member) => member === null)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PREDECESSOR_INVALID");
    }
    canonicalRef(receipt.predecessorActivationRef,
      "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PREDECESSOR_INVALID");
    sha256(receipt.predecessorActivationHash,
      "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PREDECESSOR_INVALID");
    canonicalRef(receipt.predecessorHeadRef,
      "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PREDECESSOR_INVALID");
    sha256(receipt.predecessorHeadHash,
      "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_PREDECESSOR_INVALID");
  }
  const { activationRef: _activationRef, activationHash: _activationHash, ...body } = receipt;
  const activationHash = hashCanonicalJson(body);
  if (
    receipt.activationHash !== activationHash
    || receipt.activationRef !==
      `setfarm://internal-production/owner-producer-manifest-set-activation/sha256/${activationHash}`
  ) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_DERIVATION_INVALID");
  return detachedDeepFreeze(value as InternalProductionOwnerProducerManifestSetActivationReceiptV1);
}

export function validateInternalProductionOwnerProducerManifestSetActivationHeadV1(
  value: unknown,
): InternalProductionOwnerProducerManifestSetActivationHeadV1 {
  const head = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_INVALID");
  exactKeys(head, [
    "schema", "phase", "activationRef", "activationHash", "predecessorHeadRef",
    "predecessorHeadHash", "headRef", "headHash",
  ], "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_KEYS_INVALID");
  if (head.schema !== "setfarm.internal-production-owner-producer-manifest-set-activation-head.v1") {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_SCHEMA_INVALID");
  }
  const phase = activationPhase(head.phase);
  canonicalRef(head.activationRef,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_ACTIVATION_REF_INVALID");
  sha256(head.activationHash,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_ACTIVATION_HASH_INVALID");
  if ((head.predecessorHeadRef === null) !== (head.predecessorHeadHash === null)) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_PREDECESSOR_INVALID");
  }
  if ((phase === "A") !== (head.predecessorHeadRef === null)) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_PREDECESSOR_INVALID");
  }
  if (head.predecessorHeadRef !== null) {
    canonicalRef(head.predecessorHeadRef,
      "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_PREDECESSOR_INVALID");
    sha256(head.predecessorHeadHash,
      "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_PREDECESSOR_INVALID");
  }
  const { headRef: _headRef, headHash: _headHash, ...body } = head;
  const headHash = hashCanonicalJson(body);
  if (
    head.headHash !== headHash
    || head.headRef !==
      `setfarm://internal-production/owner-producer-manifest-set-activation-head/sha256/${headHash}`
  ) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_HEAD_DERIVATION_INVALID");
  return detachedDeepFreeze(value as InternalProductionOwnerProducerManifestSetActivationHeadV1);
}

export function validateInternalProductionOwnerProducerManifestSetActivationCurrentV1(
  value: unknown,
): InternalProductionOwnerProducerManifestSetActivationCurrentV1 {
  const current = record(value, "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_INVALID");
  exactKeys(current, ["currentRevision", "head", "receipt"],
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_KEYS_INVALID");
  const receipt = validateInternalProductionOwnerProducerManifestSetActivationReceiptV1(
    current.receipt,
  );
  const head = validateInternalProductionOwnerProducerManifestSetActivationHeadV1(current.head);
  const expectedRevision = PHASE_PLANS[receipt.phase].length;
  if (!Number.isSafeInteger(current.currentRevision) || current.currentRevision !== expectedRevision) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_REVISION_INVALID");
  }
  if (
    head.phase !== receipt.phase
    || head.activationRef !== receipt.activationRef
    || head.activationHash !== receipt.activationHash
    || head.predecessorHeadRef !== receipt.predecessorHeadRef
    || head.predecessorHeadHash !== receipt.predecessorHeadHash
  ) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_ACTIVATION_CURRENT_PAIR_INVALID");
  return detachedDeepFreeze({ currentRevision: current.currentRevision, head, receipt });
}

export function assembleInternalProductionOwnerProducerRegistryV1(input: Readonly<{
  manifests: readonly [
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
  ];
}>): Readonly<{ rows: readonly InternalProductionOwnerProducerRowV1[]; registryHash: string }> {
  const outer = record(input, "INTERNAL_PRODUCTION_OWNER_PRODUCER_REGISTRY_INPUT_INVALID");
  exactKeys(outer, ["manifests"], "INTERNAL_PRODUCTION_OWNER_PRODUCER_REGISTRY_INPUT_KEYS_INVALID");
  const inputManifests = arrayValue(
    input.manifests,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_SET_INVALID",
  );
  if (inputManifests.length !== 5) {
    fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_SET_INVALID");
  }
  const manifests = inputManifests.map(validateInternalProductionOwnerProducerManifestV1);
  for (let index = 0; index < manifests.length; index += 1) {
    const manifest = manifests[index]!;
    if (manifest.plan !== PLANS[index]) fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_ORDER_INVALID");
    if (manifest.rows.length !== PLAN_ROW_COUNTS[index]) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_ROW_COUNT_INVALID");
    }
  }
  const rows = manifests.flatMap((manifest) => [...manifest.rows]);
  const implementationIds = new Set<string>();
  const moduleFunctions = new Set<string>();
  const ownerKeyTuples = new Set<string>();
  for (const row of rows) {
    if (implementationIds.has(row.implementationId)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_REGISTRY_IMPLEMENTATION_ID_DUPLICATE");
    }
    implementationIds.add(row.implementationId);
    const moduleFunction = `${row.module}\u0000${row.function}`;
    if (moduleFunctions.has(moduleFunction)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_REGISTRY_MODULE_FUNCTION_DUPLICATE");
    }
    moduleFunctions.add(moduleFunction);
    const tuple = `${moduleFunction}\u0000${row.ownerKeyDerivationId}`;
    if (ownerKeyTuples.has(tuple)) {
      fail("INTERNAL_PRODUCTION_OWNER_PRODUCER_REGISTRY_OWNER_KEY_TUPLE_DUPLICATE");
    }
    ownerKeyTuples.add(tuple);
  }
  return detachedDeepFreeze({
    rows,
    registryHash: hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-registry.v1",
      rows,
    }),
  });
}

export type InternalProductionOwnerReservationV1 = Readonly<{
  schema: "setfarm.internal-production-owner-reservation.v1";
  category: InternalProductionOwnerCategoryV1;
  ownerKey: string;
  ownerKeyHash: string;
  producerPurposeHash: string;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  producerImplementationHash: string;
  canonicalOwnerIdentity: null;
  state: "pending";
  ownerAdmissionHeadPredecessorHash: string;
  reservationRef: string;
  reservationHash: string;
}>;

export type InternalProductionCanonicalOwnerIdentityV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
> = Readonly<{
  schema: "setfarm.internal-production-canonical-owner-identity.v1";
  category: Category;
  ownerKey: string;
  ownerRef: string;
  ownerHash: string;
}>;

export type InternalProductionBoundOwnerReservationV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
> = Readonly<{
  schema: "setfarm.internal-production-bound-owner-reservation.v1";
  category: Category;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  ownerKey: string;
  reservationRef: string;
  reservationHash: string;
  canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
  state: "bound";
  bindingHash: string;
}>;

export type InternalProductionTerminalOwnerAuthorityV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
> = Readonly<{
  schema: "setfarm.internal-production-terminal-owner-authority.v1";
  category: Category;
  ownerKey: string;
  ownerRef: string;
  ownerHash: string;
  terminalOwnerRef: string;
  terminalOwnerHash: string;
}>;

export type InternalProductionTerminalOwnerAuthorityPairV1 = Readonly<{
  terminalAuthorityRef: string;
  terminalAuthorityHash: string;
}>;

export type InternalProductionResolvedOwnerTerminalCloseInputV1 = Readonly<{
  reservationRef: string;
  reservationHash: string;
  terminalAuthorityRef: string;
  terminalAuthorityHash: string;
}>;

export type InternalProductionOwnerReservationCloseV1 = Readonly<{
  schema: "setfarm.internal-production-owner-reservation-close.v1";
  closeKind: "ordinary" | "fence-target";
  reservationRef: string;
  reservationHash: string;
  terminalOwnerRef: string;
  terminalOwnerHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: string | null;
  preservedFenceHash: string | null;
  closeRef: string;
  closeHash: string;
}>;

export type InternalProductionOwnerReservationIdentityV1 = Readonly<{
  category: InternalProductionOwnerCategoryV1;
  producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
  ownerKeyHash: string;
  reservationRef: string;
  reservationHash: string;
}>;

export type InternalProductionSourceRunLaunchTargetFamilyV1 = Readonly<{
  kind: "source-run-launch";
  sourceRunReservation: InternalProductionOwnerReservationIdentityV1 & Readonly<{
    category: "source-run";
    producerImplementationId: "a-recovery-source-run-v1";
  }>;
  runReservation: InternalProductionOwnerReservationIdentityV1 & Readonly<{
    category: "run";
    producerImplementationId: "a-recovery-source-bootstrap-run-v1";
  }>;
  targetRunLaunchCompositeHash: string;
  targetFamilyHash: string;
}>;

export type InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1 =
  | Readonly<{ kind: "recovery-active-run"; coordinatorAuthorityRef: string; coordinatorAuthorityHash: string; activeTargetAuthorityRef: string; activeTargetAuthorityHash: string }>
  | Readonly<{ kind: "source-release-barrier"; coordinatorAuthorityRef: string; coordinatorAuthorityHash: string; activeTargetAuthorityRef: null; activeTargetAuthorityHash: null }>
  | Readonly<{ kind: "cold-rehearsal"; coordinatorAuthorityRef: string; coordinatorAuthorityHash: string; activeTargetAuthorityRef: null; activeTargetAuthorityHash: null }>
  | Readonly<{ kind: "documentation-handoff"; coordinatorAuthorityRef: string; coordinatorAuthorityHash: string; activeTargetAuthorityRef: null; activeTargetAuthorityHash: null }>;

export const INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1 = detachedDeepFreeze({
  schema: "setfarm.internal-production-recovery-restart-target-family-abi.v1",
  restartReservation: { role: "restart-reservation", category: "restart-reservation", producerImplementationId: "d-restart-reservation-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "reserveInternalProductionServiceRestartDispatchOwnerV1" },
  serviceRestartOperationReservation: { role: "service-restart-operation", category: "service-restart-operation", producerImplementationId: "d-service-restart-operation-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "reserveInternalProductionServiceRestartOperationOwnerV1" },
  launchOutboxReservation: { role: "launch-outbox", category: "launch-outbox", producerImplementationId: "d-service-restart-launch-outbox-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartLaunchOutboxUnderFenceV1" },
  helperProcessReservation: { role: "helper-process", category: "process", producerImplementationId: "d-service-restart-helper-process-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartHelperProcessUnderFenceV1" },
  dispatchChildProcessReservation: { role: "dispatch-child-process", category: "process", producerImplementationId: "d-service-restart-child-process-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartDispatchChildProcessUnderFenceV1" },
  startupListenerReservation: { role: "startup-listener", category: "listener", producerImplementationId: "d-service-restart-startup-listener-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartStartupListenerUnderFenceV1" },
  replacementProcessReservation: { role: "replacement-process", category: "process", producerImplementationId: "d-service-restart-replacement-process-v1", expectedModuleRelativePath: "src/internal-production/internal-production-service-restart-authority-v1.ts", expectedExportName: "publishInternalProductionServiceRestartReplacementProcessUnderFenceV1" },
} as const);
export const INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1 = "c3d88ba2dc7d9e70d773d0056d2fdeaced399f63adc7fd1c37eb423fa22d08d5" as const;
export type InternalProductionRecoveryRestartNamespaceV1 = InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1["kind"];

type InternalProductionRecoveryRestartTargetFamilyCommonV1 = Readonly<{
  kind: "recovery-restart";
  authorizationOperationRef: string;
  authorizationOperationHash: string;
  service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
  coordinationHash: string;
  restartReservation: InternalProductionOwnerReservationIdentityV1 & { category: "restart-reservation"; producerImplementationId: "d-restart-reservation-v1" };
  serviceRestartOperationReservation: InternalProductionOwnerReservationIdentityV1 & { category: "service-restart-operation"; producerImplementationId: "d-service-restart-operation-v1" };
  launchOutboxReservation: InternalProductionOwnerReservationIdentityV1 & { category: "launch-outbox"; producerImplementationId: "d-service-restart-launch-outbox-v1" };
  helperProcessReservation: InternalProductionOwnerReservationIdentityV1 & { category: "process"; producerImplementationId: "d-service-restart-helper-process-v1" };
  dispatchChildProcessReservation: InternalProductionOwnerReservationIdentityV1 & { category: "process"; producerImplementationId: "d-service-restart-child-process-v1" };
  startupListenerReservation: InternalProductionOwnerReservationIdentityV1 & { category: "listener"; producerImplementationId: "d-service-restart-startup-listener-v1" };
  replacementProcessReservation: InternalProductionOwnerReservationIdentityV1 & { category: "process"; producerImplementationId: "d-service-restart-replacement-process-v1" };
  targetFamilyAbiHash: typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1;
  targetFamilyHash: string;
}>;
export type InternalProductionRecoveryRestartTargetFamilyV1 = {
  [Namespace in InternalProductionRecoveryRestartNamespaceV1]: InternalProductionRecoveryRestartTargetFamilyCommonV1 & Readonly<{ namespace: Namespace; coordinatorTargetAuthority: Extract<InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1, { kind: Namespace }> }>;
}[InternalProductionRecoveryRestartNamespaceV1];
export type InternalProductionRecoveryRestartOwnerAdmissionFenceInputV1 = {
  [Namespace in InternalProductionRecoveryRestartNamespaceV1]: Readonly<{
    purpose: "recovery-d-physical-service-restart-operation-v1";
    authorizationOperationRef: string;
    authorizationOperationHash: string;
    namespace: Namespace;
    service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control";
    coordinationHash: string;
    coordinatorTargetAuthority: Extract<InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1, { kind: Namespace }>;
  }>;
}[InternalProductionRecoveryRestartNamespaceV1];
export type InternalProductionRecoveryRestartOwnerAdmissionFenceResultV1 = Readonly<{
  fence: InternalProductionGlobalOwnerAdmissionFenceV1 & { targetFamily: InternalProductionRecoveryRestartTargetFamilyV1 };
  restartReservation: InternalProductionOwnerReservationV1 & { category: "restart-reservation"; producerImplementationId: "d-restart-reservation-v1" };
  serviceRestartOperationReservation: InternalProductionOwnerReservationV1 & { category: "service-restart-operation"; producerImplementationId: "d-service-restart-operation-v1" };
  launchOutboxReservation: InternalProductionOwnerReservationV1 & { category: "launch-outbox"; producerImplementationId: "d-service-restart-launch-outbox-v1" };
  helperProcessReservation: InternalProductionOwnerReservationV1 & { category: "process"; producerImplementationId: "d-service-restart-helper-process-v1" };
  dispatchChildProcessReservation: InternalProductionOwnerReservationV1 & { category: "process"; producerImplementationId: "d-service-restart-child-process-v1" };
  startupListenerReservation: InternalProductionOwnerReservationV1 & { category: "listener"; producerImplementationId: "d-service-restart-startup-listener-v1" };
  replacementProcessReservation: InternalProductionOwnerReservationV1 & { category: "process"; producerImplementationId: "d-service-restart-replacement-process-v1" };
}>;

export type InternalProductionServiceRestartTerminalOwnerAuthoritiesV1 = Readonly<{
  restartReservationTerminalOwnerRef: string; restartReservationTerminalOwnerHash: string;
  serviceRestartOperationTerminalOwnerRef: string; serviceRestartOperationTerminalOwnerHash: string;
  launchOutboxTerminalOwnerRef: string; launchOutboxTerminalOwnerHash: string;
  helperProcessTerminalOwnerRef: string; helperProcessTerminalOwnerHash: string;
  dispatchChildProcessTerminalOwnerRef: string; dispatchChildProcessTerminalOwnerHash: string;
  startupListenerTerminalOwnerRef: string; startupListenerTerminalOwnerHash: string;
  replacementProcessTerminalOwnerRef: string; replacementProcessTerminalOwnerHash: string;
}>;
export type InternalProductionServiceRestartTerminalCoreDispositionV1 =
  | Readonly<{ kind: "complete"; completionKind: "executed" | "adopted"; afterGenerationHash: string; failureCode: null; exactProcessAbsenceAuthorityHash: null }>
  | Readonly<{ kind: "failed"; completionKind: null; afterGenerationHash: null; failureCode: "SERVICE_RESTART_DISPATCH_OUTCOME_UNCERTAIN" | "SERVICE_RESTART_EXPECTED_PROCESS_DIED" | "SERVICE_RESTART_IDENTITY_AMBIGUOUS"; exactProcessAbsenceAuthorityHash: string }>;
export type InternalProductionServiceRestartTerminalCoreV1 = Readonly<{
  schema: "setfarm.internal-production-service-restart-terminal-core.v1"; namespace: InternalProductionRecoveryRestartNamespaceV1; service: "setfarm-spawner" | "setfarm-dashboard" | "mission-control"; coordinationHash: string;
  authorizationOperationRef: string; authorizationOperationHash: string; operationRef: string; operationHash: string; authorizationConsumptionRef: string; authorizationConsumptionHash: string;
  restartReservationRef: string; restartReservationHash: string; serviceRestartOperationReservationRef: string; serviceRestartOperationReservationHash: string; launchOutboxReservationRef: string; launchOutboxReservationHash: string; helperProcessReservationRef: string; helperProcessReservationHash: string; dispatchChildProcessReservationRef: string; dispatchChildProcessReservationHash: string; startupListenerReservationRef: string; startupListenerReservationHash: string; replacementProcessReservationRef: string; replacementProcessReservationHash: string;
  terminalOwnerAuthorities: InternalProductionServiceRestartTerminalOwnerAuthoritiesV1; disposition: InternalProductionServiceRestartTerminalCoreDispositionV1;
  targetFamilyAbiHash: typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1; targetFamilyHash: string; terminalCoreRef: string; terminalCoreHash: string;
}>;
export type InternalProductionRecoveryRestartTargetSetCloseV1 = Readonly<{
  schema: "setfarm.internal-production-recovery-restart-target-set-close.v1"; fenceRef: string; fenceHash: string; authorizationOperationRef: string; authorizationOperationHash: string;
  restartReservationRef: string; restartReservationHash: string; serviceRestartOperationReservationRef: string; serviceRestartOperationReservationHash: string; launchOutboxReservationRef: string; launchOutboxReservationHash: string; helperProcessReservationRef: string; helperProcessReservationHash: string; dispatchChildProcessReservationRef: string; dispatchChildProcessReservationHash: string; startupListenerReservationRef: string; startupListenerReservationHash: string; replacementProcessReservationRef: string; replacementProcessReservationHash: string;
  terminalCoreRef: string; terminalCoreHash: string; targetFamilyAbiHash: typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1; targetFamilyHash: string; ownerAdmissionHeadPredecessorHash: string; ownerAdmissionHeadSuccessorHash: string; preservedFenceRef: string; preservedFenceHash: string; targetSetCloseRef: string; targetSetCloseHash: string;
}>;

export type InternalProductionGlobalOwnerAdmissionFencePurposeV1 =
  | "recovery-d-physical-service-restart-operation-v1"
  | "recovery-d-source-delivery-v1"
  | "golden-launch-operation-migration-release-v1"
  | "recovery-d-physical-service-restart-authority-cutover-v1";

export type InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1 =
  | Readonly<{ kind: "none"; targetFamilyHash: null }>
  | InternalProductionSourceRunLaunchTargetFamilyV1
  | InternalProductionRecoveryRestartTargetFamilyV1;

export type InternalProductionGlobalOwnerAdmissionFenceV1 = Readonly<{
  schema: "setfarm.internal-production-global-owner-admission-fence.v1";
  purpose: InternalProductionGlobalOwnerAdmissionFencePurposeV1;
  pendingInputRef: string;
  pendingInputHash: string;
  ownerCategories: typeof INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1;
  ownerCategoryRegistryHash: string;
  ownerCategoryCensusMapHash: string;
  targetFamily: InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1;
  observedUnrelatedReservationCount: 0;
  observedUnrelatedOwnerCount: 0;
  ownerIdentitySetHash: string;
  predecessorFenceHeadHash: string | null;
  ownerAdmissionHeadHash: string;
  fenceRef: string;
  fenceHash: string;
}>;

export type InternalProductionSourceRunLaunchTargetReservationPairCloseV1 = Readonly<{
  schema: "setfarm.internal-production-source-run-launch-target-reservation-pair-close.v1";
  fenceRef: string;
  fenceHash: string;
  targetRunLaunchCompositeHash: string;
  sourceRunReservationRef: string;
  sourceRunReservationHash: string;
  runReservationRef: string;
  runReservationHash: string;
  terminalSourceRunRef: string;
  terminalSourceRunHash: string;
  terminalRunLaunchRef: string;
  terminalRunLaunchHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: string;
  preservedFenceHash: string;
  targetReservationPairCloseRef: string;
  targetReservationPairCloseHash: string;
}>;

type InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityMembersV1 = Readonly<{
  terminalCoreRef: string | null;
  terminalCoreHash: string | null;
  targetSetCloseRef: string | null;
  targetSetCloseHash: string | null;
  occurrenceRef: string | null;
  occurrenceHash: string | null;
  headRef: string | null;
  headHash: string | null;
  targetReservationPairCloseRef: string | null;
  targetReservationPairCloseHash: string | null;
  purposeTerminalKind:
    | "golden-launch-operation-migration-release-terminal"
    | "recovery-d-physical-service-restart-authority-cutover-terminal"
    | null;
  purposeTerminalRef: string | null;
  purposeTerminalHash: string | null;
}>;

export type InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1 =
  | (InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityMembersV1 & Readonly<{
      purpose: "recovery-d-physical-service-restart-operation-v1";
      targetFamilyKind: "recovery-restart";
      terminalCoreRef: string;
      terminalCoreHash: string;
      targetSetCloseRef: string;
      targetSetCloseHash: string;
      occurrenceRef: string;
      occurrenceHash: string;
      headRef: string;
      headHash: string;
      targetReservationPairCloseRef: null;
      targetReservationPairCloseHash: null;
      purposeTerminalKind: null;
      purposeTerminalRef: null;
      purposeTerminalHash: null;
    }>)
  | (InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityMembersV1 & Readonly<{
      purpose: "recovery-d-source-delivery-v1";
      targetFamilyKind: "source-run-launch";
      terminalCoreRef: null;
      terminalCoreHash: null;
      targetSetCloseRef: null;
      targetSetCloseHash: null;
      occurrenceRef: null;
      occurrenceHash: null;
      headRef: null;
      headHash: null;
      targetReservationPairCloseRef: string;
      targetReservationPairCloseHash: string;
      purposeTerminalKind: null;
      purposeTerminalRef: null;
      purposeTerminalHash: null;
    }>)
  | (InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityMembersV1 & Readonly<{
      purpose: "golden-launch-operation-migration-release-v1";
      targetFamilyKind: "none";
      terminalCoreRef: null;
      terminalCoreHash: null;
      targetSetCloseRef: null;
      targetSetCloseHash: null;
      occurrenceRef: null;
      occurrenceHash: null;
      headRef: null;
      headHash: null;
      targetReservationPairCloseRef: null;
      targetReservationPairCloseHash: null;
      purposeTerminalKind: "golden-launch-operation-migration-release-terminal";
      purposeTerminalRef: string;
      purposeTerminalHash: string;
    }>)
  | (InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityMembersV1 & Readonly<{
      purpose: "recovery-d-physical-service-restart-authority-cutover-v1";
      targetFamilyKind: "none";
      terminalCoreRef: null;
      terminalCoreHash: null;
      targetSetCloseRef: null;
      targetSetCloseHash: null;
      occurrenceRef: null;
      occurrenceHash: null;
      headRef: null;
      headHash: null;
      targetReservationPairCloseRef: null;
      targetReservationPairCloseHash: null;
      purposeTerminalKind: "recovery-d-physical-service-restart-authority-cutover-terminal";
      purposeTerminalRef: string;
      purposeTerminalHash: string;
    }>);

export type InternalProductionGlobalOwnerAdmissionFenceReleaseV1 = Readonly<{
  schema: "setfarm.internal-production-global-owner-admission-fence-release.v1";
  fenceRef: string;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  releaseRef: string;
  releaseHash: string;
}>;

export type InternalProductionGlobalOwnerAdmissionFenceTransitionV1 = Readonly<{
  schema: "setfarm.internal-production-global-owner-admission-fence-transition.v1";
  purpose: InternalProductionGlobalOwnerAdmissionFencePurposeV1;
  pendingInputRef: string;
  pendingInputHash: string;
  targetFamilyHash: string;
  ownerIdentitySetHash: string;
  transitionRef: string;
  transitionHash: string;
}>;

export type InternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1 = Readonly<{
  schema: "setfarm.internal-production-global-owner-admission-fence-release-transition.v1";
  fenceRef: string;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
  transitionRef: string;
  transitionHash: string;
}>;

function ownerReservationIdentityV1(
  value: unknown,
  expectedCategory: "source-run",
  expectedImplementationId: "a-recovery-source-run-v1",
): InternalProductionSourceRunLaunchTargetFamilyV1["sourceRunReservation"];
function ownerReservationIdentityV1(
  value: unknown,
  expectedCategory: "run",
  expectedImplementationId: "a-recovery-source-bootstrap-run-v1",
): InternalProductionSourceRunLaunchTargetFamilyV1["runReservation"];
function ownerReservationIdentityV1(
  value: unknown,
  expectedCategory: "source-run" | "run",
  expectedImplementationId:
    | "a-recovery-source-run-v1"
    | "a-recovery-source-bootstrap-run-v1",
): InternalProductionOwnerReservationIdentityV1 {
  const identity = record(value, "INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_INVALID");
  exactKeys(identity, [
    "category", "producerImplementationId", "ownerKeyHash", "reservationRef", "reservationHash",
  ], "INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_KEYS_INVALID");
  if (identity.category !== expectedCategory || identity.producerImplementationId !== expectedImplementationId) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_DISCRIMINATOR_INVALID");
  }
  sha256(identity.ownerKeyHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_OWNER_KEY_HASH_INVALID");
  const reservationHash = sha256(identity.reservationHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_HASH_INVALID");
  if (identity.reservationRef !== `setfarm://internal-production/owner-reservations/${reservationHash}`) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_REF_INVALID");
  }
  return detachedDeepFreeze(identity as InternalProductionOwnerReservationIdentityV1);
}

function ownerReservationIdentityFromReservationV1(
  reservationInput: InternalProductionOwnerReservationV1,
  expectedCategory: "source-run",
  expectedImplementationId: "a-recovery-source-run-v1",
): InternalProductionSourceRunLaunchTargetFamilyV1["sourceRunReservation"];
function ownerReservationIdentityFromReservationV1(
  reservationInput: InternalProductionOwnerReservationV1,
  expectedCategory: "run",
  expectedImplementationId: "a-recovery-source-bootstrap-run-v1",
): InternalProductionSourceRunLaunchTargetFamilyV1["runReservation"];
function ownerReservationIdentityFromReservationV1(
  reservationInput: InternalProductionOwnerReservationV1,
  expectedCategory: "source-run" | "run",
  expectedImplementationId:
    | "a-recovery-source-run-v1"
    | "a-recovery-source-bootstrap-run-v1",
): InternalProductionOwnerReservationIdentityV1 {
  const producer = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.find(
    (row) => row.implementationId === expectedImplementationId,
  );
  if (!producer) fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_PRODUCER_INVALID");
  const reservation = validateInternalProductionOwnerReservationV1(reservationInput, producer);
  if (reservation.category !== expectedCategory || reservation.producerImplementationId !== expectedImplementationId) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_IDENTITY_DISCRIMINATOR_INVALID");
  }
  return detachedDeepFreeze({
    category: reservation.category,
    producerImplementationId: reservation.producerImplementationId,
    ownerKeyHash: reservation.ownerKeyHash,
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
  });
}

export function createInternalProductionSourceRunLaunchTargetFamilyV1(input: Readonly<{
  sourceRunReservation: InternalProductionOwnerReservationV1;
  runReservation: InternalProductionOwnerReservationV1;
  targetRunLaunchCompositeHash: string;
}>): InternalProductionSourceRunLaunchTargetFamilyV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_INPUT_INVALID");
  exactKeys(outer, ["sourceRunReservation", "runReservation", "targetRunLaunchCompositeHash"],
    "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_INPUT_KEYS_INVALID");
  const projection = {
    kind: "source-run-launch" as const,
    sourceRunReservation: ownerReservationIdentityFromReservationV1(
      input.sourceRunReservation,
      "source-run",
      "a-recovery-source-run-v1",
    ),
    runReservation: ownerReservationIdentityFromReservationV1(
      input.runReservation,
      "run",
      "a-recovery-source-bootstrap-run-v1",
    ),
    targetRunLaunchCompositeHash: sha256(
      input.targetRunLaunchCompositeHash,
      "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_COMPOSITE_HASH_INVALID",
    ),
  };
  return detachedDeepFreeze({ ...projection, targetFamilyHash: hashCanonicalJson(projection) });
}

export function validateInternalProductionSourceRunLaunchTargetFamilyV1(
  value: unknown,
): InternalProductionSourceRunLaunchTargetFamilyV1 {
  const family = record(value, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_INVALID");
  exactKeys(family, [
    "kind", "sourceRunReservation", "runReservation", "targetRunLaunchCompositeHash", "targetFamilyHash",
  ], "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_KEYS_INVALID");
  if (family.kind !== "source-run-launch") fail("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_KIND_INVALID");
  const sourceRunReservation = ownerReservationIdentityV1(
    family.sourceRunReservation,
    "source-run",
    "a-recovery-source-run-v1",
  );
  const runReservation = ownerReservationIdentityV1(
    family.runReservation,
    "run",
    "a-recovery-source-bootstrap-run-v1",
  );
  const targetRunLaunchCompositeHash = sha256(
    family.targetRunLaunchCompositeHash,
    "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_COMPOSITE_HASH_INVALID",
  );
  const targetFamilyHash = sha256(
    family.targetFamilyHash,
    "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_HASH_INVALID",
  );
  const projection = { kind: "source-run-launch" as const, sourceRunReservation, runReservation, targetRunLaunchCompositeHash };
  if (hashCanonicalJson(projection) !== targetFamilyHash) {
    fail("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_TARGET_FAMILY_DERIVATION_INVALID");
  }
  return detachedDeepFreeze({ ...projection, targetFamilyHash });
}

export function validateInternalProductionRecoveryRestartCoordinatorTargetAuthorityV1(
  value: unknown,
): InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1 {
  const authority = record(value, "INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_INVALID");
  exactKeys(authority, ["kind", "coordinatorAuthorityRef", "coordinatorAuthorityHash", "activeTargetAuthorityRef", "activeTargetAuthorityHash"], "INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_KEYS_INVALID");
  if (!['recovery-active-run', 'source-release-barrier', 'cold-rehearsal', 'documentation-handoff'].includes(String(authority.kind))) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_KIND_INVALID");
  canonicalRef(authority.coordinatorAuthorityRef, "INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_PAIR_INVALID");
  sha256(authority.coordinatorAuthorityHash, "INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_PAIR_INVALID");
  if (authority.kind === "recovery-active-run") {
    canonicalRef(authority.activeTargetAuthorityRef, "INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_ACTIVE_PAIR_INVALID");
    sha256(authority.activeTargetAuthorityHash, "INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_ACTIVE_PAIR_INVALID");
  } else if (authority.activeTargetAuthorityRef !== null || authority.activeTargetAuthorityHash !== null) {
    fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_COORDINATOR_TARGET_AUTHORITY_ACTIVE_PAIR_INVALID");
  }
  return detachedDeepFreeze(authority as InternalProductionRecoveryRestartCoordinatorTargetAuthorityV1);
}

type RecoveryRestartAbiKeyV1 = Exclude<keyof typeof INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1, "schema">;
function recoveryRestartReservationIdentityV1(value: unknown, key: RecoveryRestartAbiKeyV1): InternalProductionOwnerReservationIdentityV1 {
  const descriptor = INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_V1[key];
  const identity = record(value, "INTERNAL_PRODUCTION_RECOVERY_RESTART_RESERVATION_IDENTITY_INVALID");
  exactKeys(identity, ["category", "producerImplementationId", "ownerKeyHash", "reservationRef", "reservationHash"], "INTERNAL_PRODUCTION_RECOVERY_RESTART_RESERVATION_IDENTITY_KEYS_INVALID");
  if (identity.category !== descriptor.category || identity.producerImplementationId !== descriptor.producerImplementationId) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_RESERVATION_IDENTITY_DISCRIMINATOR_INVALID");
  sha256(identity.ownerKeyHash, "INTERNAL_PRODUCTION_RECOVERY_RESTART_RESERVATION_IDENTITY_OWNER_KEY_INVALID");
  const reservationHash = sha256(identity.reservationHash, "INTERNAL_PRODUCTION_RECOVERY_RESTART_RESERVATION_IDENTITY_HASH_INVALID");
  if (identity.reservationRef !== `setfarm://internal-production/owner-reservations/${reservationHash}`) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_RESERVATION_IDENTITY_REF_INVALID");
  return detachedDeepFreeze(identity as InternalProductionOwnerReservationIdentityV1);
}

const RECOVERY_RESTART_FAMILY_INPUT_KEYS_V1 = [
  "authorizationOperationRef", "authorizationOperationHash", "namespace", "service", "coordinationHash", "coordinatorTargetAuthority",
  "restartReservation", "serviceRestartOperationReservation", "launchOutboxReservation", "helperProcessReservation",
  "dispatchChildProcessReservation", "startupListenerReservation", "replacementProcessReservation",
] as const;

export function createInternalProductionRecoveryRestartTargetFamilyV1(input: Readonly<Record<(typeof RECOVERY_RESTART_FAMILY_INPUT_KEYS_V1)[number], unknown>>): InternalProductionRecoveryRestartTargetFamilyV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_INPUT_INVALID");
  exactKeys(outer, RECOVERY_RESTART_FAMILY_INPUT_KEYS_V1, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_INPUT_KEYS_INVALID");
  const coordinatorTargetAuthority = validateInternalProductionRecoveryRestartCoordinatorTargetAuthorityV1(input.coordinatorTargetAuthority);
  if (input.namespace !== coordinatorTargetAuthority.kind) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_NAMESPACE_INVALID");
  if (!['setfarm-spawner', 'setfarm-dashboard', 'mission-control'].includes(String(input.service))) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_SERVICE_INVALID");
  const projection = {
    kind: "recovery-restart" as const,
    authorizationOperationRef: canonicalRef(input.authorizationOperationRef, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_OPERATION_INVALID"),
    authorizationOperationHash: sha256(input.authorizationOperationHash, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_OPERATION_INVALID"),
    namespace: input.namespace as InternalProductionRecoveryRestartNamespaceV1,
    service: input.service as "setfarm-spawner" | "setfarm-dashboard" | "mission-control",
    coordinationHash: sha256(input.coordinationHash, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_COORDINATION_INVALID"),
    coordinatorTargetAuthority,
    restartReservation: recoveryRestartReservationIdentityV1(input.restartReservation, "restartReservation"),
    serviceRestartOperationReservation: recoveryRestartReservationIdentityV1(input.serviceRestartOperationReservation, "serviceRestartOperationReservation"),
    launchOutboxReservation: recoveryRestartReservationIdentityV1(input.launchOutboxReservation, "launchOutboxReservation"),
    helperProcessReservation: recoveryRestartReservationIdentityV1(input.helperProcessReservation, "helperProcessReservation"),
    dispatchChildProcessReservation: recoveryRestartReservationIdentityV1(input.dispatchChildProcessReservation, "dispatchChildProcessReservation"),
    startupListenerReservation: recoveryRestartReservationIdentityV1(input.startupListenerReservation, "startupListenerReservation"),
    replacementProcessReservation: recoveryRestartReservationIdentityV1(input.replacementProcessReservation, "replacementProcessReservation"),
    targetFamilyAbiHash: INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1,
  };
  return detachedDeepFreeze({ ...projection, targetFamilyHash: hashCanonicalJson(projection) }) as InternalProductionRecoveryRestartTargetFamilyV1;
}

export function validateInternalProductionRecoveryRestartTargetFamilyV1(value: unknown): InternalProductionRecoveryRestartTargetFamilyV1 {
  const family = record(value, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_INVALID");
  exactKeys(family, ["kind", ...RECOVERY_RESTART_FAMILY_INPUT_KEYS_V1, "targetFamilyAbiHash", "targetFamilyHash"], "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_KEYS_INVALID");
  if (family.kind !== "recovery-restart" || family.targetFamilyAbiHash !== INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_INVALID");
  const rebuilt = createInternalProductionRecoveryRestartTargetFamilyV1(Object.fromEntries(RECOVERY_RESTART_FAMILY_INPUT_KEYS_V1.map((key) => [key, family[key]])) as never);
  if (family.targetFamilyHash !== rebuilt.targetFamilyHash) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_DERIVATION_INVALID");
  return rebuilt;
}

const TERMINAL_OWNER_AUTHORITY_KEYS_V1 = [
  "restartReservationTerminalOwnerRef", "restartReservationTerminalOwnerHash", "serviceRestartOperationTerminalOwnerRef", "serviceRestartOperationTerminalOwnerHash",
  "launchOutboxTerminalOwnerRef", "launchOutboxTerminalOwnerHash", "helperProcessTerminalOwnerRef", "helperProcessTerminalOwnerHash",
  "dispatchChildProcessTerminalOwnerRef", "dispatchChildProcessTerminalOwnerHash", "startupListenerTerminalOwnerRef", "startupListenerTerminalOwnerHash",
  "replacementProcessTerminalOwnerRef", "replacementProcessTerminalOwnerHash",
] as const;
function validateServiceRestartTerminalOwnerAuthoritiesV1(value: unknown): InternalProductionServiceRestartTerminalOwnerAuthoritiesV1 {
  const authorities = record(value, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_OWNER_AUTHORITIES_INVALID");
  exactKeys(authorities, TERMINAL_OWNER_AUTHORITY_KEYS_V1, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_OWNER_AUTHORITIES_KEYS_INVALID");
  for (let index = 0; index < TERMINAL_OWNER_AUTHORITY_KEYS_V1.length; index += 2) {
    canonicalRef(authorities[TERMINAL_OWNER_AUTHORITY_KEYS_V1[index]!], "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID");
    sha256(authorities[TERMINAL_OWNER_AUTHORITY_KEYS_V1[index + 1]!], "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID");
  }
  return detachedDeepFreeze(authorities as InternalProductionServiceRestartTerminalOwnerAuthoritiesV1);
}
function validateServiceRestartTerminalDispositionV1(value: unknown): InternalProductionServiceRestartTerminalCoreDispositionV1 {
  const disposition = record(value, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_INVALID");
  exactKeys(disposition, ["kind", "completionKind", "afterGenerationHash", "failureCode", "exactProcessAbsenceAuthorityHash"], "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_KEYS_INVALID");
  if (disposition.kind === "complete") {
    if (!['executed', 'adopted'].includes(String(disposition.completionKind)) || disposition.failureCode !== null || disposition.exactProcessAbsenceAuthorityHash !== null) fail("INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_COMPLETE_INVALID");
    sha256(disposition.afterGenerationHash, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_COMPLETE_INVALID");
  } else if (disposition.kind === "failed") {
    if (disposition.completionKind !== null || disposition.afterGenerationHash !== null || !['SERVICE_RESTART_DISPATCH_OUTCOME_UNCERTAIN', 'SERVICE_RESTART_EXPECTED_PROCESS_DIED', 'SERVICE_RESTART_IDENTITY_AMBIGUOUS'].includes(String(disposition.failureCode))) fail("INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_FAILED_INVALID");
    sha256(disposition.exactProcessAbsenceAuthorityHash, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_FAILED_INVALID");
  } else fail("INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_DISPOSITION_KIND_INVALID");
  return detachedDeepFreeze(disposition as InternalProductionServiceRestartTerminalCoreDispositionV1);
}

const TERMINAL_CORE_INPUT_KEYS_V1 = [
  "namespace", "service", "coordinationHash", "authorizationOperationRef", "authorizationOperationHash", "operationRef", "operationHash", "authorizationConsumptionRef", "authorizationConsumptionHash",
  "restartReservationRef", "restartReservationHash", "serviceRestartOperationReservationRef", "serviceRestartOperationReservationHash", "launchOutboxReservationRef", "launchOutboxReservationHash", "helperProcessReservationRef", "helperProcessReservationHash", "dispatchChildProcessReservationRef", "dispatchChildProcessReservationHash", "startupListenerReservationRef", "startupListenerReservationHash", "replacementProcessReservationRef", "replacementProcessReservationHash",
  "terminalOwnerAuthorities", "disposition", "targetFamilyAbiHash", "targetFamilyHash",
] as const;
export function createInternalProductionServiceRestartTerminalCoreV1(input: Readonly<Record<(typeof TERMINAL_CORE_INPUT_KEYS_V1)[number], unknown>>): InternalProductionServiceRestartTerminalCoreV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_INPUT_INVALID");
  exactKeys(outer, TERMINAL_CORE_INPUT_KEYS_V1, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_INPUT_KEYS_INVALID");
  if (!['recovery-active-run', 'source-release-barrier', 'cold-rehearsal', 'documentation-handoff'].includes(String(input.namespace)) || !['setfarm-spawner', 'setfarm-dashboard', 'mission-control'].includes(String(input.service)) || input.targetFamilyAbiHash !== INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1) fail("INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_DISCRIMINATOR_INVALID");
  const body: Record<string, unknown> = { schema: "setfarm.internal-production-service-restart-terminal-core.v1" };
  for (const key of TERMINAL_CORE_INPUT_KEYS_V1) body[key] = key === "terminalOwnerAuthorities" ? validateServiceRestartTerminalOwnerAuthoritiesV1(input[key]) : key === "disposition" ? validateServiceRestartTerminalDispositionV1(input[key]) : input[key];
  for (const key of ["coordinationHash", "authorizationOperationHash", "operationHash", "authorizationConsumptionHash", "restartReservationHash", "serviceRestartOperationReservationHash", "launchOutboxReservationHash", "helperProcessReservationHash", "dispatchChildProcessReservationHash", "startupListenerReservationHash", "replacementProcessReservationHash", "targetFamilyHash"] as const) body[key] = sha256(body[key], "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_HASH_INVALID");
  for (const key of ["authorizationOperationRef", "operationRef", "authorizationConsumptionRef", "restartReservationRef", "serviceRestartOperationReservationRef", "launchOutboxReservationRef", "helperProcessReservationRef", "dispatchChildProcessReservationRef", "startupListenerReservationRef", "replacementProcessReservationRef"] as const) body[key] = canonicalRef(body[key], "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_REF_INVALID");
  const terminalCoreHash = hashCanonicalJson(body);
  return detachedDeepFreeze({ ...body, terminalCoreRef: `setfarm://internal-production/service-restart-terminal-core/sha256/${terminalCoreHash}`, terminalCoreHash }) as InternalProductionServiceRestartTerminalCoreV1;
}
export function validateInternalProductionServiceRestartTerminalCoreV1(value: unknown): InternalProductionServiceRestartTerminalCoreV1 {
  const core = record(value, "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_INVALID");
  exactKeys(core, ["schema", ...TERMINAL_CORE_INPUT_KEYS_V1, "terminalCoreRef", "terminalCoreHash"], "INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_KEYS_INVALID");
  if (core.schema !== "setfarm.internal-production-service-restart-terminal-core.v1") fail("INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_SCHEMA_INVALID");
  const rebuilt = createInternalProductionServiceRestartTerminalCoreV1(Object.fromEntries(TERMINAL_CORE_INPUT_KEYS_V1.map((key) => [key, core[key]])) as never);
  if (core.terminalCoreRef !== rebuilt.terminalCoreRef || core.terminalCoreHash !== rebuilt.terminalCoreHash) fail("INTERNAL_PRODUCTION_SERVICE_RESTART_TERMINAL_CORE_DERIVATION_INVALID");
  return rebuilt;
}

const RECOVERY_RESTART_CLOSE_INPUT_KEYS_V1 = [
  "fenceRef", "fenceHash", "authorizationOperationRef", "authorizationOperationHash", "restartReservationRef", "restartReservationHash", "serviceRestartOperationReservationRef", "serviceRestartOperationReservationHash", "launchOutboxReservationRef", "launchOutboxReservationHash", "helperProcessReservationRef", "helperProcessReservationHash", "dispatchChildProcessReservationRef", "dispatchChildProcessReservationHash", "startupListenerReservationRef", "startupListenerReservationHash", "replacementProcessReservationRef", "replacementProcessReservationHash", "terminalCoreRef", "terminalCoreHash", "targetFamilyAbiHash", "targetFamilyHash", "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash", "preservedFenceRef", "preservedFenceHash",
] as const;
export function createInternalProductionRecoveryRestartTargetSetCloseV1(input: Readonly<Record<(typeof RECOVERY_RESTART_CLOSE_INPUT_KEYS_V1)[number], unknown>>): InternalProductionRecoveryRestartTargetSetCloseV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_INPUT_INVALID");
  exactKeys(outer, RECOVERY_RESTART_CLOSE_INPUT_KEYS_V1, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_INPUT_KEYS_INVALID");
  if (input.targetFamilyAbiHash !== INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_FAMILY_ABI_HASH_V1 || input.fenceRef !== input.preservedFenceRef || input.fenceHash !== input.preservedFenceHash) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_FENCE_INVALID");
  const body: Record<string, unknown> = { schema: "setfarm.internal-production-recovery-restart-target-set-close.v1" };
  for (const key of RECOVERY_RESTART_CLOSE_INPUT_KEYS_V1) body[key] = input[key];
  for (const key of ["fenceHash", "authorizationOperationHash", "restartReservationHash", "serviceRestartOperationReservationHash", "launchOutboxReservationHash", "helperProcessReservationHash", "dispatchChildProcessReservationHash", "startupListenerReservationHash", "replacementProcessReservationHash", "terminalCoreHash", "targetFamilyHash", "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash", "preservedFenceHash"] as const) body[key] = sha256(body[key], "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_HASH_INVALID");
  for (const key of ["fenceRef", "authorizationOperationRef", "restartReservationRef", "serviceRestartOperationReservationRef", "launchOutboxReservationRef", "helperProcessReservationRef", "dispatchChildProcessReservationRef", "startupListenerReservationRef", "replacementProcessReservationRef", "terminalCoreRef", "preservedFenceRef"] as const) body[key] = canonicalRef(body[key], "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_REF_INVALID");
  const targetSetCloseHash = hashCanonicalJson(body);
  return detachedDeepFreeze({ ...body, targetSetCloseRef: `setfarm://internal-production/recovery-restart-target-set-close/sha256/${targetSetCloseHash}`, targetSetCloseHash }) as InternalProductionRecoveryRestartTargetSetCloseV1;
}
export function validateInternalProductionRecoveryRestartTargetSetCloseV1(value: unknown): InternalProductionRecoveryRestartTargetSetCloseV1 {
  const close = record(value, "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_INVALID");
  exactKeys(close, ["schema", ...RECOVERY_RESTART_CLOSE_INPUT_KEYS_V1, "targetSetCloseRef", "targetSetCloseHash"], "INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_KEYS_INVALID");
  if (close.schema !== "setfarm.internal-production-recovery-restart-target-set-close.v1") fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_SCHEMA_INVALID");
  const rebuilt = createInternalProductionRecoveryRestartTargetSetCloseV1(Object.fromEntries(RECOVERY_RESTART_CLOSE_INPUT_KEYS_V1.map((key) => [key, close[key]])) as never);
  if (close.targetSetCloseRef !== rebuilt.targetSetCloseRef || close.targetSetCloseHash !== rebuilt.targetSetCloseHash) fail("INTERNAL_PRODUCTION_RECOVERY_RESTART_TARGET_SET_CLOSE_DERIVATION_INVALID");
  return rebuilt;
}

function globalOwnerAdmissionFencePurposeV1(value: unknown): InternalProductionGlobalOwnerAdmissionFencePurposeV1 {
  if (
    value !== "recovery-d-physical-service-restart-operation-v1"
    && value !== "recovery-d-source-delivery-v1"
    && value !== "golden-launch-operation-migration-release-v1"
    && value !== "recovery-d-physical-service-restart-authority-cutover-v1"
  ) fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PURPOSE_INVALID");
  return value;
}

export function createInternalProductionGlobalOwnerAdmissionFenceTransitionV1(input: Readonly<{
  purpose: InternalProductionGlobalOwnerAdmissionFencePurposeV1;
  pendingInputRef: string;
  pendingInputHash: string;
  targetFamilyHash: string;
  ownerIdentitySetHash: string;
}>): InternalProductionGlobalOwnerAdmissionFenceTransitionV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_INPUT_INVALID");
  exactKeys(outer, [
    "purpose", "pendingInputRef", "pendingInputHash", "targetFamilyHash", "ownerIdentitySetHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_INPUT_KEYS_INVALID");
  const projection = {
    schema: "setfarm.internal-production-global-owner-admission-fence-transition.v1" as const,
    purpose: globalOwnerAdmissionFencePurposeV1(input.purpose),
    pendingInputRef: canonicalRef(input.pendingInputRef, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_PENDING_INVALID"),
    pendingInputHash: sha256(input.pendingInputHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_PENDING_INVALID"),
    targetFamilyHash: sha256(input.targetFamilyHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_TARGET_INVALID"),
    ownerIdentitySetHash: sha256(input.ownerIdentitySetHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_OWNER_SET_INVALID"),
  };
  const transitionHash = hashCanonicalJson(projection);
  return detachedDeepFreeze({
    ...projection,
    transitionRef: `setfarm://internal-production/global-owner-admission-fence-transition/sha256/${transitionHash}`,
    transitionHash,
  });
}

export function validateInternalProductionGlobalOwnerAdmissionFenceTransitionV1(
  value: unknown,
): InternalProductionGlobalOwnerAdmissionFenceTransitionV1 {
  const transition = record(value, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_INVALID");
  exactKeys(transition, [
    "schema", "purpose", "pendingInputRef", "pendingInputHash", "targetFamilyHash",
    "ownerIdentitySetHash", "transitionRef", "transitionHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_KEYS_INVALID");
  if (transition.schema !== "setfarm.internal-production-global-owner-admission-fence-transition.v1") {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_SCHEMA_INVALID");
  }
  const rebuilt = createInternalProductionGlobalOwnerAdmissionFenceTransitionV1({
    purpose: transition.purpose as InternalProductionGlobalOwnerAdmissionFencePurposeV1,
    pendingInputRef: String(transition.pendingInputRef),
    pendingInputHash: String(transition.pendingInputHash),
    targetFamilyHash: String(transition.targetFamilyHash),
    ownerIdentitySetHash: String(transition.ownerIdentitySetHash),
  });
  if (transition.transitionRef !== rebuilt.transitionRef || transition.transitionHash !== rebuilt.transitionHash) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TRANSITION_DERIVATION_INVALID");
  }
  return rebuilt;
}

function validateFenceTargetFamilyV1(value: unknown): InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1 {
  const target = record(value, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TARGET_INVALID");
  if (target.kind === "none") {
    exactKeys(target, ["kind", "targetFamilyHash"], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TARGET_KEYS_INVALID");
    if (target.targetFamilyHash !== null) fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TARGET_INVALID");
    return detachedDeepFreeze({ kind: "none" as const, targetFamilyHash: null });
  }
  return target.kind === "recovery-restart"
    ? validateInternalProductionRecoveryRestartTargetFamilyV1(target)
    : validateInternalProductionSourceRunLaunchTargetFamilyV1(target);
}

export function createInternalProductionGlobalOwnerAdmissionFenceV1(input: Readonly<{
  purpose: InternalProductionGlobalOwnerAdmissionFencePurposeV1;
  pendingInputRef: string;
  pendingInputHash: string;
  targetFamily: InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1;
  observedUnrelatedReservationCount: 0;
  observedUnrelatedOwnerCount: 0;
  ownerIdentitySetHash: string;
  predecessorFenceHeadHash: string | null;
  ownerAdmissionHeadHash: string;
}>): InternalProductionGlobalOwnerAdmissionFenceV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_INPUT_INVALID");
  exactKeys(outer, [
    "purpose", "pendingInputRef", "pendingInputHash", "targetFamily",
    "observedUnrelatedReservationCount", "observedUnrelatedOwnerCount",
    "ownerIdentitySetHash", "predecessorFenceHeadHash", "ownerAdmissionHeadHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_INPUT_KEYS_INVALID");
  const purpose = globalOwnerAdmissionFencePurposeV1(input.purpose);
  const targetFamily = validateFenceTargetFamilyV1(input.targetFamily);
  if (
    (purpose === "recovery-d-source-delivery-v1") !== (targetFamily.kind === "source-run-launch")
    || (purpose === "recovery-d-physical-service-restart-operation-v1") !== (targetFamily.kind === "recovery-restart")
  ) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_TARGET_INVALID");
  }
  if (input.observedUnrelatedReservationCount !== 0 || input.observedUnrelatedOwnerCount !== 0) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_CENSUS_NONZERO");
  }
  const predecessorFenceHeadHash = input.predecessorFenceHeadHash === null
    ? null
    : sha256(input.predecessorFenceHeadHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PREDECESSOR_INVALID");
  const body = {
    schema: "setfarm.internal-production-global-owner-admission-fence.v1" as const,
    purpose,
    pendingInputRef: canonicalRef(input.pendingInputRef, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PENDING_INPUT_INVALID"),
    pendingInputHash: sha256(input.pendingInputHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_PENDING_INPUT_INVALID"),
    ownerCategories: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
    ownerCategoryRegistryHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1,
    ownerCategoryCensusMapHash: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1,
    targetFamily,
    observedUnrelatedReservationCount: 0 as const,
    observedUnrelatedOwnerCount: 0 as const,
    ownerIdentitySetHash: sha256(input.ownerIdentitySetHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_OWNER_SET_INVALID"),
    predecessorFenceHeadHash,
    ownerAdmissionHeadHash: sha256(input.ownerAdmissionHeadHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_HEAD_INVALID"),
  };
  const fenceHash = hashCanonicalJson(body);
  return detachedDeepFreeze({
    ...body,
    fenceRef: `setfarm://internal-production/global-owner-admission-fence/sha256/${fenceHash}`,
    fenceHash,
  });
}

export function validateInternalProductionGlobalOwnerAdmissionFenceV1(
  value: unknown,
): InternalProductionGlobalOwnerAdmissionFenceV1 {
  const fence = record(value, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_INVALID");
  exactKeys(fence, [
    "schema", "purpose", "pendingInputRef", "pendingInputHash", "ownerCategories",
    "ownerCategoryRegistryHash", "ownerCategoryCensusMapHash", "targetFamily",
    "observedUnrelatedReservationCount", "observedUnrelatedOwnerCount", "ownerIdentitySetHash",
    "predecessorFenceHeadHash", "ownerAdmissionHeadHash", "fenceRef", "fenceHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_KEYS_INVALID");
  if (fence.schema !== "setfarm.internal-production-global-owner-admission-fence.v1") {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_SCHEMA_INVALID");
  }
  const { fenceRef, fenceHash, ...inputBody } = fence;
  if (!equalCanonical(fence.ownerCategories, INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1)
    || fence.ownerCategoryRegistryHash !== INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_HASH_V1
    || fence.ownerCategoryCensusMapHash !== INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_HASH_V1) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_REGISTRY_INVALID");
  }
  const rebuilt = createInternalProductionGlobalOwnerAdmissionFenceV1({
    purpose: inputBody.purpose as InternalProductionGlobalOwnerAdmissionFencePurposeV1,
    pendingInputRef: String(inputBody.pendingInputRef),
    pendingInputHash: String(inputBody.pendingInputHash),
    targetFamily: inputBody.targetFamily as InternalProductionGlobalOwnerAdmissionFenceTargetFamilyV1,
    observedUnrelatedReservationCount: inputBody.observedUnrelatedReservationCount as 0,
    observedUnrelatedOwnerCount: inputBody.observedUnrelatedOwnerCount as 0,
    ownerIdentitySetHash: String(inputBody.ownerIdentitySetHash),
    predecessorFenceHeadHash: inputBody.predecessorFenceHeadHash as string | null,
    ownerAdmissionHeadHash: String(inputBody.ownerAdmissionHeadHash),
  });
  if (fenceHash !== rebuilt.fenceHash || fenceRef !== rebuilt.fenceRef) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_DERIVATION_INVALID");
  }
  return rebuilt;
}

export function createInternalProductionSourceRunLaunchTargetReservationPairCloseV1(input: Readonly<{
  fenceRef: string;
  fenceHash: string;
  targetRunLaunchCompositeHash: string;
  sourceRunReservationRef: string;
  sourceRunReservationHash: string;
  runReservationRef: string;
  runReservationHash: string;
  terminalSourceRunRef: string;
  terminalSourceRunHash: string;
  terminalRunLaunchRef: string;
  terminalRunLaunchHash: string;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: string;
  preservedFenceHash: string;
}>): InternalProductionSourceRunLaunchTargetReservationPairCloseV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_INPUT_INVALID");
  exactKeys(outer, [
    "fenceRef", "fenceHash", "targetRunLaunchCompositeHash",
    "sourceRunReservationRef", "sourceRunReservationHash", "runReservationRef", "runReservationHash",
    "terminalSourceRunRef", "terminalSourceRunHash", "terminalRunLaunchRef", "terminalRunLaunchHash",
    "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash",
    "preservedFenceRef", "preservedFenceHash",
  ], "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_INPUT_KEYS_INVALID");
  const body = {
    schema: "setfarm.internal-production-source-run-launch-target-reservation-pair-close.v1" as const,
    fenceRef: canonicalRef(input.fenceRef, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_FENCE_INVALID"),
    fenceHash: sha256(input.fenceHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_FENCE_INVALID"),
    targetRunLaunchCompositeHash: sha256(input.targetRunLaunchCompositeHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_COMPOSITE_INVALID"),
    sourceRunReservationRef: canonicalRef(input.sourceRunReservationRef, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_SOURCE_RESERVATION_INVALID"),
    sourceRunReservationHash: sha256(input.sourceRunReservationHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_SOURCE_RESERVATION_INVALID"),
    runReservationRef: canonicalRef(input.runReservationRef, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_RUN_RESERVATION_INVALID"),
    runReservationHash: sha256(input.runReservationHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_RUN_RESERVATION_INVALID"),
    terminalSourceRunRef: canonicalRef(input.terminalSourceRunRef, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_SOURCE_TERMINAL_INVALID"),
    terminalSourceRunHash: sha256(input.terminalSourceRunHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_SOURCE_TERMINAL_INVALID"),
    terminalRunLaunchRef: canonicalRef(input.terminalRunLaunchRef, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_RUN_TERMINAL_INVALID"),
    terminalRunLaunchHash: sha256(input.terminalRunLaunchHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_RUN_TERMINAL_INVALID"),
    ownerAdmissionHeadPredecessorHash: sha256(input.ownerAdmissionHeadPredecessorHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_HEAD_INVALID"),
    ownerAdmissionHeadSuccessorHash: sha256(input.ownerAdmissionHeadSuccessorHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_HEAD_INVALID"),
    preservedFenceRef: canonicalRef(input.preservedFenceRef, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_PRESERVED_FENCE_INVALID"),
    preservedFenceHash: sha256(input.preservedFenceHash, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_PRESERVED_FENCE_INVALID"),
  };
  if (body.fenceRef !== body.preservedFenceRef || body.fenceHash !== body.preservedFenceHash) {
    fail("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_PRESERVED_FENCE_INVALID");
  }
  const targetReservationPairCloseHash = hashCanonicalJson(body);
  return detachedDeepFreeze({
    ...body,
    targetReservationPairCloseRef: `setfarm://internal-production/source-run-launch-target-reservation-pair-close/sha256/${targetReservationPairCloseHash}`,
    targetReservationPairCloseHash,
  });
}

export function validateInternalProductionSourceRunLaunchTargetReservationPairCloseV1(
  value: unknown,
): InternalProductionSourceRunLaunchTargetReservationPairCloseV1 {
  const close = record(value, "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_INVALID");
  exactKeys(close, [
    "schema", "fenceRef", "fenceHash", "targetRunLaunchCompositeHash",
    "sourceRunReservationRef", "sourceRunReservationHash", "runReservationRef", "runReservationHash",
    "terminalSourceRunRef", "terminalSourceRunHash", "terminalRunLaunchRef", "terminalRunLaunchHash",
    "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash",
    "preservedFenceRef", "preservedFenceHash", "targetReservationPairCloseRef", "targetReservationPairCloseHash",
  ], "INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_KEYS_INVALID");
  if (close.schema !== "setfarm.internal-production-source-run-launch-target-reservation-pair-close.v1") {
    fail("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_SCHEMA_INVALID");
  }
  const rebuilt = createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
    fenceRef: String(close.fenceRef),
    fenceHash: String(close.fenceHash),
    targetRunLaunchCompositeHash: String(close.targetRunLaunchCompositeHash),
    sourceRunReservationRef: String(close.sourceRunReservationRef),
    sourceRunReservationHash: String(close.sourceRunReservationHash),
    runReservationRef: String(close.runReservationRef),
    runReservationHash: String(close.runReservationHash),
    terminalSourceRunRef: String(close.terminalSourceRunRef),
    terminalSourceRunHash: String(close.terminalSourceRunHash),
    terminalRunLaunchRef: String(close.terminalRunLaunchRef),
    terminalRunLaunchHash: String(close.terminalRunLaunchHash),
    ownerAdmissionHeadPredecessorHash: String(close.ownerAdmissionHeadPredecessorHash),
    ownerAdmissionHeadSuccessorHash: String(close.ownerAdmissionHeadSuccessorHash),
    preservedFenceRef: String(close.preservedFenceRef),
    preservedFenceHash: String(close.preservedFenceHash),
  });
  if (
    close.targetReservationPairCloseRef !== rebuilt.targetReservationPairCloseRef
    || close.targetReservationPairCloseHash !== rebuilt.targetReservationPairCloseHash
  ) fail("INTERNAL_PRODUCTION_SOURCE_RUN_LAUNCH_PAIR_CLOSE_DERIVATION_INVALID");
  return rebuilt;
}

function validateFenceReleaseAuthorityV1(
  value: unknown,
): InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1 {
  const authority = record(value, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_INVALID");
  exactKeys(authority, [
    "purpose", "targetFamilyKind", "terminalCoreRef", "terminalCoreHash", "targetSetCloseRef",
    "targetSetCloseHash", "occurrenceRef", "occurrenceHash", "headRef", "headHash",
    "targetReservationPairCloseRef", "targetReservationPairCloseHash", "purposeTerminalKind",
    "purposeTerminalRef", "purposeTerminalHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_KEYS_INVALID");
  const purpose = globalOwnerAdmissionFencePurposeV1(authority.purpose);
  const pairMembers: readonly [string, string][] = [
    ["terminalCoreRef", "terminalCoreHash"], ["targetSetCloseRef", "targetSetCloseHash"],
    ["occurrenceRef", "occurrenceHash"], ["headRef", "headHash"],
    ["targetReservationPairCloseRef", "targetReservationPairCloseHash"],
    ["purposeTerminalRef", "purposeTerminalHash"],
  ];
  for (const [refKey, hashKey] of pairMembers) {
    if ((authority[refKey] === null) !== (authority[hashKey] === null)) {
      fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_PAIR_INVALID");
    }
    if (authority[refKey] !== null) {
      canonicalRef(authority[refKey], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_PAIR_INVALID");
      sha256(authority[hashKey], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_PAIR_INVALID");
    }
  }
  if (purpose === "recovery-d-source-delivery-v1") {
    if (
      authority.targetFamilyKind !== "source-run-launch"
      || authority.targetReservationPairCloseRef === null
      || authority.purposeTerminalKind !== null
      || pairMembers.slice(0, 4).some(([refKey]) => authority[refKey] !== null)
      || authority.purposeTerminalRef !== null
    ) fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_BRANCH_INVALID");
  } else if (purpose === "recovery-d-physical-service-restart-operation-v1") {
    if (
      authority.targetFamilyKind !== "recovery-restart"
      || pairMembers.slice(0, 4).some(([refKey]) => authority[refKey] === null)
      || authority.targetReservationPairCloseRef !== null
      || authority.purposeTerminalKind !== null
      || authority.purposeTerminalRef !== null
    ) fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_BRANCH_INVALID");
  } else {
    const expectedTerminalKind = purpose === "golden-launch-operation-migration-release-v1"
      ? "golden-launch-operation-migration-release-terminal"
      : "recovery-d-physical-service-restart-authority-cutover-terminal";
    if (
      authority.targetFamilyKind !== "none"
      || pairMembers.slice(0, 5).some(([refKey]) => authority[refKey] !== null)
      || authority.purposeTerminalKind !== expectedTerminalKind
      || authority.purposeTerminalRef === null
    ) fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_AUTHORITY_BRANCH_INVALID");
  }
  return detachedDeepFreeze(authority as InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1);
}

export function createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1(input: Readonly<{
  fenceRef: string;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
}>): InternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_INPUT_INVALID");
  exactKeys(outer, ["fenceRef", "fenceHash", "releaseAuthority"],
    "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_INPUT_KEYS_INVALID");
  const projection = {
    schema: "setfarm.internal-production-global-owner-admission-fence-release-transition.v1" as const,
    fenceRef: canonicalRef(input.fenceRef, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_FENCE_INVALID"),
    fenceHash: sha256(input.fenceHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_FENCE_INVALID"),
    releaseAuthority: validateFenceReleaseAuthorityV1(input.releaseAuthority),
  };
  const transitionHash = hashCanonicalJson(projection);
  return detachedDeepFreeze({
    ...projection,
    transitionRef: `setfarm://internal-production/global-owner-admission-fence-release-transition/sha256/${transitionHash}`,
    transitionHash,
  });
}

export function validateInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1(
  value: unknown,
): InternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1 {
  const transition = record(value, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_INVALID");
  exactKeys(transition, [
    "schema", "fenceRef", "fenceHash", "releaseAuthority", "transitionRef", "transitionHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_KEYS_INVALID");
  if (transition.schema !== "setfarm.internal-production-global-owner-admission-fence-release-transition.v1") {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_SCHEMA_INVALID");
  }
  const rebuilt = createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1({
    fenceRef: String(transition.fenceRef),
    fenceHash: String(transition.fenceHash),
    releaseAuthority: transition.releaseAuthority as InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1,
  });
  if (transition.transitionRef !== rebuilt.transitionRef || transition.transitionHash !== rebuilt.transitionHash) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_TRANSITION_DERIVATION_INVALID");
  }
  return rebuilt;
}

export function createInternalProductionGlobalOwnerAdmissionFenceReleaseV1(input: Readonly<{
  fenceRef: string;
  fenceHash: string;
  releaseAuthority: InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
}>): InternalProductionGlobalOwnerAdmissionFenceReleaseV1 {
  const outer = record(input, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_INPUT_INVALID");
  exactKeys(outer, [
    "fenceRef", "fenceHash", "releaseAuthority",
    "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_INPUT_KEYS_INVALID");
  const body = {
    schema: "setfarm.internal-production-global-owner-admission-fence-release.v1" as const,
    fenceRef: canonicalRef(input.fenceRef, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_FENCE_INVALID"),
    fenceHash: sha256(input.fenceHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_FENCE_INVALID"),
    releaseAuthority: validateFenceReleaseAuthorityV1(input.releaseAuthority),
    ownerAdmissionHeadPredecessorHash: sha256(input.ownerAdmissionHeadPredecessorHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_HEAD_INVALID"),
    ownerAdmissionHeadSuccessorHash: sha256(input.ownerAdmissionHeadSuccessorHash, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_HEAD_INVALID"),
  };
  const releaseHash = hashCanonicalJson(body);
  return detachedDeepFreeze({
    ...body,
    releaseRef: `setfarm://internal-production/global-owner-admission-fence-release/sha256/${releaseHash}`,
    releaseHash,
  });
}

export function validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(
  value: unknown,
): InternalProductionGlobalOwnerAdmissionFenceReleaseV1 {
  const release = record(value, "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_INVALID");
  exactKeys(release, [
    "schema", "fenceRef", "fenceHash", "releaseAuthority",
    "ownerAdmissionHeadPredecessorHash", "ownerAdmissionHeadSuccessorHash", "releaseRef", "releaseHash",
  ], "INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_KEYS_INVALID");
  if (release.schema !== "setfarm.internal-production-global-owner-admission-fence-release.v1") {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_SCHEMA_INVALID");
  }
  const rebuilt = createInternalProductionGlobalOwnerAdmissionFenceReleaseV1({
    fenceRef: String(release.fenceRef),
    fenceHash: String(release.fenceHash),
    releaseAuthority: release.releaseAuthority as InternalProductionGlobalOwnerAdmissionFenceReleaseAuthorityV1,
    ownerAdmissionHeadPredecessorHash: String(release.ownerAdmissionHeadPredecessorHash),
    ownerAdmissionHeadSuccessorHash: String(release.ownerAdmissionHeadSuccessorHash),
  });
  if (release.releaseRef !== rebuilt.releaseRef || release.releaseHash !== rebuilt.releaseHash) {
    fail("INTERNAL_PRODUCTION_GLOBAL_OWNER_ADMISSION_FENCE_RELEASE_DERIVATION_INVALID");
  }
  return rebuilt;
}

function reservationProjection(input: Readonly<{
  producer: InternalProductionOwnerProducerRowV1;
  ownerKey: string;
  ownerAdmissionHeadPredecessorHash: string;
}>) {
  const producer = validateProducerRow(input.producer);
  const ownerKey = stringValue(
    input.ownerKey,
    "INTERNAL_PRODUCTION_OWNER_KEY_INVALID",
    INTERNAL_PRODUCTION_OWNER_KEY_MAXIMUM_V1,
  );
  const predecessor = sha256(
    input.ownerAdmissionHeadPredecessorHash,
    "INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_PREDECESSOR_HASH_INVALID",
  );
  const ownerKeyHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-key.v1",
    ownerKeyDerivationId: producer.ownerKeyDerivationId,
    ownerKey,
  });
  const producerPurposeHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-purpose.v1",
    plan: producer.plan,
    module: producer.module,
    function: producer.function,
    category: producer.category,
    ownerKeyDerivationId: producer.ownerKeyDerivationId,
    censusKeys: producer.censusKeys,
  });
  const producerImplementationHash = hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-implementation.v1",
    producer,
  });
  return {
    schema: "setfarm.internal-production-owner-reservation.v1" as const,
    category: producer.category,
    ownerKey,
    ownerKeyHash,
    producerPurposeHash,
    producerImplementationId: producer.implementationId,
    producerImplementationHash,
    canonicalOwnerIdentity: null,
    state: "pending" as const,
    ownerAdmissionHeadPredecessorHash: predecessor,
  };
}

export function createInternalProductionOwnerReservationV1(input: Readonly<{
  producer: InternalProductionOwnerProducerRowV1;
  ownerKey: string;
  ownerAdmissionHeadPredecessorHash: string;
}>): InternalProductionOwnerReservationV1 {
  const projection = reservationProjection(input);
  const reservationHash = hashCanonicalJson(projection);
  return detachedDeepFreeze({
    ...projection,
    reservationRef: contentRef("owner-reservations", reservationHash),
    reservationHash,
  });
}

export function validateInternalProductionOwnerReservationV1(
  value: unknown,
  producer: InternalProductionOwnerProducerRowV1,
): InternalProductionOwnerReservationV1 {
  const reservation = record(value, "INTERNAL_PRODUCTION_OWNER_RESERVATION_INVALID");
  exactKeys(reservation, [
    "schema", "category", "ownerKey", "ownerKeyHash", "producerPurposeHash",
    "producerImplementationId", "producerImplementationHash", "canonicalOwnerIdentity",
    "state", "ownerAdmissionHeadPredecessorHash", "reservationRef", "reservationHash",
  ], "INTERNAL_PRODUCTION_OWNER_RESERVATION_KEYS_INVALID");
  if (reservation.schema !== "setfarm.internal-production-owner-reservation.v1"
    || reservation.canonicalOwnerIdentity !== null || reservation.state !== "pending") {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_SHAPE_INVALID");
  }
  category(reservation.category, "INTERNAL_PRODUCTION_OWNER_RESERVATION_CATEGORY_INVALID");
  stringValue(
    reservation.ownerKey,
    "INTERNAL_PRODUCTION_OWNER_KEY_INVALID",
    INTERNAL_PRODUCTION_OWNER_KEY_MAXIMUM_V1,
  );
  sha256(reservation.ownerKeyHash, "INTERNAL_PRODUCTION_OWNER_KEY_HASH_INVALID");
  sha256(reservation.producerPurposeHash, "INTERNAL_PRODUCTION_OWNER_PRODUCER_PURPOSE_HASH_INVALID");
  stringValue(reservation.producerImplementationId,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_ID_INVALID");
  sha256(reservation.producerImplementationHash,
    "INTERNAL_PRODUCTION_OWNER_PRODUCER_IMPLEMENTATION_HASH_INVALID");
  sha256(reservation.ownerAdmissionHeadPredecessorHash,
    "INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_PREDECESSOR_HASH_INVALID");
  canonicalRef(reservation.reservationRef, "INTERNAL_PRODUCTION_OWNER_RESERVATION_REF_INVALID");
  sha256(reservation.reservationHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_HASH_INVALID");
  const expected = createInternalProductionOwnerReservationV1({
    producer,
    ownerKey: reservation.ownerKey as string,
    ownerAdmissionHeadPredecessorHash: reservation.ownerAdmissionHeadPredecessorHash as string,
  });
  if (!equalCanonical(value, expected)) fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_DERIVATION_INVALID");
  return detachedDeepFreeze(value as InternalProductionOwnerReservationV1);
}

export function validateInternalProductionCanonicalOwnerIdentityV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
>(value: unknown): InternalProductionCanonicalOwnerIdentityV1<Category> {
  const identity = record(value, "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_INVALID");
  exactKeys(identity, ["schema", "category", "ownerKey", "ownerRef", "ownerHash"],
    "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_KEYS_INVALID");
  if (identity.schema !== "setfarm.internal-production-canonical-owner-identity.v1") {
    fail("INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_SCHEMA_INVALID");
  }
  category(identity.category, "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_CATEGORY_INVALID");
  stringValue(
    identity.ownerKey,
    "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_OWNER_KEY_INVALID",
    INTERNAL_PRODUCTION_OWNER_KEY_MAXIMUM_V1,
  );
  canonicalRef(
    identity.ownerRef,
    "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_OWNER_REF_INVALID",
    INTERNAL_PRODUCTION_OWNER_REF_MAXIMUM_V1,
  );
  sha256(identity.ownerHash, "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_OWNER_HASH_INVALID");
  return detachedDeepFreeze(value as InternalProductionCanonicalOwnerIdentityV1<Category>);
}

function exactBuilderInputV1(
  value: unknown,
  expected: readonly string[],
  code: string,
): Record<string, unknown> {
  const input = record(value, code);
  exactKeys(input, expected, code);
  return input;
}

function canonicalSegmentV1(value: string, code: string): string {
  try {
    if (value.length === 0) throw new Error();
    const encoded = encodeURIComponent(value);
    if (encoded.includes("/") || decodeURIComponent(encoded) !== value) throw new Error();
    const decoded = decodeURIComponent(encoded);
    if (encodeURIComponent(decoded) !== encoded) throw new Error();
    return encoded;
  } catch {
    fail(code);
  }
}

function canonicalClaimIdTextV1(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[1-9][0-9]{0,18}$/.test(value)
    || BigInt(value) > 9_007_199_254_740_991n
  ) fail("INTERNAL_PRODUCTION_CLAIM_ID_INVALID");
  return value;
}

function canonicalPrefixedIdV1(
  value: unknown,
  pattern: RegExp,
  code: string,
): string {
  if (typeof value !== "string" || !pattern.test(value)) fail(code);
  return value;
}

function canonicalPrintableKeyV1(value: unknown, code: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 4_096
    || !/^[\x21-\x7e]+$/.test(value)
  ) fail(code);
  return value;
}

export function createInternalProductionClaimCanonicalOwnerIdentityV1(
  value: Readonly<{ claimIdText: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"claim"> {
  const input = exactBuilderInputV1(
    value,
    ["claimIdText"],
    "INTERNAL_PRODUCTION_CLAIM_CANONICAL_OWNER_INPUT_INVALID",
  );
  const claimIdText = canonicalClaimIdTextV1(input.claimIdText);
  const body = {
    schema: "setfarm.internal-production-claim-owner.v1",
    claimId: claimIdText,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "claim",
    ownerKey: claimIdText,
    ownerRef: `setfarm://claim-log/${claimIdText}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionExecutionAttemptCanonicalOwnerIdentityV1(
  value: Readonly<{ attemptId: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"execution-attempt"> {
  const input = exactBuilderInputV1(
    value,
    ["attemptId"],
    "INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_CANONICAL_OWNER_INPUT_INVALID",
  );
  const attemptId = canonicalPrefixedIdV1(
    input.attemptId,
    /^ATT_[A-Za-z0-9-]{16,160}$/,
    "INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_ID_INVALID",
  );
  const body = {
    schema: "setfarm.internal-production-execution-attempt-owner.v1",
    attemptId,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "execution-attempt",
    ownerKey: attemptId,
    ownerRef: `setfarm://execution-attempt/${canonicalSegmentV1(
      attemptId,
      "INTERNAL_PRODUCTION_EXECUTION_ATTEMPT_REF_INVALID",
    )}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionRuntimeSessionCanonicalOwnerIdentityV1(
  value: Readonly<{ sessionId: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"runtime-session"> {
  const input = exactBuilderInputV1(
    value,
    ["sessionId"],
    "INTERNAL_PRODUCTION_RUNTIME_SESSION_CANONICAL_OWNER_INPUT_INVALID",
  );
  const sessionId = canonicalPrefixedIdV1(
    input.sessionId,
    /^RTS_[A-Za-z0-9-]{16,160}$/,
    "INTERNAL_PRODUCTION_RUNTIME_SESSION_ID_INVALID",
  );
  const body = {
    schema: "setfarm.internal-production-runtime-session-owner.v1",
    sessionId,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "runtime-session",
    ownerKey: sessionId,
    ownerRef: `setfarm://runtime-session/${canonicalSegmentV1(
      sessionId,
      "INTERNAL_PRODUCTION_RUNTIME_SESSION_REF_INVALID",
    )}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionCompletionOwnerCanonicalOwnerIdentityV1(
  value: Readonly<{ requestId: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"completion-owner"> {
  const input = exactBuilderInputV1(
    value,
    ["requestId"],
    "INTERNAL_PRODUCTION_COMPLETION_OWNER_CANONICAL_OWNER_INPUT_INVALID",
  );
  const requestId = canonicalPrefixedIdV1(
    input.requestId,
    /^RCR_[A-Za-z0-9-]{16,160}$/,
    "INTERNAL_PRODUCTION_COMPLETION_REQUEST_ID_INVALID",
  );
  const body = {
    schema: "setfarm.internal-production-completion-owner.v1",
    requestId,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "completion-owner",
    ownerKey: requestId,
    ownerRef: `setfarm://runtime-completion/${canonicalSegmentV1(
      requestId,
      "INTERNAL_PRODUCTION_COMPLETION_OWNER_REF_INVALID",
    )}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionMandatoryEffectCanonicalOwnerIdentityV1(
  value: Readonly<{ requestId: string; effectKey: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"mandatory-effect"> {
  const input = exactBuilderInputV1(
    value,
    ["requestId", "effectKey"],
    "INTERNAL_PRODUCTION_MANDATORY_EFFECT_CANONICAL_OWNER_INPUT_INVALID",
  );
  const requestId = canonicalPrefixedIdV1(
    input.requestId,
    /^RCR_[A-Za-z0-9-]{16,160}$/,
    "INTERNAL_PRODUCTION_COMPLETION_REQUEST_ID_INVALID",
  );
  const effectKey = canonicalPrintableKeyV1(
    input.effectKey,
    "INTERNAL_PRODUCTION_EFFECT_KEY_INVALID",
  );
  const ownerKey = canonicalJsonStringify({
    schema: "setfarm.internal-production-completion-request-id-effect-key.v1",
    requestId,
    effectKey,
  });
  const body = {
    schema: "setfarm.internal-production-mandatory-effect-owner.v1",
    requestId,
    effectKey,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "mandatory-effect",
    ownerKey,
    ownerRef: `setfarm://runtime-completion/${canonicalSegmentV1(
      requestId,
      "INTERNAL_PRODUCTION_MANDATORY_EFFECT_REF_INVALID",
    )}/mandatory-effect/${canonicalSegmentV1(
      effectKey,
      "INTERNAL_PRODUCTION_MANDATORY_EFFECT_REF_INVALID",
    )}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionTerminationCanonicalOwnerIdentityV1(
  value: Readonly<{ requestId: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"termination"> {
  const input = exactBuilderInputV1(
    value,
    ["requestId"],
    "INTERNAL_PRODUCTION_TERMINATION_CANONICAL_OWNER_INPUT_INVALID",
  );
  const requestId = canonicalPrefixedIdV1(
    input.requestId,
    /^RTR_[A-Za-z0-9-]{16,160}$/,
    "INTERNAL_PRODUCTION_TERMINATION_REQUEST_ID_INVALID",
  );
  const body = {
    schema: "setfarm.internal-production-termination-owner.v1",
    requestId,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "termination",
    ownerKey: requestId,
    ownerRef: `setfarm://run-termination/${canonicalSegmentV1(
      requestId,
      "INTERNAL_PRODUCTION_TERMINATION_REF_INVALID",
    )}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionFindingCanonicalOwnerIdentityV1(
  value: Readonly<{ findingSetHash: string }>,
): InternalProductionCanonicalOwnerIdentityV1<"finding"> {
  const input = exactBuilderInputV1(
    value,
    ["findingSetHash"],
    "INTERNAL_PRODUCTION_FINDING_CANONICAL_OWNER_INPUT_INVALID",
  );
  const findingSetHash = sha256(
    input.findingSetHash,
    "INTERNAL_PRODUCTION_FINDING_SET_HASH_INVALID",
  );
  const body = {
    schema: "setfarm.internal-production-finding-owner.v1",
    findingSetHash,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "finding",
    ownerKey: findingSetHash,
    ownerRef: `setfarm://finding-set/${findingSetHash}`,
    ownerHash: hashCanonicalJson(body),
  });
}

export function createInternalProductionOperationalDeliveryCanonicalOwnerIdentityV1(
  value: Readonly<{ eventKey: string; consumer: "jsonl" | "webhook" }>,
): InternalProductionCanonicalOwnerIdentityV1<"operational-delivery"> {
  const input = exactBuilderInputV1(
    value,
    ["eventKey", "consumer"],
    "INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_CANONICAL_OWNER_INPUT_INVALID",
  );
  const eventKey = canonicalPrintableKeyV1(
    input.eventKey,
    "INTERNAL_PRODUCTION_EVENT_KEY_INVALID",
  );
  if (input.consumer !== "jsonl" && input.consumer !== "webhook") {
    fail("INTERNAL_PRODUCTION_CONSUMER_INVALID");
  }
  const consumer = input.consumer;
  const ownerKey = canonicalJsonStringify({
    schema: "setfarm.internal-production-operational-event-key-consumer.v1",
    eventKey,
    consumer,
  });
  const body = {
    schema: "setfarm.internal-production-operational-delivery-owner.v1",
    eventKey,
    consumer,
  } as const;
  return validateInternalProductionCanonicalOwnerIdentityV1({
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "operational-delivery",
    ownerKey,
    ownerRef: `setfarm://operational-event/${canonicalSegmentV1(
      eventKey,
      "INTERNAL_PRODUCTION_OPERATIONAL_DELIVERY_REF_INVALID",
    )}/delivery/${consumer}`,
    ownerHash: hashCanonicalJson(body),
  });
}

function bindingProjection<Category extends InternalProductionOwnerCategoryV1>(
  reservation: InternalProductionOwnerReservationV1,
  identity: InternalProductionCanonicalOwnerIdentityV1<Category>,
) {
  return {
    schema: "setfarm.internal-production-bound-owner-reservation.v1" as const,
    category: identity.category,
    producerImplementationId: reservation.producerImplementationId,
    ownerKey: reservation.ownerKey,
    reservationRef: reservation.reservationRef,
    reservationHash: reservation.reservationHash,
    canonicalOwnerIdentity: identity,
    state: "bound" as const,
  };
}

export function createInternalProductionBoundOwnerReservationV1<
  Category extends InternalProductionOwnerCategoryV1,
>(input: Readonly<{
  reservation: InternalProductionOwnerReservationV1;
  canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
}>): InternalProductionBoundOwnerReservationV1<Category> {
  const identity = validateInternalProductionCanonicalOwnerIdentityV1<Category>(
    input.canonicalOwnerIdentity,
  );
  if (identity.category !== input.reservation.category || identity.ownerKey !== input.reservation.ownerKey) {
    fail("INTERNAL_PRODUCTION_OWNER_IDENTITY_MISMATCH");
  }
  canonicalRef(input.reservation.reservationRef, "INTERNAL_PRODUCTION_OWNER_RESERVATION_REF_INVALID");
  sha256(input.reservation.reservationHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_HASH_INVALID");
  const projection = bindingProjection(input.reservation, identity);
  return detachedDeepFreeze({ ...projection, bindingHash: hashCanonicalJson(projection) });
}

export function validateInternalProductionBoundOwnerReservationV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
>(value: unknown): InternalProductionBoundOwnerReservationV1<Category> {
  const bound = record(value, "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_INVALID");
  exactKeys(bound, [
    "schema", "category", "producerImplementationId", "ownerKey", "reservationRef",
    "reservationHash", "canonicalOwnerIdentity", "state", "bindingHash",
  ], "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_KEYS_INVALID");
  if (bound.schema !== "setfarm.internal-production-bound-owner-reservation.v1" || bound.state !== "bound") {
    fail("INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_SHAPE_INVALID");
  }
  const ownerCategory = category(bound.category, "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_CATEGORY_INVALID");
  stringValue(bound.producerImplementationId,
    "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_IMPLEMENTATION_ID_INVALID");
  stringValue(
    bound.ownerKey,
    "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_OWNER_KEY_INVALID",
    INTERNAL_PRODUCTION_OWNER_KEY_MAXIMUM_V1,
  );
  canonicalRef(bound.reservationRef, "INTERNAL_PRODUCTION_OWNER_RESERVATION_REF_INVALID");
  sha256(bound.reservationHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_HASH_INVALID");
  sha256(bound.bindingHash, "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_BINDING_HASH_INVALID");
  const identity = validateInternalProductionCanonicalOwnerIdentityV1(bound.canonicalOwnerIdentity);
  if (identity.category !== ownerCategory || identity.ownerKey !== bound.ownerKey) {
    fail("INTERNAL_PRODUCTION_OWNER_IDENTITY_MISMATCH");
  }
  const { bindingHash: _bindingHash, ...projection } = bound;
  if (bound.bindingHash !== hashCanonicalJson(projection)) {
    fail("INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_BINDING_HASH_INVALID");
  }
  return detachedDeepFreeze(value as InternalProductionBoundOwnerReservationV1<Category>);
}

export function createInternalProductionTerminalOwnerAuthorityV1<
  Category extends InternalProductionOwnerCategoryV1,
>(input: Readonly<{
  canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
  terminalOwnerRef: string;
  terminalOwnerHash: string;
}>): InternalProductionTerminalOwnerAuthorityV1<Category> {
  const identity = validateInternalProductionCanonicalOwnerIdentityV1<Category>(
    input.canonicalOwnerIdentity,
  );
  return detachedDeepFreeze({
    schema: "setfarm.internal-production-terminal-owner-authority.v1" as const,
    category: identity.category,
    ownerKey: identity.ownerKey,
    ownerRef: identity.ownerRef,
    ownerHash: identity.ownerHash,
    terminalOwnerRef: canonicalRef(
      input.terminalOwnerRef,
      "INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_INVALID",
      INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_MAXIMUM_V1,
    ),
    terminalOwnerHash: sha256(input.terminalOwnerHash,
      "INTERNAL_PRODUCTION_TERMINAL_OWNER_HASH_INVALID"),
  });
}

export function validateInternalProductionTerminalOwnerAuthorityV1<
  Category extends InternalProductionOwnerCategoryV1 = InternalProductionOwnerCategoryV1,
>(value: unknown): InternalProductionTerminalOwnerAuthorityV1<Category> {
  const authority = record(value, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_INVALID");
  exactKeys(authority, [
    "schema", "category", "ownerKey", "ownerRef", "ownerHash",
    "terminalOwnerRef", "terminalOwnerHash",
  ], "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_KEYS_INVALID");
  if (authority.schema !== "setfarm.internal-production-terminal-owner-authority.v1") {
    fail("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_SCHEMA_INVALID");
  }
  category(authority.category, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_CATEGORY_INVALID");
  stringValue(
    authority.ownerKey,
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_OWNER_KEY_INVALID",
    INTERNAL_PRODUCTION_OWNER_KEY_MAXIMUM_V1,
  );
  canonicalRef(
    authority.ownerRef,
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_OWNER_REF_INVALID",
    INTERNAL_PRODUCTION_OWNER_REF_MAXIMUM_V1,
  );
  sha256(authority.ownerHash, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_OWNER_HASH_INVALID");
  canonicalRef(
    authority.terminalOwnerRef,
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_INVALID",
    INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_MAXIMUM_V1,
  );
  sha256(authority.terminalOwnerHash, "INTERNAL_PRODUCTION_TERMINAL_OWNER_HASH_INVALID");
  return detachedDeepFreeze(value as InternalProductionTerminalOwnerAuthorityV1<Category>);
}

export function deriveInternalProductionTerminalOwnerAuthorityPairV1(
  authorityInput: InternalProductionTerminalOwnerAuthorityV1,
): InternalProductionTerminalOwnerAuthorityPairV1 {
  const authority = validateInternalProductionTerminalOwnerAuthorityV1(authorityInput);
  const terminalAuthorityHash = hashCanonicalJson(authority);
  return detachedDeepFreeze({
    terminalAuthorityRef: contentRef("terminal-owner-authorities", terminalAuthorityHash),
    terminalAuthorityHash,
  });
}

export function validateInternalProductionTerminalOwnerAuthorityPairV1(
  value: unknown,
  authority: InternalProductionTerminalOwnerAuthorityV1,
): InternalProductionTerminalOwnerAuthorityPairV1 {
  const pair = record(value, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID");
  exactKeys(pair, ["terminalAuthorityRef", "terminalAuthorityHash"],
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_KEYS_INVALID");
  canonicalRef(pair.terminalAuthorityRef,
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_REF_INVALID");
  sha256(pair.terminalAuthorityHash,
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_HASH_INVALID");
  const expected = deriveInternalProductionTerminalOwnerAuthorityPairV1(authority);
  if (!equalCanonical(pair, expected)) {
    fail("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_PAIR_INVALID");
  }
  return detachedDeepFreeze(value as InternalProductionTerminalOwnerAuthorityPairV1);
}

function closeProjection(input: Readonly<{
  closeKind: "ordinary" | "fence-target";
  boundReservation: InternalProductionBoundOwnerReservationV1;
  terminalAuthority: InternalProductionTerminalOwnerAuthorityV1;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: string | null;
  preservedFenceHash: string | null;
}>) {
  const bound = validateInternalProductionBoundOwnerReservationV1(input.boundReservation);
  const terminal = validateInternalProductionTerminalOwnerAuthorityV1(input.terminalAuthority);
  if (
    terminal.category !== bound.category
    || terminal.ownerKey !== bound.ownerKey
    || terminal.ownerRef !== bound.canonicalOwnerIdentity.ownerRef
    || terminal.ownerHash !== bound.canonicalOwnerIdentity.ownerHash
  ) fail("INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_MISMATCH");
  if (input.closeKind !== "ordinary" && input.closeKind !== "fence-target") {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_KIND_INVALID");
  }
  if ((input.preservedFenceRef === null) !== (input.preservedFenceHash === null)) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PRESERVED_FENCE_PAIR_INVALID");
  }
  if (input.closeKind === "ordinary" && input.preservedFenceRef !== null) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_ORDINARY_CLOSE_PRESERVED_FENCE_FORBIDDEN");
  }
  const preservedFenceRef = input.preservedFenceRef === null
    ? null
    : canonicalRef(input.preservedFenceRef,
      "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PRESERVED_FENCE_REF_INVALID");
  const preservedFenceHash = input.preservedFenceHash === null
    ? null
    : sha256(input.preservedFenceHash,
      "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PRESERVED_FENCE_HASH_INVALID");
  return {
    schema: "setfarm.internal-production-owner-reservation-close.v1" as const,
    closeKind: input.closeKind,
    reservationRef: bound.reservationRef,
    reservationHash: bound.reservationHash,
    terminalOwnerRef: terminal.terminalOwnerRef,
    terminalOwnerHash: terminal.terminalOwnerHash,
    ownerAdmissionHeadPredecessorHash: sha256(input.ownerAdmissionHeadPredecessorHash,
      "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_HEAD_PREDECESSOR_HASH_INVALID"),
    ownerAdmissionHeadSuccessorHash: sha256(input.ownerAdmissionHeadSuccessorHash,
      "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_HEAD_SUCCESSOR_HASH_INVALID"),
    preservedFenceRef,
    preservedFenceHash,
  };
}

export function createInternalProductionOwnerReservationCloseV1(input: Readonly<{
  closeKind: "ordinary" | "fence-target";
  boundReservation: InternalProductionBoundOwnerReservationV1;
  terminalAuthority: InternalProductionTerminalOwnerAuthorityV1;
  ownerAdmissionHeadPredecessorHash: string;
  ownerAdmissionHeadSuccessorHash: string;
  preservedFenceRef: string | null;
  preservedFenceHash: string | null;
}>): InternalProductionOwnerReservationCloseV1 {
  const projection = closeProjection(input);
  const closeHash = hashCanonicalJson(projection);
  return detachedDeepFreeze({
    ...projection,
    closeRef: contentRef("owner-reservation-closes", closeHash),
    closeHash,
  });
}

export function validateInternalProductionOwnerReservationCloseV1(
  value: unknown,
): InternalProductionOwnerReservationCloseV1 {
  const close = record(value, "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_INVALID");
  exactKeys(close, [
    "schema", "closeKind", "reservationRef", "reservationHash", "terminalOwnerRef",
    "terminalOwnerHash", "ownerAdmissionHeadPredecessorHash",
    "ownerAdmissionHeadSuccessorHash", "preservedFenceRef", "preservedFenceHash",
    "closeRef", "closeHash",
  ], "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_KEYS_INVALID");
  if (close.schema !== "setfarm.internal-production-owner-reservation-close.v1") {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_SCHEMA_INVALID");
  }
  if (close.closeKind !== "ordinary" && close.closeKind !== "fence-target") {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_KIND_INVALID");
  }
  canonicalRef(close.reservationRef, "INTERNAL_PRODUCTION_OWNER_RESERVATION_REF_INVALID");
  sha256(close.reservationHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_HASH_INVALID");
  canonicalRef(
    close.terminalOwnerRef,
    "INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_INVALID",
    INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_MAXIMUM_V1,
  );
  sha256(close.terminalOwnerHash, "INTERNAL_PRODUCTION_TERMINAL_OWNER_HASH_INVALID");
  sha256(close.ownerAdmissionHeadPredecessorHash,
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_HEAD_PREDECESSOR_HASH_INVALID");
  sha256(close.ownerAdmissionHeadSuccessorHash,
    "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_HEAD_SUCCESSOR_HASH_INVALID");
  if ((close.preservedFenceRef === null) !== (close.preservedFenceHash === null)) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PRESERVED_FENCE_PAIR_INVALID");
  }
  if (close.closeKind === "ordinary" && close.preservedFenceRef !== null) {
    fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_ORDINARY_CLOSE_PRESERVED_FENCE_FORBIDDEN");
  }
  if (close.preservedFenceRef !== null) {
    canonicalRef(close.preservedFenceRef,
      "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PRESERVED_FENCE_REF_INVALID");
    sha256(close.preservedFenceHash,
      "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_PRESERVED_FENCE_HASH_INVALID");
  }
  canonicalRef(close.closeRef, "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_REF_INVALID");
  sha256(close.closeHash, "INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_HASH_INVALID");
  const { closeRef: _closeRef, closeHash: _closeHash, ...projection } = close;
  const expectedHash = hashCanonicalJson(projection);
  if (
    close.closeHash !== expectedHash
    || close.closeRef !== contentRef("owner-reservation-closes", expectedHash)
  ) fail("INTERNAL_PRODUCTION_OWNER_RESERVATION_CLOSE_DERIVATION_INVALID");
  return detachedDeepFreeze(value as InternalProductionOwnerReservationCloseV1);
}

export type PgTransactionSql = postgres.TransactionSql & {
  <T extends readonly (object | undefined)[] = postgres.Row[]>(
    template: TemplateStringsArray,
    ...parameters: readonly any[]
  ): postgres.PendingQuery<T>;
};

export interface InternalProductionOwnerAdmissionRepositoryV1 {
  withTransaction<Result>(operation: (sql: PgTransactionSql) => Promise<Result>): Promise<Result>;
  resolveReservation(sql: PgTransactionSql, input: Readonly<{
    reservationRef: string;
    reservationHash: string;
  }>): Promise<InternalProductionOwnerReservationV1>;
  resolveClose(sql: PgTransactionSql, input: Readonly<{
    closeRef: string;
    closeHash: string;
  }>): Promise<InternalProductionOwnerReservationCloseV1>;
  beginOrAdoptInTransactionV1(sql: PgTransactionSql, input: Readonly<{
    producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
    ownerKey: string;
  }>): Promise<InternalProductionOwnerReservationV1>;
  bindInTransactionV1<Category extends InternalProductionOwnerCategoryV1>(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: string;
      reservationHash: string;
      canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
    }>,
  ): Promise<InternalProductionBoundOwnerReservationV1<Category>>;
  closeInTransactionV1<Category extends InternalProductionOwnerCategoryV1>(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: string;
      reservationHash: string;
      resolvedTerminalAuthority: InternalProductionTerminalOwnerAuthorityV1<Category>;
    }>,
  ): Promise<InternalProductionOwnerReservationCloseV1>;
}

export interface InternalProductionOwnerAdmissionControllerV1 {
  resolveInternalProductionOwnerReservationV1(
    sql: PgTransactionSql,
    input: Readonly<{ reservationRef: string; reservationHash: string }>,
  ): Promise<InternalProductionOwnerReservationV1>;
  resolveInternalProductionOwnerReservationCloseV1(
    sql: PgTransactionSql,
    input: Readonly<{ closeRef: string; closeHash: string }>,
  ): Promise<InternalProductionOwnerReservationCloseV1>;
  beginOrAdoptInternalProductionOwnerReservationV1(
    sql: PgTransactionSql,
    input: Readonly<{
      producerImplementationId: InternalProductionOwnerProducerImplementationIdV1;
      ownerKey: string;
    }>,
  ): Promise<InternalProductionOwnerReservationV1>;
  bindInternalProductionOwnerReservationV1<Category extends InternalProductionOwnerCategoryV1>(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: string;
      reservationHash: string;
      canonicalOwnerIdentity: InternalProductionCanonicalOwnerIdentityV1<Category>;
    }>,
  ): Promise<InternalProductionBoundOwnerReservationV1<Category>>;
  closeInternalProductionOwnerReservationV1(
    sql: PgTransactionSql,
    input: Readonly<{
      reservationRef: string;
      reservationHash: string;
      terminalAuthorityRef: string;
      terminalAuthorityHash: string;
    }>,
  ): Promise<InternalProductionOwnerReservationCloseV1>;
}
