import type postgres from "postgres";

import { produceRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-producer-v1.js";
import { hashRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-v1.js";
import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import { ContentAddressedArtifactStore } from "./artifact-store.js";
import { createArtifactIndex } from "./artifact-index.js";
import { canonicalJsonStringify, hashCanonicalJson } from "./canonical-json.js";
import { validateDesignSourceClosureInputV1 } from "./design-source-closure-compiler.js";
import { BuildTopologyV1Schema, type BuildTopologyV1 } from "./schemas/build-topology-v1.js";
import {
  ProductCompilationReportV1Schema,
  type ProductCompilationReportV1,
} from "./schemas/compilation-report-v1.js";
import {
  ProductCompilationReportV2Schema,
  type ProductCompilationReportV2,
} from "./schemas/compilation-report-v2.js";
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
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
  type StitchTargetCandidateSelectionV1,
  type StitchTargetResponseBindingsV2,
} from "./schemas/stitch-target-candidate-selection-v1.js";
import { ProductSpecV1Schema, type ProductSpecV1 } from "./schemas/product-spec-v1.js";
import { StoryPlanV1Schema, type StoryPlanV1 } from "./schemas/story-plan-v1.js";
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

type CanonicalRefKey =
  | "PRODUCT_SPEC"
  | "DESIGN_GRAPH"
  | "BUILD_TOPOLOGY"
  | "STORY_PLAN"
  | "DESIGN_SOURCE_CLOSURE"
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
}>) {
  const index = createArtifactIndex(input.sql);
  const store = new ContentAddressedArtifactStore(input.artifactRoot, {
    limits: input.artifactLimits,
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

  return Object.freeze({
    index,
    store,

    async readSealedPacket(runId: string): Promise<SealedRuntimePacket> {
      return readPacket(runId, ACTIVE_PACKET_STATUSES, "RUNTIME_PACKET_NOT_ACTIVE", "active");
    },

    async auditTerminalPacket(runId: string): Promise<SealedRuntimePacket> {
      return readPacket(runId, TERMINAL_PACKET_STATUSES, "RUNTIME_PACKET_NOT_TERMINAL", "terminal");
    },
  });
}
