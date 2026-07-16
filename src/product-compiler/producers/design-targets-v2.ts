import { hashCanonicalJson } from "../canonical-json.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignGenerationTargetsV2Schema,
  type DesignGenerationTargetsV2,
  type RequiredObservableSelectorV2,
} from "../schemas/design-generation-targets-v2.js";
import {
  ProductSpecV2Schema,
  type ProductActionV2,
  type ProductSpecV2,
} from "../schemas/product-spec-v2.js";

type Rejected = Readonly<{
  status: "rejected";
  rejectionCodes: string[];
  diagnostics: CompilationDiagnosticV1[];
}>;

export type GenerationTargetsV2Result =
  | Readonly<{
      status: "produced";
      generationTargets: DesignGenerationTargetsV2;
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

function observableSurfaceRef(
  action: ProductActionV2,
  observable: ProductActionV2["observableEffects"][number],
): string {
  const selector = observable.selector;
  if (selector.kind !== "control") return selector.surfaceRef;
  const placement = action.controlPlacements.find((candidate) =>
    candidate.id === selector.controlSlotRef);
  if (!placement) {
    throw new Error(
      `DESIGN_TARGET_V2_INTERNAL_CONTROL_SLOT_UNRESOLVED: ${selector.controlSlotRef}`,
    );
  }
  return placement.surfaceRef;
}

function requiredObservableSelectors(
  productSpec: ProductSpecV2,
  targetSurfaceRefs: ReadonlySet<string>,
): RequiredObservableSelectorV2[] {
  return productSpec.actions.flatMap((action) =>
    action.observableEffects.flatMap((observable) =>
      targetSurfaceRefs.has(observableSurfaceRef(action, observable))
        ? [{
            observableRef: observable.id,
            actionRef: action.id,
            selector: observable.selector,
            assertions: observable.assertions,
          }]
        : []))
    .sort((left, right) => compareUtf16(left.observableRef, right.observableRef));
}

/**
 * Compiles one immutable Stitch request target per ProductSpec route-root
 * surface. Affected surfaces provide action context only; only explicit
 * control placements become required rendered controls.
 */
export function produceDesignGenerationTargetsV2(input: unknown): GenerationTargetsV2Result {
  const parsed = ProductSpecV2Schema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_V2_PRODUCT_SPEC_INVALID",
      `ProductSpec v2 failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  const productSpec = parsed.data;
  const rootSurfaces = productSpec.surfaces
    .filter((surface) => surface.composition.kind === "route_root")
    .sort((left, right) => compareUtf16(left.id, right.id));

  let targets: unknown[];
  try {
    targets = rootSurfaces.map((rootSurface) => {
      const containedSurfaceRefs = productSpec.surfaces
        .filter((surface) => surface.routeRef === rootSurface.routeRef && surface.id !== rootSurface.id)
        .map((surface) => surface.id)
        .sort(compareUtf16);
      const targetSurfaceRefs = new Set([rootSurface.id, ...containedSurfaceRefs]);
      const requiredControlPlacements = productSpec.actions
        .flatMap((action) => action.controlPlacements.flatMap((placement) =>
          targetSurfaceRefs.has(placement.surfaceRef)
            ? [{
                controlSlotRef: placement.id,
                actionRef: action.id,
                surfaceRef: placement.surfaceRef,
                controlHint: placement.controlHint,
                inputFields: action.input.fields.map((field) => field.name).sort(compareUtf16),
              }]
            : []))
        .sort((left, right) => compareUtf16(left.controlSlotRef, right.controlSlotRef));
      const affectingActionRefs = productSpec.actions
        .filter((action) => action.affectedSurfaceRefs.some((surfaceRef) =>
          targetSurfaceRefs.has(surfaceRef)))
        .map((action) => action.id)
        .sort(compareUtf16);
      const expectedScreenTitle = `${rootSurface.name} - ${productSpec.product.name}`;
      const suffix = targetSuffix(rootSurface.id);
      return {
        targetId: `TARGET_${suffix}`,
        designSurfaceId: `DSURF_${suffix}`,
        routeRef: rootSurface.routeRef,
        surfaceRef: rootSurface.id,
        containedSurfaceRefs,
        requestScreenKey: expectedScreenTitle,
        expectedScreenTitle,
        requiredControlPlacements,
        affectingActionRefs,
        requiredObservableSelectors: requiredObservableSelectors(productSpec, targetSurfaceRefs),
      };
    });
  } catch (error) {
    return reject([diagnostic(
      "DESIGN_TARGET_V2_INTERNAL_REFERENCE_INVALID",
      error instanceof Error ? error.message : String(error),
    )]);
  }

  const candidate = DesignGenerationTargetsV2Schema.safeParse({
    schema: "setfarm.design-generation-targets.v2",
    productSpecHash: hashCanonicalJson(productSpec),
    targets,
  });
  if (!candidate.success) {
    return reject(candidate.error.issues.slice(0, 100).map((issue) => diagnostic(
      "DESIGN_TARGET_V2_OUTPUT_INVALID",
      `Generation targets v2 failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      issue.path.join("/") || "$",
    )));
  }

  return { status: "produced", generationTargets: candidate.data, diagnostics: [] };
}
