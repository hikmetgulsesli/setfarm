import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  EvidenceIdSchema,
  ObservableIdSchema,
  OwnerIdSchema,
  PathBindingIdSchema,
  PersistenceIdSchema,
  RouteIdSchema,
  Sha256Schema,
  SharedGrantIdSchema,
  StateIdSchema,
  StoryIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isCanonicalSet(values: readonly string[]): boolean {
  return hasUniqueStrings(values)
    && values.every((value, index) => index === 0 || compareUtf16(values[index - 1]!, value) < 0);
}

function canonicalReferenceArray<T extends z.ZodType<string>>(
  item: T,
  maximum: number,
  label: string,
  minimum = 0,
) {
  return z.array(item).min(minimum).max(maximum).superRefine((values, context) => {
    if (!isCanonicalSet(values)) {
      context.addIssue({
        code: "custom",
        message: `${label} must be unique and canonically UTF-16 sorted`,
      });
    }
  });
}

/**
 * One closed implementation ownership component. Unlike StoryPlanV1, V2
 * preserves ProductSpec control-slot identity separately from the physical
 * controls proven by DesignInteractionGraphV2.
 */
export const ProductStoryV2Schema = z.object({
  id: StoryIdSchema,
  order: z.number().int().positive(),
  componentHash: Sha256Schema,
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(10_000),
  ownerRef: OwnerIdSchema,
  dependsOn: canonicalReferenceArray(StoryIdSchema, 1_000, "Story dependencies"),
  routeRefs: canonicalReferenceArray(RouteIdSchema, 1_000, "Story route refs", 1),
  surfaceRefs: canonicalReferenceArray(SurfaceIdSchema, 2_000, "Story surface refs", 1),
  controlSlotRefs: canonicalReferenceArray(ControlSlotIdSchema, 10_000, "Story control-slot refs"),
  controlRefs: canonicalReferenceArray(ControlIdSchema, 10_000, "Story physical-control refs"),
  actionRefs: canonicalReferenceArray(ActionIdSchema, 5_000, "Story action refs", 1),
  observableRefs: canonicalReferenceArray(ObservableIdSchema, 10_000, "Story observable refs", 1),
  stateRefs: canonicalReferenceArray(StateIdSchema, 2_000, "Story state refs"),
  persistenceRefs: canonicalReferenceArray(PersistenceIdSchema, 2_000, "Story persistence refs"),
  evidenceRefs: canonicalReferenceArray(EvidenceIdSchema, 5_000, "Story evidence refs", 1),
  ownedPathRefs: canonicalReferenceArray(PathBindingIdSchema, 20_000, "Story owned path refs", 1),
  sharedGrantRefs: canonicalReferenceArray(SharedGrantIdSchema, 20_000, "Story shared-grant refs"),
}).strict().superRefine((value, context) => {
  const expected = hashCanonicalJson({
    routeRefs: value.routeRefs,
    surfaceRefs: value.surfaceRefs,
    controlSlotRefs: value.controlSlotRefs,
    controlRefs: value.controlRefs,
    actionRefs: value.actionRefs,
    observableRefs: value.observableRefs,
    stateRefs: value.stateRefs,
    persistenceRefs: value.persistenceRefs,
    evidenceRefs: value.evidenceRefs,
  });
  if (value.componentHash !== expected) {
    context.addIssue({
      code: "custom",
      path: ["componentHash"],
      message: "Story component hash must bind only its exact canonical semantic partition",
    });
  }
});

export type ProductStoryV2 = z.infer<typeof ProductStoryV2Schema>;

function dependencyCycle(stories: readonly ProductStoryV2[]): string[] | undefined {
  const dependencies = new Map(stories.map((story) => [story.id, story.dependsOn] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const visit = (storyId: string): string[] | undefined => {
    if (visiting.has(storyId)) {
      const start = stack.indexOf(storyId);
      return [...stack.slice(start), storyId];
    }
    if (visited.has(storyId)) return undefined;
    visiting.add(storyId);
    stack.push(storyId);
    for (const dependency of dependencies.get(storyId) ?? []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(storyId);
    visited.add(storyId);
    return undefined;
  };

  for (const story of stories) {
    const cycle = visit(story.id);
    if (cycle) return cycle;
  }
  return undefined;
}

const PartitionedReferenceFieldSchema = z.enum([
  "routeRefs",
  "surfaceRefs",
  "controlSlotRefs",
  "controlRefs",
  "actionRefs",
  "observableRefs",
  "stateRefs",
  "persistenceRefs",
  "evidenceRefs",
  "ownedPathRefs",
  "sharedGrantRefs",
]);

type PartitionedReferenceField = z.infer<typeof PartitionedReferenceFieldSchema>;

export const StoryPlanV2Schema = z.object({
  schema: z.literal("setfarm.story-plan.v2"),
  productSpecHash: Sha256Schema,
  designSourceKind: z.enum(["none", "stitch"]),
  designGraphHash: Sha256Schema.nullable(),
  buildTopologyHash: Sha256Schema,
  partitionHash: Sha256Schema,
  stories: z.array(ProductStoryV2Schema).min(1).max(5_000),
  cardinality: z.object({
    stories: z.number().int().positive().max(5_000),
    routes: z.number().int().positive().max(5_000),
    surfaces: z.number().int().positive().max(10_000),
    controlSlots: z.number().int().nonnegative().max(50_000),
    physicalControls: z.number().int().nonnegative().max(50_000),
    actions: z.number().int().positive().max(10_000),
    observables: z.number().int().positive().max(50_000),
    states: z.number().int().nonnegative().max(10_000),
    persistencePolicies: z.number().int().nonnegative().max(10_000),
    requiredEvidence: z.number().int().positive().max(50_000),
    ownedPaths: z.number().int().positive().max(100_000),
    sharedGrants: z.number().int().nonnegative().max(100_000),
  }).strict(),
}).strict().superRefine((value, context) => {
  if ((value.designSourceKind === "stitch") !== (value.designGraphHash !== null)) {
    context.addIssue({
      code: "custom",
      path: ["designGraphHash"],
      message: "StoryPlan must bind DesignInteractionGraphV2 exactly for Stitch design authority",
    });
  }

  if (value.partitionHash !== hashCanonicalJson(value.stories)) {
    context.addIssue({
      code: "custom",
      path: ["partitionHash"],
      message: "StoryPlan partition hash must bind the exact canonical story array",
    });
  }

  const storyIds = value.stories.map((story) => story.id);
  const ownerRefs = value.stories.map((story) => story.ownerRef);
  if (!hasUniqueStrings(storyIds)) {
    context.addIssue({ code: "custom", path: ["stories"], message: "Story IDs must be unique" });
  }
  if (!hasUniqueStrings(ownerRefs)) {
    context.addIssue({ code: "custom", path: ["stories"], message: "Story owner refs must be unique" });
  }
  value.stories.forEach((story, index) => {
    if (story.order !== index + 1) {
      context.addIssue({
        code: "custom",
        path: ["stories", index, "order"],
        message: "Story order must be contiguous and equal canonical array position",
      });
    }
  });

  const storyById = new Map(value.stories.map((story) => [story.id, story] as const));
  value.stories.forEach((story, storyIndex) => {
    story.dependsOn.forEach((dependency, dependencyIndex) => {
      const target = storyById.get(dependency);
      if (!target) {
        context.addIssue({
          code: "custom",
          path: ["stories", storyIndex, "dependsOn", dependencyIndex],
          message: `Story dependency does not resolve: ${dependency}`,
        });
      } else if (target.order >= story.order) {
        context.addIssue({
          code: "custom",
          path: ["stories", storyIndex, "dependsOn", dependencyIndex],
          message: `Story dependency ${dependency} must precede ${story.id}`,
        });
      }
    });
  });

  const cycle = dependencyCycle(value.stories);
  if (cycle) {
    context.addIssue({
      code: "custom",
      path: ["stories"],
      message: `Story dependency cycle: ${cycle.join(" -> ")}`,
    });
  }

  const totalControlSlots = value.stories.reduce(
    (total, story) => total + story.controlSlotRefs.length,
    0,
  );
  const totalControls = value.stories.reduce(
    (total, story) => total + story.controlRefs.length,
    0,
  );
  if (value.designSourceKind === "none" && totalControls !== 0) {
    context.addIssue({
      code: "custom",
      path: ["stories"],
      message: "A no-design StoryPlan cannot claim physical design controls",
    });
  }
  if (value.designSourceKind === "stitch") {
    if (totalControls !== totalControlSlots) {
      context.addIssue({
        code: "custom",
        path: ["stories"],
        message: "A Stitch StoryPlan requires exactly one physical control for every ProductSpec control slot",
      });
    }
    value.stories.forEach((story, storyIndex) => {
      if (story.controlRefs.length !== story.controlSlotRefs.length) {
        context.addIssue({
          code: "custom",
          path: ["stories", storyIndex, "controlRefs"],
          message: "Control slots and physical controls must remain in the same exact story component",
        });
      }
    });
  }

  const partitionedFields = PartitionedReferenceFieldSchema.options as readonly PartitionedReferenceField[];
  for (const field of partitionedFields) {
    const owners = new Map<string, string[]>();
    value.stories.forEach((story) => {
      story[field].forEach((reference) => {
        const current = owners.get(reference) ?? [];
        current.push(story.id);
        owners.set(reference, current);
      });
    });
    for (const [reference, storyOwners] of owners) {
      if (storyOwners.length <= 1) continue;
      context.addIssue({
        code: "custom",
        path: ["stories"],
        message: `${field} reference ${reference} has multiple owners: ${storyOwners.join(", ")}`,
      });
    }
  }

  const expectedCardinality = {
    stories: value.stories.length,
    routes: value.stories.reduce((total, story) => total + story.routeRefs.length, 0),
    surfaces: value.stories.reduce((total, story) => total + story.surfaceRefs.length, 0),
    controlSlots: totalControlSlots,
    physicalControls: totalControls,
    actions: value.stories.reduce((total, story) => total + story.actionRefs.length, 0),
    observables: value.stories.reduce((total, story) => total + story.observableRefs.length, 0),
    states: value.stories.reduce((total, story) => total + story.stateRefs.length, 0),
    persistencePolicies: value.stories.reduce(
      (total, story) => total + story.persistenceRefs.length,
      0,
    ),
    requiredEvidence: value.stories.reduce((total, story) => total + story.evidenceRefs.length, 0),
    ownedPaths: value.stories.reduce((total, story) => total + story.ownedPathRefs.length, 0),
    sharedGrants: value.stories.reduce((total, story) => total + story.sharedGrantRefs.length, 0),
  };
  if (hashCanonicalJson(value.cardinality) !== hashCanonicalJson(expectedCardinality)) {
    context.addIssue({
      code: "custom",
      path: ["cardinality"],
      message: "StoryPlan cardinality must exactly describe every closed canonical reference collection",
    });
  }
});

export type StoryPlanV2 = z.infer<typeof StoryPlanV2Schema>;
