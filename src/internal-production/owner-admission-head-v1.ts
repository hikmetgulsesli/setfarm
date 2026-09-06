import type { PgTransactionSql } from "./owner-admission-v1.js";
import {
  createInternalProductionGlobalOwnerAdmissionFenceTransitionV1,
  createInternalProductionGlobalOwnerAdmissionFenceReleaseTransitionV1,
  createInternalProductionSourceRunLaunchTargetReservationPairCloseV1,
  INTERNAL_PRODUCTION_OWNER_PRODUCER_MANIFEST_A_V1,
  validateInternalProductionGlobalOwnerAdmissionFenceV1,
  validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1,
  validateInternalProductionOwnerReservationCloseV1,
  validateInternalProductionOwnerReservationV1,
  type InternalProductionGlobalOwnerAdmissionFenceV1,
  type InternalProductionOwnerReservationCloseV1,
  type InternalProductionOwnerReservationV1,
} from "./owner-admission-v1.js";
import { hashCanonicalJson, canonicalJsonStringify } from "../product-compiler/canonical-json.js";

type OwnerAdmissionAuthorityRowV1 = Readonly<{
  authority_ref: string; authority_hash: string; authority_kind: string; phase_key: string;
  predecessor_head_hash: string; successor_head_hash: string; authority_body: unknown;
}>;
type OwnerAdmissionMigrationApplicationV1 = Readonly<{
  schema: "setfarm.bootstrap-main-claim-handoff-guarded-migration-32-application.v1"; evidenceHash: string;
  authorizationRef: string; authorizationHash: string; authorizationConsumptionRef: string;
  authorizationConsumptionHash: string; applicationHash: string;
}>;
type OwnerAdmissionAdvancingAuthorityV1 = Readonly<{ version: number; authority: OwnerAdmissionAuthorityRowV1 }>;
type OwnerAdmissionActiveFenceProjectionV1 = Readonly<{
  activeFenceRef: string | null;
  activeFenceHash: string | null;
  activeTargetFamilyHash: string | null;
}>;
const OWNER_ADMISSION_SHA256_V1 = /^[a-f0-9]{64}$/;
const OWNER_ADMISSION_REF_V1 = /^setfarm:\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/;
function exactObjectKeys(value: unknown, keys: readonly string[], code: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError(code);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string") || JSON.stringify((ownKeys as string[]).sort()) !== JSON.stringify([...keys].sort())) throw new TypeError(code);
  for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new TypeError(code); }
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

export function validateOwnerAdmissionMigrationApplicationV1(
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

export function ownerAdmissionSuccessorV1(input: Readonly<{
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

export async function validateOwnerAdmissionAncestryToGenesisV1(
  sql: PgTransactionSql,
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

function deriveOwnerAdmissionActiveFenceProjectionV1(
  ancestry: readonly OwnerAdmissionAdvancingAuthorityV1[],
): OwnerAdmissionActiveFenceProjectionV1 {
  let activeFence: InternalProductionGlobalOwnerAdmissionFenceV1 | null = null;
  let remainingTargetReservations: ReadonlyArray<Readonly<{
    reservationRef: string;
    reservationHash: string;
  }>> = [];
  let targetCloses: InternalProductionOwnerReservationCloseV1[] = [];
  const groups = new Map<number, OwnerAdmissionAuthorityRowV1[]>();
  for (const { version, authority } of [...ancestry].reverse()) {
    const group = groups.get(version) ?? [];
    group.push(authority);
    groups.set(version, group);
  }
  for (const [, authorities] of groups) {
    const fenceAuthorities = authorities.filter(({ authority_kind }) => authority_kind === "fence");
    if (fenceAuthorities.length === 1) {
      if (activeFence !== null) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
      }
      activeFence = validateInternalProductionGlobalOwnerAdmissionFenceV1(
        fenceAuthorities[0]!.authority_body,
      );
      remainingTargetReservations = activeFence.targetFamily.kind === "none"
        ? []
        : activeFence.targetFamily.kind === "source-run-launch"
          ? [activeFence.targetFamily.sourceRunReservation, activeFence.targetFamily.runReservation]
          : [
              activeFence.targetFamily.restartReservation,
              activeFence.targetFamily.serviceRestartOperationReservation,
              activeFence.targetFamily.launchOutboxReservation,
              activeFence.targetFamily.helperProcessReservation,
              activeFence.targetFamily.dispatchChildProcessReservation,
              activeFence.targetFamily.startupListenerReservation,
              activeFence.targetFamily.replacementProcessReservation,
            ];
      targetCloses = [];
      if (activeFence.targetFamily.kind === "source-run-launch") {
        const companionAuthorities = authorities.filter(({ authority_kind }) => authority_kind === "reservation");
        if (companionAuthorities.length !== 2 || remainingTargetReservations.some((expected) => {
          const companion = companionAuthorities.find(({ authority_ref, authority_hash }) => (
            authority_ref === expected.reservationRef && authority_hash === expected.reservationHash
          ));
          if (!companion || companion.phase_key !== expected.reservationRef) return true;
          const body = companion.authority_body as Partial<InternalProductionOwnerReservationV1>;
          const producer = typeof body.producerImplementationId === "string"
            ? ownerProducerRowForImplementationV1(body.producerImplementationId)
            : undefined;
          if (!producer) return true;
          try {
            const reservation = validateInternalProductionOwnerReservationV1(body, producer);
            return reservation.reservationRef !== expected.reservationRef
              || reservation.reservationHash !== expected.reservationHash;
          } catch {
            return true;
          }
        })) {
          throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
        }
      }
      continue;
    }
    if (fenceAuthorities.length !== 0 || authorities.length !== 1) {
      throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
    }
    const authority = authorities[0]!;
    if (authority.authority_kind === "reservation") {
      if (activeFence !== null) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
      }
      continue;
    }
    if (authority.authority_kind === "close") {
      const close = validateInternalProductionOwnerReservationCloseV1(authority.authority_body);
      if (close.closeKind === "ordinary") {
        if (activeFence !== null) {
          throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
        }
        continue;
      }
      if (
        activeFence === null
        || close.preservedFenceRef !== activeFence.fenceRef
        || close.preservedFenceHash !== activeFence.fenceHash
      ) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
      }
      const expectedTarget = remainingTargetReservations[0];
      if (
        !expectedTarget
        || expectedTarget.reservationRef !== close.reservationRef
        || expectedTarget.reservationHash !== close.reservationHash
      ) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
      }
      remainingTargetReservations = remainingTargetReservations.slice(1);
      targetCloses.push(close);
      continue;
    }
    if (authority.authority_kind === "release") {
      const release = validateInternalProductionGlobalOwnerAdmissionFenceReleaseV1(authority.authority_body);
      if (
        activeFence === null
        || release.fenceRef !== activeFence.fenceRef
        || release.fenceHash !== activeFence.fenceHash
        || release.releaseAuthority.purpose !== activeFence.purpose
        || release.releaseAuthority.targetFamilyKind !== activeFence.targetFamily.kind
        || remainingTargetReservations.length !== 0
      ) {
        throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
      }
      if (activeFence.targetFamily.kind === "source-run-launch") {
        const [sourceClose, runClose] = targetCloses;
        if (!sourceClose || !runClose || targetCloses.length !== 2) {
          throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
        }
        const pairClose = createInternalProductionSourceRunLaunchTargetReservationPairCloseV1({
          fenceRef: activeFence.fenceRef,
          fenceHash: activeFence.fenceHash,
          targetRunLaunchCompositeHash: activeFence.targetFamily.targetRunLaunchCompositeHash,
          sourceRunReservationRef: activeFence.targetFamily.sourceRunReservation.reservationRef,
          sourceRunReservationHash: activeFence.targetFamily.sourceRunReservation.reservationHash,
          runReservationRef: activeFence.targetFamily.runReservation.reservationRef,
          runReservationHash: activeFence.targetFamily.runReservation.reservationHash,
          terminalSourceRunRef: sourceClose.terminalOwnerRef,
          terminalSourceRunHash: sourceClose.terminalOwnerHash,
          terminalRunLaunchRef: runClose.terminalOwnerRef,
          terminalRunLaunchHash: runClose.terminalOwnerHash,
          ownerAdmissionHeadPredecessorHash: sourceClose.ownerAdmissionHeadPredecessorHash,
          ownerAdmissionHeadSuccessorHash: runClose.ownerAdmissionHeadSuccessorHash,
          preservedFenceRef: activeFence.fenceRef,
          preservedFenceHash: activeFence.fenceHash,
        });
        if (
          sourceClose.ownerAdmissionHeadSuccessorHash !== runClose.ownerAdmissionHeadPredecessorHash
          || release.releaseAuthority.targetReservationPairCloseRef !== pairClose.targetReservationPairCloseRef
          || release.releaseAuthority.targetReservationPairCloseHash !== pairClose.targetReservationPairCloseHash
        ) {
          throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
        }
      }
      activeFence = null;
      remainingTargetReservations = [];
      targetCloses = [];
      continue;
    }
    throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  }
  return activeFence === null
    ? Object.freeze({ activeFenceRef: null, activeFenceHash: null, activeTargetFamilyHash: null })
    : Object.freeze({
        activeFenceRef: activeFence.fenceRef,
        activeFenceHash: activeFence.fenceHash,
        activeTargetFamilyHash: activeFence.targetFamily.kind === "none"
          ? null
          : activeFence.targetFamily.targetFamilyHash,
      });
}


export async function validateCurrentInternalProductionOwnerAdmissionHeadV1(sql: PgTransactionSql, row: Readonly<{ head_version: string|number; head_hash: string; active_fence_ref: string|null; active_fence_hash: string|null; active_target_family_hash: string|null; migration_application_evidence_hash: string; head_payload: unknown }>): Promise<Readonly<{version:number; hash:string; migrationApplication:OwnerAdmissionMigrationApplicationV1; activeFenceRef:string|null; activeFenceHash:string|null; activeTargetFamilyHash:string|null}>> {
  const version = Number(row.head_version);
  if (!Number.isSafeInteger(version) || version < 0 || !OWNER_ADMISSION_SHA256_V1.test(row.head_hash) || !OWNER_ADMISSION_SHA256_V1.test(row.migration_application_evidence_hash) || (row.active_fence_ref === null) !== (row.active_fence_hash === null) || (row.active_target_family_hash !== null && row.active_fence_ref === null)) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  const expectedPayloadKeys = version === 0 ? ["schema", "version", "migrationApplication"] : ["schema", "version", "predecessorHeadHash", "transitionKind", "transitionRef", "transitionHash", "migrationApplication"];
  try { exactObjectKeys(row.head_payload, expectedPayloadKeys, "INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION"); } catch { throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION"); }
  const payload = row.head_payload as Record<string, unknown>;
  let migrationApplication: OwnerAdmissionMigrationApplicationV1;
  try { migrationApplication = validateOwnerAdmissionMigrationApplicationV1(payload.migrationApplication, row.migration_application_evidence_hash); } catch { throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION"); }
  if (payload.schema !== "setfarm.internal-production-owner-admission-head.v1" || payload.version !== version) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  if (version === 0) { if (row.head_hash !== "0".repeat(64)) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION"); }
  else if (typeof payload.predecessorHeadHash !== "string" || !OWNER_ADMISSION_SHA256_V1.test(payload.predecessorHeadHash) || !["reservation", "close", "fence", "release"].includes(String(payload.transitionKind)) || typeof payload.transitionRef !== "string" || !OWNER_ADMISSION_REF_V1.test(payload.transitionRef) || typeof payload.transitionHash !== "string" || !OWNER_ADMISSION_SHA256_V1.test(payload.transitionHash) || hashCanonicalJson(payload) !== row.head_hash) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  const ancestry = version > 0
    ? await validateOwnerAdmissionAncestryToGenesisV1(sql, row.head_hash, version, migrationApplication)
    : Object.freeze([]);
  const activeFence = deriveOwnerAdmissionActiveFenceProjectionV1(ancestry);
  if (
    row.active_fence_ref !== activeFence.activeFenceRef
    || row.active_fence_hash !== activeFence.activeFenceHash
    || row.active_target_family_hash !== activeFence.activeTargetFamilyHash
  ) throw new Error("INTERNAL_PRODUCTION_OWNER_ADMISSION_HEAD_CORRUPTION");
  return Object.freeze({version, hash:row.head_hash, migrationApplication, activeFenceRef:row.active_fence_ref, activeFenceHash:row.active_fence_hash, activeTargetFamilyHash:row.active_target_family_hash});
}
