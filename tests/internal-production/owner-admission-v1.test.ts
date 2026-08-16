import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { hashCanonicalJson } from "../../src/product-compiler/canonical-json.js";
import {
  INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1,
  INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
  assembleInternalProductionOwnerProducerRegistryV1,
  createInternalProductionBoundOwnerReservationV1,
  createInternalProductionOwnerReservationCloseV1,
  createInternalProductionOwnerReservationV1,
  createInternalProductionTerminalOwnerAuthorityV1,
  deriveInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionBoundOwnerReservationV1,
  validateInternalProductionOwnerProducerManifestV1,
  validateInternalProductionOwnerReservationCloseV1,
  validateInternalProductionOwnerReservationV1,
  validateInternalProductionTerminalOwnerAuthorityPairV1,
  validateInternalProductionTerminalOwnerAuthorityV1,
  type InternalProductionCanonicalOwnerIdentityV1,
  type InternalProductionOwnerProducerManifestV1,
  type InternalProductionOwnerProducerRowV1,
} from "../../src/internal-production/owner-admission-v1.js";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);

function assertDeepFrozen(value: unknown, label: string): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor) {
      assertDeepFrozen(descriptor.value, `${label}.${String(key)}`);
    }
  }
}

const EXPECTED_CATEGORIES = [
  "run", "claim", "execution-attempt", "runtime-session", "completion-owner",
  "mandatory-effect", "ordinary-service-start", "restart-reservation",
  "service-restart-operation", "launch-preparation", "prepared-launch", "staged-case",
  "fixture-attempt", "artifact-reservation", "artifact-publication", "docs-session",
  "docs-lease", "fleet-stage", "fleet-inflight", "fleet-review", "matrix-inflight",
  "launch-outbox", "termination", "finding", "recovery", "operational-delivery",
  "source-run", "cold-rehearsal", "compilation-lease", "execution-lease", "process",
  "listener", "worktree", "dirty-worktree", "stale-child",
] as const;

const EXPECTED_CENSUS_KEYS = [
  "activeRunCount", "openClaimCount", "executionAttemptCount",
  "activeRuntimeSessionCount", "activeCompletionOwnerCount",
  "unsettledMandatoryEffectCount", "ordinaryStartingCount", "restartReservationCount",
  "serviceRestartOperationCount", "launchPreparationCount", "preparedLaunchCount",
  "stagedCaseCount", "fixtureAttemptCount", "artifactReservationCount",
  "publicationBatchCount", "artifactPublicationCount", "docsSessionCount",
  "docsLeaseCount", "fleetStageCount", "fleetInflightCount", "fleetPendingReviewCount",
  "matrixInflightCount", "launchOutboxCount", "terminationOwnerCount",
  "findingOwnerCount", "recoveryOwnerCount", "operationalDeliveryCount",
  "sourceRunOwnerCount", "coldRehearsalOwnerCount", "compilationLeaseCount",
  "executionLeaseCount", "ownedProcessCount", "ownedListenerCount",
  "ownedWorktreeCount", "dirtyWorktreeCount", "staleChildCount",
] as const;

const EXPECTED_A_TUPLES = [
  ["src/execution/run-persistence.ts", "persistWorkflowRunInTransaction", "a-runtime-run-v1", "run", "run-id-generation-v1", "activeRunCount"],
  ["src/execution/claim-runtime-publication.ts", "publishSingleClaimRuntime", "a-claim-single-runtime-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/execution/claim-runtime-publication.ts", "publishLoopClaimRuntime", "a-claim-loop-runtime-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "createV3DownstreamEvidencePublication.reserve", "a-claim-v3-downstream-evidence-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/recovery/v3-evidence-only-publication.ts", "createV3EvidenceOnlyPublication.reserve", "a-claim-v3-evidence-only-v1", "claim", "claim-log-id-v1", "openClaimCount"],
  ["src/execution/attempt-repository.ts", "reserveAttemptInTransaction", "a-execution-attempt-v1", "execution-attempt", "execution-attempt-id-generation-v1", "executionAttemptCount"],
  ["src/execution/runtime-session-repository.ts", "reserveRuntimeSessionInTransaction", "a-runtime-session-v1", "runtime-session", "runtime-session-id-v1", "activeRuntimeSessionCount"],
  ["src/execution/runtime-completion.ts", "createRuntimeCompletionRepository.claim", "a-completion-owner-v1", "completion-owner", "completion-request-id-v1", "activeCompletionOwnerCount"],
  ["src/execution/runtime-completion.ts", "markRuntimeCompletionOwnerCommittedInTransaction", "a-mandatory-effect-v1", "mandatory-effect", "completion-request-id-effect-key-v1", "unsettledMandatoryEffectCount"],
  ["src/execution/run-termination.ts", "requestRunTerminationInTransaction", "a-termination-v1", "termination", "termination-request-id-v1", "terminationOwnerCount"],
  ["src/recovery/finding-recovery-repository.ts", "createFindingRecoveryRepository.putFindingSet", "a-finding-recovery-repository-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/recovery/v3-downstream-evidence-publication.ts", "putFindingSet", "a-finding-v3-downstream-evidence-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/recovery/v3-evidence-only-publication.ts", "putFindingSetInTransaction", "a-finding-v3-evidence-only-v1", "finding", "finding-set-hash-v1", "findingOwnerCount"],
  ["src/execution/operational-outbox-repository.ts", "createOperationalOutboxRepository.publish", "a-operational-delivery-v1", "operational-delivery", "operational-event-key-consumer-v1", "operationalDeliveryCount"],
  ["src/internal-production/baseline-post-handoff-receipt-v1.ts", "reserveRecoverySourceRunOwnerV1", "a-recovery-source-run-v1", "source-run", "source-bootstrap-operation-run-v1", "sourceRunOwnerCount"],
  ["src/internal-production/baseline-post-handoff-receipt-v1.ts", "reserveRecoverySourceBootstrapRunOwnerV1", "a-recovery-source-bootstrap-run-v1", "run", "source-bootstrap-reciprocal-run-v1", "activeRunCount"],
] as const;

test("freezes the exact 35-category registry and complete 36-counter census mapping", () => {
  assert.deepEqual(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1, EXPECTED_CATEGORIES);
  assert.equal(new Set(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1).size, 35);
  assert.deepEqual(Object.keys(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1), EXPECTED_CATEGORIES);
  assert.deepEqual(
    [...new Set(Object.values(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1).flat())].sort(),
    [...EXPECTED_CENSUS_KEYS].sort(),
  );
  assert.equal(Object.values(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1).flat().length, 36);
  assert.deepEqual(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1["artifact-publication"], [
    "publicationBatchCount", "artifactPublicationCount",
  ]);
});

test("freezes and hashes the exact sixteen A producer rows", () => {
  assert.equal(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.length, 16);
  assert.deepEqual(
    INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1.map((row) => [
      row.module, row.function, row.implementationId, row.category,
      row.ownerKeyDerivationId, row.censusKeys.join(","),
    ]),
    EXPECTED_A_TUPLES,
  );
  assert.deepEqual(
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1.manifestHash,
    hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-manifest.v1",
      plan: "A",
      rows: INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1,
    }),
  );
  assert.deepEqual(
    validateInternalProductionOwnerProducerManifestV1(
      INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    ),
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  );
});

test("manifest validation is strict and rejects hash, census, duplicate, and A-row drift", () => {
  const manifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1);
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1({ ...manifest, extra: true }),
    /MANIFEST_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1({ ...manifest, manifestHash: SHA_A }),
    /MANIFEST_HASH_INVALID/,
  );
  const wrongCensus = structuredClone(manifest);
  wrongCensus.rows[0]!.censusKeys = ["openClaimCount"];
  wrongCensus.manifestHash = hashCanonicalJson({ schema: wrongCensus.schema, plan: wrongCensus.plan, rows: wrongCensus.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(wrongCensus), /ROW_CENSUS_KEYS_INVALID/);
  const duplicate = structuredClone(manifest);
  duplicate.rows[1]!.implementationId = duplicate.rows[0]!.implementationId;
  duplicate.manifestHash = hashCanonicalJson({ schema: duplicate.schema, plan: duplicate.plan, rows: duplicate.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(duplicate), /IMPLEMENTATION_ID_DUPLICATE/);
  const reorderedA = structuredClone(manifest);
  reorderedA.rows.reverse();
  reorderedA.manifestHash = hashCanonicalJson({ schema: reorderedA.schema, plan: reorderedA.plan, rows: reorderedA.rows });
  assert.throws(() => validateInternalProductionOwnerProducerManifestV1(reorderedA), /PLAN_A_ROWS_INVALID/);
});

function syntheticManifest(
  plan: "B" | "C" | "D" | "E",
  count: number,
): InternalProductionOwnerProducerManifestV1 {
  const rows: InternalProductionOwnerProducerRowV1[] = Array.from({ length: count }, (_, index) => {
    const category = EXPECTED_CATEGORIES[(index + plan.charCodeAt(0)) % EXPECTED_CATEGORIES.length]!;
    return {
      plan,
      module: `src/${plan.toLowerCase()}/producer-${index}.ts`,
      function: `produce${plan}${index}`,
      implementationId: `${plan.toLowerCase()}-producer-${index}-v1`,
      category,
      ownerKeyDerivationId: `${plan.toLowerCase()}-owner-key-${index}-v1`,
      censusKeys: INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1[category],
    };
  });
  return {
    schema: "setfarm.internal-production-owner-producer-manifest.v1",
    plan,
    rows,
    manifestHash: hashCanonicalJson({
      schema: "setfarm.internal-production-owner-producer-manifest.v1", plan, rows,
    }),
  };
}

test("assembles only the ordered 16/10/6/16/9 five-plan registry", () => {
  const manifests = [
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    syntheticManifest("B", 10), syntheticManifest("C", 6),
    syntheticManifest("D", 16), syntheticManifest("E", 9),
  ] as const;
  const assembled = assembleInternalProductionOwnerProducerRegistryV1({ manifests });
  assert.equal(assembled.rows.length, 57);
  assert.equal(assembled.registryHash, hashCanonicalJson({
    schema: "setfarm.internal-production-owner-producer-registry.v1",
    rows: assembled.rows,
  }));
  const wrong = [...manifests] as unknown as [
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
    InternalProductionOwnerProducerManifestV1,
  ];
  wrong[2] = syntheticManifest("C", 5);
  assert.throws(() => assembleInternalProductionOwnerProducerRegistryV1({ manifests: wrong }), /MANIFEST_ROW_COUNT_INVALID/);
});

function reservationFixture() {
  const row = INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1[0];
  const reservation = createInternalProductionOwnerReservationV1({
    producer: row,
    ownerKey: "run-owner-admission-test-1",
    ownerAdmissionHeadPredecessorHash: SHA_A,
  });
  const identity: InternalProductionCanonicalOwnerIdentityV1<"run"> = {
    schema: "setfarm.internal-production-canonical-owner-identity.v1",
    category: "run",
    ownerKey: reservation.ownerKey,
    ownerRef: "setfarm://runs/run-owner-admission-test-1",
    ownerHash: SHA_B,
  };
  const bound = createInternalProductionBoundOwnerReservationV1({
    reservation,
    canonicalOwnerIdentity: identity,
  });
  const terminal = createInternalProductionTerminalOwnerAuthorityV1({
    canonicalOwnerIdentity: identity,
    terminalOwnerRef: "setfarm://runs/run-owner-admission-test-1/terminal/completed",
    terminalOwnerHash: SHA_C,
  });
  return { row, reservation, identity, bound, terminal };
}

test("constructs canonical reservation, binding, terminal authority, and pair", () => {
  const { row, reservation, bound, terminal } = reservationFixture();
  assert.deepEqual(validateInternalProductionOwnerReservationV1(reservation, row), reservation);
  assert.deepEqual(validateInternalProductionBoundOwnerReservationV1(bound), bound);
  assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityV1(terminal), terminal);
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  assert.deepEqual(validateInternalProductionTerminalOwnerAuthorityPairV1(pair, terminal), pair);
  assert.match(reservation.reservationRef, /^setfarm:\/\/internal-production\/owner-reservations\/[a-f0-9]{64}$/);
  assert.match(bound.bindingHash, /^[a-f0-9]{64}$/);
});

test("strict body validators reject extras, crossed identities, and structural hash clones", () => {
  const { row, reservation, identity, bound, terminal } = reservationFixture();
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({ ...reservation, extra: true }, row),
    /RESERVATION_KEYS_INVALID/,
  );
  assert.throws(
    () => validateInternalProductionOwnerReservationV1({ ...reservation, ownerKeyHash: SHA_C }, row),
    /RESERVATION_DERIVATION_INVALID/,
  );
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: { ...identity, ownerKey: "crossed" },
    }),
    /OWNER_IDENTITY_MISMATCH/,
  );
  assert.throws(
    () => validateInternalProductionBoundOwnerReservationV1({ ...bound, bindingHash: SHA_C }),
    /BINDING_HASH_INVALID/,
  );
  const pair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityPairV1(
      { ...pair, terminalAuthorityHash: SHA_A }, terminal,
    ),
    /TERMINAL_OWNER_AUTHORITY_PAIR_INVALID/,
  );
});

test("constructs ordinary and fence-target closes with exact pair and hash rules", () => {
  const { bound, terminal } = reservationFixture();
  const ordinary = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  assert.deepEqual(validateInternalProductionOwnerReservationCloseV1(ordinary), ordinary);
  assert.throws(
    () => validateInternalProductionOwnerReservationCloseV1({ ...ordinary, extra: true }),
    /CLOSE_KEYS_INVALID/,
  );
  assert.throws(
    () => createInternalProductionOwnerReservationCloseV1({
      closeKind: "ordinary",
      boundReservation: bound,
      terminalAuthority: terminal,
      ownerAdmissionHeadPredecessorHash: SHA_A,
      ownerAdmissionHeadSuccessorHash: SHA_B,
      preservedFenceRef: "setfarm://internal-production/fences/test",
      preservedFenceHash: SHA_C,
    }),
    /ORDINARY_CLOSE_PRESERVED_FENCE_FORBIDDEN/,
  );
  const fenced = createInternalProductionOwnerReservationCloseV1({
    closeKind: "fence-target",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: "setfarm://internal-production/fences/test",
    preservedFenceHash: SHA_C,
  });
  assert.deepEqual(validateInternalProductionOwnerReservationCloseV1(fenced), fenced);
});

test("exports and every successful construction or validation are detached and deeply immutable", () => {
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_CATEGORY_REGISTRY_V1, "category registry");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_CATEGORY_CENSUS_MAP_V1, "census map");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_PRODUCER_ROWS_A_V1, "A rows");
  assertDeepFrozen(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1, "A manifest");

  const callerManifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1);
  const validatedManifest = validateInternalProductionOwnerProducerManifestV1(callerManifest);
  assertDeepFrozen(validatedManifest, "validated manifest");
  callerManifest.rows[0]!.module = "src/caller-mutated.ts";
  assert.equal(validatedManifest.rows[0]!.module, "src/execution/run-persistence.ts");

  const manifests = [
    INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
    syntheticManifest("B", 10), syntheticManifest("C", 6),
    syntheticManifest("D", 16), syntheticManifest("E", 9),
  ] as const;
  const assembled = assembleInternalProductionOwnerProducerRegistryV1({ manifests });
  assertDeepFrozen(assembled, "assembled registry");
  const originalB = manifests[1].rows[0] as { module: string };
  originalB.module = "src/caller-mutated-b.ts";
  assert.notEqual(assembled.rows[16]!.module, originalB.module);

  const { row, reservation, identity, bound, terminal } = reservationFixture();
  const callerReservation = structuredClone(reservation);
  const validatedReservation = validateInternalProductionOwnerReservationV1(callerReservation, row);
  const callerBound = structuredClone(bound);
  const validatedBound = validateInternalProductionBoundOwnerReservationV1(callerBound);
  const callerTerminal = structuredClone(terminal);
  const validatedTerminal = validateInternalProductionTerminalOwnerAuthorityV1(callerTerminal);
  const terminalPair = deriveInternalProductionTerminalOwnerAuthorityPairV1(terminal);
  const callerPair = structuredClone(terminalPair);
  const validatedPair = validateInternalProductionTerminalOwnerAuthorityPairV1(callerPair, terminal);
  const close = createInternalProductionOwnerReservationCloseV1({
    closeKind: "ordinary",
    boundReservation: bound,
    terminalAuthority: terminal,
    ownerAdmissionHeadPredecessorHash: SHA_A,
    ownerAdmissionHeadSuccessorHash: SHA_B,
    preservedFenceRef: null,
    preservedFenceHash: null,
  });
  const callerClose = structuredClone(close);
  const validatedClose = validateInternalProductionOwnerReservationCloseV1(callerClose);
  for (const [label, value] of [
    ["reservation", reservation], ["validated reservation", validatedReservation],
    ["binding", bound], ["validated binding", validatedBound],
    ["terminal", terminal], ["validated terminal", validatedTerminal],
    ["terminal pair", terminalPair], ["validated terminal pair", validatedPair],
    ["close", close], ["validated close", validatedClose],
  ] as const) assertDeepFrozen(value, label);
  assertDeepFrozen(validatedBound.canonicalOwnerIdentity, "validated nested owner identity");

  callerReservation.ownerKey = "caller-mutated";
  callerBound.canonicalOwnerIdentity.ownerKey = "caller-mutated";
  callerTerminal.ownerKey = "caller-mutated";
  callerPair.terminalAuthorityRef = "setfarm://caller-mutated";
  callerClose.terminalOwnerRef = "setfarm://caller-mutated";
  assert.equal(validatedReservation.ownerKey, reservation.ownerKey);
  assert.equal(validatedBound.canonicalOwnerIdentity.ownerKey, identity.ownerKey);
  assert.equal(validatedTerminal.ownerKey, identity.ownerKey);
  assert.notEqual(validatedPair.terminalAuthorityRef, callerPair.terminalAuthorityRef);
  assert.notEqual(validatedClose.terminalOwnerRef, callerClose.terminalOwnerRef);

  assert.throws(() => {
    (validatedBound.canonicalOwnerIdentity as { ownerKey: string }).ownerKey = "forbidden";
  }, TypeError);
});

test("strict shapes reject symbols, non-enumerable fields, custom prototypes, and null prototypes", () => {
  const symbolManifest = structuredClone(INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1) as
    Record<PropertyKey, unknown>;
  symbolManifest[Symbol("hidden")] = true;
  assert.throws(
    () => validateInternalProductionOwnerProducerManifestV1(symbolManifest),
    /MANIFEST_KEYS_INVALID/,
  );

  const { row, reservation, identity } = reservationFixture();
  const nonEnumerableReservation = structuredClone(reservation);
  Object.defineProperty(nonEnumerableReservation, "hidden", { value: true, enumerable: false });
  assert.throws(
    () => validateInternalProductionOwnerReservationV1(nonEnumerableReservation, row),
    /RESERVATION_KEYS_INVALID/,
  );

  class CustomTerminalAuthority {}
  const customPrototypeTerminal = Object.assign(
    new CustomTerminalAuthority(),
    createInternalProductionTerminalOwnerAuthorityV1({
      canonicalOwnerIdentity: identity,
      terminalOwnerRef: "setfarm://runs/run-owner-admission-test-1/terminal/completed",
      terminalOwnerHash: SHA_C,
    }),
  );
  assert.throws(
    () => validateInternalProductionTerminalOwnerAuthorityV1(customPrototypeTerminal),
    /TERMINAL_OWNER_AUTHORITY_INVALID/,
  );

  const nullPrototypeIdentity = Object.assign(Object.create(null), identity);
  assert.throws(
    () => createInternalProductionBoundOwnerReservationV1({
      reservation,
      canonicalOwnerIdentity: nullPrototypeIdentity,
    }),
    /CANONICAL_OWNER_IDENTITY_INVALID/,
  );
});

test("the core is import-inert and contains only the approved dependency edges", async () => {
  const source = await readFile(new URL("../../src/internal-production/owner-admission-v1.ts", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import[^;]+from\s+["']([^"']+)["'];/gm)].map((match) => match[1]);
  assert.deepEqual(imports, ["postgres", "../product-compiler/canonical-json.js"]);
  assert.doesNotMatch(source, /from\s+["'][^"']*(?:db-pg|receipt|restart|spawner|execution)[^"']*["']/);
  assert.doesNotMatch(source, /createInternalProductionOwnerAdmission(?:Repository|Controller)/);
  assert.doesNotMatch(source, /postgres\s*\(/);
});
