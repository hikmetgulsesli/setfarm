import path from "node:path";

import { hashCanonicalJson } from "./canonical-json.js";

export const NODE_TOOLCHAIN_ROOT_PARENT_V2 =
  "/Library/Application Support/Setfarm/toolchains" as const;
export const NODE_TOOLCHAIN_PROVISIONING_LOCK_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioning-v2.lock" as const;
export const NODE_TOOLCHAIN_PROVISIONING_STAGING_BASENAME_V2 =
  ".setfarm-node-toolchain-provisioning-v2.staging" as const;

export type NodeToolchainTargetArchitectureV2 = "arm64" | "x64";
export type NodeToolchainTargetRefV2 =
  | "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2"
  | "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2";

export type NodeToolchainTargetV2 = Readonly<{
  architecture: NodeToolchainTargetArchitectureV2;
  targetRef: NodeToolchainTargetRefV2;
  rootBasename:
    | "node-22.23.1-npm-10.9.8-darwin-arm64"
    | "node-22.23.1-npm-10.9.8-darwin-x64";
  receiptBasename:
    | "node-22.23.1-npm-10.9.8-darwin-arm64.provisioning-v2.json"
    | "node-22.23.1-npm-10.9.8-darwin-x64.provisioning-v2.json";
  claimBasename:
    | ".setfarm-node-toolchain-provisioning-arm64-v2.claim.json"
    | ".setfarm-node-toolchain-provisioning-x64-v2.claim.json";
  rollbackClaimBasename:
    | ".setfarm-node-toolchain-rollback-arm64-v2.claim.json"
    | ".setfarm-node-toolchain-rollback-x64-v2.claim.json";
  logicalRoot: string;
  logicalReceipt: string;
  logicalClaim: string;
  logicalRollbackClaim: string;
}>;

const TARGETS_V2: readonly NodeToolchainTargetV2[] = Object.freeze([
  Object.freeze({
    architecture: "arm64",
    targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_ARM64_V2",
    rootBasename: "node-22.23.1-npm-10.9.8-darwin-arm64",
    receiptBasename: "node-22.23.1-npm-10.9.8-darwin-arm64.provisioning-v2.json",
    claimBasename: ".setfarm-node-toolchain-provisioning-arm64-v2.claim.json",
    rollbackClaimBasename: ".setfarm-node-toolchain-rollback-arm64-v2.claim.json",
    logicalRoot: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      "node-22.23.1-npm-10.9.8-darwin-arm64",
    ),
    logicalReceipt: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      "node-22.23.1-npm-10.9.8-darwin-arm64.provisioning-v2.json",
    ),
    logicalClaim: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      ".setfarm-node-toolchain-provisioning-arm64-v2.claim.json",
    ),
    logicalRollbackClaim: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      ".setfarm-node-toolchain-rollback-arm64-v2.claim.json",
    ),
  }),
  Object.freeze({
    architecture: "x64",
    targetRef: "SETFARM_ROOT_NODE_22_23_1_NPM_10_9_8_X64_V2",
    rootBasename: "node-22.23.1-npm-10.9.8-darwin-x64",
    receiptBasename: "node-22.23.1-npm-10.9.8-darwin-x64.provisioning-v2.json",
    claimBasename: ".setfarm-node-toolchain-provisioning-x64-v2.claim.json",
    rollbackClaimBasename: ".setfarm-node-toolchain-rollback-x64-v2.claim.json",
    logicalRoot: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      "node-22.23.1-npm-10.9.8-darwin-x64",
    ),
    logicalReceipt: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      "node-22.23.1-npm-10.9.8-darwin-x64.provisioning-v2.json",
    ),
    logicalClaim: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      ".setfarm-node-toolchain-provisioning-x64-v2.claim.json",
    ),
    logicalRollbackClaim: path.join(
      NODE_TOOLCHAIN_ROOT_PARENT_V2,
      ".setfarm-node-toolchain-rollback-x64-v2.claim.json",
    ),
  }),
]);

export function getCodeOwnedNodeToolchainTargetV2(
  architecture: NodeToolchainTargetArchitectureV2,
): NodeToolchainTargetV2 {
  const target = TARGETS_V2.find((candidate) => candidate.architecture === architecture);
  if (!target) throw new TypeError(`Unsupported Node toolchain target architecture: ${architecture}`);
  return target;
}

export function hashNodeToolchainOperationalLocatorV2(
  kind:
    | "root"
    | "receipt"
    | "parent"
    | "claim"
    | "rollback_claim"
    | "rollback_receipt"
    | "lock"
    | "staging",
  absoluteLocator: string,
): string {
  if (!path.isAbsolute(absoluteLocator) || path.normalize(absoluteLocator) !== absoluteLocator) {
    throw new TypeError("Node toolchain operational locator must be one normalized absolute path");
  }
  return hashCanonicalJson({
    schema: "setfarm.node-toolchain-operational-locator-hash.v2",
    kind,
    absoluteLocator,
  });
}
