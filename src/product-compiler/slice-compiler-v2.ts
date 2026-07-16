import { z } from "zod";

import { hashCanonicalJson } from "./canonical-json.js";
import {
  BuildTopologyV1Schema,
  topologyPathAbsenceHash,
  type SharedGrantV1,
} from "./schemas/build-topology-v1.js";
import {
  PathBindingIdSchema,
  Sha256Schema,
  StoryIdSchema,
} from "./schemas/common-v1.js";
import { DesignInteractionGraphV2Schema } from "./schemas/design-interaction-graph-v2.js";
import { DesignSourceClosureV2Schema } from "./schemas/design-source-closure-v2.js";
import {
  ImplementationDependencyOutputV2Schema,
  ImplementationRecoveryDirectiveV2Schema,
  ImplementationSliceAuthorityV2Schema,
  ImplementationSliceV2Schema,
  implementationDependencyOutputsHashV2,
  implementationFilesHashV2,
  implementationSharedGrantsHashV2,
  implementationSliceAuthorityHashV2,
  implementationSliceHashV2,
  type ImplementationDependencyOutputV2,
  type ImplementationFileV2,
  type ImplementationSliceV2,
} from "./schemas/implementation-slice-v2.js";
import { ProductBuildPacketV3Schema } from "./schemas/product-build-packet-v3.js";
import { ProductSpecV2Schema } from "./schemas/product-spec-v2.js";
import { StoryPlanV2Schema } from "./schemas/story-plan-v2.js";
import { SourceRevisionV1Schema } from "../execution/schemas/execution-attempt-v1.js";

const CurrentFileSnapshotV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  presence: z.enum(["present", "absent"]),
  contentHash: Sha256Schema,
}).strict();

export type CurrentImplementationFileSnapshotV2 = z.infer<
  typeof CurrentFileSnapshotV2Schema
>;

export const ImplementationSliceCompilerInputV2Schema = z.object({
  packetHash: Sha256Schema,
  packet: ProductBuildPacketV3Schema,
  productSpec: ProductSpecV2Schema,
  designGraph: DesignInteractionGraphV2Schema.nullable(),
  buildTopology: BuildTopologyV1Schema,
  storyPlan: StoryPlanV2Schema,
  designSourceClosure: DesignSourceClosureV2Schema,
  storyId: StoryIdSchema,
  sourceRevision: SourceRevisionV1Schema,
  currentFiles: z.array(CurrentFileSnapshotV2Schema).min(1).max(20_000),
  dependencyOutputs: z.array(ImplementationDependencyOutputV2Schema).max(5_000),
  recovery: ImplementationRecoveryDirectiveV2Schema.optional(),
}).strict();

export type ImplementationSliceCompilerInputV2 = z.input<
  typeof ImplementationSliceCompilerInputV2Schema
>;

export type ImplementationSliceV2Diagnostic = Readonly<{
  code:
    | "SLICE_V2_INPUT_INVALID"
    | "SLICE_V2_PACKET_HASH_MISMATCH"
    | "SLICE_V2_CHILD_HASH_MISMATCH"
    | "SLICE_V2_STORY_PLAN_AUTHORITY_MISMATCH"
    | "SLICE_V2_DESIGN_AUTHORITY_MISMATCH"
    | "SLICE_V2_RUNTIME_AUTHORITY_MISMATCH"
    | "SLICE_V2_STORY_NOT_FOUND"
    | "SLICE_V2_GRANT_INVALID"
    | "SLICE_V2_FILE_SNAPSHOT_INVALID"
    | "SLICE_V2_DEPENDENCY_OUTPUT_INVALID"
    | "SLICE_V2_CONTRACT_INVALID";
  message: string;
  reference: string;
}>;

export type ImplementationSliceCompilationResultV2 =
  | Readonly<{
      status: "compiled";
      diagnostics: readonly [];
      slice: ImplementationSliceV2;
      sliceHash: string;
    }>
  | Readonly<{
      status: "rejected";
      diagnostics: readonly ImplementationSliceV2Diagnostic[];
    }>;

type ParsedInput = z.infer<typeof ImplementationSliceCompilerInputV2Schema>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function diagnostic(
  code: ImplementationSliceV2Diagnostic["code"],
  message: string,
  reference: string,
): ImplementationSliceV2Diagnostic {
  return { code, message, reference };
}

function sortedDiagnostics(
  diagnostics: readonly ImplementationSliceV2Diagnostic[],
): ImplementationSliceV2Diagnostic[] {
  return [...diagnostics].sort((left, right) =>
    compareUtf16(`${left.code}\0${left.reference}\0${left.message}`, `${right.code}\0${right.reference}\0${right.message}`));
}

function reject(
  diagnostics: readonly ImplementationSliceV2Diagnostic[],
): ImplementationSliceCompilationResultV2 {
  return { status: "rejected", diagnostics: sortedDiagnostics(diagnostics) };
}

function exactHash(value: unknown): string {
  return hashCanonicalJson(value);
}

function canonicalGrant(grant: SharedGrantV1): SharedGrantV1 {
  return {
    ...grant,
    pathRefs: [...grant.pathRefs].sort(compareUtf16),
    permissions: [...grant.permissions].sort(compareUtf16) as SharedGrantV1["permissions"],
  };
}

function canonicalDependencyOutput(
  output: ImplementationDependencyOutputV2,
): ImplementationDependencyOutputV2 {
  return {
    ...output,
    fileSignatures: [...output.fileSignatures].sort((left, right) => compareUtf16(left.pathRef, right.pathRef)),
  };
}

function validateArtifactAuthority(value: ParsedInput): ImplementationSliceV2Diagnostic[] {
  const diagnostics: ImplementationSliceV2Diagnostic[] = [];
  const packetHash = exactHash(value.packet);
  if (packetHash !== value.packetHash) {
    diagnostics.push(diagnostic(
      "SLICE_V2_PACKET_HASH_MISMATCH",
      "Supplied packet hash does not bind the exact ProductBuildPacketV3 payload",
      "packetHash",
    ));
  }

  const childHashes = {
    productSpecV2Hash: exactHash(value.productSpec),
    designGraphV2Hash: value.designGraph ? exactHash(value.designGraph) : null,
    buildTopologyV1Hash: exactHash(value.buildTopology),
    storyPlanV2Hash: exactHash(value.storyPlan),
    designSourceClosureV2Hash: exactHash(value.designSourceClosure),
  };
  for (const field of Object.keys(childHashes) as Array<keyof typeof childHashes>) {
    if (childHashes[field] !== value.packet[field]) {
      diagnostics.push(diagnostic(
        "SLICE_V2_CHILD_HASH_MISMATCH",
        `${field} does not hash to the exact child authority sealed by ProductBuildPacketV3`,
        field,
      ));
    }
  }

  if (
    value.storyPlan.productSpecHash !== childHashes.productSpecV2Hash
    || value.storyPlan.designSourceKind !== value.packet.designSourceKind
    || value.storyPlan.designGraphHash !== childHashes.designGraphV2Hash
    || value.storyPlan.buildTopologyHash !== childHashes.buildTopologyV1Hash
  ) {
    diagnostics.push(diagnostic(
      "SLICE_V2_STORY_PLAN_AUTHORITY_MISMATCH",
      "StoryPlanV2 does not bind the exact ProductSpecV2/design/topology authority",
      "storyPlan",
    ));
  }

  const requiresDesign = value.packet.designSourceKind === "stitch";
  if (
    requiresDesign !== value.productSpec.delivery.designRequired
    || requiresDesign !== Boolean(value.designGraph)
    || requiresDesign !== (value.designSourceClosure.kind === "stitch")
  ) {
    diagnostics.push(diagnostic(
      "SLICE_V2_DESIGN_AUTHORITY_MISMATCH",
      "Packet design kind, ProductSpec delivery, graph presence, and design closure disagree",
      "designSourceKind",
    ));
  }
  if (value.designGraph) {
    if (
      value.designGraph.productSpecHash !== childHashes.productSpecV2Hash
      || value.designSourceClosure.kind !== "stitch"
      || value.designSourceClosure.designGraph.payloadHash !== childHashes.designGraphV2Hash
    ) {
      diagnostics.push(diagnostic(
        "SLICE_V2_DESIGN_AUTHORITY_MISMATCH",
        "DesignInteractionGraphV2 and DesignSourceClosureV2 do not bind the exact ProductSpec/packet graph",
        "designGraph",
      ));
    }
  }

  if (
    value.buildTopology.runtimeDataContractHash !== value.packet.runtimeDataContractHash
    || value.buildTopology.runtimeEvidenceContractHash !== value.packet.runtimeEvidenceContractHash
  ) {
    diagnostics.push(diagnostic(
      "SLICE_V2_RUNTIME_AUTHORITY_MISMATCH",
      "BuildTopology runtime-data/evidence hashes do not equal ProductBuildPacketV3",
      "buildTopology.runtime",
    ));
  }
  return diagnostics;
}

function compileOwnership(input: ParsedInput, diagnostics: ImplementationSliceV2Diagnostic[]) {
  const story = input.storyPlan.stories.find((candidate) => candidate.id === input.storyId)!;
  const pathById = new Map(input.buildTopology.pathBindings.map((binding) => [binding.id, binding] as const));
  const ownerById = new Map(input.buildTopology.owners.map((owner) => [owner.id, owner] as const));
  const grantById = new Map(input.buildTopology.sharedGrants.map((grant) => [grant.id, grant] as const));
  const dependencyOutputByStory = new Map(input.dependencyOutputs.map((output) => [output.storyId, output] as const));

  const dependencyIds = [...story.dependsOn].sort(compareUtf16);
  const observedDependencyIds = [...dependencyOutputByStory.keys()].sort(compareUtf16);
  if (
    dependencyIds.length !== observedDependencyIds.length
    || dependencyIds.some((storyId, index) => storyId !== observedDependencyIds[index])
  ) {
    diagnostics.push(diagnostic(
      "SLICE_V2_DEPENDENCY_OUTPUT_INVALID",
      "Dependency outputs must exactly equal ProductStoryV2 dependsOn",
      "dependencyOutputs",
    ));
  }

  const storyOwner = ownerById.get(story.ownerRef);
  if (!storyOwner || storyOwner.kind !== "story" || storyOwner.storyRef !== story.id) {
    diagnostics.push(diagnostic(
      "SLICE_V2_GRANT_INVALID",
      `Story owner ${story.ownerRef} does not bind exact topology story ${story.id}`,
      story.ownerRef,
    ));
  }

  for (const dependencyId of dependencyIds) {
    const dependencyStory = input.storyPlan.stories.find((candidate) => candidate.id === dependencyId);
    const output = dependencyOutputByStory.get(dependencyId);
    if (!dependencyStory || !output) continue;
    const dependencyOwner = ownerById.get(dependencyStory.ownerRef);
    if (
      !dependencyOwner
      || dependencyOwner.kind !== "story"
      || dependencyOwner.storyRef !== dependencyStory.id
    ) {
      diagnostics.push(diagnostic(
        "SLICE_V2_DEPENDENCY_OUTPUT_INVALID",
        `Dependency ${dependencyId} owner does not bind its exact topology story`,
        dependencyStory.ownerRef,
      ));
    }
    const expectedRefs = [...dependencyStory.ownedPathRefs].sort(compareUtf16);
    const observedRefs = output.fileSignatures.map((signature) => signature.pathRef).sort(compareUtf16);
    if (
      expectedRefs.length !== observedRefs.length
      || expectedRefs.some((pathRef, index) => pathRef !== observedRefs[index])
    ) {
      diagnostics.push(diagnostic(
        "SLICE_V2_DEPENDENCY_OUTPUT_INVALID",
        `Dependency ${dependencyId} file signatures must exactly equal its owned path closure`,
        dependencyId,
      ));
    }
    output.fileSignatures.forEach((signature) => {
      const binding = pathById.get(signature.pathRef);
      if (
        !binding
        || binding.path !== signature.path
        || binding.ownerRef !== dependencyStory.ownerRef
      ) {
        diagnostics.push(diagnostic(
          "SLICE_V2_DEPENDENCY_OUTPUT_INVALID",
          `Dependency ${dependencyId} signature does not resolve to its exact owned topology path ${signature.pathRef}`,
          signature.pathRef,
        ));
      }
    });
  }

  const grants: SharedGrantV1[] = [];
  const accessibleRoles = new Map<string, ImplementationFileV2["role"]>();
  story.ownedPathRefs.forEach((pathRef) => {
    const binding = pathById.get(pathRef);
    if (!binding || binding.ownerRef !== story.ownerRef) {
      diagnostics.push(diagnostic(
        "SLICE_V2_GRANT_INVALID",
        `Owned path ${pathRef} does not belong to exact story owner ${story.ownerRef}`,
        pathRef,
      ));
    }
    accessibleRoles.set(pathRef, "owned");
  });
  const dependencyGrantSources = new Set<string>();
  for (const grantRef of story.sharedGrantRefs) {
    const grant = grantById.get(grantRef);
    if (!grant || grant.toOwnerRef !== story.ownerRef) {
      diagnostics.push(diagnostic(
        "SLICE_V2_GRANT_INVALID",
        `Story grant ${grantRef} is absent or addressed to another owner`,
        grantRef,
      ));
      continue;
    }
    const role = grant.permissions.includes("write") ? "shared_writable" : "shared_readonly";
    const sourceOwner = ownerById.get(grant.fromOwnerRef);
    if (sourceOwner?.kind === "story") {
      if (!story.dependsOn.includes(sourceOwner.storyRef)) {
        diagnostics.push(diagnostic(
          "SLICE_V2_GRANT_INVALID",
          `Grant ${grantRef} source story ${sourceOwner.storyRef} is absent from exact dependsOn closure`,
          grantRef,
        ));
      } else {
        dependencyGrantSources.add(sourceOwner.storyRef);
      }
    }
    for (const pathRef of grant.pathRefs) {
      const binding = pathById.get(pathRef);
      if (!binding || binding.ownerRef !== grant.fromOwnerRef || accessibleRoles.has(pathRef)) {
        diagnostics.push(diagnostic(
          "SLICE_V2_GRANT_INVALID",
          `Shared grant ${grantRef} does not convey one unique path owned by its source`,
          pathRef,
        ));
        continue;
      }
      accessibleRoles.set(pathRef, role);
    }
    grants.push(canonicalGrant(grant));
  }
  dependencyIds.forEach((dependencyId) => {
    if (!dependencyGrantSources.has(dependencyId)) {
      diagnostics.push(diagnostic(
        "SLICE_V2_GRANT_INVALID",
        `Dependency ${dependencyId} has no exact shared-grant source path for story ${story.id}`,
        dependencyId,
      ));
    }
  });

  const snapshotsByRef = new Map<string, z.infer<typeof CurrentFileSnapshotV2Schema>>();
  for (const snapshot of input.currentFiles) {
    if (snapshotsByRef.has(snapshot.pathRef)) {
      diagnostics.push(diagnostic(
        "SLICE_V2_FILE_SNAPSHOT_INVALID",
        `Current file snapshot is duplicated: ${snapshot.pathRef}`,
        snapshot.pathRef,
      ));
    }
    snapshotsByRef.set(snapshot.pathRef, snapshot);
  }
  const expectedSnapshotRefs = [...accessibleRoles.keys()].sort(compareUtf16);
  const observedSnapshotRefs = [...snapshotsByRef.keys()].sort(compareUtf16);
  if (
    expectedSnapshotRefs.length !== observedSnapshotRefs.length
    || expectedSnapshotRefs.some((pathRef, index) => pathRef !== observedSnapshotRefs[index])
  ) {
    diagnostics.push(diagnostic(
      "SLICE_V2_FILE_SNAPSHOT_INVALID",
      "Current file snapshots must contain every and only story-owned or explicitly granted paths",
      "currentFiles",
    ));
  }

  const files: ImplementationFileV2[] = [];
  for (const pathRef of expectedSnapshotRefs) {
    const binding = pathById.get(pathRef);
    const snapshot = snapshotsByRef.get(pathRef);
    const role = accessibleRoles.get(pathRef)!;
    if (!binding || !snapshot) {
      diagnostics.push(diagnostic(
        "SLICE_V2_FILE_SNAPSHOT_INVALID",
        `Accessible path ${pathRef} is absent from topology or current source snapshot`,
        pathRef,
      ));
      continue;
    }
    if (snapshot.presence === "absent" && snapshot.contentHash !== topologyPathAbsenceHash(binding.path)) {
      diagnostics.push(diagnostic(
        "SLICE_V2_FILE_SNAPSHOT_INVALID",
        `Absent path ${pathRef} does not use its canonical absence hash`,
        pathRef,
      ));
    }

    const differsFromTopology = binding.presence !== snapshot.presence
      || binding.knownContentHash !== snapshot.contentHash;
    let dependencyProof = false;
    if (role !== "owned") {
      const sourceOwner = ownerById.get(binding.ownerRef);
      if (sourceOwner?.kind === "story" && story.dependsOn.includes(sourceOwner.storyRef)) {
        const signature = dependencyOutputByStory.get(sourceOwner.storyRef)?.fileSignatures
          .find((candidate) => candidate.pathRef === pathRef);
        dependencyProof = Boolean(
          signature
          && signature.path === binding.path
          && signature.presence === snapshot.presence
          && signature.contentHash === snapshot.contentHash,
        );
        if (!dependencyProof) {
          diagnostics.push(diagnostic(
            "SLICE_V2_DEPENDENCY_OUTPUT_INVALID",
            `Current shared path ${pathRef} does not equal its exact dependency output signature`,
            pathRef,
          ));
        }
      }
    }
    const recoveryChange = input.recovery?.expectedSourceDelta.changes
      .find((change) => change.pathRef === pathRef);
    const recoveryProof = Boolean(
      recoveryChange
      && role !== "shared_readonly"
      && recoveryChange.path === binding.path
      && recoveryChange.before.presence === snapshot.presence
      && recoveryChange.before.contentHash === snapshot.contentHash,
    );
    if (differsFromTopology && !dependencyProof && !recoveryProof) {
      diagnostics.push(diagnostic(
        "SLICE_V2_FILE_SNAPSHOT_INVALID",
        `Current path ${pathRef} differs from topology without exact dependency output or writable recovery authority`,
        pathRef,
      ));
    }
    files.push({
      pathRef,
      path: binding.path,
      role,
      presence: snapshot.presence,
      contentHash: snapshot.contentHash,
    });
  }

  return {
    files: files.sort((left, right) => compareUtf16(left.pathRef, right.pathRef)),
    grants: grants.sort((left, right) => compareUtf16(left.id, right.id)),
    dependencyOutputs: input.dependencyOutputs
      .map(canonicalDependencyOutput)
      .sort((left, right) => compareUtf16(left.storyId, right.storyId)),
  };
}

function storyContract(input: ParsedInput) {
  const story = input.storyPlan.stories.find((candidate) => candidate.id === input.storyId)!;
  const routeRefs = new Set(story.routeRefs);
  const surfaceRefs = new Set(story.surfaceRefs);
  const actionRefs = new Set(story.actionRefs);
  const stateRefs = new Set(story.stateRefs);
  const persistenceRefs = new Set(story.persistenceRefs);
  const byId = <T>(items: readonly T[], identity: (item: T) => string, refs: ReadonlySet<string>): T[] =>
    items.filter((item) => refs.has(identity(item))).sort((left, right) => compareUtf16(identity(left), identity(right)));
  const actions = byId(input.productSpec.actions, (item) => item.id, actionRefs);
  const persistencePolicies = byId(
    input.productSpec.persistencePolicies,
    (item) => item.id,
    persistenceRefs,
  );
  const evidenceRefs = new Set([
    ...story.evidenceRefs,
    ...actions.flatMap((action) => [
      ...action.evidenceRefs,
      ...action.success.evidenceRefs,
      ...action.failure.evidenceRefs,
      ...action.observableEffects.map((effect) => effect.evidenceRef),
    ]),
  ]);
  const directEntityRefs = new Set([
    ...persistencePolicies.flatMap((policy) => policy.entityRefs),
    ...actions.flatMap((action) => [
      ...action.persistenceEffects.flatMap((effect) => effect.entityRef ? [effect.entityRef] : []),
      ...action.stateDeltas.flatMap((delta) =>
        delta.valueFrom.kind === "entity_field" ? [delta.valueFrom.entityRef] : []),
    ]),
  ]);
  const entityFieldRefs = new Set(actions.flatMap((action) => [
    ...action.input.fields.flatMap((field) => field.entityFieldRef ? [field.entityFieldRef] : []),
    ...action.stateDeltas.flatMap((delta) =>
      delta.valueFrom.kind === "entity_field" ? [delta.valueFrom.fieldRef] : []),
  ]));
  const product = {
    entities: input.productSpec.entities
      .filter((entity) => directEntityRefs.has(entity.id)
        || entity.fields.some((field) => entityFieldRefs.has(field.id)))
      .sort((left, right) => compareUtf16(left.id, right.id)),
    routes: byId(input.productSpec.routes, (item) => item.id, routeRefs),
    surfaces: byId(input.productSpec.surfaces, (item) => item.id, surfaceRefs),
    actions,
    states: byId(input.productSpec.states, (item) => item.id, stateRefs),
    persistencePolicies,
    evidencePredicates: byId(input.productSpec.evidencePredicates, (item) => item.id, evidenceRefs),
  };
  if (!input.designGraph) {
    return { schema: "setfarm.implementation-story-contract.v2" as const, product, design: null };
  }
  const controlRefs = new Set(story.controlRefs);
  const observableRefs = new Set(story.observableRefs);
  return {
    schema: "setfarm.implementation-story-contract.v2" as const,
    product,
    design: {
      surfaces: byId(input.designGraph.surfaces, (item) => item.surfaceRef, surfaceRefs),
      actions: byId(input.designGraph.actions, (item) => item.actionRef, actionRefs),
      controls: byId(input.designGraph.controls, (item) => item.id, controlRefs),
      observables: byId(input.designGraph.observables, (item) => item.observableRef, observableRefs),
    },
  };
}

function buildAuthority(input: ParsedInput) {
  const topology = input.buildTopology;
  return {
    schema: "setfarm.implementation-build-authority.v2" as const,
    stackPack: topology.stackPack,
    ...(topology.deliveryProfile ? { deliveryProfile: topology.deliveryProfile } : {}),
    repo: topology.repo,
    entrypoints: [...topology.entrypoints]
      .sort((left, right) => compareUtf16(left.id, right.id)),
    commands: [...topology.commands]
      .sort((left, right) => compareUtf16(left.id, right.id)),
    capabilities: [...topology.capabilities]
      .sort((left, right) => compareUtf16(left.id, right.id)),
    policies: topology.policies,
    ...(topology.runtimeDataContract && topology.runtimeDataContractHash ? {
      runtimeDataContract: topology.runtimeDataContract,
      runtimeDataContractHash: topology.runtimeDataContractHash,
    } : {}),
    ...(topology.runtimeEvidenceContract && topology.runtimeEvidenceContractHash ? {
      runtimeEvidenceContract: topology.runtimeEvidenceContract,
      runtimeEvidenceContractHash: topology.runtimeEvidenceContractHash,
    } : {}),
  };
}

export function compileImplementationSliceV2(
  input: unknown,
): ImplementationSliceCompilationResultV2 {
  const parsed = ImplementationSliceCompilerInputV2Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 200).map((issue) => diagnostic(
      "SLICE_V2_INPUT_INVALID",
      `ImplementationSliceV2 input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  const value = parsed.data;
  const diagnostics = validateArtifactAuthority(value);
  const story = value.storyPlan.stories.find((candidate) => candidate.id === value.storyId);
  if (!story) {
    diagnostics.push(diagnostic(
      "SLICE_V2_STORY_NOT_FOUND",
      `Story ${value.storyId} is absent from exact StoryPlanV2`,
      value.storyId,
    ));
    return reject(diagnostics);
  }

  const ownership = compileOwnership(value, diagnostics);
  if (diagnostics.length > 0) return reject(diagnostics);

  const contract = storyContract(value);
  const build = buildAuthority(value);
  const authority = ImplementationSliceAuthorityV2Schema.parse({
    schema: "setfarm.implementation-slice-authority.v2",
    packetHash: value.packetHash,
    productSpecV2Hash: value.packet.productSpecV2Hash,
    designGraphV2Hash: value.packet.designGraphV2Hash,
    buildTopologyV1Hash: value.packet.buildTopologyV1Hash,
    storyPlanV2Hash: value.packet.storyPlanV2Hash,
    designSourceClosureV2Hash: value.packet.designSourceClosureV2Hash,
    storyHash: exactHash(story),
    sourceRevisionHash: exactHash(value.sourceRevision),
    filesHash: implementationFilesHashV2(ownership.files),
    dependencyOutputsHash: implementationDependencyOutputsHashV2(ownership.dependencyOutputs),
    sharedGrantsHash: implementationSharedGrantsHashV2(ownership.grants),
    storyContractHash: exactHash(contract),
    buildAuthorityHash: exactHash(build),
    recoveryHash: value.recovery ? exactHash(value.recovery) : null,
  });
  const sliceCandidate = {
    schema: "setfarm.implementation-slice.v2" as const,
    sliceVersion: 2 as const,
    packetHash: value.packetHash,
    packet: value.packet,
    authorityHash: implementationSliceAuthorityHashV2(authority),
    authority,
    storyId: story.id,
    story,
    sourceRevision: value.sourceRevision,
    files: ownership.files,
    dependencyOutputs: ownership.dependencyOutputs,
    sharedGrants: ownership.grants,
    contract,
    build,
    designSourceClosure: value.designSourceClosure,
    ...(value.recovery ? { recovery: value.recovery } : {}),
  };
  const slice = ImplementationSliceV2Schema.safeParse(sliceCandidate);
  if (!slice.success) {
    return reject(slice.error.issues.slice(0, 300).map((issue) => diagnostic(
      "SLICE_V2_CONTRACT_INVALID",
      `ImplementationSliceV2 failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  return {
    status: "compiled",
    diagnostics: [],
    slice: slice.data,
    sliceHash: implementationSliceHashV2(slice.data),
  };
}
