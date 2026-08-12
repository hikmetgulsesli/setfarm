import { isProxy } from "node:util/types";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  inventoryVerifiedNodeToolchainDistributionArchiveV2,
} from "./node-toolchain-archive-inventory-v2.js";
import {
  disposeVerifiedNodeToolchainDistributionArchiveV2,
  verifyNodeToolchainDistributionArchiveV2ForTest,
} from "./node-toolchain-distribution-authority-v2.js";
import {
  getCodeOwnedNodeToolchainDistributionArtifactV2,
  getCodeOwnedNodeToolchainDistributionManifestV2,
} from "./node-toolchain-distribution-manifest-v2.js";
import {
  disposeMaterializedNodeToolchainPrivateTreeV2,
  materializeInventoriedNodeToolchainPrivateTreeV2ForTest,
  type MaterializedNodeToolchainPrivateTreeV2,
} from "./node-toolchain-private-tree-v2.js";
import {
  NODE_TOOLCHAIN_DISTRIBUTION_ARTIFACT_V2_SCHEMA,
  NodeToolchainDistributionArtifactV2Schema,
  hashNodeToolchainDistributionArtifactV2,
  type NodeToolchainDistributionArtifactHashPayloadV2,
  type NodeToolchainDistributionArtifactV2,
} from "./schemas/node-toolchain-distribution-v2.js";

export type NodeToolchainProvisionerRehearsalSourceV2 = Readonly<{
  architecture: "arm64" | "x64";
  officialManifestHash: string;
  officialArtifactHash: string;
  rehearsalManifestHash: string;
  rehearsalArtifact: NodeToolchainDistributionArtifactV2;
}>;

export type NodeToolchainProvisionerRehearsalSourceErrorCodeV2 =
  | "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_INPUT_INVALID"
  | "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_CODE_AUTHORITY_INVALID";

export class NodeToolchainProvisionerRehearsalSourceErrorV2 extends Error {
  readonly code: NodeToolchainProvisionerRehearsalSourceErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: NodeToolchainProvisionerRehearsalSourceErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_200), options);
    this.name = "NodeToolchainProvisionerRehearsalSourceErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

function fail(
  code: NodeToolchainProvisionerRehearsalSourceErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new NodeToolchainProvisionerRehearsalSourceErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
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

export function getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2(
  architecture: "arm64" | "x64",
): NodeToolchainProvisionerRehearsalSourceV2 {
  if (architecture !== "arm64" && architecture !== "x64") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_INPUT_INVALID",
      "Rehearsal source requires one supported architecture",
    );
  }
  const manifest = getCodeOwnedNodeToolchainDistributionManifestV2();
  const official = getCodeOwnedNodeToolchainDistributionArtifactV2(architecture);
  const identity: NodeToolchainDistributionArtifactHashPayloadV2 = {
    ...official,
    artifactRef: architecture === "arm64"
      ? "NODE_TOOLCHAIN_DISTRIBUTION_REHEARSAL_DARWIN_ARM64_V2"
      : "NODE_TOOLCHAIN_DISTRIBUTION_REHEARSAL_DARWIN_X64_V2",
    sourceAuthority: "test_fixture",
  };
  delete (identity as Partial<NodeToolchainDistributionArtifactV2>).artifactHash;
  const parsed = NodeToolchainDistributionArtifactV2Schema.safeParse({
    ...identity,
    artifactHash: hashNodeToolchainDistributionArtifactV2(identity),
  });
  if (
    !parsed.success
    || parsed.data.byteLength !== official.byteLength
    || parsed.data.sha256 !== official.sha256
    || parsed.data.origin !== official.origin
    || parsed.data.fileName !== official.fileName
    || parsed.data.archiveRoot !== official.archiveRoot
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_CODE_AUTHORITY_INVALID",
      "Code-owned rehearsal source no longer preserves the exact official Node artifact",
      parsed.success ? undefined : parsed.error,
    );
  }
  const rehearsalManifestHash = hashCanonicalJson({
    schema: "setfarm.node-toolchain-provisioner-rehearsal-source.v2",
    sourceSchema: NODE_TOOLCHAIN_DISTRIBUTION_ARTIFACT_V2_SCHEMA,
    officialManifestHash: manifest.manifestHash,
    officialArtifactHash: official.artifactHash,
    rehearsalArtifactHash: parsed.data.artifactHash,
  });
  return deepFreezeJson({
    architecture,
    officialManifestHash: manifest.manifestHash,
    officialArtifactHash: official.artifactHash,
    rehearsalManifestHash,
    rehearsalArtifact: parsed.data,
  });
}

function exactInput(input: unknown): Readonly<{
  archivePath: string;
  architecture: "arm64" | "x64";
  scratchParent: string;
}> {
  if (
    typeof input !== "object"
    || input === null
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_INPUT_INVALID",
      "Rehearsal materialization input must be one plain exact object",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input).sort();
  if (
    keys.length !== 3
    || keys[0] !== "architecture"
    || keys[1] !== "archivePath"
    || keys[2] !== "scratchParent"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_INPUT_INVALID",
      "Rehearsal materialization input has unknown or missing fields",
    );
  }
  const architecture = descriptors.architecture && "value" in descriptors.architecture
    ? descriptors.architecture.value
    : undefined;
  const archivePath = descriptors.archivePath && "value" in descriptors.archivePath
    ? descriptors.archivePath.value
    : undefined;
  const scratchParent = descriptors.scratchParent && "value" in descriptors.scratchParent
    ? descriptors.scratchParent.value
    : undefined;
  if (
    (architecture !== "arm64" && architecture !== "x64")
    || typeof archivePath !== "string"
    || typeof scratchParent !== "string"
  ) {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_INPUT_INVALID",
      "Rehearsal materialization architecture or locator is invalid",
    );
  }
  return Object.freeze({ architecture, archivePath, scratchParent });
}

export async function withNodeToolchainProvisionerRehearsalPrivateTreeV2<T>(
  input: unknown,
  use: (tree: MaterializedNodeToolchainPrivateTreeV2) => Promise<T> | T,
): Promise<T> {
  if (typeof use !== "function") {
    return fail(
      "NODE_TOOLCHAIN_PROVISIONER_REHEARSAL_SOURCE_V2_INPUT_INVALID",
      "Rehearsal materialization requires one continuation",
    );
  }
  const parsed = exactInput(input);
  const source = getCodeOwnedNodeToolchainProvisionerRehearsalSourceV2(parsed.architecture);
  const archive = await verifyNodeToolchainDistributionArchiveV2ForTest({
    archivePath: parsed.archivePath,
    artifact: source.rehearsalArtifact,
    manifestHash: source.rehearsalManifestHash,
  });
  let tree: MaterializedNodeToolchainPrivateTreeV2 | undefined;
  try {
    const inventory = await inventoryVerifiedNodeToolchainDistributionArchiveV2(archive);
    tree = await materializeInventoriedNodeToolchainPrivateTreeV2ForTest(inventory, {
      scratchParent: parsed.scratchParent,
    });
    return await use(tree);
  } finally {
    try {
      if (tree) await disposeMaterializedNodeToolchainPrivateTreeV2(tree);
    } finally {
      await disposeVerifiedNodeToolchainDistributionArchiveV2(archive);
    }
  }
}
