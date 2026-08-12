import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA,
  PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema,
  type PlatformReleaseHostCompositionRuntimeAccountReceiptV2,
} from "../execution/schemas/platform-release-host-composition-v2.js";
import {
  parsePlatformReleaseBootstrapWireMessageV2,
} from "../execution/schemas/platform-release-bootstrap-wire-contracts-v2.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "../execution/schemas/platform-release-common-v2.js";
import { Sha256Schema } from "./schemas/common-v1.js";

/**
 * Test-only A relation. It is deliberately not an account authority: the
 * native Directory Services lookup, installed provisioner, durable receipt,
 * V attestation, and production opener remain outside this module.
 */
export const PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-runtime-account-relation-test.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_HASH_SCHEMA =
  "setfarm.platform-release-bootstrap-runtime-account-relation-test-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_MAX_CANONICAL_BYTES =
  512 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_LOOKUP_SUCCESS_V2_SCHEMA =
  "setfarm.platform-release-lookup-local-account-receipt.v2" as const;

const RelationIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  admissionScope: z.literal("test_fixture"),
  authorityState: z.literal("observed_test_fixture_unverified"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  provisioningReceiptHash: Sha256Schema,
  beforeLookupObservationHash: Sha256Schema,
  afterLookupObservationHash: Sha256Schema,
  stableRecordProjectionHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapRuntimeAccountRelationTestIdentityV2 =
  z.infer<typeof RelationIdentityV2Schema>;

export function hashPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
  value: PlatformReleaseBootstrapRuntimeAccountRelationTestIdentityV2,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_HASH_SCHEMA,
    relation: value,
  });
}

const RelationV2Schema = RelationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (
    value.observationHash
      !== hashPlatformReleaseBootstrapRuntimeAccountRelationTestV2(identity)
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Runtime-account relation hash mismatch",
    });
  }
});

export type PlatformReleaseBootstrapRuntimeAccountRelationTestV2 =
  z.infer<typeof RelationV2Schema>;

export const PlatformReleaseBootstrapRuntimeAccountRelationTestV2Schema =
  RelationV2Schema;

export type PlatformReleaseBootstrapRuntimeAccountRelationTestErrorCodeV2 =
  | "RUNTIME_ACCOUNT_RELATION_INPUT_INVALID"
  | "RUNTIME_ACCOUNT_RELATION_RECEIPT_INVALID"
  | "RUNTIME_ACCOUNT_RELATION_OBSERVATION_INVALID"
  | "RUNTIME_ACCOUNT_RELATION_MISMATCH"
  | "RUNTIME_ACCOUNT_RELATION_SERIALIZATION_INVALID";

export class PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2
  extends TypeError {
  constructor(
    readonly code:
      PlatformReleaseBootstrapRuntimeAccountRelationTestErrorCodeV2,
    message: string,
    options: ErrorOptions = {},
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2";
  }
}

function failV2(
  code: PlatformReleaseBootstrapRuntimeAccountRelationTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2(
    code,
    message,
    cause === undefined ? {} : { cause },
  );
}

function assertPlainRecordV2(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_INPUT_INVALID",
      `${label} must be one non-proxy plain record`,
    );
  }
}

function lookupFieldV2(
  value: Readonly<Record<string, unknown>>,
  field: string,
): unknown {
  return value[field];
}

function stableRecordProjectionV2(
  before: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return {
    accountRef: lookupFieldV2(before, "accountRef"),
    recordState: lookupFieldV2(before, "recordState"),
    uid: lookupFieldV2(before, "uid"),
    gid: lookupFieldV2(before, "gid"),
    userRecordUuid: lookupFieldV2(before, "userRecordUuid"),
    groupRecordUuid: lookupFieldV2(before, "groupRecordUuid"),
    recordIdentityHash: lookupFieldV2(before, "recordIdentityHash"),
    hostIdentityHash: lookupFieldV2(before, "hostIdentityHash"),
  };
}

function hashStableRecordProjectionV2(
  projection: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-runtime-account-stable-record-projection-hash.v2",
    projection,
  });
}

function observationHashV2(value: Readonly<Record<string, unknown>>): string {
  const hash = value.observationHash;
  if (typeof hash !== "string") {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_OBSERVATION_INVALID",
      "Account lookup observation is missing its observation hash",
    );
  }
  return hash;
}

function occurrenceIdV2(value: Readonly<Record<string, unknown>>): string {
  const occurrenceId = value.occurrenceId;
  if (typeof occurrenceId !== "string") {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_OBSERVATION_INVALID",
      "Account lookup observation is missing its occurrence identity",
    );
  }
  return occurrenceId;
}

function assertLookupMatchesReceiptV2(
  lookup: Readonly<Record<string, unknown>>,
  receipt: PlatformReleaseHostCompositionRuntimeAccountReceiptV2,
): void {
  if (
    lookup.accountRef !== receipt.accountRef
    || lookup.recordState !== "present_exact"
    || lookup.hostIdentityHash !== receipt.hostIdentityHash
    || lookup.uid !== String(receipt.uid)
    || lookup.gid !== String(receipt.gid)
    || lookup.userRecordUuid === null
    || lookup.groupRecordUuid === null
    || lookup.recordIdentityHash === null
  ) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_MISMATCH",
      "Account lookup observation does not equal the fixture runtime-account receipt",
    );
  }
}

export type PlatformReleaseBootstrapRuntimeAccountRelationTestInputV2 =
  Readonly<{
    provisioningReceipt: unknown;
    beforeLookupObservation: unknown;
    afterLookupObservation: unknown;
  }>;

/**
 * Join two equal post-mutation lookup observations to one fixture receipt.
 * The returned relation is pathless and contains no account name or UID/GID.
 */
export function buildPlatformReleaseBootstrapRuntimeAccountRelationTestV2(
  input: PlatformReleaseBootstrapRuntimeAccountRelationTestInputV2,
): PlatformReleaseBootstrapRuntimeAccountRelationTestV2 {
  let candidate: Record<string, unknown>;
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_MAX_CANONICAL_BYTES,
    );
    assertPlainRecordV2(snapshot, "Runtime-account relation input");
    candidate = snapshot;
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2) {
      throw error;
    }
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_INPUT_INVALID",
      "Runtime-account relation input is not bounded canonical JSON",
      error,
    );
  }

  const keys = Object.keys(candidate).sort();
  if (
    keys.length !== 3
    || keys[0] !== "afterLookupObservation"
    || keys[1] !== "beforeLookupObservation"
    || keys[2] !== "provisioningReceipt"
  ) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_INPUT_INVALID",
      "Runtime-account relation input contains unknown or missing fields",
    );
  }

  let receipt: PlatformReleaseHostCompositionRuntimeAccountReceiptV2;
  let before: Readonly<Record<string, unknown>>;
  let after: Readonly<Record<string, unknown>>;
  try {
    receipt = PlatformReleaseHostCompositionRuntimeAccountReceiptV2Schema.parse(
      candidate.provisioningReceipt,
    );
  } catch (error) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_RECEIPT_INVALID",
      "Runtime-account provisioning receipt is not code-owned and self-hashed",
      error,
    );
  }
  if (
    receipt.accountRef !== "TEST_FIXTURE_PLATFORM_RELEASE_RUNTIME_V2"
    || receipt.authorityState !== "test_fixture_identity_unverified"
    || receipt.uid <= 0
    || receipt.gid <= 0
    || receipt.ownerSeparationPolicy
      !== "uid_gid_nonzero_and_distinct_from_every_host_file_owner_v2"
  ) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_RECEIPT_INVALID",
      "Only the explicitly unverified fixture runtime-account receipt is accepted",
    );
  }

  try {
    before = parsePlatformReleaseBootstrapWireMessageV2(
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_LOOKUP_SUCCESS_V2_SCHEMA,
      candidate.beforeLookupObservation,
    );
    after = parsePlatformReleaseBootstrapWireMessageV2(
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_LOOKUP_SUCCESS_V2_SCHEMA,
      candidate.afterLookupObservation,
    );
  } catch (error) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_OBSERVATION_INVALID",
      "Runtime-account lookup observations are not strict code-owned messages",
      error,
    );
  }

  assertLookupMatchesReceiptV2(before, receipt);
  assertLookupMatchesReceiptV2(after, receipt);
  const beforeProjection = stableRecordProjectionV2(before);
  const afterProjection = stableRecordProjectionV2(after);
  if (
    hashStableRecordProjectionV2(beforeProjection)
      !== hashStableRecordProjectionV2(afterProjection)
    || occurrenceIdV2(before) === occurrenceIdV2(after)
    || observationHashV2(before) === observationHashV2(after)
  ) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_MISMATCH",
      "Two account lookup observations must be equal in state but distinct in occurrence and observation identity",
    );
  }

  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_SCHEMA,
    version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
    admissionScope: "test_fixture" as const,
    authorityState: "observed_test_fixture_unverified" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    provisioningReceiptHash: receipt.receiptHash,
    beforeLookupObservationHash: observationHashV2(before),
    afterLookupObservationHash: observationHashV2(after),
    stableRecordProjectionHash: hashStableRecordProjectionV2(beforeProjection),
  } satisfies PlatformReleaseBootstrapRuntimeAccountRelationTestIdentityV2;
  if (
    !platformReleaseCandidateFitsCanonicalCapV2(
      identity,
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_MAX_CANONICAL_BYTES,
    )
  ) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_SERIALIZATION_INVALID",
      "Runtime-account relation exceeds its canonical byte cap",
    );
  }
  const candidateRelation = {
    ...identity,
    observationHash:
      hashPlatformReleaseBootstrapRuntimeAccountRelationTestV2(identity),
  };
  try {
    return deepFreezePlatformReleaseJsonV2(
      RelationV2Schema.parse(candidateRelation),
    );
  } catch (error) {
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_SERIALIZATION_INVALID",
      "Runtime-account relation failed its strict self-hashed schema",
      error,
    );
  }
}

export function parsePlatformReleaseBootstrapRuntimeAccountRelationTestCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapRuntimeAccountRelationTestV2 {
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      PLATFORM_RELEASE_BOOTSTRAP_RUNTIME_ACCOUNT_RELATION_TEST_V2_MAX_CANONICAL_BYTES,
    );
    return deepFreezePlatformReleaseJsonV2(RelationV2Schema.parse(snapshot));
  } catch (error) {
    if (error instanceof PlatformReleaseBootstrapRuntimeAccountRelationTestErrorV2) {
      throw error;
    }
    return failV2(
      "RUNTIME_ACCOUNT_RELATION_SERIALIZATION_INVALID",
      "Runtime-account relation serialization is invalid",
      error,
    );
  }
}

export type { PlatformReleaseHostCompositionRuntimeAccountReceiptV2 };
export { PLATFORM_RELEASE_HOST_COMPOSITION_RUNTIME_ACCOUNT_RECEIPT_V2_SCHEMA };
