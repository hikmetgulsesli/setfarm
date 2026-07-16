import { z } from "zod";

import {
  RuntimeEvidenceContractV1Schema,
  hashRuntimeEvidenceContractV1,
} from "../../evidence/runtime-evidence-contract-v1.js";
import { FindingSetV1Schema } from "../../findings/finding-set.js";
import { SourceRevisionV1Schema } from "../../execution/schemas/execution-attempt-v1.js";
import { canonicalJsonStringify, hashCanonicalJson } from "../canonical-json.js";
import {
  BuildCapabilityV1Schema,
  BuildCommandV1Schema,
  BuildEntrypointV1Schema,
  BuildTopologyV1Schema,
  SharedGrantV1Schema,
  topologyPathAbsenceHash,
} from "./build-topology-v1.js";
import {
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  SemanticArtifactProducerV1Schema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  DesignActionBindingV2Schema,
  DesignObservableBindingV2Schema,
  DesignPhysicalControlV2Schema,
  DesignSurfaceBindingV2Schema,
} from "./design-interaction-graph-v2.js";
import { DesignSourceClosureV2Schema } from "./design-source-closure-v2.js";
import { ProductBuildPacketV3Schema } from "./product-build-packet-v3.js";
import {
  ProductActionV2Schema,
  ProductRouteV2Schema,
  ProductSpecV2Schema,
  ProductSurfaceV2Schema,
} from "./product-spec-v2.js";
import {
  RuntimeDataContractV1Schema,
  hashRuntimeDataContractV1,
} from "./runtime-data-contract-v1.js";
import { ProductStoryV2Schema } from "./story-plan-v2.js";

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isCanonicalSet(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) => index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function requireCanonicalSet(
  context: z.RefinementCtx,
  path: PropertyKey[],
  values: readonly string[],
  label: string,
): void {
  if (!isCanonicalSet(values)) {
    context.addIssue({ code: "custom", path, message: `${label} must be unique and canonically UTF-16 sorted` });
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareUtf16);
}

const PresenceAndHashV2Schema = z.object({
  presence: z.enum(["present", "absent"]),
  contentHash: Sha256Schema,
}).strict();

export const ImplementationFileV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  path: NormalizedRelativeLocatorSchema,
  role: z.enum(["owned", "shared_readonly", "shared_writable"]),
  presence: z.enum(["present", "absent"]),
  contentHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.presence === "absent" && value.contentHash !== topologyPathAbsenceHash(value.path)) {
    context.addIssue({
      code: "custom",
      path: ["contentHash"],
      message: "Absent implementation files require the canonical path-specific absence hash",
    });
  }
});

export type ImplementationFileV2 = z.infer<typeof ImplementationFileV2Schema>;

const DependencyFileSignatureV2Schema = z.object({
  pathRef: PathBindingIdSchema,
  path: NormalizedRelativeLocatorSchema,
  presence: z.enum(["present", "absent"]),
  contentHash: Sha256Schema,
}).strict().superRefine((value, context) => {
  if (value.presence === "absent" && value.contentHash !== topologyPathAbsenceHash(value.path)) {
    context.addIssue({
      code: "custom",
      path: ["contentHash"],
      message: "Absent dependency files require the canonical path-specific absence hash",
    });
  }
});

export const ImplementationDependencyOutputV2Schema = z.object({
  storyId: StoryIdSchema,
  sliceHash: Sha256Schema,
  outputHash: Sha256Schema,
  sourceAfter: SourceRevisionV1Schema,
  fileSignatures: z.array(DependencyFileSignatureV2Schema).min(1).max(20_000),
}).strict().superRefine((value, context) => {
  requireCanonicalSet(
    context,
    ["fileSignatures"],
    value.fileSignatures.map((file) => file.pathRef),
    "Dependency file refs",
  );
  if (!hasUniqueStrings(value.fileSignatures.map((file) => file.path))) {
    context.addIssue({ code: "custom", path: ["fileSignatures"], message: "Dependency file paths must be unique" });
  }
});

export type ImplementationDependencyOutputV2 = z.infer<
  typeof ImplementationDependencyOutputV2Schema
>;

const RecoverySourceDeltaV2Schema = z.object({
  schema: z.literal("setfarm.implementation-source-delta.v2"),
  changes: z.array(z.object({
    pathRef: PathBindingIdSchema,
    path: NormalizedRelativeLocatorSchema,
    before: PresenceAndHashV2Schema,
    after: PresenceAndHashV2Schema,
  }).strict().superRefine((value, context) => {
    for (const [field, state] of [["before", value.before], ["after", value.after]] as const) {
      if (state.presence === "absent" && state.contentHash !== topologyPathAbsenceHash(value.path)) {
        context.addIssue({
          code: "custom",
          path: [field, "contentHash"],
          message: "Absent recovery delta states require the canonical path-specific absence hash",
        });
      }
    }
    if (canonicalJsonStringify(value.before) === canonicalJsonStringify(value.after)) {
      context.addIssue({
        code: "custom",
        path: ["after"],
        message: "Recovery source delta must change exact presence or content identity",
      });
    }
  })).min(1).max(20_000),
}).strict().superRefine((value, context) => {
  requireCanonicalSet(
    context,
    ["changes"],
    value.changes.map((change) => change.pathRef),
    "Recovery delta path refs",
  );
  if (!hasUniqueStrings(value.changes.map((change) => change.path))) {
    context.addIssue({ code: "custom", path: ["changes"], message: "Recovery delta paths must be unique" });
  }
});

export const ImplementationRecoveryDirectiveV2Schema = z.object({
  schema: z.literal("setfarm.implementation-recovery-directive.v2"),
  findingSet: FindingSetV1Schema,
  sourceRevision: SourceRevisionV1Schema,
  expectedSourceDelta: RecoverySourceDeltaV2Schema,
}).strict();

export type ImplementationRecoveryDirectiveV2 = z.infer<
  typeof ImplementationRecoveryDirectiveV2Schema
>;

export const ImplementationBuildAuthorityV2Schema = z.object({
  schema: z.literal("setfarm.implementation-build-authority.v2"),
  stackPack: BuildTopologyV1Schema.shape.stackPack,
  deliveryProfile: BuildTopologyV1Schema.shape.deliveryProfile,
  repo: BuildTopologyV1Schema.shape.repo,
  entrypoints: z.array(BuildEntrypointV1Schema).min(1).max(1_000),
  commands: z.array(BuildCommandV1Schema).min(1).max(1_000),
  capabilities: z.array(BuildCapabilityV1Schema).max(1_000),
  policies: BuildTopologyV1Schema.shape.policies,
  runtimeDataContract: RuntimeDataContractV1Schema.optional(),
  runtimeDataContractHash: Sha256Schema.optional(),
  runtimeEvidenceContract: RuntimeEvidenceContractV1Schema.optional(),
  runtimeEvidenceContractHash: Sha256Schema.optional(),
}).strict().superRefine((value, context) => {
  requireCanonicalSet(context, ["entrypoints"], value.entrypoints.map((entrypoint) => entrypoint.id), "Entrypoint IDs");
  requireCanonicalSet(context, ["commands"], value.commands.map((command) => command.id), "Command IDs");
  requireCanonicalSet(context, ["capabilities"], value.capabilities.map((capability) => capability.id), "Capability IDs");
  const capabilityIds = new Set(value.capabilities.map((capability) => capability.id));
  value.commands.forEach((command, commandIndex) => {
    command.capabilityRefs.forEach((reference, referenceIndex) => {
      if (!capabilityIds.has(reference)) {
        context.addIssue({
          code: "custom",
          path: ["commands", commandIndex, "capabilityRefs", referenceIndex],
          message: `Implementation command capability is unresolved: ${reference}`,
        });
      }
    });
  });
  const runtimeDataCount = [value.runtimeDataContract, value.runtimeDataContractHash]
    .filter((item) => item !== undefined).length;
  if (runtimeDataCount !== 0 && runtimeDataCount !== 2) {
    context.addIssue({
      code: "custom",
      path: ["runtimeDataContract"],
      message: "Runtime-data contract and hash must be present together",
    });
  }
  if (
    value.runtimeDataContract
    && value.runtimeDataContractHash !== hashRuntimeDataContractV1(value.runtimeDataContract)
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeDataContractHash"],
      message: "Runtime-data hash must bind the exact embedded contract",
    });
  }
  const runtimeEvidenceCount = [value.runtimeEvidenceContract, value.runtimeEvidenceContractHash]
    .filter((item) => item !== undefined).length;
  if (runtimeEvidenceCount !== 0 && runtimeEvidenceCount !== 2) {
    context.addIssue({
      code: "custom",
      path: ["runtimeEvidenceContract"],
      message: "Runtime-evidence contract and hash must be present together",
    });
  }
  if (
    value.runtimeEvidenceContract
    && value.runtimeEvidenceContractHash !== hashRuntimeEvidenceContractV1(value.runtimeEvidenceContract)
  ) {
    context.addIssue({
      code: "custom",
      path: ["runtimeEvidenceContractHash"],
      message: "Runtime-evidence hash must bind the exact embedded contract",
    });
  }
});

export type ImplementationBuildAuthorityV2 = z.infer<
  typeof ImplementationBuildAuthorityV2Schema
>;

const ProductStoryContractV2Schema = z.object({
  entities: z.array(ProductSpecV2Schema.shape.entities.element).max(500),
  routes: z.array(ProductRouteV2Schema).max(1_000),
  surfaces: z.array(ProductSurfaceV2Schema).max(2_000),
  actions: z.array(ProductActionV2Schema).min(1).max(5_000),
  states: z.array(ProductSpecV2Schema.shape.states.element).max(2_000),
  persistencePolicies: z.array(ProductSpecV2Schema.shape.persistencePolicies.element).max(2_000),
  evidencePredicates: z.array(ProductSpecV2Schema.shape.evidencePredicates.element).min(1).max(5_000),
}).strict();

const DesignStoryContractV2Schema = z.object({
  surfaces: z.array(DesignSurfaceBindingV2Schema).max(2_000),
  actions: z.array(DesignActionBindingV2Schema).min(1).max(5_000),
  controls: z.array(DesignPhysicalControlV2Schema).max(10_000),
  observables: z.array(DesignObservableBindingV2Schema).min(1).max(10_000),
}).strict();

export const ImplementationStoryContractV2Schema = z.object({
  schema: z.literal("setfarm.implementation-story-contract.v2"),
  product: ProductStoryContractV2Schema,
  design: DesignStoryContractV2Schema.nullable(),
}).strict();

export type ImplementationStoryContractV2 = z.infer<
  typeof ImplementationStoryContractV2Schema
>;

export const ImplementationSliceAuthorityV2Schema = z.object({
  schema: z.literal("setfarm.implementation-slice-authority.v2"),
  packetHash: Sha256Schema,
  productSpecV2PayloadHash: Sha256Schema,
  productSpecV2Hash: Sha256Schema,
  designGraphV2PayloadHash: Sha256Schema.nullable(),
  designGraphV2Hash: Sha256Schema.nullable(),
  buildTopologyV1PayloadHash: Sha256Schema,
  buildTopologyV1Hash: Sha256Schema,
  storyPlanV2PayloadHash: Sha256Schema,
  storyPlanV2Hash: Sha256Schema,
  designSourceClosureV2PayloadHash: Sha256Schema,
  designSourceClosureV2Hash: Sha256Schema,
  storyHash: Sha256Schema,
  sourceRevisionHash: Sha256Schema,
  filesHash: Sha256Schema,
  dependencyOutputsHash: Sha256Schema,
  sharedGrantsHash: Sha256Schema,
  storyContractHash: Sha256Schema,
  buildAuthorityHash: Sha256Schema,
  recoveryHash: Sha256Schema.nullable(),
}).strict();

export type ImplementationSliceAuthorityV2 = z.infer<
  typeof ImplementationSliceAuthorityV2Schema
>;

export function implementationFilesHashV2(files: readonly ImplementationFileV2[]): string {
  return hashCanonicalJson({ schema: "setfarm.implementation-file-set.v2", files });
}

export function implementationDependencyOutputsHashV2(
  outputs: readonly ImplementationDependencyOutputV2[],
): string {
  return hashCanonicalJson({ schema: "setfarm.implementation-dependency-output-set.v2", outputs });
}

export function implementationSharedGrantsHashV2(
  grants: readonly z.infer<typeof SharedGrantV1Schema>[],
): string {
  return hashCanonicalJson({ schema: "setfarm.implementation-shared-grant-set.v2", grants });
}

export function implementationSliceAuthorityHashV2(
  authority: ImplementationSliceAuthorityV2,
): string {
  return hashCanonicalJson(ImplementationSliceAuthorityV2Schema.parse(authority));
}

export const ImplementationSliceV2Schema = z.object({
  schema: z.literal("setfarm.implementation-slice.v2"),
  sliceVersion: z.literal(2),
  producer: SemanticArtifactProducerV1Schema,
  packetHash: Sha256Schema,
  packet: ProductBuildPacketV3Schema,
  authorityHash: Sha256Schema,
  authority: ImplementationSliceAuthorityV2Schema,
  storyId: StoryIdSchema,
  story: ProductStoryV2Schema,
  sourceRevision: SourceRevisionV1Schema,
  files: z.array(ImplementationFileV2Schema).min(1).max(20_000),
  dependencyOutputs: z.array(ImplementationDependencyOutputV2Schema).max(5_000),
  sharedGrants: z.array(SharedGrantV1Schema).max(20_000),
  contract: ImplementationStoryContractV2Schema,
  build: ImplementationBuildAuthorityV2Schema,
  designSourceClosure: DesignSourceClosureV2Schema,
  recovery: ImplementationRecoveryDirectiveV2Schema.optional(),
}).strict().superRefine((value, context) => {
  const expectedPacketHash = hashCanonicalJson({
    schema: "setfarm.semantic-artifact-envelope.v1",
    artifactType: "setfarm.product-build-packet.v3",
    producer: value.producer,
    payload: value.packet,
  });
  if (value.packetHash !== expectedPacketHash || value.authority.packetHash !== expectedPacketHash) {
    context.addIssue({
      code: "custom",
      path: ["packetHash"],
      message: "Slice packet hash must bind the exact embedded ProductBuildPacketV3",
    });
  }
  if (value.producer.codeSha !== value.packet.compiler.codeSha) {
    context.addIssue({
      code: "custom",
      path: ["producer", "codeSha"],
      message: "Slice producer revision must equal the embedded packet compiler revision",
    });
  }
  if (value.authorityHash !== implementationSliceAuthorityHashV2(value.authority)) {
    context.addIssue({
      code: "custom",
      path: ["authorityHash"],
      message: "Slice authority hash must bind the exact authority payload",
    });
  }
  if (
    value.authority.productSpecV2Hash !== value.packet.productSpecV2Hash
    || value.authority.designGraphV2Hash !== value.packet.designGraphV2Hash
    || value.authority.buildTopologyV1Hash !== value.packet.buildTopologyV1Hash
    || value.authority.storyPlanV2Hash !== value.packet.storyPlanV2Hash
    || value.authority.designSourceClosureV2Hash !== value.packet.designSourceClosureV2Hash
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority"],
      message: "Slice child authority hashes must exactly equal ProductBuildPacketV3",
    });
  }
  if (
    (value.authority.designGraphV2PayloadHash === null)
      !== (value.authority.designGraphV2Hash === null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority", "designGraphV2PayloadHash"],
      message: "Design graph payload fingerprint and CAS artifact identity must be present together",
    });
  }
  if (
    value.storyId !== value.story.id
    || value.authority.storyHash !== hashCanonicalJson(value.story)
    || value.authority.sourceRevisionHash !== hashCanonicalJson(value.sourceRevision)
    || value.authority.filesHash !== implementationFilesHashV2(value.files)
    || value.authority.dependencyOutputsHash !== implementationDependencyOutputsHashV2(value.dependencyOutputs)
    || value.authority.sharedGrantsHash !== implementationSharedGrantsHashV2(value.sharedGrants)
    || value.authority.storyContractHash !== hashCanonicalJson(value.contract)
    || value.authority.buildAuthorityHash !== hashCanonicalJson(value.build)
    || value.authority.designSourceClosureV2PayloadHash !== hashCanonicalJson(value.designSourceClosure)
    || value.authority.designSourceClosureV2Hash !== hashCanonicalJson({
      schema: "setfarm.semantic-artifact-envelope.v1",
      artifactType: "setfarm.design-source-closure.v2",
      producer: value.producer,
      payload: value.designSourceClosure,
    })
    || value.authority.recoveryHash !== (value.recovery ? hashCanonicalJson(value.recovery) : null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["authority"],
      message: "Slice authority fields do not bind exact embedded story/source/contract evidence",
    });
  }

  requireCanonicalSet(context, ["files"], value.files.map((file) => file.pathRef), "Slice file refs");
  if (!hasUniqueStrings(value.files.map((file) => file.path))) {
    context.addIssue({ code: "custom", path: ["files"], message: "Slice file paths must be unique" });
  }
  requireCanonicalSet(
    context,
    ["dependencyOutputs"],
    value.dependencyOutputs.map((output) => output.storyId),
    "Dependency story IDs",
  );
  requireCanonicalSet(context, ["sharedGrants"], value.sharedGrants.map((grant) => grant.id), "Shared grant IDs");

  const ownedFileRefs = sorted(value.files.filter((file) => file.role === "owned").map((file) => file.pathRef));
  if (!sameStrings(ownedFileRefs, value.story.ownedPathRefs)) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message: "Owned files must exactly equal ProductStoryV2 ownedPathRefs",
    });
  }
  if (!sameStrings(value.sharedGrants.map((grant) => grant.id), value.story.sharedGrantRefs)) {
    context.addIssue({
      code: "custom",
      path: ["sharedGrants"],
      message: "Slice grants must exactly equal ProductStoryV2 sharedGrantRefs",
    });
  }
  if (!sameStrings(value.dependencyOutputs.map((output) => output.storyId), value.story.dependsOn)) {
    context.addIssue({
      code: "custom",
      path: ["dependencyOutputs"],
      message: "Dependency outputs must exactly equal ProductStoryV2 dependsOn",
    });
  }
  const sharedRoleByPath = new Map<string, "shared_readonly" | "shared_writable">();
  value.sharedGrants.forEach((grant, grantIndex) => {
    if (grant.toOwnerRef !== value.story.ownerRef) {
      context.addIssue({
        code: "custom",
        path: ["sharedGrants", grantIndex, "toOwnerRef"],
        message: "Shared grant must be addressed to the exact story owner",
      });
    }
    const role = grant.permissions.includes("write") ? "shared_writable" : "shared_readonly";
    grant.pathRefs.forEach((pathRef, pathIndex) => {
      if (sharedRoleByPath.has(pathRef)) {
        context.addIssue({
          code: "custom",
          path: ["sharedGrants", grantIndex, "pathRefs", pathIndex],
          message: "One shared path cannot be conveyed by multiple grants",
        });
      }
      sharedRoleByPath.set(pathRef, role);
    });
  });
  const sharedFiles = value.files.filter((file) => file.role !== "owned");
  if (!sameStrings(sorted(sharedFiles.map((file) => file.pathRef)), sorted([...sharedRoleByPath.keys()]))) {
    context.addIssue({
      code: "custom",
      path: ["files"],
      message: "Shared slice files must exactly equal granted path refs",
    });
  }
  sharedFiles.forEach((file, index) => {
    if (sharedRoleByPath.get(file.pathRef) !== file.role) {
      context.addIssue({
        code: "custom",
        path: ["files", index, "role"],
        message: "Shared file role must exactly reflect its grant permissions",
      });
    }
  });

  const product = value.contract.product;
  const exactRefs = [
    ["routeRefs", value.story.routeRefs, product.routes.map((item) => item.id)],
    ["surfaceRefs", value.story.surfaceRefs, product.surfaces.map((item) => item.id)],
    ["actionRefs", value.story.actionRefs, product.actions.map((item) => item.id)],
    ["stateRefs", value.story.stateRefs, product.states.map((item) => item.id)],
    ["persistenceRefs", value.story.persistenceRefs, product.persistencePolicies.map((item) => item.id)],
  ] as const;
  exactRefs.forEach(([field, expected, observed]) => {
    requireCanonicalSet(context, ["contract", "product", field], observed, `Product contract ${field}`);
    if (!sameStrings(expected, observed)) {
      context.addIssue({
        code: "custom",
        path: ["contract", "product", field],
        message: `Product contract ${field} must exactly close ProductStoryV2`,
      });
    }
  });

  const requiredEvidenceRefs = product.evidencePredicates
    .filter((predicate) => predicate.required)
    .map((predicate) => predicate.id);
  requireCanonicalSet(
    context,
    ["contract", "product", "evidencePredicates"],
    product.evidencePredicates.map((predicate) => predicate.id),
    "Product contract evidence predicates",
  );
  if (!sameStrings(value.story.evidenceRefs, requiredEvidenceRefs)) {
    context.addIssue({
      code: "custom",
      path: ["contract", "product", "evidencePredicates"],
      message: "Required product evidence must exactly equal ProductStoryV2 evidenceRefs",
    });
  }

  const slotRefs = sorted(product.actions.flatMap((action) => action.controlPlacements.map((slot) => slot.id)));
  const observableRefs = sorted(product.actions.flatMap((action) => action.observableEffects.map((effect) => effect.id)));
  if (!sameStrings(value.story.controlSlotRefs, slotRefs)) {
    context.addIssue({
      code: "custom",
      path: ["contract", "product", "actions"],
      message: "Product action control slots must exactly equal ProductStoryV2 controlSlotRefs",
    });
  }
  if (!sameStrings(value.story.observableRefs, observableRefs)) {
    context.addIssue({
      code: "custom",
      path: ["contract", "product", "actions"],
      message: "Product action observables must exactly equal ProductStoryV2 observableRefs",
    });
  }
  const routeRefs = new Set(product.routes.map((route) => route.id));
  const surfaceRefs = new Set(product.surfaces.map((surface) => surface.id));
  const actionRefs = new Set(product.actions.map((action) => action.id));
  const stateRefs = new Set(product.states.map((state) => state.id));
  const persistenceRefs = new Set(product.persistencePolicies.map((policy) => policy.id));
  const evidenceRefs = new Set(product.evidencePredicates.map((predicate) => predicate.id));
  const entityRefs = new Set(product.entities.map((entity) => entity.id));
  const entityFieldOwner = new Map(product.entities.flatMap((entity) =>
    entity.fields.map((field) => [field.id, entity.id] as const)));
  requireCanonicalSet(context, ["contract", "product", "entities"], [...entityRefs], "Product contract entities");
  const entityFieldCount = product.entities.reduce((total, entity) => total + entity.fields.length, 0);
  if (entityFieldOwner.size !== entityFieldCount) {
    context.addIssue({
      code: "custom",
      path: ["contract", "product", "entities"],
      message: "Entity field identities must be globally unique inside the story closure",
    });
  }
  const checkRef = (
    available: ReadonlySet<string>,
    reference: string,
    path: PropertyKey[],
    label: string,
  ) => {
    if (!available.has(reference)) {
      context.addIssue({ code: "custom", path, message: `Story contract ${label} is unresolved: ${reference}` });
    }
  };
  product.routes.forEach((route, routeIndex) => {
    const expectedSurfaces = sorted(product.surfaces
      .filter((surface) => surface.routeRef === route.id)
      .map((surface) => surface.id));
    if (!sameStrings(sorted(route.surfaceRefs), expectedSurfaces)) {
      context.addIssue({
        code: "custom",
        path: ["contract", "product", "routes", routeIndex, "surfaceRefs"],
        message: "Story route must exactly index every embedded surface on that route",
      });
    }
    const root = product.surfaces.find((surface) => surface.id === route.rootSurfaceRef);
    if (!root || root.routeRef !== route.id || root.composition.kind !== "route_root") {
      context.addIssue({
        code: "custom",
        path: ["contract", "product", "routes", routeIndex, "rootSurfaceRef"],
        message: "Story route root must resolve to its exact embedded route-root surface",
      });
    }
  });
  product.surfaces.forEach((surface, surfaceIndex) => {
    checkRef(routeRefs, surface.routeRef, ["contract", "product", "surfaces", surfaceIndex, "routeRef"], "surface route");
    if (surface.composition.kind === "contained") {
      const hostSurfaceRef = surface.composition.hostSurfaceRef;
      const host = product.surfaces.find((candidate) =>
        candidate.id === hostSurfaceRef);
      if (!host || host.routeRef !== surface.routeRef) {
        context.addIssue({
          code: "custom",
          path: ["contract", "product", "surfaces", surfaceIndex, "composition", "hostSurfaceRef"],
          message: "Contained story surface must resolve to an embedded host on the same route",
        });
      }
    }
  });
  product.actions.forEach((action, actionIndex) => {
    action.controlPlacements.forEach((slot, slotIndex) =>
      checkRef(surfaceRefs, slot.surfaceRef, ["contract", "product", "actions", actionIndex, "controlPlacements", slotIndex], "control surface"));
    action.affectedSurfaceRefs.forEach((surfaceRef, index) =>
      checkRef(surfaceRefs, surfaceRef, ["contract", "product", "actions", actionIndex, "affectedSurfaceRefs", index], "affected surface"));
    if (action.navigation.kind === "route") {
      checkRef(routeRefs, action.navigation.routeRef, ["contract", "product", "actions", actionIndex, "navigation"], "navigation route");
    }
    action.evidenceScenario.prerequisiteSteps.forEach((step, index) =>
      checkRef(actionRefs, step.actionRef, ["contract", "product", "actions", actionIndex, "evidenceScenario", "prerequisiteSteps", index], "prerequisite action"));
    action.preconditions.forEach((precondition, index) =>
      checkRef(stateRefs, precondition.stateRef, ["contract", "product", "actions", actionIndex, "preconditions", index], "precondition state"));
    action.stateDeltas.forEach((delta, index) => {
      checkRef(stateRefs, delta.stateRef, ["contract", "product", "actions", actionIndex, "stateDeltas", index], "state delta");
      if (delta.valueFrom.kind === "state") {
        checkRef(stateRefs, delta.valueFrom.stateRef, ["contract", "product", "actions", actionIndex, "stateDeltas", index, "valueFrom"], "state value source");
      } else if (delta.valueFrom.kind === "entity_field") {
        checkRef(entityRefs, delta.valueFrom.entityRef, ["contract", "product", "actions", actionIndex, "stateDeltas", index, "valueFrom", "entityRef"], "entity value source");
        if (entityFieldOwner.get(delta.valueFrom.fieldRef) !== delta.valueFrom.entityRef) {
          context.addIssue({
            code: "custom",
            path: ["contract", "product", "actions", actionIndex, "stateDeltas", index, "valueFrom", "fieldRef"],
            message: "Entity-field value source must resolve to the exact embedded entity field",
          });
        }
      }
    });
    action.input.fields.forEach((field, fieldIndex) => {
      if (field.entityFieldRef && !entityFieldOwner.has(field.entityFieldRef)) {
        context.addIssue({
          code: "custom",
          path: ["contract", "product", "actions", actionIndex, "input", "fields", fieldIndex, "entityFieldRef"],
          message: "Action input entity field must resolve inside the exact entity closure",
        });
      }
    });
    action.persistenceEffects.forEach((effect, effectIndex) => {
      checkRef(persistenceRefs, effect.policyRef, ["contract", "product", "actions", actionIndex, "persistenceEffects", effectIndex], "persistence effect");
      if (effect.entityRef) {
        checkRef(entityRefs, effect.entityRef, ["contract", "product", "actions", actionIndex, "persistenceEffects", effectIndex, "entityRef"], "persistence entity");
      }
      effect.statePaths.forEach((statePath, stateIndex) =>
        checkRef(stateRefs, statePath.stateRef, ["contract", "product", "actions", actionIndex, "persistenceEffects", effectIndex, "statePaths", stateIndex], "persistence state"));
    });
    for (const [outcomeName, outcome] of [["success", action.success], ["failure", action.failure]] as const) {
      outcome.stateRefs.forEach((stateRef, index) =>
        checkRef(stateRefs, stateRef, ["contract", "product", "actions", actionIndex, outcomeName, "stateRefs", index], "outcome state"));
      (outcome.persistenceRefs ?? []).forEach((policyRef, index) =>
        checkRef(persistenceRefs, policyRef, ["contract", "product", "actions", actionIndex, outcomeName, "persistenceRefs", index], "outcome persistence"));
      outcome.evidenceRefs.forEach((evidenceRef, index) =>
        checkRef(evidenceRefs, evidenceRef, ["contract", "product", "actions", actionIndex, outcomeName, "evidenceRefs", index], "outcome evidence"));
    }
    action.evidenceRefs.forEach((evidenceRef, index) =>
      checkRef(evidenceRefs, evidenceRef, ["contract", "product", "actions", actionIndex, "evidenceRefs", index], "action evidence"));
    action.observableEffects.forEach((effect, effectIndex) => {
      checkRef(evidenceRefs, effect.evidenceRef, ["contract", "product", "actions", actionIndex, "observableEffects", effectIndex], "observable evidence");
      if (effect.selector.kind !== "control") {
        checkRef(surfaceRefs, effect.selector.surfaceRef, ["contract", "product", "actions", actionIndex, "observableEffects", effectIndex], "observable surface");
      }
    });
  });
  product.persistencePolicies.forEach((policy, policyIndex) => {
    policy.entityRefs.forEach((entityRef, entityIndex) =>
      checkRef(entityRefs, entityRef, ["contract", "product", "persistencePolicies", policyIndex, "entityRefs", entityIndex], "policy entity"));
    if (policy.rehydration.kind === "action") {
      checkRef(
        actionRefs,
        policy.rehydration.actionRef,
        ["contract", "product", "persistencePolicies", policyIndex, "rehydration", "actionRef"],
        "rehydration action",
      );
    }
  });
  const directEntityRefs = new Set([
    ...product.persistencePolicies.flatMap((policy) => policy.entityRefs),
    ...product.actions.flatMap((action) => [
      ...action.persistenceEffects.flatMap((effect) => effect.entityRef ? [effect.entityRef] : []),
      ...action.stateDeltas.flatMap((delta) =>
        delta.valueFrom.kind === "entity_field" ? [delta.valueFrom.entityRef] : []),
    ]),
  ]);
  const referencedEntityFieldRefs = new Set(product.actions.flatMap((action) => [
    ...action.input.fields.flatMap((field) => field.entityFieldRef ? [field.entityFieldRef] : []),
    ...action.stateDeltas.flatMap((delta) =>
      delta.valueFrom.kind === "entity_field" ? [delta.valueFrom.fieldRef] : []),
  ]));
  product.entities.forEach((entity, entityIndex) => {
    if (
      !directEntityRefs.has(entity.id)
      && !entity.fields.some((field) => referencedEntityFieldRefs.has(field.id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["contract", "product", "entities", entityIndex],
        message: "Entity closure cannot contain an entity unused by the exact story actions or persistence policies",
      });
    }
  });
  const referencedEvidenceRefs = sorted(product.actions.flatMap((action) => [
    ...action.evidenceRefs,
    ...action.success.evidenceRefs,
    ...action.failure.evidenceRefs,
    ...action.observableEffects.map((effect) => effect.evidenceRef),
  ]).filter((reference, index, values) => values.indexOf(reference) === index));
  const expectedEvidenceClosure = sorted([...new Set([...value.story.evidenceRefs, ...referencedEvidenceRefs])]);
  if (!sameStrings(expectedEvidenceClosure, product.evidencePredicates.map((predicate) => predicate.id))) {
    context.addIssue({
      code: "custom",
      path: ["contract", "product", "evidencePredicates"],
      message: "Evidence contract must contain every and only required or action-referenced predicates",
    });
  }
  const observableOwnerById = new Map(product.actions.flatMap((action) =>
    action.observableEffects.map((observable) => [observable.id, action.id] as const)));
  const evidenceSubjectRefs = new Set([
    ...entityRefs,
    ...stateRefs,
    ...persistenceRefs,
    ...routeRefs,
    ...surfaceRefs,
    ...actionRefs,
    ...observableOwnerById.keys(),
  ]);
  const capabilityById = new Map(value.build.capabilities.map((capability) =>
    [capability.id, capability] as const));
  product.evidencePredicates.forEach((predicate, predicateIndex) => {
    checkRef(
      evidenceSubjectRefs,
      predicate.subjectRef,
      ["contract", "product", "evidencePredicates", predicateIndex, "subjectRef"],
      "evidence subject",
    );
    if (predicate.kind === "observable_outcome") {
      const effect = product.actions.flatMap((action) => action.observableEffects)
        .find((observable) => observable.id === predicate.subjectRef);
      if (!effect || effect.evidenceRef !== predicate.id) {
        context.addIssue({
          code: "custom",
          path: ["contract", "product", "evidencePredicates", predicateIndex, "subjectRef"],
          message: "Observable evidence must exactly bind its embedded observable effect",
        });
      }
    }
    predicate.capabilityRefs.forEach((capabilityRef, capabilityIndex) => {
      if (!capabilityById.get(capabilityRef)?.enabled) {
        context.addIssue({
          code: "custom",
          path: ["contract", "product", "evidencePredicates", predicateIndex, "capabilityRefs", capabilityIndex],
          message: `Required story evidence capability is absent or disabled: ${capabilityRef}`,
        });
      }
    });
  });

  const design = value.contract.design;
  if (value.packet.designSourceKind === "none") {
    if (design !== null || value.designSourceClosure.kind !== "none" || value.story.controlRefs.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["contract", "design"],
        message: "No-design packets require null design contract, no-design closure, and no physical controls",
      });
    }
  } else if (!design || value.designSourceClosure.kind !== "stitch") {
    context.addIssue({
      code: "custom",
      path: ["contract", "design"],
      message: "Stitch packets require exact design contract and Stitch closure",
    });
  } else {
    const designRefs = [
      ["surfaces", value.story.surfaceRefs, design.surfaces.map((item) => item.surfaceRef)],
      ["actions", value.story.actionRefs, design.actions.map((item) => item.actionRef)],
      ["controls", value.story.controlRefs, design.controls.map((item) => item.id)],
      ["observables", value.story.observableRefs, design.observables.map((item) => item.observableRef)],
    ] as const;
    designRefs.forEach(([field, expected, observed]) => {
      requireCanonicalSet(context, ["contract", "design", field], observed, `Design contract ${field}`);
      if (!sameStrings(expected, observed)) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", field],
          message: `Design contract ${field} must exactly close ProductStoryV2`,
        });
      }
    });
    const productActionById = new Map(product.actions.map((action) => [action.id, action] as const));
    const productSurfaceById = new Map(product.surfaces.map((surface) => [surface.id, surface] as const));
    const productObservableById = new Map(product.actions.flatMap((action) =>
      action.observableEffects.map((observable) => [observable.id, {
        actionRef: action.id,
        observable,
      }] as const)));
    const designActionById = new Map(design.actions.map((action) => [action.actionRef, action] as const));
    design.surfaces.forEach((surface, index) => {
      const productSurface = productSurfaceById.get(surface.surfaceRef);
      if (
        !productSurface
        || surface.productSurfaceHash !== hashCanonicalJson(productSurface)
        || surface.routeRef !== productSurface.routeRef
        || surface.kind !== productSurface.kind
        || surface.required !== productSurface.required
        || canonicalJsonStringify(surface.composition) !== canonicalJsonStringify(productSurface.composition)
      ) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", "surfaces", index, "productSurfaceHash"],
          message: "Design surface must hash-bind its exact ProductSpecV2 surface",
        });
      }
    });
    design.actions.forEach((action, index) => {
      const productAction = productActionById.get(action.actionRef);
      if (!productAction || action.productActionHash !== hashCanonicalJson(productAction)) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", "actions", index, "productActionHash"],
          message: "Design action must hash-bind its exact ProductSpecV2 action",
        });
      }
      if (productAction) {
        const expectedSlots = sorted(productAction.controlPlacements.map((slot) => slot.id));
        const expectedAffectedSurfaces = sorted(productAction.affectedSurfaceRefs);
        const expectedObservables = sorted(productAction.observableEffects.map((observable) => observable.id));
        if (
          !sameStrings(expectedSlots, action.controlSlotRefs)
          || !sameStrings(expectedAffectedSurfaces, action.affectedSurfaceRefs)
          || !sameStrings(expectedObservables, action.observableRefs)
          || action.triggerKind !== productAction.trigger.kind
          || canonicalJsonStringify(action.navigation) !== canonicalJsonStringify(productAction.navigation)
        ) {
          context.addIssue({
            code: "custom",
            path: ["contract", "design", "actions", index],
            message: "Design action must exactly equal ProductSpecV2 trigger, navigation, slots, effects, and observables",
          });
        }
      }
    });
    design.controls.forEach((control, index) => {
      const action = productActionById.get(control.identity.actionRef);
      const placement = action?.controlPlacements.find((slot) => slot.id === control.identity.controlSlotRef);
      const placementSurface = placement ? productSurfaceById.get(placement.surfaceRef) : undefined;
      if (
        !placement
        || control.controlPlacementHash !== hashCanonicalJson(placement)
        || control.identity.surfaceRef !== placement.surfaceRef
        || control.identity.routeRef !== placementSurface?.routeRef
      ) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", "controls", index, "controlPlacementHash"],
          message: "Physical control must hash-bind its exact ProductSpecV2 control slot",
        });
      }
      const expectedInputFields = sorted(action?.input.fields.map((field) => field.name) ?? []);
      const observedInputFields = control.actionInputBindings.map((binding) => binding.fieldRef);
      if (!sameStrings(expectedInputFields, observedInputFields)) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", "controls", index, "actionInputBindings"],
          message: "Physical control action-input bindings must exactly cover ProductSpecV2 input fields",
        });
      }
      const inputFields = new Set(expectedInputFields);
      control.actionInputBindings.forEach((binding, bindingIndex) => {
        if (!inputFields.has(binding.fieldRef)) {
          context.addIssue({
            code: "custom",
            path: ["contract", "design", "controls", index, "actionInputBindings", bindingIndex],
            message: "Physical action-input binding must resolve to an exact ProductSpecV2 input field",
          });
        }
      });
    });
    design.observables.forEach((observable, index) => {
      const productObservable = productObservableById.get(observable.observableRef);
      if (
        !productObservable
        || observable.productObservableHash !== hashCanonicalJson(productObservable.observable)
        || observable.actionRef !== productObservable.actionRef
        || canonicalJsonStringify(observable.selector)
          !== canonicalJsonStringify(productObservable.observable.selector)
        || canonicalJsonStringify(observable.assertions)
          !== canonicalJsonStringify(productObservable.observable.assertions)
        || observable.evidenceRef !== productObservable.observable.evidenceRef
      ) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", "observables", index, "productObservableHash"],
          message: "Design observable must hash-bind its exact ProductSpecV2 observable",
        });
      }
      if (!designActionById.has(observable.actionRef)) {
        context.addIssue({
          code: "custom",
          path: ["contract", "design", "observables", index, "actionRef"],
          message: "Design observable action is unresolved inside the story contract",
        });
      }
    });
    if (
      value.designSourceClosure.designGraph.payloadHash !== value.authority.designGraphV2PayloadHash
      || value.designSourceClosure.designGraph.envelopeHash !== value.packet.designGraphV2Hash
      || value.designSourceClosure.acceptedAttempt.outputSealHash.length !== 64
      || value.designSourceClosure.projectionReceipt.artifactHash.length !== 64
    ) {
      context.addIssue({
        code: "custom",
        path: ["designSourceClosure"],
        message: "Stitch closure must bind packet graph hash, accepted output seal, and projection receipt",
      });
    }
  }

  if (value.build.runtimeDataContractHash !== value.packet.runtimeDataContractHash) {
    context.addIssue({
      code: "custom",
      path: ["build", "runtimeDataContractHash"],
      message: "Slice runtime-data hash must exactly equal ProductBuildPacketV3",
    });
  }
  if (value.build.runtimeEvidenceContractHash !== value.packet.runtimeEvidenceContractHash) {
    context.addIssue({
      code: "custom",
      path: ["build", "runtimeEvidenceContractHash"],
      message: "Slice runtime-evidence hash must exactly equal ProductBuildPacketV3",
    });
  }
  if (
    value.build.runtimeDataContract
    && value.build.runtimeDataContract.sourceProductSpecHash !== value.authority.productSpecV2PayloadHash
  ) {
    context.addIssue({
      code: "custom",
      path: ["build", "runtimeDataContract", "sourceProductSpecHash"],
      message: "Runtime-data authority must bind the exact packet ProductSpecV2 hash",
    });
  }
  if (
    value.build.runtimeEvidenceContract
    && value.build.runtimeEvidenceContract.stackPackId !== value.build.stackPack.id
  ) {
    context.addIssue({
      code: "custom",
      path: ["build", "runtimeEvidenceContract", "stackPackId"],
      message: "Runtime-evidence authority must bind the exact slice stack pack",
    });
  }

  if (value.recovery) {
    const recovery = value.recovery;
    if (
      recovery.findingSet.packetHash !== value.packetHash
      || recovery.findingSet.storyId !== value.storyId
      || !equalSourceRevision(recovery.findingSet.sourceRevision, value.sourceRevision)
      || !equalSourceRevision(recovery.sourceRevision, value.sourceRevision)
      || recovery.findingSet.findings.some((finding) => finding.status !== "open")
      || recovery.findingSet.findings.some((finding) =>
        !finding.expectedPredicateRef || !value.story.evidenceRefs.includes(finding.expectedPredicateRef))
    ) {
      context.addIssue({
        code: "custom",
        path: ["recovery"],
        message: "Recovery finding set must bind exact packet/story/current source and contain only open findings",
      });
    }
    const fileByRef = new Map(value.files.map((file) => [file.pathRef, file] as const));
    const changeByPath = new Map(recovery.expectedSourceDelta.changes.map((change) => [change.path, change] as const));
    recovery.expectedSourceDelta.changes.forEach((change, changeIndex) => {
      const file = fileByRef.get(change.pathRef);
      if (
        !file
        || file.path !== change.path
        || file.role === "shared_readonly"
        || file.presence !== change.before.presence
        || file.contentHash !== change.before.contentHash
      ) {
        context.addIssue({
          code: "custom",
          path: ["recovery", "expectedSourceDelta", "changes", changeIndex],
          message: "Recovery delta before identity must equal one current writable slice file",
        });
      }
      const justified = recovery.findingSet.findings.some((finding) =>
        finding.sourceLocators.some((locator) =>
          locator.path === change.path && locator.contentHash === change.before.contentHash));
      if (!justified) {
        context.addIssue({
          code: "custom",
          path: ["recovery", "expectedSourceDelta", "changes", changeIndex],
          message: "Every recovery delta must be justified by one exact current-source finding locator",
        });
      }
    });
    recovery.findingSet.findings.forEach((finding, findingIndex) => {
      finding.sourceLocators.forEach((locator, locatorIndex) => {
        const change = changeByPath.get(locator.path);
        const file = value.files.find((candidate) => candidate.path === locator.path);
        if (!change || !file || file.contentHash !== locator.contentHash || change.before.contentHash !== locator.contentHash) {
          context.addIssue({
            code: "custom",
            path: ["recovery", "findingSet", "findings", findingIndex, "sourceLocators", locatorIndex],
            message: "Every recovery finding source must equal current bytes and resolve to an exact writable delta",
          });
        }
      });
    });
  }
});

function equalSourceRevision(
  left: z.infer<typeof SourceRevisionV1Schema>,
  right: z.infer<typeof SourceRevisionV1Schema>,
): boolean {
  return left.sha === right.sha && left.treeHash === right.treeHash;
}

export type ImplementationSliceV2 = z.infer<typeof ImplementationSliceV2Schema>;

export function implementationSliceHashV2(slice: ImplementationSliceV2): string {
  return hashCanonicalJson(ImplementationSliceV2Schema.parse(slice));
}
