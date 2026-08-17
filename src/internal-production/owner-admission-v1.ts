import type postgres from "postgres";

import { hashCanonicalJson } from "../product-compiler/canonical-json.js";

const SHA256 = /^[a-f0-9]{64}$/;
const CANONICAL_REF = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
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

function canonicalRef(value: unknown, code: string): string {
  if (typeof value !== "string" || value.length > 4_000 || !CANONICAL_REF.test(value)) fail(code);
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
  { plan: "A", module: "src/internal-production/baseline-post-handoff-receipt-v1.ts", function: "reserveRecoverySourceRunOwnerV1", implementationId: "a-recovery-source-run-v1", category: "source-run", ownerKeyDerivationId: "source-bootstrap-operation-run-v1", censusKeys: ["sourceRunOwnerCount"] },
  { plan: "A", module: "src/internal-production/baseline-post-handoff-receipt-v1.ts", function: "reserveRecoverySourceBootstrapRunOwnerV1", implementationId: "a-recovery-source-bootstrap-run-v1", category: "run", ownerKeyDerivationId: "source-bootstrap-reciprocal-run-v1", censusKeys: ["activeRunCount"] },
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

function reservationProjection(input: Readonly<{
  producer: InternalProductionOwnerProducerRowV1;
  ownerKey: string;
  ownerAdmissionHeadPredecessorHash: string;
}>) {
  const producer = validateProducerRow(input.producer);
  const ownerKey = stringValue(input.ownerKey, "INTERNAL_PRODUCTION_OWNER_KEY_INVALID");
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
  stringValue(reservation.ownerKey, "INTERNAL_PRODUCTION_OWNER_KEY_INVALID");
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
  stringValue(identity.ownerKey, "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_OWNER_KEY_INVALID");
  canonicalRef(identity.ownerRef, "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_OWNER_REF_INVALID");
  sha256(identity.ownerHash, "INTERNAL_PRODUCTION_CANONICAL_OWNER_IDENTITY_OWNER_HASH_INVALID");
  return detachedDeepFreeze(value as InternalProductionCanonicalOwnerIdentityV1<Category>);
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
  stringValue(bound.ownerKey, "INTERNAL_PRODUCTION_BOUND_OWNER_RESERVATION_OWNER_KEY_INVALID");
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
    terminalOwnerRef: canonicalRef(input.terminalOwnerRef,
      "INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_INVALID"),
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
  stringValue(authority.ownerKey, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_OWNER_KEY_INVALID");
  canonicalRef(authority.ownerRef, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_OWNER_REF_INVALID");
  sha256(authority.ownerHash, "INTERNAL_PRODUCTION_TERMINAL_OWNER_AUTHORITY_OWNER_HASH_INVALID");
  canonicalRef(authority.terminalOwnerRef, "INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_INVALID");
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
  canonicalRef(close.terminalOwnerRef, "INTERNAL_PRODUCTION_TERMINAL_OWNER_REF_INVALID");
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
