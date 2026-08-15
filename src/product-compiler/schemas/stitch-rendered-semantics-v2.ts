import { z } from "zod";

import { hashCanonicalJson } from "../canonical-json.js";
import {
  ActionIdSchema,
  NormalizedRelativeLocatorSchema,
  ObservableIdSchema,
  Sha256Schema,
  hasUniqueStrings,
} from "./common-v1.js";
import { ControlSlotIdSchema } from "./common-v2.js";
import { GenerationTargetIdSchema } from "./design-generation-targets-v1.js";
import {
  StitchRenderedElementV1Schema,
  StitchRenderedSemanticsV1Schema,
} from "./stitch-rendered-semantics-v1.js";

export const STITCH_RENDERED_SEMANTICS_POLICY_V2 =
  "chromium-offline-role-receipts-control-slots.v2" as const;

export const StitchRenderedSemanticsInfrastructurePhaseV2Schema = z.enum([
  "input_validation",
  "source_validation",
  "resource_prefetch",
  "browser_launch",
  "document_render",
  "document_settle",
  "dom_observation",
  "role_observation",
  "semantic_dom_serialization",
  "artifact_validation",
  "sidecar_write",
  "replay_read",
  "replay_render",
  "replay_observation",
]);

export type StitchRenderedSemanticsInfrastructurePhaseV2 = z.infer<
  typeof StitchRenderedSemanticsInfrastructurePhaseV2Schema
>;

export const StitchRenderedElementV2Schema = z.object({
  ...StitchRenderedElementV1Schema.shape,
  dataControlSlot: ControlSlotIdSchema.nullable(),
}).strict().superRefine((value, context) => {
  if ((value.renderBlockers.length === 0) !== (value.renderState === "rendered")) {
    context.addIssue({
      code: "custom",
      path: ["renderState"],
      message: "Rendered state must be derived from the exact blocker set",
    });
  }
  if (value.pointerOperable && (value.renderState !== "rendered" || !value.enabled)) {
    context.addIssue({
      code: "custom",
      path: ["pointerOperable"],
      message: "Pointer-operable elements must be rendered and enabled",
    });
  }
});

export type StitchRenderedElementV2 = z.infer<typeof StitchRenderedElementV2Schema>;

const ObservablePhaseV2Schema = z.enum(["before", "after", "reload"]);
const ElementRefSchema = z.string().regex(/^E[0-9]{6}$/);

export const StitchGetByRoleReceiptV2Schema = z.object({
  observableRef: ObservableIdSchema,
  actionRef: ActionIdSchema,
  selectorHash: Sha256Schema,
  surfaceRef: z.string().min(1).max(500),
  query: z.object({
    engine: z.literal("playwright"),
    method: z.literal("getByRole"),
    role: z.string().min(1).max(100),
    name: z.string().min(1).max(500),
    exact: z.literal(true),
    includeHidden: z.literal(true),
  }).strict(),
  phases: z.array(ObservablePhaseV2Schema).min(1).max(3).refine(hasUniqueStrings, {
    message: "Role receipt phases must be unique",
  }),
  visibilityRequirement: z.enum([
    "must_be_visible_before",
    "traceable_hidden_allowed",
  ]),
  elementRefs: z.array(ElementRefSchema).length(1, {
    message: "Role receipts must resolve one exact browser element",
  }).refine(hasUniqueStrings, {
    message: "Role receipt element refs must be unique",
  }),
  nearestSurfaceRefs: z.array(z.string().min(1).max(500).nullable()).length(1, {
    message: "Role receipts must preserve one exact nearest-surface observation",
  }),
  cardinality: z.object({
    expected: z.literal(1),
    observed: z.number().int().nonnegative().max(1_000),
    visible: z.number().int().nonnegative().max(1_000),
  }).strict(),
}).strict().superRefine((value, context) => {
  const phaseOrder = new Map(["before", "after", "reload"].map((phase, index) => [phase, index]));
  if (value.phases.some((phase, index) =>
    index > 0 && phaseOrder.get(phase)! <= phaseOrder.get(value.phases[index - 1]!)!)) {
    context.addIssue({
      code: "custom",
      path: ["phases"],
      message: "Role receipt phases must be canonically ordered",
    });
  }
  if (
    value.cardinality.observed !== value.elementRefs.length
    || value.nearestSurfaceRefs.length !== value.elementRefs.length
    || value.cardinality.visible > value.cardinality.observed
  ) {
    context.addIssue({
      code: "custom",
      path: ["cardinality"],
      message: "Role receipt cardinality must exactly describe its element and surface observations",
    });
  }
  if (value.cardinality.observed !== value.cardinality.expected) {
    context.addIssue({
      code: "custom",
      path: ["cardinality", "observed"],
      message: "Role receipts require exactly one browser-computed match",
    });
  }
  if (
    value.visibilityRequirement === "must_be_visible_before"
    && value.cardinality.visible !== 1
  ) {
    context.addIssue({
      code: "custom",
      path: ["cardinality", "visible"],
      message: "A before-visible observable requires one visible browser-computed role match",
    });
  }
});

export type StitchGetByRoleReceiptV2 = z.infer<typeof StitchGetByRoleReceiptV2Schema>;

export const StitchRenderedCandidateFailureCodeV2Schema = z.enum([
  "HTML_INVALID",
  "SCREENSHOT_INVALID",
  "ARTIFACT_HASH_MISMATCH",
  "TARGET_IDENTITY_UNRESOLVED",
  "UNSAFE_SCREEN_ID",
  "DUPLICATE_CONTRACT_ATTRIBUTE",
  "INVALID_CONTRACT_ATTRIBUTE",
  "UNSUPPORTED_EXECUTABLE_SCRIPT",
  "RESOURCE_POLICY_VIOLATION",
  "RESOURCE_CAPACITY_EXCEEDED",
  "OBSERVABLE_ROLE_CARDINALITY_MISMATCH",
  "OBSERVABLE_BEFORE_VISIBLE_MISSING",
]);

export const StitchRenderedCandidateV2Schema = z.object({
  stageId: z.string().min(1).max(160),
  screenId: z.string().min(1).max(500),
  targetRef: GenerationTargetIdSchema.nullable(),
  htmlArtifactHash: Sha256Schema.nullable(),
  screenshotArtifactHash: Sha256Schema.nullable(),
  semanticDom: z.object({
    locator: NormalizedRelativeLocatorSchema,
    hash: Sha256Schema,
    byteLength: z.number().int().positive().max(8 * 1024 * 1024),
  }).strict().nullable(),
  resourceRefs: z.array(Sha256Schema).max(1_000).refine(hasUniqueStrings, {
    message: "Candidate render resource refs must be unique",
  }),
  status: z.enum(["rendered", "source_rejected"]),
  failureCodes: z.array(StitchRenderedCandidateFailureCodeV2Schema).max(8).refine(hasUniqueStrings, {
    message: "Rendered-semantics failure codes must be unique",
  }),
  elements: z.array(StitchRenderedElementV2Schema).max(100_000),
  roleReceipts: z.array(StitchGetByRoleReceiptV2Schema).max(2_000),
  observationHash: Sha256Schema.nullable(),
}).strict().superRefine((value, context) => {
  const refs = value.elements.map((element) => element.elementRef);
  const ordinals = value.elements.map((element) => element.sourceOrdinal);
  if (!hasUniqueStrings(refs) || new Set(ordinals).size !== ordinals.length) {
    context.addIssue({
      code: "custom",
      path: ["elements"],
      message: "Rendered elements must have unique refs and source ordinals",
    });
  }
  if (ordinals.some((ordinal, index) => index > 0 && ordinal <= ordinals[index - 1]!)) {
    context.addIssue({
      code: "custom",
      path: ["elements"],
      message: "Rendered elements must be sorted by source ordinal",
    });
  }
  if (!hasUniqueStrings(value.roleReceipts.map((receipt) => receipt.observableRef))) {
    context.addIssue({
      code: "custom",
      path: ["roleReceipts"],
      message: "Rendered candidate role receipt observable refs must be unique",
    });
  }
  const elementByRef = new Map(value.elements.map((element) => [element.elementRef, element] as const));
  value.roleReceipts.forEach((receipt, receiptIndex) => {
    receipt.elementRefs.forEach((elementRef, elementIndex) => {
      const element = elementByRef.get(elementRef);
      if (!element) {
        context.addIssue({
          code: "custom",
          path: ["roleReceipts", receiptIndex, "elementRefs", elementIndex],
          message: `Role receipt references absent rendered element ${elementRef}`,
        });
      } else if (element.nearestSurfaceRef !== receipt.nearestSurfaceRefs[elementIndex]) {
        context.addIssue({
          code: "custom",
          path: ["roleReceipts", receiptIndex, "nearestSurfaceRefs", elementIndex],
          message: "Role receipt nearest surface must equal the exact rendered element observation",
        });
      }
    });
  });

  if (value.status === "rendered") {
    if (
      !value.htmlArtifactHash
      || !value.screenshotArtifactHash
      || !value.semanticDom
      || value.failureCodes.length > 0
      || value.observationHash !== hashCanonicalJson({
        elements: value.elements,
        roleReceipts: value.roleReceipts,
      })
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Rendered candidates require exact DOM, elements, role receipts, and observation hash without failure codes",
      });
    }
  } else if (
    value.semanticDom
    || value.resourceRefs.length > 0
    || value.elements.length > 0
    || value.roleReceipts.length > 0
    || value.observationHash
    || value.failureCodes.length === 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Rejected candidate evidence must preserve typed failures without fabricated browser observations",
    });
  }
});

export type StitchRenderedCandidateV2 = z.infer<typeof StitchRenderedCandidateV2Schema>;

const RendererIdentityV1Schema = StitchRenderedSemanticsV1Schema.shape.renderer;
const StitchRenderProfileV1Schema = StitchRenderedSemanticsV1Schema.shape.profile;
const RenderResourceV2Schema = z.object({
  urlHash: Sha256Schema,
  resourceType: z.enum(["script", "stylesheet", "image"]),
  contentType: z.enum([
    "application/javascript",
    "text/css",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]).optional(),
  contentHash: Sha256Schema,
  byteLength: z.number().int().nonnegative().max(8 * 1024 * 1024),
  locator: NormalizedRelativeLocatorSchema,
}).strict().superRefine((value, context) => {
  if (value.locator !== `stitch/render-resources/${value.contentHash}.bin`) {
    context.addIssue({
      code: "custom",
      path: ["locator"],
      message: "Render resource locator must be content-addressed",
    });
  }
  const contentTypeMatches = value.resourceType === "script"
    ? value.contentType === undefined || value.contentType === "application/javascript"
    : value.resourceType === "stylesheet"
      ? value.contentType === undefined || value.contentType === "text/css"
      : value.contentType?.startsWith("image/") === true;
  if (!contentTypeMatches) {
    context.addIssue({
      code: "custom",
      path: ["contentType"],
      message: "Render resource content type must match its sealed resource type",
    });
  }
});

export const StitchRenderedSemanticsV2Schema = z.object({
  schema: z.literal("setfarm.stitch-rendered-semantics.v2"),
  policy: z.literal(STITCH_RENDERED_SEMANTICS_POLICY_V2),
  generationTargetsHash: Sha256Schema,
  directResponseEvidenceHash: Sha256Schema,
  renderer: RendererIdentityV1Schema,
  profile: StitchRenderProfileV1Schema,
  resources: z.array(RenderResourceV2Schema).max(10_000),
  candidates: z.array(StitchRenderedCandidateV2Schema).min(1).max(10_000),
}).strict().superRefine((value, context) => {
  for (const [path, values] of [
    [["resources"], value.resources.map((resource) => resource.urlHash)],
    [["candidates"], value.candidates.map((candidate) => candidate.screenId)],
  ] as const) {
    if (!hasUniqueStrings(values)) {
      context.addIssue({
        code: "custom",
        path: [...path],
        message: "Rendered-semantics identities must be unique",
      });
    }
  }
  if (value.resources.some((resource, index) =>
    index > 0 && resource.urlHash <= value.resources[index - 1]!.urlHash)) {
    context.addIssue({
      code: "custom",
      path: ["resources"],
      message: "Render resources must be canonically sorted",
    });
  }
  if (value.candidates.some((candidate, index) =>
    index > 0 && candidate.screenId <= value.candidates[index - 1]!.screenId)) {
    context.addIssue({
      code: "custom",
      path: ["candidates"],
      message: "Rendered candidates must be canonically sorted",
    });
  }
  const resourceHashes = new Set(value.resources.map((resource) => resource.urlHash));
  value.candidates.forEach((candidate, candidateIndex) => {
    candidate.resourceRefs.forEach((hash, resourceIndex) => {
      if (!resourceHashes.has(hash)) {
        context.addIssue({
          code: "custom",
          path: ["candidates", candidateIndex, "resourceRefs", resourceIndex],
          message: "Candidate resource ref is absent from the sealed resource set",
        });
      }
    });
  });
});

export type StitchRenderedSemanticsV2 = z.infer<typeof StitchRenderedSemanticsV2Schema>;
