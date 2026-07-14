import { z } from "zod";

import { hashCanonicalJson } from "../../product-compiler/canonical-json.js";

export const RuntimeCompletionContinuationTypeV1Schema = z.enum([
  "story_loop_continue",
  "story_route_verify",
  "story_route_supervise",
  "story_direct_merge",
  "story_qa_fix_merge",
  "single_pipeline_advance",
  "verify_each_decision",
  "supervise_each_decision",
  "failure_finalize",
  "quality_route_finalize",
  "terminal_finalize",
  "canonical_reconcile",
  "legacy_receipt_only",
]);

export const RuntimeCompletionPlanKindV1Schema = z.enum([
  "story_completion",
  "single_completion",
  "loop_failure",
  "single_failure",
  "quality_route",
  "terminal_transition",
  "legacy_recovery",
]);

export const RuntimeCompletionContinuationV1Schema = z.object({
  type: RuntimeCompletionContinuationTypeV1Schema,
  targetStepDbId: z.string().min(1).max(500).optional(),
  targetStepId: z.string().min(1).max(500).optional(),
}).strict();

export const RuntimeCompletionSubjectV1Schema = z.object({
  storyDbId: z.string().min(1).max(500),
  storyId: z.string().min(1).max(500),
  prUrl: z.string().url().max(2_000).optional(),
  sourceSha: z.string().regex(/^[a-f0-9]{40,64}$/).optional(),
}).strict();
export type RuntimeCompletionSubjectV1 = z.infer<typeof RuntimeCompletionSubjectV1Schema>;

export const RuntimeCompletionEffectSpecV1Schema = z.object({
  effectKey: z.string().regex(/^[a-z0-9][a-z0-9._:/-]{0,499}$/),
  ordinal: z.number().int().nonnegative(),
  effectType: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,199}$/),
  mandatory: z.boolean().default(true),
  payload: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const RuntimeCompletionPlanDescriptorV1Schema = z.object({
  kind: RuntimeCompletionPlanKindV1Schema,
  continuation: RuntimeCompletionContinuationV1Schema,
  subject: RuntimeCompletionSubjectV1Schema.optional(),
  effects: z.array(RuntimeCompletionEffectSpecV1Schema).min(1).max(128),
}).strict().superRefine((value, context) => {
  const keys = new Set<string>();
  const ordinals = new Set<number>();
  for (const effect of value.effects) {
    if (keys.has(effect.effectKey)) {
      context.addIssue({ code: "custom", path: ["effects"], message: "duplicate effectKey" });
    }
    if (ordinals.has(effect.ordinal)) {
      context.addIssue({ code: "custom", path: ["effects"], message: "duplicate ordinal" });
    }
    keys.add(effect.effectKey);
    ordinals.add(effect.ordinal);
  }
  const subjectRequired = new Set([
    "story_loop_continue",
    "story_route_verify",
    "story_route_supervise",
    "story_direct_merge",
    "story_qa_fix_merge",
    "verify_each_decision",
    "supervise_each_decision",
  ]).has(value.continuation.type);
  if (subjectRequired && !value.subject) {
    context.addIssue({ code: "custom", path: ["subject"], message: "continuation requires exact story subject" });
  }
  if (value.continuation.type === "story_qa_fix_merge" && !value.subject?.sourceSha) {
    context.addIssue({
      code: "custom",
      path: ["subject", "sourceSha"],
      message: "QA-FIX merge continuation requires an immutable source SHA",
    });
  }
});

export type RuntimeCompletionPlanDescriptorV1 = z.infer<typeof RuntimeCompletionPlanDescriptorV1Schema>;

export function createSingleEffectCompletionPlanDescriptorV1(input: Readonly<{
  kind: z.infer<typeof RuntimeCompletionPlanKindV1Schema>;
  continuation: z.infer<typeof RuntimeCompletionContinuationV1Schema>;
  subject?: z.infer<typeof RuntimeCompletionSubjectV1Schema>;
  effectType?: string;
  effectPayload?: Record<string, unknown>;
}>): RuntimeCompletionPlanDescriptorV1 {
  const identity = input.subject?.storyDbId
    ?? input.continuation.targetStepDbId
    ?? input.continuation.type;
  return RuntimeCompletionPlanDescriptorV1Schema.parse({
    kind: input.kind,
    continuation: input.continuation,
    ...(input.subject ? { subject: input.subject } : {}),
    effects: [{
      effectKey: `continuation/${input.continuation.type}/${identity}`.toLowerCase().replace(/[^a-z0-9._:/-]+/g, "-"),
      ordinal: 0,
      effectType: input.effectType ?? input.continuation.type.replace(/_/g, "."),
      mandatory: true,
      payload: input.effectPayload ?? {},
    }],
  });
}

export const RuntimeCompletionPlanV1Schema = z.object({
  schema: z.literal("setfarm.runtime-completion-plan.v1"),
  planVersion: z.literal(1),
  requestId: z.string().regex(/^RCR_[A-Za-z0-9-]{16,160}$/),
  claimId: z.number().int().positive(),
  runId: z.string().min(1).max(500),
  stepDbId: z.string().min(1).max(500),
  workflowStepId: z.string().min(1).max(500),
  outputHash: z.string().regex(/^[a-f0-9]{64}$/),
  kind: RuntimeCompletionPlanKindV1Schema,
  continuation: RuntimeCompletionContinuationV1Schema,
  subject: RuntimeCompletionSubjectV1Schema.optional(),
  effects: z.array(RuntimeCompletionEffectSpecV1Schema).min(1).max(128),
  preparedAt: z.string().datetime({ offset: true }),
}).strict();

export type RuntimeCompletionPlanV1 = z.infer<typeof RuntimeCompletionPlanV1Schema>;

export const RuntimeCompletionEffectInputV1Schema = z.object({
  schema: z.literal("setfarm.runtime-completion-effect-input.v1"),
  planHash: z.string().regex(/^[a-f0-9]{64}$/),
  plan: RuntimeCompletionPlanV1Schema,
  effect: z.record(z.string(), z.unknown()),
}).strict();

export type RuntimeCompletionEffectInputV1 = z.infer<typeof RuntimeCompletionEffectInputV1Schema>;

export function createRuntimeCompletionPlanV1(input: Readonly<{
  requestId: string;
  claimId: number;
  runId: string;
  stepDbId: string;
  workflowStepId: string;
  outputHash: string;
  descriptor: RuntimeCompletionPlanDescriptorV1;
  preparedAt: Date;
}>): Readonly<{ plan: RuntimeCompletionPlanV1; planHash: string }> {
  const descriptor = RuntimeCompletionPlanDescriptorV1Schema.parse(input.descriptor);
  const plan = RuntimeCompletionPlanV1Schema.parse({
    schema: "setfarm.runtime-completion-plan.v1",
    planVersion: 1,
    requestId: input.requestId,
    claimId: input.claimId,
    runId: input.runId,
    stepDbId: input.stepDbId,
    workflowStepId: input.workflowStepId,
    outputHash: input.outputHash,
    ...descriptor,
    preparedAt: input.preparedAt.toISOString(),
  });
  return Object.freeze({ plan, planHash: hashCanonicalJson(plan) });
}
