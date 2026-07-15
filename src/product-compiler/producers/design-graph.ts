import { createHash } from "node:crypto";
import { z } from "zod";

import {
  makeCompilationDiagnostic,
  sortCompilationDiagnostics,
} from "../diagnostics.js";
import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  DesignInteractionGraphV1Schema,
  type DesignControlBindingV1,
  type DesignControlV1,
  type DesignInteractionGraphV1,
  type DesignObservableBindingV1,
} from "../schemas/design-interaction-graph-v1.js";
import {
  ActionIdSchema,
  DesignSurfaceIdSchema,
  EvidenceIdSchema,
  NormalizedRelativeLocatorSchema,
  ObservableIdSchema,
  PersistenceIdSchema,
  RouteIdSchema,
  Sha256Schema,
  StateIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "../schemas/common-v1.js";
import {
  ProductSpecV1Schema,
  type ProductActionV1,
  type ProductSpecV1,
} from "../schemas/product-spec-v1.js";

const GenerationTargetIdSchema = z
  .string()
  .min(8)
  .max(160)
  .regex(/^TARGET_[A-Z0-9]+(?:_[A-Z0-9]+)*$/);

const ScreenIdentitySchema = z.string().min(1).max(500);

const DiagnosticHintsSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    label: z.string().min(1).max(500).optional(),
    tokens: z.array(z.string().min(1).max(160)).max(100).optional(),
  })
  .strict();

const GenerationTargetSchema = z
  .object({
    targetId: GenerationTargetIdSchema,
    designSurfaceId: DesignSurfaceIdSchema,
    surfaceRef: SurfaceIdSchema,
    requestScreenKey: ScreenIdentitySchema,
    returnedScreenId: ScreenIdentitySchema,
    sourceArtifactHash: Sha256Schema,
    sourceLocator: NormalizedRelativeLocatorSchema,
    diagnosticHints: DiagnosticHintsSchema.optional(),
  })
  .strict();

const ProducerValueSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("control_value"),
    generatedLocalId: z.string().min(1).max(500),
    targetRef: GenerationTargetIdSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal("state"),
    stateRef: StateIdSchema,
    path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
  }).strict(),
  z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
]);

const ProducerInputBindingSchema = z
  .object({
    inputField: z.string().min(1).max(160),
    valueFrom: ProducerValueSourceSchema,
  })
  .strict();

const SameElementActionSchema = z
  .object({
    generatedLocalId: z.string().min(1).max(500),
    dataAction: ActionIdSchema,
    actionRef: ActionIdSchema,
  })
  .strict();

const ActionDispositionSchema = z
  .object({
    disposition: z.literal("action"),
    sameElement: SameElementActionSchema,
    routeRef: RouteIdSchema,
    inputBindings: z.array(ProducerInputBindingSchema).max(500),
    stateRefs: z.array(StateIdSchema).max(500).refine(hasUniqueStrings),
    persistenceRefs: z.array(PersistenceIdSchema).max(500).refine(hasUniqueStrings),
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500).refine(hasUniqueStrings),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.inputBindings.map((binding) => binding.inputField))) {
      context.addIssue({
        code: "custom",
        path: ["inputBindings"],
        message: "Action input bindings must be unique by input field",
      });
    }
  });

const ExternalDispositionSchema = z
  .object({
    disposition: z.literal("external"),
    target: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("url"),
        url: z.url().refine((value) => value.startsWith("https://") || value.startsWith("http://")),
      }).strict(),
      z.object({ kind: z.literal("download"), path: NormalizedRelativeLocatorSchema }).strict(),
    ]),
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500).refine(hasUniqueStrings),
  })
  .strict();

const DisabledDispositionSchema = z
  .object({
    disposition: z.literal("disabled"),
    reason: z.string().min(1).max(1_000),
  })
  .strict();

const InformationalDispositionSchema = z
  .object({
    disposition: z.literal("informational"),
    reason: z.string().min(1).max(1_000),
  })
  .strict();

const ValueInputDispositionSchema = z
  .object({
    disposition: z.literal("value_input"),
    fields: z.array(z.object({
      actionRef: ActionIdSchema,
      inputField: z.string().min(1).max(160),
    }).strict()).min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.fields.map((field) => `${field.actionRef}\0${field.inputField}`))) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Value input action/field mappings must be unique",
      });
    }
  });

const ConverterDispositionSchema = z.discriminatedUnion("disposition", [
  ActionDispositionSchema,
  ExternalDispositionSchema,
  DisabledDispositionSchema,
  InformationalDispositionSchema,
  ValueInputDispositionSchema,
]);

const ControlKindSchema = z.enum([
  "button",
  "link",
  "input",
  "textarea",
  "select",
  "checkbox",
  "radio",
  "menu_item",
  "tab",
  "drag_target",
  "canvas_region",
  "other",
]);

const ConverterControlSchema = z
  .object({
    generatedLocalId: z.string().min(1).max(500),
    kind: ControlKindSchema,
    interactive: z.boolean(),
    label: z.string().min(1).max(500).optional(),
    accessibility: z.object({
      role: z.string().min(1).max(160).optional(),
      name: z.string().min(1).max(500).optional(),
    }).strict().optional(),
    source: z.object({
      selector: z.string().min(1).max(2_000),
      line: z.number().int().positive().optional(),
      column: z.number().int().nonnegative().optional(),
    }).strict(),
    bindings: z.array(ConverterDispositionSchema).max(100),
    diagnosticHints: DiagnosticHintsSchema.optional(),
  })
  .strict();

const ConverterObservableSchema = z.object({
  observableRef: ObservableIdSchema,
  accessibility: z.object({
    role: z.string().min(1).max(160),
    name: z.string().min(1).max(500),
  }).strict(),
  source: z.object({
    selector: z.string().min(1).max(2_000),
    line: z.number().int().positive().optional(),
    column: z.number().int().nonnegative().optional(),
  }).strict(),
}).strict();

const ConverterOutputSchema = z
  .object({
    targetRef: GenerationTargetIdSchema,
    responseScreenId: ScreenIdentitySchema,
    designSurfaceId: DesignSurfaceIdSchema,
    surfaceRef: SurfaceIdSchema,
    sourceArtifactHash: Sha256Schema,
    sourceLocator: NormalizedRelativeLocatorSchema,
    controls: z.array(ConverterControlSchema).max(10_000),
    observables: z.array(ConverterObservableSchema).max(10_000).default([]),
    diagnosticHints: DiagnosticHintsSchema.optional(),
  })
  .strict();

const DesignGraphProducerInputSchema = z
  .object({
    productSpec: ProductSpecV1Schema,
    generationTargets: z.array(GenerationTargetSchema).min(1).max(1_000),
    converterOutputs: z.array(ConverterOutputSchema).min(1).max(1_000),
  })
  .strict();

export type DesignGraphProducerInput = z.input<typeof DesignGraphProducerInputSchema>;

export type ExactDesignTargetBinding = Readonly<{
  targetRef: string;
  requestScreenKey: string;
  responseScreenId: string;
  designSurfaceId: string;
  surfaceRef: string;
  sourceArtifactHash: string;
  sourceLocator: string;
}>;

export type ExactProducedControlBinding = Readonly<{
  targetRef: string;
  responseScreenId: string;
  controlRef: string;
  generatedLocalId: string;
  dataAction: string;
  actionRef: string;
  sourceArtifactHash: string;
  sourceLocator: string;
  selector: string;
}>;

export type DesignGraphProducerResult =
  | Readonly<{
      status: "produced";
      designGraph: DesignInteractionGraphV1;
      targetBindings: ExactDesignTargetBinding[];
      exactControlBindings: ExactProducedControlBinding[];
      diagnostics: CompilationDiagnosticV1[];
    }>
  | Readonly<{
      status: "rejected";
      rejectionCodes: string[];
      diagnostics: CompilationDiagnosticV1[];
    }>;

type ParsedInput = z.infer<typeof DesignGraphProducerInputSchema>;
type ParsedTarget = ParsedInput["generationTargets"][number];
type ParsedOutput = ParsedInput["converterOutputs"][number];
type ParsedControl = ParsedOutput["controls"][number];
type ParsedActionDisposition = z.infer<typeof ActionDispositionSchema>;

function diagnostic(input: {
  code: string;
  severity?: CompilationDiagnosticV1["severity"];
  message: string;
  artifactHash?: string;
  reference?: string;
  suggestions?: CompilationDiagnosticV1["suggestions"];
}): CompilationDiagnosticV1 {
  return makeCompilationDiagnostic({
    schema: "setfarm.compilation-diagnostic.v1",
    code: input.code,
    category: "link",
    severity: input.severity ?? "error",
    message: input.message.slice(0, 2_000),
    ...(input.artifactHash ? { artifactHash: input.artifactHash } : {}),
    ...(input.reference ? { reference: input.reference.slice(0, 160) } : {}),
    provenance: [],
    suggestions: input.suggestions ?? [],
  });
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const first = uniqueSorted(left);
  const second = uniqueSorted(right);
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function expectedSelector(
  generatedLocalId: string,
  identityAttribute: "data-action-id" | "data-control-id",
): string {
  return `[${identityAttribute}="${generatedLocalId.replaceAll('"', '\\"')}"]`;
}

function expectedObservableSelector(observableRef: string): string {
  return `[data-observable-refs~="${observableRef.replaceAll('"', '\\"')}"]`;
}

function derivedControlId(
  artifactHash: string,
  selector: string,
  kind: ParsedControl["kind"],
): string {
  const suffix = createHash("sha256")
    .update(`${artifactHash}\0${selector}\0${kind}`)
    .digest("hex")
    .slice(0, 16);
  return `CTRL_${suffix}`;
}

function accessibilityRole(kind: ParsedControl["kind"]): string {
  if (kind === "link") return "link";
  if (kind === "input" || kind === "textarea") return "textbox";
  if (kind === "select") return "combobox";
  if (kind === "checkbox") return "checkbox";
  if (kind === "radio") return "radio";
  if (kind === "tab") return "tab";
  return "button";
}

function requiredActionStateRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.preconditions.map((item) => item.stateRef),
    ...action.stateDeltas.map((item) => item.stateRef),
    ...action.stateDeltas.flatMap((item) =>
      item.valueFrom.kind === "state" ? [item.valueFrom.stateRef] : []),
    ...action.success.stateRefs,
    ...action.failure.stateRefs,
  ]);
}

function requiredActionPersistenceRefs(action: ProductActionV1): string[] {
  return uniqueSorted([
    ...action.persistenceEffects.map((item) => item.policyRef),
    ...(action.success.persistenceRefs ?? []),
    ...(action.failure.persistenceRefs ?? []),
  ]);
}

function hintDiagnostic(
  hints: z.infer<typeof DiagnosticHintsSchema> | undefined,
  reference: string,
): CompilationDiagnosticV1 | undefined {
  if (!hints) return undefined;
  const terms = [hints.title, hints.label, ...(hints.tokens ?? [])].filter(Boolean) as string[];
  if (terms.length === 0) return undefined;
  return diagnostic({
    code: "DESIGN_HEURISTIC_HINT_IGNORED",
    severity: "info",
    message: "Title, label, and token similarity are diagnostic context only and did not create a binding",
    reference,
    suggestions: terms.slice(0, 100).map((term) => ({
      reference: term.slice(0, 160),
      reason: "Heuristic text cannot bind a ProductSpec surface or action",
      confidence: "heuristic_legacy_only" as const,
    })),
  });
}

function validateTargetIdentity(
  target: ParsedTarget,
  output: ParsedOutput,
  diagnostics: CompilationDiagnosticV1[],
): boolean {
  let exact = true;
  const mismatch = (code: string, field: string, expected: string, observed: string) => {
    exact = false;
    diagnostics.push(diagnostic({
      code,
      message: `Converter ${field} ${JSON.stringify(observed)} does not equal target-recorded ${JSON.stringify(expected)}`,
      artifactHash: output.sourceArtifactHash,
      reference: target.targetId,
    }));
  };
  if (output.responseScreenId !== target.returnedScreenId) {
    mismatch("DESIGN_RESPONSE_SCREEN_ID_MISMATCH", "response screen identity", target.returnedScreenId, output.responseScreenId);
  }
  if (output.designSurfaceId !== target.designSurfaceId) {
    mismatch("DESIGN_RESPONSE_DESIGN_SURFACE_MISMATCH", "design surface", target.designSurfaceId, output.designSurfaceId);
  }
  if (output.surfaceRef !== target.surfaceRef) {
    mismatch("DESIGN_RESPONSE_PRODUCT_SURFACE_MISMATCH", "ProductSpec surface", target.surfaceRef, output.surfaceRef);
  }
  if (output.sourceArtifactHash !== target.sourceArtifactHash) {
    mismatch("DESIGN_RESPONSE_ARTIFACT_HASH_MISMATCH", "source artifact hash", target.sourceArtifactHash, output.sourceArtifactHash);
  }
  if (output.sourceLocator !== target.sourceLocator) {
    mismatch("DESIGN_RESPONSE_SOURCE_LOCATOR_MISMATCH", "source locator", target.sourceLocator, output.sourceLocator);
  }
  return exact;
}

function validateActionContract(
  input: {
    productSpec: ProductSpecV1;
    target: ParsedTarget;
    output: ParsedOutput;
    control: ParsedControl;
    disposition: ParsedActionDisposition;
  },
  diagnostics: CompilationDiagnosticV1[],
): ProductActionV1 | undefined {
  const { productSpec, target, output, control, disposition } = input;
  const reference = `${target.targetId}:${control.generatedLocalId}`;
  if (disposition.sameElement.generatedLocalId !== control.generatedLocalId) {
    diagnostics.push(diagnostic({
      code: "DESIGN_SAME_ELEMENT_LOCAL_ID_MISMATCH",
      message: `Same-element generated local ID does not equal converter control identity`,
      artifactHash: output.sourceArtifactHash,
      reference,
    }));
  }
  if (disposition.sameElement.dataAction !== disposition.sameElement.actionRef) {
    diagnostics.push(diagnostic({
      code: "DESIGN_SAME_ELEMENT_ACTION_MISMATCH",
      message: `Same-element data-action and actionRef disagree`,
      artifactHash: output.sourceArtifactHash,
      reference,
    }));
    return undefined;
  }

  const action = productSpec.actions.find((item) => item.id === disposition.sameElement.actionRef);
  if (!action) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_REF_UNRESOLVED",
      message: `Exact same-element action ${disposition.sameElement.actionRef} is absent from ProductSpec`,
      artifactHash: output.sourceArtifactHash,
      reference: disposition.sameElement.actionRef,
    }));
    return undefined;
  }
  if (!action.surfaceRefs.includes(target.surfaceRef)) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_SURFACE_MISMATCH",
      message: `Action ${action.id} is not declared on exact target surface ${target.surfaceRef}`,
      artifactHash: output.sourceArtifactHash,
      reference: `${action.id}->${target.surfaceRef}`,
    }));
  }
  const surface = productSpec.surfaces.find((item) => item.id === target.surfaceRef);
  if (!surface || disposition.routeRef !== surface.routeRef) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_ROUTE_MISMATCH",
      message: `Binding route ${disposition.routeRef} does not equal target surface route ${surface?.routeRef ?? "<missing>"}`,
      artifactHash: output.sourceArtifactHash,
      reference,
    }));
  }

  const inputFields = action.input.fields.map((field) => field.name);
  const boundFields = disposition.inputBindings.map((binding) => binding.inputField);
  if (!sameStrings(boundFields, inputFields)) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_INPUT_BINDINGS_INCOMPLETE",
      message: `Action ${action.id} requires exact input fields ${inputFields.join(", ") || "<none>"}; converter supplied ${boundFields.join(", ") || "<none>"}`,
      artifactHash: output.sourceArtifactHash,
      reference: action.id,
    }));
  }
  if (!sameStrings(disposition.stateRefs, requiredActionStateRefs(action))) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_STATE_REFS_MISMATCH",
      message: `Action ${action.id} converter state refs do not exactly match ProductSpec`,
      artifactHash: output.sourceArtifactHash,
      reference: action.id,
    }));
  }
  if (!sameStrings(disposition.persistenceRefs, requiredActionPersistenceRefs(action))) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_PERSISTENCE_REFS_MISMATCH",
      message: `Action ${action.id} converter persistence refs do not exactly match ProductSpec`,
      artifactHash: output.sourceArtifactHash,
      reference: action.id,
    }));
  }
  if (!sameStrings(disposition.evidenceRefs, action.evidenceRefs)) {
    diagnostics.push(diagnostic({
      code: "DESIGN_ACTION_EVIDENCE_REFS_MISMATCH",
      message: `Action ${action.id} converter evidence refs do not exactly match ProductSpec`,
      artifactHash: output.sourceArtifactHash,
      reference: action.id,
    }));
  }
  return action;
}

function reject(diagnostics: CompilationDiagnosticV1[]): DesignGraphProducerResult {
  const sorted = sortCompilationDiagnostics(diagnostics);
  return {
    status: "rejected",
    rejectionCodes: uniqueSorted(sorted.filter((item) => item.severity === "error").map((item) => item.code)),
    diagnostics: sorted,
  };
}

/**
 * Produces a sealed-design candidate only from exact target/response identity
 * and converter-emitted same-element semantics. Text similarity is retained as
 * diagnostic context and is never consulted to bind a surface or action.
 */
export function produceDesignInteractionGraphV1(input: unknown): DesignGraphProducerResult {
  const parsed = DesignGraphProducerInputSchema.safeParse(input);
  if (!parsed.success) {
    return reject(parsed.error.issues.slice(0, 100).map((issue) => diagnostic({
      code: "DESIGN_PRODUCER_INPUT_INVALID",
      message: `Design producer input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
  }

  const { productSpec, generationTargets, converterOutputs } = parsed.data;
  const diagnostics: CompilationDiagnosticV1[] = [];
  const productSurfaces = new Map(productSpec.surfaces.map((surface) => [surface.id, surface]));
  const evidenceIds = new Set(productSpec.evidencePredicates.map((item) => item.id));

  const targetIds = generationTargets.map((target) => target.targetId);
  const designSurfaceIds = generationTargets.map((target) => target.designSurfaceId);
  if (!hasUniqueStrings(targetIds)) {
    diagnostics.push(diagnostic({
      code: "DESIGN_GENERATION_TARGET_ID_DUPLICATE",
      message: "Generation target IDs must be unique",
    }));
  }
  if (!hasUniqueStrings(designSurfaceIds)) {
    diagnostics.push(diagnostic({
      code: "DESIGN_GENERATION_SURFACE_ID_DUPLICATE",
      message: "Generation design surface IDs must be unique",
    }));
  }

  const targetById = new Map(generationTargets.map((target) => [target.targetId, target]));
  const outputsByTarget = new Map<string, ParsedOutput[]>();
  converterOutputs.forEach((output) => {
    outputsByTarget.set(output.targetRef, [...(outputsByTarget.get(output.targetRef) ?? []), output]);
    if (!targetById.has(output.targetRef)) {
      diagnostics.push(diagnostic({
        code: "DESIGN_CONVERTER_TARGET_UNRESOLVED",
        message: `Converter output references absent generation target ${output.targetRef}`,
        artifactHash: output.sourceArtifactHash,
        reference: output.targetRef,
      }));
    }
  });

  generationTargets.forEach((target) => {
    if (!productSurfaces.has(target.surfaceRef)) {
      diagnostics.push(diagnostic({
        code: "DESIGN_TARGET_SURFACE_UNRESOLVED",
        message: `Generation target ${target.targetId} references absent ProductSpec surface ${target.surfaceRef}`,
        artifactHash: target.sourceArtifactHash,
        reference: target.surfaceRef,
      }));
    }
    const count = outputsByTarget.get(target.targetId)?.length ?? 0;
    if (count === 0) {
      diagnostics.push(diagnostic({
        code: "DESIGN_CONVERTER_RESPONSE_MISSING",
        message: `Generation target ${target.targetId} has no converter response`,
        artifactHash: target.sourceArtifactHash,
        reference: target.targetId,
      }));
    } else if (count > 1) {
      diagnostics.push(diagnostic({
        code: "DESIGN_CONVERTER_RESPONSE_AMBIGUOUS",
        message: `Generation target ${target.targetId} has ${count} converter responses`,
        artifactHash: target.sourceArtifactHash,
        reference: target.targetId,
      }));
    }
    const hint = hintDiagnostic(target.diagnosticHints, target.targetId);
    if (hint) diagnostics.push(hint);
  });

  productSpec.surfaces.filter((surface) => surface.required).forEach((surface) => {
    if (!generationTargets.some((target) => target.surfaceRef === surface.id)) {
      diagnostics.push(diagnostic({
        code: "DESIGN_REQUIRED_SURFACE_TARGET_MISSING",
        message: `Required ProductSpec surface ${surface.id} has no exact generation target`,
        reference: surface.id,
      }));
    }
  });

  const targetBindings: ExactDesignTargetBinding[] = [];
  const exactControlBindings: ExactProducedControlBinding[] = [];
  const surfaces: DesignInteractionGraphV1["surfaces"] = [];
  const controls: DesignControlV1[] = [];
  const bindings: DesignControlBindingV1[] = [];
  const observableBindings: DesignObservableBindingV1[] = [];
  const controlIdByTargetAndLocal = new Map<string, string>();
  const pendingActions: Array<{
    target: ParsedTarget;
    output: ParsedOutput;
    control: ParsedControl;
    controlRef: string;
    disposition: ParsedActionDisposition;
  }> = [];

  generationTargets.forEach((target) => {
    const outputs = outputsByTarget.get(target.targetId) ?? [];
    if (outputs.length !== 1) return;
    const output = outputs[0]!;
    if (!validateTargetIdentity(target, output, diagnostics)) return;

    targetBindings.push({
      targetRef: target.targetId,
      requestScreenKey: target.requestScreenKey,
      responseScreenId: target.returnedScreenId,
      designSurfaceId: target.designSurfaceId,
      surfaceRef: target.surfaceRef,
      sourceArtifactHash: target.sourceArtifactHash,
      sourceLocator: target.sourceLocator,
    });
    surfaces.push({
      id: target.designSurfaceId,
      surfaceRef: target.surfaceRef,
      sourceArtifactHash: target.sourceArtifactHash,
      sourceLocator: target.sourceLocator,
    });
    const outputHint = hintDiagnostic(output.diagnosticHints, target.targetId);
    if (outputHint) diagnostics.push(outputHint);

    output.controls.forEach((control) => {
      const reference = `${target.targetId}:${control.generatedLocalId}`;
      const identityAttribute = control.bindings.length === 1
        && control.bindings[0]?.disposition === "value_input"
        ? "data-control-id"
        : "data-action-id";
      const expected = expectedSelector(control.generatedLocalId, identityAttribute);
      if (control.source.selector !== expected) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_SELECTOR_LOCAL_ID_MISMATCH",
          message: `Control selector ${JSON.stringify(control.source.selector)} does not preserve generated local ID ${JSON.stringify(control.generatedLocalId)}`,
          artifactHash: output.sourceArtifactHash,
          reference,
        }));
      }
      const controlRef = derivedControlId(output.sourceArtifactHash, control.source.selector, control.kind);
      const localKey = `${target.targetId}\0${control.generatedLocalId}`;
      if (controlIdByTargetAndLocal.has(localKey)) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_LOCAL_ID_DUPLICATE",
          message: `Generated local control ID ${control.generatedLocalId} is not unique within ${target.targetId}`,
          artifactHash: output.sourceArtifactHash,
          reference,
        }));
      } else {
        controlIdByTargetAndLocal.set(localKey, controlRef);
      }

      const provenance = [{
        schema: "setfarm.provenance-ref.v1" as const,
        sourceHash: output.sourceArtifactHash,
        locator: output.sourceLocator,
        confidence: "exact" as const,
        ...(control.source.line ? {
          range: {
            startLine: control.source.line,
            ...(control.source.column !== undefined ? { startColumn: control.source.column } : {}),
            endLine: control.source.line,
            ...(control.source.column !== undefined ? { endColumn: control.source.column } : {}),
          },
        } : {}),
      }];
      controls.push({
        id: controlRef,
        identity: {
          kind: "derived",
          formula: "setfarm-control-id-v1",
          provenance,
        },
        generatedLocalId: control.generatedLocalId,
        kind: control.kind,
        ...(control.label ? { label: control.label } : {}),
        accessibility: {
          role: control.accessibility?.role ?? accessibilityRole(control.kind),
          ...(control.accessibility?.name
            ? { name: control.accessibility.name }
            : control.label ? { name: control.label } : {}),
        },
        surfaceRef: target.surfaceRef,
        interactive: control.interactive,
        source: {
          artifactHash: output.sourceArtifactHash,
          locator: output.sourceLocator,
          selector: control.source.selector,
          ...(control.source.line ? { line: control.source.line } : {}),
          ...(control.source.column !== undefined ? { column: control.source.column } : {}),
        },
      });

      const controlHint = hintDiagnostic(control.diagnosticHints, reference);
      if (controlHint) diagnostics.push(controlHint);
      if (control.bindings.length === 0) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_DISPOSITION_MISSING",
          message: `Control ${control.generatedLocalId} has no exact converter disposition`,
          artifactHash: output.sourceArtifactHash,
          reference,
          ...(control.label ? {
            suggestions: [{
              reference: control.label.slice(0, 160),
              reason: "A label is diagnostic context and cannot supply a disposition",
              confidence: "heuristic_legacy_only" as const,
            }],
          } : {}),
        }));
        return;
      }
      if (control.bindings.length > 1) {
        diagnostics.push(diagnostic({
          code: "DESIGN_CONTROL_DISPOSITION_AMBIGUOUS",
          message: `Control ${control.generatedLocalId} has ${control.bindings.length} converter dispositions`,
          artifactHash: output.sourceArtifactHash,
          reference,
        }));
        return;
      }

      const disposition = control.bindings[0]!;
      if (control.interactive && disposition.disposition === "informational") {
        diagnostics.push(diagnostic({
          code: "DESIGN_INTERACTIVE_DISPOSITION_INVALID",
          message: `Interactive control ${control.generatedLocalId} cannot be informational`,
          artifactHash: output.sourceArtifactHash,
          reference,
        }));
        return;
      }
      if (!control.interactive && disposition.disposition !== "informational") {
        diagnostics.push(diagnostic({
          code: "DESIGN_NONINTERACTIVE_DISPOSITION_INVALID",
          message: `Non-interactive control ${control.generatedLocalId} must be informational`,
          artifactHash: output.sourceArtifactHash,
          reference,
        }));
        return;
      }

      if (disposition.disposition === "value_input") {
        if (!["input", "textarea", "select", "checkbox", "radio"].includes(control.kind)) {
          diagnostics.push(diagnostic({
            code: "DESIGN_VALUE_INPUT_KIND_INVALID",
            message: `Value input ${control.generatedLocalId} must be an input-like control`,
            artifactHash: output.sourceArtifactHash,
            reference,
          }));
          return;
        }
        disposition.fields.forEach((field) => {
          const action = productSpec.actions.find((item) => item.id === field.actionRef);
          if (!action) {
            diagnostics.push(diagnostic({
              code: "DESIGN_VALUE_INPUT_ACTION_UNRESOLVED",
              message: `Value input ${control.generatedLocalId} references absent action ${field.actionRef}`,
              artifactHash: output.sourceArtifactHash,
              reference: field.actionRef,
            }));
            return;
          }
          if (!action.surfaceRefs.includes(target.surfaceRef)) {
            diagnostics.push(diagnostic({
              code: "DESIGN_VALUE_INPUT_SURFACE_MISMATCH",
              message: `Value input ${control.generatedLocalId} action ${field.actionRef} is absent from ${target.surfaceRef}`,
              artifactHash: output.sourceArtifactHash,
              reference: `${field.actionRef}.${field.inputField}`,
            }));
          }
          if (!action.input.fields.some((item) => item.name === field.inputField)) {
            diagnostics.push(diagnostic({
              code: "DESIGN_VALUE_INPUT_FIELD_UNRESOLVED",
              message: `Value input ${control.generatedLocalId} references absent field ${field.actionRef}.${field.inputField}`,
              artifactHash: output.sourceArtifactHash,
              reference: `${field.actionRef}.${field.inputField}`,
            }));
          }
        });
      }

      if (disposition.disposition === "action") {
        validateActionContract({ productSpec, target, output, control, disposition }, diagnostics);
        pendingActions.push({ target, output, control, controlRef, disposition });
        exactControlBindings.push({
          targetRef: target.targetId,
          responseScreenId: target.returnedScreenId,
          controlRef,
          generatedLocalId: control.generatedLocalId,
          dataAction: disposition.sameElement.dataAction,
          actionRef: disposition.sameElement.actionRef,
          sourceArtifactHash: output.sourceArtifactHash,
          sourceLocator: output.sourceLocator,
          selector: control.source.selector,
        });
      } else if (disposition.disposition === "external") {
        disposition.evidenceRefs.forEach((referenceId) => {
          if (!evidenceIds.has(referenceId)) {
            diagnostics.push(diagnostic({
              code: "DESIGN_EXTERNAL_EVIDENCE_REF_UNRESOLVED",
              message: `External disposition references absent evidence ${referenceId}`,
              artifactHash: output.sourceArtifactHash,
              reference: referenceId,
            }));
          }
        });
        bindings.push({ controlRef, ...disposition });
      } else {
        bindings.push({ controlRef, ...disposition });
      }
    });
  });

  pendingActions.forEach(({ target, output, control, controlRef, disposition }) => {
    const inputBindings: Extract<DesignControlBindingV1, { disposition: "action" }>["inputBindings"] = [];
    disposition.inputBindings.forEach((inputBinding) => {
      if (inputBinding.valueFrom.kind === "control_value") {
        const inputTarget = inputBinding.valueFrom.targetRef ?? target.targetId;
        const inputControlRef = controlIdByTargetAndLocal.get(
          `${inputTarget}\0${inputBinding.valueFrom.generatedLocalId}`,
        );
        if (!inputControlRef) {
          diagnostics.push(diagnostic({
            code: "DESIGN_INPUT_CONTROL_REF_UNRESOLVED",
            message: `Input ${inputBinding.inputField} cannot resolve exact control ${inputTarget}:${inputBinding.valueFrom.generatedLocalId}`,
            artifactHash: output.sourceArtifactHash,
            reference: `${disposition.sameElement.actionRef}.${inputBinding.inputField}`,
          }));
          return;
        }
        inputBindings.push({
          inputField: inputBinding.inputField,
          valueFrom: { kind: "control_value", controlRef: inputControlRef },
        });
      } else {
        inputBindings.push({
          inputField: inputBinding.inputField,
          valueFrom: inputBinding.valueFrom.kind === "state"
            ? {
                kind: "state",
                stateRef: inputBinding.valueFrom.stateRef,
                path: inputBinding.valueFrom.path,
              }
            : { kind: "literal", value: inputBinding.valueFrom.value },
        });
      }
    });
    bindings.push({
      controlRef,
      disposition: "action",
      actionRef: disposition.sameElement.actionRef,
      routeRef: disposition.routeRef,
      inputBindings,
      stateRefs: uniqueSorted(disposition.stateRefs),
      persistenceRefs: uniqueSorted(disposition.persistenceRefs),
      evidenceRefs: uniqueSorted(disposition.evidenceRefs),
    });
    void control;
  });

  const reachableActionRefs = new Set(
    bindings.filter((binding) => binding.disposition === "action").map((binding) => binding.actionRef),
  );
  productSpec.actions
    .filter((action) => action.trigger.kind === "user" || action.trigger.kind === "route")
    .forEach((action) => {
      if (!reachableActionRefs.has(action.id)) {
        diagnostics.push(diagnostic({
          code: "DESIGN_REQUIRED_ACTION_UNREACHABLE",
          message: `Required ProductSpec action ${action.id} has no exact same-element control binding`,
          reference: action.id,
        }));
      }
    });

  productSpec.actions.forEach((action) => {
    (action.observableEffects ?? []).forEach((effect) => {
      const actionBindings = bindings.filter((binding) =>
        binding.disposition === "action" && binding.actionRef === action.id);
      if (effect.selector.kind === "control") {
        if (actionBindings.length !== 1) {
          diagnostics.push(diagnostic({
            code: "DESIGN_OBSERVABLE_CONTROL_UNRESOLVED",
            message: `Observable ${effect.id} requires one exact control for ${action.id}; observed ${actionBindings.length}`,
            reference: effect.id,
          }));
        } else {
          observableBindings.push({
            observableRef: effect.id,
            actionRef: action.id,
            evidenceRef: effect.evidenceRef,
            target: { kind: "control", controlRef: actionBindings[0]!.controlRef },
          });
        }
        return;
      }
      if (effect.selector.kind === "surface") {
        const selector = effect.selector;
        const matchingSurfaces = surfaces.filter((surface) => surface.surfaceRef === selector.surfaceRef);
        if (matchingSurfaces.length !== 1) {
          diagnostics.push(diagnostic({
            code: "DESIGN_OBSERVABLE_SURFACE_UNRESOLVED",
            message: `Observable ${effect.id} requires one exact design surface for ${selector.surfaceRef}; observed ${matchingSurfaces.length}`,
            reference: effect.id,
          }));
        } else {
          observableBindings.push({
            observableRef: effect.id,
            actionRef: action.id,
            evidenceRef: effect.evidenceRef,
            target: { kind: "surface", designSurfaceRef: matchingSurfaces[0]!.id },
          });
        }
        return;
      }
      const selector = effect.selector;
      const matches = converterOutputs.flatMap((output) =>
        output.surfaceRef === selector.surfaceRef
          ? output.observables
            .filter((observable) => observable.observableRef === effect.id)
            .map((observable) => ({ output, observable }))
          : []);
      if (matches.length !== 1) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_ACCESSIBILITY_UNRESOLVED",
          message: `Observable ${effect.id} requires one exact ${selector.role}/${selector.name} accessibility selector; observed ${matches.length}`,
          reference: effect.id,
        }));
        return;
      }
      const match = matches[0]!;
      const exactSelector = expectedObservableSelector(effect.id);
      if (
        match.observable.accessibility.role !== selector.role
        || match.observable.accessibility.name !== selector.name
        || match.observable.source.selector !== exactSelector
      ) {
        diagnostics.push(diagnostic({
          code: "DESIGN_OBSERVABLE_ACCESSIBILITY_MISMATCH",
          message: `Observable ${effect.id} exact indexed accessibility target differs from ProductSpec`,
          artifactHash: match.output.sourceArtifactHash,
          reference: effect.id,
        }));
        return;
      }
      const provenance = [{
        schema: "setfarm.provenance-ref.v1" as const,
        sourceHash: match.output.sourceArtifactHash,
        locator: match.output.sourceLocator,
        confidence: "exact" as const,
        ...(match.observable.source.line ? {
          range: {
            startLine: match.observable.source.line,
            ...(match.observable.source.column !== undefined
              ? { startColumn: match.observable.source.column }
              : {}),
            endLine: match.observable.source.line,
            ...(match.observable.source.column !== undefined
              ? { endColumn: match.observable.source.column }
              : {}),
          },
        } : {}),
      }];
      observableBindings.push({
        observableRef: effect.id,
        actionRef: action.id,
        evidenceRef: effect.evidenceRef,
        target: {
          kind: "accessibility",
          surfaceRef: selector.surfaceRef,
          role: selector.role,
          name: selector.name,
          identity: {
            kind: "explicit",
            attribute: "data-observable-refs",
            provenance,
          },
          source: {
            artifactHash: match.output.sourceArtifactHash,
            locator: match.output.sourceLocator,
            selector: match.observable.source.selector,
            ...(match.observable.source.line ? { line: match.observable.source.line } : {}),
            ...(match.observable.source.column !== undefined
              ? { column: match.observable.source.column }
              : {}),
          },
        },
      });
    });
  });

  if (diagnostics.some((item) => item.severity === "error")) return reject(diagnostics);

  const graphResult = DesignInteractionGraphV1Schema.safeParse({
    schema: "setfarm.design-interaction-graph.v1",
    rawArtifactHashes: uniqueSorted(generationTargets.map((target) => target.sourceArtifactHash)),
    surfaces: [...surfaces].sort((left, right) => compareUtf16(left.id, right.id)),
    controls: [...controls].sort((left, right) => compareUtf16(left.id, right.id)),
    bindings: [...bindings].sort((left, right) => compareUtf16(left.controlRef, right.controlRef)),
    observableBindings: [...observableBindings].sort((left, right) =>
      compareUtf16(left.observableRef, right.observableRef)),
    unresolvedBindings: [],
  });
  if (!graphResult.success) {
    return reject([
      ...diagnostics,
      ...graphResult.error.issues.slice(0, 100).map((issue) => diagnostic({
        code: "DESIGN_PRODUCER_OUTPUT_INVALID",
        message: `Produced DesignInteractionGraph failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
        reference: issue.path.join("/") || "$",
      })),
    ]);
  }

  return {
    status: "produced",
    designGraph: graphResult.data,
    targetBindings: [...targetBindings].sort((left, right) => compareUtf16(left.targetRef, right.targetRef)),
    exactControlBindings: [...exactControlBindings].sort((left, right) => compareUtf16(left.controlRef, right.controlRef)),
    diagnostics: sortCompilationDiagnostics(diagnostics),
  };
}
