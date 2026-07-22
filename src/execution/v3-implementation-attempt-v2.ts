import { execFileSync } from "node:child_process";

import { SemanticArtifactEnvelopeV1Schema } from "../product-compiler/artifact-store.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../product-compiler/canonical-json.js";
import type {
  ExactSealedRuntimePacket,
  SealedRuntimePacketV3,
} from "../product-compiler/runtime-artifact-reader.js";
import { ProductCompilationReportV3Schema } from "../product-compiler/schemas/compilation-report-v3.js";
import {
  ImplementationDependencyOutputV2Schema,
  type ImplementationDependencyOutputV2,
  type LegacyImplementationSliceV2 as ImplementationSliceV2,
} from "../product-compiler/schemas/implementation-slice-v2-legacy.js";
import {
  compileLegacyImplementationSliceV2 as compileImplementationSliceV2,
  verifyLegacyImplementationSliceV2 as verifyImplementationSliceV2,
  type LegacyImplementationSliceCompilerInputV2 as ImplementationSliceCompilerInputV2,
  type LegacyImplementationSliceVerificationInputV2 as ImplementationSliceVerificationInputV2,
} from "../product-compiler/slice-compiler-v2-legacy.js";
import type { SemanticArtifactEnvelopeV1 } from "../product-compiler/artifact-store.js";
import type { SourceRevisionV1 } from "./schemas/execution-attempt-v1.js";
import { resolveV3GitRevision } from "./v3-git-revision.js";
import { createV3ArtifactRefKeyV2 } from "./v3-artifact-ref-key-v2.js";
import {
  V3PreparationClaimAuthorityV2Schema,
  type V3PreparationClaimAuthorityV2,
} from "./v3-preparation-claim-authority-v2.js";
import {
  captureV3ImplementationSourceSnapshotsV2,
  type V3SourceSnapshotLimitsV2,
} from "./v3-source-snapshot-v2.js";

export type V3ImplementationAttemptV2AssemblyErrorCode =
  | "V3_ATTEMPT_V2_AUTHORITY_INVALID"
  | "V3_ATTEMPT_V2_IDENTITY_MISMATCH"
  | "V3_ATTEMPT_V2_NATIVE_PACKET_REQUIRED"
  | "V3_ATTEMPT_V2_PACKET_AUTHORITY_MISMATCH"
  | "V3_ATTEMPT_V2_COMPILATION_REPORT_MISMATCH"
  | "V3_ATTEMPT_V2_STORY_NOT_FOUND"
  | "V3_ATTEMPT_V2_DEPENDENCY_AUTHORITY_MISMATCH"
  | "V3_ATTEMPT_V2_TOPOLOGY_AUTHORITY_MISMATCH"
  | "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH"
  | "V3_ATTEMPT_V2_SLICE_COMPILATION_REJECTED"
  | "V3_ATTEMPT_V2_SLICE_VERIFICATION_REJECTED";

export class V3ImplementationAttemptV2AssemblyError extends Error {
  constructor(
    readonly code: V3ImplementationAttemptV2AssemblyErrorCode,
    message: string,
    readonly evidence?: unknown,
  ) {
    super(message);
    this.name = "V3ImplementationAttemptV2AssemblyError";
  }
}

export type V3ImplementationAttemptV2AssemblyInput = Readonly<{
  runId: string;
  stepId: string;
  storyId: string;
  worktree: string;
  preparationAuthority: V3PreparationClaimAuthorityV2;
}>;

export type V3ImplementationAttemptV2AssemblerDependencies = Readonly<{
  readPacket(runId: string): Promise<ExactSealedRuntimePacket>;
  captureBaseRevision?(worktree: string, expectedSha: string): SourceRevisionV1;
  assertCleanWorktree?(worktree: string): void;
  sourceSnapshotLimits?: Partial<V3SourceSnapshotLimitsV2>;
}>;

export type V3ImplementationAttemptV2AssemblyResult = Readonly<{
  preparationAuthority: V3PreparationClaimAuthorityV2;
  preparationAuthorityHash: string;
  packet: SealedRuntimePacketV3;
  packetHash: string;
  compilationReportHash: string;
  sourceBefore: SourceRevisionV1;
  dependencyOutputs: readonly ImplementationDependencyOutputV2[];
  compilerInput: ImplementationSliceCompilerInputV2;
  sliceVerificationInput: ImplementationSliceVerificationInputV2;
  slice: ImplementationSliceV2;
  sliceHash: string;
  sliceRefKey: string;
  envelope: SemanticArtifactEnvelopeV1;
}>;

function fail(
  code: V3ImplementationAttemptV2AssemblyErrorCode,
  message: string,
  evidence?: unknown,
): never {
  throw new V3ImplementationAttemptV2AssemblyError(code, message, evidence);
}

function sameRevision(left: SourceRevisionV1, right: SourceRevisionV1): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

function assertCleanInitialWorktree(worktree: string): void {
  let status: Buffer;
  try {
    status = execFileSync(
      "git",
      ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
      {
        cwd: worktree,
        encoding: "buffer",
        timeout: 10_000,
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          GIT_OPTIONAL_LOCKS: "0",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
  } catch (error) {
    fail(
      "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
      "Initial implementation worktree cleanliness could not be verified",
      error,
    );
  }
  if (status.byteLength !== 0) {
    fail(
      "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
      "Initial ImplementationAttemptV2 requires a clean exact base worktree",
      { statusByteLength: status.byteLength },
    );
  }
}

function isNativePacketV3(packet: ExactSealedRuntimePacket): packet is SealedRuntimePacketV3 {
  return packet.packet.schema === "setfarm.product-build-packet.v3"
    && packet.compilationReport.schema === "setfarm.product-compilation-report.v3"
    && "implementationSourceMap" in packet;
}

function semanticEnvelopeHash(
  artifactType: string,
  packet: Pick<SealedRuntimePacketV3, "producer">,
  payload: unknown,
): string {
  return hashCanonicalJson(SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer: packet.producer,
    payload,
  }));
}

function exactDependencyOutputs(
  authority: V3PreparationClaimAuthorityV2,
): readonly ImplementationDependencyOutputV2[] {
  return authority.dependencyAttempts.map((attempt) =>
    ImplementationDependencyOutputV2Schema.parse({
      storyId: attempt.storyId,
      sliceHash: attempt.sliceHash,
      outputHash: attempt.outputHash,
      sourceAfter: attempt.sourceAfter,
      fileSignatures: attempt.fileSignatures,
    }));
}

function sourcePathsForStory(
  packet: SealedRuntimePacketV3,
  storyId: string,
): readonly Readonly<{ pathRef: string; path: string }>[] {
  const story = packet.storyPlan.stories.find((candidate) => candidate.id === storyId);
  if (!story) {
    fail(
      "V3_ATTEMPT_V2_STORY_NOT_FOUND",
      `Story ${storyId} is absent from the exact native ProductBuildPacketV3`,
    );
  }
  const grantById = new Map(packet.buildTopology.sharedGrants.map((grant) => [grant.id, grant] as const));
  const pathById = new Map(packet.buildTopology.pathBindings.map((binding) => [binding.id, binding] as const));
  const refs = [...story.ownedPathRefs];
  for (const grantRef of story.sharedGrantRefs) {
    const grant = grantById.get(grantRef);
    if (!grant || grant.toOwnerRef !== story.ownerRef) {
      fail(
        "V3_ATTEMPT_V2_TOPOLOGY_AUTHORITY_MISMATCH",
        `Story grant ${grantRef} is absent or addressed to another owner`,
      );
    }
    refs.push(...grant.pathRefs);
  }
  const unique = [...new Set(refs)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  if (unique.length !== refs.length) {
    fail(
      "V3_ATTEMPT_V2_TOPOLOGY_AUTHORITY_MISMATCH",
      "Story-owned and granted path closures overlap",
    );
  }
  return unique.map((pathRef) => {
    const binding = pathById.get(pathRef);
    if (!binding) {
      fail(
        "V3_ATTEMPT_V2_TOPOLOGY_AUTHORITY_MISMATCH",
        `Story path ${pathRef} is absent from exact BuildTopologyV1`,
      );
    }
    return { pathRef, path: binding.path };
  });
}

function assertPacketAuthority(
  packet: SealedRuntimePacketV3,
  authority: V3PreparationClaimAuthorityV2,
  runId: string,
): void {
  const report = ProductCompilationReportV3Schema.safeParse(packet.compilationReport);
  if (!report.success || report.data.status !== "sealed") {
    fail(
      "V3_ATTEMPT_V2_COMPILATION_REPORT_MISMATCH",
      "Runtime packet does not carry one strict sealed ProductCompilationReportV3",
      report.success ? undefined : report.error.issues,
    );
  }
  const packetHash = semanticEnvelopeHash(
    "setfarm.product-build-packet.v3",
    packet,
    packet.packet,
  );
  if (
    packet.runId !== runId
    || packet.packetHash !== packetHash
    || packet.refs.packet !== packetHash
    || authority.packetHash !== packetHash
    || packet.compilationReport.packetHash !== packetHash
  ) {
    fail(
      "V3_ATTEMPT_V2_PACKET_AUTHORITY_MISMATCH",
      "Preparation authority, runtime packet, packet envelope, and compilation report do not bind one packet",
    );
  }
  const reportHash = semanticEnvelopeHash(
    "setfarm.product-compilation-report.v3",
    packet,
    report.data,
  );
  if (
    packet.refs.compilationReport !== reportHash
    || authority.compilationReportHash !== reportHash
    || packet.producer.codeSha !== packet.packet.compiler.codeSha
    || canonicalJsonStringify(report.data.compiler)
      !== canonicalJsonStringify(packet.packet.compiler)
    || canonicalJsonStringify(report.data.validationIds)
      !== canonicalJsonStringify(packet.packet.validationIds)
    || report.data.artifactHashes.productSpecV2 !== packet.packet.productSpecV2Hash
    || report.data.artifactHashes.designGraphV2 !== packet.packet.designGraphV2Hash
    || report.data.artifactHashes.buildTopologyV1 !== packet.packet.buildTopologyV1Hash
    || report.data.artifactHashes.storyPlanV2 !== packet.packet.storyPlanV2Hash
    || report.data.artifactHashes.designSourceClosureV2
      !== packet.packet.designSourceClosureV2Hash
    || report.data.artifactHashes.implementationSourceMapV1
      !== packet.packet.implementationSourceMapV1Hash
  ) {
    fail(
      "V3_ATTEMPT_V2_COMPILATION_REPORT_MISMATCH",
      "Preparation authority does not bind the exact sealed ProductCompilationReportV3 envelope",
    );
  }
}

function captureBaseOrFail(
  captureBaseRevision: (worktree: string, expectedSha: string) => SourceRevisionV1,
  worktree: string,
  expectedSha: string,
): SourceRevisionV1 {
  try {
    return captureBaseRevision(worktree, expectedSha);
  } catch (error) {
    if (error instanceof V3ImplementationAttemptV2AssemblyError) throw error;
    fail(
      "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
      "Implementation base commit/tree authority could not be reproduced",
      error,
    );
  }
}

function assertCleanOrFail(
  assertCleanWorktree: (worktree: string) => void,
  worktree: string,
): void {
  try {
    assertCleanWorktree(worktree);
  } catch (error) {
    if (error instanceof V3ImplementationAttemptV2AssemblyError) throw error;
    fail(
      "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
      "Implementation worktree cleanliness authority could not be reproduced",
      error,
    );
  }
}

function assertDependencyAuthority(
  packet: SealedRuntimePacketV3,
  authority: V3PreparationClaimAuthorityV2,
): void {
  const story = packet.storyPlan.stories.find((candidate) => candidate.id === authority.storyId);
  if (!story) {
    fail(
      "V3_ATTEMPT_V2_STORY_NOT_FOUND",
      `Story ${authority.storyId} is absent from the exact StoryPlanV2`,
    );
  }
  if (
    canonicalJsonStringify(story.dependsOn)
      !== canonicalJsonStringify(authority.projectedDependencyIds)
  ) {
    fail(
      "V3_ATTEMPT_V2_DEPENDENCY_AUTHORITY_MISMATCH",
      "Preparation dependency closure differs from exact StoryPlanV2 dependsOn",
    );
  }
}

/**
 * Native V3 shadow assembler. It deliberately performs no claim, attempt,
 * artifact-ref, or model-dispatch mutation. Production activation must wait
 * for EvidencePlanV2, HandoffV2, ContextV2, and completion reload to share the
 * same authority transaction.
 */
export function createV3ImplementationAttemptV2Assembler(
  dependencies: V3ImplementationAttemptV2AssemblerDependencies,
) {
  const captureBaseRevision = dependencies.captureBaseRevision
    ?? ((worktree: string, expectedSha: string) => resolveV3GitRevision({
      repo: worktree,
      requestedRef: "HEAD",
      expectedSha,
    }));
  const assertCleanWorktree = dependencies.assertCleanWorktree
    ?? assertCleanInitialWorktree;
  return Object.freeze({
    async assemble(
      input: V3ImplementationAttemptV2AssemblyInput,
    ): Promise<V3ImplementationAttemptV2AssemblyResult> {
      const parsedAuthority = V3PreparationClaimAuthorityV2Schema.safeParse(
        input.preparationAuthority,
      );
      if (!parsedAuthority.success) {
        fail(
          "V3_ATTEMPT_V2_AUTHORITY_INVALID",
          "Implementation assembly requires one canonical PreparationClaimAuthorityV2",
          parsedAuthority.error.issues,
        );
      }
      const authority = parsedAuthority.data;
      if (
        input.stepId !== "implement"
        || authority.runId !== input.runId
        || authority.stepId !== input.stepId
        || authority.storyId !== input.storyId
      ) {
        fail(
          "V3_ATTEMPT_V2_IDENTITY_MISMATCH",
          "Assembly identity differs from the exact preparation authority",
        );
      }

      const exactPacket = await dependencies.readPacket(input.runId);
      if (!isNativePacketV3(exactPacket)) {
        fail(
          "V3_ATTEMPT_V2_NATIVE_PACKET_REQUIRED",
          "ImplementationAttemptV2 cannot infer native V3 authority from a historical packet",
        );
      }
      assertPacketAuthority(exactPacket, authority, input.runId);
      assertDependencyAuthority(exactPacket, authority);

      const baseBefore = captureBaseOrFail(
        captureBaseRevision,
        input.worktree,
        authority.baseRevision.sha,
      );
      if (!sameRevision(baseBefore, authority.baseRevision)) {
        fail(
          "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
          "Implementation HEAD no longer equals the immutable commit/tree pinned by preparation",
          { expected: authority.baseRevision, observed: baseBefore },
        );
      }
      assertCleanOrFail(assertCleanWorktree, input.worktree);
      const sourcePaths = sourcePathsForStory(exactPacket, input.storyId);
      const captured = captureV3ImplementationSourceSnapshotsV2({
        worktree: input.worktree,
        files: sourcePaths,
        ...(dependencies.sourceSnapshotLimits
          ? { limits: dependencies.sourceSnapshotLimits }
          : {}),
      });
      assertCleanOrFail(assertCleanWorktree, input.worktree);
      const baseAfter = captureBaseOrFail(
        captureBaseRevision,
        input.worktree,
        authority.baseRevision.sha,
      );
      if (!sameRevision(baseBefore, baseAfter)) {
        fail(
          "V3_ATTEMPT_V2_SOURCE_REVISION_MISMATCH",
          "Implementation source changed while its exact SliceV2 snapshot was captured",
          {
            baseBefore,
            baseAfter,
          },
        );
      }

      const dependencyOutputs = exactDependencyOutputs(authority);
      const compilerInput: ImplementationSliceCompilerInputV2 = {
        packetHash: exactPacket.packetHash,
        packet: exactPacket.packet,
        productSpec: exactPacket.productSpec,
        designGraph: exactPacket.designGraph,
        buildTopology: exactPacket.buildTopology,
        storyPlan: exactPacket.storyPlan,
        designSourceClosure: exactPacket.designSourceClosure,
        implementationSourceMap: exactPacket.implementationSourceMap,
        storyId: input.storyId,
        sourceRevision: baseBefore,
        producer: exactPacket.producer,
        currentFiles: [...captured.snapshots],
        dependencyOutputs: [...dependencyOutputs],
      };
      const compiled = compileImplementationSliceV2(compilerInput);
      if (compiled.status === "rejected") {
        fail(
          "V3_ATTEMPT_V2_SLICE_COMPILATION_REJECTED",
          "Exact native V3 authority could not compile ImplementationSliceV2",
          compiled.diagnostics,
        );
      }
      const sliceVerificationInput: ImplementationSliceVerificationInputV2 = {
        compilerInput,
        slice: compiled.slice,
      };
      const verified = verifyImplementationSliceV2(sliceVerificationInput);
      if (verified.status === "rejected" || verified.sliceHash !== compiled.sliceHash) {
        fail(
          "V3_ATTEMPT_V2_SLICE_VERIFICATION_REJECTED",
          "ImplementationSliceV2 did not reproduce from its independent compiler input",
          verified.diagnostics,
        );
      }
      return Object.freeze({
        preparationAuthority: authority,
        preparationAuthorityHash: authority.authorityHash,
        packet: exactPacket,
        packetHash: exactPacket.packetHash,
        compilationReportHash: authority.compilationReportHash,
        sourceBefore: baseBefore,
        dependencyOutputs,
        compilerInput,
        sliceVerificationInput,
        slice: verified.slice,
        sliceHash: verified.sliceHash,
        sliceRefKey: createV3ArtifactRefKeyV2("slice", input.storyId, verified.sliceHash),
        envelope: compiled.envelope,
      });
    },
  });
}
