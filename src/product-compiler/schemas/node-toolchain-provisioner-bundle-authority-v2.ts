import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import { GitObjectHashSchema, Sha256Schema } from "./common-v1.js";
import { NodeToolchainPrivateTreeReceiptV2Schema } from "./node-toolchain-private-tree-v2.js";

export const NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_RECEIPT_V2_SCHEMA =
  "setfarm.node-toolchain-provisioner-bundle-authority-receipt.v2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_VERSION_V2 = "2.0.0" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_REF_V2 =
  "AUTH_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2 =
  "src/product-compiler/node-toolchain-provisioner-bundle-builder-v2.mjs" as const;
export const NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_BYTES_V2 = 32 * 1024 * 1024;
export const NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_METADATA_BYTES_V2 = 4 * 1024 * 1024;

const ByteLengthV2Schema = z.number().int().positive();
const CountV2Schema = z.number().int().nonnegative();
const PackageVersionV2Schema = z.string().min(1).max(100)
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/);
const NpmIntegrityV2Schema = z.string().min(32).max(512).regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/);
const SafeLocatorV2Schema = z.string().min(1).max(1_024)
  .refine((value) => (
    value === "."
    || (
      !value.startsWith("/")
      && !value.endsWith("/")
      && !value.includes("//")
      && !value.includes("\\")
      && !value.includes("\0")
      && !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    )
  ), "Expected one normalized relative package locator");

const ExactSourceRefV2Schema = z.object({
  schema: z.literal("setfarm.source-artifact-ref.v1"),
  locator: z.enum([
    "package.json",
    "package-lock.json",
    "src/product-compiler/node-toolchain-provisioner-bootstrap-entry-v2.ts",
    NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2,
  ]),
  mediaType: z.enum(["application/json", "text/typescript", "text/javascript"]),
  byteLength: ByteLengthV2Schema.max(16 * 1024 * 1024),
  hash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedMediaType = value.locator.endsWith(".json")
    ? "application/json"
    : value.locator.endsWith(".ts")
      ? "text/typescript"
      : "text/javascript";
  if (value.mediaType !== expectedMediaType) {
    context.addIssue({
      code: "custom",
      path: ["mediaType"],
      message: "Bundle source media type must equal its exact locator",
    });
  }
});

const NpmPackageContentTreeV2Schema = z.object({
  packageName: z.string().min(1).max(214),
  version: PackageVersionV2Schema,
  registryTarballUrl: z.string().url().max(1_024)
    .regex(/^https:\/\/registry\.npmjs\.org\//),
  registryIntegrity: NpmIntegrityV2Schema,
  registryTarballSha256: Sha256Schema,
  registryContentTreeHash: Sha256Schema,
  installedContentTreeHash: Sha256Schema,
  fileCount: CountV2Schema.refine((value) => value > 0),
  directoryCount: CountV2Schema.refine((value) => value > 0),
  totalBytes: ByteLengthV2Schema.max(128 * 1024 * 1024),
  admissionPolicy: z.enum([
    "exact_registry_tree_no_links_private_copy_v2",
    "exact_registry_tree_with_official_binary_replacement_private_copy_v2",
    "exact_registry_tree_official_binary_pair_private_copy_v2",
  ]),
}).strict();

export function hashNodeToolchainProvisionerBundleDependencyClosureV2(
  value: Readonly<{
    platformPackageName: string;
    esbuild: unknown;
    platformBinary: unknown;
    zod: unknown;
    privateMaterializationPolicy: string;
  }>,
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bundle-dependency-closure-hash.v2",
    platformPackageName: value.platformPackageName,
    esbuild: value.esbuild,
    platformBinary: value.platformBinary,
    zod: value.zod,
    privateMaterializationPolicy: value.privateMaterializationPolicy,
  });
}

export function hashNodeToolchainProvisionerBundleInputSetV2(
  inputLocators: readonly string[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bundle-input-set-hash.v2",
    inputLocators,
  });
}

export function hashNodeToolchainProvisionerBundleExternalSetV2(
  externalNodeBuiltins: readonly string[],
): string {
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bundle-external-set-hash.v2",
    externalNodeBuiltins,
  });
}

const BundleExecutionV2Schema = z.object({
  executionRef: z.enum(["first", "second"]),
  exitCode: z.literal(0),
  stdoutBytes: z.literal(0),
  stderrBytes: z.literal(0),
  outputHash: Sha256Schema,
  outputByteLength: ByteLengthV2Schema.max(NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_BYTES_V2),
  metadataHash: Sha256Schema,
  metadataByteLength: ByteLengthV2Schema.max(
    NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_METADATA_BYTES_V2,
  ),
}).strict();

const ExactDependencyContractsV2 = Object.freeze({
  zod: Object.freeze({
    packageName: "zod",
    version: "4.4.3",
    registryTarballUrl: "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
    registryIntegrity:
      "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==",
    registryTarballSha256: "ee38f17f533fd500610685a483ae2f413c26f4eb33a51684314563c8d60f279c",
    registryContentTreeHash: "03a95676d38475d1c82e468c54411837df13ef371b89d35c4f02bbdf6d95502d",
    installedContentTreeHash: "03a95676d38475d1c82e468c54411837df13ef371b89d35c4f02bbdf6d95502d",
    fileCount: 718,
    directoryCount: 30,
    totalBytes: 4_558_122,
    admissionPolicy: "exact_registry_tree_no_links_private_copy_v2",
  }),
  arm64: Object.freeze({
    esbuild: Object.freeze({
      packageName: "esbuild",
      version: "0.28.1",
      registryTarballUrl: "https://registry.npmjs.org/esbuild/-/esbuild-0.28.1.tgz",
      registryIntegrity:
        "sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==",
      registryTarballSha256: "eb8ef756f8299d16d5c8b35678606d715ba29923f500db7b37c181310eed40a5",
      registryContentTreeHash: "246cd05c93f9e450cb7287e43420c71f2f9fe43968959162a44d0b1b8a506272",
      installedContentTreeHash: "aab461c4785da4548c406c0790920290f4cd427ff48b8821cedae10d7a8e7e99",
      fileCount: 7,
      directoryCount: 3,
      totalBytes: 10_711_381,
      admissionPolicy: "exact_registry_tree_with_official_binary_replacement_private_copy_v2",
    }),
    platform: Object.freeze({
      packageName: "@esbuild/darwin-arm64",
      version: "0.28.1",
      registryTarballUrl:
        "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.28.1.tgz",
      registryIntegrity:
        "sha512-TZbWkQY7kvTAXbXUT7uVACR5cMHsDiSz9z7ZKAX/RTq/WJEk3QyRr0wZpNhBDX+/0CtdqUIJlOiodQcta6tY3Q==",
      registryTarballSha256: "5d64cc9bc527d598450b5f8d47ff293eb9f3aea38dd9eff67fd55d228c5ccb43",
      registryContentTreeHash: "2e2991067e1f8c4a846c3b2719445b350b3bc6e657c137e7c4c6d87aa4de7fbb",
      installedContentTreeHash: "2e2991067e1f8c4a846c3b2719445b350b3bc6e657c137e7c4c6d87aa4de7fbb",
      fileCount: 3,
      directoryCount: 2,
      totalBytes: 10_574_305,
      admissionPolicy: "exact_registry_tree_official_binary_pair_private_copy_v2",
    }),
  }),
  x64: Object.freeze({
    esbuild: Object.freeze({
      packageName: "esbuild",
      version: "0.28.1",
      registryTarballUrl: "https://registry.npmjs.org/esbuild/-/esbuild-0.28.1.tgz",
      registryIntegrity:
        "sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==",
      registryTarballSha256: "eb8ef756f8299d16d5c8b35678606d715ba29923f500db7b37c181310eed40a5",
      registryContentTreeHash: "246cd05c93f9e450cb7287e43420c71f2f9fe43968959162a44d0b1b8a506272",
      installedContentTreeHash: "af511c7328a71ae500343ecb957ee64af93fb7b1ac976c7a759c15347d20178b",
      fileCount: 7,
      directoryCount: 3,
      totalBytes: 11_768_467,
      admissionPolicy: "exact_registry_tree_with_official_binary_replacement_private_copy_v2",
    }),
    platform: Object.freeze({
      packageName: "@esbuild/darwin-x64",
      version: "0.28.1",
      registryTarballUrl:
        "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.28.1.tgz",
      registryIntegrity:
        "sha512-zfdzgK9ACBNZLI/CyHTOx81SyNbM6YXn7rxSgX97VjyiPl9W1i4Ka4fgKECEoFCKGpvBj5qArWIGgQjOwkgskQ==",
      registryTarballSha256: "4cc582287781c171f5ac2d216dc15ab1c40bc83bff59803211a68b66e0c762cb",
      registryContentTreeHash: "68b19e56db45a17d1ec12b5a244040b007867955becf7e814dad6ba45d4d5e69",
      installedContentTreeHash: "68b19e56db45a17d1ec12b5a244040b007867955becf7e814dad6ba45d4d5e69",
      fileCount: 3,
      directoryCount: 2,
      totalBytes: 11_631_379,
      admissionPolicy: "exact_registry_tree_official_binary_pair_private_copy_v2",
    }),
  }),
});

function equalsExactDependencyContract(
  observed: Record<string, unknown>,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  const observedKeys = Object.keys(observed).sort();
  const expectedKeys = Object.keys(expected).sort();
  return observedKeys.length === expectedKeys.length
    && observedKeys.every((key, index) => (
      key === expectedKeys[index]
      && observed[key] === expected[key]
    ));
}

const NodeToolchainProvisionerBundleAuthorityReceiptIdentityV2Schema = z.object({
  schema: z.literal(NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_RECEIPT_V2_SCHEMA),
  receiptVersion: z.literal(NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_VERSION_V2),
  authorityRef: z.literal(NODE_TOOLCHAIN_PROVISIONER_BUNDLE_AUTHORITY_REF_V2),
  admissionScope: z.enum(["production_release", "test_fixture"]),
  status: z.literal("built_reproducible_verified"),
  release: z.object({
    codeSha: GitObjectHashSchema,
    sourceTreeHash: GitObjectHashSchema,
    branch: z.string().min(1).max(255),
    originMainSha: GitObjectHashSchema.nullable(),
    dirty: z.boolean(),
    packageName: z.literal("setfarm"),
    packageVersion: PackageVersionV2Schema,
    sourcePolicy: z.literal("exact_git_archive_head_no_links_v2"),
  }).strict(),
  sources: z.object({
    entrypoint: ExactSourceRefV2Schema,
    packageJson: ExactSourceRefV2Schema,
    packageLock: ExactSourceRefV2Schema,
    builder: ExactSourceRefV2Schema,
  }).strict(),
  runtime: z.object({
    sourcePrivateTree: NodeToolchainPrivateTreeReceiptV2Schema,
    nodeLocator: z.literal("bin/node"),
    nodeHash: Sha256Schema,
    nodeByteLength: ByteLengthV2Schema.max(128 * 1024 * 1024),
    executionPolicy: z.literal("authenticated_private_node_direct_exec_v2"),
  }).strict(),
  dependencyClosure: z.object({
    contractRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BUNDLE_DEPENDENCY_CLOSURE_V2"),
    platformPackageName: z.enum(["@esbuild/darwin-arm64", "@esbuild/darwin-x64"]),
    esbuild: NpmPackageContentTreeV2Schema,
    platformBinary: NpmPackageContentTreeV2Schema,
    zod: NpmPackageContentTreeV2Schema,
    privateMaterializationPolicy: z.literal(
      "fresh_0700_root_exclusive_files_fsync_exact_tree_v2",
    ),
    closureHash: Sha256Schema,
  }).strict(),
  build: z.object({
    contractRef: z.literal("BUILD_NODE_TOOLCHAIN_PROVISIONER_BUNDLE_V2"),
    bundlerPackage: z.literal("esbuild"),
    bundlerVersion: z.literal("0.28.1"),
    format: z.literal("cjs"),
    platform: z.literal("node"),
    target: z.literal("node22"),
    bundle: z.literal(true),
    treeShaking: z.literal(true),
    sourcemap: z.literal(false),
    legalComments: z.literal("none"),
    charset: z.literal("utf8"),
    ambientEnvironment: z.literal("discard_all"),
    stagePolicy: z.literal("private_fresh_git_and_dependency_snapshot_v2"),
    executionAuthority: z.enum(["authenticated_private_runtime", "test_adapter"]),
    executions: z.tuple([BundleExecutionV2Schema, BundleExecutionV2Schema]),
  }).strict(),
  output: z.object({
    artifactRef: z.literal("NODE_TOOLCHAIN_PROVISIONER_BOOTSTRAP_BUNDLE_V2"),
    mediaType: z.literal("application/javascript"),
    sha256: Sha256Schema,
    byteLength: ByteLengthV2Schema.max(NODE_TOOLCHAIN_PROVISIONER_BUNDLE_MAX_BYTES_V2),
    inputLocators: z.array(SafeLocatorV2Schema).min(1).max(2_000),
    inputSetHash: Sha256Schema,
    externalNodeBuiltins: z.array(z.string().regex(/^node:[a-z0-9_./-]+$/)).min(1).max(256),
    externalSetHash: Sha256Schema,
    reproducibilityPolicy: z.literal("two_fresh_processes_byte_identical_v2"),
  }).strict(),
}).strict();

export type NodeToolchainProvisionerBundleAuthorityReceiptHashPayloadV2 = z.infer<
  typeof NodeToolchainProvisionerBundleAuthorityReceiptIdentityV2Schema
>;

export function hashNodeToolchainProvisionerBundleAuthorityReceiptV2(
  value:
    | NodeToolchainProvisionerBundleAuthorityReceiptHashPayloadV2
    | NodeToolchainProvisionerBundleAuthorityReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-bundle-authority-receipt-hash.v2",
    receipt,
  });
}

export const NodeToolchainProvisionerBundleAuthorityReceiptV2Schema =
  NodeToolchainProvisionerBundleAuthorityReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const runtime = value.runtime.sourcePrivateTree;
    const [first, second] = value.build.executions;
    const expectedPlatformPackage = runtime.inventory.distribution.artifact.architecture === "arm64"
      ? "@esbuild/darwin-arm64"
      : "@esbuild/darwin-x64";
    const expectedDependencies = runtime.inventory.distribution.artifact.architecture === "arm64"
      ? ExactDependencyContractsV2.arm64
      : ExactDependencyContractsV2.x64;
    const sortedInputs = [...value.output.inputLocators].sort();
    const sortedExternals = [...value.output.externalNodeBuiltins].sort();
    if (
      value.runtime.nodeHash !== runtime.tree.node.contentHash
      || value.runtime.nodeByteLength !== runtime.tree.node.byteLength
      || value.dependencyClosure.platformPackageName !== expectedPlatformPackage
      || value.dependencyClosure.esbuild.packageName !== "esbuild"
      || value.dependencyClosure.esbuild.version !== "0.28.1"
      || value.dependencyClosure.platformBinary.packageName !== expectedPlatformPackage
      || value.dependencyClosure.platformBinary.version !== "0.28.1"
      || value.dependencyClosure.zod.packageName !== "zod"
      || value.dependencyClosure.zod.version !== "4.4.3"
      || !equalsExactDependencyContract(value.dependencyClosure.esbuild, expectedDependencies.esbuild)
      || !equalsExactDependencyContract(
        value.dependencyClosure.platformBinary,
        expectedDependencies.platform,
      )
      || !equalsExactDependencyContract(value.dependencyClosure.zod, ExactDependencyContractsV2.zod)
    ) {
      context.addIssue({
        code: "custom",
        message: "Bundle receipt must join one exact runtime architecture and dependency closure",
      });
    }
    if (
      first.executionRef !== "first"
      || second.executionRef !== "second"
      || first.outputHash !== second.outputHash
      || first.outputHash !== value.output.sha256
      || first.outputByteLength !== second.outputByteLength
      || first.outputByteLength !== value.output.byteLength
      || first.metadataHash !== second.metadataHash
      || first.metadataByteLength !== second.metadataByteLength
      || new Set(value.output.inputLocators).size !== value.output.inputLocators.length
      || sortedInputs.some((entry, index) => entry !== value.output.inputLocators[index])
      || new Set(value.output.externalNodeBuiltins).size
        !== value.output.externalNodeBuiltins.length
      || sortedExternals.some((entry, index) => entry !== value.output.externalNodeBuiltins[index])
      || value.output.inputSetHash
        !== hashNodeToolchainProvisionerBundleInputSetV2(value.output.inputLocators)
      || value.output.externalSetHash
        !== hashNodeToolchainProvisionerBundleExternalSetV2(
          value.output.externalNodeBuiltins,
        )
    ) {
      context.addIssue({
        code: "custom",
        path: ["output"],
        message: "Bundle output must bind two identical executions and canonical input sets",
      });
    }
    if (
      value.sources.entrypoint.locator
        !== "src/product-compiler/node-toolchain-provisioner-bootstrap-entry-v2.ts"
      || value.sources.packageJson.locator !== "package.json"
      || value.sources.packageLock.locator !== "package-lock.json"
      || value.sources.builder.locator
        !== NODE_TOOLCHAIN_PROVISIONER_BUNDLE_BUILDER_SOURCE_LOCATOR_V2
    ) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Bundle source roles must equal their exact release locators",
      });
    }
    if (
      value.dependencyClosure.closureHash
      !== hashNodeToolchainProvisionerBundleDependencyClosureV2(
        value.dependencyClosure,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["dependencyClosure", "closureHash"],
        message: "Bundle dependency closure hash must bind every exact package tree",
      });
    }
    if (
      (value.admissionScope === "production_release" && (
        value.release.branch !== "main"
        || value.release.dirty
        || value.release.originMainSha !== value.release.codeSha
        || runtime.admissionScope !== "production_distribution"
        || value.build.executionAuthority !== "authenticated_private_runtime"
      ))
      || (value.admissionScope === "test_fixture" && (
        runtime.admissionScope !== "test_fixture"
        || value.build.executionAuthority !== "test_adapter"
      ))
    ) {
      context.addIssue({
        code: "custom",
        path: ["admissionScope"],
        message: "Bundle authority scope must equal its Git and private runtime authority",
      });
    }
    if (value.receiptHash !== hashNodeToolchainProvisionerBundleAuthorityReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Bundle authority receipt hash must bind its complete identity",
      });
    }
  });

export type NodeToolchainProvisionerBundleAuthorityReceiptV2 = z.infer<
  typeof NodeToolchainProvisionerBundleAuthorityReceiptV2Schema
>;
