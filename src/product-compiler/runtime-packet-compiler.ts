import type postgres from "postgres";
import { z } from "zod";

import type { ArtifactCapacityLimits } from "./artifact-capacity.js";
import { ContentAddressedArtifactStore } from "./artifact-store.js";
import { createArtifactIndex } from "./artifact-index.js";
import { IndexedArtifactPublisher } from "./indexed-artifact-publisher.js";
import type { DesignSourceInputV1 } from "./design-source-closure-compiler.js";
import {
  compileProductBuildPacket,
  compileProductBuildPacketV3,
  type ProductPacketCompilationResult,
  type ProductPacketCompilationResultV3,
} from "./packet-compiler.js";
import {
  CompilerIdentityV1Schema,
  SemanticArtifactProducerV1Schema,
} from "./schemas/common-v1.js";

export type RuntimePacketCompilerErrorCode =
  | "RUNTIME_PACKET_DESIGN_SOURCE_REQUIRED"
  | "RUNTIME_PACKET_RUN_NOT_ACTIVE"
  | "RUNTIME_PACKET_RUN_NOT_COMPILER"
  | "RUNTIME_PACKET_RUN_NOT_FOUND"
  | "RUNTIME_PACKET_RUN_PROTOCOL_MISMATCH"
  | "RUNTIME_PACKET_RUN_RELEASE_MISMATCH";

export class RuntimePacketCompilerError extends Error {
  readonly code: RuntimePacketCompilerErrorCode;

  constructor(code: RuntimePacketCompilerErrorCode, message: string) {
    super(message);
    this.name = "RuntimePacketCompilerError";
    this.code = code;
  }
}

export type RuntimePacketCompilationInput = Readonly<{
  runId: string;
  expectedMode: "shadow" | "v3";
  productSpec?: unknown;
  designGraph?: unknown;
  buildTopology?: unknown;
  storyPlan?: unknown;
  productSpecV2?: unknown;
  designGraphV2?: unknown | null;
  buildTopologyV1?: unknown;
  storyPlanV2?: unknown;
  designSourceClosureV2?: unknown;
  compiler: unknown;
  producer: unknown;
  parentPacketHashes?: unknown;
  designSource?: DesignSourceInputV1;
}>;

export type RuntimePacketCompilationResult = Readonly<{
  mode: "shadow" | "v3";
  activation: "activated" | "observed" | "rejected";
  activationCreated: boolean;
  compilation: ProductPacketCompilationResult | ProductPacketCompilationResultV3;
}>;

type RunRow = Readonly<{
  protocol: string;
  status: string;
  compiler_release_sha: string | null;
}>;

const CHILD_REF_KEYS = Object.freeze({
  productSpec: "PRODUCT_SPEC",
  designGraph: "DESIGN_GRAPH",
  buildTopology: "BUILD_TOPOLOGY",
  storyPlan: "STORY_PLAN",
  designSourceClosure: "DESIGN_SOURCE_CLOSURE",
  productSpecV2: "PRODUCT_SPEC",
  designGraphV2: "DESIGN_GRAPH",
  buildTopologyV1: "BUILD_TOPOLOGY",
  storyPlanV2: "STORY_PLAN",
  designSourceClosureV2: "DESIGN_SOURCE_CLOSURE",
} as const);

function historicalRefKey(prefix: string, hash: string): string {
  return `${prefix}_${hash.slice(0, 16).toUpperCase()}`;
}

export function createRuntimePacketCompiler(input: Readonly<{
  sql: postgres.Sql;
  artifactRoot: string;
  artifactLimits: ArtifactCapacityLimits;
  ownerInstanceId?: string;
}>) {
  const store = new ContentAddressedArtifactStore(input.artifactRoot, {
    limits: input.artifactLimits,
  });
  const index = createArtifactIndex(input.sql);
  const publisher = new IndexedArtifactPublisher({
    index,
    store,
    ownerInstanceId: input.ownerInstanceId ?? `runtime-packet-compiler:${process.pid}`,
  });

  async function readRun(runId: string): Promise<RunRow> {
    const rows = await input.sql.unsafe<RunRow[]>(
      `SELECT protocol, status, compiler_release_sha
         FROM runs WHERE id = $1 LIMIT 1`,
      [runId],
    );
    const run = rows[0];
    if (!run) {
      throw new RuntimePacketCompilerError(
        "RUNTIME_PACKET_RUN_NOT_FOUND",
        `Runtime packet run ${runId} does not exist`,
      );
    }
    return run;
  }

  async function addHistoricalRefs(
    runId: string,
    mode: "shadow" | "v3",
    compilation: ProductPacketCompilationResult | ProductPacketCompilationResultV3,
  ): Promise<void> {
    const prefix = mode === "shadow" ? "SHADOW" : "REJECTED";
    for (const [field, hash] of Object.entries(compilation.artifactHashes)) {
      if (typeof hash !== "string") continue;
      const base = CHILD_REF_KEYS[field as keyof typeof CHILD_REF_KEYS];
      if (!base) continue;
      await index.addRunArtifactRef({
        runId,
        refKey: historicalRefKey(`${prefix}_${base}`, hash),
        artifactHash: hash,
      });
    }
    if (compilation.packetHash) {
      await index.addRunArtifactRef({
        runId,
        refKey: historicalRefKey(`${prefix}_PRODUCT_BUILD_PACKET`, compilation.packetHash),
        artifactHash: compilation.packetHash,
      });
    }
    await index.addRunArtifactRef({
      runId,
      refKey: historicalRefKey(`${prefix}_COMPILATION_REPORT`, compilation.reportHash),
      artifactHash: compilation.reportHash,
    });
  }

  return Object.freeze({
    store,
    index,

    async compile(value: RuntimePacketCompilationInput): Promise<RuntimePacketCompilationResult> {
      const runId = z.string().min(1).max(200).parse(value.runId);
      const compiler = CompilerIdentityV1Schema.parse(value.compiler);
      const producer = SemanticArtifactProducerV1Schema.parse(value.producer);
      const run = await readRun(runId);
      if (run.protocol !== "shadow" && run.protocol !== "v3") {
        throw new RuntimePacketCompilerError(
          "RUNTIME_PACKET_RUN_NOT_COMPILER",
          `Run ${runId} does not own Product Compiler execution`,
        );
      }
      if (run.protocol !== value.expectedMode) {
        throw new RuntimePacketCompilerError(
          "RUNTIME_PACKET_RUN_PROTOCOL_MISMATCH",
          `Run ${runId} stored protocol differs from the requested compiler mode`,
        );
      }
      if (!["running", "resuming"].includes(run.status)) {
        throw new RuntimePacketCompilerError(
          "RUNTIME_PACKET_RUN_NOT_ACTIVE",
          `Run ${runId} is not active for Product Build Packet compilation`,
        );
      }
      if (
        run.compiler_release_sha !== compiler.codeSha
        || producer.codeSha !== compiler.codeSha
      ) {
        throw new RuntimePacketCompilerError(
          "RUNTIME_PACKET_RUN_RELEASE_MISMATCH",
          `Run ${runId}, compiler, and producer release identities do not agree`,
        );
      }
      if (value.expectedMode === "shadow") {
        const compilation = await compileProductBuildPacket({
          productSpec: value.productSpec,
          designGraph: value.designGraph,
          buildTopology: value.buildTopology,
          storyPlan: value.storyPlan,
          compiler,
          producer,
          protocol: "legacy-shadow",
          parentPacketHashes: value.parentPacketHashes,
          ...(value.designSource ? { designSource: value.designSource } : {}),
          artifactStore: publisher,
        });
        await addHistoricalRefs(runId, "shadow", compilation);
        return {
          mode: "shadow",
          activation: "observed",
          activationCreated: false,
          compilation,
        };
      }
      const compilation = await compileProductBuildPacketV3({
        productSpecV2: value.productSpecV2,
        designGraphV2: value.designGraphV2,
        buildTopologyV1: value.buildTopologyV1,
        storyPlanV2: value.storyPlanV2,
        designSourceClosureV2: value.designSourceClosureV2,
        compiler,
        producer,
        parentPacketHashes: value.parentPacketHashes,
        artifactStore: publisher,
      });
      if (
        compilation.status !== "sealed"
        || !compilation.packetHash
        || !compilation.packet
      ) {
        await addHistoricalRefs(runId, "v3", compilation);
        return {
          mode: "v3",
          activation: "rejected",
          activationCreated: false,
          compilation,
        };
      }
      const hashes = compilation.artifactHashes;
      const artifactRefs: Record<string, string> = {
        PRODUCT_SPEC: hashes.productSpecV2!,
        BUILD_TOPOLOGY: hashes.buildTopologyV1!,
        STORY_PLAN: hashes.storyPlanV2!,
        DESIGN_SOURCE_CLOSURE: hashes.designSourceClosureV2!,
        PRODUCT_BUILD_PACKET: compilation.packetHash,
        COMPILATION_REPORT: compilation.reportHash,
      };
      if (hashes.designGraphV2) {
        artifactRefs.DESIGN_GRAPH = hashes.designGraphV2;
      }
      const activated = await index.activateProductPacket({
        runId,
        packetHash: compilation.packetHash,
        compiler,
        packet: compilation.packet,
        artifactRefs,
      });
      return {
        mode: "v3",
        activation: "activated",
        activationCreated: activated.created,
        compilation,
      };
    },
  });
}
