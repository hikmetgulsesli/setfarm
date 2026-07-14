import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import type { StoryPlanV1 } from "./schemas/story-plan-v1.js";
import { produceStoryDefinitionsV1 } from "./producers/story-definitions.js";
import { produceStoryPlanV1 } from "./producers/story-plan.js";

export type RuntimeStoryPlanCompilationResult =
  | Readonly<{
      status: "compiled";
      storyPlan: StoryPlanV1;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

/**
 * Joins the deterministic ProductSpec partition, exact converter controls and
 * setup topology. This is the only v3 path that produces StoryPlan input; DB
 * story prose is a compatibility projection, never a semantic source.
 */
export function compileRuntimeStoryPlanV1(input: Readonly<{
  productSpec: unknown;
  designGraph: unknown;
  buildTopology: unknown;
}>): RuntimeStoryPlanCompilationResult {
  const definitions = produceStoryDefinitionsV1({
    productSpec: input.productSpec,
    designGraph: input.designGraph,
  });
  if (definitions.status === "rejected") return definitions;
  const storyPlan = produceStoryPlanV1({
    productSpec: input.productSpec,
    designGraph: input.designGraph,
    buildTopology: input.buildTopology,
    stories: definitions.stories,
  });
  if (storyPlan.status === "rejected") return storyPlan;
  return { status: "compiled", storyPlan: storyPlan.storyPlan, diagnostics: [] };
}
