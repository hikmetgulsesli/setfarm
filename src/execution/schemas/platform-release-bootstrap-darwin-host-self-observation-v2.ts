import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-host-self-observation.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-host-self-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_EXECUTABLE_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_CODE_DIRECTORY_BYTES_V2 =
  128;

const DecimalStringV2 = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);
const SignedDecimalStringV2 = z.string().regex(/^-?(?:0|[1-9][0-9]*)$/u);
const Hex256V2 = Sha256Schema;
const NANOSECONDS_PER_SECOND_V2 = 1_000_000_000n;

const CodeDirectoryIdentityV2Schema = z.object({
  algorithm: z.number().int().nonnegative().safe(),
  byteLength: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_CODE_DIRECTORY_BYTES_V2,
  ),
  commitmentHash: Hex256V2,
  rawHex: z.string().regex(/^[a-f0-9]+$/u),
}).strict().superRefine((value, context) => {
  if (value.rawHex.length !== value.byteLength * 2) {
    context.addIssue({
      code: "custom",
      path: ["rawHex"],
      message: "Security.framework unique digest must round-trip its exact byte length",
    });
    return;
  }
  if (
    value.commitmentHash !== hashPlatformReleaseBootstrapDarwinHostSelfObservationCodeDirectoryV2(
      value,
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["commitmentHash"],
      message: "Code-directory commitment must bind raw digest bytes, length, and algorithm",
    });
  }
});

const ExecutableStableIdentityV2Schema = z.object({
  hostIdentityHash: Hex256V2,
  objectKind: z.literal("ordinary_file"),
  device: DecimalStringV2,
  inode: DecimalStringV2,
}).strict();

const ExecutableMutableFingerprintV2Schema = z.object({
  byteLength: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_EXECUTABLE_BYTES_V2,
  ),
  changedNanoseconds: SignedDecimalStringV2,
  changedSeconds: SignedDecimalStringV2,
  contentHash: Hex256V2,
  linkCount: z.number().int().positive().safe(),
  mode: z.string().regex(/^0[0-7]{3}$/u),
  modifiedNanoseconds: SignedDecimalStringV2,
  modifiedSeconds: SignedDecimalStringV2,
  ownerGid: z.number().int().nonnegative().safe(),
  ownerUid: z.number().int().nonnegative().safe(),
}).strict().superRefine((value, context) => {
  for (const [secondsKey, nanosecondsKey] of [
    ["modifiedSeconds", "modifiedNanoseconds"],
    ["changedSeconds", "changedNanoseconds"],
  ] as const) {
    const seconds = BigInt(value[secondsKey]);
    const nanoseconds = BigInt(value[nanosecondsKey]);
    const lower = seconds * NANOSECONDS_PER_SECOND_V2;
    const upper = lower + (NANOSECONDS_PER_SECOND_V2 - 1n);
    if (nanoseconds < lower || nanoseconds > upper) {
      context.addIssue({
        code: "custom",
        path: [nanosecondsKey],
        message: `${nanosecondsKey} must equal ${secondsKey} seconds plus a sub-second remainder`,
      });
    }
  }
});

const ExecutableEvidenceV2Schema = z.object({
  mutableFingerprint: ExecutableMutableFingerprintV2Schema,
  stableIdentity: ExecutableStableIdentityV2Schema,
}).strict();

const OsStatusV2Schema = z.object({
  copySelf: z.number().int().safe(),
  copyStatic: z.number().int().safe(),
  requirement: z.number().int().safe(),
  signingInformation: z.number().int().safe(),
  staticValidity: z.number().int().safe(),
  validity: z.number().int().safe(),
}).strict();

const HostSelfObservationIdentityV2Schema = z.object({
  admissionScope: z.literal("test_fixture"),
  amfiProductionAdmission: z.literal("unproven"),
  architecture: z.enum(["arm64", "x64", "unknown"]),
  challengeHash: Hex256V2,
  codeDirectory: CodeDirectoryIdentityV2Schema.nullable(),
  dynamicStatusFlags: z.number().int().nonnegative().safe(),
  executable: ExecutableEvidenceV2Schema,
  hasCertificates: z.boolean(),
  hasCms: z.boolean(),
  hasIdentifier: z.boolean(),
  hasStapledNotarizationTicket: z.boolean(),
  hasTeamIdentifier: z.boolean(),
  identifier: z.string().min(1).max(512).nullable(),
  installerReceiptAdmission: z.literal("absent"),
  libraryValidationEnabled: z.boolean(),
  notarizationAdmission: z.literal("unproven"),
  notarizationTicketPresent: z.boolean(),
  osStatus: OsStatusV2Schema,
  productionAdmission: z.literal("forbidden"),
  productionAuthority: z.literal(false),
  requirementHash: Hex256V2.nullable(),
  runtimeEnabled: z.boolean(),
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_V2_SCHEMA,
  ),
  signatureClass: z.enum(["unknown", "unsigned", "adhoc", "signed"]),
  signingAuthority: z.literal("security_framework_observation_only"),
  signingFlags: z.number().int().nonnegative().safe(),
  teamIdentifier: z.string().min(1).max(256).nullable(),
  uniqueDigestAlgorithm: z.number().int().nonnegative().safe(),
}).strict().superRefine((value, context) => {
  if (value.hasIdentifier !== (value.identifier !== null)) {
    context.addIssue({
      code: "custom",
      path: ["identifier"],
      message: "Identifier presence marker must match the observed identifier",
    });
  }
  if (value.hasTeamIdentifier !== (value.teamIdentifier !== null)) {
    context.addIssue({
      code: "custom",
      path: ["teamIdentifier"],
      message: "Team identifier presence marker must match the observed team identifier",
    });
  }
  if (value.hasStapledNotarizationTicket !== value.notarizationTicketPresent) {
    context.addIssue({
      code: "custom",
      path: ["notarizationTicketPresent"],
      message: "Notarization ticket presence markers must agree",
    });
  }
  if (value.codeDirectory === null && value.uniqueDigestAlgorithm !== 0) {
    context.addIssue({
      code: "custom",
      path: ["uniqueDigestAlgorithm"],
      message: "Absent Security.framework unique digest must use algorithm zero",
    });
  }
  if (value.codeDirectory !== null && value.uniqueDigestAlgorithm !== value.codeDirectory.algorithm) {
    context.addIssue({
      code: "custom",
      path: ["uniqueDigestAlgorithm"],
      message: "Unique digest algorithm must match its code-directory evidence",
    });
  }
  if (value.runtimeEnabled !== ((value.signingFlags & 0x10000) !== 0)) {
    context.addIssue({
      code: "custom",
      path: ["runtimeEnabled"],
      message: "Runtime marker must reflect kSecCodeSignatureRuntime",
    });
  }
  if (value.libraryValidationEnabled !== ((value.signingFlags & 0x2000) !== 0)) {
    context.addIssue({
      code: "custom",
      path: ["libraryValidationEnabled"],
      message: "Library-validation marker must reflect kSecCodeSignatureLibraryValidation",
    });
  }
  if (value.signatureClass === "signed" && (!value.hasIdentifier || !value.hasCms)) {
    context.addIssue({
      code: "custom",
      path: ["signatureClass"],
      message: "Signed classification requires identifier and CMS evidence",
    });
  }
  const expectedSignatureClass = value.osStatus.signingInformation !== 0
    ? "unknown"
    : !value.hasIdentifier
      ? "unsigned"
      : (value.signingFlags & 0x2) !== 0
        ? "adhoc"
        : value.hasCms
          ? "signed"
          : "unknown";
  if (value.signatureClass !== expectedSignatureClass) {
    context.addIssue({
      code: "custom",
      path: ["signatureClass"],
      message: "Signature classification must be derived from observed status, identifier, ad-hoc flag, and CMS evidence",
    });
  }
});

export type PlatformReleaseBootstrapDarwinHostSelfObservationHashPayloadV2 =
  z.infer<typeof HostSelfObservationIdentityV2Schema>;

export type PlatformReleaseBootstrapDarwinHostSelfObservationV2 =
  PlatformReleaseBootstrapDarwinHostSelfObservationHashPayloadV2 & Readonly<{
    observationHash: string;
  }>;

export function hashPlatformReleaseBootstrapDarwinHostSelfObservationCodeDirectoryV2(
  value: Readonly<{
    algorithm: number;
    byteLength: number;
    rawHex: string;
  }>,
): string {
  const raw = Buffer.from(value.rawHex, "hex");
  const domain = Buffer.from(
    "setfarm.platform-release-bootstrap-darwin-host-self-observation-code-directory-v2",
    "utf8",
  );
  return createHash("sha256")
    .update(domain)
    .update(Buffer.from([0]))
    .update(String(value.algorithm), "utf8")
    .update(Buffer.from([0]))
    .update(String(value.byteLength), "utf8")
    .update(Buffer.from([0]))
    .update(raw)
    .digest("hex");
}

export function hashPlatformReleaseBootstrapDarwinHostSelfObservationV2(
  value:
    | PlatformReleaseBootstrapDarwinHostSelfObservationHashPayloadV2
    | PlatformReleaseBootstrapDarwinHostSelfObservationV2,
): string {
  const observation = { ...value } as Record<string, unknown>;
  delete observation.observationHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_HASH_V2_SCHEMA,
    observation,
  });
}

export function parsePlatformReleaseBootstrapDarwinHostSelfObservationCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinHostSelfObservationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  const candidate = { ...(snapshot as Record<string, unknown>) };
  const suppliedObservationHash = candidate.observationHash;
  delete candidate.observationHash;
  const parsed = HostSelfObservationIdentityV2Schema.parse(candidate);
  const observationHash = hashPlatformReleaseBootstrapDarwinHostSelfObservationV2(parsed);
  if (
    suppliedObservationHash !== undefined
    && suppliedObservationHash !== observationHash
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["observationHash"],
        message: "Host self-observation hash mismatch",
      },
    ]);
  }
  return deepFreezePlatformReleaseJsonV2({ ...parsed, observationHash });
}

export const PlatformReleaseBootstrapDarwinHostSelfObservationV2Schema = {
  parse(input: unknown): PlatformReleaseBootstrapDarwinHostSelfObservationV2 {
    const parsed = parsePlatformReleaseBootstrapDarwinHostSelfObservationCandidateV2(input);
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      parsed,
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_HOST_SELF_OBSERVATION_MAX_CANONICAL_BYTES_V2,
    )) {
      throw new TypeError("Host self-observation exceeds its canonical byte cap");
    }
    return deepFreezePlatformReleaseJsonV2(parsed);
  },
  safeParse(input: unknown):
    | { success: true; data: PlatformReleaseBootstrapDarwinHostSelfObservationV2 }
    | { success: false; error: z.ZodError } {
    try {
      return {
        success: true,
        data: this.parse(input),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof z.ZodError
          ? error
          : new z.ZodError([
            {
              code: "custom",
              path: [],
              message: error instanceof Error ? error.message : "Invalid host self-observation",
            },
          ]),
      };
    }
  },
};

export function canonicalizePlatformReleaseBootstrapDarwinHostSelfObservationV2(
  value: PlatformReleaseBootstrapDarwinHostSelfObservationV2,
): string {
  return canonicalJsonStringify(value);
}
