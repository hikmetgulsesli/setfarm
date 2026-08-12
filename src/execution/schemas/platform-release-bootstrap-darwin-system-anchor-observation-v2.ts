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

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OBSERVATION_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-system-anchor-observation.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-system-anchor-parent-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-system-anchor-file-observation-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_SNAPSHOT_HASH_V2_SCHEMA =
  "setfarm.platform-release-bootstrap-darwin-system-anchor-snapshot-hash.v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_CANONICAL_BYTES_V2 =
  512 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_FILE_BYTES_V2 =
  16 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_PARENT_BYTES_V2 =
  64 * 1024 * 1024;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_REF_V2 =
  "ABI_PLATFORM_RELEASE_VERIFY_SYSTEM_ANCHORS_V2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_IMPLEMENTATION_SCOPE_V2 =
  "test_fixture_direct_descriptor_capture_v2" as const;
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_TRUST_CONCLUSION_V2 =
  "characterization_only" as const;

const operationAbi = PLATFORM_RELEASE_BOOTSTRAP_OPERATION_ABI_SET_V2.operations.find(
  (operation) => operation.abiRef
    === PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_REF_V2,
);
if (operationAbi === undefined) {
  throw new Error("Code-owned system-anchor operation ABI is missing");
}
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_HASH_V2 =
  operationAbi.operationHash;

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_DEFINITIONS_V2 = Object.freeze([
  Object.freeze({ parentRef: "HOST_SYSTEM_BIN_PARENT_V2", absoluteLocator: "/bin" }),
  Object.freeze({ parentRef: "HOST_SYSTEM_USR_BIN_PARENT_V2", absoluteLocator: "/usr/bin" }),
] as const);
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_DEFINITIONS_V2 = Object.freeze([
  Object.freeze({
    fileRef: "HOST_SYSTEM_CHMOD_EXECUTABLE_V2",
    parentRef: "HOST_SYSTEM_BIN_PARENT_V2",
    absoluteLocator: "/bin/chmod",
  }),
  Object.freeze({
    fileRef: "HOST_SYSTEM_LS_EXECUTABLE_V2",
    parentRef: "HOST_SYSTEM_BIN_PARENT_V2",
    absoluteLocator: "/bin/ls",
  }),
  Object.freeze({
    fileRef: "HOST_SYSTEM_SANDBOX_EXECUTABLE_V2",
    parentRef: "HOST_SYSTEM_USR_BIN_PARENT_V2",
    absoluteLocator: "/usr/bin/sandbox-exec",
  }),
  Object.freeze({
    fileRef: "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
    parentRef: "HOST_SYSTEM_USR_BIN_PARENT_V2",
    absoluteLocator: "/usr/bin/xattr",
  }),
] as const);
export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_LOGICAL_BINDINGS_V2 = Object.freeze([
  Object.freeze({
    roleRef: "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2",
    fileRef: "HOST_SYSTEM_CHMOD_EXECUTABLE_V2",
  }),
  Object.freeze({
    roleRef: "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2",
    fileRef: "HOST_SYSTEM_LS_EXECUTABLE_V2",
  }),
  Object.freeze({
    roleRef: "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2",
    fileRef: "HOST_SYSTEM_SANDBOX_EXECUTABLE_V2",
  }),
  Object.freeze({
    roleRef: "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2",
    fileRef: "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
  }),
  Object.freeze({
    roleRef: "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2",
    fileRef: "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
  }),
] as const);

export const PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_POLICY_HASH_V2 =
  hashCanonicalJson({
    schema:
      "setfarm.platform-release-bootstrap-darwin-system-anchor-policy.v2",
    policy: "two_exact_parents_four_physical_files_five_logical_roles_v2",
    parents: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_DEFINITIONS_V2,
    files: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_DEFINITIONS_V2,
    logicalBindings: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_LOGICAL_BINDINGS_V2,
    descriptorCapture:
      "lstat_open_nofollow_cloexec_fstat_bounded_read_pre_post_v2",
    maxFileBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_FILE_BYTES_V2,
    maxParentBytes: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_PARENT_BYTES_V2,
    mutation: "forbidden",
  });

const CanonicalDecimalV2Schema = z.string().min(1).max(80)
  .regex(/^(?:0|[1-9][0-9]*)$/u);
const ModeV2Schema = z.string().regex(/^[0-7]{4}$/u);
const ParentRefV2Schema = z.enum([
  "HOST_SYSTEM_BIN_PARENT_V2",
  "HOST_SYSTEM_USR_BIN_PARENT_V2",
]);
const FileRefV2Schema = z.enum([
  "HOST_SYSTEM_CHMOD_EXECUTABLE_V2",
  "HOST_SYSTEM_LS_EXECUTABLE_V2",
  "HOST_SYSTEM_SANDBOX_EXECUTABLE_V2",
  "HOST_SYSTEM_XATTR_EXECUTABLE_V2",
]);
const RoleRefV2Schema = z.enum([
  "HOST_COMPOSITION_ACL_CLEAR_EXECUTABLE_V2",
  "HOST_COMPOSITION_ACL_OBSERVER_EXECUTABLE_V2",
  "HOST_COMPOSITION_SANDBOX_EXECUTABLE_V2",
  "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2",
  "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2",
]);
const LocatorV2Schema = z.enum([
  "/bin",
  "/usr/bin",
  "/bin/chmod",
  "/bin/ls",
  "/usr/bin/sandbox-exec",
  "/usr/bin/xattr",
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
  mode: ModeV2Schema,
  linkCount: z.number().int().positive().safe(),
  byteLength: z.number().int().nonnegative().safe()
    .max(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_PARENT_BYTES_V2),
  contentHash: Sha256Schema,
  modifiedTimeNanoseconds: CanonicalDecimalV2Schema,
  changedTimeNanoseconds: CanonicalDecimalV2Schema,
}).strict();

type StableIdentityV2 = z.infer<typeof StableIdentityV2Schema>;
type MutableFingerprintV2 = z.infer<typeof MutableFingerprintV2Schema>;

const ParentObservationIdentityV2Schema = z.object({
  parentRef: ParentRefV2Schema,
  absoluteLocator: z.enum(["/bin", "/usr/bin"]),
  stableIdentity: StableIdentityV2Schema.extend({ objectKind: z.literal("directory") }),
  mutableFingerprint: MutableFingerprintV2Schema,
  directEntryNamesHash: Sha256Schema,
}).strict();
const ParentObservationV2Schema = ParentObservationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (value.observationHash !== hashSystemAnchorParentObservationV2(identity)) {
    context.addIssue({ code: "custom", path: ["observationHash"], message: "System parent hash mismatch" });
  }
  if (value.mutableFingerprint.contentHash !== value.directEntryNamesHash) {
    context.addIssue({ code: "custom", path: ["mutableFingerprint", "contentHash"], message: "Parent mutable content must bind its entry-name commitment" });
  }
});
export type PlatformReleaseBootstrapDarwinSystemAnchorParentObservationV2 =
  z.infer<typeof ParentObservationV2Schema>;

const FileObservationIdentityV2Schema = z.object({
  fileRef: FileRefV2Schema,
  parentRef: ParentRefV2Schema,
  absoluteLocator: z.enum([
    "/bin/chmod",
    "/bin/ls",
    "/usr/bin/sandbox-exec",
    "/usr/bin/xattr",
  ]),
  parentIdentityHash: Sha256Schema,
  stableIdentity: StableIdentityV2Schema.extend({ objectKind: z.literal("ordinary_file") }),
  mutableFingerprint: MutableFingerprintV2Schema,
}).strict();
const FileObservationV2Schema = FileObservationIdentityV2Schema.extend({
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { observationHash: _observationHash, ...identity } = value;
  if (value.observationHash !== hashSystemAnchorFileObservationV2(identity)) {
    context.addIssue({ code: "custom", path: ["observationHash"], message: "System file hash mismatch" });
  }
});
export type PlatformReleaseBootstrapDarwinSystemAnchorFileObservationV2 =
  z.infer<typeof FileObservationV2Schema>;

const LogicalBindingV2Schema = z.object({
  roleRef: RoleRefV2Schema,
  fileRef: FileRefV2Schema,
}).strict();
type LogicalBindingV2 = z.infer<typeof LogicalBindingV2Schema>;

const SnapshotIdentityV2Schema = z.object({
  parents: z.tuple([ParentObservationV2Schema, ParentObservationV2Schema]),
  files: z.tuple([
    FileObservationV2Schema,
    FileObservationV2Schema,
    FileObservationV2Schema,
    FileObservationV2Schema,
  ]),
  logicalBindings: z.tuple([
    LogicalBindingV2Schema,
    LogicalBindingV2Schema,
    LogicalBindingV2Schema,
    LogicalBindingV2Schema,
    LogicalBindingV2Schema,
  ]),
}).strict();
const SnapshotV2Schema = SnapshotIdentityV2Schema.extend({
  snapshotHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const { snapshotHash: _snapshotHash, ...identity } = value;
  if (value.snapshotHash !== hashSystemAnchorSnapshotV2(identity)) {
    context.addIssue({ code: "custom", path: ["snapshotHash"], message: "System-anchor snapshot hash mismatch" });
  }
  const expectedParents = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_DEFINITIONS_V2;
  const expectedFiles = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_DEFINITIONS_V2;
  const expectedBindings = PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_LOGICAL_BINDINGS_V2;
  if (canonicalJsonStringify(value.parents.map(({ parentRef, absoluteLocator }) => ({ parentRef, absoluteLocator })))
      !== canonicalJsonStringify(expectedParents)
    || canonicalJsonStringify(value.files.map(({ fileRef, parentRef, absoluteLocator }) => ({ fileRef, parentRef, absoluteLocator })))
      !== canonicalJsonStringify(expectedFiles)
    || canonicalJsonStringify(value.logicalBindings) !== canonicalJsonStringify(expectedBindings)) {
    context.addIssue({ code: "custom", path: ["files"], message: "System-anchor topology or alias binding drift" });
  }
  const hosts = [
    ...value.parents.map((parent) => parent.stableIdentity.hostIdentityHash),
    ...value.files.map((file) => file.stableIdentity.hostIdentityHash),
  ];
  if (new Set(hosts).size !== 1) {
    context.addIssue({ code: "custom", path: ["parents"], message: "System anchors must share one host identity" });
  }
  const parentByRef = new Map(value.parents.map((parent) => [parent.parentRef, parent]));
  for (const file of value.files) {
    const parent = parentByRef.get(file.parentRef);
    if (file.stableIdentity.objectKind !== "ordinary_file"
      || file.parentRef !== (file.absoluteLocator.startsWith("/bin/")
        ? "HOST_SYSTEM_BIN_PARENT_V2" : "HOST_SYSTEM_USR_BIN_PARENT_V2")
      || parent?.stableIdentity.hostIdentityHash
        !== file.stableIdentity.hostIdentityHash) {
      context.addIssue({ code: "custom", path: ["files"], message: "System file parent join is invalid" });
    }
    if (parent === undefined
      || file.parentIdentityHash !== hashSystemAnchorParentStableIdentityV2(parent.stableIdentity)) {
      context.addIssue({ code: "custom", path: ["files"], message: "System file must bind its exact physical parent" });
    }
    if (file.mutableFingerprint.ownerUid !== 0
      || file.mutableFingerprint.ownerGid !== 0
      || file.mutableFingerprint.mode !== "0755"
      || file.mutableFingerprint.linkCount !== 1
      || file.mutableFingerprint.byteLength <= 0
      || file.mutableFingerprint.byteLength > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_FILE_BYTES_V2) {
      context.addIssue({ code: "custom", path: ["files"], message: "System file mutable policy is not exact" });
    }
  }
  for (const parent of value.parents) {
    if (parent.mutableFingerprint.ownerUid !== 0
      || parent.mutableFingerprint.ownerGid !== 0
      || parent.mutableFingerprint.mode !== "0755"
      || parent.mutableFingerprint.byteLength > PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_PARENT_BYTES_V2) {
      context.addIssue({ code: "custom", path: ["parents"], message: "System parent mutable policy is not exact" });
    }
  }
  if (new Set(value.parents.map((parent) => `${parent.stableIdentity.device}:${parent.stableIdentity.inode}`)).size !== 2
    || new Set(value.files.map((file) => `${file.stableIdentity.device}:${file.stableIdentity.inode}`)).size !== 4) {
    context.addIssue({ code: "custom", path: ["files"], message: "System anchors must remain physically distinct" });
  }
  const xattrBindings = value.logicalBindings.filter((binding) =>
    binding.roleRef === "HOST_COMPOSITION_XATTR_CLEAR_EXECUTABLE_V2"
      || binding.roleRef === "HOST_COMPOSITION_XATTR_OBSERVER_EXECUTABLE_V2");
  if (xattrBindings.length !== 2 || xattrBindings[0]!.fileRef !== xattrBindings[1]!.fileRef) {
    context.addIssue({ code: "custom", path: ["logicalBindings"], message: "Xattr logical aliases must share one physical file" });
  }
});
export type PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2 = z.infer<typeof SnapshotV2Schema>;

const IdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OBSERVATION_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("observed_test_fixture_unverified"),
  admissionScope: z.literal("test_fixture"),
  productionAuthority: z.literal(false),
  productionAdmission: z.literal("forbidden"),
  credentialUse: z.literal("none"),
  mutationAuthority: z.literal(false),
  trustConclusion: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_TRUST_CONCLUSION_V2),
  implementationScope: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_IMPLEMENTATION_SCOPE_V2),
  operationAbiRef: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_REF_V2),
  operationAbiHash: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_OPERATION_ABI_HASH_V2),
  hostCompositionReceiptHash: Sha256Schema,
  challengeHash: Sha256Schema,
  policyHash: z.literal(PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_POLICY_HASH_V2),
  observationOutcome: z.literal("system_anchors_observed"),
  before: SnapshotV2Schema,
  after: SnapshotV2Schema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = hashSystemAnchorObservationV2({
    before: value.before,
    after: value.after,
    observationOutcome: value.observationOutcome,
    policyHash: value.policyHash,
  });
  if (value.observationHash !== expected
    || canonicalJsonStringify(value.before) !== canonicalJsonStringify(value.after)) {
    context.addIssue({ code: "custom", path: ["observationHash"], message: "System-anchor pre/post fence or hash mismatch" });
  }
});

export type PlatformReleaseBootstrapDarwinSystemAnchorObservationHashPayloadV2 = z.infer<typeof IdentityV2Schema>;
export type PlatformReleaseBootstrapDarwinSystemAnchorObservationV2 =
  PlatformReleaseBootstrapDarwinSystemAnchorObservationHashPayloadV2 & Readonly<{ probeHash: string }>;

export function hashSystemAnchorDirectEntryNamesV2(entries: readonly string[]): string {
  return hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-system-anchor-direct-entry-names.v2", entries });
}
export function hashSystemAnchorParentStableIdentityV2(stableIdentity: StableIdentityV2): string {
  return hashCanonicalJson({
    schema: "setfarm.platform-release-bootstrap-darwin-system-anchor-parent-stable-identity.v2",
    stableIdentity,
  });
}
export function hashSystemAnchorParentObservationV2(value: Readonly<Omit<PlatformReleaseBootstrapDarwinSystemAnchorParentObservationV2, "observationHash">>): string {
  return hashCanonicalJson({ schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_PARENT_HASH_V2_SCHEMA, parent: value });
}
export function hashSystemAnchorFileObservationV2(value: Readonly<Omit<PlatformReleaseBootstrapDarwinSystemAnchorFileObservationV2, "observationHash">>): string {
  return hashCanonicalJson({ schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_FILE_HASH_V2_SCHEMA, file: value });
}
export function hashSystemAnchorSnapshotV2(value: Readonly<Omit<PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2, "snapshotHash">>): string {
  return hashCanonicalJson({ schema: PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_SNAPSHOT_HASH_V2_SCHEMA, snapshot: value });
}
export function hashSystemAnchorObservationV2(value: Readonly<{
  before: PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2;
  after: PlatformReleaseBootstrapDarwinSystemAnchorSnapshotV2;
  observationOutcome: "system_anchors_observed";
  policyHash: string;
}>): string {
  return hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-system-anchor-observation-hash.v2", observation: value });
}
export function hashPlatformReleaseBootstrapDarwinSystemAnchorObservationV2(value: Readonly<Record<string, unknown>>): string {
  const identity = { ...value };
  delete identity.probeHash;
  return hashCanonicalJson({ schema: "setfarm.platform-release-bootstrap-darwin-system-anchor-probe-hash.v2", probe: identity });
}

export function parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2(input: unknown): PlatformReleaseBootstrapDarwinSystemAnchorObservationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(input, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_CANONICAL_BYTES_V2);
  const candidate = { ...(snapshot as Record<string, unknown>) };
  const suppliedProbeHash = candidate.probeHash;
  delete candidate.probeHash;
  const parsed = IdentityV2Schema.parse(candidate);
  const probeHash = hashPlatformReleaseBootstrapDarwinSystemAnchorObservationV2(parsed);
  if (suppliedProbeHash !== undefined && suppliedProbeHash !== probeHash) {
    throw new z.ZodError([{ code: "custom", path: ["probeHash"], message: "System-anchor probe hash mismatch" }]);
  }
  const result = { ...parsed, probeHash };
  if (!platformReleaseCandidateFitsCanonicalCapV2(result, PLATFORM_RELEASE_BOOTSTRAP_DARWIN_SYSTEM_ANCHOR_MAX_CANONICAL_BYTES_V2)) {
    throw new TypeError("System-anchor observation exceeds its canonical byte cap");
  }
  return deepFreezePlatformReleaseJsonV2(result);
}

export const PlatformReleaseBootstrapDarwinSystemAnchorObservationV2Schema = {
  parse(input: unknown): PlatformReleaseBootstrapDarwinSystemAnchorObservationV2 {
    return parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2(input);
  },
  safeParse(input: unknown):
    | { success: true; data: PlatformReleaseBootstrapDarwinSystemAnchorObservationV2 }
    | { success: false; error: z.ZodError } {
    try {
      return { success: true, data: parsePlatformReleaseBootstrapDarwinSystemAnchorObservationCandidateV2(input) };
    } catch (error) {
      return { success: false, error: error instanceof z.ZodError ? error : new z.ZodError([{ code: "custom", path: [], message: error instanceof Error ? error.message : String(error) }]) };
    }
  },
};
