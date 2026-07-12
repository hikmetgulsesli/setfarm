import { createHash } from "node:crypto";
import { z } from "zod";

import type { CompilationDiagnosticV1 } from "../schemas/compilation-report-v1.js";
import {
  ActionIdSchema,
  ControlIdSchema,
  DesignSurfaceIdSchema,
  NormalizedRelativeLocatorSchema,
  ProvenanceConfidenceSchema,
  ProvenanceRefV1Schema,
  Sha256Schema,
  SourceArtifactRefV1Schema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "../schemas/common-v1.js";
import {
  adapterDiagnostic,
  finalizeAdapterResult,
  provenanceFromSource,
  type AdapterResult,
} from "./types.js";

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

const StitchProjectionSurfaceV1Schema = z
  .object({
    id: DesignSurfaceIdSchema,
    screenId: z.string().min(1).max(500),
    title: z.string().min(1).max(500),
    surfaceRef: SurfaceIdSchema.optional(),
    sourceHash: Sha256Schema,
    sourceLocator: NormalizedRelativeLocatorSchema,
    confidence: ProvenanceConfidenceSchema,
    provenance: z.array(ProvenanceRefV1Schema).min(1).max(100),
  })
  .strict();

const StitchSemanticCandidateV1Schema = z
  .object({
    actionRef: ActionIdSchema,
    sourceKind: z.enum(["structured_index", "same_element", "exact_manifest"]),
    confidence: z.literal("exact"),
    provenance: z.array(ProvenanceRefV1Schema).min(1).max(100),
  })
  .strict();

const StitchProjectionControlV1Schema = z
  .object({
    id: ControlIdSchema,
    designSurfaceId: DesignSurfaceIdSchema,
    surfaceRef: SurfaceIdSchema.optional(),
    generatedLocalId: z.string().min(1).max(500),
    generatedSourceLocator: NormalizedRelativeLocatorSchema.optional(),
    kind: ControlKindSchema,
    label: z.string().min(1).max(500).optional(),
    source: z.object({
      artifactHash: Sha256Schema,
      locator: NormalizedRelativeLocatorSchema,
      selector: z.string().min(1).max(2_000),
      line: z.number().int().positive().optional(),
    }).strict(),
    identityConfidence: z.literal("derived_with_provenance"),
    semanticCandidates: z.array(StitchSemanticCandidateV1Schema).max(100),
    provenance: z.array(ProvenanceRefV1Schema).min(1).max(200),
  })
  .strict();

export const StitchAdapterProjectionV1Schema = z
  .object({
    schema: z.literal("setfarm.stitch-adapter-projection.v1"),
    rawArtifactHashes: z.array(Sha256Schema).min(1).max(10_000).refine(hasUniqueStrings, {
      message: "Stitch projection raw artifact hashes must be unique",
    }),
    surfaces: z.array(StitchProjectionSurfaceV1Schema).max(2_000),
    controls: z.array(StitchProjectionControlV1Schema).max(20_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.surfaces.map((surface) => surface.id))) {
      context.addIssue({ code: "custom", path: ["surfaces"], message: "Projection surface IDs must be unique" });
    }
    if (!hasUniqueStrings(value.controls.map((control) => control.id))) {
      context.addIssue({ code: "custom", path: ["controls"], message: "Projection control IDs must be unique" });
    }
  });

export type StitchAdapterProjectionV1 = z.infer<typeof StitchAdapterProjectionV1Schema>;
type ProjectionControl = z.infer<typeof StitchProjectionControlV1Schema>;

const GeneratedSourceInputSchema = z
  .object({
    source: SourceArtifactRefV1Schema,
    designSurfaceId: DesignSurfaceIdSchema,
    surfaceRef: SurfaceIdSchema,
    text: z.string().max(20_000_000),
  })
  .strict();

const StitchAdapterInputSchema = z
  .object({
    rawArtifactHashes: z.array(Sha256Schema).min(1).max(10_000),
    screenIndex: z.object({
      source: SourceArtifactRefV1Schema,
      value: z.unknown(),
    }).strict().optional(),
    generatedSources: z.array(GeneratedSourceInputSchema).max(10_000),
  })
  .strict();

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function derivedSurfaceId(seed: string): string {
  return `DSURF_${createHash("sha256").update(seed).digest("hex").slice(0, 16).toUpperCase()}`;
}

function derivedControlId(
  artifactHash: string,
  selector: string,
  kind: string,
): string {
  const suffix = createHash("sha256")
    .update(`${artifactHash}\0${selector}\0${kind}`)
    .digest("hex")
    .slice(0, 16);
  return `CTRL_${suffix}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizedKind(value: unknown): z.infer<typeof ControlKindSchema> {
  if (typeof value !== "string") return "other";
  const aliases: Record<string, z.infer<typeof ControlKindSchema>> = {
    a: "link",
    anchor: "link",
    button: "button",
    input: "input",
    textarea: "textarea",
    select: "select",
    checkbox: "checkbox",
    radio: "radio",
    link: "link",
  };
  return aliases[value.toLowerCase()] ?? "other";
}

function attribute(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`))?.[1];
}

function dedupeSemanticCandidates(
  candidates: ProjectionControl["semanticCandidates"],
): ProjectionControl["semanticCandidates"] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.actionRef}\0${candidate.sourceKind}\0${candidate.provenance[0]?.sourceHash ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function controlsFromGeneratedSource(
  input: z.infer<typeof GeneratedSourceInputSchema>,
): ProjectionControl[] {
  const controls: ProjectionControl[] = [];
  const lines = input.text.split(/\r?\n/);
  lines.forEach((line, lineIndex) => {
    const tagPattern = /<(button|a|input|textarea|select)\b[^>]*>/g;
    for (const match of line.matchAll(tagPattern)) {
      const tag = match[0];
      const generatedLocalId = attribute(tag, "data-action-id");
      if (!generatedLocalId) continue;
      const actionRef = attribute(tag, "data-action");
      const kind = normalizedKind(match[1]);
      const selector = `[data-action-id="${generatedLocalId.replaceAll('"', '\\"')}"]`;
      const exact = provenanceFromSource(input.source, "exact", {
        lineStart: lineIndex + 1,
        lineEnd: lineIndex + 1,
      });
      controls.push(StitchProjectionControlV1Schema.parse({
        id: derivedControlId(input.source.hash, selector, kind),
        designSurfaceId: input.designSurfaceId,
        surfaceRef: input.surfaceRef,
        generatedLocalId,
        generatedSourceLocator: input.source.locator,
        kind,
        source: {
          artifactHash: input.source.hash,
          locator: input.source.locator,
          selector,
          line: lineIndex + 1,
        },
        identityConfidence: "derived_with_provenance",
        semanticCandidates: actionRef && ActionIdSchema.safeParse(actionRef).success
          ? [{
              actionRef,
              sourceKind: "same_element",
              confidence: "exact",
              provenance: [exact],
            }]
          : [],
        provenance: [exact],
      }));
    }
  });
  return controls;
}

function screenIndexProjection(
  source: z.infer<typeof SourceArtifactRefV1Schema>,
  value: unknown,
): { surfaces: z.infer<typeof StitchProjectionSurfaceV1Schema>[]; controls: ProjectionControl[] } {
  if (!Array.isArray(value)) return { surfaces: [], controls: [] };
  const surfaces: z.infer<typeof StitchProjectionSurfaceV1Schema>[] = [];
  const controls: ProjectionControl[] = [];
  value.forEach((screenValue, screenIndex) => {
    const screen = asRecord(screenValue);
    if (!screen) return;
    const screenId = typeof screen.screenId === "string" ? screen.screenId : `screen-${screenIndex + 1}`;
    const title = typeof screen.title === "string" ? screen.title : screenId;
    const generatedSourceLocator = typeof screen.file === "string"
      && NormalizedRelativeLocatorSchema.safeParse(screen.file).success
      ? screen.file
      : undefined;
    const designSurfaceId = derivedSurfaceId(`${source.hash}\0${screenId}`);
    const surfaceProvenance = provenanceFromSource(source, "heuristic_legacy_only", {
      jsonPointer: `/${screenIndex}`,
      note: "Legacy screen index has no exact ProductSpec surface reference",
    });
    surfaces.push(StitchProjectionSurfaceV1Schema.parse({
      id: designSurfaceId,
      screenId,
      title,
      sourceHash: source.hash,
      sourceLocator: source.locator,
      confidence: "heuristic_legacy_only",
      provenance: [surfaceProvenance],
    }));
    const actions = Array.isArray(screen.actions) ? screen.actions : [];
    actions.forEach((actionValue, actionIndex) => {
      const action = asRecord(actionValue);
      if (!action) return;
      const local = typeof action.generatedLocalId === "string"
        ? action.generatedLocalId
        : typeof action.id === "string" ? action.id : undefined;
      if (!local) return;
      const kind = normalizedKind(action.kind);
      const selector = `[data-action-id="${local.replaceAll('"', '\\"')}"]`;
      const exact = provenanceFromSource(source, "exact", {
        jsonPointer: `/${screenIndex}/actions/${actionIndex}`,
      });
      const actionRef = typeof action.actionRef === "string"
        && ActionIdSchema.safeParse(action.actionRef).success
        ? action.actionRef
        : undefined;
      controls.push(StitchProjectionControlV1Schema.parse({
        id: derivedControlId(source.hash, selector, kind),
        designSurfaceId,
        generatedLocalId: local,
        ...(generatedSourceLocator ? { generatedSourceLocator } : {}),
        kind,
        ...(typeof action.label === "string" && action.label ? { label: action.label } : {}),
        source: {
          artifactHash: source.hash,
          locator: source.locator,
          selector,
        },
        identityConfidence: "derived_with_provenance",
        semanticCandidates: actionRef ? [{
          actionRef,
          sourceKind: "structured_index",
          confidence: "exact",
          provenance: [exact],
        }] : [],
        provenance: [exact],
      }));
    });
  });
  return { surfaces, controls };
}

export function adaptStitchSources(input: unknown): AdapterResult<StitchAdapterProjectionV1> {
  const parsed = StitchAdapterInputSchema.safeParse(input);
  if (!parsed.success) {
    return finalizeAdapterResult({
      diagnostics: parsed.error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
        code: "ADAPTER_STITCH_INPUT_INVALID",
        severity: "error",
        message: `Stitch adapter input failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      })),
    });
  }

  const diagnostics: CompilationDiagnosticV1[] = [];
  const provenance = [];
  const surfaces = parsed.data.generatedSources.map((generated) => {
    const exact = provenanceFromSource(generated.source, "exact");
    provenance.push(exact);
    return StitchProjectionSurfaceV1Schema.parse({
      id: generated.designSurfaceId,
      screenId: generated.designSurfaceId,
      title: generated.designSurfaceId,
      surfaceRef: generated.surfaceRef,
      sourceHash: generated.source.hash,
      sourceLocator: generated.source.locator,
      confidence: "exact",
      provenance: [exact],
    });
  });
  const sourceControls = parsed.data.generatedSources.flatMap(controlsFromGeneratedSource);

  let indexControls: ProjectionControl[] = [];
  if (parsed.data.screenIndex) {
    const projection = screenIndexProjection(
      parsed.data.screenIndex.source,
      parsed.data.screenIndex.value,
    );
    surfaces.push(...projection.surfaces);
    indexControls = projection.controls;
    provenance.push(provenanceFromSource(parsed.data.screenIndex.source, "exact"));
  }

  const controls = [...sourceControls];
  indexControls.forEach((indexControl) => {
    const matches = sourceControls.filter((control) =>
      control.generatedLocalId === indexControl.generatedLocalId
      && indexControl.generatedSourceLocator === control.source.locator);
    if (matches.length === 1) {
      const target = matches[0]!;
      target.semanticCandidates = dedupeSemanticCandidates([
        ...target.semanticCandidates,
        ...indexControl.semanticCandidates,
      ]);
      target.provenance = [...target.provenance, ...indexControl.provenance];
      if (!target.label && indexControl.label) target.label = indexControl.label;
    } else {
      controls.push(indexControl);
      if (matches.length > 1) {
        diagnostics.push(adapterDiagnostic({
          code: "ADAPTER_LOCAL_ID_AMBIGUOUS",
          severity: "error",
          message: `Local control ID ${indexControl.generatedLocalId} occurs on multiple generated surfaces`,
          source: parsed.data.screenIndex?.source,
          reference: indexControl.generatedLocalId,
        }));
      }
    }
  });

  controls.forEach((control) => {
    control.semanticCandidates = dedupeSemanticCandidates(control.semanticCandidates);
    const actionRefs = new Set(control.semanticCandidates.map((candidate) => candidate.actionRef));
    if (actionRefs.size > 1) {
      diagnostics.push(adapterDiagnostic({
        code: "ADAPTER_SEMANTIC_ACTION_AMBIGUOUS",
        severity: "error",
        message: `Control ${control.generatedLocalId} has conflicting exact semantic action candidates`,
        reference: control.generatedLocalId,
        provenance: control.semanticCandidates.flatMap((candidate) => candidate.provenance),
      }));
    }
    if (control.semanticCandidates.length === 0) {
      diagnostics.push(adapterDiagnostic({
        code: "ADAPTER_SEMANTIC_ACTION_MISSING",
        severity: "warning",
        message: `Control ${control.generatedLocalId} has no exact semantic action reference`,
        reference: control.generatedLocalId,
        provenance: control.provenance,
      }));
      if (control.label) {
        diagnostics.push(adapterDiagnostic({
          code: "ADAPTER_HEURISTIC_LABEL_SUGGESTION",
          severity: "info",
          message: `Label ${JSON.stringify(control.label)} is diagnostic context only`,
          reference: control.generatedLocalId,
          provenance: control.provenance,
          suggestions: [{
            reference: control.label,
            reason: "Legacy label is not a stable semantic action reference",
            confidence: "heuristic_legacy_only",
          }],
        }));
      }
    }
  });

  const rawArtifactHashes = [...new Set([
    ...parsed.data.rawArtifactHashes,
    ...(parsed.data.screenIndex ? [parsed.data.screenIndex.source.hash] : []),
    ...parsed.data.generatedSources.map((generated) => generated.source.hash),
  ])].sort(compareUtf16);
  const uniqueSurfaces = [...new Map(surfaces.map((surface) => [surface.id, surface])).values()]
    .sort((left, right) => compareUtf16(left.id, right.id));
  controls.sort((left, right) => compareUtf16(
    `${left.designSurfaceId}\0${left.generatedLocalId}\0${left.source.locator}`,
    `${right.designSurfaceId}\0${right.generatedLocalId}\0${right.source.locator}`,
  ));

  const candidateResult = StitchAdapterProjectionV1Schema.safeParse({
    schema: "setfarm.stitch-adapter-projection.v1",
    rawArtifactHashes,
    surfaces: uniqueSurfaces,
    controls,
  });
  if (!candidateResult.success) {
    diagnostics.push(...candidateResult.error.issues.slice(0, 100).map((issue) => adapterDiagnostic({
      code: "ADAPTER_STITCH_PROJECTION_INVALID",
      severity: "error",
      message: `Stitch projection failed at ${issue.path.join("/") || "$"}: ${issue.message}`,
      reference: issue.path.join("/") || "$",
    })));
    return finalizeAdapterResult({ diagnostics, provenance });
  }
  return finalizeAdapterResult({ candidate: candidateResult.data, diagnostics, provenance });
}
