import { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import { DesignInteractionGraphV1Schema } from "../schemas/design-interaction-graph-v1.js";
import { ProductSpecV1Schema } from "../schemas/product-spec-v1.js";
import {
  produceStoryPartitionV1,
  type ProductStoryPartitionV1,
} from "./story-partition.js";

const StoryDefinitionsInputSchema = z
  .object({
    productSpec: ProductSpecV1Schema,
    designGraph: DesignInteractionGraphV1Schema,
  })
  .strict();

export type ProductStoryDefinitionV1 = ProductStoryPartitionV1 & Readonly<{
  controlRefs: string[];
}>;

export type StoryDefinitionsResult =
  | Readonly<{
      status: "produced";
      stories: ProductStoryDefinitionV1[];
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

function diagnostic(input: {
  code: string;
  message: string;
  reference?: string;
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "link",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: readonly CompilationDiagnosticV1[]): StoryDefinitionsResult {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: [...new Set(sorted.map((item) => item.code))].sort(),
    diagnostics: sorted,
  };
}

/** Adds exact converter controls to ProductSpec-derived semantic partitions. */
export function produceStoryDefinitionsV1(input: unknown): StoryDefinitionsResult {
  const parsed = StoryDefinitionsInputSchema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "STORY_DEFINITIONS_INPUT_INVALID",
      message: `Typed story-definition input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  const partition = produceStoryPartitionV1({ productSpec: parsed.data.productSpec });
  if (partition.status === "rejected") return partition;

  const storyBySurface = new Map<string, string>();
  partition.stories.forEach((story) =>
    story.surfaceRefs.forEach((surfaceRef) => storyBySurface.set(surfaceRef, story.id)));
  const controlsByStory = new Map<string, string[]>();
  const diagnostics: CompilationDiagnosticV1[] = [];
  parsed.data.designGraph.controls.forEach((control) => {
    const storyId = storyBySurface.get(control.surfaceRef);
    if (!storyId) {
      diagnostics.push(diagnostic({
        code: "STORY_DEFINITIONS_CONTROL_SURFACE_UNOWNED",
        message: `Control ${control.id} surface ${control.surfaceRef} has no semantic story partition`,
        reference: control.id,
      }));
      return;
    }
    const current = controlsByStory.get(storyId) ?? [];
    current.push(control.id);
    controlsByStory.set(storyId, current);
  });
  if (diagnostics.length > 0) return reject(diagnostics);

  return {
    status: "produced",
    stories: partition.stories.map((story) => ({
      ...story,
      controlRefs: [...(controlsByStory.get(story.id) ?? [])],
    })),
    diagnostics: [],
  };
}
