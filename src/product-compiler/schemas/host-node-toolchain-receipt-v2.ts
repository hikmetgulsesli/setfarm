import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { Sha256Schema } from "./common-v1.js";
import {
  NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA,
  NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA,
} from "./node-scaffold-toolchain-catalog-v2.js";

export const HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA =
  "setfarm.host-node-toolchain-receipt.v2" as const;
export const HOST_NODE_EXECUTABLE_IDENTITY_V2_SCHEMA =
  "setfarm.host-node-executable-identity.v2" as const;
export const HOST_NPM_PACKAGE_CLOSURE_V2_SCHEMA =
  "setfarm.host-npm-package-closure.v2" as const;
export const HOST_NODE_TOOLCHAIN_RECEIPT_VERSION_V2 = "2.0.0" as const;
export const HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2 =
  "AUTH_NODE_SCAFFOLD_HOST_TOOLCHAIN_V2" as const;
export const HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2 = "2.0.0" as const;
export const HOST_NODE_TOOLCHAIN_MAX_DYNAMIC_LIBRARIES_V2 = 512;
export const HOST_NPM_PACKAGE_MAX_FILES_V2 = 20_000;
export const HOST_NPM_PACKAGE_MAX_DIRECTORIES_V2 = 5_000;
export const HOST_NPM_PACKAGE_MAX_TOTAL_BYTES_V2 = 512 * 1024 * 1024;

const VersionIdentityV2Schema = z.string().min(1).max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._+-]*$/, "Expected one canonical version identity");
const DecimalIdentityV2Schema = z.string().min(1).max(20)
  .regex(/^(?:0|[1-9][0-9]*)$/, "Expected one canonical decimal identity");
const PosixIdentityV2Schema = z.number().int().nonnegative().max(4_294_967_294);
const ReadOnlyFileModeV2Schema = z.enum(["0444", "0555"]);
const ReadOnlyOrTraversableDirectoryModeV2Schema = z.enum(["0555", "0755"]);

const HostNodeToolchainRequirementIdentityV2Schema = z.object({
  catalogSchema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_CATALOG_V2_SCHEMA),
  catalogHash: Sha256Schema,
  entrySchema: z.literal(NODE_SCAFFOLD_TOOLCHAIN_ENTRY_V2_SCHEMA),
  entryRef: z.enum([
    "NODE_SCAFFOLD_TOOLCHAIN_NODE_CLI_V2",
    "NODE_SCAFFOLD_TOOLCHAIN_NODE_EXPRESS_API_V2",
  ]),
  entryHash: Sha256Schema,
  profileId: z.enum([
    "PROFILE_NODE_CLI_STATELESS_EXACT_V2",
    "PROFILE_NODE_EXPRESS_API_STATELESS_EXACT_V2",
  ]),
  nodeExecutableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
  nodeCompatibilityRange: z.literal(">=22.13.0 <23"),
  npmExecutableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
  npmExactVersion: z.literal("10.9.8"),
}).strict();

export type HostNodeToolchainRequirementHashPayloadV2 = z.infer<
  typeof HostNodeToolchainRequirementIdentityV2Schema
>;

export function hashHostNodeToolchainRequirementV2(
  value: HostNodeToolchainRequirementHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.host-node-toolchain-requirement-hash.v2",
    requirement: value,
  });
}

export const HostNodeToolchainRequirementV2Schema =
  HostNodeToolchainRequirementIdentityV2Schema.extend({
    requirementHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { requirementHash: _requirementHash, ...identity } = value;
    if (value.requirementHash !== hashHostNodeToolchainRequirementV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["requirementHash"],
        message: "Host Node toolchain requirement hash must bind the exact code-owned catalog entry",
      });
    }
  });

export type HostNodeToolchainRequirementV2 = z.infer<
  typeof HostNodeToolchainRequirementV2Schema
>;

export const HostToolchainExactFileIdentityV2Schema = z.object({
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive().max(1024 * 1024 * 1024),
  mode: ReadOnlyFileModeV2Schema,
  ownerUid: PosixIdentityV2Schema,
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.literal(1),
}).strict();

export type HostToolchainExactFileIdentityV2 = z.infer<
  typeof HostToolchainExactFileIdentityV2Schema
>;

const HostNodeDynamicLibraryMemberV2Schema = z.object({
  memberRef: z.string().regex(/^HOST_NODE_NON_SYSTEM_DYLIB_[0-9]{4}$/),
  installNameHash: Sha256Schema,
  file: HostToolchainExactFileIdentityV2Schema,
}).strict();

const HostNodeDynamicLibraryClosureIdentityV2Schema = z.object({
  resolutionPolicy: z.literal("darwin_recursive_loader_graph_v2"),
  systemLibraryTrust: z.literal("exact_macos_build_identity"),
  memberCount: z.number().int().nonnegative()
    .max(HOST_NODE_TOOLCHAIN_MAX_DYNAMIC_LIBRARIES_V2),
  members: z.array(HostNodeDynamicLibraryMemberV2Schema)
    .max(HOST_NODE_TOOLCHAIN_MAX_DYNAMIC_LIBRARIES_V2),
}).strict();

export type HostNodeDynamicLibraryClosureHashPayloadV2 = z.infer<
  typeof HostNodeDynamicLibraryClosureIdentityV2Schema
>;

export function hashHostNodeDynamicLibraryClosureV2(
  value: HostNodeDynamicLibraryClosureHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.host-node-dynamic-library-closure-hash.v2",
    closure: value,
  });
}

export const HostNodeDynamicLibraryClosureV2Schema =
  HostNodeDynamicLibraryClosureIdentityV2Schema.extend({
    closureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.memberCount !== value.members.length) {
      context.addIssue({
        code: "custom",
        path: ["memberCount"],
        message: "Dynamic-library member count must equal the exact member list",
      });
    }
    const refs = value.members.map((member) => member.memberRef);
    if (refs.some((ref, index) => ref !== `HOST_NODE_NON_SYSTEM_DYLIB_${String(index + 1).padStart(4, "0")}`)) {
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "Dynamic libraries must use contiguous canonical member refs",
      });
    }
    const installNames = value.members.map((member) => member.installNameHash);
    if (new Set(installNames).size !== installNames.length
      || installNames.some((hash, index) => index > 0 && hash <= installNames[index - 1]!)) {
      context.addIssue({
        code: "custom",
        path: ["members"],
        message: "Dynamic libraries must have unique canonically sorted install-name hashes",
      });
    }
    const { closureHash: _closureHash, ...identity } = value;
    if (value.closureHash !== hashHostNodeDynamicLibraryClosureV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["closureHash"],
        message: "Dynamic-library closure hash must bind every exact member",
      });
    }
  });

const HostNodeExecutableIdentityV2ObjectSchema = z.object({
  schema: z.literal(HOST_NODE_EXECUTABLE_IDENTITY_V2_SCHEMA),
  executableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
  version: VersionIdentityV2Schema,
  modulesAbi: DecimalIdentityV2Schema,
  napiVersion: DecimalIdentityV2Schema,
  platform: z.literal("darwin"),
  architecture: z.enum(["arm64", "x64"]),
  executable: HostToolchainExactFileIdentityV2Schema,
  nonSystemDynamicLibraries: HostNodeDynamicLibraryClosureV2Schema,
}).strict();

export type HostNodeExecutableIdentityHashPayloadV2 = z.infer<
  typeof HostNodeExecutableIdentityV2ObjectSchema
>;

export function hashHostNodeExecutableIdentityV2(
  value: HostNodeExecutableIdentityHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.host-node-executable-identity-hash.v2",
    node: value,
  });
}

export const HostNodeExecutableIdentityV2Schema =
  HostNodeExecutableIdentityV2ObjectSchema.extend({
    identityHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { identityHash: _identityHash, ...identity } = value;
    if (value.identityHash !== hashHostNodeExecutableIdentityV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["identityHash"],
        message: "Host Node identity hash must bind the exact runtime and dynamic closure",
      });
    }
  });

export type HostNodeExecutableIdentityV2 = z.infer<
  typeof HostNodeExecutableIdentityV2Schema
>;

const HostNpmPackageTreeV2Schema = z.object({
  treeContract: z.literal("host_npm_package_tree_every_and_only_v2"),
  rootMode: ReadOnlyOrTraversableDirectoryModeV2Schema,
  fileCount: z.number().int().positive().max(HOST_NPM_PACKAGE_MAX_FILES_V2),
  directoryCount: z.number().int().nonnegative().max(HOST_NPM_PACKAGE_MAX_DIRECTORIES_V2),
  totalBytes: z.number().int().positive().max(HOST_NPM_PACKAGE_MAX_TOTAL_BYTES_V2),
  treeHash: Sha256Schema,
}).strict();

const HostNpmPackageClosureIdentityV2Schema = z.object({
  schema: z.literal(HOST_NPM_PACKAGE_CLOSURE_V2_SCHEMA),
  executableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
  packageName: z.literal("npm"),
  version: VersionIdentityV2Schema,
  rootOwnerUid: PosixIdentityV2Schema,
  rootOwnerGid: PosixIdentityV2Schema,
  cliLocator: z.literal("bin/npm-cli.js"),
  cli: HostToolchainExactFileIdentityV2Schema,
  packageJsonLocator: z.literal("package.json"),
  packageJson: HostToolchainExactFileIdentityV2Schema,
  builtinNpmrcLocator: z.literal("npmrc"),
  builtinNpmrc: HostToolchainExactFileIdentityV2Schema,
  packageTree: HostNpmPackageTreeV2Schema,
}).strict();

export type HostNpmPackageClosureHashPayloadV2 = z.infer<
  typeof HostNpmPackageClosureIdentityV2Schema
>;

export function hashHostNpmPackageClosureV2(
  value: HostNpmPackageClosureHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema: "setfarm.host-npm-package-closure-hash.v2",
    npm: value,
  });
}

export const HostNpmPackageClosureV2Schema =
  HostNpmPackageClosureIdentityV2Schema.extend({
    closureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { closureHash: _closureHash, ...identity } = value;
    if (value.closureHash !== hashHostNpmPackageClosureV2(identity)) {
      context.addIssue({
        code: "custom",
        path: ["closureHash"],
        message: "Host npm closure hash must bind its every-and-only package tree",
      });
    }
  });

export type HostNpmPackageClosureV2 = z.infer<
  typeof HostNpmPackageClosureV2Schema
>;

const HostNodeToolchainReceiptIdentityV2Schema = z.object({
  schema: z.literal(HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(HOST_NODE_TOOLCHAIN_RECEIPT_VERSION_V2),
  authorityRef: z.literal(HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2),
  authorityVersion: z.literal(HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2),
  status: z.literal("verified"),
  admissionScope: z.enum(["production_host", "test_fixture"]),
  filesystemProtection: z.enum([
    "root_owned_runtime_read_only",
    "test_fixture_only",
  ]),
  requirement: HostNodeToolchainRequirementV2Schema,
  host: z.object({
    platform: z.literal("darwin"),
    architecture: z.enum(["arm64", "x64"]),
    macosProductVersion: VersionIdentityV2Schema,
    macosBuildVersion: VersionIdentityV2Schema,
    darwinKernelRelease: VersionIdentityV2Schema,
  }).strict(),
  node: HostNodeExecutableIdentityV2Schema,
  npm: HostNpmPackageClosureV2Schema,
  probe: z.object({
    executionPolicy: z.literal("direct_exact_node_argv_deny_all_environment_v2"),
    shell: z.literal("forbidden"),
    timeoutMs: z.literal(5_000),
    maxStdoutBytes: z.literal(4_096),
    maxStderrBytes: z.literal(4_096),
    nodeProbeSourceHash: Sha256Schema,
    environmentContractHash: Sha256Schema,
  }).strict(),
  commandPathProjection: z.object({
    policy: z.literal("single_admitted_node_bin_then_exact_module_argv_v2"),
    orderedExecutableRefs: z.tuple([
      z.literal("TOOL_NODE_RUNTIME_V2"),
      z.literal("TOOL_NODE_NPM_CLI_V2"),
    ]),
    projectionHash: Sha256Schema,
  }).strict(),
}).strict();

export type HostNodeToolchainReceiptHashPayloadV2 = z.infer<
  typeof HostNodeToolchainReceiptIdentityV2Schema
>;

export function hashHostNodeToolchainReceiptV2(
  value: HostNodeToolchainReceiptHashPayloadV2 | HostNodeToolchainReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.host-node-toolchain-receipt-hash.v2",
    receipt,
  });
}

export const HostNodeToolchainReceiptV2Schema =
  HostNodeToolchainReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.node.executableRef !== value.requirement.nodeExecutableRef
      || value.npm.executableRef !== value.requirement.npmExecutableRef
      || value.npm.version !== value.requirement.npmExactVersion
      || value.node.platform !== value.host.platform
      || value.node.architecture !== value.host.architecture
    ) {
      context.addIssue({
        code: "custom",
        message: "Host toolchain receipt must join one exact requirement, host, Node and npm identity",
      });
    }
    if (
      (value.admissionScope === "production_host"
        && value.filesystemProtection !== "root_owned_runtime_read_only")
      || (value.admissionScope === "test_fixture"
        && value.filesystemProtection !== "test_fixture_only")
    ) {
      context.addIssue({
        code: "custom",
        path: ["filesystemProtection"],
        message: "Host toolchain filesystem protection must match its admission scope",
      });
    }
    if (
      value.admissionScope === "production_host"
      && (
        value.node.executable.ownerUid !== 0
        || value.npm.rootOwnerUid !== 0
        || value.node.nonSystemDynamicLibraries.members.some((member) => member.file.ownerUid !== 0)
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Production host toolchain files must be root-owned",
      });
    }
    if (value.receiptHash !== hashHostNodeToolchainReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Host Node toolchain receipt hash must bind the exact receipt",
      });
    }
  });

export type HostNodeToolchainReceiptV2 = z.infer<
  typeof HostNodeToolchainReceiptV2Schema
>;
