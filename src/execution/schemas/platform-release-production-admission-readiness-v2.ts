import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2,
  PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
} from "./platform-release-bootstrap-contract-v2.js";

export const PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA =
  "setfarm.platform-release-production-admission-readiness.v2" as const;
export const PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2 =
  64 * 1024;

export const PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2 = Object.freeze([
  "PLATFORM_UNSUPPORTED",
  "DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED",
  "DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED",
  "CODE_SIGNING_IDENTITY_OBSERVATION_FAILED",
  "DEVELOPER_ID_TEAM_UNCONFIGURED",
  "DESIGNATED_REQUIREMENT_UNCONFIGURED",
  "INSTALLER_PACKAGE_ID_UNCONFIGURED",
  "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
  "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
  "NOTARYTOOL_UNAVAILABLE",
  "NOTARYTOOL_OBSERVATION_FAILED",
  "NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE",
  "NOTARIZED_DISTRIBUTION_UNPROVEN",
  "GATEKEEPER_DISABLED",
  "GATEKEEPER_OBSERVATION_FAILED",
  "SIP_DISABLED",
  "SIP_OBSERVATION_FAILED",
  "AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE",
  "AMFI_SERVICE_UNAVAILABLE",
  "AUTHENTICATED_RUNNING_HELPER_ABSENT",
  "AMFI_RUNTIME_ADMISSION_UNPROVEN",
  "INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE",
  "INSTALLED_SETFARM_ROOT_ABSENT",
  "INSTALLED_HELPER_ABSENT",
  "EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN",
  "PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE",
  "V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE",
  "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
  "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
  "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
  "HOST_OBSERVATION_INCOMPLETE",
] as const);

export const PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2 = Object.freeze({
  supportedPlatform: "darwin",
  commandTimeoutMs: 5_000,
  channelByteCap: 32 * 1024,
  canonicalReceiptByteCap: 64 * 1024,
  redactedProjectionByteCap: 4_096,
  maxCommandObservations: 16,
  maxBlockerCodes: 32,
  maxIdentityCountPerClass: 128,
  environment: Object.freeze({
    LC_ALL: "C",
    LANG: "C",
    HOME: "/var/empty",
    PATH: "/usr/bin:/usr/sbin:/bin:/sbin",
  }),
  knownNotaryProfileServices: Object.freeze([
    "com.apple.gke.notary.tool",
    "com.apple.notarytool",
    "notarytool",
  ] as const),
  blockerOrder: PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2,
  commandPlan: Object.freeze([
    Object.freeze({
      commandLabel: "developer_id_application",
      commandRef: "SECURITY_FIND_IDENTITY_CODESIGNING_V2",
      execution: "subprocess",
      executable: "/usr/bin/security",
      argv: Object.freeze(["find-identity", "-v", "-p", "codesigning"]),
      kind: "developer_id_application_identity",
      executableRef: "SECURITY",
      argvRef: "SECURITY_FIND_IDENTITY_CODESIGNING",
      result: Object.freeze({
        kind: "identity_count",
        identityClass: "developer_id_application",
      }),
    }),
    Object.freeze({
      commandLabel: "developer_id_installer",
      commandRef: "SECURITY_FIND_IDENTITY_BASIC_V2",
      execution: "subprocess",
      executable: "/usr/bin/security",
      argv: Object.freeze(["find-identity", "-v", "-p", "basic"]),
      kind: "developer_id_installer_identity",
      executableRef: "SECURITY",
      argvRef: "SECURITY_FIND_IDENTITY_BASIC",
      result: Object.freeze({
        kind: "identity_count",
        identityClass: "developer_id_installer",
      }),
    }),
    Object.freeze({
      commandLabel: "gatekeeper_status",
      commandRef: "SPCTL_STATUS_V2",
      execution: "subprocess",
      executable: "/usr/sbin/spctl",
      argv: Object.freeze(["--status"]),
      kind: "gatekeeper_status",
      executableRef: "SPCTL",
      argvRef: "SPCTL_STATUS",
      result: Object.freeze({ kind: "gatekeeper" }),
    }),
    Object.freeze({
      commandLabel: "sip_status",
      commandRef: "CSRUTIL_STATUS_V2",
      execution: "subprocess",
      executable: "/usr/bin/csrutil",
      argv: Object.freeze(["status"]),
      kind: "sip_status",
      executableRef: "CSRUTIL",
      argvRef: "CSRUTIL_STATUS",
      result: Object.freeze({ kind: "sip" }),
    }),
    Object.freeze({
      commandLabel: "authenticated_root_status",
      commandRef: "CSRUTIL_AUTHENTICATED_ROOT_STATUS_V2",
      execution: "subprocess",
      executable: "/usr/bin/csrutil",
      argv: Object.freeze(["authenticated-root", "status"]),
      kind: "authenticated_root_status",
      executableRef: "CSRUTIL",
      argvRef: "CSRUTIL_AUTHENTICATED_ROOT_STATUS",
      result: Object.freeze({ kind: "authenticated_root" }),
    }),
    Object.freeze({
      commandLabel: "amfi_service",
      commandRef: "LAUNCHCTL_AMFI_SERVICE_V2",
      execution: "subprocess",
      executable: "/bin/launchctl",
      argv: Object.freeze(["print", "system/com.apple.MobileFileIntegrity"]),
      kind: "amfi_service_status",
      executableRef: "LAUNCHCTL",
      argvRef: "LAUNCHCTL_PRINT_AMFI",
      result: Object.freeze({ kind: "amfi_service" }),
    }),
    Object.freeze({
      commandLabel: "notarytool_resolution",
      commandRef: "XCRUN_FIND_NOTARYTOOL_V2",
      execution: "subprocess",
      executable: "/usr/bin/xcrun",
      argv: Object.freeze(["--find", "notarytool"]),
      kind: "tool_availability",
      executableRef: "NOTARYTOOL",
      argvRef: "NOTARYTOOL_AVAILABILITY",
      result: Object.freeze({
        kind: "tool_availability",
        tool: "notarytool",
        fixedPathRef: "NOTARYTOOL_RESOLVED_TOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "stapler_resolution",
      commandRef: "XCRUN_FIND_STAPLER_V2",
      execution: "subprocess",
      executable: "/usr/bin/xcrun",
      argv: Object.freeze(["--find", "stapler"]),
      kind: "tool_availability",
      executableRef: "STAPLER",
      argvRef: "STAPLER_AVAILABILITY",
      result: Object.freeze({
        kind: "tool_availability",
        tool: "stapler",
        fixedPathRef: "STAPLER_RESOLVED_TOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "notary_profile_service_1",
      commandRef: "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_1_V2",
      execution: "subprocess",
      executable: "/usr/bin/security",
      argv: Object.freeze([
        "find-generic-password",
        "-s",
        "com.apple.gke.notary.tool",
      ]),
      kind: "notary_profile_metadata",
      executableRef: "SECURITY",
      argvRef: "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL",
      result: Object.freeze({
        kind: "notary_profile_metadata",
        serviceRef: "GKE_NOTARY_TOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "notary_profile_service_2",
      commandRef: "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_2_V2",
      execution: "subprocess",
      executable: "/usr/bin/security",
      argv: Object.freeze([
        "find-generic-password",
        "-s",
        "com.apple.notarytool",
      ]),
      kind: "notary_profile_metadata",
      executableRef: "SECURITY",
      argvRef: "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL",
      result: Object.freeze({
        kind: "notary_profile_metadata",
        serviceRef: "APPLE_NOTARYTOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "notary_profile_service_3",
      commandRef: "SECURITY_FIND_GENERIC_PASSWORD_SERVICE_3_V2",
      execution: "subprocess",
      executable: "/usr/bin/security",
      argv: Object.freeze(["find-generic-password", "-s", "notarytool"]),
      kind: "notary_profile_metadata",
      executableRef: "SECURITY",
      argvRef: "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL",
      result: Object.freeze({
        kind: "notary_profile_metadata",
        serviceRef: "NOTARYTOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "codesign_availability",
      commandRef: "CODESIGN_AVAILABILITY_V2",
      execution: "fixed_path",
      argv: Object.freeze([]),
      kind: "tool_availability",
      executableRef: "CODESIGN",
      argvRef: "CODESIGN_AVAILABILITY",
      result: Object.freeze({
        kind: "tool_availability",
        tool: "codesign",
        fixedPathRef: "CODESIGN_TOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "spctl_availability",
      commandRef: "SPCTL_AVAILABILITY_V2",
      execution: "fixed_path",
      argv: Object.freeze([]),
      kind: "tool_availability",
      executableRef: "SPCTL",
      argvRef: "SPCTL_AVAILABILITY",
      result: Object.freeze({
        kind: "tool_availability",
        tool: "spctl",
        fixedPathRef: "SPCTL_TOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "pkgutil_availability",
      commandRef: "PKGUTIL_AVAILABILITY_V2",
      execution: "fixed_path",
      argv: Object.freeze([]),
      kind: "tool_availability",
      executableRef: "PKGUTIL",
      argvRef: "PKGUTIL_AVAILABILITY",
      result: Object.freeze({
        kind: "tool_availability",
        tool: "pkgutil",
        fixedPathRef: "PKGUTIL_TOOL",
      }),
    }),
    Object.freeze({
      commandLabel: "security_availability",
      commandRef: "SECURITY_AVAILABILITY_V2",
      execution: "fixed_path",
      argv: Object.freeze([]),
      kind: "tool_availability",
      executableRef: "SECURITY",
      argvRef: "SECURITY_AVAILABILITY",
      result: Object.freeze({
        kind: "tool_availability",
        tool: "security",
        fixedPathRef: "SECURITY_TOOL",
      }),
    }),
  ] as const),
  fixedPathPlan: Object.freeze([
    Object.freeze({
      ref: "INSTALLED_SETFARM_ROOT",
      role: "installed_root",
      expectedKind: "directory",
      target: Object.freeze({
        kind: "absolute",
        value: PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2,
      }),
    }),
    Object.freeze({
      ref: "AUTHENTICATED_SETFARM_HELPER",
      role: "installed_helper",
      expectedKind: "executable_file",
      target: Object.freeze({
        kind: "absolute",
        value: `${PLATFORM_RELEASE_HOST_VERIFIER_ROOT_V2}/${PLATFORM_RELEASE_HOST_VERIFIER_EXECUTABLE_LOCATOR_V2}`,
      }),
    }),
    Object.freeze({
      ref: "CODESIGN_TOOL",
      role: "fixed_tool",
      expectedKind: "executable_file",
      target: Object.freeze({ kind: "absolute", value: "/usr/bin/codesign" }),
    }),
    Object.freeze({
      ref: "SPCTL_TOOL",
      role: "fixed_tool",
      expectedKind: "executable_file",
      target: Object.freeze({ kind: "absolute", value: "/usr/sbin/spctl" }),
    }),
    Object.freeze({
      ref: "PKGUTIL_TOOL",
      role: "fixed_tool",
      expectedKind: "executable_file",
      target: Object.freeze({ kind: "absolute", value: "/usr/sbin/pkgutil" }),
    }),
    Object.freeze({
      ref: "SECURITY_TOOL",
      role: "fixed_tool",
      expectedKind: "executable_file",
      target: Object.freeze({ kind: "absolute", value: "/usr/bin/security" }),
    }),
    Object.freeze({
      ref: "NOTARYTOOL_RESOLVED_TOOL",
      role: "resolved_xcode_tool",
      expectedKind: "executable_file",
      target: Object.freeze({
        kind: "absolute",
        value: "/Applications/Xcode.app/Contents/Developer/usr/bin/notarytool",
      }),
    }),
    Object.freeze({
      ref: "STAPLER_RESOLVED_TOOL",
      role: "resolved_xcode_tool",
      expectedKind: "executable_file",
      target: Object.freeze({
        kind: "absolute",
        value: "/Applications/Xcode.app/Contents/Developer/usr/bin/stapler",
      }),
    }),
    Object.freeze({
      ref: "BUILD_INFO_DOCUMENT",
      role: "build_info_document",
      expectedKind: "ordinary_file",
      target: Object.freeze({
        kind: "repository_relative",
        value: "dist/BUILD_INFO.json",
      }),
    }),
    Object.freeze({
      ref: "PLATFORM_RELEASE_MANIFEST_DOCUMENT",
      role: "platform_release_manifest_document",
      expectedKind: "ordinary_file",
      target: Object.freeze({
        kind: "repository_relative",
        value: "dist/PLATFORM_RELEASE_MANIFEST.json",
      }),
    }),
  ] as const),
  installerPackageIdentifier: Object.freeze({
    state: "unconfigured",
    publicValue: null,
  }),
  requiredProductionTrustConfiguration: Object.freeze({
    state: "unavailable",
    productionAdmission: "forbidden",
    offlineReleasePublicKeySpkiDerBase64: null,
    signedNativeDistributionCatalog: null,
  }),
});

const POLICY_HASH_SCHEMA =
  "setfarm.platform-release-production-admission-readiness-policy-hash.v2" as const;
const READINESS_HASH_SCHEMA =
  "setfarm.platform-release-production-admission-readiness-hash.v2" as const;
const PATH_OBSERVATION_HASH_SCHEMA =
  "setfarm.platform-release-production-admission-readiness-fixed-path-observation-hash.v2" as const;
const COMMAND_OBSERVATION_HASH_SCHEMA =
  "setfarm.platform-release-production-admission-readiness-command-observation-hash.v2" as const;

const BlockerCodeSchema = z.enum(
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2,
);

const CanonicalUtcTimestampSchema = z.string().regex(
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u,
  "Expected an exact millisecond UTC timestamp",
).refine(
  (value) => {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds)
      && new Date(milliseconds).toISOString() === value;
  },
  "Expected a real exact millisecond UTC timestamp",
);

const CodeSigningIdentityObservationSchema = z.discriminatedUnion("state", [
  z.object({
    validIdentityCount: z.literal(0),
    state: z.literal("not_observed_in_active_search_list"),
  }).strict(),
  z.object({
    validIdentityCount: z.number().int().positive().safe().max(
      PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.maxIdentityCountPerClass,
    ),
    state: z.literal("present_unjoined"),
  }).strict(),
  z.object({
    validIdentityCount: z.null(),
    state: z.literal("observation_failed"),
  }).strict(),
]);

const FixedPathRefSchema = z.enum([
  "INSTALLED_SETFARM_ROOT",
  "INSTALLED_SETFARM_APPLICATION",
  "AUTHENTICATED_SETFARM_HELPER",
]);
const FixedPathStateSchema = z.enum([
  "absent",
  "present_unjoined",
  "unproven",
  "observation_failed",
]);

const FixedPathObservationIdentitySchema = z.object({
  ref: FixedPathRefSchema,
  state: FixedPathStateSchema,
}).strict();

function hashFixedPathObservation(
  value: z.infer<typeof FixedPathObservationIdentitySchema> & {
    observationHash?: string;
  },
): string {
  const observation = { ...value } as Record<string, unknown>;
  delete observation.observationHash;
  return hashCanonicalJson({
    schema: PATH_OBSERVATION_HASH_SCHEMA,
    observation,
  });
}

const FixedPathObservationSchema = FixedPathObservationIdentitySchema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.observationHash !== hashFixedPathObservation(value)) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Fixed-path observation hash mismatch",
    });
  }
});

const CommandStatusSchema = z.enum([
  "completed",
  "spawn_failed",
  "timed_out",
  "output_limit_exceeded",
  "observation_failed",
]);
const CommandSignalSchema = z.enum([
  "SIGABRT",
  "SIGBUS",
  "SIGFPE",
  "SIGHUP",
  "SIGILL",
  "SIGINT",
  "SIGKILL",
  "SIGPIPE",
  "SIGQUIT",
  "SIGSEGV",
  "SIGTERM",
  "SIGTRAP",
]).nullable();
const ExecutableRefSchema = z.enum([
  "CODESIGN",
  "CSRUTIL",
  "LAUNCHCTL",
  "NOTARYTOOL",
  "PKGUTIL",
  "SECURITY",
  "SPCTL",
  "STAPLER",
]);
const ArgvRefSchema = z.enum([
  "CODESIGN_AVAILABILITY",
  "CSRUTIL_AUTHENTICATED_ROOT_STATUS",
  "CSRUTIL_STATUS",
  "LAUNCHCTL_PRINT_AMFI",
  "NOTARYTOOL_AVAILABILITY",
  "PKGUTIL_AVAILABILITY",
  "SECURITY_AVAILABILITY",
  "SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL",
  "SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL",
  "SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL",
  "SECURITY_FIND_IDENTITY_BASIC",
  "SECURITY_FIND_IDENTITY_CODESIGNING",
  "SPCTL_AVAILABILITY",
  "SPCTL_STATUS",
  "STAPLER_AVAILABILITY",
]);

const IdentityCommandResultSchema = z.object({
  kind: z.literal("identity_count"),
  identityClass: z.enum([
    "developer_id_application",
    "developer_id_installer",
  ]),
  validIdentityCount: z.union([
    z.literal(0),
    z.number().int().positive().safe().max(
      PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.maxIdentityCountPerClass,
    ),
    z.null(),
  ]),
  state: z.enum([
    "not_observed_in_active_search_list",
    "present_unjoined",
    "observation_failed",
  ]),
}).strict().superRefine((value, context) => {
  const consistent = value.state === "not_observed_in_active_search_list"
    ? value.validIdentityCount === 0
    : value.state === "present_unjoined"
      ? typeof value.validIdentityCount === "number"
        && value.validIdentityCount > 0
      : value.validIdentityCount === null;
  if (!consistent) {
    context.addIssue({
      code: "custom",
      message: "Identity result state must match its bounded count",
    });
  }
});

const ToolAvailabilityResultSchema = z.object({
  kind: z.literal("tool_availability"),
  tool: z.enum([
    "codesign",
    "notarytool",
    "pkgutil",
    "security",
    "spctl",
    "stapler",
  ]),
  state: z.enum(["available", "unavailable", "observation_failed"]),
}).strict();
const GatekeeperResultSchema = z.object({
  kind: z.literal("gatekeeper"),
  state: z.enum(["enabled", "disabled", "observation_failed"]),
}).strict();
const SipResultSchema = z.object({
  kind: z.literal("sip"),
  state: z.enum(["enabled", "disabled", "observation_failed"]),
}).strict();
const AuthenticatedRootResultSchema = z.object({
  kind: z.literal("authenticated_root"),
  state: z.enum([
    "enabled",
    "disabled",
    "unsupported",
    "observation_failed",
  ]),
}).strict();
const AmfiServiceResultSchema = z.object({
  kind: z.literal("amfi_service"),
  state: z.enum(["running", "not_running", "observation_failed"]),
}).strict();
const NotaryProfileMetadataResultSchema = z.object({
  kind: z.literal("notary_profile_metadata"),
  serviceRef: z.enum([
    "GKE_NOTARY_TOOL",
    "APPLE_NOTARYTOOL",
    "NOTARYTOOL",
  ]),
  state: z.enum(["not_observed", "present_unjoined", "observation_failed"]),
}).strict();

const CommandResultSchema = z.discriminatedUnion("kind", [
  IdentityCommandResultSchema,
  ToolAvailabilityResultSchema,
  GatekeeperResultSchema,
  SipResultSchema,
  AuthenticatedRootResultSchema,
  AmfiServiceResultSchema,
  NotaryProfileMetadataResultSchema,
]);

const CommandObservationIdentitySchema = z.object({
  kind: z.enum([
    "developer_id_application_identity",
    "developer_id_installer_identity",
    "tool_availability",
    "gatekeeper_status",
    "sip_status",
    "authenticated_root_status",
    "amfi_service_status",
    "notary_profile_metadata",
  ]),
  executableRef: ExecutableRefSchema,
  argvRef: ArgvRefSchema,
  status: CommandStatusSchema,
  exitCode: z.number().int().safe().nullable(),
  signal: CommandSignalSchema,
  projectionByteLength: z.number().int().nonnegative().max(
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.redactedProjectionByteCap,
  ),
  result: CommandResultSchema,
}).strict();

function hashCommandObservation(
  value: z.infer<typeof CommandObservationIdentitySchema> & {
    observationHash?: string;
  },
): string {
  const observation = { ...value } as Record<string, unknown>;
  delete observation.observationHash;
  return hashCanonicalJson({
    schema: COMMAND_OBSERVATION_HASH_SCHEMA,
    observation,
  });
}

const EXPECTED_COMMAND_ARGV_REFS = Object.freeze(
  PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.commandPlan.map(
    ({ argvRef }) => argvRef,
  ),
);

const CommandObservationSchema = CommandObservationIdentitySchema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.observationHash !== hashCommandObservation(value)) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Command observation hash mismatch",
    });
  }
  const expectedProjectionByteLength = Buffer.byteLength(
    canonicalJsonStringify(value.result),
    "utf8",
  );
  if (value.projectionByteLength !== expectedProjectionByteLength) {
    context.addIssue({
      code: "custom",
      path: ["projectionByteLength"],
      message: "Command projection byte length must match its canonical redacted result",
    });
  }
  if (value.status === "completed") {
    if (value.exitCode === null || value.signal !== null) {
      context.addIssue({
        code: "custom",
        message: "Completed command observations require an exit code and no signal",
      });
    }
  } else if (value.status === "spawn_failed" && (value.exitCode !== null || value.signal !== null)) {
    context.addIssue({
      code: "custom",
      message: "Spawn failures cannot have an exit code or signal",
    });
  }
  if (value.status !== "completed" && value.result.state !== "observation_failed") {
    context.addIssue({
      code: "custom",
      path: ["result"],
      message: "Every non-completed command requires an observation-failed result",
    });
  }

  const binding = PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
    .commandPlan.find(({ argvRef }) => argvRef === value.argvRef);
  if (
    binding === undefined
    || value.kind !== binding.kind
    || value.executableRef !== binding.executableRef
    || value.result.kind !== binding.result.kind
  ) {
    context.addIssue({ code: "custom", message: "Code-owned command binding mismatch" });
    return;
  }
  if (
    "identityClass" in binding.result
    && value.result.kind === "identity_count"
    && value.result.identityClass !== binding.result.identityClass
  ) {
    context.addIssue({ code: "custom", message: "Identity command class mismatch" });
  }
  if (
    "tool" in binding.result
    && value.result.kind === "tool_availability"
    && value.result.tool !== binding.result.tool
  ) {
    context.addIssue({ code: "custom", message: "Tool command binding mismatch" });
  }
  if (
    "serviceRef" in binding.result
    && value.result.kind === "notary_profile_metadata"
    && value.result.serviceRef !== binding.result.serviceRef
  ) {
    context.addIssue({ code: "custom", message: "Notary profile command binding mismatch" });
  }

  let terminalSemanticsMatch = true;
  if (value.status === "completed") {
    if (binding.execution === "fixed_path") {
      terminalSemanticsMatch = value.result.kind === "tool_availability"
        && value.result.state === "available"
        && value.exitCode === 0;
    } else if (value.result.state !== "observation_failed") {
      if (value.result.kind === "notary_profile_metadata") {
        terminalSemanticsMatch = value.result.state === "present_unjoined"
          ? value.exitCode === 0
          : value.result.state === "not_observed" && value.exitCode === 44;
      } else if (value.result.kind === "tool_availability") {
        terminalSemanticsMatch = value.result.state === "available"
          ? value.exitCode === 0
          : value.result.state === "unavailable"
            && value.exitCode !== null
            && value.exitCode !== 0;
      } else if (value.result.kind === "amfi_service") {
        terminalSemanticsMatch = value.result.state === "running"
          && value.exitCode === 0;
      } else {
        terminalSemanticsMatch = value.exitCode === 0;
      }
    }
  }
  if (!terminalSemanticsMatch) {
    context.addIssue({
      code: "custom",
      message: "Command terminal state must match its code-owned result semantic",
    });
  }
});

const CommonReceiptShape = {
  schema: z.literal(PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_V2_SCHEMA),
  version: z.literal("2.0.0"),
  authorityState: z.literal("diagnostic_observation_only"),
  admissionScope: z.literal("production_host_readiness_observation"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("blocked"),
  trustConclusion: z.literal("characterization_only"),
  policyHash: Sha256Schema,
  observedAt: CanonicalUtcTimestampSchema,
  blockerCodes: z.array(BlockerCodeSchema).min(1).max(
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.maxBlockerCodes,
  ),
  readinessHash: Sha256Schema,
};

const DarwinReceiptSchema = z.object({
  ...CommonReceiptShape,
  observedPlatform: z.literal("darwin"),
  codeSigning: z.object({
    developerIdApplication: CodeSigningIdentityObservationSchema,
    developerIdInstaller: CodeSigningIdentityObservationSchema,
  }).strict(),
  notarization: z.object({
    toolAvailability: z.enum(["available", "unavailable", "observation_failed"]),
    knownProfileMetadata: z.enum([
      "not_observed_at_known_service_names",
      "present_unjoined",
      "observation_failed",
    ]),
    credentialReadiness: z.literal(
      "unverifiable_without_external_credential_configuration",
    ),
    ticketEvidence: z.enum([
      "not_observed_without_exact_distribution",
      "unproven",
      "observation_failed",
    ]),
  }).strict(),
  hostEnforcement: z.object({
    gatekeeper: z.enum(["enabled", "disabled", "observation_failed"]),
    sip: z.enum(["enabled", "disabled", "observation_failed"]),
    authenticatedRoot: z.enum([
      "enabled",
      "disabled",
      "unsupported",
      "observation_failed",
    ]),
    amfiService: z.enum(["running", "not_running", "observation_failed"]),
    amfiRuntimeAdmission: z.literal(
      "unavailable_requires_authenticated_running_helper",
    ),
  }).strict(),
  installedDistribution: z.object({
    expectedRoots: z.array(FixedPathObservationSchema).min(1).max(8),
    expectedHelpers: z.array(FixedPathObservationSchema).min(1).max(8),
    installerPackageIdentifier: z.enum([
      "unconfigured",
      "configured_public_value_unjoined",
    ]),
    installerReceipt: z.enum([
      "not_observed_configuration_unavailable",
      "not_observed",
      "present_unjoined",
      "observation_failed",
    ]),
    exactPayloadBinding: z.enum(["absent", "unproven"]),
  }).strict().superRefine((value, context) => {
    const expectedRootRefs = PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
      .fixedPathPlan
      .filter(({ role }) => role === "installed_root")
      .map(({ ref }) => ref);
    const expectedHelperRefs = PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
      .fixedPathPlan
      .filter(({ role }) => role === "installed_helper")
      .map(({ ref }) => ref);
    if (
      value.expectedRoots.length !== expectedRootRefs.length
      || value.expectedHelpers.length !== expectedHelperRefs.length
      || value.expectedRoots.some(({ ref }, index) => ref !== expectedRootRefs[index])
      || value.expectedHelpers.some(({ ref }, index) => ref !== expectedHelperRefs[index])
    ) {
      context.addIssue({
        code: "custom",
        message: "Fixed-path observation references must equal the exact policy tuple",
      });
    }
    if (value.installerPackageIdentifier !== "unconfigured") {
      context.addIssue({
        code: "custom",
        path: ["installerPackageIdentifier"],
        message: "Production Installer package identifier remains unconfigured",
      });
    }
    if (
      value.installerPackageIdentifier === "unconfigured"
      && value.installerReceipt !== "not_observed_configuration_unavailable"
    ) {
      context.addIssue({
        code: "custom",
        path: ["installerReceipt"],
        message: "Receipt lookup is forbidden without a configured package identifier",
      });
    }
  }),
  productionTrustConfiguration: z.object({
    state: z.literal(
      PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
        .requiredProductionTrustConfiguration.state,
    ),
    productionAdmission: z.literal(
      PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2
        .requiredProductionTrustConfiguration.productionAdmission,
    ),
  }).strict(),
  buildProvenance: z.object({
    state: z.enum([
      "v1_build_provenance_only",
      "missing",
      "invalid",
      "observation_failed",
    ]),
    platformReleaseAuthority: z.literal(false),
  }).strict(),
  commandObservations: z.array(CommandObservationSchema).max(
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2.maxCommandObservations,
  ),
}).strict().superRefine((value, context) => {
  const observedArgvRefs = value.commandObservations.map(({ argvRef }) => argvRef);
  const uniqueArgvRefs = new Set(observedArgvRefs);
  const exactCommands = observedArgvRefs.length === EXPECTED_COMMAND_ARGV_REFS.length
    && uniqueArgvRefs.size === observedArgvRefs.length
    && EXPECTED_COMMAND_ARGV_REFS.every((argvRef) => uniqueArgvRefs.has(argvRef));
  if (!exactCommands) {
    context.addIssue({
      code: "custom",
      path: ["commandObservations"],
      message: "Receipt requires the exact command observation set with unique code-owned references",
    });
    return;
  }

  const byArgvRef = new Map(
    value.commandObservations.map((observation) => [observation.argvRef, observation]),
  );
  const applicationIdentity = byArgvRef.get(
    "SECURITY_FIND_IDENTITY_CODESIGNING",
  )!.result;
  const installerIdentity = byArgvRef.get(
    "SECURITY_FIND_IDENTITY_BASIC",
  )!.result;
  if (
    applicationIdentity.kind !== "identity_count"
    || installerIdentity.kind !== "identity_count"
    || applicationIdentity.validIdentityCount
      !== value.codeSigning.developerIdApplication.validIdentityCount
    || applicationIdentity.state
      !== value.codeSigning.developerIdApplication.state
    || installerIdentity.validIdentityCount
      !== value.codeSigning.developerIdInstaller.validIdentityCount
    || installerIdentity.state
      !== value.codeSigning.developerIdInstaller.state
  ) {
    context.addIssue({
      code: "custom",
      path: ["codeSigning"],
      message: "Code-signing summary must equal the independent identity command results",
    });
  }

  const notarytool = byArgvRef.get("NOTARYTOOL_AVAILABILITY")!.result;
  const profileResults = [
    byArgvRef.get("SECURITY_FIND_GENERIC_PASSWORD_GKE_NOTARY_TOOL")!.result,
    byArgvRef.get("SECURITY_FIND_GENERIC_PASSWORD_NOTARYTOOL")!.result,
    byArgvRef.get("SECURITY_FIND_GENERIC_PASSWORD_NOTARY_TOOL")!.result,
  ];
  const validProfileResults = profileResults.every(
    (result) => result.kind === "notary_profile_metadata",
  );
  const profileStates = validProfileResults
    ? profileResults.map((result) => result.state)
    : [];
  const expectedProfileSummary = profileStates.includes("observation_failed")
    ? "observation_failed"
    : profileStates.includes("present_unjoined")
      ? "present_unjoined"
      : "not_observed_at_known_service_names";
  if (
    notarytool.kind !== "tool_availability"
    || notarytool.tool !== "notarytool"
    || notarytool.state !== value.notarization.toolAvailability
    || !validProfileResults
    || expectedProfileSummary !== value.notarization.knownProfileMetadata
  ) {
    context.addIssue({
      code: "custom",
      path: ["notarization"],
      message: "Notarization summary must equal tool and known-profile command results",
    });
  }

  const hostBindings = [
    ["SPCTL_STATUS", "gatekeeper", value.hostEnforcement.gatekeeper],
    ["CSRUTIL_STATUS", "sip", value.hostEnforcement.sip],
    [
      "CSRUTIL_AUTHENTICATED_ROOT_STATUS",
      "authenticated_root",
      value.hostEnforcement.authenticatedRoot,
    ],
    ["LAUNCHCTL_PRINT_AMFI", "amfi_service", value.hostEnforcement.amfiService],
  ] as const;
  if (hostBindings.some(([argvRef, resultKind, state]) => {
    const result = byArgvRef.get(argvRef)!.result;
    return result.kind !== resultKind || result.state !== state;
  })) {
    context.addIssue({
      code: "custom",
      path: ["hostEnforcement"],
      message: "Host-enforcement summary must equal the fixed command results",
    });
  }

  const pathStates = [
    ...value.installedDistribution.expectedRoots,
    ...value.installedDistribution.expectedHelpers,
  ].map(({ state }) => state);
  const expectedTicketEvidence = pathStates.includes("observation_failed")
    ? "observation_failed"
    : pathStates.every((state) => state === "present_unjoined")
      ? "unproven"
      : "not_observed_without_exact_distribution";
  const expectedPayloadBinding = pathStates.includes("absent")
    ? "absent"
    : "unproven";
  if (
    value.notarization.ticketEvidence !== expectedTicketEvidence
    || value.installedDistribution.exactPayloadBinding !== expectedPayloadBinding
  ) {
    context.addIssue({
      code: "custom",
      path: ["installedDistribution"],
      message: "Path-derived ticket and exact-payload summaries must match the fixed paths",
    });
  }
});

const UnsupportedSectionSchema = z.object({
  state: z.literal("not_observed_platform_unsupported"),
}).strict();

const UnsupportedReceiptSchema = z.object({
  ...CommonReceiptShape,
  observedPlatform: z.literal("unsupported"),
  codeSigning: UnsupportedSectionSchema,
  notarization: UnsupportedSectionSchema,
  hostEnforcement: UnsupportedSectionSchema,
  installedDistribution: UnsupportedSectionSchema,
  productionTrustConfiguration: z.object({
    state: z.literal("not_observed_platform_unsupported"),
    productionAdmission: z.literal("forbidden"),
  }).strict(),
  buildProvenance: UnsupportedSectionSchema,
  commandObservations: z.tuple([]),
}).strict();

const HARD_CODED_UNAVAILABLE_CONFIGURATION_BLOCKERS = Object.freeze([
  "DEVELOPER_ID_TEAM_UNCONFIGURED",
  "DESIGNATED_REQUIREMENT_UNCONFIGURED",
  "INSTALLER_PACKAGE_ID_UNCONFIGURED",
  "OFFLINE_RELEASE_PUBLIC_KEY_UNCONFIGURED",
  "SIGNED_NATIVE_DISTRIBUTION_CATALOG_EMPTY",
] as const);
const UNCONDITIONAL_FUTURE_AUTHORITY_BLOCKERS = Object.freeze([
  "PREPARED_RELEASE_STORE_AUTHORITY_UNAVAILABLE",
  "FRESH_VERIFIER_AUTHORITY_UNAVAILABLE",
  "REGISTRY_V2_ACTIVATION_AUTHORITY_UNAVAILABLE",
] as const);

type ParsedDarwinReceipt = z.infer<typeof DarwinReceiptSchema>;
type ParsedUnsupportedReceipt = z.infer<typeof UnsupportedReceiptSchema>;
type ParsedReceipt = ParsedDarwinReceipt | ParsedUnsupportedReceipt;
type BlockerCode = z.infer<typeof BlockerCodeSchema>;

function deriveBlockers(value: ParsedReceipt): BlockerCode[] {
  const blockers = new Set<BlockerCode>(HARD_CODED_UNAVAILABLE_CONFIGURATION_BLOCKERS);
  for (const blocker of UNCONDITIONAL_FUTURE_AUTHORITY_BLOCKERS) blockers.add(blocker);

  if (value.observedPlatform === "unsupported") {
    blockers.add("PLATFORM_UNSUPPORTED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
    return PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2.filter(
      (blocker) => blockers.has(blocker),
    );
  }

  const identities = value.codeSigning;
  if (identities.developerIdApplication.state === "not_observed_in_active_search_list") {
    blockers.add("DEVELOPER_ID_APPLICATION_IDENTITY_NOT_OBSERVED");
  }
  if (identities.developerIdInstaller.state === "not_observed_in_active_search_list") {
    blockers.add("DEVELOPER_ID_INSTALLER_IDENTITY_NOT_OBSERVED");
  }
  if (
    identities.developerIdApplication.state === "observation_failed"
    || identities.developerIdInstaller.state === "observation_failed"
  ) {
    blockers.add("CODE_SIGNING_IDENTITY_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }

  if (value.notarization.toolAvailability === "unavailable") {
    blockers.add("NOTARYTOOL_UNAVAILABLE");
  } else if (value.notarization.toolAvailability === "observation_failed") {
    blockers.add("NOTARYTOOL_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  blockers.add("NOTARY_CREDENTIAL_CONFIGURATION_UNVERIFIABLE");
  blockers.add("NOTARIZED_DISTRIBUTION_UNPROVEN");
  if (
    value.notarization.knownProfileMetadata === "observation_failed"
    || value.notarization.ticketEvidence === "observation_failed"
  ) blockers.add("HOST_OBSERVATION_INCOMPLETE");

  if (value.hostEnforcement.gatekeeper === "disabled") {
    blockers.add("GATEKEEPER_DISABLED");
  } else if (value.hostEnforcement.gatekeeper === "observation_failed") {
    blockers.add("GATEKEEPER_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  if (value.hostEnforcement.sip === "disabled") {
    blockers.add("SIP_DISABLED");
  } else if (value.hostEnforcement.sip === "observation_failed") {
    blockers.add("SIP_OBSERVATION_FAILED");
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  if (value.hostEnforcement.authenticatedRoot !== "enabled") {
    blockers.add("AUTHENTICATED_ROOT_DISABLED_OR_UNAVAILABLE");
    if (value.hostEnforcement.authenticatedRoot === "observation_failed") {
      blockers.add("HOST_OBSERVATION_INCOMPLETE");
    }
  }
  if (value.hostEnforcement.amfiService !== "running") {
    blockers.add("AMFI_SERVICE_UNAVAILABLE");
    if (value.hostEnforcement.amfiService === "observation_failed") {
      blockers.add("HOST_OBSERVATION_INCOMPLETE");
    }
  }
  blockers.add("AUTHENTICATED_RUNNING_HELPER_ABSENT");
  blockers.add("AMFI_RUNTIME_ADMISSION_UNPROVEN");

  const distribution = value.installedDistribution;
  if (
    distribution.installerPackageIdentifier === "unconfigured"
    || distribution.installerReceipt === "not_observed_configuration_unavailable"
  ) blockers.add("INSTALLER_RECEIPT_UNOBSERVED_CONFIGURATION_UNAVAILABLE");
  if (distribution.expectedRoots.some(({ state }) => state === "absent")) {
    blockers.add("INSTALLED_SETFARM_ROOT_ABSENT");
  }
  if (distribution.expectedHelpers.some(({ state }) => state === "absent")) {
    blockers.add("INSTALLED_HELPER_ABSENT");
  }
  blockers.add("EXACT_INSTALLED_PAYLOAD_BINDING_UNPROVEN");
  if (
    distribution.installerReceipt === "observation_failed"
    || [...distribution.expectedRoots, ...distribution.expectedHelpers].some(
      ({ state }) => state === "observation_failed",
    )
  ) blockers.add("HOST_OBSERVATION_INCOMPLETE");

  if (value.productionTrustConfiguration.state === "unavailable") {
    blockers.add("PRODUCTION_TRUST_CONFIGURATION_UNAVAILABLE");
  }
  blockers.add("V2_PLATFORM_RELEASE_MANIFEST_AUTHORITY_UNAVAILABLE");
  if (value.buildProvenance.state === "observation_failed") {
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }
  if (value.commandObservations.some(
    ({ status, result }) => status !== "completed"
      || result.state === "observation_failed",
  )) {
    blockers.add("HOST_OBSERVATION_INCOMPLETE");
  }

  return PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_BLOCKER_ORDER_V2.filter(
    (blocker) => blockers.has(blocker),
  );
}

function hashPolicy(): string {
  return hashCanonicalJson({
    schema: POLICY_HASH_SCHEMA,
    policy: PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_POLICY_V2,
  });
}

function hashReadiness(value: ParsedReceipt): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.readinessHash;
  return hashCanonicalJson({ schema: READINESS_HASH_SCHEMA, receipt });
}

const PlatformReleaseProductionAdmissionReadinessV2Schema =
  z.discriminatedUnion("observedPlatform", [
    DarwinReceiptSchema,
    UnsupportedReceiptSchema,
  ]).superRefine((value, context) => {
    if (value.policyHash !== hashPolicy()) {
      context.addIssue({
        code: "custom",
        path: ["policyHash"],
        message: "Production admission readiness policy hash mismatch",
      });
    }

    const expectedBlockers = deriveBlockers(value);
    const uniqueBlockers = new Set(value.blockerCodes);
    if (
      uniqueBlockers.size !== value.blockerCodes.length
      || expectedBlockers.length !== value.blockerCodes.length
      || expectedBlockers.some((blocker, index) => blocker !== value.blockerCodes[index])
      || value.blockerCodes.length === 0
      || UNCONDITIONAL_FUTURE_AUTHORITY_BLOCKERS.some(
        (blocker) => !uniqueBlockers.has(blocker),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["blockerCodes"],
        message: "Blocker codes must exactly match the unique code-owned order",
      });
    }

    if (value.readinessHash !== hashReadiness(value)) {
      context.addIssue({
        code: "custom",
        path: ["readinessHash"],
        message: "Production admission readiness hash mismatch",
      });
    }
  });

type DeepReadonlyJson<T> = T extends readonly (infer Element)[]
  ? readonly DeepReadonlyJson<Element>[]
  : T extends object
    ? { readonly [Key in keyof T]: DeepReadonlyJson<T[Key]> }
    : T;

export type PlatformReleaseProductionAdmissionReadinessV2 = DeepReadonlyJson<
  z.infer<typeof PlatformReleaseProductionAdmissionReadinessV2Schema>
>;

export function canonicalPlatformReleaseProductionAdmissionReadinessV2(
  receipt: PlatformReleaseProductionAdmissionReadinessV2,
): string {
  return canonicalJsonStringify(receipt);
}

/** @internal */
export function parsePlatformReleaseProductionAdmissionReadinessCandidateForInternalUseV2(
  candidate: unknown,
): PlatformReleaseProductionAdmissionReadinessV2 {
  let snapshot: unknown;
  try {
    snapshot = boundedPlatformReleaseJsonSnapshotV2(
      candidate,
      PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2,
    );
  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && typeof error.code === "string"
      && error.code.startsWith("CANONICAL_JSON_")
    ) {
      error.message = `${error.code}: ${error.message}`;
    }
    throw error;
  }
  const parsed = PlatformReleaseProductionAdmissionReadinessV2Schema.parse(snapshot);
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    parsed,
    PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_MAX_CANONICAL_BYTES_V2,
  )) {
    throw new Error(
      "PLATFORM_RELEASE_PRODUCTION_ADMISSION_READINESS_CANONICAL_LIMIT_EXCEEDED",
    );
  }
  return deepFreezePlatformReleaseJsonV2(parsed);
}
