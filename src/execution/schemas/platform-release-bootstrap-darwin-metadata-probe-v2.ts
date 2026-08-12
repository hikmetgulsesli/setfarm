import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import { Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2,
} from "./platform-release-bootstrap-operation-abis-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-metadata-probe.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-metadata-probe-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_COMMAND_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-metadata-probe-command-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TOOL_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-metadata-probe-tool-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TARGET_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-metadata-probe-target-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_SNAPSHOT_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-metadata-probe-snapshot-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_TOOL_BYTES_V2 =
  32 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2 =
  64 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TIMEOUT_MS_V2 =
  8_000;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2 =
  "deny_all_empty_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_REF_V2 =
  "ABI_PLATFORM_RELEASE_METADATA_PROBE_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TRUST_CONCLUSION_V2 =
  "characterization_only" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TARGET_BINDING_V2 =
  "private_fixture_path_revalidated_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_IMPLEMENTATION_SCOPE_V2 =
  "test_fixture_direct_tools_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_EMPTY_SHA256_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_SYSTEM_PROVENANCE_NAMES_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-system-xattr-names.v2",
    values: ["com.apple.provenance"],
  });

const metadataOperation =
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations.find(
    (operation) =>
      operation.abiRef
        === PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_REF_V2,
  );
if (metadataOperation === undefined) {
  throw new Error(
    "Code-owned metadata operation ABI is missing from the bootstrap ABI set",
  );
}
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_HASH_V2 =
  metadataOperation.operationHash;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2 =
  "PRIVATE_TARGET_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2 =
  "PRIVATE_FIXTURE_ROOT_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_POLICY_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-policy.v2",
    operation: "read_only_xattr_and_acl_observation_v2",
    implementationScope:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_IMPLEMENTATION_SCOPE_V2,
    target: "private_fixture_directory_v2",
    tools: [
      {
        toolRef: "XATTR_OBSERVER_V2",
        executable: "/usr/bin/xattr",
        argv: ["-l", PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2],
      },
      {
        toolRef: "ACL_OBSERVER_V2",
        executable: "/bin/ls",
        argv: ["-lde@", PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2],
      },
    ],
    allowedSystemManagedXattrNames: ["com.apple.provenance"],
    cwd: "private_fixture_root_v2",
    receiptSchema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_V2_SCHEMA,
    shell: "forbidden",
    environmentPolicy:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2,
    mutation: "forbidden",
    outputCapBytes:
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2,
    timeoutMs: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TIMEOUT_MS_V2,
  });

export type PlatformReleaseBootstrapDarwinMetadataProbeMetadataStateV2 = Readonly<{
  xattr: Readonly<{
    status: "clear" | "present";
    observedNameCount: number;
    observedNamesHash: string;
    systemManagedNameCount: number;
    systemManagedNamesHash: string;
  }>;
  acl: Readonly<{
    status: "clear" | "present";
    observedEntryCount: number;
    observedEntriesHash: string;
  }>;
}>;

const CanonicalDecimalV2Schema = z.string()
  .min(1)
  .max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u, "Expected one canonical unsigned decimal");
const CanonicalModeV2Schema = z.string()
  .regex(/^[0-7]{4}$/u, "Expected one canonical four-digit mode");
const ToolPathV2Schema = z.enum(["/usr/bin/xattr", "/bin/ls"]);
const ToolRefV2Schema = z.enum(["XATTR_OBSERVER_V2", "ACL_OBSERVER_V2"]);
const CommandKindV2Schema = z.enum(["xattr_observe", "acl_observe"]);
const CommandStatusV2Schema = z.enum([
  "exited",
  "spawn_failed",
  "timed_out",
  "output_limit_exceeded",
]);

const StableIdentityV2Schema = z.object({
  hostIdentityHash: Sha256Schema,
  objectKind: z.enum(["directory", "ordinary_file"]),
  device: CanonicalDecimalV2Schema,
  inode: CanonicalDecimalV2Schema,
}).strict();

const MutableFingerprintV2Schema = z.object({
  ownerUid: z.number().int().nonnegative().safe().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().safe().max(4_294_967_294),
  mode: CanonicalModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_TOOL_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

const TargetDirectoryObservationIdentityV2Schema = z.object({
  stableIdentity: StableIdentityV2Schema.extend({
    objectKind: z.literal("directory"),
  }),
  mutableFingerprint: MutableFingerprintV2Schema,
  directEntryNames: z.array(z.string().min(1).max(255))
    .max(128)
    .superRefine((value, context) => {
      for (let index = 1; index < value.length; index += 1) {
        if (value[index - 1]! >= value[index]!) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "Target directory entries must be strictly UTF-16 sorted",
          });
        }
      }
    }),
  directEntryNamesHash: Sha256Schema,
}).strict();

type TargetDirectoryObservationIdentityV2 = z.infer<
  typeof TargetDirectoryObservationIdentityV2Schema
>;

const TargetDirectoryObservationV2Schema =
  TargetDirectoryObservationIdentityV2Schema.extend({
    observationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const expectedNamesHash = hashMetadataProbeDirectoryEntriesV2(
      value.directEntryNames,
    );
    const { observationHash: _observationHash, ...identity } = value;
    const expectedObservationHash = hashMetadataProbeTargetObservationV2(
      identity,
    );
    if (value.directEntryNamesHash !== expectedNamesHash) {
      context.addIssue({
        code: "custom",
        path: ["directEntryNamesHash"],
        message: "Target directory entry hash mismatch",
      });
    }
    if (value.observationHash !== expectedObservationHash) {
      context.addIssue({
        code: "custom",
        path: ["observationHash"],
        message: "Target directory observation hash mismatch",
      });
    }
  });

export type PlatformReleaseBootstrapDarwinMetadataProbeTargetObservationV2 =
  z.infer<typeof TargetDirectoryObservationV2Schema>;

const CommandObservationIdentityV2Schema = z.object({
  kind: CommandKindV2Schema,
  executable: ToolPathV2Schema,
  argv: z.tuple([
    z.string().min(1).max(32),
    z.literal(
      PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2,
    ),
  ]),
  argvHash: Sha256Schema,
  cwdLocator: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2,
  ),
  environmentPolicy: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2,
  ),
  shell: z.literal("forbidden"),
  status: CommandStatusV2Schema,
  pid: z.number().int().safe().min(-1),
  startedAt: z.number().int().nonnegative().safe(),
  finishedAt: z.number().int().nonnegative().safe(),
  exitCode: z.number().int().safe().nullable(),
  signal: z.string().regex(/^[A-Z0-9]+$/u).nullable(),
  stdoutByteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2),
  stderrByteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_OUTPUT_BYTES_V2),
  stdoutHash: Sha256Schema,
  stderrHash: Sha256Schema,
}).strict();

type CommandObservationIdentityV2 = z.infer<
  typeof CommandObservationIdentityV2Schema
>;

const CommandObservationV2Schema = CommandObservationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  const expected = hashMetadataProbeCommandObservationV2(identity);
  if (value.observationHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Metadata probe command observation hash mismatch",
    });
  }
  if (value.finishedAt < value.startedAt) {
    context.addIssue({
      code: "custom",
      path: ["finishedAt"],
      message: "Metadata probe command cannot finish before it starts",
    });
  }
  if (value.status === "exited" && value.exitCode === null) {
    context.addIssue({
      code: "custom",
      path: ["exitCode"],
      message: "Exited metadata probe command must carry an exit code",
    });
  }
  if (value.status !== "exited" && value.exitCode !== null) {
    context.addIssue({
      code: "custom",
      path: ["exitCode"],
      message: "Non-exited metadata probe command cannot carry an exit code",
    });
  }
  const executableByKind = value.kind === "xattr_observe"
    ? "/usr/bin/xattr"
    : "/bin/ls";
  const argvTokenByKind = value.kind === "xattr_observe" ? "-l" : "-lde@";
  const expectedArgvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-command-argv.v2",
    kind: value.kind,
    executable: value.executable,
    argv: value.argv,
    cwdLocator: value.cwdLocator,
    environmentPolicy: value.environmentPolicy,
    shell: value.shell,
  });
  if (
    value.executable !== executableByKind
    || value.argv[0] !== argvTokenByKind
    || value.argv[1]
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_TARGET_TOKEN_V2
    || value.cwdLocator
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_PRIVATE_CWD_TOKEN_V2
    || value.shell !== "forbidden"
    || value.argvHash !== expectedArgvHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["argv"],
      message: "Metadata command is not bound to its fixed no-shell tool",
    });
  }
});

export type PlatformReleaseBootstrapDarwinMetadataProbeCommandObservationV2 =
  z.infer<typeof CommandObservationV2Schema>;

const ToolObservationIdentityV2Schema = z.object({
  toolRef: ToolRefV2Schema,
  stableIdentity: StableIdentityV2Schema.extend({
    objectKind: z.literal("ordinary_file"),
  }),
  mutableFingerprint: MutableFingerprintV2Schema,
  command: CommandObservationV2Schema,
}).strict();

type ToolObservationIdentityV2 = z.infer<typeof ToolObservationIdentityV2Schema>;

const ToolObservationV2Schema = ToolObservationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedExecutable = value.toolRef === "XATTR_OBSERVER_V2"
    ? "/usr/bin/xattr"
    : "/bin/ls";
  const expectedKind = value.toolRef === "XATTR_OBSERVER_V2"
    ? "xattr_observe"
    : "acl_observe";
  const { observationHash: _observationHash, ...identity } = value;
  const expected = hashMetadataProbeToolObservationV2(identity);
  if (value.observationHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Metadata probe tool observation hash mismatch",
    });
  }
  if (
    value.command.executable !== expectedExecutable
    || value.command.kind !== expectedKind
    || value.command.status !== "exited"
    || value.command.exitCode !== 0
    || value.command.signal !== null
  ) {
    context.addIssue({
      code: "custom",
      path: ["command"],
      message: "Metadata tool observation must bind one successful fixed command",
    });
  }
});

export type PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2 =
  z.infer<typeof ToolObservationV2Schema>;

const MetadataStateV2Schema = z.object({
  xattr: z.object({
    status: z.enum(["clear", "present"]),
    observedNameCount: z.number().int().nonnegative().safe().max(128),
    observedNamesHash: Sha256Schema,
    systemManagedNameCount: z.number().int().nonnegative().safe().max(128),
    systemManagedNamesHash: Sha256Schema,
  }).strict(),
  acl: z.object({
    status: z.enum(["clear", "present"]),
    observedEntryCount: z.number().int().nonnegative().safe().max(128),
    observedEntriesHash: Sha256Schema,
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.xattr.status === "clear" && (
    value.xattr.observedNameCount !== 0
    || value.xattr.observedNamesHash
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_EMPTY_SHA256_V2
  )) {
    context.addIssue({
      code: "custom",
      path: ["xattr"],
      message: "Clear xattr state must have an empty observation commitment",
    });
  }
  if (value.xattr.systemManagedNameCount === 0 && (
    value.xattr.systemManagedNamesHash
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_EMPTY_SHA256_V2
  )) {
    context.addIssue({
      code: "custom",
      path: ["xattr", "systemManagedNamesHash"],
      message: "Empty system-managed xattr state must have an empty commitment",
    });
  }
  if (value.xattr.systemManagedNameCount > 0 && (
    value.xattr.systemManagedNameCount !== 1
    || value.xattr.systemManagedNamesHash
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_SYSTEM_PROVENANCE_NAMES_HASH_V2
  )) {
    context.addIssue({
      code: "custom",
      path: ["xattr", "systemManagedNamesHash"],
      message: "System-managed xattr state is not the code-owned provenance set",
    });
  }
  if (value.acl.status === "clear" && (
    value.acl.observedEntryCount !== 0
    || value.acl.observedEntriesHash
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_EMPTY_SHA256_V2
  )) {
    context.addIssue({
      code: "custom",
      path: ["acl"],
      message: "Clear ACL state must have an empty observation commitment",
    });
  }
  if (value.xattr.status === "present" && value.xattr.observedNameCount === 0) {
    context.addIssue({
      code: "custom",
      path: ["xattr", "observedNameCount"],
      message: "Present xattr state must report at least one name",
    });
  }
  if (value.xattr.status === "clear" && value.xattr.observedNameCount !== 0) {
    context.addIssue({
      code: "custom",
      path: ["xattr", "observedNameCount"],
      message: "Clear xattr policy state cannot contain a relevant name",
    });
  }
  if (value.acl.status === "present" && value.acl.observedEntryCount === 0) {
    context.addIssue({
      code: "custom",
      path: ["acl", "observedEntryCount"],
      message: "Present ACL state must report at least one entry",
    });
  }
});

const SnapshotIdentityV2Schema = z.object({
  target: TargetDirectoryObservationV2Schema,
  tools: z.tuple([ToolObservationV2Schema, ToolObservationV2Schema]),
  metadataState: MetadataStateV2Schema,
  observedEntryCount: z.number().int().nonnegative().safe().max(128),
}).strict();

type SnapshotIdentityV2 = z.infer<typeof SnapshotIdentityV2Schema>;

const SnapshotV2Schema = SnapshotIdentityV2Schema.extend({
  snapshotHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { snapshotHash: _snapshotHash, ...identity } = value;
  const expected = hashMetadataProbeSnapshotV2(identity);
  if (value.snapshotHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["snapshotHash"],
      message: "Metadata probe snapshot hash mismatch",
    });
  }
  if (
    value.observedEntryCount !== value.target.directEntryNames.length
    || value.tools[0]!.toolRef !== "XATTR_OBSERVER_V2"
    || value.tools[1]!.toolRef !== "ACL_OBSERVER_V2"
    || value.tools[0]!.stableIdentity.hostIdentityHash
      !== value.target.stableIdentity.hostIdentityHash
    || value.tools[1]!.stableIdentity.hostIdentityHash
      !== value.target.stableIdentity.hostIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["tools"],
      message: "Metadata snapshot tool order and host identity must be exact",
    });
  }
});

export type PlatformReleaseBootstrapDarwinMetadataProbeSnapshotV2 =
  z.infer<typeof SnapshotV2Schema>;

const MetadataProbeIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_test_fixture_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TRUST_CONCLUSION_V2,
  ),
  targetBinding: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TARGET_BINDING_V2,
  ),
  implementationScope: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_IMPLEMENTATION_SCOPE_V2,
  ),
  operationAbiRef: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_REF_V2,
  ),
  operationAbiHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_OPERATION_ABI_HASH_V2,
  ),
  hostCompositionReceiptHash: Sha256Schema,
  challengeHash: Sha256Schema,
  targetRootPhysicalIdentityHash: Sha256Schema,
  metadataPolicyHash: z.literal(
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_POLICY_HASH_V2,
  ),
  observationOutcome: z.literal("metadata_policy_satisfied"),
  observedEntryCount: z.number().int().nonnegative().safe().max(128),
  metadataCatalogHash: Sha256Schema,
  before: SnapshotV2Schema,
  after: SnapshotV2Schema,
  metadataObservationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedTargetHash = hashMetadataProbeTargetStableIdentityV2(
    value.before.target.stableIdentity,
  );
  const expectedCatalogHash = hashMetadataProbeCatalogV2({
    metadataPolicyHash: value.metadataPolicyHash,
    target: value.before.target,
    tools: value.before.tools,
    metadataState: value.before.metadataState,
  });
  const expectedObservationHash = hashMetadataProbeObservationV2({
    before: value.before,
    after: value.after,
    observationOutcome: value.observationOutcome,
    metadataCatalogHash: value.metadataCatalogHash,
  });
  if (
    value.targetRootPhysicalIdentityHash !== expectedTargetHash
    || value.metadataCatalogHash !== expectedCatalogHash
    || value.metadataObservationHash !== expectedObservationHash
    || value.observedEntryCount !== value.before.observedEntryCount
    || value.observedEntryCount !== value.after.observedEntryCount
  ) {
    context.addIssue({
      code: "custom",
      path: ["metadataObservationHash"],
      message: "Metadata probe aggregate hashes do not bind its observations",
    });
  }
  if (
    value.metadataPolicyHash
      !== PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_POLICY_HASH_V2
    || value.before.metadataState.xattr.status !== "clear"
    || value.before.metadataState.acl.status !== "clear"
    || value.after.metadataState.xattr.status !== "clear"
    || value.after.metadataState.acl.status !== "clear"
  ) {
    context.addIssue({
      code: "custom",
      path: ["metadataPolicyHash"],
      message: "Metadata probe receipt does not prove the code-owned clear policy",
    });
  }
  if (
    canonicalJsonStringify(value.before) !== canonicalJsonStringify(value.after)
  ) {
    context.addIssue({
      code: "custom",
      path: ["after"],
      message: "Metadata probe requires an unchanged pre/post fence",
    });
  }
  if (
    value.before.target.stableIdentity.objectKind !== "directory"
    || value.before.tools[0]!.stableIdentity.objectKind !== "ordinary_file"
    || value.before.tools[1]!.stableIdentity.objectKind !== "ordinary_file"
    || value.before.tools[0]!.stableIdentity.device
      === value.before.tools[1]!.stableIdentity.device
      && value.before.tools[0]!.stableIdentity.inode
        === value.before.tools[1]!.stableIdentity.inode
  ) {
    context.addIssue({
      code: "custom",
      path: ["before"],
      message: "Metadata probe target and tools must have exact physical kinds",
    });
  }
});

export type PlatformReleaseBootstrapDarwinMetadataProbeHashPayloadV2 =
  z.infer<typeof MetadataProbeIdentityV2Schema>;

export type PlatformReleaseBootstrapDarwinMetadataProbeV2 =
  PlatformReleaseBootstrapDarwinMetadataProbeHashPayloadV2 & Readonly<{
    probeHash: string;
  }>;

export function hashMetadataProbeDirectoryEntriesV2(
  entries: readonly string[],
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-directory-entries.v2",
    entries,
  });
}

export function hashMetadataProbeTargetStableIdentityV2(
  stableIdentity: z.infer<typeof StableIdentityV2Schema>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-target-stable-identity.v2",
    stableIdentity,
  });
}

export function hashMetadataProbeTargetObservationV2(
  value: Readonly<{
    stableIdentity: z.infer<typeof StableIdentityV2Schema> & {
      objectKind: "directory";
    };
    mutableFingerprint: z.infer<typeof MutableFingerprintV2Schema>;
    directEntryNames: readonly string[];
    directEntryNamesHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TARGET_HASH_V2_SCHEMA,
    target: value,
  });
}

export function hashMetadataProbeCommandObservationV2(
  value: Readonly<{
    kind: z.infer<typeof CommandKindV2Schema>;
    executable: z.infer<typeof ToolPathV2Schema>;
    argv: readonly [string, string];
    argvHash: string;
    cwdLocator: string;
    environmentPolicy: typeof PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_ENVIRONMENT_POLICY_V2;
    shell: "forbidden";
    status: z.infer<typeof CommandStatusV2Schema>;
    pid: number;
    startedAt: number;
    finishedAt: number;
    exitCode: number | null;
    signal: string | null;
    stdoutByteLength: number;
    stderrByteLength: number;
    stdoutHash: string;
    stderrHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_COMMAND_HASH_V2_SCHEMA,
    command: value,
  });
}

export function hashMetadataProbeToolObservationV2(
  value: Readonly<{
    toolRef: z.infer<typeof ToolRefV2Schema>;
    stableIdentity: z.infer<typeof StableIdentityV2Schema> & {
      objectKind: "ordinary_file";
    };
    mutableFingerprint: z.infer<typeof MutableFingerprintV2Schema>;
    command: PlatformReleaseBootstrapDarwinMetadataProbeCommandObservationV2;
  }>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_TOOL_HASH_V2_SCHEMA,
    tool: value,
  });
}

export function hashMetadataProbeSnapshotV2(
  value: Readonly<{
    target: PlatformReleaseBootstrapDarwinMetadataProbeTargetObservationV2;
    tools: readonly [
      PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
      PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
    ];
    metadataState: PlatformReleaseBootstrapDarwinMetadataProbeMetadataStateV2;
    observedEntryCount: number;
  }>,
): string {
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_SNAPSHOT_HASH_V2_SCHEMA,
    snapshot: value,
  });
}

export function hashMetadataProbeCatalogV2(
  value: Readonly<{
    metadataPolicyHash: string;
    target: PlatformReleaseBootstrapDarwinMetadataProbeTargetObservationV2;
    tools: readonly [
      PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
      PlatformReleaseBootstrapDarwinMetadataProbeToolObservationV2,
    ];
    metadataState: PlatformReleaseBootstrapDarwinMetadataProbeMetadataStateV2;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-catalog.v2",
    metadataPolicyHash: value.metadataPolicyHash,
    targetStableIdentity: value.target.stableIdentity,
    targetEntryNamesHash: value.target.directEntryNamesHash,
    tools: value.tools.map((tool) => ({
      toolRef: tool.toolRef,
      stableIdentity: tool.stableIdentity,
      mutableFingerprint: tool.mutableFingerprint,
    })),
    metadataState: value.metadataState,
  });
}

export function hashMetadataProbeObservationV2(
  value: Readonly<{
    before: PlatformReleaseBootstrapDarwinMetadataProbeSnapshotV2;
    after: PlatformReleaseBootstrapDarwinMetadataProbeSnapshotV2;
    observationOutcome: "metadata_policy_satisfied";
    metadataCatalogHash: string;
  }>,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-metadata-probe-observation.v2",
    before: value.before,
    after: value.after,
    observationOutcome: value.observationOutcome,
    metadataCatalogHash: value.metadataCatalogHash,
  });
}

export function hashPlatformReleaseBootstrapDarwinMetadataProbeV2(
  value:
    | PlatformReleaseBootstrapDarwinMetadataProbeHashPayloadV2
    | PlatformReleaseBootstrapDarwinMetadataProbeV2,
): string {
  const probe = { ...value } as Record<string, unknown>;
  delete probe.probeHash;
  return hashCanonicalJson({
    schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_HASH_V2_SCHEMA,
    probe,
  });
}

export function parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2(
  input: unknown,
): PlatformReleaseBootstrapDarwinMetadataProbeV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_CANONICAL_BYTES_V2,
  );
  const candidate = { ...(snapshot as Record<string, unknown>) };
  const suppliedProbeHash = candidate.probeHash;
  delete candidate.probeHash;
  const parsed = MetadataProbeIdentityV2Schema.parse(candidate);
  const probeHash = hashPlatformReleaseBootstrapDarwinMetadataProbeV2(parsed);
  if (suppliedProbeHash !== undefined && suppliedProbeHash !== probeHash) {
    throw new z.ZodError([{
      code: "custom",
      path: ["probeHash"],
      message: "Metadata probe hash mismatch",
    }]);
  }
  const result = { ...parsed, probeHash };
  if (!platformReleaseCandidateFitsCanonicalCapV2(
    result,
    PLATFORM_RELEASE_BOOTSTRAP_DARWIN_METADATA_PROBE_MAX_CANONICAL_BYTES_V2,
  )) {
    throw new TypeError("Metadata probe exceeds its canonical byte cap");
  }
  return deepFreezePlatformReleaseJsonV2(result);
}

export const PlatformReleaseBootstrapDarwinMetadataProbeV2Schema = {
  parse(input: unknown): PlatformReleaseBootstrapDarwinMetadataProbeV2 {
    return parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2(input);
  },
  safeParse(input: unknown):
    | { success: true; data: PlatformReleaseBootstrapDarwinMetadataProbeV2 }
    | { success: false; error: z.ZodError } {
    try {
      return {
        success: true,
        data: parsePlatformReleaseBootstrapDarwinMetadataProbeCandidateV2(input),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof z.ZodError
          ? error
          : new z.ZodError([{
            code: "custom",
            path: [],
            message: error instanceof Error ? error.message : String(error),
          }]),
      };
    }
  },
};
