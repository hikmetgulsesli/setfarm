import { createHash } from "node:crypto";
import { z } from "zod";

import {
  StitchAdapterProjectionV1Schema,
  type StitchAdapterProjectionV1,
} from "./adapters/stitch.js";
import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "./diagnostics.js";
import type { CompilationDiagnosticV1 } from "./schemas/compilation-report-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignControlV1,
  type DesignControlBindingV1,
  type DesignInteractionGraphV1,
  type UnresolvedControlBindingV1,
} from "./schemas/design-interaction-graph-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "./schemas/product-spec-v1.js";

const ExactDesignBindingV1Schema = z
  .object({
    controlRef: z.string().min(1).max(160),
    generatedLocalId: z.string().min(1).max(500),
    actionRef: z.string().regex(/^ACT_[A-Z0-9_]+$/),
    sourceKind: z.enum(["structured_index", "same_element", "exact_manifest"]),
  })
  .strict();

export type ExactDesignBindingV1 = z.infer<typeof ExactDesignBindingV1Schema>;

export type DesignLinkResultV1 = Readonly<{
  graph?: DesignInteractionGraphV1;
  exactBindings: ExactDesignBindingV1[];
  diagnostics: CompilationDiagnosticV1[];
}>;

const LinkInputSchema = z
  .object({
    productSpec: ProductSpecV1Schema,
    projection: StitchAdapterProjectionV1Schema,
  })
  .strict();

function diagnostic(input: {
  code: string;
  severity: CompilationDiagnosticV1["severity"];
  message: string;
  artifactHash?: string;
  reference?: string;
  provenance?: CompilationDiagnosticV1["provenance"];
  suggestions?: CompilationDiagnosticV1["suggestions"];
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "link",
    severity: input.severity,
    message: input.message,
    ...(input.artifactHash ? { artifactHash: input.artifactHash } : {}),
    ...(input.reference ? { reference: input.reference } : {}),
    provenance: input.provenance ?? [],
    suggestions: input.suggestions ?? [],
  });
}

function expectedDerivedControlId(control: StitchAdapterProjectionV1["controls"][number]): string {
  const suffix = createHash("sha256")
    .update(`${control.source.artifactHash}\0${control.source.selector}\0${control.kind}`)
    .digest("hex")
    .slice(0, 16);
  return `CTRL_${suffix}`;
}

function accessibilityRole(kind: StitchAdapterProjectionV1["controls"][number]["kind"]): string {
  if (kind === "link") return "link";
  if (["input", "textarea"].includes(kind)) return "textbox";
  if (kind === "select") return "combobox";
  if (kind === "checkbox") return "checkbox";
  if (kind === "radio") return "radio";
  if (kind === "tab") return "tab";
  return "button";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function actionStateRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function actionPersistenceRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function unresolved(
  control: StitchAdapterProjectionV1["controls"][number],
  code: string,
  confidence: "ambiguous" | "missing" | "heuristic_legacy_only",
  candidates: readonly string[] = [],
): UnresolvedControlBindingV1 {
  return {
    controlRef: control.id,
    code,
    provenance: control.provenance,
    suggestions: candidates.map((reference) => ({
      reference,
      reason: "Candidate is diagnostic context and cannot create a semantic binding",
      confidence,
    })),
  };
}

function candidatePriority(sourceKind: ExactDesignBindingV1["sourceKind"]): number {
  if (sourceKind === "structured_index") return 0;
  if (sourceKind === "same_element") return 1;
  return 2;
}

export function linkDesignProjection(input: unknown): DesignLinkResultV1 {
  const parsed = LinkInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      exactBindings: [],
      diagnostics: parsed.error.issues.slice(0, 100).map((issue) => diagnostic({
        code: "LINK_INPUT_INVALID",
        severity: "error",
        message: `Design linker input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
        reference: issue.path.join("/") || "$",
      })),
    };
  }

  const { productSpec, projection } = parsed.data;
  const diagnostics: CompilationDiagnosticV1[] = [];
  const exactBindings: ExactDesignBindingV1[] = [];
  const productSurfaceById = new Map(productSpec.surfaces.map((surface) => [surface.id, surface]));
  const actionById = new Map(productSpec.actions.map((action) => [action.id, action]));
  const exactProjectionSurfaces = projection.surfaces.filter((surface) =>
    surface.surfaceRef
    && (surface.confidence === "exact" || surface.confidence === "derived_with_provenance"));
  const projectionSurfaceById = new Map(exactProjectionSurfaces.map((surface) => [surface.id, surface]));

  const surfaces = exactProjectionSurfaces.flatMap((surface) => {
    if (!surface.surfaceRef || !productSurfaceById.has(surface.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "LINK_SURFACE_REF_UNRESOLVED",
        severity: "error",
        message: `Design surface ${surface.id} does not resolve to a ProductSpec surface`,
        artifactHash: surface.sourceHash,
        reference: surface.surfaceRef ?? surface.id,
        provenance: surface.provenance,
      }));
      return [];
    }
    return [{
      id: surface.id,
      surfaceRef: surface.surfaceRef,
      sourceArtifactHash: surface.sourceHash,
      sourceLocator: surface.sourceLocator,
    }];
  });

  projection.surfaces
    .filter((surface) => !projectionSurfaceById.has(surface.id))
    .forEach((surface) => diagnostics.push(diagnostic({
      code: "LINK_SURFACE_CONFIDENCE_INSUFFICIENT",
      severity: "warning",
      message: `Design surface ${surface.id} lacks an exact ProductSpec surface reference`,
      artifactHash: surface.sourceHash,
      reference: surface.id,
      provenance: surface.provenance,
    })));

  const controls: DesignControlV1[] = [];
  const bindings: DesignControlBindingV1[] = [];
  const unresolvedBindings: UnresolvedControlBindingV1[] = [];
  let representable = true;

  projection.controls.forEach((control) => {
    const projectionSurface = projectionSurfaceById.get(control.designSurfaceId);
    const surfaceRef = control.surfaceRef ?? projectionSurface?.surfaceRef;
    if (!surfaceRef || !productSurfaceById.has(surfaceRef) || !projectionSurface) {
      representable = false;
      diagnostics.push(diagnostic({
        code: "LINK_CONTROL_SURFACE_UNRESOLVED",
        severity: "error",
        message: `Control ${control.generatedLocalId} has no exact ProductSpec/design surface join`,
        artifactHash: control.source.artifactHash,
        reference: control.generatedLocalId,
        provenance: control.provenance,
      }));
      return;
    }

    controls.push({
      id: control.id,
      identity: {
        kind: "derived" as const,
        formula: "setfarm-control-id-v1" as const,
        provenance: control.provenance,
      },
      generatedLocalId: control.generatedLocalId,
      kind: control.kind,
      ...(control.label ? { label: control.label } : {}),
      accessibility: {
        role: accessibilityRole(control.kind),
        ...(control.label ? { name: control.label } : {}),
      },
      surfaceRef,
      interactive: true,
      source: control.source,
    });

    if (control.id !== expectedDerivedControlId(control)) {
      const code = "LINK_DERIVED_CONTROL_ID_MISMATCH";
      unresolvedBindings.push(unresolved(control, code, "missing"));
      diagnostics.push(diagnostic({
        code,
        severity: "error",
        message: `Control ${control.generatedLocalId} does not match setfarm-control-id-v1`,
        artifactHash: control.source.artifactHash,
        reference: control.id,
        provenance: control.provenance,
      }));
      return;
    }

    const actionRefs = uniqueSorted(control.semanticCandidates.map((candidate) => candidate.actionRef));
    if (actionRefs.length > 1) {
      const code = "LINK_SEMANTIC_CANDIDATE_CONFLICT";
      unresolvedBindings.push(unresolved(control, code, "ambiguous", actionRefs));
      diagnostics.push(diagnostic({
        code,
        severity: "error",
        message: `Control ${control.generatedLocalId} has conflicting exact semantic candidates`,
        artifactHash: control.source.artifactHash,
        reference: control.generatedLocalId,
        provenance: control.semanticCandidates.flatMap((candidate) => candidate.provenance),
        suggestions: actionRefs.map((reference) => ({
          reference,
          reason: "Conflicting exact candidates require upstream correction",
          confidence: "ambiguous",
        })),
      }));
      return;
    }
    if (actionRefs.length === 0) {
      const code = "LINK_SEMANTIC_ACTION_MISSING";
      unresolvedBindings.push(unresolved(
        control,
        code,
        control.label ? "heuristic_legacy_only" : "missing",
        control.label ? [control.label] : [],
      ));
      diagnostics.push(diagnostic({
        code,
        severity: "error",
        message: `Control ${control.generatedLocalId} has no exact semantic action`,
        artifactHash: control.source.artifactHash,
        reference: control.generatedLocalId,
        provenance: control.provenance,
      }));
      return;
    }

    const actionRef = actionRefs[0]!;
    const action = actionById.get(actionRef);
    if (!action) {
      const code = "LINK_ACTION_REF_UNRESOLVED";
      unresolvedBindings.push(unresolved(control, code, "missing", [actionRef]));
      diagnostics.push(diagnostic({
        code,
        severity: "error",
        message: `Control ${control.generatedLocalId} references absent ProductSpec action ${actionRef}`,
        artifactHash: control.source.artifactHash,
        reference: actionRef,
        provenance: control.semanticCandidates.flatMap((candidate) => candidate.provenance),
      }));
      return;
    }

    if (!action.surfaceRefs.includes(surfaceRef)) {
      const code = "LINK_ACTION_SURFACE_MISMATCH";
      unresolvedBindings.push(unresolved(control, code, "missing", action.surfaceRefs));
      diagnostics.push(diagnostic({
        code,
        severity: "error",
        message: `Action ${actionRef} is not allowed on control surface ${surfaceRef}`,
        artifactHash: control.source.artifactHash,
        reference: `${actionRef}->${surfaceRef}`,
        provenance: control.semanticCandidates.flatMap((candidate) => candidate.provenance),
      }));
      return;
    }

    const selected = [...control.semanticCandidates]
      .sort((left, right) => candidatePriority(left.sourceKind) - candidatePriority(right.sourceKind))[0]!;
    const binding: DesignControlBindingV1 = {
      controlRef: control.id,
      disposition: "action",
      actionRef,
      routeRef: productSurfaceById.get(surfaceRef)?.routeRef,
      inputBindings: [],
      stateRefs: actionStateRefs(action),
      persistenceRefs: actionPersistenceRefs(action),
      evidenceRefs: uniqueSorted(action.evidenceRefs),
    };
    bindings.push(binding);
    exactBindings.push(ExactDesignBindingV1Schema.parse({
      controlRef: control.id,
      generatedLocalId: control.generatedLocalId,
      actionRef,
      sourceKind: selected.sourceKind,
    }));

    action.input.fields.forEach((field) => diagnostics.push(diagnostic({
      code: "LINK_ACTION_INPUT_BINDING_MISSING",
      severity: "error",
      message: `Action ${actionRef} input ${field.name} has no exact control/value source binding`,
      artifactHash: control.source.artifactHash,
      reference: `${actionRef}.${field.name}`,
      provenance: selected.provenance,
    })));
  });

  if (!representable || controls.length === 0) {
    return {
      exactBindings,
      diagnostics: sortCompilationDiagnostics(diagnostics),
    };
  }

  const graphResult = DesignInteractionGraphV1Schema.safeParse({
    schema: "setfarm.design-interaction-graph.v1",
    rawArtifactHashes: uniqueSorted(projection.rawArtifactHashes),
    surfaces,
    controls,
    bindings,
    unresolvedBindings,
  });
  if (!graphResult.success) {
    diagnostics.push(...graphResult.error.issues.slice(0, 100).map((issue) => diagnostic({
      code: "LINK_GRAPH_INVALID",
      severity: "error",
      message: `Linked graph failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
    return { exactBindings, diagnostics: sortCompilationDiagnostics(diagnostics) };
  }

  return {
    graph: graphResult.data,
    exactBindings,
    diagnostics: sortCompilationDiagnostics(diagnostics),
  };
}
