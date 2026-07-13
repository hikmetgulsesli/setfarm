import { z } from "zod";

import {
  ActionIdSchema,
  ControlIdSchema,
  EvidenceIdSchema,
  OwnerIdSchema,
  PathBindingIdSchema,
  PersistenceIdSchema,
  SharedGrantIdSchema,
  StateIdSchema,
  StoryIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const ProductStoryV1Schema = z
  .object({
    id: StoryIdSchema,
    order: z.number().int().positive(),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(10_000),
    ownerRef: OwnerIdSchema,
    dependsOn: z.array(StoryIdSchema).max(1_000).refine(hasUniqueStrings, {
      message: "Story dependencies must be unique",
    }),
    surfaceRefs: z.array(SurfaceIdSchema).max(2_000).refine(hasUniqueStrings, {
      message: "Story surface refs must be unique",
    }),
    controlRefs: z.array(ControlIdSchema).max(10_000).refine(hasUniqueStrings, {
      message: "Story control refs must be unique",
    }),
    actionRefs: z.array(ActionIdSchema).min(1).max(5_000).refine(hasUniqueStrings, {
      message: "Story action refs must be unique",
    }),
    stateRefs: z.array(StateIdSchema).max(2_000).refine(hasUniqueStrings, {
      message: "Story state refs must be unique",
    }),
    persistenceRefs: z.array(PersistenceIdSchema).max(2_000).refine(hasUniqueStrings, {
      message: "Story persistence refs must be unique",
    }),
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(5_000).refine(hasUniqueStrings, {
      message: "Story evidence refs must be unique",
    }),
    ownedPathRefs: z.array(PathBindingIdSchema).min(1).max(10_000).refine(hasUniqueStrings, {
      message: "Story owned path refs must be unique",
    }),
    sharedGrantRefs: z.array(SharedGrantIdSchema).max(10_000).refine(hasUniqueStrings, {
      message: "Story shared grant refs must be unique",
    }),
  })
  .strict();

export type ProductStoryV1 = z.infer<typeof ProductStoryV1Schema>;

function cycleFrom(stories: readonly z.infer<typeof ProductStoryV1Schema>[]): string[] | undefined {
  const dependencies = new Map(stories.map((story) => [story.id, story.dependsOn]));
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

export const StoryPlanV1Schema = z
  .object({
    schema: z.literal("setfarm.story-plan.v1"),
    stories: z.array(ProductStoryV1Schema).min(1).max(5_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.stories.map((story) => story.id))) {
      context.addIssue({ code: "custom", path: ["stories"], message: "Story IDs must be unique" });
    }
    if (new Set(value.stories.map((story) => story.order)).size !== value.stories.length) {
      context.addIssue({ code: "custom", path: ["stories"], message: "Story order values must be unique" });
    }

    const storyById = new Map(value.stories.map((story) => [story.id, story]));
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

    const cycle = cycleFrom(value.stories);
    if (cycle) {
      context.addIssue({
        code: "custom",
        path: ["stories"],
        message: `Story dependency cycle: ${cycle.join(" -> ")}`,
      });
    }
  });

export type StoryPlanV1 = z.infer<typeof StoryPlanV1Schema>;
