import { z } from "zod";

import {
  SemanticArtifactEnvelopeV1Schema,
  type SemanticArtifactEnvelopeV1,
} from "./artifact-store.js";
import { hashCanonicalJson } from "./canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "./diagnostics.js";
import { BuildTopologyV1Schema } from "./schemas/build-topology-v1.js";
import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import {
  GitObjectHashSchema,
  PathBindingIdSchema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  StoryIdSchema,
} from "./schemas/common-v1.js";
import { DesignInteractionGraphV1Schema } from "./schemas/design-interaction-graph-v1.js";
import {
  ImplementationSliceV1Schema,
  type ImplementationSliceV1,
} from "./schemas/implementation-slice-v1.js";
import { ProductBuildPacketV1Schema } from "./schemas/product-build-packet-v1.js";
import { ProductSpecV1Schema } from "./schemas/product-spec-v1.js";
import { StoryPlanV1Schema } from "./schemas/story-plan-v1.js";

const DependencySignatureInputV1Schema = z
  .object({
    sliceHash: Sha256Schema,
    outputHash: Sha256Schema.optional(),
  })
  .strict();

const SliceCompilerInputV1Schema = z
  .object({
    packetHash: Sha256Schema,
    packet: ProductBuildPacketV1Schema,
    productSpec: ProductSpecV1Schema,
    designGraph: DesignInteractionGraphV1Schema,
    buildTopology: BuildTopologyV1Schema,
    storyPlan: StoryPlanV1Schema,
    storyId: StoryIdSchema,
    sourceRevision: z.object({
      sha: GitObjectHashSchema,
      treeHash: GitObjectHashSchema,
    }).strict(),
    producer: SemanticArtifactProducerV1Schema,
    fileContentHashes: z.record(PathBindingIdSchema, Sha256Schema),
    dependencySignatures: z.record(StoryIdSchema, DependencySignatureInputV1Schema),
  })
  .strict();

export type ImplementationSliceCompilationResult = Readonly<{
  status: "compiled" | "rejected";
  diagnostics: CompilationDiagnosticV1[];
  slice?: ImplementationSliceV1;
  sliceHash?: string;
  envelope?: SemanticArtifactEnvelopeV1;
}>;

function diagnostic(input: {
  code: string;
  message: string;
  reference?: string;
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "contract",
    severity: "error",
    message: input.message,
    ...(input.reference ? { reference: input.reference } : {}),
    provenance: [],
    suggestions: [],
  });
}

function semanticEnvelope(
  artifactType: string,
  producer: z.infer<typeof SemanticArtifactProducerV1Schema>,
  payload: unknown,
): SemanticArtifactEnvelopeV1 {
  return SemanticArtifactEnvelopeV1Schema.parse({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType,
    producer,
    payload,
  });
}

function envelopeHash(
  artifactType: string,
  producer: z.infer<typeof SemanticArtifactProducerV1Schema>,
  payload: unknown,
): string {
  return hashCanonicalJson(semanticEnvelope(artifactType, producer, payload));
}

export function compileImplementationSlice(input: unknown): ImplementationSliceCompilationResult {
  const parsed = SliceCompilerInputV1Schema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "rejected",
      diagnostics: parsed.error.issues.slice(0, 200).map((issue) => diagnostic({
        code: "SLICE_INPUT_INVALID",
        message: `Slice compiler input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
        reference: issue.path.join("/") || "$",
      })),
    };
  }

  const value = parsed.data;
  const diagnostics: CompilationDiagnosticV1[] = [];
  const expectedPacketHash = envelopeHash(
    "setfarm.product-build-packet.v1",
    value.producer,
    value.packet,
  );
  if (expectedPacketHash !== value.packetHash) {
    diagnostics.push(diagnostic({
      code: "SLICE_PACKET_HASH_MISMATCH",
      message: "Packet payload/producer do not match the supplied packet hash",
      reference: value.packetHash,
    }));
  }

  const childHashes = {
    productSpecHash: envelopeHash("setfarm.product-spec.v1", value.producer, value.productSpec),
    designGraphHash: envelopeHash("setfarm.design-interaction-graph.v1", value.producer, value.designGraph),
    buildTopologyHash: envelopeHash("setfarm.build-topology.v1", value.producer, value.buildTopology),
    storyPlanHash: envelopeHash("setfarm.story-plan.v1", value.producer, value.storyPlan),
  };
  const mismatchCodes = {
    productSpecHash: "SLICE_PRODUCT_SPEC_HASH_MISMATCH",
    designGraphHash: "SLICE_DESIGN_GRAPH_HASH_MISMATCH",
    buildTopologyHash: "SLICE_BUILD_TOPOLOGY_HASH_MISMATCH",
    storyPlanHash: "SLICE_STORY_PLAN_HASH_MISMATCH",
  } as const;
  (Object.keys(childHashes) as Array<keyof typeof childHashes>).forEach((field) => {
    if (childHashes[field] !== value.packet[field]) {
      diagnostics.push(diagnostic({
        code: mismatchCodes[field],
        message: `${field} payload/producer do not match the sealed packet`,
        reference: value.packet[field],
      }));
    }
  });
  if (diagnostics.length > 0) {
    return { status: "rejected", diagnostics: sortCompilationDiagnostics(diagnostics) };
  }

  const story = value.storyPlan.stories.find((item) => item.id === value.storyId);
  if (!story) {
    return {
      status: "rejected",
      diagnostics: [diagnostic({
        code: "SLICE_STORY_NOT_FOUND",
        message: `Story ${value.storyId} is absent from the sealed StoryPlan`,
        reference: value.storyId,
      })],
    };
  }

  const pathById = new Map(value.buildTopology.pathBindings.map((item) => [item.id, item]));
  const files = story.ownedPathRefs.flatMap((pathRef) => {
    const binding = pathById.get(pathRef);
    if (!binding) {
      diagnostics.push(diagnostic({
        code: "SLICE_OWNED_PATH_NOT_FOUND",
        message: `Story ${story.id} owned path ${pathRef} is absent from topology`,
        reference: pathRef,
      }));
      return [];
    }
    if (binding.ownerRef !== story.ownerRef) {
      diagnostics.push(diagnostic({
        code: "SLICE_OWNED_PATH_OWNER_MISMATCH",
        message: `Story ${story.id} does not own topology path ${pathRef}`,
        reference: pathRef,
      }));
      return [];
    }
    const suppliedHash = value.fileContentHashes[pathRef];
    if (binding.knownContentHash && suppliedHash && binding.knownContentHash !== suppliedHash) {
      diagnostics.push(diagnostic({
        code: "SLICE_FILE_HASH_CONFLICT",
        message: `Topology and source snapshot disagree for ${pathRef}`,
        reference: pathRef,
      }));
      return [];
    }
    const knownContentHash = suppliedHash ?? binding.knownContentHash;
    if (!knownContentHash) {
      diagnostics.push(diagnostic({
        code: "SLICE_OWNED_FILE_HASH_MISSING",
        message: `Owned file ${pathRef} has no current content hash`,
        reference: pathRef,
      }));
      return [];
    }
    return [{
      pathRef,
      path: binding.path,
      role: "owned" as const,
      knownContentHash,
    }];
  });

  const dependencySignatures = story.dependsOn.flatMap((storyId) => {
    const signature = value.dependencySignatures[storyId];
    if (!signature) {
      diagnostics.push(diagnostic({
        code: "SLICE_DEPENDENCY_SIGNATURE_MISSING",
        message: `Dependency ${storyId} has no sealed slice signature`,
        reference: storyId,
      }));
      return [];
    }
    return [{ storyId, ...signature }];
  });
  Object.keys(value.dependencySignatures).forEach((storyId) => {
    if (!story.dependsOn.includes(storyId)) {
      diagnostics.push(diagnostic({
        code: "SLICE_UNDECLARED_DEPENDENCY_SIGNATURE",
        message: `Slice input contains undeclared dependency ${storyId}`,
        reference: storyId,
      }));
    }
  });

  const grantById = new Map(value.buildTopology.sharedGrants.map((item) => [item.id, item]));
  const sharedGrants = story.sharedGrantRefs.flatMap((grantRef) => {
    const grant = grantById.get(grantRef);
    if (!grant) {
      diagnostics.push(diagnostic({
        code: "SLICE_SHARED_GRANT_NOT_FOUND",
        message: `Story ${story.id} shared grant ${grantRef} is absent from topology`,
        reference: grantRef,
      }));
      return [];
    }
    return [grant];
  });
  if (diagnostics.length > 0) {
    return { status: "rejected", diagnostics: sortCompilationDiagnostics(diagnostics) };
  }

  const surfaceIds = new Set(story.surfaceRefs);
  const controlIds = new Set(story.controlRefs);
  const actionIds = new Set(story.actionRefs);
  const stateIds = new Set(story.stateRefs);
  const persistenceIds = new Set(story.persistenceRefs);
  const evidenceIds = new Set(story.evidenceRefs);
  const surfaces = value.productSpec.surfaces.filter((item) => surfaceIds.has(item.id));
  const controls = value.designGraph.controls.filter((item) => controlIds.has(item.id));
  const bindings = value.designGraph.bindings.filter((item) => controlIds.has(item.controlRef));
  const actions = value.productSpec.actions.filter((item) => actionIds.has(item.id));
  const states = value.productSpec.states.filter((item) => stateIds.has(item.id));
  const persistencePolicies = value.productSpec.persistencePolicies.filter((item) =>
    persistenceIds.has(item.id));
  const evidencePredicates = value.productSpec.evidencePredicates.filter((item) =>
    evidenceIds.has(item.id));
  const routeIds = new Set([
    ...surfaces.map((item) => item.routeRef),
    ...bindings.flatMap((item) => item.disposition === "action" && item.routeRef ? [item.routeRef] : []),
    ...actions.flatMap((item) => item.navigation.kind === "route" ? [item.navigation.routeRef] : []),
  ]);
  const routes = value.productSpec.routes.filter((item) => routeIds.has(item.id));
  const requiredEvidence = evidencePredicates.filter((item) => item.required);

  const sliceResult = ImplementationSliceV1Schema.safeParse({
    schema: "setfarm.implementation-slice.v1",
    sliceVersion: 1,
    packetHash: value.packetHash,
    storyId: story.id,
    sourceRevision: {
      baseSha: value.sourceRevision.sha,
      treeHash: value.sourceRevision.treeHash,
    },
    story,
    files,
    dependencySignatures,
    sharedGrants,
    contract: {
      routes,
      surfaces,
      controls,
      bindings,
      actions,
      states,
      persistencePolicies,
      evidencePredicates,
    },
    commands: value.buildTopology.commands,
    requiredEvidence,
  });
  if (!sliceResult.success) {
    return {
      status: "rejected",
      diagnostics: sliceResult.error.issues.slice(0, 200).map((issue) => diagnostic({
        code: "SLICE_CONTRACT_INVALID",
        message: `Implementation slice failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
        reference: issue.path.join("/") || "$",
      })),
    };
  }

  const envelope = semanticEnvelope(
    "setfarm.implementation-slice.v1",
    value.producer,
    sliceResult.data,
  );
  return {
    status: "compiled",
    diagnostics: [],
    slice: sliceResult.data,
    sliceHash: hashCanonicalJson(envelope),
    envelope,
  };
}
