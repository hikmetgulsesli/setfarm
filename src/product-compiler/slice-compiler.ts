import { z } from "zod";

import { produceRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-producer-v1.js";
import { hashRuntimeEvidenceContractV1 } from "../evidence/runtime-evidence-contract-v1.js";
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
  type ImplementationFileV1,
  ImplementationRecoveryDirectiveV1Schema,
  ImplementationSliceV1Schema,
  type ImplementationSliceV1,
} from "./schemas/implementation-slice-v1.js";
import { ProductBuildPacketV1Schema } from "./schemas/product-build-packet-v1.js";
import { ProductBuildPacketV2Schema } from "./schemas/product-build-packet-v2.js";
import { ProductSpecV1Schema } from "./schemas/product-spec-v1.js";
import { StoryPlanV1Schema } from "./schemas/story-plan-v1.js";
import { validateRuntimeDataContractClosureV1 } from "./producers/runtime-data-contract.js";

const DependencySignatureInputV1Schema = z
  .object({
    sliceHash: Sha256Schema,
    outputHash: Sha256Schema.optional(),
    sourceAfter: z.object({
      baseSha: GitObjectHashSchema,
      treeHash: GitObjectHashSchema,
    }).strict(),
    fileSignatures: z.array(z.object({
      pathRef: PathBindingIdSchema,
      presence: z.enum(["present", "absent"]),
      contentHash: Sha256Schema,
    }).strict()).max(20_000),
  })
  .strict();

const SourceFileSnapshotV1Schema = z
  .object({
    presence: z.enum(["present", "absent"]),
    contentHash: Sha256Schema,
  })
  .strict();

const SliceCompilerInputV1Schema = z
  .object({
    packetHash: Sha256Schema,
    packet: z.union([ProductBuildPacketV1Schema, ProductBuildPacketV2Schema]),
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
    fileSnapshots: z.record(PathBindingIdSchema, SourceFileSnapshotV1Schema),
    dependencySignatures: z.record(StoryIdSchema, DependencySignatureInputV1Schema),
    recovery: ImplementationRecoveryDirectiveV1Schema.optional(),
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
    value.packet.schema,
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
  const runtimeDataFields = [
    value.buildTopology.runtimeDataContract,
    value.buildTopology.runtimeDataContractHash,
    value.packet.runtimeDataContractHash,
  ];
  if (value.productSpec.delivery) {
    if (runtimeDataFields.some((item) => item === undefined)) {
      diagnostics.push(diagnostic({
        code: "SLICE_RUNTIME_DATA_CONTRACT_MISSING",
        message: "V3 implementation slice requires topology contract plus matching topology/packet hashes",
        reference: "runtimeDataContract",
      }));
    } else if (
      value.buildTopology.runtimeDataContractHash !== value.packet.runtimeDataContractHash
    ) {
      diagnostics.push(diagnostic({
        code: "SLICE_RUNTIME_DATA_PACKET_HASH_MISMATCH",
        message: "Packet runtime-data hash differs from sealed BuildTopology",
        reference: value.packet.runtimeDataContractHash,
      }));
    } else {
      diagnostics.push(...validateRuntimeDataContractClosureV1({
        productSpec: value.productSpec,
        commands: value.buildTopology.commands,
        contract: value.buildTopology.runtimeDataContract,
        contractHash: value.buildTopology.runtimeDataContractHash,
      }));
    }
  } else if (runtimeDataFields.some((item) => item !== undefined)) {
    diagnostics.push(diagnostic({
      code: "SLICE_RUNTIME_DATA_PROTOCOL_AUTHORITY_MISSING",
      message: "Historical ProductSpec without v3 delivery cannot be reinterpreted as runtime-data authority",
      reference: "delivery",
    }));
  }
  const runtimeEvidenceFields = [
    value.buildTopology.runtimeEvidenceContract,
    value.buildTopology.runtimeEvidenceContractHash,
    value.packet.runtimeEvidenceContractHash,
  ];
  if (value.productSpec.delivery) {
    if (runtimeEvidenceFields.some((item) => item === undefined)) {
      diagnostics.push(diagnostic({
        code: "SLICE_RUNTIME_EVIDENCE_CONTRACT_MISSING",
        message: "V3 implementation slice requires topology contract plus matching topology/packet runtime-evidence hashes",
        reference: "runtimeEvidenceContract",
      }));
    } else if (
      value.buildTopology.runtimeEvidenceContractHash !== value.packet.runtimeEvidenceContractHash
    ) {
      diagnostics.push(diagnostic({
        code: "SLICE_RUNTIME_EVIDENCE_PACKET_HASH_MISMATCH",
        message: "Packet runtime-evidence hash differs from sealed BuildTopology",
        reference: value.packet.runtimeEvidenceContractHash,
      }));
    } else {
      const projected = produceRuntimeEvidenceContractV1({
        productSpec: value.productSpec,
        buildTopology: value.buildTopology,
      });
      if (
        projected.status !== "produced"
        || hashRuntimeEvidenceContractV1(projected.contract) !== value.buildTopology.runtimeEvidenceContractHash
      ) {
        diagnostics.push(diagnostic({
          code: "SLICE_RUNTIME_EVIDENCE_PROJECTION_MISMATCH",
          message: "Sealed runtime-evidence contract is not the exact ProductSpec/BuildTopology projection",
          reference: projected.status === "produced" ? "runtimeEvidenceContractHash" : projected.status,
        }));
      }
    }
  } else if (runtimeEvidenceFields.some((item) => item !== undefined)) {
    diagnostics.push(diagnostic({
      code: "SLICE_RUNTIME_EVIDENCE_PROTOCOL_AUTHORITY_MISSING",
      message: "Historical ProductSpec without v3 delivery cannot be reinterpreted as runtime-evidence authority",
      reference: "delivery",
    }));
  }
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
  const files: ImplementationFileV1[] = story.ownedPathRefs.flatMap((pathRef): ImplementationFileV1[] => {
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
    const snapshot = value.fileSnapshots[pathRef];
    if (!snapshot) {
      diagnostics.push(diagnostic({
        code: "SLICE_OWNED_FILE_SNAPSHOT_MISSING",
        message: `Owned file ${pathRef} has no exact source presence/hash snapshot`,
        reference: pathRef,
      }));
      return [];
    }
    if (!value.recovery && binding.presence !== snapshot.presence) {
      diagnostics.push(diagnostic({
        code: "SLICE_FILE_PRESENCE_CONFLICT",
        message: `Topology and source snapshot disagree on presence for ${pathRef}`,
        reference: pathRef,
      }));
      return [];
    }
    if (!value.recovery && binding.knownContentHash !== snapshot.contentHash) {
      diagnostics.push(diagnostic({
        code: "SLICE_FILE_HASH_CONFLICT",
        message: `Topology and source snapshot disagree for ${pathRef}`,
        reference: pathRef,
      }));
      return [];
    }
    return [{
      pathRef,
      path: binding.path,
      role: "owned" as const,
      presence: snapshot.presence,
      knownContentHash: snapshot.contentHash,
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
  const ownerById = new Map(value.buildTopology.owners.map((item) => [item.id, item]));
  const sharedPathRefs = new Set<string>();
  const sharedFiles: ImplementationFileV1[] = [];
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
    if (grant.toOwnerRef !== story.ownerRef) {
      diagnostics.push(diagnostic({
        code: "SLICE_SHARED_GRANT_OWNER_MISMATCH",
        message: `Shared grant ${grantRef} is not addressed to story ${story.id}`,
        reference: grantRef,
      }));
      return [];
    }
    for (const pathRef of grant.pathRefs) {
      if (sharedPathRefs.has(pathRef) || story.ownedPathRefs.includes(pathRef)) {
        diagnostics.push(diagnostic({
          code: "SLICE_SHARED_PATH_GRANT_DUPLICATE",
          message: `Story ${story.id} receives path ${pathRef} more than once`,
          reference: pathRef,
        }));
        continue;
      }
      sharedPathRefs.add(pathRef);
      const binding = pathById.get(pathRef);
      if (!binding) {
        diagnostics.push(diagnostic({
          code: "SLICE_SHARED_PATH_NOT_FOUND",
          message: `Shared grant ${grantRef} path ${pathRef} is absent from topology`,
          reference: pathRef,
        }));
        continue;
      }
      if (binding.ownerRef !== grant.fromOwnerRef) {
        diagnostics.push(diagnostic({
          code: "SLICE_SHARED_PATH_OWNER_MISMATCH",
          message: `Shared path ${pathRef} is not owned by grant source ${grant.fromOwnerRef}`,
          reference: pathRef,
        }));
        continue;
      }
      const snapshot = value.fileSnapshots[pathRef];
      if (!snapshot) {
        diagnostics.push(diagnostic({
          code: "SLICE_SHARED_FILE_SNAPSHOT_MISSING",
          message: `Shared file ${pathRef} has no exact source presence/hash snapshot`,
          reference: pathRef,
        }));
        continue;
      }
      const differsFromSetupSnapshot = binding.presence !== snapshot.presence
        || binding.knownContentHash !== snapshot.contentHash;
      const sourceOwner = ownerById.get(grant.fromOwnerRef);
      const dependencySignature = sourceOwner?.kind === "story"
        ? value.dependencySignatures[sourceOwner.storyRef]
        : undefined;
      const dependencyFile = dependencySignature?.fileSignatures.find((item) => item.pathRef === pathRef);
      const dependencyProvesCurrentSource = Boolean(
        sourceOwner?.kind === "story"
        && story.dependsOn.includes(sourceOwner.storyRef)
        && dependencySignature?.outputHash
        && dependencyFile?.presence === snapshot.presence
        && dependencyFile.contentHash === snapshot.contentHash,
      );
      const recoveryOwnsCurrentBaseline = Boolean(
        value.recovery && grant.permissions.includes("write"),
      );
      if (differsFromSetupSnapshot && !dependencyProvesCurrentSource && !recoveryOwnsCurrentBaseline) {
        diagnostics.push(diagnostic({
          code: "SLICE_SHARED_FILE_REVISION_UNATTESTED",
          message: `Shared path ${pathRef} differs from setup without an exact terminal dependency source revision`,
          reference: pathRef,
        }));
        continue;
      }
      sharedFiles.push({
        pathRef,
        path: binding.path,
        role: grant.permissions.includes("write") ? "shared_writable" : "shared_readonly",
        presence: snapshot.presence,
        knownContentHash: snapshot.contentHash,
      });
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
  const surfaces = value.productSpec.surfaces.filter((item) => surfaceIds.has(item.id));
  const controls = value.designGraph.controls.filter((item) => controlIds.has(item.id));
  const bindings = value.designGraph.bindings.filter((item) => controlIds.has(item.controlRef));
  const observableBindings = (value.designGraph.observableBindings ?? []).filter((item) =>
    actionIds.has(item.actionRef));
  const actions = value.productSpec.actions.filter((item) => actionIds.has(item.id));
  const states = value.productSpec.states.filter((item) => stateIds.has(item.id));
  const persistencePolicies = value.productSpec.persistencePolicies.filter((item) =>
    persistenceIds.has(item.id));
  const semanticEvidenceIds = new Set([
    ...story.evidenceRefs,
    ...actions.flatMap((action) => [
      ...action.evidenceRefs,
      ...action.success.evidenceRefs,
      ...action.failure.evidenceRefs,
      ...(action.observableEffects ?? []).map((effect) => effect.evidenceRef),
    ]),
  ]);
  const evidencePredicates = value.productSpec.evidencePredicates.filter((item) =>
    semanticEvidenceIds.has(item.id));
  const routeIds = new Set([
    ...surfaces.map((item) => item.routeRef),
    ...bindings.flatMap((item) => item.disposition === "action" && item.routeRef ? [item.routeRef] : []),
    ...actions.flatMap((item) => item.navigation.kind === "route" ? [item.navigation.routeRef] : []),
  ]);
  const routes = value.productSpec.routes.filter((item) => routeIds.has(item.id));
  const completionEvidenceIds = new Set(story.evidenceRefs);
  const requiredEvidence = evidencePredicates.filter((item) =>
    item.required && completionEvidenceIds.has(item.id));

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
    files: [...files, ...sharedFiles],
    dependencySignatures,
    sharedGrants,
    contract: {
      routes,
      surfaces,
      controls,
      bindings,
      observableBindings,
      actions,
      states,
      persistencePolicies,
      evidencePredicates,
    },
    commands: value.buildTopology.commands,
    requiredEvidence,
    ...(value.buildTopology.runtimeDataContract && value.buildTopology.runtimeDataContractHash ? {
      runtimeDataContract: value.buildTopology.runtimeDataContract,
      runtimeDataContractHash: value.buildTopology.runtimeDataContractHash,
    } : {}),
    ...(value.buildTopology.runtimeEvidenceContract
      ? { runtimeEvidence: value.buildTopology.runtimeEvidenceContract }
      : {}),
    ...(value.recovery ? { recovery: value.recovery } : {}),
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
