import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import type { DesignInteractionGraphV2 } from "../schemas/design-interaction-graph-v2.js";
import type { ProductSpecV2 } from "../schemas/product-spec-v2.js";
import {
  produceStoryPartitionV2,
  type ProductStoryPartitionV2,
} from "./story-partition-v2.js";

export type ProductStoryDefinitionV2 = ProductStoryPartitionV2 & Readonly<{
  id: string;
  order: number;
  title: string;
  description: string;
}>;

export type StoryDefinitionsResultV2 =
  | Readonly<{
      status: "produced";
      productSpec: ProductSpecV2;
      designGraph: DesignInteractionGraphV2 | null;
      stories: ProductStoryDefinitionV2[];
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

/**
 * Assigns deterministic compatibility IDs and terse non-authoritative prose to
 * the exact v2 semantic components. No story text participates in partitioning.
 */
export function produceStoryDefinitionsV2(input: unknown): StoryDefinitionsResultV2 {
  const partition = produceStoryPartitionV2(input);
  if (partition.status === "rejected") return partition;
  return {
    status: "produced",
    productSpec: partition.productSpec,
    designGraph: partition.designGraph,
    stories: partition.components.map((component, index) => {
      const id = `US-${String(index + 1).padStart(3, "0")}`;
      const actionIdentity = component.actionRefs.join(" + ");
      return {
        ...component,
        id,
        order: index + 1,
        title: `Implement ${actionIdentity}`.slice(0, 500),
        description: (
          `Implement the exact closed ProductSpecV2 semantic component ${component.componentHash} `
          + `for ${component.actionRefs.join(", ")}.`
        ).slice(0, 10_000),
      };
    }),
    diagnostics: [],
  };
}
