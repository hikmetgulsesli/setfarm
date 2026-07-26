import { createHash } from "node:crypto";

import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  NpmMaterializationReceiptCandidateV2Schema,
} from "./external-runtime-resolution-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  ExactHostOwnedFileRefV2Schema,
  PlatformReleaseStableReferenceV2Schema,
  PlatformReleaseVersionIdentityV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PlatformRuntimePayloadCandidateV2Schema,
} from "./platform-runtime-payload-v2.js";
import {
  CANONICAL_RUNTIME_TREE_V2_PROFILES,
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
} from "./canonical-runtime-tree-v2.js";
import {
  HostNodeToolchainReceiptV2Schema,
} from "../../product-compiler/schemas/host-node-toolchain-receipt-v2.js";

export const EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA =
  "setfarm.exact-platform-release-source-ref.v2" as const;
export const PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA =
  "setfarm.platform-release-source-tree-binding.v2" as const;
export const PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA =
  "setfarm.platform-release-source-stage-physical-identity.v2" as const;
export const SOURCE_ADMISSION_RECEIPT_V2_SCHEMA =
  "setfarm.source-admission-receipt.v2" as const;
export const PLATFORM_RELEASE_BUILD_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-build-receipt.v2" as const;
export const EXACT_LEGACY_STITCH_CONVERTER_REF_V2_SCHEMA =
  "setfarm.exact-legacy-stitch-converter-ref.v2" as const;
export const PLATFORM_RELEASE_BUILD_COMMAND_RESULT_V2_SCHEMA =
  "setfarm.build-platform-release-command-result.v2" as const;
export const PLATFORM_RELEASE_BUILD_TOOLCHAIN_TREE_BINDING_V2_SCHEMA =
  "setfarm.platform-release-build-toolchain-tree-binding.v2" as const;
export const PLATFORM_RELEASE_BUILD_TOOLCHAIN_PHYSICAL_IDENTITY_V2_SCHEMA =
  "setfarm.platform-release-build-toolchain-physical-identity.v2" as const;
export const PLATFORM_RELEASE_BUILD_TOOLCHAIN_INSTALL_RECIPE_V2_SCHEMA =
  "setfarm.platform-release-build-toolchain-install-recipe.v2" as const;
export const PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_V2_SCHEMA =
  "setfarm.platform-release-build-toolchain-receipt.v2" as const;

export const PLATFORM_RELEASE_BUILD_CONTRACT_VERSION_V2 = "2.0.0" as const;
export const PLATFORM_RELEASE_SOURCE_ADMISSION_MAX_CANONICAL_BYTES_V2 =
  128 * 1024;
export const PLATFORM_RELEASE_BUILD_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_MAX_CANONICAL_BYTES_V2 =
  256 * 1024;
export const PLATFORM_RELEASE_SOURCE_FILE_MAX_BYTES_V2 = 16 * 1024 * 1024;
export const PLATFORM_RELEASE_BUILD_MODULE_MAX_BYTES_V2 = 64 * 1024 * 1024;
export const PLATFORM_RELEASE_SOURCE_MAX_FILES_V2 = 20_000;
export const PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2 = 4_000;
export const PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2 =
  512 * 1024 * 1024;
export const PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2 =
  "github.com/hikmetgulsesli/setfarm" as const;
export const PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_V2 =
  "https://github.com/hikmetgulsesli/setfarm.git" as const;
export const PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_V2 =
  "git@github.com:hikmetgulsesli/setfarm.git" as const;
export const PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_HASH_V2 =
  createHash("sha256")
    .update(PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_V2)
    .digest("hex");
export const PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_HASH_V2 =
  createHash("sha256")
    .update(PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_V2)
    .digest("hex");

export const PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.platform-release-source-git-command-contract.v2" as const,
  version: PLATFORM_RELEASE_BUILD_CONTRACT_VERSION_V2,
  executableAuthority:
    "root_owned_separately_installed_host_admitted_file" as const,
  executableMode: "0555" as const,
  invocation: "absolute_executable_direct_no_shell" as const,
  repositoryAccess: "read_only_object_database_and_index_observation" as const,
  checkoutBytes: "forbidden_as_export_input" as const,
  requiredOperations: [
    "symbolic_ref_exact_head_branch",
    "rev_parse_exact_head_and_remote_main",
    "status_porcelain_v2_z_all_untracked",
    "ls_tree_recursive_nul",
    "cat_file_batch_exact_commit_and_blobs",
  ] as const,
  objectVerification:
    "independent_commit_blob_and_recursive_tree_hash_reproduction" as const,
  sourceFence:
    "remote_head_index_status_and_export_before_and_after" as const,
  repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  acceptedOriginTransports: ["github_https", "github_ssh"] as const,
  repositoryMutation: "forbidden" as const,
  ambientEnvironment: "discard_all" as const,
});

export const PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2 =
  hashCanonicalJson(PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_V2);

export const PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.platform-release-source-admission-contract.v2" as const,
  version: PLATFORM_RELEASE_BUILD_CONTRACT_VERSION_V2,
  authorityOwner: "root_owned_separately_installed_verifier" as const,
  remoteRef: "refs/remotes/origin/main" as const,
  repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  policy: "exact_remote_main_sha" as const,
  requiredBranch: "main" as const,
  dirtyWorktree: "forbidden" as const,
  sourceFence: "before_and_after_exact_commit_tree_and_index" as const,
  remoteFence: "before_and_after_exact_remote_main_observation" as const,
  exportFence:
    "before_and_after_exact_read_only_stage_identity_and_fingerprint" as const,
  buildContextPolicy:
    "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
  gitCommandContractHash:
    PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
  candidateAuthority:
    "forbidden_until_fresh_root_owned_source_verification" as const,
});

export const PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2 =
  hashCanonicalJson(PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_V2);

export const PLATFORM_RELEASE_BUILD_CONTRACT_V2 = Object.freeze({
  schema: "setfarm.platform-release-build-contract.v2" as const,
  version: PLATFORM_RELEASE_BUILD_CONTRACT_VERSION_V2,
  sourceMethod: "verified_git_tree_export.v2" as const,
  commandRef: "BUILD_PLATFORM_RELEASE_V2" as const,
  commandModule: "scripts/build-platform-release-v2.mjs" as const,
  outputPolicy: "parameterized_empty_stage_only" as const,
  reproducibility: "double_clean_build_exact_tree_match" as const,
  clockInput: "exact_git_commit_epoch_only" as const,
  sourceIdentityInput: "exact_admitted_git_sha" as const,
  buildToolchainInput:
    "authenticated_read_only_node_modules_sibling_capsule" as const,
  buildToolchainTreeAuthority:
    "canonical_runtime_dependencies_tree_v2" as const,
  compilerEntryDerivation:
    "exact_toolchain_locator_typescript_bin_tsc" as const,
  ambientNodeModulesResolution: "forbidden" as const,
  forbiddenPayloadInputs: [
    "absolute_path",
    "pid",
    "random_uuid",
    "wall_clock",
  ] as const,
  process: {
    shell: "forbidden" as const,
    ambientEnvironment: "forbidden" as const,
    stdin: "closed" as const,
    termination: "normal_exit_zero_only" as const,
  },
  productionUse: "forbidden_until_fresh_verified_release" as const,
});

export const PLATFORM_RELEASE_BUILD_CONTRACT_HASH_V2 =
  hashCanonicalJson(PLATFORM_RELEASE_BUILD_CONTRACT_V2);

export const PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const CanonicalDecimalEpochV2Schema = z.string()
  .min(1)
  .max(20)
  .regex(/^(?:0|[1-9][0-9]*)$/, "Expected canonical Git epoch seconds");

const SourceRoleV2Schema = z.enum([
  "dependency_lock_manifest",
  "package_manifest",
  "typescript_compiler_config",
]);

const SourceLocatorV2Schema = z.enum([
  "package-lock.json",
  "package.json",
  "tsconfig.json",
]);

const ExactPlatformReleaseSourceRefIdentityV2Schema = z.object({
  schema: z.literal(EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA),
  role: SourceRoleV2Schema,
  locator: SourceLocatorV2Schema,
  mediaType: z.literal("application/json"),
  gitBlobHash: GitObjectHashSchema,
  contentHash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(PLATFORM_RELEASE_SOURCE_FILE_MAX_BYTES_V2),
  gitMode: z.literal("100644"),
  exportedMode: z.literal("0444"),
}).strict().superRefine((value, context) => {
  const expected = {
    dependency_lock_manifest: "package-lock.json",
    package_manifest: "package.json",
    typescript_compiler_config: "tsconfig.json",
  } as const;
  if (value.locator !== expected[value.role]) {
    context.addIssue({
      code: "custom",
      path: ["locator"],
      message: "Source role must bind its one exact committed locator",
    });
  }
});

export type ExactPlatformReleaseSourceRefHashPayloadV2 = z.infer<
  typeof ExactPlatformReleaseSourceRefIdentityV2Schema
>;

export function hashExactPlatformReleaseSourceRefV2(
  value:
    | ExactPlatformReleaseSourceRefHashPayloadV2
    | ExactPlatformReleaseSourceRefV2,
): string {
  const sourceRef = { ...value } as Record<string, unknown>;
  delete sourceRef.sourceRefHash;
  return hashCanonicalJson({
    schema: "setfarm.exact-platform-release-source-ref-hash.v2",
    sourceRef,
  });
}

export const ExactPlatformReleaseSourceRefV2Schema =
  ExactPlatformReleaseSourceRefIdentityV2Schema.safeExtend({
    sourceRefHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.sourceRefHash !== hashExactPlatformReleaseSourceRefV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceRefHash"],
        message: "Source ref hash must bind exact committed and exported bytes",
      });
    }
  });

export type ExactPlatformReleaseSourceRefV2 = z.infer<
  typeof ExactPlatformReleaseSourceRefV2Schema
>;

export const PlatformReleaseSourceInputsV2Schema = z.tuple([
  ExactPlatformReleaseSourceRefV2Schema,
  ExactPlatformReleaseSourceRefV2Schema,
  ExactPlatformReleaseSourceRefV2Schema,
]).superRefine((value, context) => {
  const expected = [
    ["dependency_lock_manifest", "package-lock.json"],
    ["package_manifest", "package.json"],
    ["typescript_compiler_config", "tsconfig.json"],
  ] as const;
  value.forEach((entry, index) => {
    if (
      entry.role !== expected[index]![0]
      || entry.locator !== expected[index]![1]
    ) {
      context.addIssue({
        code: "custom",
        path: [index],
        message:
          "Release source inputs must contain the exact three files in canonical order",
      });
    }
  });
});

const PlatformReleaseSourceTreeBindingIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA),
  sourceTreeHash: GitObjectHashSchema,
  exportedFileTreeHash: Sha256Schema,
  exportedFileCount: z.number().int().positive()
    .max(PLATFORM_RELEASE_SOURCE_MAX_FILES_V2),
  exportedDirectoryCount: z.number().int().nonnegative()
    .max(PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2),
  exportedTotalBytes: z.number().int().positive()
    .max(PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2),
  inputMembershipHash: Sha256Schema,
  inputs: PlatformReleaseSourceInputsV2Schema,
}).strict().superRefine((value, context) => {
  const expectedMembershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-source-input-membership.v2",
    entries: value.inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  if (value.inputMembershipHash !== expectedMembershipHash) {
    context.addIssue({
      code: "custom",
      path: ["inputMembershipHash"],
      message: "Source input membership hash must bind every exact input",
    });
  }
});

export type PlatformReleaseSourceTreeBindingHashPayloadV2 = z.infer<
  typeof PlatformReleaseSourceTreeBindingIdentityV2Schema
>;

export function hashPlatformReleaseSourceTreeBindingV2(
  value:
    | PlatformReleaseSourceTreeBindingHashPayloadV2
    | PlatformReleaseSourceTreeBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-source-tree-binding-hash.v2",
    binding,
  });
}

export const PlatformReleaseSourceTreeBindingV2Schema =
  PlatformReleaseSourceTreeBindingIdentityV2Schema.safeExtend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.bindingHash
        !== hashPlatformReleaseSourceTreeBindingV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Source tree binding hash must bind the exact export summary",
      });
    }
  });

export type PlatformReleaseSourceTreeBindingV2 = z.infer<
  typeof PlatformReleaseSourceTreeBindingV2Schema
>;

const PlatformReleaseSourceStagePhysicalIdentityPayloadV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
  ),
  device: z.string().min(1).max(32)
    .regex(/^(?:0|[1-9][0-9]*)$/),
  inode: z.string().min(1).max(32)
    .regex(/^(?:0|[1-9][0-9]*)$/),
  ownerUid: z.number().int().nonnegative().max(4_294_967_294),
  ownerGid: z.number().int().nonnegative().max(4_294_967_294),
  mode: z.literal("0555"),
  sourceBindingHash: Sha256Schema,
  identityHash: Sha256Schema,
}).strict();

export function hashPlatformReleaseSourceStagePhysicalIdentityV2(
  value: z.infer<
    typeof PlatformReleaseSourceStagePhysicalIdentityPayloadV2Schema
  >,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.identityHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-source-stage-physical-identity-hash.v2",
    identity,
  });
}

export const PlatformReleaseSourceStagePhysicalIdentityV2Schema =
  PlatformReleaseSourceStagePhysicalIdentityPayloadV2Schema.superRefine(
    (value, context) => {
      if (
        value.identityHash
          !== hashPlatformReleaseSourceStagePhysicalIdentityV2(value)
      ) {
        context.addIssue({
          code: "custom",
          path: ["identityHash"],
          message: "Source stage physical identity hash mismatch",
        });
      }
    },
  );

export type PlatformReleaseSourceStagePhysicalIdentityV2 = z.infer<
  typeof PlatformReleaseSourceStagePhysicalIdentityV2Schema
>;

const GitSourceFenceIdentityV2Schema = z.object({
  headSha: GitObjectHashSchema,
  treeHash: GitObjectHashSchema,
  indexTreeHash: GitObjectHashSchema,
  identityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = hashCanonicalJson({
    schema: "setfarm.git-source-fence-identity.v2",
    headSha: value.headSha,
    treeHash: value.treeHash,
    indexTreeHash: value.indexTreeHash,
  });
  if (value.identityHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["identityHash"],
      message: "Git source fence identity hash mismatch",
    });
  }
});

const RemoteMainObservationIdentityV2Schema = z.object({
  repositoryId: z.literal(
    PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  ),
  originTransport: z.enum(["github_https", "github_ssh"]),
  originUrlHash: Sha256Schema,
  remoteRef: z.literal("refs/remotes/origin/main"),
  observedSha: GitObjectHashSchema,
  observedTreeHash: GitObjectHashSchema,
  observationHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedOriginUrlHash =
    value.originTransport === "github_https"
      ? PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_HASH_V2
      : PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_HASH_V2;
  const expected = hashCanonicalJson({
    schema: "setfarm.remote-main-observation.v2",
    repositoryId: value.repositoryId,
    originTransport: value.originTransport,
    originUrlHash: value.originUrlHash,
    remoteRef: value.remoteRef,
    observedSha: value.observedSha,
    observedTreeHash: value.observedTreeHash,
  });
  if (
    value.originUrlHash !== expectedOriginUrlHash
    || value.observationHash !== expected
  ) {
    context.addIssue({
      code: "custom",
      path: ["observationHash"],
      message: "Remote-main observation hash mismatch",
    });
  }
});

const CleanWorktreeProofIdentityV2Schema = z.object({
  dirty: z.literal(false),
  untrackedEntryCount: z.literal(0),
  statusPorcelainContentHash: z.literal(
    PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
  ),
  headSha: GitObjectHashSchema,
  treeHash: GitObjectHashSchema,
  indexTreeHash: GitObjectHashSchema,
  proofHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expected = hashCanonicalJson({
    schema: "setfarm.clean-worktree-proof.v2",
    dirty: value.dirty,
    untrackedEntryCount: value.untrackedEntryCount,
    statusPorcelainContentHash: value.statusPorcelainContentHash,
    headSha: value.headSha,
    treeHash: value.treeHash,
    indexTreeHash: value.indexTreeHash,
  });
  if (value.proofHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["proofHash"],
      message: "Clean-worktree proof hash mismatch",
    });
  }
});

const SourceAdmissionReceiptIdentityV2Schema = z.object({
  schema: z.literal(SOURCE_ADMISSION_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_observation_unverified"),
  productionUse: z.literal(
    "forbidden_until_fresh_root_owned_source_verification",
  ),
  repositoryId: z.literal(
    PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  ),
  remoteRef: z.literal("refs/remotes/origin/main"),
  policy: z.literal("exact_remote_main_sha"),
  branch: z.literal("main"),
  admissionContractHash: z.literal(
    PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
  ),
  remoteBefore: RemoteMainObservationIdentityV2Schema,
  remoteAfter: RemoteMainObservationIdentityV2Schema,
  admittedSource: z.object({
    sha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
    commitEpochSeconds: CanonicalDecimalEpochV2Schema,
  }).strict(),
  cleanWorktreeBefore: CleanWorktreeProofIdentityV2Schema,
  cleanWorktreeAfter: CleanWorktreeProofIdentityV2Schema,
  sourceBefore: GitSourceFenceIdentityV2Schema,
  sourceAfter: GitSourceFenceIdentityV2Schema,
  exportedSource: z.object({
    method: z.literal("verified_git_tree_export.v2"),
    buildContextPolicy: z.literal(
      "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
    ),
    source: PlatformReleaseSourceTreeBindingV2Schema,
    initialStageWasEmpty: z.literal(true),
    stageBefore:
      PlatformReleaseSourceStagePhysicalIdentityV2Schema,
    stageAfter:
      PlatformReleaseSourceStagePhysicalIdentityV2Schema,
    temporaryLocatorDisclosure: z.literal("forbidden"),
  }).strict(),
  gitTool: z.object({
    executable: ExactHostOwnedFileRefV2Schema,
    requiredAbi: z.literal(
      "GIT_OBJECT_DATABASE_SOURCE_EXPORT_V2",
    ),
    commandContractHash: z.literal(
      PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
    ),
  }).strict(),
  implementation: z.object({
    ownership: z.literal("root_owned_separately_installed"),
    module: ExactHostOwnedFileRefV2Schema,
    requiredExport: z.literal("admitPlatformReleaseSourceV2"),
  }).strict(),
}).strict().superRefine((value, context) => {
  const admitted = value.admittedSource;
  const before = value.sourceBefore;
  const after = value.sourceAfter;
  const cleanBefore = value.cleanWorktreeBefore;
  const cleanAfter = value.cleanWorktreeAfter;
  const exported = value.exportedSource;
  const gitExecutable = value.gitTool.executable;
  const implementation = value.implementation.module;
  if (
    value.remoteBefore.repositoryId !== value.repositoryId
    || value.remoteAfter.repositoryId !== value.repositoryId
    || value.remoteBefore.remoteRef !== value.remoteRef
    || value.remoteBefore.observedSha !== admitted.sha
    || value.remoteBefore.observedTreeHash !== admitted.treeHash
    || value.remoteAfter.remoteRef !== value.remoteRef
    || value.remoteAfter.observedSha !== admitted.sha
    || value.remoteAfter.observedTreeHash !== admitted.treeHash
    || value.remoteBefore.observationHash
      !== value.remoteAfter.observationHash
    || before.headSha !== admitted.sha
    || before.treeHash !== admitted.treeHash
    || before.indexTreeHash !== admitted.treeHash
    || after.headSha !== admitted.sha
    || after.treeHash !== admitted.treeHash
    || after.indexTreeHash !== admitted.treeHash
    || cleanBefore.headSha !== admitted.sha
    || cleanBefore.treeHash !== admitted.treeHash
    || cleanBefore.indexTreeHash !== admitted.treeHash
    || cleanAfter.headSha !== admitted.sha
    || cleanAfter.treeHash !== admitted.treeHash
    || cleanAfter.indexTreeHash !== admitted.treeHash
    || cleanBefore.proofHash !== cleanAfter.proofHash
    || before.identityHash !== after.identityHash
    || exported.source.sourceTreeHash !== admitted.treeHash
    || exported.stageBefore.sourceBindingHash
      !== exported.source.bindingHash
    || exported.stageAfter.sourceBindingHash
      !== exported.source.bindingHash
    || exported.stageBefore.identityHash
      !== exported.stageAfter.identityHash
    || gitExecutable.mode !== "0555"
    || gitExecutable.absoluteRealpathLocator
      === implementation.absoluteRealpathLocator
    || canonicalJsonStringify(
      gitExecutable.hostAdmissionReceipt.host,
    ) !== canonicalJsonStringify(
      implementation.hostAdmissionReceipt.host,
    )
    || canonicalJsonStringify(
      gitExecutable.hostAdmissionReceipt.verifier,
    ) !== canonicalJsonStringify(
      implementation.hostAdmissionReceipt.verifier,
    )
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Source admission must close exact remote main, clean index and unchanged before/after source",
    });
  }
});

export type SourceAdmissionReceiptHashPayloadV2 = z.infer<
  typeof SourceAdmissionReceiptIdentityV2Schema
>;

export function hashSourceAdmissionReceiptV2(
  value:
    | SourceAdmissionReceiptHashPayloadV2
    | SourceAdmissionReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.source-admission-receipt-hash.v2",
    receipt,
  });
}

export const SourceAdmissionReceiptV2Schema =
  SourceAdmissionReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_SOURCE_ADMISSION_MAX_CANONICAL_BYTES_V2,
    )) {
      context.addIssue({
        code: "custom",
        message: "Source admission receipt exceeds its canonical byte cap",
      });
      return;
    }
    if (value.receiptHash !== hashSourceAdmissionReceiptV2(value)) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Source admission receipt hash mismatch",
      });
    }
  });

export type SourceAdmissionReceiptV2 = z.infer<
  typeof SourceAdmissionReceiptV2Schema
>;

export const PlatformReleaseCompilerIdentityV2Schema = z.object({
  packageName: z.literal("typescript"),
  version: PlatformReleaseVersionIdentityV2Schema,
  lockEntryHash: Sha256Schema,
  packageJsonHash: Sha256Schema,
  packageTreeHash: Sha256Schema,
  entryModuleLocator: z.literal("node_modules/typescript/bin/tsc"),
  entryModuleHash: Sha256Schema,
}).strict();

export type PlatformReleaseCompilerIdentityV2 = z.infer<
  typeof PlatformReleaseCompilerIdentityV2Schema
>;

export const PlatformReleasePackageManagerIdentityV2Schema = z.object({
  packageName: z.literal("npm"),
  version: PlatformReleaseVersionIdentityV2Schema,
  executableRef: PlatformReleaseStableReferenceV2Schema,
  executableHash: Sha256Schema,
  packageTreeHash: Sha256Schema,
  buildInstallRecipeHash: Sha256Schema,
}).strict();

export type PlatformReleasePackageManagerIdentityV2 = z.infer<
  typeof PlatformReleasePackageManagerIdentityV2Schema
>;

const PlatformReleaseBuildToolchainTreeBindingIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_TREE_BINDING_V2_SCHEMA,
  ),
  treeSchema: z.literal(CANONICAL_RUNTIME_TREE_V2_SCHEMA),
  profile: z.literal("dependencies"),
  rootLocator: z.literal("node_modules"),
  treeHash: Sha256Schema,
  treePayloadHash: Sha256Schema,
  fileCount: z.number().int().positive(),
  directoryCount: z.number().int().positive(),
  totalBytes: z.number().int().positive(),
  inputMembershipHash: Sha256Schema,
  packageCount: z.number().int().positive().max(100_000),
  installedPackageMembershipHash: Sha256Schema,
}).strict();

export type PlatformReleaseBuildToolchainTreeBindingHashPayloadV2 = z.infer<
  typeof PlatformReleaseBuildToolchainTreeBindingIdentityV2Schema
>;

export function hashPlatformReleaseBuildToolchainTreeBindingV2(
  value:
    | PlatformReleaseBuildToolchainTreeBindingHashPayloadV2
    | PlatformReleaseBuildToolchainTreeBindingV2,
): string {
  const binding = { ...value } as Record<string, unknown>;
  delete binding.bindingHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-toolchain-tree-binding-hash.v2",
    binding,
  });
}

export const PlatformReleaseBuildToolchainTreeBindingV2Schema =
  PlatformReleaseBuildToolchainTreeBindingIdentityV2Schema.safeExtend({
    bindingHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    const limits = CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies;
    if (
      value.fileCount > limits.maxFiles
      || value.directoryCount > limits.maxDirectories
      || value.totalBytes > limits.maxTotalBytes
    ) {
      context.addIssue({
        code: "custom",
        message: "Build toolchain tree exceeds dependency-profile limits",
      });
    }
    if (
      value.bindingHash
        !== hashPlatformReleaseBuildToolchainTreeBindingV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["bindingHash"],
        message: "Build toolchain tree binding hash mismatch",
      });
    }
  });

export type PlatformReleaseBuildToolchainTreeBindingV2 = z.infer<
  typeof PlatformReleaseBuildToolchainTreeBindingV2Schema
>;

const PlatformReleaseBuildToolchainPhysicalIdentityPayloadV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_PHYSICAL_IDENTITY_V2_SCHEMA,
    ),
    device: z.string().min(1).max(32)
      .regex(/^(?:0|[1-9][0-9]*)$/),
    inode: z.string().min(1).max(32)
      .regex(/^(?:0|[1-9][0-9]*)$/),
    ownerUid: z.number().int().nonnegative().max(4_294_967_294),
    ownerGid: z.number().int().nonnegative().max(4_294_967_294),
    mode: z.literal("0555"),
    buildContextPolicy: z.literal(
      "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
    ),
    toolchainBindingHash: Sha256Schema,
    identityHash: Sha256Schema,
  }).strict();

export function hashPlatformReleaseBuildToolchainPhysicalIdentityV2(
  value: z.infer<
    typeof PlatformReleaseBuildToolchainPhysicalIdentityPayloadV2Schema
  >,
): string {
  const identity = { ...value } as Record<string, unknown>;
  delete identity.identityHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-toolchain-physical-identity-hash.v2",
    identity,
  });
}

export const PlatformReleaseBuildToolchainPhysicalIdentityV2Schema =
  PlatformReleaseBuildToolchainPhysicalIdentityPayloadV2Schema.superRefine(
    (value, context) => {
      if (
        value.identityHash
          !== hashPlatformReleaseBuildToolchainPhysicalIdentityV2(value)
      ) {
        context.addIssue({
          code: "custom",
          path: ["identityHash"],
          message: "Build toolchain physical identity hash mismatch",
        });
      }
    },
  );

export type PlatformReleaseBuildToolchainPhysicalIdentityV2 = z.infer<
  typeof PlatformReleaseBuildToolchainPhysicalIdentityV2Schema
>;

const PlatformReleaseBuildToolchainInstallRecipeIdentityV2Schema =
  z.object({
    schema: z.literal(
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_INSTALL_RECIPE_V2_SCHEMA,
    ),
    commandRef: z.literal(
      "MATERIALIZE_PLATFORM_BUILD_TOOLCHAIN_V2",
    ),
    directArgv: z.tuple([
      z.literal("npm"),
      z.literal("ci"),
      z.literal("--include=dev"),
      z.literal("--ignore-scripts"),
      z.literal("--no-audit"),
      z.literal("--no-fund"),
    ]),
    dependencySelection: z.literal(
      "production_and_dev_from_exact_lock",
    ),
    lifecycleScripts: z.literal("forbidden"),
    ambientEnvironment: z.literal("forbidden"),
    generatedNpmMetadata: z.literal(
      "verified_then_removed_before_capsule_capture",
    ),
    symbolicLinks: z.literal(
      "exact_lock_declared_bins_verified_then_removed",
    ),
    outputNormalization: z.literal(
      "every_file_0444_or_0555_every_directory_0555",
    ),
    configHash: Sha256Schema,
  }).strict();

export type PlatformReleaseBuildToolchainInstallRecipeHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseBuildToolchainInstallRecipeIdentityV2Schema
  >;

export function hashPlatformReleaseBuildToolchainInstallRecipeV2(
  value:
    | PlatformReleaseBuildToolchainInstallRecipeHashPayloadV2
    | PlatformReleaseBuildToolchainInstallRecipeV2,
): string {
  const recipe = { ...value } as Record<string, unknown>;
  delete recipe.recipeHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-toolchain-install-recipe-hash.v2",
    recipe,
  });
}

export const PlatformReleaseBuildToolchainInstallRecipeV2Schema =
  PlatformReleaseBuildToolchainInstallRecipeIdentityV2Schema.safeExtend({
    recipeHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (
      value.recipeHash
        !== hashPlatformReleaseBuildToolchainInstallRecipeV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["recipeHash"],
        message: "Build toolchain install recipe hash mismatch",
      });
    }
  });

export type PlatformReleaseBuildToolchainInstallRecipeV2 = z.infer<
  typeof PlatformReleaseBuildToolchainInstallRecipeV2Schema
>;

const PlatformReleaseBuildToolchainProcessEvidenceV2Schema = z.object({
  hostToolchainReceiptHash: Sha256Schema,
  environmentHash: Sha256Schema,
  projectScopeHash: Sha256Schema,
  recipeHash: Sha256Schema,
  directArgvHash: Sha256Schema,
  stdin: z.literal("closed"),
  inheritAmbientEnvironment: z.literal(false),
  shell: z.literal("forbidden"),
  termination: z.literal("normal_exit"),
  exitCode: z.literal(0),
  signal: z.null(),
  stdoutContentHash: Sha256Schema,
  stdoutByteLength: z.number().int().nonnegative().max(64 * 1024),
  stderrContentHash: Sha256Schema,
  stderrByteLength: z.number().int().nonnegative().max(64 * 1024),
}).strict();

const PlatformReleaseBuildToolchainReceiptIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "candidate_build_toolchain_materialization_unverified",
  ),
  productionUse: z.literal(
    "forbidden_until_fresh_context_and_double_build_verification",
  ),
  sourceAdmissionReceiptHash: Sha256Schema,
  inputs: PlatformReleaseSourceInputsV2Schema,
  inputMembershipHash: Sha256Schema,
  placement: z.object({
    buildContextPolicy: z.literal(
      "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
    ),
    parentMode: z.literal("0700"),
    rootLocator: z.literal("node_modules"),
    rootMode: z.literal("0555"),
    allowedFinalContextEntries: z.tuple([
      z.literal("node_modules"),
      z.literal("source"),
    ]),
    temporaryLocatorDisclosure: z.literal("forbidden"),
  }).strict(),
  hostToolchain: HostNodeToolchainReceiptV2Schema,
  packageManager: PlatformReleasePackageManagerIdentityV2Schema,
  compiler: PlatformReleaseCompilerIdentityV2Schema,
  installRecipe: PlatformReleaseBuildToolchainInstallRecipeV2Schema,
  process: PlatformReleaseBuildToolchainProcessEvidenceV2Schema,
  tree: PlatformReleaseBuildToolchainTreeBindingV2Schema,
  physicalBefore:
    PlatformReleaseBuildToolchainPhysicalIdentityV2Schema,
  physicalAfter:
    PlatformReleaseBuildToolchainPhysicalIdentityV2Schema,
}).strict().superRefine((value, context) => {
  const expectedMembershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-source-input-membership.v2",
    entries: value.inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  const directArgvHash = hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-toolchain-direct-argv-hash.v2",
    directArgv: value.installRecipe.directArgv,
  });
  if (
    value.inputMembershipHash !== expectedMembershipHash
    || value.tree.inputMembershipHash !== expectedMembershipHash
    || value.process.hostToolchainReceiptHash
      !== value.hostToolchain.receiptHash
    || value.packageManager.version !== value.hostToolchain.npm.version
    || value.packageManager.executableHash
      !== value.hostToolchain.npm.cli.contentHash
    || value.packageManager.packageTreeHash
      !== value.hostToolchain.npm.packageTree.normalizedTreeHash
    || value.packageManager.buildInstallRecipeHash
      !== value.installRecipe.recipeHash
    || value.process.recipeHash !== value.installRecipe.recipeHash
    || value.process.directArgvHash !== directArgvHash
    || value.physicalBefore.toolchainBindingHash
      !== value.tree.bindingHash
    || value.physicalAfter.toolchainBindingHash
      !== value.tree.bindingHash
    || canonicalJsonStringify(value.physicalBefore)
      !== canonicalJsonStringify(value.physicalAfter)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Build toolchain receipt must close exact inputs, recipe, tree and stable physical identity",
    });
  }
});

export type PlatformReleaseBuildToolchainReceiptHashPayloadV2 = z.infer<
  typeof PlatformReleaseBuildToolchainReceiptIdentityV2Schema
>;

export function hashPlatformReleaseBuildToolchainReceiptV2(
  value:
    | PlatformReleaseBuildToolchainReceiptHashPayloadV2
    | PlatformReleaseBuildToolchainReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-toolchain-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseBuildToolchainReceiptV2Schema =
  PlatformReleaseBuildToolchainReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_MAX_CANONICAL_BYTES_V2,
    )) {
      context.addIssue({
        code: "custom",
        message: "Build toolchain receipt exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.receiptHash
        !== hashPlatformReleaseBuildToolchainReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Build toolchain receipt hash mismatch",
      });
    }
  });

export type PlatformReleaseBuildToolchainReceiptV2 = z.infer<
  typeof PlatformReleaseBuildToolchainReceiptV2Schema
>;

export const ExactLegacyStitchConverterRefV2Schema = z.object({
  schema: z.literal(EXACT_LEGACY_STITCH_CONVERTER_REF_V2_SCHEMA),
  sourceLocator: z.literal("scripts/stitch-to-jsx.mjs"),
  locator: z.literal("payload/dist/legacy-assets/stitch-to-jsx.mjs"),
  mediaType: z.literal("text/javascript"),
  hash: Sha256Schema,
  byteLength: z.number().int().positive()
    .max(PLATFORM_RELEASE_BUILD_MODULE_MAX_BYTES_V2),
  mode: z.literal("0444"),
}).strict();

export type ExactLegacyStitchConverterRefV2 = z.infer<
  typeof ExactLegacyStitchConverterRefV2Schema
>;

const PlatformReleaseBuildStageV2Schema = z.object({
  stageRef: z.enum([
    "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2",
    "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
  ]),
  sourceStagePhysicalIdentityHash: Sha256Schema,
  buildToolchainPhysicalIdentityHash: Sha256Schema,
  outputStagePhysicalIdentityHash: Sha256Schema,
  sourceBuildContextPolicy: z.literal(
    "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
  ),
  sourceStageMode: z.literal("0555"),
  buildToolchainRootLocator: z.literal("node_modules"),
  buildToolchainRootMode: z.literal("0555"),
  finalBuildContextEntries: z.tuple([
    z.literal("node_modules"),
    z.literal("source"),
  ]),
  outputStageInitialMode: z.literal("0700"),
  outputWasEmpty: z.literal(true),
  sourceAndOutputAreDistinct: z.literal(true),
  temporaryLocatorDisclosure: z.literal("forbidden"),
}).strict().superRefine((value, context) => {
  if (
    value.sourceStagePhysicalIdentityHash
      === value.outputStagePhysicalIdentityHash
    || value.buildToolchainPhysicalIdentityHash
      === value.outputStagePhysicalIdentityHash
    || value.sourceStagePhysicalIdentityHash
      === value.buildToolchainPhysicalIdentityHash
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Build source, toolchain and output stages must be physically distinct",
    });
  }
});

const PlatformReleaseBuildCommandV2Schema = z.object({
  commandRef: z.literal("BUILD_PLATFORM_RELEASE_V2"),
  contractHash: z.literal(PLATFORM_RELEASE_BUILD_CONTRACT_HASH_V2),
  executableRef: z.literal("RUNTIME_NODE_PROCESS"),
  moduleLocator: z.literal("scripts/build-platform-release-v2.mjs"),
  moduleContentHash: Sha256Schema,
  directArgvTemplate: z.tuple([
    z.literal("node"),
    z.literal("scripts/build-platform-release-v2.mjs"),
    z.literal("--source-root"),
    z.literal("<VERIFIED_SOURCE_STAGE>"),
    z.literal("--output-root"),
    z.literal("<EMPTY_OUTPUT_STAGE>"),
    z.literal("--build-toolchain-root"),
    z.literal("<AUTHENTICATED_BUILD_TOOLCHAIN_CAPSULE>"),
    z.literal("--build-toolchain-hash"),
    z.literal("<AUTHENTICATED_BUILD_TOOLCHAIN_TREE_HASH>"),
    z.literal("--source-sha"),
    z.literal("<ADMITTED_SOURCE_SHA>"),
    z.literal("--source-date-epoch"),
    z.literal("<ADMITTED_SOURCE_EPOCH>"),
  ]),
  cwd: z.literal("verified_source_stage"),
  sourceRootPassing: z.literal("parameterized_exact_stage"),
  outputRootPassing: z.literal("parameterized_exact_empty_stage"),
  buildToolchainPassing: z.literal(
    "parameterized_authenticated_sibling_capsule",
  ),
  compilerEntryDerivation: z.literal(
    "build_toolchain_typescript_bin_tsc",
  ),
  sourceIdentityPassing: z.literal(
    "parameterized_exact_admitted_sha",
  ),
  sourceClockPassing: z.literal(
    "parameterized_exact_admitted_git_epoch",
  ),
  shell: z.literal("forbidden"),
}).strict();

export const PlatformReleaseBuildCommandResultV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BUILD_COMMAND_RESULT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  sourceFingerprintHash: Sha256Schema,
  sourceFileCount: z.number().int().positive()
    .max(PLATFORM_RELEASE_SOURCE_MAX_FILES_V2),
  sourceDirectoryCount: z.number().int().nonnegative()
    .max(PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2),
  sourceTotalBytes: z.number().int().positive()
    .max(PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2),
  sourceSha: GitObjectHashSchema,
  sourceDateEpoch: CanonicalDecimalEpochV2Schema,
  buildToolchainTreeHash: Sha256Schema,
  buildToolchainFileCount: z.number().int().positive()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxFiles),
  buildToolchainDirectoryCount: z.number().int().positive()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxDirectories),
  buildToolchainTotalBytes: z.number().int().positive()
    .max(CANONICAL_RUNTIME_TREE_V2_PROFILES.dependencies.maxTotalBytes),
  compilerEntryHash: Sha256Schema,
  platformFileCount: z.number().int().positive().max(20_000),
  platformDirectoryCount: z.number().int().nonnegative().max(4_000),
  platformTotalBytes: z.number().int().positive()
    .max(512 * 1024 * 1024),
  outputLayout: z.literal("payload_dist_and_package_json_only"),
  productionUse: z.literal(
    "forbidden_until_dependency_materialization_and_manifest_verification",
  ),
}).strict();

export type PlatformReleaseBuildCommandResultV2 = z.infer<
  typeof PlatformReleaseBuildCommandResultV2Schema
>;

const PlatformReleaseBuildProcessOutcomeV2Schema = z.object({
  stdin: z.literal("closed"),
  inheritAmbientEnvironment: z.literal(false),
  environment: z.object({
    CI: z.literal("true"),
    LANG: z.literal("C.UTF-8"),
    LC_ALL: z.literal("C.UTF-8"),
    NO_COLOR: z.literal("1"),
    SOURCE_DATE_EPOCH: CanonicalDecimalEpochV2Schema,
    TZ: z.literal("UTC"),
  }).strict(),
  termination: z.literal("normal_exit"),
  exitCode: z.literal(0),
  stdoutContentHash: Sha256Schema,
  stdoutByteLength: z.number().int().nonnegative().max(1024 * 1024),
  stderrContentHash: Sha256Schema,
  stderrByteLength: z.number().int().nonnegative().max(1024 * 1024),
  commandResult: PlatformReleaseBuildCommandResultV2Schema,
}).strict().superRefine((value, context) => {
  const stdout = `${canonicalJsonStringify(value.commandResult)}\n`;
  const expectedStdoutHash = createHash("sha256")
    .update(stdout)
    .digest("hex");
  if (
    value.stdoutContentHash !== expectedStdoutHash
    || value.stdoutByteLength !== Buffer.byteLength(stdout, "utf8")
    || value.stderrContentHash
      !== PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2
    || value.stderrByteLength !== 0
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Successful build process evidence must bind one exact command result and empty stderr",
    });
  }
});

const PlatformReleaseBuildOutputIdentityV2Schema = z.object({
  runtimePayload: PlatformRuntimePayloadCandidateV2Schema,
  npmMaterializationReceipt:
    NpmMaterializationReceiptCandidateV2Schema,
  legacyStitchConverter: ExactLegacyStitchConverterRefV2Schema,
  outputClosureHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (
    value.npmMaterializationReceipt.dependencyTreeHash
      !== value.runtimePayload.dependencyTree.treeHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["npmMaterializationReceipt", "dependencyTreeHash"],
      message: "npm receipt must bind the exact produced dependency tree",
    });
  }
  const expected = hashCanonicalJson({
    schema: "setfarm.platform-release-build-output-closure.v2",
    runtimePayloadHash: value.runtimePayload.runtimePayloadHash,
    platformTreeBindingHash: value.runtimePayload.platformTree.bindingHash,
    dependencyTreeBindingHash: value.runtimePayload.dependencyTree.bindingHash,
    packageJsonHash: value.runtimePayload.packageJson.hash,
    npmMaterializationReceiptHash:
      value.npmMaterializationReceipt.receiptHash,
    legacyStitchConverter: value.legacyStitchConverter,
  });
  if (value.outputClosureHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["outputClosureHash"],
      message: "Build output closure hash mismatch",
    });
  }
});

const PlatformReleaseBuildReceiptIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_BUILD_RECEIPT_V2_SCHEMA),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal("candidate_build_observation_unverified"),
  productionUse: z.literal(
    "forbidden_until_double_build_and_fresh_release_verification",
  ),
  sourceAdmissionReceiptHash: Sha256Schema,
  buildToolchainReceiptHash: Sha256Schema,
  source: PlatformReleaseSourceTreeBindingV2Schema,
  buildToolchain: PlatformReleaseBuildToolchainTreeBindingV2Schema,
  stage: PlatformReleaseBuildStageV2Schema,
  inputs: PlatformReleaseSourceInputsV2Schema,
  compiler: PlatformReleaseCompilerIdentityV2Schema,
  packageManager: PlatformReleasePackageManagerIdentityV2Schema,
  command: PlatformReleaseBuildCommandV2Schema,
  sourceDateEpoch: CanonicalDecimalEpochV2Schema,
  process: PlatformReleaseBuildProcessOutcomeV2Schema,
  output: PlatformReleaseBuildOutputIdentityV2Schema,
}).strict().superRefine((value, context) => {
  const result = value.process.commandResult;
  if (
    value.process.environment.SOURCE_DATE_EPOCH !== value.sourceDateEpoch
    || result.sourceDateEpoch !== value.sourceDateEpoch
    || result.compilerEntryHash !== value.compiler.entryModuleHash
    || result.sourceFingerprintHash !== value.source.exportedFileTreeHash
    || result.sourceFileCount !== value.source.exportedFileCount
    || result.sourceDirectoryCount
      !== value.source.exportedDirectoryCount
    || result.sourceTotalBytes !== value.source.exportedTotalBytes
    || result.buildToolchainTreeHash
      !== value.buildToolchain.treeHash
    || result.buildToolchainFileCount
      !== value.buildToolchain.fileCount
    || result.buildToolchainDirectoryCount
      !== value.buildToolchain.directoryCount
    || result.buildToolchainTotalBytes
      !== value.buildToolchain.totalBytes
    || result.platformFileCount
      !== value.output.runtimePayload.platformTree.fileCount
    || result.platformDirectoryCount
      !== value.output.runtimePayload.platformTree.directoryCount
    || result.platformTotalBytes
      !== value.output.runtimePayload.platformTree.totalBytes
    || hashCanonicalJson({
      schema: "setfarm.platform-release-source-input-membership.v2",
      entries: value.inputs.map((entry) => ({
        role: entry.role,
        locator: entry.locator,
        sourceRefHash: entry.sourceRefHash,
      })),
    }) !== value.source.inputMembershipHash
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Build receipt must use one exact source input set and Git-derived clock",
    });
  }
});

export type PlatformReleaseBuildReceiptHashPayloadV2 = z.infer<
  typeof PlatformReleaseBuildReceiptIdentityV2Schema
>;

export function hashPlatformReleaseBuildReceiptV2(
  value:
    | PlatformReleaseBuildReceiptHashPayloadV2
    | PlatformReleaseBuildReceiptV2,
): string {
  const receipt = { ...value } as Record<string, unknown>;
  delete receipt.receiptHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-build-receipt-hash.v2",
    receipt,
  });
}

export const PlatformReleaseBuildReceiptV2Schema =
  PlatformReleaseBuildReceiptIdentityV2Schema.safeExtend({
    receiptHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_BUILD_RECEIPT_MAX_CANONICAL_BYTES_V2,
    )) {
      context.addIssue({
        code: "custom",
        message: "Platform release build receipt exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.receiptHash !== hashPlatformReleaseBuildReceiptV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["receiptHash"],
        message: "Platform release build receipt hash mismatch",
      });
    }
  });

export type PlatformReleaseBuildReceiptV2 = z.infer<
  typeof PlatformReleaseBuildReceiptV2Schema
>;

export function parseSourceAdmissionReceiptCandidateV2(
  input: unknown,
): SourceAdmissionReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_SOURCE_ADMISSION_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    SourceAdmissionReceiptV2Schema.parse(snapshot),
  );
}

export function parsePlatformReleaseBuildReceiptCandidateV2(
  input: unknown,
): PlatformReleaseBuildReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BUILD_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBuildReceiptV2Schema.parse(snapshot),
  );
}

export function parsePlatformReleaseBuildToolchainReceiptCandidateV2(
  input: unknown,
): PlatformReleaseBuildToolchainReceiptV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_MAX_CANONICAL_BYTES_V2,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBuildToolchainReceiptV2Schema.parse(snapshot),
  );
}
