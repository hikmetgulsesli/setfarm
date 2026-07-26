import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  HostNodeToolchainReceiptV2Schema,
} from "../../product-compiler/schemas/host-node-toolchain-receipt-v2.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";

export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_REQUIREMENT_V2_SCHEMA =
  "setfarm.platform-release-host-node-toolchain-requirement.v2" as const;
export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-host-node-toolchain-receipt.v2" as const;
export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2 =
  "AUTH_PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2" as const;
export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2 =
  "2.0.0" as const;
export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;

const PlatformReleaseHostNodeToolchainRequirementIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_REQUIREMENT_V2_SCHEMA,
    ),
    purpose: z.literal("platform_release_build_v2"),
    nodeExecutableRef: z.literal("TOOL_NODE_RUNTIME_V2"),
    nodeCompatibilityRange: z.literal(">=22.13.0 <23"),
    npmExecutableRef: z.literal("TOOL_NODE_NPM_CLI_V2"),
    npmExactVersion: z.literal("10.9.8"),
    installCommandRef: z.literal(
      "MATERIALIZE_PLATFORM_BUILD_TOOLCHAIN_V2",
    ),
    buildCommandRef: z.literal("BUILD_PLATFORM_RELEASE_V2"),
    commandPathPolicy: z.literal(
      "single_admitted_node_bin_then_exact_module_argv_v2",
    ),
  }).strict();

export type PlatformReleaseHostNodeToolchainRequirementHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostNodeToolchainRequirementIdentityV2Schema
  >;

export function hashPlatformReleaseHostNodeToolchainRequirementV2(
  value: PlatformReleaseHostNodeToolchainRequirementHashPayloadV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-node-toolchain-requirement-hash.v2",
    requirement: value,
  });
}

const platformReleaseHostNodeToolchainRequirementIdentityV2 =
  Object.freeze({
    schema:
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_REQUIREMENT_V2_SCHEMA,
    purpose: "platform_release_build_v2" as const,
    nodeExecutableRef: "TOOL_NODE_RUNTIME_V2" as const,
    nodeCompatibilityRange: ">=22.13.0 <23" as const,
    npmExecutableRef: "TOOL_NODE_NPM_CLI_V2" as const,
    npmExactVersion: "10.9.8" as const,
    installCommandRef:
      "MATERIALIZE_PLATFORM_BUILD_TOOLCHAIN_V2" as const,
    buildCommandRef: "BUILD_PLATFORM_RELEASE_V2" as const,
    commandPathPolicy:
      "single_admitted_node_bin_then_exact_module_argv_v2" as const,
  });

export const PlatformReleaseHostNodeToolchainRequirementV2Schema =
  PlatformReleaseHostNodeToolchainRequirementIdentityV2Schema.extend({
    requirementHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const { requirementHash: _requirementHash, ...identity } = value;
    if (
      value.requirementHash
        !== hashPlatformReleaseHostNodeToolchainRequirementV2(identity)
    ) {
      context.addIssue({
        code: "custom",
        path: ["requirementHash"],
        message:
          "Platform release host requirement hash must bind its exact code-owned purpose",
      });
    }
  });

export type PlatformReleaseHostNodeToolchainRequirementV2 = z.infer<
  typeof PlatformReleaseHostNodeToolchainRequirementV2Schema
>;

export const PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_REQUIREMENT_V2 =
  deepFreezePlatformReleaseJsonV2({
    ...platformReleaseHostNodeToolchainRequirementIdentityV2,
    requirementHash:
      hashPlatformReleaseHostNodeToolchainRequirementV2(
        platformReleaseHostNodeToolchainRequirementIdentityV2,
      ),
  });

const hostNodeToolchainReceiptShapeV2 =
  HostNodeToolchainReceiptV2Schema.shape;
const HostNodeToolchainPhysicalProjectionV2Schema =
  z.object({
    admissionScope:
      hostNodeToolchainReceiptShapeV2.admissionScope,
    filesystemProtection:
      hostNodeToolchainReceiptShapeV2.filesystemProtection,
    installationRoot:
      hostNodeToolchainReceiptShapeV2.installationRoot,
    provisioning:
      hostNodeToolchainReceiptShapeV2.provisioning,
    host: hostNodeToolchainReceiptShapeV2.host,
    node: hostNodeToolchainReceiptShapeV2.node,
    npm: hostNodeToolchainReceiptShapeV2.npm,
    probe: hostNodeToolchainReceiptShapeV2.probe,
    commandPathProjection:
      hostNodeToolchainReceiptShapeV2.commandPathProjection,
  }).strict();

function satisfiesPlatformReleaseNodeRangeV2(
  version: string,
): boolean {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u
    .exec(version);
  if (!match) return false;
  return Number(match[1]) === 22
    && Number(match[2]) >= 13;
}

const PlatformReleaseHostNodeToolchainReceiptIdentityV2Schema =
  HostNodeToolchainPhysicalProjectionV2Schema.extend({
    schema: z.literal(
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_V2_SCHEMA,
    ),
    receiptVersion: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
    authorityRef: z.literal(
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_REF_V2,
    ),
    authorityVersion: z.literal(
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_AUTHORITY_VERSION_V2,
    ),
    status: z.literal("verified"),
    authorityState: z.literal(
      "verified_platform_release_host_projection",
    ),
    requirement:
      PlatformReleaseHostNodeToolchainRequirementV2Schema,
  }).strict().superRefine((value, context) => {
    const requirement =
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_REQUIREMENT_V2;
    if (
      canonicalJsonStringify(value.requirement)
        !== canonicalJsonStringify(requirement)
      || value.node.executableRef !== requirement.nodeExecutableRef
      || value.npm.executableRef !== requirement.npmExecutableRef
      || value.npm.version !== requirement.npmExactVersion
      || !satisfiesPlatformReleaseNodeRangeV2(
        value.node.version,
      )
      || value.node.platform !== value.host.platform
      || value.node.architecture !== value.host.architecture
      || value.commandPathProjection.policy
        !== requirement.commandPathPolicy
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Platform release host receipt must join the exact requirement, host, Node and npm identity",
      });
    }
    if (
      (
        value.admissionScope === "production_host"
        && (
          value.filesystemProtection !== "root_owned_runtime_read_only"
          || value.installationRoot.ownerUid !== 0
          || value.installationRoot.ownerGid !== 0
          || value.installationRoot.mode !== "0555"
          || value.provisioning.policy
            !== "durable_provisioning_receipt_required_v2"
          || value.provisioning.admissionScope !== "production_root"
        )
      )
      || (
        value.admissionScope === "test_fixture"
        && (
          value.filesystemProtection !== "test_fixture_only"
          || (
            value.provisioning.policy
              === "durable_provisioning_receipt_required_v2"
            && value.provisioning.admissionScope !== "test_fixture"
          )
        )
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["filesystemProtection"],
        message:
          "Platform release host filesystem protection must match its admission scope",
      });
    }
    if (
      value.provisioning.policy
        === "durable_provisioning_receipt_required_v2"
      && (
        value.provisioning.rootDevice
          !== value.installationRoot.device
        || value.provisioning.rootInode
          !== value.installationRoot.inode
        || value.provisioning.nodeContentHash
          !== value.node.executable.contentHash
        || value.provisioning.npmTreeHash
          !== value.npm.packageTree.normalizedTreeHash
        || value.provisioning.npmFileCount
          !== value.npm.packageTree.fileCount
        || value.provisioning.npmDirectoryCount
          !== value.npm.packageTree.directoryCount
        || value.provisioning.npmTotalBytes
          !== value.npm.packageTree.totalBytes
        || (
          value.host.architecture === "arm64"
          && !value.provisioning.targetRef.endsWith("ARM64_V2")
        )
        || (
          value.host.architecture === "x64"
          && !value.provisioning.targetRef.endsWith("X64_V2")
        )
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["provisioning"],
        message:
          "Platform release host receipt must join the exact provisioned root, Node and npm closure",
      });
    }
    if (
      value.admissionScope === "production_host"
      && (
        value.node.executable.ownerUid !== 0
        || value.npm.rootOwnerUid !== 0
        || value.node.nonSystemDynamicLibraries.members.some(
          (member) => member.file.ownerUid !== 0,
        )
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Production platform release host toolchain files must be root-owned",
      });
    }
  });

export type PlatformReleaseHostNodeToolchainReceiptHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseHostNodeToolchainReceiptIdentityV2Schema
  >;

export function hashPlatformReleaseHostNodeToolchainReceiptV2(
  value:
    | PlatformReleaseHostNodeToolchainReceiptHashPayloadV2
    | PlatformReleaseHostNodeToolchainReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-host-node-toolchain-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseHostNodeToolchainReceiptV2Schema =
  PlatformReleaseHostNodeToolchainReceiptIdentityV2Schema.extend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      !platformReleaseCandidateFitsCanonicalCapV2(
        value,
        PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_MAX_CANONICAL_BYTES_V2,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Platform release host Node/npm receipt exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.receiptHash
        !== hashPlatformReleaseHostNodeToolchainReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message:
          "Platform release host Node/npm receipt hash mismatch",
      });
    }
  });

export type PlatformReleaseHostNodeToolchainReceiptV2 = z.infer<
  typeof PlatformReleaseHostNodeToolchainReceiptV2Schema
>;

export function getPlatformReleaseHostNodeToolchainRequirementV2():
PlatformReleaseHostNodeToolchainRequirementV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_REQUIREMENT_V2,
    ),
  );
}

export function parsePlatformReleaseHostNodeToolchainReceiptCandidateV2(
  input: unknown,
): PlatformReleaseHostNodeToolchainReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseHostNodeToolchainReceiptV2Schema.parse(snapshot),
  );
}
