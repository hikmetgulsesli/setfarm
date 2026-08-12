import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA =
  "setfarm.network-negative-probe-receipt.v2" as const;
export const NETWORK_ISOLATION_NEGATIVE_PROBE_V2_MAX_CANONICAL_BYTES =
  64 * 1024;
export const NETWORK_ISOLATION_NEGATIVE_PROBE_TIMEOUT_MS_V2 = 5_000;
export const NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2 =
  64 * 1024;
export const NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_REF_V2 =
  "PROGRAM_NETWORK_ISOLATION_NEGATIVE_PROBE_V2" as const;

export const NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2 = Object.freeze([
  "CI",
  "HOME",
  "HOST",
  "LANG",
  "LC_ALL",
  "NO_COLOR",
  "PORT",
  "RUNTIME_URL",
  "RUN_CACHE_DIR",
  "RUN_HOME",
  "RUN_TMPDIR",
  "TEMP",
  "TMP",
  "TMPDIR",
  "TZ",
] as const);

const NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_IDENTITY_V2 = Object.freeze({
  CI: "true",
  HOME: "RUN_HOME",
  HOST: "127.0.0.1",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  NO_COLOR: "1",
  PORT: "EPHEMERAL_LOOPBACK_PORT",
  RUNTIME_URL: "EPHEMERAL_LOOPBACK_ORIGIN",
  RUN_CACHE_DIR: "RUN_CACHE_DIR",
  RUN_HOME: "RUN_HOME",
  RUN_TMPDIR: "RUN_TMPDIR",
  TEMP: "RUN_TMPDIR",
  TMP: "RUN_TMPDIR",
  TMPDIR: "RUN_TMPDIR",
  TZ: "UTC",
} as const);

export const NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2 =
  hashCanonicalJson({
    schema: "setfarm.network-isolation-normalized-environment-hash.v2",
    environment: NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_IDENTITY_V2,
  });

const EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const NETWORK_ISOLATION_NEGATIVE_PROBE_ABI_IDENTITY_V2 = Object.freeze({
  schema: "setfarm.network-negative-probe-receipt-abi-policy.v2" as const,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  receiptSchema: NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA,
  maxCanonicalBytes: NETWORK_ISOLATION_NEGATIVE_PROBE_V2_MAX_CANONICAL_BYTES,
  timeoutMs: NETWORK_ISOLATION_NEGATIVE_PROBE_TIMEOUT_MS_V2,
  maxStdoutBytes: NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2,
  maxStderrBytes: NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2,
  networkPolicy: "deny_all_outbound_except_exact_loopback" as const,
  redirectPolicy: "observe_3xx_and_never_follow" as const,
  ambientEnvironmentPolicy:
    "deny_all_then_exact_set_remove_known_macos_injection" as const,
  normalizedEnvironmentNames: NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2,
  probeClosure: Object.freeze([
    "dns_resolution_denied",
    "exact_loopback_round_trip",
    "external_address_connect_denied",
    "redirect_observed_without_follow",
  ] as const),
  lifecyclePolicy: "normal_exit_zero_bounded_output" as const,
});

export const NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2 =
  hashCanonicalJson({
    schema: "setfarm.network-negative-probe-receipt-abi-policy-hash.v2",
    policy: NETWORK_ISOLATION_NEGATIVE_PROBE_ABI_IDENTITY_V2,
  });

export function networkIsolationNegativeProbeReceiptSchemaHashV2(): string {
  return NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2;
}

const ExactUtcMillisecondTimestampV2Schema = z.string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u,
    "Expected one exact UTC millisecond timestamp",
  )
  .refine((value) => {
    const milliseconds = Date.parse(value);
    return !Number.isNaN(milliseconds)
      && new Date(milliseconds).toISOString() === value;
  }, {
    message: "Expected one valid round-tripping UTC timestamp",
  });

const BoundedOutputIdentityV2Schema = z.object({
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative()
    .max(NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2),
}).strict();

export const NetworkIsolationProbeSetV2Schema = z.object({
  loopback: z.object({
    status: z.literal("passed"),
    host: z.literal("127.0.0.1"),
    requestNonceHash: Sha256Schema,
    responseNonceHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.requestNonceHash !== value.responseNonceHash) {
      context.addIssue({
        code: "custom",
        path: ["responseNonceHash"],
        message: "Loopback response must echo the exact one-use request nonce",
      });
    }
  }),
  dns: z.object({
    status: z.literal("denied"),
    hostname: z.literal("example.com"),
    errorCode: z.enum(["EACCES", "EAI_AGAIN", "ENOTFOUND", "EPERM"]),
  }).strict(),
  outbound: z.object({
    status: z.literal("denied"),
    host: z.literal("198.51.100.1"),
    port: z.literal(9),
    errorCode: z.enum(["EACCES", "EPERM"]),
  }).strict(),
  redirect: z.object({
    status: z.literal("rejected_without_follow"),
    httpStatus: z.literal(302),
    locationHash: Sha256Schema,
    requestCount: z.literal(1),
  }).strict(),
}).strict();

export type NetworkIsolationProbeSetV2 = z.infer<
  typeof NetworkIsolationProbeSetV2Schema
>;

export function hashNetworkIsolationProbeSetV2(
  probes: NetworkIsolationProbeSetV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.network-isolation-negative-probe-set-hash.v2",
    probes,
  });
}

const NetworkIsolationNegativeProbeReceiptIdentityV2Schema = z.object({
  schema: z.literal(NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_unverified_release_candidate"),
  productionUse: z.literal("forbidden_until_verified_release_join"),
  admissionScope: z.enum(["production_host", "test_fixture"]),
  releaseCandidate: z.object({
    platformTreeHash: Sha256Schema,
    runtimePayloadHash: Sha256Schema,
  }).strict(),
  implementation: z.object({
    enforcementRef: z.literal("ENV_SANDBOX_MACOS_V2"),
    wrapperModuleLocator: z.literal("dist/execution/network-sandbox-v2.js"),
    wrapperExport: z.literal("runNetworkIsolatedV2"),
    wrapperModuleHash: Sha256Schema,
    sandboxExecutableRef: z.literal("EXEC_MACOS_SANDBOX_EXEC_V2"),
    sandboxExecutableHash: Sha256Schema,
    nodeExecutableRef: z.literal("EXEC_NODE_RUNTIME_V2"),
    nodeExecutableHash: Sha256Schema,
    canonicalProfileHash: Sha256Schema,
    hostRuntimeIdentityHash: Sha256Schema,
    probeProgramRef: z.literal(NETWORK_ISOLATION_NEGATIVE_PROBE_PROGRAM_REF_V2),
    probeProgramHash: Sha256Schema,
    receiptSchemaHash: z.literal(
      NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
    ),
  }).strict(),
  environment: z.object({
    constructionPolicy: z.literal("deny_all_then_exact_set"),
    inheritAmbientEnvironment: z.literal(false),
    shell: z.literal("forbidden"),
    knownOsInjectedVariableNames: z.tuple([
      z.literal("__CF_USER_TEXT_ENCODING"),
    ]),
    osInjectionDisposition: z.literal("removed_before_probe_or_candidate_import"),
    normalizedVariableNames: z.tuple(
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_NAMES_V2.map((name) =>
        z.literal(name)) as [
          z.ZodLiteral<"CI">,
          z.ZodLiteral<"HOME">,
          z.ZodLiteral<"HOST">,
          z.ZodLiteral<"LANG">,
          z.ZodLiteral<"LC_ALL">,
          z.ZodLiteral<"NO_COLOR">,
          z.ZodLiteral<"PORT">,
          z.ZodLiteral<"RUNTIME_URL">,
          z.ZodLiteral<"RUN_CACHE_DIR">,
          z.ZodLiteral<"RUN_HOME">,
          z.ZodLiteral<"RUN_TMPDIR">,
          z.ZodLiteral<"TEMP">,
          z.ZodLiteral<"TMP">,
          z.ZodLiteral<"TMPDIR">,
          z.ZodLiteral<"TZ">,
        ],
    ),
    normalizedEnvironmentHash: z.literal(
      NETWORK_ISOLATION_NORMALIZED_ENVIRONMENT_HASH_V2,
    ),
  }).strict(),
  attemptNonceHash: Sha256Schema,
  startedAt: ExactUtcMillisecondTimestampV2Schema,
  finishedAt: ExactUtcMillisecondTimestampV2Schema,
  durationMs: z.number().int().nonnegative()
    .max(NETWORK_ISOLATION_NEGATIVE_PROBE_TIMEOUT_MS_V2),
  process: z.object({
    pid: z.number().int().positive(),
    termination: z.literal("normal_exit"),
    exitCode: z.literal(0),
    signal: z.null(),
    stdout: BoundedOutputIdentityV2Schema.extend({
      byteLength: z.number().int().positive()
        .max(NETWORK_ISOLATION_NEGATIVE_PROBE_MAX_OUTPUT_BYTES_V2),
    }).strict(),
    stderr: z.object({
      contentHash: z.literal(EMPTY_SHA256_V2),
      byteLength: z.literal(0),
    }).strict(),
  }).strict(),
  probes: NetworkIsolationProbeSetV2Schema,
  probeSetHash: Sha256Schema,
}).strict();

export type NetworkIsolationNegativeProbeReceiptHashPayloadV2 = z.infer<
  typeof NetworkIsolationNegativeProbeReceiptIdentityV2Schema
>;

export function hashNetworkIsolationNegativeProbeReceiptV2(
  value:
    | NetworkIsolationNegativeProbeReceiptHashPayloadV2
    | NetworkIsolationNegativeProbeReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.network-negative-probe-receipt-hash.v2",
    receipt,
  });
}

export const NetworkIsolationNegativeProbeReceiptV2Schema =
  NetworkIsolationNegativeProbeReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const started = Date.parse(value.startedAt);
    const finished = Date.parse(value.finishedAt);
    if (finished < started || finished - started !== value.durationMs) {
      context.addIssue({
        code: "custom",
        path: ["durationMs"],
        message: "Network probe duration must equal the exact UTC interval",
      });
    }
    if (value.probeSetHash !== hashNetworkIsolationProbeSetV2(value.probes)) {
      context.addIssue({
        code: "custom",
        path: ["probeSetHash"],
        message: "Network probe-set hash must bind every-and-only typed probe",
      });
    }
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      NETWORK_ISOLATION_NEGATIVE_PROBE_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message: `Network probe receipt exceeds ${NETWORK_ISOLATION_NEGATIVE_PROBE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.receiptHash !== hashNetworkIsolationNegativeProbeReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Network probe receipt hash must bind the exact observation",
      });
    }
  });

export type NetworkIsolationNegativeProbeReceiptV2 = z.infer<
  typeof NetworkIsolationNegativeProbeReceiptV2Schema
>;

export function parseNetworkIsolationNegativeProbeReceiptV2(
  input: unknown,
): NetworkIsolationNegativeProbeReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    NETWORK_ISOLATION_NEGATIVE_PROBE_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    NetworkIsolationNegativeProbeReceiptV2Schema.parse(snapshot),
  );
}
