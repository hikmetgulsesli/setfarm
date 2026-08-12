import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import type { StoryPlanV2 } from "./schemas/story-plan-v2.js";
import { produceStoryPlanV2 } from "./producers/story-plan-v2.js";

export type RuntimeStoryPlanCompilationResultV2 =
  | Readonly<{
      status: "compiled";
      storyPlan: StoryPlanV2;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

/**
 * Clean v2 runtime boundary. It accepts only canonical ProductSpecV2, an
 * optional exact DesignInteractionGraphV2, and BuildTopologyV1; DB stories,
 * v1 plans, and compatibility prose are never inputs.
 */
export function compileRuntimeStoryPlanV2(input: Readonly<{
  productSpec: unknown;
  designGraph?: unknown;
  buildTopology: unknown;
}>): RuntimeStoryPlanCompilationResultV2 {
  const result = produceStoryPlanV2({
    productSpec: input.productSpec,
    ...(input.designGraph === undefined ? {} : { designGraph: input.designGraph }),
    buildTopology: input.buildTopology,
  });
  if (result.status === "rejected") return result;
  return { status: "compiled", storyPlan: result.storyPlan, diagnostics: [] };
}
