import { z } from "zod";

import {
  ActionIdSchema,
  ControlIdSchema,
  DesignSurfaceIdSchema,
  EvidenceIdSchema,
  NormalizedRelativeLocatorSchema,
  PersistenceIdSchema,
  ProvenanceRefV1Schema,
  RouteIdSchema,
  Sha256Schema,
  StateIdSchema,
  SurfaceIdSchema,
  hasUniqueStrings,
} from "./common-v1.js";

export const DesignSurfaceV1Schema = z
  .object({
    id: DesignSurfaceIdSchema,
    surfaceRef: SurfaceIdSchema,
    sourceArtifactHash: Sha256Schema,
    sourceLocator: NormalizedRelativeLocatorSchema,
  })
  .strict();

export type DesignSurfaceV1 = z.infer<typeof DesignSurfaceV1Schema>;

const ExplicitControlIdentityV1Schema = z
  .object({
    kind: z.literal("explicit"),
    provenance: z.array(ProvenanceRefV1Schema).min(1).max(100),
  })
  .strict();

const DerivedControlIdentityV1Schema = z
  .object({
    kind: z.literal("derived"),
    formula: z.literal("setfarm-control-id-v1"),
    provenance: z.array(ProvenanceRefV1Schema).min(1).max(100),
  })
  .strict();

const ControlSourceV1Schema = z
  .object({
    artifactHash: Sha256Schema,
    locator: NormalizedRelativeLocatorSchema,
    selector: z.string().min(1).max(2_000),
    line: z.number().int().positive().optional(),
    column: z.number().int().nonnegative().optional(),
  })
  .strict();

export const DesignControlV1Schema = z
  .object({
    id: ControlIdSchema,
    identity: z.discriminatedUnion("kind", [
      ExplicitControlIdentityV1Schema,
      DerivedControlIdentityV1Schema,
    ]),
    generatedLocalId: z.string().min(1).max(500).optional(),
    kind: z.enum([
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
    ]),
    label: z.string().min(1).max(500).optional(),
    accessibility: z.object({
      role: z.string().min(1).max(160).optional(),
      name: z.string().min(1).max(500).optional(),
    }).strict(),
    surfaceRef: SurfaceIdSchema,
    interactive: z.boolean(),
    source: ControlSourceV1Schema,
  })
  .strict();

export type DesignControlV1 = z.infer<typeof DesignControlV1Schema>;

export const DesignBindingValueSourceV1Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("control_value"), controlRef: ControlIdSchema }).strict(),
  z.object({
    kind: z.literal("state"),
    stateRef: StateIdSchema,
    path: z.string().max(500).refine((value) => value === "" || value.startsWith("/")),
  }).strict(),
  z.object({ kind: z.literal("literal"), value: z.json() }).strict(),
]);

const ActionInputBindingV1Schema = z
  .object({
    inputField: z.string().min(1).max(160),
    valueFrom: DesignBindingValueSourceV1Schema,
  })
  .strict();

export const ActionControlBindingV1Schema = z
  .object({
    controlRef: ControlIdSchema,
    disposition: z.literal("action"),
    actionRef: ActionIdSchema,
    routeRef: RouteIdSchema.optional(),
    inputBindings: z.array(ActionInputBindingV1Schema).max(500),
    stateRefs: z.array(StateIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Binding state refs must be unique",
    }),
    persistenceRefs: z.array(PersistenceIdSchema).max(500).refine(hasUniqueStrings, {
      message: "Binding persistence refs must be unique",
    }),
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500).refine(hasUniqueStrings, {
      message: "Binding evidence refs must be unique",
    }),
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

const ExternalTargetV1Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("url"),
    url: z.url().refine((value) => value.startsWith("https://") || value.startsWith("http://")),
  }).strict(),
  z.object({
    kind: z.literal("download"),
    path: NormalizedRelativeLocatorSchema,
  }).strict(),
]);

export const ExternalControlBindingV1Schema = z
  .object({
    controlRef: ControlIdSchema,
    disposition: z.literal("external"),
    target: ExternalTargetV1Schema,
    evidenceRefs: z.array(EvidenceIdSchema).min(1).max(500).refine(hasUniqueStrings, {
      message: "External binding evidence refs must be unique",
    }),
  })
  .strict();

export const DisabledControlBindingV1Schema = z
  .object({
    controlRef: ControlIdSchema,
    disposition: z.literal("disabled"),
    reason: z.string().min(1).max(1_000),
  })
  .strict();

export const InformationalControlBindingV1Schema = z
  .object({
    controlRef: ControlIdSchema,
    disposition: z.literal("informational"),
    reason: z.string().min(1).max(1_000),
  })
  .strict();

export const DesignControlBindingV1Schema = z.discriminatedUnion("disposition", [
  ActionControlBindingV1Schema,
  ExternalControlBindingV1Schema,
  DisabledControlBindingV1Schema,
  InformationalControlBindingV1Schema,
]);

export type DesignControlBindingV1 = z.infer<typeof DesignControlBindingV1Schema>;

const UnresolvedSuggestionV1Schema = z
  .object({
    reference: z.string().min(1).max(160),
    reason: z.string().min(1).max(500),
    confidence: z.enum(["ambiguous", "missing", "heuristic_legacy_only"]),
  })
  .strict();

export const UnresolvedControlBindingV1Schema = z
  .object({
    controlRef: ControlIdSchema,
    code: z.string().regex(/^LINK_[A-Z0-9_]+$/).max(160),
    provenance: z.array(ProvenanceRefV1Schema).max(100),
    suggestions: z.array(UnresolvedSuggestionV1Schema).max(100),
  })
  .strict();

export type UnresolvedControlBindingV1 = z.infer<typeof UnresolvedControlBindingV1Schema>;

export const DesignInteractionGraphV1Schema = z
  .object({
    schema: z.literal("setfarm.design-interaction-graph.v1"),
    rawArtifactHashes: z.array(Sha256Schema).min(1).max(1_000).refine(hasUniqueStrings, {
      message: "Raw design artifact hashes must be unique",
    }),
    surfaces: z.array(DesignSurfaceV1Schema).min(1).max(1_000),
    controls: z.array(DesignControlV1Schema).min(1).max(10_000),
    bindings: z.array(DesignControlBindingV1Schema).max(10_000),
    unresolvedBindings: z.array(UnresolvedControlBindingV1Schema).max(10_000),
  })
  .strict()
  .superRefine((value, context) => {
    if (!hasUniqueStrings(value.surfaces.map((item) => item.id))) {
      context.addIssue({ code: "custom", path: ["surfaces"], message: "Design surface IDs must be unique" });
    }
    if (!hasUniqueStrings(value.controls.map((item) => item.id))) {
      context.addIssue({ code: "custom", path: ["controls"], message: "Control IDs must be unique" });
    }
    const controlIds = new Set(value.controls.map((item) => item.id));
    const surfaceRefs = new Set(value.surfaces.map((item) => item.surfaceRef));
    value.controls.forEach((control, index) => {
      if (!surfaceRefs.has(control.surfaceRef)) {
        context.addIssue({
          code: "custom",
          path: ["controls", index, "surfaceRef"],
          message: `Control references absent design surface: ${control.surfaceRef}`,
        });
      }
      if (!value.rawArtifactHashes.includes(control.source.artifactHash)) {
        context.addIssue({
          code: "custom",
          path: ["controls", index, "source", "artifactHash"],
          message: "Control source hash must be declared in rawArtifactHashes",
        });
      }
    });
    value.surfaces.forEach((surface, index) => {
      if (!value.rawArtifactHashes.includes(surface.sourceArtifactHash)) {
        context.addIssue({
          code: "custom",
          path: ["surfaces", index, "sourceArtifactHash"],
          message: "Design surface source hash must be declared in rawArtifactHashes",
        });
      }
    });

    const dispositions = new Map<string, Array<{ kind: "binding" | "unresolved"; index: number }>>();
    value.bindings.forEach((binding, index) => {
      if (!controlIds.has(binding.controlRef)) {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "controlRef"],
          message: `Binding references absent control: ${binding.controlRef}`,
        });
      }
      const entries = dispositions.get(binding.controlRef) ?? [];
      entries.push({ kind: "binding", index });
      dispositions.set(binding.controlRef, entries);

      const control = value.controls.find((item) => item.id === binding.controlRef);
      if (control && !control.interactive && binding.disposition !== "informational") {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "disposition"],
          message: "Non-interactive controls must be informational",
        });
      }
      if (control && control.interactive && binding.disposition === "informational") {
        context.addIssue({
          code: "custom",
          path: ["bindings", index, "disposition"],
          message: "Interactive controls cannot be informational",
        });
      }
      if (binding.disposition === "action") {
        binding.inputBindings.forEach((input, inputIndex) => {
          if (input.valueFrom.kind === "control_value" && !controlIds.has(input.valueFrom.controlRef)) {
            context.addIssue({
              code: "custom",
              path: ["bindings", index, "inputBindings", inputIndex, "valueFrom", "controlRef"],
              message: `Input binding references absent control: ${input.valueFrom.controlRef}`,
            });
          }
        });
      }
    });
    value.unresolvedBindings.forEach((unresolved, index) => {
      if (!controlIds.has(unresolved.controlRef)) {
        context.addIssue({
          code: "custom",
          path: ["unresolvedBindings", index, "controlRef"],
          message: `Unresolved binding references absent control: ${unresolved.controlRef}`,
        });
      }
      const entries = dispositions.get(unresolved.controlRef) ?? [];
      entries.push({ kind: "unresolved", index });
      dispositions.set(unresolved.controlRef, entries);
    });
    value.controls.forEach((control, index) => {
      const entries = dispositions.get(control.id) ?? [];
      if (entries.length !== 1) {
        context.addIssue({
          code: "custom",
          path: ["controls", index],
          message: `Control ${control.id} requires exactly one binding or unresolved record`,
        });
      }
    });
  });

export type DesignInteractionGraphV1 = z.infer<typeof DesignInteractionGraphV1Schema>;
