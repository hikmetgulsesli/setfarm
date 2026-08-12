import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import {
  BuildTopologyV1Schema,
  type BuildTopologyV1,
} from "../schemas/build-topology-v1.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import { DesignInteractionGraphV2Schema } from "../schemas/design-interaction-graph-v2.js";
import { ProductSpecV2Schema } from "../schemas/product-spec-v2.js";
import {
  StoryPlanV2Schema,
  type StoryPlanV2,
} from "../schemas/story-plan-v2.js";
import {
  produceStoryDefinitionsV2,
  type ProductStoryDefinitionV2,
} from "./story-definitions-v2.js";

const StoryPlanProducerInputV2Schema = z.object({
  productSpec: ProductSpecV2Schema,
  designGraph: DesignInteractionGraphV2Schema.nullable().optional(),
  buildTopology: BuildTopologyV1Schema,
}).strict();

export type StoryPlanProducerResultV2 =
  | Readonly<{
      status: "produced";
      storyPlan: StoryPlanV2;
      diagnostics: readonly [];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function diagnostic(input: {
  code: string;
  message: string;
  reference?: string;
  category?: CompilationDiagnosticV1["category"];
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: input.category ?? "contract",
    severity: "error",
    message: input.message.slice(0, 2_000),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: readonly CompilationDiagnosticV1[]): StoryPlanProducerResultV2 {
  const sorted = sortCompilationDiagnostics(diagnostics).slice(0, 10_000);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

function exactSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
}

function topologyDiagnostics(input: {
  stories: readonly ProductStoryDefinitionV2[];
  topology: BuildTopologyV1;
  routeRefs: readonly string[];
  entryRouteRefs: readonly string[];
  requiredCapabilities: readonly { evidenceRef: string; capabilityRef: string }[];
}): CompilationDiagnosticV1[] {
  const diagnostics: CompilationDiagnosticV1[] = [];
  const storyIds = input.stories.map((story) => story.id);
  const storyOwners = input.topology.owners.filter((owner) => owner.kind === "story");
  if (!exactSet(storyIds, storyOwners.map((owner) => owner.storyRef))) {
    diagnostics.push(diagnostic({
      code: "STORY_PLAN_V2_TOPOLOGY_OWNER_SET_MISMATCH",
      message: "BuildTopology story owners must exactly equal the deterministic v2 semantic components",
    }));
  }
  const ownerByStory = new Map(storyOwners.map((owner) => [owner.storyRef, owner] as const));
  input.stories.forEach((story) => {
    const owner = ownerByStory.get(story.id);
    if (!owner) return;
    if (!input.topology.pathBindings.some((path) => path.ownerRef === owner.id)) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_V2_OWNED_PATH_MISSING",
        message: `Story ${story.id} topology owner ${owner.id} has no exact owned path`,
        reference: owner.id,
      }));
    }
  });

  const pathById = new Map(input.topology.pathBindings.map((path) => [path.id, path] as const));
  input.topology.sharedGrants.forEach((grant) => {
    grant.pathRefs.forEach((pathRef) => {
      const path = pathById.get(pathRef);
      if (path && path.ownerRef !== grant.fromOwnerRef) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_V2_GRANT_SOURCE_PATH_OWNER_MISMATCH",
          message: `Grant ${grant.id} path ${pathRef} is not owned by ${grant.fromOwnerRef}`,
          reference: grant.id,
        }));
      }
    });
  });

  const storyByOwner = new Map(storyOwners.map((owner) => [owner.id, owner.storyRef] as const));
  const orderByStory = new Map(input.stories.map((story) => [story.id, story.order] as const));
  input.topology.sharedGrants.forEach((grant) => {
    const fromStory = storyByOwner.get(grant.fromOwnerRef);
    const toStory = storyByOwner.get(grant.toOwnerRef);
    if (
      fromStory
      && toStory
      && orderByStory.get(fromStory)! >= orderByStory.get(toStory)!
    ) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_V2_GRANT_ORDER_CONFLICT",
        message: `Grant ${grant.id} requires later-or-equal story ${fromStory} before ${toStory}`,
        reference: grant.id,
      }));
    }
  });

  const routeSet = new Set(input.routeRefs);
  input.topology.entrypoints.forEach((entrypoint) => {
    entrypoint.routeRefs.forEach((routeRef) => {
      if (!routeSet.has(routeRef)) {
        diagnostics.push(diagnostic({
          code: "STORY_PLAN_V2_ENTRYPOINT_ROUTE_UNRESOLVED",
          category: "link",
          message: `Entrypoint ${entrypoint.id} references absent ProductSpec route ${routeRef}`,
          reference: routeRef,
        }));
      }
    });
  });
  input.entryRouteRefs.forEach((routeRef) => {
    if (!input.topology.entrypoints.some((entrypoint) => entrypoint.routeRefs.includes(routeRef))) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_V2_ENTRY_ROUTE_UNREACHABLE",
        category: "link",
        message: `Entry route ${routeRef} is absent from every exact BuildTopology entrypoint`,
        reference: routeRef,
      }));
    }
  });

  const capabilityById = new Map(input.topology.capabilities.map((capability) =>
    [capability.id, capability] as const));
  input.requiredCapabilities.forEach(({ evidenceRef, capabilityRef }) => {
    if (!capabilityById.get(capabilityRef)?.enabled) {
      diagnostics.push(diagnostic({
        code: "STORY_PLAN_V2_EVIDENCE_CAPABILITY_UNAVAILABLE",
        category: "link",
        message: `Required evidence ${evidenceRef} needs absent or disabled capability ${capabilityRef}`,
        reference: capabilityRef,
      }));
    }
  });
  return diagnostics;
}

function deterministicDependencies(
  story: ProductStoryDefinitionV2,
  topology: BuildTopologyV1,
): string[] {
  const storyOwners = topology.owners.filter((owner) => owner.kind === "story");
  const ownerByStory = new Map(storyOwners.map((owner) => [owner.storyRef, owner.id] as const));
  const storyByOwner = new Map(storyOwners.map((owner) => [owner.id, owner.storyRef] as const));
  const ownerRef = ownerByStory.get(story.id);
  if (!ownerRef) return [];
  return uniqueSorted(topology.sharedGrants.flatMap((grant) => {
    if (grant.toOwnerRef !== ownerRef) return [];
    const sourceStory = storyByOwner.get(grant.fromOwnerRef);
    return sourceStory ? [sourceStory] : [];
  }));
}

function projectStoryPlan(input: {
  productSpec: z.infer<typeof ProductSpecV2Schema>;
  designGraph: z.infer<typeof DesignInteractionGraphV2Schema> | null;
  buildTopology: BuildTopologyV1;
  stories: readonly ProductStoryDefinitionV2[];
}): StoryPlanV2 | undefined {
  const ownerByStory = new Map(
    input.buildTopology.owners
      .filter((owner) => owner.kind === "story")
      .map((owner) => [owner.storyRef, owner.id] as const),
  );
  const stories = input.stories.map((story) => {
    const ownerRef = ownerByStory.get(story.id)!;
    const { componentHash, ...semantic } = story;
    return {
      ...semantic,
      componentHash,
      ownerRef,
      dependsOn: deterministicDependencies(story, input.buildTopology),
      ownedPathRefs: input.buildTopology.pathBindings
        .filter((path) => path.ownerRef === ownerRef)
        .map((path) => path.id)
        .sort(compareUtf16),
      sharedGrantRefs: input.buildTopology.sharedGrants
        .filter((grant) => grant.toOwnerRef === ownerRef)
        .map((grant) => grant.id)
        .sort(compareUtf16),
    };
  }).sort((left, right) => left.order - right.order || compareUtf16(left.id, right.id));
  const cardinality = {
    stories: stories.length,
    routes: stories.reduce((total, story) => total + story.routeRefs.length, 0),
    surfaces: stories.reduce((total, story) => total + story.surfaceRefs.length, 0),
    controlSlots: stories.reduce((total, story) => total + story.controlSlotRefs.length, 0),
    physicalControls: stories.reduce((total, story) => total + story.controlRefs.length, 0),
    actions: stories.reduce((total, story) => total + story.actionRefs.length, 0),
    observables: stories.reduce((total, story) => total + story.observableRefs.length, 0),
    states: stories.reduce((total, story) => total + story.stateRefs.length, 0),
    persistencePolicies: stories.reduce((total, story) => total + story.persistenceRefs.length, 0),
    requiredEvidence: stories.reduce((total, story) => total + story.evidenceRefs.length, 0),
    ownedPaths: stories.reduce((total, story) => total + story.ownedPathRefs.length, 0),
    sharedGrants: stories.reduce((total, story) => total + story.sharedGrantRefs.length, 0),
  };
  const candidate = StoryPlanV2Schema.safeParse({
    schema: "setfarm.story-plan.v2",
    productSpecHash: hashCanonicalJson(input.productSpec),
    designSourceKind: input.designGraph ? "stitch" : "none",
    designGraphHash: input.designGraph ? hashCanonicalJson(input.designGraph) : null,
    buildTopologyHash: hashCanonicalJson(input.buildTopology),
    partitionHash: hashCanonicalJson(stories),
    stories,
    cardinality,
  });
  return candidate.success ? candidate.data : undefined;
}

/** Direct v2 compiler: caller-supplied story prose or v1 story artifacts are never accepted. */
export function produceStoryPlanV2(input: unknown): StoryPlanProducerResultV2 {
  const parsed = StoryPlanProducerInputV2Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 200).map((issue) => diagnostic({
      code: "STORY_PLAN_V2_INPUT_INVALID",
      category: "configuration",
      message: `StoryPlanV2 input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }
  const designGraph = parsed.data.designGraph ?? null;
  const definitions = produceStoryDefinitionsV2({
    productSpec: parsed.data.productSpec,
    designGraph,
  });
  if (definitions.status === "rejected") return definitions;

  const requiredEvidence = parsed.data.productSpec.evidencePredicates.filter((predicate) =>
    predicate.required);
  const diagnostics = topologyDiagnostics({
    stories: definitions.stories,
    topology: parsed.data.buildTopology,
    routeRefs: parsed.data.productSpec.routes.map((route) => route.id),
    entryRouteRefs: parsed.data.productSpec.routes.filter((route) => route.entry)
      .map((route) => route.id),
    requiredCapabilities: requiredEvidence.flatMap((predicate) =>
      predicate.capabilityRefs.map((capabilityRef) => ({
        evidenceRef: predicate.id,
        capabilityRef,
      }))),
  });
  if (diagnostics.length > 0) return reject(diagnostics);

  const storyPlan = projectStoryPlan({
    productSpec: definitions.productSpec,
    designGraph: definitions.designGraph,
    buildTopology: parsed.data.buildTopology,
    stories: definitions.stories,
  });
  if (!storyPlan) {
    return reject([diagnostic({
      code: "STORY_PLAN_V2_OUTPUT_INVALID",
      message: "Produced StoryPlanV2 failed its closed canonical schema",
    })]);
  }
  return { status: "produced", storyPlan, diagnostics: [] };
}
