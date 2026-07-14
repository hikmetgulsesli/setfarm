import {
  hashCanonicalJson,
} from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignGenerationTargetsV1Schema,
  StitchBatchResponseV1Schema,
  StitchTargetResponseBindingsV1Schema,
  type DesignGenerationTargetsV1,
  type StitchBatchResponseV1,
  type StitchTargetResponseBindingsV1,
} from "../schemas/design-generation-targets-v1.js";
import {
  ProductSpecV1Schema,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";

type Rejected = Readonly<{
  status: "rejected";
  rejectionCodes: string[];
  diagnostics: CompilationDiagnosticV1[];
}>;

export type GenerationTargetsResult =
  | Readonly<{
      status: "produced";
      generationTargets: DesignGenerationTargetsV1;
      diagnostics: readonly [];
    }>
  | Rejected;

export type StitchTargetBindingResult =
  | Readonly<{
      status: "produced";
      responseBindings: StitchTargetResponseBindingsV1;
      diagnostics: readonly [];
    }>
  | Rejected;

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function diagnostic(
  code: string,
  message: string,
  reference?: string,
): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code,
    category: "link",
    severity: "error",
    message: message.slice(0, 2_000),
    ...(reference ? { reference: reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: [],
  });
}

function reject(diagnostics: CompilationDiagnosticV1[]): Rejected {
  const sorted = sortCompilationDiagnostics(diagnostics);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.map((item) => item.code)),
    diagnostics: sorted,
  };
}

function targetSuffix(surfaceRef: string): string {
  return surfaceRef.replace(/^SURF_/, "");
}

function visibleActionRefs(productSpec: ProductSpecV1, surfaceRef: string): string[] {
  return productSpec.actions
    .filter((action) => action.surfaceRefs.includes(surfaceRef))
    .filter((action) => action.trigger.kind === "user" || action.trigger.kind === "route")
    .map((action) => action.id)
    .sort(compareUtf16);
}

function visibleActionInputs(productSpec: ProductSpecV1, surfaceRef: string) {
  return productSpec.actions
    .filter((action) => action.surfaceRefs.includes(surfaceRef))
    .filter((action) => action.trigger.kind === "user" || action.trigger.kind === "route")
    .filter((action) => action.input.fields.length > 0)
    .map((action) => ({
      actionRef: action.id,
      inputFields: action.input.fields.map((field) => field.name).sort(compareUtf16),
    }))
    .sort((left, right) => compareUtf16(left.actionRef, right.actionRef));
}

function visibleObservableSelectors(productSpec: ProductSpecV1, surfaceRef: string) {
  return productSpec.actions
    .filter((action) => action.surfaceRefs.includes(surfaceRef))
    .flatMap((action) => (action.observableEffects ?? []).flatMap((effect) => {
      const belongsToSurface = effect.selector.kind === "surface"
        || effect.selector.kind === "accessibility"
        ? effect.selector.surfaceRef === surfaceRef
        : true;
      return belongsToSurface ? [{
        observableRef: effect.id,
        actionRef: action.id,
        selector: effect.selector,
      }] : [];
    }))
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef));
}

/**
 * Creates the immutable request side of the Stitch join. Screen titles and
 * semantic refs come only from ProductSpec; no generated title/token matching
 * participates in target identity.
 */
export function produceDesignGenerationTargetsV1(input: unknown): GenerationTargetsResult {
  const parsed = ProductSpecV1Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_PRODUCT_SPEC_INVALID",
      `ProductSpec failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  const productSpec = parsed.data;
  const targets = productSpec.surfaces
    .map((surface) => {
      const suffix = targetSuffix(surface.id);
      const expectedScreenTitle = `${surface.name} - ${productSpec.product.name}`;
      const requiredObservableSelectors = visibleObservableSelectors(productSpec, surface.id);
      return {
        targetId: `TARGET_${suffix}`,
        designSurfaceId: `DSURF_${suffix}`,
        surfaceRef: surface.id,
        requestScreenKey: expectedScreenTitle,
        expectedScreenTitle,
        requiredActionRefs: visibleActionRefs(productSpec, surface.id),
        requiredActionInputs: visibleActionInputs(productSpec, surface.id),
        ...(requiredObservableSelectors.length > 0 ? { requiredObservableSelectors } : {}),
      };
    })
    .sort((left, right) => compareUtf16(left.targetId, right.targetId));

  const candidate = DesignGenerationTargetsV1Schema.safeParse({
    schema: "setfarm.design-generation-targets.v1",
    productSpecHash: hashCanonicalJson(productSpec),
    targets,
  });
  if (!candidate.success) {
    return reject(candidate.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGETS_OUTPUT_INVALID",
      `Generation targets failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  return { status: "produced", generationTargets: candidate.data, diagnostics: [] };
}

/**
 * Binds only screens returned by the exact batch call that owned a target.
 * Titles are compared byte-for-byte. Existing project screens, manifest order,
 * token overlap, and fuzzy name similarity are deliberately absent.
 */
export function bindExactStitchTargetResponsesV1(input: Readonly<{
  generationTargets: unknown;
  batches: readonly unknown[];
}>): StitchTargetBindingResult {
  const targetsResult = DesignGenerationTargetsV1Schema.safeParse(input.generationTargets);
  if (!targetsResult.success) {
    return reject(targetsResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_BIND_INPUT_INVALID",
      `Generation targets failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  const batchesResult = StitchBatchResponseV1Schema.array().min(1).max(1_000).safeParse(input.batches);
  if (!batchesResult.success) {
    return reject(batchesResult.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_BATCH_RESPONSE_INVALID",
      `Stitch batch response failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  const generationTargets = targetsResult.data;
  const batches = batchesResult.data;
  const diagnostics: CompilationDiagnosticV1[] = [];
  const targetById = new Map(generationTargets.targets.map((target) => [target.targetId, target]));
  const ownedTargetRefs = batches.flatMap((batch) => batch.targetRefs);
  const seenOwnedTargets = new Set<string>();
  for (const targetRef of ownedTargetRefs) {
    if (!targetById.has(targetRef)) {
      diagnostics.push(diagnostic(
        "DESIGN_BATCH_TARGET_UNRESOLVED",
        `Batch response owns absent generation target ${targetRef}`,
        targetRef,
      ));
    }
    if (seenOwnedTargets.has(targetRef)) {
      diagnostics.push(diagnostic(
        "DESIGN_BATCH_TARGET_DUPLICATE",
        `Generation target ${targetRef} appears in multiple batch responses`,
        targetRef,
      ));
    }
    seenOwnedTargets.add(targetRef);
  }
  for (const target of generationTargets.targets) {
    if (!seenOwnedTargets.has(target.targetId)) {
      diagnostics.push(diagnostic(
        "DESIGN_BATCH_TARGET_MISSING",
        `Generation target ${target.targetId} has no owning batch response`,
        target.targetId,
      ));
    }
  }

  const globalScreenIds = new Set<string>();
  const globalScreenTitles = new Set<string>();
  const bindings: StitchTargetResponseBindingsV1["bindings"] = [];
  for (const batch of batches) {
    const stageTargets = batch.targetRefs.flatMap((targetRef) => {
      const target = targetById.get(targetRef);
      return target ? [target] : [];
    });
    const stageTargetByTitle = new Map(stageTargets.map((target) => [target.expectedScreenTitle, target]));
    for (const screen of batch.screens) {
      if (globalScreenIds.has(screen.screenId)) {
        diagnostics.push(diagnostic(
          "DESIGN_RESPONSE_SCREEN_ID_DUPLICATE",
          `Stitch screen ID ${screen.screenId} appears in multiple direct batch responses`,
          screen.screenId,
        ));
      }
      globalScreenIds.add(screen.screenId);
      if (globalScreenTitles.has(screen.title)) {
        diagnostics.push(diagnostic(
          "DESIGN_RESPONSE_TITLE_DUPLICATE",
          `Stitch title ${JSON.stringify(screen.title)} appears in multiple direct batch responses`,
          screen.title,
        ));
      }
      globalScreenTitles.add(screen.title);

      const target = stageTargetByTitle.get(screen.title);
      if (!target) {
        diagnostics.push(diagnostic(
          "DESIGN_RESPONSE_UNEXPECTED",
          `Direct Stitch batch ${batch.stageId} returned unexpected title ${JSON.stringify(screen.title)}`,
          screen.screenId,
        ));
        continue;
      }
      bindings.push({
        targetRef: target.targetId,
        requestScreenKey: target.requestScreenKey,
        expectedScreenTitle: target.expectedScreenTitle,
        responseScreenId: screen.screenId,
        responseTitle: screen.title,
        stageId: batch.stageId,
      });
    }
    for (const target of stageTargets) {
      const exactMatches = batch.screens.filter((screen) => screen.title === target.expectedScreenTitle);
      if (exactMatches.length === 0) {
        diagnostics.push(diagnostic(
          "DESIGN_RESPONSE_MISSING",
          `Direct Stitch batch ${batch.stageId} did not return exact title ${JSON.stringify(target.expectedScreenTitle)}`,
          target.targetId,
        ));
      } else if (exactMatches.length > 1) {
        diagnostics.push(diagnostic(
          "DESIGN_RESPONSE_AMBIGUOUS",
          `Direct Stitch batch ${batch.stageId} returned exact title ${JSON.stringify(target.expectedScreenTitle)} more than once`,
          target.targetId,
        ));
      }
    }
  }

  if (diagnostics.length > 0) return reject(diagnostics);
  const candidate = StitchTargetResponseBindingsV1Schema.safeParse({
    schema: "setfarm.stitch-target-response-bindings.v1",
    generationTargetsHash: hashCanonicalJson(generationTargets),
    bindings: bindings.sort((left, right) => compareUtf16(left.targetRef, right.targetRef)),
  });
  if (!candidate.success) {
    return reject(candidate.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_RESPONSE_BINDINGS_OUTPUT_INVALID",
      `Stitch response bindings failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }
  return { status: "produced", responseBindings: candidate.data, diagnostics: [] };
}

export type { StitchBatchResponseV1 };
