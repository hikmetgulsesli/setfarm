import { isProxy } from "node:util/types";

import { z } from "zod";

import {
  ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
  copyPreparedArtifactStoreBatchCanonicalItemsV1,
  prepareArtifactStoreBatchPlanV1,
  type PreparedArtifactStoreBatchV1,
} from "../product-compiler/artifact-store-batch-plan.js";
import {
  DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS,
  canonicalJsonBytesBounded,
} from "../product-compiler/bounded-canonical-json.js";
import {
  canonicalJsonStringify,
  hashCanonicalJson,
} from "../product-compiler/canonical-json.js";
import {
  verifyImplementationClosureV2,
  verifyImplementationClosureV2ForTest,
  type ImplementationClosureVerificationResultV2,
} from "../product-compiler/implementation-closure-v2.js";
import {
  inspectScaffoldBaseMaterializationReceiptV2,
  isProductionNodeScaffoldPrivateStageV2,
  revalidateNodeProductSourcesV1,
  type MaterializedNodeScaffoldPrivateStageV2,
} from "../product-compiler/node-scaffold-private-materializer-v2.js";
import {
  CANDIDATE_SOURCE_ABSENCE_ENTRY_V1_SCHEMA,
  CANDIDATE_SOURCE_ARTIFACT_TYPE_V1,
  CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA,
  CANDIDATE_SOURCE_CONTENT_TREE_V1_SCHEMA,
  CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1,
  CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES,
  CANDIDATE_SOURCE_RECEIPT_V1_BOUNDED_WORK_LIMITS,
  CANDIDATE_SOURCE_RECEIPT_V1_MAX_CANONICAL_BYTES,
  CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA,
  CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
  CANDIDATE_SOURCE_SEMANTIC_REVISION_V1_SCHEMA,
  CandidateSourceEnvelopeV1Schema,
  CandidateSourceReceiptV1Schema,
  hashCandidateSourceAbsenceEntryV1,
  hashCandidateSourceAbsenceMembershipV1,
  hashCandidateSourceContentEntryV1,
  hashCandidateSourceContentTreeV1,
  hashCandidateSourceEntryMembershipV1,
  hashCandidateSourceReceiptV1,
  hashCandidateSourceSemanticRevisionV1,
  recursivelyFreezeCandidateSourceReceiptV1,
  type CandidateSourceAbsenceEntryV1,
  type CandidateSourceContentEntryV1,
  type CandidateSourceContentTreeHashPayloadV1,
  type CandidateSourceEnvelopeV1,
  type CandidateSourceReceiptHashPayloadV1,
  type CandidateSourceReceiptV1,
  type CandidateSourceSemanticRevisionHashPayloadV1,
} from "./schemas/candidate-source-receipt-v1.js";

const COMPILER_INPUT_MAX_CANONICAL_BYTES_V1 = 120 * 1024 * 1024;
const VERIFIER_INPUT_MAX_CANONICAL_BYTES_V1 = 124 * 1024 * 1024;
const INPUT_BOUNDED_WORK_LIMITS_V1 = Object.freeze({
  maxDepth: DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxDepth + 64,
  maxNodes: COMPILER_INPUT_MAX_CANONICAL_BYTES_V1 + 600_000,
  maxContainerEntries:
    DEFAULT_CANONICAL_JSON_BOUNDED_WORK_LIMITS.maxContainerEntries,
  maxWorkUnits:
    (COMPILER_INPUT_MAX_CANONICAL_BYTES_V1 * 8) + (28 * 1024 * 1024),
});
const VERIFIER_BOUNDED_WORK_LIMITS_V1 = Object.freeze({
  ...INPUT_BOUNDED_WORK_LIMITS_V1,
  maxNodes: VERIFIER_INPUT_MAX_CANONICAL_BYTES_V1 + 640_000,
  maxWorkUnits:
    (VERIFIER_INPUT_MAX_CANONICAL_BYTES_V1 * 8) + (28 * 1024 * 1024),
});
const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly [];

const CompilerInputV1Schema = z.object({
  closureVerificationInput: z.unknown(),
}).strict();

const VerifierInputV1Schema = CompilerInputV1Schema.extend({
  expectedCandidateSourceEnvelopeHash: z.string().regex(/^[a-f0-9]{64}$/u),
  candidateSourceEnvelope: z.unknown(),
}).strict();

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 1_500)
    : "Unknown CandidateSourceV1 failure";
}

function boundedSnapshot(
  input: unknown,
  maxBytes: number,
  workLimits: Omit<Parameters<typeof canonicalJsonBytesBounded>[1], "maxBytes">,
): unknown {
  const bytes = canonicalJsonBytesBounded(input, { maxBytes, ...workLimits });
  return JSON.parse(bytes.toString("utf8"));
}

export type CandidateSourceDiagnosticCodeV1 =
  | "CANDIDATE_SOURCE_V1_ARTIFACT_INVALID"
  | "CANDIDATE_SOURCE_V1_CANDIDATE_MISMATCH"
  | "CANDIDATE_SOURCE_V1_CLOSURE_REJECTED"
  | "CANDIDATE_SOURCE_V1_CROSS_AUTHORITY_MISMATCH"
  | "CANDIDATE_SOURCE_V1_EXPECTED_HASH_MISMATCH"
  | "CANDIDATE_SOURCE_V1_INPUT_INVALID"
  | "CANDIDATE_SOURCE_V1_MATERIALIZATION_REJECTED"
  | "CANDIDATE_SOURCE_V1_PUBLICATION_PREFLIGHT_REJECTED"
  | "CANDIDATE_SOURCE_V1_SCOPE_REJECTED";

export type CandidateSourceDiagnosticV1 = Readonly<{
  code: CandidateSourceDiagnosticCodeV1;
  path: string;
  message: string;
}>;

export type CandidateSourcePublicationPreflightV1 = Readonly<{
  artifactType: typeof CANDIDATE_SOURCE_ARTIFACT_TYPE_V1;
  envelopeHash: string;
  byteLength: number;
  durabilityTier: 0;
  preparedPublication: PreparedArtifactStoreBatchV1;
}>;

export type CompiledCandidateSourceV1 = Readonly<{
  value: Readonly<CandidateSourceReceiptV1>;
  envelope: Readonly<CandidateSourceEnvelopeV1>;
  envelopeHash: string;
  canonicalBytes: string;
  publicationPreflight: CandidateSourcePublicationPreflightV1;
}>;

type RejectedCandidateSourceV1 = Readonly<{
  status: "rejected";
  diagnostics: readonly CandidateSourceDiagnosticV1[];
}>;

export type CandidateSourceCompilationResultV1 =
  | Readonly<{
      status: "shadow_verified_source";
      diagnostics: readonly [];
      candidateSource: CompiledCandidateSourceV1;
      semanticRevisionHash: string;
      operationalReceiptHash: string;
      buildDisposition:
        "authenticated_private_build_blocked_until_candidate_build_v2";
    }>
  | RejectedCandidateSourceV1;

function rejected(
  code: CandidateSourceDiagnosticCodeV1,
  path: string,
  message: string,
): RejectedCandidateSourceV1 {
  return Object.freeze({
    status: "rejected" as const,
    diagnostics: Object.freeze([Object.freeze({
      code,
      path: path.slice(0, 1_000),
      message: message.slice(0, 1_500),
    })]),
  });
}

class CandidateSourcePublicationPreflightErrorV1 extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "CandidateSourcePublicationPreflightErrorV1";
  }
}

function publicationPreflightV1(
  envelope: CandidateSourceEnvelopeV1,
  canonicalBytes: Buffer,
): CandidateSourcePublicationPreflightV1 {
  try {
    const envelopeHash = hashCanonicalJson(envelope);
    const preparedPublication = prepareArtifactStoreBatchPlanV1({
      schema: ARTIFACT_STORE_BATCH_PLAN_SCHEMA_V1,
      items: [{ durabilityTier: 0, envelope }],
    });
    const items = copyPreparedArtifactStoreBatchCanonicalItemsV1(
      preparedPublication,
    );
    if (
      items.length !== 1
      || items[0]!.durabilityTier !== 0
      || items[0]!.identity.hash !== envelopeHash
      || items[0]!.identity.byteLength !== canonicalBytes.byteLength
      || !items[0]!.bytes.equals(canonicalBytes)
    ) {
      throw new CandidateSourcePublicationPreflightErrorV1(
        "Artifact-store preflight changed CandidateSourceV1 identity",
      );
    }
    return Object.freeze({
      artifactType: CANDIDATE_SOURCE_ARTIFACT_TYPE_V1,
      envelopeHash,
      byteLength: canonicalBytes.byteLength,
      durabilityTier: 0 as const,
      preparedPublication,
    });
  } catch (error) {
    if (error instanceof CandidateSourcePublicationPreflightErrorV1) throw error;
    throw new CandidateSourcePublicationPreflightErrorV1(
      "CandidateSourceV1 artifact-store publication preflight failed",
      error,
    );
  }
}

type VerifiedClosureV2 = Extract<
  ImplementationClosureVerificationResultV2,
  { status: "verified_shadow" }
>;

function exactPath(
  closure: VerifiedClosureV2,
  normalizedLocator: string,
) {
  const matches = closure.contextAttachments.fileTree.paths.filter(
    (entry) => entry.normalizedLocator === normalizedLocator,
  );
  if (matches.length !== 1) {
    throw new Error(`FileTreeV3 does not contain one exact ${normalizedLocator}`);
  }
  return matches[0]!;
}

function exactBaseAsset(
  base: ReturnType<typeof inspectScaffoldBaseMaterializationReceiptV2>,
  normalizedLocator: string,
) {
  const matches = base.assets.filter(
    (asset) => asset.normalizedLocator === normalizedLocator,
  );
  if (matches.length !== 1) {
    throw new Error(`Scaffold base does not contain one exact ${normalizedLocator}`);
  }
  return matches[0]!;
}

function exactMaterializedSource(
  sourceMaterialization: Awaited<ReturnType<typeof revalidateNodeProductSourcesV1>>,
  sourceRole: "runtime" | "test",
) {
  const matches = sourceMaterialization.sources.filter(
    (source) => source.sourceRole === sourceRole,
  );
  if (matches.length !== 1) {
    throw new Error(`Source materialization does not contain one exact ${sourceRole}`);
  }
  return matches[0]!;
}

function baseContentEntryV1(
  closure: VerifiedClosureV2,
  base: ReturnType<typeof inspectScaffoldBaseMaterializationReceiptV2>,
  role:
    | "dependency_lock_manifest"
    | "package_manifest"
    | "typescript_compiler_config",
  normalizedLocator: "package-lock.json" | "package.json" | "tsconfig.json",
): CandidateSourceContentEntryV1 {
  const path = exactPath(closure, normalizedLocator);
  const asset = exactBaseAsset(base, normalizedLocator);
  if (
    path.ownerRef !== "OWNER_SETUP_V3"
    || path.currentState.state !== "present_file"
    || path.currentState.contentHash !== asset.rawHash
    || path.currentState.byteLength !== asset.rawByteLength
    || asset.mode !== "0444"
  ) {
    throw new Error(`${normalizedLocator} FileTree and scaffold bytes differ`);
  }
  const identity = {
    schema: CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA,
    role,
    pathRef: path.pathRef,
    ownerRef: "OWNER_SETUP_V3" as const,
    normalizedLocator,
    mediaType: "application/json" as const,
    mode: "0444" as const,
    contentHash: asset.rawHash,
    byteLength: asset.rawByteLength,
    sourceIdentityHash: null,
  };
  return {
    ...identity,
    entryHash: hashCandidateSourceContentEntryV1(identity),
  };
}

function generatedContentEntryV1(
  closure: VerifiedClosureV2,
  sourceMaterialization: Awaited<ReturnType<typeof revalidateNodeProductSourcesV1>>,
  sourceRole: "runtime" | "test",
): CandidateSourceContentEntryV1 {
  const source = exactMaterializedSource(sourceMaterialization, sourceRole);
  const path = exactPath(closure, source.source.normalizedLocator);
  const ownerRef = sourceRole === "runtime"
    ? "OWNER_NODE_PRODUCT_RUNTIME_GENERATOR_V2" as const
    : "OWNER_NODE_PRODUCT_TEST_GENERATOR_V2" as const;
  const role = sourceRole === "runtime"
    ? "runtime_source" as const
    : "test_source" as const;
  const sourcePathJoins = sourceRole === "runtime"
    ? path.authority.kind === "generated_runtime_source_target"
      && source.source.pathRef === path.pathRef
    : path.authority.kind === "generated_test_source_target"
      && source.source.pathRef === path.authority.sourcePathRef;
  if (
    path.ownerRef !== ownerRef
    || !sourcePathJoins
    || source.source.mode !== "0444"
  ) {
    throw new Error(`${sourceRole} source FileTree and materialization differ`);
  }
  const identity = {
    schema: CANDIDATE_SOURCE_CONTENT_ENTRY_V1_SCHEMA,
    role,
    pathRef: path.pathRef,
    ownerRef,
    normalizedLocator: source.source.normalizedLocator,
    mediaType: "text/typescript" as const,
    mode: "0444" as const,
    contentHash: source.source.contentHash,
    byteLength: source.source.byteLength,
    sourceIdentityHash: source.source.sourceIdentityHash,
  };
  return {
    ...identity,
    entryHash: hashCandidateSourceContentEntryV1(identity),
  };
}

function exactCrossAuthorityV1(
  closure: VerifiedClosureV2,
  sourceMaterialization: Awaited<ReturnType<typeof revalidateNodeProductSourcesV1>>,
  base: ReturnType<typeof inspectScaffoldBaseMaterializationReceiptV2>,
  expectedScope: "production_host" | "test_fixture",
): boolean {
  const packet = closure.contextAttachments.packetEnvelope.payload;
  const fileTree = closure.contextAttachments.fileTree;
  const buildTopology = closure.contextAttachments.buildTopology;
  const runtimeReceipt = closure.contextAttachments.runtimeSourceReceipt;
  const testReceipt = closure.contextAttachments.testSourceReceipt;
  const runtime = exactMaterializedSource(sourceMaterialization, "runtime");
  const test = exactMaterializedSource(sourceMaterialization, "test");
  return sourceMaterialization.admissionScope === expectedScope
    && base.admissionScope === expectedScope
    && sourceMaterialization.profileId === fileTree.authority.profileId
    && fileTree.authority.productRef
      === packet.sourceMapAuthority.product.productRef
    && fileTree.manifestHash === packet.sourceMapAuthority.fileTree.manifestHash
    && fileTree.pathMembershipHash
      === packet.sourceMapAuthority.fileTree.pathMembershipHash
    && buildTopology.authority.productRef === fileTree.authority.productRef
    && buildTopology.authority.profileId === fileTree.authority.profileId
    && buildTopology.authority.fileTree.manifestHash === fileTree.manifestHash
    && buildTopology.logicalBuildHash
      === packet.sourceMapAuthority.buildTopology.logicalBuildHash
    && buildTopology.authority.commandContractHash
      === packet.execution.commandContractHash
    && buildTopology.authority.compilationContractHash
      === packet.execution.compilationContractHash
    && sourceMaterialization.buildTopology.fileTreeManifestHash
      === fileTree.manifestHash
    && sourceMaterialization.buildTopology.logicalBuildHash
      === buildTopology.logicalBuildHash
    && sourceMaterialization.buildTopology.manifestHash
      === buildTopology.manifestHash
    && sourceMaterialization.scaffold.baseReceiptHash === base.receiptHash
    && sourceMaterialization.scaffold.dependencyReceiptHash
      === buildTopology.operationalEvidence.dependencyReceiptHash
    && sourceMaterialization.scaffold.dependencyIdentityHash
      === buildTopology.operationalEvidence.dependencyIdentityHash
    && runtime.sourceReceipt.receiptHash === runtimeReceipt.receiptHash
    && runtime.sourceReceipt.logicalReceiptHash === runtimeReceipt.logicalReceiptHash
    && runtime.source.contentHash === runtimeReceipt.source.contentHash
    && runtime.source.sourceIdentityHash === runtimeReceipt.source.sourceIdentityHash
    && test.sourceReceipt.receiptHash === testReceipt.receiptHash
    && test.sourceReceipt.logicalReceiptHash === testReceipt.logicalReceiptHash
    && test.source.contentHash === testReceipt.source.contentHash
    && test.source.sourceIdentityHash === testReceipt.source.sourceIdentityHash
    && packet.logicalSourceAuthority.runtimeLogicalReceiptHash
      === runtimeReceipt.logicalReceiptHash
    && packet.logicalSourceAuthority.testLogicalReceiptHash
      === testReceipt.logicalReceiptHash;
}

async function compileInternalV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<CandidateSourceCompilationResultV1> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      COMPILER_INPUT_MAX_CANONICAL_BYTES_V1,
      INPUT_BOUNDED_WORK_LIMITS_V1,
    );
  } catch (error) {
    return rejected("CANDIDATE_SOURCE_V1_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = CompilerInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "CANDIDATE_SOURCE_V1_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "CandidateSourceV1 input is invalid",
    );
  }

  let production: boolean;
  try {
    production = isProductionNodeScaffoldPrivateStageV2(handle);
  } catch (error) {
    return rejected("CANDIDATE_SOURCE_V1_SCOPE_REJECTED", "/stage", errorMessage(error));
  }
  if (
    (expectedScope === "production_host" && !production)
    || (expectedScope === "test_fixture" && production)
  ) {
    return rejected(
      "CANDIDATE_SOURCE_V1_SCOPE_REJECTED",
      "/stage",
      "Candidate source cannot promote, downgrade or cross private-stage scope",
    );
  }

  const verifyClosure = expectedScope === "production_host"
    ? verifyImplementationClosureV2
    : verifyImplementationClosureV2ForTest;
  const closure = await verifyClosure(
    handle,
    parsed.data.closureVerificationInput,
  );
  if (closure.status !== "verified_shadow") {
    const first = closure.diagnostics[0];
    return rejected(
      "CANDIDATE_SOURCE_V1_CLOSURE_REJECTED",
      first?.path ?? "/closureVerificationInput",
      first?.message ?? "Fresh ImplementationClosureV2 verification was rejected",
    );
  }

  let sourceMaterialization;
  let base;
  try {
    sourceMaterialization = await revalidateNodeProductSourcesV1(handle);
    base = inspectScaffoldBaseMaterializationReceiptV2(handle);
  } catch (error) {
    return rejected(
      "CANDIDATE_SOURCE_V1_MATERIALIZATION_REJECTED",
      "/stage",
      errorMessage(error),
    );
  }
  try {
    if (!exactCrossAuthorityV1(
      closure,
      sourceMaterialization,
      base,
      expectedScope,
    )) {
      return rejected(
        "CANDIDATE_SOURCE_V1_CROSS_AUTHORITY_MISMATCH",
        "/closureVerificationInput",
        "Closure, source materialization, FileTree and BuildTopology differ",
      );
    }
    const fileTree = closure.contextAttachments.fileTree;
    const buildTopology = closure.contextAttachments.buildTopology;
    const runtimeReceipt = closure.contextAttachments.runtimeSourceReceipt;
    const testReceipt = closure.contextAttachments.testSourceReceipt;
    const packet = closure.contextAttachments.packetEnvelope;
    const npmrc = exactPath(closure, ".npmrc");
    if (
      npmrc.ownerRef !== "OWNER_SETUP_V3"
      || npmrc.currentState.state !== "absent"
    ) {
      return rejected(
        "CANDIDATE_SOURCE_V1_CROSS_AUTHORITY_MISMATCH",
        "/fileTree/paths",
        "FileTreeV3 must retain the exact project .npmrc absence",
      );
    }
    const entries = [
      baseContentEntryV1(
        closure,
        base,
        "dependency_lock_manifest",
        "package-lock.json",
      ),
      baseContentEntryV1(
        closure,
        base,
        "package_manifest",
        "package.json",
      ),
      generatedContentEntryV1(closure, sourceMaterialization, "test"),
      generatedContentEntryV1(closure, sourceMaterialization, "runtime"),
      baseContentEntryV1(
        closure,
        base,
        "typescript_compiler_config",
        "tsconfig.json",
      ),
    ];
    const absenceIdentity = {
      schema: CANDIDATE_SOURCE_ABSENCE_ENTRY_V1_SCHEMA,
      role: "project_npmrc" as const,
      pathRef: npmrc.pathRef,
      ownerRef: "OWNER_SETUP_V3" as const,
      normalizedLocator: ".npmrc" as const,
      absenceHash: npmrc.currentState.absenceHash,
    };
    const absences = [{
      ...absenceIdentity,
      entryHash: hashCandidateSourceAbsenceEntryV1(absenceIdentity),
    }] as [CandidateSourceAbsenceEntryV1];
    const treeIdentity: CandidateSourceContentTreeHashPayloadV1 = {
      schema: CANDIDATE_SOURCE_CONTENT_TREE_V1_SCHEMA,
      profileId: fileTree.authority.profileId,
      logicalRoot: "repository" as const,
      entryCount: 5 as const,
      entries,
      entryMembershipHash: hashCandidateSourceEntryMembershipV1(entries),
      absenceCount: 1 as const,
      absences,
      absenceMembershipHash: hashCandidateSourceAbsenceMembershipV1(absences),
    };
    const contentTree = {
      ...treeIdentity,
      contentTreeHash: hashCandidateSourceContentTreeV1(treeIdentity),
    };
    const closureValue = closure.closure;
    const revisionIdentity: CandidateSourceSemanticRevisionHashPayloadV1 = {
      schema: CANDIDATE_SOURCE_SEMANTIC_REVISION_V1_SCHEMA,
      revisionVersion: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
      origin: "generated_private_materialization_v1" as const,
      authority: {
        productRef: fileTree.authority.productRef,
        profileId: fileTree.authority.profileId,
        packet: {
          envelopeHash: closureValue.packet.envelopeHash,
          packetHash: closureValue.packet.packetHash,
        },
        implementationClosure: {
          artifactType: closure.envelope.artifactType,
          schema: closureValue.schema,
          version: closureValue.closureVersion,
          envelopeHash: closure.envelopeHash,
          closureHash: closureValue.closureHash,
          producerCodeSha: closure.envelope.producer.codeSha,
          storyCount: closureValue.storySet.storyCount,
          storyIdSetHash: closureValue.storySet.storyIdSetHash,
          storyMembershipHash: closureValue.storySet.membershipHash,
          dispositionHash: closureValue.implementation.dispositionHash,
          implementationMode: closureValue.implementation.mode,
          modelDispatch: closureValue.implementation.modelDispatch,
        },
        fileTree: {
          schema: fileTree.schema,
          manifestHash: fileTree.manifestHash,
          pathMembershipHash: fileTree.pathMembershipHash,
        },
        buildTopology: {
          schema: buildTopology.schema,
          version: buildTopology.topologyVersion,
          logicalBuildHash: buildTopology.logicalBuildHash,
          commandContractHash: buildTopology.authority.commandContractHash,
          compilationContractHash:
            buildTopology.authority.compilationContractHash,
        },
        runtimeSource: {
          schema: runtimeReceipt.schema,
          logicalReceiptHash: runtimeReceipt.logicalReceiptHash,
          sourceIdentityHash: runtimeReceipt.source.sourceIdentityHash,
          contentHash: runtimeReceipt.source.contentHash,
        },
        testSource: {
          schema: testReceipt.schema,
          logicalReceiptHash: testReceipt.logicalReceiptHash,
          sourceIdentityHash: testReceipt.source.sourceIdentityHash,
          contentHash: testReceipt.source.contentHash,
        },
      },
      contentTree,
    };
    const semanticRevision = {
      ...revisionIdentity,
      revisionHash: hashCandidateSourceSemanticRevisionV1(revisionIdentity),
    };
    const receiptIdentity: CandidateSourceReceiptHashPayloadV1 = {
      schema: CANDIDATE_SOURCE_RECEIPT_V1_SCHEMA,
      receiptVersion: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
      contractHash: CANDIDATE_SOURCE_RECEIPT_CONTRACT_HASH_V1,
      stage: "final_generated_source_verified_before_private_build" as const,
      readiness: {
        status: "verified_private_shadow" as const,
        productionUse: "forbidden" as const,
        blockerCodes: [...CANDIDATE_SOURCE_RECEIPT_V1_BLOCKER_CODES],
      },
      semanticRevision,
      materialization: {
        admissionScope: sourceMaterialization.admissionScope,
        pathDisclosure: "forbidden" as const,
        sourceMaterialization: {
          schema: sourceMaterialization.schema,
          receiptHash: sourceMaterialization.receiptHash,
          sourceMembershipHash:
            sourceMaterialization.sourceDirectory.membershipHash,
          sourceDirectoryPhysicalIdentityHash:
            sourceMaterialization.sourceDirectory.physicalIdentityHash,
          privateRootIdentityHash:
            sourceMaterialization.privateAttempt.rootIdentityHash,
        },
        scaffoldBase: {
          schema: base.schema,
          receiptHash: base.receiptHash,
          semanticInputHash: base.semanticInputHash,
        },
        dependency: {
          schema: sourceMaterialization.scaffold.dependencyReceiptSchema,
          receiptHash: sourceMaterialization.scaffold.dependencyReceiptHash,
          dependencyIdentityHash:
            sourceMaterialization.scaffold.dependencyIdentityHash,
        },
        publicationReceiptSetCommitmentHash:
          sourceMaterialization.publication.receiptSetCommitmentHash,
        sourceCount: 2 as const,
        sources: sourceMaterialization.sources.map((source) => ({
          sourceRole: source.sourceRole,
          sourceReceiptHash: source.sourceReceipt.receiptHash,
          sourceCasVerificationReceiptHash:
            source.sourceReceipt.casVerificationReceiptHash,
          publicationReceiptHash: source.publicationReceipt.receiptHash,
          publicationCasVerificationReceiptHash:
            source.publicationReceipt.casVerificationReceiptHash,
          deepVerificationReceiptHash:
            source.bundle.deepVerificationReceiptHash,
          consumerBindingHash: source.bundle.consumerBindingHash,
        })) as [
          {
            sourceRole: "runtime";
            sourceReceiptHash: string;
            sourceCasVerificationReceiptHash: string;
            publicationReceiptHash: string;
            publicationCasVerificationReceiptHash: string;
            deepVerificationReceiptHash: string;
            consumerBindingHash: string;
          },
          {
            sourceRole: "test";
            sourceReceiptHash: string;
            sourceCasVerificationReceiptHash: string;
            publicationReceiptHash: string;
            publicationCasVerificationReceiptHash: string;
            deepVerificationReceiptHash: string;
            consumerBindingHash: string;
          },
        ],
      },
    };
    const value = recursivelyFreezeCandidateSourceReceiptV1(
      CandidateSourceReceiptV1Schema.parse({
        ...receiptIdentity,
        receiptHash: hashCandidateSourceReceiptV1(receiptIdentity),
      }),
    );
    const envelope = recursivelyFreezeCandidateSourceReceiptV1(
      CandidateSourceEnvelopeV1Schema.parse({
        schema: "setfarm.semantic-artifact-envelope.v1",
        artifactType: CANDIDATE_SOURCE_ARTIFACT_TYPE_V1,
        producer: {
          pass: "candidate-source-authority-v1",
          codeSha: closure.envelope.producer.codeSha,
          toolVersions: {
            candidateSource: CANDIDATE_SOURCE_RECEIPT_VERSION_V1,
            implementationClosure: closureValue.closureVersion,
          },
        },
        payload: value,
      }),
    );
    if (
      packet.payload.packetHash !== value.semanticRevision.authority.packet.packetHash
      || packet.producer.codeSha !== closure.envelope.producer.codeSha
    ) {
      return rejected(
        "CANDIDATE_SOURCE_V1_CROSS_AUTHORITY_MISMATCH",
        "/closureVerificationInput",
        "Candidate source PacketV4 and closure producer identity differ",
      );
    }
    const bytes = canonicalJsonBytesBounded(envelope, {
      maxBytes: CANDIDATE_SOURCE_RECEIPT_V1_MAX_CANONICAL_BYTES,
      ...CANDIDATE_SOURCE_RECEIPT_V1_BOUNDED_WORK_LIMITS,
    });
    const publicationPreflight = publicationPreflightV1(envelope, bytes);
    const candidateSource = Object.freeze({
      value,
      envelope,
      envelopeHash: publicationPreflight.envelopeHash,
      canonicalBytes: bytes.toString("utf8"),
      publicationPreflight,
    });
    return Object.freeze({
      status: "shadow_verified_source" as const,
      diagnostics: EMPTY_DIAGNOSTICS,
      candidateSource,
      semanticRevisionHash: value.semanticRevision.revisionHash,
      operationalReceiptHash: value.receiptHash,
      buildDisposition:
        "authenticated_private_build_blocked_until_candidate_build_v2" as const,
    });
  } catch (error) {
    const message = errorMessage(error);
    const publicationFailure =
      error instanceof CandidateSourcePublicationPreflightErrorV1;
    return rejected(
      publicationFailure
        ? "CANDIDATE_SOURCE_V1_PUBLICATION_PREFLIGHT_REJECTED"
        : "CANDIDATE_SOURCE_V1_ARTIFACT_INVALID",
      publicationFailure ? "/publication" : "/",
      message,
    );
  }
}

export function compileCandidateSourceV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<CandidateSourceCompilationResultV1> {
  return compileInternalV1(handle, input, "production_host");
}

export function compileCandidateSourceV1ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<CandidateSourceCompilationResultV1> {
  return compileInternalV1(handle, input, "test_fixture");
}

type VerifiedCandidateSourceAuthorityStateV1 = Readonly<{
  handle: MaterializedNodeScaffoldPrivateStageV2;
  compilerInput: Readonly<{ closureVerificationInput: unknown }>;
  expectedScope: "production_host" | "test_fixture";
  envelope: Readonly<CandidateSourceEnvelopeV1>;
}>;

const candidateSourceAuthorityConstructorCapabilityV1 = Object.freeze({});
const verifiedCandidateSourceAuthorityStateV1 = new WeakMap<
  object,
  VerifiedCandidateSourceAuthorityStateV1
>();

export class VerifiedCandidateSourceAuthorityV1 {
  readonly receiptHash: string;
  readonly semanticRevisionHash: string;
  readonly implementationClosureHash: string;
  readonly admissionScope: "production_host" | "test_fixture";

  constructor(
    capability: object,
    state: VerifiedCandidateSourceAuthorityStateV1,
  ) {
    if (capability !== candidateSourceAuthorityConstructorCapabilityV1) {
      throw new Error("Candidate source authority constructor is unavailable");
    }
    this.receiptHash = state.envelope.payload.receiptHash;
    this.semanticRevisionHash =
      state.envelope.payload.semanticRevision.revisionHash;
    this.implementationClosureHash =
      state.envelope.payload.semanticRevision.authority
        .implementationClosure.closureHash;
    this.admissionScope = state.expectedScope;
    verifiedCandidateSourceAuthorityStateV1.set(this, state);
    Object.freeze(this);
  }
}

export type CandidateSourceVerificationResultV1 =
  | Readonly<{
      status: "verified_shadow";
      diagnostics: readonly [];
      candidateSource: Readonly<CandidateSourceReceiptV1>;
      envelope: Readonly<CandidateSourceEnvelopeV1>;
      envelopeHash: string;
      authority: VerifiedCandidateSourceAuthorityV1;
    }>
  | RejectedCandidateSourceV1;

async function verifyInternalV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
  expectedScope: "production_host" | "test_fixture",
): Promise<CandidateSourceVerificationResultV1> {
  let snapshot: unknown;
  try {
    snapshot = boundedSnapshot(
      input,
      VERIFIER_INPUT_MAX_CANONICAL_BYTES_V1,
      VERIFIER_BOUNDED_WORK_LIMITS_V1,
    );
  } catch (error) {
    return rejected("CANDIDATE_SOURCE_V1_INPUT_INVALID", "/", errorMessage(error));
  }
  const parsed = VerifierInputV1Schema.safeParse(snapshot);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return rejected(
      "CANDIDATE_SOURCE_V1_INPUT_INVALID",
      `/${issue?.path.map(String).join("/") ?? ""}`.replace(/\/$/u, "") || "/",
      issue?.message ?? "CandidateSourceV1 verifier input is invalid",
    );
  }
  const candidate = CandidateSourceEnvelopeV1Schema.safeParse(
    parsed.data.candidateSourceEnvelope,
  );
  if (!candidate.success) {
    return rejected(
      "CANDIDATE_SOURCE_V1_CANDIDATE_MISMATCH",
      "/candidateSourceEnvelope",
      candidate.error.issues[0]?.message ?? "Candidate source envelope is invalid",
    );
  }
  const compilerInput = recursivelyFreezeCandidateSourceReceiptV1({
    closureVerificationInput: parsed.data.closureVerificationInput,
  });
  const reproduced = await compileInternalV1(handle, compilerInput, expectedScope);
  if (reproduced.status !== "shadow_verified_source") return reproduced;
  if (
    reproduced.candidateSource.envelopeHash
      !== parsed.data.expectedCandidateSourceEnvelopeHash
  ) {
    return rejected(
      "CANDIDATE_SOURCE_V1_EXPECTED_HASH_MISMATCH",
      "/expectedCandidateSourceEnvelopeHash",
      "Expected CandidateSourceV1 envelope hash differs from fresh reproduction",
    );
  }
  if (
    hashCanonicalJson(candidate.data)
      !== parsed.data.expectedCandidateSourceEnvelopeHash
    || canonicalJsonStringify(candidate.data)
      !== canonicalJsonStringify(reproduced.candidateSource.envelope)
  ) {
    return rejected(
      "CANDIDATE_SOURCE_V1_CANDIDATE_MISMATCH",
      "/candidateSourceEnvelope",
      "CandidateSourceV1 envelope differs from fresh reproduction",
    );
  }
  const authority = new VerifiedCandidateSourceAuthorityV1(
    candidateSourceAuthorityConstructorCapabilityV1,
    Object.freeze({
      handle,
      compilerInput,
      expectedScope,
      envelope: reproduced.candidateSource.envelope,
    }),
  );
  return Object.freeze({
    status: "verified_shadow" as const,
    diagnostics: EMPTY_DIAGNOSTICS,
    candidateSource: reproduced.candidateSource.value,
    envelope: reproduced.candidateSource.envelope,
    envelopeHash: reproduced.candidateSource.envelopeHash,
    authority,
  });
}

export function verifyCandidateSourceV1(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<CandidateSourceVerificationResultV1> {
  return verifyInternalV1(handle, input, "production_host");
}

export function verifyCandidateSourceV1ForTest(
  handle: MaterializedNodeScaffoldPrivateStageV2,
  input: unknown,
): Promise<CandidateSourceVerificationResultV1> {
  return verifyInternalV1(handle, input, "test_fixture");
}

export async function revalidateVerifiedCandidateSourceAuthorityV1(
  authority: VerifiedCandidateSourceAuthorityV1,
): Promise<Readonly<{
  receiptHash: string;
  semanticRevisionHash: string;
  implementationClosureHash: string;
  envelopeHash: string;
}>> {
  if (
    typeof authority !== "object"
    || authority === null
    || isProxy(authority)
    || Object.getPrototypeOf(authority)
      !== VerifiedCandidateSourceAuthorityV1.prototype
  ) {
    throw new Error("Candidate source authority is unauthenticated");
  }
  const state = verifiedCandidateSourceAuthorityStateV1.get(authority);
  if (!state) throw new Error("Candidate source authority is unauthenticated");
  const reproduced = await compileInternalV1(
    state.handle,
    state.compilerInput,
    state.expectedScope,
  );
  if (
    reproduced.status !== "shadow_verified_source"
    || canonicalJsonStringify(reproduced.candidateSource.envelope)
      !== canonicalJsonStringify(state.envelope)
  ) {
    throw new Error("Candidate source authority no longer reproduces exactly");
  }
  return Object.freeze({
    receiptHash: reproduced.candidateSource.value.receiptHash,
    semanticRevisionHash:
      reproduced.candidateSource.value.semanticRevision.revisionHash,
    implementationClosureHash:
      reproduced.candidateSource.value.semanticRevision.authority
        .implementationClosure.closureHash,
    envelopeHash: reproduced.candidateSource.envelopeHash,
  });
}
