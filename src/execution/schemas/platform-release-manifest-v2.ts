import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  ProductDeliveryProfileCatalogV2Schema,
  getProductDeliveryProfileCatalogV2,
} from "../../product-compiler/product-delivery-profile-catalog-v2.js";
import {
  GitObjectHashSchema,
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  InvocationTransportCodecCatalogV2Schema,
  getInvocationTransportCodecCatalogV2,
} from "../../product-compiler/schemas/invocation-input-transport-v2.js";
import {
  EvidenceAdapterDefinitionCatalogV2Schema,
  getEvidenceAdapterDefinitionCatalogV2,
} from "../../evidence/schemas/evidence-adapter-definition-catalog-v2.js";
import {
  EvidenceReceiptAbiPolicyCandidateV2Schema,
  getEvidenceReceiptAbiPolicyV2,
} from "../../evidence/schemas/evidence-receipt-v2.js";
import {
  EvidenceEnvironmentCapsuleCandidateV2Schema,
} from "./evidence-environment-capsule-v2.js";
import {
  ExternalRuntimeResolutionCandidateV2Schema,
} from "./external-runtime-resolution-v2.js";
import {
  ExactLegacyStitchConverterRefV2Schema,
  PLATFORM_RELEASE_BUILD_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
  PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
  PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2,
  PLATFORM_RELEASE_SOURCE_MAX_FILES_V2,
  PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2,
  PlatformReleaseBuildToolchainInstallRecipeV2Schema,
  PlatformReleaseBuildToolchainTreeBindingV2Schema,
  PlatformReleaseCompilerIdentityV2Schema,
  PlatformReleasePackageManagerIdentityV2Schema,
  PlatformReleaseSourceInputsV2Schema,
  PlatformReleaseSourceTreeBindingV2Schema,
} from "./platform-release-build-v2.js";
import {
  PlatformReleaseHostNodeToolchainRequirementV2Schema,
  getPlatformReleaseHostNodeToolchainRequirementV2,
} from "./platform-release-host-node-toolchain-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  PlatformReleaseVersionIdentityV2Schema,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PlatformEvidenceDefinitionCatalogsV2Schema,
  getPlatformEvidenceDefinitionCatalogsV2,
} from "./platform-evidence-definition-catalogs-v2.js";
import {
  PlatformLauncherCatalogV2Schema,
  PlatformRunnerCatalogV2Schema,
} from "./platform-release-module-catalogs-v2.js";
import {
  PlatformReleaseRequiredModuleClosureV2Schema,
  getPlatformReleaseRequiredModuleRequirementV2,
} from "./platform-release-required-module-closure-v2.js";
import {
  RELEASE_LAYOUT_V2,
  ReleaseLayoutV2Schema,
  PlatformRuntimePayloadCandidateV2Schema,
} from "./platform-runtime-payload-v2.js";

export const PLATFORM_RELEASE_MANIFEST_V2_SCHEMA =
  "setfarm.platform-release-manifest.v2" as const;
export const PLATFORM_RELEASE_MANIFEST_VERSION_V2 = 2 as const;
export const PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES =
  3 * 1024 * 1024;

const CanonicalDecimalEpochV2Schema = z.string()
  .min(1)
  .max(20)
  .regex(/^(?:0|[1-9][0-9]*)$/, "Expected canonical Git epoch seconds");

const PlatformReleaseIdentityV2Schema = z.object({
  codeSha: GitObjectHashSchema,
  sourceTreeHash: GitObjectHashSchema,
  branch: z.literal("main"),
  dirty: z.literal(false),
  sourceAdmission: z.object({
    repositoryId: z.literal(
      PLATFORM_RELEASE_SOURCE_REPOSITORY_ID_V2,
    ),
    remoteRef: z.literal("refs/remotes/origin/main"),
    admittedSha: GitObjectHashSchema,
    policy: z.literal("exact_remote_main_sha"),
    admissionContractHash: z.literal(
      PLATFORM_RELEASE_SOURCE_ADMISSION_CONTRACT_HASH_V2,
    ),
    source: PlatformReleaseSourceTreeBindingV2Schema,
  }).strict(),
  packageName: z.literal("setfarm"),
  packageVersion: PlatformReleaseVersionIdentityV2Schema,
}).strict().superRefine((value, context) => {
  const admission = value.sourceAdmission;
  if (
    value.codeSha !== admission.admittedSha
    || value.sourceTreeHash !== admission.source.sourceTreeHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["sourceAdmission"],
      message:
        "Release identity must equal its stable admitted source projection",
    });
  }
});

const PlatformReleaseBuildIdentityV2Schema = z.object({
  contractVersion: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  buildContractHash: z.literal(
    PLATFORM_RELEASE_BUILD_CONTRACT_HASH_V2,
  ),
  inputs: PlatformReleaseSourceInputsV2Schema,
  compiler: PlatformReleaseCompilerIdentityV2Schema,
  packageManager: PlatformReleasePackageManagerIdentityV2Schema,
  buildToolchain: z.object({
    requirement:
      PlatformReleaseHostNodeToolchainRequirementV2Schema,
    installRecipe:
      PlatformReleaseBuildToolchainInstallRecipeV2Schema,
    tree: PlatformReleaseBuildToolchainTreeBindingV2Schema,
  }).strict(),
  sourceStage: z.object({
    method: z.literal("verified_git_tree_export.v2"),
    exportedTreeHash: GitObjectHashSchema,
    exportedFileTreeHash: Sha256Schema,
    exportedFileCount: z.number().int().positive()
      .max(PLATFORM_RELEASE_SOURCE_MAX_FILES_V2),
    exportedDirectoryCount: z.number().int().nonnegative()
      .max(PLATFORM_RELEASE_SOURCE_MAX_DIRECTORIES_V2),
    exportedTotalBytes: z.number().int().positive()
      .max(PLATFORM_RELEASE_SOURCE_MAX_TOTAL_BYTES_V2),
    sourceBindingHash: Sha256Schema,
    buildContextPolicy: z.literal(
      "private_0700_parent_source_child_and_authenticated_toolchain_sibling_v2",
    ),
    mode: z.literal("read_only"),
  }).strict(),
  commandRef: z.literal("BUILD_PLATFORM_RELEASE_V2"),
  outputPolicy: z.literal("parameterized_empty_stage_only"),
  sourceDateEpoch: CanonicalDecimalEpochV2Schema,
  reproducibility: z.literal("double_clean_build_exact_tree_match"),
  reproducibleOutputClosureHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const expectedMembershipHash = hashCanonicalJson({
    schema: "setfarm.platform-release-source-input-membership.v2",
    entries: value.inputs.map((entry) => ({
      role: entry.role,
      locator: entry.locator,
      sourceRefHash: entry.sourceRefHash,
    })),
  });
  if (
    canonicalJsonStringify(value.buildToolchain.requirement)
      !== canonicalJsonStringify(
        getPlatformReleaseHostNodeToolchainRequirementV2(),
      )
    || value.packageManager.buildInstallRecipeHash
      !== value.buildToolchain.installRecipe.recipeHash
    || value.buildToolchain.tree.inputMembershipHash
      !== expectedMembershipHash
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Stable build identity must close code-owned requirement, recipe and exact input membership",
    });
  }
});

const PlatformReleaseManifestIdentityV2Schema = z.object({
  schema: z.literal(PLATFORM_RELEASE_MANIFEST_V2_SCHEMA),
  manifestVersion: z.literal(PLATFORM_RELEASE_MANIFEST_VERSION_V2),
  authorityState: z.literal("candidate_manifest_unverified"),
  productionUse: z.literal(
    "forbidden_until_empty_stage_materialization_and_fresh_verification",
  ),
  releaseLayout: ReleaseLayoutV2Schema,
  release: PlatformReleaseIdentityV2Schema,
  build: PlatformReleaseBuildIdentityV2Schema,
  runtimePayload: PlatformRuntimePayloadCandidateV2Schema,
  externalResolution: ExternalRuntimeResolutionCandidateV2Schema,
  environmentCapsule: EvidenceEnvironmentCapsuleCandidateV2Schema,
  profileCatalog: ProductDeliveryProfileCatalogV2Schema,
  evidenceDefinitionCatalogs:
    PlatformEvidenceDefinitionCatalogsV2Schema,
  requiredModuleClosure:
    PlatformReleaseRequiredModuleClosureV2Schema,
  launcherCatalog: PlatformLauncherCatalogV2Schema,
  runnerCatalog: PlatformRunnerCatalogV2Schema,
  transportCodecCatalog: InvocationTransportCodecCatalogV2Schema,
  receiptSchema: EvidenceReceiptAbiPolicyCandidateV2Schema,
  adapterDefinitionCatalog: EvidenceAdapterDefinitionCatalogV2Schema,
  legacyAssets: z.object({
    stitchConverter: ExactLegacyStitchConverterRefV2Schema,
  }).strict(),
}).strict().superRefine((value, context) => {
  const codeOwned = {
    releaseLayout: RELEASE_LAYOUT_V2,
    profileCatalog: getProductDeliveryProfileCatalogV2(),
    evidenceDefinitionCatalogs:
      getPlatformEvidenceDefinitionCatalogsV2(),
    transportCodecCatalog: getInvocationTransportCodecCatalogV2(),
    receiptSchema: getEvidenceReceiptAbiPolicyV2(),
    adapterDefinitionCatalog:
      getEvidenceAdapterDefinitionCatalogV2(),
  };
  for (const [field, expected] of Object.entries(codeOwned)) {
    if (
      canonicalJsonStringify(
        value[field as keyof typeof codeOwned],
      ) !== canonicalJsonStringify(expected)
    ) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `${field} must equal its complete zero-input code-owned authority`,
      });
    }
  }

  const runtime = value.runtimePayload;
  const external = value.externalResolution;
  const environment = value.environmentCapsule;
  const definitions = value.evidenceDefinitionCatalogs;
  const requiredModules = value.requiredModuleClosure;
  const launcher = value.launcherCatalog;
  const runner = value.runnerCatalog;
  const packageLock = value.build.inputs[0];
  const packageJson = value.build.inputs[1];
  const npmExecutable = external.executables.find(
    (entry) =>
      entry.executableRef === external.packageManager.executableRef,
  );

  const joinFailures: string[] = [];
  const requireJoin = (condition: boolean, label: string) => {
    if (!condition) joinFailures.push(label);
  };

  requireJoin(
    value.release.sourceTreeHash === value.build.sourceStage.exportedTreeHash
      && canonicalJsonStringify(
        value.release.sourceAdmission.source.inputs,
      ) === canonicalJsonStringify(value.build.inputs)
      && value.release.sourceAdmission.source.sourceTreeHash
        === value.release.sourceTreeHash
      && value.release.sourceAdmission.source.bindingHash
        === value.build.sourceStage.sourceBindingHash
      && value.release.sourceAdmission.source.exportedFileTreeHash
        === value.build.sourceStage.exportedFileTreeHash
      && value.release.sourceAdmission.source.exportedFileCount
        === value.build.sourceStage.exportedFileCount
      && value.release.sourceAdmission.source.exportedDirectoryCount
        === value.build.sourceStage.exportedDirectoryCount
      && value.release.sourceAdmission.source.exportedTotalBytes
        === value.build.sourceStage.exportedTotalBytes
      && value.release.sourceAdmission.source.inputMembershipHash
        === value.build.buildToolchain.tree.inputMembershipHash
      && value.build.buildToolchain.installRecipe.recipeHash
        === value.build.packageManager.buildInstallRecipeHash,
    "stable source and build-toolchain projections",
  );
  requireJoin(
    value.build.reproducibleOutputClosureHash
      === hashCanonicalJson({
        schema: "setfarm.platform-release-build-output-closure.v2",
        runtimePayloadHash: runtime.runtimePayloadHash,
        platformTreeBindingHash:
          runtime.platformTree.bindingHash,
        dependencyTreeBindingHash:
          runtime.dependencyTree.bindingHash,
        packageJsonHash: runtime.packageJson.hash,
        npmMaterializationReceiptHash:
          external.materializationReceipt.receiptHash,
        legacyStitchConverter:
          value.legacyAssets.stitchConverter,
      }),
    "stable reproducible output closure",
  );
  requireJoin(
    runtime.packageJson.hash === packageJson.contentHash
      && runtime.packageJson.byteLength === packageJson.byteLength,
    "committed and bundled package.json",
  );
  requireJoin(
    external.productionPackages.lockfile.hash
      === packageLock.contentHash
      && external.productionPackages.lockfile.byteLength
        === packageLock.byteLength
      && external.materializationReceipt.lockfile.hash
        === packageLock.contentHash
      && external.materializationReceipt.lockfile.byteLength
        === packageLock.byteLength,
    "committed lockfile and production resolution",
  );
  requireJoin(
    runtime.dependencyTree.treeHash
      === external.productionPackages.materializedDependencyTreeHash
      && runtime.dependencyTree.treeHash
        === external.materializationReceipt.dependencyTreeHash
      && runtime.dependencyTree.treePayloadHash
        === external.materializationReceipt
          .dependencyTreePayloadHash
      && runtime.dependencyTree.bindingHash
        === external.materializationReceipt
          .dependencyTreeBindingHash
      && external.productionPackages.resolutionGraphHash
        === external.materializationReceipt
          .productionResolutionGraphHash,
    "runtime dependency tree and npm evidence",
  );
  requireJoin(
    runtime.ownership.runtimeUid === external.hostRuntime.runtimeUid,
    "runtime ownership and host runtime UID",
  );
  requireJoin(
    environment.network.authority.hostRuntimeIdentityHash
      === external.hostRuntime.hostRuntimeIdentityHash,
    "network authority and host runtime identity",
  );
  requireJoin(
    environment.filesystem.metadataProbeAuthorityHash
      === external.metadataProbe.authorityHash,
    "environment and metadata probe authority",
  );
  requireJoin(
    requiredModules.platformTreeHash === runtime.platformTree.treeHash
      && requiredModules.runtimePayloadHash
        === runtime.runtimePayloadHash
      && canonicalJsonStringify(requiredModules.requirement)
        === canonicalJsonStringify(
          getPlatformReleaseRequiredModuleRequirementV2(),
        ),
    "required module closure and runtime payload",
  );
  requireJoin(
    value.build.packageManager.packageName
      === external.packageManager.packageName
      && value.build.packageManager.version
        === external.packageManager.version
      && value.build.packageManager.executableRef
        === external.packageManager.executableRef
      && value.build.packageManager.packageTreeHash
        === external.packageManager.packageTreeHash
      && npmExecutable?.hash
        === value.build.packageManager.executableHash,
    "build and external npm identity",
  );
  requireJoin(
    launcher.runtimePayloadHash === runtime.runtimePayloadHash
      && launcher.platformTreeHash === runtime.platformTree.treeHash
      && launcher.externalResolutionHash
        === external.externalResolutionHash
      && launcher.environmentCapsuleHash
        === environment.environmentCapsuleHash
      && launcher.profileCatalogHash
        === value.profileCatalog.catalogHash
      && launcher.requirementCatalogHash
        === definitions.launcherRequirements.catalogHash,
    "launcher release closure",
  );
  requireJoin(
    runner.runtimePayloadHash === runtime.runtimePayloadHash
      && runner.platformTreeHash === runtime.platformTree.treeHash
      && runner.dependencyTreeHash === runtime.dependencyTree.treeHash
      && runner.externalResolutionHash
        === external.externalResolutionHash
      && runner.productionResolutionGraphHash
        === external.productionPackages.resolutionGraphHash
      && runner.environmentCapsuleHash
        === environment.environmentCapsuleHash
      && runner.profileCatalogHash
        === value.profileCatalog.catalogHash
      && runner.requirementCatalogHash
        === definitions.runnerRequirements.catalogHash
      && runner.launcherCatalogHash === launcher.catalogHash
      && runner.requiredModuleClosureHash
        === requiredModules.closureHash
      && runner.transportCodecCatalogHash
        === value.transportCodecCatalog.catalogHash
      && runner.receiptSchemaHash === value.receiptSchema.policyHash
      && runner.adapterDefinitionCatalogHash
        === value.adapterDefinitionCatalog.catalogHash,
    "runner complete toolchain closure",
  );
  requireJoin(
    definitions.profileCatalogBinding.catalogHash
      === value.profileCatalog.catalogHash
      && definitions.invocationCodecCatalogBinding.catalogHash
        === value.transportCodecCatalog.catalogHash
      && definitions.receiptSchemaBinding.policyHash
        === value.receiptSchema.policyHash
      && value.adapterDefinitionCatalog.receiptSchemaBinding.policyHash
        === value.receiptSchema.policyHash
      && value.adapterDefinitionCatalog.invocationCodecCatalogBinding
        .catalogHash === value.transportCodecCatalog.catalogHash,
    "definition catalogs and exact ABI catalogs",
  );
  requireJoin(
    launcher.entries.every(
      (entry) =>
        entry.executableRef === external.nodeRuntime.runtimeRef,
    )
      && runner.entries.every(
        (entry) =>
          entry.executableRefs.length === 1
          && entry.executableRefs[0] === external.nodeRuntime.runtimeRef,
      ),
    "launcher and runner Node runtime refs",
  );
  const requiredModuleRefs = new Map(
    requiredModules.entries.map(
      (entry) => [
        entry.module.moduleLocator,
        canonicalJsonStringify(entry.module),
      ],
    ),
  );
  requireJoin(
    [
      ...launcher.entries.map((entry) => entry.module),
      ...runner.entries.map((entry) => entry.module),
    ].every(
      (module) =>
        requiredModuleRefs.get(module.moduleLocator)
          === canonicalJsonStringify(module),
    ),
    "launcher and runner refs in required module closure",
  );
  const networkModule = requiredModules.entries.find(
    (entry) => entry.definition.role === "network",
  );
  requireJoin(
    networkModule !== undefined
      && networkModule.module.moduleLocator
        === environment.network.authority.wrapperModuleLocator
      && networkModule.module.contentHash
        === environment.network.authority.wrapperModuleHash
      && networkModule.definition.requiredExports.some(
        (entry) =>
          entry.name
            === environment.network.authority.wrapperExport
          && entry.kind === "function",
      ),
    "network authority in required module closure",
  );

  if (joinFailures.length > 0) {
    context.addIssue({
      code: "custom",
      message:
        `Platform release manifest cross-component joins failed: ${joinFailures.join(", ")}`,
    });
  }
});

export type PlatformReleaseManifestHashPayloadV2 = z.infer<
  typeof PlatformReleaseManifestIdentityV2Schema
>;

export function hashPlatformReleaseManifestV2(
  value:
    | PlatformReleaseManifestHashPayloadV2
    | PlatformReleaseManifestV2,
): string {
  const manifest = { ...value } as Record<string, unknown>;
  delete manifest.manifestPayloadHash;
  return hashCanonicalJson({
    schema: "setfarm.platform-release-manifest-payload-hash.v2",
    manifest,
  });
}

export const PlatformReleaseManifestV2Schema =
  PlatformReleaseManifestIdentityV2Schema.safeExtend({
    manifestPayloadHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message:
          `Platform release manifest exceeds ${PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES} canonical bytes`,
      });
      return;
    }
    if (
      value.manifestPayloadHash
        !== hashPlatformReleaseManifestV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["manifestPayloadHash"],
        message:
          "Manifest payload hash must bind every complete nested component",
      });
    }
  });

export type PlatformReleaseManifestV2 = z.infer<
  typeof PlatformReleaseManifestV2Schema
>;

export function parsePlatformReleaseManifestCandidateV2(
  input: unknown,
): PlatformReleaseManifestV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_MANIFEST_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseManifestV2Schema.parse(snapshot),
  );
}
