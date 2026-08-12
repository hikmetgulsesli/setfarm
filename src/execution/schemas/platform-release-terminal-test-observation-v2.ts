import { z } from "zod";

import {
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-terminal-test-observation.v2" as const;
export const PLATFORM_RELEASE_TERMINAL_TEST_SEALED_ROOT_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-terminal-test-sealed-root-observation.v2" as const;
export const PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-terminal-test-observation-hash.v2" as const;
export const PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_MAX_CANONICAL_BYTES_V2 =
  4 * 1024 * 1024;
export const PLATFORM_RELEASE_TERMINAL_TEST_ROOT_MAX_BYTES_V2 =
  8 * 1024 * 1024;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const CanonicalModeV2Schema = z.string().regex(/^[0-7]{4}$/u);

const StableDirectoryIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.literal("directory"),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const MutableDirectoryFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: z.literal("0555"),
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_TERMINAL_TEST_ROOT_MAX_BYTES_V2),
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

export function hashPlatformReleaseTerminalTestSealedRootObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_TERMINAL_TEST_SEALED_ROOT_OBSERVATION_V2_SCHEMA,
    observation: value,
  });
}

const SealedRootObservationV2Schema = z.object({
  stableIdentity: StableDirectoryIdentityV2Schema,
  mutableFingerprint: MutableDirectoryFingerprintV2Schema,
  membershipHash: Sha256Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (
    value.observationHash
      !== hashPlatformReleaseTerminalTestSealedRootObservationV2(identity)
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Terminal sealed-root observation hash mismatch",
    });
  }
});

const TerminalTestObservationIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("test_fixture_terminalized_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  productionUse: z.literal(
    "forbidden_until_publication_lease_and_fresh_verification",
  ),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal("characterization_only"),
  releaseId: Sha256Schema,
  manifestPayloadHash: Sha256Schema,
  buildAttestationHash: Sha256Schema,
  manifestCanonicalByteLength: z.number().int().positive().safe()
    .max(PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_MAX_CANONICAL_BYTES_V2),
  runtimePayloadHash: Sha256Schema,
  platformTreeHash: Sha256Schema,
  dependencyTreeHash: Sha256Schema,
  launcherCatalogHash: Sha256Schema,
  runnerCatalogHash: Sha256Schema,
  requiredModuleClosureHash: Sha256Schema,
  requiredModuleCount: z.literal(17),
  sealedRoot: SealedRootObservationV2Schema,
  durability: z.object({
    manifestFsync: z.literal(true),
    rootFsync: z.literal(true),
    rootReadOnly: z.literal(true),
  }).strict(),
  observationHash: Sha256Schema,
}).strict();

export const PlatformReleaseTerminalTestObservationV2Schema =
  TerminalTestObservationIdentityV2Schema.superRefine((value, context) => {
    const { observationHash: _observationHash, ...identity } = value;
    if (
      value.observationHash
        !== hashPlatformReleaseTerminalTestObservationV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Terminal test observation hash mismatch",
      });
    }
  });

export type PlatformReleaseTerminalTestObservationSchemaV2 = z.infer<
  typeof PlatformReleaseTerminalTestObservationV2Schema
>;

export function hashPlatformReleaseTerminalTestObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_HASH_V2_SCHEMA,
    observation: value,
  });
}

export function parsePlatformReleaseTerminalTestObservationV2(
  input: unknown,
): PlatformReleaseTerminalTestObservationSchemaV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    snapshot,
    PLATFORM_RELEASE_TERMINAL_TEST_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  )) {
    throw new Error("Terminal test observation exceeds its canonical byte cap");
  }
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseTerminalTestObservationV2Schema.parse(snapshot),
  );
}
