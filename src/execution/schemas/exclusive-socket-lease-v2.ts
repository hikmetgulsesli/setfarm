import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleasePortableLocatorV2Schema,
  PlatformReleaseStableReferenceV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  ProcessIdentityV1Schema,
  type ProcessIdentityV1,
} from "./process-identity-v1.js";

export const EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA =
  "setfarm.exclusive-socket-lease.v2" as const;
export const SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA =
  "setfarm.socket-handoff-acknowledgement.v2" as const;
export const SERVICE_READINESS_RECEIPT_V2_SCHEMA =
  "setfarm.service-readiness-receipt.v2" as const;
export const SOCKET_CLEANUP_RECEIPT_V2_SCHEMA =
  "setfarm.socket-cleanup-receipt.v2" as const;
export const SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES = 64 * 1024;
export const SOCKET_HANDOFF_TIMEOUT_MS_V2 = 5_000;
export const SOCKET_READINESS_TIMEOUT_MS_V2 = 5_000;
export const SOCKET_CLEANUP_TIMEOUT_MS_V2 = 5_000;
export const SOCKET_READINESS_MAX_RESPONSE_BYTES_V2 = 4 * 1024;

export const EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_V2 = Object.freeze({
  schema: "setfarm.exclusive-socket-port-bands-policy.v2" as const,
  host: "127.0.0.1" as const,
  transport: "tcp" as const,
  bands: Object.freeze({
    httpService: Object.freeze({
      base: 6_100,
      maximum: 6_999,
      size: 900,
    }),
  }),
  fetchUnsafePortsInBands: Object.freeze([
    6_566,
    6_665,
    6_666,
    6_667,
    6_668,
    6_669,
    6_697,
  ] as const),
  selection: "deterministic_offset_then_linear_exclusive_bind" as const,
  reservation: "held_socket_never_check_then_close" as const,
});

export const EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.exclusive-socket-port-bands-policy-hash.v2",
  policy: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_V2,
});

const SOCKET_LIFECYCLE_ABI_POLICY_V2 = Object.freeze({
  schema: "setfarm.exclusive-socket-lifecycle-abi-policy.v2" as const,
  version: PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  receipts: Object.freeze({
    lease: EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA,
    handoff: SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA,
    readiness: SERVICE_READINESS_RECEIPT_V2_SCHEMA,
    cleanup: SOCKET_CLEANUP_RECEIPT_V2_SCHEMA,
  }),
  stateTransitions: Object.freeze([
    "unbound_to_bound",
    "bound_to_sent",
    "sent_to_acknowledged",
    "acknowledged_to_ready",
    "ready_to_closed",
  ] as const),
  descriptorPolicy: "private_held_server_and_raw_descriptor" as const,
  parentRetentionPolicy:
    "retain_through_send_callback_until_authenticated_child_ack" as const,
  handoffTransport: "node_ipc_server_handle" as const,
  childExecArgv: Object.freeze([] as const),
  ambientParentExecArgv: "forbidden" as const,
  sendCallbackAuthority: "forbidden" as const,
  candidateListenAuthority: "forbidden" as const,
  readinessAuthority:
    "parent_closed_then_one_use_nonce_http_and_child_observation" as const,
  cleanupAuthority:
    "authenticated_child_close_then_exact_exclusive_rebind_probe" as const,
  handoffTimeoutMs: SOCKET_HANDOFF_TIMEOUT_MS_V2,
  readinessTimeoutMs: SOCKET_READINESS_TIMEOUT_MS_V2,
  cleanupTimeoutMs: SOCKET_CLEANUP_TIMEOUT_MS_V2,
  readinessMaxResponseBytes: SOCKET_READINESS_MAX_RESPONSE_BYTES_V2,
  portBandsHash: EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2,
});

export const EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2 = hashCanonicalJson({
  schema: "setfarm.exclusive-socket-lifecycle-abi-policy-hash.v2",
  policy: SOCKET_LIFECYCLE_ABI_POLICY_V2,
});

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

const ObservedProcessIdentityV2Schema = ProcessIdentityV1Schema.extend({
  source: z.literal("observed_os"),
}).strict();

export function hashSocketProcessIdentityV2(
  identity: ProcessIdentityV1,
): string {
  return hashCanonicalJson({
    schema: "setfarm.socket-process-identity-hash.v2",
    identity,
  });
}

export const ExclusiveSocketEndpointV2Schema = z.object({
  transport: z.literal("tcp"),
  host: z.literal("127.0.0.1"),
  family: z.literal("IPv4"),
  port: z.number().int().min(1).max(65_535),
  exclusive: z.literal(true),
  reusePort: z.literal(false),
}).strict();

export type ExclusiveSocketEndpointV2 = z.infer<
  typeof ExclusiveSocketEndpointV2Schema
>;

const SocketAuthorityDispositionV2Schema = z.object({
  authorityState: z.literal("observed_unverified_release_candidate"),
  productionUse: z.literal("forbidden_until_verified_release_join"),
  admissionScope: z.enum(["production_host", "test_fixture"]),
}).strict();

const ExclusiveSocketLeaseIdentityV2Schema =
  SocketAuthorityDispositionV2Schema.extend({
    schema: z.literal(EXCLUSIVE_SOCKET_LEASE_V2_SCHEMA),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    lifecycleAbiHash: z.literal(EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2),
    portBandsHash: z.literal(EXCLUSIVE_SOCKET_PORT_BANDS_POLICY_HASH_V2),
    allocationPolicy: z.enum([
      "verified_http_service_band_v2",
      "os_ephemeral_test_fixture",
    ]),
    endpoint: ExclusiveSocketEndpointV2Schema,
    allocatorProcess: ObservedProcessIdentityV2Schema,
    allocatorProcessIdentityHash: Sha256Schema,
    attemptNonceHash: Sha256Schema,
    descriptorCapabilityHash: Sha256Schema,
    boundAt: ExactUtcMillisecondTimestampV2Schema,
    stateTransition: z.literal("unbound_to_bound"),
  }).strict();

export type ExclusiveSocketLeaseHashPayloadV2 = z.infer<
  typeof ExclusiveSocketLeaseIdentityV2Schema
>;

export function hashExclusiveSocketLeaseV2(
  value: ExclusiveSocketLeaseHashPayloadV2 | ExclusiveSocketLeaseReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.leaseHash;
  return hashCanonicalJson({
    schema: "setfarm.exclusive-socket-lease-hash.v2",
    receipt,
  });
}

export const ExclusiveSocketLeaseReceiptV2Schema =
  ExclusiveSocketLeaseIdentityV2Schema.extend({
    leaseHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.allocatorProcessIdentityHash
        !== hashSocketProcessIdentityV2(value.allocatorProcess)
    ) {
      context.addIssue({
        code: "custom",
        path: ["allocatorProcessIdentityHash"],
        message: "Socket lease must bind the exact observed allocator process",
      });
    }
    const expectedPolicy = value.admissionScope === "test_fixture"
      ? "os_ephemeral_test_fixture"
      : "verified_http_service_band_v2";
    if (value.allocationPolicy !== expectedPolicy) {
      context.addIssue({
        code: "custom",
        path: ["allocationPolicy"],
        message: "Socket allocation policy must match its admission scope",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Socket lease exceeds ${SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.leaseHash !== hashExclusiveSocketLeaseV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["leaseHash"],
        message: "Socket lease hash must bind the exact held endpoint",
      });
    }
  });

export type ExclusiveSocketLeaseReceiptV2 = z.infer<
  typeof ExclusiveSocketLeaseReceiptV2Schema
>;

const JavascriptExportNameV2Schema = z.string()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/u, "Expected one JavaScript export name");

const SocketLaunchBindingIdentityV2Schema = z.object({
  launcherRef: PlatformReleaseStableReferenceV2Schema,
  launcherModuleHash: Sha256Schema,
  applicationModuleLocator: PlatformReleasePortableLocatorV2Schema,
  applicationModuleHash: Sha256Schema,
  applicationExport: JavascriptExportNameV2Schema,
  handlerAbiHash: Sha256Schema,
}).strict();

export type SocketLaunchBindingHashPayloadV2 = z.infer<
  typeof SocketLaunchBindingIdentityV2Schema
>;

export function hashSocketLaunchBindingV2(
  value: SocketLaunchBindingHashPayloadV2 | SocketLaunchBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.socket-launch-binding-hash.v2",
    binding,
  });
}

export const SocketLaunchBindingV2Schema =
  SocketLaunchBindingIdentityV2Schema.extend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.bindingHash !== hashSocketLaunchBindingV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Socket launch binding hash mismatch",
      });
    }
  });

export type SocketLaunchBindingV2 = z.infer<typeof SocketLaunchBindingV2Schema>;

const SocketHandoffAcknowledgementIdentityV2Schema =
  SocketAuthorityDispositionV2Schema.extend({
    schema: z.literal(SOCKET_HANDOFF_ACKNOWLEDGEMENT_V2_SCHEMA),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    lifecycleAbiHash: z.literal(EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2),
    leaseHash: Sha256Schema,
    descriptorCapabilityHash: Sha256Schema,
    endpoint: ExclusiveSocketEndpointV2Schema,
    handoffNonceHash: Sha256Schema,
    sentAt: ExactUtcMillisecondTimestampV2Schema,
    acknowledgedAt: ExactUtcMillisecondTimestampV2Schema,
    sendObservation: z.object({
      transport: z.literal("node_ipc_server_handle"),
      keepParentOpenThroughAcknowledgement: z.literal(true),
      sendCallbackAuthority: z.literal("forbidden"),
    }).strict(),
    childProcess: ObservedProcessIdentityV2Schema,
    childProcessIdentityHash: Sha256Schema,
    launchBinding: SocketLaunchBindingV2Schema,
    listenerObservation: z.object({
      receivedHandle: z.literal(true),
      addressMatchesLease: z.literal(true),
      listening: z.literal(true),
      candidateListen: z.literal("forbidden"),
    }).strict(),
    stateTransitions: z.tuple([
      z.literal("bound_to_sent"),
      z.literal("sent_to_acknowledged"),
    ]),
  }).strict();

export type SocketHandoffAcknowledgementHashPayloadV2 = z.infer<
  typeof SocketHandoffAcknowledgementIdentityV2Schema
>;

export function hashSocketHandoffAcknowledgementV2(
  value:
    | SocketHandoffAcknowledgementHashPayloadV2
    | SocketHandoffAcknowledgementV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.acknowledgementHash;
  return hashCanonicalJson({
    schema: "setfarm.socket-handoff-acknowledgement-hash.v2",
    receipt,
  });
}

export const SocketHandoffAcknowledgementV2Schema =
  SocketHandoffAcknowledgementIdentityV2Schema.extend({
    acknowledgementHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.childProcessIdentityHash
        !== hashSocketProcessIdentityV2(value.childProcess)
    ) {
      context.addIssue({
        code: "custom",
        path: ["childProcessIdentityHash"],
        message: "Socket acknowledgement must bind the observed child process",
      });
    }
    const sent = Date.parse(value.sentAt);
    const acknowledged = Date.parse(value.acknowledgedAt);
    if (
      acknowledged < sent
      || acknowledged - sent > SOCKET_HANDOFF_TIMEOUT_MS_V2
    ) {
      context.addIssue({
        code: "custom",
        path: ["acknowledgedAt"],
        message: "Socket acknowledgement must fit the exact handoff interval",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Socket acknowledgement exceeds ${SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (
      value.acknowledgementHash
        !== hashSocketHandoffAcknowledgementV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["acknowledgementHash"],
        message: "Socket acknowledgement hash mismatch",
      });
    }
  });

export type SocketHandoffAcknowledgementV2 = z.infer<
  typeof SocketHandoffAcknowledgementV2Schema
>;

const ServiceReadinessReceiptIdentityV2Schema =
  SocketAuthorityDispositionV2Schema.extend({
    schema: z.literal(SERVICE_READINESS_RECEIPT_V2_SCHEMA),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    lifecycleAbiHash: z.literal(EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2),
    leaseHash: Sha256Schema,
    acknowledgementHash: Sha256Schema,
    descriptorCapabilityHash: Sha256Schema,
    childProcessIdentityHash: Sha256Schema,
    endpoint: ExclusiveSocketEndpointV2Schema,
    startedAt: ExactUtcMillisecondTimestampV2Schema,
    finishedAt: ExactUtcMillisecondTimestampV2Schema,
    durationMs: z.number().int().nonnegative()
      .max(SOCKET_READINESS_TIMEOUT_MS_V2),
    probe: z.object({
      method: z.literal("GET"),
      pathPolicy: z.literal("one_use_nonce_path_v2"),
      redirectPolicy: z.literal("never_follow"),
      requestNonceHash: Sha256Schema,
      responseNonceHash: Sha256Schema,
      statusCode: z.literal(200),
      contentType: z.literal("text/plain; charset=utf-8"),
      responseByteLength: z.literal(64),
      requestCount: z.literal(1),
      childObservation: z.literal("response_committed"),
    }).strict(),
    stateTransition: z.literal("acknowledged_to_ready"),
  }).strict();

export type ServiceReadinessReceiptHashPayloadV2 = z.infer<
  typeof ServiceReadinessReceiptIdentityV2Schema
>;

export function hashServiceReadinessReceiptV2(
  value:
    | ServiceReadinessReceiptHashPayloadV2
    | ServiceReadinessReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.readinessHash;
  return hashCanonicalJson({
    schema: "setfarm.service-readiness-receipt-hash.v2",
    receipt,
  });
}

export const ServiceReadinessReceiptV2Schema =
  ServiceReadinessReceiptIdentityV2Schema.extend({
    readinessHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const started = Date.parse(value.startedAt);
    const finished = Date.parse(value.finishedAt);
    if (finished < started || finished - started !== value.durationMs) {
      context.addIssue({
        code: "custom",
        path: ["durationMs"],
        message: "Readiness duration must equal the exact UTC interval",
      });
    }
    if (value.probe.requestNonceHash !== value.probe.responseNonceHash) {
      context.addIssue({
        code: "custom",
        path: ["probe", "responseNonceHash"],
        message: "Readiness response must echo the exact one-use nonce",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Readiness receipt exceeds ${SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.readinessHash !== hashServiceReadinessReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["readinessHash"],
        message: "Readiness receipt hash mismatch",
      });
    }
  });

export type ServiceReadinessReceiptV2 = z.infer<
  typeof ServiceReadinessReceiptV2Schema
>;

const SocketCleanupReceiptIdentityV2Schema =
  SocketAuthorityDispositionV2Schema.extend({
    schema: z.literal(SOCKET_CLEANUP_RECEIPT_V2_SCHEMA),
    version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    lifecycleAbiHash: z.literal(EXCLUSIVE_SOCKET_LIFECYCLE_ABI_HASH_V2),
    leaseHash: Sha256Schema,
    acknowledgementHash: Sha256Schema,
    readinessHash: Sha256Schema,
    descriptorCapabilityHash: Sha256Schema,
    childProcessIdentityHash: Sha256Schema,
    endpoint: ExclusiveSocketEndpointV2Schema,
    cleanupNonceHash: Sha256Schema,
    startedAt: ExactUtcMillisecondTimestampV2Schema,
    finishedAt: ExactUtcMillisecondTimestampV2Schema,
    durationMs: z.number().int().nonnegative()
      .max(SOCKET_CLEANUP_TIMEOUT_MS_V2),
    childObservation: z.object({
      transport: z.literal("authenticated_node_ipc"),
      nonceMatched: z.literal(true),
      serverCloseCallback: z.literal("completed"),
      readinessRequestCount: z.literal(1),
    }).strict(),
    processTermination: z.object({
      ipcDisconnected: z.literal(true),
      exitCode: z.literal(0),
      signal: z.null(),
    }).strict(),
    portRelease: z.object({
      method: z.literal("exclusive_rebind_probe"),
      rebound: z.literal(true),
      probeServerClosed: z.literal(true),
    }).strict(),
    stateTransition: z.literal("ready_to_closed"),
  }).strict();

export type SocketCleanupReceiptHashPayloadV2 = z.infer<
  typeof SocketCleanupReceiptIdentityV2Schema
>;

export function hashSocketCleanupReceiptV2(
  value: SocketCleanupReceiptHashPayloadV2 | SocketCleanupReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.cleanupHash;
  return hashCanonicalJson({
    schema: "setfarm.socket-cleanup-receipt-hash.v2",
    receipt,
  });
}

export const SocketCleanupReceiptV2Schema =
  SocketCleanupReceiptIdentityV2Schema.extend({
    cleanupHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const started = Date.parse(value.startedAt);
    const finished = Date.parse(value.finishedAt);
    if (finished < started || finished - started !== value.durationMs) {
      context.addIssue({
        code: "custom",
        path: ["durationMs"],
        message: "Cleanup duration must equal the exact UTC interval",
      });
    }
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: `Cleanup receipt exceeds ${SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (value.cleanupHash !== hashSocketCleanupReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["cleanupHash"],
        message: "Cleanup receipt hash mismatch",
      });
    }
  });

export type SocketCleanupReceiptV2 = z.infer<
  typeof SocketCleanupReceiptV2Schema
>;

function parseSocketReceiptV2<T>(
  input: unknown,
  schema: z.ZodType<T>,
): T {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    SOCKET_LIFECYCLE_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(schema.parse(snapshot));
}

export function parseExclusiveSocketLeaseReceiptV2(
  input: unknown,
): ExclusiveSocketLeaseReceiptV2 {
  return parseSocketReceiptV2(input, ExclusiveSocketLeaseReceiptV2Schema);
}

export function parseSocketHandoffAcknowledgementV2(
  input: unknown,
): SocketHandoffAcknowledgementV2 {
  return parseSocketReceiptV2(
    input,
    SocketHandoffAcknowledgementV2Schema,
  );
}

export function parseServiceReadinessReceiptV2(
  input: unknown,
): ServiceReadinessReceiptV2 {
  return parseSocketReceiptV2(input, ServiceReadinessReceiptV2Schema);
}

export function parseSocketCleanupReceiptV2(
  input: unknown,
): SocketCleanupReceiptV2 {
  return parseSocketReceiptV2(input, SocketCleanupReceiptV2Schema);
}
