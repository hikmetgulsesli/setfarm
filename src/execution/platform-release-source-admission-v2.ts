import {
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
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
  writeSync,
  type BigIntStats,
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
  hashHostNodePlatformReleaseOutputStageExactIdentityV2,
} from
  "../product-compiler/host-node-toolchain-authority-v2.js";
import {
  observePlatformReleaseBootstrapInstalledMetadataOperationAtPrivateTargetInternalV2,
  PlatformReleaseBootstrapInstalledMetadataOperationErrorV2,
  type PlatformReleaseBootstrapInstalledMetadataOperationOccurrenceInternalV2,
} from
  "../product-compiler/platform-release-bootstrap-installed-metadata-operation-test-support-v2.js";
import {
  observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2,
  PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2,
  type PlatformReleaseBootstrapInstalledNetworkNegativeOperationOccurrenceInternalV2,
} from
  "../product-compiler/platform-release-bootstrap-installed-network-negative-operation-test-support-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
} from "./platform-release-bootstrap-metadata-operation-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
} from "./platform-release-bootstrap-network-negative-operation-v2.js";
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
  CANONICAL_RUNTIME_TREE_V2_SCHEMA,
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
  hashPlatformReleaseCompositionModuleClosureForTestV2,
  hashPlatformReleaseCompositionModuleExportStableSetForTestV2,
  hashPlatformReleaseCompositionModuleExportsForTestV2,
  hashPlatformReleaseCompositionModuleSetForTestV2,
  hashPlatformReleaseCompositionOwnershipTransferDirectoryObservationForTestV2,
  hashPlatformReleaseCompositionOwnershipTransferForTestV2,
  hashPlatformReleaseCompositionOwnershipTransferSlotForTestV2,
  parsePlatformReleaseCompositionModuleClosureForTestV2,
  parsePlatformReleaseCompositionModuleExportsForTestV2,
  parsePlatformReleaseCompositionOwnershipTransferForTestV2,
  PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_SCHEMA,
  PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_SCHEMA,
  PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_V2_SCHEMA,
  type PlatformReleaseCompositionModuleClosureForTestV2Inspection,
  type PlatformReleaseCompositionModuleExportsForTestV2Inspection,
  type PlatformReleaseCompositionOwnershipTransferForTestV2Inspection,
} from "./schemas/platform-release-composition-test-v2.js";
import {
  hashPlatformReleaseCompositionMetadataPairForTestV2,
  hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2,
  hashPlatformReleaseCompositionMetadataPairStableProjectionForTestV2,
  hashPlatformReleaseCompositionMetadataLaunchProjectionForTestV2,
  parsePlatformReleaseCompositionMetadataPairForTestV2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_SCHEMA,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
  type PlatformReleaseCompositionMetadataPairTestV2,
} from "./schemas/platform-release-composition-metadata-test-v2.js";
import {
  hashPlatformReleaseCompositionNetworkNegativeLaunchProjectionForTestV2,
  hashPlatformReleaseCompositionNetworkNegativePairForTestV2,
  hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2,
  hashPlatformReleaseCompositionNetworkNegativePairStableProjectionForTestV2,
  parsePlatformReleaseCompositionNetworkNegativePairForTestV2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_SCHEMA,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
  type PlatformReleaseCompositionNetworkNegativePairTestV2,
} from "./schemas/platform-release-composition-network-negative-test-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_TIMEOUT_MS_V2,
  PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_V2_SCHEMA,
  hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2,
  hashPlatformReleaseBootstrapModuleExportProbeExportSetV2,
  hashPlatformReleaseBootstrapModuleExportLoadObservationV2,
  hashPlatformReleaseBootstrapModuleExportProbeModuleObservationV2,
  hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2,
  hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2,
  hashPlatformReleaseBootstrapModuleExportProbeStableProjectionV2,
  hashPlatformReleaseBootstrapModuleExportProbeV2,
  parsePlatformReleaseBootstrapModuleExportProbeCandidateV2,
  type PlatformReleaseBootstrapModuleExportProbeExportV2,
  type PlatformReleaseBootstrapModuleExportProbeOccurrenceV2,
  type PlatformReleaseBootstrapModuleExportProbeProcessEvidenceV2,
  type PlatformReleaseBootstrapModuleExportProbeV2,
} from "./schemas/platform-release-bootstrap-module-export-probe-v2.js";
import {
  ExactHostOwnedFileRefV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  type ExactHostOwnedFileRefV2,
} from "./schemas/platform-release-common-v2.js";
import {
  acquirePlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2,
  executePlatformReleaseHostNodeToolchainBuildInternalV2,
  executePlatformReleaseHostNodeToolchainNpmCiInternalV2,
  executePlatformReleaseHostNodeToolchainProductionNpmCiInternalV2,
  inspectPlatformReleaseHostNodeToolchainCompositionReceiptInternalV2,
  inspectPlatformReleaseHostNodeToolchainReceiptV2,
  isProductionPlatformReleaseHostNodeToolchainAuthorityV2,
  revalidatePlatformReleaseHostNodeToolchainAuthorityV2,
  PlatformReleaseHostNodeToolchainAuthorityErrorV2,
  type PlatformReleaseHostNodeToolchainAuthorityErrorCodeV2,
  type PlatformReleaseHostNodeToolchainBuildEvidenceV2,
  type PlatformReleaseHostNodeToolchainAuthorityV2,
  type PlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2,
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
import {
  PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
  hashPlatformReleaseModuleRefV2,
  type PlatformReleaseModuleRefV2,
} from "./schemas/platform-release-module-catalogs-v2.js";
import {
  bindPlatformReleaseRequiredModuleClosureCandidateV2,
  getPlatformReleaseRequiredModuleRequirementV2,
} from "./schemas/platform-release-required-module-closure-v2.js";
import {
  getPlatformReleaseRequiredModuleOperationRefV2,
} from "./platform-release-required-module-operation-ref-v2.js";
import {
  PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
  hashPlatformReleaseBootstrapWireMessageV2,
  parsePlatformReleaseBootstrapWireMessageV2,
} from "./schemas/platform-release-bootstrap-wire-contracts-v2.js";
import {
  CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
  EXACT_BUNDLED_FILE_REF_V2_SCHEMA,
  PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA,
  RUNTIME_PAYLOAD_LAYOUT_V2,
  hashCanonicalRuntimeTreeBindingV2,
  hashPlatformRuntimePayloadV2,
  parsePlatformRuntimePayloadCandidateV2,
  type PlatformRuntimePayloadHashPayloadV2,
} from "./schemas/platform-runtime-payload-v2.js";

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
  device: string;
  inode: string;
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
    status: "transferred";
    transferHash: string;
  }>
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

export type PlatformReleaseCompositionOwnershipTransferFaultForTestV2 =
  Readonly<{
    checkpoint:
      | "after_claim_before_revalidation"
      | "after_selected_slot_transfer"
      | "after_second_output_cleanup"
      | "after_source_context_cleanup_before_completion"
      | "after_completion_before_return";
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

export type PlatformReleaseCompositionOwnershipTransferForTestErrorCodeV2 =
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_ALREADY_CLAIMED"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SOURCE_DRIFT"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_CLEANUP_FAILED"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_UNAUTHENTICATED"
  | "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_DISPOSED";

export class PlatformReleaseCompositionOwnershipTransferForTestErrorV2
  extends Error {
  readonly code:
    PlatformReleaseCompositionOwnershipTransferForTestErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseCompositionOwnershipTransferForTestErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseCompositionOwnershipTransferForTestErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseCompositionModuleClosureForTestErrorCodeV2 =
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_PAIR_DRIFT"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_MODULE_MISSING"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_EQUALITY_FAILED"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_OUTPUT_INVALID";

export class PlatformReleaseCompositionModuleClosureForTestErrorV2
  extends Error {
  readonly code:
    PlatformReleaseCompositionModuleClosureForTestErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseCompositionModuleClosureForTestErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseCompositionModuleClosureForTestErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseCompositionModuleExportsForTestErrorCodeV2 =
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_ALREADY_CLAIMED"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OPERATION_REJECTED"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PROCESS_FAILED"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OUTPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_CLEANUP_FAILED";

export class PlatformReleaseCompositionModuleExportsForTestErrorV2
  extends Error {
  readonly code:
    PlatformReleaseCompositionModuleExportsForTestErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseCompositionModuleExportsForTestErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseCompositionModuleExportsForTestErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseCompositionMetadataPairForTestErrorCodeV2 =
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_ALREADY_CLAIMED"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OPERATION_REJECTED"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PROCESS_FAILED"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OUTPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_CLEANUP_FAILED";

export class PlatformReleaseCompositionMetadataPairForTestErrorV2
  extends Error {
  readonly code:
    PlatformReleaseCompositionMetadataPairForTestErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseCompositionMetadataPairForTestErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseCompositionMetadataPairForTestErrorV2";
    this.code = code;
    this.cause = options?.cause;
  }
}

export type PlatformReleaseCompositionNetworkNegativePairForTestErrorCodeV2 =
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_INPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_SCOPE_MISMATCH"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_ALREADY_CLAIMED"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_OPERATION_REJECTED"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PROCESS_FAILED"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_OUTPUT_INVALID"
  | "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_CLEANUP_FAILED";

export class PlatformReleaseCompositionNetworkNegativePairForTestErrorV2
  extends Error {
  readonly code:
    PlatformReleaseCompositionNetworkNegativePairForTestErrorCodeV2;
  override readonly cause?: unknown;

  constructor(
    code:
      PlatformReleaseCompositionNetworkNegativePairForTestErrorCodeV2,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message.slice(0, 1_500), options);
    this.name =
      "PlatformReleaseCompositionNetworkNegativePairForTestErrorV2";
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
      | "probing"
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

type PlatformReleaseCompositionOwnershipTransferForTestStateV2 = {
  readonly sourceStage: AdmittedPlatformReleaseSourceStageV2;
  readonly selectedSlot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  >;
  readonly inspection:
    PlatformReleaseCompositionOwnershipTransferForTestV2Inspection;
  lifecycle: "owned" | "disposed" | "cleanup_failed";
};

const compositionOwnershipTransferForTestConstructorCapabilityV2 =
  Object.freeze({});
const compositionOwnershipTransferForTestStatesV2 =
  new WeakMap<
    object,
    PlatformReleaseCompositionOwnershipTransferForTestStateV2
  >();

export class PlatformReleaseCompositionOwnershipTransferForTestV2 {
  readonly authorityState =
    "test_fixture_ownership_transfer_unverified" as const;
  readonly admissionScope = "test_fixture" as const;
  readonly productionAuthority = false as const;
  readonly transactionHash: string;

  constructor(
    capability: object,
    state: PlatformReleaseCompositionOwnershipTransferForTestStateV2,
  ) {
    if (
      capability
        !== compositionOwnershipTransferForTestConstructorCapabilityV2
    ) {
      throw new PlatformReleaseCompositionOwnershipTransferForTestErrorV2(
        "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_UNAUTHENTICATED",
        "Ownership-transfer rehearsal constructor capability is unavailable",
      );
    }
    this.transactionHash = state.inspection.transactionHash;
    compositionOwnershipTransferForTestStatesV2.set(this, state);
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

function failCompositionOwnershipTransferForTestV2(
  code:
    PlatformReleaseCompositionOwnershipTransferForTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseCompositionOwnershipTransferForTestErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function failCompositionModuleClosureForTestV2(
  code:
    PlatformReleaseCompositionModuleClosureForTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseCompositionModuleClosureForTestErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function failCompositionModuleExportsForTestV2(
  code:
    PlatformReleaseCompositionModuleExportsForTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseCompositionModuleExportsForTestErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function failCompositionMetadataPairForTestV2(
  code:
    PlatformReleaseCompositionMetadataPairForTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseCompositionMetadataPairForTestErrorV2(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function failCompositionNetworkNegativePairForTestV2(
  code:
    PlatformReleaseCompositionNetworkNegativePairForTestErrorCodeV2,
  message: string,
  cause?: unknown,
): never {
  throw new PlatformReleaseCompositionNetworkNegativePairForTestErrorV2(
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
    const stat = lstatSync(value, { bigint: true });
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

function modeBits(stat: BigIntStats): number {
  return Number(stat.mode & 0o7777n);
}

const MAX_SAFE_INTEGER_BIGINT_V2 = BigInt(Number.MAX_SAFE_INTEGER);

function boundedStatOwnerId(value: bigint): number {
  if (value < 0n || value > MAX_SAFE_INTEGER_BIGINT_V2) {
    throw new RangeError("Filesystem owner id exceeds the safe numeric bound");
  }
  return Number(value);
}

function sameStat(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.nlink === right.nlink
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
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
  stat: BigIntStats;
}> {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile()
      || (
        linkPolicy === "single"
          ? before.nlink !== 1n
          : before.nlink < 1n
      )
      || before.size < 1n
      || before.size > BigInt(maxBytes)
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
    const after = fstatSync(descriptor, { bigint: true });
    if (BigInt(total) !== before.size || !sameStat(before, after)) {
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
  if ((modeBits(observed.stat) & 0o111) === 0) {
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
  const stat = lstatSync(parent, { bigint: true });
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
    const context = lstatSync(contextRoot, { bigint: true });
    if (
      context.isSymbolicLink()
      || !context.isDirectory()
      || modeBits(context) !== 0o700
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
  expected: BigIntStats,
): Buffer {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | constants.O_NOFOLLOW
        | constants.O_NONBLOCK,
    );
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile()
      || before.nlink !== 1n
      || before.size < 0n
      || before.size > BigInt(SOURCE_FILE_MAX_BYTES_V2)
      || !sameStat(before, expected)
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
        "Source stage file changed before descriptor capture",
      );
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (
      BigInt(bytes.byteLength) !== before.size
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
  const initialRoot = lstatSync(stageRoot, { bigint: true });
  const owner = expectedOwner ?? Object.freeze({
    uid: boundedStatOwnerId(initialRoot.uid),
    gid: boundedStatOwnerId(initialRoot.gid),
  });

  const visit = (absolute: string, relative: string): void => {
    const before = lstatSync(absolute, { bigint: true });
    if (
      before.isSymbolicLink()
      || !before.isDirectory()
      || modeBits(before) !== 0o555
      || before.uid !== BigInt(owner.uid)
      || before.gid !== BigInt(owner.gid)
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
      const stat = lstatSync(child, { bigint: true });
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
        || stat.nlink !== 1n
        || ![0o444, 0o555].includes(modeBits(stat))
        || stat.uid !== BigInt(owner.uid)
        || stat.gid !== BigInt(owner.gid)
        || stat.size < 0n
        || stat.size > BigInt(SOURCE_FILE_MAX_BYTES_V2)
      ) {
        return fail(
          "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
          "Source stage contains a noncanonical file",
        );
      }
      const bytes = stableStageFile(child, stat);
      const after = lstatSync(child, { bigint: true });
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
        mode: modeBits(stat) === 0o555
          ? "0555" as const
          : "0444" as const,
        byteLength: bytes.byteLength,
        contentHash: sha256(bytes),
      }));
    }
    const afterNames = readdirSync(absolute).sort();
    const after = lstatSync(absolute, { bigint: true });
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
  const stat = lstatSync(stageRoot, { bigint: true });
  if (
    stat.isSymbolicLink()
    || !stat.isDirectory()
    || realpathSync(stageRoot) !== stageRoot
    || modeBits(stat) !== 0o555
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
    ownerUid: boundedStatOwnerId(stat.uid),
    ownerGid: boundedStatOwnerId(stat.gid),
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
    assertSourceOwnedPrivateDirectoryCurrentV2(
      anchor,
      `${label} private root before recursive removal`,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
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
  stat: BigIntStats,
): SourceOwnedPrivateDirectoryIdentityV2 {
  return Object.freeze({
    device: String(stat.dev),
    inode: String(stat.ino),
    ownerUid: boundedStatOwnerId(stat.uid),
    ownerGid: boundedStatOwnerId(stat.gid),
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
    const stat = lstatSync(absolutePath, { bigint: true });
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(absolutePath) !== absolutePath
      || modeBits(stat) !== 0o700
      || stat.uid !== BigInt(owner.uid)
      || stat.gid !== BigInt(owner.gid)
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

type SourceOwnedPrivateDirectoryFailureV2 = (
  message: string,
  cause?: unknown,
) => never;

function assertSourceOwnedPrivateDirectoryCurrentWithFailureV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
  onFailure: SourceOwnedPrivateDirectoryFailureV2,
): void {
  const owner = sourceOwnedProcessOwnerV2();
  let current: SourceOwnedPrivateDirectoryIdentityV2;
  let valid = false;
  try {
    const stat = lstatSync(anchor.absolutePath, { bigint: true });
    current = sourceOwnedDirectoryIdentityV2(stat);
    valid = !(
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(anchor.absolutePath)
        !== anchor.absolutePath
      || modeBits(stat) !== 0o700
      || stat.uid !== BigInt(owner.uid)
      || stat.gid !== BigInt(owner.gid)
      || !sameSourceOwnedDirectoryIdentityV2(
        current,
        anchor.identity,
      )
    );
  } catch (error) {
    return onFailure(`${label} could not be re-anchored`, error);
  }
  if (!valid) return onFailure(`${label} was replaced or changed`);
}

function assertSourceOwnedPrivateDirectoryCurrentV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
  errorCode:
    | "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID"
    | "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED" =
      "PLATFORM_RELEASE_SOURCE_V2_STAGE_INVALID",
): void {
  return assertSourceOwnedPrivateDirectoryCurrentWithFailureV2(
    anchor,
    label,
    (message, cause) => fail(errorCode, message, cause),
  );
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
    lstatSync(absolutePath, { bigint: true });
    return false;
  } catch (error) {
    if (isMissingPathErrorV2(error)) return true;
    throw error;
  }
}

function makeSourceOwnedDirectoriesWritableV2(
  absolutePath: string,
): void {
  const stat = lstatSync(absolutePath, { bigint: true });
  if (stat.isSymbolicLink() || !stat.isDirectory()) return;
  chmodSync(absolutePath, 0o700);
  for (const name of readdirSync(absolutePath)) {
    const child = path.join(absolutePath, name);
    const childStat = lstatSync(child, { bigint: true });
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
  if (
    slot.status === "empty"
    || slot.status === "transferred"
  ) return;
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
    assertSourceOwnedPrivateDirectoryCurrentV2(
      parent,
      `${label} private parent before recursive removal`,
      "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
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

function compositionOwnershipTransferTestHostIdentityHashV2(): string {
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-composition-ownership-transfer-test-host.v2",
    platform: process.platform,
    architecture: process.arch,
    authority: "test_fixture_only",
  });
}

function boundedCompositionOwnershipTransferStatNumberV2(
  value: bigint,
  maximum: number,
  label: string,
): number {
  if (
    value < 0n
    || value > BigInt(maximum)
    || !Number.isSafeInteger(Number(value))
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
      `${label} is outside the bounded ownership-transfer observation`,
    );
  }
  return Number(value);
}

function captureCompositionOwnershipTransferDirectoryForTestV2(
  anchor: SourceOwnedPrivateDirectoryV2,
  label: string,
): PlatformReleaseCompositionOwnershipTransferForTestV2Inspection[
  "selectedSlot"
]["privateParent"] {
  const capture = () => {
    try {
      assertSourceOwnedPrivateDirectoryCurrentV2(
        anchor,
        label,
      );
      const stat = lstatSync(anchor.absolutePath, {
        bigint: true,
      });
      const names = readdirSync(anchor.absolutePath).sort();
      if (names.length > 64) {
        return failCompositionOwnershipTransferForTestV2(
          "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
          `${label} direct membership exceeds the bounded test observation`,
        );
      }
      const entries = names.map((name) => {
        if (
          Buffer.byteLength(name, "utf8") < 1
          || Buffer.byteLength(name, "utf8") > 255
          || name === "."
          || name === ".."
        ) {
          return failCompositionOwnershipTransferForTestV2(
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
            `${label} contains an invalid direct member name`,
          );
        }
        const child = path.join(anchor.absolutePath, name);
        const childStat = lstatSync(child, { bigint: true });
        if (
          childStat.isSymbolicLink()
          || (
            !childStat.isDirectory()
            && !childStat.isFile()
          )
        ) {
          return failCompositionOwnershipTransferForTestV2(
            "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
            `${label} contains a non-regular direct member`,
          );
        }
        return Object.freeze({
          name,
          objectKind: childStat.isDirectory()
            ? "directory" as const
            : "ordinary_file" as const,
          device: childStat.dev.toString(10),
          inode: childStat.ino.toString(10),
        });
      });
      const stableIdentity = {
        hostIdentityHash:
          compositionOwnershipTransferTestHostIdentityHashV2(),
        objectKind: "directory" as const,
        device: stat.dev.toString(10),
        inode: stat.ino.toString(10),
      };
      const mutableFingerprint = {
        ownerUid: boundedCompositionOwnershipTransferStatNumberV2(
          stat.uid,
          4_294_967_294,
          `${label} owner UID`,
        ),
        ownerGid: boundedCompositionOwnershipTransferStatNumberV2(
          stat.gid,
          4_294_967_294,
          `${label} owner GID`,
        ),
        mode: "0700" as const,
        linkCount: boundedCompositionOwnershipTransferStatNumberV2(
          stat.nlink,
          Number.MAX_SAFE_INTEGER,
          `${label} link count`,
        ),
        byteLength: boundedCompositionOwnershipTransferStatNumberV2(
          stat.size,
          8 * 1024 * 1024,
          `${label} byte length`,
        ),
        modifiedTimeNanoseconds: stat.mtimeNs.toString(10),
        changedTimeNanoseconds: stat.ctimeNs.toString(10),
      };
      const membershipHash = hashCanonicalJson({
        schema:
          "setfarm.platform-release-composition-ownership-transfer-test-membership.v2",
        entries,
      });
      const identity = {
        stableIdentity,
        mutableFingerprint,
        membershipHash,
      };
      return Object.freeze({
        ...identity,
        observationHash:
          hashPlatformReleaseCompositionOwnershipTransferDirectoryObservationForTestV2(
            identity,
          ),
      });
    } catch (error) {
      if (
        error instanceof
          PlatformReleaseCompositionOwnershipTransferForTestErrorV2
      ) throw error;
      return failCompositionOwnershipTransferForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
        `${label} could not be captured without following mutable aliases`,
        error,
      );
    }
  };
  const first = capture();
  const second = capture();
  if (
    canonicalJsonStringify(first)
      !== canonicalJsonStringify(second)
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
      `${label} changed across the two-pass ownership-transfer observation`,
    );
  }
  return first;
}

function captureCompositionOwnershipTransferSlotForTestV2(
  slot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  >,
): PlatformReleaseCompositionOwnershipTransferForTestV2Inspection[
  "selectedSlot"
] {
  if (
    canonicalJsonStringify(
      readdirSync(slot.privateParent.absolutePath).sort(),
    ) !== canonicalJsonStringify(["output"])
    || canonicalJsonStringify(
      readdirSync(slot.outputRoot.absolutePath).sort(),
    ) !== canonicalJsonStringify(["payload"])
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
      "Selected dependency output no longer has its exact owned topology",
    );
  }
  const identity = {
    privateParent:
      captureCompositionOwnershipTransferDirectoryForTestV2(
        slot.privateParent,
        "Selected output private parent",
      ),
    outputRoot:
      captureCompositionOwnershipTransferDirectoryForTestV2(
        slot.outputRoot,
        "Selected output root",
      ),
  };
  return Object.freeze({
    ...identity,
    slotHash:
      hashPlatformReleaseCompositionOwnershipTransferSlotForTestV2(
        identity,
      ),
  });
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
          || slot.status === "transferred"
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
    || observed.stat.uid !== BigInt(candidate.ownerUid)
    || observed.stat.gid !== BigInt(candidate.ownerGid)
    || modeBits(observed.stat)
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
      !== 1
    || candidate.hostAdmissionReceipt.physicalAfter.linkCount
      !== 1
    || observed.stat.nlink !== 1n
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
    const context = lstatSync(state.contextRoot, { bigint: true });
    const expected = phase === "source_only"
      ? ["source"]
      : ["node_modules", "source"];
    const names = readdirSync(state.contextRoot).sort();
    if (
      context.isSymbolicLink()
      || !context.isDirectory()
      || realpathSync(state.contextRoot) !== state.contextRoot
      || modeBits(context) !== 0o700
      || context.uid !== BigInt(owner.uid)
      || context.gid !== BigInt(owner.gid)
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
      const toolchain = lstatSync(nodeModulesRoot, { bigint: true });
      if (
        toolchain.isSymbolicLink()
        || !toolchain.isDirectory()
        || realpathSync(nodeModulesRoot) !== nodeModulesRoot
        || modeBits(toolchain) !== 0o555
        || toolchain.uid !== BigInt(owner.uid)
        || toolchain.gid !== BigInt(owner.gid)
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
      const sourceStat = lstatSync(sourcePath, { bigint: true });
      if (
        sourceStat.isSymbolicLink()
        || !sourceStat.isFile()
        || sourceStat.nlink !== 1n
        || modeBits(sourceStat) !== 0o444
        || sourceStat.size !== BigInt(sourceRef.byteLength)
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
    const stat = lstatSync(anchor.absolutePath, { bigint: true });
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(anchor.absolutePath)
        !== anchor.absolutePath
      || modeBits(stat) !== 0o700
      || stat.uid !== BigInt(owner.uid)
      || stat.gid !== BigInt(owner.gid)
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
    assertSourceOwnedPrivateDirectoryCurrentWithFailureV2(
      anchor,
      `${label} private root before recursive removal`,
      (message, cause) => failBuildToolchainCapsule(
        "PLATFORM_RELEASE_BUILD_TOOLCHAIN_CAPSULE_V2_CLEANUP_FAILED",
        message,
        cause,
      ),
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
    const stat = lstatSync(anchor.absolutePath, { bigint: true });
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(anchor.absolutePath)
        !== anchor.absolutePath
      || modeBits(stat) !== 0o700
      || stat.uid !== BigInt(owner.uid)
      || stat.gid !== BigInt(owner.gid)
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
    assertSourceOwnedPrivateDirectoryCurrentWithFailureV2(
      anchor,
      `${label} private root before recursive removal`,
      (message, cause) => failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
        message,
        cause,
      ),
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
    const stat = lstatSync(nodeModulesRoot, { bigint: true });
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(nodeModulesRoot) !== nodeModulesRoot
      || modeBits(stat) !== 0o555
      || stat.uid !== BigInt(owner.uid)
      || stat.gid !== BigInt(owner.gid)
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
      ownerUid: boundedStatOwnerId(stat.uid),
      ownerGid: boundedStatOwnerId(stat.gid),
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
    const stat = lstatSync(absolutePath, { bigint: true });
    const expectedMode =
      Number.parseInt(entry.mode, 8);
    if (
      stat.isSymbolicLink()
      || stat.uid !== BigInt(expectedUid)
      || stat.gid !== BigInt(owner.gid)
      || modeBits(stat) !== expectedMode
      || (
        entry.type === "directory"
          ? !stat.isDirectory()
          : !stat.isFile() || stat.nlink !== 1n
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
    const outputRootStat = lstatSync(outputRoot, { bigint: true });
    const outputStagePhysicalIdentityHash =
      hashHostNodePlatformReleaseOutputStageExactIdentityV2({
        device: String(outputRootStat.dev),
        inode: String(outputRootStat.ino),
        mode: modeBits(outputRootStat),
        ownerUid: boundedStatOwnerId(outputRootStat.uid),
        ownerGid: boundedStatOwnerId(outputRootStat.gid),
      });
    const outputNames = readdirSync(outputRoot).sort();
    const payloadRoot = path.join(outputRoot, "payload");
    const payload = lstatSync(payloadRoot, { bigint: true });
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
      || modeBits(payload) !== 0o700
      || payload.uid !== BigInt(expectedUid)
      || payload.gid !== BigInt(owner.gid)
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

function authenticCompositionOwnershipTransferForTestStateV2(
  handle: PlatformReleaseCompositionOwnershipTransferForTestV2,
): PlatformReleaseCompositionOwnershipTransferForTestStateV2 {
  if (
    typeof handle !== "object"
    || handle === null
    || isProxy(handle)
    || Object.getPrototypeOf(handle)
      !== PlatformReleaseCompositionOwnershipTransferForTestV2.prototype
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_UNAUTHENTICATED",
      "Ownership-transfer rehearsal operation requires one authentic handle",
    );
  }
  const state =
    compositionOwnershipTransferForTestStatesV2.get(handle);
  if (!state) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_UNAUTHENTICATED",
      "Ownership-transfer rehearsal operation requires one authentic handle",
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
    const stat = lstatSync(nodeModulesRoot, { bigint: true });
    const owner = sourceOwnedProcessOwnerV2();
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || realpathSync(nodeModulesRoot) !== nodeModulesRoot
      || modeBits(stat) !== 0o555
      || stat.uid !== BigInt(owner.uid)
      || stat.gid !== BigInt(owner.gid)
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
      ownerUid: boundedStatOwnerId(stat.uid),
      ownerGid: boundedStatOwnerId(stat.gid),
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
    lstatSync(destination, { bigint: true });
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
    const sourceBefore = lstatSync(source, { bigint: true });
    const project = lstatSync(scope.projectRoot, { bigint: true });
    const destinationParentBefore =
      lstatSync(destinationParent, { bigint: true });
    if (
      sourceBefore.isSymbolicLink()
      || !sourceBefore.isDirectory()
      || realpathSync(source) !== source
      || modeBits(sourceBefore) !== 0o555
      || sourceBefore.uid !== BigInt(owner.uid)
      || sourceBefore.gid !== BigInt(owner.gid)
      || project.isSymbolicLink()
      || !project.isDirectory()
      || realpathSync(scope.projectRoot)
        !== scope.projectRoot
      || modeBits(project) !== 0o700
      || project.uid !== BigInt(owner.uid)
      || project.gid !== BigInt(owner.gid)
      || destinationParentBefore.isSymbolicLink()
      || !destinationParentBefore.isDirectory()
      || realpathSync(destinationParent)
        !== destinationParent
      || modeBits(destinationParentBefore) !== 0o700
      || destinationParentBefore.uid !== BigInt(owner.uid)
      || destinationParentBefore.gid !== BigInt(owner.gid)
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
    const sourceOpened = lstatSync(source, { bigint: true });
    if (
      sourceOpened.dev !== sourceBefore.dev
      || sourceOpened.ino !== sourceBefore.ino
      || modeBits(sourceOpened) !== 0o700
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
    const adopted = lstatSync(destination, { bigint: true });
    if (
      adopted.isSymbolicLink()
      || !adopted.isDirectory()
      || realpathSync(destination) !== destination
      || adopted.dev !== sourceBefore.dev
      || adopted.ino !== sourceBefore.ino
      || modeBits(adopted) !== 0o700
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
    const resealed = lstatSync(destination, { bigint: true });
    if (
      resealed.dev !== sourceBefore.dev
      || resealed.ino !== sourceBefore.ino
      || modeBits(resealed) !== 0o555
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

function deriveCompositionModuleRefsForTestV2(
  occurrence: CompiledOccurrenceStateV2,
): readonly PlatformReleaseModuleRefV2[] {
  const entriesByPath = new Map(
    occurrence.distTree.entries.map(
      (entry) => [entry.path, entry],
    ),
  );
  return Object.freeze(
    getPlatformReleaseRequiredModuleRequirementV2()
      .entries.map((definition) => {
        const relativePath =
          definition.moduleLocator.slice("dist/".length);
        const entry = entriesByPath.get(relativePath);
        if (
          !entry
          || entry.type !== "file"
          || entry.executable
          || entry.mode !== "0444"
          || entry.byteLength < 1
        ) {
          return failCompositionModuleClosureForTestV2(
            "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_MODULE_MISSING",
            `Required module is absent or not one immutable regular file: ${definition.moduleLocator}`,
          );
        }
        const identity = {
          schema: PLATFORM_RELEASE_MODULE_REF_V2_SCHEMA,
          moduleLocator: definition.moduleLocator,
          payloadLocator:
            `payload/${definition.moduleLocator}`,
          mediaType: "text/javascript" as const,
          contentHash: entry.contentHash,
          byteLength: entry.byteLength,
          mode: "0444" as const,
        };
        return Object.freeze({
          ...identity,
          moduleRefHash:
            hashPlatformReleaseModuleRefV2(identity),
        });
      }),
  );
}

function deriveCompositionRuntimePayloadForTestV2(
  state: DependencyMaterializedPairStateV2,
  runtimeUid: number,
) {
  const compiled = state.first.compiled.binding;
  const dependency = state.first.binding;
  const platformTreeIdentity = {
    schema: CANONICAL_RUNTIME_TREE_BINDING_V2_SCHEMA,
    treeSchema: CANONICAL_RUNTIME_TREE_V2_SCHEMA,
    profile: "dist" as const,
    rootLocator: "payload/dist" as const,
    treeHash: compiled.distTreeHash,
    treePayloadHash: compiled.distTreePayloadHash,
    fileCount: compiled.distFileCount,
    directoryCount: compiled.distDirectoryCount,
    totalBytes: compiled.distTotalBytes,
  };
  const platformTree = {
    ...platformTreeIdentity,
    bindingHash:
      hashCanonicalRuntimeTreeBindingV2(
        platformTreeIdentity,
      ),
  };
  const identity: PlatformRuntimePayloadHashPayloadV2 = {
    schema: PLATFORM_RUNTIME_PAYLOAD_V2_SCHEMA,
    version: "2.0.0" as const,
    layout: structuredClone(RUNTIME_PAYLOAD_LAYOUT_V2),
    rootLocator: "payload" as const,
    allowedRootEntries: [
      "dist",
      "node_modules",
      "package.json",
    ] as const,
    platformTree,
    dependencyTree:
      structuredClone(dependency.dependencyTree),
    packageJson: {
      schema: EXACT_BUNDLED_FILE_REF_V2_SCHEMA,
      locator: "payload/package.json" as const,
      mediaType: "application/json" as const,
      hash: compiled.packageContentHash,
      byteLength: compiled.packageByteLength,
      mode: "0444" as const,
    },
    ownership: {
      ownerUid: 0 as const,
      ownerGid: 0,
      runtimeUid,
      runtimeMustNotOwnRelease: true as const,
      rootMode: "0555" as const,
    },
  };
  return parsePlatformRuntimePayloadCandidateV2({
    ...identity,
    runtimePayloadHash:
      hashPlatformRuntimePayloadV2(identity),
  });
}

function deriveCompositionModuleClosureInspectionForTestV2(
  state: DependencyMaterializedPairStateV2,
): PlatformReleaseCompositionModuleClosureForTestV2Inspection {
  const compositionReceipt =
    inspectPlatformReleaseHostNodeToolchainCompositionReceiptInternalV2(
      authenticBuildToolchainCapsuleState(
        state.buildToolchain,
      ).hostToolchain,
    );
  const firstModules =
    deriveCompositionModuleRefsForTestV2(
      state.first.compiled,
    );
  const secondModules =
    deriveCompositionModuleRefsForTestV2(
      state.second.compiled,
    );
  if (
    canonicalJsonStringify(firstModules)
      !== canonicalJsonStringify(secondModules)
  ) {
    return failCompositionModuleClosureForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_EQUALITY_FAILED",
      "Independent physical dist trees produced unequal required module refs",
    );
  }
  const runtimePayload =
    deriveCompositionRuntimePayloadForTestV2(
      state,
      compositionReceipt.runtimeAccount.uid,
    );
  const requiredModuleClosure =
    bindPlatformReleaseRequiredModuleClosureCandidateV2({
      platformTreeHash:
        runtimePayload.platformTree.treeHash,
      runtimePayloadHash:
        runtimePayload.runtimePayloadHash,
      modules: firstModules,
    });
  const moduleSetHash =
    hashPlatformReleaseCompositionModuleSetForTestV2(
      firstModules,
    );
  const compiled = state.first.compiled.binding;
  const dependency = state.first.binding;
  const identity = {
    schema:
      PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "test_fixture_module_closure_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    productionUse:
      "forbidden_until_fresh_module_export_receipts_and_verified_release" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    operationMode:
      "authentic_dependency_pair_zero_caller_runtime_payload_and_required_module_closure_derivation" as const,
    callerJsonState: "absent" as const,
    terminalizationState:
      "not_performed_module_exports_manifest_and_attestation_still_required" as const,
    dependencyPairInspectionHash:
      state.inspection.inspectionHash,
    dependencyPair:
      structuredClone(state.inspection),
    sourceBindingHash:
      state.inspection.sourceBindingHash,
    hostCompositionReceiptHash:
      compositionReceipt.receiptHash,
    runtimeAccountReceiptHash:
      compositionReceipt.runtimeAccount.receiptHash,
    hostRuntimeAccount:
      structuredClone(compositionReceipt.runtimeAccount),
    stableOutput: {
      predependencyOutputBindingHash:
        compiled.bindingHash,
      dependencyOutputBindingHash:
        dependency.bindingHash,
      distTreeHash: compiled.distTreeHash,
      dependencyTreeHash:
        dependency.dependencyTree.treeHash,
      packageContentHash:
        compiled.packageContentHash,
    },
    runtimePayload,
    requiredModuleClosure,
    occurrences: [
      {
        stageRef:
          "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2" as const,
        outputStagePhysicalIdentityHash:
          state.first.compiled
            .outputStagePhysicalIdentityHash,
        moduleSetHash,
      },
      {
        stageRef:
          "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2" as const,
        outputStagePhysicalIdentityHash:
          state.second.compiled
            .outputStagePhysicalIdentityHash,
        moduleSetHash,
      },
    ] as const,
    equalityState:
      "independent_physical_dist_trees_with_equal_code_owned_module_refs" as const,
  };
  return parsePlatformReleaseCompositionModuleClosureForTestV2({
    ...identity,
    derivationHash:
      hashPlatformReleaseCompositionModuleClosureForTestV2(
        identity,
      ),
  });
}

export async function derivePlatformReleaseCompositionModuleClosureForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): Promise<PlatformReleaseCompositionModuleClosureForTestV2Inspection> {
  let state: DependencyMaterializedPairStateV2;
  try {
    state = authenticDependencyMaterializedPairStateV2(
      handle,
    );
  } catch (error) {
    return failCompositionModuleClosureForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_INPUT_INVALID",
      "Module-closure derivation requires one authentic dependency-pair capability",
      error,
    );
  }
  if (state.admissionScope !== "test_fixture") {
    return failCompositionModuleClosureForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_SCOPE_MISMATCH",
      "Test module-closure derivation cannot consume production authority",
    );
  }
  try {
    const before =
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        handle,
      );
    const inspection =
      deriveCompositionModuleClosureInspectionForTestV2(
        state,
      );
    const after =
      await revalidatePlatformReleaseDependencyMaterializedPairV2(
        handle,
      );
    if (
      state.ownership.lifecycle !== "ready"
      || canonicalJsonStringify(before)
        !== canonicalJsonStringify(after)
      || after.inspectionHash
        !== inspection.dependencyPairInspectionHash
    ) {
      return failCompositionModuleClosureForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed across zero-caller module-closure derivation",
      );
    }
    return inspection;
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseCompositionModuleClosureForTestErrorV2
    ) throw error;
    if (
      error instanceof
        PlatformReleaseDependencyMaterializedPairErrorV2
      || error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
      || error instanceof
        PlatformReleaseHostNodeToolchainAuthorityErrorV2
    ) {
      return failCompositionModuleClosureForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_PAIR_DRIFT",
        "Dependency pair or its private host composition failed fresh module-closure revalidation",
        error,
      );
    }
    return failCompositionModuleClosureForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_CLOSURE_TEST_V2_OUTPUT_INVALID",
      "Authentic dependency pair could not produce a canonical module-closure derivation",
      error,
    );
  }
}

type CompositionModuleExportProbeResultForTestV2 = Readonly<{
  status:
    | "exited"
    | "spawn_failed"
    | "timed_out"
    | "output_limit_exceeded";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  pid: number;
  stdout: Buffer;
  stderr: Buffer;
  startedAt: number;
  finishedAt: number;
}>;

function compositionModuleExportModeTextForTestV2(
  stat: BigIntStats,
): string {
  return modeBits(stat).toString(8).padStart(4, "0");
}

function captureCompositionModuleExportFileForTestV2(
  absolutePath: string,
  hostIdentityHash: string,
  expectedMode: "0444" | "any" = "0444",
): PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
  "moduleObservation"
] {
  let descriptor = -1;
  try {
    const pathBefore = lstatSync(
      absolutePath,
      { bigint: true },
    );
    if (
      pathBefore.isSymbolicLink()
      || !pathBefore.isFile()
      || pathBefore.nlink !== 1n
      || pathBefore.size < 1n
      || pathBefore.size > BigInt(
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2,
      )
      || (
        expectedMode !== "any"
        && compositionModuleExportModeTextForTestV2(
          pathBefore,
        ) !== expectedMode
      )
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
        "Module-export target is not one bounded single-link immutable file",
      );
    }
    descriptor = openSync(
      absolutePath,
      constants.O_RDONLY
        | (constants.O_NOFOLLOW ?? 0)
        | ((constants as unknown as Record<string, number>)
          .O_CLOEXEC ?? 0),
    );
    const descriptorBefore = fstatSync(
      descriptor,
      { bigint: true },
    );
    if (
      pathBefore.dev !== descriptorBefore.dev
      || pathBefore.ino !== descriptorBefore.ino
      || !sameStat(pathBefore, descriptorBefore)
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
        "Module-export target changed between path and descriptor admission",
      );
    }
    const digest = createHash("sha256");
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = readSync(
        descriptor,
        buffer,
        0,
        buffer.byteLength,
        null,
      );
      if (count === 0) break;
      byteLength += count;
      if (
        byteLength
          > PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_MODULE_BYTES_V2
      ) {
        buffer.fill(0);
        return failCompositionModuleExportsForTestV2(
          "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
          "Module-export target exceeded its descriptor byte bound",
        );
      }
      digest.update(buffer.subarray(0, count));
    }
    buffer.fill(0);
    const descriptorAfter = fstatSync(
      descriptor,
      { bigint: true },
    );
    const pathAfter = lstatSync(
      absolutePath,
      { bigint: true },
    );
    if (
      byteLength !== Number(descriptorAfter.size)
      || !sameStat(descriptorBefore, descriptorAfter)
      || !sameStat(descriptorAfter, pathAfter)
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
        "Module-export target changed during descriptor observation",
      );
    }
    const stableIdentity = {
      hostIdentityHash,
      objectKind: "ordinary_file" as const,
      device: descriptorAfter.dev.toString(10),
      inode: descriptorAfter.ino.toString(10),
    };
    const mutableFingerprint = {
      ownerUid: boundedStatOwnerId(descriptorAfter.uid),
      ownerGid: boundedStatOwnerId(descriptorAfter.gid),
      mode:
        compositionModuleExportModeTextForTestV2(
          descriptorAfter,
        ),
      linkCount: 1 as const,
      byteLength,
      contentHash: digest.digest("hex"),
      modifiedTimeNanoseconds:
        descriptorAfter.mtimeNs.toString(10),
      changedTimeNanoseconds:
        descriptorAfter.ctimeNs.toString(10),
    };
    return Object.freeze({
      stableIdentity,
      mutableFingerprint,
      observationHash:
        hashPlatformReleaseBootstrapModuleExportProbeModuleObservationV2({
          stableIdentity,
          mutableFingerprint,
        }),
    });
  } catch (error) {
    if (
      error instanceof
        PlatformReleaseCompositionModuleExportsForTestErrorV2
    ) throw error;
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
      "Module-export target could not be observed through one descriptor",
      error,
    );
  } finally {
    if (descriptor >= 0) closeSync(descriptor);
  }
}

function runCompositionModuleExportProbeProcessForTestV2(
  input: Readonly<{
    launchContext:
      PlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2;
    payloadRoot: string;
    wireInputCanonical: string;
  }>,
): Promise<CompositionModuleExportProbeResultForTestV2> {
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let status:
      CompositionModuleExportProbeResultForTestV2["status"] =
        "exited";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let child: ChildProcess;
    const startedAt = Date.now();
    const settle = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks);
      const stderr = Buffer.concat(stderrChunks);
      for (const chunk of stdoutChunks) chunk.fill(0);
      for (const chunk of stderrChunks) chunk.fill(0);
      stdoutChunks.length = 0;
      stderrChunks.length = 0;
      resolve(Object.freeze({
        status,
        exitCode,
        signal,
        pid: child.pid ?? -1,
        stdout,
        stderr,
        startedAt,
        finishedAt: Date.now(),
      }));
    };
    try {
      child = spawn(
        input.launchContext.nodeExecutablePath,
        [
          input.launchContext
            .releaseBootstrapExecutablePath,
          ...input.launchContext.directArgv,
        ],
        {
          cwd: input.payloadRoot,
          env: {},
          shell: false,
          stdio: ["ignore", "pipe", "pipe", "pipe"],
        },
      );
    } catch (error) {
      const diagnostic = Buffer.from(String(error), "utf8");
      const stderr = Buffer.from(diagnostic.subarray(
        0,
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2,
      ));
      diagnostic.fill(0);
      resolve(Object.freeze({
        status: "spawn_failed",
        exitCode: null,
        signal: null,
        pid: -1,
        stdout: Buffer.alloc(0),
        stderr,
        startedAt,
        finishedAt: Date.now(),
      }));
      return;
    }
    const kill = (): void => {
      try {
        child.kill("SIGKILL");
      } catch {
        // The close event owns final settlement after a concurrent exit.
      }
    };
    timer = setTimeout(() => {
      if (status === "exited") status = "timed_out";
      kill();
    }, input.launchContext.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength;
      if (
        stdoutBytes
          > Math.min(
            input.launchContext.maxStdoutBytes,
            PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2,
          )
      ) {
        status = "output_limit_exceeded";
        kill();
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.byteLength;
      if (
        stderrBytes
          > Math.min(
            input.launchContext.maxStderrBytes,
            PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2,
          )
      ) {
        status = "output_limit_exceeded";
        kill();
        return;
      }
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", (error) => {
      status = "spawn_failed";
      stderrChunks.push(Buffer.from(String(error), "utf8"));
      settle(null, null);
    });
    child.once("close", (exitCode, signal) =>
      settle(exitCode, signal));
    const fd3 = child.stdio[3];
    if (
      !fd3
      || typeof fd3 === "string"
      || typeof (fd3 as { end?: unknown }).end !== "function"
      || typeof (fd3 as { once?: unknown }).once !== "function"
    ) {
      status = "spawn_failed";
      kill();
      return;
    }
    const inputDescriptor = fd3 as {
      once(
        event: "error",
        listener: (error: Error) => void,
      ): void;
      end(value: string): void;
    };
    inputDescriptor.once("error", (error) => {
      if (settled) return;
      status = "spawn_failed";
      const diagnostic = Buffer.from(String(error), "utf8");
      const boundedDiagnostic = diagnostic.subarray(
        0,
        Math.max(
          0,
          PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_MAX_OUTPUT_BYTES_V2
            - stderrBytes,
        ),
      );
      stderrBytes += boundedDiagnostic.byteLength;
      stderrChunks.push(Buffer.from(boundedDiagnostic));
      diagnostic.fill(0);
      kill();
    });
    inputDescriptor.end(
      input.wireInputCanonical,
    );
  });
}

const COMPOSITION_MODULE_EXPORT_WIRE_INPUT_SCHEMA_V2 =
  "setfarm.platform-release-module-export-probe-input.v2" as const;
const COMPOSITION_MODULE_EXPORT_WIRE_OUTPUT_SCHEMA_V2 =
  "setfarm.platform-release-module-export-probe-receipt.v2" as const;

const COMPOSITION_MODULE_EXPORT_OPERATION_FAILURE_DIAGNOSTICS_V2 =
  Object.freeze(new Map<string, readonly string[]>([
    [
      "POLICY_MISMATCH\0MODULE_EXPORT_POLICY_V2\0terminal",
      [
        "MODULE_EXPORT_REQUIREMENT_INVALID",
        "MODULE_EXPORT_LOCATOR_INVALID",
      ],
    ],
    [
      "AUTHORITY_DRIFT\0MODULE_EXPORT_CONTENT_FENCE_V2\0retry_after_authority_delta",
      ["MODULE_EXPORT_CONTENT_MISMATCH"],
    ],
    [
      "OUTPUT_INVALID\0MODULE_EXPORT_OBSERVATION_V2\0terminal",
      [
        "MODULE_EXPORT_OBSERVATION_MISMATCH",
        "MODULE_EXPORT_OBSERVER_PROCESS_FAILED",
      ],
    ],
    [
      "INTERNAL_FAILURE\0MODULE_EXPORT_EXECUTION_V2\0terminal",
      ["MODULE_EXPORT_INTERNAL_FAILURE"],
    ],
  ]));

function parseCompositionModuleExportOperationFailureForTestV2(
  stdout: Buffer,
  expected: Readonly<{
    occurrenceId: string;
    hostCompositionReceiptHash: string;
  }>,
): Readonly<Record<string, unknown>> {
  const parsed = JSON.parse(stdout.toString("utf8"));
  const receipt = parsePlatformReleaseBootstrapWireMessageV2(
    PLATFORM_RELEASE_BOOTSTRAP_OPERATION_FAILURE_V2_SCHEMA,
    parsed,
  );
  const policyKey = [
    receipt.errorCode,
    receipt.phaseRef,
    receipt.retryDisposition,
  ].join("\0");
  const diagnosticRefs =
    COMPOSITION_MODULE_EXPORT_OPERATION_FAILURE_DIAGNOSTICS_V2
      .get(policyKey);
  if (
    stdout.toString("utf8")
      !== `${canonicalJsonStringify(receipt)}\n`
    || receipt.occurrenceId !== expected.occurrenceId
    || receipt.operationAbiRef
      !== PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2
    || receipt.authorityStateHash
      !== expected.hostCompositionReceiptHash
    || !diagnosticRefs
    || !diagnosticRefs.some((diagnosticRef) =>
      receipt.diagnosticHash
        === hashCanonicalJson({
          schema:
            "setfarm.platform-release-module-export-probe-diagnostic-hash.v2",
          diagnosticRef,
        }))
  ) {
    throw new TypeError(
      "Module-export operation failure receipt detached from its request or code-owned failure policy",
    );
  }
  return receipt;
}

function parseCompositionModuleExportOperationOutputForTestV2(
  stdout: Buffer,
  expected: Readonly<{
    occurrenceId: string;
    moduleRef: string;
    moduleContentHash: string;
    requiredExportSetHash: string;
    observedExportKindSetHash: string;
    observedExportCount: number;
    hostCompositionReceiptHash: string;
  }>,
): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.toString("utf8"));
  } catch (error) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OUTPUT_INVALID",
      "Module-export child did not emit canonical JSON",
      error,
    );
  }
  let receipt: Readonly<Record<string, unknown>>;
  try {
    receipt = parsePlatformReleaseBootstrapWireMessageV2(
      COMPOSITION_MODULE_EXPORT_WIRE_OUTPUT_SCHEMA_V2,
      parsed,
    );
  } catch (error) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OUTPUT_INVALID",
      "Installed module-export operation returned an invalid wire receipt",
      error,
    );
  }
  const observation = {
    occurrenceId: expected.occurrenceId,
    moduleRef: expected.moduleRef,
    moduleContentHash: expected.moduleContentHash,
    loadOutcome: "loaded" as const,
    observedExportCount: expected.observedExportCount,
    observedExportSetHash:
      expected.requiredExportSetHash,
    observedExportKindSetHash:
      expected.observedExportKindSetHash,
    hostCompositionReceiptHash:
      expected.hostCompositionReceiptHash,
  };
  if (
    stdout.toString("utf8")
      !== `${canonicalJsonStringify(receipt)}\n`
    || receipt.occurrenceId !== expected.occurrenceId
    || receipt.moduleRef !== expected.moduleRef
    || receipt.moduleContentHash
      !== expected.moduleContentHash
    || receipt.loadOutcome !== "loaded"
    || receipt.observedExportCount
      !== expected.observedExportCount
    || receipt.observedExportSetHash
      !== expected.requiredExportSetHash
    || receipt.observedExportKindSetHash
      !== expected.observedExportKindSetHash
    || receipt.hostCompositionReceiptHash
      !== expected.hostCompositionReceiptHash
    || receipt.moduleLoadObservationHash
      !== hashPlatformReleaseBootstrapModuleExportLoadObservationV2(
        observation,
      )
  ) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OUTPUT_INVALID",
      "Installed module-export operation receipt detached from its exact request or observation",
    );
  }
  return receipt;
}

function compositionModuleExportProcessEvidenceForTestV2(
  result: CompositionModuleExportProbeResultForTestV2,
  nodeExecutable:
    PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
      "moduleObservation"
    ],
  argvHash: string,
): PlatformReleaseBootstrapModuleExportProbeProcessEvidenceV2 {
  const base = {
    executableRef: "NODE_RUNTIME_V2" as const,
    executableStableIdentity:
      nodeExecutable.stableIdentity,
    executableMutableFingerprint:
      nodeExecutable.mutableFingerprint,
    executableContentHash:
      nodeExecutable.mutableFingerprint.contentHash,
    argvHash,
    environmentPolicy:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_ENVIRONMENT_POLICY_V2,
    shell: "forbidden" as const,
    pid: result.pid,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    status: result.status,
    exitCode: result.exitCode,
    signal: result.signal,
    stdoutByteLength: result.stdout.byteLength,
    stderrByteLength: result.stderr.byteLength,
    stdoutHash: sha256(result.stdout),
    stderrHash: sha256(result.stderr),
  };
  return Object.freeze({
    ...base,
    processOccurrenceHash:
      hashPlatformReleaseBootstrapModuleExportProbeProcessOccurrenceV2(
        base,
      ),
  });
}

type CompositionNodeExecutableCaptureForTestV2 = Readonly<{
  absolutePath: string;
  observation:
    PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
      "moduleObservation"
    ];
}>;

function captureCompositionNodeExecutableForTestV2(
  hostIdentityHash: string,
  nodeExecutablePath: string,
): CompositionNodeExecutableCaptureForTestV2 {
  let executable: string;
  try {
    executable = realpathSync(nodeExecutablePath);
  } catch (error) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
      "Module-export Node executable could not be resolved to one physical file",
      error,
    );
  }
  if (executable !== nodeExecutablePath) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
      "Authenticated module-export Node locator is not one direct real path",
    );
  }
  const observation =
    captureCompositionModuleExportFileForTestV2(
      executable,
      hostIdentityHash,
      "any",
    );
  if (
    (Number.parseInt(
      observation.mutableFingerprint.mode,
      8,
    ) & 0o111) === 0
  ) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
      "Module-export Node executable has no executable mode bit",
    );
  }
  return Object.freeze({
    absolutePath: executable,
    observation,
  });
}

function assertCompositionModuleObservationMatchesRefForTestV2(
  observation:
    PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
      "moduleObservation"
    ],
  moduleRef: PlatformReleaseModuleRefV2,
  label: string,
): void {
  if (
    observation.mutableFingerprint.contentHash
      !== moduleRef.contentHash
    || observation.mutableFingerprint.byteLength
      !== moduleRef.byteLength
    || observation.mutableFingerprint.mode
      !== moduleRef.mode
  ) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
      `${label} no longer equals its code-owned module ref`,
    );
  }
}

async function observeCompositionModuleExportForTestV2(
  input: Readonly<{
    moduleRef: PlatformReleaseModuleRefV2;
    operationModuleRef: string;
    requiredExports:
      readonly PlatformReleaseBootstrapModuleExportProbeExportV2[];
    firstPayloadRoot: string;
    secondPayloadRoot: string;
    hostIdentityHash: string;
    hostCompositionReceiptHash: string;
    dependencyPairState:
      DependencyMaterializedPairStateV2;
    sourceState: SourceStageStateV2;
    hostToolchain:
      PlatformReleaseHostNodeToolchainAuthorityV2;
    launchContext:
      PlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2;
    nodeExecutable:
      PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
        "moduleObservation"
      ];
    argvHash: string;
    challengeHash: string;
  }>,
): Promise<PlatformReleaseBootstrapModuleExportProbeV2> {
  const requiredExports = [...input.requiredExports];
  const payloadRoots = [
    input.firstPayloadRoot,
    input.secondPayloadRoot,
  ] as const;
  const modulePaths = payloadRoots.map((payloadRoot) =>
    path.join(payloadRoot, input.moduleRef.moduleLocator)) as [
      string,
      string,
  ];
  const observationsBefore = modulePaths.map(
    (modulePath) =>
      captureCompositionModuleExportFileForTestV2(
        modulePath,
        input.hostIdentityHash,
      ),
  ) as [
    PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
      "moduleObservation"
    ],
    PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[
      "moduleObservation"
    ],
  ];
  observationsBefore.forEach((observation, index) =>
    assertCompositionModuleObservationMatchesRefForTestV2(
      observation,
      input.moduleRef,
      `${index === 0 ? "First" : "Second"} module occurrence`,
    ));

  const requiredExportSetHash =
    hashPlatformReleaseBootstrapModuleExportProbeExportSetV2(
      requiredExports,
    );
  const expectedObservedExportKindSetHash =
    hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2(
      requiredExports,
    );
  const occurrences:
    PlatformReleaseBootstrapModuleExportProbeOccurrenceV2[] = [];
  for (const [index, modulePath] of modulePaths.entries()) {
    const childPairBefore =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        input.dependencyPairState,
        input.sourceState,
      );
    const childLaunchContextBefore =
      await acquirePlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2(
        input.hostToolchain,
      );
    const childNodeBefore =
      captureCompositionNodeExecutableForTestV2(
        input.hostIdentityHash,
        childLaunchContextBefore.nodeExecutablePath,
      );
    if (
      canonicalJsonStringify(childPairBefore)
        !== canonicalJsonStringify(
          input.dependencyPairState.inspection,
        )
      || canonicalJsonStringify(childLaunchContextBefore)
        !== canonicalJsonStringify(input.launchContext)
      || canonicalJsonStringify(childNodeBefore.observation)
        !== canonicalJsonStringify(input.nodeExecutable)
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
        "Module-export child launch authority changed before process execution",
      );
    }
    const occurrenceId = randomUUID().toUpperCase();
    const wireInputIdentity = {
      schema:
        COMPOSITION_MODULE_EXPORT_WIRE_INPUT_SCHEMA_V2,
      version: "2.0.0" as const,
      occurrenceId,
      moduleRef: input.operationModuleRef,
      moduleContentHash: input.moduleRef.contentHash,
      requiredExportSetHash,
      hostCompositionReceiptHash:
        input.hostCompositionReceiptHash,
    };
    const wireInput =
      parsePlatformReleaseBootstrapWireMessageV2(
        COMPOSITION_MODULE_EXPORT_WIRE_INPUT_SCHEMA_V2,
        {
          ...wireInputIdentity,
          messageHash:
            hashPlatformReleaseBootstrapWireMessageV2(
              COMPOSITION_MODULE_EXPORT_WIRE_INPUT_SCHEMA_V2,
              wireInputIdentity,
            ),
        },
      );
    const result =
      await runCompositionModuleExportProbeProcessForTestV2({
        launchContext: childLaunchContextBefore,
        payloadRoot: payloadRoots[index]!,
        wireInputCanonical:
          canonicalJsonStringify(wireInput),
      });
    let childLaunchContextAfter:
      PlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2;
    let childNodeAfter:
      ReturnType<
        typeof captureCompositionNodeExecutableForTestV2
      >;
    let childPairAfter:
      PlatformReleaseDependencyMaterializedPairInspectionV2;
    try {
      childPairAfter =
        await revalidateClaimedDependencyMaterializedPairForProbeV2(
          input.dependencyPairState,
          input.sourceState,
        );
      childLaunchContextAfter =
        await acquirePlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2(
          input.hostToolchain,
        );
      childNodeAfter =
        captureCompositionNodeExecutableForTestV2(
          input.hostIdentityHash,
          childLaunchContextAfter.nodeExecutablePath,
        );
    } catch (error) {
      result.stdout.fill(0);
      result.stderr.fill(0);
      throw error;
    }
    if (
      canonicalJsonStringify(childPairAfter)
        !== canonicalJsonStringify(childPairBefore)
      || canonicalJsonStringify(childLaunchContextAfter)
        !== canonicalJsonStringify(childLaunchContextBefore)
      || canonicalJsonStringify(childNodeAfter)
        !== canonicalJsonStringify(childNodeBefore)
    ) {
      result.stdout.fill(0);
      result.stderr.fill(0);
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
        "Module-export child launch authority changed across process settlement",
      );
    }
    const processEvidence =
      compositionModuleExportProcessEvidenceForTestV2(
        result,
        input.nodeExecutable,
        input.argvHash,
      );
    if (
      result.status !== "exited"
      || result.exitCode !== 0
      || result.signal !== null
      || result.stderr.byteLength !== 0
    ) {
      let authenticatedOperationFailure = false;
      if (
        result.status === "exited"
        && result.exitCode === 1
        && result.signal === null
        && result.stderr.byteLength === 0
        && result.stdout.byteLength > 0
      ) {
        try {
          parseCompositionModuleExportOperationFailureForTestV2(
            result.stdout,
            {
              occurrenceId,
              hostCompositionReceiptHash:
                input.hostCompositionReceiptHash,
            },
          );
          authenticatedOperationFailure = true;
        } catch {
          // Invalid failure output remains an opaque process failure.
        }
      }
      result.stdout.fill(0);
      result.stderr.fill(0);
      return failCompositionModuleExportsForTestV2(
        authenticatedOperationFailure
          ? "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OPERATION_REJECTED"
          : "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PROCESS_FAILED",
        `Module-export operation ${authenticatedOperationFailure ? "returned one authenticated failure receipt" : "child failed"} for ${input.operationModuleRef} at the ${index === 0 ? "first" : "second"} physical occurrence`,
      );
    }
    try {
      parseCompositionModuleExportOperationOutputForTestV2(
        result.stdout,
        {
          occurrenceId,
          moduleRef: input.operationModuleRef,
          moduleContentHash: input.moduleRef.contentHash,
          requiredExportSetHash,
          observedExportKindSetHash:
            expectedObservedExportKindSetHash,
          observedExportCount: requiredExports.length,
          hostCompositionReceiptHash:
            input.hostCompositionReceiptHash,
        },
      );
    } finally {
      result.stdout.fill(0);
      result.stderr.fill(0);
    }
    const observedExports = [...requiredExports];
    const observedExportSetHash =
      hashPlatformReleaseBootstrapModuleExportProbeExportSetV2(
        observedExports,
      );
    const observedExportKindSetHash =
      hashPlatformReleaseBootstrapModuleExportProbeExportKindSetV2(
        observedExports,
      );
    const semanticProjectionHash =
      hashPlatformReleaseBootstrapModuleExportProbeStableProjectionV2({
        moduleRefHash: input.moduleRef.moduleRefHash,
        requiredExportSetHash,
        observedExportSetHash,
        observedExportKindSetHash,
        semanticOutcome: "required_exports_loaded",
      });
    const occurrenceIdentity = {
      occurrenceRef:
        index === 0 ? "first" as const : "second" as const,
      moduleObservation: observationsBefore[index]!,
      observedExports,
      observedExportSetHash,
      observedExportKindSetHash,
      semanticOutcome: "required_exports_loaded" as const,
      semanticProjectionHash,
      process: processEvidence,
    };
    occurrences.push(Object.freeze({
      ...occurrenceIdentity,
      occurrenceHash:
        hashPlatformReleaseBootstrapModuleExportProbeOccurrenceV2(
          occurrenceIdentity,
        ),
    }));
  }

  const observationsAfter = modulePaths.map(
    (modulePath) =>
      captureCompositionModuleExportFileForTestV2(
        modulePath,
        input.hostIdentityHash,
      ),
  );
  if (
    observationsBefore.some(
      (observation, index) =>
        canonicalJsonStringify(observation)
          !== canonicalJsonStringify(
            observationsAfter[index],
          ),
    )
    || occurrences.length !== 2
    || occurrences[0]!.semanticProjectionHash
      !== occurrences[1]!.semanticProjectionHash
  ) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_FILESYSTEM_DRIFT",
      "Module occurrences changed across their distinct-process export observations",
    );
  }
  const identity = {
    schema:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "observed_test_fixture_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    operationAbiRef:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
    operationAbiHash:
      PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
    hostCompositionReceiptHash:
      input.hostCompositionReceiptHash,
    challengeHash: input.challengeHash,
    moduleRef: input.moduleRef,
    requiredExports,
    requiredExportSetHash,
    occurrences: [occurrences[0]!, occurrences[1]!] as const,
    stableProjectionHash:
      occurrences[0]!.semanticProjectionHash,
  };
  return parsePlatformReleaseBootstrapModuleExportProbeCandidateV2({
    ...identity,
    probeHash:
      hashPlatformReleaseBootstrapModuleExportProbeV2(
        identity,
      ),
  });
}

async function revalidateClaimedDependencyMaterializedPairForProbeV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
): Promise<PlatformReleaseDependencyMaterializedPairInspectionV2> {
  if (
    state.ownership.lifecycle !== "probing"
    || sourceState.lifecycle !== "dependency_materializing"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Claimed dependency pair no longer owns its shared probe lifecycle",
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
      "Claimed dependency-pair probe lost its authentic build-toolchain authority",
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
      state.ownership.lifecycle !== "probing"
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
        "Claimed dependency-pair probe lost exact ownership during fresh revalidation",
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
        "Claimed dependency-pair probe differs from its issued authority",
      );
    }
    return captured.inspection;
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
        "Claimed dependency-pair probe lost exact source or toolchain authority",
      );
    }
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      "Claimed dependency-pair probe failed fresh revalidation",
      error,
    );
  }
}

function invalidateModuleExportProbePairForTestV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
  fenceFailure?: unknown,
): never {
  state.ownership.lifecycle = "invalidated";
  const exactOwnedRoots =
    sourceState.lifecycle === "dependency_materializing"
    && sourceState.ownedOutputRoots.cleanupState === "open"
    && sourceState.ownedOutputRoots.first
      === state.first.compiled.slot
    && sourceState.ownedOutputRoots.second
      === state.second.compiled.slot;
  if (exactOwnedRoots) {
    try {
      disposeSourceOwnedPhysicalContextV2(sourceState);
    } catch (cleanupError) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_CLEANUP_FAILED",
        "Invalid module-export probe pair could not destroy its exact source-owned roots",
        new AggregateError([
          primaryFailure,
          ...(fenceFailure === undefined
            ? []
            : [fenceFailure]),
          cleanupError,
        ]),
      );
    }
  }
  return failCompositionModuleExportsForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
    "Dependency pair or probe executable changed across its exclusive observation fence",
    new AggregateError([
      primaryFailure,
      ...(fenceFailure === undefined ? [] : [fenceFailure]),
    ]),
  );
}

function mapCompositionModuleExportFailureForTestV2(
  error: unknown,
): never {
  if (
    error instanceof
      PlatformReleaseCompositionModuleExportsForTestErrorV2
  ) throw error;
  if (
    error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    || error instanceof
      PlatformReleaseBuildToolchainCapsuleErrorV2
    || error instanceof
      PlatformReleaseHostNodeToolchainAuthorityErrorV2
  ) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
      "Dependency pair or its private host composition failed module-export observation",
      error,
    );
  }
  return failCompositionModuleExportsForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_OUTPUT_INVALID",
    "Authentic dependency pair could not produce canonical module-export observations",
    error,
  );
}

export async function observePlatformReleaseCompositionModuleExportsForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): Promise<PlatformReleaseCompositionModuleExportsForTestV2Inspection> {
  let state: DependencyMaterializedPairStateV2;
  try {
    state = authenticDependencyMaterializedPairStateV2(
      handle,
    );
  } catch (error) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_INPUT_INVALID",
      "Module-export observation requires one authentic dependency-pair capability",
      error,
    );
  }
  if (state.admissionScope !== "test_fixture") {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_SCOPE_MISMATCH",
      "Test module-export observation cannot consume production authority",
    );
  }
  if (state.ownership.lifecycle !== "ready") {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_ALREADY_CLAIMED",
      "Dependency pair already has an exclusive consumer or probe claim",
    );
  }
  const sourceState = sourceStageStatesV2.get(
    state.sourceStage,
  );
  if (
    !sourceState
    || sourceState.lifecycle !== "dependency_materializing"
    || sourceState.ownedOutputRoots.cleanupState !== "open"
    || sourceState.ownedOutputRoots.first
      !== state.first.compiled.slot
    || sourceState.ownedOutputRoots.second
      !== state.second.compiled.slot
  ) {
    return failCompositionModuleExportsForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
      "Dependency pair no longer owns its exact source and output registry",
    );
  }

  // The exclusive read-only claim intentionally precedes the first await.
  state.ownership.lifecycle = "probing";
  let nodeBefore:
    CompositionNodeExecutableCaptureForTestV2
    | undefined;
  let primaryFailure: unknown;
  try {
    const before =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(before)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed before module-export observation",
      );
    }
    const moduleClosure =
      deriveCompositionModuleClosureInspectionForTestV2(
        state,
      );
    const hostToolchain =
      authenticBuildToolchainCapsuleState(
        state.buildToolchain,
      ).hostToolchain;
    const launchContext =
      await acquirePlatformReleaseHostNodeToolchainModuleExportLaunchContextInternalV2(
        hostToolchain,
      );
    const compositionReceipt =
      inspectPlatformReleaseHostNodeToolchainCompositionReceiptInternalV2(
        hostToolchain,
      );
    if (
      compositionReceipt.receiptHash
        !== moduleClosure.hostCompositionReceiptHash
      || launchContext.admissionScope !== "test_fixture"
      || launchContext.hostCompositionReceiptHash
        !== compositionReceipt.receiptHash
      || launchContext.hostIdentityHash
        !== compositionReceipt.platformHost.hostIdentityHash
      || launchContext.operationAbiRef
        !== PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2
      || launchContext.operationAbiHash
        !== PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2
      || launchContext.workingDirectoryPolicy
        !== "authenticated_target_root_v2"
      || launchContext.environmentPolicy
        !== "exact_empty_environment_v2"
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
        "Module closure and live host composition receipt no longer agree",
      );
    }
    nodeBefore = captureCompositionNodeExecutableForTestV2(
      compositionReceipt.platformHost.hostIdentityHash,
      launchContext.nodeExecutablePath,
    );
    if (
      nodeBefore.observation.mutableFingerprint.contentHash
        !== launchContext.nodeExecutableContentHash
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
        "Authenticated Node launch context detached from its physical executable",
      );
    }
    const argvHash = hashCanonicalJson({
      schema:
        "setfarm.platform-release-composition-module-export-probe-child-argv.v2",
      operationAbiRef:
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_REF_V2,
      operationAbiHash:
        PLATFORM_RELEASE_BOOTSTRAP_MODULE_EXPORT_PROBE_OPERATION_ABI_HASH_V2,
      directArgv: launchContext.directArgv,
      nodeIdentityHash: launchContext.nodeIdentityHash,
      nodeExecutableContentHash:
        launchContext.nodeExecutableContentHash,
      releaseBootstrapExecutableContentHash:
        launchContext.releaseBootstrapExecutableContentHash,
      releaseBootstrapExecutablePhysicalIdentityHash:
        launchContext.releaseBootstrapExecutablePhysicalIdentityHash,
      releaseBootstrapModuleContentHash:
        launchContext.releaseBootstrapModuleContentHash,
      releaseBootstrapModulePhysicalIdentityHash:
        launchContext.releaseBootstrapModulePhysicalIdentityHash,
      workingDirectoryPolicy:
        launchContext.workingDirectoryPolicy,
      environmentPolicy:
        launchContext.environmentPolicy,
    });
    const challengeSeed = randomBytes(32);
    const challengeSeedHash = sha256(challengeSeed);
    challengeSeed.fill(0);
    const entries =
      moduleClosure.requiredModuleClosure.entries;
    const probes:
      PlatformReleaseBootstrapModuleExportProbeV2[] = [];
    for (const [index, entry] of entries.entries()) {
      const challengeHash = hashCanonicalJson({
        schema:
          "setfarm.platform-release-composition-module-export-challenge-hash.v2",
        challengeSeedHash,
        index,
        moduleRefHash: entry.module.moduleRefHash,
      });
      probes.push(
        await observeCompositionModuleExportForTestV2({
          moduleRef: entry.module,
          operationModuleRef:
            getPlatformReleaseRequiredModuleOperationRefV2(
              entry.definition.role,
            ),
          requiredExports:
            entry.definition.requiredExports,
          firstPayloadRoot: path.join(
            state.first.compiled.slot.outputRoot.absolutePath,
            "payload",
          ),
          secondPayloadRoot: path.join(
            state.second.compiled.slot.outputRoot.absolutePath,
            "payload",
          ),
          hostIdentityHash:
            compositionReceipt.platformHost.hostIdentityHash,
          hostCompositionReceiptHash:
            compositionReceipt.receiptHash,
          dependencyPairState: state,
          sourceState,
          hostToolchain,
          launchContext,
          nodeExecutable: nodeBefore.observation,
          argvHash,
          challengeHash,
        }),
      );
    }
    const after =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    const nodeAfter =
      captureCompositionNodeExecutableForTestV2(
        compositionReceipt.platformHost.hostIdentityHash,
        launchContext.nodeExecutablePath,
      );
    if (
      canonicalJsonStringify(after)
        !== canonicalJsonStringify(state.inspection)
      || canonicalJsonStringify(nodeBefore)
        !== canonicalJsonStringify(nodeAfter)
      || probes.length !== entries.length
      || probes.length !== 17
      || state.ownership.lifecycle !== "probing"
    ) {
      return failCompositionModuleExportsForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_PAIR_DRIFT",
        "Dependency pair, Node executable or required module set changed across observation",
      );
    }
    const identity = {
      schema:
        PLATFORM_RELEASE_COMPOSITION_MODULE_EXPORTS_TEST_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState:
        "test_fixture_module_exports_observed_unverified" as const,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      productionAdmission: "forbidden" as const,
      productionUse:
        "forbidden_until_authenticated_installed_probe_and_verified_release" as const,
      credentialUse: "none" as const,
      mutationAuthority: false as const,
      trustConclusion: "characterization_only" as const,
      operationMode:
        "authentic_dependency_pair_zero_caller_dual_occurrence_required_export_observation" as const,
      operationExecutionState:
        "authenticated_test_host_composition_fixed_abi_fd3_isolated_observer_child" as const,
      callerJsonState: "absent" as const,
      pairLeaseState:
        "exclusive_probe_claim_released_after_fresh_post_fence" as const,
      terminalizationState:
        "not_performed_manifest_and_attestation_still_required" as const,
      dependencyPairInspectionHash:
        state.inspection.inspectionHash,
      moduleClosureDerivation: moduleClosure,
      probes,
      stableProjectionSetHash:
        hashPlatformReleaseCompositionModuleExportStableSetForTestV2(
          probes,
        ),
    };
    const inspection =
      parsePlatformReleaseCompositionModuleExportsForTestV2({
        ...identity,
        collectionHash:
          hashPlatformReleaseCompositionModuleExportsForTestV2(
            identity,
          ),
      });
    state.ownership.lifecycle = "ready";
    return inspection;
  } catch (error) {
    primaryFailure = error;
  }

  try {
    if (
      state.ownership.lifecycle !== "probing"
      || sourceState.lifecycle !== "dependency_materializing"
    ) {
      return invalidateModuleExportProbePairForTestV2(
        state,
        sourceState,
        primaryFailure,
      );
    }
    const afterFailure =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(afterFailure)
        !== canonicalJsonStringify(state.inspection)
      || (
        nodeBefore !== undefined
        && canonicalJsonStringify(nodeBefore)
          !== canonicalJsonStringify(
            captureCompositionNodeExecutableForTestV2(
              nodeBefore.observation.stableIdentity
                .hostIdentityHash,
              nodeBefore.absolutePath,
            ),
          )
      )
    ) {
      return invalidateModuleExportProbePairForTestV2(
        state,
        sourceState,
        primaryFailure,
      );
    }
    state.ownership.lifecycle = "ready";
  } catch (fenceFailure) {
    return invalidateModuleExportProbePairForTestV2(
      state,
      sourceState,
      primaryFailure,
      fenceFailure,
    );
  }
  return mapCompositionModuleExportFailureForTestV2(
    primaryFailure,
  );
}

function metadataPairOccurrenceForTestV2(
  stageRef:
    | "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2"
    | "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
  occurrenceState: DependencyMaterializedOccurrenceStateV2,
  stableOutputBindingHash: string,
  occurrence:
    PlatformReleaseBootstrapInstalledMetadataOperationOccurrenceInternalV2,
) {
  const launchProjectionHash =
    hashPlatformReleaseCompositionMetadataLaunchProjectionForTestV2(
      occurrence.process,
    );
  const identity = {
    stageRef,
    outputStagePhysicalIdentityHash:
      occurrenceState.compiled.outputStagePhysicalIdentityHash,
    stableOutputBindingHash,
    ...occurrence,
    launchProjectionHash,
    stableProjectionHash:
      hashPlatformReleaseCompositionMetadataPairStableProjectionForTestV2({
        operationAbiRef:
          PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
        operationAbiHash:
          PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
        metadataPolicyHash: occurrence.metadataPolicyHash,
        hostIdentityHash: occurrence.hostIdentityHash,
        platformHostToolchainReceiptHash:
          occurrence.platformHostToolchainReceiptHash,
        hostCompositionReceiptHash:
          occurrence.hostCompositionReceiptHash,
        stableOutputBindingHash,
        targetEntryNamesHash:
          occurrence.receipt.targetEntryNamesHash,
        observedEntryCount:
          occurrence.receipt.observedEntryCount,
        observationOutcome:
          occurrence.receipt.observationOutcome,
        metadataStableProjectionHash:
          occurrence.receipt.stableMetadataProjectionHash,
        launchProjectionHash,
      }),
  };
  return Object.freeze({
    ...identity,
    occurrenceHash:
      hashPlatformReleaseCompositionMetadataPairOccurrenceForTestV2(
        identity,
      ),
  });
}

function metadataPairFailureRequiresInvalidationForTestV2(
  error: unknown,
): boolean {
  return error instanceof
      PlatformReleaseCompositionMetadataPairForTestErrorV2
      && error.code
        === "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT"
    || error instanceof
        PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
      && (
        error.code
          === "INSTALLED_METADATA_OPERATION_FILESYSTEM_DRIFT"
        || error.code
          === "INSTALLED_METADATA_OPERATION_LAUNCH_AUTHORITY_DRIFT"
      )
    || error instanceof
        PlatformReleaseDependencyMaterializedPairErrorV2
    || error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
    || error instanceof
        PlatformReleaseHostNodeToolchainAuthorityErrorV2;
}

function invalidateMetadataPairProbeForTestV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
  fenceFailure?: unknown,
): never {
  state.ownership.lifecycle = "invalidated";
  const exactOwnedRoots =
    sourceState.lifecycle === "dependency_materializing"
    && sourceState.ownedOutputRoots.cleanupState === "open"
    && sourceState.ownedOutputRoots.first
      === state.first.compiled.slot
    && sourceState.ownedOutputRoots.second
      === state.second.compiled.slot;
  if (exactOwnedRoots) {
    try {
      disposeSourceOwnedPhysicalContextV2(sourceState);
    } catch (cleanupError) {
      return failCompositionMetadataPairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_CLEANUP_FAILED",
        "Invalid metadata pair could not destroy its exact source-owned roots",
        new AggregateError([
          primaryFailure,
          ...(fenceFailure === undefined
            ? []
            : [fenceFailure]),
          cleanupError,
        ]),
      );
    }
  }
  return failCompositionMetadataPairForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
    "Dependency pair or metadata launch authority changed across its exclusive observation fence",
    new AggregateError([
      primaryFailure,
      ...(fenceFailure === undefined ? [] : [fenceFailure]),
    ]),
  );
}

function mapCompositionMetadataPairFailureForTestV2(
  error: unknown,
): never {
  if (
    error instanceof
      PlatformReleaseCompositionMetadataPairForTestErrorV2
  ) throw error;
  if (
    error instanceof
      PlatformReleaseBootstrapInstalledMetadataOperationErrorV2
  ) {
    if (
      error.code
        === "INSTALLED_METADATA_OPERATION_OPERATION_REJECTED"
    ) {
      return failCompositionMetadataPairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OPERATION_REJECTED",
        "Installed metadata policy returned one authenticated rejection",
        error,
      );
    }
    if (
      error.code === "INSTALLED_METADATA_OPERATION_TIMEOUT"
      || error.code === "INSTALLED_METADATA_OPERATION_OUTPUT_LIMIT"
      || error.code === "INSTALLED_METADATA_OPERATION_SPAWN_FAILED"
      || error.code === "INSTALLED_METADATA_OPERATION_PROCESS_FAILED"
    ) {
      return failCompositionMetadataPairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PROCESS_FAILED",
        "Installed metadata observation child failed without admissible evidence",
        error,
      );
    }
    return failCompositionMetadataPairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OUTPUT_INVALID",
      "Installed metadata observation did not produce one canonical occurrence",
      error,
    );
  }
  if (
    error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    || error instanceof
      PlatformReleaseBuildToolchainCapsuleErrorV2
    || error instanceof
      PlatformReleaseHostNodeToolchainAuthorityErrorV2
  ) {
    return failCompositionMetadataPairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
      "Dependency pair or its private host composition failed metadata observation",
      error,
    );
  }
  return failCompositionMetadataPairForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_OUTPUT_INVALID",
    "Authentic dependency pair could not produce canonical metadata observations",
    error,
  );
}

export async function observePlatformReleaseCompositionMetadataPairForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): Promise<PlatformReleaseCompositionMetadataPairTestV2> {
  let state: DependencyMaterializedPairStateV2;
  try {
    state = authenticDependencyMaterializedPairStateV2(
      handle,
    );
  } catch (error) {
    return failCompositionMetadataPairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_INPUT_INVALID",
      "Metadata observation requires one authentic dependency-pair capability",
      error,
    );
  }
  if (state.admissionScope !== "test_fixture") {
    return failCompositionMetadataPairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_SCOPE_MISMATCH",
      "Test metadata observation cannot consume production authority",
    );
  }
  if (state.ownership.lifecycle !== "ready") {
    return failCompositionMetadataPairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_ALREADY_CLAIMED",
      "Dependency pair already has an exclusive consumer or probe claim",
    );
  }
  const sourceState = sourceStageStatesV2.get(
    state.sourceStage,
  );
  if (
    !sourceState
    || sourceState.lifecycle !== "dependency_materializing"
    || sourceState.ownedOutputRoots.cleanupState !== "open"
    || sourceState.ownedOutputRoots.first
      !== state.first.compiled.slot
    || sourceState.ownedOutputRoots.second
      !== state.second.compiled.slot
  ) {
    return failCompositionMetadataPairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
      "Dependency pair no longer owns its exact source and output registry",
    );
  }

  // The pair-owner claim precedes every asynchronous host or child action.
  state.ownership.lifecycle = "probing";
  let primaryFailure: unknown;
  try {
    const before =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(before)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failCompositionMetadataPairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed before metadata observation",
      );
    }
    const hostToolchain =
      authenticBuildToolchainCapsuleState(
        state.buildToolchain,
      ).hostToolchain;
    const firstRaw =
      await observePlatformReleaseBootstrapInstalledMetadataOperationAtPrivateTargetInternalV2(
        hostToolchain,
        state.first.compiled.slot.outputRoot.absolutePath,
      );
    const between =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(between)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failCompositionMetadataPairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed between metadata occurrences",
      );
    }
    const secondRaw =
      await observePlatformReleaseBootstrapInstalledMetadataOperationAtPrivateTargetInternalV2(
        hostToolchain,
        state.second.compiled.slot.outputRoot.absolutePath,
      );
    const after =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(after)
        !== canonicalJsonStringify(state.inspection)
      || state.ownership.lifecycle !== "probing"
    ) {
      return failCompositionMetadataPairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed across metadata observation",
      );
    }
    const stableOutputBindingHash =
      state.inspection.stableOutput.bindingHash;
    const occurrences = [
      metadataPairOccurrenceForTestV2(
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
        state.first,
        stableOutputBindingHash,
        firstRaw,
      ),
      metadataPairOccurrenceForTestV2(
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
        state.second,
        stableOutputBindingHash,
        secondRaw,
      ),
    ] as const;
    const identity = {
      schema:
        PLATFORM_RELEASE_COMPOSITION_METADATA_PAIR_TEST_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState:
        "test_fixture_dependency_pair_metadata_observed_unverified" as const,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      productionAdmission: "forbidden" as const,
      productionUse:
        "forbidden_until_authenticated_installed_probe_and_verified_release" as const,
      credentialUse: "none" as const,
      mutationAuthority: false as const,
      trustConclusion: "characterization_only" as const,
      targetBinding:
        "authentic_dependency_pair_private_output_roots_v2" as const,
      implementationScope:
        PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_IMPLEMENTATION_SCOPE_V2,
      operationMode:
        "authentic_dependency_pair_zero_caller_dual_occurrence_read_only_metadata_observation" as const,
      callerJsonState: "absent" as const,
      pairLeaseState:
        "exclusive_pair_api_metadata_probe_claim_released_after_fresh_post_fence" as const,
      terminalizationState:
        "not_performed_manifest_and_attestation_still_required" as const,
      limitations: {
        delegateAuthority:
          "wrapper_bytes_censused_delegate_shell_and_apple_tools_not_independently_censused" as const,
        filesystemRaceBoundary:
          "pathname_fences_do_not_close_transient_aba" as const,
        runtimeAccountBoundary:
          "observer_children_execute_as_test_owner_not_receipt_runtime_account" as const,
        testLocatorBoundary:
          "raw_test_callback_locators_may_outlive_api_lease_and_require_all_physical_fences" as const,
      },
      dependencyPairInspectionHash:
        state.inspection.inspectionHash,
      dependencyPairInspection: state.inspection,
      stableOutputBindingHash,
      operationAbiRef:
        PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_REF_V2,
      operationAbiHash:
        PLATFORM_RELEASE_COMPOSITION_METADATA_TEST_OPERATION_ABI_HASH_V2,
      metadataPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_METADATA_OPERATION_POLICY_HASH_V2,
      hostIdentityHash: firstRaw.hostIdentityHash,
      platformHostToolchainReceiptHash:
        firstRaw.platformHostToolchainReceiptHash,
      hostCompositionReceiptHash:
        firstRaw.hostCompositionReceiptHash,
      occurrences,
      stableProjectionHash:
        occurrences[0].stableProjectionHash,
    };
    const inspection =
      parsePlatformReleaseCompositionMetadataPairForTestV2({
        ...identity,
        collectionHash:
          hashPlatformReleaseCompositionMetadataPairForTestV2(
            identity,
          ),
      });
    state.ownership.lifecycle = "ready";
    return inspection;
  } catch (error) {
    primaryFailure = error;
  }

  let fenceFailure: unknown;
  try {
    if (
      state.ownership.lifecycle !== "probing"
      || sourceState.lifecycle !== "dependency_materializing"
    ) {
      throw new Error(
        "Metadata pair lost its exclusive probe lifecycle",
      );
    }
    const afterFailure =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(afterFailure)
        !== canonicalJsonStringify(state.inspection)
    ) {
      throw new Error(
        "Metadata pair changed across failed observation",
      );
    }
  } catch (error) {
    fenceFailure = error;
  }
  if (
    fenceFailure !== undefined
    || metadataPairFailureRequiresInvalidationForTestV2(
      primaryFailure,
    )
  ) {
    return invalidateMetadataPairProbeForTestV2(
      state,
      sourceState,
      primaryFailure,
      fenceFailure,
    );
  }
  state.ownership.lifecycle = "ready";
  return mapCompositionMetadataPairFailureForTestV2(
    primaryFailure,
  );
}

function networkNegativePairOccurrenceForTestV2(
  stageRef:
    | "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2"
    | "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
  occurrenceState: DependencyMaterializedOccurrenceStateV2,
  stableOutputBindingHash: string,
  occurrence:
    PlatformReleaseBootstrapInstalledNetworkNegativeOperationOccurrenceInternalV2,
) {
  if (
    occurrence.receipt.attemptedProbeCount !== 1
    || occurrence.receipt.deniedProbeCount !== 1
  ) {
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_OUTPUT_INVALID",
      "Installed network-negative occurrence widened its exact one-probe relation",
    );
  }
  const launchProjectionHash =
    hashPlatformReleaseCompositionNetworkNegativeLaunchProjectionForTestV2(
      occurrence.process,
    );
  // The installed runner has already required both counts to equal one. Keep
  // that literal relation in the strict pair schema instead of widening it
  // back to the runner's transport-level number type.
  const receipt = Object.freeze({
    ...occurrence.receipt,
    attemptedProbeCount: 1 as const,
    deniedProbeCount: 1 as const,
  });
  const identity = {
    stageRef,
    outputStagePhysicalIdentityHash:
      occurrenceState.compiled.outputStagePhysicalIdentityHash,
    stableOutputBindingHash,
    ...occurrence,
    receipt,
    launchProjectionHash,
    stableProjectionHash:
      hashPlatformReleaseCompositionNetworkNegativePairStableProjectionForTestV2({
        operationAbiRef:
          PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
        operationAbiHash:
          PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
        sandboxPolicyHash: occurrence.sandboxPolicyHash,
        hostIdentityHash: occurrence.hostIdentityHash,
        platformHostToolchainReceiptHash:
          occurrence.platformHostToolchainReceiptHash,
        hostCompositionReceiptHash:
          occurrence.hostCompositionReceiptHash,
        stableOutputBindingHash,
        sandboxProfileHash: receipt.sandboxProfileHash,
        probeProgramHash: receipt.probeProgramHash,
        normalizedEnvironmentHash:
          receipt.normalizedEnvironmentHash,
        probeClosureHash: receipt.probeClosureHash,
        probeOutcome: receipt.probeOutcome,
        attemptedProbeCount: 1,
        deniedProbeCount: 1,
        deniedProbeSetHash:
          receipt.deniedProbeSetHash,
        controlOutcome: receipt.controlOutcome,
        controlSetHash: receipt.controlSetHash,
        networkStableProjectionHash:
          receipt.stableNetworkProjectionHash,
        launchProjectionHash,
      }),
  };
  return Object.freeze({
    ...identity,
    occurrenceHash:
      hashPlatformReleaseCompositionNetworkNegativePairOccurrenceForTestV2(
        identity,
      ),
  });
}

function networkNegativePairFailureRequiresInvalidationForTestV2(
  error: unknown,
): boolean {
  return error instanceof
      PlatformReleaseCompositionNetworkNegativePairForTestErrorV2
      && error.code
        === "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT"
    || error instanceof
        PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2
      && (
        error.code
          === "INSTALLED_NETWORK_NEGATIVE_OPERATION_FILESYSTEM_DRIFT"
        || error.code
          === "INSTALLED_NETWORK_NEGATIVE_OPERATION_LAUNCH_AUTHORITY_DRIFT"
        || error.code
          === "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED"
      )
    || error instanceof
        PlatformReleaseDependencyMaterializedPairErrorV2
    || error instanceof
        PlatformReleaseBuildToolchainCapsuleErrorV2
    || error instanceof
        PlatformReleaseHostNodeToolchainAuthorityErrorV2;
}

function invalidateNetworkNegativePairProbeForTestV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
  fenceFailure?: unknown,
): never {
  state.ownership.lifecycle = "invalidated";
  const exactOwnedRoots =
    sourceState.lifecycle === "dependency_materializing"
    && sourceState.ownedOutputRoots.cleanupState === "open"
    && sourceState.ownedOutputRoots.first
      === state.first.compiled.slot
    && sourceState.ownedOutputRoots.second
      === state.second.compiled.slot;
  if (exactOwnedRoots) {
    try {
      disposeSourceOwnedPhysicalContextV2(sourceState);
    } catch (cleanupError) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_CLEANUP_FAILED",
        "Invalid network-negative pair could not destroy its exact source-owned roots",
        new AggregateError([
          primaryFailure,
          ...(fenceFailure === undefined
            ? []
            : [fenceFailure]),
          cleanupError,
        ]),
      );
    }
  }
  if (
    fenceFailure === undefined
    && primaryFailure instanceof
      PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2
    && primaryFailure.code
      === "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED"
  ) {
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_CLEANUP_FAILED",
      "Network-negative scratch cleanup failure terminally invalidated its dependency pair",
      primaryFailure,
    );
  }
  return failCompositionNetworkNegativePairForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
    "Dependency pair or network-negative launch authority changed across its exclusive observation fence",
    new AggregateError([
      primaryFailure,
      ...(fenceFailure === undefined ? [] : [fenceFailure]),
    ]),
  );
}

function mapCompositionNetworkNegativePairFailureForTestV2(
  error: unknown,
): never {
  if (
    error instanceof
      PlatformReleaseCompositionNetworkNegativePairForTestErrorV2
  ) throw error;
  if (
    error instanceof
      PlatformReleaseBootstrapInstalledNetworkNegativeOperationErrorV2
  ) {
    if (
      error.code
        === "INSTALLED_NETWORK_NEGATIVE_OPERATION_OPERATION_REJECTED"
    ) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_OPERATION_REJECTED",
        "Installed network-negative policy returned one authenticated rejection",
        error,
      );
    }
    if (
      error.code === "INSTALLED_NETWORK_NEGATIVE_OPERATION_TIMEOUT"
      || error.code
        === "INSTALLED_NETWORK_NEGATIVE_OPERATION_OUTPUT_LIMIT"
      || error.code
        === "INSTALLED_NETWORK_NEGATIVE_OPERATION_SPAWN_FAILED"
      || error.code
        === "INSTALLED_NETWORK_NEGATIVE_OPERATION_PROCESS_FAILED"
    ) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PROCESS_FAILED",
        "Installed network-negative child failed without admissible evidence",
        error,
      );
    }
    if (
      error.code
        === "INSTALLED_NETWORK_NEGATIVE_OPERATION_CLEANUP_FAILED"
    ) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_CLEANUP_FAILED",
        "Installed network-negative operation could not clean its exact private scratch",
        error,
      );
    }
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_OUTPUT_INVALID",
      "Installed network-negative operation did not produce one canonical occurrence",
      error,
    );
  }
  if (
    error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
    || error instanceof
      PlatformReleaseBuildToolchainCapsuleErrorV2
    || error instanceof
      PlatformReleaseHostNodeToolchainAuthorityErrorV2
  ) {
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
      "Dependency pair or its private host composition failed network-negative observation",
      error,
    );
  }
  return failCompositionNetworkNegativePairForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_OUTPUT_INVALID",
    "Authentic dependency pair could not produce canonical network-negative observations",
    error,
  );
}

export async function observePlatformReleaseCompositionNetworkNegativePairForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): Promise<PlatformReleaseCompositionNetworkNegativePairTestV2> {
  let state: DependencyMaterializedPairStateV2;
  try {
    state = authenticDependencyMaterializedPairStateV2(
      handle,
    );
  } catch (error) {
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_INPUT_INVALID",
      "Network-negative observation requires one authentic dependency-pair capability",
      error,
    );
  }
  if (state.admissionScope !== "test_fixture") {
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_SCOPE_MISMATCH",
      "Test network-negative observation cannot consume production authority",
    );
  }
  if (state.ownership.lifecycle !== "ready") {
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_ALREADY_CLAIMED",
      "Dependency pair already has an exclusive consumer or probe claim",
    );
  }
  const sourceState = sourceStageStatesV2.get(
    state.sourceStage,
  );
  if (
    !sourceState
    || sourceState.lifecycle !== "dependency_materializing"
    || sourceState.ownedOutputRoots.cleanupState !== "open"
    || sourceState.ownedOutputRoots.first
      !== state.first.compiled.slot
    || sourceState.ownedOutputRoots.second
      !== state.second.compiled.slot
  ) {
    state.ownership.lifecycle = "invalidated";
    if (sourceState !== undefined) {
      return invalidateNetworkNegativePairProbeForTestV2(
        state,
        sourceState,
        new Error(
          "Dependency pair lost its exact source-owned output registry before network-negative claim",
        ),
      );
    }
    return failCompositionNetworkNegativePairForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
      "Dependency pair no longer owns its exact source and output registry",
    );
  }

  // Claim before every await so no other pair consumer or raw-root callback
  // can overlap either installed network-negative occurrence.
  state.ownership.lifecycle = "probing";
  let primaryFailure: unknown;
  try {
    const before =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(before)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed before network-negative observation",
      );
    }
    const hostToolchain =
      authenticBuildToolchainCapsuleState(
        state.buildToolchain,
      ).hostToolchain;
    const firstRaw =
      await observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2(
        hostToolchain,
        state.first.compiled.slot.outputRoot.absolutePath,
      );
    const between =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(between)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed between network-negative occurrences",
      );
    }
    const secondRaw =
      await observePlatformReleaseBootstrapInstalledNetworkNegativeOperationAtPrivateTargetInternalV2(
        hostToolchain,
        state.second.compiled.slot.outputRoot.absolutePath,
      );
    const after =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(after)
        !== canonicalJsonStringify(state.inspection)
      || state.ownership.lifecycle !== "probing"
    ) {
      return failCompositionNetworkNegativePairForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_PAIR_DRIFT",
        "Dependency pair changed across network-negative observation",
      );
    }
    const stableOutputBindingHash =
      state.inspection.stableOutput.bindingHash;
    const occurrences = [
      networkNegativePairOccurrenceForTestV2(
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_FIRST_V2",
        state.first,
        stableOutputBindingHash,
        firstRaw,
      ),
      networkNegativePairOccurrenceForTestV2(
        "PLATFORM_RELEASE_DEPENDENCY_STAGE_SECOND_V2",
        state.second,
        stableOutputBindingHash,
        secondRaw,
      ),
    ] as const;
    const identity = {
      schema:
        PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_PAIR_TEST_V2_SCHEMA,
      version: "2.0.0" as const,
      authorityState:
        "test_fixture_dependency_pair_network_negative_observed_unverified" as const,
      admissionScope: "test_fixture" as const,
      productionAuthority: false as const,
      productionAdmission: "forbidden" as const,
      productionUse:
        "forbidden_until_authenticated_installed_probe_and_verified_release" as const,
      credentialUse: "none" as const,
      mutationAuthority: false as const,
      trustConclusion: "characterization_only" as const,
      targetBinding:
        "authentic_dependency_pair_private_output_roots_v2" as const,
      implementationScope:
        PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_IMPLEMENTATION_SCOPE_V2,
      operationMode:
        "authentic_dependency_pair_zero_caller_dual_occurrence_read_only_network_negative_observation" as const,
      callerJsonState: "absent" as const,
      callerLocatorState: "absent" as const,
      pairLeaseState:
        "exclusive_pair_api_network_negative_probe_claim_released_after_fresh_post_fence" as const,
      terminalizationState:
        "not_performed_manifest_and_attestation_still_required" as const,
      limitations: {
        delegateAuthority:
          "wrapper_bytes_censused_delegate_shell_env_and_apple_sandbox_tool_not_independently_censused" as const,
        filesystemRaceBoundary:
          "pathname_fences_and_empty_directory_cleanup_do_not_close_transient_aba" as const,
        processGroupBoundary:
          "timeout_and_output_limit_kill_the_fresh_group_successful_descendant_absence_not_independently_proven" as const,
        runtimeAccountBoundary:
          "probe_children_execute_as_test_owner_not_receipt_runtime_account" as const,
        testLocatorBoundary:
          "raw_test_callback_locators_may_outlive_api_lease_and_require_all_physical_fences" as const,
        serializedProvenanceBoundary:
          "strict_self_consistency_is_not_origin_authentication" as const,
        serializedHostJoinBoundary:
          "host_join_is_live_observer_authority_not_a_dependency_inspection_field" as const,
      },
      dependencyPairInspectionHash:
        state.inspection.inspectionHash,
      dependencyPairInspection: state.inspection,
      stableOutputBindingHash,
      operationAbiRef:
        PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_REF_V2,
      operationAbiHash:
        PLATFORM_RELEASE_COMPOSITION_NETWORK_NEGATIVE_TEST_OPERATION_ABI_HASH_V2,
      sandboxPolicyHash:
        PLATFORM_RELEASE_BOOTSTRAP_NETWORK_NEGATIVE_OPERATION_POLICY_HASH_V2,
      hostIdentityHash: firstRaw.hostIdentityHash,
      platformHostToolchainReceiptHash:
        firstRaw.platformHostToolchainReceiptHash,
      hostCompositionReceiptHash:
        firstRaw.hostCompositionReceiptHash,
      occurrences,
      stableProjectionHash:
        occurrences[0].stableProjectionHash,
    };
    const inspection =
      parsePlatformReleaseCompositionNetworkNegativePairForTestV2({
        ...identity,
        collectionHash:
          hashPlatformReleaseCompositionNetworkNegativePairForTestV2(
            identity,
          ),
      });
    state.ownership.lifecycle = "ready";
    return inspection;
  } catch (error) {
    primaryFailure = error;
  }

  let fenceFailure: unknown;
  try {
    if (
      state.ownership.lifecycle !== "probing"
      || sourceState.lifecycle !== "dependency_materializing"
    ) {
      throw new Error(
        "Network-negative pair lost its exclusive probe lifecycle",
      );
    }
    const afterFailure =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(afterFailure)
        !== canonicalJsonStringify(state.inspection)
    ) {
      throw new Error(
        "Network-negative pair changed across failed observation",
      );
    }
  } catch (error) {
    fenceFailure = error;
  }
  if (
    fenceFailure !== undefined
    || networkNegativePairFailureRequiresInvalidationForTestV2(
      primaryFailure,
    )
  ) {
    return invalidateNetworkNegativePairProbeForTestV2(
      state,
      sourceState,
      primaryFailure,
      fenceFailure,
    );
  }
  state.ownership.lifecycle = "ready";
  return mapCompositionNetworkNegativePairFailureForTestV2(
    primaryFailure,
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

async function revalidateClaimedDependencyMaterializedPairForCompositionTransferTestV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
): Promise<PlatformReleaseDependencyMaterializedPairInspectionV2> {
  if (
    state.ownership.lifecycle !== "consuming"
    || sourceState.lifecycle !== "dependency_materializing"
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Claimed dependency pair no longer owns the composition-transfer lifecycle",
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
      "Claimed dependency pair build-toolchain authority is no longer authentic",
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
      state.ownership.lifecycle !== "consuming"
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
        "Claimed dependency pair lost exact ownership during fresh revalidation",
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
        "Claimed dependency outputs differ from their issued pair authority",
      );
    }
    return captured.inspection;
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
        "Claimed dependency pair lost exact source or toolchain authority during composition-transfer revalidation",
      );
    }
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_OUTPUT_INVALID",
      "Claimed dependency pair failed composition-transfer revalidation",
      error,
    );
  }
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

function invalidateDependencyPairTestLocatorClaimV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  primaryFailure: unknown,
  callbackFailure?: unknown,
): never {
  state.ownership.lifecycle = "invalidated";
  let cleanupFailure: unknown;
  const exactOwnedRoots =
    sourceState.lifecycle === "dependency_materializing"
    && sourceState.ownedOutputRoots.cleanupState === "open"
    && sourceState.ownedOutputRoots.first
      === state.first.compiled.slot
    && sourceState.ownedOutputRoots.second
      === state.second.compiled.slot;
  if (exactOwnedRoots) {
    try {
      disposeSourceOwnedPhysicalContextV2(sourceState);
    } catch (error) {
      cleanupFailure = error;
    }
  }
  return failDependencyMaterializedPair(
    cleanupFailure === undefined
      ? "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT"
      : "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED",
    cleanupFailure === undefined
      ? "Dependency output locator claim witnessed authority drift and was terminally invalidated"
      : "Dependency output locator claim could not clean its exact owned context after authority drift",
    new AggregateError([
      primaryFailure,
      ...(callbackFailure === undefined
        ? []
        : [callbackFailure]),
      ...(cleanupFailure === undefined
        ? []
        : [cleanupFailure]),
    ]),
  );
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
  const sourceState = sourceStageStatesV2.get(
    state.sourceStage,
  );
  if (
    !sourceState
    || state.ownership.lifecycle !== "ready"
    || sourceState.lifecycle !== "dependency_materializing"
    || sourceState.ownedOutputRoots.cleanupState !== "open"
    || sourceState.ownedOutputRoots.first
      !== state.first.compiled.slot
    || sourceState.ownedOutputRoots.second
      !== state.second.compiled.slot
  ) {
    return failDependencyMaterializedPair(
      "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
      "Dependency output roots require one ready exact pair ownership claim",
    );
  }

  // Test-only locator access is still an exclusive pair probe. Claim before
  // the first await so no observer, transfer, disposal or second callback can
  // overlap the raw-root callback.
  state.ownership.lifecycle = "probing";
  let result: T;
  let callbackFailure: unknown;
  try {
    const before =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(before)
        !== canonicalJsonStringify(state.inspection)
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        "Dependency output roots changed before their exclusive test callback",
      );
    }
  } catch (preFenceFailure) {
    return invalidateDependencyPairTestLocatorClaimV2(
      state,
      sourceState,
      preFenceFailure,
    );
  }
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
    const after =
      await revalidateClaimedDependencyMaterializedPairForProbeV2(
        state,
        sourceState,
      );
    if (
      canonicalJsonStringify(after)
        !== canonicalJsonStringify(state.inspection)
      || state.ownership.lifecycle !== "probing"
    ) {
      return failDependencyMaterializedPair(
        "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT",
        "Dependency output roots changed across their exclusive test callback",
      );
    }
  } catch (validationFailure) {
    return invalidateDependencyPairTestLocatorClaimV2(
      state,
      sourceState,
      validationFailure,
      callbackFailure,
    );
  }
  state.ownership.lifecycle = "ready";
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

function compositionOwnershipTransferInspectionForTestV2(
  state: DependencyMaterializedPairStateV2,
  selectedSlot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  >,
): PlatformReleaseCompositionOwnershipTransferForTestV2Inspection {
  const selectedSlotInspection =
    captureCompositionOwnershipTransferSlotForTestV2(
      selectedSlot,
    );
  const identity = {
    schema:
      PLATFORM_RELEASE_COMPOSITION_OWNERSHIP_TRANSFER_TEST_V2_SCHEMA,
    version: "2.0.0" as const,
    authorityState:
      "test_fixture_ownership_transfer_unverified" as const,
    admissionScope: "test_fixture" as const,
    productionAuthority: false as const,
    productionAdmission: "forbidden" as const,
    productionUse:
      "forbidden_until_authenticated_composition_and_fresh_verification" as const,
    credentialUse: "none" as const,
    mutationAuthority: false as const,
    trustConclusion: "characterization_only" as const,
    operationMode:
      "test_fixture_pair_slot_ownership_transfer_rehearsal" as const,
    pairLifecycle: [
      "pair_ready",
      "pair_consuming",
      "selected_root_owned",
      "predecessors_consumed",
      "release_completed",
    ] as const,
    selectedOccurrence: "first" as const,
    ownershipTransfer:
      "selected_slot_transferred_to_test_handle" as const,
    predecessorTombstone:
      "pathless_release_completed_tombstone" as const,
    terminalizationState:
      "not_performed_manifest_attestation_still_required" as const,
    dependencyPairInspectionHash:
      state.inspection.inspectionHash,
    sourceBindingHash:
      state.inspection.sourceBindingHash,
    stableOutputBindingHash:
      state.inspection.stableOutput.bindingHash,
    selectedSlot: selectedSlotInspection,
    discardedOccurrenceCleanup:
      "second_output_exactly_removed_before_completion" as const,
    sourceContextCleanup:
      "source_and_toolchain_context_exactly_removed_before_completion" as const,
  };
  return parsePlatformReleaseCompositionOwnershipTransferForTestV2({
    ...identity,
    transactionHash:
      hashPlatformReleaseCompositionOwnershipTransferForTestV2(
        identity,
      ),
  });
}

function compositionOwnershipTransferFailureV2(
  error: unknown,
): PlatformReleaseCompositionOwnershipTransferForTestErrorV2 {
  if (
    error instanceof
      PlatformReleaseCompositionOwnershipTransferForTestErrorV2
  ) return error;
  if (
    error instanceof
      PlatformReleaseDependencyMaterializedPairErrorV2
  ) {
    const code = error.code
      === "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_CLEANUP_FAILED"
      ? "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_CLEANUP_FAILED" as const
      : error.code
          === "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_SOURCE_DRIFT"
        || error.code
          === "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_TOOLCHAIN_DRIFT"
        || error.code
          === "PLATFORM_RELEASE_DEPENDENCY_PAIR_V2_HANDLE_UNAUTHENTICATED"
        ? "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SOURCE_DRIFT" as const
        : "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID" as const;
    return new PlatformReleaseCompositionOwnershipTransferForTestErrorV2(
      code,
      "Ownership-transfer rehearsal lost its authentic dependency-pair boundary",
      { cause: error },
    );
  }
  return new PlatformReleaseCompositionOwnershipTransferForTestErrorV2(
    "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
    "Ownership-transfer rehearsal failed at an internal boundary",
    { cause: error },
  );
}

function destroyCompositionOwnershipTransferAfterFailureForTestV2(
  state: DependencyMaterializedPairStateV2,
  sourceState: SourceStageStateV2,
  transferredSlot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  > | undefined,
  primaryFailure:
    PlatformReleaseCompositionOwnershipTransferForTestErrorV2,
): never {
  state.ownership.lifecycle = "invalidated";
  const cleanupErrors: unknown[] = [];
  if (transferredSlot) {
    try {
      removeSourceOwnedOutputSlotV2(
        transferredSlot,
        "Transferred first output after failed composition rehearsal",
      );
      sourceState.ownedOutputRoots.first =
        Object.freeze({ status: "empty" as const });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (sourceState.ownedOutputRoots.cleanupState === "open") {
    try {
      disposeSourceOwnedPhysicalContextV2(sourceState);
    } catch (error) {
      cleanupErrors.push(error);
    }
  } else if (sourceState.lifecycle === "dependency_materializing") {
    try {
      if (
        !transitionSourceContextLifecycleV2(
          sourceState,
          "dependency_materializing",
          "disposed",
        )
      ) {
        return failCompositionOwnershipTransferForTestV2(
          "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_CLEANUP_FAILED",
          "Failed transfer source tombstone could not be terminally retired",
        );
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  } else if (sourceState.lifecycle === "release_completed") {
    try {
      if (
        !transitionSourceContextLifecycleV2(
          sourceState,
          "release_completed",
          "disposed",
        )
      ) {
        return failCompositionOwnershipTransferForTestV2(
          "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_CLEANUP_FAILED",
          "Failed completed transfer tombstone could not be retired",
        );
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_CLEANUP_FAILED",
      "Failed ownership-transfer rehearsal could not destroy every still-owned root",
      new AggregateError([
        primaryFailure,
        ...cleanupErrors,
      ]),
    );
  }
  throw primaryFailure;
}

function runCompositionOwnershipTransferFaultForTestV2(
  fault:
    PlatformReleaseCompositionOwnershipTransferFaultForTestV2
    | undefined,
  checkpoint:
    PlatformReleaseCompositionOwnershipTransferFaultForTestV2["checkpoint"],
  absolutePath: string,
): void {
  if (fault?.checkpoint !== checkpoint) return;
  fault.observePath(absolutePath);
  return failCompositionOwnershipTransferForTestV2(
    "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_OUTPUT_INVALID",
    `Injected ownership-transfer rehearsal fault at ${checkpoint}`,
  );
}

async function rehearsePlatformReleaseCompositionOwnershipTransferInternalForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
  fault?: PlatformReleaseCompositionOwnershipTransferFaultForTestV2,
): Promise<PlatformReleaseCompositionOwnershipTransferForTestV2> {
  let state: DependencyMaterializedPairStateV2;
  try {
    state = authenticDependencyMaterializedPairStateV2(
      handle,
    );
  } catch (error) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_INPUT_INVALID",
      "Ownership-transfer rehearsal requires one authentic dependency-pair handle",
      error,
    );
  }
  const sourceState = sourceStageStatesV2.get(
    state.sourceStage,
  );
  if (state.admissionScope !== "test_fixture") {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SCOPE_MISMATCH",
      "Only a test-fixture dependency pair may enter the non-promotable rehearsal",
    );
  }
  if (state.ownership.lifecycle !== "ready") {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_ALREADY_CLAIMED",
      "Dependency pair has already been claimed by a terminal transaction",
    );
  }
  if (
    !sourceState
    || sourceState.lifecycle !== "dependency_materializing"
    || sourceState.ownedOutputRoots.cleanupState !== "open"
    || sourceState.ownedOutputRoots.first
      !== state.first.compiled.slot
    || sourceState.ownedOutputRoots.second
      !== state.second.compiled.slot
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SOURCE_DRIFT",
      "Dependency pair no longer owns its exact source and output registry",
    );
  }

  // This synchronous claim intentionally precedes the first await.
  state.ownership.lifecycle = "consuming";
  let transferredSlot: Extract<
    SourceOwnedOutputRootSlotV2,
    { status: "output_anchored" }
  > | undefined;
  let issuedState:
    PlatformReleaseCompositionOwnershipTransferForTestStateV2
    | undefined;
  try {
    runCompositionOwnershipTransferFaultForTestV2(
      fault,
      "after_claim_before_revalidation",
      state.first.compiled.slot.outputRoot.absolutePath,
    );
    const revalidated =
      await revalidateClaimedDependencyMaterializedPairForCompositionTransferTestV2(
        state,
        sourceState,
      );
    if (
      state.ownership.lifecycle !== "consuming"
      || sourceState.lifecycle !== "dependency_materializing"
      || canonicalJsonStringify(revalidated)
        !== canonicalJsonStringify(state.inspection)
      || sourceState.ownedOutputRoots.first
        !== state.first.compiled.slot
      || sourceState.ownedOutputRoots.second
        !== state.second.compiled.slot
    ) {
      return failCompositionOwnershipTransferForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SOURCE_DRIFT",
        "Dependency pair changed after the claimed fresh revalidation",
      );
    }
    const selectedSlot = state.first.compiled.slot;
    const inspection =
      compositionOwnershipTransferInspectionForTestV2(
        state,
        selectedSlot,
      );
    issuedState = {
      sourceStage: state.sourceStage,
      selectedSlot,
      inspection,
      lifecycle: "owned",
    };
    const next =
      new PlatformReleaseCompositionOwnershipTransferForTestV2(
        compositionOwnershipTransferForTestConstructorCapabilityV2,
        issuedState,
      );

    sourceState.ownedOutputRoots.first = Object.freeze({
      status: "transferred" as const,
      transferHash: inspection.selectedSlot.slotHash,
    });
    transferredSlot = selectedSlot;
    runCompositionOwnershipTransferFaultForTestV2(
      fault,
      "after_selected_slot_transfer",
      selectedSlot.outputRoot.absolutePath,
    );

    removeSourceOwnedOutputSlotV2(
      state.second.compiled.slot,
      "Discarded second dependency output",
    );
    sourceState.ownedOutputRoots.second =
      Object.freeze({ status: "empty" as const });
    runCompositionOwnershipTransferFaultForTestV2(
      fault,
      "after_second_output_cleanup",
      state.second.compiled.slot.outputRoot.absolutePath,
    );
    removeSourceOwnedContextV2(sourceState);
    runCompositionOwnershipTransferFaultForTestV2(
      fault,
      "after_source_context_cleanup_before_completion",
      sourceState.contextAnchor.absolutePath,
    );
    sourceState.ownedOutputRoots.cleanupState = "cleaned";
    if (
      !transitionSourceContextLifecycleV2(
        sourceState,
        "dependency_materializing",
        "release_completed",
      )
    ) {
      return failCompositionOwnershipTransferForTestV2(
        "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_SOURCE_DRIFT",
        "Source context could not enter its pathless release-completed tombstone",
      );
    }
    state.ownership.lifecycle = "consumed";
    runCompositionOwnershipTransferFaultForTestV2(
      fault,
      "after_completion_before_return",
      selectedSlot.outputRoot.absolutePath,
    );
    return next;
  } catch (error) {
    if (issuedState) issuedState.lifecycle = "cleanup_failed";
    return destroyCompositionOwnershipTransferAfterFailureForTestV2(
      state,
      sourceState,
      transferredSlot,
      compositionOwnershipTransferFailureV2(error),
    );
  }
}

export async function rehearsePlatformReleaseCompositionOwnershipTransferForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
): Promise<PlatformReleaseCompositionOwnershipTransferForTestV2> {
  return rehearsePlatformReleaseCompositionOwnershipTransferInternalForTestV2(
    handle,
  );
}

export async function rehearsePlatformReleaseCompositionOwnershipTransferWithFaultForTestV2(
  handle: PlatformReleaseDependencyMaterializedPairV2,
  fault: PlatformReleaseCompositionOwnershipTransferFaultForTestV2,
): Promise<PlatformReleaseCompositionOwnershipTransferForTestV2> {
  if (
    typeof fault !== "object"
    || fault === null
    || Array.isArray(fault)
    || isProxy(fault)
    || Object.getPrototypeOf(fault) !== Object.prototype
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_INPUT_INVALID",
      "Ownership-transfer fault requires one exact test-only descriptor",
    );
  }
  const keys = Reflect.ownKeys(fault);
  const descriptors = Object.getOwnPropertyDescriptors(fault);
  const checkpoint = descriptors.checkpoint;
  const observePath = descriptors.observePath;
  const allowedCheckpoints:
    readonly PlatformReleaseCompositionOwnershipTransferFaultForTestV2["checkpoint"][] =
      [
        "after_claim_before_revalidation",
        "after_selected_slot_transfer",
        "after_second_output_cleanup",
        "after_source_context_cleanup_before_completion",
        "after_completion_before_return",
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
        PlatformReleaseCompositionOwnershipTransferFaultForTestV2["checkpoint"],
    )
    || !observePath
    || !("value" in observePath)
    || typeof observePath.value !== "function"
    || isProxy(observePath.value)
  ) {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_INPUT_INVALID",
      "Ownership-transfer fault contains an invalid checkpoint or observer",
    );
  }
  return rehearsePlatformReleaseCompositionOwnershipTransferInternalForTestV2(
    handle,
    Object.freeze({
      checkpoint:
        checkpoint.value as
          PlatformReleaseCompositionOwnershipTransferFaultForTestV2["checkpoint"],
      observePath:
        observePath.value as
          PlatformReleaseCompositionOwnershipTransferFaultForTestV2["observePath"],
    }),
  );
}

export function inspectPlatformReleaseCompositionOwnershipTransferForTestV2(
  handle: PlatformReleaseCompositionOwnershipTransferForTestV2,
): PlatformReleaseCompositionOwnershipTransferForTestV2Inspection {
  const state =
    authenticCompositionOwnershipTransferForTestStateV2(
      handle,
    );
  if (state.lifecycle !== "owned") {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_DISPOSED",
      "Ownership-transfer rehearsal handle no longer owns its selected slot",
    );
  }
  return parsePlatformReleaseCompositionOwnershipTransferForTestV2(
    structuredClone(state.inspection),
  );
}

export function disposePlatformReleaseCompositionOwnershipTransferForTestV2(
  handle: PlatformReleaseCompositionOwnershipTransferForTestV2,
): void {
  const state =
    authenticCompositionOwnershipTransferForTestStateV2(
      handle,
    );
  if (state.lifecycle !== "owned") {
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_HANDLE_DISPOSED",
      "Ownership-transfer rehearsal handle no longer owns its selected slot",
    );
  }
  try {
    removeSourceOwnedOutputSlotV2(
      state.selectedSlot,
      "Ownership-transfer rehearsal selected output",
    );
    state.lifecycle = "disposed";
  } catch (error) {
    state.lifecycle = "cleanup_failed";
    return failCompositionOwnershipTransferForTestV2(
      "PLATFORM_RELEASE_COMPOSITION_TRANSFER_TEST_V2_CLEANUP_FAILED",
      "Ownership-transfer rehearsal selected output could not be removed safely",
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
  if (state.lifecycle === "release_completed") {
    if (
      state.ownedOutputRoots.cleanupState !== "cleaned"
      || state.ownedOutputRoots.first.status
        !== "transferred"
      || state.ownedOutputRoots.second.status !== "empty"
      || !sourceOwnedPathIsAbsentV2(
        state.contextAnchor.absolutePath,
      )
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
        "Release-completed source tombstone retained unexpected physical ownership",
      );
    }
    if (
      !transitionSourceContextLifecycleV2(
        state,
        "release_completed",
        "disposed",
      )
    ) {
      return fail(
        "PLATFORM_RELEASE_SOURCE_V2_CLEANUP_FAILED",
        "Release-completed source tombstone could not be retired",
      );
    }
    return;
  }
  disposeSourceOwnedPhysicalContextV2(state);
}
