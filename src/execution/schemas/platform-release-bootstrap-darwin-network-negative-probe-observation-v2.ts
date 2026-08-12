import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  NetworkIsolationNegativeProbeReceiptV2Schema,
} from "./network-isolation-negative-probe-v2.js";
import {
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
  EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
} from "./evidence-environment-capsule-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-network-negative-probe-observation.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-network-negative-probe-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_FILE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-network-negative-probe-file-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_ROOT_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-network-negative-probe-root-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_SNAPSHOT_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-network-negative-probe-snapshot-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_FILE_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_ROOT_ENTRIES_V2 =
  256;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_IMPLEMENTATION_SCOPE_V2 =
  "test_fixture_descriptor_bounded_network_probe_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_TRUST_CONCLUSION_V2 =
  "characterization_only" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_PAYLOAD_BINDING_V2 =
  "test_fixture_ts_source_module_not_release_dist_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-network-negative-probe-policy.v2",
    fixedFiles: [
      {
        roleRef: "NETWORK_PROBE_WRAPPER_MODULE_V2",
        locatorRef: EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
      },
      {
        roleRef: "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2",
        locatorRef: EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
      },
      {
        roleRef: "NETWORK_PROBE_NODE_EXECUTABLE_V2",
        locatorRef: "EXEC_NODE_RUNTIME_V2",
      },
    ],
    scratchRootRoleRef: "NETWORK_PROBE_SCRATCH_ROOT_V2",
    capture:
      "lstat_open_nofollow_cloexec_fstat_bounded_read_eof_probe_pre_post_v2",
    identity:
      "host_object_kind_device_inode_separate_mutable_fingerprint_v2",
    mutation: "fixture_owned_cleanup_only_never_authority_v2",
    maxFileBytes:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_FILE_BYTES_V2,
    maxRootEntries:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_ROOT_ENTRIES_V2,
  });

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const ModeV2Schema = z.string().regex(/^[0-7]{4}$/u);
const ObjectKindV2Schema = z.enum(["directory", "ordinary_file"]);
const RoleRefV2Schema = z.enum([
  "NETWORK_PROBE_SCRATCH_ROOT_V2",
  "NETWORK_PROBE_WRAPPER_MODULE_V2",
  "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2",
  "NETWORK_PROBE_NODE_EXECUTABLE_V2",
]);
const FileRoleRefV2Schema = z.enum([
  "NETWORK_PROBE_WRAPPER_MODULE_V2",
  "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2",
  "NETWORK_PROBE_NODE_EXECUTABLE_V2",
]);
const LocatorRefV2Schema = z.enum([
  EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
  EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
  "EXEC_NODE_RUNTIME_V2",
  "NETWORK_PROBE_SCRATCH_ROOT_PRIVATE_TOKEN_V2",
]);

const StableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: ObjectKindV2Schema,
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();
type StableIdentityV2 = z.infer<typeof StableIdentityV2Schema>;

const MutableFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: ModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_FILE_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

function physicalKeyV2(value: StableIdentityV2): string {
  return `${value.hostIdentityHash}:${value.objectKind}:${value.device}:${value.inode}`;
}

const FileObservationIdentityV2Schema = z.object({
  roleRef: FileRoleRefV2Schema,
  locatorRef: LocatorRefV2Schema,
  stableIdentity: StableIdentityV2Schema.extend({
    objectKind: z.literal("ordinary_file"),
  }),
  mutableFingerprint: MutableFingerprintV2Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2 =
  z.infer<typeof FileObservationIdentityV2Schema> & Readonly<{
    observationHash: string;
  }>;

export function hashNetworkNegativeProbeFileObservationV2(
  value: Omit<
    PlatformReleaseBootstrapDarwinNetworkNegativeProbeFileObservationV2,
    "observationHash"
  >,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_FILE_HASH_V2_SCHEMA,
    file: value,
  });
}

const FileObservationV2Schema = FileObservationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (
    value.observationHash !== hashNetworkNegativeProbeFileObservationV2(identity)
    || value.mutableFingerprint.byteLength <= 0
    || value.mutableFingerprint.linkCount !== 1
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message:
        "Network probe file must bind one ordinary file and its separate mutable fingerprint",
    });
  }
});

const RootObservationIdentityV2Schema = z.object({
  roleRef: z.literal("NETWORK_PROBE_SCRATCH_ROOT_V2"),
  locatorRef: z.literal("NETWORK_PROBE_SCRATCH_ROOT_PRIVATE_TOKEN_V2"),
  stableIdentity: StableIdentityV2Schema.extend({
    objectKind: z.literal("directory"),
  }),
  mutableFingerprint: MutableFingerprintV2Schema,
  directEntryNamesHash: Sha256Schema,
}).strict();

export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeRootObservationV2 =
  z.infer<typeof RootObservationIdentityV2Schema> & Readonly<{
    observationHash: string;
  }>;

export function hashNetworkNegativeProbeRootObservationV2(
  value: Omit<
    PlatformReleaseBootstrapDarwinNetworkNegativeProbeRootObservationV2,
    "observationHash"
  >,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_ROOT_HASH_V2_SCHEMA,
    root: value,
  });
}

const RootObservationV2Schema = RootObservationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (
    value.observationHash !== hashNetworkNegativeProbeRootObservationV2(identity)
    || value.mutableFingerprint.contentHash !== value.directEntryNamesHash
    || value.mutableFingerprint.mode !== "0700"
    || value.mutableFingerprint.linkCount < 1
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message:
        "Network probe scratch root must bind its namespace to the mutable fingerprint",
    });
  }
});

const SnapshotIdentityV2Schema = z.object({
  root: RootObservationV2Schema,
  files: z.tuple([
    FileObservationV2Schema,
    FileObservationV2Schema,
    FileObservationV2Schema,
  ]),
}).strict();

export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2 =
  z.infer<typeof SnapshotIdentityV2Schema> & Readonly<{
    snapshotHash: string;
  }>;

export function hashNetworkNegativeProbeSnapshotV2(
  value: Omit<
    PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2,
    "snapshotHash"
  >,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_SNAPSHOT_HASH_V2_SCHEMA,
    snapshot: value,
  });
}

const SnapshotV2Schema = SnapshotIdentityV2Schema.extend({
  snapshotHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { snapshotHash: _snapshotHash, ...identity } = value;
  if (value.snapshotHash !== hashNetworkNegativeProbeSnapshotV2(identity)) {
    context.addIssue({
      code: "custom",
      path: ["snapshotHash"],
      message: "Network probe physical snapshot hash mismatch",
    });
  }
  const expectedRoles = [
    [
      "NETWORK_PROBE_WRAPPER_MODULE_V2",
      EVIDENCE_ENVIRONMENT_NETWORK_WRAPPER_MODULE_V2,
    ],
    [
      "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2",
      EVIDENCE_ENVIRONMENT_SANDBOX_EXECUTABLE_REF_V2,
    ],
    ["NETWORK_PROBE_NODE_EXECUTABLE_V2", "EXEC_NODE_RUNTIME_V2"],
  ];
  if (canonicalJsonStringify(
    value.files.map((file) => [file.roleRef, file.locatorRef]),
  ) !== canonicalJsonStringify(expectedRoles)) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message: "Network probe file role or locator order drifted",
    });
  }
  const hosts = [
    value.root.stableIdentity.hostIdentityHash,
    ...value.files.map((file) => file.stableIdentity.hostIdentityHash),
  ];
  if (new Set(hosts).size !== 1) {
    context.addIssue({
      code: "custom",
      path: ["root"],
      message: "Network probe root and files must share one host identity",
    });
  }
  const physicalObjects = [
    value.root.stableIdentity,
    ...value.files.map((file) => file.stableIdentity),
  ].map(physicalKeyV2);
  if (new Set(physicalObjects).size !== physicalObjects.length) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message: "Network probe root and files must remain physically distinct",
    });
  }
  const sandboxFile = value.files.find((file) =>
    file.roleRef === "NETWORK_PROBE_SANDBOX_EXECUTABLE_V2",
  );
  if (
    sandboxFile === undefined
    || sandboxFile.mutableFingerprint.ownerUid !== 0
    || sandboxFile.mutableFingerprint.ownerGid !== 0
    || sandboxFile.mutableFingerprint.mode !== "0755"
  ) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message:
        "Network probe sandbox executable must retain the code-owned root 0755 policy",
    });
  }
});

const IdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_test_fixture_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_TRUST_CONCLUSION_V2,
  ),
  implementationScope: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_IMPLEMENTATION_SCOPE_V2,
  ),
  payloadBinding: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_PAYLOAD_BINDING_V2,
  ),
  policyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_POLICY_HASH_V2,
  ),
  hostIdentityHash: Sha256Schema,
  challengeHash: Sha256Schema,
  networkReceiptSchemaHash: z.literal(
    NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2,
  ),
  networkReceipt: NetworkIsolationNegativeProbeReceiptV2Schema,
  networkReceiptHash: Sha256Schema,
  observationOutcome: z.literal("network_negative_probes_observed"),
  before: SnapshotV2Schema,
  after: SnapshotV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.networkReceipt.admissionScope !== "test_fixture"
    || value.networkReceiptHash !== value.networkReceipt.receiptHash
    || value.networkReceiptSchemaHash
      !== NETWORK_ISOLATION_NEGATIVE_PROBE_RECEIPT_SCHEMA_HASH_V2
  ) {
    context.addIssue({
      code: "custom",
      path: ["networkReceipt"],
      message: "Network receipt must remain one test-fixture observation",
    });
  }
  const implementation = value.networkReceipt.implementation;
  const expectedContentHashes = new Map([
    ["NETWORK_PROBE_WRAPPER_MODULE_V2", implementation.wrapperModuleHash],
    ["NETWORK_PROBE_SANDBOX_EXECUTABLE_V2", implementation.sandboxExecutableHash],
    ["NETWORK_PROBE_NODE_EXECUTABLE_V2", implementation.nodeExecutableHash],
  ]);
  for (const snapshot of [value.before, value.after]) {
    for (const file of snapshot.files) {
      if (
        file.mutableFingerprint.contentHash
        !== expectedContentHashes.get(file.roleRef)
        || file.stableIdentity.hostIdentityHash !== value.hostIdentityHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["networkReceipt", "implementation"],
          message:
            "Network receipt executable hashes must join the descriptor-captured file observations",
        });
      }
    }
  }
  if (
    implementation.hostRuntimeIdentityHash !== value.hostIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["networkReceipt", "implementation", "hostRuntimeIdentityHash"],
      message:
        "Network receipt runtime identity must join the observation host identity",
    });
  }
  const expectedObservationHash = hashNetworkNegativeProbeObservationV2({
    challengeHash: value.challengeHash,
    hostIdentityHash: value.hostIdentityHash,
    networkReceiptHash: value.networkReceiptHash,
    observationOutcome: value.observationOutcome,
    policyHash: value.policyHash,
    before: value.before,
    after: value.after,
  });
  if (
    value.observationHash !== expectedObservationHash
    || value.hostIdentityHash !== value.before.root.stableIdentity.hostIdentityHash
    || value.hostIdentityHash !== value.after.root.stableIdentity.hostIdentityHash
    || canonicalJsonStringify(value.before) !== canonicalJsonStringify(value.after)
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Network probe observation fence or host join mismatch",
    });
  }
});

export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationHashPayloadV2 =
  z.infer<typeof IdentityV2Schema>;
export type PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2 =
  PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationHashPayloadV2 &
  Readonly<{ probeHash: string }>;

export function hashNetworkNegativeProbeObservationV2(
  value: Readonly<{
    challengeHash: string;
    hostIdentityHash: string;
    networkReceiptHash: string;
    observationOutcome: "network_negative_probes_observed";
    policyHash: string;
    before: PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2;
    after: PlatformReleaseBootstrapDarwinNetworkNegativeProbeSnapshotV2;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_HASH_V2_SCHEMA,
    observation: value,
  });
}

export function hashPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2(
  value: Readonly<Record<string, unknown>>,
): string {
  const observation = { ...value };
  delete observation.probeHash;
  return hashCanonicalJson({
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_V2_SCHEMA,
    observation,
  });
}

export function parsePlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_NETWORK_NEGATIVE_PROBE_OBSERVATION_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    IdentityV2Schema.extend({
      probeHash: Sha256Schema,
    }).strict().superRefine((value, context) => {
      const { probeHash: _probeHash, ...identity } = value;
      if (
        value.probeHash
        !== hashPlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2(
          identity,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["probeHash"],
          message: "Network probe observation hash mismatch",
        });
      }
    }).parse(snapshot) as PlatformReleaseBootstrapDarwinNetworkNegativeProbeObservationV2,
  );
}
