import { z } from "zod";

import {
  GitObjectHashSchema,
  NormalizedRelativeLocatorSchema,
  PathBindingIdSchema,
  Sha256Schema,
  StoryIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import {
  BuildCommandV1Schema,
  SharedGrantV1Schema,
} from "./build-topology-v1.js";
import {
  DesignControlBindingV1Schema,
  DesignControlV1Schema,
} from "./design-interaction-graph-v1.js";
import {
  EvidencePredicateV1Schema,
  PersistencePolicyV1Schema,
  ProductActionV1Schema,
  ProductRouteV1Schema,
  ProductStateV1Schema,
  ProductSurfaceV1Schema,
} from "./product-spec-v1.js";
import { ProductStoryV1Schema } from "./story-plan-v1.js";

const SourceRevisionV1Schema = z
  .object({
    baseSha: GitObjectHashSchema,
    treeHash: GitObjectHashSchema,
  })
  .strict();

export const ImplementationFileV1Schema = z
  .object({
    pathRef: PathBindingIdSchema,
    path: NormalizedRelativeLocatorSchema,
    role: z.enum(["owned", "dependency", "shared_readonly", "shared_writable"]),
    knownContentHash: Sha256Schema.optional(),
  })
  .strict();

export type ImplementationFileV1 = z.infer<typeof ImplementationFileV1Schema>;

const DependencySignatureV1Schema = z
  .object({
    storyId: StoryIdSchema,
    sliceHash: Sha256Schema,
    outputHash: Sha256Schema.optional(),
  })
  .strict();

const SliceContractV1Schema = z
  .object({
    routes: z.array(ProductRouteV1Schema).max(1_000),
    surfaces: z.array(ProductSurfaceV1Schema).max(2_000),
    controls: z.array(DesignControlV1Schema).max(10_000),
    bindings: z.array(DesignControlBindingV1Schema).max(10_000),
    actions: z.array(ProductActionV1Schema).min(1).max(5_000),
    states: z.array(ProductStateV1Schema).max(2_000),
    persistencePolicies: z.array(PersistencePolicyV1Schema).max(2_000),
    evidencePredicates: z.array(EvidencePredicateV1Schema).min(1).max(5_000),
  })
  .strict();

export const ImplementationSliceV1Schema = z
  .object({
    schema: z.literal("setfarm.implementation-slice.v1"),
    sliceVersion: z.literal(1),
    packetHash: Sha256Schema,
    storyId: StoryIdSchema,
    sourceRevision: SourceRevisionV1Schema,
    story: ProductStoryV1Schema,
    files: z.array(ImplementationFileV1Schema).min(1).max(20_000),
    dependencySignatures: z.array(DependencySignatureV1Schema).max(5_000),
    sharedGrants: z.array(SharedGrantV1Schema).max(10_000),
    contract: SliceContractV1Schema,
    commands: z.array(BuildCommandV1Schema).min(1).max(1_000),
    requiredEvidence: z.array(EvidencePredicateV1Schema).min(1).max(5_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.storyId !== value.story.id) {
      context.addIssue({
        code: "custom",
        path: ["storyId"],
        message: "Slice storyId must match the embedded story",
      });
    }
    if (!hasUniqueStrings(value.files.map((file) => file.pathRef))) {
      context.addIssue({ code: "custom", path: ["files"], message: "Slice file path refs must be unique" });
    }
    if (!hasUniqueStrings(value.files.map((file) => file.path))) {
      context.addIssue({ code: "custom", path: ["files"], message: "Slice file paths must be unique" });
    }
    if (!hasUniqueStrings(value.dependencySignatures.map((item) => item.storyId))) {
      context.addIssue({
        code: "custom",
        path: ["dependencySignatures"],
        message: "Dependency signatures must be unique by story",
      });
    }
    if (!hasUniqueStrings(value.commands.map((item) => item.id))) {
      context.addIssue({ code: "custom", path: ["commands"], message: "Slice command IDs must be unique" });
    }

    const fileRefs = new Set(value.files.map((file) => file.pathRef));
    value.story.ownedPathRefs.forEach((pathRef, index) => {
      if (!fileRefs.has(pathRef)) {
        context.addIssue({
          code: "custom",
          path: ["story", "ownedPathRefs", index],
          message: `Story-owned path is absent from slice files: ${pathRef}`,
        });
      }
    });

    const requireRefs = (
      expected: readonly string[],
      actual: readonly string[],
      path: PropertyKey[],
      label: string,
    ) => {
      const available = new Set(actual);
      expected.forEach((reference, index) => {
        if (!available.has(reference)) {
          context.addIssue({
            code: "custom",
            path: [...path, index],
            message: `Slice is missing story ${label}: ${reference}`,
          });
        }
      });
    };

    requireRefs(value.story.surfaceRefs, value.contract.surfaces.map((item) => item.id), ["story", "surfaceRefs"], "surface ref");
    requireRefs(value.story.controlRefs, value.contract.controls.map((item) => item.id), ["story", "controlRefs"], "control ref");
    requireRefs(value.story.actionRefs, value.contract.actions.map((item) => item.id), ["story", "actionRefs"], "action ref");
    requireRefs(value.story.stateRefs, value.contract.states.map((item) => item.id), ["story", "stateRefs"], "state ref");
    requireRefs(
      value.story.persistenceRefs,
      value.contract.persistencePolicies.map((item) => item.id),
      ["story", "persistenceRefs"],
      "persistence ref",
    );
    requireRefs(
      value.story.evidenceRefs,
      value.contract.evidencePredicates.map((item) => item.id),
      ["story", "evidenceRefs"],
      "evidence ref",
    );

    const requiredEvidenceIds = new Set(value.requiredEvidence.map((item) => item.id));
    if (requiredEvidenceIds.size !== value.requiredEvidence.length) {
      context.addIssue({
        code: "custom",
        path: ["requiredEvidence"],
        message: "Required evidence IDs must be unique",
      });
    }
    value.story.evidenceRefs.forEach((evidenceRef, index) => {
      if (!requiredEvidenceIds.has(evidenceRef)) {
        context.addIssue({
          code: "custom",
          path: ["story", "evidenceRefs", index],
          message: `Story evidence is absent from requiredEvidence: ${evidenceRef}`,
        });
      }
    });
    value.requiredEvidence.forEach((evidence, index) => {
      if (!evidence.required) {
        context.addIssue({
          code: "custom",
          path: ["requiredEvidence", index, "required"],
          message: "requiredEvidence entries must be required",
        });
      }
    });
  });

export type ImplementationSliceV1 = z.infer<typeof ImplementationSliceV1Schema>;
