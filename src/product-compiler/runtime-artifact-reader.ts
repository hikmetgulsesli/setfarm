import type postgres from "postgres";

import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import { ContentAddressedArtifactStore } from "./artifact-store.js";
import { createArtifactIndex } from "./artifact-index.js";
import { canonicalJsonStringify } from "./canonical-json.js";
import { BuildTopologyV1Schema, type BuildTopologyV1 } from "./schemas/build-topology-v1.js";
import {
  ProductCompilationReportV1Schema,
  type ProductCompilationReportV1,
} from "./schemas/compilation-report-v1.js";
import type { SemanticArtifactProducerV1 } from "./schemas/common-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignInteractionGraphV1,
} from "./schemas/design-interaction-graph-v1.js";
import {
  ProductBuildPacketV1Schema,
  type ProductBuildPacketV1,
} from "./schemas/product-build-packet-v1.js";
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

type CanonicalRefKey =
  | "PRODUCT_SPEC"
  | "DESIGN_GRAPH"
  | "BUILD_TOPOLOGY"
  | "STORY_PLAN"
  | "PRODUCT_BUILD_PACKET"
  | "COMPILATION_REPORT";

const REF_TYPES: Readonly<Record<CanonicalRefKey, string>> = Object.freeze({
  PRODUCT_SPEC: "setfarm.product-spec.v1",
  DESIGN_GRAPH: "setfarm.design-interaction-graph.v1",
  BUILD_TOPOLOGY: "setfarm.build-topology.v1",
  STORY_PLAN: "setfarm.story-plan.v1",
  PRODUCT_BUILD_PACKET: "setfarm.product-build-packet.v1",
  COMPILATION_REPORT: "setfarm.product-compilation-report.v1",
});

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

  async function readPacket(
    runId: string,
    allowedStatuses: ReadonlySet<string>,
    statusCode: Extract<RuntimeArtifactReaderErrorCode, "RUNTIME_PACKET_NOT_ACTIVE" | "RUNTIME_PACKET_NOT_TERMINAL">,
    statusLabel: string,
  ): Promise<SealedRuntimePacketV1> {
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

    const [productSpecRef, designGraphRef, buildTopologyRef, storyPlanRef, packetRef, reportRef] =
      await Promise.all([
        readCanonicalRef(runId, "PRODUCT_SPEC"),
        readCanonicalRef(runId, "DESIGN_GRAPH"),
        readCanonicalRef(runId, "BUILD_TOPOLOGY"),
        readCanonicalRef(runId, "STORY_PLAN"),
        readCanonicalRef(runId, "PRODUCT_BUILD_PACKET"),
        readCanonicalRef(runId, "COMPILATION_REPORT"),
      ]);
    if (packetRef.reference.artifactHash !== run.packet_hash) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_NOT_SEALED",
        `Run ${runId} packet column and immutable packet reference differ`,
      );
    }
    const producer = packetRef.envelope.producer;
    for (const value of [
      productSpecRef,
      designGraphRef,
      buildTopologyRef,
      storyPlanRef,
      reportRef,
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
    const packet = ProductBuildPacketV1Schema.parse(packetRef.envelope.payload);
    const compilationReport = ProductCompilationReportV1Schema.parse(reportRef.envelope.payload);
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
    if (
      compilationReport.status !== "sealed"
      || compilationReport.packetHash !== run.packet_hash
      || compilationReport.compiler.codeSha !== run.compiler_release_sha
      || compilationReport.artifactHashes.productSpec !== childHashes.productSpecHash
      || compilationReport.artifactHashes.designGraph !== childHashes.designGraphHash
      || compilationReport.artifactHashes.buildTopology !== childHashes.buildTopologyHash
      || compilationReport.artifactHashes.storyPlan !== childHashes.storyPlanHash
    ) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_PACKET_REPORT_MISMATCH",
        `Run ${runId} compilation report does not attest the activated packet`,
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
      packet,
      compilationReport,
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

  async function readCanonicalRef(runId: string, refKey: CanonicalRefKey) {
    const reference = await index.getRunArtifactRef(runId, refKey);
    if (!reference) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_REF_MISSING",
        `Run ${runId} has no sealed ${refKey} reference`,
      );
    }
    const expectedType = REF_TYPES[refKey];
    if (reference.artifactType !== expectedType) {
      throw new RuntimeArtifactReaderError(
        "RUNTIME_ARTIFACT_TYPE_MISMATCH",
        `Run ${runId}/${refKey} resolves to ${reference.artifactType}, expected ${expectedType}`,
      );
    }
    const indexed = await index.getArtifact(reference.artifactHash);
    const stored = await store.get(reference.artifactHash);
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

  return Object.freeze({
    index,
    store,

    async readSealedPacket(runId: string): Promise<SealedRuntimePacketV1> {
      return readPacket(runId, ACTIVE_PACKET_STATUSES, "RUNTIME_PACKET_NOT_ACTIVE", "active");
    },

    async auditTerminalPacket(runId: string): Promise<SealedRuntimePacketV1> {
      return readPacket(runId, TERMINAL_PACKET_STATUSES, "RUNTIME_PACKET_NOT_TERMINAL", "terminal");
    },
  });
}
