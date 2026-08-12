import { z } from "zod";

import { canonicalJsonStringify } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-suspended-exec-binding.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_EXECUTABLE_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_REGIONS_V2 =
  4_096;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_CDHASH_BYTES_V2 =
  128;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_STATUS_VALID_V2 =
  0x0000_0001;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_SIGNATURE_ADHOC_V2 =
  0x0000_0002;
const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_MAX_SECURITY_FLAGS_V2 =
  0xffff_ffff;
const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_MAX_EXIT_CODE_V2 = 255;
const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_MAX_SIGNAL_V2 = 127;
const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_SIGKILL_V2 = 9;
const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_SIGTERM_V2 = 15;
const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_ADVERSARIAL_EXIT_CODE_V2 =
  23;

const DecimalStringV2 = z.string().regex(/^(?:0|[1-9][0-9]*)$/u);
const SignedDecimalStringV2 = z.string().regex(/^-?(?:0|[1-9][0-9]*)$/u);
const NANOSECONDS_PER_SECOND_V2 = 1_000_000_000n;

const StableIdentityV2Schema = z.object({
  device: DecimalStringV2,
  inode: DecimalStringV2,
  objectKind: z.literal("ordinary_file"),
}).strict();

const MutableFingerprintV2Schema = z.object({
  byteLength: z.number().int().positive().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_EXECUTABLE_BYTES_V2,
  ),
  changedNanoseconds: SignedDecimalStringV2,
  changedSeconds: SignedDecimalStringV2,
  contentHash: Sha256Schema,
  linkCount: z.literal(1),
  mode: z.literal("0500"),
  modifiedNanoseconds: SignedDecimalStringV2,
  modifiedSeconds: SignedDecimalStringV2,
  ownerGid: z.number().int().nonnegative().safe(),
  ownerUid: z.number().int().nonnegative().safe(),
}).strict().superRefine((value, context) => {
  for (const [secondsKey, nanosecondsKey] of [
    ["changedSeconds", "changedNanoseconds"],
    ["modifiedSeconds", "modifiedNanoseconds"],
  ] as const) {
    const seconds = BigInt(value[secondsKey]);
    const nanoseconds = BigInt(value[nanosecondsKey]);
    const lower = seconds * NANOSECONDS_PER_SECOND_V2;
    const upper = lower + (NANOSECONDS_PER_SECOND_V2 - 1n);
    if (nanoseconds < lower || nanoseconds > upper) {
      context.addIssue({
        code: "custom",
        path: [nanosecondsKey],
        message: `${nanosecondsKey} must bind its exact seconds and sub-second value`,
      });
    }
  }
});

const HeldExecutableV2Schema = z.object({
  mutableFingerprint: MutableFingerprintV2Schema,
  stableIdentity: StableIdentityV2Schema,
}).strict();

const MappedExecutableV2Schema = z.object({
  matched: z.boolean(),
  matchingRegionCount: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_REGIONS_V2,
  ),
  regionCountObserved: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_REGIONS_V2,
  ),
  stableIdentity: StableIdentityV2Schema.nullable(),
}).strict().superRefine((value, context) => {
  if (
    value.matched !== (value.stableIdentity !== null)
    || value.matched !== (value.matchingRegionCount > 0)
    || value.matchingRegionCount > value.regionCountObserved
  ) {
    context.addIssue({
      code: "custom",
      path: ["matched"],
      message: "Mapped executable match markers must agree with bounded region evidence",
    });
  }
});

const SecurityObservationV2Schema = z.object({
  cdhash: z.string().regex(/^[a-f0-9]+$/u).nullable(),
  cdhashByteLength: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_CDHASH_BYTES_V2,
  ),
  digestAlgorithm: z.number().int().nonnegative().safe(),
  dynamicStatusFlags: z.number().int().nonnegative().safe(),
  guestLookupStatus: z.number().int().safe(),
  hasCms: z.boolean(),
  hasIdentifier: z.boolean(),
  observedBeforeResume: z.literal(true),
  signatureClass: z.enum(["unsigned", "adhoc", "signed", "unknown"]),
  signingInformationFlags: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_MAX_SECURITY_FLAGS_V2,
  ),
  signingInformationStatus: z.number().int().safe(),
  validityStatus: z.number().int().safe(),
}).strict().superRefine((value, context) => {
  if (
    (value.cdhash === null && value.cdhashByteLength !== 0)
    || (
      value.cdhash !== null
      && value.cdhash.length !== value.cdhashByteLength * 2
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["cdhash"],
      message: "Dynamic cdhash must round-trip its exact bounded byte length",
    });
  }
  const hasAdhocFlag = (
    value.signingInformationFlags
      & PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_SIGNATURE_ADHOC_V2
  ) !== 0;
  const expectedSignatureClass = value.signingInformationStatus !== 0
    ? "unknown"
    : !value.hasIdentifier
    ? "unsigned"
    : hasAdhocFlag
    ? "adhoc"
    : value.hasCms
    ? "signed"
    : "unknown";
  if (
    value.signatureClass !== expectedSignatureClass
    || (value.hasCms && !value.hasIdentifier)
    || (hasAdhocFlag && value.hasCms)
    || (
      value.signingInformationStatus !== 0
      && (
        value.signingInformationFlags !== 0
        || value.hasCms
        || value.hasIdentifier
      )
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["signatureClass"],
      message: "Signature class must exactly match bounded signing-information evidence",
    });
  }
});

const ProcessEvidenceCommonV2 = {
  heldPostExecutionUnchanged: z.boolean(),
  reaped: z.literal(true),
  sigcontSent: z.boolean(),
  sigkillSent: z.boolean(),
  targetCanaryObserved: z.boolean(),
  targetOutputState: z.enum(["none", "valid", "malformed", "timeout"]),
} as const;

const ProcessEvidenceV2Schema = z.discriminatedUnion("terminationKind", [
  z.object({
    ...ProcessEvidenceCommonV2,
    exitCode: z.number().int().nonnegative().max(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_MAX_EXIT_CODE_V2,
    ),
    terminationKind: z.literal("exited"),
    terminationSignal: z.null(),
  }).strict(),
  z.object({
    ...ProcessEvidenceCommonV2,
    exitCode: z.null(),
    terminationKind: z.literal("signaled"),
    terminationSignal: z.number().int().positive().max(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_MAX_SIGNAL_V2,
    ),
  }).strict(),
  z.object({
    ...ProcessEvidenceCommonV2,
    exitCode: z.null(),
    terminationKind: z.literal("unknown"),
    terminationSignal: z.null(),
  }).strict(),
]);

const SuspendedExecBindingV2Schema = z.object({
  admissionScope: z.literal("test_fixture"),
  credentialUse: z.literal("none"),
  descriptorExecution: z.literal(false),
  heldExecutable: HeldExecutableV2Schema,
  libprocApiStability: z.literal("private_unproven"),
  mappedExecutable: MappedExecutableV2Schema,
  mode: z.enum([
    "baseline",
    "pre_spawn_replacement",
    "post_spawn_rename",
    "post_resume_drift",
    "security_observation_failure",
    "malformed",
    "timeout",
    "canary_then_nonzero_exit",
    "canary_then_signal",
  ]),
  observationReadiness: z.literal("private_api_not_guaranteed"),
  outcome: z.enum([
    "continued_and_completed",
    "rejected_pre_user_entry_vnode_mismatch",
    "rejected_pre_user_entry_security_observation",
    "rejected_pre_user_entry_observation_unavailable",
    "continued_then_malformed",
    "continued_then_timeout",
    "failed_closed_post_resume_drift",
    "failed_closed_process_termination",
  ]),
  process: ProcessEvidenceV2Schema,
  productionAuthority: z.literal(false),
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_V2_SCHEMA,
  ),
  security: SecurityObservationV2Schema,
  spawnFlags: z.tuple([
    z.literal("POSIX_SPAWN_START_SUSPENDED"),
    z.literal("POSIX_SPAWN_CLOEXEC_DEFAULT"),
  ]).readonly(),
  trustConclusion: z.literal("characterization_only"),
}).strict().superRefine((value, context) => {
  const intendedByMode = {
    baseline: "continued_and_completed",
    pre_spawn_replacement: "rejected_pre_user_entry_vnode_mismatch",
    post_spawn_rename: "continued_and_completed",
    post_resume_drift: "failed_closed_post_resume_drift",
    security_observation_failure:
      "rejected_pre_user_entry_security_observation",
    malformed: "continued_then_malformed",
    timeout: "continued_then_timeout",
    canary_then_nonzero_exit: "failed_closed_process_termination",
    canary_then_signal: "failed_closed_process_termination",
  } as const;
  const postResumeDriftAllowed = [
    "baseline",
    "post_spawn_rename",
    "post_resume_drift",
    "malformed",
    "timeout",
  ].includes(value.mode);
  if (
    value.outcome !== intendedByMode[value.mode]
    && value.outcome !== "rejected_pre_user_entry_observation_unavailable"
    && !(
      value.outcome === "failed_closed_post_resume_drift"
      && postResumeDriftAllowed
    )
    && value.outcome !== "failed_closed_process_termination"
  ) {
    context.addIssue({
      code: "custom",
      path: ["outcome"],
      message: "Fixture mode must have one exact bounded characterization outcome",
    });
  }

  const process = value.process;
  const exitedZero = process.terminationKind === "exited"
    && process.exitCode === 0;
  const killedByController = process.terminationKind === "signaled"
    && process.terminationSignal ===
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_SIGKILL_V2;
  const securityReady = value.security.guestLookupStatus === 0
    && value.security.validityStatus === 0
    && value.security.signingInformationStatus === 0
    && value.security.cdhash !== null
    && value.security.cdhashByteLength > 0
    && value.security.digestAlgorithm > 0
    && (
      value.security.dynamicStatusFlags
        & PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_KSEC_CODE_STATUS_VALID_V2
    ) !== 0;
  if (value.outcome === "rejected_pre_user_entry_observation_unavailable") {
    if (
      process.sigcontSent
      || !process.sigkillSent
      || process.targetCanaryObserved
      || process.targetOutputState !== "none"
      || !process.heldPostExecutionUnchanged
      || !killedByController
      || (value.mappedExecutable.regionCountObserved > 0 && securityReady)
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Unavailable private observation must kill and reap without running target user code",
      });
    }
  } else if (value.outcome === "rejected_pre_user_entry_vnode_mismatch") {
    if (
      value.mappedExecutable.matched
      || process.sigcontSent
      || !process.sigkillSent
      || process.targetCanaryObserved
      || process.targetOutputState !== "none"
      || !killedByController
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Vnode mismatch must kill and reap before target user code runs",
      });
    }
  } else if (value.outcome === "rejected_pre_user_entry_security_observation") {
    if (
      !value.mappedExecutable.matched
      || securityReady
      || process.sigcontSent
      || !process.sigkillSent
      || process.targetCanaryObserved
      || process.targetOutputState !== "none"
      || !killedByController
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Incomplete Security observation must fail closed before resume",
      });
    }
  } else if (value.outcome === "failed_closed_post_resume_drift") {
    if (
      !value.mappedExecutable.matched
      || !securityReady
      || !process.sigcontSent
      || !process.targetCanaryObserved
      || process.targetOutputState === "none"
      || process.heldPostExecutionUnchanged
      || !exitedZero
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Post-resume descriptor drift must remain one explicit fail-closed characterization",
      });
    }
  } else if (value.outcome === "continued_and_completed") {
    if (
      !value.mappedExecutable.matched
      || !securityReady
      || !process.sigcontSent
      || process.sigkillSent
      || !process.targetCanaryObserved
      || process.targetOutputState !== "valid"
      || !process.heldPostExecutionUnchanged
      || !exitedZero
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Completed characterization requires exact mapping, canary, and post-fd stability",
      });
    }
  } else if (value.outcome === "continued_then_malformed") {
    if (
      !value.mappedExecutable.matched
      || !securityReady
      || !process.sigcontSent
      || !process.targetCanaryObserved
      || process.targetOutputState !== "malformed"
      || !process.heldPostExecutionUnchanged
      || !exitedZero
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Malformed target evidence is only possible after the exact pre-entry gate",
      });
    }
  } else if (value.outcome === "continued_then_timeout") {
    if (
      !value.mappedExecutable.matched
      || !securityReady
      || !process.sigcontSent
      || !process.sigkillSent
      || !process.targetCanaryObserved
      || process.targetOutputState !== "timeout"
      || !process.heldPostExecutionUnchanged
      || !killedByController
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Timed-out target must be killed and reaped after the exact pre-entry gate",
      });
    }
  } else if (value.outcome === "failed_closed_process_termination") {
    const exactAdversarialCommon = value.mappedExecutable.matched
      && securityReady
      && process.sigcontSent
      && !process.sigkillSent
      && process.targetCanaryObserved
      && process.targetOutputState === "valid"
      && process.heldPostExecutionUnchanged;
    const exactAdversarialTermination =
      value.mode === "canary_then_nonzero_exit"
        ? process.terminationKind === "exited"
          && process.exitCode ===
            PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_ADVERSARIAL_EXIT_CODE_V2
        : value.mode === "canary_then_signal"
        ? process.terminationKind === "signaled"
          && process.terminationSignal ===
            PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_SIGTERM_V2
        : process.terminationKind === "unknown";
    if (
      exitedZero
      || !exactAdversarialTermination
      || (
        ["canary_then_nonzero_exit", "canary_then_signal"].includes(value.mode)
        && !exactAdversarialCommon
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["process"],
        message: "Process-termination failure must bind unknown wait status or one exact post-canary non-success status",
      });
    }
  }

  const mappedStable = value.mappedExecutable.stableIdentity;
  if (
    mappedStable !== null
    && (
      mappedStable.device !== value.heldExecutable.stableIdentity.device
      || mappedStable.inode !== value.heldExecutable.stableIdentity.inode
      || mappedStable.objectKind !== value.heldExecutable.stableIdentity.objectKind
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["mappedExecutable", "stableIdentity"],
      message: "Matched VM vnode must equal the held executable physical identity",
    });
  }
});

export type PlatformReleaseBootstrapDarwinSuspendedExecBindingV2 = z.infer<
  typeof SuspendedExecBindingV2Schema
>;

export function parsePlatformReleaseBootstrapDarwinSuspendedExecBindingCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinSuspendedExecBindingV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_CANONICAL_BYTES_V2,
  );
  const parsed = SuspendedExecBindingV2Schema.parse(snapshot);
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    parsed,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SUSPENDED_EXEC_BINDING_MAX_CANONICAL_BYTES_V2,
  )) {
    throw new TypeError("Suspended-exec characterization exceeds its canonical byte cap");
  }
  return deepFreezePlatformReleaseJsonV2(parsed);
}

export const PlatformReleaseBootstrapDarwinSuspendedExecBindingV2Schema = {
  parse(input: unknown): PlatformReleaseBootstrapDarwinSuspendedExecBindingV2 {
    return parsePlatformReleaseBootstrapDarwinSuspendedExecBindingCandidateV2(input);
  },
  safeParse(input: unknown):
    | { success: true; data: PlatformReleaseBootstrapDarwinSuspendedExecBindingV2 }
    | { success: false; error: z.ZodError } {
    try {
      return { success: true, data: this.parse(input) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof z.ZodError
          ? error
          : new z.ZodError([{
            code: "custom",
            path: [],
            message: error instanceof Error
              ? error.message
              : "Invalid suspended-exec characterization",
          }]),
      };
    }
  },
};

export function canonicalizePlatformReleaseBootstrapDarwinSuspendedExecBindingV2(
  value: PlatformReleaseBootstrapDarwinSuspendedExecBindingV2,
): string {
  return canonicalJsonStringify(value);
}
