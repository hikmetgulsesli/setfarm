import { z } from "zod";

import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../../product-compiler/canonical-json.js";
import {
  Sha256Schema,
} from "../../product-compiler/schemas/common-v1.js";
import {
  PlatformReleaseBuildReceiptV2Schema,
  PlatformReleaseBuildToolchainReceiptV2Schema,
  SourceAdmissionReceiptV2Schema,
} from "./platform-release-build-v2.js";
import {
  PLATFORM_RELEASE_COMPONENT_VERSION_V2,
  boundedPlatformReleaseJsonSnapshotV2,
  deepFreezePlatformReleaseJsonV2,
  platformReleaseCandidateFitsCanonicalCapV2,
} from "./platform-release-common-v2.js";
import {
  PlatformReleaseManifestV2Schema,
  type PlatformReleaseManifestV2,
} from "./platform-release-manifest-v2.js";

export const PLATFORM_RELEASE_BUILD_ATTESTATION_V2_SCHEMA =
  "setfarm.platform-release-build-attestation.v2" as const;
export const PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_SCHEMA =
  "setfarm.platform-release-candidate-envelope.v2" as const;
export const PLATFORM_RELEASE_BUILD_ATTESTATION_V2_MAX_CANONICAL_BYTES =
  1024 * 1024;
export const PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_MAX_CANONICAL_BYTES =
  5 * 1024 * 1024;

const PlatformReleaseBuildAttestationIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_BUILD_ATTESTATION_V2_SCHEMA,
  ),
  version: z.literal(PLATFORM_RELEASE_COMPONENT_VERSION_V2),
  authorityState: z.literal(
    "candidate_build_attestation_unverified",
  ),
  productionUse: z.literal(
    "forbidden_until_fresh_release_verification",
  ),
  releaseContentHash: Sha256Schema,
  sourceAdmissionReceipt: SourceAdmissionReceiptV2Schema,
  sourceAdmissionReceiptHash: Sha256Schema,
  buildToolchainReceipt:
    PlatformReleaseBuildToolchainReceiptV2Schema,
  buildToolchainReceiptHash: Sha256Schema,
  firstBuildReceipt: PlatformReleaseBuildReceiptV2Schema,
  firstBuildReceiptHash: Sha256Schema,
  secondBuildReceipt: PlatformReleaseBuildReceiptV2Schema,
  secondBuildReceiptHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const source = value.sourceAdmissionReceipt;
  const toolchain = value.buildToolchainReceipt;
  const first = value.firstBuildReceipt;
  const second = value.secondBuildReceipt;
  const sourcePhysicalHash =
    source.exportedSource.stageAfter.identityHash;
  const toolchainPhysicalHash =
    toolchain.physicalAfter.identityHash;
  const sourceProjection = canonicalJsonStringify(
    source.exportedSource.source,
  );
  const inputProjection = canonicalJsonStringify(toolchain.inputs);
  const compilerProjection =
    canonicalJsonStringify(toolchain.compiler);
  const packageManagerProjection =
    canonicalJsonStringify(toolchain.packageManager);
  const toolchainProjection =
    canonicalJsonStringify(toolchain.tree);
  if (
    value.sourceAdmissionReceiptHash !== source.receiptHash
    || value.buildToolchainReceiptHash !== toolchain.receiptHash
    || value.firstBuildReceiptHash !== first.receiptHash
    || value.secondBuildReceiptHash !== second.receiptHash
    || toolchain.sourceAdmissionReceiptHash !== source.receiptHash
    || first.sourceAdmissionReceiptHash !== source.receiptHash
    || second.sourceAdmissionReceiptHash !== source.receiptHash
    || first.buildToolchainReceiptHash !== toolchain.receiptHash
    || second.buildToolchainReceiptHash !== toolchain.receiptHash
    || first.stage.stageRef
      !== "PLATFORM_RELEASE_BUILD_STAGE_FIRST_V2"
    || second.stage.stageRef
      !== "PLATFORM_RELEASE_BUILD_STAGE_SECOND_V2"
    || first.receiptHash === second.receiptHash
    || first.stage.outputStagePhysicalIdentityHash
      === second.stage.outputStagePhysicalIdentityHash
    || first.stage.sourceStagePhysicalIdentityHash
      !== sourcePhysicalHash
    || second.stage.sourceStagePhysicalIdentityHash
      !== sourcePhysicalHash
    || first.stage.buildToolchainPhysicalIdentityHash
      !== toolchainPhysicalHash
    || second.stage.buildToolchainPhysicalIdentityHash
      !== toolchainPhysicalHash
    || canonicalJsonStringify(first.source)
      !== sourceProjection
    || canonicalJsonStringify(second.source)
      !== sourceProjection
    || canonicalJsonStringify(first.inputs)
      !== inputProjection
    || canonicalJsonStringify(second.inputs)
      !== inputProjection
    || canonicalJsonStringify(first.compiler)
      !== compilerProjection
    || canonicalJsonStringify(second.compiler)
      !== compilerProjection
    || canonicalJsonStringify(first.packageManager)
      !== packageManagerProjection
    || canonicalJsonStringify(second.packageManager)
      !== packageManagerProjection
    || canonicalJsonStringify(first.buildToolchain)
      !== toolchainProjection
    || canonicalJsonStringify(second.buildToolchain)
      !== toolchainProjection
    || first.sourceDateEpoch
      !== source.admittedSource.commitEpochSeconds
    || second.sourceDateEpoch
      !== source.admittedSource.commitEpochSeconds
    || first.process.commandResult.sourceSha
      !== source.admittedSource.sha
    || second.process.commandResult.sourceSha
      !== source.admittedSource.sha
    || first.stage.sourceBuildContextPolicy
      !== source.exportedSource.buildContextPolicy
    || second.stage.sourceBuildContextPolicy
      !== source.exportedSource.buildContextPolicy
    || canonicalJsonStringify(first.command)
      !== canonicalJsonStringify(second.command)
    || canonicalJsonStringify(first.process.commandResult)
      !== canonicalJsonStringify(second.process.commandResult)
    || canonicalJsonStringify(first.output)
      !== canonicalJsonStringify(second.output)
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Build attestation must close one source and toolchain occurrence across two distinct equal-output builds",
    });
  }
});

export type PlatformReleaseBuildAttestationHashPayloadV2 =
  z.infer<
    typeof PlatformReleaseBuildAttestationIdentityV2Schema
  >;

export function hashPlatformReleaseBuildAttestationV2(
  value:
    | PlatformReleaseBuildAttestationHashPayloadV2
    | PlatformReleaseBuildAttestationV2,
): string {
  const attestation = { ...value } as Record<string, unknown>;
  delete attestation.attestationHash;
  return hashCanonicalJson({
    schema:
      "setfarm.platform-release-build-attestation-hash.v2",
    attestation,
  });
}

export const PlatformReleaseBuildAttestationV2Schema =
  PlatformReleaseBuildAttestationIdentityV2Schema.safeExtend({
    attestationHash: Sha256Schema,
  }).strict().superRefine((value, context) => {
    if (!platformReleaseCandidateFitsCanonicalCapV2(
      value,
      PLATFORM_RELEASE_BUILD_ATTESTATION_V2_MAX_CANONICAL_BYTES,
    )) {
      context.addIssue({
        code: "custom",
        message:
          "Platform release build attestation exceeds its canonical byte cap",
      });
      return;
    }
    if (
      value.attestationHash
        !== hashPlatformReleaseBuildAttestationV2(value)
    ) {
      context.addIssue({
        code: "custom",
        path: ["attestationHash"],
        message: "Build attestation hash mismatch",
      });
    }
  });

export type PlatformReleaseBuildAttestationV2 = z.infer<
  typeof PlatformReleaseBuildAttestationV2Schema
>;

const PlatformReleaseCandidateEnvelopeIdentityV2Schema = z.object({
  schema: z.literal(
    PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_SCHEMA,
  ),
  manifest: PlatformReleaseManifestV2Schema,
  buildAttestation: PlatformReleaseBuildAttestationV2Schema,
}).strict().superRefine((value, context) => {
  const manifest = value.manifest;
  const attestation = value.buildAttestation;
  const source = attestation.sourceAdmissionReceipt;
  const toolchain = attestation.buildToolchainReceipt;
  const first = attestation.firstBuildReceipt;
  const second = attestation.secondBuildReceipt;
  const stableSource = manifest.release.sourceAdmission.source;
  const stableBuild = manifest.build;
  const external = manifest.externalResolution;
  const buildHost = toolchain.hostToolchain;
  const nodeExecutable = external.executables.find(
    (entry) =>
      entry.executableRef === external.nodeRuntime.executableRef,
  );
  const hostIdentity = {
    platform: external.hostRuntime.platform,
    architecture: external.hostRuntime.architecture,
    macosProductVersion:
      external.hostRuntime.macosProductVersion,
    macosBuildVersion:
      external.hostRuntime.macosBuildVersion,
    darwinKernelRelease:
      external.hostRuntime.darwinKernelRelease,
  };
  const joins: string[] = [];
  const requireJoin = (condition: boolean, label: string) => {
    if (!condition) joins.push(label);
  };

  requireJoin(
    attestation.releaseContentHash
      === manifest.manifestPayloadHash,
    "release content hash",
  );
  requireJoin(
    source.repositoryId
      === manifest.release.sourceAdmission.repositoryId
      && source.remoteRef
        === manifest.release.sourceAdmission.remoteRef
      && source.policy === manifest.release.sourceAdmission.policy
      && source.admissionContractHash
        === manifest.release.sourceAdmission.admissionContractHash
      && source.branch === manifest.release.branch
      && source.admittedSource.sha === manifest.release.codeSha
      && source.admittedSource.sha
        === manifest.release.sourceAdmission.admittedSha
      && source.admittedSource.treeHash
        === manifest.release.sourceTreeHash
      && canonicalJsonStringify(source.exportedSource.source)
        === canonicalJsonStringify(stableSource)
      && source.admittedSource.commitEpochSeconds
        === stableBuild.sourceDateEpoch,
    "source admission projection",
  );
  requireJoin(
    canonicalJsonStringify(stableBuild.inputs)
      === canonicalJsonStringify(toolchain.inputs)
      && canonicalJsonStringify(stableBuild.inputs)
        === canonicalJsonStringify(first.inputs)
      && canonicalJsonStringify(stableBuild.inputs)
        === canonicalJsonStringify(second.inputs)
      && canonicalJsonStringify(stableBuild.compiler)
        === canonicalJsonStringify(toolchain.compiler)
      && canonicalJsonStringify(stableBuild.compiler)
        === canonicalJsonStringify(first.compiler)
      && canonicalJsonStringify(stableBuild.compiler)
        === canonicalJsonStringify(second.compiler)
      && canonicalJsonStringify(stableBuild.packageManager)
        === canonicalJsonStringify(toolchain.packageManager)
      && canonicalJsonStringify(stableBuild.packageManager)
        === canonicalJsonStringify(first.packageManager)
      && canonicalJsonStringify(stableBuild.packageManager)
        === canonicalJsonStringify(second.packageManager),
    "build input compiler and package manager projections",
  );
  requireJoin(
    canonicalJsonStringify(stableBuild.buildToolchain.requirement)
      === canonicalJsonStringify(buildHost.requirement)
      && canonicalJsonStringify(
        stableBuild.buildToolchain.installRecipe,
      ) === canonicalJsonStringify(toolchain.installRecipe)
      && canonicalJsonStringify(stableBuild.buildToolchain.tree)
        === canonicalJsonStringify(toolchain.tree)
      && canonicalJsonStringify(stableBuild.buildToolchain.tree)
        === canonicalJsonStringify(first.buildToolchain)
      && canonicalJsonStringify(stableBuild.buildToolchain.tree)
        === canonicalJsonStringify(second.buildToolchain),
    "build toolchain deterministic projection",
  );
  requireJoin(
    canonicalJsonStringify(stableSource)
      === canonicalJsonStringify(first.source)
      && canonicalJsonStringify(stableSource)
        === canonicalJsonStringify(second.source)
      && stableBuild.sourceStage.exportedTreeHash
        === stableSource.sourceTreeHash
      && stableBuild.sourceStage.exportedFileTreeHash
        === stableSource.exportedFileTreeHash
      && stableBuild.sourceStage.exportedFileCount
        === stableSource.exportedFileCount
      && stableBuild.sourceStage.exportedDirectoryCount
        === stableSource.exportedDirectoryCount
      && stableBuild.sourceStage.exportedTotalBytes
        === stableSource.exportedTotalBytes
      && stableBuild.sourceStage.sourceBindingHash
        === stableSource.bindingHash
      && first.stage.sourceBuildContextPolicy
        === stableBuild.sourceStage.buildContextPolicy
      && second.stage.sourceBuildContextPolicy
        === stableBuild.sourceStage.buildContextPolicy,
    "source stage deterministic projection",
  );
  requireJoin(
    first.command.contractHash === stableBuild.buildContractHash
      && second.command.contractHash
        === stableBuild.buildContractHash
      && first.command.commandRef === stableBuild.commandRef
      && second.command.commandRef === stableBuild.commandRef
      && first.sourceDateEpoch === stableBuild.sourceDateEpoch
      && second.sourceDateEpoch === stableBuild.sourceDateEpoch
      && first.process.commandResult.sourceSha
        === manifest.release.codeSha
      && second.process.commandResult.sourceSha
        === manifest.release.codeSha,
    "build command and source clock projection",
  );
  requireJoin(
    first.output.outputClosureHash
      === stableBuild.reproducibleOutputClosureHash
      && second.output.outputClosureHash
        === stableBuild.reproducibleOutputClosureHash
      && canonicalJsonStringify(first.output.runtimePayload)
        === canonicalJsonStringify(manifest.runtimePayload)
      && canonicalJsonStringify(
        first.output.npmMaterializationReceipt,
      ) === canonicalJsonStringify(
        external.materializationReceipt,
      )
      && canonicalJsonStringify(
        first.output.legacyStitchConverter,
      ) === canonicalJsonStringify(
        manifest.legacyAssets.stitchConverter,
      ),
    "reproducible output projection",
  );
  requireJoin(
    canonicalJsonStringify(
      source.implementation.module.hostAdmissionReceipt.host,
    ) === canonicalJsonStringify(hostIdentity)
      && canonicalJsonStringify(
        source.gitTool.executable.hostAdmissionReceipt.host,
      ) === canonicalJsonStringify(hostIdentity)
      && canonicalJsonStringify(
        source.implementation.module.hostAdmissionReceipt.verifier,
      ) === canonicalJsonStringify(
        external.hostRuntime.bootstrap.executable
          .hostAdmissionReceipt.verifier,
      )
      && canonicalJsonStringify(
        source.gitTool.executable.hostAdmissionReceipt.verifier,
      ) === canonicalJsonStringify(
        external.hostRuntime.bootstrap.executable
          .hostAdmissionReceipt.verifier,
      ),
    "source host verifier projection",
  );
  requireJoin(
    buildHost.host.platform === external.hostRuntime.platform
      && buildHost.host.architecture
        === external.hostRuntime.architecture
      && buildHost.host.macosProductVersion
        === external.hostRuntime.macosProductVersion
      && buildHost.host.macosBuildVersion
        === external.hostRuntime.macosBuildVersion
      && buildHost.host.darwinKernelRelease
        === external.hostRuntime.darwinKernelRelease
      && buildHost.node.version === external.nodeRuntime.version
      && buildHost.node.modulesAbi
        === external.nodeRuntime.modulesAbi
      && buildHost.node.napiVersion
        === external.nodeRuntime.napiVersion
      && buildHost.node.platform === external.nodeRuntime.platform
      && buildHost.node.architecture
        === external.nodeRuntime.architecture
      && nodeExecutable?.hash
        === buildHost.node.executable.contentHash
      && buildHost.npm.version
        === stableBuild.packageManager.version
      && buildHost.npm.packageTree.normalizedTreeHash
        === stableBuild.packageManager.packageTreeHash
      && buildHost.npm.cli.contentHash
        === stableBuild.packageManager.executableHash,
    "build host runtime projection",
  );

  if (joins.length > 0) {
    context.addIssue({
      code: "custom",
      message:
        `Platform release candidate envelope joins failed: ${joins.join(", ")}`,
    });
  }
});

export const PlatformReleaseCandidateEnvelopeV2Schema =
  PlatformReleaseCandidateEnvelopeIdentityV2Schema;

export type PlatformReleaseCandidateEnvelopeV2 = z.infer<
  typeof PlatformReleaseCandidateEnvelopeV2Schema
>;

export function parsePlatformReleaseBuildAttestationCandidateV2(
  input: unknown,
): PlatformReleaseBuildAttestationV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_BUILD_ATTESTATION_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseBuildAttestationV2Schema.parse(snapshot),
  );
}

export function parsePlatformReleaseCandidateEnvelopeV2(
  input: unknown,
): PlatformReleaseCandidateEnvelopeV2 {
  const snapshot = boundedPlatformReleaseJsonSnapshotV2(
    input,
    PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_MAX_CANONICAL_BYTES,
  );
  return deepFreezePlatformReleaseJsonV2(
    PlatformReleaseCandidateEnvelopeV2Schema.parse(snapshot),
  );
}

export function bindPlatformReleaseCandidateEnvelopeV2(
  manifest: PlatformReleaseManifestV2,
  buildAttestation: PlatformReleaseBuildAttestationV2,
): PlatformReleaseCandidateEnvelopeV2 {
  return parsePlatformReleaseCandidateEnvelopeV2({
    schema: PLATFORM_RELEASE_CANDIDATE_ENVELOPE_V2_SCHEMA,
    manifest,
    buildAttestation,
  });
}
