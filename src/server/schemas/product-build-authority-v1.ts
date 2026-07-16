import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";
import { BuildTopologyV1Schema } from "../../product-compiler/schemas/build-topology-v1.js";
import { ProductCompilationReportV1Schema } from "../../product-compiler/schemas/compilation-report-v1.js";
import { ProductCompilationReportV2Schema } from "../../product-compiler/schemas/compilation-report-v2.js";
import { SemanticArtifactProducerV1Schema, Sha256Schema } from "../../product-compiler/schemas/common-v1.js";
import { DesignGenerationTargetsV1Schema } from "../../product-compiler/schemas/design-generation-targets-v1.js";
import { DesignInteractionGraphV1Schema } from "../../product-compiler/schemas/design-interaction-graph-v1.js";
import { DesignSourceClosureV1Schema } from "../../product-compiler/schemas/design-source-closure-v1.js";
import { ProductBuildPacketV1Schema } from "../../product-compiler/schemas/product-build-packet-v1.js";
import { ProductBuildPacketV2Schema } from "../../product-compiler/schemas/product-build-packet-v2.js";
import { ProductSpecV1Schema } from "../../product-compiler/schemas/product-spec-v1.js";
import { StitchDirectResponseEvidenceV2Schema } from "../../product-compiler/schemas/stitch-direct-response-evidence-v2.js";
import { StitchRenderedSemanticsV1Schema } from "../../product-compiler/schemas/stitch-rendered-semantics-v1.js";
import {
  StitchTargetCandidateSelectionV1Schema,
  StitchTargetResponseBindingsV2Schema,
} from "../../product-compiler/schemas/stitch-target-candidate-selection-v1.js";
import { StoryPlanV1Schema } from "../../product-compiler/schemas/story-plan-v1.js";

const ProductBuildAuthorityRefsV1Schema = z.object({
  productSpec: Sha256Schema,
  designGraph: Sha256Schema,
  buildTopology: Sha256Schema,
  storyPlan: Sha256Schema,
  packet: Sha256Schema,
  compilationReport: Sha256Schema,
}).strict();

const ProductBuildAuthorityRefsV2Schema = ProductBuildAuthorityRefsV1Schema.extend({
  designSourceClosure: Sha256Schema,
}).strict();

const ProductBuildAuthorityDesignSourcesV1Schema = z.object({
  generationTargets: DesignGenerationTargetsV1Schema,
  directResponseEvidence: StitchDirectResponseEvidenceV2Schema,
  renderedSemantics: StitchRenderedSemanticsV1Schema,
  candidateSelection: StitchTargetCandidateSelectionV1Schema,
  responseBindings: StitchTargetResponseBindingsV2Schema,
}).strict();

export const ProductBuildAuthorityV1Schema = z.object({
  schema: z.literal("setfarm.product-build-authority.v1"),
  runId: z.string().min(1).max(200),
  packetHash: Sha256Schema,
  producer: SemanticArtifactProducerV1Schema,
  productSpec: ProductSpecV1Schema,
  designGraph: DesignInteractionGraphV1Schema,
  buildTopology: BuildTopologyV1Schema,
  storyPlan: StoryPlanV1Schema,
  packet: z.discriminatedUnion("schema", [ProductBuildPacketV1Schema, ProductBuildPacketV2Schema]),
  compilationReport: z.union([
    ProductCompilationReportV1Schema,
    ProductCompilationReportV2Schema,
  ]),
  refs: z.union([ProductBuildAuthorityRefsV1Schema, ProductBuildAuthorityRefsV2Schema]),
  designSourceClosure: DesignSourceClosureV1Schema.optional(),
  designSources: ProductBuildAuthorityDesignSourcesV1Schema.optional(),
  authorityHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  const packetV2 = value.packet.schema === "setfarm.product-build-packet.v2";
  const reportV2 = value.compilationReport.schema === "setfarm.product-compilation-report.v2";
  const refsV2 = "designSourceClosure" in value.refs;
  if (packetV2 !== reportV2 || packetV2 !== refsV2 || packetV2 !== Boolean(value.designSourceClosure)) {
    context.addIssue({
      code: "custom",
      path: ["packet"],
      message: "Packet, report, refs, and design-source closure versions must activate together",
    });
  }
  if (!packetV2 && value.designSources) {
    context.addIssue({
      code: "custom",
      path: ["designSources"],
      message: "Product Build Packet v1 cannot claim typed design sources",
    });
  }
  if (
    value.designSourceClosure?.kind === "stitch" !== Boolean(value.designSources)
  ) {
    context.addIssue({
      code: "custom",
      path: ["designSources"],
      message: "Stitch closure and its complete typed source set must activate together",
    });
  }
  if (
    value.packetHash !== value.refs.packet
    || value.packet.productSpecHash !== value.refs.productSpec
    || value.packet.designGraphHash !== value.refs.designGraph
    || value.packet.buildTopologyHash !== value.refs.buildTopology
    || value.packet.storyPlanHash !== value.refs.storyPlan
    || value.compilationReport.status !== "sealed"
    || value.compilationReport.packetHash !== value.packetHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["refs"],
      message: "Authority refs must exactly equal the sealed packet and compilation report",
    });
  }
  if (
    value.packet.schema === "setfarm.product-build-packet.v2"
    && value.compilationReport.schema === "setfarm.product-compilation-report.v2"
    && "designSourceClosure" in value.refs
  ) {
    if (
      value.packet.designSourceClosureHash !== value.refs.designSourceClosure
      || value.compilationReport.artifactHashes.designSourceClosure !== value.refs.designSourceClosure
    ) {
      context.addIssue({
        code: "custom",
        path: ["refs", "designSourceClosure"],
        message: "Packet and report must attest the exact design-source closure",
      });
    }
  }
  const { authorityHash: _authorityHash, ...identity } = value;
  if (hashCanonicalJson(identity) !== value.authorityHash) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Authority hash must bind the complete canonical packet read model",
    });
  }
});

export type ProductBuildAuthorityV1 = z.infer<typeof ProductBuildAuthorityV1Schema>;
