import type postgres from "postgres";

import { produceRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-producer-v1.js";
import { hashRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-v1.js";
import {
  resolveArtifactStorePublicationAuthorityMode,
  type ArtifactStorePublicationAuthorityMode,
} from "../runtime-config.js";
import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import {
  createHybridArtifactStoreCapacityLeaseProviderV1,
  type ArtifactStoreCapacityLeaseProvider,
} from "./artifact-store-authority.js";
import { ContentAddressedArtifactStore } from "./artifact-store.js";
import { createArtifactIndex } from "./artifact-index.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { validateDesignSourceClosureInputV1 } from "./design-source-closure-compiler.js";
import { produceStoryPlanV2 } from "./producers/story-plan-v2.js";
import { BuildTopologyV1Schema, type BuildTopologyV1 } from "./schemas/build-topology-v1.js";
import {
  ProductCompilationReportV1Schema,
  type ProductCompilationReportV1,
} from "./schemas/compilation-report-v1.js";
import {
  ProductCompilationReportV2Schema,
  type ProductCompilationReportV2,
} from "./schemas/compilation-report-v2.js";
import {
  ProductCompilationReportV3Schema,
  type ProductCompilationReportV3,
} from "./schemas/compilation-report-v3.js";
import type { SemanticArtifactProducerV1 } from "./schemas/common-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignInteractionGraphV1,
} from "./schemas/design-interaction-graph-v1.js";
import {
  ProductBuildPacketV1Schema,
  type ProductBuildPacketV1,
} from "./schemas/product-build-packet-v1.js";
import {
  ProductBuildPacketV2Schema,
  type ProductBuildPacketV2,
} from "./schemas/product-build-packet-v2.js";
import {
  ProductBuildPacketV3Schema,
  type ProductBuildPacketV3,
} from "./schemas/product-build-packet-v3.js";
import {
  ImplementationSourceMapV1Schema,
  type ImplementationSourceMapV1,
} from "./schemas/implementation-source-map-v1.js";
import {
  DesignSourceClosureV2Schema,
  type DesignSourceClosureV2,
} from "./schemas/design-source-closure-v2.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetsV2,
} from "./schemas/design-generation-targets-v2.js";
import {
  DesignInteractionGraphV2Schema,
  type DesignInteractionGraphV2,
} from "./schemas/design-interaction-graph-v2.js";
import {
  DesignSourceClosureV1Schema,
  type DesignSourceClosureV1,
} from "./schemas/design-source-closure-v1.js";
import {
  DesignGenerationTargetsV1Schema,
  type DesignGenerationTargetsV1,
} from "./schemas/design-generation-targets-v1.js";
import {
  StitchDirectResponseEvidenceV2Schema,
  type StitchDirectResponseEvidenceV2,
} from "./schemas/stitch-direct-response-evidence-v2.js";
import {
  StitchRenderedSemanticsV1Schema,
  type StitchRenderedSemanticsV1,
} from "./schemas/stitch-rendered-semantics-v1.js";
import {
  StitchRenderedSemanticsV2Schema,
  type StitchRenderedSemanticsV2,
} from "./schemas/stitch-rendered-semantics-v2.js";
import {
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
  type StitchTargetCandidateSelectionV1,
  type StitchTargetResponseBindingsV2,
} from "./schemas/stitch-target-candidate-selection-v1.js";
import {
  StitchTargetCandidateSelectionV2Schema,
  StitchTargetResponseBindingsV3Schema,
  type StitchTargetCandidateSelectionV2,
  type StitchTargetResponseBindingsV3,
} from "./schemas/stitch-target-candidate-selection-v2.js";
import { ProductSpecV1Schema, type ProductSpecV1 } from "./schemas/product-spec-v1.js";
import { ProductSpecV2Schema, type ProductSpecV2 } from "./schemas/product-spec-v2.js";
import { StoryPlanV1Schema, type StoryPlanV1 } from "./schemas/story-plan-v1.js";
import { StoryPlanV2Schema, type StoryPlanV2 } from "./schemas/story-plan-v2.js";
import { validateRuntimeDataContractClosureV1 } from "./producers/runtime-data-contract.js";

export type RuntimeArtifactReaderErrorCode =
  | "RUNTIME_ARTIFACT_REF_MISSING"
  | "RUNTIME_ARTIFACT_TYPE_MISMATCH"
  | "RUNTIME_ARTIFACT_INDEX_MISMATCH"
  | "RUNTIME_PACKET_RUN_NOT_FOUND"
  | "RUNTIME_PACKET_RUN_NOT_V3"
  | "RUNTIME_PACKET_NOT_ACTIVE"
  | "RUNTIME_PACKET_NOT_TERMINAL"
  | "RUNTIME_PACKET_NOT_SEALED"
  | "RUNTIME_PACKET_RELEASE_MISMATCH"
  | "RUNTIME_PACKET_CHILD_HASH_MISMATCH"
  | "RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH"
  | "RUNTIME_PACKET_RUNTIME_DATA_MISMATCH"
  | "RUNTIME_PACKET_RUNTIME_EVIDENCE_MISMATCH"
  | "RUNTIME_PACKET_REPORT_MISMATCH";

export class RuntimeArtifactReaderError extends Error {
  readonly code: RuntimeArtifactReaderErrorCode;

  constructor(code: RuntimeArtifactReaderErrorCode, message: string) {
    super(message);
    this.name = "RuntimeArtifactReaderError";
    this.code = code;
  }
}

export type SealedRuntimePacketV1 = Readonly<{
  runId: string;
  packetHash: string;
  producer: SemanticArtifactProducerV1;
  productSpec: ProductSpecV1;
  designGraph: DesignInteractionGraphV1;
  buildTopology: BuildTopologyV1;
  storyPlan: StoryPlanV1;
  packet: ProductBuildPacketV1;
  compilationReport: ProductCompilationReportV1 & { status: "sealed" };
  refs: Readonly<{
    productSpec: string;
    designGraph: string;
    buildTopology: string;
    storyPlan: string;
    packet: string;
    compilationReport: string;
  }>;
}>;

export type SealedRuntimePacketV2 = Readonly<{
  runId: string;
  packetHash: string;
  producer: SemanticArtifactProducerV1;
  productSpec: ProductSpecV1;
  designGraph: DesignInteractionGraphV1;
  buildTopology: BuildTopologyV1;
  storyPlan: StoryPlanV1;
  designSourceClosure: DesignSourceClosureV1;
  designSources?: Readonly<{
    generationTargets: DesignGenerationTargetsV1;
    directResponseEvidence: StitchDirectResponseEvidenceV2;
    renderedSemantics: StitchRenderedSemanticsV1;
    candidateSelection: StitchTargetCandidateSelectionV1;
    responseBindings: StitchTargetResponseBindingsV2;
  }>;
  packet: ProductBuildPacketV2;
  compilationReport: ProductCompilationReportV2 & { status: "sealed" };
  refs: Readonly<{
    productSpec: string;
    designGraph: string;
    buildTopology: string;
    storyPlan: string;
    designSourceClosure: string;
    packet: string;
    compilationReport: string;
  }>;
}>;

export type SealedRuntimePacket = SealedRuntimePacketV1 | SealedRuntimePacketV2;

export type SealedRuntimePacketV3 = Readonly<{
  runId: string;
  packetHash: string;
  producer: SemanticArtifactProducerV1;
  productSpec: ProductSpecV2;
  designGraph: DesignInteractionGraphV2 | null;
  buildTopology: BuildTopologyV1;
  storyPlan: StoryPlanV2;
  designSourceClosure: DesignSourceClosureV2;
  implementationSourceMap: ImplementationSourceMapV1;
  designSources?: Readonly<{
    generationTargets: DesignGenerationTargetsV2;
    directResponseEvidence: StitchDirectResponseEvidenceV2;
    renderedSemantics: StitchRenderedSemanticsV2;
    candidateSelection: StitchTargetCandidateSelectionV2;
    responseBindings: StitchTargetResponseBindingsV3;
  }>;
  packet: ProductBuildPacketV3;
  compilationReport: ProductCompilationReportV3 & { status: "sealed" };
  refs: Readonly<{
    productSpec: string;
    designGraph: string | null;
    buildTopology: string;
    storyPlan: string;
    designSourceClosure: string;
    implementationSourceMap: string;
    packet: string;
    compilationReport: string;
  }>;
}>;

/** Exact versioned read union. Historical consumers keep SealedRuntimePacket. */
export type ExactSealedRuntimePacket = SealedRuntimePacket | SealedRuntimePacketV3;

type CanonicalRefKey =
  | "PRODUCT_SPEC"
  | "DESIGN_GRAPH"
  | "BUILD_TOPOLOGY"
  | "STORY_PLAN"
  | "DESIGN_SOURCE_CLOSURE"
  | "IMPLEMENTATION_SOURCE_MAP"
  | "PRODUCT_BUILD_PACKET"
  | "COMPILATION_REPORT";

const ACTIVE_PACKET_STATUSES = new Set(["running", "resuming"]);
const TERMINAL_PACKET_STATUSES = new Set([
  "completed",
  "done",
  "failed",
  "cancelled",
  "canceled",
  "error",
  "blocked",
]);

function sameProducer(left: SemanticArtifactProducerV1, right: SemanticArtifactProducerV1): boolean {
  return canonicalJsonStringify(left) === canonicalJsonStringify(right);
}

export function createRuntimeArtifactReader(input: Readonly<{
  sql: postgres.Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  publicationAuthorityMode?: ArtifactStorePublicationAuthorityMode;
  capacityLeaseProvider?: ArtifactStoreCapacityLeaseProvider;
}>) {
  const publicationAuthority = input.publicationAuthorityMode
    ?? resolveArtifactStorePublicationAuthorityMode();
  if (input.capacityLeaseProvider && publicationAuthority !== "hybrid-required") {
    throw new TypeError(
      "Runtime artifact reader cannot combine an explicit hybrid provider with standalone mode",
    );
  }
  const capacityLeaseProvider = input.capacityLeaseProvider
    ?? (publicationAuthority === "hybrid-required"
      ? createHybridArtifactStoreCapacityLeaseProviderV1({
          sql: input.sql,
          artifactRoot: input.artifactRoot,
          purpose: "reader",
        })
      : undefined);
  const index = createArtifactIndex(input.sql);
  const store = new ContentAddressedArtifactStore(input.artifactRoot, {
    limits: input.artifactLimits,
    ...(capacityLeaseProvider
      ? { capacityLeaseProvider }
      : {}),
  });

  async function readStoredArtifact(artifactHash: string, label: string) {
    try {
      return await store.get(artifactHash);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_INDEX_MISMATCH",
        `${label} immutable filesystem artifact ${artifactHash} is unavailable or corrupt: ${detail}`,
      );
    }
  }

  async function readPacket(
    runId: string,
    allowedStatuses: ReadonlySet<string>,
    statusCode: Extract<RuntimeArtifactReaderErrorCode, "RUNTIME_PACKET_NOT_ACTIVE" | "RUNTIME_PACKET_NOT_TERMINAL">,
    statusLabel: string,
  ): Promise<SealedRuntimePacket> {
    const runs = await input.sql.unsafe<Array<{
      protocol: string;
      status: string;
      compiler_release_sha: string | null;
      packet_hash: string | null;
    }>>(
      `SELECT protocol, status, compiler_release_sha, packet_hash
         FROM runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    const run = runs[0];
    if (!run) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUN_NOT_FOUND",
        `Run ${runId} does not exist`,
      );
    }
    if (run.protocol !== "v3") {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUN_NOT_V3",
        `Run ${runId} is not a v3 packet owner`,
      );
    }
    if (!allowedStatuses.has(run.status.toLowerCase())) {
      throw new RuntimeArtifactReaderError(
        statusCode,
        `Run ${runId} is not ${statusLabel}`,
      );
    }
    if (!run.packet_hash) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_NOT_SEALED",
        `Run ${runId} has no activated Product Build Packet`,
      );
    }

    const packetRef = await readCanonicalRef(
      runId,
      "PRODUCT_BUILD_PACKET",
      ["setfarm.product-build-packet.v1", "setfarm.product-build-packet.v2"],
    );
    if (packetRef.reference.artifactHash !== run.packet_hash) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_NOT_SEALED",
        `Run ${runId} packet column and immutable packet reference differ`,
      );
    }
    const packetV2 = packetRef.envelope.artifactType === "setfarm.product-build-packet.v2";
    const [productSpecRef, designGraphRef, buildTopologyRef, storyPlanRef, reportRef, designSourceClosureRef] =
      await Promise.all([
        readCanonicalRef(runId, "PRODUCT_SPEC", "setfarm.product-spec.v1"),
        readCanonicalRef(runId, "DESIGN_GRAPH", "setfarm.design-interaction-graph.v1"),
        readCanonicalRef(runId, "BUILD_TOPOLOGY", "setfarm.build-topology.v1"),
        readCanonicalRef(runId, "STORY_PLAN", "setfarm.story-plan.v1"),
        readCanonicalRef(
          runId,
          "COMPILATION_REPORT",
          packetV2 ? "setfarm.product-compilation-report.v2" : "setfarm.product-compilation-report.v1",
        ),
        packetV2
          ? readCanonicalRef(runId, "DESIGN_SOURCE_CLOSURE", "setfarm.design-source-closure.v1")
          : Promise.resolve(undefined),
      ]);
    const producer = packetRef.envelope.producer;
    for (const value of [
      productSpecRef,
      designGraphRef,
      buildTopologyRef,
      storyPlanRef,
      reportRef,
      ...(designSourceClosureRef ? [designSourceClosureRef] : []),
    ]) {
      if (!sameProducer(producer, value.envelope.producer)) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
          `Run ${runId} canonical artifacts have different producer identities`,
        );
      }
    }

    const productSpec = ProductSpecV1Schema.parse(productSpecRef.envelope.payload);
    const designGraph = DesignInteractionGraphV1Schema.parse(designGraphRef.envelope.payload);
    const buildTopology = BuildTopologyV1Schema.parse(buildTopologyRef.envelope.payload);
    const storyPlan = StoryPlanV1Schema.parse(storyPlanRef.envelope.payload);
    const packet = packetV2
      ? ProductBuildPacketV2Schema.parse(packetRef.envelope.payload)
      : ProductBuildPacketV1Schema.parse(packetRef.envelope.payload);
    const compilationReport = packetV2
      ? ProductCompilationReportV2Schema.parse(reportRef.envelope.payload)
      : ProductCompilationReportV1Schema.parse(reportRef.envelope.payload);
    if (
      !productSpec.delivery
      || !buildTopology.runtimeDataContract
      || !buildTopology.runtimeDataContractHash
      || packet.runtimeDataContractHash !== buildTopology.runtimeDataContractHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUNTIME_DATA_MISMATCH",
        `Run ${runId} v3 packet lacks one exact ProductSpec/topology/packet runtime-data binding`,
      );
    }
    const runtimeDataDiagnostics = validateRuntimeDataContractClosureV1({
      productSpec,
      commands: buildTopology.commands,
      contract: buildTopology.runtimeDataContract,
      contractHash: buildTopology.runtimeDataContractHash,
    });
    if (runtimeDataDiagnostics.length > 0) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUNTIME_DATA_MISMATCH",
        `Run ${runId} runtime-data contract is not the exact ProductSpec/topology projection: ${runtimeDataDiagnostics[0]!.code}`,
      );
    }
    if (
      !buildTopology.runtimeEvidenceContract
      || !buildTopology.runtimeEvidenceContractHash
      || packet.runtimeEvidenceContractHash !== buildTopology.runtimeEvidenceContractHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUNTIME_EVIDENCE_MISMATCH",
        `Run ${runId} v3 packet lacks one exact topology/packet runtime-evidence binding`,
      );
    }
    const runtimeEvidence = produceRuntimeEvidenceContractV1({ productSpec, buildTopology });
    if (
      runtimeEvidence.status !== "produced"
      || hashRuntimeEvidenceContractV1(runtimeEvidence.contract) !== buildTopology.runtimeEvidenceContractHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUNTIME_EVIDENCE_MISMATCH",
        `Run ${runId} runtime-evidence contract is not the exact ProductSpec/topology projection`,
      );
    }
    if (packet.compiler.codeSha !== run.compiler_release_sha) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RELEASE_MISMATCH",
        `Run ${runId} compiler release differs from its sealed packet`,
      );
    }
    const childHashes = {
      productSpecHash: productSpecRef.reference.artifactHash,
      designGraphHash: designGraphRef.reference.artifactHash,
      buildTopologyHash: buildTopologyRef.reference.artifactHash,
      storyPlanHash: storyPlanRef.reference.artifactHash,
    };
    for (const [field, hash] of Object.entries(childHashes)) {
      if (packet[field as keyof typeof childHashes] !== hash) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
          `Run ${runId} packet ${field} differs from its immutable reference`,
        );
      }
    }
    const reportCoreMatches = compilationReport.status === "sealed"
      && compilationReport.packetHash === run.packet_hash
      && compilationReport.compiler.codeSha === run.compiler_release_sha
      && compilationReport.artifactHashes.productSpec === childHashes.productSpecHash
      && compilationReport.artifactHashes.designGraph === childHashes.designGraphHash
      && compilationReport.artifactHashes.buildTopology === childHashes.buildTopologyHash
      && compilationReport.artifactHashes.storyPlan === childHashes.storyPlanHash;
    if (!reportCoreMatches) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_REPORT_MISMATCH",
        `Run ${runId} compilation report does not attest the activated packet`,
      );
    }

    if (packetV2) {
      const packetV2Value = ProductBuildPacketV2Schema.parse(packet);
      const reportV2 = ProductCompilationReportV2Schema.parse(compilationReport);
      if (reportV2.status !== "sealed" || !designSourceClosureRef) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_REPORT_MISMATCH",
          `Run ${runId} Product Build Packet v2 lacks a sealed closure report`,
        );
      }
      const closureHash = designSourceClosureRef.reference.artifactHash;
      if (
        packetV2Value.designSourceClosureHash !== closureHash
        || reportV2.artifactHashes.designSourceClosure !== closureHash
      ) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
          `Run ${runId} packet/report do not attest the exact design-source closure envelope`,
        );
      }
      const designSourceClosure = DesignSourceClosureV1Schema.parse(designSourceClosureRef.envelope.payload);
      let designSources: SealedRuntimePacketV2["designSources"];
      if (designSourceClosure.kind === "stitch") {
        const [generationTargetsEnvelope, directEvidenceEnvelope, renderedSemanticsEnvelope, selectionEnvelope, bindingsEnvelope] =
          await Promise.all([
            readClosureChild(designSourceClosure.generationTargets, producer, "generationTargets"),
            readClosureChild(designSourceClosure.directResponseEvidence, producer, "directResponseEvidence"),
            readClosureChild(designSourceClosure.renderedSemantics, producer, "renderedSemantics"),
            readClosureChild(designSourceClosure.candidateSelection, producer, "candidateSelection"),
            readClosureChild(designSourceClosure.responseBindings, producer, "responseBindings"),
          ]);
        const generationTargets = DesignGenerationTargetsV1Schema.parse(generationTargetsEnvelope.payload);
        const directResponseEvidence = StitchDirectResponseEvidenceV2Schema.parse(directEvidenceEnvelope.payload);
        const renderedSemantics = StitchRenderedSemanticsV1Schema.parse(renderedSemanticsEnvelope.payload);
        const candidateSelection = StitchTargetCandidateSelectionV1Schema.parse(selectionEnvelope.payload);
        const responseBindings = StitchTargetResponseBindingsV2Schema.parse(bindingsEnvelope.payload);
        const validated = validateDesignSourceClosureInputV1({
          productSpec,
          designGraph,
          designSource: {
            kind: "stitch",
            generationTargets,
            directResponseEvidence,
            renderedSemantics,
            candidateSelection,
            responseBindings,
          },
        });
        if (validated.status !== "validated") {
          throw new RuntimeArtifactReaderError(
            "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
            `Run ${runId} nested design-source closure is invalid: ${validated.issues[0]?.code ?? "unknown"}`,
          );
        }
        designSources = {
          generationTargets,
          directResponseEvidence,
          renderedSemantics,
          candidateSelection,
          responseBindings,
        };
      } else {
        const validated = validateDesignSourceClosureInputV1({
          productSpec,
          designGraph,
          designSource: { kind: "none" },
        });
        if (validated.status !== "validated") {
          throw new RuntimeArtifactReaderError(
            "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
            `Run ${runId} empty design-source closure conflicts with ProductSpec delivery`,
          );
        }
      }
      return {
        runId,
        packetHash: run.packet_hash,
        producer,
        productSpec,
        designGraph,
        buildTopology,
        storyPlan,
        designSourceClosure,
        ...(designSources ? { designSources } : {}),
        packet: packetV2Value,
        compilationReport: reportV2,
        refs: {
          productSpec: childHashes.productSpecHash,
          designGraph: childHashes.designGraphHash,
          buildTopology: childHashes.buildTopologyHash,
          storyPlan: childHashes.storyPlanHash,
          designSourceClosure: closureHash,
          packet: packetRef.reference.artifactHash,
          compilationReport: reportRef.reference.artifactHash,
        },
      };
    }

    const packetV1 = ProductBuildPacketV1Schema.parse(packet);
    const reportV1 = ProductCompilationReportV1Schema.parse(compilationReport);
    if (reportV1.status !== "sealed") {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_REPORT_MISMATCH",
        `Run ${runId} Product Build Packet v1 report is not sealed`,
      );
    }
    return {
      runId,
      packetHash: run.packet_hash,
      producer,
      productSpec,
      designGraph,
      buildTopology,
      storyPlan,
      packet: packetV1,
      compilationReport: reportV1,
      refs: {
        productSpec: childHashes.productSpecHash,
        designGraph: childHashes.designGraphHash,
        buildTopology: childHashes.buildTopologyHash,
        storyPlan: childHashes.storyPlanHash,
        packet: packetRef.reference.artifactHash,
        compilationReport: reportRef.reference.artifactHash,
      },
    };
  }

  async function readPacketV3(
    runId: string,
    allowedStatuses: ReadonlySet<string>,
    statusCode: Extract<RuntimeArtifactReaderErrorCode, "RUNTIME_PACKET_NOT_ACTIVE" | "RUNTIME_PACKET_NOT_TERMINAL">,
    statusLabel: string,
  ): Promise<SealedRuntimePacketV3> {
    const runs = await input.sql.unsafe<Array<{
      protocol: string;
      status: string;
      compiler_release_sha: string | null;
      packet_hash: string | null;
    }>>(
      `SELECT protocol, status, compiler_release_sha, packet_hash
         FROM runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    const run = runs[0];
    if (!run) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUN_NOT_FOUND",
        `Run ${runId} does not exist`,
      );
    }
    if (run.protocol !== "v3") {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUN_NOT_V3",
        `Run ${runId} is not a v3 packet owner`,
      );
    }
    if (!allowedStatuses.has(run.status.toLowerCase())) {
      throw new RuntimeArtifactReaderError(statusCode, `Run ${runId} is not ${statusLabel}`);
    }
    if (!run.packet_hash) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_NOT_SEALED",
        `Run ${runId} has no activated Product Build Packet`,
      );
    }

    const packetRef = await readCanonicalRef(
      runId,
      "PRODUCT_BUILD_PACKET",
      "setfarm.product-build-packet.v3",
    );
    if (packetRef.reference.artifactHash !== run.packet_hash) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_NOT_SEALED",
        `Run ${runId} packet column and immutable packet reference differ`,
      );
    }
    const packet = ProductBuildPacketV3Schema.parse(packetRef.envelope.payload);
    const [
      productSpecRef,
      buildTopologyRef,
      storyPlanRef,
      closureRef,
      implementationSourceMapRef,
      reportRef,
      designGraphRef,
    ] =
      await Promise.all([
        readCanonicalRef(runId, "PRODUCT_SPEC", "setfarm.product-spec.v2"),
        readCanonicalRef(runId, "BUILD_TOPOLOGY", "setfarm.build-topology.v1"),
        readCanonicalRef(runId, "STORY_PLAN", "setfarm.story-plan.v2"),
        readCanonicalRef(runId, "DESIGN_SOURCE_CLOSURE", "setfarm.design-source-closure.v2"),
        readCanonicalRef(
          runId,
          "IMPLEMENTATION_SOURCE_MAP",
          "setfarm.implementation-source-map.v1",
        ),
        readCanonicalRef(runId, "COMPILATION_REPORT", "setfarm.product-compilation-report.v3"),
        packet.designSourceKind === "stitch"
          ? readCanonicalRef(runId, "DESIGN_GRAPH", "setfarm.design-interaction-graph.v2")
          : Promise.resolve(undefined),
      ]);
    const producer = packetRef.envelope.producer;
    for (const value of [
      productSpecRef,
      buildTopologyRef,
      storyPlanRef,
      closureRef,
      implementationSourceMapRef,
      reportRef,
      ...(designGraphRef ? [designGraphRef] : []),
    ]) {
      if (!sameProducer(producer, value.envelope.producer)) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
          `Run ${runId} canonical v3 artifacts have different producer identities`,
        );
      }
    }

    const productSpec = ProductSpecV2Schema.parse(productSpecRef.envelope.payload);
    const designGraph = designGraphRef
      ? DesignInteractionGraphV2Schema.parse(designGraphRef.envelope.payload)
      : null;
    const buildTopology = BuildTopologyV1Schema.parse(buildTopologyRef.envelope.payload);
    const storyPlan = StoryPlanV2Schema.parse(storyPlanRef.envelope.payload);
    const designSourceClosure = DesignSourceClosureV2Schema.parse(closureRef.envelope.payload);
    const implementationSourceMap = ImplementationSourceMapV1Schema.parse(
      implementationSourceMapRef.envelope.payload,
    );
    const compilationReport = ProductCompilationReportV3Schema.parse(reportRef.envelope.payload);
    if (compilationReport.status !== "sealed") {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_REPORT_MISMATCH",
        `Run ${runId} Product Build Packet v3 report is not sealed`,
      );
    }
    if (
      packet.compiler.codeSha !== run.compiler_release_sha
      || producer.codeSha !== run.compiler_release_sha
      || compilationReport.compiler.codeSha !== run.compiler_release_sha
      || canonicalJsonStringify(compilationReport.compiler)
        !== canonicalJsonStringify(packet.compiler)
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RELEASE_MISMATCH",
        `Run ${runId}, packet, report, and CAS producer are not pinned to one compiler release`,
      );
    }

    const childHashes = {
      productSpecV2Hash: productSpecRef.reference.artifactHash,
      designGraphV2Hash: designGraphRef?.reference.artifactHash ?? null,
      buildTopologyV1Hash: buildTopologyRef.reference.artifactHash,
      storyPlanV2Hash: storyPlanRef.reference.artifactHash,
      designSourceClosureV2Hash: closureRef.reference.artifactHash,
      implementationSourceMapV1Hash: implementationSourceMapRef.reference.artifactHash,
    };
    for (const [field, hash] of Object.entries(childHashes)) {
      if (packet[field as keyof typeof childHashes] !== hash) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
          `Run ${runId} packet ${field} differs from its immutable CAS envelope reference`,
        );
      }
    }
    if (
      compilationReport.packetHash !== run.packet_hash
      || compilationReport.artifactHashes.productSpecV2 !== childHashes.productSpecV2Hash
      || compilationReport.artifactHashes.designGraphV2 !== childHashes.designGraphV2Hash
      || compilationReport.artifactHashes.buildTopologyV1 !== childHashes.buildTopologyV1Hash
      || compilationReport.artifactHashes.storyPlanV2 !== childHashes.storyPlanV2Hash
      || compilationReport.artifactHashes.designSourceClosureV2
        !== childHashes.designSourceClosureV2Hash
      || compilationReport.artifactHashes.implementationSourceMapV1
        !== childHashes.implementationSourceMapV1Hash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_REPORT_MISMATCH",
        `Run ${runId} compilation report does not attest the activated v3 packet and exact child envelopes`,
      );
    }

    const productSpecPayloadHash = hashCanonicalJson(productSpec);
    const designGraphPayloadHash = designGraph ? hashCanonicalJson(designGraph) : null;
    const buildTopologyPayloadHash = hashCanonicalJson(buildTopology);
    const storyPlanPayloadHash = hashCanonicalJson(storyPlan);
    const designSourceClosurePayloadHash = hashCanonicalJson(designSourceClosure);
    const exactDesignKind = productSpec.delivery.designRequired ? "stitch" : "none";
    if (
      packet.designSourceKind !== exactDesignKind
      || storyPlan.designSourceKind !== exactDesignKind
      || designSourceClosure.kind !== exactDesignKind
      || (designGraph !== null) !== (exactDesignKind === "stitch")
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
        `Run ${runId} ProductSpec delivery, packet, graph, StoryPlan, and closure design kinds disagree`,
      );
    }
    if (
      implementationSourceMap.designSourceKind !== exactDesignKind
      || implementationSourceMap.productSpecV2PayloadHash !== productSpecPayloadHash
      || implementationSourceMap.designGraphV2PayloadHash !== designGraphPayloadHash
      || implementationSourceMap.buildTopologyV1PayloadHash !== buildTopologyPayloadHash
      || implementationSourceMap.storyPlanV2PayloadHash !== storyPlanPayloadHash
      || implementationSourceMap.designSourceClosureV2PayloadHash
        !== designSourceClosurePayloadHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH",
        `Run ${runId} ImplementationSourceMapV1 does not bind the exact packet authority payloads`,
      );
    }
    if (
      storyPlan.productSpecHash !== productSpecPayloadHash
      || storyPlan.designGraphHash !== designGraphPayloadHash
      || storyPlan.buildTopologyHash !== buildTopologyPayloadHash
      || (designGraph && designGraph.productSpecHash !== productSpecPayloadHash)
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
        `Run ${runId} v3 payload authorities do not form one exact semantic hash chain`,
      );
    }
    const reproducedStories = produceStoryPlanV2({
      productSpec,
      designGraph,
      buildTopology,
    });
    if (
      reproducedStories.status !== "produced"
      || canonicalJsonStringify(reproducedStories.storyPlan) !== canonicalJsonStringify(storyPlan)
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
        `Run ${runId} StoryPlanV2 is not the deterministic projection of its packet authorities`,
      );
    }
    if (
      buildTopology.runtimeDataContractHash !== packet.runtimeDataContractHash
      || buildTopology.runtimeEvidenceContractHash !== packet.runtimeEvidenceContractHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_RUNTIME_DATA_MISMATCH",
        `Run ${runId} topology and ProductBuildPacketV3 runtime contract hashes differ`,
      );
    }

    let designSources: SealedRuntimePacketV3["designSources"];
    if (designSourceClosure.kind === "stitch") {
      if (
        !designGraphRef
        || designSourceClosure.designGraph.envelopeHash !== designGraphRef.reference.artifactHash
        || designSourceClosure.designGraph.payloadHash !== designGraphPayloadHash
      ) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_CHILD_HASH_MISMATCH",
          `Run ${runId} DesignSourceClosureV2 does not bind the canonical graph envelope and payload`,
        );
      }
      const [generationTargetsEnvelope, directEvidenceEnvelope, renderedEnvelope, selectionEnvelope, bindingsEnvelope] =
        await Promise.all([
          readClosureChildV3(designSourceClosure.generationTargets, "generationTargets"),
          readClosureChildV3(designSourceClosure.directResponseEvidence, "directResponseEvidence"),
          readClosureChildV3(designSourceClosure.renderedSemantics, "renderedSemantics"),
          readClosureChildV3(designSourceClosure.candidateSelection, "candidateSelection"),
          readClosureChildV3(designSourceClosure.responseBindings, "responseBindings"),
        ]);
      designSources = {
        generationTargets: DesignGenerationTargetsV2Schema.parse(generationTargetsEnvelope.payload),
        directResponseEvidence: StitchDirectResponseEvidenceV2Schema.parse(directEvidenceEnvelope.payload),
        renderedSemantics: StitchRenderedSemanticsV2Schema.parse(renderedEnvelope.payload),
        candidateSelection: StitchTargetCandidateSelectionV2Schema.parse(selectionEnvelope.payload),
        responseBindings: StitchTargetResponseBindingsV3Schema.parse(bindingsEnvelope.payload),
      };
      if (implementationSourceMap.designSourceKind !== "stitch") {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH",
          `Run ${runId} Stitch closure has a no-design ImplementationSourceMapV1`,
        );
      }
      const targetByRef = new Map(designSources.generationTargets.targets.map((target) =>
        [target.targetId, target] as const));
      const responseByTarget = new Map(designSources.responseBindings.bindings.map((binding) =>
        [binding.targetRef, binding] as const));
      let exactScreenAuthorities =
        implementationSourceMap.screens.length === targetByRef.size
        && implementationSourceMap.screens.length === responseByTarget.size;
      for (const screen of implementationSourceMap.screens) {
        const target = targetByRef.get(screen.targetRef);
        const response = responseByTarget.get(screen.targetRef);
        if (
          !target
          || !response
          || screen.responseScreenId !== response.responseScreenId
          || screen.targetHash !== hashCanonicalJson(target)
          || screen.targetHash !== response.targetHash
          || screen.responseBindingHash !== hashCanonicalJson(response)
        ) {
          exactScreenAuthorities = false;
        }
      }
      if (!exactScreenAuthorities) {
        throw new RuntimeArtifactReaderError(
          "RUNTIME_PACKET_IMPLEMENTATION_SOURCE_MAP_MISMATCH",
          `Run ${runId} source-map screens do not bind every and only exact generation target and selected response`,
        );
      }
    }

    return {
      runId,
      packetHash: run.packet_hash,
      producer,
      productSpec,
      designGraph,
      buildTopology,
      storyPlan,
      designSourceClosure,
      implementationSourceMap,
      ...(designSources ? { designSources } : {}),
      packet,
      compilationReport,
      refs: {
        productSpec: childHashes.productSpecV2Hash,
        designGraph: childHashes.designGraphV2Hash,
        buildTopology: childHashes.buildTopologyV1Hash,
        storyPlan: childHashes.storyPlanV2Hash,
        designSourceClosure: childHashes.designSourceClosureV2Hash,
        implementationSourceMap: childHashes.implementationSourceMapV1Hash,
        packet: packetRef.reference.artifactHash,
        compilationReport: reportRef.reference.artifactHash,
      },
    };
  }

  async function readExactPacket(
    runId: string,
    allowedStatuses: ReadonlySet<string>,
    statusCode: Extract<RuntimeArtifactReaderErrorCode, "RUNTIME_PACKET_NOT_ACTIVE" | "RUNTIME_PACKET_NOT_TERMINAL">,
    statusLabel: string,
  ): Promise<ExactSealedRuntimePacket> {
    const packetRef = await index.getRunArtifactRef(runId, "PRODUCT_BUILD_PACKET");
    return packetRef?.artifactType === "setfarm.product-build-packet.v3"
      ? readPacketV3(runId, allowedStatuses, statusCode, statusLabel)
      : readPacket(runId, allowedStatuses, statusCode, statusLabel);
  }

  async function readCanonicalRef(
    runId: string,
    refKey: CanonicalRefKey,
    expectedType: string | readonly string[],
  ) {
    const reference = await index.getRunArtifactRef(runId, refKey);
    if (!reference) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_REF_MISSING",
        `Run ${runId} has no sealed ${refKey} reference`,
      );
    }
    const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
    if (!expectedTypes.includes(reference.artifactType)) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_TYPE_MISMATCH",
        `Run ${runId}/${refKey} resolves to ${reference.artifactType}, expected ${expectedTypes.join(" or ")}`,
      );
    }
    const indexed = await index.getArtifact(reference.artifactHash);
    const stored = await readStoredArtifact(reference.artifactHash, `Run ${runId}/${refKey}`);
    if (
      !indexed
      || indexed.artifactType !== stored.envelope.artifactType
      || indexed.byteLength !== stored.bytes.byteLength
      || !sameProducer(indexed.producer, stored.envelope.producer)
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_INDEX_MISMATCH",
        `Run ${runId}/${refKey} filesystem envelope differs from the immutable index`,
      );
    }
    return { reference, envelope: stored.envelope };
  }

  async function readClosureChild(
    reference: Readonly<{ artifactType: string; envelopeHash: string; payloadHash: string }>,
    producer: SemanticArtifactProducerV1,
    label: string,
  ) {
    const indexed = await index.getArtifact(reference.envelopeHash);
    const stored = await readStoredArtifact(
      reference.envelopeHash,
      `Nested design-source ${label}`,
    );
    if (
      !indexed
      || indexed.artifactType !== reference.artifactType
      || stored.envelope.artifactType !== reference.artifactType
      || indexed.byteLength !== stored.bytes.byteLength
      || !sameProducer(indexed.producer, stored.envelope.producer)
      || !sameProducer(producer, stored.envelope.producer)
      || hashCanonicalJson(stored.envelope.payload) !== reference.payloadHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_INDEX_MISMATCH",
        `Nested design-source ${label} differs from its typed closure and immutable index`,
      );
    }
    return stored.envelope;
  }

  async function readClosureChildV3(
    reference: Readonly<{ artifactType: string; envelopeHash: string; payloadHash: string }>,
    label: string,
  ) {
    const indexed = await index.getArtifact(reference.envelopeHash);
    const stored = await readStoredArtifact(
      reference.envelopeHash,
      `Nested design-source v2 ${label}`,
    );
    if (
      !indexed
      || indexed.artifactType !== reference.artifactType
      || stored.envelope.artifactType !== reference.artifactType
      || indexed.byteLength !== stored.bytes.byteLength
      || !sameProducer(indexed.producer, stored.envelope.producer)
      || hashCanonicalJson(stored.envelope.payload) !== reference.payloadHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_INDEX_MISMATCH",
        `Nested design-source v2 ${label} differs from its typed closure and immutable CAS index`,
      );
    }
    return stored.envelope;
  }

  return Object.freeze({
    index,
    store,
    publicationAuthority,

    async readSealedPacket(runId: string): Promise<SealedRuntimePacket> {
      return readPacket(runId, ACTIVE_PACKET_STATUSES, "RUNTIME_PACKET_NOT_ACTIVE", "active");
    },

    async auditTerminalPacket(runId: string): Promise<SealedRuntimePacket> {
      return readPacket(runId, TERMINAL_PACKET_STATUSES, "RUNTIME_PACKET_NOT_TERMINAL", "terminal");
    },

    async readExactSealedPacket(runId: string): Promise<ExactSealedRuntimePacket> {
      return readExactPacket(runId, ACTIVE_PACKET_STATUSES, "RUNTIME_PACKET_NOT_ACTIVE", "active");
    },

    async auditExactTerminalPacket(runId: string): Promise<ExactSealedRuntimePacket> {
      return readExactPacket(runId, TERMINAL_PACKET_STATUSES, "RUNTIME_PACKET_NOT_TERMINAL", "terminal");
    },
  });
}
