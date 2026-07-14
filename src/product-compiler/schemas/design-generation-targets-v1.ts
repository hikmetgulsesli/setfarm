import { z } from "zod";

import {
  ActionIdSchema,
  DesignSurfaceIdSchema,
  ObservableIdSchema,
  Sha256Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ObservableSelectorV1Schema } from "./product-spec-v1.js";

export const GenerationTargetIdSchema = z
  .string()
  .min(8)
  .max(160)
  .regex(/^TARGET_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

export const DesignGenerationTargetV1Schema = z
  .object({
    targetId: GenerationTargetIdSchema,
    designSurfaceId: DesignSurfaceIdSchema,
    surfaceRef: SurfaceIdSchema,
    requestScreenKey: z.string().min(1).max(500),
    expectedScreenTitle: z.string().min(1).max(500),
    requiredActionRefs: z.array(ActionIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Generation target action refs must be unique",
    }),
    requiredActionInputs: z.array(z.object({
      actionRef: ActionIdSchema,
      inputFields: z.array(z.string().min(1).max(160)).min(1).max(500).refine(hasUniqueStrings, {
        message: "Generation target input fields must be unique",
      }),
    }).strict()).max(500),
    requiredObservableSelectors: z.array(z.object({
      observableRef: ObservableIdSchema,
      actionRef: ActionIdSchema,
      selector: ObservableSelectorV1Schema,
    }).strict()).max(2_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.requiredActionInputs.map((item) => item.actionRef))) {
      context.addIssue({
        code: "custom",
        path: ["requiredActionInputs"],
        message: "Generation target input action refs must be unique",
      });
    }
    value.requiredActionInputs.forEach((input, index) => {
      if (!value.requiredActionRefs.includes(input.actionRef)) {
        context.addIssue({
          code: "custom",
          path: ["requiredActionInputs", index, "actionRef"],
          message: "Generation target input action must be declared in requiredActionRefs",
        });
      }
    });
    const observableSelectors = value.requiredObservableSelectors ?? [];
    if (!hasUniqueStrings(observableSelectors.map((item) => item.observableRef))) {
      context.addIssue({
        code: "custom",
        path: ["requiredObservableSelectors"],
        message: "Generation target observable refs must be unique",
      });
    }
    observableSelectors.forEach((observable, index) => {
      if (!value.requiredActionRefs.includes(observable.actionRef)) {
        context.addIssue({
          code: "custom",
          path: ["requiredObservableSelectors", index, "actionRef"],
          message: "Generation target observable action must be declared in requiredActionRefs",
        });
      }
    });
  });

export const DesignGenerationTargetsV1Schema = z
  .object({
    schema: z.literal("setfarm.design-generation-targets.v1"),
    productSpecHash: Sha256Schema,
    targets: z.array(DesignGenerationTargetV1Schema).min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [field, values] of [
      ["targetId", value.targets.map((target) => target.targetId)],
      ["designSurfaceId", value.targets.map((target) => target.designSurfaceId)],
      ["surfaceRef", value.targets.map((target) => target.surfaceRef)],
      ["requestScreenKey", value.targets.map((target) => target.requestScreenKey)],
      ["expectedScreenTitle", value.targets.map((target) => target.expectedScreenTitle)],
    ] as const) {
      if (!hasUniqueStrings(values)) {
        context.addIssue({
          code: "custom",
          path: ["targets"],
          message: `Generation target ${field} values must be unique`,
        });
      }
    }
  });

export type DesignGenerationTargetV1 = z.infer<typeof DesignGenerationTargetV1Schema>;
export type DesignGenerationTargetsV1 = z.infer<typeof DesignGenerationTargetsV1Schema>;

const StitchBatchScreenV1Schema = z
  .object({
    screenId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
  })
  .strict();

export const StitchBatchResponseV1Schema = z
  .object({
    stageId: z.string().min(1).max(160),
    targetRefs: z.array(GenerationTargetIdSchema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Batch target refs must be unique",
    }),
    screens: z.array(StitchBatchScreenV1Schema).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.screens.map((screen) => screen.screenId))) {
      context.addIssue({ code: "custom", path: ["screens"], message: "Batch response screen IDs must be unique" });
    }
    if (!hasUniqueStrings(value.screens.map((screen) => screen.title))) {
      context.addIssue({ code: "custom", path: ["screens"], message: "Batch response titles must be unique" });
    }
  });

export const StitchTargetResponseBindingV1Schema = z
  .object({
    targetRef: GenerationTargetIdSchema,
    requestScreenKey: z.string().min(1).max(500),
    expectedScreenTitle: z.string().min(1).max(500),
    responseScreenId: z.string().min(1).max(500),
    responseTitle: z.string().min(1).max(500),
    stageId: z.string().min(1).max(160),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.responseTitle !== value.expectedScreenTitle) {
      context.addIssue({
        code: "custom",
        path: ["responseTitle"],
        message: "Stitch response title must exactly equal the generation target title",
      });
    }
  });

export const StitchTargetResponseBindingsV1Schema = z
  .object({
    schema: z.literal("setfarm.stitch-target-response-bindings.v1"),
    generationTargetsHash: Sha256Schema,
    bindings: z.array(StitchTargetResponseBindingV1Schema).min(1).max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [field, values] of [
      ["targetRef", value.bindings.map((binding) => binding.targetRef)],
      ["requestScreenKey", value.bindings.map((binding) => binding.requestScreenKey)],
      ["expectedScreenTitle", value.bindings.map((binding) => binding.expectedScreenTitle)],
      ["responseScreenId", value.bindings.map((binding) => binding.responseScreenId)],
    ] as const) {
      if (!hasUniqueStrings(values)) {
        context.addIssue({
          code: "custom",
          path: ["bindings"],
          message: `Stitch target response ${field} values must be unique`,
        });
      }
    }
  });

export type StitchBatchResponseV1 = z.infer<typeof StitchBatchResponseV1Schema>;
export type StitchTargetResponseBindingsV1 = z.infer<typeof StitchTargetResponseBindingsV1Schema>;
