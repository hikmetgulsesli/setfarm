import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
  type Stats,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isProxy } from "node:util/types";

import {
  canonicalJsonBytes,
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  hashHostNodePlatformReleaseOutputStageIdentityV2,
} from
  "../product-compiler/host-node-toolchain-authority-v2.js";
import {
  getNodeScaffoldRuntimeMetadataProbeInternalV2,
  readExactNpmLockRegularFileInternalV2,
} from
  "../product-compiler/node-scaffold-production-materialization-v2.js";
import {
  captureCanonicalRuntimeTreeV2,
  captureCanonicalRuntimeTreeV2ForTest,
  verifyCanonicalRuntimeTreeV2,
} from "./canonical-runtime-tree-v2.js";
import {
  type CanonicalRuntimeTreeV2,
} from "./schemas/canonical-runtime-tree-v2.js";
import {
  EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
  PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_V2,
  PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2,
  PLATFORM_RELEASE_SOURCE_MAX_FILES_V2,
  PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2,
  PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_V2,
  PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
  SOURCE_ADMISSION_RECEIPT_V2_SCHEMA,
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_INSTALL_RECIPE_V2_SCHEMA,
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_PHYSICAL_IDENTITY_V2_SCHEMA,
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_V2_SCHEMA,
  PlatformReleaseBuildToolchainPhysicalIdentityV2Schema,
  PlatformReleaseBuildToolchainReceiptV2Schema,
  PlatformReleaseSourceTreeBindingV2Schema,
  SourceAdmissionReceiptV2Schema,
  hashExactPlatformReleaseSourceRefV2,
  hashPlatformReleaseBuildToolchainInstallRecipeV2,
  hashPlatformReleaseBuildToolchainPhysicalIdentityV2,
  hashPlatformReleaseBuildToolchainReceiptV2,
  hashPlatformReleaseBuildCommandResultV2,
  hashPlatformReleaseSourceStagePhysicalIdentityV2,
  hashPlatformReleaseSourceTreeBindingV2,
  hashSourceAdmissionReceiptV2,
  type PlatformReleaseBuildToolchainPhysicalIdentityV2,
  type PlatformReleaseBuildToolchainReceiptV2,
  type PlatformReleaseBuildCommandResultV2,
  type PlatformReleaseSourceStagePhysicalIdentityV2,
  type PlatformReleaseSourceTreeBindingV2,
  type SourceAdmissionReceiptV2,
} from "./schemas/platform-release-build-v2.js";
import {
  createPlatformReleaseCompiledOutputPairInspectionV2,
  createPlatformReleasePredependencyOutputBindingV2,
  type PlatformReleaseCompiledOutputPairInspectionV2,
  type PlatformReleasePredependencyOutputBindingV2,
} from
  "./schemas/platform-release-compiled-output-pair-v2.js";
import {
  createPlatformReleaseDependencyMaterializedPairInspectionV2,
  createPlatformReleaseDependencyOutputBindingV2,
  type PlatformReleaseDependencyMaterializedPairInspectionV2,
  type PlatformReleaseDependencyOutputBindingV2,
} from
  "./schemas/platform-release-dependency-materialized-pair-v2.js";
import {
  ExactHostOwnedFileRefV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  type ExactHostOwnedFileRefV2,
} from "./schemas/platform-release-common-v2.js";
import {
  executePlatformReleaseHostNodeToolchainBuildInternalV2,
  executePlatformReleaseHostNodeToolchainNpmCiInternalV2,
  executePlatformReleaseHostNodeToolchainProductionNpmCiInternalV2,
  inspectPlatformReleaseHostNodeToolchainReceiptV2,
  isProductionPlatformReleaseHostNodeToolchainAuthorityV2,
  revalidatePlatformReleaseHostNodeToolchainAuthorityV2,
  PlatformReleaseHostNodeToolchainAuthorityErrorV2,
  type PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2,
  type PlatformReleaseHostNodeToolchainBuildEvidenceV2,
  type PlatformReleaseHostNodeToolchainAuthorityV2,
  type PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2,
} from
  "./platform-release-host-node-toolchain-authority-v2.js";
import {
  PLATFORM_RELEASE_BUILD_TOOLCHAIN_NPM_CONFIG_HASH_V2,
  derivePlatformReleaseSourceLockAuthorityInternalV2,
  materializePlatformReleaseBuildToolchainTreeInternalV2,
  revalidatePlatformReleaseBuildToolchainTreeInternalV2,
  PlatformReleaseBuildToolchainMaterializationErrorV2,
  type PlatformReleaseBuildToolchainMaterializationErrorCodeV2,
  type PlatformReleaseBuildToolchainLockPackageV2,
  type PlatformReleaseSourceLockAuthorityV2,
  type PlatformReleaseBuildToolchainTreeMaterializationV2,
} from
  "./platform-release-build-toolchain-materialization-v2.js";
import {
  materializePlatformReleaseProductionDependenciesInternalV2,
  revalidatePlatformReleaseProductionDependenciesInternalV2,
  PlatformReleaseProductionDependencyMaterializationErrorV2,
  type PlatformReleaseProductionDependencyMaterializationErrorCodeV2,
  type PlatformReleaseProductionDependencyMaterializationV2,
} from
  "./platform-release-production-dependency-materialization-v2.js";

const FULL_GIT_OBJECT_HASH_V2 = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const PORTABLE_SOURCE_PATH_V2 =
  /^(?:[A-Za-z0-9._@+-]+)(?:\/[A-Za-z0-9._@+-]+)*$/;
const SOURCE_FILE_MAX_BYTES_V2 = 64 * 1024 * 1024;
const GIT_LISTING_MAX_BYTES_V2 = 64 * 1024 * 1024;
const GIT_DIAGNOSTIC_MAX_BYTES_V2 = 16 * 1024;
const GIT_COMMAND_TIMEOUT_MS_V2 = 60_000;
const SOURCE_STAGE_PREFIX_V2 =
  "setfarm-platform-release-source-v2-";
const BUILD_TOOLCHAIN_ENVIRONMENT_PREFIX_V2 =
  "setfarm-platform-build-toolchain-env-v2-";
const BUILD_TOOLCHAIN_INSTALL_PREFIX_V2 =
  "setfarm-platform-build-toolchain-install-v2-";
const COMPILED_OUTPUT_FIRST_PREFIX_V2 =
  "setfarm-platform-compiled-output-first-v2-";
const COMPILED_OUTPUT_SECOND_PREFIX_V2 =
  "setfarm-platform-compiled-output-second-v2-";
const PRODUCTION_DEPENDENCY_ENVIRONMENT_FIRST_PREFIX_V2 =
  "setfarm-platform-production-dependency-environment-first-v2-";
const PRODUCTION_DEPENDENCY_ENVIRONMENT_SECOND_PREFIX_V2 =
  "setfarm-platform-production-dependency-environment-second-v2-";
const PRODUCTION_DEPENDENCY_INSTALL_FIRST_PREFIX_V2 =
  "setfarm-platform-production-dependency-install-first-v2-";
const PRODUCTION_DEPENDENCY_INSTALL_SECOND_PREFIX_V2 =
  "setfarm-platform-production-dependency-install-second-v2-";
const SOURCE_ADMISSION_INPUT_MAX_BYTES_V2 = 256 * 1024;

export type PlatformReleaseSourceAdmissionErrorCodeV2 =
  | "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_GIT_COMMAND_FAILED"
  | "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID"
  | "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT"
  | "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED"
  | "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED"
  | "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY"
  | "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED"
  | "PLATFORM_RELEASE_SOURCE_V2_TEST_ONLY";

export class PlatformReleaseSourceAdmissionErrorV2 extends Error {
  readonly code: PlatformReleaseSourceAdmissionErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseSourceAdmissionErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name = "PlatformReleaseSourceAdmissionErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type GitOriginTransportV2 =
  | "github_https"
  | "github_ssh"
  | "test_fixture_local";

type RemoteObservationV2 = Readonly<{
  repositoryId:
    | typeof PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2
    | "test_fixture";
  originTransport: GitOriginTransportV2;
  originUrlHash: string;
  remoteRef: "refs/remotes/origin/main";
  observedSha: string;
  observedTreeHash: string;
  observationHash: string;
}>;

type GitSourceFenceV2 = Readonly<{
  headSha: string;
  treeHash: string;
  indexTreeHash: string;
  identityHash: string;
}>;

type CleanWorktreeProofV2 = Readonly<{
  dirty: false;
  untrackedEntryCount: 0;
  statusPorcelainContentHash:
    typeof PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2;
  headSha: string;
  treeHash: string;
  indexTreeHash: string;
  proofHash: string;
}>;

type CapturedGitFenceV2 = Readonly<{
  branch: "main";
  originUrl: string;
  remote: RemoteObservationV2;
  source: GitSourceFenceV2;
  clean: CleanWorktreeProofV2;
}>;

type GitTreeFileV2 = Readonly<{
  locator: string;
  gitMode: "100644" | "100755";
  blobHash: string;
}>;

type CapturedGitObjectV2 = Readonly<{
  objectHash: string;
  objectType: "blob" | "commit";
  bytes: Buffer;
}>;

type SourceFingerprintEntryV2 =
  | Readonly<{
    path: string;
    type: "directory";
    mode: "0555";
  }>
  | Readonly<{
    path: string;
    type: "file";
    mode: "0444" | "0555";
    byteLength: number;
    contentHash: string;
  }>;

type SourceFingerprintV2 = Readonly<{
  entries: readonly SourceFingerprintEntryV2[];
  fileCount: number;
  directoryCount: number;
  totalBytes: number;
  fingerprintHash: string;
}>;

type SourceExportCoreV2 = Readonly<{
  admittedSource: Readonly<{
    sha: string;
    treeHash: string;
    commitEpochSeconds: string;
  }>;
  remoteBefore: RemoteObservationV2;
  remoteAfter: RemoteObservationV2;
  sourceBefore: GitSourceFenceV2;
  sourceAfter: GitSourceFenceV2;
  cleanWorktreeBefore: CleanWorktreeProofV2;
  cleanWorktreeAfter: CleanWorktreeProofV2;
  source: PlatformReleaseSourceTreeBindingV2;
  stageBefore: PlatformReleaseSourceStagePhysicalIdentityV2;
  stageAfter: PlatformReleaseSourceStagePhysicalIdentityV2;
  gitExecutableHash: string;
  gitExecutableByteLength: number;
}>;

export type PlatformReleaseSourceAdmissionTestEvidenceV2 = Readonly<{
  schema: "setfarm.platform-release-source-admission-test-evidence.v2";
  authorityState: "test_fixture_source_admission_only";
  productionUse: "forbidden";
  repositoryId: "test_fixture";
  admittedSource: SourceExportCoreV2["admittedSource"];
  remoteBefore: RemoteObservationV2;
  remoteAfter: RemoteObservationV2;
  sourceBefore: GitSourceFenceV2;
  sourceAfter: GitSourceFenceV2;
  cleanWorktreeBefore: CleanWorktreeProofV2;
  cleanWorktreeAfter: CleanWorktreeProofV2;
  exportedSource: Readonly<{
    method: "verified_git_tree_export.v2";
    buildContextPolicy:
      "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2";
    source: PlatformReleaseSourceTreeBindingV2;
    initialStageWasEmpty: true;
    stageBefore: PlatformReleaseSourceStagePhysicalIdentityV2;
    stageAfter: PlatformReleaseSourceStagePhysicalIdentityV2;
    temporaryLocatorDisclosure: "forbidden";
  }>;
  gitExecutable: Readonly<{
    hash: string;
    byteLength: number;
    authority: "test_fixture_process_tool";
  }>;
}>;

export type PlatformReleaseSourceAdmissionCandidateSnapshotV2 =
  | Readonly<{
    admissionScope: "production_candidate";
    receipt: SourceAdmissionReceiptV2;
    testEvidence: null;
  }>
  | Readonly<{
    admissionScope: "test_fixture";
    receipt: null;
    testEvidence: PlatformReleaseSourceAdmissionTestEvidenceV2;
  }>;

type PlatformReleaseSourceContextLifecycleV2 =
  | "source_admitted"
  | "toolchain_materializing"
  | "toolchain_materialized"
  | "toolchain_revalidating"
  | "double_build_running"
  | "double_build_complete"
  | "dependency_materializing"
  | "release_completed"
  | "disposed";

type SourceOwnedPrivateDirectoryIdentityV2 = Readonly<{
  device: number;
  inode: number;
  ownerUid: number;
  ownerGid: number;
  mode: 0o700;
}>;

type SourceOwnedPrivateDirectoryV2 = Readonly<{
  absolutePath: string;
  identity: SourceOwnedPrivateDirectoryIdentityV2;
}>;

type SourceOwnedOutputRootSlotV2 =
  | Readonly<{ status: "empty" }>
  | Readonly<{
    status: "parent_created";
    privateParentPath: string;
  }>
  | Readonly<{
    status: "parent_anchored";
    privateParent: SourceOwnedPrivateDirectoryV2;
  }>
  | Readonly<{
    status: "output_created";
    privateParent: SourceOwnedPrivateDirectoryV2;
    outputPath: string;
  }>
  | Readonly<{
    status: "output_anchored";
    privateParent: SourceOwnedPrivateDirectoryV2;
    outputRoot: SourceOwnedPrivateDirectoryV2;
  }>;

type SourceOwnedOutputRootRegistryV2 = {
  cleanupState:
    | "open"
    | "cleaning"
    | "cleaned"
    | "cleanup_failed";
  first: SourceOwnedOutputRootSlotV2;
  second: SourceOwnedOutputRootSlotV2;
};

type SourceOwnedOutputAllocationFaultV2 = Readonly<{
  checkpoint:
    | "after_first_parent_created"
    | "after_first_output_created";
  observePath: (absolutePath: string) => void;
}>;

export type PlatformReleaseDependencyMaterializationFaultForTestV2 =
  Readonly<{
    checkpoint:
      | "after_first_dependency_root_opened"
      | "after_first_dependency_root_adopted"
      | "after_first_dependency_root_resealed"
      | "after_second_dependency_root_opened"
      | "after_second_dependency_root_adopted"
      | "after_second_dependency_root_resealed"
      | "after_final_async_fence"
      | "before_scratch_cleanup"
      | "after_scratch_cleanup_before_registration"
      | "after_registration_and_predecessor_consumption_before_return";
    observePath: (absolutePath: string) => void;
  }>;

type SourceStageStateV2 = {
  readonly admissionScope: "production_candidate" | "test_fixture";
  readonly contextRoot: string;
  readonly stageRoot: string;
  readonly core: SourceExportCoreV2;
  readonly receipt: SourceAdmissionReceiptV2 | null;
  readonly testEvidence: PlatformReleaseSourceAdmissionTestEvidenceV2 | null;
  readonly contextAnchor: SourceOwnedPrivateDirectoryV2;
  readonly ownedOutputRoots:
    SourceOwnedOutputRootRegistryV2;
  lifecycle: PlatformReleaseSourceContextLifecycleV2;
};

type InitialSourceStageStateV2 = Omit<
  SourceStageStateV2,
  "ownedOutputRoots"
>;

export type AdmitPlatformReleaseSourceV2Input = Readonly<{
  repositoryRoot: string;
  implementation: unknown;
  gitTool: unknown;
}>;

export type AdmitPlatformReleaseSourceV2ForTestInput = Readonly<{
  repositoryRoot: string;
  gitExecutable?: string;
  afterInitialFenceForTest?: () => void;
  afterFirstStageCaptureForTest?: (stageRoot: string) => void;
}>;

const sourceStageConstructorCapabilityV2 = Object.freeze({});
const sourceStageStatesV2 = new WeakMap<object, SourceStageStateV2>();

export class AdmittedPlatformReleaseSourceStageV2 {
  readonly authorityState =
    "candidate_source_stage_unverified" as const;
  readonly sourceBindingHash: string;
  readonly admittedSha: string;

  constructor(
    capability: object,
    state: SourceStageStateV2,
  ) {
    if (capability !== sourceStageConstructorCapabilityV2) {
      throw new PlatformReleaseSourceAdmissionErrorV2(
        "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
        "Source stage constructor capability is unavailable",
      );
    }
    this.sourceBindingHash = state.core.source.bindingHash;
    this.admittedSha = state.core.admittedSource.sha;
    sourceStageStatesV2.set(this, state);
    Object.freeze(this);
  }
}

export type PlatformReleaseBuildToolchainCapsuleErrorCodeV2 =
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INSTALL_FAILED"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_ALREADY_MATERIALIZED"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_REVALIDATION_IN_FLIGHT"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED"
  | "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED";

export class PlatformReleaseBuildToolchainCapsuleErrorV2
  extends Error {
  readonly code:
    PlatformReleaseBuildToolchainCapsuleErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseBuildToolchainCapsuleErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseBuildToolchainCapsuleErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type BuildToolchainCapsuleStateV2 = Readonly<{
  admissionScope: "production_host" | "test_fixture";
  sourceStage: AdmittedPlatformReleaseSourceStageV2;
  hostToolchain:
    PlatformReleaseHostNodeToolchainAuthorityV2;
  contextRoot: string;
  nodeModulesRoot: string;
  source:
    PlatformReleaseSourceTreeBindingV2;
  materialized:
    PlatformReleaseBuildToolchainTreeMaterializationV2;
  receipt: PlatformReleaseBuildToolchainReceiptV2;
}>;

const buildToolchainCapsuleConstructorCapabilityV2 =
  Object.freeze({});
const buildToolchainCapsuleStatesV2 =
  new WeakMap<object, BuildToolchainCapsuleStateV2>();

export class PlatformReleaseBuildToolchainCapsuleV2 {
  readonly authorityState =
    "candidate_build_toolchain_materialization_unverified" as const;
  readonly admissionScope:
    "production_host" | "test_fixture";
  readonly sourceBindingHash: string;
  readonly treeHash: string;
  readonly receiptHash: string;

  constructor(
    capability: object,
    state: BuildToolchainCapsuleStateV2,
  ) {
    if (
      capability
        !== buildToolchainCapsuleConstructorCapabilityV2
    ) {
      throw new PlatformReleaseBuildToolchainCapsuleErrorV2(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED",
        "Build toolchain capsule constructor capability is unavailable",
      );
    }
    this.admissionScope = state.admissionScope;
    this.sourceBindingHash =
      state.source.bindingHash;
    this.treeHash = state.materialized.treeBinding.treeHash;
    this.receiptHash = state.receipt.receiptHash;
    buildToolchainCapsuleStatesV2.set(this, state);
    Object.freeze(this);
  }
}

export type PlatformReleaseCompiledOutputPairErrorCodeV2 =
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_ALREADY_MATERIALIZED"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_BUILD_FAILED"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_EQUALITY_FAILED"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_CLEANUP_FAILED"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_HANDLE_UNAUTHENTICATED"
  | "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TEST_ONLY";

export class PlatformReleaseCompiledOutputPairErrorV2
  extends Error {
  readonly code:
    PlatformReleaseCompiledOutputPairErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code: PlatformReleaseCompiledOutputPairErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseCompiledOutputPairErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseDependencyMaterializedPairErrorCodeV2 =
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_ALREADY_CLAIMED"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_FAILED"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_LOCK_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLOSURE_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_TREE_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_NORMALIZATION_FAILED"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_GRAPH_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_EQUALITY_FAILED"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HANDLE_UNAUTHENTICATED"
  | "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TEST_ONLY";

export class PlatformReleaseDependencyMaterializedPairErrorV2
  extends Error {
  readonly code:
    PlatformReleaseDependencyMaterializedPairErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseDependencyMaterializedPairErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseDependencyMaterializedPairErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

type CompiledPackageIdentityV2 = Readonly<{
  sourceRefHash: string;
  contentHash: string;
  byteLength: number;
  mode: "0444";
}>;

type CompiledOccurrenceStateV2 = Readonly<{
  occurrence: "first" | "second";
  slot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  >;
  hostEvidence:
    PlatformReleaseHostNodeToolchainBuildEvidenceV2;
  outputStagePhysicalIdentityHash: string;
  stableHostProjectionHash: string;
  commandResult: PlatformReleaseBuildCommandResultV2;
  distTree: CanonicalRuntimeTreeV2;
  packageIdentity: CompiledPackageIdentityV2;
  binding: PlatformReleasePredependencyOutputBindingV2;
}>;

type CompiledOutputPairStateV2 = Readonly<{
  admissionScope: "production_candidate" | "test_fixture";
  sourceStage: AdmittedPlatformReleaseSourceStageV2;
  buildToolchain:
    PlatformReleaseBuildToolchainCapsuleV2;
  first: CompiledOccurrenceStateV2;
  second: CompiledOccurrenceStateV2;
  inspection:
    PlatformReleaseCompiledOutputPairInspectionV2;
  ownership: {
    lifecycle:
      | "ready"
      | "consuming"
      | "consumed"
      | "invalidated";
  };
}>;

const compiledOutputPairConstructorCapabilityV2 =
  Object.freeze({});
const compiledOutputPairStatesV2 =
  new WeakMap<object, CompiledOutputPairStateV2>();

export class PlatformReleaseCompiledOutputPairV2 {
  readonly authorityState =
    "candidate_compiled_output_pair_unverified" as const;
  readonly admissionScope:
    "production_candidate" | "test_fixture";
  readonly sourceBindingHash: string;
  readonly stableOutputBindingHash: string;

  constructor(
    capability: object,
    state: CompiledOutputPairStateV2,
  ) {
    if (
      capability
        !== compiledOutputPairConstructorCapabilityV2
    ) {
      throw new PlatformReleaseCompiledOutputPairErrorV2(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_HANDLE_UNAUTHENTICATED",
        "Compiled output pair constructor capability is unavailable",
      );
    }
    this.admissionScope = state.admissionScope;
    this.sourceBindingHash =
      state.inspection.sourceBindingHash;
    this.stableOutputBindingHash =
      state.inspection.stableOutput.bindingHash;
    compiledOutputPairStatesV2.set(this, state);
    Object.freeze(this);
  }
}

type DependencyMaterializedOccurrenceStateV2 = Readonly<{
  occurrence: "first" | "second";
  compiled: CompiledOccurrenceStateV2;
  hostEvidence:
    PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2;
  materialized:
    PlatformReleaseProductionDependencyMaterializationV2;
  dependencyTreePhysicalIdentityHash: string;
  binding: PlatformReleaseDependencyOutputBindingV2;
}>;

type DependencyMaterializedPairStateV2 = Readonly<{
  admissionScope: "production_candidate" | "test_fixture";
  sourceStage: AdmittedPlatformReleaseSourceStageV2;
  buildToolchain:
    PlatformReleaseBuildToolchainCapsuleV2;
  compiledOutputPair:
    PlatformReleaseCompiledOutputPairV2;
  first: DependencyMaterializedOccurrenceStateV2;
  second: DependencyMaterializedOccurrenceStateV2;
  inspection:
    PlatformReleaseDependencyMaterializedPairInspectionV2;
  ownership: {
    lifecycle:
      | "ready"
      | "consuming"
      | "consumed"
      | "invalidated";
  };
}>;

const dependencyMaterializedPairConstructorCapabilityV2 =
  Object.freeze({});
const dependencyMaterializedPairStatesV2 =
  new WeakMap<object, DependencyMaterializedPairStateV2>();

export class PlatformReleaseDependencyMaterializedPairV2 {
  readonly authorityState =
    "candidate_dependency_materialized_pair_unverified" as const;
  readonly admissionScope:
    "production_candidate" | "test_fixture";
  readonly sourceBindingHash: string;
  readonly stableOutputBindingHash: string;

  constructor(
    capability: object,
    state: DependencyMaterializedPairStateV2,
  ) {
    if (
      capability
        !== dependencyMaterializedPairConstructorCapabilityV2
    ) {
      throw new PlatformReleaseDependencyMaterializedPairErrorV2(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HANDLE_UNAUTHENTICATED",
        "Dependency-materialized pair constructor capability is unavailable",
      );
    }
    this.admissionScope = state.admissionScope;
    this.sourceBindingHash =
      state.inspection.sourceBindingHash;
    this.stableOutputBindingHash =
      state.inspection.stableOutput.bindingHash;
    dependencyMaterializedPairStatesV2.set(this, state);
    Object.freeze(this);
  }
}

function fail(
  code: PlatformReleaseSourceAdmissionErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseSourceAdmissionErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function failCompiledOutputPair(
  code: PlatformReleaseCompiledOutputPairErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseCompiledOutputPairErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function failDependencyMaterializedPair(
  code:
    PlatformReleaseDependencyMaterializedPairErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseDependencyMaterializedPairErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

const BUILD_TOOLCHAIN_CAPSULE_ERROR_CODE_TO_COMPILED_OUTPUT_PAIR_V2 =
  Object.freeze({
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SCOPE_MISMATCH:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INSTALL_FAILED:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_ALREADY_MATERIALIZED:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_ALREADY_MATERIALIZED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_REVALIDATION_IN_FLIGHT:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_ALREADY_MATERIALIZED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_CLEANUP_FAILED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED:
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
  } satisfies Readonly<Record<
    PlatformReleaseBuildToolchainCapsuleErrorCodeV2,
    PlatformReleaseCompiledOutputPairErrorCodeV2
  >>);

const BUILD_TOOLCHAIN_CAPSULE_ERROR_CODE_TO_DEPENDENCY_PAIR_V2 =
  Object.freeze({
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INPUT_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SCOPE_MISMATCH:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INSTALL_FAILED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_FAILED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_ALREADY_MATERIALIZED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_ALREADY_CLAIMED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_REVALIDATION_IN_FLIGHT:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_ALREADY_CLAIMED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
  } satisfies Readonly<Record<
    PlatformReleaseBuildToolchainCapsuleErrorCodeV2,
    PlatformReleaseDependencyMaterializedPairErrorCodeV2
  >>);

function compiledOutputPairErrorFromBuildToolchainCapsuleV2(
  error: PlatformReleaseBuildToolchainCapsuleErrorV2,
  message: string,
): PlatformReleaseCompiledOutputPairErrorV2 {
  return new PlatformReleaseCompiledOutputPairErrorV2(
    BUILD_TOOLCHAIN_CAPSULE_ERROR_CODE_TO_COMPILED_OUTPUT_PAIR_V2[
      error.code
    ],
    message,
    { cause: error },
  );
}

function dependencyPairErrorFromBuildToolchainCapsuleV2(
  error: PlatformReleaseBuildToolchainCapsuleErrorV2,
  message: string,
): PlatformReleaseDependencyMaterializedPairErrorV2 {
  return new PlatformReleaseDependencyMaterializedPairErrorV2(
    BUILD_TOOLCHAIN_CAPSULE_ERROR_CODE_TO_DEPENDENCY_PAIR_V2[
      error.code
    ],
    message,
    { cause: error },
  );
}

const HOST_TOOLCHAIN_ERROR_CODE_TO_DEPENDENCY_PAIR_V2 =
  Object.freeze({
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_AUTHORITY_REQUIRED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_TEST_AUTHORITY_REQUIRED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HOST_COMPOSITION_BOOTSTRAP_UNAVAILABLE",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_AUTHORITY_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_DRIFT:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_BUILD_FAILED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_INSTALL_FAILED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_FAILED",
    PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_PRODUCTION_INSTALL_SCOPE_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
  } satisfies Readonly<Record<
    PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2,
    PlatformReleaseDependencyMaterializedPairErrorCodeV2
  >>);

const PRODUCTION_DEPENDENCY_ERROR_CODE_TO_PAIR_V2 =
  Object.freeze({
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INPUT_INVALID",
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_LOCK_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_LOCK_INVALID",
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_CLOSURE_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLOSURE_INVALID",
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_INSTALL_TREE_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_TREE_INVALID",
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_NORMALIZATION_FAILED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_NORMALIZATION_FAILED",
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_GRAPH_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_GRAPH_INVALID",
    PLATFORM_RELEASE_PRODUCTION_DEPENDENCY_V2_AUTHORITY_MISMATCH:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH",
  } satisfies Readonly<Record<
    PlatformReleaseProductionDependencyMaterializationErrorCodeV2,
    PlatformReleaseDependencyMaterializedPairErrorCodeV2
  >>);

const SOURCE_LOCK_ERROR_CODE_TO_DEPENDENCY_PAIR_V2 =
  Object.freeze({
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INPUT_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INPUT_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_LOCK_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_LOCK_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_INSTALL_TREE_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_CLOSURE_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLOSURE_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_COMPILER_INVALID:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_LOCK_INVALID",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_NORMALIZATION_FAILED:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_NORMALIZATION_FAILED",
    PLATFORM_RELEASE_BUILD_TOOLCHAIN_V2_AUTHORITY_MISMATCH:
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH",
  } satisfies Readonly<Record<
    PlatformReleaseBuildToolchainMaterializationErrorCodeV2,
    PlatformReleaseDependencyMaterializedPairErrorCodeV2
  >>);

function failDependencyPairFromHostToolchainV2(
  error: unknown,
  message: string,
): never {
  if (
    error instanceof
    PlatformReleaseHostNodeToolchainAuthorityErrorV2
  ) {
    return failDependencyMaterializedPair(
      HOST_TOOLCHAIN_ERROR_CODE_TO_DEPENDENCY_PAIR_V2[
        error.code
      ],
      message,
      error,
    );
  }
  return failDependencyMaterializedPair(
    "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
    message,
    error,
  );
}

function isPlatformReleaseHostAuthorityDriftV2(
  error: unknown,
): error is PlatformReleaseHostNodeToolchainAuthorityErrorV2 {
  return error
    instanceof PlatformReleaseHostNodeToolchainAuthorityErrorV2
    && (
      error.code
        === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_AUTHORITY_INVALID"
      || error.code
        === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_RECEIPT_INVALID"
      || error.code
        === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HANDLE_UNAUTHENTICATED"
      || error.code
        === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_HOST_DRIFT"
      || error.code
        === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_AUTHORITY_INVALID"
      || error.code
        === "PLATFORM_RELEASE_HOST_NODE_TOOLCHAIN_V2_COMPOSITION_DRIFT"
    );
}

function failDependencyPairFromMaterializationV2(
  error: unknown,
  message: string,
): never {
  if (
    error instanceof
    PlatformReleaseProductionDependencyMaterializationErrorV2
  ) {
    return failDependencyMaterializedPair(
      PRODUCTION_DEPENDENCY_ERROR_CODE_TO_PAIR_V2[
        error.code
      ],
      message,
      error,
    );
  }
  return failDependencyMaterializedPair(
    "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_NORMALIZATION_FAILED",
    message,
    error,
  );
}

function failDependencyPairFromSourceLockV2(
  error: unknown,
  message: string,
): never {
  if (
    error instanceof
    PlatformReleaseBuildToolchainMaterializationErrorV2
  ) {
    return failDependencyMaterializedPair(
      SOURCE_LOCK_ERROR_CODE_TO_DEPENDENCY_PAIR_V2[
        error.code
      ],
      message,
      error,
    );
  }
  return failDependencyMaterializedPair(
    "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_NORMALIZATION_FAILED",
    message,
    error,
  );
}

function failBuildToolchainCapsule(
  code:
    PlatformReleaseBuildToolchainCapsuleErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseBuildToolchainCapsuleErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactPlainObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
    || isProxy(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      `${label} must be one exact plain data object`,
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key !== "string"
      || !descriptor
      || !("value" in descriptor)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
        `${label} must contain only exact data properties`,
      );
    }
  }
  return value as Record<string, unknown>;
}

function normalizedAbsolute(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && Buffer.byteLength(value, "utf8") <= 4_096
    && path.isAbsolute(value)
    && path.normalize(value) === value
    && value !== path.parse(value).root;
}

function anchorRealDirectory(value: unknown): string {
  if (!normalizedAbsolute(value)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
      "Repository root must be one normalized absolute directory",
    );
  }
  try {
    const stat = lstatSync(value);
    const real = realpathSync(value);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || real !== value
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
        "Repository root must be one real directory",
      );
    }
    return real;
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
      "Repository root cannot be anchored",
      error,
    );
  }
}

function sameStat(left: Stats, right: Stats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function closeQuietly(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch {
    // Preserve the primary typed failure.
  }
}

function hashStableFile(
  absolutePath: string,
  maxBytes: number,
  code:
    | "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID"
    | "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
  linkPolicy: "single" | "any_positive" = "single",
): Readonly<{
  hash: string;
  byteLength: number;
  stat: Stats;
}> {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || (
        linkPolicy === "single"
          ? before.nlink !== 1
          : before.nlink < 1
      )
      || before.size < 1
      || before.size > maxBytes
    ) {
      return fail(
        code,
        "Exact file is outside its bounded single-link contract",
      );
    }
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let total = 0;
    while (true) {
      const count = readSync(
        descriptor,
        buffer,
        0,
        buffer.byteLength,
        null,
      );
      if (count === 0) break;
      total += count;
      if (total > maxBytes) {
        return fail(code, "Exact file exceeded its byte limit");
      }
      hash.update(buffer.subarray(0, count));
    }
    const after = fstatSync(descriptor);
    if (total !== before.size || !sameStat(before, after)) {
      return fail(code, "Exact file changed during descriptor read");
    }
    return Object.freeze({
      hash: hash.digest("hex"),
      byteLength: total,
      stat: before,
    });
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(code, "Exact no-follow file read failed", error);
  } finally {
    closeQuietly(descriptor);
  }
}

function anchorGitExecutableForTest(value: unknown): Readonly<{
  absolutePath: string;
  hash: string;
  byteLength: number;
}> {
  if (!normalizedAbsolute(value)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable must be one normalized absolute path",
    );
  }
  let real: string;
  try {
    real = realpathSync(value);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable cannot be resolved",
      error,
    );
  }
  if (real !== value) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable path must already be real",
    );
  }
  const observed = hashStableFile(
    real,
    1024 * 1024 * 1024,
    "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
    "any_positive",
  );
  if ((observed.stat.mode & 0o111) === 0) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test Git executable is not executable",
    );
  }
  return Object.freeze({
    absolutePath: real,
    hash: observed.hash,
    byteLength: observed.byteLength,
  });
}

function sealedGitEnvironment(): NodeJS.ProcessEnv {
  return {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
    HOME: "/var/empty",
    LANG: "C",
    LC_ALL: "C",
    PATH: "/usr/bin:/bin",
    TZ: "UTC",
  };
}

function runGit(
  executable: string,
  repositoryRoot: string,
  args: readonly string[],
  options: Readonly<{
    input?: Buffer;
    maxBuffer?: number;
  }> = {},
): Buffer {
  const result = spawnSync(
    executable,
    [
      "-C",
      repositoryRoot,
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      "-c",
      "core.hooksPath=/dev/null",
      ...args,
    ],
    {
      cwd: repositoryRoot,
      env: sealedGitEnvironment(),
      encoding: "buffer",
      input: options.input,
      maxBuffer: options.maxBuffer ?? GIT_LISTING_MAX_BYTES_V2,
      timeout: GIT_COMMAND_TIMEOUT_MS_V2,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const stdout = Buffer.from(result.stdout ?? Buffer.alloc(0));
  const stderr = Buffer.from(result.stderr ?? Buffer.alloc(0));
  if (
    result.error
    || result.status !== 0
    || result.signal !== null
    || stderr.byteLength !== 0
  ) {
    const detail = stderr
      .subarray(0, GIT_DIAGNOSTIC_MAX_BYTES_V2)
      .toString("utf8")
      .replaceAll(repositoryRoot, "<REPOSITORY>");
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_COMMAND_FAILED",
      `Exact Git command failed status=${String(result.status)} signal=${String(result.signal)} detail=${detail}`,
      result.error,
    );
  }
  return stdout;
}

function exactGitLine(
  bytes: Buffer,
  label: string,
  maximumBytes = 4_096,
): string {
  if (
    bytes.byteLength < 2
    || bytes.byteLength > maximumBytes
    || bytes[bytes.byteLength - 1] !== 0x0a
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} did not return one bounded newline-terminated value`,
    );
  }
  const content = bytes.subarray(0, -1);
  if (
    content.includes(0)
    || content.includes(0x0a)
    || content.includes(0x0d)
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} returned non-canonical text`,
    );
  }
  const value = content.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(content)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} returned invalid UTF-8`,
    );
  }
  return value;
}

function requireGitHash(value: string, label: string): string {
  if (!FULL_GIT_OBJECT_HASH_V2.test(value)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      `${label} is not one full lowercase Git object hash`,
    );
  }
  return value;
}

function classifyOrigin(
  originUrl: string,
  enforceCanonicalRepository: boolean,
): Readonly<{
  repositoryId:
    | typeof PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2
    | "test_fixture";
  originTransport: GitOriginTransportV2;
}> {
  if (originUrl === PLATFORM_RELEASE_SOURCE_HTTPS_ORIGIN_V2) {
    return Object.freeze({
      repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      originTransport: "github_https" as const,
    });
  }
  if (originUrl === PLATFORM_RELEASE_SOURCE_SSH_ORIGIN_V2) {
    return Object.freeze({
      repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      originTransport: "github_ssh" as const,
    });
  }
  if (enforceCanonicalRepository) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      "Production source origin is not the code-owned Setfarm repository",
    );
  }
  if (
    originUrl.length < 1
    || Buffer.byteLength(originUrl, "utf8") > 4_096
    || originUrl.includes("\0")
    || originUrl.includes("\n")
    || originUrl.includes("\r")
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      "Test source origin is not one bounded value",
    );
  }
  return Object.freeze({
    repositoryId: "test_fixture" as const,
    originTransport: "test_fixture_local" as const,
  });
}

function captureGitFence(
  gitExecutable: string,
  repositoryRoot: string,
  enforceCanonicalRepository: boolean,
): CapturedGitFenceV2 {
  const readLine = (args: readonly string[], label: string) =>
    exactGitLine(runGit(gitExecutable, repositoryRoot, args), label);
  const readIdentity = () => {
    const topLevel = readLine(
      ["rev-parse", "--show-toplevel"],
      "repository top level",
    );
    if (realpathSync(topLevel) !== repositoryRoot) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_REPOSITORY_INVALID",
        "Git top level differs from the anchored repository root",
      );
    }
    const branch = readLine(
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      "HEAD branch",
    );
    const headSha = requireGitHash(readLine(
      ["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"],
      "HEAD commit",
    ), "HEAD commit");
    const treeHash = requireGitHash(readLine(
      ["rev-parse", "--verify", "--end-of-options", "HEAD^{tree}"],
      "HEAD tree",
    ), "HEAD tree");
    const remoteSha = requireGitHash(readLine(
      [
        "rev-parse",
        "--verify",
        "--end-of-options",
        "refs/remotes/origin/main^{commit}",
      ],
      "origin main commit",
    ), "origin main commit");
    const remoteTreeHash = requireGitHash(readLine(
      [
        "rev-parse",
        "--verify",
        "--end-of-options",
        "refs/remotes/origin/main^{tree}",
      ],
      "origin main tree",
    ), "origin main tree");
    const originUrl = readLine(
      [
        "config",
        "--local",
        "--no-includes",
        "--get",
        "remote.origin.url",
      ],
      "origin URL",
    );
    return Object.freeze({
      branch,
      headSha,
      treeHash,
      remoteSha,
      remoteTreeHash,
      originUrl,
    });
  };

  const before = readIdentity();
  const status = runGit(
    gitExecutable,
    repositoryRoot,
    [
      "status",
      "--porcelain=v2",
      "-z",
      "--untracked-files=all",
      "--ignore-submodules=all",
    ],
    { maxBuffer: GIT_LISTING_MAX_BYTES_V2 },
  );
  const after = readIdentity();
  if (
    canonicalJsonStringify(before)
      !== canonicalJsonStringify(after)
    || before.branch !== "main"
    || before.headSha !== before.remoteSha
    || before.treeHash !== before.remoteTreeHash
    || before.headSha.length !== before.treeHash.length
    || status.byteLength !== 0
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_GIT_IDENTITY_INVALID",
      "Source admission requires one stable clean main exactly equal to origin/main",
    );
  }
  const origin = classifyOrigin(
    before.originUrl,
    enforceCanonicalRepository,
  );
  const remoteIdentity = {
    repositoryId: origin.repositoryId,
    originTransport: origin.originTransport,
    originUrlHash: sha256(before.originUrl),
    remoteRef: "refs/remotes/origin/main" as const,
    observedSha: before.remoteSha,
    observedTreeHash: before.remoteTreeHash,
  };
  const remote: RemoteObservationV2 = Object.freeze({
    ...remoteIdentity,
    observationHash: hashCanonicalJson({
      schema: "setfarm.remote-main-observation.v2",
      ...remoteIdentity,
    }),
  });
  const sourceIdentity = {
    headSha: before.headSha,
    treeHash: before.treeHash,
    indexTreeHash: before.treeHash,
  };
  const source: GitSourceFenceV2 = Object.freeze({
    ...sourceIdentity,
    identityHash: hashCanonicalJson({
      schema: "setfarm.git-source-fence-identity.v2",
      ...sourceIdentity,
    }),
  });
  const cleanIdentity: Omit<CleanWorktreeProofV2, "proofHash"> = {
    dirty: false as const,
    untrackedEntryCount: 0 as const,
    statusPorcelainContentHash:
      PLATFORM_RELEASE_EMPTY_GIT_STATUS_CONTENT_HASH_V2,
    headSha: before.headSha,
    treeHash: before.treeHash,
    indexTreeHash: before.treeHash,
  };
  const clean: CleanWorktreeProofV2 = Object.freeze({
    ...cleanIdentity,
    proofHash: hashCanonicalJson({
      schema: "setfarm.clean-worktree-proof.v2",
      ...cleanIdentity,
    }),
  });
  return Object.freeze({
    branch: "main" as const,
    originUrl: before.originUrl,
    remote,
    source,
    clean,
  });
}

function portableSourceLocator(locator: string): boolean {
  const segments = locator.split("/");
  return locator.length > 0
    && Buffer.byteLength(locator, "utf8") <= 1_024
    && PORTABLE_SOURCE_PATH_V2.test(locator)
    && segments.length <= 64
    && segments.every((segment) =>
      segment !== "."
      && segment !== ".."
      && segment.toLowerCase() !== ".git"
      && segment.toLowerCase() !== "node_modules"
      && Buffer.byteLength(segment, "utf8") <= 255);
}

function parseGitTreeListing(
  listing: Buffer,
  objectHashLength: number,
): readonly GitTreeFileV2[] {
  const files: GitTreeFileV2[] = [];
  const exactLocators = new Set<string>();
  const foldedLocators = new Set<string>();
  const directoryLocators = new Set<string>();
  const foldedDirectoryLocators = new Map<string, string>();
  let offset = 0;
  while (offset < listing.byteLength) {
    const end = listing.indexOf(0, offset);
    if (end < 0) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree listing is not NUL terminated",
      );
    }
    const record = listing.subarray(offset, end);
    offset = end + 1;
    const tab = record.indexOf(0x09);
    if (tab < 1) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree record has no exact locator separator",
      );
    }
    const prefix = record.subarray(0, tab).toString("ascii");
    const match = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})$/
      .exec(prefix);
    const locatorBytes = record.subarray(tab + 1);
    const locator = locatorBytes.toString("utf8");
    if (
      !match
      || match[2]!.length !== objectHashLength
      || !Buffer.from(locator, "utf8").equals(locatorBytes)
      || !portableSourceLocator(locator)
      || exactLocators.has(locator)
      || foldedLocators.has(locator.toLowerCase())
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree contains a non-blob, non-portable or colliding entry",
      );
    }
    const segments = locator.split("/");
    let parent = "";
    for (const segment of segments.slice(0, -1)) {
      parent = parent ? `${parent}/${segment}` : segment;
      const foldedParent = parent.toLowerCase();
      const existingFoldedDirectory =
        foldedDirectoryLocators.get(foldedParent);
      if (
        exactLocators.has(parent)
        || foldedLocators.has(foldedParent)
        || (
          existingFoldedDirectory !== undefined
          && existingFoldedDirectory !== parent
        )
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
          "Git tree contains a file, directory or case-fold topology collision",
        );
      }
      directoryLocators.add(parent);
      foldedDirectoryLocators.set(foldedParent, parent);
    }
    if (
      directoryLocators.has(locator)
      || foldedDirectoryLocators.has(locator.toLowerCase())
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git tree contains a directory and file case-fold collision",
      );
    }
    exactLocators.add(locator);
    foldedLocators.add(locator.toLowerCase());
    files.push(Object.freeze({
      locator,
      gitMode: match[1] as "100644" | "100755",
      blobHash: match[2]!,
    }));
    if (
      files.length > PLATFORM_RELEASE_SOURCE_MAX_FILES_V2
      || directoryLocators.size
        > PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        "Git source tree exceeds its file or directory limit",
      );
    }
  }
  if (files.length === 0) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
      "Git source tree must contain files",
    );
  }
  return Object.freeze(
    files.sort((left, right) =>
      left.locator < right.locator
        ? -1
        : left.locator > right.locator ? 1 : 0),
  );
}

function gitObjectHash(
  objectType: "blob" | "commit" | "tree",
  bytes: Uint8Array,
  objectHashLength: number,
): string {
  const algorithm = objectHashLength === 40
    ? "sha1"
    : objectHashLength === 64 ? "sha256" : null;
  if (!algorithm) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Git object format is unsupported",
    );
  }
  return createHash(algorithm)
    .update(`${objectType} ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}

function readGitObjects(
  gitExecutable: string,
  repositoryRoot: string,
  commitSha: string,
  files: readonly GitTreeFileV2[],
): ReadonlyMap<string, CapturedGitObjectV2> {
  const requests = [
    commitSha,
    ...new Set(files.map((entry) => entry.blobHash)),
  ];
  const output = runGit(
    gitExecutable,
    repositoryRoot,
    ["cat-file", "--batch"],
    {
      input: Buffer.from(`${requests.join("\n")}\n`, "ascii"),
      maxBuffer:
        PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2
        + SOURCE_FILE_MAX_BYTES_V2
        + GIT_LISTING_MAX_BYTES_V2,
    },
  );
  const objects = new Map<string, CapturedGitObjectV2>();
  let offset = 0;
  let totalBlobBytes = 0;
  for (const expectedHash of requests) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0 || headerEnd - offset > 256) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git batch object header is missing or oversized",
      );
    }
    const header = output.subarray(offset, headerEnd).toString("ascii");
    const match =
      /^([a-f0-9]{40}|[a-f0-9]{64}) (blob|commit) (0|[1-9][0-9]*)$/
        .exec(header);
    if (
      !match
      || match[1] !== expectedHash
      || match[1]!.length !== commitSha.length
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git batch object header differs from its exact request",
      );
    }
    const objectType = match[2] as "blob" | "commit";
    const byteLength = Number(match[3]);
    if (
      !Number.isSafeInteger(byteLength)
      || byteLength < (objectType === "commit" ? 1 : 0)
      || (objectType === "blob"
        && byteLength > SOURCE_FILE_MAX_BYTES_V2)
      || (objectType === "commit"
        && byteLength > SOURCE_FILE_MAX_BYTES_V2)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git object byte length is outside its exact bound",
      );
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + byteLength;
    if (
      contentEnd >= output.byteLength
      || output[contentEnd] !== 0x0a
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git batch object bytes are truncated or not delimited",
      );
    }
    const bytes = Buffer.from(
      output.subarray(contentStart, contentEnd),
    );
    if (
      gitObjectHash(objectType, bytes, commitSha.length)
        !== expectedHash
    ) {
      bytes.fill(0);
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Git object bytes do not reproduce their object ID",
      );
    }
    if (objectType === "blob") {
      totalBlobBytes += byteLength;
      if (
        totalBlobBytes
          > PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2
      ) {
        bytes.fill(0);
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
          "Git blob set exceeds its aggregate byte bound",
        );
      }
    }
    objects.set(expectedHash, Object.freeze({
      objectHash: expectedHash,
      objectType,
      bytes,
    }));
    offset = contentEnd + 1;
  }
  if (offset !== output.byteLength) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Git batch returned unrequested trailing bytes",
    );
  }
  return objects;
}

function parseCommitObject(
  commit: CapturedGitObjectV2,
  expectedTreeHash: string,
): Readonly<{
  treeHash: string;
  commitEpochSeconds: string;
}> {
  if (commit.objectType !== "commit") {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Admitted commit request did not return a commit object",
    );
  }
  const headerEnd = commit.bytes.indexOf(
    Buffer.from("\n\n", "ascii"),
  );
  if (headerEnd < 1 || headerEnd > SOURCE_FILE_MAX_BYTES_V2) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit object has no bounded header",
    );
  }
  const headerBytes = commit.bytes.subarray(0, headerEnd);
  const header = headerBytes.toString("utf8");
  if (
    !Buffer.from(header, "utf8").equals(headerBytes)
    || header.includes("\0")
    || header.includes("\r")
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit header is not canonical UTF-8",
    );
  }
  const lines = header.split("\n");
  const treeLines = lines.filter((line) => line.startsWith("tree "));
  const committerLines = lines.filter(
    (line) => line.startsWith("committer "),
  );
  if (treeLines.length !== 1 || committerLines.length !== 1) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit header lacks one exact tree or committer identity",
    );
  }
  const treeHash = treeLines[0]!.slice("tree ".length);
  const epochMatch = / (0|[1-9][0-9]{0,19}) [+-][0-9]{4}$/
    .exec(committerLines[0]!);
  if (
    treeHash !== expectedTreeHash
    || !FULL_GIT_OBJECT_HASH_V2.test(treeHash)
    || !epochMatch
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit bytes differ from the admitted tree or clock",
    );
  }
  const epoch = Number(epochMatch[1]);
  if (
    !Number.isSafeInteger(epoch)
    || !Number.isFinite(new Date(epoch * 1_000).valueOf())
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
      "Commit epoch is outside the deterministic build clock range",
    );
  }
  return Object.freeze({
    treeHash,
    commitEpochSeconds: epochMatch[1]!,
  });
}

type MutableTreeNodeV2 = {
  readonly directories: Map<string, MutableTreeNodeV2>;
  readonly files: Map<string, GitTreeFileV2>;
};

function reproduceRootTreeHash(
  files: readonly GitTreeFileV2[],
  objectHashLength: number,
): string {
  const root: MutableTreeNodeV2 = {
    directories: new Map(),
    files: new Map(),
  };
  for (const file of files) {
    const segments = file.locator.split("/");
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      let child = node.directories.get(segment);
      if (!child) {
        child = { directories: new Map(), files: new Map() };
        node.directories.set(segment, child);
      }
      node = child;
    }
    node.files.set(segments.at(-1)!, file);
  }

  const hashNode = (node: MutableTreeNodeV2): string => {
    const entries: Array<Readonly<{
      name: string;
      directory: boolean;
      mode: string;
      objectHash: string;
    }>> = [];
    for (const [name, child] of node.directories) {
      entries.push({
        name,
        directory: true,
        mode: "40000",
        objectHash: hashNode(child),
      });
    }
    for (const [name, file] of node.files) {
      entries.push({
        name,
        directory: false,
        mode: file.gitMode,
        objectHash: file.blobHash,
      });
    }
    entries.sort((left, right) => Buffer.compare(
      Buffer.from(`${left.name}${left.directory ? "/" : ""}`, "ascii"),
      Buffer.from(`${right.name}${right.directory ? "/" : ""}`, "ascii"),
    ));
    const chunks: Buffer[] = [];
    for (const entry of entries) {
      chunks.push(Buffer.from(
        `${entry.mode} ${entry.name}\0`,
        "ascii",
      ));
      chunks.push(Buffer.from(entry.objectHash, "hex"));
    }
    return gitObjectHash(
      "tree",
      Buffer.concat(chunks),
      objectHashLength,
    );
  };
  return hashNode(root);
}

function ensurePrivateStageParent(): string {
  const parent = realpathSync(tmpdir());
  const stat = lstatSync(parent);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(parent) !== parent
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Private temporary parent is not one real directory",
    );
  }
  return parent;
}

function writeAll(descriptor: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = writeSync(
      descriptor,
      bytes,
      offset,
      bytes.byteLength - offset,
      null,
    );
    if (written < 1) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Exclusive source write ended early",
      );
    }
    offset += written;
  }
}

function fsyncDirectory(absolutePath: string): void {
  const descriptor = openSync(
    absolutePath,
    constants.O_RDONLY
      | constants.O_DIRECTORY
      | constants.O_NOFOLLOW,
  );
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function materializeSourceStage(
  files: readonly GitTreeFileV2[],
  objects: ReadonlyMap<string, CapturedGitObjectV2>,
): Readonly<{
  contextRoot: string;
  contextAnchor: SourceOwnedPrivateDirectoryV2;
  stageRoot: string;
}> {
  const parent = ensurePrivateStageParent();
  let contextRoot: string | undefined;
  let contextAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  let stageRoot: string | undefined;
  try {
    contextRoot = mkdtempSync(
      path.join(parent, SOURCE_STAGE_PREFIX_V2),
    );
    contextAnchor =
      anchorSourceOwnedPrivateDirectoryV2(
        realpathSync(contextRoot),
        "Source context",
      );
    const context = lstatSync(contextRoot);
    if (
      context.isSymbolicLink()
      || !context.isDirectory()
      || (context.mode & 0o7777) !== 0o700
      || readdirSync(contextRoot).length !== 0
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source context was not one fresh private empty directory",
      );
    }
    stageRoot = path.join(contextRoot, "source");
    mkdirSync(stageRoot, { mode: 0o700 });
    stageRoot = realpathSync(stageRoot);
    if (readdirSync(stageRoot).length !== 0) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage was not initially empty",
      );
    }
    const directories = new Set<string>();
    for (const file of files) {
      const segments = file.locator.split("/");
      let current = "";
      for (const segment of segments.slice(0, -1)) {
        current = current ? `${current}/${segment}` : segment;
        directories.add(current);
      }
    }
    const orderedDirectories = [...directories].sort(
      (left, right) => {
        const depth = left.split("/").length
          - right.split("/").length;
        return depth !== 0
          ? depth
          : left < right ? -1 : left > right ? 1 : 0;
      },
    );
    for (const locator of orderedDirectories) {
      mkdirSync(path.join(stageRoot, locator), { mode: 0o700 });
    }
    for (const file of files) {
      const object = objects.get(file.blobHash);
      if (!object || object.objectType !== "blob") {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
          "Source file has no exact captured blob bytes",
        );
      }
      const absolutePath = path.join(stageRoot, file.locator);
      let descriptor: number | undefined;
      try {
        descriptor = openSync(
          absolutePath,
          constants.O_WRONLY
            | constants.O_CREAT
            | constants.O_EXCL
            | constants.O_NOFOLLOW,
          0o600,
        );
        writeAll(descriptor, object.bytes);
        fsyncSync(descriptor);
        fchmodSync(
          descriptor,
          file.gitMode === "100755" ? 0o555 : 0o444,
        );
        fsyncSync(descriptor);
      } finally {
        closeQuietly(descriptor);
      }
    }
    for (const locator of [...orderedDirectories].reverse()) {
      const absolutePath = path.join(stageRoot, locator);
      chmodSync(absolutePath, 0o555);
      fsyncDirectory(absolutePath);
    }
    chmodSync(stageRoot, 0o555);
    fsyncDirectory(stageRoot);
    fsyncDirectory(contextRoot);
    fsyncDirectory(parent);
    return Object.freeze({
      contextRoot,
      contextAnchor,
      stageRoot,
    });
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseSourceAdmissionErrorV2
      ? error
      : new PlatformReleaseSourceAdmissionErrorV2(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage materialization failed",
        { cause: error },
      );
    return throwAfterUnissuedSourceCleanupV2(
      contextRoot,
      contextAnchor,
      primary,
    );
  }
}

function stableStageFile(
  absolutePath: string,
  expected: Stats,
): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor);
    if (
      !before.isFile()
      || before.nlink !== 1
      || before.size < 0
      || before.size > SOURCE_FILE_MAX_BYTES_V2
      || !sameStat(before, expected)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage file changed before descriptor capture",
      );
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    if (
      bytes.byteLength !== before.size
      || !sameStat(before, after)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage file changed during descriptor capture",
      );
    }
    return bytes;
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) throw error;
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Source stage file could not be captured",
      error,
    );
  } finally {
    closeQuietly(descriptor);
  }
}

function captureSourceFingerprint(
  stageRoot: string,
  expectedOwner?: Readonly<{
    uid: number;
    gid: number;
  }>,
): SourceFingerprintV2 {
  const entries: SourceFingerprintEntryV2[] = [];
  let fileCount = 0;
  let directoryCount = 0;
  let totalBytes = 0;
  const initialRoot = lstatSync(stageRoot);
  const owner = expectedOwner ?? Object.freeze({
    uid: initialRoot.uid,
    gid: initialRoot.gid,
  });

  const visit = (absolute: string, relative: string): void => {
    const before = lstatSync(absolute);
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || (before.mode & 0o7777) !== 0o555
      || before.uid !== owner.uid
      || before.gid !== owner.gid
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage contains a noncanonical directory",
      );
    }
    const names = readdirSync(absolute).sort();
    for (const name of names) {
      const childRelative = relative
        ? `${relative}/${name}`
        : name;
      if (!portableSourceLocator(childRelative)) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a nonportable locator",
        );
      }
      const child = path.join(absolute, name);
      const stat = lstatSync(child);
      if (stat.isSymbolicLink()) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a symbolic link",
        );
      }
      if (stat.isDirectory()) {
        directoryCount += 1;
        if (
          directoryCount
            > PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2
        ) {
          return fail(
            "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
            "Source stage exceeds its directory bound",
          );
        }
        entries.push(Object.freeze({
          path: childRelative,
          type: "directory" as const,
          mode: "0555" as const,
        }));
        visit(child, childRelative);
        continue;
      }
      if (
        !stat.isFile()
        || stat.nlink !== 1
        || ![0o444, 0o555].includes(stat.mode & 0o7777)
        || stat.uid !== owner.uid
        || stat.gid !== owner.gid
        || stat.size < 0
        || stat.size > SOURCE_FILE_MAX_BYTES_V2
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a noncanonical file",
        );
      }
      const bytes = stableStageFile(child, stat);
      const after = lstatSync(child);
      if (!sameStat(stat, after)) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage file changed after descriptor capture",
        );
      }
      fileCount += 1;
      totalBytes += bytes.byteLength;
      if (
        fileCount > PLATFORM_RELEASE_SOURCE_MAX_FILES_V2
        || totalBytes > PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage exceeds its file or byte bound",
        );
      }
      entries.push(Object.freeze({
        path: childRelative,
        type: "file" as const,
        mode: (stat.mode & 0o7777) === 0o555
          ? "0555" as const
          : "0444" as const,
        byteLength: bytes.byteLength,
        contentHash: sha256(bytes),
      }));
    }
    const afterNames = readdirSync(absolute).sort();
    const after = lstatSync(absolute);
    if (
      canonicalJsonStringify(names)
        !== canonicalJsonStringify(afterNames)
      || !sameStat(before, after)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage directory changed during traversal",
      );
    }
  };

  visit(stageRoot, "");
  const fingerprintHash = sha256(canonicalJsonStringify({
    schema:
      "setfarm.platform-release-build-source-fingerprint.v2",
    entries,
    fileCount,
    directoryCount,
    totalBytes,
  }));
  return Object.freeze({
    entries: Object.freeze(entries),
    fileCount,
    directoryCount,
    totalBytes,
    fingerprintHash,
  });
}

function expectedSourceFingerprint(
  files: readonly GitTreeFileV2[],
  objects: ReadonlyMap<string, CapturedGitObjectV2>,
): SourceFingerprintV2 {
  const fileByLocator = new Map(
    files.map((file) => [file.locator, file] as const),
  );
  const directories = new Set<string>();
  const children = new Map<string, Set<string>>();
  const addChild = (parent: string, name: string) => {
    let names = children.get(parent);
    if (!names) {
      names = new Set();
      children.set(parent, names);
    }
    names.add(name);
  };
  for (const file of files) {
    const segments = file.locator.split("/");
    let parent = "";
    for (const segment of segments.slice(0, -1)) {
      const directory = parent
        ? `${parent}/${segment}`
        : segment;
      if (!directories.has(directory)) {
        directories.add(directory);
        addChild(parent, segment);
      }
      parent = directory;
    }
    addChild(parent, segments.at(-1)!);
  }

  const entries: SourceFingerprintEntryV2[] = [];
  let totalBytes = 0;
  const visit = (relative: string): void => {
    const names = [...(children.get(relative) ?? [])].sort();
    for (const name of names) {
      const locator = relative ? `${relative}/${name}` : name;
      if (directories.has(locator)) {
        entries.push(Object.freeze({
          path: locator,
          type: "directory" as const,
          mode: "0555" as const,
        }));
        visit(locator);
        continue;
      }
      const file = fileByLocator.get(locator);
      const object = file ? objects.get(file.blobHash) : undefined;
      if (!file || !object || object.objectType !== "blob") {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
          "Expected source fingerprint lacks exact blob bytes",
        );
      }
      totalBytes += object.bytes.byteLength;
      entries.push(Object.freeze({
        path: locator,
        type: "file" as const,
        mode: file.gitMode === "100755"
          ? "0555" as const
          : "0444" as const,
        byteLength: object.bytes.byteLength,
        contentHash: sha256(object.bytes),
      }));
    }
  };
  visit("");
  const identity = {
    schema:
      "setfarm.platform-release-build-source-fingerprint.v2",
    entries,
    fileCount: files.length,
    directoryCount: directories.size,
    totalBytes,
  };
  return Object.freeze({
    entries: Object.freeze(entries),
    fileCount: identity.fileCount,
    directoryCount: identity.directoryCount,
    totalBytes: identity.totalBytes,
    fingerprintHash: sha256(canonicalJsonStringify(identity)),
  });
}

function sourceStageIdentity(
  stageRoot: string,
  sourceBindingHash: string,
): PlatformReleaseSourceStagePhysicalIdentityV2 {
  const stat = lstatSync(stageRoot);
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(stageRoot) !== stageRoot
    || (stat.mode & 0o7777) !== 0o555
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Source stage root identity is invalid",
    );
  }
  const identity = {
    schema:
      PLATFORM_RELEASE_SOURCE_STAGE_PHYSICAL_IDENTITY_V2_SCHEMA,
    device: String(stat.dev),
    inode: String(stat.ino),
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    mode: "0555" as const,
    sourceBindingHash,
  };
  return Object.freeze({
    ...identity,
    identityHash:
      hashPlatformReleaseSourceStagePhysicalIdentityV2({
        ...identity,
        identityHash: sha256("placeholder"),
      }),
  });
}

function exactSourceRef(
  file: GitTreeFileV2,
  object: CapturedGitObjectV2,
  role:
    | "dependency_lock_manifest"
    | "package_manifest"
    | "typescript_compiler_config",
  locator: "package-lock.json" | "package.json" | "tsconfig.json",
) {
  if (
    file.locator !== locator
    || file.gitMode !== "100644"
    || object.objectType !== "blob"
    || object.bytes.byteLength < 1
    || object.bytes.byteLength > 16 * 1024 * 1024
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
      `Required source input ${locator} is absent or noncanonical`,
    );
  }
  const identity = {
    schema: EXACT_PLATFORM_RELEASE_SOURCE_REF_V2_SCHEMA,
    role,
    locator,
    mediaType: "application/json" as const,
    gitBlobHash: file.blobHash,
    contentHash: sha256(object.bytes),
    byteLength: object.bytes.byteLength,
    gitMode: "100644" as const,
    exportedMode: "0444" as const,
  };
  return Object.freeze({
    ...identity,
    sourceRefHash:
      hashExactPlatformReleaseSourceRefV2(identity),
  });
}

function deriveSourceBinding(
  files: readonly GitTreeFileV2[],
  objects: ReadonlyMap<string, CapturedGitObjectV2>,
  sourceTreeHash: string,
  fingerprint: SourceFingerprintV2,
): PlatformReleaseSourceTreeBindingV2 {
  const find = (locator: string) => {
    const file = files.find((entry) => entry.locator === locator);
    const object = file ? objects.get(file.blobHash) : undefined;
    if (!file || !object) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_TREE_INVALID",
        `Required source input ${locator} is missing`,
      );
    }
    return { file, object };
  };
  const lock = find("package-lock.json");
  const manifest = find("package.json");
  const config = find("tsconfig.json");
  const inputs = [
    exactSourceRef(
      lock.file,
      lock.object,
      "dependency_lock_manifest",
      "package-lock.json",
    ),
    exactSourceRef(
      manifest.file,
      manifest.object,
      "package_manifest",
      "package.json",
    ),
    exactSourceRef(
      config.file,
      config.object,
      "typescript_compiler_config",
      "tsconfig.json",
    ),
  ] as const;
  const inputMembershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-source-input-membership.v2",
    entries: inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  const identity = {
    schema: PLATFORM_RELEASE_SOURCE_TREE_BINDING_V2_SCHEMA,
    sourceTreeHash,
    exportedFileTreeHash: fingerprint.fingerprintHash,
    exportedFileCount: fingerprint.fileCount,
    exportedDirectoryCount: fingerprint.directoryCount,
    exportedTotalBytes: fingerprint.totalBytes,
    inputMembershipHash,
    inputs,
  };
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseSourceTreeBindingV2Schema.parse({
      ...identity,
      bindingHash:
        hashPlatformReleaseSourceTreeBindingV2(identity as never),
    }),
  );
}

function removeSourceOwnedPrivateRootV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
): void {
  if (sourceOwnedPathIsAbsentV2(anchor.absolutePath)) {
    return;
  }
  try {
    assertSourceOwnedPrivateDirectoryCurrentV2(
      anchor,
      label,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
    );
    makeSourceOwnedDirectoriesWritableV2(
      anchor.absolutePath,
    );
    rmSync(anchor.absolutePath, {
      recursive: true,
      force: false,
    });
    if (!sourceOwnedPathIsAbsentV2(anchor.absolutePath)) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
        `${label} remained after deletion`,
      );
    }
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) {
      throw error;
    }
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      `${label} could not be removed safely`,
      error,
    );
  }
}

function throwAfterUnissuedSourceCleanupV2(
  contextRoot: string | undefined,
  contextAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined,
  primaryFailure: PlatformReleaseSourceAdmissionErrorV2,
): never {
  if (!contextRoot) throw primaryFailure;
  let cleanupFailure: unknown;
  try {
    if (contextAnchor) {
      removeSourceOwnedPrivateRootV2(
        contextAnchor,
        "Unissued source context",
      );
    } else if (!sourceOwnedPathIsAbsentV2(contextRoot)) {
      cleanupFailure =
        new PlatformReleaseSourceAdmissionErrorV2(
          "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
          "Unanchored source context was preserved",
        );
    }
  } catch (error) {
    cleanupFailure = error;
  }
  if (cleanupFailure !== undefined) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      "Unissued source transaction could not remove its authentic context safely",
      new AggregateError([
        primaryFailure,
        cleanupFailure,
      ]),
    );
  }
  throw primaryFailure;
}

function sourceOwnedProcessOwnerV2(): Readonly<{
  uid: number;
  gid: number;
}> {
  if (
    typeof process.getuid !== "function"
    || typeof process.getgid !== "function"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Private release contexts require POSIX ownership evidence",
    );
  }
  return Object.freeze({
    uid: process.getuid(),
    gid: process.getgid(),
  });
}

function sourceOwnedDirectoryIdentityV2(
  stat: Stats,
): SourceOwnedPrivateDirectoryIdentityV2 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    ownerUid: stat.uid,
    ownerGid: stat.gid,
    mode: 0o700 as const,
  });
}

function sameSourceOwnedDirectoryIdentityV2(
  left: SourceOwnedPrivateDirectoryIdentityV2,
  right: SourceOwnedPrivateDirectoryIdentityV2,
): boolean {
  return left.device === right.device
    && left.inode === right.inode
    && left.ownerUid === right.ownerUid
    && left.ownerGid === right.ownerGid
    && left.mode === right.mode;
}

function anchorSourceOwnedPrivateDirectoryV2(
  absolutePath: string,
  label: string,
): SourceOwnedPrivateDirectoryV2 {
  if (!normalizedAbsolute(absolutePath)) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      `${label} must be one normalized absolute directory`,
    );
  }
  const owner = sourceOwnedProcessOwnerV2();
  try {
    const stat = lstatSync(absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(absolutePath) !== absolutePath
      || (stat.mode & 0o7777) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        `${label} lost its exact private directory identity`,
      );
    }
    return Object.freeze({
      absolutePath,
      identity: sourceOwnedDirectoryIdentityV2(stat),
    });
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) {
      throw error;
    }
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      `${label} could not be anchored`,
      error,
    );
  }
}

function assertSourceOwnedPrivateDirectoryCurrentV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
  errorCode:
    | "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID"
    | "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED" =
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
): void {
  const owner = sourceOwnedProcessOwnerV2();
  try {
    const stat = lstatSync(anchor.absolutePath);
    const current = sourceOwnedDirectoryIdentityV2(stat);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(anchor.absolutePath)
        !== anchor.absolutePath
      || (stat.mode & 0o7777) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || !sameSourceOwnedDirectoryIdentityV2(
        current,
        anchor.identity,
      )
    ) {
      return fail(
        errorCode,
        `${label} was replaced or changed`,
      );
    }
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) {
      throw error;
    }
    return fail(
      errorCode,
      `${label} could not be re-anchored`,
      error,
    );
  }
}

function createSourceOwnedOutputRootRegistryV2():
  SourceOwnedOutputRootRegistryV2 {
  return {
    cleanupState: "open",
    first: Object.freeze({ status: "empty" as const }),
    second: Object.freeze({ status: "empty" as const }),
  };
}

const SOURCE_CONTEXT_LIFECYCLE_TRANSITIONS_V2 = {
    source_admitted: [
      "toolchain_materializing",
      "disposed",
    ],
    toolchain_materializing: [
      "toolchain_materialized",
      "disposed",
    ],
    toolchain_materialized: [
      "toolchain_revalidating",
      "double_build_running",
      "disposed",
    ],
    toolchain_revalidating: [
      "toolchain_materialized",
      "disposed",
    ],
    double_build_running: [
      "double_build_complete",
      "disposed",
    ],
    double_build_complete: [
      "dependency_materializing",
      "disposed",
    ],
    dependency_materializing: [
      "release_completed",
      "disposed",
    ],
    release_completed: ["disposed"],
    disposed: [],
  } as const satisfies Readonly<
    Record<
      PlatformReleaseSourceContextLifecycleV2,
      readonly PlatformReleaseSourceContextLifecycleV2[]
    >
  >;

function transitionSourceContextLifecycleV2(
  state: SourceStageStateV2,
  expected: PlatformReleaseSourceContextLifecycleV2,
  next: PlatformReleaseSourceContextLifecycleV2,
): boolean {
  const allowed =
    SOURCE_CONTEXT_LIFECYCLE_TRANSITIONS_V2[
      expected
    ] as readonly PlatformReleaseSourceContextLifecycleV2[];
  if (
    !allowed.includes(next)
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      `Invalid source-context lifecycle transition ${expected} -> ${next}`,
    );
  }
  if (state.lifecycle !== expected) return false;
  state.lifecycle = next;
  return true;
}

function isMissingPathErrorV2(
  error: unknown,
): boolean {
  return error instanceof Error
    && "code" in error
    && error.code === "ENOENT";
}

function sourceOwnedPathIsAbsentV2(
  absolutePath: string,
): boolean {
  try {
    lstatSync(absolutePath);
    return false;
  } catch (error) {
    if (isMissingPathErrorV2(error)) return true;
    throw error;
  }
}

function makeSourceOwnedDirectoriesWritableV2(
  absolutePath: string,
): void {
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink() || !stat.isDirectory()) return;
  chmodSync(absolutePath, 0o700);
  for (const name of readdirSync(absolutePath)) {
    const child = path.join(absolutePath, name);
    const childStat = lstatSync(child);
    if (
      childStat.isDirectory()
      && !childStat.isSymbolicLink()
    ) {
      makeSourceOwnedDirectoriesWritableV2(child);
    }
  }
}

function removeSourceOwnedOutputSlotV2(
  slot: SourceOwnedOutputRootSlotV2,
  label: string,
): void {
  if (slot.status === "empty") return;
  if (slot.status === "parent_created") {
    if (
      sourceOwnedPathIsAbsentV2(slot.privateParentPath)
    ) return;
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      `${label} unanchored private parent was preserved`,
    );
  }
  const parent = slot.privateParent;
  if (sourceOwnedPathIsAbsentV2(parent.absolutePath)) {
    return;
  }
  assertSourceOwnedPrivateDirectoryCurrentV2(
    parent,
    `${label} private parent`,
    "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
  );
  const names = readdirSync(parent.absolutePath).sort();
  if (
    slot.status === "output_created"
    && canonicalJsonStringify(names)
      === canonicalJsonStringify(["output"])
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      `${label} unanchored output child was preserved`,
    );
  }
  const expectedNames =
    slot.status === "parent_anchored"
      || slot.status === "output_created"
      ? []
      : ["output"];
  if (
    canonicalJsonStringify(names)
      !== canonicalJsonStringify(expectedNames)
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      `${label} private parent membership changed`,
    );
  }
  if (slot.status === "output_anchored") {
    assertSourceOwnedPrivateDirectoryCurrentV2(
      slot.outputRoot,
      `${label} output root`,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
    );
  }
  try {
    makeSourceOwnedDirectoriesWritableV2(
      parent.absolutePath,
    );
    rmSync(parent.absolutePath, {
      recursive: true,
      force: false,
    });
    if (!sourceOwnedPathIsAbsentV2(parent.absolutePath)) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
        `${label} private parent remained after deletion`,
      );
    }
  } catch (error) {
    if (error instanceof PlatformReleaseSourceAdmissionErrorV2) {
      throw error;
    }
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      `${label} private parent could not be removed safely`,
      error,
    );
  }
}

function removeSourceOwnedContextV2(
  state: SourceStageStateV2,
): void {
  removeSourceOwnedPrivateRootV2(
    state.contextAnchor,
    "Source-owned context",
  );
}

function disposeSourceOwnedPhysicalContextV2(
  state: SourceStageStateV2,
): void {
  if (state.lifecycle !== "disposed") {
    if (
      !transitionSourceContextLifecycleV2(
        state,
        state.lifecycle,
        "disposed",
      )
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
        "Source context could not enter terminal disposal",
      );
    }
  }
  if (state.ownedOutputRoots.cleanupState !== "open") {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      "Source-owned roots already entered cleanup",
    );
  }
  state.ownedOutputRoots.cleanupState = "cleaning";
  const errors: unknown[] = [];
  for (
    const [slot, label] of [
      [state.ownedOutputRoots.second, "Second compiled output"],
      [state.ownedOutputRoots.first, "First compiled output"],
    ] as const
  ) {
    try {
      removeSourceOwnedOutputSlotV2(slot, label);
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    removeSourceOwnedContextV2(state);
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0) {
    state.ownedOutputRoots.cleanupState =
      "cleanup_failed";
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
      "One or more source-owned physical roots could not be removed safely",
      new AggregateError(errors),
    );
  }
  state.ownedOutputRoots.cleanupState = "cleaned";
}

function sourceOwnedRootsAreDisjointV2(
  left: SourceOwnedPrivateDirectoryV2,
  right: SourceOwnedPrivateDirectoryV2,
): boolean {
  const leftPrefix = `${left.absolutePath}${path.sep}`;
  const rightPrefix = `${right.absolutePath}${path.sep}`;
  return left.absolutePath !== right.absolutePath
    && !left.absolutePath.startsWith(rightPrefix)
    && !right.absolutePath.startsWith(leftPrefix)
    && (
      left.identity.device !== right.identity.device
      || left.identity.inode !== right.identity.inode
    );
}

function allocateSourceOwnedOutputRootV2(
  state: SourceStageStateV2,
  occurrence: "first" | "second",
  fault?: SourceOwnedOutputAllocationFaultV2,
): Extract<
  SourceOwnedOutputRootSlotV2,
  { status: "output_anchored" }
> {
  if (
    state.lifecycle !== "double_build_running"
    || state.ownedOutputRoots.cleanupState !== "open"
    || state.ownedOutputRoots[occurrence].status
      !== "empty"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY",
      `${occurrence} compiled output cannot be allocated in the current lifecycle`,
    );
  }
  const parent = ensurePrivateStageParent();
  const prefix = occurrence === "first"
    ? COMPILED_OUTPUT_FIRST_PREFIX_V2
    : COMPILED_OUTPUT_SECOND_PREFIX_V2;
  const privateParentPath =
    mkdtempSync(path.join(parent, prefix));
  state.ownedOutputRoots[occurrence] =
    Object.freeze({
      status: "parent_created" as const,
      privateParentPath,
    });
  if (
    occurrence === "first"
    && fault?.checkpoint
      === "after_first_parent_created"
  ) {
    fault.observePath(privateParentPath);
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Injected test fault after first output parent creation",
    );
  }
  const privateParent =
    anchorSourceOwnedPrivateDirectoryV2(
      realpathSync(privateParentPath),
      `${occurrence} compiled-output parent`,
    );
  state.ownedOutputRoots[occurrence] =
    Object.freeze({
      status: "parent_anchored" as const,
      privateParent,
    });
  fsyncDirectory(parent);
  const outputPath = path.join(
    privateParent.absolutePath,
    "output",
  );
  mkdirSync(outputPath, { mode: 0o700 });
  state.ownedOutputRoots[occurrence] =
    Object.freeze({
      status: "output_created" as const,
      privateParent,
      outputPath,
    });
  if (
    occurrence === "first"
    && fault?.checkpoint
      === "after_first_output_created"
  ) {
    fault.observePath(outputPath);
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Injected test fault after first output child creation",
    );
  }
  const outputRoot =
    anchorSourceOwnedPrivateDirectoryV2(
      realpathSync(outputPath),
      `${occurrence} compiled-output root`,
    );
  const slot = Object.freeze({
    status: "output_anchored" as const,
    privateParent,
    outputRoot,
  });
  state.ownedOutputRoots[occurrence] = slot;
  fsyncDirectory(privateParent.absolutePath);
  const anchors = [
    state.contextAnchor,
    ...(["first", "second"] as const)
      .filter((name) => name !== occurrence)
      .flatMap((name) => {
        const slot = state.ownedOutputRoots[name];
        return slot.status === "empty"
          ? []
          : slot.status === "parent_created"
            ? []
            : slot.status === "parent_anchored"
              || slot.status === "output_created"
            ? [slot.privateParent]
            : [
              slot.privateParent,
              slot.outputRoot,
            ];
      }),
  ];
  if (
    canonicalJsonStringify(
      readdirSync(privateParent.absolutePath).sort(),
    ) !== canonicalJsonStringify(["output"])
    || !sourceOwnedRootsAreDisjointV2(
      privateParent,
      state.contextAnchor,
    )
    || anchors.some((anchor) =>
      !sourceOwnedRootsAreDisjointV2(
        privateParent,
        anchor,
      )
      || !sourceOwnedRootsAreDisjointV2(
        outputRoot,
        anchor,
      ))
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      `${occurrence} compiled output is not one independent private occurrence`,
    );
  }
  return slot;
}

function requireSourceOwnedOutputRootV2(
  state: SourceStageStateV2,
  occurrence: "first" | "second",
): Extract<
  SourceOwnedOutputRootSlotV2,
  { status: "output_anchored" }
> {
  const slot = state.ownedOutputRoots[occurrence];
  if (slot.status !== "output_anchored") {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      `${occurrence} compiled output is not fully anchored`,
    );
  }
  assertSourceOwnedPrivateDirectoryCurrentV2(
    slot.privateParent,
    `${occurrence} compiled-output parent`,
  );
  assertSourceOwnedPrivateDirectoryCurrentV2(
    slot.outputRoot,
    `${occurrence} compiled-output root`,
  );
  if (
    canonicalJsonStringify(
      readdirSync(slot.privateParent.absolutePath).sort(),
    ) !== canonicalJsonStringify(["output"])
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      `${occurrence} compiled-output parent membership changed`,
    );
  }
  return slot;
}

function zeroObjectBytes(
  objects: ReadonlyMap<string, CapturedGitObjectV2> | undefined,
): void {
  if (!objects) return;
  for (const object of objects.values()) object.bytes.fill(0);
}

function runSourceExport(
  repositoryRootInput: unknown,
  gitExecutableInput: unknown,
  options: Readonly<{
    enforceCanonicalRepository: boolean;
    afterInitialFenceForTest?: () => void;
    afterFirstStageCaptureForTest?: (stageRoot: string) => void;
  }>,
): Readonly<{
  contextRoot: string;
  contextAnchor: SourceOwnedPrivateDirectoryV2;
  stageRoot: string;
  core: SourceExportCoreV2;
}> {
  const repositoryRoot = anchorRealDirectory(repositoryRootInput);
  const git = anchorGitExecutableForTest(gitExecutableInput);
  let contextRoot: string | undefined;
  let contextAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  let stageRoot: string | undefined;
  let objects: ReadonlyMap<string, CapturedGitObjectV2> | undefined;
  try {
    const before = captureGitFence(
      git.absolutePath,
      repositoryRoot,
      options.enforceCanonicalRepository,
    );
    options.afterInitialFenceForTest?.();
    const listing = runGit(
      git.absolutePath,
      repositoryRoot,
      [
        "ls-tree",
        "-rz",
        "--full-tree",
        "-r",
        before.source.headSha,
      ],
      { maxBuffer: GIT_LISTING_MAX_BYTES_V2 },
    );
    const files = parseGitTreeListing(
      listing,
      before.source.headSha.length,
    );
    objects = readGitObjects(
      git.absolutePath,
      repositoryRoot,
      before.source.headSha,
      files,
    );
    const commit = parseCommitObject(
      objects.get(before.source.headSha)!,
      before.source.treeHash,
    );
    if (
      reproduceRootTreeHash(files, before.source.headSha.length)
        !== before.source.treeHash
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_OBJECT_BYTES_INVALID",
        "Recursive Git tree bytes do not reproduce HEAD tree",
      );
    }
    const materialized = materializeSourceStage(files, objects);
    contextRoot = materialized.contextRoot;
    contextAnchor = materialized.contextAnchor;
    stageRoot = materialized.stageRoot;
    const expectedFingerprint =
      expectedSourceFingerprint(files, objects);
    const fingerprintBefore =
      captureSourceFingerprint(stageRoot);
    if (
      canonicalJsonStringify(expectedFingerprint)
        !== canonicalJsonStringify(fingerprintBefore)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Materialized source stage differs from verified Git object bytes",
      );
    }
    const source = deriveSourceBinding(
      files,
      objects,
      before.source.treeHash,
      fingerprintBefore,
    );
    const stageBefore = sourceStageIdentity(
      stageRoot,
      source.bindingHash,
    );
    options.afterFirstStageCaptureForTest?.(stageRoot);
    const after = captureGitFence(
      git.absolutePath,
      repositoryRoot,
      options.enforceCanonicalRepository,
    );
    const fingerprintAfter =
      captureSourceFingerprint(stageRoot);
    const stageAfter = sourceStageIdentity(
      stageRoot,
      source.bindingHash,
    );
    const gitAfter = anchorGitExecutableForTest(git.absolutePath);
    if (
      canonicalJsonStringify(before)
        !== canonicalJsonStringify(after)
      || canonicalJsonStringify(fingerprintBefore)
        !== canonicalJsonStringify(fingerprintAfter)
      || canonicalJsonStringify(expectedFingerprint)
        !== canonicalJsonStringify(fingerprintAfter)
      || stageBefore.identityHash !== stageAfter.identityHash
      || source.exportedFileTreeHash
        !== fingerprintAfter.fingerprintHash
      || source.exportedFileCount !== fingerprintAfter.fileCount
      || source.exportedDirectoryCount
        !== fingerprintAfter.directoryCount
      || source.exportedTotalBytes !== fingerprintAfter.totalBytes
      || gitAfter.hash !== git.hash
      || gitAfter.byteLength !== git.byteLength
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
        "Repository, Git executable or exported source changed across admission",
      );
    }
    const core: SourceExportCoreV2 = deepFreezePlatformReleaseJsonV2({
      admittedSource: {
        sha: before.source.headSha,
        treeHash: commit.treeHash,
        commitEpochSeconds: commit.commitEpochSeconds,
      },
      remoteBefore: before.remote,
      remoteAfter: after.remote,
      sourceBefore: before.source,
      sourceAfter: after.source,
      cleanWorktreeBefore: before.clean,
      cleanWorktreeAfter: after.clean,
      source,
      stageBefore,
      stageAfter,
      gitExecutableHash: git.hash,
      gitExecutableByteLength: git.byteLength,
    });
    return Object.freeze({
      contextRoot,
      contextAnchor,
      stageRoot,
      core,
    });
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseSourceAdmissionErrorV2
      ? error
      : new PlatformReleaseSourceAdmissionErrorV2(
        "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
        "Source export failed before a stable candidate was issued",
        { cause: error },
      );
    return throwAfterUnissuedSourceCleanupV2(
      contextRoot,
      contextAnchor,
      primary,
    );
  } finally {
    zeroObjectBytes(objects);
  }
}

function parseHostFileCandidate(
  input: unknown,
  label: string,
): ExactHostOwnedFileRefV2 {
  try {
    const snapshot = boundedPlatformReleaseJsonSnapshotV2(
      input,
      SOURCE_ADMISSION_INPUT_MAX_BYTES_V2,
    );
    return deepFreezePlatformReleaseJsonV2(
      ExactHostOwnedFileRefV2Schema.parse(snapshot),
    );
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      `${label} host admission candidate is invalid`,
      error,
    );
  }
}

function verifyHostFileProjection(
  candidate: ExactHostOwnedFileRefV2,
  label: string,
): void {
  const observed = hashStableFile(
    candidate.absoluteRealpathLocator,
    1024 * 1024 * 1024,
    "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
  );
  let real: string;
  try {
    real = realpathSync(candidate.absoluteRealpathLocator);
  } catch (error) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      `${label} realpath could not be observed`,
      error,
    );
  }
  if (
    real !== candidate.absoluteRealpathLocator
    || observed.hash !== candidate.hash
    || observed.byteLength !== candidate.byteLength
    || observed.stat.uid !== candidate.ownerUid
    || observed.stat.gid !== candidate.ownerGid
    || (observed.stat.mode & 0o7777)
      !== Number.parseInt(candidate.mode, 8)
    || candidate.hostAdmissionReceipt.physicalBefore.device
      !== String(observed.stat.dev)
    || candidate.hostAdmissionReceipt.physicalAfter.device
      !== String(observed.stat.dev)
    || candidate.hostAdmissionReceipt.physicalBefore.inode
      !== String(observed.stat.ino)
    || candidate.hostAdmissionReceipt.physicalAfter.inode
      !== String(observed.stat.ino)
    || candidate.hostAdmissionReceipt.physicalBefore.linkCount
      !== observed.stat.nlink
    || candidate.hostAdmissionReceipt.physicalAfter.linkCount
      !== observed.stat.nlink
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      `${label} bytes or physical projection differ from host admission`,
    );
  }
}

function authenticState(
  handle: AdmittedPlatformReleaseSourceStageV2,
): SourceStageStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== AdmittedPlatformReleaseSourceStageV2.prototype
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
      "Source stage operation requires one authentic handle",
    );
  }
  const state = sourceStageStatesV2.get(handle);
  if (!state) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HANDLE_UNAUTHENTICATED",
      "Source stage operation requires one authentic handle",
    );
  }
  if (state.lifecycle === "disposed") {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HANDLE_DISPOSED",
      "Source stage handle has already been disposed",
    );
  }
  return state;
}

function issueHandle(
  initial: InitialSourceStageStateV2,
) {
  if (
    initial.contextAnchor.absolutePath
      !== initial.contextRoot
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
      "Source context locator differs from its acquisition anchor",
    );
  }
  assertSourceOwnedPrivateDirectoryCurrentV2(
    initial.contextAnchor,
    "Source-owned context",
  );
  const state: SourceStageStateV2 = {
    ...initial,
    ownedOutputRoots:
      createSourceOwnedOutputRootRegistryV2(),
  };
  return new AdmittedPlatformReleaseSourceStageV2(
    sourceStageConstructorCapabilityV2,
    state,
  );
}

export function admitPlatformReleaseSourceV2(
  input: AdmitPlatformReleaseSourceV2Input,
): AdmittedPlatformReleaseSourceStageV2 {
  const candidate = exactPlainObject(input, "Source admission input");
  const allowed = ["gitTool", "implementation", "repositoryRoot"];
  if (
    Object.keys(candidate).sort().join("\0")
      !== allowed.join("\0")
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Production source admission input has unknown or missing fields",
    );
  }
  const implementation = parseHostFileCandidate(
    candidate.implementation,
    "Source admission implementation",
  );
  const gitTool = parseHostFileCandidate(
    candidate.gitTool,
    "Source Git tool",
  );
  const implementationRealpath = realpathSync(
    fileURLToPath(import.meta.url),
  );
  if (
    implementation.absoluteRealpathLocator
      !== implementationRealpath
    || gitTool.mode !== "0555"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
      "Production admission must execute the exact host-admitted implementation and Git tool",
    );
  }
  verifyHostFileProjection(implementation, "Source implementation");
  verifyHostFileProjection(gitTool, "Source Git tool");
  const exported = runSourceExport(
    candidate.repositoryRoot,
    gitTool.absoluteRealpathLocator,
    { enforceCanonicalRepository: true },
  );
  try {
    verifyHostFileProjection(implementation, "Source implementation");
    verifyHostFileProjection(gitTool, "Source Git tool");
    const receiptIdentity = {
      schema: SOURCE_ADMISSION_RECEIPT_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState: "candidate_observation_unverified" as const,
      productionUse:
        "forbidden_until_fresh_root_owned_source_verification" as const,
      repositoryId: PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
      remoteRef: "refs/remotes/origin/main" as const,
      policy: "exact_remote_main_sha" as const,
      branch: "main" as const,
      admissionContractHash:
        PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
      remoteBefore: exported.core.remoteBefore,
      remoteAfter: exported.core.remoteAfter,
      admittedSource: exported.core.admittedSource,
      cleanWorktreeBefore: exported.core.cleanWorktreeBefore,
      cleanWorktreeAfter: exported.core.cleanWorktreeAfter,
      sourceBefore: exported.core.sourceBefore,
      sourceAfter: exported.core.sourceAfter,
      exportedSource: {
        method: "verified_git_tree_export.v2" as const,
        buildContextPolicy:
          "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
        source: exported.core.source,
        initialStageWasEmpty: true as const,
        stageBefore: exported.core.stageBefore,
        stageAfter: exported.core.stageAfter,
        temporaryLocatorDisclosure: "forbidden" as const,
      },
      gitTool: {
        executable: gitTool,
        requiredAbi:
          "GIT_OBJECT_DATABASE_SOURCE_EXPORT_V2" as const,
        commandContractHash:
          PLATFORM_RELEASE_SOURCE_GIT_COMMAND_CONTRACT_HASH_V2,
      },
      implementation: {
        ownership:
          "root_owned_separately_installed" as const,
        module: implementation,
        requiredExport:
          "admitPlatformReleaseSourceV2" as const,
      },
    };
    const receipt = deepFreezePlatformReleaseJsonV2(
      SourceAdmissionReceiptV2Schema.parse({
        ...receiptIdentity,
        receiptHash:
          hashSourceAdmissionReceiptV2(receiptIdentity as never),
      }),
    );
    return issueHandle({
      admissionScope: "production_candidate",
      contextRoot: exported.contextRoot,
      contextAnchor: exported.contextAnchor,
      stageRoot: exported.stageRoot,
      core: exported.core,
      receipt,
      testEvidence: null,
      lifecycle: "source_admitted",
    });
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseSourceAdmissionErrorV2
      ? error
      : new PlatformReleaseSourceAdmissionErrorV2(
        "PLATFORM_RELEASE_SOURCE_V2_HOST_AUTHORITY_INVALID",
        "Production source receipt could not be issued",
        { cause: error },
      );
    return throwAfterUnissuedSourceCleanupV2(
      exported.contextRoot,
      exported.contextAnchor,
      primary,
    );
  }
}

export function admitPlatformReleaseSourceV2ForTest(
  input: AdmitPlatformReleaseSourceV2ForTestInput,
): AdmittedPlatformReleaseSourceStageV2 {
  const candidate = exactPlainObject(
    input,
    "Test source admission input",
  );
  const allowed = [
    "afterFirstStageCaptureForTest",
    "afterInitialFenceForTest",
    "gitExecutable",
    "repositoryRoot",
  ];
  if (
    Object.keys(candidate).some((key) => !allowed.includes(key))
    || typeof candidate.repositoryRoot !== "string"
    || (
      candidate.gitExecutable !== undefined
      && typeof candidate.gitExecutable !== "string"
    )
    || (
      candidate.afterInitialFenceForTest !== undefined
      && typeof candidate.afterInitialFenceForTest !== "function"
    )
    || (
      candidate.afterFirstStageCaptureForTest !== undefined
      && typeof candidate.afterFirstStageCaptureForTest !== "function"
    )
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_INPUT_INVALID",
      "Test source admission input is invalid",
    );
  }
  const exported = runSourceExport(
    candidate.repositoryRoot,
    candidate.gitExecutable ?? "/usr/bin/git",
    {
      enforceCanonicalRepository: false,
      afterInitialFenceForTest:
        candidate.afterInitialFenceForTest as
          (() => void) | undefined,
      afterFirstStageCaptureForTest:
        candidate.afterFirstStageCaptureForTest as
          ((stageRoot: string) => void) | undefined,
    },
  );
  try {
    const testEvidence: PlatformReleaseSourceAdmissionTestEvidenceV2 =
      deepFreezePlatformReleaseJsonV2({
      schema:
        "setfarm.platform-release-source-admission-test-evidence.v2",
      authorityState:
        "test_fixture_source_admission_only",
      productionUse: "forbidden",
      repositoryId: "test_fixture",
      admittedSource: exported.core.admittedSource,
      remoteBefore: exported.core.remoteBefore,
      remoteAfter: exported.core.remoteAfter,
      sourceBefore: exported.core.sourceBefore,
      sourceAfter: exported.core.sourceAfter,
      cleanWorktreeBefore: exported.core.cleanWorktreeBefore,
      cleanWorktreeAfter: exported.core.cleanWorktreeAfter,
      exportedSource: {
        method: "verified_git_tree_export.v2",
        buildContextPolicy:
          "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
        source: exported.core.source,
        initialStageWasEmpty: true,
        stageBefore: exported.core.stageBefore,
        stageAfter: exported.core.stageAfter,
        temporaryLocatorDisclosure: "forbidden",
      },
      gitExecutable: {
        hash: exported.core.gitExecutableHash,
        byteLength: exported.core.gitExecutableByteLength,
        authority: "test_fixture_process_tool",
      },
      });
    return issueHandle({
      admissionScope: "test_fixture",
      contextRoot: exported.contextRoot,
      contextAnchor: exported.contextAnchor,
      stageRoot: exported.stageRoot,
      core: exported.core,
      receipt: null,
      testEvidence,
      lifecycle: "source_admitted",
    });
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseSourceAdmissionErrorV2
      ? error
      : new PlatformReleaseSourceAdmissionErrorV2(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Test source evidence could not be issued",
        { cause: error },
      );
    return throwAfterUnissuedSourceCleanupV2(
      exported.contextRoot,
      exported.contextAnchor,
      primary,
    );
  }
}

export function inspectPlatformReleaseSourceAdmissionCandidateV2(
  handle: AdmittedPlatformReleaseSourceStageV2,
): PlatformReleaseSourceAdmissionCandidateSnapshotV2 {
  const state = authenticState(handle);
  const snapshot = state.admissionScope === "production_candidate"
    ? {
      admissionScope: "production_candidate" as const,
      receipt: structuredClone(state.receipt!),
      testEvidence: null,
    }
    : {
      admissionScope: "test_fixture" as const,
      receipt: null,
      testEvidence: structuredClone(state.testEvidence!),
    };
  return deepFreezePlatformReleaseJsonV2(snapshot);
}

function authenticBuildToolchainCapsuleState(
  handle: PlatformReleaseBuildToolchainCapsuleV2,
): BuildToolchainCapsuleStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PlatformReleaseBuildToolchainCapsuleV2.prototype
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED",
      "Build toolchain capsule operation requires one authentic handle",
    );
  }
  const state = buildToolchainCapsuleStatesV2.get(handle);
  if (!state) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HANDLE_UNAUTHENTICATED",
      "Build toolchain capsule operation requires one authentic handle",
    );
  }
  return state;
}

function stableSourceStageState(
  state: SourceStageStateV2,
): SourceFingerprintV2 {
  const fingerprint =
    captureSourceFingerprint(state.stageRoot, {
      uid: state.core.stageAfter.ownerUid,
      gid: state.core.stageAfter.ownerGid,
    });
  const physical = sourceStageIdentity(
    state.stageRoot,
    state.core.source.bindingHash,
  );
  if (
    fingerprint.fingerprintHash
      !== state.core.source.exportedFileTreeHash
    || fingerprint.fileCount
      !== state.core.source.exportedFileCount
    || fingerprint.directoryCount
      !== state.core.source.exportedDirectoryCount
    || fingerprint.totalBytes
      !== state.core.source.exportedTotalBytes
    || physical.identityHash
      !== state.core.stageAfter.identityHash
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Admitted source stage changed before build-toolchain use",
    );
  }
  return fingerprint;
}

function processOwnerForBuildToolchain(): Readonly<{
  uid: number;
  gid: number;
}> {
  if (
    typeof process.getuid !== "function"
    || typeof process.getgid !== "function"
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
      "Build toolchain capsule requires POSIX ownership evidence",
    );
  }
  return Object.freeze({
    uid: process.getuid(),
    gid: process.getgid(),
  });
}

function exactBuildContext(
  state: SourceStageStateV2,
  phase: "source_only" | "materialized",
): void {
  const owner = processOwnerForBuildToolchain();
  try {
    const context = lstatSync(state.contextRoot);
    const expected = phase === "source_only"
      ? ["source"]
      : ["node_modules", "source"];
    const names = readdirSync(state.contextRoot).sort();
    if (
      context.isSymbolicLink()
      || !context.isDirectory()
      || realpathSync(state.contextRoot) !== state.contextRoot
      || (context.mode & 0o7777) !== 0o700
      || context.uid !== owner.uid
      || context.gid !== owner.gid
      || canonicalJsonStringify(names)
        !== canonicalJsonStringify(expected)
      || path.dirname(state.stageRoot) !== state.contextRoot
      || path.basename(state.stageRoot) !== "source"
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
        "Private build context does not have its exact source/toolchain topology",
      );
    }
    if (phase === "materialized") {
      const nodeModulesRoot =
        path.join(state.contextRoot, "node_modules");
      const toolchain = lstatSync(nodeModulesRoot);
      if (
        toolchain.isSymbolicLink()
        || !toolchain.isDirectory()
        || realpathSync(nodeModulesRoot) !== nodeModulesRoot
        || (toolchain.mode & 0o7777) !== 0o555
        || toolchain.uid !== owner.uid
        || toolchain.gid !== owner.gid
      ) {
        return failBuildToolchainCapsule(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
          "Authenticated node_modules sibling lost its exact physical root",
        );
      }
    }
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
    ) throw error;
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
      "Private build context could not be authenticated",
      error,
    );
  }
}

type PrivateBuildToolchainInstallScopeV2 = Readonly<{
  environmentRoot: string;
  environmentAnchor: SourceOwnedPrivateDirectoryV2;
  installRoot: string;
  installAnchor: SourceOwnedPrivateDirectoryV2;
  projectRoot: string;
  cleanup: {
    state:
      | "open"
      | "cleaning"
      | "cleaned"
      | "cleanup_failed";
  };
  environment: Readonly<{
    CI: "true";
    HOME: string;
    LANG: "C.UTF-8";
    LC_ALL: "C.UTF-8";
    NODE_DISABLE_COMPILE_CACHE: "1";
    NO_COLOR: "1";
    NPM_CONFIG_CACHE: string;
    NPM_CONFIG_ENGINE_STRICT: "true";
    NPM_CONFIG_GLOBALCONFIG: string;
    NPM_CONFIG_LOGS_MAX: "0";
    NPM_CONFIG_REGISTRY: "https://registry.npmjs.org";
    NPM_CONFIG_USERCONFIG: string;
    TEMP: string;
    TMP: string;
    TMPDIR: string;
    TZ: "UTC";
  }>;
}>;

function copyAdmittedBuildInputs(
  state: SourceStageStateV2,
  projectRoot: string,
): void {
  for (const sourceRef of state.core.source.inputs) {
    const sourcePath =
      path.join(state.stageRoot, sourceRef.locator);
    const destinationPath =
      path.join(projectRoot, sourceRef.locator);
    let destinationDescriptor: number | undefined;
    let bytes: Buffer | undefined;
    try {
      const sourceStat = lstatSync(sourcePath);
      if (
        sourceStat.isSymbolicLink()
        || !sourceStat.isFile()
        || sourceStat.nlink !== 1
        || (sourceStat.mode & 0o7777) !== 0o444
        || sourceStat.size !== sourceRef.byteLength
      ) {
        return failBuildToolchainCapsule(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
          `Admitted input ${sourceRef.locator} lost its exact source identity`,
        );
      }
      bytes = stableStageFile(sourcePath, sourceStat);
      if (
        sha256(bytes) !== sourceRef.contentHash
        || bytes.byteLength !== sourceRef.byteLength
      ) {
        return failBuildToolchainCapsule(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
          `Admitted input ${sourceRef.locator} bytes changed`,
        );
      }
      destinationDescriptor = openSync(
        destinationPath,
        constants.O_WRONLY
          | constants.O_CREAT
          | constants.O_EXCL
          | constants.O_NOFOLLOW,
        0o600,
      );
      writeAll(destinationDescriptor, bytes);
      fsyncSync(destinationDescriptor);
      fchmodSync(destinationDescriptor, 0o444);
      fsyncSync(destinationDescriptor);
    } catch (error) {
      if (
        error instanceof
          PlatformReleaseBuildToolchainCapsuleErrorV2
      ) throw error;
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
        `Admitted input ${sourceRef.locator} could not be copied into the private install project`,
        error,
      );
    } finally {
      bytes?.fill(0);
      closeQuietly(destinationDescriptor);
    }
  }
  fsyncDirectory(projectRoot);
}

function removePrivateBuildToolchainScratchRootV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
): void {
  if (sourceOwnedPathIsAbsentV2(anchor.absolutePath)) {
    return;
  }
  try {
    const owner = sourceOwnedProcessOwnerV2();
    const stat = lstatSync(anchor.absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(anchor.absolutePath)
        !== anchor.absolutePath
      || (stat.mode & 0o7777) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || !sameSourceOwnedDirectoryIdentityV2(
        sourceOwnedDirectoryIdentityV2(stat),
        anchor.identity,
      )
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
        `${label} was replaced or changed before cleanup`,
      );
    }
    makeSourceOwnedDirectoriesWritableV2(
      anchor.absolutePath,
    );
    rmSync(anchor.absolutePath, {
      recursive: true,
      force: false,
    });
    if (!sourceOwnedPathIsAbsentV2(anchor.absolutePath)) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
        `${label} remained after cleanup`,
      );
    }
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
    ) throw error;
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
      `${label} could not be removed safely`,
      error,
    );
  }
}

function cleanupPrivateBuildToolchainInstallScopeV2(
  scope: PrivateBuildToolchainInstallScopeV2,
): void {
  if (scope.cleanup.state !== "open") {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
      "Private build-toolchain scratch roots already entered cleanup",
    );
  }
  scope.cleanup.state = "cleaning";
  const errors: unknown[] = [];
  for (
    const [anchor, label] of [
      [scope.installAnchor, "Build-toolchain install root"],
      [
        scope.environmentAnchor,
        "Build-toolchain environment root",
      ],
    ] as const
  ) {
    try {
      removePrivateBuildToolchainScratchRootV2(
        anchor,
        label,
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    scope.cleanup.state = "cleanup_failed";
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
      "One or more private build-toolchain scratch roots could not be removed safely",
      new AggregateError(errors),
    );
  }
  scope.cleanup.state = "cleaned";
}

function createPrivateBuildToolchainInstallScope(
  state: SourceStageStateV2,
): PrivateBuildToolchainInstallScopeV2 {
  const parent = ensurePrivateStageParent();
  let environmentRoot: string | undefined;
  let environmentAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  let installRoot: string | undefined;
  let installAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  try {
    environmentRoot = mkdtempSync(path.join(
      parent,
      BUILD_TOOLCHAIN_ENVIRONMENT_PREFIX_V2,
    ));
    environmentAnchor =
      anchorSourceOwnedPrivateDirectoryV2(
        realpathSync(environmentRoot),
        "Build-toolchain environment root",
      );
    for (const name of [
      "cache",
      "config-probe",
      "home",
      "tmp",
    ]) {
      mkdirSync(path.join(environmentRoot, name), {
        mode: 0o700,
      });
    }
    for (const name of [
      "global.npmrc",
      "user.npmrc",
    ]) {
      const absolutePath = path.join(environmentRoot, name);
      let descriptor: number | undefined;
      try {
        descriptor = openSync(
          absolutePath,
          constants.O_WRONLY
            | constants.O_CREAT
            | constants.O_EXCL
            | constants.O_NOFOLLOW,
          0o600,
        );
        writeAll(descriptor, Buffer.from("\n", "utf8"));
        fsyncSync(descriptor);
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
      } finally {
        closeQuietly(descriptor);
      }
    }
    fsyncDirectory(environmentRoot);

    installRoot = mkdtempSync(path.join(
      parent,
      BUILD_TOOLCHAIN_INSTALL_PREFIX_V2,
    ));
    installAnchor =
      anchorSourceOwnedPrivateDirectoryV2(
        realpathSync(installRoot),
        "Build-toolchain install root",
      );
    mkdirSync(
      path.join(installRoot, "dependency-capsule"),
      { mode: 0o700 },
    );
    const projectRoot = path.join(installRoot, "project");
    mkdirSync(projectRoot, { mode: 0o700 });
    copyAdmittedBuildInputs(state, projectRoot);
    derivePlatformReleaseSourceLockAuthorityInternalV2({
      projectRoot,
      source: state.core.source,
      purpose: "build_toolchain",
    });
    fsyncDirectory(
      path.join(installRoot, "dependency-capsule"),
    );
    fsyncDirectory(installRoot);
    fsyncDirectory(parent);
    return Object.freeze({
      environmentRoot,
      environmentAnchor,
      installRoot,
      installAnchor,
      projectRoot: realpathSync(projectRoot),
      cleanup: {
        state: "open" as const,
      },
      environment: Object.freeze({
        CI: "true" as const,
        HOME: path.join(environmentRoot, "home"),
        LANG: "C.UTF-8" as const,
        LC_ALL: "C.UTF-8" as const,
        NODE_DISABLE_COMPILE_CACHE: "1" as const,
        NO_COLOR: "1" as const,
        NPM_CONFIG_CACHE:
          path.join(environmentRoot, "cache"),
        NPM_CONFIG_ENGINE_STRICT: "true" as const,
        NPM_CONFIG_GLOBALCONFIG:
          path.join(environmentRoot, "global.npmrc"),
        NPM_CONFIG_LOGS_MAX: "0" as const,
        NPM_CONFIG_REGISTRY:
          "https://registry.npmjs.org" as const,
        NPM_CONFIG_USERCONFIG:
          path.join(environmentRoot, "user.npmrc"),
        TEMP: path.join(environmentRoot, "tmp"),
        TMP: path.join(environmentRoot, "tmp"),
        TMPDIR: path.join(environmentRoot, "tmp"),
        TZ: "UTC" as const,
      }),
    });
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
      ? error
      : error instanceof
          PlatformReleaseBuildToolchainMaterializationErrorV2
      ? new PlatformReleaseBuildToolchainCapsuleErrorV2(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
          "Private build-toolchain source lock failed pre-npm validation",
          { cause: error },
        )
      : new PlatformReleaseBuildToolchainCapsuleErrorV2(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
        "Private build-toolchain install scope could not be created",
        { cause: error },
      );
    const cleanupErrors: unknown[] = [];
    for (
      const [root, anchor, label] of [
        [
          installRoot,
          installAnchor,
          "Partial build-toolchain install root",
        ],
        [
          environmentRoot,
          environmentAnchor,
          "Partial build-toolchain environment root",
        ],
      ] as const
    ) {
      if (!root) continue;
      try {
        if (anchor) {
          removePrivateBuildToolchainScratchRootV2(
            anchor,
            label,
          );
        } else if (!sourceOwnedPathIsAbsentV2(root)) {
          cleanupErrors.push(
            new PlatformReleaseBuildToolchainCapsuleErrorV2(
              "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
              `${label} was preserved without an authentic anchor`,
            ),
          );
        }
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
        "Partial private build-toolchain scope could not be removed safely",
        new AggregateError([
          primary,
          ...cleanupErrors,
        ]),
      );
    }
    throw primary;
  }
}

type PrivateProductionDependencyInstallScopeV2 = Readonly<{
  occurrence: "first" | "second";
  environmentRoot: string;
  environmentAnchor: SourceOwnedPrivateDirectoryV2;
  installRoot: string;
  installAnchor: SourceOwnedPrivateDirectoryV2;
  projectRoot: string;
  projectAnchor: SourceOwnedPrivateDirectoryV2;
  preNpmLockAuthority:
    PlatformReleaseSourceLockAuthorityV2;
  cleanup: {
    state:
      | "open"
      | "cleaning"
      | "cleaned"
      | "cleanup_failed";
  };
  environment:
    PrivateBuildToolchainInstallScopeV2["environment"];
}>;

function removePrivateProductionDependencyScratchRootV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
): void {
  if (sourceOwnedPathIsAbsentV2(anchor.absolutePath)) {
    return;
  }
  try {
    const owner = sourceOwnedProcessOwnerV2();
    const stat = lstatSync(anchor.absolutePath);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(anchor.absolutePath)
        !== anchor.absolutePath
      || (stat.mode & 0o7777) !== 0o700
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
      || !sameSourceOwnedDirectoryIdentityV2(
        sourceOwnedDirectoryIdentityV2(stat),
        anchor.identity,
      )
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        `${label} was replaced or changed before cleanup`,
      );
    }
    makeSourceOwnedDirectoriesWritableV2(
      anchor.absolutePath,
    );
    rmSync(anchor.absolutePath, {
      recursive: true,
      force: false,
    });
    if (!sourceOwnedPathIsAbsentV2(anchor.absolutePath)) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        `${label} remained after cleanup`,
      );
    }
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
      `${label} could not be removed safely`,
      error,
    );
  }
}

function cleanupPrivateProductionDependencyInstallScopeV2(
  scope: PrivateProductionDependencyInstallScopeV2,
): void {
  if (scope.cleanup.state === "cleaned") return;
  if (scope.cleanup.state !== "open") {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
      `${scope.occurrence} dependency scratch roots already entered cleanup`,
    );
  }
  scope.cleanup.state = "cleaning";
  const errors: unknown[] = [];
  for (
    const [anchor, label] of [
      [
        scope.installAnchor,
        `${scope.occurrence} production dependency install root`,
      ],
      [
        scope.environmentAnchor,
        `${scope.occurrence} production dependency environment root`,
      ],
    ] as const
  ) {
    try {
      if (anchor === scope.installAnchor) {
        assertSourceOwnedPrivateDirectoryCurrentV2(
          scope.projectAnchor,
          `${scope.occurrence} production dependency project root`,
          "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
        );
      }
      removePrivateProductionDependencyScratchRootV2(
        anchor,
        label,
      );
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    scope.cleanup.state = "cleanup_failed";
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
      `${scope.occurrence} dependency scratch roots could not be removed safely`,
      new AggregateError(errors),
    );
  }
  scope.cleanup.state = "cleaned";
}

function createPrivateProductionDependencyInstallScopeV2(
  state: SourceStageStateV2,
  occurrence: "first" | "second",
): PrivateProductionDependencyInstallScopeV2 {
  const parent = ensurePrivateStageParent();
  const environmentPrefix = occurrence === "first"
    ? PRODUCTION_DEPENDENCY_ENVIRONMENT_FIRST_PREFIX_V2
    : PRODUCTION_DEPENDENCY_ENVIRONMENT_SECOND_PREFIX_V2;
  const installPrefix = occurrence === "first"
    ? PRODUCTION_DEPENDENCY_INSTALL_FIRST_PREFIX_V2
    : PRODUCTION_DEPENDENCY_INSTALL_SECOND_PREFIX_V2;
  let environmentRoot: string | undefined;
  let environmentAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  let installRoot: string | undefined;
  let installAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  let projectAnchor:
    | SourceOwnedPrivateDirectoryV2
    | undefined;
  try {
    environmentRoot = mkdtempSync(path.join(
      parent,
      environmentPrefix,
    ));
    environmentAnchor =
      anchorSourceOwnedPrivateDirectoryV2(
        realpathSync(environmentRoot),
        `${occurrence} dependency environment root`,
      );
    for (const name of [
      "cache",
      "config-probe",
      "home",
      "tmp",
    ]) {
      mkdirSync(path.join(environmentRoot, name), {
        mode: 0o700,
      });
    }
    for (const name of [
      "global.npmrc",
      "user.npmrc",
    ]) {
      const absolutePath = path.join(environmentRoot, name);
      let descriptor: number | undefined;
      try {
        descriptor = openSync(
          absolutePath,
          constants.O_WRONLY
            | constants.O_CREAT
            | constants.O_EXCL
            | constants.O_NOFOLLOW,
          0o600,
        );
        writeAll(descriptor, Buffer.from("\n", "utf8"));
        fsyncSync(descriptor);
        fchmodSync(descriptor, 0o600);
        fsyncSync(descriptor);
      } finally {
        closeQuietly(descriptor);
      }
    }
    fsyncDirectory(environmentRoot);

    installRoot = mkdtempSync(path.join(
      parent,
      installPrefix,
    ));
    installAnchor =
      anchorSourceOwnedPrivateDirectoryV2(
        realpathSync(installRoot),
        `${occurrence} dependency install root`,
      );
    const projectRoot = path.join(installRoot, "project");
    mkdirSync(projectRoot, { mode: 0o700 });
    projectAnchor =
      anchorSourceOwnedPrivateDirectoryV2(
        realpathSync(projectRoot),
        `${occurrence} dependency project root`,
      );
    try {
      copyAdmittedBuildInputs(state, projectRoot);
    } catch (error) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        `${occurrence} dependency project could not copy exact admitted inputs`,
        error,
      );
    }
    let preNpmLockAuthority:
      PlatformReleaseSourceLockAuthorityV2;
    try {
      preNpmLockAuthority =
        derivePlatformReleaseSourceLockAuthorityInternalV2({
          projectRoot,
          source: state.core.source,
          purpose: "production_runtime",
        });
    } catch (error) {
      return failDependencyPairFromSourceLockV2(
        error,
        `${occurrence} dependency source lock failed pre-npm validation`,
      );
    }
    if (
      canonicalJsonStringify(
        readdirSync(installRoot).sort(),
      ) !== canonicalJsonStringify(["project"])
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
        `${occurrence} dependency install root topology is not exact`,
      );
    }
    fsyncDirectory(installRoot);
    fsyncDirectory(parent);
    return Object.freeze({
      occurrence,
      environmentRoot,
      environmentAnchor,
      installRoot,
      installAnchor,
      projectRoot: projectAnchor.absolutePath,
      projectAnchor,
      preNpmLockAuthority,
      cleanup: {
        state: "open" as const,
      },
      environment: Object.freeze({
        CI: "true" as const,
        HOME: path.join(environmentRoot, "home"),
        LANG: "C.UTF-8" as const,
        LC_ALL: "C.UTF-8" as const,
        NODE_DISABLE_COMPILE_CACHE: "1" as const,
        NO_COLOR: "1" as const,
        NPM_CONFIG_CACHE:
          path.join(environmentRoot, "cache"),
        NPM_CONFIG_ENGINE_STRICT: "true" as const,
        NPM_CONFIG_GLOBALCONFIG:
          path.join(environmentRoot, "global.npmrc"),
        NPM_CONFIG_LOGS_MAX: "0" as const,
        NPM_CONFIG_REGISTRY:
          "https://registry.npmjs.org" as const,
        NPM_CONFIG_USERCONFIG:
          path.join(environmentRoot, "user.npmrc"),
        TEMP: path.join(environmentRoot, "tmp"),
        TMP: path.join(environmentRoot, "tmp"),
        TMPDIR: path.join(environmentRoot, "tmp"),
        TZ: "UTC" as const,
      }),
    });
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseDependencyMaterializedPairErrorV2
      ? error
      : new PlatformReleaseDependencyMaterializedPairErrorV2(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
        `${occurrence} private dependency install scope could not be created`,
        { cause: error },
      );
    const cleanupErrors: unknown[] = [];
    for (
      const [root, anchor, label] of [
        [
          installRoot,
          installAnchor,
          `${occurrence} partial dependency install root`,
        ],
        [
          environmentRoot,
          environmentAnchor,
          `${occurrence} partial dependency environment root`,
        ],
      ] as const
    ) {
      if (!root) continue;
      try {
        if (anchor) {
          if (
            anchor === installAnchor
            && projectAnchor
          ) {
            assertSourceOwnedPrivateDirectoryCurrentV2(
              projectAnchor,
              `${occurrence} partial dependency project root`,
              "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
            );
          }
          removePrivateProductionDependencyScratchRootV2(
            anchor,
            label,
          );
        } else if (!sourceOwnedPathIsAbsentV2(root)) {
          cleanupErrors.push(
            new PlatformReleaseDependencyMaterializedPairErrorV2(
              "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
              `${label} was preserved without an authentic anchor`,
            ),
          );
        }
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        `${occurrence} partial dependency scope could not be removed safely`,
        new AggregateError([
          primary,
          ...cleanupErrors,
        ]),
      );
    }
    throw primary;
  }
}

function assertPrivateProductionDependencyInstallScopeCurrentV2(
  scope: PrivateProductionDependencyInstallScopeV2,
  phase: string,
): void {
  try {
    assertSourceOwnedPrivateDirectoryCurrentV2(
      scope.environmentAnchor,
      `${scope.occurrence} dependency environment root`,
    );
    assertSourceOwnedPrivateDirectoryCurrentV2(
      scope.installAnchor,
      `${scope.occurrence} dependency install root`,
    );
    assertSourceOwnedPrivateDirectoryCurrentV2(
      scope.projectAnchor,
      `${scope.occurrence} dependency project root`,
    );
    if (
      scope.environmentAnchor.absolutePath
        !== scope.environmentRoot
      || scope.installAnchor.absolutePath
        !== scope.installRoot
      || scope.projectAnchor.absolutePath
        !== scope.projectRoot
      || path.dirname(scope.projectRoot)
        !== scope.installRoot
      || canonicalJsonStringify(
        readdirSync(scope.installRoot).sort(),
      ) !== canonicalJsonStringify(["project"])
      || canonicalJsonStringify(
        readdirSync(scope.environmentRoot).sort(),
      ) !== canonicalJsonStringify([
        "cache",
        "config-probe",
        "global.npmrc",
        "home",
        "tmp",
        "user.npmrc",
      ])
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
        `${scope.occurrence} dependency scratch authority is not exact during ${phase}`,
      );
    }
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
      `${scope.occurrence} dependency scratch authority changed during ${phase}`,
      error,
    );
  }
}

function buildToolchainPhysicalIdentity(
  nodeModulesRoot: string,
  toolchainBindingHash: string,
): PlatformReleaseBuildToolchainPhysicalIdentityV2 {
  const owner = processOwnerForBuildToolchain();
  try {
    const stat = lstatSync(nodeModulesRoot);
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(nodeModulesRoot) !== nodeModulesRoot
      || (stat.mode & 0o7777) !== 0o555
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
        "Build-toolchain physical root is not exact",
      );
    }
    const identity = {
      schema:
        PLATFORM_RELEASE_BUILD_TOOLCHAIN_PHYSICAL_IDENTITY_V2_SCHEMA,
      device: String(stat.dev),
      inode: String(stat.ino),
      ownerUid: stat.uid,
      ownerGid: stat.gid,
      mode: "0555" as const,
      buildContextPolicy:
        "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
      toolchainBindingHash,
      identityHash: sha256("placeholder"),
    };
    return deepFreezePlatformReleaseJsonV2(
      PlatformReleaseBuildToolchainPhysicalIdentityV2Schema
        .parse({
          ...identity,
          identityHash:
            hashPlatformReleaseBuildToolchainPhysicalIdentityV2(
              identity,
            ),
        }),
    );
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
    ) throw error;
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
      "Build-toolchain physical identity could not be captured",
      error,
    );
  }
}

function sourceAdmissionBindingHash(
  state: SourceStageStateV2,
): string {
  return state.receipt?.receiptHash
    ?? hashCanonicalJson({
      schema:
        "setfarm.platform-release-test-source-admission-binding.v2",
      testEvidence: state.testEvidence,
    });
}

function issueBuildToolchainReceipt(input: Readonly<{
  sourceState: SourceStageStateV2;
  hostReceipt: ReturnType<
    typeof inspectPlatformReleaseHostNodeToolchainReceiptV2
  >;
  installEvidence: Awaited<
    ReturnType<
      typeof executePlatformReleaseHostNodeToolchainNpmCiInternalV2
    >
  >;
  materialized:
    PlatformReleaseBuildToolchainTreeMaterializationV2;
  physicalBefore:
    PlatformReleaseBuildToolchainPhysicalIdentityV2;
  physicalAfter:
    PlatformReleaseBuildToolchainPhysicalIdentityV2;
}>): PlatformReleaseBuildToolchainReceiptV2 {
  const recipeIdentity = {
    schema:
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_INSTALL_RECIPE_V2_SCHEMA,
    commandRef:
      "MATERIALIZE_PLATFORM_BUILD_TOOLCHAIN_V2" as const,
    directArgv: [
      "npm",
      "ci",
      "--include=dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ] as const,
    dependencySelection:
      "production_and_dev_from_exact_lock" as const,
    lifecycleScripts: "forbidden" as const,
    ambientEnvironment: "forbidden" as const,
    generatedNpmMetadata:
      "verified_then_removed_before_capsule_capture" as const,
    symbolicLinks:
      "exact_lock_declared_bins_verified_then_removed" as const,
    outputNormalization:
      "every_file_0444_or_0555_every_directory_0555" as const,
    configHash:
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_NPM_CONFIG_HASH_V2,
  };
  const installRecipe = {
    ...recipeIdentity,
    recipeHash:
      hashPlatformReleaseBuildToolchainInstallRecipeV2(
        recipeIdentity as never,
      ),
  };
  const receiptIdentity = {
    schema:
      PLATFORM_RELEASE_BUILD_TOOLCHAIN_RECEIPT_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "candidate_build_toolchain_materialization_unverified" as const,
    productionUse:
      "forbidden_until_fresh_context_and_double_build_verification" as const,
    sourceAdmissionReceiptHash:
      sourceAdmissionBindingHash(input.sourceState),
    inputs: input.sourceState.core.source.inputs,
    inputMembershipHash:
      input.sourceState.core.source.inputMembershipHash,
    placement: {
      buildContextPolicy:
        "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2" as const,
      parentMode: "0700" as const,
      rootLocator: "node_modules" as const,
      rootMode: "0555" as const,
      allowedFinalContextEntries: [
        "node_modules",
        "source",
      ] as const,
      temporaryLocatorDisclosure: "forbidden" as const,
    },
    hostToolchain: input.hostReceipt,
    packageManager: {
      packageName: "npm" as const,
      version: input.hostReceipt.npm.version,
      executableRef:
        "EXEC_NPM_PACKAGE_MANAGER_V2" as const,
      executableHash:
        input.hostReceipt.npm.cli.contentHash,
      packageTreeHash:
        input.hostReceipt.npm.packageTree
          .normalizedTreeHash,
      buildInstallRecipeHash:
        installRecipe.recipeHash,
    },
    compiler: input.materialized.compiler,
    installRecipe,
    process: {
      hostToolchainReceiptHash:
        input.installEvidence
          .platformHostToolchainReceiptHash,
      environmentHash:
        input.installEvidence.environmentHash,
      projectScopeHash:
        input.installEvidence.projectScopeHash,
      recipeHash: installRecipe.recipeHash,
      directArgvHash:
        input.installEvidence.directArgvHash,
      stdin: "closed" as const,
      inheritAmbientEnvironment: false as const,
      shell: "forbidden" as const,
      termination: "normal_exit" as const,
      exitCode: 0 as const,
      signal: null,
      stdoutContentHash:
        input.installEvidence.stdoutHash,
      stdoutByteLength:
        input.installEvidence.stdoutBytes,
      stderrContentHash:
        input.installEvidence.stderrHash,
      stderrByteLength:
        input.installEvidence.stderrBytes,
    },
    tree: input.materialized.treeBinding,
    physicalBefore: input.physicalBefore,
    physicalAfter: input.physicalAfter,
  };
  try {
    return deepFreezePlatformReleaseJsonV2(
      PlatformReleaseBuildToolchainReceiptV2Schema.parse({
        ...receiptIdentity,
        receiptHash:
          hashPlatformReleaseBuildToolchainReceiptV2(
            receiptIdentity as never,
          ),
      }),
    );
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
      "Materialized build toolchain failed its canonical receipt schema",
      error,
    );
  }
}

function exactBuildToolchainCapsuleInput(
  input: unknown,
): Readonly<{
  sourceStage: AdmittedPlatformReleaseSourceStageV2;
  hostToolchain:
    PlatformReleaseHostNodeToolchainAuthorityV2;
}> {
  if (
    typeof input !== "object"
    || input === null
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID",
      "Build toolchain input must be one exact plain data object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2
    || keys.some((key) =>
      typeof key !== "string"
      || !["hostToolchain", "sourceStage"].includes(key))
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID",
      "Build toolchain input fields are not exact",
    );
  }
  const sourceDescriptor =
    Object.getOwnPropertyDescriptor(input, "sourceStage");
  const hostDescriptor =
    Object.getOwnPropertyDescriptor(input, "hostToolchain");
  if (
    !sourceDescriptor
    || !("value" in sourceDescriptor)
    || sourceDescriptor.enumerable !== true
    || !hostDescriptor
    || !("value" in hostDescriptor)
    || hostDescriptor.enumerable !== true
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID",
      "Build toolchain input contains an accessor or hidden capability",
    );
  }
  return Object.freeze({
    sourceStage:
      sourceDescriptor.value as
        AdmittedPlatformReleaseSourceStageV2,
    hostToolchain:
      hostDescriptor.value as
        PlatformReleaseHostNodeToolchainAuthorityV2,
  });
}

async function materializeBuildToolchainCapsule(
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<PlatformReleaseBuildToolchainCapsuleV2> {
  const values = exactBuildToolchainCapsuleInput(input);
  let sourceState: SourceStageStateV2;
  try {
    sourceState = authenticState(values.sourceStage);
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INPUT_INVALID",
      "Build toolchain source handle is not authentic",
      error,
    );
  }
  let production: boolean;
  try {
    production =
      isProductionPlatformReleaseHostNodeToolchainAuthorityV2(
        values.hostToolchain,
      );
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
      "Build toolchain host handle is not authentic",
      error,
    );
  }
  const expectedSourceScope =
    expectedScope === "production_host"
      ? "production_candidate"
      : "test_fixture";
  if (
    production !== (expectedScope === "production_host")
    || sourceState.admissionScope !== expectedSourceScope
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SCOPE_MISMATCH",
      "Source and host admission scopes cannot be promoted, downgraded or mixed",
    );
  }
  if (
    !transitionSourceContextLifecycleV2(
      sourceState,
      "source_admitted",
      "toolchain_materializing",
    )
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_ALREADY_MATERIALIZED",
      "An admitted source context can materialize one build toolchain only",
    );
  }
  let scope:
    | PrivateBuildToolchainInstallScopeV2
    | undefined;
  let primaryFailure: unknown;
  try {
    let hostReceipt;
    try {
      hostReceipt =
        await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
          values.hostToolchain,
        );
    } catch (error) {
      if (isPlatformReleaseHostAuthorityDriftV2(error)) {
        return failBuildToolchainCapsule(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
          "Authenticated host composition authority changed during npm installation",
          error,
        );
      }
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
        "Platform release host authority failed pre-install revalidation",
        error,
      );
    }
    stableSourceStageState(sourceState);
    exactBuildContext(sourceState, "source_only");
    scope =
      createPrivateBuildToolchainInstallScope(sourceState);
    stableSourceStageState(sourceState);
    let installEvidence;
    try {
      installEvidence =
        await executePlatformReleaseHostNodeToolchainNpmCiInternalV2(
          values.hostToolchain,
          {
            privateRoot: scope.environmentRoot,
            projectRoot: scope.projectRoot,
            environment: scope.environment,
          },
        );
    } catch (error) {
      if (isPlatformReleaseHostAuthorityDriftV2(error)) {
        return failBuildToolchainCapsule(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
          "Authenticated host composition authority changed during npm installation",
          error,
        );
      }
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_INSTALL_FAILED",
        "Authenticated exact npm ci did not produce a build-toolchain candidate",
        error,
      );
    }
    if (
      sourceState.lifecycle !== "toolchain_materializing"
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
        "Source context lifecycle changed during build-toolchain installation",
      );
    }
    stableSourceStageState(sourceState);
    let hostAfter;
    try {
      hostAfter =
        await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
          values.hostToolchain,
        );
    } catch (error) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
        "Platform release host authority failed post-install revalidation",
        error,
      );
    }
    if (
      hostAfter.receiptHash !== hostReceipt.receiptHash
      || installEvidence
        .platformHostToolchainReceiptHash
        !== hostReceipt.receiptHash
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
        "Host Node/npm authority changed across dependency installation",
      );
    }
    let materialized:
      PlatformReleaseBuildToolchainTreeMaterializationV2;
    try {
      materialized =
        materializePlatformReleaseBuildToolchainTreeInternalV2({
          admissionScope: expectedScope,
          projectRoot: scope.projectRoot,
          source: sourceState.core.source,
          hostPlatform: hostAfter.host.platform,
          hostArchitecture: hostAfter.host.architecture,
        });
    } catch (error) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
        "npm output failed exact lock, package, bin or canonical-tree verification",
        error,
      );
    }
    const sourceNodeModulesRoot =
      path.join(sourceState.contextRoot, "node_modules");
    const installNodeModulesRoot =
      path.join(scope.projectRoot, "node_modules");
    chmodSync(installNodeModulesRoot, 0o700);
    fsyncDirectory(installNodeModulesRoot);
    renameSync(
      installNodeModulesRoot,
      sourceNodeModulesRoot,
    );
    chmodSync(sourceNodeModulesRoot, 0o555);
    fsyncDirectory(sourceNodeModulesRoot);
    fsyncDirectory(sourceState.contextRoot);
    fsyncDirectory(path.dirname(sourceState.contextRoot));
    exactBuildContext(sourceState, "materialized");
    stableSourceStageState(sourceState);
    revalidatePlatformReleaseBuildToolchainTreeInternalV2({
      admissionScope: expectedScope,
      nodeModulesRoot: sourceNodeModulesRoot,
      source: sourceState.core.source,
      lockAuthority: materialized.lockAuthority,
      installedPackages: materialized.installedPackages,
      dependencyTree: materialized.dependencyTree,
      treeBinding: materialized.treeBinding,
      compiler: materialized.compiler,
    });
    const physicalBefore =
      buildToolchainPhysicalIdentity(
        sourceNodeModulesRoot,
        materialized.treeBinding.bindingHash,
      );
    stableSourceStageState(sourceState);
    const physicalAfter =
      buildToolchainPhysicalIdentity(
        sourceNodeModulesRoot,
        materialized.treeBinding.bindingHash,
      );
    if (
      canonicalJsonStringify(physicalBefore)
        !== canonicalJsonStringify(physicalAfter)
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
        "Build-toolchain physical root changed across fresh verification",
      );
    }
    const receipt = issueBuildToolchainReceipt({
      sourceState,
      hostReceipt: hostAfter,
      installEvidence,
      materialized,
      physicalBefore,
      physicalAfter,
    });
    const capsuleState = Object.freeze({
      admissionScope: expectedScope,
      sourceStage: values.sourceStage,
      hostToolchain: values.hostToolchain,
      contextRoot: sourceState.contextRoot,
      nodeModulesRoot: sourceNodeModulesRoot,
      source: sourceState.core.source,
      materialized,
      receipt,
    });
    if (
      !transitionSourceContextLifecycleV2(
        sourceState,
        "toolchain_materializing",
        "toolchain_materialized",
      )
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
        "Source lifecycle changed before build-toolchain completion",
      );
    }
    return new PlatformReleaseBuildToolchainCapsuleV2(
      buildToolchainCapsuleConstructorCapabilityV2,
      capsuleState,
    );
  } catch (error) {
    primaryFailure = error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
      ? error
      : new PlatformReleaseBuildToolchainCapsuleErrorV2(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
        "Build-toolchain capsule failed at an internal boundary",
        { cause: error },
      );
    throw primaryFailure;
  } finally {
    const cleanupErrors: unknown[] = [];
    if (scope) {
      try {
        cleanupPrivateBuildToolchainInstallScopeV2(
          scope,
        );
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (
      sourceState.lifecycle === "toolchain_materializing"
      || cleanupErrors.length > 0
    ) {
      try {
        disposeSourceOwnedPhysicalContextV2(
          sourceState,
        );
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new PlatformReleaseBuildToolchainCapsuleErrorV2(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
        "Build-toolchain transaction could not destroy every private root safely",
        {
          cause: new AggregateError([
            ...(primaryFailure === undefined
              ? []
              : [primaryFailure]),
            ...cleanupErrors,
          ]),
        },
      );
    }
  }
}

export async function materializePlatformReleaseBuildToolchainCapsuleV2(
  input: Readonly<{
    sourceStage: AdmittedPlatformReleaseSourceStageV2;
    hostToolchain:
      PlatformReleaseHostNodeToolchainAuthorityV2;
  }>,
): Promise<PlatformReleaseBuildToolchainCapsuleV2> {
  return materializeBuildToolchainCapsule(
    input,
    "production_host",
  );
}

export async function materializePlatformReleaseBuildToolchainCapsuleV2ForTest(
  input: Readonly<{
    sourceStage: AdmittedPlatformReleaseSourceStageV2;
    hostToolchain:
      PlatformReleaseHostNodeToolchainAuthorityV2;
  }>,
): Promise<PlatformReleaseBuildToolchainCapsuleV2> {
  return materializeBuildToolchainCapsule(
    input,
    "test_fixture",
  );
}

export function inspectPlatformReleaseBuildToolchainReceiptV2(
  handle: PlatformReleaseBuildToolchainCapsuleV2,
): PlatformReleaseBuildToolchainReceiptV2 {
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(
      authenticBuildToolchainCapsuleState(handle).receipt,
    ),
  );
}

type RevalidatedBuildToolchainCapsuleStateV2 = Readonly<{
  capsule: BuildToolchainCapsuleStateV2;
  sourceState: SourceStageStateV2;
  receipt: PlatformReleaseBuildToolchainReceiptV2;
}>;

async function revalidateBuildToolchainCapsuleForLifecycleV2(
  handle: PlatformReleaseBuildToolchainCapsuleV2,
  admittedLifecycles:
    readonly PlatformReleaseSourceContextLifecycleV2[],
): Promise<RevalidatedBuildToolchainCapsuleStateV2> {
  const capsule =
    authenticBuildToolchainCapsuleState(handle);
  let sourceState: SourceStageStateV2;
  try {
    sourceState = authenticState(capsule.sourceStage);
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Capsule source authority is no longer live",
      error,
    );
  }
  if (
    !admittedLifecycles.includes(sourceState.lifecycle)
    || sourceState.contextRoot !== capsule.contextRoot
    || sourceState.core.source.bindingHash
      !== capsule.source.bindingHash
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Capsule no longer joins its one admitted source context",
    );
  }
  try {
    stableSourceStageState(sourceState);
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Capsule source tree failed fresh physical revalidation",
      error,
    );
  }
  try {
    exactBuildContext(sourceState, "materialized");
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
      "Capsule source-owned context failed fresh topology revalidation",
      error,
    );
  }
  let host;
  try {
    host =
      await revalidatePlatformReleaseHostNodeToolchainAuthorityV2(
        capsule.hostToolchain,
      );
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
      "Capsule host Node/npm authority failed fresh revalidation",
      error,
    );
  }
  if (
    host.receiptHash
      !== capsule.receipt.hostToolchain.receiptHash
    || host.admissionScope !== capsule.admissionScope
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_HOST_DRIFT",
      "Capsule host Node/npm receipt identity changed",
    );
  }
  try {
    revalidatePlatformReleaseBuildToolchainTreeInternalV2({
      admissionScope: capsule.admissionScope,
      nodeModulesRoot: capsule.nodeModulesRoot,
      source: capsule.source,
      lockAuthority:
        capsule.materialized.lockAuthority,
      installedPackages:
        capsule.materialized.installedPackages,
      dependencyTree:
        capsule.materialized.dependencyTree,
      treeBinding:
        capsule.materialized.treeBinding,
      compiler: capsule.materialized.compiler,
    });
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_TREE_INVALID",
      "Capsule dependency tree failed fresh every-and-only verification",
      error,
    );
  }
  let physical:
    PlatformReleaseBuildToolchainPhysicalIdentityV2;
  try {
    physical =
      buildToolchainPhysicalIdentity(
        capsule.nodeModulesRoot,
        capsule.materialized.treeBinding.bindingHash,
      );
    exactBuildContext(sourceState, "materialized");
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
      "Capsule physical context failed its post-verification fence",
      error,
    );
  }
  try {
    stableSourceStageState(sourceState);
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Capsule source tree changed across fresh toolchain verification",
      error,
    );
  }
  if (
    !admittedLifecycles.includes(sourceState.lifecycle)
    || canonicalJsonStringify(physical)
      !== canonicalJsonStringify(
        capsule.receipt.physicalAfter,
      )
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
      "Capsule physical identity changed after materialization",
    );
  }
  return Object.freeze({
    capsule,
    sourceState,
    receipt: deepFreezePlatformReleaseJsonV2(
      structuredClone(capsule.receipt),
    ),
  });
}

export async function revalidatePlatformReleaseBuildToolchainCapsuleV2(
  handle: PlatformReleaseBuildToolchainCapsuleV2,
): Promise<PlatformReleaseBuildToolchainReceiptV2> {
  const capsule =
    authenticBuildToolchainCapsuleState(handle);
  let sourceState: SourceStageStateV2;
  try {
    sourceState = authenticState(capsule.sourceStage);
  } catch (error) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Capsule source authority is no longer live",
      error,
    );
  }
  if (
    !transitionSourceContextLifecycleV2(
      sourceState,
      "toolchain_materialized",
      "toolchain_revalidating",
    )
  ) {
    if (sourceState.lifecycle === "toolchain_revalidating") {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_REVALIDATION_IN_FLIGHT",
        "Capsule already owns one fresh revalidation transaction",
      );
    }
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
      "Capsule no longer owns the pre-build source lifecycle",
    );
  }
  try {
    const live =
      await revalidateBuildToolchainCapsuleForLifecycleV2(
        handle,
        ["toolchain_revalidating"],
      );
    if (
      live.capsule !== capsule
      || live.sourceState !== sourceState
      || !transitionSourceContextLifecycleV2(
        sourceState,
        "toolchain_revalidating",
        "toolchain_materialized",
      )
    ) {
      return failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SOURCE_DRIFT",
        "Capsule lost its exact source ownership during fresh revalidation",
      );
    }
    return live.receipt;
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
      ? error
      : new PlatformReleaseBuildToolchainCapsuleErrorV2(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CONTEXT_INVALID",
        "Capsule failed at an internal revalidation boundary",
        { cause: error },
      );
    if (sourceState.lifecycle === "toolchain_revalidating") {
      try {
        disposeSourceOwnedPhysicalContextV2(sourceState);
      } catch (cleanupError) {
        throw new PlatformReleaseBuildToolchainCapsuleErrorV2(
          "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
          "Failed capsule revalidation could not destroy its source-owned context",
          {
            cause: new AggregateError([
              primary,
              cleanupError,
            ]),
          },
        );
      }
    }
    throw primary;
  }
}

function authenticCompiledOutputPairStateV2(
  handle: PlatformReleaseCompiledOutputPairV2,
): CompiledOutputPairStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PlatformReleaseCompiledOutputPairV2.prototype
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_HANDLE_UNAUTHENTICATED",
      "Compiled output pair operation requires one authentic handle",
    );
  }
  const state = compiledOutputPairStatesV2.get(handle);
  if (!state) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_HANDLE_UNAUTHENTICATED",
      "Compiled output pair operation requires one authentic handle",
    );
  }
  return state;
}

function exactCompiledOutputPairInputV2(
  input: unknown,
): Readonly<{
  sourceStage: AdmittedPlatformReleaseSourceStageV2;
  buildToolchain:
    PlatformReleaseBuildToolchainCapsuleV2;
}> {
  if (
    typeof input !== "object"
    || input === null
    || Array.isArray(input)
    || isProxy(input)
    || Object.getPrototypeOf(input) !== Object.prototype
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
      "Compiled output input must be one exact plain data object",
    );
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2
    || keys.some((key) =>
      typeof key !== "string"
      || !["buildToolchain", "sourceStage"].includes(key))
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
      "Compiled output input fields are not exact",
    );
  }
  const sourceDescriptor =
    Object.getOwnPropertyDescriptor(input, "sourceStage");
  const toolchainDescriptor =
    Object.getOwnPropertyDescriptor(input, "buildToolchain");
  if (
    !sourceDescriptor
    || !("value" in sourceDescriptor)
    || sourceDescriptor.enumerable !== true
    || !toolchainDescriptor
    || !("value" in toolchainDescriptor)
    || toolchainDescriptor.enumerable !== true
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
      "Compiled output input contains an accessor or hidden capability",
    );
  }
  return Object.freeze({
    sourceStage:
      sourceDescriptor.value as
        AdmittedPlatformReleaseSourceStageV2,
    buildToolchain:
      toolchainDescriptor.value as
        PlatformReleaseBuildToolchainCapsuleV2,
  });
}

function compiledCommandModuleHashV2(
  sourceState: SourceStageStateV2,
): string {
  const fingerprint = stableSourceStageState(sourceState);
  const command = fingerprint.entries.find((entry) =>
    entry.path === "scripts/build-platform-release-v2.mjs"
  );
  if (!command || command.type !== "file") {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Admitted source lacks the exact platform release build command",
    );
  }
  return command.contentHash;
}

function assertCompiledOutputTreeOwnershipV2(
  root: string,
  tree: CanonicalRuntimeTreeV2,
  admissionScope: "production_candidate" | "test_fixture",
): void {
  const owner = sourceOwnedProcessOwnerV2();
  const expectedUid = admissionScope === "production_candidate"
    ? 0
    : owner.uid;
  if (
    admissionScope === "production_candidate"
    && owner.uid !== 0
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
      "Production compiled outputs require the root-owned release producer",
    );
  }
  for (const entry of [
    {
      path: ".",
      type: "directory" as const,
      mode: "0555" as const,
    },
    ...tree.entries,
  ]) {
    const absolutePath = entry.path === "."
      ? root
      : path.join(root, entry.path);
    const stat = lstatSync(absolutePath);
    const expectedMode =
      Number.parseInt(entry.mode, 8);
    if (
      stat.isSymbolicLink()
      || stat.uid !== expectedUid
      || stat.gid !== owner.gid
      || (stat.mode & 0o7777) !== expectedMode
      || (
        entry.type === "directory"
          ? !stat.isDirectory()
          : !stat.isFile() || stat.nlink !== 1
      )
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        `Compiled dist ownership or type changed at ${entry.path}`,
      );
    }
  }
}

function captureCompiledDistTreeV2(
  distRoot: string,
  capsuleScope: "production_host" | "test_fixture",
): CanonicalRuntimeTreeV2 {
  const metadataProbe =
    getNodeScaffoldRuntimeMetadataProbeInternalV2(
      capsuleScope,
    );
  const tree = capsuleScope === "production_host"
    ? captureCanonicalRuntimeTreeV2({
      root: distRoot,
      profile: "dist",
      metadataProbe,
    })
    : captureCanonicalRuntimeTreeV2ForTest({
      root: distRoot,
      profile: "dist",
      metadataProbe,
    });
  verifyCanonicalRuntimeTreeV2({
    root: distRoot,
    candidate: tree,
    metadataProbe,
  });
  return tree;
}

function assertCompiledMetadataClearV2(
  capsuleScope: "production_host" | "test_fixture",
  absolutePath: string,
  relativePath: string,
  type: "directory" | "file",
): void {
  const probe =
    getNodeScaffoldRuntimeMetadataProbeInternalV2(
      capsuleScope,
    );
  let result;
  try {
    result = probe({
      absolutePath,
      relativePath,
      type,
    });
  } catch (error) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      `Compiled output metadata probe failed for ${relativePath}`,
      error,
    );
  }
  if (
    result.status !== "clear"
    || Reflect.ownKeys(result).length !== 1
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      `Compiled output retained metadata at ${relativePath}`,
    );
  }
}

function exactCompiledPackageJsonV2(
  packagePath: string,
  sourceState: SourceStageStateV2,
): Readonly<{
  identity: CompiledPackageIdentityV2;
  bytes: Buffer;
}> {
  const sourceRef = sourceState.core.source.inputs.find(
    (entry) =>
      entry.role === "package_manifest"
      && entry.locator === "package.json",
  );
  if (!sourceRef) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Admitted package source reference is missing",
    );
  }
  let captured;
  let admitted;
  try {
    captured =
      readExactNpmLockRegularFileInternalV2({
        absolutePath: packagePath,
        label: "Compiled payload package.json",
        maxBytes: 4 * 1024 * 1024,
        allowedModes: [0o444],
      });
    admitted =
      readExactNpmLockRegularFileInternalV2({
        absolutePath: path.join(
          sourceState.stageRoot,
          sourceRef.locator,
        ),
        label: "Admitted source package.json",
        maxBytes: 4 * 1024 * 1024,
        allowedModes: [0o444],
      });
  } catch (error) {
    captured?.bytes.fill(0);
    admitted?.bytes.fill(0);
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      "Compiled package.json failed exact descriptor capture",
      error,
    );
  }
  if (
    captured.contentHash !== sourceRef.contentHash
    || captured.bytes.byteLength !== sourceRef.byteLength
    || admitted.contentHash !== sourceRef.contentHash
    || admitted.bytes.byteLength !== sourceRef.byteLength
    || !captured.bytes.equals(admitted.bytes)
  ) {
    captured.bytes.fill(0);
    admitted.bytes.fill(0);
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      "Compiled package.json differs from admitted source bytes",
    );
  }
  admitted.bytes.fill(0);
  return Object.freeze({
    identity: Object.freeze({
      sourceRefHash: sourceRef.sourceRefHash,
      contentHash: captured.contentHash,
      byteLength: captured.bytes.byteLength,
      mode: "0444" as const,
    }),
    bytes: captured.bytes,
  });
}

function assertCompiledCommandResultJoinsV2(
  result: PlatformReleaseBuildCommandResultV2,
  sourceState: SourceStageStateV2,
  capsule: BuildToolchainCapsuleStateV2,
  distTree: CanonicalRuntimeTreeV2,
): void {
  if (
    result.sourceFingerprintHash
      !== sourceState.core.source.exportedFileTreeHash
    || result.sourceFileCount
      !== sourceState.core.source.exportedFileCount
    || result.sourceDirectoryCount
      !== sourceState.core.source.exportedDirectoryCount
    || result.sourceTotalBytes
      !== sourceState.core.source.exportedTotalBytes
    || result.sourceSha
      !== sourceState.core.admittedSource.sha
    || result.sourceDateEpoch
      !== sourceState.core.admittedSource.commitEpochSeconds
    || result.buildToolchainTreeHash
      !== capsule.materialized.treeBinding.treeHash
    || result.buildToolchainFileCount
      !== capsule.materialized.treeBinding.fileCount
    || result.buildToolchainDirectoryCount
      !== capsule.materialized.treeBinding.directoryCount
    || result.buildToolchainTotalBytes
      !== capsule.materialized.treeBinding.totalBytes
    || result.compilerEntryHash
      !== capsule.materialized.compiler.entryModuleHash
    || result.platformFileCount !== distTree.fileCount
    || result.platformDirectoryCount
      !== distTree.directoryCount
    || result.platformTotalBytes !== distTree.totalBytes
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      "Build command result does not join exact source, toolchain, compiler and dist authority",
    );
  }
}

type CapturedCompiledOccurrenceV2 = Readonly<{
  state: CompiledOccurrenceStateV2;
  packageBytes: Buffer;
}>;

function captureCompiledOccurrenceV2(input: Readonly<{
  occurrence: "first" | "second";
  sourceState: SourceStageStateV2;
  capsule: BuildToolchainCapsuleStateV2;
  slot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  >;
  commandModuleHash: string;
  hostEvidence:
    PlatformReleaseHostNodeToolchainBuildEvidenceV2;
}>): CapturedCompiledOccurrenceV2 {
  let capturedPackageBytes: Buffer | undefined;
  try {
    const currentSlot = requireSourceOwnedOutputRootV2(
      input.sourceState,
      input.occurrence,
    );
    if (
      canonicalJsonStringify(currentSlot)
        !== canonicalJsonStringify(input.slot)
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        `${input.occurrence} compiled output anchor changed`,
      );
    }
    const outputRoot = input.slot.outputRoot.absolutePath;
    const outputRootStat = lstatSync(outputRoot);
    const outputStagePhysicalIdentityHash =
      hashHostNodePlatformReleaseOutputStageIdentityV2({
        device: outputRootStat.dev,
        inode: outputRootStat.ino,
        mode: outputRootStat.mode,
        ownerUid: outputRootStat.uid,
        ownerGid: outputRootStat.gid,
      });
    const outputNames = readdirSync(outputRoot).sort();
    const payloadRoot = path.join(outputRoot, "payload");
    const payload = lstatSync(payloadRoot);
    const owner = sourceOwnedProcessOwnerV2();
    const expectedUid =
      input.sourceState.admissionScope
          === "production_candidate"
        ? 0
        : owner.uid;
    if (
      canonicalJsonStringify(outputNames)
        !== canonicalJsonStringify(["payload"])
      || payload.isSymbolicLink()
      || !payload.isDirectory()
      || realpathSync(payloadRoot) !== payloadRoot
      || (payload.mode & 0o7777) !== 0o700
      || payload.uid !== expectedUid
      || payload.gid !== owner.gid
      || canonicalJsonStringify(
        readdirSync(payloadRoot).sort(),
      ) !== canonicalJsonStringify([
        "dist",
        "package.json",
      ])
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        `${input.occurrence} output layout is not exact predependency payload`,
      );
    }
    const distRoot = path.join(payloadRoot, "dist");
    assertCompiledMetadataClearV2(
      input.capsule.admissionScope,
      payloadRoot,
      "payload",
      "directory",
    );
    assertCompiledMetadataClearV2(
      input.capsule.admissionScope,
      path.join(payloadRoot, "package.json"),
      "payload/package.json",
      "file",
    );
    const distTree = captureCompiledDistTreeV2(
      distRoot,
      input.capsule.admissionScope,
    );
    assertCompiledOutputTreeOwnershipV2(
      distRoot,
      distTree,
      input.sourceState.admissionScope,
    );
    const packageCapture = exactCompiledPackageJsonV2(
      path.join(payloadRoot, "package.json"),
      input.sourceState,
    );
    capturedPackageBytes = packageCapture.bytes;
    const result = input.hostEvidence.commandResult;
    assertCompiledCommandResultJoinsV2(
      result,
      input.sourceState,
      input.capsule,
      distTree,
    );
    if (
      input.hostEvidence
        .platformHostToolchainReceiptHash
        !== input.capsule.receipt.hostToolchain.receiptHash
      || input.hostEvidence.nodeIdentityHash
        !== input.capsule.receipt.hostToolchain.node.identityHash
      || input.hostEvidence.commandModuleHash
        !== input.commandModuleHash
      || input.hostEvidence.outputStageIdentityHash
        !== outputStagePhysicalIdentityHash
    ) {
      packageCapture.bytes.fill(0);
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_BUILD_FAILED",
        "Host build occurrence does not join exact host, Node and command authority",
      );
    }
    const binding =
      createPlatformReleasePredependencyOutputBindingV2({
        schema:
          "setfarm.platform-release-predependency-output-binding.v2",
        version: "2.0.0",
        sourceBindingHash:
          input.sourceState.core.source.bindingHash,
        admittedSha:
          input.sourceState.core.admittedSource.sha,
        sourceDateEpoch:
          input.sourceState.core.admittedSource
            .commitEpochSeconds,
        commandModuleHash: input.commandModuleHash,
        buildToolchainTreeBindingHash:
          input.capsule.materialized.treeBinding
            .bindingHash,
        compilerEntryHash:
          input.capsule.materialized.compiler
            .entryModuleHash,
        commandResultHash:
          hashPlatformReleaseBuildCommandResultV2(
            result,
          ),
        distTreeHash: distTree.treeHash,
        distTreePayloadHash: distTree.payloadHash,
        distFileCount: distTree.fileCount,
        distDirectoryCount: distTree.directoryCount,
        distTotalBytes: distTree.totalBytes,
        packageSourceRefHash:
          packageCapture.identity.sourceRefHash,
        packageContentHash:
          packageCapture.identity.contentHash,
        packageByteLength:
          packageCapture.identity.byteLength,
        outputLayout:
          "payload_dist_and_package_json_only",
        dependencyState: "absent",
        manifestState: "absent",
      });
    return Object.freeze({
      state: Object.freeze({
        occurrence: input.occurrence,
        slot: input.slot,
        hostEvidence: input.hostEvidence,
        outputStagePhysicalIdentityHash,
        stableHostProjectionHash:
          stableHostBuildEvidenceProjectionHashV2(
            input.hostEvidence,
          ),
        commandResult: result,
        distTree,
        packageIdentity: packageCapture.identity,
        binding,
      }),
      packageBytes: packageCapture.bytes,
    });
  } catch (error) {
    capturedPackageBytes?.fill(0);
    if (
      error instanceof
        PlatformReleaseCompiledOutputPairErrorV2
    ) throw error;
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      `${input.occurrence} compiled output could not be captured`,
      error,
    );
  }
}

function stableHostBuildEvidenceProjectionV2(
  evidence:
    PlatformReleaseHostNodeToolchainBuildEvidenceV2,
): Record<string, unknown> {
  const projection = {
    ...evidence,
  } as Record<string, unknown>;
  delete projection.evidenceHash;
  delete projection.outputStageIdentityHash;
  return projection;
}

function stableHostBuildEvidenceProjectionHashV2(
  evidence:
    PlatformReleaseHostNodeToolchainBuildEvidenceV2,
): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-stable-host-build-evidence-projection.v2",
    projection:
      stableHostBuildEvidenceProjectionV2(evidence),
  });
}

function assertCompiledOccurrenceEqualityV2(
  first: CapturedCompiledOccurrenceV2,
  second: CapturedCompiledOccurrenceV2,
): void {
  if (
    !canonicalJsonBytes(first.state.commandResult)
      .equals(canonicalJsonBytes(
        second.state.commandResult,
      ))
    || !canonicalJsonBytes(first.state.distTree)
      .equals(canonicalJsonBytes(second.state.distTree))
    || !first.packageBytes.equals(second.packageBytes)
    || !canonicalJsonBytes(first.state.binding)
      .equals(canonicalJsonBytes(second.state.binding))
    || !canonicalJsonBytes(
      stableHostBuildEvidenceProjectionV2(
        first.state.hostEvidence,
      ),
    ).equals(canonicalJsonBytes(
      stableHostBuildEvidenceProjectionV2(
        second.state.hostEvidence,
      ),
    ))
    || first.state.stableHostProjectionHash
      !== second.state.stableHostProjectionHash
    || first.state.hostEvidence.evidenceHash
      === second.state.hostEvidence.evidenceHash
    || first.state.hostEvidence.outputStageIdentityHash
      === second.state.hostEvidence.outputStageIdentityHash
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_EQUALITY_FAILED",
      "Independent builds did not reproduce canonical command, tree, package and non-occurrence process fields",
    );
  }
}

function compiledPairInspectionV2(
  sourceState: SourceStageStateV2,
  capsule: BuildToolchainCapsuleStateV2,
  first: CompiledOccurrenceStateV2,
  second: CompiledOccurrenceStateV2,
): PlatformReleaseCompiledOutputPairInspectionV2 {
  return createPlatformReleaseCompiledOutputPairInspectionV2({
    schema:
      "setfarm.platform-release-compiled-output-pair-inspection.v2",
    version: "2.0.0",
    authorityState:
      "candidate_compiled_output_pair_unverified",
    productionUse:
      "forbidden_until_dependency_materialization_and_fresh_release_verification",
    admissionScope: sourceState.admissionScope,
    lifecycle: "double_build_complete",
    sourceBindingHash:
      sourceState.core.source.bindingHash,
    buildToolchainReceiptHash:
      capsule.receipt.receiptHash,
    stableOutput: first.binding,
    occurrences: [
      {
        stageRef:
          "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2",
        hostBuildEvidenceHash:
          first.hostEvidence.evidenceHash,
        outputStagePhysicalIdentityHash:
          first.outputStagePhysicalIdentityHash,
        predependencyOutputBindingHash:
          first.binding.bindingHash,
        stableHostProjectionHash:
          first.stableHostProjectionHash,
      },
      {
        stageRef:
          "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2",
        hostBuildEvidenceHash:
          second.hostEvidence.evidenceHash,
        outputStagePhysicalIdentityHash:
          second.outputStagePhysicalIdentityHash,
        predependencyOutputBindingHash:
          second.binding.bindingHash,
        stableHostProjectionHash:
          second.stableHostProjectionHash,
      },
    ],
    equalityState:
      "canonical_command_results_dist_trees_and_package_bytes_equal",
  });
}

async function executeCompiledBuildOccurrenceV2(input: Readonly<{
  occurrence: "first" | "second";
  sourceState: SourceStageStateV2;
  buildToolchain:
    PlatformReleaseBuildToolchainCapsuleV2;
  capsule: BuildToolchainCapsuleStateV2;
  slot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  >;
  commandModuleHash: string;
}>): Promise<
  PlatformReleaseHostNodeToolchainBuildEvidenceV2
> {
  await revalidateBuildToolchainCapsuleForLifecycleV2(
    input.buildToolchain,
    ["double_build_running"],
  );
  if (
    input.sourceState.lifecycle !== "double_build_running"
    || readdirSync(input.slot.outputRoot.absolutePath)
      .length !== 0
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
      `${input.occurrence} output was not empty before build`,
    );
  }
  let evidence;
  try {
    evidence =
      await executePlatformReleaseHostNodeToolchainBuildInternalV2(
        input.capsule.hostToolchain,
        {
          sourceRoot: input.sourceState.stageRoot,
          outputRoot:
            input.slot.outputRoot.absolutePath,
          buildToolchainRoot:
            input.capsule.nodeModulesRoot,
          buildToolchainHash:
            input.capsule.materialized.treeBinding
              .treeHash,
          sourceSha:
            input.sourceState.core.admittedSource.sha,
          sourceDateEpoch:
            input.sourceState.core.admittedSource
              .commitEpochSeconds,
          commandModuleHash:
            input.commandModuleHash,
        },
      );
  } catch (error) {
    if (isPlatformReleaseHostAuthorityDriftV2(error)) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
        `${input.occurrence} authenticated host composition authority changed during build`,
        error,
      );
    }
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_BUILD_FAILED",
      `${input.occurrence} authenticated build occurrence failed`,
      error,
    );
  }
  await revalidateBuildToolchainCapsuleForLifecycleV2(
    input.buildToolchain,
    ["double_build_running"],
  );
  return evidence;
}

function destroyCompiledPairAfterFailureV2(
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
): never {
  try {
    disposeSourceOwnedPhysicalContextV2(sourceState);
  } catch (cleanupError) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_CLEANUP_FAILED",
      "Failed compiled-output transaction could not destroy every owned root",
      new AggregateError([
        primaryFailure,
        cleanupError,
      ]),
    );
  }
  throw primaryFailure;
}

function destroyReadyCompiledPairAfterFailureV2(
  pairState: CompiledOutputPairStateV2,
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
): never {
  if (
    pairState.ownership.lifecycle !== "ready"
    || sourceState.lifecycle !== "double_build_complete"
  ) {
    throw primaryFailure;
  }
  pairState.ownership.lifecycle = "invalidated";
  return destroyCompiledPairAfterFailureV2(
    sourceState,
    primaryFailure,
  );
}

async function materializeCompiledOutputPairV2(
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
  allocationFault?: SourceOwnedOutputAllocationFaultV2,
): Promise<PlatformReleaseCompiledOutputPairV2> {
  const values = exactCompiledOutputPairInputV2(input);
  let sourceState: SourceStageStateV2;
  let capsule: BuildToolchainCapsuleStateV2;
  try {
    sourceState = authenticState(values.sourceStage);
    capsule =
      authenticBuildToolchainCapsuleState(
        values.buildToolchain,
      );
  } catch (error) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_INPUT_INVALID",
      "Compiled output input capabilities are not authentic",
      error,
    );
  }
  const expectedSourceScope =
    expectedScope === "production_host"
      ? "production_candidate"
      : "test_fixture";
  if (
    capsule.sourceStage !== values.sourceStage
    || capsule.admissionScope !== expectedScope
    || sourceState.admissionScope !== expectedSourceScope
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
      "Compiled output source, toolchain and admission scopes do not form one context",
    );
  }
  if (
    expectedScope === "production_host"
    && sourceOwnedProcessOwnerV2().uid !== 0
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SCOPE_MISMATCH",
      "Production compiled outputs require a root-owned builder",
    );
  }
  if (
    !transitionSourceContextLifecycleV2(
      sourceState,
      "toolchain_materialized",
      "double_build_running",
    )
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_ALREADY_MATERIALIZED",
      "One source context can own one double-build transaction",
    );
  }
  let firstBeforeSecondPackageBytes:
    Buffer | undefined;
  let finalFirstPackageBytes: Buffer | undefined;
  let finalSecondPackageBytes: Buffer | undefined;
  try {
    const live =
      await revalidateBuildToolchainCapsuleForLifecycleV2(
        values.buildToolchain,
        ["double_build_running"],
      );
    if (
      live.sourceState !== sourceState
      || live.capsule !== capsule
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TOOLCHAIN_DRIFT",
        "Fresh source/toolchain authority changed before output allocation",
      );
    }
    const commandModuleHash =
      compiledCommandModuleHashV2(sourceState);
    const firstSlot = allocateSourceOwnedOutputRootV2(
      sourceState,
      "first",
      allocationFault,
    );
    const secondSlot = allocateSourceOwnedOutputRootV2(
      sourceState,
      "second",
    );
    const firstEvidence =
      await executeCompiledBuildOccurrenceV2({
        occurrence: "first",
        sourceState,
        buildToolchain: values.buildToolchain,
        capsule,
        slot: firstSlot,
        commandModuleHash,
      });
    const firstBeforeSecond =
      captureCompiledOccurrenceV2({
      occurrence: "first",
      sourceState,
      capsule,
      slot: firstSlot,
      commandModuleHash,
      hostEvidence: firstEvidence,
    });
    firstBeforeSecondPackageBytes =
      firstBeforeSecond.packageBytes;
    if (
      readdirSync(secondSlot.outputRoot.absolutePath)
        .length !== 0
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        "Second output changed before its build occurrence",
      );
    }
    const secondEvidence =
      await executeCompiledBuildOccurrenceV2({
        occurrence: "second",
        sourceState,
        buildToolchain: values.buildToolchain,
        capsule,
        slot: secondSlot,
        commandModuleHash,
      });
    await revalidateBuildToolchainCapsuleForLifecycleV2(
      values.buildToolchain,
      ["double_build_running"],
    );
    const finalFirst = captureCompiledOccurrenceV2({
      occurrence: "first",
      sourceState,
      capsule,
      slot: firstSlot,
      commandModuleHash,
      hostEvidence: firstEvidence,
    });
    finalFirstPackageBytes = finalFirst.packageBytes;
    const finalSecond = captureCompiledOccurrenceV2({
      occurrence: "second",
      sourceState,
      capsule,
      slot: secondSlot,
      commandModuleHash,
      hostEvidence: secondEvidence,
    });
    finalSecondPackageBytes = finalSecond.packageBytes;
    if (
      !sameCompiledOccurrenceV2(
        firstBeforeSecond.state,
        finalFirst.state,
      )
      || !firstBeforeSecond.packageBytes.equals(
        finalFirst.packageBytes,
      )
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        "First compiled output changed while the independent second build ran",
      );
    }
    assertCompiledOccurrenceEqualityV2(
      finalFirst,
      finalSecond,
    );
    const inspection = compiledPairInspectionV2(
      sourceState,
      capsule,
      finalFirst.state,
      finalSecond.state,
    );
    if (
      !transitionSourceContextLifecycleV2(
        sourceState,
        "double_build_running",
        "double_build_complete",
      )
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        "Source lifecycle changed before compiled-pair completion",
      );
    }
    return new PlatformReleaseCompiledOutputPairV2(
      compiledOutputPairConstructorCapabilityV2,
      Object.freeze({
        admissionScope: sourceState.admissionScope,
        sourceStage: values.sourceStage,
        buildToolchain: values.buildToolchain,
        first: finalFirst.state,
        second: finalSecond.state,
        inspection,
        ownership: {
          lifecycle: "ready" as const,
        },
      }),
    );
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseCompiledOutputPairErrorV2
      ? error
      : error instanceof
          PlatformReleaseBuildToolchainCapsuleErrorV2
        ? compiledOutputPairErrorFromBuildToolchainCapsuleV2(
          error,
          "Compiled-output transaction lost its exact source or build-toolchain authority",
        )
      : new PlatformReleaseCompiledOutputPairErrorV2(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_BUILD_FAILED",
        "Compiled-output transaction failed at an internal boundary",
        { cause: error },
      );
    if (
      sourceState.lifecycle === "double_build_running"
      || sourceState.lifecycle === "double_build_complete"
    ) {
      return destroyCompiledPairAfterFailureV2(
        sourceState,
        primary,
      );
    }
    throw primary;
  } finally {
    firstBeforeSecondPackageBytes?.fill(0);
    finalFirstPackageBytes?.fill(0);
    finalSecondPackageBytes?.fill(0);
  }
}

export async function materializePlatformReleaseCompiledOutputPairV2(
  input: Readonly<{
    sourceStage: AdmittedPlatformReleaseSourceStageV2;
    buildToolchain:
      PlatformReleaseBuildToolchainCapsuleV2;
  }>,
): Promise<PlatformReleaseCompiledOutputPairV2> {
  return materializeCompiledOutputPairV2(
    input,
    "production_host",
  );
}

export async function materializePlatformReleaseCompiledOutputPairV2ForTest(
  input: Readonly<{
    sourceStage: AdmittedPlatformReleaseSourceStageV2;
    buildToolchain:
      PlatformReleaseBuildToolchainCapsuleV2;
  }>,
): Promise<PlatformReleaseCompiledOutputPairV2> {
  return materializeCompiledOutputPairV2(
    input,
    "test_fixture",
  );
}

export async function materializePlatformReleaseCompiledOutputPairWithAllocationFaultForTestV2(
  input: Readonly<{
    sourceStage: AdmittedPlatformReleaseSourceStageV2;
    buildToolchain:
      PlatformReleaseBuildToolchainCapsuleV2;
  }>,
  fault: SourceOwnedOutputAllocationFaultV2,
): Promise<PlatformReleaseCompiledOutputPairV2> {
  if (
    typeof fault !== "object"
    || fault === null
    || Array.isArray(fault)
    || isProxy(fault)
    || Object.getPrototypeOf(fault) !== Object.prototype
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TEST_ONLY",
      "Allocation fault requires one exact test-only descriptor",
    );
  }
  const faultKeys = Reflect.ownKeys(fault);
  if (
    faultKeys.some((key) => typeof key !== "string")
    || canonicalJsonStringify(
      [...faultKeys].sort(),
    ) !== canonicalJsonStringify([
      "checkpoint",
      "observePath",
    ])
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TEST_ONLY",
      "Allocation fault requires one exact test-only descriptor",
    );
  }
  const descriptors =
    Object.getOwnPropertyDescriptors(fault);
  const checkpoint = descriptors.checkpoint;
  const observePath = descriptors.observePath;
  if (
    !checkpoint
    || !("value" in checkpoint)
    || !observePath
    || !("value" in observePath)
    || ![
      "after_first_parent_created",
      "after_first_output_created",
    ].includes(checkpoint.value as string)
    || typeof observePath.value !== "function"
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TEST_ONLY",
      "Allocation fault contains an invalid checkpoint or observer",
    );
  }
  return materializeCompiledOutputPairV2(
    input,
    "test_fixture",
    Object.freeze({
      checkpoint:
        checkpoint.value as
          SourceOwnedOutputAllocationFaultV2["checkpoint"],
      observePath:
        observePath.value as
          SourceOwnedOutputAllocationFaultV2["observePath"],
    }),
  );
}

export function inspectPlatformReleaseCompiledOutputPairV2(
  handle: PlatformReleaseCompiledOutputPairV2,
): PlatformReleaseCompiledOutputPairInspectionV2 {
  const state = authenticCompiledOutputPairStateV2(handle);
  if (state.ownership.lifecycle !== "ready") {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Compiled pair no longer owns its ready authority state",
    );
  }
  let sourceState: SourceStageStateV2;
  try {
    sourceState = authenticState(state.sourceStage);
  } catch (error) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Compiled pair source authority is no longer live",
      error,
    );
  }
  if (sourceState.lifecycle !== "double_build_complete") {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Compiled pair no longer owns its exact completed lifecycle",
    );
  }
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(state.inspection),
  );
}

function sameCompiledOccurrenceV2(
  left: CompiledOccurrenceStateV2,
  right: CompiledOccurrenceStateV2,
): boolean {
  return canonicalJsonBytes(left)
    .equals(canonicalJsonBytes(right));
}

export async function revalidatePlatformReleaseCompiledOutputPairV2(
  handle: PlatformReleaseCompiledOutputPairV2,
): Promise<PlatformReleaseCompiledOutputPairInspectionV2> {
  const state = authenticCompiledOutputPairStateV2(handle);
  const sourceState =
    sourceStageStatesV2.get(state.sourceStage);
  if (
    !sourceState
    || sourceState.lifecycle === "disposed"
    || state.ownership.lifecycle !== "ready"
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Compiled pair source authority is no longer live",
    );
  }
  if (sourceState.lifecycle !== "double_build_complete") {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Compiled pair no longer owns its exact completed lifecycle",
    );
  }
  let expectedCapsule: BuildToolchainCapsuleStateV2;
  try {
    expectedCapsule =
      authenticBuildToolchainCapsuleState(
        state.buildToolchain,
      );
  } catch (error) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
      "Compiled pair build-toolchain authority is no longer authentic",
      error,
    );
  }
  let firstBytes: Buffer | undefined;
  let secondBytes: Buffer | undefined;
  try {
    const live =
      await revalidateBuildToolchainCapsuleForLifecycleV2(
        state.buildToolchain,
        ["double_build_complete"],
      );
    if (
      state.ownership.lifecycle !== "ready"
      || sourceState.lifecycle !== "double_build_complete"
      || live.sourceState !== sourceState
      || live.capsule !== expectedCapsule
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        "Compiled pair lost its exact source, toolchain or ready ownership while revalidation was in flight",
      );
    }
    const commandModuleHash =
      compiledCommandModuleHashV2(sourceState);
    const first = captureCompiledOccurrenceV2({
      occurrence: "first",
      sourceState,
      capsule: live.capsule,
      slot: state.first.slot,
      commandModuleHash,
      hostEvidence: state.first.hostEvidence,
    });
    firstBytes = first.packageBytes;
    const second = captureCompiledOccurrenceV2({
      occurrence: "second",
      sourceState,
      capsule: live.capsule,
      slot: state.second.slot,
      commandModuleHash,
      hostEvidence: state.second.hostEvidence,
    });
    secondBytes = second.packageBytes;
    assertCompiledOccurrenceEqualityV2(first, second);
    if (
      !sameCompiledOccurrenceV2(
        first.state,
        state.first,
      )
      || !sameCompiledOccurrenceV2(
        second.state,
        state.second,
      )
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        "Fresh compiled outputs differ from issued pair authority",
      );
    }
    const inspection = compiledPairInspectionV2(
      sourceState,
      live.capsule,
      first.state,
      second.state,
    );
    if (
      canonicalJsonStringify(inspection)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        "Fresh compiled pair inspection differs from issued authority",
      );
    }
    return inspection;
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseCompiledOutputPairErrorV2
      ? error
      : error instanceof
          PlatformReleaseBuildToolchainCapsuleErrorV2
        ? compiledOutputPairErrorFromBuildToolchainCapsuleV2(
          error,
          "Compiled pair lost its exact source or build-toolchain authority",
        )
      : new PlatformReleaseCompiledOutputPairErrorV2(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_OUTPUT_INVALID",
        "Compiled pair failed fresh operational revalidation",
        { cause: error },
      );
    if (
      state.ownership.lifecycle === "ready"
      && sourceState.lifecycle
        === "double_build_complete"
    ) {
      return destroyReadyCompiledPairAfterFailureV2(
        state,
        sourceState,
        primary,
      );
    }
    if (
      sourceState.lifecycle !== "double_build_complete"
      && (
        !(primary instanceof
          PlatformReleaseCompiledOutputPairErrorV2)
        || primary.code
          !== "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT"
      )
    ) {
      return failCompiledOutputPair(
        "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_SOURCE_DRIFT",
        "Compiled pair lost ownership while fresh revalidation was in flight",
        primary,
      );
    }
    throw primary;
  } finally {
    firstBytes?.fill(0);
    secondBytes?.fill(0);
  }
}

function authenticDependencyMaterializedPairStateV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): DependencyMaterializedPairStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PlatformReleaseDependencyMaterializedPairV2.prototype
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HANDLE_UNAUTHENTICATED",
      "Dependency-materialized pair operation requires one authentic handle",
    );
  }
  const state =
    dependencyMaterializedPairStatesV2.get(handle);
  if (!state) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HANDLE_UNAUTHENTICATED",
      "Dependency-materialized pair operation requires one authentic handle",
    );
  }
  return state;
}

function claimCompiledPairForDependencyMaterializationV2(
  handle: PlatformReleaseCompiledOutputPairV2,
  expectedScope: "production_host" | "test_fixture",
): Readonly<{
  pair: CompiledOutputPairStateV2;
  sourceState: SourceStageStateV2;
  capsule: BuildToolchainCapsuleStateV2;
}> {
  let pair: CompiledOutputPairStateV2;
  let sourceState: SourceStageStateV2;
  let capsule: BuildToolchainCapsuleStateV2;
  try {
    pair = authenticCompiledOutputPairStateV2(handle);
    sourceState = authenticState(pair.sourceStage);
    capsule =
      authenticBuildToolchainCapsuleState(
        pair.buildToolchain,
      );
  } catch (error) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INPUT_INVALID",
      "Dependency materialization requires one authentic compiled-pair authority",
      error,
    );
  }
  const expectedSourceScope =
    expectedScope === "production_host"
      ? "production_candidate"
      : "test_fixture";
  if (
    pair.admissionScope !== expectedSourceScope
    || sourceState.admissionScope !== expectedSourceScope
    || capsule.admissionScope !== expectedScope
    || capsule.sourceStage !== pair.sourceStage
    || capsule.source.bindingHash
      !== sourceState.core.source.bindingHash
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH",
      "Compiled pair, source and build toolchain do not form one dependency-materialization scope",
    );
  }
  if (
    expectedScope === "production_host"
    && sourceOwnedProcessOwnerV2().uid !== 0
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SCOPE_MISMATCH",
      "Production dependency materialization requires the root-owned release producer",
    );
  }
  if (
    pair.ownership.lifecycle !== "ready"
    || sourceState.lifecycle !== "double_build_complete"
    || sourceState.ownedOutputRoots.cleanupState !== "open"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_ALREADY_CLAIMED",
      "One compiled pair can enter dependency materialization exactly once",
    );
  }
  if (
    !transitionSourceContextLifecycleV2(
      sourceState,
      "double_build_complete",
      "dependency_materializing",
    )
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_ALREADY_CLAIMED",
      "Compiled pair lost its source lifecycle before synchronous claim",
    );
  }
  pair.ownership.lifecycle = "consuming";
  return Object.freeze({
    pair,
    sourceState,
    capsule,
  });
}

async function revalidateCompiledPairDuringDependencyMaterializationV2(
  pair: CompiledOutputPairStateV2,
  sourceState: SourceStageStateV2,
  expectedCapsule: BuildToolchainCapsuleStateV2,
): Promise<void> {
  if (
    pair.ownership.lifecycle !== "consuming"
    || sourceState.lifecycle !== "dependency_materializing"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency transaction lost its claimed pair or source lifecycle",
    );
  }
  let firstBytes: Buffer | undefined;
  let secondBytes: Buffer | undefined;
  try {
    const live =
      await revalidateBuildToolchainCapsuleForLifecycleV2(
        pair.buildToolchain,
        ["dependency_materializing"],
      );
    if (
      pair.ownership.lifecycle !== "consuming"
      || sourceState.lifecycle !== "dependency_materializing"
      || live.sourceState !== sourceState
      || live.capsule !== expectedCapsule
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
        "Dependency transaction lost exact source or toolchain authority during revalidation",
      );
    }
    const commandModuleHash =
      compiledCommandModuleHashV2(sourceState);
    const first = captureCompiledOccurrenceV2({
      occurrence: "first",
      sourceState,
      capsule: live.capsule,
      slot: pair.first.slot,
      commandModuleHash,
      hostEvidence: pair.first.hostEvidence,
    });
    firstBytes = first.packageBytes;
    const second = captureCompiledOccurrenceV2({
      occurrence: "second",
      sourceState,
      capsule: live.capsule,
      slot: pair.second.slot,
      commandModuleHash,
      hostEvidence: pair.second.hostEvidence,
    });
    secondBytes = second.packageBytes;
    assertCompiledOccurrenceEqualityV2(first, second);
    if (
      !sameCompiledOccurrenceV2(
        first.state,
        pair.first,
      )
      || !sameCompiledOccurrenceV2(
        second.state,
        pair.second,
      )
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        "Predependency outputs changed after the compiled pair was claimed",
      );
    }
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    if (
      error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
    ) {
      throw dependencyPairErrorFromBuildToolchainCapsuleV2(
        error,
        "Claimed compiled pair lost its exact source or build-toolchain authority",
      );
    }
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      "Claimed compiled pair failed phase-aware fresh revalidation",
      error,
    );
  } finally {
    firstBytes?.fill(0);
    secondBytes?.fill(0);
  }
}

function assertProductionDependencyScopesDisjointV2(
  sourceState: SourceStageStateV2,
  first: PrivateProductionDependencyInstallScopeV2,
  second: PrivateProductionDependencyInstallScopeV2,
): void {
  const outputAnchors = [
    requireSourceOwnedOutputRootV2(
      sourceState,
      "first",
    ).privateParent,
    requireSourceOwnedOutputRootV2(
      sourceState,
      "second",
    ).privateParent,
  ];
  const scratchAnchors = [
    first.environmentAnchor,
    first.installAnchor,
    second.environmentAnchor,
    second.installAnchor,
  ];
  const everyAnchor = [
    sourceState.contextAnchor,
    ...outputAnchors,
    ...scratchAnchors,
  ];
  if (
    scratchAnchors.some((scratch) =>
      everyAnchor.some((other) =>
        other !== scratch
        && !sourceOwnedRootsAreDisjointV2(
          scratch,
          other,
        )))
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
      "Production dependency occurrences are not physically disjoint",
    );
  }
}

async function executeProductionDependencyOccurrenceV2(
  input: Readonly<{
    occurrence: "first" | "second";
    scope: PrivateProductionDependencyInstallScopeV2;
    pair: CompiledOutputPairStateV2;
    sourceState: SourceStageStateV2;
    capsule: BuildToolchainCapsuleStateV2;
  }>,
): Promise<Readonly<{
  hostEvidence:
    PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2;
  materialized:
    PlatformReleaseProductionDependencyMaterializationV2;
}>> {
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    input.scope,
    "pre-occurrence authority fence",
  );
  await revalidateCompiledPairDuringDependencyMaterializationV2(
    input.pair,
    input.sourceState,
    input.capsule,
  );
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    input.scope,
    "post-predecessor authority fence",
  );
  let hostEvidence:
    PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2;
  try {
    hostEvidence =
      await executePlatformReleaseHostNodeToolchainProductionNpmCiInternalV2(
        input.capsule.hostToolchain,
        {
          privateRoot: input.scope.environmentRoot,
          projectRoot: input.scope.projectRoot,
          environment: input.scope.environment,
        },
      );
  } catch (error) {
    try {
      assertPrivateProductionDependencyInstallScopeCurrentV2(
        input.scope,
        "failed authenticated npm occurrence",
      );
    } catch (scopeError) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_INSTALL_SCOPE_INVALID",
        `${input.occurrence} dependency scratch authority changed during authenticated npm`,
        new AggregateError([error, scopeError]),
      );
    }
    return failDependencyPairFromHostToolchainV2(
      error,
      `${input.occurrence} authenticated production npm occurrence failed`,
    );
  }
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    input.scope,
    "post-authenticated npm occurrence",
  );
  await revalidateCompiledPairDuringDependencyMaterializationV2(
    input.pair,
    input.sourceState,
    input.capsule,
  );
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    input.scope,
    "post-npm predecessor authority fence",
  );
  if (
    hostEvidence.platformHostToolchainReceiptHash
      !== input.capsule.receipt.hostToolchain.receiptHash
    || hostEvidence.nodeIdentityHash
      !== input.capsule.receipt.hostToolchain.node.identityHash
    || hostEvidence.npmClosureHash
      !== input.capsule.receipt.hostToolchain.npm.closureHash
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
      `${input.occurrence} npm occurrence does not join the exact host Node/npm receipt`,
    );
  }
  let materialized:
    PlatformReleaseProductionDependencyMaterializationV2;
  try {
    materialized =
      materializePlatformReleaseProductionDependenciesInternalV2({
        admissionScope: input.capsule.admissionScope,
        projectRoot: input.scope.projectRoot,
        source: input.sourceState.core.source,
        hostPlatform:
          input.capsule.receipt.hostToolchain.host.platform,
        hostArchitecture:
          input.capsule.receipt.hostToolchain.host.architecture,
        hostToolchain:
          input.capsule.receipt.hostToolchain,
      });
    if (
      !canonicalJsonBytes(
        materialized.lockAuthority,
      ).equals(canonicalJsonBytes(
        input.scope.preNpmLockAuthority,
      ))
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_AUTHORITY_MISMATCH",
        `${input.occurrence} production lock authority changed across authenticated npm`,
      );
    }
    assertPrivateProductionDependencyInstallScopeCurrentV2(
      input.scope,
      "post-production-tree materialization",
    );
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    return failDependencyPairFromMaterializationV2(
      error,
      `${input.occurrence} npm tree failed every-and-only production verification`,
    );
  }
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    input.scope,
    "pre-final predecessor authority fence",
  );
  await revalidateCompiledPairDuringDependencyMaterializationV2(
    input.pair,
    input.sourceState,
    input.capsule,
  );
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    input.scope,
    "post-final predecessor authority fence",
  );
  return Object.freeze({
    hostEvidence,
    materialized,
  });
}

function revalidateScratchProductionDependencyOccurrenceV2(
  scope: PrivateProductionDependencyInstallScopeV2,
  sourceState: SourceStageStateV2,
  capsule: BuildToolchainCapsuleStateV2,
  materialized:
    PlatformReleaseProductionDependencyMaterializationV2,
): void {
  try {
    assertPrivateProductionDependencyInstallScopeCurrentV2(
      scope,
      "sealed scratch revalidation",
    );
    revalidatePlatformReleaseProductionDependenciesInternalV2({
      admissionScope: capsule.admissionScope,
      nodeModulesRoot: path.join(
        scope.projectRoot,
        "node_modules",
      ),
      source: sourceState.core.source,
      hostToolchain: capsule.receipt.hostToolchain,
      lockAuthority: materialized.lockAuthority,
      productionClosure: materialized.productionClosure,
      dependencyTree: materialized.dependencyTree,
      dependencyTreeBinding:
        materialized.dependencyTreeBinding,
      productionGraph: materialized.productionGraph,
      materializationReceipt:
        materialized.materializationReceipt,
    });
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    return failDependencyPairFromMaterializationV2(
      error,
      `${scope.occurrence} sealed scratch dependency tree changed`,
    );
  }
}

function assertIndependentProductionDependencyEqualityV2(
  first: Readonly<{
    hostEvidence:
      PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2;
    materialized:
      PlatformReleaseProductionDependencyMaterializationV2;
  }>,
  second: Readonly<{
    hostEvidence:
      PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2;
    materialized:
      PlatformReleaseProductionDependencyMaterializationV2;
  }>,
): void {
  const stableFirst = {
    lockAuthority: first.materialized.lockAuthority,
    productionClosure: first.materialized.productionClosure,
    hiddenLockRawHash:
      first.materialized.hiddenLockRawHash,
    rawInstallMembershipHash:
      first.materialized.rawInstallMembershipHash,
    installedPackageMembershipHash:
      first.materialized.installedPackageMembershipHash,
    dependencyTree: first.materialized.dependencyTree,
    dependencyTreeBinding:
      first.materialized.dependencyTreeBinding,
    productionGraph: first.materialized.productionGraph,
    materializationReceipt:
      first.materialized.materializationReceipt,
  };
  const stableSecond = {
    lockAuthority: second.materialized.lockAuthority,
    productionClosure: second.materialized.productionClosure,
    hiddenLockRawHash:
      second.materialized.hiddenLockRawHash,
    rawInstallMembershipHash:
      second.materialized.rawInstallMembershipHash,
    installedPackageMembershipHash:
      second.materialized.installedPackageMembershipHash,
    dependencyTree: second.materialized.dependencyTree,
    dependencyTreeBinding:
      second.materialized.dependencyTreeBinding,
    productionGraph: second.materialized.productionGraph,
    materializationReceipt:
      second.materialized.materializationReceipt,
  };
  if (
    !canonicalJsonBytes(stableFirst)
      .equals(canonicalJsonBytes(stableSecond))
    || first.hostEvidence.evidenceHash
      === second.hostEvidence.evidenceHash
    || first.hostEvidence.projectScopeHash
      === second.hostEvidence.projectScopeHash
    || first.hostEvidence.projectPhysicalIdentityHash
      === second.hostEvidence.projectPhysicalIdentityHash
    || first.hostEvidence.environmentHash
      === second.hostEvidence.environmentHash
    || first.hostEvidence.environmentScopeHash
      === second.hostEvidence.environmentScopeHash
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_EQUALITY_FAILED",
      "Independent npm occurrences did not produce distinct process scopes and equal canonical production authorities",
    );
  }
}

function dependencyTreePhysicalIdentityHashV2(
  nodeModulesRoot: string,
  dependencyTreeBindingHash: string,
): string {
  try {
    const stat = lstatSync(nodeModulesRoot);
    const owner = sourceOwnedProcessOwnerV2();
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(nodeModulesRoot) !== nodeModulesRoot
      || (stat.mode & 0o7777) !== 0o555
      || stat.uid !== owner.uid
      || stat.gid !== owner.gid
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        "Adopted dependency root lost its exact sealed physical identity",
      );
    }
    return hashCanonicalJson({
      schema:
        "setfarm.platform-release-dependency-tree-physical-identity.v2",
      device: String(stat.dev),
      inode: String(stat.ino),
      ownerUid: stat.uid,
      ownerGid: stat.gid,
      mode: "0555",
      dependencyTreeBindingHash,
    });
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      "Adopted dependency root could not be physically authenticated",
      error,
    );
  }
}

function captureDependencyMaterializedOccurrenceV2(
  input: Readonly<{
    occurrence: "first" | "second";
    pair: CompiledOutputPairStateV2;
    sourceState: SourceStageStateV2;
    capsule: BuildToolchainCapsuleStateV2;
    hostEvidence:
      PlatformReleaseHostNodeToolchainProductionNpmCiEvidenceV2;
    materialized:
      PlatformReleaseProductionDependencyMaterializationV2;
  }>,
): DependencyMaterializedOccurrenceStateV2 {
  const compiled = input.occurrence === "first"
    ? input.pair.first
    : input.pair.second;
  let packageBytes: Buffer | undefined;
  try {
    const currentSlot =
      requireSourceOwnedOutputRootV2(
        input.sourceState,
        input.occurrence,
      );
    if (currentSlot !== compiled.slot) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${input.occurrence} dependency output no longer owns its exact compiled parent and output anchors`,
      );
    }
    const outputRoot =
      compiled.slot.outputRoot.absolutePath;
    const payloadRoot = path.join(outputRoot, "payload");
    const nodeModulesRoot =
      path.join(payloadRoot, "node_modules");
    if (
      canonicalJsonStringify(
        readdirSync(outputRoot).sort(),
      ) !== canonicalJsonStringify(["payload"])
      || canonicalJsonStringify(
        readdirSync(payloadRoot).sort(),
      ) !== canonicalJsonStringify([
        "dist",
        "node_modules",
        "package.json",
      ])
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${input.occurrence} dependency output layout is not exact`,
      );
    }
    const distTree = captureCompiledDistTreeV2(
      path.join(payloadRoot, "dist"),
      input.capsule.admissionScope,
    );
    assertCompiledOutputTreeOwnershipV2(
      path.join(payloadRoot, "dist"),
      distTree,
      input.sourceState.admissionScope,
    );
    const packageCapture = exactCompiledPackageJsonV2(
      path.join(payloadRoot, "package.json"),
      input.sourceState,
    );
    packageBytes = packageCapture.bytes;
    if (
      canonicalJsonStringify(distTree)
        !== canonicalJsonStringify(compiled.distTree)
      || canonicalJsonStringify(packageCapture.identity)
        !== canonicalJsonStringify(
          compiled.packageIdentity,
        )
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${input.occurrence} dist or package bytes changed during dependency adoption`,
      );
    }
    try {
      revalidatePlatformReleaseProductionDependenciesInternalV2({
        admissionScope: input.capsule.admissionScope,
        nodeModulesRoot,
        source: input.sourceState.core.source,
        hostToolchain:
          input.capsule.receipt.hostToolchain,
        lockAuthority:
          input.materialized.lockAuthority,
        productionClosure:
          input.materialized.productionClosure,
        dependencyTree:
          input.materialized.dependencyTree,
        dependencyTreeBinding:
          input.materialized.dependencyTreeBinding,
        productionGraph:
          input.materialized.productionGraph,
        materializationReceipt:
          input.materialized.materializationReceipt,
      });
    } catch (error) {
      return failDependencyPairFromMaterializationV2(
        error,
        `${input.occurrence} adopted dependency tree failed fresh reproduction`,
      );
    }
    const physicalIdentityHash =
      dependencyTreePhysicalIdentityHashV2(
        nodeModulesRoot,
        input.materialized.dependencyTreeBinding
          .bindingHash,
      );
    const binding =
      createPlatformReleaseDependencyOutputBindingV2({
        schema:
          "setfarm.platform-release-dependency-output-binding.v2",
        version: "2.0.0",
        sourceBindingHash:
          input.sourceState.core.source.bindingHash,
        predependencyOutputBindingHash:
          compiled.binding.bindingHash,
        distTreeHash: distTree.treeHash,
        distTreePayloadHash: distTree.payloadHash,
        distFileCount: distTree.fileCount,
        distDirectoryCount: distTree.directoryCount,
        distTotalBytes: distTree.totalBytes,
        packageSourceRefHash:
          packageCapture.identity.sourceRefHash,
        packageContentHash:
          packageCapture.identity.contentHash,
        packageByteLength:
          packageCapture.identity.byteLength,
        dependencyTree:
          input.materialized.dependencyTreeBinding,
        productionClosureHash:
          input.materialized.productionClosure
            .closureHash,
        productionClosureContractHash:
          input.materialized.productionClosure
            .contractHash,
        productionResolutionGraphHash:
          input.materialized.productionGraph
            .resolutionGraphHash,
        npmMaterializationReceiptHash:
          input.materialized.materializationReceipt
            .receiptHash,
        outputLayout:
          "payload_dist_node_modules_and_package_json_only",
        dependencyState:
          "sealed_every_and_only_root_reachable_production_closure",
        manifestState: "absent",
      });
    return Object.freeze({
      occurrence: input.occurrence,
      compiled,
      hostEvidence: input.hostEvidence,
      materialized: input.materialized,
      dependencyTreePhysicalIdentityHash:
        physicalIdentityHash,
      binding,
    });
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      `${input.occurrence} dependency-materialized output could not be captured`,
      error,
    );
  } finally {
    packageBytes?.fill(0);
  }
}

function assertDependencyMaterializedOccurrenceEqualityV2(
  first: DependencyMaterializedOccurrenceStateV2,
  second: DependencyMaterializedOccurrenceStateV2,
): void {
  if (
    !canonicalJsonBytes(first.binding)
      .equals(canonicalJsonBytes(second.binding))
    || !canonicalJsonBytes(first.materialized)
      .equals(canonicalJsonBytes(second.materialized))
    || first.hostEvidence.evidenceHash
      === second.hostEvidence.evidenceHash
    || first.dependencyTreePhysicalIdentityHash
      === second.dependencyTreePhysicalIdentityHash
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_EQUALITY_FAILED",
      "Adopted dependency occurrences lack independent physical evidence or equal stable output authority",
    );
  }
}

function dependencyMaterializedPairInspectionV2(
  sourceState: SourceStageStateV2,
  capsule: BuildToolchainCapsuleStateV2,
  pair: CompiledOutputPairStateV2,
  first: DependencyMaterializedOccurrenceStateV2,
  second: DependencyMaterializedOccurrenceStateV2,
): PlatformReleaseDependencyMaterializedPairInspectionV2 {
  return createPlatformReleaseDependencyMaterializedPairInspectionV2({
    schema:
      "setfarm.platform-release-dependency-materialized-pair-inspection.v2",
    version: "2.0.0",
    authorityState:
      "candidate_dependency_materialized_pair_unverified",
    productionUse:
      "forbidden_until_complete_release_composition_and_fresh_release_verification",
    admissionScope: sourceState.admissionScope,
    lifecycle: "dependency_materializing",
    sourceBindingHash:
      sourceState.core.source.bindingHash,
    buildToolchainReceiptHash:
      capsule.receipt.receiptHash,
    compiledOutputPairInspectionHash:
      pair.inspection.inspectionHash,
    compiledOutputPair: pair.inspection,
    stableOutput: first.binding,
    occurrences: [
      {
        stageRef:
          "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
        hostDependencyInstallEvidenceHash:
          first.hostEvidence.evidenceHash,
        dependencyTreePhysicalIdentityHash:
          first.dependencyTreePhysicalIdentityHash,
        dependencyOutputBindingHash:
          first.binding.bindingHash,
        npmMaterializationReceiptHash:
          first.materialized.materializationReceipt
            .receiptHash,
        productionClosureHash:
          first.materialized.productionClosure
            .closureHash,
        productionClosureContractHash:
          first.materialized.productionClosure
            .contractHash,
        productionResolutionGraphHash:
          first.materialized.productionGraph
            .resolutionGraphHash,
        projectScopeHash:
          first.hostEvidence.projectScopeHash,
        projectPhysicalIdentityHash:
          first.hostEvidence.projectPhysicalIdentityHash,
        environmentHash:
          first.hostEvidence.environmentHash,
        environmentScopeHash:
          first.hostEvidence.environmentScopeHash,
      },
      {
        stageRef:
          "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
        hostDependencyInstallEvidenceHash:
          second.hostEvidence.evidenceHash,
        dependencyTreePhysicalIdentityHash:
          second.dependencyTreePhysicalIdentityHash,
        dependencyOutputBindingHash:
          second.binding.bindingHash,
        npmMaterializationReceiptHash:
          second.materialized.materializationReceipt
            .receiptHash,
        productionClosureHash:
          second.materialized.productionClosure
            .closureHash,
        productionClosureContractHash:
          second.materialized.productionClosure
            .contractHash,
        productionResolutionGraphHash:
          second.materialized.productionGraph
            .resolutionGraphHash,
        projectScopeHash:
          second.hostEvidence.projectScopeHash,
        projectPhysicalIdentityHash:
          second.hostEvidence.projectPhysicalIdentityHash,
        environmentHash:
          second.hostEvidence.environmentHash,
        environmentScopeHash:
          second.hostEvidence.environmentScopeHash,
      },
    ],
    equalityState:
      "independent_processes_and_physical_trees_with_equal_canonical_dependency_graph_receipt_and_complete_output",
  });
}

function runDependencyMaterializationFaultForTestV2(
  fault:
    PlatformReleaseDependencyMaterializationFaultForTestV2
    | undefined,
  checkpoint:
    PlatformReleaseDependencyMaterializationFaultForTestV2["checkpoint"],
  absolutePath: string,
  throwAfterObservation = true,
): void {
  if (fault?.checkpoint !== checkpoint) return;
  fault.observePath(absolutePath);
  if (throwAfterObservation) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      `Injected test-only dependency materialization fault at ${checkpoint}`,
    );
  }
}

function adoptProductionDependencyTreeV2(
  scope: PrivateProductionDependencyInstallScopeV2,
  compiled: CompiledOccurrenceStateV2,
  fault?:
    PlatformReleaseDependencyMaterializationFaultForTestV2,
): void {
  assertPrivateProductionDependencyInstallScopeCurrentV2(
    scope,
    "dependency-tree adoption",
  );
  const source = path.join(
    scope.projectRoot,
    "node_modules",
  );
  const destination = path.join(
    compiled.slot.outputRoot.absolutePath,
    "payload",
    "node_modules",
  );
  const destinationParent = path.dirname(destination);
  try {
    lstatSync(destination);
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      `${scope.occurrence} output already contains a dependency root`,
    );
  } catch (error) {
    if (
      error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    ) throw error;
    if (!isMissingPathErrorV2(error)) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${scope.occurrence} dependency destination absence could not be established`,
        error,
      );
    }
  }
  try {
    assertSourceOwnedPrivateDirectoryCurrentV2(
      scope.installAnchor,
      `${scope.occurrence} dependency install root`,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
    );
    assertSourceOwnedPrivateDirectoryCurrentV2(
      compiled.slot.privateParent,
      `${scope.occurrence} compiled-output private parent`,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
    );
    assertSourceOwnedPrivateDirectoryCurrentV2(
      compiled.slot.outputRoot,
      `${scope.occurrence} compiled-output root`,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
    );
    const owner = sourceOwnedProcessOwnerV2();
    const sourceBefore = lstatSync(source);
    const project = lstatSync(scope.projectRoot);
    const destinationParentBefore =
      lstatSync(destinationParent);
    if (
      sourceBefore.isSymbolicLink()
      || !sourceBefore.isDirectory()
      || realpathSync(source) !== source
      || (sourceBefore.mode & 0o7777) !== 0o555
      || sourceBefore.uid !== owner.uid
      || sourceBefore.gid !== owner.gid
      || project.isSymbolicLink()
      || !project.isDirectory()
      || realpathSync(scope.projectRoot)
        !== scope.projectRoot
      || (project.mode & 0o7777) !== 0o700
      || project.uid !== owner.uid
      || project.gid !== owner.gid
      || destinationParentBefore.isSymbolicLink()
      || !destinationParentBefore.isDirectory()
      || realpathSync(destinationParent)
        !== destinationParent
      || (destinationParentBefore.mode & 0o7777) !== 0o700
      || destinationParentBefore.uid !== owner.uid
      || destinationParentBefore.gid !== owner.gid
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${scope.occurrence} dependency adoption roots lost exact ownership, identity or mode`,
      );
    }
    // Darwin rename(2) refuses a read-only directory even when both parents
    // are writable. Open only the already-verified root for this synchronous
    // rename window, then reseal the same inode at its destination.
    chmodSync(source, 0o700);
    runDependencyMaterializationFaultForTestV2(
      fault,
      scope.occurrence === "first"
        ? "after_first_dependency_root_opened"
        : "after_second_dependency_root_opened",
      source,
    );
    const sourceOpened = lstatSync(source);
    if (
      sourceOpened.dev !== sourceBefore.dev
      || sourceOpened.ino !== sourceBefore.ino
      || (sourceOpened.mode & 0o7777) !== 0o700
      || sourceOpened.uid !== sourceBefore.uid
      || sourceOpened.gid !== sourceBefore.gid
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${scope.occurrence} verified dependency root changed while opening its atomic adoption window`,
      );
    }
    renameSync(source, destination);
    runDependencyMaterializationFaultForTestV2(
      fault,
      scope.occurrence === "first"
        ? "after_first_dependency_root_adopted"
        : "after_second_dependency_root_adopted",
      destination,
    );
    const adopted = lstatSync(destination);
    if (
      adopted.isSymbolicLink()
      || !adopted.isDirectory()
      || realpathSync(destination) !== destination
      || adopted.dev !== sourceBefore.dev
      || adopted.ino !== sourceBefore.ino
      || (adopted.mode & 0o7777) !== 0o700
      || adopted.uid !== sourceBefore.uid
      || adopted.gid !== sourceBefore.gid
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${scope.occurrence} adopted dependency root is not the verified source inode`,
      );
    }
    chmodSync(destination, 0o555);
    runDependencyMaterializationFaultForTestV2(
      fault,
      scope.occurrence === "first"
        ? "after_first_dependency_root_resealed"
        : "after_second_dependency_root_resealed",
      destination,
    );
    const resealed = lstatSync(destination);
    if (
      resealed.dev !== sourceBefore.dev
      || resealed.ino !== sourceBefore.ino
      || (resealed.mode & 0o7777) !== 0o555
      || resealed.uid !== sourceBefore.uid
      || resealed.gid !== sourceBefore.gid
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        `${scope.occurrence} adopted dependency root could not restore its exact seal`,
      );
    }
    fsyncDirectory(destination);
    fsyncDirectory(path.dirname(destination));
    fsyncDirectory(scope.projectRoot);
  } catch (error) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      `${scope.occurrence} verified dependency tree could not be atomically adopted`,
      error,
    );
  }
}

function cleanupProductionDependencyScopesV2(
  scopes:
    readonly PrivateProductionDependencyInstallScopeV2[],
): readonly unknown[] {
  const errors: unknown[] = [];
  for (const scope of [...scopes].reverse()) {
    if (
      scope.cleanup.state === "cleaned"
      || scope.cleanup.state === "cleanup_failed"
    ) {
      continue;
    }
    if (scope.cleanup.state === "cleaning") {
      errors.push(
        new PlatformReleaseDependencyMaterializedPairErrorV2(
          "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
          `${scope.occurrence} dependency scratch cleanup was re-entered`,
        ),
      );
      continue;
    }
    try {
      cleanupPrivateProductionDependencyInstallScopeV2(
        scope,
      );
    } catch (error) {
      errors.push(error);
    }
  }
  return Object.freeze(errors);
}

function destroyDependencyPairAfterFailureV2(
  pair: CompiledOutputPairStateV2,
  sourceState: SourceStageStateV2,
  scopes:
    readonly PrivateProductionDependencyInstallScopeV2[],
  primaryFailure: unknown,
): never {
  pair.ownership.lifecycle = "invalidated";
  const cleanupErrors = [
    ...cleanupProductionDependencyScopesV2(scopes),
  ];
  try {
    disposeSourceOwnedPhysicalContextV2(sourceState);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
      "Failed dependency transaction could not destroy every scratch, output and source root",
      new AggregateError([
        primaryFailure,
        ...cleanupErrors,
      ]),
    );
  }
  throw primaryFailure;
}

async function materializeDependencyMaterializedPairV2(
  handle: PlatformReleaseCompiledOutputPairV2,
  expectedScope: "production_host" | "test_fixture",
  fault?:
    PlatformReleaseDependencyMaterializationFaultForTestV2,
): Promise<PlatformReleaseDependencyMaterializedPairV2> {
  const claimed =
    claimCompiledPairForDependencyMaterializationV2(
      handle,
      expectedScope,
    );
  const scopes:
    PrivateProductionDependencyInstallScopeV2[] = [];
  try {
    await revalidateCompiledPairDuringDependencyMaterializationV2(
      claimed.pair,
      claimed.sourceState,
      claimed.capsule,
    );
    const firstScope =
      createPrivateProductionDependencyInstallScopeV2(
        claimed.sourceState,
        "first",
      );
    scopes.push(firstScope);
    const secondScope =
      createPrivateProductionDependencyInstallScopeV2(
        claimed.sourceState,
        "second",
      );
    scopes.push(secondScope);
    assertProductionDependencyScopesDisjointV2(
      claimed.sourceState,
      firstScope,
      secondScope,
    );
    const first =
      await executeProductionDependencyOccurrenceV2({
        occurrence: "first",
        scope: firstScope,
        pair: claimed.pair,
        sourceState: claimed.sourceState,
        capsule: claimed.capsule,
      });
    const second =
      await executeProductionDependencyOccurrenceV2({
        occurrence: "second",
        scope: secondScope,
        pair: claimed.pair,
        sourceState: claimed.sourceState,
        capsule: claimed.capsule,
      });
    revalidateScratchProductionDependencyOccurrenceV2(
      firstScope,
      claimed.sourceState,
      claimed.capsule,
      first.materialized,
    );
    revalidateScratchProductionDependencyOccurrenceV2(
      secondScope,
      claimed.sourceState,
      claimed.capsule,
      second.materialized,
    );
    assertIndependentProductionDependencyEqualityV2(
      first,
      second,
    );
    await revalidateCompiledPairDuringDependencyMaterializationV2(
      claimed.pair,
      claimed.sourceState,
      claimed.capsule,
    );
    runDependencyMaterializationFaultForTestV2(
      fault,
      "after_final_async_fence",
      firstScope.projectRoot,
      false,
    );
    if (
      claimed.pair.ownership.lifecycle !== "consuming"
      || claimed.sourceState.lifecycle
        !== "dependency_materializing"
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        "Dependency transaction lost ownership before atomic adoption",
      );
    }
    revalidateScratchProductionDependencyOccurrenceV2(
      firstScope,
      claimed.sourceState,
      claimed.capsule,
      first.materialized,
    );
    revalidateScratchProductionDependencyOccurrenceV2(
      secondScope,
      claimed.sourceState,
      claimed.capsule,
      second.materialized,
    );

    adoptProductionDependencyTreeV2(
      firstScope,
      claimed.pair.first,
      fault,
    );
    adoptProductionDependencyTreeV2(
      secondScope,
      claimed.pair.second,
      fault,
    );
    const capturedFirst =
      captureDependencyMaterializedOccurrenceV2({
        occurrence: "first",
        pair: claimed.pair,
        sourceState: claimed.sourceState,
        capsule: claimed.capsule,
        hostEvidence: first.hostEvidence,
        materialized: first.materialized,
      });
    const capturedSecond =
      captureDependencyMaterializedOccurrenceV2({
        occurrence: "second",
        pair: claimed.pair,
        sourceState: claimed.sourceState,
        capsule: claimed.capsule,
        hostEvidence: second.hostEvidence,
        materialized: second.materialized,
      });
    assertDependencyMaterializedOccurrenceEqualityV2(
      capturedFirst,
      capturedSecond,
    );
    const inspection =
      dependencyMaterializedPairInspectionV2(
        claimed.sourceState,
        claimed.capsule,
        claimed.pair,
        capturedFirst,
        capturedSecond,
      );
    runDependencyMaterializationFaultForTestV2(
      fault,
      "before_scratch_cleanup",
      firstScope.environmentRoot,
      false,
    );
    const cleanupErrors =
      cleanupProductionDependencyScopesV2(scopes);
    if (cleanupErrors.length > 0) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        "Successful dependency outputs could not release their private scratch roots",
        new AggregateError(cleanupErrors),
      );
    }
    runDependencyMaterializationFaultForTestV2(
      fault,
      "after_scratch_cleanup_before_registration",
      claimed.pair.first.slot.outputRoot.absolutePath,
    );
    const next =
      new PlatformReleaseDependencyMaterializedPairV2(
        dependencyMaterializedPairConstructorCapabilityV2,
        Object.freeze({
          admissionScope:
            claimed.sourceState.admissionScope,
          sourceStage: claimed.pair.sourceStage,
          buildToolchain:
            claimed.pair.buildToolchain,
          compiledOutputPair: handle,
          first: capturedFirst,
          second: capturedSecond,
          inspection,
          ownership: {
            lifecycle: "ready" as const,
          },
        }),
      );
    claimed.pair.ownership.lifecycle = "consumed";
    runDependencyMaterializationFaultForTestV2(
      fault,
      "after_registration_and_predecessor_consumption_before_return",
      claimed.pair.first.slot.outputRoot.absolutePath,
    );
    return next;
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseDependencyMaterializedPairErrorV2
      ? error
      : error instanceof
          PlatformReleaseBuildToolchainCapsuleErrorV2
        ? dependencyPairErrorFromBuildToolchainCapsuleV2(
          error,
          "Dependency pair lost its exact source or build-toolchain authority",
        )
      : new PlatformReleaseDependencyMaterializedPairErrorV2(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        "Dependency-materialized pair transaction failed at an internal boundary",
        { cause: error },
      );
    if (
      claimed.pair.ownership.lifecycle === "consuming"
      || claimed.pair.ownership.lifecycle === "consumed"
      || claimed.sourceState.lifecycle
        === "dependency_materializing"
    ) {
      return destroyDependencyPairAfterFailureV2(
        claimed.pair,
        claimed.sourceState,
        scopes,
        primary,
      );
    }
    throw primary;
  }
}

export async function materializePlatformReleaseDependencyMaterializedPairV2(
  handle: PlatformReleaseCompiledOutputPairV2,
): Promise<PlatformReleaseDependencyMaterializedPairV2> {
  return materializeDependencyMaterializedPairV2(
    handle,
    "production_host",
  );
}

export async function materializePlatformReleaseDependencyMaterializedPairForTestV2(
  handle: PlatformReleaseCompiledOutputPairV2,
): Promise<PlatformReleaseDependencyMaterializedPairV2> {
  return materializeDependencyMaterializedPairV2(
    handle,
    "test_fixture",
  );
}

export async function materializePlatformReleaseDependencyMaterializedPairWithFaultForTestV2(
  handle: PlatformReleaseCompiledOutputPairV2,
  fault:
    PlatformReleaseDependencyMaterializationFaultForTestV2,
): Promise<PlatformReleaseDependencyMaterializedPairV2> {
  if (
    typeof fault !== "object"
    || fault === null
    || Array.isArray(fault)
    || isProxy(fault)
    || Object.getPrototypeOf(fault) !== Object.prototype
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TEST_ONLY",
      "Dependency materialization fault requires one exact test-only descriptor",
    );
  }
  const keys = Reflect.ownKeys(fault);
  const descriptors =
    Object.getOwnPropertyDescriptors(fault);
  const checkpoint = descriptors.checkpoint;
  const observePath = descriptors.observePath;
  const allowedCheckpoints:
    readonly PlatformReleaseDependencyMaterializationFaultForTestV2["checkpoint"][] =
      [
        "after_first_dependency_root_opened",
        "after_first_dependency_root_adopted",
        "after_first_dependency_root_resealed",
        "after_second_dependency_root_opened",
        "after_second_dependency_root_adopted",
        "after_second_dependency_root_resealed",
        "after_final_async_fence",
        "before_scratch_cleanup",
        "after_scratch_cleanup_before_registration",
        "after_registration_and_predecessor_consumption_before_return",
      ];
  if (
    keys.some((key) => typeof key !== "string")
    || canonicalJsonStringify([...keys].sort())
      !== canonicalJsonStringify([
        "checkpoint",
        "observePath",
      ])
    || !checkpoint
    || !("value" in checkpoint)
    || !allowedCheckpoints.includes(
      checkpoint.value as
        PlatformReleaseDependencyMaterializationFaultForTestV2["checkpoint"],
    )
    || !observePath
    || !("value" in observePath)
    || typeof observePath.value !== "function"
    || isProxy(observePath.value)
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TEST_ONLY",
      "Dependency materialization fault contains an invalid checkpoint or observer",
    );
  }
  return materializeDependencyMaterializedPairV2(
    handle,
    "test_fixture",
    Object.freeze({
      checkpoint:
        checkpoint.value as
          PlatformReleaseDependencyMaterializationFaultForTestV2["checkpoint"],
      observePath:
        observePath.value as
          PlatformReleaseDependencyMaterializationFaultForTestV2["observePath"],
    }),
  );
}

export function inspectPlatformReleaseDependencyMaterializedPairV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): PlatformReleaseDependencyMaterializedPairInspectionV2 {
  const state =
    authenticDependencyMaterializedPairStateV2(handle);
  const sourceState =
    sourceStageStatesV2.get(state.sourceStage);
  if (
    state.ownership.lifecycle !== "ready"
    || !sourceState
    || sourceState.lifecycle !== "dependency_materializing"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency-materialized pair no longer owns its exact ready lifecycle",
    );
  }
  return deepFreezePlatformReleaseJsonV2(
    structuredClone(state.inspection),
  );
}

function sameDependencyMaterializedOccurrenceV2(
  left: DependencyMaterializedOccurrenceStateV2,
  right: DependencyMaterializedOccurrenceStateV2,
): boolean {
  return canonicalJsonBytes(left)
    .equals(canonicalJsonBytes(right));
}

function assertDependencyMaterializedParentAuthorityV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
): CompiledOutputPairStateV2 {
  let pair: CompiledOutputPairStateV2;
  try {
    pair = authenticCompiledOutputPairStateV2(
      state.compiledOutputPair,
    );
  } catch (error) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency pair lost its authentic predecessor authority",
      error,
    );
  }
  const firstSlot =
    requireSourceOwnedOutputRootV2(
      sourceState,
      "first",
    );
  const secondSlot =
    requireSourceOwnedOutputRootV2(
      sourceState,
      "second",
    );
  if (
    pair.ownership.lifecycle !== "consumed"
    || pair.sourceStage !== state.sourceStage
    || pair.buildToolchain !== state.buildToolchain
    || pair.first !== state.first.compiled
    || pair.second !== state.second.compiled
    || firstSlot !== pair.first.slot
    || secondSlot !== pair.second.slot
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency pair predecessor, source, toolchain or output-anchor ownership changed",
    );
  }
  return pair;
}

function captureIssuedDependencyMaterializedPairV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  capsule: BuildToolchainCapsuleStateV2,
): Readonly<{
  first: DependencyMaterializedOccurrenceStateV2;
  second: DependencyMaterializedOccurrenceStateV2;
  inspection:
    PlatformReleaseDependencyMaterializedPairInspectionV2;
}> {
  const pair =
    assertDependencyMaterializedParentAuthorityV2(
      state,
      sourceState,
    );
  const first =
    captureDependencyMaterializedOccurrenceV2({
      occurrence: "first",
      pair,
      sourceState,
      capsule,
      hostEvidence: state.first.hostEvidence,
      materialized: state.first.materialized,
    });
  const second =
    captureDependencyMaterializedOccurrenceV2({
      occurrence: "second",
      pair,
      sourceState,
      capsule,
      hostEvidence: state.second.hostEvidence,
      materialized: state.second.materialized,
    });
  assertDependencyMaterializedOccurrenceEqualityV2(
    first,
    second,
  );
  const inspection =
    dependencyMaterializedPairInspectionV2(
      sourceState,
      capsule,
      pair,
      first,
      second,
    );
  return Object.freeze({
    first,
    second,
    inspection,
  });
}

function destroyReadyDependencyPairAfterFailureV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
): never {
  if (
    state.ownership.lifecycle !== "ready"
    || sourceState.lifecycle !== "dependency_materializing"
  ) {
    throw primaryFailure;
  }
  state.ownership.lifecycle = "invalidated";
  try {
    disposeSourceOwnedPhysicalContextV2(sourceState);
  } catch (cleanupError) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
      "Invalid dependency pair could not destroy its source-owned outputs",
      new AggregateError([
        primaryFailure,
        cleanupError,
      ]),
    );
  }
  throw primaryFailure;
}

export async function revalidatePlatformReleaseDependencyMaterializedPairV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): Promise<PlatformReleaseDependencyMaterializedPairInspectionV2> {
  const state =
    authenticDependencyMaterializedPairStateV2(handle);
  const sourceState =
    sourceStageStatesV2.get(state.sourceStage);
  if (
    !sourceState
    || sourceState.lifecycle === "disposed"
    || state.ownership.lifecycle !== "ready"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency-materialized pair source authority is no longer live",
    );
  }
  if (sourceState.lifecycle !== "dependency_materializing") {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency-materialized pair no longer owns its exact lifecycle",
    );
  }
  let expectedCapsule: BuildToolchainCapsuleStateV2;
  try {
    expectedCapsule =
      authenticBuildToolchainCapsuleState(
        state.buildToolchain,
      );
  } catch (error) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT",
      "Dependency pair build-toolchain authority is no longer authentic",
      error,
    );
  }
  try {
    const expectedPair =
      assertDependencyMaterializedParentAuthorityV2(
        state,
        sourceState,
      );
    const live =
      await revalidateBuildToolchainCapsuleForLifecycleV2(
        state.buildToolchain,
        ["dependency_materializing"],
      );
    if (
      state.ownership.lifecycle !== "ready"
      || sourceState.lifecycle !== "dependency_materializing"
      || live.sourceState !== sourceState
      || live.capsule !== expectedCapsule
      || assertDependencyMaterializedParentAuthorityV2(
        state,
        sourceState,
      ) !== expectedPair
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        "Dependency pair lost exact ownership while fresh revalidation was in flight",
      );
    }
    const captured =
      captureIssuedDependencyMaterializedPairV2(
        state,
        sourceState,
        live.capsule,
      );
    if (
      !sameDependencyMaterializedOccurrenceV2(
        captured.first,
        state.first,
      )
      || !sameDependencyMaterializedOccurrenceV2(
        captured.second,
        state.second,
      )
      || canonicalJsonStringify(captured.inspection)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        "Fresh dependency outputs differ from issued pair authority",
      );
    }
    return captured.inspection;
  } catch (error) {
    const primary = error instanceof
        PlatformReleaseDependencyMaterializedPairErrorV2
      ? error
      : error instanceof
          PlatformReleaseBuildToolchainCapsuleErrorV2
        ? dependencyPairErrorFromBuildToolchainCapsuleV2(
          error,
          "Dependency pair lost its exact source or build-toolchain authority during fresh revalidation",
        )
      : new PlatformReleaseDependencyMaterializedPairErrorV2(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
        "Dependency pair failed fresh operational revalidation",
        { cause: error },
      );
    if (
      state.ownership.lifecycle === "ready"
      && sourceState.lifecycle
        === "dependency_materializing"
    ) {
      return destroyReadyDependencyPairAfterFailureV2(
        state,
        sourceState,
        primary,
      );
    }
    if (
      (
        state.ownership.lifecycle !== "ready"
        || sourceState.lifecycle
          !== "dependency_materializing"
      )
      && primary.code
        !== "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT"
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        "Dependency pair lost ownership while fresh revalidation was in flight",
        primary,
      );
    }
    throw primary;
  }
}

export async function withPlatformReleaseDependencyMaterializedPairForTestV2<T>(
  handle: PlatformReleaseDependencyMaterializedPairV2,
  callback: (roots: Readonly<{
    firstOutputRoot: string;
    secondOutputRoot: string;
  }>) => T | Promise<T>,
): Promise<T> {
  const state =
    authenticDependencyMaterializedPairStateV2(handle);
  if (
    state.admissionScope !== "test_fixture"
    || typeof callback !== "function"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TEST_ONLY",
      "Dependency output roots are available only to an explicit test callback",
    );
  }
  await revalidatePlatformReleaseDependencyMaterializedPairV2(
    handle,
  );
  let result: T;
  let callbackFailure: unknown;
  try {
    result = await callback(Object.freeze({
      firstOutputRoot:
        state.first.compiled.slot.outputRoot.absolutePath,
      secondOutputRoot:
        state.second.compiled.slot.outputRoot.absolutePath,
    }));
  } catch (error) {
    callbackFailure = error;
  }
  try {
    await revalidatePlatformReleaseDependencyMaterializedPairV2(
      handle,
    );
  } catch (validationFailure) {
    if (callbackFailure !== undefined) {
      throw new AggregateError([
        callbackFailure,
        validationFailure,
      ]);
    }
    throw validationFailure;
  }
  if (callbackFailure !== undefined) throw callbackFailure;
  return result!;
}

export function disposePlatformReleaseDependencyMaterializedPairV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): void {
  const state =
    authenticDependencyMaterializedPairStateV2(handle);
  const sourceState =
    sourceStageStatesV2.get(state.sourceStage);
  if (
    !sourceState
    || state.ownership.lifecycle !== "ready"
    || sourceState.lifecycle !== "dependency_materializing"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Only one ready dependency pair can terminally release its source-owned context",
    );
  }
  state.ownership.lifecycle = "invalidated";
  try {
    disposeSourceOwnedPhysicalContextV2(sourceState);
  } catch (error) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
      "Dependency pair could not destroy every source-owned output and source root",
      error,
    );
  }
}

export async function withPlatformReleaseCompiledOutputPairForTestV2<T>(
  handle: PlatformReleaseCompiledOutputPairV2,
  callback: (roots: Readonly<{
    firstOutputRoot: string;
    secondOutputRoot: string;
  }>) => T | Promise<T>,
): Promise<T> {
  const state = authenticCompiledOutputPairStateV2(handle);
  if (
    state.admissionScope !== "test_fixture"
    || typeof callback !== "function"
  ) {
    return failCompiledOutputPair(
      "PLATFORM_RELEASE_COMPILED_OUTPUT_PAIR_V2_TEST_ONLY",
      "Compiled output roots are available only to an explicit test callback",
    );
  }
  await revalidatePlatformReleaseCompiledOutputPairV2(
    handle,
  );
  let result: T;
  let callbackFailure: unknown;
  try {
    result = await callback(Object.freeze({
      firstOutputRoot:
        state.first.slot.outputRoot.absolutePath,
      secondOutputRoot:
        state.second.slot.outputRoot.absolutePath,
    }));
  } catch (error) {
    callbackFailure = error;
  }
  try {
    await revalidatePlatformReleaseCompiledOutputPairV2(
      handle,
    );
  } catch (validationFailure) {
    if (callbackFailure !== undefined) {
      throw new AggregateError([
        callbackFailure,
        validationFailure,
      ]);
    }
    throw validationFailure;
  }
  if (callbackFailure !== undefined) throw callbackFailure;
  return result!;
}

export async function withPlatformReleaseBuildToolchainCapsuleForTestV2<T>(
  handle: PlatformReleaseBuildToolchainCapsuleV2,
  callback: (nodeModulesRoot: string) => T | Promise<T>,
): Promise<T> {
  const state =
    authenticBuildToolchainCapsuleState(handle);
  if (
    state.admissionScope !== "test_fixture"
    || typeof callback !== "function"
  ) {
    return failBuildToolchainCapsule(
      "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_SCOPE_MISMATCH",
      "Build-toolchain path access is restricted to an explicit test-fixture callback",
    );
  }
  await revalidatePlatformReleaseBuildToolchainCapsuleV2(
    handle,
  );
  const result = await callback(state.nodeModulesRoot);
  await revalidatePlatformReleaseBuildToolchainCapsuleV2(
    handle,
  );
  return result;
}

export function withPlatformReleaseSourceStageForTestV2<T>(
  handle: AdmittedPlatformReleaseSourceStageV2,
  callback: (stageRoot: string) => T,
): T {
  const state = authenticState(handle);
  if (
    state.admissionScope !== "test_fixture"
    || typeof callback !== "function"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_TEST_ONLY",
      "Source stage path access is available only to an explicit test fixture callback",
    );
  }
  const beforeFingerprint =
    captureSourceFingerprint(state.stageRoot, {
      uid: state.core.stageAfter.ownerUid,
      gid: state.core.stageAfter.ownerGid,
    });
  const beforeIdentity = sourceStageIdentity(
    state.stageRoot,
    state.core.source.bindingHash,
  );
  if (
    beforeFingerprint.fingerprintHash
      !== state.core.source.exportedFileTreeHash
    || beforeIdentity.identityHash
      !== state.core.stageAfter.identityHash
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
      "Test source stage changed before callback access",
    );
  }
  const result = callback(state.stageRoot);
  const afterFingerprint =
    captureSourceFingerprint(state.stageRoot, {
      uid: state.core.stageAfter.ownerUid,
      gid: state.core.stageAfter.ownerGid,
    });
  const afterIdentity = sourceStageIdentity(
    state.stageRoot,
    state.core.source.bindingHash,
  );
  if (
    canonicalJsonStringify(beforeFingerprint)
      !== canonicalJsonStringify(afterFingerprint)
    || beforeIdentity.identityHash !== afterIdentity.identityHash
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_SOURCE_DRIFT",
      "Test source stage changed during callback access",
    );
  }
  return result;
}

export function disposePlatformReleaseSourceStageV2(
  handle: AdmittedPlatformReleaseSourceStageV2,
): void {
  const state = authenticState(handle);
  if (
    state.lifecycle === "toolchain_materializing"
    || state.lifecycle === "toolchain_revalidating"
    || state.lifecycle === "double_build_running"
    || state.lifecycle === "dependency_materializing"
  ) {
    return fail(
      "PLATFORM_RELEASE_SOURCE_V2_MATERIALIZATION_BUSY",
      "Source stage cannot be disposed during an active materialization transaction",
    );
  }
  disposeSourceOwnedPhysicalContextV2(state);
}
