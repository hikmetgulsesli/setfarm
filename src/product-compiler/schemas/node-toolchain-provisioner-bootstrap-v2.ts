import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "./common-v1.js";
import { NodeToolchainPrivateTreeReceiptV2Schema } from "./node-toolchain-private-tree-v2.js";
import {
  NodeToolchainProvisionerBundleAuthorityReceiptV2Schema,
} from "./node-toolchain-provisioner-bundle-authority-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-manifest.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bootstrap-failure.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2" as const;

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2 =
  "/Library/Application Support/Setfarm/bootstrap/node-toolchain-provisioner-v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2 =
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST.v2.json" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2 =
  "bin/setfarm-node-toolchain-provisioner-v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2 =
  "lib/node-toolchain-provisioner-v2.cjs" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2 =
  "runtime/node" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2 =
  "src/product-compiler/node-toolchain-provisioner-bootstrap-entry-v2.ts" as const;

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_MANIFEST_BYTES_V2 = 4 * 1024 * 1024;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2 = 64 * 1024;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2 = 32 * 1024 * 1024;
export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2 = 128 * 1024 * 1024;

const ESBUILD_INTEGRITY_V2 =
  "sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==" as const;

const PosixIdentityV2Schema = z.number().int().nonnegative().max(2_147_483_647);
const ByteLengthV2Schema = z.number().int().positive();
const PackageVersionV2Schema = z.string().min(1).max(100)
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/);

const AbsolutePackageRootV2Schema = z.string().min(1).max(1_024)
  .regex(/^\/(?:[A-Za-z0-9 ._+-]+\/)*[A-Za-z0-9._+-]+$/)
  .refine((value) => !value.includes("//") && !value.split("/").includes(".."), {
    message: "Bootstrap root must be one normalized absolute safe locator",
  });

const ExactSourceRefV2Schema = z.object({
  schema: z.literal("setfarm.source-artifact-ref.v1"),
  locator: z.enum([
    NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2,
    "package.json",
    "package-lock.json",
  ]),
  mediaType: z.enum(["text/typescript", "application/json"]),
  byteLength: ByteLengthV2Schema.max(16 * 1024 * 1024),
  hash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedMediaType = value.locator === "package-lock.json" || value.locator === "package.json"
    ? "application/json"
    : "text/typescript";
  if (value.mediaType !== expectedMediaType) {
    context.addIssue({
      code: "custom",
      path: ["mediaType"],
      message: "Bootstrap build source media type must equal its exact locator",
    });
  }
});

const InstalledFileBaseV2Schema = z.object({
  sha256: Sha256Schema,
  byteLength: ByteLengthV2Schema,
  ownerUid: PosixIdentityV2Schema,
  ownerGid: PosixIdentityV2Schema,
  linkCount: z.literal(1),
}).strict();

const LauncherFileV2Schema = InstalledFileBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_LAUNCHER_LOCATOR_V2),
  mediaType: z.literal("text/x-shellscript"),
  byteLength: ByteLengthV2Schema.max(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_LAUNCHER_BYTES_V2),
  mode: z.literal("0555"),
}).strict();

const BundleFileV2Schema = InstalledFileBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_LOCATOR_V2),
  mediaType: z.literal("application/javascript"),
  byteLength: ByteLengthV2Schema.max(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_BUNDLE_BYTES_V2),
  mode: z.literal("0444"),
}).strict();

const RuntimeFileV2Schema = InstalledFileBaseV2Schema.safeExtend({
  artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_V2"),
  locator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_RUNTIME_LOCATOR_V2),
  mediaType: z.literal("application/x-mach-binary"),
  byteLength: ByteLengthV2Schema.max(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MAX_RUNTIME_BYTES_V2),
  mode: z.literal("0555"),
}).strict();

const NodeToolchainProvisionerBootstrapBuildIdentityV2Schema = z.object({
  contractRef: z.literal("BUILD_NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2"),
  sourceTreeHash: GitObjectHashSchema,
  entrypointSource: ExactSourceRefV2Schema,
  packageJsonSource: ExactSourceRefV2Schema,
  packageLockSource: ExactSourceRefV2Schema,
  authority: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("raw_test_fixture"),
      authorityRef: z.literal("TEST_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_INPUT_V2"),
      admissionScope: z.literal("test_fixture"),
    }).strict(),
    z.object({
      kind: z.literal("authenticated_bundle"),
      receipt: NodeToolchainProvisionerBundleAuthorityReceiptV2Schema,
    }).strict(),
  ]),
  bundler: z.object({
    packageName: z.literal("esbuild"),
    version: z.literal("0.28.1"),
    packageIntegrity: z.literal(ESBUILD_INTEGRITY_V2),
    format: z.literal("cjs"),
    platform: z.literal("node"),
    target: z.literal("node22"),
    bundle: z.literal(true),
    treeShaking: z.literal(true),
    sourcemap: z.literal(false),
    legalComments: z.literal("none"),
    externalDependencies: z.tuple([]),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBootstrapBuildHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapBuildIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapBuildV2(
  value:
    | NodeToolchainProvisionerBootstrapBuildHashPayloadV2
    | NodeToolchainProvisionerBootstrapBuildV2,
): string {
  const build = { ...value } as Record<string, unknown>;
  delete build.buildContractHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-build-hash.v2",
    build,
  });
}

export const NodeToolchainProvisionerBootstrapBuildV2Schema =
  NodeToolchainProvisionerBootstrapBuildIdentityV2Schema.safeExtend({
    buildContractHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.entrypointSource.locator
        !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ENTRYPOINT_SOURCE_LOCATOR_V2
      || value.packageJsonSource.locator !== "package.json"
      || value.packageLockSource.locator !== "package-lock.json"
      || value.buildContractHash !== hashNodeToolchainProvisionerBootstrapBuildV2(value)) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap build must bind distinct exact sources and its complete bundler contract",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapBuildV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapBuildV2Schema
>;

const NodeToolchainProvisionerBootstrapManifestIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_V2_SCHEMA),
  manifestVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2),
  admissionScope: z.enum(["production_root", "test_fixture"]),
  release: z.object({
    codeSha: GitObjectHashSchema,
    sourceTreeHash: GitObjectHashSchema,
    branch: z.string().min(1).max(255),
    dirty: z.boolean(),
    packageName: z.literal("setfarm"),
    packageVersion: PackageVersionV2Schema,
  }).strict(),
  build: NodeToolchainProvisionerBootstrapBuildV2Schema,
  distribution: z.object({
    manifestHash: Sha256Schema,
    artifactHash: Sha256Schema,
    architecture: z.enum(["arm64", "x64"]),
    sourcePrivateTree: NodeToolchainPrivateTreeReceiptV2Schema,
  }).strict(),
  layout: z.object({
    rootLocator: AbsolutePackageRootV2Schema,
    manifestLocator: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2),
    allowedRootEntries: z.tuple([
      z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_MANIFEST_LOCATOR_V2),
      z.literal("bin"),
      z.literal("lib"),
      z.literal("runtime"),
    ]),
    allowedDirectories: z.tuple([
      z.literal("."),
      z.literal("bin"),
      z.literal("lib"),
      z.literal("runtime"),
    ]),
    directoryMode: z.literal("0555"),
    manifestMode: z.literal("0444"),
    expectedOwnerUid: PosixIdentityV2Schema,
    expectedOwnerGid: PosixIdentityV2Schema,
    publicationPolicy: z.literal("root_owned_every_only_no_replace_fsync_manifest_last_v2"),
  }).strict(),
  files: z.object({
    launcher: LauncherFileV2Schema,
    bundle: BundleFileV2Schema,
    bootstrapRuntime: RuntimeFileV2Schema,
  }).strict(),
  launcher: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_ROOT_LAUNCHER_V2"),
    shell: z.literal("/bin/sh"),
    rootRequired: z.literal(true),
    ambientEnvironment: z.literal("discard_all"),
    directExec: z.literal(true),
    cwdPolicy: z.literal("fixed_verified_package_root"),
    systemTools: z.tuple([
      z.literal("/usr/bin/env"),
      z.literal("/usr/bin/id"),
      z.literal("/usr/bin/printf"),
      z.literal("/usr/bin/shasum"),
      z.literal("/usr/bin/stat"),
    ]),
    fixedEnvironment: z.object({
      HOME: z.literal("/var/empty"),
      LANG: z.literal("C"),
      LC_ALL: z.literal("C"),
      NO_COLOR: z.literal("1"),
      TMPDIR: z.literal("/private/var/tmp"),
      TZ: z.literal("UTC"),
    }).strict(),
  }).strict(),
  cli: z.object({
    contractSchema: z.literal("setfarm.node-toolchain-provisioner-cli-failure.v2"),
    contractVersion: z.literal("2.0.0"),
    authorityRef: z.literal("AUTH_NODE_TOOLCHAIN_PROVISIONER_CLI_V2"),
    commands: z.tuple([
      z.literal("inspect"),
      z.literal("plan_apply"),
      z.literal("plan_rollback"),
      z.literal("apply"),
      z.literal("verify"),
      z.literal("rollback"),
    ]),
    successOutput: z.literal("one_canonical_artifact_without_trailing_lf_v2"),
    failureOutput: z.literal("one_canonical_failure_without_trailing_lf_v2"),
    stderrAuthority: z.literal("non_authoritative_bounded_diagnostic"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBootstrapManifestHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapManifestIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapManifestV2(
  value:
    | NodeToolchainProvisionerBootstrapManifestHashPayloadV2
    | NodeToolchainProvisionerBootstrapManifestV2,
): string {
  const manifest = { ...value } as Record<string, unknown>;
  delete manifest.manifestHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-manifest-hash.v2",
    manifest,
  });
}

export const NodeToolchainProvisionerBootstrapManifestV2Schema =
  NodeToolchainProvisionerBootstrapManifestIdentityV2Schema.safeExtend({
    manifestHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const source = value.distribution.sourcePrivateTree;
    const ownerUid = value.layout.expectedOwnerUid;
    const ownerGid = value.layout.expectedOwnerGid;
    const files = [value.files.launcher, value.files.bundle, value.files.bootstrapRuntime];
    const buildAuthority = value.build.authority;
    if (
      value.release.sourceTreeHash !== value.build.sourceTreeHash
      || value.distribution.manifestHash !== source.inventory.distribution.manifest.manifestHash
      || value.distribution.artifactHash !== source.inventory.distribution.artifact.artifactHash
      || value.distribution.architecture
        !== source.inventory.distribution.artifact.architecture
      || value.files.bootstrapRuntime.sha256 !== source.tree.node.contentHash
      || value.files.bootstrapRuntime.byteLength !== source.tree.node.byteLength
      || files.some((file) => file.ownerUid !== ownerUid || file.ownerGid !== ownerGid)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bootstrap manifest must join one source tree, distribution, Node member and owner",
      });
    }
    if (buildAuthority.kind === "authenticated_bundle") {
      const bundle = buildAuthority.receipt;
      if (
        value.release.codeSha !== bundle.release.codeSha
        || value.release.sourceTreeHash !== bundle.release.sourceTreeHash
        || value.release.branch !== bundle.release.branch
        || value.release.dirty !== bundle.release.dirty
        || value.release.packageVersion !== bundle.release.packageVersion
        || value.build.entrypointSource.hash !== bundle.sources.entrypoint.hash
        || value.build.entrypointSource.byteLength !== bundle.sources.entrypoint.byteLength
        || value.build.packageJsonSource.hash !== bundle.sources.packageJson.hash
        || value.build.packageJsonSource.byteLength !== bundle.sources.packageJson.byteLength
        || value.build.packageLockSource.hash !== bundle.sources.packageLock.hash
        || value.build.packageLockSource.byteLength !== bundle.sources.packageLock.byteLength
        || value.files.bundle.sha256 !== bundle.output.sha256
        || value.files.bundle.byteLength !== bundle.output.byteLength
        || source.receiptHash !== bundle.runtime.sourcePrivateTree.receiptHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["build", "authority"],
          message: "Bootstrap manifest must exactly reproduce its authenticated bundle authority",
        });
      }
    }
    if (
      (value.admissionScope === "production_root"
        && (
          value.layout.rootLocator !== NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
          || ownerUid !== 0
          || ownerGid !== 0
          || value.release.branch !== "main"
          || value.release.dirty
          || source.admissionScope !== "production_distribution"
          || buildAuthority.kind !== "authenticated_bundle"
          || buildAuthority.receipt.admissionScope !== "production_release"
        ))
      || (value.admissionScope === "test_fixture"
        && (
          value.layout.rootLocator === NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ROOT_V2
          || source.admissionScope !== "test_fixture"
          || (buildAuthority.kind === "raw_test_fixture"
            && (value.release.branch !== "test_fixture" || !value.release.dirty))
          || (buildAuthority.kind === "authenticated_bundle"
            && buildAuthority.receipt.admissionScope !== "test_fixture")
        ))
    ) {
      context.addIssue({
        code: "custom",
        path: ["admissionScope"],
        message: "Bootstrap scope must equal its fixed root, owner and distribution authority",
      });
    }
    if (value.manifestHash !== hashNodeToolchainProvisionerBootstrapManifestV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["manifestHash"],
        message: "Bootstrap manifest hash must bind its complete release and package identity",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapManifestV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapManifestV2Schema
>;

export const NodeToolchainProvisionerBootstrapFailureCodeV2Schema = z.enum([
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_ROOT_REQUIRED",
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_FILE_INVALID",
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PACKAGE_FILE_MISMATCH",
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_MANIFEST_INVALID",
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_LAYOUT_INVALID",
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_PROCESS_INVALID",
  "NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_V2_INTERNAL_FAILURE",
]);

export type NodeToolchainProvisionerBootstrapFailureCodeV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapFailureCodeV2Schema
>;

const NodeToolchainProvisionerBootstrapFailureIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_FAILURE_V2_SCHEMA),
  failureVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_AUTHORITY_REF_V2),
  failureCode: NodeToolchainProvisionerBootstrapFailureCodeV2Schema,
  exitCode: z.literal(70),
}).strict();

export type NodeToolchainProvisionerBootstrapFailureHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapFailureIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBootstrapFailureV2(
  value:
    | NodeToolchainProvisionerBootstrapFailureHashPayloadV2
    | NodeToolchainProvisionerBootstrapFailureV2,
): string {
  const failure = { ...value } as Record<string, unknown>;
  delete failure.failureHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bootstrap-failure-hash.v2",
    failure,
  });
}

export const NodeToolchainProvisionerBootstrapFailureV2Schema =
  NodeToolchainProvisionerBootstrapFailureIdentityV2Schema.safeExtend({
    failureHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (value.failureHash !== hashNodeToolchainProvisionerBootstrapFailureV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["failureHash"],
        message: "Bootstrap failure hash mismatch",
      });
    }
  });

export type NodeToolchainProvisionerBootstrapFailureV2 = z.infer<
  typeof NodeToolchainProvisionerBootstrapFailureV2Schema
>;

export const NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_ESBUILD_INTEGRITY_V2 =
  ESBUILD_INTEGRITY_V2;
