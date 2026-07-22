import {
  NODE_TOOLCHAIN_DISTRIBUTION_ARTIFACT_V2_SCHEMA,
  NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA,
  NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2,
  NodeToolchainDistributionManifestV2Schema,
  hashNodeToolchainDistributionArtifactV2,
  hashNodeToolchainDistributionManifestV2,
  type NodeToolchainDistributionArtifactHashPayloadV2,
  type NodeToolchainDistributionArtifactV2,
  type NodeToolchainDistributionManifestHashPayloadV2,
  type NodeToolchainDistributionManifestV2,
} from "./schemas/node-toolchain-distribution-v2.js";

type DistributionDescriptorV2 = Readonly<{
  artifactRef:
    | "NODE_TOOLCHAIN_DISTRIBUTION_DARWIN_ARM64_V2"
    | "NODE_TOOLCHAIN_DISTRIBUTION_DARWIN_X64_V2";
  architecture: "arm64" | "x64";
  byteLength: number;
  sha256: string;
}>;

const DISTRIBUTIONS_V2: readonly DistributionDescriptorV2[] = Object.freeze([
  Object.freeze({
    artifactRef: "NODE_TOOLCHAIN_DISTRIBUTION_DARWIN_ARM64_V2",
    architecture: "arm64",
    byteLength: 25_962_500,
    sha256: "fb526811860f81dcac7dd8b2b55eca4accfc5d61c3b7c2508f2639faee8a738d",
  }),
  Object.freeze({
    artifactRef: "NODE_TOOLCHAIN_DISTRIBUTION_DARWIN_X64_V2",
    architecture: "x64",
    byteLength: 27_528_028,
    sha256: "efeec6641a2f15f5396d27cd0b32f5062d6689d1e9e5d89607d0b29bda890233",
  }),
]);

export const NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_HASH_V2 =
  "afcc91a039d576bebf286150d2ababd46786980c7c6aa025c0b3334b5fb92708" as const;

export class NodeToolchainDistributionManifestAuthorityErrorV2 extends Error {
  readonly code = "NODE_TOOLCHAIN_DISTRIBUTION_V2_CODE_AUTHORITY_DRIFT" as const;

  constructor(message: string) {
    super(message.slice(0, 1_000));
    this.name = "NodeToolchainDistributionManifestAuthorityErrorV2";
  }
}

function artifactV2(descriptor: DistributionDescriptorV2): NodeToolchainDistributionArtifactV2 {
  const fileName = `node-v22.23.1-darwin-${descriptor.architecture}.tar.xz`;
  const identity: NodeToolchainDistributionArtifactHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_DISTRIBUTION_ARTIFACT_V2_SCHEMA,
    artifactRef: descriptor.artifactRef,
    sourceAuthority: "nodejs_primary_distribution",
    architecture: descriptor.architecture,
    origin: `https://nodejs.org/dist/v22.23.1/${fileName}`,
    fileName,
    mediaType: "application/x-xz",
    archiveFormat: "tar_xz",
    archiveRoot: `node-v22.23.1-darwin-${descriptor.architecture}`,
    byteLength: descriptor.byteLength,
    sha256: descriptor.sha256,
    expectedRuntime: {
      nodeVersion: "22.23.1",
      modulesAbi: "127",
      napiVersion: "10",
      npmVersion: "10.9.8",
      platform: "darwin",
      architecture: descriptor.architecture,
    },
    selection: {
      nodeExecutableLocator: "bin/node",
      npmPackageRootLocator: "lib/node_modules/npm",
      npmCliLocator: "lib/node_modules/npm/bin/npm-cli.js",
      npmPackageJsonLocator: "lib/node_modules/npm/package.json",
      npmBuiltinConfigLocator: "lib/node_modules/npm/npmrc",
      npmBuiltinConfigExpectation: "absent",
      discardUnselectedArchiveEntries: true,
    },
  };
  return {
    ...identity,
    artifactHash: hashNodeToolchainDistributionArtifactV2(identity),
  };
}

function deepFreezeJson<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const pending: object[] = [value as object];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) pending.push(child);
    }
    Object.freeze(current);
  }
  return value;
}

function buildManifestV2(): NodeToolchainDistributionManifestV2 {
  const artifacts = DISTRIBUTIONS_V2.map(artifactV2) as [
    NodeToolchainDistributionArtifactV2,
    NodeToolchainDistributionArtifactV2,
  ];
  const identity: NodeToolchainDistributionManifestHashPayloadV2 = {
    schema: NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_V2_SCHEMA,
    manifestVersion: NODE_TOOLCHAIN_DISTRIBUTION_VERSION_V2,
    source: {
      provider: "nodejs.org",
      releaseRef: "NODE_RELEASE_V22_23_1",
      checksumIndexOrigin: "https://nodejs.org/dist/v22.23.1/SHASUMS256.txt",
      evidenceObservedDate: "2026-07-21",
    },
    artifacts,
    extraction: {
      archiveInventory: "every_member_before_extraction_v2",
      selectedClosure: "exact_node_and_bundled_npm_v2",
      unselectedEntryPolicy: "inventory_then_discard_without_extraction_v2",
      rejectPathTraversal: true,
      rejectAbsolutePath: true,
      rejectBackslash: true,
      selectedClosureRejectSymlink: true,
      selectedClosureRejectHardLink: true,
      selectedClosureRejectSpecialFile: true,
      rejectCaseFoldCollision: true,
      finalFileModes: {
        nonExecutable: "0444",
        executable: "0555",
      },
      finalDirectoryMode: "0555",
      publication: "private_stage_fsync_no_replace_root_owned_v2",
    },
  };
  const parsed = NodeToolchainDistributionManifestV2Schema.safeParse({
    ...identity,
    manifestHash: hashNodeToolchainDistributionManifestV2(identity),
  });
  if (!parsed.success) {
    throw new NodeToolchainDistributionManifestAuthorityErrorV2(
      "Code-owned Node distribution manifest failed its V2 schema",
    );
  }
  if (parsed.data.manifestHash !== NODE_TOOLCHAIN_DISTRIBUTION_MANIFEST_HASH_V2) {
    throw new NodeToolchainDistributionManifestAuthorityErrorV2(
      `Code-owned Node distribution identity changed without a version/hash transition (${parsed.data.manifestHash})`,
    );
  }
  return deepFreezeJson(parsed.data);
}

export function getCodeOwnedNodeToolchainDistributionManifestV2():
Readonly<NodeToolchainDistributionManifestV2> {
  return buildManifestV2();
}

export function getCodeOwnedNodeToolchainDistributionArtifactV2(
  architecture: "arm64" | "x64",
): Readonly<NodeToolchainDistributionArtifactV2> {
  const artifact = buildManifestV2().artifacts.find((entry) => entry.architecture === architecture);
  if (!artifact) {
    throw new NodeToolchainDistributionManifestAuthorityErrorV2(
      `Code-owned Node distribution is missing ${architecture}`,
    );
  }
  return artifact;
}
