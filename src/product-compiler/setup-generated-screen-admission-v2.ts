import { hashCanonicalJson } from "./canonical-json.js";
import { NormalizedRelativeLocatorSchema, StoryIdSchema } from "./schemas/common-v1.js";
import { DesignGenerationTargetsV2Schema } from "./schemas/design-generation-targets-v2.js";
import { StitchScreenIndexV2Schema } from "./schemas/stitch-screen-index-v2.js";
import { StitchTargetResponseBindingsV3Schema } from "./schemas/stitch-target-candidate-selection-v2.js";
import { validateStitchScreenSourceV2 } from "./stitch-screen-source-validator-v2.js";

export type SetupGeneratedScreenTargetV2 = Readonly<{
  storyId: string;
  role: string;
  path: string;
  surfaceId?: string;
  screenId?: string;
  source: string;
  sharedGrantRequestId?: string;
}>;

export type SetupGeneratedScreenSourceV2 = Readonly<{
  locator: string;
  text: string;
}>;

function reject(reason: string): never {
  throw Object.assign(new Error(`SETUP_GENERATED_SCREEN_ADMISSION_REJECTED: ${reason}`), {
    code: "SETUP_GENERATED_SCREEN_ADMISSION_REJECTED",
  });
}

/**
 * Certificate membership requires the exact native projection and one direct
 * story target. The packet compiler independently verifies accepted-attempt,
 * converter, graph, source hash and topology authority; this is not a substitute.
 */
export function admitSetupGeneratedScreenSourcesV2(input: Readonly<{
  screenIndex: unknown;
  generationTargets: unknown;
  responseBindings: unknown;
  sources: readonly SetupGeneratedScreenSourceV2[];
  resolvedTargets: readonly SetupGeneratedScreenTargetV2[];
}>): readonly string[] {
  const indexed = StitchScreenIndexV2Schema.safeParse(input.screenIndex);
  const targets = DesignGenerationTargetsV2Schema.safeParse(input.generationTargets);
  const responses = StitchTargetResponseBindingsV3Schema.safeParse(input.responseBindings);
  if (!indexed.success || !targets.success || !responses.success) {
    reject("Native index, generation targets and response bindings must satisfy their exact schemas");
  }
  if (
    responses.data.generationTargetsHash !== hashCanonicalJson(targets.data)
    || indexed.data.length !== targets.data.targets.length
    || indexed.data.length !== responses.data.bindings.length
    || indexed.data.length !== input.sources.length
  ) {
    reject("Index, source and response sets must exactly cover the bound generation targets");
  }

  const targetById = new Map(targets.data.targets.map((target) => [target.targetId, target] as const));
  const responseByTarget = new Map(responses.data.bindings.map((binding) => [binding.targetRef, binding] as const));
  const sourceByLocator = new Map<string, SetupGeneratedScreenSourceV2>();
  for (const source of input.sources) {
    if (
      !NormalizedRelativeLocatorSchema.safeParse(source.locator).success
      || typeof source.text !== "string"
      || sourceByLocator.has(source.locator)
    ) {
      reject("Generated source locators must be normalized, exact and unique");
    }
    sourceByLocator.set(source.locator, source);
  }

  const admitted: string[] = [];
  for (const screen of indexed.data) {
    const target = targetById.get(screen.projection.targetRef);
    const binding = responseByTarget.get(screen.projection.targetRef);
    const source = sourceByLocator.get(screen.file);
    if (
      !target
      || !binding
      || !source
      || binding.targetHash !== hashCanonicalJson(target)
      || binding.requestScreenKey !== target.requestScreenKey
      || binding.expectedScreenTitle !== target.expectedScreenTitle
      || binding.responseTitle !== target.expectedScreenTitle
      || screen.screenId !== binding.responseScreenId
      || screen.title !== binding.responseTitle
    ) {
      reject("Each indexed source must have one exact target hash, request, response screen and title");
    }
    const expectedSurfaces = [target.surfaceRef, ...target.containedSurfaceRefs].sort();
    const boundSurfaces = binding.surfaceBindings.map((surface) => surface.surfaceRef).sort();
    if (
      expectedSurfaces.length !== boundSurfaces.length
      || expectedSurfaces.some((surface, index) => surface !== boundSurfaces[index])
    ) {
      reject("Response surfaces must exactly preserve the target root and contained surfaces");
    }
    if (
      [...screen.controls, ...screen.observables, ...screen.rejectedControls].some((entry) =>
        entry.generatedSourceLocator !== screen.file)
    ) {
      reject("Indexed elements must identify the same exact generated source");
    }
    const validation = validateStitchScreenSourceV2({
      screen, sourceText: source.text, surfaceBindings: binding.surfaceBindings,
    });
    if (validation.status !== "valid") {
      reject("Generated source does not satisfy its exact indexed source and surface contract");
    }
    const pathTargets = input.resolvedTargets.filter((candidate) => candidate.path === screen.file);
    const owner = pathTargets[0];
    if (
      pathTargets.length !== 1
      || !owner
      || owner.role !== "surface_component"
      || owner.surfaceId !== target.surfaceRef
      || owner.screenId !== binding.responseScreenId
      || owner.source !== "scope_target"
      || owner.sharedGrantRequestId !== undefined
      || !StoryIdSchema.safeParse(owner.storyId).success
    ) {
      reject("Generated source requires one exact surface/root/screen path binding with a direct story owner");
    }
    admitted.push(screen.file);
  }
  return admitted.sort();
}
